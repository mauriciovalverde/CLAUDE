import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle, Baby, Bell, BookOpen, CalendarDays, ClipboardList, Clock, FileText, HandHeart, Heart, MapPin,
  LayoutDashboard, MessageCircle, NotebookPen, PlayCircle, Puzzle, Scale, Search, Star, Utensils, Video,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card, Chip, Modal, btn } from "@/components/app/kit";
import { g, generoDe, nomeExibicao, useAuth } from "@/lib/auth";
import { db, useConfig, useQuery } from "@/lib/dados";
import { MSG_CONFIRMACAO_PADRAO, WHATSAPP_PADRAO, fDataHora, waLink } from "@/lib/br";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inicio")({ component: () => <AppShell><Inicio /></AppShell> });

const MENSAGENS = [
  "Você não está só. Cada pequeno passo conta.", "Cuidar de você também é cuidar do seu filho.",
  "Hoje não precisa ser perfeito. Precisa ser possível.", "Pedir ajuda é um ato de coragem.",
  "Você conhece seu filho como ninguém. Confie no seu olhar.", "Respire. Um dia de cada vez.",
  "O amor que você dá todos os dias faz diferença, mesmo quando ninguém vê.",
];
const ATALHOS: [string, string, any, string][] = [
  ["/consultas", "Teleconsulta com psicólogo", Video, "bg-primary text-white"],
  ["/conteudo/orientacoes", "Orientações", BookOpen, "bg-primary-soft text-primary"],
  ["/conteudo/bpc", "Acesso ao BPC", ClipboardList, "bg-warning-soft text-warning"],
  ["/conteudo/alimentacao", "Alimentação", Utensils, "bg-coral-soft text-coral"],
  ["/conteudo/crise", "Momentos de crise", AlertTriangle, "bg-emergency-soft text-emergency"],
  ["/conteudo/direitos", "Direitos", Scale, "bg-primary-soft text-primary"],
  ["/rede", "Rede de apoio", MessageCircle, "bg-success-soft text-success"],
  ["/biblioteca", "Biblioteca", BookOpen, "bg-secondary text-navy"],
  ["/rotina", "Minha rotina", CalendarDays, "bg-primary-soft text-primary"],
  ["/conteudo/atividades", "Atividades em casa", Puzzle, "bg-success-soft text-success"],
  ["/conteudo/acolhimento", "Cuide de você", Heart, "bg-coral-soft text-coral"],
  ["/documentos", "Documentos", FileText, "bg-warning-soft text-warning"],
  ["/historias", "Histórias que inspiram", Star, "bg-secondary text-navy"],
];

