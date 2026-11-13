-- RESTAURANTE INTELIGENTE — banco de dados (Supabase/Postgres)
-- Multiusuário por restaurante: cada funcionário tem seu próprio acesso (usuário interno + PIN validado no servidor).
-- Toda a proteção é feita por RLS: cada pessoa só vê o próprio restaurante e só o que o seu papel permite.
-- Papéis: admin (tudo), compras, solicitante, caixa, estoque. Um funcionário pode ter mais de um papel.

-- ============ cadastro do restaurante e equipe ============
create table if not exists rest_restaurantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text not null unique,                       -- código que a equipe digita para entrar (ex.: SABOR-7K3P)
  logo_path text,
  cnpj text, telefone text, endereco text,
  fuso text not null default 'America/Bahia',
  saldo_inicial numeric(14,2) not null default 0,    -- caixa/banco informado pelo dono
  saldo_em date not null default current_date,
  agenda_token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  criado_em timestamptz not null default now()
);

create table if not exists rest_funcionarios (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references rest_restaurantes(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  papeis text[] not null default '{solicitante}' check (papeis <@ array['admin','compras','solicitante','caixa','estoque']::text[] and cardinality(papeis) > 0),
  setor text, telefone text,
  ativo boolean not null default true,
  ultimo_acesso timestamptz,
  criado_em timestamptz not null default now(),
  unique (restaurante_id, nome)
);
create index if not exists rest_funcionarios_rest on rest_funcionarios(restaurante_id);

-- PIN fica separado e SEM política: só o servidor (service role) lê.
create table if not exists rest_pins (
  funcionario_id uuid primary key references rest_funcionarios(id) on delete cascade,
  hash text not null, sal text not null,
  tentativas int not null default 0, bloqueado_ate timestamptz,
  atualizado_em timestamptz not null default now()
);

-- ============ funções de permissão ============
create or replace function rest_meu_restaurante() returns uuid
language sql stable security definer set search_path = public as $$
  select restaurante_id from rest_funcionarios where user_id = auth.uid() and ativo limit 1
$$;
create or replace function rest_meu_funcionario() returns uuid
language sql stable security definer set search_path = public as $$
  select id from rest_funcionarios where user_id = auth.uid() and ativo limit 1
$$;
-- admin pode tudo
create or replace function rest_pode(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rest_funcionarios where user_id = auth.uid() and ativo and (p = any(papeis) or 'admin' = any(papeis)))
$$;

-- ============ produtos e fornecedores ============
create table if not exists rest_fornecedores (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  nome text not null, chave text not null,
  fantasia text, cnpj text, telefone text, endereco text, contato text, categoria text,
  condicoes_pagamento text, prazo_entrega_dias int, obs text,
  grafias text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (restaurante_id, chave)
);
create unique index if not exists rest_fornecedores_cnpj on rest_fornecedores(restaurante_id, cnpj) where cnpj is not null and cnpj <> '';

create table if not exists rest_produtos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  nome text not null, chave text not null,
  categoria text not null default 'outros',
  unidade text not null default 'un',
  estoque_atual numeric(14,3) not null default 0,
  estoque_minimo numeric(14,3) not null default 0,
  controla_estoque boolean not null default true,
  status text not null default 'ativo' check (status in ('ativo','pendente','inativo')), -- pendente = criado por funcionário, aguarda o responsável
  grafias text[] not null default '{}',
  criado_por uuid default rest_meu_funcionario() references rest_funcionarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (restaurante_id, chave)
);
create index if not exists rest_produtos_cat on rest_produtos(restaurante_id, categoria);

-- ============ solicitações de compra (funcionários) ============
create table if not exists rest_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  solicitante_id uuid not null default rest_meu_funcionario() references rest_funcionarios(id),
  setor text,
  status text not null default 'em_elaboracao' check (status in ('em_elaboracao','enviada','em_analise','aprovada','reprovada','em_compra','parcial','comprada','recebida','cancelada')),
  obs text, motivo text,
  enviada_em timestamptz, analisada_por uuid references rest_funcionarios(id), analisada_em timestamptz,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create index if not exists rest_solic_rest on rest_solicitacoes(restaurante_id, status);

