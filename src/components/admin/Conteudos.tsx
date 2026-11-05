import { useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Download, Pencil, PlayCircle, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Aviso, Btn, Campo, Card, Carregando, Chip, Vazio, inputCls, textareaCls } from "@/components/app/kit";
import { BIBLIOTECA_PADRAO, SECOES_PADRAO } from "@/lib/conteudo-padrao";
import { db, separarCategoria, useQuery } from "@/lib/dados";
import { cn } from "@/lib/utils";

export function Conteudos() {
  const [aba, setAba] = useState<"secoes" | "biblioteca">("secoes");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">{([["secoes", "Seções e tópicos"], ["biblioteca", "Biblioteca"]] as const).map(([k, l]) => <button key={k} onClick={() => setAba(k)} className={cn("tap rounded-full border px-4 text-sm font-semibold", aba === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{l}</button>)}</div>
      {aba === "secoes" ? <Secoes /> : <BibliotecaAdmin />}
    </div>
  );
}

async function carregarPadrao(substituir: boolean) {
  for (const s of SECOES_PADRAO) {
    const { data: ex } = await db.from("secoes").select("id").eq("slug", s.slug).maybeSingle();
    if (ex && !substituir) continue;
    let id = ex?.id;
    if (ex) { await db.from("topicos").delete().eq("secao_id", ex.id); await db.from("secoes").update({ titulo: s.titulo, descricao: s.descricao, icone: s.icone, ordem: s.ordem, aviso: s.aviso }).eq("id", ex.id); }
    else { const { data, error } = await db.from("secoes").insert({ slug: s.slug, titulo: s.titulo, descricao: s.descricao, icone: s.icone, ordem: s.ordem, aviso: s.aviso }).select("id").single(); if (error) throw error; id = data.id; }
    const { error } = await db.from("topicos").insert(s.topicos.map((t) => ({ ...t, secao_id: id })));
    if (error) throw error;
  }
  const { count } = await db.from("biblioteca").select("id", { count: "exact", head: true });
  if (!count) await db.from("biblioteca").insert(BIBLIOTECA_PADRAO);
}

function Secoes() {
  const { data, loading, recarregar } = useQuery<any[]>(async () => (await db.from("secoes").select("*, topicos(count)").order("ordem")).data ?? [], []);
  const [aberta, setAberta] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);
  async function padrao(substituir: boolean) {
    if (substituir && !confirm("Isso substitui os tópicos das seções padrão pelo conteúdo original. Continuar?")) return;
    setCarregando(true);
    try { await carregarPadrao(substituir); toast.success("Conteúdo padrão carregado."); recarregar(); } catch (e: any) { toast.error(e.message); }
    setCarregando(false);
  }
  if (loading) return <Carregando />;
  if (aberta) return <Topicos secao={aberta} onVoltar={() => { setAberta(null); recarregar(); }} />;
  const faltam = SECOES_PADRAO.filter((s) => !(data ?? []).some((d) => d.slug === s.slug)).length;
  return (
    <div className="flex flex-col gap-3">
      {faltam > 0 && (
        <Aviso tom="blue">
          <p>{data?.length ? `${faltam} seção(ões) padrão ainda não estão no banco.` : "O app está mostrando o conteúdo padrão embutido."} Carregue para poder editar.</p>
          <Btn className="mt-2" disabled={carregando} onClick={() => padrao(false)}><Download className="h-4 w-4" /> {carregando ? "Carregando…" : "Carregar conteúdo padrão"}</Btn>
        </Aviso>
      )}
      {(data ?? []).map((s) => (
        <Card key={s.id} className="flex items-center gap-3 p-4">
          <BookOpen className="h-6 w-6 text-primary" />
          <div className="flex-1"><b>{s.titulo}</b><p className="text-sm text-muted-foreground">/{s.slug} · {s.topicos?.[0]?.count ?? 0} tópicos</p></div>
          <Btn v="soft" className="min-h-10" onClick={() => setAberta(s)}><Pencil className="h-4 w-4" /> Editar</Btn>
        </Card>
      ))}
      {!!data?.length && <Btn v="ghost" className="self-start text-sm" onClick={() => padrao(true)}>Restaurar conteúdo padrão</Btn>}
    </div>
  );
}

