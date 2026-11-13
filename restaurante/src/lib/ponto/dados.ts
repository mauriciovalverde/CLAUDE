// Liga os dados do banco à apuração legal (apuracao.js): monta os dias do período de cada empregado.
import { apurarDia, somar, TIPOS, NOMES_TIPO, ALERTAS, fmtHM, relogio } from './apuracao.js';
import { addDias } from '../fmt';

export { TIPOS, NOMES_TIPO, ALERTAS, fmtHM, relogio };
export const FUSO = 'America/Sao_Paulo';
export const DIAS_SEMANA = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const fmtLocal = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** data (AAAA-MM-DD) e minutos do dia no fuso do restaurante */
export function local(ts: string | Date) {
  const p = Object.fromEntries(fmtLocal.formatToParts(typeof ts === 'string' ? new Date(ts) : ts).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
export const hojeLocal = () => local(new Date()).data;
export const horaLocal = (ts?: string | null) => (ts ? relogio(local(ts).min) : '—');
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
/** minutos desde 00:00 do dia de referência (passa de 1440 quando vira a noite) */
export const minDoDia = (ts: string, dataRef: string) => { const l = local(ts); return diasEntre(dataRef, l.data) * 1440 + l.min; };
export const isoDow = (d: string) => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w === 0 ? 7 : w; };

export type Jornada = { id: string; funcionario_id: string; valido_desde: string; semana: Record<string, any>; quatro_marcacoes: boolean; locais: string[]; escala?: string; regras?: string };
export type Marcacao = { id: string; funcionario_id: string; nsr: number; tipo: string; data_ref: string; horario: string; situacao: string; origem: string; motivos: string[]; substituida_por: string | null; [k: string]: any };

export function jornadaVigente(jornadas: Jornada[], func: string, data: string) {
  return jornadas.filter((j) => j.funcionario_id === func && j.valido_desde <= data).sort((a, b) => (a.valido_desde < b.valido_desde ? 1 : -1))[0] ?? null;
}
/** marcações que valem (a original corrigida e a rejeitada não entram na conta, mas continuam guardadas) */
export const valida = (m: Marcacao) => !m.substituida_por && m.situacao !== 'rejeitado';

export type Cor = 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'cinza';
export const COR_CLASSE: Record<Cor, string> = {
  verde: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  amarelo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  vermelho: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  azul: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  cinza: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};
export const COR_NOME: Record<Cor, string> = { verde: 'Aprovado', amarelo: 'Em análise', vermelho: 'Inconsistência', azul: 'Em andamento', cinza: 'Não iniciado' };

export type Dia = ReturnType<typeof apurarDia> & { data: string; cfg: any; folga: boolean; marcs: Marcacao[]; todas: Marcacao[]; pendentes: number; atestado: any; cor: Cor; situacao: string };

/** Monta e apura os dias de um empregado no período [de, ate]. */
export function montarDias(func: string, de: string, ate: string, jornadas: Jornada[], folgas: { funcionario_id: string; data: string }[], marcacoes: Marcacao[], ausencias: any[]): Dia[] {
  const hoje = hojeLocal(); const dias: Dia[] = [];
  let saidaAnterior: number | null = null; // minutos absolutos (desde "de") da última saída
  for (let d = de, i = 0; d <= ate; d = addDias(d, 1), i++) {
    const j = jornadaVigente(jornadas, func, d);
    const cfgBruto = j?.semana?.[String(isoDow(d))];
    const folga = folgas.some((f) => f.funcionario_id === func && f.data === d);
    const cfg = !folga && cfgBruto?.entrada && cfgBruto?.saida ? cfgBruto : null;
    const todas = marcacoes.filter((m) => m.funcionario_id === func && m.data_ref === d).sort((a, b) => a.nsr - b.nsr);
    const marcs = todas.filter(valida);
    const atestado = ausencias.find((a) => a.funcionario_id === func && a.data_inicio <= d && a.data_fim >= d && a.status !== 'recusado') ?? null;
    const futuro = d > hoje;
    const entrada = marcs.find((m) => m.tipo === 'entrada');
    const descanso = entrada && saidaAnterior != null ? i * 1440 + minDoDia(entrada.horario, d) - saidaAnterior : null;
    const r = apurarDia({
      cfg: futuro && !marcs.length ? null : cfg, folga, quatroMarcacoes: j?.quatro_marcacoes ?? true, descansoAnterior: descanso,
      abonado: atestado?.status === 'aceito',
      marcacoes: marcs.map((m) => ({ tipo: m.tipo, min: minDoDia(m.horario, d) })),
    });
    if (futuro && !marcs.length) r.previsto = cfg ? r.previsto : 0;
    const saida = marcs.find((m) => m.tipo === 'saida'); if (saida) saidaAnterior = i * 1440 + minDoDia(saida.horario, d);
    const pendentes = todas.filter((m) => m.situacao === 'pendente' && !m.substituida_por).length;
    // cor do dia
    let cor: Cor; let situacao: string;
    if (d === hoje && marcs.length && !saida) { cor = 'azul'; situacao = 'Em andamento'; }
    else if ((d >= hoje && !marcs.length) || (!cfg && !marcs.length)) { cor = 'cinza'; situacao = folga ? 'Folga' : !cfg ? 'Sem jornada' : 'Não iniciado'; }
    else if (atestado && atestado.status === 'aguardando_conferencia') { cor = 'amarelo'; situacao = 'Atestado enviado – aguardando conferência'; }
    else if (pendentes) { cor = 'amarelo'; situacao = `${pendentes} marcação(ões) em análise`; }
    else if (r.abonado) { cor = 'verde'; situacao = 'Ausência justificada (atestado)'; }
    else if (r.falta || r.incompleto || r.alertas.length) { cor = 'vermelho'; situacao = r.alertas.map((a: string) => ALERTAS[a as keyof typeof ALERTAS] ?? a).join(', '); }
    else { cor = 'verde'; situacao = 'Aprovado'; }
    // em andamento/hoje: não acusa falta antes do fim do dia
    if (d === hoje && !marcs.length) { r.falta = false; r.saldo = 0; r.faltante = 0; r.alertas = []; }
    dias.push({ ...r, data: d, cfg, folga, marcs, todas, pendentes, atestado, cor, situacao });
  }
  return dias;
}

export const totais = (dias: Dia[]) => ({ ...somar(dias), pendentes: dias.reduce((t, d) => t + d.pendentes, 0), extraPendente: dias.filter((d) => d.pendentes && d.extra > 0).reduce((t, d) => t + d.extra, 0) });
export const horaPrevista = (cfg: any, tipo: string) => (cfg ? cfg[{ entrada: 'entrada', saida_intervalo: 'int_ini', retorno_intervalo: 'int_fim', saida: 'saida' }[tipo] as string] ?? '' : '');
export const textoMotivos = (m: string[] = []) => m.map((x) => ALERTAS[x as keyof typeof ALERTAS] ?? x.replace(/_/g, ' ')).join(', ');
