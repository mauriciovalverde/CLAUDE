// rest-push: notificações push dos comunicados (Web Push/VAPID para navegador e iPhone; FCM para o app Android).
//   { acao: 'chave' }                                             -> { publica }            chave VAPID pública para o app inscrever o aparelho
//   (logado, admin) { acao: 'enviar', comunicado_id, motivo: 'envio'|'reenvio'|'atualizacao'|'cancelamento', funcionarios? }
//   (logado) { acao: 'testar' }                                    envia um teste para os aparelhos da própria pessoa
//   { acao: 'entregue', id, token }                                 confirmação técnica de entrega (chamada pelo aparelho ao receber)
//   (agendador, cabeçalho x-cron-secret) { acao: 'cron' }          libera agendados e envia lembretes
// A entrega NÃO é leitura: leitura só é registrada quando o funcionário abre e confirma no app.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { enviarFcm, enviarWebPush } from './webpush.js';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const URL_SB = Deno.env.get('SUPABASE_URL')!;
const servico = () => createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const VAPID = { publica: Deno.env.get('VAPID_PUBLICA') ?? '', privada: Deno.env.get('VAPID_PRIVADA') ?? '', contato: Deno.env.get('VAPID_CONTATO') ?? 'mailto:avisos@restaurante.app' };
const FCM = (() => { try { const s = Deno.env.get('FCM_CONTA_SERVICO'); return s ? JSON.parse(s) : null; } catch { return null; } })();
const PRIO: Record<string, string> = { normal: 'Normal', importante: 'IMPORTANTE', urgente: 'URGENTE' };
const MOTIVO: Record<string, string> = { envio: '', reenvio: 'Lembrete: ', lembrete: 'Lembrete: ', aviso_final: 'Prazo terminando: ', atualizacao: 'MENSAGEM ATUALIZADA: ', cancelamento: 'CANCELADO: ', teste: '' };

type Db = ReturnType<typeof servico>;
const previa = (t: string) => (t.length > 120 ? t.slice(0, 117).trimEnd() + '…' : t);

/** Envia para todos os aparelhos ativos de cada funcionário e registra cada tentativa. */
async function disparar(db: Db, com: any, empresa: string, funcionarios: string[], motivo: string) {
  if (!funcionarios.length) return { enviados: 0, sem_aparelho: 0, erros: 0 };
  const { data: aparelhos } = await db.from('rest_push_dispositivos').select('*').in('funcionario_id', funcionarios).eq('ativo', true);
  let enviados = 0, sem = 0, erros = 0;
  for (const f of funcionarios) {
    const meus = (aparelhos ?? []).filter((a: any) => a.funcionario_id === f);
    if (!meus.length) { sem++; await db.from('rest_push_envios').insert({ restaurante_id: com.restaurante_id, comunicado_id: com.id ?? null, funcionario_id: f, motivo, status: 'sem_dispositivo' }); continue; }
    for (const a of meus) {
      const { data: env } = await db.from('rest_push_envios').insert({ restaurante_id: com.restaurante_id, comunicado_id: com.id ?? null, funcionario_id: f, dispositivo_id: a.id, motivo }).select('id, token').single();
      const dados = {
        titulo: `${empresa}${com.prioridade && com.prioridade !== 'normal' ? ' · ' + PRIO[com.prioridade] : ''}`,
        corpo: `${MOTIVO[motivo] ?? ''}${com.titulo}\n${previa(motivo === 'cancelamento' ? 'Este comunicado foi cancelado: ' + (com.motivo_cancelamento ?? '') : com.conteudo ?? '')}`,
        prioridade: com.prioridade ?? 'normal', enviado_em: new Date().toISOString(), comunicado_id: com.id ?? '',
        url: com.id ? `#/comunicados?id=${com.id}` : '#/comunicados', envio_id: env!.id, token: env!.token, tag: `com-${com.id ?? 'teste'}`,
      };
      let r: { ok: boolean; expirada?: boolean; erro?: string; status?: number };
      try {
        if (a.tipo === 'webpush') {
          if (!VAPID.privada) throw new Error('VAPID não configurado no servidor');
          r = await enviarWebPush({ endpoint: a.endpoint, chaves: a.chaves }, dados, VAPID, { urgencia: com.prioridade === 'urgente' ? 'high' : 'normal', ttl: 4 * 86400 });
        } else {
          if (!FCM) throw new Error('Firebase (FCM) ainda não configurado: o app Android não recebe push');
          r = await enviarFcm(a.endpoint, dados, FCM, { urgente: com.prioridade === 'urgente' });
        }
      } catch (e) { r = { ok: false, erro: String((e as Error).message ?? e) }; }
      if (r.ok) { enviados++; await db.from('rest_push_dispositivos').update({ ultimo_envio_em: new Date().toISOString(), falhas: 0, ultimo_erro: null }).eq('id', a.id); }
      else {
        erros++;
        await db.from('rest_push_envios').update({ status: 'erro', erro: `${r.status ?? ''} ${r.erro ?? ''}`.trim().slice(0, 300) }).eq('id', env!.id);
        await db.from('rest_push_dispositivos').update({ falhas: (a.falhas ?? 0) + 1, ultimo_erro: (r.erro || `HTTP ${r.status}`).slice(0, 300), ultimo_erro_em: new Date().toISOString(), ...(r.expirada || (a.falhas ?? 0) >= 9 ? { ativo: false } : {}) }).eq('id', a.id);
      }
    }
  }
  return { enviados, sem_aparelho: sem, erros };
}

