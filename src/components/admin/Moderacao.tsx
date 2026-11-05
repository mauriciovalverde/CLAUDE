import { useState } from "react";
import { CalendarHeart, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Btn, Campo, Card, Carregando, Chip, Vazio, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { fDataHora } from "@/lib/br";
import { cn } from "@/lib/utils";

export function HistoriasAdmin() {
  const [st, setSt] = useState("pendente");
  const { data, loading, recarregar } = useQuery<any[]>(async () => (await db.from("historias").select("*").eq("status", st).order("created_at", { ascending: false })).data ?? [], [st]);
  async function mudar(h: any, status: string) { const { error } = await db.from("historias").update({ status }).eq("id", h.id); if (error) return toast.error(error.message); toast.success(status === "aprovada" ? "História publicada." : "Atualizado."); recarregar(); }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">{[["pendente", "Em revisão"], ["aprovada", "Publicadas"], ["recusada", "Não publicadas"]].map(([k, l]) => <button key={k} onClick={() => setSt(k)} className={cn("tap rounded-full border px-4 text-sm font-semibold", st === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{l}</button>)}</div>
      {loading ? <Carregando /> : !(data ?? []).length ? <Vazio icon={Star} titulo="Nenhuma história aqui" /> : data!.map((h) => (
        <Card key={h.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2"><b className="font-display text-lg">{h.titulo}</b><Chip>{h.autor_exibicao}</Chip><span className="text-xs text-muted-foreground">{fDataHora(h.created_at)}</span></div>
          <p className="whitespace-pre-line text-sm">{h.texto}</p>
          <div className="flex gap-2">
            {h.status !== "aprovada" && <Btn v="wa" className="min-h-10" onClick={() => mudar(h, "aprovada")}>Publicar</Btn>}
            {h.status !== "recusada" && <Btn v="outline" className="min-h-10" onClick={() => mudar(h, "recusada")}>{h.status === "aprovada" ? "Despublicar" : "Não publicar"}</Btn>}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function EncontrosAdmin() {
  const { user } = useAuth();
  const [f, setF] = useState({ titulo: "", data: "", local: "", descricao: "", avisar: true });
  const { data, recarregar } = useQuery<any[]>(async () => (await db.from("encontros").select("*").order("data", { ascending: false })).data ?? [], []);
  async function salvar() {
    if (!f.titulo.trim() || !f.data) return toast.error("Informe título e data.");
    const quando = new Date(f.data).toISOString();
    const { error } = await db.from("encontros").insert({ titulo: f.titulo.trim(), data: quando, local: f.local || null, descricao: f.descricao || null });
    if (error) return toast.error(error.message);
    if (f.avisar) {
      const { data: c } = await db.from("comunicados").insert({ titulo: "Novo encontro: " + f.titulo.trim(), mensagem: `${new Date(quando).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}${f.local ? " · " + f.local : ""}. ${f.descricao}`.trim(), publico: "todas", autor_id: user!.id }).select("id").single();
      if (c) await db.rpc("enviar_comunicado", { _id: c.id });
    }
    toast.success("Encontro criado."); setF({ titulo: "", data: "", local: "", descricao: "", avisar: true }); recarregar();
  }
  async function apagar(e: any) { if (confirm("Apagar encontro?")) { await db.from("encontros").delete().eq("id", e.id); recarregar(); } }
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Novo encontro</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="en-t" label="Título" obrigatorio><input id="en-t" className={inputCls} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Campo>
          <Campo id="en-d" label="Data e hora" obrigatorio><input id="en-d" type="datetime-local" className={inputCls} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
          <Campo id="en-l" label="Local ou link"><input id="en-l" className={inputCls} value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></Campo>
        </div>
        <Campo id="en-x" label="Descrição"><textarea id="en-x" className={textareaCls} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.avisar} onChange={(e) => setF({ ...f, avisar: e.target.checked })} /> Avisar todas as famílias confirmadas</label>
        <Btn onClick={salvar} className="self-start"><Plus className="h-4 w-4" /> Criar encontro</Btn>
      </Card>
      {!(data ?? []).length ? <Vazio icon={CalendarHeart} titulo="Nenhum encontro cadastrado" /> : data!.map((e) => (
        <Card key={e.id} className="flex items-center gap-3 p-4">
          <div className="flex-1"><b>{e.titulo}</b><p className="text-sm text-muted-foreground">{fDataHora(e.data)}{e.local ? ` · ${e.local}` : ""}</p></div>
          <button onClick={() => apagar(e)} className="tap grid place-items-center text-muted-foreground hover:text-emergency" aria-label="Apagar"><Trash2 className="h-4 w-4" /></button>
        </Card>
      ))}
    </div>
  );
}
