// Офлайн для зала без связи. Сеть первой и мимо HTTP-кэша браузера (cache: 'no-cache' —
// сверка с сервером по ETag), иначе GitHub Pages отдаёт старую копию до 10 минут.
// Кэш service worker — только запасной вариант без сети.
const CACHE = 'progressia-v13';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/engine.js', 'js/library.js', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('supabase.co')) return;
  const same = u.origin === location.origin;
  e.respondWith(fetch(same ? new Request(e.request, { cache: 'no-cache' }) : e.request).then(r => {
    if (r.ok && (same || u.hostname.includes('fonts.g'))) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
