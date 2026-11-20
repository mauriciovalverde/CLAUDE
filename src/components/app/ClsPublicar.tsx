import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ImagePlus, LocateFixed, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Aviso, Btn, Campo, Card, Opcoes, inputCls, textareaCls } from "@/components/app/kit";
import { CartaoAnuncio } from "@/components/app/ClsCartoes";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/dados";
import { UFS, digits, fmtTel } from "@/lib/br";
import { type Anuncio, type Categoria, CATEGORIAS, CONDICOES, SUBCATEGORIAS, cat, enviarFoto, fotoUrl } from "@/lib/classificados";
import { cn } from "@/lib/utils";

const VALOR_TIPOS: [string, string][] = [["a_combinar", "A combinar"], ["fixo", "Valor fixo"], ["a_partir", "A partir de"], ["gratis", "Gratuito"], ["nao_se_aplica", "Não se aplica"]];
const PRAZOS: [number, string][] = [[15, "15 dias"], [30, "30 dias"], [60, "60 dias"], [90, "90 dias"], [180, "6 meses"]];
const hoje = () => new Date().toISOString().slice(0, 10);
const somarDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

type Form = {
  categoria: Categoria | ""; subcategoria: string; titulo: string; descricao: string; fotos: string[]; cidade: string; bairro: string; uf: string;
  lat: number | null; lng: number | null; valor_tipo: string; valor: string; horarios: string; condicoes: string[]; contato_chat: boolean; whatsapp: string; autorizaWa: boolean;
  registro_prof: string; estabelecimento: string; cupom_regras: string; cupom_limite: string; codigo: string; prazo: number; validade: string;
};

const PASSOS = ["Tipo", "Anúncio", "Local e condições", "Contato e prazo"];

