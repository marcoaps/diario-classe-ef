-- Alunos ATIVOS no Simaed que não estavam completos no Diário (3º bim 2026). Cadastro SEM nota.
--   Anny Karoliny do Nascimento Farrapo       : 7D nº33  (não existia no Diário)
--   Murillo Dornelles de Oliveira Franca      : 8F nº29  (não existia no Diário; o nome vem do Simaed sem acento — ajuste se for "França")
--   Weliton Bezerra de Lima                   : 7F nº35 -> nº34 (igual ao Simaed; já está em `alunos`, falta a linha de notas do 3º bim)
-- NUMERAÇÃO = a do Simaed. Para liberar o nº34 da 7F, a Antonia Fernanda Pereira Freitas (transferida, bloqueada no Simaed)
--   volta ao nº3 (o mesmo dos bimestres 1 e 2 e o do Simaed; o 3º bim dela estava como nº34 por erro de importação).
--   A frequência liga ao aluno por aluno_id (não pelo número), então renumerar não afeta a chamada.
-- 7D/33 e 8F/29 estão livres (maiores atuais: 32 e 28). Sexo fica vazio (marque depois em "Marcar gênero").
-- Rode no editor SQL do Supabase. Bloco 1 (conferir) -> Bloco 2 (aplicar) -> Bloco 3 (conferir depois).

-- 1) CONFERIR ANTES (esperado: nada em 7D/33, 8F/29 e 7F/3; Antonia em 7F/34 (alunos e notas); Weliton só em alunos 7F/35)
select 'alunos' as tabela, turma_id as turma, numero_chamada as numero, nome from alunos
 where (turma_id, numero_chamada) in (('7D',33),('8F',29),('7F',3),('7F',34),('7F',35))
union all
select 'notas b3', turma, numero, nome from notas
 where bimestre = 3 and (turma, numero) in (('7D',33),('8F',29),('7F',3),('7F',34),('7F',35))
order by 2, 3, 1;

-- 2) APLICAR (tudo ou nada)
begin;

-- 7F: Antonia volta ao nº3 (libera o 34) e Weliton passa a nº34, como no Simaed
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
from (values
  ('Anny Karoliny do Nascimento Farrapo',  '7D', 33),
  ('Murillo Dornelles de Oliveira Franca', '8F', 29)
) as v(nome, turma, numero)
where not exists (select 1 from alunos x where x.turma_id = v.turma and x.numero_chamada = v.numero);

-- linha do 3º bim, sem nota, para os três (nota null = em branco)
insert into notas (turma, bimestre, numero, nome, nota, nota_texto, situacao, data_situacao, faltas)
select v.turma, 3, v.numero, upper(v.nome), null, null, 'Em Curso', '', 0
from (values
  ('Anny Karoliny do Nascimento Farrapo',  '7D', 33),
  ('Murillo Dornelles de Oliveira Franca', '8F', 29),
  ('Weliton Bezerra de Lima',              '7F', 34)
) as v(nome, turma, numero)
on conflict (turma, bimestre, nome) do nothing;

commit;

-- 3) CONFERIR DEPOIS (esperado: 7D/33, 8F/29 e 7F/34 (Weliton) 'Em Curso' sem nota; Antonia em 7F/3 com 7,5)
select turma, bimestre, numero, nome, nota, situacao from notas
 where bimestre = 3 and (turma, numero) in (('7D',33),('8F',29),('7F',3),('7F',34),('7F',35)) order by turma, numero;
