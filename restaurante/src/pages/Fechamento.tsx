import { useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
import { brl, dataBR, dataHora, hoje, lerNum, TURNOS } from '../lib/fmt';
import { Abas, Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Dinheiro, Input, Modal, q, Select, Tabela, Textarea, toast, useDados } from '../components/ui';

const FORMAS: [string, string][] = [['dinheiro', '💵 Dinheiro'], ['debito', '💳 Cartão de débito'], ['credito', '💳 Cartão de crédito'], ['pix', '⚡ PIX'], ['vale_alimentacao', '🛒 Vale-alimentação'], ['vale_refeicao', '🍽️ Vale-refeição'], ['outros', '➕ Outros']];
const MOVS: [string, string, string][] = [['sangrias', 'Sangrias (retiradas do caixa)', 'dinheiro que saiu da gaveta'], ['reforcos', 'Reforços (entrou troco)', 'dinheiro colocado na gaveta'], ['cancelamentos', 'Cancelamentos', 'vendas canceladas'], ['estornos', 'Estornos', 'devoluções a clientes'], ['descontos', 'Descontos concedidos', '']];
const CAMPOS = ['fundo_troco', ...FORMAS.map((f) => f[0]), ...MOVS.map((m) => m[0]), 'dinheiro_contado', 'valor_sistema'];
const n = (v: any) => (v === '' || v == null ? 0 : lerNum(v) || 0);

export function calcular(f: Record<string, any>) {
  const total = FORMAS.reduce((t, [k]) => t + n(f[k]), 0);
  const esperado = n(f.fundo_troco) + n(f.dinheiro) + n(f.reforcos) - n(f.sangrias);
  const difGaveta = f.dinheiro_contado === '' || f.dinheiro_contado == null ? null : Math.round((n(f.dinheiro_contado) - esperado) * 100) / 100;
  const difSistema = f.valor_sistema === '' || f.valor_sistema == null ? null : Math.round((total - n(f.valor_sistema)) * 100) / 100;
  return { total: Math.round(total * 100) / 100, esperado: Math.round(esperado * 100) / 100, difGaveta, difSistema, liquido: Math.round((total - n(f.estornos)) * 100) / 100 };
}

export default function Fechamento() {
  const { pode } = useEu();
  const [aba, setAba] = useState('meu');
  return (
    <div>
      <Cabecalho titulo="Caixa" sub="1) Abra o caixa com o valor inicial  2) No fim do dia, faça o fechamento" />
      <Abas abas={[{ id: 'meu', t: '🧮 Abrir e fechar' }, ...(pode('admin') ? [{ id: 'conferir', t: '🔍 Conferir' }] : []), { id: 'historico', t: 'Histórico' }]} ativa={aba} mudar={setAba} />
      {aba === 'meu' && <MeuCaixa />}
      {aba === 'conferir' && <Lista status={['encerrado']} />}
      {aba === 'historico' && <Lista />}
    </div>
  );
}

function MeuCaixa() {
  const { eu } = useEu();
  const [data, setData] = useState(hoje());
  const [turno, setTurno] = useState('dia');
  const [abrindo, setAbrindo] = useState(false);
  const [f, setF] = useState<Record<string, any>>({});
  const [reg, setReg] = useState<any>(undefined);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => {
    setReg(undefined);
    supabase.from('rest_fechamentos').select('*').eq('operador_id', eu.id).eq('data', data).eq('turno', turno).maybeSingle().then(({ data: r }) => {
      setReg(r ?? null);
      setF(Object.fromEntries([...CAMPOS.map((k) => [k, r?.[k] == null || (Number(r[k]) === 0 && !['dinheiro_contado', 'valor_sistema'].includes(k)) ? '' : String(r[k]).replace('.', ',')]), ['num_vendas', r?.num_vendas ?? ''], ['obs', r?.obs ?? ''], ['justificativa', r?.justificativa ?? ''], ['outros_desc', r?.outros_desc ?? '']]));
    });
  }, [data, turno, eu.id]);
  const c = calcular(f);
  const bloqueado = reg && ['encerrado', 'conferido'].includes(reg.status);
  const precisaJust = (c.difGaveta != null && Math.abs(c.difGaveta) >= 0.01) || (c.difSistema != null && Math.abs(c.difSistema) >= 0.01);
  const salvar = async (encerrar: boolean) => {
    if (encerrar && precisaJust && !String(f.justificativa ?? '').trim()) { toast('Há diferença no caixa: escreva a justificativa antes de encerrar.', 'erro'); return; }
    setSalvando(true);
    const linha: Record<string, any> = { data, turno, num_vendas: f.num_vendas === '' ? null : Number(f.num_vendas), obs: f.obs || null, justificativa: f.justificativa || null, outros_desc: f.outros_desc || null, status: encerrar ? 'encerrado' : (reg?.status === 'devolvido' ? 'devolvido' : 'aberto') };
    for (const k of CAMPOS) linha[k] = ['dinheiro_contado', 'valor_sistema'].includes(k) ? (f[k] === '' ? null : n(f[k])) : n(f[k]);
    const { data: r, error } = reg ? await supabase.from('rest_fechamentos').update(linha).eq('id', reg.id).select().single() : await supabase.from('rest_fechamentos').insert(linha).select().single();
    setSalvando(false); setConfirmar(false);
    if (error) { toast(error.message.replace(/^.*?: /, ''), 'erro'); return; }
    setReg(r); avisarMudanca();
    toast(encerrar ? 'Caixa fechado e enviado para conferência ✅' : 'Rascunho salvo');
  };
  // abrir o caixa: registra o saldo inicial (dinheiro que o dono deixou no caixa para o dia)
  const abrir = async () => {
    setAbrindo(true);
    const { data: r, error } = await supabase.from('rest_fechamentos').insert({ data, turno, fundo_troco: n(f.fundo_troco), status: 'aberto' }).select().single();
    setAbrindo(false);
    if (error) { toast(error.message.includes('duplicate') ? 'Este caixa já foi aberto.' : error.message, 'erro'); return; }
    setReg(r); avisarMudanca(); toast(`Caixa aberto com saldo inicial de ${brl(r.fundo_troco)} ✅`);
  };
  const campo = (k: string, rot: string, dica?: string) => <Campo rotulo={rot} dica={dica}><Dinheiro valor={f[k] ?? ''} mudar={(v) => setF({ ...f, [k]: v })} disabled={!!bloqueado} className="!py-3 text-lg" placeholder="0,00" /></Campo>;
  if (reg === undefined) return null;
  const diaSemana = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const seletorDia = (
    <div className="grid grid-cols-2 gap-2">
      <Campo rotulo="Data"><Input type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value || hoje())} /></Campo>
      <Campo rotulo="Turno"><Select value={turno} onChange={(e) => setTurno(e.target.value)}>{Object.entries(TURNOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Campo>
    </div>
  );
  return (
    <div className="space-y-3">
      {!reg ? (
        // caixa ainda não aberto: destaque para ABRIR O CAIXA no dia de hoje
        <section className="rounded-3xl border-2 border-brand-700 bg-white p-5 text-center shadow-lg dark:bg-slate-900">
          <Unlock className="mx-auto h-10 w-10 text-brand-700" />
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-brand-700">ABRIR O CAIXA</h2>
          <div className="mt-1 text-lg font-semibold first-letter:uppercase">{diaSemana}</div>
          <div className="text-sm text-slate-500">{data === hoje() ? 'Hoje' : 'Outro dia'} · {TURNOS[turno]}</div>
          <div className="mx-auto mt-4 max-w-xs text-left">
            <Campo rotulo="Valor inicial no caixa" dica="O dinheiro que o dono deixou para troco. Se não deixaram, digite 0."><Dinheiro valor={f.fundo_troco ?? ''} mudar={(v) => setF({ ...f, fundo_troco: v })} className="!py-4 text-center text-3xl font-bold" placeholder="0,00" autoFocus /></Campo>
          </div>
          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 py-5 text-xl font-extrabold text-white shadow-lg transition active:scale-[.99] disabled:opacity-40" disabled={abrindo || f.fundo_troco === '' || f.fundo_troco == null || !(lerNum(f.fundo_troco) >= 0)} onClick={abrir}>
            <Unlock className="h-6 w-6" />{abrindo ? 'Abrindo…' : 'ABRIR O CAIXA'}
          </button>
          <details className="mt-4 text-left text-sm"><summary className="cursor-pointer text-center text-slate-500">Abrir em outro dia ou turno</summary><div className="mt-2">{seletorDia}</div></details>
        </section>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="text-lg font-bold first-letter:uppercase">{diaSemana}</div><div className="text-sm text-slate-500">{TURNOS[turno]}</div></div>
            <Badge s={reg.status} />
          </div>
          {reg.status === 'devolvido' && reg.obs_conferencia && <div className="mt-2 text-sm text-rose-700">Administrador: {reg.obs_conferencia}</div>}
          {bloqueado && <div className="mt-2"><Aviso tipo="info"><Lock className="mr-1 inline h-4 w-4" />Caixa fechado. Para corrigir, peça ao administrador para devolver.</Aviso></div>}
          <div className="mt-3 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300"><Unlock className="h-4 w-4" />Caixa aberto em {dataHora(reg.criado_em)}</div>
            {campo('fundo_troco', 'Valor inicial', 'dinheiro que o dono deixou no caixa para começar o dia')}
          </div>
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-slate-500">Ver outro dia ou turno</summary><div className="mt-2">{seletorDia}</div></details>
        </Card>
      )}
      {reg && <>
      <Card titulo="Recebido em cada forma de pagamento">
        <div className="grid gap-3 sm:grid-cols-2">{FORMAS.map(([k, t]) => <div key={k}>{campo(k, t)}{k === 'outros' && n(f.outros) > 0 && <Input className="mt-1" placeholder="Quais? (ex.: iFood)" value={f.outros_desc} onChange={(e) => setF({ ...f, outros_desc: e.target.value })} disabled={!!bloqueado} />}</div>)}</div>
        <div className="mt-3 grid grid-cols-2 gap-3"><Campo rotulo="Número de vendas"><Input inputMode="numeric" value={f.num_vendas} onChange={(e) => setF({ ...f, num_vendas: e.target.value.replace(/\D/g, '') })} disabled={!!bloqueado} className="!py-3 text-lg" /></Campo>
          <div className="rounded-xl bg-brand-50 p-3 text-right dark:bg-brand-950/40"><div className="text-xs uppercase text-slate-500">Total geral</div><div className="text-2xl font-bold tabular-nums text-brand-700">{brl(c.total)}</div></div></div>
      </Card>
      <Card titulo="Movimentações do caixa">
        <div className="grid gap-3 sm:grid-cols-2">{MOVS.map(([k, t, d]) => <div key={k}>{campo(k, t, d)}</div>)}</div>
      </Card>
      <Card titulo="Conferência">
        <div className="grid gap-3 sm:grid-cols-2">{campo('dinheiro_contado', 'Dinheiro contado na gaveta', 'conte as notas e moedas no fim do turno')}{campo('valor_sistema', 'Total do sistema/PDV (se tiver)', 'o que a máquina ou o sistema mostra')}</div>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>Dinheiro esperado na gaveta (saldo inicial + dinheiro + reforços − sangrias)</span><b className="tabular-nums">{brl(c.esperado)}</b></div>
          {c.difGaveta != null && <div className={`flex justify-between ${Math.abs(c.difGaveta) >= 0.01 ? 'font-semibold text-rose-600' : 'text-emerald-700'}`}><span>Diferença na gaveta</span><span className="tabular-nums">{c.difGaveta > 0 ? 'sobra ' : c.difGaveta < 0 ? 'falta ' : ''}{brl(Math.abs(c.difGaveta))}</span></div>}
          {c.difSistema != null && <div className={`flex justify-between ${Math.abs(c.difSistema) >= 0.01 ? 'font-semibold text-rose-600' : 'text-emerald-700'}`}><span>Informado × sistema</span><span className="tabular-nums">{brl(c.difSistema)}</span></div>}
        </div>
        {precisaJust && <div className="mt-3"><Campo rotulo="Justificativa da diferença (obrigatória)"><Textarea rows={2} value={f.justificativa} onChange={(e) => setF({ ...f, justificativa: e.target.value })} disabled={!!bloqueado} /></Campo></div>}
        <div className="mt-3"><Campo rotulo="Observações"><Textarea rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} disabled={!!bloqueado} /></Campo></div>
      </Card>
      {!bloqueado && <div className="flex flex-col gap-2 sm:flex-row">
        <Btn variante="secundario" className="flex-1 !py-3" carregando={salvando} onClick={() => salvar(false)}>Salvar rascunho</Btn>
        <Btn className="flex-1 !py-3 text-base" disabled={c.total <= 0} onClick={() => setConfirmar(true)}><Lock className="h-5 w-5" />Fazer o fechamento</Btn>
      </div>}
      </>}
      <Modal aberto={confirmar} fechar={() => setConfirmar(false)} titulo="Fazer o fechamento do caixa?">
        <p className="text-sm">Total de <b>{brl(c.total)}</b> em {TURNOS[turno].toLowerCase()} de {dataBR(data)}. Depois do fechamento, só o administrador pode reabrir.</p>
        <Btn className="mt-4 w-full !py-3" carregando={salvando} onClick={() => salvar(true)}>Sim, fechar o caixa</Btn>
      </Modal>
    </div>
  );
}

