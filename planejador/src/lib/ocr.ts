// Lê fatura a partir de FOTO ou PRINT, no próprio aparelho (Tesseract). Aceita várias imagens (várias páginas).
// @ts-ignore módulo JS testado
import { lerFatura } from './fatura.js';
// @ts-ignore módulo JS testado
import { linhasDoOcr } from './ocr-linhas.js';

export async function lerImagensFatura(arquivos: File[], progresso: (p: number, msg: string) => void) {
  const { createWorker } = await import('tesseract.js');
  progresso(2, 'Preparando a leitura (na 1ª vez baixa o dicionário de português)…');
  const w = await createWorker('por', 1, {
    logger: (m: any) => { if (m.status === 'recognizing text') progresso(Math.round(10 + m.progress * 85), 'Lendo a imagem…'); },
  });
  const linhas: string[] = [];
  try {
    for (const [k, arq] of arquivos.entries()) {
      progresso(10, `Lendo imagem ${k + 1} de ${arquivos.length}…`);
      const { data } = await w.recognize(arq);
      linhas.push(...linhasDoOcr(data.text));
    }
  } finally { await w.terminate(); }
  progresso(100, 'Pronto');
  if (linhas.join('').length < 20) throw new Error('Não consegui ler texto nesta imagem. Tire a foto com boa luz, sem tremer, e com a fatura reta e inteira na tela.');
  return { ...lerFatura(linhas), linhas, viaFoto: true };
}
