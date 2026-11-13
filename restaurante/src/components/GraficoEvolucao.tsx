import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Evolucao } from '../lib/analise';
import { brl, compacto } from '../lib/fmt';

const CORES = ['#A3141B', '#F79F31', '#2563EB', '#059669', '#7C3AED', '#64748B'];

/** Gráfico de linhas da evolução no tempo (mesmos dados do PDF). */
export default function GraficoEvolucao({ ev, altura = 240 }: { ev: Evolucao; altura?: number }) {
  const dados = ev.rotulos.map((r, i) => Object.fromEntries([['r', r], ...ev.series.map((s) => [s.nome, s.valores[i]])]));
  return (
    <div>
      <div className="mb-1 text-sm font-semibold">{ev.titulo}</div>
      <div style={{ height: altura }}>
        <ResponsiveContainer>
          <LineChart data={dados} margin={{ left: -6, right: 8, top: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="r" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={14} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (ev.moeda === false ? String(v) : compacto(v))} width={48} />
            <Tooltip formatter={(v: any) => (ev.moeda === false ? v : brl(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {ev.series.map((s, i) => <Line key={s.nome} type="monotone" dataKey={s.nome} stroke={CORES[i % CORES.length]} strokeWidth={2} dot={ev.rotulos.length <= 31} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
