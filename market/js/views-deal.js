'use strict';
/* =========================================================
   VIEWS · СДЕЛКИ — мои заказы, страница заказа с действиями
   и отзывом, список чатов, переписка (опрос каждые 3 секунды).
   ========================================================= */

/* ---- переписка: один компонент для чата, заказа и поддержки (режим support — от имени сервиса) */
const ChatBox = {
  drafts: {},
  mount(box, opts) {
    const support = opts.mode === 'support';
    let last = 0, first = null, stopped = false, timer = null, peer = null, sending = false;
    const get = (after, before) => (support
      ? Api.auth('sauda_admin', { p_action: 'support_chat', p: { user: opts.peerId, after } }).then((r) => (r.ok ? r.data : r))
      : Api.auth('sauda_chat', { p_peer: opts.peerId, p_after: after || 0, p_before: before || null }));
    const send = (body, kind) => (support
      ? Api.auth('sauda_admin', { p_action: 'support_send', p: { user: opts.peerId, body, kind } }).then((r) => (r.ok ? r.data : r))
      : Api.auth('sauda_send', { p_peer: opts.peerId, p_body: body, p_kind: kind }));

    box.classList.add('chatbox');
    box.innerHTML = html`
      ${opts.head === false ? '' : html`<div class="cb-head" id="cb-head"><span class="skel" style="width:160px;height:20px"></span></div>`}
      <div class="cb-orders" id="cb-orders"></div>
      <div class="cb-list" id="cb-list" aria-live="polite"><div class="center muted">${t('Загрузка…')}</div></div>
      <form class="cb-form" data-submit="send">
        <label class="icon-btn attach" title="${t('Прикрепить фото')}"><input type="file" accept="image/*" data-change="photo" hidden>📎</label>
        <textarea name="body" rows="1" maxlength="3000" placeholder="${t('Сообщение…')}" aria-label="${t('Сообщение')}" data-input="grow"></textarea>
        <button class="btn primary" aria-label="${t('Отправить')}">➤</button>
      </form>`.s;
    const list = box.querySelector('#cb-list');
    const ta = box.querySelector('textarea');
    // недописанное сообщение переживает перерисовку страницы заказа (новый статус, системное сообщение)
    const dk = (support ? 's:' : '') + opts.peerId;
    ta.value = ChatBox.drafts[dk] || '';
    ta.addEventListener('input', () => { if (ta.value) ChatBox.drafts[dk] = ta.value; else delete ChatBox.drafts[dk]; });
    const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    const toBottom = () => { list.scrollTop = list.scrollHeight; };
    let lastDay = '';

    function msgHtml(m) {
      const day = new Date(m.created_at).toDateString();
      const sep = day !== lastDay ? html`<div class="cb-day">${Fmt.date(m.created_at)}</div>` : '';
      lastDay = day;
      if (m.kind === 'system') {
        // на странице заказа сообщения о других заказах с этим же человеком — бледные, чтобы не спутать данные
        const other = opts.orderId && m.order_id && m.order_id !== opts.orderId;
        return html`${sep}<div class="msg-sys ${other ? 'other' : ''}" data-id="${m.id}">${C.sysText(m.body, support ? undefined : !!m.mine)}${m.order_id ? html` <a href="#/order/${m.order_id}">${t('Открыть заказ')} →</a>` : ''}<time>${Fmt.time(m.created_at)}</time></div>`;
      }
      return html`${sep}<div class="msg ${m.mine ? 'mine' : ''}" data-id="${m.id}"><div class="bubble">${m.kind === 'image'
        ? html`<button class="msg-img" data-act="zoom" aria-label="${t('Открыть фото')}"><img src="${m.body}" alt="" loading="lazy"></button>`
        : richText(m.body)}<time>${Fmt.time(m.created_at)}</time></div></div>`;
    }
    function head(p) {
      const h = box.querySelector('#cb-head');
      if (!h) return;
      h.innerHTML = html`${opts.back ? html`<a class="icon-btn" href="${opts.back}" aria-label="${t('Назад')}">←</a>` : ''}<a class="cb-peer" href="#/u/${p.login}">${C.avatar(p, 38)}<span><b>${p.name}</b> ${C.badges(p)}<span class="muted small">${p.online ? html`<span class="online-dot"></span> ${t('В сети')}` : t('Был(а) {t}', { t: Fmt.ago(p.last_seen) })}</span></span></a>`.s;
    }
    function orders(list2) {
      const el = box.querySelector('#cb-orders');
      el.innerHTML = list2 && list2.length && !opts.hideOrders ? list2.map((o) => html`<a class="cb-order" href="#/order/${o.id}">${C.status(o.status)} #${o.id} · ${o.title} · <b>${Fmt.money(o.amount)}</b></a>`.s).join('') : '';
    }
    async function load() {
      const r = await get(0);
      if (stopped) return;
      if (!r.ok) { list.innerHTML = C.empty('💬', errText(r.error)).s; return; }
      peer = r.peer;
      head(peer);
      orders(r.orders);
      lastDay = '';
      list.innerHTML = r.messages.length
        ? (r.messages.length >= 60 && !support ? html`<div class="center"><button class="btn ghost small" data-act="older">${t('Показать раньше')}</button></div>`.s : '') + r.messages.map((m) => msgHtml(m).s).join('')
        : html`<div class="cb-empty muted">${t('Напишите первым — продавцы обычно отвечают в течение часа.')}</div>`.s;
      if (r.messages.length) { last = r.messages[r.messages.length - 1].id; first = r.messages[0].id; }
      toBottom();
      if (opts.onLoad) opts.onLoad(r);
    }
    async function poll() {
      if (stopped || document.hidden || !Api.token) return;
      const r = await get(last);
      if (stopped || !r.ok) return;
      if (r.peer) { peer = r.peer; head(peer); }
      orders(r.orders);
      const fresh = r.messages.filter((m) => m.id > last);
      if (!fresh.length) return;
      const stick = nearBottom();
      const empty = list.querySelector('.cb-empty');
      if (empty) empty.remove();
      list.insertAdjacentHTML('beforeend', fresh.map((m) => msgHtml(m).s).join(''));
      last = fresh[fresh.length - 1].id;
      if (!first) first = fresh[0].id;
      if (stick) toBottom();
      if (fresh.some((m) => m.kind === 'system') && opts.onSystem) opts.onSystem();
      App.refresh();
    }
    async function doSend(body, kind) {
      if (sending) return;
      sending = true;
      try {
        const r = await send(body, kind);
        if (!r.ok) { UI.fail(r); return false; }
        await poll();
        toBottom();
        return true;
      } finally { sending = false; }
    }
    UI.bind(box, {
      send: async (f) => {
        const body = ta.value.trim();
        if (!body) return;
        ta.value = '';
        ta.style.height = '';
        delete ChatBox.drafts[dk];
        if (!(await doSend(body, 'text'))) { ta.value = body; ChatBox.drafts[dk] = body; }
      },
      grow: () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; },
      photo: async (inp) => {
        const file = inp.files && inp.files[0];
        inp.value = '';
        if (!file) return;
        try { await doSend(await Img.fit(file, 1280, 440000), 'image'); } catch (e) { UI.toast(t('Картинка не подошла — попробуйте другую.'), 'err'); }
      },
      zoom: (b) => UI.modal({ title: t('Фото'), wide: true, body: html`<img class="zoom-img" src="${b.querySelector('img').src}" alt="">` }),
      older: async (b) => {
        const r = await get(0, first);
        if (!r.ok) return UI.fail(r);
        const h0 = list.scrollHeight;
        lastDay = '';
        const blk = r.messages.map((m) => msgHtml(m).s).join('');
        b.parentElement.remove();
        list.insertAdjacentHTML('afterbegin', (r.messages.length >= 60 ? html`<div class="center"><button class="btn ghost small" data-act="older">${t('Показать раньше')}</button></div>`.s : '') + blk);
        if (r.messages.length) first = r.messages[0].id;
        list.scrollTop = list.scrollHeight - h0;
      },
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 700) { e.preventDefault(); box.querySelector('form').requestSubmit(); }
    });
    load();
    timer = setInterval(poll, 3000);
    const onVis = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
  },
};

