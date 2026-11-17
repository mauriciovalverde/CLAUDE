-- Agendamento psicológico v2 + proteção de dados (LGPD / sigilo profissional)
-- Fluxo: paciente solicita (PENDENTE) → WhatsApp do Centro com mensagem pronta → psicólogo aprova/recusa no painel.
-- Separação: o psicólogo nunca lê familias/perfis/cpfs; identifica o paciente por código interno (pacientes.codigo).
-- O prontuário fica isolado por profissional (RLS); a administração só lê com autorização do psicólogo, com prazo e log.

create extension if not exists btree_gist;

-- ===================================================================== 1. Perfil do psicólogo
alter table public.psi_perfis
  add column if not exists especialidades text[] not null default '{}',
  add column if not exists modalidades text[] not null default '{online}',
  add column if not exists intervalo_min int not null default 10,
  add column if not exists antecedencia_horas int not null default 2,
  add column if not exists endereco_presencial text;
alter table public.psi_perfis drop constraint if exists psi_modalidades_chk;
alter table public.psi_perfis add constraint psi_modalidades_chk
  check (cardinality(modalidades) > 0 and modalidades <@ array['online','presencial']
         and intervalo_min between 0 and 60 and antecedencia_horas between 0 and 72);

-- ===================================================================== 2. Código interno do paciente
create table if not exists public.pacientes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  familia_id uuid references public.familias(id) on delete set null,  -- some na exclusão da conta; o prontuário fica só com o código
  filho_id uuid references public.filhos(id) on delete set null,
  tipo text not null check (tipo in ('mae','filho','familia')),
  created_at timestamptz not null default now()
);
create unique index if not exists pacientes_unico on public.pacientes (familia_id, tipo, coalesce(filho_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.pacientes enable row level security;

-- ===================================================================== 3. Consultas
do $$ declare r record; begin
  for r in select conname from pg_constraint where conrelid = 'public.consultas'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%status%' loop
    execute format('alter table public.consultas drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.consultas
  add column if not exists paciente_id uuid references public.pacientes(id) on delete set null,
  add column if not exists modalidade text not null default 'online',
  add column if not exists reagendada_de uuid references public.consultas(id) on delete set null,
  add column if not exists decidido_em timestamptz,
  add column if not exists recusa_motivo text,
  add column if not exists atualizado_em timestamptz not null default now();
alter table public.consultas alter column status set default 'pendente';
update public.consultas set status = 'pendente' where status = 'agendada';
alter table public.consultas add constraint consultas_status_chk check (status in
  ('pendente','confirmada','recusada','realizada','falta','cancelada_familia','cancelada_profissional','reagendada'));
alter table public.consultas drop constraint if exists consultas_modalidade_chk;
alter table public.consultas add constraint consultas_modalidade_chk check (modalidade in ('online','presencial'));
-- Um horário só pode estar com uma solicitação/consulta ativa por profissional (à prova de corrida).
alter table public.consultas drop constraint if exists consultas_sem_conflito;
alter table public.consultas add constraint consultas_sem_conflito
  exclude using gist (profissional_id with =, tstzrange(inicio, fim) with &&) where (status in ('pendente','confirmada'));

-- O psicólogo deixa de ler a tabela diretamente (ela tem familia_id/user_id); ele usa consultas_profissional().
drop policy if exists "consultas: ver" on public.consultas;
create policy "consultas: ver" on public.consultas for select
  using (user_id = auth.uid() or public.owns_familia(familia_id) or public.is_staff(auth.uid()));

-- ===================================================================== 4. Segurança de administração (2 etapas)
-- Admin com verificação em duas etapas cadastrada só acessa dados sensíveis com sessão aal2.
create or replace function public.admin_seguro() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
     and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
$$;

create policy "pacientes: admin" on public.pacientes for select using (public.admin_seguro());

-- Tentativas de acesso negadas (no máximo 1 registro por pessoa/recurso a cada 10 min).
create or replace function public.registrar_tentativa_negada(_recurso text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.logs_admin where autor_id = auth.uid() and acao = 'acesso_negado' and alvo = left(_recurso, 80) and created_at > now() - interval '10 minutes') then return; end if;
  insert into public.logs_admin(autor_id, acao, alvo) values (auth.uid(), 'acesso_negado', left(_recurso, 80));
end $$;

drop policy if exists "logs: admin ve" on public.logs_admin;
create policy "logs: admin ve" on public.logs_admin for select using (public.admin_seguro());

-- ===================================================================== 5. Funções internas
create or replace function public._paciente_de(_familia uuid, _tipo text, _filho uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; cod text; alfa text := 'ACDEFGHJKMNPQRTUVWXY3479';
begin
  if _tipo <> 'filho' then _filho := null; end if;
  select id into pid from public.pacientes where familia_id = _familia and tipo = _tipo
     and coalesce(filho_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(_filho, '00000000-0000-0000-0000-000000000000'::uuid);
  if pid is not null then return pid; end if;
  loop
    cod := 'P-' || (select string_agg(substr(alfa, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(alfa)), 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from public.pacientes where codigo = cod);
  end loop;
  insert into public.pacientes(codigo, familia_id, filho_id, tipo) values (cod, _familia, _filho, _tipo) returning id into pid;
  return pid;
end $$;

create or replace function public._quando(_t timestamptz) returns text language sql immutable as $$
  select to_char(_t at time zone 'America/Bahia', 'DD/MM "às" HH24:MI')
$$;

-- ===================================================================== 6. Fila de notificações externas (WhatsApp / e-mail)
create table if not exists public.notificacoes_envios (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid references public.consultas(id) on delete cascade,
  user_id uuid not null,                      -- destinatário; contato é resolvido só no envio, pelo servidor
  canal text not null check (canal in ('whatsapp','email')),
  evento text not null check (evento in ('solicitada','confirmada','recusada','reagendada','cancelada','lembrete_24h','lembrete_2h')),
  agendado_para timestamptz not null default now(),
  status text not null default 'aguardando_integracao' check (status in ('aguardando_integracao','pendente','enviado','falhou','descartado')),
  tentativas int not null default 0,
  ultimo_erro text,
  enviado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists envios_fila on public.notificacoes_envios (status, agendado_para);
alter table public.notificacoes_envios enable row level security;
drop policy if exists "envios: admin ve" on public.notificacoes_envios;
create policy "envios: admin ve" on public.notificacoes_envios for select using (public.admin_seguro());

insert into public.configuracoes(chave, valor, publico) values ('notificacoes_externas_ativas', 'false', false) on conflict (chave) do nothing;

create or replace function public._enfileirar(_consulta uuid, _user uuid, _evento text, _quando timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare st text := case when (select valor from public.configuracoes where chave = 'notificacoes_externas_ativas') = 'true' then 'pendente' else 'aguardando_integracao' end;
begin
  insert into public.notificacoes_envios(consulta_id, user_id, canal, evento, agendado_para, status)
  select _consulta, _user, c, _evento, _quando, st from unnest(array['whatsapp','email']) c;
end $$;

create or replace function public.consultas_notificar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._enfileirar(new.id, new.user_id, case when new.reagendada_de is null then 'solicitada' else 'reagendada' end);
    if new.status = 'confirmada' then
      if new.inicio - interval '24 hours' > now() then perform public._enfileirar(new.id, new.user_id, 'lembrete_24h', new.inicio - interval '24 hours'); end if;
      if new.inicio - interval '2 hours' > now() then perform public._enfileirar(new.id, new.user_id, 'lembrete_2h', new.inicio - interval '2 hours'); end if;
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'confirmada' then
      perform public._enfileirar(new.id, new.user_id, 'confirmada');
      if new.inicio - interval '24 hours' > now() then perform public._enfileirar(new.id, new.user_id, 'lembrete_24h', new.inicio - interval '24 hours'); end if;
      if new.inicio - interval '2 hours' > now() then perform public._enfileirar(new.id, new.user_id, 'lembrete_2h', new.inicio - interval '2 hours'); end if;
    elsif new.status in ('recusada','cancelada_familia','cancelada_profissional','reagendada') then
      update public.notificacoes_envios set status = 'descartado'
        where consulta_id = new.id and evento like 'lembrete%' and status in ('pendente','aguardando_integracao');
      if new.status = 'recusada' then perform public._enfileirar(new.id, new.user_id, 'recusada');
      elsif new.status <> 'reagendada' then perform public._enfileirar(new.id, new.user_id, 'cancelada'); end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists consultas_notificar on public.consultas;
create trigger consultas_notificar after insert or update of status on public.consultas for each row execute function public.consultas_notificar();

create or replace function public.reenviar_notificacao(_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_seguro() then perform public.registrar_tentativa_negada('reenviar_notificacao'); return; end if;
  update public.notificacoes_envios
     set status = case when (select valor from public.configuracoes where chave = 'notificacoes_externas_ativas') = 'true' then 'pendente' else 'aguardando_integracao' end,
         ultimo_erro = null, agendado_para = greatest(agendado_para, now())
   where id = _id and status in ('falhou','aguardando_integracao','descartado');
  insert into public.logs_admin(autor_id, acao, alvo) values (auth.uid(), 'notificacao_reenviada', _id::text);
end $$;

-- ===================================================================== 7. Horários livres (duração + intervalo + antecedência)
create or replace function public.horarios_livres(_prof uuid, _de date, _ate date)
returns table(inicio timestamptz, fim timestamptz)
language sql stable security definer set search_path = public as $$
  with p as (select * from public.psi_perfis where user_id = _prof and (ativo or user_id = auth.uid())),
  dias as (select d::date dia from generate_series(_de, least(_ate, _de + 60), interval '1 day') d),
  slots as (
    select (s at time zone 'America/Bahia') ini, p.duracao_min dur, p.antecedencia_horas ant
    from dias
    join public.psi_disponibilidade a on a.profissional_id = _prof and a.dia_semana = extract(dow from dias.dia)
    cross join p
    cross join lateral generate_series(dias.dia + a.hora_inicio, dias.dia + a.hora_fim - make_interval(mins => p.duracao_min),
                                       make_interval(mins => p.duracao_min + p.intervalo_min)) s
  )
  select ini, ini + make_interval(mins => dur)
  from slots
  where ini > now() + make_interval(hours => ant)
    and not exists (select 1 from public.consultas c where c.profissional_id = _prof and c.status in ('pendente','confirmada')
                    and c.inicio < slots.ini + make_interval(mins => dur) and c.fim > slots.ini)
    and not exists (select 1 from public.psi_bloqueios b where b.profissional_id = _prof and b.inicio < slots.ini + make_interval(mins => dur) and b.fim > slots.ini)
  order by 1
$$;

-- ===================================================================== 8. Solicitar (paciente)
drop function if exists public.agendar_consulta(uuid, timestamptz, text, uuid, text);
create or replace function public.solicitar_consulta(_prof uuid, _inicio timestamptz, _para_quem text, _filho uuid, _modalidade text, _motivo text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare f public.familias; p public.psi_perfis; fi public.filhos; cid uuid; pid uuid; _fim timestamptz; nome text; nasc date;
begin
  select * into f from public.familias where user_id = auth.uid();
  if not found or f.status <> 'aprovado' then raise exception 'Seu cadastro precisa estar confirmado pela equipe para agendar.'; end if;
  select * into p from public.psi_perfis where user_id = _prof and ativo;
  if not found then raise exception 'Profissional indisponível.'; end if;
  if coalesce(_modalidade, 'online') <> all(p.modalidades) then raise exception 'Este profissional não atende nessa modalidade.'; end if;
  if coalesce(_para_quem, 'mae') <> 'mae' then raise exception 'O atendimento é só para o titular do cadastro.'; end if; _para_quem := 'mae'; _filho := null;
  if not p.aceita_novos and not exists (select 1 from public.consultas where profissional_id = _prof and familia_id = f.id and status in ('realizada','confirmada','pendente')) then
    raise exception 'Este profissional não está recebendo novas famílias no momento.';
  end if;
  if (select count(*) from public.consultas where familia_id = f.id and status in ('pendente','confirmada') and inicio > now()) >= 2 then
    raise exception 'Sua família já tem 2 consultas marcadas ou aguardando confirmação.';
  end if;
  if not exists (select 1 from public.horarios_livres(_prof, (_inicio at time zone 'America/Bahia')::date, (_inicio at time zone 'America/Bahia')::date) h where h.inicio = _inicio) then
    raise exception 'Este horário acabou de ser ocupado. Escolha outro.';
  end if;
  if _para_quem = 'filho' then
    select * into fi from public.filhos where id = _filho and familia_id = f.id;
    if not found then raise exception 'Escolha a criança.'; end if;
    nome := fi.nome; nasc := fi.nascimento;
  else
    _filho := null; nome := f.mae_nome; nasc := f.mae_nascimento;
  end if;
  pid := public._paciente_de(f.id, coalesce(_para_quem, 'mae'), _filho);
  _fim := _inicio + make_interval(mins => p.duracao_min);
  insert into public.consultas(profissional_id, familia_id, user_id, filho_id, para_quem, paciente_id, inicio, fim, status, modalidade, motivo)
    values (_prof, f.id, auth.uid(), _filho, coalesce(_para_quem, 'mae'), pid, _inicio, _fim, 'pendente', coalesce(_modalidade, 'online'), left(_motivo, 1000))
    returning id into cid;
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values
    (_prof, 'Nova solicitação de consulta', (select codigo from public.pacientes where id = pid) || ' · ' || public._quando(_inicio) || ' · aguardando sua confirmação', '/atendimentos', 'consultas'),
    (auth.uid(), 'Solicitação enviada', 'Com ' || p.nome || ' em ' || public._quando(_inicio) || '. Aguarde a confirmação do profissional.', '/consultas', 'consultas');
  return jsonb_build_object(
    'id', cid, 'nome', nome, 'nascimento', nasc, 'telefone', f.mae_telefone,
    'psicologo', p.nome, 'inicio', _inicio, 'modalidade', coalesce(_modalidade, 'online'),
    'whatsapp', coalesce(nullif((select valor from public.configuracoes where chave = 'whatsapp_agendamento'), ''),
                         nullif((select valor from public.configuracoes where chave = 'numero_confirmacao'), ''), '5573933002471'));
end $$;

-- ===================================================================== 9. Decidir / atualizar / cancelar / reagendar (psicólogo)
create or replace function public.decidir_consulta(_id uuid, _aceitar boolean, _motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c public.consultas; p public.psi_perfis; sala text; aid uuid;
begin
  select * into c from public.consultas where id = _id for update;
  if not found or not (c.profissional_id = auth.uid() or public.is_staff(auth.uid())) then
    perform public.registrar_tentativa_negada('decidir_consulta'); return;
  end if;
  if c.status <> 'pendente' then raise exception 'Esta solicitação já foi respondida.'; end if;
  select * into p from public.psi_perfis where user_id = c.profissional_id;
  if _aceitar then
    if c.inicio < now() then raise exception 'O horário já passou. Recuse ou reagende.'; end if;
    sala := case when c.modalidade = 'presencial' then null
                 else coalesce(nullif(p.link_sala, ''), 'https://meet.jit.si/centro-acolhimento-' || replace(gen_random_uuid()::text, '-', '')) end;
    insert into public.agenda(familia_id, filho_id, titulo, tipo, inicio, repeticao, lembrete_min, local, notas)
      values (c.familia_id, c.filho_id, 'Consulta com ' || p.nome, 'consulta', c.inicio, 'nao', 60,
              case when c.modalidade = 'presencial' then coalesce(p.endereco_presencial, 'Presencial') else 'Online · abra em Consultas' end, c.motivo)
      returning id into aid;
    update public.consultas set status = 'confirmada', link_video = sala, agenda_id = aid, decidido_em = now(), atualizado_em = now() where id = _id;
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
      values (c.user_id, 'Consulta confirmada', p.nome || ' confirmou sua consulta de ' || public._quando(c.inicio) || '.', '/consultas', 'consultas');
  else
    update public.consultas set status = 'recusada', recusa_motivo = left(_motivo, 500), decidido_em = now(), atualizado_em = now() where id = _id;
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
      values (c.user_id, 'Horário não disponível', p.nome || ' não pôde atender em ' || public._quando(c.inicio) || coalesce(' · ' || nullif(_motivo, ''), '') || '. Escolha outro horário.', '/consultas', 'consultas');
  end if;
end $$;

create or replace function public.atualizar_consulta(_id uuid, _status text, _link text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c public.consultas;
begin
  select * into c from public.consultas where id = _id;
  if not found or not (c.profissional_id = auth.uid() or public.is_staff(auth.uid())) then
    perform public.registrar_tentativa_negada('atualizar_consulta'); return;
  end if;
  if _status not in ('realizada','falta') then raise exception 'Status inválido.'; end if;
  if c.status not in ('confirmada','realizada','falta') then raise exception 'Só consultas confirmadas podem ser marcadas.'; end if;
  if c.inicio > now() then raise exception 'A consulta ainda não aconteceu.'; end if;
  update public.consultas set status = _status, link_video = coalesce(nullif(_link, ''), link_video), atualizado_em = now() where id = _id;
end $$;

create or replace function public.cancelar_consulta(_id uuid, _motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.consultas; eh_prof boolean;
begin
  select * into c from public.consultas where id = _id;
  if not found then raise exception 'Consulta não encontrada.'; end if;
  eh_prof := c.profissional_id = auth.uid() or public.is_staff(auth.uid());
  if not eh_prof and not public.owns_familia(c.familia_id) then perform public.registrar_tentativa_negada('cancelar_consulta'); return; end if;
  if c.status not in ('pendente','confirmada') then raise exception 'Esta consulta não pode mais ser cancelada.'; end if;
  update public.consultas set status = case when eh_prof then 'cancelada_profissional' else 'cancelada_familia' end,
         cancelado_motivo = left(_motivo, 500), atualizado_em = now() where id = _id;
  if c.agenda_id is not null then delete from public.agenda where id = c.agenda_id; end if;
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
  values (case when eh_prof then c.user_id else c.profissional_id end, 'Consulta cancelada',
          public._quando(c.inicio) || case when eh_prof then coalesce(' · ' || nullif(_motivo, ''), '') else ' · ' || coalesce((select codigo from public.pacientes where id = c.paciente_id), 'paciente') end,
          case when eh_prof then '/consultas' else '/atendimentos' end, 'consultas');
end $$;

create or replace function public.reagendar_consulta(_id uuid, _novo_inicio timestamptz, _motivo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.consultas; p public.psi_perfis; nid uuid; aid uuid; sala text;
begin
  select * into c from public.consultas where id = _id for update;
  if not found or not (c.profissional_id = auth.uid() or public.is_staff(auth.uid())) then
    perform public.registrar_tentativa_negada('reagendar_consulta'); return null;
  end if;
  if c.status not in ('pendente','confirmada') then raise exception 'Esta consulta não pode ser reagendada.'; end if;
  select * into p from public.psi_perfis where user_id = c.profissional_id;
  update public.consultas set status = 'reagendada', cancelado_motivo = left(_motivo, 500), atualizado_em = now() where id = _id;
  if c.agenda_id is not null then delete from public.agenda where id = c.agenda_id; end if;
  if not exists (select 1 from public.horarios_livres(c.profissional_id, (_novo_inicio at time zone 'America/Bahia')::date, (_novo_inicio at time zone 'America/Bahia')::date) h where h.inicio = _novo_inicio) then
    raise exception 'O novo horário não está livre.';
  end if;
  sala := case when c.modalidade = 'presencial' then null else coalesce(nullif(p.link_sala, ''), 'https://meet.jit.si/centro-acolhimento-' || replace(gen_random_uuid()::text, '-', '')) end;
  insert into public.agenda(familia_id, filho_id, titulo, tipo, inicio, repeticao, lembrete_min, local, notas)
    values (c.familia_id, c.filho_id, 'Consulta com ' || p.nome, 'consulta', _novo_inicio, 'nao', 60,
            case when c.modalidade = 'presencial' then coalesce(p.endereco_presencial, 'Presencial') else 'Online · abra em Consultas' end, c.motivo)
    returning id into aid;
  insert into public.consultas(profissional_id, familia_id, user_id, filho_id, para_quem, paciente_id, inicio, fim, status, modalidade, motivo, link_video, agenda_id, reagendada_de, decidido_em)
    values (c.profissional_id, c.familia_id, c.user_id, c.filho_id, c.para_quem, c.paciente_id, _novo_inicio, _novo_inicio + make_interval(mins => p.duracao_min),
            'confirmada', c.modalidade, c.motivo, sala, aid, c.id, now())
    returning id into nid;
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
    values (c.user_id, 'Consulta reagendada', p.nome || ' remarcou sua consulta de ' || public._quando(c.inicio) || ' para ' || public._quando(_novo_inicio) || coalesce(' · ' || nullif(_motivo, ''), '') || '.', '/consultas', 'consultas');
  return nid;
end $$;

-- ===================================================================== 10. Agenda do psicólogo (sem dados de contato)
drop function if exists public.consultas_profissional(timestamptz, timestamptz);
create or replace function public.consultas_profissional(_de timestamptz, _ate timestamptz)
returns table(id uuid, inicio timestamptz, fim timestamptz, status text, motivo text, link_video text, modalidade text, para_quem text,
              paciente_id uuid, paciente_codigo text, paciente_nome text, paciente_idade int, total_anteriores int, recusa_motivo text, cancelado_motivo text)
language sql stable security definer set search_path = public as $$
  select c.id, c.inicio, c.fim, c.status, c.motivo, c.link_video, c.modalidade, c.para_quem,
         c.paciente_id, pa.codigo,
         split_part(case when c.para_quem = 'filho' then fi.nome else f.mae_nome end, ' ', 1),
         extract(year from age(case when c.para_quem = 'filho' then fi.nascimento else f.mae_nascimento end))::int,
         (select count(*)::int from public.consultas x where x.paciente_id = c.paciente_id and x.profissional_id = c.profissional_id and x.status = 'realizada' and x.inicio < c.inicio),
         c.recusa_motivo, c.cancelado_motivo
  from public.consultas c
  left join public.pacientes pa on pa.id = c.paciente_id
  left join public.familias f on f.id = c.familia_id
  left join public.filhos fi on fi.id = c.filho_id
  where c.profissional_id = auth.uid() and c.inicio >= _de and c.inicio < _ate
  order by c.inicio
$$;

-- ===================================================================== 11. Prontuário (ficha clínica + evolução)
drop table if exists public.consulta_notas;

-- Carteira: vínculo psicólogo ↔ paciente, criado quando a primeira consulta é confirmada.
-- Persiste mesmo se a família excluir a conta, para o profissional cumprir a guarda do prontuário (Res. CFP 01/2009).
create table if not exists public.psi_carteira (
  profissional_id uuid not null,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  desde timestamptz not null default now(),
  primary key (profissional_id, paciente_id)
);
alter table public.psi_carteira enable row level security;
drop policy if exists "carteira: propria" on public.psi_carteira;
create policy "carteira: propria" on public.psi_carteira for select using (profissional_id = auth.uid());

create or replace function public.carteira_ao_confirmar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmada' and new.paciente_id is not null then
    insert into public.psi_carteira(profissional_id, paciente_id) values (new.profissional_id, new.paciente_id) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists carteira_ao_confirmar on public.consultas;
create trigger carteira_ao_confirmar after insert or update of status on public.consultas for each row execute function public.carteira_ao_confirmar();

create or replace function public.psi_atende(_paciente uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.psi_carteira where paciente_id = _paciente and profissional_id = auth.uid())
$$;

create table if not exists public.prontuario_fichas (
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  profissional_id uuid not null,
  queixa text, historico text, contexto_familiar text, hipoteses text, plano text, observacoes text,
  updated_at timestamptz not null default now(),
  primary key (paciente_id, profissional_id)
);
create table if not exists public.prontuario_registros (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  profissional_id uuid not null,
  consulta_id uuid references public.consultas(id) on delete set null,
  tipo text not null default 'evolucao' check (tipo in ('evolucao','anotacao','documento')),
  titulo text,
  texto text not null check (length(texto) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pront_reg_idx on public.prontuario_registros (paciente_id, profissional_id, created_at desc);
alter table public.prontuario_fichas enable row level security;
alter table public.prontuario_registros enable row level security;
-- Somente o psicólogo responsável. Nenhuma política para equipe/admin: acesso só pela função com autorização.
drop policy if exists "ficha: responsavel" on public.prontuario_fichas;
create policy "ficha: responsavel" on public.prontuario_fichas for all
  using (profissional_id = auth.uid() and public.psi_atende(paciente_id))
  with check (profissional_id = auth.uid() and public.psi_atende(paciente_id));
drop policy if exists "registros: ler" on public.prontuario_registros;
create policy "registros: ler" on public.prontuario_registros for select using (profissional_id = auth.uid() and public.psi_atende(paciente_id));
drop policy if exists "registros: criar" on public.prontuario_registros;
create policy "registros: criar" on public.prontuario_registros for insert with check (profissional_id = auth.uid() and public.psi_atende(paciente_id));
drop policy if exists "registros: editar" on public.prontuario_registros;
create policy "registros: editar" on public.prontuario_registros for update
  using (profissional_id = auth.uid() and public.psi_atende(paciente_id)) with check (profissional_id = auth.uid() and public.psi_atende(paciente_id));
-- Sem DELETE: registros de prontuário não são apagados (guarda mínima de 5 anos).

create or replace function public.meus_pacientes()
returns table(paciente_id uuid, codigo text, nome text, idade int, tipo text, desde timestamptz, ultima timestamptz, proxima timestamptz, realizadas int)
language sql stable security definer set search_path = public as $$
  select pa.id, pa.codigo,
         coalesce(split_part(case when pa.tipo = 'filho' then fi.nome else f.mae_nome end, ' ', 1), 'Paciente'),
         extract(year from age(case when pa.tipo = 'filho' then fi.nascimento else f.mae_nascimento end))::int,
         pa.tipo, k.desde,
         (select max(c.inicio) from public.consultas c where c.paciente_id = pa.id and c.profissional_id = auth.uid() and c.status in ('realizada','falta')),
         (select min(c.inicio) from public.consultas c where c.paciente_id = pa.id and c.profissional_id = auth.uid() and c.status = 'confirmada' and c.inicio > now()),
         (select count(*)::int from public.consultas c where c.paciente_id = pa.id and c.profissional_id = auth.uid() and c.status = 'realizada')
  from public.psi_carteira k
  join public.pacientes pa on pa.id = k.paciente_id
  left join public.familias f on f.id = pa.familia_id
  left join public.filhos fi on fi.id = pa.filho_id
  where k.profissional_id = auth.uid()
  order by 7 desc nulls last
$$;

-- ===================================================================== 12. Acesso clínico da administração (com autorização)
create table if not exists public.acessos_clinicos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  solicitante_id uuid not null,
  profissional_id uuid not null,
  motivo text not null check (length(motivo) >= 15),
  status text not null default 'pendente' check (status in ('pendente','autorizado','negado','encerrado')),
  expira_em timestamptz,
  created_at timestamptz not null default now(),
  decidido_em timestamptz
);
alter table public.acessos_clinicos enable row level security;
drop policy if exists "acessos: envolvidos" on public.acessos_clinicos;
create policy "acessos: envolvidos" on public.acessos_clinicos for select
  using (profissional_id = auth.uid() or (solicitante_id = auth.uid() and public.admin_seguro()));

create or replace function public.solicitar_acesso_clinico(_codigo text, _motivo text) returns int
language plpgsql security definer set search_path = public as $$
declare pid uuid; n int := 0; r record;
begin
  if not public.admin_seguro() then perform public.registrar_tentativa_negada('solicitar_acesso_clinico'); return 0; end if;
  if length(coalesce(_motivo, '')) < 15 then raise exception 'Descreva a necessidade (mínimo 15 caracteres).'; end if;
  select id into pid from public.pacientes where codigo = upper(trim(_codigo));
  if pid is null then raise exception 'Código de paciente não encontrado.'; end if;
  for r in select profissional_id from public.psi_carteira where paciente_id = pid loop
    insert into public.acessos_clinicos(paciente_id, solicitante_id, profissional_id, motivo) values (pid, auth.uid(), r.profissional_id, _motivo);
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
      values (r.profissional_id, 'Pedido de acesso ao prontuário', upper(trim(_codigo)) || ' · ' || left(_motivo, 120), '/atendimentos', 'consultas');
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Este paciente ainda não tem prontuário com nenhum psicólogo.'; end if;
  insert into public.logs_admin(autor_id, acao, alvo, detalhes) values (auth.uid(), 'acesso_clinico_solicitado', upper(trim(_codigo)), left(_motivo, 300));
  return n;
end $$;

create or replace function public.decidir_acesso_clinico(_id uuid, _autorizar boolean, _dias int default 7) returns void
language plpgsql security definer set search_path = public as $$
declare a public.acessos_clinicos;
begin
  select * into a from public.acessos_clinicos where id = _id;
  if not found or a.profissional_id <> auth.uid() then perform public.registrar_tentativa_negada('decidir_acesso_clinico'); return; end if;
  if a.status <> 'pendente' and _autorizar then raise exception 'Pedido já respondido.'; end if;
  update public.acessos_clinicos
     set status = case when _autorizar then 'autorizado' when a.status = 'autorizado' then 'encerrado' else 'negado' end,
         expira_em = case when _autorizar then now() + make_interval(days => least(greatest(coalesce(_dias, 7), 1), 30)) else a.expira_em end,
         decidido_em = now()
   where id = _id;
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
    values (a.solicitante_id, case when _autorizar then 'Acesso ao prontuário autorizado' else 'Acesso ao prontuário negado/encerrado' end,
            (select codigo from public.pacientes where id = a.paciente_id), '/admin?aba=teleconsultas', 'consultas');
end $$;

create or replace function public.prontuario_autorizado(_acesso uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.acessos_clinicos;
begin
  select * into a from public.acessos_clinicos where id = _acesso;
  if not found or a.solicitante_id <> auth.uid() or not public.admin_seguro() or a.status <> 'autorizado' or a.expira_em < now() then
    perform public.registrar_tentativa_negada('prontuario_autorizado');
    return null;
  end if;
  insert into public.logs_admin(autor_id, acao, alvo, detalhes)
    values (auth.uid(), 'prontuario_lido', (select codigo from public.pacientes where id = a.paciente_id), 'autorização ' || a.id::text);
  return jsonb_build_object(
    'codigo', (select codigo from public.pacientes where id = a.paciente_id),
    'profissional', (select nome from public.psi_perfis where user_id = a.profissional_id),
    'expira_em', a.expira_em,
    'ficha', (select to_jsonb(x) - 'profissional_id' from public.prontuario_fichas x where x.paciente_id = a.paciente_id and x.profissional_id = a.profissional_id),
    'registros', coalesce((select jsonb_agg(jsonb_build_object('tipo', r.tipo, 'titulo', r.titulo, 'texto', r.texto, 'data', r.created_at) order by r.created_at desc)
                           from public.prontuario_registros r where r.paciente_id = a.paciente_id and r.profissional_id = a.profissional_id), '[]'));
end $$;

-- Código do paciente para a equipe administrativa (agenda geral)
create or replace function public.consultas_admin(_de timestamptz, _ate timestamptz)
returns table(id uuid, inicio timestamptz, status text, modalidade text, profissional text, paciente_codigo text, familia_numero text, familia_nome text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then return; end if;
  return query
    select c.id, c.inicio, c.status, c.modalidade, p.nome, pa.codigo, f.numero, f.mae_nome
    from public.consultas c join public.psi_perfis p on p.user_id = c.profissional_id
    left join public.pacientes pa on pa.id = c.paciente_id left join public.familias f on f.id = c.familia_id
    where c.inicio >= _de and c.inicio < _ate order by c.inicio;
end $$;

-- ===================================================================== 13. Solicitações de titulares (LGPD art. 18)
create table if not exists public.lgpd_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('acesso','correcao','exclusao','portabilidade','revogacao','informacao','oposicao','prontuario')),
  detalhes text check (length(detalhes) <= 2000),
  status text not null default 'aberta' check (status in ('aberta','em_andamento','concluida','negada')),
  resposta text,
  respondido_por uuid,
  created_at timestamptz not null default now(),
  respondido_em timestamptz
);
alter table public.lgpd_solicitacoes enable row level security;
drop policy if exists "lgpd: titular ve" on public.lgpd_solicitacoes;
create policy "lgpd: titular ve" on public.lgpd_solicitacoes for select using (user_id = auth.uid() or public.admin_seguro());
drop policy if exists "lgpd: titular cria" on public.lgpd_solicitacoes;
create policy "lgpd: titular cria" on public.lgpd_solicitacoes for insert with check (user_id = auth.uid() and status = 'aberta' and resposta is null);
drop policy if exists "lgpd: admin responde" on public.lgpd_solicitacoes;
create policy "lgpd: admin responde" on public.lgpd_solicitacoes for update using (public.admin_seguro()) with check (public.admin_seguro());

create or replace function public.lgpd_notificar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
      select ur.user_id, 'Nova solicitação LGPD', 'Tipo: ' || new.tipo || '. Prazo legal de resposta: 15 dias.', '/admin?aba=lgpd', 'sistema'
      from public.user_roles ur where ur.role = 'admin';
  elsif new.status is distinct from old.status and new.user_id is not null then
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
      values (new.user_id, 'Sua solicitação de privacidade foi atualizada', coalesce(new.resposta, new.status), '/perfil', 'sistema');
    insert into public.logs_admin(autor_id, acao, alvo, detalhes) values (auth.uid(), 'lgpd_respondida', new.id::text, new.status);
  end if;
  return new;
end $$;
drop trigger if exists lgpd_notificar on public.lgpd_solicitacoes;
create trigger lgpd_notificar after insert or update on public.lgpd_solicitacoes for each row execute function public.lgpd_notificar();

-- ===================================================================== 14. Permissões de execução
revoke execute on function public._paciente_de(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public._enfileirar(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.consultas_notificar() from public, anon, authenticated;
revoke execute on function public.carteira_ao_confirmar() from public, anon, authenticated;
revoke execute on function public.lgpd_notificar() from public, anon, authenticated;
revoke all on public.pacientes, public.psi_carteira, public.prontuario_fichas, public.prontuario_registros,
              public.acessos_clinicos, public.notificacoes_envios, public.lgpd_solicitacoes from anon;
revoke insert, update, delete on public.pacientes, public.psi_carteira, public.acessos_clinicos, public.notificacoes_envios from authenticated;
revoke delete on public.prontuario_registros, public.prontuario_fichas, public.lgpd_solicitacoes from authenticated;
do $$ declare f text; begin
  foreach f in array array['solicitar_consulta(uuid,timestamptz,text,uuid,text,text)','decidir_consulta(uuid,boolean,text)','atualizar_consulta(uuid,text,text)',
    'cancelar_consulta(uuid,text)','reagendar_consulta(uuid,timestamptz,text)','consultas_profissional(timestamptz,timestamptz)','meus_pacientes()',
    'solicitar_acesso_clinico(text,text)','decidir_acesso_clinico(uuid,boolean,int)','prontuario_autorizado(uuid)','consultas_admin(timestamptz,timestamptz)',
    'reenviar_notificacao(uuid)','registrar_tentativa_negada(text)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

-- ===================================================================== 15. Agenda por DATA (psicólogo escolhe datas e horários livres)
create table if not exists public.psi_datas (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.psi_perfis(user_id) on delete cascade,
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  created_at timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);
create index if not exists psi_datas_idx on public.psi_datas (profissional_id, data);
alter table public.psi_datas enable row level security;
drop policy if exists "datas: ver" on public.psi_datas;
create policy "datas: ver" on public.psi_datas for select using (true);
drop policy if exists "datas: dono" on public.psi_datas;
create policy "datas: dono" on public.psi_datas for all
  using (profissional_id = auth.uid() or public.is_staff(auth.uid()))
  with check (profissional_id = auth.uid() or public.is_staff(auth.uid()));
revoke all on public.psi_datas from anon;

create or replace function public.horarios_livres(_prof uuid, _de date, _ate date)
returns table(inicio timestamptz, fim timestamptz)
language sql stable security definer set search_path = public as $$
  with p as (select * from public.psi_perfis where user_id = _prof and (ativo or user_id = auth.uid())),
  dias as (select d::date dia from generate_series(_de, least(_ate, _de + 90), interval '1 day') d),
  faixas as (
    select dias.dia, a.hora_inicio, a.hora_fim from dias
      join public.psi_disponibilidade a on a.profissional_id = _prof and a.dia_semana = extract(dow from dias.dia)
    union all
    select d.data, d.hora_inicio, d.hora_fim from public.psi_datas d
      where d.profissional_id = _prof and d.data between _de and least(_ate, _de + 90)
  ),
  slots as (
    select distinct (s at time zone 'America/Bahia') ini, p.duracao_min dur, p.antecedencia_horas ant
    from faixas cross join p
    cross join lateral generate_series(faixas.dia + faixas.hora_inicio, faixas.dia + faixas.hora_fim - make_interval(mins => p.duracao_min),
                                       make_interval(mins => p.duracao_min + p.intervalo_min)) s
  )
  select ini, ini + make_interval(mins => dur)
  from slots
  where ini > now() + make_interval(hours => ant)
    and not exists (select 1 from public.consultas c where c.profissional_id = _prof and c.status in ('pendente','confirmada')
                    and c.inicio < slots.ini + make_interval(mins => dur) and c.fim > slots.ini)
    and not exists (select 1 from public.psi_bloqueios b where b.profissional_id = _prof and b.inicio < slots.ini + make_interval(mins => dur) and b.fim > slots.ini)
  order by 1
$$;
