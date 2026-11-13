-- Teste local do banco (Postgres puro com um "auth" simulado). Uso:
--   createdb rest_t && psql -d rest_t -v ON_ERROR_STOP=1 -f tests/mock_supabase.sql -f supabase/schema.sql -f supabase/funcoes.sql -f tests/banco.sql
\set QUIET on
\pset tuples_only on
\pset format unaligned
insert into auth.users(id, email) values
 ('a0000000-0000-0000-0000-000000000001', 'admin@r'), ('a0000000-0000-0000-0000-000000000002', 'pede@r'),
 ('a0000000-0000-0000-0000-000000000003', 'caixa@r'), ('a0000000-0000-0000-0000-000000000004', 'compras@r'),
 ('b0000000-0000-0000-0000-000000000001', 'admin@outro');
insert into rest_restaurantes(id, nome, codigo, saldo_inicial, saldo_em) values
 ('10000000-0000-0000-0000-000000000001', 'Cantinho', 'SABOR-TESTE', 1000, '2026-11-01'),
 ('20000000-0000-0000-0000-000000000002', 'Outro', 'OUTRO-TESTE', 0, '2026-11-01');
insert into rest_funcionarios(id, restaurante_id, user_id, nome, papeis) values
 ('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Dono', '{admin}'),
 ('f0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Cozinheira', '{solicitante}'),
 ('f0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Caixa', '{caixa}'),
 ('f0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Comprador', '{compras}'),
 ('f0000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Outro dono', '{admin}');

create or replace function t_como(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create or replace function t_ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
grant execute on function t_ok(boolean, text) to authenticated;
grant execute on function t_como(text) to authenticated;
create table t_ids (k text primary key, v uuid); grant all on t_ids to authenticated;

-- 1) cozinheira pede produtos (um existente criado na hora como pendente e um livre)
select t_como('a0000000-0000-0000-0000-000000000002');
insert into rest_produtos(nome, chave, categoria, unidade, status) values ('Cebola', 'CEBOLA', 'hortalicas', 'kg', 'pendente');
do $$ declare s uuid; begin
  insert into rest_solicitacoes(setor, status) values ('Cozinha', 'em_elaboracao') returning id into s;
  insert into t_ids values ('solic', s);
  insert into rest_solicitacao_itens(solicitacao_id, produto_id, quantidade, unidade) select s, id, 10, 'kg' from rest_produtos where chave = 'CEBOLA';
  insert into rest_solicitacao_itens(solicitacao_id, nome_livre, quantidade, unidade, obs) values (s, 'Coentro', 2, 'maço', 'bem verde');
  update rest_solicitacoes set status = 'enviada', enviada_em = now() where id = s;
end $$;
select t_ok((select count(*) from rest_solicitacao_itens) = 2, 'solicitante vê os próprios itens');
do $$ begin
  begin insert into rest_produtos(nome, chave, status) values ('Batata', 'BATATA', 'ativo'); raise exception 'deveria bloquear';
  exception when insufficient_privilege or check_violation then perform t_ok(true, 'solicitante não cria produto já ativo'); end;
  begin perform rest_registrar_compra('{"data":"2026-11-10","fornecedor_nome":"X","itens":[{"descricao_original":"a","valor_total":1}]}'); raise exception 'deveria bloquear';
  exception when others then perform t_ok(sqlerrm like 'SEM_PERMISSAO%', 'solicitante não registra compra'); end;
end $$;
select t_ok((select count(*) from rest_contas) = 0, 'solicitante não vê financeiro');
select t_ok((select count(*) from rest_fornecedores) = 0, 'solicitante não vê fornecedores');
-- não pode aprovar a própria solicitação
do $$ begin
  begin update rest_solicitacoes set status = 'aprovada'; raise exception 'x';
  exception when insufficient_privilege then perform t_ok(true, 'solicitante não aprova a própria solicitação'); end;
end $$;
reset role;
select t_ok((select status from rest_solicitacoes) = 'enviada', 'solicitante não aprova');

