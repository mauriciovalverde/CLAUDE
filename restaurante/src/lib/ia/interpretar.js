// Assistente embutido (sem IA externa, sem chave): entende as frases mais comuns do dia a dia e escolhe a ferramenta.
// Função pura e testada (tests/interpretar.test.mjs): recebe o texto, os nomes cadastrados e a data de hoje.
import { semAcento, chaveProduto, chaveFornecedor } from '../catalogo.js';

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12 };
const iso = (d) => d.toISOString().slice(0, 10);
const dia = (s) => new Date(s + 'T12:00:00Z');
const somaDias = (s, n) => { const d = dia(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const inicioMes = (a, m) => `${a}-${String(m + 1).padStart(2, '0')}-01`;
const fimMes = (a, m) => iso(new Date(Date.UTC(a, m + 1, 0, 12)));
const norm = (t) => semAcento(String(t ?? '')).toLowerCase().replace(/[“”"!?]/g, ' ').replace(/\s+/g, ' ').trim();
const valor = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));

/** Mês citado ("setembro", "setembro de 2026"): usa o ano atual, ou o anterior se o mês ainda não chegou. */
function mesCitado(t, hoje, aPartirDe = 0) {
  const re = new RegExp(`\\b(${MESES.join('|')})\\b(?:\\s+de\\s+(\\d{4}))?`, 'g');
  const achados = [...t.slice(aPartirDe).matchAll(re)];
  const [aH, mH] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1];
  return achados.map((m) => { const mi = MESES.indexOf(m[1]); const a = m[2] ? Number(m[2]) : (mi > mH ? aH - 1 : aH); return { de: inicioMes(a, mi), ate: fimMes(a, mi), nome: m[1] }; });
}

/** Período da frase. Padrão: este mês. */
export function periodo(texto, hoje) {
  const t = norm(texto);
  const [a, m] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1];
  if (/\bontem\b/.test(t)) { const o = somaDias(hoje, -1); return { de: o, ate: o, nome: 'ontem' }; }
  if (/\bhoje\b/.test(t)) return { de: hoje, ate: hoje, nome: 'hoje' };
  if (/\b(essa|esta|nessa|nesta) semana\b/.test(t)) { const dow = (dia(hoje).getUTCDay() + 6) % 7; return { de: somaDias(hoje, -dow), ate: hoje, nome: 'esta semana' }; }
  if (/\bsemana passada\b/.test(t)) { const dow = (dia(hoje).getUTCDay() + 6) % 7; const ini = somaDias(hoje, -dow - 7); return { de: ini, ate: somaDias(ini, 6), nome: 'semana passada' }; }
  const ult = t.match(/\bultim[oa]s?\s+(\d+|\w+)\s+(mes|meses|dias|semanas)\b/);
  if (ult) { const n = Number(ult[1]) || NUM[ult[1]] || 1; const dias = ult[2].startsWith('mes') ? n * 30 : ult[2] === 'semanas' ? n * 7 : n; return { de: somaDias(hoje, -dias), ate: hoje, nome: `últimos ${n} ${ult[2]}` }; }
  if (/\bmes passado\b/.test(t)) { const d = new Date(Date.UTC(a, m - 1, 1)); return { de: iso(d), ate: fimMes(d.getUTCFullYear(), d.getUTCMonth()), nome: 'mês passado' }; }
  if (/\b(este|esse|neste|nesse) ano\b/.test(t)) return { de: `${a}-01-01`, ate: hoje, nome: 'este ano' };
  const desde = t.match(new RegExp(`\\b(desde|a partir de)\\s+(${MESES.join('|')})\\b`));
  if (desde) { const [p] = mesCitado(t, hoje, desde.index); return { de: p.de, ate: hoje, nome: `desde ${p.nome}` }; }
  const meses = mesCitado(t, hoje);
  if (meses.length) return { de: meses[0].de, ate: meses[0].ate, nome: meses[0].nome };
  return { de: inicioMes(a, m), ate: hoje, nome: 'este mês' };
}

