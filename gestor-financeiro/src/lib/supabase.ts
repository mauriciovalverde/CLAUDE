import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const supabase = createClient(SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
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
  ESTOQUE_INSUFICIENTE: 'Estoque insuficiente',
  POSSIVEL_DUPLICIDADE: 'Possível duplicidade',
  AVISO_LEGAL_PENDENTE: 'Taxa acima da referência legal',
  LICENCA_OBRIGATORIA: 'Licença sanitária obrigatória',
  RECEITA_OBRIGATORIA: 'Receita obrigatória',
  CONTROLADO_BLOQUEADO: 'Produto controlado bloqueado',
  REGISTRO_ANVISA_AUSENTE: 'Registro ANVISA ausente',
  VALOR_ACIMA_DO_SALDO: 'Valor acima do saldo',
  EXCLUSAO_BLOQUEADA: 'Exclusão bloqueada',
};
export function traduzirErro(m: string) {
  const cod = m.split(':')[0].trim();
  return ERROS[cod] ? `${ERROS[cod]}: ${m.slice(cod.length + 1).trim()}` : m;
}

/** Depois de qualquer gravação com vencimento: sincroniza a agenda em segundo plano. */
export function sincronizarAgenda(ids?: string[]) {
  return funcao('agenda-sync', { obrigacao_ids: ids, forcar: true }).catch(() => null);
}
