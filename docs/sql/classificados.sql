-- CLASSIFICADOS SOLIDÁRIOS – "Oportunidades que acolhem"
-- Anúncios moderados (empregos inclusivos, negócios da comunidade, cupons e profissionais/serviços adaptados),
-- conversa interna anunciante ↔ interessado, cupons com código protegido e limite de uso, denúncias e moderação.
-- Segurança: só anúncios aprovados e dentro da validade ficam visíveis; o dono não consegue se autoaprovar,
-- destacar ou marcar como verificado; a localização gravada é sempre aproximada (2 casas decimais ≈ 1 km).

-- ===================================================================== Anúncios
create table if not exists public.cls_anuncios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null check (categoria in ('emprego','negocio','cupom','profissional')),
  subcategoria text check (length(subcategoria) <= 60),
  titulo text not null check (length(titulo) between 3 and 100),
  descricao text not null check (length(descricao) between 10 and 3000),
  cidade text not null check (length(cidade) between 2 and 80),
  bairro text check (length(bairro) <= 80),
  uf text not null default 'BA' check (length(uf) = 2),
  lat numeric(6,2) check (lat between -90 and 90),
  lng numeric(6,2) check (lng between -180 and 180),
  valor numeric(12,2) check (valor >= 0),
  valor_tipo text not null default 'a_combinar' check (valor_tipo in ('fixo','a_partir','a_combinar','gratis','nao_se_aplica')),
  horarios text check (length(horarios) <= 300),
  condicoes text[] not null default '{}',
  contato_chat boolean not null default true,
  whatsapp text check (whatsapp ~ '^[0-9]{10,13}$'),
  registro_prof text check (length(registro_prof) <= 80),
  estabelecimento text check (length(estabelecimento) <= 120),
  cupom_regras text check (length(cupom_regras) <= 1000),
  cupom_limite int check (cupom_limite > 0),
  cupom_usos int not null default 0,
  fotos text[] not null default '{}' check (cardinality(fotos) <= 6),
  validade date not null,
  status text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado','suspenso','encerrado')),
  motivo text check (length(motivo) <= 500),
  verificado boolean not null default false,
  destaque boolean not null default false,
  moderado_por uuid references auth.users(id),
  moderado_em timestamptz,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint cls_contato_obrigatorio check (contato_chat or whatsapp is not null)
);
create index if not exists cls_anuncios_vitrine on public.cls_anuncios (status, validade, categoria);
create index if not exists cls_anuncios_dono on public.cls_anuncios (user_id);
alter table public.cls_anuncios enable row level security;

drop policy if exists "cls: vitrine, dono ou equipe" on public.cls_anuncios;
create policy "cls: vitrine, dono ou equipe" on public.cls_anuncios for select using (
  auth.uid() is not null and (
    (status = 'aprovado' and validade >= current_date) or user_id = auth.uid() or public.is_staff(auth.uid())));
drop policy if exists "cls: criar o próprio" on public.cls_anuncios;
create policy "cls: criar o próprio" on public.cls_anuncios for insert with check (user_id = auth.uid());
drop policy if exists "cls: editar o próprio" on public.cls_anuncios;
create policy "cls: editar o próprio" on public.cls_anuncios for update using (user_id = auth.uid() or public.is_staff(auth.uid()))
  with check (user_id = auth.uid() or public.is_staff(auth.uid()));
drop policy if exists "cls: apagar o próprio" on public.cls_anuncios;
create policy "cls: apagar o próprio" on public.cls_anuncios for delete using (user_id = auth.uid() or public.is_staff(auth.uid()));

