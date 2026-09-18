const CACHE_NAME = 'ldm-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './css/animations.css',
  './js/icons.js',
  './js/data.js',
  './js/state.js',
  './js/audio.js',
  './js/music.js',
  './js/fx.js',
  './js/ui.js',
  './js/screens-core.js',
  './js/screens-focus.js',
  './js/screens-meta.js',
  './js/path.js',
  './js/screens-extra.js',
  './js/screens-path.js',
  './js/advisor.js',
  './js/palette.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => cached);
    })
  );
});
