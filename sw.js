/* noorestan-37 minimal restore — full SW in PR follow-up */
const CACHE = 'noorestan-37';
const SHELL = 'noorestan-shell-37';
const PRECACHE = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './assets/app/style-1-fd30642d4f.css',
  './assets/app/app-1-3bce8fb8d2.js',
  './assets/app/salah-1.js',
  './assets/app/courtyard-1.js',
  './assets/app/wird-1.js',
  './assets/styles/salah.css',
  './assets/styles/polish.css',
  './assets/styles/sanctuary.css',
  './assets/styles/motion.css',
  './assets/styles/auth.css'
];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.all(PRECACHE.map(u => c.add(new Request(u, {cache:'reload'})).catch(() => null)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = new Set([CACHE, SHELL]);
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url; try { url = new URL(req.url); } catch { return; }
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (req.destination === 'audio' || req.destination === 'video') return;
  if (/\.(mp3|mp4|m4a|ogg|opus|webm|wav)$/i.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./offline.html').then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(SHELL);
    const hit = await c.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok) c.put(req, res.clone()).catch(() => {});
      return res;
    } catch {
      return hit || Response.error();
    }
  })());
});
