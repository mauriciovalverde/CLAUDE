import { useState } from "react";
import { BadgeCheck, CalendarCheck, Video } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Carregando, Chip, Vazio } from "@/components/app/kit";
import { db, useQuery } from "@/lib/dados";
import { fData, fHora } from "@/lib/br";
import { STATUS_CONSULTA, type PsiPerfil } from "@/lib/consultas";
import { cn } from "@/lib/utils";

export function Teleconsultas() {
  const [aba, setAba] = useState<"agenda" | "psicologos">("agenda");
  const { data, loading, recarregar } = useQuery(async () => {
    const de = new Date(Date.now() - 30 * 864e5).toISOString(), ate = new Date(Date.now() + 30 * 864e5).toISOString();
    const [p, c, f] = await Promise.all([
      db.from("psi_perfis").select("*").order("created_at", { ascending: false }),
      db.from("consultas").select("id,profissional_id,familia_id,inicio,status").gte("inicio", de).lt("inicio", ate).order("inicio"),
      db.from("familias").select("id,mae_nome,numero"),
    ]);
    return { psis: (p.data ?? []) as PsiPerfil[], cs: (c.data ?? []) as any[], fams: (f.data ?? []) as any[] };
  }, []);
  if (loading || !data) return <Carregando />;
  const nomePsi = (id: string) => data.psis.find((p) => p.user_id === id)?.nome ?? "—";
  const fam = (id: string) => data.fams.find((x) => x.id === id);
  const futuras = data.cs.filter((c) => new Date(c.inicio) >= new Date(new Date().setHours(0, 0, 0, 0)));
  const passadas = data.cs.filter((c) => !futuras.includes(c));
  const pend = data.psis.filter((p) => !p.ativo).length;
  const kpis: [string, number][] = [
    ["Agendadas (30 dias)", futuras.filter((c) => ["agendada", "confirmada"].includes(c.status)).length],
    ["Realizadas (30 dias)", passadas.filter((c) => c.status === "realizada").length],
    ["Faltas", passadas.filter((c) => c.status === "falta").length],
    ["Psicólogos ativos", data.psis.filter((p) => p.ativo).length],
  ];
  async function ativar(p: PsiPerfil, v: boolean) {
    const { error } = await db.from("psi_perfis").update({ ativo: v }).eq("user_id", p.user_id);
    if (error) return toast.error(error.message);
    await db.rpc("registrar_log", { _acao: v ? "psicologo_ativado" : "psicologo_desativado", _alvo: p.nome, _detalhes: p.registro });
    toast.success(v ? "Psicólogo liberado para receber agendamentos." : "Agenda suspensa."); recarregar();
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{kpis.map(([l, v]) => <Card key={l} className="p-4"><p className="font-display text-3xl font-extrabold text-primary">{v}</p><p className="text-sm text-muted-foreground">{l}</p></Card>)}</div>
      <div className="flex gap-2">
        {([["agenda", "Agenda geral"], ["psicologos", `Psicólogos${pend ? ` (${pend} aguardando)` : ""}`]] as const).map(([k, l]) => <button key={k} onClick={() => setAba(k)} className={cn("tap rounded-full border px-4 text-sm font-semibold", aba === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{l}</button>)}
      </div>
      {aba === "psicologos" ? (!data.psis.length ? <Vazio icon={BadgeCheck} titulo="Nenhum psicólogo cadastrado" texto="Peça para o profissional criar uma conta e abrir “Atendimentos” no menu para enviar o perfil." /> : data.psis.map((p) => (
        <Card key={p.user_id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><b>{p.nome}</b><Chip tom={p.ativo ? "green" : "amber"}>{p.ativo ? "Ativo" : "Aguardando validação"}</Chip></div>
            <p className="text-sm text-muted-foreground">{[p.registro, p.abordagem, `${p.duracao_min} min`].filter(Boolean).join(" · ")}</p>
            {!p.ativo && <a href="https://cadastro.cfp.org.br/" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary underline">Conferir CRP no Cadastro Nacional do CFP</a>}
          </div>
          {p.ativo ? <Btn v="outline" className="min-h-10" onClick={() => ativar(p, false)}>Suspender</Btn> : <Btn v="wa" className="min-h-10" onClick={() => ativar(p, true)}><BadgeCheck className="h-4 w-4" /> Validar CRP e liberar</Btn>}
        </Card>
      ))) : (!data.cs.length ? <Vazio icon={CalendarCheck} titulo="Nenhuma teleconsulta no período" /> : (
        <div className="flex flex-col gap-2">
          {[...futuras, ...passadas.reverse()].map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
              <Video className="h-4 w-4 text-primary" />
              <b className="w-28">{fData(c.inicio)} {fHora(c.inicio)}</b>
              <span className="flex-1">{fam(c.familia_id)?.mae_nome ?? "Família"} <span className="text-muted-foreground">({fam(c.familia_id)?.numero})</span> → {nomePsi(c.profissional_id)}</span>
              <Chip tom={STATUS_CONSULTA[c.status]?.[1]}>{STATUS_CONSULTA[c.status]?.[0] ?? c.status}</Chip>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">A equipe vê apenas data, família e status. O conteúdo das sessões e as anotações ficam só com o psicólogo.</p>
        </div>
      ))}
    </div>
  );
}
