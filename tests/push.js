const { chromium } = require('playwright');
const vm = require('vm');
const fs = require('fs');
const crypto = require('crypto');
/* Уведомления на айфон вместо будильника. Сервер (Supabase: ldm_push_*) подменён поддельным
   с теми же правилами, службу пушей айфона подменяет поддельный PushManager.
   1) sw.js: пуш показывается уведомлением, нажатие открывает приложение на этом деле.
   2) Айфон в Safari — инструкция «На экран „Домой“».
   3) Айфон с экрана «Домой»: войти → «Включить уведомления» (разрешение спрашивается прямо
      из нажатия) → подписка и расписание на сервере, то же, что будильники APK → «Проверить» →
      сделал дело — сегодня о нём не напомнит → раз в сутки подписка обновляется →
      нажатие на уведомление открывает «Мои дела» → «Выключить» → запрет в настройках → выход.
   4) APK: строки уведомлений нет (звонит будильник), но расписание на сервер уходит.
   5) Bark (громкий будильник из App Store): в Safari без экрана «Домой» — войти, скопировать
      ссылку в Bark, «Вставить и подключить» → ключ на сервере, расписание, проверочный сигнал;
      мусор вместо ссылки — понятная подсказка; вручную; отключить. */
const API = 'https://lgsharkholmydihgtvis.supabase.co/rest/v1/rpc/';
const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
const VAPID = ecdh.getPublicKey().toString('base64url');
const server = { accounts: {}, sessions: {}, docs: {}, subs: {}, plans: {}, tests: [], calls: [] };
let clock = 0;
const ENDPOINT = /^https:\/\/(web\.push\.apple\.com|fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)\//;
function handle(fn, a) {
  server.calls.push(fn);
  const acc = (t) => server.sessions[t];
  const login = String(a.p_login || '').trim().toLowerCase();
  switch (fn) {
    case 'ldm_register':
      if (server.accounts[login]) return { ok: false, error: 'login_taken' };
      server.accounts[login] = a.p_password;
      return session(login);
    case 'ldm_login':
      if (server.accounts[login] !== a.p_password) return { ok: false, error: 'bad_login' };
      return session(login);
    case 'ldm_get': {
      const l = acc(a.p_token); if (!l) return { ok: false, error: 'no_session' };
      const d = server.docs[l + '/' + a.p_name];
      return d ? { ok: true, exists: true, body: d.body, updated_at: d.at } : { ok: true, exists: false };
    }
    case 'ldm_set': {
      const l = acc(a.p_token); if (!l) return { ok: false, error: 'no_session' };
      const at = new Date(Date.UTC(2026, 9, 1) + (++clock) * 1000).toISOString();
      server.docs[l + '/' + a.p_name] = { body: a.p_body, at };
      return { ok: true, updated_at: at };
    }
    case 'ldm_logout': delete server.sessions[a.p_token]; return { ok: true };
    // ---- уведомления: те же правила, что в supabase/migrations/20261016_ldm_push.sql ----
    case 'ldm_push_key': return { ok: true, key: VAPID };
    case 'ldm_push_subscribe': {
      const l = acc(a.p_token); if (!l) return { ok: false, error: 'no_session' };
      if (!ENDPOINT.test(a.p_endpoint || '') || !/^[A-Za-z0-9_+/-]{86,88}={0,2}$/.test(a.p_p256dh || '') || !/^[A-Za-z0-9_+/-]{21,24}={0,2}$/.test(a.p_auth || '')) return { ok: false, error: 'bad_subscription' };
      server.subs[a.p_endpoint] = { login: l, p256dh: a.p_p256dh, auth: a.p_auth, device: a.p_device };
      return { ok: true, devices: Object.values(server.subs).filter((s) => s.login === l).length };
    }
    case 'ldm_push_plan': {
      const l = acc(a.p_token); if (!l) return { ok: false, error: 'no_session' };
      if (!Array.isArray(a.p_items) || a.p_items.length > 400) return { ok: false, error: 'bad_items' };
      const clean = a.p_items.filter((it) => it && /^[0-6]$/.test(String(it.dow)) && /^\d{1,4}$/.test(String(it.min)) && it.min < 1440)
        .map((it) => Object.assign({ dow: +it.dow, min: +it.min, title: String(it.title || '').slice(0, 120), text: String(it.text || '').slice(0, 300) },
          /^\d{4}-\d{2}-\d{2}$/.test(it.skip || '') ? { skip: it.skip } : {}, /^\d{4}-\d{2}-\d{2}$/.test(it.only || '') ? { only: it.only } : {}));
      server.plans[l] = { items: clean, tz: a.p_tz, off: a.p_off, n: (server.plans[l] ? server.plans[l].n : 0) + 1 };
      return { ok: true, n: clean.length, devices: Object.values(server.subs).filter((s) => s.login === l).length };
    }
    case 'ldm_push_bark': {
      const l = acc(a.p_token); if (!l) return { ok: false, error: 'no_session' };
      const k = String(a.p_key || '').trim() || null;
      if (k && !/^[A-Za-z0-9]{8,64}$/.test(k)) return { ok: false, error: 'bad_key' };
      const ep = 'https://api.day.app/' + k;
      Object.entries(server.subs).forEach(([e, s]) => { if (s.login === l && s.device === 'bark' && (!k || e !== ep)) s.device = 'bark-off'; });
      if (!k) return { ok: true, bark: false };
      server.subs[ep] = { login: l, p256dh: '', auth: '', device: 'bark' };
      return { ok: true, bark: true };
    }
    case 'ldm_push_status': {
      const l = acc(a.p_token); if (!l) return { ok: false, error: 'no_session' };
      const mine = Object.values(server.subs).filter((s) => s.login === l);
      return { ok: true, bark: mine.some((s) => s.device === 'bark'), web: mine.filter((s) => s.device !== 'bark' && s.device !== 'bark-off').length, last: server.last || null };
    }
    case 'ldm_push_test': {
      const l = acc(a.p_token); if (!l) return { ok: false, error: 'no_session' };
      const n = Object.values(server.subs).filter((s) => s.login === l && s.device !== 'bark-off').length;
      if (!n) return { ok: false, error: 'no_devices' };
      if (server.tests.some((t) => t.login === l && Date.now() - t.at < 20000)) return { ok: false, error: 'too_often' };
      server.tests.push({ login: l, at: Date.now() });
      server.last = Object.values(server.subs).some((s) => s.login === l && s.device === 'bark') ? 'api.day.app 201' : 'web.push.apple.com 201';
      return { ok: true, devices: n };
    }
    default: return { ok: false, error: 'unknown' };
  }
}
function session(login) { const t = 'tok' + Math.random().toString(16).slice(2); server.sessions[t] = login; return { ok: true, token: t, login }; }

