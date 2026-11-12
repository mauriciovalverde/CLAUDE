// Projeção do ano: mês a mês, a partir do saldo de hoje.
// Considera contas PENDENTES (as pagas já estão no saldo atual) e o quanto guardar para os sonhos.

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
export const mesesAte = (deISO, ateISO) => {
  const [a1, m1] = deISO.split('-').map(Number), [a2, m2] = ateISO.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
};

/** Quanto guardar por mês para chegar na meta até a data (inclui o mês atual). */
export function aporteMensalSonho(sonho, guardado, hojeISO) {
  const falta = Math.max(0, sonho.valor_alvo - guardado);
  if (!sonho.data_alvo || falta <= 0) return { falta, mensal: 0, meses: 0 };
  const meses = Math.max(1, mesesAte(hojeISO, sonho.data_alvo) + 1);
  return { falta: r2(falta), mensal: r2(falta / meses), meses };
}

/**
 * @param contas  [{tipo:'pagar'|'receber', valor, vencimento:'AAAA-MM-DD', status}]
 * @param sonhos  [{valor_alvo, data_alvo, incluir_na_projecao, concluido, guardado}]
 * @param saldoAtual número
 * @param hojeISO 'AAAA-MM-DD'
 * @param meses quantidade de meses (12)
 */
export function projetar({ contas, sonhos = [], saldoAtual = 0, hojeISO, meses = 12 }) {
  const base = hojeISO.slice(0, 7);
  const lista = [];
  for (let k = 0; k < meses; k++) {
    const d = new Date(base + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + k);
    lista.push({ mes: d.toISOString().slice(0, 7), receber: 0, pagar: 0, sonhos: 0, atrasadoReceber: 0, atrasadoPagar: 0 });
  }
  const idx = new Map(lista.map((m, i) => [m.mes, i]));
  for (const c of contas) {
    if (c.status === 'pago') continue;
    let mes = c.vencimento.slice(0, 7);
    const atrasada = mes < base;
    if (atrasada) mes = base; // contas vencidas e não pagas entram no mês atual
    const i = idx.get(mes); if (i == null) continue;
    if (c.tipo === 'receber') { lista[i].receber += Number(c.valor); if (atrasada) lista[i].atrasadoReceber += Number(c.valor); }
    else { lista[i].pagar += Number(c.valor); if (atrasada) lista[i].atrasadoPagar += Number(c.valor); }
  }
  for (const s of sonhos) {
    if (!s.incluir_na_projecao || s.concluido) continue;
    const { mensal, meses: n } = aporteMensalSonho(s, s.guardado ?? 0, hojeISO);
    for (let k = 0; k < Math.min(n, meses); k++) lista[k].sonhos += mensal;
  }
  let acum = Number(saldoAtual);
  for (const m of lista) {
    m.receber = r2(m.receber); m.pagar = r2(m.pagar); m.sonhos = r2(m.sonhos);
    m.saldoMes = r2(m.receber - m.pagar - m.sonhos);
    acum = r2(acum + m.saldoMes); m.saldoAcumulado = acum;
    m.negativo = acum < 0;
  }
  const totais = lista.reduce((t, m) => ({ receber: r2(t.receber + m.receber), pagar: r2(t.pagar + m.pagar), sonhos: r2(t.sonhos + m.sonhos) }), { receber: 0, pagar: 0, sonhos: 0 });
  return { meses: lista, totais, saldoFinal: acum, primeiroNegativo: lista.find((m) => m.negativo)?.mes ?? null };
}