-- Proteções que valem para qualquer gravação feita pelo app (inclusive edição direta pela API).
create or replace function public._cls_guarda() returns trigger language plpgsql security definer set search_path = public as $$
declare equipe boolean := public.is_staff(auth.uid());
begin
  if current_setting('cls.interno', true) = '1' then new.atualizado_em := now(); return new; end if;  -- contagem de cupom e suspensão automática
  new.lat := round(new.lat, 2); new.lng := round(new.lng, 2);           -- nunca grava coordenada exata
  new.whatsapp := nullif(regexp_replace(coalesce(new.whatsapp,''), '\D', '', 'g'), '');
  if new.categoria <> 'cupom' then new.cupom_limite := null; new.cupom_regras := null; end if;
  if new.validade > current_date + 180 then raise exception 'A validade máxima de um anúncio é de 180 dias.'; end if;
  if tg_op = 'INSERT' then
    if new.validade < current_date then raise exception 'A validade precisa ser uma data futura.'; end if;
    if (select count(*) from public.cls_anuncios a where a.user_id = auth.uid() and a.status = 'pendente') >= 10 then
      raise exception 'Você já tem 10 anúncios aguardando análise. Aguarde a moderação.'; end if;
    new.user_id := auth.uid(); new.cupom_usos := 0; new.created_at := now();
    if not equipe then new.status := 'pendente'; new.verificado := false; new.destaque := false; new.moderado_por := null; new.moderado_em := null; new.motivo := null; end if;
  else
    new.user_id := old.user_id; new.created_at := old.created_at; new.cupom_usos := old.cupom_usos;
    if not equipe then
      new.verificado := old.verificado; new.destaque := old.destaque; new.moderado_por := old.moderado_por; new.moderado_em := old.moderado_em; new.motivo := old.motivo;
      -- o dono só pode encerrar o anúncio; qualquer outra mudança volta para a fila de moderação
      if new.status = 'encerrado' and old.status <> 'encerrado' then null;
      elsif old.status = 'suspenso' then new.status := 'suspenso';
      elsif (new.titulo, new.descricao, new.fotos, new.whatsapp, new.valor, new.categoria, new.subcategoria, new.condicoes, new.horarios, new.registro_prof, new.estabelecimento, new.cupom_regras, new.cidade, new.bairro)
            is distinct from (old.titulo, old.descricao, old.fotos, old.whatsapp, old.valor, old.categoria, old.subcategoria, old.condicoes, old.horarios, old.registro_prof, old.estabelecimento, old.cupom_regras, old.cidade, old.bairro)
            or old.status in ('rejeitado','encerrado') then
        new.status := 'pendente'; new.verificado := false;
      else new.status := old.status; end if;
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists cls_guarda on public.cls_anuncios;
create trigger cls_guarda before insert or update on public.cls_anuncios for each row execute function public._cls_guarda();

-- Aviso à equipe quando entra um anúncio para análise
create or replace function public._cls_avisa_equipe() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pendente' and (tg_op = 'INSERT' or old.status <> 'pendente') then
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
    select distinct r.user_id, 'Anúncio para analisar', left(new.titulo, 120), '/admin?aba=classificados', 'classificados'
    from public.user_roles r where r.role in ('equipe','admin') and r.user_id <> new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists cls_avisa_equipe on public.cls_anuncios;
create trigger cls_avisa_equipe after insert or update of status on public.cls_anuncios for each row execute function public._cls_avisa_equipe();

-- ===================================================================== Cupons (código protegido)
create table if not exists public.cls_cupom_codigos (
  anuncio_id uuid primary key references public.cls_anuncios(id) on delete cascade,
  codigo text not null check (length(codigo) between 3 and 40)
);
alter table public.cls_cupom_codigos enable row level security;
drop policy if exists "codigo: dono ou equipe" on public.cls_cupom_codigos;
create policy "codigo: dono ou equipe" on public.cls_cupom_codigos for all using (
  public.is_staff(auth.uid()) or exists (select 1 from public.cls_anuncios a where a.id = anuncio_id and a.user_id = auth.uid()))
  with check (public.is_staff(auth.uid()) or exists (select 1 from public.cls_anuncios a where a.id = anuncio_id and a.user_id = auth.uid() and a.categoria = 'cupom'));

create table if not exists public.cls_cupom_usos (
  anuncio_id uuid not null references public.cls_anuncios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (anuncio_id, user_id)
);
alter table public.cls_cupom_usos enable row level security;
drop policy if exists "usos: próprio, dono do cupom ou equipe" on public.cls_cupom_usos;
create policy "usos: próprio, dono do cupom ou equipe" on public.cls_cupom_usos for select using (
  user_id = auth.uid() or public.is_staff(auth.uid()) or exists (select 1 from public.cls_anuncios a where a.id = anuncio_id and a.user_id = auth.uid()));