-- 2) comprador aprova, compra parte e recebe com falta
select t_como('a0000000-0000-0000-0000-000000000004');
select t_ok((select count(*) from rest_solicitacoes where status = 'enviada') = 1, 'compras vê solicitações enviadas');
update rest_solicitacoes set status = 'aprovada', analisada_por = rest_meu_funcionario(), analisada_em = now();
update rest_solicitacao_itens set qtd_aprovada = 8 where nome_livre is null;
update rest_produtos set status = 'ativo' where chave = 'CEBOLA';
do $$ declare r jsonb; it uuid; s uuid := (select v from t_ids where k = 'solic'); begin
  select id into it from rest_solicitacao_itens where nome_livre is null;
  r := rest_registrar_compra(jsonb_build_object('data', '2026-11-10', 'fornecedor_nome', 'Hortfrut', 'fornecedor_chave', 'HORTFRUT', 'solicitacao_id', s,
        'vencimento', '2026-11-20', 'pago', false, 'parcelas', 2,
        'itens', jsonb_build_array(jsonb_build_object('produto_id', (select id from rest_produtos where chave = 'CEBOLA'), 'solicitacao_item_id', it,
                   'descricao_original', 'CEBOLA', 'quantidade', 8, 'unidade', 'kg', 'valor_unitario', 5, 'valor_total', 40.01))));
  insert into t_ids values ('compra', (r->>'compra_id')::uuid);
  perform t_ok((r->>'total')::numeric = 40.01, 'compra registrada com total');
end $$;
select t_ok((select status from rest_solicitacoes) = 'parcial', 'solicitação fica parcial (coentro não comprado)');
reset role;
select t_ok((select count(*) from rest_contas where compra_id is not null) = 2, 'compra a prazo gerou 2 parcelas');
select t_ok((select sum(valor) from rest_contas) = 40.01 and (select max(vencimento) from rest_contas) = '2026-12-20', 'parcelas somam o total e vencem mês a mês');
select t_ok((select count(*) from rest_estoque_movs) = 0, 'compra NÃO mexe no estoque antes de chegar');
select t_como('a0000000-0000-0000-0000-000000000004');
select rest_receber_compra((select v from t_ids where k = 'compra'), (select jsonb_build_array(jsonb_build_object('item_id', id, 'qtd_recebida', 7.5, 'validade', '2026-11-20')) from rest_compra_itens));
select t_ok((select estoque_atual from rest_produtos where chave = 'CEBOLA') = 7.5, 'estoque recebeu 7,5 kg (chegou menos)');
select t_ok((select status from rest_compras) = 'parcial_recebida', 'compra marcada com divergência de entrega');
do $$ begin
  begin perform rest_receber_compra((select v from t_ids where k = 'compra'), null); perform rest_receber_compra((select v from t_ids where k = 'compra'), null); raise exception 'x';
  exception when others then perform t_ok(sqlerrm like 'JA_RECEBIDA%', 'não recebe duas vezes'); end;
end $$;
-- nota: a mesma nota não gera conta duplicada
do $$ declare n uuid; r jsonb; begin
  insert into rest_notas(cnpj, numero, serie, valor_total, data_emissao) values ('12345678000199', '555', '1', 30, '2026-11-11') returning id into n;
  r := rest_registrar_compra(jsonb_build_object('data', '2026-11-11', 'fornecedor_nome', 'Centro Sul', 'cnpj', '12345678000199', 'nota_id', n, 'pago', true,
        'itens', jsonb_build_array(jsonb_build_object('nome', 'Arroz', 'chave', 'ARROZ', 'categoria', 'cereais', 'unidade', 'pct', 'descricao_original', 'ARROZ 5KG', 'quantidade', 6, 'valor_total', 30))));
  perform t_ok((select status from rest_notas where id = n) = 'conferida', 'nota conferida e ligada à compra');
  begin
    perform rest_registrar_compra(jsonb_build_object('data', '2026-11-11', 'fornecedor_nome', 'Centro Sul', 'nota_id', n, 'itens', jsonb_build_array(jsonb_build_object('descricao_original', 'x', 'valor_total', 30))));
    raise exception 'x';
  exception when others then perform t_ok(sqlerrm like 'NOTA_JA_VINCULADA%', 'nota já usada não gera outra compra/conta'); end;
  begin insert into rest_notas(cnpj, numero, serie) values ('12345678000199', '555', '1'); raise exception 'x';
  exception when unique_violation then perform t_ok(true, 'mesma nota (CNPJ+número+série) não entra duas vezes'); end;
