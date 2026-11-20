import { useEffect, useState } from "react";
import { BadgePercent, Copy, Flag, MapPin, MessageCircle, Pencil, Send, ShieldCheck, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Aviso, Btn, Chip, Modal, Opcoes, Verificado, btn, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/dados";
import { fData, waLink } from "@/lib/br";
import { type Anuncio, cat, diasRestantes, fotoUrl, kmTxt, localTxt, precoTxt } from "@/lib/classificados";
import { cn } from "@/lib/utils";

function Miniatura({ a, className }: { a: Anuncio; className?: string }) {
  const c = cat(a.categoria);
  const u = fotoUrl(a.fotos[0]);
  return u ? <img src={u} alt="" loading="lazy" className={cn("object-cover", className)} />
    : <span className={cn("grid place-items-center", c.tom, className)} aria-hidden="true"><c.I className="h-8 w-8" /></span>;
}

/** Cartão compacto em linha: foto à esquerda e informações essenciais, para caber vários na tela. */
export function CartaoAnuncio({ a, km, onAbrir }: { a: Anuncio; km?: number | null; onAbrir: () => void }) {
  const c = cat(a.categoria);
  const preco = precoTxt(a);
  return (
    <button onClick={onAbrir} className="card-soft flex w-full min-w-0 gap-3 p-2.5 text-left transition hover:border-primary">
      <Miniatura a={a} className="h-[5.5rem] w-[5.5rem] shrink-0 rounded-xl" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <c.I className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.curto}{a.subcategoria ? ` · ${a.subcategoria}` : ""}</span>
          {a.destaque && <span className="ml-auto shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] text-warning">PARCEIRO</span>}
        </span>
        <span className="line-clamp-2 font-display text-[15px] font-bold leading-snug text-navy">{a.titulo}{a.verificado && <> <Verificado /></>}</span>
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{localTxt(a)}{km != null ? ` · ${kmTxt(km)}` : ""}</span></span>
        <span className="mt-auto flex items-center gap-2">
          {preco && <b className="text-sm text-primary">{preco}</b>}
          {a.condicoes[0] && <span className="truncate rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">{a.condicoes[0]}</span>}
        </span>
      </span>
    </button>
  );
}

export function CartaoDestaque({ a, onAbrir }: { a: Anuncio; onAbrir: () => void }) {
  return (
    <button onClick={onAbrir} className="card-soft flex w-60 shrink-0 snap-start flex-col overflow-hidden text-left transition hover:border-primary">
      <Miniatura a={a} className="h-28 w-full" />
      <span className="flex flex-col gap-0.5 p-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-warning">Parceiro · {cat(a.categoria).curto}</span>
        <span className="line-clamp-2 font-display text-sm font-bold text-navy">{a.titulo}{a.verificado && <> <Verificado /></>}</span>
        <span className="truncate text-xs text-muted-foreground">{a.cidade}</span>
      </span>
    </button>
  );
}

export function CartaoCupom({ a, onAbrir }: { a: Anuncio; onAbrir: () => void }) {
  const d = diasRestantes(a.validade);
  const esgotado = a.cupom_limite != null && a.cupom_usos >= a.cupom_limite;
  return (
    <button onClick={onAbrir} className="relative flex w-56 shrink-0 snap-start overflow-hidden rounded-2xl border-2 border-dashed border-coral/60 bg-coral-soft text-left">
      <span className="grid w-14 shrink-0 place-items-center bg-coral text-white"><BadgePercent className="h-7 w-7" /></span>
      <span className="flex min-w-0 flex-col gap-0.5 p-3">
        <span className="truncate text-[11px] font-bold uppercase tracking-wide text-coral">{a.estabelecimento || a.subcategoria || "Cupom"}</span>
        <span className="line-clamp-2 font-display text-sm font-bold text-navy">{a.titulo}</span>
        <span className="text-xs text-muted-foreground">{esgotado ? "Esgotado" : d <= 7 ? `Vence em ${d} dia${d === 1 ? "" : "s"}` : `Até ${fData(a.validade + "T12:00")}`}</span>
      </span>
    </button>
  );
}

