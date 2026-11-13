// Importador da planilha de compras (modelo "CONTROLE COMPRAS"): cada aba é uma semana; dentro dela há blocos
//   <data>
//   LOCAL: <fornecedor>
//   MERCADORIA | QUANTIDADE | KG | VALOR
//   itens… (até a primeira linha vazia), às vezes seguidos de DESCONTO ► / TOTAL NOTA e observações com "*".
// Os quadros "Resumo das Compras" são ignorados (são totais, não compras).
// Recebe um workbook do SheetJS (XLSX.read(..., { cellDates: true, cellFormula: true })).
import { categorizar, chaveFornecedor, chaveProduto, lerQuantidade, nomePadrao, padronizarFornecedor } from './catalogo.js';

const r2 = (n) => Math.round(n * 100) / 100;
const txt = (c) => (c == null ? '' : String(c.v ?? '').trim());
const numero = (c) => {
  if (!c || c.v == null || c.v === '') return null;
  if (typeof c.v === 'number') return c.v;
  const s = String(c.v).trim().replace(/\s/g, '');
  if (!/^-?\d+([.,]\d+)?$/.test(s)) return null;
  return Number(s.replace(',', '.'));
};
const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
function lerData(c, anoRef) {
  if (!c || c.v == null) return null;
  if (c.v instanceof Date) {
    // SheetJS monta a data no fuso local: usa os componentes locais (+1 min contra arredondamento de 23:59:59.999)
    const d = new Date(c.v.getTime() + 60_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (typeof c.v === 'number' && c.v > 40000 && c.v < 60000) return iso(new Date(Date.UTC(1899, 11, 30) + c.v * 86400_000));
  const s = String(c.v);
  // "07/11 para 09/11/2026" → a última data completa; "27/07/2026 A 29/07/2026" → a primeira
  const completas = [...s.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g)];
  if (completas.length) {
    const m = /\bpara\b/i.test(s) ? completas.at(-1) : completas[0];
    return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  // "PEGUEI COM MEU PAI - 17/9" (sem ano): usa o ano da aba
  const curta = s.match(/(?:^|\D)(\d{1,2})\/(\d{1,2})(?!\/|\d)/);
  if (curta && anoRef) return `${anoRef}-${curta[2].padStart(2, '0')}-${curta[1].padStart(2, '0')}`;
  return null;
}

/** Período escrito no nome da aba: "RESUMO 31 a 04-09" (ano de referência) → { de, ate } aproximado para conferência. */
function periodoDaAba(nome, ano) {
  const m = nome.match(/(\d{1,2})\s*a\s*(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const [, d1, d2, mes] = m.map(Number);
  const mesIni = d1 > d2 ? mes - 1 : mes;
  return { de: `${ano}-${String(mesIni).padStart(2, '0')}-${String(d1).padStart(2, '0')}`, ate: `${ano}-${String(mes).padStart(2, '0')}-${String(d2).padStart(2, '0')}` };
}

/** Assinatura estável de uma compra (para não importar duas vezes). */
export function assinaturaCompra(data, fornecedorChave, itens) {
  const s = `${data}|${fornecedorChave}|${itens.map((i) => `${i.chave}:${r2(i.valor_total)}`).sort().join(';')}`;
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

const somaDias = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export function lerPlanilhaCompras(wb, XLSX) {
  let ultimoAno = null;
  const compras = [];
  const avisos = [];
  for (const aba of wb.SheetNames) {
    const ws = wb.Sheets[aba];
    if (!ws || !ws['!ref']) continue;
    const rg = XLSX.utils.decode_range(ws['!ref']);
    const cel = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
    const ref = (r, c) => `${aba}!${XLSX.utils.encode_cell({ r, c })}`;
    for (let r = rg.s.r; r <= rg.e.r; r++) {
      for (let c = rg.s.c; c <= rg.e.c; c++) {
        const t = txt(cel(r, c));
        if (!/^LOCAL\s*:/i.test(t)) continue;
        const forn = padronizarFornecedor(t);
        // data: logo acima (até 3 linhas)
        const anoAba = (wb.Props?.ModifiedDate ?? new Date()).getFullYear?.() ?? new Date().getFullYear();
        let data = null, rotulo = '';
        for (let k = 1; k <= 3 && !data; k++) { data = lerData(cel(r - k, c), ultimoAno ?? anoAba); if (!rotulo) rotulo = txt(cel(r - k, c)); }
        let dataEstimada = false;
        if (!data) {
          // sem data escrita ("SÁBADO - LIMPEZA", "EMBALAGEM"): usa a semana da aba
          const p = periodoDaAba(aba, ultimoAno ?? anoAba);
          if (p) { data = /S[ÁA]BADO/i.test(rotulo) ? somaDias(p.ate, 1) : p.ate; dataEstimada = true; }
        }
        if (data) ultimoAno = data.slice(0, 4);
        // cabeçalho
        let ini = r + 1;
        if (/MERCADORIA/i.test(txt(cel(ini, c)))) ini++;
        const itens = [];
        const semValor = [];
        let fim = ini;
        for (let i = ini; i <= rg.e.r; i++) {
          const nome = txt(cel(i, c));
          if (!nome || /^LOCAL\s*:/i.test(nome) || /^MERCADORIA$/i.test(nome)) { fim = i; break; }
          fim = i + 1;
          const cq = cel(i, c + 1), ck = cel(i, c + 2), cv = cel(i, c + 3);
          const q = lerQuantidade(cq?.v);
          const kg = numero(ck);
          const valor = numero(cv);
          const original = nome.replace(/\s+/g, ' ');
          if (valor == null) { semValor.push(original); continue; }
          // fórmula "=19.99*I50" = preço do quilo × peso
          let unit = null;
          const f = cv?.f ? String(cv.f) : '';
          const mf = f.match(/^\s*=?\s*(\d+(?:\.\d+)?)\s*\*\s*[A-Z]+\d+\s*$/i);
          if (mf) unit = Number(mf[1]);
          const unidade = kg != null ? 'kg' : (q.unidade ?? 'un');
          const quantidade = kg != null ? kg : (q.qtd ?? (/^\s*FEIRA\s*$/i.test(original) ? 1 : null));
          if (unit == null && quantidade) unit = r2(valor / quantidade);
          if (valor === 0) avisos.push({ tipo: 'valor_zero', local: ref(i, c), msg: `${original} com valor R$ 0,00 em ${ref(i, c)}.` });
          itens.push({
            descricao_original: original, nome: nomePadrao(original), chave: chaveProduto(original), categoria: categorizar(original),
            quantidade, unidade, peso_kg: kg, qtd_volumes: q.qtd, valor_unitario: unit, valor_total: r2(valor), celula: ref(i, c),
          });
        }
        // depois dos itens: total (SUM), desconto, total da nota e observações
        let desconto = 0, totalPlanilha = null, totalNota = null; const obs = [];
        for (let i = fim; i <= Math.min(fim + 6, rg.e.r); i++) {
          for (let cc = c; cc <= c + 3; cc++) {
            const x = cel(i, cc); const tx = txt(x);
            if (/DESCONTO/i.test(tx)) desconto = numero(cel(i, cc + 1)) ?? 0;
            if (/TOTAL NOTA/i.test(tx)) totalNota = numero(cel(i, cc + 1));
            if (x?.f && /SUM/i.test(String(x.f)) && cc === c + 3 && totalPlanilha == null) totalPlanilha = numero(x);
            if (cc === c && tx.startsWith('*')) obs.push(tx.replace(/^\*\s*/, ''));
          }
          if (/^LOCAL\s*:/i.test(txt(cel(i, c)))) break;
        }
        const quando = data ? data.split('-').reverse().join('/') : 'sem data';
        if (!itens.length) {
          if (semValor.length) avisos.push({ tipo: 'lista_sem_valores', local: ref(r, c), msg: `${forn.nome} (${quando}, ${ref(r, c)}): lista de ${semValor.length} itens sem valores — parece um pedido, não uma compra. Não importado.` });
          continue;
        }
        if (semValor.length) avisos.push({ tipo: 'sem_valor', local: ref(r, c), msg: `${forn.nome} ${quando}: ${semValor.length} item(ns) sem valor não importado(s): ${semValor.join(', ')}.` });
        if (!data) { avisos.push({ tipo: 'sem_data', local: ref(r, c), msg: `Compra de ${forn.nome} em ${ref(r, c)} sem data: não importada.` }); continue; }
        if (dataEstimada) avisos.push({ tipo: 'data_estimada', local: ref(r, c), msg: `${forn.nome} (${ref(r, c)}${rotulo ? `, "${rotulo}"` : ''}): sem data escrita; usei ${quando} pela semana da aba.` });
        const soma = r2(itens.reduce((t, i) => t + i.valor_total, 0));
        if (totalPlanilha != null && Math.abs(totalPlanilha - soma) > 0.05) avisos.push({ tipo: 'total_divergente', local: ref(fim, c + 3), msg: `${forn.nome} ${data}: soma dos itens R$ ${soma.toFixed(2)} ≠ total da planilha R$ ${totalPlanilha.toFixed(2)}.` });
        const p = periodoDaAba(aba, data.slice(0, 4));
        if (p && (data < p.de || data > p.ate)) avisos.push({ tipo: 'data_fora_da_semana', local: ref(r, c), msg: `${forn.nome}: data ${data.split('-').reverse().join('/')} fora da semana da aba "${aba}".` });
        if (/,| e /i.test(forn.nome)) avisos.push({ tipo: 'local_combinado', local: ref(r, c), msg: `"${forn.nome}" reúne mais de um local numa só compra (${data.split('-').reverse().join('/')}).` });
        const total = r2(soma - (desconto || 0));
        compras.push({
          aba, data, fornecedor: forn.nome, fornecedor_chave: forn.chave, fornecedor_obs: forn.obs, fornecedor_original: t,
          itens, subtotal: soma, data_estimada: dataEstimada, desconto: r2(desconto || 0), total, total_planilha: totalPlanilha, total_nota: totalNota, obs: obs.join(' | '),
          assinatura: assinaturaCompra(data, forn.chave, itens), celula: ref(r, c),
        });
      }
    }
  }
  compras.sort((a, b) => a.data.localeCompare(b.data));
  // assinaturas repetidas dentro do próprio arquivo (bloco copiado duas vezes)
  const vistos = new Map();
  const unicas = [];
  for (const c of compras) {
    if (vistos.has(c.assinatura)) { avisos.push({ tipo: 'bloco_repetido', local: c.celula, msg: `Compra repetida (${c.fornecedor} ${c.data}) em ${c.celula} e ${vistos.get(c.assinatura)}: importada uma vez.` }); continue; }
    vistos.set(c.assinatura, c.celula); unicas.push(c);
  }
  // catálogos
  const fornecedores = new Map();
  const produtos = new Map();
  for (const c of unicas) {
    const f = fornecedores.get(c.fornecedor_chave) ?? { nome: c.fornecedor, chave: c.fornecedor_chave, obs: new Set(), grafias: new Set(), compras: 0, total: 0 };
    if (c.fornecedor_obs) f.obs.add(c.fornecedor_obs);
    f.grafias.add(c.fornecedor_original.replace(/^LOCAL\s*:\s*/i, ''));
    // prefere a grafia com acento
    if (/[À-ú]/.test(c.fornecedor) && !/[À-ú]/.test(f.nome)) f.nome = c.fornecedor;
    f.compras++; f.total = r2(f.total + c.total);
    fornecedores.set(c.fornecedor_chave, f);
    for (const i of c.itens) {
      const p = produtos.get(i.chave) ?? { nome: i.nome, chave: i.chave, categoria: i.categoria, unidade: i.unidade, grafias: new Set(), vezes: 0, total: 0 };
      p.grafias.add(i.descricao_original); p.vezes++; p.total = r2(p.total + i.valor_total);
      if (/[À-ú]/.test(i.nome) && !/[À-ú]/.test(p.nome)) p.nome = i.nome;
      produtos.set(i.chave, p);
    }
  }
  const lista = (m) => [...m.values()].map((x) => ({ ...x, grafias: [...x.grafias], ...(x.obs ? { obs: [...x.obs].join('; ') } : {}) }));
  return {
    compras: unicas, avisos,
    fornecedores: lista(fornecedores).sort((a, b) => b.total - a.total),
    produtos: lista(produtos).sort((a, b) => a.nome.localeCompare(b.nome)),
    resumo: {
      abas: wb.SheetNames.length, compras: unicas.length, itens: unicas.reduce((t, c) => t + c.itens.length, 0),
      total: r2(unicas.reduce((t, c) => t + c.total, 0)), de: unicas[0]?.data ?? null, ate: unicas.at(-1)?.data ?? null,
    },
  };
}

export { chaveFornecedor };
