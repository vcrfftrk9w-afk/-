const { chromium } = require('./_browser');
/* Вкладка «🎓 Курсы»: третье окно рядом с «Мои дела» и «Всё остальное».
   Английский A0 → C1: старт → урок дня в ежедневнике и будильнике; шаги по очереди;
   пазлы (по-русски любой порядок слов), аудирование, тест, говорение с микрофоном;
   видео: позиция, минуты, «досмотрел до конца» → следующий урок, иначе часть 2;
   ошибки → интервальное повторение; экзамен уровня: не сдал → 5 дней повторения → сдал →
   уровень подтверждён; досрочный экзамен; тест на уровень; C1 сдан → путь пройден;
   старый 30-дневный курс переносится на путь.
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
  // микрофон: «слышит» то, что положили в window.__say
  window.__say = '';
  window.webkitSpeechRecognition = function () {
    this.start = () => setTimeout(() => {
      if (this.onresult) this.onresult({ results: [[{ transcript: window.__say, confidence: 0.9 }]] });
      if (this.onend) this.onend();
    }, 60);
    this.stop = () => {}; this.abort = () => {};
  };
  window.SpeechRecognition = window.webkitSpeechRecognition;
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
  // поздравление с уровнем опыта всплывает в любой момент — закрываем его перед каждым нажатием
  const tap = async (sel) => { await clean(); await p.click(sel); };
  const myBefore = await p.evaluate(() => document.querySelector('#mytasks-root').textContent.replace(/\s+/g, ' ').replace(/\d/g, ''));

  // --- третье окно ---
  await tap('.space-btn[data-space="learn"]'); await p.waitForTimeout(500);
  const home = await p.evaluate(() => ({ space: document.body.dataset.space, panel: document.querySelector('.tab-panel.active').id, tabbar: getComputedStyle(document.querySelector('.tabbar')).display, cards: document.querySelectorAll('.cr-cat').length, btns: document.querySelectorAll('.space-btn').length }));
  check('третье окно «🎓 Курсы» рядом с «Мои дела» и «Всё остальное»', home.btns === 3 && home.space === 'learn' && home.panel === 'tab-courses' && home.tabbar === 'none' && home.cards === 4, home);

  // --- английский A0 → C1: страница курса и старт ---
  await tap('[data-cr-open="english"]'); await p.waitForTimeout(300);
  const page = await p.evaluate(() => document.querySelector('#courses-root').textContent);
  check('страница английского: обещание, экзамены и выбор старта', /Обещание курса/.test(page) && /засчитывается только после экзамена/.test(page) && /Определить мой уровень/.test(page) && /20 мин/.test(page), page.slice(0, 80));
  await p.fill('#cr-time', '19:30');
  await tap('[data-en-pick="20"]');
  await tap('[data-cr-start="english"]'); await p.waitForTimeout(600); await clean();
  const started = await p.evaluate(() => ({ st: Courses.state('english'), task: State.s.tasks.find((t) => t.courseId === 'english'), alarms: window.__alarms.slice(-1)[0].filter((a) => /Английский/.test(a.title)) }));
  check('урок дня встал задачей «A0 · урок 1» в «Всё остальное» на 19:30', started.task && started.task.at === 19 * 60 + 30 && started.task.due === (await p.evaluate(() => State.todayKey())) && /A0 · урок 1/.test(started.task.title) && started.task.estimate === 32, started.task);
  check('путь начат: A0, урок 1, 20 минут видео в день', started.st.path.level === 0 && started.st.path.lesson === 1 && started.st.path.videoMin === 20, started.st.path);
  check('и будильником в APK на каждый день в 19:30', started.alarms.length === 7 && started.alarms.every((a) => a.min === 19 * 60 + 30), started.alarms[0]);
  const myAfter = await p.evaluate(() => document.querySelector('#mytasks-root').textContent.replace(/\s+/g, ' ').replace(/\d/g, ''));
  check('«Мои дела» не тронуты', myAfter === myBefore && await p.evaluate(() => !State.s.plans || !State.s.plans.length));
  const cpage = await p.evaluate(() => document.querySelector('#courses-root').textContent);
  check('на странице: подтверждённый уровень, лестница A0…C1, прогноз', /Твой подтверждённый уровень/.test(cpage) && ['A0', 'A1', 'A2', 'B1', 'B2', 'C1'].every((x) => cpage.includes(x)) && await p.evaluate(() => document.querySelectorAll('.en-lv').length === 6 && document.querySelector('.en-lv.now .en-lv-badge').textContent === 'A0') && /Когда подтвердишь уровень/.test(cpage));

  // --- урок: видео и шаги ---
  await tap('.cr-today'); await p.waitForTimeout(500);
  const lesson = await p.evaluate(() => ({ src: (document.querySelector('#cr-yt') || {}).src, steps: Array.from(document.querySelectorAll('.cr-step')).map((x) => [x.querySelector('b').textContent, x.classList.contains('locked')]) }));
  check('в уроке — встроенное видео урока 1 A0 (плейлист Бебриса)', /youtube-nocookie\.com\/embed\/HJwTaPns-D0/.test(lesson.src || '') && /list=PLD6SPjEPomauFCdDQwuHubP7F2yIVJnwN/.test(lesson.src), lesson.src);
  check('шаги: видео, пазлы, аудирование, тест, говорение — по очереди', lesson.steps.length === 6 && /Пазл на изучаемом/.test(lesson.steps[1][0]) && /Говорение/.test(lesson.steps[5][0]) && !lesson.steps[1][1] && lesson.steps.slice(2).every((x) => x[1]), lesson.steps);

  const send = (info) => p.evaluate((i) => window.dispatchEvent(new MessageEvent('message', { origin: 'https://www.youtube-nocookie.com', data: JSON.stringify({ event: 'infoDelivery', info: i }) })), info);
  await send({ videoData: { title: 'Английский язык с нуля до продвинутого. Практический курс по приложению English Galaxy. А0. Урок 1', video_id: 'HJwTaPns-D0' }, playlistIndex: 0, duration: 4200 });
  for (let t = 100; t <= 160; t += 1) await send({ currentTime: t, playerState: 1 });
  const vstate = await p.evaluate(() => { const st = Courses.state('english'); return { pos: st.video['A0-1'], vid: st.vid['A0-1'], prog: st.prog[0] }; });
  check('видео: место остановки и прогресс просмотра сохраняются', vstate.pos === 160 && vstate.vid === 'HJwTaPns-D0' && vstate.prog > 0 && vstate.prog < 0.1, vstate);

  // --- решатель шагов ---
  const W = (ms) => p.waitForTimeout(ms);
  const stepsNow = () => p.evaluate(() => Courses.dayOf('english').steps);
  async function doStep(i, o = {}) {
    const s = (await stepsNow())[i];
    await clean(); // поздравление с новым уровнем опыта может закрыть кнопку
    await tap(`[data-cr-step="${i}"]`); await W(300);
    if (s.type === 'video') { await tap(o.end ? '#cr-vend' : '#cr-vseen'); await W(800); await clean(); return s; }
    if (s.type === 'test') {
      for (const it of s.items) {
        const ans = o.wrong ? it.o.find((x) => x !== it.a) : o.place ? (o.place(it) ? it.a : it.o.find((x) => x !== it.a)) : it.a;
        await p.evaluate((a) => Array.from(document.querySelectorAll('[data-cr-opt]')).find((x) => x.dataset.crOpt === a).click(), ans);
        await W(ans === it.a ? 780 : 1560);
      }
      await tap('#cr-done'); await W(600); await clean();
      return s;
    }
    if (s.type === 'speak') {
      for (const it of s.items) {
        await p.evaluate((t) => { window.__say = t; }, o.wrong ? 'banana banana' : it.en);
        await tap('#cr-mic'); await W(1200);
        if (o.wrong && s.pass) { await tap('#cr-mic'); await W(2300); }
      }
      if (s.pass) { await tap('#cr-done'); }
      await W(600); await clean();
      return s;
    }
    // пазлы и аудирование
    for (let k = 0; k < s.items.length; k += 1) {
      const it = s.items[k];
      let ws = s.type === 'puzzle-en' ? it.words.slice() : it.ruWords.slice();
      if (o.wrongFirst && k === 0) {
        await p.evaluate(() => document.querySelector('[data-cr-in]').click());
        await tap('#cr-check'); await W(150);
        const right = await p.textContent('.cr-right');
        check('ошибка — показывает правильный ответ и «Дальше»', /Правильно/.test(right) && await p.isVisible('#cr-next'), right);
        await tap('#cr-next'); await W(150);
        s.items.push(s.items[0]); continue;
      }
      if (o.wrong) { await p.evaluate(() => document.querySelector('[data-cr-in]').click()); await tap('#cr-check'); await W(150); await tap('#cr-next'); await W(150); continue; }
      if (o.reverse) ws = ws.reverse();
      for (const w of ws) await p.evaluate((word) => Array.from(document.querySelectorAll('.cr-pool [data-cr-in]')).find((x) => x.textContent === word).click(), w);
      await tap('#cr-check'); await W(1250);
    }
    if (s.pass) { await tap('#cr-done'); }
    await W(500); await clean();
    return s;
  }
  const freshDay = () => p.evaluate(() => { const st = Courses.state('english'); st.done = {}; st.prog = {}; st.path.plan = null; State.save(); Courses.open('english', 'lesson'); });

  const s1 = await doStep(1, { wrongFirst: true });
  const after1 = await p.evaluate((k) => ({ view: document.querySelector('#courses-root').dataset.view, locked: Array.from(document.querySelectorAll('.cr-step')).map((x) => x.classList.contains('locked')), prog: Courses.state('english').prog[1], srs: Courses.state('english').path.srs[k] }), s1.items[0].key);
  check('пазл решён — снова урок, следующий шаг открылся', after1.view === 'lesson' && after1.prog === 1 && !after1.locked[2] && after1.locked[3], after1);
  check('ошибка ушла в интервальное повторение на завтра', after1.srs && after1.srs.b === 0 && after1.srs.d > (await p.evaluate(() => State.todayKey())), after1.srs);

  // мягкая перерисовка не сбрасывает упражнение
  await tap('[data-cr-step="2"]'); await W(300);
  await p.evaluate(() => document.querySelector('.cr-pool [data-cr-in]').click());
  await p.evaluate(() => { App.renderActive(); State.commit(); });
  await W(200);
  check('пока решаешь — экран не сбрасывается', await p.evaluate(() => document.querySelectorAll('.cr-answer .cr-chip').length === 1));
  await tap('.cr-head.ex .cr-back'); await W(300);
  await doStep(2, { reverse: true });
  check('по-русски засчитывается любой порядок слов', await p.evaluate(() => Courses.state('english').prog[2] === 1));
  await doStep(3); await doStep(4);
  // говорение: микрофон услышал не то, потом то
  await tap('[data-cr-step="5"]'); await W(300);
  const sp = (await stepsNow())[5];
  await p.evaluate(() => { window.__say = 'hello world'; }); await tap('#cr-mic'); await W(500);
  const spWrong = await p.textContent('.cr-ex-body');
  check('говорение: распознал «не то» — показывает правильную фразу', /Ты сказал/.test(spWrong) && spWrong.includes(sp.items[0].en), spWrong.slice(0, 160));
  for (const it of sp.items) { await p.evaluate((t) => { window.__say = t.toLowerCase(); }, it.en); await tap('#cr-mic'); await W(1300); }
  await W(400); await clean();
  // видео досмотрено до конца → завтра урок 2
  await send({ currentTime: 4190, playerState: 1 });
  await send({ playerState: 0 });
  await W(900); await clean();
  const day1 = await p.evaluate(() => { const st = Courses.state('english'); const t = State.s.tasks.find((x) => x.courseId === 'english'); return { day: st.day, done: st.done[1], path: st.path, task: t && t.done, view: document.querySelector('#courses-root').dataset.view, win: (document.querySelector('.cr-win') || {}).textContent, today: (document.querySelector('.cr-today') || {}).disabled }; });
  check('день пройден: задача закрыта, видео досмотрено → завтра урок 2', day1.done && day1.task === true && day1.view === 'course' && day1.path.lesson === 2 && day1.path.part === 1 && /Урок 1 досмотрен/.test(day1.win || '') && day1.today === true, { lesson: day1.path.lesson, win: day1.win });
  check('выученные фразы считаются', day1.path.learned >= 8, day1.path.learned);

  // --- день без конца видео → часть 2 того же урока; повторение ошибок в уроке ---
  await p.evaluate(() => { const st = Courses.state('english'); Object.keys(st.path.srs).forEach((k) => { st.path.srs[k].d = State.todayKey(); }); });
  await freshDay(); await W(400);
  const d2 = await stepsNow();
  check('пора повторить — в уроке шаг «Повторение: твои фразы»', d2[1].srs === true && d2[1].items.length === 6, d2.map((s) => s.title));
  for (let i = 1; i < d2.length; i += 1) await doStep(i);
  await doStep(0); await W(400);
  const d2s = await p.evaluate(() => Courses.state('english').path);
  check('видео не досмотрено до конца — завтра часть 2 того же урока', d2s.lesson === 2 && d2s.part === 2, { l: d2s.lesson, p: d2s.part });
  check('верно вспомнил — интервал вырос', Object.values(d2s.srs).some((x) => x.b >= 2), Object.values(d2s.srs).slice(0, 3));

  // --- экзамен уровня: не сдал → повторение → сдал → уровень подтверждён ---
  await p.evaluate(() => { const st = Courses.state('english'); st.path.lesson = 51; st.path.srs = {}; });
  await freshDay(); await W(400);
  const ex = await stepsNow();
  check('после 50 уроков — экзамен: тест 80%, аудирование, перевод, говорение', ex.length === 4 && ex[0].pass === 0.8 && ex[0].items.length === 15 && ex[1].type === 'listening' && ex[3].type === 'speak' && ex[3].pass === 0.6, ex.map((s) => [s.type, s.pass]));
  const failRes = await (async () => { await doStep(0, { wrong: true }); return 1; })();
  const failTxt = await p.evaluate(() => Courses.state('english').failed);
  await doStep(1); await doStep(2); await doStep(3);
  const afterFail = await p.evaluate(() => ({ path: Courses.state('english').path, title: Courses.dayOf('english').title }));
  check('экзамен не сдан — 5 дней повторения слабых тем, уровень не засчитан', failRes && afterFail.path.review === 5 && !afterFail.path.confirmed.A0 && afterFail.path.level === 0 && /Повторение перед пересдачей/.test(afterFail.title) && afterFail.path.weak['0.0'] > 0, { review: afterFail.path.review, title: afterFail.title, failTxt });
  await p.evaluate(() => { Courses.state('english').path.review = 0; });
  await freshDay(); await W(400);
  for (let i = 0; i < 4; i += 1) await doStep(i);
  const passed = await p.evaluate(() => ({ path: Courses.state('english').path, page: document.querySelector('#courses-root').textContent, main: document.querySelector('.en-level-main b').textContent, task: State.s.tasks.find((t) => t.courseId === 'english' && !t.done) }));
  check('экзамен сдан — A0 подтверждён, открыт A1', passed.path.confirmed.A0 && passed.path.level === 1 && passed.path.lesson === 1 && passed.main === 'A0' && /подтверждён экзаменом/.test(passed.page), { main: passed.main, lv: passed.path.level });

  // --- досрочный экзамен: не сдал — вернулся к своему уроку ---
  await p.evaluate(() => { const st = Courses.state('english'); st.path.lesson = 7; st.done = {}; st.path.plan = null; State.save(); Courses.open('english'); });
  await W(300);
  await tap('#en-exam-now'); await tap('#en-exam-now'); await W(400);
  const early = await stepsNow();
  check('«Сдать экзамен досрочно» — экзамен A1 вместо урока', /Экзамен уровня A1/.test(await p.evaluate(() => Courses.dayOf('english').title)) && early.length === 4);
  await doStep(0, { wrong: true }); await doStep(1); await doStep(2); await doStep(3);
  const earlyAfter = await p.evaluate(() => Courses.state('english').path);
  check('досрочный не сдан — снова урок 7 A1, без штрафных дней', earlyAfter.level === 1 && earlyAfter.lesson === 7 && earlyAfter.review === 0 && !earlyAfter.confirmed.A1, earlyAfter);

  // --- последний экзамен C1 → путь пройден ---
  await p.evaluate(() => { const st = Courses.state('english'); st.path.level = 5; st.path.lesson = 51; ['A1', 'A2', 'B1', 'B2'].forEach((x) => { st.path.confirmed[x] = State.todayKey(); }); });
  await freshDay(); await W(400);
  for (let i = 0; i < 4; i += 1) await doStep(i);
  const fin = await p.evaluate(() => ({ st: Courses.state('english'), page: document.querySelector('#courses-root').textContent }));
  check('экзамен C1 сдан — английский до C1 пройден', !!fin.st.finished && fin.st.path.confirmed.C1 && /Курс пройден/.test(fin.page), fin.st.path.confirmed);

  // --- тест на уровень вместо старта с нуля ---
  await p.evaluate(() => { Courses.reset('english'); Courses.open('english'); }); await W(300);
  await p.check('input[name="en-start"][value="place"]');
  await tap('[data-cr-start="english"]'); await W(600); await clean();
  check('«Определить уровень» — первым днём тест на 30 вопросов A0…C1', await p.evaluate(() => { const D = Courses.dayOf('english'); return D.kind === 'place' && D.steps[0].items.length === 30; }));
  await p.evaluate(() => Courses.open('english', 'lesson')); await W(300);
  await doStep(0, { place: (it) => it.lv <= 1 });
  const placed = await p.evaluate(() => ({ path: Courses.state('english').path, task: State.s.tasks.find((t) => t.courseId === 'english' && !t.done) }));
  check('знает A0 и A1 — начинает с A2, A0–A1 засчитаны по тесту', placed.path.level === 2 && placed.path.placed.A0 && placed.path.placed.A1 && !placed.path.placed.A2 && !placed.path.confirmed.A1, placed.path);

  // --- старый 30-дневный курс переносится на путь ---
  const mig = await p.evaluate(() => { const s = State.s.learn.courses; s.english = { started: State.todayKey(), day: 8, done: { 1: '2026-01-01' }, prog: {}, metrics: {}, extra: 0, time: 1080, alarm: true, video: {}, vid: {}, finished: null, failed: false }; return Courses.state('english').path; });
  check('старый курс английского (день 8) → A0, урок 3', mig && mig.level === 0 && mig.lesson === 3, mig);

  // --- стойка: тренировка и замер ---
  await p.evaluate(() => Courses.open('handstand'));
  await p.waitForTimeout(200);
  await tap('[data-cr-start="handstand"]'); await p.waitForTimeout(500); await clean();
  const hs = await p.evaluate(() => Courses.dayOf('handstand', 6));
  check('стойка: день — тренировка с таймером и замер', hs.steps.some((s) => s.type === 'session' && s.session.length >= 3) && hs.steps.some((s) => s.type === 'measure' && s.key === 'wall'), hs.steps.map((s) => s.type));
  const hs14 = await p.evaluate(() => Courses.dayOf('handstand', 14));
  check('на 14-й день — промежуточная проверка «у стены 30 с»', hs14.check === 'wall30' && hs14.steps.some((s) => s.goal === 30), hs14.title);
  await p.evaluate(() => { const st = Courses.state('handstand'); st.day = 14; State.save(); Courses.open('handstand', 'lesson'); });
  await p.waitForTimeout(300);
  await tap('[data-cr-step="0"]'); await p.waitForTimeout(300);
  await tap('#cr-self'); await p.waitForTimeout(400);
  await tap('[data-cr-step="1"]'); await p.waitForTimeout(300);
  await p.fill('#cr-num', '22'); await tap('#cr-save'); await p.waitForTimeout(700); await clean();
  const hsAfter = await p.evaluate(() => { const st = Courses.state('handstand'); return { day: st.day, fin: st.finished, extra: st.extra, m: st.metrics.wall, page: document.querySelector('#courses-root').textContent }; });
  check('промежуточная проверка не завершает курс; замер виден в прогрессе', hsAfter.day === 15 && !hsAfter.fin && !hsAfter.extra && hsAfter.m[0].v === 22 && /Твой прогресс/.test(hsAfter.page), { day: hsAfter.day, fin: hsAfter.fin, extra: hsAfter.extra });

  // --- сальто: без страховки не начать ---
  await p.evaluate(() => Courses.open('backflip'));
  await p.waitForTimeout(200);
  await tap('[data-cr-start="backflip"]'); await p.waitForTimeout(200);
  check('сальто: без подтверждения страховки курс не начинается', /безопасность/i.test(await p.textContent('#cr-err')) && await p.evaluate(() => !Courses.state('backflip')));
  await p.check('#cr-gate'); await tap('[data-cr-start="backflip"]'); await p.waitForTimeout(400); await clean();
  check('с подтверждением — начат', await p.evaluate(() => !!Courses.state('backflip')));

  // --- деньги: дела-чекбоксы ---
  await p.evaluate(() => Courses.open('money'));
  await p.waitForTimeout(200);
  await tap('[data-cr-start="money"]'); await p.waitForTimeout(400); await clean();
  await p.evaluate(() => Courses.open('money', 'lesson')); await p.waitForTimeout(300);
  const m1 = await p.evaluate(() => Courses.dayOf('money', 1).steps.map((s) => s.type));
  check('деньги: видео, объяснение, вопрос, дело дня и замер дохода', m1.join() === 'video,read,test,todo,measure', m1);
  // объяснение простыми словами: карточки по одной
  await tap('[data-cr-step="1"]'); await p.waitForTimeout(300);
  const card = await p.textContent('.cr-card');
  await tap('#cr-rnext'); await p.waitForTimeout(150); await tap('#cr-rnext'); await p.waitForTimeout(400);
  check('объяснение — карточки простыми словами, «Понял» закрывает шаг', /приход больше расхода/.test(card) && await p.evaluate(() => Courses.state('money').prog[1] === 1), card.slice(0, 80));
  // вопрос без пропуска
  await tap('[data-cr-step="2"]'); await p.waitForTimeout(300);
  const qtext = await p.textContent('.cr-ex-body');
  await p.evaluate(() => Array.from(document.querySelectorAll('[data-cr-opt]')).find((x) => x.dataset.crOpt === 'Доход больше трат').click());
  await p.waitForTimeout(800); await tap('#cr-done'); await p.waitForTimeout(400); await clean();
  check('вопрос «понял ли ты» — обычный вопрос с вариантами', /Вопрос/.test(qtext) && await p.evaluate(() => Courses.state('money').prog[2] === 1), qtext.slice(0, 80));
  await tap('[data-cr-step="3"]'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelectorAll('[data-cr-todo]').forEach((x) => { x.click(); }));
  await p.waitForTimeout(200);
  await tap('#cr-tdone'); await p.waitForTimeout(400);
  check('дело дня отмечено — шаг закрыт', await p.evaluate(() => Courses.state('money').prog[3] === 1));
  const mf = await p.evaluate(() => ({ last: Courses.dayOf('money', 30).steps.map((s) => [s.type, s.pass || 0]), rev: (() => { const st = Courses.state('money'); st.extra = 5; const r = [Courses.dayOf('money', 32).title, Courses.dayOf('money', 35).steps.some((x) => x.pass)]; st.extra = 0; return r; })() }));
  check('деньги: в конце экзамен 80%; не сдал — дни повторения, экзамен в последний', mf.last.some(([t, ps]) => t === 'test' && ps === 0.8) && /Повторение/.test(mf.rev[0]) && mf.rev[1] === true, mf);
  const fin2 = await p.evaluate(() => ({ hs: Courses.dayOf('handstand', 35).steps.map((s) => [s.type, s.pass || 0]), bf: Courses.dayOf('backflip', 42).steps.map((s) => [s.type, s.pass || 0]), wk: Courses.dayOf('backflip', 1).steps.map((s) => s.type), err: Courses.dayOf('backflip', 2).steps[0].session.every((x) => x.err) }));
  check('стойка и сальто: итог — экзамен по технике 80% и замер результата', fin2.hs.some(([t, ps]) => t === 'test' && ps === 0.8) && fin2.bf.some(([t, ps]) => t === 'test' && ps === 0.8), fin2);
  check('каждая неделя: видео, объяснение, проверка; в упражнениях — частая ошибка', fin2.wk.join() === 'video,read,test,session' && fin2.err, fin2.wk);

  // --- вкладка с несколькими курсами ---
  await p.evaluate(() => { Courses.open(null); }); await tap('.space-btn[data-space="learn"]'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-cr-home]') && document.querySelector('[data-cr-home]').click()); await p.waitForTimeout(300);
  const homeAct = await p.evaluate(() => document.querySelectorAll('.cr-active').length);
  check('на главной вкладке — мои курсы с прогрессом', homeAct === 4, homeAct);
  check('после перезагрузки окно «Курсы» открывается снова', await (async () => { await p.reload(); await p.waitForTimeout(2600); return p.evaluate(() => document.body.dataset.space === 'learn' && document.querySelector('.tab-panel.active').id === 'tab-courses'); })());
  check('без ошибок на странице', errs.length === 0, errs);

  await b.close();
  console.log(ok ? '\nВСЁ ОК' : '\nЕСТЬ ОШИБКИ'); process.exit(ok ? 0 : 1);
})();
