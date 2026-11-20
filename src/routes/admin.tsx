import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, CalendarHeart, Scale, Video, ClipboardCheck, FileClock, LayoutDashboard, MapPin, Megaphone, Settings, Star, Users } from "lucide-react";
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
import { Usuarios, Configuracoes, Logs, Lgpd } from "@/components/admin/Sistema";
import { OuvidoriaAdmin } from "@/components/admin/Ouvidoria";
import { DesafioDuasEtapas, DuasEtapas, precisaSegundaEtapa } from "@/components/admin/DuasEtapas";
import { Teleconsultas } from "@/components/admin/Teleconsultas";

const ABAS = [
  { k: "painel", l: "Painel", I: LayoutDashboard, admin: false },
  { k: "cadastros", l: "Cadastros", I: ClipboardCheck, admin: false },
  { k: "comunicados", l: "Disparos", I: Megaphone, admin: false },
  { k: "teleconsultas", l: "Teleconsultas", I: Video, admin: false },
  { k: "ouvidoria", l: "Ouvidoria", I: Megaphone, admin: false },
  { k: "diretorio", l: "Diretório", I: MapPin, admin: false },
  { k: "historias", l: "Histórias", I: Star, admin: false },
  { k: "encontros", l: "Encontros", I: CalendarHeart, admin: true },
  { k: "conteudos", l: "Conteúdos", I: BookOpen, admin: true },
  { k: "usuarios", l: "Usuários", I: Users, admin: true },
  { k: "lgpd", l: "LGPD", I: Scale, admin: true },
  { k: "config", l: "Configurações", I: Settings, admin: true },
  { k: "logs", l: "Logs", I: FileClock, admin: true },
] as const;

export const Route = createFileRoute("/admin")({
  validateSearch: (s: Record<string, unknown>) => ({ aba: typeof s.aba === "string" ? s.aba : undefined }) as { aba?: string },
  component: () => <AppShell><Admin /></AppShell>,
});

function Admin() {
  const { ready, isStaff, isAdmin, sair } = useAuth();
  const [mfa, setMfa] = useState<boolean | null>(null);
  useEffect(() => { if (isAdmin) precisaSegundaEtapa().then(setMfa); else setMfa(false); }, [isAdmin]);
  const { aba = "painel" } = Route.useSearch();
  const nav = useNavigate();
  useEffect(() => { if (isStaff) db.rpc("processar_agendados").then(() => {}); }, [isStaff]);
  useEffect(() => { if (ready && !isStaff) { db.rpc("registrar_tentativa_negada", { _recurso: "painel_admin" }).then(() => {}); nav({ to: "/inicio" }); } }, [ready, isStaff, nav]);
  if (!ready) return <Carregando />;
  if (!isStaff) return <Vazio icon={LayoutDashboard} titulo="Acesso restrito" texto="Esta área é só para a equipe do AMPARO." />;
  if (mfa === null) return <Carregando />;
  if (mfa) return <DesafioDuasEtapas onOk={() => setMfa(false)} onSair={sair} />;
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
      {atual === "lgpd" && <Lgpd />}
      {atual === "ouvidoria" && <OuvidoriaAdmin />}
      {atual === "config" && <><DuasEtapas /><Configuracoes /></>}
      {atual === "logs" && <Logs />}
    </div>
  );
}
