-- ASSISTENTE DE VOZ: Alexa, Siri (Atalhos) e microfone do app registram no Diário por frase falada.
-- Ex.: "registre que Marcio tomou risperidona agora" / "Marcio teve uma crise forte por causa do barulho".
-- Segurança: cada dispositivo usa um vínculo próprio (código de 6 dígitos válido por 10 minutos → token/ID da Alexa),
-- guardado só como hash; a família pode revogar a qualquer momento; limite de 30 registros por hora por vínculo.
set check_function_bodies = off;

alter table public.diario_registros drop constraint if exists diario_registros_origem_check;
alter table public.diario_registros add constraint diario_registros_origem_check check (origem = any (array['app','escola','voz']));

create table if not exists public.voz_vinculos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  familia_id uuid not null references public.familias(id) on delete cascade,
  apelido text not null check (length(apelido) between 2 and 40),
  tipo text not null check (tipo in ('alexa','siri','outro')),
  codigo_hash text,                       -- código de pareamento (6 dígitos), válido até codigo_expira
  codigo_expira timestamptz,
  token_hash text unique,                 -- Siri/Atalhos: token secreto; Alexa: hash do userId da Alexa
  ativo boolean not null default true,
  usado_em timestamptz,
  usos int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.voz_vinculos enable row level security;
drop policy if exists "voz: ver os próprios" on public.voz_vinculos;
create policy "voz: ver os próprios" on public.voz_vinculos for select using (user_id = auth.uid());
drop policy if exists "voz: desligar os próprios" on public.voz_vinculos;
create policy "voz: desligar os próprios" on public.voz_vinculos for delete using (user_id = auth.uid());
revoke update, insert on public.voz_vinculos from authenticated;

