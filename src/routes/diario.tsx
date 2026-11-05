import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Camera, Copy, FileText, Link2, Mail, NotebookPen, Plus, Share2, Trash2, Users, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, Carregando, Chip, Opcoes, PageHeader, Vazio, btn, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth, nomeExibicao } from "@/lib/auth";
import { db, useFilhos, useQuery } from "@/lib/dados";
import { ESTRATEGIAS, GATILHOS, HUMORES, SENTIDOS, TIPOS_DIARIO, tipoInfo, urlFoto, useFamiliaDiario, type Registro } from "@/lib/diario";
import { emailValido, fData, fDataLonga, fHora, paraInputLocal, urlApp } from "@/lib/br";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/diario")({ component: () => <AppShell><Diario /></AppShell> });

type Aba = "linha" | "padroes" | "compartilhar";

function Diario() {
  const fam = useFamiliaDiario();
  const { data: filhos } = useFilhos(fam.familiaId ?? undefined);
  const [filho, setFilho] = useState<string>("");
  const [aba, setAba] = useState<Aba>("linha");
  const [novo, setNovo] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [dias, setDias] = useState(30);

  useEffect(() => { if (filhos?.length && !filho) setFilho(filhos[0].id); }, [filhos, filho]);

  const { data: regs, loading, recarregar } = useQuery<Registro[]>(async () => {
    if (!fam.familiaId) return [];
    let q = db.from("diario_registros").select("*").eq("familia_id", fam.familiaId)
      .gte("ocorrido_em", new Date(Date.now() - dias * 864e5).toISOString()).order("ocorrido_em", { ascending: false }).limit(500);
    if (filho) q = q.eq("filho_id", filho);
    const { data } = await q;
    return data ?? [];
  }, [fam.familiaId, filho, dias]);

  if (!fam.pronto) return <Carregando />;
  if (!fam.familiaId) return (
    <Vazio icon={NotebookPen} titulo="Diário ainda não disponível" texto="Complete o cadastro da sua família para começar a registrar. Se você é cuidador(a), peça para a família compartilhar o diário com o seu e-mail.">
      <Link to="/completar-cadastro" className={cn(btn.base, btn.primary)}>Completar cadastro</Link>
    </Vazio>
  );

  const lista = (regs ?? []).filter((r) => !filtroTipo || r.tipo === filtroTipo);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Diário" highlight="do dia a dia" subtitle="Registre crises, sono, alimentação, humor e conquistas. Com o tempo, os padrões aparecem e ajudam nas consultas e na escola."
        right={<Link to="/relatorio" search={{ filho, dias } as any} className={cn(btn.base, btn.outline)}><FileText className="h-4 w-4" /> Relatório</Link>} />

      <div className="flex flex-wrap items-center gap-2">
        {fam.opcoes.length > 1 && (
          <select aria-label="Família" className={cn(inputCls, "w-auto")} value={fam.familiaId} onChange={(e) => { fam.setFamiliaId(e.target.value); setFilho(""); }}>
            {fam.opcoes.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
          </select>
        )}
        {(filhos ?? []).map((f) => (
          <button key={f.id} onClick={() => setFilho(f.id)} className={cn("tap rounded-full border px-4 text-sm font-semibold", filho === f.id ? "border-primary bg-primary text-white" : "border-border bg-card text-navy")}>{f.nome.split(" ")[0]}</button>
        ))}
        {(filhos ?? []).length > 1 && <button onClick={() => setFilho("")} className={cn("tap rounded-full border px-4 text-sm font-semibold", !filho ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>Todos</button>}
      </div>

      {!fam.propria && <Aviso tom="blue">Você está registrando como cuidador(a) convidado(a). A família vê tudo o que você anotar.</Aviso>}

      <section aria-label="Registrar agora">
        <h2 className="mb-2 font-display text-lg font-bold">Registrar agora</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {TIPOS_DIARIO.map((t) => (
            <button key={t.k} onClick={() => setNovo(t.k)} className="card-soft flex min-h-20 flex-col items-center justify-center gap-1 p-2 text-center transition hover:border-primary">
              <span className="text-2xl" aria-hidden="true">{t.emoji}</span>
              <span className="text-xs font-bold text-navy">{t.l}</span>
            </button>
          ))}
        </div>
      </section>

      {novo && <NovoRegistro tipo={novo} familiaId={fam.familiaId} filhoId={filho || filhos?.[0]?.id || null} filhos={filhos ?? []} onFechar={() => setNovo(null)} onSalvo={() => { setNovo(null); recarregar(); }} />}

      <div role="tablist" className="flex gap-1 rounded-full bg-muted p-1">
        {([["linha", "Linha do tempo", NotebookPen], ["padroes", "Padrões", BarChart3], ...(fam.propria ? [["compartilhar", "Compartilhar", Share2]] : [])] as [Aba, string, any][]).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={cn("tap flex flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold", aba === k ? "bg-card text-primary shadow-card" : "text-muted-foreground")}>
            <I className="h-4 w-4" /> {l}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select aria-label="Período" className={cn(inputCls, "w-auto")} value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          <option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 3 meses</option><option value={365}>Último ano</option>
        </select>
        {aba === "linha" && (
          <select aria-label="Tipo" className={cn(inputCls, "w-auto")} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>{TIPOS_DIARIO.map((t) => <option key={t.k} value={t.k}>{t.l}</option>)}
          </select>
        )}
      </div>

      {aba === "linha" && (loading ? <Carregando /> : <LinhaDoTempo regs={lista} podeApagar={fam.propria} onMudou={recarregar} />)}
      {aba === "padroes" && <Padroes regs={regs ?? []} dias={dias} />}
      {aba === "compartilhar" && fam.propria && <Compartilhar familiaId={fam.familiaId} filhos={filhos ?? []} />}
    </div>
  );
}

function NovoRegistro({ tipo, familiaId, filhoId, filhos, onFechar, onSalvo }: { tipo: string; familiaId: string; filhoId: string | null; filhos: { id: string; nome: string }[]; onFechar: () => void; onSalvo: () => void }) {
  const { user, perfil } = useAuth();
  const t = tipoInfo(tipo);
  const [f, setF] = useState({
    filho_id: filhoId ?? "", quando: paraInputLocal(new Date()), humor: "", intensidade: tipo === "crise" ? 3 : 0,
    gatilhos: [] as string[], comportamento: "", estrategias: [] as string[], sentido: [] as string[], busca_evita: "", nota: "",
    horas: "", qualidade: "", refeicao: "", aceitou: "", duracao: "",
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const abc = tipo === "crise" || tipo === "comportamento";

  async function salvar() {
    setSalvando(true);
    let foto_path: string | null = null;
    if (foto) {
      const nome = `${familiaId}/${crypto.randomUUID()}.${(foto.name.split(".").pop() || "jpg").toLowerCase()}`;
      const { error } = await db.storage.from("diario-fotos").upload(nome, foto, { contentType: foto.type });
      if (error) { setSalvando(false); return toast.error("Não foi possível enviar a foto."); }
      foto_path = nome;
    }
    const extras = [
      f.duracao && `Duração: ${f.duracao}`,
      f.horas && `Dormiu: ${f.horas}h`, f.qualidade && `Qualidade: ${f.qualidade}`,
      f.refeicao && `Refeição: ${f.refeicao}`, f.aceitou && `Aceitação: ${f.aceitou}`,
    ].filter(Boolean).join(" · ");
    const { error } = await db.from("diario_registros").insert({
      familia_id: familiaId, filho_id: f.filho_id || null, autor_id: user!.id, autor_nome: nomeExibicao(perfil, user), origem: "app",
      tipo, ocorrido_em: new Date(f.quando).toISOString(), humor: f.humor || null,
      intensidade: f.intensidade || null, antecedente: f.gatilhos.join(", ") || null, comportamento: f.comportamento || null,
      consequencia: f.estrategias.join(", ") || null, sentido: f.sentido.join(", ") || null, busca_evita: f.busca_evita || null,
      nota: [extras, f.nota].filter(Boolean).join("\n") || null, foto_path,
    });
    setSalvando(false);
    if (error) return toast.error("Não foi possível salvar: " + error.message);
    toast.success(tipo === "conquista" ? "Que lindo! Conquista registrada ⭐" : "Registro salvo.");
    onSalvo();
  }

  return (
    <Card className="flex flex-col gap-4 border-primary">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold"><span aria-hidden="true">{t.emoji}</span> {t.l}</h2>
        <button onClick={onFechar} className="tap grid place-items-center rounded-full" aria-label="Fechar"><X /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {filhos.length > 1 && (
          <Campo id="r-filho" label="Para quem" obrigatorio>
            <select id="r-filho" className={inputCls} value={f.filho_id} onChange={(e) => setF({ ...f, filho_id: e.target.value })}>{filhos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
          </Campo>
        )}
        <Campo id="r-quando" label="Quando" obrigatorio><input id="r-quando" type="datetime-local" className={inputCls} value={f.quando} onChange={(e) => setF({ ...f, quando: e.target.value })} /></Campo>
      </div>

      {(tipo === "humor" || abc) && <Campo id="r-humor" label="Como estava"><Opcoes nome="Humor" valores={HUMORES} valor={f.humor} onChange={(v) => setF({ ...f, humor: v })} /></Campo>}

      {abc && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-navy">Intensidade: {["", "leve", "moderada", "média", "forte", "muito forte"][f.intensidade]}</span>
            <input type="range" min={1} max={5} value={f.intensidade || 1} onChange={(e) => setF({ ...f, intensidade: Number(e.target.value) })} className="accent-[var(--color-primary)]" aria-label="Intensidade de 1 a 5" />
          </div>
          <Campo id="r-gat" label="A · O que aconteceu antes (gatilho)"><Opcoes multi nome="Gatilhos" valores={GATILHOS} valor={f.gatilhos} onChange={(v) => setF({ ...f, gatilhos: v })} /></Campo>
          <Campo id="r-comp" label="B · O que a criança fez"><textarea id="r-comp" className={textareaCls} value={f.comportamento} onChange={(e) => setF({ ...f, comportamento: e.target.value })} placeholder="Ex.: chorou, se jogou no chão, tampou os ouvidos" /></Campo>
          <Campo id="r-est" label="C · O que ajudou"><Opcoes multi nome="Estratégias" valores={ESTRATEGIAS} valor={f.estrategias} onChange={(v) => setF({ ...f, estrategias: v })} /></Campo>
          <Campo id="r-dur" label="Duração"><Opcoes nome="Duração" valores={["Menos de 5 min", "5 a 15 min", "15 a 30 min", "Mais de 30 min"]} valor={f.duracao} onChange={(v) => setF({ ...f, duracao: v })} /></Campo>
        </>
      )}
      {tipo === "sensorial" && (
        <>
          <Campo id="r-sent" label="Sentido envolvido"><Opcoes multi nome="Sentidos" valores={SENTIDOS} valor={f.sentido} onChange={(v) => setF({ ...f, sentido: v })} /></Campo>
          <Campo id="r-be" label="A criança estava"><Opcoes nome="Busca ou evita" valores={["Buscando o estímulo", "Evitando o estímulo"]} valor={f.busca_evita} onChange={(v) => setF({ ...f, busca_evita: v })} /></Campo>
        </>
      )}
      {tipo === "sono" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="r-horas" label="Horas dormidas"><input id="r-horas" type="number" step="0.5" min={0} max={24} className={inputCls} value={f.horas} onChange={(e) => setF({ ...f, horas: e.target.value })} /></Campo>
          <Campo id="r-q" label="Qualidade"><Opcoes nome="Qualidade do sono" valores={["Dormiu bem", "Acordou várias vezes", "Demorou a dormir", "Noite difícil"]} valor={f.qualidade} onChange={(v) => setF({ ...f, qualidade: v })} /></Campo>
        </div>
      )}
      {tipo === "alimentacao" && (
        <>
          <Campo id="r-ref" label="Refeição"><Opcoes nome="Refeição" valores={["Café da manhã", "Lanche", "Almoço", "Jantar", "Ceia"]} valor={f.refeicao} onChange={(v) => setF({ ...f, refeicao: v })} /></Campo>
          <Campo id="r-ac" label="Aceitação"><Opcoes nome="Aceitação" valores={["Comeu tudo", "Comeu parte", "Recusou", "Provou algo novo"]} valor={f.aceitou} onChange={(v) => setF({ ...f, aceitou: v })} /></Campo>
        </>
      )}
      <Campo id="r-nota" label={tipo === "conquista" ? "Qual foi a conquista?" : "Observações"}><textarea id="r-nota" className={textareaCls} value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} maxLength={2000} /></Campo>
      <label className={cn(btn.base, btn.outline, "w-fit cursor-pointer")}>
        <Camera className="h-4 w-4" /> {foto ? foto.name.slice(0, 24) : "Adicionar foto"}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
      </label>
      <div className="flex gap-2"><Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar registro"}</Btn><Btn v="ghost" onClick={onFechar}>Cancelar</Btn></div>
    </Card>
  );
}

function Foto({ path }: { path: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { urlFoto(path).then(setUrl); }, [path]);
  return url ? <img src={url} alt="Foto do registro" className="mt-2 max-h-56 rounded-xl object-cover" loading="lazy" /> : null;
}

function LinhaDoTempo({ regs, podeApagar, onMudou }: { regs: Registro[]; podeApagar: boolean; onMudou: () => void }) {
  const porDia = useMemo(() => {
    const m = new Map<string, Registro[]>();
    regs.forEach((r) => { const d = r.ocorrido_em.slice(0, 10); m.set(d, [...(m.get(d) ?? []), r]); });
    return [...m.entries()];
  }, [regs]);
  if (!regs.length) return <Vazio icon={NotebookPen} titulo="Nenhum registro no período" texto="Toque em um dos botões acima para fazer o primeiro registro." />;
  async function apagar(r: Registro) {
    if (!confirm("Apagar este registro?")) return;
    const { error } = await db.from("diario_registros").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    if (r.foto_path) await db.storage.from("diario-fotos").remove([r.foto_path]);
    toast.success("Registro apagado."); onMudou();
  }
  return (
    <div className="flex flex-col gap-5">
      {porDia.map(([dia, rs]) => (
        <section key={dia} className="flex flex-col gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{fDataLonga(dia + "T12:00:00")}</h3>
          {rs.map((r) => {
            const t = tipoInfo(r.tipo);
            return (
              <article key={r.id} className="card-soft flex gap-3 p-4" style={{ borderLeft: `5px solid ${t.cor}` }}>
                <span className="text-2xl" aria-hidden="true">{t.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-navy">{t.l}</b><span className="text-sm text-muted-foreground">{fHora(r.ocorrido_em)}</span>
                    {r.intensidade ? <Chip tom={r.intensidade >= 4 ? "red" : "amber"}>Intensidade {r.intensidade}/5</Chip> : null}
                    {r.humor && <Chip>{r.humor}</Chip>}
                    {r.origem === "escola" && <Chip tom="blue">Escola</Chip>}
                  </div>
                  {r.antecedente && <p className="text-sm"><b>Antes:</b> {r.antecedente}</p>}
                  {r.comportamento && <p className="text-sm"><b>Comportamento:</b> {r.comportamento}</p>}
                  {r.consequencia && <p className="text-sm"><b>Ajudou:</b> {r.consequencia}</p>}
                  {r.sentido && <p className="text-sm"><b>Sentido:</b> {r.sentido}{r.busca_evita ? ` · ${r.busca_evita}` : ""}</p>}
                  {r.nota && <p className="whitespace-pre-line text-sm">{r.nota}</p>}
                  {r.foto_path && <Foto path={r.foto_path} />}
                  {r.autor_nome && <p className="mt-1 text-xs text-muted-foreground">Registrado por {r.autor_nome}</p>}
                </div>
                {podeApagar && <button onClick={() => apagar(r)} className="tap grid place-items-center self-start rounded-full text-muted-foreground hover:text-emergency" aria-label="Apagar registro"><Trash2 className="h-4 w-4" /></button>}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function contar(lista: string[]) {
  const m = new Map<string, number>();
  lista.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return [...m.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
}

function Padroes({ regs, dias }: { regs: Registro[]; dias: number }) {
  const crises = regs.filter((r) => r.tipo === "crise");
  const porTipo = contar(regs.map((r) => r.tipo)).map((x) => ({ ...x, nome: tipoInfo(x.nome).l, cor: tipoInfo(x.nome).cor }));
  const gatilhos = contar(crises.concat(regs.filter((r) => r.tipo === "comportamento")).flatMap((r) => (r.antecedente ?? "").split(", ").filter(Boolean))).slice(0, 8);
  const ajudou = contar(regs.flatMap((r) => (r.consequencia ?? "").split(", ").filter(Boolean))).slice(0, 8);
  const horas = contar(crises.map((r) => {
    const h = new Date(r.ocorrido_em).getHours();
    return h < 6 ? "Madrugada" : h < 12 ? "Manhã" : h < 18 ? "Tarde" : "Noite";
  }));
  const semanas = useMemo(() => {
    const n = Math.max(1, Math.ceil(dias / 7));
    const base = Date.now();
    return Array.from({ length: Math.min(n, 12) }, (_, i) => {
      const fim = base - i * 7 * 864e5, ini = fim - 7 * 864e5;
      return { nome: fData(new Date(ini + 864e5)).slice(0, 5), total: crises.filter((r) => { const t = new Date(r.ocorrido_em).getTime(); return t > ini && t <= fim; }).length };
    }).reverse();
  }, [crises, dias]);
  const media = crises.length ? (crises.reduce((s, r) => s + (r.intensidade ?? 0), 0) / crises.length).toFixed(1) : "–";

  if (!regs.length) return <Vazio icon={BarChart3} titulo="Ainda sem dados" texto="Os gráficos aparecem conforme você registra no diário." />;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center"><p className="font-display text-3xl font-extrabold text-primary">{regs.length}</p><p className="text-xs text-muted-foreground">registros</p></Card>
        <Card className="p-4 text-center"><p className="font-display text-3xl font-extrabold text-emergency">{crises.length}</p><p className="text-xs text-muted-foreground">crises</p></Card>
        <Card className="p-4 text-center"><p className="font-display text-3xl font-extrabold text-warning">{media}</p><p className="text-xs text-muted-foreground">intensidade média</p></Card>
      </div>
      <Card>
        <h3 className="mb-2 font-display font-bold">Crises por semana</h3>
        <div className="h-52"><ResponsiveContainer><BarChart data={semanas}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="nome" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} width={28} /><Tooltip /><Bar dataKey="total" name="Crises" fill="#E5484D" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="mb-2 font-display font-bold">Tipos de registro</h3>
          <div className="h-52"><ResponsiveContainer><PieChart><Pie data={porTipo} dataKey="total" nameKey="nome" innerRadius={45} outerRadius={80}>{porTipo.map((p) => <Cell key={p.nome} fill={p.cor} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
          <div className="flex flex-wrap gap-1.5">{porTipo.map((p) => <span key={p.nome} className="text-xs"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.cor }} />{p.nome} ({p.total})</span>)}</div>
        </Card>
        <Card>
          <h3 className="mb-2 font-display font-bold">Horário das crises</h3>
          {horas.length ? <Barras dados={horas} cor="#F76B15" /> : <p className="text-sm text-muted-foreground">Sem crises no período 💙</p>}
        </Card>
        <Card>
          <h3 className="mb-2 font-display font-bold">Gatilhos mais comuns</h3>
          {gatilhos.length ? <Barras dados={gatilhos} cor="#6E56CF" /> : <p className="text-sm text-muted-foreground">Registre o que aconteceu antes das crises para ver os gatilhos.</p>}
        </Card>
        <Card>
          <h3 className="mb-2 font-display font-bold">O que mais ajudou</h3>
          {ajudou.length ? <Barras dados={ajudou} cor="#30A46C" /> : <p className="text-sm text-muted-foreground">Registre o que ajudou para descobrir as melhores estratégias.</p>}
        </Card>
      </div>
      <Aviso>Esses padrões são um apoio para conversar com os profissionais. Eles não são diagnóstico.</Aviso>
    </div>
  );
}

function Barras({ dados, cor }: { dados: { nome: string; total: number }[]; cor: string }) {
  const max = Math.max(...dados.map((d) => d.total), 1);
  return (
    <ul className="flex flex-col gap-1.5">
      {dados.map((d) => (
        <li key={d.nome} className="text-sm">
          <div className="flex justify-between"><span>{d.nome}</span><b>{d.total}</b></div>
          <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full" style={{ width: `${(d.total / max) * 100}%`, background: cor }} /></div>
        </li>
      ))}
    </ul>
  );
}

function Compartilhar({ familiaId, filhos }: { familiaId: string; filhos: { id: string; nome: string }[] }) {
  const [email, setEmail] = useState("");
  const { data: cuid, recarregar } = useQuery<any[]>(async () => (await db.from("diario_compartilhamentos").select("*").eq("familia_id", familiaId).order("created_at")).data ?? [], [familiaId]);
  const { data: links, recarregar: recLinks } = useQuery<any[]>(async () => (await db.from("links_escola").select("*").eq("familia_id", familiaId).order("created_at", { ascending: false })).data ?? [], [familiaId]);
  const [lk, setLk] = useState({ filho_id: filhos[0]?.id ?? "", rotulo: "", dias: 90 });

  async function convidar() {
    if (!emailValido(email)) return toast.error("Informe um e-mail válido.");
    const { error } = await db.from("diario_compartilhamentos").insert({ familia_id: familiaId, email: email.trim().toLowerCase(), ativo: true });
    if (error) return toast.error(error.message);
    toast.success("Convite registrado. A pessoa deve criar uma conta com este e-mail para acessar o diário.");
    setEmail(""); recarregar();
  }
  async function alternar(c: any) { await db.from("diario_compartilhamentos").update({ ativo: !c.ativo }).eq("id", c.id); recarregar(); }
  async function remover(c: any) { await db.from("diario_compartilhamentos").delete().eq("id", c.id); recarregar(); }
  async function criarLink() {
    if (!lk.filho_id) return toast.error("Escolha a criança.");
    const { error } = await db.from("links_escola").insert({ familia_id: familiaId, filho_id: lk.filho_id, rotulo: lk.rotulo || "Escola", expira_em: new Date(Date.now() + lk.dias * 864e5).toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Link criado."); setLk({ ...lk, rotulo: "" }); recLinks();
  }
  async function revogar(l: any) { await db.from("links_escola").update({ revogado: true }).eq("id", l.id); recLinks(); }
  const urlLink = (t: string) => urlApp(`/escola/${t}`);
  const nomeFilho = (id: string) => filhos.find((f) => f.id === id)?.nome.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold"><Users className="h-5 w-5 text-primary" /> Cuidadores</h3>
        <p className="text-sm text-muted-foreground">Pai, avós, babá ou terapeuta podem ver e fazer registros no diário. Eles não veem CPF nem a ficha de saúde.</p>
        <div className="flex gap-2">
          <input aria-label="E-mail do cuidador" type="email" className={inputCls} placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Btn onClick={convidar}><Mail className="h-4 w-4" /> Convidar</Btn>
        </div>
        {(cuid ?? []).map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3 text-sm">
            <span className="flex-1 font-semibold">{c.email}</span>
            <Chip tom={c.ativo ? "green" : "navy"}>{c.ativo ? "Ativo" : "Pausado"}</Chip>
            <Btn v="outline" className="min-h-10" onClick={() => alternar(c)}>{c.ativo ? "Pausar" : "Ativar"}</Btn>
            <button onClick={() => remover(c)} className="tap grid place-items-center text-emergency" aria-label={`Remover ${c.email}`}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </Card>
      <Card className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold"><Link2 className="h-5 w-5 text-primary" /> Link para a escola</h3>
        <p className="text-sm text-muted-foreground">A professora registra o dia pelo link, sem precisar de conta. Ela só vê o primeiro nome da criança e não vê nenhum registro da família.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <select aria-label="Criança" className={inputCls} value={lk.filho_id} onChange={(e) => setLk({ ...lk, filho_id: e.target.value })}>{filhos.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
          <input aria-label="Identificação" className={inputCls} placeholder="Ex.: Profª Ana – 2º ano" value={lk.rotulo} onChange={(e) => setLk({ ...lk, rotulo: e.target.value })} />
          <select aria-label="Validade" className={inputCls} value={lk.dias} onChange={(e) => setLk({ ...lk, dias: Number(e.target.value) })}><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={180}>6 meses</option></select>
          <Btn onClick={criarLink}><Plus className="h-4 w-4" /> Criar</Btn>
        </div>
        {(links ?? []).map((l) => {
          const ativo = !l.revogado && new Date(l.expira_em) > new Date();
          return (
            <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3 text-sm">
              <span className="flex-1"><b>{l.rotulo}</b> · {nomeFilho(l.filho_id)} · até {fData(l.expira_em)}</span>
              <Chip tom={ativo ? "green" : "navy"}>{ativo ? "Ativo" : "Encerrado"}</Chip>
              {ativo && <Btn v="outline" className="min-h-10" onClick={() => { navigator.clipboard?.writeText(urlLink(l.token)); toast.success("Link copiado."); }}><Copy className="h-4 w-4" /> Copiar</Btn>}
              {ativo && <a className={cn(btn.base, btn.wa, "min-h-10")} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent("Link para registrar o dia na escola: " + urlLink(l.token))}`}>WhatsApp</a>}
              {ativo && <Btn v="ghost" className="min-h-10" onClick={() => revogar(l)}>Encerrar</Btn>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
