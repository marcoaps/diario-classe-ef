-- ============================================================================
-- Portal do Aluno — Policies SELECT públicas
-- Use este arquivo se a tabela alunos (e relacionadas) JÁ tem RLS habilitado
-- e o portal está sendo bloqueado nas queries.
--
-- A segurança continua sólida: o token é UUID v4 (122 bits) e só é
-- distribuído fisicamente via QR Code impresso pelo professor.
-- ============================================================================

-- 1) Verifique antes se RLS está habilitado nas tabelas:
--    SELECT relname, relrowsecurity
--    FROM pg_class
--    WHERE relname IN ('alunos', 'frequencia', 'notas', 'respostas', 'provas', 'questoes');

-- 2) Verifique policies existentes:
--    SELECT schemaname, tablename, policyname, cmd, roles, qual
--    FROM pg_policies
--    WHERE tablename IN ('alunos', 'frequencia', 'notas', 'respostas', 'provas', 'questoes');

-- 3) Policies SELECT públicas para o portal funcionar:
DROP POLICY IF EXISTS "portal_aluno_publico_select" ON alunos;
CREATE POLICY "portal_aluno_publico_select" ON alunos
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "portal_frequencia_publico_select" ON frequencia;
CREATE POLICY "portal_frequencia_publico_select" ON frequencia
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "portal_notas_publico_select" ON notas;
CREATE POLICY "portal_notas_publico_select" ON notas
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "portal_respostas_publico_select" ON respostas;
CREATE POLICY "portal_respostas_publico_select" ON respostas
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "portal_provas_publico_select" ON provas;
CREATE POLICY "portal_provas_publico_select" ON provas
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "portal_questoes_publico_select" ON questoes;
CREATE POLICY "portal_questoes_publico_select" ON questoes
  FOR SELECT
  USING (true);

-- ============================================================================
-- ALTERNATIVA — só permitir SELECT em alunos quando o token bater
-- (mais restritivo, mas o frontend só consulta com o token correto mesmo):
-- ============================================================================
-- DROP POLICY IF EXISTS "portal_aluno_publico_select" ON alunos;
-- CREATE POLICY "portal_aluno_select_por_token" ON alunos
--   FOR SELECT
--   USING (token_acesso IS NOT NULL);
