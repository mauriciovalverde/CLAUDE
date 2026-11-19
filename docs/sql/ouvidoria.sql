-- Módulo de OUVIDORIA: manifestações do cidadão com anexos, localização, protocolo e acompanhamento.
-- Segurança: o cidadão só lê as próprias manifestações, eventos públicos e anexos; notas internas e painel só para a equipe.

-- ===================================================================== Setores
create table if not exists public.ouv_setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.ouv_setores(nome) values
  ('Ouvidoria'), ('Acolhimento e SOS'), ('Psicologia'), ('Assistência Social'), ('Direitos e BPC'),
  ('Saúde'), ('Educação Inclusiva'), ('Tecnologia do App'), ('Administração')
on conflict (nome) do nothing;
alter table public.ouv_setores enable row level security;
drop policy if exists "setores: ler" on public.ouv_setores;
create policy "setores: ler" on public.ouv_setores for select using (auth.uid() is not null);
drop policy if exists "setores: admin" on public.ouv_setores;
create policy "setores: admin" on public.ouv_setores for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ===================================================================== Manifestações
create table if not exists public.ouv_contadores (ano int primary key, ultimo int not null default 0);
alter table public.ouv_contadores enable row level security;

create table if not exists public.ouv_manifestacoes (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  chave uuid not null,                                  -- idempotência: o mesmo envio repetido devolve o mesmo protocolo
  tipo text not null check (tipo in ('denuncia','reclamacao','solicitacao','sugestao','elogio')),
  assunto text not null check (length(assunto) between 3 and 140),
  descricao text not null check (length(descricao) between 10 and 5000),
  endereco text check (length(endereco) <= 300),
  referencia text check (length(referencia) <= 300),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  precisao_m double precision,
  loc_origem text check (loc_origem in ('gps','mapa')),
  loc_capturada_em timestamptz,
  status text not null default 'recebida' check (status in ('recebida','em_analise','encaminhada','aguardando_complemento','respondida','concluida')),
  setor_id uuid references public.ouv_setores(id),
  resposta text,                                        -- última resposta pública da Ouvidoria (destaque)
  respondida_em timestamptz,
  atualizado_em timestamptz not null default now(),     -- última novidade PÚBLICA
  visto_em timestamptz,                                 -- quando o cidadão abriu pela última vez
  created_at timestamptz not null default now(),
  unique (user_id, chave),
  check ((lat is null) = (lng is null))
);
create index if not exists ouv_man_user on public.ouv_manifestacoes (user_id, created_at desc);
create index if not exists ouv_man_fila on public.ouv_manifestacoes (status, setor_id, created_at desc);
alter table public.ouv_manifestacoes enable row level security;
drop policy if exists "manif: dono ou equipe" on public.ouv_manifestacoes;
create policy "manif: dono ou equipe" on public.ouv_manifestacoes for select using (user_id = auth.uid() or public.is_staff(auth.uid()));
-- sem insert/update/delete direto: tudo passa pelas funções abaixo

create table if not exists public.ouv_eventos (
  id uuid primary key default gen_random_uuid(),
  manifestacao_id uuid not null references public.ouv_manifestacoes(id) on delete cascade,
  tipo text not null check (tipo in ('registro','analise','encaminhamento','complemento_solicitado','complemento_enviado','resposta','conclusao')),
  setor_id uuid references public.ouv_setores(id),
  mensagem text,                                        -- texto PÚBLICO (o cidadão vê)
  autor_id uuid,
  autor_papel text not null check (autor_papel in ('cidadao','equipe')),
  created_at timestamptz not null default now()
);
create index if not exists ouv_ev_man on public.ouv_eventos (manifestacao_id, created_at);
alter table public.ouv_eventos enable row level security;
drop policy if exists "eventos: dono ou equipe" on public.ouv_eventos;
create policy "eventos: dono ou equipe" on public.ouv_eventos for select using (
  public.is_staff(auth.uid()) or exists (select 1 from public.ouv_manifestacoes m where m.id = manifestacao_id and m.user_id = auth.uid()));

