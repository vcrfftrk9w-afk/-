'use strict';
/* =========================================================
   COMPONENTS — общие куски экранов: аватар, звёзды, карточка лота,
   строки заказов и отзывов, тексты системных сообщений и уведомлений.
   ========================================================= */

const KINDS = [
  { id: 'mobile', icon: '📱', ru: 'Мобильные игры' },
  { id: 'pc', icon: '🖥️', ru: 'Игры на ПК и консолях' },
  { id: 'subs', icon: '🔁', ru: 'Подписки и сервисы' },
  { id: 'social', icon: '💬', ru: 'Соцсети' },
  { id: 'service', icon: '🛠️', ru: 'Услуги' },
  { id: 'goods', icon: '📦', ru: 'Вещи' },
];
const kindName = (id) => { const k = KINDS.find((x) => x.id === id); return k ? t(k.ru) : id; };

const CITIES = ['Алматы', 'Астана', 'Шымкент', 'Караганда', 'Актобе', 'Тараз', 'Павлодар', 'Усть-Каменогорск', 'Семей', 'Атырау',
  'Костанай', 'Кызылорда', 'Уральск', 'Петропавловск', 'Актау', 'Туркестан', 'Кокшетау', 'Талдыкорган', 'Экибастуз', 'Жезказган'];

const STATUS = {
  paid: { ru: 'Оплачен', cls: 'warn', hint: 'Ждёт продавца' },
  delivered: { ru: 'Выполнен', cls: 'info', hint: 'Ждёт подтверждения' },
  completed: { ru: 'Завершён', cls: 'ok', hint: 'Сделка закрыта' },
  refunded: { ru: 'Возврат', cls: 'muted', hint: 'Деньги вернулись покупателю' },
  dispute: { ru: 'Спор', cls: 'danger', hint: 'Разбирается администратор' },
};
const LOT_STATUS = { active: 'Активен', paused: 'На паузе', sold: 'Нет в наличии', deleted: 'Удалён', blocked: 'Заблокирован' };

const TX = {
  topup: ['Пополнение', '💳'], purchase: ['Покупка', '🛒'], sale: ['Продажа', '💰'], refund: ['Возврат', '↩️'],
  withdraw: ['Вывод', '🏦'], withdraw_back: ['Вывод отклонён — возврат', '↩️'], withdraw_fee: ['Комиссия за вывод', '🏦'],
  promo: ['Промокод', '🎁'], promo_out: ['Промокод (расход)', '🎁'], pro: ['Sauda Pro', '👑'], pro_in: ['Оплата Pro', '👑'],
  referral: ['Реферальный бонус', '🤝'], referral_out: ['Реферальный бонус (расход)', '🤝'], fee: ['Комиссия сервиса', '🧾'],
  admin: ['Корректировка администратором', '🛡️'], admin_out: ['Корректировка (расход)', '🛡️'],
};
const PAY_METHODS = { kaspi: ['Kaspi.kz', '🔴'], halyk: ['Halyk Bank', '🟢'], card: ['Visa / Mastercard', '💳'], freedom: ['Freedom Pay', '🟣'], apple: ['Apple Pay', ''], google: ['Google Pay', '🅖'] };
const OUT_METHODS = { kaspi: ['Kaspi Gold', '🔴', 'phone'], halyk: ['Halyk (по номеру)', '🟢', 'phone'], freedom: ['Freedom (по номеру)', '🟣', 'phone'], card: ['Банковская карта', '💳', 'card'] };

