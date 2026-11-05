import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Card, Chip, PageHeader, Vazio, btn } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useConfig, useQuery } from "@/lib/dados";
import { fDataHora } from "@/lib/br";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rede")({ component: () => <AppShell><Rede /></AppShell> });

function Rede() {
  const cfg = useConfig();
  const { familia, isStaff } = useAuth();
  const [aceito, setAceito] = useState(false);
  const aprovada = familia?.status === "aprovado" || isStaff;
  const { data: enc } = useQuery<any[]>(async () => (await db.from("encontros").select("*").gte("data", new Date(Date.now() - 864e5).toISOString()).order("data")).data ?? [], []);
  const regras = (cfg.regras_convivencia ?? "").split("\n").filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Rede" highlight="de apoio" subtitle="Um espaço de troca entre mães e famílias atípicas, com mediação da equipe do Centro." back={{ to: "/apoio", label: "Apoio" }} />
      <section className="flex flex-col gap-4 rounded-3xl bg-success-soft p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-success text-white"><MessageCircle className="h-7 w-7" /></span>
          <div><h2 className="font-display text-xl font-bold">Grupo no WhatsApp</h2><p>Tire dúvidas, compartilhe vitórias e encontre acolhimento.</p></div>
        </div>
        {regras.length > 0 && (
          <div className="rounded-2xl bg-card p-4">
            <p className="mb-2 flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-success" /> Regras de convivência</p>
            <ul className="list-disc pl-5 text-sm">{regras.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
        {!aprovada ? (
          <Aviso tom="amber">O link do grupo fica disponível depois que a equipe confirmar o seu cadastro.</Aviso>
        ) : !cfg.whatsapp_grupo ? (
          <Aviso>O link do grupo ainda não foi configurado pela equipe. Volte em breve.</Aviso>
        ) : (
          <>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-success)]" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
              Li e concordo com as regras de convivência. Sei que meu número ficará visível para as outras participantes do grupo.
            </label>
            <a href={aceito ? cfg.whatsapp_grupo : undefined} aria-disabled={!aceito} target="_blank" rel="noopener noreferrer"
              className={cn(btn.base, btn.wa, "self-start", !aceito && "pointer-events-none opacity-50")}>
              <MessageCircle className="h-5 w-5" /> Entrar no grupo
            </a>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold">Próximos encontros</h2>
        {(enc ?? []).length ? enc!.map((e) => (
          <Card key={e.id} className="flex flex-col gap-1">
            <Chip tom="coral" className="w-fit"><CalendarDays className="h-3.5 w-3.5" /> {fDataHora(e.data)}</Chip>
            <h3 className="font-display text-lg font-bold">{e.titulo}</h3>
            {e.local && <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {e.local}</p>}
            {e.descricao && <p className="text-sm">{e.descricao}</p>}
          </Card>
        )) : <Vazio icon={CalendarDays} titulo="Nenhum encontro marcado" texto="Quando a equipe agendar rodas de conversa, elas aparecem aqui e você recebe um aviso." />}
      </section>
    </div>
  );
}
