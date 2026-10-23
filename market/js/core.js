'use strict';
/* =========================================================
   CORE — основа Sauda: безопасная вёрстка, язык, деньги и время,
   запросы к базе, окна и всплывашки, адреса страниц, картинки.
   ========================================================= */

const Store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим или переполнено */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* нет хранилища */ } },
};

/* ---- вёрстка: всё, что подставлено в html`…`, экранируется; вложенные html`` и raw() вставляются как есть */
const RAW = Symbol('raw');
const raw = (s) => ({ [RAW]: true, s: String(s) });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function piece(v) {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(piece).join('');
  if (v[RAW]) return v.s;
  return esc(v);
}
function html(strings, ...vals) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < vals.length) out += piece(vals[i]);
  }
  return raw(out);
}
/* текст человека: экранировать, переносы строк сохранить, ссылки http(s) сделать кликабельными */
function richText(s) {
  const parts = String(s || '').split(/(https?:\/\/[^\s<>"']+)/g);
  return raw(parts.map((p, i) => (i % 2
    ? `<a href="${esc(p)}" target="_blank" rel="noopener noreferrer nofollow">${esc(p.length > 60 ? p.slice(0, 57) + '…' : p)}</a>`
    : esc(p))).join('').replace(/\n/g, '<br>'));
}

/* ---- язык: русский по умолчанию, казахский — словарь i18n-kz.js; ключ — сама русская строка */
const I18n = (() => {
  const KZ = {};
  let lang = Store.get('sauda_lang', null) || (/^kk|^kz/i.test(navigator.language || '') ? 'kz' : 'ru');
  function t(s, vars) {
    let r = lang === 'kz' && KZ[s] !== undefined ? KZ[s] : s;
    if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? vars[k] : m));
    return r;
  }
  /* число со словом: tp(5, 'отзыв|отзыва|отзывов') → «5 отзывов»; в казахском слово не меняется */
  function tp(n, forms, bare) {
    let w;
    if (lang === 'kz' && KZ[forms] !== undefined) w = KZ[forms];
    else {
      const f = forms.split('|');
      const a = Math.abs(n) % 100, b = a % 10;
      w = a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2];
    }
    return bare ? w : Fmt.num(n) + ' ' + w;
  }
  /* keep = false — только показать (язык из профиля или браузера), не запоминать как выбор человека */
  function set(l, keep) {
    lang = l === 'kz' ? 'kz' : 'ru';
    if (keep !== false) Store.set('sauda_lang', lang);
    document.documentElement.lang = lang === 'kz' ? 'kk' : 'ru';
  }
  return { t, tp, set, add: (d) => Object.assign(KZ, d), KZ, get lang() { return lang; } };
})();
const t = I18n.t;
const tp = I18n.tp;

