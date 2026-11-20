set check_function_bodies = off;
-- REDE DE FAMÍLIAS + COMUNIDADE E APOIO MÚTUO
-- Participação voluntária, localização aproximada com consentimento próprio, busca por raio sem nunca devolver coordenadas,
-- conexões, mensagens privadas só entre conectados, bloqueio, denúncia, grupos/núcleos moderados e mural de relatos.

-- ===================================================================== Perfil na rede (opt-in)
create table if not exists public.rf_perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ativo boolean not null default true,
  apelido text not null check (length(apelido) between 2 and 40),
  cidade text not null check (length(cidade) between 2 and 80),
  bairro text check (length(bairro) <= 80),
  uf text not null default 'BA' check (length(uf) = 2),
  mostrar_bairro boolean not null default true,
  usa_localizacao boolean not null default false,          -- consentimento específico para busca por distância
  lat numeric(6,2), lng numeric(6,2),                        -- só ~1 km de precisão, nunca devolvido a outras pessoas
  faixas text[] not null default '{}',                       -- faixa etária dos filhos
  interesses text[] not null default '{}',
  apoios text[] not null default '{}',                       -- tipos de apoio procurados/oferecidos
  sobre text check (length(sobre) <= 500),
  aceita_mensagens boolean not null default true,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.rf_perfis enable row level security;
drop policy if exists "rf perfil: só o próprio" on public.rf_perfis;
create policy "rf perfil: só o próprio" on public.rf_perfis for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public._rf_guarda_perfil() returns trigger language plpgsql as $$
begin
  new.user_id := coalesce(old.user_id, auth.uid());
  if not new.usa_localizacao then new.lat := null; new.lng := null; end if;
  new.lat := round(new.lat, 2); new.lng := round(new.lng, 2); new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists rf_guarda_perfil on public.rf_perfis;
create trigger rf_guarda_perfil before insert or update on public.rf_perfis for each row execute function public._rf_guarda_perfil();

-- ===================================================================== Bloqueios e conexões
create table if not exists public.rf_bloqueios (
  quem uuid not null references auth.users(id) on delete cascade,
  bloqueado uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (quem, bloqueado)
);
alter table public.rf_bloqueios enable row level security;
drop policy if exists "rf bloqueio: próprio" on public.rf_bloqueios;
create policy "rf bloqueio: próprio" on public.rf_bloqueios for all using (quem = auth.uid()) with check (quem = auth.uid() and bloqueado <> auth.uid());

create or replace function public._rf_bloqueado(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rf_bloqueios where (quem = a and bloqueado = b) or (quem = b and bloqueado = a))
$$;

create table if not exists public.rf_conexoes (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references auth.users(id) on delete cascade,
  para uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente','aceita','recusada')),
  mensagem text check (length(mensagem) <= 300),
  created_at timestamptz not null default now(),
  respondida_em timestamptz,
  check (de <> para)
);
create unique index if not exists rf_conexoes_par on public.rf_conexoes (least(de, para), greatest(de, para));
alter table public.rf_conexoes enable row level security;
drop policy if exists "rf conexão: participantes" on public.rf_conexoes;
create policy "rf conexão: participantes" on public.rf_conexoes for select using (auth.uid() in (de, para));

create or replace function public._rf_conectados(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rf_conexoes where status = 'aceita' and ((de = a and para = b) or (de = b and para = a)))
    and not public._rf_bloqueado(a, b)
$$;

create or replace function public._rf_nome(u uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select apelido from public.rf_perfis where user_id = u), 'Participante')
$$;

-- Busca de famílias por raio/cidade/filtros. Devolve distância arredondada e nunca coordenadas ou endereço.
create or replace function public.rf_buscar(_lat double precision default null, _lng double precision default null, _raio int default null,
  _cidade text default null, _bairro text default null, _faixa text default null, _interesse text default null, _apoio text default null)
returns table(user_id uuid, apelido text, cidade text, bairro text, uf text, faixas text[], interesses text[], apoios text[], sobre text,
  distancia_km int, conexao text, aceita_mensagens boolean)
