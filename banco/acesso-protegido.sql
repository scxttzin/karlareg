-- ============================================================
-- KarlaReg — acesso protegido
-- Visitantes leem, curtem e comentam; só quem estiver logada
-- cria, edita e exclui criações.
-- Rode no SQL Editor quando quiser fechar o caderno de novo.
-- (Depois disso é preciso criar o usuário em Authentication > Users
--  e me pedir a tela de login no caderno.)
-- ============================================================

drop policy if exists "acervo aberto criacoes" on public.criacoes;
drop policy if exists "acervo aberto fotos"    on public.fotos;
drop policy if exists "acervo aberto tags"     on public.tags;

create policy "acervo escrita criacoes" on public.criacoes for all
  to authenticated using (true) with check (true);
create policy "acervo escrita fotos" on public.fotos for all
  to authenticated using (true) with check (true);
create policy "acervo escrita tags" on public.tags for all
  to authenticated using (true) with check (true);

drop policy if exists "comentario aberto apagar" on public.comentarios;
create policy "dona apaga comentario" on public.comentarios for delete
  to authenticated using (true);

drop policy if exists "fotos escrita aberta"  on storage.objects;
drop policy if exists "fotos troca aberta"    on storage.objects;
drop policy if exists "fotos exclusao aberta" on storage.objects;

create policy "fotos escrita autenticada" on storage.objects for insert
  to authenticated with check (bucket_id = 'criacoes');
create policy "fotos troca autenticada" on storage.objects for update
  to authenticated using (bucket_id = 'criacoes');
create policy "fotos exclusao autenticada" on storage.objects for delete
  to authenticated using (bucket_id = 'criacoes');
