import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Ban, CalendarDays, ChevronLeft, EyeOff, Flag, HeartHandshake, LocateFixed, MapPin, MessageCircle, Plus, Search, Send, ShieldCheck, UserPlus, Users, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Card, Carregando, Chip, Modal, Opcoes, Vazio, btn, inputCls, textareaCls } from "@/components/app/kit";
import { nomeExibicao, useAuth } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { UFS, fDataHora } from "@/lib/br";
import { cn } from "@/lib/utils";

type Busca = { aba?: string; com?: string; grupo?: string };
export const Route = createFileRoute("/comunidade")({
  head: () => ({ meta: [{ title: "Rede de Famílias · AMPARO" }] }),
  validateSearch: (s: Record<string, unknown>): Busca => ({ aba: typeof s.aba === "string" ? s.aba : undefined, com: typeof s.com === "string" ? s.com : undefined, grupo: typeof s.grupo === "string" ? s.grupo : undefined }),
  component: () => <AppShell><Comunidade /></AppShell>,
});

const FAIXAS = ["0-3 anos", "4-6 anos", "7-12 anos", "13-17 anos", "18+ anos"];
const INTERESSES = ["TEA (autismo)", "TDAH", "Síndrome de Down", "Deficiência intelectual", "Paralisia cerebral", "Doenças raras", "Altas habilidades", "Escola inclusiva", "BPC e direitos", "Alimentação seletiva", "Sono", "Lazer adaptado"];
const APOIOS = ["Conversar e desabafar", "Trocar experiências", "Indicações de profissionais", "Caronas para terapias", "Encontros presenciais", "Ajuda com direitos", "Brincadeiras entre as crianças", "Rede de mães que trabalham"];
const RAIOS = [1, 3, 5, 10, 20, 50, 100];
const TIPOS_POST: [string, string][] = [["relato", "Relato"], ["pergunta", "Pergunta"], ["dica", "Dica"]];
const TIPO_GRUPO: Record<string, string> = { nucleo: "Núcleo local", bairro: "Bairro", cidade: "Cidade", interesse: "Interesse" };
const MOTIVOS = ["Assédio ou mensagens indesejadas", "Ofensa ou discriminação", "Golpe ou pedido de dinheiro", "Expõe dados de criança ou de outra família", "Perfil falso", "Outro"];

type Perfil = { user_id: string; ativo: boolean; apelido: string; cidade: string; bairro: string | null; uf: string; mostrar_bairro: boolean; usa_localizacao: boolean; lat: number | null; lng: number | null; faixas: string[]; interesses: string[]; apoios: string[]; sobre: string | null; aceita_mensagens: boolean };

