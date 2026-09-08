-- ============================================================================
-- Times de Futsal — tabela de histórico de escalações
-- Rode este arquivo no SQL Editor do Supabase (https://supabase.com/dashboard).
-- ============================================================================

create table if not exists futsal_escalacoes (
  id uuid primary key default gen_random_uuid(),
  turma_id text not null,
  data date not null default current_date,
  time_numero int not null,
  time_nome text not null,
  aluno_id uuid not null references alunos(id) on delete cascade,
  aluno_nome text not null,
  posicao text not null check (posicao in ('goleiro', 'linha')),
  criado_em timestamptz not null default now()
);

create index if not exists idx_futsal_turma_data on futsal_escalacoes(turma_id, data);

alter table futsal_escalacoes enable row level security;

drop policy if exists futsal_escalacoes_all on futsal_escalacoes;
create policy futsal_escalacoes_all on futsal_escalacoes
  for all to authenticated
  using (true)
  with check (true);
