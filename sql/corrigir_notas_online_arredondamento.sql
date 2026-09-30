-- Reaplica a regra de arredondamento (ceil inteiro, teto 9,5) nas notas que
-- vieram de prova online e já foram lançadas em `notas` ANTES da regra existir.
-- Rode primeiro só o SELECT (prévia). Atenção: sobrescreve `notas.nota` dessas
-- linhas, inclusive se você tiver editado a nota à mão depois do lançamento.

WITH melhor AS (
  SELECT r.turma_id, r.aluno_numero, p.id AS prova_id,
         (substring(p.titulo from '([1-4])\s*[º°o]?\s*bim'))::int AS bimestre,
         max(coalesce(r.nota, 0)) AS nota_bruta
  FROM respostas r JOIN provas p ON p.id = r.prova_id
  GROUP BY r.turma_id, r.aluno_numero, p.id, p.titulo
), alvo AS (
  SELECT n.turma, n.bimestre, n.nome, n.nota AS nota_atual,
         CASE WHEN m.nota_bruta <= 0 THEN 0
              WHEN m.nota_bruta >= 9.5 THEN 9.5
              ELSE least(ceil(round(m.nota_bruta::numeric, 2)), 9.5) END AS nota_nova
  FROM melhor m
  JOIN alunos a ON a.turma_id = m.turma_id AND a.numero_chamada = m.aluno_numero
  JOIN notas n ON n.turma = m.turma_id AND n.bimestre = m.bimestre AND n.nome = upper(a.nome)
  WHERE m.bimestre IS NOT NULL
)
-- PRÉVIA (rode assim, com o SELECT abaixo):
SELECT * FROM alvo WHERE nota_atual IS DISTINCT FROM nota_nova ORDER BY turma, nome;

-- PARA APLICAR: depois de conferir a prévia, troque o SELECT acima (a última
-- instrução, logo depois do WITH) por:
-- UPDATE notas n SET nota = a.nota_nova
-- FROM alvo a
-- WHERE n.turma = a.turma AND n.bimestre = a.bimestre AND n.nome = a.nome
--   AND a.nota_atual IS DISTINCT FROM a.nota_nova;