create table if not exists rest_solicitacao_itens (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references rest_solicitacoes(id) on delete cascade,
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  produto_id uuid references rest_produtos(id) on delete set null,
  nome_livre text,
  quantidade numeric(14,3) not null check (quantidade > 0),
  unidade text not null default 'un',
  obs text, foto_path text,
  qtd_aprovada numeric(14,3),                 -- o responsável pode alterar
  removido boolean not null default false,    -- removido pelo responsável (fica no histórico)
  adicionado_pelo_responsavel boolean not null default false,
  criado_em timestamptz not null default now(),
  check (produto_id is not null or nullif(trim(nome_livre), '') is not null)
);
create index if not exists rest_solic_itens on rest_solicitacao_itens(solicitacao_id);

-- ============ notas fiscais ============
create table if not exists rest_notas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  fornecedor_id uuid references rest_fornecedores(id) on delete set null,
  cnpj text, razao_social text, numero text, serie text, chave_acesso text,
  data_emissao date, valor_total numeric(14,2), forma_pagamento text, vencimento date,
  arquivo_path text, texto_ocr text, dados jsonb,
  status text not null default 'pendente' check (status in ('pendente','conferida','descartada')),  -- leitura automática NUNCA vale sem conferência
  divergencias jsonb,
  compra_id uuid,
  enviada_por uuid default rest_meu_funcionario() references rest_funcionarios(id) on delete set null,
  conferida_por uuid references rest_funcionarios(id), conferida_em timestamptz,
  criado_em timestamptz not null default now()
);
create unique index if not exists rest_notas_chave on rest_notas(restaurante_id, chave_acesso) where chave_acesso is not null and chave_acesso <> '';
create unique index if not exists rest_notas_num on rest_notas(restaurante_id, cnpj, numero, coalesce(serie, '')) where cnpj is not null and numero is not null and status <> 'descartada';

