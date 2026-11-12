import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Wallet } from 'lucide-react';
import { usePeriodo } from '../lib/periodo';
import { carregar, mesesEntre, porMes, somar } from '../lib/dados';
import { addDias, brl, dataBR, hoje, mesNome, num, pct } from '../lib/fmt';
import { Badge, Cabecalho, Card, Stat, Tabela, useDados } from '../components/ui';
import { supabase } from '../lib/supabase';

export const CORES = ['#0F766E', '#0EA5E9', '#F59E0B', '#8B5CF6', '#EF4444', '#10B981', '#64748B', '#EC4899', '#84CC16', '#F97316'];
const tip = { formatter: (v: any) => brl(v), contentStyle: { borderRadius: 12, fontSize: 12 } };

export default function Dashboard() {
  const { periodo } = usePeriodo();
  const { dados } = useDados(async () => {
    const [contas, abertas, lanc, vendas, emps, pags, alertas, produtos, lotes, prox] = await Promise.all([
      carregar.contas(), carregar.obrigacoes({ abertas: true }), carregar.lancamentos(periodo.de, periodo.ate),
      carregar.vendas(periodo.de, periodo.ate), carregar.emprestimos(), carregar.pagamentos(periodo.de, periodo.ate),
      carregar.alertas(), carregar.produtos(),
      supabase.from('lotes').select('quantidade,custo_unitario,produto_id').gt('quantidade', 0).then((r) => r.data ?? []),
      carregar.obrigacoes({ abertas: true, ate: addDias(hoje(), 90) }),
    ]);
    return { contas, abertas, lanc, vendas, emps, pags, alertas, produtos, lotes, prox };
  }, [periodo.de, periodo.ate]);

  if (!dados) return <Cabecalho titulo="Dashboard" sub="Carregando…" />;
  const { contas, abertas, lanc, vendas, emps, pags, alertas, produtos, lotes, prox } = dados;

  const saldoPessoal = somar(contas, 'saldo', (c) => c.escopo === 'pessoal');
  const saldoComercial = somar(contas, 'saldo', (c) => c.escopo === 'comercial');
  const aReceber = somar(abertas, 'saldo', (o) => o.tipo === 'receber');
  const atrasado = somar(abertas, 'saldo', (o) => o.tipo === 'receber' && o.situacao === 'atrasado');
  const aPagar = somar(abertas, 'saldo', (o) => o.tipo === 'pagar');
  const ativos = emps.filter((e: any) => ['ativo', 'atrasado', 'renegociado'].includes(e.status));
  const totalEmprestado = somar(ativos, 'principal');
  const saldoDevedor = somar(abertas, 'saldo', (o) => o.origem === 'emprestimo');
  const juros = somar(pags, 'juros_valor');
  const faturamento = somar(vendas, 'total');
  const lucroVendas = somar(vendas, 'lucro_bruto', (v) => v.lucro_bruto != null);
  const semCusto = vendas.filter((v: any) => v.lucro_bruto == null).length;
  const despPessoais = somar(lanc, 'valor', (l) => l.escopo === 'pessoal' && l.tipo === 'saida' && l.natureza === 'operacional');
  const valorEstoque = lotes.length ? somar(lotes.map((l: any) => ({ v: l.quantidade * (l.custo_unitario ?? 0) })), 'v')
    : somar(produtos.map((p: any) => ({ v: p.estoque_atual * (p.preco_compra ?? 0) })), 'v');
  const patrimonio = saldoPessoal + saldoComercial + aReceber + valorEstoque - aPagar;

  const meses = mesesEntre(periodo.de, periodo.ate);
  const rec = porMes(lanc.filter((l: any) => l.tipo === 'entrada' && l.natureza === 'operacional'), (l: any) => l.data, (l: any) => +l.valor);
  const desp = porMes(lanc.filter((l: any) => l.tipo === 'saida' && l.natureza === 'operacional'), (l: any) => l.data, (l: any) => +l.valor);
  const fat = porMes(vendas, (v: any) => v.data, (v: any) => +v.total);
  const luc = porMes(vendas.filter((v: any) => v.lucro_bruto != null), (v: any) => v.data, (v: any) => +v.lucro_bruto);
  const empM = porMes(emps.filter((e: any) => e.data >= periodo.de && e.data <= periodo.ate), (e: any) => e.data, (e: any) => +e.principal);
  const recEmp = porMes(pags.filter((p: any) => p.obrigacoes?.origem === 'emprestimo'), (p: any) => p.data, (p: any) => +p.valor);
  const serie = meses.map((m) => ({ mes: mesNome(m), Receitas: rec.get(m) ?? 0, Despesas: desp.get(m) ?? 0, Faturamento: fat.get(m) ?? 0, Lucro: luc.get(m) ?? 0, Emprestado: empM.get(m) ?? 0, Recebido: recEmp.get(m) ?? 0 }));

  const cat = new Map<string, number>();
  lanc.filter((l: any) => l.tipo === 'saida' && l.natureza === 'operacional').forEach((l: any) => cat.set(l.categorias?.nome ?? 'Outros', (cat.get(l.categorias?.nome ?? 'Outros') ?? 0) + +l.valor));
  const pizza = [...cat].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const prod = new Map<string, { q: number; v: number }>(); const cli = new Map<string, number>();
  vendas.forEach((v: any) => { cli.set(v.clientes?.nome ?? '—', (cli.get(v.clientes?.nome ?? '—') ?? 0) + +v.total); v.venda_itens?.forEach((i: any) => { const k = i.produtos?.nome ?? '—'; const a = prod.get(k) ?? { q: 0, v: 0 }; prod.set(k, { q: a.q + +i.quantidade, v: a.v + +i.total }); }); });
  const topProd = [...prod].map(([nome, x]) => ({ nome, Quantidade: x.q, Valor: x.v })).sort((a, b) => b.Quantidade - a.Quantidade).slice(0, 8);
  const topCli = [...cli].map(([nome, Valor]) => ({ nome, Valor })).sort((a, b) => b.Valor - a.Valor).slice(0, 8);

  // fluxo de caixa futuro por semana (90 dias)
  const semanas: Record<string, { semana: string; Receber: number; Pagar: number }> = {};
  prox.forEach((o: any) => { const d = o.vencimento < hoje() ? hoje() : o.vencimento; const idx = Math.floor((new Date(d).getTime() - new Date(hoje()).getTime()) / (7 * 864e5)); const k = String(idx).padStart(2, '0'); const s = (semanas[k] ??= { semana: idx === 0 ? 'Esta sem.' : `+${idx} sem`, Receber: 0, Pagar: 0 }); if (o.tipo === 'receber') s.Receber += +o.saldo; else s.Pagar += +o.saldo; });
  const fluxo = Object.keys(semanas).sort().map((k) => semanas[k]);
  let acum = saldoPessoal + saldoComercial;
  const fluxoSaldo = fluxo.map((s) => { acum += s.Receber - s.Pagar; return { ...s, 'Saldo projetado': acum }; });

  const proximos7 = abertas.filter((o: any) => o.vencimento <= addDias(hoje(), 7)).slice(0, 12);

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Dashboard" sub={`${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat rotulo="Patrimônio registrado" valor={brl(patrimonio)} sub="caixa + a receber + estoque − a pagar" icone={<Wallet className="h-4 w-4" />} />
        <Stat rotulo="Saldo disponível" valor={brl(saldoPessoal + saldoComercial)} sub={`Pessoal ${brl(saldoPessoal)} · Negócio ${brl(saldoComercial)}`} />
        <Stat rotulo="A receber" valor={brl(aReceber)} sub={atrasado ? <span className="text-rose-600">{brl(atrasado)} atrasado</span> : 'nada atrasado'} tom={atrasado ? 'alerta' : 'neutro'} />
        <Stat rotulo="A pagar" valor={brl(aPagar)} tom="ruim" />
        <Stat rotulo="Emprestado (ativo)" valor={brl(totalEmprestado)} sub={`saldo devedor ${brl(saldoDevedor)}`} />
        <Stat rotulo="Lucro com juros" valor={brl(juros)} sub="recebido no período" tom="bom" />
        <Stat rotulo="Faturamento" valor={brl(faturamento)} sub={`${vendas.length} vendas`} />
        <Stat rotulo="Lucro das vendas" valor={brl(lucroVendas)} sub={semCusto ? `${semCusto} venda(s) sem custo` : `margem ${pct(faturamento ? (lucroVendas / faturamento) * 100 : null)}`} tom="bom" />
        <Stat rotulo="Despesas pessoais" valor={brl(despPessoais)} tom="ruim" />
        <Stat rotulo="Estoque (custo)" valor={brl(valorEstoque)} sub={`${produtos.length} produtos`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card titulo="Receitas × despesas">
          <ResponsiveContainer width="100%" height={240}><BarChart data={serie}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" /><YAxis tickFormatter={(v) => num(v / 1000, 0) + 'k'} width={40} /><Tooltip {...tip} /><Legend /><Bar dataKey="Receitas" fill="#10B981" radius={[6, 6, 0, 0]} /><Bar dataKey="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </Card>
        <Card titulo="Faturamento × lucro das vendas">
          <ResponsiveContainer width="100%" height={240}><LineChart data={serie}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" /><YAxis tickFormatter={(v) => num(v / 1000, 0) + 'k'} width={40} /><Tooltip {...tip} /><Legend /><Line dataKey="Faturamento" stroke="#0F766E" strokeWidth={2} /><Line dataKey="Lucro" stroke="#F59E0B" strokeWidth={2} /></LineChart></ResponsiveContainer>
        </Card>
        <Card titulo="Fluxo de caixa futuro (90 dias)">
          {fluxoSaldo.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={fluxoSaldo}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="semana" /><YAxis tickFormatter={(v) => num(v / 1000, 0) + 'k'} width={40} /><Tooltip {...tip} /><Legend /><Bar dataKey="Receber" fill="#10B981" /><Bar dataKey="Pagar" fill="#EF4444" /></BarChart></ResponsiveContainer> : <p className="text-sm text-slate-500">Sem vencimentos nos próximos 90 dias.</p>}
        </Card>
        <Card titulo="Emprestado × recebido de empréstimos">
          <ResponsiveContainer width="100%" height={240}><AreaChart data={serie}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" /><YAxis tickFormatter={(v) => num(v / 1000, 0) + 'k'} width={40} /><Tooltip {...tip} /><Legend /><Area dataKey="Emprestado" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} /><Area dataKey="Recebido" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.2} /></AreaChart></ResponsiveContainer>
        </Card>
        <Card titulo="Distribuição das despesas">
          {pizza.length ? <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={pizza} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{pizza.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}</Pie><Tooltip {...tip} /><Legend /></PieChart></ResponsiveContainer> : <p className="text-sm text-slate-500">Sem despesas no período.</p>}
        </Card>
        <Card titulo="Produtos mais vendidos">
          {topProd.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={topProd} layout="vertical"><XAxis type="number" /><YAxis type="category" dataKey="nome" width={90} /><Tooltip contentStyle={tip.contentStyle} /><Bar dataKey="Quantidade" fill="#0F766E" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer> : <p className="text-sm text-slate-500">Sem vendas no período.</p>}
        </Card>
        <Card titulo="Clientes que mais compram">
          {topCli.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={topCli} layout="vertical"><XAxis type="number" tickFormatter={(v) => num(v / 1000, 1) + 'k'} /><YAxis type="category" dataKey="nome" width={110} /><Tooltip {...tip} /><Bar dataKey="Valor" fill="#0EA5E9" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer> : <p className="text-sm text-slate-500">Sem vendas no período.</p>}
        </Card>
        <Card titulo={<span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-amber-500" />Alertas de estoque</span>}>
          <Tabela linhas={alertas} chave="nome" vazio="Nenhum alerta." colunas={[
            { k: 'nome', t: 'Produto' }, { k: 'alerta', t: 'Alerta', r: (a) => <Badge s={a.alerta === 'estoque_baixo' ? 'parcial' : 'atrasado'}>{a.alerta.replace(/_/g, ' ')}</Badge> },
            { k: 'estoque_atual', t: 'Qtd', num: true, r: (a) => num(a.estoque_atual) }, { k: 'validade', t: 'Validade', r: (a) => dataBR(a.validade) },
          ]} />
        </Card>
      </div>
      <Card titulo="Vencimentos dos próximos 7 dias (e atrasados)" acao={<a href="#/contas" className="text-xs text-teal-700">ver todos</a>}>
        <Tabela linhas={proximos7} vazio="Nenhum vencimento próximo." colunas={[
          { k: 'descricao', t: 'Descrição', r: (o) => <span>{o.tipo === 'receber' ? '↓ ' : '↑ '}{o.descricao}</span> },
          { k: 'pessoa', t: 'Quem', r: (o) => o.cliente_nome ?? o.fornecedor_nome ?? '—' },
          { k: 'vencimento', t: 'Vencimento', r: (o) => dataBR(o.vencimento) },
          { k: 'saldo', t: 'Saldo', num: true, r: (o) => brl(o.saldo) },
          { k: 'situacao', t: 'Situação', r: (o) => <Badge s={o.situacao} /> },
        ]} />
      </Card>
    </div>
  );
}
