/* Офлайн-режим: сначала сеть (чтобы всегда была свежая версия), без интернета — копия из кэша. */
const CACHE = 'igrokod-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => fetch('./index.html').then((r) => r.text()).then((html) => {
      const files = ['./', './index.html', './manifest.json', './icon.svg', './css/style.css'];
      (html.match(/(?:src|href)="((?:js|course|css)\/[^"]+)"/g) || []).forEach((m) => files.push('./' + m.split('"')[1]));
      return cache.addAll(files);
    })).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('igrokod-') && k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const same = new URL(event.request.url).origin === self.location.origin;
  if (!same) return;
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('./index.html')))
  );
});
