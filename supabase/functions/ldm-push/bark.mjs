/* =========================================================
   BARK — громкий будильник на айфоне через бесплатное приложение Bark (App Store).
   Сигнал «критический»: звучит даже в беззвучном режиме и в «Не беспокоить»,
   звук повторяется 30 секунд — почти как будильник на Android.
   Подписка хранится как адрес https://api.day.app/<ключ устройства>.
   ========================================================= */

export const BARK_HOST = 'api.day.app';
const APP = 'https://vcrfftrk9w-afk.github.io/-/';

export const isBark = (endpoint) => {
  try { return new URL(endpoint).host === BARK_HOST; } catch (e) { return false; }
};

/* тело запроса к Bark для пуша { title, body, open } */
export function barkMessage(endpoint, p) {
  const key = new URL(endpoint).pathname.split('/')[1] || '';
  const title = String(p.title || 'Из Ленивца в Миллионеры');
  const open = typeof p.open === 'string' ? p.open : '';
  return {
    device_key: key,
    title,
    body: String(p.body || '') || title,
    level: 'critical', // громко даже в беззвучном режиме
    volume: 8,
    call: '1',         // звук повторяется 30 секунд, пока не нажмёшь
    sound: 'alarm',
    group: 'Ленивец',
    icon: APP + 'icons/icon-192.png',
    url: APP + 'index.html' + (open ? '?open=' + encodeURIComponent(open) : ''),
  };
}

/* отправить: { status, text } как у Web Push — 201 доставлено, 410 — ключа больше нет */
export async function sendBark(endpoint, p, ctx = {}) {
  const res = await (ctx.fetch || fetch)(`https://${BARK_HOST}/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(barkMessage(endpoint, p)),
    signal: AbortSignal.timeout(ctx.timeout || 10000),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok && j.code === 200) return { status: 201, text: '' };
  const text = String(j.message || '').slice(0, 200);
  if (/device token/i.test(text)) return { status: 410, text }; // такого ключа у Bark нет — приложение удалили
  return { status: res.status >= 400 ? res.status : 502, text };
}
