-- Junta as linhas duplicadas de `notas` no 4º bimestre (mesmo aluno, mesma
-- turma, nome diferente só em maiúsculas/acentos). Fica UMA linha por aluno,
-- com a maior nota, a maior nota_ef e o maior número de faltas.
-- Rode no SQL Editor do Supabase, o arquivo inteiro de uma vez.
-- Antes de apagar, copia as linhas originais para notas_backup_dup_20261126.

begin;

create temporary table dup on commit drop as
select id, turma, bimestre, nome, nota, nota_ef, faltas, nota_texto, situacao, data_situacao,
       first_value(id) over w as manter_id,
       count(*) over (partition by turma, chave) as qtd
from (
  select n.*,
         regexp_replace(trim(translate(upper(nome),
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
           'AAAAAEEEEIIIIOOOOOUUUUCNAAAAAEEEEIIIIOOOOOUUUUCN')), '\s+', ' ', 'g') as chave
  from notas n
  where bimestre = 4
) x
-- fica a linha que tem nota; no empate, a de nome em CAIXA ALTA
window w as (partition by turma, chave
             order by (nota is not null) desc, nota desc, (nome = upper(nome)) desc, id);

delete from dup where qtd < 2;

create table if not exists notas_backup_dup_20261126 (like notas);
alter table notas_backup_dup_20261126 enable row level security;
insert into notas_backup_dup_20261126
  select * from notas where id in (select id from dup);

update notas n set
  nota          = j.nota,
  nota_ef       = j.nota_ef,
  faltas        = j.faltas,
  nota_texto    = coalesce(n.nota_texto, j.nota_texto),
  -- se uma das linhas marca transferido/remanejado, essa informação fica
  situacao      = coalesce(j.situacao, n.situacao),
  data_situacao = coalesce(j.data_situacao, n.data_situacao)
from (
  select manter_id,
         max(nota) as nota,
         max(nota_ef) as nota_ef,
         max(faltas) as faltas,
         max(nota_texto) as nota_texto,
         max(situacao) filter (where situacao <> 'Em Curso') as situacao,
         max(nullif(data_situacao, '')) as data_situacao
  from dup
  group by manter_id
) j
where n.id = j.manter_id;

delete from notas where id in (select id from dup where id <> manter_id);

commit;

-- Conferência: uma linha por aluno que estava duplicado.
select turma, numero, nome, nota, nota_ef, faltas, situacao
from notas
where id in (select id from notas_backup_dup_20261126)
order by turma, numero;
