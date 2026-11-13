import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Clock, FileText, Megaphone, Paperclip, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
import { linkPrivado } from '../lib/arquivos';
import { contadores, COR_PRIORIDADE, dispositivo, meusComunicados, pendente, PRIORIDADES, quando, SITUACOES, tempoRestante, type Situacao } from '../lib/comunicados';
import { ativarPush, estadoPush, testarPush, type EstadoPush } from '../lib/push';
import { Abas, Aviso, avisarMudanca, Btn, Cabecalho, Card, Modal, q, toast, useDados } from '../components/ui';

const idDaRota = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('id');

export function Prioridade({ p }: { p: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${COR_PRIORIDADE[p]}`}>{p === 'urgente' && <AlertTriangle className="h-3 w-3" />}{PRIORIDADES[p as keyof typeof PRIORIDADES]}</span>;
}
export function SituacaoTag({ s, funcionario }: { s: string; funcionario?: boolean }) {
  const [t, c] = SITUACOES[s] ?? [s, ''];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{funcionario && s === 'prazo_expirado' ? 'PRAZO EXPIRADO - LEITURA PENDENTE' : t}</span>;
}

/** Cartão para ativar as notificações (pedido no primeiro acesso). */
export function AtivarNotificacoes({ compacto }: { compacto?: boolean }) {
  const [e, setE] = useState<EstadoPush | null>(null);
  const [rodando, setRodando] = useState(false);
  useEffect(() => { estadoPush().then(setE).catch(() => {}); }, []);
  if (!e || e.ativo) return compacto || !e ? null : (
    <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400"><BellRing className="h-4 w-4" />Notificações ativas neste aparelho.
      <button className="underline" onClick={async () => { const r = await testarPush(); toast(r.ok ? 'Notificação de teste enviada' : r.mensagem ?? 'Não foi possível enviar o teste', r.ok ? 'ok' : 'erro'); }}>Enviar teste</button></div>
  );
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand-900 dark:bg-brand-950/30">
      <div className="flex items-start gap-2"><BellRing className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
        <div className="flex-1">
          <b>Receba os comunicados no celular, mesmo com o app fechado.</b>
          {e.suporte === 'nenhum' ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{e.motivo}</p>
            : e.permissao === 'denied' ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">As notificações estão bloqueadas. Libere nas configurações do navegador/celular (Notificações → permitir) e volte aqui.</p>
            : <Btn className="mt-2" carregando={rodando} onClick={async () => { setRodando(true); try { const r = await ativarPush(); setE(r); if (r.ativo) { toast('Notificações ativadas'); testarPush().catch(() => {}); } } catch (x: any) { toast(x.message, 'erro'); } finally { setRodando(false); } }}>Ativar notificações</Btn>}
        </div>
      </div>
    </div>
  );
}

export default function Comunicados() {
  const { eu } = useEu();
  const [aba, setAba] = useState('pendentes');
  const [aberto, setAberto] = useState<string | null>(idDaRota());
  useEffect(() => { const h = () => setAberto(idDaRota()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const { dados, recarregar } = useDados(() => meusComunicados(eu.id), [eu.id]);
  useEffect(() => { const t = setInterval(recarregar, 60000); return () => clearInterval(t); }, [recarregar]);
  const c = dados ? contadores(dados) : null;
  const lista = useMemo(() => (dados ?? []).filter((s) => ({
    pendentes: pendente(s), todos: true, confirmados: s.situacao === 'confirmada', vencidos: s.situacao === 'prazo_expirado', cancelados: s.status_comunicado === 'cancelado',
  } as Record<string, boolean>)[aba]), [dados, aba]);
  const fechar = () => { setAberto(null); if (idDaRota()) window.location.hash = '/comunicados'; recarregar(); };

  return (
    <div className="space-y-3">
      <Cabecalho titulo="Comunicados e avisos" sub="Mensagens da administração para você" />
      <AtivarNotificacoes />
      {c && <>
        <div className={`flex items-center gap-3 rounded-2xl p-4 text-white shadow ${c.pendentes ? (c.urgentes ? 'bg-red-600' : 'bg-brand-700') : 'bg-emerald-600'}`}>
          <Megaphone className="h-8 w-8 shrink-0" />
          <div><div className="text-lg font-bold">COMUNICADOS PENDENTES: {c.pendentes}</div>
            <div className="text-sm opacity-90">{c.urgentes ? `${c.urgentes} urgente(s) · ` : ''}{c.prazoProximo ? `${c.prazoProximo} com prazo próximo · ` : ''}{c.confirmadas} confirmado(s){c.vencidas ? ` · ${c.vencidas} vencido(s)` : ''}</div></div>
        </div>
      </>}
      <Abas abas={[{ id: 'pendentes', t: `Pendentes${c ? ` (${c.pendentes})` : ''}` }, { id: 'todos', t: 'Meus comunicados' }, { id: 'confirmados', t: 'Confirmados' }, { id: 'vencidos', t: 'Vencidos' }, { id: 'cancelados', t: 'Cancelados' }]} ativa={aba} mudar={setAba} />
      {!dados ? <div className="p-6 text-center text-sm text-slate-500">Carregando…</div> : !lista.length ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">{aba === 'pendentes' ? 'Nenhum comunicado pendente. Tudo em dia!' : 'Nada por aqui.'}</div> : (
        <div className="space-y-2">{lista.map((s) => {
          const t = tempoRestante(s.prazo); const pend = pendente(s);
          return (
            <button key={s.id} onClick={() => setAberto(s.comunicado_id)} className={`w-full rounded-2xl border p-3 text-left shadow-sm transition active:scale-[.99] ${pend ? (s.prioridade === 'urgente' ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : 'border-brand-300 bg-white dark:border-brand-900 dark:bg-slate-900') : 'border-slate-200 bg-white opacity-90 dark:border-slate-800 dark:bg-slate-900'}`}>
              <div className="flex flex-wrap items-center gap-1.5"><Prioridade p={s.prioridade} />{s.obrigatoria && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-slate-900">Leitura obrigatória</span>}{s.atualizada && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">MENSAGEM ATUALIZADA</span>}<span className="ml-auto"><SituacaoTag s={s.situacao} funcionario /></span></div>
              <div className={`mt-1.5 ${pend ? 'font-bold' : 'font-medium'}`}>{s.titulo}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500"><span>Recebido {quando(s.enviado_em ?? s.incluido_em)}</span>{s.prazo && <span className={t?.vencido ? 'text-red-600' : t?.proximo ? 'font-semibold text-amber-700' : ''}><Clock className="mr-0.5 inline h-3 w-3" />Prazo {quando(s.prazo)}{pend && t ? ` (${t.texto})` : ''}</span>}{s.confirmado_em && <span className="text-emerald-700">Confirmado {quando(s.confirmado_em)}</span>}</div>
            </button>);
        })}</div>)}
      {aberto && <LerComunicado id={aberto} situacao={dados?.find((s) => s.comunicado_id === aberto)} fechar={fechar} />}
    </div>
  );
}

function LerComunicado({ id, situacao, fechar }: { id: string; situacao?: Situacao; fechar: () => void }) {
  const [c, setC] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [atualizada, setAtualizada] = useState(false);
  const [leuTudo, setLeuTudo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (async () => {
      const r = await supabase.rpc('rest_com_abrir', { p_id: id, p_dispositivo: dispositivo() });
      if (r.error || !r.data?.ok) { setErro(r.data?.mensagem ?? r.error?.message ?? 'Comunicado indisponível'); return; }
      setAtualizada(!!r.data.atualizada);
      setC(await q(supabase.from('rest_comunicados').select('*').eq('id', id).single()));
      avisarMudanca();
    })().catch((e) => setErro(e.message));
  }, [id]);
  // "visualizar o conteúdo completo": o botão só libera quando o fim do texto aparece na tela
  useEffect(() => {
    if (!c || !fim.current) return;
    const ob = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) setLeuTudo(true); }, { threshold: 0.5 });
    ob.observe(fim.current); return () => ob.disconnect();
  }, [c]);
  const confirmar = async () => {
    setConfirmando(true);
    const { data, error } = await supabase.rpc('rest_com_confirmar', { p_id: id, p_versao: c.versao, p_dispositivo: dispositivo() });
    setConfirmando(false);
    if (error || !data?.ok) return toast(error?.message ?? data?.mensagem ?? 'Não foi possível confirmar', 'erro');
    setOk(data.confirmado_em); avisarMudanca();
  };
  const t = tempoRestante(c?.prazo ?? null);
  const jaConfirmado = situacao?.situacao === 'confirmada' && !situacao.precisa_reconfirmar;
  return (
    <Modal aberto largo fechar={fechar} titulo="Comunicado">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : !c ? <div className="p-6 text-center text-sm text-slate-500">Abrindo…</div> : (
        <div className="space-y-3">
          {c.status === 'cancelado' && <Aviso tipo="alerta"><b>Comunicado CANCELADO</b> em {quando(c.cancelado_em)}. Motivo: {c.motivo_cancelamento}. Fica aqui só para consulta.</Aviso>}
          {(atualizada || situacao?.precisa_reconfirmar) && c.status !== 'cancelado' && <Aviso tipo="info"><RefreshCw className="mr-1 inline h-4 w-4" /><b>MENSAGEM ATUALIZADA</b> em {quando(c.editado_em)}.{situacao?.precisa_reconfirmar ? ' A alteração é importante: leia de novo e confirme.' : ''}</Aviso>}
          <div className="flex flex-wrap items-center gap-1.5"><Prioridade p={c.prioridade} />{c.obrigatoria && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-slate-900">Leitura obrigatória</span>}<span className="text-xs text-slate-500">Enviado {quando(c.enviado_em)}{c.versao > 1 ? ` · versão ${c.versao}` : ''}</span></div>
          <h2 className="text-xl font-bold leading-tight">{c.titulo}</h2>
          {c.prazo && <div className={`rounded-xl p-2 text-sm ${t?.vencido ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300' : t?.proximo ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-slate-50 dark:bg-slate-800'}`}><Clock className="mr-1 inline h-4 w-4" />Prazo para confirmação: <b>{quando(c.prazo)}</b> — {t?.texto}</div>}
          <div className="whitespace-pre-wrap rounded-xl border border-slate-200 p-3 text-[15px] leading-relaxed dark:border-slate-800">{c.conteudo}</div>
          {c.anexos?.length > 0 && <div className="space-y-1.5"><div className="text-sm font-semibold"><Paperclip className="mr-1 inline h-4 w-4" />Anexos</div>
            {c.anexos.map((a: any) => <button key={a.path} onClick={async () => { try { window.open(await linkPrivado(a.path), '_blank'); } catch (e: any) { toast(e.message, 'erro'); } }} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 p-2 text-left text-sm dark:border-slate-700"><FileText className="h-4 w-4 text-brand-700" />{a.nome}</button>)}</div>}
          <div ref={fim} />
          {c.obrigatoria && c.status === 'enviado' && (ok || jaConfirmado ? (
            <div className="rounded-2xl bg-emerald-50 p-4 text-center text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 className="mx-auto mb-1 h-8 w-8" /><b>Leitura confirmada com sucesso.</b><div className="text-xs">{quando(ok ?? situacao?.confirmado_em)}</div></div>
          ) : (
            <div className="rounded-2xl border-2 border-brand-700 p-4">
              <p className="text-sm font-medium">Declaro que li e tomei ciência do conteúdo deste comunicado.</p>
              <button disabled={!leuTudo || confirmando} onClick={confirmar} className="mt-3 w-full rounded-xl bg-brand-700 py-4 text-lg font-bold text-white shadow disabled:opacity-40">{confirmando ? 'Confirmando…' : 'CONFIRMAR LEITURA'}</button>
              {!leuTudo && <p className="mt-1 text-center text-xs text-slate-500">Role até o fim do comunicado para liberar o botão.</p>}
              {t?.vencido && <p className="mt-1 text-center text-xs text-red-600">O prazo já venceu; a confirmação será registrada como fora do prazo.</p>}
            </div>
          ))}
          {!c.obrigatoria && <p className="text-center text-xs text-slate-500">Este comunicado não exige confirmação. A abertura foi registrada.</p>}
        </div>
      )}
    </Modal>
  );
}
