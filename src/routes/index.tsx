import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, ClipboardList, HandHeart, Map, MapPin, NotebookPen, Phone, Search, ShieldCheck, Users } from "lucide-react";
import { TopBar } from "@/components/app/AppShell";
import { AmparoSecao } from "@/components/app/Amparo";
import { BaixarApp } from "@/components/app/BaixarApp";
import { TituloJustificado } from "@/components/app/TituloJustificado";
import { CardLink, Logo, btn } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { ready, user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  useEffect(() => { if (ready && user) nav({ to: "/inicio" }); }, [ready, user, nav]);

  const TEXTO = "Informação, acolhimento e apoio para caminhar ao lado de quem mais precisa de você. Encontre especialistas perto de você, organize o dia a dia do seu filho e conheça seus direitos.";
  const busca = (id: string) => (
    <form onSubmit={(e) => { e.preventDefault(); nav({ to: "/buscar", search: { q } as any }); }}
      className="flex w-full items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-5 text-left shadow-card" role="search">
      <label htmlFor={id} className="sr-only">Buscar especialistas</label>
      <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar especialista ou cidade"
        className="min-h-12 min-w-0 flex-1 bg-transparent text-base outline-none" />
      <MapPin className="hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden="true" />
      <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-white shadow-float" aria-label="Buscar">
        <Search className="h-5 w-5" />
      </button>
    </form>
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-24 h-[28rem] w-[28rem] rounded-full bg-primary-soft opacity-70 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-[38rem] h-80 w-80 rounded-full bg-warning-soft opacity-60 blur-2xl" />
      <div className="relative">
        <TopBar publico />
        <main id="conteudo" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          {/* HERO */}
          <section className="pt-6 md:pt-12 lg:pt-16">
            {/* Celular: logo à esquerda e título justificado ao lado */}
            <div className="flex flex-col gap-5 md:hidden">
              <div className="flex items-center gap-4">
                <Logo grande className="w-[44%] max-w-[12rem] shrink-0" />
                <div className="min-w-0 flex-1">
                  <TituloJustificado rotulo="Você não está sozinha!" className="text-navy"
                    linhas={[{ texto: "VOCÊ" }, { texto: "NÃO ESTÁ" }, { texto: "SOZINHA!", className: "text-primary" }]} />
                </div>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Informação · Acolhimento · Apoio</p>
              <p className="text-base text-muted-foreground">{TEXTO}</p>
              {busca("busca-home")}
              <div className="grid gap-3">
                <Link to="/cadastro" className={cn(btn.base, btn.primary, "min-h-14 w-full px-6 text-lg")}>Fazer meu cadastro</Link>
                <Link to="/entrar" className={cn(btn.base, btn.outline, "min-h-14 w-full px-6 text-lg")}>Já tenho cadastro</Link>
              </div>
              <BaixarApp />
            </div>

            {/* Computador e tablet: composição centralizada e simétrica */}
            <div className="hidden flex-col items-center text-center md:flex">
              <div className="relative grid place-items-center">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  <span className="absolute -left-16 top-6 h-56 w-56 rounded-full bg-[#00C5F2]/25 blur-3xl" />
                  <span className="absolute -right-16 top-2 h-56 w-56 rounded-full bg-[#FFCD00]/30 blur-3xl" />
                  <span className="absolute bottom-0 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-[#00A35B]/15 blur-3xl" />
                </div>
                <Logo grande className="relative w-[17rem] justify-center lg:w-[19rem] [&_img]:max-w-none" />
              </div>
              <p className="mt-8 text-xs font-bold uppercase tracking-[0.24em] text-primary">Informação · Acolhimento · Apoio</p>
              <h1 className="mt-3 font-display text-6xl font-extrabold leading-[1.05] text-navy lg:text-7xl">
                Você não está <span className="text-primary">sozinha!</span>
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{TEXTO}</p>
              <div className="mt-8 w-full max-w-2xl">{busca("busca-home-pc")}</div>
              <div className="mt-4 grid w-full max-w-3xl grid-cols-3 gap-3">
                <Link to="/cadastro" className={cn(btn.base, btn.primary, "min-h-14 w-full px-5 text-base")}>Fazer meu cadastro</Link>
                <Link to="/entrar" className={cn(btn.base, btn.outline, "min-h-14 w-full px-5 text-base")}>Já tenho cadastro</Link>
                <BaixarApp className="min-h-14 gap-2 whitespace-nowrap rounded-full px-4 text-base [&>span]:hidden" />
              </div>
              <a href="#o-amparo" className="mt-8 font-display text-xs font-bold uppercase tracking-[0.24em] text-navy/60 hover:text-primary">
                Seis letras, uma missão ↓
              </a>
            </div>
          </section>

          {/* COMECE POR AQUI */}
          <section aria-labelledby="comece" className="mt-12 md:mt-16">
            <h2 id="comece" className="mb-4 md:mb-6 md:text-center font-display text-xl font-extrabold text-navy sm:text-2xl">Comece por aqui</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <CardLink to="/buscar" icon={Search} title="Encontrar atendimento" subtitle="Por especialidade e cidade" />
              <CardLink to="/buscar" icon={Map} tom="green" title="Explorar pelo mapa" subtitle="Opções perto de você" />
              <CardLink to="/buscar" icon={ClipboardList} tom="coral" title="Navegar no diretório" subtitle="Por estado e cidade" />
            </div>
          </section>

          {/* O QUE VOCÊ ENCONTRA */}
          <section aria-labelledby="encontra" className="mt-12 md:mt-16">
            <h2 id="encontra" className="mb-4 md:mb-6 md:text-center font-display text-xl font-extrabold text-navy sm:text-2xl">O que você encontra no AMPARO</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [NotebookPen, "Diário da criança", "Crises, sono, alimentação, conquistas e registro sensorial. Relatórios para o médico e a escola.", "blue"],
                [ClipboardList, "Acesso ao BPC", "Passo a passo, documentos e checklist para o Meu INSS.", "amber"],
                [ShieldCheck, "Direitos", "Leis explicadas em linguagem simples, com link oficial.", "blue"],
                [Users, "Rede de mães", "Grupo de WhatsApp moderado para trocar experiências.", "green"],
                [HandHeart, "Mãe, você também importa", "Acolhimento, autocuidado e onde buscar apoio psicológico.", "coral"],
                [BookOpen, "Biblioteca", "Vídeos, cartilhas, leis e materiais confiáveis.", "navy"],
              ].map(([I, t, d, tom]: any) => (
                <div key={t} className="card-soft flex gap-4 p-5 sm:flex-col sm:gap-2">
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", tom === "amber" ? "bg-warning-soft text-warning" : tom === "green" ? "bg-success-soft text-success" : tom === "coral" ? "bg-coral-soft text-coral" : tom === "navy" ? "bg-secondary text-navy" : "bg-primary-soft text-primary")}>
                    <I className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-navy">{t}</h3>
                    <p className="text-sm text-muted-foreground">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <AmparoSecao />

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
