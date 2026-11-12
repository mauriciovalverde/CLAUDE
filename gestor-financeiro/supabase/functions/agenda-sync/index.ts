// agenda-sync: processa a fila agenda_sync_fila e sincroniza cada obrigação com o Google Agenda.
// Chamado pelo app (JWT do usuário: só a fila dele) ou internamente (x-interno = HMAC da service role).
// Sincronização só é considerada feita quando a API do Google responde 2xx e o ID do evento é salvo.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { admin, cors, json, segredoInterno, tokenGoogle } from './comum.ts';

type Obr = Record<string, any>;

const brl = (v: number) =>
  'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(Number(v)) ? 0 : 2, maximumFractionDigits: 2 });

function titulo(o: Obr): string {
  const valor = brl(o.saldo > 0 ? o.saldo : o.valor);
  const parc = o.parcela_total > 1 ? ` (${o.parcela_num}/${o.parcela_total})` : '';
  if (o.tipo === 'pagar') {
    const nome = o.fornecedor_nome || String(o.descricao).split(' - ')[0];
    return `PAGAR ${String(nome).toUpperCase()} - ${valor}${parc}`;
  }
  const nome = String(o.cliente_nome || 'CLIENTE').toUpperCase();
  if (o.origem === 'emprestimo') return `RECEBER ${nome} - ${valor} - EMPRÉSTIMO${parc}`;
  const desc = String(o.descricao).split(' - ')[0].toUpperCase();
  return `COBRAR ${nome} - ${valor} - ${desc}${parc}`;
}

function descricao(o: Obr, appUrl: string): string {
  const fmtData = (d: string) => d.split('-').reverse().join('/');
  return [
    o.cliente_nome ? `Cliente: ${o.cliente_nome}` : o.fornecedor_nome ? `Fornecedor: ${o.fornecedor_nome}` : null,
    o.cliente_telefone ? `Telefone: ${o.cliente_telefone}` : null,
    `Valor em aberto: ${brl(o.saldo)} (total ${brl(o.valor)})`,
    o.valor_pago > 0 ? `Pago até agora: ${brl(o.valor_pago)}` : null,
    `Operação: ${o.descricao}${o.parcela_total > 1 ? ` · Parcela ${o.parcela_num}/${o.parcela_total}` : ''}`,
    `Vencimento: ${fmtData(o.vencimento)}`,
    `Escopo: ${o.escopo}`,
    `ID no sistema: OB-${String(o.numero).padStart(6, '0')} (${o.id})`,
    `Abrir: ${appUrl}#/contas`,
  ].filter(Boolean).join('\n');
}

function corpoEvento(o: Obr, cfg: Obr, appUrl: string) {
  const hora = String(cfg.hora_evento ?? '09:00').slice(0, 5);
  const [h, m] = hora.split(':').map(Number);
  const fim = `${String(h + (m + 30 >= 60 ? 1 : 0)).padStart(2, '0')}:${String((m + 30) % 60).padStart(2, '0')}`;
  const lembretes = (cfg.lembretes_minutos ?? [4320, 1440, 0]).slice(0, 5).map((min: number) => ({ method: 'popup', minutes: Math.min(min, 40320) }));
  return {
    summary: titulo(o),
    description: descricao(o, appUrl),
    start: { dateTime: `${o.vencimento}T${hora}:00`, timeZone: cfg.fuso ?? 'America/Bahia' },
    end: { dateTime: `${o.vencimento}T${fim}:00`, timeZone: cfg.fuso ?? 'America/Bahia' },
    reminders: { useDefault: false, overrides: lembretes },
    extendedProperties: { private: { gfi_obrigacao_id: o.id, gfi_origem: o.origem, gfi_versao: '1' } },
    colorId: o.tipo === 'receber' ? '11' : '6',
  };
}

async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function google(token: string, metodo: string, url: string, corpo?: unknown) {
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const txt = await r.text();
  let dados: any = null;
  try { dados = txt ? JSON.parse(txt) : null; } catch { dados = txt; }
  return { status: r.status, ok: r.ok, dados };
}

