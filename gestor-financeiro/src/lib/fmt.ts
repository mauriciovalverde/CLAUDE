export const brl = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const num = (v: number | string | null | undefined, d = 0) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : `${num(v, 1)}%`);
export const dataBR = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '—');
export const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const addDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const inicioMes = (iso = hoje()) => iso.slice(0, 8) + '01';
export const fimMes = (iso = hoje()) => { const d = new Date(iso.slice(0, 8) + '01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
export const mesNome = (iso: string) => new Date(iso.slice(0, 7) + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
export const cod = (p: string, n?: number | null) => (n ? `#${p}-${String(n).padStart(6, '0')}` : '');
export const tel = (t?: string | null) => {
  const d = (t ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t ?? '';
};
export const SITUACAO_COR: Record<string, string> = {
  pago: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  pendente: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  parcial: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  atrasado: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  ativo: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  quitado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  renegociado: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  cancelado: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
};
