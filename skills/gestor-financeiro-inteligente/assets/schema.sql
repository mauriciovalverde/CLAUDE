-- =====================================================================
-- GESTOR FINANCEIRO INTELIGENTE · Schema completo (Supabase / Postgres 15+)
-- Aplique como migração única: supabase/migrations/0001_schema.sql
-- Tudo com RLS por usuário, auditoria, exclusão lógica e idempotência.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create extension if not exists pg_trgm with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------
create or replace function so_digitos(t text) returns text
language sql immutable as $$ select nullif(regexp_replace(coalesce(t,''), '\D', '', 'g'), '') $$;

-- Telefone normalizado: só dígitos, sem DDI 55. Ex.: "71 99401-4023" -> "71994014023"
create or replace function normalizar_telefone(t text) returns text
language sql immutable as $$
  select case
    when so_digitos(t) is null then null
    when length(so_digitos(t)) in (12,13) and left(so_digitos(t),2) = '55' then substr(so_digitos(t),3)
    else so_digitos(t) end
$$;

create or replace function sem_acento(t text) returns text
language sql immutable as $$
  select lower(translate(coalesce(t,''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'))
$$;

create or replace function set_atualizado_em() returns trigger
language plpgsql as $$ begin new.atualizado_em := now(); return new; end $$;

-- ---------------------------------------------------------------------
-- Configurações, membros e contas
-- ---------------------------------------------------------------------
create table configuracoes (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  fuso text not null default 'America/Bahia',
  lembretes_minutos int[] not null default '{4320,1440,0}',   -- 3 dias, 1 dia, no dia (relativo à hora do evento)
  hora_evento time not null default '09:00',
  agenda_ao_pagar text not null default 'marcar_pago' check (agenda_ao_pagar in ('marcar_pago','excluir')),
  agenda_calendar_id text not null default 'primary',
  -- Referência conservadora para mútuo entre particulares; confirmar com advogado (ver conformidade-legal.md)
  limite_juros_mensal_pct numeric(6,3) not null default 1.000,
  -- Dados sanitários do estabelecimento (exigidos para vender medicamentos)
  licenca jsonb not null default '{}'::jsonb,
  -- { "razao_social","cnpj","afe_anvisa","licenca_sanitaria","licenca_validade","responsavel_tecnico","crf",
  --   "autorizado_controlados": false }
  ia_modelo text not null default 'claude-sonnet-5-5',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table membros (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references auth.users on delete cascade,
  membro_id uuid not null references auth.users on delete cascade,
  papel text not null check (papel in ('dono','operador','leitura')),
  criado_em timestamptz not null default now(),
  unique (dono_id, membro_id)
);

create table contas_financeiras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  tipo text not null default 'carteira' check (tipo in ('carteira','banco','cartao','investimento','outro')),
  escopo text not null check (escopo in ('pessoal','comercial')),
  saldo_inicial numeric(14,2) not null default 0,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('receita','despesa','patrimonial')),
  escopo text not null check (escopo in ('pessoal','comercial')),
  slug text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  unique (user_id, escopo, slug)
);

-- ---------------------------------------------------------------------
-- Pessoas
-- ---------------------------------------------------------------------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  nome_busca text generated always as (sem_acento(nome)) stored,
  telefone text,
  telefone_norm text generated always as (normalizar_telefone(telefone)) stored,
  cpf_cifrado bytea,          -- pgp_sym_encrypt(cpf, chave do Vault) feito pela Edge Function / RPC
  cpf_hash text,              -- sha256(cpf só dígitos) para busca sem expor o CPF
  endereco_cifrado bytea,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create unique index clientes_tel_unico on clientes(user_id, telefone_norm) where telefone_norm is not null and excluido_em is null;
create index clientes_nome_trgm on clientes using gin (nome_busca extensions.gin_trgm_ops);

create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  nome_busca text generated always as (sem_acento(nome)) stored,
  telefone text,
  telefone_norm text generated always as (normalizar_telefone(telefone)) stored,
  cnpj text,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create index fornecedores_nome_trgm on fornecedores using gin (nome_busca extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Produtos, lotes e estoque
-- ---------------------------------------------------------------------
create table produtos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  nome_busca text generated always as (sem_acento(nome)) stored,
  nome_comercial text,
  principio_ativo text,
  apresentacao text,
  codigo text,                    -- código interno, EAN ou GTIN
  unidade text not null default 'un',
  fornecedor_id uuid references fornecedores,
  preco_compra numeric(14,4),     -- último custo unitário (atualizado na compra)
  preco_venda numeric(14,2),
  margem_pct numeric(8,2) generated always as (
    case when preco_venda > 0 and preco_compra is not null
         then round(((preco_venda - preco_compra) / preco_venda) * 100, 2) end) stored,
  estoque_atual numeric(14,3) not null default 0,
  estoque_minimo numeric(14,3) not null default 0,
  controla_lote boolean not null default true,
  registro_anvisa text,
  classe_regulatoria text not null default 'nao_medicamento' check (classe_regulatoria in (
    'nao_medicamento',          -- correlato ou mercadoria comum
    'mip',                      -- medicamento isento de prescrição
    'tarja_vermelha',           -- venda sob prescrição
    'tarja_vermelha_retencao',  -- prescrição com retenção (ex.: antimicrobianos)
    'controlado_344')),         -- Portaria SVS/MS 344/98 (tarja preta, listas A/B/C)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create index produtos_nome_trgm on produtos using gin (nome_busca extensions.gin_trgm_ops);
create unique index produtos_codigo_unico on produtos(user_id, codigo) where codigo is not null and excluido_em is null;

create table lotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  produto_id uuid not null references produtos,
  lote text not null,
  validade date,
  quantidade numeric(14,3) not null default 0 check (quantidade >= 0),
  custo_unitario numeric(14,4),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, produto_id, lote)
);

create table movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  produto_id uuid not null references produtos,
  lote_id uuid references lotes,
  tipo text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade numeric(14,3) not null,      -- positiva; o tipo define o sinal
  origem text not null check (origem in ('compra','venda','ajuste','estorno','inventario')),
  origem_id uuid,
  saldo_apos numeric(14,3),
  observacao text,
  criado_em timestamptz not null default now()
);

create table receitas_medicas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  cliente_id uuid not null references clientes,
  prescritor text not null,
  registro_prescritor text not null,      -- CRM/CRO + UF
  data_emissao date not null,
  tipo text not null check (tipo in ('simples','controle_especial','notificacao_A','notificacao_B')),
  retida boolean not null default false,
  arquivo_path text,                      -- Storage privado
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Compras
-- ---------------------------------------------------------------------
create table compras (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fornecedor_id uuid references fornecedores,
  data date not null default current_date,
  forma_pagamento text,
  total numeric(14,2) not null default 0,
  status text not null default 'pendente' check (status in ('pendente','parcial','pago','cancelado')),
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table compra_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  compra_id uuid not null references compras on delete cascade,
  produto_id uuid not null references produtos,
  lote_id uuid references lotes,
  quantidade numeric(14,3) not null check (quantidade > 0),
  custo_unitario numeric(14,4) not null check (custo_unitario >= 0),
  total numeric(14,2) generated always as (round(quantidade * custo_unitario, 2)) stored
);

-- ---------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------
create table vendas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  cliente_id uuid not null references clientes,
  data date not null default current_date,
  forma_pagamento text,
  desconto numeric(14,2) not null default 0,
  total_bruto numeric(14,2) not null default 0,   -- soma dos itens antes do desconto geral
  total numeric(14,2) not null default 0,         -- FATURAMENTO desta venda
  custo_total numeric(14,2),                      -- CMV; nulo se algum item está sem custo
  lucro_bruto numeric(14,2),
  margem_pct numeric(8,2),
  receita_medica_id uuid references receitas_medicas,
  status text not null default 'pendente' check (status in ('pendente','parcial','pago','cancelado')),
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table venda_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  venda_id uuid not null references vendas on delete cascade,
  produto_id uuid not null references produtos,
  lote_id uuid references lotes,
  quantidade numeric(14,3) not null check (quantidade > 0),
  preco_unitario numeric(14,2) not null check (preco_unitario >= 0),
  desconto numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (round(quantidade * preco_unitario - desconto, 2)) stored,
  custo_unitario numeric(14,4)
);

