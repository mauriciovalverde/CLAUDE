import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Clock, Copy, HeartHandshake, MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, Carregando, Chip, Vazio, btn, inputCls } from "@/components/app/kit";
import { AcionarAnjo } from "@/components/app/AnjoAcionar";
import { useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { digits, fmtTel, urlApp, waLink } from "@/lib/br";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/anjo")({
  head: () => ({ meta: [{ title: "Número Anjo · AMPARO" }] }),
  component: () => <AppShell><Anjo /></AppShell>,
});

type Contato = { id: string; nome: string; telefone: string; vinculo: string | null; prioridade: number; token: string; confirmado_em: string | null };
const VINCULOS = ["Mãe", "Pai", "Irmã(o)", "Avó/Avô", "Companheira(o)", "Amiga(o)", "Vizinha(o)", "Madrinha/Padrinho", "Outro"];
const tel55 = (t: string) => (digits(t).length <= 11 ? "55" + digits(t) : digits(t));

function Anjo() {
  const { user, perfil } = useAuth();
  const { data, loading, recarregar } = useQuery<Contato[]>(async () => (await db.from("anjo_contatos").select("*").order("prioridade").order("created_at")).data ?? [], []);
  const [f, setF] = useState({ nome: "", telefone: "", vinculo: "", prioridade: 1 });
  const [abrir, setAbrir] = useState(false);
  const meuNome = (perfil?.nome_chamada || "").split(" ")[0] || "Eu";
  const convite = (c: Contato) => `Oi, ${c.nome.split(" ")[0]}! Aqui é ${meuNome}. Uso o app AMPARO (apoio a famílias atípicas) e quero cadastrar você como meu Número Anjo: alguém que eu aviso quando precisar de apoio em um momento de crise. Você aceita? Confirme aqui: ${urlApp("/confirmar-anjo/" + c.token)}`;

  async function salvar() {
    if (f.nome.trim().length < 2) return toast.error("Informe o nome.");
    if (![10, 11].includes(digits(f.telefone).length)) return toast.error("Telefone com DDD, 10 ou 11 números.");
    const { error } = await db.from("anjo_contatos").insert({ user_id: user!.id, nome: f.nome.trim(), telefone: digits(f.telefone), vinculo: f.vinculo || null, prioridade: f.prioridade });
    if (error) return toast.error(error.message);
    toast.success("Contato salvo. Agora envie o convite para a pessoa confirmar."); setF({ nome: "", telefone: "", vinculo: "", prioridade: (data?.length ?? 0) + 2 }); setAbrir(false); recarregar();
  }
  async function remover(c: Contato) { if (!confirm(`Remover ${c.nome}?`)) return; await db.from("anjo_contatos").delete().eq("id", c.id); recarregar(); }

  return (
    <div className="flex flex-col gap-4">
      <header className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#B3121C,#E92E35_60%,#F47A16)] px-4 pb-5 pt-4 text-white sm:px-6">
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">Rede de proteção</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">Número Anjo</h1>
          <p className="mt-0.5 text-sm text-white/90">Pessoas de confiança que você avisa num momento de crise.</p></div>
        <HeartHandshake className="h-10 w-10 shrink-0 text-white/85" />
      </header>

      <AcionarAnjo contatos={data ?? []} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Meus Números Anjo</h2>{(data?.length ?? 0) < 5 && !abrir && <Btn v="soft" className="min-h-10" onClick={() => setAbrir(true)}><Plus className="h-4 w-4" /> Adicionar</Btn>}</div>
        {abrir && <Card className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo id="an-n" label="Nome" obrigatorio><input id="an-n" className={inputCls} maxLength={80} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
            <Campo id="an-t" label="Telefone (WhatsApp)" obrigatorio><input id="an-t" inputMode="tel" className={inputCls} placeholder="(73) 99999-9999" value={f.telefone} onChange={(e) => setF({ ...f, telefone: fmtTel(e.target.value) })} /></Campo>
            <Campo id="an-v" label="Vínculo"><select id="an-v" className={inputCls} value={f.vinculo} onChange={(e) => setF({ ...f, vinculo: e.target.value })}><option value="">Escolha</option>{VINCULOS.map((v) => <option key={v}>{v}</option>)}</select></Campo>
            <Campo id="an-p" label="Prioridade de acionamento" dica="1 = avisar primeiro"><input id="an-p" type="number" min={1} max={9} className={inputCls} value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: Number(e.target.value) || 1 })} /></Campo>
          </div>
          <p className="text-xs text-muted-foreground">A pessoa só passa a receber alertas depois de confirmar pelo link que você vai enviar.</p>
          <div className="flex gap-2"><Btn onClick={salvar}>Salvar contato</Btn><Btn v="ghost" onClick={() => setAbrir(false)}>Cancelar</Btn></div>
        </Card>}
        {loading ? <Carregando /> : !data?.length ? (
          <Vazio icon={HeartHandshake} titulo="Nenhum Número Anjo ainda" texto="Cadastre até 5 pessoas de confiança. Cada uma confirma por um link antes de receber alertas.">{!abrir && <Btn onClick={() => setAbrir(true)}><Plus className="h-4 w-4" /> Adicionar contato</Btn>}</Vazio>
        ) : data.map((c) => (
          <Card key={c.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emergency-soft font-display font-extrabold text-emergency">{c.prioridade}</span>
              <div className="min-w-0 flex-1"><b className="block text-navy">{c.nome}</b><span className="text-sm text-muted-foreground">{fmtTel(c.telefone)}{c.vinculo ? ` · ${c.vinculo}` : ""}</span></div>
              {c.confirmado_em ? <Chip tom="green"><CheckCircle2 className="h-3.5 w-3.5" /> Confirmado</Chip> : <Chip tom="amber"><Clock className="h-3.5 w-3.5" /> Aguardando</Chip>}
            </div>
            {!c.confirmado_em && <div className="flex flex-wrap gap-2">
              <a href={waLink(tel55(c.telefone), convite(c))} target="_blank" rel="noopener noreferrer" className={cn(btn.base, btn.wa, "min-h-10")}><MessageCircle className="h-4 w-4" /> Enviar convite</a>
              <Btn v="ghost" className="min-h-10" onClick={() => navigator.clipboard?.writeText(convite(c)).then(() => toast.success("Convite copiado."))}><Copy className="h-4 w-4" /> Copiar convite</Btn>
            </div>}
            <button onClick={() => remover(c)} className="w-fit text-xs font-semibold text-muted-foreground underline">Remover</button>
          </Card>
        ))}
      </section>
      <Aviso tom="red">O Número Anjo não substitui serviços de urgência, emergência ou atendimento profissional. Em risco imediato ligue 192 (SAMU), 193 (Bombeiros) ou 190 (Polícia). Apoio emocional: CVV 188.</Aviso>
    </div>
  );
}

