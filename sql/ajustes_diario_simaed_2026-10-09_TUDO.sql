-- AJUSTES DO DIÁRIO CONFORME O SIMAED (3º bim 2026) — tudo num só script.
-- Rode no editor SQL do Supabase. Cole inteiro: é "tudo ou nada" (se algo falhar, nada é gravado).
-- Depois rode o bloco de conferência no fim.

begin;

-- 1) CADASTROS (numeração = Simaed). Antonia volta ao nº3 para liberar o 34 da 7F; Weliton passa a 34.
update alunos set numero_chamada = 3
 where turma_id = '7F' and numero_chamada = 34 and upper(split_part(nome,' ',1)) = 'ANTONIA'
   and not exists (select 1 from alunos x where x.turma_id = '7F' and x.numero_chamada = 3);
update notas set numero = 3
 where turma = '7F' and bimestre = 3 and numero = 34 and upper(split_part(nome,' ',1)) = 'ANTONIA';
update alunos set numero_chamada = 34
 where turma_id = '7F' and numero_chamada = 35 and upper(split_part(nome,' ',1)) = 'WELITON'
   and not exists (select 1 from alunos x where x.turma_id = '7F' and x.numero_chamada = 34);

insert into alunos (id, nome, turma_id, numero_chamada, token_acesso, sexo)
select gen_random_uuid(), v.nome, v.turma, v.numero, gen_random_uuid(), null
from (values ('Anny Karoliny do Nascimento Farrapo','7D',33), ('Murillo Dornelles de Oliveira Franca','8F',29)) as v(nome, turma, numero)
where not exists (select 1 from alunos x where x.turma_id = v.turma and x.numero_chamada = v.numero);

insert into notas (turma, bimestre, numero, nome, nota, nota_texto, situacao, data_situacao, faltas)
select v.turma, 3, v.numero, upper(v.nome), null, null, 'Em Curso', '', 0
from (values ('Anny Karoliny do Nascimento Farrapo','7D',33), ('Murillo Dornelles de Oliveira Franca','8F',29), ('Weliton Bezerra de Lima','7F',34)) as v(nome, turma, numero)
on conflict (turma, bimestre, nome) do nothing;

-- 2) REMANEJADOS — Parte A: passam para a turma nova (Maria Izabel 8D17->8E28, Maria Luíza 9C22->9E33, Samuel 7F27->7C38)
insert into alunos (id, nome, turma_id, numero_chamada, token_acesso, sexo)
select gen_random_uuid(), a.nome, v.nova, v.num_novo, gen_random_uuid(), a.sexo
from (values ('8D',17,'8E',28), ('9C',22,'9E',33), ('7F',27,'7C',38)) as v(antiga, num_antigo, nova, num_novo)
join alunos a on a.turma_id = v.antiga and a.numero_chamada = v.num_antigo
where not exists (select 1 from alunos x where x.turma_id = v.nova and x.numero_chamada = v.num_novo);

insert into notas (turma, bimestre, numero, nome, nota, nota_texto, situacao, data_situacao, faltas)
select v.nova, 3, v.num_novo, n.nome, n.nota, n.nota_texto, 'Em Curso', '', n.faltas
from (values ('8D',17,'8E',28), ('9C',22,'9E',33), ('7F',27,'7C',38)) as v(antiga, num_antigo, nova, num_novo)
join notas n on n.turma = v.antiga and n.numero = v.num_antigo and n.bimestre = 3
on conflict (turma, bimestre, nome) do nothing;

update notas n set situacao = 'Remanejado', nota = null
from (values ('8D',17,'8E',28), ('9C',22,'9E',33), ('7F',27,'7C',38)) as v(antiga, num_antigo, nova, num_novo)
where n.turma = v.antiga and n.numero = v.num_antigo and n.bimestre = 3
  and exists (select 1 from notas x where x.turma = v.nova and x.bimestre = 3 and x.numero = v.num_novo);

-- 2) REMANEJADOS — Parte B: só corrige a situação na turma antiga (Karla 8C18, Lorrane 8C21, Fagner 9F12)
update notas set situacao = 'Remanejado'
 where turma = '8C' and numero = 18 and bimestre = 3 and upper(split_part(nome,' ',1)) = 'KARLA';
update notas set situacao = 'Remanejado'
 where turma = '8C' and numero = 21 and bimestre in (1,2,3) and situacao = 'Foi Transferido' and upper(split_part(nome,' ',1)) = 'LORRANE';
update notas set situacao = 'Remanejado'
 where turma = '9F' and numero = 12 and bimestre = 3 and situacao = 'Foi Transferido' and upper(split_part(nome,' ',1)) = 'FAGNER';

-- 3) TRANSFERIDOS (bloqueados no Simaed): Rhomel 7C35, Yhago 7E29, Anna Heloisa 7E33, Aysha 7F4, Fernanda 7F31,
--    Antonia 7F3, Eliza 8C37, Ariton 8E4, Guilhermy 6F30
update notas set situacao = 'Foi Transferido'
where (turma, numero, upper(split_part(nome,' ',1))) in (
  ('7C',35,'RHOMEL'), ('7E',29,'YHAGO'), ('7E',33,'ANNA'), ('7F',4,'AYSHA'), ('7F',31,'FERNANDA'), ('7F',3,'ANTONIA'),
  ('8C',37,'ELIZA'), ('8E',4,'ARITON'), ('6F',30,'GUILHERMY')
);

-- 4) ATIVO no Simaed: João Eduardo Soares Ramos (7F nº18) volta a 'Em Curso' (bimestres 1-3)
update notas set situacao = 'Em Curso', data_situacao = ''
 where turma = '7F' and numero = 18 and bimestre in (1,2,3) and situacao = 'Foi Transferido' and upper(split_part(nome,' ',1)) = 'JOÃO';

commit;

-- CONFERÊNCIA (rode depois): 3º bim das turmas/números mexidos
select turma, numero, nome, nota, situacao, data_situacao from notas
 where bimestre = 3 and (turma, numero) in (
  ('7D',33),('8F',29),('7F',3),('7F',34),('7F',18),('7F',4),('7F',31),('7F',27),('7C',38),('7C',35),
  ('7E',29),('7E',33),('8D',17),('8E',28),('8E',4),('8C',18),('8C',21),('8C',37),('9C',22),('9E',33),('9F',12),('6F',30))
 order by turma, numero;
-- Esperado: 7F/3 Antonia, 7F/4 Aysha, 7F/31 Fernanda, 7C/35, 7E/29, 7E/33, 8C/37, 8E/4, 6F/30 = 'Foi Transferido';
--           8D/17, 7F/27, 9C/22, 8C/18, 8C/21, 9F/12 = 'Remanejado';
--           8E/28 (10,0), 9E/33 (7,5), 7C/38 (7,0), 7F/18 = 'Em Curso'; 7D/33, 8F/29, 7F/34 = 'Em Curso' sem nota.
