import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Carregando, Vazio, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { fDataHora } from "@/lib/br";
import { fotoUrl } from "@/lib/classificados";
import { cn } from "@/lib/utils";

type Conversa = { id: string; anuncio_id: string; anuncio_titulo: string; anuncio_foto: string | null; sou_anunciante: boolean; outro_nome: string; ultima_msg: string | null; ultima_em: string; nao_lidas: number };
type Msg = { id: string; autor_id: string; texto: string; created_at: string; lida_em: string | null };

export function ListaConversas({ onAbrir }: { onAbrir: (id: string) => void }) {
  const { data, loading } = useQuery<Conversa[]>(async () => { const { data, error } = await db.rpc("cls_minhas_conversas"); if (error) throw error; return data ?? []; }, []);
  if (loading) return <Carregando />;
  if (!data?.length) return <Vazio icon={MessageCircle} titulo="Nenhuma conversa ainda" texto="Quando você falar com um anunciante, ou alguém responder ao seu anúncio, a conversa aparece aqui." />;
  return (
    <ul className="flex flex-col gap-2">
      {data.map((c) => (
        <li key={c.id}>
          <button onClick={() => onAbrir(c.id)} className={cn("card-soft flex w-full items-center gap-3 p-3 text-left transition hover:border-primary", c.nao_lidas > 0 && "border-primary")}>
            {c.anuncio_foto ? <img src={fotoUrl(c.anuncio_foto)!} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><MessageCircle className="h-5 w-5" /></span>}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2"><b className="truncate text-navy">{c.outro_nome}</b><span className="text-xs text-muted-foreground">{c.sou_anunciante ? "interessada(o)" : "anunciante"}</span></span>
              <span className="block truncate text-xs font-semibold text-primary">{c.anuncio_titulo}</span>
              <span className="block truncate text-sm text-muted-foreground">{c.ultima_msg}</span>
            </span>
            {c.nao_lidas > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-coral px-1.5 text-xs font-bold text-white">{c.nao_lidas}</span>}
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Conversa({ id, onVoltar, onVerAnuncio }: { id: string; onVoltar: () => void; onVerAnuncio: (anuncioId: string) => void }) {
  const { user } = useAuth();
  const [info, setInfo] = useState<Conversa | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  async function carregar() {
    const { data } = await db.from("cls_mensagens").select("id,autor_id,texto,created_at,lida_em").eq("conversa_id", id).order("created_at");
    setMsgs((old) => { if ((data ?? []).length !== old.length) setTimeout(() => fim.current?.scrollIntoView({ block: "end" }), 50); return data ?? []; });
    if ((data ?? []).some((m: Msg) => m.autor_id !== user?.id && !m.lida_em)) db.rpc("cls_marcar_lidas", { _conversa: id });
  }
  useEffect(() => {
    db.rpc("cls_minhas_conversas").then(({ data }: any) => setInfo((data ?? []).find((c: Conversa) => c.id === id) ?? null));
    carregar();
    const t = setInterval(() => { if (document.visibilityState === "visible") carregar(); }, 8000);
    return () => clearInterval(t);
  }, [id]);
  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    const { error } = await db.rpc("cls_enviar", { _conversa: id, _texto: texto });
    setEnviando(false);
    if (error) return toast.error(error.message);
    setTexto(""); carregar();
  }
  if (info === undefined) return <Carregando />;
  if (info === null) return <Vazio icon={MessageCircle} titulo="Conversa não encontrada" texto="Ela não existe ou não é sua."><Btn v="outline" onClick={onVoltar}>Ver conversas</Btn></Vazio>;
  return (
    <div className="flex flex-col gap-3">
      <button onClick={onVoltar} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Conversas</button>
      <Card className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1"><b className="block text-navy">{info.outro_nome}</b><span className="block truncate text-sm text-muted-foreground">{info.anuncio_titulo}</span></div>
        <Btn v="soft" className="min-h-10" onClick={() => onVerAnuncio(info.anuncio_id)}>Ver anúncio</Btn>
      </Card>
      <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-foreground">Por segurança: não envie laudos, documentos ou dados de crianças. Encontros, só em locais públicos. Nunca pague adiantado por vaga de emprego.</p>
      <div className="flex min-h-48 flex-col gap-2" aria-live="polite">
        {msgs.map((m) => {
          const minha = m.autor_id === user?.id;
          return (
            <div key={m.id} className={cn("max-w-[85%] rounded-2xl px-4 py-2", minha ? "self-end rounded-br-md bg-primary text-primary-foreground" : "self-start rounded-bl-md bg-card shadow-card")}>
              <p className="whitespace-pre-line break-words">{m.texto}</p>
              <p className={cn("mt-0.5 text-[11px]", minha ? "text-primary-foreground/80" : "text-muted-foreground")}>{fDataHora(m.created_at)}{minha && m.lida_em ? " · lida" : ""}</p>
            </div>
          );
        })}
        <div ref={fim} />
      </div>
      <div className="sticky bottom-20 flex items-end gap-2 rounded-2xl bg-background/95 py-2 backdrop-blur lg:bottom-2">
        <label htmlFor="cls-resp" className="sr-only">Mensagem</label>
        <textarea id="cls-resp" rows={1} className={cn(textareaCls, "min-h-12 flex-1 resize-none py-3")} maxLength={2000} placeholder="Escreva uma mensagem" value={texto} onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
        <Btn onClick={enviar} disabled={enviando || !texto.trim()} aria-label="Enviar" className="px-4"><Send className="h-5 w-5" /></Btn>
      </div>
    </div>
  );
}
