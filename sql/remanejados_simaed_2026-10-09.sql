-- Remanejadas de turma (no Simaed estão bloqueadas na turma antiga e ATIVAS na nova), 3º bim 2026:
--   Maria Izabel Bibiano Klein   : 8D nº17  ->  8E nº28
--   Maria Luíza Crisostimo Sales : 9C nº22  ->  9E nº33
-- Segue o padrão de quem já foi remanejado (ex.: Breno 8D->8C): a aluna passa a existir nas DUAS turmas em `alunos`;
-- na turma antiga o 3º bim fica 'Remanejado' (sem nota); na nova nasce a linha do 3º bim com a nota.
-- Os bimestres 1 e 2 ficam como estão (na turma antiga). A data do remanejamento é desconhecida: fica vazia.
-- Rode no editor SQL do Supabase (a chave anon não grava). Rode o bloco 1, confira, depois o bloco 2.

-- 1) CONFERIR (deve listar 2 alunas em alunos e 2 linhas de notas do 3º bim, e nenhuma linha nas turmas novas):
select 'alunos' as tabela, turma_id as turma, numero_chamada as numero, nome, null::numeric as nota from alunos
 where (turma_id, numero_chamada) in (('8D',17),('9C',22),('8E',28),('9E',33))
union all
select 'notas', turma, numero, nome, nota from notas
 where bimestre = 3 and (turma, numero) in (('8D',17),('9C',22),('8E',28),('9E',33))
order by 2, 3;

-- 2) APLICAR (tudo ou nada):
begin;

-- 2a) a aluna passa a existir também na turma nova
insert into alunos (id, nome, turma_id, numero_chamada, token_acesso, sexo)
select gen_random_uuid(), a.nome, v.nova, v.num_novo, gen_random_uuid(), a.sexo
from (values ('8D',17,'8E',28), ('9C',22,'9E',33)) as v(antiga, num_antigo, nova, num_novo)
join alunos a on a.turma_id = v.antiga and a.numero_chamada = v.num_antigo
where not exists (select 1 from alunos x where x.turma_id = v.nova and x.numero_chamada = v.num_novo);

-- 2b) 3º bim na turma nova, com a nota que ela já tem (10,0 e 7,5)
insert into notas (turma, bimestre, numero, nome, nota, nota_texto, situacao, data_situacao, faltas)
select v.nova, 3, v.num_novo, n.nome, n.nota, n.nota_texto, 'Em Curso', '', n.faltas
from (values ('8D',17,'8E',28), ('9C',22,'9E',33)) as v(antiga, num_antigo, nova, num_novo)
join notas n on n.turma = v.antiga and n.numero = v.num_antigo and n.bimestre = 3
on conflict (turma, bimestre, nome) do nothing;

-- 2c) 3º bim na turma antiga: remanejada, sem nota (a nota agora está na turma nova)
update notas n set situacao = 'Remanejado', nota = null
from (values ('8D',17), ('9C',22)) as v(turma, numero)
where n.turma = v.turma and n.numero = v.numero and n.bimestre = 3
  and exists (select 1 from notas x where x.bimestre = 3 and x.nome = n.nome and x.turma in ('8E','9E'));

commit;

-- 3) CONFERIR DEPOIS (esperado: 8E nº28 e 9E nº33 com 'Em Curso' e nota 10,0 / 7,5; 8D nº17 e 9C nº22 'Remanejado'):
select turma, bimestre, numero, nome, nota, situacao from notas
 where bimestre = 3 and (turma, numero) in (('8D',17),('9C',22),('8E',28),('9E',33)) order by turma;
