import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BellRing, MessageCircle, Phone, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Aviso, Btn, Card, Chip, btn } from "@/components/app/kit";
import { db, useQuery } from "@/lib/dados";
import { digits, fDataHora, waLink } from "@/lib/br";
import { cn } from "@/lib/utils";

type Contato = { id: string; nome: string; telefone: string; vinculo: string | null; prioridade: number; token: string; confirmado_em: string | null };
type Envio = { id: string; contato_id: string | null; contato_nome: string; canal: string; status: string; detalhe: string | null };
export const MSG_ANJO = "ALERTA AMPARO: uma pessoa que cadastrou você como Número Anjo solicitou apoio neste momento. Entre em contato com ela e, se possível, ofereça acompanhamento e acolhimento. Caso exista risco imediato, procure os serviços de emergência.";
const tel55 = (t: string) => (digits(t).length <= 11 ? "55" + digits(t) : digits(t));
const ST_ENVIO: Record<string, [string, string]> = {
  aguardando_integracao: ["Envio automático não configurado", "amber"], aberto_pelo_usuario: ["WhatsApp aberto por você · entrega não confirmada", "blue"],
  enviado: ["Enviado pelo provedor", "blue"], entregue: ["Entregue (confirmado pelo provedor)", "green"], falhou: ["Falhou", "red"], cancelado: ["Cancelado", "navy"],
};

