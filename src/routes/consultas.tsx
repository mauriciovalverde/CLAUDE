import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarPlus, ChevronLeft, Clock, Copy, Hourglass, Lightbulb, MapPin, MessageCircle, Video, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, Carregando, Chip, PageHeader, Vazio, btn, textareaCls } from "@/components/app/kit";
import { iniciais } from "@/components/app/diretorio";
import { useAuth } from "@/lib/auth";
import { db, useConfig, useFilhos, useQuery } from "@/lib/dados";
import { WHATSAPP_PADRAO, fDataLonga, fHora, fmtTel, idadeTxt, waLink } from "@/lib/br";
import { ATIVA, DICAS_TELECONSULTA, MODALIDADE, STATUS_CONSULTA, falta, linkGoogleAgenda, mensagemWhatsApp, salaAberta, type PsiPerfil } from "@/lib/consultas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/consultas")({ component: () => <AppShell><Consultas /></AppShell> });

type Consulta = {
  id: string; profissional_id: string; inicio: string; fim: string; status: string; motivo: string | null; link_video: string | null;
  para_quem: string; filho_id: string | null; cancelado_motivo: string | null; recusa_motivo: string | null; modalidade: string;
};
type Filho = { id: string; nome: string; nascimento: string | null };

function useWhats() {
  const cfg = useConfig();
  return cfg.whatsapp_agendamento || cfg.numero_confirmacao || WHATSAPP_PADRAO;
}

