-- ============================================================
-- KarlaReg — bloco Luna Notes
-- Uma linha só: a nota do ateliê, para acompanhar a Karla em
-- qualquer aparelho em vez de ficar presa a um navegador.
-- Rode no SQL Editor uma vez.
-- ============================================================

create table if not exists public.notas (
  id           text primary key,
  html         text not null default '',
  atualizado_em timestamptz not null default now()
);

insert into public.notas (id, html)
values ('luna', '')
on conflict (id) do nothing;

alter table public.notas enable row level security;

-- mesmo modo do resto do caderno: aberto para quem tiver o link
drop policy if exists "notas leitura"  on public.notas;
drop policy if exists "notas escrita"  on public.notas;

create policy "notas leitura" on public.notas for select
  to anon, authenticated using (true);
create policy "notas escrita" on public.notas for all
  to anon, authenticated using (true) with check (true);
