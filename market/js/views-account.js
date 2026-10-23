'use strict';
/* =========================================================
   VIEWS · АККАУНТ — вход, профиль, настройки, кошелёк, продажа лота,
   мои лоты, избранное, уведомления, подписки, Pro, рефералы,
   статистика продавца, помощь и правила.
   ========================================================= */

/* ───────────── код восстановления: выдаётся при регистрации, по нему задают новый пароль ───────────── */
const Recovery = {
  /* показать код и дождаться, пока человек его сохранит */
  show(code, first) {
    return new Promise((res) => {
      const m = UI.modal({
        title: t('Код восстановления'),
        body: html`<div class="stack">
          <p>${first ? t('Сохраните этот код — он нужен, если забудете пароль. Без него восстановить аккаунт с балансом сможет только администратор.') : t('Новый код. Старый больше не действует.')}</p>
          <div class="pay-row"><span class="muted small">${t('Код восстановления')}</span><b class="mono">${code}</b><button type="button" class="btn small ghost" data-act="copy">${t('Копировать')}</button></div>
          <p class="muted small">${t('Сделайте скриншот или запишите. Никому его не отправляйте — даже «поддержке» в Telegram.')}</p>
          <button type="button" class="btn primary big wide" data-act="ok">${t('Я сохранил код')}</button></div>`,
        on: { copy: () => UI.copy(code), ok: () => m.close(true) },
        onClose: () => res(),
      });
    });
  },
  /* забыли пароль: логин + код → новый пароль */
  form(next) {
    const contact = (App.meta && App.meta.config.support_contact) || '';
    const m = UI.modal({
      title: t('Восстановление пароля'),
      body: html`<form class="stack" data-submit="go">
        <label class="field"><span>${t('Логин')}</span><input name="login" required maxlength="24" autocapitalize="off" spellcheck="false"></label>
        <label class="field"><span>${t('Код восстановления')}</span><input name="code" required maxlength="20" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX"></label>
        <label class="field"><span>${t('Новый пароль')}</span><input name="pass" type="password" required minlength="6" maxlength="72" autocomplete="new-password"></label>
        <div class="auth-err" id="rc-err" role="alert"></div>
        <button class="btn primary big wide">${t('Сменить пароль')}</button>
        <p class="muted small">${t('Нет кода? Напишите администратору — он проверит, что аккаунт ваш, и выдаст временный пароль.')}${contact ? ' ' + t('Связь: {c}', { c: contact }) : ''}</p></form>`,
      on: {
        go: (f, fd) => UI.busy(f.querySelector('.btn.primary'), async () => {
          const r = await Api.call('sauda_recover', { p_login: fd.get('login'), p_code: fd.get('code'), p_new: fd.get('pass'), p_device: 'web' });
          if (!r.ok) { m.q('#rc-err').textContent = errText(r.error); return; }
          m.close(true);
          Api.setToken(r.token);
          await App.refresh(true);
          await Recovery.show(r.recovery, false);
          UI.toast(t('Пароль изменён'));
          location.replace(next || '#/me');
        }),
      },
    });
  },
};

/* ───────────── вход и регистрация ───────────── */
Views.auth = async (view, ctx) => {
  const reg = ctx.query.mode === 'reg';
  const next = safeNext(ctx.next || ctx.query.next);
  view.innerHTML = html`<div class="auth-page"><div class="card auth-card">
    <div class="auth-logo">${raw(App.logo(58) + App.WORD)}</div>
    ${ctx.query.why === 'buy' ? html`<div class="note">🛒 ${t('Чтобы купить, войдите или создайте аккаунт — это полминуты. Потом вернём вас к покупке.')}</div>` : ''}
    <div class="tabs center-tabs"><button class="tab ${reg ? '' : 'on'}" data-act="tab" data-m="login">${t('Вход')}</button><button class="tab ${reg ? 'on' : ''}" data-act="tab" data-m="reg">${t('Регистрация')}</button></div>
    <form class="stack" data-submit="go" id="auth-form">
      <label class="field"><span>${t('Логин')}</span><input name="login" required maxlength="24" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="${t('например, aidos_kz')}"></label>
      <label class="field reg-only" ${reg ? '' : 'hidden'}><span>${t('Имя на сайте')}</span><input name="name" maxlength="32" placeholder="${t('Как вас будут видеть покупатели')}"></label>
      <label class="field"><span>${t('Пароль')}</span><input name="password" type="password" required minlength="6" maxlength="72" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
      <label class="check reg-only" ${reg ? '' : 'hidden'}><input type="checkbox" name="agree" ${reg ? 'required' : ''}> <span>${t('Принимаю')} <a href="#/help?s=rules" target="_blank">${t('правила Sauda')}</a></span></label>
      <div class="auth-err" id="auth-err" role="alert"></div>
      <button class="btn primary big wide" id="auth-btn">${reg ? t('Создать аккаунт') : t('Войти')}</button>
      ${Store.get('sauda_ref', '') ? html`<p class="muted small center">🤝 ${t('Вы пришли по приглашению')}</p>` : ''}
    </form>
    <p class="muted small center">${t('Почта и телефон не нужны. Запомните логин и пароль — по ним вход с любого устройства.')}</p>
    <p class="center"><button class="link" data-act="forgot">🔑 ${t('Забыли пароль?')}</button></p>
  </div></div>`.s;
  let mode = reg ? 'reg' : 'login';
  const form = view.querySelector('#auth-form');
  UI.bind(view, {
    tab: (b) => {
      mode = b.dataset.m;
      view.querySelectorAll('[data-act=tab]').forEach((x) => x.classList.toggle('on', x === b));
      view.querySelectorAll('.reg-only').forEach((x) => { x.hidden = mode !== 'reg'; });
      form.agree.required = mode === 'reg';
      form.password.autocomplete = mode === 'reg' ? 'new-password' : 'current-password';
      view.querySelector('#auth-btn').textContent = mode === 'reg' ? t('Создать аккаунт') : t('Войти');
      view.querySelector('#auth-err').textContent = '';
    },
    go: (f, fd) => UI.busy(view.querySelector('#auth-btn'), async () => {
      const device = (navigator.userAgent.match(/Android|iPhone|iPad|Windows|Mac|Linux/) || ['web'])[0];
      const r = mode === 'reg'
        ? await Api.call('sauda_register', { p_login: fd.get('login'), p_password: fd.get('password'), p_name: fd.get('name') || '', p_ref: Store.get('sauda_ref', ''), p_device: device })
        : await Api.call('sauda_login', { p_login: fd.get('login'), p_password: fd.get('password'), p_device: device });
      if (!r.ok) { view.querySelector('#auth-err').textContent = errText(r.error); return; }
      Api.setToken(r.token);
      Store.del('sauda_ref');
      await App.refresh(true);
      if (r.recovery) await Recovery.show(r.recovery, true); // новый аккаунт — сначала сохранить код восстановления
      UI.toast(mode === 'reg' ? t('Добро пожаловать в Sauda!') : t('С возвращением!'));
      if (location.hash === next) Router.go(); else location.replace(next); // «Назад» не возвращает на страницу входа
    }),
    forgot: () => Recovery.form(next),
  });
};

/* ───────────── профиль: всё под рукой ───────────── */
Views.me = async (view) => {
  const me = App.me;
  if (!me) { view.innerHTML = C.empty('👤', t('Войдите, чтобы покупать и продавать')).s; return; }
  const n = App.counters;
  const item = (href, icon, label, badge) => html`<a class="menu-item" href="${href}"><span class="mi-ico">${icon}</span><span>${label}</span>${badge ? html`<span class="badge">${badge}</span>` : ''}<span class="mi-arrow">›</span></a>`;
  view.innerHTML = html`
    <div class="me-head card">
      <a href="#/u/${me.login}">${C.avatar(me, 64)}</a>
      <div class="me-main"><h1>${me.name} ${C.badges(me)}</h1><div class="muted">@${me.login} · ${me.reviews ? html`★ ${(+me.rating).toFixed(1)} (${me.reviews})` : t('отзывов пока нет')}</div>
        ${me.pro ? html`<div class="pro-line">👑 ${t('Sauda Pro до {d}', { d: Fmt.date(me.pro_until) })}</div>` : ''}</div>
      <a class="me-balance" href="#/wallet"><span class="muted small">${t('Баланс')}</span><b>${Fmt.money(me.balance)}</b><span class="link">${t('Пополнить / вывести')} →</span></a>
    </div>
    ${n.active_sell ? html`<a class="card note warn urgent" href="#/orders?tab=sell">⏱ <b>${tp(n.active_sell, 'заказ ждёт|заказа ждут|заказов ждут')}</b> ${t('выполнения или решения спора')} →</a>` : ''}
    ${Views.levelCard(me)}
    <div class="menu-grid">
      <div class="menu card"><h3>${t('Покупки')}</h3>
        ${item('#/orders?tab=buy', '🛒', t('Мои покупки'), n.active_buy)}
        ${item('#/favs', '❤️', t('Избранное'))}
        ${item('#/subs', '🔁', t('Подписки и автопродление'))}
      </div>
      <div class="menu card"><h3>${t('Продажи')}</h3>
        ${item('#/sell', '➕', t('Выставить лот'))}
        ${item('#/my-lots', '📋', t('Мои лоты'))}
        ${item('#/orders?tab=sell', '💰', t('Мои продажи'), n.active_sell)}
        ${item('#/stats', '📊', t('Статистика'))}
        ${item('#/pro', '👑', 'Sauda Pro')}
      </div>
      <div class="menu card"><h3>${t('Аккаунт')}</h3>
        ${item('#/wallet', '💳', t('Кошелёк'))}
        ${item('#/chats', '💬', t('Сообщения'), n.unread)}
        ${item('#/notifs', '🔔', t('Уведомления'), n.notifs)}
        ${item('#/ref', '🤝', t('Пригласить друзей'))}
        ${item('#/settings', '⚙️', t('Настройки'))}
      </div>
      <div class="menu card"><h3>${t('Помощь')}</h3>
        ${item('#/support', '🛟', t('Написать в поддержку'))}
        ${item('#/help', '❓', t('Вопросы и правила'))}
        ${App.isStaff() ? item('#/admin', '🛡️', t('Панель администратора')) : ''}
        <button class="menu-item" data-act="logout"><span class="mi-ico">🚪</span><span>${t('Выйти')}</span></button>
      </div>
    </div>`.s;
  UI.bind(view, { logout: async () => { if (await UI.ask(t('Выйти из аккаунта на этом устройстве?'), { yes: t('Выйти') })) App.logout(); } });
};