/* ───────────── мои заказы ───────────── */
Views.orders = async (view, ctx) => {
  const tab = ctx.query.tab === 'sell' ? 'sell' : 'buy';
  const status = ctx.query.status || '';
  view.innerHTML = html`<div class="page-head"><h1>${t('Заказы')}</h1></div>
    <div class="tabs"><a class="tab ${tab === 'buy' ? 'on' : ''}" href="#/orders?tab=buy">🛒 ${t('Покупки')}</a><a class="tab ${tab === 'sell' ? 'on' : ''}" href="#/orders?tab=sell">💰 ${t('Продажи')}</a></div>
    <div class="chips" id="st"></div><div id="list">${C.skeleton(5, 'rows')}</div>
    <div class="center"><button class="btn ghost" id="more" hidden data-act="more">${t('Показать ещё')}</button></div>`.s;
  let items = [];
  async function load(reset) {
    const r = await Api.auth('sauda_orders', { p_role: tab, p_status: status, p_offset: reset ? 0 : items.length });
    if (!ctx.alive()) return;
    if (!r.ok) { view.querySelector('#list').innerHTML = C.empty('📡', errText(r.error)).s; return; }
    items = reset ? r.items : items.concat(r.items);
    const c = r.counts;
    view.querySelector('#st').innerHTML = [['', 'Все', c.all], ['active', 'Активные', c.active], ['dispute', 'Споры', c.dispute], ['completed', 'Завершённые', c.completed], ['refunded', 'Возвраты', c.refunded]]
      .map(([k, l, n]) => html`<a class="chip ${status === k ? 'on' : ''}" href="#/orders?tab=${tab}${k ? '&status=' + k : ''}">${t(l)} <span class="cnt">${n}</span></a>`.s).join('');
    view.querySelector('#list').innerHTML = items.length
      ? html`<div class="order-list">${items.map(C.orderRow)}</div>`.s
      : C.empty(tab === 'buy' ? '🛒' : '💰', tab === 'buy' ? t('Покупок пока нет') : t('Продаж пока нет'), tab === 'buy' ? html`<a class="btn primary" href="#/catalog">${t('В каталог')}</a>` : html`<a class="btn primary" href="#/sell">${t('Выставить лот')}</a>`).s;
    view.querySelector('#more').hidden = r.items.length < 40;
  }
  UI.bind(view, { more: (b) => UI.busy(b, () => load(false)) });
  await load(true);
};

