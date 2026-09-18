-- Adiciona CID/Diagnóstico e situação de transferência à tabela de alunos
-- especiais, e atualiza os dados com a "Relação de alunos especiais — 18
-- turmas" (fonte: relação de 28/08/2026, 75 alunos).
--
-- Rode este script inteiro no SQL Editor do Supabase (a anon key do app não
-- tem permissão de ALTER TABLE nem, de forma confiável, de UPDATE nessa
-- tabela).

ALTER TABLE alunos_especiais ADD COLUMN IF NOT EXISTS cid_diagnostico text;
ALTER TABLE alunos_especiais ADD COLUMN IF NOT EXISTS transferido boolean NOT NULL DEFAULT false;

-- 6ºF
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F 90 (TDAH) + CID 11 6A05.2 (TDAH DO TIPO COMBINADO) 014.015367.00184/2026-97/Indeferido.' WHERE id = 'b6276a24-059c-41e2-a3dd-9105581433b2';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F 90 (TDAH), F 81.0 (Dislexia) 0014.015367.00227/2026-34/ Indeferido.' WHERE id = '94028559-d7ce-4a80-8390-1f9570211e3d';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F 90.1 (TDAH) E CID 10 F91.3 (TOD) 014.015367.00184/2026-97/Indeferido.' WHERE id = '74249dcb-4448-4ce5-b1f6-bc687717b57d';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10/CID 11/DSM-5 F84.0 (TEA) + F 79 (DI). 0014.018186.00001/2026-78/ Deferido mediador' WHERE id = '59f319bd-ca5d-4b5b-bbcc-afdebe982ee9';
-- Aluno novo (não estava cadastrado ainda) — nome conferido com a lista oficial de matrícula (turma 6ºF, nº 30): "Guilhermy Menezes Teixeira".
INSERT INTO alunos_especiais (nome, turma_id, cid_diagnostico, transferido) VALUES ('Guilhermy Menezes Teixeira', '6F', 'F 90 (TDAH)', false);

-- 7ºB
UPDATE alunos_especiais SET cid_diagnostico = 'Baixa visão' WHERE id = '8280c975-0127-45eb-ba2c-9e9831f548fc';
UPDATE alunos_especiais SET cid_diagnostico = 'F 90 (TDAH) 0014.015367.01069/2025-59/ Indeferido' WHERE id = '87aedf7b-622a-4de4-9436-bb21d5fd5f13';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 G93.4 (encefalopatia) 0014.015367.01069/2025-59/ Deferido para assistente educacional' WHERE id = '8ee155c6-c901-4339-9066-c60f9e352c28';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F 90 (TDAH). 0014.015367.01069/2025-59/ Indeferido' WHERE id = '4e717b1b-d160-478f-abe2-a9c5c61bf2eb';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA) 0014.015367.01069/2025-59. Deferido para mediador.' WHERE id = 'ac1992bf-352f-4bad-8d67-d643f1f2c508';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA), F 90 (TDAH). 0014.015367.01069/2025-59 deferido para professor mediador.' WHERE id = 'b70502ea-0301-484e-b821-971b20c69bd8';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F 90 (TDAH), F 81.0 (Dislexia) 0014.015367.00744/2025-22 Indeferido para mediador.' WHERE id = '7dec8c2b-7a05-4f8c-9dbf-0dbaded9081e';

-- 7ºC
UPDATE alunos_especiais SET cid_diagnostico = 'CID: 10 M 54 0014.015367.00227/2026-34 acompanhamento por assistente educacional' WHERE id = 'fbee1613-964a-4502-ae11-0e5b116d9562';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10: F 79 e 11 6A00 0014.015367.00200/2025-61 Indeferido para mediador.' WHERE id = 'f1f79b2c-7da5-4314-a045-b5ef6713f4ac';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F 90 (TDAH) SEI 0014.015367.00200/2025-61 Indeferido para mediador.', transferido = true WHERE id = '6867bcb9-5139-41b9-b0ea-87a2dfb65042';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA), F 90 (TDAH) SEI 0014.015367.00514/2025-63 Liberação de um professor mediador.' WHERE id = '9b0e8a36-3f17-46c1-9977-5786ad8386de';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA), F 90 (TDAH) 0014.015367.00200/2025-61 Indeferido para mediador.' WHERE id = '2b05d313-1ae8-459c-a8b3-036ccab1c095';

