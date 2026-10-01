-- ============================================================================
-- Interclasses IOP — edição da inscrição pelo responsável via código do time
-- Rode no SQL Editor do Supabase DEPOIS de interclasses_inscricoes_publico.sql
-- e interclasses_configuracoes.sql.
--
-- Cada time recebe um código de 6 caracteres. Com ele o responsável (sem login)
-- remove alunos e troca camisa pela página pública. UPDATE/DELETE continuam
-- fechados pra "anon" — tudo passa por funções SECURITY DEFINER que validam o
-- código e o prazo de inscrição.
-- ============================================================================

create table if not exists interclasses_times_codigos (
  edicao text not null,
  modalidade text not null,
  time_norm text not null,          -- lower(trim(nome_time))
  codigo text not null,
  criado_em timestamptz not null default now(),
  primary key (edicao, modalidade, time_norm)
);

-- RLS ligado e SEM policy pra anon: o código nunca é legível pelo cliente público.
alter table interclasses_times_codigos enable row level security;
drop policy if exists interclasses_times_codigos_prof on interclasses_times_codigos;
create policy interclasses_times_codigos_prof on interclasses_times_codigos
  for all to authenticated using (true) with check (true);

-- Backfill: códigos pros times que já existem.
insert into interclasses_times_codigos (edicao, modalidade, time_norm, codigo)
select edicao, coalesce(modalidade, 'futsal'), lower(trim(nome_time)),
       upper(substr(md5(random()::text || min(id::text)), 1, 6))
from interclasses_inscricoes
group by edicao, coalesce(modalidade, 'futsal'), lower(trim(nome_time))
on conflict do nothing;

-- Gera o código quando o time acabou de ser criado. Devolve NULL se o time já
-- tinha código (nunca revela o código de um time existente).
create or replace function interclasses_gerar_codigo(p_edicao text, p_modalidade text, p_nome_time text)
returns text language plpgsql security definer set search_path = public as $$
declare v text := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
begin
  if not exists (select 1 from interclasses_inscricoes
      where edicao = p_edicao and coalesce(modalidade, 'futsal') = p_modalidade
        and lower(trim(nome_time)) = lower(trim(p_nome_time))) then
    return null;
  end if;
  insert into interclasses_times_codigos (edicao, modalidade, time_norm, codigo)
    values (p_edicao, p_modalidade, lower(trim(p_nome_time)), v)
    on conflict do nothing;
  if found then return v; end if;
  return null;
end $$;

create or replace function interclasses_validar_codigo(p_edicao text, p_modalidade text, p_nome_time text, p_codigo text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from interclasses_times_codigos
    where edicao = p_edicao and modalidade = p_modalidade
      and time_norm = lower(trim(p_nome_time)) and codigo = upper(trim(p_codigo)));
$$;

-- Checagem comum: código bate com o time da inscrição E o prazo está aberto.
create or replace function interclasses_checar_edicao(p_codigo text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select edicao, coalesce(modalidade, 'futsal') as modalidade, lower(trim(nome_time)) as t
    into r from interclasses_inscricoes where id = p_id;
  if not found then raise exception 'Inscrição não encontrada'; end if;
  if exists (select 1 from interclasses_configuracoes c
      where c.edicao = r.edicao and (c.inscricoes_desativadas or now() > c.inscricoes_fim)) then
    raise exception 'Inscrições encerradas';
  end if;
  if not exists (select 1 from interclasses_times_codigos
      where edicao = r.edicao and modalidade = r.modalidade and time_norm = r.t
        and codigo = upper(trim(p_codigo))) then
    raise exception 'Código inválido';
  end if;
end $$;

create or replace function interclasses_remover_aluno(p_codigo text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform interclasses_checar_edicao(p_codigo, p_id);
  delete from interclasses_inscricoes where id = p_id;
end $$;

-- O índice único uq_interclasses_time_camisa barra camisa repetida no time.
create or replace function interclasses_atualizar_camisa(p_codigo text, p_id uuid, p_camisa int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_camisa is null or p_camisa <= 0 then raise exception 'Camisa inválida'; end if;
  perform interclasses_checar_edicao(p_codigo, p_id);
  update interclasses_inscricoes set numero_camisa = p_camisa where id = p_id;
end $$;

revoke all on function interclasses_checar_edicao(text, uuid) from public, anon, authenticated;
revoke all on function interclasses_gerar_codigo(text, text, text) from public;
revoke all on function interclasses_validar_codigo(text, text, text, text) from public;
revoke all on function interclasses_remover_aluno(text, uuid) from public;
revoke all on function interclasses_atualizar_camisa(text, uuid, int) from public;
grant execute on function interclasses_gerar_codigo(text, text, text) to anon, authenticated;
grant execute on function interclasses_validar_codigo(text, text, text, text) to anon, authenticated;
grant execute on function interclasses_remover_aluno(text, uuid) to anon, authenticated;
grant execute on function interclasses_atualizar_camisa(text, uuid, int) to anon, authenticated;
