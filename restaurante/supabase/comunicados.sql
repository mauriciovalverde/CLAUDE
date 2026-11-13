-- COMUNICAÇÃO INTERNA: comunicados com push, leitura obrigatória, prazo, versões, cancelamento e auditoria.
-- Regras: horário do servidor; a entrega do push NUNCA conta como leitura; confirmação só pela conta do próprio funcionário;
-- nada é apagado (edição guarda a versão anterior, cancelamento preserva o histórico).

create table if not exists rest_grupos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  nome text not null, membros uuid[] not null default '{}',
  criado_em timestamptz not null default now(),
  unique (restaurante_id, nome)
);

create table if not exists rest_comunicados (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references rest_restaurantes(id) on delete cascade,
  titulo text not null check (length(trim(titulo)) between 3 and 140),
  conteudo text not null check (length(trim(conteudo)) >= 3),
  prioridade text not null default 'normal' check (prioridade in ('normal','importante','urgente')),
  obrigatoria boolean not null default false,
  prazo timestamptz,
  enviar_em timestamptz not null default now(),
  destino jsonb not null default '{"todos": true}',   -- {todos, funcionarios[], setores[], grupos[]}
  permitir_anexos boolean not null default false,
  anexos jsonb not null default '[]',                -- [{path, nome, tipo, tamanho}]
  lembrete_horas int not null default 24 check (lembrete_horas between 0 and 168),  -- 0 = sem lembretes automáticos
  aviso_final_horas int not null default 2 check (aviso_final_horas between 0 and 48),
  status text not null default 'agendado' check (status in ('agendado','enviado','cancelado')),
  versao int not null default 1,
  criado_por uuid references rest_funcionarios(id), criado_em timestamptz not null default now(),
  enviado_em timestamptz, editado_por uuid references rest_funcionarios(id), editado_em timestamptz,
  cancelado_por uuid references rest_funcionarios(id), cancelado_em timestamptz, motivo_cancelamento text,
  check (prazo is null or prazo > enviar_em)
);
create index if not exists rest_comunicados_rest on rest_comunicados(restaurante_id, criado_em desc);

create table if not exists rest_comunicado_versoes (
  id uuid primary key default gen_random_uuid(),
  comunicado_id uuid not null references rest_comunicados(id) on delete cascade,
  restaurante_id uuid not null references rest_restaurantes(id) on delete cascade,
  versao int not null, titulo text not null, conteudo text not null, prioridade text not null, obrigatoria boolean not null,
  prazo timestamptz, anexos jsonb not null default '[]',
  relevante boolean not null default false, alteracoes text[] not null default '{}',
  editado_por uuid references rest_funcionarios(id), editado_em timestamptz not null default now(),
  unique (comunicado_id, versao)
);

create table if not exists rest_comunicado_dest (
  id uuid primary key default gen_random_uuid(),
  comunicado_id uuid not null references rest_comunicados(id) on delete cascade,
  restaurante_id uuid not null references rest_restaurantes(id) on delete cascade,
  funcionario_id uuid not null references rest_funcionarios(id) on delete cascade,
  incluido_em timestamptz not null default now(),
  push_enviado_em timestamptz, entregue_em timestamptz,
  aberto_em timestamptz, versao_vista int,
  confirmado_em timestamptz, confirmado_versao int, confirmado_fora_prazo boolean,
  precisa_reconfirmar boolean not null default false,
  ultimo_lembrete_em timestamptz, lembretes int not null default 0, aviso_final_em timestamptz,
  unique (comunicado_id, funcionario_id)
);
create index if not exists rest_com_dest_func on rest_comunicado_dest(funcionario_id);

-- registro de cada confirmação (nunca alterado)
create table if not exists rest_comunicado_confirmacoes (
  id uuid primary key default gen_random_uuid(),
  comunicado_id uuid not null references rest_comunicados(id) on delete cascade,
  restaurante_id uuid not null references rest_restaurantes(id) on delete cascade,
  funcionario_id uuid not null references rest_funcionarios(id),
  user_id uuid not null, versao int not null, em timestamptz not null default now(),
  dispositivo text, fora_prazo boolean not null default false,
  unique (comunicado_id, funcionario_id, versao)              -- proteção contra confirmação duplicada
);