const MOTIVOS_DENUNCIA = ["Golpe ou pedido de dinheiro", "Informação falsa", "Conteúdo ofensivo ou discriminatório", "Expõe dados de outra pessoa ou criança", "Não é uma oportunidade real", "Outro"];

/** Detalhe do anúncio: fotos, condições, contato pelo app ou WhatsApp, cupom e denúncia. */
export function DetalheAnuncio({ a, km, onFechar, onConversa, onEditar }: { a: Anuncio; km?: number | null; onFechar: () => void; onConversa: (id: string) => void; onEditar: () => void }) {
  const { user } = useAuth();
  const c = cat(a.categoria);
  const [foto, setFoto] = useState(0);
  const [nome, setNome] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [denuncia, setDenuncia] = useState<string | null>(null);
  const meu = a.user_id === user?.id;
  const preco = precoTxt(a);
  useEffect(() => { db.rpc("cls_anunciantes", { _ids: [a.user_id] }).then(({ data }: any) => setNome(data?.[0]?.nome ?? null)); }, [a.user_id]);

  async function contatar() {
    if (!msg?.trim()) return toast.error("Escreva sua mensagem.");
    setEnviando(true);
    const { data, error } = await db.rpc("cls_contatar", { _anuncio: a.id, _texto: msg });
    setEnviando(false);
    if (error) return toast.error(error.message);
    toast.success("Mensagem enviada. A resposta chega no sino e em Conversas.");
    onConversa(data);
  }
  async function verCupom() {
    const { data, error } = await db.rpc("cls_usar_cupom", { _id: a.id });
    if (error) return toast.error(error.message);
    setCodigo(data);
  }
  async function denunciar() {
    if (!denuncia) return toast.error("Escolha o motivo.");
    const { error } = await db.rpc("cls_denunciar", { _id: a.id, _motivo: denuncia });
    if (error) return toast.error(error.message);
    toast.success("Denúncia enviada. A equipe vai analisar."); setDenuncia(null); onFechar();
  }
  const wa = a.whatsapp ? (a.whatsapp.length <= 11 ? "55" + a.whatsapp : a.whatsapp) : null;

  return (
    <Modal titulo={<span className="flex items-center gap-2"><c.I className="h-5 w-5 text-primary" /> {c.curto}</span>} onFechar={onFechar} largura="max-w-2xl">
      <div className="flex flex-col gap-4">
        {a.fotos.length > 0 && (
          <div className="flex flex-col gap-2">
            <img src={fotoUrl(a.fotos[foto])!} alt={`Foto ${foto + 1} do anúncio`} className="max-h-80 w-full rounded-2xl bg-muted object-contain" />
            {a.fotos.length > 1 && <div className="flex gap-2 overflow-x-auto">{a.fotos.map((f, i) => (
              <button key={f} onClick={() => setFoto(i)} aria-label={`Ver foto ${i + 1}`} className={cn("h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2", i === foto ? "border-primary" : "border-transparent")}><img src={fotoUrl(f)!} alt="" className="h-full w-full object-cover" /></button>
            ))}</div>}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            {a.subcategoria && <Chip tom="blue">{a.subcategoria}</Chip>}
            {a.destaque && <Chip tom="amber">Parceiro em destaque</Chip>}
            {a.verificado ? <Chip tom="green"><ShieldCheck className="h-3.5 w-3.5" /> Verificado pela equipe</Chip> : null}
          </div>
          <h2 className="font-display text-2xl font-extrabold leading-tight">{a.titulo}</h2>
          {preco && <p className="text-lg font-bold text-primary">{preco}</p>}
          <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {localTxt(a)}{km != null ? ` · cerca de ${kmTxt(km)} de você` : ""}</p>
          {a.estabelecimento && <p className="text-sm"><b>{a.categoria === "emprego" ? "Empresa" : "Estabelecimento"}:</b> {a.estabelecimento}</p>}
          {nome && <p className="text-sm text-muted-foreground">Anunciado por {nome} · válido até {fData(a.validade + "T12:00")}</p>}
        </div>
        <p className="whitespace-pre-line">{a.descricao}</p>
        {a.condicoes.length > 0 && <div className="flex flex-wrap gap-1.5">{a.condicoes.map((x) => <Chip key={x} tom="green">✓ {x}</Chip>)}</div>}
        {a.horarios && <p className="text-sm"><b>Horários e disponibilidade:</b> {a.horarios}</p>}
        {a.registro_prof && (
          <p className="text-sm"><b>Registro profissional:</b> {a.registro_prof}
            {!a.verificado && <span className="block text-xs text-muted-foreground">Informado pelo anunciante e ainda não conferido pela equipe. Confira no conselho da profissão antes de contratar.</span>}
          </p>
        )}

        {a.categoria === "cupom" && (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-coral/60 bg-coral-soft p-4">
            <p className="flex items-center gap-2 font-display font-bold text-coral"><Ticket className="h-5 w-5" /> Cupom de desconto</p>
            {a.cupom_regras && <p className="text-sm"><b>Regras:</b> {a.cupom_regras}</p>}
            <p className="text-xs text-muted-foreground">Válido até {fData(a.validade + "T12:00")}{a.cupom_limite ? ` · ${Math.max(0, a.cupom_limite - a.cupom_usos)} de ${a.cupom_limite} disponíveis` : ""}</p>
            {codigo ? (
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-card px-4 py-2 font-mono text-xl font-extrabold tracking-wider text-navy">{codigo}</span>
                <button onClick={() => navigator.clipboard?.writeText(codigo).then(() => toast.success("Código copiado."))} className={cn(btn.base, btn.outline, "min-h-10")}><Copy className="h-4 w-4" /> Copiar</button>
              </div>
            ) : !meu && <Btn onClick={verCupom} className="self-start bg-coral hover:bg-coral/90"><Ticket className="h-4 w-4" /> Pegar cupom</Btn>}
            <p className="text-xs text-muted-foreground">O desconto é dado pelo estabelecimento. O AMPARO não garante preço nem estoque.</p>
          </div>
        )}

        {meu ? (
          <Aviso tom="blue">Este anúncio é seu. <button onClick={onEditar} className="font-semibold text-primary underline"><Pencil className="inline h-3.5 w-3.5" /> Editar</button></Aviso>
        ) : (
          <div className="flex flex-col gap-2">
            {msg === null ? (
              <div className="flex flex-wrap gap-2">
                {a.contato_chat && <Btn onClick={() => setMsg(`Olá! Vi seu anúncio "${a.titulo}" no AMPARO e tenho interesse.`)}><MessageCircle className="h-5 w-5" /> Conversar pelo app</Btn>}
                {wa && <a href={waLink(wa, `Olá! Vi seu anúncio "${a.titulo}" no AMPARO.`)} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.wa)}><MessageCircle className="h-5 w-5" /> WhatsApp</a>}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label htmlFor="cls-msg" className="text-sm font-semibold text-navy">Sua mensagem</label>
                <textarea id="cls-msg" className={textareaCls} maxLength={2000} value={msg} onChange={(e) => setMsg(e.target.value)} />
                <p className="text-xs text-muted-foreground">O anunciante vê só o seu primeiro nome. Não envie dados de saúde, documentos ou endereço completo.</p>
                <div className="flex gap-2"><Btn onClick={contatar} disabled={enviando}><Send className="h-4 w-4" /> {enviando ? "Enviando…" : "Enviar"}</Btn><Btn v="ghost" onClick={() => setMsg(null)}>Cancelar</Btn></div>
              </div>
            )}
            {denuncia === null ? (
              <button onClick={() => setDenuncia("")} className="tap inline-flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-emergency"><Flag className="h-4 w-4" /> Denunciar anúncio</button>
            ) : (
              <div className="flex flex-col gap-2 rounded-2xl bg-emergency-soft p-4">
                <p className="font-semibold text-navy">Qual o problema com este anúncio?</p>
                <Opcoes nome="Motivo da denúncia" valores={MOTIVOS_DENUNCIA} valor={denuncia} onChange={setDenuncia} />
                <div className="flex gap-2"><Btn v="danger" onClick={denunciar}>Enviar denúncia</Btn><Btn v="ghost" onClick={() => setDenuncia(null)}>Cancelar</Btn></div>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Os anúncios passam por análise da equipe, mas a negociação é entre as partes. Combine encontros em locais públicos e nunca pague adiantado por uma vaga de emprego.</p>
      </div>
    </Modal>
  );
}