const C = {
  game: (id) => (App.meta && App.meta.byId[id]) || { id, name: id, emoji: '🎮', color: '#00afca', sections: [], counts: {} },
  section(gameId, secId) {
    const s = C.game(gameId).sections.find((x) => x.id === secId);
    return s ? (I18n.lang === 'kz' ? s.kz : s.ru) : secId;
  },

  avatar(u, size) {
    size = size || 36;
    const name = (u && (u.name || u.login)) || '?';
    if (u && u.avatar) return html`<img class="ava" src="${u.avatar}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px" loading="lazy">`;
    let h = 0;
    for (const ch of (u && u.login) || name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const letter = Array.from(name.trim())[0] || '?';
    return html`<span class="ava ava-letter" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px;--h:${h % 360}">${letter.toUpperCase()}</span>`;
  },

  badges(u) {
    if (!u) return '';
    return html`${u.verified ? html`<span class="vbadge" title="${t('Проверенный продавец')}">✔</span>` : ''}${u.pro ? html`<span class="pro-badge">PRO</span>` : ''}${u.staff ? html`<span class="staff-badge">${t('Sauda')}</span>` : ''}${u.demo ? html`<span class="demo-badge">${t('демо')}</span>` : ''}`;
  },

  stars(r, big) {
    const pct = Math.max(0, Math.min(100, (r / 5) * 100));
    return html`<span class="stars ${big ? 'big' : ''}" role="img" aria-label="${t('Рейтинг {r} из 5', { r: (+r).toFixed(1) })}"><span class="stars-fill" style="width:${pct}%">★★★★★</span>★★★★★</span>`;
  },

  rating(u) {
    if (!u || !u.reviews) return html`<span class="muted small">${t('Новый продавец')}</span>`;
    return html`<span class="rating"><b>★ ${(+u.rating).toFixed(1)}</b> <span class="muted">(${Fmt.num(u.reviews)})</span></span>`;
  },

  online(u) {
    if (!u) return '';
    return u.online ? html`<span class="online-dot" title="${t('В сети')}"></span>` : '';
  },

  /* компактно для карточки: аватар, имя, Pro, онлайн, звезда */
  sellerMini(u) {
    return html`<span class="seller-line">${C.avatar(u, 20)}<span class="seller-name">${u.name}</span>${u.verified ? html`<span class="vbadge" title="${t('Проверенный продавец')}">✔</span>` : ''}${u.pro ? html`<span class="pro-badge">PRO</span>` : ''}${C.online(u)}${u.reviews ? html`<span class="rating mini"><b>★ ${(+u.rating).toFixed(1)}</b> <span class="muted">(${Fmt.num(u.reviews)})</span></span>` : ''}</span>`;
  },

  sellerLine(u) {
    return html`<span class="seller-line">${C.avatar(u, 22)}<span class="seller-name">${u.name}</span>${C.badges(u)}${C.online(u)}<span class="dot-sep"></span>${C.rating(u)}</span>`;
  },

  cover(l, g) {
    g = g || C.game(l.game);
    if (l.thumb) return html`<img class="cover-img" src="${l.thumb}" alt="" loading="lazy">`;
    return html`<span class="cover-emoji" aria-hidden="true">${g.emoji}</span><span class="cover-sec">${C.section(l.game, l.section)}</span>`;
  },

  lotTags(l) {
    const out = [];
    if (l.auto) out.push(html`<span class="tag tag-auto">⚡ ${t('Автовыдача')}</span>`);
    if (l.period_days) out.push(html`<span class="tag tag-sub">🔁 ${t('Подписка')} · ${tp(l.period_days, 'день|дня|дней')}</span>`);
    if (l.needs_id && !l.auto) out.push(html`<span class="tag">🆔 ${t('По ID')}</span>`);
    if (l.city) out.push(html`<span class="tag">📍 ${l.city}</span>`);
    return out;
  },

  discount(l) {
    return l.old_price && l.old_price > l.price ? Math.round((1 - l.price / l.old_price) * 100) : 0;
  },

  lotCard(l) {
    const g = C.game(l.game);
    const d = C.discount(l);
    return html`<a class="lot-card" href="#/lot/${l.id}">
      <div class="lot-cover" style="--c:${g.color}">${C.cover(l, g)}
        <div class="cover-badges">${l.auto ? html`<span class="cb cb-auto" title="${t('Автовыдача')}">⚡</span>` : ''}${l.period_days ? html`<span class="cb cb-sub" title="${t('Подписка')}">🔁</span>` : ''}${d ? html`<span class="cb cb-sale">−${d}%</span>` : ''}${l.demo ? html`<span class="cb cb-demo">${t('демо')}</span>` : ''}</div>
      </div>
      <div class="lot-body">
        <div class="lot-game">${g.emoji} ${g.name} · ${C.section(l.game, l.section)}</div>
        <div class="lot-title">${l.title}</div>
        <div class="lot-price"><b>${Fmt.money(l.price)}</b>${d ? html`<s>${Fmt.money(l.old_price)}</s>` : ''}${l.status && l.status !== 'active' ? html`<span class="tag tag-off">${t(LOT_STATUS[l.status] || l.status)}</span>` : ''}</div>
        <div class="lot-seller">${C.sellerMini(l.seller)}</div>
      </div>
    </a>`;
  },

  lotRow(l) {
    const d = C.discount(l);
    const attrs = Object.entries(l.attrs || {}).slice(0, 3).map(([k, v]) => html`<span class="tag">${k}: ${v}</span>`);
    return html`<a class="lot-row" href="#/lot/${l.id}">
      <div class="lr-main"><div class="lr-title">${l.title}</div><div class="lr-tags">${C.lotTags(l)}${attrs}${l.demo ? html`<span class="tag tag-demo">${t('демо')}</span>` : ''}</div></div>
      <div class="lr-seller">${C.sellerMini(l.seller)}</div>
      <div class="lr-qty">${l.qty === null || l.qty === undefined ? '∞' : Fmt.num(l.qty)}</div>
      <div class="lr-price"><b>${Fmt.money(l.price)}</b>${d ? html`<s>${Fmt.money(l.old_price)}</s>` : ''}</div>
    </a>`;
  },

  lots(list, mode) {
    if (!list.length) return '';
    if (mode === 'rows') {
      return html`<div class="lot-table"><div class="lot-row lot-head" aria-hidden="true"><div>${t('Описание')}</div><div>${t('Продавец')}</div><div>${t('Наличие')}</div><div>${t('Цена')}</div></div>${list.map(C.lotRow)}</div>`;
    }
    return html`<div class="lot-grid">${list.map(C.lotCard)}</div>`;
  },

  gameTile(g, n) {
    return html`<a class="game-tile" href="#/g/${g.id}" style="--c:${g.color}"><span class="gt-emoji" aria-hidden="true">${g.emoji}</span><span class="gt-name">${g.name}</span>${n !== undefined ? html`<span class="gt-count">${Fmt.num(n)}</span>` : ''}</a>`;
  },

  status(s) {
    const x = STATUS[s] || { ru: s, cls: 'muted' };
    return html`<span class="status status-${x.cls}">${t(x.ru)}</span>`;
  },

  orderRow(o) {
    const g = C.game(o.game);
    const other = o.role === 'buyer' ? o.seller : o.buyer;
    return html`<a class="order-row" href="#/order/${o.id}">
      <span class="or-ico" style="--c:${g.color}">${g.emoji}</span>
      <span class="or-main"><span class="or-title">${o.title}${o.qty > 1 ? html` <span class="muted">× ${o.qty}</span>` : ''}</span>
        <span class="or-sub muted">#${o.id} · ${Fmt.dt(o.created_at)} · ${o.role === 'buyer' ? t('продавец') : t('покупатель')} ${other ? other.name : ''}</span></span>
      <span class="or-side"><b class="${o.role === 'seller' && o.status === 'completed' ? 'plus' : ''}">${Fmt.money(o.amount)}</b>${C.status(o.status)}</span>
    </a>`;
  },

  review(r) {
    return html`<div class="review">
      <div class="review-head">${C.avatar(r.buyer, 32)}<div><b>${r.buyer ? r.buyer.name : ''}</b> ${C.stars(r.stars)}
        <div class="muted small">${C.game(r.game).emoji} ${C.game(r.game).name}${r.title ? ' · ' + r.title : ''} · ${Fmt.ago(r.created_at)}</div></div></div>
      ${r.text ? html`<p class="review-text">${r.text}</p>` : ''}
      ${r.reply ? html`<div class="review-reply"><b>${t('Ответ продавца')}:</b> ${r.reply}</div>` : ''}
    </div>`;
  },

  empty(icon, text, action) {
    return html`<div class="empty"><div class="empty-ico" aria-hidden="true">${icon}</div><p>${text}</p>${action || ''}</div>`;
  },

  skeleton(n, kind) {
    return html`<div class="${kind === 'rows' ? 'skel-rows' : 'lot-grid'}">${Array.from({ length: n || 8 }, () => html`<div class="skel ${kind === 'rows' ? 'skel-row' : 'skel-card'}"></div>`)}</div>`;
  },

  /* системное сообщение в чате: тело — JSON { k, … }; текст собираем на языке читающего */
  sysText(body, me) {
    let d;
    try { d = JSON.parse(body); } catch (e) { return body; }
    const n = { id: d.id, title: d.title, qty: d.qty, amount: d.amount !== undefined ? Fmt.money(d.amount) : '', net: d.net !== undefined ? Fmt.money(d.net) : '', reason: d.reason, note: d.note };
    switch (d.k) {
      case 'welcome': return t('Добро пожаловать в Sauda! Это чат поддержки — пишите сюда, если со сделкой что-то не так. Деньги продавцу уходят только после того, как вы подтвердите получение.');
      case 'order_paid': return t('🛒 Заказ #{id} оплачен: «{title}» × {qty} — {amount}.', n)
        + (d.data ? ' ' + t('Данные покупателя: {data}.', { data: d.data }) : '')
        + (d.auto ? ' ' + t('Товар выдан автоматически.') : ' ' + t('Продавец, выполните заказ и нажмите «Выполнено».'))
        + (d.renew ? ' ' + t('Автопродление подписки.') : '');
      case 'order_delivered': return t('📦 Заказ #{id} выполнен продавцом. Покупатель, проверьте и подтвердите получение.', n);
      case 'order_completed':
        if (d.by === 'auto') return t('✅ Заказ #{id} подтверждён автоматически по сроку. Продавцу начислено {net}.', n);
        if (d.by === 'admin') return t('⚖️ Арбитраж: заказ #{id} закрыт в пользу продавца.', n);
        return t('✅ Покупатель подтвердил заказ #{id}. Продавцу начислено {net}.', n);
      case 'order_refunded':
        if (d.by === 'seller') return t('↩️ Продавец вернул деньги за заказ #{id}: {amount}.', n);
        if (d.by === 'buyer') return t('↩️ Покупатель отменил просроченный заказ #{id}, деньги вернулись.', n);
        return t('⚖️ Арбитраж: деньги за заказ #{id} возвращены покупателю.', n);
      case 'dispute_open': return t('⚠️ По заказу #{id} открыт спор: «{reason}». Администратор разберётся, деньги заморожены.', n);
      case 'dispute_closed': return t('🤝 Спор по заказу #{id} закрыт, сделка продолжается.', n);
      case 'dispute_resolved': return (d.winner === 'buyer' ? t('⚖️ Решение по заказу #{id}: деньги возвращены покупателю.', n) : t('⚖️ Решение по заказу #{id}: деньги переведены продавцу.', n)) + (d.note ? ' ' + d.note : '');
      case 'demo_reply': return t('🤖 Это демо-продавец: заказы он выполняет сам примерно за минуту. Настоящие продавцы отвечают здесь же.');
      default: return '…';
    }
  },

  notifText(n) {
    const d = Object.assign({}, n.data || {});
    ['amount', 'net'].forEach((k) => { if (d[k] !== undefined) d[k] = Fmt.money(d[k]); });
    const by = { buyer: t('покупатель'), auto: t('автоматически'), admin: t('администратор'), seller: t('продавец') };
    if (d.by) d.by = by[d.by] || d.by;
    const map = {
      order_new: ['🛒', 'Новый заказ #{id}: «{title}» на {amount}'],
      order_delivered: ['📦', 'Заказ #{id} выполнен — проверьте и подтвердите получение'],
      order_completed: ['💰', 'Заказ #{id} завершён ({by}), вам начислено {net}'],
      order_closed: ['✅', 'Заказ #{id} закрыт ({by})'],
      order_refunded: ['↩️', 'Деньги за заказ #{id} вернулись на баланс: {amount}'],
      order_refunded_s: ['↩️', 'Заказ #{id} отменён ({by}), деньги вернулись покупателю'],
      dispute_open: ['⚠️', 'По заказу #{id} открыт спор'],
      dispute_new: ['⚖️', 'Новый спор: заказ #{id} на {amount}'],
      review_new: ['⭐', 'Новый отзыв {stars}★ на заказ #{id}'],
      withdraw_new: ['🏦', 'Заявка на вывод {amount} от {login}'],
      withdraw_done: ['🏦', 'Вывод отправлен: {amount}'],
      withdraw_rejected: ['❌', 'Вывод отклонён: {note}. Деньги вернулись на баланс'],
      sub_renewed: ['🔁', 'Подписка продлена — заказ #{order}'],
      sub_failed: ['⚠️', 'Не удалось продлить подписку'],
      ref_joined: ['🤝', 'По вашей ссылке зарегистрировался {login}'],
      support_msg: ['💬', 'Сообщение в поддержку от {login}: {text}'],
      support_reply: ['💬', 'Поддержка ответила вам'],
      report_new: ['🚩', 'Новая жалоба'],
      lot_blocked: ['🚫', 'Лот #{id} заблокирован модератором: {reason}'],
      lot_unblocked: ['✅', 'Лот #{id} снова можно включить'],
      balance_admin: ['🛡️', 'Баланс изменён администратором: {amount}'],
    };
    const m = map[n.kind] || ['🔔', n.kind];
    let text = t(m[1], d);
    if (n.kind === 'sub_failed') text += ': ' + errText(d.error) + (d.stopped ? ' ' + t('Автопродление выключено.') : ' ' + t('Попробуем ещё раз завтра.'));
    return { icon: m[0], text };
  },
};
