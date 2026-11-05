import { cn } from "@/lib/utils";

/** Renderiza texto simples: parágrafos separados por linha em branco e listas com "- " ou "1. ". */
export function Texto({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col gap-3 leading-relaxed">
      {texto.split(/\n{2,}/).map((bloco, i) => {
        const linhas = bloco.split("\n");
        if (linhas.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l))) {
          const ordenada = /^\s*\d/.test(linhas[0]);
          const L = ordenada ? "ol" : "ul";
          return <L key={i} className={cn("flex flex-col gap-1 pl-5", ordenada ? "list-decimal" : "list-disc")}>{linhas.map((l, j) => <li key={j}>{l.replace(/^\s*([-•*]|\d+[.)])\s+/, "")}</li>)}</L>;
        }
        return <p key={i} className="whitespace-pre-line">{bloco}</p>;
      })}
    </div>
  );
}
