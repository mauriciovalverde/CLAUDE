import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/dados";

export const TIPOS_OUV: [string, string, string][] = [
  ["denuncia", "Denúncia", "Relatar uma irregularidade ou violação de direitos"],
  ["reclamacao", "Reclamação", "Algo não funcionou como deveria"],
  ["solicitacao", "Solicitação", "Pedir um serviço ou providência"],
  ["sugestao", "Sugestão", "Ideia para melhorar o AMPARO ou o app"],
  ["elogio", "Elogio", "Reconhecer um bom atendimento"],
];
export const tipoNome = (t: string) => TIPOS_OUV.find(([k]) => k === t)?.[1] ?? t;

export const CATEGORIAS_OUV: [string, string][] = [
  ["saude", "Saúde"], ["educacao", "Educação"], ["assistencia", "Assistência social"], ["transporte", "Transporte"], ["acessibilidade", "Acessibilidade"],
  ["discriminacao", "Discriminação"], ["atendimento", "Atendimento inadequado"], ["negativa", "Negativa de serviço"], ["outras", "Outras violações de direitos"],
];
export const categoriaNome = (c?: string | null) => CATEGORIAS_OUV.find(([k]) => k === c)?.[1] ?? null;

export const STATUS_OUV: Record<string, [string, string]> = {
  recebida: ["Recebida", "blue"],
  em_analise: ["Em análise", "amber"],
  encaminhada: ["Encaminhada", "navy"],
  aguardando_complemento: ["Aguardando você", "coral"],
  respondida: ["Respondida", "green"],
  concluida: ["Concluída", "green"],
};

export const EVENTO_OUV: Record<string, string> = {
  registro: "Manifestação registrada",
  analise: "Em análise",
  encaminhamento: "Encaminhada",
  complemento_solicitado: "Complementação solicitada",
  complemento_enviado: "Você enviou complementação",
  resposta: "Resposta da Ouvidoria",
  conclusao: "Atendimento concluído",
  encaminhamento_oficial: "Encaminhada oficialmente ao órgão público",
  resposta_orgao: "Resposta do órgão público",
};

export type Anexo = {
  id: string;            // id local
  file: File;
  nome: string;
  mime: string;
  tamanho: number;
  preview?: string;      // URL local da miniatura (fotos)
  progresso: number;     // 0–100
  estado: "enviando" | "ok" | "erro";
  path?: string;         // caminho no armazenamento depois de enviado
};

const ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf",
  "video/mp4", "video/quicktime", "video/webm", "video/3gpp", "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/webm", "audio/wav", "audio/x-m4a"];
export const MAX_MB = 50;

export function validarArquivo(f: File): string | null {
  const tipo = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  if (!ACEITOS.includes(tipo)) return `${f.name}: envie foto, vídeo, áudio ou PDF.`;
  if (!tipo.startsWith("video/") && !tipo.startsWith("audio/") && f.size > 15 * 1024 * 1024) return `${f.name}: fotos e PDF até 15 MB.`;
  if (f.size > MAX_MB * 1024 * 1024) return `${f.name}: maior que ${MAX_MB} MB.`;
  return null;
}

/** Reduz fotos grandes (lado maior 2000 px, JPEG 85%) para enviar mais rápido pelo celular. */
export async function prepararFoto(f: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size < 600 * 1024) return f;
  try {
    const bmp = await createImageBitmap(f);
    const esc = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= f.size) return f;
    return new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return f; }
}

/** Envia um arquivo ao armazenamento privado da Ouvidoria, informando o progresso. */
export async function enviarArquivo(uid: string, chave: string, f: File, onProgresso: (p: number) => void): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre de novo.");
  const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const path = `${uid}/${chave}/${crypto.randomUUID()}.${ext}`;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/ouvidoria/${path}`;
  await new Promise<void>((ok, falha) => {
    const x = new XMLHttpRequest();
    x.open("POST", url);
    x.setRequestHeader("Authorization", `Bearer ${token}`);
    x.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
    x.setRequestHeader("Content-Type", f.type || "application/octet-stream");
    x.setRequestHeader("x-upsert", "false");
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgresso(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : falha(new Error(`Falha no envio (${x.status}).`)));
    x.onerror = () => falha(new Error("Sem conexão."));
    x.send(f);
  });
  return path;
}

export async function urlAssinada(path: string) {
  const { data } = await db.storage.from("ouvidoria").createSignedUrl(path, 600);
  return (data?.signedUrl as string | undefined) ?? null;
}

export const fmtTamanho = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Rascunho do relato guardado no aparelho, para não perder o texto se a conexão cair. */
const CHAVE_RASCUNHO = "ouv-rascunho";
export function lerRascunho<T>(): T | null { try { const s = localStorage.getItem(CHAVE_RASCUNHO); return s ? JSON.parse(s) : null; } catch { return null; } }
export function salvarRascunho(v: unknown) { try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(v)); } catch { /* sem armazenamento */ } }
export function limparRascunho() { try { localStorage.removeItem(CHAVE_RASCUNHO); } catch { /* sem armazenamento */ } }
