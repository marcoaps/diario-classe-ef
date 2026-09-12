-- ============================================================
-- A Prova Online nunca mostrava o "Texto de Apoio" da avaliação pro
-- aluno -- a tabela `provas` não tinha essa coluna, então o texto
-- ficava só na avaliação de origem e nunca era copiado ao publicar.
--
-- Aditivo e seguro: não mexe em nenhuma linha existente.
-- ============================================================

ALTER TABLE provas ADD COLUMN IF NOT EXISTS texto_apoio text;

COMMENT ON COLUMN provas.texto_apoio IS 'Texto de apoio (leitura) copiado de avaliacoes.texto_apoio no momento da publicação -- exibido pro aluno na tela da Prova Online.';

-- FIM.
