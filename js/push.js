'use strict';
/* =========================================================
   PUSH — на айфоне уведомление в ту же минуту, когда на Android звонит будильник.

   Будильники на Android ставит APK (Remind.syncAlarms). Айфон сайтам звонить
   не даёт, но приложению с экрана «Домой» (iOS 16.4+) можно присылать пуши:
   1) любой телефон аккаунта отправляет на сервер тот же список будильников,
      что получает APK (Remind.pushList), со своим часовым поясом;
   2) айфон один раз подписывается на пуши — кнопкой «Включить уведомления»;
   3) сервер (Supabase: раз в минуту ldm.push_tick + функция ldm-push) в нужную
      минуту присылает уведомление. Нажал на него — открывается это дело.
   Сделал дело — его уведомление сегодня не придёт, как и будильник на Android.
   Подписка у каждого телефона своя (localStorage), расписание — общее для аккаунта.
   ========================================================= */

const Push = (() => {
  const LS = 'ldm_push_v1';        // этот телефон: { on, endpoint, at }
  const PLAN = 'ldm_push_plan_v1'; // отпечаток расписания, которое уже лежит на сервере
  const DAY = 24 * 3600 * 1000;

  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } };
  const me = () => read(LS) || {};

  const apk = () => !!window.AndroidApp;
  const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => !!((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone);
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
  const perm = () => (typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const account = () => typeof Account !== 'undefined' && Account.available();

  /* что показать на этом телефоне */
  function status() {
    if (apk() || !account()) return 'none';        // в APK звонит будильник; в Claude аккаунта нет
    if (ios() && !standalone()) return 'install';  // айфон присылает уведомления только приложениям с экрана «Домой»
    if (!supported()) return 'old';
    if (!Account.signedIn) return 'login';
    if (perm() === 'denied') return 'denied';
    return me().on && perm() === 'granted' ? 'on' : 'off';
  }

  const fail = (code) => Object.assign(new Error(code), { code });

  function swReady(ms) {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, no) => setTimeout(() => no(fail('sw')), ms || 8000)),
    ]);
  }

  const keyBytes = (k) => {
    const s = String(k).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
  };
  /* подписка сделана с другим ключом сервера — её надо пересоздать */
  function sameKey(sub, key) {
    try {
      const a = new Uint8Array(sub.options.applicationServerKey);
      const b = keyBytes(key);
      return a.length === b.length && a.every((x, i) => x === b[i]);
    } catch (e) { return true; }
  }

  async function serverKey() {
    const j = await Account.call('ldm_push_key', {}, { anon: true });
    if (!j || !j.ok || !j.key) throw fail(j && j.error === 'network' ? 'network' : 'not_ready');
    return j.key;
  }

  const device = () => (ios() ? 'iphone' : /Android/i.test(navigator.userAgent) ? 'android' : 'web');

  async function register(sub) {
    const j = sub.toJSON();
    const r = await Account.call('ldm_push_subscribe', {
      p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_device: device(),
    });
    if (r && r.ok) write(LS, { on: true, endpoint: j.endpoint, at: Date.now() });
    return r || { ok: false, error: 'network' };
  }

  /* «Включить уведомления» — вызывать прямо из нажатия: айфон спрашивает разрешение только так */
  async function enable() {
    let p = perm();
    if (p !== 'granted') p = await Notification.requestPermission();
    if (p !== 'granted') return { ok: false, error: p === 'denied' ? 'denied' : 'dismissed' };
    const reg = await swReady();
    // свежий sw.js (с показом уведомлений) — до подписки: пуш без показа айфон считает нарушением
    try { await reg.update(); } catch (e) { /* нет сети — работает и текущий */ }
    const key = await serverKey();
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub, key)) { try { await sub.unsubscribe(); } catch (e) { /* и так пересоздаём */ } sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    const r = await register(sub);
    if (!r.ok) return r;
    await sendPlan(true);
    return { ok: true, devices: r.devices };
  }

  /* выключить на этом телефоне (и при выходе из аккаунта). Сервер узнает сам:
     служба пушей ответит «подписки больше нет», и ldm-push её уберёт */
  async function disable() {
    write(LS, null);
    if (!supported()) return;
    try {
      const reg = await swReady(4000);
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch (e) { /* подписки и так нет */ }
  }

  const test = () => Account.call('ldm_push_test', {});

  /* при запуске: подписка жива? Раз в сутки напоминаем о ней серверу (вдруг её убрали) */
  async function refresh() {
    if (status() !== 'on') return;
    try {
      const reg = await swReady();
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { write(LS, null); redraw(); return; } // айфон сбросил подписку — покажем «Включить»
      const m = me();
      if (sub.endpoint !== m.endpoint || Date.now() - (m.at || 0) > DAY) await register(sub);
    } catch (e) { /* нет сети — в другой раз */ }
  }

  /* ---------- расписание: тот же список, что будильники APK ---------- */
  const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; } };
  function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  function plan() {
    try { return typeof Remind !== 'undefined' && Remind.pushList ? Remind.pushList() : []; } catch (e) { return []; }
  }

  /* отправить, если список поменялся (сделал дело, переставил время, новый день с другим планом) */
  async function sendPlan(force) {
    if (!account() || !Account.signedIn) return null;
    const items = plan();
    const tz = zone();
    const off = -new Date().getTimezoneOffset();
    const print = hash(JSON.stringify([Account.login, tz, off, items]));
    if (!force && read(PLAN) === print) return null;
    const r = await Account.call('ldm_push_plan', { p_items: items, p_tz: tz, p_off: off });
    if (r && r.ok) write(PLAN, print);
    return r;
  }
  let planTimer = null;
  const planSoon = () => { clearTimeout(planTimer); planTimer = setTimeout(() => sendPlan(false), 3000); };

  /* ---------- ближайшие уведомления ---------- */
  function upcoming(n) {
    const items = plan();
    const now = new Date();
    const out = [];
    for (let d = 0; d < 8 && out.length < n; d++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
      const key = State.dateKey(day);
      const after = d === 0 ? now.getHours() * 60 + now.getMinutes() : -1;
      items.filter((it) => it.dow === day.getDay() && it.min > after && it.skip !== key && (!it.only || it.only === key))
        .sort((a, b) => a.min - b.min)
        .forEach((it) => { if (out.length < n) out.push({ d, at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, it.min), title: it.title }); });
    }
    return out;
  }
  const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const pad = (x) => (x < 10 ? '0' : '') + x;
  const when = (x) => `${x.d === 0 ? 'сегодня' : x.d === 1 ? 'завтра' : DAYS[x.at.getDay()]} в ${pad(x.at.getHours())}:${pad(x.at.getMinutes())}`;

  /* ---------- строка на «Моих делах» ---------- */
  const LINE = {
    install: 'Будильники на айфон: добавь приложение на экран «Домой»',
    old: 'Этот браузер не получает уведомления — как быть',
    login: 'Войди в аккаунт — и будильники придут уведомлением',
    denied: 'Уведомления запрещены — как включить',
    off: 'Включи уведомления — будильники придут на этот телефон',
  };
  const phoneUA = () => ios() || /Android/i.test(navigator.userAgent);
  function line() {
    const st = status();
    if (st === 'none') return '';
    if (st === 'on') {
      const nx = upcoming(1)[0];
      return `<button class="lv-alarm" data-push>🔔 Уведомления: ${nx ? `${when(nx)} · ${UI.esc(String(nx.title).replace(/^\S+\s/, ''))}` : 'включены'}</button>`;
    }
    const text = phoneUA() ? LINE[st] : LINE[st].replace('этот телефон', 'этот компьютер');
    return `<button class="lv-alarm warn" data-push>🔔 ${text}</button>`;
  }

  /* ---------- окно «🔔 Уведомления на этот телефон» ---------- */
  const ERR = {
    denied: 'Уведомления запрещены. Включи их в настройках телефона — как, написано ниже.',
    dismissed: 'Айфон спросил разрешение, но ответа не было. Нажми ещё раз и выбери «Разрешить».',
    network: 'Нет связи с сервером. Проверь интернет и нажми ещё раз.',
    no_session: 'Вход в аккаунт слетел — войди ещё раз.',
    not_ready: 'Сервер уведомлений ещё просыпается. Попробуй через минуту.',
    sw: 'Приложение ещё загружается. Подожди пару секунд и нажми снова.',
    too_often: 'Проверка уже ушла — подожди 20 секунд.',
    no_devices: 'Сервер не знает этот телефон. Нажми «Выключить» и включи снова.',
    too_many_devices: 'Уведомления уже включены на 10 устройствах. Выключи их на старых.',
    bad_subscription: 'Телефон выдал странную подписку. Попробуй ещё раз.',
  };

  const WHAT = '<p class="muted small">Приходит то же, что звонит будильником на Android: ☀️ подъём, публикации в TikTok, твои дела с ⏰, уроки курсов и 🔥 «последний шанс» сохранить уровень. Сделал дело — сегодня о нём не напомнит.</p>';

  function block(st) {
    if (st === 'install') {
      return `
        <ol class="push-steps">
          <li>Открой этот сайт в <b>Safari</b>.</li>
          <li>Нажми <b>«Поделиться»</b> — квадрат со стрелкой ⬆️ внизу экрана.</li>
          <li>Пролистай вниз → <b>«На экран „Домой“»</b> → <b>«Добавить»</b>.</li>
          <li>Открой 🦥 <b>Ленивец→Миллионер</b> с экрана «Домой», войди тем же логином и нажми здесь <b>«Включить уведомления»</b>.</li>
        </ol>
        <p class="muted small">Так устроен айфон: уведомления от сайтов приходят только приложениям с экрана «Домой» (iOS 16.4 и новее). Прогресс общий — после входа всё будет на месте.</p>`;
    }
    if (st === 'old') {
      return ios()
        ? '<p class="push-warn">Этот айфон пока не умеет получать уведомления от приложений с экрана «Домой».</p><p class="muted small">Нужна iOS 16.4 или новее: Настройки → Основные → Обновление ПО. Потом открой приложение с экрана «Домой» и включи здесь.</p>'
        : '<p class="push-warn">Этот браузер не умеет получать уведомления.</p><p class="muted small">Открой сайт в Chrome, Safari, Firefox или Edge.</p>';
    }
    if (st === 'login') {
      return `
        <p>Сначала войди в аккаунт — тем же логином, что на Android. Тогда сервер знает твоё расписание.</p>
        <button class="btn btn-primary btn-lg btn-block" id="push-login">☁️ Войти</button>`;
    }
    if (st === 'denied') {
      return `
        <p class="push-warn">Уведомления для приложения запрещены.</p>
        <p class="muted small">${ios()
          ? 'Настройки айфона → Уведомления → <b>Ленивец→Миллионер</b> → включи «Допуск уведомлений». Потом вернись сюда.'
          : 'Значок 🔒 слева от адреса сайта → Уведомления → Разрешить. Потом обнови страницу.'}</p>`;
    }
    if (st === 'off') {
      return `
        <button class="btn btn-primary btn-lg btn-block" id="push-on">🔔 Включить уведомления</button>
        <p class="muted small">Телефон спросит разрешение — нажми «Разрешить».</p>`;
    }
    const next = upcoming(3);
    return `
      <p class="push-ok">✅ Включены на этом телефоне</p>
      <ul class="push-next">${next.length
        ? next.map((x) => `<li><b>${when(x)}</b><span>${UI.esc(x.title)}</span></li>`).join('')
        : '<li><span class="muted">Ближайших будильников нет</span></li>'}</ul>
      <button class="btn btn-primary btn-block" id="push-test">📨 Проверить — прислать сейчас</button>
      <p class="muted small">Не пришло за минуту? Выключи «Фокус» / «Не беспокоить» и проверь: Настройки → Уведомления → Ленивец→Миллионер.</p>
      <button class="btn btn-ghost btn-block" id="push-off">🔕 Выключить на этом телефоне</button>`;
  }

  function redraw() { try { if (typeof App !== 'undefined' && App.renderActive) App.renderActive(); } catch (e) {} }

  function open() {
    const render = () => {
      const st = status();
      const body = UI.sheet(`
        <div class="push-sheet">
          <div class="why-tag">На Android — будильник, на айфоне — уведомление</div>
          <h2>🔔 Уведомления на этот телефон</h2>
          <p class="muted">Подъём, публикации, твои дела и уроки — в ту же минуту, что звонит будильник на Android. Даже когда приложение закрыто.</p>
          ${block(st)}
          ${WHAT}
        </div>`);
      body.onclick = async (e) => {
        // то же окно меняется на вход (закрыть и сразу открыть нельзя — закрытие доиграет и спрячет его)
        if (e.target.closest('#push-login')) { Account.open({ mode: 'login' }); return; }
        const on = e.target.closest('#push-on');
        if (on) {
          on.disabled = true;
          on.textContent = '⏳ Секунду…';
          let r;
          try { r = await enable(); } catch (err) {
            r = { ok: false, error: (err && err.code) || (err && err.name === 'NotAllowedError' ? 'denied' : 'network') };
          }
          if (r.ok) { Sound.sfx('success'); UI.toast('Уведомления включены — будильники придут на этот телефон', 'success', '🔔'); }
          else UI.toast(ERR[r.error] || 'Не получилось. Попробуй ещё раз.', 'warn', '🔔');
          if (body.isConnected) render();
          redraw();
          return;
        }
        const t = e.target.closest('#push-test');
        if (t) {
          t.disabled = true;
          const r = await test();
          t.disabled = false;
          if (r && r.ok) UI.toast('Отправил — уведомление придёт через пару секунд', 'success', '📨');
          else UI.toast(ERR[r && r.error] || 'Не получилось. Попробуй ещё раз.', 'warn', '📨');
          return;
        }
        if (e.target.closest('#push-off')) {
          await disable();
          Sound.sfx('pop');
          UI.toast('Уведомления на этом телефоне выключены', 'default', '🔕');
          render();
          redraw();
        }
      };
    };
    render();
  }

  /* карточка в «⏰ Напоминания в телефон» (не в APK) */
  function card() {
    const st = status();
    if (st === 'none') return '';
    return `
      <div class="remind-note push-card">
        <b>🔔 Уведомления на айфон</b>
        <p class="muted small">${st === 'on' ? '✅ Включены на этом телефоне — приходят в ту же минуту, что будильник на Android.' : 'Будильники придут уведомлением, даже когда приложение закрыто.'}</p>
        <button class="btn ${st === 'on' ? 'btn-ghost' : 'btn-primary'} btn-block" data-push-open>${st === 'on' ? 'Настроить' : '🔔 Включить'}</button>
      </div>`;
  }

  if (typeof window !== 'undefined' && account()) {
    // расписание: после каждого изменения (дело сделано, время переставлено) — на сервер, если стало другим
    if (typeof State !== 'undefined' && State.on) State.on('change', planSoon);
    window.addEventListener('load', () => setTimeout(() => { sendPlan(false); refresh(); }, 2500));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) planSoon(); });
  }

  return {
    status, line, open, card, enable, disable, test, sendPlan, upcoming, refresh,
    get on() { return status() === 'on'; },
  };
})();
