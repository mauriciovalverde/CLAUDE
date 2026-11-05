-- Teleconsultas com psicólogos: perfis, disponibilidade, bloqueios, consultas e notas privadas.
-- Horários de atendimento são cadastrados no fuso America/Bahia (UTC-3).

create table if not exists public.psi_perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  registro text not null,             -- CRP
  abordagem text,
  bio text,
  foto_url text,
  duracao_min int not null default 50 check (duracao_min between 20 and 120),
  link_sala text,                     -- sala fixa opcional (Meet/Zoom); sem ela o app gera sala Jitsi
  aceita_novos boolean not null default true,
  ativo boolean not null default false,  -- liberado pela equipe após conferir o CRP
  created_at timestamptz not null default now()
);

create table if not exists public.psi_disponibilidade (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.psi_perfis(user_id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6),  -- 0 = domingo
  hora_inicio time not null,
  hora_fim time not null,
  check (hora_fim > hora_inicio)
);

create table if not exists public.psi_bloqueios (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.psi_perfis(user_id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  motivo text,
  check (fim > inicio)
);

create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.psi_perfis(user_id) on delete cascade,
  familia_id uuid not null references public.familias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  filho_id uuid references public.filhos(id) on delete set null,
  para_quem text not null default 'mae' check (para_quem in ('mae','filho','familia')),
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'agendada'
    check (status in ('agendada','confirmada','realizada','falta','cancelada_familia','cancelada_profissional')),
  motivo text,
  link_video text,
  cancelado_motivo text,
  agenda_id uuid,
  created_at timestamptz not null default now()
);
-- impede dois agendamentos ativos no mesmo horário do mesmo profissional
create unique index if not exists consultas_slot_unico on public.consultas (profissional_id, inicio)
  where status in ('agendada','confirmada');
create index if not exists consultas_familia on public.consultas (familia_id, inicio);

create table if not exists public.consulta_notas (
  consulta_id uuid primary key references public.consultas(id) on delete cascade,
  profissional_id uuid not null,
  texto text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.psi_perfis enable row level security;
alter table public.psi_disponibilidade enable row level security;
alter table public.psi_bloqueios enable row level security;
alter table public.consultas enable row level security;
alter table public.consulta_notas enable row level security;

-- Perfis: ativos visíveis para quem está logado; dono e equipe gerenciam.
drop policy if exists "psi: ver" on public.psi_perfis;
create policy "psi: ver" on public.psi_perfis for select to authenticated
  using (ativo or user_id = auth.uid() or public.is_staff(auth.uid()));
drop policy if exists "psi: criar proprio" on public.psi_perfis;
create policy "psi: criar proprio" on public.psi_perfis for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "psi: editar" on public.psi_perfis;
create policy "psi: editar" on public.psi_perfis for update to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid())) with check (user_id = auth.uid() or public.is_staff(auth.uid()));
drop policy if exists "psi: equipe apaga" on public.psi_perfis;
create policy "psi: equipe apaga" on public.psi_perfis for delete to authenticated using (public.is_staff(auth.uid()));

create or replace function public.psi_perfis_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then
    new.ativo := case when tg_op = 'INSERT' then false else old.ativo end;
  end if;
  -- ao ativar, o psicólogo ganha o papel "profissional"
  if new.ativo and (tg_op = 'INSERT' or not old.ativo) then
    insert into public.user_roles(user_id, role) values (new.user_id, 'profissional') on conflict do nothing;
    insert into public.notificacoes(user_id, titulo, mensagem, link)
      values (new.user_id, 'Perfil de teleconsulta liberado', 'A equipe validou seu CRP. As famílias já podem agendar com você.', '/atendimentos');
  end if;
  return new;
end $$;
drop trigger if exists psi_perfis_guard on public.psi_perfis;
create trigger psi_perfis_guard before insert or update on public.psi_perfis
  for each row execute function public.psi_perfis_guard();

