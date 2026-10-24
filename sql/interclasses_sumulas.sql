-- Súmula virtual do Interclasses: um documento por jogo, com todos os eventos
-- (gols, faltas, cartões, pedidos de tempo, relógio). Cole no SQL Editor do Supabase.
-- O app grava com upsert e confere lendo de volta; sem esta tabela a súmula continua
-- funcionando, mas só fica guardada no aparelho.

create table if not exists interclasses_sumulas (
  jogo_id uuid primary key references interclasses_jogos(id) on delete cascade,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table interclasses_sumulas enable row level security;

drop policy if exists interclasses_sumulas_all on interclasses_sumulas;
create policy interclasses_sumulas_all on interclasses_sumulas
  for all to authenticated using (true) with check (true);

-- Leitura pública (anon) NÃO é liberada: a súmula é só do professor logado.
