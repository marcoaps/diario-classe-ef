-- ============================================================================
-- Expande o checklist de participação (frequencia.participacao) com dois
-- novos status e justificativa individual para "Não Participou — Justificado".
--
-- NÃO renomeia os valores já gravados ('fez' / 'fez_em_parte' / 'nao_fez').
-- A correspondência com as novas siglas (PI/PP/NP) é feita só na camada de
-- exibição (src/domain/frequenciaPontos.ts), então nenhum registro histórico
-- precisa ser reescrito — é aditivo e seguro.
--
-- Novos valores de participacao:
--   'adaptada'                    -> PA — Participação Adaptada
--   'nao_participou_justificado'  -> NPJ — Não Participou — Justificado
-- ============================================================================

-- Timestamp do registro (não existia antes) — usado para "data e hora do
-- registro" da justificativa. Preenchido automaticamente para linhas novas;
-- linhas antigas ficam com o valor do momento em que esta migração roda
-- (não há como recuperar retroativamente o horário real de criação).
alter table frequencia add column if not exists criado_em timestamptz not null default now();

-- Justificativa do NPJ. Só faz sentido quando participacao =
-- 'nao_participou_justificado' — essa relação é garantida pela aplicação,
-- não por constraint, para não travar edições futuras de outros campos.
alter table frequencia add column if not exists justificativa_motivo text;
alter table frequencia add column if not exists justificativa_observacao text;

-- Amplia o CHECK de participacao para aceitar os dois novos status.
alter table frequencia drop constraint if exists frequencia_participacao_check;
alter table frequencia add constraint frequencia_participacao_check
  check (participacao is null or participacao in (
    'fez', 'fez_em_parte', 'nao_fez', 'adaptada', 'nao_participou_justificado'
  ));

-- Motivo da justificativa (NPJ) — lista fechada + "outro".
alter table frequencia drop constraint if exists frequencia_justificativa_motivo_check;
alter table frequencia add constraint frequencia_justificativa_motivo_check
  check (justificativa_motivo is null or justificativa_motivo in (
    'restricao_medica', 'lesao_dor', 'indisposicao', 'dispensa_formal',
    'atendimento_pedagogico', 'outro'
  ));