-- aparelhos que recebem push (Web Push no navegador/iPhone; FCM no app Android)
create table if not exists rest_push_dispositivos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  funcionario_id uuid not null default rest_meu_funcionario() references rest_funcionarios(id) on delete cascade,
  tipo text not null check (tipo in ('webpush','fcm')),
  endpoint text not null unique,                    -- endpoint Web Push ou token FCM
  chaves jsonb,                                     -- p256dh e auth (Web Push)
  plataforma text, aparelho text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(), visto_em timestamptz not null default now(),
  ultimo_envio_em timestamptz, ultima_entrega_em timestamptz, ultimo_erro text, ultimo_erro_em timestamptz, falhas int not null default 0
);

-- cada notificação disparada (envio, lembrete, atualização, cancelamento, teste) e a confirmação técnica de entrega
create table if not exists rest_push_envios (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references rest_restaurantes(id) on delete cascade,
  comunicado_id uuid references rest_comunicados(id) on delete cascade,
  funcionario_id uuid not null references rest_funcionarios(id) on delete cascade,
  dispositivo_id uuid references rest_push_dispositivos(id) on delete set null,
  motivo text not null check (motivo in ('envio','lembrete','aviso_final','atualizacao','cancelamento','reenvio','teste')),
  status text not null default 'enviado' check (status in ('enviado','erro','entregue','sem_dispositivo')),
  token text not null default replace(gen_random_uuid()::text, '-', ''),
  erro text, criado_em timestamptz not null default now(), entregue_em timestamptz
);
create index if not exists rest_push_envios_com on rest_push_envios(comunicado_id, funcionario_id);

-- tentativas de acesso a comunicados (abrir, confirmar, negado)
create table if not exists rest_comunicado_acessos (
  id bigint generated always as identity primary key,
  restaurante_id uuid, comunicado_id uuid, funcionario_id uuid, user_id uuid default auth.uid(),
  acao text not null, ok boolean not null, detalhe text, dispositivo text, em timestamptz not null default now()
);

-- ============ RLS ============
alter table rest_grupos enable row level security;
alter table rest_comunicados enable row level security;
alter table rest_comunicado_versoes enable row level security;
alter table rest_comunicado_dest enable row level security;
alter table rest_comunicado_confirmacoes enable row level security;
alter table rest_push_dispositivos enable row level security;
alter table rest_push_envios enable row level security;
alter table rest_comunicado_acessos enable row level security;

