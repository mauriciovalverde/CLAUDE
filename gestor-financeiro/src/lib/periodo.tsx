import { createContext, useContext, useState, ReactNode } from 'react';
import { addDias, fimMes, hoje, inicioMes } from './fmt';

export type Periodo = { tipo: string; de: string; ate: string };

export function calcularPeriodo(tipo: string, ref = hoje()): Periodo {
  const ano = Number(ref.slice(0, 4)), mes = Number(ref.slice(5, 7));
  const p = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`;
  switch (tipo) {
    case 'trimestre': { const m0 = Math.floor((mes - 1) / 3) * 3 + 1; return { tipo, de: p(ano, m0), ate: fimMes(p(ano, m0 + 2)) }; }
    case 'semestre': { const m0 = mes <= 6 ? 1 : 7; return { tipo, de: p(ano, m0), ate: fimMes(p(ano, m0 + 5)) }; }
    case 'ano': return { tipo, de: `${ano}-01-01`, ate: `${ano}-12-31` };
    case '12meses': { const d = new Date(Date.UTC(ano, mes - 12, 1)).toISOString().slice(0, 10); return { tipo, de: d, ate: fimMes(ref) }; }
    default: return { tipo: 'mes', de: inicioMes(ref), ate: fimMes(ref) };
  }
}

const Ctx = createContext<{ periodo: Periodo; setPeriodo: (p: Periodo) => void }>(null as any);
export function PeriodoProvider({ children }: { children: ReactNode }) {
  const [periodo, set] = useState<Periodo>(() => {
    try { const s = localStorage.getItem('gfi-periodo'); if (s) { const p = JSON.parse(s); return p.tipo === 'personalizado' ? p : calcularPeriodo(p.tipo); } } catch { /* ignore */ }
    return calcularPeriodo('mes');
  });
  const setPeriodo = (p: Periodo) => { set(p); try { localStorage.setItem('gfi-periodo', JSON.stringify(p)); } catch { /* ignore */ } };
  return <Ctx.Provider value={{ periodo, setPeriodo }}>{children}</Ctx.Provider>;
}
export const usePeriodo = () => useContext(Ctx);
export const proximosDias = (n: number) => ({ de: hoje(), ate: addDias(hoje(), n) });
