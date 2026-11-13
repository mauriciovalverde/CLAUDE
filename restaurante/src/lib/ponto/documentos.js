// Validação dos documentos da ficha cadastral (dígitos verificadores oficiais).
const so = (s) => String(s ?? '').replace(/\D/g, '');

/** CPF: 11 dígitos com dois dígitos verificadores (módulo 11). */
export function validarCPF(v) {
  const c = so(v); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
/** PIS/PASEP/NIT: 11 dígitos, pesos 3 2 9 8 7 6 5 4 3 2. */
export function validarPIS(v) {
  const c = so(v); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const p = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = p.reduce((t, w, i) => t + w * Number(c[i]), 0);
  const r = 11 - (s % 11); return (r >= 10 ? 0 : r) === Number(c[10]);
}
export const fmtCPF = (v) => { const c = so(v); return c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : v; };
export const fmtPIS = (v) => { const c = so(v); return c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 8)}.${c.slice(8, 10)}-${c.slice(10)}` : v; };

/**
 * Confere a jornada contratual com os limites legais. Retorna avisos (não impede salvar: acordos e convenções podem prever outras regras).
 * semana: { "1": {entrada, saida, int_ini, int_fim} | null, ... "7": ... }
 */
export function conferirJornada(semana) {
  const hm = (s) => (s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : null);
  const avisos = []; let totalSemana = 0; let folgas = 0;
  for (let d = 1; d <= 7; d++) {
    const c = semana[String(d)];
    if (!c || !c.entrada || !c.saida) { folgas++; continue; }
    const e = hm(c.entrada); let s = hm(c.saida); if (s <= e) s += 1440;
    let ii = hm(c.int_ini), fi = hm(c.int_fim); if (ii != null && ii < e) ii += 1440; if (fi != null && ii != null && fi <= ii) fi += 1440;
    const intervalo = ii != null && fi != null ? fi - ii : 0; const trab = s - e - intervalo; totalSemana += trab;
    const nome = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][d];
    if (ii != null && (ii <= e || fi >= s)) avisos.push(`${nome}: o intervalo precisa estar dentro da jornada.`);
    if (trab > 480) avisos.push(`${nome}: ${Math.floor(trab / 60)}h${String(trab % 60).padStart(2, '0')} de jornada — o limite é 8 h por dia (CF art. 7º, XIII; CLT art. 58), salvo compensação ou escala prevista em acordo/convenção (ex.: 12x36, CLT art. 59-A).`);
    if (trab > 360 && intervalo < 60) avisos.push(`${nome}: jornada acima de 6 h exige intervalo de 1 h a 2 h (CLT art. 71).`);
    else if (trab > 240 && trab <= 360 && intervalo < 15) avisos.push(`${nome}: jornada de 4 h a 6 h exige intervalo de 15 minutos (CLT art. 71, §1º).`);
    if (intervalo > 120) avisos.push(`${nome}: intervalo acima de 2 h só com acordo escrito ou convenção (CLT art. 71).`);
  }
  if (totalSemana > 44 * 60) avisos.push(`Total semanal de ${Math.floor(totalSemana / 60)}h${String(totalSemana % 60).padStart(2, '0')} — o limite é 44 h por semana (CF art. 7º, XIII).`);
  if (folgas === 0) avisos.push('Sem dia de descanso na semana: o descanso semanal remunerado de 24 h é obrigatório (CF art. 7º, XV; Lei 605/1949; CLT art. 67).');
  return { avisos, totalSemana };
}
