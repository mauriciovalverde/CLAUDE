-- Anexos dos comunicados no balde privado: destinatários leem os anexos do comunicado que receberam.
create policy rest_priv_com_sel on storage.objects for select to authenticated using (bucket_id = 'rest-privado' and rest_com_pode_ler_anexo(name));