Views.support = async (view, ctx) => {
  view.innerHTML = C.skeleton(3, 'rows').s;
  const pf = await Api.call('sauda_user', { p_token: '', p_login: 'sauda' });
  if (!ctx.alive()) return; // ушли со страницы — не уводим человека в чат через секунду
  if (pf.ok) location.replace('#/chat/' + pf.user.id);
  else view.innerHTML = C.empty('📡', errText(pf.error)).s;
};

/* ───────────── настройки ───────────── */
Views.settings = async (view, ctx) => {
  const me = App.me;
  let avatar = me.avatar || '';
  view.innerHTML = html`<div class="page-head"><h1>${t('Настройки')}</h1></div>
    <div class="settings">
      <form class="card stack" data-submit="save"><h2>${t('Профиль')}</h2>
        <div class="ava-edit"><span id="ava-prev">${C.avatar(me, 72)}</span>
          <label class="btn ghost">${t('Загрузить фото')}<input type="file" accept="image/*" hidden data-change="ava"></label>
          <button type="button" class="btn ghost" data-act="noava">${t('Убрать')}</button></div>
        <label class="field"><span>${t('Имя')}</span><input name="name" maxlength="32" value="${me.name}" required></label>
        <label class="field"><span>${t('О себе')}</span><textarea name="bio" rows="3" maxlength="600" placeholder="${t('Чем торгуете, когда онлайн, как быстро отвечаете')}">${me.bio}</textarea></label>
        <label class="field"><span>${t('Город')}</span><select name="city"><option value="">—</option>${CITIES.map((c) => html`<option ${c === me.city ? 'selected' : ''}>${c}</option>`)}</select></label>
        <button class="btn primary">${t('Сохранить')}</button>
      </form>
      <div class="card stack"><h2>${t('Оформление')}</h2>
        <div class="seg" role="group" aria-label="${t('Язык')}"><button class="${I18n.lang === 'ru' ? 'on' : ''}" data-act="lang" data-l="ru">Русский</button><button class="${I18n.lang === 'kz' ? 'on' : ''}" data-act="lang" data-l="kz">Қазақша</button></div>
        <div class="seg" role="group" aria-label="${t('Тема')}"><button class="${App.theme() === 'dark' ? 'on' : ''}" data-act="theme" data-v="dark">🌙 ${t('Тёмная')}</button><button class="${App.theme() === 'light' ? 'on' : ''}" data-act="theme" data-v="light">☀️ ${t('Светлая')}</button></div>
        <label class="check"><input type="checkbox" data-change="notify" ${App.notifyOn() ? 'checked' : ''}> 🔔 ${t('Уведомления в браузере о новых сообщениях и заказах')}</label>
      </div>
      <form class="card stack" data-submit="pass"><h2>${t('Пароль')}</h2>
        <label class="field"><span>${t('Старый пароль')}</span><input type="password" name="old" required autocomplete="current-password"></label>
        <label class="field"><span>${t('Новый пароль')}</span><input type="password" name="new" required minlength="6" maxlength="72" autocomplete="new-password"></label>
        <button class="btn">${t('Сменить пароль')}</button>
        <p class="muted small">${t('После смены пароля другие устройства выйдут из аккаунта.')}</p>
      </form>
      <form class="card stack" data-submit="recovery"><h2>🔑 ${t('Код восстановления')}</h2>
        <p class="muted small">${me.has_recovery ? t('Код уже выдан. Если потеряли его — получите новый, старый перестанет действовать.') : t('У вас ещё нет кода восстановления. Получите его — без него забытый пароль восстановит только администратор.')}</p>
        <label class="field"><span>${t('Текущий пароль')}</span><input type="password" name="pw" required autocomplete="current-password"></label>
        <button class="btn ${me.has_recovery ? '' : 'primary'}">${me.has_recovery ? t('Получить новый код') : t('Получить код')}</button>
      </form>
      ${'admin' in ctx.query ? html`<form class="card stack" data-submit="claim"><h2>${t('Для администратора')}</h2>
          <input name="code" autocomplete="off" placeholder="${t('Код')}" required><button class="btn">${t('Получить права')}</button></form>` : ''}
    </div>`.s;
  UI.bind(view, {
    ava: async (inp) => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      try { avatar = await Img.fit(f, 192, 50000, true); view.querySelector('#ava-prev').innerHTML = C.avatar({ avatar }, 72).s; } catch (e) { UI.toast(t('Картинка не подошла — попробуйте другую.'), 'err'); }
    },
    noava: () => { avatar = ''; view.querySelector('#ava-prev').innerHTML = C.avatar({ login: me.login, name: me.name }, 72).s; },
    save: async (f, fd) => {
      const r = await Api.auth('sauda_profile_save', { p: { name: fd.get('name'), bio: fd.get('bio'), city: fd.get('city'), avatar, lang: I18n.lang } });
      if (!r.ok) return UI.fail(r);
      await App.refresh(true);
      UI.toast(t('Сохранено'));
    },
    lang: (b) => { App.setLang(b.dataset.l); },
    theme: (b) => { App.setTheme(b.dataset.v); view.querySelectorAll('[data-act=theme]').forEach((x) => x.classList.toggle('on', x === b)); },
    notify: (el) => App.setNotify(el.checked).then((on) => { el.checked = on; }),
    pass: async (f, fd) => {
      const r = await Api.auth('sauda_password', { p_old: fd.get('old'), p_new: fd.get('new') });
      if (!r.ok) return UI.fail(r);
      f.reset();
      UI.toast(t('Пароль изменён'));
    },
    recovery: async (f, fd) => {
      const r = await Api.auth('sauda_recovery_new', { p_password: fd.get('pw') });
      if (!r.ok) return UI.fail(r);
      f.reset();
      await App.refresh(true);
      await Recovery.show(r.recovery, false);
      Router.go();
    },
    claim: async (f, fd) => {
      const r = await Api.auth('sauda_admin_claim', { p_code: String(fd.get('code') || '').trim() });
      if (!r.ok) return UI.fail(r);
      await App.refresh(true);
      UI.toast(t('Вы администратор'));
      Router.nav('#/admin');
    },
  });
};

