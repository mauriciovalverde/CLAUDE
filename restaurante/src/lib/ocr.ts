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

/** Prepara a foto para o OCR: tamanho bom para leitura, tons de cinza e contraste esticado (letras mais nítidas). */
async function prepararImagem(arq: Blob): Promise<HTMLCanvasElement | Blob> {
  try {
    const img = await carregarImagem(arq);
    const alvo = 2200; const k = Math.min(3, alvo / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext('2d', { willReadFrequently: true })!; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height); const px = d.data;
    const hist = new Uint32Array(256); const cinza = new Uint8ClampedArray(px.length / 4);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) { const v = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000; cinza[j] = v; hist[cinza[j]]++; }
    // estica o contraste entre os percentis 2% e 98%
    const total = cinza.length; let acc = 0, lo = 0, hi = 255;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.02) { lo = v; break; } }
    acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.02) { hi = v; break; } }
    const esc = hi > lo ? 255 / (hi - lo) : 1;
    for (let i = 0, j = 0; i < px.length; i += 4, j++) { const v = Math.max(0, Math.min(255, (cinza[j] - lo) * esc)); px[i] = px[i + 1] = px[i + 2] = v; }
    g.putImageData(d, 0, 0);
    return c;
  } catch { return arq; }
}

export async function lerFotoNota(arquivos: File[], progresso: (p: number, msg: string) => void) {
  let qr: string | null = null;
  for (const a of arquivos) { qr = await lerQr(a).catch(() => null); if (qr) break; }
  progresso(5, qr ? 'QR Code encontrado. Lendo o texto…' : 'Preparando a leitura (na 1ª vez baixa o dicionário)…');
  const { createWorker } = await import('tesseract.js');
  const w = await createWorker('por', 1, { logger: (m: any) => { if (m.status === 'recognizing text') progresso(Math.round(10 + m.progress * 85), 'Lendo a nota…'); } });
  let texto = '';
  try {
    // modo "bloco de texto" (6) funciona melhor em cupom; mantém os espaços entre colunas
    await w.setParameters({ tessedit_pageseg_mode: '6' as any, preserve_interword_spaces: '1' });
    for (const a of arquivos) texto += (await w.recognize(await prepararImagem(a) as any)).data.text + '\n';
  } finally { await w.terminate(); }
  progresso(100, 'Pronto');
  return { ...lerNota(texto, qr), texto, qr };
}
