-- Restaura as notas do 3º bimestre que as correções impressas de 09/10/2026 rebaixaram.
-- Regra: vale a MAIOR nota. Valor 'antes' = último Notas-3BM-<turma>.xlsx exportado (15 a 27/09).
-- Seguro: só altera se a nota AINDA for a que a correção gravou (nota = atual) e nunca baixa nada.
-- Rode UMA vez no SQL Editor do Supabase.

update notas n set nota = v.antes
from (values
  ('7B', 22, 3.0, 7.0),  -- KATHYELLE DA SILVA CAMPELO
  ('7B', 25, 3.0, 7.5),  -- KETHLY VITÓRIA MARINHO DE CASTRO
  ('7B', 29, 3.0, 7.5),  -- MARIANA DE FREITAS GALVÃO
  ('7C', 2, 3.0, 7.0),  -- ANA CLARA CUNHA DE FREITAS
  ('7C', 9, 3.0, 7.0),  -- DANIELA ALANA SOUZA DA SILVA
  ('7C', 17, 4.0, 7.0),  -- JHONATAN DE OLIVEIRA LIMA
  ('7C', 20, 3.0, 7.0),  -- JOÃO VICTOR NASCIMENTO DA SILVA
  ('7C', 32, 3.0, 7.0),  -- NATÃ VICTOR RODRIGUES DE OLIVEIRA
  ('7D', 19, 3.0, 7.0),  -- LARISSA EMELLY DE PAULA VALENCIA
  ('7D', 20, 3.0, 7.0),  -- MELRY KATY LIMA DOS ANJOS
  ('7D', 31, 3.0, 7.0),  -- EVELLYN PEREIRA DE ALBUQUERQUE
  ('7E', 4, 3.0, 8.5),  -- CARLOS EDUARDO SANTOS
  ('7E', 5, 3.0, 7.5),  -- DÉBORA MANUELA DE CASTRO CRISPIM
  ('7E', 6, 3.0, 7.5),  -- DELZIMARA DE OLIVEIRA DOS SANTOS
  ('7E', 26, 3.0, 8.5),  -- SOPHIA TEIXEIRA CELESTINO
  ('7F', 26, 3.0, 7.0),  -- RYAN FACUNDO DE ANDRADE
  ('8A', 21, 8.0, 8.5),  -- LAUANY MARCIELLY MUNIZ DE LIMA
  ('8A', 31, 8.0, 8.5),  -- TÁFINY SOUZA RODRIGUES
  ('8A', 32, 7.0, 8.5),  -- TAILINY SOUZA RODRIGUES
  ('8B', 6, 4.0, 8.5),  -- BIANCA UTILDE CAVALCANTE CARDOSO
  ('8B', 9, 8.0, 8.5),  -- DOUGLAS DANIEL MOURA DA SILVA
  ('8B', 18, 7.0, 8.5),  -- JOSÉ VICTOR ALMEIDA DA SILVA
  ('8B', 33, 5.0, 9.0),  -- SAMELA RAWANA ARAÚJO
  ('9B', 5, 7.0, 8.5),  -- ANA LAURA COSTA PEREIRA
  ('9B', 11, 6.0, 8.5),  -- DHOMINI LOPES DA SILVA
  ('9B', 26, 8.0, 9.0),  -- MYKAEL NATÃ DE CASTRO SOUZA
  ('9D', 27, 8.0, 8.5),  -- SAMIRA LIMA DE OLIVEIRA
  ('9E', 21, 7.0, 8.5),  -- MYKAL MAIA DO NASCIMENTO
  ('9F', 15, 5.0, 7.0)  -- IZADORA MAIA RIOS
) as v(turma, numero, atual, antes)
where n.bimestre = 3 and n.turma = v.turma and n.numero = v.numero
  and n.nota = v.atual and v.antes > n.nota;
