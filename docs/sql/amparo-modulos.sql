-- AMPARO: Minhas Solicitações (+ Escola Inclusiva), Ouvidoria ampliada (direitos/fiscalização), Número Anjo e Painel de Impacto.
set check_function_bodies = off;

-- ===================================================================== MINHAS SOLICITAÇÕES (só a própria família acessa; nem a equipe lê)
create table if not exists public.sol_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area text not null check (area in ('saude','educacao','poder_publico')),
  tipo text not null check (length(tipo) between 2 and 60),
  titulo text not null check (length(titulo) between 3 and 140),
  orgao text check (length(orgao) <= 140),
  protocolo text check (length(protocolo) <= 80),
  aberta_em date not null default current_date,
  prazo date,
  status text not null default 'rascunho' check (status in ('rascunho','aguardando_protocolo','protocolado','em_analise','pendente','respondido','concluido')),
  notas text check (length(notas) <= 4000),
  documento text check (length(documento) <= 20000),       -- texto gerado pelos modelos da Escola Inclusiva
  modelo text check (length(modelo) <= 40),
  lembrete_dias int not null default 3 check (lembrete_dias between 0 and 30),
  lembrado_em date,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists sol_user on public.sol_solicitacoes (user_id, status, prazo);
alter table public.sol_solicitacoes enable row level security;
drop policy if exists "sol: só a própria família" on public.sol_solicitacoes;
create policy "sol: só a própria família" on public.sol_solicitacoes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.sol_eventos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.sol_solicitacoes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('criada','status','nota','resposta','reuniao','protocolo','anexo','prazo')),
  texto text check (length(texto) <= 4000),
  data date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.sol_eventos enable row level security;
drop policy if exists "sol eventos: própria família" on public.sol_eventos;
create policy "sol eventos: própria família" on public.sol_eventos for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.sol_solicitacoes s where s.id = solicitacao_id and s.user_id = auth.uid()));

create table if not exists public.sol_anexos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.sol_solicitacoes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null unique, nome text not null, mime text not null, tamanho int not null,
  created_at timestamptz not null default now()
);
alter table public.sol_anexos enable row level security;
drop policy if exists "sol anexos: própria família" on public.sol_anexos;
create policy "sol anexos: própria família" on public.sol_anexos for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and (storage.foldername(path))[1] = auth.uid()::text
              and exists (select 1 from public.sol_solicitacoes s where s.id = solicitacao_id and s.user_id = auth.uid()));

create or replace function public._sol_guarda() returns trigger language plpgsql as $$
begin
  new.user_id := coalesce(old.user_id, auth.uid()); new.atualizado_em := now();
  if tg_op = 'UPDATE' and new.prazo is distinct from old.prazo then new.lembrado_em := null; end if;
  return new;
end $$;
drop trigger if exists sol_guarda on public.sol_solicitacoes;
create trigger sol_guarda before insert or update on public.sol_solicitacoes for each row execute function public._sol_guarda();

-- Histórico automático: criação, mudança de situação e de protocolo
create or replace function public._sol_historico() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.sol_eventos(solicitacao_id, user_id, tipo, texto) values (new.id, new.user_id, 'criada', 'Solicitação criada');
  else
    if new.status is distinct from old.status then insert into public.sol_eventos(solicitacao_id, user_id, tipo, texto) values (new.id, new.user_id, 'status', new.status); end if;
    if new.protocolo is distinct from old.protocolo and new.protocolo is not null then insert into public.sol_eventos(solicitacao_id, user_id, tipo, texto) values (new.id, new.user_id, 'protocolo', 'Protocolo ' || new.protocolo); end if;
    if new.prazo is distinct from old.prazo and new.prazo is not null then insert into public.sol_eventos(solicitacao_id, user_id, tipo, texto) values (new.id, new.user_id, 'prazo', 'Prazo: ' || to_char(new.prazo, 'DD/MM/YYYY')); end if;
  end if;
  return new;
