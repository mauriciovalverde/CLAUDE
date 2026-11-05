import { Link } from "@tanstack/react-router";
import { Globe, Heart, Mail, MapPin, MessageCircle, Phone, Stethoscope } from "lucide-react";
import { Chip, Verificado, btn } from "@/components/app/kit";
import { digits, fmtTel, nomeCategoria, waLink } from "@/lib/br";
import { cn } from "@/lib/utils";

export type ItemDiretorio = {
  id: string; nome: string; tipo: string; categoria: string; especialidade: string | null; registro: string | null; descricao: string | null;
  telefone: string | null; whatsapp: string | null; email: string | null; site: string | null; endereco: string | null; cidade: string | null; uf: string | null;
  lat: number | null; lng: number | null; atende_online: boolean; sus: boolean; plano: boolean; particular: boolean; valor_social: boolean;
  horarios: string | null; foto_url: string | null; nacional: boolean; validado: boolean;
};

export function iniciais(n: string) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase(); }

export function CartaoProfissional({ p, fav, onFav }: { p: ItemDiretorio; fav?: boolean; onFav?: () => void }) {
  return (
    <article className="card-soft flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        {p.foto_url ? <img src={p.foto_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
          : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary-soft font-display font-extrabold text-primary">{p.tipo === "servico" ? <Stethoscope className="h-6 w-6" /> : iniciais(p.nome)}</span>}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-tight text-primary">{p.nome} {p.validado && <Verificado />}</h3>
          <p className="text-sm text-navy">{[p.especialidade || nomeCategoria(p.categoria), p.registro].filter(Boolean).join(" | ")}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{p.nacional ? "Todo o Brasil" : [p.cidade, p.uf].filter(Boolean).join(", ")}</span>
            {p.telefone && <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" />{p.telefone.length > 4 ? fmtTel(p.telefone) : p.telefone}</span>}
          </p>
          {p.email && <p className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Mail className="h-4 w-4" />{p.email}</p>}
        </div>
        {onFav && (
          <button onClick={onFav} className="tap grid min-w-12 place-items-center rounded-full" aria-pressed={!!fav} aria-label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}>
            <Heart className={cn("h-6 w-6", fav ? "fill-coral text-coral" : "text-primary")} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {p.atende_online && <Chip tom="blue"><Globe className="h-3.5 w-3.5" /> Atende online</Chip>}
        {p.sus && <Chip tom="green">SUS / gratuito</Chip>}
        {p.plano && <Chip>Plano de saúde</Chip>}
        {p.particular && <Chip>Particular</Chip>}
        {p.valor_social && <Chip tom="coral">Valor social</Chip>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/profissional/$id" params={{ id: p.id }} className={cn(btn.base, btn.soft, "min-h-11 px-4 text-sm")}>Ver perfil</Link>
        {p.whatsapp && <a href={waLink(p.whatsapp.length <= 11 ? "55" + digits(p.whatsapp) : p.whatsapp)} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.wa, "min-h-11 px-4 text-sm")}><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
        {p.telefone && <a href={`tel:${digits(p.telefone)}`} className={cn(btn.base, btn.outline, "min-h-11 px-4 text-sm")}><Phone className="h-4 w-4" /> Ligar</a>}
      </div>
    </article>
  );
}

