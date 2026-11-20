import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BadgePercent, Plus, Search, Ticket, XCircle } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Carregando, Vazio, btn } from "@/components/app/kit";
import { DetalheAnuncio } from "@/components/app/ClsCartoes";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { fData } from "@/lib/br";
import { type Anuncio, SUBCATEGORIAS } from "@/lib/classificados";
import { cn } from "@/lib/utils";

type Busca = { a?: string };
export const Route = createFileRoute("/cupons")({
  head: () => ({ meta: [{ title: "Cupons e descontos · AMPARO" }] }),
  validateSearch: (s: Record<string, unknown>): Busca => ({ a: typeof s.a === "string" ? s.a : undefined }),
  component: () => <AppShell><Cupons /></AppShell>,
});

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const diasAte = (v: string) => Math.ceil((new Date(v + "T23:59:59").getTime() - Date.now()) / 86400000);

function Cupons() {
  const s = Route.useSearch();
  const nav = useNavigate();
  const { familia } = useAuth();
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, loading, erro, recarregar } = useQuery<Anuncio[]>(async () => {
    const { data, error } = await db.from("cls_anuncios").select("*").eq("status", "aprovado").eq("categoria", "cupom")
      .gte("validade", hoje).order("destaque", { ascending: false }).order("validade", { ascending: true }).limit(400);
    if (error) throw error; return data ?? [];
  }, []);
  const { data: avulso } = useQuery<Anuncio | null>(async () => s.a ? (await db.from("cls_anuncios").select("*").eq("id", s.a).maybeSingle()).data : null, [s.a]);

  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [cidade, setCidade] = useState("");
  const cidades = useMemo(() => Array.from(new Set((data ?? []).map((a) => a.cidade.trim()).filter(Boolean))).sort((x, y) => x.localeCompare(y, "pt-BR")), [data]);
  useEffect(() => {
    const c = familia?.cidade && cidades.find((x) => x.toLowerCase() === String(familia.cidade).toLowerCase());
    if (c) setCidade((v) => v || c);
  }, [cidades.length]);

  const lista = useMemo(() => {
    const termo = norm(q.trim());
    return (data ?? []).filter((a) => {
      if (tipo && a.subcategoria !== tipo) return false;
      if (cidade && a.cidade.trim().toLowerCase() !== cidade.toLowerCase()) return false;
      if (termo && !norm([a.titulo, a.descricao, a.estabelecimento, a.subcategoria, a.cidade, a.bairro].filter(Boolean).join(" ")).includes(termo)) return false;
      return true;
    });
  }, [data, q, tipo, cidade]);

  const ir = (b: Busca) => nav({ to: "/cupons", search: b as any });
  const sel = s.a ? (data ?? []).find((a) => a.id === s.a) ?? avulso : null;
  const pill = "tap shrink-0 rounded-full border px-3 text-sm font-semibold";

  return (
    <div className="flex flex-col gap-4">
      <header className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#C2410C,#F47A16)] px-4 pb-5 pt-4 text-white sm:px-6">
        <span aria-hidden="true" className="faixa-marca absolute inset-x-0 bottom-0 h-1.5" />
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20"><BadgePercent className="h-7 w-7" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">Parceiros do AMPARO</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">Cupons e descontos</h1>
          <p className="mt-0.5 hidden text-sm text-white/90 sm:block">Descontos de estabelecimentos parceiros para famílias atípicas.</p>
        </div>
      </header>

      <form role="search" onSubmit={(e) => e.preventDefault()} className="flex items-center gap-2 rounded-full border-2 border-coral/30 bg-card p-1.5 pl-4 shadow-card focus-within:border-coral">
        <Search className="h-5 w-5 shrink-0 text-coral" aria-hidden="true" />
        <label htmlFor="cup-busca" className="sr-only">Buscar cupons</label>
        <input id="cup-busca" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar farmácia, mercado, loja…" className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none" />
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Tipo de estabelecimento">
        <button onClick={() => setTipo("")} aria-pressed={!tipo} className={cn(pill, !tipo ? "border-coral bg-coral text-white" : "border-border bg-card text-navy")}>Todos</button>
        {SUBCATEGORIAS.cupom.map((t) => (
          <button key={t} onClick={() => setTipo(tipo === t ? "" : t)} aria-pressed={tipo === t} className={cn(pill, tipo === t ? "border-coral bg-coral text-white" : "border-border bg-card text-navy")}>{t}</button>
        ))}
      </div>

      {cidades.length > 1 && (
        <div>
          <label className="sr-only" htmlFor="cup-cidade">Cidade</label>
          <select id="cup-cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} className={cn(pill, "bg-card", cidade ? "border-coral text-coral" : "border-border text-navy")}>
            <option value="">Todas as cidades</option>{cidades.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}

      {loading ? <Carregando /> : erro ? (
        <Vazio icon={XCircle} titulo="Não foi possível carregar" texto="Verifique sua internet e tente de novo."><Btn v="outline" onClick={recarregar}>Tentar de novo</Btn></Vazio>
      ) : lista.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={`${lista.length} cupons`}>
          {lista.map((a) => <CupomCard key={a.id} a={a} onAbrir={() => ir({ a: a.id })} />)}
        </section>
      ) : (
        <Vazio icon={Ticket} titulo={q || tipo || cidade ? "Nenhum cupom com esses filtros" : "Ainda não há cupons disponíveis"}
          texto={q || tipo || cidade ? "Tente outra palavra, outro tipo ou outra cidade." : "Os parceiros do AMPARO publicam descontos aqui. Volte em breve."}>
          {(q || tipo || cidade) && <Btn v="outline" onClick={() => { setQ(""); setTipo(""); setCidade(""); }}>Limpar filtros</Btn>}
        </Vazio>
      )}

      <div className="flex flex-col items-start gap-2 rounded-3xl border border-coral/30 bg-coral-soft p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold text-navy">Tem um estabelecimento?</h2>
          <p className="text-sm text-muted-foreground">Ofereça um desconto para as famílias atípicas. É gratuito e a equipe confere antes de publicar.</p>
        </div>
        <button onClick={() => nav({ to: "/classificados", search: { aba: "publicar" } as any })} className={cn(btn.base, "bg-coral text-white hover:bg-coral/90")}><Plus className="h-5 w-5" /> OFERECER CUPOM</button>
      </div>

      {sel && <DetalheAnuncio a={sel} onFechar={() => ir({})}
        onConversa={(c) => nav({ to: "/classificados", search: { conversa: c } as any })}
        onEditar={() => nav({ to: "/classificados", search: { aba: "publicar", editar: sel.id } as any })} />}
      {s.a && !sel && !loading && avulso === null && <Aviso tom="amber">Este cupom não está mais disponível.</Aviso>}
    </div>
  );
}

