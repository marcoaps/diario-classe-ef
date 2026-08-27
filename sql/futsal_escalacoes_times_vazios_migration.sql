-- ============================================================================
-- Times de Futsal — permite salvar um time SEM jogadores.
-- Rode este arquivo no SQL Editor do Supabase (https://supabase.com/dashboard).
--
-- futsal_escalacoes hoje é "uma linha por jogador" — um time recém-criado/
-- renomeado mas ainda sem ninguém escalado não tinha como ser gravado, porque
-- aluno_id/aluno_nome/posicao eram obrigatórios. Agora esses campos aceitam
-- NULL: um time sem jogadores vira uma única linha "placeholder" (aluno_id
-- null), só para registrar que o time existe (número + nome).
--
-- Não precisa mexer no CHECK de `posicao` — no Postgres, um CHECK constraint
-- passa automaticamente quando o valor é NULL (UNKNOWN não é FALSE).
-- ============================================================================

alter table futsal_escalacoes alter column aluno_id drop not null;
alter table futsal_escalacoes alter column aluno_nome drop not null;
alter table futsal_escalacoes alter column posicao drop not null;
