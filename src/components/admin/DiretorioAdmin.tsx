import { useState } from "react";
import { BadgeCheck, Inbox, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Btn, Campo, Card, Carregando, Chip, Vazio, inputCls, textareaCls } from "@/components/app/kit";
import { db, useQuery } from "@/lib/dados";
import { CATEGORIAS_DIRETORIO, UFS, digits, fData, fmtTel, nomeCategoria } from "@/lib/br";
import { cn } from "@/lib/utils";

const VAZIO = { id: "", nome: "", tipo: "servico", categoria: "psicologos", especialidade: "", registro: "", descricao: "", telefone: "", whatsapp: "", email: "", site: "", endereco: "", cidade: "", uf: "BA", horarios: "", atende_online: false, sus: false, plano: false, particular: false, valor_social: false, nacional: false, validado: true };

export function DiretorioAdmin() {
  const [aba, setAba] = useState<"pendentes" | "validados" | "sugestoes">("pendentes");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<any | null>(null);
  const { data, loading, recarregar } = useQuery<any[]>(async () => (await db.from("diretorio").select("*").order("created_at", { ascending: false })).data ?? [], []);
  const { data: sug, recarregar: recSug } = useQuery<any[]>(async () => (await db.from("sugestoes_diretorio").select("*").order("created_at", { ascending: false })).data ?? [], []);
  const termo = q.trim().toLowerCase();
  const lista = (data ?? []).filter((d) => (aba === "pendentes" ? !d.validado : d.validado) && (!termo || `${d.nome} ${d.cidade} ${d.especialidade}`.toLowerCase().includes(termo)));
  const pendSug = (sug ?? []).filter((s) => s.status === "pendente");

  async function validar(d: any, v: boolean) { await db.from("diretorio").update({ validado: v }).eq("id", d.id); toast.success(v ? "Validado e publicado." : "Retirado da busca."); recarregar(); }
  async function apagar(d: any) { if (!confirm("Apagar " + d.nome + "?")) return; await db.from("diretorio").delete().eq("id", d.id); recarregar(); }
  async function tratarSug(s: any, status: string) { await db.from("sugestoes_diretorio").update({ status }).eq("id", s.id); recSug(); }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {([["pendentes", `Aguardando (${(data ?? []).filter((d) => !d.validado).length})`], ["validados", "Publicados"], ["sugestoes", `Indicações (${pendSug.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setAba(k)} className={cn("tap rounded-full border px-4 text-sm font-semibold", aba === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{l}</button>
        ))}
        <span className="flex-1" />
        <Btn onClick={() => setEdit({ ...VAZIO })}><Plus className="h-4 w-4" /> Novo</Btn>
      </div>
      {aba !== "sugestoes" && <label className="relative"><span className="sr-only">Buscar</span><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input className={cn(inputCls, "pl-12")} placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} /></label>}
      {aba === "sugestoes" ? (
        !pendSug.length ? <Vazio icon={Inbox} titulo="Nenhuma indicação nova" /> : pendSug.map((s) => (
          <Card key={s.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex-1"><b>{s.nome}</b> <Chip>{nomeCategoria(s.categoria)}</Chip><p className="text-sm text-muted-foreground">{[s.cidade && `${s.cidade}/${s.uf}`, s.telefone && fmtTel(s.telefone), fData(s.created_at)].filter(Boolean).join(" · ")}</p>{s.observacao && <p className="text-sm">{s.observacao}</p>}</div>
            <Btn v="soft" className="min-h-10" onClick={() => { setEdit({ ...VAZIO, nome: s.nome, categoria: s.categoria, cidade: s.cidade ?? "", uf: s.uf ?? "BA", telefone: fmtTel(s.telefone ?? ""), descricao: s.observacao ?? "" }); tratarSug(s, "aceita"); }}>Cadastrar</Btn>
            <Btn v="ghost" className="min-h-10" onClick={() => tratarSug(s, "descartada")}>Descartar</Btn>
          </Card>
        ))
      ) : loading ? <Carregando /> : !lista.length ? <Vazio icon={BadgeCheck} titulo="Nada por aqui" /> : lista.map((d) => (
        <Card key={d.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><b className="text-navy">{d.nome}</b><Chip>{nomeCategoria(d.categoria)}</Chip>{d.owner_id && <Chip tom="coral">Autocadastro</Chip>}</div>
            <p className="text-sm text-muted-foreground">{[d.especialidade, d.registro, d.nacional ? "Nacional" : d.cidade && `${d.cidade}/${d.uf}`].filter(Boolean).join(" · ")}</p>
          </div>
          {d.validado ? <Btn v="outline" className="min-h-10" onClick={() => validar(d, false)}>Despublicar</Btn> : <Btn v="wa" className="min-h-10" onClick={() => validar(d, true)}><BadgeCheck className="h-4 w-4" /> Validar</Btn>}
          <Btn v="ghost" className="min-h-10" onClick={() => setEdit({ ...VAZIO, ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v ?? ""])), telefone: fmtTel(d.telefone ?? ""), whatsapp: fmtTel(d.whatsapp ?? "") })}>Editar</Btn>
          <button onClick={() => apagar(d)} className="tap grid place-items-center text-muted-foreground hover:text-emergency" aria-label="Apagar"><Trash2 className="h-4 w-4" /></button>
        </Card>
      ))}
      {edit && <Editor item={edit} onFechar={() => setEdit(null)} onSalvo={() => { setEdit(null); recarregar(); }} />}
    </div>
  );
}

function Editor({ item, onFechar, onSalvo }: { item: any; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState<any>(item);
  async function salvar() {
    if (f.nome.trim().length < 3) return toast.error("Informe o nome.");
    let { lat, lng } = f;
    if (!f.nacional && (f.endereco || f.cidade) && (!lat || f.endereco !== item.endereco || f.cidade !== item.cidade)) {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent([f.endereco, f.cidade, f.uf, "Brasil"].filter(Boolean).join(", "))}`);
        const j = await r.json(); if (j[0]) { lat = Number(j[0].lat); lng = Number(j[0].lon); }
      } catch { /* sem mapa */ }
    }
    const dados: any = { ...f, telefone: digits(f.telefone) || null, whatsapp: digits(f.whatsapp) || null, lat: lat || null, lng: lng || null };
    ["id", "created_at", "owner_id"].forEach((k) => delete dados[k]);
    Object.keys(dados).forEach((k) => { if (dados[k] === "") dados[k] = null; });
    const { error } = f.id ? await db.from("diretorio").update(dados).eq("id", f.id) : await db.from("diretorio").insert(dados);
    if (error) return toast.error(error.message);
    toast.success("Salvo."); onSalvo();
  }
  const inp = (k: string, extra: any = {}) => ({ id: "d-" + k, className: inputCls, value: f[k] ?? "", onChange: (e: any) => setF({ ...f, [k]: e.target.value }), ...extra });
  const chk = (k: string, l: string) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{l}</label>;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onFechar} role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">{f.id ? "Editar" : "Novo"} item do diretório</h2><button onClick={onFechar} className="tap grid place-items-center" aria-label="Fechar"><X /></button></div>
        <div className="flex flex-col gap-3">
          <Campo id="d-nome" label="Nome" obrigatorio><input {...inp("nome")} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="d-tipo" label="Tipo" obrigatorio><select {...inp("tipo")}><option value="servico">Serviço / instituição</option><option value="profissional">Profissional</option></select></Campo>
            <Campo id="d-categoria" label="Categoria" obrigatorio><select {...inp("categoria")}>{CATEGORIAS_DIRETORIO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
            <Campo id="d-especialidade" label="Especialidade"><input {...inp("especialidade")} /></Campo>
            <Campo id="d-registro" label="Registro"><input {...inp("registro")} /></Campo>
            <Campo id="d-telefone" label="Telefone"><input {...inp("telefone", { onChange: (e: any) => setF({ ...f, telefone: e.target.value.length > 4 ? fmtTel(e.target.value) : e.target.value }) })} /></Campo>
            <Campo id="d-whatsapp" label="WhatsApp"><input {...inp("whatsapp", { onChange: (e: any) => setF({ ...f, whatsapp: fmtTel(e.target.value) }) })} /></Campo>
            <Campo id="d-email" label="E-mail"><input {...inp("email")} /></Campo>
            <Campo id="d-site" label="Site"><input {...inp("site")} /></Campo>
          </div>
          <Campo id="d-endereco" label="Endereço"><input {...inp("endereco")} /></Campo>
          <div className="grid grid-cols-[1fr_6rem] gap-3"><Campo id="d-cidade" label="Cidade"><input {...inp("cidade")} /></Campo><Campo id="d-uf" label="UF"><select {...inp("uf")}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Campo></div>
          <Campo id="d-horarios" label="Horários"><input {...inp("horarios")} /></Campo>
          <Campo id="d-descricao" label="Descrição"><textarea {...inp("descricao")} className={textareaCls} /></Campo>
          <div className="grid grid-cols-2 gap-2">{chk("atende_online", "Atende online")}{chk("sus", "SUS / gratuito")}{chk("plano", "Plano")}{chk("particular", "Particular")}{chk("valor_social", "Valor social")}{chk("nacional", "Atende todo o Brasil")}{chk("validado", "Publicado")}</div>
          <div className="flex gap-2"><Btn onClick={salvar}>Salvar</Btn><Btn v="ghost" onClick={onFechar}>Cancelar</Btn></div>
        </div>
      </div>
    </div>
  );
}