-- ---------------------------------------------------------------------
-- Empréstimos
-- ---------------------------------------------------------------------
create table emprestimos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  cliente_id uuid not null references clientes,
  data date not null default current_date,
  principal numeric(14,2) not null check (principal > 0),
  taxa_pct numeric(8,4) not null default 0 check (taxa_pct >= 0),   -- por período
  periodicidade text not null default 'mensal' check (periodicidade in ('diaria','semanal','mensal','anual','periodo_total')),
  modalidade text not null default 'simples' check (modalidade in ('simples','composto')),
  periodos numeric(10,4) not null check (periodos > 0),             -- n de períodos da taxa
  parcelas int not null default 1 check (parcelas >= 1),
  vencimento date not null,                                         -- vencimento final
  juros_previstos numeric(14,2) not null,
  total_previsto numeric(14,2) not null,
  taxa_mensal_equivalente_pct numeric(10,4),
  acima_limite_legal boolean not null default false,
  ciencia_aviso_legal_em timestamptz,     -- quando o usuário confirmou que viu o aviso
  status text not null default 'ativo' check (status in ('ativo','quitado','atrasado','renegociado','cancelado')),
  condicoes_texto text,                   -- resumo contratual legível, gerado na criação
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table emprestimo_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  emprestimo_id uuid not null references emprestimos on delete cascade,
  tipo text not null check (tipo in ('criacao','pagamento','pagamento_parcial','prorrogacao','renegociacao','atraso','quitacao','estorno')),
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Obrigações (central de contas a pagar e a receber)
-- ---------------------------------------------------------------------
create table obrigacoes (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tipo text not null check (tipo in ('receber','pagar')),
  escopo text not null check (escopo in ('pessoal','comercial')),
  origem text not null check (origem in ('venda','compra','emprestimo','despesa','receita','recorrencia','outro')),
  origem_id uuid,
  cliente_id uuid references clientes,
  fornecedor_id uuid references fornecedores,
  categoria_id uuid references categorias,
  descricao text not null,
  parcela_num int not null default 1,
  parcela_total int not null default 1,
  valor numeric(14,2) not null check (valor > 0),
  valor_juros numeric(14,2) not null default 0,  -- parte de juros embutida (empréstimos)
  valor_pago numeric(14,2) not null default 0,
  juros_pago numeric(14,2) not null default 0,
  saldo numeric(14,2) generated always as (valor - valor_pago) stored,
  vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente','parcial','pago','cancelado','renegociado')),
  pago_em date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create index obrigacoes_venc on obrigacoes(user_id, vencimento) where excluido_em is null;
create index obrigacoes_origem on obrigacoes(origem, origem_id);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  obrigacao_id uuid not null references obrigacoes,
  data date not null default current_date,
  valor numeric(14,2) not null check (valor > 0),
  juros_valor numeric(14,2) not null default 0,       -- parte do pagamento que é juros (lucro)
  principal_valor numeric(14,2) not null default 0,
  conta_id uuid references contas_financeiras,
  forma text,
  observacao text,
  estornado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- Livro-caixa: tudo que entra e sai de uma conta
create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  data date not null default current_date,
  tipo text not null check (tipo in ('entrada','saida')),
  escopo text not null check (escopo in ('pessoal','comercial')),
  -- operacional entra em receitas e despesas; patrimonial (empréstimo concedido, retorno de principal, transferência) só mexe no saldo
  natureza text not null default 'operacional' check (natureza in ('operacional','patrimonial')),
  valor numeric(14,2) not null check (valor > 0),
  categoria_id uuid references categorias,
  conta_id uuid references contas_financeiras,
  origem text not null check (origem in ('pagamento','emprestimo','contracheque','manual','importacao','estorno')),
  origem_id uuid,
  descricao text,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create index lancamentos_data on lancamentos(user_id, data) where excluido_em is null;

create table recorrencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  descricao text not null,
  tipo text not null check (tipo in ('receber','pagar')),
  escopo text not null check (escopo in ('pessoal','comercial')),
  categoria_id uuid references categorias,
  valor numeric(14,2) not null check (valor > 0),
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  inicio date not null default current_date,
  fim date,
  ativa boolean not null default true,
  gerado_ate date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

-- ---------------------------------------------------------------------
-- Salário da Polícia Militar
-- ---------------------------------------------------------------------
create table contracheques (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  competencia date not null check (extract(day from competencia) = 1),  -- 1º dia do mês
  data_pagamento date,
  bruto numeric(14,2) not null default 0,
  descontos numeric(14,2) not null default 0,
  liquido numeric(14,2) generated always as (bruto - descontos) stored,
  conta_id uuid references contas_financeiras,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  unique (user_id, competencia)
);

create table contracheque_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  contracheque_id uuid not null references contracheques on delete cascade,
  tipo text not null check (tipo in ('provento','desconto')),
  rubrica text not null check (rubrica in (
    'salario_base','gratificacao','adicional','hora_extra','servico_extraordinario','auxilio','outro_provento',
    'previdencia','imposto_renda','consignado','plano_saude','associacao','pensao','outro_desconto')),
  descricao text,
  valor numeric(14,2) not null check (valor >= 0)
);

-- ---------------------------------------------------------------------
-- Integrações e Google Agenda
-- ---------------------------------------------------------------------
create table integracoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  provedor text not null check (provedor in ('google_calendar')),
  conta_email text,
  access_token_cifrado text,   -- AES-256-GCM base64 (iv:ciphertext), cifrado na Edge Function
  refresh_token_cifrado text,
  expira_em timestamptz,
  escopos text,
  status text not null default 'desconectado' check (status in ('conectado','desconectado','erro','revogado')),
  ultimo_erro text,
  oauth_state text,            -- anti-CSRF do fluxo OAuth
  oauth_state_expira timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, provedor)
);
-- Tokens nunca chegam ao navegador: o front lê só a view abaixo.
-- (view sem security_invoker de propósito: o filtro por auth.uid() é feito aqui e a tabela fica fechada)
create view v_integracoes as
  select id, provedor, conta_email, status, ultimo_erro, atualizado_em from integracoes where user_id = auth.uid();

create table agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  obrigacao_id uuid not null unique references obrigacoes,
  google_event_id text,         -- salvo só após confirmação da API
  calendar_id text,
  html_link text,
  status text not null default 'pendente' check (status in ('pendente','sincronizado','erro','cancelado')),
  hash_conteudo text,           -- evita PATCH sem mudança
  ultima_sync timestamptz,
  ultimo_erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table agenda_sync_fila (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  obrigacao_id uuid not null references obrigacoes,
  acao text not null check (acao in ('upsert','cancelar')),
  tentativas int not null default 0,
  proxima_tentativa timestamptz not null default now(),
  ultimo_erro text,
  processado_em timestamptz,
  criado_em timestamptz not null default now()
);
-- No máximo um item pendente por obrigação: novos pedidos se fundem ao existente
create unique index agenda_fila_unica on agenda_sync_fila(obrigacao_id) where processado_em is null;

-- ---------------------------------------------------------------------
-- IA, idempotência e auditoria
-- ---------------------------------------------------------------------
create table chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  conversa_id uuid not null,
  papel text not null check (papel in ('user','assistant')),
  conteudo jsonb not null,
  criado_em timestamptz not null default now()
);
create index chat_conversa on chat_mensagens(conversa_id, criado_em);

create table ia_operacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  conversa_id uuid,
  mensagem text not null,
  ferramentas jsonb not null default '[]'::jsonb,   -- [{nome, entrada, saida, ms}]
  resposta text,
  status text not null default 'em_andamento' check (status in ('em_andamento','concluida','aguardando_usuario','erro')),
  erro text,
  criado_em timestamptz not null default now()
);

