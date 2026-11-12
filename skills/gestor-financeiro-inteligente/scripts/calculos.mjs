// Cálculos financeiros de referência do GESTOR FINANCEIRO INTELIGENTE.
// Fonte única no front-end (copie para src/lib/calculos.ts). O banco faz as mesmas contas em
// calcular_emprestimo / taxa_mensal_equivalente (schema.sql); os testes garantem que batem.
// Todos os valores em reais; arredondamento bancário simples para 2 casas.

export const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Juros simples: M = P·(1 + i·n). Composto: M = P·(1 + i)^n. Taxa em % por período. */
export function calcularEmprestimo({ principal, taxaPct, modalidade = 'simples', periodos }) {
  if (!(principal > 0)) throw new Error('principal deve ser > 0');
  if (!(periodos > 0)) throw new Error('periodos deve ser > 0');
  const i = taxaPct / 100;
  const total = modalidade === 'composto' ? principal * Math.pow(1 + i, periodos) : principal * (1 + i * periodos);
  return { juros: r2(total - principal), total: r2(total) };
}

/** Converte a taxa para mensal equivalente, para comparar com o limite legal configurado. */
export function taxaMensalEquivalente({ taxaPct, periodicidade, modalidade = 'simples', dias = 30 }) {
  const i = taxaPct / 100;
  const comp = modalidade === 'composto';
  let m;
  switch (periodicidade) {
    case 'mensal': m = i; break;
    case 'diaria': m = comp ? Math.pow(1 + i, 30) - 1 : i * 30; break;
    case 'semanal': m = comp ? Math.pow(1 + i, 30 / 7) - 1 : (i * 30) / 7; break;
    case 'anual': m = comp ? Math.pow(1 + i, 1 / 12) - 1 : i / 12; break;
    case 'periodo_total': m = (i / Math.max(dias, 1)) * 30; break;
    default: throw new Error('periodicidade inválida: ' + periodicidade);
  }
  return Math.round(m * 100 * 10000) / 10000;
}

/** Parcelas iguais; juros distribuídos proporcionalmente; a última absorve o arredondamento. */
export function gerarParcelas({ total, juros, parcelas = 1, vencimentoFinal }) {
  const out = [];
  let acum = 0, acumJ = 0;
  for (let k = 1; k <= parcelas; k++) {
    const valor = k < parcelas ? r2(total / parcelas) : r2(total - acum);
    const valorJuros = k < parcelas ? r2(juros / parcelas) : r2(juros - acumJ);
    acum = r2(acum + valor); acumJ = r2(acumJ + valorJuros);
    out.push({ parcela: k, valor, valorJuros, vencimento: parcelas === 1 ? vencimentoFinal : addMeses(vencimentoFinal, k - parcelas) });
  }
  return out;
}

/** Imputação do pagamento: primeiro juros, depois principal (Código Civil, art. 354). */
export function alocarPagamento({ valor, saldo, jurosEmAberto }) {
  if (valor > r2(saldo + 0.009)) throw new Error(`VALOR_ACIMA_DO_SALDO: saldo ${saldo}`);
  const juros = r2(Math.min(valor, Math.max(jurosEmAberto, 0)));
  const principal = r2(valor - juros);
  const saldoRestante = r2(saldo - valor);
  return { juros, principal, saldoRestante, status: saldoRestante <= 0 ? 'pago' : 'parcial' };
}

/** Indicadores de venda. Faturamento ≠ lucro: lucro bruto = faturamento − custo da mercadoria. */
export function indicadoresVenda(vendas) {
  const faturamento = r2(vendas.reduce((s, v) => s + v.total, 0));
  const comCusto = vendas.filter((v) => v.custo != null);
  const cmv = r2(comCusto.reduce((s, v) => s + v.custo, 0));
  const fatComCusto = r2(comCusto.reduce((s, v) => s + v.total, 0));
  const lucroBruto = r2(fatComCusto - cmv);
  return {
    faturamento, qtdVendas: vendas.length, cmv, lucroBruto,
    margemPct: fatComCusto > 0 ? r2((lucroBruto / fatComCusto) * 100) : null,
    ticketMedio: vendas.length ? r2(faturamento / vendas.length) : 0,
    vendasSemCusto: vendas.length - comCusto.length,
  };
}

