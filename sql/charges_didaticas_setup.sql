-- ============================================================
-- MÓDULO: Gerador de Charges Didáticas
-- Diário de Classe EF — E.E. Instituto Odilon Pratagi
-- Tabelas novas: personagens_charges, charges_didaticas
-- NÃO altera nenhuma tabela existente (banco_questoes, avaliacoes, etc.)
-- ============================================================

-- ------------------------------------------------------------
-- TABELA: personagens_charges
--   Banco de personagens REUTILIZÁVEIS entre gerações, para manter a
--   consistência visual (mesmo uniforme/cabelo/aparência) de uma tira para
--   outra. Nunca é apagada de verdade (soft-archive via "ativo"), pois
--   personagens usados em atividades já geradas precisam continuar
--   resolvíveis a partir do histórico.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personagens_charges (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  nome                        text NOT NULL UNIQUE,
  idade                       smallint,
  sexo                        text,
  altura_aproximada           text,
  cor_pele                    text,
  tipo_cabelo                 text,
  cor_cabelo                  text,
  olhos                       text,
  uniforme                    text,
  expressoes_mais_utilizadas  text[] NOT NULL DEFAULT '{}',
  poses_comuns                text[] NOT NULL DEFAULT '{}',
  personalidade               text,
  papel                       text NOT NULL DEFAULT 'aluno' CHECK (papel IN ('aluno','aluna','professor','professora','outro')),
  ativo                       boolean NOT NULL DEFAULT true,

  criado_em                   timestamptz DEFAULT now(),
  atualizado_em               timestamptz DEFAULT now()
);

COMMENT ON TABLE personagens_charges IS 'Banco reutilizável de personagens do Gerador de Charges Didáticas, para garantir continuidade visual entre quadros e entre atividades diferentes';
COMMENT ON COLUMN personagens_charges.ativo IS 'false = arquivado (nunca DELETE de verdade, pois atividades já geradas referenciam o personagem pelo nome/id no histórico)';

CREATE INDEX IF NOT EXISTS idx_personagens_charges_ativo ON personagens_charges (ativo);

DROP TRIGGER IF EXISTS trg_atualizar_personagens_charges ON personagens_charges;
CREATE OR REPLACE FUNCTION atualizar_timestamp_personagens_charges()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualizar_personagens_charges
  BEFORE UPDATE ON personagens_charges
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_personagens_charges();

ALTER TABLE personagens_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_personagens_charges" ON personagens_charges;
CREATE POLICY "auth_all_personagens_charges"
  ON personagens_charges FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed inicial dos 3 personagens de referência do pedido original.
INSERT INTO personagens_charges (
  nome, idade, sexo, altura_aproximada, cor_pele, tipo_cabelo, cor_cabelo, olhos,
  uniforme, expressoes_mais_utilizadas, poses_comuns, personalidade, papel
) VALUES
  ('Bia', 14, 'F', '1,55m', 'parda', 'curto', 'castanho escuro', 'castanhos',
   'camiseta vermelha, calção preto, tênis branco',
   ARRAY['determinada','concentrada','sorrindo'],
   ARRAY['em posição de defesa','correndo','comemorando'],
   'Determinada, gosta de desafios, boa colega de equipe.', 'aluna'),
  ('Theo', 14, 'M', '1,60m', 'morena clara', 'raspado', 'preto', 'castanhos',
   'camiseta azul, calção branco, tênis preto',
   ARRAY['animado','surpreso','esforçado'],
   ARRAY['driblando','em pé observando','com a bola'],
   'Animado, um pouco impulsivo, está aprendendo a seguir regras.', 'aluno'),
  ('Professora Marta', 38, 'F', '1,65m', 'parda', 'médio, preso em coque', 'preto', 'castanhos',
   'camiseta polo azul-marinho, calça esportiva, apito no pescoço, tênis branco',
   ARRAY['atenciosa','firme','explicando'],
   ARRAY['apitando','demonstrando movimento','conversando com alunos'],
   'Paciente, didática, sempre explica as regras com calma.', 'professora')
ON CONFLICT (nome) DO NOTHING;