create table idempotencia (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  chave text not null,
  resultado jsonb not null,
  criado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

create table auditoria (
  id bigint generated always as identity primary key,
  user_id uuid,
  tabela text not null,
  registro_id uuid,
  acao text not null,
  antes jsonb,
  depois jsonb,
  em timestamptz not null default now()
);

create or replace function auditar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria(user_id, tabela, registro_id, acao, antes, depois)
  values (coalesce(auth.uid(), ((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'user_id')::uuid),
          tg_table_name,
          ((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id')::uuid,
          tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- Triggers de auditoria e atualizado_em
do $$
declare t text;
begin
  foreach t in array array['clientes','fornecedores','produtos','lotes','compras','vendas','emprestimos',
    'obrigacoes','pagamentos','lancamentos','recorrencias','contracheques','contas_financeiras','categorias','configuracoes']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function auditar()', t, t);
  end loop;
  foreach t in array array['clientes','fornecedores','produtos','lotes','compras','vendas','emprestimos',
    'obrigacoes','recorrencias','contracheques','contas_financeiras','categorias','configuracoes','integracoes','agenda_eventos']
  loop
    execute format('create trigger %I_upd before update on %I for each row execute function set_atualizado_em()', t, t);
  end loop;
end $$;

-- Exclusão definitiva bloqueada: use excluido_em (a lixeira restaura). Só o service_role apaga de fato.
create or replace function bloquear_delete() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'EXCLUSAO_BLOQUEADA: use exclusão lógica (excluido_em). Exclusão definitiva só pela função excluir_definitivo.';
  end if;
  return old;
end $$;
do $$
declare t text;
begin
  foreach t in array array['clientes','fornecedores','produtos','compras','vendas','emprestimos','obrigacoes','pagamentos','lancamentos','contracheques']
  loop
    execute format('create trigger %I_nodelete before delete on %I for each row execute function bloquear_delete()', t, t);
  end loop;
end $$;

create or replace function excluir_definitivo(p_tabela text, p_id uuid, p_confirmacao text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_confirmacao <> 'EXCLUIR' then raise exception 'CONFIRMACAO_INVALIDA: digite EXCLUIR para confirmar.'; end if;
  if p_tabela not in ('clientes','fornecedores','produtos') then
    raise exception 'TABELA_NAO_PERMITIDA: registros financeiros (vendas, pagamentos, empréstimos...) só podem ser cancelados ou estornados.';
  end if;
  execute format('delete from %I where id = $1 and user_id = auth.uid() and excluido_em is not null', p_tabela) using p_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NADA_EXCLUIDO: o registro precisa estar na lixeira e ser seu.'; end if;
  return jsonb_build_object('ok', true, 'tabela', p_tabela, 'id', p_id);
end $$;

-- ---------------------------------------------------------------------
-- RLS: cada usuário só vê o que é seu
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['configuracoes','contas_financeiras','categorias','clientes','fornecedores','produtos','lotes',
    'movimentacoes_estoque','receitas_medicas','compras','compra_itens','vendas','venda_itens','emprestimos','emprestimo_eventos',
    'obrigacoes','pagamentos','lancamentos','recorrencias','contracheques','contracheque_itens','agenda_eventos',
    'chat_mensagens','ia_operacoes','idempotencia']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_dono on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;
-- Tokens, fila e auditoria: o usuário só lê (escrita apenas por Edge Functions com service_role)
alter table integracoes enable row level security;   -- sem policy: só service_role (Edge Functions) acessa
revoke all on integracoes from anon, authenticated;
grant select on v_integracoes to authenticated;
alter table agenda_sync_fila enable row level security;
create policy fila_leitura on agenda_sync_fila for select using (user_id = auth.uid());
alter table auditoria enable row level security;
create policy auditoria_leitura on auditoria for select using (user_id = auth.uid());
alter table membros enable row level security;
create policy membros_dono on membros for all using (dono_id = auth.uid()) with check (dono_id = auth.uid());

-- ---------------------------------------------------------------------
-- Inicialização do usuário (chamar após o primeiro login; é idempotente)
-- ---------------------------------------------------------------------
create or replace function inicializar_usuario() returns void
language plpgsql security invoker as $$
declare u uuid := auth.uid();
begin
  insert into configuracoes(user_id) values (u) on conflict do nothing;
  insert into contas_financeiras(user_id, nome, tipo, escopo)
    select u, x.nome, 'carteira', x.escopo from (values ('Carteira pessoal','pessoal'),('Caixa do negócio','comercial')) x(nome,escopo)
    where not exists (select 1 from contas_financeiras c where c.user_id=u and c.escopo=x.escopo);
  insert into categorias(user_id, nome, tipo, escopo, slug) values
    (u,'Despesas domésticas','despesa','pessoal','domestica'),
    (u,'Alimentação','despesa','pessoal','alimentacao'),
    (u,'Combustível','despesa','pessoal','combustivel'),
    (u,'Energia','despesa','pessoal','energia'),
    (u,'Água','despesa','pessoal','agua'),
    (u,'Internet','despesa','pessoal','internet'),
    (u,'Escola','despesa','pessoal','escola'),
    (u,'Saúde','despesa','pessoal','saude'),
    (u,'Cartão de crédito','despesa','pessoal','cartao'),
    (u,'Financiamentos','despesa','pessoal','financiamento'),
    (u,'Empréstimos pessoais','despesa','pessoal','emprestimo_pessoal'),
    (u,'Assinaturas','despesa','pessoal','assinaturas'),
    (u,'Outras despesas','despesa','pessoal','outras'),
    (u,'Salário PM','receita','pessoal','salario_pm'),
    (u,'Outras receitas pessoais','receita','pessoal','outras_receitas'),
    (u,'Venda de mercadorias','receita','comercial','vendas'),
    (u,'Juros recebidos','receita','comercial','juros'),
    (u,'Compra de mercadorias','despesa','comercial','compras'),
    (u,'Despesas comerciais','despesa','comercial','despesas_comerciais'),
    (u,'Empréstimo concedido','patrimonial','comercial','emprestimo_concedido'),
    (u,'Retorno de principal','patrimonial','comercial','retorno_principal')
  on conflict (user_id, escopo, slug) do nothing;
end $$;

create or replace function categoria_id(p_escopo text, p_slug text) returns uuid
language sql stable as $$ select id from categorias where user_id = auth.uid() and escopo = p_escopo and slug = p_slug $$;

create or replace function conta_padrao(p_escopo text) returns uuid
language sql stable as $$
  select id from contas_financeiras where user_id = auth.uid() and escopo = p_escopo and ativa and excluido_em is null
  order by criado_em limit 1 $$;

-- ---------------------------------------------------------------------
-- Agenda: enfileirar sincronização sempre que uma obrigação muda
-- ---------------------------------------------------------------------
create or replace function enfileirar_agenda(p_obrigacao uuid, p_acao text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select user_id into v_user from obrigacoes where id = p_obrigacao;
  insert into agenda_sync_fila(user_id, obrigacao_id, acao)
  values (v_user, p_obrigacao, p_acao)
  on conflict (obrigacao_id) where processado_em is null
  do update set acao = excluded.acao, proxima_tentativa = now(), tentativas = 0, ultimo_erro = null;
  insert into agenda_eventos(user_id, obrigacao_id, status) values (v_user, p_obrigacao, 'pendente')
  on conflict (obrigacao_id) do update set status = case when agenda_eventos.status = 'cancelado' and p_acao='cancelar'
                                                         then 'cancelado' else 'pendente' end;
end $$;

create or replace function obrigacao_agenda_trigger() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('pendente','parcial') then perform enfileirar_agenda(new.id, 'upsert'); end if;
  elsif (new.vencimento, new.valor, new.valor_pago, new.status, new.descricao, new.excluido_em)
        is distinct from (old.vencimento, old.valor, old.valor_pago, old.status, old.descricao, old.excluido_em) then
    if new.excluido_em is not null or new.status in ('cancelado','renegociado') then
      perform enfileirar_agenda(new.id, 'cancelar');
    else
      perform enfileirar_agenda(new.id, 'upsert');   -- o sync decide: atualizar, marcar PAGO ou excluir
    end if;
  end if;
  return new;
end $$;
create trigger obrigacoes_agenda after insert or update on obrigacoes
  for each row execute function obrigacao_agenda_trigger();

-- ---------------------------------------------------------------------
-- Estoque
-- ---------------------------------------------------------------------
create or replace function movimentar_estoque(p_produto uuid, p_lote uuid, p_tipo text, p_qtd numeric,
                                              p_origem text, p_origem_id uuid, p_obs text default null)
returns numeric language plpgsql as $$
declare v_saldo numeric;
begin
  update produtos set estoque_atual = estoque_atual + case when p_tipo='saida' then -p_qtd else p_qtd end
   where id = p_produto returning estoque_atual into v_saldo;
  if v_saldo < 0 then raise exception 'ESTOQUE_INSUFICIENTE: produto % ficaria com saldo %', p_produto, v_saldo; end if;
  if p_lote is not null then
    update lotes set quantidade = quantidade + case when p_tipo='saida' then -p_qtd else p_qtd end where id = p_lote;
  end if;
  insert into movimentacoes_estoque(produto_id, lote_id, tipo, quantidade, origem, origem_id, saldo_apos, observacao)
  values (p_produto, p_lote, p_tipo, p_qtd, p_origem, p_origem_id, v_saldo, p_obs);
  return v_saldo;
end $$;

-- ---------------------------------------------------------------------
-- Clientes: busca e upsert sem duplicar
-- ---------------------------------------------------------------------
create or replace function buscar_clientes(p_texto text) returns table(id uuid, nome text, telefone text, score real)
language sql stable as $$
  select c.id, c.nome, c.telefone,
         case when normalizar_telefone(p_texto) is not null and length(normalizar_telefone(p_texto)) >= 8
                   and c.telefone_norm like '%' || right(normalizar_telefone(p_texto), 8) then 1.0
              else extensions.similarity(c.nome_busca, sem_acento(p_texto)) end::real as score
  from clientes c
  where c.excluido_em is null
    and ( (normalizar_telefone(p_texto) is not null and length(normalizar_telefone(p_texto)) >= 8
           and c.telefone_norm like '%' || right(normalizar_telefone(p_texto), 8))
       or extensions.similarity(c.nome_busca, sem_acento(p_texto)) > 0.3
       or c.nome_busca like '%' || sem_acento(p_texto) || '%')
  order by score desc limit 5
$$;

-- Retorna {status:'existente'|'criado'|'ambiguo', cliente_id, candidatos}
create or replace function upsert_cliente(p_nome text, p_telefone text default null, p_obs text default null)
returns jsonb language plpgsql as $$
declare v_id uuid; v_tel text := normalizar_telefone(p_telefone); v_cand jsonb; v_n int;
begin
  if v_tel is not null then
    select id into v_id from clientes where telefone_norm = v_tel and excluido_em is null;
    if v_id is not null then
      return jsonb_build_object('status','existente','cliente_id',v_id,'por','telefone');
    end if;
  end if;
  select jsonb_agg(jsonb_build_object('id',c.id,'nome',c.nome,'telefone',c.telefone)), count(*)
    into v_cand, v_n
    from clientes c where c.excluido_em is null and c.nome_busca = sem_acento(trim(p_nome));
  if v_n = 1 then
    select id into v_id from clientes where excluido_em is null and nome_busca = sem_acento(trim(p_nome));
    if v_tel is not null then
      -- mesmo nome com outro telefone: pode ser outra pessoa
      if exists (select 1 from clientes where id = v_id and telefone_norm is not null and telefone_norm <> v_tel) then
        return jsonb_build_object('status','ambiguo','candidatos',v_cand,
          'pergunta','Já existe "'||p_nome||'" com outro telefone. É a mesma pessoa (atualizar telefone) ou um cliente novo?');
      end if;
      update clientes set telefone = p_telefone where id = v_id and telefone_norm is null;
    end if;
    return jsonb_build_object('status','existente','cliente_id',v_id,'por','nome');
  elsif v_n > 1 then
    return jsonb_build_object('status','ambiguo','candidatos',v_cand,'pergunta','Há mais de um cliente com esse nome. Qual deles?');
  end if;
  insert into clientes(nome, telefone, observacoes) values (trim(p_nome), p_telefone, p_obs) returning id into v_id;
  return jsonb_build_object('status','criado','cliente_id',v_id);
end $$;

-- ---------------------------------------------------------------------
-- Conformidade sanitária na venda
-- ---------------------------------------------------------------------
create or replace function checar_venda_medicamento(p_produto uuid, p_receita uuid) returns void
language plpgsql stable as $$
declare p produtos; lic jsonb; r receitas_medicas;
begin
  select * into p from produtos where id = p_produto;
  if p.classe_regulatoria = 'nao_medicamento' then return; end if;
  select licenca into lic from configuracoes where user_id = auth.uid();
  if coalesce(lic->>'afe_anvisa','') = '' or coalesce(lic->>'licenca_sanitaria','') = '' or coalesce(lic->>'responsavel_tecnico','') = '' then
    raise exception 'LICENCA_OBRIGATORIA: venda de medicamento exige AFE/ANVISA, licença sanitária e responsável técnico cadastrados em Configurações > Licenças.';
  end if;
  if (lic->>'licenca_validade') is not null and (lic->>'licenca_validade')::date < current_date then
    raise exception 'LICENCA_VENCIDA: a licença sanitária venceu em %.', lic->>'licenca_validade';
  end if;
  if coalesce(p.registro_anvisa,'') = '' then
    raise exception 'REGISTRO_ANVISA_AUSENTE: o produto "%" não tem registro/notificação na ANVISA cadastrado. Venda bloqueada.', p.nome;
  end if;
  if p.classe_regulatoria in ('tarja_vermelha','tarja_vermelha_retencao','controlado_344') then
    if p_receita is null then
      raise exception 'RECEITA_OBRIGATORIA: "%" é vendido somente com prescrição. Registre a receita (prescritor, CRM, data).', p.nome;
    end if;
    select * into r from receitas_medicas where id = p_receita;
    if p.classe_regulatoria in ('tarja_vermelha_retencao','controlado_344') and not r.retida then
      raise exception 'RECEITA_RETENCAO: "%" exige retenção da receita.', p.nome;
    end if;
  end if;
  if p.classe_regulatoria = 'controlado_344' and coalesce((lic->>'autorizado_controlados')::boolean, false) = false then
    raise exception 'CONTROLADO_BLOQUEADO: produto da Portaria 344/98. Exige Autorização Especial e escrituração no SNGPC; não pode ser vendido como mercadoria comum.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- RPC: registrar_venda
-- p = { cliente_id, data, forma_pagamento, vencimento, pago_na_hora, desconto, receita_medica_id,
--       itens:[{produto_id, quantidade, preco_unitario, desconto}], observacao,
--       chave_idempotencia, confirmar_duplicada }
-- ---------------------------------------------------------------------
create or replace function registrar_venda(p jsonb) returns jsonb
language plpgsql as $$
declare
  v_chave text := p->>'chave_idempotencia';
  v_res jsonb; v_venda uuid; v_obr uuid; v_num bigint;
  v_cliente uuid := (p->>'cliente_id')::uuid;
  v_data date := coalesce((p->>'data')::date, current_date);
  v_venc date := coalesce((p->>'vencimento')::date, (p->>'data')::date, current_date);
  it jsonb; prod produtos; lt record; v_rest numeric; v_take numeric;
  v_bruto numeric := 0; v_desc numeric := coalesce((p->>'desconto')::numeric, 0);
  v_custo numeric := 0; v_sem_custo boolean := false; v_total numeric; v_dup uuid; v_nomes text := '';
  v_cli_nome text;
begin
  if v_chave is not null then
    select resultado into v_res from idempotencia where user_id = auth.uid() and chave = v_chave;
    if v_res is not null then return v_res || '{"repetida":true}'; end if;
  end if;
  if jsonb_array_length(coalesce(p->'itens','[]')) = 0 then raise exception 'ITENS_OBRIGATORIOS'; end if;
  select nome into v_cli_nome from clientes where id = v_cliente and excluido_em is null;
  if v_cli_nome is null then raise exception 'CLIENTE_INEXISTENTE'; end if;

  insert into vendas(cliente_id, data, forma_pagamento, desconto, receita_medica_id, observacao)
  values (v_cliente, v_data, p->>'forma_pagamento', v_desc, (p->>'receita_medica_id')::uuid, p->>'observacao')
  returning id, numero into v_venda, v_num;

  for it in select * from jsonb_array_elements(p->'itens') loop
    select * into prod from produtos where id = (it->>'produto_id')::uuid and excluido_em is null for update;
    if prod.id is null then raise exception 'PRODUTO_INEXISTENTE: %', it->>'produto_id'; end if;
    perform checar_venda_medicamento(prod.id, (p->>'receita_medica_id')::uuid);
    v_nomes := v_nomes || case when v_nomes = '' then '' else ', ' end || prod.nome;
    v_rest := (it->>'quantidade')::numeric;
    if prod.estoque_atual < v_rest then
      raise exception 'ESTOQUE_INSUFICIENTE: "%" tem % % em estoque e a venda pede %.', prod.nome, prod.estoque_atual, prod.unidade, v_rest;
    end if;
    if prod.controla_lote and exists (select 1 from lotes where produto_id = prod.id and quantidade > 0) then
      -- FEFO: primeiro o que vence primeiro; lote vencido nunca é vendido
      for lt in select * from lotes where produto_id = prod.id and quantidade > 0
                 and (validade is null or validade >= v_data) order by validade nulls last, criado_em loop
        exit when v_rest <= 0;
        v_take := least(v_rest, lt.quantidade);
        insert into venda_itens(venda_id, produto_id, lote_id, quantidade, preco_unitario, desconto, custo_unitario)
        values (v_venda, prod.id, lt.id, v_take, (it->>'preco_unitario')::numeric,
                round(coalesce((it->>'desconto')::numeric,0) * v_take / (it->>'quantidade')::numeric, 2),
                coalesce(lt.custo_unitario, prod.preco_compra));
        perform movimentar_estoque(prod.id, lt.id, 'saida', v_take, 'venda', v_venda);
        v_rest := v_rest - v_take;
      end loop;
      if v_rest > 0 then raise exception 'ESTOQUE_VALIDO_INSUFICIENTE: "%" não tem lotes dentro da validade suficientes.', prod.nome; end if;
    else
      insert into venda_itens(venda_id, produto_id, quantidade, preco_unitario, desconto, custo_unitario)
      values (v_venda, prod.id, v_rest, (it->>'preco_unitario')::numeric, coalesce((it->>'desconto')::numeric,0), prod.preco_compra);
      perform movimentar_estoque(prod.id, null, 'saida', v_rest, 'venda', v_venda);
    end if;
  end loop;

  select sum(total), sum(quantidade * custo_unitario), bool_or(custo_unitario is null)
    into v_bruto, v_custo, v_sem_custo from venda_itens where venda_id = v_venda;
  v_total := v_bruto - v_desc;
  if v_total <= 0 then raise exception 'TOTAL_INVALIDO'; end if;

  -- Possível duplicidade: mesmo cliente e total nos últimos 10 minutos
  if coalesce((p->>'confirmar_duplicada')::boolean, false) = false then
    select id into v_dup from vendas where cliente_id = v_cliente and total = v_total and id <> v_venda
      and excluido_em is null and criado_em > now() - interval '10 minutes' limit 1;
    if v_dup is not null then
      raise exception 'POSSIVEL_DUPLICIDADE: já existe venda igual para este cliente há poucos minutos (%). Confirme para gravar outra.', v_dup;
    end if;
  end if;

  update vendas set total_bruto = v_bruto, total = v_total,
    custo_total = case when v_sem_custo then null else round(v_custo, 2) end,
    lucro_bruto = case when v_sem_custo then null else round(v_total - v_custo, 2) end,
    margem_pct  = case when v_sem_custo then null else round((v_total - v_custo) / v_total * 100, 2) end
  where id = v_venda;

  insert into obrigacoes(tipo, escopo, origem, origem_id, cliente_id, categoria_id, descricao, valor, vencimento)
  values ('receber','comercial','venda', v_venda, v_cliente, categoria_id('comercial','vendas'),
          'VENDA ' || upper(v_nomes) || ' - ' || v_cli_nome, v_total, v_venc)
  returning id into v_obr;

  if coalesce((p->>'pago_na_hora')::boolean, false) then
    perform registrar_pagamento(v_obr, v_total, v_data, p->>'forma_pagamento', null, 'Pago no ato da venda');
  end if;

  v_res := jsonb_build_object('ok', true, 'venda_id', v_venda, 'numero', v_num, 'obrigacao_id', v_obr,
    'total', v_total, 'custo_total', case when v_sem_custo then null else round(v_custo,2) end,
    'lucro_bruto', case when v_sem_custo then null else round(v_total - v_custo,2) end,
    'custo_pendente', v_sem_custo, 'vencimento', v_venc,
    'status', (select status from vendas where id = v_venda));
  if v_chave is not null then insert into idempotencia(chave, resultado) values (v_chave, v_res); end if;
  return v_res;
end $$;

-- ---------------------------------------------------------------------
-- RPC: registrar_compra
-- p = { fornecedor_id, fornecedor_nome, data, forma_pagamento, vencimento, parcelas, pago_na_hora,
--       itens:[{produto_id, quantidade, custo_unitario, lote, validade}], chave_idempotencia }
-- ---------------------------------------------------------------------
create or replace function registrar_compra(p jsonb) returns jsonb
language plpgsql as $$
declare
  v_chave text := p->>'chave_idempotencia'; v_res jsonb;
  v_compra uuid; v_num bigint; v_forn uuid := (p->>'fornecedor_id')::uuid; v_forn_nome text;
  v_data date := coalesce((p->>'data')::date, current_date);
  v_venc date := coalesce((p->>'vencimento')::date, (p->>'data')::date, current_date);
  v_parc int := greatest(coalesce((p->>'parcelas')::int, 1), 1);
  it jsonb; v_lote uuid; v_total numeric; v_obrs jsonb := '[]'; v_obr uuid; i int; v_val numeric; v_acum numeric := 0;
begin
  if v_chave is not null then
    select resultado into v_res from idempotencia where user_id = auth.uid() and chave = v_chave;
    if v_res is not null then return v_res || '{"repetida":true}'; end if;
  end if;
  if v_forn is null and coalesce(p->>'fornecedor_nome','') <> '' then
    select id into v_forn from fornecedores where excluido_em is null and nome_busca = sem_acento(trim(p->>'fornecedor_nome'));
    if v_forn is null then
      insert into fornecedores(nome) values (trim(p->>'fornecedor_nome')) returning id into v_forn;
    end if;
  end if;
  select nome into v_forn_nome from fornecedores where id = v_forn;

  insert into compras(fornecedor_id, data, forma_pagamento, observacao)
  values (v_forn, v_data, p->>'forma_pagamento', p->>'observacao') returning id, numero into v_compra, v_num;

  for it in select * from jsonb_array_elements(p->'itens') loop
    v_lote := null;
    if coalesce(it->>'lote','') <> '' then
      insert into lotes(produto_id, lote, validade, custo_unitario)
      values ((it->>'produto_id')::uuid, it->>'lote', (it->>'validade')::date, (it->>'custo_unitario')::numeric)
      on conflict (user_id, produto_id, lote) do update set validade = coalesce(excluded.validade, lotes.validade),
                                                           custo_unitario = excluded.custo_unitario
      returning id into v_lote;
    end if;
    insert into compra_itens(compra_id, produto_id, lote_id, quantidade, custo_unitario)
    values (v_compra, (it->>'produto_id')::uuid, v_lote, (it->>'quantidade')::numeric, (it->>'custo_unitario')::numeric);
    perform movimentar_estoque((it->>'produto_id')::uuid, v_lote, 'entrada', (it->>'quantidade')::numeric, 'compra', v_compra);
    update produtos set preco_compra = (it->>'custo_unitario')::numeric,
                        fornecedor_id = coalesce(fornecedor_id, v_forn)
     where id = (it->>'produto_id')::uuid;
  end loop;

  select sum(total) into v_total from compra_itens where compra_id = v_compra;
  update compras set total = v_total where id = v_compra;

  for i in 1..v_parc loop
    v_val := case when i < v_parc then round(v_total / v_parc, 2) else v_total - v_acum end;
    v_acum := v_acum + v_val;
    insert into obrigacoes(tipo, escopo, origem, origem_id, fornecedor_id, categoria_id, descricao, parcela_num, parcela_total, valor, vencimento)
    values ('pagar','comercial','compra', v_compra, v_forn, categoria_id('comercial','compras'),
            'COMPRA #' || v_num || coalesce(' - ' || v_forn_nome, ''), i, v_parc, v_val,
            (v_venc + ((i - 1) * interval '1 month'))::date)
    returning id into v_obr;
    v_obrs := v_obrs || jsonb_build_object('obrigacao_id', v_obr, 'parcela', i, 'valor', v_val,
                                           'vencimento', (v_venc + ((i - 1) * interval '1 month'))::date);
    if coalesce((p->>'pago_na_hora')::boolean, false) then
      perform registrar_pagamento(v_obr, v_val, v_data, p->>'forma_pagamento', null, 'Pago no ato da compra');
    end if;
  end loop;

  v_res := jsonb_build_object('ok', true, 'compra_id', v_compra, 'numero', v_num, 'total', v_total,
                              'fornecedor_id', v_forn, 'obrigacoes', v_obrs);
  if v_chave is not null then insert into idempotencia(chave, resultado) values (v_chave, v_res); end if;
  return v_res;
end $$;

-- ---------------------------------------------------------------------
-- Cálculo de empréstimo (espelho de scripts/calculos.mjs; os dois devem bater)
-- ---------------------------------------------------------------------
create or replace function calcular_emprestimo(p_principal numeric, p_taxa_pct numeric, p_modalidade text, p_periodos numeric)
returns table(juros numeric, total numeric) language sql immutable as $$
  select round(t - p_principal, 2), round(t, 2) from (
    select case when p_modalidade = 'composto'
                then p_principal * power(1 + p_taxa_pct/100, p_periodos)
                else p_principal * (1 + p_taxa_pct/100 * p_periodos) end as t) x
$$;

-- Converte a taxa do período para taxa mensal equivalente (para comparar com o limite legal)
create or replace function taxa_mensal_equivalente(p_taxa_pct numeric, p_periodicidade text, p_modalidade text, p_periodos numeric, p_dias int)
returns numeric language sql immutable as $$
  select round(case p_periodicidade
    when 'mensal' then p_taxa_pct
    when 'diaria' then case when p_modalidade='composto' then (power(1+p_taxa_pct/100, 30)-1)*100 else p_taxa_pct*30 end
    when 'semanal' then case when p_modalidade='composto' then (power(1+p_taxa_pct/100, 30.0/7)-1)*100 else p_taxa_pct*30/7 end
    when 'anual' then case when p_modalidade='composto' then (power(1+p_taxa_pct/100, 1.0/12)-1)*100 else p_taxa_pct/12 end
    when 'periodo_total' then p_taxa_pct / greatest(p_dias, 1) * 30
  end, 4)
$$;

-- p = { cliente_id, data, principal, taxa_pct, periodicidade, modalidade, periodos, parcelas, vencimento,
--       ciente_aviso_legal, chave_idempotencia }
create or replace function registrar_emprestimo(p jsonb) returns jsonb
language plpgsql as $$
declare
  v_chave text := p->>'chave_idempotencia'; v_res jsonb;
  v_cli uuid := (p->>'cliente_id')::uuid; v_cli_nome text;
  v_data date := coalesce((p->>'data')::date, current_date);
  v_venc date := (p->>'vencimento')::date;
  v_pr numeric := (p->>'principal')::numeric;
  v_tx numeric := coalesce((p->>'taxa_pct')::numeric, 0);
  v_per text := coalesce(p->>'periodicidade','mensal');
  v_mod text := coalesce(p->>'modalidade','simples');
  v_n numeric := (p->>'periodos')::numeric;
  v_parc int := greatest(coalesce((p->>'parcelas')::int,1),1);
  v_juros numeric; v_total numeric; v_eq numeric; v_lim numeric; v_acima boolean;
  v_emp uuid; v_num bigint; v_obrs jsonb := '[]'; v_obr uuid; i int; v_val numeric; v_vj numeric;
  v_acum numeric := 0; v_acumj numeric := 0; v_vi date; v_cond text;
begin
  if v_chave is not null then
    select resultado into v_res from idempotencia where user_id = auth.uid() and chave = v_chave;
    if v_res is not null then return v_res || '{"repetida":true}'; end if;
  end if;
  if v_venc is null then raise exception 'VENCIMENTO_OBRIGATORIO'; end if;
  if v_n is null then raise exception 'PERIODOS_OBRIGATORIO'; end if;
  select nome into v_cli_nome from clientes where id = v_cli and excluido_em is null;
  if v_cli_nome is null then raise exception 'CLIENTE_INEXISTENTE'; end if;

  select juros, total into v_juros, v_total from calcular_emprestimo(v_pr, v_tx, v_mod, v_n);
  v_eq := taxa_mensal_equivalente(v_tx, v_per, v_mod, v_n, (v_venc - v_data));
  select limite_juros_mensal_pct into v_lim from configuracoes where user_id = auth.uid();
  v_acima := v_eq > coalesce(v_lim, 1);
  if v_acima and coalesce((p->>'ciente_aviso_legal')::boolean, false) = false then
    raise exception 'AVISO_LEGAL_PENDENTE: taxa equivalente de % %% a.m. está acima da referência legal configurada (% %% a.m.) para empréstimo entre particulares. Mostre o aviso ao usuário e só grave com ciente_aviso_legal=true.', v_eq, v_lim;
  end if;
  if v_mod = 'composto' and v_per in ('diaria','semanal','mensal') then
    v_cond := 'ATENÇÃO: capitalização de juros em período inferior a anual entre particulares é vedada (Dec. 22.626/33, art. 4º; Súmula 121/STF). ';
  else v_cond := ''; end if;
  v_cond := v_cond || format('Principal R$ %s; taxa %s%% %s; juros %s; %s período(s); juros previstos R$ %s; total R$ %s; %s parcela(s); vencimento final %s; taxa mensal equivalente %s%%.',
            v_pr, v_tx, v_per, v_mod, v_n, v_juros, v_total, v_parc, to_char(v_venc,'DD/MM/YYYY'), v_eq);

  insert into emprestimos(cliente_id, data, principal, taxa_pct, periodicidade, modalidade, periodos, parcelas, vencimento,
                          juros_previstos, total_previsto, taxa_mensal_equivalente_pct, acima_limite_legal,
                          ciencia_aviso_legal_em, condicoes_texto)
  values (v_cli, v_data, v_pr, v_tx, v_per, v_mod, v_n, v_parc, v_venc, v_juros, v_total, v_eq, v_acima,
          case when v_acima then now() end, v_cond)
  returning id, numero into v_emp, v_num;

  -- Saída do caixa: é patrimonial (dinheiro emprestado não é despesa)
  insert into lancamentos(data, tipo, escopo, natureza, valor, categoria_id, conta_id, origem, origem_id, descricao)
  values (v_data, 'saida', 'comercial', 'patrimonial', v_pr, categoria_id('comercial','emprestimo_concedido'),
          coalesce((p->>'conta_id')::uuid, conta_padrao('comercial')), 'emprestimo', v_emp,
          'Empréstimo #' || v_num || ' - ' || v_cli_nome);

  -- Parcelas iguais (juros distribuídos proporcionalmente); a última absorve o arredondamento
  for i in 1..v_parc loop
    v_val := case when i < v_parc then round(v_total / v_parc, 2) else v_total - v_acum end;
    v_vj  := case when i < v_parc then round(v_juros / v_parc, 2) else v_juros - v_acumj end;
    v_acum := v_acum + v_val; v_acumj := v_acumj + v_vj;
    v_vi := case when v_parc = 1 then v_venc
                 else (v_venc - ((v_parc - i) * interval '1 month'))::date end;
    insert into obrigacoes(tipo, escopo, origem, origem_id, cliente_id, categoria_id, descricao, parcela_num, parcela_total,
                           valor, valor_juros, vencimento)
    values ('receber','comercial','emprestimo', v_emp, v_cli, categoria_id('comercial','juros'),
            'EMPRÉSTIMO #' || v_num || ' - ' || v_cli_nome, i, v_parc, v_val, v_vj, v_vi)
    returning id into v_obr;
    v_obrs := v_obrs || jsonb_build_object('obrigacao_id', v_obr, 'parcela', i, 'valor', v_val, 'vencimento', v_vi);
  end loop;

  insert into emprestimo_eventos(emprestimo_id, tipo, dados) values (v_emp, 'criacao', p - 'chave_idempotencia');

  v_res := jsonb_build_object('ok', true, 'emprestimo_id', v_emp, 'numero', v_num, 'principal', v_pr,
    'juros_previstos', v_juros, 'total_previsto', v_total, 'taxa_mensal_equivalente_pct', v_eq,
    'acima_limite_legal', v_acima, 'condicoes', v_cond, 'obrigacoes', v_obrs);
  if v_chave is not null then insert into idempotencia(chave, resultado) values (v_chave, v_res); end if;
  return v_res;
end $$;

-- ---------------------------------------------------------------------
-- RPC: registrar_pagamento (recebimento ou pagamento, total ou parcial)
-- Juros primeiro, depois principal (Código Civil, art. 354)
-- ---------------------------------------------------------------------
create or replace function registrar_pagamento(p_obrigacao uuid, p_valor numeric, p_data date default current_date,
  p_forma text default null, p_conta uuid default null, p_obs text default null, p_chave text default null)
returns jsonb language plpgsql as $$
declare
  o obrigacoes; v_res jsonb; v_juros numeric; v_princ numeric; v_pag uuid; v_conta uuid; v_status text; v_emp_status text;
begin
  if p_chave is not null then
    select resultado into v_res from idempotencia where user_id = auth.uid() and chave = p_chave;
    if v_res is not null then return v_res || '{"repetida":true}'; end if;
  end if;
  select * into o from obrigacoes where id = p_obrigacao and excluido_em is null for update;
  if o.id is null then raise exception 'OBRIGACAO_INEXISTENTE'; end if;
  if o.status in ('pago','cancelado','renegociado') then raise exception 'OBRIGACAO_JA_ENCERRADA: situação %', o.status; end if;
  if p_valor > o.saldo + 0.009 then
    raise exception 'VALOR_ACIMA_DO_SALDO: saldo é R$ %, pagamento informado R$ %', o.saldo, p_valor;
  end if;

  v_juros := least(p_valor, greatest(o.valor_juros - o.juros_pago, 0));
  v_princ := p_valor - v_juros;
  v_conta := coalesce(p_conta, conta_padrao(o.escopo));

  insert into pagamentos(obrigacao_id, data, valor, juros_valor, principal_valor, conta_id, forma, observacao)
  values (o.id, coalesce(p_data, current_date), p_valor, v_juros, v_princ, v_conta, p_forma, p_obs) returning id into v_pag;

  v_status := case when o.valor_pago + p_valor >= o.valor - 0.009 then 'pago' else 'parcial' end;
  update obrigacoes set valor_pago = valor_pago + p_valor, juros_pago = juros_pago + v_juros, status = v_status,
         pago_em = case when v_status = 'pago' then coalesce(p_data, current_date) end
   where id = o.id;

  -- Livro-caixa
  if o.origem = 'emprestimo' then
    if v_juros > 0 then
      insert into lancamentos(data, tipo, escopo, natureza, valor, categoria_id, conta_id, origem, origem_id, descricao)
      values (p_data, 'entrada', o.escopo, 'operacional', v_juros, categoria_id(o.escopo,'juros'), v_conta, 'pagamento', v_pag, 'Juros - ' || o.descricao);
    end if;
    if v_princ > 0 then
      insert into lancamentos(data, tipo, escopo, natureza, valor, categoria_id, conta_id, origem, origem_id, descricao)
      values (p_data, 'entrada', o.escopo, 'patrimonial', v_princ, categoria_id(o.escopo,'retorno_principal'), v_conta, 'pagamento', v_pag, 'Principal - ' || o.descricao);
    end if;
  else
    insert into lancamentos(data, tipo, escopo, natureza, valor, categoria_id, conta_id, origem, origem_id, descricao)
    values (p_data, case when o.tipo = 'receber' then 'entrada' else 'saida' end, o.escopo, 'operacional', p_valor,
            o.categoria_id, v_conta, 'pagamento', v_pag, o.descricao);
  end if;

  -- Atualiza a origem
  if o.origem = 'venda' then
    update vendas set status = (select case when bool_and(status='pago') then 'pago' when bool_or(valor_pago>0) then 'parcial' else 'pendente' end
                                from obrigacoes where origem='venda' and origem_id=o.origem_id and excluido_em is null)
     where id = o.origem_id;
  elsif o.origem = 'compra' then
    update compras set status = (select case when bool_and(status='pago') then 'pago' when bool_or(valor_pago>0) then 'parcial' else 'pendente' end
                                 from obrigacoes where origem='compra' and origem_id=o.origem_id and excluido_em is null)
     where id = o.origem_id;
  elsif o.origem = 'emprestimo' then
    insert into emprestimo_eventos(emprestimo_id, tipo, dados)
    values (o.origem_id, case when v_status='pago' then 'pagamento' else 'pagamento_parcial' end,
            jsonb_build_object('pagamento_id', v_pag, 'obrigacao_id', o.id, 'valor', p_valor, 'juros', v_juros, 'principal', v_princ, 'data', p_data));
    if not exists (select 1 from obrigacoes where origem='emprestimo' and origem_id=o.origem_id
                   and status in ('pendente','parcial') and excluido_em is null) then
      update emprestimos set status = 'quitado' where id = o.origem_id;
      insert into emprestimo_eventos(emprestimo_id, tipo, dados) values (o.origem_id, 'quitacao', jsonb_build_object('data', p_data));
    end if;
    select status into v_emp_status from emprestimos where id = o.origem_id;
  end if;

  v_res := jsonb_build_object('ok', true, 'pagamento_id', v_pag, 'obrigacao_id', o.id, 'valor', p_valor,
    'juros', v_juros, 'principal', v_princ, 'saldo_restante', o.saldo - p_valor, 'status_obrigacao', v_status,
    'status_emprestimo', v_emp_status);
  if p_chave is not null then insert into idempotencia(chave, resultado) values (p_chave, v_res); end if;
  return v_res;
end $$;

create or replace function estornar_pagamento(p_pagamento uuid, p_motivo text) returns jsonb
language plpgsql as $$
declare pg pagamentos; o obrigacoes;
begin
  select * into pg from pagamentos where id = p_pagamento and estornado_em is null for update;
  if pg.id is null then raise exception 'PAGAMENTO_INEXISTENTE_OU_JA_ESTORNADO'; end if;
  update pagamentos set estornado_em = now(), observacao = coalesce(observacao,'') || ' | ESTORNO: ' || p_motivo where id = pg.id;
  update lancamentos set excluido_em = now() where origem = 'pagamento' and origem_id = pg.id;
  update obrigacoes set valor_pago = valor_pago - pg.valor, juros_pago = juros_pago - pg.juros_valor, pago_em = null,
         status = case when valor_pago - pg.valor <= 0 then 'pendente' else 'parcial' end
   where id = pg.obrigacao_id returning * into o;
  if o.origem = 'emprestimo' then
    update emprestimos set status = 'ativo' where id = o.origem_id and status = 'quitado';
    insert into emprestimo_eventos(emprestimo_id, tipo, dados) values (o.origem_id, 'estorno', jsonb_build_object('pagamento_id', pg.id, 'motivo', p_motivo));
  end if;
  return jsonb_build_object('ok', true, 'obrigacao_id', o.id, 'saldo', o.saldo);
end $$;

-- ---------------------------------------------------------------------
-- RPC: alterar vencimento (prorrogação) e renegociar empréstimo
-- ---------------------------------------------------------------------
create or replace function alterar_vencimento(p_obrigacao uuid, p_nova date, p_motivo text default null) returns jsonb
language plpgsql as $$
declare o obrigacoes;
begin
  select * into o from obrigacoes where id = p_obrigacao and excluido_em is null for update;
  if o.id is null then raise exception 'OBRIGACAO_INEXISTENTE'; end if;
  update obrigacoes set vencimento = p_nova where id = o.id;          -- trigger reenfileira a agenda (mesmo evento)
  if o.origem = 'emprestimo' then
    insert into emprestimo_eventos(emprestimo_id, tipo, dados)
    values (o.origem_id, 'prorrogacao', jsonb_build_object('obrigacao_id', o.id, 'de', o.vencimento, 'para', p_nova, 'motivo', p_motivo));
    update emprestimos set vencimento = greatest(vencimento, p_nova),
           status = case when status = 'atrasado' and p_nova >= current_date then 'ativo' else status end
     where id = o.origem_id;
  end if;
  return jsonb_build_object('ok', true, 'obrigacao_id', o.id, 'vencimento_anterior', o.vencimento, 'novo_vencimento', p_nova);
end $$;

-- Encerra o saldo aberto e cria novas parcelas com novas condições sobre o saldo devedor
-- p = { emprestimo_id, taxa_pct, modalidade, periodicidade, periodos, parcelas, vencimento, ciente_aviso_legal, motivo }
create or replace function renegociar_emprestimo(p jsonb) returns jsonb
language plpgsql as $$
declare e emprestimos; v_saldo numeric; v_novo jsonb; v_lim numeric; v_eq numeric;
  v_juros numeric; v_total numeric; v_parc int := greatest(coalesce((p->>'parcelas')::int,1),1);
  i int; v_val numeric; v_vj numeric; v_acum numeric := 0; v_acumj numeric := 0; v_venc date := (p->>'vencimento')::date;
  v_obrs jsonb := '[]'; v_obr uuid; v_vi date; v_cli text;
begin
  select * into e from emprestimos where id = (p->>'emprestimo_id')::uuid for update;
  if e.id is null then raise exception 'EMPRESTIMO_INEXISTENTE'; end if;
  select coalesce(sum(saldo),0) into v_saldo from obrigacoes
   where origem='emprestimo' and origem_id=e.id and status in ('pendente','parcial') and excluido_em is null;
  if v_saldo <= 0 then raise exception 'SEM_SALDO_PARA_RENEGOCIAR'; end if;

  select juros, total into v_juros, v_total from calcular_emprestimo(v_saldo, coalesce((p->>'taxa_pct')::numeric,0),
         coalesce(p->>'modalidade','simples'), (p->>'periodos')::numeric);
  v_eq := taxa_mensal_equivalente(coalesce((p->>'taxa_pct')::numeric,0), coalesce(p->>'periodicidade','mensal'),
         coalesce(p->>'modalidade','simples'), (p->>'periodos')::numeric, v_venc - current_date);
  select limite_juros_mensal_pct into v_lim from configuracoes where user_id = auth.uid();
  if v_eq > coalesce(v_lim,1) and coalesce((p->>'ciente_aviso_legal')::boolean,false) = false then
    raise exception 'AVISO_LEGAL_PENDENTE: taxa equivalente de % %% a.m. acima da referência (% %% a.m.).', v_eq, v_lim;
  end if;

  update obrigacoes set status = 'renegociado'
   where origem='emprestimo' and origem_id=e.id and status in ('pendente','parcial') and excluido_em is null;
  select nome into v_cli from clientes where id = e.cliente_id;
  for i in 1..v_parc loop
    v_val := case when i < v_parc then round(v_total / v_parc, 2) else v_total - v_acum end;
    v_vj  := case when i < v_parc then round(v_juros / v_parc, 2) else v_juros - v_acumj end;
    v_acum := v_acum + v_val; v_acumj := v_acumj + v_vj;
    v_vi := case when v_parc = 1 then v_venc else (v_venc - ((v_parc - i) * interval '1 month'))::date end;
    insert into obrigacoes(tipo, escopo, origem, origem_id, cliente_id, categoria_id, descricao, parcela_num, parcela_total, valor, valor_juros, vencimento)
    values ('receber','comercial','emprestimo', e.id, e.cliente_id, categoria_id('comercial','juros'),
            'EMPRÉSTIMO #' || e.numero || ' (RENEG.) - ' || v_cli, i, v_parc, v_val, v_vj, v_vi)
    returning id into v_obr;
    v_obrs := v_obrs || jsonb_build_object('obrigacao_id', v_obr, 'parcela', i, 'valor', v_val, 'vencimento', v_vi);
  end loop;
  update emprestimos set status = 'renegociado', vencimento = v_venc, juros_previstos = juros_previstos + v_juros,
         total_previsto = total_previsto + v_juros where id = e.id;
  v_novo := jsonb_build_object('saldo_renegociado', v_saldo, 'juros_novos', v_juros, 'novo_total', v_total,
                               'taxa_mensal_equivalente_pct', v_eq, 'obrigacoes', v_obrs, 'motivo', p->>'motivo');
  insert into emprestimo_eventos(emprestimo_id, tipo, dados) values (e.id, 'renegociacao', v_novo || jsonb_build_object('condicoes', p));
  return jsonb_build_object('ok', true, 'emprestimo_id', e.id) || v_novo;
end $$;

-- ---------------------------------------------------------------------
-- RPC: despesas e receitas avulsas (pessoais ou comerciais)
-- p = { descricao, valor, escopo, categoria_slug, data, vencimento, pago, conta_id, parcelas, chave_idempotencia }
-- ---------------------------------------------------------------------
create or replace function registrar_conta(p jsonb) returns jsonb
language plpgsql as $$
declare
  v_chave text := p->>'chave_idempotencia'; v_res jsonb;
  v_tipo text := coalesce(p->>'tipo','pagar');                 -- 'pagar' = despesa; 'receber' = receita
  v_esc text := coalesce(p->>'escopo','pessoal');
  v_cat uuid := categoria_id(v_esc, coalesce(p->>'categoria_slug',
                  case when v_tipo='pagar' and v_esc='pessoal' then 'outras'
                       when v_tipo='pagar' then 'despesas_comerciais'
                       when v_esc='pessoal' then 'outras_receitas' else 'vendas' end));
  v_data date := coalesce((p->>'data')::date, current_date);
  v_venc date := coalesce((p->>'vencimento')::date, v_data);
  v_parc int := greatest(coalesce((p->>'parcelas')::int,1),1);
  v_total numeric := (p->>'valor')::numeric;
  i int; v_val numeric; v_acum numeric := 0; v_obr uuid; v_obrs jsonb := '[]'; v_pg jsonb;
begin
  if v_chave is not null then
    select resultado into v_res from idempotencia where user_id = auth.uid() and chave = v_chave;
    if v_res is not null then return v_res || '{"repetida":true}'; end if;
  end if;
  if v_cat is null then raise exception 'CATEGORIA_INEXISTENTE: %', p->>'categoria_slug'; end if;
  for i in 1..v_parc loop
    v_val := case when i < v_parc then round(v_total / v_parc, 2) else v_total - v_acum end;
    v_acum := v_acum + v_val;
    insert into obrigacoes(tipo, escopo, origem, categoria_id, descricao, parcela_num, parcela_total, valor, vencimento)
    values (v_tipo, v_esc, case when v_tipo='pagar' then 'despesa' else 'receita' end, v_cat,
            upper(p->>'descricao'), i, v_parc, v_val, (v_venc + ((i-1) * interval '1 month'))::date)
    returning id into v_obr;
    v_pg := null;
    if i = 1 and coalesce((p->>'pago')::boolean, false) then
      v_pg := registrar_pagamento(v_obr, v_val, v_data, p->>'forma', (p->>'conta_id')::uuid, null);
    end if;
    v_obrs := v_obrs || jsonb_build_object('obrigacao_id', v_obr, 'parcela', i, 'valor', v_val,
              'vencimento', (v_venc + ((i-1) * interval '1 month'))::date, 'pago', v_pg is not null);
  end loop;
  v_res := jsonb_build_object('ok', true, 'escopo', v_esc, 'categoria', (select nome from categorias where id = v_cat), 'obrigacoes', v_obrs);
  if v_chave is not null then insert into idempotencia(chave, resultado) values (v_chave, v_res); end if;
  return v_res;
end $$;

-- ---------------------------------------------------------------------
-- RPC: contracheque PM (substitui os itens da competência)
-- p = { competencia:'2026-11-01', data_pagamento, conta_id, itens:[{tipo, rubrica, descricao, valor}] }
-- ---------------------------------------------------------------------
create or replace function registrar_contracheque(p jsonb) returns jsonb
language plpgsql as $$
declare v_cc uuid; v_bruto numeric; v_desc numeric; v_liq numeric; v_comp date := date_trunc('month', (p->>'competencia')::date)::date;
begin
  insert into contracheques(competencia, data_pagamento, conta_id, observacao)
  values (v_comp, (p->>'data_pagamento')::date, coalesce((p->>'conta_id')::uuid, conta_padrao('pessoal')), p->>'observacao')
  on conflict (user_id, competencia) do update set data_pagamento = excluded.data_pagamento, observacao = excluded.observacao
  returning id into v_cc;
  delete from contracheque_itens where contracheque_id = v_cc;
  insert into contracheque_itens(contracheque_id, tipo, rubrica, descricao, valor)
    select v_cc, x->>'tipo', x->>'rubrica', x->>'descricao', (x->>'valor')::numeric from jsonb_array_elements(p->'itens') x;
  select coalesce(sum(valor) filter (where tipo='provento'),0), coalesce(sum(valor) filter (where tipo='desconto'),0)
    into v_bruto, v_desc from contracheque_itens where contracheque_id = v_cc;
  update contracheques set bruto = v_bruto, descontos = v_desc where id = v_cc returning liquido into v_liq;
  -- Receita PESSOAL (nunca comercial): um lançamento por competência, substituído se reenviado
  update lancamentos set excluido_em = now() where origem = 'contracheque' and origem_id = v_cc and excluido_em is null;
  if (p->>'data_pagamento') is not null and v_liq > 0 then
    insert into lancamentos(data, tipo, escopo, natureza, valor, categoria_id, conta_id, origem, origem_id, descricao)
    values ((p->>'data_pagamento')::date, 'entrada', 'pessoal', 'operacional', v_liq, categoria_id('pessoal','salario_pm'),
            coalesce((p->>'conta_id')::uuid, conta_padrao('pessoal')), 'contracheque', v_cc,
            'Salário PM ' || to_char(v_comp, 'MM/YYYY'));
  end if;
  return jsonb_build_object('ok', true, 'contracheque_id', v_cc, 'competencia', v_comp, 'bruto', v_bruto, 'descontos', v_desc, 'liquido', v_liq);
end $$;

-- ---------------------------------------------------------------------
-- Rotinas diárias (pg_cron): atrasos e recorrências
-- ---------------------------------------------------------------------
create or replace function rotina_diaria() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  -- Empréstimos com parcela vencida e saldo aberto passam a "atrasado" (registra o evento uma vez)
  for r in select distinct e.id, e.user_id from emprestimos e join obrigacoes o on o.origem='emprestimo' and o.origem_id=e.id
           where e.status in ('ativo','renegociado') and o.status in ('pendente','parcial') and o.vencimento < current_date
             and o.excluido_em is null loop
    update emprestimos set status = 'atrasado' where id = r.id;
    insert into emprestimo_eventos(user_id, emprestimo_id, tipo, dados) values (r.user_id, r.id, 'atraso', jsonb_build_object('data', current_date));
  end loop;
  -- Recorrências: gera as obrigações dos próximos 35 dias
  for r in select * from recorrencias where ativa and excluido_em is null and (fim is null or fim >= current_date) loop
    declare d date := greatest(coalesce(r.gerado_ate + 1, r.inicio), r.inicio);
            v date;
    begin
      while d <= current_date + 35 loop
        v := make_date(extract(year from d)::int, extract(month from d)::int,
                       least(r.dia_vencimento, extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int));
        if v >= d and (r.fim is null or v <= r.fim)
           and not exists (select 1 from obrigacoes where origem='recorrencia' and origem_id=r.id and vencimento=v) then
          insert into obrigacoes(user_id, tipo, escopo, origem, origem_id, categoria_id, descricao, valor, vencimento)
          values (r.user_id, r.tipo, r.escopo, 'recorrencia', r.id, r.categoria_id, upper(r.descricao), r.valor, v);
        end if;
        d := (date_trunc('month', d) + interval '1 month')::date;
      end loop;
      update recorrencias set gerado_ate = current_date + 35 where id = r.id;
    end;
  end loop;
end $$;

-- Agendamento (rode no SQL Editor depois de habilitar pg_cron e pg_net; troque <PROJETO> e guarde a chave no Vault):
-- select cron.schedule('rotina-diaria', '5 3 * * *', $$ select rotina_diaria() $$);
-- select cron.schedule('agenda-sync', '*/5 * * * *', $$
--   select net.http_post(url := 'https://<PROJETO>.supabase.co/functions/v1/agenda-sync',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key'),
--                                   'Content-Type','application/json'), body := '{}'::jsonb) $$);
-- select cron.schedule('backup-diario', '30 3 * * *', $$ select net.http_post(url := 'https://<PROJETO>.supabase.co/functions/v1/backup', ...) $$);

-- ---------------------------------------------------------------------
-- Views (security_invoker: respeitam o RLS)
-- ---------------------------------------------------------------------
create view v_obrigacoes with (security_invoker = true) as
select o.*,
  case when o.status in ('pago','cancelado','renegociado') then o.status
       when o.vencimento < current_date then 'atrasado'
       when o.valor_pago > 0 then 'parcial' else 'pendente' end as situacao,
  greatest(current_date - o.vencimento, 0) as dias_atraso,
  c.nome as cliente_nome, c.telefone as cliente_telefone, f.nome as fornecedor_nome, cat.nome as categoria_nome,
  ae.status as agenda_status, ae.google_event_id, ae.html_link as agenda_link
from obrigacoes o
left join clientes c on c.id = o.cliente_id
left join fornecedores f on f.id = o.fornecedor_id
left join categorias cat on cat.id = o.categoria_id
left join agenda_eventos ae on ae.obrigacao_id = o.id
where o.excluido_em is null;

create view v_clientes_resumo with (security_invoker = true) as
select c.id, c.numero, c.nome, c.telefone, c.criado_em, c.observacoes,
  coalesce((select sum(v.total) from vendas v where v.cliente_id=c.id and v.excluido_em is null and v.status<>'cancelado'),0) as total_comprado,
  coalesce((select count(*) from vendas v where v.cliente_id=c.id and v.excluido_em is null and v.status<>'cancelado'),0) as qtd_compras,
  coalesce((select sum(e.principal) from emprestimos e where e.cliente_id=c.id and e.excluido_em is null and e.status<>'cancelado'),0) as total_emprestado,
  coalesce((select sum(o.saldo) from obrigacoes o where o.cliente_id=c.id and o.tipo='receber' and o.status in ('pendente','parcial') and o.excluido_em is null),0) as valor_pendente,
  coalesce((select sum(o.saldo) from obrigacoes o where o.cliente_id=c.id and o.tipo='receber' and o.status in ('pendente','parcial') and o.vencimento < current_date and o.excluido_em is null),0) as valor_atrasado,
  coalesce((select sum(pg.valor) from pagamentos pg join obrigacoes o on o.id=pg.obrigacao_id where o.cliente_id=c.id and pg.estornado_em is null),0) as valor_pago,
  coalesce((select sum(pg.juros_valor) from pagamentos pg join obrigacoes o on o.id=pg.obrigacao_id where o.cliente_id=c.id and pg.estornado_em is null),0) as juros_pagos
from clientes c where c.excluido_em is null;

create view v_vendas_mensal with (security_invoker = true) as
with v as (
  select v.*, date_trunc('month', v.data)::date as mes,
         not exists (select 1 from vendas v3 where v3.cliente_id = v.cliente_id and v3.excluido_em is null
                     and v3.status <> 'cancelado' and v3.data < date_trunc('month', v.data)) as cliente_novo
  from vendas v where v.excluido_em is null and v.status <> 'cancelado'
), itens as (
  select v.mes, sum(vi.quantidade) as qtd_itens from v join venda_itens vi on vi.venda_id = v.id group by v.mes
)
select v.mes,
  sum(v.total) as faturamento,
  count(*) as qtd_vendas,
  coalesce(max(i.qtd_itens), 0) as qtd_itens,
  sum(v.custo_total) as cmv,
  sum(v.lucro_bruto) as lucro_bruto,
  round(sum(v.lucro_bruto) / nullif(sum(v.total) filter (where v.lucro_bruto is not null), 0) * 100, 2) as margem_media_pct,
  round(sum(v.total) / nullif(count(*), 0), 2) as ticket_medio,
  count(*) filter (where v.custo_total is null) as vendas_sem_custo,
  count(distinct v.cliente_id) as clientes_ativos,
  count(distinct v.cliente_id) filter (where v.cliente_novo) as clientes_novos,
  count(distinct v.cliente_id) filter (where not v.cliente_novo) as clientes_recorrentes
from v left join itens i on i.mes = v.mes
group by v.mes;

create view v_estoque_alertas with (security_invoker = true) as
select p.id, p.nome, p.estoque_atual, p.estoque_minimo, 'estoque_baixo' as alerta, null::date as validade, null::text as lote
from produtos p where p.excluido_em is null and p.estoque_atual <= p.estoque_minimo
union all
select p.id, p.nome, l.quantidade, p.estoque_minimo,
  case when l.validade < current_date then 'vencido' else 'vence_em_breve' end, l.validade, l.lote
from lotes l join produtos p on p.id = l.produto_id
where l.quantidade > 0 and l.validade is not null and l.validade <= current_date + 60 and p.excluido_em is null;

create view v_saldo_contas with (security_invoker = true) as
select c.id, c.nome, c.escopo, c.tipo,
  c.saldo_inicial + coalesce(sum(case when l.tipo='entrada' then l.valor else -l.valor end) filter (where l.excluido_em is null), 0) as saldo
from contas_financeiras c left join lancamentos l on l.conta_id = c.id
where c.excluido_em is null group by c.id;
