-- CONTROLE DE PONTO DIGITAL (restaurante) — base legal resumida em src/lib/ponto/apuracao.js
-- Princípios: hora do SERVIDOR; marcações nunca são apagadas nem alteradas (correção = nova marcação vinculada);
-- marcação nunca é bloqueada por horário (Portaria MTP 671/2021, art. 74); dados biométricos e médicos com acesso restrito (LGPD art. 11).

-- ============ ficha cadastral completa do empregado ============
create table if not exists rest_func_ficha (
  id uuid not null unique default gen_random_uuid(),
  funcionario_id uuid primary key references rest_funcionarios(id) on delete cascade,
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  nome_completo text, nome_social text, cpf text, rg text, rg_orgao text, rg_uf text, rg_emissao date,
  data_nascimento date, sexo text, estado_civil text, raca_cor text, nacionalidade text default 'Brasileira', naturalidade text, uf_nascimento text,
  nome_mae text, nome_pai text, escolaridade text, deficiencia text,
  cep text, logradouro text, numero text, complemento text, bairro text, cidade text, uf text, telefone text, email text,
  pis text, ctps_numero text, ctps_serie text, ctps_uf text, ctps_digital boolean not null default true,
  titulo_eleitor text, titulo_zona text, titulo_secao text, reservista text, cnh text, cnh_categoria text, cnh_validade date,
  matricula text, cargo text, cbo text, setor text, local_trabalho text,
  data_admissao date, data_demissao date, tipo_contrato text default 'Prazo indeterminado', contrato_fim date, experiencia_fim date,
  salario numeric(14,2), tipo_salario text default 'Mensalista', insalubridade text, periculosidade boolean not null default false,
  banco text, agencia text, conta text, tipo_conta text, pix text, vale_transporte boolean not null default false,
  aso_admissional date, aso_validade date, contato_emergencia_nome text, contato_emergencia_tel text,
  dependentes jsonb not null default '[]', foto_path text, observacoes text,
  atualizado_em timestamptz not null default now()
);

-- dados biométricos (descritor facial) — sensíveis: só o próprio empregado e o administrador
create table if not exists rest_func_biometria (
  funcionario_id uuid primary key references rest_funcionarios(id) on delete cascade,
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  descritor float8[] , foto_path text,
  ciencia_em timestamptz, ciencia_versao text,
  atualizado_em timestamptz not null default now()
);

-- ============ locais autorizados, jornada individual, folgas ============
create table if not exists rest_ponto_locais (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  nome text not null, endereco text, lat float8 not null, lng float8 not null, raio_m int not null default 100 check (raio_m between 10 and 5000),
  ativo boolean not null default true, criado_em timestamptz not null default now()
);

-- cada alteração de jornada é uma nova versão (valido_desde); a apuração usa a versão vigente em cada dia
create table if not exists rest_ponto_jornadas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  funcionario_id uuid not null references rest_funcionarios(id) on delete cascade,
  valido_desde date not null,
  semana jsonb not null,            -- {"1":{"entrada":"08:00","saida":"17:00","int_ini":"12:00","int_fim":"13:00"}, ..., "7": null}  (1 = segunda … 7 = domingo)
  quatro_marcacoes boolean not null default true,   -- exige registro do intervalo
  locais uuid[] not null default '{}',              -- vazio = qualquer local cadastrado
  escala text, regras text,
  criado_por uuid default rest_meu_funcionario() references rest_funcionarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (funcionario_id, valido_desde)
);

create table if not exists rest_ponto_folgas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  funcionario_id uuid not null references rest_funcionarios(id) on delete cascade,
  data date not null, motivo text,
  unique (funcionario_id, data)
);

