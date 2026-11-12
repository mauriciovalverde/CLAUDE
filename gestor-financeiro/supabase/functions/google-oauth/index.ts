// google-oauth: conecta o Google Agenda via OAuth 2.0 (fluxo de servidor, access_type=offline).
//   POST .../google-oauth/iniciar      (JWT do usuário) -> { url }
//   GET  .../google-oauth/callback     (redirecionamento do Google)
//   POST .../google-oauth/desconectar  (JWT do usuário)
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { admin, cifrar, cors, decifrar, json, segredoInterno } from './comum.ts';

const SUPA = Deno.env.get('SUPABASE_URL')!;
const REDIRECT = Deno.env.get('GOOGLE_REDIRECT_URI') ?? `${SUPA}/functions/v1/google-oauth/callback`;
const APP = Deno.env.get('APP_URL') ?? 'https://mauriciovalverde.github.io/CLAUDE/gestor/';
// Agenda (eventos) + Gmail (somente ENVIAR; ler a caixa exigiria auditoria de segurança do Google)
const ESCOPOS = 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.send';

async function usuario(req: Request) {
  const u = createClient(SUPA, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await u.auth.getUser();
  return user;
}
const voltar = (q: string) => Response.redirect(`${APP}#/configuracoes?${q}`, 302);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const acao = new URL(req.url).pathname.split('/').pop();
  const db = admin();
  try {
    if (acao === 'iniciar') {
      const user = await usuario(req);
      if (!user) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      if (!Deno.env.get('GOOGLE_CLIENT_ID') || !Deno.env.get('GOOGLE_CLIENT_SECRET')) {
        return json({ ok: false, erro: 'google_nao_configurado', mensagem: 'Faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos secrets das Edge Functions.' });
      }
      const state = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const { error } = await db.from('integracoes').upsert({
        user_id: user.id, provedor: 'google_calendar', oauth_state: state,
        oauth_state_expira: new Date(Date.now() + 10 * 60000).toISOString(),
      }, { onConflict: 'user_id,provedor' });
      if (error) throw error;
      const p = new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, redirect_uri: REDIRECT, response_type: 'code', scope: ESCOPOS,
        access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state, login_hint: user.email ?? '',
      });
      return json({ ok: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${p}` });
    }

    if (acao === 'callback') {
      const u = new URL(req.url);
      const code = u.searchParams.get('code'), state = u.searchParams.get('state');
      if (u.searchParams.get('error')) return voltar('google=negado');
      if (!code || !state) return voltar('google=erro&motivo=parametros');
      const { data: integ } = await db.from('integracoes').select('*').eq('oauth_state', state).maybeSingle();
      if (!integ || new Date(integ.oauth_state_expira).getTime() < Date.now()) return voltar('google=erro&motivo=state');
      await db.from('integracoes').update({ oauth_state: null, oauth_state_expira: null }).eq('id', integ.id);

      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          redirect_uri: REDIRECT, grant_type: 'authorization_code',
        }),
      });
      const t = await r.json();
      if (!r.ok || !t.refresh_token) {
        await db.from('integracoes').update({ status: 'erro', ultimo_erro: t.error_description ?? t.error ?? 'sem refresh_token' }).eq('id', integ.id);
        return voltar('google=erro&motivo=token');
      }
      let email: string | null = null;
      try { email = JSON.parse(atob(t.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email; } catch { /* opcional */ }
      await db.from('integracoes').update({
        status: 'conectado', conta_email: email, escopos: t.scope, ultimo_erro: null,
        access_token_cifrado: await cifrar(t.access_token), refresh_token_cifrado: await cifrar(t.refresh_token),
        expira_em: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
      }).eq('id', integ.id);
      // reprocessa tudo que ficou pendente enquanto estava desconectado
      await db.from('agenda_sync_fila').update({ proxima_tentativa: new Date().toISOString(), tentativas: 0 })
        .eq('user_id', integ.user_id).is('processado_em', null);
      await fetch(`${SUPA}/functions/v1/agenda-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-interno': await segredoInterno(), Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ user_id: integ.user_id, forcar: true }),
      }).catch(() => {});
      return voltar('google=conectado');
    }

    if (acao === 'desconectar') {
      const user = await usuario(req);
      if (!user) return json({ ok: false, erro: 'nao_autenticado' }, 401);
      const { data: i } = await db.from('integracoes').select('*').eq('user_id', user.id).eq('provedor', 'google_calendar').maybeSingle();
      if (i?.refresh_token_cifrado) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(await decifrar(i.refresh_token_cifrado))}`, { method: 'POST' }).catch(() => {});
      }
      await db.from('integracoes').update({ status: 'desconectado', access_token_cifrado: null, refresh_token_cifrado: null, expira_em: null })
        .eq('user_id', user.id).eq('provedor', 'google_calendar');
      return json({ ok: true });
    }
    return json({ ok: false, erro: 'acao_desconhecida' }, 404);
  } catch (e) {
    return json({ ok: false, erro: String((e as Error).message ?? e) }, 500);
  }
});
