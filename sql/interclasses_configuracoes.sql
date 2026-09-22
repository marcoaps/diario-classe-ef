-- ============================================================================
-- Interclasses IOP — configuração do período de inscrição (por edição)
-- Rode no SQL Editor do Supabase.
--
-- Antes as datas de início/fim das inscrições eram fixas no código
-- (INSCRICOES_INICIO/INSCRICOES_FIM em InscricaoAlunos.tsx) e só serviam de
-- aviso — não bloqueavam o formulário de verdade. Agora o professor edita
-- essas datas (e pode desativar manualmente) direto pela aba "Inscrição de
-- Alunos", sem precisar mexer no código, e o formulário passa a ser
-- desabilitado de verdade quando o prazo fecha (edição/exclusão continuam
-- liberadas pro professor).
-- ============================================================================

create table if not exists interclasses_configuracoes (
  edicao text primary key,
  inscricoes_inicio timestamptz not null,
  inscricoes_fim timestamptz not null,
  inscricoes_desativadas boolean not null default false,
  congresso_tecnico date,
  atualizado_em timestamptz not null default now()
);

alter table interclasses_configuracoes enable row level security;

-- Leitura pública (a tela de auto-inscrição do aluno, sem login, também
-- precisa saber se as inscrições estão abertas).
drop policy if exists interclasses_configuracoes_publico_select on interclasses_configuracoes;
create policy interclasses_configuracoes_publico_select on interclasses_configuracoes
  for select to anon
  using (true);

-- Só o professor logado edita o prazo.
drop policy if exists interclasses_configuracoes_all on interclasses_configuracoes;
create policy interclasses_configuracoes_all on interclasses_configuracoes
  for all to authenticated
  using (true) with check (true);

-- Linha inicial da edição 2026, com as mesmas datas que já estavam fixas no
-- código (Mini Projeto-Regulamento — Jogos Interclasses 2026).
insert into interclasses_configuracoes (edicao, inscricoes_inicio, inscricoes_fim, congresso_tecnico)
values ('2026', '2026-09-11T00:00:00-04:00', '2026-10-02T23:59:59-04:00', '2026-10-02')
on conflict (edicao) do nothing;
