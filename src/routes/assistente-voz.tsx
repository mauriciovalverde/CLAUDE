import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Mic, Smartphone, Speaker, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, Carregando, Chip, PageHeader, inputCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { fDataHora } from "@/lib/br";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assistente-voz")({
  head: () => ({ meta: [{ title: "Assistente de voz · AMPARO" }] }),
  component: () => <AppShell><Voz /></AppShell>,
});

const URL_API = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/voz_registrar`;
const CHAVE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
type Vinculo = { id: string; apelido: string; tipo: string; ativo: boolean; usado_em: string | null; usos: number; codigo_expira: string | null; token_hash: string | null; created_at: string };
const copiar = (t: string, msg = "Copiado.") => navigator.clipboard?.writeText(t).then(() => toast.success(msg));

function Voz() {
  const { familia } = useAuth();
  const { data, loading, recarregar } = useQuery<Vinculo[]>(async () => (await db.from("voz_vinculos").select("id,apelido,tipo,ativo,usado_em,usos,codigo_expira,token_hash,created_at").order("created_at", { ascending: false })).data ?? [], []);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [apelido, setApelido] = useState({ alexa: "Alexa da sala", siri: "Meu iPhone" });

  async function criar(tipo: "alexa" | "siri") {
    const { data: r, error } = await db.rpc("voz_criar", { _apelido: apelido[tipo], _tipo: tipo });
    if (error) return toast.error(error.message);
    if (tipo === "alexa") { setCodigo(r.codigo); setToken(null); } else { setToken(r.token); setCodigo(null); }
    recarregar();
  }
  async function remover(v: Vinculo) { if (!confirm(`Desligar "${v.apelido}"? Ele deixa de registrar no diário.`)) return; await db.from("voz_vinculos").delete().eq("id", v.id); toast.success("Desligado."); recarregar(); }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Assistente" highlight="de voz" subtitle="Registre no diário só falando: “registre que Marcio tomou risperidona agora” ou “Ana teve uma crise forte por causa do barulho”." />
      {familia?.status !== "aprovado" && <Aviso tom="amber">O assistente de voz fica disponível depois que o cadastro da família for aprovado.</Aviso>}

      <Card className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Mic className="h-5 w-5 text-primary" /> No próprio app (qualquer celular)</h2>
        <p className="text-sm">No <Link to="/diario" className="font-semibold text-primary">Diário</Link>, toque no microfone azul e fale. Funciona no Android e no iPhone, sem instalar nada.</p>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Speaker className="h-5 w-5 text-primary" /> Alexa</h2>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          <li>No app Alexa, ative a skill <b>Diário AMPARO</b>.</li>
          <li>Gere um código abaixo (vale por 10 minutos).</li>
          <li>Diga: <b>“Alexa, abra Diário AMPARO”</b> e depois <b>“o código é …”</b> com os 6 números.</li>
          <li>Pronto. Para registrar: <b>“Alexa, peça ao Diário AMPARO para registrar que Marcio tomou risperidona agora”</b>, ou abra a skill e diga <b>“registre que Ana teve uma crise leve”</b>.</li>
        </ol>
        <div className="flex flex-wrap items-end gap-2">
          <Campo id="vz-a" label="Nome desta Alexa"><input id="vz-a" className={cn(inputCls, "max-w-60")} value={apelido.alexa} onChange={(e) => setApelido({ ...apelido, alexa: e.target.value })} /></Campo>
          <Btn onClick={() => criar("alexa")}>Gerar código</Btn>
        </div>
        {codigo && <div className="flex flex-col items-center gap-1 rounded-2xl bg-primary-soft p-4 text-center">
          <span className="text-sm font-semibold text-primary">Diga para a Alexa: “o código é”</span>
          <b className="font-mono text-4xl tracking-[0.35em] text-navy">{codigo}</b>
          <span className="text-xs text-muted-foreground">Vale por 10 minutos e só funciona uma vez.</span>
        </div>}
        <p className="text-xs text-muted-foreground">A Alexa sempre pede o nome da skill (“Diário AMPARO”): é uma regra da Amazon para skills que não são dela.</p>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Smartphone className="h-5 w-5 text-primary" /> Siri (iPhone)</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Campo id="vz-s" label="Nome deste aparelho"><input id="vz-s" className={cn(inputCls, "max-w-60")} value={apelido.siri} onChange={(e) => setApelido({ ...apelido, siri: e.target.value })} /></Campo>
          <Btn onClick={() => criar("siri")}>Gerar chave da Siri</Btn>
        </div>
        {token && <div className="flex flex-col gap-2 rounded-2xl bg-warning-soft p-4 text-sm">
          <b className="text-navy">Sua chave (aparece só agora; guarde no atalho):</b>
          <code className="break-all rounded-lg bg-card p-2 font-mono text-xs">{token}</code>
          <Btn v="outline" className="min-h-10 self-start" onClick={() => copiar(token, "Chave copiada.")}><Copy className="h-4 w-4" /> Copiar chave</Btn>
        </div>}
        <details className="rounded-2xl bg-muted p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-navy">Como montar o atalho “Registrar no AMPARO” (5 minutos)</summary>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
            <li>Abra o app <b>Atalhos</b> → <b>+</b> → dê o nome <b>Registrar no AMPARO</b>.</li>
            <li>Adicione a ação <b>Ditar Texto</b> (idioma Português, Brasil).</li>
            <li>Adicione <b>Obter Conteúdo do URL</b> com o endereço abaixo, método <b>POST</b>.</li>
            <li>Em <b>Cabeçalhos</b>: <code>apikey</code> = chave pública abaixo; <code>Content-Type</code> = <code>application/json</code>.</li>
            <li>Em <b>Corpo da Solicitação</b> → JSON: <code>_token</code> = sua chave; <code>_frase</code> = variável <i>Texto Ditado</i>.</li>
            <li>Adicione <b>Falar Texto</b> com o <i>Conteúdo do URL</i>, para a Siri confirmar o que registrou.</li>
            <li>Use: <b>“E aí Siri, Registrar no AMPARO”</b> e fale o que aconteceu.</li>
          </ol>
          <div className="mt-3 flex flex-col gap-2">
            <button onClick={() => copiar(URL_API, "Endereço copiado.")} className="flex items-center gap-2 text-left"><Copy className="h-4 w-4 shrink-0" /><code className="break-all text-xs">{URL_API}</code></button>
            <button onClick={() => copiar(CHAVE, "Chave pública copiada.")} className="flex items-center gap-2 text-left"><Copy className="h-4 w-4 shrink-0" /><code className="break-all text-xs">apikey: {CHAVE}</code></button>
          </div>
        </details>
        <p className="text-xs text-muted-foreground">No Android, o Google Assistente não permite esse tipo de atalho para apps de terceiros. Use o microfone do app.</p>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">Assistentes ligados</h2>
        {loading ? <Carregando /> : !(data ?? []).length ? <p className="text-sm text-muted-foreground">Nenhum ainda.</p> : data!.map((v) => {
          const aguardando = v.tipo === "alexa" && !v.token_hash;
          return (
            <div key={v.id} className="flex items-center gap-3 rounded-2xl bg-muted p-3">
              {v.tipo === "alexa" ? <Speaker className="h-5 w-5 text-primary" /> : <Smartphone className="h-5 w-5 text-primary" />}
              <div className="min-w-0 flex-1"><b className="block text-navy">{v.apelido}</b>
                <span className="text-xs text-muted-foreground">{aguardando ? (v.codigo_expira && new Date(v.codigo_expira) > new Date() ? "Aguardando o código na Alexa" : "Código vencido") : `${v.usos} registro(s)${v.usado_em ? ` · último em ${fDataHora(v.usado_em)}` : ""}`}</span></div>
              {aguardando ? <Chip tom="amber">Pendente</Chip> : <Chip tom="green">Ligado</Chip>}
              <button onClick={() => remover(v)} aria-label={`Desligar ${v.apelido}`} className="tap grid min-w-10 place-items-center text-muted-foreground hover:text-emergency"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
      </Card>
      <p className="text-xs text-muted-foreground">O que você fala vira texto e é guardado no diário da família, como um registro digitado. A Amazon e a Apple processam a voz segundo as regras delas. Diga o nome da criança quando tiver mais de um filho cadastrado.</p>
    </div>
  );
}