language sql stable security definer set search_path = public as $$
  with eu as (select * from public.rf_perfis where user_id = auth.uid() and ativo),
  base as (
    select p.*, case when _lat is not null and p.lat is not null and (select usa_localizacao from eu) then
      6371 * 2 * asin(sqrt(power(sin(radians(p.lat - _lat) / 2), 2) + cos(radians(_lat)) * cos(radians(p.lat)) * power(sin(radians(p.lng - _lng) / 2), 2))) end as d
    from public.rf_perfis p
    where p.ativo and p.user_id <> auth.uid() and exists (select 1 from eu) and not public._rf_bloqueado(auth.uid(), p.user_id)
  )
  select b.user_id, b.apelido, b.cidade, case when b.mostrar_bairro then b.bairro end, b.uf, b.faixas, b.interesses, b.apoios, b.sobre,
    case when b.d is null then null when b.d < 1 then 1 else ceil(b.d)::int end,
    (select case when c.status = 'aceita' then 'conectado' when c.status = 'pendente' and c.de = auth.uid() then 'enviada'
                 when c.status = 'pendente' then 'recebida' when c.status = 'recusada' and c.de = auth.uid() then 'enviada' end
     from public.rf_conexoes c where least(c.de, c.para) = least(auth.uid(), b.user_id) and greatest(c.de, c.para) = greatest(auth.uid(), b.user_id)),
    b.aceita_mensagens
  from base b
  where (_raio is null or (b.d is not null and b.d <= _raio))
    and (_cidade is null or lower(b.cidade) = lower(_cidade))
    and (_bairro is null or (b.mostrar_bairro and lower(b.bairro) = lower(_bairro)))
    and (_faixa is null or _faixa = any(b.faixas))
    and (_interesse is null or _interesse = any(b.interesses))
    and (_apoio is null or _apoio = any(b.apoios))
  order by b.d nulls last, b.atualizado_em desc
  limit 200
$$;

create or replace function public.rf_conectar(_para uuid, _mensagem text default null) returns void language plpgsql security definer set search_path = public as $$
declare c public.rf_conexoes;
begin
  if not exists (select 1 from public.rf_perfis where user_id = auth.uid() and ativo) then raise exception 'Ative seu perfil na rede para se conectar.'; end if;
  if not exists (select 1 from public.rf_perfis where user_id = _para and ativo) or public._rf_bloqueado(auth.uid(), _para) or _para = auth.uid() then
    perform public.registrar_tentativa_negada('rf_conectar'); return; end if;
  if (select count(*) from public.rf_conexoes where de = auth.uid() and created_at > now() - interval '1 day') >= 30 then raise exception 'Limite diário de pedidos de conexão atingido.'; end if;
  select * into c from public.rf_conexoes where least(de, para) = least(auth.uid(), _para) and greatest(de, para) = greatest(auth.uid(), _para);
  if found then
    if c.status = 'pendente' and c.para = auth.uid() then
      update public.rf_conexoes set status = 'aceita', respondida_em = now() where id = c.id;
      insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (_para, 'Conexão aceita', public._rf_nome(auth.uid()) || ' agora faz parte da sua rede.', '/comunidade?aba=conexoes', 'rede');
    end if;
    return;   -- já existe pedido (inclusive recusado: não reenvia para não insistir)
  end if;
  insert into public.rf_conexoes(de, para, mensagem) values (auth.uid(), _para, nullif(trim(_mensagem), ''));
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (_para, 'Pedido de conexão', public._rf_nome(auth.uid()) || ' quer se conectar com você na Rede de Famílias.', '/comunidade?aba=conexoes', 'rede');
end $$;

create or replace function public.rf_responder(_id uuid, _aceitar boolean) returns void language plpgsql security definer set search_path = public as $$
declare c public.rf_conexoes;
begin
  select * into c from public.rf_conexoes where id = _id;
  if not found or c.para <> auth.uid() or c.status <> 'pendente' then perform public.registrar_tentativa_negada('rf_responder'); return; end if;
  update public.rf_conexoes set status = case when _aceitar then 'aceita' else 'recusada' end, respondida_em = now() where id = _id;
  if _aceitar then insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (c.de, 'Conexão aceita', public._rf_nome(auth.uid()) || ' aceitou seu pedido.', '/comunidade?aba=conexoes', 'rede'); end if;
end $$;

create or replace function public.rf_desconectar(_outro uuid) returns void language sql security definer set search_path = public as $$
  delete from public.rf_conexoes where least(de, para) = least(auth.uid(), _outro) and greatest(de, para) = greatest(auth.uid(), _outro) and auth.uid() in (de, para);
$$;

