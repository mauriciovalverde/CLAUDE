-- Uso: psql -f tests/mock_supabase.sql -f supabase/schema.sql -f supabase/funcoes.sql -f supabase/caixa_despesas.sql -f tests/caixa_banco.sql
\set QUIET on
\pset tuples_only on
insert into auth.users(id, email) values ('a0000000-0000-0000-0000-000000000001','adm@r'),('a0000000-0000-0000-0000-000000000003','caixa@r');
insert into rest_restaurantes(id, nome, codigo) values ('10000000-0000-0000-0000-000000000001','Cantinho','SABOR-TESTE');
insert into rest_funcionarios(id, restaurante_id, user_id, nome, papeis) values
 ('f0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Dona','{admin}'),
 ('f0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','Adriana','{caixa}');
create or replace function t_como(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create or replace function t_ok(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond, false) then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
grant execute on function t_ok(boolean, text), t_como(text) to authenticated;
select t_como('a0000000-0000-0000-0000-000000000003');
insert into rest_fechamentos(data, turno, fundo_troco, status) values ('2026-11-13', 'dia', 187, 'aberto');
insert into rest_caixa_despesas(fechamento_id, tipo, funcionario_id, valor) select id, 'transporte', 'f0000000-0000-0000-0000-000000000003', 19 from rest_fechamentos;
insert into rest_caixa_despesas(fechamento_id, tipo, pessoa, descricao, valor) select id, 'outros', 'Mercadinho', 'Gelo', 20 from rest_fechamentos;
insert into rest_caixa_despesas(fechamento_id, tipo, pessoa, valor) select id, 'vale', 'Laiane', 96 from rest_fechamentos;
select t_ok((select sangrias from rest_fechamentos) = 135, 'sangria = soma das despesas (19 + 20 + 96)');
update rest_fechamentos set dinheiro = 248.09, debito = 700.37, credito = 1811.88, pix = 755.44, outros = 25.15, dinheiro_contado = 301.95, status = 'encerrado', justificativa = 'Sobra';
reset role;
select t_ok((select count(*) from rest_contas where origem = 'caixa' and status = 'pago') = 3, 'fechamento lança 3 despesas pagas no Financeiro');
select t_ok((select string_agg(descricao, ' | ' order by valor) from rest_contas) = 'Transporte · Adriana (caixa de 13/11) | Outros · Mercadinho · Gelo (caixa de 13/11) | Vale · Laiane (caixa de 13/11)', 'descrições com tipo e pessoa');
select t_ok((select categoria from rest_contas where valor = 96) = 'Vale a funcionário', 'vale vai para a categoria Vale a funcionário');
select t_como('a0000000-0000-0000-0000-000000000003');
do $$ begin
  insert into rest_caixa_despesas(fechamento_id, tipo, pessoa, valor) select id, 'taxi', 'X', 10 from rest_fechamentos;
  raise exception 'FALHOU: aceitou despesa depois do fechamento';
exception when insufficient_privilege then raise notice 'ok - operador não muda despesas depois do fechamento';
end $$;
reset role;
select t_como('a0000000-0000-0000-0000-000000000001');
update rest_fechamentos set status = 'devolvido', obs_conferencia = 'Conferir vale';
select t_ok((select count(*) from rest_contas where origem = 'caixa' and status = 'cancelado') = 3, 'devolvido: despesas lançadas são canceladas (não apagadas)');
update rest_fechamentos set status = 'conferido';
select t_ok((select count(*) from rest_contas where origem = 'caixa' and status = 'pago') = 3, 'conferido de novo: lançadas outra vez, sem duplicar as pagas');
insert into rest_caixa_despesas(fechamento_id, tipo, pessoa, valor) select id, 'taxi', 'Cooperativa', 10 from rest_fechamentos;
select t_ok((select count(*) from rest_contas where origem = 'caixa' and status = 'pago') = 4 and (select sum(valor) from rest_contas where origem = 'caixa' and status = 'pago') = 145, 'admin corrige caixa fechado: Financeiro acompanha');
delete from rest_caixa_despesas where tipo = 'taxi';
-- conta como no papel: saldo anterior + total do dia − despesas do dia
update rest_restaurantes set saldo_inicial = 187, saldo_em = '2026-11-13';
select t_ok((select 187 + (select sum(liquido) from rest_vendas) - (select sum(valor) from rest_contas where status = 'pago')) = 3592.93, 'total final como no papel: 187 + 3.540,93 − 135 = 3.592,93');
\echo 'CAIXA: todos os testes passaram'
