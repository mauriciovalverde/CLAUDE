import { useEffect, useState } from "react";
import { CalendarClock, Download, Megaphone, Pencil, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Aviso, Btn, Campo, Card, Chip, Modal, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { DIAGNOSTICOS, baixarArquivo, csv, digits, fDataHora, fmtTel } from "@/lib/br";

const PUBLICOS: [string, string][] = [["todas", "Todas as famílias confirmadas"], ["cidade", "Famílias de uma cidade"], ["condicao", "Famílias por condição da criança"], ["pendentes", "Cadastros aguardando confirmação"], ["equipe", "Somente a equipe"]];
const MODELOS: [string, string, string][] = [
  ["Encontro", "Roda de conversa neste sábado 💙", "Olá! Neste sábado teremos uma roda de conversa para mães atípicas. Venha se cuidar com a gente. Detalhes em Rede de apoio."],
  ["BPC", "Mutirão de orientação sobre o BPC", "Vamos ajudar com dúvidas sobre o BPC e o Meu INSS. Traga seus documentos e o login gov.br."],
  ["Vídeo", "Novo vídeo na biblioteca", "Tem vídeo novo na Biblioteca do app. Assista quando puder 💙"],
  ["Lembrete", "Atualize seu CadÚnico", "Lembrete: o CadÚnico precisa estar atualizado nos últimos 24 meses para manter benefícios."],
];

export function Comunicados() {
  const { user } = useAuth();
  const [f, setF] = useState({ titulo: "", mensagem: "", publico: "todas", filtro: "", agendar: false, agendado_para: "", destaque: false });
  const [n, setN] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { data: hist, recarregar } = useQuery<any[]>(async () => (await db.from("comunicados").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [], []);

  useEffect(() => {
    const t = setTimeout(() => {
      db.rpc("contar_destinatarios", { _publico: f.publico, _filtro: f.filtro || null }).then(({ data }: any) => setN(data ?? 0));
    }, 300);
    return () => clearTimeout(t);
  }, [f.publico, f.filtro]);

  async function enviar() {
    if (f.titulo.trim().length < 3 || f.mensagem.trim().length < 5) return toast.error("Preencha título e mensagem.");
    if ((f.publico === "cidade" || f.publico === "condicao") && !f.filtro) return toast.error("Escolha o filtro.");
    if (f.agendar && !f.agendado_para) return toast.error("Escolha data e hora.");
    if (!f.agendar && !confirm(`Enviar agora para ${n ?? 0} pessoa(s)?`)) return;
    setEnviando(true);
    const { data: c, error } = await db.from("comunicados").insert({
      titulo: f.titulo.trim(), mensagem: f.mensagem.trim(), publico: f.publico, filtro: f.filtro || null, destaque: f.destaque, autor_id: user!.id,
      agendado_para: f.agendar ? new Date(f.agendado_para).toISOString() : null,
    }).select("id").single();
    if (error) { setEnviando(false); return toast.error(error.message); }
    if (!f.agendar) {
      const { data: total, error: e2 } = await db.rpc("enviar_comunicado", { _id: c.id });
      if (e2) { setEnviando(false); return toast.error(e2.message); }
      toast.success(`Comunicado enviado para ${total} pessoa(s).`);
    } else toast.success("Comunicado agendado. Ele é disparado quando alguém da equipe abrir o painel após o horário.");
    setEnviando(false);
    setF({ ...f, titulo: "", mensagem: "", agendar: false, agendado_para: "" });
    recarregar();
  }

  const [editando, setEditando] = useState<{ id: string; titulo: string; mensagem: string; destaque: boolean } | null>(null);
  async function salvarEdicao() {
    if (!editando || editando.titulo.trim().length < 3 || editando.mensagem.trim().length < 5) return toast.error("Preencha título e mensagem.");
    const { error } = await db.rpc("editar_comunicado", { _id: editando.id, _titulo: editando.titulo.trim(), _mensagem: editando.mensagem.trim(), _destaque: editando.destaque });
    if (error) return toast.error(error.message);
    toast.success("Comunicado atualizado."); setEditando(null); recarregar();
  }
  async function alternarDestaque(c: any) {
    const { error } = await db.rpc("editar_comunicado", { _id: c.id, _titulo: c.titulo, _mensagem: c.mensagem, _destaque: !c.destaque });
    error ? toast.error(error.message) : recarregar();
  }
  async function apagar(c: any) {
    if (!confirm(`Apagar "${c.titulo}"? Ele some do app de todas as famílias.`)) return;
    const { error } = await db.rpc("apagar_comunicado", { _id: c.id });
    if (error) return toast.error(error.message);
    toast.success("Comunicado apagado."); recarregar();
  }

  async function exportarContatos() {
    let q = db.from("familias").select("mae_nome,mae_telefone,cidade,uf,status");
    if (f.publico === "pendentes") q = q.eq("status", "pendente"); else q = q.eq("status", "aprovado");
    if (f.publico === "cidade") q = q.ilike("cidade", f.filtro);
    const { data } = await q;
    baixarArquivo("contatos-whatsapp.csv", csv([["Nome", "Telefone", "WhatsApp (DDI)", "Cidade"], ...(data ?? []).map((r: any) => [r.mae_nome, fmtTel(r.mae_telefone ?? ""), "55" + digits(r.mae_telefone), `${r.cidade ?? ""}/${r.uf ?? ""}`])]));
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold"><Megaphone className="h-5 w-5 text-primary" /> Novo disparo</h2>
        <div className="flex flex-wrap gap-2">{MODELOS.map(([l, t, m]) => <button key={l} onClick={() => setF({ ...f, titulo: t, mensagem: m })} className="tap rounded-full border border-border bg-card px-3 text-xs font-semibold">Modelo: {l}</button>)}</div>
        <Campo id="c-t" label="Título" obrigatorio><input id="c-t" className={inputCls} maxLength={90} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Campo>
        <Campo id="c-m" label="Mensagem" obrigatorio dica={`${f.mensagem.length}/600`}><textarea id="c-m" className={textareaCls} maxLength={600} value={f.mensagem} onChange={(e) => setF({ ...f, mensagem: e.target.value })} /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="c-p" label="Para quem" obrigatorio><select id="c-p" className={inputCls} value={f.publico} onChange={(e) => setF({ ...f, publico: e.target.value, filtro: "" })}>{PUBLICOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
          {f.publico === "cidade" && <Campo id="c-f" label="Cidade" obrigatorio><input id="c-f" className={inputCls} value={f.filtro} onChange={(e) => setF({ ...f, filtro: e.target.value })} placeholder="Ex.: Jequié" /></Campo>}
          {f.publico === "condicao" && <Campo id="c-f2" label="Condição" obrigatorio><select id="c-f2" className={inputCls} value={f.filtro} onChange={(e) => setF({ ...f, filtro: e.target.value })}><option value="">Escolha</option>{DIAGNOSTICOS.map((d) => <option key={d}>{d}</option>)}</select></Campo>}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.destaque} onChange={(e) => setF({ ...f, destaque: e.target.checked })} /> Mostrar como destaque na tela inicial</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.agendar} onChange={(e) => setF({ ...f, agendar: e.target.checked })} /> Agendar envio</label>
        </div>
        {f.agendar && <Campo id="c-a" label="Enviar em" obrigatorio><input id="c-a" type="datetime-local" className={inputCls} value={f.agendado_para} onChange={(e) => setF({ ...f, agendado_para: e.target.value })} /></Campo>}
        <div className="flex flex-wrap items-center gap-2">
          <Chip tom="blue"><Users className="h-3.5 w-3.5" /> {n ?? "…"} destinatário(s)</Chip>
          <span className="flex-1" />
          <Btn v="outline" onClick={exportarContatos}><Download className="h-4 w-4" /> Contatos para WhatsApp</Btn>
          <Btn onClick={enviar} disabled={enviando}>{f.agendar ? <><CalendarClock className="h-4 w-4" /> Agendar</> : <><Send className="h-4 w-4" /> Enviar agora</>}</Btn>
        </div>
        <Aviso>O disparo chega como aviso no app (sino) e como notificação no celular de quem ativou as notificações. Quem desligou “Comunicados” nas preferências não recebe. Para listas de transmissão no WhatsApp, use “Contatos para WhatsApp”.</Aviso>
      </Card>
      <h3 className="font-display text-lg font-bold">Histórico</h3>
      {(hist ?? []).map((c) => (
        <Card key={c.id} className="flex flex-col gap-1 p-4">
          <div className="flex flex-wrap items-center gap-2"><b>{c.titulo}</b>{c.enviado ? <Chip tom="green">Enviado · {c.destinatarios}</Chip> : <Chip tom="amber">Agendado · {c.agendado_para ? fDataHora(c.agendado_para) : "—"}</Chip>}{c.destaque && <Chip tom="blue">Destaque</Chip>}</div>
          <p className="whitespace-pre-line text-sm">{c.mensagem}</p>
          <p className="text-xs text-muted-foreground">{PUBLICOS.find((p) => p[0] === c.publico)?.[1]}{c.filtro ? `: ${c.filtro}` : ""} · {fDataHora(c.created_at)}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Btn v="soft" className="min-h-10" onClick={() => setEditando({ id: c.id, titulo: c.titulo, mensagem: c.mensagem, destaque: !!c.destaque })}><Pencil className="h-4 w-4" /> Editar</Btn>
            <Btn v="soft" className="min-h-10" onClick={() => alternarDestaque(c)}>{c.destaque ? "Tirar do Início" : "Fixar no Início"}</Btn>
            <Btn v="ghost" className="min-h-10 text-emergency" onClick={() => apagar(c)}><Trash2 className="h-4 w-4" /> Apagar</Btn>
          </div>
        </Card>
      ))}
      {editando && (
        <Modal titulo="Editar comunicado" onFechar={() => setEditando(null)}>
          <div className="flex flex-col gap-3">
            <Campo id="ed-t" label="Título" obrigatorio><input id="ed-t" className={inputCls} maxLength={90} value={editando.titulo} onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} /></Campo>
            <Campo id="ed-m" label="Mensagem" obrigatorio><textarea id="ed-m" className={textareaCls} maxLength={600} value={editando.mensagem} onChange={(e) => setEditando({ ...editando, mensagem: e.target.value })} /></Campo>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={editando.destaque} onChange={(e) => setEditando({ ...editando, destaque: e.target.checked })} /> Mostrar como destaque no Início</label>
            <p className="text-xs text-muted-foreground">A alteração também atualiza o aviso que já chegou para as famílias.</p>
            <div className="flex gap-2"><Btn onClick={salvarEdicao}>Salvar</Btn><Btn v="ghost" onClick={() => setEditando(null)}>Cancelar</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
