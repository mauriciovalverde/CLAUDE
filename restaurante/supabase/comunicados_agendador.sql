-- Agendador: a cada 5 minutos o banco chama a função rest-push (envia agendados e lembretes).
-- Substitua <SEGREDO> pelo mesmo valor do segredo CRON_SECRET da função (gerado na instalação; não versionar).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('rest-comunicados', '*/5 * * * *', $$
  select net.http_post(url := 'https://llflvyfzhnuuvhvllvtb.supabase.co/functions/v1/rest-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<SEGREDO>'),
    body := '{"acao":"cron"}'::jsonb, timeout_milliseconds := 30000)
$$);
