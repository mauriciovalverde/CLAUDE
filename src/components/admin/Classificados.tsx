import { useState } from "react";
import { BadgeCheck, CheckCircle2, Flag, PauseCircle, Star, Store, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Carregando, Chip, Vazio, textareaCls } from "@/components/app/kit";
import { db, useQuery } from "@/lib/dados";
import { fData, fDataHora, fmtTel } from "@/lib/br";
import { type Anuncio, STATUS_CLS, cat, fotoUrl, localTxt, precoTxt, vencido } from "@/lib/classificados";
import { cn } from "@/lib/utils";

const FILTROS: [string, string][] = [["pendente", "Para analisar"], ["denunciados", "Denunciados"], ["aprovado", "Publicados"], ["suspenso", "Suspensos"], ["rejeitado", "Não aprovados"], ["encerrado", "Encerrados"]];
type Den = { id: string; anuncio_id: string; motivo: string; resolvida: boolean; created_at: string };

/** Moderação dos Classificados: aprovar, recusar, suspender, destacar parceiros e marcar registro como verificado. */
export function ClassificadosAdmin() {
  const [f, setF] = useState("pendente");
  const { data, loading, recarregar } = useQuery(async () => {
    const [a, d] = await Promise.all([
      db.from("cls_anuncios").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("cls_denuncias").select("*").order("created_at", { ascending: false }),
    ]);
    const anuncios = (a.data ?? []) as Anuncio[];
    const ids = Array.from(new Set(anuncios.map((x) => x.user_id)));
    const { data: n } = ids.length ? await db.rpc("cls_anunciantes", { _ids: ids }) : { data: [] };
    return { anuncios, den: (d.data ?? []) as Den[], nomes: Object.fromEntries((n ?? []).map((x: any) => [x.id, x.nome])) as Record<string, string> };
  }, []);
  if (loading || !data) return <Carregando />;
  const abertas = (id: string) => data.den.filter((d) => d.anuncio_id === id && !d.resolvida);
  const conta = (k: string) => k === "denunciados" ? data.anuncios.filter((a) => abertas(a.id).length).length : data.anuncios.filter((a) => a.status === k).length;
  const lista = f === "denunciados" ? data.anuncios.filter((a) => abertas(a.id).length) : data.anuncios.filter((a) => a.status === f);
  const pub = data.anuncios.filter((a) => a.status === "aprovado" && !vencido(a));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Publicados agora", pub.length], ["Para analisar", conta("pendente")], ["Denunciados", conta("denunciados")], ["Cupons usados", data.anuncios.reduce((t, a) => t + (a.cupom_usos || 0), 0)]].map(([l, v]) => (
          <Card key={l as string} className="p-4"><p className="text-xs font-semibold text-muted-foreground">{l}</p><p className="font-display text-2xl font-extrabold text-navy">{v}</p></Card>
        ))}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTROS.map(([k, l]) => (
          <button key={k} onClick={() => setF(k)} className={cn("tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", f === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>
            {l} <span className="rounded-full bg-muted px-1.5 text-xs">{conta(k)}</span>
          </button>
        ))}
      </div>
      {!lista.length ? <Vazio icon={Store} titulo="Nada por aqui" texto={f === "pendente" ? "Nenhum anúncio aguardando análise." : undefined} />
        : lista.map((a) => <Item key={a.id} a={a} nome={data.nomes[a.user_id]} den={data.den.filter((d) => d.anuncio_id === a.id)} onFeito={recarregar} />)}
    </div>
  );
}