/* ───────────── заказ ───────────── */
Views.order = async (view, ctx) => {
  view.innerHTML = C.skeleton(2, 'rows').s;
  const r = await Api.auth('sauda_order', { p_id: +ctx.params.id });
  if (!ctx.alive()) return;
  if (!r.ok) { view.innerHTML = C.empty('🤷', errText(r.error), html`<a class="btn" href="#/orders">${t('Мои заказы')}</a>`).s; return; }
  const o = r.order, rev = r.review;
  const g = C.game(o.game);
  const buyer = o.role === 'buyer', seller = o.role === 'seller', staff = o.role === 'staff' && App.isStaff();
  const other = buyer ? o.seller : o.buyer;
  const open = ['paid', 'delivered', 'dispute'].includes(o.status);
  const overdue = o.status === 'paid' && new Date(o.deliver_by) < new Date();
  const steps = [
    ['🛒', t('Оплачен'), o.created_at, true],
    ['📦', t('Выполнен'), o.delivered_at, !!o.delivered_at],
    o.status === 'refunded' ? ['↩️', t('Возврат'), o.closed_at, true] : ['✅', t('Завершён'), o.closed_at, o.status === 'completed'],
  ];
  const lines = (o.payload || '').split('\n').filter(Boolean);
  const hint = {
    paid: buyer ? t('Продавец должен выполнить заказ до {d} (осталось {l}).', { d: Fmt.dt(o.deliver_by), l: Fmt.left(o.deliver_by) }) : seller ? t('Выполните заказ до {d} (осталось {l}) и нажмите «Выполнено».', { d: Fmt.dt(o.deliver_by), l: Fmt.left(o.deliver_by) }) : '',
    delivered: buyer ? t('Проверьте товар и подтвердите получение. Если ничего не сделать, заказ подтвердится сам через {l}.', { l: Fmt.left(o.complete_at) }) : t('Ждём подтверждения покупателя. Автоподтверждение через {l}.', { l: Fmt.left(o.complete_at) }),
    dispute: t('Открыт спор. Деньги заморожены, пока администратор не примет решение.'),
    completed: seller ? t('Сделка закрыта. На баланс начислено {s} (комиссия {f}).', { s: Fmt.money(o.amount - o.fee), f: Fmt.money(o.fee) }) : t('Сделка закрыта. Спасибо за покупку!'),
    refunded: buyer ? t('Деньги вернулись на ваш баланс.') : t('Деньги возвращены покупателю.'),
  }[o.status];

  view.innerHTML = html`
    <div class="page-head"><a class="icon-btn" href="#/orders?tab=${seller ? 'sell' : 'buy'}" aria-label="${t('Назад')}">←</a><h1>${t('Заказ #{id}', { id: o.id })}</h1>${C.status(o.status)}</div>
    <div class="order-page">
      <div class="order-main">
        <div class="card order-card">
          <a class="oc-lot" href="#/lot/${o.lot_id}"><span class="or-ico big" style="--c:${g.color}">${o.thumb ? html`<img src="${o.thumb}" alt="">` : C.gicon(g)}</span>
            <span><b>${o.title}</b><span class="muted small">${g.name} · ${C.section(o.game, o.section)}</span></span></a>
          <dl class="sum-list">
            <div><dt>${t('Цена')}</dt><dd>${Fmt.money(o.unit_price)} × ${o.qty}</dd></div>
            <div class="total"><dt>${t('Сумма')}</dt><dd>${Fmt.money(o.amount)}</dd></div>
            ${o.buyer_data ? html`<div><dt>${o.id_label || t('Данные покупателя')}</dt><dd class="mono">${o.buyer_data} <button class="link" data-act="copy" data-v="${o.buyer_data}">${t('копировать')}</button></dd></div>` : ''}
            <div><dt>${t('Продавец')}</dt><dd><a href="#/u/${o.seller.login}">${o.seller.name}</a></dd></div>
            <div><dt>${t('Покупатель')}</dt><dd><a href="#/u/${o.buyer.login}">${o.buyer.name}</a></dd></div>
            ${o.sub_id ? html`<div><dt>${t('Подписка')}</dt><dd><a href="#/subs">🔁 ${t('автопродление')}</a></dd></div>` : ''}
          </dl>
          <ol class="timeline">${steps.map(([i, l, d, on]) => html`<li class="${on ? 'on' : ''}"><span>${i}</span><b>${l}</b><small>${d ? Fmt.dt(d) : '—'}</small></li>`)}</ol>
          ${hint ? html`<div class="note ${o.status === 'dispute' ? 'warn' : ''}">${hint}</div>` : ''}
          ${o.status === 'dispute' ? html`<div class="note warn"><b>${t('Причина спора')}:</b> ${o.dispute_reason}</div>` : ''}
          ${o.resolution && o.resolution.startsWith('admin:') && o.resolution.length > 6 ? html`<div class="note"><b>${t('Решение администратора')}:</b> ${o.resolution.slice(6)}</div>` : ''}
        </div>

        ${lines.length && (buyer || seller || staff) ? html`<div class="card payload">
          <div class="block-head"><h2>📦 ${t('Товар')}</h2><button class="btn ghost small" data-act="copy" data-v="${o.payload}">${t('Скопировать всё')}</button></div>
          ${lines.map((x) => html`<div class="pl-line"><code>${x}</code><button class="icon-btn" data-act="copy" data-v="${x}" aria-label="${t('Копировать')}">⧉</button></div>`)}
          ${buyer && o.status === 'delivered' ? html`<p class="muted small">${t('Сразу проверьте товар. Если что-то не работает — откройте спор до подтверждения.')}</p>` : ''}
        </div>` : ''}

        <div class="order-actions">
          ${buyer && o.status === 'delivered' ? html`<button class="btn primary big" data-act="confirm">✅ ${t('Подтвердить получение')}</button>` : ''}
          ${buyer && o.status === 'paid' ? html`<button class="btn primary big" data-act="chat">💬 ${t('Написать продавцу')}</button>` : ''}
          ${seller && o.status === 'paid' ? html`<button class="btn primary big" data-act="deliver">📦 ${t('Выполнено')}</button>` : ''}
          ${buyer && overdue ? html`<button class="btn" data-act="cancel">↩️ ${t('Отменить и вернуть деньги')}</button>` : ''}
          ${seller && open ? html`<button class="btn ghost" data-act="refund">↩️ ${t('Вернуть деньги покупателю')}</button>` : ''}
          ${(buyer || seller) && ['paid', 'delivered'].includes(o.status) ? html`<button class="btn ghost danger-text" data-act="dispute">⚠️ ${t('Открыть спор')}</button>` : ''}
          ${buyer && o.status === 'paid' ? html`<button class="link small muted" data-act="confirm">${t('Товар уже у меня — подтвердить получение')}</button>` : ''}
          ${o.status === 'dispute' && o.dispute_by && App.me && o.dispute_by === App.me.id ? html`<button class="btn ghost" data-act="undispute">🤝 ${t('Закрыть спор')}</button>` : ''}
        </div>

        ${staff && open ? html`<div class="card admin-box"><h2>⚖️ ${t('Арбитраж')}</h2>
          <textarea id="adm-note" rows="2" maxlength="200" placeholder="${t('Комментарий к решению (увидят обе стороны)')}"></textarea>
          <div class="row-btns"><button class="btn" data-act="resolve" data-w="buyer">↩️ ${t('Вернуть покупателю')}</button><button class="btn primary" data-act="resolve" data-w="seller">💰 ${t('Перевести продавцу')}</button></div>
          <div id="adm-chat" class="adm-chat"></div></div>` : ''}

        ${o.status === 'completed' && (buyer || rev) ? html`<div class="card" id="review-box">${Order.reviewBox(o, rev, buyer, seller)}</div>` : ''}
      </div>
      ${buyer || seller ? html`<div class="order-chat card" id="order-chat"></div>` : ''}
    </div>`.s;

  const act = (action, text) => Api.auth('sauda_order_act', { p_id: o.id, p_action: action, p_text: text || '' }).then((x) => {
    if (!x.ok) { UI.fail(x); return; }
    App.refresh();
    Router.go();
  });
  UI.bind(view, {
    copy: (b) => UI.copy(b.dataset.v),
    confirm: async () => {
      // до отметки «выполнено» — отдельное предупреждение: так часто просят мошенники («подтверди, потом пришлю»)
      const q = o.status === 'paid'
        ? t('Продавец ещё не отметил заказ выполненным. Подтверждайте, только если товар уже у вас и всё работает: деньги сразу уйдут продавцу, вернуть их будет нельзя.')
        : t('Подтверждаете, что получили товар и всё работает? После этого деньги уйдут продавцу, отменить будет нельзя.');
      if (await UI.ask(q, { yes: t('Да, всё получил'), danger: o.status === 'paid' })) act('confirm');
    },
    chat: () => { const ta = view.querySelector('#order-chat textarea'); if (ta) { ta.scrollIntoView({ block: 'center' }); ta.focus(); } },
    deliver: async () => {
      const text = await new Promise((res) => {
        const m = UI.modal({
          title: t('Заказ выполнен'),
          body: html`<form class="stack" data-submit="ok"><p class="muted">${C.game(o.game).kind === 'goods' ? t('Напишите, как отправили вещь: Казпочта, CDEK или курьер и трек-номер, либо где и когда забрать. Без отметки покупателя заказ закроется сам только через 14 дней.') : t('Если нужно передать данные (код, логин и пароль, ссылку) — впишите их. Покупатель увидит их в заказе и в чате.')}</p>
            <textarea name="v" rows="4" maxlength="3000" placeholder="${t('Необязательно')}"></textarea>
            <div class="modal-actions"><button type="button" class="btn ghost" data-act="close">${t('Отмена')}</button><button class="btn primary">${t('Отметить выполненным')}</button></div></form>`,
          on: { ok: (f, fd) => { res(String(fd.get('v') || '')); m.close(true); } },
          onClose: (v) => { if (!v) res(null); },
        });
      });
      if (text !== null) act('deliver', text);
    },
    refund: async () => { if (await UI.ask(t('Вернуть {s} покупателю и отменить заказ?', { s: Fmt.money(o.amount) }), { danger: true, yes: t('Вернуть деньги') })) act('refund'); },
    cancel: async () => { if (await UI.ask(t('Продавец не выполнил заказ вовремя. Отменить и вернуть деньги на баланс?'), { yes: t('Отменить заказ') })) act('cancel'); },
    dispute: async () => {
      const text = await UI.prompt(t('Открыть спор'), { multiline: true, text: t('Опишите, что не так. Деньги останутся замороженными, администратор изучит переписку и примет решение.'), placeholder: t('Например: код не работает, продавец не отвечает'), yes: t('Открыть спор'), danger: true });
      if (text) act('dispute', text);
    },
    undispute: () => act('undispute'),
    resolve: async (b) => {
      const w = b.dataset.w;
      if (!(await UI.ask(w === 'buyer' ? t('Вернуть деньги покупателю?') : t('Перевести деньги продавцу?')))) return;
      const x = await Api.auth('sauda_admin', { p_action: 'resolve', p: { id: o.id, winner: w, note: (view.querySelector('#adm-note').value || '').trim() } });
      if (!x.ok) return UI.fail(x);
      UI.toast(t('Решение принято'));
      Router.go();
    },
    star: (b) => {
      const n = +b.dataset.n;
      view.querySelectorAll('.star-pick button').forEach((x) => x.classList.toggle('on', +x.dataset.n <= n));
      view.querySelector('#rv-stars').value = n;
    },
    review: async (f, fd) => {
      const stars = +fd.get('stars');
      if (!stars) return UI.toast(t('Поставьте оценку'), 'err');
      const x = await Api.auth('sauda_review', { p_order: o.id, p_stars: stars, p_text: String(fd.get('text') || '') });
      if (!x.ok) return UI.fail(x);
      UI.toast(t('Спасибо за отзыв!'));
      Router.go();
    },
    editReview: () => { view.querySelector('#review-box').innerHTML = Order.reviewForm(rev).s; },
    reply: async () => {
      const text = await UI.prompt(t('Ответ на отзыв'), { multiline: true, value: rev.reply || '', yes: t('Ответить') });
      if (text === null) return;
      const x = await Api.auth('sauda_review_reply', { p_order: o.id, p_text: text });
      if (!x.ok) return UI.fail(x);
      Router.go();
    },
  });

  if (buyer || seller) {
    ctx.onLeave(ChatBox.mount(view.querySelector('#order-chat'), { peerId: other.id, orderId: o.id, hideOrders: true, onSystem: () => Router.go() }));
  } else if (staff) {
    const c = await Api.auth('sauda_admin', { p_action: 'chat_between', p: { a: o.buyer.id, b: o.seller.id } });
    const box = view.querySelector('#adm-chat');
    if (box && c.ok) {
      box.innerHTML = html`<h3>${t('Переписка сторон')}</h3>${c.data.messages.map((m) => html`<div class="adm-msg"><b>${m.sender === o.buyer.id ? '🛒 ' + o.buyer.name : m.sender === o.seller.id ? '💰 ' + o.seller.name : '⚙️'}</b> <span class="muted small">${Fmt.dt(m.created_at)}</span><div>${m.kind === 'system' ? C.sysText(m.body) : m.kind === 'image' ? html`<img src="${m.body}" alt="" class="adm-img">` : richText(m.body)}</div></div>`)}`.s;
    }
  }
};