function Comunidade() {
  const s = Route.useSearch();
  const nav = useNavigate();
  const ir = (b: Busca) => nav({ to: "/comunidade", search: b as any });
  const { user } = useAuth();
  const { data: eu, loading, recarregar } = useQuery<Perfil | null>(async () => (await db.from("rf_perfis").select("*").eq("user_id", user!.id).maybeSingle()).data, [user?.id]);
  const aba = s.com ? "conexoes" : s.grupo ? "grupos" : s.aba ?? "familias";
  const ativo = !!eu?.ativo;

  return (
    <div className="flex flex-col gap-4">
      <header className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#00845A,#00A35B_55%,#0868D0)] px-4 pb-5 pt-4 text-white sm:px-6">
        <span aria-hidden="true" className="faixa-marca absolute inset-x-0 bottom-0 h-1.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">Ninguém caminha só</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">Rede de Famílias</h1>
          <p className="mt-0.5 hidden text-sm text-white/90 sm:block">Encontre famílias perto de você, forme grupos, troque experiências e marque encontros.</p>
        </div>
        <UsersRound className="h-10 w-10 shrink-0 text-white/80" aria-hidden="true" />
      </header>

      {loading ? <Carregando /> : !eu ? <Participar onFeito={recarregar} /> : (
        <>
          {!ativo && <Aviso tom="amber">Seu perfil na rede está pausado: ninguém encontra você. <button onClick={() => ir({ aba: "perfil" })} className="font-semibold text-primary underline">Reativar</button></Aviso>}
          <nav aria-label="Seções da Rede" className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {[["familias", "Famílias perto", MapPin], ["conexoes", "Conexões", MessageCircle], ["grupos", "Grupos e núcleos", Users], ["mural", "Mural", HeartHandshake], ["perfil", "Meu perfil", ShieldCheck]].map(([k, l, I]: any) => (
              <button key={k} onClick={() => ir({ aba: k })} aria-current={aba === k ? "page" : undefined}
                className={cn("tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", aba === k ? "border-success bg-success text-white" : "border-border bg-card text-navy")}>
                <I className="h-4 w-4" /> {l}
              </button>
            ))}
          </nav>
          {aba === "familias" && <Familias eu={eu} onPerfil={() => ir({ aba: "perfil" })} onConversar={(u) => ir({ com: u })} />}
          {aba === "conexoes" && (s.com ? <Chat outro={s.com} onVoltar={() => ir({ aba: "conexoes" })} /> : <Conexoes onConversar={(u) => ir({ com: u })} />)}
          {aba === "grupos" && (s.grupo ? <Grupo id={s.grupo} onVoltar={() => ir({ aba: "grupos" })} /> : <Grupos eu={eu} onAbrir={(g) => ir({ grupo: g })} />)}
          {aba === "mural" && <Feed grupo={null} />}
          {aba === "perfil" && <EditarPerfil eu={eu} onFeito={recarregar} />}
          <p className="text-center text-xs text-muted-foreground">A Rede é um espaço de apoio mútuo entre famílias e não substitui atendimento psicológico. Para falar com um profissional, use a <Link to="/consultas" className="font-semibold text-primary">Teleconsulta</Link>. Em crise, toque em SOS.</p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Perfil
function FormPerfil({ inicial, onSalvar, salvando, botao }: { inicial: Partial<Perfil>; onSalvar: (p: Partial<Perfil>) => void; salvando: boolean; botao: string }) {
  const [p, setP] = useState<Partial<Perfil>>(inicial);
  const [gps, setGps] = useState("");
  const set = (k: keyof Perfil, v: any) => setP((x) => ({ ...x, [k]: v }));
  function localizar() {
    if (!navigator.geolocation) return setGps("erro");
    setGps("buscando");
    navigator.geolocation.getCurrentPosition((g) => { setP((x) => ({ ...x, usa_localizacao: true, lat: Math.round(g.coords.latitude * 100) / 100, lng: Math.round(g.coords.longitude * 100) / 100 })); setGps(""); },
      () => setGps("erro"), { timeout: 15000, maximumAge: 600000 });
  }
  return (
    <div className="flex flex-col gap-4">
      <Campo id="rf-ap" label="Como quer ser chamada(o) na rede" obrigatorio dica="Pode ser só o primeiro nome ou um apelido."><input id="rf-ap" className={inputCls} maxLength={40} value={p.apelido ?? ""} onChange={(e) => set("apelido", e.target.value)} /></Campo>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem]">
        <Campo id="rf-cid" label="Cidade" obrigatorio><input id="rf-cid" className={inputCls} maxLength={80} value={p.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} /></Campo>
        <Campo id="rf-bai" label="Bairro"><input id="rf-bai" className={inputCls} maxLength={80} value={p.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} /></Campo>
        <Campo id="rf-uf" label="UF" obrigatorio><select id="rf-uf" className={inputCls} value={p.uf ?? "BA"} onChange={(e) => set("uf", e.target.value)}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Campo>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={p.mostrar_bairro ?? true} onChange={(e) => set("mostrar_bairro", e.target.checked)} /> Mostrar meu bairro para outras famílias</label>
      <div className="flex flex-col gap-2 rounded-2xl bg-success-soft p-4 text-sm">
        <b className="text-navy">Autorizo usar minha localização aproximada para a busca por distância</b>
        <span className="text-muted-foreground">Guardamos um ponto com cerca de 1 km de margem. Outras famílias veem só “a cerca de X km”, nunca seu endereço ou mapa. Você pode desligar quando quiser.</span>
        {p.usa_localizacao && p.lat != null ? (
          <span className="flex flex-wrap items-center gap-2 font-semibold text-success">✓ Localização aproximada ativa <button onClick={() => setP((x) => ({ ...x, usa_localizacao: false, lat: null, lng: null }))} className="font-semibold text-muted-foreground underline">Desligar</button></span>
        ) : <Btn v="outline" className="min-h-10 self-start" onClick={localizar} disabled={gps === "buscando"}><LocateFixed className="h-4 w-4" /> {gps === "buscando" ? "Buscando…" : "Autorizar e usar minha localização"}</Btn>}
        {gps === "erro" && <span className="text-emergency">Não foi possível obter a localização. A busca por cidade continua funcionando.</span>}
      </div>
      <Campo id="rf-fx" label="Idade dos filhos"><Opcoes multi nome="Idade dos filhos" valores={FAIXAS} valor={p.faixas ?? []} onChange={(v) => set("faixas", v)} /></Campo>
      <Campo id="rf-in" label="Interesses em comum"><Opcoes multi nome="Interesses" valores={INTERESSES} valor={p.interesses ?? []} onChange={(v) => set("interesses", v)} /></Campo>
      <Campo id="rf-apo" label="Que tipo de apoio você procura ou oferece"><Opcoes multi nome="Apoios" valores={APOIOS} valor={p.apoios ?? []} onChange={(v) => set("apoios", v)} /></Campo>
      <Campo id="rf-sob" label="Sobre você" dica="Conte o que quiser. Evite nome completo, diagnóstico detalhado, escola ou endereço do seu filho.">
        <textarea id="rf-sob" className={textareaCls} maxLength={500} value={p.sobre ?? ""} onChange={(e) => set("sobre", e.target.value)} />
      </Campo>
      <Btn className="self-start" disabled={salvando} onClick={() => {
        if ((p.apelido ?? "").trim().length < 2) return toast.error("Informe como quer ser chamada(o).");
        if ((p.cidade ?? "").trim().length < 2) return toast.error("Informe a cidade.");
        onSalvar(p);
      }}>{salvando ? "Salvando…" : botao}</Btn>
    </div>
  );
}

const limpo = (p: Partial<Perfil>) => ({ apelido: p.apelido!.trim(), cidade: p.cidade!.trim(), bairro: p.bairro?.trim() || null, uf: p.uf ?? "BA", mostrar_bairro: p.mostrar_bairro ?? true,
  usa_localizacao: !!(p.usa_localizacao && p.lat != null), lat: p.lat ?? null, lng: p.lng ?? null, faixas: p.faixas ?? [], interesses: p.interesses ?? [], apoios: p.apoios ?? [], sobre: p.sobre?.trim() || null });

function Participar({ onFeito }: { onFeito: () => void }) {
  const { user, perfil, familia } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  async function salvar(p: Partial<Perfil>) {
    setSalvando(true);
    const { error } = await db.from("rf_perfis").insert({ user_id: user!.id, ...limpo(p) });
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vinda(o) à Rede de Famílias!"); onFeito();
  }
  if (!aberto) return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold">Participar é voluntário</h2>
      <ul className="flex flex-col gap-2 text-sm">
        <li className="flex gap-2"><MapPin className="h-5 w-5 shrink-0 text-success" /> Encontre famílias por perto (1 a 100 km) ou pela cidade e bairro.</li>
        <li className="flex gap-2"><UserPlus className="h-5 w-5 shrink-0 text-success" /> Conecte-se e converse em particular só com quem aceitar.</li>
        <li className="flex gap-2"><Users className="h-5 w-5 shrink-0 text-success" /> Entre em grupos do seu bairro, da sua cidade ou por interesse e em núcleos locais com moderação.</li>
        <li className="flex gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-success" /> Endereço e localização exata nunca aparecem. Você escolhe o que mostrar e pode sair quando quiser.</li>
      </ul>
      <Btn v="wa" className="self-start" onClick={() => setAberto(true)}><UsersRound className="h-5 w-5" /> Quero participar</Btn>
    </Card>
  );
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold">Seu perfil na rede</h2>
      <FormPerfil inicial={{ apelido: (perfil?.nome_chamada || nomeExibicao(perfil, user) || "").split(" ")[0], cidade: familia?.cidade ?? "", uf: familia?.uf ?? "BA", mostrar_bairro: true }} onSalvar={salvar} salvando={salvando} botao="Entrar na rede" />
    </Card>
  );
}

function EditarPerfil({ eu, onFeito }: { eu: Perfil; onFeito: () => void }) {
  const [salvando, setSalvando] = useState(false);
  async function salvar(p: Partial<Perfil>) {
    setSalvando(true);
    const { error } = await db.from("rf_perfis").update(limpo(p)).eq("user_id", eu.user_id);
    setSalvando(false); if (error) return toast.error(error.message); toast.success("Perfil atualizado."); onFeito();
  }
  async function alternar(k: "ativo" | "aceita_mensagens") { const { error } = await db.from("rf_perfis").update({ [k]: !eu[k] }).eq("user_id", eu.user_id); if (error) return toast.error(error.message); onFeito(); }
  async function sair() {
    if (!confirm("Sair da Rede de Famílias? Seu perfil, conexões e mensagens privadas serão apagados.")) return;
    await db.from("rf_perfis").delete().eq("user_id", eu.user_id); toast.success("Você saiu da rede."); onFeito();
  }
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-2">
        <label className="flex items-center justify-between gap-3"><span><b className="text-navy">Aparecer na busca</b><span className="block text-sm text-muted-foreground">Desligado, ninguém encontra você.</span></span><input type="checkbox" className="h-6 w-6" checked={eu.ativo} onChange={() => alternar("ativo")} /></label>
        <label className="flex items-center justify-between gap-3"><span><b className="text-navy">Receber mensagens</b><span className="block text-sm text-muted-foreground">Só de famílias conectadas a você.</span></span><input type="checkbox" className="h-6 w-6" checked={eu.aceita_mensagens} onChange={() => alternar("aceita_mensagens")} /></label>
      </Card>
      <Card><FormPerfil inicial={eu} onSalvar={salvar} salvando={salvando} botao="Salvar perfil" /></Card>
      <Btn v="ghost" className="self-start text-emergency hover:bg-emergency-soft" onClick={sair}>Sair da rede e apagar meu perfil</Btn>
    </div>
  );
}

