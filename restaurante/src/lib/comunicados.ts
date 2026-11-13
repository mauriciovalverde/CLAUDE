// Comunicação interna: rótulos, cores e consultas compartilhadas.
import { supabase } from './supabase';

export const PRIORIDADES = { normal: 'Normal', importante: 'Importante', urgente: 'Urgente' } as const;
export const COR_PRIORIDADE: Record<string, string> = {
  normal: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  importante: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  urgente: 'bg-red-600 text-white',
};
export const SITUACOES: Record<string, [string, string]> = {
  aguardando_envio: ['Aguardando envio', 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'],
  enviada: ['Enviada (disponível no app)', 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'],
  entregue: ['Recebida no app', 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'],
  nao_lida: ['Não lida', 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'],
  visualizada: ['Visualizada, aguardando confirmação', 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'],
  lida: ['Lida', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'],
  confirmada: ['Leitura confirmada', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'],
  prazo_expirado: ['Prazo expirado', 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'],
  cancelada: ['Cancelada', 'bg-slate-200 text-slate-500 line-through dark:bg-slate-800'],
};
export type Situacao = { id: string; comunicado_id: string; funcionario_id: string; funcionario_nome: string; setor: string | null; titulo: string; prioridade: string; obrigatoria: boolean; prazo: string | null;
  status_comunicado: string; versao: number; enviar_em: string; enviado_em: string | null; disponivel_em: string | null; avisos: number; entregue_em: string | null; aberto_em: string | null;
  confirmado_em: string | null; confirmado_fora_prazo: boolean | null; precisa_reconfirmar: boolean; situacao: string; atualizada: boolean; incluido_em: string };

/** pendente = precisa de ação do funcionário */
export const pendente = (s: Situacao) => s.status_comunicado === 'enviado' && (s.obrigatoria ? s.situacao !== 'confirmada' : !s.aberto_em);
const ORDEM_PRIO: Record<string, number> = { urgente: 0, importante: 1, normal: 2 };
export const ordenar = (a: Situacao, b: Situacao) =>
  Number(pendente(b)) - Number(pendente(a)) || ORDEM_PRIO[a.prioridade] - ORDEM_PRIO[b.prioridade] || (a.prazo ?? '9') .localeCompare(b.prazo ?? '9') || (b.enviado_em ?? '').localeCompare(a.enviado_em ?? '');

/** “faltam 5 h 20 min” / “venceu há 2 dias” */
export function tempoRestante(prazo: string | null, agora = Date.now()) {
  if (!prazo) return null;
  const d = Date.parse(prazo) - agora; const a = Math.abs(d);
  const t = a >= 86400000 ? `${Math.floor(a / 86400000)} dia(s)${a % 86400000 >= 3600000 ? ` ${Math.floor((a % 86400000) / 3600000)} h` : ''}` : a >= 3600000 ? `${Math.floor(a / 3600000)} h ${Math.floor((a % 3600000) / 60000)} min` : `${Math.max(1, Math.floor(a / 60000))} min`;
  return { vencido: d <= 0, proximo: d > 0 && d <= 24 * 3600000, texto: d > 0 ? `faltam ${t}` : `venceu há ${t}` };
}

export async function meusComunicados(funcId: string) {
  await supabase.rpc('rest_com_sincronizar'); // libera agendados no horário e registra o recebimento no app
  const { data, error } = await supabase.from('rest_comunicado_situacao').select('*').eq('funcionario_id', funcId).neq('status_comunicado', 'agendado');
  if (error) throw new Error(error.message);
  return (data as Situacao[]).sort(ordenar);
}
export function contadores(l: Situacao[]) {
  const ag = Date.now();
  return {
    pendentes: l.filter(pendente).length,
    urgentes: l.filter((s) => pendente(s) && s.prioridade === 'urgente').length,
    prazoProximo: l.filter((s) => pendente(s) && tempoRestante(s.prazo, ag)?.proximo).length,
    confirmadas: l.filter((s) => s.situacao === 'confirmada').length,
    vencidas: l.filter((s) => s.situacao === 'prazo_expirado').length,
  };
}
export const quando = (s?: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
export const dispositivo = () => navigator.userAgent.slice(0, 180);
