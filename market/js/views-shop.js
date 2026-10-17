'use strict';
/* =========================================================
   VIEWS · ВИТРИНА — главная, каталог, раздел игры, поиск,
   страница лота с покупкой, профиль продавца.
   ========================================================= */

const Views = {};

const QUICK = [
  ['pubgm', 'donate', 'UC PUBG'], ['standoff2', 'currency', 'Голда Standoff'], ['freefire', 'donate', 'Алмазы Free Fire'],
  ['brawlstars', 'donate', 'Гемы Brawl Stars'], ['roblox', 'currency', 'Робуксы'], ['mlbb', 'donate', 'Алмазы MLBB'],
  ['telegram', 'subs', 'Telegram Premium'], ['telegram', 'currency', 'Звёзды Telegram'], ['spotify', 'subs', 'Spotify'],
  ['steam', 'topup', 'Пополнение Steam'],
];

const total = (g) => Object.values(g.counts || {}).reduce((a, b) => a + b, 0);

Views.home = async (view, ctx) => {
  const games = App.meta.games;
  const fee = App.cfg('fee_pct');
  view.innerHTML = html`
    <section class="hero">
      <div class="hero-text">
        <div class="hero-kicker">🇰🇿 ${t('Маркетплейс Казахстана')}</div>
        <h1>${t('Донат, игровые ценности и подписки —')} <span class="grad">${t('через гаранта')}</span></h1>
        <p class="hero-sub">${t('Продавец получает деньги только после того, как вы получили товар. Оплата в тенге, вывод на Kaspi, споры решает арбитраж.')}</p>
        <form class="hero-search" data-submit="search" role="search">
          <input name="q" type="search" placeholder="${t('Например: UC PUBG, голда Standoff 2, Spotify')}" aria-label="${t('Поиск')}" autocomplete="off">
          <button class="btn primary">${t('Найти')}</button>
        </form>
        <div class="quick">${QUICK.map(([g, s, label]) => html`<a class="chip" href="#/g/${g}/${s}">${C.game(g).emoji} ${t(label)}</a>`)}</div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="ha-card ha-1"><span>⚡</span><b>${t('Автовыдача')}</b><small>${t('код приходит сразу')}</small></div>
        <div class="ha-card ha-2"><span>🛡️</span><b>${t('Гарант')}</b><small>${t('деньги заморожены до получения')}</small></div>
        <div class="ha-card ha-3"><span>🏦</span><b>Kaspi</b><small>${t('вывод выручки')}</small></div>
        <div class="ha-ring"></div>
      </div>
    </section>

    <div class="kinds">${KINDS.map((k) => html`<a class="kind" href="#/catalog?kind=${k.id}"><span>${k.icon}</span>${t(k.ru)}</a>`)}</div>

    <section class="block">
      <div class="block-head"><h2>${t('Популярное')}</h2><a href="#/catalog" class="more">${t('Весь каталог')} →</a></div>
      <div class="game-grid">${games.filter((g) => g.popular).map((g) => C.gameTile(g, total(g)))}</div>
    </section>

    <section class="block"><div class="block-head"><h2>🔥 ${t('Хиты продаж')}</h2></div><div id="hot">${C.skeleton(8)}</div></section>

    <section class="block how">
      <h2>${t('Как работает сделка через гаранта')}</h2>
      <ol class="steps">
        <li><span>1</span><b>${t('Оплачиваете с баланса')}</b><p>${t('Пополнение через Kaspi, Halyk или карту. Деньги не уходят продавцу сразу.')}</p></li>
        <li><span>2</span><b>${t('Деньги заморожены')}</b><p>${t('Sauda держит сумму, пока заказ не выполнен.')}</p></li>
        <li><span>3</span><b>${t('Продавец выполняет')}</b><p>${t('Код, аккаунт или донат по ID — в заказе и в чате. С автовыдачей — сразу.')}</p></li>
        <li><span>4</span><b>${t('Вы подтверждаете')}</b><p>${t('Только тогда продавец получает деньги. Что-то не так — открываете спор.')}</p></li>
      </ol>
    </section>

    <section class="block"><div class="block-head"><h2>🆕 ${t('Новые предложения')}</h2></div><div id="fresh">${C.skeleton(4)}</div></section>

    <section class="block features">
      <div class="feat"><span>⚡</span><b>${t('Автовыдача 24/7')}</b><p>${t('Ключи и коды выдаются сами, даже ночью.')}</p></div>
      <div class="feat"><span>🔁</span><b>${t('Подписки с автопродлением')}</b><p>${t('Spotify, Telegram Premium, VPN — продлеваются сами с баланса.')}</p></div>
      <div class="feat"><span>⚖️</span><b>${t('Арбитраж споров')}</b><p>${t('Администратор разберётся и вернёт деньги, если товар не получен.')}</p></div>
      <div class="feat"><span>🇰🇿</span><b>${t('Тенге и қазақша')}</b><p>${t('Цены в ₸, интерфейс на русском и казахском.')}</p></div>
    </section>

    <section class="sell-cta">
      <div><h2>${t('Продавайте на Sauda')}</h2><p>${t('Комиссия {fee}% — только с успешной сделки. Автовыдача, поднятие лотов, вывод на Kaspi.', { fee })}</p></div>
      <div class="cta-btns"><a class="btn primary big" href="#/sell">${t('Выставить лот')}</a><a class="btn ghost big" href="#/pro">👑 Sauda Pro</a></div>
    </section>

    <section class="block" id="reviews-block" hidden><div class="block-head"><h2>⭐ ${t('Свежие отзывы')}</h2></div><div id="home-reviews" class="review-strip"></div></section>
    <div id="home-stats" class="home-stats"></div>`.s;
  UI.bind(view, { search: (f, fd) => Router.nav('#/search?q=' + encodeURIComponent(String(fd.get('q') || '').trim())) });

  const j = await Api.call('sauda_home');
  if (!ctx.alive()) return;
  if (!j.ok) { view.querySelector('#hot').innerHTML = C.empty('📡', errText(j.error)).s; view.querySelector('#fresh').innerHTML = ''; return; }
  view.querySelector('#hot').innerHTML = (C.lots(j.hot) || C.empty('🛒', t('Пока пусто — станьте первым продавцом!'), html`<a class="btn primary" href="#/sell">${t('Выставить лот')}</a>`)).s;
  view.querySelector('#fresh').innerHTML = (C.lots(j.fresh.slice(0, 8)) || '').s || '';
  if (j.reviews.length) {
    view.querySelector('#reviews-block').hidden = false;
    view.querySelector('#home-reviews').innerHTML = j.reviews.map((r) => C.review(r).s).join('');
  }
  const s = j.stats;
  view.querySelector('#home-stats').innerHTML = html`
    <div><b>${Fmt.num(s.lots)}</b><span>${tp(s.lots, 'предложение|предложения|предложений', true)}</span></div>
    <div><b>${Fmt.num(s.deals)}</b><span>${tp(s.deals, 'сделка|сделки|сделок', true)}</span></div>
    <div><b>${Fmt.num(s.users)}</b><span>${tp(s.users, 'пользователь|пользователя|пользователей', true)}</span></div>
    <div><b>${Fmt.num(s.online)}</b><span>${t('сейчас онлайн')}</span></div>`.s;
};