end $$;
drop trigger if exists sol_historico on public.sol_solicitacoes;
create trigger sol_historico after insert or update on public.sol_solicitacoes for each row execute function public._sol_historico();

-- Lembretes de prazo (chamado quando a família abre o app): avisa no sino uma vez por prazo
create or replace function public.sol_lembretes() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with alvo as (
    update public.sol_solicitacoes s set lembrado_em = current_date
    where s.user_id = auth.uid() and s.prazo is not null and s.status not in ('respondido','concluido','rascunho')
      and s.prazo - current_date <= s.lembrete_dias and s.lembrado_em is null
    returning s.id, s.titulo, s.prazo)
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
  select auth.uid(), case when prazo < current_date then 'Prazo vencido' else 'Prazo se aproximando' end,
         left(titulo, 100) || ' · ' || to_char(prazo, 'DD/MM/YYYY'), '/solicitacoes?s=' || id, 'lembretes' from alvo;
  get diagnostics n = row_count; return n;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('solicitacoes', 'solicitacoes', false, 20971520, array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "solicitacoes: própria pasta" on storage.objects;
create policy "solicitacoes: própria pasta" on storage.objects for all to authenticated
  using (bucket_id = 'solicitacoes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'solicitacoes' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===================================================================== OUVIDORIA AMPLIADA: categorias, órgão destinatário e protocolo oficial
alter table public.ouv_manifestacoes add column if not exists categoria text check (categoria in ('saude','educacao','assistencia','transporte','acessibilidade','discriminacao','atendimento','negativa','outras'));
alter table public.ouv_manifestacoes add column if not exists orgao_destino text check (length(orgao_destino) <= 160);
alter table public.ouv_manifestacoes add column if not exists canal_oficial text check (length(canal_oficial) <= 120);
alter table public.ouv_manifestacoes add column if not exists protocolo_oficial text check (length(protocolo_oficial) <= 80);
alter table public.ouv_manifestacoes add column if not exists encaminhado_oficial_em date;
alter table public.ouv_manifestacoes add column if not exists prazo_resposta date;
alter table public.ouv_eventos drop constraint if exists ouv_eventos_tipo_check;
alter table public.ouv_eventos add constraint ouv_eventos_tipo_check check (tipo in ('registro','analise','encaminhamento','complemento_solicitado','complemento','resposta','conclusao','encaminhamento_oficial','resposta_orgao'));

-- Categoria escolhida pelo cidadão logo após o registro (só uma vez, só o dono)
create or replace function public.ouv_categoria(_id uuid, _categoria text) returns void language sql security definer set search_path = public as $$
  update public.ouv_manifestacoes set categoria = _categoria where id = _id and user_id = auth.uid() and categoria is null;
$$;

-- Encaminhamento OFICIAL: só aparece como oficialmente encaminhada com protocolo do órgão OU comprovante de envio anexado.
create or replace function public.ouv_encaminhar_orgao(_id uuid, _orgao text, _canal text, _protocolo text, _data date, _prazo date, _mensagem text, _anexos jsonb default '[]') returns void
language plpgsql security definer set search_path = public as $$
declare m public.ouv_manifestacoes; ev uuid; n int; msg text;
begin
  if not public.is_staff(auth.uid()) then perform public.registrar_tentativa_negada('ouv_encaminhar_orgao'); return; end if;
  select * into m from public.ouv_manifestacoes where id = _id for update;
  if not found then raise exception 'Manifestação não encontrada.'; end if;
  if coalesce(trim(_orgao), '') = '' or coalesce(trim(_canal), '') = '' then raise exception 'Informe o órgão e o canal oficial usado.'; end if;
  if coalesce(trim(_protocolo), '') = '' and coalesce(jsonb_array_length(_anexos), 0) = 0 then
    raise exception 'Para registrar como encaminhada oficialmente, informe o protocolo do órgão ou anexe o comprovante de envio.'; end if;
  if _data is null or _data > current_date then raise exception 'Informe a data do envio (hoje ou antes).'; end if;
  msg := coalesce(nullif(trim(_mensagem), ''), 'Encaminhada oficialmente a ' || trim(_orgao) || ' por ' || trim(_canal) || coalesce(', protocolo ' || nullif(trim(_protocolo), ''), '') || '.');
  insert into public.ouv_eventos(manifestacao_id, tipo, setor_id, mensagem, autor_id, autor_papel) values (_id, 'encaminhamento_oficial', m.setor_id, msg, auth.uid(), 'equipe') returning id into ev;
  n := public._ouv_anexar(_id, ev, _anexos);
  update public.ouv_manifestacoes set status = 'encaminhada', orgao_destino = trim(_orgao), canal_oficial = trim(_canal), protocolo_oficial = nullif(trim(_protocolo), ''),
    encaminhado_oficial_em = _data, prazo_resposta = _prazo, atualizado_em = clock_timestamp() where id = _id;
  insert into public.logs_admin(autor_id, acao, alvo, detalhes) values (auth.uid(), 'ouvidoria_encaminhar_orgao', m.protocolo, trim(_orgao));
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (m.user_id, 'Encaminhada ao órgão responsável', m.protocolo || ' · ' || left(msg, 140), '/minhas-manifestacoes?p=' || m.id, 'sistema');
end $$;

-- Resposta recebida do órgão (texto + anexos), publicada na linha do tempo do cidadão
create or replace function public.ouv_resposta_orgao(_id uuid, _mensagem text, _anexos jsonb default '[]') returns void language plpgsql security definer set search_path = public as $$
declare m public.ouv_manifestacoes; ev uuid; n int;
begin
  if not public.is_staff(auth.uid()) then perform public.registrar_tentativa_negada('ouv_resposta_orgao'); return; end if;
  select * into m from public.ouv_manifestacoes where id = _id for update; if not found then raise exception 'Manifestação não encontrada.'; end if;
  if coalesce(trim(_mensagem), '') = '' then raise exception 'Resuma a resposta do órgão.'; end if;
  insert into public.ouv_eventos(manifestacao_id, tipo, setor_id, mensagem, autor_id, autor_papel) values (_id, 'resposta_orgao', m.setor_id, trim(_mensagem), auth.uid(), 'equipe') returning id into ev;
  n := public._ouv_anexar(_id, ev, _anexos);
  update public.ouv_manifestacoes set atualizado_em = clock_timestamp() where id = _id;
  insert into public.logs_admin(autor_id, acao, alvo) values (auth.uid(), 'ouvidoria_resposta_orgao', m.protocolo);
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (m.user_id, 'Resposta do órgão público', m.protocolo || ' · ' || left(trim(_mensagem), 140), '/minhas-manifestacoes?p=' || m.id, 'sistema');
end $$;

-- Vídeos e áudios também podem ser anexados (até 50 MB)
update storage.buckets set file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf','video/mp4','video/quicktime','video/webm','video/3gpp','audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/webm','audio/wav','audio/x-m4a']
where id = 'ouvidoria';

-- O cidadão também abre os arquivos que a equipe anexou à manifestação dele (comprovante, resposta do órgão)
drop policy if exists "ouvidoria: ler anexos da minha manifestação" on storage.objects;
create policy "ouvidoria: ler anexos da minha manifestação" on storage.objects for select to authenticated
  using (bucket_id = 'ouvidoria' and exists (select 1 from public.ouv_anexos a join public.ouv_manifestacoes m on m.id = a.manifestacao_id where a.path = name and m.user_id = auth.uid()));

-- ===================================================================== NÚMERO ANJO
create table if not exists public.anjo_contatos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (length(nome) between 2 and 80),
  telefone text not null check (telefone ~ '^[0-9]{10,13}$'),
  vinculo text check (length(vinculo) <= 40),
  prioridade int not null default 1 check (prioridade between 1 and 9),
  token uuid not null default gen_random_uuid() unique,
  confirmado_em timestamptz,
  created_at timestamptz not null default now()
);
alter table public.anjo_contatos enable row level security;
drop policy if exists "anjo: só o próprio" on public.anjo_contatos;
create policy "anjo: só o próprio" on public.anjo_contatos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace function public._anjo_guarda() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and current_setting('anjo.confirmando', true) = '1' then return new; end if;   -- confirmação pelo link público
  new.user_id := coalesce(old.user_id, auth.uid()); new.telefone := regexp_replace(new.telefone, '\D', '', 'g');
  if tg_op = 'UPDATE' then
    new.token := old.token;
    if new.telefone <> old.telefone then new.confirmado_em := null; new.token := gen_random_uuid(); else new.confirmado_em := old.confirmado_em; end if;
  else new.confirmado_em := null; new.token := gen_random_uuid(); end if;
  if tg_op = 'INSERT' and (select count(*) from public.anjo_contatos where user_id = auth.uid()) >= 5 then raise exception 'Máximo de 5 Números Anjo.'; end if;
  return new;
end $$;
drop trigger if exists anjo_guarda on public.anjo_contatos;
create trigger anjo_guarda before insert or update on public.anjo_contatos for each row execute function public._anjo_guarda();

-- Página pública de confirmação: o contato abre o link recebido e aceita ser Número Anjo.
create or replace function public.anjo_convite(_token uuid) returns table(quem text, contato text, confirmado boolean) language sql stable security definer set search_path = public as $$
  select coalesce(nullif(split_part(trim(p.nome_chamada), ' ', 1), ''), 'Uma família do AMPARO'), split_part(c.nome, ' ', 1), c.confirmado_em is not null
  from public.anjo_contatos c left join public.perfis p on p.id = c.user_id where c.token = _token
$$;
create or replace function public.anjo_confirmar(_token uuid, _aceito boolean) returns boolean language plpgsql security definer set search_path = public as $$
declare c public.anjo_contatos;
begin
  select * into c from public.anjo_contatos where token = _token; if not found then return false; end if;
  if _aceito then
    perform set_config('anjo.confirmando', '1', true);
    update public.anjo_contatos set confirmado_em = now() where id = c.id and confirmado_em is null;
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (c.user_id, 'Número Anjo confirmado', c.nome || ' aceitou ser seu Número Anjo.', '/anjo', 'sistema');
  else
    delete from public.anjo_contatos where id = c.id;
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (c.user_id, 'Convite de Número Anjo recusado', c.nome || ' preferiu não ser Número Anjo.', '/anjo', 'sistema');
  end if;
  return true;
end $$;
grant execute on function public.anjo_convite(uuid), public.anjo_confirmar(uuid, boolean) to anon, authenticated;

create table if not exists public.anjo_alertas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ativo' check (status in ('ativo','cancelado','encerrado')),
  compartilhou_local boolean not null default false,
  lat numeric(8,5), lng numeric(8,5),
  created_at timestamptz not null default now(),
  cancelado_em timestamptz
);
create table if not exists public.anjo_envios (
  id uuid primary key default gen_random_uuid(),
  alerta_id uuid not null references public.anjo_alertas(id) on delete cascade,
  contato_id uuid references public.anjo_contatos(id) on delete set null,
  contato_nome text not null,
  canal text not null check (canal in ('sms','whatsapp_api','whatsapp_manual')),
  status text not null check (status in ('aguardando_integracao','aberto_pelo_usuario','enviado','entregue','falhou','cancelado')),
  detalhe text,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.anjo_alertas enable row level security;
alter table public.anjo_envios enable row level security;
drop policy if exists "anjo alertas: próprio" on public.anjo_alertas;
create policy "anjo alertas: próprio" on public.anjo_alertas for select using (user_id = auth.uid());
drop policy if exists "anjo envios: próprio" on public.anjo_envios;
create policy "anjo envios: próprio" on public.anjo_envios for select using (exists (select 1 from public.anjo_alertas a where a.id = alerta_id and a.user_id = auth.uid()));

-- Acionar: registra o alerta e uma tentativa por contato CONFIRMADO. Sem provedor de SMS/WhatsApp configurado,
-- as tentativas ficam "aguardando integração" e o app oferece o envio manual pelo WhatsApp (marcado como "aberto pelo usuário", nunca como "recebido").
create or replace function public.anjo_acionar(_lat double precision default null, _lng double precision default null) returns uuid language plpgsql security definer set search_path = public as $$
declare aid uuid; integrado boolean := coalesce((select valor from public.configuracoes where chave = 'notificacoes_externas_ativas'), 'false') = 'true';
begin
  if auth.uid() is null then return null; end if;
  if not exists (select 1 from public.anjo_contatos where user_id = auth.uid() and confirmado_em is not null) then raise exception 'Nenhum Número Anjo confirmado ainda.'; end if;
  if exists (select 1 from public.anjo_alertas where user_id = auth.uid() and created_at > now() - interval '1 minute') then
    select id into aid from public.anjo_alertas where user_id = auth.uid() order by created_at desc limit 1; return aid; end if;   -- evita disparo duplo
  insert into public.anjo_alertas(user_id, compartilhou_local, lat, lng) values (auth.uid(), _lat is not null, round(_lat::numeric, 5), round(_lng::numeric, 5)) returning id into aid;
  insert into public.anjo_envios(alerta_id, contato_id, contato_nome, canal, status, detalhe)
  select aid, c.id, c.nome, 'whatsapp_api', 'aguardando_integracao', case when integrado then 'Na fila do provedor' else 'Envio automático ainda não configurado' end
  from public.anjo_contatos c where c.user_id = auth.uid() and c.confirmado_em is not null order by c.prioridade, c.created_at;
  return aid;
end $$;
create or replace function public.anjo_marcar_aberto(_envio uuid) returns void language sql security definer set search_path = public as $$
  update public.anjo_envios e set status = 'aberto_pelo_usuario', canal = 'whatsapp_manual', detalhe = 'WhatsApp aberto pelo usuário (a entrega não é confirmada)', atualizado_em = now()
  from public.anjo_alertas a where e.id = _envio and a.id = e.alerta_id and a.user_id = auth.uid() and e.status in ('aguardando_integracao','falhou');
$$;
create or replace function public.anjo_cancelar(_alerta uuid) returns void language sql security definer set search_path = public as $$
  update public.anjo_alertas set status = 'cancelado', cancelado_em = now() where id = _alerta and user_id = auth.uid() and status = 'ativo';
  update public.anjo_envios e set status = 'cancelado', atualizado_em = now() from public.anjo_alertas a
  where e.alerta_id = _alerta and a.id = _alerta and a.user_id = auth.uid() and e.status = 'aguardando_integracao';
$$;

-- ===================================================================== PAINEL DE IMPACTO (agregado e anonimizado; municípios com menos de 5 famílias aparecem como "< 5")
create or replace function public.impacto_painel(_de date default null, _ate date default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_de timestamptz := coalesce(_de, '2000-01-01')::timestamptz; v_ate timestamptz := (coalesce(_ate, current_date) + 1)::timestamptz; r jsonb;
begin
  if not public.is_staff(auth.uid()) then perform public.registrar_tentativa_negada('impacto_painel'); return null; end if;
  select jsonb_build_object(
    'familias', (select count(*) from public.familias where status = 'aprovado' and created_at < v_ate),
    'familias_novas', (select count(*) from public.familias where created_at >= v_de and created_at < v_ate),
    'nucleos', (select count(*) from public.rf_grupos where tipo = 'nucleo' and status = 'aprovado' and ativo),
    'grupos', (select count(*) from public.rf_grupos where tipo <> 'nucleo' and status = 'aprovado' and ativo),
    'na_rede', (select count(*) from public.rf_perfis where ativo),
    'conexoes', (select count(*) from public.rf_conexoes where status = 'aceita' and coalesce(respondida_em, created_at) >= v_de and coalesce(respondida_em, created_at) < v_ate),
    'encontros', (select count(*) from public.encontros where data >= v_de and data < v_ate),
    'solicitacoes', (select count(*) from public.ouv_manifestacoes where created_at >= v_de and created_at < v_ate),
    'respondidas', (select count(*) from public.ouv_manifestacoes where created_at >= v_de and created_at < v_ate and status in ('respondida','concluida')),
    'pendentes', (select count(*) from public.ouv_manifestacoes where created_at >= v_de and created_at < v_ate and status not in ('respondida','concluida')),
    'oficiais', (select count(*) from public.ouv_manifestacoes where created_at >= v_de and created_at < v_ate and encaminhado_oficial_em is not null),
    'prazo_vencido', (select count(*) from public.ouv_manifestacoes where prazo_resposta < current_date and status not in ('respondida','concluida')),
    'acompanhamentos', (select count(*) from public.sol_solicitacoes where created_at >= v_de and created_at < v_ate),
    'vagas', (select count(*) from public.cls_anuncios where categoria = 'emprego' and status in ('aprovado','encerrado') and created_at >= v_de and created_at < v_ate),
    'cupons_usados', (select count(*) from public.cls_cupom_usos where created_at >= v_de and created_at < v_ate),
    'parceiros', (select count(distinct user_id) from public.cls_anuncios where status = 'aprovado' and (destaque or verificado)),
    'anuncios_ativos', (select count(*) from public.cls_anuncios where status = 'aprovado' and validade >= current_date),
    'por_categoria', (select coalesce(jsonb_object_agg(coalesce(categoria, 'sem_categoria'), n), '{}') from (select categoria, count(*) n from public.ouv_manifestacoes where created_at >= v_de and created_at < v_ate group by 1) x),
    'municipios', (select coalesce(jsonb_agg(jsonb_build_object('municipio', z.municipio, 'familias', case when z.f < 5 then null else z.f end,
        'demandas', case when z.f < 5 then null else (select count(*) from public.ouv_manifestacoes m join public.familias f2 on f2.user_id = m.user_id where lower(trim(f2.cidade)) = z.k and m.created_at >= v_de and m.created_at < v_ate) end,
        'pendentes', case when z.f < 5 then null else (select count(*) from public.ouv_manifestacoes m join public.familias f2 on f2.user_id = m.user_id where lower(trim(f2.cidade)) = z.k and m.status not in ('respondida','concluida')) end,
        'na_rede', case when z.f < 5 then null else (select count(*) from public.rf_perfis rp where rp.ativo and lower(trim(rp.cidade)) = z.k) end) order by z.f desc), '[]')
      from (select lower(trim(cidade)) k, initcap(min(trim(cidade))) municipio, count(*) f from public.familias where status = 'aprovado' and coalesce(trim(cidade), '') <> '' group by 1) z)
  ) into r;
  insert into public.logs_admin(autor_id, acao, alvo) values (auth.uid(), 'impacto_consulta', coalesce(_de::text, '') || '..' || coalesce(_ate::text, ''));
  return r;
end $$;

grant execute on function public.sol_lembretes(), public.ouv_categoria(uuid, text), public.ouv_encaminhar_orgao(uuid, text, text, text, date, date, text, jsonb), public.ouv_resposta_orgao(uuid, text, jsonb),
  public.anjo_acionar(double precision, double precision), public.anjo_marcar_aberto(uuid), public.anjo_cancelar(uuid), public.impacto_painel(date, date) to authenticated;
revoke execute on function public.sol_lembretes(), public.ouv_categoria(uuid, text), public.ouv_encaminhar_orgao(uuid, text, text, text, date, date, text, jsonb), public.ouv_resposta_orgao(uuid, text, jsonb),
  public.anjo_acionar(double precision, double precision), public.anjo_marcar_aberto(uuid), public.anjo_cancelar(uuid), public.impacto_painel(date, date) from anon, public;
