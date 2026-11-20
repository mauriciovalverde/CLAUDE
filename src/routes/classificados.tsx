import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, LocateFixed, Megaphone, MessageCircle, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Store, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Card, Carregando, Chip, Vazio, btn, inputCls } from "@/components/app/kit";
import { CartaoAnuncio, CartaoCupom, CartaoDestaque, DetalheAnuncio } from "@/components/app/ClsCartoes";
import { PublicarAnuncio } from "@/components/app/ClsPublicar";
import { Conversa, ListaConversas } from "@/components/app/ClsConversas";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { fData } from "@/lib/br";
import { ATALHOS_SUB, type Anuncio, CATEGORIAS, CONDICOES, DISTANCIAS, PRECOS, STATUS_CLS, SUBCATEGORIAS, cat, distanciaKm, fotoUrl, vencido } from "@/lib/classificados";
import { cn } from "@/lib/utils";

type Busca = { aba?: string; a?: string; conversa?: string; editar?: string };
export const Route = createFileRoute("/classificados")({
  head: () => ({ meta: [{ title: "Classificados Solidários · AMPARO" }] }),
  validateSearch: (s: Record<string, unknown>): Busca => ({
    aba: typeof s.aba === "string" ? s.aba : undefined, a: typeof s.a === "string" ? s.a : undefined,
    conversa: typeof s.conversa === "string" ? s.conversa : undefined, editar: typeof s.editar === "string" ? s.editar : undefined,
  }),
  component: () => <AppShell><Classificados /></AppShell>,
});

const ABAS: [string, string, any][] = [["vitrine", "Oportunidades", LayoutGrid], ["meus", "Meus anúncios", Store], ["conversas", "Conversas", MessageCircle]];

function Classificados() {
  const s = Route.useSearch();
  const nav = useNavigate();
  const ir = (b: Busca) => nav({ to: "/classificados", search: b as any });
  const aba = s.conversa ? "conversas" : s.aba ?? "vitrine";
  const { data: naoLidas } = useQuery<number>(async () => { const { data } = await db.rpc("cls_minhas_conversas"); return (data ?? []).reduce((t: number, c: any) => t + (c.nao_lidas || 0), 0); }, [s.conversa, aba]);

  return (
    <div className="flex flex-col gap-4">
      <header className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#082F70,#0868D0)] px-4 pb-5 pt-4 text-white sm:px-6">
        <span aria-hidden="true" className="faixa-marca absolute inset-x-0 bottom-0 h-1.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">Oportunidades que acolhem</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">Classificados Solidários</h1>
          <p className="mt-0.5 hidden max-w-xl text-sm text-white/85 sm:block">Empregos inclusivos, serviços adaptados, cupons de parceiros e negócios de famílias atípicas.</p>
        </div>
        {aba !== "publicar" && (
          <button onClick={() => ir({ aba: "publicar" })} className="tap inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 font-display text-xs font-extrabold text-navy shadow-lg hover:bg-white/90 sm:text-sm">
            <Plus className="h-5 w-5" /> <span className="max-[359px]:hidden">PUBLICAR</span><span className="hidden sm:inline">&nbsp;ANÚNCIO</span>
          </button>
        )}
      </header>

      {aba !== "publicar" && (
        <nav aria-label="Seções dos Classificados" className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {ABAS.map(([k, l, I]) => (
            <button key={k} onClick={() => ir({ aba: k })} aria-current={aba === k ? "page" : undefined}
              className={cn("tap relative inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", aba === k ? "border-primary bg-primary text-white" : "border-border bg-card text-navy")}>
              <I className="h-4 w-4" /> {l === "Meus anúncios" ? "MEUS ANÚNCIOS" : l}
              {k === "conversas" && !!naoLidas && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white">{naoLidas}</span>}
            </button>
          ))}
        </nav>
      )}

      {aba === "vitrine" && <Vitrine abrir={s.a} onAbrir={(id) => ir({ a: id })} onFechar={() => ir({})} onConversa={(c) => ir({ conversa: c })} onEditar={(id) => ir({ aba: "publicar", editar: id })} />}
      {aba === "meus" && <Meus onEditar={(id) => ir({ aba: "publicar", editar: id })} onAbrir={(id) => ir({ a: id })} />}
      {aba === "conversas" && (s.conversa
        ? <Conversa id={s.conversa} onVoltar={() => ir({ aba: "conversas" })} onVerAnuncio={(id) => ir({ a: id })} />
        : <ListaConversas onAbrir={(c) => ir({ conversa: c })} />)}
      {aba === "publicar" && <Publicar editarId={s.editar} onFeito={() => ir({ aba: "meus" })} onCancelar={() => ir({})} />}
    </div>
  );
}

function Publicar({ editarId, onFeito, onCancelar }: { editarId?: string; onFeito: () => void; onCancelar: () => void }) {
  const { data, loading } = useQuery<Anuncio | null>(async () => editarId ? (await db.from("cls_anuncios").select("*").eq("id", editarId).maybeSingle()).data : null, [editarId]);
  if (editarId && loading) return <Carregando />;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-2xl font-extrabold">{editarId ? "Editar anúncio" : "Publicar anúncio"} <span className="text-base font-semibold text-muted-foreground">· gratuito</span></h2>
      <PublicarAnuncio key={editarId ?? "novo"} editar={data} onFeito={onFeito} onCancelar={onCancelar} />
    </div>
  );
}

