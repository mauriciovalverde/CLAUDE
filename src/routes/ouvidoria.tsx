import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ClipboardList, Copy, Crosshair, ListChecks, MapPin, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, Chip, PageHeader, btn, inputCls, textareaCls } from "@/components/app/kit";
import { MapaPonto } from "@/components/app/MapaPonto";
import { OuvAnexos, anexosParaEnvio } from "@/components/app/OuvAnexos";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/dados";
import { fDataHora } from "@/lib/br";
import { CATEGORIAS_OUV, type Anexo, STATUS_OUV, TIPOS_OUV, limparRascunho, lerRascunho, salvarRascunho } from "@/lib/ouvidoria";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ouvidoria")({
  validateSearch: (s: Record<string, unknown>) => ({ novo: s.novo === 1 || s.novo === "1" ? 1 : undefined }) as { novo?: 1 },
  component: () => <AppShell><Ouvidoria /></AppShell>,
});

function Ouvidoria() {
  const { novo } = Route.useSearch();
  const [form, setForm] = useState(!!novo);
  const [feito, setFeito] = useState<{ id: string; protocolo: string; created_at: string; status: string } | null>(null);
  if (feito) return <Confirmacao r={feito} />;
  if (form) return <Formulario onVoltar={() => setForm(false)} onFeito={setFeito} />;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Ouvidoria" highlight="do AMPARO" subtitle="Registre denúncias, reclamações, solicitações, sugestões e elogios. Você recebe um protocolo e acompanha a resposta pelo seu perfil." />
      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={() => setForm(true)} className="card-soft flex items-center gap-4 border-primary p-5 text-left transition hover:shadow-card">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-white"><Megaphone className="h-7 w-7" /></span>
          <span><b className="block font-display text-lg text-navy">Registrar manifestação</b><span className="text-sm text-muted-foreground">Com foto, documentos e o local da ocorrência</span></span>
        </button>
        <Link to="/minhas-manifestacoes" className="card-soft flex items-center gap-4 p-5 transition hover:border-primary">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><ListChecks className="h-7 w-7" /></span>
          <span><b className="block font-display text-lg text-navy">Acompanhar meus protocolos</b><span className="text-sm text-muted-foreground">Setor responsável e respostas da equipe</span></span>
        </Link>
      </div>
      <Aviso tom="navy">Sua manifestação é vista apenas pela equipe autorizada da Ouvidoria. Fotos, documentos e localização ficam em área protegida.</Aviso>
      <Aviso tom="red">Em situação de risco imediato ligue <a href="tel:190" className="font-bold underline">190</a> (Polícia), <a href="tel:192" className="font-bold underline">192</a> (SAMU) ou <a href="tel:100" className="font-bold underline">Disque 100</a> (direitos humanos). A Ouvidoria não é atendimento de emergência.</Aviso>
    </div>
  );
}

type Rascunho = { chave: string; tipo: string; categoria?: string; assunto: string; descricao: string; endereco: string; referencia: string };
type Local = { lat: number; lng: number; precisao: number | null; origem: "gps" | "mapa"; em: string };

