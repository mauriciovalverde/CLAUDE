/** Expande compromissos repetidos da agenda em ocorrências dentro de um intervalo. */
export type Ev = { id: string; titulo: string; tipo: string; inicio: string; repeticao: string | null; lembrete_min: number | null; local: string | null; notas: string | null; filho_id: string | null };

export function ocorrencias(e: Ev, de: Date, ate: Date): Date[] {
  const base = new Date(e.inicio);
  const passo = { diaria: 1, semanal: 7, quinzenal: 14 }[e.repeticao ?? ""] as number | undefined;
  const res: Date[] = [];
  if (!e.repeticao || e.repeticao === "nao") { if (base >= de && base <= ate) res.push(base); return res; }
  if (e.repeticao === "mensal") {
    for (let i = 0; i < 24; i++) { const d = new Date(base); d.setMonth(base.getMonth() + i); if (d > ate) break; if (d >= de) res.push(d); }
    return res;
  }
  const d = new Date(base);
  if (d < de) { const n = Math.ceil((de.getTime() - d.getTime()) / (passo! * 864e5)); d.setDate(d.getDate() + n * passo!); }
  while (d <= ate) { res.push(new Date(d)); d.setDate(d.getDate() + passo!); }
  return res;
}
