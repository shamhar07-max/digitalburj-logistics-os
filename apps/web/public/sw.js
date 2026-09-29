/* Minimal offline shell for the driver app: network-first for navigations, cache-first for static assets.
   API calls are never intercepted. Every path resolves to a Response so a failed fetch can never surface as a
   "FetchEvent ... network error" (which breaks page loads and login). */
const CACHE = 'db-shell-v2';
const cacheable = (r) => r && r.ok && r.type === 'basic' && !r.redirected;
const offline = () => new Response('You appear to be offline.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(['/manifest.webmanifest', '/favicon-app-192.png'].map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => { if (cacheable(r)) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => undefined); } return r; })
        .catch(() => caches.match('/').then((hit) => hit || offline())),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req)
        .then((r) => { if (cacheable(r)) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined); } return r; })
        .catch(() => offline())),
  );
});
