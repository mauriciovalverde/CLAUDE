import { useState } from "react";
import { Flag, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Btn, Campo, Card, Carregando, Chip, Vazio, inputCls, textareaCls } from "@/components/app/kit";
import { db, useQuery } from "@/lib/dados";
import { fDataHora } from "@/lib/br";
import { cn } from "@/lib/utils";

type Den = { id: string; alvo_tipo: string; alvo_id: string; alvo_nome: string; motivo: string; status: string; created_at: string; conteudo: string | null; conteudo_status: string | null; denuncias: number };
const ALVO: Record<string, string> = { perfil: "Perfil", mensagem: "Mensagem privada", post: "Publicação", comentario: "Comentário" };

/** Moderação da Rede de Famílias: denúncias, grupos sugeridos, núcleos locais e moderadores. */
export function RedeAdmin() {
  const [aba, setAba] = useState<"denuncias" | "grupos">("denuncias");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">{[["denuncias", "Denúncias"], ["grupos", "Grupos e núcleos"]].map(([k, l]) => (
        <button key={k} onClick={() => setAba(k as any)} className={cn("tap rounded-full border px-4 text-sm font-semibold", aba === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{l}</button>
      ))}</div>
      {aba === "denuncias" ? <Denuncias /> : <GruposAdmin />}
    </div>
  );
}

function Denuncias() {
  const { data, loading, recarregar } = useQuery<Den[]>(async () => (await db.rpc("rf_denuncias_admin")).data ?? [], []);
  async function acao(d: Den, a: string) { const { error } = await db.rpc("rf_moderar", { _denuncia: d.id, _acao: a }); if (error) return toast.error(error.message); toast.success("Feito."); recarregar(); }
  if (loading) return <Carregando />;
  const abertas = (data ?? []).filter((d) => d.status === "aberta");
  if (!data?.length) return <Vazio icon={Flag} titulo="Nenhuma denúncia" />;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{abertas.length} aberta(s). Mensagens privadas só aparecem aqui quando denunciadas por quem as recebeu.</p>
      {data.map((d) => (
        <Card key={d.id} className={cn("flex flex-col gap-2 p-4", d.status !== "aberta" && "opacity-60")}>
          <div className="flex flex-wrap items-center gap-2"><Chip tom="red">{ALVO[d.alvo_tipo]}</Chip><b className="text-navy">{d.alvo_nome}</b><span className="text-xs text-muted-foreground">{fDataHora(d.created_at)} · {d.denuncias} denúncia(s)</span>{d.conteudo_status && <Chip>{d.conteudo_status}</Chip>}{d.status !== "aberta" && <Chip tom="green">resolvida</Chip>}</div>
          <p className="text-sm"><b>Motivo:</b> {d.motivo}</p>
          {d.conteudo && <p className="whitespace-pre-line rounded-xl bg-muted p-3 text-sm">{d.conteudo}</p>}
          {d.status === "aberta" && <div className="flex flex-wrap gap-2">
            {["post", "comentario"].includes(d.alvo_tipo) && (d.conteudo_status === "oculto" ? <Btn v="outline" className="min-h-10" onClick={() => acao(d, "restaurar")}>Restaurar</Btn> : <Btn v="danger" className="min-h-10" onClick={() => acao(d, "ocultar")}>Ocultar</Btn>)}
            <Btn v="outline" className="min-h-10" onClick={() => { if (confirm(`Suspender o perfil de ${d.alvo_nome} na rede?`)) acao(d, "suspender_perfil"); }}>Suspender perfil</Btn>
            <Btn v="ghost" className="min-h-10" onClick={() => acao(d, "manter")}>Sem problema</Btn>
          </div>}
        </Card>
      ))}
    </div>
  );
}

function GruposAdmin() {
  const { data, loading, recarregar } = useQuery<any[]>(async () => (await db.rpc("rf_grupos_lista")).data ?? [], []);
  const [f, setF] = useState({ nome: "", cidade: "", descricao: "", com_profissional: false });
  const [mod, setMod] = useState<Record<string, string>>({});
  async function criar() {
    if (f.nome.trim().length < 3) return toast.error("Dê um nome ao núcleo.");
    const { error } = await db.from("rf_grupos").insert({ nome: f.nome.trim(), tipo: "nucleo", cidade: f.cidade.trim() || null, descricao: f.descricao.trim() || null, com_profissional: f.com_profissional });
    if (error) return toast.error(error.message); toast.success("Núcleo criado."); setF({ nome: "", cidade: "", descricao: "", com_profissional: false }); recarregar();
  }
  async function status(g: any, s: string) { const { error } = await db.from("rf_grupos").update({ status: s }).eq("id", g.id); if (error) return toast.error(error.message); toast.success(s === "aprovado" ? "Grupo aprovado." : "Grupo arquivado."); recarregar(); }
  async function moderador(g: any) {
    const email = (mod[g.id] ?? "").trim().toLowerCase(); if (!email) return;
    const { data: p } = await db.from("perfis").select("id").ilike("email", email).maybeSingle();
    if (!p) return toast.error("Nenhuma conta com este e-mail.");
    const { error } = await db.rpc("rf_definir_moderador", { _g: g.id, _u: p.id, _moderador: true });
    if (error) return toast.error(error.message); toast.success("Moderador(a) definido(a)."); setMod({ ...mod, [g.id]: "" }); recarregar();
  }
  if (loading) return <Carregando />;
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold">Novo núcleo local</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo id="nu-n" label="Nome" obrigatorio><input id="nu-n" className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Núcleo AMPARO Jequié" /></Campo>
          <Campo id="nu-c" label="Cidade"><input id="nu-c" className={inputCls} value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></Campo>
        </div>
        <Campo id="nu-d" label="Descrição"><textarea id="nu-d" className={cn(textareaCls, "min-h-20")} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.com_profissional} onChange={(e) => setF({ ...f, com_profissional: e.target.checked })} /> Moderado por profissional habilitado</label>
        <Btn className="self-start" onClick={criar}><Plus className="h-4 w-4" /> Criar núcleo</Btn>
      </Card>
      {!(data ?? []).length ? <Vazio icon={Users} titulo="Nenhum grupo" /> : data!.map((g) => (
        <Card key={g.id} className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2"><Chip tom={g.tipo === "nucleo" ? "green" : "blue"}>{g.tipo}</Chip>{g.status === "pendente" && <Chip tom="amber">sugerido, aguardando</Chip>}<b className="text-navy">{g.nome}</b><span className="text-xs text-muted-foreground">{[g.bairro, g.cidade].filter(Boolean).join(" · ")} · {g.membros} participante(s)</span></div>
          {g.descricao && <p className="text-sm">{g.descricao}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {g.status === "pendente" && <Btn v="wa" className="min-h-10" onClick={() => status(g, "aprovado")}>Aprovar</Btn>}
            <Btn v="ghost" className="min-h-10" onClick={() => { if (confirm("Arquivar este grupo?")) status(g, "arquivado"); }}>Arquivar</Btn>
            <input aria-label="E-mail do moderador" className={cn(inputCls, "min-h-10 max-w-64 text-sm")} placeholder="e-mail do(a) moderador(a)" value={mod[g.id] ?? ""} onChange={(e) => setMod({ ...mod, [g.id]: e.target.value })} />
            <Btn v="soft" className="min-h-10" onClick={() => moderador(g)}>Definir moderador(a)</Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}
