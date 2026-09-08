-- Adiciona o campo de gênero (sexo) de cada aluno, usado para separar
-- meninos/meninas nas Fichas de Grupo quando várias turmas são juntadas
-- no mesmo horário. Valores esperados: 'M', 'F', ou NULL (ainda não
-- marcado).

alter table alunos add column if not exists sexo text;

alter table alunos drop constraint if exists alunos_sexo_check;
alter table alunos add constraint alunos_sexo_check
  check (sexo is null or sexo in ('M', 'F'));
