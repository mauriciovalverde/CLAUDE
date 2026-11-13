import { useMemo, useState } from 'react';
import { Ban, FileSpreadsheet, FileText, History, Paperclip, Pencil, Plus, Send, Trash2, Users } from 'lucide-react';
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
import { enviarPrivado } from '../lib/arquivos';
import { gerarExcel, gerarPDF, type Rel } from '../lib/relatorios';
import { quando, SITUACOES, tempoRestante, type Situacao } from '../lib/comunicados';
import { Prioridade, SituacaoTag } from './Comunicados';
import { Abas, Aviso, avisarMudanca, Btn, Cabecalho, Campo, Card, Input, Modal, q, Select, Stat, Tabela, Textarea, toast, useDados } from '../components/ui';

const SETORES = ['Cozinha', 'Salão', 'Bar', 'Caixa', 'Limpeza', 'Estoque', 'Administração'];
const paraLocal = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const deLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function useBase() {
  return useDados(async () => {
    const [equipe, grupos] = await Promise.all([q<any[]>(supabase.from('rest_funcionarios').select('id, nome, setor, ativo').eq('ativo', true).order('nome')), q<any[]>(supabase.from('rest_grupos').select('*').order('nome'))]);
    return { equipe, grupos };
  }, []);
}

export default function Comunicacao() {
  const [aba, setAba] = useState('painel');
  const [novo, setNovo] = useState(false);
  return (
    <div className="space-y-3">
      <Cabecalho titulo="Comunicação interna" sub="Comunicados no app, com leitura obrigatória, prazo e acompanhamento" acoes={<Btn onClick={() => setNovo(true)}><Plus className="h-4 w-4" />Novo comunicado</Btn>} />
      <Abas abas={[{ id: 'painel', t: 'Comunicados' }, { id: 'relatorio', t: 'Relatório' }, { id: 'grupos', t: 'Grupos' }]} ativa={aba} mudar={setAba} />
      {aba === 'painel' && <Painel />}
      {aba === 'relatorio' && <Relatorio />}
      {aba === 'grupos' && <Grupos />}
      {novo && <Editor fechar={() => setNovo(false)} />}
    </div>
  );
}

function resumo(l: Situacao[]) {
  return {
    total: l.length, enviadas: l.filter((s) => s.disponivel_em).length, entregues: l.filter((s) => s.entregue_em).length, abertas: l.filter((s) => s.aberto_em).length,
    confirmadas: l.filter((s) => s.situacao === 'confirmada').length, expiradas: l.filter((s) => s.situacao === 'prazo_expirado').length,
    pendentes: l.filter((s) => s.status_comunicado === 'enviado' && s.obrigatoria && !['confirmada', 'prazo_expirado'].includes(s.situacao)).length,
  };
}

function Painel() {
  const [f, setF] = useState({ status: '', de: '', ate: '' });
  const [sel, setSel] = useState<string | null>(null);
  const { dados } = useDados(async () => {
    const [coms, sit] = await Promise.all([q<any[]>(supabase.from('rest_comunicados').select('*').order('criado_em', { ascending: false }).limit(200)), q<Situacao[]>(supabase.from('rest_comunicado_situacao').select('*'))]);
    return { coms, sit };
  }, []);
  const lista = useMemo(() => (dados?.coms ?? []).filter((c) => (!f.status || c.status === f.status) && (!f.de || c.enviar_em >= f.de) && (!f.ate || c.enviar_em.slice(0, 10) <= f.ate)), [dados, f]);
  if (!dados) return <div className="p-6 text-center text-sm text-slate-500">Carregando…</div>;
  const geral = resumo(dados.sit.filter((s) => s.status_comunicado === 'enviado' && s.obrigatoria));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat rotulo="Comunicados ativos" valor={dados.coms.filter((c) => c.status === 'enviado').length} sub={`${dados.coms.filter((c) => c.status === 'agendado').length} agendado(s)`} />
        <Stat rotulo="Confirmações" valor={geral.confirmadas} tom="bom" sub="leituras obrigatórias" />
        <Stat rotulo="Pendentes" valor={geral.pendentes} tom={geral.pendentes ? 'alerta' : 'neutro'} />
        <Stat rotulo="Prazo expirado" valor={geral.expiradas} tom={geral.expiradas ? 'ruim' : 'neutro'} />
      </div>
      <Card>
        <div className="grid grid-cols-3 gap-2">
          <Campo rotulo="Situação"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Todas</option><option value="agendado">Agendados</option><option value="enviado">Enviados</option><option value="cancelado">Cancelados</option></Select></Campo>
          <Campo rotulo="De"><Input type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></Campo>
          <Campo rotulo="Até"><Input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></Campo>
        </div>
      </Card>
      {!lista.length ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Nenhum comunicado. Toque em “Novo comunicado”.</div> :
        <div className="space-y-2">{lista.map((c) => {
          const r = resumo(dados.sit.filter((s) => s.comunicado_id === c.id)); const base = c.obrigatoria ? r.confirmadas : r.abertas; const pct = r.total ? Math.round((base / r.total) * 100) : 0;
          return (
            <button key={c.id} onClick={() => setSel(c.id)} className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-1.5"><Prioridade p={c.prioridade} />{c.obrigatoria && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-slate-900">Obrigatória</span>}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${c.status === 'cancelado' ? 'bg-slate-200 text-slate-500' : c.status === 'agendado' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'}`}>{c.status === 'agendado' ? `Agendado para ${quando(c.enviar_em)}` : c.status === 'cancelado' ? 'CANCELADO' : `Enviado ${quando(c.enviado_em)}`}</span></div>
              <div className="mt-1 font-semibold">{c.titulo}</div>
              {c.status !== 'agendado' && <>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                <div className="mt-1 text-xs text-slate-500">{c.obrigatoria ? `${r.confirmadas} de ${r.total} confirmaram` : `${r.abertas} de ${r.total} abriram`}{r.expiradas ? ` · ${r.expiradas} com prazo expirado` : ''}{c.prazo ? ` · prazo ${quando(c.prazo)}` : ''}{c.versao > 1 ? ` · versão ${c.versao}` : ''}</div>
              </>}
            </button>);
        })}</div>}
      {sel && <Detalhe id={sel} fechar={() => setSel(null)} />}
    </div>
  );
}

