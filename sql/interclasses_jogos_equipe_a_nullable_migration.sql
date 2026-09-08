-- ============================================================================
-- interclasses_jogos.equipe_a precisa aceitar NULL
--
-- Formatos com mais de uma rodada de mata-mata (ex: Mata-Mata Duplo, ou
-- Mata-Mata simples com 3+ times) geram de uma vez os jogos das rodadas
-- futuras (semifinal, final...) antes de saber quem chega lá — os dois lados
-- ficam null até as rodadas anteriores serem decididas. A tabela original só
-- deixava equipe_b nulo (pra byes), mas equipe_a como "not null" quebra
-- exatamente esses jogos futuros ainda sem nenhum time definido.
-- Rode no SQL Editor do Supabase.
-- ============================================================================

alter table interclasses_jogos alter column equipe_a drop not null;