create or replace function public.rf_bloquear(_outro uuid) returns void language sql security definer set search_path = public as $$
  insert into public.rf_bloqueios(quem, bloqueado) select auth.uid(), _outro where _outro <> auth.uid() on conflict do nothing;
  delete from public.rf_conexoes where least(de, para) = least(auth.uid(), _outro) and greatest(de, para) = greatest(auth.uid(), _outro);
$$;

-- Minhas conexões e pedidos (apelido e cidade apenas)
create or replace function public.rf_minhas_conexoes() returns table(id uuid, outro uuid, apelido text, cidade text, status text, recebida boolean, mensagem text, created_at timestamptz, nao_lidas int)
language sql stable security definer set search_path = public as $$
  select c.id, o.u, public._rf_nome(o.u), (select p.cidade from public.rf_perfis p where p.user_id = o.u), c.status, c.para = auth.uid(), c.mensagem, c.created_at,
    (select count(*)::int from public.rf_mensagens m where m.de = o.u and m.para = auth.uid() and m.lida_em is null)
  from public.rf_conexoes c cross join lateral (select case when c.de = auth.uid() then c.para else c.de end as u) o
  where auth.uid() in (c.de, c.para) and c.status <> 'recusada' and not public._rf_bloqueado(auth.uid(), o.u)
  order by c.created_at desc
$$;

-- ===================================================================== Mensagens privadas (só entre conectados)
create table if not exists public.rf_mensagens (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references auth.users(id) on delete cascade,
  para uuid not null references auth.users(id) on delete cascade,
  texto text not null check (length(texto) between 1 and 2000),
  lida_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rf_mensagens_par on public.rf_mensagens (least(de, para), greatest(de, para), created_at);
alter table public.rf_mensagens enable row level security;
drop policy if exists "rf msg: participantes" on public.rf_mensagens;
create policy "rf msg: participantes" on public.rf_mensagens for select using (auth.uid() in (de, para));

create or replace function public.rf_enviar(_para uuid, _texto text) returns void language plpgsql security definer set search_path = public as $$
declare t text := trim(_texto);
begin
  if not public._rf_conectados(auth.uid(), _para) then perform public.registrar_tentativa_negada('rf_enviar'); raise exception 'Vocês precisam estar conectados para conversar.'; end if;
  if not coalesce((select aceita_mensagens from public.rf_perfis where user_id = _para), false) then raise exception 'Esta pessoa pausou o recebimento de mensagens.'; end if;
  if length(t) = 0 then raise exception 'Escreva uma mensagem.'; end if;
  if (select count(*) from public.rf_mensagens where de = auth.uid() and created_at > now() - interval '1 minute') >= 15 then raise exception 'Muitas mensagens em pouco tempo. Aguarde um instante.'; end if;
  insert into public.rf_mensagens(de, para, texto) values (auth.uid(), _para, left(t, 2000));
  if not exists (select 1 from public.notificacoes n where n.user_id = _para and n.link = '/comunidade?com=' || auth.uid() and not n.lida) then
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (_para, 'Nova mensagem na Rede', public._rf_nome(auth.uid()) || ' enviou uma mensagem.', '/comunidade?com=' || auth.uid(), 'rede');
  end if;
end $$;

create or replace function public.rf_marcar_lidas(_de uuid) returns void language sql security definer set search_path = public as $$
  update public.rf_mensagens set lida_em = now() where de = _de and para = auth.uid() and lida_em is null;
  update public.notificacoes set lida = true where user_id = auth.uid() and link = '/comunidade?com=' || _de;
$$;

-- ===================================================================== Grupos, núcleos e mural
create table if not exists public.rf_grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(nome) between 3 and 80),
  tipo text not null check (tipo in ('bairro','cidade','interesse','nucleo')),
  cidade text check (length(cidade) <= 80),
  bairro text check (length(bairro) <= 80),
  descricao text check (length(descricao) <= 800),
  com_profissional boolean not null default false,    -- grupo moderado por profissional habilitado (ainda é apoio mútuo, não terapia)
  ativo boolean not null default true,
  status text not null default 'aprovado' check (status in ('pendente','aprovado','arquivado')),
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.rf_membros (
  grupo_id uuid not null references public.rf_grupos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('membro','moderador')),
  created_at timestamptz not null default now(),
  primary key (grupo_id, user_id)
);
alter table public.rf_grupos enable row level security;
alter table public.rf_membros enable row level security;