/* айфон: Safari или приложение с экрана «Домой»; поддельные разрешение и служба пушей */
const fakePush = ({ standalone }) => {
  if (standalone) Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
  // как настоящий телефон: разрешение и подписка переживают перезапуск приложения
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('__fakepush') || '{}'); } catch (e) {}
  const P = window.__push = Object.assign({ perm: 'default', answer: 'granted', asked: 0, activeOnAsk: null, sub: null, subscribes: [], unsubscribed: 0 }, saved, { sub: null });
  const keep = () => { try { localStorage.setItem('__fakepush', JSON.stringify(Object.assign({}, P, { sub: null, endpoint: P.sub ? P.sub.endpoint : null, key: P.sub ? P.key : null }))); } catch (e) {} };
  const make = (endpoint, key) => ({
    endpoint,
    options: { applicationServerKey: new Uint8Array(key).buffer },
    toJSON: () => ({ endpoint, keys: { p256dh: 'B' + 'x'.repeat(86), auth: 'a'.repeat(22) } }),
    unsubscribe: () => { P.unsubscribed += 1; P.sub = null; keep(); return Promise.resolve(true); },
  });
  if (saved.endpoint) { P.key = saved.key; P.sub = make(saved.endpoint, saved.key); }
  window.__keepPush = keep;
  try {
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => P.perm });
    Notification.requestPermission = function () {
      P.asked += 1;
      P.activeOnAsk = navigator.userActivation ? navigator.userActivation.isActive : null; // спросили прямо из нажатия?
      P.perm = P.answer;
      keep();
      return Promise.resolve(P.perm);
    };
  } catch (e) { /* нет Notification */ }
  PushManager.prototype.getSubscription = function () { return Promise.resolve(P.sub); };
  PushManager.prototype.subscribe = function (opts) {
    if (P.perm !== 'granted') return Promise.reject(new DOMException('Push notification prompting can only be done from a user gesture.', 'NotAllowedError'));
    const key = Array.from(new Uint8Array(opts.applicationServerKey));
    P.subscribes.push({ userVisibleOnly: opts.userVisibleOnly, key });
    P.key = key;
    P.sub = make('https://web.push.apple.com/QFake' + P.subscribes.length, key);
    keep();
    return Promise.resolve(P.sub);
  };
};
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