Views.catalog = async (view, ctx) => {
  const kind = ctx.query.kind || '';
  const render = (q) => {
    const ql = q.toLowerCase();
    const list = App.meta.games.filter((g) => (!kind || g.kind === kind) && (!ql || g.name.toLowerCase().includes(ql)));
    const groups = KINDS.filter((k) => !kind || k.id === kind).map((k) => ({ k, games: list.filter((g) => g.kind === k.id) })).filter((x) => x.games.length);
    view.querySelector('#cat-list').innerHTML = (groups.length ? html`${groups.map((x) => html`
      <section class="block"><h2>${x.k.icon} ${t(x.k.ru)}</h2>
        <div class="game-grid">${x.games.map((g) => C.gameTile(g, total(g)))}</div></section>`)}` : C.empty('🔍', t('Ничего не нашлось'))).s;
  };
  view.innerHTML = html`<div class="page-head"><h1>${t('Каталог')}</h1>
    <input class="search-inline" type="search" placeholder="${t('Найти игру или сервис')}" data-input="filter" aria-label="${t('Найти игру или сервис')}" autocomplete="off"></div>
    <div class="tabs scroll-x"><a class="tab ${!kind ? 'on' : ''}" href="#/catalog">${t('Все')}</a>${KINDS.map((k) => html`<a class="tab ${kind === k.id ? 'on' : ''}" href="#/catalog?kind=${k.id}">${k.icon} ${t(k.ru)}</a>`)}</div>
    <div id="cat-list"></div>`.s;
  UI.bind(view, { filter: (el) => render(el.value.trim()) });
  render('');
};

