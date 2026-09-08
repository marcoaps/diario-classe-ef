-- ============================================================
-- MÓDULO: Exercícios de Fixação (conteúdo livre, poucas questões
-- abertas, sem gabarito/pontuação formal — diferente de "avaliacoes")
-- Diário de Classe EF — E.E. Instituto Odilon Pratagi
-- Tabela nova: exercicios_fixacao
-- NÃO altera nenhuma tabela existente (alunos, avaliacoes, notas, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS exercicios_fixacao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  titulo      text NOT NULL,
  conteudo    text,                 -- tema/assunto livre (ex: "Handebol — fundamentos")
  turma_id    text NOT NULL,        -- mesmo código normalizado usado em alunos.turma_id (ex: "6F")
  questoes    jsonb NOT NULL,       -- array de strings, um enunciado por questão

  criado_em   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE exercicios_fixacao IS 'Exercícios de fixação de conteúdo livre (poucas questões abertas, sem gabarito) — cabeçalho preenchido por aluno na tela "Formatar"';
COMMENT ON COLUMN exercicios_fixacao.turma_id IS 'Código normalizado da turma (mesmo padrão de alunos.turma_id, ex: 6F)';

CREATE INDEX IF NOT EXISTS idx_exercicios_fixacao_turma ON exercicios_fixacao (turma_id);

ALTER TABLE exercicios_fixacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_exercicios_fixacao" ON exercicios_fixacao;
CREATE POLICY "auth_all_exercicios_fixacao"
  ON exercicios_fixacao FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- FIM — tabela nova, nenhuma tabela existente foi alterada.
