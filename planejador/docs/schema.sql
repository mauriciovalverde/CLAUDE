-- Planejador Financeiro: contas a pagar/receber, faturas de cartão e sonhos (tabelas próprias, separadas do Gestor)
create table if not exists plan_config (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  nome text, saldo_atual numeric(14,2) not null default 0, ia_modelo text,
  atualizado_em timestamptz not null default now()
);
create table if not exists plan_faturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  cartao text not null, vencimento date not null, total numeric(14,2) not null, arquivo_nome text,
  criado_em timestamptz not null default now(), unique (user_id, cartao, vencimento)
);
create table if not exists plan_contas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tipo text not null check (tipo in ('pagar','receber')),
  descricao text not null, categoria text not null default 'Outros',
  valor numeric(14,2) not null check (valor > 0), vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente','pago')), pago_em date,
  grupo_id uuid, parcela_num int, parcela_total int,
  origem text not null default 'manual' check (origem in ('manual','fatura','fatura_parcela','sonho')),
  fatura_id uuid references plan_faturas on delete cascade, cartao text,
  criado_em timestamptz not null default now(), excluido_em timestamptz
);
create index if not exists plan_contas_venc on plan_contas(user_id, vencimento) where excluido_em is null;
create table if not exists plan_fatura_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fatura_id uuid not null references plan_faturas on delete cascade,
  data text, descricao text not null, valor numeric(14,2) not null,
  parcela_num int, parcela_total int, categoria text not null default 'Outros'
);
create table if not exists plan_sonhos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null, emoji text not null default '⭐', valor_alvo numeric(14,2) not null check (valor_alvo > 0),
  data_alvo date, incluir_na_projecao boolean not null default true, concluido boolean not null default false,
  criado_em timestamptz not null default now(), excluido_em timestamptz
);
create table if not exists plan_sonho_movs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  sonho_id uuid not null references plan_sonhos on delete cascade,
  data date not null default current_date, valor numeric(14,2) not null check (valor <> 0),
  forma text not null default 'Poupança', obs text, criado_em timestamptz not null default now()
);
alter table plan_config enable row level security;
alter table plan_faturas enable row level security;
alter table plan_contas enable row level security;
alter table plan_fatura_itens enable row level security;
alter table plan_sonhos enable row level security;
alter table plan_sonho_movs enable row level security;
create policy plan_config_dono on plan_config for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy plan_faturas_dono on plan_faturas for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy plan_contas_dono on plan_contas for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy plan_fatura_itens_dono on plan_fatura_itens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy plan_sonhos_dono on plan_sonhos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy plan_sonho_movs_dono on plan_sonho_movs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on plan_config, plan_faturas, plan_contas, plan_fatura_itens, plan_sonhos, plan_sonho_movs to authenticated;
