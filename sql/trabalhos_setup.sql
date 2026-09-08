-- ============================================================
-- MÓDULO: Trabalhos (registro de entregas dos alunos)
-- Diário de Classe EF — E.E. Instituto Odilon Pratagi
-- Tabelas novas: trabalhos, trabalhos_registros
-- NÃO altera nenhuma tabela existente (alunos, frequencia, notas, etc.)
-- ============================================================

-- ------------------------------------------------------------
-- TABELA: trabalhos
--   Um trabalho/atividade cadastrado pelo professor para uma turma
--   em um bimestre. Substitui a ficha impressa preenchida à caneta.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trabalhos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  titulo        text NOT NULL,
  descricao     text,
  data          date,
  bimestre      smallint NOT NULL CHECK (bimestre BETWEEN 1 AND 4),
  valor         numeric(5,2),
  turma         text NOT NULL,           -- mesmo código normalizado usado em alunos.turma_id (ex: "7B")
  observacoes   text,

  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE trabalhos IS 'Trabalhos/atividades cadastrados pelo professor, um por turma+bimestre, para registro de entregas dos alunos';
COMMENT ON COLUMN trabalhos.turma IS 'Código normalizado da turma (mesmo padrão de alunos.turma_id, ex: 7B)';

CREATE INDEX IF NOT EXISTS idx_trabalhos_turma_bimestre ON trabalhos (turma, bimestre);
CREATE INDEX IF NOT EXISTS idx_trabalhos_data            ON trabalhos (data);

-- ------------------------------------------------------------
-- TABELA: trabalhos_registros
--   Situação de entrega de um aluno para um trabalho específico.
--   Relaciona por aluno_id (chave estrangeira) — não duplica nome/turma.
--   Ausência de linha = "Sem registro" (ainda não avaliado).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trabalhos_registros (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  trabalho_id   uuid NOT NULL REFERENCES trabalhos(id) ON DELETE CASCADE,
  aluno_id      uuid NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,

  situacao      text NOT NULL CHECK (situacao IN ('fez', 'nao_fez')),
  nota          numeric(4,2),
  observacao    text,

  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_trabalhos_registros_trabalho_aluno UNIQUE (trabalho_id, aluno_id)
);

COMMENT ON TABLE trabalhos_registros IS 'Situação de entrega (fez/não fez) de cada aluno por trabalho — chave única (trabalho_id, aluno_id) usada em upsert';

CREATE INDEX IF NOT EXISTS idx_trabalhos_registros_trabalho ON trabalhos_registros (trabalho_id);
CREATE INDEX IF NOT EXISTS idx_trabalhos_registros_aluno    ON trabalhos_registros (aluno_id);

-- ------------------------------------------------------------
-- Trigger: mantém atualizado_em em dia a cada UPDATE (compartilhado
-- pelas duas tabelas novas deste módulo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION atualizar_timestamp_trabalhos()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_trabalhos ON trabalhos;
CREATE TRIGGER trg_atualizar_trabalhos
  BEFORE UPDATE ON trabalhos
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_trabalhos();

DROP TRIGGER IF EXISTS trg_atualizar_trabalhos_registros ON trabalhos_registros;
CREATE TRIGGER trg_atualizar_trabalhos_registros
  BEFORE UPDATE ON trabalhos_registros
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_trabalhos();

-- ------------------------------------------------------------
-- RLS — mesmo padrão de banco_questoes_setup.sql: usuários autenticados
-- (professores logados no app) têm acesso total. Nenhuma política das
-- tabelas existentes (alunos, notas, frequencia) é alterada.
-- ------------------------------------------------------------
ALTER TABLE trabalhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabalhos_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_trabalhos" ON trabalhos;
CREATE POLICY "auth_all_trabalhos"
  ON trabalhos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_trabalhos_registros" ON trabalhos_registros;
CREATE POLICY "auth_all_trabalhos_registros"
  ON trabalhos_registros FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- FIM — tabelas novas, nenhuma tabela existente foi alterada.
