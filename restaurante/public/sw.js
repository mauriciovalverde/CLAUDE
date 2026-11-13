// Service worker: recebe os comunicados por push mesmo com o app fechado e abre a mensagem ao tocar.
// A entrega é confirmada ao servidor (status "entregue ao dispositivo"); isso NÃO é confirmação de leitura.
const params = new URL(self.location.href).searchParams;
const FUNCOES = params.get('u') || '';
const CHAVE = params.get('k') || '';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titulo: 'Comunicado', corpo: e.data ? e.data.text() : '' }; }
  const urgente = d.prioridade === 'urgente';
  const quando = d.enviado_em ? new Date(d.enviado_em) : new Date();
  const corpo = `${d.corpo || ''}\n${quando.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
  const tarefas = [self.registration.showNotification(d.titulo || 'Comunicado', {
    body: corpo, tag: d.tag || 'comunicado', renotify: true, requireInteraction: urgente || d.prioridade === 'importante',
    icon: 'icone-192.png', badge: 'icone-192.png', timestamp: quando.getTime(), vibrate: urgente ? [300, 120, 300, 120, 300] : [200],
    data: { url: d.url || '#/comunicados' },
  })];
  if (d.envio_id && FUNCOES) tarefas.push(fetch(`${FUNCOES}/rest-push`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CHAVE }, body: JSON.stringify({ acao: 'entregue', id: d.envio_id, token: d.token }) }).catch(() => {}));
  e.waitUntil(Promise.all(tarefas));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL(self.registration.scope).href.replace(/#.*$/, '') + (e.notification.data?.url || '#/comunicados');
  e.waitUntil((async () => {
    const abertos = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertos) { if (c.url.startsWith(self.registration.scope)) { await c.focus(); c.postMessage({ abrir: e.notification.data?.url }); return; } }
    await self.clients.openWindow(destino);
  })());
});