-- ============ compras efetivamente realizadas ============
create table if not exists rest_importacoes (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  arquivo text, compras_novas int not null default 0, compras_repetidas int not null default 0,
  resumo jsonb, avisos jsonb,
  feito_por uuid default rest_meu_funcionario() references rest_funcionarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists rest_compras (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  data date not null,
  fornecedor_id uuid references rest_fornecedores(id) on delete set null,
  solicitacao_id uuid references rest_solicitacoes(id) on delete set null,
  nota_id uuid references rest_notas(id) on delete set null,
  forma_pagamento text, vencimento date, pago_na_compra boolean not null default false, parcelas int not null default 1,
  subtotal numeric(14,2) not null default 0, desconto numeric(14,2) not null default 0, total numeric(14,2) not null,
  responsavel_id uuid default rest_meu_funcionario() references rest_funcionarios(id) on delete set null,
  origem text not null default 'manual' check (origem in ('manual','planilha','nota','ia')),
  status text not null default 'comprada' check (status in ('comprada','parcial_recebida','recebida','cancelada')),
  recebido_em timestamptz, recebido_por uuid references rest_funcionarios(id),
  obs text, assinatura text, importacao_id uuid references rest_importacoes(id) on delete set null,
  data_estimada boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (restaurante_id, assinatura)
);
create index if not exists rest_compras_data on rest_compras(restaurante_id, data);
alter table rest_notas add constraint rest_notas_compra_fk foreign key (compra_id) references rest_compras(id) on delete set null;
create unique index if not exists rest_notas_uma_por_compra on rest_notas(compra_id) where compra_id is not null;

create table if not exists rest_compra_itens (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references rest_compras(id) on delete cascade,
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  produto_id uuid references rest_produtos(id) on delete set null,
  solicitacao_item_id uuid references rest_solicitacao_itens(id) on delete set null,
  descricao_original text,
  quantidade numeric(14,3), unidade text, peso_kg numeric(14,3),
  valor_unitario numeric(14,4), valor_total numeric(14,2) not null,
  qtd_recebida numeric(14,3),
  celula text
);
create index if not exists rest_compra_itens_c on rest_compra_itens(compra_id);
create index if not exists rest_compra_itens_p on rest_compra_itens(produto_id);

-- ============ estoque ============
create table if not exists rest_estoque_movs (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  produto_id uuid not null references rest_produtos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','consumo','producao','perda','descarte','transferencia','ajuste','inventario')),
  quantidade numeric(14,3) not null,           -- com sinal: entrada +, saídas −, ajuste/inventário ±
  saldo_apos numeric(14,3),
  validade date, lote text,
  compra_id uuid references rest_compras(id) on delete set null,
  compra_item_id uuid references rest_compra_itens(id) on delete set null,
  motivo text,
  feito_por uuid default rest_meu_funcionario() references rest_funcionarios(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists rest_movs_prod on rest_estoque_movs(produto_id, criado_em);

create or replace function rest_aplicar_mov() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update rest_produtos set estoque_atual = estoque_atual + new.quantidade where id = new.produto_id
    returning estoque_atual into new.saldo_apos;
  return new;
end $$;
create trigger rest_mov_aplica before insert on rest_estoque_movs for each row execute function rest_aplicar_mov();

-- ============ caixa (fechamento) e vendas ============
create table if not exists rest_fechamentos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  data date not null default current_date,
  turno text not null default 'dia' check (turno in ('manha','tarde','noite','dia')),
  operador_id uuid not null default rest_meu_funcionario() references rest_funcionarios(id),
  fundo_troco numeric(14,2) not null default 0,
  dinheiro numeric(14,2) not null default 0 check (dinheiro >= 0),
  debito numeric(14,2) not null default 0 check (debito >= 0),
  credito numeric(14,2) not null default 0 check (credito >= 0),
  pix numeric(14,2) not null default 0 check (pix >= 0),
  vale_alimentacao numeric(14,2) not null default 0 check (vale_alimentacao >= 0),
  vale_refeicao numeric(14,2) not null default 0 check (vale_refeicao >= 0),
  outros numeric(14,2) not null default 0 check (outros >= 0), outros_desc text,
  num_vendas int check (num_vendas >= 0),
  sangrias numeric(14,2) not null default 0, reforcos numeric(14,2) not null default 0,
  cancelamentos numeric(14,2) not null default 0, estornos numeric(14,2) not null default 0, descontos numeric(14,2) not null default 0,
  dinheiro_contado numeric(14,2),               -- dinheiro na gaveta no fim do turno
  valor_sistema numeric(14,2),                  -- total registrado no sistema/PDV, se houver
  total numeric(14,2) generated always as (dinheiro + debito + credito + pix + vale_alimentacao + vale_refeicao + outros) stored,
  obs text, justificativa text,
  status text not null default 'aberto' check (status in ('aberto','encerrado','devolvido','conferido')),
  encerrado_em timestamptz, conferido_por uuid references rest_funcionarios(id), conferido_em timestamptz, obs_conferencia text,
  criado_em timestamptz not null default now(),
  unique (restaurante_id, data, turno, operador_id)
);

create table if not exists rest_vendas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  data date not null, turno text not null default 'dia',
  bruto numeric(14,2) not null default 0, descontos numeric(14,2) not null default 0,
  cancelamentos numeric(14,2) not null default 0, estornos numeric(14,2) not null default 0,
  liquido numeric(14,2) generated always as (bruto - descontos - cancelamentos - estornos) stored,
  qtd_vendas int,
  dinheiro numeric(14,2) not null default 0, debito numeric(14,2) not null default 0, credito numeric(14,2) not null default 0,
  pix numeric(14,2) not null default 0, vale_alimentacao numeric(14,2) not null default 0, vale_refeicao numeric(14,2) not null default 0, outros numeric(14,2) not null default 0,
  origem text not null default 'manual' check (origem in ('fechamento','pdv','manual')),
  fechamento_id uuid unique references rest_fechamentos(id) on delete cascade,
  conferida boolean not null default false,
  assinatura text, obs text,
  criado_em timestamptz not null default now(),
  unique (restaurante_id, assinatura)
);
create index if not exists rest_vendas_data on rest_vendas(restaurante_id, data);

-- ============ financeiro ============
create table if not exists rest_contas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  tipo text not null check (tipo in ('pagar','receber')),
  descricao text not null, categoria text not null,
  fornecedor_id uuid references rest_fornecedores(id) on delete set null,
  compra_id uuid references rest_compras(id) on delete cascade,
  nota_numero text, emissao date,
  vencimento date not null,
  valor numeric(14,2) not null check (valor > 0),
  parcela_num int not null default 1, parcela_total int not null default 1,
  grupo_id uuid,
  status text not null default 'pendente' check (status in ('pendente','pago','cancelado')),
  pago_em date, forma_pagamento text, comprovante_path text,
  origem text not null default 'manual' check (origem in ('manual','compra','planilha','ia','venda')),
  obs text,
  criado_por uuid default rest_meu_funcionario() references rest_funcionarios(id) on delete set null,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  unique (compra_id, parcela_num)                 -- uma compra/nota nunca gera conta duplicada
);
create index if not exists rest_contas_venc on rest_contas(restaurante_id, status, vencimento);

