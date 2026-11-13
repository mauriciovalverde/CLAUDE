-- Armazenamento privado das fotos (notas, pedidos) por restaurante e aviso em tempo real de novas solicitações.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rest-arquivos', 'rest-arquivos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;
create policy rest_arq_sel on storage.objects for select to authenticated using (bucket_id = 'rest-arquivos' and (storage.foldername(name))[1] = rest_meu_restaurante()::text);
create policy rest_arq_ins on storage.objects for insert to authenticated with check (bucket_id = 'rest-arquivos' and (storage.foldername(name))[1] = rest_meu_restaurante()::text);
alter publication supabase_realtime add table rest_solicitacoes;