/* ───────────── кошелёк ───────────── */
const Wallet = {
  pay: () => {
    const c = (App.meta && App.meta.config) || {};
    return { phone: c.pay_kaspi_phone || '', name: c.pay_kaspi_name || '', card: c.pay_card || '', link: c.pay_link || '', note: c.pay_note || '' };
  },
  topup(amount, after) {
    const test = App.testMode();
    const pay = Wallet.pay();
    if (!test && !pay.phone && !pay.card && !pay.link) { UI.toast(errText('payments_soon'), 'err'); return; }
    const m = UI.modal({
      title: t('Пополнение баланса'),
      body: html`<form class="stack" data-submit="go">
        ${test ? html`<div class="note warn">🧪 ${t('Тестовый режим: деньги ненастоящие и зачисляются сразу. Настоящие платежи появятся после подключения платёжного шлюза.')}</div>`
          : html`<div class="note">🔴 ${t('Пополнение переводом на Kaspi: вы переводите сумму с кодом заявки, мы проверяем поступление и зачисляем деньги — обычно в течение 30 минут.')}</div>`}
        <label class="field"><span>${t('Сумма, ₸')}</span><input name="amount" inputmode="decimal" required value="${amount || ''}" placeholder="5 000"></label>
        <div class="chips">${[1000, 5000, 10000, 20000, 50000].map((v) => html`<button type="button" class="chip" data-act="preset" data-v="${v}">${Fmt.money(v)}</button>`)}</div>
        ${test ? html`<div class="pay-methods" role="radiogroup" aria-label="${t('Способ оплаты')}">${Object.entries(PAY_METHODS).map(([k, [name, ico]], i) => html`<label class="pm"><input type="radio" name="method" value="${k}" ${i ? '' : 'checked'}><span>${ico} ${name}</span></label>`)}</div>` : ''}
        <button class="btn primary big wide">${test ? t('Пополнить') : t('Получить реквизиты')}</button></form>`,
      on: {
        preset: (b) => { m.q('[name=amount]').value = b.dataset.v; },
        go: (f, fd) => UI.busy(f.querySelector('.btn.primary'), async () => {
          const sum = Fmt.amount(fd.get('amount'));
          if (!sum) return UI.fail({ error: 'bad_amount' });
          const r = await Api.auth('sauda_topup', { p_amount: sum, p_method: fd.get('method') || (pay.link && !pay.phone ? 'link' : 'kaspi') });
          if (!r.ok) return UI.fail(r);
          m.close(true);
          if (r.pending) { Wallet.payInfo(r.topup, r.pay, after); return; }
          await App.refresh(true);
          UI.toast(t('Баланс пополнен на {s}', { s: Fmt.money(sum) }));
          if (after) after(); else if (location.hash.startsWith('#/wallet')) Router.go();
        }),
      },
    });
  },
  /* реквизиты и код заявки: человек переводит деньги и жмёт «Я оплатил», администратор сверяет поступление */
  payInfo(tp, pay, after) {
    pay = pay || Wallet.pay();
    const row = (label, value, mono) => html`<div class="pay-row"><span class="muted small">${label}</span><b class="${mono ? 'mono' : ''}">${value}</b><button type="button" class="btn small ghost" data-act="copy" data-v="${value}">${t('Копировать')}</button></div>`;
    const m = UI.modal({
      title: t('Заявка {code}', { code: tp.code }),
      body: html`<div class="stack">
        <p class="pay-sum">${t('Переведите ровно')} <b>${Fmt.money(tp.amount)}</b></p>
        ${pay.phone ? row(t('Kaspi Gold по номеру') + (pay.name ? ' · ' + pay.name : ''), pay.phone, true) : ''}
        ${pay.card ? row(t('Или на карту'), pay.card, true) : ''}
        ${row(t('Сообщение получателю (обязательно)'), tp.code, true)}
        ${pay.link ? html`<a class="btn primary wide" href="${pay.link}" target="_blank" rel="noopener noreferrer">🔴 ${t('Оплатить по ссылке')}</a>` : ''}
        ${pay.note ? html`<p class="muted small">${pay.note}</p>` : ''}
        <p class="muted small">${t('Без кода в сообщении мы не поймём, чей это перевод. Неоплаченная заявка отменится сама через 2 дня.')}</p>
        ${tp.claimed_at ? html`<div class="note">⏳ ${t('Вы отметили оплату. Проверяем поступление — обычно до 30 минут.')}</div>`
          : html`<button type="button" class="btn primary big wide" data-act="claim">✅ ${t('Я оплатил')}</button>`}
        <button type="button" class="btn ghost wide" data-act="cancel">${t('Отменить заявку')}</button></div>`,
      on: {
        copy: (b) => UI.copy(b.dataset.v),
        claim: (b) => UI.busy(b, async () => {
          const r = await Api.auth('sauda_topup_act', { p_id: tp.id, p_action: 'claim' });
          if (!r.ok) return UI.fail(r);
          m.close(true);
          // деньги ещё не зачислены — окно покупки не открываем снова (иначе человек заплатит второй раз)
          UI.toast(t('Спасибо! Проверяем перевод — обычно до 30 минут. Пришлём уведомление, когда деньги будут на балансе.'));
          if (location.hash.startsWith('#/wallet')) Router.go();
        }),
        cancel: async (b) => {
          if (!(await UI.ask(t('Отменить заявку на пополнение? Если вы уже перевели деньги — не отменяйте, а нажмите «Я оплатил».'), { yes: t('Отменить заявку'), danger: true }))) return;
          const r = await Api.auth('sauda_topup_act', { p_id: tp.id, p_action: 'cancel' });
          if (!r.ok) return UI.fail(r);
          m.close(true);
          if (location.hash.startsWith('#/wallet')) Router.go();
        },
      },
    });
  },
  withdraw() {
    const cfg = App.meta.config;
    const pct = +cfg.withdraw_fee_pct, min = +cfg.min_withdraw;
    const m = UI.modal({
      title: t('Вывод денег'),
      body: html`<form class="stack" data-submit="go">
        ${App.testMode() ? html`<div class="note warn">🧪 ${t('Тестовый режим: заявка создаётся, но настоящие деньги не отправляются.')}</div>` : ''}
        <div class="pay-methods" role="radiogroup" aria-label="${t('Куда вывести')}">${Object.entries(OUT_METHODS).map(([k, [name, ico]], i) => html`<label class="pm"><input type="radio" name="method" value="${k}" ${i ? '' : 'checked'} data-change="method"><span>${ico} ${t(name)}</span></label>`)}</div>
        <label class="field"><span id="det-l">${t('Номер телефона Kaspi')}</span><input name="details" required inputmode="tel" placeholder="+7 7XX XXX XX XX" autocomplete="off"></label>
        <label class="field"><span>${t('Сумма, ₸ (на балансе {s})', { s: Fmt.money(App.me.balance) })}</span><input name="amount" inputmode="decimal" required data-input="calc" placeholder="${Fmt.num(min)}"></label>
        <p class="muted small" id="calc">${t('Минимум {m}. Комиссия {p}%.', { m: Fmt.money(min), p: pct })}</p>
        <button class="btn primary big wide">${t('Создать заявку')}</button>
        <p class="muted small">${t('Заявки обрабатываются вручную в течение 24 часов. Пока заявку не взяли в работу, её можно отменить.')}</p></form>`,
      on: {
        method: (el) => {
          const card = OUT_METHODS[el.value][2] === 'card';
          m.q('#det-l').textContent = card ? t('Номер карты') : t('Номер телефона ({b})', { b: OUT_METHODS[el.value][0] });
          const inp = m.q('[name=details]');
          inp.placeholder = card ? '0000 0000 0000 0000' : '+7 7XX XXX XX XX';
          inp.inputMode = card ? 'numeric' : 'tel';
        },
        calc: (el) => {
          const a = Fmt.amount(el.value) || 0;
          const fee = Math.ceil((a * pct) / 100);
          m.q('#calc').textContent = a ? t('Комиссия {f}, придёт {g}.', { f: Fmt.money(fee), g: Fmt.money(Math.max(0, a - fee)) }) : t('Минимум {m}. Комиссия {p}%.', { m: Fmt.money(min), p: pct });
        },
        go: (f, fd) => UI.busy(f.querySelector('.btn.primary'), async () => {
          const sum = Fmt.amount(fd.get('amount'));
          if (!sum) return UI.fail({ error: 'bad_amount' });
          if (sum > App.me.balance) return UI.fail({ error: 'no_money' });
          const r = await Api.auth('sauda_withdraw', { p_amount: sum, p_method: fd.get('method'), p_details: fd.get('details') });
          if (!r.ok) return UI.fail(r);
          m.close(true);
          await App.refresh(true);
          UI.toast(t('Заявка на вывод создана'));
          Router.go();
        }),
      },
    });
  },
};

