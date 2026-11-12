// Utilitários compartilhados pelas Edge Functions (copiado em cada função no deploy).
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-interno',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
export const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// Chave AES-256-GCM: TOKEN_ENCRYPTION_KEY (se definida) ou derivada (HKDF) da service role key, que só existe no servidor.
async function chave(): Promise<CryptoKey> {
  const seg = Deno.env.get('TOKEN_ENCRYPTION_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const base = await crypto.subtle.importKey('raw', enc.encode(seg), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('gfi-tokens-v1'), info: enc.encode('google') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function cifrar(txt: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(), enc.encode(txt)));
  return `${b64(iv)}.${b64(c)}`;
}
export async function decifrar(s: string): Promise<string> {
  const [iv, c] = s.split('.');
  const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await chave(), unb64(c));
  return new TextDecoder().decode(p);
}

// Segredo para chamadas entre funções (HMAC da service role key; nunca sai do servidor)
export async function segredoInterno(): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode('gfi-interno')));
  return [...s].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Devolve um access token válido do Google para o usuário (renovando se preciso)
export async function tokenGoogle(db: SupabaseClient, userId: string): Promise<{ token: string | null; motivo?: string }> {
  const { data: i } = await db.from('integracoes').select('*').eq('user_id', userId).eq('provedor', 'google_calendar').maybeSingle();
  if (!i || i.status !== 'conectado' || !i.refresh_token_cifrado) return { token: null, motivo: 'google_desconectado' };
  if (i.access_token_cifrado && i.expira_em && new Date(i.expira_em).getTime() > Date.now() + 60_000) {
    return { token: await decifrar(i.access_token_cifrado) };
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: await decifrar(i.refresh_token_cifrado),
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!r.ok) {
    const revogado = d.error === 'invalid_grant';
    await db.from('integracoes').update({ status: revogado ? 'revogado' : 'erro', ultimo_erro: d.error_description ?? d.error }).eq('id', i.id);
    return { token: null, motivo: revogado ? 'google_revogado_reconectar' : 'google_erro_token' };
  }
  await db.from('integracoes').update({
    access_token_cifrado: await cifrar(d.access_token),
    expira_em: new Date(Date.now() + (d.expires_in ?? 3600) * 1000).toISOString(),
    ultimo_erro: null,
  }).eq('id', i.id);
  return { token: d.access_token };
}
