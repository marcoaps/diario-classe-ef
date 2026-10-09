-- 6ºF: aluno com campo de nota BLOQUEADO no Simaed (transferido), 3º bim 2026.
-- Rode no editor SQL do Supabase (a chave anon não grava em notas).

-- 1) Conferir (deve listar 1 aluno):
select turma, bimestre, numero, nome, nota, situacao, data_situacao from notas
where turma = '6F' and numero = 30 order by bimestre;

-- 2) Atualizar (confere pelo 1º nome):
update notas set situacao = 'Foi Transferido'
where turma = '6F' and numero = 30 and upper(split_part(nome,' ',1)) = 'GUILHERMY';
