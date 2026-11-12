import { useEffect, useState } from 'react';
import { ArrowLeft, FileDown, Plus } from 'lucide-react';
import { ir } from '../App';
import { rpc, sincronizarAgenda, supabase } from '../lib/supabase';
import { carregar, somar } from '../lib/dados';
import { usePeriodo } from '../lib/periodo';
import { addDias, brl, cod, dataBR, hoje, pct } from '../lib/fmt';
// @ts-ignore módulo JS testado (skills/.../scripts/calculos.mjs)
import { calcularEmprestimo, gerarParcelas, taxaMensalEquivalente } from '../lib/calculos.js';
import { Abas, Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Input, Modal, q, Select, Stat, Tabela, toast, useDados } from '../components/ui';
import { AgendaIcone, PagarModal, VencimentoModal } from '../components/Acoes';
import { SeletorCliente } from './Vendas';
import { pdfCondicoesEmprestimo } from '../lib/pdf';

function NovoEmprestimo({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const [cliente, setCliente] = useState<any>(null);
  const [f, setF] = useState<any>({});
  const [limite, setLimite] = useState(1);
  const [ciente, setCiente] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { if (aberto) { setF({ principal: '', taxa_pct: '', periodicidade: 'mensal', modalidade: 'simples', periodos: 1, parcelas: 1, data: hoje(), vencimento: addDias(hoje(), 30) }); setCliente(null); setCiente(false); setErro(''); carregar.config().then((c) => setLimite(Number(c?.limite_juros_mensal_pct ?? 1))); } }, [aberto]);
  if (!aberto) return null;
  const P = Number(String(f.principal).replace(',', '.')), i = Number(String(f.taxa_pct).replace(',', '.')), n = Number(f.periodos);
  const ok = P > 0 && i >= 0 && n > 0;
  const sim = ok ? calcularEmprestimo({ principal: P, taxaPct: i, modalidade: f.modalidade, periodos: n }) : null;
  const dias = Math.max(1, Math.round((new Date(f.vencimento).getTime() - new Date(f.data).getTime()) / 864e5));
  const eq = ok ? taxaMensalEquivalente({ taxaPct: i, periodicidade: f.periodicidade, modalidade: f.modalidade, dias }) : 0;
  const acima = ok && eq > limite;
  const parcelas = sim ? gerarParcelas({ total: sim.total, juros: sim.juros, parcelas: Number(f.parcelas) || 1, vencimentoFinal: f.vencimento }) : [];
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));

  async function salvar() {
    setCarregando(true); setErro('');
    try {
      if (!cliente) throw new Error('Selecione o cliente.');
      if (acima && !ciente) throw new Error('Confirme que está ciente do aviso legal.');
      const r = await rpc('registrar_emprestimo', { p: { cliente_id: cliente.id, principal: P, taxa_pct: i, periodicidade: f.periodicidade, modalidade: f.modalidade, periodos: n, parcelas: Number(f.parcelas), data: f.data, vencimento: f.vencimento, ciente_aviso_legal: ciente, chave_idempotencia: `ui:emp:${cliente.id}:${P}:${f.vencimento}:${Math.floor(Date.now() / 60000)}` } });
      toast(`Empréstimo ${cod('E', r.numero)} registrado: total previsto ${brl(r.total_previsto)}.`);
      sincronizarAgenda(r.obrigacoes.map((o: any) => o.obrigacao_id)).then(avisarMudanca); avisarMudanca(); fechar();
    } catch (e: any) { setErro(e.message); } finally { setCarregando(false); }
  }
  return (
    <Modal aberto titulo="Novo empréstimo" fechar={fechar} largo>
      <div className="space-y-3">
        <Campo rotulo="Cliente"><SeletorCliente valor={cliente} mudar={setCliente} /></Campo>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo rotulo="Valor emprestado (R$)"><Input inputMode="decimal" value={f.principal} onChange={(e) => set('principal', e.target.value)} /></Campo>
          <Campo rotulo="Taxa (%)"><Input inputMode="decimal" value={f.taxa_pct} onChange={(e) => set('taxa_pct', e.target.value)} /></Campo>
          <Campo rotulo="A taxa é"><Select value={f.periodicidade} onChange={(e) => set('periodicidade', e.target.value)}><option value="mensal">ao mês</option><option value="diaria">ao dia</option><option value="semanal">à semana</option><option value="anual">ao ano</option><option value="periodo_total">no período todo</option></Select></Campo>
          <Campo rotulo="Juros"><Select value={f.modalidade} onChange={(e) => set('modalidade', e.target.value)}><option value="simples">Simples</option><option value="composto">Composto</option></Select></Campo>
          <Campo rotulo="Nº de períodos" dica="meses, dias… conforme a taxa"><Input type="number" min={1} step="any" value={f.periodos} onChange={(e) => set('periodos', e.target.value)} /></Campo>
          <Campo rotulo="Parcelas"><Input type="number" min={1} value={f.parcelas} onChange={(e) => set('parcelas', e.target.value)} /></Campo>
          <Campo rotulo="Data"><Input type="date" value={f.data} onChange={(e) => set('data', e.target.value)} /></Campo>
          <Campo rotulo="Vencimento final"><Input type="date" value={f.vencimento} onChange={(e) => set('vencimento', e.target.value)} /></Campo>
        </div>
        {sim && <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50 sm:grid-cols-4">
          <div>Principal<br /><strong>{brl(P)}</strong></div><div>Juros<br /><strong>{brl(sim.juros)}</strong></div>
          <div>Total previsto<br /><strong>{brl(sim.total)}</strong></div><div>Taxa mensal equiv.<br /><strong className={acima ? 'text-rose-600' : ''}>{pct(eq)}</strong></div>
          {parcelas.length > 1 && <div className="col-span-2 text-xs text-slate-500 sm:col-span-4">{parcelas.map((p: any) => `${p.parcela}ª ${brl(p.valor)} em ${dataBR(p.vencimento)}`).join(' · ')}</div>}
        </div>}
        {f.modalidade === 'composto' && ['diaria', 'semanal', 'mensal'].includes(f.periodicidade) && <Aviso tipo="alerta">Capitalização de juros em período inferior a um ano entre particulares é vedada (Dec. 22.626/33, art. 4º; Súmula 121/STF). Prefira juros simples.</Aviso>}
        {acima && <Aviso tipo="erro">
          <strong>⚠️ Aviso legal:</strong> a taxa equivale a {pct(eq)} ao mês, acima da referência configurada ({pct(limite)} a.m.). Para empréstimo entre pessoas físicas a legislação limita os juros (Lei de Usura e Código Civil) e a cobrança acima do permitido pode configurar crime (Lei 1.521/51). O sistema não garante a legalidade desta taxa; consulte um advogado.
          <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />Estou ciente e quero registrar as condições como informadas.</label>
        </Aviso>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar} carregando={carregando} disabled={!ok}>Registrar empréstimo</Btn></div>
    </Modal>
  );
}

