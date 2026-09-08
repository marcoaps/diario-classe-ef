-- ============================================================================
-- Interclasses IOP — ativa modalidade/categoria em interclasses_inscricoes
-- Rode DEPOIS de interclasses_inscricoes.sql e interclasses_inscricoes_publico.sql,
-- no SQL Editor do Supabase.
-- ============================================================================

-- 1) modalidade: preenche o que já existe como 'futsal' (única modalidade até
--    hoje), depois trava default + not null + valores permitidos.
update interclasses_inscricoes set modalidade = 'futsal' where modalidade is null;

alter table interclasses_inscricoes alter column modalidade set default 'futsal';
alter table interclasses_inscricoes alter column modalidade set not null;

alter table interclasses_inscricoes drop constraint if exists interclasses_modalidade_check;
alter table interclasses_inscricoes
  add constraint interclasses_modalidade_check
  check (modalidade in ('futsal', 'voleibol', 'handebol', 'queimada'));

-- 2) categoria: deriva automaticamente da turma (6º/7º ou 8º/9º) — evita pedir
--    de novo uma informação que já dá pra inferir do cadastro existente.
update interclasses_inscricoes
  set categoria = case
    when turma_id ~ '^[67]' then '6º e 7º anos'
    when turma_id ~ '^[89]' then '8º e 9º anos'
    else categoria
  end
  where categoria is null;

-- 3) Corrige os índices únicos: hoje só consideram (edicao), então impediriam
--    um aluno de se inscrever em duas modalidades diferentes, ou dois times de
--    modalidades diferentes usando o mesmo número de camisa. Precisam
--    considerar (edicao, modalidade) pra isolar de verdade.
drop index if exists uq_interclasses_aluno_edicao;
create unique index if not exists uq_interclasses_aluno_edicao_modalidade
  on interclasses_inscricoes(edicao, modalidade, aluno_id) where aluno_id is not null;

drop index if exists uq_interclasses_time_camisa;
create unique index if not exists uq_interclasses_time_camisa_modalidade
  on interclasses_inscricoes(edicao, modalidade, lower(trim(nome_time)), numero_camisa);

create index if not exists idx_interclasses_edicao_modalidade
  on interclasses_inscricoes(edicao, modalidade);
