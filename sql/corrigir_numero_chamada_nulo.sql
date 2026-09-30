-- ============================================================================
-- Corrige numero_chamada = NULL de alunos que ficaram sem numero no cadastro
-- (a maioria transferidos/remanejados). O numero correto foi recuperado do
-- historico gravado na tabela notas (situacao registrada por bimestre), que
-- guarda o numero original da chamada oficial da escola. Os 3 alunos sem
-- nenhum registro em notas (aparentemente cadastros novos sem numero definido)
-- receberam o proximo numero disponivel na turma, no final da lista.
-- Rode uma unica vez no SQL Editor do Supabase.
-- ============================================================================

update alunos as a set numero_chamada = v.numero
from (values
  ('b33bfa0d-615f-4532-a1b8-c538b5740d59'::uuid, 3), -- 6F / Charliel Meireles Castro
  ('d5b92345-7b01-4405-bec1-88eadd717761'::uuid, 27), -- 6F / Glidder Victor Ferreira Gutierrez
  ('5fce75f0-1084-4b96-b21c-45048a2da324'::uuid, 28), -- 6F / Valdilene Sobrinho da Silva
  ('4f63aee0-0a85-4b7a-90ae-38f70f9a3428'::uuid, 16), -- 7C / Ícaro Moura de Souza
  ('3dc8373d-0c39-4815-8e40-a1bb487e6b30'::uuid, 22), -- 7C / Junior da Silva Evangelista
  ('c4b48cf5-5a76-4773-9f15-238001df3a3c'::uuid, 30), -- 7D / Estefany Caroline Oliveira Rodrigues
  ('c6ac0bee-d838-45ca-8c20-d6687ccde1cb'::uuid, 10), -- 7D / Ester Maia Belon
  ('9657d772-5de9-4d54-aaf9-9908e1ecb3b0'::uuid, 12), -- 7D / Evelyn Vitoria das Neves Ribeiro
  ('75682e02-a563-4993-8a2d-ab35d34a4904'::uuid, 12), -- 7E / Jhoseph Hugo do Nascimento Marques da Silva
  ('946f137c-40b3-494e-bb00-5cbebb0d6075'::uuid, 2), -- 7F / Aghata Gabriele Teixeira Progenio
  ('342134c1-5f4d-4a32-9c05-d60f20b264d4'::uuid, 18), -- 7F / João Eduardo Soares Ramos
  ('f4cfa2da-5c04-4ed3-9ac6-20974e546d88'::uuid, 30), -- 7F / Mayara Cristinna Miranda de Souza
  ('dbd0efda-7dc5-42df-94cd-863c1601c7d5'::uuid, 21), -- 8C / Lorrane de Souza Araújo
  ('6e02fba6-7233-4896-9e4e-403edaaa2b37'::uuid, 33), -- 8C / Yasmim Vitória Bertoldo dos Santos
  ('7afd5f69-b511-405e-8d8d-56545b913e41'::uuid, 15), -- 8D / Julianna de Brito Rios
  ('1b97806e-bf34-4b0a-8483-347ad0ade67e'::uuid, 8), -- 8E / David Rodrigues da Silva
  ('56e0f2c8-67e7-4505-85d5-4854b45b2880'::uuid, 13), -- 8F / Kauanny de Paula Oliveira
  ('d4fc18d3-f91a-418d-9c17-67dc7ec706b8'::uuid, 16), -- 8F / Maria Isabel Alpire dos Santos
  ('3c35e002-a307-43f9-a871-1d111247d2d2'::uuid, 21), -- 8F / Tailon dos Santos Silva
  ('a258a231-5dcb-4d29-aabe-d5403b770799'::uuid, 22), -- 8F / Vitória Jaciara Silva Rodrigues
  ('caa7ff8e-e527-4bb3-8f62-aee7215cafc2'::uuid, 22), -- 9A / Kauã Henrique Lopes Goes
  ('420e4d8f-6620-4db7-b718-31033578108e'::uuid, 32), -- 9D / Fagner Renan Firmeza da Rocha
  ('a8463194-49fb-45e7-8f6e-bc8fe31a4d2a'::uuid, 9), -- 9D / Guilherme Antonio Oliveira Maia
  ('e1b918f2-394a-40b1-ae7b-485f5a94ab2c'::uuid, 20), -- 9D / Mateus Araújo dos Santos
  ('90dd4793-2cc8-4af3-b381-336ba50355ae'::uuid, 6), -- 9E / Claudyorran Rodrigues Lima
  ('f77818be-86f0-4679-80e9-6db51af45ff1'::uuid, 29), -- 9E / Emili Jamili Oliveira da Silva
  ('12ea8810-95f9-4300-9614-e229533e707e'::uuid, 7), -- 9E / Erislandia Silva Barbosa
  ('89c99db6-3d25-4360-9cb4-a9913cf5a695'::uuid, 8), -- 9E / Geliane da Silva Pacifico
  ('3bba3e68-6125-4f6b-9e74-02da3a24aaf7'::uuid, 9), -- 9E / Gustavo Santos Berkembrok
  ('f2f78573-966a-4260-935c-6af0d7e67c85'::uuid, 18), -- 9E / Marina Kiara Lopes Queiroz
  ('cd42fe91-f4f1-42b0-80cb-4ef0eb3b425f'::uuid, 30), -- 9E / Weidson Marcelo de Souza Pereira
  ('08576350-f8f9-4971-9e8b-64e6cde37d08'::uuid, 11), -- 9F / Emanuela Pereira Barbosa
  ('37e7750c-5ce1-4979-a7db-84f4b6f3d2a0'::uuid, 12), -- 9F / Fagner Renan Firmeza da Rocha
  ('7fe3f032-0cec-48e1-9cd8-f9ef83bd3456'::uuid, 32), -- 9F / Gabriel Nascimento Chavez
  ('655aace6-dffb-41b2-a4ac-3db1c13a6c56'::uuid, 17), -- 9F / João Gabriel Sousa Cardoso
  ('5c43db53-6775-4843-82f2-d405a703cda6'::uuid, 19), -- 9F / José Erivan Albuquerque Pinto
  ('96e7c27c-9bcc-4c3b-8759-514c01c76505'::uuid, 21), -- 9F / Kaila Kawany Lopes de Freitas
  ('22024599-e01c-4c7d-a75d-a4de0e36fb93'::uuid, 35), -- 7C / Rhomel Luiz Ribeiro Soares
  ('d6b519e0-d7b0-479b-8c29-fb99f80becaf'::uuid, 29), -- 7E / Yhago Ribeiro Schrakmann
  ('13c03159-00a5-4adf-80a2-ea4f143d0388'::uuid, 4), -- 7F / Aysha Biancatto Kruger
  ('8a2be26f-2a57-4c4f-8dae-96c234063c0b'::uuid, 33), -- 7E / Anna Heloisa Ribeiro Lopes
  ('5e3605d6-f2ec-40a7-93b7-e3c50d558bf7'::uuid, 34), -- 7F / Antonia Fernanda Pereira Freitas
  ('71797660-e10b-4bc6-be45-fa2f9151b3e9'::uuid, 37) -- 8C / Eliza Costa Alves
) as v(id, numero)
where a.id = v.id;
