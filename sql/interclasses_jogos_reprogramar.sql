-- ============================================================================
-- Interclasses IOP — jogo reprogramado no Cronograma (dia e hora próprios)
-- Rode este arquivo no SQL Editor do Supabase (https://supabase.com/dashboard).
-- Formato do valor: 'DD/MM HH:MM' (ex.: '21/10 13:30'); NULL = horário da fila.
-- ============================================================================

alter table interclasses_jogos add column if not exists reprogramado text;
