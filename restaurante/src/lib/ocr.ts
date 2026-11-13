// Leitura de foto de nota fiscal no próprio aparelho: QR Code (jsQR) + texto (Tesseract, português).
// @ts-ignore módulo JS testado
import { lerNota } from './nota.js';

async function carregarImagem(arq: Blob) {
  const url = URL.createObjectURL(arq);
  try { return await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('Não consegui abrir a imagem.')); i.src = url; }); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

export async function lerQr(arq: Blob): Promise<string | null> {
  const jsQR = (await import('jsqr')).default;
  const img = await carregarImagem(arq);
  for (const max of [1400, 900, 2000]) {
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height);
    const r = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
    if (r?.data) return r.data;
  }
  return null;
}

export async function lerFotoNota(arquivos: File[], progresso: (p: number, msg: string) => void) {
  let qr: string | null = null;
  for (const a of arquivos) { qr = await lerQr(a).catch(() => null); if (qr) break; }
  progresso(5, qr ? 'QR Code encontrado. Lendo o texto…' : 'Preparando a leitura (na 1ª vez baixa o dicionário)…');
  const { createWorker } = await import('tesseract.js');
  const w = await createWorker('por', 1, { logger: (m: any) => { if (m.status === 'recognizing text') progresso(Math.round(10 + m.progress * 85), 'Lendo a nota…'); } });
  let texto = '';
  try { for (const a of arquivos) texto += (await w.recognize(a)).data.text + '\n'; } finally { await w.terminate(); }
  progresso(100, 'Pronto');
  return { ...lerNota(texto, qr), texto, qr };
}