/* ---- числа, деньги, время */
const Fmt = {
  num: (n) => new Intl.NumberFormat('ru-RU').format(Math.round(+n || 0)),
  money: (n) => Fmt.num(n) + ' ₸',
  // если браузер не знает казахских дат, лучше русские, чем английские
  loc: () => (I18n.lang === 'kz' && Intl.DateTimeFormat.supportedLocalesOf(['kk-KZ']).length ? 'kk-KZ' : 'ru-RU'),
  date: (d) => new Date(d).toLocaleDateString(Fmt.loc(), { day: 'numeric', month: 'long', year: 'numeric' }),
  short: (d) => new Date(d).toLocaleDateString(Fmt.loc(), { day: 'numeric', month: 'short' }),
  time: (d) => new Date(d).toLocaleTimeString(Fmt.loc(), { hour: '2-digit', minute: '2-digit' }),
  dt(d) {
    const x = new Date(d), now = new Date();
    if (x.toDateString() === now.toDateString()) return Fmt.time(x);
    return Fmt.short(x) + ', ' + Fmt.time(x);
  },
  ago(d) {
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return t('только что');
    if (s < 3600) return t('{n} мин назад', { n: Math.floor(s / 60) });
    if (s < 86400) return t('{n} ч назад', { n: Math.floor(s / 3600) });
    if (s < 172800) return t('вчера');
    if (s < 30 * 86400) return t('{n} дн назад', { n: Math.floor(s / 86400) });
    return Fmt.date(d);
  },
  /* сколько осталось до момента: «2 ч 15 мин» */
  left(d) {
    let m = Math.max(0, Math.round((new Date(d) - Date.now()) / 60000));
    const days = Math.floor(m / 1440); m -= days * 1440;
    const h = Math.floor(m / 60); m -= h * 60;
    if (days) return h ? t('{d} д {h} ч', { d: days, h }) : t('{d} д', { d: days });
    if (h) return t('{h} ч {m} мин', { h, m });
    return t('{m} мин', { m });
  },
  /* сумма из поля ввода → целые тенге: «5 000», «5000,50», «1.500.000 ₸»; со знаком — только если signed; не сумма — null */
  amount(v, signed) {
    const s = String(v == null ? '' : v).replace(/[\s\u00a0'₸]/g, '').replace(/(тг|tg|kzt)$/i, '').replace('−', '-');
    const m = /^(-?)(\d+)(?:[.,]\d{1,2})?$/.exec(s) || /^(-?)(\d{1,3}(?:[.,]\d{3})+)$/.exec(s);
    if (!m || (m[1] && !signed)) return null;
    const n = parseInt(m[2].replace(/[.,]/g, ''), 10);
    return m[1] ? -n : n;
  },
  mins(m) {
    if (m <= 1) return t('сразу');
    if (m < 60) return t('{m} мин', { m });
    if (m < 1440) return t('{h} ч', { h: Math.round(m / 60) });
    return t('{d} д', { d: Math.round(m / 1440) });
  },
};

/* ---- запросы к базе: POST /rpc/sauda_*, ответ { ok, … } или { ok:false, error } */
const Api = (() => {
  let token = Store.get('sauda_token', '');
  const listeners = [];
  async function call(fn, args, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), ms || 15000);
    try {
      const r = await fetch(Cfg.api + fn, {
        method: 'POST',
        headers: { apikey: Cfg.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(args || {}),
        signal: ctl ? ctl.signal : undefined,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) return { ok: false, error: r.status === 404 ? 'not_deployed' : 'server' };
      if (j.ok === false && j.error === 'no_session' && token) {
        setToken('');
        listeners.forEach((f) => f('logout'));
      }
      return j;
    } catch (e) {
      return { ok: false, error: 'network' };
    } finally {
      clearTimeout(timer);
    }
  }
  const auth = (fn, args, ms) => (token ? call(fn, Object.assign({ p_token: token }, args || {}), ms) : Promise.resolve({ ok: false, error: 'no_session' }));
  function setToken(v) { token = v || ''; if (token) Store.set('sauda_token', token); else Store.del('sauda_token'); }
  return { call, auth, setToken, on: (f) => listeners.push(f), get token() { return token; } };
})();

/* понятные слова для кодов ошибок сервера */
const ERRORS = {
  network: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.',
  server: 'Сервер не ответил. Попробуйте через минуту.',
  not_deployed: 'Сервер маркетплейса ещё не подключён.',
  no_session: 'Войдите в аккаунт.',
  banned: 'Аккаунт заблокирован.',
  bad_login: 'Неверный логин или пароль.',
  bad_login_format: 'Логин: 3–24 символа, латиница, цифры, точка, дефис или _.',
  bad_password: 'Пароль: от 6 до 72 символов.',
  bad_password_old: 'Старый пароль неверный.',
  login_taken: 'Такой логин уже занят.',
  locked: 'Слишком много попыток. Вход закрыт на 15 минут.',
  bad_name: 'Имя: от 1 до 32 символов.',
  no_money: 'Недостаточно денег на балансе.',
  lot_unavailable: 'Лот больше не продаётся.',
  own_lot: 'Это ваш лот.',
  not_enough_stock: 'Столько нет в наличии.',
  need_buyer_data: 'Укажите данные для заказа (ID, почту или ник).',
  bad_qty: 'Неверное количество.',
  bad_status: 'С заказом уже что-то произошло — обновите страницу.',
  too_early: 'Отменить можно, когда выйдет срок выполнения.',
  need_reason: 'Опишите причину (хотя бы 5 символов).',
  forbidden: 'Нет прав на это действие.',
  not_found: 'Не найдено.',
  bad_input: 'Проверьте введённые данные.',
  bad_game: 'Выберите игру или сервис.',
  bad_section: 'Выберите раздел.',
  bad_title: 'Название: от 3 до 120 символов.',
  bad_price: 'Цена: от 10 до 10 000 000 ₸.',
  bad_image: 'Картинка не подошла — попробуйте другую.',
  too_long: 'Слишком длинный текст.',
  too_many_lots: 'Достигнут предел лотов. С Sauda Pro можно больше.',
  too_many_items: 'За раз можно добавить до 2000 товаров.',
  lot_blocked: 'Лот заблокирован модератором.',
  raise_wait: 'Поднять можно позже.',
  nothing_to_raise: 'В этом разделе нет активных лотов.',
  bad_amount: 'Неверная сумма.',
  payments_soon: 'Пополнение настоящими деньгами скоро откроется.',
  limit_day: 'Дневной предел пополнения — 2 000 000 ₸.',
  bad_card: 'Неверный номер карты.',
  bad_phone: 'Нужен казахстанский номер: +7 7XX XXX XX XX.',
  too_many_pending: 'Уже есть 3 заявки на вывод — дождитесь их.',
  too_many_topups: 'Уже есть 3 неоплаченные заявки на пополнение — оплатите или отмените их в кошельке.',
  name_reserved: 'Такое имя может спутать покупателей с поддержкой. Выберите другое.',
  dispute_limit: 'Спор по этому заказу открывали уже дважды. Напишите в поддержку.',
  price_changed: 'Цена изменилась — обновите страницу и проверьте новую цену.',
  live_locked: 'После запуска с настоящими деньгами тестовый режим включить нельзя.',
  pay_not_set: 'Сначала укажите реквизиты для пополнения: номер Kaspi, карту или ссылку оплаты.',
  bad_promo: 'Промокод не найден или закончился.',
  promo_used: 'Вы уже использовали этот промокод.',
  slow_down: 'Слишком часто. Подождите минуту.',
  self_chat: 'Нельзя написать самому себе.',
  empty: 'Пустое сообщение.',
  bad_code: 'Неверный код.',
  bad_action: 'Неизвестное действие.',
  bad_recovery: 'Неверный логин или код восстановления.',
  game_exists: 'Игра с таким кодом уже есть. Чтобы изменить её — нажмите «Изменить» в списке.',
  promo_exists: 'Такой промокод уже есть.',
  bad_game_id: 'Код игры: 2–24 символа, латинские строчные буквы, цифры и _.',
  section_in_use: 'В этом разделе есть лоты — его нельзя убрать.',
  game_in_use: 'В этой игре есть лоты или заказы — её нельзя удалить.',
};
/* адрес страницы сайта для ссылок наружу: в приложении Android и в sauda.html своего адреса в интернете нет */
const siteUrl = (hash) => {
  const own = /^https?:$/.test(location.protocol) && location.host !== 'appassets.androidplatform.net';
  return (own ? location.origin + location.pathname.replace(/index\.html$/, '') : (typeof Cfg !== 'undefined' && Cfg.site) || 'https://vcrfftrk9w-afk.github.io/-/market/') + (hash || '');
};
const errText = (e) => t(ERRORS[e] || 'Что-то пошло не так ({e}).', { e });

/* ---- окна, всплывашки, обработчики */
const UI = (() => {
  function toast(msg, kind) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind || 'ok');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, kind === 'err' ? 4500 : 2800);
  }
  const fail = (j) => toast(errText(j && j.error), 'err');

  /* обработчики по data-act (клик), data-submit (форма), data-input / data-change */
  function bind(root, h) {
    const find = (e, attr) => { const el = e.target.closest('[' + attr + ']'); return el && root.contains(el) ? el : null; };
    root.addEventListener('click', (e) => {
      const el = find(e, 'data-act');
      if (!el || !h[el.dataset.act]) return;
      if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
      h[el.dataset.act](el, e);
    });
    root.addEventListener('submit', (e) => {
      const el = find(e, 'data-submit');
      if (!el || !h[el.dataset.submit]) return;
      e.preventDefault();
      h[el.dataset.submit](el, new FormData(el), e);
    });
    ['input', 'change'].forEach((type) => root.addEventListener(type, (e) => {
      const el = find(e, 'data-' + type);
      if (el && h[el.dataset[type]]) h[el.dataset[type]](el, e);
    }));
  }

  let openModals = 0;
  function modal(opts) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = html`<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${opts.title || ''}">
      <div class="modal-head"><h3>${opts.title || ''}</h3><button class="icon-btn" data-act="close" aria-label="${t('Закрыть')}">✕</button></div>
      <div class="modal-body">${opts.body || ''}</div>
    </div>`.s;
    document.body.appendChild(wrap);
    openModals++;
    document.body.classList.add('no-scroll');
    let closed = false;
    const close = (v) => {
      if (closed) return;
      closed = true;
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 180);
      if (--openModals === 0) document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose(v);
    };
    // Esc закрывает только верхнее окно (подтверждение поверх окна — не оба сразу)
    const onKey = (e) => { if (e.key === 'Escape' && wrap === [...document.querySelectorAll('.modal-wrap:not(.out)')].pop()) close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    const handlers = Object.assign({ close: () => close() }, opts.on || {});
    bind(wrap, handlers);
    requestAnimationFrame(() => {
      wrap.classList.add('in');
      const f = wrap.querySelector('[autofocus], input:not([type=hidden]), textarea, select');
      if (f && window.innerWidth > 700) f.focus();
    });
    const m = { el: wrap, close, q: (s) => wrap.querySelector(s) };
    if (opts.mount) opts.mount(m);
    return m;
  }

  /* «точно?» — Promise<boolean> */
  function ask(text, opts) {
    opts = opts || {};
    return new Promise((res) => {
      const m = modal({
        title: opts.title || t('Подтвердите'),
        body: html`<p class="ask-text">${text}</p>
          <div class="modal-actions"><button class="btn ghost" data-act="no">${opts.no || t('Отмена')}</button>
          <button class="btn ${opts.danger ? 'danger' : 'primary'}" data-act="yes">${opts.yes || t('Да')}</button></div>`,
        on: { yes: () => { res(true); m.close(true); }, no: () => m.close() },
        onClose: (v) => { if (!v) res(false); },
      });
    });
  }

  /* окно с одним полем — Promise<string|null> */
  function prompt(title, opts) {
    opts = opts || {};
    return new Promise((res) => {
      const field = opts.multiline
        ? html`<textarea name="v" rows="4" maxlength="${opts.max || 1000}" placeholder="${opts.placeholder || ''}" required>${opts.value || ''}</textarea>`
        : html`<input name="v" maxlength="${opts.max || 200}" placeholder="${opts.placeholder || ''}" value="${opts.value || ''}" required>`;
      const m = modal({
        title,
        body: html`<form data-submit="go" class="stack">${opts.text ? html`<p class="muted">${opts.text}</p>` : ''}${field}
          <div class="modal-actions"><button type="button" class="btn ghost" data-act="close">${t('Отмена')}</button>
          <button class="btn ${opts.danger ? 'danger' : 'primary'}">${opts.yes || t('Готово')}</button></div></form>`,
        on: { go: (f, fd) => { const v = String(fd.get('v') || '').trim(); if (!v) return; res(v); m.close(true); } },
        onClose: (v) => { if (!v) res(null); },
      });
    });
  }

  /* кнопка «занята» на время запроса */
  async function busy(btn, fn) {
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('loading');
    try { return await fn(); } finally { btn.disabled = false; btn.classList.remove('loading'); }
  }

  function copy(text) {
    const done = () => toast(t('Скопировано'));
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast(t('Не удалось скопировать'), 'err'); }
      ta.remove();
    }
  }

  return { toast, fail, bind, modal, ask, prompt, busy, copy };
})();

