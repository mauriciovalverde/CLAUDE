import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarOff, Check, ChevronLeft, Clock, FileText, FolderLock, Hourglass, MapPin, Plus, RefreshCw, Settings2, ShieldAlert, Trash2, UserRound, Users, Video, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, Carregando, Chip, Modal, Opcoes, PageHeader, Vazio, btn, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { fData, fDataHora, fDataLonga, fHora, paraInputLocal } from "@/lib/br";
import { ATIVA, DIAS_SEMANA, ESPECIALIDADES_SUGERIDAS, MODALIDADE, STATUS_CONSULTA, salaAberta, type PsiPerfil } from "@/lib/consultas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/atendimentos")({ component: () => <AppShell><Atendimentos /></AppShell> });

type Aba = "agenda" | "pacientes" | "horarios" | "perfil";

function Atendimentos() {
  const { user } = useAuth();
  const [aba, setAba] = useState<Aba>("agenda");
  const [prontuario, setProntuario] = useState<{ id: string; codigo: string; nome: string } | null>(null);
  const { data: perfil, loading, recarregar } = useQuery<PsiPerfil | null>(async () => (await db.from("psi_perfis").select("*").eq("user_id", user!.id).maybeSingle()).data, [user?.id]);
  const { data: nDisp } = useQuery<number>(async () => { const [a, b] = await Promise.all([db.from("psi_datas").select("id", { count: "exact", head: true }).eq("profissional_id", user!.id).gte("data", new Date().toLocaleDateString("sv-SE")), db.from("psi_disponibilidade").select("id", { count: "exact", head: true }).eq("profissional_id", user!.id)]); return (a.count ?? 0) + (b.count ?? 0); }, [user?.id, aba]);
  useEffect(() => { if (nDisp === 0) setAba("horarios"); }, [nDisp === 0]);
  if (loading) return <Carregando />;
  if (!perfil) return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Atender pelo" highlight="Centro" subtitle="Psicólogos podem oferecer atendimento online ou presencial às famílias do Centro. Preencha seu perfil; a equipe confere o CRP e libera sua agenda." />
      <FormPerfil perfil={null} onSalvo={recarregar} />
    </div>
  );
  if (prontuario) return <Prontuario paciente={prontuario} onVoltar={() => setProntuario(null)} />;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Meus" highlight="atendimentos" subtitle={`${perfil.nome} · ${perfil.registro}`} />
      {!perfil.ativo && <Aviso tom="amber">Seu perfil está aguardando a validação do CRP pela equipe. Enquanto isso, já pode cadastrar seus horários.</Aviso>}
      <PedidosAcesso />
      <div role="tablist" className="grid grid-cols-4 gap-1 rounded-full bg-muted p-1">
        {([["agenda", "Consultas", CalendarDays], ["horarios", "Abrir agenda", Clock], ["pacientes", "Pacientes", Users], ["perfil", "Perfil", Settings2]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={cn("tap flex flex-col items-center justify-center gap-0.5 rounded-full py-1 text-[11px] font-semibold sm:flex-row sm:gap-1.5 sm:text-sm", aba === k ? "bg-card text-primary shadow-card" : "text-muted-foreground")}><I className="h-4 w-4" />{l}</button>
        ))}
      </div>
      {nDisp === 0 && aba !== "horarios" && <Aviso tom="amber">Sua agenda ainda está fechada. <button className="font-bold text-primary underline" onClick={() => setAba("horarios")}>Toque aqui para escolher os dias e horários</button> em que você atende.</Aviso>}
      {aba === "agenda" && <Agenda perfil={perfil} abrirProntuario={setProntuario} />}
      {aba === "pacientes" && <Pacientes abrir={setProntuario} />}
      {aba === "horarios" && <Horarios perfil={perfil} onSalvo={recarregar} />}
      {aba === "perfil" && <FormPerfil perfil={perfil} onSalvo={recarregar} />}
      <p className="flex items-start gap-2 text-xs text-muted-foreground"><FolderLock className="h-4 w-4 shrink-0" /> Por sigilo e LGPD, você vê o paciente pelo código interno e pelo primeiro nome. Telefone, e-mail, endereço e CPF ficam só com a administração do Centro, que faz o contato com as famílias.</p>
    </div>
  );
}

type Linha = {
  id: string; inicio: string; fim: string; status: string; motivo: string | null; link_video: string | null; modalidade: string; para_quem: string;
  paciente_id: string | null; paciente_codigo: string | null; paciente_nome: string | null; paciente_idade: number | null; total_anteriores: number;
  recusa_motivo: string | null; cancelado_motivo: string | null;
};

