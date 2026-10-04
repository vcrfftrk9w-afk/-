const { chromium } = require('./_browser');
/* Вкладка «🎓 Курсы»: третье окно рядом с «Мои дела» и «Всё остальное».
   Английский: старт → урок дня в ежедневнике (18:00) и в будильнике APK; шаги открываются
   по очереди; пазлы, аудирование, тест; видео: позиция и просмотренные минуты из плеера;
   день закрыт → задача в ежедневнике закрыта, следующий урок — завтра.
   Итоговая проверка: не сдал → +5 дней повторения → сдал → курс пройден.
   Стойка (замер), сальто (без подтверждения страховки не начать), деньги (дела-чекбоксы).
   «Мои дела» курсы не трогают. */
const mock = `(() => {
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
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(mock);
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(800);
  await p.evaluate(() => { State.s.onboarded = true; State.s.mode = 'adhd'; State.save(); location.reload(); });
  await p.waitForTimeout(2600);
  const clean = () => p.evaluate(() => { document.querySelectorAll('.toast').forEach((t) => t.remove()); document.querySelectorAll('.modal.modal-open').forEach((m) => { if (m.id !== 'sheet-modal') UI.closeModal('#' + m.id); }); });
  const myBefore = await p.evaluate(() => document.querySelector('#mytasks-root').textContent.replace(/\s+/g, ' ').replace(/\d/g, ''));

  // --- третье окно ---
  await p.click('.space-btn[data-space="learn"]'); await p.waitForTimeout(500);
  const home = await p.evaluate(() => ({ space: document.body.dataset.space, panel: document.querySelector('.tab-panel.active').id, tabbar: getComputedStyle(document.querySelector('.tabbar')).display, cards: document.querySelectorAll('.cr-cat').length, btns: document.querySelectorAll('.space-btn').length }));
  check('третье окно «🎓 Курсы» рядом с «Мои дела» и «Всё остальное»', home.btns === 3 && home.space === 'learn' && home.panel === 'tab-courses' && home.tabbar === 'none' && home.cards === 4, home);

  // --- английский: страница курса и старт ---
  await p.click('[data-cr-open="english"]'); await p.waitForTimeout(300);
  const page = await p.evaluate(() => document.querySelector('#courses-root').textContent);
  check('страница курса: обещание и как работает гарантия', /Обещание курса/.test(page) && /не засчитывается, пока ты не сдашь итоговую проверку/.test(page), page.slice(0, 80));
  await p.fill('#cr-time', '19:30');
  await p.click('[data-cr-start="english"]'); await p.waitForTimeout(600); await clean();
  const started = await p.evaluate(() => ({ st: Courses.state('english'), task: State.s.tasks.find((t) => t.courseId === 'english'), alarms: window.__alarms.slice(-1)[0].filter((a) => /Английский/.test(a.title)) }));
  check('урок дня встал задачей в «Всё остальное» на 19:30', started.task && started.task.at === 19 * 60 + 30 && started.task.due === (await p.evaluate(() => State.todayKey())) && /урок 1/.test(started.task.title), started.task);
  check('и будильником в APK на каждый день в 19:30', started.alarms.length === 7 && started.alarms.every((a) => a.min === 19 * 60 + 30), started.alarms[0]);
  const myAfter = await p.evaluate(() => document.querySelector('#mytasks-root').textContent.replace(/\s+/g, ' ').replace(/\d/g, ''));
  check('«Мои дела» не тронуты', myAfter === myBefore && await p.evaluate(() => !State.s.plans || !State.s.plans.length));

  // --- урок: видео и шаги ---
  await p.click('.cr-today'); await p.waitForTimeout(500);
  const lesson = await p.evaluate(() => ({ src: (document.querySelector('#cr-yt') || {}).src, steps: Array.from(document.querySelectorAll('.cr-step')).map((x) => [x.querySelector('b').textContent, x.classList.contains('locked')]) }));
  check('в уроке — встроенное видео урока 1 Бебриса', /youtube-nocookie\.com\/embed\/HJwTaPns-D0/.test(lesson.src || '') && /list=PLD6SPjEPomauFCdDQwuHubP7F2yIVJnwN/.test(lesson.src), lesson.src);
  check('шаги как в English Galaxy, открываются по очереди', lesson.steps.length === 5 && /Пазл на изучаемом/.test(lesson.steps[1][0]) && !lesson.steps[1][1] && lesson.steps[2][1] && lesson.steps[3][1] && lesson.steps[4][1], lesson.steps);

  // плеер присылает время: позиция и «тот самый урок» запоминаются
  await p.evaluate(() => {
    const send = (info) => window.dispatchEvent(new MessageEvent('message', { origin: 'https://www.youtube-nocookie.com', data: JSON.stringify({ event: 'infoDelivery', info }) }));
    send({ videoData: { title: 'Английский язык с нуля до продвинутого. Практический курс по приложению English Galaxy. А0. Урок 1', video_id: 'HJwTaPns-D0' }, playlistIndex: 0 });
    for (let t = 100; t <= 160; t += 1) send({ currentTime: t, playerState: 1 });
  });
  const vstate = await p.evaluate(() => { const st = Courses.state('english'); return { pos: st.video[1], vid: st.vid[1], prog: st.prog[0] }; });
  check('видео: место остановки и прогресс просмотра сохраняются', vstate.pos === 160 && vstate.vid === 'HJwTaPns-D0' && vstate.prog > 0 && vstate.prog < 0.1, vstate);

  // --- решатель пазлов: нажимает слова по порядку ---
  const solve = async (stepIdx, wrongFirst) => {
    await p.click(`[data-cr-step="${stepIdx}"]`); await p.waitForTimeout(300);
    const s = await p.evaluate((i) => Courses.dayOf('english', Courses.state('english').day).steps[i], stepIdx);
    for (let k = 0; k < s.items.length; k += 1) {
      const it = s.items[k];
      const words = s.type === 'puzzle-en' ? it.words : it.ruWords;
      if (wrongFirst && k === 0) {
        await p.evaluate(() => document.querySelector('[data-cr-in]').click());
        await p.click('#cr-check'); await p.waitForTimeout(150);
        const right = await p.textContent('.cr-right');
        check('ошибка — показывает правильный ответ и «Дальше»', /Правильно/.test(right) && await p.isVisible('#cr-next'), right);
        await p.click('#cr-next'); await p.waitForTimeout(150);
        // ошибочное предложение ушло в конец очереди
        s.items.push(s.items[0]); continue;
      }
      for (const w of words) {
        await p.evaluate((word) => { const btn = Array.from(document.querySelectorAll('.cr-pool [data-cr-in]')).find((x) => x.textContent === word); btn.click(); }, w);
      }
      await p.click('#cr-check'); await p.waitForTimeout(1250);
    }
    await p.waitForTimeout(300);
  };

  await solve(1, true);
  const after1 = await p.evaluate(() => ({ view: document.querySelector('#courses-root').dataset.view, locked: Array.from(document.querySelectorAll('.cr-step')).map((x) => x.classList.contains('locked')), prog: Courses.state('english').prog[1] }));
  check('пазл решён — снова урок, следующий шаг открылся', after1.view === 'lesson' && after1.prog === 1 && !after1.locked[2] && after1.locked[3], after1);

  // мягкая перерисовка не сбрасывает упражнение
  await p.click('[data-cr-step="2"]'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('.cr-pool [data-cr-in]').click());
  await p.evaluate(() => { App.renderActive(); State.commit(); });
  await p.waitForTimeout(200);
  check('пока решаешь — экран не сбрасывается', await p.evaluate(() => document.querySelectorAll('.cr-answer .cr-chip').length === 1));
  await p.click('.cr-head.ex .cr-back'); await p.waitForTimeout(300);
  await solve(2); await solve(3);

  // тест — правильные ответы
  await p.click('[data-cr-step="4"]'); await p.waitForTimeout(300);
  const t4 = await p.evaluate(() => Courses.dayOf('english', 1).steps[4].items);
  for (const it of t4) { await p.evaluate((a) => document.querySelector(`[data-cr-opt="${a}"]`).click(), it.a); await p.waitForTimeout(800); }
  await p.click('#cr-done'); await p.waitForTimeout(400); await clean();
  // видео отмечаем вручную
  await p.click('[data-cr-step="0"]'); await p.waitForTimeout(300);
  await p.click('#cr-vseen'); await p.waitForTimeout(800); await clean();
  const day1 = await p.evaluate(() => { const st = Courses.state('english'); const t = State.s.tasks.find((x) => x.courseId === 'english'); return { day: st.day, done: st.done[1], task: t && t.done, view: document.querySelector('#courses-root').dataset.view, win: (document.querySelector('.cr-win') || {}).textContent, today: (document.querySelector('.cr-today') || {}).disabled }; });
  check('день 1 пройден: задача в ежедневнике закрыта, завтра урок 2', day1.day === 2 && !!day1.done && day1.task === true && day1.view === 'course' && /День 1 пройден/.test(day1.win || '') && day1.today === true, day1);

  // --- итоговая проверка: не сдал → повторение, сдал → курс пройден ---
  const finalDay = async (answerRight) => {
    await p.evaluate(() => { const st = Courses.state('english'); st.done = {}; st.prog = {}; State.save(); Courses.open('english', 'lesson'); });
    await p.waitForTimeout(400);
    await solve(0); await solve(1);
    await p.click('[data-cr-step="2"]'); await p.waitForTimeout(300);
    const items = await p.evaluate(() => Courses.dayOf('english', Courses.state('english').day).steps[2].items);
    for (const it of items) {
      const pickAns = answerRight ? it.a : it.o.find((o) => o !== it.a);
      await p.evaluate((a) => document.querySelector(`[data-cr-opt="${a}"]`).click(), pickAns);
      await p.waitForTimeout(answerRight ? 800 : 1600);
    }
    const res = await p.textContent('.cr-ex-body');
    await p.click('#cr-done'); await p.waitForTimeout(600); await clean();
    return res;
  };
  await p.evaluate(() => { const st = Courses.state('english'); st.day = 30; State.save(); });
  const fail = await finalDay(false);
  const afterFail = await p.evaluate(() => { const st = Courses.state('english'); return { day: st.day, extra: st.extra, fin: st.finished, title: Courses.dayOf('english', st.day).title }; });
  check('итоговая не сдана — курс добавил 5 дней повторения', /Нужно 80%/.test(fail) && afterFail.extra === 5 && afterFail.day === 31 && !afterFail.fin && /Повторение/.test(afterFail.title), afterFail);
  await p.evaluate(() => { const st = Courses.state('english'); st.day = 35; State.save(); });
  await finalDay(true);
  const fin = await p.evaluate(() => ({ fin: Courses.state('english').finished, page: document.querySelector('#courses-root').textContent }));
  check('итоговая сдана — курс пройден, обещание выполнено', !!fin.fin && /Курс пройден/.test(fin.page), fin.fin);

  // --- стойка: тренировка и замер ---
  await p.evaluate(() => Courses.open('handstand'));
  await p.waitForTimeout(200);
  await p.click('[data-cr-start="handstand"]'); await p.waitForTimeout(500); await clean();
  const hs = await p.evaluate(() => Courses.dayOf('handstand', 6));
  check('стойка: день — тренировка с таймером и замер', hs.steps.some((s) => s.type === 'session' && s.session.length >= 3) && hs.steps.some((s) => s.type === 'measure' && s.key === 'wall'), hs.steps.map((s) => s.type));
  const hs14 = await p.evaluate(() => Courses.dayOf('handstand', 14));
  check('на 14-й день — промежуточная проверка «у стены 30 с»', hs14.check === 'wall30' && hs14.steps.some((s) => s.goal === 30), hs14.title);
  await p.evaluate(() => { const st = Courses.state('handstand'); st.day = 14; State.save(); Courses.open('handstand', 'lesson'); });
  await p.waitForTimeout(300);
  await p.click('[data-cr-step="0"]'); await p.waitForTimeout(300);
  await p.click('#cr-self'); await p.waitForTimeout(400);
  await p.click('[data-cr-step="1"]'); await p.waitForTimeout(300);
  await p.fill('#cr-num', '22'); await p.click('#cr-save'); await p.waitForTimeout(700); await clean();
  const hsAfter = await p.evaluate(() => { const st = Courses.state('handstand'); return { day: st.day, fin: st.finished, extra: st.extra, m: st.metrics.wall, page: document.querySelector('#courses-root').textContent }; });
  check('промежуточная проверка не завершает курс; замер виден в прогрессе', hsAfter.day === 15 && !hsAfter.fin && !hsAfter.extra && hsAfter.m[0].v === 22 && /Твой прогресс/.test(hsAfter.page), { day: hsAfter.day, fin: hsAfter.fin, extra: hsAfter.extra });

  // --- сальто: без страховки не начать ---
  await p.evaluate(() => Courses.open('backflip'));
  await p.waitForTimeout(200);
  await p.click('[data-cr-start="backflip"]'); await p.waitForTimeout(200);
  check('сальто: без подтверждения страховки курс не начинается', /безопасность/i.test(await p.textContent('#cr-err')) && await p.evaluate(() => !Courses.state('backflip')));
  await p.check('#cr-gate'); await p.click('[data-cr-start="backflip"]'); await p.waitForTimeout(400); await clean();
  check('с подтверждением — начат', await p.evaluate(() => !!Courses.state('backflip')));

  // --- деньги: дела-чекбоксы ---
  await p.evaluate(() => Courses.open('money'));
  await p.waitForTimeout(200);
  await p.click('[data-cr-start="money"]'); await p.waitForTimeout(400); await clean();
  await p.evaluate(() => Courses.open('money', 'lesson')); await p.waitForTimeout(300);
  const m1 = await p.evaluate(() => Courses.dayOf('money', 1).steps.map((s) => s.type));
  check('деньги: видео, дело дня и замер дохода', m1.join() === 'video,todo,measure', m1);
  await p.click('[data-cr-step="1"]'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelectorAll('[data-cr-todo]').forEach((x) => { x.click(); }));
  await p.waitForTimeout(200);
  await p.click('#cr-tdone'); await p.waitForTimeout(400);
  check('дело дня отмечено — шаг закрыт', await p.evaluate(() => Courses.state('money').prog[1] === 1));

  // --- вкладка с несколькими курсами ---
  await p.evaluate(() => { Courses.open(null); }); await p.click('.space-btn[data-space="learn"]'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-cr-home]') && document.querySelector('[data-cr-home]').click()); await p.waitForTimeout(300);
  const homeAct = await p.evaluate(() => document.querySelectorAll('.cr-active').length);
  check('на главной вкладке — мои курсы с прогрессом', homeAct === 4, homeAct);
  check('после перезагрузки окно «Курсы» открывается снова', await (async () => { await p.reload(); await p.waitForTimeout(2600); return p.evaluate(() => document.body.dataset.space === 'learn' && document.querySelector('.tab-panel.active').id === 'tab-courses'); })());
  check('без ошибок на странице', errs.length === 0, errs);

  await b.close();
  console.log(ok ? '\nВСЁ ОК' : '\nЕСТЬ ОШИБКИ'); process.exit(ok ? 0 : 1);
})();
