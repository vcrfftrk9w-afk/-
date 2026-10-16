/* Шифрование пушей для айфона (supabase/functions/ldm-push/webpush.mjs) проверяем
   НЕЗАВИСИМОЙ реализацией на node:crypto: телефон-получатель расшифровывает
   так, как это делает браузер по RFC 8291, и проверяет подпись VAPID (RFC 8292).
   Запуск: node tests/push-crypto.mjs (без браузера и без сети) */
import crypto from 'node:crypto';
import { encrypt, makeVapidKeys, importVapid, vapidAuth, send, b64u, unb64u } from '../supabase/functions/ldm-push/webpush.mjs';

let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? '✅' : '❌'} ${name}`); if (!cond) fails++; };

/* телефон: свои ключи подписки, как PushSubscription.toJSON().keys */
function phone() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh, auth, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } };
}

/* так браузер расшифровывает тело пуша */
function decrypt(body, ph) {
  const b = Buffer.from(body);
  const salt = b.subarray(0, 16);
  const rs = b.readUInt32BE(16);
  const idlen = b[20];
  const asPub = b.subarray(21, 21 + idlen);
  const ct = b.subarray(21 + idlen);
  const ua = ph.ecdh.getPublicKey();
  const shared = ph.ecdh.computeSecret(asPub);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, ph.auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = plain.length - 1;
  while (end >= 0 && plain[end] === 0) end--; // необязательные нули-заполнители
  return { rs, idlen, delim: plain[end], text: plain.subarray(0, end).toString('utf8') };
}

/* 1. шифрование: телефон читает ровно то, что отправили, даже по-русски и с эмодзи */
{
  const ph = phone();
  const msg = JSON.stringify({ title: '☀️ Подъём', body: 'Вода, умывание — и открой приложение', tag: 'x', open: '☀️ Подъём' });
  const body = await encrypt(msg, ph.keys.p256dh, ph.keys.auth);
  const r = decrypt(body, ph);
  ok(r.text === msg, 'телефон расшифровал пуш, текст совпал до символа');
  ok(r.rs === 4096 && r.idlen === 65 && r.delim === 2, 'заголовок aes128gcm: запись 4096, ключ 65 байт, одна последняя запись');
  const again = await encrypt(msg, ph.keys.p256dh, ph.keys.auth);
  ok(Buffer.compare(Buffer.from(body), Buffer.from(again)) !== 0, 'каждый пуш шифруется заново (новая соль и ключ)');

  const other = phone();
  let threw = false;
  try { decrypt(body, other); } catch (e) { threw = true; }
  ok(threw, 'чужой телефон расшифровать не может');

  const padded = ph.keys.p256dh + '=';
  const r2 = decrypt(await encrypt('ok', padded, ph.keys.auth + '=='), ph);
  ok(r2.text === 'ok', 'ключи с «=» на конце тоже принимаются');

  let bad = '';
  try { await encrypt('x', b64u(crypto.randomBytes(40)), ph.keys.auth); } catch (e) { bad = e.message; }
  const junk = crypto.randomBytes(65); junk[0] = 4; // похоже на ключ, но точки нет на кривой
  let bad2 = null;
  try { await encrypt('x', b64u(junk), ph.keys.auth); } catch (e) { bad2 = e; }
  ok(bad === 'bad p256dh' && !!bad2, 'испорченный ключ подписки — ошибка этой подписки, а не падение всего');
  let big = '';
  try { await encrypt('я'.repeat(3000), ph.keys.p256dh, ph.keys.auth); } catch (e) { big = e.message; }
  ok(big === 'payload too big', 'слишком длинный текст не отправляется');
}

/* 2. подпись VAPID: служба пушей проверит её открытым ключом из подписки */
const vk = await makeVapidKeys();
const key = await importVapid(vk.jwk);
{
  ok(unb64u(vk.pub).length === 65 && unb64u(vk.pub)[0] === 4, 'открытый ключ VAPID — 65 байт, как ждёт PushManager.subscribe');
  const now = Date.now();
  const h = await vapidAuth('https://web.push.apple.com/QGuR3f-abc', key, vk.pub, 'https://vcrfftrk9w-afk.github.io/-/', now);
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h);
  ok(!!m, 'заголовок Authorization: vapid t=…, k=…');
  const head = JSON.parse(Buffer.from(unb64u(m[1])).toString());
  const claims = JSON.parse(Buffer.from(unb64u(m[2])).toString());
  ok(head.alg === 'ES256' && head.typ === 'JWT', 'JWT подписан ES256');
  ok(claims.aud === 'https://web.push.apple.com', 'aud — ровно адрес службы Apple');
  const left = claims.exp - Math.floor(now / 1000);
  ok(left > 3600 && left <= 24 * 3600, 'срок подписи меньше суток (Apple иначе отказывает)');
  ok(/^https:\/\//.test(claims.sub) && !/@/.test(claims.sub), 'sub — адрес сайта, без почты');
  ok(m[4] === vk.pub, 'k — тот же открытый ключ');
  const pubKey = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: vk.jwk.x, y: vk.jwk.y }, format: 'jwk' });
  const valid = crypto.verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key: pubKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(unb64u(m[3])));
  ok(valid, 'подпись сходится с открытым ключом');
  const forged = crypto.verify('sha256', Buffer.from(`${m[1]}.${m[2]}x`), { key: pubKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(unb64u(m[3])));
  ok(!forged, 'подделанный JWT не проходит');
}

/* 3. отправка целиком: правильные заголовки, тело расшифровывается телефоном */
{
  const ph = phone();
  let seen = null;
  const fakeFetch = async (url, init) => { seen = { url, init }; return new Response('', { status: 201 }); };
  const payload = { title: '🎞️ Через 10 минут: ТТ видео — кино', body: 'Ровно в 19:55', tag: 't1', open: 'x' };
  const r = await send({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', ...ph.keys }, payload,
    { key, pub: vk.pub, subject: 'https://vcrfftrk9w-afk.github.io/-/', fetch: fakeFetch });
  ok(r.status === 201, 'ответ службы 201 — доставлено');
  const hd = seen.init.headers;
  ok(seen.url === 'https://fcm.googleapis.com/fcm/send/abc' && seen.init.method === 'POST', 'POST на адрес подписки');
  ok(hd['Content-Encoding'] === 'aes128gcm' && hd.TTL === '3600' && hd.Urgency === 'high', 'заголовки: aes128gcm, TTL час, срочно');
  ok(/aud/.test(Buffer.from(unb64u(hd.Authorization.split('.')[1])).toString()) && hd.Authorization.includes('k=' + vk.pub), 'подпись VAPID в заголовке');
  ok(JSON.parse(decrypt(seen.init.body, ph).text).title === payload.title, 'телефон читает название дела');

  const gone = await send({ endpoint: 'https://web.push.apple.com/x', ...ph.keys }, payload,
    { key, pub: vk.pub, subject: 'https://x/', fetch: async () => new Response('{"reason":"Unregistered"}', { status: 410 }) });
  ok(gone.status === 410 && gone.text.includes('Unregistered'), '410 — подписки больше нет, причина сохраняется');
}

console.log(fails ? `\n❌ Ошибок: ${fails}` : '\n✅ Шифрование и подпись пушей в порядке');
process.exit(fails ? 1 : 0);
