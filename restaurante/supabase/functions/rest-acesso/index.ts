// rest-acesso: entrada da equipe do restaurante por CÓDIGO DO RESTAURANTE + PIN individual (sem e-mail).
// Cada funcionário tem um usuário interno; o PIN é conferido aqui (PBKDF2 + bloqueio após 5 erros) e a sessão é devolvida ao app.
//   { acao: 'criar_restaurante', nome, admin_nome, pin }            -> { ok, codigo, sessao }
//   { acao: 'equipe', codigo }                                      -> { ok, restaurante, equipe:[{id,nome}] }
//   { acao: 'entrar', codigo, funcionario_id, pin }                 -> { ok, sessao }
//   (logado, admin) { acao: 'criar_funcionario', nome, papeis, pin, setor, telefone }
//   (logado, admin) { acao: 'alterar_funcionario', id, nome?, papeis?, setor?, telefone?, ativo?, pin? }
//   (logado) { acao: 'trocar_pin', pin_atual, pin_novo }
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const URL_SB = Deno.env.get('SUPABASE_URL')!;
const admin = () => createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const publico = () => createClient(URL_SB, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });

const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function hashPin(pin: string, sal: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(sal), iterations: 120_000 }, k, 256));
}
const iguais = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const aleatorio = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)));
const ALF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pinOk = (p: unknown) => /^\d{4,6}$/.test(String(p ?? ''));
const PIN_FRACO = new Set(['0000', '1111', '1234', '4321', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '000000', '123456', '111111', '654321', '12345']);
const PAPEIS = ['admin', 'compras', 'solicitante', 'caixa', 'estoque'];

function codigoRestaurante(nome: string) {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\b(RESTAURANTE|DO|DA|DE|DOS|DAS|E|O|A)\b/g, '').replace(/[^A-Z]/g, '').slice(0, 5) || 'REST';
  const r = [...crypto.getRandomValues(new Uint8Array(4))].map((x) => ALF[x % ALF.length]).join('');
  return `${base}-${r}`;
}

async function novoUsuario(db: ReturnType<typeof admin>) {
  const email = `equipe-${aleatorio(8)}@restaurante.app`;
  const { data, error } = await db.auth.admin.createUser({ email, password: aleatorio(24), email_confirm: true, user_metadata: { tipo: 'restaurante' } });
  if (error) throw new Error(error.message);
  return data.user!.id;
}

/** Abre uma sessão para o usuário interno do funcionário (senha nova e aleatória a cada entrada; nunca sai do servidor). */
async function sessao(db: ReturnType<typeof admin>, userId: string) {
  const senha = aleatorio(24);
  const { data: u, error: e1 } = await db.auth.admin.updateUserById(userId, { password: senha });
  if (e1) throw new Error(e1.message);
  const { data, error } = await publico().auth.signInWithPassword({ email: u.user!.email!, password: senha });
  if (error) throw new Error(error.message);
  return { access_token: data.session!.access_token, refresh_token: data.session!.refresh_token };
}

