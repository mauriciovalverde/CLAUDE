// Assistente embutido: entende a frase (interpretar.js), executa a ferramenta com os dados reais e responde em português.
import { supabase } from '../supabase';
import { executarFerramenta } from './executor';
// @ts-ignore módulo JS testado
import { interpretar } from './interpretar.js';
// @ts-ignore
import { nomeCategoria } from '../catalogo.js';
import { brl, dataBR, hoje, qtd } from '../fmt';

let cache: { produtos: string[]; fornecedores: string[]; em: number } | null = null;
async function nomes() {
  if (cache && Date.now() - cache.em < 60_000) return cache;
  const [p, f] = await Promise.all([supabase.from('rest_produtos').select('nome').neq('status', 'inativo'), supabase.from('rest_fornecedores').select('nome')]);
  cache = { produtos: (p.data ?? []).map((x) => x.nome), fornecedores: (f.data ?? []).map((x) => x.nome), em: Date.now() };
  return cache;
}

const pct = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`);
const per = (de?: string, ate?: string) => (de && ate ? (de === ate ? dataBR(de) : `${dataBR(de)} a ${dataBR(ate)}`) : '');

export const AJUDA = `Posso registrar e consultar. Escreva do seu jeito; se faltar algo, eu pergunto. Exemplos:
• Comprei 15 kg de carne moída a R$ 32 o quilo no Açougue Ventura Master, paguei no PIX
• 2 kg tomate 10 reais, 3 kg cebola a 5 o quilo e 2 alface 6 reais na Hortfrut, pix
• Paguei 30 de táxi pra Adriana · Vale de 100 pra Maria · Gasolina 50 reais
• Hoje gastamos R$ 280 com hortaliças na Hortfrut
• O fornecedor Centro Sul entregou a compra de hoje
• Conta de luz de R$ 450 vence dia 20
• Quanto gastamos com carnes em setembro?
• Quanto compramos no Centro Sul em outubro?
• Qual foi o custo da batata nos últimos três meses?
• Qual foi nosso faturamento ontem?
• Compare outubro e novembro
• Qual produto teve maior aumento de preço?
• Qual fornecedor recebeu mais pagamentos?
• Quais contas estão vencidas? · O que está acabando no estoque?`;

export function responder(nome: string, a: any, s: any): string {
  if (s?.ok === false) {
    if (s.erro === 'POSSIVEL_DUPLICIDADE') return `⚠️ ${s.mensagem} Responda "sim" para registrar mesmo assim.`;
    return `❌ ${s.mensagem ?? 'Não deu certo.'}`;
  }
  switch (nome) {
    case 'registrar_compra': return `✅ Compra registrada (#${s.compra_numero})\nFornecedor: ${s.fornecedor} (${s.fornecedor_novo ? 'novo cadastro' : 'já cadastrado'})\n${s.itens.join('\n')}\nTotal: ${brl(s.total)} · ${a.pago ? 'Pago' : `A pagar até ${dataBR(a.vencimento)}`}\nEstoque: ${a.mercadoria_chegou ? 'entrada feita' : 'aguardando chegada'}`;
    case 'registrar_despesa': return `✅ Despesa lançada (#${s.conta_numero}): ${a.descricao} — ${brl(a.valor)} · ${a.pago ? 'paga' : `vence ${dataBR(a.vencimento)}`}`;
    case 'marcar_compra_recebida': return `✅ Compra #${s.compra_numero} recebida: ${s.entradas_no_estoque} item(ns) entraram no estoque.`;
    case 'consultar_gastos': {
      const filtro = [a.categoria && nomeCategoria(a.categoria), a.fornecedor, a.produto].filter(Boolean).join(' · ');
      let r = `💰 ${filtro ? filtro + ' — ' : 'Compras — '}${per(a.de, a.ate)}\nTotal: ${brl(s.total)} (${s.itens_encontrados} itens)`;
      if (s.quantidade_somada) r += `\nQuantidade: ${s.quantidade_somada}`;
      if (s.agrupado?.length) r += '\n' + s.agrupado.slice(0, 8).map((g: any) => `• ${g.nome}: ${brl(g.total)}`).join('\n');
      if (s.aviso) r += `\n${s.aviso}`;
      return r;
    }
    case 'faturamento': return s.aviso ? `📊 ${per(a.de, a.ate)}: ${s.aviso}` : `📊 Faturamento ${per(a.de, a.ate)}\nLíquido: ${brl(s.faturamento_liquido)} (bruto ${brl(s.faturamento_bruto)})\nPratos vendidos: ${s.vendas || '—'}${s.ticket_medio ? ` · ticket médio por prato ${brl(s.ticket_medio)}` : ''}`;
    case 'comparar_periodos': {
      const l = (t: string, x: any) => `• ${t}: ${brl(x.a ?? 0)} → ${brl(x.b ?? 0)} (${pct(x.variacao_pct)})`;
      return `📈 ${per(a.a_de, a.a_ate)} × ${per(a.b_de, a.b_ate)}\n${l('Faturamento', s.faturamento)}\n${l('Despesas', s.despesas)}\n${l('Compras', s.compras)}\n${l('Custo de mercadorias', s.custo_mercadorias)}\n${l('Resultado estimado', s.resultado)}` +
        (s.compras_por_categoria?.length ? '\nPor categoria:\n' + s.compras_por_categoria.sort((x: any, y: any) => y.b - x.b).slice(0, 6).map((c: any) => `  ${c.categoria}: ${brl(c.a)} → ${brl(c.b)} (${pct(c.variacao_pct)})`).join('\n') : '');
    }
    case 'preco_produto': return `🏷️ ${s.produtos.join(', ')} (por ${s.unidade})\nPrimeiro: ${brl(s.primeiro.preco)} em ${dataBR(s.primeiro.data)}\nÚltimo: ${brl(s.ultimo.preco)} em ${dataBR(s.ultimo.data)} (${pct(s.variacao_pct)})\nTotal gasto: ${brl(s.total_gasto)}\n` + s.por_fornecedor.map((f: any) => `• ${f.fornecedor}: último ${brl(f.ultimo)} (menor ${brl(f.menor)}, maior ${brl(f.maior)})`).join('\n');
    case 'maiores_aumentos': { const d = (x: string) => x.split(' a ').map(dataBR).join(' a '); return `📈 Maiores aumentos de preço (${d(s.a)} × ${d(s.b)}):\n` + (s.maiores_aumentos.length ? s.maiores_aumentos.slice(0, 8).map((p: any) => `• ${p.produto}: ${brl(p.antes)} → ${brl(p.depois)} (${pct(p.pct)})${p.pct > 200 ? ' ⚠️ variação muito alta: confira se a unidade foi a mesma' : ''}`).join('\n') : 'Sem produtos comprados nos dois períodos.'); }
    case 'pagamentos_por_fornecedor': return `🏆 Fornecedores por ${s.criterio}:\n` + s.ranking.slice(0, 8).map((f: any, k: number) => `${k + 1}. ${f.nome}: ${brl(f.total)}`).join('\n');
    case 'contas': return `📋 ${s.quantidade} conta(s) — total ${brl(s.total)}` + (s.contas?.length ? '\n' + s.contas.slice(0, 10).map((c: any) => `• ${c.descricao}${c.fornecedor ? ` (${c.fornecedor})` : ''}: ${brl(c.valor)} · vence ${dataBR(c.vencimento)}`).join('\n') : '');
    case 'estoque': return s.produtos ? s.produtos.map((p: any) => `📦 ${p.nome}: ${qtd(p.saldo)} ${p.unidade}${p.minimo ? ` (mínimo ${qtd(p.minimo)})` : ''}`).join('\n') || 'Produto não encontrado.' : s.abaixo_do_minimo.length ? '⚠️ Abaixo do mínimo:\n' + s.abaixo_do_minimo.map((p: any) => `• ${p.nome}: ${qtd(p.saldo)} de ${qtd(p.minimo)} ${p.unidade}`).join('\n') : '👍 Nenhum produto abaixo do mínimo (defina o mínimo no Estoque).';
  }
  return JSON.stringify(s);
}

/** Uma mensagem para o assistente embutido. `pendente` guarda a pergunta em aberto (ex.: "já pagou?"). */
export async function conversarLocal(texto: string, pendente: any) {
  const n = await nomes();
  const r = interpretar(texto, { produtos: n.produtos, fornecedores: n.fornecedores, hoje: hoje(), pendente });
  if (r.tipo === 'ajuda') return { resposta: `Não entendi bem. ${AJUDA}`, ferramentas: [] as any[], pendente: null };
  if (r.tipo === 'pergunta') return { resposta: r.texto, ferramentas: [] as any[], pendente: r.pendente };
  const saida = await executarFerramenta(r.nome, r.args).catch((e: any) => ({ ok: false, mensagem: String(e?.message ?? e) }));
  if (/^registrar|^marcar/.test(r.nome) && saida?.ok) cache = null;
  const novoPendente = saida?.erro === 'POSSIVEL_DUPLICIDADE' ? { nome: r.nome, args: r.args, falta: 'confirmar_duplicada' } : null;
  return { resposta: responder(r.nome, r.args, saida), ferramentas: [{ nome: r.nome, entrada: r.args, saida, ok: saida?.ok !== false }], pendente: novoPendente };
}
