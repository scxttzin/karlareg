-- ============================================================
-- KarlaReg — acesso aberto
-- Qualquer visitante pode criar, editar e excluir criações.
-- Rode no SQL Editor DEPOIS do schema.sql.
--
-- Para voltar ao modo protegido (só quem estiver logada escreve),
-- rode o arquivo acesso-protegido.sql.
-- ============================================================

-- ---------- acervo ----------
drop policy if exists "acervo escrita criacoes" on public.criacoes;
drop policy if exists "acervo escrita fotos"    on public.fotos;
drop policy if exists "acervo escrita tags"     on public.tags;

create policy "acervo aberto criacoes" on public.criacoes for all
  to anon, authenticated using (true) with check (true);
create policy "acervo aberto fotos" on public.fotos for all
  to anon, authenticated using (true) with check (true);
create policy "acervo aberto tags" on public.tags for all
  to anon, authenticated using (true) with check (true);

-- ---------- comentários ----------
drop policy if exists "dona apaga comentario" on public.comentarios;
create policy "comentario aberto apagar" on public.comentarios for delete
  to anon, authenticated using (true);

-- ---------- fotos no Storage ----------
drop policy if exists "fotos escrita autenticada"  on storage.objects;
drop policy if exists "fotos troca autenticada"    on storage.objects;
drop policy if exists "fotos exclusao autenticada" on storage.objects;

create policy "fotos escrita aberta" on storage.objects for insert
  to anon, authenticated with check (bucket_id = 'criacoes');
create policy "fotos troca aberta" on storage.objects for update
  to anon, authenticated using (bucket_id = 'criacoes');
create policy "fotos exclusao aberta" on storage.objects for delete
  to anon, authenticated using (bucket_id = 'criacoes');
