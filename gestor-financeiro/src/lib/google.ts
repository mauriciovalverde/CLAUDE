// A conexão automática com o Google (Agenda/Gmail) só existe se o dono do app cadastrou a credencial OAuth.
// Sem ela, o app esconde o botão "Conectar" e usa os botões sem configuração (WhatsApp, e-mail, link da agenda).
import { SUPABASE_URL } from './supabase';

let cache: Promise<boolean> | null = null;
export function googleDisponivel(): Promise<boolean> {
  cache ??= fetch(`${SUPABASE_URL}/functions/v1/google-oauth/disponivel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then((r) => r.json()).then((d) => !!d.disponivel).catch(() => false);
  return cache;
}