export async function processar(opts: { userId?: string; ids?: string[]; forcar?: boolean }) {
  const db = admin();
  const appUrl = Deno.env.get('APP_URL') ?? 'https://mauriciovalverde.github.io/CLAUDE/gestor/';
  // rotina diária (atrasos e recorrências) é barata e idempotente: roda junto
  await db.rpc('rotina_diaria').then(() => {}, () => {});

  let q = db.from('agenda_sync_fila').select('*').is('processado_em', null).order('criado_em').limit(50);
  if (opts.userId) q = q.eq('user_id', opts.userId);
  if (opts.ids?.length) q = q.in('obrigacao_id', opts.ids);
  if (!opts.forcar && !opts.ids?.length) q = q.lte('proxima_tentativa', new Date().toISOString());
  const { data: fila, error } = await q;
  if (error) throw error;

  const res = { processados: 0, sincronizados: 0, pendentes: 0, erros: 0, detalhes: [] as unknown[] };
  const tokens = new Map<string, { token: string | null; motivo?: string }>();
  const cfgs = new Map<string, Obr>();

  for (const item of fila ?? []) {
    res.processados++;
    if (!tokens.has(item.user_id)) tokens.set(item.user_id, await tokenGoogle(db, item.user_id));
    if (!cfgs.has(item.user_id)) {
      const { data } = await db.from('configuracoes').select('*').eq('user_id', item.user_id).maybeSingle();
      cfgs.set(item.user_id, data ?? {});
    }
    const tk = tokens.get(item.user_id)!;
    const cfg = cfgs.get(item.user_id)!;
    const marcarErro = async (msg: string, pendente = false) => {
      const tentativas = item.tentativas + 1;
      const atraso = pendente ? 60 : Math.min(2 ** tentativas, 360);
      await db.from('agenda_sync_fila').update({
        tentativas, ultimo_erro: msg, proxima_tentativa: new Date(Date.now() + atraso * 60000).toISOString(),
      }).eq('id', item.id);
      await db.from('agenda_eventos').update({ status: pendente ? 'pendente' : 'erro', ultimo_erro: msg }).eq('obrigacao_id', item.obrigacao_id);
      if (pendente) res.pendentes++; else res.erros++;
      res.detalhes.push({ obrigacao_id: item.obrigacao_id, status: pendente ? 'pendente' : 'erro', motivo: msg });
    };
    if (!tk.token) { await marcarErro(tk.motivo ?? 'google_desconectado', true); continue; }

    const { data: o } = await db.from('v_obrigacoes').select('*').eq('id', item.obrigacao_id).maybeSingle();
    const { data: ev } = await db.from('agenda_eventos').select('*').eq('obrigacao_id', item.obrigacao_id).maybeSingle();
    const cal = encodeURIComponent(cfg.agenda_calendar_id || 'primary');
    const base = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`;
    const concluir = async (patch: Obr, status: string) => {
      await db.from('agenda_eventos').update({ ...patch, status, ultima_sync: new Date().toISOString(), ultimo_erro: null })
        .eq('obrigacao_id', item.obrigacao_id);
      await db.from('agenda_sync_fila').update({ processado_em: new Date().toISOString(), ultimo_erro: null }).eq('id', item.id);
      res.sincronizados++;
      res.detalhes.push({ obrigacao_id: item.obrigacao_id, status, google_event_id: patch.google_event_id ?? ev?.google_event_id, link: patch.html_link ?? ev?.html_link });
    };

    try {
      const cancelar = item.acao === 'cancelar' || !o || ['cancelado', 'renegociado'].includes(o.status);
      // localizar evento existente (pelo ID salvo ou pela propriedade privada, para nunca duplicar)
      let eventId: string | null = ev?.google_event_id ?? null;
      if (!eventId) {
        const busca = await google(tk.token, 'GET', `${base}?privateExtendedProperty=${encodeURIComponent('gfi_obrigacao_id=' + item.obrigacao_id)}&showDeleted=false`);
        if (busca.ok && busca.dados?.items?.length) eventId = busca.dados.items[0].id;
      }

      if (cancelar || (o.saldo <= 0 && (cfg.agenda_ao_pagar === 'excluir' || !eventId))) {
        if (eventId) {
          const r = await google(tk.token, 'DELETE', `${base}/${eventId}`);
          if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`Google ${r.status}: ${JSON.stringify(r.dados)}`);
        }
        await concluir({ google_event_id: null, html_link: null }, 'cancelado');
        continue;
      }

      let corpo: Obr;
      if (o.saldo <= 0) {
        const atual = corpoEvento({ ...o, saldo: o.valor }, cfg, appUrl);
        corpo = { ...atual, summary: `✅ PAGO - ${atual.summary}`, colorId: '2', reminders: { useDefault: false, overrides: [] } };
      } else corpo = corpoEvento(o, cfg, appUrl);

      const hash = await sha256(JSON.stringify(corpo));
      if (eventId && ev?.hash_conteudo === hash && ev?.status === 'sincronizado') { await concluir({}, 'sincronizado'); continue; }

      let r = eventId ? await google(tk.token, 'PATCH', `${base}/${eventId}`, corpo) : null;
      if (!r || r.status === 404 || r.status === 410) r = await google(tk.token, 'POST', base, corpo);
      if (!r.ok) throw new Error(`Google ${r.status}: ${JSON.stringify(r.dados?.error?.message ?? r.dados)}`);
      await concluir({ google_event_id: r.dados.id, html_link: r.dados.htmlLink, calendar_id: cfg.agenda_calendar_id || 'primary', hash_conteudo: hash }, 'sincronizado');
    } catch (e) {
      await marcarErro(String((e as Error).message ?? e));
    }
  }
  return res;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const interno = req.headers.get('x-interno');
    if (interno && interno === (await segredoInterno())) {
      return json(await processar({ userId: body.user_id, ids: body.obrigacao_ids, forcar: body.forcar }));
    }
    const auth = req.headers.get('Authorization') ?? '';
    const u = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await u.auth.getUser();
    if (!user) return json({ ok: false, erro: 'nao_autenticado' }, 401);
    if (body.reconstruir) {
      // recoloca todas as obrigações em aberto do usuário na fila (sem duplicar: a fila e o evento são únicos por obrigação)
      const db = admin();
      const { data: abertas } = await db.from('obrigacoes').select('id').eq('user_id', user.id).in('status', ['pendente', 'parcial']).is('excluido_em', null);
      for (const o of abertas ?? []) await db.rpc('enfileirar_agenda', { p_obrigacao: o.id, p_acao: 'upsert' });
      await db.from('agenda_eventos').update({ hash_conteudo: null }).eq('user_id', user.id);
    }
    const r = await processar({ userId: user.id, ids: body.obrigacao_ids, forcar: body.forcar ?? true });
    return json({ ok: true, ...r });
  } catch (e) {
    return json({ ok: false, erro: String((e as Error).message ?? e) }, 500);
  }
});