function Topicos({ secao, onVoltar }: { secao: any; onVoltar: () => void }) {
  const [s, setS] = useState({ titulo: secao.titulo, descricao: secao.descricao ?? "", aviso: secao.aviso ?? "" });
  const { data, recarregar } = useQuery<any[]>(async () => (await db.from("topicos").select("*").eq("secao_id", secao.id).order("ordem")).data ?? [], [secao.id]);
  const [edit, setEdit] = useState<any | null>(null);
  async function salvarSecao() { const { error } = await db.from("secoes").update({ titulo: s.titulo, descricao: s.descricao || null, aviso: s.aviso || null }).eq("id", secao.id); error ? toast.error(error.message) : toast.success("Seção salva."); }
  async function mover(i: number, d: number) {
    const l = [...(data ?? [])]; const j = i + d; if (j < 0 || j >= l.length) return;
    await Promise.all([db.from("topicos").update({ ordem: j }).eq("id", l[i].id), db.from("topicos").update({ ordem: i }).eq("id", l[j].id)]);
    recarregar();
  }
  async function apagar(t: any) { if (confirm("Apagar tópico?")) { await db.from("topicos").delete().eq("id", t.id); recarregar(); } }
  return (
    <div className="flex flex-col gap-3">
      <button onClick={onVoltar} className="tap w-fit text-sm font-semibold text-primary">← Seções</button>
      <Card className="flex flex-col gap-3">
        <Campo id="s-t" label="Título da seção" obrigatorio><input id="s-t" className={inputCls} value={s.titulo} onChange={(e) => setS({ ...s, titulo: e.target.value })} /></Campo>
        <Campo id="s-d" label="Descrição"><textarea id="s-d" className={textareaCls} value={s.descricao} onChange={(e) => setS({ ...s, descricao: e.target.value })} /></Campo>
        <Campo id="s-a" label="Aviso de rodapé"><textarea id="s-a" className={textareaCls} value={s.aviso} onChange={(e) => setS({ ...s, aviso: e.target.value })} /></Campo>
        <Btn onClick={salvarSecao} className="self-start">Salvar seção</Btn>
      </Card>
      <div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold">Botões (tópicos)</h3><Btn onClick={() => setEdit({ titulo: "", conteudo: "", video_url: "", fontes: [], ordem: data?.length ?? 0 })}><Plus className="h-4 w-4" /> Novo tópico</Btn></div>
      {(data ?? []).map((t, i) => {
        const { cat, titulo } = separarCategoria(t.titulo);
        return (
          <Card key={t.id} className="flex items-center gap-2 p-3">
            <div className="flex flex-col"><button onClick={() => mover(i, -1)} aria-label="Subir" className="p-1"><ArrowUp className="h-4 w-4" /></button><button onClick={() => mover(i, 1)} aria-label="Descer" className="p-1"><ArrowDown className="h-4 w-4" /></button></div>
            <div className="min-w-0 flex-1">{cat && <Chip className="mr-1">{cat}</Chip>}<b>{titulo}</b>{t.video_url && <PlayCircle className="ml-1 inline h-4 w-4 text-coral" />}</div>
            <Btn v="ghost" className="min-h-10" onClick={() => setEdit(t)}>Editar</Btn>
            <button onClick={() => apagar(t)} className="tap grid place-items-center text-muted-foreground hover:text-emergency" aria-label="Apagar"><Trash2 className="h-4 w-4" /></button>
          </Card>
        );
      })}
      {edit && <EditorTopico t={edit} secaoId={secao.id} onFechar={() => setEdit(null)} onSalvo={() => { setEdit(null); recarregar(); }} />}
    </div>
  );
}

function EditorTopico({ t, secaoId, onFechar, onSalvo }: { t: any; secaoId: string; onFechar: () => void; onSalvo: () => void }) {
  const sep = separarCategoria(t.titulo ?? "");
  const [f, setF] = useState({ cat: sep.cat ?? "", titulo: sep.titulo, conteudo: t.conteudo ?? "", video_url: t.video_url ?? "", fontes: (t.fontes ?? []).map((x: any) => `${x.nome} | ${x.url}`).join("\n") });
  async function salvar() {
    if (!f.titulo.trim() || !f.conteudo.trim()) return toast.error("Título e texto são obrigatórios.");
    const fontes = f.fontes.split("\n").map((l: string) => l.split("|").map((x: string) => x.trim())).filter(([n, u]: string[]) => n && u && /^https?:\/\//.test(u)).map(([nome, url]: string[]) => ({ nome, url }));
    const dados = { secao_id: secaoId, titulo: (f.cat.trim() ? `[${f.cat.trim()}] ` : "") + f.titulo.trim(), conteudo: f.conteudo.trim(), video_url: f.video_url.trim() || null, fontes, ordem: t.ordem ?? 0 };
    const { error } = t.id ? await db.from("topicos").update(dados).eq("id", t.id) : await db.from("topicos").insert(dados);
    if (error) return toast.error(error.message);
    toast.success("Tópico salvo."); onSalvo();
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onFechar} role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">{t.id ? "Editar" : "Novo"} tópico</h2><button onClick={onFechar} className="tap grid place-items-center" aria-label="Fechar"><X /></button></div>
        <div className="flex flex-col gap-3">
          <Campo id="t-c" label="Categoria" dica="Agrupa os botões em abas. Ex.: Educação, Saúde"><input id="t-c" className={inputCls} value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })} /></Campo>
          <Campo id="t-t" label="Título do botão" obrigatorio><input id="t-t" className={inputCls} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Campo>
          <Campo id="t-v" label="Vídeo (link do YouTube)" dica="Aparece no topo quando a mãe toca no botão."><input id="t-v" className={inputCls} placeholder="https://youtu.be/…" value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} /></Campo>
          <Campo id="t-x" label="Dicas e orientações" obrigatorio dica='Parágrafos separados por linha em branco. Listas começando com "- ".'><textarea id="t-x" className={textareaCls + " min-h-64"} value={f.conteudo} onChange={(e) => setF({ ...f, conteudo: e.target.value })} /></Campo>
          <Campo id="t-f" label="Fontes oficiais" dica="Uma por linha: Nome | https://link"><textarea id="t-f" className={textareaCls} value={f.fontes} onChange={(e) => setF({ ...f, fontes: e.target.value })} /></Campo>
          <div className="flex gap-2"><Btn onClick={salvar}>Salvar</Btn><Btn v="ghost" onClick={onFechar}>Cancelar</Btn></div>
        </div>
      </div>
    </div>
  );
}

