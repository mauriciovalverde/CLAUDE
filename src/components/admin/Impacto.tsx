import { useState } from "react";
import { Download, TrendingUp } from "lucide-react";
import { Btn, Card, Carregando, Vazio, inputCls } from "@/components/app/kit";
import { db, useQuery } from "@/lib/dados";
import { baixarArquivo, csv } from "@/lib/br";
import { categoriaNome } from "@/lib/ouvidoria";
import { cn } from "@/lib/utils";

type Mun = { municipio: string; familias: number | null; demandas: number | null; pendentes: number | null; na_rede: number | null };
const BLOCOS: [string, [string, string, string][]][] = [
  ["Comunidade", [["familias", "Famílias cadastradas", "text-primary"], ["na_rede", "Na Rede de Famílias", "text-success"], ["nucleos", "Núcleos comunitários", "text-success"], ["grupos", "Grupos de apoio", "text-success"], ["conexoes", "Conexões realizadas", "text-success"], ["encontros", "Encontros organizados", "text-coral"]]],
  ["Direitos e fiscalização", [["solicitacoes", "Demandas registradas", "text-primary"], ["respondidas", "Demandas respondidas", "text-success"], ["pendentes", "Demandas pendentes", "text-emergency"], ["oficiais", "Encaminhadas oficialmente", "text-primary"], ["prazo_vencido", "Com prazo do órgão vencido", "text-emergency"], ["acompanhamentos", "Acompanhamentos das famílias", "text-primary"]]],
  ["Oportunidades", [["vagas", "Vagas de emprego anunciadas", "text-coral"], ["anuncios_ativos", "Anúncios ativos", "text-coral"], ["cupons_usados", "Cupons utilizados", "text-coral"], ["parceiros", "Parceiros", "text-warning"]]],
];

/** Indicadores agregados. Municípios com menos de 5 famílias têm os números ocultados para impedir identificação. */
export function Impacto() {
  const [de, setDe] = useState(""); const [ate, setAte] = useState("");
  const { data, loading } = useQuery<any>(async () => (await db.rpc("impacto_painel", { _de: de || null, _ate: ate || null })).data, [de, ate]);
  const muns: Mun[] = data?.municipios ?? [];
  function exportar() {
    const linhas: (string | number | null)[][] = [["Indicador", "Valor"], ...BLOCOS.flatMap(([, l]) => l.map(([k, n]) => [n, data?.[k] ?? 0])), [], ["Município", "Famílias", "Demandas", "Pendentes", "Na rede"],
      ...muns.map((m) => [m.municipio, m.familias ?? "< 5", m.demandas ?? "oculto", m.pendentes ?? "oculto", m.na_rede ?? "oculto"])];
    baixarArquivo(`impacto-amparo-${de || "inicio"}-${ate || "hoje"}.csv`, csv(linhas as any));
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm font-semibold">De<input type="date" className={cn(inputCls, "min-h-10")} value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label className="flex flex-col text-sm font-semibold">Até<input type="date" className={cn(inputCls, "min-h-10")} value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        <Btn v="outline" className="min-h-10" onClick={exportar} disabled={!data}><Download className="h-4 w-4" /> Exportar CSV</Btn>
      </div>
      {loading ? <Carregando /> : !data ? <Vazio icon={TrendingUp} titulo="Sem acesso aos indicadores" /> : (<>
        {BLOCOS.map(([t, itens]) => (
          <section key={t} className="flex flex-col gap-2"><h3 className="font-display text-lg font-bold">{t}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{itens.map(([k, n, c]) => <Card key={k} className="p-4"><p className={cn("font-display text-3xl font-extrabold", c)}>{data[k] ?? 0}</p><p className="text-xs font-semibold text-muted-foreground">{n}</p></Card>)}</div>
          </section>
        ))}
        {Object.keys(data.por_categoria ?? {}).length > 0 && <Card className="flex flex-col gap-2"><h3 className="font-display text-lg font-bold">Demandas por área</h3>
          {Object.entries(data.por_categoria as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([k, v]) => { const max = Math.max(...Object.values(data.por_categoria as Record<string, number>)); return (
            <div key={k} className="flex items-center gap-2 text-sm"><span className="w-40 shrink-0 truncate">{categoriaNome(k) ?? "Sem área"}</span><span className="h-3 rounded-full bg-primary" style={{ width: `${(v / max) * 60}%` }} /><b>{v}</b></div>
          ); })}</Card>}
        <Card className="flex flex-col gap-2 overflow-x-auto"><h3 className="font-display text-lg font-bold">Por município</h3>
          {!muns.length ? <p className="text-sm text-muted-foreground">Sem famílias aprovadas com cidade informada.</p> : (
            <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Município</th><th>Famílias</th><th>Demandas</th><th>Pendentes</th><th>Na rede</th></tr></thead>
              <tbody>{muns.map((m) => <tr key={m.municipio} className="border-t border-border"><td className="py-1.5 font-semibold">{m.municipio}</td><td>{m.familias ?? "< 5"}</td><td>{m.demandas ?? "—"}</td><td>{m.pendentes ?? "—"}</td><td>{m.na_rede ?? "—"}</td></tr>)}</tbody></table>
          )}
          <p className="text-xs text-muted-foreground">Para proteger as famílias, municípios com menos de 5 cadastros aparecem como “&lt; 5” e sem detalhes. Os relatórios não contêm nomes, contatos ou dados de saúde.</p>
        </Card>
      </>)}
    </div>
  );
}
