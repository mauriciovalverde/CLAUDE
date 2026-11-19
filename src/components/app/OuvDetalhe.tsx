import { useEffect, useState } from "react";
import { ExternalLink, FileText, MapPin } from "lucide-react";
import { Btn, Chip, Modal } from "@/components/app/kit";
import { MapaPonto, linkMapa } from "@/components/app/MapaPonto";
import { fDataHora } from "@/lib/br";
import { EVENTO_OUV, fmtTamanho, urlAssinada } from "@/lib/ouvidoria";
import { cn } from "@/lib/utils";

export type Manif = {
  id: string; protocolo: string; tipo: string; assunto: string; descricao: string; endereco: string | null; referencia: string | null;
  lat: number | null; lng: number | null; precisao_m: number | null; loc_origem: string | null; loc_capturada_em: string | null;
  status: string; setor_id: string | null; resposta: string | null; respondida_em: string | null; created_at: string; atualizado_em: string; user_id: string;
};
export type Evento = { id: string; tipo: string; setor_id: string | null; mensagem: string | null; autor_id: string | null; autor_papel: string; created_at: string };
export type AnexoBD = { id: string; evento_id: string | null; path: string; nome: string; mime: string; tamanho: number; created_at: string };

/** Miniaturas e documentos. Os links são temporários (10 min) e só funcionam para quem tem permissão. */
export function ListaAnexos({ anexos }: { anexos: AnexoBD[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [aberta, setAberta] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    Promise.all(anexos.map(async (a) => [a.id, await urlAssinada(a.path)] as const)).then((l) => vivo && setUrls(Object.fromEntries(l.filter(([, u]) => u) as any)));
    return () => { vivo = false; };
  }, [anexos.map((a) => a.id).join()]);
  if (!anexos.length) return null;
  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {anexos.map((a) => a.mime.startsWith("image/") ? (
          <li key={a.id}><button type="button" onClick={() => setAberta(urls[a.id] ?? null)} className="block aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted" aria-label={`Ver foto ${a.nome}`}>
            {urls[a.id] ? <img src={urls[a.id]} alt={a.nome} className="h-full w-full object-cover" loading="lazy" /> : null}
          </button></li>
        ) : (
          <li key={a.id} className="col-span-3 sm:col-span-2"><a href={urls[a.id]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
            <FileText className="h-5 w-5 shrink-0 text-coral" /><span className="min-w-0 flex-1 truncate font-semibold">{a.nome}</span><span className="text-xs text-muted-foreground">{fmtTamanho(a.tamanho)}</span>
          </a></li>
        ))}
      </ul>
      {aberta && <Modal titulo="Foto anexada" onFechar={() => setAberta(null)} largura="max-w-3xl"><img src={aberta} alt="Foto anexada" className="max-h-[75vh] w-full rounded-2xl object-contain" /></Modal>}
    </>
  );
}

export function LocalInfo({ m }: { m: Manif }) {
  const [ver, setVer] = useState(false);
  if (m.lat == null && !m.endereco && !m.referencia) return <p className="text-sm text-muted-foreground">Nenhum local informado.</p>;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {m.endereco && <p><b>Endereço:</b> {m.endereco}</p>}
      {m.referencia && <p><b>Referência:</b> {m.referencia}</p>}
      {m.lat != null && m.lng != null && (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <Chip tom={m.loc_origem === "gps" ? "blue" : "coral"}>{m.loc_origem === "gps" ? "GPS do celular" : "Marcado no mapa"}</Chip>
            <span className="font-mono">{m.lat.toFixed(6)}, {m.lng.toFixed(6)}</span>
            {m.precisao_m != null && <span className="text-muted-foreground">± {Math.round(m.precisao_m)} m</span>}
            {m.loc_capturada_em && <span className="text-muted-foreground">· {fDataHora(m.loc_capturada_em)}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Btn type="button" v="soft" className="min-h-10" onClick={() => setVer(!ver)}><MapPin className="h-4 w-4" /> {ver ? "Ocultar mapa" : "Ver local no mapa"}</Btn>
            <a href={linkMapa(m.lat, m.lng)} target="_blank" rel="noopener noreferrer" className="tap inline-flex items-center gap-1 text-sm font-semibold text-primary">Abrir no Google Maps <ExternalLink className="h-4 w-4" /></a>
          </div>
          {ver && <MapaPonto ponto={[m.lat, m.lng]} precisao={m.precisao_m} altura={240} />}
        </>
      )}
    </div>
  );
}

/** Linha do tempo em ordem cronológica. Encaminhamentos mostram o setor; respostas ficam em destaque. */
export function LinhaDoTempo({ eventos, setores, anexos, autores }: { eventos: Evento[]; setores: Record<string, string>; anexos: AnexoBD[]; autores?: Record<string, string> }) {
  return (
    <ol className="relative ml-3 flex flex-col gap-4 border-l-2 border-border pl-5">
      {eventos.map((e) => {
        const destaque = e.tipo === "resposta";
        const pede = e.tipo === "complemento_solicitado";
        const anx = anexos.filter((a) => a.evento_id === e.id && e.tipo !== "registro");
        return (
          <li key={e.id} className="relative">
            <span className={cn("absolute -left-[29px] top-1 h-4 w-4 rounded-full border-2 border-card", destaque ? "bg-success" : pede ? "bg-coral" : e.autor_papel === "cidadao" ? "bg-primary" : "bg-navy")} />
            <p className="text-xs text-muted-foreground">{fDataHora(e.created_at)}{autores && e.autor_id && autores[e.autor_id] ? ` · ${autores[e.autor_id]}` : ""}</p>
            <p className="font-semibold text-navy">{EVENTO_OUV[e.tipo] ?? e.tipo}{e.tipo === "encaminhamento" && e.setor_id ? ` para ${setores[e.setor_id] ?? "setor"}` : ""}</p>
            {e.mensagem && <p className={cn("mt-1 whitespace-pre-line rounded-xl p-3 text-sm", destaque ? "bg-success/10" : pede ? "bg-coral-soft" : "bg-muted")}>{e.mensagem}</p>}
            {anx.length > 0 && <div className="mt-2"><ListaAnexos anexos={anx} /></div>}
          </li>
        );
      })}
    </ol>
  );
}
