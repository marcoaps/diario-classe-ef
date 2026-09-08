-- ============================================================
-- MIGRAÇÃO: Imagem única da tira completa no Gerador de Charges
-- Diário de Classe EF — E.E. Instituto Odilon Pratagi
-- Adiciona 1 coluna nova em charges_didaticas (já existente)
-- NÃO altera nenhuma outra tabela nem remove dados
-- ============================================================

ALTER TABLE charges_didaticas
  ADD COLUMN IF NOT EXISTS imagem_unica jsonb;

COMMENT ON COLUMN charges_didaticas.imagem_unica IS 'Imagem única (base64) da tira completa com todos os quadros combinados, quando o professor gera assim em vez de uma imagem por quadro — ImagemUnica: {dataUrl, larguraOriginal, alturaOriginal}. Tem prioridade sobre imagens_quadros na exportação.';

-- FIM — só adiciona uma coluna nova, nenhum dado existente é alterado.
