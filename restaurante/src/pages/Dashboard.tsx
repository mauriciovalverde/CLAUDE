import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { rpc } from '../lib/supabase';
import { carregarPeriodo, indicadores, porCategoria, porFornecedor, despesasPorCategoria, serieMensal } from '../lib/analise';
import { addMeses, brl, compacto, dataBR, hoje, inicioMes, mesNome, pct } from '../lib/fmt';
import { Aviso, Card, Carregando, Stat, useDados } from '../components/ui';
import { usePeriodo } from '../components/Periodo';
import { FORMAS_VENDA } from './Vendas';

const COR = '#a3141b';
function Barras({ dados, cor = COR, altura = 240 }: { dados: { nome: string; total: number }[]; cor?: string; altura?: number }) {
  if (!dados.length) return <p className="py-10 text-center text-sm text-slate-500">Sem dados no período.</p>;
  const d = dados.slice(0, 10);
  return <div style={{ height: Math.max(altura, d.length * 28) }}><ResponsiveContainer><BarChart data={d} layout="vertical" margin={{ left: 10, right: 16 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} /><XAxis type="number" tickFormatter={compacto} /><YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11 }} /><Tooltip formatter={(v: any) => brl(v)} /><Bar isAnimationActive={false} maxBarSize={56} dataKey="total" fill={cor} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>;
}

