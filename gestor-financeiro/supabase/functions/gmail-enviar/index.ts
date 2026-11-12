// gmail-enviar: envia e-mail pelo Gmail do próprio usuário (escopo gmail.send), com anexo PDF opcional.
// POST { para, assunto, html, anexo_base64?, anexo_nome?, tipo?, cliente_id?, obrigacao_id? }
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { admin, cors, json, tokenGoogle } from './comum.ts';

const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const utf8b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const cabecalho = (s: string) => `=?UTF-8?B?${utf8b64(s)}?=`;

function mime(de: string, para: string, assunto: string, html: string, anexo?: { nome: string; base64: string }) {
  const lim = 'gfi_' + crypto.randomUUID().replace(/-/g, '');
  const partes = [
    `From: ${de}`, `To: ${para}`, `Subject: ${cabecalho(assunto)}`, 'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${lim}"`, '',
    `--${lim}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', utf8b64(html).replace(/.{76}/g, '$&\r\n'),
  ];
  if (anexo) partes.push(`--${lim}`, `Content-Type: application/pdf; name="${anexo.nome}"`, `Content-Disposition: attachment; filename="${anexo.nome}"`,
    'Content-Transfer-Encoding: base64', '', anexo.base64.replace(/.{76}/g, '$&\r\n'));
  partes.push(`--${lim}--`, '');
  return partes.join('\r\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const auth = req.headers.get('Authorization') ?? '';
  const u = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await u.auth.getUser();
  if (!user) return json({ ok: false, erro: 'nao_autenticado' }, 401);
  const db = admin();
  try {
    const b = await req.json();
    const para = String(b.para ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) return json({ ok: false, erro: 'email_invalido', mensagem: 'E-mail do destinatário inválido.' });
    if (!b.assunto || !b.html) return json({ ok: false, erro: 'parametros', mensagem: 'Assunto e mensagem são obrigatórios.' });
    const tk = await tokenGoogle(db, user.id);
    if (!tk.token) return json({ ok: false, erro: tk.motivo, mensagem: 'Conecte sua conta Google em Configurações para enviar e-mails.' });
    const { data: integ } = await db.from('integracoes').select('conta_email,escopos').eq('user_id', user.id).eq('provedor', 'google_calendar').maybeSingle();
    if (!String(integ?.escopos ?? '').includes('gmail.send')) {
      return json({ ok: false, erro: 'sem_permissao_gmail', mensagem: 'Sua conexão Google é antiga e não inclui o Gmail. Em Configurações, clique em "Desconectar" e depois em "Conectar Google" de novo.' });
    }
    const raw = mime(integ?.conta_email ?? 'me', para, b.assunto, b.html, b.anexo_base64 ? { nome: b.anexo_nome ?? 'documento.pdf', base64: b.anexo_base64 } : undefined);
    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { Authorization: `Bearer ${tk.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: b64url(raw.split('').map((c) => c.charCodeAt(0) > 255 ? '?' : c).join('')) }),
    });
    const d = await r.json();
    const registro = { user_id: user.id, para, assunto: b.assunto, tipo: b.tipo ?? 'avulso', cliente_id: b.cliente_id ?? null, obrigacao_id: b.obrigacao_id ?? null };
    if (!r.ok) {
      await db.from('emails_enviados').insert({ ...registro, status: 'erro', erro: d?.error?.message ?? String(r.status) });
      return json({ ok: false, erro: 'gmail_' + r.status, mensagem: `O Gmail recusou o envio: ${d?.error?.message ?? r.status}` });
    }
    await db.from('emails_enviados').insert({ ...registro, gmail_message_id: d.id, status: 'enviado' });
    return json({ ok: true, id: d.id, de: integ?.conta_email });
  } catch (e) {
    return json({ ok: false, erro: String((e as Error).message ?? e) }, 500);
  }
});
