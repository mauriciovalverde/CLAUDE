import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LocateFixed, MapPin, PlayCircle, Plus, Search, Stethoscope, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { MapView } from "@/components/app/MapView";
import { Btn, Campo, Carregando, Vazio, btn, inputCls, textareaCls } from "@/components/app/kit";
import { CartaoProfissional, type ItemDiretorio } from "@/components/app/diretorio";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { CATEGORIAS_DIRETORIO, UFS, digits, fmtTel, nomeCategoria } from "@/lib/br";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buscar")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : undefined }) as { q?: string },
  component: () => <AppShell><Buscar /></AppShell>,
});

type Aba = "lista" | "mapa" | "videos" | "noticias";

function Buscar() {
  const { q: q0 = "" } = Route.useSearch();
  const { user, familia } = useAuth();
  const [q, setQ] = useState(q0);
  const [cat, setCat] = useState("");
  const [cidade, setCidade] = useState<string>("");
  const [uf, setUf] = useState<string>("");
  const [online, setOnline] = useState(false);
  const [sus, setSus] = useState(false);
  const [soFav, setSoFav] = useState(false);
  const [aba, setAba] = useState<Aba>("lista");
  const [modalLocal, setModalLocal] = useState(false);
  const [indicar, setIndicar] = useState(false);
  const [centro, setCentro] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (familia?.cidade && !cidade) { setCidade(String(familia.cidade)); setUf(String(familia.uf ?? "")); }
  }, [familia]);

  const { data: itens, loading } = useQuery<ItemDiretorio[]>(async () => {
    const { data } = await db.from("diretorio").select("*").eq("validado", true).order("nacional").order("nome");
    return data ?? [];
  }, []);
  const favs = useQuery<string[]>(async () => {
    if (!user) return [];
    const { data } = await db.from("favoritos").select("diretorio_id").eq("user_id", user.id);
    return (data ?? []).map((x: any) => x.diretorio_id);
  }, [user?.id]);
  const midia = useQuery<any[]>(async () => {
    const { data } = await db.from("biblioteca").select("*").order("created_at", { ascending: false });
    return data ?? [];
  }, []);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const lista = useMemo(() => {
    const t = norm(q.trim());
    const r = (itens ?? []).filter((p) =>
      (!cat || p.categoria === cat) && (!online || p.atende_online) && (!sus || p.sus) &&
      (!soFav || (favs.data ?? []).includes(p.id)) &&
      (!t || norm([p.nome, p.especialidade, p.descricao, p.cidade, nomeCategoria(p.categoria)].join(" ")).includes(t)));
    // Prioriza a cidade escolhida; serviços nacionais aparecem sempre
    const naCidade = (p: ItemDiretorio) => !cidade || p.nacional || norm(p.cidade ?? "") === norm(cidade);
    return [...r.filter((p) => naCidade(p) && !p.nacional), ...r.filter((p) => !naCidade(p)), ...r.filter((p) => p.nacional)];
  }, [itens, q, cat, online, sus, soFav, favs.data, cidade]);

  async function toggleFav(id: string) {
    if (!user) return;
    const tem = (favs.data ?? []).includes(id);
    if (tem) await db.from("favoritos").delete().eq("user_id", user.id).eq("diretorio_id", id);
    else await db.from("favoritos").insert({ user_id: user.id, diretorio_id: id });
    favs.setData(tem ? (favs.data ?? []).filter((x) => x !== id) : [...(favs.data ?? []), id]);
  }

  function usarLocalizacao() {
    setModalLocal(false);
    if (!navigator.geolocation) return toast.error("Seu aparelho não permite localização.");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setCentro([latitude, longitude]);
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=pt-BR`);
        const j = await r.json();
        const c = j.address?.city || j.address?.town || j.address?.municipality || j.address?.village;
        if (c) setCidade(c);
        const iso = j.address?.["ISO3166-2-lvl4"] as string | undefined;
        if (iso) setUf(iso.split("-")[1]);
      } catch { /* mantém a cidade atual */ }
    }, () => toast.error("Não foi possível obter sua localização. Escolha a cidade manualmente."), { timeout: 10000 });
  }

  const pontos = lista.filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.id, nome: p.nome, lat: p.lat!, lng: p.lng!, sub: [p.especialidade, p.cidade].filter(Boolean).join(" · ") }));
  const videos = (midia.data ?? []).filter((b) => ["video", "entrevista"].includes(b.tipo) && (!q || norm(b.titulo).includes(norm(q))));
  const noticias = (midia.data ?? []).filter((b) => !["video", "entrevista"].includes(b.tipo) && (!q || norm(b.titulo + " " + (b.descricao ?? "")).includes(norm(q))));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[2rem] font-extrabold leading-tight sm:text-4xl">
        Encontre especialistas <span className="text-primary">perto de você</span>
      </h1>
      <form onSubmit={(e) => e.preventDefault()} role="search" className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-5 shadow-card">
        <label htmlFor="q" className="sr-only">Buscar</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Terapia ABA, fonoaudióloga, CAPSi…" className="min-h-12 min-w-0 flex-1 bg-transparent outline-none" />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Limpar busca" className="p-2 text-muted-foreground"><X className="h-5 w-5" /></button>}
        <button type="button" onClick={() => setModalLocal(true)} aria-label="Usar minha localização" className="p-2 text-primary"><MapPin className="h-5 w-5" /></button>
        <button className="grid h-12 w-12 place-items-center rounded-full bg-primary text-white" aria-label="Buscar"><Search className="h-5 w-5" /></button>
      </form>

      <div className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto border-b border-border px-4" role="tablist">
        {([["lista", "Lista"], ["mapa", "Mapa"], ["videos", "Vídeos"], ["noticias", "Notícias"]] as [Aba, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={cn("tap shrink-0 border-b-2 px-1 font-semibold", aba === k ? "border-primary text-primary" : "border-transparent text-navy")}>{l}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-primary">{cidade ? `${cidade}${uf ? ", " + uf : ""}` : "Todas as cidades"}</span>
        <button onClick={() => setModalLocal(true)} className="font-semibold text-primary underline-offset-2 hover:underline">Atualizar localização</button>
        <span className="text-muted-foreground">Aproximadamente <b className="text-navy">{aba === "videos" ? videos.length : aba === "noticias" ? noticias.length : lista.length}</b> resultado(s)</span>
      </div>

      {(aba === "lista" || aba === "mapa") && (
        <>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <button onClick={() => setCat("")} className={cn("tap shrink-0 rounded-full border px-4 text-sm font-semibold", !cat ? "border-primary bg-primary text-white" : "border-border bg-card text-navy")}>Todos</button>
            {CATEGORIAS_DIRETORIO.map(([k, l]) => (
              <button key={k} onClick={() => setCat(cat === k ? "" : k)} className={cn("tap shrink-0 rounded-full border px-4 text-sm font-semibold", cat === k ? "border-primary bg-primary text-white" : "border-border bg-card text-navy")}>{l}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="tap inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold"><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)]" /> Atende online</label>
            <label className="tap inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold"><input type="checkbox" checked={sus} onChange={(e) => setSus(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)]" /> SUS / gratuito</label>
            <label className="tap inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold"><input type="checkbox" checked={soFav} onChange={(e) => setSoFav(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)]" /> Favoritos</label>
            <select aria-label="Estado" value={uf} onChange={(e) => setUf(e.target.value)} className="tap rounded-full border border-border bg-card px-3 text-sm font-semibold">
              <option value="">UF</option>{UFS.map((u) => <option key={u}>{u}</option>)}
            </select>
            <input aria-label="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" className="tap w-36 rounded-full border border-border bg-card px-4 text-sm" />
          </div>
        </>
      )}

      {aba === "lista" && (loading ? <Carregando /> : lista.length ? (
        <div className="grid gap-3 md:grid-cols-2">{lista.map((p) => <CartaoProfissional key={p.id} p={p} fav={(favs.data ?? []).includes(p.id)} onFav={() => toggleFav(p.id)} />)}</div>
      ) : (
        <Vazio icon={Search} titulo="Nenhum resultado" texto="Ainda não há profissionais validados com esses filtros na sua região. Indique um serviço que você conhece.">
          <Btn v="soft" onClick={() => setIndicar(true)}>Indicar serviço</Btn>
        </Vazio>
      ))}

      {aba === "mapa" && (
        <div className="flex flex-col gap-3">
          <MapView pontos={pontos} centro={centro} />
          {!pontos.length && <p className="text-sm text-muted-foreground">Nenhum serviço com endereço no mapa para esses filtros. Os serviços nacionais (192, 188, 135…) atendem por telefone.</p>}
          <button onClick={() => setModalLocal(true)} className={cn(btn.base, btn.outline, "self-start")}><LocateFixed className="h-4 w-4" /> Centralizar onde estou</button>
        </div>
      )}

      {aba === "videos" && (videos.length ? (
        <div className="grid gap-3 sm:grid-cols-2">{videos.map((v) => (
          <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" className="card-soft flex items-center gap-3 p-3">
            <span className="grid aspect-video w-28 shrink-0 place-items-center rounded-xl bg-primary text-white"><PlayCircle className="h-7 w-7" /></span>
            <span className="min-w-0"><b className="text-navy">{v.titulo}</b><span className="block text-sm text-muted-foreground">{v.categoria}</span></span>
          </a>))}</div>
      ) : <Vazio icon={PlayCircle} titulo="Nenhum vídeo" texto="A equipe ainda não publicou vídeos sobre esse tema." />)}

      {aba === "noticias" && (noticias.length ? (
        <div className="flex flex-col gap-3">{noticias.map((b) => (
          <a key={b.id} href={b.url ?? "#"} target="_blank" rel="noopener noreferrer" className="card-soft flex flex-col gap-1 p-4">
            <span className="text-xs font-bold uppercase text-primary">{b.categoria}</span><b className="text-lg text-navy">{b.titulo}</b><span className="text-sm text-muted-foreground">{b.descricao}</span>
          </a>))}</div>
      ) : <Vazio icon={Search} titulo="Nada encontrado" />)}

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Btn v="outline" onClick={() => setIndicar(true)}><Plus className="h-4 w-4" /> Indicar um serviço</Btn>
        <Link to="/sou-profissional" className={cn(btn.base, btn.soft)}><Stethoscope className="h-4 w-4" /> Sou profissional</Link>
      </div>

      {modalLocal && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-navy/50 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="loc-t" onClick={(e) => e.target === e.currentTarget && setModalLocal(false)}>
          <div className="w-full max-w-md rounded-3xl bg-card p-6 text-center shadow-float">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary-soft"><MapPin className="h-10 w-10 text-coral" /></span>
            <h2 id="loc-t" className="mt-4 font-display text-2xl font-extrabold">Encontre apoio perto de você</h2>
            <p className="mt-2 text-sm text-muted-foreground">Para mostrar <b className="text-primary">profissionais e serviços especializados</b> na sua região, precisamos acessar sua localização.</p>
            <ul className="mt-4 flex flex-col gap-2 text-left text-sm">
              <li className="rounded-xl bg-primary-soft p-3">Clínicas e terapeutas especializados</li>
              <li className="rounded-xl bg-primary-soft p-3">Escolas e centros de apoio inclusivos</li>
              <li className="rounded-xl bg-primary-soft p-3">Comunidades e grupos de apoio familiares</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Sua localização é usada apenas para a busca e nunca é compartilhada.</p>
            <Btn onClick={usarLocalizacao} className="mt-4 w-full">Permitir localização</Btn>
            <button onClick={() => setModalLocal(false)} className="tap mt-1 w-full font-semibold text-muted-foreground">Agora não</button>
          </div>
        </div>
      )}
      {indicar && <IndicarServico onClose={() => setIndicar(false)} />}
    </div>
  );
}

function IndicarServico({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState({ nome: "", categoria: "clinicas", cidade: "", uf: "BA", telefone: "", observacao: "" });
  const [erro, setErro] = useState("");
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim() || !f.cidade.trim()) return setErro("Informe o nome e a cidade.");
    const { error } = await db.from("sugestoes_diretorio").insert({ ...f, user_id: user!.id, telefone: digits(f.telefone) || null });
    if (error) return setErro("Não foi possível enviar: " + error.message);
    toast.success("Indicação enviada. A equipe vai conferir antes de publicar.");
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-navy/50 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="ind-t">
      <form onSubmit={enviar} className="flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-3xl bg-card p-6">
        <h2 id="ind-t" className="font-display text-2xl font-extrabold">Indicar serviço</h2>
        <p className="text-sm text-muted-foreground">A equipe confere antes de publicar.</p>
        <Campo id="i-nome" label="Nome do serviço ou profissional" obrigatorio><input id="i-nome" className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <Campo id="i-cat" label="Categoria" obrigatorio><select id="i-cat" className={inputCls} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{CATEGORIAS_DIRETORIO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Campo id="i-cid" label="Cidade" obrigatorio><input id="i-cid" className={inputCls} value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></Campo>
          <Campo id="i-uf" label="UF" obrigatorio><select id="i-uf" className={inputCls} value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value })}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Campo>
        </div>
        <Campo id="i-tel" label="Telefone"><input id="i-tel" className={inputCls} value={f.telefone} onChange={(e) => setF({ ...f, telefone: fmtTel(e.target.value) })} /></Campo>
        <Campo id="i-obs" label="Por que você indica?"><textarea id="i-obs" className={textareaCls} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} maxLength={500} /></Campo>
        {erro && <p className="text-sm font-semibold text-emergency" role="alert">{erro}</p>}
        <div className="flex justify-end gap-2"><Btn v="ghost" type="button" onClick={onClose}>Cancelar</Btn><Btn type="submit">Enviar indicação</Btn></div>
      </form>
    </div>
  );
}
