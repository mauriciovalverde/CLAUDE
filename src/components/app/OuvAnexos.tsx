import { useRef, useState } from "react";
import { Camera, FileText, Paperclip, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Btn, Modal } from "@/components/app/kit";
import { cn } from "@/lib/utils";
import { type Anexo, enviarArquivo, fmtTamanho, prepararFoto, validarArquivo } from "@/lib/ouvidoria";

const MAX = 10;

/** Botões "Tirar foto" e "Anexar arquivos", lista com miniaturas, progresso, remover e tentar de novo. */
export function OuvAnexos({ uid, chave, anexos, setAnexos }: { uid: string; chave: string; anexos: Anexo[]; setAnexos: (f: (a: Anexo[]) => Anexo[]) => void }) {
  const cam = useRef<HTMLInputElement>(null);
  const arq = useRef<HTMLInputElement>(null);
  const [revisar, setRevisar] = useState<{ file: File; url: string } | null>(null);

  const mudar = (id: string, p: Partial<Anexo>) => setAnexos((l) => l.map((a) => (a.id === id ? { ...a, ...p } : a)));

  async function subir(a: Anexo) {
    mudar(a.id, { estado: "enviando", progresso: 0 });
    try {
      const path = await enviarArquivo(uid, chave, a.file, (p) => mudar(a.id, { progresso: p }));
      mudar(a.id, { estado: "ok", progresso: 100, path });
    } catch (e: any) {
      mudar(a.id, { estado: "erro" });
      toast.error(`Não foi possível enviar “${a.nome}”. Seu relato continua salvo: toque em “Tentar de novo”.`);
    }
  }

  async function adicionar(files: File[]) {
    const livres = MAX - anexos.length;
    if (files.length > livres) toast.error(`Máximo de ${MAX} arquivos por envio.`);
    for (const f0 of files.slice(0, Math.max(0, livres))) {
      const erro = validarArquivo(f0);
      if (erro) { toast.error(erro); continue; }
      const f = f0.type.startsWith("image/") ? await prepararFoto(f0) : f0;
      const a: Anexo = {
        id: crypto.randomUUID(), file: f, nome: f0.name || "foto.jpg", mime: f.type || "application/pdf", tamanho: f.size,
        preview: f.type.startsWith("image/") && !/heic|heif/.test(f.type) ? URL.createObjectURL(f) : undefined, progresso: 0, estado: "enviando",
      };
      setAnexos((l) => [...l, a]);
      subir(a);
    }
  }

  function remover(a: Anexo) {
    if (a.preview) URL.revokeObjectURL(a.preview);
    setAnexos((l) => l.filter((x) => x.id !== a.id));
    // o arquivo já enviado fica órfão na pasta do próprio usuário; tentamos apagar (permitido só antes do registro)
    if (a.path) import("@/lib/dados").then(({ db }) => db.storage.from("ouvidoria").remove([a.path!]));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Btn type="button" v="soft" className="min-h-14" onClick={() => cam.current?.click()} disabled={anexos.length >= MAX}><Camera className="h-5 w-5" /> Tirar foto</Btn>
        <Btn type="button" v="outline" className="min-h-14" onClick={() => arq.current?.click()} disabled={anexos.length >= MAX}><Paperclip className="h-5 w-5" /> Anexar arquivos</Btn>
      </div>
      {/* capture="environment" abre a câmera traseira; sem câmera, o celular oferece a galeria */}
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Tirar foto"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setRevisar({ file: f, url: URL.createObjectURL(f) }); }} />
      <input ref={arq} type="file" multiple accept="image/*,application/pdf,.pdf,video/*,audio/*" className="hidden" aria-label="Anexar arquivos"
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; adicionar(fs); }} />
      <p className="text-xs text-muted-foreground">Fotos (JPG, PNG, HEIC) e documentos PDF, até {MAX_TXT}. Se a câmera não abrir, use “Anexar arquivos” para escolher da galeria.</p>

      {anexos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {anexos.map((a) => (
            <li key={a.id} className={cn("flex items-center gap-3 rounded-2xl border bg-card p-2", a.estado === "erro" ? "border-emergency" : "border-border")}>
              {a.preview ? <img src={a.preview} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-coral-soft text-coral"><FileText className="h-6 w-6" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{a.nome}</span>
                <span className="text-xs text-muted-foreground">{fmtTamanho(a.tamanho)} · {a.estado === "ok" ? "enviado ✓" : a.estado === "erro" ? "falhou" : `enviando ${a.progresso}%`}</span>
                {a.estado !== "erro" && (
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={a.progresso} aria-valuemin={0} aria-valuemax={100} aria-label={`Envio de ${a.nome}`}>
                    <span className={cn("block h-full rounded-full transition-all", a.estado === "ok" ? "bg-success" : "bg-primary")} style={{ width: `${a.progresso}%` }} />
                  </span>
                )}
              </span>
              {a.estado === "erro" && <button type="button" onClick={() => subir(a)} className="tap inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 text-xs font-bold text-primary"><RefreshCw className="h-4 w-4" /> Tentar de novo</button>}
              <button type="button" onClick={() => remover(a)} aria-label={`Remover ${a.nome}`} className="tap grid w-11 place-items-center text-muted-foreground hover:text-emergency"><Trash2 className="h-5 w-5" /></button>
            </li>
          ))}
        </ul>
      )}

      {revisar && (
        <Modal titulo="Conferir foto" onFechar={() => { URL.revokeObjectURL(revisar.url); setRevisar(null); }}>
          <img src={revisar.url} alt="Foto capturada" className="max-h-[60vh] w-full rounded-2xl object-contain" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Btn type="button" onClick={() => { adicionar([revisar.file]); setRevisar(null); }}>Usar</Btn>
            <Btn type="button" v="outline" onClick={() => { URL.revokeObjectURL(revisar.url); setRevisar(null); setTimeout(() => cam.current?.click(), 50); }}><RotateCcw className="h-4 w-4" /> Refazer</Btn>
            <Btn type="button" v="ghost" onClick={() => { URL.revokeObjectURL(revisar.url); setRevisar(null); }}><X className="h-4 w-4" /> Excluir</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

const MAX_TXT = `${MAX} arquivos de 15 MB`;

export const anexosParaEnvio = (l: Anexo[]) => l.filter((a) => a.estado === "ok" && a.path).map((a) => ({ path: a.path, nome: a.nome, mime: a.mime, tamanho: a.tamanho }));
