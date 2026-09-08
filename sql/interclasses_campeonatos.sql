-- ============================================================================
-- Interclasses IOP — persistência de campeonatos/jogos (motor de competição)
-- Rode DEPOIS de interclasses_modalidade_migration.sql, no SQL Editor do Supabase.
--
-- Antes disso, chaves/grupos/placares só existiam na memória do navegador
-- (tela Torneio.tsx antiga) — recarregar a página perdia tudo. Estas tabelas
-- dão persistência de verdade, já isoladas por modalidade + categoria.
-- ============================================================================

create table if not exists interclasses_campeonatos (
  id uuid primary key default gen_random_uuid(),
  edicao text not null default '2026',
  modalidade text not null check (modalidade in ('futsal', 'voleibol', 'handebol', 'queimada')),
  categoria text not null,
  formato text not null,                        -- round_robin | single_elim | groups_ko | league_playoffs | swiss | double_elim
  fase text not null default 'setup',
  swiss_round int not null default 1,
  playoffs_n int,
  config jsonb not null default '{}'::jsonb,     -- regras de pontuação / critérios de desempate (defaults fixos por ora)
  campeao text,
  vice text,
  terceiro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (edicao, modalidade, categoria)
);

create table if not exists interclasses_jogos (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references interclasses_campeonatos(id) on delete cascade,
  equipe_a text not null,                        -- nome_time (mesmo nome usado em interclasses_inscricoes)
  equipe_b text,                                 -- null só em bye
  grupo_nome text,
  fase text not null,                            -- 'league' | 'group' | 'swiss' | 'Rodada 1' | 'Semifinal' | 'Final' ...
  rodada int not null default 0,
  bracket_idx int,
  is_bye boolean not null default false,
  jogado boolean not null default false,
  vencedor text,
  resultado jsonb,                               -- {golsA,golsB} | {setsA,setsB} | {vencedor:'A'|'B'}
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_interclasses_campeonatos_modalidade on interclasses_campeonatos(edicao, modalidade, categoria);
create index if not exists idx_interclasses_jogos_campeonato on interclasses_jogos(campeonato_id);

alter table interclasses_campeonatos enable row level security;
alter table interclasses_jogos       enable row level security;

drop policy if exists interclasses_campeonatos_all on interclasses_campeonatos;
create policy interclasses_campeonatos_all on interclasses_campeonatos for all to authenticated using (true) with check (true);

drop policy if exists interclasses_jogos_all on interclasses_jogos;
create policy interclasses_jogos_all on interclasses_jogos for all to authenticated using (true) with check (true);
