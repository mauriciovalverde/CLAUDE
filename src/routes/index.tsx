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

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-24 h-[28rem] w-[28rem] rounded-full bg-primary-soft opacity-70 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-[38rem] h-80 w-80 rounded-full bg-warning-soft opacity-60 blur-2xl" />
      <div className="relative">
        <TopBar publico />
        <main id="conteudo" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          {/* HERO */}
          <section className="grid items-center gap-8 pt-6 md:grid-cols-[1.1fr_.9fr] md:gap-12 md:pt-14">
            <div className="flex flex-col gap-5">
              {/* Celular: logo à esquerda e título ao lado. Computador: só o título (a logo fica no cartão à direita). */}
              <div className="flex items-center gap-4 md:block">
                <Logo grande className="w-[44%] max-w-[12rem] shrink-0 md:hidden" />
                <div className="min-w-0 flex-1 md:mb-2 md:mt-2 md:max-w-[26rem]">
                  <TituloJustificado rotulo="Você não está sozinha!" className="text-navy"
                    linhas={[{ texto: "VOCÊ" }, { texto: "NÃO ESTÁ" }, { texto: "SOZINHA!", className: "text-primary" }]} />
                </div>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary sm:text-xs md:-order-1">Informação · Acolhimento · Apoio</p>
              <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
                Informação, acolhimento e apoio para caminhar ao lado de quem mais precisa de você. Encontre especialistas perto de você,
                organize o dia a dia do seu filho e conheça seus direitos.
              </p>
              <form
                onSubmit={(e) => { e.preventDefault(); nav({ to: "/buscar", search: { q } as any }); }}
                className="flex w-full max-w-xl items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-5 shadow-card"
                role="search"
              >
                <label htmlFor="busca-home" className="sr-only">Buscar especialistas</label>
                <input id="busca-home" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar especialista ou cidade"
                  className="min-h-12 min-w-0 flex-1 bg-transparent text-base outline-none" />
                <MapPin className="hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden="true" />
                <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-white shadow-float" aria-label="Buscar">
                  <Search className="h-5 w-5" />
                </button>
              </form>
              <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                <Link to="/cadastro" className={cn(btn.base, btn.primary, "min-h-14 w-full px-6 text-lg")}>Fazer meu cadastro</Link>
                <Link to="/entrar" className={cn(btn.base, btn.outline, "min-h-14 w-full px-6 text-lg")}>Já tenho cadastro</Link>
              </div>
              <BaixarApp className="max-w-xl" />
            </div>

            {/* Cartão da marca (computador e tablet) */}
            <div className="hidden md:block">
              <div className="relative mx-auto max-w-md overflow-hidden rounded-[2rem] border border-border bg-card p-10 shadow-card">
                <div aria-hidden="true" className="faixa-marca absolute inset-x-0 top-0 h-1.5" />
                <Logo grande className="mx-auto w-full justify-center [&_img]:max-w-[20rem]" />
                <a href="#o-amparo" className="mt-6 block text-center font-display text-sm font-bold uppercase tracking-[0.2em] text-navy/70 hover:text-primary">
                  Seis letras, uma missão ↓
                </a>
              </div>
            </div>
          </section>

          {/* COMECE POR AQUI */}
          <section aria-labelledby="comece" className="mt-12 md:mt-16">
            <h2 id="comece" className="mb-4 font-display text-xl font-extrabold text-navy sm:text-2xl">Comece por aqui</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <CardLink to="/buscar" icon={Search} title="Encontrar atendimento" subtitle="Por especialidade e cidade" />
              <CardLink to="/buscar" icon={Map} tom="green" title="Explorar pelo mapa" subtitle="Opções perto de você" />
              <CardLink to="/buscar" icon={ClipboardList} tom="coral" title="Navegar no diretório" subtitle="Por estado e cidade" />
            </div>
          </section>

          {/* O QUE VOCÊ ENCONTRA */}
          <section aria-labelledby="encontra" className="mt-12 md:mt-16">
            <h2 id="encontra" className="mb-4 font-display text-xl font-extrabold text-navy sm:text-2xl">O que você encontra no AMPARO</h2>
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
