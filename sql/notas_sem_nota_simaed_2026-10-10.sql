-- Alunos 'Em Curso' sem nota no Diário (3º bimestre) -> nota que está no Simaed (10/10/2026).
-- Seguro: só preenche onde a nota ainda é NULL; nunca sobrescreve nota existente.
-- Rode UMA vez no SQL Editor do Supabase.

update notas n set nota = v.nota
from (values
  ('7D', 33, 7.0),   -- ANNY KAROLINY DO NASCIMENTO FARRAPO
  ('7F', 18, 7.0),   -- JOÃO EDUARDO SOARES RAMOS
  ('7F', 34, 7.0),   -- WELITON BEZERRA DE LIMA
  ('8C', 35, 7.0),   -- BRENO DO NASCIMENTO GOMES
  ('8C', 36, 10.0),  -- IZABELLY CRISTHINA DA SILVA (já estava 10,0 no Simaed)
  ('8F', 29, 7.0)    -- MURILLO DORNELLES DE OLIVEIRA FRANÇA
) as v(turma, numero, nota)
where n.bimestre = 3 and n.turma = v.turma and n.numero = v.numero and n.nota is null;
