import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BookOpen, CalendarHeart, Video, ClipboardCheck, FileClock, LayoutDashboard, MapPin, Megaphone, Settings, Star, Users } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Carregando, PageHeader, Vazio } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/dados";
import { cn } from "@/lib/utils";
import { Painel } from "@/components/admin/Painel";
import { Cadastros } from "@/components/admin/Cadastros";
import { Comunicados } from "@/components/admin/Comunicados";
import { Conteudos } from "@/components/admin/Conteudos";
import { DiretorioAdmin } from "@/components/admin/DiretorioAdmin";
import { HistoriasAdmin, EncontrosAdmin } from "@/components/admin/Moderacao";
import { Usuarios, Configuracoes, Logs } from "@/components/admin/Sistema";
import { Teleconsultas } from "@/components/admin/Teleconsultas";

const ABAS = [
  { k: "painel", l: "Painel", I: LayoutDashboard, admin: false },
  { k: "cadastros", l: "Cadastros", I: ClipboardCheck, admin: false },
  { k: "comunicados", l: "Disparos", I: Megaphone, admin: false },
  { k: "teleconsultas", l: "Teleconsultas", I: Video, admin: false },
  { k: "diretorio", l: "Diretório", I: MapPin, admin: false },
  { k: "historias", l: "Histórias", I: Star, admin: false },
  { k: "encontros", l: "Encontros", I: CalendarHeart, admin: true },
  { k: "conteudos", l: "Conteúdos", I: BookOpen, admin: true },
  { k: "usuarios", l: "Usuários", I: Users, admin: true },
  { k: "config", l: "Configurações", I: Settings, admin: true },
  { k: "logs", l: "Logs", I: FileClock, admin: true },
] as const;

export const Route = createFileRoute("/admin")({
  validateSearch: (s: Record<string, unknown>) => ({ aba: typeof s.aba === "string" ? s.aba : undefined }) as { aba?: string },
  component: () => <AppShell><Admin /></AppShell>,
});

function Admin() {
  const { ready, isStaff, isAdmin } = useAuth();
  const { aba = "painel" } = Route.useSearch();
  const nav = useNavigate();
  useEffect(() => { if (isStaff) db.rpc("processar_agendados").then(() => {}); }, [isStaff]);
  useEffect(() => { if (ready && !isStaff) nav({ to: "/inicio" }); }, [ready, isStaff, nav]);
  if (!ready) return <Carregando />;
  if (!isStaff) return <Vazio icon={LayoutDashboard} titulo="Acesso restrito" texto="Esta área é só para a equipe do Centro." />;
  const abas = ABAS.filter((a) => isAdmin || !a.admin);
  const atual = abas.find((a) => a.k === aba)?.k ?? "painel";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Painel" highlight="administrativo" subtitle={isAdmin ? "Acesso total de administração." : "Acesso da equipe: cadastros, disparos, diretório e histórias."} />
      <nav aria-label="Seções do painel" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {abas.map(({ k, l, I }) => (
          <Link key={k} to="/admin" search={{ aba: k }} className={cn("tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", atual === k ? "border-primary bg-primary text-white" : "border-border bg-card text-navy")}>
            <I className="h-4 w-4" /> {l}
          </Link>
        ))}
      </nav>
      {atual === "painel" && <Painel />}
      {atual === "cadastros" && <Cadastros />}
      {atual === "comunicados" && <Comunicados />}
      {atual === "teleconsultas" && <Teleconsultas />}
      {atual === "diretorio" && <DiretorioAdmin />}
      {atual === "historias" && <HistoriasAdmin />}
      {atual === "encontros" && <EncontrosAdmin />}
      {atual === "conteudos" && <Conteudos />}
      {atual === "usuarios" && <Usuarios />}
      {atual === "config" && <Configuracoes />}
      {atual === "logs" && <Logs />}
    </div>
  );
}