function Vitrine({ abrir, onAbrir, onFechar, onConversa, onEditar }: { abrir?: string; onAbrir: (id: string) => void; onFechar: () => void; onConversa: (id: string) => void; onEditar: (id: string) => void }) {
  const { familia } = useAuth();
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, loading, erro, recarregar } = useQuery<Anuncio[]>(async () => {
    const { data, error } = await db.from("cls_anuncios").select("*").eq("status", "aprovado").gte("validade", hoje).order("destaque", { ascending: false }).order("created_at", { ascending: false }).limit(400);
    if (error) throw error; return data ?? [];
  }, []);
  const { data: avulso } = useQuery<Anuncio | null>(async () => abrir ? (await db.from("cls_anuncios").select("*").eq("id", abrir).maybeSingle()).data : null, [abrir]);
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("");
  const [sub, setSub] = useState("");
  const [cidade, setCidade] = useState("");
  const [raio, setRaio] = useState(0);
  const [preco, setPreco] = useState("");
  const [conds, setConds] = useState<string[]>([]);
  const [soVerif, setSoVerif] = useState(false);
  const [mais, setMais] = useState(false);
  const [eu, setEu] = useState<[number, number] | null>(null);
  const [gps, setGps] = useState<"" | "buscando" | "negado">("");

  const cidades = useMemo(() => Array.from(new Set((data ?? []).map((a) => a.cidade.trim()))).sort((x, y) => x.localeCompare(y, "pt-BR")), [data]);
  useEffect(() => { if (familia?.cidade && cidades.some((c) => c.toLowerCase() === String(familia.cidade).toLowerCase())) setCidade((c) => c || cidades.find((x) => x.toLowerCase() === String(familia.cidade).toLowerCase())!); }, [cidades.length]);

  function pedirLocal(km: number) {
    if (eu) return setRaio(km);
    if (!navigator.geolocation) return setGps("negado");
    setGps("buscando");
    navigator.geolocation.getCurrentPosition((p) => { setEu([p.coords.latitude, p.coords.longitude]); setRaio(km); setCidade(""); setGps(""); }, () => { setGps("negado"); setRaio(0); }, { timeout: 15000, maximumAge: 600000 });
  }
  const km = (a: Anuncio) => (eu && a.lat != null && a.lng != null ? distanciaKm(eu, [Number(a.lat), Number(a.lng)]) : null);
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const lista = useMemo(() => {
    const termo = norm(q.trim());
    let l = (data ?? []).filter((a) => {
      if (categoria && a.categoria !== categoria) return false;
      if (sub && a.subcategoria !== sub) return false;
      if (cidade && a.cidade.trim().toLowerCase() !== cidade.toLowerCase()) return false;
      if (soVerif && !a.verificado) return false;
      if (conds.length && !conds.every((c) => a.condicoes.includes(c))) return false;
      if (preco === "gratis" && a.valor_tipo !== "gratis") return false;
      if (preco === "combinar" && a.valor_tipo !== "a_combinar") return false;
      if (/^\d+$/.test(preco) && !(a.valor_tipo === "gratis" || (a.valor != null && Number(a.valor) <= Number(preco) && ["fixo", "a_partir"].includes(a.valor_tipo)))) return false;
      if (raio) { const d = km(a); if (d == null || d > raio) return false; }
      if (termo && !norm([a.titulo, a.descricao, a.subcategoria, a.estabelecimento, a.cidade, a.bairro, cat(a.categoria).nome, ...a.condicoes].filter(Boolean).join(" ")).includes(termo)) return false;
      return true;
    });
    if (raio && eu) l = [...l].sort((x, y) => (km(x) ?? 1e9) - (km(y) ?? 1e9));
    return l;
  }, [data, q, categoria, sub, cidade, raio, preco, conds, soVerif, eu]);

  const filtrando = !!(q || categoria || sub || cidade || raio || preco || conds.length || soVerif);
  const destaques = (data ?? []).filter((a) => a.destaque && (!cidade || a.cidade.toLowerCase() === cidade.toLowerCase()));
  const cupons = (data ?? []).filter((a) => a.categoria === "cupom" && (!cidade || a.cidade.toLowerCase() === cidade.toLowerCase()));
  const sel = abrir ? (data ?? []).find((a) => a.id === abrir) ?? avulso : null;
  const limpar = () => { setQ(""); setCategoria(""); setSub(""); setCidade(""); setRaio(0); setPreco(""); setConds([]); setSoVerif(false); };
  const pill = "tap shrink-0 rounded-full border border-border bg-card px-3 text-sm font-semibold text-navy";

  return (
    <div className="flex flex-col gap-4">
      <form role="search" onSubmit={(e) => e.preventDefault()} className="flex items-center gap-2 rounded-full border-2 border-primary/30 bg-card p-1.5 pl-4 shadow-card focus-within:border-primary">
        <Search className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <label htmlFor="cls-busca" className="sr-only">Buscar nos classificados</label>
        <input id="cls-busca" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empregos, serviços e descontos…" className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none" />
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Categorias">
        <button onClick={() => { setCategoria(""); setSub(""); }} aria-pressed={!categoria && !sub}
          className={cn("flex w-[4.6rem] shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5 text-xs font-semibold", !categoria && !sub ? "text-primary" : "text-navy")}>
          <span className={cn("grid h-12 w-12 place-items-center rounded-2xl border-2", !categoria && !sub ? "border-primary bg-primary text-white" : "border-transparent bg-secondary")}><LayoutGrid className="h-5 w-5" /></span>Todos
        </button>
        {CATEGORIAS.map((c) => (
          <button key={c.k} onClick={() => { setCategoria(categoria === c.k && !sub ? "" : c.k); setSub(""); }} aria-pressed={categoria === c.k && !sub}
            className={cn("flex w-[4.6rem] shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5 text-xs font-semibold", categoria === c.k && !sub ? "text-primary" : "text-navy")}>
            <span className={cn("grid h-12 w-12 place-items-center rounded-2xl border-2", c.tom, categoria === c.k && !sub ? "border-primary" : "border-transparent")}><c.I className="h-5 w-5" /></span>{c.curto}
          </button>
        ))}
        {ATALHOS_SUB.map(([c, nome]) => { const C = cat(c); const on = sub === nome; return (
          <button key={nome} onClick={() => { setCategoria(on ? "" : c); setSub(on ? "" : nome); }} aria-pressed={on}
            className={cn("flex w-[4.6rem] shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5 text-center text-xs font-semibold leading-tight", on ? "text-primary" : "text-navy")}>
            <span className={cn("grid h-12 w-12 place-items-center rounded-2xl border-2 bg-secondary", on ? "border-primary" : "border-transparent")}><C.I className="h-5 w-5" /></span>{nome.split(" ")[0]}
          </button>
        ); })}
      </div>

      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4">
        <label className="sr-only" htmlFor="cls-cidade">Cidade</label>
        <select id="cls-cidade" value={cidade} onChange={(e) => { setCidade(e.target.value); if (e.target.value) setRaio(0); }} className={cn(pill, cidade && "border-primary text-primary")}>
          <option value="">Todas as cidades</option>{cidades.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="sr-only" htmlFor="cls-raio">Distância</label>
        <select id="cls-raio" value={raio} onChange={(e) => { const v = Number(e.target.value); if (v) pedirLocal(v); else setRaio(0); }} className={cn(pill, raio && "border-primary text-primary")}>
          <option value={0}>{gps === "buscando" ? "Localizando…" : "Qualquer distância"}</option>{DISTANCIAS.map((d) => <option key={d} value={d}>Até {d} km</option>)}
        </select>
        <label className="sr-only" htmlFor="cls-preco">Preço</label>
        <select id="cls-preco" value={preco} onChange={(e) => setPreco(e.target.value)} className={cn(pill, preco && "border-primary text-primary")}>
          {PRECOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={() => setMais(!mais)} aria-expanded={mais} className={cn(pill, "inline-flex items-center gap-1", (mais || conds.length || soVerif) && "border-primary text-primary")}>
          <SlidersHorizontal className="h-4 w-4" /> Filtros{conds.length + (soVerif ? 1 : 0) ? ` (${conds.length + (soVerif ? 1 : 0)})` : ""}
        </button>
      </div>
      {gps === "negado" && <Aviso tom="amber">Não conseguimos sua localização. Permita o acesso à localização no navegador ou filtre por cidade.</Aviso>}
      {raio > 0 && <p className="-mt-2 flex items-center gap-1 text-xs text-muted-foreground"><LocateFixed className="h-3.5 w-3.5" /> Distância aproximada. Anúncios sem localização não aparecem neste filtro.</p>}
      {mais && (
        <Card className="flex flex-col gap-3 p-4">
          {categoria && <div className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-navy">Tipo de serviço</span>
            <div className="flex flex-wrap gap-1.5">{SUBCATEGORIAS[categoria as keyof typeof SUBCATEGORIAS].map((x) => (
              <button key={x} onClick={() => setSub(sub === x ? "" : x)} aria-pressed={sub === x} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", sub === x ? "border-primary bg-primary-soft text-primary" : "border-border")}>{x}</button>
            ))}</div></div>}
          <div className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-navy">Disponibilidade e condições</span>
            <div className="flex flex-wrap gap-1.5">{CONDICOES.map((x) => { const on = conds.includes(x); return (
              <button key={x} onClick={() => setConds(on ? conds.filter((c) => c !== x) : [...conds, x])} aria-pressed={on} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", on ? "border-success bg-success-soft text-success" : "border-border")}>{on && "✓ "}{x}</button>
            ); })}</div></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={soVerif} onChange={(e) => setSoVerif(e.target.checked)} /> Somente verificados pela equipe</label>
        </Card>
      )}

      {loading ? <Carregando /> : erro ? (
        <Vazio icon={XCircle} titulo="Não foi possível carregar" texto="Verifique sua internet e tente de novo."><Btn v="outline" onClick={recarregar}>Tentar de novo</Btn></Vazio>
      ) : (
        <>
          {!filtrando && destaques.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-display text-lg font-bold">Parceiros em destaque</h2>
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">{destaques.map((a) => <CartaoDestaque key={a.id} a={a} onAbrir={() => onAbrir(a.id)} />)}</div>
            </section>
          )}
          {!filtrando && cupons.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Cupons disponíveis</h2><button onClick={() => setCategoria("cupom")} className="text-sm font-semibold text-primary">Ver todos</button></div>
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">{cupons.slice(0, 12).map((a) => <CartaoCupom key={a.id} a={a} onAbrir={() => onAbrir(a.id)} />)}</div>
            </section>
          )}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">{filtrando ? `${lista.length} resultado${lista.length === 1 ? "" : "s"}` : "Oportunidades da comunidade"}</h2>
              {filtrando && <button onClick={limpar} className="text-sm font-semibold text-primary">Limpar filtros</button>}
            </div>
            {lista.length ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{lista.map((a) => <CartaoAnuncio key={a.id} a={a} km={km(a)} onAbrir={() => onAbrir(a.id)} />)}</div>
            ) : filtrando ? (
              <Vazio icon={Search} titulo="Nada encontrado com esses filtros" texto="Tente outra palavra, outra cidade ou uma distância maior."><Btn v="outline" onClick={limpar}>Limpar filtros</Btn></Vazio>
            ) : (
              <Vazio icon={Megaphone} titulo="Ainda não há anúncios publicados" texto="Seja a primeira pessoa a divulgar uma vaga, um serviço adaptado, um cupom ou o seu negócio. É gratuito." />
            )}
          </section>
          <Card className="flex flex-col items-start gap-2 border-primary/30 bg-primary-soft sm:flex-row sm:items-center">
            <div className="flex-1"><h3 className="font-display text-lg font-bold">Anuncie e fortaleça nossa rede</h3><p className="text-sm text-muted-foreground">Divulgue gratuitamente uma oportunidade para a comunidade.</p></div>
            <a href="?aba=publicar" onClick={(e) => { e.preventDefault(); onEditar(""); }} className={cn(btn.base, btn.primary)}><Plus className="h-5 w-5" /> PUBLICAR ANÚNCIO</a>
          </Card>
        </>
      )}
      {sel && <DetalheAnuncio a={sel} km={km(sel)} onFechar={onFechar} onConversa={onConversa} onEditar={() => onEditar(sel.id)} />}
      {abrir && !sel && !loading && avulso === null && <Aviso tom="amber">Este anúncio não está mais disponível.</Aviso>}
    </div>
  );
}