Views.game = async (view, ctx) => {
  const g = App.meta.byId[ctx.params.game];
  if (!g) { view.innerHTML = C.empty('🤷', t('Такой игры нет в каталоге'), html`<a class="btn" href="#/catalog">${t('Каталог')}</a>`).s; return; }
  const sec = ctx.params.section || (g.sections.find((s) => g.counts[s.id]) || g.sections[0]).id;
  const q = ctx.query;
  const mode = Store.get('sauda_view', window.innerWidth > 800 ? 'rows' : 'grid');
  const f = { game: g.id, section: sec, q: q.q || '', min: q.min || '', max: q.max || '', auto: q.auto === '1', online: q.online === '1', sort: q.sort || 'top', city: q.city || '' };
  const isGoods = g.kind === 'goods';
  const sorts = [['top', 'Сначала онлайн и Pro'], ['cheap', 'Сначала дешёвые'], ['expensive', 'Сначала дорогие'], ['rating', 'По рейтингу продавца'], ['popular', 'Популярные'], ['new', 'Новые']];
  view.innerHTML = html`
    <div class="game-hero" style="--c:${g.color}">
      <span class="gh-emoji" aria-hidden="true">${g.emoji}</span>
      <div><div class="crumbs"><a href="#/catalog?kind=${g.kind}">${kindName(g.kind)}</a></div><h1>${g.name}</h1>
        <div class="muted">${tp(total(g), 'предложение|предложения|предложений')}</div></div>
      <a class="btn primary gh-sell" href="#/sell?game=${g.id}&section=${sec}">+ ${t('Продать')}</a>
    </div>
    <div class="tabs scroll-x" role="tablist">${g.sections.map((s) => html`<a role="tab" class="tab ${s.id === sec ? 'on' : ''}" href="#/g/${g.id}/${s.id}">${I18n.lang === 'kz' ? s.kz : s.ru}<span class="cnt">${g.counts[s.id] || 0}</span></a>`)}</div>
    <form class="filters" data-submit="apply" data-change="apply">
      <input name="q" type="search" value="${f.q}" placeholder="${t('Поиск в разделе')}" aria-label="${t('Поиск в разделе')}">
      <div class="price-range"><input name="min" inputmode="numeric" value="${f.min}" placeholder="${t('Цена от')}" aria-label="${t('Цена от')}"><span>—</span><input name="max" inputmode="numeric" value="${f.max}" placeholder="${t('до')}" aria-label="${t('Цена до')}"></div>
      ${isGoods ? html`<select name="city" aria-label="${t('Город')}"><option value="">${t('Все города')}</option>${CITIES.map((c) => html`<option ${c === f.city ? 'selected' : ''}>${c}</option>`)}</select>` : ''}
      <label class="check"><input type="checkbox" name="auto" ${f.auto ? 'checked' : ''}> ⚡ ${t('Автовыдача')}</label>
      <label class="check"><input type="checkbox" name="online" ${f.online ? 'checked' : ''}> 🟢 ${t('Продавец онлайн')}</label>
      <select name="sort" aria-label="${t('Сортировка')}">${sorts.map(([v, l]) => html`<option value="${v}" ${f.sort === v ? 'selected' : ''}>${t(l)}</option>`)}</select>
      <div class="view-toggle" role="group" aria-label="${t('Вид списка')}">
        <button type="button" class="icon-btn ${mode === 'rows' ? 'on' : ''}" data-act="mode" data-mode="rows" aria-label="${t('Таблица')}">☰</button>
        <button type="button" class="icon-btn ${mode === 'grid' ? 'on' : ''}" data-act="mode" data-mode="grid" aria-label="${t('Карточки')}">▦</button>
      </div>
    </form>
    <div id="results">${C.skeleton(8, mode)}</div>
    <div class="center"><button class="btn ghost" id="more" hidden data-act="more">${t('Показать ещё')}</button></div>`.s;

  let offset = 0, items = [], seq = 0;
  async function load(reset) {
    const my = ++seq; // ответ на устаревший запрос (двойное «Показать ещё») не дописывает список
    if (reset) { offset = 0; items = []; }
    const j = await Api.call('sauda_lots', { p: Object.assign({}, f, { limit: 40, offset }) });
    if (!ctx.alive() || my !== seq) return;
    if (!j.ok) { view.querySelector('#results').innerHTML = C.empty('📡', errText(j.error)).s; return; }
    items = items.concat(j.items);
    offset = items.length;
    view.querySelector('#results').innerHTML = (C.lots(items, Store.get('sauda_view', mode)) || C.empty('🕊️', t('В этом разделе пока нет предложений'), html`<a class="btn primary" href="#/sell?game=${g.id}&section=${sec}">${t('Продать первым')}</a>`)).s;
    view.querySelector('#more').hidden = items.length >= j.total;
  }
  UI.bind(view, {
    apply: (form) => {
      const fd = new FormData(form);
      const p = new URLSearchParams();
      ['q', 'min', 'max', 'sort', 'city'].forEach((k) => { const v = String(fd.get(k) || '').trim(); if (v && !(k === 'sort' && v === 'top')) p.set(k, k === 'min' || k === 'max' ? String(Fmt.amount(v) || '') : v); });
      if (fd.get('auto')) p.set('auto', '1');
      if (fd.get('online')) p.set('online', '1');
      const qs = p.toString();
      history.replaceState(null, '', '#/g/' + g.id + '/' + sec + (qs ? '?' + qs : ''));
      Object.assign(f, { q: p.get('q') || '', min: p.get('min') || '', max: p.get('max') || '', sort: p.get('sort') || 'top', city: p.get('city') || '', auto: !!fd.get('auto'), online: !!fd.get('online') });
      load(true);
    },
    mode: (b) => {
      Store.set('sauda_view', b.dataset.mode);
      view.querySelectorAll('[data-act=mode]').forEach((x) => x.classList.toggle('on', x === b));
      view.querySelector('#results').innerHTML = (C.lots(items, b.dataset.mode) || C.empty('🕊️', t('В этом разделе пока нет предложений'))).s;
    },
    more: (b) => UI.busy(b, () => load(false)),
  });
  await load(true);
};

