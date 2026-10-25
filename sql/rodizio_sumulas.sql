-- Súmula virtual do Rodízio de Futsal: mesmo conceito da súmula do Interclasses
-- (sql/interclasses_sumulas.sql), mas o jogo do Rodízio só vira uma linha de
-- "rodizio_jogos" DEPOIS de encerrado — não dá pra referenciar um jogo que
-- ainda não existe. Por isso a chave aqui é o id local do jogo em andamento
-- (sessão + número do próximo jogo), e o vínculo com a sessão é o que garante
-- a limpeza em cascata. Cole no SQL Editor do Supabase.
-- Sem esta tabela a súmula continua funcionando, só fica guardada no aparelho.

create table if not exists rodizio_sumulas (
  jogo_local_id text primary key,
  sessao_id uuid not null references rodizio_sessoes(id) on delete cascade,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);

create index if not exists rodizio_sumulas_sessao_id_idx on rodizio_sumulas(sessao_id);

alter table rodizio_sumulas enable row level security;

drop policy if exists rodizio_sumulas_all on rodizio_sumulas;
create policy rodizio_sumulas_all on rodizio_sumulas
  for all to authenticated using (true) with check (true);

-- Leitura pública (anon) NÃO é liberada: a súmula é só do professor logado.
