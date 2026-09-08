-- ============================================================
-- MÓDULO: Correção 100% anônima por grupo (Corretor de Provas)
-- Diário de Classe EF — E.E. Instituto Odilon Pratagi
--
-- Substitui o "código compartilhado por turma" (que ainda pedia pro
-- professor tocar no nome do aluno numa lista) por um QR verdadeiramente
-- anônimo: o QR vira só o texto puro da turma/grupo (ex: "GRUPO_6_7"), sem
-- JSON, sem assinatura, sem nenhuma referência a aluno. A correção salva um
-- código sequencial (ex: PROVA_2026_0001) e o vínculo com o aluno fica pra
-- uma etapa futura (associação manual).
--
-- Este script é ADITIVO e seguro para rodar em produção: não apaga nem
-- reaproveita nenhuma linha existente. As linhas antigas (com aluno_id
-- preenchido) continuam exatamente como estavam.
-- ============================================================

-- aluno_id deixa de ser obrigatório: uma prova anônima ainda não sabe quem é
-- o aluno no momento da correção.
ALTER TABLE avaliacoes_respostas ALTER COLUMN aluno_id DROP NOT NULL;

-- A PK antiga era (avaliacao_id, aluno_id) — não serve mais sozinha (não dá
-- pra ter duas linhas com aluno_id NULL). Troca por uma PK substituta (id) e
-- recria a unicidade antiga só para linhas COM aluno (upsert individual e
-- upsert por turma, ambos já em produção, continuam funcionando idênticos).
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE avaliacoes_respostas DROP CONSTRAINT IF EXISTS avaliacoes_respostas_pkey;
ALTER TABLE avaliacoes_respostas ADD CONSTRAINT avaliacoes_respostas_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_avaliacoes_respostas_aluno
  ON avaliacoes_respostas (avaliacao_id, aluno_id) WHERE aluno_id IS NOT NULL;

-- Código anônimo mostrado na tela de correção (ex: PROVA_2026_0001) e o
-- código do grupo lido do QR (ex: GRUPO_6_7) -- nenhum dos dois referencia
-- aluno nem turma real.
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS codigo_anonimo text;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS grupo_codigo   text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_avaliacoes_respostas_codigo_anonimo
  ON avaliacoes_respostas (avaliacao_id, codigo_anonimo) WHERE codigo_anonimo IS NOT NULL;

COMMENT ON COLUMN avaliacoes_respostas.codigo_anonimo IS 'Identificador sequencial de uma folha corrigida sem aluno vinculado (ex: PROVA_2026_0001) -- correção 100% anônima por grupo';
COMMENT ON COLUMN avaliacoes_respostas.grupo_codigo IS 'Código do grupo lido do QR anônimo (ex: GRUPO_6_7) -- não identifica aluno nem turma real do aluno';

-- FIM.
-- Depois de rodar este script: AvaliacaoFolha.tsx ganha a opção "QR 100%
-- anônimo" e AvaliacaoCorrigir.tsx passa a aceitar ler esse QR sem consultar
-- a tabela `alunos` — ver commit correspondente.
