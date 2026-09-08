-- ============================================================================
-- Interclasses IOP — inscrição individual de alunos por equipe
-- Rode este arquivo no SQL Editor do Supabase (https://supabase.com/dashboard).
-- ============================================================================

create table if not exists interclasses_inscricoes (
  id uuid primary key default gen_random_uuid(),
  edicao text not null default '2026',
  aluno_id uuid references alunos(id) on delete set null,
  nome_completo text not null,
  turma_id text not null,
  numero_chamada int not null check (numero_chamada > 0),
  numero_camisa int not null check (numero_camisa > 0),
  nome_time text not null,

  -- Reservado para expansões futuras (modalidade esportiva, categoria,
  -- gênero da disputa, capitão de equipe, professor responsável — ver
  -- ponto 10 do pedido de implementação). Não usados pela UI ainda.
  modalidade text,
  categoria text,
  genero text,
  capitao boolean not null default false,
  professor_responsavel text,

  criado_em timestamptz not null default now()
);

create index if not exists idx_interclasses_edicao_turma on interclasses_inscricoes(edicao, turma_id);
create index if not exists idx_interclasses_edicao_time on interclasses_inscricoes(edicao, nome_time);

-- Evita inscrever o mesmo aluno do cadastro oficial duas vezes na mesma edição
-- (só se aplica quando o nome foi reconhecido automaticamente pela turma).
create unique index if not exists uq_interclasses_aluno_edicao
  on interclasses_inscricoes(edicao, aluno_id) where aluno_id is not null;

-- Evita dois alunos do mesmo time usando o mesmo número de camisa na mesma edição.
create unique index if not exists uq_interclasses_time_camisa
  on interclasses_inscricoes(edicao, lower(trim(nome_time)), numero_camisa);

alter table interclasses_inscricoes enable row level security;

drop policy if exists interclasses_inscricoes_all on interclasses_inscricoes;
create policy interclasses_inscricoes_all on interclasses_inscricoes
  for all to authenticated
  using (true)
  with check (true);