// ---------------------------------------------------------------- Busca de famílias
type Achado = { user_id: string; apelido: string; cidade: string; bairro: string | null; uf: string; faixas: string[]; interesses: string[]; apoios: string[]; sobre: string | null; distancia_km: number | null; conexao: string | null; aceita_mensagens: boolean };

function Denunciar({ tipo, id, onFechar }: { tipo: string; id: string; onFechar: () => void }) {
  const [m, setM] = useState("");
  return (
    <Modal titulo="Denunciar" onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <Opcoes nome="Motivo" valores={MOTIVOS} valor={m} onChange={setM} />
        <p className="text-xs text-muted-foreground">A equipe do AMPARO analisa. A pessoa denunciada não sabe quem denunciou.</p>
        <Btn v="danger" className="self-start" onClick={async () => { if (!m) return toast.error("Escolha o motivo."); const { error } = await db.rpc("rf_denunciar", { _tipo: tipo, _id: id, _motivo: m }); if (error) return toast.error(error.message); toast.success("Denúncia enviada."); onFechar(); }}>Enviar denúncia</Btn>
      </div>
    </Modal>
  );
}

function Familias({ eu, onPerfil, onConversar }: { eu: Perfil; onPerfil: () => void; onConversar: (u: string) => void }) {
  const [raio, setRaio] = useState<number | null>(eu.usa_localizacao ? 10 : null);
  const [cidade, setCidade] = useState(eu.usa_localizacao ? "" : eu.cidade);
  const [bairro, setBairro] = useState("");
  const [faixa, setFaixa] = useState("");
  const [interesse, setInteresse] = useState("");
  const [apoio, setApoio] = useState("");
  const [den, setDen] = useState<string | null>(null);
  const [conectar, setConectar] = useState<Achado | null>(null);
  const { data, loading, recarregar } = useQuery<Achado[]>(async () => {
    const { data, error } = await db.rpc("rf_buscar", { _lat: raio && eu.lat != null ? Number(eu.lat) : null, _lng: raio && eu.lng != null ? Number(eu.lng) : null, _raio: raio, _cidade: cidade.trim() || null, _bairro: bairro.trim() || null, _faixa: faixa || null, _interesse: interesse || null, _apoio: apoio || null });
    if (error) throw error; return data ?? [];
  }, [raio, cidade, bairro, faixa, interesse, apoio]);
  async function bloquear(a: Achado) { if (!confirm(`Bloquear ${a.apelido}? Vocês deixam de se ver na rede.`)) return; await db.rpc("rf_bloquear", { _outro: a.user_id }); toast.success("Bloqueado."); recarregar(); }
  async function aceitar(a: Achado) { const { error } = await db.rpc("rf_conectar", { _para: a.user_id, _mensagem: null }); if (error) return toast.error(error.message); toast.success("Conexão aceita."); recarregar(); }
  const sel = "tap shrink-0 rounded-full border border-border bg-card px-3 text-sm font-semibold text-navy";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-navy">Distância</span>
        {eu.usa_localizacao && eu.lat != null ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Raio de busca">
            <button role="radio" aria-checked={raio === null} onClick={() => setRaio(null)} className={cn("tap shrink-0 rounded-full border px-4 text-sm font-semibold", raio === null ? "border-success bg-success-soft text-success" : "border-border bg-card")}>Qualquer</button>
            {RAIOS.map((r) => <button key={r} role="radio" aria-checked={raio === r} onClick={() => { setRaio(r); setCidade(""); }} className={cn("tap shrink-0 rounded-full border px-4 text-sm font-semibold", raio === r ? "border-success bg-success-soft text-success" : "border-border bg-card")}>{r} km</button>)}
          </div>
        ) : <p className="text-sm text-muted-foreground">Para buscar por distância, <button onClick={onPerfil} className="font-semibold text-primary underline">autorize a localização aproximada no seu perfil</button>.</p>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="sr-only" htmlFor="rf-bc">Cidade</label><input id="rf-bc" className={inputCls} placeholder="Cidade" value={cidade} onChange={(e) => { setCidade(e.target.value); if (e.target.value) setRaio(null); }} />
        <label className="sr-only" htmlFor="rf-bb">Bairro</label><input id="rf-bb" className={inputCls} placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        <select aria-label="Idade dos filhos" className={cn(sel, faixa && "border-success text-success")} value={faixa} onChange={(e) => setFaixa(e.target.value)}><option value="">Idade dos filhos</option>{FAIXAS.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Interesse" className={cn(sel, interesse && "border-success text-success")} value={interesse} onChange={(e) => setInteresse(e.target.value)}><option value="">Interesse</option>{INTERESSES.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Apoio procurado" className={cn(sel, apoio && "border-success text-success")} value={apoio} onChange={(e) => setApoio(e.target.value)}><option value="">Tipo de apoio</option>{APOIOS.map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      {loading ? <Carregando /> : !data?.length ? (
        <Vazio icon={Search} titulo="Nenhuma família encontrada" texto={raio ? "Aumente a distância ou tire algum filtro. A rede está começando: convide outras mães do AMPARO!" : "Tente outra cidade, bairro ou tire algum filtro."} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.map((a) => (
            <li key={a.user_id}>
              <Card className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success-soft font-display text-lg font-extrabold text-success">{a.apelido.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <b className="block font-display text-navy">{a.apelido}</b>
                    <span className="text-xs text-muted-foreground">{[a.bairro, a.cidade].filter(Boolean).join(" · ")}{a.distancia_km != null ? ` · ~${a.distancia_km} km` : ""}</span>
                  </div>
                </div>
                {a.sobre && <p className="line-clamp-3 text-sm">{a.sobre}</p>}
                {(a.faixas.length > 0 || a.interesses.length > 0) && <div className="flex flex-wrap gap-1">{[...a.faixas, ...a.interesses.slice(0, 3)].map((x) => <Chip key={x} tom="green">{x}</Chip>)}</div>}
                {a.apoios.length > 0 && <p className="text-xs text-muted-foreground">Busca: {a.apoios.slice(0, 3).join(" · ")}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  {a.conexao === "conectado" ? <Btn v="soft" className="min-h-10" onClick={() => onConversar(a.user_id)}><MessageCircle className="h-4 w-4" /> Conversar</Btn>
                    : a.conexao === "recebida" ? <Btn v="wa" className="min-h-10" onClick={() => aceitar(a)}>Aceitar conexão</Btn>
                    : a.conexao === "enviada" ? <Chip tom="amber">Pedido enviado</Chip>
                    : <Btn v="wa" className="min-h-10" onClick={() => setConectar(a)}><UserPlus className="h-4 w-4" /> Conectar</Btn>}
                  <span className="flex-1" />
                  <button onClick={() => setDen(a.user_id)} aria-label={`Denunciar ${a.apelido}`} className="tap grid min-w-10 place-items-center text-muted-foreground hover:text-emergency"><Flag className="h-4 w-4" /></button>
                  <button onClick={() => bloquear(a)} aria-label={`Bloquear ${a.apelido}`} className="tap grid min-w-10 place-items-center text-muted-foreground hover:text-emergency"><Ban className="h-4 w-4" /></button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {den && <Denunciar tipo="perfil" id={den} onFechar={() => setDen(null)} />}
      {conectar && <PedidoConexao a={conectar} onFechar={() => setConectar(null)} onFeito={() => { setConectar(null); recarregar(); }} />}
    </div>
  );
}

function PedidoConexao({ a, onFechar, onFeito }: { a: Achado; onFechar: () => void; onFeito: () => void }) {
  const [m, setM] = useState(`Oi, ${a.apelido}! Vi seu perfil na Rede do AMPARO. Vamos trocar experiências?`);
  return (
    <Modal titulo={`Conectar com ${a.apelido}`} onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <Campo id="rf-pm" label="Mensagem do pedido"><textarea id="rf-pm" className={textareaCls} maxLength={300} value={m} onChange={(e) => setM(e.target.value)} /></Campo>
        <p className="text-xs text-muted-foreground">As mensagens privadas só ficam disponíveis depois que {a.apelido} aceitar.</p>
        <Btn v="wa" className="self-start" onClick={async () => { const { error } = await db.rpc("rf_conectar", { _para: a.user_id, _mensagem: m }); if (error) return toast.error(error.message); toast.success("Pedido enviado."); onFeito(); }}><UserPlus className="h-4 w-4" /> Enviar pedido</Btn>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Conexões e conversa
type Conexao = { id: string; outro: string; apelido: string; cidade: string | null; status: string; recebida: boolean; mensagem: string | null; created_at: string; nao_lidas: number };
function Conexoes({ onConversar }: { onConversar: (u: string) => void }) {
  const { data, loading, recarregar } = useQuery<Conexao[]>(async () => (await db.rpc("rf_minhas_conexoes")).data ?? [], []);
  async function responder(c: Conexao, sim: boolean) { const { error } = await db.rpc("rf_responder", { _id: c.id, _aceitar: sim }); if (error) return toast.error(error.message); toast.success(sim ? "Conexão aceita." : "Pedido recusado."); recarregar(); }
  if (loading) return <Carregando />;
  const pedidos = (data ?? []).filter((c) => c.status === "pendente" && c.recebida);
  const enviados = (data ?? []).filter((c) => c.status === "pendente" && !c.recebida);
  const ok = (data ?? []).filter((c) => c.status === "aceita");
  if (!data?.length) return <Vazio icon={UserPlus} titulo="Você ainda não tem conexões" texto="Encontre famílias perto de você e envie um pedido de conexão." />;
  return (
    <div className="flex flex-col gap-4">
      {pedidos.length > 0 && <section className="flex flex-col gap-2"><h2 className="font-display text-lg font-bold">Pedidos recebidos</h2>
        {pedidos.map((c) => (
          <Card key={c.id} className="flex flex-col gap-2 p-4">
            <p><b className="text-navy">{c.apelido}</b> <span className="text-sm text-muted-foreground">{c.cidade}</span></p>
            {c.mensagem && <p className="rounded-xl bg-muted p-3 text-sm">{c.mensagem}</p>}
            <div className="flex gap-2"><Btn v="wa" className="min-h-10" onClick={() => responder(c, true)}>Aceitar</Btn><Btn v="outline" className="min-h-10" onClick={() => responder(c, false)}>Recusar</Btn></div>
          </Card>
        ))}</section>}
      <section className="flex flex-col gap-2"><h2 className="font-display text-lg font-bold">Minhas conexões</h2>
        {!ok.length ? <p className="text-sm text-muted-foreground">Nenhuma conexão aceita ainda.</p> : ok.map((c) => (
          <button key={c.id} onClick={() => onConversar(c.outro)} className={cn("card-soft flex items-center gap-3 p-3 text-left hover:border-primary", c.nao_lidas > 0 && "border-primary")}>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-success-soft font-bold text-success">{c.apelido.slice(0, 1)}</span>
            <span className="min-w-0 flex-1"><b className="block text-navy">{c.apelido}</b><span className="text-xs text-muted-foreground">{c.cidade}</span></span>
            {c.nao_lidas > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-coral px-1.5 text-xs font-bold text-white">{c.nao_lidas}</span>}
            <MessageCircle className="h-5 w-5 text-primary" />
          </button>
        ))}</section>
      {enviados.length > 0 && <p className="text-sm text-muted-foreground">Aguardando resposta: {enviados.map((c) => c.apelido).join(", ")}</p>}
    </div>
  );
}

type Msg = { id: string; de: string; texto: string; created_at: string; lida_em: string | null };
function Chat({ outro, onVoltar }: { outro: string; onVoltar: () => void }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [info, setInfo] = useState<Conexao | null | undefined>(undefined);
  const [texto, setTexto] = useState("");
  const [den, setDen] = useState<string | null>(null);
  async function carregar() {
    const { data } = await db.from("rf_mensagens").select("id,de,texto,created_at,lida_em").or(`and(de.eq.${user!.id},para.eq.${outro}),and(de.eq.${outro},para.eq.${user!.id})`).order("created_at");
    setMsgs(data ?? []);
    if ((data ?? []).some((m: Msg) => m.de === outro && !m.lida_em)) db.rpc("rf_marcar_lidas", { _de: outro });
  }
  useEffect(() => {
    db.rpc("rf_minhas_conexoes").then(({ data }: any) => setInfo((data ?? []).find((c: Conexao) => c.outro === outro && c.status === "aceita") ?? null));
    carregar(); const t = setInterval(() => document.visibilityState === "visible" && carregar(), 8000); return () => clearInterval(t);
  }, [outro]);
  async function enviar() { if (!texto.trim()) return; const { error } = await db.rpc("rf_enviar", { _para: outro, _texto: texto }); if (error) return toast.error(error.message); setTexto(""); carregar(); }
  if (info === undefined) return <Carregando />;
  if (info === null) return <Vazio icon={MessageCircle} titulo="Conversa indisponível" texto="Vocês precisam estar conectados para conversar."><Btn v="outline" onClick={onVoltar}>Voltar</Btn></Vazio>;
  return (
    <div className="flex flex-col gap-3">
      <button onClick={onVoltar} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Conexões</button>
      <Card className="flex items-center gap-3 p-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-success-soft font-bold text-success">{info.apelido.slice(0, 1)}</span><b className="flex-1 text-navy">{info.apelido}</b><span className="text-sm text-muted-foreground">{info.cidade}</span></Card>
      <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs">Converse com cuidado: não envie laudos, documentos ou endereço. Encontros, de preferência em locais públicos ou nos encontros do AMPARO.</p>
      <div className="flex min-h-40 flex-col gap-2" aria-live="polite">
        {msgs.map((m) => { const minha = m.de === user?.id; return (
          <div key={m.id} className={cn("group max-w-[85%] rounded-2xl px-4 py-2", minha ? "self-end rounded-br-md bg-success text-white" : "self-start rounded-bl-md bg-card shadow-card")}>
            <p className="whitespace-pre-line break-words">{m.texto}</p>
            <p className={cn("mt-0.5 flex items-center gap-2 text-[11px]", minha ? "text-white/80" : "text-muted-foreground")}>{fDataHora(m.created_at)}
              {!minha && <button onClick={() => setDen(m.id)} className="underline">denunciar</button>}</p>
          </div>
        ); })}
        {!msgs.length && <p className="text-center text-sm text-muted-foreground">Diga oi para {info.apelido}!</p>}
      </div>
      <div className="sticky bottom-20 flex items-end gap-2 bg-background/95 py-2 lg:bottom-2">
        <label htmlFor="rf-msg" className="sr-only">Mensagem</label>
        <textarea id="rf-msg" rows={1} className={cn(textareaCls, "min-h-12 flex-1 resize-none py-3")} maxLength={2000} placeholder="Escreva uma mensagem" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
        <Btn v="wa" onClick={enviar} disabled={!texto.trim()} aria-label="Enviar" className="px-4"><Send className="h-5 w-5" /></Btn>
      </div>
      {den && <Denunciar tipo="mensagem" id={den} onFechar={() => setDen(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- Grupos, núcleos e encontros
type GrupoT = { id: string; nome: string; tipo: string; cidade: string | null; bairro: string | null; descricao: string | null; com_profissional: boolean; status: string; membros: number; sou_membro: boolean; sou_moderador: boolean };
function Grupos({ eu, onAbrir }: { eu: Perfil; onAbrir: (id: string) => void }) {
  const { data, loading, recarregar } = useQuery<GrupoT[]>(async () => (await db.rpc("rf_grupos_lista")).data ?? [], []);
  const [tipo, setTipo] = useState("");
  const [novo, setNovo] = useState(false);
  async function entrar(g: GrupoT) { const { error } = await db.rpc("rf_entrar_grupo", { _g: g.id }); if (error) return toast.error(error.message); toast.success("Você entrou no grupo."); onAbrir(g.id); }
  if (loading) return <Carregando />;
  const lista = (data ?? []).filter((g) => !tipo || g.tipo === tipo);
  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {[["", "Todos"], ["nucleo", "Núcleos locais"], ["bairro", "Bairro"], ["cidade", "Cidade"], ["interesse", "Interesse"]].map(([k, l]) => (
          <button key={k} onClick={() => setTipo(k)} className={cn("tap shrink-0 rounded-full border px-4 text-sm font-semibold", tipo === k ? "border-success bg-success-soft text-success" : "border-border bg-card")}>{l}</button>
        ))}
      </div>
      {!lista.length ? <Vazio icon={Users} titulo="Nenhum grupo ainda" texto="Sugira um grupo do seu bairro, da sua cidade ou de um interesse em comum. A equipe aprova e ele aparece aqui." />
        : <ul className="grid gap-2 sm:grid-cols-2">{lista.map((g) => (
          <li key={g.id}><Card className={cn("flex h-full flex-col gap-2 p-4", g.tipo === "nucleo" && "border-success")}>
            <div className="flex flex-wrap items-center gap-1.5"><Chip tom={g.tipo === "nucleo" ? "green" : "blue"}>{TIPO_GRUPO[g.tipo]}</Chip>{g.com_profissional && <Chip tom="amber">Com profissional</Chip>}{g.status === "pendente" && <Chip tom="amber">Aguardando aprovação</Chip>}</div>
            <b className="font-display text-lg text-navy">{g.nome}</b>
            <p className="text-xs text-muted-foreground">{[g.bairro, g.cidade].filter(Boolean).join(" · ")}{g.cidade || g.bairro ? " · " : ""}{g.membros} participante{g.membros === 1 ? "" : "s"}</p>
            {g.descricao && <p className="line-clamp-3 text-sm">{g.descricao}</p>}
            <div className="mt-auto flex gap-2 pt-1">
              {g.sou_membro ? <Btn v="soft" className="min-h-10" onClick={() => onAbrir(g.id)}>Abrir grupo</Btn> : g.status === "aprovado" && <Btn v="wa" className="min-h-10" onClick={() => entrar(g)}><Plus className="h-4 w-4" /> Participar</Btn>}
            </div>
          </Card></li>
        ))}</ul>}
      {novo ? <SugerirGrupo eu={eu} onFeito={() => { setNovo(false); recarregar(); }} onCancelar={() => setNovo(false)} />
        : <Btn v="outline" className="self-start" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Sugerir um grupo</Btn>}
      <p className="text-xs text-muted-foreground">Grupos “Com profissional” têm moderação de um profissional habilitado, mas continuam sendo apoio mútuo, não sessões de terapia.</p>
    </div>
  );
}

function SugerirGrupo({ eu, onFeito, onCancelar }: { eu: Perfil; onFeito: () => void; onCancelar: () => void }) {
  const [f, setF] = useState({ nome: "", tipo: "bairro", cidade: eu.cidade, bairro: eu.bairro ?? "", descricao: "" });
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-bold">Sugerir grupo</h3>
      <Campo id="sg-n" label="Nome do grupo" obrigatorio><input id="sg-n" className={inputCls} maxLength={80} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Mães atípicas do Jequiezinho" /></Campo>
      <Opcoes nome="Tipo" valores={["Bairro", "Cidade", "Interesse"]} valor={f.tipo === "bairro" ? "Bairro" : f.tipo === "cidade" ? "Cidade" : "Interesse"} onChange={(v) => setF({ ...f, tipo: (v || "Bairro").toLowerCase() })} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label="Cidade" className={inputCls} value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} placeholder="Cidade" />
        {f.tipo === "bairro" && <input aria-label="Bairro" className={inputCls} value={f.bairro} onChange={(e) => setF({ ...f, bairro: e.target.value })} placeholder="Bairro" />}
      </div>
      <Campo id="sg-d" label="Sobre o grupo"><textarea id="sg-d" className={textareaCls} maxLength={800} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
      <div className="flex gap-2">
        <Btn v="wa" onClick={async () => { if (f.nome.trim().length < 3) return toast.error("Dê um nome ao grupo."); const { error } = await db.rpc("rf_sugerir_grupo", { _nome: f.nome, _tipo: f.tipo, _cidade: f.cidade, _bairro: f.bairro, _descricao: f.descricao }); if (error) return toast.error(error.message); toast.success("Grupo enviado para aprovação. Você será a moderadora."); onFeito(); }}>Enviar</Btn>
        <Btn v="ghost" onClick={onCancelar}>Cancelar</Btn>
      </div>
    </Card>
  );
}

function Grupo({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const { data: g, recarregar } = useQuery<GrupoT | null>(async () => ((await db.rpc("rf_grupos_lista")).data ?? []).find((x: GrupoT) => x.id === id) ?? null, [id]);
  const { data: enc, recarregar: recEnc } = useQuery<any[]>(async () => (await db.from("encontros").select("*").eq("grupo_id", id).gte("data", new Date(Date.now() - 864e5).toISOString()).order("data")).data ?? [], [id]);
  const [novoEnc, setNovoEnc] = useState(false);
  if (g === undefined || g === null) return g === null ? <Vazio icon={Users} titulo="Grupo não encontrado"><Btn v="outline" onClick={onVoltar}>Voltar</Btn></Vazio> : <Carregando />;
  async function sair() { if (!confirm("Sair do grupo?")) return; await db.rpc("rf_sair_grupo", { _g: id }); toast.success("Você saiu do grupo."); onVoltar(); }
  async function entrar() { const { error } = await db.rpc("rf_entrar_grupo", { _g: id }); if (error) return toast.error(error.message); recarregar(); }
  return (
    <div className="flex flex-col gap-3">
      <button onClick={onVoltar} className="tap inline-flex w-fit items-center gap-1 font-semibold text-primary"><ChevronLeft className="h-5 w-5" /> Grupos</button>
      <Card className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-1.5"><Chip tom={g.tipo === "nucleo" ? "green" : "blue"}>{TIPO_GRUPO[g.tipo]}</Chip>{g.com_profissional && <Chip tom="amber">Com profissional</Chip>}{g.sou_moderador && <Chip tom="navy">Você modera</Chip>}</div>
        <h2 className="font-display text-xl font-extrabold">{g.nome}</h2>
        <p className="text-sm text-muted-foreground">{[g.bairro, g.cidade].filter(Boolean).join(" · ")} · {g.membros} participantes</p>
        {g.descricao && <p className="text-sm">{g.descricao}</p>}
        {g.sou_membro ? <button onClick={sair} className="mt-1 w-fit text-sm font-semibold text-muted-foreground underline">Sair do grupo</button> : g.status === "aprovado" && <Btn v="wa" className="mt-1 self-start" onClick={entrar}>Participar</Btn>}
      </Card>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold">Encontros do grupo</h3>{g.sou_moderador && !novoEnc && <Btn v="soft" className="min-h-10" onClick={() => setNovoEnc(true)}><Plus className="h-4 w-4" /> Marcar encontro</Btn>}</div>
        {novoEnc && <NovoEncontro grupo={id} onFeito={() => { setNovoEnc(false); recEnc(); }} onCancelar={() => setNovoEnc(false)} />}
        {(enc ?? []).length ? enc!.map((e) => (
          <Card key={e.id} className="flex flex-col gap-1 p-4"><Chip tom="coral" className="w-fit"><CalendarDays className="h-3.5 w-3.5" /> {fDataHora(e.data)}</Chip><b className="text-navy">{e.titulo}</b>{e.local && <span className="text-sm text-muted-foreground">{e.local}</span>}{e.descricao && <p className="text-sm">{e.descricao}</p>}</Card>
        )) : <p className="text-sm text-muted-foreground">Nenhum encontro marcado.</p>}
      </section>
      {g.sou_membro || g.sou_moderador ? <Feed grupo={id} /> : <Aviso>Participe do grupo para ver e publicar no mural.</Aviso>}
    </div>
  );
}

function NovoEncontro({ grupo, onFeito, onCancelar }: { grupo: string; onFeito: () => void; onCancelar: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState({ titulo: "", data: "", local: "", descricao: "" });
  return (
    <Card className="flex flex-col gap-2 p-4">
      <input aria-label="Título" className={inputCls} placeholder="Roda de conversa, piquenique…" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
      <input aria-label="Data e hora" type="datetime-local" className={inputCls} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
      <input aria-label="Local" className={inputCls} placeholder="Local público ou link" value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} />
      <textarea aria-label="Descrição" className={cn(textareaCls, "min-h-20")} placeholder="Detalhes" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
      <div className="flex gap-2">
        <Btn v="wa" className="min-h-10" onClick={async () => { if (!f.titulo.trim() || !f.data) return toast.error("Informe título e data."); const { error } = await db.from("encontros").insert({ grupo_id: grupo, criado_por: user!.id, titulo: f.titulo.trim(), data: new Date(f.data).toISOString(), local: f.local || null, descricao: f.descricao || null }); if (error) return toast.error(error.message); toast.success("Encontro marcado."); onFeito(); }}>Salvar</Btn>
        <Btn v="ghost" className="min-h-10" onClick={onCancelar}>Cancelar</Btn>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Mural (geral ou do grupo)
type Post = { id: string; tipo: string; texto: string; anonimo: boolean; autor: string; meu: boolean; created_at: string; comentarios: { id: string; texto: string; autor: string; meu: boolean; created_at: string }[]; posso_moderar: boolean };
function Feed({ grupo }: { grupo: string | null }) {
  const { data, loading, recarregar } = useQuery<Post[]>(async () => { const { data, error } = await db.rpc("rf_feed", { _grupo: grupo, _limite: 50 }); if (error) throw error; return data ?? []; }, [grupo]);
  const [texto, setTexto] = useState(""); const [tipo, setTipo] = useState("relato"); const [anon, setAnon] = useState(false);
  const [den, setDen] = useState<[string, string] | null>(null);
  async function publicar() {
    if (texto.trim().length < 3) return toast.error("Escreva sua publicação.");
    const { error } = await db.rpc("rf_publicar", { _grupo: grupo, _tipo: tipo, _texto: texto, _anonimo: anon });
    if (error) return toast.error(error.message); setTexto(""); setAnon(false); toast.success("Publicado."); recarregar();
  }
  async function ocultar(t: string, id: string) { if (!confirm("Remover esta publicação do mural?")) return; await db.rpc("rf_ocultar", { _tipo: t, _id: id }); recarregar(); }
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-bold">{grupo ? "Mural do grupo" : "Mural da rede"}</h3>
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex gap-1.5">{TIPOS_POST.map(([k, l]) => <button key={k} onClick={() => setTipo(k)} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", tipo === k ? "border-success bg-success-soft text-success" : "border-border")}>{l}</button>)}</div>
        <label htmlFor={"rf-post-" + (grupo ?? "g")} className="sr-only">Publicação</label>
        <textarea id={"rf-post-" + (grupo ?? "g")} className={cn(textareaCls, "min-h-20")} maxLength={3000} placeholder={tipo === "pergunta" ? "Pergunte para outras famílias…" : "Compartilhe uma experiência ou uma dica…"} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={anon} onChange={(e) => setAnon(e.target.checked)} /><EyeOff className="h-4 w-4" /> Publicar como anônimo</label>
          <span className="flex-1" /><Btn v="wa" className="min-h-10" onClick={publicar}><Send className="h-4 w-4" /> Publicar</Btn>
        </div>
        {anon && <p className="text-xs text-muted-foreground">Outras famílias e moderadores do grupo não veem seu nome. A equipe do AMPARO pode ver, só para moderação.</p>}
      </Card>
      {loading ? <Carregando /> : !data?.length ? <p className="text-sm text-muted-foreground">Ninguém publicou ainda. Que tal começar?</p> : data.map((p) => (
        <PostCard key={p.id} p={p} onRecarregar={recarregar} onDenunciar={(t, id) => setDen([t, id])} onOcultar={ocultar} />
      ))}
      {den && <Denunciar tipo={den[0]} id={den[1]} onFechar={() => setDen(null)} />}
    </section>
  );
}

function PostCard({ p, onRecarregar, onDenunciar, onOcultar }: { p: Post; onRecarregar: () => void; onDenunciar: (t: string, id: string) => void; onOcultar: (t: string, id: string) => void }) {
  const [resp, setResp] = useState(""); const [anon, setAnon] = useState(false); const [aberto, setAberto] = useState(false);
  async function comentar() { if (!resp.trim()) return; const { error } = await db.rpc("rf_comentar", { _post: p.id, _texto: resp, _anonimo: anon }); if (error) return toast.error(error.message); setResp(""); onRecarregar(); }
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm"><b className="text-navy">{p.autor}</b><Chip tom={p.tipo === "pergunta" ? "blue" : p.tipo === "dica" ? "amber" : "green"}>{TIPOS_POST.find((t) => t[0] === p.tipo)?.[1] ?? p.tipo}</Chip><span className="text-xs text-muted-foreground">{fDataHora(p.created_at)}</span>
        <span className="flex-1" />
        {(p.meu || p.posso_moderar) && <button onClick={() => onOcultar("post", p.id)} className="text-xs font-semibold text-muted-foreground underline">remover</button>}
        {!p.meu && <button onClick={() => onDenunciar("post", p.id)} aria-label="Denunciar publicação" className="text-muted-foreground hover:text-emergency"><Flag className="h-4 w-4" /></button>}
      </div>
      <p className="whitespace-pre-line">{p.texto}</p>
      {p.comentarios.length > 0 && <div className="flex flex-col gap-1.5 border-l-2 border-border pl-3">{p.comentarios.map((c) => (
        <div key={c.id} className="text-sm"><b className="text-navy">{c.autor}</b> <span className="text-xs text-muted-foreground">{fDataHora(c.created_at)}</span>
          {(c.meu || p.posso_moderar) && <button onClick={() => onOcultar("comentario", c.id)} className="ml-2 text-xs text-muted-foreground underline">remover</button>}
          {!c.meu && <button onClick={() => onDenunciar("comentario", c.id)} className="ml-2 text-xs text-muted-foreground underline">denunciar</button>}
          <p className="whitespace-pre-line">{c.texto}</p></div>
      ))}</div>}
      {aberto ? (
        <div className="flex flex-col gap-2">
          <textarea aria-label="Responder" className={cn(textareaCls, "min-h-16")} maxLength={1500} value={resp} onChange={(e) => setResp(e.target.value)} placeholder="Escreva com acolhimento…" />
          <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> anônimo</label><span className="flex-1" /><Btn v="soft" className="min-h-10" onClick={comentar}>Responder</Btn></div>
        </div>
      ) : <button onClick={() => setAberto(true)} className={cn(btn.base, btn.ghost, "min-h-10 self-start px-3 text-sm")}><MessageCircle className="h-4 w-4" /> Responder</button>}
    </Card>
  );
}
