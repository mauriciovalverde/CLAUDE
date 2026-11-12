import { useEffect, useRef, useState } from 'react';
import { Send, Mic, Loader2, Plus, Bot, User } from 'lucide-react';
import { funcao, supabase } from '../lib/supabase';
import { avisarMudanca } from './ui';

type Msg = { papel: 'user' | 'assistant'; texto: string; ferramentas?: string[] };
const SUGESTOES = ['Quem está me devendo?', 'Resumo do mês', 'Vencimentos desta semana', 'Estoque baixo', 'Paguei 350 reais de energia da minha casa'];

function novaConversa() { const id = crypto.randomUUID(); try { localStorage.setItem('gfi-conversa', id); } catch { /* ignore */ } return id; }
function conversaAtual() { try { return localStorage.getItem('gfi-conversa') ?? novaConversa(); } catch { return novaConversa(); } }

/** Markdown mínimo: **negrito**, quebras de linha e listas. */
function Texto({ t }: { t: string }) {
  const partes = t.split(/(\*\*[^*]+\*\*)/g);
  return <div className="whitespace-pre-wrap break-words">{partes.map((p, i) => p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)}</div>;
}

export default function ChatPainel({ compacto = false }: { compacto?: boolean }) {
  const [conversa, setConversa] = useState(conversaAtual);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('chat_mensagens').select('papel,conteudo').eq('conversa_id', conversa).order('criado_em').then(({ data }) => {
      setMsgs((data ?? []).map((m: any) => ({ papel: m.papel, texto: m.conteudo?.texto ?? '', ferramentas: m.conteudo?.ferramentas })));
    });
  }, [conversa]);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, enviando]);

  async function enviar(t = texto) {
    const msg = t.trim();
    if (!msg || enviando) return;
    setTexto(''); setEnviando(true);
    setMsgs((m) => [...m, { papel: 'user', texto: msg }]);
    try {
      const r = await funcao('ia-comando', { conversa_id: conversa, mensagem_id: crypto.randomUUID(), texto: msg });
      setMsgs((m) => [...m, { papel: 'assistant', texto: r.resposta ?? `❌ ${r.erro ?? 'Erro desconhecido'}. Nada foi gravado.`, ferramentas: r.ferramentas?.map((f: any) => f.nome) }]);
      if (r.ferramentas?.length) avisarMudanca();
    } catch (e: any) {
      setMsgs((m) => [...m, { papel: 'assistant', texto: `❌ Sem conexão com o servidor (${e.message}). Nada foi gravado; tente de novo.` }]);
    } finally { setEnviando(false); }
  }

  function ouvir() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Seu navegador não suporta ditado por voz.'); return; }
    const r = new SR(); r.lang = 'pt-BR'; r.interimResults = false;
    r.onresult = (e: any) => setTexto((t) => (t ? t + ' ' : '') + e.results[0][0].transcript);
    r.onend = () => setOuvindo(false);
    setOuvindo(true); r.start();
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${compacto ? '' : 'h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-6rem)]'}`}>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {!msgs.length && (
          <div className="mx-auto max-w-lg py-6 text-center">
            <Bot className="mx-auto mb-2 h-10 w-10 text-teal-700" />
            <h2 className="text-lg font-semibold">Converse para registrar tudo</h2>
            <p className="mt-1 text-sm text-slate-500">Ex.: <em>“Venda de 2 unidades de X para Valverde, 71 99401-4023, R$ 150 cada, pagamento dia 14 de dezembro.”</em> Eu cadastro, calculo, aviso o que faltar e crio o lembrete no Google Agenda.</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.papel === 'user' ? 'justify-end' : ''}`}>
            {m.papel === 'assistant' && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white"><Bot className="h-4 w-4" /></div>}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${m.papel === 'user' ? 'rounded-br-md bg-teal-700 text-white' : 'rounded-bl-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
              <Texto t={m.texto} />
              {!!m.ferramentas?.length && <div className="mt-1.5 text-[10px] uppercase tracking-wide text-slate-400">ações: {m.ferramentas.join(' · ')}</div>}
            </div>
            {m.papel === 'user' && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800"><User className="h-4 w-4" /></div>}
          </div>
        ))}
        {enviando && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Processando e gravando…</div>}
        <div ref={fim} />
      </div>
      <div className="border-t border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex gap-1.5 overflow-x-auto">
          {SUGESTOES.map((s) => <button key={s} onClick={() => enviar(s)} className="whitespace-nowrap rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{s}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex items-end gap-1.5">
          <button type="button" title="Nova conversa" onClick={() => { setConversa(novaConversa()); setMsgs([]); }} className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Plus className="h-5 w-5" /></button>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1} placeholder="Escreva uma venda, compra, empréstimo, pagamento…"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-950" />
          <button type="button" onClick={ouvir} title="Ditar" className={`rounded-xl p-2.5 ${ouvindo ? 'bg-rose-100 text-rose-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Mic className="h-5 w-5" /></button>
          <button disabled={enviando || !texto.trim()} className="rounded-xl bg-teal-700 p-2.5 text-white disabled:opacity-40"><Send className="h-5 w-5" /></button>
        </form>
      </div>
    </div>
  );
}