const CATEGORIAS = [
  ['acougue', /\b(carnes?|acougue|bovin[ao]s?|boi|porco|suin[ao]s?|linguicas?|picanha)\b/], ['aves', /\b(frangos?|aves?|galinha)\b/],
  ['peixes', /\b(peixes?|frutos do mar|camarao|bacalhau)\b/], ['hortalicas', /\b(hortalicas?|verduras?|legumes?|hortifruti|feira)\b/],
  ['frutas', /\bfrutas?\b/], ['bebidas', /\b(bebidas?|refrigerantes?|refris?|cervejas?|sucos?|aguas?)\b/], ['laticinios', /\b(laticinios?|frios|queijos?|leites?)\b/],
  ['cereais', /\b(cereais|graos|arroz|feijao)\b/], ['mercearia', /\bmercearia\b/], ['padaria', /\b(padaria|paes|pao)\b/],
  ['embalagens', /\b(embalagens?|descartaveis|marmitas?|quentinhas?)\b/], ['limpeza', /\b(limpeza|higiene|produtos de limpeza)\b/],
];
const categoriaDe = (t) => CATEGORIAS.find(([, re]) => re.test(t))?.[0] ?? null;

/** Nome cadastrado mais longo que aparece na frase. */
function acharNome(t, nomes, chaveFn) {
  const tt = ` ${t.replace(/[^a-z0-9 ]/g, ' ')} `;
  let melhor = null;
  for (const n of nomes) {
    const k = norm(n).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (k.length < 3) continue;
    if (tt.includes(` ${k} `) && (!melhor || k.length > melhor.k.length)) melhor = { nome: n, k };
  }
  return melhor?.nome ?? null;
}

const UNIDADES = { kg: 'kg', quilo: 'kg', quilos: 'kg', kilo: 'kg', kilos: 'kg', g: 'g', gramas: 'g', un: 'un', unidade: 'un', unidades: 'un', pacote: 'pct', pacotes: 'pct', pct: 'pct', caixa: 'cx', caixas: 'cx', cx: 'cx', litro: 'L', litros: 'L', l: 'L', fardo: 'fardo', fardos: 'fardo', duzia: 'dz', duzias: 'dz', maco: 'maço', macos: 'maço', bandeja: 'bandeja', bandejas: 'bandeja', lata: 'lata', latas: 'lata', garrafa: 'garrafa', garrafas: 'garrafa', saco: 'un', sacos: 'un' };
const RE_UN = Object.keys(UNIDADES).sort((x, y) => y.length - x.length).join('|');

/** Pagamento: "paguei", "no pix", "vou pagar dia 20", "vence 25/11". */
function pagamento(t, hoje) {
  const forma = /\bpix\b/.test(t) ? 'PIX' : /\bdinheiro\b|\bespecie\b/.test(t) ? 'Dinheiro' : /\bdebito\b/.test(t) ? 'Débito' : /\bcredito\b|\bcartao\b/.test(t) ? 'Crédito' : /\bboleto\b/.test(t) ? 'Boleto' : null;
  const dm = t.match(/\b(?:dia|vence(?:\s+dia)?|vencimento|pagar\s+(?:dia|em|no dia))\s+(\d{1,2})(?:\/(\d{1,2}))?(?:\/(\d{2,4}))?\b/);
  if (dm || /\b(vou pagar|a prazo|fiado|depois|boleto|vence)\b/.test(t)) {
    let venc = null;
    if (dm) {
      const [aH, mH, dH] = hoje.split('-').map(Number);
      let mes = dm[2] ? Number(dm[2]) : mH, ano = dm[3] ? Number(dm[3].length === 2 ? '20' + dm[3] : dm[3]) : aH;
      if (!dm[2] && Number(dm[1]) < dH) { mes++; if (mes > 12) { mes = 1; ano++; } }
      venc = `${ano}-${String(mes).padStart(2, '0')}-${String(dm[1]).padStart(2, '0')}`;
    }
    return { pago: false, vencimento: venc, forma_pagamento: forma ?? (/boleto/.test(t) ? 'Boleto' : null) };
  }
  if (/\b(paguei|pagamos|pago|a vista|ja pago|pagou)\b/.test(t) || forma) return { pago: true, forma_pagamento: forma };
  return null;
}

/**
 * @param {string} texto
 * @param {{ produtos: string[], fornecedores: string[], hoje: string, pendente?: any }} ctx
 */