drop policy if exists "disp: ver" on public.psi_disponibilidade;
create policy "disp: ver" on public.psi_disponibilidade for select to authenticated using (true);
drop policy if exists "disp: dono" on public.psi_disponibilidade;
create policy "disp: dono" on public.psi_disponibilidade for all to authenticated
  using (profissional_id = auth.uid() or public.is_staff(auth.uid()))
  with check (profissional_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists "bloq: dono" on public.psi_bloqueios;
create policy "bloq: dono" on public.psi_bloqueios for all to authenticated
  using (profissional_id = auth.uid() or public.is_staff(auth.uid()))
  with check (profissional_id = auth.uid() or public.is_staff(auth.uid()));

-- Consultas: só leitura direta; criar/alterar apenas pelas funções abaixo.
drop policy if exists "consultas: ver" on public.consultas;
create policy "consultas: ver" on public.consultas for select to authenticated
  using (user_id = auth.uid() or public.owns_familia(familia_id) or profissional_id = auth.uid() or public.is_staff(auth.uid()));

-- Notas clínicas: somente o próprio psicólogo (nem a equipe vê).
drop policy if exists "notas: psicologo" on public.consulta_notas;
create policy "notas: psicologo" on public.consulta_notas for all to authenticated
  using (profissional_id = auth.uid()) with check (profissional_id = auth.uid());

-- Horários livres de um psicólogo entre duas datas (antecedência mínima de 2 horas).
create or replace function public.horarios_livres(_prof uuid, _de date, _ate date)
returns table(inicio timestamptz, fim timestamptz)
language sql stable security definer set search_path = public as $$
  with p as (select * from public.psi_perfis where user_id = _prof and ativo),
  dias as (select d::date dia from generate_series(_de, least(_ate, _de + 60), interval '1 day') d),
  slots as (
    select (s at time zone 'America/Bahia') ini, p.duracao_min dur
    from dias
    join public.psi_disponibilidade a on a.profissional_id = _prof and a.dia_semana = extract(dow from dias.dia)
    cross join p
    cross join lateral generate_series(dias.dia + a.hora_inicio, dias.dia + a.hora_fim - make_interval(mins => p.duracao_min),
                                       make_interval(mins => p.duracao_min)) s
  )
  select ini, ini + make_interval(mins => dur)
  from slots
  where ini > now() + interval '2 hours'
    and not exists (select 1 from public.consultas c where c.profissional_id = _prof and c.status in ('agendada','confirmada')
                    and c.inicio < slots.ini + make_interval(mins => dur) and c.fim > slots.ini)
    and not exists (select 1 from public.psi_bloqueios b where b.profissional_id = _prof
                    and b.inicio < slots.ini + make_interval(mins => dur) and b.fim > slots.ini)
  order by 1
$$;

create or replace function public.agendar_consulta(_prof uuid, _inicio timestamptz, _para_quem text, _filho uuid, _motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare f public.familias; p public.psi_perfis; _fim timestamptz; cid uuid; aid uuid; sala text;
begin
  select * into f from public.familias where user_id = auth.uid();
  if not found or f.status <> 'aprovado' then raise exception 'Seu cadastro precisa estar confirmado pela equipe para agendar.'; end if;
  select * into p from public.psi_perfis where user_id = _prof and ativo;
  if not found then raise exception 'Profissional indisponível.'; end if;
  if not p.aceita_novos and not exists (select 1 from public.consultas where profissional_id = _prof and familia_id = f.id and status in ('realizada','agendada','confirmada')) then
    raise exception 'Este profissional não está recebendo novas famílias no momento.';
  end if;
  if (select count(*) from public.consultas where familia_id = f.id and status in ('agendada','confirmada') and inicio > now()) >= 2 then
    raise exception 'Sua família já tem 2 consultas marcadas. Aguarde uma delas acontecer para marcar outra.';
  end if;
  if not exists (select 1 from public.horarios_livres(_prof, (_inicio at time zone 'America/Bahia')::date, (_inicio at time zone 'America/Bahia')::date) h where h.inicio = _inicio) then
    raise exception 'Este horário acabou de ser ocupado. Escolha outro.';
  end if;
  if _filho is not null and not exists (select 1 from public.filhos where id = _filho and familia_id = f.id) then
    raise exception 'Criança inválida.';
  end if;
  _fim := _inicio + make_interval(mins => p.duracao_min);
  sala := coalesce(nullif(p.link_sala, ''), 'https://meet.jit.si/centro-acolhimento-' || replace(gen_random_uuid()::text, '-', ''));
  insert into public.agenda(familia_id, filho_id, titulo, tipo, inicio, repeticao, lembrete_min, local, notas)
    values (f.id, _filho, 'Teleconsulta com ' || p.nome, 'consulta', _inicio, 'nao', 60, 'Online · abra em Consultas', _motivo)
    returning id into aid;
  insert into public.consultas(profissional_id, familia_id, user_id, filho_id, para_quem, inicio, fim, motivo, link_video, agenda_id)
    values (_prof, f.id, auth.uid(), _filho, coalesce(_para_quem, 'mae'), _inicio, _fim, left(_motivo, 1000), sala, aid)
    returning id into cid;
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria) values
    (_prof, 'Nova teleconsulta agendada', f.mae_nome || ' · ' || to_char(_inicio at time zone 'America/Bahia', 'DD/MM "às" HH24:MI'), '/atendimentos', 'consultas'),
    (auth.uid(), 'Teleconsulta agendada', 'Com ' || p.nome || ' em ' || to_char(_inicio at time zone 'America/Bahia', 'DD/MM "às" HH24:MI') || '. Você recebe lembrete 1 hora antes.', '/consultas', 'consultas');
  return cid;
end $$;

create or replace function public.cancelar_consulta(_id uuid, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.consultas; eh_prof boolean; nome_prof text;
begin
  select * into c from public.consultas where id = _id;
  if not found then raise exception 'Consulta não encontrada.'; end if;
  eh_prof := c.profissional_id = auth.uid() or public.is_staff(auth.uid());
  if not eh_prof and not public.owns_familia(c.familia_id) then raise exception 'Sem permissão.'; end if;
  if c.status not in ('agendada','confirmada') then raise exception 'Esta consulta não pode mais ser cancelada.'; end if;
  update public.consultas set status = case when eh_prof then 'cancelada_profissional' else 'cancelada_familia' end,
    cancelado_motivo = left(_motivo, 500) where id = _id;
  if c.agenda_id is not null then delete from public.agenda where id = c.agenda_id; end if;
  select nome into nome_prof from public.psi_perfis where user_id = c.profissional_id;
  insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
  values (case when eh_prof then c.user_id else c.profissional_id end,
          'Teleconsulta cancelada',
          to_char(c.inicio at time zone 'America/Bahia', 'DD/MM "às" HH24:MI') || coalesce(' · ' || nullif(_motivo, ''), ''),
          case when eh_prof then '/consultas' else '/atendimentos' end, 'consultas');
end $$;

create or replace function public.atualizar_consulta(_id uuid, _status text, _link text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.consultas;
begin
  select * into c from public.consultas where id = _id;
  if not found or not (c.profissional_id = auth.uid() or public.is_staff(auth.uid())) then raise exception 'Sem permissão.'; end if;
  if _status not in ('agendada','confirmada','realizada','falta') then raise exception 'Status inválido.'; end if;
  update public.consultas set status = _status, link_video = coalesce(nullif(_link, ''), link_video) where id = _id;
  if _status = 'confirmada' and c.status <> 'confirmada' then
    insert into public.notificacoes(user_id, titulo, mensagem, link, categoria)
    values (c.user_id, 'Teleconsulta confirmada', 'O profissional confirmou sua consulta de ' || to_char(c.inicio at time zone 'America/Bahia', 'DD/MM "às" HH24:MI') || '.', '/consultas', 'consultas');
  end if;
end $$;

-- Dados mínimos da família para o psicólogo da consulta (sem CPF e sem ficha de saúde).
create or replace function public.consultas_profissional(_de timestamptz, _ate timestamptz)
returns table(id uuid, inicio timestamptz, fim timestamptz, status text, motivo text, link_video text, para_quem text,
              familia_nome text, familia_telefone text, cidade text, filho_nome text, filho_nascimento date, total_anteriores int)
language sql stable security definer set search_path = public as $$
  select c.id, c.inicio, c.fim, c.status, c.motivo, c.link_video, c.para_quem,
         f.mae_nome, f.mae_telefone, f.cidade || '/' || f.uf, fi.nome, fi.nascimento,
         (select count(*)::int from public.consultas x where x.familia_id = c.familia_id and x.profissional_id = c.profissional_id and x.status = 'realizada' and x.inicio < c.inicio)
  from public.consultas c
  join public.familias f on f.id = c.familia_id
  left join public.filhos fi on fi.id = c.filho_id
  where c.profissional_id = auth.uid() and c.inicio >= _de and c.inicio < _ate
  order by c.inicio
$$;

grant execute on function public.horarios_livres(uuid, date, date), public.agendar_consulta(uuid, timestamptz, text, uuid, text),
  public.cancelar_consulta(uuid, text), public.atualizar_consulta(uuid, text, text), public.consultas_profissional(timestamptz, timestamptz) to authenticated;

-- Ajustes 2026-11-05: tipos do diário e da agenda usados pelo app, gênero no perfil
alter table public.diario_registros drop constraint if exists diario_registros_tipo_check;
alter table public.diario_registros add constraint diario_registros_tipo_check check (tipo in ('humor','alimentacao','sono','crise','conquista','sensorial','anotacao','nota','comportamento','medicacao','terapia','escola','saude'));
alter table public.agenda drop constraint if exists agenda_repeticao_check;
alter table public.agenda add constraint agenda_repeticao_check check (repeticao is null or repeticao in ('nenhuma','nao','diaria','semanal','quinzenal','mensal'));
alter table public.agenda drop constraint if exists agenda_tipo_check;
alter table public.agenda add constraint agenda_tipo_check check (tipo in ('consulta','terapia','escola','medicamento','medicacao','exame','beneficio','lazer','outro'));
alter table public.perfis add column if not exists genero text check (genero in ('f','m','n'));

-- Comunicados editáveis/apagáveis pela equipe, refletindo nos avisos já entregues
alter table public.notificacoes add column if not exists comunicado_id uuid references public.comunicados(id) on delete cascade;
-- funções editar_comunicado(uuid,text,text,boolean) e apagar_comunicado(uuid) aplicadas no banco (security definer, só equipe)
