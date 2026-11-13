// Apuração da jornada conforme a legislação vigente (função pura, testada em tests/ponto.test.mjs).
//
// Base legal aplicada:
// - Portaria MTP 671/2021, art. 74: o sistema de ponto NÃO pode restringir o horário de marcação, marcar
//   automaticamente nem exigir autorização prévia para sobrejornada. Por isso a "janela de 5 minutos" é só
//   operacional: marcações fora dela são aceitas, guardadas com o horário real e sinalizadas para análise.
// - CLT art. 58, §1º, e Súmula 366 do TST: variações de até 5 minutos por marcação, no máximo 10 minutos
//   por dia, não são descontadas nem computadas. Passado esse limite, conta-se a totalidade do tempo.
// - CLT art. 59: no máximo 2 horas extras por dia (sinalizado; o tempo trabalhado é sempre registrado).
// - CLT art. 66: descanso mínimo de 11 horas entre duas jornadas.
// - CLT art. 71: jornada acima de 6 h exige intervalo de 1 a 2 horas; de 4 a 6 h, intervalo de 15 minutos.
//   §4º: intervalo não concedido (ou concedido parcialmente) gera pagamento do período suprimido + 50%.
// - CLT art. 73: trabalho noturno urbano das 22h às 5h; a hora noturna é de 52 min 30 s.
//
// Unidades: minutos desde 00:00 do dia de referência (a jornada que passa da meia-noite usa valores > 1440).

export const TIPOS = ['entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'];
export const NOMES_TIPO = { entrada: 'Entrada', saida_intervalo: 'Saída para intervalo', retorno_intervalo: 'Retorno do intervalo', saida: 'Saída' };
export const TOL_MARCACAO = 5;    // art. 58 §1º
export const TOL_DIA = 10;        // art. 58 §1º
export const JANELA = 5;          // janela operacional (não altera cálculo)

