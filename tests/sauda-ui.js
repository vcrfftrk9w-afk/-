// Маркетплейс Sauda в настоящем браузере: два человека (продавец на компьютере, покупатель на телефоне)
// проходят всю сделку через интерфейс — регистрация, лот с автовыдачей и фото, пополнение, покупка,
// товар в заказе, подтверждение, отзыв, переписка, ручной заказ со спором и решением администратора,
// вывод на Kaspi, казахский язык. В консоли не должно быть ни одной ошибки.
//
//   tools/sauda-test-db.sh && node tools/sauda-dev-server.js &
//   NODE_PATH=… node tests/sauda-ui.js
const assert = require('assert');
const { chromium } = require('playwright');
const { Pool } = require('pg');

const BASE = process.env.SAUDA_URL || 'http://localhost:8793/market/';
const db = new Pool({ connectionString: process.env.SAUDA_DB || 'postgres://postgres@/sauda?host=/var/tmp/saudapg&port=54329' });
const tag = Date.now().toString(36).slice(-4);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAcUlEQVR4nO3ZsQnAIBBAUS9ko8zmFOldKZUzmdZSCeFz8F99wn2uNEp7SmYHvcBXBtAMoBlAM4BmAO3cfTCu+sces+j3+nD6CxhAM4BmAM0AmgE0A2gG0AygGUAzgGYALX1A+MkHM4BmAM0AmgG09AEvERsGG0LIH2IAAAAASUVORK5CYII=', 'base64');
let n = 0;
const ok = (s) => console.log('  ✓', s, `(${++n})`);

