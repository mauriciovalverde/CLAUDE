-- Ajustes de segurança do Gestor Financeiro. Cole no Supabase: SQL Editor → New query → Run. Pode rodar de novo sem problema.
-- Endurecimento de segurança (advisors do Supabase)
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.prokind='f' and p.proname <> 'rls_auto_enable' loop
    execute format('alter function %s set search_path = public, extensions', f.sig);
  end loop; end $$;
alter function obrigacao_agenda_trigger() security definer;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function enfileirar_agenda(uuid, text), rotina_diaria(), auditar(), obrigacao_agenda_trigger(), bloquear_delete() from authenticated;
do $$ begin
  if exists (select 1 from pg_proc where proname='rls_auto_enable' and pronamespace='public'::regnamespace) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if; end $$;
alter default privileges in schema public revoke execute on functions from public, anon;
-- Integrações: só colunas não sensíveis, só do próprio usuário
drop view if exists v_integracoes;
grant select (id, user_id, provedor, conta_email, status, ultimo_erro, atualizado_em) on integracoes to authenticated;
drop policy if exists integracoes_leitura on integracoes;
create policy integracoes_leitura on integracoes for select using (user_id = auth.uid());
create view v_integracoes with (security_invoker = true) as
  select id, provedor, conta_email, status, ultimo_erro, atualizado_em from integracoes;
grant select on v_integracoes to authenticated;
