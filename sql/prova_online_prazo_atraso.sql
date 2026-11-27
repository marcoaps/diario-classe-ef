-- ============================================================================
-- Prova Online: prazo, desconto por atraso e falta justificada
-- Rode no SQL Editor do Supabase (pode rodar mais de uma vez).
--
-- NÃO altera nenhuma nota existente: só acrescenta colunas (que ficam vazias
-- nas respostas já enviadas = nota sem desconto), duas tabelas, funções e
-- gatilhos. A regra só vale nas provas que tiverem "prazo_integral" preenchido.
--
-- Conferência ANTES (opcional): o esperado é "timestamp without time zone" e
-- um default em UTC (ex.: now()). O gatilho abaixo grava o horário em UTC.
--   select column_name, data_type, column_default from information_schema.columns
--    where table_name = 'respostas' and column_name = 'enviado_em';
-- ============================================================================

begin;

-- 1) Regra na própria prova --------------------------------------------------
alter table provas add column if not exists prazo_integral timestamptz;
alter table provas add column if not exists faixas_atraso jsonb not null
  default '[{"dias":1,"percentual":80},{"dias":2,"percentual":60},{"dias":3,"percentual":50}]'::jsonb;

comment on column provas.prazo_integral is 'Até este momento a nota vale 100%. Vazio = prova sem regra de atraso.';
comment on column provas.faixas_atraso is 'Lista {dias, percentual}: dias de atraso depois do prazo e quanto a nota vale. Passando da última faixa a prova não aceita envio.';

-- 2) Resultado de cada tentativa ("nota" continua sendo a corrigida, sem desconto)
alter table respostas add column if not exists dias_atraso integer;
alter table respostas add column if not exists percentual_aplicado numeric;
alter table respostas add column if not exists nota_final numeric;
alter table respostas add column if not exists envio_id uuid;
create unique index if not exists respostas_envio_id_unico on respostas (envio_id) where envio_id is not null;

-- 3) Falta justificada (vale para o aluno naquela prova, com ou sem envio) ----
create table if not exists prova_faltas_justificadas (
  prova_id uuid not null references provas(id) on delete cascade,
  turma_id text not null,
  aluno_numero integer not null,
  aluno_nome text,
  criado_em timestamptz not null default now(),
  primary key (prova_id, turma_id, aluno_numero)
);
alter table prova_faltas_justificadas enable row level security;
-- Só o professor logado lê e grava. O aluno não enxerga a lista.
drop policy if exists prova_faltas_justificadas_prof on prova_faltas_justificadas;
create policy prova_faltas_justificadas_prof on prova_faltas_justificadas
  for all to authenticated using (true) with check (true);

-- 4) Momento em que o aluno tocou em "Enviar" (antes da correção por IA) ------
create table if not exists prova_envios_iniciados (
  id uuid primary key default gen_random_uuid(),
  prova_id uuid not null references provas(id) on delete cascade,
  turma_id text not null,
  aluno_numero integer,
  iniciado_em timestamptz not null
);
-- Sem nenhuma policy: só as funções abaixo (security definer) mexem aqui.
alter table prova_envios_iniciados enable row level security;

-- 5) Funções ------------------------------------------------------------------

-- Relógio do servidor (função separada para poder ser testada).
create or replace function prova_agora() returns timestamptz
language sql stable as $$ select now() $$;

-- Dias de atraso. O minuto do prazo conta inteiro: prazo 23:59 aceita 23:59:59.
-- Cada bloco de 24 h depois disso é mais um dia.
create or replace function prova_dias_atraso(p_prazo timestamptz, p_momento timestamptz)
returns integer language sql immutable as $$
  select case
    when p_prazo is null then 0
    when p_momento < date_trunc('minute', p_prazo, 'UTC') + interval '1 minute' then 0
    else floor(extract(epoch from (p_momento - (date_trunc('minute', p_prazo, 'UTC') + interval '1 minute'))) / 86400)::integer + 1
  end
$$;

-- Percentual da faixa que cobre o atraso. NULL = passou da última faixa.
create or replace function prova_percentual_faixa(p_faixas jsonb, p_dias integer)
returns numeric language sql immutable as $$
  select case when p_dias <= 0 then 100::numeric else (
    select (f->>'percentual')::numeric
      from jsonb_array_elements(coalesce(p_faixas, '[]'::jsonb)) f
     where (f->>'dias')::integer >= p_dias
     order by (f->>'dias')::integer
     limit 1
  ) end
$$;

-- Com desconto: arredonda para cima, para o próximo 0,5. Sem desconto: não mexe.
create or replace function prova_nota_final(p_nota numeric, p_percentual numeric)
returns numeric language sql immutable as $$
  select case
    when p_nota is null then null
    when p_percentual >= 100 then round(p_nota, 2)
    else round(least(10, greatest(0, ceil(round(p_nota * p_percentual / 100, 2) * 2) / 2)), 2)
  end
$$;

