-- ============================================================================
-- Interclasses IOP — leitura pública de campeonatos/jogos (resultados)
-- Rode DEPOIS de interclasses_campeonatos.sql, no SQL Editor do Supabase.
--
-- A nova página pública /interclasses/resultados só lê (nunca escreve) — o
-- "anon" ganha exclusivamente SELECT aqui. Criar/editar campeonato e lançar
-- placar continuam exigindo login (policy "..._all", já existente).
-- ============================================================================

drop policy if exists interclasses_campeonatos_publico_select on interclasses_campeonatos;
create policy interclasses_campeonatos_publico_select on interclasses_campeonatos
  for select to anon
  using (true);

drop policy if exists interclasses_jogos_publico_select on interclasses_jogos;
create policy interclasses_jogos_publico_select on interclasses_jogos
  for select to anon
  using (true);
