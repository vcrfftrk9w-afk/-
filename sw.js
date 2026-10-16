const CACHE_NAME = 'ldm-cache-v15';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './css/animations.css',
  './css/courses.css',
  './js/android.js',
  './js/awake.js',
  './js/account.js',
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
  './js/remind.js',
  './js/push.js',
  './js/modes.js',
  './js/plans.js',
  './js/english-content.js',
  './js/english-path.js',
  './js/courses-data.js',
  './js/courses.js',
  './js/levels.js',
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
  const same = new URL(event.request.url).origin === self.location.origin;
  // свои файлы — всегда сверяем с сервером (GitHub Pages разрешает браузеру держать копию 10 минут,
  // и после обновления телефон показывал старую версию)
  const live = same ? fetch(event.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(event.request);
  event.respondWith(
    live
      .then((response) => {
        if (response && response.ok && same) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});

/* Уведомления на айфон: сервер (функция ldm-push) прислал будильник — показываем его,
   даже когда приложение закрыто. Айфон требует показать уведомление на каждый пуш. */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Из Ленивца в Миллионеры';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    vibrate: [200, 100, 200, 100, 400],
    data: { open: typeof d.open === 'string' ? d.open : title },
  }));
});

/* нажали на уведомление — открываем приложение сразу на этом деле */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const open = (event.notification.data && event.notification.data.open) || '';
  const url = new URL('./index.html' + (open ? '?open=' + encodeURIComponent(open) : ''), self.registration.scope).href;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = list.find((c) => c.url.startsWith(self.registration.scope));
    if (win) {
      try { await win.focus(); } catch (e) { /* айфон может не дать — сообщение всё равно дойдёт */ }
      win.postMessage({ type: 'ldm-open', title: open });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
