import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, ClipboardList, HandHeart, Map, MapPin, NotebookPen, Phone, Search, ShieldCheck, Users } from "lucide-react";
import { TopBar } from "@/components/app/AppShell";
import { CardLink, btn } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { ready, user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  useEffect(() => { if (ready && user) nav({ to: "/inicio" }); }, [ready, user, nav]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-coral/85" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-52 top-[34rem] h-[30rem] w-[30rem] rounded-full bg-navy/90 dark:bg-primary/30" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-[-6rem] h-72 w-72 rounded-full bg-primary-soft" />
      <div className="relative">
        <TopBar publico />
        <main id="conteudo" className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 lg:grid-cols-[1.1fr_.9fr] lg:pt-16">
          <section className="flex flex-col gap-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Informação · Acolhimento · Apoio</p>
            <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.05] sm:text-6xl">
              Você não está <span className="text-primary">sozinha!</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Informação, acolhimento e apoio para caminhar ao lado de quem mais precisa de você. Encontre especialistas perto de você,
              organize o dia a dia do seu filho e conheça seus direitos.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); nav({ to: "/buscar", search: { q } as any }); }}
              className="flex max-w-xl items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-5 shadow-card"
              role="search"
            >
              <label htmlFor="busca-home" className="sr-only">Buscar especialistas</label>
              <input id="busca-home" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar especialistas ou cidade"
                className="min-h-12 min-w-0 flex-1 bg-transparent text-base outline-none" />
              <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-white shadow-float" aria-label="Buscar">
                <Search className="h-5 w-5" />
              </button>
            </form>
            <div className="flex max-w-xl flex-col gap-3">
              <CardLink to="/buscar" icon={Search} title="Encontrar atendimento" subtitle="Busque por especialidade e cidade" />
              <CardLink to="/buscar" icon={Map} tom="green" title="Explorar pelo mapa" subtitle="Veja opções perto de você" />
              <CardLink to="/buscar" icon={ClipboardList} tom="coral" title="Navegar no diretório" subtitle="Profissionais e serviços por estado e cidade" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/cadastro" className={cn(btn.base, btn.primary, "min-h-14 px-7 text-lg")}>Fazer meu cadastro</Link>
              <Link to="/entrar" className={cn(btn.base, btn.outline, "min-h-14 px-7 text-lg")}>Já tenho cadastro</Link>
            </div>
          </section>

          <section aria-label="O que você encontra" className="grid content-start gap-3 sm:grid-cols-2">
            {[
              [NotebookPen, "Diário da criança", "Crises, sono, alimentação, conquistas e registro sensorial. Relatórios para o médico e a escola.", "blue"],
              [ClipboardList, "Acesso ao BPC", "Passo a passo, documentos e checklist para o Meu INSS.", "amber"],
              [ShieldCheck, "Direitos", "Leis explicadas em linguagem simples, com link oficial.", "blue"],
              [Users, "Rede de mães", "Grupo de WhatsApp moderado para trocar experiências.", "green"],
              [HandHeart, "Mãe, você também importa", "Acolhimento, autocuidado e onde buscar apoio psicológico.", "coral"],
              [BookOpen, "Biblioteca", "Vídeos, cartilhas, leis e materiais confiáveis.", "navy"],
            ].map(([I, t, d, tom]: any) => (
              <div key={t} className="card-soft flex flex-col gap-2 p-5">
                <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", tom === "amber" ? "bg-warning-soft text-warning" : tom === "green" ? "bg-success-soft text-success" : tom === "coral" ? "bg-coral-soft text-coral" : tom === "navy" ? "bg-secondary text-navy" : "bg-primary-soft text-primary")}>
                  <I className="h-5 w-5" />
                </span>
                <h2 className="font-display text-lg font-bold">{t}</h2>
                <p className="text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </section>
        </main>

        <footer className="relative border-t border-border bg-card/95">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8">
            <p className="font-display font-bold text-navy">Em emergência, ligue:</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["192", "SAMU"], ["193", "Bombeiros"], ["190", "Polícia"], ["188", "CVV"]].map(([n, l]) => (
                <a key={n} href={`tel:${n}`} className="tap flex items-center gap-2 rounded-xl bg-emergency-soft px-3 font-semibold text-emergency">
                  <Phone className="h-4 w-4" /> {n} · {l}
                </a>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Esta plataforma oferece informação e apoio e não substitui atendimento médico, psicológico ou serviços de emergência. ·{" "}
              <Link to="/privacidade" className="underline">Política de privacidade</Link> · <Link to="/termos" className="underline">Termos de uso</Link>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
