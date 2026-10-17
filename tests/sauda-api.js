// Маркетплейс Sauda: проверка серверной логики через тот же вход, что у приложения (POST /rpc/sauda_*).
// Сделка через гаранта от начала до конца, автовыдача, спор и решение администратора, вывод, промокод,
// Pro, автопродление подписки, рефералка, права доступа — и что деньги сходятся до тенге.
//
//   node tools/sauda-dev-server.js &      (нужна локальная база — см. tests/README.md)
//   NODE_PATH=… node tests/sauda-api.js
const assert = require('assert');
const { Pool } = require('pg');

const API = process.env.SAUDA_API || 'http://localhost:8793/rest/v1/rpc/';
const db = new Pool({ connectionString: process.env.SAUDA_DB || 'postgres://postgres@/sauda?host=/var/tmp/saudapg&port=54329' });
const sql = async (q, a) => (await db.query(q, a)).rows;

async function rpc(fn, args) {
  const r = await fetch(API + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: 'x' }, body: JSON.stringify(args || {}) });
  const j = await r.json();
  if (r.status !== 200) throw new Error(fn + ' HTTP ' + r.status + ' ' + JSON.stringify(j));
  return j;
}
const ok = async (fn, args) => { const j = await rpc(fn, args); assert.strictEqual(j.ok, true, fn + ' → ' + JSON.stringify(j)); return j; };
const no = async (fn, args, code) => { const j = await rpc(fn, args); assert.strictEqual(j.ok, false, fn + ' должна отказать'); if (code) assert.strictEqual(j.error, code, fn); return j; };

const tag = Date.now().toString(36).slice(-5);
let passed = 0;
const step = (name) => { passed++; console.log('  ✓', name); };