const CORES_SIT: Record<string, string> = { confirmada: '#059669', lida: '#10b981', visualizada: '#f59e0b', entregue: '#6366f1', notificacao_enviada: '#0ea5e9', nao_lida: '#94a3b8', prazo_expirado: '#dc2626', cancelada: '#cbd5e1', aguardando_envio: '#e2e8f0' };

function Detalhe({ id, fechar }: { id: string; fechar: () => void }) {
  const { rest } = useEu();
  const [f, setF] = useState({ setor: '', status: '', nome: '' });
  const [modal, setModal] = useState<'' | 'editar' | 'cancelar' | 'versoes'>('');
  const [hist, setHist] = useState<any>(null);
  const { dados } = useDados(async () => {
    const [c, sit] = await Promise.all([q<any>(supabase.from('rest_comunicados').select('*').eq('id', id).single()), q<Situacao[]>(supabase.from('rest_comunicado_situacao').select('*').eq('comunicado_id', id).order('funcionario_nome'))]);
    return { c, sit };
  }, [id]);
  if (!dados) return <Modal aberto largo fechar={fechar} titulo="Comunicado"><div className="p-6 text-center text-sm text-slate-500">Carregando…</div></Modal>;
  const { c, sit } = dados; const r = resumo(sit);
  const linhas = sit.filter((s) => (!f.setor || s.setor === f.setor) && (!f.status || s.situacao === f.status) && (!f.nome || s.funcionario_nome.toLowerCase().includes(f.nome.toLowerCase())));
  const graf = Object.entries(sit.reduce((a: Record<string, number>, s) => { a[s.situacao] = (a[s.situacao] ?? 0) + 1; return a; }, {})).map(([k, v]) => ({ k, nome: SITUACOES[k]?.[0] ?? k, v }));
  const rel = (): Rel => ({ titulo: `Comunicado: ${c.titulo}`, periodo: `Enviado ${quando(c.enviado_em)}${c.prazo ? ` · prazo ${quando(c.prazo)}` : ''}`, restaurante: rest.nome,
    resumo: [['Destinatários', String(r.total)], ['Enviadas', String(r.enviadas)], ['Recebidas no app', String(r.entregues)], ['Abertas', String(r.abertas)], ['Confirmações', String(r.confirmadas)], ['Pendentes', String(r.pendentes)], ['Prazo expirado', String(r.expiradas)]],
    tabelas: [{ titulo: 'Destinatários', colunas: [{ t: 'Funcionário', k: 'f' }, { t: 'Setor', k: 's' }, { t: 'Envio', k: 'e' }, { t: 'Abertura', k: 'a' }, { t: 'Confirmação', k: 'c' }, { t: 'Status', k: 'st' }],
      linhas: linhas.map((s) => ({ f: s.funcionario_nome, s: s.setor ?? '—', e: quando(s.disponivel_em ?? s.incluido_em), a: quando(s.aberto_em), c: s.confirmado_em ? quando(s.confirmado_em) + (s.confirmado_fora_prazo ? ' (fora do prazo)' : '') : '—', st: SITUACOES[s.situacao]?.[0] })) }] });
  return (
    <Modal aberto largo fechar={fechar} titulo="Acompanhamento do comunicado">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5"><Prioridade p={c.prioridade} />{c.obrigatoria && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-slate-900">Leitura obrigatória</span>}<span className="text-xs text-slate-500">{c.status === 'agendado' ? `Agendado para ${quando(c.enviar_em)}` : `Enviado ${quando(c.enviado_em)}`}{c.versao > 1 && ` · versão ${c.versao} (editado ${quando(c.editado_em)})`}</span></div>
        <h3 className="text-lg font-bold">{c.titulo}</h3>
        {c.status === 'cancelado' && <Aviso tipo="alerta">CANCELADO em {quando(c.cancelado_em)} · motivo: {c.motivo_cancelamento}</Aviso>}
        <details className="rounded-xl border border-slate-200 p-2 text-sm dark:border-slate-800"><summary className="cursor-pointer text-slate-500">Ver mensagem</summary><div className="mt-2 whitespace-pre-wrap">{c.conteudo}</div>{c.anexos?.length > 0 && <div className="mt-2 text-xs text-slate-500"><Paperclip className="mr-1 inline h-3 w-3" />{c.anexos.map((a: any) => a.nome).join(', ')}</div>}</details>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[['Destinatários', r.total], ['Enviadas', r.enviadas], ['Recebidas no app', r.entregues], ['Abertas', r.abertas], ['Confirmações', r.confirmadas], ['Pendentes', r.pendentes], ['Prazo expirado', r.expiradas], ['Ainda não abriram o app', r.total - r.entregues]].map(([k, v]) => <div key={k as string} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60"><div className="text-xs text-slate-500">{k}</div><div className="text-xl font-bold tabular-nums">{v}</div></div>)}
        </div>
        {graf.length > 0 && <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-48"><ResponsiveContainer><PieChart><Pie data={graf} dataKey="v" nameKey="nome" innerRadius={40} outerRadius={70} isAnimationActive={false}>{graf.map((g) => <Cell key={g.k} fill={CORES_SIT[g.k] ?? '#94a3b8'} />)}</Pie><Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>
          <div className="h-48"><ResponsiveContainer><BarChart data={[{ n: 'Enviadas', v: r.enviadas }, { n: 'Recebidas', v: r.entregues }, { n: 'Abertas', v: r.abertas }, { n: 'Confirmadas', v: r.confirmadas }]}><XAxis dataKey="n" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={28} /><Tooltip /><Bar dataKey="v" fill="#A3141B" maxBarSize={48} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
        </div>}
        <div className="flex flex-wrap gap-2">
          {c.status !== 'cancelado' && <Btn variante="secundario" onClick={() => setModal('editar')}><Pencil className="h-4 w-4" />Editar</Btn>}
          <Btn variante="secundario" onClick={() => setModal('versoes')}><History className="h-4 w-4" />Versões</Btn>
          <Btn variante="secundario" onClick={() => gerarPDF(rel())}><FileText className="h-4 w-4" />PDF</Btn>
          <Btn variante="secundario" onClick={() => gerarExcel(rel())}><FileSpreadsheet className="h-4 w-4" />Excel</Btn>
          {c.status !== 'cancelado' && <Btn variante="perigo" onClick={() => setModal('cancelar')}><Ban className="h-4 w-4" />Cancelar comunicado</Btn>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Funcionário" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          <Select value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value })}><option value="">Todos os setores</option>{[...new Set(sit.map((s) => s.setor).filter(Boolean))].map((s) => <option key={s!}>{s}</option>)}</Select>
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Todos os status</option>{Object.entries(SITUACOES).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</Select>
        </div>
        <Tabela linhas={linhas} aoClicar={(s) => setHist({ id: s.funcionario_id, nome: s.funcionario_nome })} colunas={[
          { k: 'f', t: 'Funcionário', r: (s) => <span>{s.funcionario_nome}{s.avisos > 0 && !s.aberto_em && <span className="ml-1 text-xs text-slate-500">(aviso exibido {s.avisos}×)</span>}</span> },
          { k: 's', t: 'Setor', r: (s) => s.setor ?? '—' }, { k: 'e', t: 'Envio', r: (s) => quando(s.disponivel_em ?? s.incluido_em) },
          { k: 'a', t: 'Abertura', r: (s) => quando(s.aberto_em) }, { k: 'c', t: 'Confirmação', r: (s) => (s.confirmado_em ? `${quando(s.confirmado_em)}${s.confirmado_fora_prazo ? ' (fora do prazo)' : ''}${s.precisa_reconfirmar ? ' (versão anterior)' : ''}` : '—') },
          { k: 'st', t: 'Status', r: (s) => <SituacaoTag s={s.situacao} /> },
        ]} />
        <p className="text-xs text-slate-500">Toque no funcionário para ver o histórico de comunicados dele. “Recebida no app” significa que o comunicado apareceu no app da pessoa (e o aviso em destaque foi exibido ao abrir); não é leitura. Leitura só conta com a abertura e, quando obrigatória, com a confirmação.</p>
      </div>
      {modal === 'editar' && <Editor existente={c} lidos={r.abertas} confirmados={r.confirmadas} fechar={() => setModal('')} />}
      {modal === 'cancelar' && <Cancelar c={c} fechar={() => setModal('')} />}
      {modal === 'versoes' && <Versoes id={id} fechar={() => setModal('')} />}
      {hist && <HistoricoFuncionario f={hist} fechar={() => setHist(null)} />}
    </Modal>
  );
}

function Editor({ existente, lidos = 0, confirmados = 0, fechar }: { existente?: any; lidos?: number; confirmados?: number; fechar: () => void }) {
  const { rest, eu } = useEu();
  const { dados: base } = useBase();
  const [id] = useState(() => existente?.id ?? crypto.randomUUID());
  const dest0 = existente?.destino ?? { todos: true };
  const [d, setD] = useState({
    titulo: existente?.titulo ?? '', conteudo: existente?.conteudo ?? '', prioridade: existente?.prioridade ?? 'normal', obrigatoria: existente?.obrigatoria ?? true,
    prazo: paraLocal(existente?.prazo), agendar: existente?.status === 'agendado', enviar_em: paraLocal(existente?.enviar_em), permitir_anexos: existente?.permitir_anexos ?? false, anexos: (existente?.anexos ?? []) as any[],
    modo: dest0.todos ? 'todos' : 'escolher', funcionarios: (dest0.funcionarios ?? []) as string[], setores: (dest0.setores ?? []) as string[], grupos: (dest0.grupos ?? []) as string[],
  });
  const [relevante, setRelevante] = useState(confirmados > 0);
  const [salvando, setSalvando] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const enviado = existente && existente.status !== 'agendado';
  const alt = (k: 'funcionarios' | 'setores' | 'grupos', v: string) => setD({ ...d, [k]: d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v] });
  const alcance = !base ? 0 : d.modo === 'todos' ? base.equipe.filter((f) => f.id !== eu.id).length : new Set(base.equipe.filter((f) => (f.id !== eu.id || d.funcionarios.includes(f.id)) && d.funcionarios.includes(f.id) || d.setores.includes(f.setor) || base.grupos.some((g) => d.grupos.includes(g.id) && g.membros.includes(f.id))).map((f) => f.id)).size;
  const anexar = async (arqs: FileList | null) => {
    if (!arqs?.length) return; setSubindo(true);
    try { const novos: any[] = []; for (const a of Array.from(arqs)) { if (a.size > 10 * 1024 * 1024) { toast(`${a.name}: máximo 10 MB`, 'erro'); continue; } novos.push({ path: await enviarPrivado(rest.id, 'comunicados', id, a, a.name), nome: a.name, tipo: a.type, tamanho: a.size }); } setD((x) => ({ ...x, anexos: [...x.anexos, ...novos] })); }
    catch (e: any) { toast(e.message, 'erro'); } finally { setSubindo(false); }
  };
  const salvar = async () => {
    const destino = d.modo === 'todos' ? { todos: true } : { funcionarios: d.funcionarios, setores: d.setores, grupos: d.grupos };
    const p: any = { id, titulo: d.titulo, conteudo: d.conteudo, prioridade: d.prioridade, obrigatoria: d.obrigatoria, prazo: deLocal(d.prazo), permitir_anexos: d.permitir_anexos, anexos: d.permitir_anexos ? d.anexos : [] };
    if (!enviado) { p.destino = destino; p.enviar_em = d.agendar ? deLocal(d.enviar_em) : new Date().toISOString(); }
    if (d.agendar && !d.enviar_em) return toast('Escolha a data e a hora do envio', 'erro');
    setSalvando(true);
    try {
      if (!existente) {
        const { data, error } = await supabase.rpc('rest_com_criar', { p }); if (error) throw error;
        if (!data.agendado) toast(`Comunicado enviado para ${data.destinatarios} pessoa(s). Aparece em destaque quando abrirem o app.`);
        else toast(`Comunicado agendado para ${new Date(p.enviar_em).toLocaleString('pt-BR')}`);
      } else {
        const { data, error } = await supabase.rpc('rest_com_editar', { p_id: existente.id, p, p_relevante: relevante }); if (error) throw error;
        if (!data.alterado) toast('Nada foi alterado', 'info');
        else { toast(`Atualizado para a versão ${data.versao} (${data.alteracoes.join(', ')})${data.reconfirmar ? ` · ${data.reconfirmar} pessoa(s) precisam confirmar de novo` : ''}`); }
      }
      avisarMudanca(); fechar();
    } catch (e: any) { toast(e.message, 'erro'); } finally { setSalvando(false); }
  };
  const Opcoes = ({ rotulo, children }: any) => <div className="text-sm" role="group" aria-label={rotulo}><span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">{rotulo}</span>{children}</div>;
  const Chip = ({ ativo, onClick, children }: any) => <button type="button" aria-pressed={!!ativo} onClick={onClick} className={`rounded-full px-3 py-1 text-sm ${ativo ? 'bg-brand-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{children}</button>;
  return (
    <Modal aberto largo fechar={fechar} titulo={existente ? 'Editar comunicado' : 'Novo comunicado'}>
      <div className="space-y-3">
        {enviado && <Aviso tipo={lidos ? 'alerta' : 'info'}>{lidos ? `${lidos} pessoa(s) já abriram este comunicado. A versão anterior fica guardada no histórico e os destinatários verão “MENSAGEM ATUALIZADA”.` : 'Ninguém abriu ainda. A versão anterior fica guardada mesmo assim.'} Destinatários de um comunicado já enviado não mudam.</Aviso>}
        <Campo rotulo="Título"><Input value={d.titulo} maxLength={140} onChange={(e) => setD({ ...d, titulo: e.target.value })} placeholder="Ex.: Novo horário de limpeza" /></Campo>
        <Campo rotulo="Mensagem"><Textarea rows={6} value={d.conteudo} onChange={(e) => setD({ ...d, conteudo: e.target.value })} /></Campo>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Opcoes rotulo="Prioridade"><div className="flex gap-1">{(['normal', 'importante', 'urgente'] as const).map((p) => <Chip key={p} ativo={d.prioridade === p} onClick={() => setD({ ...d, prioridade: p })}>{p[0].toUpperCase() + p.slice(1)}</Chip>)}</div></Opcoes>
          <Opcoes rotulo="Exigir confirmação de leitura"><div className="flex gap-1"><Chip ativo={d.obrigatoria} onClick={() => setD({ ...d, obrigatoria: true })}>SIM</Chip><Chip ativo={!d.obrigatoria} onClick={() => setD({ ...d, obrigatoria: false })}>NÃO</Chip></div></Opcoes>
          <Opcoes rotulo="Permitir anexos"><div className="flex gap-1"><Chip ativo={d.permitir_anexos} onClick={() => setD({ ...d, permitir_anexos: true })}>SIM</Chip><Chip ativo={!d.permitir_anexos} onClick={() => setD({ ...d, permitir_anexos: false })}>NÃO</Chip></div></Opcoes>
        </div>
        {d.permitir_anexos && <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium dark:bg-slate-800"><Paperclip className="h-4 w-4" />{subindo ? 'Enviando…' : 'Anexar PDF, imagem ou documento'}<input type="file" multiple className="hidden" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => { anexar(e.target.files); e.target.value = ''; }} /></label>
          <div className="mt-2 space-y-1">{d.anexos.map((a, i) => <div key={a.path} className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-slate-400" />{a.nome}<button className="ml-auto text-slate-400" aria-label="Remover anexo" onClick={() => setD({ ...d, anexos: d.anexos.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button></div>)}</div>
        </div>}
        {!enviado && <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" />Destinatários <span className="ml-auto font-normal text-slate-500">{alcance} pessoa(s)</span></div>
          <div className="flex gap-1"><Chip ativo={d.modo === 'todos'} onClick={() => setD({ ...d, modo: 'todos' })}>Toda a equipe</Chip><Chip ativo={d.modo === 'escolher'} onClick={() => setD({ ...d, modo: 'escolher' })}>Escolher</Chip></div>
          {d.modo === 'escolher' && base && <div className="mt-3 space-y-2 text-sm">
            <div><div className="mb-1 text-xs text-slate-500">Setores</div><div className="flex flex-wrap gap-1">{[...new Set([...SETORES, ...base.equipe.map((f) => f.setor).filter(Boolean)])].map((s) => <Chip key={s} ativo={d.setores.includes(s)} onClick={() => alt('setores', s)}>{s}</Chip>)}</div></div>
            {base.grupos.length > 0 && <div><div className="mb-1 text-xs text-slate-500">Grupos</div><div className="flex flex-wrap gap-1">{base.grupos.map((g) => <Chip key={g.id} ativo={d.grupos.includes(g.id)} onClick={() => alt('grupos', g.id)}>{g.nome}</Chip>)}</div></div>}
            <div><div className="mb-1 text-xs text-slate-500">Funcionários</div><div className="flex flex-wrap gap-1">{base.equipe.map((f) => <Chip key={f.id} ativo={d.funcionarios.includes(f.id)} onClick={() => alt('funcionarios', f.id)}>{f.nome}</Chip>)}</div></div>
          </div>}
        </div>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {!enviado && <Opcoes rotulo="Envio"><div className="flex gap-1"><Chip ativo={!d.agendar} onClick={() => setD({ ...d, agendar: false })}>Agora</Chip><Chip ativo={d.agendar} onClick={() => setD({ ...d, agendar: true })}>Agendar</Chip></div>{d.agendar && <Input className="mt-2" type="datetime-local" value={d.enviar_em} onChange={(e) => setD({ ...d, enviar_em: e.target.value })} />}</Opcoes>}
          <Campo rotulo="Prazo para leitura (opcional)"><Input type="datetime-local" value={d.prazo} onChange={(e) => setD({ ...d, prazo: e.target.value })} /></Campo>
        </div>
        {d.obrigatoria && <p className="text-xs text-slate-500">Enquanto não confirmar, o comunicado aparece em destaque toda vez que a pessoa abrir o app (por exemplo, para bater o ponto), sem impedir o registro do ponto.</p>}
        {existente && enviado && existente.obrigatoria && <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/30"><input type="checkbox" checked={relevante} onChange={(e) => setRelevante(e.target.checked)} className="mt-0.5" /><span><b>Alteração relevante</b>: pedir nova confirmação de leitura{confirmados ? ` às ${confirmados} pessoa(s) que já confirmaram` : ''} (volta a aparecer em destaque). Desmarque para correções pequenas (ex.: erro de digitação).</span></label>}
        <Btn className="w-full" carregando={salvando} onClick={salvar}><Send className="h-4 w-4" />{existente ? 'Salvar alterações' : d.agendar ? 'Agendar comunicado' : 'Enviar agora'}</Btn>
      </div>
    </Modal>
  );
}

function Cancelar({ c, fechar }: { c: any; fechar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [rodando, setRodando] = useState(false);
  const ir = async () => {
    setRodando(true);
    const { data, error } = await supabase.rpc('rest_com_cancelar', { p_id: c.id, p_motivo: motivo });
    if (error) { setRodando(false); return toast(error.message, 'erro'); }
    setRodando(false); toast('Comunicado cancelado (o histórico fica guardado)'); avisarMudanca(); fechar();
  };
  return (
    <Modal aberto fechar={fechar} titulo="Cancelar comunicado">
      <div className="space-y-3">
        <Aviso tipo="alerta">Ao cancelar: o comunicado sai das pendências e do aviso em destaque{c.status === 'enviado' ? ' e os destinatários passam a ver a marca CANCELADO com o motivo' : ''}. Nada é apagado: o histórico, as leituras e as confirmações continuam no painel.</Aviso>
        <Campo rotulo="Motivo (obrigatório)"><Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <Btn variante="perigo" className="w-full" carregando={rodando} disabled={!motivo.trim()} onClick={ir}><Ban className="h-4 w-4" />CANCELAR COMUNICADO</Btn>
      </div>
    </Modal>
  );
}

function Versoes({ id, fechar }: { id: string; fechar: () => void }) {
  const { dados } = useDados(async () => {
    const [v, eq] = await Promise.all([q<any[]>(supabase.from('rest_comunicado_versoes').select('*').eq('comunicado_id', id).order('versao', { ascending: false })), q<any[]>(supabase.from('rest_funcionarios').select('id, nome'))]);
    return { v, nome: Object.fromEntries(eq.map((f) => [f.id, f.nome])) };
  }, [id]);
  return (
    <Modal aberto largo fechar={fechar} titulo="Histórico de versões">
      {!dados ? 'Carregando…' : <div className="space-y-2">{dados.v.map((v) => (
        <details key={v.id} open={v === dados.v[0]} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
          <summary className="cursor-pointer"><b>Versão {v.versao}</b> · {quando(v.editado_em)} · por {dados.nome[v.editado_por] ?? '—'} · {v.alteracoes.join(', ')}{v.relevante && <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800">pediu nova confirmação</span>}</summary>
          <div className="mt-2 font-semibold">{v.titulo}</div><div className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{v.conteudo}</div>
          <div className="mt-1 text-xs text-slate-500">Prioridade {v.prioridade} · {v.obrigatoria ? 'leitura obrigatória' : 'sem confirmação'}{v.prazo ? ` · prazo ${quando(v.prazo)}` : ''}{v.anexos?.length ? ` · ${v.anexos.length} anexo(s)` : ''}</div>
        </details>))}</div>}
    </Modal>
  );
}

function HistoricoFuncionario({ f, fechar }: { f: { id: string; nome: string }; fechar: () => void }) {
  const { dados } = useDados(() => q<Situacao[]>(supabase.from('rest_comunicado_situacao').select('*').eq('funcionario_id', f.id).order('incluido_em', { ascending: false })), [f.id]);
  return (
    <Modal aberto largo fechar={fechar} titulo={`Comunicados de ${f.nome}`}>
      <Tabela linhas={dados} vazio="Nenhum comunicado." colunas={[
        { k: 't', t: 'Comunicado', r: (s) => <span>{s.titulo} {s.prioridade !== 'normal' && <Prioridade p={s.prioridade} />}</span> }, { k: 'e', t: 'Recebido', r: (s) => quando(s.disponivel_em ?? s.incluido_em) },
        { k: 'a', t: 'Abertura', r: (s) => quando(s.aberto_em) }, { k: 'c', t: 'Confirmação', r: (s) => quando(s.confirmado_em) }, { k: 's', t: 'Status', r: (s) => <SituacaoTag s={s.situacao} /> },
      ]} />
    </Modal>
  );
}

function Relatorio() {
  const { rest } = useEu();
  const [hist, setHist] = useState<any>(null);
  const [f, setF] = useState({ de: '', ate: '', setor: '' });
  const { dados } = useDados(() => q<Situacao[]>(supabase.from('rest_comunicado_situacao').select('*').neq('status_comunicado', 'agendado')), []);
  const filtrado = (dados ?? []).filter((s) => (!f.de || (s.enviado_em ?? '') >= f.de) && (!f.ate || (s.enviado_em ?? '').slice(0, 10) <= f.ate) && (!f.setor || s.setor === f.setor));
  const porFunc = Object.values(filtrado.reduce((a: Record<string, any>, s) => {
    const x = (a[s.funcionario_id] ??= { id: s.funcionario_id, nome: s.funcionario_nome, setor: s.setor ?? '—', recebidos: 0, abertos: 0, obrigatorios: 0, confirmados: 0, pendentes: 0, vencidos: 0 });
    if (s.status_comunicado === 'cancelado') return a;
    x.recebidos++; if (s.aberto_em) x.abertos++; if (s.obrigatoria) x.obrigatorios++; if (s.situacao === 'confirmada') x.confirmados++; if (s.situacao === 'prazo_expirado') x.vencidos++; else if (s.obrigatoria && s.situacao !== 'confirmada') x.pendentes++;
    return a;
  }, {})).sort((a: any, b: any) => b.pendentes + b.vencidos - (a.pendentes + a.vencidos));
  const porCom = Object.values(filtrado.reduce((a: Record<string, any>, s) => { const x = (a[s.comunicado_id] ??= { id: s.comunicado_id, titulo: s.titulo, enviado: s.enviado_em, total: 0, confirmados: 0, abertos: 0, obrig: s.obrigatoria, cancelado: s.status_comunicado === 'cancelado' }); x.total++; if (s.aberto_em) x.abertos++; if (s.situacao === 'confirmada') x.confirmados++; return a; }, {}));
  const rel = (): Rel => ({ titulo: 'Relatório de comunicados', periodo: `${f.de || 'início'} a ${f.ate || 'hoje'}`, restaurante: rest.nome,
    tabelas: [{ titulo: 'Por funcionário', colunas: [{ t: 'Funcionário', k: 'nome' }, { t: 'Setor', k: 'setor' }, { t: 'Recebidos', k: 'recebidos', tipo: 'num', total: true }, { t: 'Abertos', k: 'abertos', tipo: 'num', total: true }, { t: 'Obrigatórios', k: 'obrigatorios', tipo: 'num', total: true }, { t: 'Confirmados', k: 'confirmados', tipo: 'num', total: true }, { t: 'Pendentes', k: 'pendentes', tipo: 'num', total: true }, { t: 'Vencidos', k: 'vencidos', tipo: 'num', total: true }], linhas: porFunc as any[] },
      { titulo: 'Por comunicado', colunas: [{ t: 'Comunicado', k: 'titulo' }, { t: 'Enviado', k: 'env' }, { t: 'Destinatários', k: 'total', tipo: 'num' }, { t: 'Abertos', k: 'abertos', tipo: 'num' }, { t: 'Confirmados', k: 'confirmados', tipo: 'num' }], linhas: porCom.map((c: any) => ({ ...c, env: quando(c.enviado), titulo: c.titulo + (c.cancelado ? ' (cancelado)' : '') })) }] });
  return (
    <div className="space-y-3">
      <Card><div className="grid grid-cols-3 gap-2">
        <Campo rotulo="De"><Input type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></Campo>
        <Campo rotulo="Até"><Input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></Campo>
        <Campo rotulo="Setor"><Select value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value })}><option value="">Todos</option>{[...new Set((dados ?? []).map((s) => s.setor).filter(Boolean))].map((s) => <option key={s!}>{s}</option>)}</Select></Campo>
      </div>{dados && <div className="mt-2 flex gap-2"><Btn variante="secundario" onClick={() => gerarPDF(rel())}><FileText className="h-4 w-4" />PDF</Btn><Btn variante="secundario" onClick={() => gerarExcel(rel())}><FileSpreadsheet className="h-4 w-4" />Excel</Btn></div>}</Card>
      {porFunc.length > 0 && <Card titulo="Confirmações por funcionário"><div style={{ height: Math.max(160, porFunc.length * 34) }}><ResponsiveContainer><BarChart layout="vertical" data={porFunc}><XAxis type="number" allowDecimals={false} fontSize={11} /><YAxis type="category" dataKey="nome" width={110} fontSize={11} /><Tooltip /><Bar dataKey="confirmados" name="Confirmados" stackId="a" fill="#059669" isAnimationActive={false} /><Bar dataKey="pendentes" name="Pendentes" stackId="a" fill="#f59e0b" isAnimationActive={false} /><Bar dataKey="vencidos" name="Vencidos" stackId="a" fill="#dc2626" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></Card>}
      <Tabela linhas={porFunc as any[]} aoClicar={(x: any) => setHist(x)} vazio="Sem comunicados no período." colunas={[
        { k: 'nome', t: 'Funcionário' }, { k: 'setor', t: 'Setor', esconderCelular: true }, { k: 'recebidos', t: 'Recebidos', num: true }, { k: 'confirmados', t: 'Confirmados', num: true },
        { k: 'pendentes', t: 'Pendentes', num: true, r: (x: any) => <span className={x.pendentes ? 'font-bold text-amber-700' : ''}>{x.pendentes}</span> }, { k: 'vencidos', t: 'Vencidos', num: true, r: (x: any) => <span className={x.vencidos ? 'font-bold text-red-600' : ''}>{x.vencidos}</span> },
      ]} />
      {hist && <HistoricoFuncionario f={hist} fechar={() => setHist(null)} />}
    </div>
  );
}

function Grupos() {
  const { dados } = useBase();
  const [ed, setEd] = useState<any>(null);
  return (
    <div className="space-y-3">
      <Aviso>Grupos servem para enviar a pessoas de setores diferentes de uma vez (ex.: “Turno da noite”, “Líderes”). Os setores vêm do cadastro em Equipe.</Aviso>
      <Btn onClick={() => setEd({ nome: '', membros: [] })}><Plus className="h-4 w-4" />Novo grupo</Btn>
      <Tabela linhas={dados?.grupos} aoClicar={setEd} vazio="Nenhum grupo." colunas={[{ k: 'nome', t: 'Grupo' }, { k: 'm', t: 'Pessoas', r: (g) => g.membros.map((m: string) => dados!.equipe.find((f) => f.id === m)?.nome).filter(Boolean).join(', ') || '—' }]} />
      {ed && dados && <Modal aberto fechar={() => setEd(null)} titulo={ed.id ? 'Editar grupo' : 'Novo grupo'}>
        <div className="space-y-3">
          <Campo rotulo="Nome"><Input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
          <div className="space-y-1">{dados.equipe.map((f) => <label key={f.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ed.membros.includes(f.id)} onChange={(e) => setEd({ ...ed, membros: e.target.checked ? [...ed.membros, f.id] : ed.membros.filter((x: string) => x !== f.id) })} />{f.nome}<span className="text-xs text-slate-500">{f.setor}</span></label>)}</div>
          <Btn className="w-full" onClick={async () => { const { error } = await supabase.rpc('rest_com_grupo_salvar', { p_id: ed.id ?? null, p_nome: ed.nome, p_membros: ed.membros }); if (error) return toast(error.message, 'erro'); toast('Grupo salvo'); avisarMudanca(); setEd(null); }}>Salvar</Btn>
        </div>
      </Modal>}
    </div>
  );
}