function Consultas() {
  const { familia } = useAuth();
  const whats = useWhats();
  const [agendando, setAgendando] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(t); }, []);
  const { data, loading, recarregar } = useQuery(async () => {
    if (!familia) return { cs: [] as Consulta[], psis: [] as PsiPerfil[] };
    const [c, p] = await Promise.all([
      db.from("consultas").select("*").eq("familia_id", familia.id).order("inicio", { ascending: false }).limit(100),
      db.from("psi_perfis").select("*").eq("ativo", true).order("nome"),
    ]);
    return { cs: (c.data ?? []) as Consulta[], psis: (p.data ?? []) as PsiPerfil[] };
  }, [familia?.id]);
  const { data: filhos } = useFilhos(familia?.id);

  if (!familia) return <Vazio icon={CalendarCheck} titulo="Complete seu cadastro" texto="Para agendar consultas, complete o cadastro da família."><Link to="/completar-cadastro" className={cn(btn.base, btn.primary)}>Completar cadastro</Link></Vazio>;
  if (loading || !data) return <Carregando />;

  const proximas = data.cs.filter((c) => ATIVA(c.status) && new Date(c.fim).getTime() + 30 * 60000 > agora).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const historico = data.cs.filter((c) => !proximas.includes(c));
  const psiDe = (id: string) => data.psis.find((p) => p.user_id === id);
  const nomePsi = (id: string) => psiDe(id)?.nome ?? "Psicólogo(a)";
  const filhoDe = (id: string | null) => filhos?.find((f) => f.id === id);
  const aprovada = familia.status === "aprovado";

  function dadosMsg(c: Consulta) {
    const fi = c.para_quem === "filho" ? filhoDe(c.filho_id) : null;
    return mensagemWhatsApp({
      nome: fi?.nome ?? String(familia!.mae_nome), nascimento: (fi ? fi.nascimento : (familia!.mae_nascimento as string | null)) ?? null,
      telefone: (familia!.mae_telefone as string | null) ?? null, psicologo: nomePsi(c.profissional_id), inicio: c.inicio, modalidade: c.modalidade,
    });
  }

  async function cancelar(c: Consulta) {
    const motivo = prompt("Quer contar o motivo do cancelamento? (opcional)");
    if (motivo === null) return;
    const { error } = await db.rpc("cancelar_consulta", { _id: c.id, _motivo: motivo });
    if (error) return toast.error(error.message);
    toast.success("Cancelada. O horário foi liberado."); recarregar();
  }

  if (agendando) return <Agendar psis={data.psis} filhos={filhos ?? []} whats={whats} onVoltar={() => setAgendando(false)} onAgendado={() => { setAgendando(false); recarregar(); }} />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Consultas" highlight="com psicólogos" subtitle="Atendimento psicológico online ou presencial, com profissionais validados pela equipe do AMPARO."
        right={aprovada && data.psis.length > 0 ? <Btn onClick={() => setAgendando(true)}><CalendarPlus className="h-4 w-4" /> Agendar consulta</Btn> : undefined} />
      {!aprovada && <Aviso tom="amber">O agendamento é liberado depois que a equipe confirmar o seu cadastro.</Aviso>}
      {aprovada && !data.psis.length && <Aviso>Ainda não há psicólogos com agenda aberta. Assim que houver, você recebe um aviso.</Aviso>}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold">Próximas consultas</h2>
        {!proximas.length ? (
          <Card className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground">Nenhuma consulta marcada.</p>
            {aprovada && data.psis.length > 0 && <Btn v="soft" onClick={() => setAgendando(true)}><CalendarPlus className="h-4 w-4" /> Escolher horário</Btn>}
          </Card>
        ) : proximas.map((c) => {
          const aberta = salaAberta(c.inicio, c.fim, agora);
          const [st, tom] = STATUS_CONSULTA[c.status] ?? [c.status, "navy"];
          const pendente = c.status === "pendente";
          const fi = c.para_quem === "filho" ? filhoDe(c.filho_id) : null;
          return (
            <Card key={c.id} className={cn("flex flex-col gap-3", aberta && !pendente && "border-success", pendente && "border-amber-300")}>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tom={tom}>{pendente && <Hourglass className="h-3 w-3" />}{st}</Chip>
                <Chip tom="blue">{MODALIDADE[c.modalidade] ?? "Online"}</Chip>
                {!pendente && <span className="text-sm font-semibold text-primary">{falta(c.inicio, agora)}</span>}
              </div>
              <div>
                <p className="font-display text-xl font-bold">{fDataLonga(c.inicio)}</p>
                <p className="text-lg"><Clock className="mr-1 inline h-4 w-4" />{fHora(c.inicio)} – {fHora(c.fim)}</p>
                <p className="text-sm text-muted-foreground">Com {nomePsi(c.profissional_id)} · {c.para_quem === "filho" ? `para ${fi?.nome.split(" ")[0] ?? "a criança"}` : c.para_quem === "familia" ? "para a família" : "para você"}</p>
              </div>
              {pendente ? (
                <>
                  <p className="rounded-xl bg-amber-50 p-3 text-sm">O profissional ainda vai confirmar este horário. Você recebe um aviso no app assim que ele responder.</p>
                  <div className="flex flex-wrap gap-2">
                    <a href={waLink(whats, dadosMsg(c))} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.wa)}><MessageCircle className="h-4 w-4" /> Enviar no WhatsApp</a>
                    <Btn v="ghost" onClick={() => cancelar(c)}>Desistir</Btn>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {c.modalidade === "presencial" ? (
                    <span className={cn(btn.base, "bg-muted text-navy")}><MapPin className="h-5 w-5" /> {psiDe(c.profissional_id)?.endereco_presencial || "Endereço enviado pelo Centro"}</span>
                  ) : aberta && c.link_video
                    ? <a href={c.link_video} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.wa)}><Video className="h-5 w-5" /> Entrar no Google Meet</a>
                    : <span className={cn(btn.base, "bg-muted text-muted-foreground")}><Video className="h-5 w-5" /> {c.link_video ? "O Google Meet abre 15 min antes" : "Link do Google Meet em breve"}</span>}
                  <a href={linkGoogleAgenda(`Consulta com ${nomePsi(c.profissional_id)}`, c.inicio, c.fim, c.modalidade === "presencial" ? "Consulta presencial" : `Entre pelo app: ${c.link_video ?? ""}`)} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.outline)}><CalendarPlus className="h-4 w-4" /> Google Agenda</a>
                  <Btn v="ghost" onClick={() => cancelar(c)}>Cancelar</Btn>
                </div>
              )}
            </Card>
          );
        })}
      </section>

      <Card className="bg-primary-soft">
        <h3 className="mb-2 flex items-center gap-2 font-display font-bold"><Lightbulb className="h-5 w-5 text-primary" /> Para a consulta online dar certo</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">{DICAS_TELECONSULTA.map((d) => <li key={d}>{d}</li>)}</ul>
      </Card>

      {historico.length > 0 && (
        <details className="card-soft p-4" open={historico.some((c) => c.status === "recusada" && new Date(c.inicio).getTime() > agora)}>
          <summary className="tap flex cursor-pointer items-center font-display font-bold">Histórico ({historico.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {historico.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 border-t pt-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1">{fDataLonga(c.inicio)} · {fHora(c.inicio)} · {nomePsi(c.profissional_id)}</span>
                  <Chip tom={STATUS_CONSULTA[c.status]?.[1]}>{STATUS_CONSULTA[c.status]?.[0] ?? c.status}</Chip>
                </div>
                {c.status === "recusada" && <p className="text-muted-foreground">{c.recusa_motivo ? `Motivo: ${c.recusa_motivo}. ` : ""}Escolha outro horário em “Agendar consulta”.</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
      <Link to="/atendimentos" className="text-center text-sm font-semibold text-primary">É psicólogo(a)? Abra sua agenda de atendimentos →</Link>
      <Aviso tom="red">Consulta agendada não é atendimento de emergência. Em crise ou risco, ligue <a href="tel:192" className="font-bold underline">192</a> (SAMU) ou <a href="tel:188" className="font-bold underline">188</a> (CVV).</Aviso>
    </div>
  );
}

type Resultado = { id: string; nome: string; nascimento: string | null; telefone: string | null; psicologo: string; inicio: string; modalidade: string; whatsapp: string };

function Agendar({ psis, filhos, whats, onVoltar, onAgendado }: { psis: PsiPerfil[]; filhos: Filho[]; whats: string; onVoltar: () => void; onAgendado: () => void }) {
  const { familia } = useAuth();
  const [psi, setPsi] = useState<PsiPerfil | null>(psis.length === 1 ? psis[0] : null);
  const [dia, setDia] = useState<string>("");
  const [slot, setSlot] = useState<{ inicio: string; fim: string } | null>(null);
  // O atendimento é só para o titular do cadastro (a mãe/responsável), nunca para a criança.
  const paraQuem: string = "mae";
  const [filho, setFilho] = useState(filhos[0]?.id ?? "");
  const [modalidade, setModalidade] = useState("online");
  const [motivo, setMotivo] = useState("");
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<Resultado | null>(null);
  useEffect(() => { if (psi) setModalidade(psi.modalidades?.[0] ?? "online"); }, [psi]);

  const { data: slots, loading } = useQuery<{ inicio: string; fim: string }[]>(async () => {
    if (!psi) return [];
    const hoje = new Date(); const ate = new Date(Date.now() + 60 * 864e5);
    const iso = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Bahia" });
    const { data } = await db.rpc("horarios_livres", { _prof: psi.user_id, _de: iso(hoje), _ate: iso(ate) });
    return data ?? [];
  }, [psi?.user_id]);

  const porDia = useMemo(() => {
    const m = new Map<string, { inicio: string; fim: string }[]>();
    (slots ?? []).forEach((s) => { const k = new Date(s.inicio).toLocaleDateString("sv-SE"); m.set(k, [...(m.get(k) ?? []), s]); });
    return m;
  }, [slots]);
  useEffect(() => { if (!dia && porDia.size) setDia([...porDia.keys()][0]); }, [porDia, dia]);

  const fi = paraQuem === "filho" ? filhos.find((f) => f.id === filho) : null;
  const paciente = { nome: fi?.nome ?? String(familia?.mae_nome ?? ""), nascimento: (fi ? fi.nascimento : (familia?.mae_nascimento as string | null)) ?? null, telefone: (familia?.mae_telefone as string | null) ?? null };

  async function confirmar() {
    if (!psi || !slot) return;
    if (!aceite) return toast.error("Confirme que leu as orientações.");
    if (paraQuem === "filho" && !filho) return toast.error("Escolha a criança.");
    // Abre a aba já no clique (os navegadores bloqueiam janelas abertas depois de uma espera).
    const janela = window.open("", "_blank");
    setEnviando(true);
    const { data, error } = await db.rpc("solicitar_consulta", { _prof: psi.user_id, _inicio: slot.inicio, _para_quem: paraQuem, _filho: paraQuem === "filho" ? filho : null, _modalidade: modalidade, _motivo: motivo.trim() || null });
    setEnviando(false);
    if (error) { janela?.close(); toast.error(error.message); setSlot(null); return; }
    const r = data as Resultado;
    setFeito(r);
    const link = waLink(r.whatsapp || whats, mensagemWhatsApp(r));
    if (janela) janela.location.href = link; else window.location.href = link;
  }

  if (feito) return <Solicitado r={feito} whats={whats} onFechar={onAgendado} />;

  return (
    <div className="flex flex-col gap-5">
      <button onClick={psi && psis.length > 1 && !slot ? () => { setPsi(null); setDia(""); } : slot ? () => setSlot(null) : onVoltar} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Voltar</button>
      <PageHeader title="Agendar" highlight="consulta" subtitle={!psi ? "1 de 3 · Escolha o profissional" : !slot ? "2 de 3 · Escolha dia e horário" : "3 de 3 · Confira seus dados"} />

      {!psi && (
        <div className="flex flex-col gap-3">
          {psis.map((p) => (
            <button key={p.user_id} onClick={() => setPsi(p)} className="card-soft flex gap-4 p-4 text-left transition hover:border-primary">
              {p.foto_url ? <img src={p.foto_url} alt="" className="h-16 w-16 rounded-full object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-xl font-extrabold text-primary">{iniciais(p.nome)}</span>}
              <span className="min-w-0 flex-1">
                <b className="block font-display text-lg text-navy">{p.nome}</b>
                <span className="text-sm text-muted-foreground">Psicólogo(a) · {p.registro}{p.abordagem ? ` · ${p.abordagem}` : ""}</span>
                {!!p.especialidades?.length && <span className="mt-1.5 flex flex-wrap gap-1">{p.especialidades.slice(0, 6).map((e) => <Chip key={e} tom="blue">{e}</Chip>)}</span>}
                {p.bio && <span className="mt-1 line-clamp-3 block text-sm">{p.bio}</span>}
                <span className="mt-1 block text-xs font-semibold text-primary">Sessão de {p.duracao_min} min · {(p.modalidades ?? ["online"]).map((m) => MODALIDADE[m]).join(" ou ")}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {psi && !slot && (loading ? <Carregando /> : !porDia.size ? (
        <Vazio icon={CalendarCheck} titulo="Sem horários livres" texto={`${psi.nome} não tem horários disponíveis nos próximos 60 dias. Tente outro profissional ou volte depois.`} />
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Dias">
            {[...porDia.keys()].map((k) => {
              const d = new Date(k + "T12:00:00");
              return (
                <button key={k} role="tab" aria-selected={dia === k} onClick={() => setDia(k)} className={cn("flex min-w-16 shrink-0 flex-col items-center rounded-2xl border px-3 py-2", dia === k ? "border-primary bg-primary text-white" : "border-border bg-card")}>
                  <span className="text-xs font-semibold uppercase">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
                  <span className="font-display text-xl font-extrabold">{d.getDate()}</span>
                  <span className="text-[11px]">{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                </button>
              );
            })}
          </div>
          <p className="font-semibold">{dia && fDataLonga(dia + "T12:00:00")}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {(porDia.get(dia) ?? []).map((s) => (
              <button key={s.inicio} onClick={() => setSlot(s)} className="tap rounded-xl border border-border bg-card font-display text-lg font-bold text-navy hover:border-primary hover:bg-primary-soft">{fHora(s.inicio)}</button>
            ))}
          </div>
        </>
      ))}

      {psi && slot && (
        <Card className="flex flex-col gap-4">
          <div className="rounded-2xl bg-primary-soft p-4">
            <p className="font-display text-lg font-bold">{fDataLonga(slot.inicio)} · {fHora(slot.inicio)}</p>
            <p className="text-sm">{psi.nome} · {psi.registro} · {psi.duracao_min} min</p>
          </div>
          {(psi.modalidades?.length ?? 0) > 1 && (
            <Campo id="ag-mod" label="Modalidade" obrigatorio>
              <div className="flex flex-wrap gap-2">
                {psi.modalidades.map((m) => <button key={m} type="button" onClick={() => setModalidade(m)} className={cn("tap rounded-full border px-4 text-sm font-semibold", modalidade === m ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{MODALIDADE[m]}</button>)}
              </div>
              {modalidade === "presencial" && psi.endereco_presencial && <p className="text-sm text-muted-foreground"><MapPin className="mr-1 inline h-4 w-4" />{psi.endereco_presencial}</p>}
            </Campo>
          )}
          <div className="rounded-2xl border border-border p-4">
            <p className="mb-2 text-sm font-bold text-navy">Dados do paciente</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Nome</dt><dd className="font-semibold">{paciente.nome || "—"}</dd>
              <dt className="text-muted-foreground">Nascimento</dt><dd className="font-semibold">{paciente.nascimento ? new Date(paciente.nascimento + "T12:00:00").toLocaleDateString("pt-BR") : "não informado"}</dd>
              <dt className="text-muted-foreground">Telefone</dt><dd className="font-semibold">{paciente.telefone ? fmtTel(paciente.telefone) : "não informado"}</dd>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Vêm do seu cadastro. Para corrigir, use Perfil → Editar cadastro. O psicólogo não vê seu telefone nem e-mail: o contato é feito pela equipe do AMPARO.</p>
          </div>
          <Campo id="ag-mot" label="Quer adiantar o assunto?" dica="Uma frase basta. Os detalhes você conversa com o profissional.">
            <textarea id="ag-mot" className={textareaCls} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: me sinto muito cansada e ansiosa com a rotina" />
          </Campo>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
            <span>Entendo que este é um <b>pedido</b>: a consulta só vale depois que o profissional confirmar. O atendimento segue o sigilo profissional da Psicologia e, em emergência, devo ligar 192 ou 188.</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Btn onClick={confirmar} disabled={enviando} className="min-h-14 w-full whitespace-nowrap text-lg tracking-wide sm:flex-1">{enviando ? "Enviando…" : "QUERO AGENDAR"}</Btn>
            <Btn v="ghost" onClick={() => setSlot(null)}><X className="h-4 w-4" /> Trocar horário</Btn>
          </div>
          <p className="text-xs text-muted-foreground">Ao tocar em QUERO AGENDAR, abrimos o WhatsApp do AMPARO com a mensagem pronta.</p>
        </Card>
      )}
    </div>
  );
}

function Solicitado({ r, whats, onFechar }: { r: Resultado; whats: string; onFechar: () => void }) {
  const msg = mensagemWhatsApp(r);
  async function copiar() {
    try { await navigator.clipboard.writeText(msg); toast.success("Mensagem copiada."); } catch { toast.error("Não foi possível copiar. Selecione o texto e copie."); }
  }
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col items-center gap-2 py-6 text-center">
        <Hourglass className="h-12 w-12 text-amber-500" />
        <Chip tom="amber">PENDENTE</Chip>
        <h1 className="font-display text-2xl font-extrabold">Pedido registrado!</h1>
        <p><b>{fDataLonga(r.inicio)}</b>, às <b>{fHora(r.inicio)}</b> · {r.psicologo}</p>
        <p className="max-w-md text-sm text-muted-foreground">Envie a mensagem no WhatsApp do AMPARO. O profissional confirma ou recusa pelo painel e você recebe o aviso aqui no app.</p>
      </Card>
      <Aviso tom="amber"><b>Importante:</b> abrir o WhatsApp não confirma a consulta. Ela só vale quando o status mudar para <b>Confirmada</b>.</Aviso>
      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Mensagem automática para WhatsApp</h2>
        <pre className="whitespace-pre-wrap rounded-xl bg-muted p-4 font-sans text-sm">{msg.replace(/\*/g, "")}</pre>
        <div className="flex flex-wrap gap-2">
          <a href={waLink(r.whatsapp || whats, msg)} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.wa, "flex-1")}><MessageCircle className="h-5 w-5" /> Abrir WhatsApp</a>
          <Btn v="outline" onClick={copiar}><Copy className="h-4 w-4" /> Copiar modelo</Btn>
        </div>
      </Card>
      <Btn v="soft" onClick={onFechar}>Ver minhas consultas</Btn>
    </div>
  );
}
