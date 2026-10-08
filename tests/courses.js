const { chromium } = require('./_browser');
/* Вкладка «🎓 Курсы»: третье окно рядом с «Мои дела» и «Всё остальное».
   Английский A0 → C1: старт → урок дня в ежедневнике и будильнике; шаги по очереди;
   правило темы (карточки и кнопка «📖»), слова (знакомство, проверка, интервалы),
   пазлы (по-русски любой порядок слов), аудирование, тест, говорение с микрофоном;
   видео: позиция, минуты, «досмотрел до конца» → следующий урок, иначе часть 2; экран не гаснет;
   урок закрывает «Английский» из шаблона и задание уровня; будильник после урока молчит;
   «Повторить слова»; лёгкий день (серия цела, урок на завтра); экзамен уровня со словами:
   не сдал → 5 дней повторения с правилом слабой темы → сдал → уровень подтверждён;
   досрочный экзамен; тест на уровень (повтор не задваивает ответы); C1 сдан → путь пройден;
   старый 30-дневный курс переносится на путь; «Начинаю» в будильнике открывает урок.
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
    keepAwake: (on) => { window.__awake = on; },
    takeOpen: () => { const t = window.__open || ''; window.__open = ''; return t; },
  };
  // что сказал голос (для заданий «на слух»)
  window.AndroidApp.speak = (t) => { window.__spoken = t; };
  window.AndroidApp.speakLang = (t) => { window.__spoken = t; };
  try { if (window.speechSynthesis) window.speechSynthesis.speak = (u) => { window.__spoken = u && u.text; }; } catch (e) {}
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
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0, 4).join(' | ')); });
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
  // «Английский» из шаблона дня — урок курса закроет и его
  await p.evaluate(() => { Screens.tasks.add('Английский', 'study', 'mid', false, { due: State.todayKey(), silent: true }); });
  await p.fill('#cr-time', '19:30');
  await tap('[data-en-pick="20"]');
  await tap('[data-cr-start="english"]'); await p.waitForTimeout(600); await clean();
  const started = await p.evaluate(() => ({ st: Courses.state('english'), task: State.s.tasks.find((t) => t.courseId === 'english'), alarms: window.__alarms.slice(-1)[0].filter((a) => /Английский/.test(a.title)) }));
  check('урок дня встал задачей «A0 · урок 1» в «Всё остальное» на 19:30', started.task && started.task.at === 19 * 60 + 30 && started.task.due === (await p.evaluate(() => State.todayKey())) && /A0 · урок 1/.test(started.task.title) && started.task.estimate === 32, started.task);
  check('путь начат: A0, урок 1, 20 минут видео в день', started.st.path.level === 0 && started.st.path.lesson === 1 && started.st.path.videoMin === 20, started.st.path);
  check('и будильником в APK на каждый день в 19:30', started.alarms.length === 7 && started.alarms.every((a) => a.min === 19 * 60 + 30 && !a.skip), started.alarms[0]);
  const myAfter = await p.evaluate(() => document.querySelector('#mytasks-root').textContent.replace(/\s+/g, ' ').replace(/\d/g, ''));
  check('«Мои дела» не тронуты', myAfter === myBefore && await p.evaluate(() => !State.s.plans || !State.s.plans.length));
  const cpage = await p.evaluate(() => document.querySelector('#courses-root').textContent);
  check('на странице: подтверждённый уровень, лестница A0…C1, прогноз, словарь, статистика', /Твой подтверждённый уровень/.test(cpage) && ['A0', 'A1', 'A2', 'B1', 'B2', 'C1'].every((x) => cpage.includes(x)) && await p.evaluate(() => document.querySelectorAll('.en-lv').length === 6 && document.querySelector('.en-lv.now .en-lv-badge').textContent === 'A0') && /Когда подтвердишь уровень/.test(cpage) && /Словарь/.test(cpage) && /601 слов/.test(cpage) && /Твои занятия/.test(cpage) && await p.evaluate(() => document.querySelectorAll('.cr-cal i').length === 84));

  // --- урок: видео, правило темы, слова и упражнения ---
  await tap('.cr-today'); await p.waitForTimeout(500);
  const lesson = await p.evaluate(() => ({ src: (document.querySelector('#cr-yt') || {}).src, steps: Array.from(document.querySelectorAll('.cr-step')).map((x) => [x.querySelector('b').textContent, x.classList.contains('locked')]), awake: window.__awake }));
  check('в уроке — встроенное видео урока 1 A0 (плейлист Бебриса)', /youtube-nocookie\.com\/embed\/HJwTaPns-D0/.test(lesson.src || '') && /list=PLD6SPjEPomauFCdDQwuHubP7F2yIVJnwN/.test(lesson.src), lesson.src);
  check('пока открыт видеоурок — экран не гаснет', lesson.awake === true, lesson.awake);
  const types = await p.evaluate(() => Courses.current('english').steps.map((s) => s.type));
  check('первый день темы: видео, правило, 4 новых слова, пазлы, аудирование, тест, говорение — по очереди', types.join() === 'video,read,words,puzzle-en,puzzle-ru,listening,test,speak' && /Правило/.test(lesson.steps[1][0]) && !lesson.steps[1][1] && lesson.steps.slice(2).every((x) => x[1]), { types, steps: lesson.steps.map((x) => x[0]) });
  // правило всегда под рукой — кнопка «📖»
  await tap('#cr-rule'); await p.waitForTimeout(300);
  const rule = (await p.textContent('#sheet-modal')).replace(/\s+/g, ' ');
  await tap('#cr-rule-ok'); await p.waitForTimeout(300);
  check('«📖 Правило простыми словами» — карточки темы в шторке', /Я, ты, мы, они \+ глагол/.test(rule) && /Формула/.test(rule) && /Частая ошибка/.test(rule), rule.slice(0, 120));

  // плеер присылает время: позиция и «тот самый урок» запоминаются
  const send = (info) => p.evaluate((i) => window.dispatchEvent(new MessageEvent('message', { origin: 'https://www.youtube-nocookie.com', data: JSON.stringify({ event: 'infoDelivery', info: i }) })), info);
  await send({ videoData: { title: 'Английский язык с нуля до продвинутого. Практический курс по приложению English Galaxy. А0. Урок 1', video_id: 'HJwTaPns-D0' }, playlistIndex: 0, duration: 4200 });
  for (let t = 100; t <= 160; t += 1) await send({ currentTime: t, playerState: 1 });
  const vstate = await p.evaluate(() => { const st = Courses.state('english'); return { pos: st.video['A0-1'], vid: st.vid['A0-1'], prog: st.prog[0] }; });
  check('видео: место остановки и прогресс просмотра сохраняются', vstate.pos === 160 && vstate.vid === 'HJwTaPns-D0' && vstate.prog > 0 && vstate.prog < 0.1, vstate);

  // --- решатель шагов ---
  const W = (ms) => p.waitForTimeout(ms);
  const stepsNow = () => p.evaluate(() => Courses.current('english').steps);
  // ответ на вопрос о слове: по тексту вопроса, а на слух — по тому, что сказал голос
  const wordAnswer = () => p.evaluate(() => {
    const all = EnglishPath.WORDS.flat();
    const label = document.querySelector('.cr-q-label').textContent;
    const q = ((document.querySelector('.cr-q') || {}).textContent || '').replace('🔊', '').trim();
    if (/по-английски/.test(label)) return (all.find((w) => w[1] === q) || [])[0];
    const en = /на слух|Послушай/.test(label) ? window.__spoken : q;
    return (all.find((w) => w[0] === en) || [])[1];
  });
  async function doStep(i, o = {}) {
    const s = (await stepsNow())[i];
    await tap(`[data-cr-step="${i}"]`); await W(300);
    if (s.type === 'video') { await tap(o.end ? '#cr-vend' : '#cr-vseen'); await W(800); await clean(); return s; }
    if (s.type === 'read') {
      for (let k = 0; k < s.cards.length; k += 1) { await tap('#cr-rnext'); await W(150); }
      await W(400); await clean();
      return s;
    }
    if (s.type === 'words') {
      for (let k = 0; k < 60; k += 1) {
        if (await p.$('#cr-w-next')) { await tap('#cr-w-next'); await W(120); continue; }
        if (!(await p.$('[data-cr-w]'))) break;
        await W(320);
        const ans = await wordAnswer();
        const pickIt = o.wrong ? await p.evaluate((a) => Array.from(document.querySelectorAll('[data-cr-w]')).map((x) => x.dataset.crW).find((x) => x !== a), ans) : ans;
        await p.evaluate((a) => Array.from(document.querySelectorAll('[data-cr-w]')).find((x) => x.dataset.crW === a).click(), pickIt);
        await W(pickIt === ans ? 820 : 1560);
      }
      if (s.pass) await tap('#cr-done');
      await W(600); await clean();
      return s;
    }
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
  const idxOf = async (type, pred) => (await stepsNow()).findIndex((s) => s.type === type && (!pred || pred(s)));

  // правило темы — карточки по одной
  await doStep(1);
  check('правило прочитано — открылся шаг «Слова»', await p.evaluate(() => Courses.state('english').prog[1] === 1 && !document.querySelectorAll('.cr-step')[2].classList.contains('locked')));
  // слова: знакомство с 4 новыми, потом проверка; первое — ошибкой
  await tap('[data-cr-step="2"]'); await W(300);
  const newWord = await p.evaluate(() => ({ label: document.querySelector('.cr-q-label').textContent, word: document.querySelector('.cr-word b').textContent, ru: document.querySelector('.cr-word span').textContent }));
  check('новое слово — карточка: слово, озвучка, перевод', /Новое слово/.test(newWord.label) && newWord.word === 'be' && newWord.ru === 'быть', newWord);
  await p.click('.cr-head.ex .cr-back'); await W(300);
  await doStep(2);
  const words = await p.evaluate(() => { const st = Courses.state('english'); return { prog: st.prog[2], wsrs: st.path.wsrs, wnext: st.path.wnext }; });
  check('слова выучены: 4 слова в интервальном повторении, следующие новые — с пятого', words.prog === 1 && Object.keys(words.wsrs).length === 4 && words.wnext[0] === 4 && Object.values(words.wsrs).every((x) => x.b === 1), words);

  const s1 = await doStep(3, { wrongFirst: true });
  const after1 = await p.evaluate((k) => ({ view: document.querySelector('#courses-root').dataset.view, locked: Array.from(document.querySelectorAll('.cr-step')).map((x) => x.classList.contains('locked')), prog: Courses.state('english').prog[3], srs: Courses.state('english').path.srs[k] }), s1.items[0].key);
  check('пазл решён — снова урок, следующий шаг открылся', after1.view === 'lesson' && after1.prog === 1 && !after1.locked[4] && after1.locked[5], after1);
  check('ошибка ушла в интервальное повторение на завтра', after1.srs && after1.srs.b === 0 && after1.srs.d > (await p.evaluate(() => State.todayKey())), after1.srs);

  // мягкая перерисовка не сбрасывает упражнение
  await tap('[data-cr-step="4"]'); await W(300);
  await p.evaluate(() => document.querySelector('.cr-pool [data-cr-in]').click());
  await p.evaluate(() => { App.renderActive(); State.commit(); });
  await W(200);
  check('пока решаешь — экран не сбрасывается', await p.evaluate(() => document.querySelectorAll('.cr-answer .cr-chip').length === 1));
  await tap('.cr-head.ex .cr-back'); await W(300);
  await doStep(4, { reverse: true });
  check('по-русски засчитывается любой порядок слов', await p.evaluate(() => Courses.state('english').prog[4] === 1));
  await doStep(5); await doStep(6);
  // говорение: микрофон услышал не то, потом то
  await tap('[data-cr-step="7"]'); await W(300);
  const sp = (await stepsNow())[7];
  await p.evaluate(() => { window.__say = 'hello world'; }); await tap('#cr-mic'); await W(500);
  const spWrong = await p.textContent('.cr-ex-body');
  check('говорение: распознал «не то» — показывает правильную фразу', /Ты сказал/.test(spWrong) && spWrong.includes(sp.items[0].en), spWrong.slice(0, 160));
  for (const it of sp.items) { await p.evaluate((t) => { window.__say = t.toLowerCase(); }, it.en); await tap('#cr-mic'); await W(1300); }
  await W(400); await clean();
  // видео досмотрено до конца → завтра урок 2
  await send({ currentTime: 4190, playerState: 1 });
  await send({ playerState: 0 });
  await W(900); await clean();
  const day1 = await p.evaluate(() => { const st = Courses.state('english'); const t = State.s.tasks.find((x) => x.courseId === 'english'); return { day: st.day, done: st.done[1], path: st.path, task: t && t.done, view: document.querySelector('#courses-root').dataset.view, win: (document.querySelector('.cr-win') || {}).textContent, today: (document.querySelector('.cr-today') || {}).disabled, tpl: (State.s.tasks.find((x) => x.title === 'Английский') || {}).done, quest: Levels.isDone('english'), alarms: window.__alarms.slice(-1)[0].filter((a) => /Английский/.test(a.title)), awake: window.__awake, mins: st.mins }; });
  check('день пройден: задача закрыта, видео досмотрено → завтра урок 2', day1.done && day1.task === true && day1.view === 'course' && day1.path.lesson === 2 && day1.path.part === 1 && /Урок 1 досмотрен/.test(day1.win || '') && day1.today === true, { lesson: day1.path.lesson, win: day1.win });
  check('урок английского закрыл и «Английский» из шаблона, и задание уровня', day1.tpl === true && day1.quest === true, { tpl: day1.tpl, quest: day1.quest });
  check('урок сегодня пройден — будильник урока сегодня молчит', day1.alarms.length === 7 && day1.alarms.every((a) => a.skip === day1.done), day1.alarms[0]);
  check('ушёл из видеоурока — экран снова может гаснуть', day1.awake === false, day1.awake);
  check('правило темы прочитано — завтра его в уроке нет; минуты учёбы посчитаны', !!day1.path.ruleSeen['0.0'] && day1.mins === 32, { seen: day1.path.ruleSeen, mins: day1.mins });

  // --- день 2: без правила, часть 2; ошибки и слова — на повторении ---
  await p.evaluate(() => { const st = Courses.state('english'); Object.keys(st.path.srs).forEach((k) => { st.path.srs[k].d = State.todayKey(); }); Object.keys(st.path.wsrs).forEach((k) => { st.path.wsrs[k].d = State.todayKey(); }); });
  await freshDay(); await W(400);
  const d2 = await stepsNow();
  const d2types = d2.map((s) => s.type);
  const wStep = d2.find((s) => s.type === 'words');
  check('день 2: правила нет; слова — 4 новых и 4 на повторение; фразы на повторении', !d2types.includes('read') && wStep && wStep.items.filter((x) => x.isNew).length === 4 && wStep.items.filter((x) => x.due).length === 4 && d2.some((s) => s.srs === true && s.items.length === 6), d2types);
  for (let i = 1; i < d2.length; i += 1) await doStep(i);
  await doStep(0); await W(400);
  const d2s = await p.evaluate(() => Courses.state('english').path);
  check('видео не досмотрено до конца — завтра часть 2 того же урока', d2s.lesson === 2 && d2s.part === 2, { l: d2s.lesson, p: d2s.part });
  check('верно вспомнил — интервалы фраз и слов выросли', Object.values(d2s.srs).some((x) => x.b >= 2) && Object.values(d2s.wsrs).filter((x) => x.b === 2).length === 4 && Object.keys(d2s.wsrs).length === 8, { w: Object.values(d2s.wsrs).map((x) => x.b) });

  // --- «Повторить слова» в любой момент ---
  await p.evaluate(() => { const st = Courses.state('english'); Object.keys(st.path.wsrs).forEach((k) => { st.path.wsrs[k].d = State.todayKey(); }); Courses.open('english'); });
  await W(300);
  await tap('#en-words-now'); await W(400);
  const pr = await p.evaluate(() => ({ view: document.querySelector('#courses-root').dataset.view, title: document.querySelector('.cr-ex-title').textContent }));
  for (let k = 0; k < 40; k += 1) {
    if (!(await p.$('[data-cr-w]'))) break;
    await W(320);
    const ans = await wordAnswer();
    await p.evaluate((a) => Array.from(document.querySelectorAll('[data-cr-w]')).find((x) => x.dataset.crW === a).click(), ans);
    await W(820);
  }
  await W(400); await clean();
  const prAfter = await p.evaluate(() => ({ view: document.querySelector('#courses-root').dataset.view, path: Courses.state('english').path, day: Courses.state('english').day }));
  check('«Повторить слова»: все слова на сегодня, ответил верно — интервалы выросли, день не тронут', pr.view === 'practice' && /Повторить слова/.test(pr.title) && prAfter.view === 'course' && Object.values(prAfter.path.wsrs).every((x) => x.b >= 2 && x.d > '2026') && prAfter.path.part === 2, { view: prAfter.view, b: Object.values(prAfter.path.wsrs).map((x) => x.b) });

  // --- лёгкий день: 5 минут, серия не рвётся, урок остаётся на завтра ---
  await p.evaluate(() => { const st = Courses.state('english'); st.done = {}; st.path.plan = null; State.save(); Courses.open('english'); });
  await W(300);
  await tap('[data-cr-light="english"]'); await W(300);
  const light = await p.evaluate(() => ({ title: document.querySelector('.cr-lesson-title').textContent, video: !!document.querySelector('#cr-yt'), types: Courses.current('english').steps.map((s) => s.type), light: Courses.light }));
  check('лёгкий день: без видео — фразы и одна фраза вслух', light.light && !light.video && /Лёгкий день/.test(light.title) && light.types.join() === 'puzzle-en,speak', light);
  await doStep(0); await doStep(1);
  const lightAfter = await p.evaluate(() => { const st = Courses.state('english'); return { light: st.light, lesson: st.path.lesson, part: st.path.part, done: Object.keys(st.done).length, view: document.querySelector('#courses-root').dataset.view, page: document.querySelector('#courses-root').textContent, alarms: window.__alarms.slice(-1)[0].filter((a) => /Английский/.test(a.title)), streak: document.querySelector('.cr-fire') && document.querySelector('.cr-fire').textContent }; });
  const todayK = await p.evaluate(() => State.todayKey());
  check('лёгкий день засчитан: серия цела, урок тот же, полный урок можно пройти', lightAfter.light && lightAfter.light[todayK] && lightAfter.lesson === 2 && lightAfter.part === 2 && lightAfter.done === 0 && lightAfter.view === 'course' && /Лёгкий день засчитан/.test(lightAfter.page) && /🔥 1/.test(lightAfter.streak || '') && await p.evaluate(() => !document.querySelector('.cr-today').disabled), { light: lightAfter.light, streak: lightAfter.streak });
  check('после лёгкого дня будильник урока сегодня тоже молчит', lightAfter.alarms.every((a) => a.skip === todayK), lightAfter.alarms[0]);

  // --- экзамен уровня: не сдал → повторение → сдал → уровень подтверждён ---
  await p.evaluate(() => { const st = Courses.state('english'); st.path.lesson = 51; st.path.srs = {}; st.path.wsrs = {}; });
  await freshDay(); await W(400);
  const ex = await stepsNow();
  check('после 50 уроков — экзамен: грамматика 80%, аудирование, перевод, говорение, слова', ex.length === 5 && ex[0].pass === 0.8 && ex[0].items.length === 15 && ex[1].type === 'listening' && ex[3].type === 'speak' && ex[3].pass === 0.6 && ex[4].type === 'words' && ex[4].pass === 0.7 && ex[4].items.length === 10, ex.map((s) => [s.type, s.pass]));
  await doStep(0, { wrong: true });
  const failTxt = await p.evaluate(() => Courses.state('english').failed);
  await doStep(1); await doStep(2); await doStep(3); await doStep(4);
  const afterFail = await p.evaluate(() => ({ path: Courses.state('english').path, D: Courses.current('english') }));
  check('экзамен не сдан — 5 дней повторения слабых тем с правилом, уровень не засчитан', afterFail.path.review === 5 && !afterFail.path.confirmed.A0 && afterFail.path.level === 0 && /Повторение перед пересдачей/.test(afterFail.D.title) && afterFail.D.steps[0].type === 'read' && /Правило слабой темы/.test(afterFail.D.steps[0].title) && afterFail.path.weak['0.0'] > 0, { review: afterFail.path.review, title: afterFail.D.title, failTxt });
  await p.evaluate(() => { Courses.state('english').path.review = 0; });
  await freshDay(); await W(400);
  for (let i = 0; i < 5; i += 1) await doStep(i);
  const passed = await p.evaluate(() => ({ path: Courses.state('english').path, page: document.querySelector('#courses-root').textContent, main: document.querySelector('.en-level-main b').textContent }));
  check('экзамен сдан — A0 подтверждён, открыт A1', passed.path.confirmed.A0 && passed.path.level === 1 && passed.path.lesson === 1 && passed.main === 'A0' && /подтверждён экзаменом/.test(passed.page), { main: passed.main, lv: passed.path.level });

  // --- досрочный экзамен: не сдал — вернулся к своему уроку ---
  await p.evaluate(() => { const st = Courses.state('english'); st.path.lesson = 7; st.done = {}; st.light = {}; st.path.plan = null; State.save(); Courses.open('english'); });
  await W(300);
  await tap('#en-exam-now'); await tap('#en-exam-now'); await W(400);
  const early = await stepsNow();
  check('«Сдать экзамен досрочно» — экзамен A1 вместо урока', /Экзамен уровня A1/.test(await p.evaluate(() => Courses.current('english').title)) && early.length === 5);
  await doStep(0, { wrong: true }); await doStep(1); await doStep(2); await doStep(3); await doStep(4);
  const earlyAfter = await p.evaluate(() => Courses.state('english').path);
  check('досрочный не сдан — снова урок 7 A1, без штрафных дней', earlyAfter.level === 1 && earlyAfter.lesson === 7 && earlyAfter.review === 0 && !earlyAfter.confirmed.A1, earlyAfter);

  // --- последний экзамен C1 → путь пройден ---
  await p.evaluate(() => { const st = Courses.state('english'); st.path.level = 5; st.path.lesson = 51; ['A1', 'A2', 'B1', 'B2'].forEach((x) => { st.path.confirmed[x] = State.todayKey(); }); });
  await freshDay(); await W(400);
  for (let i = 0; i < 5; i += 1) await doStep(i);
  const fin = await p.evaluate(() => ({ st: Courses.state('english'), page: document.querySelector('#courses-root').textContent }));
  check('экзамен C1 сдан — английский до C1 пройден', !!fin.st.finished && fin.st.path.confirmed.C1 && /Курс пройден/.test(fin.page), fin.st.path.confirmed);

  // --- тест на уровень вместо старта с нуля ---
  await p.evaluate(() => { Courses.reset('english'); Courses.open('english'); }); await W(300);
  await p.check('input[name="en-start"][value="place"]');
  await tap('[data-cr-start="english"]'); await W(600); await clean();
  check('«Определить уровень» — первым днём тест на 30 вопросов A0…C1', await p.evaluate(() => { const D = Courses.current('english'); return D.kind === 'place' && D.steps[0].items.length === 30; }));
  await p.evaluate(() => Courses.open('english', 'lesson')); await W(300);
  // начал тест, ответил верно на 10 вопросов (A0 и A1) и вышел — потом прошёл заново, зная только A0
  await tap('[data-cr-step="0"]'); await W(300);
  const placeItems = (await stepsNow())[0].items;
  for (const it of placeItems.slice(0, 10)) { await p.evaluate((a) => Array.from(document.querySelectorAll('[data-cr-opt]')).find((x) => x.dataset.crOpt === a).click(), it.a); await W(780); }
  await tap('.cr-head.ex .cr-back'); await W(300);
  await doStep(0, { place: (it) => it.lv === 0 });
  const placed = await p.evaluate(() => ({ path: Courses.state('english').path, acc: Courses.state('english').acc }));
  check('тест на уровень: повторное прохождение не задваивает ответы — начинаем с A1', placed.path.level === 1 && placed.path.placed.A0 && !placed.path.placed.A1 && !placed.path.confirmed.A0, placed.path.placed);
  check('ответы теста на уровень (наугад) не портят статистику точности', !placed.acc || !placed.acc.t, placed.acc);

  // --- старый 30-дневный курс переносится на путь ---
  const mig = await p.evaluate(() => { const s = State.s.learn.courses; s.english = { started: State.todayKey(), day: 8, done: { 1: '2026-01-01' }, prog: {}, metrics: {}, extra: 0, time: 1080, alarm: true, video: {}, vid: {}, finished: null, failed: false }; return Courses.state('english').path; });
  check('старый курс английского (день 8) → A0, урок 3', mig && mig.level === 0 && mig.lesson === 3 && mig.wsrs && mig.ruleSeen, mig);

  // --- будильник урока: «Начинаю» открывает сразу урок ---
  await p.evaluate(() => { App.go('mytasks'); window.__open = '🎓 Английский: урок дня'; window.onAlarmOpen(); });
  await W(400);
  const opened = await p.evaluate(() => ({ space: document.body.dataset.space, view: document.querySelector('#courses-root').dataset.view }));
  check('будильник урока → «Начинаю» → сразу открыт урок курса', opened.space === 'learn' && opened.view === 'lesson', opened);
  await p.evaluate(() => { window.__open = '☀️ Подъём'; window.onAlarmOpen(); });
  await W(300);
  check('другой будильник → «Начинаю» → «Мои дела»', await p.evaluate(() => document.body.dataset.space === 'tasks'));
  await p.evaluate(() => App.go('courses')); await W(300);

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

  // лёгкий день у тренировки: разминка и одно упражнение, 1 круг
  const hsLight = await p.evaluate(() => { const st = Courses.state('handstand'); st.done = {}; State.save(); Courses.open('handstand'); document.querySelector('[data-cr-light="handstand"]').click(); return Courses.current('handstand').steps.map((s) => [s.type, s.sets, (s.session || []).length]); });
  check('стойка: лёгкий день — мини-тренировка, 2 упражнения, 1 круг', hsLight.length === 1 && hsLight[0][0] === 'session' && hsLight[0][1] === 1 && hsLight[0][2] === 2, hsLight);
  await tap('[data-cr-step="0"]'); await p.waitForTimeout(300);
  await tap('#cr-self'); await p.waitForTimeout(500); await clean();
  check('лёгкий день у стойки засчитан — курс на том же дне', await p.evaluate(() => { const st = Courses.state('handstand'); return !!(st.light && st.light[State.todayKey()]) && st.day === 15; }));

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
