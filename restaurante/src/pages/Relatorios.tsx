import { useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useEu } from '../lib/sessao';
import { agrupar, carregarPeriodo, despesasPorCategoria, indicadores, porCategoria, porFornecedor, serieMensal, todas, variacao, variacaoPrecos } from '../lib/analise';
// @ts-ignore módulo JS testado
import { nomeCategoria } from '../lib/catalogo.js';
import { addMeses, brl, dataBR, fimMes, mesNome, TURNOS } from '../lib/fmt';
import { gerarExcel, gerarPDF, type Rel } from '../lib/relatorios';
import { Btn, Cabecalho, Card, Campo, Select, toast } from '../components/ui';
import { usePeriodo } from '../components/Periodo';

const M = 'moeda' as const, N = 'num' as const, D = 'data' as const;
type Gerador = (de: string, ate: string) => Promise<Omit<Rel, 'periodo' | 'restaurante'>>;

const RELATORIOS: Record<string, { nome: string; g: Gerador }> = {
  compras: { nome: 'Compras por período', g: async (de, ate) => { const p = await carregarPeriodo(de, ate); const c = await todas('rest_compras', 'numero,data,total,desconto,origem,status, rest_fornecedores(nome)', (x) => x.gte('data', de).lte('data', ate).neq('status', 'cancelada').order('data'));
    return { titulo: 'Compras por período', resumo: [['Compras', String(c.length)], ['Total', brl(p.compras.reduce((t, x) => t + +x.total, 0))]], grafico: { titulo: 'Por fornecedor', dados: porFornecedor(p) },
      tabelas: [{ titulo: 'Compras', colunas: [{ t: 'Nº', k: 'numero' }, { t: 'Data', k: 'data', tipo: D }, { t: 'Fornecedor', k: 'f' }, { t: 'Origem', k: 'origem' }, { t: 'Desconto', k: 'desconto', tipo: M, total: true }, { t: 'Total', k: 'total', tipo: M, total: true }], linhas: c.map((x) => ({ ...x, f: x.rest_fornecedores?.nome })) },
        { titulo: 'Itens comprados', colunas: [{ t: 'Data', k: 'data', tipo: D }, { t: 'Fornecedor', k: 'fornecedor' }, { t: 'Produto', k: 'produto' }, { t: 'Categoria', k: 'cat' }, { t: 'Qtd', k: 'quantidade', tipo: N }, { t: 'Unid.', k: 'unidade' }, { t: 'Unitário', k: 'valor_unitario', tipo: M }, { t: 'Total', k: 'valor_total', tipo: M, total: true }], linhas: p.itens.map((i) => ({ ...i, cat: nomeCategoria(i.categoria) })) }] };
  } },
  fornecedor: { nome: 'Compras por fornecedor', g: async (de, ate) => { const p = await carregarPeriodo(de, ate); const l = porFornecedor(p); return { titulo: 'Compras por fornecedor', grafico: { titulo: 'Total por fornecedor', dados: l }, tabelas: [{ titulo: 'Fornecedores', colunas: [{ t: 'Fornecedor', k: 'nome' }, { t: 'Total', k: 'total', tipo: M, total: true }], linhas: l }] }; } },
  categoria: { nome: 'Compras por categoria', g: async (de, ate) => { const p = await carregarPeriodo(de, ate); const l = porCategoria(p); return { titulo: 'Compras por categoria', grafico: { titulo: 'Total por categoria', dados: l }, tabelas: [{ titulo: 'Categorias', colunas: [{ t: 'Categoria', k: 'nome' }, { t: 'Total', k: 'total', tipo: M, total: true }], linhas: l }] }; } },
  produtos: { nome: 'Histórico de produtos (preços)', g: async (de, ate) => { const p = await carregarPeriodo(de, ate);
    const m = new Map<string, any>(); for (const i of p.itens) { if (!i.produto_id) continue; const x = m.get(i.produto_id) ?? { produto: i.produto, cat: nomeCategoria(i.categoria), unidade: i.unidade, vezes: 0, qtd: 0, total: 0, menor: Infinity, maior: 0, primeiro: null, ultimo: null }; x.vezes++; x.qtd += +(i.quantidade ?? 0); x.total += +i.valor_total; if (i.valor_unitario) { const v = +i.valor_unitario; x.menor = Math.min(x.menor, v); x.maior = Math.max(x.maior, v); x.primeiro ??= v; x.ultimo = v; } m.set(i.produto_id, x); }
    const l = [...m.values()].map((x) => ({ ...x, menor: isFinite(x.menor) ? x.menor : null, variacao: x.primeiro && x.ultimo ? variacao(x.primeiro, x.ultimo) : null })).sort((a, b) => b.total - a.total);
    return { titulo: 'Histórico de produtos', tabelas: [{ titulo: 'Produtos', colunas: [{ t: 'Produto', k: 'produto' }, { t: 'Categoria', k: 'cat' }, { t: 'Compras', k: 'vezes', tipo: N }, { t: 'Quantidade', k: 'qtd', tipo: N }, { t: 'Unid.', k: 'unidade' }, { t: 'Menor preço', k: 'menor', tipo: M }, { t: 'Maior preço', k: 'maior', tipo: M }, { t: 'Último', k: 'ultimo', tipo: M }, { t: 'Variação %', k: 'variacao', tipo: N }, { t: 'Total', k: 'total', tipo: M, total: true }], linhas: l }] }; } },
  estoque: { nome: 'Estoque atual', g: async () => { const l = await todas('rest_produtos', 'nome,categoria,unidade,estoque_atual,estoque_minimo,status', (x) => x.neq('status', 'inativo').order('categoria').order('nome'));
    return { titulo: 'Estoque atual', resumo: [['Produtos', String(l.length)], ['Abaixo do mínimo', String(l.filter((p) => +p.estoque_minimo > 0 && +p.estoque_atual <= +p.estoque_minimo).length)]], tabelas: [{ titulo: 'Estoque', colunas: [{ t: 'Produto', k: 'nome' }, { t: 'Categoria', k: 'cat' }, { t: 'Saldo', k: 'estoque_atual', tipo: N }, { t: 'Mínimo', k: 'estoque_minimo', tipo: N }, { t: 'Unid.', k: 'unidade' }, { t: 'Alerta', k: 'alerta' }], linhas: l.map((p) => ({ ...p, cat: nomeCategoria(p.categoria), alerta: +p.estoque_minimo > 0 && +p.estoque_atual <= +p.estoque_minimo ? 'REPOR' : '' })) }] }; } },
  notas: { nome: 'Notas fiscais', g: async (de, ate) => { const l = await todas('rest_notas', 'numero,serie,cnpj,razao_social,data_emissao,valor_total,status, rest_fornecedores(nome), rest_compras(numero)', (x) => x.gte('data_emissao', de).lte('data_emissao', ate).order('data_emissao'));
    return { titulo: 'Notas fiscais', tabelas: [{ titulo: 'Notas', colunas: [{ t: 'Emissão', k: 'data_emissao', tipo: D }, { t: 'Fornecedor', k: 'f' }, { t: 'CNPJ', k: 'cnpj' }, { t: 'Número', k: 'numero' }, { t: 'Série', k: 'serie' }, { t: 'Compra', k: 'c' }, { t: 'Situação', k: 'status' }, { t: 'Valor', k: 'valor_total', tipo: M, total: true }], linhas: l.map((n) => ({ ...n, f: n.rest_fornecedores?.nome ?? n.razao_social, c: n.rest_compras ? `#${n.rest_compras.numero}` : '' })) }] }; } },
  fechamentos: { nome: 'Fechamentos de caixa', g: async (de, ate) => { const l = await todas('rest_fechamentos', '*, operador:rest_funcionarios!rest_fechamentos_operador_id_fkey(nome)', (x) => x.gte('data', de).lte('data', ate).order('data'));
    return { titulo: 'Fechamentos de caixa', tabelas: [{ titulo: 'Fechamentos', colunas: [{ t: 'Data', k: 'data', tipo: D }, { t: 'Turno', k: 'tn' }, { t: 'Operador', k: 'op' }, { t: 'Dinheiro', k: 'dinheiro', tipo: M, total: true }, { t: 'Débito', k: 'debito', tipo: M, total: true }, { t: 'Crédito', k: 'credito', tipo: M, total: true }, { t: 'PIX', k: 'pix', tipo: M, total: true }, { t: 'VA', k: 'vale_alimentacao', tipo: M, total: true }, { t: 'VR', k: 'vale_refeicao', tipo: M, total: true }, { t: 'Outros', k: 'outros', tipo: M, total: true }, { t: 'Total', k: 'total', tipo: M, total: true }, { t: 'Sangrias', k: 'sangrias', tipo: M, total: true }, { t: 'Estornos', k: 'estornos', tipo: M, total: true }, { t: 'Situação', k: 'status' }], linhas: l.map((f) => ({ ...f, tn: TURNOS[f.turno], op: f.operador?.nome })) }] }; } },
  vendas_diarias: { nome: 'Vendas diárias', g: async (de, ate) => { const p = await carregarPeriodo(de, ate); const i = indicadores(p);
    return { titulo: 'Vendas diárias', resumo: [['Faturamento líquido', brl(i.liquido)], ['Bruto', brl(i.bruto)], ['Vendas', String(i.qtdVendas)], ['Ticket médio', i.ticket ? brl(i.ticket) : '—']], tabelas: [{ titulo: 'Vendas', colunas: [{ t: 'Data', k: 'data', tipo: D }, { t: 'Turno', k: 'tn' }, { t: 'Bruto', k: 'bruto', tipo: M, total: true }, { t: 'Descontos', k: 'descontos', tipo: M, total: true }, { t: 'Cancelamentos', k: 'cancelamentos', tipo: M, total: true }, { t: 'Estornos', k: 'estornos', tipo: M, total: true }, { t: 'Líquido', k: 'liquido', tipo: M, total: true }, { t: 'Nº vendas', k: 'qtd_vendas', tipo: N, total: true }], linhas: p.vendas.map((v) => ({ ...v, tn: TURNOS[v.turno] ?? v.turno })) }] }; } },
  vendas_mensais: { nome: 'Vendas mensais', g: async (de, ate) => { const p = await carregarPeriodo(de, ate); const l = agrupar(p.vendas, (v) => v.data.slice(0, 7), (v) => +v.liquido).sort((a, b) => a.nome.localeCompare(b.nome)).map((x) => ({ mes: mesNome(x.nome + '-01'), total: x.total }));
    return { titulo: 'Vendas mensais', grafico: { titulo: 'Faturamento líquido por mês', dados: l.map((x) => ({ nome: x.mes, total: x.total })) }, tabelas: [{ titulo: 'Meses', colunas: [{ t: 'Mês', k: 'mes' }, { t: 'Faturamento líquido', k: 'total', tipo: M, total: true }], linhas: l }] }; } },
  pagar: { nome: 'Contas a pagar', g: async (de, ate) => { const l = await todas('rest_contas', 'numero,descricao,categoria,vencimento,valor,status,pago_em,nota_numero, rest_fornecedores(nome)', (x) => x.eq('tipo', 'pagar').neq('status', 'cancelado').gte('vencimento', de).lte('vencimento', ate).order('vencimento'));
    return { titulo: 'Contas a pagar', resumo: [['Em aberto', brl(l.filter((c) => c.status === 'pendente').reduce((t, c) => t + +c.valor, 0))], ['Pagas', brl(l.filter((c) => c.status === 'pago').reduce((t, c) => t + +c.valor, 0))]], tabelas: [{ titulo: 'Contas', colunas: [{ t: 'Vencimento', k: 'vencimento', tipo: D }, { t: 'Descrição', k: 'descricao' }, { t: 'Fornecedor', k: 'f' }, { t: 'Nota', k: 'nota_numero' }, { t: 'Categoria', k: 'categoria' }, { t: 'Situação', k: 'status' }, { t: 'Pago em', k: 'pago_em', tipo: D }, { t: 'Valor', k: 'valor', tipo: M, total: true }], linhas: l.map((c) => ({ ...c, f: c.rest_fornecedores?.nome })) }] }; } },
  despesas: { nome: 'Despesas por categoria', g: async (de, ate) => { const p = await carregarPeriodo(de, ate); const l = despesasPorCategoria(p); return { titulo: 'Despesas por categoria', grafico: { titulo: 'Despesas lançadas', dados: l }, tabelas: [{ titulo: 'Despesas', colunas: [{ t: 'Categoria', k: 'nome' }, { t: 'Total', k: 'total', tipo: M, total: true }], linhas: l }] }; } },
  receitas: { nome: 'Receitas', g: async (de, ate) => { const p = await carregarPeriodo(de, ate); const outras = p.contas.filter((c) => c.tipo === 'receber'); const l = [{ nome: 'Vendas (líquido)', total: indicadores(p).liquido }, ...agrupar(outras, (c) => c.categoria, (c) => +c.valor)];
    return { titulo: 'Receitas', tabelas: [{ titulo: 'Receitas', colunas: [{ t: 'Origem', k: 'nome' }, { t: 'Total', k: 'total', tipo: M, total: true }], linhas: l }, { titulo: 'Outras receitas', colunas: [{ t: 'Vencimento', k: 'vencimento', tipo: D }, { t: 'Descrição', k: 'descricao' }, { t: 'Situação', k: 'status' }, { t: 'Valor', k: 'valor', tipo: M, total: true }], linhas: outras }] }; } },
  fluxo: { nome: 'Fluxo de caixa', g: async (de, ate) => { const p = await carregarPeriodo(de, ate); const m: Record<string, any> = {};
    const g = (d: string) => (m[d] ??= { data: d, vendas: 0, recebido: 0, pago: 0 }); for (const v of p.vendas) g(v.data).vendas += +v.liquido; for (const c of p.contas) if (c.status === 'pago' && c.pago_em >= de && c.pago_em <= ate) { if (c.tipo === 'pagar') g(c.pago_em).pago += +c.valor; else g(c.pago_em).recebido += +c.valor; }
    let acum = 0; const l = Object.values(m).sort((a: any, b: any) => a.data.localeCompare(b.data)).map((x: any) => { acum += x.vendas + x.recebido - x.pago; return { ...x, saldo: x.vendas + x.recebido - x.pago, acumulado: Math.round(acum * 100) / 100 }; });
    return { titulo: 'Fluxo de caixa (realizado)', resumo: [['Entradas', brl(l.reduce((t, x) => t + x.vendas + x.recebido, 0))], ['Saídas', brl(l.reduce((t, x) => t + x.pago, 0))], ['Resultado', brl(acum)]], tabelas: [{ titulo: 'Fluxo diário', colunas: [{ t: 'Data', k: 'data', tipo: D }, { t: 'Vendas', k: 'vendas', tipo: M, total: true }, { t: 'Recebimentos', k: 'recebido', tipo: M, total: true }, { t: 'Pagamentos', k: 'pago', tipo: M, total: true }, { t: 'Saldo do dia', k: 'saldo', tipo: M, total: true }, { t: 'Acumulado', k: 'acumulado', tipo: M }], linhas: l }] }; } },
  resultado: { nome: 'Resultado financeiro (DRE simplificada)', g: async (de, ate) => { const p = await carregarPeriodo(de, ate); const i = indicadores(p); const d = despesasPorCategoria(p);
    const l = [{ item: 'Faturamento bruto', valor: i.bruto }, { item: '(−) Descontos, cancelamentos e estornos', valor: -(i.bruto - i.liquido) }, { item: '= Faturamento líquido', valor: i.liquido }, { item: '(−) Custo de mercadorias (compras de alimentos e bebidas)', valor: -i.cmv }, { item: '= Margem bruta', valor: i.margemBruta }, { item: '(+) Outras receitas', valor: i.outrasReceitas }, { item: '(−) Despesas lançadas (todas, inclui compras)', valor: -i.despesasLancadas }, { item: '= Resultado operacional estimado', valor: i.resultado }];
    return { titulo: 'Resultado financeiro', resumo: [['Faturamento líquido', brl(i.liquido)], ['Margem bruta', brl(i.margemBruta)], ['Resultado operacional', brl(i.resultado)]], tabelas: [{ titulo: 'Demonstrativo', colunas: [{ t: 'Item', k: 'item' }, { t: 'Valor', k: 'valor', tipo: M }], linhas: l }, { titulo: 'Despesas por categoria', colunas: [{ t: 'Categoria', k: 'nome' }, { t: 'Total', k: 'total', tipo: M, total: true }], linhas: d }] }; } },
  comparativo: { nome: 'Comparativo mensal (12 meses)', g: async () => { const ini = addMeses(new Date().toISOString().slice(0, 8) + '01', -11); const p = await carregarPeriodo(ini, fimMes()); const s = serieMensal(p);
    const l = s.map((x, k) => ({ mes: mesNome(x.mes + '-01'), vendas: x.vendas, compras: x.compras, cmv: x.cmv, despesas: x.despesas, resultado: Math.round((x.vendas - x.despesas) * 100) / 100, var_vendas: k ? variacao(s[k - 1].vendas, x.vendas) : null, var_compras: k ? variacao(s[k - 1].compras, x.compras) : null }));
    const ult = s.length >= 2 ? variacaoPrecos(p.itens.filter((i) => i.data.slice(0, 7) === s.at(-2)!.mes), p.itens.filter((i) => i.data.slice(0, 7) === s.at(-1)!.mes)) : [];
    return { titulo: 'Comparativo mensal', tabelas: [{ titulo: 'Mês a mês', colunas: [{ t: 'Mês', k: 'mes' }, { t: 'Faturamento', k: 'vendas', tipo: M, total: true }, { t: 'Var. %', k: 'var_vendas', tipo: N }, { t: 'Compras', k: 'compras', tipo: M, total: true }, { t: 'Var. %', k: 'var_compras', tipo: N }, { t: 'Custo merc.', k: 'cmv', tipo: M, total: true }, { t: 'Despesas', k: 'despesas', tipo: M, total: true }, { t: 'Resultado', k: 'resultado', tipo: M, total: true }], linhas: l },
      { titulo: 'Preços: último mês × anterior', colunas: [{ t: 'Produto', k: 'produto' }, { t: 'Categoria', k: 'categoria' }, { t: 'Antes', k: 'antes', tipo: M }, { t: 'Depois', k: 'depois', tipo: M }, { t: 'Var. %', k: 'pct', tipo: N }], linhas: ult }] }; } },
};

