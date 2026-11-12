// Acesso automático: cada celular tem seu próprio acesso, criado na primeira abertura, sem cadastro.
// O e-mail interno e a senha aleatória ficam guardados no aparelho; os dados ficam no servidor (RLS por usuário).
import { funcao, supabase } from './supabase';

const CHAVE = 'gfi-acesso';
type Acesso = { email: string; senha: string };

export function lerAcesso(): Acesso | null {
  try { const s = localStorage.getItem(CHAVE); return s ? JSON.parse(s) : null; } catch { return null; }
}
function guardar(a: Acesso) { try { localStorage.setItem(CHAVE, JSON.stringify(a)); } catch { /* ignore */ } }

function senhaAleatoria() {
  const b = crypto.getRandomValues(new Uint8Array(30));
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c] as string));
}

/** Garante uma sessão: usa a já existente, entra com o acesso guardado ou cria um acesso novo para este aparelho. */
export async function garantirAcesso(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const a = lerAcesso();
  if (a) {
    const { error } = await supabase.auth.signInWithPassword({ email: a.email, password: a.senha });
    if (!error) return;
    throw new Error('Não consegui abrir seus dados. Confira a internet e tente de novo.');
  }
  const senha = senhaAleatoria();
  const r = await funcao('conta', { acao: 'dispositivo', senha });
  if (!r.ok) throw new Error(r.mensagem ?? 'Não consegui preparar o app. Confira a internet.');
  guardar({ email: r.email, senha });
  const { error } = await supabase.auth.signInWithPassword({ email: r.email, password: senha });
  if (error) throw new Error(error.message);
}

/** Código para abrir os mesmos dados em outro celular (troca de aparelho). */
export function codigoTransferencia(): string | null {
  const a = lerAcesso();
  if (!a) return null;
  const b = btoa(unescape(encodeURIComponent(JSON.stringify({ e: a.email, p: a.senha })))).replace(/=+$/, '');
  return 'GF1-' + b;
}

export async function restaurarComCodigo(codigo: string) {
  const c = codigo.trim().replace(/\s+/g, '');
  if (!c.startsWith('GF1-')) throw new Error('Código inválido. Ele começa com "GF1-".');
  let a: Acesso;
  try { const j = JSON.parse(decodeURIComponent(escape(atob(c.slice(4))))); a = { email: j.e, senha: j.p }; } catch { throw new Error('Código inválido ou incompleto. Copie o código inteiro.'); }
  await supabase.auth.signOut().catch(() => {});
  const { error } = await supabase.auth.signInWithPassword({ email: a.email, password: a.senha });
  if (error) throw new Error('Esse código não abriu nenhum dado. Confira se copiou inteiro.');
  guardar(a);
}
