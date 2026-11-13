import test from 'node:test';
import assert from 'node:assert/strict';
import { apurarDia, proximoRegistro, jornadaDoDia, hm, somar } from '../src/lib/ponto/apuracao.js';

const J = { entrada: '08:00', saida: '17:00', int_ini: '12:00', int_fim: '13:00' }; // 8 h + 1 h de intervalo
const mk = (o) => Object.entries(o).map(([tipo, h]) => ({ tipo, min: hm(h) }));

test('jornada do dia (inclusive virando a meia-noite)', () => {
  assert.deepEqual(jornadaDoDia(J), { entrada: 480, saida: 1020, int_ini: 720, int_fim: 780, intervalo: 60, previsto: 480 });
  const n = jornadaDoDia({ entrada: '18:00', saida: '02:00', int_ini: '22:00', int_fim: '22:30' });
  assert.equal(n.saida, 26 * 60); assert.equal(n.previsto, 450);
  assert.equal(jornadaDoDia(null), null);
});

test('janela de 5 minutos é só informativa (Portaria 671, art. 74: não bloqueia)', () => {
  assert.deepEqual([proximoRegistro([], J, hm('07:54')).dentroJanela, proximoRegistro([], J, hm('07:54')).motivo], [false, 'fora_janela']);
  assert.equal(proximoRegistro([], J, hm('07:55')).dentroJanela, true);
  assert.equal(proximoRegistro([], J, hm('08:10')).diferenca, 10); // atraso identificado
  const p = proximoRegistro(mk({ entrada: '07:58', saida_intervalo: '12:00', retorno_intervalo: '13:00' }), J, hm('16:54'));
  assert.deepEqual([p.tipo, p.dentroJanela], ['saida', false]);
  assert.equal(proximoRegistro(mk({ entrada: '07:58' }), J, hm('11:00')).tipo, 'saida_intervalo');
  assert.equal(proximoRegistro(mk({ entrada: '08:00', saida: '17:00' }), J, hm('17:00'), false).concluido, true);
});

test('exemplo do pedido: 07:58 / 12:00 / 13:00 / 17:00 = 8 h, saldo zero', () => {
  const r = apurarDia({ cfg: J, marcacoes: mk({ entrada: '07:58', saida_intervalo: '12:00', retorno_intervalo: '13:00', saida: '17:00' }) });
  assert.deepEqual([r.trabalhado, r.considerado, r.saldo, r.extra, r.atraso, r.toleranciaAplicada, r.intervalo], [482, 480, 0, 0, 0, true, 60]);
});

test('entrou 07:55 e saiu 16:55: dentro da tolerância (5 e 5 = 10), nada é acrescentado nem descontado', () => {
  const r = apurarDia({ cfg: J, marcacoes: mk({ entrada: '07:55', saida_intervalo: '12:00', retorno_intervalo: '13:00', saida: '16:55' }) });
  assert.deepEqual([r.trabalhado, r.saldo, r.toleranciaAplicada, r.saidaAntecipada], [480, 0, true, 0]);
});

test('ultrapassou 10 min no dia: conta todo o tempo (Súmula 366)', () => {
  const r = apurarDia({ cfg: J, marcacoes: mk({ entrada: '07:54', saida_intervalo: '12:00', retorno_intervalo: '13:00', saida: '17:05' }) });
  assert.deepEqual([r.toleranciaAplicada, r.trabalhado, r.saldo, r.extra], [false, 491, 11, 11]);
  const a = apurarDia({ cfg: J, marcacoes: mk({ entrada: '08:10', saida_intervalo: '12:00', retorno_intervalo: '13:00', saida: '17:00' }) });
  assert.deepEqual([a.atraso, a.saldo, a.faltante], [10, -10, 10]);
  assert.ok(a.alertas.includes('atraso'));
  const s = apurarDia({ cfg: J, marcacoes: mk({ entrada: '08:00', saida_intervalo: '12:00', retorno_intervalo: '13:00', saida: '17:15' }) });
  assert.deepEqual([s.extra, s.saldo], [15, 15]);
});

