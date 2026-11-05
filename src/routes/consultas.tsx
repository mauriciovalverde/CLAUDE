import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarPlus, CheckCircle2, ChevronLeft, Clock, Lightbulb, Video, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, Carregando, Chip, PageHeader, Vazio, btn, textareaCls } from "@/components/app/kit";
import { iniciais } from "@/components/app/diretorio";
import { useAuth } from "@/lib/auth";
import { db, useFilhos, useQuery } from "@/lib/dados";
import { fDataLonga, fHora, idade, idadeTxt } from "@/lib/br";
import { ATIVA, DICAS_TELECONSULTA, STATUS_CONSULTA, falta, linkGoogleAgenda, salaAberta, type PsiPerfil } from "@/lib/consultas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/consultas")({ component: () => <AppShell><Consultas /></AppShell> });

type Consulta = { id: string; profissional_id: string; inicio: string; fim: string; status: string; motivo: string | null; link_video: string | null; para_quem: string; filho_id: string | null; cancelado_motivo: string | null };

function Consultas() {
  const { familia } = useAuth();
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

  if (!familia) return <Vazio icon={CalendarCheck} titulo="Complete seu cadastro" texto="Para agendar teleconsultas, complete o cadastro da família."><Link to="/completar-cadastro" className={cn(btn.base, btn.primary)}>Completar cadastro</Link></Vazio>;
  if (loading || !data) return <Carregando />;

  const proximas = data.cs.filter((c) => ATIVA(c.status) && new Date(c.fim).getTime() + 30 * 60000 > agora).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const historico = data.cs.filter((c) => !proximas.includes(c));
  const nomePsi = (id: string) => data.psis.find((p) => p.user_id === id)?.nome ?? "Psicólogo(a)";
  const nomeFilho = (id: string | null) => filhos?.find((f) => f.id === id)?.nome.split(" ")[0];
  const aprovada = familia.status === "aprovado";

  async function cancelar(c: Consulta) {
    const motivo = prompt("Quer contar o motivo do cancelamento? (opcional)");
    if (motivo === null) return;
    const { error } = await db.rpc("cancelar_consulta", { _id: c.id, _motivo: motivo });
    if (error) return toast.error(error.message);
    toast.success("Consulta cancelada. O horário foi liberado."); recarregar();
  }

  if (agendando) return <Agendar psis={data.psis} filhos={filhos ?? []} onVoltar={() => setAgendando(false)} onAgendado={() => { setAgendando(false); recarregar(); }} />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Teleconsultas" highlight="com psicólogos" subtitle="Atendimento psicológico online, por vídeo, com profissionais validados pela equipe do Centro."
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
          const [st, tom] = STATUS_CONSULTA[c.status];
          return (
            <Card key={c.id} className={cn("flex flex-col gap-3", aberta && "border-success")}>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tom={tom}>{st}</Chip>
                <span className="text-sm font-semibold text-primary">{falta(c.inicio, agora)}</span>
              </div>
              <div>
                <p className="font-display text-xl font-bold">{fDataLonga(c.inicio)}</p>
                <p className="text-lg"><Clock className="mr-1 inline h-4 w-4" />{fHora(c.inicio)} – {fHora(c.fim)}</p>
                <p className="text-sm text-muted-foreground">Com {nomePsi(c.profissional_id)} · {c.para_quem === "filho" ? `para ${nomeFilho(c.filho_id) ?? "a criança"}` : c.para_quem === "familia" ? "para a família" : "para você"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {aberta && c.link_video
                  ? <a href={c.link_video} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.wa)}><Video className="h-5 w-5" /> Entrar na sala</a>
                  : <span className={cn(btn.base, "bg-muted text-muted-foreground")}><Video className="h-5 w-5" /> A sala abre 15 min antes</span>}
                <a href={linkGoogleAgenda(`Teleconsulta com ${nomePsi(c.profissional_id)}`, c.inicio, c.fim, `Entre pelo app: ${c.link_video ?? ""}`)} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.outline)}><CalendarPlus className="h-4 w-4" /> Google Agenda</a>
                <Btn v="ghost" onClick={() => cancelar(c)}>Cancelar</Btn>
              </div>
            </Card>
          );
        })}
      </section>

      <Card className="bg-primary-soft">
        <h3 className="mb-2 flex items-center gap-2 font-display font-bold"><Lightbulb className="h-5 w-5 text-primary" /> Para a consulta online dar certo</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">{DICAS_TELECONSULTA.map((d) => <li key={d}>{d}</li>)}</ul>
      </Card>

      {historico.length > 0 && (
        <details className="card-soft p-4">
          <summary className="tap flex cursor-pointer items-center font-display font-bold">Histórico ({historico.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {historico.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 border-t pt-2 text-sm">
                <span className="flex-1">{fDataLonga(c.inicio)} · {fHora(c.inicio)} · {nomePsi(c.profissional_id)}</span>
                <Chip tom={STATUS_CONSULTA[c.status][1]}>{STATUS_CONSULTA[c.status][0]}</Chip>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Link to="/atendimentos" className="text-center text-sm font-semibold text-primary">É psicólogo(a)? Abra sua agenda de atendimentos →</Link>
      <Aviso tom="red">Teleconsulta não é atendimento de emergência. Em crise ou risco, ligue <a href="tel:192" className="font-bold underline">192</a> (SAMU) ou <a href="tel:188" className="font-bold underline">188</a> (CVV).</Aviso>
    </div>
  );
}

function Agendar({ psis, filhos, onVoltar, onAgendado }: { psis: PsiPerfil[]; filhos: { id: string; nome: string; nascimento: string | null }[]; onVoltar: () => void; onAgendado: () => void }) {
  const [psi, setPsi] = useState<PsiPerfil | null>(psis.length === 1 ? psis[0] : null);
  const [dia, setDia] = useState<string>("");
  const [slot, setSlot] = useState<{ inicio: string; fim: string } | null>(null);
  const [paraQuem, setParaQuem] = useState<string>(filhos.length ? "filho" : "mae");
  const [filho, setFilho] = useState(filhos[0]?.id ?? "");
  const [motivo, setMotivo] = useState("");
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);

  const { data: slots, loading } = useQuery<{ inicio: string; fim: string }[]>(async () => {
    if (!psi) return [];
    const hoje = new Date(); const ate = new Date(Date.now() + 28 * 864e5);
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

  async function confirmar() {
    if (!psi || !slot) return;
    if (!aceite) return toast.error("Confirme que leu as orientações da teleconsulta.");
    setEnviando(true);
    const { error } = await db.rpc("agendar_consulta", { _prof: psi.user_id, _inicio: slot.inicio, _para_quem: paraQuem, _filho: paraQuem === "filho" ? filho || null : null, _motivo: motivo.trim() || null });
    setEnviando(false);
    if (error) { toast.error(error.message); setSlot(null); return; }
    setFeito(true);
  }

  if (feito && psi && slot) return (
    <Card className="flex flex-col items-center gap-3 py-8 text-center">
      <CheckCircle2 className="h-14 w-14 text-success" />
      <h1 className="font-display text-2xl font-extrabold">Consulta agendada!</h1>
      <p className=""><b>{fDataLonga(slot.inicio)}</b>, às <b>{fHora(slot.inicio)}</b></p>
      <p className="text-sm text-muted-foreground">Com {psi.nome}. Você recebe um lembrete 1 hora antes, e o botão “Entrar na sala” aparece 15 minutos antes do horário.</p>
      <a href={linkGoogleAgenda(`Teleconsulta com ${psi.nome}`, slot.inicio, slot.fim, "Entre pelo app do Centro de Acolhimento, em Consultas.")} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.outline)}><CalendarPlus className="h-4 w-4" /> Adicionar ao Google Agenda</a>
      <Btn onClick={onAgendado}>Ver minhas consultas</Btn>
    </Card>
  );

  return (
    <div className="flex flex-col gap-5">
      <button onClick={psi && psis.length > 1 && !slot ? () => { setPsi(null); setDia(""); } : slot ? () => setSlot(null) : onVoltar} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Voltar</button>
      <PageHeader title="Agendar" highlight="teleconsulta" subtitle={!psi ? "1 de 3 · Escolha o profissional" : !slot ? "2 de 3 · Escolha dia e horário" : "3 de 3 · Confirme"} />

      {!psi && (
        <div className="flex flex-col gap-3">
          {psis.map((p) => (
            <button key={p.user_id} onClick={() => setPsi(p)} className="card-soft flex gap-4 p-4 text-left transition hover:border-primary">
              {p.foto_url ? <img src={p.foto_url} alt="" className="h-16 w-16 rounded-full object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-xl font-extrabold text-primary">{iniciais(p.nome)}</span>}
              <span className="min-w-0 flex-1">
                <b className="block font-display text-lg text-navy">{p.nome}</b>
                <span className="text-sm text-muted-foreground">Psicólogo(a) · {p.registro}{p.abordagem ? ` · ${p.abordagem}` : ""}</span>
                {p.bio && <span className="mt-1 line-clamp-3 block text-sm">{p.bio}</span>}
                <span className="mt-1 block text-xs font-semibold text-primary">Sessão de {p.duracao_min} min · por vídeo</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {psi && !slot && (loading ? <Carregando /> : !porDia.size ? (
        <Vazio icon={CalendarCheck} titulo="Sem horários livres" texto={`${psi.nome} não tem horários disponíveis nas próximas 4 semanas. Tente outro profissional ou volte depois.`} />
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
            <p className="text-sm">{psi.nome} · {psi.registro} · {psi.duracao_min} min por vídeo</p>
          </div>
          <Campo id="ag-quem" label="A consulta é para quem?" obrigatorio>
            <div className="flex flex-wrap gap-2">
              {[["mae", "Para mim"], ...(filhos.length ? [["filho", "Para meu filho(a)"]] : []), ["familia", "Para a família"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setParaQuem(k)} className={cn("tap rounded-full border px-4 text-sm font-semibold", paraQuem === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{l}</button>
              ))}
            </div>
          </Campo>
          {paraQuem === "filho" && filhos.length > 1 && (
            <div className="flex flex-wrap gap-2">{filhos.map((f) => <button key={f.id} type="button" onClick={() => setFilho(f.id)} className={cn("tap rounded-full border px-4 text-sm font-semibold", filho === f.id ? "border-primary bg-primary text-white" : "border-border bg-card")}>{f.nome.split(" ")[0]}{f.nascimento ? ` · ${idadeTxt(f.nascimento)}` : ""}</button>)}</div>
          )}
          <Campo id="ag-mot" label="Quer adiantar o assunto?" dica="Uma frase basta. Os detalhes você conversa com o profissional.">
            <textarea id="ag-mot" className={textareaCls} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: me sinto muito cansada e ansiosa com a rotina" />
          </Campo>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
            <span>Entendo que a consulta é por vídeo, que devo estar em local reservado e com internet, que o atendimento segue o sigilo profissional da Psicologia e que, em emergência, devo ligar 192 ou 188.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={confirmar} disabled={enviando}>{enviando ? "Agendando…" : "Confirmar agendamento"}</Btn>
            <Btn v="ghost" onClick={() => setSlot(null)}><X className="h-4 w-4" /> Trocar horário</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
