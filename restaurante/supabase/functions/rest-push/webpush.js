// Web Push sem dependências (só Web Crypto): VAPID (RFC 8292) + criptografia aes128gcm (RFC 8291 / RFC 8188).
// Funciona no Deno (Supabase Edge Functions) e no Node 20+ (testes em tests/push.test.mjs).

const enc = new TextEncoder();
export const b64u = (buf) => { const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const deB64u = (s) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
const juntar = (...partes) => { const n = partes.reduce((t, p) => t + p.length, 0); const r = new Uint8Array(n); let i = 0; for (const p of partes) { r.set(p, i); i += p.length; } return r; };

async function hkdf(sal, ikm, info, tamanho) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, k, tamanho * 8));
}

/** Gera o par de chaves VAPID (guardar a privada como segredo do servidor). */
export async function gerarChavesVapid() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  return { publica: b64u(pub), privada: jwk.d };
}

async function chavePrivadaVapid(publicaB64, privadaB64) {
  const pub = deB64u(publicaB64);
  return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: privadaB64, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/** Cabeçalho Authorization VAPID (JWT ES256 com validade de 12 h). */
export async function cabecalhoVapid(endpoint, vapid, agora = Math.floor(Date.now() / 1000)) {
  const aud = new URL(endpoint).origin;
  const cab = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corpo = b64u(enc.encode(JSON.stringify({ aud, exp: agora + 12 * 3600, sub: vapid.contato })));
  const chave = await chavePrivadaVapid(vapid.publica, vapid.privada);
  const ass = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chave, enc.encode(`${cab}.${corpo}`)));
  return `vapid t=${cab}.${corpo}.${b64u(ass)}, k=${vapid.publica}`;
}

/** Criptografa a mensagem para a inscrição do navegador (aes128gcm, um único registro). */
export async function criptografar(texto, p256dhB64, authB64, opcoes = {}) {
  const uaPub = deB64u(p256dhB64); const segredo = deB64u(authB64);
  const local = opcoes.parLocal ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaChave = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaChave }, local.privateKey, 256));
  const ikm = await hkdf(segredo, ecdh, juntar(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const sal = opcoes.sal ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const claro = juntar(enc.encode(texto), new Uint8Array([2])); // delimitador do último registro
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, claro));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return juntar(sal, rs, new Uint8Array([asPub.length]), asPub, cifrado);
}

/**
 * Envia um push. Retorna { ok, status, expirada } — expirada = a inscrição não existe mais (404/410) e deve ser desativada.
 * urgencia: very-low | low | normal | high (comunicado urgente usa high para acordar o aparelho).
 */
export async function enviarWebPush(inscricao, dados, vapid, { ttl = 86400, urgencia = 'normal', fetcher = fetch } = {}) {
  const corpo = await criptografar(JSON.stringify(dados), inscricao.chaves.p256dh, inscricao.chaves.auth);
  const r = await fetcher(inscricao.endpoint, {
    method: 'POST',
    headers: { Authorization: await cabecalhoVapid(inscricao.endpoint, vapid), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: urgencia },
    body: corpo,
  });
  const texto = r.ok ? '' : (await r.text().catch(() => '')).slice(0, 200);
  return { ok: r.ok, status: r.status, expirada: r.status === 404 || r.status === 410, erro: texto };
}

// ===== Firebase Cloud Messaging (app Android nativo) — HTTP v1 com conta de serviço =====
let tokenFcm = null;
async function acessoFcm(conta, fetcher) {
  if (tokenFcm && tokenFcm.ate > Date.now() + 60000) return tokenFcm.valor;
  const agora = Math.floor(Date.now() / 1000);
  const cab = b64u(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const corpo = b64u(enc.encode(JSON.stringify({ iss: conta.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 })));
  const pem = conta.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const chave = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const ass = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, enc.encode(`${cab}.${corpo}`)));
  const r = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${cab}.${corpo}.${b64u(ass)}` });
  const j = await r.json(); if (!j.access_token) throw new Error('FCM: ' + JSON.stringify(j).slice(0, 200));
  tokenFcm = { valor: j.access_token, ate: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return tokenFcm.valor;
}
export async function enviarFcm(token, dados, conta, { urgente = false, fetcher = fetch } = {}) {
  const acesso = await acessoFcm(conta, fetcher);
  const r = await fetcher(`https://fcm.googleapis.com/v1/projects/${conta.project_id}/messages:send`, {
    method: 'POST', headers: { Authorization: `Bearer ${acesso}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token, notification: { title: dados.titulo, body: dados.corpo }, data: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, String(v ?? '')])),
      android: { priority: urgente ? 'HIGH' : 'NORMAL', notification: { channel_id: urgente ? 'urgente' : 'comunicados', click_action: 'FCM_PLUGIN_ACTIVITY' } } } }),
  });
  const j = await r.json().catch(() => ({}));
  const expirada = r.status === 404 || j?.error?.details?.some?.((d) => d.errorCode === 'UNREGISTERED');
  return { ok: r.ok, status: r.status, expirada, erro: r.ok ? '' : JSON.stringify(j).slice(0, 200) };
}
