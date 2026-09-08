-- ============================================================================
-- Vincula um registro de NP (Não Participou) na aula de quadra a um
-- trabalho compensatório aplicado ao aluno.
--
-- ON DELETE SET NULL: se o trabalho vinculado for excluído depois, o
-- registro de frequência não é apagado — só perde o vínculo.
-- ============================================================================

alter table frequencia add column if not exists trabalho_compensatorio_id uuid
  references trabalhos(id) on delete set null;

create index if not exists idx_frequencia_trabalho_compensatorio
  on frequencia (trabalho_compensatorio_id);