-- ------------------------------------------------------------
-- TABELA: charges_didaticas
--   Histórico imutável (snapshot) de cada atividade gerada: roteiro completo,
--   questões, personagens usados (congelados no momento da geração — mudanças
--   posteriores no banco de personagens não alteram atividades já salvas).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charges_didaticas (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parâmetros de geração / classificação curricular
  ano_escolar                 smallint NOT NULL CHECK (ano_escolar BETWEEN 6 AND 9),
  bimestre                    text,
  objeto_conhecimento         text,
  habilidade_bncc             text,
  conteudo                    text NOT NULL,
  tipo_imagem                 text NOT NULL CHECK (tipo_imagem IN ('charge','tirinha','ilustracao')),
  numero_quadros              smallint NOT NULL CHECK (numero_quadros BETWEEN 1 AND 4),
  estilo_ilustracao           text NOT NULL,
  quantidade_questoes         smallint NOT NULL CHECK (quantidade_questoes BETWEEN 1 AND 10),
  tipo_questoes               text NOT NULL CHECK (tipo_questoes IN ('discursivas','objetivas','mistas')),
  nivel                       text NOT NULL CHECK (nivel IN ('facil','medio','dificil')),
  observacoes_adicionais      text,

  -- Conteúdo gerado
  titulo_roteiro               text,
  sinopse                       text,
  quadros                       jsonb NOT NULL,   -- QuadroIA[]
  texto_apoio                   text,
  prompts_imagem                jsonb,            -- { quadro: number; prompt: string }[]
  questoes                      jsonb NOT NULL,   -- QuestaoChargeIA[]
  competencias                  text[] DEFAULT '{}',
  habilidades                   text[] DEFAULT '{}',
  objetivos                     text[] DEFAULT '{}',
  observacoes_professor          text,
  personagens_usados             jsonb NOT NULL,  -- Personagem[] (snapshot no momento da geração)

  -- Conformidade e revisão (ver regrasChargesDidaticas.ts / revisaoAutomaticaCharges.ts)
  status_revisao               text NOT NULL DEFAULT 'aprovada' CHECK (status_revisao IN ('aprovada','requer_revisao_manual','rascunho')),
  tentativas_revisao           smallint DEFAULT 0,
  historico_revisao            jsonb,             -- [{tentativa, motivosFalha[], timestamp}]

  -- Rastreabilidade da geração por IA
  metadata_geracao             jsonb,             -- {modelo, geradoEm, ...}

  criado_em                    timestamptz DEFAULT now(),
  atualizado_em                timestamptz DEFAULT now(),

  busca                        tsvector GENERATED ALWAYS AS (
                                  to_tsvector('portuguese',
                                    coalesce(titulo_roteiro, '') || ' ' ||
                                    coalesce(sinopse, '') || ' ' ||
                                    coalesce(conteudo, '') || ' ' ||
                                    coalesce(habilidade_bncc, ''))
                                ) STORED
);

COMMENT ON TABLE charges_didaticas IS 'Histórico de atividades geradas pelo Gerador de Charges Didáticas — cada linha é uma atividade completa e imutável (personagens_usados é um snapshot, não referencia personagens_charges por FK)';
COMMENT ON COLUMN charges_didaticas.status_revisao IS 'aprovada = passou no validador determinístico; requer_revisao_manual = esgotou tentativas de regeneração automática; rascunho = ainda não revisada';

CREATE INDEX IF NOT EXISTS idx_charges_didaticas_ano         ON charges_didaticas (ano_escolar);
CREATE INDEX IF NOT EXISTS idx_charges_didaticas_conteudo    ON charges_didaticas (conteudo);
CREATE INDEX IF NOT EXISTS idx_charges_didaticas_status      ON charges_didaticas (status_revisao);
CREATE INDEX IF NOT EXISTS idx_charges_didaticas_busca_gin   ON charges_didaticas USING gin (busca);

DROP TRIGGER IF EXISTS trg_atualizar_charges_didaticas ON charges_didaticas;
CREATE OR REPLACE FUNCTION atualizar_timestamp_charges_didaticas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualizar_charges_didaticas
  BEFORE UPDATE ON charges_didaticas
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_charges_didaticas();

ALTER TABLE charges_didaticas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_charges_didaticas" ON charges_didaticas;
CREATE POLICY "auth_all_charges_didaticas"
  ON charges_didaticas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- FIM — tabelas novas, nenhuma tabela existente foi alterada.