create or replace function public._rf_moderador(_g uuid, _u uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(_u) or exists (select 1 from public.rf_membros where grupo_id = _g and user_id = _u and papel = 'moderador')
$$;
create or replace function public._rf_membro(_g uuid, _u uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rf_membros where grupo_id = _g and user_id = _u)
$$;

drop policy if exists "rf grupos: ler" on public.rf_grupos;
create policy "rf grupos: ler" on public.rf_grupos for select using (auth.uid() is not null and (status = 'aprovado' or criado_por = auth.uid() or public.is_staff(auth.uid())));
drop policy if exists "rf grupos: equipe" on public.rf_grupos;
create policy "rf grupos: equipe" on public.rf_grupos for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
drop policy if exists "rf membros: ver do grupo" on public.rf_membros;
create policy "rf membros: ver do grupo" on public.rf_membros for select using (user_id = auth.uid() or public._rf_membro(grupo_id, auth.uid()) or public.is_staff(auth.uid()));

-- Famílias sugerem grupos de bairro/cidade/interesse (entram como pendentes); núcleos só a equipe cria.
create or replace function public.rf_sugerir_grupo(_nome text, _tipo text, _cidade text, _bairro text, _descricao text) returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if not exists (select 1 from public.rf_perfis where user_id = auth.uid() and ativo) then raise exception 'Ative seu perfil na rede primeiro.'; end if;
  if _tipo not in ('bairro','cidade','interesse') then raise exception 'Núcleos locais são criados pela equipe.'; end if;
  insert into public.rf_grupos(nome, tipo, cidade, bairro, descricao, status, criado_por) values (trim(_nome), _tipo, nullif(trim(_cidade),''), nullif(trim(_bairro),''), nullif(trim(_descricao),''), 'pendente', auth.uid()) returning id into gid;
  insert into public.rf_membros(grupo_id, user_id, papel) values (gid, auth.uid(), 'moderador');
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
  select distinct r.user_id, 'Grupo sugerido na Rede', trim(_nome), '/admin?aba=rede', 'rede' from public.user_roles r where r.role in ('equipe','admin');
  return gid;
end $$;

create or replace function public.rf_entrar_grupo(_g uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.rf_perfis where user_id = auth.uid() and ativo) then raise exception 'Ative seu perfil na rede primeiro.'; end if;
  if not exists (select 1 from public.rf_grupos where id = _g and status = 'aprovado' and ativo) then raise exception 'Grupo indisponível.'; end if;
  insert into public.rf_membros(grupo_id, user_id) values (_g, auth.uid()) on conflict do nothing;
end $$;
create or replace function public.rf_sair_grupo(_g uuid) returns void language sql security definer set search_path = public as $$
  delete from public.rf_membros where grupo_id = _g and user_id = auth.uid();
$$;

create or replace function public.rf_grupos_lista() returns table(id uuid, nome text, tipo text, cidade text, bairro text, descricao text, com_profissional boolean, status text, membros int, sou_membro boolean, sou_moderador boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.nome, g.tipo, g.cidade, g.bairro, g.descricao, g.com_profissional, g.status,
    (select count(*)::int from public.rf_membros m where m.grupo_id = g.id), public._rf_membro(g.id, auth.uid()), public._rf_moderador(g.id, auth.uid())
  from public.rf_grupos g where auth.uid() is not null and g.ativo and (g.status = 'aprovado' or g.criado_por = auth.uid() or public.is_staff(auth.uid()))
  order by (g.tipo = 'nucleo') desc, g.nome
$$;

-- Equipe define moderadores de núcleo/grupo
create or replace function public.rf_definir_moderador(_g uuid, _u uuid, _moderador boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then perform public.registrar_tentativa_negada('rf_definir_moderador'); return; end if;
  insert into public.rf_membros(grupo_id, user_id, papel) values (_g, _u, case when _moderador then 'moderador' else 'membro' end)
  on conflict (grupo_id, user_id) do update set papel = excluded.papel;
  insert into public.logs_admin(autor_id, acao, alvo) values (auth.uid(), 'rede_moderador_' || case when _moderador then 'sim' else 'nao' end, _g::text || ':' || _u::text);
end $$;

create table if not exists public.rf_posts (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid references public.rf_grupos(id) on delete cascade,   -- null = mural geral da rede
  autor_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null default 'relato' check (tipo in ('relato','pergunta','dica','encontro')),
  texto text not null check (length(texto) between 3 and 3000),
  anonimo boolean not null default false,
  status text not null default 'publicado' check (status in ('publicado','oculto')),
  created_at timestamptz not null default now()
);
create table if not exists public.rf_comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.rf_posts(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  texto text not null check (length(texto) between 1 and 1500),
  anonimo boolean not null default false,
  status text not null default 'publicado' check (status in ('publicado','oculto')),
  created_at timestamptz not null default now()
);
alter table public.rf_posts enable row level security;          -- leitura só pelas funções abaixo (escondem o autor de relatos anônimos)
alter table public.rf_comentarios enable row level security;

create or replace function public.rf_publicar(_grupo uuid, _tipo text, _texto text, _anonimo boolean) returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if not exists (select 1 from public.rf_perfis where user_id = auth.uid() and ativo) then raise exception 'Ative seu perfil na rede para publicar.'; end if;
  if _grupo is not null and not public._rf_membro(_grupo, auth.uid()) and not public.is_staff(auth.uid()) then perform public.registrar_tentativa_negada('rf_publicar'); raise exception 'Entre no grupo para publicar.'; end if;
  if (select count(*) from public.rf_posts where autor_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then raise exception 'Muitas publicações em pouco tempo.'; end if;
  insert into public.rf_posts(grupo_id, autor_id, tipo, texto, anonimo) values (_grupo, auth.uid(), _tipo, trim(_texto), coalesce(_anonimo, false)) returning id into pid;
  return pid;
end $$;

create or replace function public.rf_comentar(_post uuid, _texto text, _anonimo boolean) returns void language plpgsql security definer set search_path = public as $$
declare p public.rf_posts; quem uuid;
begin
  select * into p from public.rf_posts where id = _post and status = 'publicado';
  if not found or not exists (select 1 from public.rf_perfis where user_id = auth.uid() and ativo)
     or (p.grupo_id is not null and not public._rf_membro(p.grupo_id, auth.uid()) and not public.is_staff(auth.uid())) then
    perform public.registrar_tentativa_negada('rf_comentar'); raise exception 'Não é possível comentar aqui.'; end if;
  insert into public.rf_comentarios(post_id, autor_id, texto, anonimo) values (_post, auth.uid(), trim(_texto), coalesce(_anonimo, false));
  if p.autor_id <> auth.uid() and not public._rf_bloqueado(p.autor_id, auth.uid()) then
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (p.autor_id, 'Resposta na Rede', 'Alguém respondeu à sua publicação.', '/comunidade?aba=mural&post=' || _post, 'rede');
  end if;
end $$;

-- Feed: autor anônimo aparece como "Participante anônimo" para todos (inclusive moderadores de grupo); só a equipe vê quem foi, para moderação.
create or replace function public.rf_feed(_grupo uuid default null, _limite int default 50) returns table(id uuid, grupo_id uuid, tipo text, texto text, anonimo boolean, autor text,
  meu boolean, created_at timestamptz, comentarios jsonb, posso_moderar boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.grupo_id, p.tipo, p.texto, p.anonimo,
    case when p.anonimo and not public.is_staff(auth.uid()) then 'Participante anônimo' else public._rf_nome(p.autor_id) end,
    p.autor_id = auth.uid(), p.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'texto', c.texto, 'meu', c.autor_id = auth.uid(), 'created_at', c.created_at,
      'autor', case when c.anonimo and not public.is_staff(auth.uid()) then 'Participante anônimo' else public._rf_nome(c.autor_id) end) order by c.created_at)
      from public.rf_comentarios c where c.post_id = p.id and c.status = 'publicado' and not public._rf_bloqueado(auth.uid(), c.autor_id)), '[]'::jsonb),
    case when p.grupo_id is null then public.is_staff(auth.uid()) else public._rf_moderador(p.grupo_id, auth.uid()) end
  from public.rf_posts p
  where p.status = 'publicado' and (public.is_staff(auth.uid()) or exists (select 1 from public.rf_perfis e where e.user_id = auth.uid() and e.ativo))
    and ((_grupo is null and p.grupo_id is null) or (p.grupo_id = _grupo and (public._rf_membro(_grupo, auth.uid()) or public.is_staff(auth.uid()))))
    and not public._rf_bloqueado(auth.uid(), p.autor_id)
  order by p.created_at desc limit least(_limite, 100)
$$;

-- Ocultar: o próprio autor, moderador do grupo ou equipe
create or replace function public.rf_ocultar(_tipo text, _id uuid) returns void language plpgsql security definer set search_path = public as $$
declare g uuid; a uuid;
begin
  if _tipo = 'post' then select grupo_id, autor_id into g, a from public.rf_posts where id = _id;
  else select p.grupo_id, c.autor_id into g, a from public.rf_comentarios c join public.rf_posts p on p.id = c.post_id where c.id = _id; end if;
  if a is null or not (a = auth.uid() or public.is_staff(auth.uid()) or (g is not null and public._rf_moderador(g, auth.uid()))) then
    perform public.registrar_tentativa_negada('rf_ocultar'); return; end if;
  if _tipo = 'post' then update public.rf_posts set status = 'oculto' where id = _id; else update public.rf_comentarios set status = 'oculto' where id = _id; end if;
  if a <> auth.uid() then insert into public.logs_admin(autor_id, acao, alvo) values (auth.uid(), 'rede_ocultar_' || _tipo, _id::text); end if;
end $$;

-- ===================================================================== Denúncias da rede
create table if not exists public.rf_denuncias (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references auth.users(id) on delete cascade,
  alvo_tipo text not null check (alvo_tipo in ('perfil','mensagem','post','comentario')),
  alvo_id uuid not null,
  alvo_user uuid references auth.users(id) on delete cascade,
  motivo text not null check (length(motivo) between 3 and 500),
  status text not null default 'aberta' check (status in ('aberta','resolvida')),
  created_at timestamptz not null default now()
);
alter table public.rf_denuncias enable row level security;
drop policy if exists "rf denúncia: equipe" on public.rf_denuncias;
create policy "rf denúncia: equipe" on public.rf_denuncias for select using (public.is_staff(auth.uid()));
drop policy if exists "rf denúncia: equipe resolve" on public.rf_denuncias;
create policy "rf denúncia: equipe resolve" on public.rf_denuncias for update using (public.is_staff(auth.uid()));

create or replace function public.rf_denunciar(_tipo text, _id uuid, _motivo text) returns void language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if auth.uid() is null then return; end if;
  u := case _tipo when 'perfil' then _id when 'mensagem' then (select de from public.rf_mensagens where id = _id and para = auth.uid())
    when 'post' then (select autor_id from public.rf_posts where id = _id) when 'comentario' then (select autor_id from public.rf_comentarios where id = _id) end;
  if u is null then raise exception 'Conteúdo não encontrado.'; end if;
  insert into public.rf_denuncias(autor_id, alvo_tipo, alvo_id, alvo_user, motivo) values (auth.uid(), _tipo, _id, u, trim(_motivo));
  -- 3 denúncias de pessoas diferentes ocultam o conteúdo até a equipe revisar
  if _tipo in ('post','comentario') and (select count(distinct autor_id) from public.rf_denuncias where alvo_id = _id and status = 'aberta') >= 3 then
    if _tipo = 'post' then update public.rf_posts set status = 'oculto' where id = _id; else update public.rf_comentarios set status = 'oculto' where id = _id; end if;
  end if;
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
  select distinct r.user_id, 'Denúncia na Rede de Famílias', left(trim(_motivo), 140), '/admin?aba=rede', 'rede' from public.user_roles r where r.role in ('equipe','admin');
end $$;

-- Conteúdo denunciado para a equipe (inclui o texto denunciado; mensagens privadas só aparecem quando denunciadas pelo destinatário)
create or replace function public.rf_denuncias_admin() returns table(id uuid, alvo_tipo text, alvo_id uuid, alvo_nome text, motivo text, status text, created_at timestamptz, conteudo text, conteudo_status text, denuncias int)
language sql stable security definer set search_path = public as $$
  select d.id, d.alvo_tipo, d.alvo_id, public._rf_nome(d.alvo_user), d.motivo, d.status, d.created_at,
    case d.alvo_tipo when 'post' then (select texto from public.rf_posts where id = d.alvo_id) when 'comentario' then (select texto from public.rf_comentarios where id = d.alvo_id)
      when 'mensagem' then (select texto from public.rf_mensagens where id = d.alvo_id) else (select coalesce(sobre, '') from public.rf_perfis where user_id = d.alvo_id) end,
    case d.alvo_tipo when 'post' then (select status from public.rf_posts where id = d.alvo_id) when 'comentario' then (select status from public.rf_comentarios where id = d.alvo_id)
      when 'perfil' then (select case when ativo then 'ativo' else 'inativo' end from public.rf_perfis where user_id = d.alvo_id) end,
    (select count(*)::int from public.rf_denuncias x where x.alvo_id = d.alvo_id)
  from public.rf_denuncias d where public.is_staff(auth.uid()) order by d.status, d.created_at desc
$$;

create or replace function public.rf_moderar(_denuncia uuid, _acao text) returns void language plpgsql security definer set search_path = public as $$
declare d public.rf_denuncias;
begin
  if not public.is_staff(auth.uid()) then perform public.registrar_tentativa_negada('rf_moderar'); return; end if;
  select * into d from public.rf_denuncias where id = _denuncia; if not found then return; end if;
  if _acao = 'ocultar' then
    if d.alvo_tipo = 'post' then update public.rf_posts set status = 'oculto' where id = d.alvo_id;
    elsif d.alvo_tipo = 'comentario' then update public.rf_comentarios set status = 'oculto' where id = d.alvo_id; end if;
  elsif _acao = 'restaurar' then
    if d.alvo_tipo = 'post' then update public.rf_posts set status = 'publicado' where id = d.alvo_id;
    elsif d.alvo_tipo = 'comentario' then update public.rf_comentarios set status = 'publicado' where id = d.alvo_id; end if;
  elsif _acao = 'suspender_perfil' then update public.rf_perfis set ativo = false where user_id = d.alvo_user;
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (d.alvo_user, 'Perfil na Rede suspenso', 'Seu perfil foi suspenso após denúncia. Fale com a equipe do AMPARO.', '/comunidade', 'rede');
  end if;
  update public.rf_denuncias set status = 'resolvida' where alvo_id = d.alvo_id;
  insert into public.logs_admin(autor_id, acao, alvo) values (auth.uid(), 'rede_' || _acao, d.alvo_id::text);
end $$;

-- Encontros: moderadores de núcleo/grupo também podem marcar encontros do seu grupo.
alter table public.encontros add column if not exists grupo_id uuid references public.rf_grupos(id) on delete cascade;
alter table public.encontros add column if not exists criado_por uuid references auth.users(id) on delete set null;
drop policy if exists "encontros: moderador do grupo" on public.encontros;
create policy "encontros: moderador do grupo" on public.encontros for all
  using (grupo_id is not null and public._rf_moderador(grupo_id, auth.uid())) with check (grupo_id is not null and public._rf_moderador(grupo_id, auth.uid()));

grant execute on function public.rf_buscar(double precision, double precision, int, text, text, text, text, text), public.rf_conectar(uuid, text), public.rf_responder(uuid, boolean),
  public.rf_desconectar(uuid), public.rf_bloquear(uuid), public.rf_minhas_conexoes(), public.rf_enviar(uuid, text), public.rf_marcar_lidas(uuid), public.rf_sugerir_grupo(text, text, text, text, text),
  public.rf_entrar_grupo(uuid), public.rf_sair_grupo(uuid), public.rf_grupos_lista(), public.rf_definir_moderador(uuid, uuid, boolean), public.rf_publicar(uuid, text, text, boolean),
  public.rf_comentar(uuid, text, boolean), public.rf_feed(uuid, int), public.rf_ocultar(text, uuid), public.rf_denunciar(text, uuid, text), public.rf_denuncias_admin(), public.rf_moderar(uuid, text) to authenticated;
revoke execute on function public.rf_buscar(double precision, double precision, int, text, text, text, text, text), public.rf_conectar(uuid, text), public.rf_responder(uuid, boolean),
  public.rf_desconectar(uuid), public.rf_bloquear(uuid), public.rf_minhas_conexoes(), public.rf_enviar(uuid, text), public.rf_marcar_lidas(uuid), public.rf_sugerir_grupo(text, text, text, text, text),
  public.rf_entrar_grupo(uuid), public.rf_sair_grupo(uuid), public.rf_grupos_lista(), public.rf_definir_moderador(uuid, uuid, boolean), public.rf_publicar(uuid, text, text, boolean),
  public.rf_comentar(uuid, text, boolean), public.rf_feed(uuid, int), public.rf_ocultar(text, uuid), public.rf_denunciar(text, uuid, text), public.rf_denuncias_admin(), public.rf_moderar(uuid, text) from anon, public;
