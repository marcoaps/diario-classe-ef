-- ============================================================================
-- Guarda o nome do professor que fez cada correção (avaliacoes_respostas),
-- digitado na tela de Corrigir Prova antes de escanear as folhas. Puramente
-- organizacional -- não substitui avaliacoes.professor (quem criou a
-- avaliação), já que quem corrige pode ser outra pessoa.
-- ============================================================================

alter table avaliacoes_respostas add column if not exists professor_nome text;

comment on column avaliacoes_respostas.professor_nome is 'Nome de quem corrigiu esta folha (digitado na tela de correção) -- pode ser diferente de avaliacoes.professor.';
