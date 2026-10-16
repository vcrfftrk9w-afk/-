/* =========================================================
   WEB PUSH без библиотек — только WebCrypto.
   Работает и в Supabase Edge Functions (Deno), и в Node 20+ (тесты).

   Пуш на айфон (и в любой браузер) уходит в службу пушей Apple / Google /
   Mozilla. Служба доставляет его телефону, но прочитать не может:
   текст зашифрован ключом самого телефона (RFC 8291, aes128gcm),
   а отправитель подписан своим ключом VAPID (RFC 8292).
   ========================================================= */

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export function b64u(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hkdf(salt, ikm, info, len) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

const RS = 4096; // размер записи: весь текст помещается в одну

/* зашифровать текст для подписки браузера (keys.p256dh, keys.auth) — тело запроса aes128gcm */
export async function encrypt(payload, p256dh, auth, opts = {}) {
  const ua = unb64u(p256dh);
  const secret = unb64u(auth);
  if (ua.length !== 65 || ua[0] !== 4) throw new Error('bad p256dh');
  if (secret.length < 16) throw new Error('bad auth');
  const data = typeof payload === 'string' ? enc.encode(payload) : payload;
  if (data.length > RS - 17) throw new Error('payload too big');

  const uaKey = await subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const own = opts.keys || await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await subtle.exportKey('raw', own.publicKey));
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKey }, own.privateKey, 256));

  const ikm = await hkdf(secret, shared, concat(enc.encode('WebPush: info\0'), ua, asPub), 32);
  const salt = opts.salt || globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // 0x02 — «это последняя запись»
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(data, new Uint8Array([2]))));

  const head = new Uint8Array(16 + 4 + 1 + asPub.length);
  head.set(salt, 0);
  new DataView(head.buffer).setUint32(16, RS);
  head[20] = asPub.length;
  head.set(asPub, 21);
  return concat(head, ct);
}

/* новая пара ключей VAPID: публичный (base64url) — браузеру, закрытый (JWK) — в базу */
export async function makeVapidKeys() {
  const k = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', k.privateKey);
  return { pub: b64u(await subtle.exportKey('raw', k.publicKey)), jwk: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d } };
}

export function importVapid(jwk) {
  return subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/* заголовок Authorization: подписанный JWT (ES256) для службы пушей этого адреса.
   Apple требует: aud = адрес службы, exp — не дальше суток, sub — https: или mailto: */
export async function vapidAuth(endpoint, key, pub, subject, now = Date.now()) {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: subject,
  })));
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${pub}`;
}

/* отправить один пуш: { status, text } — 201 доставлен в службу, 404/410 — подписки больше нет */
export async function send(sub, payload, ctx) {
  const body = await encrypt(JSON.stringify(payload), sub.p256dh, sub.auth);
  const res = await (ctx.fetch || fetch)(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuth(sub.endpoint, ctx.key, ctx.pub, ctx.subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ctx.ttl == null ? 3600 : ctx.ttl), // напоминание старше часа уже не нужно
      Urgency: 'high',
    },
    body,
    signal: AbortSignal.timeout(ctx.timeout || 10000),
  });
  const text = res.ok ? '' : (await res.text().catch(() => '')).slice(0, 200);
  return { status: res.status, text };
}