function BibliotecaAdmin() {
  const { data, loading, recarregar } = useQuery<any[]>(async () => (await db.from("biblioteca").select("*").order("created_at", { ascending: false })).data ?? [], []);
  const [f, setF] = useState({ titulo: "", tipo: "video", categoria: "", descricao: "", url: "" });
  const [arq, setArq] = useState<File | null>(null);
  async function add() {
    if (!f.titulo.trim() || (!f.url && !arq)) return toast.error("Informe título e um link ou arquivo.");
    let arquivo_path: string | null = null;
    if (arq) {
      arquivo_path = `${crypto.randomUUID()}-${arq.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await db.storage.from("biblioteca").upload(arquivo_path, arq, { contentType: arq.type });
      if (error) return toast.error("Falha no upload: " + error.message);
    }
    const { error } = await db.from("biblioteca").insert({ ...f, url: f.url || null, categoria: f.categoria || null, descricao: f.descricao || null, arquivo_path });
    if (error) return toast.error(error.message);
    toast.success("Material adicionado."); setF({ titulo: "", tipo: "video", categoria: "", descricao: "", url: "" }); setArq(null); recarregar();
  }
  async function apagar(b: any) { if (!confirm("Apagar " + b.titulo + "?")) return; if (b.arquivo_path) await db.storage.from("biblioteca").remove([b.arquivo_path]); await db.from("biblioteca").delete().eq("id", b.id); recarregar(); }
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="b-t" label="Título" obrigatorio><input id="b-t" className={inputCls} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Campo>
          <Campo id="b-tp" label="Tipo" obrigatorio><select id="b-tp" className={inputCls} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{[["video", "Vídeo"], ["entrevista", "Entrevista"], ["cartilha", "Cartilha / PDF"], ["lei", "Lei"], ["link", "Link útil"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
          <Campo id="b-c" label="Categoria"><input id="b-c" className={inputCls} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} /></Campo>
          <Campo id="b-u" label="Link"><input id="b-u" className={inputCls} placeholder="https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Campo>
        </div>
        <Campo id="b-d" label="Descrição"><input id="b-d" className={inputCls} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
        <div className="flex flex-wrap gap-2">
          <label className="tap inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold"><Upload className="h-4 w-4" />{arq ? arq.name.slice(0, 30) : "Enviar arquivo (PDF)"}<input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => setArq(e.target.files?.[0] ?? null)} /></label>
          <Btn onClick={add}><Plus className="h-4 w-4" /> Adicionar</Btn>
        </div>
      </Card>
      {loading ? <Carregando /> : !(data ?? []).length ? <Vazio icon={BookOpen} titulo="Biblioteca vazia" texto="O app mostra a lista padrão até você adicionar materiais ou carregar o conteúdo padrão." /> : data!.map((b) => (
        <Card key={b.id} className="flex items-center gap-3 p-3">
          <Chip>{b.tipo}</Chip><div className="min-w-0 flex-1"><b>{b.titulo}</b><p className="truncate text-xs text-muted-foreground">{b.url ?? b.arquivo_path}</p></div>
          <button onClick={() => apagar(b)} className="tap grid place-items-center text-muted-foreground hover:text-emergency" aria-label="Apagar"><Trash2 className="h-4 w-4" /></button>
        </Card>
      ))}
    </div>
  );
}
