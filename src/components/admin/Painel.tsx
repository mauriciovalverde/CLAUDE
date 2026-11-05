import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Baby, CheckCircle2, Clock, Download, Users } from "lucide-react";
import { Btn, Card, Carregando } from "@/components/app/kit";
import { db, useQuery } from "@/lib/dados";
import { baixarArquivo, csv } from "@/lib/br";
import { SECOES_PADRAO } from "@/lib/conteudo-padrao";

type Stats = { familias: number; criancas: number; pendentes: number; aprovadas: number; por_cidade: { nome: string; total: number }[]; por_condicao: { nome: string; total: number }[]; acessos: { nome: string; total: number }[] };

export function Painel() {
  const { data: s, loading } = useQuery<Stats | null>(async () => (await db.rpc("stats_painel")).data, []);
  if (loading || !s) return <Carregando />;
  const nomeSecao = (slug: string) => SECOES_PADRAO.find((x) => x.slug === slug)?.titulo ?? slug;
  const kpis: [string, number, any, string][] = [
    ["Famílias", s.familias, Users, "text-primary"], ["Crianças", s.criancas, Baby, "text-coral"],
    ["Aguardando", s.pendentes, Clock, "text-warning"], ["Confirmadas", s.aprovadas, CheckCircle2, "text-success"],
  ];
  function exportar() {
    baixarArquivo("indicadores.csv", csv([["Indicador", "Valor"], ...kpis.map(([l, v]) => [l, v]), [], ["Cidade", "Famílias"], ...s!.por_cidade.map((c) => [c.nome, c.total]), [], ["Condição", "Crianças"], ...s!.por_condicao.map((c) => [c.nome, c.total]), [], ["Conteúdo (30 dias)", "Acessos"], ...s!.acessos.map((c) => [nomeSecao(c.nome), c.total])]));
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(([l, v, I, c]) => (
          <Card key={l} className="flex flex-col gap-1 p-4"><I className={`h-5 w-5 ${c}`} /><span className="font-display text-3xl font-extrabold">{v}</span><span className="text-sm text-muted-foreground">{l}</span></Card>
        ))}
      </div>
      {s.pendentes > 0 && <Link to="/admin" search={{ aba: "cadastros" }} className="rounded-2xl bg-warning-soft p-4 text-sm font-semibold">⏳ {s.pendentes} cadastro(s) aguardando confirmação → revisar agora</Link>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Grafico titulo="Famílias por cidade" dados={s.por_cidade.slice(0, 10)} cor="#1F5BFF" />
        <Grafico titulo="Condições informadas" dados={s.por_condicao.slice(0, 10)} cor="#F76B15" />
        <Grafico titulo="Conteúdos mais acessados (30 dias)" dados={s.acessos.slice(0, 10).map((a) => ({ ...a, nome: nomeSecao(a.nome) }))} cor="#30A46C" />
      </div>
      <Btn v="outline" className="self-start" onClick={exportar}><Download className="h-4 w-4" /> Exportar indicadores (CSV)</Btn>
      <p className="text-xs text-muted-foreground">Indicadores agregados, sem identificação de pessoas. Condições só aparecem para famílias que consentiram com o uso de dados de saúde.</p>
    </div>
  );
}

function Grafico({ titulo, dados, cor }: { titulo: string; dados: { nome: string; total: number }[]; cor: string }) {
  return (
    <Card>
      <h3 className="mb-2 font-display font-bold">{titulo}</h3>
      {dados.length ? (
        <div style={{ height: Math.max(160, dados.length * 34) }}>
          <ResponsiveContainer>
            <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="nome" width={130} fontSize={12} />
              <Tooltip />
              <Bar dataKey="total" fill={cor} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
    </Card>
  );
}
