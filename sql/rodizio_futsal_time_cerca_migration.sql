-- ============================================================================
-- Rodízio de Futsal — permite marcar um time criado já no cadastro inicial
-- (antes de "Iniciar Rodízio") como o time extra/banco ("Time da Cerca"),
-- criado com nome personalizado em vez de um capitão. Diferente da coluna
-- criado_durante_rodizio (que marca time avulso montado NO MEIO da aula).
-- Rode este arquivo no SQL Editor do Supabase (depois de rodizio_futsal_setup.sql).
-- ============================================================================

alter table rodizio_times
  add column if not exists time_cerca boolean not null default false;
