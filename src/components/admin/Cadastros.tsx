import { useState } from "react";
import { CheckCircle2, Download, Eye, MessageCircle, Search, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Carregando, Chip, Vazio, btn, inputCls, textareaCls } from "@/components/app/kit";
import { db, useQuery } from "@/lib/dados";
import { baixarArquivo, csv, digits, fData, fDataHora, fmtCEP, fmtTel, idade, waLink } from "@/lib/br";
import { cn } from "@/lib/utils";

const ST: Record<string, [string, string]> = { pendente: ["Aguardando", "amber"], aprovado: ["Confirmado", "green"], recusado: ["Recusado", "red"] };
const tel55 = (t?: string | null) => { const d = digits(t); return d.length <= 11 ? "55" + d : d; };

export function Cadastros() {
  const [status, setStatus] = useState("pendente");
  const [q, setQ] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const { data, loading, recarregar } = useQuery<any[]>(async () => {
    let r = db.from("familias").select("id,numero,status,mae_nome,mae_telefone,mae_email,cidade,uf,created_at,filhos(count)").order("created_at", { ascending: false }).limit(500);
    if (status) r = r.eq("status", status);
    return (await r).data ?? [];
  }, [status]);
  const termo = q.trim().toLowerCase();
  const lista = (data ?? []).filter((f) => !termo || `${f.numero} ${f.mae_nome} ${f.cidade} ${f.mae_email} ${f.mae_telefone}`.toLowerCase().includes(termo));

  function exportar() {
    baixarArquivo(`cadastros-${status || "todos"}.csv`, csv([["Número", "Status", "Responsável", "Telefone", "E-mail", "Cidade", "UF", "Filhos", "Cadastro em"],
      ...lista.map((f) => [f.numero, f.status, f.mae_nome, fmtTel(f.mae_telefone ?? ""), f.mae_email, f.cidade, f.uf, f.filhos?.[0]?.count ?? 0, fData(f.created_at)])]));
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {[["pendente", "Aguardando"], ["aprovado", "Confirmados"], ["recusado", "Recusados"], ["", "Todos"]].map(([k, l]) => (
          <button key={k || "t"} onClick={() => setStatus(k)} className={cn("tap rounded-full border px-4 text-sm font-semibold", status === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{l}</button>
        ))}
        <span className="flex-1" />
        <Btn v="outline" onClick={exportar}><Download className="h-4 w-4" /> CSV</Btn>
      </div>
      <label className="relative"><span className="sr-only">Buscar cadastro</span><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input className={cn(inputCls, "pl-12")} placeholder="Buscar por nome, número, cidade, telefone" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {loading ? <Carregando /> : !lista.length ? <Vazio icon={CheckCircle2} titulo="Nenhum cadastro aqui" /> : (
        <div className="flex flex-col gap-2">
          {lista.map((f) => (
            <Card key={f.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><b className="text-navy">{f.mae_nome}</b><Chip tom={ST[f.status][1]}>{ST[f.status][0]}</Chip><span className="text-xs text-muted-foreground">{f.numero}</span></div>
                <p className="text-sm text-muted-foreground">{[f.cidade && `${f.cidade}/${f.uf}`, `${f.filhos?.[0]?.count ?? 0} filho(s)`, fData(f.created_at)].filter(Boolean).join(" · ")}</p>
              </div>
              {f.mae_telefone && <a href={waLink(tel55(f.mae_telefone), `Olá, ${f.mae_nome.split(" ")[0]}! Aqui é a equipe do Centro de Acolhimento à Família Atípica.`)} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.wa, "min-h-10")} aria-label="WhatsApp"><MessageCircle className="h-4 w-4" /></a>}
              <Btn v="soft" className="min-h-10" onClick={() => setAberta(f.id)}><Eye className="h-4 w-4" /> Ver ficha</Btn>
            </Card>
          ))}
        </div>
      )}
      {aberta && <Ficha id={aberta} onFechar={() => setAberta(null)} onMudou={() => { setAberta(null); recarregar(); }} />}
    </div>
  );
}

function Linha({ l, v }: { l: string; v: any }) {
  if (v == null || v === "") return null;
  return <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm"><dt className="text-muted-foreground">{l}</dt><dd className="font-medium">{String(v)}</dd></div>;
}

function Ficha({ id, onFechar, onMudou }: { id: string; onFechar: () => void; onMudou: () => void }) {
  const { data: f, loading, erro } = useQuery<any>(async () => { const { data, error } = await db.rpc("abrir_ficha", { _fid: id }); if (error) throw error; return data; }, [id]);
  const [motivo, setMotivo] = useState("");
  const [recusando, setRecusando] = useState(false);

  async function mudar(status: string) {
    if (status === "recusado" && motivo.trim().length < 5) return toast.error("Explique o motivo para a família.");
    const { error } = await db.from("familias").update({ status, motivo_recusa: status === "recusado" ? motivo.trim() : null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "aprovado" ? "Cadastro confirmado. A família foi avisada." : "Status atualizado.");
    onMudou();
  }
  const cpf = (titular: string, filhoId?: string) => f?.cpfs?.find((c: any) => (filhoId ? c.filho_id === filhoId : c.titular === titular && !c.filho_id))?.cpf;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onFechar} role="dialog" aria-modal="true" aria-label="Ficha da família">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Ficha {f?.numero}</h2><button onClick={onFechar} className="tap grid place-items-center rounded-full bg-muted" aria-label="Fechar"><X /></button></div>
        {loading ? <Carregando /> : erro ? <p className="text-emergency">{erro}</p> : (
          <div className="flex flex-col gap-4">
            <Chip tom={ST[f.status][1]} className="w-fit">{ST[f.status][0]}{f.aprovado_em ? ` em ${fDataHora(f.aprovado_em)}` : ""}</Chip>
            {f.status === "recusado" && f.motivo_recusa && <p className="text-sm"><b>Motivo:</b> {f.motivo_recusa}</p>}
            <Card className="p-4"><h3 className="mb-2 font-bold">Mãe / responsável</h3><dl className="flex flex-col gap-1">
              <Linha l="Nome" v={f.mae_nome} /><Linha l="CPF" v={cpf("mae")} /><Linha l="Nascimento" v={f.mae_nascimento && `${fData(f.mae_nascimento)} (${idade(f.mae_nascimento)})`} />
              <Linha l="Celular" v={fmtTel(f.mae_telefone ?? "")} /><Linha l="E-mail" v={f.mae_email} /><Linha l="Estado civil" v={f.estado_civil} /><Linha l="Profissão" v={f.profissao} />
              <Linha l="Endereço" v={[f.endereco, f.bairro, f.cidade && `${f.cidade}/${f.uf}`, f.cep && fmtCEP(f.cep)].filter(Boolean).join(", ")} />
              <Linha l="Quem preencheu" v={f.quem_preenche} /><Linha l="Emergência" v={f.emergencia_nome && `${f.emergencia_nome} · ${fmtTel(f.emergencia_telefone ?? "")}`} />
            </dl></Card>
            {f.segundo_nome && <Card className="p-4"><h3 className="mb-2 font-bold">Segundo responsável</h3><dl className="flex flex-col gap-1">
              <Linha l="Nome" v={f.segundo_nome} /><Linha l="Parentesco" v={f.segundo_parentesco} /><Linha l="CPF" v={cpf("segundo")} /><Linha l="Celular" v={fmtTel(f.segundo_telefone ?? "")} /><Linha l="E-mail" v={f.segundo_email} /><Linha l="Profissão" v={f.segundo_profissao} />
            </dl></Card>}
            {(f.filhos ?? []).map((k: any) => (
              <Card key={k.id} className="p-4"><h3 className="mb-2 font-bold">👶 {k.nome}</h3><dl className="flex flex-col gap-1">
                <Linha l="Nascimento" v={k.nascimento && `${fData(k.nascimento)} (${idade(k.nascimento)})`} /><Linha l="Sexo" v={k.sexo} /><Linha l="CPF" v={cpf("filho", k.id)} />
                {k.saude ? (<>
                  <Linha l="Diagnósticos" v={[...(k.saude.diagnosticos ?? []), k.saude.diagnostico_outro].filter(Boolean).join(", ")} />
                  <Linha l="Profissional" v={k.saude.profissional} /><Linha l="Terapias" v={k.saude.terapias} /><Linha l="Medicação" v={k.saude.usa_medicacao == null ? null : k.saude.usa_medicacao ? "Sim" : "Não"} />
                  <Linha l="Escola" v={k.saude.frequenta_escola ? k.saude.escola || "Sim" : k.saude.frequenta_escola === false ? "Não" : null} /><Linha l="Necessidades" v={k.saude.necessidades} />
                  <Linha l="BPC" v={k.saude.possui_bpc ? "Recebe" : k.saude.aguardando_bpc ? "Aguardando" : null} /><Linha l="Observações" v={k.saude.observacoes} />
                </>) : !f.ve_dados_sensiveis ? <p className="text-xs text-muted-foreground">Dados de saúde visíveis só para a administração.</p> : <p className="text-xs text-muted-foreground">Sem dados de saúde (sem consentimento ou não informados).</p>}
              </dl></Card>
            ))}
            {!f.ve_dados_sensiveis && <p className="text-xs text-muted-foreground">CPFs mascarados para a equipe. A abertura desta ficha foi registrada no log.</p>}
            <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-background pt-3">
              {recusando ? (
                <>
                  <textarea className={textareaCls} placeholder="Motivo (a família recebe esta mensagem)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <div className="flex gap-2"><Btn v="danger" onClick={() => mudar("recusado")}>Confirmar recusa</Btn><Btn v="ghost" onClick={() => setRecusando(false)}>Cancelar</Btn></div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {f.status !== "aprovado" && <Btn v="wa" onClick={() => mudar("aprovado")}><CheckCircle2 className="h-4 w-4" /> Confirmar cadastro</Btn>}
                  {f.status !== "recusado" && <Btn v="outline" onClick={() => setRecusando(true)}><XCircle className="h-4 w-4" /> Recusar</Btn>}
                  {f.status !== "pendente" && <Btn v="ghost" onClick={() => mudar("pendente")}>Voltar para análise</Btn>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
