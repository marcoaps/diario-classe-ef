-- ============================================================
-- MÓDULO v2: Corretor de Provas ANÔNIMO baseado em AVALIAÇÃO + QR Code
-- Diário de Classe EF — E.E. Instituto Odilon Pratagi
--
-- Reestruturação do corretor: o QR Code passa a identificar SOMENTE A
-- AVALIAÇÃO (nunca o aluno). O corretor deve funcionar mesmo sem nenhum
-- aluno cadastrado -- por isso toda a lógica de leitura do QR deixa de
-- consultar a tabela `alunos`.
--
-- Este script é ADITIVO e cobre tudo que os scripts anteriores
-- (corretor_provas_setup.sql, corretor_provas_anonimo.sql) já tinham feito,
-- de forma idempotente -- pode ser rodado mesmo que os anteriores nunca
-- tenham sido executados, ou rodado de novo sem problema.
-- ============================================================

-- ------------------------------------------------------------
-- avaliacoes: código curto e amigável que vai DENTRO DO QR CODE (ex:
-- "AV2026-0001") -- gerado sob demanda pelo app na primeira vez que a
-- folha-modelo é impressa, nunca o id (uuid) puro.
-- ------------------------------------------------------------
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS codigo_avaliacao text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_avaliacoes_codigo_avaliacao
  ON avaliacoes (codigo_avaliacao) WHERE codigo_avaliacao IS NOT NULL;

COMMENT ON COLUMN avaliacoes.codigo_avaliacao IS 'Código curto (ex: AV2026-0001) impresso e embutido no QR Code -- é isso, e SOMENTE isso, que o QR contém. Nunca identifica aluno.';

-- ------------------------------------------------------------
-- avaliacoes_respostas: repete (idempotente) o que corretor_provas_anonimo.sql
-- já fazia -- aluno_id opcional, PK substituta, código sequencial da
-- correção. Caso esse script já tenha rodado antes, os comandos abaixo são
-- no-op.
-- ------------------------------------------------------------
ALTER TABLE avaliacoes_respostas ALTER COLUMN aluno_id DROP NOT NULL;

ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE avaliacoes_respostas DROP CONSTRAINT IF EXISTS avaliacoes_respostas_pkey;
ALTER TABLE avaliacoes_respostas ADD CONSTRAINT avaliacoes_respostas_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_avaliacoes_respostas_aluno
  ON avaliacoes_respostas (avaliacao_id, aluno_id) WHERE aluno_id IS NOT NULL;

ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS codigo_anonimo text;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS grupo_codigo   text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_avaliacoes_respostas_codigo_anonimo
  ON avaliacoes_respostas (avaliacao_id, codigo_anonimo) WHERE codigo_anonimo IS NOT NULL;

COMMENT ON COLUMN avaliacoes_respostas.codigo_anonimo IS 'Identificador sequencial da correção (ex: COR-000037) -- toda correção nasce assim, sem aluno. Formato exibido ao professor: COR-NNNNNN.';
COMMENT ON COLUMN avaliacoes_respostas.grupo_codigo IS 'Snapshot do grupo/turma da avaliação (avaliacoes.turma_id) no momento da correção -- só pra exibir na lista de correções sem precisar de join. Não identifica aluno.';

-- ------------------------------------------------------------
-- avaliacoes_respostas_ajustes: idem -- o professor pode editar uma bolha na
-- tela de revisão de uma correção anônima (sem aluno), então o registro de
-- auditoria também precisa aceitar aluno_id NULL (senão o insert falha).
-- ------------------------------------------------------------
ALTER TABLE avaliacoes_respostas_ajustes ALTER COLUMN aluno_id DROP NOT NULL;

-- FIM.
-- Depois de rodar este script: AvaliacaoFolha.tsx passa a gerar uma
-- FOLHA-MODELO única por avaliação (QR = codigo_avaliacao, sem depender de
-- alunos cadastrados) e AvaliacaoCorrigir.tsx deixa de consultar `alunos`
-- durante a leitura do QR -- ver commit correspondente.
