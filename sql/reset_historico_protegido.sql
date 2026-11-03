-- Reset Histórico protegido por PIN de administrador, validado NO SERVIDOR.
-- Rode no SQL Editor do Supabase, na ordem dos passos. O arquivo inteiro é seguro de rodar:
-- sem o passo 2 o reset fica bloqueado (a função responde "PIN não definido").

-- ── Passo 1: tabela do PIN + função que apaga ─────────────────────────────────
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_config (
  id            int primary key default 1 check (id = 1),
  pin_hash      text,
  falhas        int not null default 0,
  bloqueado_ate timestamptz
);
alter table public.admin_config enable row level security;
-- Sem policy e sem privilégio: o app nunca lê nem grava aqui; só a função abaixo.
revoke all on public.admin_config from anon, authenticated;

-- Retorna: n >= 0 = registros apagados | -1 PIN errado | -2 bloqueado (5 erros = 15 min)
--          -3 PIN ainda não definido    | -4 sem login
create or replace function public.resetar_notas(p_pin text, p_turma text default null)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cfg      public.admin_config%rowtype;
  apagadas integer;
begin
  if auth.uid() is null then return -4; end if;

  select * into cfg from public.admin_config where id = 1 for update;
  if not found or cfg.pin_hash is null then return -3; end if;
  if cfg.bloqueado_ate is not null and cfg.bloqueado_ate > now() then return -2; end if;

  if p_pin is null or cfg.pin_hash <> crypt(p_pin, cfg.pin_hash) then
    update public.admin_config
       set falhas        = case when falhas + 1 >= 5 then 0 else falhas + 1 end,
           bloqueado_ate = case when falhas + 1 >= 5 then now() + interval '15 minutes' else bloqueado_ate end
     where id = 1;
    return -1;
  end if;

  update public.admin_config set falhas = 0, bloqueado_ate = null where id = 1;

  if p_turma is null then
    delete from public.notas where bimestre >= 0;
  else
    delete from public.notas where turma = p_turma;
  end if;
  get diagnostics apagadas = row_count;
  return apagadas;
end;
$$;

revoke all on function public.resetar_notas(text, text) from public, anon;
grant execute on function public.resetar_notas(text, text) to authenticated;

-- ── Passo 2: defina o SEU PIN (troque o texto e rode só este comando) ─────────
-- insert into public.admin_config (id, pin_hash)
-- values (1, extensions.crypt('TROQUE-PELO-SEU-PIN', extensions.gen_salt('bf')))
-- on conflict (id) do update
--   set pin_hash = excluded.pin_hash, falhas = 0, bloqueado_ate = null;

-- ── Passo 3: o que torna a proteção real ──────────────────────────────────────
-- Tira o DELETE direto na tabela notas. Só tela de Reset apagava notas (o resto do app só
-- faz upsert), então nada mais quebra; a função acima continua apagando (roda como dono).
revoke delete on public.notas from anon, authenticated;