async function marcarDest(db: Db, comId: string, funcs: string[], motivo: string) {
  if (!funcs.length) return;
  const agora = new Date().toISOString();
  if (motivo === 'envio') await db.from('rest_comunicado_dest').update({ push_enviado_em: agora }).eq('comunicado_id', comId).in('funcionario_id', funcs).is('push_enviado_em', null);
  if (motivo === 'aviso_final') await db.from('rest_comunicado_dest').update({ aviso_final_em: agora }).eq('comunicado_id', comId).in('funcionario_id', funcs);
  if (motivo === 'lembrete' || motivo === 'reenvio') {
    const { data } = await db.from('rest_comunicado_dest').select('id, lembretes').eq('comunicado_id', comId).in('funcionario_id', funcs);
    for (const d of data ?? []) await db.from('rest_comunicado_dest').update({ ultimo_lembrete_em: agora, lembretes: (d.lembretes ?? 0) + 1 }).eq('id', d.id);
  }
}

async function comunicado(db: Db, id: string) {
  const { data } = await db.from('rest_comunicados').select('*, rest_restaurantes(nome)').eq('id', id).single();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const b = req.method === 'GET' ? { acao: 'chave' } : await req.json().catch(() => ({}));
    const db = servico();
    if (b.acao === 'chave') return json({ ok: true, publica: VAPID.publica, fcm: !!FCM });

    if (b.acao === 'entregue') {
      const { data: e } = await db.from('rest_push_envios').select('*').eq('id', b.id).maybeSingle();
      if (!e || e.token !== b.token) return json({ ok: false }, 403);
      if (!e.entregue_em) {
        const agora = new Date().toISOString();
        await db.from('rest_push_envios').update({ status: 'entregue', entregue_em: agora }).eq('id', e.id);
        if (e.dispositivo_id) await db.from('rest_push_dispositivos').update({ ultima_entrega_em: agora, falhas: 0 }).eq('id', e.dispositivo_id);
        if (e.comunicado_id) await db.from('rest_comunicado_dest').update({ entregue_em: agora }).eq('comunicado_id', e.comunicado_id).eq('funcionario_id', e.funcionario_id).is('entregue_em', null);
      }
      return json({ ok: true });
    }

    if (b.acao === 'cron') {
      const segredo = Deno.env.get('CRON_SECRET');
      if (!segredo || req.headers.get('x-cron-secret') !== segredo) return json({ ok: false }, 403);
      const { data: t, error } = await db.rpc('rest_com_tarefas');
      if (error) throw error;
      const grupos = new Map<string, { funcs: string[]; motivo: string }>();
      for (const x of t.liberar) { const k = x.comunicado_id + '|envio'; grupos.set(k, { funcs: [...(grupos.get(k)?.funcs ?? []), x.funcionario_id], motivo: 'envio' }); }
      for (const x of t.lembretes) { const k = x.comunicado_id + '|' + x.motivo; grupos.set(k, { funcs: [...(grupos.get(k)?.funcs ?? []), x.funcionario_id], motivo: x.motivo }); }
      const res: any[] = [];
      for (const [k, g] of grupos) {
        const c = await comunicado(db, k.split('|')[0]); if (!c || c.status !== 'enviado') continue;
        await marcarDest(db, c.id, g.funcs, g.motivo);
        res.push({ comunicado: c.id, motivo: g.motivo, ...(await disparar(db, c, c.rest_restaurantes?.nome ?? 'Restaurante', g.funcs, g.motivo)) });
      }
      return json({ ok: true, resultado: res });
    }

    // daqui para baixo: usuário logado
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: u } = await db.auth.getUser(jwt);
    if (!u?.user) return json({ ok: false, mensagem: 'Faça login' }, 401);
    const { data: eu } = await db.from('rest_funcionarios').select('id, restaurante_id, papeis, ativo, rest_restaurantes(nome)').eq('user_id', u.user.id).eq('ativo', true).maybeSingle();
    if (!eu) return json({ ok: false, mensagem: 'Acesso inativo' }, 403);
    const empresa = (eu as any).rest_restaurantes?.nome ?? 'Restaurante';

    if (b.acao === 'testar') {
      const r = await disparar(db, { restaurante_id: eu.restaurante_id, titulo: 'Notificações ativadas', conteudo: 'Você vai receber aqui os comunicados da equipe.', prioridade: 'normal' }, empresa, [eu.id], 'teste');
      return json({ ok: r.enviados > 0, ...r });
    }

    if (b.acao === 'enviar') {
      if (!eu.papeis.includes('admin')) return json({ ok: false, mensagem: 'Somente a administração' }, 403);
      const c = await comunicado(db, b.comunicado_id);
      if (!c || c.restaurante_id !== eu.restaurante_id) return json({ ok: false, mensagem: 'Comunicado não encontrado' }, 404);
      const motivo = ['envio', 'reenvio', 'atualizacao', 'cancelamento'].includes(b.motivo) ? b.motivo : 'envio';
      if (c.status === 'agendado') return json({ ok: true, agendado: true });
      if (c.status === 'cancelado' && motivo !== 'cancelamento') return json({ ok: false, mensagem: 'Comunicado cancelado' });
      let q = db.from('rest_comunicado_dest').select('funcionario_id, push_enviado_em, confirmado_em, precisa_reconfirmar, aberto_em').eq('comunicado_id', c.id);
      if (Array.isArray(b.funcionarios) && b.funcionarios.length) q = q.in('funcionario_id', b.funcionarios);
      const { data: dest } = await q;
      let alvo = (dest ?? []) as any[];
      if (motivo === 'envio') alvo = alvo.filter((d) => !d.push_enviado_em);
      if (motivo === 'reenvio') alvo = alvo.filter((d) => (c.obrigatoria ? !d.confirmado_em || d.precisa_reconfirmar : !d.aberto_em));
      if (motivo === 'cancelamento') alvo = alvo.filter((d) => d.push_enviado_em);
      // anti-excesso: reenvio manual no máximo 1 vez a cada 30 min por pessoa
      if (motivo === 'reenvio' && alvo.length) {
        const { data: rec } = await db.from('rest_push_envios').select('funcionario_id').eq('comunicado_id', c.id).in('motivo', ['reenvio', 'lembrete']).gte('criado_em', new Date(Date.now() - 30 * 60000).toISOString());
        const recentes = new Set((rec ?? []).map((r: any) => r.funcionario_id));
        alvo = alvo.filter((d) => !recentes.has(d.funcionario_id));
      }
      const funcs = alvo.map((d) => d.funcionario_id);
      await marcarDest(db, c.id, funcs, motivo);
      return json({ ok: true, pessoas: funcs.length, ...(await disparar(db, c, empresa, funcs, motivo)) });
    }
    return json({ ok: false, mensagem: 'Ação desconhecida' }, 400);
  } catch (e) {
    return json({ ok: false, mensagem: String((e as Error).message ?? e) }, 500);
  }
});
