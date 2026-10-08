const { chromium } = require('./_browser');
/* Свои дела с будильником в «Моих делах»: «Тренировка» в понедельник в 07:00, во вторник в 10:00.
   Сегодня понедельник 06:00. Дело стоит в списке со временем, в APK ставятся будильники
   на каждый день со своим временем; отметка «сделано»; правка; привязка к заданию уровня;
   дело, добавленное на другом телефоне, тоже получает будильник. */
const mock = `(() => {
  const R=Date, f=new R('2026-09-28T06:00:00').getTime(), s=R.now(); class FD extends R{constructor(...a){a.length?super(...a):super(f+R.now()-s)} static now(){return f+R.now()-s}} window.Date=FD;
  const calls = window.__alarms = [];
  window.AndroidApp = {
    speak: () => {}, stopSpeaking: () => {}, saveFile: () => {}, notify: () => {},
    notifyState: () => 'granted', requestNotify: () => {},
    setAlarms: (json) => { calls.push(JSON.parse(json)); return JSON.stringify({ exact: true, fullScreen: true, next: 0 }); },
    alarmStatus: () => JSON.stringify({ exact: true, fullScreen: true }),
    testAlarm: () => {}, ringNow: () => {}, pickSound: () => {}, openSettings: () => {},
  };
})();`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let ok = true; const check = (n, c, i) => { console.log((c ? '✓ ' : '✗ ') + n, i !== undefined ? JSON.stringify(i).slice(0, 300) : ''); if (!c) ok = false; };
  const ctx = await b.newContext({ viewport: { width: 393, height: 793 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(mock);
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(800);
  await p.evaluate(() => { State.s.onboarded = true; State.s.mode = 'adhd'; State.s.alarms = { wake: false, publish: false, announced: true }; State.save(); location.reload(); });
  await p.waitForTimeout(2600);
  const lastAlarms = () => p.evaluate(() => window.__alarms[window.__alarms.length - 1] || []);

  // новое дело: Тренировка, пн 07:00, вт 10:00
  await p.click('#mytasks-root [data-plan-new]'); await p.waitForTimeout(300);
  await p.click('[data-pl-idea="Тренировка"]'); await p.waitForTimeout(150);
  await p.click('[data-pl-day="1"]'); await p.waitForTimeout(150);
  await p.fill('[data-pl-time="1"]', '07:00');
  await p.click('[data-pl-day="2"]'); await p.waitForTimeout(150);
  await p.fill('[data-pl-time="2"]', '10:00');
  await p.click('#pl-save'); await p.waitForTimeout(600);
  const plan = await p.evaluate(() => State.s.plans[0]);
  check('дело сохранено: пн 07:00, вт 10:00, с будильником', plan && plan.title === 'Тренировка' && plan.times['1'] === 420 && plan.times['2'] === 600 && plan.alarm === true && Object.keys(plan.times).length === 2, plan);
  const row = await p.evaluate(() => { const r = document.querySelector('#mytasks-root .plans .mt-row'); return r ? r.textContent.replace(/\s+/g, ' ').trim() : null; });
  check('сегодня (пн) в «Моих делах»: 07:00 ⏰ Тренировка', row && /07:00 · ⏰/.test(row) && /💪 Тренировка/.test(row), row);
  const al = (await lastAlarms()).filter((a) => /Тренировка/.test(a.title));
  check('в APK будильники: пн 07:00 и вт 10:00', al.length === 2 && al.some((a) => a.dow === 1 && a.min === 420) && al.some((a) => a.dow === 2 && a.min === 600), al);

  // отметить сделанным
  const xp0 = await p.evaluate(() => State.s.xp);
  await p.click('#mytasks-root .plans [data-plan-done]'); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll('.modal.modal-open').forEach((m) => { if (m.id !== 'sheet-modal') UI.closeModal('#' + m.id); }));
  const done = await p.evaluate(() => ({ cls: document.querySelector('#mytasks-root .plans .mt-row').className, xp: State.s.xp, head: document.querySelector('#mytasks-root .plans .my-sec').textContent }));
  check('отметил — сделано, +опыт, «1 из 1»', /done/.test(done.cls) && done.xp > xp0 && /1 из 1/.test(done.head), done);
  const todayK = await p.evaluate(() => State.todayKey());
  await p.waitForTimeout(2300); // будильники переставляются через 2 секунды после изменения
  const skipAl = (await lastAlarms()).filter((a) => /Тренировка/.test(a.title));
  check('сделано сегодня — сегодня будильник этого дела молчит, в другие дни звонит', skipAl.length === 2 && skipAl.every((a) => a.skip === todayK), skipAl);

  // список всех дел и правка: одно время всем дням
  const allTxt = await p.evaluate(() => document.querySelector('#mytasks-root .plans-all').textContent.replace(/\s+/g, ' '));
  check('«Все мои дела»: расписание по дням', /Пн 07:00 · Вт 10:00/.test(allTxt), allTxt);
  await p.evaluate(() => document.querySelector('#mytasks-root .plans-all [data-plan-edit]').click()); await p.waitForTimeout(300);
  await p.click('#pl-same'); await p.waitForTimeout(150);
  await p.click('#pl-save'); await p.waitForTimeout(500);
  check('«время как у первого» — Пн и Вт в 07:00', await p.evaluate(() => Plans.schedule(State.s.plans[0])) === 'Пн, Вт в 07:00');

  // пустое название и без дней — понятные ошибки
  await p.click('#mytasks-root [data-plan-new]'); await p.waitForTimeout(300);
  await p.click('#pl-save'); await p.waitForTimeout(200);
  check('без названия — подсказка', /Напиши, что за дело/.test(await p.textContent('#pl-err')));
  await p.fill('#pl-title', 'Уборка'); await p.click('#pl-save'); await p.waitForTimeout(200);
  check('без дней — подсказка', /хотя бы один день/.test(await p.textContent('#pl-err')));
  await p.click('#pl-cancel'); await p.waitForTimeout(300);

  // задание уровня: на уровне 2 открыта «Тренировка» — дело с таким названием встаёт к заданию
  await p.evaluate(() => { State.s.lvl.level = 1; State.s.lvl.from = '2026-01-01'; State.s.plans = []; State.commit(); });
  await p.waitForTimeout(300);
  await p.click('#mytasks-root [data-plan-new]'); await p.waitForTimeout(300);
  await p.click('[data-pl-idea="Тренировка"]'); await p.click('[data-pl-day="1"]'); await p.fill('[data-pl-time="1"]', '07:00');
  await p.click('#pl-save'); await p.waitForTimeout(500);
  const q = await p.evaluate(() => ({ quest: State.s.plans[0].quest, ownRows: document.querySelectorAll('#mytasks-root .plans .mt-row').length,
    trainRow: Array.from(document.querySelectorAll('#mytasks-root .mt-list .mt-row')).map((r) => r.textContent.replace(/\s+/g, ' ')).find((t) => /Тренировка/.test(t)) }));
  check('«Тренировка» уровня: время 07:00 ⏰ у самого задания, без дубля', q.quest === 'train' && q.ownRows === 0 && /07:00 ⏰/.test(q.trainRow || ''), q);

  // дело добавили на другом телефоне (пришло через аккаунт) — будильник встаёт сам
  const n0 = await p.evaluate(() => window.__alarms.length);
  await p.evaluate(() => { State.s.plans.push({ id: 99, title: 'Английский', emoji: '🇬🇧', times: { 3: 1140 }, alarm: true }); State.commit(); });
  await p.waitForTimeout(2600);
  const synced = await p.evaluate(() => window.__alarms.slice(-1)[0].filter((a) => /Английский/.test(a.title)));
  check('дело с другого телефона — будильник ср 19:00 поставлен', (await p.evaluate(() => window.__alarms.length)) > n0 && synced.length === 1 && synced[0].dow === 3 && synced[0].min === 1140, synced);

  // удалить
  await p.evaluate(() => { const el = document.querySelector('#mytasks-root .plans-all'); el.open = true; });
  await p.evaluate(() => Array.from(document.querySelectorAll('#mytasks-root .plans-all [data-plan-edit]')).find((x) => /Английский/.test(x.textContent)).click());
  await p.waitForTimeout(300);
  await p.click('#pl-del'); await p.waitForTimeout(500);
  check('дело удалено вместе с будильником', await p.evaluate(() => !State.s.plans.some((x) => x.title === 'Английский') && !window.__alarms.slice(-1)[0].some((a) => /Английский/.test(a.title))));
  // ⏰ у публикации «кино»: будильники публикаций выключены — включаем «за 15 минут»
  const bell0 = await p.textContent('#mytasks-root [data-lvalarm="kino"]');
  check('⏰ у «кино» есть и показывает, что выключен', /🔕/.test(bell0), bell0);
  await p.click('#mytasks-root [data-lvalarm="kino"]'); await p.waitForTimeout(300);
  await p.click('[data-pub-lead="15"]'); await p.waitForTimeout(300);
  const kino = (await lastAlarms()).filter((a) => /кино/.test(a.title));
  const orca = (await lastAlarms()).filter((a) => /orca/.test(a.title));
  check('«кино» за 15 минут — будильник каждый день в 19:40, orca не трогаем', kino.length === 7 && kino.every((a) => a.min === 19 * 60 + 40) && /Через 15 минут/.test(kino[0].title) && orca.length === 0, { kino: kino.length, min: kino[0] && kino[0].min, orca: orca.length });
  await p.click('#pub-toggle'); await p.waitForTimeout(300);
  check('выключил — будильника «кино» нет', !(await lastAlarms()).some((a) => /кино/.test(a.title)));
  await p.click('#pub-toggle'); await p.waitForTimeout(200);
  await p.click('#pub-close'); await p.waitForTimeout(400);
  check('⏰ у «кино» теперь горит', /⏰/.test(await p.textContent('#mytasks-root [data-lvalarm="kino"]')));

  // ⏰ у «Тренировки» уровня: редактор с уже подставленным названием
  await p.evaluate(() => { State.s.plans = []; State.commit(); }); await p.waitForTimeout(300);
  await p.click('#mytasks-root [data-lvalarm="train"]'); await p.waitForTimeout(300);
  check('⏰ у «Тренировки» — редактор, название подставлено', (await p.inputValue('#pl-title')) === 'Тренировка');
  await p.click('[data-pl-day="1"]'); await p.fill('[data-pl-time="1"]', '07:00');
  await p.click('[data-pl-day="2"]'); await p.fill('[data-pl-time="2"]', '10:00');
  await p.click('#pl-save'); await p.waitForTimeout(500);
  const tr = await p.evaluate(() => ({ plan: State.s.plans[0], bell: document.querySelector('#mytasks-root [data-lvalarm="train"]').textContent }));
  check('«Тренировка»: пн 07:00, вт 10:00, ⏰ горит, к заданию уровня', tr.plan.quest === 'train' && tr.plan.times['1'] === 420 && tr.plan.times['2'] === 600 && /⏰/.test(tr.bell), tr);

  check('без ошибок на странице', errs.length === 0, errs);

  await b.close();
  console.log(ok ? '\nВСЁ ОК' : '\nЕСТЬ ОШИБКИ'); process.exit(ok ? 0 : 1);
})();
