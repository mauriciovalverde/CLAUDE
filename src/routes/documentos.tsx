import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Card, PageHeader } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/dados";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documentos")({ component: () => <AppShell><Documentos /></AppShell> });

const DOCS: { id: string; titulo: string; para: string; itens: string[]; link?: [string, string] }[] = [
  { id: "laudo", titulo: "Laudo médico", para: "Base para quase todos os direitos.", itens: ["Nome completo da criança", "Diagnóstico com CID", "Data, carimbo e assinatura com CRM", "Descrição das limitações no dia a dia", "Terapias indicadas e frequência"] },
  { id: "ciptea", titulo: "CIPTEA – Carteira da Pessoa com TEA", para: "Atendimento prioritário (Lei 13.977/2020).", itens: ["Laudo com CID de TEA", "Documento com foto da criança", "CPF", "Comprovante de residência", "Foto 3x4", "Documento do responsável"], link: ["Lei Romeo Mion (13.977/2020)", "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l13977.htm"] },
  { id: "passe", titulo: "Passe livre interestadual", para: "Transporte gratuito para pessoa com deficiência de baixa renda.", itens: ["Formulário do Ministério dos Transportes", "Laudo da equipe de saúde", "Comprovante de renda / CadÚnico", "Documento com foto"], link: ["Passe Livre – gov.br", "https://www.gov.br/pt-br/servicos/obter-o-passe-livre-interestadual"] },
  { id: "escola", titulo: "Matrícula com apoio na escola", para: "Direito a acompanhante especializado quando necessário (Lei 12.764/2012).", itens: ["Laudo atualizado", "Relatório das terapias", "Pedido por escrito de mediador/AEE", "Protocolo do pedido guardado"], link: ["Lei 12.764/2012", "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12764.htm"] },
  { id: "plano", titulo: "Plano de saúde – terapias", para: "Cobertura de terapias sem limite de sessões (ANS).", itens: ["Pedido médico das terapias", "Protocolo de solicitação ao plano", "Negativa por escrito (se houver)", "Reclamação na ANS (0800 701 9656)"], link: ["ANS – reclamações", "https://www.gov.br/ans/pt-br"] },
];

function Documentos() {
  const { user } = useAuth();
  const [m, setM] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!user) return;
    db.from("checklists").select("lista,item,marcado").eq("user_id", user.id).like("lista", "doc:%").then(({ data }: any) => {
      setM(Object.fromEntries((data ?? []).map((r: any) => [r.lista + "|" + r.item, r.marcado])));
    });
  }, [user]);
  async function marcar(doc: string, item: string, v: boolean) {
    setM((x) => ({ ...x, [`doc:${doc}|${item}`]: v }));
    await db.from("checklists").upsert({ user_id: user!.id, lista: "doc:" + doc, item, marcado: v, updated_at: new Date().toISOString() }, { onConflict: "user_id,lista,item" });
  }
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Documentos" highlight="importantes" subtitle="Checklists para organizar a papelada. Marque o que você já tem — fica salvo na sua conta." />
      {DOCS.map((d) => {
        const feitos = d.itens.filter((i) => m[`doc:${d.id}|${i}`]).length;
        return (
          <Card key={d.id} className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <FileText className="mt-1 h-6 w-6 shrink-0 text-primary" />
              <div className="flex-1"><h2 className="font-display text-lg font-bold">{d.titulo}</h2><p className="text-sm text-muted-foreground">{d.para}</p></div>
              <span className="text-sm font-bold text-primary">{feitos}/{d.itens.length}</span>
            </div>
            <ul>
              {d.itens.map((i) => {
                const on = !!m[`doc:${d.id}|${i}`];
                return <li key={i}><label className="tap flex items-center gap-3 rounded-xl px-2 hover:bg-muted"><input type="checkbox" className="h-5 w-5 accent-[var(--color-success)]" checked={on} onChange={(e) => marcar(d.id, i, e.target.checked)} /><span className={cn(on && "text-muted-foreground line-through")}>{i}</span></label></li>;
              })}
            </ul>
            {d.link && <a href={d.link[1]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline">{d.link[0]} <ExternalLink className="h-3.5 w-3.5" /></a>}
          </Card>
        );
      })}
      <Aviso>Guarde cópias digitais e o número de todos os protocolos. Os requisitos podem variar por município; confirme no órgão responsável.</Aviso>
    </div>
  );
}