function Inicio() {
  const { perfil, user, familia, isStaff } = useAuth();
  const nav = useNavigate();
  const cfg = useConfig();
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState<any | null>(null);
  const gen = generoDe(perfil, familia);
  const msg = MENSAGENS[new Date().getDate() % MENSAGENS.length];

  const { data } = useQuery(async () => {
    const agora = new Date().toISOString();
    const [com, bib, ag, notif, di] = await Promise.all([
      db.from("comunicados").select("id,titulo,mensagem,created_at").eq("enviado", true).eq("destaque", true).order("created_at", { ascending: false }).limit(2),
      db.from("biblioteca").select("id,titulo,tipo,categoria,url,descricao,created_at").order("created_at", { ascending: false }).limit(8),
      familia ? db.from("agenda").select("id,titulo,tipo,inicio").eq("familia_id", familia.id).gte("inicio", agora).order("inicio").limit(1) : { data: [] },
      user ? db.from("notificacoes").select("id,titulo,mensagem,created_at,lida").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3) : { data: [] },
      familia ? db.from("diario_registros").select("id,tipo,ocorrido_em,nota,humor,intensidade").eq("familia_id", familia.id).order("ocorrido_em", { ascending: false }).limit(3) : { data: [] },
    ]);
    return { com: com.data ?? [], bib: bib.data ?? [], ag: ag.data ?? [], notif: notif.data ?? [], di: di.data ?? [] };
  }, [familia?.id, user?.id]);

  const { data: tele } = useQuery(async () => {
    if (!familia) return null;
    const { data } = await db.from("consultas").select("id,inicio,status").eq("familia_id", familia.id).in("status", ["agendada", "confirmada"]).gte("fim", new Date().toISOString()).order("inicio").limit(1);
    return data?.[0] ?? null;
  }, [familia?.id]);
  const videos = (data?.bib ?? []).filter((b: any) => b.tipo === "video" || b.tipo === "entrevista").slice(0, 3);
  const pub = (data?.bib ?? []).slice(0, 3);
  const prox = data?.ag?.[0];

  return (
    <div className="flex flex-col gap-7">
      <section className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground">
        <p className="relative text-xs font-bold uppercase tracking-[0.18em] opacity-90">Informação · Acolhimento · Apoio</p>
        <h1 className="relative mt-2 font-display text-3xl font-extrabold text-white sm:text-4xl">Olá, {nomeExibicao(perfil, user)}!</h1>
        <p className="relative mt-1 opacity-90">Você não está {g(gen, "sozinha", "sozinho", "só")}! Estamos aqui para caminhar com você.</p>
      </section>

      {isStaff && (
        <Link to="/admin" className="card-soft flex items-center gap-4 border-primary p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-white"><LayoutDashboard /></span>
          <span className="flex-1"><b className="block text-navy">Painel administrativo</b><span className="text-sm text-muted-foreground">Cadastros, disparos, relatórios, teleconsultas e exportações</span></span>
          <span className="text-sm font-semibold text-primary">Abrir</span>
        </Link>
      )}

      {familia?.status === "pendente" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-warning-soft p-4 text-sm">
          <Clock className="h-5 w-5 text-warning" />
          <span className="flex-1"><b>Cadastro {familia.numero} aguardando confirmação.</b> Se ainda não enviou, confirme pelo WhatsApp.</span>
          <a href={waLink(cfg.numero_confirmacao || WHATSAPP_PADRAO, cfg.mensagem_confirmacao || MSG_CONFIRMACAO_PADRAO)} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.wa, "min-h-11")}>Confirmar</a>
        </div>
      )}
      {familia?.status === "recusado" && <div className="rounded-2xl bg-emergency-soft p-4 text-sm"><b>Cadastro não confirmado.</b> {familia.motivo_recusa}</div>}
      {!familia && <Card className="flex flex-wrap items-center gap-3"><Baby className="h-6 w-6 text-primary" /><span className="flex-1">Complete o cadastro da sua família para usar o diário e a rotina.</span><Link to="/completar-cadastro" className={cn(btn.base, btn.primary)}>Completar cadastro</Link></Card>}

      {(data?.com ?? []).map((c: any) => (
        <button key={c.id} onClick={() => setAberto(c)} className="card-soft flex items-start gap-3 border-primary p-4 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Bell className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><b className="block text-navy">{c.titulo}</b><span className="line-clamp-2 text-sm text-muted-foreground">{c.mensagem}</span></span>
          <span className="text-sm font-semibold text-primary">Ler</span>
        </button>
      ))}
      {aberto && (
        <Modal titulo="Aviso do Centro" onFechar={() => setAberto(null)}>
          <h2 className="font-display text-2xl font-extrabold">{aberto.titulo}</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed">{aberto.mensagem}</p>
          <p className="mt-3 text-xs text-muted-foreground">{fDataHora(aberto.created_at)}</p>
        </Modal>
      )}

      {tele && (
        <Link to="/consultas" className="card-soft flex items-center gap-4 border-primary p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-white"><Video /></span>
          <span className="flex-1"><b className="block text-navy">Sua teleconsulta</b><span className="text-sm text-muted-foreground">{fDataHora(tele.inicio)}</span></span>
          <span className="text-sm font-semibold text-primary">Abrir</span>
        </Link>
      )}

      <form onSubmit={(e) => { e.preventDefault(); nav({ to: "/buscar", search: { q } as any }); }} role="search" className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-5 shadow-card">
        <label htmlFor="busca" className="sr-only">Buscar especialistas</label>
        <input id="busca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar especialistas perto de você" className="min-h-12 min-w-0 flex-1 bg-transparent outline-none" />
        <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
        <button className="grid h-12 w-12 place-items-center rounded-full bg-primary text-white" aria-label="Buscar"><Search className="h-5 w-5" /></button>
      </form>

      <nav aria-label="Atalhos" className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {ATALHOS.map(([to, l, I, c]) => (
          <Link key={to} to={to as any} className="card-soft flex min-h-28 flex-col items-start gap-2 p-3 transition hover:border-primary">
            <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", c)}><I className="h-5 w-5" /></span>
            <span className="font-display text-sm font-bold leading-tight text-navy">{l}</span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Diário de hoje</h2><Link to="/diario" className="text-sm font-semibold text-primary">Abrir</Link></div>
          {(data?.di ?? []).length ? (data!.di).map((r: any) => (
            <p key={r.id} className="text-sm"><b className="">{r.tipo}</b> · {fDataHora(r.ocorrido_em)}{r.nota ? ` · ${r.nota}` : ""}</p>
          )) : <p className="text-sm text-muted-foreground">Nenhum registro ainda. Anote crises, sono, alimentação e conquistas.</p>}
          <Link to="/diario" className={cn(btn.base, btn.soft, "self-start")}><NotebookPen className="h-4 w-4" /> Registrar agora</Link>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">Próximo compromisso</h2>
          {prox ? <p><b>{prox.titulo}</b><br /><span className="text-sm text-muted-foreground">{prox.tipo} · {fDataHora(prox.inicio)}</span></p> : <p className="text-sm text-muted-foreground">Nada agendado.</p>}
          <Link to="/rotina" className={cn(btn.base, btn.outline, "self-start")}><CalendarDays className="h-4 w-4" /> Minha rotina</Link>
        </Card>
      </div>

      <section className="flex flex-col gap-3 rounded-3xl bg-success-soft p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-success text-white"><MessageCircle /></span>
          <div><h2 className="font-display text-xl font-bold">Você precisa de apoio?</h2><p>Nossa rede de mães está aqui para acolher você.</p></div>
        </div>
        <Link to="/rede" className={cn(btn.base, btn.wa, "self-start")}>Acessar rede de apoio →</Link>
      </section>

      <section className="rounded-3xl bg-coral-soft p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-coral">Mensagem do dia</p>
        <p className="mt-2 font-display text-xl font-bold text-navy">{msg}</p>
        <Link to="/conteudo/$slug" params={{ slug: "acolhimento" }} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary"><HandHeart className="h-4 w-4" /> {gen === "n" ? "Você" : g(gen, "Mãe, você", "Pai, você")} também importa</Link>
      </section>

      {(data?.notif ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Avisos</h2><Link to="/avisos" className="text-sm font-semibold text-primary">Ver todos</Link></div>
          {data!.notif.map((n: any) => <Card key={n.id} className="p-4"><b>{n.titulo}</b><p className="text-sm text-muted-foreground">{n.mensagem}</p></Card>)}
        </section>
      )}

      {videos.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Vídeos recomendados</h2><Link to="/biblioteca" className="text-sm font-semibold text-primary">Biblioteca</Link></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {videos.map((v: any) => (
              <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" className="card-soft flex items-center gap-3 p-3">
                <span className="grid aspect-video w-24 shrink-0 place-items-center rounded-xl bg-primary text-white"><PlayCircle /></span>
                <span className="text-sm font-semibold text-navy">{v.titulo}</span>
              </a>
            ))}
          </div>
        </section>
      )}
      {pub.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold">Últimas publicações</h2>
          {pub.map((b: any) => (
            <a key={b.id} href={b.url ?? "#"} target="_blank" rel="noopener noreferrer" className="card-soft flex flex-col gap-1 p-4">
              <span className="text-xs font-bold uppercase text-primary">{b.categoria}</span><b className="text-navy">{b.titulo}</b><span className="text-sm text-muted-foreground">{b.descricao}</span>
            </a>
          ))}
        </section>
      )}
    </div>
  );
}
