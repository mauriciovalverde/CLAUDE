// Gera PDFs de fatura de exemplo (layouts parecidos com os de bancos brasileiros) para os testes.
const { jsPDF } = require('../../gestor-financeiro/node_modules/jspdf/dist/jspdf.node.min.js');
function fatura(arquivo, cab, linhas) {
  const d = new jsPDF({ unit: 'pt' }); let y = 50;
  for (const c of cab) { d.setFontSize(11); d.text(c, 40, y); y += 18; }
  y += 10; d.setFontSize(9);
  for (const [data, desc, valor] of linhas) { d.text(data, 40, y); d.text(desc, 100, y); d.text(valor, 520, y, { align: 'right' }); y += 14; }
  require('fs').writeFileSync(arquivo, Buffer.from(d.output('arraybuffer')));
}
fatura(__dirname + '/nubank.pdf', ['Nu Pagamentos S.A.', 'Esta é a sua fatura de novembro', 'Data de vencimento: 15/12/2026', 'Total a pagar R$ 1.587,40'], [
  ['14 NOV', 'Pagamento recebido', '- R$ 900,00'],
  ['02 NOV', 'Supermercado Extra', 'R$ 312,45'],
  ['05 NOV', 'Posto Shell BR 116', 'R$ 200,00'],
  ['07 NOV', 'Magazine Luiza - Parcela 3/10', 'R$ 249,90'],
  ['10 NOV', 'Netflix.com', 'R$ 55,90'],
  ['12 NOV', 'Uber *Trip', 'R$ 23,15'],
  ['13 NOV', 'Drogaria Sao Paulo', 'R$ 46,00'],
  ['20 NOV', 'Mercadolivre*Celular 01/12', 'R$ 700,00'],
]);
fatura(__dirname + '/itau.pdf', ['Itaú Unibanco - Cartão Click', 'Vencimento 10/01/2027', 'Total desta fatura 1.240,00'], [
  ['03/12', 'IFOOD *RESTAURANTE', '89,90'],
  ['05/12', 'RENNER LOJA 22 PARC 02/06', '150,10'],
  ['08/12', 'CLARO MOVEL', '99,99'],
  ['15/12', 'ESTORNO COMPRA', '-50,00'],
  ['20/12', 'AMAZON MKTPLACE 1/3', '950,01'],
]);