const Order = {
  reviewBox(o, rev, buyer, seller) {
    if (!rev) return Order.reviewForm(null);
    return html`<div class="block-head"><h2>⭐ ${t('Отзыв')}</h2>${buyer ? html`<button class="btn ghost small" data-act="editReview">${t('Изменить')}</button>` : ''}${seller ? html`<button class="btn ghost small" data-act="reply">${rev.reply ? t('Изменить ответ') : t('Ответить')}</button>` : ''}</div>${C.review(rev)}`;
  },
  reviewForm(rev) {
    const s = rev ? rev.stars : 0;
    return html`<form class="stack" data-submit="review"><h2>⭐ ${t('Оцените сделку')}</h2>
      <div class="star-pick" role="radiogroup" aria-label="${t('Оценка')}">${[1, 2, 3, 4, 5].map((n) => html`<button type="button" class="${n <= s ? 'on' : ''}" data-act="star" data-n="${n}" aria-label="${n}">★</button>`)}</div>
      <input type="hidden" name="stars" id="rv-stars" value="${s}">
      <textarea name="text" rows="3" maxlength="1000" placeholder="${t('Расскажите, как всё прошло (необязательно)')}">${rev ? rev.text : ''}</textarea>
      <button class="btn primary">${t('Отправить отзыв')}</button></form>`;
  },
};