-- Mostra o código do cupom e conta 1 uso por pessoa (pedir de novo não gasta outro uso).
create or replace function public.cls_usar_cupom(_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare a public.cls_anuncios; cod text; n int;
begin
  if auth.uid() is null then perform public.registrar_tentativa_negada('cls_usar_cupom'); return null; end if;
  select * into a from public.cls_anuncios where id = _id;
  if not found or a.categoria <> 'cupom' or a.status <> 'aprovado' or a.validade < current_date then raise exception 'Cupom indisponível ou vencido.'; end if;
  select codigo into cod from public.cls_cupom_codigos where anuncio_id = _id;
  if cod is null then raise exception 'O anunciante ainda não cadastrou o código deste cupom.'; end if;
  if exists (select 1 from public.cls_cupom_usos where anuncio_id = _id and user_id = auth.uid()) then return cod; end if;
  perform set_config('cls.interno', '1', true);
  update public.cls_anuncios set cupom_usos = cupom_usos + 1 where id = _id and (cupom_limite is null or cupom_usos < cupom_limite);
  get diagnostics n = row_count;
  perform set_config('cls.interno', '0', true);
  if n = 0 then raise exception 'Este cupom atingiu o limite de usos.'; end if;
  insert into public.cls_cupom_usos(anuncio_id, user_id) values (_id, auth.uid());
  return cod;
end $$;

-- ===================================================================== Denúncias
create table if not exists public.cls_denuncias (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.cls_anuncios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  motivo text not null check (length(motivo) between 3 and 500),
  resolvida boolean not null default false,
  created_at timestamptz not null default now(),
  unique (anuncio_id, user_id)
);
alter table public.cls_denuncias enable row level security;
drop policy if exists "denuncias: equipe" on public.cls_denuncias;
create policy "denuncias: equipe" on public.cls_denuncias for select using (public.is_staff(auth.uid()));
drop policy if exists "denuncias: equipe resolve" on public.cls_denuncias;
create policy "denuncias: equipe resolve" on public.cls_denuncias for update using (public.is_staff(auth.uid()));

-- Denunciar: 3 denúncias de pessoas diferentes suspendem o anúncio até a equipe revisar.
create or replace function public.cls_denunciar(_id uuid, _motivo text) returns void language plpgsql security definer set search_path = public as $$
declare n int; a public.cls_anuncios;
begin
  if auth.uid() is null then perform public.registrar_tentativa_negada('cls_denunciar'); return; end if;
  select * into a from public.cls_anuncios where id = _id and status = 'aprovado';
  if not found then raise exception 'Anúncio não encontrado.'; end if;
  if a.user_id = auth.uid() then raise exception 'Você não pode denunciar o próprio anúncio.'; end if;
  insert into public.cls_denuncias(anuncio_id, user_id, motivo) values (_id, auth.uid(), trim(_motivo)) on conflict (anuncio_id, user_id) do nothing;
  select count(*) into n from public.cls_denuncias where anuncio_id = _id and not resolvida;
  if n >= 3 then
    perform set_config('cls.interno', '1', true);
    update public.cls_anuncios set status = 'suspenso', motivo = 'Suspenso automaticamente após denúncias. Em revisão pela equipe.' where id = _id;
    perform set_config('cls.interno', '0', true);
  end if;
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
  select distinct r.user_id, 'Anúncio denunciado', left(a.titulo, 120) || ' · ' || left(trim(_motivo), 140), '/admin?aba=classificados', 'classificados'
  from public.user_roles r where r.role in ('equipe','admin');
end $$;

-- ===================================================================== Moderação (equipe)
create or replace function public.cls_moderar(_id uuid, _acao text, _motivo text default null) returns void language plpgsql security definer set search_path = public as $$
declare a public.cls_anuncios;
begin
  if not public.is_staff(auth.uid()) then perform public.registrar_tentativa_negada('cls_moderar'); return; end if;
  select * into a from public.cls_anuncios where id = _id; if not found then raise exception 'Anúncio não encontrado.'; end if;
  if _acao in ('rejeitar','suspender') and coalesce(trim(_motivo),'') = '' then raise exception 'Informe o motivo para o anunciante.'; end if;
  update public.cls_anuncios set
    status = case _acao when 'aprovar' then 'aprovado' when 'rejeitar' then 'rejeitado' when 'suspender' then 'suspenso' else status end,
    motivo = case when _acao in ('rejeitar','suspender') then trim(_motivo) when _acao = 'aprovar' then null else motivo end,
    destaque = case _acao when 'destacar' then true when 'tirar_destaque' then false else destaque end,
    verificado = case _acao when 'verificar' then true when 'tirar_verificacao' then false else verificado end,
    moderado_por = auth.uid(), moderado_em = now()
  where id = _id;
  if _acao = 'aprovar' then update public.cls_denuncias set resolvida = true where anuncio_id = _id; end if;
  if _acao in ('aprovar','rejeitar','suspender') then
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (a.user_id,
      case _acao when 'aprovar' then 'Seu anúncio foi publicado' when 'rejeitar' then 'Seu anúncio não foi aprovado' else 'Seu anúncio foi suspenso' end,
      left(a.titulo, 120) || coalesce(' · ' || trim(_motivo), ''), '/classificados?aba=meus', 'classificados');
  end if;
  insert into public.logs_admin(autor_id, acao, alvo) values (auth.uid(), 'classificados_' || _acao, _id::text);
end $$;

-- ===================================================================== Conversa interna
create table if not exists public.cls_conversas (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.cls_anuncios(id) on delete cascade,
  interessado_id uuid not null references auth.users(id) on delete cascade,
  anunciante_id uuid not null references auth.users(id) on delete cascade,
  ultima_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (anuncio_id, interessado_id)
);
alter table public.cls_conversas enable row level security;
drop policy if exists "conversas: participantes" on public.cls_conversas;
create policy "conversas: participantes" on public.cls_conversas for select using (auth.uid() in (interessado_id, anunciante_id));

create table if not exists public.cls_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.cls_conversas(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  texto text not null check (length(texto) between 1 and 2000),
  lida_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cls_mensagens_conversa on public.cls_mensagens (conversa_id, created_at);
alter table public.cls_mensagens enable row level security;
drop policy if exists "mensagens: participantes" on public.cls_mensagens;
create policy "mensagens: participantes" on public.cls_mensagens for select using (
  exists (select 1 from public.cls_conversas c where c.id = conversa_id and auth.uid() in (c.interessado_id, c.anunciante_id)));

-- Abre (ou reabre) a conversa com o anunciante e envia a primeira mensagem.
create or replace function public.cls_contatar(_anuncio uuid, _texto text) returns uuid language plpgsql security definer set search_path = public as $$
declare a public.cls_anuncios; cid uuid;
begin
  if auth.uid() is null then perform public.registrar_tentativa_negada('cls_contatar'); return null; end if;
  select * into a from public.cls_anuncios where id = _anuncio and status = 'aprovado' and validade >= current_date;
  if not found then raise exception 'Anúncio indisponível.'; end if;
  if not a.contato_chat then raise exception 'Este anunciante não recebe mensagens pelo app.'; end if;
  if a.user_id = auth.uid() then raise exception 'Este anúncio é seu.'; end if;
  insert into public.cls_conversas(anuncio_id, interessado_id, anunciante_id) values (_anuncio, auth.uid(), a.user_id)
  on conflict (anuncio_id, interessado_id) do update set ultima_em = now() returning id into cid;
  perform public.cls_enviar(cid, _texto);
  return cid;
end $$;

create or replace function public.cls_enviar(_conversa uuid, _texto text) returns void language plpgsql security definer set search_path = public as $$
declare c public.cls_conversas; outro uuid; t text := trim(_texto); titulo text;
begin
  select * into c from public.cls_conversas where id = _conversa;
  if not found or auth.uid() not in (c.interessado_id, c.anunciante_id) then perform public.registrar_tentativa_negada('cls_enviar'); return; end if;
  if length(t) = 0 then raise exception 'Escreva uma mensagem.'; end if;
  if (select count(*) from public.cls_mensagens m where m.autor_id = auth.uid() and m.created_at > now() - interval '1 minute') >= 15 then
    raise exception 'Muitas mensagens em pouco tempo. Aguarde um instante.'; end if;
  insert into public.cls_mensagens(conversa_id, autor_id, texto) values (_conversa, auth.uid(), left(t, 2000));
  update public.cls_conversas set ultima_em = now() where id = _conversa;
  outro := case when auth.uid() = c.interessado_id then c.anunciante_id else c.interessado_id end;
  select a.titulo into titulo from public.cls_anuncios a where a.id = c.anuncio_id;
  -- um aviso por conversa enquanto houver mensagens não lidas
  if not exists (select 1 from public.notificacoes n where n.user_id = outro and n.link = '/classificados?conversa=' || _conversa and not n.lida) then
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
    values (outro, 'Nova mensagem nos Classificados', left(coalesce(titulo,''), 120), '/classificados?conversa=' || _conversa, 'classificados');
  end if;
end $$;

-- Lista de conversas: mostra só o primeiro nome da outra pessoa (sem telefone, e-mail ou endereço).
create or replace function public.cls_minhas_conversas() returns table(id uuid, anuncio_id uuid, anuncio_titulo text, anuncio_foto text, sou_anunciante boolean,
  outro_nome text, ultima_msg text, ultima_em timestamptz, nao_lidas int) language sql stable security definer set search_path = public as $$
  select c.id, c.anuncio_id, a.titulo, a.fotos[1], c.anunciante_id = auth.uid(),
    coalesce(nullif(split_part(trim(p.nome_chamada), ' ', 1), ''), 'Participante'),
    (select m.texto from public.cls_mensagens m where m.conversa_id = c.id order by m.created_at desc limit 1), c.ultima_em,
    (select count(*)::int from public.cls_mensagens m where m.conversa_id = c.id and m.autor_id <> auth.uid() and m.lida_em is null)
  from public.cls_conversas c join public.cls_anuncios a on a.id = c.anuncio_id
  left join public.perfis p on p.id = case when c.anunciante_id = auth.uid() then c.interessado_id else c.anunciante_id end
  where auth.uid() in (c.interessado_id, c.anunciante_id)
  order by c.ultima_em desc
$$;

create or replace function public.cls_marcar_lidas(_conversa uuid) returns void language sql security definer set search_path = public as $$
  update public.cls_mensagens m set lida_em = now() from public.cls_conversas c
  where m.conversa_id = _conversa and c.id = _conversa and auth.uid() in (c.interessado_id, c.anunciante_id) and m.autor_id <> auth.uid() and m.lida_em is null;
  update public.notificacoes set lida = true where user_id = auth.uid() and link = '/classificados?conversa=' || _conversa;
$$;

-- Nome público do anunciante (primeiro nome) para a vitrine.
create or replace function public.cls_anunciantes(_ids uuid[]) returns table(id uuid, nome text) language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(split_part(trim(p.nome_chamada), ' ', 1), ''), 'Anunciante') from public.perfis p
  where p.id = any(_ids) and auth.uid() is not null
    and exists (select 1 from public.cls_anuncios a where a.user_id = p.id and (a.status = 'aprovado' or public.is_staff(auth.uid())))
$$;

-- ===================================================================== Fotos (bucket público só para leitura; gravação na pasta do próprio usuário)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('classificados', 'classificados', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "cls fotos: enviar na própria pasta" on storage.objects;
create policy "cls fotos: enviar na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'classificados' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "cls fotos: apagar as próprias" on storage.objects;
create policy "cls fotos: apagar as próprias" on storage.objects for delete to authenticated
  using (bucket_id = 'classificados' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff(auth.uid())));

revoke all on function public.cls_usar_cupom(uuid), public.cls_denunciar(uuid, text), public.cls_moderar(uuid, text, text),
  public.cls_contatar(uuid, text), public.cls_enviar(uuid, text), public.cls_minhas_conversas(), public.cls_marcar_lidas(uuid), public.cls_anunciantes(uuid[]) from anon, public;
grant execute on function public.cls_usar_cupom(uuid), public.cls_denunciar(uuid, text), public.cls_moderar(uuid, text, text),
  public.cls_contatar(uuid, text), public.cls_enviar(uuid, text), public.cls_minhas_conversas(), public.cls_marcar_lidas(uuid), public.cls_anunciantes(uuid[]) to authenticated;