-- 7ºD
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA), F 90 (TDAH) 014.015367.00184/2026-97/ Favorável à liberação de mediador por agrupamento' WHERE id = '57d29d6f-d437-4275-97c4-ff8ae3899805';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F 90 (TDAH)' WHERE id = 'c57804a0-ce3a-4c9b-8938-fd94ec5d4613';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 H90 Surdo SEI 0014.015367.00200/2025-61 Favorável intérprete.' WHERE id = '8274e168-1227-4a01-a375-db1ee246351d';
UPDATE alunos_especiais SET cid_diagnostico = 'CID10 F 90 (TDAH) 0014.015367.01069/2025-59/ Deferido agrupamento' WHERE id = 'e585d201-5789-4849-9e9a-379accf116bd';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA), F 90 (TDAH)0014.015367.01069/2025-59/ Deferido agrupamento.' WHERE id = '3589f81b-5551-496a-a5d4-4e117f164e2b';

-- 7ºE
UPDATE alunos_especiais SET cid_diagnostico = 'Rel. pedagógico' WHERE id = 'eac73362-7d12-4ffb-bf32-5d6308cbc134';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA) SEI nº0018968874 AGRUPAMENTO' WHERE id = '53e13c12-94ad-4dbd-bf42-208bde430284';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA) SEI nº0018968874 Agrupamento.' WHERE id = 'cee173ab-2370-4f3e-8d6e-f1574c4ee548';
UPDATE alunos_especiais SET cid_diagnostico = 'Relatório pedagógico' WHERE id = 'd25f6c4b-4036-47c9-9594-4ce9fed807f1';
UPDATE alunos_especiais SET cid_diagnostico = 'CID10 F 90 (TDAH)' WHERE id = 'd2a1132e-8f20-48ed-ba72-0f51d8b9da78';

-- 7ºF
UPDATE alunos_especiais SET cid_diagnostico = 'Relatório pedagógico 0014.015367.00227/2026-34/ Deferido em agrupamento.' WHERE id = 'dbe986b3-c43e-4551-8b41-6ed903da4e10';
UPDATE alunos_especiais SET cid_diagnostico = 'Relatório pedagógico 0014.015367.00227/2026-34/ Deferido em agrupamento.' WHERE id = 'ba614224-2f15-4852-b557-e9d7beeb6f23';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA) 0014.015367.00200/2025-61 Indeferido para mediador.' WHERE id = 'ea3214a8-96ea-47f7-bfbd-7b9cc2fde8de';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F81 e CID 10 F90 (TDAH) 0014.018186.00001/2026-78/ Indeferido.' WHERE id = 'd23547ac-82f7-4dbc-ac62-9ebd3c68ac9e';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA) 0014.015367.00200/2025-61 Indeferido para mediador.' WHERE id = '8102f26c-4cd4-4725-8e8c-0a9670b87aae';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F 70 Deficiência Intelectual leve, teste de QI menor que 50. E Comorbidade Transtorno do Déficit de Atenção CID-10:F90.0, Tipo Desatento.', transferido = true WHERE id = '2eaba00a-4752-4d13-aa30-cf096ce31ef6';

-- 8ºA
UPDATE alunos_especiais SET cid_diagnostico = 'CID:10 F90.10 (TDAH)' WHERE id = 'faf8e25d-415e-4a61-97f6-5fa9054cfd48';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Espectro Autista (TEA); (TEA)F84. SEI 0014.015367.00200/2025-61 Favorável para agrupamento.' WHERE id = '50066062-2c7f-41d1-87ab-f44bbf2e5790';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA) SEI 0014.015367.00200/2025-61 Favorável para agrupamento.' WHERE id = '293a0069-403a-42e7-9e01-b132c2432e2d';
UPDATE alunos_especiais SET cid_diagnostico = 'BAIXA VISÃO' WHERE id = '98eae943-1d76-41b5-ab44-992c074496b6';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Espectro Autista (TEA); (TEA)F84 SEI 0014.015367.00200/2025-61 Favorável para agrupamento.' WHERE id = '8e5e0c0d-89c1-4b1c-94f0-17ecdef5b1f0';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Espectro Autista (TEA); Transtorno Opositor Desafiador (TOD) (Aguardando CID) SEI 0014.015367.00200/2025-61 Favorável para agrupamento.' WHERE id = '97f0077a-a4e7-4c06-a464-caa825a38f52';

