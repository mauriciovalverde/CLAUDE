import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, ExternalLink, Phone, PlayCircle, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Card, Carregando, PageHeader, Vazio, btn } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { carregarSecao, db, registrarAcesso, separarCategoria, useQuery, youtubeEmbed, type Topico } from "@/lib/dados";
import { cn } from "@/lib/utils";
import { Texto } from "@/components/app/Texto";

export const Route = createFileRoute("/conteudo/$slug")({ component: () => <AppShell><Conteudo /></AppShell> });

const CHECK_BPC = [
  "Documento com foto e CPF da criança e do responsável", "Certidão de nascimento", "Comprovante de residência",
  "CadÚnico atualizado (últimos 24 meses)", "Laudo médico com CID, data e assinatura", "Relatórios de terapias e da escola",
  "Receitas e comprovantes de gastos com saúde", "Login no Meu INSS (gov.br)",
];

function Conteudo() {
  const { slug } = Route.useParams();
  const { data, loading } = useQuery(() => carregarSecao(slug), [slug]);
  const [cat, setCat] = useState<string>("");
  const [aberto, setAberto] = useState<Topico | null>(null);
  useEffect(() => { registrarAcesso(slug); setCat(""); setAberto(null); }, [slug]);

  const cats = useMemo(() => [...new Set((data?.topicos ?? []).map((t) => separarCategoria(t.titulo).cat).filter(Boolean))] as string[], [data]);
  if (loading) return <Carregando />;
  if (!data) return <Vazio icon={BookOpen} titulo="Conteúdo não encontrado" />;
  const lista = data.topicos.filter((t) => !cat || separarCategoria(t.titulo).cat === cat);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={data.secao.titulo} subtitle={data.secao.descricao ?? undefined} back={{ to: "/inicio", label: "Início" }} />
      {slug === "bpc" && <AtalhosBPC />}
      {cats.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categorias">
          {["", ...cats].map((c) => (
            <button key={c || "todas"} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={cn("tap rounded-full border px-4 text-sm font-semibold", cat === c ? "border-primary bg-primary text-white" : "border-border bg-card text-navy")}>{c || "Todas"}</button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {lista.map((t) => {
          const { titulo } = separarCategoria(t.titulo);
          return (
            <button key={t.id} onClick={() => setAberto(t)} className="card-soft tap flex items-center gap-3 p-4 text-left transition hover:border-primary">
              {t.video_url ? <PlayCircle className="h-6 w-6 shrink-0 text-coral" aria-label="Tem vídeo" /> : <BookOpen className="h-6 w-6 shrink-0 text-primary" />}
              <span className="flex-1 font-display font-bold text-navy">{titulo}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          );
        })}
      </div>
      {data.secao.aviso && <Aviso tom="amber">{data.secao.aviso}</Aviso>}
      {slug === "bpc" && <ChecklistBPC />}
      {aberto && <Painel t={aberto} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function Painel({ t, onFechar }: { t: Topico; onFechar: () => void }) {
  const { cat, titulo } = separarCategoria(t.titulo);
  const emb = youtubeEmbed(t.video_url);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onFechar]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onFechar} role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-card p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-3">
          <div className="flex-1">{cat && <p className="text-xs font-bold uppercase tracking-widest text-primary">{cat}</p>}<h2 className="font-display text-2xl font-extrabold">{titulo}</h2></div>
          <button onClick={onFechar} className="tap grid place-items-center rounded-full bg-muted" aria-label="Fechar"><X /></button>
        </div>
        {emb ? (
          <div className="mb-4 aspect-video overflow-hidden rounded-2xl bg-black"><iframe src={emb} title={titulo} className="h-full w-full" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen /></div>
        ) : t.video_url ? (
          <a href={t.video_url} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.soft, "mb-4")}><PlayCircle className="h-5 w-5" /> Assistir ao vídeo</a>
        ) : null}
        <Texto texto={t.conteudo} />
        {(t.fontes ?? []).length > 0 && (
          <div className="mt-5 border-t pt-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Fontes oficiais</p>
            <ul className="flex flex-col gap-1">{t.fontes.map((f) => <li key={f.url}><a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline">{f.nome} <ExternalLink className="h-3.5 w-3.5" /></a></li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

function AtalhosBPC() {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <a href="https://meu.inss.gov.br" target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.primary)}><ExternalLink className="h-4 w-4" /> Abrir Meu INSS</a>
      <a href="tel:135" className={cn(btn.base, btn.outline)}><Phone className="h-4 w-4" /> Ligar 135 (INSS)</a>
      <a href="https://www.gov.br/mds/pt-br/acoes-e-programas/cadastro-unico" target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.outline)}><ExternalLink className="h-4 w-4" /> CadÚnico</a>
    </div>
  );
}

function ChecklistBPC() {
  const { user } = useAuth();
  const [m, setM] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!user) return;
    db.from("checklists").select("item,marcado").eq("user_id", user.id).eq("lista", "bpc").then(({ data }: any) => {
      setM(Object.fromEntries((data ?? []).map((r: any) => [r.item, r.marcado])));
    });
  }, [user]);
  async function marcar(item: string, v: boolean) {
    setM((x) => ({ ...x, [item]: v }));
    await db.from("checklists").upsert({ user_id: user!.id, lista: "bpc", item, marcado: v, updated_at: new Date().toISOString() }, { onConflict: "user_id,lista,item" });
  }
  const feitos = CHECK_BPC.filter((i) => m[i]).length;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Meu checklist do BPC</h2><span className="text-sm font-bold text-primary">{feitos}/{CHECK_BPC.length}</span></div>
      <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-success transition-all" style={{ width: `${(feitos / CHECK_BPC.length) * 100}%` }} /></div>
      <ul className="flex flex-col gap-1">
        {CHECK_BPC.map((i) => (
          <li key={i}><label className="tap flex items-center gap-3 rounded-xl px-2 hover:bg-muted"><input type="checkbox" className="h-5 w-5 accent-[var(--color-success)]" checked={!!m[i]} onChange={(e) => marcar(i, e.target.checked)} /><span className={cn(m[i] && "text-muted-foreground line-through")}>{i}</span></label></li>
        ))}
      </ul>
    </Card>
  );
}
