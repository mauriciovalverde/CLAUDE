import { ReactNode, useCallback, useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { SITUACAO_COR } from '../lib/fmt';

/** Carrega dados e recarrega quando qualquer parte do app grava algo (evento gfi:mudou). */
export function useDados<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try { setDados(await fn()); } catch (e: any) { setErro(e.message ?? String(e)); } finally { setCarregando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { const h = () => carregar(); window.addEventListener('gfi:mudou', h); return () => window.removeEventListener('gfi:mudou', h); }, [carregar]);
  return { dados, carregando, erro, recarregar: carregar };
}
export const avisarMudanca = () => window.dispatchEvent(new Event('gfi:mudou'));

/** Executa uma query do supabase e lança erro se houver. */
export async function q<T = any>(p: PromiseLike<{ data: any; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export function Card({ children, className = '', titulo, acao }: { children: ReactNode; className?: string; titulo?: ReactNode; acao?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {(titulo || acao) && <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{titulo}</h3>{acao}</div>}
      {children}
    </section>
  );
}

export function Stat({ rotulo, valor, sub, tom = 'neutro', icone }: { rotulo: string; valor: ReactNode; sub?: ReactNode; tom?: 'neutro' | 'bom' | 'ruim' | 'alerta'; icone?: ReactNode }) {
  const cor = { neutro: 'text-slate-900 dark:text-white', bom: 'text-emerald-700 dark:text-emerald-400', ruim: 'text-rose-700 dark:text-rose-400', alerta: 'text-amber-700 dark:text-amber-400' }[tom];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"><span>{rotulo}</span>{icone}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${cor}`}>{valor}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

export function Btn({ children, variante = 'primario', className = '', carregando, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'perigo' | 'fantasma'; carregando?: boolean }) {
  const v = {
    primario: 'bg-teal-700 text-white hover:bg-teal-800 disabled:bg-teal-700/50',
    secundario: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
    perigo: 'bg-rose-600 text-white hover:bg-rose-700',
    fantasma: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  }[variante];
  return (
    <button {...p} disabled={p.disabled || carregando} className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${v} ${className}`}>
      {carregando && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  );
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">{rotulo}</span>{children}{dica && <span className="mt-1 block text-xs text-slate-500">{dica}</span>}</label>;
}
const base = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${base} ${p.className ?? ''}`} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${base} ${p.className ?? ''}`} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${base} ${p.className ?? ''}`} />;

export function Badge({ s, children }: { s: string; children?: ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SITUACAO_COR[s] ?? SITUACAO_COR.pendente}`}>{children ?? s}</span>;
}

export function Modal({ aberto, fechar, titulo, children, largo }: { aberto: boolean; fechar: () => void; titulo: string; children: ReactNode; largo?: boolean }) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onClick={fechar}>
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl ${largo ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{titulo}</h2><button onClick={fechar} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

export type Coluna<T> = { k: string; t: string; r?: (l: T) => ReactNode; num?: boolean; esconderCelular?: boolean };
export function Tabela<T extends Record<string, any>>({ colunas, linhas, vazio = 'Nada por aqui ainda.', aoClicar, chave = 'id' }: { colunas: Coluna<T>[]; linhas: T[] | null | undefined; vazio?: ReactNode; aoClicar?: (l: T) => void; chave?: string }) {
  if (!linhas) return <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;
  if (!linhas.length) return <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">{vazio}</div>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">{colunas.map((c) => <th key={c.k} className={`px-2 py-2 font-medium ${c.num ? 'text-right' : ''}`}>{c.t}</th>)}</tr></thead>
          <tbody>{linhas.map((l, i) => (
            <tr key={l[chave] ?? i} onClick={() => aoClicar?.(l)} className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${aoClicar ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}>
              {colunas.map((c) => <td key={c.k} className={`px-2 py-2 ${c.num ? 'text-right tabular-nums' : ''}`}>{c.r ? c.r(l) : l[c.k]}</td>)}
            </tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">{linhas.map((l, i) => (
        <div key={l[chave] ?? i} onClick={() => aoClicar?.(l)} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
          {colunas.filter((c) => !c.esconderCelular).map((c, j) => (
            <div key={c.k} className={`flex justify-between gap-3 ${j === 0 ? 'mb-1 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>
              {j > 0 && <span className="text-xs text-slate-500">{c.t}</span>}<span className={`${c.num ? 'tabular-nums' : ''} ${j === 0 ? '' : 'text-right'}`}>{c.r ? c.r(l) : l[c.k]}</span>
            </div>))}
        </div>))}
      </div>
    </>
  );
}

export function Abas({ abas, ativa, mudar }: { abas: { id: string; t: string }[]; ativa: string; mudar: (id: string) => void }) {
  return (
    <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto pb-1">
      {abas.map((a) => <button key={a.id} onClick={() => mudar(a.id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${ativa === a.id ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800'}`}>{a.t}</button>)}
    </div>
  );
}

export function Cabecalho({ titulo, sub, acoes }: { titulo: string; sub?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>{sub && <p className="text-sm text-slate-500 dark:text-slate-400">{sub}</p>}</div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'erro' | 'alerta' | 'ok'; children: ReactNode }) {
  const c = { info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200', erro: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200', alerta: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200', ok: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' }[tipo];
  return <div className={`rounded-xl border p-3 text-sm ${c}`}>{children}</div>;
}

// Toast simples
let empurrar: ((t: { msg: string; tipo: string }) => void) | null = null;
export const toast = (msg: string, tipo: 'ok' | 'erro' | 'info' = 'ok') => empurrar?.({ msg, tipo });
export function Toasts() {
  const [lista, setLista] = useState<{ id: number; msg: string; tipo: string }[]>([]);
  useEffect(() => { empurrar = (t) => { const id = Date.now() + Math.random(); setLista((l) => [...l, { id, ...t }]); setTimeout(() => setLista((l) => l.filter((x) => x.id !== id)), 6000); }; return () => { empurrar = null; }; }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
      {lista.map((t) => <div key={t.id} className={`pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${t.tipo === 'erro' ? 'bg-rose-600' : t.tipo === 'info' ? 'bg-slate-800' : 'bg-emerald-600'}`}>{t.msg}</div>)}
    </div>
  );
}
