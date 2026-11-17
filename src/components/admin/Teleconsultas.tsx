import { useState } from "react";
import { BadgeCheck, BellRing, CalendarCheck, FileLock2, RotateCw, Video } from "lucide-react";
import { toast } from "sonner";
import { Aviso, Btn, Campo, Card, Carregando, Chip, Modal, Vazio, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { fData, fDataHora, fHora } from "@/lib/br";
import { MODALIDADE, STATUS_CONSULTA, type PsiPerfil } from "@/lib/consultas";
import { cn } from "@/lib/utils";

type Aba = "agenda" | "psicologos" | "notificacoes" | "acesso";

export function Teleconsultas() {
  const { isAdmin } = useAuth();
  const [aba, setAba] = useState<Aba>("agenda");
  const { data, loading, recarregar } = useQuery(async () => {
    const de = new Date(Date.now() - 30 * 864e5).toISOString(), ate = new Date(Date.now() + 60 * 864e5).toISOString();
    const [p, c] = await Promise.all([
      db.from("psi_perfis").select("*").order("created_at", { ascending: false }),
      db.rpc("consultas_admin", { _de: de, _ate: ate }),
    ]);
    return { psis: (p.data ?? []) as PsiPerfil[], cs: (c.data ?? []) as any[] };
  }, []);
  if (loading || !data) return <Carregando />;
  const hoje0 = new Date(new Date().setHours(0, 0, 0, 0));
  const futuras = data.cs.filter((c) => new Date(c.inicio) >= hoje0);
  const passadas = data.cs.filter((c) => !futuras.includes(c));
  const pend = data.psis.filter((p) => !p.ativo).length;
  const kpis: [string, number][] = [
    ["Aguardando confirmação", futuras.filter((c) => c.status === "pendente").length],
    ["Confirmadas (próx. 60 dias)", futuras.filter((c) => c.status === "confirmada").length],
    ["Realizadas (30 dias)", passadas.filter((c) => c.status === "realizada").length],
    ["Psicólogos ativos", data.psis.filter((p) => p.ativo).length],
  ];
  async function ativar(p: PsiPerfil, v: boolean) {
    const { error } = await db.from("psi_perfis").update({ ativo: v }).eq("user_id", p.user_id);
    if (error) return toast.error(error.message);
    await db.rpc("registrar_log", { _acao: v ? "psicologo_ativado" : "psicologo_desativado", _alvo: p.nome, _detalhes: p.registro });
    toast.success(v ? "Psicólogo liberado para receber agendamentos." : "Agenda suspensa."); recarregar();
  }
  const abas: [Aba, string][] = [["agenda", "Agenda geral"], ["psicologos", `Psicólogos${pend ? ` (${pend} aguardando)` : ""}`], ...(isAdmin ? [["notificacoes", "Notificações"], ["acesso", "Acesso clínico"]] as [Aba, string][] : [])];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{kpis.map(([l, v]) => <Card key={l} className="p-4"><p className="font-display text-3xl font-extrabold text-primary">{v}</p><p className="text-sm text-muted-foreground">{l}</p></Card>)}</div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {abas.map(([k, l]) => <button key={k} onClick={() => setAba(k)} className={cn("tap shrink-0 rounded-full border px-4 text-sm font-semibold", aba === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{l}</button>)}
      </div>
      {aba === "psicologos" && (!data.psis.length ? <Vazio icon={BadgeCheck} titulo="Nenhum psicólogo cadastrado" texto="Peça para o profissional criar uma conta e abrir “Atendimentos” no menu para enviar o perfil." /> : data.psis.map((p) => (
        <Card key={p.user_id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><b>{p.nome}</b><Chip tom={p.ativo ? "green" : "amber"}>{p.ativo ? "Ativo" : "Aguardando validação"}</Chip></div>
            <p className="text-sm text-muted-foreground">{[p.registro, p.abordagem, `${p.duracao_min} min`, (p.modalidades ?? []).map((m) => MODALIDADE[m]).join(" e ")].filter(Boolean).join(" · ")}</p>
            {!!p.especialidades?.length && <p className="text-xs text-muted-foreground">{p.especialidades.join(", ")}</p>}
            {!p.ativo && <a href="https://cadastro.cfp.org.br/" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary underline">Conferir CRP no Cadastro Nacional do CFP</a>}
          </div>
          {p.ativo ? <Btn v="outline" className="min-h-10" onClick={() => ativar(p, false)}>Suspender</Btn> : <Btn v="wa" className="min-h-10" onClick={() => ativar(p, true)}><BadgeCheck className="h-4 w-4" /> Validar CRP e liberar</Btn>}
        </Card>
      )))}
      {aba === "agenda" && (!data.cs.length ? <Vazio icon={CalendarCheck} titulo="Nenhuma consulta no período" /> : (
        <div className="flex flex-col gap-2">
          {[...futuras, ...passadas.reverse()].map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
              <Video className="h-4 w-4 text-primary" />
              <b className="w-28">{fData(c.inicio)} {fHora(c.inicio)}</b>
              <span className="flex-1"><span className="font-mono">{c.paciente_codigo ?? "—"}</span> · {c.familia_nome ?? "Família"} <span className="text-muted-foreground">({c.familia_numero})</span> → {c.profissional}</span>
              <Chip tom="blue">{MODALIDADE[c.modalidade]}</Chip>
              <Chip tom={STATUS_CONSULTA[c.status]?.[1]}>{STATUS_CONSULTA[c.status]?.[0] ?? c.status}</Chip>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">A administração vê data, família, código e status. Ficha clínica e evolução ficam só com o psicólogo responsável.</p>
        </div>
      ))}
      {aba === "notificacoes" && <Notificacoes />}
      {aba === "acesso" && <AcessoClinico />}
    </div>
  );
}

const EVENTO: Record<string, string> = { solicitada: "Solicitação recebida", confirmada: "Consulta confirmada", recusada: "Consulta recusada", reagendada: "Consulta reagendada", cancelada: "Consulta cancelada", lembrete_24h: "Lembrete 24 h antes", lembrete_2h: "Lembrete 2 h antes" };
const ENVIO: Record<string, [string, string]> = { aguardando_integracao: ["Aguardando integração", "amber"], pendente: ["Na fila", "blue"], enviado: ["Enviado", "green"], falhou: ["Falhou", "red"], descartado: ["Descartado", "navy"] };

function Notificacoes() {
  const [filtro, setFiltro] = useState("");
  const { data, loading, recarregar } = useQuery<any[]>(async () => {
    let q = db.from("notificacoes_envios").select("*").order("created_at", { ascending: false }).limit(300);
    if (filtro) q = q.eq("status", filtro);
    return (await q).data ?? [];
  }, [filtro]);
  async function reenviar(id: string) {
    const { error } = await db.rpc("reenviar_notificacao", { _id: id });
    error ? toast.error(error.message) : (toast.success("Notificação recolocada na fila."), recarregar());
  }
  return (
    <div className="flex flex-col gap-3">
      <Aviso tom="amber">O envio automático por WhatsApp Business e e-mail está <b>preparado e desligado</b>. Tudo fica registrado aqui. Os avisos dentro do app já funcionam. Para ligar, é preciso contratar o provedor (ex.: WhatsApp Cloud API da Meta e um serviço de e-mail) e cadastrar as chaves no servidor.</Aviso>
      <div className="flex flex-wrap gap-2">
        {[["", "Todos"], ...Object.entries(ENVIO).map(([k, [l]]) => [k, l])].map(([k, l]) => <button key={k} onClick={() => setFiltro(k)} className={cn("tap rounded-full border px-3 text-xs font-semibold", filtro === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{l}</button>)}
      </div>
      {loading ? <Carregando /> : !data?.length ? <Vazio icon={BellRing} titulo="Nenhuma notificação registrada" /> : data.map((n) => (
        <div key={n.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tom={n.canal === "whatsapp" ? "green" : "blue"}>{n.canal === "whatsapp" ? "WhatsApp" : "E-mail"}</Chip>
            <b className="flex-1">{EVENTO[n.evento] ?? n.evento}</b>
            <Chip tom={ENVIO[n.status]?.[1]}>{ENVIO[n.status]?.[0] ?? n.status}</Chip>
          </div>
          <span className="text-muted-foreground">Programada para {fDataHora(n.agendado_para)}{n.tentativas ? ` · ${n.tentativas} tentativa(s)` : ""}</span>
          {n.ultimo_erro && <span className="text-xs text-emergency">{n.ultimo_erro}</span>}
          {["falhou", "descartado"].includes(n.status) && <Btn v="ghost" className="min-h-9 self-start px-3" onClick={() => reenviar(n.id)}><RotateCw className="h-4 w-4" /> Reenviar</Btn>}
        </div>
      ))}
    </div>
  );
}

function AcessoClinico() {
  const [codigo, setCodigo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [lendo, setLendo] = useState<any | null>(null);
  const { data, recarregar } = useQuery<any[]>(async () => (await db.from("acessos_clinicos").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [], []);
  async function pedir() {
    const { data: n, error } = await db.rpc("solicitar_acesso_clinico", { _codigo: codigo, _motivo: motivo });
    if (error) return toast.error(error.message);
    if (!n) return toast.error("Sem permissão. Entre com a verificação em duas etapas.");
    toast.success(`Pedido enviado ao(s) ${n} psicólogo(s) responsável(is).`); setCodigo(""); setMotivo(""); recarregar();
  }
  async function ler(id: string) {
    const { data, error } = await db.rpc("prontuario_autorizado", { _acesso: id });
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Acesso não autorizado ou expirado.");
    setLendo(data);
  }
  return (
    <div className="flex flex-col gap-3">
      <Aviso tom="navy">O prontuário pertence ao psicólogo responsável. A administração só lê com autorização dele, por prazo definido, e cada leitura fica registrada nos Logs.</Aviso>
      <Card className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-display font-bold"><FileLock2 className="h-5 w-5 text-primary" /> Pedir acesso a um prontuário</h3>
        <Campo id="ac-c" label="Código do paciente" obrigatorio dica="Ex.: P-7KQ3MD (aparece na Agenda geral)"><input id="ac-c" className={inputCls + " font-mono uppercase"} value={codigo} onChange={(e) => setCodigo(e.target.value)} /></Campo>
        <Campo id="ac-m" label="Justificativa" obrigatorio dica="Necessidade funcional: auditoria, ordem judicial, pedido do próprio titular etc."><textarea id="ac-m" className={textareaCls} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <Btn onClick={pedir} className="self-start" disabled={codigo.trim().length < 4 || motivo.trim().length < 15}>Enviar pedido</Btn>
      </Card>
      {(data ?? []).map((a) => {
        const valido = a.status === "autorizado" && new Date(a.expira_em) > new Date();
        return (
          <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
            <span className="flex-1">{fDataHora(a.created_at)} · “{a.motivo}”</span>
            <Chip tom={valido ? "green" : a.status === "pendente" ? "amber" : "navy"}>{valido ? `Autorizado até ${fDataHora(a.expira_em)}` : a.status === "autorizado" ? "Expirado" : a.status}</Chip>
            {valido && <Btn v="soft" className="min-h-9 px-3" onClick={() => ler(a.id)}>Ler prontuário</Btn>}
          </div>
        );
      })}
      {lendo && (
        <Modal titulo={`Prontuário ${lendo.codigo}`} onFechar={() => setLendo(null)} largura="max-w-2xl">
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">Responsável: {lendo.profissional} · leitura registrada · autorização até {fDataHora(lendo.expira_em)}</p>
            {lendo.ficha && Object.entries(lendo.ficha).filter(([k, v]) => v && !["paciente_id", "updated_at"].includes(k)).map(([k, v]) => <div key={k}><b className="capitalize">{k.replace("_", " ")}</b><p className="whitespace-pre-wrap">{String(v)}</p></div>)}
            {(lendo.registros ?? []).map((r: any, i: number) => <div key={i} className="rounded-xl bg-muted p-3"><b>{fDataHora(r.data)}{r.titulo ? ` · ${r.titulo}` : ""}</b><p className="whitespace-pre-wrap">{r.texto}</p></div>)}
          </div>
        </Modal>
      )}
    </div>
  );
}
