'use strict';
/* =========================================================
   VIEWS · АДМИНКА — обзор, споры, выводы, люди, лоты, заказы,
   жалобы, промокоды, поддержка и настройки сервиса.
   Модератор видит споры, лоты, жалобы и поддержку.
   ========================================================= */

const ADMIN_TABS = [
  ['stats', '📈', 'Обзор', false], ['disputes', '⚖️', 'Споры', false], ['support', '🛟', 'Поддержка', false],
  ['topups', '💳', 'Пополнения', true], ['withdrawals', '🏦', 'Выводы', true], ['orders', '🧾', 'Заказы', false], ['users', '👥', 'Люди', false],
  ['lots', '📦', 'Лоты', false], ['reports', '🚩', 'Жалобы', false], ['promos', '🎁', 'Промокоды', true], ['games', '🎮', 'Игры', true], ['config', '⚙️', 'Настройки', true],
];

/* стандартные разделы игры (как в sauda.secs): можно включать и выключать, названия по умолчанию */
const SECTION_STD = { accounts: 'Аккаунты', currency: 'Валюта', donate: 'Донат по ID', items: 'Предметы и скины', boost: 'Буст и прокачка',
  keys: 'Ключи и гифты', topup: 'Пополнение кошелька', subs: 'Подписки', services: 'Услуги', coaching: 'Обучение', goods: 'Товары', other: 'Прочее' };
const admGame = (action, p) => Api.auth('sauda_admin_game', { p_action: action, p: p || {} });

const adm = (action, p) => Api.auth('sauda_admin', { p_action: action, p: p || {} });

Views.admin = async (view, ctx) => {
  const isAdmin = App.me && App.me.role === 'admin';
  const tab = ctx.params.tab || 'stats';
  view.innerHTML = html`<div class="page-head"><h1>🛡️ ${t('Панель администратора')}</h1></div>
    <div class="tabs scroll-x">${ADMIN_TABS.filter((x) => isAdmin || !x[3]).map(([id, i, l]) => html`<a class="tab ${tab === id ? 'on' : ''}" href="#/admin/${id}">${i} ${t(l)}<span class="cnt" id="ac-${id}" hidden></span></a>`)}</div>
    <div id="adm">${C.skeleton(3, 'rows')}</div>`.s;
  const box = view.querySelector('#adm');
  const fn = Admin[tab];
  if (!fn) { box.innerHTML = C.empty('🤷', t('Нет такого раздела')).s; return; }
  await fn(box, ctx, isAdmin);
  // счётчики во вкладках
  const s = await adm('stats');
  if (s.ok && ctx.alive()) {
    [['disputes', s.data.disputes], ['topups', s.data.topups], ['withdrawals', s.data.withdrawals], ['reports', s.data.reports], ['support', s.data.support]].forEach(([k, n]) => {
      const el = view.querySelector('#ac-' + k);
      if (el && n) { el.hidden = false; el.textContent = n; }
    });
  }
};

