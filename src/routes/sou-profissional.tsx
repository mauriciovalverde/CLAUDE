import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, PageHeader, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/dados";
import { CATEGORIAS_DIRETORIO, UFS, digits, emailValido, fmtTel } from "@/lib/br";

export const Route = createFileRoute("/sou-profissional")({ component: () => <AppShell><SouProf /></AppShell> });

const VAZIO = { nome: "", categoria: "psicologos", especialidade: "", registro: "", descricao: "", telefone: "", whatsapp: "", email: "", site: "", endereco: "", cidade: "", uf: "BA", horarios: "", atende_online: false, sus: false, plano: false, particular: true, valor_social: false };

function SouProf() {
  const { user } = useAuth();
  const [f, setF] = useState<any>(VAZIO);
  const [id, setId] = useState<string | null>(null);
  const [validado, setValidado] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    db.from("diretorio").select("*").eq("owner_id", user.id).maybeSingle().then(({ data }: any) => {
      if (data) { setId(data.id); setValidado(data.validado); setF({ ...VAZIO, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ""])), telefone: fmtTel(data.telefone ?? ""), whatsapp: fmtTel(data.whatsapp ?? "") }); }
      else setF((x: any) => ({ ...x, email: user.email ?? "" }));
    });
  }, [user]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.nome.trim().length < 3) er.nome = "Informe o nome profissional.";
    if (!f.registro.trim()) er.registro = "Informe o registro no conselho (CRP, CRFa, CREFITO, CRM…).";
    if (!f.cidade.trim()) er.cidade = "Informe a cidade.";
    if (f.email && !emailValido(f.email)) er.email = "E-mail inválido.";
    setErros(er);
    if (Object.keys(er).length) return;
    let lat = null, lng = null;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent([f.endereco, f.cidade, f.uf, "Brasil"].filter(Boolean).join(", "))}`);
      const j = await r.json();
      if (j[0]) { lat = Number(j[0].lat); lng = Number(j[0].lon); }
    } catch { /* sem mapa */ }
    const dados = { ...f, telefone: digits(f.telefone) || null, whatsapp: digits(f.whatsapp) || null, tipo: "profissional", owner_id: user!.id, lat, lng };
    delete dados.id; delete dados.created_at; delete dados.validado; delete dados.nacional;
    const { error } = id ? await db.from("diretorio").update(dados).eq("id", id) : await db.from("diretorio").insert(dados);
    if (error) return toast.error("Não foi possível salvar: " + error.message);
    toast.success(id ? "Perfil atualizado. Ele volta para validação." : "Perfil enviado! A equipe vai validar seu registro.");
    if (!id) { const { data } = await db.from("diretorio").select("id").eq("owner_id", user!.id).maybeSingle(); setId(data?.id ?? null); }
    setValidado(false);
  }
  const inp = (k: string, extra: any = {}) => ({ id: "p-" + k, className: inputCls, value: f[k] ?? "", onChange: (e: any) => setF({ ...f, [k]: e.target.value }), ...extra });
  const chk = (k: string, l: string) => (
    <label className="tap inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold">
      <input type="checkbox" className="h-5 w-5 accent-[var(--color-primary)]" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {l}
    </label>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Sou" highlight="profissional" subtitle="Cadastre seu perfil para aparecer na busca de especialistas. Ele só fica visível depois que a equipe valida seu registro." back={{ to: "/buscar", label: "Buscar" }} />
      {id && (validado ? <Aviso tom="green"><BadgeCheck className="mr-1 inline h-4 w-4" />Seu perfil está validado e aparece na busca.</Aviso> : <Aviso tom="amber"><Clock className="mr-1 inline h-4 w-4" />Seu perfil está aguardando validação da equipe.</Aviso>)}
      <form onSubmit={salvar} className="card-soft flex flex-col gap-4 p-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="p-nome" label="Nome profissional ou da clínica" obrigatorio erro={erros.nome}><input {...inp("nome")} /></Campo>
          <Campo id="p-categoria" label="Categoria" obrigatorio><select {...inp("categoria")}>{CATEGORIAS_DIRETORIO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
          <Campo id="p-especialidade" label="Especialidade" dica="Ex.: Terapeuta ocupacional, Fonoaudióloga, Clínica multidisciplinar"><input {...inp("especialidade")} /></Campo>
          <Campo id="p-registro" label="Registro profissional" obrigatorio dica="Ex.: CRP 03/12345, CREFITO 123456-F" erro={erros.registro}><input {...inp("registro")} /></Campo>
          <Campo id="p-telefone" label="Telefone"><input {...inp("telefone", { onChange: (e: any) => setF({ ...f, telefone: fmtTel(e.target.value) }) })} /></Campo>
          <Campo id="p-whatsapp" label="WhatsApp"><input {...inp("whatsapp", { onChange: (e: any) => setF({ ...f, whatsapp: fmtTel(e.target.value) }) })} /></Campo>
          <Campo id="p-email" label="E-mail" erro={erros.email}><input {...inp("email", { type: "email" })} /></Campo>
          <Campo id="p-site" label="Site ou Instagram"><input {...inp("site", { type: "url", placeholder: "https://" })} /></Campo>
          <Campo id="p-endereco" label="Endereço" dica="Usado para mostrar no mapa."><input {...inp("endereco")} /></Campo>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Campo id="p-cidade" label="Cidade" obrigatorio erro={erros.cidade}><input {...inp("cidade")} /></Campo>
            <Campo id="p-uf" label="UF" obrigatorio><select {...inp("uf")}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Campo>
          </div>
          <Campo id="p-horarios" label="Horários de atendimento"><input {...inp("horarios", { placeholder: "Seg a sex, 8h às 18h" })} /></Campo>
        </div>
        <Campo id="p-descricao" label="Sobre o atendimento"><textarea {...inp("descricao")} className={textareaCls} maxLength={1000} /></Campo>
        <div className="flex flex-wrap gap-2">{chk("atende_online", "Atende online")}{chk("sus", "SUS / gratuito")}{chk("plano", "Plano de saúde")}{chk("particular", "Particular")}{chk("valor_social", "Valor social")}</div>
        <Btn type="submit" className="self-start">{id ? "Salvar alterações" : "Enviar para validação"}</Btn>
      </form>
    </div>
  );
}
