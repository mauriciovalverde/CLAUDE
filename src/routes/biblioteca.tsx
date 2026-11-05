import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, ExternalLink, FileText, Mic, PlayCircle, Scale, Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Carregando, Chip, PageHeader, Vazio, inputCls } from "@/components/app/kit";
import { BIBLIOTECA_PADRAO } from "@/lib/conteudo-padrao";
import { db, useQuery, youtubeEmbed } from "@/lib/dados";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/biblioteca")({ component: () => <AppShell><Biblioteca /></AppShell> });

const TIPOS: [string, string, any][] = [["", "Tudo", BookOpen], ["video", "Vídeos", PlayCircle], ["entrevista", "Entrevistas", Mic], ["cartilha", "Cartilhas", FileText], ["lei", "Leis", Scale], ["link", "Links úteis", ExternalLink]];

function Biblioteca() {
  const [tipo, setTipo] = useState("");
  const [q, setQ] = useState("");
  const [video, setVideo] = useState<string | null>(null);
  const { data, loading } = useQuery<any[]>(async () => {
    const { data } = await db.from("biblioteca").select("*").order("created_at", { ascending: false });
    return data?.length ? data : BIBLIOTECA_PADRAO.map((b: any, i: number) => ({ ...b, id: "p" + i }));
  }, []);

  async function abrir(b: any) {
    const emb = youtubeEmbed(b.url);
    if (emb) return setVideo(emb);
    if (b.arquivo_path) {
      const { data } = await db.storage.from("biblioteca").createSignedUrl(b.arquivo_path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
      return;
    }
    if (b.url) window.open(b.url, "_blank", "noopener");
  }
  const termo = q.trim().toLowerCase();
  const lista = (data ?? []).filter((b) => (!tipo || b.tipo === tipo) && (!termo || `${b.titulo} ${b.descricao ?? ""} ${b.categoria ?? ""}`.toLowerCase().includes(termo)));
  const icone = (t: string) => (TIPOS.find((x) => x[0] === t)?.[2] ?? BookOpen);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Biblioteca" subtitle="Vídeos, cartilhas, leis e materiais confiáveis selecionados pela equipe." />
      <label className="relative">
        <span className="sr-only">Buscar na biblioteca</span>
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input className={cn(inputCls, "pl-12")} placeholder="Buscar por tema" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {TIPOS.map(([k, l]) => <button key={k || "t"} onClick={() => setTipo(k)} className={cn("tap rounded-full border px-4 text-sm font-semibold", tipo === k ? "border-primary bg-primary text-white" : "border-border bg-card text-navy")}>{l}</button>)}
      </div>
      {loading ? <Carregando /> : !lista.length ? <Vazio icon={BookOpen} titulo="Nada encontrado" texto="Tente outra palavra ou outro filtro." /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lista.map((b) => {
            const I = icone(b.tipo);
            return (
              <button key={b.id} onClick={() => abrir(b)} className="card-soft flex gap-3 p-4 text-left transition hover:border-primary">
                <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", b.tipo === "video" || b.tipo === "entrevista" ? "bg-coral-soft text-coral" : "bg-primary-soft text-primary")}><I className="h-6 w-6" /></span>
                <span className="min-w-0">
                  {b.categoria && <Chip className="mb-1">{b.categoria}</Chip>}
                  <b className="block text-navy">{b.titulo}</b>
                  {b.descricao && <span className="text-sm text-muted-foreground">{b.descricao}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {video && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setVideo(null)} role="dialog" aria-modal="true" aria-label="Vídeo">
          <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
            <iframe src={video + "?autoplay=1"} title="Vídeo" className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          </div>
          <button onClick={() => setVideo(null)} className="tap mt-3 rounded-full bg-white px-6 font-semibold">Fechar</button>
        </div>
      )}
    </div>
  );
}