/* ───────────── чаты ───────────── */
const Chats = {
  item(c, activeId) {
    const p = c.peer;
    const last = c.last_kind === 'system' ? C.sysText(c.last_text, !!c.last_mine) : c.last_kind === 'image' ? '📷 ' + t('Фото') : c.last_text;
    return html`<a class="chat-item ${c.unread ? 'unread' : ''} ${activeId === p.id ? 'on' : ''}" href="#/chat/${p.id}">
      ${C.avatar(p, 46)}${p.online ? html`<span class="online-dot abs"></span>` : ''}
      <span class="ci-main"><span class="ci-top"><b>${p.name}</b>${C.badges(p)}<time>${Fmt.dt(c.last_at)}</time></span>
        <span class="ci-last">${c.last_mine && c.last_kind !== 'system' ? html`<span class="muted">${t('Вы')}: </span>` : ''}${last}</span></span>
      ${c.unread ? html`<span class="badge">${c.unread}</span>` : ''}</a>`;
  },
  async fill(el, activeId) {
    const r = await Api.auth('sauda_chats');
    if (!r.ok) { el.innerHTML = C.empty('📡', errText(r.error)).s; return; }
    el.innerHTML = r.items.length ? r.items.map((c) => Chats.item(c, activeId).s).join('')
      : C.empty('💬', t('Переписок пока нет. Напишите продавцу со страницы лота.')).s;
  },
};