Views.wallet = async (view, ctx) => {
  view.innerHTML = C.skeleton(3, 'rows').s;
  const r = await Api.auth('sauda_wallet');
  if (!ctx.alive()) return;
  if (!r.ok) { view.innerHTML = C.empty('📡', errText(r.error)).s; return; }
  const txRow = (x) => {
    const k = TX[x.kind] || [x.kind, '•'];
    const link = ['purchase', 'sale', 'refund'].includes(x.kind) && x.ref ? '#/order/' + x.ref : '';
    return html`<${link ? 'a' : 'div'} class="tx-row" ${link ? raw(`href="${link}"`) : ''}><span class="tx-ico">${k[1]}</span>
      <span class="tx-main"><b>${t(k[0])}</b><span class="muted small">${txNote(x) ? txNote(x) + ' · ' : ''}${Fmt.dt(x.created_at)}</span></span>
      <span class="tx-sum ${x.amount > 0 ? 'plus' : 'minus'}">${x.amount > 0 ? '+' : '−'}${Fmt.money(Math.abs(x.amount))}</span></${link ? 'a' : 'div'}>`;
  };
  const tst = (x) => TOPUP_STATUS[x.status === 'pending' && x.claimed_at ? 'claimed' : x.status] || [x.status, 'muted'];
  const wst = (w) => WD_STATUS[w.status] || [w.status, 'muted'];
  view.innerHTML = html`<div class="page-head"><h1>${t('Кошелёк')}</h1></div>
    ${r.test_mode ? '' : html`<div class="note">🔒 ${t('Деньги за покупку хранятся у Sauda, пока вы не подтвердите получение. Пополнение — переводом на Kaspi, вывод — на Kaspi или карту в течение 24 часов.')}</div>`}
    <div class="wallet-top">
      <div class="card balance-card"><span class="muted">${t('Доступно')}</span><b class="bal">${Fmt.money(r.balance)}</b>
        <div class="row-btns"><button class="btn primary" data-act="topup">💳 ${t('Пополнить')}</button><button class="btn" data-act="withdraw">🏦 ${t('Вывести')}</button></div></div>
      <div class="card mini-stats">
        <div><span class="muted small">${t('Заморожено в продажах')}</span><b>${Fmt.money(r.hold_in)}</b></div>
        <div><span class="muted small">${t('Заморожено в покупках')}</span><b>${Fmt.money(r.hold_out)}</b></div>
        <div><span class="muted small">${t('Заработано всего')}</span><b class="plus">${Fmt.money(r.earned)}</b></div>
        <div><span class="muted small">${t('Потрачено всего')}</span><b>${Fmt.money(r.spent)}</b></div>
      </div>
    </div>
    <form class="card promo" data-submit="promo"><span>🎁 ${t('Промокод')}</span><input name="code" maxlength="24" placeholder="${t('Введите промокод')}" autocapitalize="characters" required><button class="btn">${t('Применить')}</button></form>
    ${(r.topups || []).length ? html`<section class="block"><h2>${t('Пополнения')}</h2><div class="card list">${r.topups.map((x) => html`<div class="tx-row"><span class="tx-ico">💳</span>
      <span class="tx-main"><b>${t('Заявка {code}', { code: x.code })}</b><span class="muted small">${Fmt.dt(x.created_at)}${x.status === 'failed' && x.note ? ' · ' + x.note : ''}</span></span>
      <span class="tx-sum">${Fmt.money(x.amount)} <span class="status status-${tst(x)[1]}">${t(tst(x)[0])}</span>
        ${x.status === 'pending' ? html`<button class="btn small ${x.claimed_at ? 'ghost' : 'primary'}" data-act="paytp" data-id="${x.id}">${x.claimed_at ? t('Реквизиты') : t('Оплатить')}</button>` : ''}</span></div>`)}</div></section>` : ''}
    ${r.withdrawals.length ? html`<section class="block"><h2>${t('Заявки на вывод')}</h2><div class="card list">${r.withdrawals.map((w) => html`<div class="tx-row"><span class="tx-ico">${(OUT_METHODS[w.method] || ['', '🏦'])[1]}</span>
      <span class="tx-main"><b>${t((OUT_METHODS[w.method] || [w.method])[0])} ${w.details}</b><span class="muted small">${Fmt.dt(w.created_at)}${w.note && w.note !== 'test' ? ' · ' + w.note : ''}${w.test ? ' · ' + t('тест') : ''}</span></span>
      <span class="tx-sum">${Fmt.money(w.amount - w.fee)} <span class="status status-${wst(w)[1]}">${t(wst(w)[0])}</span>
        ${w.status === 'pending' ? html`<button class="btn small ghost" data-act="wdcancel" data-id="${w.id}">${t('Отменить')}</button>` : ''}</span></div>`)}</div></section>` : ''}
    <section class="block"><h2>${t('История операций')}</h2><div class="card list" id="tx">${r.tx.length ? r.tx.map(txRow) : html`<p class="muted pad">${t('Операций пока нет.')}</p>`}</div>
      <div class="center"><button class="btn ghost" data-act="more" ${r.tx.length < 50 ? 'hidden' : ''}>${t('Показать ещё')}</button></div></section>`.s;
  let lastId = r.tx.length ? r.tx[r.tx.length - 1].id : null;
  UI.bind(view, {
    topup: () => Wallet.topup(),
    withdraw: () => Wallet.withdraw(),
    paytp: (b) => Wallet.payInfo(r.topups.find((x) => x.id === +b.dataset.id), r.pay),
    wdcancel: async (b) => {
      if (!(await UI.ask(t('Отменить заявку на вывод? Деньги вернутся на баланс.'), { yes: t('Отменить заявку') }))) return;
      const x = await Api.auth('sauda_withdraw_cancel', { p_id: +b.dataset.id });
      if (!x.ok) return UI.fail(x);
      await App.refresh(true);
      UI.toast(t('Заявка отменена, деньги на балансе'));
      Router.go();
    },
    promo: async (f, fd) => {
      const x = await Api.auth('sauda_promo', { p_code: fd.get('code') });
      if (!x.ok) return UI.fail(x);
      UI.toast(t('Начислено {s}!', { s: Fmt.money(x.amount) }));
      await App.refresh(true);
      Router.go();
    },
    more: (b) => UI.busy(b, async () => {
      const x = await Api.auth('sauda_wallet', { p_before: lastId });
      if (!x.ok) return UI.fail(x);
      view.querySelector('#tx').insertAdjacentHTML('beforeend', x.tx.map((y) => txRow(y).s).join(''));
      if (x.tx.length) lastId = x.tx[x.tx.length - 1].id;
      if (x.tx.length < 50) b.hidden = true;
    }),
  });
};

/* ───────────── продать: создать или изменить лот ───────────── */
const DELIVERY = [[5, 'до 5 минут'], [15, 'до 15 минут'], [30, 'до 30 минут'], [60, 'до 1 часа'], [180, 'до 3 часов'], [720, 'до 12 часов'], [1440, 'до 1 дня'], [4320, 'до 3 дней'], [10080, 'до 7 дней'], [20160, 'до 14 дней']];
const PERIODS = [7, 30, 90, 180, 365];