create policy gr_sel on rest_grupos for select using (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
create policy gr_adm on rest_grupos for all using (restaurante_id = rest_meu_restaurante() and rest_pode('admin')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
-- comunicado: administrador vê todos; funcionário só os que foram enviados para ele
create policy co_sel on rest_comunicados for select using (restaurante_id = rest_meu_restaurante() and (rest_pode('admin')
  or (status <> 'agendado' and exists (select 1 from rest_comunicado_dest d where d.comunicado_id = rest_comunicados.id and d.funcionario_id = rest_meu_funcionario()))));
create policy cv_sel on rest_comunicado_versoes for select using (restaurante_id = rest_meu_restaurante() and (rest_pode('admin')
  or exists (select 1 from rest_comunicado_dest d where d.comunicado_id = rest_comunicado_versoes.comunicado_id and d.funcionario_id = rest_meu_funcionario())));
create policy cd_sel on rest_comunicado_dest for select using (restaurante_id = rest_meu_restaurante() and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy cc_sel on rest_comunicado_confirmacoes for select using (restaurante_id = rest_meu_restaurante() and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy pd_sel on rest_push_dispositivos for select using (restaurante_id = rest_meu_restaurante() and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy pe_sel on rest_push_envios for select using (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
create policy ca_sel on rest_comunicado_acessos for select using (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
-- gravações só pelas funções abaixo (security definer)

do $$ declare t text; begin
  foreach t in array array['rest_comunicados','rest_comunicado_versoes','rest_comunicado_confirmacoes','rest_grupos'] loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function rest_auditar()', t, t);
  end loop;
end $$;

-- comunicados e confirmações nunca são excluídos
create or replace function rest_com_sem_exclusao() returns trigger language plpgsql set search_path = public as $$
begin raise exception 'COMUNICADO_PRESERVADO: comunicados, versões e confirmações não podem ser excluídos (use Cancelar)'; end $$;
create trigger rest_com_nao_exclui before delete on rest_comunicados for each row when (pg_trigger_depth() = 0) execute function rest_com_sem_exclusao();
create trigger rest_cv_nao_exclui before delete on rest_comunicado_versoes for each row when (pg_trigger_depth() = 0) execute function rest_com_sem_exclusao();
create trigger rest_cc_nao_exclui before delete or update on rest_comunicado_confirmacoes for each row execute function rest_com_sem_exclusao();

-- ============ situação de cada destinatário (sempre pelo relógio do servidor) ============
create or replace view rest_comunicado_situacao with (security_invoker = true) as
select d.*, c.titulo, c.prioridade, c.obrigatoria, c.prazo, c.status as status_comunicado, c.versao, c.enviar_em, c.enviado_em, c.cancelado_em,
  f.nome as funcionario_nome, f.setor,
  case
    when c.status = 'cancelado' then 'cancelada'
    when c.status = 'agendado' then 'aguardando_envio'
    when d.confirmado_em is not null and not d.precisa_reconfirmar then 'confirmada'
    when c.obrigatoria and c.prazo is not null and c.prazo < now() then 'prazo_expirado'
    when d.aberto_em is not null and c.obrigatoria then 'visualizada'
    when d.aberto_em is not null then 'lida'
    when d.entregue_em is not null then 'entregue'
    when d.push_enviado_em is not null then 'notificacao_enviada'
    else 'nao_lida'
  end as situacao,
  (d.versao_vista is not null and d.versao_vista < c.versao) as atualizada
from rest_comunicado_dest d join rest_comunicados c on c.id = d.comunicado_id join rest_funcionarios f on f.id = d.funcionario_id;

-- ============ funções ============
create or replace function rest_com_dispositivo() returns text language sql stable as $$
  select left(coalesce(current_setting('request.headers', true)::jsonb ->> 'user-agent', ''), 200)
$$;

-- coloca os destinatários (na hora do envio, para incluir quem entrou na equipe depois do agendamento)
create or replace function rest_com_liberar(p_id uuid) returns int language plpgsql security definer set search_path = public as $$
declare c rest_comunicados; n int;
begin
  select * into c from rest_comunicados where id = p_id for update;
  if c.id is null or c.status <> 'agendado' then return 0; end if;
  insert into rest_comunicado_dest(comunicado_id, restaurante_id, funcionario_id)
  select c.id, c.restaurante_id, f.id from rest_funcionarios f
   where f.restaurante_id = c.restaurante_id and f.ativo and (
     coalesce((c.destino->>'todos')::boolean, false)
     or f.id::text in (select jsonb_array_elements_text(coalesce(c.destino->'funcionarios', '[]')))
     or f.setor in (select jsonb_array_elements_text(coalesce(c.destino->'setores', '[]')))
     or f.id = any(coalesce((select array_agg(m) from rest_grupos g, unnest(g.membros) m where g.restaurante_id = c.restaurante_id and g.id::text in (select jsonb_array_elements_text(coalesce(c.destino->'grupos', '[]')))), '{}')))
  on conflict (comunicado_id, funcionario_id) do nothing;
  get diagnostics n = row_count;
  update rest_comunicados set status = 'enviado', enviado_em = now() where id = c.id;
  return n;
end $$;

create or replace function rest_com_validar(p jsonb) returns void language plpgsql as $$
begin
  if coalesce(trim(p->>'titulo'), '') = '' or length(trim(p->>'titulo')) < 3 then raise exception 'Informe o título (mínimo 3 letras)'; end if;
  if coalesce(trim(p->>'conteudo'), '') = '' then raise exception 'Escreva o conteúdo da mensagem'; end if;
  if coalesce(p->>'prioridade', 'normal') not in ('normal','importante','urgente') then raise exception 'Prioridade inválida'; end if;
  if jsonb_array_length(coalesce(p->'anexos', '[]')) > 0 and not coalesce((p->>'permitir_anexos')::boolean, false) then raise exception 'Marque “Permitir anexos” para anexar arquivos'; end if;
end $$;

create or replace function rest_com_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rest uuid := rest_meu_restaurante(); v_eu uuid := rest_meu_funcionario(); v rest_comunicados; v_env timestamptz; v_n int := 0; d jsonb := coalesce(p->'destino', '{"todos": true}');
begin
  if not rest_pode('admin') then raise exception 'Somente a administração envia comunicados'; end if;
  perform rest_com_validar(p);
  if not coalesce((d->>'todos')::boolean, false) and jsonb_array_length(coalesce(d->'funcionarios', '[]')) + jsonb_array_length(coalesce(d->'setores', '[]')) + jsonb_array_length(coalesce(d->'grupos', '[]')) = 0 then
    raise exception 'Escolha os destinatários'; end if;
  v_env := greatest(coalesce(nullif(p->>'enviar_em', '')::timestamptz, now()), now());
  if nullif(p->>'prazo', '') is not null and (p->>'prazo')::timestamptz <= v_env then raise exception 'O prazo para leitura precisa ser depois do envio'; end if;
  insert into rest_comunicados(id, restaurante_id, titulo, conteudo, prioridade, obrigatoria, prazo, enviar_em, destino, permitir_anexos, anexos, lembrete_horas, aviso_final_horas, criado_por)
  values (coalesce(nullif(p->>'id', '')::uuid, gen_random_uuid()), v_rest, trim(p->>'titulo'), trim(p->>'conteudo'), coalesce(p->>'prioridade', 'normal'), coalesce((p->>'obrigatoria')::boolean, false), nullif(p->>'prazo', '')::timestamptz,
          v_env, d, coalesce((p->>'permitir_anexos')::boolean, false), coalesce(p->'anexos', '[]'), coalesce((p->>'lembrete_horas')::int, 24), coalesce((p->>'aviso_final_horas')::int, 2), v_eu)
  returning * into v;
  insert into rest_comunicado_versoes(comunicado_id, restaurante_id, versao, titulo, conteudo, prioridade, obrigatoria, prazo, anexos, editado_por, alteracoes)
  values (v.id, v_rest, 1, v.titulo, v.conteudo, v.prioridade, v.obrigatoria, v.prazo, v.anexos, v_eu, '{criação}');
  if v_env <= now() + interval '1 minute' then v_n := rest_com_liberar(v.id); end if;
  if v_n = 0 and v_env <= now() + interval '1 minute' then raise exception 'Nenhum funcionário ativo corresponde aos destinatários escolhidos'; end if;
  return jsonb_build_object('id', v.id, 'destinatarios', v_n, 'agendado', v_env > now() + interval '1 minute');
end $$;

-- edição: guarda a versão anterior; alteração relevante de comunicado obrigatório pede nova confirmação
create or replace function rest_com_editar(p_id uuid, p jsonb, p_relevante boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare c rest_comunicados; v_eu uuid := rest_meu_funcionario(); v_alt text[] := '{}'; v_novo_prazo timestamptz; v_reconf int := 0;
begin
  if not rest_pode('admin') then raise exception 'Somente a administração edita comunicados'; end if;
  select * into c from rest_comunicados where id = p_id and restaurante_id = rest_meu_restaurante() for update;
  if c.id is null then raise exception 'Comunicado não encontrado'; end if;
  if c.status = 'cancelado' then raise exception 'Comunicado cancelado não pode ser editado'; end if;
  perform rest_com_validar(p || jsonb_build_object('permitir_anexos', coalesce(p->'permitir_anexos', to_jsonb(c.permitir_anexos))));
  v_novo_prazo := case when p ? 'prazo' then nullif(p->>'prazo', '')::timestamptz else c.prazo end;
  if trim(p->>'titulo') is distinct from c.titulo then v_alt := v_alt || 'título'::text; end if;
  if trim(p->>'conteudo') is distinct from c.conteudo then v_alt := v_alt || 'conteúdo'::text; end if;
  if coalesce(p->>'prioridade', c.prioridade) is distinct from c.prioridade then v_alt := v_alt || 'prioridade'::text; end if;
  if coalesce((p->>'obrigatoria')::boolean, c.obrigatoria) is distinct from c.obrigatoria then v_alt := v_alt || 'leitura obrigatória'::text; end if;
  if v_novo_prazo is distinct from c.prazo then v_alt := v_alt || 'prazo'::text; end if;
  if coalesce(p->'anexos', c.anexos) is distinct from c.anexos then v_alt := v_alt || 'anexos'::text; end if;
  if c.status = 'agendado' and p ? 'destino' and p->'destino' is distinct from c.destino then v_alt := v_alt || 'destinatários'::text; end if;
  if c.status = 'agendado' and p ? 'enviar_em' and (p->>'enviar_em')::timestamptz is distinct from c.enviar_em then v_alt := v_alt || 'data de envio'::text; end if;
  if cardinality(v_alt) = 0 then return jsonb_build_object('alterado', false); end if;
  if v_novo_prazo is not null and v_novo_prazo <= coalesce(c.enviado_em, c.enviar_em) then raise exception 'O prazo precisa ser depois do envio'; end if;
  update rest_comunicados set titulo = trim(p->>'titulo'), conteudo = trim(p->>'conteudo'), prioridade = coalesce(p->>'prioridade', prioridade),
    obrigatoria = coalesce((p->>'obrigatoria')::boolean, obrigatoria), prazo = v_novo_prazo, anexos = coalesce(p->'anexos', anexos),
    permitir_anexos = coalesce((p->>'permitir_anexos')::boolean, permitir_anexos),
    lembrete_horas = coalesce((p->>'lembrete_horas')::int, lembrete_horas), aviso_final_horas = coalesce((p->>'aviso_final_horas')::int, aviso_final_horas),
    destino = case when status = 'agendado' and p ? 'destino' then p->'destino' else destino end,
    enviar_em = case when status = 'agendado' and p ? 'enviar_em' then greatest((p->>'enviar_em')::timestamptz, now()) else enviar_em end,
    versao = versao + 1, editado_por = v_eu, editado_em = now()
  where id = c.id returning * into c;
  insert into rest_comunicado_versoes(comunicado_id, restaurante_id, versao, titulo, conteudo, prioridade, obrigatoria, prazo, anexos, relevante, alteracoes, editado_por)
  values (c.id, c.restaurante_id, c.versao, c.titulo, c.conteudo, c.prioridade, c.obrigatoria, c.prazo, c.anexos, coalesce(p_relevante, false), v_alt, v_eu);
  if coalesce(p_relevante, false) and c.obrigatoria then
    update rest_comunicado_dest set precisa_reconfirmar = true, lembretes = 0, ultimo_lembrete_em = null, aviso_final_em = null
     where comunicado_id = c.id and confirmado_em is not null;
    get diagnostics v_reconf = row_count;
  end if;
  -- prazo novo: lembretes recomeçam
  if v_novo_prazo is distinct from (select prazo from rest_comunicado_versoes where comunicado_id = c.id and versao = c.versao - 1) then
    update rest_comunicado_dest set aviso_final_em = null where comunicado_id = c.id;
  end if;
  return jsonb_build_object('alterado', true, 'versao', c.versao, 'alteracoes', v_alt, 'reconfirmar', v_reconf, 'status', c.status);
end $$;

create or replace function rest_com_cancelar(p_id uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c rest_comunicados;
begin
  if not rest_pode('admin') then raise exception 'Somente a administração cancela comunicados'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo do cancelamento'; end if;
  update rest_comunicados set status = 'cancelado', cancelado_por = rest_meu_funcionario(), cancelado_em = now(), motivo_cancelamento = trim(p_motivo)
   where id = p_id and restaurante_id = rest_meu_restaurante() and status <> 'cancelado'
   returning * into c;
  if c.id is null then raise exception 'Comunicado não encontrado ou já cancelado'; end if;
  return jsonb_build_object('ja_enviado', c.enviado_em is not null);
end $$;

-- funcionário abre o comunicado (registra a abertura; não é confirmação)
create or replace function rest_com_abrir(p_id uuid, p_dispositivo text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_eu uuid := rest_meu_funcionario(); d rest_comunicado_dest; c rest_comunicados;
begin
  select * into c from rest_comunicados where id = p_id;
  select * into d from rest_comunicado_dest where comunicado_id = p_id and funcionario_id = v_eu;
  if v_eu is null or c.id is null or c.restaurante_id <> rest_meu_restaurante() or (d.id is null and not rest_pode('admin')) or (c.status = 'agendado' and not rest_pode('admin')) then
    insert into rest_comunicado_acessos(restaurante_id, comunicado_id, funcionario_id, acao, ok, detalhe, dispositivo) values (rest_meu_restaurante(), p_id, v_eu, 'abrir', false, 'não é destinatário', coalesce(p_dispositivo, rest_com_dispositivo()));
    return jsonb_build_object('ok', false, 'mensagem', 'Este comunicado não foi enviado para você');
  end if;
  if d.id is not null then
    update rest_comunicado_dest set aberto_em = coalesce(aberto_em, now()), versao_vista = c.versao where id = d.id;
    insert into rest_comunicado_acessos(restaurante_id, comunicado_id, funcionario_id, acao, ok, dispositivo) values (c.restaurante_id, p_id, v_eu, 'abrir', true, coalesce(p_dispositivo, rest_com_dispositivo()));
  end if;
  return jsonb_build_object('ok', true, 'atualizada', d.versao_vista is not null and d.versao_vista < c.versao);
end $$;

-- confirmação de leitura: só a própria conta, depois de abrir, na versão atual, uma vez por versão
create or replace function rest_com_confirmar(p_id uuid, p_versao int, p_dispositivo text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_eu uuid := rest_meu_funcionario(); d rest_comunicado_dest; c rest_comunicados; v_fora boolean; v_disp text := left(coalesce(p_dispositivo, rest_com_dispositivo()), 200);
begin
  select * into c from rest_comunicados where id = p_id;
  select * into d from rest_comunicado_dest where comunicado_id = p_id and funcionario_id = v_eu for update;
  if v_eu is null or d.id is null or c.restaurante_id <> rest_meu_restaurante() then
    insert into rest_comunicado_acessos(restaurante_id, comunicado_id, funcionario_id, acao, ok, detalhe, dispositivo) values (rest_meu_restaurante(), p_id, v_eu, 'confirmar', false, 'não é destinatário', v_disp);
    return jsonb_build_object('ok', false, 'mensagem', 'Você não pode confirmar este comunicado');  -- sem exceção, para a tentativa ficar registrada
  end if;
  if c.status = 'cancelado' then raise exception 'Este comunicado foi cancelado'; end if;
  if not c.obrigatoria then raise exception 'Este comunicado não exige confirmação'; end if;
  if d.aberto_em is null then raise exception 'Abra e leia o comunicado antes de confirmar'; end if;
  if p_versao is distinct from c.versao then raise exception 'O comunicado foi atualizado. Leia a nova versão antes de confirmar'; end if;
  if d.confirmado_em is not null and d.confirmado_versao = c.versao and not d.precisa_reconfirmar then
    return jsonb_build_object('ok', true, 'ja_confirmado', true, 'confirmado_em', d.confirmado_em);
  end if;
  v_fora := c.prazo is not null and now() > c.prazo;
  insert into rest_comunicado_confirmacoes(comunicado_id, restaurante_id, funcionario_id, user_id, versao, dispositivo, fora_prazo)
  values (c.id, c.restaurante_id, v_eu, auth.uid(), c.versao, v_disp, v_fora)
  on conflict (comunicado_id, funcionario_id, versao) do nothing;
  update rest_comunicado_dest set confirmado_em = now(), confirmado_versao = c.versao, confirmado_fora_prazo = v_fora, precisa_reconfirmar = false, versao_vista = c.versao where id = d.id;
  insert into rest_comunicado_acessos(restaurante_id, comunicado_id, funcionario_id, acao, ok, dispositivo) values (c.restaurante_id, p_id, v_eu, 'confirmar', true, v_disp);
  return jsonb_build_object('ok', true, 'confirmado_em', now(), 'fora_prazo', v_fora);
end $$;

-- aparelho do funcionário para receber push
create or replace function rest_push_registrar(p_tipo text, p_endpoint text, p_chaves jsonb, p_plataforma text, p_aparelho text) returns uuid language plpgsql security definer set search_path = public as $$
declare v_eu uuid := rest_meu_funcionario(); v_id uuid;
begin
  if v_eu is null then raise exception 'Faça login'; end if;
  if p_tipo not in ('webpush','fcm') or coalesce(p_endpoint, '') = '' then raise exception 'Inscrição inválida'; end if;
  insert into rest_push_dispositivos(restaurante_id, funcionario_id, tipo, endpoint, chaves, plataforma, aparelho)
  values (rest_meu_restaurante(), v_eu, p_tipo, p_endpoint, p_chaves, left(p_plataforma, 60), left(p_aparelho, 200))
  on conflict (endpoint) do update set funcionario_id = excluded.funcionario_id, restaurante_id = excluded.restaurante_id, chaves = excluded.chaves,
     plataforma = excluded.plataforma, aparelho = excluded.aparelho, ativo = true, visto_em = now(), falhas = 0, ultimo_erro = null
  returning id into v_id;
  return v_id;
end $$;
create or replace function rest_push_desativar(p_endpoint text) returns void language sql security definer set search_path = public as $$
  update rest_push_dispositivos set ativo = false where endpoint = p_endpoint and funcionario_id = rest_meu_funcionario()
$$;

-- grupos (administração)
create or replace function rest_com_grupo_salvar(p_id uuid, p_nome text, p_membros uuid[]) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not rest_pode('admin') then raise exception 'Somente a administração'; end if;
  if p_id is null then insert into rest_grupos(restaurante_id, nome, membros) values (rest_meu_restaurante(), trim(p_nome), p_membros) returning id into v_id;
  else update rest_grupos set nome = trim(p_nome), membros = p_membros where id = p_id and restaurante_id = rest_meu_restaurante() returning id into v_id; end if;
  return v_id;
end $$;

-- o que o robô de envio precisa fazer agora (chamado pela função rest-push com a chave de serviço)
create or replace function rest_com_tarefas() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_lib jsonb; v_lemb jsonb; r record; agora_local time := (now() at time zone 'America/Sao_Paulo')::time; silencio boolean;
begin
  -- 1) agendados que chegaram na hora
  for r in select id from rest_comunicados where status = 'agendado' and enviar_em <= now() loop perform rest_com_liberar(r.id); end loop;
  select coalesce(jsonb_agg(jsonb_build_object('comunicado_id', c.id, 'funcionario_id', d.funcionario_id)), '[]') into v_lib
    from rest_comunicado_dest d join rest_comunicados c on c.id = d.comunicado_id
   where c.status = 'enviado' and d.push_enviado_em is null;
  -- 2) lembretes de leitura obrigatória (não durante o descanso noturno, 22h–7h, exceto urgentes; máximo 6 por comunicado)
  silencio := agora_local >= '22:00' or agora_local < '07:00';
  select coalesce(jsonb_agg(jsonb_build_object('comunicado_id', c.id, 'funcionario_id', d.funcionario_id, 'motivo', x.motivo)), '[]') into v_lemb
    from rest_comunicado_dest d join rest_comunicados c on c.id = d.comunicado_id
    cross join lateral (select case
        when c.prazo is not null and d.aviso_final_em is null and c.aviso_final_horas > 0 and now() >= c.prazo - make_interval(hours => c.aviso_final_horas) and now() < c.prazo then 'aviso_final'
        when c.lembrete_horas > 0 and d.lembretes < 6 and now() >= coalesce(d.ultimo_lembrete_em, d.push_enviado_em, d.incluido_em) + make_interval(hours => c.lembrete_horas) and (c.prazo is null or now() < c.prazo) then 'lembrete'
      end as motivo) x
   where c.status = 'enviado' and c.obrigatoria and d.push_enviado_em is not null
     and (d.confirmado_em is null or d.precisa_reconfirmar)
     and x.motivo is not null and (not silencio or c.prioridade = 'urgente');
  return jsonb_build_object('liberar', v_lib, 'lembretes', v_lemb);
end $$;

revoke all on function rest_com_liberar(uuid), rest_com_tarefas() from public, anon, authenticated;
grant execute on function rest_com_criar(jsonb), rest_com_editar(uuid, jsonb, boolean), rest_com_cancelar(uuid, text), rest_com_abrir(uuid, text), rest_com_confirmar(uuid, int, text),
  rest_push_registrar(text, text, jsonb, text, text), rest_push_desativar(text), rest_com_grupo_salvar(uuid, text, uuid[]) to authenticated;
grant select on rest_comunicado_situacao to authenticated;

-- anexos dos comunicados: pasta {restaurante}/comunicados/{id}/ no balde privado; só destinatários e administração leem
create or replace function rest_com_pode_ler_anexo(p_nome text) returns boolean language sql stable security definer set search_path = public as $$
  select (string_to_array(p_nome, '/'))[1] = rest_meu_restaurante()::text and (string_to_array(p_nome, '/'))[2] = 'comunicados'
     and (rest_pode('admin') or exists (select 1 from rest_comunicado_dest d join rest_comunicados c on c.id = d.comunicado_id
            where d.comunicado_id::text = (string_to_array(p_nome, '/'))[3] and d.funcionario_id = rest_meu_funcionario() and c.status <> 'agendado'))
$$;

-- (Supabase) política do balde privado para os anexos — aplicada à parte em comunicados_arquivos.sql
