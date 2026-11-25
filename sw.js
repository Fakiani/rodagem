// Rodagem service worker: abre instantâneo do cache e atualiza em segundo plano.
const C = "rodagem-v1", EXT = "rodagem-ext", META = "rodagem-meta";
const A = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(A))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== C && k !== EXT && k !== META).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    // stale-while-revalidate
    e.respondWith(caches.open(C).then(c => c.match(r, { ignoreSearch: true }).then(m => {
      const n = fetch(r).then(x => { if (x.ok) c.put(r, x.clone()); return x; }).catch(() => m);
      return m || n;
    })));
  } else if (/(^|\.)jsdelivr\.net$|tessdata|projectnaptha/.test(u.hostname)) {
    // leitor OCR: baixa uma vez e guarda
    e.respondWith(caches.open(EXT).then(c => c.match(r).then(m => m || fetch(r).then(x => { if (x.ok) c.put(r, x.clone()); return x; }))));
  }
});

const addD = (s, n) => { const a = s.split("-").map(Number), d = new Date(a[0], a[1] - 1, a[2] + n); return d.toLocaleDateString("sv-SE"); };
async function check() {
  const m = await (await caches.open(META)).match("due");
  if (!m) return;
  const L = await m.json(), lim = addD(new Date().toLocaleDateString("sv-SE"), 15);
  const hit = L.filter(x => (x.nd && x.nd <= lim) || (x.rk != null && x.rk <= 500));
  if (hit.length) await self.registration.showNotification("Rodagem: manutenção", { body: hit.map(x => x.n).join(", "), icon: "icon-192.png", badge: "icon-192.png", tag: "due" });
}
self.addEventListener("periodicsync", e => { if (e.tag === "lembretes") e.waitUntil(check()); });
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window" }).then(w => w.length ? w[0].focus() : clients.openWindow("./#plan")));
});
