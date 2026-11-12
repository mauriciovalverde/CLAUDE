import { useState } from 'react';
import { Plus } from 'lucide-react';
import { usePeriodo } from '../lib/periodo';
import { carregar, somar } from '../lib/dados';
import { brl, cod, dataBR } from '../lib/fmt';
import { Abas, Badge, Btn, Cabecalho, Card, Input, Select, Stat, Tabela, useDados } from '../components/ui';
import { AcoesLembrete, AgendaIcone, CobrancaEmailModal, NovaContaModal, PagarModal, VencimentoModal } from '../components/Acoes';
import { Mail } from 'lucide-react';

const ABAS = [
  { id: 'todas', t: 'Todas' }, { id: 'rec_vendas', t: 'Receber · vendas' }, { id: 'rec_emp', t: 'Receber · empréstimos' },
  { id: 'pag_forn', t: 'Pagar · fornecedores' }, { id: 'pessoais', t: 'Despesas pessoais' }, { id: 'parcelas', t: 'Parcelamentos' },
];

export default function Contas({ params }: { params?: URLSearchParams }) {
  const { periodo } = usePeriodo();
  const [aba, setAba] = useState(params?.get('aba') ?? 'todas');
  const [situacao, setSituacao] = useState('abertas');
  const [busca, setBusca] = useState('');
  const [usarPeriodo, setUsarPeriodo] = useState(false);
  const [pagar, setPagar] = useState<any>(null);
  const [venc, setVenc] = useState<any>(null);
  const [nova, setNova] = useState(false);
  const [cobrar, setCobrar] = useState<any>(null);
  const { dados } = useDados(() => carregar.obrigacoes(usarPeriodo ? { de: periodo.de, ate: periodo.ate } : {}), [usarPeriodo, periodo.de, periodo.ate]);

  const filtro = (o: any) => {
    if (aba === 'rec_vendas' && !(o.tipo === 'receber' && o.origem === 'venda')) return false;
    if (aba === 'rec_emp' && o.origem !== 'emprestimo') return false;
    if (aba === 'pag_forn' && !(o.tipo === 'pagar' && o.origem === 'compra')) return false;
    if (aba === 'pessoais' && !(o.escopo === 'pessoal' && o.tipo === 'pagar')) return false;
    if (aba === 'parcelas' && o.parcela_total <= 1) return false;
    if (situacao === 'abertas' && !['pendente', 'parcial', 'atrasado'].includes(o.situacao)) return false;
    if (situacao !== 'abertas' && situacao !== 'todas' && o.situacao !== situacao) return false;
    if (busca && !`${o.descricao} ${o.cliente_nome ?? ''} ${o.fornecedor_nome ?? ''} ${o.categoria_nome ?? ''}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  };
  const linhas = dados?.filter(filtro) ?? null;
  const abertas = (dados ?? []).filter((o) => ['pendente', 'parcial', 'atrasado'].includes(o.situacao));

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Contas a pagar e a receber" sub="Central unificada de obrigações com vencimento" acoes={<Btn onClick={() => setNova(true)}><Plus className="h-4 w-4" />Nova conta</Btn>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat rotulo="A receber" valor={brl(somar(abertas, 'saldo', (o) => o.tipo === 'receber'))} tom="bom" />
        <Stat rotulo="Receber atrasado" valor={brl(somar(abertas, 'saldo', (o) => o.tipo === 'receber' && o.situacao === 'atrasado'))} tom="alerta" />
        <Stat rotulo="A pagar" valor={brl(somar(abertas, 'saldo', (o) => o.tipo === 'pagar'))} tom="ruim" />
        <Stat rotulo="Pagar atrasado" valor={brl(somar(abertas, 'saldo', (o) => o.tipo === 'pagar' && o.situacao === 'atrasado'))} tom="ruim" />
      </div>
      <Card>
        <Abas abas={ABAS} ativa={aba} mudar={setAba} />
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <Input placeholder="Buscar por cliente, fornecedor, categoria…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Select value={situacao} onChange={(e) => setSituacao(e.target.value)}>
            <option value="abertas">Em aberto</option><option value="atrasado">Atrasadas</option><option value="parcial">Parciais</option><option value="pago">Pagas</option><option value="todas">Todas</option>
          </Select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={usarPeriodo} onChange={(e) => setUsarPeriodo(e.target.checked)} />Só vencimentos do período selecionado</label>
        </div>
        <Tabela linhas={linhas} vazio="Nenhuma conta com esses filtros." colunas={[
          { k: 'descricao', t: 'Descrição', r: (o) => <span><span className={o.tipo === 'receber' ? 'text-emerald-600' : 'text-rose-600'}>{o.tipo === 'receber' ? '↓' : '↑'}</span> {o.descricao}{o.parcela_total > 1 && <span className="text-slate-400"> ({o.parcela_num}/{o.parcela_total})</span>}</span> },
          { k: 'pessoa', t: 'Cliente/Fornecedor', r: (o) => o.cliente_nome ?? o.fornecedor_nome ?? o.categoria_nome ?? '—' },
          { k: 'escopo', t: 'Escopo', esconderCelular: true },
          { k: 'vencimento', t: 'Vencimento', r: (o) => <span>{dataBR(o.vencimento)}{o.dias_atraso > 0 && o.situacao === 'atrasado' && <span className="text-rose-600"> · {o.dias_atraso}d</span>}</span> },
          { k: 'valor', t: 'Valor', num: true, r: (o) => brl(o.valor) },
          { k: 'saldo', t: 'Saldo', num: true, r: (o) => <strong>{brl(o.saldo)}</strong> },
          { k: 'situacao', t: 'Situação', r: (o) => <Badge s={o.situacao} /> },
          { k: 'agenda', t: 'Agenda', r: (o) => <AgendaIcone o={o} /> },
          { k: 'acoes', t: '', r: (o) => ['pendente', 'parcial', 'atrasado'].includes(o.situacao) ? <div className="flex justify-end gap-1"><Btn variante="secundario" className="!px-2 !py-1 text-xs" onClick={() => setPagar(o)}>{o.tipo === 'receber' ? 'Receber' : 'Pagar'}</Btn><Btn variante="fantasma" className="!px-2 !py-1 text-xs" onClick={() => setVenc(o)}>Prorrogar</Btn><AcoesLembrete o={o} aoEmailGmail={setCobrar} /></div> : <span className="text-xs text-slate-400">{cod('OB', o.numero)}</span> },
        ]} />
      </Card>
      <PagarModal o={pagar} fechar={() => setPagar(null)} />
      <VencimentoModal o={venc} fechar={() => setVenc(null)} />
      <NovaContaModal aberto={nova} fechar={() => setNova(false)} />
      <CobrancaEmailModal o={cobrar} fechar={() => setCobrar(null)} />
    </div>
  );
}