-- 8ºB
UPDATE alunos_especiais SET cid_diagnostico = 'Estudo de Caso' WHERE id = '95a6965f-5639-4dd3-a2a0-d80e6d12121a';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Espectro Autista (TEA); (TEA)F84 0014.015367.01069/2025-59/ Deferido para assistente educacional' WHERE id = 'e121cdb2-11d8-48bc-a443-7cfa75872357';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno de Déficit de Atenção e Hiperatividade(TDAH) CID: F90.0 +F 81' WHERE id = '24f0a9b4-9835-4a82-acc6-3e0135425508';
UPDATE alunos_especiais SET cid_diagnostico = 'Baixa visão' WHERE id = 'e616d69c-0e7e-43e9-87be-cb17c5d3adcd';

-- 8ºC
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F70 Deficiência Intelectual e transtorno do neurodesenvolvimento. 0014.015367.00362/2025-07/ 0014.015367.00461/2025-81 Agrupamento.' WHERE id = 'e7d3faf5-d04b-4e76-8798-7c41e2ba45c2';
-- João Kaique de Lima Wellegas: sem registro de CID na relação — mantém cid_diagnostico em branco.

-- 8ºD
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Espectro Autista (TEA); (TEA)F84 SEI 0014.015367.00126/2024-00 DEFERIDO' WHERE id = '706a1b2e-faf3-4cf7-b72e-1437450519f3';
UPDATE alunos_especiais SET cid_diagnostico = 'F 90.2 (TDAH)' WHERE id = '8df6f86c-41a5-4514-898a-2135ba9870e9';

-- 8ºF
UPDATE alunos_especiais SET cid_diagnostico = 'CID:10 F84.0 AUTISTA SEI 0014.015367.01069/2025-59 deferido para mediador' WHERE id = '6dfe8663-59eb-4a4e-a46e-e14f86af0d31';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Espectro Autista (TEA); SEI 0014.015367.00170/2024-10 AGRUPAMENTO' WHERE id = '37dfd0b8-6e04-4e71-954c-00619ac91846';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Déficit de Atenção (TDA) CID 10F 41 SEI 0014.015367.01069/2025-59 indeferido', transferido = true WHERE id = 'a995fcb3-a7e8-4772-aedc-825926996bb5';

-- 9ºA
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Espectro Autista (TEA); (TEA)F84 SEI 0014.015367.00071/2023-49 DEFERIDO' WHERE id = '354c51a0-73c4-4360-a192-fb8ed42150d4';
UPDATE alunos_especiais SET cid_diagnostico = 'Relatório Pedagógico e Estudo de caso' WHERE id = 'a896d48f-64ba-4b81-8e56-f6871b1d592e';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Espectro Autista (TEA) Aguardando CID' WHERE id = 'a0f5b25f-4bb4-4318-aa51-7d94c331424c';
-- Maria Clara Cantuário de Oliveira estava cadastrada com turma_id '9C', mas a
-- relação atual e a lista de matrícula (numero_chamada 29) confirmam que ela
-- está na 9ºA — corrige a turma junto com o CID.
UPDATE alunos_especiais SET turma_id = '9A', cid_diagnostico = 'Dificuldade de locomoção CID S 86.0 0014.015367.01069/2025-59 Deferido' WHERE id = '5600d418-6ee8-4a2d-9222-e756a26a5e19';