create or replace function public._voz_hash(t text) returns text language sql immutable as $$ select encode(extensions.digest(t, 'sha256'), 'hex') $$;
create or replace function public._voz_sem_acento(t text) returns text language sql immutable as $$
  select lower(translate(coalesce(t, ''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'))
$$;

-- Novo vínculo: Siri/outro recebe o TOKEN (mostrado uma única vez); Alexa recebe um CÓDIGO de 6 dígitos para falar na skill.
create or replace function public.voz_criar(_apelido text, _tipo text) returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; tok text; cod text; vid uuid;
begin
  select id into fam from public.familias where user_id = auth.uid() and status = 'aprovado';
  if fam is null then raise exception 'Só famílias com cadastro aprovado podem ligar um assistente de voz.'; end if;
  if (select count(*) from public.voz_vinculos where user_id = auth.uid() and ativo) >= 6 then raise exception 'Máximo de 6 assistentes ligados.'; end if;
  if _tipo = 'alexa' then
    cod := lpad((floor(random() * 1000000))::int::text, 6, '0');
    insert into public.voz_vinculos(user_id, familia_id, apelido, tipo, codigo_hash, codigo_expira)
    values (auth.uid(), fam, trim(_apelido), 'alexa', public._voz_hash(cod), now() + interval '10 minutes') returning id into vid;
    return jsonb_build_object('id', vid, 'codigo', cod);
  end if;
  tok := 'amp_' || encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.voz_vinculos(user_id, familia_id, apelido, tipo, token_hash) values (auth.uid(), fam, trim(_apelido), coalesce(_tipo, 'siri'), public._voz_hash(tok)) returning id into vid;
  return jsonb_build_object('id', vid, 'token', tok);
end $$;

-- Chave da skill (configurada pelo admin) para que só a skill oficial do AMPARO use o pareamento da Alexa.
create or replace function public._voz_skill_ok(_chave text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.configuracoes where chave = 'voz_alexa_chave_hash' and valor = public._voz_hash(coalesce(_chave, '')))
$$;

-- Pareamento falado na Alexa: "o código é 4 8 2 9 1 5"
create or replace function public.voz_parear_alexa(_chave text, _alexa_user text, _codigo text) returns text language plpgsql security definer set search_path = public as $$
declare v public.voz_vinculos;
begin
  if not public._voz_skill_ok(_chave) then return 'Esta skill não está autorizada.'; end if;
  select * into v from public.voz_vinculos where tipo = 'alexa' and codigo_hash = public._voz_hash(regexp_replace(coalesce(_codigo, ''), '\D', '', 'g'))
    and codigo_expira > now() and ativo for update;
  if not found then return 'Código inválido ou vencido. Gere um novo código no app AMPARO, em Assistente de voz.'; end if;
  delete from public.voz_vinculos where tipo = 'alexa' and token_hash = public._voz_hash(_alexa_user) and id <> v.id;
  update public.voz_vinculos set token_hash = public._voz_hash(_alexa_user), codigo_hash = null, codigo_expira = null where id = v.id;
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values (v.user_id, 'Alexa ligada ao Diário', v.apelido || ' agora pode registrar no diário por voz.', '/assistente-voz', 'sistema');
  return 'Pronto! Esta Alexa está ligada ao diário da sua família. Agora é só dizer, por exemplo: registre que fulano tomou o remédio agora.';
end $$;

-- Interpreta a frase e grava no diário. Devolve a frase de confirmação para o assistente falar.
create or replace function public._voz_processar(_familia uuid, _autor uuid, _autor_nome text, _frase text) returns text language plpgsql security definer set search_path = public as $$
declare
  f text := trim(regexp_replace(coalesce(_frase, ''), '^\s*(registre|registra|registrar|anote|anota|anotar|grave|salve)\s+(que\s+)?', '', 'i'));
  n text; filho record; fid uuid; fnome text; nfilhos int; tipo text := 'nota'; med text; intens int; quando timestamptz := now(); m text[]; hum text; resumo text;
begin
  if length(f) < 3 then return 'Não entendi. Diga, por exemplo: registre que fulano tomou o remédio agora.'; end if;
  if length(f) > 1000 then f := left(f, 1000); end if;
  n := ' ' || public._voz_sem_acento(f) || ' ';
  -- criança: pelo primeiro nome; com um filho só, ele é o padrão
  select count(*) into nfilhos from public.filhos where familia_id = _familia;
  for filho in select id, nome from public.filhos where familia_id = _familia loop
    if n ~ ('[^a-z]' || public._voz_sem_acento(split_part(trim(filho.nome), ' ', 1)) || '[^a-z]') then fid := filho.id; fnome := split_part(trim(filho.nome), ' ', 1); exit; end if;
  end loop;
  if fid is null and nfilhos = 1 then select id, split_part(trim(nome), ' ', 1) into fid, fnome from public.filhos where familia_id = _familia; end if;
  if nfilhos = 0 then return 'Cadastre a criança no app AMPARO antes de registrar no diário.'; end if;
  if fid is null then return 'De qual criança? Diga o nome junto, por exemplo: registre que ' ||
    (select split_part(trim(nome), ' ', 1) from public.filhos where familia_id = _familia order by created_at limit 1) || ' tomou o remédio agora.'; end if;
  -- tipo
  if n ~ '(crise|surto|meltdown|shutdown|desregul)' then tipo := 'crise';
  elsif n ~ '(remedio|medicamento|medicacao|tomou|tomar|tomei|dose|gotas|comprimido|xarope)' then tipo := 'medicacao';
  elsif n ~ '(dormiu|acordou|sono|cochil|soneca|insonia|despertou)' then tipo := 'sono';
  elsif n ~ '(comeu|almocou|jantou|cafe da manha|lanch|mamou|mamadeira|recusou a comida|nao comeu|alimenta)' then tipo := 'alimentacao';
  elsif n ~ '(conseguiu|primeira vez|conquist|aprendeu|falou pela)' then tipo := 'conquista';
  elsif n ~ '(terapia|fono|fonoaudiolog|terapeuta|psicolog|ocupacional|aba |equoterapia)' then tipo := 'terapia';
  elsif n ~ '(escola|professor|creche|aula)' then tipo := 'escola';
  elsif n ~ '(feliz|triste|agitad|irritad|calm|ansios|choro|chorou|alegre)' then tipo := 'humor';
  elsif n ~ '(febre|vomit|dor |doente|machucou|convuls)' then tipo := 'saude';
  end if;
  -- remédio cadastrado citado
  select nome into med from public.medicamentos where familia_id = _familia and ativo and (fid is null or filho_id is null or filho_id = fid)
    and n ~ ('[^a-z]' || public._voz_sem_acento(split_part(trim(nome), ' ', 1)) || '[^a-z]') limit 1;
  if med is not null and tipo = 'nota' then tipo := 'medicacao'; end if;
  -- intensidade da crise
  if tipo = 'crise' then
    intens := case when n ~ 'muito forte|gravissima|muito grave|intensa demais' then 5 when n ~ 'forte|grave|intensa' then 4 when n ~ 'moderad|media' then 3 when n ~ 'leve|fraca|pequena' then 2 else null end;
  end if;
  if tipo = 'humor' then
    hum := case when n ~ 'feliz|alegre' then '😄 Muito bem' when n ~ 'calm' then '🙂 Bem' when n ~ 'agitad|ansios' then '😟 Agitado' when n ~ 'triste|chor' then '😢 Triste' when n ~ 'irritad' then '😡 Irritado' end;
  end if;
  -- quando: "há 20 minutos", "faz 2 horas", "meia hora atrás"
  m := regexp_match(n, '(ha|faz|a) (\d+|uma|um|duas|dois|tres|meia) (minuto|hora)');
  if m is not null then
    quando := now() - ((case m[2] when 'uma' then 1 when 'um' then 1 when 'duas' then 2 when 'dois' then 2 when 'tres' then 3 when 'meia' then 0.5 else m[2]::numeric end)
              * (case when m[3] = 'hora' then 60 else 1 end)) * interval '1 minute';
  elsif n ~ 'meia hora atras' then quando := now() - interval '30 minutes';
  end if;
  insert into public.diario_registros(familia_id, filho_id, autor_id, autor_nome, origem, tipo, ocorrido_em, humor, intensidade, comportamento, nota)
  values (_familia, fid, _autor, _autor_nome, 'voz', tipo, quando, hum, intens, case when tipo = 'crise' then upper(left(f, 1)) || substr(f, 2) end,
          upper(left(f, 1)) || substr(f, 2) || coalesce(' [remédio: ' || med || ']', ''));
  resumo := case tipo when 'medicacao' then 'medicação' when 'crise' then 'crise' when 'sono' then 'sono' when 'alimentacao' then 'alimentação' when 'conquista' then 'conquista'
    when 'terapia' then 'terapia' when 'escola' then 'escola' when 'humor' then 'humor' when 'saude' then 'saúde' else 'anotação' end;
  return 'Registrado no diário' || coalesce(' de ' || fnome, '') || ': ' || resumo || coalesce(', ' || med, '') || coalesce(', intensidade ' || intens, '')
    || ', às ' || to_char(quando at time zone 'America/Sao_Paulo', 'HH24:MI') || '.';
end $$;

-- Siri/Atalhos e outros: token secreto
create or replace function public.voz_registrar(_token text, _frase text) returns text language plpgsql security definer set search_path = public as $$
declare v public.voz_vinculos;
begin
  select * into v from public.voz_vinculos where token_hash = public._voz_hash(coalesce(_token, '')) and tipo <> 'alexa' and ativo for update;
  if not found then return 'Assistente não autorizado. Ligue de novo no app AMPARO, em Assistente de voz.'; end if;
  if (select count(*) from public.diario_registros where familia_id = v.familia_id and origem = 'voz' and created_at > now() - interval '1 hour') >= 30 then
    return 'Muitos registros em pouco tempo. Tente de novo mais tarde.'; end if;
  update public.voz_vinculos set usado_em = now(), usos = usos + 1 where id = v.id;
  return public._voz_processar(v.familia_id, v.user_id, 'Voz · ' || v.apelido, _frase);
end $$;

-- Alexa: chave da skill + userId da Alexa pareado
create or replace function public.voz_registrar_alexa(_chave text, _alexa_user text, _frase text) returns text language plpgsql security definer set search_path = public as $$
declare v public.voz_vinculos;
begin
  if not public._voz_skill_ok(_chave) then return 'Esta skill não está autorizada.'; end if;
  select * into v from public.voz_vinculos where tipo = 'alexa' and token_hash = public._voz_hash(coalesce(_alexa_user, '')) and ativo for update;
  if not found then return 'Esta Alexa ainda não está ligada ao AMPARO. No app, abra Assistente de voz, gere um código e diga: o código é, seguido dos seis números.'; end if;
  if (select count(*) from public.diario_registros where familia_id = v.familia_id and origem = 'voz' and created_at > now() - interval '1 hour') >= 30 then
    return 'Muitos registros em pouco tempo. Tente de novo mais tarde.'; end if;
  update public.voz_vinculos set usado_em = now(), usos = usos + 1 where id = v.id;
  return public._voz_processar(v.familia_id, v.user_id, 'Alexa · ' || v.apelido, _frase);
end $$;

-- Microfone dentro do app (usuário logado)
create or replace function public.voz_registrar_app(_familia uuid, _frase text) returns text language plpgsql security definer set search_path = public as $$
declare nome text;
begin
  if not exists (select 1 from public.familias where id = _familia and user_id = auth.uid())
     and not exists (select 1 from public.diario_compartilhamentos c join auth.users u on lower(u.email) = lower(c.email) where c.familia_id = _familia and c.ativo and u.id = auth.uid()) then
    perform public.registrar_tentativa_negada('voz_registrar_app'); return 'Sem acesso a este diário.'; end if;
  select coalesce(nullif(split_part(trim(nome_chamada), ' ', 1), ''), 'Família') into nome from public.perfis where id = auth.uid();
  return public._voz_processar(_familia, auth.uid(), nome || ' (por voz)', _frase);
end $$;

revoke execute on function public._voz_processar(uuid, uuid, text, text), public._voz_skill_ok(text) from public, anon, authenticated;
grant execute on function public.voz_registrar(text, text), public.voz_registrar_alexa(text, text, text), public.voz_parear_alexa(text, text, text) to anon, authenticated;
grant execute on function public.voz_criar(text, text), public.voz_registrar_app(uuid, text) to authenticated;
revoke execute on function public.voz_criar(text, text), public.voz_registrar_app(uuid, text) from anon, public;
