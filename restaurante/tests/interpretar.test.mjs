import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretar, periodo } from '../src/lib/ia/interpretar.js';

const ctx = { hoje: '2026-11-13', produtos: ['Carne Moída', 'Batata', 'Tomate', 'Filé de Peito de Frango', 'Cebola', 'Arroz Parboilizado', 'Batata Palha'], fornecedores: ['Centro Sul', 'Açougue Ventura Master', 'Hortfrut', 'Atacadão'] };
const i = (t, extra = {}) => interpretar(t, { ...ctx, ...extra });

test('períodos', () => {
  assert.deepEqual(periodo('ontem', ctx.hoje), { de: '2026-11-12', ate: '2026-11-12', nome: 'ontem' });
  assert.deepEqual(periodo('em setembro', ctx.hoje), { de: '2026-09-01', ate: '2026-09-30', nome: 'setembro' });
  assert.deepEqual(periodo('desde julho', ctx.hoje), { de: '2026-07-01', ate: '2026-11-13', nome: 'desde julho' });
  assert.equal(periodo('nos últimos três meses', ctx.hoje).de, '2026-08-15');
  assert.deepEqual(periodo('dezembro', ctx.hoje).de, '2025-12-01', 'mês que ainda não chegou = ano passado');
  assert.equal(periodo('este mês', ctx.hoje).de, '2026-11-01');
});

test('consultas do pedido original', () => {
  let r = i('Quanto gastamos com carnes este mês?');
  assert.deepEqual([r.nome, r.args.categoria, r.args.de], ['consultar_gastos', 'acougue', '2026-11-01']);
  r = i('Qual foi nosso faturamento ontem?');
  assert.deepEqual([r.nome, r.args.de, r.args.ate], ['faturamento', '2026-11-12', '2026-11-12']);
  r = i('Compare as despesas de outubro e novembro.');
  assert.deepEqual([r.nome, r.args.a_de, r.args.b_ate], ['comparar_periodos', '2026-10-01', '2026-11-30']);
  r = i('Quanto gastamos com carnes em setembro?');
  assert.deepEqual([r.args.categoria, r.args.de, r.args.ate], ['acougue', '2026-09-01', '2026-09-30']);
  r = i('Quanto compramos no Centro Sul em outubro?');
  assert.deepEqual([r.nome, r.args.fornecedor, r.args.de], ['consultar_gastos', 'Centro Sul', '2026-10-01']);
  r = i('Qual foi o custo da batata nos últimos três meses?');
  assert.deepEqual([r.nome, r.args.produto, r.args.de], ['preco_produto', 'Batata', '2026-08-15']);
  r = i('Qual fornecedor recebeu mais pagamentos?');
  assert.deepEqual([r.nome, r.args.por], ['pagamentos_por_fornecedor', 'pagamentos']);
  r = i('Quanto gastamos com hortaliças desde julho?');
  assert.deepEqual([r.args.categoria, r.args.de], ['hortalicas', '2026-07-01']);
  assert.equal(i('Qual produto teve maior aumento de preço?').nome, 'maiores_aumentos');
  assert.equal(i('quais contas estão vencidas?').args.situacao, 'vencidas');
  assert.equal(i('o que está acabando no estoque?').nome, 'estoque');
});

test('registros', () => {
  let r = i('Comprei 15 kg de carne moída por R$ 32 o quilo no Açougue Ventura Master, paguei no pix');
  assert.equal(r.nome, 'registrar_compra');
  assert.deepEqual(r.args.itens, [{ produto: 'Carne Moída', quantidade: 15, unidade: 'kg', valor_unitario: 32 }]);
  assert.deepEqual([r.args.fornecedor, r.args.pago, r.args.forma_pagamento, r.args.mercadoria_chegou], ['Açougue Ventura Master', true, 'PIX', true]);
  // sem fornecedor e sem pagamento: pergunta, guarda o que já sabe e completa com as respostas
  r = i('Comprei 15 kg de carne por R$ 32 o quilo.');
  assert.equal(r.tipo, 'pergunta'); assert.equal(r.pendente.falta, 'fornecedor');
  r = i('açougue ventura master', { pendente: r.pendente });
  assert.equal(r.tipo, 'pergunta'); assert.equal(r.pendente.falta, 'pagamento');
  r = i('vou pagar dia 20', { pendente: r.pendente });
  assert.deepEqual([r.nome, r.args.fornecedor, r.args.pago, r.args.vencimento, r.args.itens[0].valor_unitario], ['registrar_compra', 'Açougue Ventura Master', false, '2026-11-20', 32]);
  // gasto genérico
  r = i('Hoje gastamos R$ 280 com hortaliças na Hortfrut');
  assert.deepEqual([r.nome, r.args.itens[0].produto, r.args.itens[0].valor_total, r.args.pago, r.args.mercadoria_chegou, r.args.fornecedor], ['registrar_compra', 'Hortaliças diversas', 280, true, false, 'Hortfrut']);
  // entrega
  r = i('O fornecedor Centro Sul entregou a compra de hoje.');
  assert.deepEqual([r.nome, r.args.fornecedor, r.args.data], ['marcar_compra_recebida', 'Centro Sul', '2026-11-13']);
  // despesa
  r = i('conta de luz de R$ 450,90 vence dia 20');
  assert.deepEqual([r.nome, r.args.categoria, r.args.valor, r.args.vencimento, r.args.pago], ['registrar_despesa', 'Energia', 450.9, '2026-11-20', false]);
  // total em vez de unitário
  r = i('compramos 10 kg de tomate por 59,90 na Hortfrut a vista');
  assert.deepEqual([r.args.itens[0].produto, r.args.itens[0].valor_total, r.args.pago], ['Tomate', 59.9, true]);
  assert.equal(i('bom dia').tipo, 'ajuda');
});
