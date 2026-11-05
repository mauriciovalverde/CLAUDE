import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PenLine, Star } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, Carregando, Chip, PageHeader, Vazio, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { fData } from "@/lib/br";

export const Route = createFileRoute("/historias")({ component: () => <AppShell><Historias /></AppShell> });

function Historias() {
  const { user, familia } = useAuth();
  const [form, setForm] = useState(false);
  const [f, setF] = useState({ titulo: "", texto: "", autor_exibicao: "", anonima: false });
  const { data, loading, recarregar } = useQuery<any[]>(async () => (await db.from("historias").select("*").order("created_at", { ascending: false })).data ?? [], []);
  const publicadas = (data ?? []).filter((h) => h.status === "aprovada");
  const minhas = (data ?? []).filter((h) => h.user_id === user?.id && h.status !== "aprovada");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (f.titulo.trim().length < 4 || f.texto.trim().length < 40) return toast.error("Escreva um título e pelo menos algumas frases.");
    const { error } = await db.from("historias").insert({ user_id: user!.id, titulo: f.titulo.trim(), texto: f.texto.trim(), autor_exibicao: f.anonima ? "Uma mãe da rede" : (f.autor_exibicao.trim() || "Uma mãe da rede"), status: "pendente" });
    if (error) return toast.error("Não foi possível enviar. Seu cadastro precisa estar confirmado.");
    toast.success("História enviada! A equipe vai revisar antes de publicar.");
    setForm(false); setF({ titulo: "", texto: "", autor_exibicao: "", anonima: false }); recarregar();
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Histórias" highlight="que inspiram" subtitle="Relatos reais de mães e famílias. Cada caminho é único, e todos merecem ser contados."
        right={familia?.status === "aprovado" && !form ? <Btn onClick={() => setForm(true)}><PenLine className="h-4 w-4" /> Contar minha história</Btn> : undefined} />
      {form && (
        <form onSubmit={enviar} className="card-soft flex flex-col gap-3 p-5">
          <Aviso>Não inclua nome completo da criança, escola, endereço ou dados de saúde de outras pessoas. A equipe revisa tudo antes de publicar.</Aviso>
          <Campo id="h-t" label="Título" obrigatorio><input id="h-t" className={inputCls} maxLength={120} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Campo>
          <Campo id="h-x" label="Sua história" obrigatorio><textarea id="h-x" className={textareaCls + " min-h-48"} maxLength={5000} value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} /></Campo>
          <Campo id="h-a" label="Como quer assinar"><input id="h-a" className={inputCls} disabled={f.anonima} placeholder="Ex.: Ana, mãe do Pedro" value={f.autor_exibicao} onChange={(e) => setF({ ...f, autor_exibicao: e.target.value })} /></Campo>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.anonima} onChange={(e) => setF({ ...f, anonima: e.target.checked })} /> Publicar de forma anônima</label>
          <div className="flex gap-2"><Btn type="submit">Enviar para revisão</Btn><Btn v="ghost" type="button" onClick={() => setForm(false)}>Cancelar</Btn></div>
        </form>
      )}
      {minhas.map((h) => <Card key={h.id} className="p-4"><Chip tom={h.status === "pendente" ? "amber" : "red"}>{h.status === "pendente" ? "Em revisão" : "Não publicada"}</Chip> <b>{h.titulo}</b></Card>)}
      {loading ? <Carregando /> : !publicadas.length ? <Vazio icon={Star} titulo="Em breve, as primeiras histórias" texto="Seja a primeira a compartilhar a sua caminhada." /> : publicadas.map((h) => (
        <article key={h.id} className="card-soft flex flex-col gap-2 p-6">
          <h2 className="font-display text-xl font-bold text-navy">{h.titulo}</h2>
          <p className="whitespace-pre-line leading-relaxed">{h.texto}</p>
          <p className="text-sm font-semibold text-coral">— {h.autor_exibicao} · {fData(h.created_at)}</p>
        </article>
      ))}
    </div>
  );
}
