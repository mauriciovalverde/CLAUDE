// Gera PDFs de fatura de exemplo (layouts parecidos com os de bancos brasileiros) para os testes.
const { jsPDF } = require('../../gestor-financeiro/node_modules/jspdf/dist/jspdf.node.min.js');
function fatura(arquivo, cab, linhas) {
  // linhas com um único texto são cabeçalhos de seção (ex.: cartão adicional)
  const d = new jsPDF({ unit: 'pt' }); let y = 50;
  for (const c of cab) { d.setFontSize(11); d.text(c, 40, y); y += 18; }
  y += 10; d.setFontSize(9);
  for (const l of linhas) { if (l.length === 1) { y += 6; d.setFontSize(10); d.text(l[0], 40, y); d.setFontSize(9); y += 16; continue; } const [data, desc, valor] = l; d.text(data, 40, y); d.text(desc, 100, y); d.text(valor, 520, y, { align: 'right' }); y += 14; }
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

fatura(__dirname + '/dois-cartoes.pdf', ['Banco Bradesco - Cartão Elo Grafite', 'Vencimento: 20/12/2026', 'Total da fatura R$ 2.010,00'], [
  ['MAURICIO VALVERDE - Cartão final 4321'],
  ['02/11', 'POSTO IPIRANGA', '250,00'],
  ['05/11', 'ASSAI ATACADISTA', '480,00'],
  ['09/11', 'SAMSUNG ONLINE 04/10', '330,00'],
  ['Total do cartão final 4321  R$ 1.060,00'],
  ['ANA VALVERDE - Cartão adicional final 8765'],
  ['03/11', 'RIACHUELO', '199,90'],
  ['07/11', 'DROGARIA RAIA', '80,10'],
  ['12/11', 'MAGALU 2/5', '670,00'],
]);
fatura(__dirname + '/nubank-jan.pdf', ['Nu Pagamentos S.A.', 'Esta é a sua fatura de dezembro', 'Data de vencimento: 15/01/2027', 'Total a pagar R$ 1.737,30'], [
  ['15 DEZ', 'Saldo anterior', 'R$ 637,40'],
  ['15 DEZ', 'Juros do rotativo', 'R$ 50,00'],
  ['03 DEZ', 'Supermercado Extra', 'R$ 100,00'],
  ['07 DEZ', 'Magazine Luiza - Parcela 4/10', 'R$ 249,90'],
  ['20 DEZ', 'Mercadolivre*Celular 02/12', 'R$ 700,00'],
]);