async function limiteIp(db: ReturnType<typeof admin>, ip: string, max: number) {
  const umaHora = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('cadastros_log').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('criado_em', umaHora);
  return (count ?? 0) < max;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const db = admin();
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido';
  try {
    const b = await req.json();

    if (b.acao === 'criar_restaurante') {
      const nome = String(b.nome ?? '').trim(), adminNome = String(b.admin_nome ?? '').trim();
      if (nome.length < 2 || adminNome.length < 2) return json({ ok: false, mensagem: 'Informe o nome do restaurante e o seu nome.' });
      if (!pinOk(b.pin)) return json({ ok: false, mensagem: 'O PIN precisa ter de 4 a 6 números.' });
      if (PIN_FRACO.has(String(b.pin))) return json({ ok: false, mensagem: 'Esse PIN é fácil de adivinhar. Escolha outro.' });
      if (!(await limiteIp(db, ip, 5))) return json({ ok: false, mensagem: 'Muitos cadastros agora. Tente de novo daqui a uma hora.' });
      let rest: any = null;
      for (let t = 0; t < 5 && !rest; t++) {
        const { data } = await db.from('rest_restaurantes').insert({ nome, codigo: codigoRestaurante(nome) }).select().maybeSingle();
        rest = data;
      }
      if (!rest) return json({ ok: false, mensagem: 'Não consegui criar o restaurante. Tente de novo.' });
      const userId = await novoUsuario(db);
      const { data: f, error } = await db.from('rest_funcionarios').insert({ restaurante_id: rest.id, user_id: userId, nome: adminNome, papeis: ['admin'] }).select().single();
      if (error) return json({ ok: false, mensagem: error.message });
      const sal = aleatorio(16);
      await db.from('rest_pins').insert({ funcionario_id: f.id, sal, hash: await hashPin(String(b.pin), sal) });
      await db.from('cadastros_log').insert({ ip, email: `restaurante:${rest.codigo}` });
      return json({ ok: true, codigo: rest.codigo, restaurante: { id: rest.id, nome: rest.nome }, funcionario_id: f.id, sessao: await sessao(db, userId) });
    }

    if (b.acao === 'equipe') {
      const codigo = String(b.codigo ?? '').trim().toUpperCase();
      const { data: r } = await db.from('rest_restaurantes').select('id,nome,codigo,logo_path').eq('codigo', codigo).maybeSingle();
      if (!r) return json({ ok: false, mensagem: 'Código do restaurante não encontrado. Confira com o responsável.' });
      const { data: eq } = await db.from('rest_funcionarios').select('id,nome').eq('restaurante_id', r.id).eq('ativo', true).order('nome');
      return json({ ok: true, restaurante: { nome: r.nome, codigo: r.codigo, logo_path: r.logo_path }, equipe: eq ?? [] });
    }

    if (b.acao === 'entrar') {
      const generico = { ok: false, mensagem: 'PIN incorreto.' };
      const codigo = String(b.codigo ?? '').trim().toUpperCase();
      const { data: r } = await db.from('rest_restaurantes').select('id').eq('codigo', codigo).maybeSingle();
      if (!r || !b.funcionario_id) return json(generico);
      const { data: f } = await db.from('rest_funcionarios').select('id,user_id,ativo,restaurante_id').eq('id', b.funcionario_id).eq('restaurante_id', r.id).maybeSingle();
      if (!f || !f.ativo || !f.user_id) return json({ ok: false, mensagem: 'Acesso desativado. Fale com o responsável.' });
      const { data: p } = await db.from('rest_pins').select('*').eq('funcionario_id', f.id).maybeSingle();
      if (!p) return json(generico);
      if (p.bloqueado_ate && new Date(p.bloqueado_ate).getTime() > Date.now()) return json({ ok: false, mensagem: 'Muitas tentativas erradas. Espere 15 minutos ou peça ao responsável para trocar seu PIN.' });
      if (!pinOk(b.pin) || !iguais(await hashPin(String(b.pin), p.sal), p.hash)) {
        const t = p.tentativas + 1;
        await db.from('rest_pins').update({ tentativas: t >= 5 ? 0 : t, bloqueado_ate: t >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null }).eq('funcionario_id', f.id);
        return json(t >= 5 ? { ok: false, mensagem: 'PIN errado 5 vezes: acesso bloqueado por 15 minutos.' } : { ok: false, mensagem: `PIN incorreto. Restam ${5 - t} tentativa(s).` });
      }
      await db.from('rest_pins').update({ tentativas: 0, bloqueado_ate: null }).eq('funcionario_id', f.id);
      await db.from('rest_funcionarios').update({ ultimo_acesso: new Date().toISOString() }).eq('id', f.id);
      return json({ ok: true, sessao: await sessao(db, f.user_id) });
    }

    // ---- ações de quem já está logado ----
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return json({ ok: false, mensagem: 'Entre de novo no app.' }, 401);
    const { data: eu } = await db.from('rest_funcionarios').select('*').eq('user_id', user.id).eq('ativo', true).maybeSingle();
    if (!eu) return json({ ok: false, mensagem: 'Acesso desativado.' }, 403);

    if (b.acao === 'trocar_pin') {
      const { data: p } = await db.from('rest_pins').select('*').eq('funcionario_id', eu.id).single();
      if (!iguais(await hashPin(String(b.pin_atual ?? ''), p.sal), p.hash)) return json({ ok: false, mensagem: 'PIN atual incorreto.' });
      if (!pinOk(b.pin_novo) || PIN_FRACO.has(String(b.pin_novo))) return json({ ok: false, mensagem: 'Novo PIN inválido ou fácil de adivinhar (use 4 a 6 números).' });
      const sal = aleatorio(16);
      await db.from('rest_pins').update({ sal, hash: await hashPin(String(b.pin_novo), sal), tentativas: 0, bloqueado_ate: null, atualizado_em: new Date().toISOString() }).eq('funcionario_id', eu.id);
      return json({ ok: true });
    }

    if (!eu.papeis.includes('admin')) return json({ ok: false, mensagem: 'Só o administrador pode mexer na equipe.' }, 403);
    const papeisValidos = (x: unknown) => Array.isArray(x) && x.length > 0 && x.every((p) => PAPEIS.includes(p));

    if (b.acao === 'criar_funcionario') {
      const nome = String(b.nome ?? '').trim();
      if (nome.length < 2) return json({ ok: false, mensagem: 'Informe o nome.' });
      if (!papeisValidos(b.papeis)) return json({ ok: false, mensagem: 'Escolha pelo menos uma função.' });
      if (!pinOk(b.pin) || PIN_FRACO.has(String(b.pin))) return json({ ok: false, mensagem: 'PIN inválido ou fácil de adivinhar (use 4 a 6 números).' });
      const userId = await novoUsuario(db);
      const { data: f, error } = await db.from('rest_funcionarios').insert({ restaurante_id: eu.restaurante_id, user_id: userId, nome, papeis: b.papeis, setor: b.setor || null, telefone: b.telefone || null }).select().single();
      if (error) { await db.auth.admin.deleteUser(userId); return json({ ok: false, mensagem: error.message.includes('duplicate') ? 'Já existe alguém com esse nome. Use também o sobrenome.' : error.message }); }
      const sal = aleatorio(16);
      await db.from('rest_pins').insert({ funcionario_id: f.id, sal, hash: await hashPin(String(b.pin), sal) });
      return json({ ok: true, funcionario: f });
    }

    if (b.acao === 'alterar_funcionario') {
      const { data: f } = await db.from('rest_funcionarios').select('*').eq('id', b.id).eq('restaurante_id', eu.restaurante_id).maybeSingle();
      if (!f) return json({ ok: false, mensagem: 'Funcionário não encontrado.' });
      const mud: Record<string, unknown> = {};
      if (b.nome !== undefined) mud.nome = String(b.nome).trim();
      if (b.setor !== undefined) mud.setor = b.setor || null;
      if (b.telefone !== undefined) mud.telefone = b.telefone || null;
      if (b.papeis !== undefined) { if (!papeisValidos(b.papeis)) return json({ ok: false, mensagem: 'Escolha pelo menos uma função.' }); mud.papeis = b.papeis; }
      if (b.ativo !== undefined) mud.ativo = !!b.ativo;
      // nunca deixar o restaurante sem administrador ativo
      const perdeAdmin = f.papeis.includes('admin') && ((mud.papeis && !(mud.papeis as string[]).includes('admin')) || mud.ativo === false);
      if (perdeAdmin) {
        const { count } = await db.from('rest_funcionarios').select('id', { count: 'exact', head: true }).eq('restaurante_id', eu.restaurante_id).eq('ativo', true).contains('papeis', ['admin']);
        if ((count ?? 0) <= 1) return json({ ok: false, mensagem: 'O restaurante precisa de pelo menos um administrador ativo.' });
      }
      if (Object.keys(mud).length) {
        const { error } = await db.from('rest_funcionarios').update(mud).eq('id', f.id);
        if (error) return json({ ok: false, mensagem: error.message });
      }
      if (mud.ativo !== undefined && f.user_id) await db.auth.admin.updateUserById(f.user_id, { ban_duration: mud.ativo ? 'none' : '876000h' });
      if (b.pin !== undefined) {
        if (!pinOk(b.pin) || PIN_FRACO.has(String(b.pin))) return json({ ok: false, mensagem: 'PIN inválido ou fácil de adivinhar.' });
        const sal = aleatorio(16);
        await db.from('rest_pins').upsert({ funcionario_id: f.id, sal, hash: await hashPin(String(b.pin), sal), tentativas: 0, bloqueado_ate: null, atualizado_em: new Date().toISOString() });
      }
      return json({ ok: true });
    }
    return json({ ok: false, mensagem: 'ação desconhecida' }, 400);
  } catch (e) {
    return json({ ok: false, mensagem: String((e as Error).message ?? e) }, 500);
  }
});
