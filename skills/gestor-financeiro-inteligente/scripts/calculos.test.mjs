// Rode com: node --test scripts/calculos.test.mjs   (Node 18+)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from './calculos.mjs';

test('empréstimo do exemplo: 1.000 a 10% em 30 dias = 1.100', () => {
  assert.deepEqual(c.calcularEmprestimo({ principal: 1000, taxaPct: 10, modalidade: 'simples', periodos: 1 }), { juros: 100, total: 1100 });
});

test('juros simples x composto em 3 meses a 5%', () => {
  assert.deepEqual(c.calcularEmprestimo({ principal: 1000, taxaPct: 5, modalidade: 'simples', periodos: 3 }), { juros: 150, total: 1150 });
  assert.deepEqual(c.calcularEmprestimo({ principal: 1000, taxaPct: 5, modalidade: 'composto', periodos: 3 }), { juros: 157.63, total: 1157.63 });
});

test('taxa mensal equivalente', () => {
  assert.equal(c.taxaMensalEquivalente({ taxaPct: 10, periodicidade: 'mensal' }), 10);
  assert.equal(c.taxaMensalEquivalente({ taxaPct: 12, periodicidade: 'anual' }), 1);
  assert.equal(c.taxaMensalEquivalente({ taxaPct: 1, periodicidade: 'diaria' }), 30);
  assert.equal(c.taxaMensalEquivalente({ taxaPct: 20, periodicidade: 'periodo_total', dias: 60 }), 10);
});

test('parcelas somam o total exato', () => {
  const p = c.gerarParcelas({ total: 1000, juros: 100, parcelas: 3, vencimentoFinal: '2027-03-10' });
  assert.equal(c.r2(p.reduce((s, x) => s + x.valor, 0)), 1000);
  assert.equal(c.r2(p.reduce((s, x) => s + x.valorJuros, 0)), 100);
  assert.deepEqual(p.map((x) => x.vencimento), ['2027-01-10', '2027-02-10', '2027-03-10']);
});

test('pagamento parcial abate juros primeiro', () => {
  assert.deepEqual(c.alocarPagamento({ valor: 500, saldo: 1100, jurosEmAberto: 100 }),
    { juros: 100, principal: 400, saldoRestante: 600, status: 'parcial' });
  assert.deepEqual(c.alocarPagamento({ valor: 600, saldo: 600, jurosEmAberto: 0 }),
    { juros: 0, principal: 600, saldoRestante: 0, status: 'pago' });
  assert.throws(() => c.alocarPagamento({ valor: 700, saldo: 600, jurosEmAberto: 0 }), /VALOR_ACIMA_DO_SALDO/);
});

test('faturamento não é lucro', () => {
  const k = c.indicadoresVenda([{ total: 150, custo: 80 }, { total: 300, custo: 160 }, { total: 50, custo: null }]);
  assert.equal(k.faturamento, 500);
  assert.equal(k.lucroBruto, 210);
  assert.equal(k.margemPct, 46.67);
  assert.equal(k.ticketMedio, 166.67);
  assert.equal(k.vendasSemCusto, 1);
});

test('crescimento: outubro 5.000 → novembro 6.500 = 30%', () => {
  assert.equal(c.crescimentoPct(5000, 6500), 30);
  assert.equal(c.crescimentoPct(0, 100), null);
});

test('datas em português relativas a hoje (12/11/2026)', () => {
  const hoje = '2026-11-12';
  assert.equal(c.resolverData('pagamento será dia 14 de dezembro', hoje), '2026-12-14');
  assert.equal(c.resolverData('pagamento para dia 20', hoje), '2026-11-20');
  assert.equal(c.resolverData('pagamento para dia 5', hoje), '2026-12-05');
  assert.equal(c.resolverData('pagamento em 30 dias', hoje), '2026-12-12');
  assert.equal(c.resolverData('vence 10 de março', hoje), '2027-03-10');
  assert.equal(c.resolverData('vence 02/01', hoje), '2027-01-02');
  assert.equal(c.resolverData('daqui a 2 meses', hoje), '2027-01-12');
  assert.equal(c.resolverData('amanhã', hoje), '2026-11-13');
  assert.equal(c.resolverData('quando ele puder', hoje), null);
});

test('addMeses respeita fim de mês', () => {
  assert.equal(c.addMeses('2027-01-31', 1), '2027-02-28');
});

test('telefone normalizado', () => {
  assert.equal(c.normalizarTelefone('71 99401-4023'), '71994014023');
  assert.equal(c.normalizarTelefone('+55 (71) 99401-4023'), '71994014023');
});

test('títulos de evento', () => {
  assert.equal(c.tituloEvento({ tipo: 'receber', origem: 'venda', nome: 'Valverde', valor: 150, descricao: 'Venda TZ' }), 'COBRAR VALVERDE - R$ 150 - VENDA TZ');
  assert.equal(c.tituloEvento({ tipo: 'receber', origem: 'emprestimo', nome: 'João', valor: 1100, descricao: 'Empréstimo' }), 'RECEBER JOÃO - R$ 1.100 - EMPRÉSTIMO');
  assert.equal(c.tituloEvento({ tipo: 'pagar', origem: 'compra', nome: 'Fornecedor', valor: 800 }), 'PAGAR FORNECEDOR - R$ 800');
});
