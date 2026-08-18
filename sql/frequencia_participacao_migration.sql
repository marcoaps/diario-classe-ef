-- Adiciona o campo de participação nas atividades de quadra à tabela de
-- frequência (checklist de atividades: Fez / Fez em parte / Não fez).
-- Valores esperados: 'fez', 'fez_em_parte', 'nao_fez', ou NULL (aluno
-- ausente, ou registro antigo anterior a esta funcionalidade).

alter table frequencia add column if not exists participacao text;

alter table frequencia drop constraint if exists frequencia_participacao_check;
alter table frequencia add constraint frequencia_participacao_check
  check (participacao is null or participacao in ('fez', 'fez_em_parte', 'nao_fez'));
