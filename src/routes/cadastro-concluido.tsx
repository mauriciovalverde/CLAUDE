import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, btn } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/dados";
import { MSG_CONFIRMACAO_PADRAO, WHATSAPP_PADRAO, waLink } from "@/lib/br";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cadastro-concluido")({
  validateSearch: (s: Record<string, unknown>) => ({ abrir: s.abrir === "1" ? "1" : undefined }) as { abrir?: "1" },
  component: () => <AppShell><Concluido /></AppShell>,
});

function Concluido() {
  const { familia } = useAuth();
  const { abrir } = Route.useSearch();
  const cfg = useConfig();
  const numero = cfg.numero_confirmacao || WHATSAPP_PADRAO;
  const msg = cfg.mensagem_confirmacao || MSG_CONFIRMACAO_PADRAO;
  const url = waLink(numero, msg);
  const [tentou, setTentou] = useState(false);

  useEffect(() => {
    if (abrir && !tentou && cfg._ok) {
      setTentou(true);
      const w = window.open(url, "_blank", "noopener");
      if (!w) toast("Toque em “Abrir o WhatsApp” para confirmar seu cadastro.");
    }
  }, [abrir, tentou, url, cfg._ok]);

  const copiar = async (t: string) => {
    try { await navigator.clipboard.writeText(t); toast.success("Copiado!"); } catch { toast("Selecione o texto e copie."); }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="card-soft flex flex-col items-start gap-3 p-6">
        <CheckCircle2 className="h-14 w-14 text-success" />
        <h1 className="font-display text-3xl font-extrabold">Cadastro concluído!</h1>
        <p className="text-muted-foreground">Guarde o número de identificação da sua família:</p>
        <p className="font-display text-4xl font-extrabold tracking-wide text-primary">{familia?.numero ?? "…"}</p>
        {familia?.numero && <button onClick={() => copiar(familia.numero!)} className={cn(btn.base, btn.outline)}><Copy className="h-4 w-4" /> Copiar número</button>}
      </section>
      <section className="flex flex-col gap-3 rounded-3xl bg-success-soft p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-success text-white"><MessageCircle /></span>
          <div>
            <h2 className="font-display text-xl font-bold">Último passo: confirme pelo WhatsApp</h2>
            <p className="text-sm">A conversa com a equipe abre com a mensagem pronta: <b>“{msg}”</b>. É só tocar em enviar.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.wa, "min-h-14 px-6 text-lg")}><MessageCircle className="h-5 w-5" /> Abrir o WhatsApp</a>
          <button onClick={() => copiar(msg)} className={cn(btn.base, btn.outline)}><Copy className="h-4 w-4" /> Copiar mensagem</button>
        </div>
        <p className="text-xs text-muted-foreground">Sem WhatsApp neste aparelho? Envie a mensagem para ({numero.slice(2, 4)}) {numero.slice(4, 9)}-{numero.slice(9)}. Nenhum dado pessoal ou de saúde vai pelo WhatsApp.</p>
      </section>
      <Aviso tom="blue">Enquanto a equipe confirma, você já pode usar o diário, as orientações e a busca de especialistas. O grupo de mães e o envio de histórias são liberados após a confirmação.</Aviso>
      <Link to="/inicio" className={cn(btn.base, btn.primary, "self-start")}>Ir para o início</Link>
    </div>
  );
}
