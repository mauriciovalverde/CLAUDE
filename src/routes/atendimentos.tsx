import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarOff, Clock, MessageCircle, NotebookPen, Plus, Settings2, Trash2, UserRound, Video } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, Carregando, Chip, PageHeader, Vazio, btn, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { digits, fData, fDataLonga, fHora, fmtTel, idade, idadeTxt, paraInputLocal, waLink } from "@/lib/br";
import { ATIVA, DIAS_SEMANA, STATUS_CONSULTA, salaAberta, type PsiPerfil } from "@/lib/consultas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/atendimentos")({ component: () => <AppShell><Atendimentos /></AppShell> });

type Aba = "agenda" | "horarios" | "perfil";

function Atendimentos() {
  const { user } = useAuth();
  const [aba, setAba] = useState<Aba>("agenda");
  const { data: perfil, loading, recarregar } = useQuery<PsiPerfil | null>(async () => (await db.from("psi_perfis").select("*").eq("user_id", user!.id).maybeSingle()).data, [user?.id]);
  if (loading) return <Carregando />;
  if (!perfil) return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Atender por" highlight="teleconsulta" subtitle="Psicólogos podem oferecer atendimento online às famílias do Centro. Preencha seu perfil; a equipe confere o CRP e libera sua agenda." />
      <FormPerfil perfil={null} onSalvo={recarregar} />
    </div>
  );
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Meus" highlight="atendimentos" subtitle={`${perfil.nome} · ${perfil.registro}`} />
      {!perfil.ativo && <Aviso tom="amber">Seu perfil está aguardando a validação do CRP pela equipe. Enquanto isso, já pode cadastrar seus horários.</Aviso>}
      <div role="tablist" className="flex gap-1 rounded-full bg-muted p-1">
        {([["agenda", "Agenda", CalendarDays], ["horarios", "Horários", Clock], ["perfil", "Perfil", Settings2]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={cn("tap flex flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold", aba === k ? "bg-card text-primary shadow-card" : "text-muted-foreground")}><I className="h-4 w-4" />{l}</button>
        ))}
      </div>
      {aba === "agenda" && <Agenda />}
      {aba === "horarios" && <Horarios perfil={perfil} />}
      {aba === "perfil" && <FormPerfil perfil={perfil} onSalvo={recarregar} />}
    </div>
  );
}

type Linha = { id: string; inicio: string; fim: string; status: string; motivo: string | null; link_video: string | null; para_quem: string; familia_nome: string; familia_telefone: string | null; cidade: string | null; filho_nome: string | null; filho_nascimento: string | null; total_anteriores: number };

