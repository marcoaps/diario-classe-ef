-- ============================================================================
-- Prova Online restrita a alunos autorizados (lista "Alunos para a Prova")
-- Rode no SQL Editor do Supabase. É aditivo: não apaga nem altera dados.
--
-- Como funciona:
--  * provas.restringir_alunos = true  -> só entra quem está em prova_alunos_autorizados
--  * O professor libera pela tela "Alunos para a Prova" (botão "Liberar na prova online")
--  * O banco RECUSA respostas de quem não está na lista (mesmo por fora da página)
-- ============================================================================

alter table provas add column if not exists restringir_alunos boolean not null default false;

create table if not exists prova_alunos_autorizados (
  id uuid primary key default gen_random_uuid(),
  prova_id uuid not null references provas(id) on delete cascade,
  turma_id text not null,
  aluno_id uuid,
  numero_chamada integer not null,
  nome text not null,
  criado_em timestamptz not null default now(),
  unique (prova_id, turma_id, numero_chamada)
);

alter table prova_alunos_autorizados enable row level security;

-- Professor logado: tudo. Aluno (sem login): só consegue LER a lista (para escolher o nome).
drop policy if exists prova_alunos_autorizados_prof on prova_alunos_autorizados;
create policy prova_alunos_autorizados_prof on prova_alunos_autorizados
  for all to authenticated using (true) with check (true);

drop policy if exists prova_alunos_autorizados_anon_select on prova_alunos_autorizados;
create policy prova_alunos_autorizados_anon_select on prova_alunos_autorizados
  for select to anon using (true);

-- respostas: mantém o que o app já faz (aluno lê e insere; professor tudo)...
alter table respostas enable row level security;

drop policy if exists respostas_anon_select on respostas;
create policy respostas_anon_select on respostas for select to anon using (true);

drop policy if exists respostas_anon_insert on respostas;
create policy respostas_anon_insert on respostas for insert to anon with check (true);

drop policy if exists respostas_prof on respostas;
create policy respostas_prof on respostas for all to authenticated using (true) with check (true);

-- ...e ACRESCENTA a trava (policy RESTRICTIVE = vale junto com as demais):
-- se a prova é restrita, a resposta só é aceita quando turma + nº de chamada + nome
-- batem com um aluno da lista autorizada.
drop policy if exists respostas_somente_autorizados on respostas;
create policy respostas_somente_autorizados on respostas
  as restrictive
  for insert to anon
  with check (
    not exists (select 1 from provas p where p.id = respostas.prova_id and p.restringir_alunos)
    or exists (
      select 1 from prova_alunos_autorizados a
      where a.prova_id = respostas.prova_id
        and a.turma_id = respostas.turma_id
        and a.numero_chamada = respostas.aluno_numero
        and a.nome = respostas.aluno_nome
    )
  );

-- FIM.