function Lista({ status }: { status?: string[] }) {
  const { pode } = useEu();
  const [ver, setVer] = useState<any>(null);
  const { dados } = useDados(() => { let x = supabase.from('rest_fechamentos').select('*, operador:rest_funcionarios!rest_fechamentos_operador_id_fkey(nome)').order('data', { ascending: false }).order('criado_em', { ascending: false }).limit(200); if (status) x = x.in('status', status); return q<any[]>(x); }, [status?.join()]);
  return (
    <>
      {status && dados && !dados.length && <Aviso tipo="ok">Nenhum caixa esperando conferência.</Aviso>}
      <Tabela linhas={dados} aoClicar={setVer} vazio="Nenhum fechamento ainda." colunas={[
        { k: 'op', t: 'Operador', r: (r) => r.operador?.nome }, { k: 'd', t: 'Data', r: (r) => `${dataBR(r.data)} · ${TURNOS[r.turno]}` },
        { k: 's', t: 'Situação', r: (r) => <Badge s={r.status} /> },
        { k: 'dif', t: 'Diferença', num: true, r: (r) => { const c = calcular(r); const d = c.difGaveta ?? c.difSistema; return d == null ? '—' : <span className={Math.abs(d) >= 0.01 ? 'font-semibold text-rose-600' : 'text-emerald-700'}>{brl(d)}</span>; }, esconderCelular: true },
        { k: 't', t: 'Total', num: true, r: (r) => <b>{brl(r.total)}</b> },
      ]} />
      {ver && <Conferir r={ver} admin={pode('admin')} fechar={() => setVer(null)} />}
    </>
  );
}

