// rest-agenda: calendário (.ics) com os vencimentos do restaurante, para assinar no Google Agenda ("Adicionar agenda → Por URL").
// O Google relê o endereço sozinho: conta nova, vencimento alterado ou conta paga aparecem atualizados sem duplicar (UID fixo por conta).
// GET /functions/v1/rest-agenda?t=<token secreto do restaurante>
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const dia = (d: string) => d.replaceAll('-', '');
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const somaDia = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
// linhas de no máximo 75 bytes (RFC 5545)
const dobrar = (l: string) => { const out: string[] = []; let s = l; while (new TextEncoder().encode(s).length > 74) { let n = 74; while (new TextEncoder().encode(s.slice(0, n)).length > 74) n--; out.push(s.slice(0, n)); s = ' ' + s.slice(n); } out.push(s); return out.join('\r\n'); };

Deno.serve(async (req) => {
  const t = new URL(req.url).searchParams.get('t') ?? '';
  if (!/^[a-f0-9]{64}$/.test(t)) return new Response('token inválido', { status: 404 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: r } = await db.from('rest_restaurantes').select('id,nome').eq('agenda_token', t).maybeSingle();
  if (!r) return new Response('não encontrado', { status: 404 });
  const desde = new Date(Date.now() - 45 * 86400_000).toISOString().slice(0, 10);
  const { data: contas } = await db.from('rest_contas').select('id,numero,tipo,descricao,valor,vencimento,status,pago_em,atualizado_em,nota_numero')
    .eq('restaurante_id', r.id).neq('status', 'cancelado').gte('vencimento', desde).order('vencimento').limit(2000);
  const agora = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Restaurante Inteligente//Vencimentos//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(`${r.nome} · Contas`)}`, 'X-WR-TIMEZONE:America/Bahia', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'];
  for (const c of contas ?? []) {
    // contas pagas há muito tempo saem do calendário; recentes ficam marcadas como pagas
    if (c.status === 'pago' && c.vencimento < desde) continue;
    const verbo = c.tipo === 'pagar' ? 'Pagar' : 'Receber';
    const titulo = c.status === 'pago' ? `✅ ${c.tipo === 'pagar' ? 'Pago' : 'Recebido'}: ${c.descricao} (${brl(Number(c.valor))})` : `${verbo}: ${c.descricao} — ${brl(Number(c.valor))}`;
    const desc = [`Conta #${c.numero}`, c.nota_numero ? `Nota ${c.nota_numero}` : '', c.status === 'pago' ? `Pago em ${c.pago_em?.split('-').reverse().join('/')}` : 'Em aberto'].filter(Boolean).join(' · ');
    linhas.push('BEGIN:VEVENT', `UID:conta-${c.id}@restaurante-inteligente`, `DTSTAMP:${agora}`,
      `LAST-MODIFIED:${new Date(c.atualizado_em).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${dia(c.vencimento)}`, `DTEND;VALUE=DATE:${dia(somaDia(c.vencimento, 1))}`,
      `SUMMARY:${esc(titulo)}`, `DESCRIPTION:${esc(desc)}`, 'TRANSP:TRANSPARENT', 'STATUS:CONFIRMED');
    if (c.status !== 'pago') {
      for (const [gat, txt] of [['-P3D', '3 dias'], ['-P1D', '1 dia'], ['PT9H', 'hoje']] as const) {
        linhas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${verbo} ${c.descricao} (${txt})`)}`, `TRIGGER${gat.startsWith('PT') ? ';RELATED=START' : ''}:${gat}`, 'END:VALARM');
      }
    }
    linhas.push('END:VEVENT');
  }
  linhas.push('END:VCALENDAR');
  return new Response(linhas.map(dobrar).join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Disposition': `inline; filename="contas.ics"`, 'Access-Control-Allow-Origin': '*' },
  });
});
