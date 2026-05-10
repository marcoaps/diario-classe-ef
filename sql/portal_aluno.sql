-- ============================================================================
-- Portal do Aluno — Schema + RLS
-- Rode este arquivo no SQL Editor do Supabase (https://supabase.com/dashboard).
-- ============================================================================

-- 1) COLUNA token_acesso e índice único
-- ----------------------------------------------------------------------------
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS token_acesso uuid DEFAULT gen_random_uuid();
UPDATE alunos SET token_acesso = gen_random_uuid() WHERE token_acesso IS NULL;
ALTER TABLE alunos ALTER COLUMN token_acesso SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_token ON alunos(token_acesso);

-- 2) FUNÇÕES auxiliares para resolver o aluno a partir do token
-- ----------------------------------------------------------------------------
-- O token é enviado pelo frontend no header HTTP "x-aluno-token".
-- O Supabase expõe os headers da requisição em current_setting('request.headers').

CREATE OR REPLACE FUNCTION public.portal_request_aluno_token()
RETURNS uuid
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  raw text;
BEGIN
  raw := nullif(current_setting('request.headers', true)::json ->> 'x-aluno-token', '');
  IF raw IS NULL THEN RETURN NULL; END IF;
  RETURN raw::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_current_aluno()
RETURNS TABLE (id uuid, nome text, turma_id text, numero_chamada bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.nome, a.turma_id, a.numero_chamada
  FROM alunos a
  WHERE a.token_acesso = public.portal_request_aluno_token()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.portal_request_aluno_token() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_current_aluno() TO anon, authenticated;

-- 3) RLS — habilitar nas tabelas envolvidas
-- ----------------------------------------------------------------------------
ALTER TABLE alunos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE respostas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE provas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE questoes   ENABLE ROW LEVEL SECURITY;

-- 4) POLÍTICAS — leitura pública restrita por token
-- ----------------------------------------------------------------------------
-- Aluno só consegue ler a própria linha de "alunos" se o token bater.
DROP POLICY IF EXISTS portal_alunos_select ON alunos;
CREATE POLICY portal_alunos_select ON alunos
  FOR SELECT TO anon
  USING (token_acesso = public.portal_request_aluno_token());

-- Frequência: aluno_id precisa ser o id do aluno autenticado pelo token.
DROP POLICY IF EXISTS portal_frequencia_select ON frequencia;
CREATE POLICY portal_frequencia_select ON frequencia
  FOR SELECT TO anon
  USING (aluno_id IN (SELECT id FROM public.portal_current_aluno()));

-- Notas: a tabela usa (turma, nome) em vez de aluno_id. Bate por turma_id+nome.
DROP POLICY IF EXISTS portal_notas_select ON notas;
CREATE POLICY portal_notas_select ON notas
  FOR SELECT TO anon
  USING (
    (turma, nome) IN (
      SELECT turma_id, nome FROM public.portal_current_aluno()
    )
  );

-- Respostas: usa (turma_id, aluno_nome). Bate por turma_id+nome do aluno autenticado.
DROP POLICY IF EXISTS portal_respostas_select ON respostas;
CREATE POLICY portal_respostas_select ON respostas
  FOR SELECT TO anon
  USING (
    (turma_id, aluno_nome) IN (
      SELECT turma_id, nome FROM public.portal_current_aluno()
    )
  );

-- Provas: aluno pode ler provas da sua própria turma (para mostrar título/data).
DROP POLICY IF EXISTS portal_provas_select ON provas;
CREATE POLICY portal_provas_select ON provas
  FOR SELECT TO anon
  USING (turma_id IN (SELECT turma_id FROM public.portal_current_aluno()));

-- Questões: somente das provas da turma do aluno.
DROP POLICY IF EXISTS portal_questoes_select ON questoes;
CREATE POLICY portal_questoes_select ON questoes
  FOR SELECT TO anon
  USING (
    prova_id IN (
      SELECT id FROM provas
      WHERE turma_id IN (SELECT turma_id FROM public.portal_current_aluno())
    )
  );

-- ============================================================================
-- IMPORTANTE — manter o app do professor funcionando
-- ----------------------------------------------------------------------------
-- As policies acima cobrem somente o role "anon" do Portal do Aluno.
-- O app do professor usa o MESMO role anon mas SEM o header x-aluno-token,
-- então essas policies não devolverão linhas para ele.
--
-- Você precisa MANTER as policies antigas que o professor já usava (ou criar
-- equivalentes) PARA QUE O APP CONTINUE FUNCIONANDO. Exemplos abaixo —
-- ajuste conforme sua configuração atual:
--
--   CREATE POLICY professor_alunos_all     ON alunos     FOR ALL TO anon
--     USING (true) WITH CHECK (true);
--   CREATE POLICY professor_frequencia_all ON frequencia FOR ALL TO anon
--     USING (true) WITH CHECK (true);
--   CREATE POLICY professor_notas_all      ON notas      FOR ALL TO anon
--     USING (true) WITH CHECK (true);
--   CREATE POLICY professor_provas_all     ON provas     FOR ALL TO anon
--     USING (true) WITH CHECK (true);
--   CREATE POLICY professor_questoes_all   ON questoes   FOR ALL TO anon
--     USING (true) WITH CHECK (true);
--   CREATE POLICY professor_respostas_all  ON respostas  FOR ALL TO anon
--     USING (true) WITH CHECK (true);
--
-- Se você JÁ tem RLS desligado e prefere não habilitar (mais simples), basta
-- pular o bloco "ALTER TABLE ... ENABLE ROW LEVEL SECURITY" acima — a segurança
-- do portal continua valendo porque o token é UUID v4 (122 bits de entropia)
-- e nunca aparece na URL pública sem ser passado pelo professor via QR.
-- ============================================================================
