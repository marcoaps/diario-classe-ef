-- ============================================================
-- MIGRAÇÃO: Upload de imagens por quadro no Gerador de Charges
-- Diário de Classe EF — E.E. Instituto Odilon Pratagi
-- Adiciona 1 coluna nova em charges_didaticas (já existente)
-- NÃO altera nenhuma outra tabela nem remove dados
-- ============================================================

ALTER TABLE charges_didaticas
  ADD COLUMN IF NOT EXISTS imagens_quadros jsonb;

COMMENT ON COLUMN charges_didaticas.imagens_quadros IS 'Imagens (base64, geradas externamente em ChatGPT Images/Leonardo/etc. e enviadas pelo professor) para cada quadro — ImagemQuadro[]: [{quadro, dataUrl, larguraOriginal, alturaOriginal}]';

-- FIM — só adiciona uma coluna nova, nenhum dado existente é alterado.
