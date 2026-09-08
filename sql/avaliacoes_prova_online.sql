-- ============================================================
-- Corrige "Publicar como Prova Online" gerando um código novo a cada
-- vez (ex: ao atualizar a página) -- o código publicado nunca era salvo
-- na própria avaliação, só num state local do navegador (que se perde ao
-- recarregar), então cada clique em "Publicar" criava uma linha NOVA em
-- `provas` com um código novo, deixando linhas duplicadas e órfãs pra trás.
--
-- Aditivo e seguro: não mexe em nenhuma linha existente.
-- ============================================================

ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS prova_online_id     uuid;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS prova_online_codigo text;

COMMENT ON COLUMN avaliacoes.prova_online_id IS 'FK lógica pra provas.id -- preenchida quando a avaliação é publicada como Prova Online. Se já estiver preenchida, "Publicar" não cria uma prova nova, só mostra o código existente.';
COMMENT ON COLUMN avaliacoes.prova_online_codigo IS 'Código de acesso da Prova Online (o mesmo salvo em provas.codigo) -- guardado aqui pra sobreviver a um recarregamento de página.';

-- FIM.