function Item({ a, nome, den, onFeito }: { a: Anuncio; nome?: string; den: Den[]; onFeito: () => void }) {
  const [motivo, setMotivo] = useState<null | "rejeitar" | "suspender">(null);
  const [txt, setTxt] = useState("");
  const C = cat(a.categoria);
  const [st, tom] = STATUS_CLS[a.status] ?? [a.status, "navy"];
  async function acao(k: string, m?: string) {
    const { error } = await db.rpc("cls_moderar", { _id: a.id, _acao: k, _motivo: m ?? null });
    if (error) return toast.error(error.message);
    toast.success({ aprovar: "Anúncio publicado.", rejeitar: "Anúncio recusado. O anunciante foi avisado.", suspender: "Anúncio suspenso.", destacar: "Destacado como parceiro.", tirar_destaque: "Destaque removido.", verificar: "Marcado como verificado.", tirar_verificacao: "Verificação removida." }[k] ?? "Feito.");
    setMotivo(null); setTxt(""); onFeito();
  }
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tom={tom}>{st}</Chip><Chip tom="blue"><C.I className="h-3.5 w-3.5" /> {C.curto}{a.subcategoria ? ` · ${a.subcategoria}` : ""}</Chip>
        {a.destaque && <Chip tom="amber">Parceiro</Chip>}{a.verificado && <Chip tom="green">Verificado</Chip>}
        <span className="text-xs text-muted-foreground">por {nome ?? "—"} · {fDataHora(a.created_at)} · até {fData(a.validade + "T12:00")}</span>
      </div>
      <div className="flex gap-3">
        {a.fotos.length > 0 && <div className="flex shrink-0 flex-col gap-1">{a.fotos.slice(0, 3).map((p) => <a key={p} href={fotoUrl(p)!} target="_blank" rel="noopener noreferrer"><img src={fotoUrl(p)!} alt="" className="h-16 w-16 rounded-lg object-cover" /></a>)}</div>}
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-display text-lg font-bold">{a.titulo}</h3>
          <p className="whitespace-pre-line text-sm">{a.descricao}</p>
          <p className="text-sm text-muted-foreground">{localTxt(a)} · {precoTxt(a) ?? "sem valor"}{a.estabelecimento ? ` · ${a.estabelecimento}` : ""}</p>
          {a.registro_prof && <p className="text-sm"><b>Registro informado:</b> {a.registro_prof} <span className="text-muted-foreground">(confira no site do conselho antes de verificar)</span></p>}
          {a.condicoes.length > 0 && <p className="text-sm">{a.condicoes.join(" · ")}</p>}
          <p className="text-sm text-muted-foreground">Contato: {[a.contato_chat && "chat do app", a.whatsapp && `WhatsApp ${fmtTel(a.whatsapp)}`].filter(Boolean).join(" e ")}</p>
          {a.categoria === "cupom" && <p className="text-sm">Cupom: {a.cupom_usos} uso(s){a.cupom_limite ? ` de ${a.cupom_limite}` : ""}{a.cupom_regras ? ` · ${a.cupom_regras}` : ""}</p>}
          {a.motivo && <p className="text-sm text-emergency">Motivo registrado: {a.motivo}</p>}
        </div>
      </div>
      {den.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl bg-emergency-soft p-3 text-sm">
          <b className="flex items-center gap-1 text-emergency"><Flag className="h-4 w-4" /> {den.length} denúncia(s)</b>
          {den.map((d) => <p key={d.id} className={cn(d.resolvida && "text-muted-foreground line-through")}>{fDataHora(d.created_at)} · {d.motivo}</p>)}
        </div>
      )}
      {motivo ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={"m" + a.id} className="text-sm font-semibold">Motivo (o anunciante recebe este texto)</label>
          <textarea id={"m" + a.id} className={cn(textareaCls, "min-h-20")} maxLength={500} value={txt} onChange={(e) => setTxt(e.target.value)} />
          <div className="flex gap-2"><Btn v="danger" className="min-h-10" onClick={() => acao(motivo, txt)}>{motivo === "rejeitar" ? "Recusar anúncio" : "Suspender anúncio"}</Btn><Btn v="ghost" className="min-h-10" onClick={() => setMotivo(null)}>Cancelar</Btn></div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {a.status !== "aprovado" && a.status !== "encerrado" && <Btn v="wa" className="min-h-10" onClick={() => acao("aprovar")}><CheckCircle2 className="h-4 w-4" /> {a.status === "suspenso" ? "Reativar" : "Aprovar"}</Btn>}
          {a.status === "pendente" && <Btn v="outline" className="min-h-10" onClick={() => setMotivo("rejeitar")}><XCircle className="h-4 w-4" /> Recusar</Btn>}
          {a.status === "aprovado" && <Btn v="outline" className="min-h-10" onClick={() => setMotivo("suspender")}><PauseCircle className="h-4 w-4" /> Suspender</Btn>}
          {a.status === "aprovado" && den.some((d) => !d.resolvida) && <Btn v="soft" className="min-h-10" onClick={() => acao("aprovar")}>Manter publicado</Btn>}
          <Btn v="ghost" className="min-h-10" onClick={() => acao(a.destaque ? "tirar_destaque" : "destacar")}><Star className="h-4 w-4" /> {a.destaque ? "Tirar destaque" : "Destacar parceiro"}</Btn>
          <Btn v="ghost" className="min-h-10" onClick={() => acao(a.verificado ? "tirar_verificacao" : "verificar")}><BadgeCheck className="h-4 w-4" /> {a.verificado ? "Tirar verificação" : "Marcar verificado"}</Btn>
        </div>
      )}
    </Card>
  );
}
