import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle, Bell, BookOpen, CalendarDays, ClipboardList, FileText, HandHeart, Home, LayoutDashboard,
  LogOut, MessageCircle, NotebookPen, Search, ShieldCheck, Star, Stethoscope, User, Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Btn, Logo, Modal } from "./kit";
import { ocorrencias, type Ev } from "@/lib/agenda";

const db = supabase as any;

const TABS = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/buscar", label: "Buscar", icon: Search },
  { to: "/diario", label: "Diário", icon: NotebookPen },
  { to: "/apoio", label: "Apoio", icon: HandHeart },
  { to: "/perfil", label: "Perfil", icon: User },
];
const EXTRAS = [
  { to: "/consultas", label: "Teleconsulta", icon: Video },
  { to: "/conteudo/orientacoes", label: "Orientações", icon: BookOpen },
  { to: "/conteudo/bpc", label: "Acesso ao BPC", icon: ClipboardList },
  { to: "/conteudo/direitos", label: "Direitos", icon: ShieldCheck },
  { to: "/biblioteca", label: "Biblioteca", icon: BookOpen },
  { to: "/rotina", label: "Minha rotina", icon: CalendarDays },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/rede", label: "Rede de apoio", icon: MessageCircle },
  { to: "/historias", label: "Histórias", icon: Star },
];

function useFontScale() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const v = Number(localStorage.getItem("fontscale") || 0);
    setN(v); document.documentElement.dataset.fontscale = String(v);
  }, []);
  const ciclo = () => {
    const v = (n + 1) % 3; setN(v);
    document.documentElement.dataset.fontscale = String(v);
    try { localStorage.setItem("fontscale", String(v)); } catch {}
  };
  return { n, ciclo };
}

