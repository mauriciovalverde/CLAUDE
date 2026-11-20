import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ClipboardList, Copy, FileText, GraduationCap, Landmark, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/dados";
import { CANAIS_ESCOLA, type Campos, MODELOS } from "@/lib/solicitacoes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/escola-inclusiva")({
  head: () => ({ meta: [{ title: "Escola Inclusiva · AMPARO" }] }),
  component: () => <AppShell><Escola /></AppShell>,
});

const FLUXO = ["Escolher a demanda", "Preencher", "Gerar o documento", "Protocolar na escola", "Guardar o comprovante", "Acompanhar a resposta"];

function imprimir(titulo: string, texto: string) {
  const w = window.open("", "_blank", "noopener=no");
  if (!w) return toast.error("Permita janelas pop-up para imprimir.");
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>@page{size:A4;margin:22mm}body{font:12pt/1.55 Georgia,serif;color:#111;white-space:pre-wrap}h1{font:bold 14pt Arial,sans-serif;text-align:center;margin:0 0 18pt}</style></head><body><h1>${esc(titulo.toUpperCase())}</h1>${esc(texto)}</body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

function Escola() {
  const { user, familia, perfil } = useAuth();
  const nav = useNavigate();
  const [k, setK] = useState<string | null>(null);
  const [c, setC] = useState<Campos>({});
  const [texto, setTexto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const m = MODELOS.find((x) => x.k === k);

  function escolher(id: string) {
    setK(id); setTexto(null);
    setC({ responsavel: familia?.mae_nome ?? perfil?.nome_chamada ?? "", cidade: familia?.cidade ?? "", parentesco: "mãe", contato: perfil?.telefone ?? "" });
  }
  function gerar() {
    const falta = m!.campos.filter(([id, , ob]) => ob && !(c[id] ?? "").trim());
    if (falta.length) return toast.error(`Preencha: ${falta.map((f) => f[1]).join(", ")}`);
    setTexto(m!.texto(c));
  }
  async function salvar() {
    setSalvando(true);
    const { data, error } = await db.from("sol_solicitacoes").insert({ user_id: user!.id, area: "educacao", tipo: m!.tipo, titulo: `${m!.nome} – ${c.aluno || "estudante"}`, orgao: c.escola || null, status: "aguardando_protocolo", documento: texto, modelo: m!.k }).select("id").single();
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo em Minhas Solicitações. Quando protocolar, registre o número e anexe o comprovante.");
    nav({ to: "/solicitacoes", search: { s: data.id } as any });
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#082F70,#0868D0)] px-4 pb-5 pt-4 text-white sm:px-6">
        <span aria-hidden="true" className="faixa-marca absolute inset-x-0 bottom-0 h-1.5" />
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">Direito à educação</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">Escola Inclusiva</h1>
          <p className="mt-0.5 hidden text-sm text-white/85 sm:block">Modelos editáveis para pedir apoio, AEE e adaptações, e para denunciar recusa de matrícula.</p></div>
        <GraduationCap className="h-10 w-10 shrink-0 text-white/80" />
      </header>

      <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 text-xs font-semibold" aria-label="Passo a passo">
        {FLUXO.map((p, i) => { const at = !m ? 0 : !texto ? 1 : 2; return (
          <li key={p} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5", i <= at ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground")}><b>{i + 1}</b> {p}</li>
        ); })}
      </ol>

      {!m ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">{MODELOS.map((x) => (
            <button key={x.k} onClick={() => escolher(x.k)} className="card-soft flex items-start gap-3 p-4 text-left hover:border-primary">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><FileText className="h-5 w-5" /></span>
              <span><b className="font-display text-navy">{x.nome}</b><span className="block text-sm text-muted-foreground">{x.desc}</span></span>
            </button>
          ))}</div>
          <Aviso tom="amber">Nem toda condição gera automaticamente direito a profissional de apoio ou mediador: a necessidade é avaliada individualmente, com base nos relatórios e na rotina escolar. Os modelos são um ponto de partida e não substituem orientação jurídica — procure a Defensoria Pública se precisar.</Aviso>
          <Card className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Landmark className="h-5 w-5 text-primary" /> A quem recorrer, nesta ordem</h2>
            <ol className="flex flex-col gap-2 text-sm">{CANAIS_ESCOLA.map(([t, d], i) => <li key={t} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span><span><b>{t}.</b> {d}</span></li>)}</ol>
          </Card>
          <Link to="/solicitacoes" className="card-soft flex items-center gap-3 p-4 hover:border-primary"><ClipboardList className="h-6 w-6 text-primary" /><span className="flex-1"><b className="block text-navy">Minhas Solicitações</b><span className="text-sm text-muted-foreground">Acompanhe pedidos, reuniões com a escola, prazos e respostas</span></span></Link>
        </>
      ) : !texto ? (
        <Card className="flex flex-col gap-3">
          <button onClick={() => setK(null)} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Modelos</button>
          <h2 className="font-display text-xl font-bold">{m.nome}</h2>
          {m.campos.map(([id, label, ob]) => (
            <Campo key={id} id={"es-" + id} label={label} obrigatorio={!!ob}>
              {["necessidades", "relato", "adaptacoes", "documentos"].includes(id)
                ? <textarea id={"es-" + id} className={textareaCls} value={c[id] ?? ""} onChange={(e) => setC({ ...c, [id]: e.target.value })} />
                : <input id={"es-" + id} className={inputCls} type={id === "data" ? "date" : "text"} value={c[id] ?? ""} onChange={(e) => setC({ ...c, [id]: e.target.value })} />}
            </Campo>
          ))}
          <p className="text-xs text-muted-foreground">Não inclua no documento informações de saúde além do necessário. Laudos vão anexados, não no texto.</p>
          <Btn className="self-start" onClick={gerar}><FileText className="h-4 w-4" /> Gerar documento</Btn>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <button onClick={() => setTexto(null)} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Voltar ao formulário</button>
          <Card className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-bold">Revise e ajuste o texto</h2>
            <textarea aria-label="Documento" className={cn(textareaCls, "min-h-[28rem] font-serif text-[15px] leading-relaxed")} value={texto} onChange={(e) => setTexto(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Btn onClick={salvar} disabled={salvando}><Save className="h-4 w-4" /> {salvando ? "Salvando…" : "Salvar e acompanhar"}</Btn>
              <Btn v="outline" onClick={() => imprimir(m.nome, texto)}><Printer className="h-4 w-4" /> Imprimir ou PDF</Btn>
              <Btn v="ghost" onClick={() => navigator.clipboard?.writeText(texto).then(() => toast.success("Texto copiado."))}><Copy className="h-4 w-4" /> Copiar</Btn>
            </div>
          </Card>
          <Card className="flex flex-col gap-2">
            <h3 className="font-display text-lg font-bold">Como protocolar</h3>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">{m.orientacao.map((o) => <li key={o}>{o}</li>)}</ul>
          </Card>
        </div>
      )}
    </div>
  );
}