Views.sell = async (view, ctx) => {
  const editId = ctx.params.id ? +ctx.params.id : null;
  let lot = null;
  if (editId) {
    view.innerHTML = C.skeleton(2, 'rows').s;
    const r = await Api.call('sauda_lot', { p_token: Api.token, p_id: editId });
    if (!ctx.alive()) return;
    if (!r.ok || !r.mine) { view.innerHTML = C.empty('🤷', errText(r.ok ? 'forbidden' : r.error)).s; return; }
    lot = r.lot;
  }
  const st = {
    game: lot ? lot.game : ctx.query.game || '',
    section: lot ? lot.section : ctx.query.section || '',
    images: lot ? (lot.images || []).slice() : [],
    thumb: lot ? lot.thumb : '',
    attrs: lot ? Object.entries(lot.attrs || {}) : [],
  };
  const fee = +(App.me && App.me.fee_pct !== undefined ? App.me.fee_pct : App.me && App.me.pro ? App.cfg('pro_fee_pct') : App.cfg('fee_pct'));
  const games = App.meta.games;
  const v = (k, d) => (lot && lot[k] !== null && lot[k] !== undefined ? lot[k] : d);

  view.innerHTML = html`<div class="page-head"><h1>${editId ? t('Изменить лот #{id}', { id: editId }) : t('Новый лот')}</h1></div>
    <div class="sell-page">
      <form class="stack sell-form" data-submit="save" id="sf" novalidate>
        <div class="card stack"><h2>1. ${t('Что продаёте')}</h2>
          <label class="field"><span>${t('Игра или сервис')}</span><select name="game" data-change="game" required><option value="">${t('Выберите…')}</option>${KINDS.map((k) => html`<optgroup label="${t(k.ru)}">${games.filter((g) => g.kind === k.id).map((g) => html`<option value="${g.id}" ${g.id === st.game ? 'selected' : ''}>${g.emoji} ${g.name}</option>`)}</optgroup>`)}</select></label>
          <div class="field"><span>${t('Раздел')}</span><div class="chips" id="secs" role="radiogroup"></div></div>
        </div>
        <div class="card stack"><h2>2. ${t('Описание')}</h2>
          <label class="field"><span>${t('Название')} <small class="muted" id="tl-c"></small></span><input name="title" required minlength="3" maxlength="120" value="${v('title', '')}" placeholder="${t('Например: 660 UC по ID — зачисление за 5 минут')}" data-input="preview"></label>
          <label class="field"><span>${t('Подробности')}</span><textarea name="descr" rows="6" maxlength="5000" placeholder="${t('Что получит покупатель, как проходит выдача, гарантии, сроки')}">${v('descr', '')}</textarea></label>
          <div class="field"><span>${t('Характеристики')} <small class="muted">${t('(сервер, уровень, регион…)')}</small></span><div id="attrs" class="attrs-edit"></div><button type="button" class="btn ghost small" data-act="addAttr">+ ${t('Добавить')}</button></div>
          <div class="field"><span>${t('Фото')} <small class="muted">${t('до 5, первое — обложка')}</small></span><div class="pics" id="pics"></div></div>
        </div>
        <div class="card stack"><h2>3. ${t('Цена и выдача')}</h2>
          <div class="grid2">
            <label class="field"><span>${t('Цена, ₸')}</span><input name="price" inputmode="numeric" required value="${v('price', '')}" data-input="preview" placeholder="1 990"></label>
            <label class="field"><span>${t('Старая цена (для скидки)')}</span><input name="old_price" inputmode="numeric" value="${v('old_price', '')}" data-input="preview" placeholder="${t('необязательно')}"></label>
          </div>
          <p class="muted small" id="net"></p>
          <div class="note small goods-only" hidden>📦 ${t('Вещь с доставкой: договоритесь с покупателем в чате, отправьте и отметьте «Выполнено» с трек-номером. Деньги придут, когда покупатель подтвердит получение, или сами через 14 дней.')}</div>
          <div class="seg digital-only" role="radiogroup" aria-label="${t('Способ выдачи')}">
            <label><input type="radio" name="auto" value="0" ${v('auto', false) ? '' : 'checked'} data-change="mode"> ✋ ${t('Выдаю сам')}</label>
            <label><input type="radio" name="auto" value="1" ${v('auto', false) ? 'checked' : ''} data-change="mode"> ⚡ ${t('Автовыдача')}</label>
          </div>
          <div id="manual" class="stack">
            <div class="grid2">
              <label class="field"><span>${t('Количество')}</span><input name="qty" inputmode="numeric" value="${v('qty', '')}" placeholder="${t('пусто — без лимита')}"></label>
              <label class="field"><span>${t('Срок выполнения')}</span><select name="deliver_mins">${DELIVERY.map(([m, l]) => html`<option value="${m}" ${v('deliver_mins', 60) === m ? 'selected' : ''}>${t(l)}</option>`)}</select></label>
            </div>
          </div>
          <div id="auto" class="stack">
            <label class="field"><span>${t('Товары — по одному на строку')} <small class="muted" id="it-c"></small></span><textarea name="items" rows="5" class="mono" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" placeholder="${t('КОД-1234-5678\nlogin:password\nhttps://ссылка-на-подарок')}" data-input="items"></textarea></label>
            ${editId && lot.auto ? html`<p class="muted small">${t('Сейчас в наличии: {n}. Новые строки добавятся к ним.', { n: lot.qty || 0 })} <button type="button" class="link" data-act="manage">${t('Посмотреть и удалить')}</button></p>` : ''}
            <p class="muted small">${t('Покупатель получит товар сразу после оплаты, даже ночью. Каждая строка продаётся один раз.')}</p>
          </div>
          <label class="check"><input type="checkbox" name="needs_id" ${v('needs_id', false) ? 'checked' : ''} data-change="needs"> 🆔 <span class="digital-only">${t('Покупатель указывает данные (ID игрока, почту, ник)')}</span><span class="goods-only" hidden>${t('Спросить у покупателя адрес доставки и телефон')}</span></label>
          <label class="field" id="idl" hidden><span>${t('Что указать покупателю')}</span><input name="id_label" maxlength="40" value="${v('id_label', '')}" placeholder="${t('Например: Player ID PUBG Mobile')}"></label>
          <label class="check digital-only"><input type="checkbox" name="is_sub" ${v('period_days', null) ? 'checked' : ''} data-change="sub"> 🔁 ${t('Это подписка — покупатель может включить автопродление')}</label>
          <label class="field" id="per" hidden><span>${t('Срок подписки')}</span><select name="period_days">${PERIODS.map((d) => html`<option value="${d}" ${v('period_days', 30) === d ? 'selected' : ''}>${tp(d, 'день|дня|дней')}</option>`)}</select></label>
          <label class="field" id="city" hidden><span>${t('Город (для вещей)')}</span><select name="city"><option value="">${t('Вся страна / доставка')}</option>${CITIES.map((c) => html`<option ${v('city', '') === c ? 'selected' : ''}>${c}</option>`)}</select></label>
        </div>
        <div class="sticky-save"><button class="btn primary big wide" id="save-btn">${editId ? t('Сохранить изменения') : t('Опубликовать лот')}</button></div>
      </form>
      <aside class="sell-side"><h3>${t('Так увидят покупатели')}</h3><div id="pv"></div>
        <div class="card tips"><h3>💡 ${t('Советы')}</h3><ul>
          <li>${t('Пишите в названии главное: количество, регион, срок.')}</li>
          <li>${t('Автовыдача продаёт, пока вы спите, и поднимает доверие.')}</li>
          <li>${t('Не просите покупателя платить мимо Sauda — так вы теряете защиту и аккаунт.')}</li>
          <li>${t('Поднимайте лоты в «Мои лоты», чтобы они были выше.')}</li></ul></div>
      </aside>
    </div>`.s;

  const form = view.querySelector('#sf');
  const num = (x) => Fmt.amount(x);
  function secs() {
    const g = App.meta.byId[st.game];
    const box = view.querySelector('#secs');
    if (!g) { box.innerHTML = html`<span class="muted small">${t('Сначала выберите игру')}</span>`.s; return; }
    if (!g.sections.some((s) => s.id === st.section)) st.section = g.sections[0].id;
    box.innerHTML = g.sections.map((s) => html`<button type="button" role="radio" aria-checked="${s.id === st.section}" class="chip ${s.id === st.section ? 'on' : ''}" data-act="sec" data-s="${s.id}">${I18n.lang === 'kz' ? s.kz : s.ru}</button>`.s).join('');
    // вещи с доставкой: без автовыдачи и подписок, с пояснением про 14 дней
    const goods = g.kind === 'goods';
    view.querySelector('#city').hidden = !goods;
    view.querySelectorAll('.goods-only').forEach((x) => { x.hidden = !goods; });
    view.querySelectorAll('.digital-only').forEach((x) => { x.hidden = goods; });
    if (goods) {
      const manual = view.querySelector('input[name=auto][value="0"]');
      if (manual && !manual.checked) { manual.checked = true; mode(); }
      const sub = view.querySelector('[name=is_sub]');
      if (sub && sub.checked) { sub.checked = false; view.querySelector('#per').hidden = true; }
      const idl = view.querySelector('[name=id_label]');
      if (idl && !idl.value) idl.value = t('Адрес доставки и телефон');
    }
  }
  function attrsUi() {
    view.querySelector('#attrs').innerHTML = st.attrs.map(([k, val], i) => html`<div class="attr-row"><input data-i="${i}" data-k="k" maxlength="30" value="${k}" placeholder="${t('Название')}" data-input="attr"><input data-i="${i}" data-k="v" maxlength="60" value="${val}" placeholder="${t('Значение')}" data-input="attr"><button type="button" class="icon-btn" data-act="delAttr" data-i="${i}" aria-label="${t('Удалить')}">✕</button></div>`.s).join('');
  }
  function pics() {
    view.querySelector('#pics').innerHTML = html`${st.images.map((im, i) => html`<div class="pic"><img src="${im}" alt=""><button type="button" class="icon-btn" data-act="delPic" data-i="${i}" aria-label="${t('Удалить')}">✕</button>${i ? '' : html`<span class="pic-main">${t('обложка')}</span>`}</div>`)}
      ${st.images.length < 5 ? html`<label class="pic add">＋<span>${t('Фото')}</span><input type="file" accept="image/*" multiple hidden data-change="addPic"></label>` : ''}`.s;
  }
  function mode() {
    const auto = form.auto.value === '1';
    view.querySelector('#manual').hidden = auto;
    view.querySelector('#auto').hidden = !auto;
  }
  function preview() {
    const price = num(form.price.value) || 0;
    const tl = form.title.value.trim();
    view.querySelector('#tl-c').textContent = tl.length + '/120';
    view.querySelector('#net').textContent = price ? t('Вы получите {s} после комиссии {f}%.', { s: Fmt.money(price - Math.round((price * fee) / 100)), f: fee }) : '';
    const l = { id: 0, game: st.game || 'standoff2', section: st.section, title: tl || t('Название лота'), price, old_price: num(form.old_price.value), thumb: st.thumb, auto: form.auto.value === '1', period_days: form.is_sub.checked ? +form.period_days.value : null, seller: App.me, status: 'active', attrs: {} };
    view.querySelector('#pv').innerHTML = C.lotCard(l).s.replace('href="#/lot/0"', '');
  }
  secs(); attrsUi(); pics(); mode(); preview();
  view.querySelector('#idl').hidden = !form.needs_id.checked;
  view.querySelector('#per').hidden = !form.is_sub.checked;

  UI.bind(view, {
    game: (el) => { st.game = el.value; secs(); preview(); },
    sec: (b) => { st.section = b.dataset.s; secs(); preview(); },
    preview,
    mode: () => { mode(); preview(); },
    needs: (el) => { view.querySelector('#idl').hidden = !el.checked; },
    sub: (el) => { view.querySelector('#per').hidden = !el.checked; preview(); },
    items: (el) => { const n = el.value.split('\n').filter((x) => x.trim()).length; view.querySelector('#it-c').textContent = n ? t('+{n} шт.', { n }) : ''; },
    addAttr: () => { if (st.attrs.length < 10) { st.attrs.push(['', '']); attrsUi(); } },
    delAttr: (b) => { st.attrs.splice(+b.dataset.i, 1); attrsUi(); },
    attr: (el) => { st.attrs[+el.dataset.i][el.dataset.k === 'k' ? 0 : 1] = el.value; },
    addPic: async (inp) => {
      const files = Array.from(inp.files || []).slice(0, 5 - st.images.length);
      inp.value = '';
      for (const f of files) {
        try {
          st.images.push(await Img.fit(f, 1280, 340000));
          if (st.images.length === 1) st.thumb = await Img.fit(f, 480, 40000);
        } catch (e) { UI.toast(t('Картинка не подошла — попробуйте другую.'), 'err'); }
      }
      pics(); preview();
    },
    delPic: async (b) => {
      const i = +b.dataset.i;
      st.images.splice(i, 1);
      if (i === 0) st.thumb = st.images[0] ? await Img.fit(await (await fetch(st.images[0])).blob(), 480, 40000).catch(() => '') : '';
      pics(); preview();
    },
    manage: () => Sell.items(editId),
    save: (f) => UI.busy(view.querySelector('#save-btn'), async () => {
      const fd = new FormData(f);
      if (!st.game || !st.section) return UI.toast(t('Выберите игру и раздел'), 'err');
      const auto = fd.get('auto') === '1';
      const items = auto ? String(fd.get('items') || '').split('\n').map((x) => x.trim()).filter(Boolean) : [];
      if (auto && !items.length && !(lot && lot.auto && lot.qty)) return UI.toast(t('Добавьте хотя бы один товар для автовыдачи'), 'err');
      const attrs = {};
      st.attrs.forEach(([k, val]) => { if (k.trim() && val.trim()) attrs[k.trim().slice(0, 30)] = val.trim().slice(0, 60); });
      const p = {
        id: editId, game: st.game, section: st.section, title: fd.get('title'), descr: fd.get('descr'),
        price: num(fd.get('price')), old_price: num(fd.get('old_price')), auto, items_add: items,
        qty: auto ? null : num(fd.get('qty')), deliver_mins: auto ? 1 : +fd.get('deliver_mins'),
        needs_id: !!fd.get('needs_id'), id_label: fd.get('needs_id') ? fd.get('id_label') : '',
        period_days: fd.get('is_sub') ? +fd.get('period_days') : null,
        city: App.meta.byId[st.game].kind === 'goods' ? fd.get('city') || '' : '',
        thumb: st.thumb, images: st.images, attrs,
      };
      const r = await Api.auth('sauda_lot_save', { p });
      if (!r.ok) return UI.fail(r);
      UI.toast(editId ? t('Лот сохранён') : t('Лот опубликован!'));
      App.loadMeta(true);
      Router.nav('#/lot/' + r.id);
    }),
  });
  if (editId && ctx.query.items === '1') Sell.items(editId);
};

