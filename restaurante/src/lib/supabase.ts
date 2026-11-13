import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const supabase = createClient(SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string, {
  // chave própria: o Gestor e o Planejador ficam no mesmo endereço e não podem trocar sessões com o restaurante
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'rest-sessao' },
});

/** Chama uma Edge Function com o token do usuário logado. */
export async function funcao<T = any>(nome: string, corpo: unknown = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${nome}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify(corpo),
  });
  return r.json();
}

/** RPC com erro legível (o código vem antes de ":" na mensagem do banco). */
export async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(traduzirErro(error.message));
  return data as T;
}

const ERROS: Record<string, string> = {
  SEM_PERMISSAO: 'Sem permissão',
  DADOS_INVALIDOS: 'Confira os dados',
  ESTOQUE_INSUFICIENTE: 'Estoque insuficiente',
  NOTA_JA_VINCULADA: 'Nota já lançada',
  JA_RECEBIDA: 'Já recebida',
  JA_PAGA: 'Já paga',
  VALOR_ACIMA_DO_SALDO: 'Valor acima da conta',
  FECHAMENTO_ENCERRADO: 'Caixa fechado',
  FECHAMENTO_BLOQUEADO: 'Caixa bloqueado',
};
export function traduzirErro(m: string) {
  if (/row-level security|permission denied/i.test(m)) return 'Sem permissão para isso. Fale com o administrador.';
  if (/duplicate key/i.test(m)) return 'Esse registro já existe (não foi duplicado).';
  const cod = m.split(':')[0].trim();
  return ERROS[cod] ? `${ERROS[cod]}: ${m.slice(cod.length + 1).trim()}` : m;
}
