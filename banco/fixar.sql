-- ============================================================
-- KarlaReg — criação fixada
-- Rode no SQL Editor depois do schema.sql.
-- Só uma criação pode estar fixada por vez; o índice parcial abaixo
-- garante isso no banco, mesmo que dois navegadores tentem ao mesmo tempo.
-- ============================================================

alter table public.criacoes
  add column if not exists fixado boolean not null default false;

create unique index if not exists so_uma_fixada
  on public.criacoes (fixado)
  where fixado;