end $$;
select t_ok((select count(*) from rest_contas) = 0, 'compras não vê o financeiro (só admin)');
reset role;
select t_ok((select count(*) from rest_contas where status = 'pago' and valor = 30) = 1, 'compra paga na hora gerou conta já paga');
select t_ok((select categoria from rest_contas where valor = 30) = 'Compras: Cereais e grãos', 'categoria financeira vem dos produtos');

-- 3) caixa fecha o turno; não consegue alterar depois de encerrar
select t_como('a0000000-0000-0000-0000-000000000003');
insert into rest_fechamentos(data, turno, fundo_troco, dinheiro, debito, credito, pix, vale_refeicao, num_vendas, sangrias, estornos, descontos, dinheiro_contado, valor_sistema)
values ('2026-11-12', 'noite', 100, 500, 800, 1200, 600, 150, 80, 200, 20, 30, 395, 3260);
update rest_fechamentos set status = 'encerrado';
do $$ begin
  begin update rest_fechamentos set dinheiro = 999; raise exception 'x';
  exception when others then perform t_ok(sqlerrm like 'FECHAMENTO_ENCERRADO%', 'caixa encerrado não muda sem o administrador'); end;
end $$;
select t_ok((select total from rest_fechamentos) = 3250, 'total do caixa = soma das formas');
select t_ok((select count(*) from rest_vendas) = 0, 'caixa não vê o faturamento geral');
reset role;
select t_ok((select liquido from rest_vendas) = 3230 and (select bruto from rest_vendas) = 3280, 'venda do dia: líquido = recebido − estornos; bruto inclui descontos');

-- 4) administrador: confere caixa, paga parcial, painel, auditoria, isolamento entre restaurantes
select t_como('a0000000-0000-0000-0000-000000000001');
update rest_fechamentos set status = 'conferido', obs_conferencia = 'ok';
select t_ok((select conferida from rest_vendas) and (select conferido_por from rest_fechamentos) = 'f0000000-0000-0000-0000-000000000001', 'admin confere o caixa');
do $$ declare c uuid; r jsonb; begin
  select id into c from rest_contas where status = 'pendente' order by vencimento limit 1;
  r := rest_pagar_conta(c, 10, '2026-11-12', 'pix', null);
  perform t_ok(r->>'restante_id' is not null and (select valor from rest_contas where id = (r->>'restante_id')::uuid) = 10, 'pagamento parcial lança o restante');
end $$;
select t_ok((rest_painel('2026-11-01', '2026-11-30')->>'vendas_periodo')::numeric = 3230, 'painel: vendas do mês');
select t_ok((rest_painel('2026-11-01', '2026-11-30')->>'saldo_caixa')::numeric = 1000 + 3230 - 30 - 10, 'painel: saldo de caixa = inicial + vendas − pagamentos');
select t_ok((rest_painel('2026-11-01', '2026-11-30')->>'solicitacoes_pendentes')::int = 0, 'painel: solicitações pendentes');
select t_ok((select count(*) from rest_auditoria where tabela = 'rest_fechamentos') >= 3, 'alterações do caixa ficam na auditoria');
select t_ok((select count(*) from rest_auditoria where tabela = 'rest_contas' and acao = 'update') >= 1, 'pagamento fica na auditoria');
-- estoque
select rest_movimentar_estoque((select id from rest_produtos where chave = 'CEBOLA'), 'consumo', 2.5, 'almoço');
select rest_movimentar_estoque((select id from rest_produtos where chave = 'CEBOLA'), 'inventario', 4.8, 'contagem');
select t_ok((select estoque_atual from rest_produtos where chave = 'CEBOLA') = 4.8, 'inventário acerta o saldo');
select t_ok((select quantidade from rest_estoque_movs where tipo = 'inventario') = -0.2, 'inventário registra a diferença (perda de 0,2)');
do $$ begin
  begin perform rest_movimentar_estoque((select id from rest_produtos where chave = 'CEBOLA'), 'perda', 50); raise exception 'x';
  exception when others then perform t_ok(sqlerrm like 'ESTOQUE_INSUFICIENTE%', 'não baixa mais do que tem'); end;
  begin update rest_estoque_movs set quantidade = 100; delete from rest_estoque_movs;
    perform t_ok((select count(*) from rest_estoque_movs where quantidade = 100) = 0 and (select count(*) from rest_estoque_movs) = 3, 'movimentos de estoque não se editam nem apagam'); end;