function Conferir({ r, admin, fechar }: { r: any; admin: boolean; fechar: () => void }) {
  const [obs, setObs] = useState(r.obs_conferencia ?? '');
  const c = calcular(r);
  const acao = async (status: string) => {
    const { error } = await supabase.from('rest_fechamentos').update({ status, obs_conferencia: obs || null }).eq('id', r.id);
    if (error) toast(error.message, 'erro'); else { toast(status === 'conferido' ? 'Caixa conferido ✅' : 'Devolvido ao operador para correção'); avisarMudanca(); fechar(); }
  };
  return (
    <Modal aberto fechar={fechar} titulo={`Caixa de ${r.operador?.nome ?? ''} · ${dataBR(r.data)} (${TURNOS[r.turno]})`} largo>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2"><Badge s={r.status} />{r.encerrado_em && <span>encerrado {dataHora(r.encerrado_em)}</span>}{r.conferido_em && <span>· conferido {dataHora(r.conferido_em)}</span>}</div>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {FORMAS.map(([k, t]) => <div key={k} className="flex justify-between border-b py-1 dark:border-slate-800"><span>{t}{k === 'outros' && r.outros_desc ? ` (${r.outros_desc})` : ''}</span><span className="tabular-nums">{brl(r[k])}</span></div>)}
          <div className="flex justify-between border-b py-1 font-bold dark:border-slate-800"><span>Total geral</span><span className="tabular-nums">{brl(c.total)}</span></div>
          <div className="flex justify-between border-b py-1 dark:border-slate-800"><span>Nº de vendas</span><span>{r.num_vendas ?? '—'}{r.num_vendas ? ` · ticket ${brl(c.total / r.num_vendas)}` : ''}</span></div>
          {[['fundo_troco', 'Saldo inicial'], ...MOVS.map(([k, t]) => [k, t])].map(([k, t]) => <div key={k} className="flex justify-between border-b py-1 dark:border-slate-800"><span>{t}</span><span className="tabular-nums">{brl(r[k])}</span></div>)}
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <div className="flex justify-between"><span>Dinheiro esperado na gaveta</span><b>{brl(c.esperado)}</b></div>
          <div className="flex justify-between"><span>Dinheiro contado</span><b>{r.dinheiro_contado != null ? brl(r.dinheiro_contado) : 'não informado'}</b></div>
          {c.difGaveta != null && <div className={`flex justify-between ${Math.abs(c.difGaveta) >= 0.01 ? 'font-semibold text-rose-600' : 'text-emerald-700'}`}><span>Diferença na gaveta</span><span>{brl(c.difGaveta)}</span></div>}
          <div className="flex justify-between"><span>Valor do sistema/PDV</span><b>{r.valor_sistema != null ? brl(r.valor_sistema) : 'não informado'}</b></div>
          {c.difSistema != null && <div className={`flex justify-between ${Math.abs(c.difSistema) >= 0.01 ? 'font-semibold text-rose-600' : 'text-emerald-700'}`}><span>Informado × sistema</span><span>{brl(c.difSistema)}</span></div>}
          <div className="mt-1 flex justify-between border-t pt-1 dark:border-slate-700"><span>Faturamento líquido (recebido − estornos)</span><b>{brl(c.liquido)}</b></div>
        </div>
        {r.justificativa && <Aviso tipo="alerta">Justificativa do operador: {r.justificativa}</Aviso>}
        {r.obs && <p className="text-slate-600">Obs.: {r.obs}</p>}
        {admin && r.status === 'encerrado' && <>
          <Campo rotulo="Observação da conferência"><Input value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
          <div className="flex gap-2"><Btn onClick={() => acao('conferido')}>Conferido ✅</Btn><Btn variante="perigo" onClick={() => acao('devolvido')}>Devolver para correção</Btn></div>
        </>}
        {admin && r.status === 'conferido' && <Btn variante="secundario" onClick={() => acao('devolvido')}>Reabrir (devolver ao operador)</Btn>}
        <p className="text-xs text-slate-500">Toda alteração fica registrada na auditoria (quem, quando, antes e depois).</p>
      </div>
    </Modal>
  );
}
