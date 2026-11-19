import { useState } from "react";
import { ChevronLeft, Lock, Megaphone, Paperclip, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { Aviso, Btn, Campo, Card, Carregando, Chip, Vazio, inputCls, textareaCls } from "@/components/app/kit";
import { type AnexoBD, type Evento, type Manif, LinhaDoTempo, ListaAnexos, LocalInfo } from "@/components/app/OuvDetalhe";
import { db, useQuery } from "@/lib/dados";
import { fDataHora } from "@/lib/br";
import { STATUS_OUV as STATUS_BASE, TIPOS_OUV, tipoNome } from "@/lib/ouvidoria";

// Na visão da equipe, "aguardando complemento" é do cidadão, não "você".
const STATUS_OUV: Record<string, [string, string]> = { ...STATUS_BASE, aguardando_complemento: ["Aguardando cidadão", "coral"] };
import { cn } from "@/lib/utils";

type Linha = { id: string; protocolo: string; tipo: string; assunto: string; status: string; setor_id: string | null; setor: string | null; created_at: string; tem_local: boolean; anexos: number; cidadao: string };

export function OuvidoriaAdmin() {
  const [f, setF] = useState({ busca: "", tipo: "", status: "", setor: "", de: "", ate: "" });
  const [aberto, setAberto] = useState<string | null>(null);
  const { data: setores } = useQuery<{ id: string; nome: string }[]>(async () => (await db.from("ouv_setores").select("id,nome").eq("ativo", true).order("nome")).data ?? [], []);
  const { data, loading, recarregar } = useQuery<Linha[]>(async () => {
    const { data, error } = await db.rpc("ouv_fila", {
      _busca: f.busca.trim() || null, _tipo: f.tipo || null, _status: f.status || null, _setor: f.setor || null, _de: f.de || null, _ate: f.ate || null,
    });
    if (error) throw error; return data ?? [];
  }, [f.busca, f.tipo, f.status, f.setor, f.de, f.ate]);

  if (aberto) return <Atender id={aberto} setores={setores ?? []} onVoltar={() => { setAberto(null); recarregar(); }} />;
  const sel = "h-11 rounded-xl border border-input bg-card px-3 text-sm";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["recebida", "em_analise", "encaminhada", "aguardando_complemento"] as const).map((s) => (
          <button key={s} onClick={() => setF({ ...f, status: f.status === s ? "" : s })} className={cn("card-soft p-4 text-left", f.status === s && "border-primary")}>
            <p className="font-display text-3xl font-extrabold text-primary">{(data ?? []).filter((x) => x.status === s).length}</p>
            <p className="text-sm text-muted-foreground">{STATUS_OUV[s][0]}</p>
          </button>
        ))}
      </div>
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3"><Search className="h-4 w-4 text-muted-foreground" />
          <input className="h-11 min-w-0 flex-1 bg-transparent outline-none" placeholder="Buscar por protocolo (OUV-2026-…) ou assunto" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} aria-label="Buscar" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <select className={sel} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} aria-label="Tipo"><option value="">Todos os tipos</option>{TIPOS_OUV.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className={sel} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Situação"><option value="">Todas as situações</option>{Object.entries(STATUS_OUV).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className={sel} value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value })} aria-label="Setor"><option value="">Todos os setores</option>{(setores ?? []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
          <input type="date" className={sel} value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} aria-label="De" />
          <input type="date" className={sel} value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} aria-label="Até" />
        </div>
      </Card>
      {loading ? <Carregando /> : !data?.length ? <Vazio icon={Megaphone} titulo="Nenhuma manifestação" texto="Ajuste os filtros ou aguarde novos registros." /> : (
        <ul className="flex flex-col gap-2">
          {data.map((m) => {
            const [st, tom] = STATUS_OUV[m.status] ?? [m.status, "navy"];
            return (
              <li key={m.id}><button onClick={() => setAberto(m.id)} className="card-soft flex w-full flex-col gap-1 p-4 text-left transition hover:border-primary">
                <span className="flex flex-wrap items-center gap-2"><b className="font-mono text-primary">{m.protocolo}</b><Chip tom={tom}>{st}</Chip><Chip tom="navy">{tipoNome(m.tipo)}</Chip>{m.setor && <Chip tom="blue">{m.setor}</Chip>}</span>
                <b className="text-navy">{m.assunto}</b>
                <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">{m.cidadao} · {fDataHora(m.created_at)}
                  {m.tem_local && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> local</span>}
                  {m.anexos > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> {m.anexos}</span>}</span>
              </button></li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Atender({ id, setores, onVoltar }: { id: string; setores: { id: string; nome: string }[]; onVoltar: () => void }) {
  const [acao, setAcao] = useState("");
  const [setor, setSetor] = useState("");
  const [msg, setMsg] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { data, loading, recarregar } = useQuery(async () => {
    const [m, e, a, n] = await Promise.all([
      db.from("ouv_manifestacoes").select("*").eq("id", id).maybeSingle(),
      db.from("ouv_eventos").select("*").eq("manifestacao_id", id).order("created_at"),
      db.from("ouv_anexos").select("*").eq("manifestacao_id", id).order("created_at"),
      db.from("ouv_notas_internas").select("*").eq("manifestacao_id", id).order("created_at"),
    ]);
    const man = m.data as Manif | null;
    const ids = [...new Set([...(e.data ?? []).map((x: any) => x.autor_id), ...(n.data ?? []).map((x: any) => x.autor_id), man?.user_id].filter(Boolean))];
    const [au, fam] = await Promise.all([
      db.rpc("ouv_autores", { _ids: ids }),
      man ? db.from("familias").select("numero,mae_nome,mae_telefone,mae_email,cidade,uf").eq("user_id", man.user_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return { m: man, ev: (e.data ?? []) as Evento[], anx: (a.data ?? []) as AnexoBD[], notas: (n.data ?? []) as any[],
             autores: Object.fromEntries((au.data ?? []).map((x: any) => [x.id, x.nome])) as Record<string, string>, fam: fam.data as any };
  }, [id]);

  if (loading || !data) return <Carregando />;
  if (!data.m) return <Vazio icon={Megaphone} titulo="Sem acesso a esta manifestação" />;
  const m = data.m;
  const nomes = Object.fromEntries(setores.map((s) => [s.id, s.nome]));
  const [st, tom] = STATUS_OUV[m.status] ?? [m.status, "navy"];
  const concluida = m.status === "concluida";

  async function executar() {
    if (!acao) return;
    setEnviando(true);
    const { error } = await db.rpc("ouv_acao", { _id: id, _acao: acao, _setor: acao === "encaminhar" ? setor || null : null, _mensagem: msg || null, _nota: nota || null });
    setEnviando(false);
    if (error) return toast.error(error.message);
    toast.success(acao === "nota" ? "Nota interna salva." : "Protocolo atualizado e cidadão avisado.");
    setAcao(""); setMsg(""); setNota(""); setSetor(""); recarregar();
  }
  const ACOES: [string, string, string][] = [
    ["analisar", "Iniciar análise", "soft"], ["encaminhar", "Encaminhar a setor", "soft"], ["complemento", "Solicitar complementação", "soft"],
    ["responder", "Publicar resposta", "primary"], ["concluir", "Concluir atendimento", "outline"], ["nota", "Só nota interna", "ghost"],
  ];
  const precisaMsg = acao === "complemento" || acao === "responder";
  return (
    <div className="flex flex-col gap-4">
      <button onClick={onVoltar} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Fila da Ouvidoria</button>
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2"><b className="font-mono text-xl text-primary">{m.protocolo}</b><Chip tom={tom}>{st}</Chip><Chip tom="navy">{tipoNome(m.tipo)}</Chip>{m.setor_id && <Chip tom="blue">{nomes[m.setor_id]}</Chip>}</div>
        <h2 className="font-display text-xl font-extrabold">{m.assunto}</h2>
        <p className="text-sm text-muted-foreground">Registrada em {fDataHora(m.created_at)}</p>
        {data.fam ? (
          <p className="rounded-xl bg-muted p-3 text-sm"><b>Cidadão:</b> {data.fam.mae_nome} · cadastro {data.fam.numero} · {data.fam.mae_telefone} · {data.fam.mae_email} · {data.fam.cidade}/{data.fam.uf}</p>
        ) : <p className="rounded-xl bg-muted p-3 text-sm"><b>Cidadão:</b> {data.autores[m.user_id] ?? "conta sem cadastro de família"}</p>}
        <p className="whitespace-pre-line">{m.descricao}</p>
        <ListaAnexos anexos={data.anx.filter((a) => data.ev.find((e) => e.id === a.evento_id)?.tipo === "registro")} />
      </Card>
      <Card className="flex flex-col gap-2"><h3 className="font-display font-bold">Local</h3><LocalInfo m={m} /></Card>

      {!concluida && (
        <Card className="flex flex-col gap-3 border-primary">
          <h3 className="font-display text-lg font-bold">Atender</h3>
          <div className="flex flex-wrap gap-2">
            {ACOES.map(([k, l, v]) => <Btn key={k} v={(acao === k ? "primary" : v) as any} className="min-h-10" onClick={() => setAcao(acao === k ? "" : k)}>{l}</Btn>)}
          </div>
          {acao === "encaminhar" && (
            <Campo id="oa-setor" label="Setor de destino" obrigatorio>
              <select id="oa-setor" className={inputCls} value={setor} onChange={(e) => setSetor(e.target.value)}><option value="">Escolha…</option>{setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
            </Campo>
          )}
          {acao && acao !== "nota" && (
            <Campo id="oa-msg" label="Resposta ao cidadão (público)" obrigatorio={precisaMsg} dica="O cidadão vê esta mensagem no perfil dele.">
              <textarea id="oa-msg" className={textareaCls + " border-success/60"} value={msg} onChange={(e) => setMsg(e.target.value)}
                placeholder={acao === "encaminhar" ? "Ex.: Encaminhamos ao setor de Assistência Social, que fará contato em até 5 dias úteis." : acao === "complemento" ? "Ex.: Envie uma foto do local e o horário aproximado do fato." : ""} />
            </Campo>
          )}
          {acao && (
            <Campo id="oa-nota" label="Nota interna da equipe (não aparece para o cidadão)" obrigatorio={acao === "nota"}>
              <textarea id="oa-nota" className={textareaCls + " border-warning/60 bg-warning-soft/40"} value={nota} onChange={(e) => setNota(e.target.value)} />
            </Campo>
          )}
          {acao && <Btn onClick={executar} disabled={enviando} className="self-start">{enviando ? "Salvando…" : "Confirmar"}</Btn>}
        </Card>
      )}
      {concluida && <Aviso tom="green">Atendimento concluído. Ainda é possível registrar nota interna pelo histórico abaixo.</Aviso>}

      <Card className="flex flex-col gap-3"><h3 className="font-display text-lg font-bold">Linha do tempo pública</h3>
        <LinhaDoTempo eventos={data.ev} setores={nomes} anexos={data.anx} autores={data.autores} />
      </Card>
      <Card className="flex flex-col gap-2 border-warning/60 bg-warning-soft/30">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold"><Lock className="h-5 w-5" /> Notas internas</h3>
        {!data.notas.length ? <p className="text-sm text-muted-foreground">Nenhuma nota interna.</p> : data.notas.map((n) => (
          <div key={n.id} className="rounded-xl bg-card p-3 text-sm"><p className="text-xs text-muted-foreground">{fDataHora(n.created_at)} · {data.autores[n.autor_id] ?? "equipe"}</p><p className="whitespace-pre-line">{n.texto}</p></div>
        ))}
        {concluida && <NotaRapida id={id} onFeito={recarregar} />}
      </Card>
    </div>
  );
}

function NotaRapida({ id, onFeito }: { id: string; onFeito: () => void }) {
  const [t, setT] = useState("");
  return (
    <div className="flex gap-2"><input className={inputCls} value={t} onChange={(e) => setT(e.target.value)} placeholder="Nova nota interna" aria-label="Nova nota interna" />
      <Btn v="outline" onClick={async () => { const { error } = await db.rpc("ouv_acao", { _id: id, _acao: "nota", _nota: t }); if (error) return toast.error(error.message); setT(""); onFeito(); }}>Salvar</Btn></div>
  );
}
