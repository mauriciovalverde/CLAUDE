/** Gráficos em SVG puro: aparecem iguais na tela, na impressão e no PDF (sem depender de bibliotecas que somem ao imprimir). */

type Item = { nome: string; total: number; cor?: string };

export function BarrasHorizontais({ titulo, dados, cor = "#1F5BFF", vazio = "Sem dados no período." }: { titulo: string; dados: Item[]; cor?: string; vazio?: string }) {
  const max = Math.max(1, ...dados.map((d) => d.total));
  return (
    <figure className="grafico flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
      <figcaption className="text-sm font-bold text-slate-900">{titulo}</figcaption>
      {!dados.length ? <p className="text-xs text-slate-500">{vazio}</p> : (
        <ul className="flex flex-col gap-1.5">
          {dados.map((d) => (
            <li key={d.nome} className="grid grid-cols-[7.5rem_1fr_1.75rem] items-center gap-2 text-xs">
              <span className="truncate text-slate-700" title={d.nome}>{d.nome}</span>
              <span className="h-3.5 rounded-full bg-slate-100">
                <span className="block h-3.5 rounded-full" style={{ width: `${Math.max(4, (d.total / max) * 100)}%`, background: d.cor ?? cor }} />
              </span>
              <b className="text-right text-slate-900">{d.total}</b>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

export function ColunasTempo({ titulo, dados, cor = "#E5484D", legenda }: { titulo: string; dados: Item[]; cor?: string; legenda?: string }) {
  const W = 320, H = 130, pad = { l: 22, r: 6, t: 10, b: 22 };
  const max = Math.max(1, ...dados.map((d) => d.total));
  const passo = (W - pad.l - pad.r) / Math.max(1, dados.length);
  const bw = Math.min(26, passo * 0.62);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
  const rotulos = dados.length > 8 ? 2 : 1;
  return (
    <figure className="grafico flex flex-col gap-1 rounded-xl border border-slate-200 p-3">
      <figcaption className="text-sm font-bold text-slate-900">{titulo}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={titulo}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E2E8F0" strokeWidth="1" />
            <text x={pad.l - 5} y={y(t) + 3} fontSize="8" textAnchor="end" fill="#64748B">{t}</text>
          </g>
        ))}
        {dados.map((d, i) => {
          const x = pad.l + passo * i + (passo - bw) / 2;
          return (
            <g key={d.nome + i}>
              {d.total > 0 && <rect x={x} y={y(d.total)} width={bw} height={H - pad.b - y(d.total)} rx="3" fill={d.cor ?? cor} />}
              {d.total > 0 && <text x={x + bw / 2} y={y(d.total) - 2} fontSize="8" textAnchor="middle" fill="#0F172A" fontWeight="700">{d.total}</text>}
              {i % rotulos === 0 && <text x={x + bw / 2} y={H - 8} fontSize="7.5" textAnchor="middle" fill="#64748B">{d.nome}</text>}
            </g>
          );
        })}
      </svg>
      {legenda && <p className="text-[11px] text-slate-500">{legenda}</p>}
    </figure>
  );
}

export function LinhaIntensidade({ titulo, pontos: brutos }: { titulo: string; pontos: { data: Date; valor: number }[] }) {
  const pontos = [...brutos].sort((a, b) => a.data.getTime() - b.data.getTime());
  const W = 320, H = 130, pad = { l: 22, r: 8, t: 10, b: 22 };
  if (!pontos.length) return (
    <figure className="grafico flex flex-col gap-1 rounded-xl border border-slate-200 p-3">
      <figcaption className="text-sm font-bold text-slate-900">{titulo}</figcaption>
      <p className="text-xs text-slate-500">Sem crises registradas no período.</p>
    </figure>
  );
  const t0 = pontos[0]!.data.getTime(), t1 = pontos[pontos.length - 1]!.data.getTime();
  const x = (d: Date) => pad.l + (t1 === t0 ? (W - pad.l - pad.r) / 2 : ((d.getTime() - t0) / (t1 - t0)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - 1) / 4);
  const caminho = pontos.map((p, i) => `${i ? "L" : "M"}${x(p.data).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return (
    <figure className="grafico flex flex-col gap-1 rounded-xl border border-slate-200 p-3">
      <figcaption className="text-sm font-bold text-slate-900">{titulo}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={titulo}>
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#E2E8F0" strokeWidth="1" />
            <text x={pad.l - 5} y={y(v) + 3} fontSize="8" textAnchor="end" fill="#64748B">{v}</text>
          </g>
        ))}
        {pontos.length > 1 && <path d={caminho} fill="none" stroke="#F76B15" strokeWidth="2" />}
        {pontos.map((p, i) => <circle key={i} cx={x(p.data)} cy={y(p.valor)} r="3.5" fill={p.valor >= 4 ? "#E5484D" : "#F76B15"} stroke="#fff" strokeWidth="1" />)}
        <text x={pad.l} y={H - 8} fontSize="7.5" fill="#64748B">{fmt(pontos[0]!.data)}</text>
        {t1 !== t0 && <text x={W - pad.r} y={H - 8} fontSize="7.5" textAnchor="end" fill="#64748B">{fmt(pontos[pontos.length - 1]!.data)}</text>}
      </svg>
      <p className="text-[11px] text-slate-500">1 = leve · 5 = muito forte. Pontos vermelhos: intensidade 4 ou 5.</p>
    </figure>
  );
}
