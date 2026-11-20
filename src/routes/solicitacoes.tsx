import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlarmClock, CheckCircle2, ChevronLeft, ClipboardList, FileText, Paperclip, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Btn, Campo, Card, Carregando, Chip, Opcoes, Vazio, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { fData, fDataHora } from "@/lib/br";
import { ABERTOS, AREAS, type Area, STATUS_SOL, type Solicitacao, area, diasAte, statusSol } from "@/lib/solicitacoes";
import { cn } from "@/lib/utils";

type Busca = { s?: string; novo?: string; area?: string };
export const Route = createFileRoute("/solicitacoes")({
  head: () => ({ meta: [{ title: "Minhas Solicitações · AMPARO" }] }),
  validateSearch: (x: Record<string, unknown>): Busca => ({ s: typeof x.s === "string" ? x.s : undefined, novo: typeof x.novo === "string" ? x.novo : undefined, area: typeof x.area === "string" ? x.area : undefined }),
  component: () => <AppShell><Solicitacoes /></AppShell>,
});

function Solicitacoes() {
  const b = Route.useSearch();
  const nav = useNavigate();
  const ir = (x: Busca) => nav({ to: "/solicitacoes", search: x as any });
  useEffect(() => { db.rpc("sol_lembretes").then(() => {}); }, []);
  if (b.s) return <Detalhe id={b.s} onVoltar={() => ir({})} />;
  if (b.novo) return <Nova areaInicial={(b.area as Area) || null} onFeito={(id) => ir({ s: id })} onCancelar={() => ir({})} />;
  return <Painel onAbrir={(id) => ir({ s: id })} onNova={(a) => ir({ novo: "1", area: a })} />;
}