function Renegociar({ e, fechar }: { e: any | null; fechar: () => void }) {
  const [f, setF] = useState<any>({ taxa_pct: '', periodicidade: 'mensal', modalidade: 'simples', periodos: 1, parcelas: 1, vencimento: addDias(hoje(), 30), motivo: '' });
  const [ciente, setCiente] = useState(false);
  const [erro, setErro] = useState('');
  if (!e) return null;
  async function salvar() {
    try {
      const r = await rpc('renegociar_emprestimo', { p: { emprestimo_id: e.id, ...f, taxa_pct: Number(String(f.taxa_pct || 0).replace(',', '.')), periodos: Number(f.periodos), parcelas: Number(f.parcelas), ciente_aviso_legal: ciente } });
      toast(`Renegociado: saldo ${brl(r.saldo_renegociado)} → novo total ${brl(r.novo_total)}.`);
      sincronizarAgenda().then(avisarMudanca); avisarMudanca(); fechar();
    } catch (er: any) { setErro(er.message); }
  }
  return (
    <Modal aberto titulo={`Renegociar ${cod('E', e.numero)}`} fechar={fechar}>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Nova taxa (%)"><Input value={f.taxa_pct} onChange={(x) => setF({ ...f, taxa_pct: x.target.value })} /></Campo>
        <Campo rotulo="Base"><Select value={f.periodicidade} onChange={(x) => setF({ ...f, periodicidade: x.target.value })}><option value="mensal">ao mês</option><option value="periodo_total">período todo</option><option value="diaria">ao dia</option></Select></Campo>
        <Campo rotulo="Períodos"><Input type="number" value={f.periodos} onChange={(x) => setF({ ...f, periodos: x.target.value })} /></Campo>
        <Campo rotulo="Parcelas"><Input type="number" value={f.parcelas} onChange={(x) => setF({ ...f, parcelas: x.target.value })} /></Campo>
        <Campo rotulo="Vencimento final"><Input type="date" value={f.vencimento} onChange={(x) => setF({ ...f, vencimento: x.target.value })} /></Campo>
        <Campo rotulo="Motivo"><Input value={f.motivo} onChange={(x) => setF({ ...f, motivo: x.target.value })} /></Campo>
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={ciente} onChange={(x) => setCiente(x.target.checked)} />Ciente do aviso legal, se a taxa ficar acima da referência</label>
      </div>
      {erro && <div className="mt-3"><Aviso tipo="erro">{erro}</Aviso></div>}
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar}>Renegociar</Btn></div>
    </Modal>
  );
}

