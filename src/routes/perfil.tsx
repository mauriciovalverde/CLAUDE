import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, BriefcaseMedical, Download, FileText, LogOut, Pencil, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Btn, Campo, Card, CardLink, Chip, PageHeader, inputCls } from "@/components/app/kit";
import { nomeExibicao, useAuth } from "@/lib/auth";
import { db, useFilhos } from "@/lib/dados";
import { baixarArquivo, digits, fmtTel, idade } from "@/lib/br";

export const Route = createFileRoute("/perfil")({ component: () => <AppShell><Perfil /></AppShell> });

const PREFS: [string, string][] = [
  ["lembretes", "Lembretes da minha rotina"], ["comunicados", "Comunicados do Centro"], ["encontros", "Encontros e rodas de conversa"],
  ["eventos", "Eventos e campanhas"], ["videos", "Novos vídeos"], ["orientacoes", "Novas orientações"], ["direitos", "Direitos e benefícios"], ["servicos", "Novos serviços no diretório"],
];
const STATUS: Record<string, [string, string]> = { pendente: ["Aguardando confirmação", "amber"], aprovado: ["Cadastro confirmado", "green"], recusado: ["Cadastro não confirmado", "red"] };

function Perfil() {
  const { user, perfil, familia, papeis, isStaff, refresh, sair } = useAuth();
  const nav = useNavigate();
  const { data: filhos } = useFilhos(familia?.id);
  const [p, setP] = useState({ nome_chamada: "", telefone: "" });
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => { setP({ nome_chamada: perfil?.nome_chamada ?? "", telefone: fmtTel(perfil?.telefone ?? "") }); }, [perfil]);
  useEffect(() => {
    if (!user) return;
    db.from("preferencias_notificacao").select("*").eq("user_id", user.id).maybeSingle().then(({ data }: any) => {
      setPrefs(Object.fromEntries(PREFS.map(([k]) => [k, data ? data[k] !== false : true])));
    });
  }, [user]);

  async function salvarPerfil() {
    const { error } = await db.from("perfis").update({ nome_chamada: p.nome_chamada.trim() || null, telefone: digits(p.telefone) || null }).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Dados salvos."); refresh();
  }
  async function trocarPref(k: string, v: boolean) {
    const novo = { ...prefs, [k]: v }; setPrefs(novo);
    await db.from("preferencias_notificacao").upsert({ user_id: user!.id, ...novo, updated_at: new Date().toISOString() });
  }
  async function exportar() {
    const fid = familia?.id;
    const [fam, fi, sa, di, ag, me, co] = await Promise.all([
      fid ? db.from("familias").select("*").eq("id", fid).maybeSingle() : { data: null },
      fid ? db.from("filhos").select("*").eq("familia_id", fid) : { data: [] },
      fid ? db.from("filhos_saude").select("*").eq("familia_id", fid) : { data: [] },
      fid ? db.from("diario_registros").select("*").eq("familia_id", fid) : { data: [] },
      fid ? db.from("agenda").select("*").eq("familia_id", fid) : { data: [] },
      fid ? db.from("medicamentos").select("*").eq("familia_id", fid) : { data: [] },
      db.from("consentimentos").select("*").eq("user_id", user!.id),
    ]);
    const json = JSON.stringify({ exportado_em: new Date().toISOString(), perfil, familia: fam.data, filhos: fi.data, saude: sa.data, diario: di.data, agenda: ag.data, medicamentos: me.data, consentimentos: co.data }, null, 2);
    baixarArquivo("meus-dados-centro-acolhimento.json", json, "application/json");
    toast.success("Arquivo com seus dados baixado.");
  }
  async function excluir() {
    const ok = prompt('Isso apaga sua conta e todos os dados da família, sem volta. Para confirmar, digite EXCLUIR');
    if (ok !== "EXCLUIR") return;
    const { error } = await db.rpc("excluir_minha_conta");
    if (error) return toast.error("Não foi possível excluir: " + error.message);
    await sair(); toast.success("Conta excluída."); nav({ to: "/" });
  }
  const st = familia ? STATUS[familia.status] : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Meu" highlight="perfil" />
      <Card className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary"><UserRound className="h-8 w-8" /></span>
        <div className="flex-1">
          <p className="font-display text-xl font-bold">{nomeExibicao(perfil, user)}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {st && <Chip tom={st[1]}>{st[0]} · {familia?.numero}</Chip>}
            {papeis.filter((x) => x !== "familia").map((x) => <Chip key={x} tom="blue">{x}</Chip>)}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Dados de acesso</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="pf-nome" label="Como prefere ser chamada"><input id="pf-nome" className={inputCls} value={p.nome_chamada} onChange={(e) => setP({ ...p, nome_chamada: e.target.value })} /></Campo>
          <Campo id="pf-tel" label="Celular"><input id="pf-tel" className={inputCls} value={p.telefone} onChange={(e) => setP({ ...p, telefone: fmtTel(e.target.value) })} /></Campo>
        </div>
        <div className="flex flex-wrap gap-2"><Btn onClick={salvarPerfil}>Salvar</Btn><Link to="/redefinir-senha" className="tap inline-flex items-center rounded-full px-4 font-semibold text-primary">Trocar senha</Link></div>
      </Card>

      {familia ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Minha família</h2><Link to="/completar-cadastro" className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><Pencil className="h-4 w-4" /> Editar cadastro</Link></div>
          <p className="text-sm"><b>{familia.mae_nome}</b>{familia.cidade ? ` · ${familia.cidade}/${familia.uf}` : ""}</p>
          <ul className="flex flex-col gap-1 text-sm">{(filhos ?? []).map((f) => <li key={f.id}>👶 {f.nome}{f.nascimento ? ` · ${idade(f.nascimento)}` : ""}</li>)}</ul>
        </Card>
      ) : !isStaff && <CardLink to="/completar-cadastro" icon={Pencil} title="Completar cadastro da família" subtitle="Necessário para usar o diário e a rotina" />}

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Bell className="h-5 w-5 text-primary" /> Quais avisos quero receber</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PREFS.map(([k, l]) => (
            <label key={k} className="tap flex items-center justify-between gap-3 rounded-xl bg-muted px-4 text-sm font-semibold">
              {l}<input type="checkbox" className="h-5 w-5 accent-[var(--color-primary)]" checked={!!prefs[k]} onChange={(e) => trocarPref(k, e.target.checked)} />
            </label>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <CardLink to="/sou-profissional" icon={BriefcaseMedical} tom="green" title="Sou profissional" subtitle="Cadastre seu perfil no diretório de especialistas" />
        <CardLink to="/privacidade" icon={ShieldCheck} tom="navy" title="Privacidade e LGPD" subtitle="Como seus dados são usados e protegidos" />
        <CardLink to="/termos" icon={FileText} tom="navy" title="Termos de uso" />
        <CardLink onClick={exportar} icon={Download} tom="blue" title="Baixar meus dados" subtitle="Cópia de tudo o que você registrou (LGPD, art. 18)" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Btn v="outline" onClick={async () => { await sair(); nav({ to: "/" }); }}><LogOut className="h-4 w-4" /> Sair</Btn>
        <Btn v="ghost" className="text-emergency" onClick={excluir}><Trash2 className="h-4 w-4" /> Excluir minha conta</Btn>
      </div>
    </div>
  );
}