function Painel({ onAbrir, onNova }: { onAbrir: (id: string) => void; onNova: (a?: string) => void }) {
  const { data, loading } = useQuery<Solicitacao[]>(async () => (await db.from("sol_solicitacoes").select("*").order("atualizado_em", { ascending: false })).data ?? [], []);
  const [filtro, setFiltro] = useState<string>("");
  const [ver, setVer] = useState<"abertas" | "todas">("abertas");
  const l = data ?? [];
  const abertas = l.filter((s) => ABERTOS.includes(s.status) || s.status === "rascunho");
  const vencendo = l.filter((s) => s.prazo && ABERTOS.includes(s.status) && diasAte(s.prazo) <= s.lembrete_dias);
  const concluidas = l.filter((s) => ["respondido", "concluido"].includes(s.status));
  const lista = (ver === "abertas" ? abertas : l).filter((s) => !filtro || s.area === filtro);
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-[1.9rem] font-extrabold leading-tight">Minhas <span className="text-primary">Solicitações</span></h1>
          <p className="text-muted-foreground">Exames, consultas, pedidos à escola e requerimentos ao poder público, com protocolo, prazo e histórico.</p></div>
        <Btn onClick={() => onNova()}><Plus className="h-5 w-5" /> Nova</Btn>
      </header>
      <div className="grid grid-cols-3 gap-2">
        {[["Pendentes", abertas.length, "text-primary", ClipboardList], ["Vencendo", vencendo.length, "text-emergency", AlarmClock], ["Concluídas", concluidas.length, "text-success", CheckCircle2]].map(([t, n, c, I]: any) => (
          <Card key={t} className="flex flex-col gap-1 p-3"><I className={cn("h-5 w-5", c)} /><b className={cn("font-display text-2xl font-extrabold", c)}>{n}</b><span className="text-xs font-semibold text-muted-foreground">{t}</span></Card>
        ))}
      </div>
      {vencendo.length > 0 && <Card className="flex flex-col gap-2 border-emergency/40 bg-emergency-soft p-4">
        <b className="flex items-center gap-2 text-emergency"><AlarmClock className="h-5 w-5" /> Prazos próximos ou vencidos</b>
        {vencendo.map((s) => { const d = diasAte(s.prazo!); return <button key={s.id} onClick={() => onAbrir(s.id)} className="text-left text-sm"><b>{s.titulo}</b> · {d < 0 ? `venceu há ${-d} dia(s)` : d === 0 ? "vence hoje" : `vence em ${d} dia(s)`}</button>; })}
      </Card>}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        <button onClick={() => setFiltro("")} className={cn("tap shrink-0 rounded-full border px-4 text-sm font-semibold", !filtro ? "border-primary bg-primary text-white" : "border-border bg-card")}>Todas as áreas</button>
        {AREAS.map((a) => <button key={a.k} onClick={() => setFiltro(a.k)} className={cn("tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", filtro === a.k ? "border-primary bg-primary text-white" : "border-border bg-card")}><a.I className="h-4 w-4" /> {a.nome}</button>)}
      </div>
      <div className="flex gap-3 text-sm font-semibold">
        <button onClick={() => setVer("abertas")} className={ver === "abertas" ? "text-primary underline" : "text-muted-foreground"}>Em andamento</button>
        <button onClick={() => setVer("todas")} className={ver === "todas" ? "text-primary underline" : "text-muted-foreground"}>Todas</button>
      </div>
      {loading ? <Carregando /> : !lista.length ? (
        <Vazio icon={ClipboardList} titulo={l.length ? "Nada em andamento aqui" : "Nenhuma solicitação ainda"} texto="Registre um pedido de exame, uma solicitação à escola ou um requerimento e acompanhe protocolo, prazo e respostas.">
          <div className="flex flex-wrap justify-center gap-2">{AREAS.map((a) => <Btn key={a.k} v="soft" className="min-h-10" onClick={() => onNova(a.k)}><a.I className="h-4 w-4" /> {a.nome}</Btn>)}</div>
        </Vazio>
      ) : (
        <ul className="flex flex-col gap-2">{lista.map((s) => { const A = area(s.area); const [, st, tom] = statusSol(s.status); const d = s.prazo ? diasAte(s.prazo) : null; return (
          <li key={s.id}><button onClick={() => onAbrir(s.id)} className="card-soft flex w-full items-center gap-3 p-3 text-left hover:border-primary">
            <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", A.tom)}><A.I className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5"><Chip tom={tom}>{st}</Chip><span className="text-xs text-muted-foreground">{s.tipo}</span></span>
              <b className="mt-0.5 block truncate text-navy">{s.titulo}</b>
              <span className="block truncate text-xs text-muted-foreground">{[s.orgao, s.protocolo && `Prot. ${s.protocolo}`].filter(Boolean).join(" · ") || `Aberta em ${fData(s.aberta_em + "T12:00")}`}</span>
            </span>
            {d != null && ABERTOS.includes(s.status) && <span className={cn("shrink-0 rounded-full px-2 py-1 text-xs font-bold", d < 0 ? "bg-emergency text-white" : d <= s.lembrete_dias ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground")}>{d < 0 ? "vencido" : `${d}d`}</span>}
          </button></li>
        ); })}</ul>
      )}
      <Link to="/escola-inclusiva" className="card-soft flex items-center gap-3 p-4 hover:border-primary"><FileText className="h-6 w-6 text-primary" /><span className="flex-1"><b className="block text-navy">Escola Inclusiva</b><span className="text-sm text-muted-foreground">Modelos prontos de pedido de apoio escolar, AEE, adaptações e denúncia de recusa de matrícula</span></span></Link>
    </div>
  );
}

function Nova({ areaInicial, onFeito, onCancelar }: { areaInicial: Area | null; onFeito: (id: string) => void; onCancelar: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState({ area: areaInicial ?? "", tipo: "", titulo: "", orgao: "", protocolo: "", prazo: "", status: "aguardando_protocolo", notas: "" });
  const [salvando, setSalvando] = useState(false);
  const A = f.area ? area(f.area) : null;
  async function salvar() {
    if (!f.area || !f.tipo) return toast.error("Escolha a área e o tipo.");
    if (f.titulo.trim().length < 3) return toast.error("Dê um título curto (ex.: Ressonância do Pedro).");
    setSalvando(true);
    const { data, error } = await db.from("sol_solicitacoes").insert({ user_id: user!.id, area: f.area, tipo: f.tipo, titulo: f.titulo.trim(), orgao: f.orgao.trim() || null, protocolo: f.protocolo.trim() || null, prazo: f.prazo || null, status: f.protocolo.trim() ? "protocolado" : f.status, notas: f.notas.trim() || null }).select("id").single();
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação registrada."); onFeito(data.id);
  }
  return (
    <div className="flex flex-col gap-4">
      <button onClick={onCancelar} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Minhas solicitações</button>
      <h1 className="font-display text-2xl font-extrabold">Nova solicitação</h1>
      <Campo id="ns-a" label="Área" obrigatorio>
        <div className="grid grid-cols-3 gap-2">{AREAS.map((a) => (
          <button key={a.k} onClick={() => setF({ ...f, area: a.k, tipo: "" })} aria-pressed={f.area === a.k} className={cn("card-soft flex flex-col items-center gap-1 p-3 text-sm font-semibold", f.area === a.k && "border-primary ring-2 ring-primary/20")}>
            <span className={cn("grid h-10 w-10 place-items-center rounded-xl", a.tom)}><a.I className="h-5 w-5" /></span>{a.nome}</button>
        ))}</div>
      </Campo>
      {A && <Campo id="ns-t" label="Tipo" obrigatorio><Opcoes nome="Tipo" valores={A.tipos} valor={f.tipo} onChange={(v) => setF({ ...f, tipo: v })} /></Campo>}
      {f.tipo && (<>
        <Campo id="ns-ti" label="Título" obrigatorio dica="Algo que você reconheça rápido. Ex.: Pedido de ressonância – UBS Centro"><input id="ns-ti" className={inputCls} maxLength={140} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="ns-o" label="Órgão ou instituição"><input id="ns-o" className={inputCls} maxLength={140} placeholder="UBS, escola, INSS, Secretaria…" value={f.orgao} onChange={(e) => setF({ ...f, orgao: e.target.value })} /></Campo>
          <Campo id="ns-p" label="Número de protocolo"><input id="ns-p" className={inputCls} maxLength={80} value={f.protocolo} onChange={(e) => setF({ ...f, protocolo: e.target.value })} /></Campo>
          <Campo id="ns-pz" label="Prazo previsto" dica="Avisamos no sino perto do vencimento."><input id="ns-pz" type="date" className={inputCls} value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} /></Campo>
          {!f.protocolo && <Campo id="ns-s" label="Situação"><select id="ns-s" className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUS_SOL.filter((s) => !["respondido", "concluido"].includes(s[0])).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>}
        </div>
        <Campo id="ns-n" label="Anotações"><textarea id="ns-n" className={textareaCls} maxLength={4000} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Campo>
        <p className="text-xs text-muted-foreground">Só você vê suas solicitações e anexos. A equipe do AMPARO não tem acesso.</p>
        <Btn className="self-start" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar solicitação"}</Btn>
      </>)}
    </div>
  );
}

const EVENTO: Record<string, string> = { criada: "Criada", status: "Situação", nota: "Anotação", resposta: "Resposta recebida", reuniao: "Reunião", protocolo: "Protocolo", anexo: "Anexo", prazo: "Prazo" };

function Detalhe({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const { user } = useAuth();
  const { data, loading, recarregar } = useQuery(async () => {
    const [s, e, a] = await Promise.all([db.from("sol_solicitacoes").select("*").eq("id", id).maybeSingle(), db.from("sol_eventos").select("*").eq("solicitacao_id", id).order("created_at"), db.from("sol_anexos").select("*").eq("solicitacao_id", id).order("created_at")]);
    return { s: s.data as Solicitacao | null, ev: (e.data ?? []) as any[], anx: (a.data ?? []) as any[] };
  }, [id]);
  const [ev, setEv] = useState({ tipo: "nota", texto: "", data: new Date().toISOString().slice(0, 10) });
  const [edit, setEdit] = useState<Partial<Solicitacao> | null>(null);
  const [subindo, setSubindo] = useState(false);
  const arq = useRef<HTMLInputElement>(null);
  if (loading || !data) return <Carregando />;
  const s = data.s;
  if (!s) return <Vazio icon={ClipboardList} titulo="Solicitação não encontrada"><Btn v="outline" onClick={onVoltar}>Voltar</Btn></Vazio>;
  const A = area(s.area); const [, st, tom] = statusSol(s.status); const d = s.prazo ? diasAte(s.prazo) : null;
  async function mudar(campos: Partial<Solicitacao>) { const { error } = await db.from("sol_solicitacoes").update(campos).eq("id", id); if (error) return toast.error(error.message); toast.success("Atualizado."); setEdit(null); recarregar(); }
  async function addEvento() {
    if (!ev.texto.trim()) return toast.error("Escreva o registro.");
    const { error } = await db.from("sol_eventos").insert({ solicitacao_id: id, user_id: user!.id, tipo: ev.tipo, texto: ev.texto.trim(), data: ev.data });
    if (error) return toast.error(error.message);
    if (ev.tipo === "resposta" && ABERTOS.includes(s!.status)) await db.from("sol_solicitacoes").update({ status: "respondido" }).eq("id", id);
    setEv({ ...ev, texto: "" }); recarregar();
  }
  async function anexar(files: FileList | null) {
    if (!files?.length) return; setSubindo(true);
    for (const f of Array.from(files)) {
      if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(f.type)) { toast.error(`${f.name}: envie foto ou PDF.`); continue; }
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name}: maior que 20 MB.`); continue; }
      const path = `${user!.id}/${id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]+/g, "_").slice(-60)}`;
      const up = await db.storage.from("solicitacoes").upload(path, f, { contentType: f.type });
      if (up.error) { toast.error(up.error.message); continue; }
      const { error } = await db.from("sol_anexos").insert({ solicitacao_id: id, user_id: user!.id, path, nome: f.name, mime: f.type, tamanho: f.size });
      if (error) toast.error(error.message); else await db.from("sol_eventos").insert({ solicitacao_id: id, user_id: user!.id, tipo: "anexo", texto: f.name });
    }
    setSubindo(false); recarregar();
  }
  async function abrir(a: any) { const { data: u } = await db.storage.from("solicitacoes").createSignedUrl(a.path, 600); if (u?.signedUrl) window.open(u.signedUrl, "_blank", "noopener"); }
  async function tirarAnexo(a: any) { if (!confirm(`Apagar ${a.nome}?`)) return; await db.storage.from("solicitacoes").remove([a.path]); await db.from("sol_anexos").delete().eq("id", a.id); recarregar(); }
  async function excluir() { if (!confirm("Excluir esta solicitação, o histórico e os anexos?")) return; if (data!.anx.length) await db.storage.from("solicitacoes").remove(data!.anx.map((a) => a.path)); await db.from("sol_solicitacoes").delete().eq("id", id); toast.success("Excluída."); onVoltar(); }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onVoltar} className="no-print tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Minhas solicitações</button>
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2"><span className={cn("grid h-9 w-9 place-items-center rounded-xl", A.tom)}><A.I className="h-5 w-5" /></span><Chip tom={tom}>{st}</Chip><span className="text-sm text-muted-foreground">{A.nome} · {s.tipo}</span></div>
        <h1 className="font-display text-2xl font-extrabold">{s.titulo}</h1>
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <div><dt className="inline font-semibold">Órgão: </dt><dd className="inline">{s.orgao || "—"}</dd></div>
          <div><dt className="inline font-semibold">Protocolo: </dt><dd className="inline">{s.protocolo || "—"}</dd></div>
          <div><dt className="inline font-semibold">Aberta em: </dt><dd className="inline">{fData(s.aberta_em + "T12:00")}</dd></div>
          <div><dt className="inline font-semibold">Prazo: </dt><dd className="inline">{s.prazo ? `${fData(s.prazo + "T12:00")}${d != null && ABERTOS.includes(s.status) ? (d < 0 ? " (vencido)" : ` (em ${d} dia${d === 1 ? "" : "s"})`) : ""}` : "—"}</dd></div>
        </dl>
        {s.notas && <p className="whitespace-pre-line text-sm">{s.notas}</p>}
        <div className="no-print flex flex-wrap gap-2 pt-1">
          <select aria-label="Mudar situação" className={cn(inputCls, "min-h-10 w-auto text-sm")} value={s.status} onChange={(e) => mudar({ status: e.target.value })}>{STATUS_SOL.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <Btn v="soft" className="min-h-10" onClick={() => setEdit({ orgao: s.orgao, protocolo: s.protocolo, prazo: s.prazo, titulo: s.titulo, notas: s.notas, lembrete_dias: s.lembrete_dias })}>Editar dados</Btn>
          <Btn v="outline" className="min-h-10" onClick={() => window.print()}><Printer className="h-4 w-4" /> PDF</Btn>
        </div>
      </Card>
      {edit && <Card className="no-print flex flex-col gap-3">
        <Campo id="ed-t" label="Título" obrigatorio><input id="ed-t" className={inputCls} value={edit.titulo ?? ""} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="ed-o" label="Órgão"><input id="ed-o" className={inputCls} value={edit.orgao ?? ""} onChange={(e) => setEdit({ ...edit, orgao: e.target.value })} /></Campo>
          <Campo id="ed-p" label="Protocolo"><input id="ed-p" className={inputCls} value={edit.protocolo ?? ""} onChange={(e) => setEdit({ ...edit, protocolo: e.target.value })} /></Campo>
          <Campo id="ed-z" label="Prazo"><input id="ed-z" type="date" className={inputCls} value={edit.prazo ?? ""} onChange={(e) => setEdit({ ...edit, prazo: e.target.value })} /></Campo>
          <Campo id="ed-l" label="Avisar quantos dias antes"><input id="ed-l" type="number" min={0} max={30} className={inputCls} value={edit.lembrete_dias ?? 3} onChange={(e) => setEdit({ ...edit, lembrete_dias: Number(e.target.value) })} /></Campo>
        </div>
        <Campo id="ed-n" label="Anotações"><textarea id="ed-n" className={textareaCls} value={edit.notas ?? ""} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} /></Campo>
        <div className="flex gap-2"><Btn onClick={() => mudar({ ...edit, orgao: edit.orgao || null, protocolo: edit.protocolo || null, prazo: edit.prazo || null, notas: edit.notas || null })}>Salvar</Btn><Btn v="ghost" onClick={() => setEdit(null)}>Cancelar</Btn></div>
      </Card>}
      {s.documento && <Card className="flex flex-col gap-2"><h2 className="font-display text-lg font-bold">Documento gerado</h2><pre className="whitespace-pre-wrap font-sans text-sm">{s.documento}</pre></Card>}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Documentos e comprovantes</h2>
          <Btn v="soft" className="no-print min-h-10" disabled={subindo} onClick={() => arq.current?.click()}><Paperclip className="h-4 w-4" /> {subindo ? "Enviando…" : "Anexar"}</Btn></div>
        <input ref={arq} type="file" multiple accept="image/*,application/pdf" hidden onChange={(e) => { anexar(e.target.files); e.target.value = ""; }} />
        {!data.anx.length ? <p className="text-sm text-muted-foreground">Guarde aqui o pedido médico, o comprovante de protocolo e as respostas. Só você tem acesso.</p>
          : <ul className="flex flex-col gap-1">{data.anx.map((a) => <li key={a.id} className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-coral" /><button onClick={() => abrir(a)} className="flex-1 truncate text-left font-semibold text-primary underline">{a.nome}</button><span className="text-xs text-muted-foreground">{fData(a.created_at)}</span><button onClick={() => tirarAnexo(a)} aria-label={`Apagar ${a.nome}`} className="no-print text-muted-foreground hover:text-emergency"><Trash2 className="h-4 w-4" /></button></li>)}</ul>}
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Histórico</h2>
        <ol className="relative ml-3 flex flex-col gap-3 border-l-2 border-border pl-5">
          {data.ev.map((e) => (
            <li key={e.id} className="relative"><span className={cn("absolute -left-[29px] top-1 h-4 w-4 rounded-full border-2 border-card", e.tipo === "resposta" ? "bg-success" : e.tipo === "reuniao" ? "bg-coral" : "bg-primary")} />
              <p className="text-xs text-muted-foreground">{fData(e.data + "T12:00")} · {EVENTO[e.tipo] ?? e.tipo}</p>
              <p className="whitespace-pre-line text-sm">{e.tipo === "status" ? statusSol(e.texto)[1] : e.texto}</p></li>
          ))}
        </ol>
        <div className="no-print flex flex-col gap-2 rounded-2xl bg-muted p-3">
          <div className="flex flex-wrap gap-1.5">{[["nota", "Anotação"], ["resposta", "Resposta recebida"], ["reuniao", "Reunião"]].map(([k, l]) => <button key={k} onClick={() => setEv({ ...ev, tipo: k })} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", ev.tipo === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{l}</button>)}</div>
          <textarea aria-label="Registro" className={cn(textareaCls, "min-h-20")} maxLength={4000} placeholder={ev.tipo === "reuniao" ? "Quem participou, o que foi combinado e próximos passos" : ev.tipo === "resposta" ? "Resumo da resposta recebida" : "Escreva aqui"} value={ev.texto} onChange={(e) => setEv({ ...ev, texto: e.target.value })} />
          <div className="flex items-center gap-2"><input aria-label="Data" type="date" className={cn(inputCls, "min-h-10 w-auto")} value={ev.data} onChange={(e) => setEv({ ...ev, data: e.target.value })} /><Btn className="min-h-10" onClick={addEvento}>Registrar</Btn></div>
        </div>
        <p className="text-xs text-muted-foreground">Gerado em {fDataHora(new Date())} pelo app AMPARO.</p>
      </Card>
      <Btn v="ghost" className="no-print self-start text-emergency hover:bg-emergency-soft" onClick={excluir}><Trash2 className="h-4 w-4" /> Excluir solicitação</Btn>
    </div>
  );
}
