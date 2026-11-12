import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { carregar } from '../lib/dados';
import { brl, fimMes, hoje, mesNome, num, pct, compacto } from '../lib/fmt';
// @ts-ignore
import { crescimentoPct } from '../lib/calculos.js';
import { Cabecalho, Card, Input, Select, Tabela, useDados } from '../components/ui';

function Var({ rotulo, a, b, fmt = brl }: { rotulo: string; a: number; b: number; fmt?: (v: number) => string }) {
  const c = crescimentoPct(a, b);
  const I = c == null || c === 0 ? Minus : c > 0 ? ArrowUpRight : ArrowDownRight;
  const cor = c == null || c === 0 ? 'text-slate-500' : c > 0 ? 'text-emerald-600' : 'text-rose-600';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{fmt(b)}</div>
      <div className={`mt-0.5 flex items-center gap-1 text-sm ${cor}`}><I className="h-4 w-4" />{c == null ? 'sem base anterior' : `${c > 0 ? '+' : ''}${pct(c)}`}<span className="text-slate-400">· antes {fmt(a)}</span></div>
    </div>
  );
}

export default function Comparativo() {
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [base, setBase] = useState<'anterior' | 'ano'>('anterior');
  const ref = new Date(mes + '-15T12:00:00Z');
  const anterior = base === 'anterior' ? new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 15)) : new Date(Date.UTC(ref.getUTCFullYear() - 1, ref.getUTCMonth(), 15));
  const mesAnt = anterior.toISOString().slice(0, 7);
  const { dados } = useDados(async () => {
    const [mensal, va, vb] = await Promise.all([carregar.vendasMensal(), carregar.vendas(mesAnt + '-01', fimMes(mesAnt + '-01')), carregar.vendas(mes + '-01', fimMes(mes + '-01'))]);
    return { mensal, va, vb };
  }, [mes, mesAnt]);
  const d: any = dados ?? { mensal: [], va: [], vb: [] };
  const linha = (m: string) => d.mensal.find((x: any) => x.mes.slice(0, 7) === m) ?? {};
  const A = linha(mesAnt), B = linha(mes);
  const n = (x: any) => Number(x ?? 0);
  const ultimos = d.mensal.slice(-12).map((x: any) => ({ mes: mesNome(x.mes), Faturamento: n(x.faturamento), 'Lucro bruto': n(x.lucro_bruto), 'Ticket médio': n(x.ticket_medio) }));
  const rank = (vs: any[]) => { const m = new Map<string, number>(); vs.forEach((v) => v.venda_itens.forEach((i: any) => m.set(i.produtos?.nome, (m.get(i.produtos?.nome) ?? 0) + +i.quantidade))); return m; };
  const ra = rank(d.va), rb = rank(d.vb);
  const top = [...new Set([...ra.keys(), ...rb.keys()])].map((nome) => ({ nome, antes: ra.get(nome) ?? 0, agora: rb.get(nome) ?? 0 })).sort((x, y) => y.agora - x.agora).slice(0, 10);
  const fatC = crescimentoPct(n(A.faturamento), n(B.faturamento)), lucC = crescimentoPct(n(A.lucro_bruto), n(B.lucro_bruto));

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Comparativo de crescimento" sub="Faturamento e lucro sempre separados"
        acoes={<><Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="!w-auto" /><Select value={base} onChange={(e) => setBase(e.target.value as any)} className="!w-auto"><option value="anterior">vs mês anterior</option><option value="ano">vs mesmo mês do ano anterior</option></Select></>} />
      <Card><p className="text-sm">
        <strong>{mesNome(mesAnt)}:</strong> {brl(n(A.faturamento))} em vendas · <strong>{mesNome(mes)}:</strong> {brl(n(B.faturamento))} em vendas ·{' '}
        <strong className={fatC != null && fatC < 0 ? 'text-rose-600' : 'text-emerald-600'}>{fatC == null ? 'sem base para comparar' : `${fatC >= 0 ? 'Crescimento' : 'Queda'} de ${pct(Math.abs(fatC))} no faturamento`}</strong>
        {lucC != null && <>; o lucro bruto {lucC >= 0 ? 'cresceu' : 'caiu'} {pct(Math.abs(lucC))}.</>}
      </p></Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Var rotulo="Faturamento" a={n(A.faturamento)} b={n(B.faturamento)} />
        <Var rotulo="Lucro bruto" a={n(A.lucro_bruto)} b={n(B.lucro_bruto)} />
        <Var rotulo="Nº de vendas" a={n(A.qtd_vendas)} b={n(B.qtd_vendas)} fmt={(v) => num(v)} />
        <Var rotulo="Itens vendidos" a={n(A.qtd_itens)} b={n(B.qtd_itens)} fmt={(v) => num(v)} />
        <Var rotulo="Ticket médio" a={n(A.ticket_medio)} b={n(B.ticket_medio)} />
        <Var rotulo="Margem média" a={n(A.margem_media_pct)} b={n(B.margem_media_pct)} fmt={(v) => pct(v)} />
        <Var rotulo="Clientes novos" a={n(A.clientes_novos)} b={n(B.clientes_novos)} fmt={(v) => num(v)} />
        <Var rotulo="Clientes recorrentes" a={n(A.clientes_recorrentes)} b={n(B.clientes_recorrentes)} fmt={(v) => num(v)} />
        <Var rotulo="Clientes ativos" a={n(A.clientes_ativos)} b={n(B.clientes_ativos)} fmt={(v) => num(v)} />
        <Var rotulo="Custo (CMV)" a={n(A.cmv)} b={n(B.cmv)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card titulo="Evolução (12 meses)"><ResponsiveContainer width="100%" height={240}><LineChart data={ultimos}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" /><YAxis width={45} tickFormatter={compacto} /><Tooltip formatter={(v: any) => brl(v)} /><Legend /><Line dataKey="Faturamento" stroke="#0F766E" strokeWidth={2} /><Line dataKey="Lucro bruto" stroke="#F59E0B" strokeWidth={2} /></LineChart></ResponsiveContainer></Card>
        <Card titulo="Produtos mais vendidos (qtd)"><ResponsiveContainer width="100%" height={240}><BarChart data={top}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="nome" /><YAxis width={30} /><Tooltip /><Legend /><Bar dataKey="antes" name={mesNome(mesAnt)} fill="#94A3B8" /><Bar dataKey="agora" name={mesNome(mes)} fill="#0F766E" /></BarChart></ResponsiveContainer></Card>
      </div>
      <Card titulo="Histórico mensal">
        <Tabela linhas={dados ? [...d.mensal].reverse() : null} chave="mes" vazio="Sem vendas registradas." colunas={[
          { k: 'mes', t: 'Mês', r: (x) => mesNome(x.mes) }, { k: 'faturamento', t: 'Faturamento', num: true, r: (x) => brl(x.faturamento) },
          { k: 'lucro_bruto', t: 'Lucro bruto', num: true, r: (x) => brl(x.lucro_bruto) }, { k: 'margem_media_pct', t: 'Margem', num: true, r: (x) => pct(x.margem_media_pct) },
          { k: 'qtd_vendas', t: 'Vendas', num: true }, { k: 'ticket_medio', t: 'Ticket', num: true, r: (x) => brl(x.ticket_medio) }, { k: 'clientes_novos', t: 'Novos', num: true },
        ]} />
      </Card>
    </div>
  );
}
