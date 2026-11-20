import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Landmark, MessageSquareReply, Megaphone, Printer } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, Carregando, Chip, PageHeader, Vazio, btn, textareaCls } from "@/components/app/kit";
import { OuvAnexos, anexosParaEnvio } from "@/components/app/OuvAnexos";
import { type AnexoBD, type Evento, type Manif, LinhaDoTempo, ListaAnexos, LocalInfo, OficialInfo } from "@/components/app/OuvDetalhe";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { fDataHora } from "@/lib/br";
import { type Anexo, STATUS_OUV, categoriaNome, tipoNome } from "@/lib/ouvidoria";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/minhas-manifestacoes")({
  validateSearch: (s: Record<string, unknown>) => ({ p: typeof s.p === "string" ? s.p : undefined }) as { p?: string },
  component: () => <AppShell><Minhas /></AppShell>,
});

type Item = { id: string; protocolo: string; tipo: string; assunto: string; status: string; setor: string | null; created_at: string; atualizado_em: string; nao_lida: boolean };

function Minhas() {
  const { p } = Route.useSearch();
  const nav = useNavigate();
  const { data, loading, recarregar } = useQuery<Item[]>(async () => { const { data, error } = await db.rpc("ouv_minhas"); if (error) throw error; return data ?? []; }, [p]);
  if (p) return <Detalhe id={p} onVoltar={() => { nav({ to: "/minhas-manifestacoes", search: {} as any }); recarregar(); }} />;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Minhas" highlight="manifestações" subtitle="Acompanhe seus protocolos da Ouvidoria: setor responsável, respostas e pedidos de complementação."
        right={<Link to="/ouvidoria" search={{ novo: 1 } as any} className={cn(btn.base, btn.primary)}><Megaphone className="h-4 w-4" /> Nova</Link>} />
      {loading ? <Carregando /> : !data?.length ? (
        <Vazio icon={Megaphone} titulo="Nenhuma manifestação ainda" texto="Quando você registrar uma denúncia, reclamação, solicitação, sugestão ou elogio, ela aparece aqui.">
          <Link to="/ouvidoria" search={{ novo: 1 } as any} className={cn(btn.base, btn.primary)}>Registrar manifestação</Link>
        </Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((m) => {
            const [st, tom] = STATUS_OUV[m.status] ?? [m.status, "navy"];
            return (
              <li key={m.id}>
                <Link to="/minhas-manifestacoes" search={{ p: m.id } as any} className={cn("card-soft flex items-center gap-3 p-4 transition hover:border-primary", m.nao_lida && "border-primary")}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="font-mono text-primary">{m.protocolo}</b>
                      <Chip tom={tom}>{st}</Chip>
                      {m.nao_lida && <span className="rounded-full bg-coral px-2 py-0.5 text-[11px] font-bold text-white">NOVA ATUALIZAÇÃO</span>}
                    </span>
                    <span className="mt-1 block truncate font-semibold text-navy">{m.assunto}</span>
                    <span className="text-xs text-muted-foreground">{tipoNome(m.tipo)} · {fDataHora(m.created_at)}{m.setor ? ` · Setor: ${m.setor}` : ""}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Detalhe({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const { user } = useAuth();
  const { data, loading, recarregar } = useQuery(async () => {
    const [m, e, a, s] = await Promise.all([
      db.from("ouv_manifestacoes").select("*").eq("id", id).maybeSingle(),
      db.from("ouv_eventos").select("*").eq("manifestacao_id", id).order("created_at"),
      db.from("ouv_anexos").select("*").eq("manifestacao_id", id).order("created_at"),
      db.from("ouv_setores").select("id,nome"),
    ]);
    return { m: m.data as Manif | null, ev: (e.data ?? []) as Evento[], anx: (a.data ?? []) as AnexoBD[], setores: Object.fromEntries((s.data ?? []).map((x: any) => [x.id, x.nome])) as Record<string, string> };
  }, [id]);
  useEffect(() => { if (data?.m) db.rpc("ouv_marcar_vista", { _id: id }); }, [data?.m?.id, data?.ev.length]);

  if (loading || !data) return <Carregando />;
  if (!data.m) return (
    <Vazio icon={Megaphone} titulo="Protocolo não encontrado" texto="Ele não existe ou não pertence à sua conta.">
      <Btn v="outline" onClick={onVoltar}>Ver minhas manifestações</Btn>
    </Vazio>
  );
  const m = data.m;
  const [st, tom] = STATUS_OUV[m.status] ?? [m.status, "navy"];
  const anexosRegistro = data.anx.filter((a) => data.ev.find((e) => e.id === a.evento_id)?.tipo === "registro" || !a.evento_id);
  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex items-center justify-between gap-2">
        <button onClick={onVoltar} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Minhas manifestações</button>
        <Btn v="outline" className="min-h-10" onClick={() => window.print()}><Printer className="h-4 w-4" /> Relatório em PDF</Btn>
      </div>
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <b className="font-mono text-xl text-primary">{m.protocolo}</b>
          <button onClick={() => navigator.clipboard?.writeText(m.protocolo).then(() => toast.success("Protocolo copiado."))} aria-label="Copiar protocolo" className="tap grid w-10 place-items-center text-muted-foreground"><Copy className="h-4 w-4" /></button>
          <Chip tom={tom}>{st}</Chip>
        </div>
        <h1 className="font-display text-2xl font-extrabold">{m.assunto}</h1>
        <p className="text-sm text-muted-foreground">{tipoNome(m.tipo)}{categoriaNome(m.categoria) ? ` · ${categoriaNome(m.categoria)}` : ""} · registrada em {fDataHora(m.created_at)}{m.setor_id ? ` · Setor responsável: ${data.setores[m.setor_id]}` : ""}</p>
      </Card>

      {m.resposta && (
        <Card className="flex flex-col gap-2 border-success bg-success/5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-success"><MessageSquareReply className="h-5 w-5" /> Resposta da Ouvidoria</h2>
          <p className="whitespace-pre-line">{m.resposta}</p>
          {m.respondida_em && <p className="text-xs text-muted-foreground">{fDataHora(m.respondida_em)}</p>}
        </Card>
      )}

      {m.status === "aguardando_complemento" && user && <div className="no-print"><Complementar id={m.id} uid={user.id} pedido={[...data.ev].reverse().find((e) => e.tipo === "complemento_solicitado")?.mensagem ?? null} onFeito={recarregar} /></div>}

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Seu relato</h2>
        <p className="whitespace-pre-line">{m.descricao}</p>
        <ListaAnexos anexos={anexosRegistro} />
      </Card>
      <Card className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Landmark className="h-5 w-5 text-primary" /> Encaminhamento ao poder público</h2>
        <OficialInfo m={m} />
      </Card>
      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">Local informado</h2>
        <LocalInfo m={m} />
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Andamento</h2>
        <LinhaDoTempo eventos={data.ev} setores={data.setores} anexos={data.anx} />
      </Card>
    </div>
  );
}

function Complementar({ id, uid, pedido, onFeito }: { id: string; uid: string; pedido: string | null; onFeito: () => void }) {
  const [texto, setTexto] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [enviando, setEnviando] = useState(false);
  async function enviar() {
    if (anexos.some((a) => a.estado !== "ok")) return toast.error("Aguarde os arquivos ou remova os que falharam.");
    setEnviando(true);
    const { error } = await db.rpc("ouv_complementar", { _id: id, _mensagem: texto, _anexos: anexosParaEnvio(anexos) });
    setEnviando(false);
    if (error) return toast.error(error.message);
    toast.success("Complementação enviada à Ouvidoria."); onFeito();
  }
  return (
    <Card className="flex flex-col gap-3 border-coral">
      <h2 className="font-display text-lg font-bold text-coral">A Ouvidoria pediu uma complementação</h2>
      {pedido && <Aviso tom="amber">{pedido}</Aviso>}
      <Campo id="ouv-comp" label="Sua resposta"><textarea id="ouv-comp" className={textareaCls} maxLength={5000} value={texto} onChange={(e) => setTexto(e.target.value)} /></Campo>
      <OuvAnexos uid={uid} chave={chave} anexos={anexos} setAnexos={setAnexos} />
      <Btn onClick={enviar} disabled={enviando} className="self-start">{enviando ? "Enviando…" : "Enviar complementação"}</Btn>
    </Card>
  );
}