test('intervalo: maior que o previsto reduz as horas; menor que 1 h em jornada > 6 h é sinalizado (art. 71)', () => {
  const r = apurarDia({ cfg: J, marcacoes: mk({ entrada: '08:00', saida_intervalo: '12:00', retorno_intervalo: '13:20', saida: '17:00' }) });
  assert.deepEqual([r.intervalo, r.considerado, r.saldo], [80, 460, -20]);
  const c = apurarDia({ cfg: J, marcacoes: mk({ entrada: '08:00', saida_intervalo: '12:00', retorno_intervalo: '12:30', saida: '17:00' }) });
  assert.deepEqual([c.intervalo, c.intervaloSuprimido, c.saldo], [30, 30, 30]);
  assert.ok(c.alertas.includes('intervalo_insuficiente'));
});

test('falta, abono por atestado, incompleto, folga, limite de 2 h extras e interjornada', () => {
  assert.deepEqual([apurarDia({ cfg: J, marcacoes: [] }).falta, apurarDia({ cfg: J, marcacoes: [] }).saldo], [true, -480]);
  const ab = apurarDia({ cfg: J, marcacoes: [], abonado: true });
  assert.deepEqual([ab.falta, ab.abonado, ab.saldo], [false, true, 0]);
  const inc = apurarDia({ cfg: J, marcacoes: mk({ entrada: '08:00' }) });
  assert.ok(inc.incompleto && inc.alertas.includes('marcacao_incompleta'));
  const f = apurarDia({ cfg: null, marcacoes: mk({ entrada: '09:00', saida: '13:00' }) });
  assert.deepEqual([f.extra, f.alertas.includes('trabalho_em_folga')], [240, true]);
  const x = apurarDia({ cfg: J, marcacoes: mk({ entrada: '08:00', saida_intervalo: '12:00', retorno_intervalo: '13:00', saida: '19:30' }) });
  assert.ok(x.alertas.includes('extra_acima_2h'));
  assert.ok(apurarDia({ cfg: J, marcacoes: mk({ entrada: '08:00', saida_intervalo: '12:00', retorno_intervalo: '13:00', saida: '17:00' }), descansoAnterior: 600 }).alertas.includes('interjornada_menor_11h'));
});

test('adicional noturno: 22h–5h com hora de 52min30s (art. 73)', () => {
  const N = { entrada: '18:00', saida: '02:00', int_ini: '22:00', int_fim: '22:30' };
  const r = apurarDia({ cfg: N, marcacoes: [{ tipo: 'entrada', min: hm('18:00') }, { tipo: 'saida_intervalo', min: hm('22:00') }, { tipo: 'retorno_intervalo', min: hm('22:30') }, { tipo: 'saida', min: 26 * 60 }] });
  assert.equal(r.noturnoReal, 210); // 22:30 às 02:00
  assert.equal(r.noturnoFicto, 240); // 210 × 60 / 52,5
  assert.equal(r.saldo, 0);
  const t = somar([r, apurarDia({ cfg: J, marcacoes: [] })]);
  assert.deepEqual([t.faltas, t.noturnoReal], [1, 210]);
});

import { validarCPF, validarPIS, conferirJornada } from '../src/lib/ponto/documentos.js';
test('documentos: CPF e PIS com dígito verificador', () => {
  assert.equal(validarCPF('529.982.247-25'), true);
  assert.equal(validarCPF('529.982.247-24'), false);
  assert.equal(validarCPF('111.111.111-11'), false);
  assert.equal(validarPIS('170.33259.50-4'), true);
  assert.equal(validarPIS('170.33259.50-5'), false);
});
test('jornada contratual conferida com os limites legais', () => {
  const dia = { entrada: '08:00', saida: '17:00', int_ini: '12:00', int_fim: '13:00' };
  const ok = conferirJornada({ 1: dia, 2: dia, 3: dia, 4: dia, 5: dia, 6: { entrada: '08:00', saida: '12:00' }, 7: null });
  assert.deepEqual([ok.avisos, ok.totalSemana], [[], 44 * 60]);
  const ruim = conferirJornada({ 1: { entrada: '08:00', saida: '18:00', int_ini: '12:00', int_fim: '12:30' }, 2: dia, 3: dia, 4: dia, 5: dia, 6: dia, 7: dia });
  assert.ok(ruim.avisos.some((a) => a.includes('8 h por dia')));
  assert.ok(ruim.avisos.some((a) => a.includes('art. 71')));
  assert.ok(ruim.avisos.some((a) => a.includes('44 h')));
  assert.ok(ruim.avisos.some((a) => a.includes('descanso semanal')));
});
