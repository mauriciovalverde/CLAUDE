-- Arquivos sensíveis do ponto (selfies, foto da ficha, atestados): balde privado separado.
-- Caminho: {restaurante}/{funcionario}/{tipo}/arquivo — o empregado só lê/grava a própria pasta; o administrador lê tudo do restaurante.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rest-privado', 'rest-privado', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;
create policy rest_priv_sel on storage.objects for select to authenticated using (bucket_id = 'rest-privado' and (storage.foldername(name))[1] = rest_meu_restaurante()::text and ((storage.foldername(name))[2] = rest_meu_funcionario()::text or rest_pode('admin')));
create policy rest_priv_ins on storage.objects for insert to authenticated with check (bucket_id = 'rest-privado' and (storage.foldername(name))[1] = rest_meu_restaurante()::text and ((storage.foldername(name))[2] = rest_meu_funcionario()::text or rest_pode('admin')));
