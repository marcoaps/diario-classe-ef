-- ============================================================
-- MÓDULO: Corretor de Provas com QR Code
-- Diário de Classe EF — E.E. Instituto Odilon Pratagi
--
-- Este script é 100% ADITIVO e seguro para rodar em produção:
--   - `avaliacoes` e `avaliacoes_respostas` JÁ EXISTEM (criadas manualmente
--     no passado, sem migração versionada) — aqui usamos CREATE TABLE IF
--     NOT EXISTS (não-op nelas) só para documentar o schema real, e ALTER
--     TABLE ... ADD COLUMN IF NOT EXISTS para acrescentar os campos novos
--     sem tocar em nenhuma linha existente.
--   - `folhas_respostas` e `avaliacoes_respostas_ajustes` são tabelas novas.
--   - Nenhum DROP, nenhum RENAME, nenhuma alteração de tipo em coluna
--     existente.
--
-- Modelo de acesso: professor único (confirmado com o usuário) — mesma
-- política simples usada em todo o resto do app (banco_questoes, trabalhos,
-- charges_didaticas etc.): qualquer usuário autenticado tem acesso total.
-- ============================================================

-- ------------------------------------------------------------
-- TABELA: avaliacoes (reconstrução do schema real, já em produção)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS avaliacoes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo               text NOT NULL,
  descricao            text,
  turma_id             text NOT NULL,
  num_questoes         integer NOT NULL DEFAULT 0,
  gabarito             jsonb NOT NULL DEFAULT '{}'::jsonb,
  valor_questao        numeric NOT NULL DEFAULT 1.0,
  questoes_subjetivas  jsonb,
  texto_apoio          text,
  criado_em            timestamptz NOT NULL DEFAULT now()
);

-- Campos novos exigidos pelo Corretor de Provas (contagem dinâmica de
-- questões, disciplina/bimestre/data/professor, valores totais em vez de
-- só valor por questão, e as questões objetivas com enunciado completo —
-- antes o "gabarito" só guardava a letra correta, sem o texto da questão
-- nem das alternativas, então o PDF impresso não tinha como mostrar
-- questões reais e dependia de conteúdo fixo no código).
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS disciplina             text NOT NULL DEFAULT 'Educação Física';
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS bimestre               text;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS data_prova             date;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS professor              text;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS observacoes            text;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS quantidade_objetivas   integer NOT NULL DEFAULT 0;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS quantidade_discursivas integer NOT NULL DEFAULT 0;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS alternativas           text[] NOT NULL DEFAULT ARRAY['A','B','C','D'];
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS valor_total_objetivas  numeric NOT NULL DEFAULT 0;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS valor_total_discursivas numeric NOT NULL DEFAULT 0;
-- Questões objetivas completas: [{ numero, enunciado, alternativas: [{letra, texto}] }]
-- (o gabarito -- letra correta por número -- continua na coluna `gabarito` já existente)
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS questoes_objetivas     jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS layout_version         smallint NOT NULL DEFAULT 1;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS atualizado_em          timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN avaliacoes.questoes_objetivas IS 'Conteúdo completo das questões objetivas (enunciado + 4 alternativas cada) — substitui o antigo conteúdo fixo no código de AvaliacaoFolha.tsx';
COMMENT ON COLUMN avaliacoes.quantidade_objetivas IS 'Fonte da verdade para a quantidade de questões objetivas — NÃO é mais uma constante fixa no código (era NUM_OBJETIVAS = 8 hardcoded)';

-- ------------------------------------------------------------
-- TABELA: avaliacoes_respostas (reconstrução do schema real, já em produção)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS avaliacoes_respostas (
  avaliacao_id  uuid NOT NULL REFERENCES avaliacoes(id) ON DELETE CASCADE,
  aluno_id      uuid NOT NULL,
  respostas     jsonb NOT NULL DEFAULT '{}'::jsonb,
  acertos       integer,
  nota          numeric,
  escaneado_em  timestamptz,
  metodo_scan   text,
  PRIMARY KEY (avaliacao_id, aluno_id)
);

-- Campos novos exigidos pelo fluxo de correção completo (antes o código
-- calculava acertos/nota só em memória para exibir na tela e NUNCA
-- enviava esses valores no upsert — por isso ficavam sempre nulos/zero
-- no banco, mesmo com a folha corretamente respondida).
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS folha_id          uuid;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS erros             integer NOT NULL DEFAULT 0;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS brancas           integer NOT NULL DEFAULT 0;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS ambiguas          integer NOT NULL DEFAULT 0;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS nota_objetiva     numeric NOT NULL DEFAULT 0;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS nota_discursiva   numeric NOT NULL DEFAULT 0;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS nota_final        numeric NOT NULL DEFAULT 0;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS confianca         numeric;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS revisada          boolean NOT NULL DEFAULT false;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS identificacao_manual boolean NOT NULL DEFAULT false;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS arquivo_hash      text;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS imagem_url        text;
ALTER TABLE avaliacoes_respostas ADD COLUMN IF NOT EXISTS atualizado_em     timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN avaliacoes_respostas.arquivo_hash IS 'SHA-256 do arquivo enviado — usado junto com folha_id para impedir lançamento duplicado da mesma folha';
COMMENT ON COLUMN avaliacoes_respostas.nota_final IS 'nota_objetiva + nota_discursiva, nunca maior que valor_total_objetivas + valor_total_discursivas da avaliação';

