import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { agrupar, carregarPeriodo, indicadores, variacao, variacaoPrecos } from '../lib/analise';
// @ts-ignore módulo JS testado
import { nomeCategoria } from '../lib/catalogo.js';
import { addMeses, brl, compacto, fimMes, inicioMes, mesLongo, pct } from '../lib/fmt';
import { Card, Carregando, Input, Tabela, useDados } from '../components/ui';

export default function Comparativo() {
  const [a, setA] = useState(addMeses(inicioMes(), -1).slice(0, 7));
  const [b, setB] = useState(inicioMes().slice(0, 7));
  const { dados } = useDados(async () => {
    const [pa, pb] = await Promise.all([carregarPeriodo(a + '-01', fimMes(a + '-01')), carregarPeriodo(b + '-01', fimMes(b + '-01'))]);
    return { pa, pb };
  }, [a, b]);
  const r = useMemo(() => {
    if (!dados) return null;
    const ia = indicadores(dados.pa), ib = indicadores(dados.pb);
    const linhas = [
      ['Faturamento líquido', ia.liquido, ib.liquido], ['Faturamento bruto', ia.bruto, ib.bruto], ['Despesas lançadas', ia.despesasLancadas, ib.despesasLancadas],
      ['Compras', ia.compras, ib.compras], ['Custo de mercadorias', ia.cmv, ib.cmv], ['Margem bruta', ia.margemBruta, ib.margemBruta],
      ['Resultado operacional (estimado)', ia.resultado, ib.resultado], ['Ticket médio', ia.ticket ?? 0, ib.ticket ?? 0], ['Quantidade de vendas', ia.qtdVendas, ib.qtdVendas],
    ].map(([nome, x, y]) => ({ nome: nome as string, a: x as number, b: y as number, pct: variacao(x as number, y as number), qtd: nome === 'Quantidade de vendas' }));
    const juntar = (fa: any[], fb: any[]) => { const m = new Map<string, { nome: string; a: number; b: number }>(); for (const x of fa) m.set(x.nome, { nome: x.nome, a: x.total, b: 0 }); for (const x of fb) m.set(x.nome, { ...(m.get(x.nome) ?? { nome: x.nome, a: 0 }), b: x.total }); return [...m.values()].map((x) => ({ ...x, pct: variacao(x.a, x.b) })).sort((p, q) => q.b - p.b); };
    const cat = juntar(agrupar(dados.pa.itens, (i) => nomeCategoria(i.categoria), (i) => +i.valor_total), agrupar(dados.pb.itens, (i) => nomeCategoria(i.categoria), (i) => +i.valor_total));
    const forn = juntar(agrupar(dados.pa.itens, (i) => i.fornecedor ?? '—', (i) => +i.valor_total), agrupar(dados.pb.itens, (i) => i.fornecedor ?? '—', (i) => +i.valor_total));
    const precos = variacaoPrecos(dados.pa.itens, dados.pb.itens);
    const catPreco = agrupar(precos, (x) => x.categoria, (x) => x.pct).map((c) => ({ ...c, media: Math.round((c.total / precos.filter((x) => x.categoria === c.nome).length) * 10) / 10 })).sort((p, q) => q.media - p.media);
    return { linhas, cat, forn, precos, catPreco };
  }, [dados]);
  const Var = ({ v, inverso }: { v: number | null; inverso?: boolean }) => <span className={v == null ? 'text-slate-400' : (v > 0) !== !!inverso ? 'text-emerald-700' : v === 0 ? '' : 'text-rose-600'}>{pct(v)}</span>;
  const custo = (n: string) => /Despesas|Compras|Custo/.test(n);
  return (
    <div className="space-y-3">
      <div><h1 className="text-2xl font-bold">Comparativo mensal</h1><p className="text-sm text-slate-500">Compare dois meses: o que cresceu, o que encareceu</p></div>
      <Card><div className="grid grid-cols-2 gap-2"><label className="text-sm">Mês A<Input type="month" value={a} onChange={(e) => setA(e.target.value)} /></label><label className="text-sm">Mês B<Input type="month" value={b} onChange={(e) => setB(e.target.value)} /></label></div></Card>
      {!r ? <Carregando /> : <>
        <Card titulo={`${mesLongo(a + '-01')} × ${mesLongo(b + '-01')}`}>
          <Tabela linhas={r.linhas} chave="nome" colunas={[
            { k: 'nome', t: 'Indicador' }, { k: 'a', t: mesLongo(a + '-01'), num: true, r: (x) => x.qtd ? x.a : brl(x.a) }, { k: 'b', t: mesLongo(b + '-01'), num: true, r: (x) => x.qtd ? x.b : brl(x.b) },
            { k: 'pct', t: 'Variação', num: true, r: (x) => <Var v={x.pct} inverso={custo(x.nome)} /> },
          ]} />
          <div className="mt-3 h-60"><ResponsiveContainer><BarChart data={r.linhas.filter((x) => !x.qtd && !/Ticket/.test(x.nome))} margin={{ left: -10 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} /><YAxis tickFormatter={compacto} width={48} /><Tooltip formatter={(v: any) => brl(v)} /><Legend /><Bar isAnimationActive={false} maxBarSize={56} dataKey="a" name={mesLongo(a + '-01')} fill="#94a3b8" /><Bar isAnimationActive={false} maxBarSize={56} dataKey="b" name={mesLongo(b + '-01')} fill="#a3141b" /></BarChart></ResponsiveContainer></div>
        </Card>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card titulo="Gastos por categoria"><Tabela linhas={r.cat} chave="nome" colunas={[{ k: 'nome', t: 'Categoria' }, { k: 'a', t: 'A', num: true, r: (x) => brl(x.a) }, { k: 'b', t: 'B', num: true, r: (x) => brl(x.b) }, { k: 'pct', t: 'Var.', num: true, r: (x) => <Var v={x.pct} inverso /> }]} /></Card>
          <Card titulo="Gastos por fornecedor"><Tabela linhas={r.forn} chave="nome" colunas={[{ k: 'nome', t: 'Fornecedor' }, { k: 'a', t: 'A', num: true, r: (x) => brl(x.a) }, { k: 'b', t: 'B', num: true, r: (x) => brl(x.b) }, { k: 'pct', t: 'Var.', num: true, r: (x) => <Var v={x.pct} inverso /> }]} /></Card>
          <Card titulo="Categorias que mais encareceram (preço médio)"><Tabela linhas={r.catPreco} chave="nome" vazio="Sem produtos comprados nos dois meses." colunas={[{ k: 'nome', t: 'Categoria' }, { k: 'media', t: 'Variação média de preço', num: true, r: (x) => <Var v={x.media} inverso /> }]} /></Card>
          <Card titulo="Produtos que mais subiram de preço"><Tabela linhas={r.precos.slice(0, 15)} chave="produto" vazio="Sem produtos comprados nos dois meses." colunas={[{ k: 'produto', t: 'Produto' }, { k: 'antes', t: 'A', num: true, r: (x) => `${brl(x.antes)}/${x.unidade}` }, { k: 'depois', t: 'B', num: true, r: (x) => brl(x.depois) }, { k: 'pct', t: 'Var.', num: true, r: (x) => <Var v={x.pct} inverso /> }]} /></Card>
        </div>
      </>}
    </div>
  );
}
