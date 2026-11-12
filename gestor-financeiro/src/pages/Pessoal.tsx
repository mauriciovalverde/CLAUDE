import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import { usePeriodo } from '../lib/periodo';
import { carregar, mesesEntre, porMes, somar } from '../lib/dados';
import { brl, dataBR, mesNome, num } from '../lib/fmt';
import { Abas, avisarMudanca, Badge, Btn, Cabecalho, Card, q, Stat, Tabela, toast, useDados } from '../components/ui';
import { AgendaIcone, NovaContaModal, PagarModal } from '../components/Acoes';
import { CORES } from './Dashboard';

export default function Pessoal() {
  const { periodo } = usePeriodo();
  const [aba, setAba] = useState('contas');
  const [nova, setNova] = useState(false);
  const [pagar, setPagar] = useState<any>(null);
  const { dados } = useDados(async () => {
    const [lanc, obr, rec] = await Promise.all([
      carregar.lancamentos(periodo.de, periodo.ate).then((l) => l.filter((x) => x.escopo === 'pessoal')),
      carregar.obrigacoes({ escopo: 'pessoal' }),
      q<any[]>(supabase.from('recorrencias').select('*, categorias(nome)').eq('escopo', 'pessoal').is('excluido_em', null).order('dia_vencimento')),
    ]);
    return { lanc, obr, rec };
  }, [periodo.de, periodo.ate]);
  const d: any = dados ?? { lanc: [], obr: null, rec: null };
  const receitas = somar(d.lanc, 'valor', (l) => l.tipo === 'entrada' && l.natureza === 'operacional');
  const despesas = somar(d.lanc, 'valor', (l) => l.tipo === 'saida' && l.natureza === 'operacional');
  const doPeriodo = (d.obr ?? []).filter((o: any) => o.vencimento >= periodo.de && o.vencimento <= periodo.ate && o.tipo === 'pagar');
  const meses = mesesEntre(periodo.de, periodo.ate);
  const r = porMes(d.lanc.filter((l: any) => l.tipo === 'entrada'), (l: any) => l.data, (l: any) => +l.valor);
  const dsp = porMes(d.lanc.filter((l: any) => l.tipo === 'saida'), (l: any) => l.data, (l: any) => +l.valor);
  let acum = 0;
  const serie = meses.map((m) => { acum += (r.get(m) ?? 0) - (dsp.get(m) ?? 0); return { mes: mesNome(m), Receitas: r.get(m) ?? 0, Despesas: dsp.get(m) ?? 0, 'Saldo acumulado': acum }; });
  const cat = new Map<string, number>();
  d.lanc.filter((l: any) => l.tipo === 'saida').forEach((l: any) => cat.set(l.categorias?.nome ?? 'Outras', (cat.get(l.categorias?.nome ?? 'Outras') ?? 0) + +l.valor));
  const pizza = [...cat].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  async function pausar(rc: any) {
    await supabase.from('recorrencias').update({ ativa: !rc.ativa }).eq('id', rc.id); toast(rc.ativa ? 'Recorrência pausada.' : 'Recorrência reativada.'); avisarMudanca();
  }
  return (
    <div className="space-y-4">
      <Cabecalho titulo="Finanças pessoais" sub="Separadas do negócio (escopo pessoal)" acoes={<Btn onClick={() => setNova(true)}><Plus className="h-4 w-4" />Nova despesa/receita</Btn>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat rotulo="Receitas" valor={brl(receitas)} tom="bom" /><Stat rotulo="Despesas" valor={brl(despesas)} tom="ruim" />
        <Stat rotulo="Saldo do período" valor={brl(receitas - despesas)} tom={receitas - despesas >= 0 ? 'bom' : 'ruim'} />
        <Stat rotulo="Contas pagas" valor={num(doPeriodo.filter((o: any) => o.situacao === 'pago').length)} />
        <Stat rotulo="Pendentes" valor={num(doPeriodo.filter((o: any) => ['pendente', 'parcial'].includes(o.situacao)).length)} />
        <Stat rotulo="Atrasadas" valor={num((d.obr ?? []).filter((o: any) => o.situacao === 'atrasado' && o.tipo === 'pagar').length)} tom="alerta" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card titulo="Evolução financeira">
          <ResponsiveContainer width="100%" height={230}><BarChart data={serie}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" /><YAxis width={45} tickFormatter={(v) => num(v / 1000, 0) + 'k'} /><Tooltip formatter={(v: any) => brl(v)} /><Legend /><Bar dataKey="Receitas" fill="#10B981" radius={[6, 6, 0, 0]} /><Bar dataKey="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </Card>
        <Card titulo="Gastos por categoria">
          {pizza.length ? <ResponsiveContainer width="100%" height={230}><PieChart><Pie data={pizza} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>{pizza.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}</Pie><Tooltip formatter={(v: any) => brl(v)} /><Legend /></PieChart></ResponsiveContainer> : <p className="text-sm text-slate-500">Sem despesas no período.</p>}
        </Card>
      </div>
      <Card>
        <Abas abas={[{ id: 'contas', t: 'Contas do período' }, { id: 'abertas', t: 'Todas em aberto' }, { id: 'recorrentes', t: 'Recorrentes' }, { id: 'extrato', t: 'Extrato' }]} ativa={aba} mudar={setAba} />
        {aba !== 'recorrentes' && aba !== 'extrato' && <Tabela linhas={aba === 'contas' ? doPeriodo : (d.obr ?? []).filter((o: any) => ['pendente', 'parcial', 'atrasado'].includes(o.situacao))} vazio="Nenhuma conta." colunas={[
          { k: 'descricao', t: 'Descrição' }, { k: 'categoria_nome', t: 'Categoria' }, { k: 'vencimento', t: 'Vencimento', r: (o) => dataBR(o.vencimento) },
          { k: 'valor', t: 'Valor', num: true, r: (o) => brl(o.valor) }, { k: 'situacao', t: 'Situação', r: (o) => <Badge s={o.situacao} /> },
          { k: 'ag', t: 'Agenda', r: (o) => <AgendaIcone o={o} /> },
          { k: 'a', t: '', r: (o) => ['pendente', 'parcial', 'atrasado'].includes(o.situacao) && <Btn variante="secundario" className="!px-2 !py-1 text-xs" onClick={() => setPagar(o)}>{o.tipo === 'pagar' ? 'Pagar' : 'Receber'}</Btn> },
        ]} />}
        {aba === 'recorrentes' && <Tabela linhas={d.rec} vazio="Nenhuma recorrência. Marque “repete todo mês” ao lançar uma conta." colunas={[
          { k: 'descricao', t: 'Descrição' }, { k: 'cat', t: 'Categoria', r: (x) => x.categorias?.nome }, { k: 'tipo', t: 'Tipo', r: (x) => x.tipo === 'pagar' ? 'Despesa' : 'Receita' },
          { k: 'dia_vencimento', t: 'Dia', num: true }, { k: 'valor', t: 'Valor', num: true, r: (x) => brl(x.valor) },
          { k: 'ativa', t: 'Situação', r: (x) => <Badge s={x.ativa ? 'ativo' : 'cancelado'}>{x.ativa ? 'ativa' : 'pausada'}</Badge> },
          { k: 'a', t: '', r: (x) => <Btn variante="fantasma" className="!px-2 !py-1 text-xs" onClick={() => pausar(x)}>{x.ativa ? 'Pausar' : 'Reativar'}</Btn> },
        ]} />}
        {aba === 'extrato' && <Tabela linhas={[...d.lanc].reverse()} vazio="Sem lançamentos." colunas={[
          { k: 'data', t: 'Data', r: (l) => dataBR(l.data) }, { k: 'descricao', t: 'Descrição' }, { k: 'cat', t: 'Categoria', r: (l) => l.categorias?.nome },
          { k: 'valor', t: 'Valor', num: true, r: (l) => <span className={l.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}>{l.tipo === 'entrada' ? '+' : '−'}{brl(l.valor)}</span> },
        ]} />}
      </Card>
      <NovaContaModal aberto={nova} fechar={() => setNova(false)} escopoPadrao="pessoal" />
      <PagarModal o={pagar} fechar={() => setPagar(null)} />
    </div>
  );
}