const Sell = {
  async items(id) {
    const r = await Api.auth('sauda_lot_items', { p_id: id });
    if (!r.ok) return UI.fail(r);
    const m = UI.modal({
      title: t('Товары для автовыдачи'), wide: true,
      body: html`${r.items.length ? html`<p class="muted small">${t('В наличии: {n}. Отметьте лишние и удалите.', { n: r.items.length })}</p>
        <div class="items-list">${r.items.map((x) => html`<label class="check mono"><input type="checkbox" value="${x.id}"> ${x.payload}</label>`)}</div>
        <div class="modal-actions"><button class="btn ghost" data-act="close">${t('Закрыть')}</button><button class="btn danger" data-act="del">${t('Удалить отмеченные')}</button></div>`
        : html`<p class="muted">${t('Товаров нет — добавьте строки в форме лота.')}</p>`}`,
      on: {
        del: async () => {
          const ids = Array.from(m.el.querySelectorAll('input:checked')).map((x) => +x.value);
          if (!ids.length) return;
          const x = await Api.auth('sauda_lot_items_del', { p_id: id, p_ids: ids });
          if (!x.ok) return UI.fail(x);
          m.close();
          UI.toast(t('Удалено. Осталось {n}.', { n: x.left }));
        },
      },
    });
  },
};

/* ───────────── мои лоты ───────────── */
Views.myLots = async (view, ctx) => {
  view.innerHTML = C.skeleton(4, 'rows').s;
  const r = await Api.auth('sauda_my_lots');
  if (!ctx.alive()) return;
  if (!r.ok) { view.innerHTML = C.empty('📡', errText(r.error)).s; return; }
  const groups = {};
  r.lots.forEach((l) => { const k = l.game + '/' + l.section; (groups[k] = groups[k] || []).push(l); });
  const raiseAt = {};
  r.raises.forEach((x) => { raiseAt[x.game + '/' + x.section] = x.next_at; });
  view.innerHTML = html`<div class="page-head"><h1>${t('Мои лоты')}</h1><a class="btn primary" href="#/sell">+ ${t('Новый лот')}</a></div>
    ${r.lots.length ? Object.keys(groups).map((k) => {
      const [gid, sid] = k.split('/');
      const g = C.game(gid);
      const wait = raiseAt[k] && new Date(raiseAt[k]) > new Date();
      return html`<section class="card my-group"><div class="block-head"><h3><a href="#/g/${gid}/${sid}">${C.gicon(g)} ${g.name} · ${C.section(gid, sid)}</a></h3>
        <button class="btn small ${wait ? 'ghost' : ''}" data-act="raise" data-g="${gid}" data-s="${sid}" ${wait ? 'disabled' : ''}>⬆️ ${wait ? t('Поднять через {t}', { t: Fmt.left(raiseAt[k]) }) : t('Поднять')}</button></div>
        ${groups[k].map((l) => html`<div class="my-lot">
          <a class="ml-main" href="#/lot/${l.id}"><b>${l.title}</b><span class="muted small">${Fmt.money(l.price)} · ${l.qty === null ? '∞' : t('{n} шт.', { n: l.qty })} · 👁 ${l.views} · ${t('продано {n}', { n: l.sold })}${l.auto ? ' · ⚡' : ''}</span></a>
          <span class="lot-st st-${l.status}">${t(LOT_STATUS[l.status])}</span>
          <span class="ml-btns">
            <a class="icon-btn" href="#/sell/${l.id}" title="${t('Изменить')}" aria-label="${t('Изменить')}">✏️</a>
            ${l.status === 'active' ? html`<button class="icon-btn" data-act="set" data-id="${l.id}" data-s="paused" title="${t('Пауза')}" aria-label="${t('Пауза')}">⏸</button>` : ''}
            ${l.status === 'paused' || l.status === 'sold' ? html`<button class="icon-btn" data-act="set" data-id="${l.id}" data-s="active" title="${t('Включить')}" aria-label="${t('Включить')}">▶️</button>` : ''}
            ${l.status !== 'blocked' ? html`<button class="icon-btn" data-act="del" data-id="${l.id}" title="${t('Удалить')}" aria-label="${t('Удалить')}">🗑</button>` : ''}
          </span></div>`)}</section>`;
    }) : C.empty('📋', t('У вас пока нет лотов'), html`<a class="btn primary" href="#/sell">${t('Выставить первый лот')}</a>`)}
    <p class="muted small center">${t('Поднятие ставит все активные лоты раздела наверх списка. Перерыв: {m} мин.', { m: r.cooldown })}</p>`.s;
  UI.bind(view, {
    raise: (b) => UI.busy(b, async () => {
      const x = await Api.auth('sauda_raise', { p_game: b.dataset.g, p_section: b.dataset.s });
      if (x.ok) { UI.toast(t('Подняли: {n}', { n: tp(x.raised, 'лот|лота|лотов') })); Router.go(); } else if (x.error === 'raise_wait') UI.toast(t('Поднять снова можно через {t}', { t: Fmt.left(x.next_at) }), 'info'); else UI.fail(x);
    }),
    set: (b) => UI.busy(b, async () => { const x = await Api.auth('sauda_lot_set', { p_id: +b.dataset.id, p_status: b.dataset.s }); if (x.ok) Router.go(); else UI.fail(x); }),
    del: async (b) => {
      if (!(await UI.ask(t('Удалить лот? Товары для автовыдачи тоже удалятся.'), { danger: true, yes: t('Удалить') }))) return;
      const x = await Api.auth('sauda_lot_set', { p_id: +b.dataset.id, p_status: 'deleted' });
      if (x.ok) Router.go(); else UI.fail(x);
    },
  });
};

/* ───────────── избранное, уведомления, подписки ───────────── */
/* пометка операции: код способа оплаты — понятным названием, «3 мес.» — на языке сайта */
const txNote = (x) => {
  if (!x.note) return '';
  if (['topup', 'withdraw'].includes(x.kind)) return (PAY_METHODS[x.note] || OUT_METHODS[x.note] || [x.note])[0];
  if (x.kind === 'pro' && /^[0-9]+ мес\.$/.test(x.note)) return t('{m} мес.', { m: parseInt(x.note, 10) });
  return x.note;
};

Views.favs = async (view, ctx) => {
  view.innerHTML = html`<div class="page-head"><h1>❤️ ${t('Избранное')}</h1></div><div id="l">${C.skeleton(4)}</div>`.s;
  const r = await Api.auth('sauda_favs');
  if (!ctx.alive()) return;
  view.querySelector('#l').innerHTML = (!r.ok ? C.empty('📡', errText(r.error)) : C.lots(r.items) || C.empty('🤍', t('Здесь будут лоты, которые вы отметили сердечком'), html`<a class="btn primary" href="#/catalog">${t('В каталог')}</a>`)).s;
};