/** Crescimento percentual. Ex.: 5.000 → 6.500 = 30%. Retorna null quando a base é zero. */
export function crescimentoPct(anterior, atual) {
  if (!anterior) return null;
  return r2(((atual - anterior) / anterior) * 100);
}

// ----------------------------------------------------------------- datas (fuso local do usuário)
const MESES = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const iso = (d) => d.toISOString().slice(0, 10);
const D = (s) => new Date(s + 'T12:00:00Z');

export function addDias(dataIso, n) { const d = D(dataIso); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
export function addMeses(dataIso, n) {
  const d = D(dataIso); const dia = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const ult = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ult)); return iso(d);
}

/**
 * Resolve datas ditas em português relativas a "hoje" (AAAA-MM-DD).
 * "dia 20" → próximo dia 20 (este mês se ainda não passou, senão o próximo);
 * "14 de dezembro" → próximo 14/12; "em 30 dias" → hoje+30; "daqui a 2 meses"; "amanhã"; "14/12" e "14/12/2027".
 * Retorna null quando não reconhece: a IA deve PERGUNTAR, nunca chutar.
 */
export function resolverData(texto, hoje) {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let m;
  if (/\bhoje\b/.test(t)) return hoje;
  if (/\bamanha\b/.test(t)) return addDias(hoje, 1);
  if ((m = t.match(/(?:em|daqui a|daqui)\s+(\d+)\s+dias?/))) return addDias(hoje, +m[1]);
  if ((m = t.match(/(?:em|daqui a|daqui)\s+(\d+)\s+(?:mes|meses)/))) return addMeses(hoje, +m[1]);
  if ((m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/))) {
    const dia = +m[1], mes = +m[2]; let ano = m[3] ? +m[3] : null;
    if (ano && ano < 100) ano += 2000;
    return proximaOcorrencia(hoje, dia, mes, ano);
  }
  if ((m = t.match(/(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/))) {
    const mes = MESES.indexOf(m[2]) + 1;
    if (mes > 0) return proximaOcorrencia(hoje, +m[1], mes, m[3] ? +m[3] : null);
  }
  if ((m = t.match(/\bdia\s+(\d{1,2})\b/))) {
    const h = D(hoje); const dia = +m[1];
    let cand = iso(new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), dia)));
    if (cand < hoje) cand = iso(new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() + 1, dia)));
    return cand;
  }
  return null;
}
function proximaOcorrencia(hoje, dia, mes, ano) {
  const h = D(hoje);
  if (ano) return iso(new Date(Date.UTC(ano, mes - 1, dia)));
  let cand = iso(new Date(Date.UTC(h.getUTCFullYear(), mes - 1, dia)));
  if (cand < hoje) cand = iso(new Date(Date.UTC(h.getUTCFullYear() + 1, mes - 1, dia)));
  return cand;
}

// ----------------------------------------------------------------- formatos
export function normalizarTelefone(t) {
  let d = String(t ?? '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d || null;
}
export const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Título do evento no Google Agenda. Ex.: "COBRAR VALVERDE - R$ 150 - VENDA TZ" */
export function tituloEvento({ tipo, origem, nome, valor, descricao }) {
  const verbo = tipo === 'pagar' ? 'PAGAR' : origem === 'emprestimo' ? 'RECEBER' : 'COBRAR';
  const v = 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(valor) ? 0 : 2, maximumFractionDigits: 2 });
  return [verbo + (nome ? ' ' + nome.toUpperCase() : ''), v, descricao?.toUpperCase()].filter(Boolean).join(' - ');
}
