import { useState } from 'react';
import { addDias, addMeses, fimMes, hoje, inicioMes } from '../lib/fmt';
import { Input, Select } from './ui';

export type Intervalo = { de: string; ate: string; nome: string };
const trimestre = () => { const d = new Date(hoje() + 'T12:00:00Z'); const m = Math.floor(d.getUTCMonth() / 3) * 3; const i = `${d.getUTCFullYear()}-${String(m + 1).padStart(2, '0')}-01`; return { de: i, ate: fimMes(addMeses(i, 2)) }; };
const semestre = () => { const d = new Date(hoje() + 'T12:00:00Z'); const m = d.getUTCMonth() < 6 ? 0 : 6; const i = `${d.getUTCFullYear()}-${String(m + 1).padStart(2, '0')}-01`; return { de: i, ate: fimMes(addMeses(i, 5)) }; };
const semana = () => { const d = new Date(hoje() + 'T12:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; const i = addDias(hoje(), -dow); return { de: i, ate: addDias(i, 6) }; };
export const OPCOES: Record<string, () => { de: string; ate: string }> = {
  hoje: () => ({ de: hoje(), ate: hoje() }), semana, mes: () => ({ de: inicioMes(), ate: fimMes() }), mes_passado: () => ({ de: addMeses(inicioMes(), -1), ate: fimMes(addMeses(inicioMes(), -1)) }),
  trimestre, semestre, ano: () => ({ de: hoje().slice(0, 4) + '-01-01', ate: hoje().slice(0, 4) + '-12-31' }), tudo: () => ({ de: '2000-01-01', ate: '2100-12-31' }),
};
const NOMES: Record<string, string> = { hoje: 'Hoje', semana: 'Esta semana', mes: 'Este mês', mes_passado: 'Mês passado', trimestre: 'Este trimestre', semestre: 'Este semestre', ano: 'Este ano', tudo: 'Tudo', personalizado: 'Personalizado' };

export function usePeriodo(inicial = 'mes') {
  const [op, setOp] = useState(inicial);
  const [p, setP] = useState(OPCOES[inicial]());
  const seletor = (
    <div className="flex flex-wrap items-end gap-2">
      <Select className="!w-auto" value={op} onChange={(e) => { setOp(e.target.value); if (OPCOES[e.target.value]) setP(OPCOES[e.target.value]()); }}>{Object.entries(NOMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      {op === 'personalizado' && <><Input type="date" className="!w-auto" value={p.de} onChange={(e) => setP({ ...p, de: e.target.value })} /><Input type="date" className="!w-auto" value={p.ate} onChange={(e) => setP({ ...p, ate: e.target.value })} /></>}
    </div>
  );
  return { ...p, nome: NOMES[op], seletor };
}
