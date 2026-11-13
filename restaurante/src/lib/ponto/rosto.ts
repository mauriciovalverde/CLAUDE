// Reconhecimento facial e prova de vida no próprio aparelho (face-api, licença MIT).
// O vídeo nunca sai do aparelho: só a selfie do registro (para auditoria) e o descritor numérico do rosto de referência vão ao servidor.
import type * as FaceApi from '@vladmandic/face-api';

export const LIMIAR = 0.5;          // distância euclidiana máxima para considerar o mesmo rosto (padrão da biblioteca: 0,6; usamos mais rigoroso)
let fa: typeof FaceApi | null = null;
let carregando: Promise<typeof FaceApi> | null = null;

/** Carrega a biblioteca e os modelos (~6,5 MB, ficam em cache depois da primeira vez). */
export function carregarRosto() {
  if (fa) return Promise.resolve(fa);
  carregando ??= (async () => {
    const m = await import('@vladmandic/face-api');
    const base = new URL('./modelos-face/', window.location.href).toString();
    await Promise.all([m.nets.tinyFaceDetector.loadFromUri(base), m.nets.faceLandmark68Net.loadFromUri(base), m.nets.faceRecognitionNet.loadFromUri(base)]);
    fa = m; return m;
  })();
  carregando.catch(() => { carregando = null; });
  return carregando;
}

export type Leitura = { descritor: Float32Array; ear: number; giro: number; caixa: { x: number; y: number; w: number; h: number } } | null;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
/** abertura dos olhos (eye aspect ratio): cai bastante quando a pessoa pisca */
function ear(p: { x: number; y: number }[]) {
  const olho = (i: number) => (dist(p[i + 1], p[i + 5]) + dist(p[i + 2], p[i + 4])) / (2 * dist(p[i], p[i + 3]));
  return (olho(36) + olho(42)) / 2;
}

/** Lê um quadro: rosto, descritor, abertura dos olhos e giro da cabeça. null = nenhum rosto. */
export async function ler(fonte: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<Leitura> {
  const m = await carregarRosto();
  const r = await m.detectSingleFace(fonte, new m.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })).withFaceLandmarks().withFaceDescriptor();
  if (!r) return null;
  const p = r.landmarks.positions; const b = r.detection.box;
  const giro = (p[30].x - (b.x + b.width / 2)) / b.width; // nariz em relação ao centro do rosto
  return { descritor: r.descriptor, ear: ear(p), giro, caixa: { x: b.x, y: b.y, w: b.width, h: b.height } };
}

export const distancia = (a: ArrayLike<number>, b: ArrayLike<number>) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); };

/**
 * Prova de vida simples: pede para piscar ou virar levemente o rosto e acompanha os quadros.
 * Foto parada (impressa ou na tela) não pisca nem gira. Não é infalível; por isso o registro sempre guarda a selfie para auditoria.
 */
export class ProvaDeVida {
  private ears: number[] = []; private giros: number[] = [];
  piscou = false; girou = false;
  adicionar(l: NonNullable<Leitura>) {
    this.ears.push(l.ear); this.giros.push(l.giro);
    if (this.ears.length > 40) { this.ears.shift(); this.giros.shift(); }
    const base = [...this.ears].sort((a, b) => b - a)[Math.floor(this.ears.length / 4)] ?? l.ear; // olho aberto típico
    if (this.ears.length >= 4 && l.ear < base * 0.72) this.piscou = true;
    const g = this.giros; if (g.length >= 4 && Math.max(...g) - Math.min(...g) > 0.16) this.girou = true;
  }
  get ok() { return this.piscou || this.girou; }
}

/** Quadro atual do vídeo em JPEG (selfie do registro). */
export function capturar(v: HTMLVideoElement, max = 640): Promise<Blob> {
  const k = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
  c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
  return new Promise((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error('Não consegui capturar a foto'))), 'image/jpeg', 0.8));
}
