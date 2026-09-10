-- ============================================================================
-- Rodízio de Futsal — "Rei da Quadra" e futuros modos de rodízio
-- Rode este arquivo no SQL Editor do Supabase (https://supabase.com/dashboard).
-- ============================================================================

create table if not exists rodizio_sessoes (
  id uuid primary key default gen_random_uuid(),
  turma_id text not null,
  modalidade text not null default 'Futsal',
  modo text not null default 'rei_da_quadra'
    check (modo in ('rei_da_quadra', 'fila_continua', 'ordem_fixa', 'rodizio_equilibrado')),
  limite_permanencia int,
  data date not null default current_date,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'finalizada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_rodizio_sessoes_turma_data on rodizio_sessoes(turma_id, data);
create index if not exists idx_rodizio_sessoes_status on rodizio_sessoes(status);

create table if not exists rodizio_times (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references rodizio_sessoes(id) on delete cascade,
  nome text not null,
  capitao_aluno_id uuid references alunos(id) on delete set null,
  capitao_nome text not null,
  ordem_inicial int not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_rodizio_times_sessao on rodizio_times(sessao_id);

create table if not exists rodizio_times_jogadores (
  id uuid primary key default gen_random_uuid(),
  time_id uuid not null references rodizio_times(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  aluno_nome text not null,
  criado_em timestamptz not null default now(),
  unique (time_id, aluno_id)
);

create index if not exists idx_rodizio_jogadores_time on rodizio_times_jogadores(time_id);

-- Log de partidas, append-only: a fila atual do rodízio é sempre reconstruída
-- a partir de "fila_apos" do jogo de maior número (ou da ordem_inicial dos
-- times se ainda não houve nenhum jogo) — nunca precisa de update, então
-- reabrir a página no meio da aula sempre retoma do estado certo.
create table if not exists rodizio_jogos (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references rodizio_sessoes(id) on delete cascade,
  numero int not null,
  equipe_a_id uuid not null references rodizio_times(id),
  equipe_b_id uuid not null references rodizio_times(id),
  vencedor_id uuid not null references rodizio_times(id),
  fila_apos uuid[] not null,
  criado_em timestamptz not null default now(),
  unique (sessao_id, numero)
);

create index if not exists idx_rodizio_jogos_sessao on rodizio_jogos(sessao_id, numero);

alter table rodizio_sessoes enable row level security;
alter table rodizio_times enable row level security;
alter table rodizio_times_jogadores enable row level security;
alter table rodizio_jogos enable row level security;

drop policy if exists rodizio_sessoes_all on rodizio_sessoes;
create policy rodizio_sessoes_all on rodizio_sessoes
  for all to authenticated using (true) with check (true);

drop policy if exists rodizio_times_all on rodizio_times;
create policy rodizio_times_all on rodizio_times
  for all to authenticated using (true) with check (true);

drop policy if exists rodizio_times_jogadores_all on rodizio_times_jogadores;
create policy rodizio_times_jogadores_all on rodizio_times_jogadores
  for all to authenticated using (true) with check (true);

drop policy if exists rodizio_jogos_all on rodizio_jogos;
create policy rodizio_jogos_all on rodizio_jogos
  for all to authenticated using (true) with check (true);

-- Mesmo padrão de trigger de sql/trabalhos_setup.sql, reaproveitado aqui só
-- para rodizio_sessoes (as outras tabelas são insert-only, sem update).
create or replace function atualizar_timestamp_rodizio_sessoes()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_atualizar_timestamp_rodizio_sessoes on rodizio_sessoes;
create trigger trg_atualizar_timestamp_rodizio_sessoes
  before update on rodizio_sessoes
  for each row execute function atualizar_timestamp_rodizio_sessoes();