Views.notifs = async (view, ctx) => {
  view.innerHTML = html`<div class="page-head"><h1>🔔 ${t('Уведомления')}</h1></div><div id="l" class="card list">${C.skeleton(4, 'rows')}</div>`.s;
  const r = await Api.auth('sauda_notifs');
  if (!ctx.alive()) return;
  App.refresh();
  view.querySelector('#l').innerHTML = (!r.ok ? C.empty('📡', errText(r.error)) : r.items.length ? html`${r.items.map((n) => { const x = C.notifText(n); return html`<a class="notif ${n.read ? '' : 'new'}" href="${n.link || '#/'}"><span class="tx-ico">${x.icon}</span><span class="tx-main"><span>${x.text}</span><span class="muted small">${Fmt.ago(n.created_at)}</span></span></a>`; })}` : C.empty('🔕', t('Уведомлений пока нет'))).s;
};

Views.subs = async (view, ctx) => {
  view.innerHTML = html`<div class="page-head"><h1>🔁 ${t('Подписки')}</h1></div><div id="l">${C.skeleton(2, 'rows')}</div>`.s;
  const r = await Api.auth('sauda_subs');
  if (!ctx.alive()) return;
  if (!r.ok) { view.querySelector('#l').innerHTML = C.empty('📡', errText(r.error)).s; return; }
  view.querySelector('#l').innerHTML = (r.items.length ? html`<div class="sub-list">${r.items.map((s) => html`<div class="card sub-item">
      <a href="#/lot/${s.lot.id}" class="si-main"><b>${s.lot.title}</b><span class="muted small">${C.game(s.lot.game).name} · ${Fmt.money(s.lot.price)} / ${tp(s.lot.period_days || 30, 'день|дня|дней')} · ${s.lot.seller.name}</span></a>
      <div class="si-side">${s.active ? html`<span class="status status-ok">${t('Включено')}</span><span class="muted small">${t('Следующее продление {d}', { d: Fmt.date(s.next_at) })}</span>` : html`<span class="status status-muted">${t('Выключено')}</span>`}
        <button class="btn small ${s.active ? 'ghost' : 'primary'}" data-act="toggle" data-id="${s.id}" data-on="${s.active ? '0' : '1'}">${s.active ? t('Отключить') : t('Включить')}</button></div></div>`)}</div>
    <p class="muted small">${t('Продление списывает цену лота с баланса и создаёт новый заказ через гаранта. Если денег не хватит, попробуем ещё 2 дня и выключим.')}</p>`
    : C.empty('🔁', t('Подписок с автопродлением пока нет. Включите его при покупке подписки.'), html`<a class="btn primary" href="#/catalog?kind=subs">${t('Подписки в каталоге')}</a>`)).s;
  UI.bind(view, {
    toggle: (b) => UI.busy(b, async () => {
      const x = await Api.auth('sauda_sub_set', { p_id: +b.dataset.id, p_active: b.dataset.on === '1' });
      if (x.ok) Router.go(); else UI.fail(x);
    }),
  });
};

/* ───────────── Sauda Pro ───────────── */
Views.pro = async (view) => {
  const c = App.meta.config;
  const prices = c.pro_prices || {};
  const me = App.me;
  view.innerHTML = html`<div class="pro-hero"><div class="pro-crown">👑</div><h1>Sauda Pro</h1><p>${t('Для тех, кто продаёт всерьёз: меньше комиссия, лоты выше, поднятие чаще.')}</p>
      ${me && me.pro ? html`<div class="note">${t('У вас Pro до {d}. Продление добавит дни к сроку.', { d: Fmt.date(me.pro_until) })}</div>` : ''}</div>
    <div class="card compare"><table><thead><tr><th></th><th>${t('Обычный')}</th><th class="pro-col">Pro</th></tr></thead><tbody>
      <tr><td>${t('Комиссия с продажи')}</td><td>${c.fee_pct}%</td><td class="pro-col"><b>${c.pro_fee_pct}%</b></td></tr>
      <tr><td>${t('Поднятие лотов')}</td><td>${t('раз в {m} мин', { m: c.raise_min })}</td><td class="pro-col"><b>${t('раз в {m} мин', { m: c.raise_min_pro })}</b></td></tr>
      <tr><td>${t('Лотов одновременно')}</td><td>${c.max_lots}</td><td class="pro-col"><b>${c.max_lots_pro}</b></td></tr>
      <tr><td>${t('Место в выдаче')}</td><td>${t('обычное')}</td><td class="pro-col"><b>${t('выше обычных')}</b></td></tr>
      <tr><td>${t('Значок PRO у имени')}</td><td>—</td><td class="pro-col">✔</td></tr>
    </tbody></table></div>
    <div class="plans">${[['1', t('1 месяц')], ['3', t('3 месяца')], ['12', t('12 месяцев')]].filter(([k]) => prices[k]).map(([k, l]) => html`<div class="card plan ${k === '3' ? 'best' : ''}">
      ${k === '3' ? html`<span class="plan-tag">${t('Выгодно')}</span>` : ''}<h3>${l}</h3><b class="plan-price">${Fmt.money(prices[k])}</b>
      <span class="muted small">${t('{s} в месяц', { s: Fmt.money(Math.round(prices[k] / +k)) })}</span>
      <button class="btn ${k === '3' ? 'primary' : ''} wide" data-act="buy" data-m="${k}">${t('Подключить')}</button></div>`)}</div>
    <p class="muted small center">${t('Оплата с баланса Sauda. Pro не продлевается сам.')}</p>`.s;
  UI.bind(view, {
    buy: async (b) => {
      if (!Api.token) return App.needAuth();
      const months = b.dataset.m;
      const price = prices[months];
      if (App.me.balance < price) { UI.toast(t('Не хватает {s} на балансе', { s: Fmt.money(price - App.me.balance) }), 'err'); return Wallet.topup(Math.max(price - App.me.balance, 100)); }
      if (!(await UI.ask(t('Подключить Sauda Pro на {m} мес. за {s}?', { m: months, s: Fmt.money(price) }), { yes: t('Подключить') }))) return;
      const r = await Api.auth('sauda_pro', { p_months: +months });
      if (!r.ok) return UI.fail(r);
      await App.refresh(true);
      UI.toast(t('Sauda Pro подключён до {d}', { d: Fmt.date(r.pro_until) }));
      Router.go();
    },
  });
};

/* ───────────── приглашения ───────────── */
Views.ref = async (view, ctx) => {
  const r = await Api.auth('sauda_ref');
  if (!ctx.alive()) return;
  if (!r.ok) { view.innerHTML = C.empty('📡', errText(r.error)).s; return; }
  const link = siteUrl('?ref=' + r.code);
  view.innerHTML = html`<div class="page-head"><h1>🤝 ${t('Пригласить друзей')}</h1></div>
    <div class="card stack ref-card"><p>${t('Друзья регистрируются по вашей ссылке — вы получаете {p}% комиссии Sauda с каждой их сделки. Навсегда.', { p: r.pct })}</p>
      <div class="copy-line"><input readonly value="${link}" aria-label="${t('Ваша ссылка')}"><button class="btn primary" data-act="copy">${t('Копировать')}</button></div>
      ${navigator.share ? html`<button class="btn" data-act="share">📤 ${t('Поделиться')}</button>` : ''}</div>
    <div class="stat-row"><div><b>${r.invited.length}</b><span>${t('приглашено')}</span></div><div><b>${Fmt.money(r.earned)}</b><span>${t('заработано')}</span></div></div>
    ${r.invited.length ? html`<div class="card list">${r.invited.map((x) => html`<a class="tx-row" href="#/u/${x.login}">${C.avatar(x, 32)}<span class="tx-main"><b>${x.name}</b><span class="muted small">${t('с {d}', { d: Fmt.date(x.since) })} · ${tp(x.sales, 'продажа|продажи|продаж')} · ${tp(x.purchases, 'покупка|покупки|покупок')}</span></span></a>`)}</div>` : ''}`.s;
  UI.bind(view, {
    copy: () => UI.copy(link),
    share: () => navigator.share({ title: 'Sauda', text: t('Маркетплейс игровых ценностей и подписок с гарантом'), url: link }).catch(() => {}),
  });
};

/* ───────────── статистика продавца ───────────── */
const Chart = {
  bars(days, key) {
    const W = 600, H = 160, pad = 4;
    const max = Math.max(1, ...days.map((d) => d[key]));
    const bw = W / days.length;
    return html`<svg class="chart" viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="${t('График по дням')}">
      ${days.map((d, i) => { const h = Math.round((d[key] / max) * (H - 10)); return html`<g><rect x="${i * bw + pad / 2}" y="${H - h}" width="${bw - pad}" height="${Math.max(h, 1)}" rx="3" class="${d[key] ? 'bar' : 'bar zero'}"><title>${Fmt.short(d.d)}: ${key === 'sum' ? Fmt.money(d[key]) : d[key]}</title></rect></g>`; })}
      <text x="0" y="${H + 14}" class="axis">${Fmt.short(days[0].d)}</text><text x="${W}" y="${H + 14}" text-anchor="end" class="axis">${Fmt.short(days[days.length - 1].d)}</text>
    </svg>`;
  },
};

