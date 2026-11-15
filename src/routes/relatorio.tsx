import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Btn, Carregando, PageHeader, inputCls } from "@/components/app/kit";
import { db, useFilhos, useQuery } from "@/lib/dados";
import { tipoInfo, useFamiliaDiario, type Registro } from "@/lib/diario";
import { fData, fDataHora, idade, idadeTxt } from "@/lib/br";
import { cn } from "@/lib/utils";
import { BarrasHorizontais, ColunasTempo, LinhaIntensidade } from "@/components/app/GraficosRelatorio";

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
  const tipos = freq(regs.map((r) => r.tipo)).map(([k, n]) => ({ nome: tipoInfo(k).l, total: n, cor: tipoInfo(k).cor }));
  const gat = freq(regs.flatMap((r) => (r.antecedente ?? "").split(", ").filter(Boolean))).slice(0, 6).map(([nome, total]) => ({ nome, total }));
  const aj = freq(regs.flatMap((r) => (r.consequencia ?? "").split(", ").filter(Boolean))).slice(0, 6).map(([nome, total]) => ({ nome, total }));
  const turnos = ["Madrugada", "Manhã", "Tarde", "Noite"];
  const horarios = turnos.map((t) => ({ nome: t, total: crises.filter((r) => { const h = new Date(r.ocorrido_em).getHours(); return turnos[h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3] === t; }).length })).filter((x) => x.total);
  const humores = freq(regs.map((r) => r.humor ?? "").filter(Boolean)).map(([nome, total]) => ({ nome, total }));
  const conquistas = regs.filter((r) => r.tipo === "conquista");
  const diag = [...(data?.saude?.diagnosticos ?? []), data?.saude?.diagnostico_outro].filter(Boolean).join(", ");
  const media = crises.length ? (crises.reduce((a, r) => a + (r.intensidade ?? 0), 0) / crises.length) : 0;
  const fortes = crises.filter((r) => (r.intensidade ?? 0) >= 4).length;
  // crises por período: por dia (até 14 dias) ou por semana
  const porDia = dias <= 14;
  const nBaldes = porDia ? dias : Math.min(13, Math.ceil(dias / 7));
  const tam = (porDia ? 1 : 7) * 864e5;
  const fimP = Date.now();
  const baldes = Array.from({ length: nBaldes }, (_, i) => {
    const ini = fimP - (nBaldes - i) * tam, fim = ini + tam;
    return { nome: new Date(porDia ? ini + 1 : ini + 864e5).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), total: crises.filter((r) => { const t = new Date(r.ocorrido_em).getTime(); return t > ini && t <= fim; }).length };
  });
  const idadeOk = f?.nascimento && !idadeTxt(f.nascimento).startsWith("0 ") ? idadeTxt(f.nascimento) : "";
  const resumo = [
    `No período foram feitos ${regs.length} registro${regs.length === 1 ? "" : "s"}, sendo ${crises.length} crise${crises.length === 1 ? "" : "s"}${crises.length ? ` com intensidade média de ${media.toFixed(1)} (escala de 1 a 5)` : ""}.`,
    fortes ? `${fortes} crise${fortes === 1 ? " teve" : "s tiveram"} intensidade forte ou muito forte.` : "",
    gat[0] ? `Gatilho mais frequente: ${gat[0].nome.toLowerCase()}${gat[1] ? `, seguido de ${gat[1].nome.toLowerCase()}` : ""}.` : "",
    horarios.length ? `As crises aconteceram mais no período da ${[...horarios].sort((a, b) => b.total - a.total)[0]!.nome.toLowerCase()}.` : "",
    aj[0] ? `O que mais ajudou: ${aj.slice(0, 3).map((x) => x.nome.toLowerCase()).join(", ")}.` : "",
    conquistas.length ? `${conquistas.length} conquista${conquistas.length === 1 ? " registrada" : "s registradas"} no período.` : "",
  ].filter(Boolean).join(" ");

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
            <p className="text-sm">{idadeOk ? `${idadeOk} · ` : ""}Período: {fData(new Date(Date.now() - dias * 864e5))} a {fData(new Date())}</p>
            {diag && <p className="text-sm"><b>Diagnóstico informado pela família:</b> {diag}</p>}
            {data?.saude?.terapias && <p className="text-sm"><b>Terapias:</b> {data.saude.terapias}</p>}
            {data?.meds?.length ? <p className="text-sm"><b>Medicações em uso:</b> {data.meds.map((m) => [m.nome, m.dose, m.horarios].filter(Boolean).join(" ")).join("; ")}</p> : null}
          </header>
          <section className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-slate-100 p-2"><b className="text-2xl">{regs.length}</b><br /><span className="text-xs">registros</span></div>
            <div className="rounded-xl bg-red-50 p-2"><b className="text-2xl text-red-600">{crises.length}</b><br /><span className="text-xs">crises</span></div>
            <div className="rounded-xl bg-orange-50 p-2"><b className="text-2xl text-orange-600">{crises.length ? media.toFixed(1) : "–"}</b><br /><span className="text-xs">intensidade média</span></div>
            <div className="rounded-xl bg-amber-50 p-2"><b className="text-2xl text-amber-600">{conquistas.length}</b><br /><span className="text-xs">conquistas</span></div>
          </section>
          <section className="rounded-xl bg-blue-50 p-3 text-sm leading-relaxed"><b>Resumo do período.</b> {resumo}</section>
          <section className="grid gap-3 sm:grid-cols-2">
            <ColunasTempo titulo={porDia ? "Crises por dia" : "Crises por semana"} dados={baldes} legenda={porDia ? undefined : "Cada coluna é uma semana (data de início)."} />
            <LinhaIntensidade titulo="Intensidade das crises" pontos={crises.filter((r) => r.intensidade).map((r) => ({ data: new Date(r.ocorrido_em), valor: r.intensidade! }))} />
            <BarrasHorizontais titulo="Registros por tipo" dados={tipos} />
            <BarrasHorizontais titulo="Gatilhos mais frequentes" dados={gat} cor="#6E56CF" vazio="Nenhum gatilho anotado." />
            <BarrasHorizontais titulo="O que mais ajudou" dados={aj} cor="#30A46C" vazio="Nenhuma estratégia anotada." />
            {horarios.length ? <BarrasHorizontais titulo="Horário das crises" dados={horarios} cor="#F76B15" /> : <BarrasHorizontais titulo="Humor registrado" dados={humores} cor="#1F5BFF" vazio="Nenhum humor anotado." />}
          </section>
          <footer className="text-[11px] text-slate-500">Página 1: resumo e gráficos. A partir da página 2: registros detalhados do diário.</footer>

          <div className="quebra-pagina" />
          <header className="border-b pb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Registros do diário</p>
            <h2 className="font-display text-xl font-extrabold">{f?.nome} · {fData(new Date(Date.now() - dias * 864e5))} a {fData(new Date())}</h2>
          </header>
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
