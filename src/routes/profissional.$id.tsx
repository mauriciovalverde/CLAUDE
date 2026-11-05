import { createFileRoute } from "@tanstack/react-router";
import { Clock, Globe, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { MapView } from "@/components/app/MapView";
import { Carregando, Chip, PageHeader, Vazio, Verificado, btn } from "@/components/app/kit";
import { iniciais, type ItemDiretorio } from "@/components/app/diretorio";
import { db, useQuery } from "@/lib/dados";
import { digits, fmtTel, nomeCategoria, waLink } from "@/lib/br";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profissional/$id")({ component: () => <AppShell><Perfil /></AppShell> });

function Perfil() {
  const { id } = Route.useParams();
  const { data: p, loading } = useQuery<ItemDiretorio | null>(async () => {
    const { data } = await db.from("diretorio").select("*").eq("id", id).maybeSingle();
    return data;
  }, [id]);
  if (loading) return <Carregando />;
  if (!p) return <Vazio icon={MapPin} titulo="Perfil não encontrado" texto="Este perfil não existe ou ainda não foi validado pela equipe." />;
  const tel = p.telefone ? (p.telefone.length > 4 ? fmtTel(p.telefone) : p.telefone) : null;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="" back={{ to: "/buscar", label: "Buscar" }} />
      <section className="card-soft flex flex-col gap-4 p-6">
        <div className="flex items-center gap-4">
          {p.foto_url ? <img src={p.foto_url} alt="" className="h-20 w-20 rounded-full object-cover" /> : <span className="grid h-20 w-20 place-items-center rounded-full bg-primary-soft font-display text-2xl font-extrabold text-primary">{iniciais(p.nome)}</span>}
          <div>
            <h1 className="font-display text-2xl font-extrabold text-primary">{p.nome} {p.validado && <Verificado />}</h1>
            <p className="text-navy">{[p.especialidade || nomeCategoria(p.categoria), p.registro].filter(Boolean).join(" | ")}</p>
            {p.validado && <p className="text-xs font-semibold text-primary">Validado pela equipe do Centro</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {p.atende_online && <Chip tom="blue"><Globe className="h-3.5 w-3.5" /> Atende online</Chip>}
          {p.sus && <Chip tom="green">SUS / gratuito</Chip>}
          {p.plano && <Chip>Plano de saúde</Chip>}
          {p.particular && <Chip>Particular</Chip>}
          {p.valor_social && <Chip tom="coral">Valor social</Chip>}
        </div>
        {p.descricao && <p className="max-w-2xl">{p.descricao}</p>}
        <ul className="flex flex-col gap-2 text-sm">
          {(p.endereco || p.cidade) && <li className="flex gap-2"><MapPin className="h-5 w-5 text-primary" />{p.nacional ? "Atendimento em todo o Brasil" : [p.endereco, p.cidade, p.uf].filter(Boolean).join(", ")}</li>}
          {tel && <li className="flex gap-2"><Phone className="h-5 w-5 text-primary" />{tel}</li>}
          {p.email && <li className="flex gap-2"><Mail className="h-5 w-5 text-primary" />{p.email}</li>}
          {p.site && <li className="flex gap-2"><Globe className="h-5 w-5 text-primary" /><a href={p.site} target="_blank" rel="noopener noreferrer" className="text-primary underline">{p.site.replace(/^https?:\/\//, "")}</a></li>}
          {p.horarios && <li className="flex gap-2"><Clock className="h-5 w-5 text-primary" />{p.horarios}</li>}
        </ul>
        <div className="flex flex-wrap gap-2">
          {p.whatsapp && <a href={waLink(digits(p.whatsapp).length <= 11 ? "55" + digits(p.whatsapp) : p.whatsapp)} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.wa)}><MessageCircle className="h-5 w-5" /> WhatsApp</a>}
          {p.telefone && <a href={`tel:${digits(p.telefone)}`} className={cn(btn.base, btn.primary)}><Phone className="h-5 w-5" /> Ligar</a>}
          {p.email && <a href={`mailto:${p.email}`} className={cn(btn.base, btn.outline)}><Mail className="h-5 w-5" /> E-mail</a>}
        </div>
      </section>
      {p.lat != null && p.lng != null && <MapView pontos={[{ id: p.id, nome: p.nome, lat: p.lat, lng: p.lng }]} centro={[p.lat, p.lng]} />}
    </div>
  );
}