/* куда вернуться после входа: только свой адрес #/… — чужая ссылка (javascript:, другой сайт) ведёт в профиль */
const safeNext = (v) => (typeof v === 'string' && /^#\/[^\s]*$/.test(v) ? v : '#/me');

/* ---- адреса страниц: #/lot/123?x=1 */
const Router = (() => {
  const routes = [];
  let cleanup = null;
  let seq = 0;
  function add(pattern, view, opts) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (m, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    routes.push({ re, keys, view, opts: opts || {} });
  }
  function parse() {
    let h = location.hash.slice(1);
    try { h = decodeURI(h); } catch (e) { /* «%» без кода в ссылке — оставляем как есть */ }
    h = h || '/';
    const i = h.indexOf('?');
    const path = i < 0 ? h : h.slice(0, i);
    const query = {};
    new URLSearchParams(i < 0 ? '' : h.slice(i + 1)).forEach((v, k) => { query[k] = v; });
    return { path: path || '/', query };
  }
  async function go() {
    const { path, query } = parse();
    let hit = null, params = {};
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) { hit = r; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; }
    }
    if (!hit) { location.replace('#/'); return; }
    if (cleanup) { try { cleanup(); } catch (e) { /* старый экран уже ушёл */ } cleanup = null; }
    const my = ++seq;
    // каждый экран — в чистом контейнере: обработчики прошлого экрана не должны срабатывать на новом
    const old = document.getElementById('view');
    const view = old.cloneNode(false);
    old.replaceWith(view);
    const ctx = { params, query, path, view, alive: () => my === seq, onLeave: (f) => { if (my === seq) cleanup = f; } };
    if (Router.before) {
      const stop = await Router.before(hit.opts, ctx);
      if (!ctx.alive()) return; // пока проверяли вход, человек ушёл на другую страницу
      if (stop) { if (Router.after) Router.after(ctx); return; }
    }
    if (!hit.opts.keepScroll) window.scrollTo(0, 0);
    try {
      await hit.view(view, ctx);
    } catch (e) {
      console.error(e);
      if (ctx.alive()) view.innerHTML = html`<div class="empty"><div class="empty-ico">⚠️</div><p>${t('Не удалось открыть страницу.')}</p><a class="btn" href="#/">${t('На главную')}</a></div>`.s;
    }
    if (Router.after) Router.after(ctx);
  }
  window.addEventListener('hashchange', go);
  return { add, go, parse, nav: (h) => { if (location.hash === h) go(); else location.hash = h; }, before: null, after: null };
})();

/* ---- картинки: сжать фото до нужного веса прямо в телефоне (data:image/webp или jpeg) */
const Img = {
  load(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); res(im); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
      im.src = url;
    });
  },
  async fit(file, side, maxLen, crop) {
    const im = await Img.load(file);
    let w = im.naturalWidth, h = im.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
    if (crop) { const s = Math.min(w, h); sx = (w - s) / 2; sy = (h - s) / 2; sw = sh = s; w = h = s; }
    for (let size = side; size >= 64; size = Math.round(size * 0.8)) {
      const k = Math.min(1, size / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
      for (let q = 0.85; q >= 0.45; q -= 0.1) {
        let d = c.toDataURL('image/webp', q);
        if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', q);
        if (d.length <= maxLen) return d;
      }
    }
    throw new Error('too_big');
  },
};
