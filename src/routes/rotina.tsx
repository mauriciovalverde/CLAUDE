import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bell, CalendarDays, Pill, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Btn, Campo, Card, Carregando, Chip, PageHeader, Vazio, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useFilhos, useQuery } from "@/lib/dados";
import { fDataLonga, fHora, paraInputLocal } from "@/lib/br";
import { cn } from "@/lib/utils";
import { ocorrencias, type Ev } from "@/lib/agenda";

export const Route = createFileRoute("/rotina")({ component: () => <AppShell><Rotina /></AppShell> });

const TIPOS: Record<string, [string, string]> = {
  terapia: ["Terapia", "🧩"], consulta: ["Consulta", "🩺"], escola: ["Escola", "🎒"], medicacao: ["Medicação", "💊"],
  exame: ["Exame", "🧪"], beneficio: ["INSS / BPC", "📋"], lazer: ["Lazer", "🎈"], outro: ["Outro", "📌"],
};
const REPETE: Record<string, string> = { nao: "Não repete", diaria: "Todos os dias", semanal: "Toda semana", quinzenal: "A cada 15 dias", mensal: "Todo mês" };
const LEMBRETE: [number | "", string][] = [["", "Sem lembrete"], [0, "Na hora"], [15, "15 min antes"], [30, "30 min antes"], [60, "1 hora antes"], [1440, "1 dia antes"]];

function Rotina() {
  const { familia } = useAuth();
  const { data: filhos } = useFilhos(familia?.id);
  const [aba, setAba] = useState<"agenda" | "remedios">("agenda");
  const [novo, setNovo] = useState(false);
  const { data: evs, loading, recarregar } = useQuery<Ev[]>(async () => (familia ? (await db.from("agenda").select("*").eq("familia_id", familia.id).order("inicio")).data : []) ?? [], [familia?.id]);

  const dias = useMemo(() => {
    const de = new Date(); de.setHours(0, 0, 0, 0);
    const ate = new Date(de.getTime() + 14 * 864e5);
    const itens = (evs ?? []).flatMap((e) => ocorrencias(e, de, ate).map((d) => ({ e, d }))).sort((a, b) => a.d.getTime() - b.d.getTime());
    const m = new Map<string, typeof itens>();
    itens.forEach((i) => { const k = i.d.toDateString(); m.set(k, [...(m.get(k) ?? []), i]); });
    return [...m.entries()];
  }, [evs]);

  async function apagar(e: Ev) {
    if (!confirm(`Apagar "${e.titulo}"${e.repeticao && e.repeticao !== "nao" ? " e todas as repetições" : ""}?`)) return;
    await db.from("agenda").delete().eq("id", e.id); recarregar();
  }
  if (!familia) return <Carregando />;
  const nomeFilho = (id: string | null) => filhos?.find((f) => f.id === id)?.nome.split(" ")[0];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Minha" highlight="rotina" subtitle="Terapias, consultas, escola e remédios num só lugar, com lembretes." right={aba === "agenda" && <Btn onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Novo compromisso</Btn>} />
      <div role="tablist" className="flex gap-1 rounded-full bg-muted p-1">
        {([["agenda", "Agenda", CalendarDays], ["remedios", "Remédios", Pill]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={cn("tap flex flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold", aba === k ? "bg-card text-primary shadow-card" : "text-muted-foreground")}><I className="h-4 w-4" />{l}</button>
        ))}
      </div>
      {aba === "agenda" && (
        <>
          {novo && <NovoEvento familiaId={familia.id} filhos={filhos ?? []} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); recarregar(); }} />}
          {loading ? <Carregando /> : !dias.length ? <Vazio icon={CalendarDays} titulo="Nada nos próximos 14 dias" texto="Adicione terapias e consultas para receber lembretes." /> : dias.map(([k, itens]) => (
            <section key={k} className="flex flex-col gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{fDataLonga(itens[0].d)}</h2>
              {itens.map(({ e, d }) => (
                <Card key={e.id + d.toISOString()} className="flex items-center gap-3 p-4">
                  <span className="text-2xl" aria-hidden="true">{TIPOS[e.tipo]?.[1] ?? "📌"}</span>
                  <div className="min-w-0 flex-1">
                    <b className="text-navy">{fHora(d)} · {e.titulo}</b>
                    <p className="text-sm text-muted-foreground">{[TIPOS[e.tipo]?.[0], nomeFilho(e.filho_id), e.local].filter(Boolean).join(" · ")}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {e.repeticao && e.repeticao !== "nao" && <Chip>{REPETE[e.repeticao]}</Chip>}
                      {e.lembrete_min != null && <Chip tom="blue"><Bell className="h-3 w-3" /> {LEMBRETE.find((l) => l[0] === e.lembrete_min)?.[1]}</Chip>}
                    </div>
                  </div>
                  <button onClick={() => apagar(e)} className="tap grid place-items-center text-muted-foreground hover:text-emergency" aria-label="Apagar"><Trash2 className="h-4 w-4" /></button>
                </Card>
              ))}
            </section>
          ))}
          <p className="text-xs text-muted-foreground">Os lembretes aparecem enquanto o aplicativo estiver aberto. Ative as notificações em Avisos.</p>
        </>
      )}
      {aba === "remedios" && <Remedios familiaId={familia.id} filhos={filhos ?? []} />}
    </div>
  );
}

