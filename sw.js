// Офлайн-режим: приложение и миниатюры сохраняются при установке, панорамы — по мере просмотра
// (или все сразу по кнопке ⬇). Если заменили файлы, увеличьте номер версии — и в index.html тоже.
const CACHE = 'vr-pano-v2';
const N = 15;
const SHELL = [
  './', 'index.html', 'vendor/aframe.min.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png',
  ...Array.from({ length: N }, (_, i) => `panoramas/thumbs/pano${i + 1}.webp`),
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Страницу берём из сети, чтобы обновления приложения применялись сразу; без интернета — из кэша
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put('index.html', copy));
      return res;
    }).catch(() => caches.match('index.html')));
    return;
  }
  // Остальное сначала отдаём из кэша (мгновенно и без интернета), в фоне обновляем копию из сети
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return network;
  }));
});
