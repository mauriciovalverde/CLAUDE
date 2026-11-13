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
const norm = (t) => semAcento(String(t ?? '')).toLowerCase().replace(/[“”"!]/g, ' ').replace(/\.(?!\d)/g, ' ').replace(/\?/g, ' ? ').replace(/\s+/g, ' ').trim();
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

// ---- ajudantes de lançamento ----
const DESPESAS = [
  [/\b(conta de luz|energia|coelba|eletricidade)\b|\bluz\b/, 'Energia', 'Conta de luz'],
  [/\b(conta de agua|embasa)\b/, 'Água', 'Conta de água'],
  [/\b(gas|botijao)\b/, 'Gás', 'Gás'],
  [/\b(internet|telefone|celular|wifi)\b/, 'Internet/Telefone', 'Internet/telefone'],
  [/\baluguel\b/, 'Aluguel', 'Aluguel'],
  [/\b(vale|adiantamento)\b/, 'Vale a funcionário', 'Vale'],
  [/\b(salario|salarios|diaria|diarias|freela|freelancer|folha|pagamento d[oa] funcionari[oa])\b/, 'Funcionários', 'Funcionários'],
  [/\b(taxi|uber|99 pop|transporte|passagem|onibus|corrida|motoboy|frete|gasolina|combustivel|estacionamento)\b/, 'Transporte', 'Transporte'],
  [/\b(conserto|manutencao|reparo|encanador|eletricista|tecnico|pintura)\b/, 'Manutenção', 'Manutenção'],
  [/\b(equipamento|freezer|geladeira|fogao|liquidificador|microondas)\b/, 'Equipamentos', 'Equipamento'],
  [/\b(imposto|impostos|das|simples nacional|iptu|alvara)\b/, 'Impostos', 'Impostos'],
  [/\b(maquininha|taxa do cartao|taxa de cartao|taxas de cartao)\b/, 'Taxas de cartões', 'Taxa de cartão'],
  [/\b(contador|contabilidade|papelaria|xerox|propaganda|anuncio|marketing|impressao)\b/, 'Despesas administrativas', 'Despesa administrativa'],
  [/\b(despesa|despesas)\b/, 'Outras despesas', 'Despesa', true],
];
/** Valores em dinheiro da frase (ignora quantidades com unidade e datas). */
function dinheiros(t) {
  const limpo = t.replace(new RegExp(`\\b\\d+(?:[.,]\\d+)?\\s*(?:${RE_UN})\\b`, 'g'), ' ').replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ').replace(/\b(?:dia|vence(?:\s+dia)?|vencimento)\s+\d{1,2}\b/g, ' ').replace(/\b\d+\s*(?:x|vezes|parcelas?)\b/g, ' ');
  return [...limpo.matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g)].map((m) => valor(m[1])).filter((v) => v > 0);
}
const dataDe = (t, hoje) => (/\bontem\b/.test(t) ? somaDias(hoje, -1) : /\banteontem\b/.test(t) ? somaDias(hoje, -2) : hoje);
function fornecedorDe(t, texto, forn) {
  if (forn) return forn;
  const m = t.match(/\b(?:no|na|do|da|pelo|pela|com o|com a)\s+([a-z0-9 ]{3,40}?)(?=,|\.|\bpaguei|\bvou\b|\bpor\b|\ba vista|\bno pix|\bem dinheiro|\bno cartao|\bno debito|\bno credito|\bhoje|\bontem|$)/);
  if (!m) return null;
  const sx = m[1].trim();
  if (/^(pix|dinheiro|cartao|debito|credito|boleto|quilo|kg|caixa|valor|total|vista|prazo|feira)$/.test(sx) || /^(pix|dinheiro|cartao)\b/.test(sx)) return null;
  const i = t.indexOf(sx);
  return i >= 0 ? texto.slice(i, i + sx.length).trim() || sx : sx;
}
function descricaoDespesa(texto, padrao) {
  let d = String(texto).replace(/\b(paguei|pagamos|pagou|gastei|gastamos|gastou|dei|lanca|lancar|lance|registra|registrar|registre|anota|anotar|anote|uma|um)\b/gi, ' ')
    .replace(/r\$\s*\d[\d.,]*|\b\d+(?:[.,]\d{1,2})?\s*(?:reais|real|conto|contos)?\b/gi, ' ')
    .replace(/\b(no|em|via)\s+(pix|dinheiro|cartão|cartao|débito|debito|crédito|credito|especie|espécie)\b/gi, ' ').replace(/\b(hoje|ontem|já|ja|à vista|a vista)\b/gi, ' ')
    .replace(/\b(vence|vencimento)(\s+dia)?\b.*$/i, ' ').replace(/[,.;]+/g, ' ').replace(/\bde\s+(pra|para|com)\b/gi, '$1').replace(/\b(de|com)\s*$/i, '').replace(/\s+/g, ' ').trim().replace(/^(de|com|pra|para|a|o)\s+/i, '');
  if (d.length < 3) d = padrao;
  return d.charAt(0).toUpperCase() + d.slice(1, 80);
}
const STOP = /^(e|mais|tambem|comprei|compramos|comprou|compra|peguei|pegamos|trouxe|gastei|gastamos|gastou|paguei|pagamos|pagou|lanca|lancar|lance|registra|registrar|registre|anota|anotar|anote|hoje|ontem|de|a|o)$/;
/** Lê os itens da frase, separados por vírgula, "e", ";" ou quebra de linha. */
function lerItens(t, ctx) {
  const itens = [];
  const partes = t.split(/\s*(?:,(?!\d)|;|\n|\+|\be\b|\bmais\b)\s*/).map((p) => p.trim()).filter(Boolean);
  for (let seg of partes) {
    seg = seg.split(' ').filter((w, k, arr) => !(k < 3 && STOP.test(w) && arr.length > 1)).join(' ');
    seg = seg.replace(/\b(?:no|na|do|da|pelo|pela|em)\s+(?:pix|dinheiro|cartao|debito|credito|boleto|especie)\b.*$/, '').replace(/\b(?:paguei|vou pagar|a vista|a prazo|vence|vencimento)\b.*$/, '').trim();
    if (!seg) continue;
    let unit = null, total = null, qtd = null, un = null, nome = null;
    const mu = seg.match(new RegExp(`(?:a|por|de)?\\s*(?:r\\$\\s*)?(\\d+(?:[.,]\\d{1,2})?)\\s*(?:reais\\s*)?(?:o|a|cada|por|\\/)\\s*(${RE_UN})\\b`));
    if (mu) { unit = valor(mu[1]); seg = seg.replace(mu[0], ' ').trim(); }
    const mc = !mu && seg.match(/(?:a|por|de)?\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais\s*)?cada\b/); // "a 6,50 cada"
    if (mc) { unit = valor(mc[1]); seg = seg.replace(mc[0], ' ').trim(); }
    const mq = seg.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${RE_UN})\\b(?:\\s+de)?\\s+(?!(?:no|na|do|da|em|pra|para|com|por|a)\\b)([a-z][a-z0-9 -]*?)(?=\\s+(?:por|a|ao|r\\$|custando|pagando|reais|no|na|do|da|\\d)\\b|\\s+\\d|$)`));
    const mq2 = !mq && seg.match(new RegExp(`^([a-z][a-z -]*?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${RE_UN})\\b`));
    if (mq) { qtd = valor(mq[1]); un = UNIDADES[mq[2]]; nome = mq[3]; seg = seg.replace(mq[0], ' '); }
    else if (mq2) { nome = mq2[1]; qtd = valor(mq2[2]); un = UNIDADES[mq2[3]]; seg = seg.replace(mq2[0], ' '); }
    else {
      const m3 = seg.match(/^(\d+)\s+(?!(?:de|no|na|do|da|em|pra|para|com|reais|real)\b)([a-z][a-z -]*?)(?=\s+(?:por|a|r\$|\d)|$)/); // "3 alface 6 reais"
      if (m3 && Number(m3[1]) < 100) { qtd = Number(m3[1]); un = 'un'; nome = m3[2]; seg = seg.replace(m3[0], ' '); }
    }
    seg = seg.replace(/\b(?:no|na|do|da|pelo|pela)\s+[a-z0-9 ]+$/, ' ');
    const vs = [...seg.matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|conto|contos)?/g)];
    if (vs.length) { total = valor(vs[vs.length - 1][1]); seg = seg.replace(vs[vs.length - 1][0], ' '); }
    if (!nome) nome = seg.replace(/\b(de|por|a|ao|o|com|custou|custando|pagando|deu|total|r\$|reais)\b/g, ' ').replace(/\s+/g, ' ').trim();
    nome = String(nome ?? '').replace(/\b(de|por|a|o)$/, '').trim();
    if (!nome || nome.length < 2 || !/[a-z]{2}/.test(nome) || /^(pix|dinheiro|cartao|debito|credito|boleto|hoje|ontem|vista|prazo)$/.test(nome)) continue;
    if (DESPESAS.some(([re]) => re.test(nome)) && qtd == null) continue;
    if (total == null && unit == null && qtd == null) continue;
    const item = { produto: acharNome(nome, ctx.produtos) ?? nome };
    if (qtd != null) { item.quantidade = qtd; item.unidade = un ?? 'un'; }
    if (unit != null) item.valor_unitario = unit; else if (total != null) item.valor_total = total;
    itens.push(item);
  }
  return itens;
}
function concluirCompra(args, t, hoje) {
  if (!args.fornecedor) return { tipo: 'pergunta', texto: 'De qual fornecedor foi a compra? (pode responder "não sei")', pendente: { nome: 'registrar_compra', args, falta: 'fornecedor' } };
  if (args.pago === undefined) return { tipo: 'pergunta', texto: 'Já pagou ou vai pagar depois?', pendente: { nome: 'registrar_compra', args, falta: 'pagamento' } };
  if (args.pago === false && !args.vencimento) return { tipo: 'pergunta', texto: 'Qual o vencimento? (ex.: dia 20)', pendente: { nome: 'registrar_compra', args, falta: 'vencimento' } };
  return { tipo: 'ferramenta', nome: 'registrar_compra', args };
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

  // ---- registros (qualquer ordem: vários itens, despesas, perguntas quando faltar algo) ----
  if (ctx.pendente?.falta === 'tipo') {
    if (/\b(compra|mercadoria|produto|comprei)\b/.test(t)) return interpretar(`comprei ${ctx.pendente.texto}`, { ...ctx, pendente: null, forcar: 'compra' });
    if (/\b(despesa|conta|gasto|pagamento)\b/.test(t)) return interpretar(`despesa ${ctx.pendente.texto}`, { ...ctx, pendente: null, forcar: 'despesa' });
  }
  if (ctx.pendente?.falta === 'precos') {
    const itens = ctx.pendente.args.itens.map((it) => ({ ...it }));
    const sozinho = itens.length === 1 ? dinheiros(t)[0] : null;
    if (sozinho != null) itens[0].valor_total = sozinho;
    else for (const it of itens) {
      const k = norm(it.produto).split(' ')[0];
      const m = t.match(new RegExp(`${k}[a-z ]*?(?:r\\$\\s*)?(\\d+(?:[.,]\\d{1,2})?)`));
      if (m) it.valor_total = valor(m[1]);
    }
    const faltam = itens.filter((it) => it.valor_total == null && it.valor_unitario == null);
    if (faltam.length) return { tipo: 'pergunta', texto: `Ainda falta o valor de: ${faltam.map((f) => f.produto).join(', ')}.`, pendente: { ...ctx.pendente, args: { ...ctx.pendente.args, itens } } };
    return concluirCompra({ ...ctx.pendente.args, itens }, t, hoje);
  }

  const despesa = DESPESAS.find(([re]) => re.test(t)) ?? (ctx.forcar === 'despesa' ? [null, 'Outras despesas', 'Despesa', true] : undefined);
  const temValor = dinheiros(t).length > 0;
  const verbo = /\b(comprei|compramos|comprou|compra|peguei|pegamos|trouxe|trouxeram|gastei|gastamos|gastou|paguei|pagamos|pagou|lanca|lancar|lance|registra|registrar|registre|anota|anotar|anote|despesa|conta)\b/.test(t);

  // compra genérica por categoria: "gastamos R$ 280 com hortaliças"
  const ehGenerico = /\b(gastamos|gastei|gastou)\b.*\bcom\b/.test(t) && cat && !new RegExp(`\\d\\s*(${RE_UN})\\b`).test(t);
  if (ehGenerico && temValor) {
    const nomeG = { hortalicas: 'Hortaliças diversas', frutas: 'Frutas diversas', acougue: 'Carnes diversas', aves: 'Aves diversas', peixes: 'Peixes diversos', bebidas: 'Bebidas diversas', laticinios: 'Laticínios diversos', cereais: 'Cereais diversos', mercearia: 'Mercearia diversa', padaria: 'Padaria diversa', embalagens: 'Embalagens diversas', limpeza: 'Material de limpeza' }[cat] ?? 'Compras diversas';
    const p = pagamento(t, hoje) ?? { pago: true };
    return concluirCompra({ data: dataDe(t, hoje), fornecedor: fornecedorDe(t, texto, forn), itens: [{ produto: nomeG, valor_total: dinheiros(t)[0] }], ...p, mercadoria_chegou: false }, t, hoje);
  }

  // itens: "2 kg de tomate 10 reais, 3 kg cebola a 5 o quilo e pão 12" (qualquer ordem)
  const itens = verbo || temValor ? lerItens(t, ctx) : [];
  if (!itens.length && ctx.forcar === 'compra' && temValor) itens.push({ produto: cat ? 'Compras diversas' : 'Compras diversas', valor_total: dinheiros(t)[0] });
  const comQtd = itens.some((i) => i.quantidade != null);

  // despesa: "paguei 30 de táxi pra Adriana", "conta de luz 450 vence dia 20", "vale de 100 pra Maria"
  const qtdComUnidade = new RegExp(`\\d\\s*(${RE_UN})\\b`).test(t);
  const ignoraCat = /\bconta de\b/.test(t) || despesa?.[1] === 'Água';
  if (despesa && temValor && !qtdComUnidade && (!cat || ignoraCat) && !(prod && !despesa[3])) {
    const [, categoria, nomeDesp] = despesa;
    const p = pagamento(t, hoje) ?? (/\b(paguei|pagamos|pagou|gastei|gastamos|gastou|dei)\b/.test(t) ? { pago: true } : null);
    const descricao = descricaoDespesa(texto, nomeDesp);
    const args = { descricao, categoria, valor: dinheiros(t)[0], vencimento: p?.vencimento ?? dataDe(t, hoje), pago: p ? p.pago : false, ...(forn ? { fornecedor: forn } : {}) };
    if (!p) return { tipo: 'pergunta', texto: 'Já pagou ou vai pagar depois?', pendente: { nome: 'registrar_despesa', args, falta: 'pagamento' } };
    if (p.pago === false && !p.vencimento) return { tipo: 'pergunta', texto: 'Qual o vencimento? (ex.: dia 20)', pendente: { nome: 'registrar_despesa', args, falta: 'vencimento' } };
    return { tipo: 'ferramenta', nome: 'registrar_despesa', args };
  }

  if (itens.length) {
    // um valor só para vários itens sem preço: pergunta o de cada um
    const semPreco = itens.filter((i) => i.valor_total == null && i.valor_unitario == null);
    const soltos = dinheiros(t.replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|quilos?|kilos?|g|gramas|un|unidades?|pacotes?|pct|caixas?|cx|litros?|l|fardos?|duzias?|macos?|bandejas?)\b/g, ' '));
    if (semPreco.length === 1 && itens.length === 1 && soltos.length) semPreco[0].valor_total = soltos[soltos.length - 1];
    const args = { data: dataDe(t, hoje), fornecedor: fornecedorDe(t, texto, forn), itens, ...(pagamento(t, hoje) ?? (/\b(paguei|pagamos|pagou|gastei|gastamos|gastou)\b/.test(t) ? { pago: true } : {})), mercadoria_chegou: !/\b(vai chegar|vao entregar|amanha|ainda nao chegou)\b/.test(t) };
    const faltam = itens.filter((i) => i.valor_total == null && i.valor_unitario == null);
    if (faltam.length) return { tipo: 'pergunta', texto: itens.length === 1 ? `Qual foi o valor de ${faltam[0].produto}?` : `Qual o valor de cada item? (ex.: ${faltam.slice(0, 2).map((f) => `${f.produto.toLowerCase()} 20`).join(', ')})`, pendente: { nome: 'registrar_compra', args, falta: 'precos' } };
    return concluirCompra(args, t, hoje);
  }

  // tem valor, mas não deu para saber o que é: pergunta (em vez de ignorar)
  if (temValor && verbo) return { tipo: 'pergunta', texto: 'Isso foi uma COMPRA de mercadoria ou uma DESPESA (táxi, vale, conta, conserto…)? Responda "compra" ou "despesa".', pendente: { falta: 'tipo', texto } };
  if (pergunta && (cat || forn || prod)) return { tipo: 'ferramenta', nome: 'consultar_gastos', args: { de: per.de, ate: per.ate, ...(cat && !prod ? { categoria: cat } : {}), ...(forn ? { fornecedor: forn } : {}), ...(prod ? { produto: prod } : {}) }, periodo: per };
  return { tipo: 'ajuda' };
}
export { chaveProduto, chaveFornecedor };
