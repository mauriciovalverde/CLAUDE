// Notificações push: Web Push (navegador, Android pelo Chrome, iPhone com o app na Tela de Início) e FCM (app Android nativo).
import { supabase, SUPABASE_URL } from './supabase';
import { ehNativo } from './nativo';

const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const FCM_ATIVO = import.meta.env.VITE_FCM === '1'; // só quando o app Android tiver o google-services.json do Firebase

export type EstadoPush = { suporte: 'webpush' | 'fcm' | 'nenhum'; permissao: 'granted' | 'denied' | 'default' | 'indisponivel'; ativo: boolean; motivo?: string };

const ehIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const instaladoIOS = () => (navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches;

export function registrarServiceWorker() {
  if (ehNativo() || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`./sw.js?u=${encodeURIComponent(SUPABASE_URL + '/functions/v1')}&k=${encodeURIComponent(KEY)}`).catch(() => {});
  // tocar na notificação com o app aberto: vai direto para a mensagem
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.abrir) window.location.hash = e.data.abrir.replace(/^#/, ''); });
}

const u8 = (b64: string) => { const s = b64.replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };

export async function estadoPush(): Promise<EstadoPush> {
  if (ehNativo()) {
    if (!FCM_ATIVO) return { suporte: 'nenhum', permissao: 'indisponivel', ativo: false, motivo: 'O app Android ainda não tem o Firebase configurado. Por enquanto, instale pelo Chrome (menu ⋮ → Instalar app) para receber avisos com o app fechado.' };
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const p = await PushNotifications.checkPermissions();
    const perm = p.receive === 'granted' ? 'granted' : p.receive === 'denied' ? 'denied' : 'default';
    return { suporte: 'fcm', permissao: perm, ativo: perm === 'granted' && !!localStorage.getItem('rest-push-token') };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    if (ehIOS() && !instaladoIOS()) return { suporte: 'nenhum', permissao: 'indisponivel', ativo: false, motivo: 'No iPhone, os avisos só funcionam com o app instalado: Safari → Compartilhar → Adicionar à Tela de Início. Depois abra pelo ícone.' };
    return { suporte: 'nenhum', permissao: 'indisponivel', ativo: false, motivo: 'Este navegador não recebe notificações push. Use o Chrome (Android) ou o Safari com o app instalado (iPhone).' };
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return { suporte: 'webpush', permissao: Notification.permission as any, ativo: !!sub && Notification.permission === 'granted' };
}

/** Pede a permissão e registra o aparelho no servidor. */
export async function ativarPush(): Promise<EstadoPush> {
  if (ehNativo()) {
    if (!FCM_ATIVO) return estadoPush();
    const { PushNotifications } = await import('@capacitor/push-notifications');
    let p = await PushNotifications.checkPermissions();
    if (p.receive !== 'granted') p = await PushNotifications.requestPermissions();
    if (p.receive !== 'granted') return estadoPush();
    await PushNotifications.createChannel({ id: 'urgente', name: 'Comunicados urgentes', importance: 5, vibration: true }).catch(() => {});
    await PushNotifications.createChannel({ id: 'comunicados', name: 'Comunicados', importance: 4 }).catch(() => {});
    const token = await new Promise<string>((ok, erro) => {
      PushNotifications.addListener('registration', (t) => ok(t.value));
      PushNotifications.addListener('registrationError', (e) => erro(new Error(e.error)));
      PushNotifications.register();
    });
    const { error } = await supabase.rpc('rest_push_registrar', { p_tipo: 'fcm', p_endpoint: token, p_chaves: null, p_plataforma: 'Android (app)', p_aparelho: navigator.userAgent.slice(0, 180) });
    if (error) throw new Error(error.message);
    localStorage.setItem('rest-push-token', token);
    return estadoPush();
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return estadoPush();
  const reg = await navigator.serviceWorker.ready;
  const r = await fetch(`${SUPABASE_URL}/functions/v1/rest-push`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY }, body: JSON.stringify({ acao: 'chave' }) }).then((x) => x.json());
  if (!r.publica) throw new Error('O servidor de notificações ainda não está configurado');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(r.publica) });
  const j = sub.toJSON() as any;
  const plat = ehIOS() ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android (navegador)' : 'Computador';
  const { error } = await supabase.rpc('rest_push_registrar', { p_tipo: 'webpush', p_endpoint: j.endpoint, p_chaves: j.keys, p_plataforma: plat, p_aparelho: navigator.userAgent.slice(0, 180) });
  if (error) throw new Error(error.message);
  return estadoPush();
}

/** Toque na notificação do app nativo: abre o comunicado. */
export async function ouvirToqueNativo() {
  if (!ehNativo() || !FCM_ATIVO) return;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  PushNotifications.addListener('pushNotificationActionPerformed', (a) => { const url = a.notification.data?.url; if (url) window.location.hash = String(url).replace(/^#/, ''); });
  PushNotifications.addListener('pushNotificationReceived', (n) => {
    const d = n.data ?? {}; if (d.envio_id) fetch(`${SUPABASE_URL}/functions/v1/rest-push`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY }, body: JSON.stringify({ acao: 'entregue', id: d.envio_id, token: d.token }) }).catch(() => {});
  });
}

export async function testarPush() {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(`${SUPABASE_URL}/functions/v1/rest-push`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ acao: 'testar' }) }).then((r) => r.json());
}

export async function chamarPush(corpo: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(`${SUPABASE_URL}/functions/v1/rest-push`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify(corpo) }).then((r) => r.json());
}