/** Botão de acionamento com confirmação (segurar 2 segundos), localização opcional, cancelamento e registro honesto de cada tentativa. */
export function AcionarAnjo({ contatos, compacto = false }: { contatos?: Contato[]; compacto?: boolean }) {
  const { data: lista } = useQuery<Contato[]>(async () => contatos ?? ((await db.from("anjo_contatos").select("*").order("prioridade")).data ?? []), [contatos?.length]);
  const confirmados = (contatos ?? lista ?? []).filter((c) => c.confirmado_em);
  const [local, setLocal] = useState(false);
  const [segurando, setSegurando] = useState(0);
  const [alerta, setAlerta] = useState<{ id: string; lat?: number; lng?: number; status: string } | null>(null);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const t = useRef<number | null>(null);
  useEffect(() => () => { if (t.current) clearInterval(t.current); }, []);

  async function disparar() {
    let lat: number | null = null, lng: number | null = null;
    if (local && navigator.geolocation) {
      await new Promise<void>((ok) => navigator.geolocation.getCurrentPosition((p) => { lat = p.coords.latitude; lng = p.coords.longitude; ok(); }, () => ok(), { timeout: 8000, enableHighAccuracy: true }));
    }
    const { data, error } = await db.rpc("anjo_acionar", { _lat: lat, _lng: lng });
    if (error) return toast.error(error.message);
    setAlerta({ id: data, lat: lat ?? undefined, lng: lng ?? undefined, status: "ativo" });
    const { data: e } = await db.from("anjo_envios").select("*").eq("alerta_id", data).order("created_at"); setEnvios(e ?? []);
  }
  function iniciar() {
    if (!confirmados.length) return toast.error("Você ainda não tem Número Anjo confirmado.");
    let n = 0; setSegurando(1);
    t.current = window.setInterval(() => { n += 1; setSegurando(n + 1); if (n >= 20) { clearInterval(t.current!); t.current = null; setSegurando(0); disparar(); } }, 100);
  }
  function soltar() { if (t.current) { clearInterval(t.current); t.current = null; } setSegurando(0); }
  async function cancelar() { await db.rpc("anjo_cancelar", { _alerta: alerta!.id }); setAlerta({ ...alerta!, status: "cancelado" }); setEnvios((x) => x.map((e) => e.status === "aguardando_integracao" ? { ...e, status: "cancelado" } : e)); toast.success("Alerta cancelado."); }
  const msg = () => `${MSG_ANJO}${alerta?.lat != null ? `\n\nLocalização compartilhada: https://maps.google.com/?q=${alerta.lat},${alerta.lng}` : ""}\n\nHorário: ${fDataHora(new Date())}`;
  async function abrirWa(e: Envio) {
    const c = (contatos ?? lista ?? []).find((x) => x.id === e.contato_id); if (!c) return;
    window.open(waLink(tel55(c.telefone), msg()), "_blank", "noopener");
    await db.rpc("anjo_marcar_aberto", { _envio: e.id }); setEnvios((x) => x.map((y) => y.id === e.id ? { ...y, status: "aberto_pelo_usuario" } : y));
  }

  if (alerta) return (
    <Card className="flex flex-col gap-3 border-emergency">
      <p className="flex items-center gap-2 font-display text-lg font-bold text-emergency"><BellRing className="h-5 w-5" /> {alerta.status === "cancelado" ? "Alerta cancelado" : "Alerta registrado"}</p>
      {alerta.status !== "cancelado" && <Aviso tom="amber">O envio automático por SMS/WhatsApp ainda não está configurado no AMPARO. Toque em cada contato para mandar a mensagem pelo seu WhatsApp. Só marcamos “entregue” quando um provedor confirmar.</Aviso>}
      <ul className="flex flex-col gap-2">{envios.map((e) => { const [l, tom] = ST_ENVIO[e.status] ?? [e.status, "navy"]; const c = (contatos ?? lista ?? []).find((x) => x.id === e.contato_id); return (
        <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted p-3">
          <b className="flex-1 text-navy">{e.contato_nome}</b><Chip tom={tom}>{l}</Chip>
          {alerta.status !== "cancelado" && <div className="flex w-full gap-2">
            <Btn v="wa" className="min-h-10" onClick={() => abrirWa(e)}><MessageCircle className="h-4 w-4" /> Enviar no WhatsApp</Btn>
            {c && <a href={`tel:${digits(c.telefone)}`} className={cn(btn.base, btn.outline, "min-h-10")}><Phone className="h-4 w-4" /> Ligar</a>}
          </div>}
        </li>
      ); })}</ul>
      <div className="flex flex-wrap gap-2">
        <a href="tel:192" className={cn(btn.base, btn.danger)}><Phone className="h-4 w-4" /> SAMU 192</a>
        {alerta.status !== "cancelado" && <Btn v="outline" onClick={cancelar}><XCircle className="h-4 w-4" /> Cancelar alerta</Btn>}
        <Btn v="ghost" onClick={() => setAlerta(null)}>Fechar</Btn>
      </div>
    </Card>
  );

  return (
    <Card className={cn("flex flex-col gap-3", compacto && "p-4")}>
      <div className="flex items-start gap-3"><ShieldAlert className="h-6 w-6 shrink-0 text-emergency" />
        <div><b className="block font-display text-lg text-navy">Acionar meus Números Anjo</b><span className="text-sm text-muted-foreground">{confirmados.length ? `${confirmados.length} contato(s) confirmado(s) vão ser avisados.` : <>Nenhum contato confirmado. <Link to="/anjo" className="font-semibold text-primary underline">Cadastrar</Link></>}</span></div></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={local} onChange={(e) => setLocal(e.target.checked)} /> Compartilhar minha localização no alerta</label>
      <button disabled={!confirmados.length} onPointerDown={iniciar} onPointerUp={soltar} onPointerLeave={soltar} onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) iniciar(); }} onKeyUp={soltar}
        className="tap relative overflow-hidden rounded-full bg-emergency px-6 py-3 font-display text-lg font-extrabold text-white shadow-lg disabled:opacity-50" aria-label="Segure por 2 segundos para acionar os Números Anjo">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-white/30 transition-[width]" style={{ width: `${Math.min(100, segurando * 5)}%` }} />
        <span className="relative">{segurando ? "Continue segurando…" : "SEGURE 2 SEGUNDOS PARA AVISAR"}</span>
      </button>
      <p className="text-xs text-muted-foreground">Segurar evita acionamentos acidentais. Depois você pode cancelar.</p>
    </Card>
  );
}
