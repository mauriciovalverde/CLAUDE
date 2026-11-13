-- Despesas pagas com o dinheiro da gaveta (sangrias), uma a uma: transporte, táxi, vale ou outros, para quem (funcionário ou nome digitado).
-- O total delas é a "sangria" do caixa. Quando o caixa é fechado, cada despesa vira uma conta PAGA no Financeiro (sai do saldo),
-- e se o caixa for devolvido para correção essas contas são canceladas (nada é apagado).
create table if not exists rest_caixa_despesas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null default rest_meu_restaurante() references rest_restaurantes(id) on delete cascade,
  fechamento_id uuid not null references rest_fechamentos(id) on delete cascade,
  tipo text not null check (tipo in ('transporte','taxi','vale','outros')),
  funcionario_id uuid references rest_funcionarios(id) on delete set null,
  pessoa text,                                  -- nome digitado (quando não é da equipe)
  descricao text,
  valor numeric(14,2) not null check (valor > 0),
  criado_por uuid default rest_meu_funcionario() references rest_funcionarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  check (funcionario_id is not null or coalesce(trim(pessoa), '') <> ''),
  check (tipo <> 'outros' or coalesce(trim(descricao), '') <> '')
);
create index if not exists rest_caixa_desp_fech on rest_caixa_despesas(fechamento_id);
alter table rest_caixa_despesas enable row level security;
-- vê quem vê o caixa (o operador dono dele e o administrador); muda só enquanto o caixa está aberto ou devolvido (admin sempre)
create policy cxd_sel on rest_caixa_despesas for select using (restaurante_id = rest_meu_restaurante() and exists (select 1 from rest_fechamentos f where f.id = fechamento_id));
create policy cxd_mod on rest_caixa_despesas for all
  using (restaurante_id = rest_meu_restaurante() and exists (select 1 from rest_fechamentos f where f.id = fechamento_id and (f.status in ('aberto','devolvido') or rest_pode('admin'))))
  with check (restaurante_id = rest_meu_restaurante() and exists (select 1 from rest_fechamentos f where f.id = fechamento_id and (f.status in ('aberto','devolvido') or rest_pode('admin'))));
create trigger rest_caixa_despesas_audit after insert or update or delete on rest_caixa_despesas for each row execute function rest_auditar();


-- contas geradas pelo caixa
alter table rest_contas add column if not exists fechamento_id uuid references rest_fechamentos(id) on delete cascade;
alter table rest_contas drop constraint if exists rest_contas_origem_check;
alter table rest_contas add constraint rest_contas_origem_check check (origem in ('manual','compra','planilha','ia','venda','caixa'));

create or replace function rest_caixa_categoria(p_tipo text) returns text language sql immutable set search_path = public as $$
  select case p_tipo when 'transporte' then 'Caixa: Transporte' when 'taxi' then 'Caixa: Táxi' when 'vale' then 'Vale a funcionário' else 'Caixa: Outras despesas' end
$$;

-- gera as contas pagas do caixa fechado (uma por despesa; sem detalhe, uma com o total da sangria)
create or replace function rest_caixa_gerar_contas(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare f rest_fechamentos;
begin
  select * into f from rest_fechamentos where id = p_id;
  update rest_contas set status = 'cancelado' where fechamento_id = p_id and status = 'pago';
  if f.status not in ('encerrado','conferido') then return; end if;
  if exists (select 1 from rest_caixa_despesas where fechamento_id = p_id) then
    insert into rest_contas(restaurante_id, tipo, descricao, categoria, vencimento, valor, status, pago_em, forma_pagamento, origem, fechamento_id, emissao)
    select f.restaurante_id, 'pagar',
           initcap(case d.tipo when 'taxi' then 'táxi' else d.tipo end) || ' · ' || coalesce(fu.nome, d.pessoa) || coalesce(' · ' || nullif(trim(d.descricao), ''), '') || ' (caixa de ' || to_char(f.data, 'DD/MM') || ')',
           rest_caixa_categoria(d.tipo), f.data, d.valor, 'pago', f.data, 'Dinheiro (caixa)', 'caixa', f.id, f.data
      from rest_caixa_despesas d left join rest_funcionarios fu on fu.id = d.funcionario_id where d.fechamento_id = p_id;
  elsif f.sangrias > 0 then
    insert into rest_contas(restaurante_id, tipo, descricao, categoria, vencimento, valor, status, pago_em, forma_pagamento, origem, fechamento_id, emissao)
    values (f.restaurante_id, 'pagar', 'Despesas pagas com o caixa de ' || to_char(f.data, 'DD/MM'), 'Caixa: Outras despesas', f.data, f.sangrias, 'pago', f.data, 'Dinheiro (caixa)', 'caixa', f.id, f.data);
  end if;
end $$;

create or replace function rest_caixa_lancar_despesas() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.status in ('encerrado','conferido')) is distinct from (tg_op = 'UPDATE' and old.status in ('encerrado','conferido')) then
    perform rest_caixa_gerar_contas(new.id);   -- fechou: lança; voltou para aberto/devolvido: cancela
  end if;
  return new;
end $$;

-- a sangria do caixa é sempre a soma das despesas; se o caixa já está fechado (correção do administrador), o Financeiro acompanha
create or replace function rest_caixa_somar_despesas() returns trigger language plpgsql security definer set search_path = public as $$
declare v_f uuid := coalesce(new.fechamento_id, old.fechamento_id);
begin
  update rest_fechamentos set sangrias = coalesce((select sum(valor) from rest_caixa_despesas where fechamento_id = v_f), 0) where id = v_f;
  if exists (select 1 from rest_fechamentos where id = v_f and status in ('encerrado','conferido')) then perform rest_caixa_gerar_contas(v_f); end if;
  return coalesce(new, old);
end $$;
create trigger rest_caixa_despesas_soma after insert or update or delete on rest_caixa_despesas for each row execute function rest_caixa_somar_despesas();
create trigger rest_fech_despesas after insert or update of status on rest_fechamentos for each row execute function rest_caixa_lancar_despesas();
revoke execute on function rest_caixa_somar_despesas(), rest_caixa_lancar_despesas(), rest_caixa_gerar_contas(uuid) from public, anon, authenticated;

-- o que cada funcionário recebeu pelo caixa (vale/adiantamento, transporte, outros) no período: para o fechamento mensal dele.
-- p_func nulo = todos (só administração); o funcionário vê só o próprio.
create or replace function rest_func_recebimentos(p_func uuid, p_de date, p_ate date)
returns table(funcionario_id uuid, data date, tipo text, descricao text, valor numeric, caixa_status text)
language sql stable security definer set search_path = public as $$
  select d.funcionario_id, f.data, d.tipo, d.descricao, d.valor, f.status
    from rest_caixa_despesas d join rest_fechamentos f on f.id = d.fechamento_id
   where d.restaurante_id = rest_meu_restaurante() and d.funcionario_id is not null
     and f.data between p_de and p_ate
     and ((p_func is null and rest_pode('admin')) or (p_func is not null and d.funcionario_id = p_func and (p_func = rest_meu_funcionario() or rest_pode('admin'))))
   order by f.data, d.criado_em
$$;
revoke execute on function rest_func_recebimentos(uuid, date, date) from public, anon;
grant execute on function rest_func_recebimentos(uuid, date, date) to authenticated;