-- ============ marcações (imutáveis) ============
create table if not exists rest_ponto_marcacoes (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references rest_restaurantes(id) on delete cascade,
  funcionario_id uuid not null references rest_funcionarios(id),
  nsr bigint not null,                              -- número sequencial do registro (por estabelecimento)
  tipo text not null check (tipo in ('entrada','saida_intervalo','retorno_intervalo','saida')),
  data_ref date not null,                           -- dia da jornada (a que vira a meia-noite fica no dia em que começou)
  horario timestamptz not null,                     -- horário da marcação (no app = horário do servidor)
  registrado_em timestamptz not null default now(), -- quando o servidor gravou
  horario_informado timestamptz,                    -- contingência: horário do aparelho (só informativo)
  previsto timestamptz, diferenca_min int,          -- horário contratual e diferença (+ atraso/excedente, − antecipado)
  origem text not null default 'app' check (origem in ('app','contingencia','ajuste')),
  selfie_path text, lat float8, lng float8, precisao_m float8, endereco text,
  local_id uuid references rest_ponto_locais(id) on delete set null, distancia_m int, dentro_area boolean,
  face_distancia float8, face_ok boolean, vivacidade_ok boolean,
  motivos text[] not null default '{}',
  situacao text not null default 'aprovado' check (situacao in ('aprovado','pendente','rejeitado')),
  justificativa text, dispositivo text,
  analisado_por uuid references rest_funcionarios(id), analisado_em timestamptz, obs_analise text,
  ajuste_id uuid, substituida_por uuid references rest_ponto_marcacoes(id),
  hash text not null,                               -- SHA-256 encadeado (integridade)
  unique (restaurante_id, nsr)
);
create index if not exists rest_ponto_marc_func on rest_ponto_marcacoes(funcionario_id, data_ref);
create index if not exists rest_ponto_marc_rest on rest_ponto_marcacoes(restaurante_id, data_ref);

-- campos do registro não mudam nunca; só a análise (situação), o vínculo com a correção e a observação
create or replace function rest_ponto_imutavel() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'PONTO_IMUTAVEL: marcações de ponto não podem ser excluídas'; end if;
  if (new.funcionario_id, new.nsr, new.tipo, new.data_ref, new.horario, new.registrado_em, new.horario_informado, new.origem, new.selfie_path, new.lat, new.lng, new.endereco, new.face_distancia, new.face_ok, new.vivacidade_ok, new.hash, new.motivos)
     is distinct from (old.funcionario_id, old.nsr, old.tipo, old.data_ref, old.horario, old.registrado_em, old.horario_informado, old.origem, old.selfie_path, old.lat, old.lng, old.endereco, old.face_distancia, old.face_ok, old.vivacidade_ok, old.hash, old.motivos) then
    raise exception 'PONTO_IMUTAVEL: o registro original não pode ser alterado; use uma solicitação de correção';
  end if;
  return new;
end $$;
create trigger rest_ponto_marc_imutavel before update or delete on rest_ponto_marcacoes for each row execute function rest_ponto_imutavel();

-- ============ correções, ausências, fechamento, avisos ============
create table if not exists rest_ponto_ajustes (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  funcionario_id uuid not null default rest_meu_funcionario() references rest_funcionarios(id),
  data_ref date not null, tipo text not null check (tipo in ('entrada','saida_intervalo','retorno_intervalo','saida')),
  horario_proposto timestamptz not null, marcacao_id uuid references rest_ponto_marcacoes(id),
  justificativa text not null check (length(trim(justificativa)) >= 5),
  status text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado')),
  solicitado_por uuid default rest_meu_funcionario() references rest_funcionarios(id), solicitado_em timestamptz not null default now(),
  analisado_por uuid references rest_funcionarios(id), analisado_em timestamptz, obs_analise text, nova_marcacao_id uuid references rest_ponto_marcacoes(id)
);

create table if not exists rest_ponto_ausencias (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  funcionario_id uuid not null default rest_meu_funcionario() references rest_funcionarios(id),
  motivo text not null default 'saude' check (motivo in ('saude','afastamento_medico')),
  data_inicio date not null, data_fim date not null, observacao text, arquivo_path text,
  enviado_em timestamptz not null default now(),
  status text not null default 'aguardando_conferencia' check (status in ('aguardando_conferencia','aceito','recusado')),
  entrega_fisica text not null default 'aguardando' check (entrega_fisica in ('aguardando','entregue','conferido','pendente_regularizacao')),
  entregue_em date, conferido_por uuid references rest_funcionarios(id), conferido_em timestamptz, obs_admin text,
  check (data_fim >= data_inicio)
);