Views.search = async (view, ctx) => {
  const q = (ctx.query.q || '').trim();
  const ql = q.toLowerCase();
  const games = q ? App.meta.games.filter((g) => g.name.toLowerCase().includes(ql) || g.id.includes(ql)) : [];
  view.innerHTML = html`<div class="page-head"><h1>${q ? t('Поиск: «{q}»', { q }) : t('Поиск')}</h1></div>
    <form class="hero-search slim" data-submit="search" role="search"><input name="q" type="search" value="${q}" placeholder="${t('Что ищете?')}" aria-label="${t('Поиск')}" autofocus><button class="btn primary">${t('Найти')}</button></form>
    ${games.length ? html`<section class="block"><h2>${t('Игры и сервисы')}</h2><div class="game-grid">${games.map((g) => C.gameTile(g, total(g)))}</div></section>` : ''}
    <section class="block"><h2>${t('Предложения')}</h2><div id="res">${q ? C.skeleton(8) : C.empty('🔎', t('Введите, что ищете: игру, валюту, подписку или услугу'))}</div></section>`.s;
  UI.bind(view, { search: (f, fd) => Router.nav('#/search?q=' + encodeURIComponent(String(fd.get('q') || '').trim())) });
  if (!q) return;
  const j = await Api.call('sauda_lots', { p: { q, limit: 60 } });
  if (!ctx.alive()) return;
  view.querySelector('#res').innerHTML = (!j.ok ? C.empty('📡', errText(j.error)) : C.lots(j.items) || C.empty('🤷', t('Ничего не нашлось. Попробуйте другое слово.'))).s;
};