end $$;
-- mesclar duplicados
insert into rest_produtos(nome, chave, categoria, unidade) values ('Cebola ', 'CEBOLA BRANCA', 'hortalicas', 'kg');
select rest_movimentar_estoque((select id from rest_produtos where chave = 'CEBOLA BRANCA'), 'entrada', 1);
select rest_mesclar_produtos((select id from rest_produtos where chave = 'CEBOLA'), array[(select id from rest_produtos where chave = 'CEBOLA BRANCA')]);
select t_ok((select estoque_atual from rest_produtos where chave = 'CEBOLA') = 5.8 and (select status from rest_produtos where chave = 'CEBOLA BRANCA') = 'inativo' and (select count(*) from rest_estoque_movs m join rest_produtos p on p.id = m.produto_id where p.chave = 'CEBOLA BRANCA') = 0, 'juntar soma o estoque, move o histórico e deixa o repetido inativo (nada apagado)');
-- importação idempotente
select t_ok((rest_importar_compras('{"arquivo":"x.xlsx","compras":[{"data":"2026-07-13","fornecedor_nome":"Centro Sul","fornecedor_chave":"CENTROSUL","assinatura":"abc","itens":[{"nome":"Tomate","chave":"TOMATE","categoria":"hortalicas","unidade":"kg","descricao_original":"TOMATE","quantidade":4.3,"peso_kg":4.3,"valor_total":21.93}]}]}')->>'novas')::int = 1, 'importa a planilha');
select t_ok((rest_importar_compras('{"arquivo":"x.xlsx","compras":[{"data":"2026-07-13","fornecedor_nome":"Centro Sul","fornecedor_chave":"CENTROSUL","assinatura":"abc","itens":[{"nome":"Tomate","chave":"TOMATE","categoria":"hortalicas","unidade":"kg","descricao_original":"TOMATE","quantidade":4.3,"peso_kg":4.3,"valor_total":21.93}]}]}')->>'repetidas')::int = 1, 'importar de novo não duplica');
select t_ok((select estoque_atual from rest_produtos where chave = 'TOMATE') = 0, 'histórico importado não altera o estoque atual');
select t_ok((select count(*) from rest_v_itens) = 3, 'visão de itens para relatórios');
-- outro restaurante não vê nada
select t_como('b0000000-0000-0000-0000-000000000001');
select t_ok((select count(*) from rest_compras) + (select count(*) from rest_produtos) + (select count(*) from rest_contas) + (select count(*) from rest_fechamentos) + (select count(*) from rest_funcionarios) = 1, 'outro restaurante só vê o próprio dono');
do $$ begin
  begin perform rest_fornecedor_id('10000000-0000-0000-0000-000000000001', 'Invasor', 'INVASOR', null); raise exception 'x';
  exception when others then perform t_ok(sqlerrm like 'SEM_PERMISSAO%', 'não cria cadastro em restaurante alheio'); end;
end $$;
-- sem login: nada
select t_como('');
select t_ok((select count(*) from rest_restaurantes) = 0, 'sem login não vê nada');
reset role;
select t_ok((select count(*) from rest_pins) = 0, 'tabela de PIN existe e fica fechada');
-- compra cancelada: contas dela (inclusive pagas) saem do caixa
reset role;
create temp table t_cc as select c.compra_id from rest_contas c join rest_compras p on p.id = c.compra_id where c.status = 'pago' and p.status <> 'cancelada' limit 1;
update rest_compras set status = 'cancelada' where id = (select compra_id from t_cc);
select t_ok((select bool_and(status = 'cancelado') from rest_contas where compra_id = (select compra_id from t_cc)), 'compra cancelada cancela também a conta já paga');
select t_ok(coalesce((select sum(quantidade) from rest_estoque_movs where compra_id = (select compra_id from t_cc) and tipo = 'entrada'), 0) = -coalesce((select sum(quantidade) from rest_estoque_movs where motivo like 'Estorno da entrada da compra #%'), 0), 'compra cancelada estorna o estoque');
\echo TODOS OS TESTES DO BANCO PASSARAM