async function phone(b, name, opts) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 793 }, userAgent: opts.ua, timezoneId: 'Europe/Kyiv', hasTouch: true });
  await ctx.route(API + '*', async (route) => {
    const fn = route.request().url().split('/').pop();
    const body = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(handle(fn, body)) });
  });
  if (opts.push) await ctx.addInitScript(fakePush, { standalone: !!opts.standalone });
  if (opts.init) await ctx.addInitScript(opts.init);
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(name + ': ' + e.message));
  return p;
}
const closeModals = (p) => p.evaluate(() => document.querySelectorAll('.modal.modal-open').forEach((m) => { if (m.id !== 'sheet-modal') UI.closeModal('#' + m.id); })).then(() => p.waitForTimeout(350));
const closeSheet = (p) => p.evaluate(() => UI.closeModal('#sheet-modal')).then(() => p.waitForTimeout(300));
const lineText = (p) => p.evaluate(() => { const e = document.querySelector('#mytasks-root [data-push]'); return e ? e.textContent.trim() : null; });
const lastToast = (p) => p.evaluate(() => { const t = [...document.querySelectorAll('.toast')]; return t.length ? t[t.length - 1].textContent : ''; });

/* ---------- 1. sw.js: показать пуш и открыть по нажатию ---------- */
async function swChecks(check) {
  const handlers = {};
  const shown = [];
  const clients = [];
  const opened = [];
  const self = {
    addEventListener: (t, f) => { handlers[t] = f; },
    skipWaiting: () => {},
    registration: { scope: 'https://vcrfftrk9w-afk.github.io/-/', showNotification: (title, o) => { shown.push({ title, o }); return Promise.resolve(); } },
    clients: { matchAll: async () => clients, openWindow: async (u) => { opened.push(u); }, claim: () => {} },
    location: { origin: 'https://vcrfftrk9w-afk.github.io' },
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/../sw.js', 'utf8'), { self, caches: {}, fetch: () => {}, URL, console });
  const fire = async (type, ev) => { let p = null; ev.waitUntil = (x) => { p = x; }; handlers[type](ev); await p; };
  await fire('push', { data: { json: () => ({ title: '☀️ Подъём', body: 'Вода, умывание', tag: 'k1', open: '☀️ Подъём' }) } });
  const n = shown[0];
  check('sw.js: пуш — уведомление с названием, текстом и иконкой', n && n.title === '☀️ Подъём' && n.o.body === 'Вода, умывание' && /icon-192/.test(n.o.icon) && n.o.tag === 'k1' && n.o.data.open === '☀️ Подъём', n);
  await fire('push', { data: { json: () => { throw new Error('not json'); }, text: () => 'просто текст' } });
  check('sw.js: пуш не JSON — всё равно показывается', shown[1] && shown[1].title === 'просто текст', shown[1]);
  let closed = 0;
  const note = (open) => ({ close: () => { closed += 1; }, data: { open } });
  await fire('notificationclick', { notification: note('💪 Тренировка') });
  check('sw.js: нажал, приложение закрыто — открывается на этом деле', closed === 1 && opened[0] === 'https://vcrfftrk9w-afk.github.io/-/index.html?open=' + encodeURIComponent('💪 Тренировка'), opened);
  const msgs = []; let focused = 0;
  clients.push({ url: 'https://vcrfftrk9w-afk.github.io/-/index.html', focus: async () => { focused += 1; }, postMessage: (m) => msgs.push(m) });
  await fire('notificationclick', { notification: note('☀️ Подъём') });
  check('sw.js: приложение уже открыто — переключается на него и открывает дело', focused === 1 && opened.length === 1 && msgs[0] && msgs[0].type === 'ldm-open' && msgs[0].title === '☀️ Подъём', msgs);
  await fire('notificationclick', { notification: note('') });
  check('sw.js: проверочное уведомление — просто открыть приложение', msgs[1] && msgs[1].title === '', msgs[1]);
}

(async () => {
  let ok = true; const check = (n, c, i) => { console.log((c ? '✓ ' : '✗ ') + n, i !== undefined ? JSON.stringify(i).slice(0, 300) : ''); if (!c) ok = false; };
  await swChecks(check);

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ---------- 2. айфон, Safari: Bark — громкий будильник без экрана «Домой» ---------- */
  const S = await phone(b, 'safari', { ua: IPHONE, init: () => {
    try { localStorage.setItem('ldm_auth_skip', '1'); } catch (e) {}
    // буфер обмена: что «скопировали» в Bark
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => Promise.resolve(window.__clip || ''), writeText: () => Promise.resolve() } }); } catch (e) {}
  } });
  await S.goto('http://localhost:8792/index.html'); await S.waitForTimeout(800);
  await S.evaluate(() => { State.s.onboarded = true; State.s.mode = 'adhd'; State.save(); location.reload(); });
  await S.waitForTimeout(2200); await closeModals(S);
  const top = await S.evaluate(() => { const b = document.querySelector('#mytasks-root .push-banner'); const h = [...document.querySelectorAll('#mytasks-root h4.my-sec')][0]; return { txt: b ? b.textContent.replace(/\s+/g, ' ').trim() : null, above: !!(b && h && (b.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING)), bottom: !!document.querySelector('#mytasks-root .lv-alarm[data-push]') }; });
  check('айфон: наверху «Моих дел» карточка «⏰ Будильник на айфоне не подключён» — выше дел, внизу дубля нет', top.txt && /Будильник на айфоне не подключён/.test(top.txt) && top.above && !top.bottom, top);
  await S.click('#mytasks-root [data-push]'); await S.waitForTimeout(400);
  check('без аккаунта окно сначала просит войти', await S.evaluate(() => !!document.querySelector('#push-login') && !document.querySelector('.push-bark')));
  await S.click('#push-login'); await S.waitForTimeout(500);
  await S.click('[data-accmode="create"]'); await S.waitForTimeout(200);
  await S.fill('#acc-login', 'lenivec'); await S.fill('#acc-pass', 'secret123');
  await S.click('#acc-go'); await S.waitForTimeout(2500); await closeModals(S);
  check('вошёл (аккаунт создан) — карточка всё ещё зовёт подключить', await S.evaluate(() => Account.signedIn) && /не подключён/.test(await lineText(S) || ''), await lineText(S));

  await S.click('#mytasks-root [data-push]'); await S.waitForTimeout(500);
  const sh = await S.evaluate(() => ({
    bark: !!document.querySelector('#sheet-body .push-bark'),
    store: (document.querySelector('#sheet-body .push-bark a') || {}).href || '',
    paste: !!document.querySelector('#bark-paste'),
    webOpen: (document.querySelector('#sheet-body details.push-web') || {}).open,
    steps: [...document.querySelectorAll('#sheet-body details.push-web .push-steps li')].length,
    pushOn: !!document.querySelector('#push-on'),
    diag: (document.querySelector('#sheet-body .push-diag') || {}).textContent || '',
  }));
  check('в окне видно, из какого аккаунта будильники, и можно сменить', await S.evaluate(() => /Аккаунт: lenivec/.test(document.querySelector('#sheet-body .push-acc').textContent) && !!document.querySelector('#push-acc')));
  check('окно: Bark первым — ссылка на App Store и «Вставить и подключить»', sh.bark && /apps\.apple\.com\/app\/id1403753865/.test(sh.store) && sh.paste, sh);
  check('уведомления сайта — свёрнуты ниже, внутри инструкция «На экран „Домой“», кнопки «Включить» в Safari нет', sh.webOpen === false && sh.steps === 4 && !sh.pushOn, sh);
  check('строка диагностики: iOS, в браузере, Bark: нет', /iOS 17\.5/.test(sh.diag) && /в браузере/.test(sh.diag) && /Bark: нет/.test(sh.diag), sh.diag);

  // скопировал не то — подсказка и поле для ручной вставки
  await S.evaluate(() => { window.__clip = 'привет'; });
  await S.click('#bark-paste'); await S.waitForTimeout(400);
  check('скопировано не то — «Не нашёл ключ Bark», поле вставки раскрыто', /Не нашёл ключ Bark/.test(await lastToast(S)) && await S.evaluate(() => document.querySelector('#bark-manual').open) && !Object.values(server.subs).some((x) => x.device === 'bark'), await lastToast(S));
  await closeSheet(S);

  // скопировал ссылку в Bark → «Вставить и подключить»
  await S.click('#mytasks-root [data-push]'); await S.waitForTimeout(400);
  await S.evaluate(() => { window.__clip = 'https://api.day.app/AbCdEf123456/Тестовое%20сообщение'; });
  const t0 = server.tests.length;
  await S.click('#bark-paste'); await S.waitForTimeout(1500);
  const bk = server.subs['https://api.day.app/AbCdEf123456'];
  check('Bark подключён: ключ из ссылки на сервере', bk && bk.login === 'lenivec' && bk.device === 'bark', bk);
  check('сразу ушло расписание и проверочный сигнал', !!server.plans.lenivec && server.plans.lenivec.items.length > 0 && server.tests.length === t0 + 1, { plan: !!server.plans.lenivec, tests: server.tests.length - t0 });
  check('тост «Bark подключён — сейчас придёт проверочный сигнал»', /Bark подключён — сейчас придёт/.test(await lastToast(S)), await lastToast(S));
  const on = await S.evaluate(() => ({ ok: (document.querySelector('#sheet-body .push-bark.on .push-ok') || {}).textContent || '', next: document.querySelectorAll('#sheet-body .push-next li').length, test: !!document.querySelector('#push-test'), bark: Push.bark }));
  check('окно: «✅ Bark подключён», ближайшие будильники и «Проверить»', /Bark подключён/.test(on.ok) && on.next >= 1 && on.test && on.bark, on);
  await closeSheet(S);
  const ls = await lineText(S);
  check('строка: «🔔 Будильник на айфоне: сегодня/завтра в …»', /^🔔 Будильник на айфоне: (сегодня|завтра|Пн|Вт|Ср|Чт|Пт|Сб|Вс) в \d\d:\d\d · /.test(ls || ''), ls);

  // через 6 секунд окно узнаёт у сервера, что ушло последним
  await S.click('#mytasks-root [data-push]'); await S.waitForTimeout(400);
  await S.waitForTimeout(500);
  const dg = await S.evaluate(() => (document.querySelector('#sheet-body .push-diag') || {}).textContent || '');
  check('диагностика: Bark: да, последняя отправка видна', /Bark: да/.test(dg) && /последняя отправка: api\.day\.app 201/.test(dg), dg);

  // отключить и подключить вручную другим ключом
  await S.click('#bark-off'); await S.waitForTimeout(600);
  check('«Отключить Bark» — на сервере ключ выключен', server.subs['https://api.day.app/AbCdEf123456'].device === 'bark-off' && !(await S.evaluate(() => Push.bark)), server.subs['https://api.day.app/AbCdEf123456']);
  await S.click('#bark-manual summary'); await S.waitForTimeout(200);
  await S.fill('#bark-url', '  XyZ987654321  ');
  await S.click('#bark-on'); await S.waitForTimeout(1200);
  check('вставил ключ вручную — подключено', (server.subs['https://api.day.app/XyZ987654321'] || {}).device === 'bark' && await S.evaluate(() => Push.bark));
  await S.click('#bark-off'); await S.waitForTimeout(600);
  await closeSheet(S);
  check('после отключения — снова карточка «не подключён»', /не подключён/.test(await lineText(S) || ''), await lineText(S));

  /* ---------- 3. айфон, приложение с экрана «Домой» ---------- */
  server.tests = []; // прошло больше 20 секунд с проверок в Safari
  const I = await phone(b, 'iphone', { ua: IPHONE, push: true, standalone: true });
  await I.goto('http://localhost:8792/index.html'); await I.waitForTimeout(800);
  await I.evaluate(() => { State.s.onboarded = true; State.s.mode = 'adhd'; State.s.name = 'Тест'; State.save(); location.reload(); });
  await I.waitForTimeout(1800);
  // без входа: строка зовёт войти
  await I.evaluate(() => { try { localStorage.setItem('ldm_auth_skip', '1'); } catch (e) {} location.reload(); });
  await I.waitForTimeout(2200); await closeModals(I);
  check('без аккаунта: карточка зовёт подключить', /не подключён/.test(await lineText(I) || ''), await lineText(I));
  await I.click('#mytasks-root [data-push]'); await I.waitForTimeout(400);
  await I.click('#push-login'); await I.waitForTimeout(500);
  await I.fill('#acc-login', 'lenivec'); await I.fill('#acc-pass', 'secret123');
  await I.click('#acc-go'); await I.waitForTimeout(2500); await closeModals(I);
  check('вошёл из окна уведомлений тем же логином — аккаунт есть', await I.evaluate(() => Account.signedIn));
  await I.click('#mytasks-root [data-push]'); await I.waitForTimeout(400);
  check('с экрана «Домой»: блок уведомлений сайта раскрыт, кнопка «Включить уведомления» видна', await I.evaluate(() => document.querySelector('#sheet-body details.push-web').open && !!document.querySelector('#push-on')));
  await closeSheet(I);

  // включить
  await I.click('#mytasks-root [data-push]'); await I.waitForTimeout(400);
  const callsBefore = server.calls.length;
  await I.click('#push-on'); await I.waitForTimeout(1500);
  const P = await I.evaluate(() => window.__push);
  check('разрешение спрошено один раз и прямо из нажатия (иначе айфон не покажет вопрос)', P.asked === 1 && P.activeOnAsk === true, { asked: P.asked, active: P.activeOnAsk });
  check('подписка с ключом сервера и «только видимые уведомления»', P.subscribes.length === 1 && P.subscribes[0].userVisibleOnly === true && Buffer.from(P.subscribes[0].key).toString('base64url') === VAPID);
  const sub = server.subs['https://web.push.apple.com/QFake1'];
  check('сервер знает этот айфон', sub && sub.login === 'lenivec' && sub.device === 'iphone', sub);
  const plan = server.plans.lenivec;
  const local = await I.evaluate(() => JSON.parse(JSON.stringify(Remind.pushList())));
  check('расписание на сервере — ровно то, что APK ставит будильниками', plan && JSON.stringify(plan.items) === JSON.stringify(local) && local.length > 0, { server: plan && plan.items.length, local: local.length });
  check('…с часовым поясом телефона', plan && /^Europe\/(Kyiv|Kiev)$/.test(plan.tz) && plan.off === 180, plan && { tz: plan.tz, off: plan.off });
  check('в расписании подъём на все 7 дней недели', new Set(plan.items.filter((x) => /Подъём/.test(x.title)).map((x) => x.dow)).size === 7);
  check('порядок вызовов: ключ → подписка → расписание', server.calls.slice(callsBefore).join(',').includes('ldm_push_key,ldm_push_subscribe,ldm_push_plan'), server.calls.slice(callsBefore));
  check('тост «Уведомления включены»', /Уведомления включены/.test(await lastToast(I)), await lastToast(I));
  const sheet = await I.evaluate(() => ({ okTxt: (document.querySelector('#sheet-body .push-ok') || {}).textContent, next: [...document.querySelectorAll('#sheet-body .push-next li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()) }));
  check('окно: «✅ Включены», ближайшие уведомления со временем', /Включены/.test(sheet.okTxt || '') && sheet.next.length >= 1 && /(сегодня|завтра|Пн|Вт|Ср|Чт|Пт|Сб|Вс) в \d\d:\d\d/.test(sheet.next[0]), sheet);

  // проверить
  await I.click('#push-test'); await I.waitForTimeout(500);
  check('«Проверить» — сервер шлёт пуш на этот айфон', server.tests.length === 1 && /Отправил/.test(await lastToast(I)), await lastToast(I));
  await I.click('#push-test'); await I.waitForTimeout(500);
  check('второй раз сразу — «подожди 20 секунд»', server.tests.length === 1 && /20 секунд/.test(await lastToast(I)), await lastToast(I));
  await closeSheet(I);
  const nx = await I.evaluate(() => Push.upcoming(1)[0]);
  const l2 = await lineText(I);
  check('строка на «Моих делах»: когда следующее уведомление', nx && /^🔔 Уведомления: (сегодня|завтра|Пн|Вт|Ср|Чт|Пт|Сб|Вс) в \d\d:\d\d · /.test(l2 || ''), l2);

  // сделал дело — сегодня о нём не напомнит
  const today = await I.evaluate(() => State.todayKey());
  const before = server.plans.lenivec.items.filter((x) => x.skip === today).length;
  const n0 = server.plans.lenivec.n;
  await I.click('#mytasks-root [data-lvdone="kino"]'); await I.waitForTimeout(700); await closeModals(I);
  await I.waitForTimeout(3800);
  const after = server.plans.lenivec.items.filter((x) => x.skip === today);
  check('сделал «кино» — расписание обновилось само, публикация кино сегодня молчит', server.plans.lenivec.n > n0 && after.length > before && after.every((x) => /кино/.test(x.title)), after.map((x) => x.title));
  const n1 = server.plans.lenivec.n;
  await I.evaluate(() => State.commit()); await I.waitForTimeout(3600);
  check('ничего не поменялось — расписание повторно не отправляется', server.plans.lenivec.n === n1, { n1, now: server.plans.lenivec.n });

  // перезапуск: подписка жива, раз в сутки напоминаем о ней серверу
  const subCalls = () => server.calls.filter((c) => c === 'ldm_push_subscribe').length;
  const s0 = subCalls();
  await I.reload(); await I.waitForTimeout(3500); await closeModals(I);
  check('перезапуск в тот же день — без лишних запросов, уведомления включены', subCalls() === s0 && await I.evaluate(() => Push.status()) === 'on', { calls: subCalls() - s0 });
  await I.evaluate(() => { const m = JSON.parse(localStorage.getItem('ldm_push_v1')); m.at -= 2 * 864e5; localStorage.setItem('ldm_push_v1', JSON.stringify(m)); location.reload(); });
  await I.waitForTimeout(3500); await closeModals(I);
  check('прошли сутки — подписка напомнена серверу (если её убрали, вернётся)', subCalls() === s0 + 1, { calls: subCalls() - s0 });

  // нажал на уведомление — приложение открывается на «Моих делах»
  await I.evaluate(() => App.go('dashboard'));
  await I.goto('http://localhost:8792/index.html?open=' + encodeURIComponent('☀️ Подъём')); await I.waitForTimeout(2600); await closeModals(I);
  const opened = await I.evaluate(() => ({ panel: (document.querySelector('.tab-panel.active') || {}).id, url: location.search }));
  check('уведомление открыло приложение на «Моих делах», адрес очищен', opened.panel === 'tab-mytasks' && !/open=/.test(opened.url), opened);
  await I.evaluate(() => App.go('dashboard')); await I.waitForTimeout(300);
  await I.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'ldm-open', title: '📌 Что-то своё' } })));
  await I.waitForTimeout(500);
  check('приложение уже открыто — нажатие на уведомление переключает на «Мои дела»', await I.evaluate(() => (document.querySelector('.tab-panel.active') || {}).id) === 'tab-mytasks');

  // выключить
  await I.click('#mytasks-root [data-push]'); await I.waitForTimeout(400);
  await I.click('#push-off'); await I.waitForTimeout(800);
  const offState = await I.evaluate(() => ({ unsub: window.__push.unsubscribed, local: localStorage.getItem('ldm_push_v1'), st: Push.status() }));
  check('«Выключить» — подписка снята на телефоне (сервер уберёт её сам по ответу Apple)', offState.unsub === 1 && offState.local === null && offState.st === 'off', offState);
  await closeSheet(I);
  check('снова карточка «не подключён»', /не подключён/.test(await lineText(I) || ''), await lineText(I));

  // запрет: «Не разрешать» → понятно, где включить
  await I.evaluate(() => { window.__push.perm = 'default'; window.__push.answer = 'denied'; window.__keepPush(); });
  await I.click('#mytasks-root [data-push]'); await I.waitForTimeout(400);
  await I.click('#push-on'); await I.waitForTimeout(800);
  const denied = await I.evaluate(() => ({ st: Push.status(), txt: document.querySelector('#sheet-body').textContent }));
  check('нажал «Не разрешать» — объясняем, где включить в настройках айфона', denied.st === 'denied' && /Настройки айфона → Уведомления → Ленивец→Миллионер/.test(denied.txt) && /запрещены/.test(await lastToast(I)), denied.st);
  await closeSheet(I);
  check('после запрета карточка по-прежнему зовёт подключить (есть Bark)', /не подключён/.test(await lineText(I) || ''), await lineText(I));

  // снова разрешил в настройках и включил; потом вышел из аккаунта — уведомления этого телефона выключены
  await I.evaluate(() => { window.__push.perm = 'granted'; window.__keepPush(); });
  await I.evaluate(() => Push.open()); await I.waitForTimeout(400);
  await I.click('#push-on'); await I.waitForTimeout(1200);
  check('разрешил в настройках — включается без повторного вопроса', await I.evaluate(() => Push.status()) === 'on' && (await I.evaluate(() => window.__push.asked)) === 2);
  await closeSheet(I);
  await I.evaluate(() => Account.signOut()); await I.waitForTimeout(800);
  const out = await I.evaluate(() => ({ unsub: window.__push.unsubscribed, local: localStorage.getItem('ldm_push_v1') }));
  check('вышел из аккаунта — подписка снята', out.unsub === 2 && out.local === null, out);

  /* ---------- 3б. айфон, уже вошёл, будильник не подключён — окно открывается само один раз ---------- */
  const tokI = session('lenivec').token;
  const N = await phone(b, 'intro', { ua: IPHONE, init: `localStorage.setItem('ldm_account_v1', JSON.stringify({ token: '${tokI}', login: 'lenivec' }));` });
  await N.goto('http://localhost:8792/index.html'); await N.waitForTimeout(800);
  await N.evaluate(() => { State.s.onboarded = true; State.s.mode = 'adhd'; State.save(); location.reload(); });
  await N.waitForTimeout(800);
  await N.evaluate(() => document.querySelectorAll('.modal.modal-open').forEach((m) => UI.closeModal('#' + m.id)));
  await N.waitForTimeout(3500);
  check('вошёл, Bark не подключён — окно подключения открылось само', await N.evaluate(() => !!document.querySelector('#sheet-modal.modal-open .push-sheet .push-bark')));
  await closeSheet(N);
  await N.reload(); await N.waitForTimeout(800);
  await N.evaluate(() => document.querySelectorAll('.modal.modal-open').forEach((m) => UI.closeModal('#' + m.id)));
  await N.waitForTimeout(3500);
  check('…но только один раз: после перезапуска само не открывается, карточка наверху остаётся', await N.evaluate(() => !document.querySelector('#sheet-modal.modal-open .push-sheet') && !!document.querySelector('#mytasks-root .push-banner')));

  /* ---------- 4. APK: будильник звонит сам, но расписание для айфона отправляет ---------- */
  const tok = session('lenivec').token;
  const A = await phone(b, 'apk', {
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36',
    init: `(() => {
      localStorage.setItem('ldm_account_v1', JSON.stringify({ token: '${tok}', login: 'lenivec' }));
      window.AndroidApp = { speak() {}, stopSpeaking() {}, saveFile() {}, notify() {}, notifyState: () => 'granted', requestNotify() {},
        setAlarms: (j) => JSON.stringify({ exact: true, fullScreen: true, next: 0 }), alarmStatus: () => JSON.stringify({ exact: true, fullScreen: true }),
        testAlarm() {}, ringNow() {}, pickSound() {}, openSettings() {}, takeOpen: () => '' };
    })();`,
  });
  const nA = server.plans.lenivec.n;
  await A.goto('http://localhost:8792/index.html'); await A.waitForTimeout(800);
  await A.evaluate(() => { State.s.onboarded = true; State.s.mode = 'adhd'; State.save(); location.reload(); });
  await A.waitForTimeout(4500); await closeModals(A);
  const apk = await A.evaluate(() => ({ st: Push.status(), line: !!document.querySelector('#mytasks-root [data-push]'), alarm: !!document.querySelector('#mytasks-root [data-alarm]') }));
  check('APK: строки уведомлений нет — там звонит будильник', apk.st === 'none' && !apk.line && apk.alarm, apk);
  await A.evaluate(() => { localStorage.removeItem('ldm_push_plan_v1'); State.commit(); }); await A.waitForTimeout(3600);
  check('APK отправляет расписание на сервер — айфон узнаёт, что сделано на Android', server.plans.lenivec.n > nA, { before: nA, after: server.plans.lenivec.n });

  const errs = [...S.errs, ...I.errs, ...N.errs, ...A.errs];
  check('без ошибок на страницах', errs.length === 0, errs);
  await b.close();
  console.log(ok ? '\n✅ Уведомления на айфон работают' : '\n❌ Есть ошибки');
  process.exit(ok ? 0 : 1);
})();
