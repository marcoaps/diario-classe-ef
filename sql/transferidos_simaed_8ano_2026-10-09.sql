-- 8º ano: alunos com campo de nota BLOQUEADO no Simaed (transferidos), 3º bim 2026.
-- Rode no editor SQL do Supabase (a chave anon não grava em notas).

-- 1) Conferir (deve listar 2 alunos):
select turma, bimestre, numero, nome, nota, situacao, data_situacao from notas
where (turma, numero) in (('8C',37),('8E',4)) order by turma, numero, bimestre;

-- 2) Atualizar (confere pelo 1º nome):
update notas set situacao = 'Foi Transferido'
where (turma, numero, upper(split_part(nome,' ',1))) in (
  ('8C',37,'ELIZA'),
  ('8E',4,'ARITON')
);
