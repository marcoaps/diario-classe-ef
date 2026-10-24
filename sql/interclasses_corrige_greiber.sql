-- Corrige a inscrição do Greiber (6ºE, futsal): nº de chamada real no Simaed é 34.
update interclasses_inscricoes
set numero_chamada = 34
where edicao = '2026'
  and modalidade = 'futsal'
  and turma_id = '6E'
  and nome_completo = 'Greiber Eduardo Ayala Carico';
