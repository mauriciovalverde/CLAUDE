// Números do restaurante a partir dos registros reais (nada fictício). Usado por Dashboard, Comparativo, Relatórios e IA.
import { supabase } from './supabase';
import { q } from '../components/ui';
// @ts-ignore módulo JS testado
import { nomeCategoria } from './catalogo.js';

export async function todas(tabela: string, colunas: string, filtro: (x: any) => any) {
  const out: any[] = [];
  for (let de = 0; ; de += 1000) {
    const lote = await q<any[]>(filtro(supabase.from(tabela).select(colunas)).range(de, de + 999));
    out.push(...lote); if (lote.length < 1000) break;
  }
  return out;
}

export async function carregarPeriodo(de: string, ate: string) {
  const [itens, vendas, contas, compras] = await Promise.all([
    todas('rest_v_itens', 'compra_id,data,fornecedor,fornecedor_id,produto,produto_id,categoria,quantidade,unidade,valor_unitario,valor_total', (x) => x.gte('data', de).lte('data', ate).order('data')),
    todas('rest_vendas', '*', (x) => x.gte('data', de).lte('data', ate).order('data')),
    todas('rest_contas', 'tipo,categoria,valor,status,vencimento,pago_em,emissao,origem,descricao,fornecedor_id', (x) => x.not('status', 'in', '(cancelado,historico)').or(`and(emissao.gte.${de},emissao.lte.${ate}),and(vencimento.gte.${de},vencimento.lte.${ate}),and(pago_em.gte.${de},pago_em.lte.${ate})`)),
    todas('rest_compras', 'id,data,total,desconto,fornecedor_id,status', (x) => x.gte('data', de).lte('data', ate).not('status', 'in', '(cancelada,historico)')),
  ]);
  return { de, ate, itens, vendas, contas, compras };
}
export type Periodo = Awaited<ReturnType<typeof carregarPeriodo>>;

const r2 = (n: number) => Math.round(n * 100) / 100;
const CMV = new Set(['hortalicas', 'frutas', 'acougue', 'aves', 'peixes', 'cereais', 'mercearia', 'laticinios', 'bebidas', 'padaria']);

/** Indicadores do período. Despesas por COMPETÊNCIA (data de emissão/compra), separadas de pagamentos feitos e de compromissos futuros. */
export function indicadores(p: Periodo) {
  const dentro = (d?: string | null) => !!d && d >= p.de && d <= p.ate;
  const bruto = p.vendas.reduce((t, v) => t + +v.bruto, 0);
  const liquido = p.vendas.reduce((t, v) => t + +v.liquido, 0);
  const qtdVendas = p.vendas.reduce((t, v) => t + (v.qtd_vendas ?? 0), 0);
  const compras = p.compras.reduce((t, c) => t + +c.total, 0);
  // custo de mercadorias: compras de insumos de comida e bebida no período (sem embalagens/limpeza), descontos rateados
  const brutoItens = p.itens.reduce((t, i) => t + +i.valor_total, 0);
  const fatorDesc = brutoItens > 0 ? compras / brutoItens : 1;
  const cmv = r2(p.itens.filter((i) => CMV.has(i.categoria)).reduce((t, i) => t + +i.valor_total, 0) * fatorDesc);
  const despesasLancadas = p.contas.filter((c) => c.tipo === 'pagar' && dentro(c.emissao ?? c.vencimento)).reduce((t, c) => t + +c.valor, 0);
  const despesasPagas = p.contas.filter((c) => c.tipo === 'pagar' && c.status === 'pago' && dentro(c.pago_em)).reduce((t, c) => t + +c.valor, 0);
  const compromissos = p.contas.filter((c) => c.tipo === 'pagar' && c.status === 'pendente').reduce((t, c) => t + +c.valor, 0);
  const outrasReceitas = p.contas.filter((c) => c.tipo === 'receber' && dentro(c.emissao ?? c.vencimento)).reduce((t, c) => t + +c.valor, 0);
  return {
    bruto: r2(bruto), liquido: r2(liquido), qtdVendas, ticket: qtdVendas ? r2(liquido / qtdVendas) : null, compras: r2(compras), cmv,
    margemBruta: r2(liquido - cmv), margemPct: liquido ? r2(((liquido - cmv) / liquido) * 100) : null,
    despesasLancadas: r2(despesasLancadas), despesasPagas: r2(despesasPagas), compromissos: r2(compromissos), outrasReceitas: r2(outrasReceitas),
    resultado: r2(liquido + outrasReceitas - despesasLancadas),
  };
}

