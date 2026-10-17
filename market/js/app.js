'use strict';
/* =========================================================
   APP — оболочка Sauda: шапка и нижнее меню, кто вошёл, каталог игр,
   счётчики (сообщения, уведомления, баланс), тема и язык,
   уведомления браузера, адреса страниц.
   ========================================================= */

const App = (() => {
  const app = { me: null, meta: null, counters: {} };
  let started = false;
  let lastNotifs = null, lastUnread = null;

  /* знак Sauda: буква S на бирюзовом, золотое солнце — как на флаге Казахстана */
  const logo = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14d3ee"/><stop offset="1" stop-color="#0a6cd6"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#lg${s})"/><path d="M42.5 22.5c-2.2-3.4-6-5.5-10.7-5.5-6.2 0-10.8 3.6-10.8 8.6 0 11.4 22.5 6.6 22.5 17.6 0 5-4.8 8.8-11.4 8.8-5 0-9.2-2.2-11.6-6" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/><circle cx="49.5" cy="14.5" r="5" fill="#ffc93c"/></svg>`;
  const SV = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const ICO = {
    chat: raw(`<svg ${SV}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/></svg>`),
    bell: raw(`<svg ${SV}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>`),
    orders: raw(`<svg ${SV}><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>`),
  };

  /* ---- каталог игр и настройки сервиса: из кэша сразу, свежие — фоном */
  function setMeta(m) {
    m.byId = {};
    m.games.forEach((g) => {
      const ru = g.name; // «Мир танков», «Нейросети»… — по-казахски из словаря, бренды как есть
      Object.defineProperty(g, 'name', { get: () => t(ru), enumerable: true, configurable: true });
      m.byId[g.id] = g;
    });
    app.meta = m;
  }
  async function loadMeta(force) {
    const cached = Store.get('sauda_meta', null);
    if (cached && !app.meta) setMeta(cached);
    if (cached && !force && Date.now() - (cached.at || 0) < 60000) return;
    const j = await Api.call('sauda_meta');
    if (j.ok) { const m = { games: j.games, config: j.config, at: Date.now() }; Store.set('sauda_meta', m); setMeta(m); }
    else if (!app.meta) throw new Error(j.error);
  }

  /* ---- кто вошёл и счётчики */
  let refreshing = null, rerender = false;
  async function refresh(force) {
    if (refreshing && !force) return refreshing;
    refreshing = (async () => {
      if (!Api.token) { app.me = null; app.counters = {}; header(); return; }
      const j = await Api.auth('sauda_me');
      if (j.ok) {
        app.me = j.user;
        app.counters = { unread: j.unread, notifs: j.notifs, active_buy: j.active_buy, active_sell: j.active_sell };
        // сервис запустили с настоящими деньгами, пока страница была открыта, — свежие настройки и реквизиты
        if (app.meta && app.meta.config.test_mode !== j.test_mode) { await loadMeta(true).catch(() => {}); app.meta.config.test_mode = j.test_mode; if (started) rerender = true; }
        if (j.user.lang && j.user.lang !== I18n.lang && !Store.get('sauda_lang', null)) { I18n.set(j.user.lang, false); rerender = true; }
        ping(j);
      } else if (j.error === 'no_session' || j.error === 'banned') {
        app.me = null; app.counters = {};
        if (j.error === 'banned') { Api.setToken(''); UI.toast(errText('banned'), 'err'); }
      }
      header();
      if (rerender && started) { rerender = false; Router.go(); }
    })();
    try { await refreshing; } finally { refreshing = null; }
  }

  /* уведомление браузера, когда приходит новое сообщение или событие, а вкладка не на виду */
  function ping(j) {
    const n = (j.unread || 0) + (j.notifs || 0);
    const before = (lastUnread || 0) + (lastNotifs || 0);
    if (lastUnread !== null && n > before && document.hidden && notifyOn() && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Sauda', { body: j.unread > lastUnread ? t('Новое сообщение') : t('Новое уведомление'), icon: 'icons/icon-192.png', tag: 'sauda' }); } catch (e) { /* телефон не дал */ }
    }
    lastUnread = j.unread || 0; lastNotifs = j.notifs || 0;
    document.title = (n ? '(' + n + ') ' : '') + 'Sauda';
  }
  const notifyOn = () => Store.get('sauda_notify', false);
  async function setNotify(on) {
    if (on && 'Notification' in window && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission().catch(() => 'denied');
      if (p !== 'granted') { UI.toast(t('Браузер не разрешил уведомления'), 'err'); on = false; }
    }
    Store.set('sauda_notify', on);
    return on;
  }

  /* ---- шапка и нижнее меню */
  function header() {
    const me = app.me, n = app.counters;
    const badge = (x) => (x ? html`<span class="badge">${x > 99 ? '99+' : x}</span>` : '');
    document.getElementById('top-right').innerHTML = html`
      <button class="icon-btn hide-m" data-act="lang" aria-label="${t('Язык')}">${I18n.lang === 'kz' ? 'ҚАЗ' : 'РУС'}</button>
      ${me ? html`
        <a class="icon-btn hide-m" href="#/chats" aria-label="${t('Сообщения')}">${ICO.chat}${badge(n.unread)}</a>
        <a class="icon-btn" href="#/notifs" aria-label="${t('Уведомления')}">${ICO.bell}${badge(n.notifs)}</a>
        <a class="icon-btn hide-m" href="#/orders" aria-label="${t('Заказы')}">${ICO.orders}${badge(n.active_buy + n.active_sell)}</a>
        <a class="balance-pill" href="#/wallet" aria-label="${t('Баланс')}">${Fmt.money(me.balance)}</a>
        <a class="me-btn hide-m" href="#/me" aria-label="${t('Профиль')}">${C.avatar(me, 34)}</a>`
      : html`<a class="btn primary" href="#/login">${t('Войти')}</a>`}`.s;
    document.getElementById('tab-chats-b').innerHTML = html`${badge(n.unread)}`.s;
    document.getElementById('tab-me-b').innerHTML = html`${badge((n.notifs || 0) + (n.active_sell || 0))}`.s;
    const bar = document.getElementById('testbar');
    bar.hidden = !(app.meta && app.meta.config.test_mode);
    bar.innerHTML = html`🧪 ${t('Тестовый режим: деньги ненастоящие, можно пробовать покупки и продажи.')} <a href="#/help?s=test">${t('Подробнее')}</a>`.s;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    const s = document.querySelector('#top-search input');
    if (s) s.placeholder = t('Игра, валюта, подписка…');
  }

  function activeTab() {
    const p = Router.parse().path;
    const map = [['/catalog', 'catalog'], ['/g/', 'catalog'], ['/lot/', 'catalog'], ['/sell', 'sell'], ['/my-lots', 'sell'], ['/chat', 'chats'],
      ['/me', 'me'], ['/wallet', 'me'], ['/orders', 'me'], ['/order/', 'me'], ['/settings', 'me'], ['/notifs', 'me'], ['/favs', 'me'], ['/subs', 'me']];
    const hit = map.find(([k]) => p.startsWith(k));
    const tab = p === '/' ? 'home' : hit ? hit[1] : '';
    document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    document.querySelectorAll('.top-nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  }

  /* ---- тема и язык */
  const theme = () => document.documentElement.dataset.theme || 'dark';
  function setTheme(v) {
    document.documentElement.dataset.theme = v;
    Store.set('sauda_theme', v);
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = v === 'light' ? '#f4f7fb' : '#0b1220';
  }
  function setLang(l, quiet) {
    I18n.set(l);
    header();
    if (!quiet && Api.token) Api.auth('sauda_profile_save', { p: { lang: I18n.lang } });
    Router.go();
  }

  function needAuth() {
    location.hash = '#/login?next=' + encodeURIComponent(location.hash || '#/');
  }
  async function logout() {
    await Api.auth('sauda_logout');
    Api.setToken('');
    app.me = null; app.counters = {};
    header();
    location.hash = '#/';
  }

  /* недавно просмотренные лоты — для быстрого возврата */
  function seen(l) {
    const list = Store.get('sauda_seen', []).filter((x) => x.id !== l.id);
    list.unshift({ id: l.id, game: l.game, section: l.section, title: l.title, price: l.price, thumb: '', seller: { name: l.seller.name, login: l.seller.login, reviews: l.seller.reviews, rating: l.seller.rating } });
    Store.set('sauda_seen', list.slice(0, 12));
  }

  /* ---- адреса */
  function routes() {
    const R = Router.add;
    R('/', Views.home);
    R('/catalog', Views.catalog);
    R('/g/:game', Views.game);
    R('/g/:game/:section', Views.game);
    R('/search', Views.search);
    R('/lot/:id', Views.lot);
    R('/u/:login', Views.user);
    R('/login', Views.auth, { guest: true });
    R('/help', Views.help);
    R('/pro', Views.pro);
    R('/sell', Views.sell, { auth: true });
    R('/sell/:id', Views.sell, { auth: true });
    R('/my-lots', Views.myLots, { auth: true });
    R('/orders', Views.orders, { auth: true });
    R('/order/:id', Views.order, { auth: true });
    R('/chats', Views.chats, { auth: true });
    R('/chat/:uid', Views.chat, { auth: true, keepScroll: true });
    R('/support', Views.support, { auth: true });
    R('/wallet', Views.wallet, { auth: true });
    R('/me', Views.me, { auth: true });
    R('/settings', Views.settings, { auth: true });
    R('/favs', Views.favs, { auth: true });
    R('/notifs', Views.notifs, { auth: true });
    R('/subs', Views.subs, { auth: true });
    R('/ref', Views.ref, { auth: true });
    R('/stats', Views.stats, { auth: true });
    R('/admin', Views.admin, { auth: true, staff: true });
    R('/admin/:tab', Views.admin, { auth: true, staff: true });
    R('/admin/support/:uid', (v, c) => { c.params.tab = 'support'; return Views.admin(v, c); }, { auth: true, staff: true });
    Router.before = async (opts, ctx) => {
      const view = ctx.view;
      if (opts.auth && !Api.token) {
        ctx.next = location.hash;
        await Views.auth(view, ctx);
        return true;
      }
      if (opts.auth && !app.me) await refresh();
      if (opts.staff && !isStaff()) { view.innerHTML = C.empty('🔒', t('Нет доступа')).s; return true; }
      if (opts.guest && Api.token && app.me) { location.replace(safeNext(ctx.query.next)); return true; }
      return false;
    };
    Router.after = () => activeTab();
  }
  const isStaff = () => !!(app.me && (app.me.role === 'admin' || app.me.role === 'moder'));

  async function boot() {
    setTheme(Store.get('sauda_theme', window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
    I18n.set(I18n.lang, false);
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref) { Store.set('sauda_ref', ref.slice(0, 16)); history.replaceState(null, '', location.pathname + location.hash); }
    document.getElementById('logo').innerHTML = logo(34) + '<b>Sauda</b>';
    UI.bind(document.querySelector('.top'), {
      lang: () => setLang(I18n.lang === 'kz' ? 'ru' : 'kz'),
      search: (f, fd) => { const q = String(fd.get('q') || '').trim(); if (q) { Router.nav('#/search?q=' + encodeURIComponent(q)); f.reset(); } },
    });
    routes();
    try {
      await loadMeta();
    } catch (e) {
      document.getElementById('view').innerHTML = C.empty('📡', errText(e.message === 'not_deployed' ? 'not_deployed' : 'network'), html`<button class="btn primary" onclick="location.reload()">${t('Обновить')}</button>`).s;
      return;
    }
    header();
    await refresh();
    started = true;
    rerender = false;
    Router.go();
    loadMeta();
    Api.on(() => { app.me = null; header(); });
    // со включёнными уведомлениями проверяем и в фоне — иначе уведомление браузера некому показать
    setInterval(() => { if (!document.hidden || notifyOn()) refresh(); }, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && !Cfg.local) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  return {
    boot, refresh, loadMeta, needAuth, logout, seen, logo, isStaff, theme, setTheme, setLang, notifyOn, setNotify,
    cfg: (k) => (app.meta ? app.meta.config[k] : undefined),
    testMode: () => !!(app.meta && app.meta.config.test_mode),
    get me() { return app.me; },
    get meta() { return app.meta; },
    get counters() { return app.counters; },
  };
})();

document.addEventListener('DOMContentLoaded', App.boot);