export default function Relatorios() {
  const { rest } = useEu();
  const per = usePeriodo('mes');
  const [rel, setRel] = useState('compras');
  const [gerando, setGerando] = useState<string | null>(null);
  const gerar = async (tipo: 'pdf' | 'xlsx') => {
    setGerando(tipo);
    try {
      const r = await RELATORIOS[rel].g(per.de, per.ate);
      const total = r.tabelas.reduce((t, x) => t + x.linhas.length, 0);
      if (!total) { toast('Não há dados para esse relatório no período escolhido.', 'info'); return; }
      const completo: Rel = { ...r, restaurante: rest.nome, periodo: rel === 'estoque' ? `posição em ${dataBR(new Date().toISOString().slice(0, 10))}` : `${dataBR(per.de)} a ${dataBR(per.ate)}` };
      if (tipo === 'pdf') await gerarPDF(completo); else await gerarExcel(completo);
      toast('Relatório gerado');
    } catch (e: any) { toast(e.message ?? String(e), 'erro'); } finally { setGerando(null); }
  };
  return (
    <div className="space-y-3">
      <Cabecalho titulo="Relatórios" sub="Escolha o relatório e o período; gere em PDF ou Excel" />
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Relatório"><Select value={rel} onChange={(e) => setRel(e.target.value)}>{Object.entries(RELATORIOS).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}</Select></Campo>
          <div><span className="mb-1 block text-sm font-medium">Período</span>{per.seletor}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn carregando={gerando === 'pdf'} disabled={!!gerando} onClick={() => gerar('pdf')}><FileText className="h-4 w-4" />Gerar PDF</Btn>
          <Btn variante="secundario" carregando={gerando === 'xlsx'} disabled={!!gerando} onClick={() => gerar('xlsx')}><FileSpreadsheet className="h-4 w-4" />Gerar Excel</Btn>
        </div>
        <p className="mt-3 text-xs text-slate-500">O PDF traz resumo, gráfico, tabelas e totais. O Excel vem em abas, com cabeçalho, filtro e fórmulas de soma.</p>
      </Card>
    </div>
  );
}