export default function Dashboard() {
  const per = usePeriodo('mes');
  const { dados: p, carregando } = useDados(() => carregarPeriodo(per.de, per.ate), [per.de, per.ate]);
  const { dados: hist } = useDados(() => carregarPeriodo(addMeses(inicioMes(), -11), hoje()), []);
  const { dados: painel } = useDados(() => rpc('rest_painel', { p_de: inicioMes(), p_ate: hoje() }), []);
  const ind = useMemo(() => (p ? indicadores(p) : null), [p]);
  const dias = useMemo(() => { const m: Record<string, number> = {}; for (const v of p?.vendas ?? []) m[v.data] = (m[v.data] ?? 0) + +v.liquido; return Object.entries(m).sort().map(([data, valor]) => ({ data, valor })); }, [p]);
  const formas = useMemo(() => FORMAS_VENDA.map(([k, nome, cor]) => ({ nome, cor, valor: (p?.vendas ?? []).reduce((t, v) => t + +v[k], 0) })).filter((x) => x.valor > 0), [p]);
  const mensal = useMemo(() => (hist ? serieMensal(hist) : []), [hist]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-sm text-slate-500">{per.nome}: {dataBR(per.de)} a {dataBR(per.ate)}</p></div>{per.seletor}</div>

      {painel && <Card titulo={`Fechamento gerencial de hoje (${dataBR(painel.hoje)})`}>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div><div className="text-xs text-slate-500">Vendas de hoje</div><b className="text-lg">{brl(painel.vendas_hoje)}</b></div>
          <div><div className="text-xs text-slate-500">Compras de hoje</div><b className="text-lg">{brl(painel.compras_hoje)}</b></div>
          <div><div className="text-xs text-slate-500">Saldo de caixa (estimado)</div><b className="text-lg">{brl(painel.saldo_caixa)}</b></div>
          <div><div className="text-xs text-slate-500">Pendências</div><span className="text-xs">{painel.caixas_para_conferir} caixa(s) p/ conferir · {painel.solicitacoes_pendentes} pedido(s) · {painel.notas_pendentes} nota(s) · {painel.estoque_baixo} item(ns) em falta</span></div>
        </div>
      </Card>}

      {carregando || !ind ? <Carregando /> : <>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Stat rotulo="Faturamento líquido" valor={brl(ind.liquido)} tom="bom" sub={`bruto ${brl(ind.bruto)}`} />
          <Stat rotulo="Pratos vendidos / ticket médio" valor={ind.qtdVendas || '—'} sub={ind.ticket ? `ticket por prato ${brl(ind.ticket)}` : 'informe os pratos vendidos no caixa'} />
          <Stat rotulo="Compras do período" valor={brl(ind.compras)} />
          <Stat rotulo="Custo de mercadorias" valor={brl(ind.cmv)} sub="compras de alimentos e bebidas" />
          <Stat rotulo="Margem bruta" valor={brl(ind.margemBruta)} tom={ind.margemBruta >= 0 ? 'bom' : 'ruim'} sub={`${pct(ind.margemPct).replace('+', '')} do faturamento`} />
          <Stat rotulo="Despesas lançadas" valor={brl(ind.despesasLancadas)} sub={`pagas no período: ${brl(ind.despesasPagas)}`} />
          <Stat rotulo="Resultado operacional (estimado)" valor={brl(ind.resultado)} tom={ind.resultado >= 0 ? 'bom' : 'ruim'} sub="faturamento + outras receitas − despesas" />
          <Stat rotulo="Contas a pagar" valor={brl(painel?.a_pagar ?? ind.compromissos)} tom="alerta" sub={painel ? `vencidas: ${brl(painel.vencidas)}` : ''} />
        </div>
        <Aviso tipo="info">Faturamento é o que vendeu; margem bruta = faturamento − custo das mercadorias; resultado operacional desconta todas as despesas lançadas no período; saldo de caixa é dinheiro disponível estimado. São números diferentes.</Aviso>
        {!p!.vendas.length && <Aviso tipo="alerta">Ainda não há vendas no período: faça o fechamento de caixa ou lance/importe as vendas para ver faturamento e margens.</Aviso>}

        <div className="grid gap-3 lg:grid-cols-2">
          <Card titulo="Vendas diárias"><div className="h-60">{dias.length ? <ResponsiveContainer><BarChart data={dias} margin={{ left: -10 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="data" tickFormatter={(d) => d.slice(8)} /><YAxis tickFormatter={compacto} width={48} /><Tooltip formatter={(v: any) => brl(v)} labelFormatter={(d) => dataBR(d)} /><Bar isAnimationActive={false} maxBarSize={56} dataKey="valor" fill={COR} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="pt-20 text-center text-sm text-slate-500">Sem vendas no período.</p>}</div></Card>
          <Card titulo="Receitas × despesas (12 meses)"><div className="h-60"><ResponsiveContainer><BarChart data={mensal} margin={{ left: -10 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="mes" tickFormatter={(m) => mesNome(m + '-01')} /><YAxis tickFormatter={compacto} width={48} /><Tooltip formatter={(v: any) => brl(v)} labelFormatter={(m) => mesNome(m + '-01')} /><Legend /><Bar isAnimationActive={false} maxBarSize={56} dataKey="vendas" name="Faturamento" fill="#16a34a" radius={[3, 3, 0, 0]} /><Bar isAnimationActive={false} maxBarSize={56} dataKey="despesas" name="Despesas" fill={COR} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
          <Card titulo="Despesas por categoria"><Barras dados={despesasPorCategoria(p!)} /></Card>
          <Card titulo="Compras por categoria de produto"><Barras dados={porCategoria(p!)} cor="#f79f31" /></Card>
          <Card titulo="Compras por fornecedor"><Barras dados={porFornecedor(p!)} cor="#7c3aed" /></Card>
          <Card titulo="Formas de pagamento das vendas"><div className="h-60">{formas.length ? <ResponsiveContainer><PieChart><Pie isAnimationActive={false} data={formas} dataKey="valor" nameKey="nome" innerRadius={50} outerRadius={85} paddingAngle={2} label={(e: any) => e.nome}>{formas.map((f) => <Cell key={f.nome} fill={f.cor} />)}</Pie><Tooltip formatter={(v: any) => brl(v)} /></PieChart></ResponsiveContainer> : <p className="pt-20 text-center text-sm text-slate-500">Sem vendas no período.</p>}</div></Card>
          <Card titulo="Evolução dos custos (12 meses)" className="lg:col-span-2"><div className="h-60"><ResponsiveContainer><LineChart data={mensal} margin={{ left: -10 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="mes" tickFormatter={(m) => mesNome(m + '-01')} /><YAxis tickFormatter={compacto} width={48} /><Tooltip formatter={(v: any) => brl(v)} labelFormatter={(m) => mesNome(m + '-01')} /><Legend /><Line isAnimationActive={false} dataKey="compras" name="Compras" stroke={COR} strokeWidth={2} /><Line isAnimationActive={false} dataKey="cmv" name="Custo de mercadorias" stroke="#f79f31" strokeWidth={2} /><Line isAnimationActive={false} dataKey="vendas" name="Faturamento" stroke="#16a34a" strokeWidth={2} /></LineChart></ResponsiveContainer></div></Card>
        </div>
      </>}
    </div>
  );
}
