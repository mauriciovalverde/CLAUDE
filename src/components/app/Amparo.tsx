import { useEffect, useRef, useState } from "react";
import { Compass, Footprints, HandHeart, NotebookPen, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * REGRA DE IDENTIDADE — AMPARO
 * Palavras e ordem das letras FIXAS (A-M-P-A-R-O). Não substituir, não reordenar.
 * Use sempre esta constante em qualquer parte do site (página inicial, seção "O AMPARO" etc.).
 * O significado das letras é complementar à logomarca oficial: não alterar a logo.
 */
export const AMPARO: { palavra: string; texto: string; icone: LucideIcon }[] = [
  { palavra: "ACOLHER", texto: "Receber cada família com empatia, respeito, escuta e atenção às suas necessidades.", icone: HandHeart },
  { palavra: "MOBILIZAR", texto: "Unir famílias, profissionais, instituições e a sociedade na construção de uma rede solidária e participativa.", icone: Users },
  { palavra: "PROTEGER", texto: "Promover o conhecimento dos direitos, a inclusão, a segurança e a dignidade das pessoas atípicas e seus familiares.", icone: ShieldCheck },
  { palavra: "ACOMPANHAR", texto: "Estar presente na jornada das famílias, facilitando o acompanhamento de solicitações, atendimentos e necessidades.", icone: Footprints },
  { palavra: "REGISTRAR", texto: "Facilitar o registro de demandas, denúncias, solicitações e dificuldades enfrentadas pelas famílias, contribuindo para sua documentação e encaminhamento.", icone: NotebookPen },
  { palavra: "ORIENTAR", texto: "Oferecer informações confiáveis e acessíveis sobre saúde, educação, direitos, benefícios e serviços de apoio.", icone: Compass },
];

export const AMPARO_FRASE =
  "Mais do que um nome, AMPARO é um compromisso com cada família. Acolher, Mobilizar, Proteger, Acompanhar, Registrar e Orientar.";

const OURO = "#F18816";
const OURO_CLARO = "#FFD02E";
const MARINHO = "#101F50";

/** Aparece suavemente ao rolar (respeita "reduzir movimento"). */
function useAoRolar<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisivel(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisivel(true); io.disconnect(); } },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visivel };
}

function Item({ palavra, texto, icone: Icone, i, fundo }: (typeof AMPARO)[number] & { i: number; fundo: "escuro" | "claro" }) {
  const { ref, visivel } = useAoRolar<HTMLLIElement>();
  const escuro = fundo === "escuro";
  return (
    <li
      ref={ref}
      style={{ transitionDelay: `${(i % 3) * 90}ms` }}
      className={cn(
        "group relative flex gap-4 rounded-3xl p-5 transition-all duration-700 ease-out sm:p-6",
        escuro ? "border border-white/10 bg-white/[0.04] hover:bg-white/[0.07]" : "border border-[#101F50]/10 bg-white shadow-card",
        visivel ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      )}
    >
      <span
        aria-hidden="true"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
        style={{ background: escuro ? "rgba(241,136,22,.14)" : "#FFF3E0", color: OURO }}
      >
        <Icone className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <h3 className="font-display text-xl font-extrabold tracking-[0.06em] sm:text-2xl" aria-label={palavra}>
          <span style={{ color: escuro ? OURO_CLARO : OURO }}>{palavra[0]}</span>
          <span style={{ color: escuro ? "#FFFFFF" : MARINHO }}>{palavra.slice(1)}</span>
        </h3>
        <p className={cn("mt-1.5 text-[15px] leading-relaxed", escuro ? "text-white/75" : "text-[#101F50]/75")}>{texto}</p>
      </div>
    </li>
  );
}

/** Seção "AMPARO: seis letras, uma missão." */
export function AmparoSecao({ fundo = "escuro", className }: { fundo?: "escuro" | "claro"; className?: string }) {
  const escuro = fundo === "escuro";
  const topo = useAoRolar<HTMLDivElement>();
  const fim = useAoRolar<HTMLParagraphElement>();
  return (
    <section
      id="o-amparo"
      aria-labelledby="amparo-titulo"
      className={cn("relative overflow-hidden", className)}
      style={{ background: escuro ? MARINHO : "#F6F8FC" }}
    >
      {escuro && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: OURO }} />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full opacity-25 blur-3xl" style={{ background: "#783487" }} />
        </>
      )}
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div
          ref={topo.ref}
          className={cn("mx-auto max-w-3xl text-center transition-all duration-700 ease-out", topo.visivel ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}
        >
          <p className="text-xs font-bold uppercase tracking-[0.28em]" style={{ color: escuro ? OURO_CLARO : OURO }}>O AMPARO</p>
          <h2 id="amparo-titulo" className={cn("mt-3 font-display text-[2rem] font-extrabold leading-tight sm:text-5xl", escuro ? "text-white" : "text-[#101F50]")}>
            AMPARO: seis letras, <span style={{ color: escuro ? OURO_CLARO : OURO }}>uma missão.</span>
          </h2>
          {/* Sigla em destaque, letra por letra */}
          <div aria-hidden="true" className="mt-6 flex justify-center gap-1.5 sm:gap-3">
            {AMPARO.map((a, i) => (
              <span
                key={a.palavra}
                style={{ transitionDelay: `${150 + i * 80}ms`, color: OURO, background: escuro ? "rgba(255,255,255,.06)" : "#FFFFFF" }}
                className={cn(
                  "grid h-12 w-11 place-items-center rounded-xl font-display text-2xl font-extrabold transition-all duration-500 sm:h-16 sm:w-14 sm:text-4xl",
                  escuro ? "border border-white/10" : "border border-[#101F50]/10 shadow-card",
                  topo.visivel ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                )}
              >
                {a.palavra[0]}
              </span>
            ))}
          </div>
        </div>

        <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {AMPARO.map((a, i) => <Item key={a.palavra} {...a} i={i} fundo={fundo} />)}
        </ol>

        <p
          ref={fim.ref}
          className={cn(
            "mx-auto mt-12 max-w-3xl text-center font-display text-lg font-semibold leading-relaxed transition-all duration-700 sm:text-xl",
            escuro ? "text-white/90" : "text-[#101F50]",
            fim.visivel ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
          )}
        >
          “{AMPARO_FRASE}”
        </p>
      </div>
    </section>
  );
}