(async () => {
  const pf = (await sql(`select id from sauda.users where login = 'sauda'`))[0].id;

  // ── регистрация и вход
  await no('sauda_register', { p_login: 'A', p_password: '123456' }, 'bad_login_format');
  await no('sauda_register', { p_login: 'admin', p_password: '123456' }, 'login_taken');
  await no('sauda_register', { p_login: 'ok_' + tag, p_password: '123' }, 'bad_password');
  const sel = await ok('sauda_register', { p_login: 'seller_' + tag, p_password: 'secret1', p_name: 'Продавец' });
  const S = sel.token;
  await no('sauda_register', { p_login: 'seller_' + tag, p_password: 'secret1' }, 'login_taken');
  const selCode = (await ok('sauda_me', { p_token: S })).user.ref_code;
  const B = (await ok('sauda_register', { p_login: 'buyer_' + tag, p_password: 'secret2', p_name: 'Покупатель', p_ref: selCode })).token;
  const C = (await ok('sauda_register', { p_login: 'third_' + tag, p_password: 'secret3' })).token;
  await no('sauda_login', { p_login: 'buyer_' + tag, p_password: 'wrong' }, 'bad_login');
  const B2 = (await ok('sauda_login', { p_login: 'BUYER_' + tag, p_password: 'secret2' })).token;
  assert.notStrictEqual(B2, B);
  await no('sauda_login', { p_login: 'almaty_gamer', p_password: 'x' }, 'bad_login');
  await no('sauda_me', { p_token: 'nope' }, 'no_session');
  const meB = await ok('sauda_me', { p_token: B });
  const meS = await ok('sauda_me', { p_token: S });
  assert.strictEqual(meB.user.balance, 0);
  assert.strictEqual(meB.unread, 1, 'приветствие от поддержки');
  step('регистрация, вход, ошибки входа, приветствие поддержки');

  // ── пополнение (тестовый режим)
  await no('sauda_topup', { p_token: B, p_amount: 50 }, 'bad_amount');
  await no('sauda_topup', { p_token: B, p_amount: 900000 }, 'bad_amount');
  assert.strictEqual((await ok('sauda_topup', { p_token: B, p_amount: 100000, p_method: 'kaspi' })).balance, 100000);
  step('пополнение в тестовом режиме и пределы суммы');

  // ── лоты
  await no('sauda_lot_save', { p_token: S, p: { game: 'nope', section: 'x', title: 'abc', price: 100 } }, 'bad_game');
  await no('sauda_lot_save', { p_token: S, p: { game: 'standoff2', section: 'subs', title: 'abc', price: 100 } }, 'bad_section');
  await no('sauda_lot_save', { p_token: S, p: { game: 'standoff2', section: 'currency', title: 'ab', price: 100 } }, 'bad_title');
  await no('sauda_lot_save', { p_token: S, p: { game: 'standoff2', section: 'currency', title: 'abc', price: 5 } }, 'bad_price');
  await no('sauda_lot_save', { p_token: S, p: { game: 'standoff2', section: 'currency', title: 'abc', price: 'много' } }, 'bad_input');
  await no('sauda_lot_save', { p_token: S, p: { game: 'standoff2', section: 'currency', title: 'abc', price: 100, thumb: 'javascript:alert(1)' } }, 'bad_image');
  const manual = (await ok('sauda_lot_save', { p_token: S, p: { game: 'pubgm', section: 'donate', title: '325 UC по ID ' + tag, descr: 'Быстро', price: 2000, qty: 3, needs_id: true, id_label: 'Player ID', deliver_mins: 30, attrs: { 'Регион': 'Global' } } })).id;
  const auto = (await ok('sauda_lot_save', { p_token: S, p: { game: 'steam', section: 'keys', title: 'Ключ Steam ' + tag, price: 1000, auto: true, items_add: ['KEY-1', ' ', 'KEY-2', 'KEY-3'] } })).id;
  const sub = (await ok('sauda_lot_save', { p_token: S, p: { game: 'spotify', section: 'subs', title: 'Spotify 1 месяц ' + tag, price: 1500, period_days: 30, needs_id: true, id_label: 'Почта' } })).id;
  let lot = await ok('sauda_lot', { p_token: '', p_id: auto });
  assert.strictEqual(lot.lot.qty, 3, 'пустая строка не стала товаром');
  assert.strictEqual(lot.lot.auto, true);
  const found = await ok('sauda_lots', { p: { q: tag, sort: 'cheap' } });
  assert.strictEqual(found.total, 3);
  assert.deepStrictEqual(found.items.map((x) => x.price), [1000, 1500, 2000]);
  assert.strictEqual((await ok('sauda_lots', { p: { game: 'pubgm', section: 'donate', q: tag } })).total, 1);
  assert.strictEqual((await ok('sauda_lots', { p: { q: '%' } })).total, 0, 'процент в поиске — просто символ');
  const items = await ok('sauda_lot_items', { p_token: S, p_id: auto });
  assert.deepStrictEqual(items.items.map((x) => x.payload), ['KEY-1', 'KEY-2', 'KEY-3']);
  await no('sauda_lot_items', { p_token: B, p_id: auto }, 'not_found');
  await no('sauda_lot_save', { p_token: B, p: { id: manual, game: 'pubgm', section: 'donate', title: 'взлом', price: 10 } }, 'not_found');
  step('лоты: проверки полей, автовыдача, поиск, сортировка, чужой лот не изменить');

  // ── покупка с автовыдачей
  await no('sauda_buy', { p_token: S, p_lot: auto, p_qty: 1 }, 'own_lot');
  await no('sauda_buy', { p_token: B, p_lot: auto, p_qty: 4 }, 'not_enough_stock');
  const o1 = (await ok('sauda_buy', { p_token: B, p_lot: auto, p_qty: 2 })).order;
  let ord = (await ok('sauda_order', { p_token: B, p_id: o1 })).order;
  assert.strictEqual(ord.status, 'delivered');
  assert.strictEqual(ord.payload, 'KEY-1\nKEY-2');
  assert.strictEqual(ord.amount, 2000);
  await no('sauda_order', { p_token: C, p_id: o1 }, 'not_found');
  assert.strictEqual((await ok('sauda_me', { p_token: B })).user.balance, 98000);
  await no('sauda_order_act', { p_token: S, p_id: o1, p_action: 'confirm' }, 'forbidden');
  await ok('sauda_order_act', { p_token: B, p_id: o1, p_action: 'confirm' });
  ord = (await ok('sauda_order', { p_token: S, p_id: o1 })).order;
  assert.strictEqual(ord.status, 'completed');
  assert.strictEqual(ord.fee, 140, 'комиссия 7 %');
  assert.strictEqual((await ok('sauda_me', { p_token: S })).user.balance, 1860 + 28, 'выручка + доля комиссии за приглашённого покупателя');
  assert.strictEqual(+(await sql(`select coalesce(sum(amount),0) s from sauda.tx t join sauda.users u on u.id = t.user_id where u.login = $1 and kind = 'referral'`, ['seller_' + tag]))[0].s, 28);
  step('автовыдача: товар выдан сразу, подтверждение, комиссия 7 %, рефералка 20 % комиссии');

  // ── отзыв
  await no('sauda_review', { p_token: S, p_order: o1, p_stars: 5 }, 'not_found');
  await no('sauda_review', { p_token: B, p_order: o1, p_stars: 9 }, 'bad_input');
  await ok('sauda_review', { p_token: B, p_order: o1, p_stars: 4, p_text: 'Ключи рабочие' });
  await ok('sauda_review', { p_token: B, p_order: o1, p_stars: 5, p_text: 'Ключи рабочие, спасибо!' });
  await ok('sauda_review_reply', { p_token: S, p_order: o1, p_text: 'Спасибо!' });
  const prof = await ok('sauda_user', { p_token: '', p_login: 'seller_' + tag });
  assert.strictEqual(prof.user.rating, 5);
  assert.strictEqual(prof.user.reviews, 1);
  assert.strictEqual(prof.reviews[0].reply, 'Спасибо!');
  step('отзыв: правка не задваивает рейтинг, ответ продавца');

  // ── ручной заказ: данные покупателя, выполнение, автоподтверждение
  await no('sauda_buy', { p_token: B, p_lot: manual, p_qty: 1 }, 'need_buyer_data');
  const o2 = (await ok('sauda_buy', { p_token: B, p_lot: manual, p_qty: 1, p_data: '5123456789' })).order;
  lot = await ok('sauda_lot', { p_token: '', p_id: manual });
  assert.strictEqual(lot.lot.qty, 2);
  await no('sauda_order_act', { p_token: B, p_id: o2, p_action: 'cancel' }, 'too_early');
  await no('sauda_order_act', { p_token: B, p_id: o2, p_action: 'deliver' }, 'forbidden');
  await ok('sauda_order_act', { p_token: S, p_id: o2, p_action: 'deliver', p_text: 'Зачислил 325 UC' });
  ord = (await ok('sauda_order', { p_token: B, p_id: o2 })).order;
  assert.strictEqual(ord.status, 'delivered');
  assert.strictEqual(ord.buyer_data, '5123456789');
  const chat = await ok('sauda_chat', { p_token: B, p_peer: meS.user.id });
  assert.ok(chat.messages.some((m) => m.kind === 'text' && m.body === 'Зачислил 325 UC'));
  assert.ok(chat.messages.some((m) => m.kind === 'system' && JSON.parse(m.body).k === 'order_paid'));
  await sql(`update sauda.orders set complete_at = now() - interval '1 minute' where id = $1`, [o2]);
  await sql(`update sauda.state set last_tick = 'epoch'`);
  await ok('sauda_me', { p_token: C });
  ord = (await ok('sauda_order', { p_token: B, p_id: o2 })).order;
  assert.strictEqual(ord.status, 'completed');
  assert.strictEqual(ord.resolution, 'auto');
  step('ручной заказ: ID игрока, выполнение с сообщением в чат, автоподтверждение по сроку');

  // ── отмена при просрочке и возврат на склад
  const o3 = (await ok('sauda_buy', { p_token: B, p_lot: manual, p_qty: 2, p_data: '5123456789' })).order;
  assert.strictEqual((await ok('sauda_lot', { p_token: '', p_id: manual })).lot.status, 'sold');
  assert.strictEqual((await ok('sauda_lots', { p: { q: tag } })).total, 2, 'проданный лот не в выдаче');
  await sql(`update sauda.orders set deliver_by = now() - interval '1 minute' where id = $1`, [o3]);
  await ok('sauda_order_act', { p_token: B, p_id: o3, p_action: 'cancel' });
  lot = await ok('sauda_lot', { p_token: '', p_id: manual });
  assert.strictEqual(lot.lot.qty, 2);
  assert.strictEqual(lot.lot.status, 'active');
  step('просрочка: покупатель отменил, деньги вернулись, товар снова в продаже');

  // ── спор и решение администратора
  const o4 = (await ok('sauda_buy', { p_token: B, p_lot: manual, p_qty: 1, p_data: '5123456789' })).order;
  await no('sauda_order_act', { p_token: B, p_id: o4, p_action: 'dispute', p_text: 'а' }, 'need_reason');
  await ok('sauda_order_act', { p_token: B, p_id: o4, p_action: 'dispute', p_text: 'Продавец не отвечает' });
  await no('sauda_admin', { p_token: B, p_action: 'disputes' }, 'forbidden');
  await no('sauda_admin_claim', { p_token: C, p_code: 'guess' }, 'bad_code');
  const code = (await sql(`select v #>> '{}' c from sauda.config where k = 'admin_code'`))[0].c;
  await ok('sauda_admin_claim', { p_token: C, p_code: code });
  const disputes = (await ok('sauda_admin', { p_token: C, p_action: 'disputes' })).data;
  assert.ok(disputes.some((d) => d.id === o4));
  const between = (await ok('sauda_admin', { p_token: C, p_action: 'chat_between', p: { a: meB.user.id, b: meS.user.id } })).data;
  assert.ok(between.messages.length > 3);
  await ok('sauda_admin_claim', { p_token: S, p_code: code });
  await no('sauda_admin', { p_token: S, p_action: 'resolve', p: { id: o4, winner: 'seller' } }, 'forbidden');
  await ok('sauda_admin', { p_token: C, p_action: 'resolve', p: { id: o4, winner: 'buyer', note: 'Не выполнено' } });
  ord = (await ok('sauda_order', { p_token: B, p_id: o4 })).order;
  assert.strictEqual(ord.status, 'refunded');
  assert.ok(ord.resolution.startsWith('admin:'));
  step('спор: открыть с причиной, администратор по коду, переписка сторон, решение в пользу покупателя');

  // ── вывод
  await no('sauda_withdraw', { p_token: S, p_amount: 1000, p_method: 'card', p_details: '4111 1111 1111 1112' }, 'bad_card');
  await no('sauda_withdraw', { p_token: S, p_amount: 1000, p_method: 'kaspi', p_details: '+7 123' }, 'bad_phone');
  await no('sauda_withdraw', { p_token: S, p_amount: 500, p_method: 'kaspi', p_details: '+7 701 123 45 67' }, 'bad_amount');
  await no('sauda_withdraw', { p_token: S, p_amount: 99999, p_method: 'kaspi', p_details: '87011234567' }, 'no_money');
  const sBal = (await ok('sauda_me', { p_token: S })).user.balance;
  const w = await ok('sauda_withdraw', { p_token: S, p_amount: 1000, p_method: 'kaspi', p_details: '8 701 123 45 67' });
  assert.strictEqual(w.fee, 10);
  assert.strictEqual(w.balance, sBal - 1000);
  const wl = await ok('sauda_wallet', { p_token: S });
  assert.strictEqual(wl.withdrawals[0].details, '•••• 4567');
  const pend = (await ok('sauda_admin', { p_token: C, p_action: 'withdrawals' })).data;
  assert.strictEqual(pend.find((x) => x.id === w.id).details, '77011234567');
  await ok('sauda_admin', { p_token: C, p_action: 'withdraw_set', p: { id: w.id, status: 'done' } });
  await no('sauda_admin', { p_token: C, p_action: 'withdraw_set', p: { id: w.id, status: 'rejected' } }, 'bad_status');
  const w2 = await ok('sauda_withdraw', { p_token: S, p_amount: 1000, p_method: 'card', p_details: '4111 1111 1111 1111' });
  await ok('sauda_admin', { p_token: C, p_action: 'withdraw_set', p: { id: w2.id, status: 'rejected', note: 'Карта не найдена' } });
  assert.strictEqual((await ok('sauda_me', { p_token: S })).user.balance, sBal - 1000);
  step('вывод: проверка Kaspi-номера и карты (Луна), маска, выплата и отказ с возвратом');

  // ── промокод, Pro, поднятие
  await ok('sauda_admin', { p_token: C, p_action: 'promo_create', p: { code: 'START' + tag, amount: 500, uses: 1 } });
  await no('sauda_promo', { p_token: S, p_code: 'nope' }, 'bad_promo');
  assert.strictEqual((await ok('sauda_promo', { p_token: S, p_code: 'start' + tag })).amount, 500);
  await no('sauda_promo', { p_token: S, p_code: 'START' + tag }, 'bad_promo');
  const D = (await ok('sauda_register', { p_login: 'empty_' + tag, p_password: 'secret4' })).token;
  await no('sauda_pro', { p_token: D, p_months: 1 }, 'no_money');
  await no('sauda_pro', { p_token: S, p_months: 2 }, 'bad_input');
  const pro = await ok('sauda_pro', { p_token: S, p_months: 1 });
  assert.ok(new Date(pro.pro_until) > new Date(Date.now() + 29 * 864e5));
  assert.strictEqual((await ok('sauda_me', { p_token: S })).user.pro, true);
  const r1 = await ok('sauda_raise', { p_token: S, p_game: 'pubgm', p_section: 'donate' });
  assert.strictEqual(r1.raised, 1);
  const r2 = await no('sauda_raise', { p_token: S, p_game: 'pubgm', p_section: 'donate' }, 'raise_wait');
  assert.ok(new Date(r2.next_at) - Date.now() < 61 * 60e3, 'с Pro — раз в час');
  step('промокод один раз, Sauda Pro за баланс, поднятие лотов с перерывом');

  // ── Pro-комиссия 3 %
  const o5 = (await ok('sauda_buy', { p_token: B, p_lot: auto, p_qty: 1 })).order;
  await ok('sauda_order_act', { p_token: B, p_id: o5, p_action: 'confirm' });
  assert.strictEqual((await ok('sauda_order', { p_token: S, p_id: o5 })).order.fee, 30);
  assert.strictEqual((await ok('sauda_lot', { p_token: '', p_id: auto })).lot.status, 'sold');
  step('с Pro комиссия 3 %, последний ключ — лот «продан»');

  // ── подписка с автопродлением
  const o6 = await ok('sauda_buy', { p_token: B, p_lot: sub, p_qty: 1, p_data: 'buyer@mail.kz', p_renew: true });
  let subs = (await ok('sauda_subs', { p_token: B })).items;
  assert.strictEqual(subs.length, 1);
  assert.strictEqual(subs[0].active, true);
  await sql(`update sauda.subs set next_at = now() - interval '1 minute' where id = $1`, [subs[0].id]);
  await sql(`update sauda.state set last_tick = 'epoch'`);
  await ok('sauda_me', { p_token: C });
  subs = (await ok('sauda_subs', { p_token: B })).items;
  assert.notStrictEqual(subs[0].last_order, o6.order, 'продлилось новым заказом');
  const renewed = (await ok('sauda_order', { p_token: S, p_id: subs[0].last_order })).order;
  assert.strictEqual(renewed.buyer_data, 'buyer@mail.kz');
  assert.strictEqual(renewed.sub_id, subs[0].id);
  // денег не хватит — после трёх неудач подписка выключается
  const left = (await ok('sauda_me', { p_token: B })).user.balance;
  await ok('sauda_admin', { p_token: C, p_action: 'balance', p: { id: meB.user.id, amount: -left, note: 'обнуление для проверки' } });
  for (let i = 0; i < 3; i++) {
    await sql(`update sauda.subs set next_at = now() - interval '1 minute' where id = $1`, [subs[0].id]);
    await sql(`update sauda.state set last_tick = 'epoch'`);
    await ok('sauda_me', { p_token: C });
  }
  subs = (await ok('sauda_subs', { p_token: B })).items;
  assert.strictEqual(subs[0].active, false);
  const notifs = (await ok('sauda_notifs', { p_token: B })).items;
  assert.ok(notifs.some((n) => n.kind === 'sub_failed' && n.data.stopped));
  assert.ok(notifs.some((n) => n.kind === 'sub_renewed'));
  step('подписка продлевается сама новым заказом; без денег — три попытки и выключение');

  // ── чат, ограничения, поддержка, демо-продавец
  await no('sauda_send', { p_token: B, p_peer: meB.user.id, p_body: 'сам себе' }, 'self_chat');
  await no('sauda_send', { p_token: B, p_peer: meS.user.id, p_body: '   ' }, 'empty');
  await ok('sauda_send', { p_token: B, p_peer: meS.user.id, p_body: 'Привет! <script>alert(1)</script>' });
  const list = (await ok('sauda_chats', { p_token: S })).items;
  assert.ok(list.find((c) => c.peer.id === meB.user.id).unread >= 1);
  await ok('sauda_chat', { p_token: S, p_peer: meB.user.id });
  assert.strictEqual((await ok('sauda_chats', { p_token: S })).items.find((c) => c.peer.id === meB.user.id).unread, 0);
  await ok('sauda_send', { p_token: B, p_peer: pf, p_body: 'Помогите с заказом' });
  const sup = (await ok('sauda_admin', { p_token: C, p_action: 'support' })).data;
  assert.ok(sup.some((x) => x.peer.id === meB.user.id));
  await ok('sauda_admin', { p_token: C, p_action: 'support_send', p: { user: meB.user.id, body: 'Здравствуйте, смотрим' } });
  const supChat = await ok('sauda_chat', { p_token: B, p_peer: pf });
  assert.ok(supChat.messages.some((m) => m.body === 'Здравствуйте, смотрим' && !m.mine));
  const demo = (await sql(`select id from sauda.users where login = 'almaty_gamer'`))[0].id;
  await ok('sauda_send', { p_token: B, p_peer: demo, p_body: 'Есть в наличии?' });
  const dchat = await ok('sauda_chat', { p_token: B, p_peer: demo });
  assert.ok(dchat.messages.some((m) => m.kind === 'system' && m.body.includes('demo_reply')));
  let limited = false;
  for (let i = 0; i < 35 && !limited; i++) {
    const j = await rpc('sauda_send', { p_token: C, p_peer: meB.user.id, p_body: 'спам ' + i });
    if (!j.ok) { assert.strictEqual(j.error, 'slow_down'); limited = true; }
  }
  assert.ok(limited, 'не больше 30 сообщений в минуту');
  step('чаты: непрочитанные, поддержка отвечает от имени сервиса, демо-продавец, защита от спама');

  // ── демо-заказ выполняет робот
  const demoLot = (await sql(`select id from sauda.lots where is_demo and not auto and status = 'active' and not needs_id limit 1`))[0];
  if (demoLot) {
    await ok('sauda_topup', { p_token: C, p_amount: 300000 });
    const od = (await ok('sauda_buy', { p_token: C, p_lot: demoLot.id, p_qty: 1 })).order;
    await sql(`update sauda.state set last_tick = 'epoch'`);
    await ok('sauda_me', { p_token: C });
    const dd = (await ok('sauda_order', { p_token: C, p_id: od })).order;
    assert.strictEqual(dd.status, 'delivered');
    assert.ok(dd.payload.startsWith('DEMO-'));
    step('демо-продавец выполняет заказ сам');
  }

  // ── блокировки и права
  await ok('sauda_admin', { p_token: C, p_action: 'lot_block', p: { id: manual, blocked: true, reason: 'тест' } });
  await no('sauda_lot', { p_token: B, p_id: manual }, 'not_found');
  await no('sauda_buy', { p_token: B, p_lot: manual, p_qty: 1, p_data: 'x1' }, 'lot_unavailable');
  await no('sauda_lot_set', { p_token: S, p_id: manual, p_status: 'active' }, 'lot_blocked');
  await ok('sauda_admin', { p_token: C, p_action: 'user_set', p: { id: meB.user.id, banned: true, ban_reason: 'тест' } });
  await no('sauda_me', { p_token: B2 }, 'no_session');
  const banned = await rpc('sauda_login', { p_login: 'buyer_' + tag, p_password: 'secret2' });
  if (banned.ok) await no('sauda_me', { p_token: banned.token }, 'banned');
  await ok('sauda_admin', { p_token: C, p_action: 'user_set', p: { id: meB.user.id, banned: false } });
  await no('sauda_admin', { p_token: C, p_action: 'config_set', p: { k: 'admin_code', v: 'x' } }, 'bad_input');
  const cfg = (await ok('sauda_meta', {})).config;
  assert.strictEqual(cfg.admin_code, undefined, 'код администратора наружу не уходит');
  step('блокировка лота и человека, код администратора не виден снаружи');

  // ── прямой доступ к таблицам закрыт
  const direct = await fetch(API.replace('/rpc/', '/') + 'sauda.users').catch(() => null);
  assert.ok(!direct || direct.status !== 200);
  const roleCheck = await sql(`select has_schema_privilege('anon', 'sauda', 'usage') u, has_function_privilege('anon', 'sauda.money(uuid,bigint,text,bigint,text)', 'execute') m`);
  assert.strictEqual(roleCheck[0].u, false);
  assert.strictEqual(roleCheck[0].m, false);
  step('схема sauda и внутренние функции недоступны снаружи');

  // ── под поддержку не замаскироваться, вывод можно отменить, пока его не взяли в работу
  const BB = (await ok('sauda_login', { p_login: 'buyer_' + tag, p_password: 'secret2' })).token; // после разблокировки — новый вход
  await no('sauda_register', { p_login: 'fake_' + tag, p_password: 'secret9', p_name: 'Поддержка Sauda' }, 'name_reserved');
  await no('sauda_register', { p_login: 'fake_' + tag, p_password: 'secret9', p_name: 'Sаuda Support' }, 'name_reserved');
  await no('sauda_register', { p_login: 'sauda_help', p_password: 'secret9' }, 'login_taken');
  await no('sauda_profile_save', { p_token: BB, p: { name: 'Админ' } }, 'name_reserved');
  await ok('sauda_profile_save', { p_token: BB, p: { name: 'Saudager KZ' } });
  await ok('sauda_topup', { p_token: BB, p_amount: 5000, p_method: 'kaspi' });
  let balB = (await ok('sauda_me', { p_token: BB })).user.balance;
  const wd1 = await ok('sauda_withdraw', { p_token: BB, p_amount: 1000, p_method: 'kaspi', p_details: '8 701 123 45 67' });
  assert.strictEqual(wd1.balance, balB - 1000);
  assert.strictEqual((await ok('sauda_withdraw_cancel', { p_token: BB, p_id: wd1.id })).balance, balB, 'отмена вернула деньги');
  await no('sauda_withdraw_cancel', { p_token: BB, p_id: wd1.id }, 'bad_status');
  const wd2 = await ok('sauda_withdraw', { p_token: BB, p_amount: 1000, p_method: 'kaspi', p_details: '87011234567' });
  await no('sauda_withdraw_cancel', { p_token: S, p_id: wd2.id }, 'not_found');
  await ok('sauda_admin', { p_token: C, p_action: 'withdraw_set', p: { id: wd2.id, status: 'processing' } });
  await no('sauda_withdraw_cancel', { p_token: BB, p_id: wd2.id }, 'bad_status');
  const inWork = (await ok('sauda_admin', { p_token: C, p_action: 'withdrawals', p: {} })).data;
  assert.ok(inWork.some((x) => x.id === wd2.id && x.status === 'processing'), 'взятая в работу заявка видна в очереди');
  step('имя «как у поддержки» запрещено, вывод отменяется до начала перевода');

  // ── запуск с настоящими деньгами: тестовое закрывается, пополнение — заявкой с кодом, зачисляет администратор
  const liveLot = (await sql(`select id from sauda.lots where is_demo and status = 'active' and not auto order by id limit 1`))[0].id;
  const openOrder = (await ok('sauda_buy', { p_token: BB, p_lot: liveLot, p_qty: 1, p_data: 'id12345' })).order;
  await ok('sauda_admin', { p_token: C, p_action: 'promo_create', p: { code: 'LIVE' + tag, amount: 300, uses: 5 } });
  await no('sauda_admin', { p_token: C, p_action: 'config_set', p: { k: 'test_mode', v: false } }, 'pay_not_set');
  await no('sauda_admin', { p_token: C, p_action: 'config_set', p: { k: 'pay_link', v: 'http://evil' } }, 'bad_input');
  await ok('sauda_admin', { p_token: C, p_action: 'config_set', p: { k: 'pay_kaspi_phone', v: '+7 701 000 00 00' } });
  await ok('sauda_admin', { p_token: C, p_action: 'config_set', p: { k: 'pay_kaspi_name', v: 'Тест Т.' } });
  await ok('sauda_admin', { p_token: C, p_action: 'config_set', p: { k: 'test_mode', v: false } });
  assert.strictEqual((await ok('sauda_meta', {})).config.test_mode, false);
  assert.strictEqual((await sql(`select count(*)::int n from sauda.users where balance <> 0`))[0].n, 0, 'тестовые деньги обнулены');
  assert.strictEqual((await sql(`select status from sauda.orders where id = $1`, [openOrder]))[0].status, 'refunded');
  assert.strictEqual((await sql(`select status from sauda.withdrawals where id = $1`, [wd2.id]))[0].status, 'rejected');
  await no('sauda_admin', { p_token: C, p_action: 'config_set', p: { k: 'test_mode', v: true } }, 'live_locked');
  await no('sauda_buy', { p_token: BB, p_lot: liveLot, p_qty: 1, p_data: 'id12345' }, 'lot_unavailable');
  await no('sauda_promo', { p_token: S, p_code: 'LIVE' + tag }, 'bad_promo');

  const tp = await ok('sauda_topup', { p_token: BB, p_amount: 7000, p_method: 'kaspi' });
  assert.ok(tp.pending && tp.topup.code === 'SD' + tp.topup.id && tp.pay.phone === '+7 701 000 00 00');
  assert.strictEqual((await ok('sauda_me', { p_token: BB })).user.balance, 0, 'до проверки деньги не зачислены');
  await no('sauda_topup_act', { p_token: S, p_id: tp.topup.id, p_action: 'claim' }, 'not_found');
  await ok('sauda_topup_act', { p_token: BB, p_id: tp.topup.id, p_action: 'claim' });
  const queue = (await ok('sauda_admin', { p_token: C, p_action: 'topups', p: {} })).data;
  assert.ok(queue.some((x) => x.id === tp.topup.id && x.claimed_at), 'заявка у администратора');
  await ok('sauda_admin', { p_token: C, p_action: 'topup_set', p: { id: tp.topup.id, status: 'paid', amount: 6500, note: 'kaspi 123' } });
  await no('sauda_admin', { p_token: C, p_action: 'topup_set', p: { id: tp.topup.id, status: 'paid' } }, 'bad_status');
  assert.strictEqual((await ok('sauda_me', { p_token: BB })).user.balance, 6500, 'зачислено, сколько пришло');
  const tp2 = await ok('sauda_topup', { p_token: BB, p_amount: 2000, p_method: 'kaspi' });
  await ok('sauda_topup_act', { p_token: BB, p_id: tp2.topup.id, p_action: 'cancel' });
  await no('sauda_admin', { p_token: C, p_action: 'topup_set', p: { id: tp2.topup.id, status: 'paid' } }, 'bad_status');
  const tp3 = await ok('sauda_topup', { p_token: BB, p_amount: 3000, p_method: 'kaspi' });
  await ok('sauda_admin', { p_token: C, p_action: 'topup_set', p: { id: tp3.topup.id, status: 'failed', note: 'не пришло' } });
  const wlt = await ok('sauda_wallet', { p_token: BB });
  assert.strictEqual(wlt.balance, 6500);
  assert.ok(wlt.topups.some((x) => x.id === tp3.topup.id && x.status === 'failed'));
  await ok('sauda_withdraw', { p_token: BB, p_amount: 2000, p_method: 'kaspi', p_details: '87011234567' });
  step('запуск с настоящими деньгами: тестовое обнулено, пополнение по коду, зачисляет администратор');

  // ── деньги сходятся: баланс каждого = сумма его журнала; всё положенное лежит на балансах, в заказах и в ожидающих выводах
  const drift = (await sql(`select count(*)::int n from sauda.users u where balance <> (select coalesce(sum(amount),0) from sauda.tx where user_id = u.id)`))[0].n;
  assert.strictEqual(drift, 0, 'баланс = журнал');
  const m = (await sql(`select
      (select coalesce(sum(balance),0) from sauda.users)::bigint bal,
      (select coalesce(sum(amount),0) from sauda.orders where status in ('paid','delivered','dispute'))::bigint esc,
      (select coalesce(sum(amount),0) from sauda.withdrawals where status in ('pending','processing'))::bigint pend,
      (select coalesce(sum(amount),0) from sauda.tx where kind = 'test_reset')::bigint reset,
      (select coalesce(sum(amount),0) from sauda.topups where status = 'paid')::bigint top,
      (select coalesce(sum(amount - fee),0) from sauda.withdrawals where status = 'done')::bigint paid,
      (select count(*) from sauda.tx t join sauda.users u on u.id = t.user_id where t.balance_after < 0 and u.role <> 'bot')::int neg`))[0];
  assert.strictEqual(+m.bal + +m.esc + +m.pend, +m.top - +m.paid + +m.reset, 'деньги сходятся');
  assert.strictEqual(m.neg, 0, 'ни у кого не было минуса');
  step('деньги сходятся до тенге, минусов нет');

  // база снова в тестовом режиме — для проверки в браузере
  await sql(`update sauda.config set v = 'true' where k = 'test_mode'`);
  console.log(`\nSauda API: ${passed} проверок прошло`);
  await db.end();
})().catch(async (e) => { console.error('ПРОВАЛ:', e.stack || e); await db.end(); process.exit(1); });