function useNaoLidas(uid?: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    const ler = async () => {
      const { count } = await db.from("notificacoes").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("lida", false);
      if (vivo) setN(count ?? 0);
    };
    ler();
    const t = setInterval(ler, 60000);
    const ch = supabase.channel("notif-" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${uid}` }, (ev: any) => {
        ler();
        // Aviso novo chega como notificação do sistema (push local) quando a mãe permitiu.
        if (ev.eventType === "INSERT" && ev.new) {
          try { if ("Notification" in window && Notification.permission === "granted") new Notification(ev.new.titulo, { body: ev.new.mensagem, icon: String(import.meta.env.BASE_URL || "/") + "icon-192.png" }); } catch {}
          import("sonner").then(({ toast }) => toast(ev.new.titulo, { description: ev.new.mensagem }));
        }
      })
      .subscribe();
    window.addEventListener("focus", ler);
    return () => { vivo = false; clearInterval(t); window.removeEventListener("focus", ler); supabase.removeChannel(ch); };
  }, [uid]);
  return n;
}

// Lembretes da agenda: dispara notificação do navegador enquanto o app está aberto.
function useLembretes(familiaId?: string) {
  useEffect(() => {
    if (!familiaId) return;
    const checar = async () => {
      const agora = Date.now();
      const { data } = await db.from("agenda").select("*").eq("familia_id", familiaId).lte("inicio", new Date(agora + 2 * 864e5).toISOString());
      const de = new Date(agora - 864e5), ate = new Date(agora + 2 * 864e5);
      for (const a of (data ?? []) as Ev[]) {
        if (a.lembrete_min == null) continue;
        for (const quando of ocorrencias(a, de, ate)) {
          const dispara = quando.getTime() - a.lembrete_min * 60000;
          const chave = "lemb:" + a.id + ":" + quando.toISOString();
          let visto = true;
          try { visto = !!localStorage.getItem(chave); } catch {}
          if (dispara <= agora && agora - dispara < 6 * 3600e3 && !visto) {
            try { localStorage.setItem(chave, "1"); } catch {}
            const corpo = `${a.titulo} · ${quando.toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`;
            try { if ("Notification" in window && Notification.permission === "granted") new Notification("Lembrete", { body: corpo }); } catch {}
            const { toast } = await import("sonner");
            toast("Lembrete: " + a.titulo, { description: corpo });
          }
        }
      }
    };
    checar();
    const t = setInterval(checar, 60000);
    return () => clearInterval(t);
  }, [familiaId]);
}

/** Comunicado novo da equipe aparece em janela ao abrir o app; fechar marca como lido. */
function AvisoPopup({ uid }: { uid?: string }) {
  const [n, setN] = useState<{ id: string; titulo: string; mensagem: string; created_at: string } | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navegar = useNavigate();
  useEffect(() => {
    if (!uid || path === "/avisos") return;
    db.from("notificacoes").select("id,titulo,mensagem,created_at").eq("user_id", uid).eq("lida", false).eq("categoria", "comunicados")
      .order("created_at", { ascending: false }).limit(1).then(({ data }: any) => setN(data?.[0] ?? null));
  }, [uid, path]);
  if (!n) return null;
  const fechar = async () => { const id = n.id; setN(null); await db.from("notificacoes").update({ lida: true }).eq("id", id); };
  return (
    <Modal titulo={<span className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Aviso do Centro</span>} onFechar={fechar}>
      <h2 className="font-display text-2xl font-extrabold">{n.titulo}</h2>
      <p className="mt-2 whitespace-pre-line leading-relaxed">{n.mensagem}</p>
      <p className="mt-3 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Btn onClick={fechar}>Entendi</Btn>
        <Btn v="ghost" onClick={async () => { await fechar(); navegar({ to: "/avisos" }); }}>Ver todos os avisos</Btn>
      </div>
    </Modal>
  );
}

export function TopBar({ publico = false }: { publico?: boolean }) {
  const { user, isStaff } = useAuth();
  const fs = useFontScale();
  const naoLidas = useNaoLidas(user?.id);
  return (
    <header className="no-print sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link to={user ? "/inicio" : "/"} aria-label="Página inicial" className="lg:hidden"><Logo compact={!publico} /></Link>
        {publico && <span className="hidden lg:block"><Link to="/"><Logo /></Link></span>}
        <span className="flex-1" />
        {isStaff && <Link to="/admin" className="tap inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground" aria-label="Painel administrativo"><LayoutDashboard className="h-5 w-5" /><span className="hidden sm:inline">Admin</span></Link>}
        <button onClick={fs.ciclo} className="tap grid min-w-12 place-items-center rounded-xl border border-border bg-card px-2 text-sm font-bold text-navy" aria-label="Aumentar tamanho do texto">
          {fs.n === 0 ? "A+" : fs.n === 1 ? "A++" : "A"}
        </button>
        {user && (
          <Link to="/avisos" className="tap relative grid min-w-12 place-items-center rounded-xl border border-border bg-card" aria-label={`Avisos${naoLidas ? `, ${naoLidas} não lidos` : ""}`}>
            <Bell className="h-5 w-5 text-navy" />
            {naoLidas > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white">{naoLidas}</span>}
          </Link>
        )}
        <Link to="/sos" className="tap inline-flex items-center gap-1.5 rounded-full bg-emergency px-4 font-bold text-emergency-foreground" aria-label="Preciso de ajuda agora">
          <AlertTriangle className="h-5 w-5" /> SOS
        </Link>
        {!user && <Link to="/entrar" className="tap inline-flex items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground">Entrar</Link>}
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, user, familia, isStaff, papeis, sair } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useLembretes(familia?.id);

  useEffect(() => {
    if (!ready) return;
    if (!user) { nav({ to: "/entrar", search: { volta: path } as any }); return; }
    const ehProf = papeis.includes("profissional");
    // Só as telas que dependem do cadastro da família redirecionam. Cuidadores convidados usam o diário sem família própria.
    const exigeFamilia = ["/inicio", "/rotina", "/documentos"].includes(path);
    if (!familia && !isStaff && !ehProf && exigeFamilia) {
      db.from("diario_compartilhamentos").select("id").eq("ativo", true).limit(1).then(({ data }: any) => {
        nav({ to: data?.length ? "/diario" : "/completar-cadastro" });
      });
    }
  }, [ready, user, familia, isStaff, papeis, path, nav]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Logo /></div>;
  }
  const ativo = (to: string) => path === to || (to !== "/inicio" && path.startsWith(to));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col gap-1 overflow-y-auto border-r border-border bg-sidebar p-4 lg:flex">
        <Link to="/inicio" className="mb-4 px-2 py-1"><Logo /></Link>
        {TABS.map((t) => (
          <Link key={t.to} to={t.to as any} className={cn("tap flex items-center gap-3 rounded-xl px-3 font-semibold", ativo(t.to) ? "bg-primary-soft text-primary" : "text-navy hover:bg-muted")}>
            <t.icon className="h-5 w-5" /> {t.label}
          </Link>
        ))}
        <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Conteúdos</p>
        {EXTRAS.map((t) => (
          <Link key={t.to} to={t.to as any} className={cn("flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold", ativo(t.to) ? "bg-primary-soft text-primary" : "text-navy hover:bg-muted")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </Link>
        ))}
        {papeis.includes("profissional") && (
          <Link to="/atendimentos" className={cn("tap mt-3 flex items-center gap-3 rounded-xl px-3 font-semibold", ativo("/atendimentos") ? "bg-primary-soft text-primary" : "text-navy hover:bg-muted")}>
            <Stethoscope className="h-5 w-5" /> Meus atendimentos
          </Link>
        )}
        {isStaff && (
          <Link to="/admin" className={cn("tap mt-3 flex items-center gap-3 rounded-xl px-3 font-semibold", ativo("/admin") ? "bg-primary-soft text-primary" : "text-navy hover:bg-muted")}>
            <LayoutDashboard className="h-5 w-5" /> Painel administrativo
          </Link>
        )}
        <span className="flex-1" />
        <Link to="/sos" className="tap mt-4 flex items-center justify-center gap-2 rounded-full bg-emergency px-4 font-bold text-emergency-foreground">
          <AlertTriangle className="h-5 w-5" /> PRECISO DE AJUDA AGORA
        </Link>
        <button onClick={async () => { await sair(); nav({ to: "/" }); }} className="mt-2 flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </aside>
      <div className="min-w-0">
        <TopBar />
        <AvisoPopup uid={user.id} />
        <main id="conteudo" className="mx-auto max-w-4xl px-4 pb-28 pt-5 lg:pb-12">{children}</main>
        <footer className="no-print mx-auto max-w-4xl px-4 pb-28 text-center text-xs text-muted-foreground lg:pb-8">
          Este aplicativo oferece informação e apoio e não substitui atendimento médico, psicológico ou de emergência.
          Em risco imediato ligue 192 (SAMU), 193 (Bombeiros) ou 190 (Polícia). ·{" "}
          <Link to="/privacidade" className="underline">Privacidade</Link> · <Link to="/termos" className="underline">Termos</Link>
        </footer>
      </div>
      <nav className={cn("no-print fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-card lg:hidden", isStaff ? "grid-cols-6" : "grid-cols-5")} style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Navegação principal">
        {TABS.map((t) => (
          <Link key={t.to} to={t.to as any} className={cn("flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", ativo(t.to) ? "text-primary" : "text-muted-foreground")} aria-current={ativo(t.to) ? "page" : undefined}>
            <t.icon className={cn("h-6 w-6", ativo(t.to) && "stroke-[2.4]")} /> {t.label}
          </Link>
        ))}
        {isStaff && (
          <Link to="/admin" className={cn("flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", ativo("/admin") ? "text-primary" : "text-muted-foreground")} aria-current={ativo("/admin") ? "page" : undefined}>
            <LayoutDashboard className={cn("h-6 w-6", ativo("/admin") && "stroke-[2.4]")} /> Admin
          </Link>
        )}
      </nav>
    </div>
  );
}
