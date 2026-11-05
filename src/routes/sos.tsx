import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Ambulance, Baby, Flame, HeartHandshake, Phone, Shield, Wind } from "lucide-react";
import { TopBar } from "@/components/app/AppShell";
import { Card, btn } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/dados";
import { digits, fmtTel } from "@/lib/br";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sos")({
  head: () => ({ meta: [{ title: "Preciso de ajuda agora · Centro de Acolhimento" }] }),
  component: SOS,
});

const NUMEROS: [string, string, string, any][] = [
  ["192", "SAMU", "Emergência médica, convulsão, desmaio, ferimento grave", Ambulance],
  ["193", "Bombeiros", "Acidentes, risco de vida, criança presa ou perdida", Flame],
  ["190", "Polícia Militar", "Violência ou ameaça acontecendo agora", Shield],
  ["188", "CVV", "Apoio emocional 24h, gratuito e sigiloso", HeartHandshake],
  ["100", "Disque 100", "Violação de direitos de crianças e pessoas com deficiência", Baby],
  ["180", "Central da Mulher", "Violência contra a mulher", Shield],
];

const PASSOS = [
  ["Segurança primeiro", "Afaste objetos perigosos e leve a criança para um lugar seguro, sem plateia."],
  ["Diminua os estímulos", "Apague luzes fortes, reduza barulho, ofereça abafador ou objeto de conforto."],
  ["Fale pouco e com calma", "Frases curtas, voz baixa. Evite perguntas e ordens durante a crise."],
  ["Espere passar", "A crise tem começo, meio e fim. Fique por perto e disponível, sem forçar contato."],
  ["Depois, acolha", "Quando acalmar, ofereça água, descanso e carinho. Registre no diário o que aconteceu antes."],
];

function Respiracao() {
  const [fase, setFase] = useState(0);
  const [on, setOn] = useState(false);
  useEffect(() => { if (!on) return; const t = setInterval(() => setFase((f) => (f + 1) % 3), 4000); return () => clearInterval(t); }, [on]);
  const txt = ["Inspire pelo nariz…", "Segure…", "Solte devagar pela boca…"][fase];
  return (
    <Card className="flex flex-col items-center gap-4 text-center">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold"><Wind className="h-5 w-5 text-primary" /> Respire comigo, mãe</h2>
      <div className={cn("grid h-36 w-36 place-items-center rounded-full bg-primary-soft transition-transform duration-[4000ms] ease-in-out", on && fase === 0 && "scale-125", on && fase === 2 && "scale-90")}>
        <span className="px-3 text-sm font-semibold text-primary">{on ? txt : "Pronta?"}</span>
      </div>
      <button onClick={() => { setOn(!on); setFase(0); }} className={cn(btn.base, on ? btn.outline : btn.primary)}>{on ? "Parar" : "Começar respiração"}</button>
      <p className="text-sm text-muted-foreground">Você precisa estar bem para cuidar. Um minuto de respiração já ajuda.</p>
    </Card>
  );
}

function SOS() {
  const { familia } = useAuth();
  const [contato, setContato] = useState<{ nome: string; tel: string } | null>(null);
  useEffect(() => {
    if (!familia) return;
    db.from("familias").select("emergencia_nome,emergencia_telefone").eq("id", familia.id).maybeSingle().then(({ data }: any) => {
      if (data?.emergencia_telefone) setContato({ nome: data.emergencia_nome ?? "Contato de emergência", tel: data.emergencia_telefone });
    });
  }, [familia]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar publico />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        <section className="rounded-3xl bg-emergency p-6 text-emergency-foreground">
          <h1 className="font-display text-3xl font-extrabold">Preciso de ajuda agora</h1>
          <p className="mt-1 opacity-95">Se existe risco de vida, ligue imediatamente. A ligação é gratuita.</p>
          <a href="tel:192" className="tap mt-4 inline-flex items-center gap-2 rounded-full bg-white px-6 text-lg font-extrabold text-emergency"><Phone /> Ligar 192 · SAMU</a>
        </section>

        {contato && (
          <a href={`tel:${digits(contato.tel)}`} className="card-soft flex items-center gap-4 p-5">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-success text-white"><Phone /></span>
            <span className="flex-1"><b className="block text-navy">Ligar para {contato.nome}</b><span className="text-sm text-muted-foreground">{fmtTel(contato.tel)}</span></span>
          </a>
        )}

        <section className="grid gap-3 sm:grid-cols-2">
          {NUMEROS.map(([n, nome, desc, I]) => (
            <a key={n} href={`tel:${n}`} className="card-soft flex items-center gap-4 p-4 transition hover:border-emergency">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emergency-soft font-display text-xl font-extrabold text-emergency">{n}</span>
              <span><b className="flex items-center gap-1 text-navy"><I className="h-4 w-4" /> {nome}</b><span className="text-sm text-muted-foreground">{desc}</span></span>
            </a>
          ))}
        </section>

        <Card>
          <h2 className="mb-3 font-display text-xl font-bold">Durante uma crise</h2>
          <ol className="flex flex-col gap-3">
            {PASSOS.map(([t, d], i) => (
              <li key={t} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary font-bold text-white">{i + 1}</span><span><b>{t}.</b> {d}</span></li>
            ))}
          </ol>
          <Link to="/conteudo/$slug" params={{ slug: "crise" }} className={cn(btn.base, btn.soft, "mt-4")}>Ver orientações completas</Link>
        </Card>

        <Respiracao />
        <p className="text-center text-xs text-muted-foreground">Este aplicativo não substitui atendimento de emergência. Em caso de convulsão com mais de 5 minutos, dificuldade para respirar, ferimento ou ingestão de substância, ligue 192.</p>
      </main>
    </div>
  );
}
