-- ============================================================================
-- Interclasses IOP — colunas de roteamento do Mata-Mata Duplo
-- Rode no SQL Editor do Supabase.
--
-- O motor de Mata-Mata Duplo (genDoubleElim/aplicarResultadoDuplo, em
-- src/domain/interclassesCampeonato.ts) precisa saber, pra cada jogo, pra
-- onde mandar o VENCEDOR (chave de vencedores) e o PERDEDOR (chave de
-- perdedores) — isso nunca tinha colunas próprias na tabela, então era
-- perdido ao salvar/recarregar os jogos, travando o campeonato depois do
-- primeiro placar lançado.
-- ============================================================================

alter table interclasses_jogos add column if not exists chave text
  check (chave in ('W', 'L', 'GF'));
alter table interclasses_jogos add column if not exists destino_vencedor jsonb;
alter table interclasses_jogos add column if not exists destino_perdedor jsonb;
alter table interclasses_jogos add column if not exists lado_ausente_fixo text
  check (lado_ausente_fixo in ('A', 'B'));
