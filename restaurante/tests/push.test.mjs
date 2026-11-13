import test from 'node:test';
import assert from 'node:assert/strict';
import { criptografar, cabecalhoVapid, gerarChavesVapid, b64u, deB64u, enviarWebPush } from '../supabase/functions/rest-push/webpush.js';

// Vetor de teste oficial da RFC 8291 (Apêndice A)
const V = {
  texto: 'When I grow up, I want to be a watermelon',
  asPriv: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', asPub: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPub: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', uaPriv: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg', sal: 'DGv6ra1nlYgDCS1FRnbzlw',
  esperado: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
const par = async (pubB64, privB64, usos) => {
  const p = deB64u(pubB64); const jwk = { kty: 'EC', crv: 'P-256', x: b64u(p.slice(1, 33)), y: b64u(p.slice(33)), ext: true };
  return { publicKey: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []), privateKey: await crypto.subtle.importKey('jwk', { ...jwk, d: privB64 }, { name: 'ECDH', namedCurve: 'P-256' }, true, usos) };
};

test('criptografia aes128gcm confere com o vetor oficial da RFC 8291', async () => {
  const corpo = await criptografar(V.texto, V.uaPub, V.auth, { parLocal: await par(V.asPub, V.asPriv, ['deriveBits']), sal: deB64u(V.sal) });
  assert.equal(b64u(corpo), V.esperado);
});

test('o aparelho (lado do navegador) consegue descriptografar uma mensagem nova', async () => {
  const corpo = await criptografar(JSON.stringify({ titulo: 'Comunicado', acentos: 'ção ã é' }), V.uaPub, V.auth);
  // descriptografia independente, como o navegador faz
  const sal = corpo.slice(0, 16), idlen = corpo[20], asPub = corpo.slice(21, 21 + idlen), cifrado = corpo.slice(21 + idlen);
  const ua = await par(V.uaPub, V.uaPriv, ['deriveBits']);
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const hk = async (s, ikm, info, n) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));
  const e = new TextEncoder(); const j = (...a) => { const r = new Uint8Array(a.reduce((t, x) => t + x.length, 0)); let i = 0; for (const x of a) { r.set(x, i); i += x.length; } return r; };
  const ikm = await hk(deB64u(V.auth), ecdh, j(e.encode('WebPush: info\0'), deB64u(V.uaPub), asPub), 32);
  const cek = await hk(sal, ikm, e.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hk(sal, ikm, e.encode('Content-Encoding: nonce\0'), 12);
  const claro = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cifrado));
  assert.equal(claro[claro.length - 1], 2);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(claro.slice(0, -1))), { titulo: 'Comunicado', acentos: 'ção ã é' });
});

test('VAPID: JWT ES256 válido para o servidor de push', async () => {
  const vapid = { ...(await gerarChavesVapid()), contato: 'mailto:avisos@restaurante.app' };
  const h = await cabecalhoVapid('https://fcm.googleapis.com/fcm/send/abc', vapid, 1_800_000_000);
  const [, jwt, k] = h.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, vapid.publica);
  const [c, p, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(deB64u(p))), { aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 43200, sub: 'mailto:avisos@restaurante.app' });
  const pub = await crypto.subtle.importKey('raw', deB64u(vapid.publica), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, deB64u(s), new TextEncoder().encode(`${c}.${p}`)));
});

test('envio: cabeçalhos corretos e inscrição expirada (410) é identificada', async () => {
  const vapid = { ...(await gerarChavesVapid()), contato: 'mailto:a@b.c' };
  let pedido; const falso = async (url, o) => { pedido = { url, ...o }; return new Response('gone', { status: 410 }); };
  const r = await enviarWebPush({ endpoint: 'https://web.push.apple.com/x', chaves: { p256dh: V.uaPub, auth: V.auth } }, { titulo: 't' }, vapid, { urgencia: 'high', fetcher: falso });
  assert.deepEqual([r.ok, r.expirada], [false, true]);
  assert.equal(pedido.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(pedido.headers.Urgency, 'high');
  assert.match(pedido.headers.Authorization, /^vapid t=.+, k=/);
});