create table if not exists public.ouv_notas_internas (
  id uuid primary key default gen_random_uuid(),
  manifestacao_id uuid not null references public.ouv_manifestacoes(id) on delete cascade,
  evento_id uuid references public.ouv_eventos(id) on delete set null,
  texto text not null check (length(texto) between 1 and 5000),
  autor_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.ouv_notas_internas enable row level security;
drop policy if exists "notas: equipe" on public.ouv_notas_internas;
create policy "notas: equipe" on public.ouv_notas_internas for select using (public.is_staff(auth.uid()));

create table if not exists public.ouv_anexos (
  id uuid primary key default gen_random_uuid(),
  manifestacao_id uuid not null references public.ouv_manifestacoes(id) on delete cascade,
  evento_id uuid references public.ouv_eventos(id) on delete set null,
  path text not null unique,
  nome text not null,
  mime text not null,
  tamanho int not null,
  enviado_por uuid not null,
  created_at timestamptz not null default now()
);
alter table public.ouv_anexos enable row level security;
drop policy if exists "anexos: dono ou equipe" on public.ouv_anexos;
create policy "anexos: dono ou equipe" on public.ouv_anexos for select using (
  public.is_staff(auth.uid()) or exists (select 1 from public.ouv_manifestacoes m where m.id = manifestacao_id and m.user_id = auth.uid()));

revoke all on public.ouv_manifestacoes, public.ouv_eventos, public.ouv_notas_internas, public.ouv_anexos, public.ouv_contadores, public.ouv_setores from anon;
revoke insert, update, delete on public.ouv_manifestacoes, public.ouv_eventos, public.ouv_notas_internas, public.ouv_anexos, public.ouv_contadores from authenticated;

-- ===================================================================== Arquivos (bucket privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ouvidoria', 'ouvidoria', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "ouvidoria: enviar na propria pasta" on storage.objects;
create policy "ouvidoria: enviar na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'ouvidoria' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "ouvidoria: ler" on storage.objects;
create policy "ouvidoria: ler" on storage.objects for select to authenticated
  using (bucket_id = 'ouvidoria' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff(auth.uid())));
drop policy if exists "ouvidoria: remover rascunho" on storage.objects;
create policy "ouvidoria: remover rascunho" on storage.objects for delete to authenticated
  using (bucket_id = 'ouvidoria' and (storage.foldername(name))[1] = auth.uid()::text
         and not exists (select 1 from public.ouv_anexos a where a.path = name));

-- ===================================================================== Funções internas
create or replace function public._ouv_anexar(_man uuid, _evento uuid, _anexos jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare a jsonb; n int := 0; p text;
begin
  for a in select * from jsonb_array_elements(coalesce(_anexos, '[]'::jsonb)) loop
    p := a->>'path';
    if p is null or split_part(p, '/', 1) <> auth.uid()::text then raise exception 'Anexo inválido.'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'ouvidoria' and o.name = p) then raise exception 'Um anexo não terminou de enviar. Tente de novo.'; end if;
    insert into public.ouv_anexos(manifestacao_id, evento_id, path, nome, mime, tamanho, enviado_por)
      values (_man, _evento, p, left(coalesce(a->>'nome', 'arquivo'), 200), coalesce(a->>'mime', 'application/octet-stream'), coalesce((a->>'tamanho')::int, 0), auth.uid())
      on conflict (path) do nothing;
    n := n + 1;
  end loop;
  if n > 10 then raise exception 'Máximo de 10 anexos por envio.'; end if;
  return n;
end $$;

-- ===================================================================== Cidadão
create or replace function public.ouv_registrar(_chave uuid, _tipo text, _assunto text, _descricao text, _endereco text, _referencia text,
  _lat double precision, _lng double precision, _precisao double precision, _loc_origem text, _loc_em timestamptz, _anexos jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.ouv_manifestacoes; _ano int := extract(year from now() at time zone 'America/Bahia'); seq int; ev uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para registrar.'; end if;
  select * into m from public.ouv_manifestacoes where user_id = auth.uid() and chave = _chave;
  if found then  -- toque duplo ou reenvio após queda: devolve o mesmo protocolo
    return jsonb_build_object('id', m.id, 'protocolo', m.protocolo, 'created_at', m.created_at, 'status', m.status, 'repetido', true);
  end if;
  if (select count(*) from public.ouv_manifestacoes where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Muitos registros em pouco tempo. Aguarde um pouco.';
  end if;
  insert into public.ouv_contadores(ano, ultimo) values (_ano, 1) on conflict (ano) do update set ultimo = public.ouv_contadores.ultimo + 1 returning ultimo into seq;
  insert into public.ouv_manifestacoes(protocolo, user_id, chave, tipo, assunto, descricao, endereco, referencia, lat, lng, precisao_m, loc_origem, loc_capturada_em)
    values ('OUV-' || _ano || '-' || lpad(seq::text, 6, '0'), auth.uid(), _chave, _tipo, trim(_assunto), trim(_descricao),
            nullif(trim(coalesce(_endereco, '')), ''), nullif(trim(coalesce(_referencia, '')), ''),
            _lat, _lng, case when _lat is null then null else _precisao end, case when _lat is null then null else _loc_origem end,
            case when _lat is null then null else coalesce(_loc_em, now()) end)
    returning * into m;
  insert into public.ouv_eventos(manifestacao_id, tipo, mensagem, autor_id, autor_papel)
    values (m.id, 'registro', 'Manifestação recebida pela Ouvidoria.', auth.uid(), 'cidadao') returning id into ev;
  perform public._ouv_anexar(m.id, ev, _anexos);
  update public.ouv_manifestacoes set visto_em = now() where id = m.id;
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
    select ur.user_id, 'Nova manifestação na Ouvidoria', m.protocolo || ' · ' || m.assunto, '/admin?aba=ouvidoria', 'sistema'
    from public.user_roles ur where ur.role in ('admin','equipe');
  return jsonb_build_object('id', m.id, 'protocolo', m.protocolo, 'created_at', m.created_at, 'status', m.status, 'repetido', false);
end $$;

create or replace function public.ouv_minhas()
returns table(id uuid, protocolo text, tipo text, assunto text, status text, setor text, created_at timestamptz, atualizado_em timestamptz, nao_lida boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.protocolo, m.tipo, m.assunto, m.status, s.nome, m.created_at, m.atualizado_em, m.atualizado_em > coalesce(m.visto_em, 'epoch')
  from public.ouv_manifestacoes m left join public.ouv_setores s on s.id = m.setor_id
  where m.user_id = auth.uid() order by m.atualizado_em desc
$$;

create or replace function public.ouv_marcar_vista(_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.ouv_manifestacoes set visto_em = now() where id = _id and user_id = auth.uid()
$$;

create or replace function public.ouv_complementar(_id uuid, _mensagem text, _anexos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare m public.ouv_manifestacoes; ev uuid;
begin
  select * into m from public.ouv_manifestacoes where id = _id for update;
  if not found or m.user_id <> auth.uid() then perform public.registrar_tentativa_negada('ouv_complementar'); return; end if;
  if m.status <> 'aguardando_complemento' then raise exception 'Este protocolo não está aguardando complementação.'; end if;
  if length(trim(coalesce(_mensagem, ''))) < 3 and jsonb_array_length(coalesce(_anexos, '[]')) = 0 then raise exception 'Escreva a complementação ou anexe um arquivo.'; end if;
  insert into public.ouv_eventos(manifestacao_id, tipo, mensagem, autor_id, autor_papel)
    values (_id, 'complemento_enviado', nullif(trim(coalesce(_mensagem, '')), ''), auth.uid(), 'cidadao') returning id into ev;
  perform public._ouv_anexar(_id, ev, _anexos);
  update public.ouv_manifestacoes set status = 'em_analise', visto_em = now(), atualizado_em = now() where id = _id;
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
    select ur.user_id, 'Complementação recebida', m.protocolo, '/admin?aba=ouvidoria', 'sistema' from public.user_roles ur where ur.role in ('admin','equipe');
end $$;

-- ===================================================================== Equipe
create or replace function public.ouv_fila(_busca text default null, _tipo text default null, _status text default null, _setor uuid default null,
  _de date default null, _ate date default null)
returns table(id uuid, protocolo text, tipo text, assunto text, status text, setor_id uuid, setor text, created_at timestamptz,
              tem_local boolean, anexos int, cidadao text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then perform public.registrar_tentativa_negada('ouv_fila'); return; end if;
  return query
    select m.id, m.protocolo, m.tipo, m.assunto, m.status, m.setor_id, s.nome, m.created_at, m.lat is not null,
           (select count(*)::int from public.ouv_anexos a where a.manifestacao_id = m.id),
           coalesce(f.mae_nome, p.nome_chamada, 'Cidadão')
    from public.ouv_manifestacoes m
    left join public.ouv_setores s on s.id = m.setor_id
    left join public.familias f on f.user_id = m.user_id
    left join public.perfis p on p.id = m.user_id
    where (_busca is null or m.protocolo ilike '%' || trim(_busca) || '%' or m.assunto ilike '%' || trim(_busca) || '%')
      and (_tipo is null or m.tipo = _tipo) and (_status is null or m.status = _status) and (_setor is null or m.setor_id = _setor)
      and (_de is null or m.created_at >= _de) and (_ate is null or m.created_at < _ate + 1)
    order by (m.status in ('recebida','em_analise')) desc, m.created_at desc
    limit 300;
end $$;

create or replace function public.ouv_acao(_id uuid, _acao text, _setor uuid default null, _mensagem text default null, _nota text default null) returns void
language plpgsql security definer set search_path = public as $$
declare m public.ouv_manifestacoes; ev uuid; novo text; tipo_ev text; setor_nome text; msg text := nullif(trim(coalesce(_mensagem, '')), '');
begin
  if not public.is_staff(auth.uid()) then perform public.registrar_tentativa_negada('ouv_acao'); return; end if;
  select * into m from public.ouv_manifestacoes where id = _id for update;
  if not found then raise exception 'Manifestação não encontrada.'; end if;
  if m.status = 'concluida' and _acao <> 'nota' then raise exception 'Atendimento já concluído.'; end if;
  case _acao
    when 'analisar' then novo := 'em_analise'; tipo_ev := 'analise'; msg := coalesce(msg, 'Sua manifestação está em análise.');
    when 'encaminhar' then
      if _setor is null then raise exception 'Escolha o setor.'; end if;
      select nome into setor_nome from public.ouv_setores where id = _setor and ativo;
      if setor_nome is null then raise exception 'Setor inválido.'; end if;
      novo := 'encaminhada'; tipo_ev := 'encaminhamento'; msg := coalesce(msg, 'Encaminhada ao setor ' || setor_nome || '.');
    when 'complemento' then
      if msg is null then raise exception 'Escreva o que o cidadão precisa complementar.'; end if;
      novo := 'aguardando_complemento'; tipo_ev := 'complemento_solicitado';
    when 'responder' then
      if msg is null then raise exception 'Escreva a resposta ao cidadão.'; end if;
      novo := 'respondida'; tipo_ev := 'resposta';
    when 'concluir' then novo := 'concluida'; tipo_ev := 'conclusao'; msg := coalesce(msg, 'Atendimento concluído.');
    when 'nota' then
      if nullif(trim(coalesce(_nota, '')), '') is null then raise exception 'Escreva a nota interna.'; end if;
      insert into public.ouv_notas_internas(manifestacao_id, texto, autor_id) values (_id, trim(_nota), auth.uid());
      return;
    else raise exception 'Ação inválida.';
  end case;
  insert into public.ouv_eventos(manifestacao_id, tipo, setor_id, mensagem, autor_id, autor_papel)
    values (_id, tipo_ev, case when _acao = 'encaminhar' then _setor else m.setor_id end, msg, auth.uid(), 'equipe') returning id into ev;
  if nullif(trim(coalesce(_nota, '')), '') is not null then
    insert into public.ouv_notas_internas(manifestacao_id, evento_id, texto, autor_id) values (_id, ev, trim(_nota), auth.uid());
  end if;
  update public.ouv_manifestacoes set status = novo,
         setor_id = case when _acao = 'encaminhar' then _setor else setor_id end,
         resposta = case when _acao = 'responder' then msg else resposta end,
         respondida_em = case when _acao = 'responder' then now() else respondida_em end,
         atualizado_em = clock_timestamp()
   where id = _id;
  insert into public.logs_admin(autor_id, acao, alvo, detalhes) values (auth.uid(), 'ouvidoria_' || _acao, m.protocolo, setor_nome);
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
    values (m.user_id, case _acao when 'responder' then 'Resposta da Ouvidoria' when 'complemento' then 'A Ouvidoria pediu uma complementação'
                                  when 'encaminhar' then 'Manifestação encaminhada' else 'Atualização na sua manifestação' end,
            m.protocolo || ' · ' || left(msg, 140), '/minhas-manifestacoes?p=' || m.id, 'sistema');
end $$;

create or replace function public.ouv_autores(_ids uuid[]) returns table(id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(p.nome_chamada, ''), split_part(p.email, '@', 1)) from public.perfis p
  where p.id = any(_ids) and public.is_staff(auth.uid())
$$;

revoke execute on function public._ouv_anexar(uuid, uuid, jsonb) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['ouv_registrar(uuid,text,text,text,text,text,double precision,double precision,double precision,text,timestamptz,jsonb)',
    'ouv_minhas()','ouv_marcar_vista(uuid)','ouv_complementar(uuid,text,jsonb)','ouv_fila(text,text,text,uuid,date,date)',
    'ouv_acao(uuid,text,uuid,text,text)','ouv_autores(uuid[])'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
notify pgrst, 'reload schema';
