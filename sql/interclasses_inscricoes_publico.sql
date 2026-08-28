-- ============================================================================
-- Interclasses IOP — acesso público pra alunos se inscreverem sozinhos
-- Rode este arquivo no SQL Editor do Supabase DEPOIS de interclasses_inscricoes.sql.
-- ============================================================================

-- Qualquer visitante (sem login) pode ver a lista e se inscrever.
drop policy if exists interclasses_inscricoes_publico_select on interclasses_inscricoes;
create policy interclasses_inscricoes_publico_select on interclasses_inscricoes
  for select to anon
  using (true);

drop policy if exists interclasses_inscricoes_publico_insert on interclasses_inscricoes;
create policy interclasses_inscricoes_publico_insert on interclasses_inscricoes
  for insert to anon
  with check (true);

-- Sem policy de UPDATE/DELETE pra "anon" de propósito — editar ou excluir uma
-- inscrição continua exigindo login de professor (policy
-- "interclasses_inscricoes_all", já criada em interclasses_inscricoes.sql).
