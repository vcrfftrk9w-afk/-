/* Sauda: приложение открывается и без сети (последняя версия файлов), данные — всегда с сервера. */
const CACHE = 'sauda-v1';
const ASSETS = ['./', './index.html', './manifest.json', './css/sauda.css', './icons/icon.svg', './icons/icon-192.png',
  './js/config.js', './js/core.js', './js/i18n-kz.js', './js/components.js', './js/views-shop.js', './js/views-deal.js',
  './js/views-account.js', './js/views-admin.js', './js/app.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('sauda-') && k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
/* свои файлы: сначала сеть, без сети — копия; запросы к базе не трогаем */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => {
    if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); }
    return r;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html'))));
});
