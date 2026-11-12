// Leitura de fatura de cartão de crédito a partir do TEXTO do PDF (linhas já montadas).
// Funciona com o layout comum dos bancos brasileiros: "DATA  DESCRIÇÃO [PARCELA nn/NN]  VALOR".
// É uma heurística: o usuário SEMPRE revisa a lista antes de importar.

const MESES = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };
const MESES_EXT = { janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const BANCOS = [['nubank', 'Nubank'], ['nu pagamentos', 'Nubank'], ['itaú', 'Itaú'], ['itau', 'Itaú'], ['bradesco', 'Bradesco'], ['santander', 'Santander'], ['banco inter', 'Inter'], ['inter&co', 'Inter'], ['c6 bank', 'C6'], ['c6 ', 'C6'], ['caixa', 'Caixa'], ['banco do brasil', 'Banco do Brasil'], ['ourocard', 'Banco do Brasil'], ['mercado pago', 'Mercado Pago'], ['picpay', 'PicPay'], ['xp ', 'XP'], ['neon', 'Neon'], ['next', 'Next'], ['porto', 'Porto'], ['sicredi', 'Sicredi'], ['sicoob', 'Sicoob'], ['will bank', 'Will Bank'], ['pan', 'Banco Pan'], ['btg', 'BTG']];

/** "1.234,56" -> 1234.56 ; aceita sinal "-" antes ou depois e "R$" */
export function valorBR(s) {
  const neg = /-/.test(s);
  const n = Number(String(s).replace(/[^\d,]/g, '').replace(',', '.'));
  return neg ? -n : n;
}

const RE_VALOR = /(-\s*)?(?:R\$\s*)?(-\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\s*(-)?\s*$/;
const RE_DATA = /^(\d{2})\s*[/.-]\s*(\d{2})(?:\s*[/.-]\s*(\d{2,4}))?\b|^(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b/i;
const RE_PARCELA = /(?:PARC(?:ELA)?\.?\s*)?\b(\d{1,2})\s*(?:\/|\bDE\b)\s*(\d{1,2})\b(?!\s*[/.-]\s*\d)/i;
const IGNORAR = /pagamento\s+(recebido|efetuado|de\s+fatura)|^total|saldo\s+anterior|limite|subtotal|cr[eé]dito\s+rotativo|juros\s+do\s+rotativo|iof\s+sobre\s+rotativo|valor\s+m[ií]nimo|resumo/i;

/** Extrai cabeçalho (banco, vencimento, total) e itens de compra. */
export function lerFatura(linhas, hojeISO = new Date().toISOString().slice(0, 10)) {
  const texto = linhas.join('\n');
  const baixo = texto.toLowerCase();
  const banco = BANCOS.find(([k]) => baixo.includes(k))?.[1] ?? null;

  // vencimento
  let vencimento = null;
  const mv = texto.match(/venc[a-zç]*[^0-9\n]{0,40}(\d{2})\s*[/.-]\s*(\d{2})\s*[/.-]\s*(\d{2,4})/i);
  if (mv) { const a = mv[3].length === 2 ? 2000 + Number(mv[3]) : Number(mv[3]); vencimento = `${a}-${mv[2]}-${mv[1]}`; }
  else {
    const me = texto.match(/venc[a-zç]*[^0-9\n]{0,40}(\d{1,2})\s+(?:de\s+)?([a-zç]+)\.?\s+(?:de\s+)?(\d{4})/i);
    const m3 = texto.match(/venc[a-zç]*[^0-9\n]{0,40}(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\w*\s+(\d{4})/i);
    const mm = me && MESES_EXT[me[2].toLowerCase()] ? [me[1], MESES_EXT[me[2].toLowerCase()], me[3]] : m3 ? [m3[1], MESES[m3[2].toUpperCase()], m3[3]] : null;
    if (mm) vencimento = `${mm[2]}-${String(mm[1]).padStart(2, '0')}-${String(mm[0]).padStart(2, '0')}`;
  }

  // total da fatura
  let total = null;
  const mt = texto.match(/(?:total\s+(?:a\s+pagar|da\s+fatura|desta\s+fatura|da\s+sua\s+fatura)|valor\s+(?:total|da\s+fatura)|fatura\s+atual)[^0-9\n]{0,40}(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (mt) total = valorBR(mt[1]);

  // itens
  const itens = [];
  for (const bruta of linhas) {
    const l = bruta.replace(/\s+/g, ' ').trim();
    const md = l.match(RE_DATA);
    const mvl = l.match(RE_VALOR);
    if (!md || !mvl) continue;
    let desc = l.slice(md[0].length, l.length - mvl[0].length).trim();
    if (!desc || desc.length < 2 || IGNORAR.test(desc)) continue;
    const valor = valorBR(mvl[0]);
    if (!valor) continue;
    let parcela_num = null, parcela_total = null;
    const mp = desc.match(RE_PARCELA);
    if (mp) {
      const n = Number(mp[1]), t = Number(mp[2]);
      if (n >= 1 && t >= 2 && n <= t && t <= 48) { parcela_num = n; parcela_total = t; desc = desc.replace(mp[0], '').replace(/\s{2,}/g, ' ').replace(/[-–]\s*$/, '').trim(); }
    }
    const data = md[4] ? `${md[4]}/${String(MESES[md[5].toUpperCase()]).padStart(2, '0')}` : `${md[1]}/${md[2]}`;
    itens.push({ data, descricao: desc, valor, parcela_num, parcela_total, categoria: categorizar(desc) });
  }
  const soma = Math.round(itens.reduce((s, i) => s + i.valor, 0) * 100) / 100;
  return { banco, vencimento, total: total ?? soma, soma, itens, hojeISO };
}

const CATS = [
  [/mercado|supermerc|atacad|assa[ií]|carrefour|extra|p[aã]o de a[cç]|hortifruti|a[cç]ougue|padaria/i, 'Mercado'],
  [/posto|combust|shell|ipiranga|petrobras|br mania|\bgas\b/i, 'Combustível'],
  [/uber|\b99\b|99app|cabify|metr[oô]|estacion|ped[aá]gio|sem parar|veloe/i, 'Transporte'],
  [/ifood|rappi|restaur|lanch|pizz|burger|mc ?donald|bk |habib|bar |caf[eé]|a[cç]a[ií]/i, 'Alimentação'],
  [/farm|drog|raia|pacheco|pague menos|panvel|hospital|cl[ií]nica|laborat|odonto|m[eé]dic/i, 'Saúde'],
  [/netflix|spotify|prime|disney|hbo|max\b|globoplay|youtube|deezer|apple\.com|google|microsoft|icloud|paramount|star\+/i, 'Assinaturas'],
  [/claro|vivo|\btim\b|\boi\b|net |internet|telefon/i, 'Telefone/Internet'],
  [/escola|faculd|curso|udemy|livrar/i, 'Educação'],
  [/amazon|mercadolivre|mercado livre|shopee|magalu|magazine|americanas|shein|aliexpress|casas bahia/i, 'Compras online'],
  [/renner|riachuelo|c&a|zara|centauro|netshoes|cal[cç]ad|roupa/i, 'Vestuário'],
  [/iof|anuidade|tarifa|juros|encargo|multa/i, 'Tarifas e juros'],
];
export function categorizar(desc) { return CATS.find(([re]) => re.test(desc))?.[1] ?? 'Outros'; }

/** Monta linhas a partir dos itens de texto do pdf.js (agrupa por altura, ordena por x). */
export function montarLinhas(itensTexto) {
  const grupos = new Map();
  for (const it of itensTexto) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round(it.y / 3) * 3;
    const chave = `${it.pagina}:${y}`;
    if (!grupos.has(chave)) grupos.set(chave, { pagina: it.pagina, y, partes: [] });
    grupos.get(chave).partes.push(it);
  }
  return [...grupos.values()]
    .sort((a, b) => a.pagina - b.pagina || b.y - a.y)
    .map((g) => g.partes.sort((a, b) => a.x - b.x).map((p) => p.str.trim()).join('  '));
}

/** Datas das parcelas futuras: a partir do vencimento da fatura, uma por mês. */
export function vencimentosFuturos(vencimentoISO, quantidade) {
  const [a, m, d] = vencimentoISO.split('-').map(Number);
  const out = [];
  for (let k = 1; k <= quantidade; k++) {
    const dt = new Date(Date.UTC(a, m - 1 + k, 1));
    const ult = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
    dt.setUTCDate(Math.min(d, ult));
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}
