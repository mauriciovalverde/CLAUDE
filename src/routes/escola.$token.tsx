import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, School } from "lucide-react";
import { toast } from "sonner";
import { Btn, Campo, Card, Carregando, Logo, Opcoes, Vazio, inputCls, textareaCls } from "@/components/app/kit";
import { db } from "@/lib/dados";
import { ESTRATEGIAS, GATILHOS } from "@/lib/diario";
import { fData } from "@/lib/br";

export const Route = createFileRoute("/escola/$token")({ component: Escola });

const TIPOS = [["escola", "📒 Resumo do dia"], ["crise", "🌩️ Crise"], ["comportamento", "🧩 Comportamento"], ["alimentacao", "🍎 Alimentação"], ["conquista", "⭐ Conquista"]];

function Escola() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<{ primeiro_nome: string; rotulo: string; expira_em: string } | null | undefined>(undefined);
  const [f, setF] = useState({ tipo: "escola", nota: "", intensidade: 3, gat: [] as string[], comp: "", aj: [] as string[], autor: "" });
  const [ok, setOk] = useState(false);
  useEffect(() => { db.rpc("link_escola_info", { _token: token }).then(({ data }: any) => setInfo(data?.[0] ?? null)); }, [token]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nota.trim() && !f.comp.trim()) return toast.error("Escreva como foi.");
    const abc = f.tipo === "crise" || f.tipo === "comportamento";
    const { data, error } = await db.rpc("link_escola_registrar", {
      _token: token, _tipo: f.tipo, _nota: f.nota || null, _intensidade: abc ? f.intensidade : null,
      _antecedente: abc ? f.gat.join(", ") || null : null, _comportamento: abc ? f.comp || null : null,
      _consequencia: abc ? f.aj.join(", ") || null : null, _autor_nome: f.autor || info?.rotulo || "Escola",
    });
    if (error || !data) return toast.error("Não foi possível enviar. O link pode ter expirado.");
    setOk(true);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 px-4 py-6">
      <Logo />
      {info === undefined ? <Carregando /> : info === null ? (
        <Vazio icon={School} titulo="Link inválido ou expirado" texto="Peça para a família gerar um novo link no aplicativo." />
      ) : ok ? (
        <Card className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <h1 className="font-display text-2xl font-bold">Obrigado!</h1>
          <p>O registro foi enviado para a família de {info.primeiro_nome}.</p>
          <Btn onClick={() => { setOk(false); setF({ ...f, nota: "", comp: "", gat: [], aj: [] }); }}>Fazer outro registro</Btn>
        </Card>
      ) : (
        <form onSubmit={enviar} className="card-soft flex flex-col gap-4 p-5">
          <div>
            <h1 className="font-display text-2xl font-extrabold">Diário escolar de <span className="text-primary">{info.primeiro_nome}</span></h1>
            <p className="text-sm text-muted-foreground">{info.rotulo} · link válido até {fData(info.expira_em)}. Você não vê os registros da família; apenas envia o seu.</p>
          </div>
          <Campo id="e-tipo" label="O que deseja registrar" obrigatorio>
            <div className="flex flex-wrap gap-2">{TIPOS.map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, tipo: k })} className={`tap rounded-full border px-4 text-sm font-semibold ${f.tipo === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}>{l}</button>)}</div>
          </Campo>
          {(f.tipo === "crise" || f.tipo === "comportamento") && (
            <>
              <label className="text-sm font-semibold">Intensidade: {f.intensidade}/5
                <input type="range" min={1} max={5} value={f.intensidade} onChange={(e) => setF({ ...f, intensidade: Number(e.target.value) })} className="w-full accent-[var(--color-primary)]" />
              </label>
              <Campo id="e-gat" label="O que aconteceu antes"><Opcoes multi nome="Gatilhos" valores={GATILHOS} valor={f.gat} onChange={(v) => setF({ ...f, gat: v })} /></Campo>
              <Campo id="e-comp" label="O que a criança fez"><textarea id="e-comp" className={textareaCls} value={f.comp} onChange={(e) => setF({ ...f, comp: e.target.value })} /></Campo>
              <Campo id="e-aj" label="O que ajudou"><Opcoes multi nome="Estratégias" valores={ESTRATEGIAS} valor={f.aj} onChange={(v) => setF({ ...f, aj: v })} /></Campo>
            </>
          )}
          <Campo id="e-nota" label="Como foi" obrigatorio={f.tipo === "escola"}><textarea id="e-nota" className={textareaCls} maxLength={2000} value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="Ex.: participou da roda, lanchou bem, ficou agitado no recreio" /></Campo>
          <Campo id="e-autor" label="Seu nome"><input id="e-autor" className={inputCls} value={f.autor} onChange={(e) => setF({ ...f, autor: e.target.value })} placeholder="Profª Ana" /></Campo>
          <Btn type="submit">Enviar para a família</Btn>
          <p className="text-xs text-muted-foreground">Não inclua dados de outras crianças. As informações são protegidas conforme a LGPD.</p>
        </form>
      )}
    </div>
  );
}