-- ============ auditoria, conversa com a IA ============
create table if not exists rest_auditoria (
  id bigint generated always as identity primary key,
  restaurante_id uuid,
  tabela text not null, registro_id uuid, acao text not null,
  antes jsonb, depois jsonb,
  usuario uuid default auth.uid(), funcionario_id uuid default rest_meu_funcionario(),
  em timestamptz not null default now()
);
create index if not exists rest_auditoria_rest on rest_auditoria(restaurante_id, em desc);

create table if not exists rest_chat (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  papel text not null check (papel in ('user','assistant')),
  texto text not null, ferramentas jsonb,
  criado_em timestamptz not null default now()
);

create or replace function rest_auditar() returns trigger language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_rest := case when tg_table_name = 'rest_restaurantes' then old.id else (to_jsonb(old)->>'restaurante_id')::uuid end; v_id := old.id;
  else
    v_rest := case when tg_table_name = 'rest_restaurantes' then new.id else (to_jsonb(new)->>'restaurante_id')::uuid end; v_id := new.id;
  end if;
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then return new; end if;
  insert into rest_auditoria(restaurante_id, tabela, registro_id, acao, antes, depois)
  values (v_rest, tg_table_name, v_id, lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['rest_restaurantes','rest_funcionarios','rest_fornecedores','rest_produtos','rest_compras','rest_notas','rest_fechamentos','rest_vendas','rest_contas','rest_estoque_movs','rest_solicitacoes'] loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function rest_auditar()', t, t);
  end loop;
end $$;

-- ============ regras de negócio nos dados ============
-- Fechamento encerrado/conferido não muda sem o administrador (e tudo fica na auditoria).
create or replace function rest_guarda_fechamento() returns trigger language plpgsql security definer set search_path = public as $$
declare v_admin boolean := rest_pode('admin');
begin
  if tg_op = 'DELETE' then
    if not v_admin then raise exception 'FECHAMENTO_BLOQUEADO: só o administrador pode excluir um fechamento'; end if;
    return old;
  end if;
  if not v_admin then
    if old.status in ('encerrado','conferido') then
      raise exception 'FECHAMENTO_ENCERRADO: este caixa já foi encerrado. Peça ao administrador para devolver se precisar corrigir.';
    end if;
    if new.status = 'conferido' then raise exception 'FECHAMENTO_BLOQUEADO: só o administrador confere o caixa'; end if;
    if new.operador_id <> old.operador_id then raise exception 'FECHAMENTO_BLOQUEADO: não é possível trocar o operador'; end if;
  end if;
  if new.status = 'encerrado' and old.status <> 'encerrado' then new.encerrado_em := now(); end if;
  if new.status = 'conferido' and old.status <> 'conferido' then new.conferido_em := now(); new.conferido_por := rest_meu_funcionario(); end if;
  return new;
end $$;
create trigger rest_fech_guarda before update or delete on rest_fechamentos for each row execute function rest_guarda_fechamento();

-- Caixa encerrado vira registro de vendas do dia (faturamento = recebido − estornos; bruto inclui descontos e cancelamentos).
create or replace function rest_fechamento_para_venda() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('encerrado','conferido') then
    insert into rest_vendas(restaurante_id, data, turno, bruto, descontos, cancelamentos, estornos, qtd_vendas, dinheiro, debito, credito, pix, vale_alimentacao, vale_refeicao, outros, origem, fechamento_id, conferida)
    values (new.restaurante_id, new.data, new.turno, new.total + new.descontos + new.cancelamentos, new.descontos, new.cancelamentos, new.estornos, new.num_vendas,
            new.dinheiro, new.debito, new.credito, new.pix, new.vale_alimentacao, new.vale_refeicao, new.outros, 'fechamento', new.id, new.status = 'conferido')
    on conflict (fechamento_id) do update set data = excluded.data, turno = excluded.turno, bruto = excluded.bruto, descontos = excluded.descontos,
      cancelamentos = excluded.cancelamentos, estornos = excluded.estornos, qtd_vendas = excluded.qtd_vendas, dinheiro = excluded.dinheiro, debito = excluded.debito,
      credito = excluded.credito, pix = excluded.pix, vale_alimentacao = excluded.vale_alimentacao, vale_refeicao = excluded.vale_refeicao, outros = excluded.outros, conferida = excluded.conferida;
  elsif new.status = 'devolvido' then
    delete from rest_vendas where fechamento_id = new.id;
  end if;
  return new;
end $$;
create trigger rest_fech_venda after insert or update on rest_fechamentos for each row execute function rest_fechamento_para_venda();

create or replace function rest_tocar() returns trigger language plpgsql set search_path = public as $$ begin new.atualizado_em := now(); return new; end $$;
create trigger rest_contas_tocar before update on rest_contas for each row execute function rest_tocar();
create trigger rest_solic_tocar before update on rest_solicitacoes for each row execute function rest_tocar();

-- ============ RLS ============
do $$ declare t text; begin
  foreach t in array array['rest_restaurantes','rest_funcionarios','rest_pins','rest_fornecedores','rest_produtos','rest_solicitacoes','rest_solicitacao_itens','rest_notas','rest_importacoes','rest_compras','rest_compra_itens','rest_estoque_movs','rest_fechamentos','rest_vendas','rest_contas','rest_auditoria','rest_chat'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create policy r_sel on rest_restaurantes for select using (id = rest_meu_restaurante());
create policy r_upd on rest_restaurantes for update using (id = rest_meu_restaurante() and rest_pode('admin')) with check (id = rest_meu_restaurante());

-- equipe: todos veem os nomes da equipe (para mostrar quem pediu); alterações só pelo servidor
create policy f_sel on rest_funcionarios for select using (restaurante_id = rest_meu_restaurante());

create policy p_sel on rest_produtos for select using (restaurante_id = rest_meu_restaurante());
create policy p_ins on rest_produtos for insert with check (restaurante_id = rest_meu_restaurante() and (status = 'pendente' or rest_pode('compras') or rest_pode('estoque')));
create policy p_upd on rest_produtos for update using (restaurante_id = rest_meu_restaurante() and (rest_pode('compras') or rest_pode('estoque'))) with check (restaurante_id = rest_meu_restaurante());
create policy p_del on rest_produtos for delete using (restaurante_id = rest_meu_restaurante() and rest_pode('compras'));

create policy fo_sel on rest_fornecedores for select using (restaurante_id = rest_meu_restaurante() and (rest_pode('compras') or rest_pode('estoque')));
create policy fo_all on rest_fornecedores for all using (restaurante_id = rest_meu_restaurante() and rest_pode('compras')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('compras'));

create policy s_sel on rest_solicitacoes for select using (restaurante_id = rest_meu_restaurante() and (solicitante_id = rest_meu_funcionario() or rest_pode('compras')));
create policy s_ins on rest_solicitacoes for insert with check (restaurante_id = rest_meu_restaurante() and solicitante_id = rest_meu_funcionario() and status in ('em_elaboracao','enviada'));
create policy s_upd on rest_solicitacoes for update
  using (restaurante_id = rest_meu_restaurante() and (rest_pode('compras') or (solicitante_id = rest_meu_funcionario() and status in ('em_elaboracao','enviada'))))
  with check (restaurante_id = rest_meu_restaurante() and (rest_pode('compras') or (solicitante_id = rest_meu_funcionario() and status in ('em_elaboracao','enviada','cancelada'))));
create policy s_del on rest_solicitacoes for delete using (restaurante_id = rest_meu_restaurante() and solicitante_id = rest_meu_funcionario() and status = 'em_elaboracao');

create policy si_sel on rest_solicitacao_itens for select using (exists (select 1 from rest_solicitacoes s where s.id = solicitacao_id));
create policy si_all on rest_solicitacao_itens for all
  using (exists (select 1 from rest_solicitacoes s where s.id = solicitacao_id and (rest_pode('compras') or (s.solicitante_id = rest_meu_funcionario() and s.status in ('em_elaboracao','enviada')))))
  with check (restaurante_id = rest_meu_restaurante() and exists (select 1 from rest_solicitacoes s where s.id = solicitacao_id and (rest_pode('compras') or (s.solicitante_id = rest_meu_funcionario() and s.status in ('em_elaboracao','enviada')))));

create policy n_all on rest_notas for all using (restaurante_id = rest_meu_restaurante() and rest_pode('compras')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('compras'));
create policy i_all on rest_importacoes for all using (restaurante_id = rest_meu_restaurante() and rest_pode('admin')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));

create policy c_sel on rest_compras for select using (restaurante_id = rest_meu_restaurante() and (rest_pode('compras') or rest_pode('estoque')));
create policy c_all on rest_compras for all using (restaurante_id = rest_meu_restaurante() and rest_pode('compras')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('compras'));
create policy ci_sel on rest_compra_itens for select using (restaurante_id = rest_meu_restaurante() and (rest_pode('compras') or rest_pode('estoque')));
create policy ci_all on rest_compra_itens for all using (restaurante_id = rest_meu_restaurante() and rest_pode('compras')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('compras'));

-- estoque: movimentos não se apagam nem se editam (correção = novo ajuste)
create policy e_sel on rest_estoque_movs for select using (restaurante_id = rest_meu_restaurante() and (rest_pode('estoque') or rest_pode('compras')));
create policy e_ins on rest_estoque_movs for insert with check (restaurante_id = rest_meu_restaurante() and (rest_pode('estoque') or rest_pode('compras')));

create policy fe_sel on rest_fechamentos for select using (restaurante_id = rest_meu_restaurante() and (operador_id = rest_meu_funcionario() or rest_pode('admin')));
create policy fe_ins on rest_fechamentos for insert with check (restaurante_id = rest_meu_restaurante() and rest_pode('caixa') and (operador_id = rest_meu_funcionario() or rest_pode('admin')) and status in ('aberto','encerrado'));
create policy fe_upd on rest_fechamentos for update using (restaurante_id = rest_meu_restaurante() and (operador_id = rest_meu_funcionario() or rest_pode('admin'))) with check (restaurante_id = rest_meu_restaurante());
create policy fe_del on rest_fechamentos for delete using (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));