-- 9ºB
UPDATE alunos_especiais SET cid_diagnostico = 'Deficiência Intelectual com Déficit Cognitivo e da Independência, Secundário a Encefalopatia de provável causa Genética.CID: F71,9 SEI 0014.015367.00170/2024-10 AGRUPAMENTO' WHERE id = '157bfc96-c15c-4d28-9a78-4c8e642ccf19';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno de Déficit de Atenção e Hiperatividade de Apresentação Combinada CID 10 F90.02 e Transtorno Específico da Aprendizagem com Prejuízo na Escrita e Leitura (CID 10 F81)' WHERE id = '9ecfb96c-8388-4d4c-9511-2f90ca9c73f8';
UPDATE alunos_especiais SET cid_diagnostico = 'CID:F84.0+G40,9+F71,9 0014.015367.01069/2025-59 Deferido para mediador.' WHERE id = '40d81124-05e6-4008-be0a-99fe04a28cc5';
UPDATE alunos_especiais SET cid_diagnostico = 'Relatório Pedagógico e Estudo de Caso.' WHERE id = 'e613e662-5f49-4525-8df2-114d0510fd98';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Déficit de Atenção e Hiperatividade com Transtorno Desafiador Opositor (TDAH e TDO) CID 10: F 90.0 0014.015367.01069/2025-59 indeferido para mediador.' WHERE id = '7e19ba06-426c-48fe-83d3-44e460916774';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Déficit de Atenção e Hiperatividade (TDAH)' WHERE id = '05ecbf6d-f8ca-4ffd-a8ab-307a743d02ba';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F 84.0+ F 90+F81.0 0014.015367.00966/2025-45 Agrupamento.' WHERE id = '4c9144a8-649e-4bce-9e67-8729513f0005';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Déficit de Atenção e Hiperatividade (TDAH tipo combinado CID 10F 90.0' WHERE id = '823f79b6-37e5-42cd-907a-b11a1ca7fab4';

-- 9ºC
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F 84.0 Transtorno do Espectro Autista (TEA), (TDAH)F90.9, F32.0, F 42.2 SEI 0014.015367.00158/2026-69 INDEFERIDO não recomendamos a liberação de professor mediador.' WHERE id = '027fe5de-6558-47b6-81f7-0a7b1b9a80d7';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Déficit de Atenção e aprendizagem 0014.015367.00184/2026-97 Deferido a liberação de professor mediador' WHERE id = '484ea51d-59d7-4a54-8ce9-eaaec90a68ab';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Déficit de Atenção CID-10:F90.0' WHERE id = '6fde9dac-fea9-4aa2-b0e3-6f0a4b6e10ed';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Déficit de Atenção e Hiperatividade (TDAH) CID10: F90.10 0014.015367.01069/2025-59 Indeferido' WHERE id = '7dcd8428-6d98-4c4d-95b5-545f8de34fcd';
UPDATE alunos_especiais SET cid_diagnostico = 'Encefalopatia Epiléptica com Difícil controle e Déficit Intelectual CIDs: 10. G409, G 80 e F 71.9 0014.015367.00933/2025-03- Deferido' WHERE id = '58fff1aa-6505-40fe-8ff4-da08f18cf8a7';

-- 9ºD
UPDATE alunos_especiais SET cid_diagnostico = 'Encefalopatia Crônica não Evolutiva com Deficiência Intelectual Moderada CID 10:F 71 ,9 0014.015367.01069/2025-59 Deferido' WHERE id = 'f24587f9-31c3-4d52-804e-842fb68d9cf0';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84 (TEA) 0014.015367.01069/2025-59 Deferido' WHERE id = '16d6161d-3450-4d79-8dd0-92c4fb9c61e5';
UPDATE alunos_especiais SET cid_diagnostico = 'EM INVESTIGAÇÃO CLÍNICA' WHERE id = '48b41ced-b3ce-460c-8a1e-ae10adcb9a47';

-- 9ºF
UPDATE alunos_especiais SET cid_diagnostico = 'CID:10 F90.10 0014.015367.00184/2026-97 não se recomenda a liberação de professor mediador' WHERE id = '453a5ed5-3e46-465b-ae71-9c092b6fafc6';
UPDATE alunos_especiais SET cid_diagnostico = 'Transtorno do Déficit de Atenção e Hiperatividade (TDAH) CID10: F90.10' WHERE id = '2962f597-64da-413f-b7db-a52e0c594a29';
UPDATE alunos_especiais SET cid_diagnostico = 'Investigação de Síndrome genética CID 10: Q87 e Q 21.1 0014.015367.01069/2025-59 Indeferido' WHERE id = 'cc095ce7-f681-4351-a6cf-180f9d10146c';
UPDATE alunos_especiais SET cid_diagnostico = 'Estudo de caso Deficit de atenção 0014.015367.01069/2025-59 Indeferido' WHERE id = 'eabf62b5-0914-49c9-8878-cd2542028665';
UPDATE alunos_especiais SET cid_diagnostico = 'CID 10 F84.0 e CID 10 F90 0056.012414.00145/2026-39 Deferido' WHERE id = '09785cd5-7ffd-4c92-8b2c-9b5013e2a8c4';
