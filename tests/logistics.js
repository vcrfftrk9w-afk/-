// Курс «Логистика PRO» (папка logistics/): весь путь ученика в настоящем браузере.
// Запуск: python3 -m http.server 8792 &  затем  NODE_PATH=/opt/node22/lib/node_modules node tests/logistics.js
const { chromium } = require('playwright');
const BASE = 'http://localhost:8792/logistics/index.html';
const SHOTS = process.env.SHOTS || '';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fails = [];
  const ok = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) fails.push(msg); };

  for (const vp of [{ width: 390, height: 844, name: 'phone' }, { width: 1280, height: 860, name: 'desktop' }]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height } });
    // Без доступа к YouTube в тестах: превью отдаём заглушкой, чтобы проверка не зависела от сети.
    await ctx.route(/ytimg\.com|youtube/, (r) => r.abort());
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    const shot = async (n) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${vp.name}-${n}.png`, fullPage: false }); };
    const noHScroll = async (where) => ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${vp.name}: нет горизонтальной прокрутки — ${where}`);

    await p.goto(BASE);
    await p.waitForSelector('#wn');
    await shot('welcome');
    await p.fill('#wn', 'Анна Логистова');
    await p.click('#wf button');
    await p.waitForSelector('.hero .ring');
    ok(await p.locator('.mod').count() === 8, `${vp.name}: на главной 8 модулей`);
    await noHScroll('главная');
    await shot('home');

    // второй урок закрыт, пока не пройден первый
    ok(await p.locator('.lessons li.locked').count() === 31, `${vp.name}: открыт только первый урок`);

    // урок 1.1
    await p.goto(BASE + '#/lesson/1-1');
    await p.waitForSelector('#play');
    ok(await p.locator('.vtabs .chip').count() === 3, `${vp.name}: у урока 3 видео (основное + 2 запасных)`);
    await p.click('#play');
    ok(await p.locator('.player iframe[src*="youtube-nocookie.com/embed/fjiNBEPIzGE"]').count() === 1, `${vp.name}: по ▶ встраивается плеер YouTube`);
    await p.click('#watched');
    await p.click('#read');
    await noHScroll('урок');
    await shot('lesson');

    // тест: отвечаем правильно, сверяясь с данными курса
    await p.click('#qgo');
    for (;;) {
      const q = await p.textContent('.qq');
      const right = await p.evaluate((q) => { const l = LogiPro.all.find((x) => x.id === '1-1'); const it = l.quiz.find((z) => z.q === q); return it.a[it.c]; }, q);
      await p.locator('.ans', { hasText: right }).first().click();
      ok(await p.locator('.ans.right').count() === 1, `${vp.name}: подсветка правильного ответа`);
      const nxt = await p.textContent('#qn');
      await p.click('#qn');
      if (/Результат/.test(nxt)) break;
    }
    await p.waitForSelector('.result.ok');
    await shot('quiz-result');
    const st = await p.evaluate(() => LogiPro.state());
    ok(st.lessons['1-1'].done && st.lessons['1-1'].perfect, `${vp.name}: урок засчитан, тест без ошибок`);
    ok(st.xp >= 20 + 10 + 50 + 40 + 30, `${vp.name}: начислен XP (${st.xp})`);
    ok(st.ach.first && st.ach.perfect, `${vp.name}: достижения «Первый шаг» и «Отличник»`);

    // неверные ответы — урок не засчитывается
    await p.goto(BASE + '#/lesson/1-2');
    await p.click('#qgo');
    for (;;) {
      const q = await p.textContent('.qq');
      const wrong = await p.evaluate((q) => { const l = LogiPro.all.find((x) => x.id === '1-2'); const it = l.quiz.find((z) => z.q === q); return it.a[(it.c + 1) % it.a.length]; }, q);
      await p.locator('.ans', { hasText: wrong }).first().click();
      const nxt = await p.textContent('#qn'); await p.click('#qn');
      if (/Результат/.test(nxt)) break;
    }
    ok(await p.locator('.result.no').count() === 1, `${vp.name}: при ошибках урок не засчитан`);
    ok(!(await p.evaluate(() => LogiPro.state().lessons['1-2'].done)), `${vp.name}: 1-2 остался непройденным`);

    // все тренажёры открываются и считают без ошибок
    for (const id of ['eoq', 'ss', 'abc', 'weight', 'truck', 'inco', 'customs', 'bullwhip', 'route']) {
      await p.goto(BASE + '#/tools/' + id);
      await p.waitForSelector('#tb');
      ok((await p.locator('#out').innerText()).trim().length > 0, `${vp.name}: тренажёр ${id} выдал результат`);
      await noHScroll('тренажёр ' + id);
      if (id === 'eoq') {
        const t = await p.locator('#out .stat.big b').innerText();
        ok(t.replace(/\s/g, '') === '1265', `${vp.name}: EOQ(12000, 2000, 150×20%) = 1 265 (получено ${t})`);
        await shot('tool-eoq');
      }
      if (id === 'route') {
        // собираем маршрут из решения 2-opt — должны получить «оптимум»
        await p.click('#opt');
        const order = await p.evaluate(() => [...document.querySelectorAll('#svg .algo')][0].getAttribute('points'));
        const pts = order.trim().split(' ').slice(1, -1);
        for (const xy of pts) {
          const [x, y] = xy.split(',').map(Number);
          await p.evaluate(([x, y]) => { const c = [...document.querySelectorAll('#svg .pt circle')].find((c) => Math.abs(+c.getAttribute('cx') - x) < 1e-6 && Math.abs(+c.getAttribute('cy') - y) < 1e-6); c.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, [x, y]);
        }
        ok(/Оптимум/.test(await p.locator('#out').innerText()), `${vp.name}: маршрут как у 2-opt признан оптимальным`);
        await shot('tool-route');
      }
      if (id === 'inco') { await p.click('[data-t="DDP"]'); ok(/Продавец делает всё/.test(await p.locator('#out').innerText()), `${vp.name}: Incoterms переключается на DDP`); await shot('tool-inco'); }
      if (id === 'bullwhip') await shot('tool-bullwhip');
    }
    ok(await p.evaluate(() => LogiPro.state().ach.tools && LogiPro.state().ach.route), `${vp.name}: достижения «Практик» и «Штурман»`);

    // словарь и карточки
    await p.goto(BASE + '#/glossary');
    await p.fill('#gs', 'кросс');
    ok(await p.locator('.term').count() >= 1, `${vp.name}: поиск по словарю`);
    await p.goto(BASE + '#/cards');
    await p.click('#fc');
    await p.click('#kn');
    ok(await p.evaluate(() => Object.keys(LogiPro.state().cards).length === 1), `${vp.name}: карточка ушла в следующую коробку`);
    await shot('cards');

    // экзамен закрыт до прохождения курса, в свободном режиме — открыт
    await p.goto(BASE + '#/exam');
    ok(await p.locator('#go').count() === 0, `${vp.name}: экзамен закрыт до конца курса`);
    await p.goto(BASE + '#/course');
    await p.check('#free');
    ok(await p.locator('.lessons li.locked').count() === 0, `${vp.name}: свободный режим открывает все уроки`);
    await p.goto(BASE + '#/exam');
    await p.click('#go');
    for (let i = 0; i < 30; i++) {
      const q = await p.textContent('.qq');
      const right = await p.evaluate((q) => { const pool = LogiPro.all.flatMap((l) => l.quiz).concat(COURSE.examExtra); const it = pool.find((z) => z.q === q); return it.a[it.c]; }, q);
      await p.locator('.ans', { hasText: right }).first().click();
    }
    await p.waitForSelector('.result.ok');
    await p.click('text=Мой сертификат');
    await p.waitForSelector('#cert');
    ok(await p.evaluate(() => LogiPro.state().exam.passed && /^LP-/.test(LogiPro.state().exam.id)), `${vp.name}: экзамен сдан, у сертификата есть номер`);
    await noHScroll('сертификат');
    await shot('certificate');

    // прогресс переживает перезагрузку
    await p.reload();
    await p.waitForSelector('#cert');
    ok(await p.evaluate(() => LogiPro.state().name === 'Анна Логистова'), `${vp.name}: прогресс сохранился после перезагрузки`);

    // профиль и светлая тема
    await p.goto(BASE + '#/profile');
    await p.check('#pt');
    ok(await p.evaluate(() => document.documentElement.dataset.theme === 'light'), `${vp.name}: светлая тема`);
    await noHScroll('профиль');
    await shot('profile-light');

    ok(errors.length === 0, `${vp.name}: ошибок в консоли нет ${errors.length ? JSON.stringify(errors) : ''}`);
    await ctx.close();
  }

  // сломанное сохранение не роняет приложение
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.addInitScript(() => localStorage.setItem('logipro_v1', '{битые данные'));
  await p.goto(BASE);
  ok(await p.locator('#wn').count() === 1, 'битое сохранение: приложение стартует с чистого листа');
  await ctx.close();

  // все видео курса: у каждого урока ≥ 2 разных ролика, ID похожи на YouTube
  const p2 = await (await b.newContext()).newPage();
  await p2.goto(BASE);
  const vids = await p2.evaluate(() => LogiPro.all.map((l) => ({ id: l.id, v: l.videos.map((x) => x.id), q: l.quiz.length, c: l.quiz.every((z) => z.c >= 0 && z.c < z.a.length) })));
  ok(vids.length === 32, 'в курсе 32 урока');
  ok(vids.every((l) => l.v.length >= 2 && new Set(l.v).size === l.v.length && l.v.every((id) => /^[\w-]{11}$/.test(id))), 'у каждого урока ≥ 2 разных корректных YouTube-ID');
  ok(vids.every((l) => l.q >= 3 && l.c), 'в каждом уроке ≥ 3 вопросов с корректным ответом');

  await b.close();
  console.log(fails.length ? `\nПРОВАЛЕНО: ${fails.length}` : '\nВСЁ ПРОШЛО');
  process.exit(fails.length ? 1 : 0);
})();
