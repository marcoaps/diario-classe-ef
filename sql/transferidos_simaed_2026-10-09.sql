-- Alunos com campo de nota BLOQUEADO no Simaed (badge "E" = transferido), 3º bimestre 2026.
-- Marca 'Foi Transferido' em todos os bimestres da tabela notas (data desconhecida: fica vazia).
-- Rode no editor SQL do Supabase (a chave anon não grava em notas).

-- 1) Conferir antes (deve listar 6 alunos, 1+ linha cada):
select turma, bimestre, numero, nome, nota, situacao, data_situacao from notas
where (turma, numero) in (('7C',35),('7E',29),('7E',33),('7F',4),('7F',31),('7F',34))
order by turma, numero, bimestre;

-- 2) Atualizar (nome confere pelo 1º nome, pra não pegar outro aluno se o nº mudou):
update notas set situacao = 'Foi Transferido'
where (turma, numero, upper(split_part(nome,' ',1))) in (
  ('7C',35,'RHOMEL'),
  ('7E',29,'YHAGO'),
  ('7E',33,'ANNA'),
  ('7F',4,'AYSHA'),
  ('7F',31,'FERNANDA'),
  ('7F',34,'ANTONIA')
);
