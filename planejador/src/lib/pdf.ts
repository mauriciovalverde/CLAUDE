// Extrai o texto do PDF da fatura NO PRÓPRIO CELULAR (o arquivo não é enviado a lugar nenhum).
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
// @ts-ignore módulo JS testado em tests/fatura.test.mjs
import { lerFatura, montarLinhas } from './fatura.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function lerPdfFatura(arquivo: File, senha?: string) {
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: dados, password: senha }).promise;
  } catch (e: any) {
    if (e?.name === 'PasswordException') throw Object.assign(new Error('Este PDF tem senha. Digite a senha da fatura (geralmente os primeiros dígitos do seu CPF).'), { senha: true });
    throw new Error('Não consegui abrir este PDF. Confira se é a fatura em PDF (não uma foto).');
  }
  const itens: any[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    for (const it of tc.items as any[]) itens.push({ str: it.str, x: it.transform[4], y: it.transform[5], pagina: p });
  }
  const linhas: string[] = montarLinhas(itens);
  if (linhas.join('').trim().length < 20) throw new Error('Este PDF parece ser uma imagem escaneada, sem texto. Baixe a fatura em PDF pelo app do banco.');
  return { ...lerFatura(linhas), linhas };
}
