-- ORGANIZAÇÃO DOS REMANEJADOS (3º bim 2026) — padrão de quem já está certo no Diário (ex.: Breno 8D->8C):
--   * a aluna existe nas DUAS turmas em `alunos`;
--   * na turma antiga o 3º bim fica 'Remanejado' (sem nota); na nova nasce a linha 'Em Curso' com a nota.
-- Datas de remanejamento desconhecidas ficam vazias (ou mantêm a que já existia).
-- Rode no editor SQL do Supabase (a chave anon não grava). Bloco 1 (conferir) -> Bloco 2 (aplicar) -> Bloco 3 (conferir depois).
--
-- PARTE A (passa para a turma nova; falta cadastro/linha lá; no Simaed está ATIVA na nova e bloqueada na antiga):
--   Maria Izabel Bibiano Klein   : 8D nº17 -> 8E nº28   (nota 10,0)
--   Maria Luíza Crisostimo Sales : 9C nº22 -> 9E nº33   (nota 7,5)
--   Samuel Pereira de Lima       : 7F nº27 -> 7C nº38   (nota 7,0)
-- PARTE B (já estão nas duas turmas, só a situação da turma antiga está errada):
--   Karla Sabrina Borges Acosta : 8C nº18 (3º bim 'Em Curso' -> 'Remanejado'; ela está na 8E nº27 com 7,0)
--   Lorrane de Souza Araújo     : 8C nº21 (b1-b3 'Foi Transferido' 19/03/2026 -> 'Remanejado'; ativa na 8F nº27 com 9,0)
--   Fagner Renan Firmeza da Rocha: 9F nº12 (b3 'Foi Transferido' 19/03/2026 -> 'Remanejado', igual ao b1; a saída da escola é a do 9D 16/06, que fica)

-- 1) CONFERIR ANTES
select 'alunos' as tabela, turma_id as turma, numero_chamada as numero, nome, null::numeric as nota, null::text as situacao from alunos
 where (turma_id, numero_chamada) in (('8D',17),('8E',28),('9C',22),('9E',33),('7F',27),('7C',38))
union all
select 'notas b'||bimestre, turma, numero, nome, nota, situacao from notas
 where (bimestre = 3 and (turma, numero) in (('8D',17),('8E',28),('9C',22),('9E',33),('7F',27),('7C',38),('8C',18),('9F',12)))
    or (turma = '8C' and numero = 21)
order by 2, 3, 1;
-- Esperado: nada em 8E/28, 9E/33 e 7C/38; 8C/18 'Em Curso'; 8C/21 'Foi Transferido'; 9F/12 b3 'Foi Transferido'.

-- 2) APLICAR (tudo ou nada)
begin;

-- A1) cadastra a aluna na turma nova (nº livre; copia nome e sexo)
insert into alunos (id, nome, turma_id, numero_chamada, token_acesso, sexo)
select gen_random_uuid(), a.nome, v.nova, v.num_novo, gen_random_uuid(), a.sexo
from (values ('8D',17,'8E',28), ('9C',22,'9E',33), ('7F',27,'7C',38)) as v(antiga, num_antigo, nova, num_novo)
join alunos a on a.turma_id = v.antiga and a.numero_chamada = v.num_antigo
where not exists (select 1 from alunos x where x.turma_id = v.nova and x.numero_chamada = v.num_novo);

-- A2) 3º bim na turma nova, com a nota que ela já tem
insert into notas (turma, bimestre, numero, nome, nota, nota_texto, situacao, data_situacao, faltas)
select v.nova, 3, v.num_novo, n.nome, n.nota, n.nota_texto, 'Em Curso', '', n.faltas
from (values ('8D',17,'8E',28), ('9C',22,'9E',33), ('7F',27,'7C',38)) as v(antiga, num_antigo, nova, num_novo)
join notas n on n.turma = v.antiga and n.numero = v.num_antigo and n.bimestre = 3
on conflict (turma, bimestre, nome) do nothing;

-- A3) 3º bim na turma antiga: remanejada, sem nota (só se a linha da turma nova existir)
update notas n set situacao = 'Remanejado', nota = null
from (values ('8D',17,'8E',28), ('9C',22,'9E',33), ('7F',27,'7C',38)) as v(antiga, num_antigo, nova, num_novo)
where n.turma = v.antiga and n.numero = v.num_antigo and n.bimestre = 3
  and exists (select 1 from notas x where x.turma = v.nova and x.bimestre = 3 and x.numero = v.num_novo);

-- B1) Karla: 8C 3º bim -> Remanejado (nota já está vazia)
update notas set situacao = 'Remanejado'
where turma = '8C' and numero = 18 and bimestre = 3 and upper(split_part(nome,' ',1)) = 'KARLA';

-- B2) Lorrane: 8C bimestres 1-3 -> Remanejado (mantém a data 19/03/2026)
update notas set situacao = 'Remanejado'
where turma = '8C' and numero = 21 and bimestre in (1,2,3) and situacao = 'Foi Transferido'
  and upper(split_part(nome,' ',1)) = 'LORRANE';

-- B3) Fagner: 9F 3º bim -> Remanejado (mantém a data 19/03/2026)
update notas set situacao = 'Remanejado'
where turma = '9F' and numero = 12 and bimestre = 3 and situacao = 'Foi Transferido'
  and upper(split_part(nome,' ',1)) = 'FAGNER';

commit;

-- 3) CONFERIR DEPOIS
select turma, bimestre, numero, nome, nota, situacao, data_situacao from notas
 where (bimestre = 3 and (turma, numero) in (('8D',17),('8E',28),('9C',22),('9E',33),('7F',27),('7C',38),('8C',18),('9F',12)))
    or (turma = '8C' and numero = 21)
order by turma, numero, bimestre;
-- Esperado: 8E/28 10,0 'Em Curso'; 9E/33 7,5 'Em Curso'; 7C/38 7,0 'Em Curso'; 8D/17, 9C/22, 7F/27, 8C/18, 8C/21 (b1-b3), 9F/12 b3 -> 'Remanejado'.
