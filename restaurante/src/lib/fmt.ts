export const brl = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const num = (v: number | string | null | undefined, d = 0) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
/** Quantidade sem zeros sobrando: 4,5 · 0,32 · 12 */
export const qtd = (v: number | string | null | undefined) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 }));
export const pct = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${num(v, 1)}%`);
export const dataBR = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '—');
export const dataHora = (s?: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
export const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const addDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const addMeses = (iso: string, n: number) => { const d = new Date(iso.slice(0, 8) + '01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
export const inicioMes = (iso = hoje()) => iso.slice(0, 8) + '01';
export const fimMes = (iso = hoje()) => { const d = new Date(iso.slice(0, 8) + '01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
export const mesNome = (iso: string) => new Date(iso.slice(0, 7) + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
export const mesLongo = (iso: string) => new Date(iso.slice(0, 7) + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
export const tel = (t?: string | null) => {
  const d = (t ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t ?? '';
};
export const cnpjFmt = (c?: string | null) => { const d = (c ?? '').replace(/\D/g, ''); return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : (c ?? ''); };
/** "12,50" ou "12.50" → 12.5 */
export const lerNum = (s: string | number | null | undefined) => { if (typeof s === 'number') return s; const t = String(s ?? '').trim().replace(/\s/g, ''); if (!t) return NaN; return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); };

export const SITUACAO_COR: Record<string, string> = {
  pago: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  pendente: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  atrasado: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  cancelado: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  alerta: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  roxo: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
};
// rótulo + cor de cada status
export const STATUS: Record<string, [string, keyof typeof SITUACAO_COR]> = {
  em_elaboracao: ['Em elaboração', 'pendente'], enviada: ['Enviada', 'info'], em_analise: ['Em análise', 'roxo'], aprovada: ['Aprovada', 'ok'],
  reprovada: ['Reprovada', 'atrasado'], em_compra: ['Compra em andamento', 'alerta'], parcial: ['Parcialmente comprada', 'alerta'], comprada: ['Comprada', 'ok'],
  recebida: ['Recebida', 'pago'], cancelada: ['Cancelada', 'cancelado'], parcial_recebida: ['Chegou com falta', 'alerta'],
  aberto: ['Aberto', 'info'], encerrado: ['Aguardando conferência', 'alerta'], devolvido: ['Devolvido p/ correção', 'atrasado'], conferido: ['Conferido', 'pago'],
  pendente: ['Pendente', 'pendente'], conferida: ['Conferida', 'pago'], descartada: ['Descartada', 'cancelado'], pago: ['Pago', 'pago'], cancelado: ['Cancelado', 'cancelado'],
  ativo: ['Ativo', 'ok'], inativo: ['Inativo', 'cancelado'],
  historico: ['Histórico (fora dos valores)', 'cancelado'],
};
/** Rótulo curto para eixos de gráfico: 850 · 1,5k · 2,3mi */
export const compacto = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${num(v / 1e6, 1)}mi`;
  if (a >= 1e3) return `${num(v / 1e3, a >= 1e4 ? 0 : 1)}k`;
  return num(v, 0);
};
export const TURNOS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', dia: 'Dia todo' };
export const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Boleto', 'Transferência', 'A prazo (fiado)', 'Outro'];
export const CATEGORIAS_DESPESA = ['Compras: Hortaliças', 'Compras: Frutas', 'Compras: Carnes', 'Compras: Aves', 'Compras: Peixes', 'Compras: Cereais e grãos', 'Compras: Mercearia', 'Compras: Laticínios e frios', 'Compras: Bebidas', 'Compras: Padaria', 'Compras: Embalagens', 'Compras: Limpeza', 'Compras: Outros',
  'Funcionários', 'Vale a funcionário', 'Transporte', 'Energia', 'Água', 'Gás', 'Internet/Telefone', 'Aluguel', 'Manutenção', 'Equipamentos', 'Impostos', 'Taxas de cartões', 'Despesas administrativas', 'Outras despesas'];
export const CATEGORIAS_RECEITA = ['Vendas', 'Outras receitas', 'Recebimentos diversos'];
