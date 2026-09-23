const CACHE_NAME = 'ldm-cache-v3';
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
  './js/cloud.js',
  './js/audio.js',
  './js/music.js',
  './js/fx.js',
  './js/ui.js',
  './js/screens-core.js',
  './js/screens-focus.js',
  './js/screens-meta.js',
  './js/track.js',
  './js/planner.js',
  './js/template.js',
  './js/week.js',
  './js/chill.js',
  './js/verdict.js',
  './js/path.js',
  './js/screens-extra.js',
  './js/screens-path.js',
  './js/pledge.js',
  './js/screens-day.js',
  './js/advisor.js',
  './js/coach.js',
  './js/modes.js',
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

/* Сначала сеть, кэш — только без интернета. Раньше было наоборот,
   и установленное приложение навсегда застревало на старой версии. */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