function CupomCard({ a, onAbrir }: { a: Anuncio; onAbrir: () => void }) {
  const d = diasAte(a.validade);
  const esgotado = a.cupom_limite != null && a.cupom_usos >= a.cupom_limite;
  const restam = a.cupom_limite != null ? Math.max(0, a.cupom_limite - a.cupom_usos) : null;
  return (
    <button onClick={onAbrir} className={cn("relative flex overflow-hidden rounded-2xl border-2 border-dashed bg-card text-left shadow-card transition hover:border-coral", esgotado ? "border-border opacity-60" : "border-coral/50")}>
      <span className="grid w-16 shrink-0 place-items-center bg-coral text-white"><BadgePercent className="h-8 w-8" /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <span className="truncate text-[11px] font-bold uppercase tracking-wide text-coral">{a.estabelecimento || a.subcategoria || "Cupom"}</span>
        <span className="line-clamp-2 font-display text-base font-bold leading-snug text-navy">{a.titulo}</span>
        <span className="text-xs text-muted-foreground">
          {a.cidade}{a.bairro ? ` · ${a.bairro}` : ""}
        </span>
        <span className={cn("mt-1 self-start rounded-full px-2.5 py-0.5 text-xs font-bold", esgotado ? "bg-muted text-muted-foreground" : d <= 7 ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
          {esgotado ? "Esgotado" : d <= 7 ? `Vence em ${d} dia${d === 1 ? "" : "s"}` : `Válido até ${fData(a.validade + "T12:00")}`}
          {!esgotado && restam != null ? ` · ${restam} restante${restam === 1 ? "" : "s"}` : ""}
        </span>
      </span>
    </button>
  );
}