create table if not exists rest_ponto_fechamentos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  mes date not null, status text not null default 'fechado' check (status in ('fechado','reaberto')),
  resumo jsonb, fechado_por uuid default rest_meu_funcionario() references rest_funcionarios(id), fechado_em timestamptz not null default now(),
  reaberto_por uuid references rest_funcionarios(id), reaberto_em timestamptz, motivo_reabertura text,
  unique (restaurante_id, mes)
);

create table if not exists rest_ponto_avisos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references rest_restaurantes(id) on delete cascade,
  para uuid references rest_funcionarios(id) on delete cascade,  -- null = administradores
  tipo text not null, texto text not null, ref_id uuid, lido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists rest_ponto_avisos_rest on rest_ponto_avisos(restaurante_id, lido, criado_em desc);

-- ============ RLS ============
do $$ declare t text; begin
  foreach t in array array['rest_func_ficha','rest_func_biometria','rest_ponto_locais','rest_ponto_jornadas','rest_ponto_folgas','rest_ponto_marcacoes','rest_ponto_ajustes','rest_ponto_ausencias','rest_ponto_fechamentos','rest_ponto_avisos'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
-- ficha e biometria: o próprio empregado lê; só o administrador grava
create policy ff_sel on rest_func_ficha for select using (restaurante_id = rest_meu_restaurante() and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy ff_adm on rest_func_ficha for all using (restaurante_id = rest_meu_restaurante() and rest_pode('admin')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
create policy fb_sel on rest_func_biometria for select using (restaurante_id = rest_meu_restaurante() and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy fb_adm on rest_func_biometria for all using (restaurante_id = rest_meu_restaurante() and rest_pode('admin')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
create policy pl_sel on rest_ponto_locais for select using (restaurante_id = rest_meu_restaurante());
create policy pl_adm on rest_ponto_locais for all using (restaurante_id = rest_meu_restaurante() and rest_pode('admin')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
create policy pj_sel on rest_ponto_jornadas for select using (restaurante_id = rest_meu_restaurante() and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy pj_adm on rest_ponto_jornadas for all using (restaurante_id = rest_meu_restaurante() and rest_pode('admin')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
create policy pf_sel on rest_ponto_folgas for select using (restaurante_id = rest_meu_restaurante() and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy pf_adm on rest_ponto_folgas for all using (restaurante_id = rest_meu_restaurante() and rest_pode('admin')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
-- marcações: só leitura (gravação apenas pelas funções do servidor)
create policy pm_sel on rest_ponto_marcacoes for select using (restaurante_id = rest_meu_restaurante() and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy pa_sel on rest_ponto_ajustes for select using (restaurante_id = rest_meu_restaurante() and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy pa_ins on rest_ponto_ajustes for insert with check (restaurante_id = rest_meu_restaurante() and status = 'pendente' and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy pu_sel on rest_ponto_ausencias for select using (restaurante_id = rest_meu_restaurante() and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy pu_ins on rest_ponto_ausencias for insert with check (restaurante_id = rest_meu_restaurante() and status = 'aguardando_conferencia' and entrega_fisica = 'aguardando' and (funcionario_id = rest_meu_funcionario() or rest_pode('admin')));
create policy pu_upd on rest_ponto_ausencias for update using (restaurante_id = rest_meu_restaurante() and rest_pode('admin')) with check (restaurante_id = rest_meu_restaurante());
create policy pfe_sel on rest_ponto_fechamentos for select using (restaurante_id = rest_meu_restaurante());
create policy pav_sel on rest_ponto_avisos for select using (restaurante_id = rest_meu_restaurante() and (para = rest_meu_funcionario() or (para is null and rest_pode('admin'))));
create policy pav_upd on rest_ponto_avisos for update using (restaurante_id = rest_meu_restaurante() and (para = rest_meu_funcionario() or (para is null and rest_pode('admin')))) with check (restaurante_id = rest_meu_restaurante());

-- auditoria (quem, quando, antes e depois)
do $$ declare t text; begin
  foreach t in array array['rest_func_ficha','rest_ponto_jornadas','rest_ponto_folgas','rest_ponto_locais','rest_ponto_marcacoes','rest_ponto_ajustes','rest_ponto_ausencias','rest_ponto_fechamentos'] loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function rest_auditar()', t, t);
  end loop;
end $$;

-- ============ funções do servidor ============
create or replace function rest_ponto_fuso() returns text language sql immutable as $$ select 'America/Sao_Paulo' $$;

create or replace function rest_ponto_distancia(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- jornada vigente no dia (null = folga / sem jornada)
create or replace function rest_ponto_jornada_dia(p_func uuid, p_data date) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('cfg', j.semana -> extract(isodow from p_data)::int::text, 'quatro', j.quatro_marcacoes, 'locais', j.locais,
                            'folga', exists (select 1 from rest_ponto_folgas f where f.funcionario_id = p_func and f.data = p_data))
  from rest_ponto_jornadas j where j.funcionario_id = p_func and j.valido_desde <= p_data order by j.valido_desde desc limit 1
$$;

create or replace function rest_ponto_mes_fechado(p_rest uuid, p_data date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rest_ponto_fechamentos where restaurante_id = p_rest and mes = date_trunc('month', p_data)::date and status = 'fechado')
$$;

-- grava uma marcação: hora do servidor, NSR sequencial, hash encadeado; nunca bloqueia por horário (Portaria 671, art. 74)
create or replace function rest_ponto_gravar(p_rest uuid, p_func uuid, p_tipo text, p_data date, p_horario timestamptz, p_origem text, p jsonb, p_motivos text[], p_ajuste uuid default null)
returns rest_ponto_marcacoes language plpgsql security definer set search_path = public as $$
declare v rest_ponto_marcacoes; v_nsr bigint; v_ant text; v_j jsonb; v_cfg jsonb; v_prev timestamptz; v_hhmm text; v_ini timestamptz; v_dif int;
  v_loc record; v_dist float8; v_raio int; v_dentro boolean; v_motivos text[] := coalesce(p_motivos, '{}'); v_tem_bio boolean;
begin
  perform pg_advisory_xact_lock(hashtext('ponto:' || p_rest::text));
  select coalesce(max(nsr), 0) + 1 into v_nsr from rest_ponto_marcacoes where restaurante_id = p_rest;
  select hash into v_ant from rest_ponto_marcacoes where restaurante_id = p_rest order by nsr desc limit 1;
  -- horário previsto pela jornada do dia
  v_j := rest_ponto_jornada_dia(p_func, p_data); v_cfg := v_j -> 'cfg';
  if v_cfg is not null and jsonb_typeof(v_cfg) = 'object' and not coalesce((v_j->>'folga')::boolean, false) then
    v_hhmm := v_cfg ->> case p_tipo when 'entrada' then 'entrada' when 'saida_intervalo' then 'int_ini' when 'retorno_intervalo' then 'int_fim' else 'saida' end;
    if v_hhmm is not null and v_hhmm <> '' then
      v_ini := (p_data + (v_cfg->>'entrada')::time) at time zone rest_ponto_fuso();
      v_prev := (p_data + v_hhmm::time) at time zone rest_ponto_fuso();
      if v_prev < v_ini then v_prev := v_prev + interval '1 day'; end if;  -- jornada que vira a meia-noite
      v_dif := round(extract(epoch from (p_horario - v_prev)) / 60);
      if abs(v_dif) > 5 then v_motivos := v_motivos || 'fora_janela'::text; end if;
    end if;
  else
    if p_origem <> 'ajuste' then v_motivos := v_motivos || 'sem_jornada'::text; end if;
  end if;
  -- local autorizado
  if p_origem <> 'ajuste' then
    if (p->>'lat') is null then v_motivos := v_motivos || 'sem_gps'::text;
    else
      for v_loc in select * from rest_ponto_locais l where l.restaurante_id = p_rest and l.ativo
                     and (coalesce(cardinality(array(select jsonb_array_elements_text(coalesce(v_j->'locais', '[]')))), 0) = 0
                          or l.id::text in (select jsonb_array_elements_text(v_j->'locais'))) loop
        v_dist := rest_ponto_distancia((p->>'lat')::float8, (p->>'lng')::float8, v_loc.lat, v_loc.lng);
        if v_dist <= v_loc.raio_m then v_raio := round(v_dist); v.local_id := v_loc.id; v_dentro := true; exit; end if;
        if v_raio is null or v_dist < v_raio then v_raio := round(v_dist); v.local_id := v_loc.id; v_dentro := false; end if;
      end loop;
      v.distancia_m := v_raio;
      if v_dentro = false then v_motivos := v_motivos || 'fora_area'::text; end if;
    end if;
    -- selfie e reconhecimento facial
    select exists (select 1 from rest_func_biometria where funcionario_id = p_func and descritor is not null) into v_tem_bio;
    if coalesce(p->>'selfie_path', '') = '' then v_motivos := v_motivos || 'sem_selfie'::text;
    elsif not v_tem_bio then v_motivos := v_motivos || 'biometria_nao_cadastrada'::text;
    elsif not coalesce((p->>'face_ok')::boolean, false) then v_motivos := v_motivos || 'rosto_nao_confere'::text; end if;
    if (p->>'vivacidade_ok') is not null and not (p->>'vivacidade_ok')::boolean then v_motivos := v_motivos || 'sem_vivacidade'::text; end if;
  end if;
  if p_origem = 'contingencia' then v_motivos := v_motivos || 'contingencia'::text; end if;
  v_motivos := array(select distinct unnest(v_motivos));

  insert into rest_ponto_marcacoes(restaurante_id, funcionario_id, nsr, tipo, data_ref, horario, horario_informado, previsto, diferenca_min, origem,
     selfie_path, lat, lng, precisao_m, endereco, local_id, distancia_m, dentro_area, face_distancia, face_ok, vivacidade_ok, motivos, situacao,
     justificativa, dispositivo, ajuste_id, hash)
  values (p_rest, p_func, v_nsr, p_tipo, p_data, p_horario, nullif(p->>'horario_informado', '')::timestamptz, v_prev, v_dif, p_origem,
     nullif(p->>'selfie_path', ''), (p->>'lat')::float8, (p->>'lng')::float8, (p->>'precisao')::float8, nullif(p->>'endereco', ''), v.local_id, v.distancia_m, v_dentro,
     (p->>'face_distancia')::float8, (p->>'face_ok')::boolean, (p->>'vivacidade_ok')::boolean, v_motivos,
     case when p_origem = 'ajuste' or cardinality(v_motivos) = 0 then 'aprovado' else 'pendente' end,
     nullif(p->>'justificativa', ''), left(p->>'dispositivo', 200), p_ajuste,
     encode(sha256(convert_to(concat_ws('|', v_ant, v_nsr, p_func, p_tipo, p_data, to_char(p_horario at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), p_origem, p->>'selfie_path', p->>'lat', p->>'lng'), 'UTF8')), 'hex'))
  returning * into v;
  if v.situacao = 'pendente' then
    insert into rest_ponto_avisos(restaurante_id, para, tipo, texto, ref_id)
    select p_rest, null, 'marcacao_pendente', f.nome || ': ' || replace(p_tipo, '_', ' ') || ' às ' || to_char(p_horario at time zone rest_ponto_fuso(), 'HH24:MI') || ' precisa de análise (' || array_to_string(v_motivos, ', ') || ')', v.id
    from rest_funcionarios f where f.id = p_func;
  end if;
  return v;
end $$;
revoke all on function rest_ponto_gravar(uuid, uuid, text, date, timestamptz, text, jsonb, text[], uuid) from public, anon, authenticated;

-- registro feito pelo próprio empregado no app
create or replace function rest_ponto_registrar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_func uuid := rest_meu_funcionario(); v_rest uuid := rest_meu_restaurante(); v_agora timestamptz := now(); v_data date; v_ult rest_ponto_marcacoes;
  v_feitos text[]; v_seq text[]; v_tipo text; v_j jsonb; v_origem text := coalesce(nullif(p->>'origem', ''), 'app'); v rest_ponto_marcacoes; v_nome text;
begin
  if v_func is null then raise exception 'Faça login para registrar o ponto'; end if;
  if v_origem not in ('app', 'contingencia') then raise exception 'Origem inválida'; end if;
  -- contingência: registro feito depois (sem internet). O horário oficial é o do servidor; o do aparelho fica como informação.
  -- dia de referência: se há jornada aberta (entrada sem saída nas últimas 16 h), continua nela
  select * into v_ult from rest_ponto_marcacoes m where m.funcionario_id = v_func and m.substituida_por is null and m.situacao <> 'rejeitado' order by m.horario desc limit 1;
  if v_ult.id is not null and v_ult.tipo <> 'saida' and v_agora - v_ult.horario < interval '16 hours' then v_data := v_ult.data_ref;
  else v_data := (v_agora at time zone rest_ponto_fuso())::date; end if;
  select array_agg(tipo) into v_feitos from rest_ponto_marcacoes where funcionario_id = v_func and data_ref = v_data and substituida_por is null and situacao <> 'rejeitado';
  v_j := rest_ponto_jornada_dia(v_func, v_data);
  v_seq := case when coalesce((v_j->>'quatro')::boolean, true) and coalesce(v_j->'cfg'->>'int_ini', '') <> '' then array['entrada','saida_intervalo','retorno_intervalo','saida'] else array['entrada','saida'] end;
  v_tipo := nullif(p->>'tipo', '');
  if v_tipo is null then select t into v_tipo from unnest(v_seq) with ordinality u(t, i) where not (t = any(coalesce(v_feitos, '{}'))) order by i limit 1; end if;
  if v_tipo is null then raise exception 'Todas as marcações de hoje já foram feitas. Se precisar corrigir, use “Solicitar correção”.'; end if;
  if v_tipo = any(coalesce(v_feitos, '{}')) then raise exception 'Esta marcação (%) já foi registrada hoje. Use “Solicitar correção”.', replace(v_tipo, '_', ' '); end if;
  v := rest_ponto_gravar(v_rest, v_func, v_tipo, v_data, v_agora, v_origem, p, '{}');
  select nome into v_nome from rest_funcionarios where id = v_func;
  return to_jsonb(v) || jsonb_build_object('nome', v_nome, 'empregador', (select nome from rest_restaurantes where id = v_rest));
end $$;

-- cadastro do rosto de referência: o próprio empregado faz o primeiro (com ciência); depois só o administrador troca
create or replace function rest_ponto_cadastrar_rosto(p_func uuid, p_descritor float8[], p_foto text, p_versao text) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid := rest_meu_restaurante(); v_alvo uuid := coalesce(p_func, rest_meu_funcionario());
begin
  if not exists (select 1 from rest_funcionarios where id = v_alvo and restaurante_id = v_rest) then raise exception 'Funcionário não encontrado'; end if;
  if v_alvo <> rest_meu_funcionario() and not rest_pode('admin') then raise exception 'Sem permissão'; end if;
  if cardinality(p_descritor) <> 128 then raise exception 'Descritor facial inválido'; end if;
  if exists (select 1 from rest_func_biometria where funcionario_id = v_alvo and descritor is not null) and not rest_pode('admin') then
    raise exception 'O rosto já está cadastrado. Para trocar, peça ao administrador.'; end if;
  insert into rest_func_biometria(funcionario_id, restaurante_id, descritor, foto_path, ciencia_em, ciencia_versao, atualizado_em)
  values (v_alvo, v_rest, p_descritor, p_foto, now(), p_versao, now())
  on conflict (funcionario_id) do update set descritor = excluded.descritor, foto_path = excluded.foto_path, ciencia_em = excluded.ciencia_em, ciencia_versao = excluded.ciencia_versao, atualizado_em = now();
end $$;

-- análise de marcação pendente (administrador)
create or replace function rest_ponto_analisar(p_id uuid, p_situacao text, p_obs text) returns void
language plpgsql security definer set search_path = public as $$
declare v rest_ponto_marcacoes;
begin
  if not rest_pode('admin') then raise exception 'Somente o administrador analisa marcações'; end if;
  if p_situacao not in ('aprovado', 'rejeitado') then raise exception 'Situação inválida'; end if;
  select * into v from rest_ponto_marcacoes where id = p_id and restaurante_id = rest_meu_restaurante();
  if v.id is null then raise exception 'Marcação não encontrada'; end if;
  if rest_ponto_mes_fechado(v.restaurante_id, v.data_ref) then raise exception 'O mês já foi fechado. Reabra o fechamento para alterar.'; end if;
  if p_situacao = 'rejeitado' and coalesce(trim(p_obs), '') = '' then raise exception 'Informe o motivo da rejeição'; end if;
  update rest_ponto_marcacoes set situacao = p_situacao, analisado_por = rest_meu_funcionario(), analisado_em = now(), obs_analise = p_obs where id = p_id;
  insert into rest_ponto_avisos(restaurante_id, para, tipo, texto, ref_id)
  values (v.restaurante_id, v.funcionario_id, 'analise', 'Sua marcação de ' || to_char(v.horario at time zone rest_ponto_fuso(), 'DD/MM HH24:MI') || ' foi ' || case when p_situacao = 'aprovado' then 'aprovada' else 'rejeitada: ' || p_obs end, p_id);
end $$;

-- decisão sobre solicitação de correção: o original fica guardado; a correção vira uma nova marcação (origem 'ajuste')
create or replace function rest_ponto_ajuste_decidir(p_id uuid, p_aprovar boolean, p_obs text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a rest_ponto_ajustes; v rest_ponto_marcacoes;
begin
  if not rest_pode('admin') then raise exception 'Somente o administrador decide correções'; end if;
  select * into a from rest_ponto_ajustes where id = p_id and restaurante_id = rest_meu_restaurante() for update;
  if a.id is null then raise exception 'Solicitação não encontrada'; end if;
  if a.status <> 'pendente' then raise exception 'Solicitação já decidida'; end if;
  if rest_ponto_mes_fechado(a.restaurante_id, a.data_ref) then raise exception 'O mês já foi fechado. Reabra o fechamento para alterar.'; end if;
  if not p_aprovar and coalesce(trim(p_obs), '') = '' then raise exception 'Informe o motivo da recusa'; end if;
  if p_aprovar then
    v := rest_ponto_gravar(a.restaurante_id, a.funcionario_id, a.tipo, a.data_ref, a.horario_proposto, 'ajuste', jsonb_build_object('justificativa', a.justificativa), '{}', a.id);
    update rest_ponto_marcacoes set substituida_por = v.id
     where funcionario_id = a.funcionario_id and data_ref = a.data_ref and tipo = a.tipo and substituida_por is null and id <> v.id;
  end if;
  update rest_ponto_ajustes set status = case when p_aprovar then 'aprovado' else 'rejeitado' end, analisado_por = rest_meu_funcionario(), analisado_em = now(), obs_analise = p_obs, nova_marcacao_id = v.id where id = p_id;
  insert into rest_ponto_avisos(restaurante_id, para, tipo, texto, ref_id)
  values (a.restaurante_id, a.funcionario_id, 'ajuste', 'Sua correção de ' || to_char(a.data_ref, 'DD/MM') || ' foi ' || case when p_aprovar then 'aprovada' else 'recusada: ' || p_obs end, p_id);
  return jsonb_build_object('marcacao', v.id);
end $$;

-- fechamento mensal (com histórico de reaberturas)
create or replace function rest_ponto_fechar_mes(p_mes date, p_resumo jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_rest uuid := rest_meu_restaurante(); v_mes date := date_trunc('month', p_mes)::date;
begin
  if not rest_pode('admin') then raise exception 'Somente o administrador fecha o mês'; end if;
  if exists (select 1 from rest_ponto_ajustes where restaurante_id = v_rest and status = 'pendente' and date_trunc('month', data_ref) = v_mes) then
    raise exception 'Há solicitações de correção pendentes neste mês. Decida antes de fechar.'; end if;
  insert into rest_ponto_fechamentos(restaurante_id, mes, status, resumo, fechado_por, fechado_em)
  values (v_rest, v_mes, 'fechado', p_resumo, rest_meu_funcionario(), now())
  on conflict (restaurante_id, mes) do update set status = 'fechado', resumo = excluded.resumo, fechado_por = excluded.fechado_por, fechado_em = now();
  insert into rest_ponto_avisos(restaurante_id, para, tipo, texto) select v_rest, f.id, 'fechamento', 'O ponto de ' || to_char(v_mes, 'MM/YYYY') || ' foi fechado. Confira o seu espelho.' from rest_funcionarios f where f.restaurante_id = v_rest and f.ativo;
end $$;

create or replace function rest_ponto_reabrir_mes(p_mes date, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not rest_pode('admin') then raise exception 'Somente o administrador reabre o mês'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo da reabertura'; end if;
  update rest_ponto_fechamentos set status = 'reaberto', reaberto_por = rest_meu_funcionario(), reaberto_em = now(), motivo_reabertura = p_motivo
   where restaurante_id = rest_meu_restaurante() and mes = date_trunc('month', p_mes)::date and status = 'fechado';
  if not found then raise exception 'Mês não está fechado'; end if;
end $$;

-- avisos automáticos de ausência/atestado e de pedido de correção
create or replace function rest_ponto_avisar() returns trigger language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  select nome into v_nome from rest_funcionarios where id = new.funcionario_id;
  if tg_table_name = 'rest_ponto_ausencias' then
    if tg_op = 'INSERT' then
      insert into rest_ponto_avisos(restaurante_id, para, tipo, texto, ref_id) values (new.restaurante_id, null, 'ausencia', v_nome || ' comunicou ausência por saúde de ' || to_char(new.data_inicio, 'DD/MM') || ' a ' || to_char(new.data_fim, 'DD/MM') || case when new.arquivo_path is not null then ' (atestado enviado)' else '' end, new.id);
    elsif new.status is distinct from old.status or new.entrega_fisica is distinct from old.entrega_fisica then
      insert into rest_ponto_avisos(restaurante_id, para, tipo, texto, ref_id) values (new.restaurante_id, new.funcionario_id, 'ausencia', 'Seu atestado de ' || to_char(new.data_inicio, 'DD/MM') || ': ' || replace(new.status, '_', ' ') || ' · entrega física: ' || replace(new.entrega_fisica, '_', ' '), new.id);
    end if;
  else
    insert into rest_ponto_avisos(restaurante_id, para, tipo, texto, ref_id) values (new.restaurante_id, null, 'ajuste', v_nome || ' pediu correção de ' || replace(new.tipo, '_', ' ') || ' em ' || to_char(new.data_ref, 'DD/MM'), new.id);
  end if;
  return new;
end $$;
create trigger rest_ponto_aus_aviso after insert or update on rest_ponto_ausencias for each row execute function rest_ponto_avisar();
create trigger rest_ponto_aju_aviso after insert on rest_ponto_ajustes for each row execute function rest_ponto_avisar();

-- correção não pode ser pedida para mês fechado
create or replace function rest_ponto_guarda_ajuste() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if rest_ponto_mes_fechado(new.restaurante_id, new.data_ref) then raise exception 'O mês já foi fechado. Fale com o administrador.'; end if;
  return new;
end $$;
create trigger rest_ponto_aju_guarda before insert on rest_ponto_ajustes for each row execute function rest_ponto_guarda_ajuste();

grant execute on function rest_ponto_registrar(jsonb), rest_ponto_cadastrar_rosto(uuid, float8[], text, text), rest_ponto_analisar(uuid, text, text),
  rest_ponto_ajuste_decidir(uuid, boolean, text), rest_ponto_fechar_mes(date, jsonb), rest_ponto_reabrir_mes(date, text) to authenticated;
revoke all on function rest_ponto_jornada_dia(uuid, date), rest_ponto_mes_fechado(uuid, date) from public, anon, authenticated;

-- endurecimento (verificador de segurança do Supabase)
revoke execute on function rest_ponto_registrar(jsonb), rest_ponto_cadastrar_rosto(uuid, float8[], text, text), rest_ponto_analisar(uuid, text, text),
  rest_ponto_ajuste_decidir(uuid, boolean, text), rest_ponto_fechar_mes(date, jsonb), rest_ponto_reabrir_mes(date, text) from public, anon;
revoke execute on function rest_ponto_avisar(), rest_ponto_guarda_ajuste() from public, anon, authenticated;
alter function rest_ponto_fuso() set search_path = public;
alter function rest_ponto_distancia(float8, float8, float8, float8) set search_path = public;
