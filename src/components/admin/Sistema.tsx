import { useEffect, useState } from "react";
import { FileClock, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Aviso, Btn, Campo, Card, Carregando, Chip, Vazio, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth, type Papel } from "@/lib/auth";
import { db, useQuery } from "@/lib/dados";
import { digits, fDataHora, fmtTel } from "@/lib/br";
import { cn } from "@/lib/utils";

const PAPEIS: [Papel, string][] = [["admin", "Administração"], ["equipe", "Equipe"], ["profissional", "Profissional"], ["familia", "Família"]];

export function Usuarios() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const { data, loading, recarregar } = useQuery(async () => {
    const [p, r] = await Promise.all([db.from("perfis").select("*").order("created_at", { ascending: false }).limit(1000), db.from("user_roles").select("user_id,role")]);
    return { perfis: (p.data ?? []) as any[], roles: (r.data ?? []) as { user_id: string; role: Papel }[] };
  }, []);
  async function alternar(uid: string, role: Papel, tem: boolean) {
    if (uid === user!.id && role === "admin" && tem) return toast.error("Você não pode remover o seu próprio acesso de administração.");
    const { error } = tem ? await db.from("user_roles").delete().eq("user_id", uid).eq("role", role) : await db.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    await db.rpc("registrar_log", { _acao: tem ? "papel_removido" : "papel_concedido", _alvo: uid, _detalhes: role });
    recarregar();
  }
  const termo = q.trim().toLowerCase();
  const lista = (data?.perfis ?? []).filter((p) => !termo || `${p.nome_chamada} ${p.email} ${p.telefone}`.toLowerCase().includes(termo));
  return (
    <div className="flex flex-col gap-3">
      <Aviso tom="blue">Administração: acesso total (CPF completo, saúde, conteúdos, configurações). Equipe: confirma cadastros, faz disparos e modera diretório e histórias, com CPF mascarado.</Aviso>
      <label className="relative"><span className="sr-only">Buscar usuário</span><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input className={cn(inputCls, "pl-12")} placeholder="Buscar por nome, e-mail ou telefone" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {loading ? <Carregando /> : lista.map((p) => {
        const papeis = (data?.roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
        return (
          <Card key={p.id} className="flex flex-col gap-2 p-4">
            <div><b>{p.nome_chamada || "—"}</b> <span className="text-sm text-muted-foreground">{p.email}{p.telefone ? ` · ${fmtTel(p.telefone)}` : ""}</span></div>
            <div className="flex flex-wrap gap-2">
              {PAPEIS.map(([k, l]) => {
                const tem = papeis.includes(k);
                return <button key={k} onClick={() => alternar(p.id, k, tem)} className={cn("tap rounded-full border px-3 text-xs font-semibold", tem ? "border-primary bg-primary text-white" : "border-border bg-card text-navy")}>{tem ? "✓ " : "+ "}{l}</button>;
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function Configuracoes() {
  const [c, setC] = useState<Record<string, string>>({});
  useEffect(() => { db.from("configuracoes").select("chave,valor").then(({ data }: any) => setC(Object.fromEntries((data ?? []).map((r: any) => [r.chave, r.valor ?? ""])))); }, []);
  async function salvar() {
    const linhas = [
      { chave: "numero_confirmacao", valor: digits(c.numero_confirmacao), publico: true },
      { chave: "mensagem_confirmacao", valor: c.mensagem_confirmacao, publico: true },
      { chave: "whatsapp_grupo", valor: c.whatsapp_grupo?.trim() ?? "", publico: true },
      { chave: "regras_convivencia", valor: c.regras_convivencia, publico: true },
    ];
    if (c.whatsapp_grupo && !/^https:\/\/(chat\.whatsapp\.com|wa\.me)\//.test(c.whatsapp_grupo.trim())) return toast.error("O link do grupo deve começar com https://chat.whatsapp.com/");
    const { error } = await db.from("configuracoes").upsert(linhas);
    if (error) return toast.error(error.message);
    await db.rpc("registrar_log", { _acao: "configuracoes", _alvo: "geral" });
    toast.success("Configurações salvas.");
  }
  const inp = (k: string) => ({ id: "cf-" + k, className: inputCls, value: c[k] ?? "", onChange: (e: any) => setC({ ...c, [k]: e.target.value }) });
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck className="h-5 w-5 text-primary" /> Configurações gerais</h2>
      <Campo id="cf-numero_confirmacao" label="WhatsApp que recebe as confirmações de cadastro" obrigatorio dica="Com DDI e DDD. Ex.: 5573933002471"><input {...inp("numero_confirmacao")} inputMode="numeric" /></Campo>
      <Campo id="cf-mensagem_confirmacao" label="Mensagem pronta da confirmação" obrigatorio><input {...inp("mensagem_confirmacao")} /></Campo>
      <Campo id="cf-whatsapp_grupo" label="Link do grupo de apoio no WhatsApp" dica="Só aparece para famílias com cadastro confirmado."><input {...inp("whatsapp_grupo")} placeholder="https://chat.whatsapp.com/…" /></Campo>
      <Campo id="cf-regras_convivencia" label="Regras de convivência do grupo" dica="Uma regra por linha."><textarea {...inp("regras_convivencia")} className={textareaCls + " min-h-40"} /></Campo>
      <Btn onClick={salvar} className="self-start">Salvar</Btn>
    </Card>
  );
}

const ACOES: Record<string, string> = { abrir_ficha: "Abriu ficha", familia_status: "Mudou status do cadastro", comunicado_enviado: "Enviou comunicado", papel_concedido: "Concedeu papel", papel_removido: "Removeu papel", configuracoes: "Alterou configurações" };

export function Logs() {
  const { data, loading } = useQuery(async () => {
    const [l, p] = await Promise.all([db.from("logs_admin").select("*").order("created_at", { ascending: false }).limit(300), db.from("perfis").select("id,nome_chamada,email")]);
    return { logs: (l.data ?? []) as any[], perfis: (p.data ?? []) as any[] };
  }, []);
  if (loading) return <Carregando />;
  if (!data?.logs.length) return <Vazio icon={FileClock} titulo="Nenhum registro ainda" />;
  const autor = (id: string) => { const p = data.perfis.find((x) => x.id === id); return p?.nome_chamada || p?.email || "—"; };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">Registro de acessos a dados pessoais e ações administrativas (LGPD).</p>
      {data.logs.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
          <span className="w-36 text-xs text-muted-foreground">{fDataHora(l.created_at)}</span>
          <Chip>{ACOES[l.acao] ?? l.acao}</Chip>
          <span className="flex-1">{l.alvo}{l.detalhes ? ` · ${l.detalhes}` : ""}</span>
          <span className="text-xs font-semibold">{autor(l.autor_id)}</span>
        </div>
      ))}
    </div>
  );
}