export const hm = (s) => { if (s == null || s === '') return null; const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
export const fmtHM = (min) => { if (min == null) return '—'; const s = min < 0 ? '-' : ''; const a = Math.abs(Math.round(min)); return `${s}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`; };
/** horário do relógio (aceita > 24 h para jornadas que viram a noite) */
export const relogio = (min) => (min == null ? '—' : fmtHM(((min % 1440) + 1440) % 1440));

/** Jornada do dia em minutos (saída/intervalo depois da meia-noite somam 1440). null = folga. */
export function jornadaDoDia(cfg) {
  if (!cfg || !cfg.entrada || !cfg.saida) return null;
  const e = hm(cfg.entrada); let s = hm(cfg.saida); if (s <= e) s += 1440;
  let ii = hm(cfg.int_ini), fi = hm(cfg.int_fim);
  if (ii != null && ii < e) ii += 1440;
  if (fi != null && ii != null && fi <= ii) fi += 1440;
  const intervalo = ii != null && fi != null ? fi - ii : 0;
  return { entrada: e, saida: s, int_ini: ii, int_fim: fi, intervalo, previsto: s - e - intervalo };
}

/** Qual o próximo registro e se está dentro da janela operacional (informativo: nunca bloqueia). */
export function proximoRegistro(marcacoes, cfg, agora, quatroMarcacoes = true) {
  const j = jornadaDoDia(cfg);
  const feitos = marcacoes.map((m) => m.tipo);
  const sequencia = quatroMarcacoes && j?.int_ini != null ? TIPOS : ['entrada', 'saida'];
  const tipo = sequencia.find((t) => !feitos.includes(t)) ?? null;
  if (!tipo) return { tipo: null, concluido: true };
  if (!j) return { tipo, previsto: null, abreEm: null, dentroJanela: false, motivo: 'sem_jornada' };
  const previsto = { entrada: j.entrada, saida_intervalo: j.int_ini, retorno_intervalo: j.int_fim, saida: j.saida }[tipo];
  const abreEm = previsto - JANELA;
  const dentroJanela = agora >= abreEm;
  const diferenca = agora - previsto; // + atrasado / excedente, − antecipado
  return { tipo, previsto, abreEm, dentroJanela, diferenca, motivo: dentroJanela ? null : 'fora_janela' };
}

const inter = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
/** minutos reais trabalhados no período noturno (22h–5h), considerando até dois dias */
function noturnos(periodos) {
  let t = 0;
  for (const [a, b] of periodos) for (const base of [-1440, 0, 1440]) t += inter(a, b, base + 22 * 60, base + 29 * 60);
  return t;
}

/**
 * Apura um dia.
 * @param {{ cfg: any, marcacoes: {tipo: string, min: number}[], abonado?: boolean, folga?: boolean, descansoAnterior?: number|null, quatroMarcacoes?: boolean }} p
 */
export function apurarDia({ cfg, marcacoes, abonado = false, folga = false, descansoAnterior = null, quatroMarcacoes = true }) {
  const j = folga ? null : jornadaDoDia(cfg);
  const m = Object.fromEntries(marcacoes.map((x) => [x.tipo, x.min]));
  const r = { previsto: j?.previsto ?? 0, trabalhado: 0, considerado: 0, saldo: 0, extra: 0, faltante: 0, atraso: 0, saidaAntecipada: 0, intervalo: null, intervaloSuprimido: 0, noturnoReal: 0, noturnoFicto: 0, falta: false, abonado: false, incompleto: false, toleranciaAplicada: false, alertas: [] };
  if (!marcacoes.length) {
    if (j && !abonado) { r.falta = true; r.saldo = -j.previsto; r.faltante = j.previsto; r.alertas.push('falta'); }
    if (j && abonado) { r.abonado = true; r.previsto = 0; }
    return r;
  }
  if (abonado) { r.abonado = true; }
  // períodos trabalhados (horário real)
  const periodos = [];
  const fimManha = m.saida_intervalo ?? (m.retorno_intervalo == null ? m.saida : undefined);
  if (m.entrada != null && fimManha != null) periodos.push([m.entrada, fimManha]);
  if (m.retorno_intervalo != null && m.saida != null) periodos.push([m.retorno_intervalo, m.saida]);
  r.trabalhado = periodos.reduce((t, [a, b]) => t + Math.max(0, b - a), 0);
  const seq = quatroMarcacoes && j?.int_ini != null ? TIPOS : ['entrada', 'saida'];
  r.incompleto = seq.some((t) => m[t] == null);
  if (r.incompleto) r.alertas.push('marcacao_incompleta');
  if (m.saida_intervalo != null && m.retorno_intervalo != null) r.intervalo = m.retorno_intervalo - m.saida_intervalo;

  if (!j) { // trabalho em dia sem jornada (folga/descanso): tudo é extra e precisa de análise
    r.previsto = 0; r.considerado = r.trabalhado; r.extra = r.trabalhado; r.saldo = r.trabalhado; r.alertas.push('trabalho_em_folga');
  } else {
    const varEntrada = m.entrada != null ? m.entrada - j.entrada : 0;   // + atraso, − chegou antes
    const varSaida = m.saida != null ? m.saida - j.saida : 0;           // + ficou depois, − saiu antes
    r.toleranciaAplicada = !r.incompleto && Math.abs(varEntrada) <= TOL_MARCACAO && Math.abs(varSaida) <= TOL_MARCACAO && Math.abs(varEntrada) + Math.abs(varSaida) <= TOL_DIA;
    if (r.toleranciaAplicada) {
      // variações dentro do art. 58 §1º: entrada e saída consideradas no horário contratual; o intervalo real continua contando
      const intReal = quatroMarcacoes && j.int_ini != null ? (r.intervalo ?? j.intervalo) : j.intervalo;
      r.considerado = j.saida - j.entrada - intReal;
    } else {
      r.considerado = r.trabalhado;
      if (m.entrada != null) { r.atraso = Math.max(0, varEntrada); r.extra += Math.max(0, -varEntrada); }
      if (m.saida != null) { r.saidaAntecipada = Math.max(0, -varSaida); r.extra += Math.max(0, varSaida); }
    }
    if (r.incompleto) r.considerado = r.trabalhado;
    r.saldo = r.considerado - j.previsto;
    if (r.abonado && r.saldo < 0) r.saldo = 0;
    r.faltante = Math.max(0, -r.saldo);
    // hora extra = tempo além da jornada contratual (saldo positivo do dia)
    r.extra = Math.max(0, r.saldo);
    if (r.atraso > 0) r.alertas.push('atraso');
    if (r.saidaAntecipada > 0) r.alertas.push('saida_antecipada');
  }
  // art. 59: limite de 2 horas extras por dia
  if (r.extra > 120) r.alertas.push('extra_acima_2h');
  // art. 71: intervalo
  const jornadaReal = r.trabalhado;
  if (!r.incompleto || r.intervalo != null) {
    const min = jornadaReal > 360 ? 60 : jornadaReal > 240 ? 15 : 0;
    const feito = r.intervalo ?? 0;
    if (min && feito < min) { r.intervaloSuprimido = min - feito; r.alertas.push('intervalo_insuficiente'); }
    if (r.intervalo != null && r.intervalo > 120) r.alertas.push('intervalo_acima_2h');
  }
  // art. 66: descanso entre jornadas
  if (descansoAnterior != null && descansoAnterior < 660) r.alertas.push('interjornada_menor_11h');
  // art. 73: noturno
  r.noturnoReal = noturnos(periodos);
  r.noturnoFicto = Math.round((r.noturnoReal * 60) / 52.5);
  return r;
}

/** Soma do mês/período. dias: resultados de apurarDia */
export function somar(dias) {
  const t = { previsto: 0, trabalhado: 0, considerado: 0, saldo: 0, extra: 0, faltante: 0, atraso: 0, saidaAntecipada: 0, intervaloSuprimido: 0, noturnoReal: 0, noturnoFicto: 0, faltas: 0, abonos: 0, incompletos: 0, alertas: 0 };
  for (const d of dias) {
    for (const k of ['previsto', 'trabalhado', 'considerado', 'saldo', 'extra', 'faltante', 'atraso', 'saidaAntecipada', 'intervaloSuprimido', 'noturnoReal', 'noturnoFicto']) t[k] += d[k] ?? 0;
    if (d.falta) t.faltas++; if (d.abonado) t.abonos++; if (d.incompleto) t.incompletos++; t.alertas += d.alertas?.length ?? 0;
  }
  return t;
}

export const ALERTAS = {
  falta: 'Falta', marcacao_incompleta: 'Marcação incompleta', atraso: 'Atraso', saida_antecipada: 'Saída antecipada', trabalho_em_folga: 'Trabalho em dia de folga',
  extra_acima_2h: 'Mais de 2 h extras (CLT art. 59)', intervalo_insuficiente: 'Intervalo menor que o mínimo (CLT art. 71)', intervalo_acima_2h: 'Intervalo acima de 2 h (CLT art. 71)', interjornada_menor_11h: 'Descanso entre jornadas < 11 h (CLT art. 66)',
  fora_janela: 'Fora da janela de horário', fora_area: 'Fora do local autorizado', rosto_nao_confere: 'Rosto não confere', sem_vivacidade: 'Prova de vida não confirmada', sem_gps: 'Sem localização', contingencia: 'Registro de contingência', sem_jornada: 'Dia sem jornada prevista', sem_selfie: 'Sem selfie', biometria_nao_cadastrada: 'Rosto de referência não cadastrado',
};