-- ------------------------------------------------------------
-- TABELA NOVA: folhas_respostas
--   Uma linha por folha impressa (1 por aluno por avaliação), com o
--   token exclusivo que vai dentro do QR Code de cada folha.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folhas_respostas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES avaliacoes(id) ON DELETE CASCADE,
  aluno_id     uuid NOT NULL,
  turma_id     text NOT NULL,
  qr_token     uuid NOT NULL DEFAULT gen_random_uuid(),
  status       text NOT NULL DEFAULT 'gerada' CHECK (status IN ('gerada', 'impressa', 'corrigida')),
  criado_em    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (avaliacao_id, aluno_id),
  UNIQUE (qr_token)
);

COMMENT ON TABLE folhas_respostas IS 'Uma folha de resposta individual por aluno, com QR Code exclusivo (qr_token) — fonte da verdade para identificar prova+aluno+turma ao ler o QR na correção';

-- Postgres não aceita "ADD CONSTRAINT IF NOT EXISTS" (só colunas/índices
-- aceitam essa sintaxe) — por isso o check manual via pg_constraint aqui.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_avaliacoes_respostas_folha'
  ) THEN
    ALTER TABLE avaliacoes_respostas
      ADD CONSTRAINT fk_avaliacoes_respostas_folha
      FOREIGN KEY (folha_id) REFERENCES folhas_respostas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- TABELA NOVA: avaliacoes_respostas_ajustes
--   Histórico de toda alteração manual feita pelo professor numa resposta
--   já detectada (auditoria — nunca sobrescreve silenciosamente).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS avaliacoes_respostas_ajustes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id      uuid NOT NULL REFERENCES avaliacoes(id) ON DELETE CASCADE,
  aluno_id          uuid NOT NULL,
  questao           text NOT NULL,
  resposta_anterior text,
  resposta_nova     text,
  criado_em         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE avaliacoes_respostas_ajustes IS 'Auditoria de correções manuais feitas pelo professor sobre as respostas detectadas automaticamente';

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_avaliacoes_turma               ON avaliacoes (turma_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_respostas_avaliacao ON avaliacoes_respostas (avaliacao_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_respostas_hash      ON avaliacoes_respostas (arquivo_hash);
CREATE INDEX IF NOT EXISTS idx_folhas_respostas_avaliacao     ON folhas_respostas (avaliacao_id);
CREATE INDEX IF NOT EXISTS idx_folhas_respostas_token         ON folhas_respostas (qr_token);
CREATE INDEX IF NOT EXISTS idx_ajustes_avaliacao_aluno        ON avaliacoes_respostas_ajustes (avaliacao_id, aluno_id);

-- ------------------------------------------------------------
-- Trigger: mantém atualizado_em em dia
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION atualizar_timestamp_corretor_provas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_avaliacoes ON avaliacoes;
CREATE TRIGGER trg_atualizar_avaliacoes
  BEFORE UPDATE ON avaliacoes
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_corretor_provas();

DROP TRIGGER IF EXISTS trg_atualizar_avaliacoes_respostas ON avaliacoes_respostas;
CREATE TRIGGER trg_atualizar_avaliacoes_respostas
  BEFORE UPDATE ON avaliacoes_respostas
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_corretor_provas();

-- ------------------------------------------------------------
-- RLS — mesmo padrão do resto do app: usuário autenticado tem acesso
-- total (professor único). Antes deste script, avaliacoes/
-- avaliacoes_respostas NÃO tinham RLS habilitada (exposição real, já
-- que a chave anon do Supabase é pública no bundle do front-end).
-- ------------------------------------------------------------
ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_avaliacoes" ON avaliacoes;
CREATE POLICY "auth_all_avaliacoes" ON avaliacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE avaliacoes_respostas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_avaliacoes_respostas" ON avaliacoes_respostas;
CREATE POLICY "auth_all_avaliacoes_respostas" ON avaliacoes_respostas FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE folhas_respostas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_folhas_respostas" ON folhas_respostas;
CREATE POLICY "auth_all_folhas_respostas" ON folhas_respostas FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE avaliacoes_respostas_ajustes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_avaliacoes_respostas_ajustes" ON avaliacoes_respostas_ajustes;
CREATE POLICY "auth_all_avaliacoes_respostas_ajustes" ON avaliacoes_respostas_ajustes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FIM.
-- IMPORTANTE: depois de rodar este script, a página estática
-- public/upload-folha.html (que grava avaliacoes_respostas usando a
-- service role key, contornando RLS) e a rota api/salvar-resposta.ts
-- continuam funcionando (usam a service key, que ignora RLS por
-- desenho), mas deixaram de ser o caminho principal de correção — o
-- botão "Corrigir" no app agora abre a tela React corrigida.
