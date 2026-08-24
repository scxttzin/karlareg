-- ============================================================
-- KarlaReg — caderno de criações em cerâmica
-- Rode este arquivo uma vez no SQL Editor do projeto Supabase.
-- ============================================================

-- ---------- tabelas ----------
create table if not exists public.criacoes (
  id            uuid primary key default gen_random_uuid(),
  nome          text        not null,
  descricao     text        not null default '',
  anotacao      text        not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- até 6 por criação; ordem 0 é a capa
create table if not exists public.fotos (
  id         uuid primary key default gen_random_uuid(),
  criacao_id uuid not null references public.criacoes (id) on delete cascade,
  ordem      smallint not null default 0,
  url        text not null,
  nota       text not null default ''
);
create index if not exists fotos_por_criacao on public.fotos (criacao_id, ordem);

-- cor: 0 verde cinza, 1 vermelho vinho, 2 azul claro, 3 cinza claro
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  criacao_id uuid not null references public.criacoes (id) on delete cascade,
  chave      text not null,
  valor      text not null,
  cor        smallint not null default 0 check (cor between 0 and 3)
);
create index if not exists tags_por_criacao on public.tags (criacao_id);

create table if not exists public.comentarios (
  id         uuid primary key default gen_random_uuid(),
  criacao_id uuid not null references public.criacoes (id) on delete cascade,
  texto      text not null check (char_length(texto) between 1 and 45),
  criado_em  timestamptz not null default now()
);
create index if not exists comentarios_por_criacao on public.comentarios (criacao_id, criado_em);

-- uma curtida por visitante (sessão guardada no navegador dele)
create table if not exists public.curtidas (
  criacao_id uuid not null references public.criacoes (id) on delete cascade,
  sessao     text not null,
  criado_em  timestamptz not null default now(),
  primary key (criacao_id, sessao)
);

-- ---------- carimbo de atualização ----------
create or replace function public.marcar_atualizacao()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists criacoes_atualizadas on public.criacoes;
create trigger criacoes_atualizadas
  before update on public.criacoes
  for each row execute function public.marcar_atualizacao();

-- ---------- políticas de acesso ----------
-- Modelo adotado: qualquer pessoa lê, curte e comenta;
-- só quem estiver logada cria, edita e exclui criações.
alter table public.criacoes    enable row level security;
alter table public.fotos       enable row level security;
alter table public.tags        enable row level security;
alter table public.comentarios enable row level security;
alter table public.curtidas    enable row level security;

-- leitura pública
create policy "leitura publica criacoes"    on public.criacoes    for select using (true);
create policy "leitura publica fotos"       on public.fotos       for select using (true);
create policy "leitura publica tags"        on public.tags        for select using (true);
create policy "leitura publica comentarios" on public.comentarios for select using (true);
create policy "leitura publica curtidas"    on public.curtidas    for select using (true);

-- escrita do acervo: só autenticada
create policy "acervo escrita criacoes" on public.criacoes for all
  to authenticated using (true) with check (true);
create policy "acervo escrita fotos" on public.fotos for all
  to authenticated using (true) with check (true);
create policy "acervo escrita tags" on public.tags for all
  to authenticated using (true) with check (true);

-- visitante pode comentar e curtir
create policy "visitante comenta" on public.comentarios for insert
  to anon, authenticated with check (char_length(texto) between 1 and 45);
create policy "dona apaga comentario" on public.comentarios for delete
  to authenticated using (true);

create policy "visitante curte" on public.curtidas for insert
  to anon, authenticated with check (true);
create policy "visitante descurte" on public.curtidas for delete
  to anon, authenticated using (true);

-- ---------- fotos no Storage ----------
insert into storage.buckets (id, name, public)
values ('criacoes', 'criacoes', true)
on conflict (id) do nothing;

create policy "fotos leitura publica" on storage.objects for select
  using (bucket_id = 'criacoes');
create policy "fotos escrita autenticada" on storage.objects for insert
  to authenticated with check (bucket_id = 'criacoes');
create policy "fotos troca autenticada" on storage.objects for update
  to authenticated using (bucket_id = 'criacoes');
create policy "fotos exclusao autenticada" on storage.objects for delete
  to authenticated using (bucket_id = 'criacoes');

-- ---------- visão pronta para a galeria ----------
create or replace view public.criacoes_completas as
select
  c.*,
  coalesce((select count(*) from public.curtidas    k where k.criacao_id = c.id), 0) as likes,
  coalesce((select count(*) from public.comentarios m where m.criacao_id = c.id), 0) as total_comentarios
from public.criacoes c;