function Agenda({ perfil, abrirProntuario }: { perfil: PsiPerfil; abrirProntuario: (p: { id: string; codigo: string; nome: string }) => void }) {
  const [passadas, setPassadas] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const [reagendar, setReagendar] = useState<Linha | null>(null);
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(t); }, []);
  const { data, loading, recarregar } = useQuery<Linha[]>(async () => {
    const de = passadas ? new Date(Date.now() - 60 * 864e5) : new Date(Date.now() - 864e5);
    const ate = passadas ? new Date() : new Date(Date.now() + 90 * 864e5);
    const { data, error } = await db.rpc("consultas_profissional", { _de: de.toISOString(), _ate: ate.toISOString() });
    if (error) throw error;
    return (data ?? []) as Linha[];
  }, [passadas]);

  const pendentes = (data ?? []).filter((c) => c.status === "pendente" && !passadas);
  const lista = (data ?? []).filter((c) => c.status !== "pendente" || passadas).filter((c) => passadas ? true : ATIVA(c.status) || new Date(c.inicio).getTime() > agora - 864e5);
  const porDia = useMemo(() => {
    const m = new Map<string, Linha[]>();
    (passadas ? [...lista].reverse() : lista).forEach((c) => { const k = new Date(c.inicio).toDateString(); m.set(k, [...(m.get(k) ?? []), c]); });
    return [...m.entries()];
  }, [lista, passadas]);

  async function decidir(c: Linha, aceitar: boolean) {
    let motivo: string | null = null;
    if (!aceitar) { motivo = prompt("Motivo da recusa (a família recebe esta mensagem):", "Horário indisponível"); if (motivo === null) return; }
    const { error } = await db.rpc("decidir_consulta", { _id: c.id, _aceitar: aceitar, _motivo: motivo });
    if (error) return toast.error(error.message);
    toast.success(aceitar ? "Consulta confirmada. O horário ficou reservado." : "Solicitação recusada e horário liberado."); recarregar();
  }
  async function mudar(c: Linha, status: string) {
    const { error } = await db.rpc("atualizar_consulta", { _id: c.id, _status: status });
    if (error) return toast.error(error.message);
    toast.success("Atualizado."); recarregar();
  }
  async function cancelar(c: Linha) {
    const motivo = prompt("Motivo do cancelamento (a família recebe esta mensagem):");
    if (motivo === null) return;
    const { error } = await db.rpc("cancelar_consulta", { _id: c.id, _motivo: motivo });
    if (error) return toast.error(error.message);
    toast.success("Consulta cancelada e família avisada."); recarregar();
  }
  const hoje = (data ?? []).filter((c) => c.status === "confirmada" && new Date(c.inicio).toDateString() === new Date().toDateString()).length;
  const quem = (c: Linha) => `${c.paciente_nome ?? "Paciente"}${c.paciente_idade != null ? `, ${c.paciente_idade} anos` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tom="blue">{hoje} consulta(s) hoje</Chip>
        {pendentes.length > 0 && <Chip tom="amber">{pendentes.length} aguardando você</Chip>}
        <span className="flex-1" />
        <Btn v="outline" className="min-h-10" onClick={() => setPassadas(!passadas)}>{passadas ? "Ver próximas" : "Ver últimos 60 dias"}</Btn>
      </div>

      {pendentes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold"><Hourglass className="h-5 w-5 text-amber-500" /> Solicitações para confirmar</h3>
          {pendentes.map((c) => (
            <Card key={c.id} className="flex flex-col gap-2 border-amber-300">
              <div className="flex flex-wrap items-center gap-2">
                <b className="font-display text-lg">{fData(c.inicio)} · {fHora(c.inicio)}–{fHora(c.fim)}</b>
                <Chip tom="blue">{MODALIDADE[c.modalidade]}</Chip>
                <Chip tom={c.total_anteriores ? "navy" : "coral"}>{c.total_anteriores ? `${c.total_anteriores + 1}ª sessão` : "1ª consulta"}</Chip>
              </div>
              <p><UserRound className="mr-1 inline h-4 w-4 text-primary" /><b className="font-mono">{c.paciente_codigo}</b> · {quem(c)} · {c.para_quem === "filho" ? "criança" : c.para_quem === "familia" ? "família" : "responsável"}</p>
              {c.motivo && <p className="rounded-xl bg-muted p-3 text-sm">“{c.motivo}”</p>}
              <div className="flex flex-wrap gap-2">
                <Btn v="wa" className="min-h-10" onClick={() => decidir(c, true)}><Check className="h-4 w-4" /> Confirmar</Btn>
                <Btn v="outline" className="min-h-10" onClick={() => setReagendar(c)}><RefreshCw className="h-4 w-4" /> Propor outro horário</Btn>
                <Btn v="ghost" className="min-h-10" onClick={() => decidir(c, false)}><X className="h-4 w-4" /> Recusar</Btn>
              </div>
            </Card>
          ))}
        </section>
      )}

      {loading ? <Carregando /> : !porDia.length ? (!pendentes.length && <Vazio icon={CalendarDays} titulo={passadas ? "Nenhum atendimento no período" : "Nenhuma consulta marcada"} texto={passadas ? undefined : "Quando uma família pedir um horário, a solicitação aparece aqui para você confirmar."} />) : porDia.map(([k, cs]) => (
        <section key={k} className="flex flex-col gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{fDataLonga(cs[0]!.inicio)}</h3>
          {cs.map((c) => {
            const [st, tom] = STATUS_CONSULTA[c.status] ?? [c.status, "navy"];
            const aberta = salaAberta(c.inicio, c.fim, agora);
            const passou = new Date(c.inicio).getTime() < agora;
            return (
              <Card key={c.id} className={cn("flex flex-col gap-2", aberta && c.status === "confirmada" && "border-success")}>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="font-display text-lg">{fHora(c.inicio)}–{fHora(c.fim)}</b>
                  <Chip tom={tom}>{st}</Chip>
                  <Chip tom="blue">{MODALIDADE[c.modalidade]}</Chip>
                  {c.status === "confirmada" && <Chip tom={c.total_anteriores ? "navy" : "coral"}>{c.total_anteriores ? `${c.total_anteriores + 1}ª sessão` : "1ª consulta"}</Chip>}
                </div>
                <p><UserRound className="mr-1 inline h-4 w-4 text-primary" /><b className="font-mono">{c.paciente_codigo}</b> · {quem(c)}</p>
                {c.motivo && <p className="rounded-xl bg-muted p-3 text-sm">“{c.motivo}”</p>}
                {(c.recusa_motivo || c.cancelado_motivo) && <p className="text-sm text-muted-foreground">Motivo: {c.recusa_motivo || c.cancelado_motivo}</p>}
                <div className="flex flex-wrap gap-2">
                  {c.status === "confirmada" && c.modalidade === "online" && c.link_video && <a href={c.link_video} target="_blank" rel="noopener noreferrer" className={cn(btn.base, aberta ? btn.wa : btn.outline, "min-h-10")}><Video className="h-4 w-4" /> {aberta ? "Entrar na sala" : "Sala"}</a>}
                  {c.status === "confirmada" && c.modalidade === "presencial" && <span className={cn(btn.base, "min-h-10 bg-muted text-navy")}><MapPin className="h-4 w-4" /> {perfil.endereco_presencial || "Presencial"}</span>}
                  {c.status === "confirmada" && !passou && <Btn v="outline" className="min-h-10" onClick={() => setReagendar(c)}><RefreshCw className="h-4 w-4" /> Reagendar</Btn>}
                  {["confirmada", "realizada", "falta"].includes(c.status) && passou && <Btn v="soft" className="min-h-10" onClick={() => mudar(c, "realizada")}>Realizada</Btn>}
                  {["confirmada", "realizada", "falta"].includes(c.status) && passou && <Btn v="outline" className="min-h-10" onClick={() => mudar(c, "falta")}>Não compareceu</Btn>}
                  {c.status === "confirmada" && !passou && <Btn v="ghost" className="min-h-10" onClick={() => cancelar(c)}>Cancelar</Btn>}
                  {c.paciente_id && ["confirmada", "realizada", "falta", "reagendada"].includes(c.status) && (
                    <Btn v="soft" className="min-h-10" onClick={() => abrirProntuario({ id: c.paciente_id!, codigo: c.paciente_codigo ?? "", nome: quem(c) })}><FileText className="h-4 w-4" /> Ficha clínica</Btn>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      ))}
      {reagendar && <Reagendar c={reagendar} profId={perfil.user_id} onFechar={() => setReagendar(null)} onFeito={() => { setReagendar(null); recarregar(); }} />}
    </div>
  );
}

function Reagendar({ c, profId, onFechar, onFeito }: { c: Linha; profId: string; onFechar: () => void; onFeito: () => void }) {
  const [dia, setDia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { data: slots, loading } = useQuery<{ inicio: string; fim: string }[]>(async () => {
    const iso = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Bahia" });
    const { data } = await db.rpc("horarios_livres", { _prof: profId, _de: iso(new Date()), _ate: iso(new Date(Date.now() + 42 * 864e5)) });
    return data ?? [];
  }, [profId]);
  const porDia = useMemo(() => {
    const m = new Map<string, { inicio: string; fim: string }[]>();
    (slots ?? []).forEach((s) => { const k = new Date(s.inicio).toLocaleDateString("sv-SE"); m.set(k, [...(m.get(k) ?? []), s]); });
    return m;
  }, [slots]);
  useEffect(() => { if (!dia && porDia.size) setDia([...porDia.keys()][0]); }, [porDia, dia]);
  async function escolher(inicio: string) {
    if (!confirm(`Remarcar ${c.paciente_codigo} para ${fDataLonga(inicio)} às ${fHora(inicio)}? A família recebe o aviso e o novo horário já fica confirmado.`)) return;
    setEnviando(true);
    const { error } = await db.rpc("reagendar_consulta", { _id: c.id, _novo_inicio: inicio, _motivo: motivo || null });
    setEnviando(false);
    if (error) return toast.error(error.message);
    toast.success("Consulta reagendada."); onFeito();
  }
  return (
    <Modal titulo={`Reagendar ${c.paciente_codigo}`} onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Atual: {fDataLonga(c.inicio)} às {fHora(c.inicio)}. Escolha um horário livre da sua agenda.</p>
        <Campo id="re-m" label="Motivo para a família"><input id="re-m" className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: imprevisto na agenda" /></Campo>
        {loading ? <Carregando /> : !porDia.size ? <Vazio icon={CalendarOff} titulo="Sem horários livres" texto="Cadastre mais horários na aba Horários." /> : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[...porDia.keys()].map((k) => { const d = new Date(k + "T12:00:00"); return (
                <button key={k} onClick={() => setDia(k)} className={cn("flex min-w-14 shrink-0 flex-col items-center rounded-2xl border px-2 py-1.5", dia === k ? "border-primary bg-primary text-white" : "border-border bg-card")}>
                  <span className="text-[11px] font-semibold uppercase">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
                  <span className="font-display text-lg font-extrabold">{d.getDate()}</span>
                </button>); })}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(porDia.get(dia) ?? []).map((s) => <button key={s.inicio} disabled={enviando} onClick={() => escolher(s.inicio)} className="tap rounded-xl border border-border bg-card font-display font-bold text-navy hover:border-primary hover:bg-primary-soft">{fHora(s.inicio)}</button>)}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

type Paciente = { paciente_id: string; codigo: string; nome: string; idade: number | null; tipo: string; desde: string; ultima: string | null; proxima: string | null; realizadas: number };

function Pacientes({ abrir }: { abrir: (p: { id: string; codigo: string; nome: string }) => void }) {
  const [q, setQ] = useState("");
  const { data, loading } = useQuery<Paciente[]>(async () => {
    const { data, error } = await db.rpc("meus_pacientes");
    if (error) throw error;
    return data ?? [];
  }, []);
  if (loading) return <Carregando />;
  if (!data?.length) return <Vazio icon={Users} titulo="Nenhum paciente ainda" texto="O paciente entra na sua carteira quando você confirma a primeira consulta." />;
  const t = q.trim().toLowerCase();
  const lista = data.filter((p) => !t || `${p.codigo} ${p.nome}`.toLowerCase().includes(t));
  return (
    <div className="flex flex-col gap-3">
      <input className={inputCls} placeholder="Buscar por código ou primeiro nome" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar paciente" />
      {lista.map((p) => (
        <button key={p.paciente_id} onClick={() => abrir({ id: p.paciente_id, codigo: p.codigo, nome: `${p.nome}${p.idade != null ? `, ${p.idade} anos` : ""}` })} className="card-soft flex items-center gap-3 p-4 text-left transition hover:border-primary">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><FileText className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1">
            <b className="block font-mono text-navy">{p.codigo}</b>
            <span className="block text-sm">{p.nome}{p.idade != null ? `, ${p.idade} anos` : ""} · {p.tipo === "filho" ? "criança" : p.tipo === "familia" ? "família" : "responsável"}</span>
            <span className="block text-xs text-muted-foreground">{p.realizadas} sessão(ões){p.ultima ? ` · última ${fData(p.ultima)}` : ""}{p.proxima ? ` · próxima ${fData(p.proxima)} ${fHora(p.proxima)}` : ""}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

const CAMPOS_FICHA: [string, string, string][] = [
  ["queixa", "Queixa principal / demanda", "O que trouxe o paciente ao atendimento"],
  ["historico", "Histórico relevante", "Desenvolvimento, saúde, tratamentos anteriores"],
  ["contexto_familiar", "Contexto familiar e rede de apoio", ""],
  ["hipoteses", "Hipóteses e observações clínicas", ""],
  ["plano", "Plano terapêutico", "Objetivos, frequência, encaminhamentos"],
  ["observacoes", "Outras observações", ""],
];

function Prontuario({ paciente, onVoltar }: { paciente: { id: string; codigo: string; nome: string }; onVoltar: () => void }) {
  const { user } = useAuth();
  const [ficha, setFicha] = useState<Record<string, string> | null>(null);
  const [novo, setNovo] = useState({ tipo: "evolucao", titulo: "", texto: "" });
  const { data: registros, recarregar } = useQuery<any[]>(async () => (await db.from("prontuario_registros").select("*").eq("paciente_id", paciente.id).eq("profissional_id", user!.id).order("created_at", { ascending: false })).data ?? [], [paciente.id]);
  useEffect(() => {
    db.from("prontuario_fichas").select("*").eq("paciente_id", paciente.id).eq("profissional_id", user!.id).maybeSingle()
      .then(({ data }: any) => setFicha(Object.fromEntries(CAMPOS_FICHA.map(([k]) => [k, data?.[k] ?? ""]))));
  }, [paciente.id, user]);
  async function salvarFicha() {
    const { error } = await db.from("prontuario_fichas").upsert({ paciente_id: paciente.id, profissional_id: user!.id, ...ficha, updated_at: new Date().toISOString() });
    error ? toast.error(error.message) : toast.success("Ficha salva.");
  }
  async function registrar() {
    if (!novo.texto.trim()) return toast.error("Escreva o registro.");
    const { error } = await db.from("prontuario_registros").insert({ paciente_id: paciente.id, profissional_id: user!.id, tipo: novo.tipo, titulo: novo.titulo.trim() || null, texto: novo.texto.trim() });
    if (error) return toast.error(error.message);
    setNovo({ tipo: "evolucao", titulo: "", texto: "" }); toast.success("Registro incluído no prontuário."); recarregar();
  }
  return (
    <div className="flex flex-col gap-5">
      <button onClick={onVoltar} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Voltar</button>
      <PageHeader title="Ficha" highlight="clínica" subtitle={`${paciente.codigo} · ${paciente.nome}`} />
      <Aviso tom="navy">Prontuário sigiloso: só você tem acesso. A administração do Centro só lê com a sua autorização, por prazo definido e com registro. Os registros não podem ser apagados (guarda mínima de 5 anos — Res. CFP 01/2009).</Aviso>
      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Ficha do paciente</h2>
        {!ficha ? <Carregando /> : CAMPOS_FICHA.map(([k, l, d]) => (
          <Campo key={k} id={"f-" + k} label={l} dica={d || undefined}><textarea id={"f-" + k} className={textareaCls + " min-h-20"} value={ficha[k]} onChange={(e) => setFicha({ ...ficha, [k]: e.target.value })} /></Campo>
        ))}
        <Btn onClick={salvarFicha} className="self-start">Salvar ficha</Btn>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Novo registro</h2>
        <div className="flex flex-wrap gap-2">
          {([["evolucao", "Evolução da sessão"], ["anotacao", "Anotação"], ["documento", "Documento / encaminhamento"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setNovo({ ...novo, tipo: k })} className={cn("tap rounded-full border px-4 text-sm font-semibold", novo.tipo === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{l}</button>
          ))}
        </div>
        <input className={inputCls} placeholder="Título (opcional)" value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} aria-label="Título" />
        <textarea className={textareaCls} placeholder="Descreva a sessão, a evolução e os combinados." value={novo.texto} onChange={(e) => setNovo({ ...novo, texto: e.target.value })} aria-label="Texto do registro" maxLength={20000} />
        <Btn onClick={registrar} className="self-start"><Plus className="h-4 w-4" /> Incluir no prontuário</Btn>
      </Card>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">Histórico de atendimentos</h2>
        {!registros?.length ? <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p> : registros.map((r) => (
          <Card key={r.id} className="flex flex-col gap-1 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm"><Chip tom={r.tipo === "evolucao" ? "blue" : r.tipo === "documento" ? "coral" : "navy"}>{r.tipo === "evolucao" ? "Evolução" : r.tipo === "documento" ? "Documento" : "Anotação"}</Chip><span className="text-muted-foreground">{fDataHora(r.created_at)}</span></div>
            {r.titulo && <b>{r.titulo}</b>}
            <p className="whitespace-pre-wrap text-sm">{r.texto}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}

function PedidosAcesso() {
  const { user } = useAuth();
  const { data, recarregar } = useQuery<any[]>(async () => (await db.from("acessos_clinicos").select("*").eq("profissional_id", user!.id).in("status", ["pendente", "autorizado"]).order("created_at", { ascending: false })).data ?? [], [user?.id]);
  const { data: codigos } = useQuery<Record<string, string>>(async () => {
    const { data } = await db.rpc("meus_pacientes");
    return Object.fromEntries((data ?? []).map((p: Paciente) => [p.paciente_id, p.codigo]));
  }, []);
  const ativos = (data ?? []).filter((a) => a.status === "pendente" || new Date(a.expira_em) > new Date());
  if (!ativos.length) return null;
  async function decidir(a: any, autorizar: boolean) {
    let dias = 7;
    if (autorizar) { const r = prompt("Por quantos dias liberar a leitura? (1 a 30)", "7"); if (r === null) return; dias = Number(r) || 7; }
    const { error } = await db.rpc("decidir_acesso_clinico", { _id: a.id, _autorizar: autorizar, _dias: dias });
    error ? toast.error(error.message) : (toast.success(autorizar ? "Leitura autorizada." : a.status === "autorizado" ? "Acesso encerrado." : "Pedido negado."), recarregar());
  }
  return (
    <Card className="flex flex-col gap-2 border-amber-300">
      <h3 className="flex items-center gap-2 font-display font-bold"><ShieldAlert className="h-5 w-5 text-amber-500" /> Pedidos de acesso ao prontuário</h3>
      {ativos.map((a) => (
        <div key={a.id} className="flex flex-col gap-2 rounded-xl bg-muted p-3 text-sm">
          <p><b className="font-mono">{codigos?.[a.paciente_id] ?? "Paciente"}</b> · {fDataHora(a.created_at)}</p>
          <p>Justificativa da administração: “{a.motivo}”</p>
          {a.status === "pendente" ? (
            <div className="flex flex-wrap gap-2"><Btn v="soft" className="min-h-10" onClick={() => decidir(a, true)}>Autorizar leitura</Btn><Btn v="ghost" className="min-h-10" onClick={() => decidir(a, false)}>Negar</Btn></div>
          ) : (
            <div className="flex flex-wrap items-center gap-2"><Chip tom="green">Autorizado até {fDataHora(a.expira_em)}</Chip><Btn v="ghost" className="min-h-10" onClick={() => decidir(a, false)}>Encerrar agora</Btn></div>
          )}
        </div>
      ))}
    </Card>
  );
}

function Horarios({ perfil, onSalvo }: { perfil: PsiPerfil; onSalvo: () => void }) {
  const hojeIso = new Date().toLocaleDateString("sv-SE");
  const { data: datas, recarregar } = useQuery<any[]>(async () => (await db.from("psi_datas").select("*").eq("profissional_id", perfil.user_id).gte("data", hojeIso).order("data").order("hora_inicio")).data ?? [], [perfil.user_id]);
  const { data: disp, recarregar: recDisp } = useQuery<any[]>(async () => (await db.from("psi_disponibilidade").select("*").eq("profissional_id", perfil.user_id).order("dia_semana")).data ?? [], [perfil.user_id]);
  const { data: bloq, recarregar: recBloq } = useQuery<any[]>(async () => (await db.from("psi_bloqueios").select("*").eq("profissional_id", perfil.user_id).gte("fim", new Date().toISOString()).order("inicio")).data ?? [], [perfil.user_id]);
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState<string[]>([]);
  const [faixa, setFaixa] = useState({ ini: "13:00", fim: "15:00" });
  const [regras, setRegras] = useState({ duracao_min: perfil.duracao_min, intervalo_min: perfil.intervalo_min ?? 10, antecedencia_horas: perfil.antecedencia_horas ?? 2 });
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(0, 0, 0, 0);
  const [b, setB] = useState({ ini: paraInputLocal(amanha), fim: paraInputLocal(new Date(amanha.getTime() + 864e5)), motivo: "" });
  const hhmm = (t: string) => t.slice(0, 5);
  const iso = (d: Date) => d.toLocaleDateString("sv-SE");
  const porData = useMemo(() => { const m = new Map<string, any[]>(); (datas ?? []).forEach((x) => m.set(x.data, [...(m.get(x.data) ?? []), x])); return m; }, [datas]);

  const inicioGrade = new Date(mes); inicioGrade.setDate(1 - mes.getDay());
  const celulas = Array.from({ length: 42 }, (_, i) => { const d = new Date(inicioGrade); d.setDate(inicioGrade.getDate() + i); return d; });
  const ultimaLinha = celulas.slice(35).every((d) => d.getMonth() !== mes.getMonth());
  const grade = ultimaLinha ? celulas.slice(0, 35) : celulas;
  const nomeData = (k: string) => new Date(k + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "");

  function alternar(k: string) { setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k].sort())); }
  async function abrir() {
    if (!sel.length) return toast.error("Toque nas datas do calendário.");
    if (faixa.fim <= faixa.ini) return toast.error("O horário final precisa ser depois do inicial.");
    const { error } = await db.from("psi_datas").insert(sel.map((data) => ({ profissional_id: perfil.user_id, data, hora_inicio: faixa.ini, hora_fim: faixa.fim })));
    if (error) return toast.error(error.message);
    toast.success(`Agenda aberta: ${sel.length} data(s), das ${faixa.ini} às ${faixa.fim}.`); setSel([]); recarregar();
  }
  async function remover(id: string) { await db.from("psi_datas").delete().eq("id", id); recarregar(); }
  async function removerSemanal(id: string) { await db.from("psi_disponibilidade").delete().eq("id", id); recDisp(); }
  async function salvarRegras() {
    const { error } = await db.from("psi_perfis").update(regras).eq("user_id", perfil.user_id);
    error ? toast.error(error.message) : (toast.success("Regras da agenda salvas."), onSalvo());
  }
  async function addBloq() {
    const ini = new Date(b.ini), fim = new Date(b.fim);
    if (!(fim > ini)) return toast.error("O fim precisa ser depois do início.");
    const { error } = await db.from("psi_bloqueios").insert({ profissional_id: perfil.user_id, inicio: ini.toISOString(), fim: fim.toISOString(), motivo: b.motivo || null });
    if (error) return toast.error(error.message);
    toast.success("Período bloqueado. Consultas já marcadas nesse período continuam valendo — reagende ou cancele se precisar."); recBloq();
  }
  async function remBloq(id: string) { await db.from("psi_bloqueios").delete().eq("id", id); recBloq(); }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 border-primary">
        <h2 className="font-display text-xl font-bold">Abra sua agenda por data</h2>
        <p className="text-sm font-semibold text-navy">1. Toque nas datas em que vai atender. 2. Escolha o horário (ex.: 13:00 às 15:00). 3. Toque em “Abrir agenda”.</p>
        <div className="flex items-center justify-between">
          <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} disabled={mes <= new Date(new Date().getFullYear(), new Date().getMonth(), 1)} className="tap grid w-12 place-items-center rounded-full border border-border bg-card disabled:opacity-30" aria-label="Mês anterior"><ChevronLeft className="h-5 w-5" /></button>
          <b className="font-display text-lg first-letter:uppercase">{mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</b>
          <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="tap grid w-12 place-items-center rounded-full border border-border bg-card" aria-label="Próximo mês"><ChevronLeft className="h-5 w-5 rotate-180" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-muted-foreground">{["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {grade.map((d) => {
            const k = iso(d); const fora = d.getMonth() !== mes.getMonth(); const passado = k < hojeIso; const tem = porData.has(k); const marcado = sel.includes(k);
            return (
              <button key={k} disabled={passado || fora} onClick={() => alternar(k)} aria-pressed={marcado} aria-label={nomeData(k)}
                className={cn("relative flex aspect-square flex-col items-center justify-center rounded-xl border text-base font-bold",
                  fora ? "invisible" : passado ? "border-transparent text-muted-foreground/40" : marcado ? "border-primary bg-primary text-white" : tem ? "border-success bg-success/15 text-navy" : "border-border bg-card text-navy")}>
                {d.getDate()}
                {tem && !marcado && <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-success" />}
              </button>
            );
          })}
        </div>
        <p className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-success" />com horário aberto</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-primary" />selecionada</span></p>
        {sel.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl bg-primary-soft p-4">
            <p className="text-sm font-semibold">{sel.length} data(s): {sel.map(nomeData).join(", ")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Campo id="f-ini" label="Das" obrigatorio><input id="f-ini" type="time" className={inputCls} value={faixa.ini} onChange={(e) => setFaixa({ ...faixa, ini: e.target.value })} /></Campo>
              <Campo id="f-fim" label="Até" obrigatorio><input id="f-fim" type="time" className={inputCls} value={faixa.fim} onChange={(e) => setFaixa({ ...faixa, fim: e.target.value })} /></Campo>
            </div>
            <div className="flex flex-wrap gap-2"><Btn onClick={abrir} className="flex-1"><Plus className="h-4 w-4" /> Abrir agenda</Btn><Btn v="ghost" onClick={() => setSel([])}>Limpar</Btn></div>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">Datas abertas</h2>
        {!porData.size ? <p className="text-sm text-muted-foreground">Nenhuma data aberta ainda. As mães só conseguem pedir horário nas datas que você abrir.</p> : [...porData.entries()].map(([k, itens]) => (
          <div key={k} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3 text-sm">
            <b className="w-28 first-letter:uppercase">{nomeData(k)}</b>
            {itens.map((x) => <span key={x.id} className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 font-semibold">{hhmm(x.hora_inicio)}–{hhmm(x.hora_fim)}<button onClick={() => remover(x.id)} aria-label={`Fechar ${nomeData(k)} ${hhmm(x.hora_inicio)}`} className="text-muted-foreground hover:text-emergency"><Trash2 className="h-3.5 w-3.5" /></button></span>)}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Dentro de cada horário, as famílias veem vagas de {regras.duracao_min} min com {regras.intervalo_min} min de intervalo (horário da Bahia).</p>
      </Card>

      {!!disp?.length && (
        <Card className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">Horários semanais fixos</h2>
          <p className="text-sm text-muted-foreground">Estes se repetem toda semana. Se preferir só por data, remova.</p>
          {disp.map((x) => <span key={x.id} className="inline-flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-semibold">Toda {DIAS_SEMANA[x.dia_semana]} · {hhmm(x.hora_inicio)}–{hhmm(x.hora_fim)}<button onClick={() => removerSemanal(x.id)} aria-label="Remover" className="text-muted-foreground hover:text-emergency"><Trash2 className="h-3.5 w-3.5" /></button></span>)}
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Regras da agenda</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo id="r-d" label="Duração da consulta" obrigatorio><select id="r-d" className={inputCls} value={regras.duracao_min} onChange={(e) => setRegras({ ...regras, duracao_min: Number(e.target.value) })}>{[30, 40, 45, 50, 60, 90].map((m) => <option key={m} value={m}>{m} minutos</option>)}</select></Campo>
          <Campo id="r-i" label="Intervalo entre atendimentos" obrigatorio><select id="r-i" className={inputCls} value={regras.intervalo_min} onChange={(e) => setRegras({ ...regras, intervalo_min: Number(e.target.value) })}>{[0, 5, 10, 15, 20, 30].map((m) => <option key={m} value={m}>{m ? `${m} minutos` : "Sem intervalo"}</option>)}</select></Campo>
          <Campo id="r-a" label="Antecedência mínima" obrigatorio><select id="r-a" className={inputCls} value={regras.antecedencia_horas} onChange={(e) => setRegras({ ...regras, antecedencia_horas: Number(e.target.value) })}>{[1, 2, 4, 12, 24, 48].map((h) => <option key={h} value={h}>{h} hora(s)</option>)}</select></Campo>
        </div>
        <Btn v="soft" onClick={salvarRegras} className="self-start">Salvar regras</Btn>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><CalendarOff className="h-5 w-5 text-primary" /> Bloqueios, folgas e férias</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Campo id="b-i" label="De" obrigatorio><input id="b-i" type="datetime-local" className={inputCls} value={b.ini} onChange={(e) => setB({ ...b, ini: e.target.value })} /></Campo>
          <Campo id="b-f" label="Até" obrigatorio><input id="b-f" type="datetime-local" className={inputCls} value={b.fim} onChange={(e) => setB({ ...b, fim: e.target.value })} /></Campo>
          <Campo id="b-m" label="Motivo"><input id="b-m" className={inputCls} value={b.motivo} onChange={(e) => setB({ ...b, motivo: e.target.value })} placeholder="Ex.: férias" /></Campo>
        </div>
        <Btn v="outline" onClick={addBloq} className="self-start">Bloquear período</Btn>
        {(bloq ?? []).map((x) => (
          <div key={x.id} className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm">
            <span className="flex-1">{fData(x.inicio)} {fHora(x.inicio)} → {fData(x.fim)} {fHora(x.fim)}{x.motivo ? ` · ${x.motivo}` : ""}</span>
            <button onClick={() => remBloq(x.id)} aria-label="Remover bloqueio" className="tap grid place-items-center text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function FormPerfil({ perfil, onSalvo }: { perfil: PsiPerfil | null; onSalvo: () => void }) {
  const { user, perfil: p0 } = useAuth();
  const [f, setF] = useState({
    nome: perfil?.nome ?? p0?.nome_chamada ?? "", registro: perfil?.registro ?? "", abordagem: perfil?.abordagem ?? "", bio: perfil?.bio ?? "",
    duracao_min: perfil?.duracao_min ?? 50, link_sala: perfil?.link_sala ?? "", aceita_novos: perfil?.aceita_novos ?? true,
    especialidades: perfil?.especialidades ?? [], modalidades: perfil?.modalidades ?? ["online"], endereco_presencial: perfil?.endereco_presencial ?? "",
  });
  const [outra, setOutra] = useState("");
  async function salvar() {
    if (f.nome.trim().length < 3) return toast.error("Informe seu nome profissional.");
    if (!/crp/i.test(f.registro) || f.registro.replace(/\D/g, "").length < 4) return toast.error("Informe o CRP completo. Ex.: CRP 03/12345");
    if (!f.modalidades.length) return toast.error("Escolha pelo menos uma modalidade.");
    if (f.modalidades.includes("presencial") && f.endereco_presencial.trim().length < 8) return toast.error("Informe o endereço do atendimento presencial.");
    if (f.link_sala && !/^https:\/\//.test(f.link_sala)) return toast.error("O link da sala deve começar com https://");
    const dados = {
      user_id: user!.id, nome: f.nome.trim(), registro: f.registro.trim().toUpperCase(), abordagem: f.abordagem.trim() || null, bio: f.bio.trim() || null,
      duracao_min: Number(f.duracao_min), link_sala: f.link_sala.trim() || null, aceita_novos: f.aceita_novos,
      especialidades: f.especialidades, modalidades: f.modalidades, endereco_presencial: f.endereco_presencial.trim() || null,
    };
    const { error } = perfil ? await db.from("psi_perfis").update(dados).eq("user_id", user!.id) : await db.from("psi_perfis").insert(dados);
    if (error) return toast.error(error.message);
    toast.success(perfil ? "Perfil atualizado." : "Perfil enviado! A equipe vai conferir seu CRP."); onSalvo();
  }
  const sugestoes = [...new Set([...ESPECIALIDADES_SUGERIDAS, ...f.especialidades])];
  return (
    <Card className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="pp-n" label="Nome profissional" obrigatorio><input id="pp-n" className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <Campo id="pp-r" label="CRP" obrigatorio dica="Ex.: CRP 03/12345"><input id="pp-r" className={inputCls} value={f.registro} onChange={(e) => setF({ ...f, registro: e.target.value })} /></Campo>
        <Campo id="pp-a" label="Abordagem" dica="Ex.: TCC, ABA, Psicanálise, Sistêmica"><input id="pp-a" className={inputCls} value={f.abordagem} onChange={(e) => setF({ ...f, abordagem: e.target.value })} /></Campo>
        {!perfil && <Campo id="pp-d" label="Duração da sessão"><select id="pp-d" className={inputCls} value={f.duracao_min} onChange={(e) => setF({ ...f, duracao_min: Number(e.target.value) })}>{[30, 40, 45, 50, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}</select></Campo>}
      </div>
      <Campo id="pp-e" label="Especialidades" dica="Toque para marcar. Aparecem para as famílias na escolha do profissional.">
        <Opcoes nome="Especialidades" multi valores={sugestoes} valor={f.especialidades} onChange={(v) => setF({ ...f, especialidades: v })} />
        <div className="flex gap-2"><input className={inputCls} placeholder="Outra especialidade" value={outra} onChange={(e) => setOutra(e.target.value)} aria-label="Outra especialidade" /><Btn v="outline" onClick={() => { const v = outra.trim(); if (v && !f.especialidades.includes(v)) setF({ ...f, especialidades: [...f.especialidades, v] }); setOutra(""); }}>Incluir</Btn></div>
      </Campo>
      <Campo id="pp-m" label="Modalidades de atendimento" obrigatorio>
        <Opcoes nome="Modalidades" multi valores={["Online (vídeo)", "Presencial"]} valor={f.modalidades.map((m) => MODALIDADE[m])} onChange={(v: string[]) => setF({ ...f, modalidades: v.map((x) => (x === "Presencial" ? "presencial" : "online")) })} />
      </Campo>
      {f.modalidades.includes("presencial") && <Campo id="pp-end" label="Endereço do atendimento presencial" obrigatorio dica="Aparece para a família só depois que você confirmar a consulta."><input id="pp-end" className={inputCls} value={f.endereco_presencial} onChange={(e) => setF({ ...f, endereco_presencial: e.target.value })} /></Campo>}
      <Campo id="pp-b" label="Apresentação para as famílias"><textarea id="pp-b" className={textareaCls} maxLength={800} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Sua experiência com famílias atípicas, faixas etárias que atende, etc." /></Campo>
      {f.modalidades.includes("online") && <Campo id="pp-l" label="Link fixo da sua sala" dica="Google Meet, Zoom etc. Se deixar vazio, o app cria uma sala segura (Jitsi) para cada consulta."><input id="pp-l" className={inputCls} value={f.link_sala} onChange={(e) => setF({ ...f, link_sala: e.target.value })} placeholder="https://meet.google.com/..." /></Campo>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.aceita_novos} onChange={(e) => setF({ ...f, aceita_novos: e.target.checked })} /> Aceito novos pacientes</label>
      <Btn onClick={salvar} className="self-start">{perfil ? "Salvar perfil" : "Enviar para validação"}</Btn>
      <p className="text-xs text-muted-foreground">O atendimento online deve seguir as normas do Conselho Federal de Psicologia, incluindo o cadastro no e-Psi quando exigido.</p>
    </Card>
  );
}
