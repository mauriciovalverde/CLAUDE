// Geração de PDFs profissionais (jsPDF + autotable): cabeçalho, rodapé com data de emissão e paginação,
// cartões de indicadores, tabelas com subtotais/totais e gráficos simples desenhados em vetor.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { brl, dataBR, mesNome, pct } from './fmt';
import { ehNativo, salvarArquivo } from './nativo';

const COR: [number, number, number] = [15, 118, 110];

export class Relatorio {
  doc = new jsPDF({ unit: 'pt', format: 'a4' });
  y = 0;
  constructor(public titulo: string, public periodo: string) { this.cabecalho(); }
  get W() { return this.doc.internal.pageSize.getWidth(); }
  get H() { return this.doc.internal.pageSize.getHeight(); }
  cabecalho() {
    const d = this.doc;
    d.setFillColor(...COR); d.rect(0, 0, this.W, 6, 'F');
    d.setFont('helvetica', 'bold'); d.setFontSize(9); d.setTextColor(...COR); d.text('GESTOR FINANCEIRO INTELIGENTE', 40, 30);
    d.setFontSize(17); d.setTextColor(15, 23, 42); d.text(this.titulo, 40, 52);
    d.setFont('helvetica', 'normal'); d.setFontSize(9); d.setTextColor(100, 116, 139); d.text(this.periodo, 40, 66);
    d.setDrawColor(...COR); d.setLineWidth(1); d.line(40, 74, this.W - 40, 74);
    this.y = 92;
  }
  espaco(h: number) { if (this.y + h > this.H - 50) { this.doc.addPage(); this.cabecalho(); } }
  secao(t: string) { this.espaco(40); const d = this.doc; d.setFont('helvetica', 'bold'); d.setFontSize(12); d.setTextColor(...COR); d.text(t, 40, this.y); this.y += 14; }
  texto(t: string, tam = 9) { const d = this.doc; d.setFont('helvetica', 'normal'); d.setFontSize(tam); d.setTextColor(51, 65, 85); const l = d.splitTextToSize(t, this.W - 80); this.espaco(l.length * 12); d.text(l, 40, this.y); this.y += l.length * 12 + 4; }
  cartoes(itens: [string, string][]) {
    const por = 4, w = (this.W - 80 - (por - 1) * 8) / por, h = 44, d = this.doc;
    for (let i = 0; i < itens.length; i++) {
      if (i % por === 0) { this.espaco(h + 8); if (i) this.y += h + 8; }
      const x = 40 + (i % por) * (w + 8);
      d.setFillColor(248, 250, 252); d.setDrawColor(226, 232, 240); d.roundedRect(x, this.y, w, h, 6, 6, 'FD');
      d.setFont('helvetica', 'normal'); d.setFontSize(7); d.setTextColor(100, 116, 139); d.text(itens[i][0].toUpperCase(), x + 8, this.y + 14);
      d.setFont('helvetica', 'bold'); d.setFontSize(12); d.setTextColor(15, 23, 42); d.text(itens[i][1], x + 8, this.y + 32);
    }
    this.y += h + 16;
  }
  tabela(cabec: string[], linhas: (string | number)[][], opts: { total?: (string | number)[]; numericas?: number[] } = {}) {
    if (!linhas.length) { this.texto('Sem registros no período.'); return; }
    const num = new Set(opts.numericas ?? []);
    autoTable(this.doc, {
      startY: this.y, head: [cabec], body: linhas as any, foot: opts.total ? [opts.total as any] : undefined, margin: { left: 40, right: 40, top: 92 },
      styles: { fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] }, headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
      footStyles: { fillColor: [204, 251, 241], textColor: [15, 23, 42], fontStyle: 'bold' }, alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: Object.fromEntries([...num].map((i) => [i, { halign: 'right' }])), showHead: 'everyPage', showFoot: 'lastPage',
      didDrawPage: (d) => { if (d.pageNumber > 1 && d.cursor) { /* cabeçalho redesenhado abaixo */ } },
    });
    this.y = (this.doc as any).lastAutoTable.finalY + 18;
  }
  /** Gráfico de barras agrupadas em vetor. series: [{nome, cor, valores}] */
  barras(rotulos: string[], series: { nome: string; cor: [number, number, number]; valores: number[] }[], altura = 150) {
    if (!rotulos.length) return;
    this.espaco(altura + 40);
    const d = this.doc, x0 = 70, x1 = this.W - 40, y0 = this.y + altura, max = Math.max(1, ...series.flatMap((s) => s.valores.map(Math.abs)));
    d.setDrawColor(226, 232, 240); d.setLineWidth(0.5);
    for (let k = 0; k <= 4; k++) { const yy = y0 - (altura * k) / 4; d.line(x0, yy, x1, yy); d.setFontSize(6); d.setTextColor(148, 163, 184); d.text(brl((max * k) / 4).replace(',00', ''), x0 - 4, yy + 2, { align: 'right' }); }
    const g = (x1 - x0) / rotulos.length, bw = Math.min(18, (g * 0.7) / series.length);
    rotulos.forEach((r, i) => {
      series.forEach((s, j) => { const v = Math.max(0, s.valores[i] ?? 0), h = (v / max) * altura; d.setFillColor(...s.cor); d.rect(x0 + i * g + (g - bw * series.length) / 2 + j * bw, y0 - h, bw - 1, h, 'F'); });
      d.setFontSize(6.5); d.setTextColor(100, 116, 139); d.text(r, x0 + i * g + g / 2, y0 + 10, { align: 'center' });
    });
    let lx = x0; series.forEach((s) => { d.setFillColor(...s.cor); d.rect(lx, y0 + 18, 8, 8, 'F'); d.setFontSize(7); d.setTextColor(51, 65, 85); d.text(s.nome, lx + 11, y0 + 25); lx += d.getTextWidth(s.nome) + 26; });
    this.y = y0 + 40;
  }
  private rodapes = false;
  finalizar() {
    if (this.rodapes) return; this.rodapes = true;
    const d = this.doc, n = d.getNumberOfPages(), emitido = new Date().toLocaleString('pt-BR');
    for (let i = 1; i <= n; i++) {
      d.setPage(i); d.setFont('helvetica', 'normal'); d.setFontSize(7); d.setTextColor(148, 163, 184);
      d.text(`Emitido em ${emitido} · Documento confidencial (LGPD)`, 40, this.H - 24); d.text(`Página ${i} de ${n}`, this.W - 40, this.H - 24, { align: 'right' });
    }
  }
  salvar(nome: string) { this.finalizar(); if (ehNativo()) salvarArquivo(nome, this.base64(), 'application/pdf'); else this.doc.save(nome); }
  base64() { this.finalizar(); return (this.doc.output('datauristring') as string).split(',')[1]; }
}