function Detalhe({ id }: { id: string }) {
  const [pagar, setPagar] = useState<any>(null);
  const [venc, setVenc] = useState<any>(null);
  const [reneg, setReneg] = useState<any>(null);
  const { dados } = useDados(async () => {
    const [e, obr, evs, pags] = await Promise.all([
      q(supabase.from('emprestimos').select('*, clientes(nome,telefone)').eq('id', id).single()),
      carregar.obrigacoes({ origem: 'emprestimo' }).then((l) => l.filter((o) => o.origem_id === id)),
      q<any[]>(supabase.from('emprestimo_eventos').select('*').eq('emprestimo_id', id).order('criado_em')),
      q<any[]>(supabase.from('pagamentos').select('*, obrigacoes!inner(origem_id)').eq('obrigacoes.origem_id', id).is('estornado_em', null).order('data')),
    ]);
    return { e, obr, evs, pags };
  }, [id]);
  if (!dados) return <Cabecalho titulo="Empréstimo" sub="Carregando…" />;
  const { e, obr, evs, pags } = dados as any;
  const saldo = somar(obr, 'saldo', (o) => ['pendente', 'parcial', 'atrasado'].includes(o.situacao));
  const TIPO: Record<string, string> = { criacao: 'Empréstimo concedido', pagamento: 'Parcela quitada', pagamento_parcial: 'Pagamento parcial', prorrogacao: 'Vencimento prorrogado', renegociacao: 'Renegociação', atraso: 'Entrou em atraso', quitacao: 'Empréstimo quitado', estorno: 'Pagamento estornado' };
  return (
    <div className="space-y-4">
      <button onClick={() => ir('emprestimos')} className="flex items-center gap-1 text-sm text-teal-700"><ArrowLeft className="h-4 w-4" />Empréstimos</button>
      <Cabecalho titulo={`${cod('E', e.numero)} · ${e.clientes?.nome}`} sub={`${dataBR(e.data)} · ${e.taxa_pct}% ${e.periodicidade.replace('_', ' ')} · juros ${e.modalidade}`}
        acoes={<><Btn variante="secundario" onClick={() => pdfCondicoesEmprestimo(e, obr, pags)}><FileDown className="h-4 w-4" />Condições PDF</Btn>{saldo > 0 && <Btn variante="secundario" onClick={() => setReneg(e)}>Renegociar</Btn>}</>} />
      <div className="flex flex-wrap gap-2"><Badge s={e.status} />{e.acima_limite_legal && <Badge s="atrasado">⚠️ acima da referência legal ({pct(e.taxa_mensal_equivalente_pct)} a.m.)</Badge>}</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat rotulo="Principal" valor={brl(e.principal)} /><Stat rotulo="Juros previstos" valor={brl(e.juros_previstos)} />
        <Stat rotulo="Total previsto" valor={brl(e.total_previsto)} /><Stat rotulo="Juros recebidos" valor={brl(somar(pags, 'juros_valor'))} tom="bom" />
        <Stat rotulo="Saldo devedor" valor={brl(saldo)} tom={saldo > 0 ? 'alerta' : 'bom'} />
      </div>
      <Card titulo="Condições registradas"><p className="text-sm text-slate-600 dark:text-slate-300">{e.condicoes_texto}</p></Card>
      <Card titulo="Parcelas">
        <Tabela linhas={obr} colunas={[
          { k: 'parcela', t: 'Parcela', r: (o) => `${o.parcela_num}/${o.parcela_total}${o.status === 'renegociado' ? ' (renegociada)' : ''}` },
          { k: 'vencimento', t: 'Vencimento', r: (o) => dataBR(o.vencimento) }, { k: 'valor', t: 'Valor', num: true, r: (o) => brl(o.valor) },
          { k: 'valor_pago', t: 'Pago', num: true, r: (o) => brl(o.valor_pago) }, { k: 'saldo', t: 'Saldo', num: true, r: (o) => brl(o.saldo) },
          { k: 'situacao', t: 'Situação', r: (o) => <Badge s={o.situacao} /> }, { k: 'ag', t: 'Agenda', r: (o) => <AgendaIcone o={o} /> },
          { k: 'a', t: '', r: (o) => ['pendente', 'parcial', 'atrasado'].includes(o.situacao) && <div className="flex gap-1"><Btn variante="secundario" className="!px-2 !py-1 text-xs" onClick={() => setPagar(o)}>Receber</Btn><Btn variante="fantasma" className="!px-2 !py-1 text-xs" onClick={() => setVenc(o)}>Prorrogar</Btn></div> },
        ]} />
      </Card>
      <Card titulo="Histórico">
        <ol className="space-y-2 border-l-2 border-teal-700/30 pl-4 text-sm">{evs.map((ev: any) => (
          <li key={ev.id}><span className="text-xs text-slate-500">{new Date(ev.criado_em).toLocaleString('pt-BR')}</span><div className="font-medium">{TIPO[ev.tipo] ?? ev.tipo}</div>
            <div className="text-xs text-slate-500">{ev.tipo.startsWith('pagamento') ? `${brl(ev.dados.valor)} (juros ${brl(ev.dados.juros)}, principal ${brl(ev.dados.principal)})` : ev.tipo === 'prorrogacao' ? `${dataBR(ev.dados.de)} → ${dataBR(ev.dados.para)}${ev.dados.motivo ? ` · ${ev.dados.motivo}` : ''}` : ev.tipo === 'renegociacao' ? `saldo ${brl(ev.dados.saldo_renegociado)} → ${brl(ev.dados.novo_total)}` : ''}</div></li>))}</ol>
      </Card>
      <PagarModal o={pagar} fechar={() => setPagar(null)} />
      <VencimentoModal o={venc} fechar={() => setVenc(null)} />
      <Renegociar e={reneg} fechar={() => setReneg(null)} />
    </div>
  );
}

