import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Btn, Card, Carregando, Chip, PageHeader, Vazio } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { fDataHora } from "@/lib/br";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/avisos")({ component: () => <AppShell><Avisos /></AppShell> });


function Avisos() {
  const { user } = useAuth();
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => { if ("Notification" in window) setPerm(Notification.permission); else setPerm("indisponivel"); }, []);
  const { data, loading, recarregar } = useQuery<any[]>(async () => (await db.from("notificacoes").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100)).data ?? [], [user?.id]);

  async function marcarTodas() { await db.from("notificacoes").update({ lida: true }).eq("user_id", user!.id).eq("lida", false); recarregar(); }
  async function abrir(n: any) { if (!n.lida) { await db.from("notificacoes").update({ lida: true }).eq("id", n.id); recarregar(); } }
  async function apagar(n: any) { await db.from("notificacoes").delete().eq("id", n.id); recarregar(); }
  async function ativarPush() {
    if (!("Notification" in window)) return toast.error("Este navegador não suporta notificações.");
    const p = await Notification.requestPermission(); setPerm(p);
    if (p === "granted") { new Notification("Notificações ativadas", { body: "Você vai receber lembretes enquanto o app estiver aberto." }); toast.success("Notificações ativadas."); }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Avisos" subtitle="Comunicados da equipe, lembretes e novidades." right={<Btn v="outline" onClick={marcarTodas}><CheckCheck className="h-4 w-4" /> Marcar todas como lidas</Btn>} />
      {perm !== "granted" && perm !== "indisponivel" && (
        <Card className="flex flex-wrap items-center gap-3 bg-primary-soft">
          <BellRing className="h-6 w-6 text-primary" />
          <span className="flex-1 text-sm"><b>Ative as notificações</b> para receber lembretes de terapias, consultas e remédios.</span>
          <Btn onClick={ativarPush}>Ativar</Btn>
        </Card>
      )}
      <Link to="/perfil" className="text-sm font-semibold text-primary">Escolher quais avisos receber →</Link>
      {loading ? <Carregando /> : !(data ?? []).length ? <Vazio icon={Bell} titulo="Nenhum aviso por enquanto" texto="Quando a equipe enviar comunicados, eles aparecem aqui." /> : (
        <ul className="flex flex-col gap-2">
          {data!.map((n) => (
            <li key={n.id} className={cn("card-soft flex gap-3 p-4", !n.lida && "border-primary bg-primary-soft/40")} onClick={() => abrir(n)}>
              <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", n.lida ? "bg-transparent" : "bg-coral")} aria-label={n.lida ? undefined : "Não lido"} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><b className="text-navy">{n.titulo}</b>{n.categoria && <Chip>{n.categoria}</Chip>}</div>
                <p className="whitespace-pre-line text-sm">{n.mensagem}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fDataHora(n.created_at)}</p>
                {n.link && (n.link.startsWith("/") ? <Link to={n.link as any} className="text-sm font-semibold text-primary">Abrir</Link> : <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary">Abrir link</a>)}
              </div>
              <button onClick={(e) => { e.stopPropagation(); apagar(n); }} className="tap grid place-items-center self-start text-muted-foreground" aria-label="Apagar aviso"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