export function interpretar(texto, ctx) {
  const t = norm(texto);
  const hoje = ctx.hoje;
  // resposta a uma pergunta pendente (ex.: "já pagou?")
  if (ctx.pendente?.falta === 'pagamento') {
    const p = pagamento(t, hoje) ?? (/\b(sim|ja)\b/.test(t) ? { pago: true } : /\b(nao|ainda nao)\b/.test(t) ? { pago: false } : null);
    if (p) { if (p.pago === false && !p.vencimento) return { tipo: 'pergunta', texto: 'Qual o vencimento? (ex.: dia 20)', pendente: { ...ctx.pendente, args: { ...ctx.pendente.args, ...p }, falta: 'vencimento' } }; return { tipo: 'ferramenta', nome: ctx.pendente.nome, args: { ...ctx.pendente.args, ...p } }; }
  }
  if (ctx.pendente?.falta === 'vencimento') { const p = pagamento(`vence ${t}`, hoje); if (p?.vencimento) return { tipo: 'ferramenta', nome: ctx.pendente.nome, args: { ...ctx.pendente.args, ...p } }; }
  if (ctx.pendente?.falta === 'fornecedor' && t.length > 1) {
    const f = acharNome(t, ctx.fornecedores) ?? (/\b(nao sei|tanto faz|nao importa|nenhum)\b/.test(t) ? 'Não informado' : texto.trim());
    const args = { ...ctx.pendente.args, fornecedor: f };
    if (args.pago === undefined) return { tipo: 'pergunta', texto: 'Já pagou ou vai pagar depois?', pendente: { ...ctx.pendente, args, falta: 'pagamento' } };
    return { tipo: 'ferramenta', nome: ctx.pendente.nome, args };
  }
  if (ctx.pendente?.falta === 'confirmar_duplicada' && /\b(sim|e outra|outra compra|pode)\b/.test(t)) return { tipo: 'ferramenta', nome: ctx.pendente.nome, args: { ...ctx.pendente.args, confirmar_duplicada: true } };

  const per = periodo(t, hoje);
  const forn = acharNome(t, ctx.fornecedores);
  const prod = acharNome(t, ctx.produtos);
  const cat = categoriaDe(t);
  const pergunta = /^(quanto|qual|quais|quem|como|onde|o que|mostre|mostra|me (diz|fala|mostra)|liste|lista)\b|\?$/.test(t) || /\bquanto\b/.test(t);

  // entrega de fornecedor
  if (/\b(entregou|chegou|chegaram|recebemos|recebi)\b/.test(t) && !/\bquanto\b/.test(t)) {
    if (!forn) return { tipo: 'pergunta', texto: 'Qual fornecedor entregou?', pendente: null };
    return { tipo: 'ferramenta', nome: 'marcar_compra_recebida', args: { fornecedor: forn, ...(/\bhoje\b/.test(t) ? { data: hoje } : /\bontem\b/.test(t) ? { data: somaDias(hoje, -1) } : {}) } };
  }
  // comparação de períodos
  if (/\bcompar/.test(t) || /\b(x|versus|vs)\b/.test(t)) {
    const ms = mesCitado(t, hoje);
    if (ms.length >= 2) return { tipo: 'ferramenta', nome: 'comparar_periodos', args: { a_de: ms[0].de, a_ate: ms[0].ate, b_de: ms[1].de, b_ate: ms[1].ate } };
    const [aH, mH] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1];
    const ant = new Date(Date.UTC(aH, mH - 1, 1));
    return { tipo: 'ferramenta', nome: 'comparar_periodos', args: { a_de: iso(ant), a_ate: fimMes(ant.getUTCFullYear(), ant.getUTCMonth()), b_de: inicioMes(aH, mH), b_ate: hoje } };
  }
  if (/\b(aumento|aumentou|aumentaram|subiu|subiram|encareceu|encareceram|mais caro)\b/.test(t) && !prod) return { tipo: 'ferramenta', nome: 'maiores_aumentos', args: {} };
  if (/\b(fornecedor|fornecedores)\b/.test(t) && /\b(mais|maior|ranking|quem)\b/.test(t) && !forn) {
    return { tipo: 'ferramenta', nome: 'pagamentos_por_fornecedor', args: { de: /\b(mes|semana|ano|ontem|hoje|desde|ultim\w*|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/.test(t) ? per.de : '2000-01-01', ate: per.ate, por: /\b(pagamento|pagamentos|pago|pagou|recebeu)\b/.test(t) ? 'pagamentos' : 'compras' } };
  }
  if (/\b(faturamento|faturamos|faturou|vendemos|vendas|vendeu|ticket)\b/.test(t)) return { tipo: 'ferramenta', nome: 'faturamento', args: { de: per.de, ate: per.ate }, periodo: per };
  if (/\b(contas?|boletos?)\b/.test(t) && /\b(pagar|vencid|receber|abert|pendent)/.test(t)) return { tipo: 'ferramenta', nome: 'contas', args: { tipo: /\breceber\b/.test(t) ? 'receber' : 'pagar', situacao: /vencid/.test(t) ? 'vencidas' : 'abertas' } };
  if (/\b(estoque|acabando|em falta|repor|reposicao)\b/.test(t) || (/\btem\b/.test(t) && /\bquanto\b/.test(t) && prod && !/\b(gast|compr|pag)/.test(t))) return { tipo: 'ferramenta', nome: 'estoque', args: prod ? { produto: prod } : { so_baixo: true } };
  if (prod && /\b(preco|custo|custou|custa|quanto (esta|ta)|valor do|valor da)\b/.test(t) && !/\b(gastamos|gastei|gasto total)\b/.test(t)) return { tipo: 'ferramenta', nome: 'preco_produto', args: { produto: prod, ...(/\b(mes|semana|ano|desde|ultim\w*|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/.test(t) ? { de: per.de, ate: per.ate } : {}) }, periodo: per };
  if (pergunta && /\b(gast|compr|pag|custo|despesa)/.test(t)) {
    return { tipo: 'ferramenta', nome: 'consultar_gastos', args: { de: per.de, ate: per.ate, ...(cat && !prod ? { categoria: cat } : {}), ...(forn ? { fornecedor: forn } : {}), ...(prod ? { produto: prod } : {}), agrupar_por: !cat && !forn && !prod ? 'categoria' : 'nenhum' }, periodo: per };
  }

  // ---- registros ----
  // despesa fixa: "conta de luz de R$ 450 vence dia 20"
  const desp = t.match(/\b(luz|energia|agua|gas|internet|telefone|aluguel|salario|salarios|funcionario|funcionarios|manutencao|imposto|impostos|taxa)\b/);
  const vr = t.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais)?/g);
  if (desp && /\b(conta|paguei|pagar|vence|gastamos|despesa)\b/.test(t) && !/\b(comprei|compramos)\b/.test(t)) {
    const m = t.match(/r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)|(\d+(?:,\d{1,2})?)\s*reais/);
    if (m) {
      const cat = { luz: 'Energia', energia: 'Energia', agua: 'Água', gas: 'Gás', internet: 'Internet/Telefone', telefone: 'Internet/Telefone', aluguel: 'Aluguel', salario: 'Funcionários', salarios: 'Funcionários', funcionario: 'Funcionários', funcionarios: 'Funcionários', manutencao: 'Manutenção', imposto: 'Impostos', impostos: 'Impostos', taxa: 'Taxas de cartões' }[desp[1]];
      const p = pagamento(t, hoje) ?? null;
      const args = { descricao: `Conta de ${desp[1] === 'luz' ? 'luz' : desp[1]}`.replace('Conta de salarios', 'Salários'), categoria: cat, valor: valor(m[1] ?? m[2]), vencimento: p?.vencimento ?? hoje, pago: p ? p.pago : false };
      if (!p) return { tipo: 'pergunta', texto: 'Já pagou ou vai pagar depois?', pendente: { nome: 'registrar_despesa', args, falta: 'pagamento' } };
      return { tipo: 'ferramenta', nome: 'registrar_despesa', args };
    }
  }
  // compra: "comprei 15 kg de carne por R$ 32 o quilo no açougue, paguei no pix" / "gastamos R$ 280 com hortaliças"
  if (/\b(comprei|compramos|comprou|gastamos|gastei|gastou|paguei)\b/.test(t) && vr) {
    const ehGenerico = /\b(gastamos|gastei|gastou)\b.*\bcom\b/.test(t) && !/\b(\d+(?:[.,]\d+)?)\s*(kg|quilos?|unidades?|pacotes?|caixas?|litros?)\b/.test(t);
    const fornNome = forn ?? (() => { const m = t.match(/\b(?:no|na|do|da)\s+([a-z0-9 ]{3,40}?)(?:,|\.|\bpaguei|\bvou\b|\bpor\b|\ba vista|\bno pix|\bem dinheiro|$)/); if (!m) return null; const s = m[1].trim(); return /^(pix|dinheiro|cartao|debito|credito|boleto|quilo|kg)/.test(s) ? null : texto.slice(t.indexOf(s), t.indexOf(s) + s.length).trim(); })();
    let itens = [];
    if (ehGenerico) {
      const m = t.match(/r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)|(\d+(?:,\d{1,2})?)\s*reais/);
      const catG = cat ?? 'outros';
      const nomeG = { hortalicas: 'Hortaliças diversas', frutas: 'Frutas diversas', acougue: 'Carnes diversas', aves: 'Aves diversas', peixes: 'Peixes diversos', bebidas: 'Bebidas diversas', laticinios: 'Laticínios diversos', cereais: 'Cereais diversos', mercearia: 'Mercearia diversa', padaria: 'Padaria diversa', embalagens: 'Embalagens diversas', limpeza: 'Limpeza diversa' }[catG] ?? 'Compras diversas';
      if (m) itens = [{ produto: nomeG, valor_total: valor(m[1] ?? m[2]) }];
    } else {
      const q = t.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${RE_UN})\\b(?:\\s+de)?\\s+([a-z0-9 -]+?)(?=\\s+(?:por|a|ao|de r\\$|r\\$|no|na|do|da|custando|pagando|,)\\b|,|$)`));
      const unit = t.match(/(?:a|por|r\$)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais\s*)?(?:o|a|cada|por)\s*(?:quilo|kg|kilo|unidade|un|pacote|litro|caixa|fardo)/);
      const tot = t.match(/(?:por|total(?: de)?|deu|paguei|custou)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais)?(?!\s*(?:o|a|cada|por)\s*(?:quilo|kg|kilo|unidade|un|pacote|litro|caixa))/);
      if (q) {
        const qtd = valor(q[1]); const un = UNIDADES[q[2]];
        const nome = acharNome(q[3], ctx.produtos) ?? q[3].trim();
        const item = { produto: nome, quantidade: qtd, unidade: un };
        if (unit) item.valor_unitario = valor(unit[1]); else if (tot) item.valor_total = valor(tot[1]);
        if (item.valor_unitario || item.valor_total) itens = [item];
      }
    }
    if (!itens.length) return { tipo: 'pergunta', texto: 'Para registrar a compra, diga a quantidade, o produto e o valor. Ex.: "Comprei 15 kg de carne a R$ 32 o quilo no Açougue Ventura, paguei no PIX".', pendente: null };
    const p = pagamento(t, hoje) ?? (/\b(gastamos|gastei|paguei)\b/.test(t) ? { pago: true } : null);
    const args = { data: /\bontem\b/.test(t) ? somaDias(hoje, -1) : hoje, fornecedor: fornNome, itens, ...(p ?? {}), mercadoria_chegou: !ehGenerico && !/\b(vai chegar|vao entregar|amanha|ainda nao chegou)\b/.test(t) };
    if (!fornNome) return { tipo: 'pergunta', texto: 'De qual fornecedor foi a compra? (pode responder "não sei")', pendente: { nome: 'registrar_compra', args, falta: 'fornecedor' } };
    if (!p) return { tipo: 'pergunta', texto: 'Já pagou ou vai pagar depois?', pendente: { nome: 'registrar_compra', args, falta: 'pagamento' } };
    if (p.pago === false && !p.vencimento) return { tipo: 'pergunta', texto: 'Qual o vencimento? (ex.: dia 20)', pendente: { nome: 'registrar_compra', args, falta: 'vencimento' } };
    return { tipo: 'ferramenta', nome: 'registrar_compra', args };
  }
  if (pergunta && (cat || forn || prod)) return { tipo: 'ferramenta', nome: 'consultar_gastos', args: { de: per.de, ate: per.ate, ...(cat && !prod ? { categoria: cat } : {}), ...(forn ? { fornecedor: forn } : {}), ...(prod ? { produto: prod } : {}) }, periodo: per };
  return { tipo: 'ajuda' };
}
export { chaveProduto, chaveFornecedor };