function NovoEvento({ familiaId, filhos, onFechar, onSalvo }: { familiaId: string; filhos: { id: string; nome: string }[]; onFechar: () => void; onSalvo: () => void }) {
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(9, 0, 0, 0);
  const [f, setF] = useState({ titulo: "", tipo: "terapia", inicio: paraInputLocal(amanha), repeticao: "semanal", lembrete_min: "60", local: "", notas: "", filho_id: filhos[0]?.id ?? "" });
  async function salvar() {
    if (f.titulo.trim().length < 2) return toast.error("Dê um nome ao compromisso.");
    const { error } = await db.from("agenda").insert({ familia_id: familiaId, filho_id: f.filho_id || null, titulo: f.titulo.trim(), tipo: f.tipo, inicio: new Date(f.inicio).toISOString(), repeticao: f.repeticao, lembrete_min: f.lembrete_min === "" ? null : Number(f.lembrete_min), local: f.local || null, notas: f.notas || null });
    if (error) return toast.error(error.message);
    toast.success("Compromisso salvo."); onSalvo();
  }
  return (
    <Card className="flex flex-col gap-3 border-primary">
      <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Novo compromisso</h2><button onClick={onFechar} className="tap grid place-items-center" aria-label="Fechar"><X /></button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="a-t" label="O quê" obrigatorio><input id="a-t" className={inputCls} placeholder="Ex.: Fono com Dra. Paula" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Campo>
        <Campo id="a-tp" label="Tipo" obrigatorio><select id="a-tp" className={inputCls} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, [l, em]]) => <option key={k} value={k}>{em} {l}</option>)}</select></Campo>
        <Campo id="a-i" label="Quando" obrigatorio><input id="a-i" type="datetime-local" className={inputCls} value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Campo>
        <Campo id="a-r" label="Repetir"><select id="a-r" className={inputCls} value={f.repeticao} onChange={(e) => setF({ ...f, repeticao: e.target.value })}>{Object.entries(REPETE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
        <Campo id="a-l" label="Lembrete"><select id="a-l" className={inputCls} value={f.lembrete_min} onChange={(e) => setF({ ...f, lembrete_min: e.target.value })}>{LEMBRETE.map(([k, l]) => <option key={l} value={String(k)}>{l}</option>)}</select></Campo>
        {filhos.length > 0 && <Campo id="a-f" label="Para quem"><select id="a-f" className={inputCls} value={f.filho_id} onChange={(e) => setF({ ...f, filho_id: e.target.value })}><option value="">Família</option>{filhos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></Campo>}
        <Campo id="a-lo" label="Local"><input id="a-lo" className={inputCls} value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></Campo>
      </div>
      <Campo id="a-n" label="Anotações"><textarea id="a-n" className={textareaCls} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Campo>
      <div className="flex gap-2"><Btn onClick={salvar}>Salvar</Btn><Btn v="ghost" onClick={onFechar}>Cancelar</Btn></div>
    </Card>
  );
}

function Remedios({ familiaId, filhos }: { familiaId: string; filhos: { id: string; nome: string }[] }) {
  const { data, recarregar } = useQuery<any[]>(async () => (await db.from("medicamentos").select("*").eq("familia_id", familiaId).order("created_at")).data ?? [], [familiaId]);
  const [f, setF] = useState({ nome: "", dose: "", horarios: "", notas: "", filho_id: filhos[0]?.id ?? "" });
  async function add() {
    if (!f.nome.trim()) return toast.error("Informe o nome do remédio.");
    const { error } = await db.from("medicamentos").insert({ familia_id: familiaId, filho_id: f.filho_id || null, nome: f.nome.trim(), dose: f.dose || null, horarios: f.horarios || null, notas: f.notas || null, ativo: true });
    if (error) return toast.error(error.message);
    setF({ ...f, nome: "", dose: "", horarios: "", notas: "" }); recarregar();
  }
  async function alternar(m: any) { await db.from("medicamentos").update({ ativo: !m.ativo }).eq("id", m.id); recarregar(); }
  async function apagar(m: any) { if (confirm("Apagar " + m.nome + "?")) { await db.from("medicamentos").delete().eq("id", m.id); recarregar(); } }
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Adicionar remédio</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="m-n" label="Nome" obrigatorio><input id="m-n" className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
          <Campo id="m-d" label="Dose"><input id="m-d" className={inputCls} placeholder="Ex.: 5 ml, 1 comprimido" value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} /></Campo>
          <Campo id="m-h" label="Horários"><input id="m-h" className={inputCls} placeholder="Ex.: 8h e 20h" value={f.horarios} onChange={(e) => setF({ ...f, horarios: e.target.value })} /></Campo>
          {filhos.length > 0 && <Campo id="m-f" label="Para quem"><select id="m-f" className={inputCls} value={f.filho_id} onChange={(e) => setF({ ...f, filho_id: e.target.value })}>{filhos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></Campo>}
        </div>
        <Btn onClick={add} className="self-start"><Plus className="h-4 w-4" /> Adicionar</Btn>
        <p className="text-xs text-muted-foreground">Para receber lembrete do horário, crie um compromisso do tipo “Medicação” que se repete todos os dias. Nunca altere doses sem orientação médica.</p>
      </Card>
      {(data ?? []).map((m) => (
        <Card key={m.id} className={cn("flex items-center gap-3 p-4", !m.ativo && "opacity-60")}>
          <span className="text-2xl" aria-hidden="true">💊</span>
          <div className="flex-1"><b>{m.nome}</b> {m.dose && <span className="text-sm">· {m.dose}</span>}<p className="text-sm text-muted-foreground">{[m.horarios, filhos.find((x) => x.id === m.filho_id)?.nome.split(" ")[0]].filter(Boolean).join(" · ")}</p></div>
          <Btn v="outline" className="min-h-10" onClick={() => alternar(m)}>{m.ativo ? "Suspender" : "Retomar"}</Btn>
          <button onClick={() => apagar(m)} className="tap grid place-items-center text-muted-foreground" aria-label="Apagar"><Trash2 className="h-4 w-4" /></button>
        </Card>
      ))}
    </div>
  );
}
