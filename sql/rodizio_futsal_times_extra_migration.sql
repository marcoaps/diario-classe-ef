-- ============================================================================
-- Rodízio de Futsal — permite criar um time "avulso" no meio da aula (ex:
-- sobrou aluno sem equipe, ele chama jogadores que já perderam pra formar um
-- time extra) sem alterar os times originais.
-- Rode este arquivo no SQL Editor do Supabase (depois de rodizio_futsal_setup.sql).
-- ============================================================================

alter table rodizio_times
  add column if not exists criado_durante_rodizio boolean not null default false;
