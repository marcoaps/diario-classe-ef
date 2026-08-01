-- ============================================================
-- MÓDULO: Banco de Questões (Gerador Inteligente de Questões IA)
-- Diário de Classe EF — E.E. Instituto Odilon Pratagi
-- Tabela nova: banco_questoes
-- NÃO altera nenhuma tabela existente (avaliacoes, avaliacoes_respostas, etc.)
-- ============================================================

-- ------------------------------------------------------------
-- TABELA: banco_questoes
--   Armazena cada questão gerada pelo Gerador de Questões IA, de forma
--   reutilizável e desacoplada de uma avaliação específica, permitindo
--   filtrar/editar/duplicar/pesquisar independentemente de qual prova
--   ela foi usada (ou se ainda não foi usada em nenhuma).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banco_questoes (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parâmetros de geração / classificação curricular
  componente_curricular       text NOT NULL,
  ano_escolar                 smallint NOT NULL CHECK (ano_escolar BETWEEN 6 AND 9),
  bimestre                    text,           -- '1'..'4' — usado junto com ano_escolar para localizar o Plano de Curso oficial
  objeto_conhecimento         text,
  habilidade_bncc             text,
  conteudo                    text NOT NULL,
  dificuldade                 text NOT NULL CHECK (dificuldade IN ('muito_facil','facil','medio','dificil','misto')),
  tipo_questao                text NOT NULL CHECK (tipo_questao IN ('multipla_escolha','verdadeiro_falso','associacao','completar','resposta_curta','dissertativa')),
  contextualizacao            text,
  estilo                      text,

  -- Conteúdo da questão
  titulo_interno              text,
  objetivo_questao            text,
  contexto_suporte            text,
  imagem_query                text,           -- palavra-chave (em inglês) usada para buscar a foto no Pexels
  imagem_url                  text,           -- URL da foto encontrada no Pexels, se houver
  enunciado                   text NOT NULL,
  alternativas                jsonb,          -- [{letra,texto,correta,comentarioDistrator}] ou null (dissertativa/resposta_curta)
  resposta_correta            text,           -- usado quando "alternativas" é null, ou para registrar gabarito de V/F, associação, completar
  justificativa_pedagogica    text,

  -- Conformidade e revisão (ver regrasElaboracaoItens.ts / revisaoAutomaticaQuestoes.ts)
  conforme_referencia_oficial boolean NOT NULL DEFAULT true,   -- false para verdadeiro_falso, associacao, completar (fora do escopo do PDF SEE/AC)
  status_revisao              text NOT NULL DEFAULT 'aprovada' CHECK (status_revisao IN ('aprovada','requer_revisao_manual','rascunho')),
  tentativas_revisao          smallint DEFAULT 0,
  historico_revisao           jsonb,          -- [{tentativa, motivosFalha[], timestamp}]

  -- Rastreabilidade da geração por IA
  metadata_geracao            jsonb,          -- {modelo, geradoEm, ...}

  criado_em                   timestamptz DEFAULT now(),
  atualizado_em                timestamptz DEFAULT now(),

  -- Busca por palavra-chave (título, enunciado, conteúdo, habilidade)
  busca                       tsvector GENERATED ALWAYS AS (
                                 to_tsvector('portuguese',
                                   coalesce(titulo_interno, '') || ' ' ||
                                   coalesce(enunciado, '') || ' ' ||
                                   coalesce(conteudo, '') || ' ' ||
                                   coalesce(habilidade_bncc, ''))
                               ) STORED
);

COMMENT ON TABLE banco_questoes IS 'Banco reutilizável de questões geradas pelo Gerador Inteligente de Questões IA, desacoplado de avaliações específicas';
COMMENT ON COLUMN banco_questoes.conforme_referencia_oficial IS 'false para tipos fora do escopo do guia SEE/AC (verdadeiro_falso, associacao, completar) — ver POLITICA_TIPOS_QUESTAO em regrasElaboracaoItens.ts';
COMMENT ON COLUMN banco_questoes.status_revisao IS 'aprovada = passou no validador determinístico e na autorrevisão da IA; requer_revisao_manual = esgotou tentativas de regeneração automática; rascunho = ainda não revisada';

-- ------------------------------------------------------------
-- Índices para os filtros previstos (série, componente, habilidade,
-- conteúdo, dificuldade, palavra-chave)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_banco_questoes_ano_componente  ON banco_questoes (ano_escolar, componente_curricular);
CREATE INDEX IF NOT EXISTS idx_banco_questoes_habilidade      ON banco_questoes (habilidade_bncc);
CREATE INDEX IF NOT EXISTS idx_banco_questoes_dificuldade     ON banco_questoes (dificuldade);
CREATE INDEX IF NOT EXISTS idx_banco_questoes_conteudo        ON banco_questoes (conteudo);
CREATE INDEX IF NOT EXISTS idx_banco_questoes_status_revisao  ON banco_questoes (status_revisao);
CREATE INDEX IF NOT EXISTS idx_banco_questoes_alternativas_gin ON banco_questoes USING gin (alternativas jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_banco_questoes_busca_gin       ON banco_questoes USING gin (busca);

-- ------------------------------------------------------------
-- Trigger: mantém atualizado_em em dia a cada UPDATE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION atualizar_timestamp_banco_questoes()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_banco_questoes ON banco_questoes;
CREATE TRIGGER trg_atualizar_banco_questoes
  BEFORE UPDATE ON banco_questoes
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_banco_questoes();

-- ------------------------------------------------------------
-- RLS — mesmo padrão de avaliacoes_setup.sql: usuários autenticados
-- (professores logados no app) têm acesso total.
-- ------------------------------------------------------------
ALTER TABLE banco_questoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_banco_questoes" ON banco_questoes;
CREATE POLICY "auth_all_banco_questoes"
  ON banco_questoes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- FIM — tabela nova, nenhuma tabela existente foi alterada.
