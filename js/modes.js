'use strict';
/* =========================================================
   MODES — два разных приложения в одном.

   СДВГ: время и следующее действие должны быть снаружи, перед глазами,
   в момент, когда надо действовать (Barkley: «point of performance»).
   Поэтому один огромный экран «Сейчас» с тающим таймером, старт одной
   кнопкой, предупреждения о переходе, срочность и новизна — «успей до»,
   комбо, случайный сюрприз (Dodson: нервная система, которую включают
   интерес, новизна, вызов и срочность, а не «важность»).
   Остальное свёрнуто, чтобы не утонуть.

   Обычный: спокойный планер. Неделя целиком, цифры, меньше шума,
   без случайных наград — ровная и предсказуемая обратная связь.
   ========================================================= */

const Modes = (() => {
  const { $ } = UI;
  const isADHD = () => State.s.mode === 'adhd';
  let clock = null;
  let dayOpen = false;         // СДВГ: развернуть весь день на экране «День»
  const warned = {};           // какие предупреждения о переходе уже прозвучали

  /* ---------- что делать прямо сейчас ---------- */
  function target() {
    const pl = typeof Planner !== 'undefined' ? Planner.plan() : null;
    const now = Track.nowMin();
    if (!pl) {
      const t = State.s.tasks.filter((x) => !x.done)
        .sort((a, b) => (b.priority === 'boss') - (a.priority === 'boss') || (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0))[0];
      return t ? { kind: 'loose', task: t } : { kind: 'empty' };
    }
    const sk = pl.skipped || {};
    const open = (b) => b.kind === 'task' && !sk[b.id] && !Planner.isDone(b);
    const here = pl.blocks.filter((b) => now >= b.start && now < b.end);
    const curTask = here.find(open);
    const ctx = here.find((b) => b.kind !== 'task') || here[0] || null;
    const next = pl.blocks.find((b) => b.start > now && open(b)) || null;
    if (curTask) return { kind: 'task', block: curTask, next: pl.blocks.find((b) => b.start >= curTask.end && open(b)) || null };
    const late = pl.blocks.filter((b) => open(b) && b.end <= now && now - b.end < 120).pop();
    if (late && (!next || next.start - now > 20)) return { kind: 'late', block: late, next };
    if (next) return { kind: 'between', ctx, next };
    const left = pl.blocks.filter(open).length;
    return left ? { kind: 'late', block: pl.blocks.filter(open).pop(), next: null } : { kind: 'done', ctx };
  }

  const mmss = (sec) => {
    const s = Math.max(0, Math.round(sec));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
  };
  const secNow = () => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); };
  const inWords = (min) => (min >= 60 ? `${Math.floor(min / 60)} ч ${min % 60 ? `${min % 60} мин` : ''}`.trim() : `${min} мин`);

  function noteFor(b) {
    if (!b) return '';
    if (typeof Coach !== 'undefined') { const c = Coach.noteFor(b); if (c) return c; }
    if (typeof Week !== 'undefined') {
      const x = Week.PLAN.find((p) => p.title === (b.taskTitle || b.task || b.title));
      if (x && x.note) return x.note;
    }
    const t = b.taskId && State.s.tasks.find((x) => x.id === b.taskId);
    const sub = t && (t.subtasks || []).find((x) => !x.done);
    return sub ? `Первый шаг: ${sub.text}` : '';
  }

  /* ---------- идеальный день: сколько осталось ----------
     Эффект градиента цели (Kivetz, 2006): чем ближе финиш, тем быстрее идёшь,
     и «осталось 3» мотивирует сильнее, чем «сделано 12 из 15».
     «Ты здесь» и «день спланирован» засчитаны сразу — подаренный прогресс (Nunes & Drèze, 2006)
     заметно повышает шанс дойти до конца. */
  function perfectDay() {
    const pl = typeof Planner !== 'undefined' ? Planner.plan() : null;
    const sk = (pl && pl.skipped) || {};
    const tasks = pl ? pl.blocks.filter((b) => b.kind === 'task' && sk[b.id] !== 'moved' && sk[b.id] !== 'tomorrow') : [];
    const gift = [
      { t: 'Ты сегодня здесь', done: true },
      { t: 'День спланирован', done: !!pl },
    ];
    const done = tasks.filter((b) => Planner.isDone(b)).length + gift.filter((g) => g.done).length;
    const total = tasks.length + gift.length;
    const left = total - done;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { done, total, left, pct, tasks: tasks.length };
  }

  function perfectHTML(compact) {
    const p = perfectDay();
    if (!p.tasks) return '';
    const msg = p.left === 0 ? '🏆 Идеальный день! Всё закрыто.'
      : p.left === 1 ? '🔥 Осталось одно дело до идеального дня'
      : p.left <= 3 ? `🔥 Осталось ${UI.plur(p.left, 'дело', 'дела', 'дел')} — финиш рядом`
      : `До идеального дня — ${UI.plur(p.left, 'дело', 'дела', 'дел')}`;
    return `
      <div class="perfect ${p.left <= 3 ? 'close' : ''} ${compact ? 'compact' : ''}">
        <div class="perfect-head"><b>${msg}</b><span>${p.pct}%</span></div>
        <div class="perfect-bar"><span style="width:${p.pct}%"></span></div>
      </div>`;
  }

  /* ---------- серии по каждому делу ----------
     Не «ты молодец», а кто ты: «ты тот, кто публикует каждый день».
     Серия, которую жалко рвать, держит лучше обещаний себе. */
  const IDENTITY = {
    'ТТ видео — кино': 'ты тот, кто публикует каждый день',
    'ТТ видео — orca': 'ты тот, кто публикует каждый день',
    'Английский': 'ты человек, который говорит по-английски — каждый день',
    'Работа над заработком': 'ты тот, кто делает шаги к деньгам, а не мечтает',
    'Тренировка': 'ты тот, кто не пропускает тренировки',
    'YouTube': 'ты автор, а не зритель',
    'OLX: объявления и обмены': 'ты умеешь превращать вещи в деньги',
  };
  const taskTitleOf = (b) => b.taskTitle || b.task || b.title;

  function chainHTML(b) {
    if (!b || b.kind !== 'task') return '';
    const title = taskTitleOf(b);
    const n = State.chain(title);
    if (n < 2) return '';
    const who = IDENTITY[title];
    return `<div class="an-chain">🔥 ${UI.plur(n, 'день', 'дня', 'дней')} подряд${who ? ` — ${who}` : ''}. Не рви цепочку.</div>`;
  }

  /* лучшие серии — для обычного режима */
  function chainsHTML() {
    if (typeof DayTpl === 'undefined') return '';
    const seen = new Set();
    const list = DayTpl.items().filter((x) => x.on && !seen.has(x.title) && seen.add(x.title))
      .map((x) => ({ t: x.title, n: State.chain(x.title) }))
      .filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 4);
    if (!list.length) return '';
    return `<div class="chains">${list.map((x) => `<span class="chain-chip">🔥 ${x.n} · ${UI.esc(x.t)}</span>`).join('')}</div>`;
  }

  /* ---------- «с чистого листа» ----------
     Понедельник, первое число, возвращение после пропуска — моменты,
     когда люди охотнее берутся за цели (эффект нового начала,
     Dai, Milkman, Riis, 2014). Предлагаем начать заново именно тогда. */
  function freshStart() {
    const d = new Date();
    const today = State.todayKey();
    if ((State.s.freshSeen || '') === today) return null;
    const yesterday = State.daysAgoKey(1);
    const wasActive = State.s.dailyTaskCounts[yesterday] || (State.s.day && State.s.day[yesterday] && State.s.day[yesterday].wakeAt !== null);
    if (d.getDate() === 1) return { emoji: '🌅', title: 'Новый месяц — чистый лист', text: 'Прошлое не считается. Этот месяц начинается с первого дела по графику.' };
    if (d.getDay() === 1) {
      let week = 0;
      for (let i = 1; i <= 7; i++) week += State.s.dailyTaskCounts[State.daysAgoKey(i)] || 0;
      return { emoji: '🗓️', title: 'Новая неделя — чистый лист',
        text: week ? `На прошлой неделе закрыто ${UI.plur(week, 'дело', 'дела', 'дел')}. Эта неделя — шанс побить.` : 'Эта неделя начинается сейчас. Первое дело — самое важное.' };
    }
    if (!wasActive && Object.keys(State.s.dailyTaskCounts).length) {
      return { emoji: '🌱', title: 'Вчера мимо? Сегодня новый день', text: 'Одно пропущенное — не провал. Два подряд — уже привычка. Сделай сегодня хотя бы первое дело.' };
    }
    return null;
  }

  function renderFresh() {
    const el = $('#fresh-banner');
    if (!el) return;
    const f = freshStart();
    if (!f) { el.innerHTML = ''; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `
      <span class="fresh-emoji">${f.emoji}</span>
      <span class="fresh-text"><b>${f.title}</b><small>${UI.esc(f.text)}</small></span>
      <button class="fresh-x" id="fresh-x" aria-label="Скрыть">✕</button>`;
    $('#fresh-x').onclick = () => { State.s.freshSeen = State.todayKey(); State.save(); renderFresh(); };
  }

  /* ---------- экран «Сейчас» для СДВГ ---------- */
  function renderNow() {
    const el = $('#adhd-now');
    if (!el) return;
    if (!isADHD()) { el.innerHTML = ''; return; }
    const tg = target();
    const combo = comboNow();
    const comboHTML = combo >= 2 ? `<span class="an-combo">🔥 Комбо ×${combo}</span>` : '';

    if (tg.kind === 'empty' || tg.kind === 'done') {
      el.innerHTML = `
        <div class="an-top"><span class="an-tag ok">${tg.kind === 'done' ? 'ВСЁ ЗАКРЫТО' : 'СЕЙЧАС СВОБОДНО'}</span>${comboHTML}</div>
        <div class="an-free">
          <div class="an-emoji big">${tg.kind === 'done' ? '🏆' : '🌿'}</div>
          <h2>${tg.kind === 'done' ? 'Дела на сегодня сделаны' : 'Нет дел на сейчас'}</h2>
          <p class="muted">${tg.kind === 'done' ? 'Отдыхай без чувства вины — ты это заработал.' : 'Добавь одно дело — и я поставлю его на ближайшее окно.'}</p>
        </div>
        ${perfectHTML(true)}`;
      return;
    }

    if (tg.kind === 'loose') {
      const t = tg.task;
      el.innerHTML = `
        <div class="an-top"><span class="an-tag">ОДНО ДЕЛО</span>${comboHTML}</div>
        <div class="an-what solo"><div class="an-emoji">${(Data.categoryById(t.category) || {}).emoji || '✅'}</div><h2>${UI.esc(t.title)}</h2></div>
        <div class="an-actions">
          <button class="btn btn-primary an-start" data-an="start-loose" data-id="${t.id}">▶ СТАРТ · 15 мин</button>
          <button class="btn an-done" data-an="done-loose" data-id="${t.id}">✓ Готово</button>
        </div>
        <div class="an-sub"><button class="linkbtn" data-an="stuck-loose" data-id="${t.id}">🧩 Не могу начать</button></div>`;
      return;
    }

    if (tg.kind === 'between') {
      const n = tg.next;
      const ctx = tg.ctx;
      const until = n.start * 60 - secNow();
      const span = Math.max(60, (n.start - (ctx ? ctx.start : n.start - 60)) * 60);
      const rest = ctx && (ctx.kind === 'rest' || ctx.sub === 'rest');
      el.innerHTML = `
        <div class="an-top"><span class="an-tag">${ctx ? `СЕЙЧАС · ${ctx.emoji} ${UI.esc(ctx.title)} · до ${Track.hhmm(ctx.end)}` : 'СЕЙЧАС · ПАУЗА'}</span>${comboHTML}</div>
        <div class="an-main">
          <div class="an-timer calm" style="--p:${Math.min(1, until / span).toFixed(4)}" data-until="${n.start * 60}" data-span="${span}">
            <b class="an-mm">${mmss(until)}</b><small>до старта</small>
          </div>
          <div class="an-what">
            <small class="an-kicker">Следующее — в ${Track.hhmm(n.start)}${n.hard ? ' · ровно' : ''}</small>
            <div class="an-emoji">${n.emoji}</div>
            <h2>${UI.esc(n.title)}</h2>
            <p>${rest ? 'Сейчас отдых по графику — он тоже часть плана. Я позову за 2 минуты.' : UI.esc(noteFor(n)) || 'Я напомню заранее — пока занимайся тем, что по графику.'}</p>
          </div>
        </div>
        <div class="an-sub">
          <button class="linkbtn" data-an="early" data-id="${n.id}">⚡ Начать раньше</button>
          <button class="linkbtn" data-an="why" data-id="${n.id}">Почему в ${Track.hhmm(n.start)}?</button>
        </div>
        ${perfectHTML(true)}`;
      return;
    }

    const b = tg.block;
    const late = tg.kind === 'late';
    const left = b.end * 60 - secNow();
    const span = (b.end - b.start) * 60;
    const quick = Math.min(15, b.end - b.start);
    el.innerHTML = `
      <div class="an-top">
        <span class="an-tag ${late ? 'late' : 'live'}">${late ? `ПРОПУЩЕНО · было в ${Track.hhmm(b.start)}` : `СЕЙЧАС · ${Track.hhmm(b.start)}–${Track.hhmm(b.end)}`}</span>
        ${comboHTML}
      </div>
      <div class="an-main">
        ${late
          ? `<div class="an-timer late" style="--p:1"><b>${quick}</b><small>мин хватит</small></div>`
          : `<div class="an-timer" style="--p:${Math.min(1, left / span).toFixed(4)}" data-until="${b.end * 60}" data-span="${span}">
              <b class="an-mm">${mmss(left)}</b><small>осталось</small></div>`}
        <div class="an-what">
          <div class="an-emoji">${b.emoji}</div>
          <h2>${UI.esc(b.title)}</h2>
          <p>${late ? 'Не весь, а короткую версию — 15 минут засчитываются так же, как целое.' : UI.esc(noteFor(b))}</p>
        </div>
      </div>
      ${chainHTML(b)}
      ${!late && !b.chill ? `<div class="an-challenge">⚡ Успей до ${Track.hhmm(b.end)} — опыт ×2${b.hard ? ' · публикация ровно в это время' : ''}</div>` : ''}
      <div class="an-actions">
        <button class="btn btn-primary an-start" data-an="${late ? 'quick' : 'start'}" data-id="${b.id}">▶ ${late ? `${quick} МИНУТ` : 'СТАРТ'}</button>
        <button class="btn an-done" data-an="done" data-id="${b.id}">✓ Готово</button>
      </div>
      <div class="an-sub">
        <button class="linkbtn" data-an="stuck" data-id="${b.id}">🧩 Не могу начать</button>
        ${b.hard ? '' : `<button class="linkbtn" data-an="skip" data-id="${b.id}">⏭ ${late ? 'Отпустить' : 'Пропустить'}</button>`}
      </div>
      ${tg.next ? `<div class="an-next">Потом в ${Track.hhmm(tg.next.start)}: ${tg.next.emoji} ${UI.esc(tg.next.title)}</div>` : ''}
      ${perfectHTML(true)}`;
  }

  /* каждую секунду двигаем только цифры и круг — без перерисовки */
  function paintClock() {
    const s = secNow();
    document.querySelectorAll('.an-timer[data-until]').forEach((t) => {
      const left = Number(t.dataset.until) - s;
      const span = Number(t.dataset.span) || 1;
      if (left <= 0) { renderNow(); return; }
      t.style.setProperty('--p', Math.min(1, left / span).toFixed(4));
      const b = t.querySelector('.an-mm');
      if (b) b.textContent = mmss(left);
      t.classList.toggle('hurry', left < 300);
    });
    paintMiniClock(s);
  }

  /* часы в мини-плеере: время до конца дела видно на любой вкладке */
  function paintMiniClock(s) {
    const el = $('#mini-clock');
    if (!el) return;
    if (!isADHD() || !Planner.plan()) { el.classList.add('hidden'); return; }
    const tg = target();
    let until = null, label = '', mode = '';
    if (tg.kind === 'task') { until = tg.block.end * 60; label = tg.block.title; mode = 'live'; }
    else if (tg.kind === 'between') { until = tg.next.start * 60; label = 'до: ' + tg.next.title; mode = 'wait'; }
    if (until === null) { el.classList.add('hidden'); return; }
    const left = until - (s === undefined ? secNow() : s);
    el.classList.remove('hidden');
    el.className = `mini-clock ${mode} ${left < 300 ? 'hurry' : ''}`;
    el.innerHTML = `<b>${mmss(left)}</b><small>${UI.esc(label)}</small>`;
    el.title = label;
  }

  function startClock() {
    clearInterval(clock);
    clock = setInterval(() => { if (!document.hidden && isADHD()) paintClock(); }, 1000);
  }

  /* ---------- действия ---------- */
  function blockById(id) { const pl = Planner.plan(); return pl ? pl.blocks.find((b) => b.id === id) : null; }

  function startBlock(b, minutes) {
    if (!b) return;
    // тренировка, готовка и разбор с ИИ ведут по шагам, а не просто таймером
    if (typeof Coach !== 'undefined' && Coach.start(b)) {
      State.s.challenge = { taskId: b.taskId, until: Date.now() + Math.max(1, b.end - Track.nowMin()) * 60000, x2: !minutes };
      return;
    }
    if (b.habitId) {
      const h = State.s.habits.find((x) => x.id === b.habitId);
      if (h) Screens.habits.toggleDay(h, State.todayKey());
      return;
    }
    if (b.pathId) { App.go('path'); setTimeout(() => Screens.path.openStep(b.pathId), 220); return; }
    const mins = minutes || Math.max(5, Math.min(50, b.end - Track.nowMin()));
    if (b.chill && typeof Chill !== 'undefined') { Chill.start(mins, b.title, b.taskId); return; }
    State.s.challenge = { taskId: b.taskId, until: Date.now() + Math.max(1, b.end - Track.nowMin()) * 60000, x2: !minutes };
    State.save();
    App.go('adhd');
    setTimeout(() => Screens.focus.quickStart(mins, b.title, b.taskId), 250);
  }

  function completeBlock(b, el) {
    if (!b || Planner.isDone(b)) return;
    if (b.habitId) {
      const h = State.s.habits.find((x) => x.id === b.habitId);
      if (h) Screens.habits.toggleDay(h, State.todayKey(), el);
      return;
    }
    if (b.pathId) { App.go('path'); setTimeout(() => Screens.path.openStep(b.pathId), 220); return; }
    const t = State.s.tasks.find((x) => x.id === b.taskId);
    if (t) Screens.tasks.complete(t, el);
  }

  /* «не могу начать»: самое маленькое первое движение + 2 минуты.
     Начатое тянет закончить — застревают на входе, а не в середине. */
  const FIRST_MOVE = {
    study: 'Открой учебник или приложение на нужной странице. Только открыть.',
    creative: 'Открой редактор и перетащи первый клип на дорожку.',
    money: 'Открой сайт и найди одно объявление. Одно.',
    health: 'Надень форму и кроссовки. Больше ничего.',
    home: 'Достань всё нужное на стол.',
    work: 'Открой файл и напиши первую строку, даже кривую.',
    other: 'Сделай самое первое физическое движение — на 2 минуты.',
  };

  function stuck(taskId, title) {
    const t = State.s.tasks.find((x) => x.id === taskId);
    const sub = t && (t.subtasks || []).find((x) => !x.done);
    const move = sub ? sub.text : (FIRST_MOVE[t && t.category] || FIRST_MOVE.other);
    const body = UI.sheet(`
      <div class="stuck">
        <div class="demand-emoji">🧩</div>
        <h2>Не надо делать всё</h2>
        <p class="muted">Мозгу с СДВГ тяжело не само дело, а вход в него. Поэтому только первое движение:</p>
        <div class="stuck-move">${UI.esc(move)}</div>
        <p class="muted small">Две минуты — и можно бросить. Честно. Чаще всего не бросишь.</p>
        <button class="btn btn-primary btn-lg btn-block" data-st="go">▶ 2 минуты</button>
        <button class="btn btn-ghost btn-block" data-st="body">👥 Делать «вместе» — с таймером и музыкой</button>
      </div>`);
    body.addEventListener('click', (e) => {
      const k = e.target.closest('[data-st]');
      if (!k) return;
      UI.closeModal('#sheet-modal');
      State.s.totals.microStarts = (State.s.totals.microStarts || 0) + 1;
      State.save();
      App.go('adhd');
      if (k.dataset.st === 'body') {
        setTimeout(() => {
          Screens.focus.quickStart(15, title, taskId);
          if (typeof Music !== 'undefined' && !Music.playing) Music.play(State.s.music && State.s.music.station);
        }, 250);
      } else setTimeout(() => Screens.focus.quickStart(2, move, taskId), 250);
    });
  }

  function bindNow() {
    const el = $('#adhd-now');
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-an]');
      if (!a) return;
      const id = a.dataset.id;
      const act = a.dataset.an;
      Sound.sfx('click');
      if (act === 'start') { startBlock(blockById(id)); return; }
      if (act === 'quick') { startBlock(blockById(id), 15); return; }
      if (act === 'early') { startBlock(blockById(id), 25); return; }
      if (act === 'done') { completeBlock(blockById(id), a); return; }
      if (act === 'skip') { Planner.skip(id); UI.toast('Ок, дальше', 'default', '⏭️'); renderNow(); return; }
      if (act === 'why') { App.go('day'); setTimeout(() => Screens.day.explain(id), 220); return; }
      if (act === 'stuck') { const b = blockById(id); if (b) stuck(b.taskId, b.title); return; }
      if (act === 'start-loose') { const t = State.s.tasks.find((x) => x.id === id); App.go('adhd'); setTimeout(() => Screens.focus.quickStart(15, t ? t.title : '', id), 250); return; }
      if (act === 'done-loose') { const t = State.s.tasks.find((x) => x.id === id); if (t) Screens.tasks.complete(t, a); return; }
      if (act === 'stuck-loose') { const t = State.s.tasks.find((x) => x.id === id); stuck(id, t ? t.title : ''); }
    });
  }

  /* ---------- награда за сделанное ---------- */
  function comboNow() {
    const c = State.s.combo;
    if (!c || c.date !== State.todayKey()) return 0;
    return Date.now() - c.lastAt < 90 * 60000 ? c.n : 0;
  }

  /* зовётся из Screens.tasks.complete после обычной награды */
  function onComplete(task, el, xp, skill) {
    const today = State.todayKey();
    const c = State.s.combo && State.s.combo.date === today ? State.s.combo : { date: today, n: 0, lastAt: 0, best: 0 };
    c.n = Date.now() - c.lastAt < 90 * 60000 ? c.n + 1 : 1;
    c.lastAt = Date.now();
    c.best = Math.max(c.best || 0, c.n);
    State.s.combo = c;

    /* идеальный день — один раз за день, в обоих режимах */
    const pd = perfectDay();
    if (pd.tasks && pd.left === 0 && State.s.perfectDate !== today) {
      State.s.perfectDate = today;
      State.s.totals.perfectDays = (State.s.totals.perfectDays || 0) + 1;
      const bonus = State.addXP(50);
      setTimeout(() => {
        Sound.sfx('fanfare');
        FX.fireworks(5);
        UI.toast(`Идеальный день! Всё по графику закрыто · +${bonus} XP`, 'level', '🏆');
      }, 600);
    }

    if (!isADHD()) return;          // обычный режим — ровная награда без сюрпризов

    const parts = [];
    let extra = 0;
    const ch = State.s.challenge;
    if (ch && ch.taskId === task.id && Date.now() <= ch.until && ch.x2) {
      extra += State.addXP(xp, skill);
      parts.push('успел до конца блока — опыт ×2');
    }
    State.s.challenge = null;
    if (c.n >= 2) {
      extra += State.addXP(Math.min(25, 5 * (c.n - 1)), skill);
      parts.push(`🔥 комбо ×${c.n}`);
    }
    if (parts.length) {
      UI.toast(`${parts.join(' · ')} · +${extra} XP`, 'level', '⚡');
      if (c.n >= 3 && typeof FX !== 'undefined') FX.fireworks(Math.min(4, c.n - 1));
    }
    /* Случайный сюрприз: переменное подкрепление держит интерес дольше,
       чем одинаковая награда, — поэтому только в режиме СДВГ, где новизна
       и есть топливо. Примерно каждое четвёртое дело. */
    if (Math.random() < 0.25) setTimeout(() => surprise(el), 900);
  }

  const SURPRISES = [
    { w: 4, run: () => { const n = 15 + Math.floor(Math.random() * 46); State.addCoins(n); return [`Сундук: +${n} монет`, '🎁']; } },
    { w: 3, run: () => { const n = 10 + Math.floor(Math.random() * 21); State.addXP(n); return [`Искра: +${n} опыта`, '✨']; } },
    { w: 1, run: () => { const n = 100; State.addCoins(n); return [`ДЖЕКПОТ: +${n} монет!`, '💎']; } },
    { w: 2, run: () => [['Ты из тех, кто делает, а не думает о том, чтобы сделать.', 'Это и есть разница между «хочу» и «имею».', 'Сделанное дело весит больше идеального плана.'][Math.floor(Math.random() * 3)], '💬'] },
  ];

  function surprise(el) {
    const total = SURPRISES.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * total;
    const pick = SURPRISES.find((x) => (r -= x.w) < 0) || SURPRISES[0];
    const [text, emoji] = pick.run();
    State.s.totals.surprises = (State.s.totals.surprises || 0) + 1;
    State.commit();
    Sound.sfx('fanfare');
    if (el && el.isConnected) FX.confettiFrom(el, 50, { power: 12 });
    else FX.confetti(window.innerWidth / 2, window.innerHeight / 3, 50);
    UI.toast(text, 'level', emoji);
  }

  /* ---------- предупреждения о переходе (СДВГ) ----------
     Переключение — самое трудное место: заранее сказать «через 5 минут
     конец» проще, чем выдёргивать человека в ноль. */
  /* вечером, когда до идеального дня два-три дела, — сказать об этом:
     рядом с финишем люди ускоряются, если финиш видно */
  function eveningRescue() {
    const now = Track.nowMin();
    if (now < 21 * 60 + 10 || now > 21 * 60 + 45) return;
    if (State.s.rescueDate === State.todayKey()) return;
    const pd = perfectDay();
    if (!pd.tasks || pd.left === 0 || pd.left > 3) return;
    State.s.rescueDate = State.todayKey();
    State.save();
    UI.toast(`До идеального дня ${pd.left === 1 ? 'одно дело' : UI.plur(pd.left, 'дело', 'дела', 'дел')}. Успеешь до 22:00 — и день твой.`, 'warn', '🏁');
    Sound.sfx('quest');
  }

  function tick() {
    if (!Planner.plan()) return;
    eveningRescue();
    if (!isADHD()) return;
    const now = Track.nowMin();
    const pl = Planner.plan();
    const sk = pl.skipped || {};
    const quiet = (typeof App !== 'undefined' && App.isQuietNow) ? App.isQuietNow() : false;
    if (quiet) return;
    pl.blocks.forEach((b) => {
      if (b.kind !== 'task' || sk[b.id] || Planner.isDone(b)) return;
      const toEnd = b.end - now;
      const toStart = b.start - now;
      const nx = pl.blocks.find((x) => x.start >= b.end && x.kind === 'task' && !sk[x.id] && !Planner.isDone(x));
      if (now >= b.start && toEnd <= 5 && toEnd > 0 && !warned[b.id + ':end']) {
        warned[b.id + ':end'] = 1;
        UI.toast(`Через ${toEnd} мин конец «${b.title}».${nx ? ` Дальше — ${nx.title}.` : ''} Закругляйся.`, 'warn', '⏳');
        Sound.sfx('tick');
        FX.vibrate(40);
      }
      if (toStart <= 2 && toStart > 0 && !b.pinned && !warned[b.id + ':soon']) {
        warned[b.id + ':soon'] = 1;
        UI.toast(`Через ${toStart} мин: ${b.title}. Заканчивай то, что сейчас.`, 'warn', b.emoji || '⏰');
        Sound.sfx('quest');
      }
      /* дело идёт уже 5 минут, а таймер не запущен — мягко подтолкнуть */
      if (now - b.start >= 5 && now - b.start < 7 && toEnd > 5 && !warned[b.id + ':nudge']
          && !(Screens.focus && Screens.focus.running)) {
        warned[b.id + ':nudge'] = 1;
        UI.toast(`«${b.title}» уже идёт. Нажми СТАРТ хотя бы на 2 минуты.`, 'default', '👉');
      }
    });
  }

  /* ---------- обычный режим: неделя одним взглядом ---------- */
  function renderWeek() {
    const el = $('#week-overview');
    if (!el) return;
    if (isADHD() || typeof Week === 'undefined' || typeof DayTpl === 'undefined') { el.innerHTML = ''; return; }
    const today = new Date();
    const dowToday = today.getDay();
    const mondayOffset = (dowToday + 6) % 7;
    const cols = [];
    let weekDone = 0;
    for (let i = 0; i < 7; i++) {
      const offset = i - mondayOffset;
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      const dow = d.getDay();
      const key = State.dateKey(d);
      const total = DayTpl.active(dow).length || 1;
      const done = offset <= 0 ? DayTpl.doneOn(key) : 0;
      weekDone += done;
      const pct = Math.min(100, Math.round((done / total) * 100));
      const sc = Week.scriptFor(dow);
      const pairs = sc.filter((b) => b.kind === 'pair');
      cols.push(`
        <button class="wo-col ${offset === 0 ? 'today' : ''} ${offset > 0 ? 'future' : ''}" data-wo="${dow}" title="${Week.DAY_NAMES[dow]}: ${done} из ${total}">
          <span class="wo-bar"><i style="height:${offset > 0 ? 0 : Math.max(4, pct)}%" class="${pct >= 80 ? 'ok' : (pct >= 40 ? 'mid' : 'low')}"></i></span>
          <b>${Week.DAY_SHORT[dow]}</b>
          <small>${offset > 0 ? (pairs.length ? Track.hhmm(pairs[0].start) : 'выходной') : `${pct}%`}</small>
        </button>`);
    }
    const focusWeek = (() => {
      let m = 0;
      for (let i = 0; i <= mondayOffset; i++) m += State.s.dailyFocusMinutes[State.daysAgoKey(i)] || 0;
      return m;
    })();
    el.innerHTML = `
      <div class="wo-grid">${cols.join('')}</div>
      <div class="wo-sum">
        <span>Сделано за неделю: <b>${weekDone}</b></span>
        <span>Фокус: <b>${inWords(focusWeek)}</b></span>
        <span>Серия шаблона: <b>${UI.plur(DayTpl.streak(), 'день', 'дня', 'дней')}</b></span>
        ${State.s.totals.perfectDays ? `<span>Идеальных дней: <b>${State.s.totals.perfectDays}</b></span>` : ''}
      </div>
      ${chainsHTML()}
      ${perfectHTML(false)}`;
    el.querySelectorAll('[data-wo]').forEach((b) => {
      b.onclick = () => { App.go('day'); setTimeout(() => Screens.day.showDay(Number(b.dataset.wo)), 120); };
    });
  }

  /* ---------- СДВГ: главная без шума ---------- */
  function applyDash() {
    document.body.classList.toggle('dash-all', !!State.s.adhdDashAll);
    const btn = $('#dash-more-btn');
    if (btn) {
      const hiddenN = document.querySelectorAll('.grid-dash > .card:not([data-card="now"]):not([data-card="main"]):not([data-card="week"]):not(.hidden)').length;
      btn.textContent = State.s.adhdDashAll ? '▲ Свернуть лишнее' : `▼ Показать остальное · ${hiddenN}`;
      btn.setAttribute('aria-expanded', String(!!State.s.adhdDashAll));
    }
  }

  function bind() {
    bindNow();
    const more = $('#dash-more-btn');
    if (more) more.addEventListener('click', () => {
      State.s.adhdDashAll = !State.s.adhdDashAll;
      State.save();
      applyDash();
      Sound.sfx('pop');
    });
    startClock();
  }

  function render() {
    renderFresh();
    renderNow();
    renderWeek();
    applyDash();
    paintMiniClock();
  }

  /* СДВГ: на «Дне» показываем окно из нескольких строк вокруг «сейчас» */
  const dayExpanded = () => dayOpen;
  function toggleDay() { dayOpen = !dayOpen; }

  return { chainHTML, freshStart, isADHD, target, render, renderNow, renderWeek, bind, tick, onComplete, perfectDay, perfectHTML, dayExpanded, toggleDay, completeBlock, startBlock, stuck };
})();