/* ───────────── лот ───────────── */
Views.lot = async (view, ctx) => {
  view.innerHTML = html`<div class="lot-page">${C.skeleton(2)}</div>`.s;
  const j = await Api.call('sauda_lot', { p_token: Api.token, p_id: +ctx.params.id });
  if (!ctx.alive()) return;
  if (!j.ok) { view.innerHTML = C.empty('🤷', errText(j.error), html`<a class="btn" href="#/">${t('На главную')}</a>`).s; return; }
  const l = j.lot, s = j.seller, g = C.game(l.game);
  const images = l.images && l.images.length ? l.images : (l.thumb ? [l.thumb] : []);
  const canBuy = l.status === 'active' && !j.mine;
  const maxQty = l.qty === null ? 9999 : l.qty;
  const d = C.discount(l);
  App.seen(l);

  view.innerHTML = html`
    <div class="crumbs"><a href="#/catalog?kind=${g.kind}">${kindName(g.kind)}</a> › <a href="#/g/${g.id}">${g.name}</a> › <a href="#/g/${g.id}/${l.section}">${C.section(l.game, l.section)}</a></div>
    <div class="lot-page">
      <div class="lot-main lot-top">
        <div class="gallery ${images.length ? '' : 'no-img'}" style="--c:${g.color}">
          ${images.length ? html`<img id="gal-main" src="${images[0]}" alt="${l.title}">` : html`<span class="cover-emoji big" aria-hidden="true">${g.emoji}</span><span class="cover-sec">${C.section(l.game, l.section)}</span>`}
          ${images.length > 1 ? html`<div class="thumbs">${images.map((im, i) => html`<button class="thumb ${i ? '' : 'on'}" data-act="pic" data-i="${i}" aria-label="${t('Фото {n}', { n: i + 1 })}"><img src="${im}" alt=""></button>`)}</div>` : ''}
        </div>
        <h1 class="lot-h1">${l.title}</h1>
        <div class="lot-tags">${C.lotTags(l)}${l.demo ? html`<span class="tag tag-demo">${t('Демо-лот: деньги тестовые')}</span>` : ''}${l.status !== 'active' ? html`<span class="tag tag-off">${t(LOT_STATUS[l.status])}</span>` : ''}</div>
        ${Object.keys(l.attrs || {}).length ? html`<dl class="attrs">${Object.entries(l.attrs).map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>` : ''}
        ${l.descr ? html`<div class="descr">${richText(l.descr)}</div>` : ''}
      </div>
      <div class="lot-main lot-bottom">
        <div class="lot-meta muted small">${t('Лот #{id}', { id: l.id })} · ${t('{n} просмотров', { n: Fmt.num(l.views) })} · ${t('продано {n}', { n: Fmt.num(l.sold) })} · ${t('обновлён {d}', { d: Fmt.ago(l.updated_at) })}
          ${!j.mine ? html` · <a href="#" data-act="report">🚩 ${t('Пожаловаться')}</a>` : ''}</div>

        <section class="block"><div class="block-head"><h2>${t('Отзывы о продавце')}</h2>${s.reviews ? html`<a class="more" href="#/u/${s.login}?tab=reviews">${t('Все {n}', { n: s.reviews })} →</a>` : ''}</div>
          ${j.reviews.length ? j.reviews.map(C.review) : html`<p class="muted">${t('Отзывов пока нет.')}</p>`}</section>
      </div>

      <aside class="lot-side">
        <div class="buy-card">
          <div class="buy-price"><b>${Fmt.money(l.price)}</b>${d ? html`<s>${Fmt.money(l.old_price)}</s><span class="cb cb-sale">−${d}%</span>` : ''}${l.period_days ? html`<span class="muted"> / ${tp(l.period_days, 'день|дня|дней')}</span>` : ''}</div>
          <div class="buy-facts">
            <div>${l.auto ? '⚡' : '⏱️'} ${l.auto ? t('Автовыдача — сразу после оплаты') : t('Выполнение: до {t}', { t: Fmt.mins(l.deliver_mins) })}</div>
            <div>📦 ${l.qty === null ? t('В наличии') : t('В наличии: {n} шт.', { n: Fmt.num(l.qty) })}</div>
            <div>🛡️ ${t('Гарант: деньги продавцу — после подтверждения')}</div>
          </div>
          ${canBuy ? html`<form class="stack" data-submit="buy">
              ${maxQty > 1 ? html`<label class="field"><span>${t('Количество')}</span><div class="qty"><button type="button" class="icon-btn" data-act="qminus" aria-label="−">−</button><input name="qty" type="number" min="1" max="${maxQty}" value="1" inputmode="numeric" data-input="recalc" aria-label="${t('Количество')}"><button type="button" class="icon-btn" data-act="qplus" aria-label="+">+</button></div></label>` : html`<input type="hidden" name="qty" value="1">`}
              ${l.needs_id ? html`<label class="field"><span>${l.id_label || t('Данные для заказа')}</span><input name="data" required maxlength="500" placeholder="${l.id_label || t('ID, почта или ник')}" autocomplete="off"></label>` : ''}
              ${l.period_days ? html`<label class="check"><input type="checkbox" name="renew" ${j.sub && j.sub.active ? 'checked' : ''}> 🔁 ${t('Продлевать автоматически каждые {d}', { d: tp(l.period_days, 'день|дня|дней') })}</label>` : ''}
              <button class="btn primary big wide" id="buy-btn">${t('Купить за {s}', { s: Fmt.money(l.price) })}</button>
            </form>` : ''}
          ${j.mine ? html`<div class="stack">
              <a class="btn primary wide" href="#/sell/${l.id}">✏️ ${t('Редактировать')}</a>
              ${l.status === 'active' ? html`<button class="btn wide" data-act="raise">⬆️ ${t('Поднять в списке')}</button><button class="btn ghost wide" data-act="pause">⏸ ${t('Снять с продажи')}</button>` : ''}
              ${l.status === 'paused' || l.status === 'sold' ? html`<button class="btn wide" data-act="activate">▶️ ${t('Включить')}</button>` : ''}
              ${l.auto ? html`<a class="btn ghost wide" href="#/sell/${l.id}?items=1">📦 ${t('Товары для автовыдачи')}</a>` : ''}
            </div>` : ''}
          ${!canBuy && !j.mine ? html`<div class="note">${t('Лот сейчас не продаётся.')}</div>` : ''}
          <div class="buy-actions">
            <button class="btn ghost ${j.fav ? 'on' : ''}" data-act="fav" aria-pressed="${j.fav ? 'true' : 'false'}">${j.fav ? '❤️' : '🤍'} ${t('В избранное')}</button>
            <button class="btn ghost" data-act="share">🔗 ${t('Поделиться')}</button>
          </div>
        </div>

        <div class="seller-card">
          <a class="sc-top" href="#/u/${s.login}">${C.avatar(s, 52)}<div><div class="sc-name">${s.name} ${C.badges(s)}</div>
            <div class="muted small">${s.online ? html`<span class="online-dot"></span> ${t('В сети')}` : t('Был(а) {t}', { t: Fmt.ago(s.last_seen) })}</div></div></a>
          <div class="sc-stats">
            <div><b>${s.reviews ? '★ ' + (+s.rating).toFixed(1) : '—'}</b><span>${tp(s.reviews, 'отзыв|отзыва|отзывов')}</span></div>
            <div><b>${Fmt.num(s.sales)}</b><span>${tp(s.sales, 'продажа|продажи|продаж', true)}</span></div>
            <div><b>${Fmt.short(s.since)}</b><span>${t('на Sauda с')}</span></div>
          </div>
          ${!j.mine ? html`<a class="btn wide" href="#/chat/${s.id}">💬 ${t('Написать продавцу')}</a>` : ''}
        </div>
      </aside>
    </div>
    ${j.similar.length ? html`<section class="block"><div class="block-head"><h2>${t('Похожие предложения')}</h2><a class="more" href="#/g/${g.id}/${l.section}">${t('Все')} →</a></div>${C.lots(j.similar)}</section>` : ''}`.s;

  const form = view.querySelector('[data-submit=buy]');
  const recalc = () => {
    if (!form) return;
    const n = Math.max(1, Math.min(maxQty, parseInt(form.qty.value, 10) || 1));
    view.querySelector('#buy-btn').textContent = t('Купить за {s}', { s: Fmt.money(l.price * n) });
  };
  const step = (k) => { form.qty.value = Math.max(1, Math.min(maxQty, (parseInt(form.qty.value, 10) || 1) + k)); recalc(); };
  let fav = j.fav;
  UI.bind(view, {
    pic: (b) => { view.querySelector('#gal-main').src = images[+b.dataset.i]; view.querySelectorAll('.thumb').forEach((x) => x.classList.toggle('on', x === b)); },
    qminus: () => step(-1), qplus: () => step(1), recalc,
    buy: async (f, fd) => {
      if (!Api.token) return App.needAuth();
      const qty = Math.max(1, Math.min(maxQty, parseInt(fd.get('qty'), 10) || 1));
      Buy.confirm(l, qty, String(fd.get('data') || '').trim(), !!fd.get('renew'));
    },
    fav: async (b) => {
      if (!Api.token) return App.needAuth();
      const r = await Api.auth('sauda_fav', { p_lot: l.id, p_on: !fav });
      if (!r.ok) return UI.fail(r);
      fav = !fav;
      b.innerHTML = html`${fav ? '❤️' : '🤍'} ${t('В избранное')}`.s;
      b.setAttribute('aria-pressed', fav ? 'true' : 'false');
      UI.toast(fav ? t('Добавлено в избранное') : t('Убрано из избранного'));
    },
    share: () => {
      const url = location.href;
      if (navigator.share) navigator.share({ title: l.title, url }).catch(() => {});
      else UI.copy(url);
    },
    report: async () => {
      if (!Api.token) return App.needAuth();
      const text = await UI.prompt(t('Жалоба на лот'), { multiline: true, placeholder: t('Что не так с этим лотом?'), yes: t('Отправить') });
      if (!text) return;
      const r = await Api.auth('sauda_report', { p_kind: 'lot', p_target: String(l.id), p_text: text });
      if (r.ok) UI.toast(t('Жалоба отправлена модераторам')); else UI.fail(r);
    },
    raise: (b) => UI.busy(b, async () => {
      const r = await Api.auth('sauda_raise', { p_game: l.game, p_section: l.section });
      if (r.ok) UI.toast(t('Подняли {n} лот(ов) в разделе', { n: r.raised }));
      else if (r.error === 'raise_wait') UI.toast(t('Поднять снова можно через {t}', { t: Fmt.left(r.next_at) }), 'info');
      else UI.fail(r);
    }),
    pause: (b) => UI.busy(b, async () => { const r = await Api.auth('sauda_lot_set', { p_id: l.id, p_status: 'paused' }); if (r.ok) Router.go(); else UI.fail(r); }),
    activate: (b) => UI.busy(b, async () => { const r = await Api.auth('sauda_lot_set', { p_id: l.id, p_status: 'active' }); if (r.ok) Router.go(); else UI.fail(r); }),
  });
};

/* покупка: подтверждение с итогом; если не хватает денег — пополнить прямо здесь */
const Buy = {
  confirm(l, qty, data, renew) {
    const sum = l.price * qty;
    const bal = App.me ? App.me.balance : 0;
    const lack = Math.max(0, sum - bal);
    const m = UI.modal({
      title: t('Покупка'),
      body: html`<div class="confirm-lot">${C.cover(l)}<div><b>${l.title}</b><div class="muted small">${C.game(l.game).name} · ${C.section(l.game, l.section)}</div></div></div>
        <dl class="sum-list">
          <div><dt>${t('Цена')}</dt><dd>${Fmt.money(l.price)} × ${qty}</dd></div>
          ${data ? html`<div><dt>${l.id_label || t('Данные')}</dt><dd>${data}</dd></div>` : ''}
          ${renew ? html`<div><dt>${t('Автопродление')}</dt><dd>${t('каждые {d}', { d: tp(l.period_days, 'день|дня|дней') })}</dd></div>` : ''}
          <div class="total"><dt>${t('Итого')}</dt><dd>${Fmt.money(sum)}</dd></div>
          <div><dt>${t('На балансе')}</dt><dd class="${lack ? 'minus' : ''}">${Fmt.money(bal)}</dd></div>
        </dl>
        <p class="muted small">🛡️ ${t('Деньги будут заморожены и уйдут продавцу только после того, как вы подтвердите получение.')}</p>
        ${lack ? html`<div class="note warn">${t('Не хватает {s}.', { s: Fmt.money(lack) })}</div>
          <div class="modal-actions"><button class="btn ghost" data-act="close">${t('Отмена')}</button><button class="btn primary" data-act="topup">💳 ${t('Пополнить на {s}', { s: Fmt.money(Math.max(lack, 100)) })}</button></div>`
        : html`<div class="modal-actions"><button class="btn ghost" data-act="close">${t('Отмена')}</button><button class="btn primary" data-act="pay">${t('Оплатить {s}', { s: Fmt.money(sum) })}</button></div>`}`,
      on: {
        topup: () => { m.close(); Wallet.topup(Math.max(lack, 100), () => Buy.confirm(l, qty, data, renew)); },
        pay: (b) => UI.busy(b, async () => {
          const r = await Api.auth('sauda_buy', { p_lot: l.id, p_qty: qty, p_data: data, p_renew: renew });
          if (!r.ok) return UI.fail(r);
          m.close(true);
          if (App.me) App.me.balance = r.balance;
          App.refresh();
          UI.toast(t('Оплачено! Заказ #{id}', { id: r.order }));
          Router.nav('#/order/' + r.order);
        }),
      },
    });
  },
};

/* ───────────── профиль продавца ───────────── */
Views.user = async (view, ctx) => {
  view.innerHTML = C.skeleton(4).s;
  const j = await Api.call('sauda_user', { p_token: Api.token, p_login: ctx.params.login });
  if (!ctx.alive()) return;
  if (!j.ok) { view.innerHTML = C.empty('🤷', errText(j.error)).s; return; }
  const u = j.user;
  const tab = ctx.query.tab === 'reviews' ? 'reviews' : 'lots';
  const groups = {};
  j.lots.forEach((l) => { const k = l.game + '/' + l.section; (groups[k] = groups[k] || []).push(l); });
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: j.stars[s] || 0 }));
  const maxN = Math.max(1, ...dist.map((x) => x.n));
  view.innerHTML = html`
    <div class="profile-head">
      ${C.avatar(u, 84)}
      <div class="ph-main"><h1>${u.name} ${C.badges(u)}</h1>
        <div class="muted">@${u.login}${u.city ? ' · 📍 ' + u.city : ''} · ${u.online ? html`<span class="online-dot"></span> ${t('В сети')}` : t('Был(а) {t}', { t: Fmt.ago(u.last_seen) })}</div>
        ${u.banned ? html`<div class="note warn">${t('Аккаунт заблокирован')}${u.ban_reason ? ': ' + u.ban_reason : ''}</div>` : ''}
        ${u.bio ? html`<p class="bio">${richText(u.bio)}</p>` : ''}
        <div class="ph-btns">${j.me ? html`<a class="btn" href="#/settings">✏️ ${t('Редактировать профиль')}</a>` : html`<a class="btn primary" href="#/chat/${u.id}">💬 ${t('Написать')}</a><button class="btn ghost" data-act="report">🚩</button>`}</div>
      </div>
      <div class="ph-rating">
        <div class="big-rating">${u.reviews ? (+u.rating).toFixed(1) : '—'}</div>${C.stars(u.rating, true)}
        <div class="muted small">${tp(u.reviews, 'отзыв|отзыва|отзывов')}</div>
        <div class="dist">${dist.map((x) => html`<div><span>${x.s}★</span><i style="--w:${(x.n / maxN) * 100}%"></i><span>${x.n}</span></div>`)}</div>
      </div>
    </div>
    <div class="stat-row">
      <div><b>${Fmt.num(u.sales)}</b><span>${tp(u.sales, 'продажа|продажи|продаж', true)}</span></div>
      <div><b>${Fmt.num(u.purchases)}</b><span>${tp(u.purchases, 'покупка|покупки|покупок', true)}</span></div>
      <div><b>${Fmt.num(j.lots.length)}</b><span>${tp(j.lots.length, 'лот|лота|лотов', true)}</span></div>
      <div><b>${Fmt.date(u.since)}</b><span>${t('на Sauda с')}</span></div>
    </div>
    <div class="tabs"><a class="tab ${tab === 'lots' ? 'on' : ''}" href="#/u/${u.login}">${t('Лоты')}<span class="cnt">${j.lots.length}</span></a><a class="tab ${tab === 'reviews' ? 'on' : ''}" href="#/u/${u.login}?tab=reviews">${t('Отзывы')}<span class="cnt">${u.reviews}</span></a></div>
    <div id="utab">${tab === 'lots'
      ? (j.lots.length ? Object.keys(groups).map((k) => { const [gid, sid] = k.split('/'); const g = C.game(gid); return html`<section class="block"><h3><a href="#/g/${gid}/${sid}">${g.emoji} ${g.name} · ${C.section(gid, sid)}</a></h3>${C.lots(groups[k], window.innerWidth > 800 ? 'rows' : 'grid')}</section>`; }) : C.empty('🕊️', t('Активных лотов нет')))
      : html`<div id="rev-list">${j.reviews.length ? j.reviews.map(C.review) : html`<p class="muted">${t('Отзывов пока нет.')}</p>`}</div>${u.reviews > j.reviews.length ? html`<div class="center"><button class="btn ghost" data-act="more">${t('Показать ещё')}</button></div>` : ''}`}</div>`.s;
  let offset = j.reviews.length;
  UI.bind(view, {
    more: (b) => UI.busy(b, async () => {
      const r = await Api.call('sauda_reviews', { p_login: u.login, p_offset: offset });
      if (!r.ok) return UI.fail(r);
      offset += r.items.length;
      view.querySelector('#rev-list').insertAdjacentHTML('beforeend', r.items.map((x) => C.review(x).s).join(''));
      if (offset >= u.reviews || !r.items.length) b.remove();
    }),
    report: async () => {
      if (!Api.token) return App.needAuth();
      const text = await UI.prompt(t('Жалоба на пользователя'), { multiline: true, placeholder: t('Что случилось?'), yes: t('Отправить') });
      if (!text) return;
      const r = await Api.auth('sauda_report', { p_kind: 'user', p_target: u.login, p_text: text });
      if (r.ok) UI.toast(t('Жалоба отправлена модераторам')); else UI.fail(r);
    },
  });
};
