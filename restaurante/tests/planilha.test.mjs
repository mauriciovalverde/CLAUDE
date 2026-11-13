// Testes do importador com uma planilha sintética no mesmo formato (a planilha real do restaurante não vai para o repositório).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { lerPlanilhaCompras } from '../src/lib/planilha.js';
import { categorizar, chaveProduto, nomePadrao, padronizarFornecedor, lerQuantidade } from '../src/lib/catalogo.js';

function planilha() {
  const a = [
    [null, new Date(Date.UTC(2026, 6, 13, 12)), null, null, null, null, '07/11 para 15/07/2026'],
    [null, 'LOCAL: CENTRO SUL', null, null, null, null, 'LOCAL: AÇOUGUE VENTURA MASTER'],
    [null, 'MERCADORIA', 'QUANTIDADE', 'KG', 'VALOR', null, 'MERCADORIA', 'QUANTIDADE', 'KG', 'VALOR'],
    [null, 'CEBOLA', null, 5.53, 52.48, null, 'BIFE ESPECIAL', '—', 3.25, 113.72],
    [null, 'REFRIG COCA', '4PC', null, 92.64, null, 'BUCHO', '—', 1.206, 24.11],
    [null, 'FARINHA TRIGO', 4, null, 15.4, null, null, null, null, null],
    [null, 'BANANA DA TERRA', null, null, null],
    [null, null, null, null, 160.52],
    [null, null, null, 'DESCONTO ►', 0.52],
    [],
    [null, 'SÁBADO - LIMPEZA'],
    [null, 'LOCAL: PH'],
    [null, 'MERCADORIA', 'QUANTIDADE', 'KG', 'VALOR'],
    [null, 'DETERGENTE 5L', 1, null, 22.59],
    [],
    [null, new Date(Date.UTC(2026, 6, 16, 12))],
    [null, 'LOCAL: HORTFRUT (TRAZ NA PORTA)'],
    [null, 'MERCADORIA', 'QUANTIDADE', 'KG', 'VALOR'],
    [null, 'CENOURA'], [null, 'TOMATE'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(a, { cellDates: true });
  ws.E8.f = 'SUM(E4:E7)';
  ws.J4.f = '34.99*I4';
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RESUMO 13 a 17-07');
  // ida e volta pelo formato .xlsx, como acontece com o arquivo enviado
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return XLSX.read(buf, { cellDates: true, cellFormula: true });
}

test('lê blocos, datas, fornecedores, quantidades, pesos, valores e desconto', () => {
  const r = lerPlanilhaCompras(planilha(), XLSX);
  assert.equal(r.compras.length, 3);
  const cs = r.compras.find((c) => c.fornecedor === 'Centro Sul');
  assert.equal(cs.data, '2026-07-13');
  assert.equal(cs.itens.length, 3);
  assert.equal(cs.desconto, 0.52);
  assert.equal(cs.subtotal, 160.52);
  assert.equal(cs.total, 160);
  const ceb = cs.itens.find((i) => i.chave === 'CEBOLA');
  assert.deepEqual([ceb.unidade, ceb.quantidade, ceb.valor_total, ceb.valor_unitario], ['kg', 5.53, 52.48, 9.49]);
  const coca = cs.itens.find((i) => i.nome === 'Refrigerante Coca');
  assert.deepEqual([coca.unidade, coca.quantidade, coca.categoria], ['pct', 4, 'bebidas']);
  const ac = r.compras.find((c) => c.fornecedor === 'Açougue Ventura Master');
  assert.equal(ac.data, '2026-07-15', '"07/11 para 15/07/2026" usa a data depois de "para"');
  assert.equal(ac.itens[0].valor_unitario, 34.99, 'preço do quilo vem da fórmula');
  const ph = r.compras.find((c) => c.fornecedor === 'PH');
  assert.equal(ph.data, '2026-07-18', 'sábado da semana da aba');
  assert.equal(ph.data_estimada, true);
});

test('avisos: item sem valor, lista sem valores (pedido) e data estimada', () => {
  const r = lerPlanilhaCompras(planilha(), XLSX);
  const tipos = r.avisos.map((a) => a.tipo);
  assert.ok(tipos.includes('sem_valor'));
  assert.ok(tipos.includes('lista_sem_valores'));
  assert.ok(tipos.includes('data_estimada'));
  assert.ok(!r.compras.some((c) => c.fornecedor === 'Hortfrut'), 'lista de pedido não vira compra');
});

test('importar duas vezes gera as mesmas assinaturas (sem duplicar)', () => {
  const a = lerPlanilhaCompras(planilha(), XLSX).compras.map((c) => c.assinatura);
  const b = lerPlanilhaCompras(planilha(), XLSX).compras.map((c) => c.assinatura);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);
});

test('padronização de nomes e categorias', () => {
  assert.equal(chaveProduto('FEIJAO CARIOCA'), chaveProduto('FEIJÃO CARIOCA'));
  assert.equal(chaveProduto('FARINHA TRIGO'), chaveProduto('FARINHA DE TRIGO'));
  assert.equal(chaveProduto('CHAMPINGNON'), chaveProduto('CHAMPIGNON'));
  assert.equal(nomePadrao('FILÉ DE PEITO DE FRANGO'), 'Filé de Peito de Frango');
  assert.equal(nomePadrao('REFRIG COCA ZERO'), 'Refrigerante Coca Zero');
  assert.equal(categorizar('EXTRATO DE TOMATE'), 'mercearia');
  assert.equal(categorizar('TOMATE'), 'hortalicas');
  assert.equal(categorizar('CERVEJA'), 'bebidas');
  assert.equal(categorizar('CAPOTE'), 'aves');
  assert.equal(categorizar('SACO PARA LIXO 100L'), 'limpeza');
  assert.equal(categorizar('COPO DESCARTÁVEL 200ML'), 'embalagens');
  assert.equal(categorizar('CHÃ DE FORA'), 'acougue');
  assert.deepEqual(padronizarFornecedor('LOCAL: TRIGAL (SÉRGIO)'), { nome: 'Trigal', chave: 'TRIGAL', obs: 'sérgio' });
  assert.equal(padronizarFornecedor('LOCAL: ATACADAO').chave, padronizarFornecedor('LOCAL: ATACADÃO').chave);
  assert.deepEqual(lerQuantidade('3UN'), { qtd: 3, unidade: 'un' });
});
