-- RESTAURANTE INTELIGENTE — operações atômicas (tudo ou nada). Cada função confere o papel de quem chama.

-- Busca ou cria fornecedor pela chave padronizada
create or replace function rest_fornecedor_id(p_rest uuid, p_nome text, p_chave text, p_cnpj text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if p_rest is distinct from rest_meu_restaurante() or not rest_pode('compras') then raise exception 'SEM_PERMISSAO'; end if;
  if nullif(trim(coalesce(p_nome, '')), '') is null then return null; end if;
  if nullif(p_cnpj, '') is not null then
    select id into v from rest_fornecedores where restaurante_id = p_rest and cnpj = p_cnpj;
    if v is not null then return v; end if;
  end if;
  select id into v from rest_fornecedores where restaurante_id = p_rest and chave = p_chave;
  if v is null then
    insert into rest_fornecedores(restaurante_id, nome, chave, cnpj, grafias) values (p_rest, trim(p_nome), p_chave, nullif(p_cnpj, ''), array[trim(p_nome)])
    on conflict (restaurante_id, chave) do update set nome = rest_fornecedores.nome returning id into v;
  elsif nullif(p_cnpj, '') is not null then
    update rest_fornecedores set cnpj = coalesce(cnpj, p_cnpj) where id = v;
  end if;
  return v;
end $$;

-- Busca ou cria produto pela chave padronizada (guarda a grafia original)
create or replace function rest_produto_id(p_rest uuid, p_nome text, p_chave text, p_categoria text, p_unidade text, p_grafia text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if p_rest is distinct from rest_meu_restaurante() or not rest_pode('compras') then raise exception 'SEM_PERMISSAO'; end if;
  select id into v from rest_produtos where restaurante_id = p_rest and chave = p_chave;
  if v is null then
    insert into rest_produtos(restaurante_id, nome, chave, categoria, unidade, grafias, status)
    values (p_rest, p_nome, p_chave, coalesce(nullif(p_categoria, ''), 'outros'), coalesce(nullif(p_unidade, ''), 'un'), case when p_grafia is null then '{}' else array[p_grafia] end, 'ativo')
    on conflict (restaurante_id, chave) do update set nome = rest_produtos.nome returning id into v;
  elsif p_grafia is not null then
    update rest_produtos set grafias = array_append(grafias, p_grafia) where id = v and not (p_grafia = any(grafias));
  end if;
  return v;
end $$;

-- Registra uma compra REALIZADA: itens, conta(s) a pagar (sem duplicar), vínculo com solicitação e nota, e (opcional) entrada no estoque.
-- p: { data, fornecedor_id | fornecedor_nome+fornecedor_chave(+cnpj), itens:[{produto_id | nome+chave+categoria+unidade, descricao_original,
--      quantidade, unidade, peso_kg, valor_unitario, valor_total, solicitacao_item_id, celula}], desconto, forma_pagamento, pago(bool),
--      vencimento, parcelas, solicitacao_id, nota_id, origem, obs, assinatura, recebida(bool), importacao_id, data_estimada, nota_numero }
create or replace function rest_registrar_compra(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rest uuid := rest_meu_restaurante();
  v_func uuid := rest_meu_funcionario();
  v_forn uuid; v_compra uuid; v_num bigint; v_sub numeric := 0; v_total numeric; v_desc numeric := coalesce((p->>'desconto')::numeric, 0);
  v_item jsonb; v_prod uuid; v_parc int := greatest(1, least(24, coalesce((p->>'parcelas')::int, 1)));
  v_pago boolean := coalesce((p->>'pago')::boolean, false);
  v_data date := (p->>'data')::date; v_venc date; v_base numeric; v_val numeric; v_contas uuid[] := '{}'; v_c uuid; k int;
  v_forn_nome text; v_nota rest_notas; v_cat text;
begin
  if v_rest is null or not rest_pode('compras') then raise exception 'SEM_PERMISSAO: só o responsável pelas compras registra compras'; end if;
  if v_data is null then raise exception 'DADOS_INVALIDOS: informe a data da compra'; end if;
  if jsonb_array_length(coalesce(p->'itens', '[]')) = 0 then raise exception 'DADOS_INVALIDOS: a compra precisa de pelo menos um item'; end if;
  if nullif(p->>'assinatura', '') is not null then
    select id, numero into v_compra, v_num from rest_compras where restaurante_id = v_rest and assinatura = p->>'assinatura';
    if v_compra is not null then return jsonb_build_object('ok', true, 'duplicada', true, 'compra_id', v_compra, 'numero', v_num); end if;
  end if;
  if nullif(p->>'nota_id', '') is not null then
    select * into v_nota from rest_notas where id = (p->>'nota_id')::uuid and restaurante_id = v_rest;
    if v_nota.id is null then raise exception 'DADOS_INVALIDOS: nota fiscal não encontrada'; end if;
    if v_nota.compra_id is not null then raise exception 'NOTA_JA_VINCULADA: esta nota já está ligada à compra de %', to_char(v_nota.data_emissao, 'DD/MM/YYYY'); end if;
  end if;

  v_forn := coalesce(nullif(p->>'fornecedor_id', '')::uuid, rest_fornecedor_id(v_rest, p->>'fornecedor_nome', coalesce(p->>'fornecedor_chave', upper(regexp_replace(p->>'fornecedor_nome', '[^A-Za-z0-9]', '', 'g'))), p->>'cnpj'));
  select nome into v_forn_nome from rest_fornecedores where id = v_forn;

  for v_item in select * from jsonb_array_elements(p->'itens') loop
    v_sub := v_sub + coalesce((v_item->>'valor_total')::numeric, 0);
  end loop;
  v_total := round(v_sub - v_desc, 2);
  if v_total <= 0 then raise exception 'DADOS_INVALIDOS: o total da compra precisa ser maior que zero'; end if;

  insert into rest_compras(restaurante_id, data, fornecedor_id, solicitacao_id, nota_id, forma_pagamento, vencimento, pago_na_compra, parcelas, subtotal, desconto, total,
                           responsavel_id, origem, status, obs, assinatura, importacao_id, data_estimada)
  values (v_rest, v_data, v_forn, nullif(p->>'solicitacao_id', '')::uuid, nullif(p->>'nota_id', '')::uuid, nullif(p->>'forma_pagamento', ''), nullif(p->>'vencimento', '')::date, v_pago, v_parc,
          round(v_sub, 2), v_desc, v_total, v_func, coalesce(nullif(p->>'origem', ''), 'manual'), 'comprada', nullif(p->>'obs', ''), nullif(p->>'assinatura', ''),
          nullif(p->>'importacao_id', '')::uuid, coalesce((p->>'data_estimada')::boolean, false))
  returning id, numero into v_compra, v_num;

  for v_item in select * from jsonb_array_elements(p->'itens') loop
    v_prod := nullif(v_item->>'produto_id', '')::uuid;
    if v_prod is null and nullif(v_item->>'chave', '') is not null then
      v_prod := rest_produto_id(v_rest, coalesce(v_item->>'nome', v_item->>'descricao_original'), v_item->>'chave', v_item->>'categoria', v_item->>'unidade', v_item->>'descricao_original');
    end if;
    insert into rest_compra_itens(compra_id, restaurante_id, produto_id, solicitacao_item_id, descricao_original, quantidade, unidade, peso_kg, valor_unitario, valor_total, celula)
    values (v_compra, v_rest, v_prod, nullif(v_item->>'solicitacao_item_id', '')::uuid, v_item->>'descricao_original', nullif(v_item->>'quantidade', '')::numeric, nullif(v_item->>'unidade', ''),
            nullif(v_item->>'peso_kg', '')::numeric, nullif(v_item->>'valor_unitario', '')::numeric, round((v_item->>'valor_total')::numeric, 2), v_item->>'celula');
  end loop;

  -- categoria financeira: a categoria de produto com maior valor na compra
  select coalesce(p2.categoria, 'outros') into v_cat from rest_compra_itens i left join rest_produtos p2 on p2.id = i.produto_id
   where i.compra_id = v_compra group by 1 order by sum(i.valor_total) desc limit 1;
  v_cat := 'Compras: ' || case v_cat when 'hortalicas' then 'Hortaliças' when 'frutas' then 'Frutas' when 'acougue' then 'Carnes' when 'aves' then 'Aves' when 'peixes' then 'Peixes'
    when 'cereais' then 'Cereais e grãos' when 'mercearia' then 'Mercearia' when 'laticinios' then 'Laticínios e frios' when 'bebidas' then 'Bebidas' when 'padaria' then 'Padaria'
    when 'embalagens' then 'Embalagens' when 'limpeza' then 'Limpeza' else 'Outros' end;

  -- contas a pagar (uma compra/nota gera no máximo uma série de parcelas: unique(compra_id, parcela_num))
  v_base := floor(v_total / v_parc * 100) / 100;
  for k in 1..v_parc loop
    v_val := case when k = v_parc then v_total - v_base * (v_parc - 1) else v_base end;
    v_venc := case when v_pago then v_data else (coalesce(nullif(p->>'vencimento', '')::date, v_data) + make_interval(months => k - 1))::date end;
    insert into rest_contas(restaurante_id, tipo, descricao, categoria, fornecedor_id, compra_id, nota_numero, emissao, vencimento, valor, parcela_num, parcela_total,
                            status, pago_em, forma_pagamento, origem, criado_por)
    values (v_rest, 'pagar', 'Compra #' || v_num || coalesce(' · ' || v_forn_nome, '') || case when v_parc > 1 then ' (' || k || '/' || v_parc || ')' else '' end,
            v_cat, v_forn, v_compra, coalesce(nullif(p->>'nota_numero', ''), v_nota.numero), v_data, v_venc, v_val, k, v_parc,
            case when v_pago then 'pago' else 'pendente' end, case when v_pago then v_data end, nullif(p->>'forma_pagamento', ''),
            case when p->>'origem' = 'planilha' then 'planilha' else 'compra' end, v_func)
    returning id into v_c;
    v_contas := v_contas || v_c;
  end loop;

  if v_nota.id is not null then
    update rest_notas set compra_id = v_compra, status = 'conferida', conferida_por = v_func, conferida_em = now(), fornecedor_id = coalesce(fornecedor_id, v_forn) where id = v_nota.id;
  end if;
  if nullif(p->>'solicitacao_id', '') is not null then
    update rest_solicitacoes s set status = case when exists (
        select 1 from rest_solicitacao_itens si where si.solicitacao_id = s.id and not si.removido
          and not exists (select 1 from rest_compra_itens ci join rest_compras cc on cc.id = ci.compra_id where ci.solicitacao_item_id = si.id and cc.status <> 'cancelada'))
      then 'parcial' else 'comprada' end
    where s.id = (p->>'solicitacao_id')::uuid and s.restaurante_id = v_rest;
  end if;
  if coalesce((p->>'recebida')::boolean, false) then perform rest_receber_compra(v_compra, null); end if;
  return jsonb_build_object('ok', true, 'compra_id', v_compra, 'numero', v_num, 'total', v_total, 'conta_ids', to_jsonb(v_contas), 'fornecedor', v_forn_nome);
end $$;

-- Recebimento: registra o que CHEGOU (pode ser menos que o comprado) e dá entrada no estoque.
-- p_itens: [{ item_id, qtd_recebida, validade, lote }]; null = recebeu tudo como comprado.
create or replace function rest_receber_compra(p_compra uuid, p_itens jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_rest uuid := rest_meu_restaurante(); c rest_compras; i record; v_q numeric; v_e jsonb; v_falta boolean := false; v_n int := 0;
begin
  if v_rest is null or not (rest_pode('compras') or rest_pode('estoque')) then raise exception 'SEM_PERMISSAO: sem permissão para receber mercadorias'; end if;
  select * into c from rest_compras where id = p_compra and restaurante_id = v_rest for update;
  if c.id is null then raise exception 'DADOS_INVALIDOS: compra não encontrada'; end if;
  if c.status = 'recebida' then raise exception 'JA_RECEBIDA: esta compra já foi recebida em %', to_char(c.recebido_em at time zone 'America/Bahia', 'DD/MM/YYYY HH24:MI'); end if;
  if c.status = 'cancelada' then raise exception 'DADOS_INVALIDOS: compra cancelada'; end if;
  for i in select ci.*, p.controla_estoque, p.unidade as p_unidade from rest_compra_itens ci left join rest_produtos p on p.id = ci.produto_id where ci.compra_id = p_compra loop
    v_e := null;
    if p_itens is not null then select e into v_e from jsonb_array_elements(p_itens) e where e->>'item_id' = i.id::text; end if;
    v_q := coalesce(nullif(v_e->>'qtd_recebida', '')::numeric, i.quantidade, i.peso_kg);
    if v_q is null then continue; end if;
    if v_q < coalesce(i.quantidade, v_q) then v_falta := true; end if;
    update rest_compra_itens set qtd_recebida = v_q where id = i.id;
    if i.produto_id is not null and coalesce(i.controla_estoque, true) and v_q > 0 then
      insert into rest_estoque_movs(restaurante_id, produto_id, tipo, quantidade, validade, lote, compra_id, compra_item_id, motivo)
      values (v_rest, i.produto_id, 'entrada', v_q, nullif(v_e->>'validade', '')::date, nullif(v_e->>'lote', ''), p_compra, i.id, 'Compra #' || c.numero);
      v_n := v_n + 1;
    end if;
  end loop;
  update rest_compras set status = case when v_falta then 'parcial_recebida' else 'recebida' end, recebido_em = now(), recebido_por = rest_meu_funcionario() where id = p_compra;
  if c.solicitacao_id is not null then update rest_solicitacoes set status = 'recebida' where id = c.solicitacao_id and status in ('comprada','parcial'); end if;
  return jsonb_build_object('ok', true, 'entradas', v_n, 'divergencia', v_falta);
end $$;

-- Importação da planilha: idempotente (assinatura de cada compra). Histórico NÃO mexe no estoque atual.
create or replace function rest_importar_compras(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_rest uuid := rest_meu_restaurante(); v_imp uuid; c jsonb; r jsonb; v_novas int := 0; v_rep int := 0; f jsonb; v_f uuid;
begin
  if v_rest is null or not rest_pode('admin') then raise exception 'SEM_PERMISSAO: só o administrador importa planilhas'; end if;
  insert into rest_importacoes(restaurante_id, arquivo, resumo, avisos) values (v_rest, p->>'arquivo', p->'resumo', p->'avisos') returning id into v_imp;
  -- fornecedores com todas as grafias vistas
  for f in select * from jsonb_array_elements(coalesce(p->'fornecedores', '[]')) loop
    v_f := rest_fornecedor_id(v_rest, f->>'nome', f->>'chave', null);
    update rest_fornecedores set grafias = (select array_agg(distinct g) from unnest(grafias || array(select jsonb_array_elements_text(coalesce(f->'grafias', '[]')))) g),
      obs = coalesce(obs, nullif(f->>'obs', '')) where id = v_f;
  end loop;
  for c in select * from jsonb_array_elements(p->'compras') loop
    r := rest_registrar_compra(c || jsonb_build_object('origem', 'planilha', 'pago', true, 'importacao_id', v_imp, 'recebida', false));
    if coalesce((r->>'duplicada')::boolean, false) then v_rep := v_rep + 1; else v_novas := v_novas + 1; end if;
  end loop;
  update rest_compras set status = 'recebida', recebido_em = (data + time '12:00') at time zone 'America/Bahia' where importacao_id = v_imp;
  update rest_importacoes set compras_novas = v_novas, compras_repetidas = v_rep where id = v_imp;
  return jsonb_build_object('ok', true, 'importacao_id', v_imp, 'novas', v_novas, 'repetidas', v_rep);
end $$;

-- Movimento manual de estoque. quantidade sempre positiva; para inventário é a quantidade CONTADA.
create or replace function rest_movimentar_estoque(p_produto uuid, p_tipo text, p_quantidade numeric, p_motivo text default null, p_validade date default null, p_lote text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_rest uuid := rest_meu_restaurante(); v_atual numeric; v_delta numeric; v_saldo numeric;
begin
  if v_rest is null or not (rest_pode('estoque') or rest_pode('compras')) then raise exception 'SEM_PERMISSAO: sem permissão para mexer no estoque'; end if;
  select estoque_atual into v_atual from rest_produtos where id = p_produto and restaurante_id = v_rest for update;
  if v_atual is null then raise exception 'DADOS_INVALIDOS: produto não encontrado'; end if;
  if p_quantidade is null or p_quantidade < 0 or (p_quantidade = 0 and p_tipo <> 'inventario') then raise exception 'DADOS_INVALIDOS: informe uma quantidade válida'; end if;
  v_delta := case p_tipo when 'entrada' then p_quantidade when 'inventario' then p_quantidade - v_atual when 'ajuste' then p_quantidade - v_atual else -p_quantidade end;
  if p_tipo not in ('entrada','consumo','producao','perda','descarte','transferencia','ajuste','inventario') then raise exception 'DADOS_INVALIDOS: tipo de movimento desconhecido'; end if;
  if p_tipo in ('consumo','producao','perda','descarte','transferencia') and v_atual + v_delta < 0 then
    raise exception 'ESTOQUE_INSUFICIENTE: há % no estoque. Se a contagem real é outra, faça um inventário.', trim(to_char(v_atual, 'FM999999990.###'));
  end if;
  if v_delta = 0 and p_tipo = 'inventario' then
    insert into rest_estoque_movs(restaurante_id, produto_id, tipo, quantidade, motivo) values (v_rest, p_produto, 'inventario', 0, coalesce(p_motivo, 'Inventário: contagem confere'));
  else
    insert into rest_estoque_movs(restaurante_id, produto_id, tipo, quantidade, motivo, validade, lote) values (v_rest, p_produto, p_tipo, v_delta, p_motivo, p_validade, p_lote);
  end if;
  select estoque_atual into v_saldo from rest_produtos where id = p_produto;
  return jsonb_build_object('ok', true, 'saldo', v_saldo, 'diferenca', v_delta);
end $$;

-- Pagamento de conta (total ou parcial: o restante vira nova conta)
create or replace function rest_pagar_conta(p_conta uuid, p_valor numeric, p_data date, p_forma text default null, p_venc_restante date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_rest uuid := rest_meu_restaurante(); c rest_contas; v_novo uuid;
begin
  if v_rest is null or not rest_pode('admin') then raise exception 'SEM_PERMISSAO: só o administrador mexe no financeiro'; end if;
  select * into c from rest_contas where id = p_conta and restaurante_id = v_rest for update;
  if c.id is null then raise exception 'DADOS_INVALIDOS: conta não encontrada'; end if;
  if c.status = 'pago' then raise exception 'JA_PAGA: esta conta já está paga'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'DADOS_INVALIDOS: informe o valor pago'; end if;
  if p_valor > c.valor + 0.005 then raise exception 'VALOR_ACIMA_DO_SALDO: a conta é de R$ %', to_char(c.valor, 'FM999G999G990D00'); end if;
  if p_valor < c.valor - 0.005 then
    insert into rest_contas(restaurante_id, tipo, descricao, categoria, fornecedor_id, nota_numero, emissao, vencimento, valor, grupo_id, origem, obs, criado_por)
    values (v_rest, c.tipo, 'Restante · ' || c.descricao, c.categoria, c.fornecedor_id, c.nota_numero, c.emissao, coalesce(p_venc_restante, (c.vencimento + interval '1 month')::date),
            round(c.valor - p_valor, 2), coalesce(c.grupo_id, c.id), c.origem, 'Restante da conta #' || c.numero, rest_meu_funcionario())
    returning id into v_novo;
    update rest_contas set valor = round(p_valor, 2), obs = concat_ws(' | ', obs, 'Pago parcial: R$ ' || to_char(p_valor, 'FM999G999G990D00') || ' de R$ ' || to_char(c.valor, 'FM999G999G990D00'))
     where id = c.id;
  end if;
  update rest_contas set status = 'pago', pago_em = coalesce(p_data, current_date), forma_pagamento = coalesce(p_forma, forma_pagamento) where id = c.id;
  return jsonb_build_object('ok', true, 'restante_id', v_novo);
end $$;

-- Junta produtos duplicados (ex.: "Feijão Carioca" e "Feijao Carioca"): histórico, estoque e grafias passam para o que fica.
create or replace function rest_mesclar_produtos(p_manter uuid, p_remover uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_rest uuid := rest_meu_restaurante(); v_soma numeric; v_graf text[];
begin
  if v_rest is null or not rest_pode('compras') then raise exception 'SEM_PERMISSAO: sem permissão para juntar produtos'; end if;
  if p_manter = any(p_remover) then raise exception 'DADOS_INVALIDOS: o produto mantido não pode estar na lista para remover'; end if;
  if (select count(*) from rest_produtos where restaurante_id = v_rest and (id = p_manter or id = any(p_remover))) <> 1 + cardinality(p_remover) then
    raise exception 'DADOS_INVALIDOS: produto não encontrado';
  end if;
  select coalesce(sum(estoque_atual), 0), array_agg(g) into v_soma, v_graf from rest_produtos, unnest(grafias || array[nome]) g where id = any(p_remover);
  update rest_compra_itens set produto_id = p_manter where produto_id = any(p_remover);
  update rest_solicitacao_itens set produto_id = p_manter where produto_id = any(p_remover);
  update rest_estoque_movs set produto_id = p_manter where produto_id = any(p_remover);
  update rest_produtos set estoque_atual = estoque_atual + v_soma,
    grafias = (select array_agg(distinct x) from unnest(grafias || coalesce(v_graf, '{}')) x), status = 'ativo' where id = p_manter;
  -- o repetido não é apagado: fica inativo, sem saldo, e aponta no nome para o produto mantido
  update rest_produtos set status = 'inativo', estoque_atual = 0, controla_estoque = false where id = any(p_remover);
  return jsonb_build_object('ok', true, 'removidos', cardinality(p_remover));
end $$;

-- Painel: números do período em uma chamada (respeita permissões: só admin)
create or replace function rest_painel(p_de date, p_ate date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rest uuid := rest_meu_restaurante(); r jsonb; v_hoje date := (now() at time zone 'America/Bahia')::date; v_saldo numeric; v_rest_row rest_restaurantes;
begin
  if v_rest is null or not rest_pode('admin') then raise exception 'SEM_PERMISSAO: só o administrador vê o painel financeiro'; end if;
  select * into v_rest_row from rest_restaurantes where id = v_rest;
  select coalesce(v_rest_row.saldo_inicial, 0)
       + coalesce((select sum(liquido) from rest_vendas where restaurante_id = v_rest and data >= v_rest_row.saldo_em and data <= v_hoje), 0)
       + coalesce((select sum(valor) from rest_contas where restaurante_id = v_rest and tipo = 'receber' and status = 'pago' and pago_em >= v_rest_row.saldo_em), 0)
       - coalesce((select sum(valor) from rest_contas where restaurante_id = v_rest and tipo = 'pagar' and status = 'pago' and pago_em >= v_rest_row.saldo_em), 0)
    into v_saldo;
  select jsonb_build_object(
    'hoje', v_hoje,
    'vendas_hoje', coalesce((select sum(liquido) from rest_vendas where restaurante_id = v_rest and data = v_hoje), 0),
    'vendas_periodo', coalesce((select sum(liquido) from rest_vendas where restaurante_id = v_rest and data between p_de and p_ate), 0),
    'bruto_periodo', coalesce((select sum(bruto) from rest_vendas where restaurante_id = v_rest and data between p_de and p_ate), 0),
    'qtd_vendas', coalesce((select sum(qtd_vendas) from rest_vendas where restaurante_id = v_rest and data between p_de and p_ate), 0),
    'compras_hoje', coalesce((select sum(total) from rest_compras where restaurante_id = v_rest and data = v_hoje and status <> 'cancelada'), 0),
    'compras_periodo', coalesce((select sum(total) from rest_compras where restaurante_id = v_rest and data between p_de and p_ate and status <> 'cancelada'), 0),
    'despesas_periodo', coalesce((select sum(valor) from rest_contas where restaurante_id = v_rest and tipo = 'pagar' and status <> 'cancelado' and coalesce(emissao, vencimento) between p_de and p_ate), 0),
    'despesas_pagas_periodo', coalesce((select sum(valor) from rest_contas where restaurante_id = v_rest and tipo = 'pagar' and status = 'pago' and pago_em between p_de and p_ate), 0),
    'a_pagar', coalesce((select sum(valor) from rest_contas where restaurante_id = v_rest and tipo = 'pagar' and status = 'pendente'), 0),
    'vencidas', coalesce((select sum(valor) from rest_contas where restaurante_id = v_rest and tipo = 'pagar' and status = 'pendente' and vencimento < v_hoje), 0),
    'qtd_vencidas', (select count(*) from rest_contas where restaurante_id = v_rest and tipo = 'pagar' and status = 'pendente' and vencimento < v_hoje),
    'a_receber', coalesce((select sum(valor) from rest_contas where restaurante_id = v_rest and tipo = 'receber' and status = 'pendente'), 0),
    'recebido_periodo', coalesce((select sum(valor) from rest_contas where restaurante_id = v_rest and tipo = 'receber' and status = 'pago' and pago_em between p_de and p_ate), 0),
    'saldo_caixa', round(v_saldo, 2), 'saldo_em', v_rest_row.saldo_em, 'saldo_inicial', v_rest_row.saldo_inicial,
    'solicitacoes_pendentes', (select count(*) from rest_solicitacoes where restaurante_id = v_rest and status in ('enviada','em_analise')),
    'notas_pendentes', (select count(*) from rest_notas where restaurante_id = v_rest and status = 'pendente'),
    'caixas_para_conferir', (select count(*) from rest_fechamentos where restaurante_id = v_rest and status = 'encerrado'),
    'estoque_baixo', (select count(*) from rest_produtos where restaurante_id = v_rest and status = 'ativo' and controla_estoque and estoque_minimo > 0 and estoque_atual <= estoque_minimo)
  ) into r;
  return r;
end $$;
