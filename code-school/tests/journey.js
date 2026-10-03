/* Сквозной сценарий новичка в настоящем браузере:
   главная → первый урок → печатает код → запуск → победа → следующий урок → ошибка и её объяснение →
   подсказка → тест → теоретический урок → замок на дальнем уроке → песочница → словарь → профиль →
   перезагрузка (прогресс на месте) → телефон (вкладки урока).
   NODE_PATH=/opt/node22/lib/node_modules node code-school/tests/journey.js */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8793/code-school/';
let failures = 0;
const check = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) failures++; };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_CERT|fonts\.g/.test(m.text())) errors.push(m.text()); });

  await p.goto(BASE + 'index.html');
  await p.waitForSelector('.hero');
  check(await p.isVisible('text=Начать первый урок'), 'Новичок видит кнопку «Начать первый урок»');
  const modules = await p.$$eval('.module', (m) => m.length);
  check(modules === 18, `На карте 18 модулей (есть ${modules})`);

  // Урок 1
  await p.click('text=Начать первый урок');
  await p.waitForSelector('.lesson');
  check((await p.textContent('.lh-title h1')).includes('Добро пожаловать'), 'Открылся первый урок');
  // пример в теории запускается
  await p.click('.example .ex-run');
  await p.waitForTimeout(500);
  check((await p.textContent('.example .console')).includes('Привет, мир!'), 'Пример в теории запускается и печатает «Привет, мир!»');
  // перевод слова при наведении
  await p.hover('.theory .gw[data-w="console"]');
  await p.waitForTimeout(150);
  check(await p.isVisible('.gtip.show'), 'При наведении на слово console появляется перевод');
  check((await p.textContent('.gtip')).includes('консоль'), 'Перевод: «консоль»');
  // меняем код в редакторе
  const ta = '.wb-editor textarea';
  await p.click(ta);
  await p.keyboard.press('Control+A');
  await p.keyboard.type('console.log("Привет, Петя!");');
  await p.waitForTimeout(100);
  // курсор на слове — перевод под редактором
  await p.keyboard.press('Home');
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(100);
  check((await p.textContent('.wb-word')).includes('консоль'), 'Курсор на слове console — перевод под редактором');
  await p.click('.wb-run');
  await p.waitForSelector('.modal .win', { timeout: 4000 }).catch(() => {});
  check(await p.isVisible('.modal .win'), 'Задание выполнено — окно победы');
  check((await p.textContent('.xp-gain')).includes('XP'), 'Показан полученный опыт');
  await p.click('.modal [data-close="next"]');
  await p.waitForTimeout(400);
  check((await p.textContent('.lh-title h1')).includes('console.log'), 'Кнопка «Следующий урок» открыла урок 2');

  // Урок 2: ошибка → объяснение по-русски
  await p.click(ta);
  await p.keyboard.press('Control+A');
  await p.keyboard.press('Delete');
  await p.keyboard.type('consol.log("Я учусь программировать");');
  await p.click('.wb-run');
  await p.waitForTimeout(700);
  const err = await p.textContent('.wb-console');
  check(/consol/.test(err) && /console/.test(err), 'Ошибка «consol» объяснена и предложено «console»');
  check(await p.isVisible('.ed-mark'), 'Строка с ошибкой подсвечена в редакторе');
  // русская буква в слове
  await p.click(ta);
  await p.keyboard.press('Control+A');
  await p.keyboard.type('сonsole.log("Я учусь программировать");');
  await p.click('.wb-run');
  await p.waitForTimeout(700);
  check((await p.textContent('.wb-console')).includes('русские'), 'Русская «с» в слове console замечена и объяснена');
  // подсказка
  await p.click('.hint-btn');
  check(await p.isVisible('.hints .callout'), 'Подсказка открывается');
  // правильное решение (автоскобки редактора: печатаем без закрывающих символов не нужно — вставляем текстом)
  await p.click(ta);
  await p.keyboard.press('Control+A');
  await p.keyboard.press('Delete');
  await p.evaluate(() => {
    const t = document.querySelector('.wb-editor textarea');
    t.value = 'console.log("Я учусь программировать");\nconsole.log("Скоро я сделаю свою игру");\nconsole.log("Ура!");\n';
    t.dispatchEvent(new Event('input'));
  });
  await p.click('.wb-run');
  await p.waitForSelector('.modal .win', { timeout: 4000 }).catch(() => {});
  check(await p.isVisible('.modal .win'), 'Урок 2 пройден');
  check((await p.textContent('.modal .win')).includes('Подсказок использовано: 1'), 'В итоге учтена подсказка');
  await p.click('.modal [data-close="stay"]');
  await p.waitForTimeout(300);
  // тест в конце урока
  const q = await p.$$('.quiz .q');
  check(q.length === 2, 'В уроке 2 два вопроса');
  await p.click('.quiz .q[data-q="0"] .q-opt[data-a="1"]');
  await p.click('.quiz .q[data-q="1"] .q-opt[data-a="0"]');
  await p.waitForTimeout(200);
  check((await p.$$('.q-opt.right')).length === 2, 'Правильные ответы отмечены зелёным');

  // автоотступ и автоскобки редактора
  await p.goto(BASE + 'index.html#/lesson/start-3');
  await p.waitForSelector(ta);
  await p.click(ta);
  await p.keyboard.press('Control+A');
  await p.keyboard.press('Delete');
  await p.keyboard.type('if (true) {');
  await p.keyboard.press('Enter');
  const val = await p.$eval(ta, (t) => t.value);
  check(val === 'if (true) {\n  \n}', 'Редактор сам закрывает скобки и ставит отступ');
  await p.keyboard.press('Control+z');

  // замок на дальнем уроке
  await p.goto(BASE + 'index.html#/lesson/snake-1');
  await p.waitForTimeout(300);
  check(await p.isVisible('text=Этот урок пока закрыт'), 'Дальний урок закрыт замком');

  // бесконечный цикл не вешает страницу
  await p.goto(BASE + 'index.html#/sandbox');
  await p.waitForSelector('.sb-tpl');
  await p.evaluate(() => {
    const t = document.querySelector('.wb-editor textarea');
    t.value = 'let i = 0;\nwhile (i < 10) {\n  console.log(i);\n}\n';
    t.dispatchEvent(new Event('input'));
  });
  await p.click('.wb-run');
  await p.waitForTimeout(1500);
  check((await p.textContent('.wb-console')).includes('Бесконечный цикл'), 'Бесконечный цикл остановлен и объяснён');
  // шаблон игры
  await p.selectOption('.sb-tpl', { label: 'Готовая игра: Змейка' });
  await p.click('.modal .btn.primary');
  await p.waitForTimeout(800);
  check(await p.isVisible('.wb-stage .run-frame'), 'Шаблон «Змейка» запускается на холсте');
  const fw = await p.$eval('.wb-stage .run-frame', (f) => f.style.aspectRatio);
  check(/400 \/ 400/.test(fw), 'Холст змейки — 400×400');
  // сохранить проект
  await p.click('.sb-save');
  await p.fill('.pj-name', 'Моя змейка');
  await p.click('.pj-ok');
  await p.waitForTimeout(200);
  check((await p.textContent('.sb-list')).includes('(1)'), 'Проект сохранён в «Мои проекты»');

  // словарь
  await p.click('.nav a[data-page="dict"]');
  await p.waitForSelector('.dict-q');
  const all = await p.$$eval('.dw', (d) => d.length);
  await p.fill('.dict-q', 'прыж');
  const found = await p.$$eval('.dw-word', (d) => d.map((x) => x.textContent));
  check(all > 200 && found.includes('jump'), `Словарь: ${all} слов, поиск по-русски «прыж» находит jump`);

  // профиль
  await p.click('.nav a[data-page="profile"]');
  await p.waitForSelector('.p-name');
  await p.fill('.p-name', 'Петя');
  const got = await p.$$eval('.ach.got', (a) => a.length);
  check(got >= 3, `Получены достижения (${got})`);
  check((await p.textContent('.p-stats')).includes('2/93'), 'В профиле: пройдено 2 из 93');

  // перезагрузка — прогресс на месте
  await p.reload();
  await p.waitForSelector('.p-name');
  check((await p.inputValue('.p-name')) === 'Петя', 'После перезагрузки имя сохранилось');
  await p.goto(BASE + 'index.html');
  await p.waitForSelector('.hero');
  check((await p.textContent('.hero')).includes('Петя'), 'Главная приветствует по имени');
  check((await p.textContent('.hero-btns')).includes('Продолжить'), 'Кнопка «Продолжить» ведёт дальше');

  // тёмная/светлая тема
  await p.goto(BASE + 'index.html#/profile');
  await p.selectOption('.st-theme', 'light');
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg === 'rgb(244, 245, 251)', 'Светлая тема включается');

  // телефон
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('телефон: ' + e.message));
  await mp.goto(BASE + 'index.html#/lesson/start-1');
  await mp.waitForSelector('.lesson-tabs');
  check(await mp.isVisible('.lesson-tabs'), 'Телефон: вкладки «Теория / Практика»');
  check(!(await mp.isVisible('.work')), 'Телефон: сначала видна только теория');
  await mp.click('.lesson-tabs button[data-tab="code"]');
  check(await mp.isVisible('.wb-editor'), 'Телефон: вкладка «Практика» открывает редактор');
  const nav = await mp.$eval('.nav', (n) => n.getBoundingClientRect().bottom);
  check(Math.abs(nav - 844) < 2, 'Телефон: меню внизу экрана');
  const wide = await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(wide, 'Телефон: нет горизонтальной прокрутки');

  check(!errors.length, 'Без ошибок в консоли браузера' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log(failures ? `\nПровалено проверок: ${failures}` : '\nВсё прошло ✓');
  process.exit(failures ? 1 : 0);
})();