export function PublicarAnuncio({ editar, onFeito, onCancelar }: { editar?: Anuncio | null; onFeito: () => void; onCancelar: () => void }) {
  const { user, familia } = useAuth();
  const [passo, setPasso] = useState(editar ? 1 : 0);
  const [f, setF] = useState<Form>(() => ({
    categoria: editar?.categoria ?? "", subcategoria: editar?.subcategoria ?? "", titulo: editar?.titulo ?? "", descricao: editar?.descricao ?? "", fotos: editar?.fotos ?? [],
    cidade: editar?.cidade ?? familia?.cidade ?? "", bairro: editar?.bairro ?? "", uf: editar?.uf ?? familia?.uf ?? "BA", lat: editar?.lat ?? null, lng: editar?.lng ?? null,
    valor_tipo: editar?.valor_tipo ?? "a_combinar", valor: editar?.valor != null ? String(editar.valor).replace(".", ",") : "", horarios: editar?.horarios ?? "", condicoes: editar?.condicoes ?? [],
    contato_chat: editar?.contato_chat ?? true, whatsapp: editar?.whatsapp ? fmtTel(editar.whatsapp.replace(/^55(?=\d{10,11}$)/, "")) : "", autorizaWa: !!editar?.whatsapp,
    registro_prof: editar?.registro_prof ?? "", estabelecimento: editar?.estabelecimento ?? "", cupom_regras: editar?.cupom_regras ?? "", cupom_limite: editar?.cupom_limite ? String(editar.cupom_limite) : "",
    codigo: "", prazo: 30, validade: editar?.validade ?? "",
  }));
  const [subindo, setSubindo] = useState(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [gps, setGps] = useState<"" | "buscando" | "erro">("");
  const arq = useRef<HTMLInputElement>(null);
  const topo = useRef<HTMLDivElement>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((x) => ({ ...x, [k]: v })); setErros((e) => (e[k as string] || (k === "whatsapp" && e.contato) ? { ...e, [k]: "", contato: k === "whatsapp" || k === "contato_chat" ? "" : e.contato } : e)); };

  useEffect(() => {
    if (editar?.categoria === "cupom") db.from("cls_cupom_codigos").select("codigo").eq("anuncio_id", editar.id).maybeSingle().then(({ data }: any) => data && set("codigo", data.codigo));
  }, [editar?.id]);
  useEffect(() => { topo.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [passo]);

  async function addFotos(lista: FileList | null) {
    if (!lista || !user) return;
    const livres = 6 - f.fotos.length;
    const sel = Array.from(lista).slice(0, livres);
    if (lista.length > livres) toast.error("Máximo de 6 fotos por anúncio.");
    setSubindo((n) => n + sel.length);
    for (const file of sel) {
      try { const p = await enviarFoto(user.id, file); setF((x) => ({ ...x, fotos: [...x.fotos, p] })); }
      catch (e: any) { toast.error(`Não foi possível enviar ${file.name}: ${e.message ?? "tente de novo"}`); }
      finally { setSubindo((n) => n - 1); }
    }
  }
  function tirarFoto(p: string) {
    set("fotos", f.fotos.filter((x) => x !== p));
    if (!editar?.fotos.includes(p)) db.storage.from("classificados").remove([p]);
  }
  function localizacao() {
    if (!navigator.geolocation) return setGps("erro");
    setGps("buscando");
    navigator.geolocation.getCurrentPosition(
      (p) => { setF((x) => ({ ...x, lat: Math.round(p.coords.latitude * 100) / 100, lng: Math.round(p.coords.longitude * 100) / 100 })); setGps(""); },
      () => setGps("erro"), { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }

  function validar(p: number) {
    const e: Record<string, string> = {};
    if (p === 0 && !f.categoria) e.categoria = "Escolha o tipo de anúncio.";
    if (p === 1) {
      if (f.titulo.trim().length < 3) e.titulo = "Escreva um título (mínimo 3 letras).";
      if (f.descricao.trim().length < 10) e.descricao = "Descreva com pelo menos 10 letras.";
      if (f.categoria === "cupom" && f.codigo.trim().length < 3) e.codigo = "Informe o código do cupom.";
      if (f.categoria === "cupom" && !f.estabelecimento.trim()) e.estabelecimento = "Informe o estabelecimento.";
    }
    if (p === 2) {
      if (f.cidade.trim().length < 2) e.cidade = "Informe a cidade.";
      if (["fixo", "a_partir"].includes(f.valor_tipo) && !(Number(f.valor.replace(/\./g, "").replace(",", ".")) >= 0 && f.valor.trim())) e.valor = "Informe o valor.";
    }
    if (p === 3) {
      if (f.whatsapp && ![10, 11].includes(digits(f.whatsapp).length)) e.whatsapp = "WhatsApp com DDD, 10 ou 11 números.";
      if (f.whatsapp && !f.autorizaWa) e.whatsapp = "Marque a autorização para mostrar o WhatsApp.";
      if (!f.contato_chat && !f.whatsapp) e.contato = "Escolha pelo menos uma forma de contato.";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }
  const avancar = () => { if (validar(passo)) setPasso(passo + 1); };

  async function salvar() {
    if (![0, 1, 2, 3].every(validar)) return;
    if (subindo) return toast.error("Aguarde as fotos terminarem de enviar.");
    setSalvando(true);
    const valor = ["fixo", "a_partir"].includes(f.valor_tipo) ? Number(f.valor.replace(/\./g, "").replace(",", ".")) : null;
    const reg = {
      categoria: f.categoria, subcategoria: f.subcategoria || null, titulo: f.titulo.trim(), descricao: f.descricao.trim(), fotos: f.fotos,
      cidade: f.cidade.trim(), bairro: f.bairro.trim() || null, uf: f.uf, lat: f.lat, lng: f.lng, valor, valor_tipo: f.valor_tipo,
      horarios: f.horarios.trim() || null, condicoes: f.condicoes, contato_chat: f.contato_chat, whatsapp: f.whatsapp && f.autorizaWa ? digits(f.whatsapp) : null,
      registro_prof: f.categoria === "profissional" ? f.registro_prof.trim() || null : null, estabelecimento: f.estabelecimento.trim() || null,
      cupom_regras: f.categoria === "cupom" ? f.cupom_regras.trim() || null : null, cupom_limite: f.categoria === "cupom" && Number(f.cupom_limite) > 0 ? Number(f.cupom_limite) : null,
      validade: editar && f.validade >= hoje() && !f.prazo ? f.validade : somarDias(f.prazo || 30),
    };
    const q = editar ? db.from("cls_anuncios").update(reg).eq("id", editar.id).select("id").single() : db.from("cls_anuncios").insert({ ...reg, user_id: user!.id }).select("id").single();
    const { data, error } = await q;
    if (!error && f.categoria === "cupom") {
      const r = await db.from("cls_cupom_codigos").upsert({ anuncio_id: data.id, codigo: f.codigo.trim() });
      if (r.error) toast.error("Anúncio salvo, mas o código do cupom não: " + r.error.message);
    }
    setSalvando(false);
    if (error) return toast.error(error.message);
    setPronto(true);
  }

  if (pronto) return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <CheckCircle2 className="h-14 w-14 text-success" />
      <h2 className="font-display text-2xl font-extrabold">Anúncio enviado para análise</h2>
      <p className="max-w-md text-muted-foreground">A equipe do AMPARO confere cada anúncio antes de publicar. Você recebe um aviso no sino quando ele for aprovado.</p>
      <Btn onClick={onFeito}>Ver meus anúncios</Btn>
    </Card>
  );

  const C = f.categoria ? cat(f.categoria) : null;
  const previa: Anuncio = {
    id: "previa", user_id: user?.id ?? "", categoria: (f.categoria || "emprego") as Categoria, subcategoria: f.subcategoria || null, titulo: f.titulo || "Título do anúncio", descricao: f.descricao,
    cidade: f.cidade || "Cidade", bairro: f.bairro || null, uf: f.uf, lat: null, lng: null, valor: Number(f.valor.replace(/\./g, "").replace(",", ".")) || null, valor_tipo: f.valor_tipo,
    horarios: null, condicoes: f.condicoes, contato_chat: f.contato_chat, whatsapp: null, registro_prof: null, estabelecimento: f.estabelecimento, cupom_regras: null, cupom_limite: null, cupom_usos: 0,
    fotos: f.fotos, validade: somarDias(f.prazo), status: "pendente", motivo: null, verificado: false, destaque: false, created_at: "", atualizado_em: "",
  };

  return (
    <div ref={topo} className="flex scroll-mt-24 flex-col gap-4">
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Etapas">
        {PASSOS.map((p, i) => (
          <li key={p} className="flex flex-col gap-1" aria-current={i === passo ? "step" : undefined}>
            <span className={cn("h-1.5 rounded-full", i <= passo ? "bg-primary" : "bg-muted")} />
            <span className={cn("text-[11px] font-semibold leading-tight", i === passo ? "text-primary" : "text-muted-foreground")}>{p}</span>
          </li>
        ))}
      </ol>

      {passo === 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold">O que você quer anunciar?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORIAS.map((c) => (
              <button key={c.k} onClick={() => { set("categoria", c.k); set("subcategoria", ""); setPasso(1); }} aria-pressed={f.categoria === c.k}
                className={cn("card-soft flex items-start gap-3 p-4 text-left transition hover:border-primary", f.categoria === c.k && "border-primary ring-2 ring-primary/20")}>
                <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", c.tom)}><c.I className="h-6 w-6" /></span>
                <span><b className="font-display text-navy">{c.nome}</b><span className="block text-sm text-muted-foreground">{c.desc}</span></span>
              </button>
            ))}
          </div>
          {erros.categoria && <p className="text-sm font-semibold text-emergency" role="alert">{erros.categoria}</p>}
        </div>
      )}

      {passo === 1 && C && (
        <div className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold"><C.I className="h-5 w-5 text-primary" /> {C.nome}</h2>
          <Campo id="cls-sub" label="Tipo de serviço ou área"><Opcoes nome="Tipo" valores={SUBCATEGORIAS[f.categoria as Categoria]} valor={f.subcategoria} onChange={(v) => set("subcategoria", v)} /></Campo>
          <Campo id="cls-titulo" label="Título" obrigatorio erro={erros.titulo} dica={f.categoria === "emprego" ? "Ex.: Atendente de loja com horário flexível" : f.categoria === "cupom" ? "Ex.: 15% de desconto em fraldas" : "Ex.: Cuidadora com experiência em TEA"}>
            <input id="cls-titulo" className={inputCls} maxLength={100} value={f.titulo} onChange={(e) => set("titulo", e.target.value)} aria-invalid={!!erros.titulo} />
          </Campo>
          <Campo id="cls-desc" label="Descrição" obrigatorio erro={erros.descricao} dica="Conte o que é oferecido, requisitos e diferenciais para famílias atípicas.">
            <textarea id="cls-desc" className={textareaCls} maxLength={3000} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} aria-invalid={!!erros.descricao} />
          </Campo>
          {(f.categoria === "cupom" || f.categoria === "negocio" || f.categoria === "emprego") && (
            <Campo id="cls-est" label={f.categoria === "emprego" ? "Empresa" : f.categoria === "cupom" ? "Estabelecimento" : "Nome do negócio"} obrigatorio={f.categoria === "cupom"} erro={erros.estabelecimento}>
              <input id="cls-est" className={inputCls} maxLength={120} value={f.estabelecimento} onChange={(e) => set("estabelecimento", e.target.value)} />
            </Campo>
          )}
          {f.categoria === "profissional" && (
            <Campo id="cls-reg" label="Registro profissional" dica="Ex.: CRP 03/12345, CREFITO, COREN. Obrigatório para profissões regulamentadas. Só aparece como verificado depois que a equipe conferir.">
              <input id="cls-reg" className={inputCls} maxLength={80} value={f.registro_prof} onChange={(e) => set("registro_prof", e.target.value)} />
            </Campo>
          )}
          {f.categoria === "cupom" && (
            <div className="grid gap-3 rounded-2xl bg-coral-soft p-4 sm:grid-cols-2">
              <Campo id="cls-cod" label="Código do cupom" obrigatorio erro={erros.codigo} dica="Só aparece para quem tocar em “Pegar cupom”.">
                <input id="cls-cod" className={cn(inputCls, "font-mono uppercase")} maxLength={40} value={f.codigo} onChange={(e) => set("codigo", e.target.value.toUpperCase())} />
              </Campo>
              <Campo id="cls-lim" label="Limite de usos" dica="Deixe vazio para ilimitado.">
                <input id="cls-lim" type="number" min={1} inputMode="numeric" className={inputCls} value={f.cupom_limite} onChange={(e) => set("cupom_limite", e.target.value)} />
              </Campo>
              <div className="sm:col-span-2"><Campo id="cls-reg-cup" label="Regras de uso" dica="Ex.: válido nas compras acima de R$ 50, uma vez por pessoa, não cumulativo.">
                <textarea id="cls-reg-cup" className={cn(textareaCls, "min-h-20")} maxLength={1000} value={f.cupom_regras} onChange={(e) => set("cupom_regras", e.target.value)} />
              </Campo></div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-navy">Fotos <span className="font-normal text-muted-foreground">(até 6, opcional)</span></span>
            <div className="flex flex-wrap gap-2">
              {f.fotos.map((p) => (
                <span key={p} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
                  <img src={fotoUrl(p)!} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => tirarFoto(p)} aria-label="Remover foto" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><X className="h-4 w-4" /></button>
                </span>
              ))}
              {Array.from({ length: subindo }).map((_, i) => <span key={i} className="grid h-20 w-20 place-items-center rounded-xl bg-muted"><Loader2 className="h-5 w-5 animate-spin text-primary" /></span>)}
              {f.fotos.length + subindo < 6 && (
                <button onClick={() => arq.current?.click()} className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-border text-primary hover:border-primary" aria-label="Adicionar fotos"><ImagePlus className="h-6 w-6" /></button>
              )}
            </div>
            <input ref={arq} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { addFotos(e.target.files); e.target.value = ""; }} />
            <p className="text-xs text-muted-foreground">Não publique fotos de crianças, laudos, documentos ou rostos de outras pessoas sem autorização.</p>
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Onde e em que condições</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem]">
            <Campo id="cls-cid" label="Cidade" obrigatorio erro={erros.cidade}><input id="cls-cid" className={inputCls} maxLength={80} value={f.cidade} onChange={(e) => set("cidade", e.target.value)} /></Campo>
            <Campo id="cls-bai" label="Bairro aproximado"><input id="cls-bai" className={inputCls} maxLength={80} value={f.bairro} onChange={(e) => set("bairro", e.target.value)} /></Campo>
            <Campo id="cls-uf" label="UF" obrigatorio><select id="cls-uf" className={inputCls} value={f.uf} onChange={(e) => set("uf", e.target.value)}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Campo>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl bg-secondary p-4 text-sm">
            <p><b className="text-navy">Aparecer na busca por distância</b> <span className="text-muted-foreground">(opcional)</span></p>
            <p className="text-muted-foreground">Guardamos só um ponto aproximado, com cerca de 1 km de margem. Endereço e localização exata nunca aparecem.</p>
            {f.lat != null ? (
              <p className="flex flex-wrap items-center gap-2 font-semibold text-success">✓ Localização aproximada incluída <button onClick={() => setF((x) => ({ ...x, lat: null, lng: null }))} className="text-sm font-semibold text-muted-foreground underline">Remover</button></p>
            ) : (
              <Btn v="outline" className="min-h-10 self-start" onClick={localizacao} disabled={gps === "buscando"}><LocateFixed className="h-4 w-4" /> {gps === "buscando" ? "Buscando…" : "Usar minha localização aproximada"}</Btn>
            )}
            {gps === "erro" && <p className="text-emergency">Não foi possível obter a localização. O anúncio aparece normalmente pela cidade.</p>}
          </div>
          <Campo id="cls-vt" label="Valor"><Opcoes nome="Tipo de valor" valores={VALOR_TIPOS.map((v) => v[1])} valor={VALOR_TIPOS.find((v) => v[0] === f.valor_tipo)?.[1] ?? ""} onChange={(v) => set("valor_tipo", VALOR_TIPOS.find((x) => x[1] === v)?.[0] ?? "a_combinar")} /></Campo>
          {["fixo", "a_partir"].includes(f.valor_tipo) && (
            <Campo id="cls-val" label={f.categoria === "emprego" ? "Salário (R$)" : "Valor (R$)"} obrigatorio erro={erros.valor}>
              <input id="cls-val" inputMode="decimal" className={cn(inputCls, "max-w-48")} placeholder="0,00" value={f.valor} onChange={(e) => set("valor", e.target.value.replace(/[^\d.,]/g, ""))} />
            </Campo>
          )}
          <Campo id="cls-hor" label="Horários e disponibilidade" dica="Ex.: seg a sex, 8h às 12h; sábados com agendamento.">
            <input id="cls-hor" className={inputCls} maxLength={300} value={f.horarios} onChange={(e) => set("horarios", e.target.value)} />
          </Campo>
          <Campo id="cls-cond" label="Condições especiais para famílias atípicas"><Opcoes multi nome="Condições" valores={CONDICOES} valor={f.condicoes} onChange={(v) => set("condicoes", v)} /></Campo>
        </div>
      )}

      {passo === 3 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Como as pessoas falam com você</h2>
          <label className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-primary)]" checked={f.contato_chat} onChange={(e) => set("contato_chat", e.target.checked)} />
            <span><b className="text-navy">Receber mensagens pelo app</b><span className="block text-sm text-muted-foreground">Ninguém vê seu telefone. As mensagens chegam no sino e em Conversas.</span></span>
          </label>
          <Campo id="cls-wa" label="WhatsApp para contato" erro={erros.whatsapp || erros.contato}>
            <input id="cls-wa" inputMode="tel" className={cn(inputCls, "max-w-60")} placeholder="(73) 99999-9999" value={f.whatsapp} onChange={(e) => set("whatsapp", fmtTel(e.target.value))} />
          </Campo>
          {f.whatsapp && (
            <label className="-mt-2 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5" checked={f.autorizaWa} onChange={(e) => set("autorizaWa", e.target.checked)} />
              Autorizo mostrar este número no anúncio para as pessoas cadastradas no AMPARO.
            </label>
          )}
          <Campo id="cls-prazo" label="Por quanto tempo o anúncio fica no ar">
            <Opcoes nome="Validade" valores={PRAZOS.map((p) => p[1])} valor={PRAZOS.find((p) => p[0] === f.prazo)?.[1] ?? ""} onChange={(v) => set("prazo", PRAZOS.find((p) => p[1] === v)?.[0] ?? 30)} />
          </Campo>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-navy">Prévia do cartão</span>
            <div className="pointer-events-none max-w-md"><CartaoAnuncio a={previa} onAbrir={() => {}} /></div>
          </div>
          <Aviso tom="amber">Seu anúncio passa pela equipe antes de aparecer. Não inclua diagnósticos, laudos, dados de saúde ou informações de crianças.{editar ? " Ao editar, o anúncio volta para análise." : ""}</Aviso>
        </div>
      )}

      <div className="sticky bottom-20 z-10 flex gap-2 rounded-2xl bg-background/95 py-2 backdrop-blur lg:bottom-2">
        {passo > (editar ? 1 : 0) ? <Btn v="outline" onClick={() => setPasso(passo - 1)}><ChevronLeft className="h-4 w-4" /> Voltar</Btn> : <Btn v="ghost" onClick={onCancelar}>Cancelar</Btn>}
        <span className="flex-1" />
        {passo === 0 ? null : passo < 3 ? <Btn onClick={avancar}>Continuar</Btn>
          : <Btn onClick={salvar} disabled={salvando || subindo > 0}>{salvando ? "Enviando…" : editar ? "Salvar e enviar para análise" : "PUBLICAR ANÚNCIO"}</Btn>}
      </div>
    </div>
  );
}
