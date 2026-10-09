-- REGRA: o SIMAED é a referência. Aluno ATIVO no Simaed (campo de nota liberado) deve estar 'Em Curso' no Diário.
-- João Eduardo Soares Ramos (7F nº18): no Diário estava 'Foi Transferido' (10/04/2026) nos bimestres 1-3, mas no Simaed está ATIVO.
-- Obs.: as notas 0,0 dos bimestres 1 e 2 NÃO são alteradas aqui (decida depois se quer apagá-las). O 3º bim segue sem nota.
-- Rode no editor SQL do Supabase. Bloco 1 (conferir) -> Bloco 2 (aplicar).

-- 1) CONFERIR ANTES (esperado: bimestres 1-3 'Foi Transferido' 10/04/2026; bimestre 4 'Em Curso')
select turma, bimestre, numero, nome, nota, situacao, data_situacao from notas
 where turma = '7F' and numero = 18 order by bimestre;

-- 2) APLICAR
update notas set situacao = 'Em Curso', data_situacao = ''
 where turma = '7F' and numero = 18 and bimestre in (1,2,3) and situacao = 'Foi Transferido'
   and upper(split_part(nome,' ',1)) = 'JOÃO';

-- 3) CONFERIR DEPOIS (esperado: os 4 bimestres 'Em Curso')
select turma, bimestre, numero, nome, nota, situacao, data_situacao from notas
 where turma = '7F' and numero = 18 order by bimestre;