function Formulario({ onVoltar, onFeito }: { onVoltar: () => void; onFeito: (r: any) => void }) {
  const { user } = useAuth();
  const inicial = useMemo<Rascunho>(() => lerRascunho<Rascunho>() ?? { chave: crypto.randomUUID(), tipo: "", assunto: "", descricao: "", endereco: "", referencia: "" }, []);
  const [f, setF] = useState<Rascunho>(inicial);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [local, setLocal] = useState<Local | null>(null);
  const [modoMapa, setModoMapa] = useState(false);
  const [gps, setGps] = useState<"" | "buscando" | "negado" | "indisponivel">("");
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  useEffect(() => { salvarRascunho(f); }, [f]);

  function usarGps() {
    if (!("geolocation" in navigator)) return setGps("indisponivel");
    setGps("buscando");
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocal({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy), origem: "gps", em: new Date(p.timestamp).toISOString() }); setGps(""); setModoMapa(true); },
      (e) => setGps(e.code === e.PERMISSION_DENIED ? "negado" : "indisponivel"),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }
  const marcar = (lat: number, lng: number) => setLocal({ lat, lng, precisao: null, origem: "mapa", em: new Date().toISOString() });

  async function enviar() {
    const e: Record<string, string> = {};
    if (!f.tipo) e.tipo = "Escolha o tipo.";
    if (f.assunto.trim().length < 3) e.assunto = "Escreva o assunto.";
    if (f.descricao.trim().length < 10) e.descricao = "Descreva com pelo menos 10 caracteres.";
    setErros(e);
    if (Object.keys(e).length) { document.getElementById(Object.keys(e)[0] === "tipo" ? "ouv-tipo" : "ouv-" + Object.keys(e)[0])?.focus(); return toast.error("Confira os campos destacados."); }
    if (anexos.some((a) => a.estado === "enviando")) return toast("Aguarde os arquivos terminarem de enviar.");
    if (anexos.some((a) => a.estado === "erro")) return toast.error("Um arquivo falhou. Toque em “Tentar de novo” ou remova-o.");
    if (enviando) return;
    setEnviando(true);
    const { data, error } = await db.rpc("ouv_registrar", {
      _chave: f.chave, _tipo: f.tipo, _assunto: f.assunto, _descricao: f.descricao, _endereco: f.endereco || null, _referencia: f.referencia || null,
      _lat: local?.lat ?? null, _lng: local?.lng ?? null, _precisao: local?.precisao ?? null, _loc_origem: local?.origem ?? null, _loc_em: local?.em ?? null,
      _anexos: anexosParaEnvio(anexos),
    });
    setEnviando(false);
    if (error) return toast.error(/fetch|network|Failed/i.test(error.message) ? "Sem conexão. Seu relato está salvo: toque em Enviar de novo." : error.message);
    if (f.categoria && data?.id) await db.rpc("ouv_categoria", { _id: data.id, _categoria: f.categoria });
    limparRascunho();
    onFeito(data);
  }

  const ponto: [number, number] | null = local ? [local.lat, local.lng] : null;
  return (
    <div className="flex flex-col gap-5">
      <button onClick={onVoltar} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Voltar</button>
      <PageHeader title="Registrar" highlight="manifestação" subtitle="Campos com * são obrigatórios. O texto fica salvo neste aparelho até você enviar." />

      <Card className="flex flex-col gap-4">
        <Campo id="ouv-tipo" label="Tipo" obrigatorio erro={erros.tipo}>
          <div id="ouv-tipo" tabIndex={-1} className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de manifestação">
            {TIPOS_OUV.map(([k, l, d]) => (
              <button key={k} type="button" role="radio" aria-checked={f.tipo === k} onClick={() => setF({ ...f, tipo: k })}
                className={cn("rounded-2xl border p-3 text-left", f.tipo === k ? "border-primary bg-primary-soft" : "border-border bg-card")}>
                <b className={cn("block", f.tipo === k ? "text-primary" : "text-navy")}>{l}</b><span className="text-xs text-muted-foreground">{d}</span>
              </button>
            ))}
          </div>
        </Campo>
        <Campo id="ouv-categoria" label="Área" dica="Ajuda a equipe a direcionar ao órgão certo.">
          <select id="ouv-categoria" className={inputCls} value={f.categoria ?? ""} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            <option value="">Escolha a área</option>{CATEGORIAS_OUV.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Campo>
        <Campo id="ouv-assunto" label="Assunto" obrigatorio erro={erros.assunto}>
          <input id="ouv-assunto" className={inputCls} maxLength={140} value={f.assunto} onChange={(e) => setF({ ...f, assunto: e.target.value })} placeholder="Ex.: Calçada sem acessibilidade na frente da escola" />
        </Campo>
        <Campo id="ouv-descricao" label="Descrição" obrigatorio erro={erros.descricao} dica="Conte o que aconteceu, quando e quem estava envolvido.">
          <textarea id="ouv-descricao" className={textareaCls + " min-h-36"} maxLength={5000} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        </Campo>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><MapPin className="h-5 w-5 text-primary" /> Local da ocorrência <span className="text-sm font-normal text-muted-foreground">(opcional)</span></h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Btn type="button" v="soft" className="min-h-14" onClick={usarGps} disabled={gps === "buscando"}><Crosshair className="h-5 w-5" /> {gps === "buscando" ? "Buscando sua localização…" : "Usar minha localização atual"}</Btn>
          <Btn type="button" v="outline" className="min-h-14" onClick={() => setModoMapa(true)}><MapPin className="h-5 w-5" /> Marcar local da ocorrência no mapa</Btn>
        </div>
        {gps === "negado" && <Aviso tom="amber">A permissão de localização foi negada. Tudo bem: marque o ponto no mapa ou escreva o endereço abaixo. Você também pode enviar sem localização.</Aviso>}
        {gps === "indisponivel" && <Aviso tom="amber">Não conseguimos obter a localização agora. Marque no mapa ou escreva o endereço.</Aviso>}
        {modoMapa && (
          <>
            <MapaPonto ponto={ponto} precisao={local?.origem === "gps" ? local.precisao : null} editavel onMudar={marcar} />
            <p className="text-sm text-muted-foreground">{ponto ? "Arraste o pino ou toque no mapa para ajustar o ponto exato." : "Toque no mapa para marcar onde aconteceu."}</p>
          </>
        )}
        {local && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted p-3 text-sm">
            <Chip tom={local.origem === "gps" ? "blue" : "coral"}>{local.origem === "gps" ? "GPS do celular" : "Selecionado no mapa por você"}</Chip>
            <span className="font-mono">{local.lat.toFixed(6)}, {local.lng.toFixed(6)}</span>
            {local.precisao != null && <span className="text-muted-foreground">± {local.precisao} m</span>}
            <span className="text-muted-foreground">· {fDataHora(local.em)}</span>
            <button type="button" onClick={() => { setLocal(null); }} className="ml-auto text-sm font-semibold text-primary">Remover ponto</button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="ouv-end" label="Endereço"><input id="ouv-end" className={inputCls} maxLength={300} value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade" /></Campo>
          <Campo id="ouv-ref" label="Ponto de referência"><input id="ouv-ref" className={inputCls} maxLength={300} value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="Ex.: em frente ao posto de saúde" /></Campo>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Fotos e documentos <span className="text-sm font-normal text-muted-foreground">(opcional)</span></h2>
        {user && <OuvAnexos uid={user.id} chave={f.chave} anexos={anexos} setAnexos={setAnexos} />}
      </Card>

      <Btn onClick={enviar} disabled={enviando} className="min-h-14 text-lg"><Send className="h-5 w-5" /> {enviando ? "Enviando…" : "Enviar manifestação"}</Btn>
      <p className="text-center text-xs text-muted-foreground">Seu nome e contato vêm do seu cadastro e só a equipe da Ouvidoria vê.</p>
    </div>
  );
}

function Confirmacao({ r }: { r: { id: string; protocolo: string; created_at: string; status: string } }) {
  const nav = useNavigate();
  async function copiar() {
    try { await navigator.clipboard.writeText(r.protocolo); toast.success("Protocolo copiado."); } catch { toast(r.protocolo); }
  }
  const [st, tom] = STATUS_OUV[r.status] ?? ["Recebida", "blue"];
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-14 w-14 text-success" />
        <h1 className="font-display text-2xl font-extrabold">Manifestação registrada</h1>
        <p className="text-sm text-muted-foreground">Guarde o número do seu protocolo</p>
        <p className="rounded-2xl bg-primary-soft px-5 py-3 font-mono text-2xl font-extrabold tracking-wide text-primary">{r.protocolo}</p>
        <p className="text-sm">{fDataHora(r.created_at)} · Situação: <Chip tom={tom}>{st}</Chip></p>
      </Card>
      <div className="grid gap-2 sm:grid-cols-2">
        <Btn v="outline" onClick={copiar}><Copy className="h-4 w-4" /> Copiar protocolo</Btn>
        <Btn onClick={() => nav({ to: "/minhas-manifestacoes", search: { p: r.id } as any })}><ClipboardList className="h-4 w-4" /> Acompanhar no meu perfil</Btn>
      </div>
      <Link to="/inicio" className={cn(btn.base, btn.ghost)}>Voltar ao início</Link>
    </div>
  );
}