export function agrupar<T>(lista: T[], chave: (x: T) => string, valor: (x: T) => number) {
  const m = new Map<string, number>();
  for (const x of lista) m.set(chave(x), (m.get(chave(x)) ?? 0) + valor(x));
  return [...m.entries()].map(([nome, total]) => ({ nome, total: r2(total) })).sort((a, b) => b.total - a.total);
}
export const porCategoria = (p: Periodo) => agrupar(p.itens, (i) => nomeCategoria(i.categoria), (i) => +i.valor_total);
export const porFornecedor = (p: Periodo) => agrupar(p.itens, (i) => i.fornecedor ?? '—', (i) => +i.valor_total);
export const despesasPorCategoria = (p: Periodo) => agrupar(p.contas.filter((c) => c.tipo === 'pagar' && (c.emissao ?? c.vencimento) >= p.de && (c.emissao ?? c.vencimento) <= p.ate), (c) => c.categoria, (c) => +c.valor);

/** Série mensal (AAAA-MM) com vendas, compras e despesas. */
export function serieMensal(p: Periodo) {
  const m: Record<string, { mes: string; vendas: number; compras: number; despesas: number; cmv: number }> = {};
  const g = (d: string) => (m[d.slice(0, 7)] ??= { mes: d.slice(0, 7), vendas: 0, compras: 0, despesas: 0, cmv: 0 });
  for (const v of p.vendas) g(v.data).vendas += +v.liquido;
  for (const c of p.compras) g(c.data).compras += +c.total;
  for (const i of p.itens) if (CMV.has(i.categoria)) g(i.data).cmv += +i.valor_total;
  for (const c of p.contas) { const d = c.emissao ?? c.vencimento; if (c.tipo === 'pagar' && d >= p.de && d <= p.ate) g(d).despesas += +c.valor; }
  return Object.values(m).sort((a, b) => a.mes.localeCompare(b.mes)).map((x) => ({ ...x, vendas: r2(x.vendas), compras: r2(x.compras), despesas: r2(x.despesas), cmv: r2(x.cmv) }));
}

/** Variação de preço por produto entre dois períodos (preço unitário médio ponderado). */
export function variacaoPrecos(itensA: any[], itensB: any[]) {
  const media = (l: any[]) => { const m = new Map<string, { nome: string; cat: string; q: number; v: number; un: string }>(); for (const i of l) { if (!i.produto_id || !i.valor_unitario || !i.quantidade) continue; const x = m.get(i.produto_id) ?? { nome: i.produto, cat: i.categoria, q: 0, v: 0, un: i.unidade }; x.q += +i.quantidade; x.v += +i.valor_unitario * +i.quantidade; m.set(i.produto_id, x); } return m; };
  const a = media(itensA), b = media(itensB);
  const out: { produto: string; categoria: string; antes: number; depois: number; pct: number; unidade: string }[] = [];
  for (const [id, x] of b) { const y = a.get(id); if (!y || !y.q || !x.q) continue; const antes = y.v / y.q, depois = x.v / x.q; out.push({ produto: x.nome, categoria: nomeCategoria(x.cat), antes: r2(antes), depois: r2(depois), pct: r2(((depois - antes) / antes) * 100), unidade: x.un }); }
  return out.sort((p1, p2) => p2.pct - p1.pct);
}
export const variacao = (a: number, b: number) => (a ? r2(((b - a) / Math.abs(a)) * 100) : null);
