// Caixa integrado: saldo informado (com data/hora) + tudo que entrou e saiu depois disso.
// Entradas: contas a receber marcadas como recebidas; retiradas de sonhos que voltam para o caixa.
// Saídas: contas a pagar marcadas como pagas (inclui faturas do cartão e pagamentos parciais); dinheiro guardado em sonhos.
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export function calcularCaixa(cfg, contasPagas = [], movsSonho = [], sonhosPorId = {}) {
  const base = new Date(cfg?.saldo_em ?? 0).getTime();
  const movs = [];
  for (const c of contasPagas) {
    if (c.status !== 'pago' || !c.pago_registrado_em || new Date(c.pago_registrado_em).getTime() <= base) continue;
    movs.push({ id: 'c' + c.id, quando: c.pago_registrado_em, data: c.pago_em, descricao: c.descricao, categoria: c.categoria, valor: c.tipo === 'receber' ? Number(c.valor) : -Number(c.valor), tipo: c.tipo === 'receber' ? 'entrada' : 'saida', origem: c.origem === 'fatura' ? 'cartao' : 'conta' });
  }
  for (const m of movsSonho) {
    if (!m.do_caixa || new Date(m.criado_em).getTime() <= base) continue;
    const s = sonhosPorId[m.sonho_id];
    movs.push({ id: 's' + m.id, quando: m.criado_em, data: m.data, descricao: `${Number(m.valor) > 0 ? 'Guardado para' : 'Retirado de'} ${s ? `${s.emoji} ${s.nome}` : 'sonho'} (${m.forma})`, categoria: 'Sonhos', valor: -Number(m.valor), tipo: Number(m.valor) > 0 ? 'saida' : 'entrada', origem: 'sonho' });
  }
  movs.sort((a, b) => new Date(a.quando).getTime() - new Date(b.quando).getTime());
  let saldo = Number(cfg?.saldo_atual ?? 0);
  for (const m of movs) { saldo = r2(saldo + m.valor); m.saldoApos = saldo; }
  return { saldo, inicial: Number(cfg?.saldo_atual ?? 0), desde: cfg?.saldo_em ?? null, movimentos: movs.reverse(),
    entradas: r2(movs.filter((m) => m.valor > 0).reduce((t, m) => t + m.valor, 0)), saidas: r2(-movs.filter((m) => m.valor < 0).reduce((t, m) => t + m.valor, 0)) };
}
