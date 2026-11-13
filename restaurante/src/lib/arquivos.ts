// Fotos e documentos (notas, comprovantes, fotos de pedidos) no armazenamento privado do restaurante.
import { supabase } from './supabase';

export const BALDE = 'rest-arquivos';

/** Reduz a foto (máx. 1600 px, JPEG) antes de enviar: economiza internet e espaço. */
export async function comprimir(arq: File, max = 1600): Promise<Blob> {
  if (!arq.type.startsWith('image/')) return arq;
  const url = URL.createObjectURL(arq);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b ?? arq), 'image/jpeg', 0.82));
  } catch { return arq; } finally { URL.revokeObjectURL(url); }
}

export async function enviarArquivo(restauranteId: string, pasta: string, arq: File) {
  const blob = await comprimir(arq);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (arq.name.split('.').pop() || 'bin').toLowerCase();
  const caminho = `${restauranteId}/${pasta}/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BALDE).upload(caminho, blob, { contentType: blob.type || arq.type, upsert: false });
  if (error) throw new Error('Não consegui enviar o arquivo: ' + error.message);
  return caminho;
}

export async function linkArquivo(caminho: string) {
  const { data, error } = await supabase.storage.from(BALDE).createSignedUrl(caminho, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// Balde separado para dados sensíveis do ponto (selfies, foto da ficha, atestados): o empregado só acessa a própria pasta.
export const BALDE_PRIVADO = 'rest-privado';
export async function enviarPrivado(restauranteId: string, funcionarioId: string, pasta: string, arq: File | Blob, nome = 'arquivo.jpg') {
  const blob = arq instanceof File ? await comprimir(arq) : arq;
  const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'application/pdf' ? 'pdf' : (nome.split('.').pop() || 'bin').toLowerCase();
  const caminho = `${restauranteId}/${funcionarioId}/${pasta}/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BALDE_PRIVADO).upload(caminho, blob, { contentType: blob.type || 'application/octet-stream', upsert: false });
  if (error) throw new Error('Não consegui enviar o arquivo: ' + error.message);
  return caminho;
}
const cacheLinks = new Map<string, { url: string; ate: number }>();
export async function linkPrivado(caminho: string) {
  const c = cacheLinks.get(caminho); if (c && c.ate > Date.now()) return c.url;
  const { data, error } = await supabase.storage.from(BALDE_PRIVADO).createSignedUrl(caminho, 3600);
  if (error) throw new Error(error.message);
  cacheLinks.set(caminho, { url: data.signedUrl, ate: Date.now() + 50 * 60000 });
  return data.signedUrl;
}

/** Abre um arquivo privado em nova aba sem ser barrado pelo bloqueador de pop-up (a aba abre no toque; o link chega depois). */
export async function abrirLink(pegar: () => Promise<string>) {
  const aba = window.open('', '_blank');
  try {
    const url = await pegar();
    if (aba) aba.location.href = url; else window.location.href = url;
  } catch (e) { aba?.close(); throw e; }
}
export const abrirPrivado = (caminho: string) => abrirLink(() => linkPrivado(caminho));
export const abrirArquivo = (caminho: string) => abrirLink(() => linkArquivo(caminho));
