// Geração de relatórios em PDF (tabelas, totais e gráfico de barras) e Excel (abas, cabeçalho, filtro e fórmulas).
import { salvarArquivo } from './nativo';
import { brl, dataBR } from './fmt';

export type Col = { t: string; k: string; tipo?: 'moeda' | 'num' | 'data' | 'texto'; total?: boolean };
export type Tab = { titulo: string; colunas: Col[]; linhas: Record<string, any>[] };
import type { Evolucao } from './analise';
export type Rel = { titulo: string; periodo: string; restaurante: string; resumo?: [string, string][]; tabelas: Tab[]; grafico?: { titulo: string; dados: { nome: string; total: number }[] }; evolucoes?: Evolucao[] };

const CORES: [number, number, number][] = [[163, 20, 27], [247, 159, 49], [37, 99, 235], [5, 150, 105], [124, 58, 237], [100, 116, 139]];
const curto = (v: number, moeda?: boolean) => { const a = Math.abs(v); const t = a >= 1e6 ? `${(v / 1e6).toFixed(1)}mi` : a >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v.toFixed(a < 10 && v % 1 ? 1 : 0); return (moeda ? 'R$ ' : '') + t.replace('.', ','); };
/** Gráfico de linhas (evolução no tempo) desenhado direto no PDF. Retorna a altura usada. */
function desenharEvolucao(doc: any, ev: Evolucao, x: number, y: number, w: number) {
  const h = 150, esq = 46, base = y + 18 + h, larg = w - esq - 6;
  doc.setFontSize(11); doc.setTextColor(20); doc.text(pdfTxt(ev.titulo), x, y + 8);
  const todos = ev.series.flatMap((s) => s.valores); const max = Math.max(1, ...todos); const min = Math.min(0, ...todos);
  const py = (v: number) => base - ((v - min) / (max - min || 1)) * h;
  const n = ev.rotulos.length; const px = (k: number) => x + esq + (n <= 1 ? larg / 2 : (k * larg) / (n - 1));
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.setFontSize(7); doc.setTextColor(120);
  for (let g = 0; g <= 4; g++) { const v = min + ((max - min) * g) / 4; const yy = py(v); doc.line(x + esq, yy, x + esq + larg, yy); doc.text(pdfTxt(curto(v, ev.moeda)), x + esq - 4, yy + 2, { align: 'right' }); }
  const passo = Math.max(1, Math.ceil(n / 12));
  ev.rotulos.forEach((r, k) => { if (k % passo === 0 || k === n - 1) doc.text(r, px(k), base + 10, { align: 'center' }); });
  ev.series.forEach((s, i) => {
    const [r, g, b] = CORES[i % CORES.length]; doc.setDrawColor(r, g, b); doc.setFillColor(r, g, b); doc.setLineWidth(1.4);
    for (let k = 1; k < n; k++) doc.line(px(k - 1), py(s.valores[k - 1]), px(k), py(s.valores[k]));
    if (n <= 40) s.valores.forEach((v, k) => doc.circle(px(k), py(v), 1.6, 'F'));
    // legenda
    const lx = x + esq + i * 120; doc.rect(lx, base + 16, 8, 3, 'F'); doc.setTextColor(60); doc.text(pdfTxt(s.nome).slice(0, 26), lx + 11, base + 19);
  });
  doc.setTextColor(20);
  return h + 56;
}

// a fonte padrão do PDF não tem alguns símbolos (− “ ” …)
const pdfTxt = (t: string) => t.replace(/[\u2212\u2013\u2014]/g, '-').replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...').replace(/[\u2705\u274c]/g, '');
const fmtCel = (v: any, c: Col) => v == null || v === '' ? '' : c.tipo === 'moeda' ? brl(v) : c.tipo === 'data' ? dataBR(String(v)) : c.tipo === 'num' ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : String(v);
const nomeArq = (r: Rel, ext: string) => `${r.titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${ext}`;

