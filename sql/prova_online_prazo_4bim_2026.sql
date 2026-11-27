-- ============================================================================
-- Liga a regra de atraso nas provas online do 4º Bimestre de 2026.
-- Rode DEPOIS de prova_online_prazo_atraso.sql.
--
-- Prazo para 100%: terça, 08/12/2026, 23:59 no Acre (UTC-5).
-- Faixas (padrão da coluna): +1 dia 80% | +2 dias 60% | +3 dias 50% | depois
-- disso (sábado, 12/12) a prova não aceita envio.
--
-- Não altera respostas nem notas já gravadas. Só preenche provas sem prazo.
-- Para os próximos bimestres não precisa de SQL: use o botão
-- "Prazo e descontos" em Provas Online.
-- ============================================================================

update provas
   set prazo_integral = timestamptz '2026-12-08 23:59:00-05'
 where titulo ~* '4\s*[º°o]?\s*bim'
   and titulo like '%2026%'
   and prazo_integral is null;

-- Conferência: deve listar as provas do 4º bimestre com 08/12/2026 23:59.
select titulo, codigo,
       to_char(prazo_integral at time zone 'America/Rio_Branco', 'DD/MM/YYYY HH24:MI') as prazo_acre,
       faixas_atraso
  from provas
 where titulo ~* '4\s*[º°o]?\s*bim'
 order by titulo;