create policy v_all on rest_vendas for all using (restaurante_id = rest_meu_restaurante() and rest_pode('admin')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
create policy ct_all on rest_contas for all using (restaurante_id = rest_meu_restaurante() and rest_pode('admin')) with check (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
create policy a_sel on rest_auditoria for select using (restaurante_id = rest_meu_restaurante() and rest_pode('admin'));
create policy ch_all on rest_chat for all using (user_id = auth.uid() and restaurante_id = rest_meu_restaurante()) with check (user_id = auth.uid() and restaurante_id = rest_meu_restaurante());

-- visão de itens comprados (para relatórios e IA); respeita o RLS de quem consulta
create or replace view rest_v_itens with (security_invoker = true) as
  select i.id, i.compra_id, c.numero as compra_numero, c.data, c.origem, c.status as compra_status,
         c.fornecedor_id, f.nome as fornecedor, i.produto_id, coalesce(p.nome, i.descricao_original) as produto,
         coalesce(p.categoria, 'outros') as categoria, i.descricao_original, i.quantidade, i.unidade, i.peso_kg,
         i.valor_unitario, i.valor_total, i.qtd_recebida, c.restaurante_id
  from rest_compra_itens i join rest_compras c on c.id = i.compra_id
  left join rest_produtos p on p.id = i.produto_id left join rest_fornecedores f on f.id = c.fornecedor_id
  where c.status <> 'cancelada';
