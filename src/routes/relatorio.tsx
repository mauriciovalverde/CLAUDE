import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Btn, Carregando, PageHeader, inputCls } from "@/components/app/kit";
import { db, useFilhos, useQuery } from "@/lib/dados";
import { tipoInfo, useFamiliaDiario, type Registro } from "@/lib/diario";
import { fData, fDataHora, idade } from "@/lib/br";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/relatorio")({
  validateSearch: (s: Record<string, unknown>) => ({ filho: typeof s.filho === "string" ? s.filho : undefined, dias: Number(s.dias) || undefined }) as { filho?: string; dias?: number },
  component: () => <AppShell><Relatorio /></AppShell>,
});

function freq(xs: string[]) {
  const m = new Map<string, number>();
  xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function Relatorio() {
  const s = Route.useSearch();
  const fam = useFamiliaDiario();
  const { data: filhos } = useFilhos(fam.familiaId ?? undefined);
  const [filho, setFilho] = useState(s.filho ?? "");
  const [dias, setDias] = useState(s.dias ?? 30);
  useEffect(() => { if (!filho && filhos?.length) setFilho(filhos[0].id); }, [filhos, filho]);

  const { data, loading } = useQuery(async () => {
    if (!fam.familiaId || !filho) return null;
    const desde = new Date(Date.now() - dias * 864e5).toISOString();
    const [r, saude, meds] = await Promise.all([
      db.from("diario_registros").select("*").eq("familia_id", fam.familiaId).eq("filho_id", filho).gte("ocorrido_em", desde).order("ocorrido_em"),
      fam.propria ? db.from("filhos_saude").select("diagnosticos,diagnostico_outro,terapias,usa_medicacao,escola").eq("filho_id", filho).maybeSingle() : { data: null },
      fam.propria ? db.from("medicamentos").select("nome,dose,horarios").eq("filho_id", filho).eq("ativo", true) : { data: [] },
    ]);
    return { regs: (r.data ?? []) as Registro[], saude: saude.data as any, meds: (meds.data ?? []) as any[] };
  }, [fam.familiaId, filho, dias, fam.propria]);

  const f = filhos?.find((x) => x.id === filho);
  if (!fam.pronto) return <Carregando />;
  const regs = data?.regs ?? [];
  const crises = regs.filter((r) => r.tipo === "crise");
  const tipos = freq(regs.map((r) => tipoInfo(r.tipo).l));
  const gat = freq(regs.flatMap((r) => (r.antecedente ?? "").split(", ").filter(Boolean))).slice(0, 6);
  const aj = freq(regs.flatMap((r) => (r.consequencia ?? "").split(", ").filter(Boolean))).slice(0, 6);
  const conquistas = regs.filter((r) => r.tipo === "conquista");
  const diag = [...(data?.saude?.diagnosticos ?? []), data?.saude?.diagnostico_outro].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print">
        <PageHeader title="Relatório" highlight="para consultas" subtitle="Um resumo do diário para levar ao médico, terapeuta ou escola. Use “Imprimir” e escolha “Salvar como PDF”." back={{ to: "/diario", label: "Diário" }} />
        <div className="flex flex-wrap gap-2">
          <select aria-label="Criança" className={cn(inputCls, "w-auto")} value={filho} onChange={(e) => setFilho(e.target.value)}>{(filhos ?? []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
          <select aria-label="Período" className={cn(inputCls, "w-auto")} value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>3 meses</option><option value={180}>6 meses</option>
          </select>
          <Btn onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir / PDF</Btn>
        </div>
      </div>

      {loading ? <Carregando /> : (
        <article className="print-page flex flex-col gap-5 rounded-3xl border border-border bg-white p-6 text-[15px] text-slate-900">
          <header className="border-b pb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Centro de Acolhimento à Família Atípica</p>
            <h1 className="font-display text-2xl font-extrabold">Relatório do diário · {f?.nome}</h1>
            <p className="text-sm">{f?.nascimento ? `${idade(f.nascimento)} · ` : ""}Período: {fData(new Date(Date.now() - dias * 864e5))} a {fData(new Date())}</p>
            {diag && <p className="text-sm"><b>Diagnóstico informado pela família:</b> {diag}</p>}
            {data?.saude?.terapias && <p className="text-sm"><b>Terapias:</b> {data.saude.terapias}</p>}
            {data?.meds?.length ? <p className="text-sm"><b>Medicações em uso:</b> {data.meds.map((m) => [m.nome, m.dose, m.horarios].filter(Boolean).join(" ")).join("; ")}</p> : null}
          </header>
          <section className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-100 p-3"><b className="text-2xl">{regs.length}</b><br /><span className="text-xs">registros</span></div>
            <div className="rounded-xl bg-slate-100 p-3"><b className="text-2xl">{crises.length}</b><br /><span className="text-xs">crises</span></div>
            <div className="rounded-xl bg-slate-100 p-3"><b className="text-2xl">{crises.length ? (crises.reduce((a, r) => a + (r.intensidade ?? 0), 0) / crises.length).toFixed(1) : "–"}</b><br /><span className="text-xs">intensidade média (1–5)</span></div>
          </section>
          <section className="grid gap-4 sm:grid-cols-3">
            <div><h2 className="font-bold">Registros por tipo</h2><ul className="text-sm">{tipos.map(([k, n]) => <li key={k}>{k}: {n}</li>)}</ul></div>
            <div><h2 className="font-bold">Gatilhos frequentes</h2><ul className="text-sm">{gat.length ? gat.map(([k, n]) => <li key={k}>{k}: {n}</li>) : <li>—</li>}</ul></div>
            <div><h2 className="font-bold">O que ajudou</h2><ul className="text-sm">{aj.length ? aj.map(([k, n]) => <li key={k}>{k}: {n}</li>) : <li>—</li>}</ul></div>
          </section>
          {conquistas.length > 0 && <section><h2 className="font-bold">Conquistas ⭐</h2><ul className="list-disc pl-5 text-sm">{conquistas.map((c) => <li key={c.id}>{fData(c.ocorrido_em)} — {c.nota}</li>)}</ul></section>}
          <section>
            <h2 className="mb-1 font-bold">Registros detalhados</h2>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b text-left"><th className="py-1 pr-2">Data</th><th className="pr-2">Tipo</th><th>Detalhes</th></tr></thead>
              <tbody>
                {regs.map((r) => (
                  <tr key={r.id} className="border-b align-top">
                    <td className="whitespace-nowrap py-1 pr-2">{fDataHora(r.ocorrido_em)}</td>
                    <td className="pr-2">{tipoInfo(r.tipo).l}{r.intensidade ? ` (${r.intensidade}/5)` : ""}</td>
                    <td>{[r.humor, r.antecedente && "Antes: " + r.antecedente, r.comportamento, r.consequencia && "Ajudou: " + r.consequencia, r.sentido, r.nota, r.origem === "escola" ? "(registro da escola)" : ""].filter(Boolean).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!regs.length && <p className="text-sm">Nenhum registro no período.</p>}
          </section>
          <footer className="border-t pt-2 text-xs text-slate-500">Registros feitos pela família e cuidadores. Este relatório é um apoio à consulta e não substitui avaliação profissional. Gerado em {fDataHora(new Date())}.</footer>
        </article>
      )}
    </div>
  );
}