export default function Emprestimos({ id }: { id?: string }) {
  const { periodo } = usePeriodo();
  const [aba, setAba] = useState('ativos');
  const [novo, setNovo] = useState(false);
  const { dados } = useDados(async () => {
    const [emps, obr, pags] = await Promise.all([carregar.emprestimos(), carregar.obrigacoes({ origem: 'emprestimo' }), carregar.pagamentos(periodo.de, periodo.ate)]);
    return { emps, obr, pags: pags.filter((p: any) => p.obrigacoes?.origem === 'emprestimo') };
  }, [periodo.de, periodo.ate]);
  if (id) return <Detalhe id={id} />;
  const d: any = dados ?? { emps: null, obr: [], pags: [] };
  const saldoPor = (eid: string) => somar(d.obr, 'saldo', (o) => o.origem_id === eid && ['pendente', 'parcial', 'atrasado'].includes(o.situacao));
  const filtro = (e: any) => aba === 'todos' || (aba === 'ativos' ? ['ativo', 'renegociado'].includes(e.status) : e.status === aba);
  const ativos = (d.emps ?? []).filter((e: any) => ['ativo', 'atrasado', 'renegociado'].includes(e.status));
  return (
    <div className="space-y-4">
      <Cabecalho titulo="Empréstimos" sub="Dinheiro emprestado, juros e recebimentos" acoes={<Btn onClick={() => setNovo(true)}><Plus className="h-4 w-4" />Novo empréstimo</Btn>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat rotulo="Emprestado (em aberto)" valor={brl(somar(ativos, 'principal'))} sub={`${ativos.length} contratos`} />
        <Stat rotulo="A receber" valor={brl(somar(d.obr, 'saldo', (o) => ['pendente', 'parcial', 'atrasado'].includes(o.situacao)))} />
        <Stat rotulo="Atrasado" valor={brl(somar(d.obr, 'saldo', (o) => o.situacao === 'atrasado'))} tom="alerta" />
        <Stat rotulo="Lucro com juros (período)" valor={brl(somar(d.pags, 'juros_valor'))} tom="bom" />
      </div>
      <Card>
        <Abas abas={[{ id: 'ativos', t: 'Ativos' }, { id: 'atrasado', t: 'Atrasados' }, { id: 'quitado', t: 'Quitados' }, { id: 'renegociado', t: 'Renegociados' }, { id: 'todos', t: 'Todos' }]} ativa={aba} mudar={setAba} />
        <Tabela linhas={d.emps?.filter(filtro) ?? null} aoClicar={(e) => ir(`emprestimos/${e.id}`)} vazio="Nenhum empréstimo." colunas={[
          { k: 'numero', t: 'Nº', r: (e) => cod('E', e.numero) }, { k: 'cliente', t: 'Cliente', r: (e) => e.clientes?.nome },
          { k: 'data', t: 'Data', r: (e) => dataBR(e.data) }, { k: 'principal', t: 'Principal', num: true, r: (e) => brl(e.principal) },
          { k: 'taxa', t: 'Taxa', r: (e) => <span>{e.taxa_pct}% {e.periodicidade === 'periodo_total' ? 'período' : e.periodicidade}{e.acima_limite_legal && ' ⚠️'}</span> },
          { k: 'total_previsto', t: 'Total previsto', num: true, r: (e) => brl(e.total_previsto) },
          { k: 'saldo', t: 'Saldo devedor', num: true, r: (e) => brl(saldoPor(e.id)) },
          { k: 'vencimento', t: 'Vencimento', r: (e) => dataBR(e.vencimento) }, { k: 'status', t: 'Situação', r: (e) => <Badge s={e.status} /> },
        ]} />
      </Card>
      <NovoEmprestimo aberto={novo} fechar={() => setNovo(false)} />
    </div>
  );
}