-- Situação de um aluno numa prova, "agora".
create or replace function prova_situacao_envio(p_prova uuid, p_turma text, p_numero integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_prazo timestamptz;
  v_faixas jsonb;
  v_dias integer;
  v_perc numeric;
  v_just boolean;
begin
  select prazo_integral, faixas_atraso into v_prazo, v_faixas from provas where id = p_prova;
  v_just := exists (select 1 from prova_faltas_justificadas f
                     where f.prova_id = p_prova and f.turma_id = p_turma and f.aluno_numero = p_numero);
  v_dias := prova_dias_atraso(v_prazo, prova_agora());
  v_perc := case when v_just then 100 else prova_percentual_faixa(v_faixas, v_dias) end;
  return jsonb_build_object(
    'tem_regra', v_prazo is not null,
    'dias_atraso', v_dias,
    'justificada', v_just,
    'percentual', v_perc,
    'permitido', v_perc is not null
  );
end $$;

-- Chamada no toque em "Enviar": guarda o horário do servidor e devolve um
-- comprovante, válido por 15 minutos (tempo de sobra para a correção por IA).
create or replace function prova_registrar_envio(p_prova uuid, p_turma text, p_numero integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not (prova_situacao_envio(p_prova, p_turma, p_numero)->>'permitido')::boolean then
    raise exception 'PRAZO_ENCERRADO';
  end if;
  insert into prova_envios_iniciados (prova_id, turma_id, aluno_numero, iniciado_em)
  values (p_prova, p_turma, p_numero, prova_agora())
  returning id into v_id;
  return v_id;
end $$;

grant execute on function prova_situacao_envio(uuid, text, integer) to anon, authenticated;
grant execute on function prova_registrar_envio(uuid, text, integer) to anon, authenticated;

-- 6) Gatilho: o banco decide horário, percentual e nota final ------------------
create or replace function respostas_aplicar_atraso() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prazo timestamptz;
  v_faixas jsonb;
  v_momento timestamptz;
  v_perc numeric;
  v_just boolean;
begin
  -- Respostas anteriores à regra (percentual vazio) ficam como estão.
  if tg_op = 'UPDATE' and old.percentual_aplicado is null then
    new.dias_atraso := null;
    new.percentual_aplicado := null;
    new.nota_final := null;
    return new;
  end if;

  select prazo_integral, faixas_atraso into v_prazo, v_faixas from provas where id = new.prova_id;

  if tg_op = 'INSERT' then
    -- Horário sempre do servidor; o que vier do navegador é ignorado.
    select i.iniciado_em into v_momento from prova_envios_iniciados i
     where i.id = new.envio_id
       and i.prova_id = new.prova_id
       and i.turma_id = new.turma_id
       and i.aluno_numero is not distinct from new.aluno_numero
       and i.iniciado_em > prova_agora() - interval '15 minutes';
    if v_momento is null then
      new.envio_id := null;
      v_momento := prova_agora();
    end if;
    new.enviado_em := v_momento at time zone 'UTC';

    if v_prazo is null then
      new.dias_atraso := null;
      new.percentual_aplicado := null;
      new.nota_final := null;
      return new;
    end if;
  else
    new.enviado_em := old.enviado_em;
    v_momento := old.enviado_em at time zone 'UTC';
  end if;

  v_just := exists (select 1 from prova_faltas_justificadas f
                     where f.prova_id = new.prova_id and f.turma_id = new.turma_id and f.aluno_numero = new.aluno_numero);
  new.dias_atraso := prova_dias_atraso(v_prazo, v_momento);
  v_perc := case when v_just then 100 else prova_percentual_faixa(v_faixas, new.dias_atraso) end;

  if v_perc is null then
    if tg_op = 'INSERT' then
      raise exception 'PRAZO_ENCERRADO';
    end if;
    -- Já tinha sido aceita (ex.: falta justificada desmarcada depois do último
    -- dia): vale a última faixa.
    select (f->>'percentual')::numeric into v_perc
      from jsonb_array_elements(coalesce(v_faixas, '[]'::jsonb)) f
     order by (f->>'dias')::integer desc limit 1;
    v_perc := coalesce(v_perc, 100);
  end if;

  new.percentual_aplicado := v_perc;
  new.nota_final := prova_nota_final(new.nota::numeric, v_perc);
  return new;
end $$;

drop trigger if exists respostas_atraso on respostas;
create trigger respostas_atraso
  before insert or update on respostas
  for each row execute function respostas_aplicar_atraso();

-- Marcar/desmarcar falta justificada recalcula as tentativas do aluno.
create or replace function prova_faltas_recalcular() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v record;
begin
  if tg_op = 'DELETE' then v := old; else v := new; end if;
  update respostas set percentual_aplicado = percentual_aplicado
   where prova_id = v.prova_id and turma_id = v.turma_id and aluno_numero = v.aluno_numero
     and percentual_aplicado is not null;
  return null;
end $$;

drop trigger if exists prova_faltas_recalculo on prova_faltas_justificadas;
create trigger prova_faltas_recalculo
  after insert or delete on prova_faltas_justificadas
  for each row execute function prova_faltas_recalcular();

-- Mudar o prazo ou as faixas recalcula quem foi enviado já sob a regra.
create or replace function provas_regra_recalcular() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.prazo_integral is distinct from old.prazo_integral
     or new.faixas_atraso is distinct from old.faixas_atraso then
    update respostas set percentual_aplicado = percentual_aplicado
     where prova_id = new.id and percentual_aplicado is not null;
  end if;
  return null;
end $$;

drop trigger if exists provas_regra_recalculo on provas;
create trigger provas_regra_recalculo
  after update on provas
  for each row execute function provas_regra_recalcular();

commit;

-- Faz a API do Supabase enxergar as colunas e funções novas na hora.
notify pgrst, 'reload schema';