const Admin = {
  async stats(box, ctx) {
    const r = await adm('stats');
    if (!ctx.alive()) return;
    if (!r.ok) { box.innerHTML = C.empty('📡', errText(r.error)).s; return; }
    const d = r.data;
    const kpi = (v, l, href) => html`<${href ? 'a' : 'div'} class="card kpi" ${href ? raw(`href="${href}"`) : ''}><b>${v}</b><span>${l}</span></${href ? 'a' : 'div'}>`;
    box.innerHTML = html`
      ${d.test_mode ? html`<div class="note warn">🧪 ${t('Тестовый режим включён: пополнение бесплатное, демо-лоты видны. Когда будете готовы принимать настоящие деньги — укажите реквизиты Kaspi и запустите сервис в «Настройках».')}</div>`
        : html`<div class="note">💰 ${t('Работаем с настоящими деньгами с {d}.', { d: d.live_since ? Fmt.date(d.live_since) : '—' })}</div>`}
      <div class="kpis">
        ${kpi(Fmt.num(d.users), t('пользователей (+{n} за сутки)', { n: d.users_today }))}${kpi(Fmt.num(d.online), t('онлайн сейчас'))}${kpi(Fmt.num(d.lots), t('активных лотов'))}
        ${kpi(Fmt.num(d.orders), t('заказов (+{n} за сутки)', { n: d.orders_today }))}${kpi(Fmt.money(d.gmv), t('оборот (завершённые)'))}${kpi(Fmt.money(d.gmv_30), t('оборот за 30 дней'))}
        ${kpi(Fmt.money(d.fees), t('комиссия заработана'))}${kpi(Fmt.money(d.pro_income), t('доход от Pro ({n} чел.)', { n: d.pro_users }))}${kpi(Fmt.money(d.platform_balance), t('счёт сервиса'))}
        ${kpi(Fmt.money(d.user_balances), t('на балансах людей'))}${kpi(Fmt.money(d.topups_in || 0), t('пришло пополнений'))}${kpi(d.topups || 0, t('пополнений ждут проверки'), '#/admin/topups')}${kpi(Fmt.money(d.escrow), t('заморожено в заказах'))}
        ${kpi(d.disputes, t('открытых споров'), '#/admin/disputes')}${kpi(t('{n} на {s}', { n: d.withdrawals, s: Fmt.money(d.withdrawals_sum) }), t('выводов ждут'), '#/admin/withdrawals')}
        ${kpi(d.reports, t('жалоб'), '#/admin/reports')}${kpi(d.support, t('непрочитанных в поддержке'), '#/admin/support')}
      </div>
      <div class="card"><h2>${t('Заказы за 14 дней')}</h2>${Chart.bars(d.days, 'n')}</div>
      <div class="card"><h2>${t('Оборот за 14 дней')}</h2>${Chart.bars(d.days, 'sum')}</div>`.s;
  },

  async disputes(box, ctx) {
    const r = await adm('disputes');
    if (!ctx.alive()) return;
    if (!r.ok) { box.innerHTML = C.empty('📡', errText(r.error)).s; return; }
    box.innerHTML = (r.data.length ? html`<div class="order-list">${r.data.map((o) => html`${C.orderRow(o)}<div class="note warn small">${t('Причина')}: ${o.dispute_reason}</div>`)}</div>`
      : C.empty('🕊️', t('Открытых споров нет'))).s;
  },

  async orders(box, ctx) {
    box.innerHTML = html`<form class="filters" data-submit="find"><input name="q" type="search" placeholder="${t('Номер, название или логин')}" value="${ctx.query.q || ''}"><select name="status"><option value="">${t('Все')}</option>${Object.keys(STATUS).map((s) => html`<option value="${s}" ${ctx.query.status === s ? 'selected' : ''}>${t(STATUS[s].ru)}</option>`)}</select><button class="btn">${t('Найти')}</button></form><div id="ol">${C.skeleton(4, 'rows')}</div>`.s;
    const load = async (q, status) => {
      const r = await adm('orders', { q, status });
      if (!ctx.alive()) return;
      box.querySelector('#ol').innerHTML = (!r.ok ? C.empty('📡', errText(r.error)) : r.data.length ? html`<div class="order-list">${r.data.map(C.orderRow)}</div>` : C.empty('🤷', t('Ничего не найдено'))).s;
    };
    UI.bind(box, { find: (f, fd) => load(String(fd.get('q') || ''), String(fd.get('status') || '')) });
    await load(ctx.query.q || '', ctx.query.status || '');
  },

  async topups(box, ctx) {
    const status = ctx.query.status || 'pending';
    const r = await adm('topups', { status, q: ctx.query.q || '' });
    if (!ctx.alive()) return;
    if (!r.ok) { box.innerHTML = C.empty('📡', errText(r.error)).s; return; }
    const st = (x) => TOPUP_STATUS[x.status === 'pending' && x.claimed_at ? 'claimed' : x.status] || [x.status, 'muted'];
    box.innerHTML = html`<div class="note small">${t('Человек переводит деньги на ваш Kaspi с кодом заявки в сообщении. Найдите перевод в Kaspi по коду и сумме, затем нажмите «Зачислить». Не пришло — «Отклонить».')}</div>
      <div class="chips">${[['pending', 'Ждут'], ['paid', 'Зачислены'], ['failed', 'Отклонены'], ['canceled', 'Отменены'], ['all', 'Все']].map(([k, l]) => html`<a class="chip ${status === k ? 'on' : ''}" href="#/admin/topups?status=${k}">${t(l)}</a>`)}</div>
      <form class="filters" data-submit="find"><input name="q" type="search" placeholder="${t('Код заявки, например SD123')}" value="${ctx.query.q || ''}"><button class="btn">${t('Найти')}</button></form>
      ${r.data.length ? html`<div class="card list">${r.data.map((x) => html`<div class="adm-row">
        <span class="tx-main"><b>${Fmt.money(x.amount)} · <span class="mono">${x.code}</span></b>
          <span class="muted small"><a href="#/u/${x.user.login}">${x.user.name} @${x.user.login}</a> · ${t('создана {d}', { d: Fmt.dt(x.created_at) })}${x.claimed_at ? ' · ' + t('«Я оплатил» {d}', { d: Fmt.dt(x.claimed_at) }) : ''}${x.note && x.status !== 'paid' ? ' · ' + x.note : ''}</span></span>
        ${x.status === 'pending' ? html`<span class="row-btns">${x.claimed_at ? '' : html`<span class="status status-warn">${t('ещё не оплачено')}</span>`}<button class="btn primary small" data-act="paid" data-id="${x.id}" data-sum="${x.amount}">✔ ${t('Зачислить')}</button><button class="btn ghost small" data-act="fail" data-id="${x.id}">✕ ${t('Отклонить')}</button></span>`
          : html`<span class="status status-${st(x)[1]}">${t(st(x)[0])}</span>`}
      </div>`)}</div>` : C.empty('💳', t('Заявок нет'))}`.s;
    UI.bind(box, {
      find: (f, fd) => Router.nav('#/admin/topups?status=all&q=' + encodeURIComponent(String(fd.get('q') || '').trim())),
      paid: async (b) => {
        const v = await UI.prompt(t('Сколько пришло на Kaspi, ₸'), { value: b.dataset.sum, text: t('Зачислим ровно столько, сколько пришло. Проверьте код в сообщении перевода.'), yes: t('Зачислить') });
        if (!v) return;
        const amount = Fmt.amount(v);
        if (!amount) return UI.fail({ error: 'bad_amount' });
        const x = await adm('topup_set', { id: +b.dataset.id, status: 'paid', amount });
        if (x.ok) { UI.toast(t('Зачислено {s}', { s: Fmt.money(amount) })); Router.go(); } else UI.fail(x);
      },
      fail: async (b) => {
        const note = await UI.prompt(t('Причина'), { placeholder: t('Например: перевод не найден'), yes: t('Отклонить'), danger: true });
        if (!note) return;
        const x = await adm('topup_set', { id: +b.dataset.id, status: 'failed', note });
        if (x.ok) Router.go(); else UI.fail(x);
      },
    });
  },

  async withdrawals(box, ctx) {
    const status = ctx.query.status || 'pending';
    const r = await adm('withdrawals', { status });
    if (!ctx.alive()) return;
    if (!r.ok) { box.innerHTML = C.empty('📡', errText(r.error)).s; return; }
    box.innerHTML = html`<div class="chips">${[['pending', 'Ждут'], ['done', 'Отправлены'], ['rejected', 'Отклонены'], ['canceled', 'Отменены'], ['all', 'Все']].map(([k, l]) => html`<a class="chip ${status === k ? 'on' : ''}" href="#/admin/withdrawals?status=${k}">${t(l)}</a>`)}</div>
      ${r.data.length ? html`<div class="card list">${r.data.map((w) => html`<div class="adm-row">
        <span class="tx-main"><b>${Fmt.money(w.amount - w.fee)}</b> <span class="muted">(${t('списано {a}, комиссия {f}', { a: Fmt.money(w.amount), f: Fmt.money(w.fee) })})</span>
          <span>${(OUT_METHODS[w.method] || [w.method, ''])[1]} ${t((OUT_METHODS[w.method] || [w.method])[0])}: <code class="mono">${w.details}</code> <button class="link" data-act="copy" data-v="${w.details}">${t('копировать')}</button></span>
          <span class="muted small"><a href="#/u/${w.user.login}">${w.user.name} @${w.user.login}</a> · ${Fmt.dt(w.created_at)}${w.test ? ' · 🧪 ' + t('тест') : ''}${w.note ? ' · ' + w.note : ''}</span></span>
        ${['pending', 'processing'].includes(w.status) ? html`<span class="row-btns">${w.status === 'processing' ? html`<span class="status status-info">${t('Переводим')}</span>` : ''}<button class="btn primary small" data-act="done" data-id="${w.id}" data-sum="${w.amount - w.fee}" data-to="${w.details}">✔ ${w.status === 'pending' ? t('Перевести') : t('Отправил')}</button><button class="btn ghost small" data-act="reject" data-id="${w.id}">✕ ${t('Отклонить')}</button></span>`
          : html`<span class="status status-${(WD_STATUS[w.status] || ['', 'muted'])[1]}">${t((WD_STATUS[w.status] || [w.status])[0])}</span>`}
      </div>`)}</div>` : C.empty('🏦', t('Заявок нет'))}`.s;
    UI.bind(box, {
      copy: (b) => UI.copy(b.dataset.v),
      done: async (b) => {
        // сначала заявка «в работе» — человек уже не отменит её, пока вы переводите
        const y = await adm('withdraw_set', { id: +b.dataset.id, status: 'processing' });
        if (!y.ok && y.error !== 'bad_status') return UI.fail(y);
        if (y.ok) b.closest('.adm-row').querySelector('.row-btns').insertAdjacentHTML('afterbegin', html`<span class="status status-info">${t('Переводим')}</span>`.s);
        if (!(await UI.ask(t('Переведите {s} на {to}, затем подтвердите.', { s: Fmt.money(+b.dataset.sum), to: b.dataset.to }), { yes: t('Да, отправил') }))) return;
        const x = await adm('withdraw_set', { id: +b.dataset.id, status: 'done' });
        if (x.ok) Router.go(); else UI.fail(x);
      },
      reject: async (b) => {
        const note = await UI.prompt(t('Причина отказа'), { placeholder: t('Например: неверный номер'), yes: t('Отклонить'), danger: true });
        if (!note) return;
        const x = await adm('withdraw_set', { id: +b.dataset.id, status: 'rejected', note });
        if (x.ok) Router.go(); else UI.fail(x);
      },
    });
  },

  async users(box, ctx, isAdmin) {
    box.innerHTML = html`<form class="filters" data-submit="find"><input name="q" type="search" placeholder="${t('Логин или имя')}"><button class="btn">${t('Найти')}</button></form><div id="ul"></div>`.s;
    const load = async (q) => {
      const r = await adm('users', { q });
      if (!ctx.alive()) return;
      if (!r.ok) { box.querySelector('#ul').innerHTML = C.empty('📡', errText(r.error)).s; return; }
      box.querySelector('#ul').innerHTML = (r.data.length ? html`<div class="card list">${r.data.map((u) => html`<div class="adm-row">
        <a class="tx-main" href="#/u/${u.login}"><span>${C.avatar(u, 28)} <b>${u.name}</b> @${u.login} ${C.badges(u)} ${u.role !== 'user' ? html`<span class="tag">${u.role}</span>` : ''} ${u.banned ? html`<span class="tag tag-off">${t('заблокирован')}</span>` : ''}</span>
          <span class="muted small">${t('баланс {b}', { b: Fmt.money(u.balance) })} · ${tp(u.sales, 'продажа|продажи|продаж')} · ${tp(u.purchases, 'покупка|покупки|покупок')} · ${t('с {d}', { d: Fmt.date(u.since) })}</span></a>
        <span class="row-btns">
          <button class="btn small ghost" data-act="ban" data-id="${u.id}" data-on="${u.banned ? '0' : '1'}">${u.banned ? t('Разблокировать') : t('Заблокировать')}</button>
          <button class="btn small ghost" data-act="verify" data-id="${u.id}" data-on="${u.verified ? '0' : '1'}">${u.verified ? t('Снять ✔') : t('Проверен ✔')}</button>
          ${isAdmin ? html`<button class="btn small ghost" data-act="balance" data-id="${u.id}">₸</button>
            <select data-change="role" data-id="${u.id}" aria-label="${t('Роль')}">${['user', 'moder', 'admin'].map((r2) => html`<option ${u.role === r2 ? 'selected' : ''}>${r2}</option>`)}</select>
            <button class="btn small ghost" data-act="pro" data-id="${u.id}">👑+30</button>` : ''}
        </span></div>`)}</div>` : C.empty('🤷', t('Никого не нашли'))).s;
    };
    const set = async (p) => { const x = await adm('user_set', p); if (x.ok) { UI.toast(t('Готово')); load(box.querySelector('[name=q]').value); } else UI.fail(x); };
    UI.bind(box, {
      find: (f, fd) => load(String(fd.get('q') || '')),
      ban: async (b) => {
        if (b.dataset.on === '1') {
          const reason = await UI.prompt(t('Причина блокировки'), { yes: t('Заблокировать'), danger: true });
          if (reason) set({ id: b.dataset.id, banned: true, ban_reason: reason });
        } else set({ id: b.dataset.id, banned: false });
      },
      verify: (b) => set({ id: b.dataset.id, verified: b.dataset.on === '1' }),
      role: (el) => set({ id: el.dataset.id, role: el.value }),
      pro: (b) => set({ id: b.dataset.id, pro_days: 30 }),
      balance: async (b) => {
        const v = await UI.prompt(t('Изменить баланс'), { text: t('Сумма в тенге: положительная — начислить, отрицательная — списать. Деньги берутся со счёта сервиса.'), placeholder: '-500 / 1000', yes: t('Применить') });
        if (!v) return;
        const note = await UI.prompt(t('Комментарий'), { placeholder: t('За что') }) || '';
        const amount = Fmt.amount(v, true);
        if (!amount) return UI.fail({ error: 'bad_amount' });
        const x = await adm('balance', { id: b.dataset.id, amount, note });
        if (x.ok) { UI.toast(t('Готово')); load(box.querySelector('[name=q]').value); } else UI.fail(x);
      },
    });
    await load('');
  },

  async lots(box, ctx) {
    box.innerHTML = html`<form class="filters" data-submit="find"><input name="q" type="search" placeholder="${t('Номер или название')}"><select name="status"><option value="">${t('Все')}</option>${Object.keys(LOT_STATUS).map((s) => html`<option value="${s}">${t(LOT_STATUS[s])}</option>`)}</select><button class="btn">${t('Найти')}</button></form><div id="ll"></div>`.s;
    const load = async (q, status) => {
      const r = await adm('lots', { q, status });
      if (!ctx.alive()) return;
      if (!r.ok) { box.querySelector('#ll').innerHTML = C.empty('📡', errText(r.error)).s; return; }
      box.querySelector('#ll').innerHTML = (r.data.length ? html`<div class="card list">${r.data.map((l) => html`<div class="adm-row">
        <a class="tx-main" href="#/lot/${l.id}"><b>${l.title}</b><span class="muted small">#${l.id} · ${C.game(l.game).name} · ${Fmt.money(l.price)} · ${l.seller.name} · ${t(LOT_STATUS[l.status])}</span></a>
        ${l.status === 'blocked' ? html`<button class="btn small" data-act="unblock" data-id="${l.id}">${t('Разблокировать')}</button>` : html`<button class="btn small ghost danger-text" data-act="block" data-id="${l.id}">🚫 ${t('Заблокировать')}</button>`}</div>`)}</div>` : C.empty('🤷', t('Ничего не найдено'))).s;
    };
    UI.bind(box, {
      find: (f, fd) => load(String(fd.get('q') || ''), String(fd.get('status') || '')),
      block: async (b) => {
        const reason = await UI.prompt(t('Причина блокировки лота'), { yes: t('Заблокировать'), danger: true });
        if (!reason) return;
        const x = await adm('lot_block', { id: +b.dataset.id, blocked: true, reason });
        if (x.ok) load('', ''); else UI.fail(x);
      },
      unblock: async (b) => { const x = await adm('lot_block', { id: +b.dataset.id, blocked: false }); if (x.ok) load('', ''); else UI.fail(x); },
    });
    await load('', '');
  },

  async reports(box, ctx) {
    const r = await adm('reports', { status: ctx.query.status || 'open' });
    if (!ctx.alive()) return;
    if (!r.ok) { box.innerHTML = C.empty('📡', errText(r.error)).s; return; }
    const link = (x) => (x.kind === 'lot' ? '#/lot/' + x.target : x.kind === 'user' ? '#/u/' + x.target : '#/order/' + x.target);
    box.innerHTML = (r.data.length ? html`<div class="card list">${r.data.map((x) => html`<div class="adm-row"><span class="tx-main">
        <a href="${link(x)}"><b>${x.kind === 'lot' ? t('Лот') : x.kind === 'user' ? t('Пользователь') : t('Заказ')} ${x.target}</b></a>
        <span>${x.text}</span><span class="muted small">${t('от')} <a href="#/u/${x.user.login}">${x.user.name}</a> · ${Fmt.dt(x.created_at)}</span></span>
        ${x.status === 'open' ? html`<button class="btn small" data-act="close" data-id="${x.id}">✔ ${t('Разобрано')}</button>` : ''}</div>`)}</div>` : C.empty('🕊️', t('Жалоб нет'))).s;
    UI.bind(box, { close: async (b) => { const x = await adm('report_close', { id: +b.dataset.id }); if (x.ok) Router.go(); else UI.fail(x); } });
  },

  async promos(box, ctx) {
    const r = await adm('promos');
    if (!ctx.alive()) return;
    if (!r.ok) { box.innerHTML = C.empty('📡', errText(r.error)).s; return; }
    box.innerHTML = html`<form class="card filters" data-submit="add"><input name="code" required pattern="[A-Za-z0-9_-]{3,24}" placeholder="${t('КОД')}" autocapitalize="characters"><input name="amount" inputmode="numeric" required placeholder="${t('Сумма, ₸')}"><input name="uses" inputmode="numeric" placeholder="${t('Сколько раз (1)')}"><input name="days" inputmode="numeric" placeholder="${t('Дней действует (∞)')}"><button class="btn primary">${t('Создать')}</button></form>
      ${r.data.length ? html`<div class="card list">${r.data.map((p) => html`<div class="adm-row"><span class="tx-main"><b class="mono">${p.code}</b><span class="muted small">${Fmt.money(p.amount)} · ${t('использован {u}, осталось {l}', { u: p.used, l: p.uses_left })}${p.expires_at ? ' · ' + t('до {d}', { d: Fmt.date(p.expires_at) }) : ''}</span></span></div>`)}</div>` : C.empty('🎁', t('Промокодов пока нет'))}`.s;
    UI.bind(box, {
      add: async (f, fd) => {
        const amount = Fmt.amount(fd.get('amount'));
        if (!amount) return UI.fail({ error: 'bad_amount' });
        const x = await adm('promo_create', { code: fd.get('code'), amount, uses: parseInt(fd.get('uses'), 10) || 1, days: parseInt(fd.get('days'), 10) || 0 });
        if (x.ok) { UI.toast(t('Промокод создан')); Router.go(); } else UI.fail(x);
      },
    });
  },

  async support(box, ctx) {
    const uid = ctx.params.uid;
    if (uid) {
      box.innerHTML = html`<div class="chat-main card" id="sc"></div>`.s;
      ctx.onLeave(ChatBox.mount(box.querySelector('#sc'), { peerId: uid, mode: 'support', back: '#/admin/support' }));
      return;
    }
    const r = await adm('support');
    if (!ctx.alive()) return;
    if (!r.ok) { box.innerHTML = C.empty('📡', errText(r.error)).s; return; }
    box.innerHTML = (r.data.length ? html`<div class="chat-list">${r.data.map((c) => html`<a class="chat-item ${c.unread ? 'unread' : ''}" href="#/admin/support/${c.peer.id}">${C.avatar(c.peer, 42)}
        <span class="ci-main"><span class="ci-top"><b>${c.peer.name}</b> <span class="muted">@${c.peer.login}</span><time>${Fmt.dt(c.last_at)}</time></span>
        <span class="ci-last">${c.last_mine ? html`<span class="muted">${t('Поддержка')}: </span>` : ''}${c.last_kind === 'image' ? '📷' : c.last_text}</span></span>${c.unread ? html`<span class="badge">${c.unread}</span>` : ''}</a>`)}</div>`
      : C.empty('🛟', t('Обращений пока нет'))).s;
  },

  async games(box, ctx) {
    const r = await admGame('list');
    if (!ctx.alive()) return;
    if (!r.ok) { box.innerHTML = C.empty('📡', errText(r.error)).s; return; }
    box.innerHTML = html`<div class="row-btns"><button class="btn primary" data-act="add">＋ ${t('Добавить игру')}</button></div>
      ${KINDS.map((k) => {
        const list = r.items.filter((g) => g.kind === k.id);
        return list.length ? html`<section class="block"><h3>${k.icon} ${t(k.ru)}</h3><div class="card list">${list.map((g) => html`<div class="adm-row">
          <span class="tx-main"><span>${C.gicon(g)} <b>${g.name}</b> <span class="muted">${g.id}</span>${g.popular ? ' ⭐' : ''}</span>
            <span class="muted small">${t('лотов: {n}', { n: g.lots })} · ${g.sections.map((x) => x.ru).join(', ')}</span></span>
          <button class="btn small" data-act="edit" data-id="${g.id}">✏️ ${t('Изменить')}</button></div>`)}</div></section>` : '';
      })}`.s;
    UI.bind(box, { add: () => Admin.gameForm(null), edit: (b) => Admin.gameForm(r.items.find((g) => g.id === b.dataset.id)) });
  },

  /* добавить игру или изменить её: название, вид, разделы, эмодзи, цвет, логотип (сжимается в браузере до 128×128) */
  gameForm(g) {
    const isNew = !g;
    g = g || { id: '', name: '', kind: 'mobile', emoji: '🎮', color: '#00afca', sort: 500, popular: false, sections: [], logo: '', lots: 0 };
    let logo = g.logo, logoChanged = false;
    const preview = () => C.gicon(Object.assign({}, g, { logo })).s;
    const m = UI.modal({
      title: isNew ? t('Новая игра') : t('Изменить: {name}', { name: g.name }),
      body: html`<form class="stack" data-submit="save">
        <div class="logo-edit"><span class="logo-prev" id="lp">${raw(preview())}</span>
          <span class="stack"><label class="btn small">${t('Загрузить логотип')}<input type="file" accept="image/*" data-change="logo" hidden></label>
          <button type="button" class="btn small ghost" data-act="nologo">${t('Убрать свой логотип')}</button></span></div>
        <p class="muted small">${t('Квадратная картинка, лучше официальная иконка игры. Сайт сам уменьшит её до 128×128.')}</p>
        <label class="field"><span>${t('Название')}</span><input name="name" required maxlength="40" value="${g.name}"></label>
        <label class="field"><span>${t('Код игры (латиница, цифры, _)')}</span><input name="id" required pattern="[a-z0-9_]{2,24}" value="${g.id}" ${isNew ? '' : 'readonly'} placeholder="freefire"></label>
        <label class="field"><span>${t('Раздел каталога')}</span><select name="kind">${KINDS.map((k) => html`<option value="${k.id}" ${g.kind === k.id ? 'selected' : ''}>${k.icon} ${t(k.ru)}</option>`)}</select></label>
        <div class="grid2"><label class="field"><span>${t('Эмодзи (если нет логотипа)')}</span><input name="emoji" maxlength="8" value="${g.emoji}"></label>
          <label class="field"><span>${t('Цвет')}</span><input name="color" type="color" value="${g.color}"></label></div>
        <div class="grid2"><label class="field"><span>${t('Порядок (меньше — выше)')}</span><input name="sort" type="number" value="${g.sort}"></label>
          <label class="check"><input type="checkbox" name="popular" ${g.popular ? 'checked' : ''}> ⭐ ${t('Популярная — на главной')}</label></div>
        <fieldset class="field"><legend>${t('Что можно продавать')}</legend><div class="chips">${Object.entries(SECTION_STD).map(([id, ru]) => {
          const cur = g.sections.find((x) => x.id === id);
          return html`<label class="chip"><input type="checkbox" name="sec" value="${id}" ${cur ? 'checked' : ''}> ${cur ? cur.ru : t(ru)}</label>`;
        })}</div></fieldset>
        <button class="btn primary big wide">${t('Сохранить')}</button>
        ${!isNew && !g.lots ? html`<button type="button" class="btn ghost danger-text wide" data-act="del">${t('Удалить игру')}</button>` : ''}</form>`,
      on: {
        logo: async (inp) => {
          const file = inp.files && inp.files[0];
          inp.value = '';
          if (!file) return;
          try { logo = await Img.fit(file, 128, 30000, true); logoChanged = true; m.q('#lp').innerHTML = preview(); } catch (e) { UI.fail({ error: 'bad_image' }); }
        },
        nologo: () => { logo = ''; logoChanged = true; m.q('#lp').innerHTML = preview(); },
        del: async () => {
          if (!(await UI.ask(t('Удалить игру «{name}»? В ней нет лотов.', { name: g.name }), { yes: t('Удалить'), danger: true }))) return;
          const x = await admGame('delete', { id: g.id });
          if (!x.ok) return UI.fail(x);
          m.close(true); await App.loadMeta(true); Router.go();
        },
        save: (f, fd) => UI.busy(f.querySelector('.btn.primary'), async () => {
          const secs = fd.getAll('sec').map((id) => { const cur = g.sections.find((x) => x.id === id); return cur ? `${id}:${cur.ru}:${cur.kz}` : id; });
          if (!secs.length) return UI.fail({ error: 'bad_section' });
          const p = { id: String(fd.get('id')).trim().toLowerCase(), name: String(fd.get('name')).trim(), kind: fd.get('kind'), emoji: String(fd.get('emoji')).trim(),
            color: fd.get('color'), sort: parseInt(fd.get('sort'), 10) || 500, popular: !!fd.get('popular'), sections: secs.join('|') };
          if (logoChanged) p.logo = logo;
          const x = await admGame('save', p);
          if (!x.ok) return UI.fail(x);
          m.close(true);
          await App.loadMeta(true);
          UI.toast(t('Игра сохранена'));
          Router.go();
        }),
      },
    });
  },

  async config(box, ctx) {
    const r = await adm('config');
    if (!ctx.alive()) return;
    if (!r.ok) { box.innerHTML = C.empty('📡', errText(r.error)).s; return; }
    const c = r.data;
    const fields = [
      ['fee_pct', 'Комиссия с продажи, %'], ['pro_fee_pct', 'Комиссия для Pro, %'], ['complete_hours', 'Автоподтверждение, часов'],
      ['complete_hours_auto', 'Автоподтверждение при автовыдаче, часов'], ['min_withdraw', 'Минимальный вывод, ₸'], ['withdraw_fee_pct', 'Комиссия вывода, %'],
      ['max_topup', 'Максимальное пополнение, ₸'], ['raise_min', 'Поднятие раз в, минут'], ['raise_min_pro', 'Поднятие с Pro раз в, минут'],
      ['ref_pct', 'Реферальная доля комиссии, %'], ['max_lots', 'Лотов на продавца'], ['max_lots_pro', 'Лотов на Pro-продавца'],
    ];
    const pay = [
      ['pay_kaspi_phone', 'Номер Kaspi Gold для пополнений', '+7 7XX XXX XX XX'], ['pay_kaspi_name', 'Имя получателя в Kaspi', 'Айдос К.'],
      ['pay_card', 'Номер карты (необязательно)', '4400 …'], ['pay_link', 'Ссылка оплаты Kaspi Pay / QR (необязательно)', 'https://pay.kaspi.kz/…'],
      ['pay_note', 'Подсказка для покупателей (необязательно)', ''],
    ];
    box.innerHTML = html`<form class="card stack" data-submit="save">
      <h2>💰 ${t('Приём денег')}</h2>
      <p class="muted small">${t('Люди переводят деньги на эти реквизиты с кодом заявки, вы сверяете перевод во вкладке «Пополнения» и зачисляете. Выплаты — во вкладке «Выводы».')}</p>
      <div class="grid2">${pay.map(([k, l, ph]) => html`<label class="field"><span>${t(l)}</span><input name="${k}" value="${c[k] || ''}" placeholder="${ph}" maxlength="300"></label>`)}</div>
      ${c.test_mode ? html`<div class="note warn stack">
          <b>🧪 ${t('Сейчас тестовый режим: пополнение бесплатное, демо-лоты видны.')}</b>
          <span>${t('Запуск с настоящими деньгами — один раз и навсегда: все тестовые балансы обнулятся, открытые тестовые заказы и заявки закроются, демо-лоты пропадут. Вернуть тестовый режим будет нельзя.')}</span>
          <button type="button" class="btn danger" data-act="live">🚀 ${t('Запустить с настоящими деньгами')}</button></div>`
        : html`<div class="note">✅ ${t('Сервис работает с настоящими деньгами с {d}.', { d: c.live_since ? Fmt.date(c.live_since) : '—' })}</div>`}
      <h2>⚙️ ${t('Правила')}</h2>
      <div class="grid2">${fields.map(([k, l]) => html`<label class="field"><span>${t(l)}</span><input name="${k}" inputmode="decimal" value="${c[k]}"></label>`)}</div>
      <div class="grid2">${['1', '3', '12'].map((m) => html`<label class="field"><span>${t('Pro на {m} мес., ₸', { m })}</span><input name="pro_${m}" inputmode="numeric" value="${(c.pro_prices || {})[m] || ''}"></label>`)}</div>
      <button class="btn primary">${t('Сохранить')}</button></form>`.s;
    const save = async (fd) => {
      const jobs = [];
      pay.forEach(([k]) => { const v = String(fd.get(k) || '').trim(); if (v !== (c[k] || '')) jobs.push([k, v]); });
      fields.forEach(([k]) => { const v = parseFloat(String(fd.get(k)).replace(/\s/g, '').replace(',', '.')); if (Number.isFinite(v) && v !== +c[k]) jobs.push([k, v]); });
      const pp = {};
      ['1', '3', '12'].forEach((m) => { const v = Fmt.amount(fd.get('pro_' + m)); if (v > 0) pp[m] = v; });
      if (JSON.stringify(pp) !== JSON.stringify(c.pro_prices || {})) jobs.push(['pro_prices', pp]);
      for (const [k, v] of jobs) {
        const x = await adm('config_set', { k, v });
        if (!x.ok) { UI.fail(x); return false; }
        c[k] = v; // следующее сохранение сравнивает с тем, что уже записано
      }
      await App.loadMeta(true);
      return true;
    };
    UI.bind(box, {
      save: async (f, fd) => { if (await save(fd)) UI.toast(t('Настройки сохранены')); },
      live: async () => {
        const f = box.querySelector('form');
        if (!(await save(new FormData(f)))) return;
        if (!c.pay_kaspi_phone && !c.pay_card && !c.pay_link) return UI.fail({ error: 'pay_not_set' });
        if (!(await UI.ask(t('Запустить Sauda с настоящими деньгами? Тестовые балансы всех людей обнулятся, это нельзя отменить.'), { yes: t('Запустить'), danger: true }))) return;
        const x = await adm('config_set', { k: 'test_mode', v: false });
        if (!x.ok) return UI.fail(x);
        await App.loadMeta(true);
        await App.refresh(true);
        UI.toast(t('Готово! Sauda работает с настоящими деньгами.'));
        Router.go();
      },
    });
  },
};