Views.chats = async (view, ctx) => {
  view.innerHTML = html`<div class="page-head"><h1>${t('Сообщения')}</h1></div><div class="chat-list" id="cl">${C.skeleton(5, 'rows')}</div>`.s;
  const el = view.querySelector('#cl');
  await Chats.fill(el);
  const timer = setInterval(() => { if (!document.hidden) Chats.fill(el); }, 8000);
  ctx.onLeave(() => clearInterval(timer));
};

Views.chat = async (view, ctx) => {
  const wide = window.innerWidth > 900;
  view.innerHTML = html`<div class="chat-page ${wide ? 'split' : ''}">${wide ? html`<div class="chat-list side" id="cl"></div>` : ''}<div class="chat-main card" id="cm"></div></div>`.s;
  const stop = ChatBox.mount(view.querySelector('#cm'), { peerId: ctx.params.uid, back: wide ? null : '#/chats' });
  let timer = null;
  if (wide) {
    const el = view.querySelector('#cl');
    Chats.fill(el, ctx.params.uid);
    timer = setInterval(() => { if (!document.hidden) Chats.fill(el, ctx.params.uid); }, 8000);
  }
  document.body.classList.add('in-chat');
  ctx.onLeave(() => { stop(); clearInterval(timer); document.body.classList.remove('in-chat'); });
};
