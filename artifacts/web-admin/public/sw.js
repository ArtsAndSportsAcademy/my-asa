/* Cache only public offline assets. Never cache authenticated API responses or person records. */
const CACHE = "myasa-public-v2";
const CATEGORIES = new Set(["scale.published", "scale.republished", "scale.changed", "checkin.shift_reminder", "notice.requires_ack"]);
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["/offline.html", "/asa-wing.png"]))); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("myasa-public-") && key !== CACHE).map(key => caches.delete(key))))])); });
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});
self.addEventListener("push", event => {
  let message;
  try { message = event.data?.json(); } catch { return; }
  if (!message || !CATEGORIES.has(message.type)) return;
  const titles = { "scale.published": "Escala mudou", "scale.republished": "Escala mudou", "scale.changed": "Escala mudou", "checkin.shift_reminder": "Lembrete de check-in do turno", "notice.requires_ack": "Aviso que pede ciente" };
  // O servidor já manda o endereço de uma tela que existe (lib/app-routes.ts); o resto é só reserva.
  const fallback = message.type.startsWith("scale.") ? "/escalas" : message.type === "checkin.shift_reminder" ? "/check-in" : message.type === "notice.requires_ack" ? "/mural" : "/meu-dia";
  const url = typeof message.url === "string" && message.url.startsWith("/") ? message.url : fallback;
  event.waitUntil(self.registration.showNotification(titles[message.type], { body: "Abra o My ASA para consultar.", icon: "/asa-avatar.png", tag: message.tag, data: { url } }).then(async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: "myasa-push-received", category: message.type });
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async windows => {
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});
