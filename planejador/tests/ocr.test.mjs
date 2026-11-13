// Teste de leitura por IMAGEM (precisa de internet na 1ª vez para baixar o dicionário de português).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from 'tesseract.js';
import { lerFatura } from '../src/lib/fatura.js';
import { linhasDoOcr } from '../src/lib/ocr-linhas.js';

test('print de fatura com dois cartões (OCR)', { timeout: 180000 }, async () => {
  const w = await createWorker('por');
  const { data } = await w.recognize(new URL('./print-fatura.png', import.meta.url).pathname);
  await w.terminate();
  const f = lerFatura(linhasDoOcr(data.text));
  assert.equal(f.vencimento, '2026-12-15');
  assert.equal(f.total, 1244.30);
  assert.equal(f.itens.length, 5, JSON.stringify(f.itens));
  assert.deepEqual(f.cartoes.map((c) => [c.id, c.total]), [['1122', 618.25], ['3344', 626.05]]);
  assert.deepEqual([f.itens[1].parcela_num, f.itens[1].parcela_total], [3, 10]);
});