Views.stats = async (view, ctx) => {
  view.innerHTML = C.skeleton(3, 'rows').s;
  const r = await Api.auth('sauda_stats');
  if (!ctx.alive()) return;
  if (!r.ok) { view.innerHTML = C.empty('📡', errText(r.error)).s; return; }
  const kpi = (v, l) => html`<div class="card kpi"><b>${v}</b><span>${l}</span></div>`;
  view.innerHTML = html`<div class="page-head"><h1>📊 ${t('Статистика продаж')}</h1></div>
    <div class="kpis">${kpi(Fmt.money(r.revenue_30), t('выручка за 30 дней'))}${kpi(Fmt.money(r.revenue), t('выручка всего'))}${kpi(Fmt.money(r.pending), t('в заказах сейчас'))}
      ${kpi(r.completed, t('успешных сделок'))}${kpi(r.reviews ? '★ ' + (+r.rating).toFixed(2) : '—', tp(r.reviews, 'отзыв|отзыва|отзывов'))}${kpi(r.refunded, t('возвратов'))}
      ${kpi(r.lots_active, t('активных лотов'))}${kpi(Fmt.num(r.views), t('просмотров лотов'))}${kpi(r.fee_pct + '%', t('ваша комиссия'))}</div>
    <div class="card"><h2>${t('Выручка по дням')}</h2>${Chart.bars(r.days, 'sum')}</div>
    <div class="card"><h2>${t('Лучшие лоты')}</h2>${r.top.length ? html`<div class="list">${r.top.map((x) => html`<a class="tx-row" href="#/lot/${x.id}"><span class="tx-main"><b>${x.title}</b><span class="muted small">${Fmt.money(x.price)} · 👁 ${x.views}</span></span><span class="tx-sum">${t('продано {n}', { n: x.sold })}</span></a>`)}</div>` : html`<p class="muted">${t('Пока нет продаж.')}</p>`}</div>`.s;
};

/* ───────────── помощь и правила ───────────── */
/* карточка уровня: прогресс до следующего и что он даёт */
Views.levelCard = (me) => {
  const pg = Level.progress(+me.xp || 0);
  return html`<a class="card level-card" href="#/help?s=levels">
    <div class="lv-top"><span class="lv-ico" aria-hidden="true">${Level.icon(pg.level)}</span>
      <span class="lv-main"><b>${t('Уровень {n} · {name}', { n: pg.level, name: Level.name(pg.level) })}</b>
        <span class="muted small">${pg.next ? t('До «{name}» — сделки ещё на {s}', { name: Level.name(pg.level + 1), s: Fmt.money((pg.next.xp - (+me.xp || 0)) * 100) }) : t('Максимальный уровень!')}</span></span>
      <span class="mi-arrow">›</span></div>
    <div class="lv-bar" role="progressbar" aria-valuenow="${pg.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pg.pct}%"></i></div>
    <div class="lv-perks"><span>💰 ${t('Комиссия с продаж: {p}%', { p: Level.pct(me.fee_pct) })}</span><span>🎁 ${t('Кешбэк с покупок: {p}%', { p: Level.pct(me.cashback_pct || 0) })}</span></div></a>`;
};

/* ───────────── помощь ───────────── */
// частые вопросы: страница «Помощь» и быстрые ответы в чате поддержки
const FAQ = [
  ['buy', 'Как купить?', 'Пополните баланс (Kaspi, Halyk, карта), откройте лот и нажмите «Купить». Деньги спишутся с баланса и будут заморожены до выполнения заказа. Если продавец просит данные (ID игрока, почту) — укажите их в форме покупки.'],
  ['escrow', 'Что такое гарант?', 'Продавец получает деньги только после того, как вы подтвердите получение. Если вы ничего не сделали, заказ подтверждается сам через {h} ч после выполнения (для автовыдачи — через {ha} ч). До этого можно открыть спор.'],
  ['auto', 'Что такое автовыдача?', 'Продавец заранее загружает коды, ключи или данные аккаунтов. После оплаты одна строка сразу выдаётся вам — в заказе и в чате, в любое время суток.'],
  ['dispute', 'Что делать, если товар не пришёл или не работает?', 'Не подтверждайте заказ. Напишите продавцу в чат заказа. Если не договорились — нажмите «Открыть спор»: деньги останутся замороженными, администратор изучит переписку и вернёт деньги или переведёт продавцу. Если продавец не выполнил заказ в срок, заказ можно отменить самому.'],
  ['fee', 'Сколько стоит?', 'Покупателю — бесплатно, он платит цену лота. Продавец платит комиссию {fee}% только с успешной сделки (с Sauda Pro — {pro}%). Вывод — {w}%, минимум {min}.'],
  ['levels', 'Что такое уровни Sauda?', 'Каждая завершённая сделка даёт опыт и покупателю, и продавцу: 1 очко за каждые 100 ₸. Уровни: 🌱 Новичок → 🎮 Игрок (сделки на 10 000 ₸) → ⚡ Профи (50 000 ₸) → 💎 Мастер (200 000 ₸) → 👑 Легенда (1 000 000 ₸). С каждым уровнем комиссия продавца ниже на 0,5 % (до −2 %, но не ниже, чем с Pro), а покупатель получает кешбэк на баланс: от 0,5 % до 2 % с каждой покупки. Уровень виден рядом с именем — по нему покупатели узнают опытных продавцов.'],
  ['goods', 'Как покупать вещи с доставкой?', 'Договоритесь с продавцом в чате о способе: Казпочта, CDEK, курьер или встреча. Отправив вещь, продавец отмечает заказ выполненным и пишет трек-номер. Деньги остаются у Sauda, пока вы не подтвердите получение; если вы не подтвердите и не откроете спор, заказ закроется сам только через 14 дней — посылка успеет дойти. Проверьте вещь при получении, прежде чем подтверждать.'],
  ['withdraw', 'Как вывести деньги?', 'Кошелёк → «Вывести»: на Kaspi Gold, Halyk, Freedom по номеру телефона или на карту. Заявки обрабатываются в течение 24 часов.'],
  ['subs', 'Как работает автопродление подписок?', 'При покупке лота-подписки отметьте «Продлевать автоматически». Когда срок подойдёт, Sauda сама купит продление с вашего баланса — как обычный заказ через гаранта. Отключить можно в разделе «Подписки».'],
  ['safe', 'Как не попасться мошенникам?', 'Никогда не платите мимо Sauda (переводом на карту, в Telegram и т.п.) — тогда гарант не защитит. Не подтверждайте заказ, пока не проверили товар. Не передавайте никому пароль от Sauda. Поддержка Sauda пишет только из чата «Sauda · Поддержка».'],
  ['test', 'Что такое тестовый режим?', 'Пока не подключён платёжный шлюз, пополнение бесплатное и ненастоящее, а демо-продавцы выполняют заказы сами. Так можно спокойно попробовать все функции.'],
];
const faqVars = () => { const c = App.meta.config; return { h: c.complete_hours, ha: c.complete_hours_auto, fee: c.fee_pct, pro: c.pro_fee_pct, w: c.withdraw_fee_pct, min: Fmt.money(c.min_withdraw) }; };

Views.help = async (view, ctx) => {
  const qa = FAQ.filter(([id]) => id !== 'test' || App.testMode()); // в рабочем режиме вопрос о тестовом не нужен
  const rules = [
    'Запрещено обманывать покупателей и продавцов, продавать краденые или взломанные аккаунты, карты и данные.',
    'Запрещено уводить сделку за пределы Sauda и просить оплату напрямую.',
    'Запрещены товары и услуги, нарушающие законы Республики Казахстан: наркотики, оружие, документы, азартные игры на деньги, материалы 18+.',
    'Описание лота должно честно соответствовать товару. Продавец отвечает за выполнение в указанный срок.',
    'Оскорбления, спам и угрозы в чатах запрещены.',
    'За нарушения лоты блокируются, аккаунт может быть заблокирован, а спорные деньги возвращены пострадавшей стороне.',
    'Продавец сам отвечает за уплату налогов со своего дохода по законодательству РК.',
    'Названия и логотипы игр и сервисов принадлежат их правообладателям и показаны только для того, чтобы было понятно, к какой игре относится лот. Sauda не связан с правообладателями.',
  ];
  const vars = faqVars();
  view.innerHTML = html`<div class="page-head"><h1>❓ ${t('Помощь')}</h1></div>
    <div class="faq">${qa.map(([id, q, a]) => html`<details class="card" id="q-${id}" ${ctx.query.s === id ? 'open' : ''}><summary>${t(q)}</summary><p>${t(a, vars)}</p></details>`)}</div>
    <section class="block" id="rules"><h2>📜 ${t('Правила Sauda')}</h2><ol class="card rules">${rules.map((x) => html`<li>${t(x)}</li>`)}</ol></section>
    <div class="center"><a class="btn primary" href="#/support">🛟 ${t('Написать в поддержку')}</a></div>`.s;
  if (ctx.query.s) { const el = document.getElementById('q-' + ctx.query.s) || document.getElementById(ctx.query.s); if (el) el.scrollIntoView(); }
};
