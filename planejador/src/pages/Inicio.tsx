import { useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Pencil, PlusCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { carregar } from '../lib/dados';
import { brl, dataBR, hoje, mesNome, num } from '../lib/fmt';
// @ts-ignore módulo JS testado
import { projetar } from '../lib/projecao.js';
import { Aviso, avisarMudanca, Badge, Btn, Cabecalho, Card, Input, Modal, Stat, Tabela, toast, useDados } from '../components/ui';

const compacto = (v: number) => (Math.abs(v) >= 1000 ? `${num(v / 1000, Math.abs(v) >= 10000 ? 0 : 1)}k` : num(v, 0));
const nomeMes = (m: string) => new Date(m + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

export default function Inicio() {
  const [editSaldo, setEditSaldo] = useState(false);
  const [saldo, setSaldo] = useState('');
  const [mesAberto, setMesAberto] = useState<string | null>(null);
  const { dados } = useDados(async () => {
    const [cfg, contas, sonhos] = await Promise.all([carregar.config(), carregar.pendentes(), carregar.sonhos()]);
    return { cfg, contas, sonhos, p: projetar({ contas, sonhos, saldoAtual: Number(cfg?.saldo_atual ?? 0), hojeISO: hoje(), meses: 12 } as any) as any };
  }, []);
  if (!dados) return <Cabecalho titulo="Meu ano" sub="Carregando…" />;
  const { cfg, contas, p } = dados;
  const vazio = !contas.length && !dados.sonhos.length;
  const serie = p.meses.map((m: any) => ({ mes: mesNome(m.mes), Entradas: m.receber, Saídas: m.pagar, Sonhos: m.sonhos, 'Saldo previsto': m.saldoAcumulado }));

  async function salvarSaldo() {
    const v = saldo.includes(',') ? Number(saldo.replace(/\./g, '').replace(',', '.')) : Number(saldo);
    if (isNaN(v)) { toast('Valor inválido', 'erro'); return; }
    await supabase.from('plan_config').update({ saldo_atual: v, atualizado_em: new Date().toISOString() }).eq('user_id', cfg.user_id);
    setEditSaldo(false); toast('Saldo atualizado.'); avisarMudanca();
  }
  const contasMes = mesAberto ? contas.filter((c: any) => (c.vencimento.slice(0, 7) < hoje().slice(0, 7) ? hoje().slice(0, 7) : c.vencimento.slice(0, 7)) === mesAberto) : [];

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Meu ano" sub={`Projeção de ${nomeMes(p.meses[0].mes)} a ${nomeMes(p.meses[11].mes)}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">Dinheiro hoje<button onClick={() => { setSaldo(String(cfg?.saldo_atual ?? 0)); setEditSaldo(true); }} className="text-teal-700" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button></div>
          <div className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{brl(cfg?.saldo_atual)}</div>
          <div className="text-xs text-slate-500">toque no lápis para ajustar</div>
        </div>
        <Stat rotulo="Vai entrar (12 meses)" valor={brl(p.totais.receber)} tom="bom" />
        <Stat rotulo="Vai sair (12 meses)" valor={brl(p.totais.pagar)} tom="ruim" sub={p.totais.sonhos ? `+ ${brl(p.totais.sonhos)} para sonhos` : undefined} />
        <Stat rotulo="Saldo no fim" valor={brl(p.saldoFinal)} tom={p.saldoFinal >= 0 ? 'bom' : 'ruim'} sub={nomeMes(p.meses[11].mes)} />
      </div>

      {vazio && <Aviso>👋 Para ver seu ano: 1) toque no lápis e diga quanto dinheiro tem hoje; 2) em <a className="font-semibold underline" href="#/contas">Contas</a> lance salário e contas fixas (marque “todo mês”); 3) em <a className="font-semibold underline" href="#/cartao">Cartão</a> envie o PDF da fatura; 4) crie seus <a className="font-semibold underline" href="#/sonhos">Sonhos</a>.</Aviso>}
      {p.primeiroNegativo && <Aviso tipo="erro"><span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Atenção: em <b>{nomeMes(p.primeiroNegativo)}</b> o dinheiro previsto fica <b>negativo</b>. Veja o mês abaixo e ajuste: adie um gasto, renegocie uma conta ou reduza o valor guardado para os sonhos naquele mês.</span></span></Aviso>}

      <Card titulo="Entradas, saídas e saldo previsto">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={serie}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" /><YAxis tickFormatter={compacto} width={42} /><Tooltip formatter={(v: any) => brl(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} /><Legend />
            <Bar dataKey="Entradas" fill="#10B981" radius={[4, 4, 0, 0]} /><Bar dataKey="Saídas" fill="#EF4444" radius={[4, 4, 0, 0]} /><Bar dataKey="Sonhos" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            <Line dataKey="Saldo previsto" stroke="#0F766E" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card titulo="Mês a mês (toque para ver as contas)">
        <Tabela linhas={p.meses} chave="mes" aoClicar={(m) => setMesAberto(m.mes)} colunas={[
          { k: 'mes', t: 'Mês', r: (m) => <span className="capitalize">{nomeMes(m.mes)}</span> },
          { k: 'receber', t: 'Entra', num: true, r: (m) => <span className="text-emerald-600">{brl(m.receber)}</span> },
          { k: 'pagar', t: 'Sai', num: true, r: (m) => <span className="text-rose-600">{brl(m.pagar)}{m.atrasadoPagar > 0 && <span className="block text-[10px]">inclui {brl(m.atrasadoPagar)} atrasado</span>}</span> },
          { k: 'sonhos', t: 'Sonhos', num: true, r: (m) => <span className="text-violet-600">{brl(m.sonhos)}</span> },
          { k: 'saldoMes', t: 'Sobra do mês', num: true, r: (m) => <span className={m.saldoMes < 0 ? 'text-rose-600' : ''}>{brl(m.saldoMes)}</span> },
          { k: 'saldoAcumulado', t: 'Saldo previsto', num: true, r: (m) => <Badge s={m.negativo ? 'atrasado' : 'pago'}>{brl(m.saldoAcumulado)}</Badge> },
        ]} />
      </Card>

      <Modal aberto={editSaldo} fechar={() => setEditSaldo(false)} titulo="Quanto dinheiro você tem hoje?">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Some o que tem na conta, carteira e caixinhas de uso do dia a dia (o dinheiro dos sonhos fica separado, na tela Sonhos).</p>
        <Input inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} autoFocus />
        <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={() => setEditSaldo(false)}>Cancelar</Btn><Btn onClick={salvarSaldo}>Salvar</Btn></div>
      </Modal>
      <Modal aberto={!!mesAberto} fechar={() => setMesAberto(null)} titulo={mesAberto ? `Contas de ${nomeMes(mesAberto)}` : ''} largo>
        <Tabela linhas={contasMes} vazio="Nenhuma conta pendente neste mês." colunas={[
          { k: 'descricao', t: 'Descrição', r: (c) => <span>{c.tipo === 'receber' ? '↓ ' : '↑ '}{c.descricao}{c.parcela_total ? ` (${c.parcela_num}/${c.parcela_total})` : ''}</span> },
          { k: 'categoria', t: 'Categoria' }, { k: 'vencimento', t: 'Vence', r: (c) => dataBR(c.vencimento) },
          { k: 'valor', t: 'Valor', num: true, r: (c) => <span className={c.tipo === 'receber' ? 'text-emerald-600' : 'text-rose-600'}>{brl(c.valor)}</span> },
        ]} />
        <div className="mt-3 text-right"><a href="#/contas" className="inline-flex items-center gap-1 text-sm font-medium text-teal-700"><PlusCircle className="h-4 w-4" />Lançar conta</a></div>
      </Modal>
    </div>
  );
}
