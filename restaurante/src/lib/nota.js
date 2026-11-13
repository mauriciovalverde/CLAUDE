// Leitura de nota fiscal (NFC-e / cupom e DANFE) a partir do texto do OCR e/ou do QR Code.
// O resultado é uma SUGESTÃO: o responsável sempre confere antes de lançar.

const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const so = (s) => String(s ?? '').replace(/\D/g, '');

/** Decompõe a chave de acesso (44 dígitos): CNPJ do emitente, série, número, ano/mês, modelo (55 NF-e, 65 NFC-e). */
export function dadosDaChave(chave) {
  const c = so(chave);
  if (c.length !== 44 || !chaveValida(c)) return null;
  return { chave: c, uf: c.slice(0, 2), ano: 2000 + Number(c.slice(2, 4)), mes: Number(c.slice(4, 6)), cnpj: c.slice(6, 20), modelo: c.slice(20, 22), serie: String(Number(c.slice(22, 25))), numero: String(Number(c.slice(25, 34))) };
}
/** Dígito verificador (módulo 11) da chave de acesso. */
export function chaveValida(c) {
  if (!/^\d{44}$/.test(c)) return false;
  let soma = 0, peso = 2;
  for (let i = 42; i >= 0; i--) { soma += Number(c[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11; const dv = r < 2 ? 0 : 11 - r;
  return dv === Number(c[43]);
}
/** QR Code da NFC-e: "...?p=CHAVE|2|1|1|HASH" (ou chave=...). */
export function chaveDoQr(texto) {
  const t = String(texto ?? '');
  const m = t.match(/[?&](?:p|chNFe|chave)=([0-9]{44})/i) || t.match(/(\d{44})/);
  return m && chaveValida(m[1]) ? m[1] : null;
}

const UN = '(UN|UND|KG|PC|PCT|CX|LT|L|G|FD|DZ|BD|BJ|MC|PT|SC|FR|GF|LA|UNID)';
const unidade = (u) => ({ UND: 'un', UNID: 'un', UN: 'un', KG: 'kg', PC: 'pct', PCT: 'pct', PT: 'pct', CX: 'cx', LT: 'L', L: 'L', G: 'g', FD: 'fardo', DZ: 'dz', BD: 'bandeja', BJ: 'bandeja', MC: 'maço', GF: 'garrafa', LA: 'lata' }[String(u).toUpperCase()] ?? 'un');

/** Tira o nº do item e o código de barras (mesmo lido com erro pelo OCR) do começo da descrição. */
export function limparDescricao(d) {
  let t = String(d ?? '').trim().replace(/^\d{1,3}\s+/, '');
  const m = t.match(/^(\S{6,16})\s+(.*)$/);
  if (m && (m[1].match(/\d/g) ?? []).length >= 5) t = m[2];
  return t.trim();
}

/** Corrige erros típicos do OCR em números: "21 ,90" → "21,90", "2O,5O" → "20,50", "21.90" no fim → "21,90". */
export function normalizarLinha(l) {
  let t = l.replace(/\s+/g, ' ').trim();
  t = t.replace(/(\d)\s*,\s*(\d{2})\b/g, '$1,$2');
  t = t.replace(/\b([0-9OoIl]{1,4}),([0-9OoIl]{2,3})\b/g, (m, a, b) => /\d/.test(a + b) ? `${a.replace(/[Oo]/g, '0').replace(/[Il]/g, '1')},${b.replace(/[Oo]/g, '0').replace(/[Il]/g, '1')}` : m);
  t = t.replace(/(\s)(\d{1,4})\.(\d{2})(?=\s|$)/g, '$1$2,$3');
  return t;
}

const DIN = '(\\d{1,3}(?:\\.\\d{3})+,\\d{2}|\\d+,\\d{2})';
const QTD = '(\\d+(?:[.,]\\d{1,4})?)';
const UNI = '(\\d+(?:[.,]\\d{2,4}))';
// cada padrão: expressão + posição dos grupos [descrição, quantidade, unidade (0 = sem), unitário, total]
const PADROES = [
  // 001 789... ARROZ 5KG 2 UN X 21,90 43,80
  new RegExp(`^(?:\\d{1,3}\\s+)?(?:\\d{4,14}\\s+)?(.+?)\\s+${QTD}\\s*${UN}\\.?\\s*[xX*×]\\s*${UNI}\\s+${DIN}\\s*$`, 'i'),
  // ARROZ 5KG 2 UN 21,90 43,80   (sem o "x")
  new RegExp(`^(?:\\d{1,3}\\s+)?(?:\\d{4,14}\\s+)?(.+?)\\s+${QTD}\\s*${UN}\\.?\\s+${UNI}\\s+${DIN}\\s*$`, 'i'),
  // DANFE: DESCRIÇÃO NCM CST CFOP UN QTD VL.UNIT VL.TOTAL
  new RegExp(`^(?:\\d\\S*\\s+)?(.+?)\\s+\\d{8}\\s+\\d{2,4}\\s+\\d{4}\\s+${UN}\\.?\\s+${QTD}\\s+${UNI}\\s+${DIN}`, 'i'),
  // ARROZ 2 x 21,90 43,80   (sem unidade)
  new RegExp(`^(?:\\d{1,3}\\s+)?(?:\\d{4,14}\\s+)?(.+?)\\s+${QTD}\\s*[xX*×]\\s*${UNI}\\s+${DIN}\\s*$`, 'i'),
];
const GRUPOS = [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5], [1, 3, 2, 4, 5], [1, 2, 0, 3, 4]];
const PADRAO_QTD = [
  new RegExp(`^${QTD}\\s*${UN}\\.?\\s*[xX*×]?\\s*${UNI}\\s+${DIN}\\s*$`, 'i'),
  new RegExp(`^${QTD}\\s*[xX*×]\\s*${UNI}\\s+${DIN}\\s*$`, 'i'),
];
const NAO_ITEM = /TOTAL|SUBTOTAL|DESCONTO|TROCO|CNPJ|CHAVE|PAGAMENTO|DINHEIRO|CART[AÃ]O|PIX|TRIBUTO|IMPOSTO|LEI\s*12|CONSUMIDOR|PROTOCOLO|VALOR\s+PAGO|ACR[EÉ]SCIMO/i;

/** Separa os itens. Tenta formatos conhecidos; se nada casar, usa "descrição ... valor" como item a conferir. */
export function lerItens(linhas) {
  const itens = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (NAO_ITEM.test(l)) continue;
    let ok = false;
    for (const [k, re] of PADROES.entries()) {
      const m = l.match(re);
      if (!m) continue;
      const g = GRUPOS[k];
      itens.push({ descricao: limparDescricao(m[g[0]]), quantidade: num(m[g[1]]), unidade: g[2] ? unidade(m[g[2]]) : 'un', unit: num(m[g[3]]), total: num(m[g[4]]) }); ok = true; break;
    }
    if (ok) continue;
    for (const [k, re] of PADRAO_QTD.entries()) {
      const m = l.match(re);
      if (m && i > 0 && /[A-Za-zÀ-ú]{3}/.test(linhas[i - 1]) && !NAO_ITEM.test(linhas[i - 1]) && !PADRAO_QTD.some((r2) => r2.test(linhas[i - 1]))) {
        const temUn = k === 0;
        const prev = itens[itens.length - 1];
        if (prev && prev._linha === i - 1) itens.pop();
        itens.push({ descricao: limparDescricao(linhas[i - 1]), quantidade: num(m[1]), unidade: temUn ? unidade(m[2]) : 'un', unit: num(m[temUn ? 3 : 2]), total: num(m[temUn ? 4 : 3]) });
        ok = true; break;
      }
    }
  }
  if (itens.length) return itens;
  // último recurso: linhas com descrição e um valor no fim (quantidade 1, para conferir)
  for (const l of linhas) {
    if (NAO_ITEM.test(l)) continue;
    const m = l.match(new RegExp(`^(?:\\d{1,3}\\s+)?(?:\\d{4,14}\\s+)?(.*[A-Za-zÀ-ú]{3}.*?)\\s+${DIN}\\s*$`));
    if (m) itens.push({ descricao: limparDescricao(m[1]), quantidade: 1, unidade: 'un', unit: num(m[2]), total: num(m[2]), conferir: true });
  }
  return itens;
}

export function lerNota(texto, qr) {
  const linhas = String(texto ?? '').split(/\r?\n/).map(normalizarLinha).filter(Boolean);
  const tudo = linhas.join('\n');
  const r = { cnpj: null, razao_social: null, numero: null, serie: null, data_emissao: null, valor_total: null, chave_acesso: null, forma_pagamento: null, itens: [], avisos: [] };

  // chave de acesso: no QR ou no texto (às vezes em blocos de 4)
  const chaveTexto = (tudo.match(/(?:\d[\s.]?){44}/g) ?? []).map(so).find((c) => c.length >= 44 && chaveValida(c.slice(0, 44)));
  const chave = chaveDoQr(qr) ?? (chaveTexto ? chaveTexto.slice(0, 44) : null);
  const dc = chave ? dadosDaChave(chave) : null;
  if (dc) Object.assign(r, { chave_acesso: dc.chave, cnpj: dc.cnpj, numero: dc.numero, serie: dc.serie });

  const mc = tudo.match(/(\d{2}[.\s]?\d{3}[.\s]?\d{3}\s?\/\s?\d{4}\s?-?\s?\d{2})/);
  if (!r.cnpj && mc) r.cnpj = so(mc[1]);
  // razão social: linha antes do CNPJ ou a primeira linha com letras
  const iC = linhas.findIndex((l) => /CNPJ/i.test(l));
  const cand = (iC > 0 ? linhas.slice(Math.max(0, iC - 2), iC) : linhas.slice(0, 3)).filter((l) => /[A-Za-zÀ-ú]{3}/.test(l) && !/DOCUMENTO|DANFE|NFC|CONSUMIDOR|ELETR/i.test(l));
  if (cand.length) r.razao_social = cand[cand.length - 1].replace(/CNPJ.*$/i, '').trim() || null;

  if (!r.numero) { const m = tudo.match(/(?:NFC-?e\s*N?[º°o]?\.?|N[º°o]\.?|N[UÚ]MERO|NF-?e\s*N[º°o]?)\s*:?\s*(\d{1,9})/i); if (m) r.numero = String(Number(m[1])); }
  if (!r.serie) { const m = tudo.match(/S[ÉE]RIE\s*:?\s*(\d{1,3})/i); if (m) r.serie = String(Number(m[1])); }
  const md = tudo.match(/(?:EMISS[ÃA]O|DATA)[^\d]{0,20}(\d{2})\/(\d{2})\/(\d{4})/i) ?? tudo.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (md) r.data_emissao = `${md[3]}-${md[2]}-${md[1]}`;

  const mt = tudo.match(/(?:VALOR\s+(?:TOTAL(?:\s+DA\s+NOTA)?|A\s+PAGAR)|TOTAL\s+(?:A\s+PAGAR\s+)?R\$|VL\.?\s*TOTAL|VLR\.?\s*TOTAL)\s*(?:R\$)?\s*:?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i)
    ?? linhas.map((l) => l.match(/^(?:\S+\s+)?TOTAL\s*(?:R\$)?\s*:?\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/i)).find((m) => m && !/SUB|ITENS|DESC/i.test(m[0]));
  if (mt) r.valor_total = num(mt[1]);
  const mf = tudo.match(/\b(DINHEIRO|PIX|CART[ÃA]O\s+DE\s+CR[ÉE]DITO|CART[ÃA]O\s+DE\s+D[ÉE]BITO|CR[ÉE]DITO|D[ÉE]BITO|BOLETO|A\s+PRAZO)\b/i);
  if (mf) { const f = mf[1].toUpperCase(); r.forma_pagamento = /PIX/.test(f) ? 'PIX' : /DINHEIRO/.test(f) ? 'Dinheiro' : /CR[ÉE]DITO/.test(f) ? 'Crédito' : /D[ÉE]BITO/.test(f) ? 'Débito' : /BOLETO/.test(f) ? 'Boleto' : 'A prazo (fiado)'; }

  // itens: vários formatos de cupom/DANFE (e erros comuns do OCR)
  r.itens = lerItens(linhas);
  for (const it of r.itens) if (it.quantidade && it.unit && Math.abs(it.quantidade * it.unit - it.total) > Math.max(0.05, it.total * 0.02)) it.conferir = true;
  const soma = Math.round(r.itens.reduce((t, i) => t + i.total, 0) * 100) / 100;
  r.soma_itens = soma;
  if (r.valor_total != null && r.itens.length && Math.abs(soma - r.valor_total) > 0.05) r.avisos.push(`A soma dos itens lidos (R$ ${soma.toFixed(2).replace('.', ',')}) é diferente do total da nota (R$ ${r.valor_total.toFixed(2).replace('.', ',')}). Confira os itens.`);
  if (!r.itens.length) r.avisos.push('Não consegui separar os itens da nota. Digite os itens ou tire outra foto mais nítida.');
  if (r.valor_total == null && r.itens.length) { r.valor_total = soma; r.total_pela_soma = true; r.avisos.push('Não achei o total impresso: usei a soma dos itens. Confira.'); }
  else if (r.valor_total == null) r.avisos.push('Não encontrei o valor total. Confira.');
  if (dc && r.data_emissao && (Number(r.data_emissao.slice(0, 4)) !== dc.ano || Number(r.data_emissao.slice(5, 7)) !== dc.mes)) r.avisos.push('A data lida não bate com o mês da chave de acesso. Confira a data.');
  return r;
}
