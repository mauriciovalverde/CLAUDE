import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePeriodo } from '../lib/periodo';
import { carregar, mesesEntre, porMes, somar } from '../lib/dados';
import { brl, dataBR, hoje, mesNome, num, pct } from '../lib/fmt';
import { Relatorio, pdfCliente } from '../lib/pdf';
import { Aviso, Btn, Cabecalho, Card, q, Select, toast } from '../components/ui';

const MODULOS = [
  ['geral', 'Relatório financeiro geral'], ['emprestimos', 'Empréstimos'], ['juros', 'Juros recebidos'], ['vendas', 'Vendas'], ['compras', 'Compras'],
  ['estoque', 'Estoque'], ['lucro', 'Lucro'], ['pagar', 'Contas a pagar'], ['receber', 'Contas a receber'], ['pessoais', 'Despesas pessoais'],
  ['salarial', 'Salarial'], ['comparativo', 'Comparativo mensal e anual'],
] as const;

export default function Relatorios() {
  const { periodo } = usePeriodo();
  const [sel, setSel] = useState<Set<string>>(new Set(['geral']));
  const [cliente, setCliente] = useState('');
  const [clientes, setClientes] = useState<any[] | null>(null);
  const [gerando, setGerando] = useState(false);
  if (!clientes) supabase.from('clientes').select('id,nome').is('excluido_em', null).order('nome').then(({ data }) => setClientes(data ?? []));
  const alternar = (k: string) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  async function gerar() {
    setGerando(true);
    try {
      const { de, ate } = periodo;
      const [contas, abertas, lanc, vendas, compras, emps, pags, produtos, alertas, mensal, cc] = await Promise.all([
        carregar.contas(), carregar.obrigacoes({ abertas: true }), carregar.lancamentos(de, ate), carregar.vendas(de, ate), carregar.compras(de, ate),
        carregar.emprestimos(), carregar.pagamentos(de, ate), carregar.produtos(), carregar.alertas(), carregar.vendasMensal(), carregar.contracheques(),
      ]);
      const titulo = sel.size === 1 ? MODULOS.find((m) => sel.has(m[0]))![1] : 'Relatório consolidado';
      const r = new Relatorio(titulo, `Período: ${dataBR(de)} a ${dataBR(ate)}`);
      const meses = mesesEntre(de, ate);
      const fat = somar(vendas, 'total'), lucro = somar(vendas, 'lucro_bruto', (v) => v.lucro_bruto != null), juros = somar(pags, 'juros_valor');

      if (sel.has('geral')) {
        r.secao('Visão geral');
        r.cartoes([
          ['Saldo disponível', brl(somar(contas, 'saldo'))], ['A receber', brl(somar(abertas, 'saldo', (o) => o.tipo === 'receber'))], ['A pagar', brl(somar(abertas, 'saldo', (o) => o.tipo === 'pagar'))], ['Faturamento', brl(fat)],
          ['Lucro das vendas', brl(lucro)], ['Lucro com juros', brl(juros)], ['Receitas pessoais', brl(somar(lanc, 'valor', (l) => l.escopo === 'pessoal' && l.tipo === 'entrada'))], ['Despesas pessoais', brl(somar(lanc, 'valor', (l) => l.escopo === 'pessoal' && l.tipo === 'saida' && l.natureza === 'operacional'))],
        ]);
        r.texto('Definições: faturamento = valor vendido no período (recebido ou não); lucro bruto = faturamento − custo da mercadoria; recebimento = dinheiro que entrou; saldo = posição atual das contas. Empréstimo concedido e principal devolvido não são despesa/receita.', 8);
        const rec = porMes(lanc.filter((l) => l.tipo === 'entrada' && l.natureza === 'operacional'), (l) => l.data, (l) => +l.valor);
        const des = porMes(lanc.filter((l) => l.tipo === 'saida' && l.natureza === 'operacional'), (l) => l.data, (l) => +l.valor);
        r.barras(meses.map(mesNome), [{ nome: 'Receitas', cor: [16, 185, 129], valores: meses.map((m) => rec.get(m) ?? 0) }, { nome: 'Despesas', cor: [239, 68, 68], valores: meses.map((m) => des.get(m) ?? 0) }]);
        r.secao('DRE simplificada');
        const linha = (esc: string) => { const re = somar(lanc, 'valor', (l) => l.escopo === esc && l.tipo === 'entrada' && l.natureza === 'operacional'); const dp = somar(lanc, 'valor', (l) => l.escopo === esc && l.tipo === 'saida' && l.natureza === 'operacional'); return [esc === 'pessoal' ? 'Pessoal' : 'Comercial (caixa)', brl(re), brl(dp), brl(re - dp)]; };
        r.tabela(['Escopo', 'Receitas', 'Despesas', 'Resultado'], [linha('comercial'), linha('pessoal')], { numericas: [1, 2, 3] });
        r.tabela(['Conta', 'Escopo', 'Saldo'], contas.map((c) => [c.nome, c.escopo, brl(c.saldo)]), { numericas: [2], total: ['Total', '', brl(somar(contas, 'saldo'))] });
      }
      if (sel.has('emprestimos')) {
        r.secao('Empréstimos');
        r.tabela(['Nº', 'Cliente', 'Data', 'Principal', 'Taxa', 'Total previsto', 'Vencimento', 'Situação'], emps.map((e) => [e.numero, e.clientes?.nome, dataBR(e.data), brl(e.principal), `${e.taxa_pct}% ${e.periodicidade}${e.acima_limite_legal ? ' (!)' : ''}`, brl(e.total_previsto), dataBR(e.vencimento), e.status]),
          { numericas: [3, 5], total: ['', 'Total', '', brl(somar(emps, 'principal')), '', brl(somar(emps, 'total_previsto')), '', ''] });
        const acima = emps.filter((e) => e.acima_limite_legal);
        if (acima.length) r.texto(`Condições acima da referência legal configurada: ${acima.map((e) => `nº ${e.numero} (${pct(e.taxa_mensal_equivalente_pct)} a.m.)`).join(', ')}. O registro não implica legalidade da taxa.`, 8);
      }
      if (sel.has('juros')) {
        r.secao('Juros recebidos');
        const pj = pags.filter((p) => +p.juros_valor > 0);
        r.tabela(['Data', 'Referente a', 'Pagamento', 'Juros'], pj.map((p) => [dataBR(p.data), p.obrigacoes?.descricao, brl(p.valor), brl(p.juros_valor)]), { numericas: [2, 3], total: ['', 'Total', brl(somar(pj, 'valor')), brl(juros)] });
      }
      if (sel.has('vendas')) {
        r.secao('Vendas');
        r.cartoes([['Faturamento', brl(fat)], ['Lucro bruto', brl(lucro)], ['Margem', pct(fat ? (lucro / fat) * 100 : null)], ['Ticket médio', brl(vendas.length ? fat / vendas.length : 0)]]);
        r.tabela(['Nº', 'Data', 'Cliente', 'Itens', 'Total', 'Lucro', 'Situação'], vendas.map((v) => [v.numero, dataBR(v.data), v.clientes?.nome, v.venda_itens.map((i: any) => `${num(i.quantidade)}× ${i.produtos?.nome}`).join(', '), brl(v.total), v.lucro_bruto == null ? 'sem custo' : brl(v.lucro_bruto), v.status]),
          { numericas: [4, 5], total: ['', '', '', 'Total', brl(fat), brl(lucro), ''] });
      }
      if (sel.has('compras')) {
        r.secao('Compras');
        r.tabela(['Nº', 'Data', 'Fornecedor', 'Itens', 'Total', 'Pagamento'], compras.map((c) => [c.numero, dataBR(c.data), c.fornecedores?.nome ?? '—', c.compra_itens.map((i: any) => `${num(i.quantidade)}× ${i.produtos?.nome} a ${brl(i.custo_unitario)}`).join(', '), brl(c.total), c.status]),
          { numericas: [4], total: ['', '', '', 'Total', brl(somar(compras, 'total')), ''] });
      }
      if (sel.has('estoque')) {
        r.secao('Estoque');
        r.tabela(['Produto', 'Classe', 'Estoque', 'Mínimo', 'Custo', 'Valor ao custo'], produtos.map((p) => [p.nome, p.classe_regulatoria, num(p.estoque_atual), num(p.estoque_minimo), brl(p.preco_compra), brl(p.estoque_atual * (p.preco_compra ?? 0))]),
          { numericas: [2, 3, 4, 5], total: ['Total', '', '', '', '', brl(somar(produtos.map((p) => ({ v: p.estoque_atual * (p.preco_compra ?? 0) })), 'v'))] });
        if (alertas.length) r.tabela(['Alerta', 'Produto', 'Qtd', 'Lote', 'Validade'], alertas.map((a) => [a.alerta, a.nome, num(a.estoque_atual), a.lote ?? '—', dataBR(a.validade)]));
      }
      if (sel.has('lucro')) {
        r.secao('Lucro por mês');
        const lv = porMes(vendas.filter((v) => v.lucro_bruto != null), (v) => v.data, (v) => +v.lucro_bruto);
        const lj = porMes(pags, (p) => p.data, (p) => +p.juros_valor);
        r.barras(meses.map(mesNome), [{ nome: 'Lucro vendas', cor: [15, 118, 110], valores: meses.map((m) => lv.get(m) ?? 0) }, { nome: 'Juros', cor: [139, 92, 246], valores: meses.map((m) => lj.get(m) ?? 0) }]);
        r.tabela(['Mês', 'Lucro das vendas', 'Juros recebidos', 'Total'], meses.map((m) => [mesNome(m), brl(lv.get(m) ?? 0), brl(lj.get(m) ?? 0), brl((lv.get(m) ?? 0) + (lj.get(m) ?? 0))]), { numericas: [1, 2, 3], total: ['Total', brl(lucro), brl(juros), brl(lucro + juros)] });
      }
      for (const [k, tipo, t] of [['pagar', 'pagar', 'Contas a pagar'], ['receber', 'receber', 'Contas a receber']] as const) {
        if (!sel.has(k)) continue;
        r.secao(t);
        const l = abertas.filter((o) => o.tipo === tipo);
        const faixa = (o: any) => (o.dias_atraso <= 0 ? 'Em dia' : o.dias_atraso <= 30 ? '1–30 dias' : o.dias_atraso <= 60 ? '31–60 dias' : '+60 dias');
        r.tabela(['Descrição', 'Quem', 'Vencimento', 'Saldo', 'Situação', 'Atraso'], l.map((o) => [o.descricao, o.cliente_nome ?? o.fornecedor_nome ?? '—', dataBR(o.vencimento), brl(o.saldo), o.situacao, faixa(o)]), { numericas: [3], total: ['Total', '', '', brl(somar(l, 'saldo')), '', ''] });
      }
      if (sel.has('pessoais')) {
        r.secao('Despesas pessoais');
        const dp = lanc.filter((l) => l.escopo === 'pessoal' && l.tipo === 'saida' && l.natureza === 'operacional');
        const cat = new Map<string, number>(); dp.forEach((l) => cat.set(l.categorias?.nome ?? 'Outras', (cat.get(l.categorias?.nome ?? 'Outras') ?? 0) + +l.valor));
        r.tabela(['Categoria', 'Total', '%'], [...cat].sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, brl(v), pct((v / (somar(dp, 'valor') || 1)) * 100)]), { numericas: [1, 2], total: ['Total', brl(somar(dp, 'valor')), '100%'] });
        r.tabela(['Data', 'Descrição', 'Categoria', 'Valor'], dp.map((l) => [dataBR(l.data), l.descricao, l.categorias?.nome, brl(l.valor)]), { numericas: [3] });
      }
      if (sel.has('salarial')) {
        r.secao('Salário (Polícia Militar)');
        const c2 = cc.filter((c) => c.competencia >= de.slice(0, 8) + '01' && c.competencia <= ate);
        r.barras(c2.map((c) => mesNome(c.competencia)), [{ nome: 'Bruto', cor: [14, 165, 233], valores: c2.map((c) => +c.bruto) }, { nome: 'Líquido', cor: [16, 185, 129], valores: c2.map((c) => +c.liquido) }, { nome: 'Descontos', cor: [239, 68, 68], valores: c2.map((c) => +c.descontos) }]);
        r.tabela(['Competência', 'Bruto', 'Descontos', 'Líquido', 'Variação'], c2.map((c, i) => [mesNome(c.competencia), brl(c.bruto), brl(c.descontos), brl(c.liquido), i ? pct(((c.liquido - c2[i - 1].liquido) / (c2[i - 1].liquido || 1)) * 100) : '—']),
          { numericas: [1, 2, 3, 4], total: ['Total', brl(somar(c2, 'bruto')), brl(somar(c2, 'descontos')), brl(somar(c2, 'liquido')), ''] });
      }
      if (sel.has('comparativo')) {
        r.secao('Comparativo mensal e anual de vendas');
        const ult = mensal.slice(-13);
        r.tabela(['Mês', 'Faturamento', 'Var.', 'Lucro bruto', 'Var.', 'Vendas', 'Ticket', 'Novos'], ult.map((m, i) => { const a = ult[i - 1]; const v = (x: number, y: number) => (a && y ? pct(((x - y) / y) * 100) : '—'); return [mesNome(m.mes), brl(m.faturamento), v(+m.faturamento, +a?.faturamento), brl(m.lucro_bruto), v(+m.lucro_bruto, +a?.lucro_bruto), m.qtd_vendas, brl(m.ticket_medio), m.clientes_novos]; }), { numericas: [1, 2, 3, 4, 5, 6, 7] });
        const anos = new Map<string, number>(); mensal.forEach((m) => anos.set(m.mes.slice(0, 4), (anos.get(m.mes.slice(0, 4)) ?? 0) + +m.faturamento));
        r.tabela(['Ano', 'Faturamento'], [...anos].map(([a, v]) => [a, brl(v)]), { numericas: [1] });
      }
      r.salvar(`gfi-relatorio-${de}_${ate}.pdf`);
      toast('PDF gerado.');
    } catch (e: any) { toast(e.message, 'erro'); } finally { setGerando(false); }
  }

  async function gerarCliente() {
    if (!cliente) return;
    const [c, res, vendas, emps, obr, pags] = await Promise.all([
      q(supabase.from('clientes').select('*').eq('id', cliente).single()), q(supabase.from('v_clientes_resumo').select('*').eq('id', cliente).maybeSingle()),
      q<any[]>(supabase.from('vendas').select('*, venda_itens(quantidade,produtos(nome))').eq('cliente_id', cliente).is('excluido_em', null).order('data')),
      q<any[]>(supabase.from('emprestimos').select('*').eq('cliente_id', cliente).is('excluido_em', null)), carregar.obrigacoes({ cliente }),
      q<any[]>(supabase.from('pagamentos').select('*, obrigacoes!inner(cliente_id,descricao)').eq('obrigacoes.cliente_id', cliente).is('estornado_em', null).order('data')),
    ]);
    pdfCliente(c, res, vendas, emps, obr, pags);
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Relatórios em PDF" sub={`Período selecionado no topo: ${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`} />
      <Card titulo="Escolha os módulos">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map(([k, t]) => <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${sel.has(k) ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30' : 'border-slate-200 dark:border-slate-800'}`}><input type="checkbox" checked={sel.has(k)} onChange={() => alternar(k)} />{t}</label>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Btn onClick={gerar} carregando={gerando} disabled={!sel.size}><FileDown className="h-4 w-4" />Gerar PDF</Btn>
          <Btn variante="secundario" onClick={() => setSel(new Set(MODULOS.map((m) => m[0])))}>Selecionar todos</Btn>
          <span className="text-xs text-slate-500">Emitido em {dataBR(hoje())} com cabeçalho, totais, subtotais, gráficos e paginação.</span>
        </div>
      </Card>
      <Card titulo="Relatório individual por cliente">
        <div className="flex flex-wrap gap-2"><Select className="!w-auto min-w-60" value={cliente} onChange={(e) => setCliente(e.target.value)}><option value="">Selecione o cliente…</option>{clientes?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select><Btn onClick={gerarCliente} disabled={!cliente}><FileDown className="h-4 w-4" />Gerar PDF do cliente</Btn></div>
      </Card>
      <Aviso>Dica: peça pelo chat — “gere o relatório de vendas de outubro” — e eu te digo os números; o PDF é gerado aqui.</Aviso>
    </div>
  );
}
