// Cobrar e lembrar SEM configurar nada: WhatsApp, e-mail do próprio celular e "adicionar ao Google Agenda".
import { brl, dataBR } from './fmt';
import { ehNativo } from './nativo';

export function textoCobranca(o: any, negocio?: string) {
  return `Olá, ${o.cliente_nome ?? ''}! Tudo bem? Passando para lembrar, com todo respeito, do pagamento de ${brl(o.saldo)} referente a ${String(o.descricao).split(' - ')[0].toLowerCase()}, com vencimento em ${dataBR(o.vencimento)}. Se já pagou, por favor desconsidere. Obrigado!${negocio ? `\n${negocio}` : ''}`;
}

export function linkWhatsApp(telefone: string | null | undefined, texto: string) {
  let d = String(telefone ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

export function linkEmail(email: string | null | undefined, assunto: string, corpo: string) {
  return `mailto:${encodeURIComponent(email ?? '')}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}

/** Abre o Google Agenda já com o evento preenchido (dia inteiro no vencimento). Não precisa de conexão/OAuth. */
export function linkGoogleAgenda(o: any) {
  const d = String(o.vencimento).replace(/-/g, '');
  const prox = new Date(o.vencimento + 'T12:00:00Z'); prox.setUTCDate(prox.getUTCDate() + 1);
  const d2 = prox.toISOString().slice(0, 10).replace(/-/g, '');
  const verbo = o.tipo === 'pagar' ? 'PAGAR' : o.origem === 'emprestimo' ? 'RECEBER' : 'COBRAR';
  const quem = (o.cliente_nome ?? o.fornecedor_nome ?? String(o.descricao).split(' - ')[0]).toUpperCase();
  const titulo = `${verbo} ${quem} - ${brl(o.saldo > 0 ? o.saldo : o.valor)}`;
  const det = `${o.descricao}\nValor em aberto: ${brl(o.saldo)}\nVencimento: ${dataBR(o.vencimento)}${o.cliente_telefone ? `\nTelefone: ${o.cliente_telefone}` : ''}\n(Gestor Financeiro)`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${d}/${d2}&details=${encodeURIComponent(det)}`;
}

export async function abrirLink(url: string) {
  if (url.startsWith('mailto:') || !ehNativo()) { window.open(url, url.startsWith('mailto:') ? '_self' : '_blank'); return; }
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url });
}
