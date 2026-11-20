import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Linha = { texto: string; className?: string };

/**
 * Título em bloco justificado: cada linha ganha o tamanho de fonte que faz ela
 * ocupar exatamente a largura do bloco (todas com a mesma largura).
 */
export function TituloJustificado({ linhas, className, rotulo }: { linhas: Linha[]; className?: string; rotulo: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [tam, setTam] = useState<number[] | null>(null);

  const medir = () => {
    const el = ref.current;
    if (!el) return;
    const w = el.clientWidth;
    if (!w) return;
    const cs = getComputedStyle(el);
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    const base = 100;
    ctx.font = `${cs.fontWeight} ${base}px ${cs.fontFamily}`;
    // 0,99 evita quebra por arredondamento
    setTam(linhas.map((l) => (base * w * 0.99) / Math.max(1, ctx.measureText(l.texto).width)));
  };

  useLayoutEffect(medir, [linhas.map((l) => l.texto).join("|")]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    (document as any).fonts?.ready?.then(medir);
    return () => ro?.disconnect();
  }, []);

  return (
    <h1 ref={ref} aria-label={rotulo} className={cn("w-full font-display font-extrabold uppercase leading-[0.92] tracking-normal", className)}>
      {linhas.map((l, i) => (
        <span key={i} aria-hidden="true" className={cn("block whitespace-nowrap", l.className)}
          style={tam ? { fontSize: `${tam[i]}px` } : { fontSize: "2rem" }}>
          {l.texto}
        </span>
      ))}
    </h1>
  );
}
