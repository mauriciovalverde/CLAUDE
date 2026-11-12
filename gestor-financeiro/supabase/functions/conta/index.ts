// conta: cadastro e recuperação de senha SEM depender de e-mail.
// (O e-mail padrão do Supabase só entrega para membros da equipe do projeto; clientes não receberiam a confirmação.)
//   { acao: 'criar', email, senha }                  -> { ok, codigo }  conta já confirmada + código de recuperação
//   { acao: 'recuperar', email, codigo, nova_senha }  -> { ok, codigo }  troca a senha e gera um código novo
import { admin, cors, json } from './comum.ts';

const enc = new TextEncoder();
const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
// Código legível: 3 blocos de 4 (sem letras confusas como O/0, I/1)
const ALF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const novoCodigo = () => { const r = crypto.getRandomValues(new Uint8Array(12)); const c = [...r].map((b) => ALF[b % ALF.length]).join(''); return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`; };
const normCodigo = (c: string) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const db = admin();
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido';
  try {
    const b = await req.json();
    const email = String(b.email ?? '').trim().toLowerCase();

    if (b.acao === 'criar') {
      if (!emailOk(email)) return json({ ok: false, mensagem: 'Digite um e-mail válido.' });
      if (String(b.senha ?? '').length < 8) return json({ ok: false, mensagem: 'A senha precisa ter pelo menos 8 caracteres.' });
      const umaHora = new Date(Date.now() - 3600_000).toISOString();
      const { count: doIp } = await db.from('cadastros_log').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('criado_em', umaHora);
      const { count: total } = await db.from('cadastros_log').select('id', { count: 'exact', head: true }).gte('criado_em', umaHora);
      if ((doIp ?? 0) >= 5 || (total ?? 0) >= 200) return json({ ok: false, mensagem: 'Muitos cadastros agora. Tente de novo daqui a uma hora.' });
      const { data, error } = await db.auth.admin.createUser({ email, password: b.senha, email_confirm: true });
      if (error) {
        const m = error.message.toLowerCase();
        return json({ ok: false, mensagem: m.includes('already') || m.includes('registered') ? 'Já existe uma conta com esse e-mail. Use “Entrar” ou “Esqueci a senha”.' : 'Não foi possível criar a conta: ' + error.message });
      }
      const codigo = novoCodigo();
      await db.from('recuperacao_conta').upsert({ user_id: data.user!.id, email, codigo_hash: await sha(normCodigo(codigo)), tentativas: 0, bloqueado_ate: null, atualizado_em: new Date().toISOString() });
      await db.from('cadastros_log').insert({ ip, email });
      return json({ ok: true, codigo });
    }

    if (b.acao === 'recuperar') {
      const generico = { ok: false, mensagem: 'E-mail ou código de recuperação incorretos.' };
      if (String(b.nova_senha ?? '').length < 8) return json({ ok: false, mensagem: 'A nova senha precisa ter pelo menos 8 caracteres.' });
      const { data: r } = await db.from('recuperacao_conta').select('*').eq('email', email).maybeSingle();
      if (!r) return json(generico);
      if (r.bloqueado_ate && new Date(r.bloqueado_ate).getTime() > Date.now()) return json({ ok: false, mensagem: 'Muitas tentativas erradas. Tente de novo em 30 minutos.' });
      if ((await sha(normCodigo(b.codigo))) !== r.codigo_hash) {
        const t = r.tentativas + 1;
        await db.from('recuperacao_conta').update({ tentativas: t >= 5 ? 0 : t, bloqueado_ate: t >= 5 ? new Date(Date.now() + 30 * 60_000).toISOString() : null }).eq('user_id', r.user_id);
        return json(generico);
      }
      const { error } = await db.auth.admin.updateUserById(r.user_id, { password: b.nova_senha });
      if (error) return json({ ok: false, mensagem: 'Não foi possível trocar a senha: ' + error.message });
      const codigo = novoCodigo(); // o código antigo deixa de valer
      await db.from('recuperacao_conta').update({ codigo_hash: await sha(normCodigo(codigo)), tentativas: 0, bloqueado_ate: null, atualizado_em: new Date().toISOString() }).eq('user_id', r.user_id);
      return json({ ok: true, codigo });
    }
    return json({ ok: false, mensagem: 'ação desconhecida' }, 400);
  } catch (e) {
    return json({ ok: false, mensagem: String((e as Error).message ?? e) }, 500);
  }
});
