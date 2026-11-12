import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { lerFatura, montarLinhas, vencimentosFuturos, valorBR } from '../src/lib/fatura.js';
import { projetar, aporteMensalSonho } from '../src/lib/projecao.js';

async function linhasDoPdf(caminho) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(caminho)) }).promise;
  const itens = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    for (const it of tc.items) itens.push({ str: it.str, x: it.transform[4], y: it.transform[5], pagina: p });
  }
  return montarLinhas(itens);
}

test('valores em reais', () => {
  assert.equal(valorBR('1.234,56'), 1234.56);
  assert.equal(valorBR('- R$ 900,00'), -900);
  assert.equal(valorBR('50,00-'), -50);
});

test('fatura tipo Nubank (PDF real)', async () => {
  const f = lerFatura(await linhasDoPdf(new URL('./nubank.pdf', import.meta.url)));
  assert.equal(f.banco, 'Nubank');
  assert.equal(f.vencimento, '2026-12-15');
  assert.equal(f.total, 1587.40);
  assert.equal(f.itens.length, 7, JSON.stringify(f.itens.map((i) => i.descricao)));  // pagamento ignorado
  const magalu = f.itens.find((i) => /Magazine/.test(i.descricao));
  assert.deepEqual([magalu.parcela_num, magalu.parcela_total, magalu.valor, magalu.categoria], [3, 10, 249.90, 'Compras online']);
  const ml = f.itens.find((i) => /Mercadolivre/.test(i.descricao));
  assert.deepEqual([ml.parcela_num, ml.parcela_total], [1, 12]);
  assert.equal(f.itens.find((i) => /Shell/.test(i.descricao)).categoria, 'Combustível');
  assert.equal(f.soma, 1587.40);
});

test('fatura tipo Itaú (PDF real)', async () => {
  const f = lerFatura(await linhasDoPdf(new URL('./itau.pdf', import.meta.url)));
  assert.equal(f.banco, 'Itaú');
  assert.equal(f.vencimento, '2027-01-10');
  assert.equal(f.total, 1240.00);
  assert.equal(f.itens.length, 5);
  const renner = f.itens.find((i) => /RENNER/.test(i.descricao));
  assert.deepEqual([renner.parcela_num, renner.parcela_total, renner.descricao], [2, 6, 'RENNER LOJA 22']);
  assert.equal(f.itens.find((i) => /ESTORNO/.test(i.descricao)).valor, -50);
  assert.equal(f.soma, 1240.00);
});

test('parcelas futuras caem nos meses seguintes', () => {
  assert.deepEqual(vencimentosFuturos('2026-12-15', 3), ['2027-01-15', '2027-02-15', '2027-03-15']);
  assert.deepEqual(vencimentosFuturos('2027-01-31', 1), ['2027-02-28']);
});

test('projeção do ano com sonho', () => {
  const contas = [
    { tipo: 'receber', valor: 5000, vencimento: '2026-11-05', status: 'pago' },
    { tipo: 'receber', valor: 5000, vencimento: '2026-12-05', status: 'pendente' },
    { tipo: 'pagar', valor: 1587.40, vencimento: '2026-12-15', status: 'pendente' },
    { tipo: 'pagar', valor: 300, vencimento: '2026-10-10', status: 'pendente' }, // atrasada -> mês atual
  ];
  const sonhos = [{ valor_alvo: 12000, data_alvo: '2027-10-31', incluir_na_projecao: true, concluido: false, guardado: 0 }];
  assert.deepEqual(aporteMensalSonho(sonhos[0], 0, '2026-11-12'), { falta: 12000, mensal: 1000, meses: 12 });
  const p = projetar({ contas, sonhos, saldoAtual: 1000, hojeISO: '2026-11-12' });
  assert.equal(p.meses.length, 12);
  assert.deepEqual([p.meses[0].mes, p.meses[0].pagar, p.meses[0].sonhos, p.meses[0].saldoAcumulado], ['2026-11', 300, 1000, -300]);
  assert.equal(p.meses[0].negativo, true);
  assert.deepEqual([p.meses[1].receber, p.meses[1].pagar, p.meses[1].saldoAcumulado], [5000, 1587.4, 2112.6]);
  assert.equal(p.primeiroNegativo, '2026-11');
  assert.equal(p.totais.sonhos, 12000);
});