export async function gerarPDF(r: Rel) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(163, 20, 27); doc.rect(0, 0, W, 64, 'F');
  doc.setTextColor(255); doc.setFontSize(16); doc.text(pdfTxt(r.titulo), 36, 30); doc.setFontSize(10); doc.text(pdfTxt(`${r.restaurante} · ${r.periodo}`), 36, 48);
  doc.setTextColor(30); let y = 88;
  if (r.resumo?.length) {
    const largura = (W - 72) / Math.min(4, r.resumo.length);
    r.resumo.forEach(([k, v], i) => { const x = 36 + (i % 4) * largura; if (i > 0 && i % 4 === 0) y += 44; doc.setFontSize(8); doc.setTextColor(100); doc.text(pdfTxt(k.toUpperCase()), x, y); doc.setFontSize(12); doc.setTextColor(20); doc.text(pdfTxt(v), x, y + 16); });
    y += 40;
  }
  for (const ev of r.evolucoes ?? []) {
    if (!ev.rotulos.length || !ev.series.some((s) => s.valores.some((v) => v))) continue;
    if (y > 600) { doc.addPage(); y = 40; }
    y += desenharEvolucao(doc, ev, 36, y, W - 72);
  }
  if (r.grafico?.dados.length) {
    const d = r.grafico.dados.slice(0, 10); const max = Math.max(...d.map((x) => x.total), 1);
    doc.setFontSize(11); doc.text(pdfTxt(r.grafico.titulo), 36, y); y += 10;
    for (const x of d) { const w = ((W - 72 - 210) * x.total) / max; doc.setFontSize(8); doc.setTextColor(60); doc.text(pdfTxt(x.nome.slice(0, 32)), 36, y + 9); doc.setFillColor(247, 159, 49); doc.rect(200, y + 1, Math.max(1, w), 10, 'F'); doc.text(brl(x.total), 204 + w, y + 9); y += 15; }
    y += 12; doc.setTextColor(20);
  }
  for (const t of r.tabelas) {
    if (y > 740) { doc.addPage(); y = 40; }
    doc.setFontSize(11); doc.text(pdfTxt(t.titulo), 36, y); y += 6;
    const alinh = (c: Col) => (c.tipo === 'moeda' || c.tipo === 'num' ? 'right' : 'left') as any;
    const totais = t.colunas.some((c) => c.total) ? [t.colunas.map((c, i) => ({ content: c.total ? fmtCel(t.linhas.reduce((s, l) => s + (Number(l[c.k]) || 0), 0), c) : i === 0 ? 'Total' : '', styles: { halign: alinh(c) } }))] : undefined;
    autoTable(doc, {
      startY: y, head: [t.colunas.map((c) => ({ content: pdfTxt(c.t), styles: { halign: alinh(c) } }))], body: t.linhas.map((l) => t.colunas.map((c) => pdfTxt(fmtCel(l[c.k], c)))), foot: totais as any,
      styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [163, 20, 27] }, footStyles: { fillColor: [245, 245, 245], textColor: 20, fontStyle: 'bold' },
      columnStyles: Object.fromEntries(t.colunas.map((c, i) => [i, { halign: c.tipo === 'moeda' || c.tipo === 'num' ? 'right' : 'left' }])) as any, margin: { left: 36, right: 36 },
    });
    y = (doc as any).lastAutoTable.finalY + 24;
  }
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(140); doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · página ${i} de ${n}`, 36, doc.internal.pageSize.getHeight() - 16); }
  const b64 = doc.output('datauristring').split(',')[1];
  await salvarArquivo(nomeArq(r, 'pdf'), b64, 'application/pdf');
}

export async function gerarExcel(r: Rel) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  if (r.resumo?.length) {
    const ws = XLSX.utils.aoa_to_sheet([[r.titulo], [`${r.restaurante} · ${r.periodo}`], [], ...r.resumo]);
    ws['!cols'] = [{ wch: 34 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Resumo');
  }
  const usados = new Set<string>();
  for (const t of r.tabelas) {
    const cab = t.colunas.map((c) => c.t);
    const corpo = t.linhas.map((l) => t.colunas.map((c) => { const v = l[c.k]; if (v == null || v === '') return null; if (c.tipo === 'moeda' || c.tipo === 'num') return Number(v); if (c.tipo === 'data') { const s = String(v).slice(0, 10); return new Date(s + 'T12:00:00Z'); } return String(v); }));
    const ws = XLSX.utils.aoa_to_sheet([cab, ...corpo], { cellDates: true });
    const n = corpo.length;
    if (t.colunas.some((c) => c.total) && n) {
      const linhaTot = n + 2;
      t.colunas.forEach((c, i) => {
        const ref = XLSX.utils.encode_cell({ r: linhaTot - 1, c: i });
        if (c.total) { const col = XLSX.utils.encode_col(i); ws[ref] = { t: 'n', f: `SUM(${col}2:${col}${n + 1})` }; }
        else if (i === 0) ws[ref] = { t: 's', v: 'Total' };
      });
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhaTot - 1, c: t.colunas.length - 1 } });
    }
    // formatos: moeda e data
    t.colunas.forEach((c, i) => { for (let k = 1; k <= n + 1; k++) { const cell = ws[XLSX.utils.encode_cell({ r: k, c: i })]; if (!cell) continue; if (c.tipo === 'moeda') cell.z = '"R$" #,##0.00'; if (c.tipo === 'data') cell.z = 'dd/mm/yyyy'; } });
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(n, 1), c: t.colunas.length - 1 } }) };
    ws['!cols'] = t.colunas.map((c) => ({ wch: Math.min(45, Math.max(c.t.length + 2, ...t.linhas.slice(0, 200).map((l) => String(l[c.k] ?? '').length + 2), c.tipo === 'moeda' ? 14 : 8)) }));
    let nome = t.titulo.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31); let k = 2; while (usados.has(nome)) nome = `${t.titulo.slice(0, 28)} ${k++}`; usados.add(nome);
    XLSX.utils.book_append_sheet(wb, ws, nome);
  }
  // dados da evolução (o Excel monta o gráfico: selecione a tabela → Inserir → Gráfico de linhas)
  (r.evolucoes ?? []).forEach((ev, k) => {
    if (!ev.rotulos.length) return;
    const ws = XLSX.utils.aoa_to_sheet([[ev.titulo], ['Período', ...ev.series.map((s) => s.nome)], ...ev.rotulos.map((rot, i) => [rot, ...ev.series.map((s) => s.valores[i])])]);
    ws['!cols'] = [{ wch: 12 }, ...ev.series.map(() => ({ wch: 18 }))];
    if (ev.moeda) for (let i = 0; i < ev.rotulos.length; i++) ev.series.forEach((_, j) => { const c = ws[XLSX.utils.encode_cell({ r: i + 2, c: j + 1 })]; if (c) c.z = '"R$" #,##0.00'; });
    XLSX.utils.book_append_sheet(wb, ws, `Evolução${k ? ' ' + (k + 1) : ''}`.slice(0, 31));
  });
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await salvarArquivo(nomeArq(r, 'xlsx'), b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
