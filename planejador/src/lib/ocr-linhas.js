// Ajustes no texto vindo do OCR (foto/print) antes de ler a fatura.
export function linhasDoOcr(texto) {
  return String(texto)
    .split(/\r?\n/)
    .map((l) => l
      .replace(/R\s?\$\s?/g, 'R$ ')            // "R$312" / "RS 312"
      .replace(/\bRS\s(?=\d)/g, 'R$ ')
      .replace(/(\d)\s+,(\d{2})\b/g, '$1,$2')   // "312 ,45"
      .replace(/(\d),\s+(\d{2})\b/g, '$1,$2')   // "312, 45"
      .replace(/(\d{1,3})\s\.(\d{3})/g, '$1.$2')
      .replace(/[|]/g, ' ')
      .trim())
    .filter(Boolean);
}
