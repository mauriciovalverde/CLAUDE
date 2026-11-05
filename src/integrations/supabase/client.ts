import { createClient } from "@supabase/supabase-js";

// Mesmo backend do projeto no Lovable Cloud. A chave publicável é pública por natureza;
// a segurança dos dados vem das políticas RLS do banco.
const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
