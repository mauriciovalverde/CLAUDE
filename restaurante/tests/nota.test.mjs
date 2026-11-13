import test from 'node:test';
import assert from 'node:assert/strict';
import { chaveValida, dadosDaChave, chaveDoQr, lerNota, limparDescricao } from '../src/lib/nota.js';

// chave fictícia com dígito verificador correto
function chaveCom(base43) { let s = 0, p = 2; for (let i = 42; i >= 0; i--) { s += Number(base43[i]) * p; p = p === 9 ? 2 : p + 1; } const r = s % 11; return base43 + (r < 2 ? 0 : 11 - r); }
const CHAVE = chaveCom('29' + '2611' + '12345678000199' + '65' + '001' + '000004567' + '1' + '12345678');

test('chave de acesso: dígito verificador e decomposição', () => {
  assert.equal(CHAVE.length, 44);
  assert.ok(chaveValida(CHAVE));
  assert.ok(!chaveValida(CHAVE.slice(0, 43) + ((Number(CHAVE[43]) + 1) % 10)));
  const d = dadosDaChave(CHAVE);
  assert.deepEqual([d.cnpj, d.numero, d.serie, d.modelo, d.ano, d.mes], ['12345678000199', '4567', '1', '65', 2026, 11]);
  assert.equal(chaveDoQr(`https://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx?p=${CHAVE}|2|1|1|ABCDEF`), CHAVE);
});

test('lê cupom NFC-e (itens em uma e em duas linhas)', () => {
  const texto = `CENTRO SUL COMERCIO DE ALIMENTOS LTDA
CNPJ: 12.345.678/0001-99 IE: 123456
DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRONICA
001 7891234567890 ARROZ PARBOILIZADO 5KG 2 UN X 21,90 43,80
002 7890000000001 OLEO DE SOJA 900ML
3 UN x 7,49 22,47
003 2000000000000 CEBOLA KG 2,350 KG x 5,99 14,08
Qtde. total de itens 3
Valor total R$ 80,35
Forma de pagamento PIX 80,35
NFC-e n° 000004567 Série 001 Emissão 12/11/2026 10:21:33
Chave de acesso: ${CHAVE.match(/.{1,4}/g).join(' ')}`;
  const r = lerNota(texto);
  assert.equal(r.cnpj, '12345678000199');
  assert.equal(r.razao_social, 'CENTRO SUL COMERCIO DE ALIMENTOS LTDA');
  assert.equal(r.numero, '4567');
  assert.equal(r.serie, '1');
  assert.equal(r.data_emissao, '2026-11-12');
  assert.equal(r.valor_total, 80.35);
  assert.equal(r.forma_pagamento, 'PIX');
  assert.equal(r.chave_acesso, CHAVE);
  assert.equal(r.itens.length, 3);
  assert.deepEqual(r.itens[0], { descricao: 'ARROZ PARBOILIZADO 5KG', quantidade: 2, unidade: 'un', unit: 21.9, total: 43.8 });
  assert.equal(r.itens[1].descricao, 'OLEO DE SOJA 900ML');
  assert.deepEqual([r.itens[2].quantidade, r.itens[2].unidade], [2.35, 'kg']);
  assert.equal(r.avisos.length, 0);
});

test('avisa quando a soma não bate e quando não acha itens', () => {
  const r = lerNota('MERCADO X\nCNPJ 11.111.111/0001-11\nFEIJAO 1 UN X 8,00 8,00\nVALOR A PAGAR R$ 20,00');
  assert.equal(r.itens.length, 1);
  assert.ok(r.avisos.some((a) => a.includes('diferente do total')));
  assert.ok(lerNota('foto borrada').avisos.some((a) => a.includes('itens')));
});

test('remove nº do item e código de barras lido com erro', () => {
  assert.equal(limparDescricao('003 789000000PNPOA2 FEIJAO CARIOCA 1KG'), 'FEIJAO CARIOCA 1KG');
  assert.equal(limparDescricao('7890000000001 OLEO DE SOJA 900ML'), 'OLEO DE SOJA 900ML');
  assert.equal(limparDescricao('ARROZ PARBOILIZADO 5KG'), 'ARROZ PARBOILIZADO 5KG');
  assert.equal(limparDescricao('LEITE CONDENSADO 395G'), 'LEITE CONDENSADO 395G');
});