function Meus({ onEditar, onAbrir }: { onEditar: (id: string) => void; onAbrir: (id: string) => void }) {
  const { user } = useAuth();
  const { data, loading, recarregar } = useQuery<Anuncio[]>(async () => (await db.from("cls_anuncios").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [], [user?.id]);
  async function encerrar(a: Anuncio) {
    const { error } = await db.from("cls_anuncios").update({ status: "encerrado" }).eq("id", a.id);
    if (error) return toast.error(error.message); toast.success("Anúncio encerrado."); recarregar();
  }
  async function renovar(a: Anuncio) {
    const d = new Date(); d.setDate(d.getDate() + 30);
    const { error } = await db.from("cls_anuncios").update({ validade: d.toISOString().slice(0, 10), status: "pendente" }).eq("id", a.id);
    if (error) return toast.error(error.message); toast.success("Renovado por 30 dias."); recarregar();
  }
  async function excluir(a: Anuncio) {
    if (!confirm(`Excluir "${a.titulo}"? Isso não pode ser desfeito.`)) return;
    const { error } = await db.from("cls_anuncios").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    if (a.fotos.length) await db.storage.from("classificados").remove(a.fotos);
    toast.success("Anúncio excluído."); recarregar();
  }
  if (loading) return <Carregando />;
  if (!data?.length) return <Vazio icon={Store} titulo="Você ainda não anunciou" texto="Publique uma vaga, um serviço, um cupom ou o seu negócio. A equipe confere e publica." />;
  return (
    <ul className="flex flex-col gap-2">
      {data.map((a) => {
        const venc = vencido(a);
        const [st, tom] = venc && a.status === "aprovado" ? ["Vencido", "navy"] : STATUS_CLS[a.status] ?? [a.status, "navy"];
        const C = cat(a.categoria);
        return (
          <li key={a.id}>
            <Card className="flex flex-col gap-2 p-3">
              <div className="flex gap-3">
                {a.fotos[0] ? <img src={fotoUrl(a.fotos[0])!} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <span className={cn("grid h-16 w-16 shrink-0 place-items-center rounded-xl", C.tom)}><C.I className="h-6 w-6" /></span>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5"><Chip tom={tom}>{st}</Chip><span className="text-xs text-muted-foreground">{C.curto} · até {fData(a.validade + "T12:00")}</span></div>
                  <button onClick={() => a.status === "aprovado" && !venc && onAbrir(a.id)} className="mt-0.5 block text-left font-display font-bold text-navy">{a.titulo}</button>
                  {a.categoria === "cupom" && <p className="text-xs text-muted-foreground">{a.cupom_usos} uso{a.cupom_usos === 1 ? "" : "s"}{a.cupom_limite ? ` de ${a.cupom_limite}` : ""}</p>}
                </div>
              </div>
              {a.motivo && ["rejeitado", "suspenso"].includes(a.status) && <Aviso tom="red"><b>Motivo:</b> {a.motivo}</Aviso>}
              {a.status === "pendente" && <p className="text-xs text-muted-foreground">A equipe está analisando. Você recebe um aviso no sino.</p>}
              <div className="flex flex-wrap gap-2">
                {a.status !== "suspenso" && <Btn v="soft" className="min-h-10" onClick={() => onEditar(a.id)}><Pencil className="h-4 w-4" /> Editar</Btn>}
                {(venc || a.status === "encerrado") && a.status !== "suspenso" && <Btn v="outline" className="min-h-10" onClick={() => renovar(a)}><RotateCcw className="h-4 w-4" /> Renovar</Btn>}
                {a.status === "aprovado" && !venc && <Btn v="outline" className="min-h-10" onClick={() => encerrar(a)}>Encerrar</Btn>}
                <Btn v="ghost" className="min-h-10 text-emergency hover:bg-emergency-soft" onClick={() => excluir(a)}><Trash2 className="h-4 w-4" /> Excluir</Btn>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
