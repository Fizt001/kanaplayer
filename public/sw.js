// Service worker PlayerMP3.
// PENTING: audio (/tracks/*/stream), cover, API, dan halaman berlogin TIDAK di-cache,
// supaya kuota harian dan status premium selalu dicek server.
const VERSION = 'v1';
const STATIC = `static-${VERSION}`;
const SHELL = ['/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(STATIC).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== STATIC).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Aset statis ikon/manifest: cache-first.
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }

  // Navigasi halaman: selalu ke jaringan; jika offline tampilkan halaman offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
  }
  // Semua lainnya (stream, cover, /tracks, /me) langsung ke jaringan tanpa cache.
});