async function person(browser, viewport, errors, who) {
  const ctx = await browser.newContext({ viewport, colorScheme: 'dark', locale: 'ru-RU' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(who + ' PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(who + ' CONSOLE ' + m.text()); });
  page.on('dialog', (d) => d.dismiss());
  return page;
}
const go = async (p, hash) => { if (p.url() === BASE + hash) await p.reload(); else await p.goto(BASE + hash); await p.waitForTimeout(500); };
const text = async (p, sel) => (await p.locator(sel).first().innerText()).replace(/[\u00a0\u202f]/g, ' ');

async function register(p, login, name) {
  await go(p, '#/login?mode=reg');
  await p.fill('[name=login]', login);
  await p.fill('[name=name]', name);
  await p.fill('[name=password]', 'secret123');
  await p.check('[name=agree]');
  await p.click('#auth-btn');
  await p.waitForSelector('.me-head');
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const S = await person(browser, { width: 1366, height: 900 }, errors, 'seller');
  const B = await person(browser, { width: 390, height: 844 }, errors, 'buyer');
  global.pages = { seller: S, buyer: B };

  // ── витрина без входа
  await go(B, '#/');
  await B.waitForSelector('#hot .lot-card');
  assert.ok(await B.locator('.testbar').isVisible(), 'видно предупреждение о тестовом режиме');
  await B.click('.quick a:has-text("UC PUBG")');
  await B.waitForSelector('.lot-card');
  assert.ok((await B.locator('.tab.on').innerText()).includes('UC по ID'));
  await B.fill('.filters [name=q]', '1800');
  await B.press('.filters [name=q]', 'Enter');
  await B.waitForTimeout(600);
  assert.strictEqual(await B.locator('#results .lot-card').count(), 1, 'поиск в разделе');
  await go(B, '#/catalog');
  assert.ok(await B.locator('.game-tile').count() > 50, 'каталог игр');
  await go(B, '#/sell');
  await B.waitForSelector('#auth-form');
  ok('витрина, быстрые разделы, фильтр, каталог; продать без входа — просит войти');

  // ── продавец: регистрация и лот с автовыдачей и фото
  await register(S, 'shop_' + tag, 'Мега Шоп');
  await go(S, '#/sell');
  await S.selectOption('[name=game]', 'steam');
  await S.click('#secs [data-s=keys]');
  await S.fill('[name=title]', 'Ключ Steam Premium ' + tag);
  await S.fill('[name=descr]', 'Активируйте в Steam → Игры → Активировать ключ.\nhttps://store.steampowered.com');
  await S.fill('[name=price]', '2500');
  await S.fill('[name=old_price]', '3000');
  await S.click('label:has([name=auto][value="1"])');
  await S.fill('[name=items]', 'AAAA-1111\nBBBB-2222\nCCCC-3333');
  await S.click('[data-act=addAttr]');
  await S.fill('[data-i="0"][data-k=k]', 'Регион');
  await S.fill('[data-i="0"][data-k=v]', 'Казахстан');
  await S.setInputFiles('[data-change=addPic]', { name: 'cover.png', mimeType: 'image/png', buffer: PNG });
  await S.waitForSelector('.pic img');
  assert.ok((await text(S, '#net')).includes('2 325'), 'считает выручку после комиссии 7 %');
  await S.click('#save-btn');
  await S.waitForSelector('.lot-h1');
  const lotUrl = S.url();
  const lotId = +lotUrl.split('/lot/')[1];
  assert.ok((await text(S, '.lot-h1')).includes(tag));
  assert.ok(await S.locator('.gallery #gal-main').isVisible(), 'фото лота');
  assert.ok((await text(S, '.attrs')).includes('Казахстан'));
  assert.ok(await S.locator('.descr a[href^="https://store.steampowered.com"]').count(), 'ссылка в описании кликабельна');
  assert.ok((await text(S, '.buy-facts')).includes('3 шт'));
  ok('продавец: регистрация, лот с автовыдачей, фото, характеристиками и скидкой');

  // ── второй лот: ручная выдача по ID
  await go(S, '#/sell?game=pubgm&section=donate');
  await S.fill('[name=title]', '325 UC по ID ' + tag);
  await S.fill('[name=price]', '2000');
  await S.fill('[name=qty]', '5');
  await S.check('[name=needs_id]');
  await S.fill('[name=id_label]', 'Player ID');
  await S.click('#save-btn');
  await S.waitForSelector('.lot-h1');
  const manualId = +S.url().split('/lot/')[1];
  ok('второй лот: ручная выдача по ID игрока');

  // ── покупатель: регистрация, покупка без денег → пополнение → оплата
  await register(B, 'buy_' + tag, 'Айдос');
  await go(B, '#/lot/' + lotId);
  await B.waitForSelector('#buy-btn');
  await B.click('[data-act=qplus]');
  assert.ok((await text(B, '#buy-btn')).includes('5 000'));
  await B.click('#buy-btn');
  await B.waitForSelector('.modal [data-act=topup]');
  await B.click('.modal [data-act=topup]');
  await B.waitForSelector('.modal [name=amount]');
  assert.strictEqual(await B.inputValue('.modal [name=amount]'), '5000');
  await B.click('.modal .btn.primary');
  await B.waitForSelector('.modal [data-act=pay]');
  await B.click('.modal [data-act=pay]');
  await B.waitForSelector('.payload');
  assert.deepStrictEqual(await B.locator('.pl-line code').allInnerTexts(), ['AAAA-1111', 'BBBB-2222']);
  assert.ok((await text(B, '.balance-pill')).includes('0'));
  ok('покупатель: не хватает денег → пополнил прямо из покупки → оплатил → ключи выданы сразу');

  // ── подтверждение и отзыв
  await B.click('[data-act=confirm]');
  await B.click('.modal [data-act=yes]');
  await B.waitForSelector('#review-box');
  await B.click('.star-pick [data-n="5"]');
  await B.fill('#review-box textarea', 'Ключи пришли сразу, всё работает!');
  await B.click('#review-box .btn.primary');
  await B.waitForSelector('#review-box .review');
  assert.ok((await text(B, '.status')).includes('Завершён'));
  ok('подтверждение получения и отзыв 5★');

  // ── продавец видит продажу, деньги, отзыв и отвечает
  await S.waitForTimeout(500);
  await go(S, '#/orders?tab=sell');
  await S.waitForSelector('.order-row');
  assert.ok((await text(S, '.order-row')).includes('Завершён'));
  await S.click('.order-row');
  await S.waitForSelector('#review-box');
  await S.click('[data-act=reply]');
  await S.fill('.modal textarea', 'Спасибо, заходите ещё!');
  await S.click('.modal .btn.primary');
  await S.waitForSelector('.review-reply');
  await go(S, '#/wallet');
  await S.waitForSelector('.bal');
  assert.ok((await text(S, '.bal')).includes('4 650'), 'выручка 5000 − 7 %');
  ok('продавец: продажа завершена, на балансе 4 650 ₸, ответ на отзыв');

  // ── переписка
  await go(B, '#/lot/' + manualId);
  await B.click('.seller-card a[href^="#/chat/"]');
  await B.waitForSelector('.cb-form textarea');
  await B.fill('.cb-form textarea', 'Здравствуйте! UC придут на любой сервер?');
  await B.click('.cb-form .btn');
  await B.waitForSelector('.msg.mine');
  await S.waitForTimeout(300);
  await go(S, '#/chats');
  await S.waitForSelector('.chat-item.unread');
  await S.click('.chat-item.unread');
  await S.waitForSelector('.msg:not(.mine)');
  await S.fill('.cb-form textarea', 'Да, на любой. Пишите ID.');
  await S.press('.cb-form textarea', 'Enter');
  await B.waitForSelector('.msg:not(.mine) .bubble', { timeout: 8000 });
  assert.ok((await B.locator('.msg:not(.mine) .bubble').last().innerText()).includes('на любой'));
  await B.setInputFiles('.cb-form input[type=file]', { name: 'shot.png', mimeType: 'image/png', buffer: PNG });
  await B.waitForSelector('.msg.mine .msg-img');
  ok('чат: сообщение, непрочитанное у продавца, ответ приходит сам за 3 секунды, фото');

  // ── ручной заказ по ID, спор, решение администратора
  await go(B, '#/wallet');
  await B.click('[data-act=topup]');
  await B.fill('.modal [name=amount]', '10000');
  await B.click('.modal .btn.primary');
  await B.waitForTimeout(500);
  await go(B, '#/lot/' + manualId);
  await B.fill('[name=data]', '5123456789');
  await B.click('#buy-btn');
  await B.click('.modal [data-act=pay]');
  await B.waitForSelector('.order-actions');
  const orderId = +B.url().split('/order/')[1];
  assert.ok((await text(B, '.status')).includes('Оплачен'));
  await go(S, '#/order/' + orderId);
  assert.ok((await text(S, '.sum-list')).includes('5123456789'), 'продавец видит ID игрока');
  await S.click('[data-act=deliver]');
  await S.fill('.modal textarea', 'Зачислено 325 UC');
  await S.click('.modal .btn.primary');
  await S.waitForSelector('.payload');
  await go(B, '#/order/' + orderId);
  await B.waitForSelector('[data-act=dispute]');
  await B.click('[data-act=dispute]');
  await B.fill('.modal textarea', 'UC так и не пришли на аккаунт');
  await B.click('.modal .btn.danger');
  await B.waitForSelector('.note.warn');
  assert.ok((await text(B, '.status')).includes('Спор'));
  // администратор — третий человек: свой спор решать нельзя
  const A = await person(browser, { width: 1280, height: 860 }, errors, 'admin');
  global.pages.admin = A;
  await register(A, 'adm_' + tag, 'Админ');
  const code = (await db.query(`select v #>> '{}' c from sauda.config where k = 'admin_code'`)).rows[0].c;
  await go(A, '#/settings');
  await A.click('details summary');
  await A.fill('[name=code]', code);
  await A.click('[data-submit=claim] .btn');
  await A.waitForSelector('.kpis');
  await go(A, '#/admin/disputes');
  await A.waitForSelector('.order-row');
  await A.click('.order-row');
  await A.waitForSelector('.admin-box');
  await A.waitForSelector('#adm-chat .adm-msg');
  assert.ok(await A.locator('#adm-chat .adm-msg').count() > 2, 'админ видит переписку сторон');
  await A.fill('#adm-note', 'Продавец не подтвердил зачисление');
  await A.click('[data-act=resolve][data-w=buyer]');
  await A.click('.modal [data-act=yes]');
  await A.waitForTimeout(800);
  await go(B, '#/order/' + orderId);
  assert.ok((await text(B, '.status')).includes('Возврат'));
  assert.ok((await text(B, '.order-card')).includes('Продавец не подтвердил зачисление'));
  ok('ручной заказ по ID → выполнено → спор → администратор по коду вернул деньги');

  // ── вывод на Kaspi и обработка администратором
  await go(S, '#/wallet');
  await S.click('[data-act=withdraw]');
  await S.fill('.modal [name=details]', '+7 701 555 12 34');
  await S.fill('.modal [name=amount]', '2000');
  assert.ok((await text(S, '.modal #calc')).includes('1 980'));
  await S.click('.modal .btn.primary');
  await S.waitForTimeout(600);
  await go(A, '#/admin/withdrawals');
  await A.waitForSelector('.adm-row code');
  assert.strictEqual(await text(A, '.adm-row code'), '77015551234');
  await A.click('[data-act=done]');
  await A.click('.modal [data-act=yes]');
  await A.waitForTimeout(600);
  await go(S, '#/wallet');
  assert.ok((await text(S, '.status')).includes('Отправлено'));
  ok('вывод на Kaspi: номер нормализован, администратор отметил «отправил»');

  // ── демо-продавец и автопродление подписки
  await go(B, '#/g/spotify/subs');
  await B.click('.lot-card:has-text("Individual")');
  await B.fill('[name=data]', 'me@mail.kz');
  await B.check('[name=renew]');
  await B.click('#buy-btn');
  await B.click('.modal [data-act=pay]');
  await B.waitForSelector('.order-card');
  await db.query(`update sauda.state set last_tick = 'epoch'`);
  await B.waitForTimeout(3500);
  await go(B, B.url().split('/market/')[1]);
  const st = await text(B, '.status');
  assert.ok(/Выполнен|Завершён/.test(st), 'демо-продавец выполнил заказ: ' + st);
  await go(B, '#/subs');
  await B.waitForSelector('.sub-item');
  assert.ok((await text(B, '.sub-item')).includes('Включено'));
  ok('подписка у демо-продавца с автопродлением');

  // ── уведомления, избранное, Pro, язык
  await go(S, '#/notifs');
  await S.waitForSelector('.notif');
  assert.ok((await S.locator('.notif').count()) >= 3);
  await go(B, '#/lot/' + manualId);
  await B.click('[data-act=fav]');
  await go(B, '#/favs');
  await B.waitForSelector('.lot-card');
  await go(B, '#/settings');
  await B.click('[data-act=lang][data-l=kz]');
  await B.waitForTimeout(400);
  await go(B, '#/');
  await B.waitForSelector('#hot .lot-card');
  const kz = await B.locator('.hero h1').innerText();
  assert.ok(!/Донат, игровые/.test(kz), 'главная на казахском: ' + kz);
  await go(B, '#/me');
  await B.click('[data-act=logout]');
  await B.click('.modal [data-act=yes]');
  await B.waitForTimeout(300);
  assert.ok(await B.locator('.top-right .btn.primary').isVisible(), 'после выхода — кнопка входа');
  ok('уведомления, избранное, казахский язык, выход');

  // ── безопасность вёрстки: имя с HTML не исполняется
  await register(B, 'xss_' + tag, '<img src=x onerror=alert(1)>');
  await go(B, '#/me');
  assert.strictEqual(await B.locator('.me-head img[src=x]').count(), 0, 'HTML в имени показывается текстом');
  ok('имя с HTML-кодом показывается как текст');

  assert.deepStrictEqual(errors, [], 'ошибки в консоли');
  console.log(`\nSauda UI: ${n} сценариев прошло, ошибок в консоли нет`);
  await browser.close();
  await db.end();
})().catch(async (e) => {
  console.error('ПРОВАЛ:', e.stack || e);
  if (process.env.SHOTS) for (const [k, p] of Object.entries(global.pages || {})) await p.screenshot({ path: process.env.SHOTS + '/fail-' + k + '.png' }).catch(() => {});
  process.exit(1);
});