export function pdfCliente(c: any, res: any, vendas: any[], emps: any[], obr: any[], pags: any[]) {
  const r = new Relatorio(`Relatório do cliente · ${c.nome}`, `Telefone ${c.telefone ?? '—'} · cliente desde ${dataBR(c.criado_em)}`);
  r.cartoes([['Total comprado', brl(res?.total_comprado)], ['Total emprestado', brl(res?.total_emprestado)], ['Pendente', brl(res?.valor_pendente)], ['Já pagou', brl(res?.valor_pago)]]);
  r.secao('Compras');
  r.tabela(['Data', 'Itens', 'Total', 'Situação'], vendas.map((v) => [dataBR(v.data), v.venda_itens.map((i: any) => `${i.quantidade}× ${i.produtos?.nome}`).join(', '), brl(v.total), v.status]), { numericas: [2], total: ['', 'Total', brl(vendas.reduce((t, v) => t + +v.total, 0)), ''] });
  r.secao('Empréstimos');
  r.tabela(['Data', 'Principal', 'Taxa', 'Total previsto', 'Vencimento', 'Situação'], emps.map((e) => [dataBR(e.data), brl(e.principal), `${e.taxa_pct}% ${e.periodicidade}`, brl(e.total_previsto), dataBR(e.vencimento), e.status]), { numericas: [1, 3] });
  r.secao('Pendências');
  const ab = obr.filter((o) => ['pendente', 'parcial', 'atrasado'].includes(o.situacao));
  r.tabela(['Descrição', 'Vencimento', 'Saldo', 'Situação'], ab.map((o) => [o.descricao, dataBR(o.vencimento), brl(o.saldo), o.situacao]), { numericas: [2], total: ['Total em aberto', '', brl(ab.reduce((t, o) => t + +o.saldo, 0)), ''] });
  r.secao('Pagamentos');
  r.tabela(['Data', 'Referente a', 'Valor', 'Juros'], pags.map((p) => [dataBR(p.data), p.obrigacoes?.descricao, brl(p.valor), brl(p.juros_valor)]), { numericas: [2, 3], total: ['', 'Total', brl(pags.reduce((t, p) => t + +p.valor, 0)), brl(pags.reduce((t, p) => t + +p.juros_valor, 0))] });
  r.salvar(`gfi-cliente-${c.nome.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

export function pdfCondicoesEmprestimo(e: any, obr: any[], pags: any[]) {
  const r = new Relatorio(`Resumo das condições · Empréstimo nº ${e.numero}`, `${e.clientes?.nome} · ${dataBR(e.data)}`);
  r.cartoes([['Principal', brl(e.principal)], ['Juros previstos', brl(e.juros_previstos)], ['Total previsto', brl(e.total_previsto)], ['Taxa mensal equiv.', pct(e.taxa_mensal_equivalente_pct)]]);
  r.secao('Condições'); r.texto(e.condicoes_texto ?? '');
  if (e.acima_limite_legal) r.texto('ATENÇÃO: a taxa informada está acima da referência legal configurada para mútuo entre particulares. O registro não implica que a taxa seja juridicamente permitida (Lei de Usura; Código Civil, arts. 406 e 591; Lei 1.521/51).');
  r.secao('Parcelas');
  r.tabela(['Parcela', 'Vencimento', 'Valor', 'Pago', 'Saldo', 'Situação'], obr.map((o) => [`${o.parcela_num}/${o.parcela_total}`, dataBR(o.vencimento), brl(o.valor), brl(o.valor_pago), brl(o.saldo), o.situacao]), { numericas: [2, 3, 4] });
  r.secao('Pagamentos recebidos');
  r.tabela(['Data', 'Valor', 'Juros', 'Principal'], pags.map((p) => [dataBR(p.data), brl(p.valor), brl(p.juros_valor), brl(p.principal_valor)]), { numericas: [1, 2, 3] });
  r.texto('Documento informativo gerado pelo sistema. Não substitui contrato redigido por advogado.', 8);
  r.salvar(`gfi-emprestimo-${e.numero}.pdf`);
}

export { mesNome };
