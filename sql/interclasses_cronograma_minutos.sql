-- ============================================================================
-- Interclasses IOP — minutos por jogo do Cronograma (por edição)
-- Rode no SQL Editor do Supabase, DEPOIS de interclasses_configuracoes.sql.
--
-- O professor ajusta os "minutos por jogo" na aba Cronograma e a página
-- pública passa a mostrar os mesmos horários (antes o valor ficava só no
-- navegador do professor).
-- ============================================================================
alter table interclasses_configuracoes
  add column if not exists minutos_por_jogo integer not null default 28;