function Agenda() {
  const { user } = useAuth();
  const [passadas, setPassadas] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(t); }, []);
  const { data, loading, recarregar } = useQuery<Linha[]>(async () => {
    const de = passadas ? new Date(Date.now() - 60 * 864e5) : new Date(Date.now() - 864e5);
    const ate = passadas ? new Date() : new Date(Date.now() + 60 * 864e5);
    const { data } = await db.rpc("consultas_profissional", { _de: de.toISOString(), _ate: ate.toISOString() });
    return (data ?? []) as Linha[];
  }, [passadas]);
  const [notaAberta, setNotaAberta] = useState<string | null>(null);

  const lista = (data ?? []).filter((c) => passadas ? true : ATIVA(c.status) || new Date(c.inicio).getTime() > agora - 864e5);
  const porDia = useMemo(() => {
    const m = new Map<string, Linha[]>();
    (passadas ? [...lista].reverse() : lista).forEach((c) => { const k = new Date(c.inicio).toDateString(); m.set(k, [...(m.get(k) ?? []), c]); });
    return [...m.entries()];
  }, [lista, passadas]);

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
  const hoje = (data ?? []).filter((c) => ATIVA(c.status) && new Date(c.inicio).toDateString() === new Date().toDateString()).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tom="blue">{hoje} consulta(s) hoje</Chip>
        <span className="flex-1" />
        <Btn v="outline" className="min-h-10" onClick={() => setPassadas(!passadas)}>{passadas ? "Ver próximas" : "Ver últimos 60 dias"}</Btn>
      </div>
      {loading ? <Carregando /> : !porDia.length ? <Vazio icon={CalendarDays} titulo={passadas ? "Nenhum atendimento no período" : "Nenhuma consulta marcada"} texto={passadas ? undefined : "Quando uma família agendar, você recebe um aviso e a consulta aparece aqui."} /> : porDia.map(([k, cs]) => (
        <section key={k} className="flex flex-col gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{fDataLonga(cs[0]!.inicio)}</h3>
          {cs.map((c) => {
            const [st, tom] = STATUS_CONSULTA[c.status]!;
            const aberta = salaAberta(c.inicio, c.fim, agora);
            const passou = new Date(c.inicio).getTime() < agora;
            return (
              <Card key={c.id} className={cn("flex flex-col gap-2", aberta && ATIVA(c.status) && "border-success")}>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="font-display text-lg">{fHora(c.inicio)}–{fHora(c.fim)}</b>
                  <Chip tom={tom}>{st}</Chip>
                  <Chip tom={c.total_anteriores ? "navy" : "coral"}>{c.total_anteriores ? `${c.total_anteriores + 1}ª sessão` : "1ª consulta"}</Chip>
                </div>
                <p><UserRound className="mr-1 inline h-4 w-4 text-primary" /><b>{c.familia_nome}</b>{c.cidade ? ` · ${c.cidade}` : ""}</p>
                <p className="text-sm">Para: {c.para_quem === "filho" ? `${c.filho_nome ?? "criança"}${c.filho_nascimento ? ` (${idadeTxt(c.filho_nascimento)})` : ""}` : c.para_quem === "familia" ? "a família" : "a mãe / responsável"}</p>
                {c.motivo && <p className="rounded-xl bg-muted p-3 text-sm">“{c.motivo}”</p>}
                {ATIVA(c.status) && (
                  <div className="flex flex-wrap gap-2">
                    {c.link_video && <a href={c.link_video} target="_blank" rel="noopener noreferrer" className={cn(btn.base, aberta ? btn.wa : btn.outline, "min-h-10")}><Video className="h-4 w-4" /> {aberta ? "Entrar na sala" : "Sala"}</a>}
                    {c.status === "agendada" && !passou && <Btn v="soft" className="min-h-10" onClick={() => mudar(c, "confirmada")}>Confirmar</Btn>}
                    {passou && <Btn v="soft" className="min-h-10" onClick={() => mudar(c, "realizada")}>Realizada</Btn>}
                    {passou && <Btn v="outline" className="min-h-10" onClick={() => mudar(c, "falta")}>Não compareceu</Btn>}
                    {!passou && <Btn v="ghost" className="min-h-10" onClick={() => cancelar(c)}>Cancelar</Btn>}
                    {c.familia_telefone && <a href={waLink((digits(c.familia_telefone).length <= 11 ? "55" : "") + digits(c.familia_telefone), `Olá, ${c.familia_nome.split(" ")[0]}! Sobre a sua teleconsulta de ${fData(c.inicio)} às ${fHora(c.inicio)}.`)} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.outline, "min-h-10")} aria-label={`WhatsApp ${fmtTel(c.familia_telefone)}`}><MessageCircle className="h-4 w-4" /></a>}
                  </div>
                )}
                <button onClick={() => setNotaAberta(notaAberta === c.id ? null : c.id)} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary"><NotebookPen className="h-4 w-4" /> Anotações privadas</button>
                {notaAberta === c.id && <Nota consultaId={c.id} profId={user!.id} />}
              </Card>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function Nota({ consultaId, profId }: { consultaId: string; profId: string }) {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => { db.from("consulta_notas").select("texto").eq("consulta_id", consultaId).maybeSingle().then(({ data }: any) => setT(data?.texto ?? "")); }, [consultaId]);
  async function salvar() {
    const { error } = await db.from("consulta_notas").upsert({ consulta_id: consultaId, profissional_id: profId, texto: t ?? "", updated_at: new Date().toISOString() });
    error ? toast.error(error.message) : toast.success("Anotação salva.");
  }
  if (t === null) return <Carregando />;
  return (
    <div className="flex flex-col gap-2">
      <textarea aria-label="Anotações" className={textareaCls} value={t} onChange={(e) => setT(e.target.value)} placeholder="Visível só para você. Nem a família nem a equipe do Centro têm acesso." />
      <Btn v="soft" className="min-h-10 self-start" onClick={salvar}>Salvar anotação</Btn>
    </div>
  );
}

function Horarios({ perfil }: { perfil: PsiPerfil }) {
  const { data: disp, recarregar } = useQuery<any[]>(async () => (await db.from("psi_disponibilidade").select("*").eq("profissional_id", perfil.user_id).order("hora_inicio")).data ?? [], [perfil.user_id]);
  const { data: bloq, recarregar: recBloq } = useQuery<any[]>(async () => (await db.from("psi_bloqueios").select("*").eq("profissional_id", perfil.user_id).gte("fim", new Date().toISOString()).order("inicio")).data ?? [], [perfil.user_id]);
  const [novo, setNovo] = useState({ dia: 1, ini: "08:00", fim: "12:00" });
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(0, 0, 0, 0);
  const [b, setB] = useState({ ini: paraInputLocal(amanha), fim: paraInputLocal(new Date(amanha.getTime() + 864e5)), motivo: "" });

  async function addDisp() {
    if (novo.fim <= novo.ini) return toast.error("O horário final precisa ser depois do inicial.");
    const { error } = await db.from("psi_disponibilidade").insert({ profissional_id: perfil.user_id, dia_semana: novo.dia, hora_inicio: novo.ini, hora_fim: novo.fim });
    if (error) return toast.error(error.message);
    recarregar();
  }
  async function copiarSemana() {
    const base = (disp ?? []).filter((d) => d.dia_semana === novo.dia);
    if (!base.length) return toast.error(`Cadastre primeiro os horários de ${DIAS_SEMANA[novo.dia]}.`);
    const linhas = [1, 2, 3, 4, 5].filter((d) => d !== novo.dia && !(disp ?? []).some((x) => x.dia_semana === d)).flatMap((d) => base.map((x) => ({ profissional_id: perfil.user_id, dia_semana: d, hora_inicio: x.hora_inicio, hora_fim: x.hora_fim })));
    if (!linhas.length) return toast("Os outros dias úteis já têm horários.");
    const { error } = await db.from("psi_disponibilidade").insert(linhas);
    error ? toast.error(error.message) : (toast.success("Horários copiados para os outros dias úteis."), recarregar());
  }
  async function remover(id: string) { await db.from("psi_disponibilidade").delete().eq("id", id); recarregar(); }
  async function addBloq() {
    const ini = new Date(b.ini), fim = new Date(b.fim);
    if (!(fim > ini)) return toast.error("O fim precisa ser depois do início.");
    const { error } = await db.from("psi_bloqueios").insert({ profissional_id: perfil.user_id, inicio: ini.toISOString(), fim: fim.toISOString(), motivo: b.motivo || null });
    if (error) return toast.error(error.message);
    toast.success("Período bloqueado. Consultas já marcadas nesse período continuam valendo — cancele-as se precisar."); recBloq();
  }
  async function remBloq(id: string) { await db.from("psi_bloqueios").delete().eq("id", id); recBloq(); }
  const hhmm = (t: string) => t.slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Horários semanais de atendimento</h2>
        <p className="text-sm text-muted-foreground">As famílias veem vagas de {perfil.duracao_min} minutos dentro destes horários (horário da Bahia), com pelo menos 2 horas de antecedência.</p>
        <ul className="flex flex-col gap-2">
          {DIAS_SEMANA.map((nome, i) => {
            const itens = (disp ?? []).filter((d) => d.dia_semana === i);
            return (
              <li key={nome} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3 text-sm">
                <b className="w-20">{nome}</b>
                {itens.length ? itens.map((d) => (
                  <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 font-semibold">{hhmm(d.hora_inicio)}–{hhmm(d.hora_fim)}<button onClick={() => remover(d.id)} aria-label={`Remover ${nome} ${hhmm(d.hora_inicio)}`} className="text-muted-foreground hover:text-emergency"><Trash2 className="h-3.5 w-3.5" /></button></span>
                )) : <span className="text-muted-foreground">Sem atendimento</span>}
              </li>
            );
          })}
        </ul>
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]">
          <Campo id="h-dia" label="Dia"><select id="h-dia" className={inputCls} value={novo.dia} onChange={(e) => setNovo({ ...novo, dia: Number(e.target.value) })}>{DIAS_SEMANA.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Campo>
          <Campo id="h-ini" label="Das"><input id="h-ini" type="time" className={inputCls} value={novo.ini} onChange={(e) => setNovo({ ...novo, ini: e.target.value })} /></Campo>
          <Campo id="h-fim" label="Até"><input id="h-fim" type="time" className={inputCls} value={novo.fim} onChange={(e) => setNovo({ ...novo, fim: e.target.value })} /></Campo>
          <Btn onClick={addDisp} className="col-span-3 sm:col-span-1"><Plus className="h-4 w-4" /> Adicionar</Btn>
        </div>
        <Btn v="ghost" className="self-start text-sm" onClick={copiarSemana}>Copiar {DIAS_SEMANA[novo.dia]} para os outros dias úteis</Btn>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><CalendarOff className="h-5 w-5 text-primary" /> Folgas e férias</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Campo id="b-i" label="De"><input id="b-i" type="datetime-local" className={inputCls} value={b.ini} onChange={(e) => setB({ ...b, ini: e.target.value })} /></Campo>
          <Campo id="b-f" label="Até"><input id="b-f" type="datetime-local" className={inputCls} value={b.fim} onChange={(e) => setB({ ...b, fim: e.target.value })} /></Campo>
          <Campo id="b-m" label="Motivo"><input id="b-m" className={inputCls} value={b.motivo} onChange={(e) => setB({ ...b, motivo: e.target.value })} /></Campo>
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
  });
  async function salvar() {
    if (f.nome.trim().length < 3) return toast.error("Informe seu nome profissional.");
    if (!/crp/i.test(f.registro) || f.registro.replace(/\D/g, "").length < 4) return toast.error("Informe o CRP completo. Ex.: CRP 03/12345");
    if (f.link_sala && !/^https:\/\//.test(f.link_sala)) return toast.error("O link da sala deve começar com https://");
    const dados = { user_id: user!.id, nome: f.nome.trim(), registro: f.registro.trim().toUpperCase(), abordagem: f.abordagem.trim() || null, bio: f.bio.trim() || null, duracao_min: Number(f.duracao_min), link_sala: f.link_sala.trim() || null, aceita_novos: f.aceita_novos };
    const { error } = perfil ? await db.from("psi_perfis").update(dados).eq("user_id", user!.id) : await db.from("psi_perfis").insert(dados);
    if (error) return toast.error(error.message);
    toast.success(perfil ? "Perfil atualizado." : "Perfil enviado! A equipe vai conferir seu CRP."); onSalvo();
  }
  return (
    <Card className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="pp-n" label="Nome profissional" obrigatorio><input id="pp-n" className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <Campo id="pp-r" label="CRP" obrigatorio dica="Ex.: CRP 03/12345"><input id="pp-r" className={inputCls} value={f.registro} onChange={(e) => setF({ ...f, registro: e.target.value })} /></Campo>
        <Campo id="pp-a" label="Abordagem" dica="Ex.: TCC, ABA, Psicanálise, Sistêmica"><input id="pp-a" className={inputCls} value={f.abordagem} onChange={(e) => setF({ ...f, abordagem: e.target.value })} /></Campo>
        <Campo id="pp-d" label="Duração da sessão"><select id="pp-d" className={inputCls} value={f.duracao_min} onChange={(e) => setF({ ...f, duracao_min: Number(e.target.value) })}>{[30, 40, 45, 50, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}</select></Campo>
      </div>
      <Campo id="pp-b" label="Apresentação para as famílias"><textarea id="pp-b" className={textareaCls} maxLength={800} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Sua experiência com famílias atípicas, faixas etárias que atende, etc." /></Campo>
      <Campo id="pp-l" label="Link fixo da sua sala" dica="Google Meet, Zoom etc. Se deixar vazio, o app cria uma sala segura (Jitsi) para cada consulta."><input id="pp-l" className={inputCls} value={f.link_sala} onChange={(e) => setF({ ...f, link_sala: e.target.value })} placeholder="https://meet.google.com/..." /></Campo>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.aceita_novos} onChange={(e) => setF({ ...f, aceita_novos: e.target.checked })} /> Aceito novas famílias</label>
      <Btn onClick={salvar} className="self-start">{perfil ? "Salvar perfil" : "Enviar para validação"}</Btn>
      <p className="text-xs text-muted-foreground">O atendimento online deve seguir as normas do Conselho Federal de Psicologia, incluindo o cadastro no e-Psi quando exigido.</p>
    </Card>
  );
}
