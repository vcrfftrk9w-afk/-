'use strict';
/* =========================================================
   SCREENS CORE — главная, задачи, привычки, цели
   ========================================================= */

const Screens = {};

/* ---------- общие помощники ---------- */
Screens.helpers = {
  activityLevel(key) {
    const s = State.s;
    let n = (s.dailyTaskCounts[key] || 0);
    n += Math.round((s.dailyFocusMinutes[key] || 0) / 25);
    n += s.habits.filter((h) => h.history[key]).length;
    return n;
  },
  isActiveDay(key) { return Screens.helpers.activityLevel(key) > 0; },

  taskXP(t) { return t.xp || Data.priorityById(t.priority).xp; },
  taskSkill(t) { return t.skill || Data.categoryById(t.category).skill; },

  fillSelect(sel, items, value) {
    if (!sel) return;
    sel.innerHTML = items.map((i) => `<option value="${i.value}">${UI.esc(i.label)}</option>`).join('');
    if (value != null) sel.value = value;
  },
};

/* =========================================================
   ГЛАВНАЯ
   ========================================================= */
Screens.dashboard = (() => {
  const { $, $$ } = UI;
  let lastQuote = -1;
  let moodDraft = null;

  function bind() {
    const gp = document.querySelector('[data-goto-path]');
    if (gp) gp.addEventListener('click', () => App.go('path'));
    Screens.helpers.fillSelect($('#quick-priority'), Data.PRIORITIES.map((p) => ({ value: p.id, label: `${p.emoji} ${p.name} · ${p.xp} XP` })), 'mid');

    $('#quick-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#quick-input');
      const title = input.value.trim();
      if (!title) return;
      Screens.tasks.add(title, 'other', $('#quick-priority').value, false);
      input.value = '';
      input.focus();
    });

    $('#quote-next').addEventListener('click', () => { showQuote(); Sound.sfx('click'); });

    $('#unstuck-btn').addEventListener('click', (e) => {
      const step = Data.MICRO_STEPS[Math.floor(Math.random() * Data.MICRO_STEPS.length)];
      const out = $('#unstuck-result');
      out.textContent = step;
      out.classList.remove('pop-in');
      void out.offsetWidth;
      out.classList.add('pop-in');
      Sound.sfx('whoosh');
      FX.vibrate(20);
      FX.confettiFrom(e.currentTarget, 14, { power: 6 });
    });

    $('#mood-energy').addEventListener('input', (e) => { $('#mood-energy-val').textContent = e.target.value; });

    $('#mood-save').addEventListener('click', (e) => {
      const today = State.todayKey();
      const s = State.s;
      const wasNew = !s.moods[today];
      s.moods[today] = {
        mood: moodDraft || (s.moods[today] && s.moods[today].mood) || 3,
        energy: Number($('#mood-energy').value),
        note: $('#mood-note').value.trim(),
      };
      if (wasNew) {
        State.addXP(15, 'health');
        State.addCoins(10);
        State.bumpQuest('mood', 1);
        FX.confettiFrom(e.currentTarget, 20);
        UI.toast('День записан. +15 XP', 'success', '📔');
      } else {
        UI.toast('Обновлено', 'default', '📔');
      }
      Sound.sfx('check');
      State.registerActivity();
      State.commit();
    });

    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => App.go(b.dataset.goto)));

    $('#dash-customize').addEventListener('click', customize);

    $('#focus-goal-start').addEventListener('click', () => {
      App.go('adhd');
      setTimeout(() => Screens.focus.startIfIdle(), 260);
    });

    $('#focus-goal-edit').addEventListener('click', async () => {
      const body = UI.sheet(`
        <h2>⏱️ Дневная цель по фокусу</h2>
        <p class="muted small">Сколько минут сосредоточенной работы ты хочешь набирать за день? Лучше поставить меньше и выполнять.</p>
        <div class="chips-row" id="goal-presets">
          ${[25, 50, 90, 120, 180].map((m) => `<button class="chip${State.s.focusGoal === m ? ' active' : ''}" data-goal="${m}">${m} мин</button>`).join('')}
        </div>`);
      body.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => {
        State.s.focusGoal = Number(b.dataset.goal);
        UI.closeModal('#sheet-modal');
        Sound.sfx('check');
        UI.toast(`Цель: ${b.dataset.goal} минут в день`, 'success', '⏱️');
        State.commit();
      }));
    });
  }

  /* какие карточки показывать на главной */
  const CARDS = [
    { id: 'hero', name: 'Персонаж и уровень' },
    { id: 'next', name: 'Что дальше' },
    { id: 'path', name: 'Твой путь к деньгам' },
    { id: 'pledge', name: 'Обещание дня (3 дела)' },
    { id: 'quests', name: 'Квесты дня' },
    { id: 'quickadd', name: 'Быстрая задача и микро-шаг' },
    { id: 'today', name: 'Задачи на сегодня' },
    { id: 'focusgoal', name: 'Фокус сегодня' },
    { id: 'mood', name: 'Состояние дня' },
    { id: 'routines', name: 'Рутины дня' },
    { id: 'skills', name: 'Навыки' },
    { id: 'quote', name: 'Цитата' },
    { id: 'streak', name: 'Серия' },
  ];

  function applyCards() {
    const hidden = State.s.hiddenCards || {};
    CARDS.forEach((c) => {
      const el = document.querySelector(`[data-card="${c.id}"]`);
      if (el) el.classList.toggle('hidden', !!hidden[c.id]);
    });
  }

  function customize() {
    Sound.sfx('click');
    const hidden = State.s.hiddenCards || {};
    const body = UI.sheet(`
      <h2>⚙️ Настроить главную</h2>
      <p class="muted small">Убери то, чем не пользуешься — меньше визуального шума, проще начать.</p>
      <div class="cards-config">
        ${CARDS.map((c) => `
          <label class="switch-row">
            <span>${UI.esc(c.name)}</span>
            <input type="checkbox" data-card-toggle="${c.id}" ${hidden[c.id] ? '' : 'checked'}>
          </label>`).join('')}
      </div>`, { wide: true });

    body.querySelectorAll('[data-card-toggle]').forEach((cb) => cb.addEventListener('change', () => {
      State.s.hiddenCards = State.s.hiddenCards || {};
      State.s.hiddenCards[cb.dataset.cardToggle] = !cb.checked;
      applyCards();
      Sound.sfx('pop');
      State.save();
    }));
  }

  function renderFocusGoal() {
    const s = State.s;
    const goal = s.focusGoal || 60;
    const today = s.dailyFocusMinutes[State.todayKey()] || 0;
    const pct = Math.min(1, today / goal);
    const C = 2 * Math.PI * 50;
    const ring = $('#focus-goal-ring');
    ring.style.strokeDasharray = C;
    ring.style.strokeDashoffset = C * (1 - pct);
    ring.classList.toggle('done', pct >= 1);
    UI.countUp($('#focus-goal-min'), today);
    $('#focus-goal-target').textContent = `из ${goal} мин`;

    let week = 0;
    for (let i = 0; i < 7; i++) week += s.dailyFocusMinutes[State.daysAgoKey(i)] || 0;
    $('#focus-week').textContent = week;

    const task = s.tasks.find((t) => t.id === App.focusTask && !t.done)
      || s.tasks.find((t) => !t.done);
    $('#focus-goal-task').innerHTML = task
      ? `Сейчас в работе: <b>${UI.esc(task.title)}</b>`
      : 'Задача не выбрана — можно просто побыть в фокусе';
    $('#focus-goal-hint').classList.toggle('hidden', week === 0);
  }

  function showQuote() {
    let i;
    do { i = Math.floor(Math.random() * Data.QUOTES.length); } while (i === lastQuote && Data.QUOTES.length > 1);
    lastQuote = i;
    const el = $('#quote-text');
    el.style.opacity = '0';
    setTimeout(() => { el.textContent = Data.QUOTES[i]; el.style.opacity = '1'; }, 180);
  }

  function renderHero() {
    const s = State.s;
    const stage = State.stage();
    $('#hero-avatar').textContent = stage.emoji;
    $('#hero-title').textContent = stage.title;
    $('#hero-stage-desc').textContent = stage.desc;
    $('#hero-level').textContent = s.level;
    const need = State.xpToNext(s.level);
    $('#hero-xp-left').textContent = Math.max(0, need - s.xp);
    const pct = Math.min(100, (s.xp / need) * 100);
    $('#xp-fill-big').style.width = pct + '%';

    const track = $('#evolution-track');
    track.innerHTML = '';
    Data.EVOLUTION.forEach((e) => {
      const reached = s.level >= e.level;
      const isCurrent = e.level === stage.level;
      const span = UI.node('span', `evo-step${reached ? ' reached' : ''}${isCurrent ? ' current' : ''}`, e.emoji);
      span.title = `${e.title} · уровень ${e.level}`;
      track.appendChild(span);
    });

    const today = State.todayKey();
    UI.countUp($('#mini-tasks'), s.dailyTaskCounts[today] || 0);
    UI.countUp($('#mini-focus'), s.dailyFocusMinutes[today] || 0);
    UI.countUp($('#mini-habits'), s.habits.filter((h) => h.history[today]).length);
    UI.countUp($('#mini-ach'), State.unlockedAchievements());
  }

  function renderQuests() {
    const s = State.s;
    const quests = State.todayQuests();
    const root = $('#quest-list');
    root.innerHTML = '';
    let done = 0;
    quests.forEach((q) => {
      const prog = Math.min(q.target, s.quests.progress[q.id] || 0);
      const isDone = !!s.quests.done[q.id];
      if (isDone) done++;
      const el = UI.node('div', `quest${isDone ? ' done' : ''}`);
      el.innerHTML = `
        <span class="quest-emoji">${isDone ? '✅' : q.emoji}</span>
        <div class="quest-body">
          <div class="quest-text">${UI.esc(q.text)}</div>
          <div class="quest-bar"><i style="width:${(prog / q.target) * 100}%"></i></div>
        </div>
        <div class="quest-reward">
          <b>${prog}/${q.target}</b>
          <small>+${q.xp} XP${q.coins ? ` · +${q.coins}🪙` : ''}</small>
        </div>`;
      root.appendChild(el);
    });
    $('#quest-counter').textContent = `${done}/${quests.length}`;

    // недельный вызов
    const w = State.weeklyChallenge();
    const wp = State.weeklyProgress();
    const claimed = State.s.weekly.claimed;
    $('#weekly-wrap').innerHTML = `
      <div class="weekly${claimed ? ' done' : ''}">
        <div class="weekly-head">
          <span class="weekly-emoji">${claimed ? '🏆' : w.emoji}</span>
          <div class="grow">
            <b>Вызов недели</b>
            <p class="muted small">${UI.esc(w.text)}</p>
          </div>
          <span class="weekly-reward">+${w.xp} XP<br><small>+${w.coins}🪙</small></span>
        </div>
        <div class="weekly-bar"><i style="width:${wp.pct}%"></i></div>
        <div class="weekly-meta">${claimed ? 'Вызов пройден — награда получена' : `${UI.fmt(wp.value)} из ${UI.fmt(wp.target)}`}</div>
      </div>`;
  }

  function renderMood() {
    const s = State.s;
    const today = s.moods[State.todayKey()];
    const row = $('#mood-row');
    if (!row.dataset.built) {
      row.innerHTML = Data.MOODS.map((m) => `<button class="mood-btn" data-mood="${m.v}" title="${m.name}">${m.emoji}</button>`).join('');
      row.dataset.built = '1';
      row.addEventListener('click', (e) => {
        const btn = e.target.closest('.mood-btn');
        if (!btn) return;
        moodDraft = Number(btn.dataset.mood);
        UI.$$('.mood-btn', row).forEach((b) => b.classList.toggle('selected', b === btn));
        FX.pulse(btn);
        Sound.sfx('click');
      });
    }
    const active = moodDraft || (today && today.mood);
    UI.$$('.mood-btn', row).forEach((b) => b.classList.toggle('selected', Number(b.dataset.mood) === active));
    if (today) {
      $('#mood-energy').value = today.energy;
      $('#mood-energy-val').textContent = today.energy;
      if (!$('#mood-note').matches(':focus')) $('#mood-note').value = today.note || '';
      $('#mood-save').textContent = 'Обновить день';
    } else {
      $('#mood-save').textContent = 'Сохранить день';
    }
  }

  function renderSkills() {
    const list = $('#skills-list');
    list.innerHTML = '';
    const levels = Data.SKILLS.map((sk) => State.skillProgress(sk.id));
    const maxLevel = Math.max(5, ...levels.map((l) => l.level));

    Data.SKILLS.forEach((sk, i) => {
      const p = levels[i];
      const el = UI.node('div', 'skill-row');
      el.innerHTML = `
        <span class="skill-emoji">${sk.emoji}</span>
        <div class="skill-body">
          <div class="skill-name">${sk.name} <b>ур. ${p.level}</b></div>
          <div class="skill-bar"><i style="width:${p.pct}%; background:${sk.color}"></i></div>
        </div>`;
      el.style.cursor = 'pointer';
      el.title = 'Что качает этот навык';
      el.addEventListener('click', () => skillDetail(sk));
      list.appendChild(el);
    });

    // радар
    const svg = $('#skills-radar');
    const cx = 110, cy = 110, R = 82;
    const n = Data.SKILLS.length;
    const pt = (i, r) => {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    let grid = '';
    for (let ring = 1; ring <= 4; ring++) {
      const pts = [];
      for (let i = 0; i < n; i++) { const [x, y] = pt(i, (R * ring) / 4); pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
      grid += `<polygon points="${pts.join(' ')}" class="radar-grid"/>`;
    }
    let axes = '';
    const poly = [];
    let labels = '';
    Data.SKILLS.forEach((sk, i) => {
      const [ax, ay] = pt(i, R);
      axes += `<line x1="${cx}" y1="${cy}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" class="radar-axis"/>`;
      const ratio = Math.min(1, levels[i].level / maxLevel);
      const [px, py] = pt(i, Math.max(10, R * ratio));
      poly.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      const [lx, ly] = pt(i, R + 16);
      labels += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" class="radar-label">${sk.emoji}</text>`;
    });
    svg.innerHTML = `${grid}${axes}<polygon points="${poly.join(' ')}" class="radar-shape"/>${labels}`;
  }

  /* что качает конкретный навык */
  const SKILL_SOURCES = {
    discipline: ['задачи категорий «Работа», «Дом», «Другое»', 'фокус-сессии', 'шаги разбитых задач', 'рутины дня', 'ежедневные квесты'],
    mind: ['задачи категории «Учёба»', 'уроки курса', 'brain dump и журнал отвлечений', 'недельные итоги'],
    money: ['задачи категории «Деньги»', 'уроки про капитал'],
    health: ['задачи категории «Здоровье»', 'привычки здоровья', 'дыхательные паузы', 'отметка состояния дня'],
    creative: ['задачи категории «Творчество»'],
    social: ['задачи категории «Люди»'],
  };

  function skillDetail(sk) {
    const p = State.skillProgress(sk.id);
    Sound.sfx('click');
    UI.sheet(`
      <div class="skill-detail">
        <div class="skill-detail-head">
          <span class="skill-detail-emoji">${sk.emoji}</span>
          <div>
            <h2>${UI.esc(sk.name)}</h2>
            <p class="muted small">Уровень <b>${p.level}</b> · ${p.xp} из ${p.need} XP до следующего</p>
          </div>
        </div>
        <div class="skill-bar big"><i style="width:${p.pct}%; background:${sk.color}"></i></div>
        <h4 style="margin-top:16px">Что его качает</h4>
        <ul class="skill-sources">
          ${(SKILL_SOURCES[sk.id] || []).map((x) => `<li>${UI.esc(x)}</li>`).join('')}
        </ul>
        <p class="muted small">Опыт навыка начисляется вместе с обычным XP — просто делай то, что относится к этой сфере.</p>
      </div>`);
  }

  function renderStreak() {
    const s = State.s;
    UI.countUp($('#streak-number'), s.streak);
    const streakLabel = document.querySelector('.streak-big small');
    if (streakLabel) streakLabel.textContent = `${UI.plural(s.streak, 'день', 'дня', 'дней')} подряд`;
    const week = $('#streak-week');
    week.innerHTML = '';
    for (let i = 6; i >= 0; i--) {
      const key = State.daysAgoKey(i);
      const lvl = Screens.helpers.activityLevel(key);
      const d = new Date(key);
      const cell = UI.node('div', `streak-day${lvl > 0 ? ' active' : ''}${i === 0 ? ' today' : ''}`);
      cell.innerHTML = `<small>${UI.WEEKDAYS[d.getDay()]}</small><span>${lvl > 0 ? '🔥' : '·'}</span>`;
      cell.title = `${UI.dateLabel(key)} · активность: ${lvl}`;
      week.appendChild(cell);
    }
    const doneToday = Screens.helpers.isActiveDay(State.todayKey());
    $('#streak-hint').textContent = doneToday
      ? 'Сегодня серия продлена. Так держать!'
      : 'Выполни любую задачу или привычку, чтобы продлить серию.';
  }

  /* карточка пути на главной */
  function renderPathCard() {
    const el = $('#dash-path');
    if (!el || typeof Path === 'undefined') return;
    const n = Path.nextStep();
    const pct = Path.progressPct();
    if (!n) {
      el.innerHTML = `<div class="path-card-step">🏁 Весь путь пройден — все ${Path.STEP_COUNT} шагов.</div>`;
    } else {
      el.innerHTML = `
        <div class="path-card-stage">${n.stage.emoji} Этап ${Path.currentIndex() + 1}/${Path.STAGES.length} · ${UI.esc(n.stage.name)}</div>
        <div class="path-card-step">${UI.esc(n.step.t)}</div>
        <div class="path-bar" style="margin:0 0 10px"><span style="width:${pct}%"></span></div>
        <div class="path-card-stage">${Path.doneCount()} из ${Path.STEP_COUNT} шагов · ${pct}%</div>
        <button class="btn btn-primary btn-block" style="margin-top:10px" id="dash-path-go">Показать, что делать</button>`;
      const go = $('#dash-path-go');
      if (go) go.onclick = () => { App.go('path'); };
    }
  }

  function render() {
    renderHero();
    renderQuests();
    renderMood();
    renderSkills();
    renderStreak();
    renderFocusGoal();
    renderPathCard();
    if (Screens.pledge) Screens.pledge.render();
    applyCards();
    Advisor.renderNext();
    Screens.routines.render();
    Screens.tasks.renderToday();
    if (!$('#quote-text').dataset.ready) { showQuote(); $('#quote-text').dataset.ready = '1'; }
  }

  return { bind, render, showQuote, renderPathCard };
})();

/* =========================================================
   ЗАДАЧИ
   ========================================================= */
Screens.tasks = (() => {
  const { $, $$ } = UI;
  let filter = 'active';
  let view = 'list';
  const expandedTasks = new Set();
  let category = 'all';
  const REPEAT_LABEL = { daily: 'каждый день', weekdays: 'по будням', weekly: 'каждую неделю' };

  /* следующая дата повторяющейся задачи */
  function nextRepeatDate(repeat, fromISO) {
    const base = fromISO ? new Date(fromISO) : new Date();
    base.setHours(12, 0, 0, 0);
    if (repeat === 'weekly') base.setDate(base.getDate() + 7);
    else if (repeat === 'weekdays') {
      do { base.setDate(base.getDate() + 1); } while (base.getDay() === 0 || base.getDay() === 6);
    } else base.setDate(base.getDate() + 1);
    return State.dateKey(base);
  }

  /* после выполнения повторяющаяся задача возвращается на следующий срок */
  function respawn(task) {
    if (!task.repeat) return;
    const nextDue = nextRepeatDate(task.repeat, task.due);
    State.s.tasks.unshift({
      id: State.uid(), title: task.title, category: task.category, priority: task.priority,
      xp: task.xp, skill: task.skill, urgent: task.urgent, done: false, rewarded: false,
      createdAt: Date.now(), doneAt: null, goalId: task.goalId || null,
      due: nextDue, repeat: task.repeat,
      subtasks: (task.subtasks || []).map((st) => ({ id: State.uid(), text: st.text, done: false })),
    });
    UI.toast(`Повтор: вернётся ${UI.dateLabel(nextDue)} 🔁`, 'default', '🔁');
  }

  function bind() {
    Screens.helpers.fillSelect($('#task-category'), Data.CATEGORIES.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` })), 'work');
    Screens.helpers.fillSelect($('#task-priority'), Data.PRIORITIES.map((p) => ({ value: p.id, label: `${p.emoji} ${p.name} · ${p.xp} XP` })), 'mid');

    $('#task-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#task-title');
      const title = input.value.trim();
      if (!title) return;
      add(title, $('#task-category').value, $('#task-priority').value, $('#task-urgent').checked, {
        due: $('#task-due').value || null,
        repeat: $('#task-repeat').value || null,
      });
      input.value = '';
      $('#task-due').value = '';
      $('#task-urgent').checked = false;
      input.focus();
    });

    $$('#task-filters .chip').forEach((chip) => chip.addEventListener('click', () => {
      filter = chip.dataset.filter;
      $$('#task-filters .chip').forEach((c) => c.classList.toggle('active', c === chip));
      render();
    }));

    const catRow = $('#task-categories');
    catRow.innerHTML = `<button class="chip active" data-cat="all">Все категории</button>` +
      Data.CATEGORIES.map((c) => `<button class="chip" data-cat="${c.id}">${c.emoji} ${UI.esc(c.name)}</button>`).join('');
    catRow.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cat]');
      if (!chip) return;
      category = chip.dataset.cat;
      UI.$$('[data-cat]', catRow).forEach((c) => c.classList.toggle('active', c === chip));
      Sound.sfx('click');
      render();
    });

    $$('#task-view .chip').forEach((chip) => chip.addEventListener('click', () => {
      view = chip.dataset.view;
      $$('#task-view .chip').forEach((c) => c.classList.toggle('active', c === chip));
      render();
    }));
  }

  function add(title, category, priority, urgent, extra = {}) {
    const p = Data.priorityById(priority);
    const c = Data.categoryById(category);
    State.s.tasks.unshift({
      id: State.uid(), title, category: c.id, priority: p.id, xp: p.xp, skill: c.skill,
      urgent: !!urgent, done: false, rewarded: false, createdAt: Date.now(), doneAt: null,
      goalId: extra.goalId || null, due: extra.due || null, repeat: extra.repeat || null, subtasks: [],
    });
    Sound.sfx('click');
    UI.toast('Задача добавлена', 'success', '📝');
    State.commit();
  }

  function complete(task, sourceEl) {
    const s = State.s;
    task.done = !task.done;
    if (!task.done) { Sound.sfx('click'); State.commit(); return; }

    task.doneAt = Date.now();
    const xp = Screens.helpers.taskXP(task);
    const skill = Screens.helpers.taskSkill(task);

    if (!task.rewarded) {
      task.rewarded = true;
      const gotXP = State.addXP(xp, skill);
      const gotCoins = State.addCoins(Math.round(xp / 2));
      s.totals.tasksCompleted += 1;
      if (task.priority === 'boss' || task.priority === 'high') s.totals.bossTasks += 1;
      const today = State.todayKey();
      s.dailyTaskCounts[today] = (s.dailyTaskCounts[today] || 0) + 1;
      const hour = new Date().getHours();
      s.focusByHour[hour] = (s.focusByHour[hour] || 0) + 1;
      if (hour >= 0 && hour < 5) s.totals.nightTasks += 1;
      if (hour >= 5 && hour < 7) s.totals.earlyTasks += 1;
      State.registerActivity();
      State.bumpQuest('tasks', 1);
      if (task.priority === 'boss' || task.priority === 'high') State.bumpQuest('bigTasks', 1);

      if (isDueToday(task)) {
        const bonus = State.addXP(10, skill);
        UI.toast(`Дедлайн закрыт вовремя! +${bonus} XP сверху`, 'level', '📅');
      }
      respawn(task);
      Sound.sfx('success');
      FX.vibrate([12, 40, 18]);
      FX.confettiFrom(sourceEl, task.priority === 'boss' ? 70 : 34, { power: task.priority === 'boss' ? 12 : 9 });
      FX.floatText(sourceEl, `+${gotXP} XP`, 'xp');
      FX.flyTo(sourceEl, '#coin-pill', '🪙', Math.min(6, Math.max(2, Math.round(gotCoins / 8))));
      UI.toast(`+${gotXP} XP · +${UI.fmt(gotCoins)} монет`, 'coin', '🪙');
    } else {
      Sound.sfx('check');
    }
    State.commit();
  }

  function remove(id, el) {
    const kill = () => { State.s.tasks = State.s.tasks.filter((t) => t.id !== id); State.commit(); };
    if (el && !State.s.reduceMotion) { el.classList.add('removing'); setTimeout(kill, 260); }
    else kill();
  }

  function focusOn(task) {
    App.focusTask = task.id;
    App.go('adhd');
    Screens.focus.setTask(task.id);
    UI.toast('Задача в фокусе', 'default', '🎯');
  }

  function itemNode(t) {
    const cat = Data.categoryById(t.category);
    const pri = Data.priorityById(t.priority);
    const skill = Data.skillById(Screens.helpers.taskSkill(t));
    const subs = t.subtasks || [];
    const doneSubs = subs.filter((x) => x.done).length;
    const due = dueInfo(t);
    const expanded = expandedTasks.has(t.id);

    const li = UI.node('li', `task-item pri-${t.priority}${t.done ? ' done' : ''}${t.urgent ? ' urgent' : ''}${expanded ? ' expanded' : ''}${due && due.cls === 'overdue' && !t.done ? ' overdue' : ''}`);
    li.dataset.id = t.id;
    li.innerHTML = `
      <div class="task-row">
        <button class="task-check" aria-label="Готово">✓</button>
        <div class="task-body">
          <div class="task-title">${UI.esc(t.title)}</div>
          <div class="task-meta">
            <span>${cat.emoji} ${cat.name}</span>
            <span class="dot">·</span>
            <span>${pri.emoji} ${pri.name}</span>
            ${t.urgent ? '<span class="tag-urgent">срочно</span>' : ''}
            <span class="task-xp">+${Screens.helpers.taskXP(t)} XP</span>
            ${skill ? `<span class="task-skill" style="color:${skill.color}">${skill.emoji}</span>` : ''}
            ${subs.length ? `<span class="task-steps">шаги ${doneSubs}/${subs.length}</span>` : ''}
            ${due ? `<span class="task-due ${due.cls}">📅 ${UI.esc(due.label)}</span>` : ''}
            ${t.repeat ? `<span class="task-repeat">🔁 ${REPEAT_LABEL[t.repeat] || 'повтор'}</span>` : ''}
          </div>
          ${subs.length ? `<div class="task-substrip"><i style="width:${(doneSubs / subs.length) * 100}%"></i></div>` : ''}
        </div>
        <div class="task-actions">
          <button class="icon-mini task-expand" title="Шаги задачи">${expanded ? '▴' : '▾'}</button>
          <button class="icon-mini task-snooze" title="Перенести на завтра">⏭️</button>
          <button class="icon-mini task-focus" title="Работать над этим">🎯</button>
          <button class="icon-mini task-del" title="Удалить">🗑️</button>
        </div>
      </div>
      ${expanded ? `
        <div class="task-subs">
          ${subs.map((st) => `
            <label class="task-sub${st.done ? ' done' : ''}" data-sub="${st.id}">
              <input type="checkbox" ${st.done ? 'checked' : ''}>
              <span>${UI.esc(st.text)}</span>
              <button class="icon-mini sub-del" title="Удалить шаг" type="button">✕</button>
            </label>`).join('')}
          <form class="row task-sub-add">
            <input class="grow" id="sub-add-${t.id}" type="text" placeholder="Добавить шаг…" maxlength="90">
            <button class="btn btn-ghost btn-sm" type="submit">+</button>
          </form>
          <button class="link-btn sub-template">🐘 Разбить по шаблону</button>
        </div>` : ''}`;

    li.querySelector('.task-check').addEventListener('click', (e) => complete(t, e.currentTarget));
    li.querySelector('.task-del').addEventListener('click', () => remove(t.id, li));
    li.querySelector('.task-focus').addEventListener('click', () => focusOn(t));
    li.querySelector('.task-snooze').addEventListener('click', () => snooze(t));

    // двойной клик по названию — переименование на месте
    const titleEl = li.querySelector('.task-title');
    titleEl.title = 'Двойной клик — переименовать';
    titleEl.addEventListener('dblclick', () => startRename(t, titleEl));
    li.querySelector('.task-expand').addEventListener('click', () => {
      if (expandedTasks.has(t.id)) expandedTasks.delete(t.id);
      else expandedTasks.add(t.id);
      Sound.sfx('click');
      render();
      renderToday();
    });

    if (expanded) {
      li.querySelectorAll('.task-sub input').forEach((cb) => {
        cb.addEventListener('change', (e) => {
          const id = e.target.closest('[data-sub]').dataset.sub;
          toggleSub(t, id, e.target);
        });
      });
      li.querySelectorAll('.sub-del').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const id = e.target.closest('[data-sub]').dataset.sub;
          t.subtasks = (t.subtasks || []).filter((x) => x.id !== id);
          State.commit();
        });
      });
      const form = li.querySelector('.task-sub-add');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input');
        addSub(t, input.value);
        input.value = '';
      });
      li.querySelector('.sub-template').addEventListener('click', () => applyTemplate(t));
    }
    return li;
  }

  /* перенести задачу на завтра — без вины и без потери из виду */
  function snooze(task) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    task.due = State.dateKey(d);
    task.urgent = false;
    Sound.sfx('whoosh');
    UI.toast('Перенесено на завтра. Это нормально 🌙', 'default', '⏭️');
    State.commit();
  }

  /* ---------- переименование на месте ---------- */
  function startRename(task, el) {
    if (el.querySelector('input')) return;
    const original = task.title;
    el.innerHTML = '';
    const input = document.createElement('input');
    input.className = 'task-rename';
    input.value = original;
    input.maxLength = 110;
    el.appendChild(input);
    input.focus();
    input.setSelectionRange(original.length, original.length);

    const finish = (save) => {
      const value = input.value.trim();
      if (save && value && value !== original) {
        task.title = value;
        Sound.sfx('check');
        UI.toast('Задача переименована', 'success', '✏️');
      }
      State.commit();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      e.stopPropagation();
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  /* ---------- подзадачи ---------- */
  function addSub(t, text) {
    if (!text.trim()) return;
    t.subtasks = t.subtasks || [];
    t.subtasks.push({ id: State.uid(), text: text.trim(), done: false });
    Sound.sfx('pop');
    State.commit();
  }

  function applyTemplate(t) {
    const tpl = Data.BREAKDOWN_TEMPLATES[0];
    t.subtasks = (t.subtasks || []).concat(tpl.steps.map((text) => ({ id: State.uid(), text, done: false })));
    State.s.totals.breakdownsUsed += 1;
    State.bumpQuest('breakdowns', 1);
    Sound.sfx('success');
    UI.toast('Задача разбита на 4 шага 🐘', 'success', '🐘');
    State.commit();
  }

  function toggleSub(t, subId, el) {
    const sub = (t.subtasks || []).find((x) => x.id === subId);
    if (!sub) return;
    sub.done = !sub.done;
    if (sub.done) {
      State.addXP(4, Screens.helpers.taskSkill(t));
      State.addCoins(3);
      Sound.sfx('check');
      FX.floatText(el, '+4 XP', 'xp');
      const all = t.subtasks.length && t.subtasks.every((x) => x.done);
      if (all && !t.done) {
        UI.toast('Все шаги закрыты — задача готова!', 'success', '✅');
        complete(t, el);
        return;
      }
    } else {
      Sound.sfx('click');
    }
    State.commit();
  }

  function dueInfo(t) {
    if (!t.due) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(t.due); due.setHours(0, 0, 0, 0);
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return { days, label: days === -1 ? 'просрочено вчера' : `просрочено на ${UI.plur(-days, 'день', 'дня', 'дней')}`, cls: 'overdue' };
    if (days === 0) return { days, label: 'сегодня', cls: 'today' };
    if (days === 1) return { days, label: 'завтра', cls: 'soon' };
    if (days <= 7) return { days, label: `через ${UI.plur(days, 'день', 'дня', 'дней')}`, cls: 'soon' };
    return { days, label: UI.dateLabel(t.due), cls: '' };
  }

  function isDueToday(t) {
    const info = dueInfo(t);
    return !!info && info.days <= 0;
  }

  function filtered() {
    const tasks = State.s.tasks;
    let list;
    if (filter === 'active') list = tasks.filter((t) => !t.done);
    else if (filter === 'done') list = tasks.filter((t) => t.done);
    else if (filter === 'today') list = tasks.filter((t) => !t.done && (isDueToday(t) || t.urgent));
    else list = tasks;

    if (category !== 'all') list = list.filter((t) => t.category === category);

    // сначала просроченные и сегодняшние, потом остальные по дате
    return list.slice().sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const da = dueInfo(a), db = dueInfo(b);
      if (da && db) return da.days - db.days;
      if (da) return -1;
      if (db) return 1;
      return 0;
    });
  }

  function quadrant(t) {
    const important = t.priority === 'high' || t.priority === 'boss';
    if (t.urgent && important) return 'do';
    if (!t.urgent && important) return 'plan';
    if (t.urgent && !important) return 'quick';
    return 'drop';
  }

  function render() {
    const listMode = view === 'list';
    $('#task-list').classList.toggle('hidden', !listMode);
    $('#task-matrix').classList.toggle('hidden', listMode);

    const items = filtered();
    if (listMode) {
      const list = $('#task-list');
      list.innerHTML = '';
      items.forEach((t) => list.appendChild(itemNode(t)));
    } else {
      ['do', 'plan', 'quick', 'drop'].forEach((q) => {
        const ul = $(`#task-matrix [data-list="${q}"]`);
        ul.innerHTML = '';
        items.filter((t) => quadrant(t) === q).forEach((t) => ul.appendChild(itemNode(t)));
      });
    }
    $('#task-empty').classList.toggle('hidden', items.length > 0);
  }

  function renderToday() {
    const list = $('#dash-today');
    list.innerHTML = '';
    const active = State.s.tasks.filter((t) => !t.done).slice(0, 6);
    active.forEach((t) => list.appendChild(itemNode(t)));
    $('#dash-empty').classList.toggle('hidden', active.length > 0);
  }

  return { bind, render, renderToday, add, complete, addSub, dueInfo };
})();

/* =========================================================
   ПРИВЫЧКИ
   ========================================================= */
Screens.habits = (() => {
  const { $, $$ } = UI;

  function bind() {
    Screens.helpers.fillSelect($('#habit-skill'), Data.SKILLS.map((s) => ({ value: s.id, label: `${s.emoji} ${s.name}` })), 'health');

    $('#habit-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#habit-title');
      const name = input.value.trim();
      if (!name) return;
      add(name, $('#habit-emoji').value.trim() || '✅', $('#habit-skill').value);
      input.value = '';
      $('#habit-emoji').value = '✅';
    });

    const tpl = $('#habit-templates');
    tpl.innerHTML = Data.HABIT_TEMPLATES
      .map((t, i) => `<button class="chip" data-tpl="${i}">${t.emoji} ${UI.esc(t.name)}</button>`).join('');
    tpl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tpl]');
      if (!btn) return;
      const t = Data.HABIT_TEMPLATES[Number(btn.dataset.tpl)];
      add(t.name, t.emoji, t.skill);
    });
  }

  function add(name, emoji, skill) {
    if (State.s.habits.some((h) => h.name.toLowerCase() === name.toLowerCase())) {
      UI.toast('Такая привычка уже есть', 'warn', '🌱');
      return;
    }
    State.s.habits.unshift({ id: State.uid(), name, emoji, skill, history: {}, rewarded: {}, createdAt: Date.now() });
    Sound.sfx('click');
    UI.toast('Привычка добавлена', 'success', '🌱');
    State.commit();
  }

  function toggleDay(h, key, el) {
    const s = State.s;
    const was = !!h.history[key];
    if (was) { delete h.history[key]; Sound.sfx('click'); }
    else {
      h.history[key] = true;
      if (!h.rewarded[key]) {
        h.rewarded[key] = true;
        const gotXP = State.addXP(8, h.skill);
        State.addCoins(5);
        FX.floatText(el, `+${gotXP} XP`, 'xp');
      }
      if (key === State.todayKey()) {
        State.registerActivity();
        State.bumpQuest('habits', 1);
      }
      Sound.sfx('check');
      FX.vibrate(15);
      FX.confettiFrom(el, 16, { power: 7 });

      const today = State.todayKey();
      const doneToday = s.habits.filter((x) => x.history[today]).length;
      if (s.habits.length >= 3 && doneToday === s.habits.length && s.lastPerfectDay !== today) {
        s.lastPerfectDay = today;
        s.totals.perfectHabitDays += 1;
        State.addXP(40, 'discipline');
        State.addCoins(30);
        FX.confetti(window.innerWidth / 2, window.innerHeight / 2, 80);
        UI.toast('Идеальный день по привычкам! +40 XP', 'level', '✨');
      }
    }
    State.commit();
  }

  async function remove(h) {
    if (!(await UI.confirm(`Удалить привычку «${h.name}»? История потеряется.`, { danger: true, okText: 'Удалить' }))) return;
    State.s.habits = State.s.habits.filter((x) => x.id !== h.id);
    State.commit();
  }

  /* подробная карточка привычки: 30 дней, рекорды, переименование */
  function detail(h) {
    const days = 35;
    const cells = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = State.daysAgoKey(i);
      cells.push({ key, done: !!h.history[key], today: i === 0 });
    }
    const total = Object.keys(h.history).length;
    const last30 = cells.filter((c) => c.done).length;
    const streak = State.habitStreak(h);

    // самый длинный отрезок за всю историю
    let best = 0, run = 0;
    const keys = Object.keys(h.history).sort();
    let prev = null;
    keys.forEach((k) => {
      if (prev && State.daysBetween(prev, k) === 1) run += 1; else run = 1;
      best = Math.max(best, run);
      prev = k;
    });

    Sound.sfx('click');
    const body = UI.sheet(`
      <div class="habit-detail">
        <div class="habit-detail-head">
          <span class="habit-detail-emoji">${UI.esc(h.emoji)}</span>
          <div>
            <h2>${UI.esc(h.name)}</h2>
            <p class="muted small">${(Data.skillById(h.skill) || Data.SKILLS[0]).name}</p>
          </div>
        </div>
        <div class="habit-stats">
          <div><b>${streak}</b><small>сейчас подряд</small></div>
          <div><b>${best}</b><small>рекорд</small></div>
          <div><b>${last30}/35</b><small>за 5 недель</small></div>
          <div><b>${total}</b><small>всего отметок</small></div>
        </div>
        <div class="habit-grid">
          ${cells.map((c) => `<i class="hcell${c.done ? ' on' : ''}${c.today ? ' now' : ''}" data-key="${c.key}" title="${UI.dateLabel(c.key)}"></i>`).join('')}
        </div>
        <p class="muted small">Нажми на клетку, чтобы отметить или снять день.</p>
        <label class="field"><span>Название</span><input id="habit-rename" type="text" maxlength="60" value="${UI.esc(h.name)}"></label>
        <div class="row">
          <input id="habit-reemoji" class="emoji-input" type="text" maxlength="4" value="${UI.esc(h.emoji)}">
          <button class="btn btn-primary grow" id="habit-save">Сохранить</button>
        </div>
      </div>`, { wide: true });

    body.querySelectorAll('.hcell').forEach((cell) => cell.addEventListener('click', () => {
      const key = cell.dataset.key;
      toggleDay(h, key, cell);
      cell.classList.toggle('on', !!h.history[key]);
    }));
    body.querySelector('#habit-save').addEventListener('click', () => {
      const name = body.querySelector('#habit-rename').value.trim();
      const emoji = body.querySelector('#habit-reemoji').value.trim();
      if (name) h.name = name;
      if (emoji) h.emoji = emoji;
      UI.closeModal('#sheet-modal');
      Sound.sfx('check');
      UI.toast('Привычка обновлена', 'success', '🌱');
      State.commit();
    });
  }

  function render() {
    const root = $('#habit-list');
    root.innerHTML = '';
    const today = State.todayKey();

    State.s.habits.forEach((h) => {
      const streak = State.habitStreak(h);
      const skill = Data.skillById(h.skill) || Data.SKILLS[0];
      const total = Object.keys(h.history).length;
      const el = UI.node('div', 'habit-item');
      el.innerHTML = `
        <div class="habit-main">
          <span class="habit-emoji">${UI.esc(h.emoji)}</span>
          <div class="habit-info">
            <div class="habit-name">${UI.esc(h.name)}</div>
            <div class="habit-sub">
              <span class="habit-streak">🔥 ${UI.plur(streak, 'день', 'дня', 'дней')}</span>
              <span class="muted small">всего ${total}</span>
              <span class="skill-tag" style="color:${skill.color}">${skill.emoji} ${skill.name}</span>
            </div>
          </div>
        </div>
        <div class="habit-days"></div>
        <button class="icon-mini habit-del" title="Удалить">🗑️</button>`;

      const daysRoot = el.querySelector('.habit-days');
      for (let i = 6; i >= 0; i--) {
        const key = State.daysAgoKey(i);
        const d = new Date(key);
        const done = !!h.history[key];
        const btn = UI.node('button', `habit-day${done ? ' done' : ''}${key === today ? ' today' : ''}`);
        btn.innerHTML = `<small>${UI.WEEKDAYS[d.getDay()]}</small><span>${done ? '✓' : ''}</span>`;
        btn.title = UI.dateLabel(key);
        btn.addEventListener('click', () => toggleDay(h, key, btn));
        daysRoot.appendChild(btn);
      }
      el.querySelector('.habit-del').addEventListener('click', () => remove(h));
      el.querySelector('.habit-main').addEventListener('click', () => detail(h));
      root.appendChild(el);
    });

    $('#habit-empty').classList.toggle('hidden', State.s.habits.length > 0);
  }

  return { bind, render, add, detail };
})();

/* =========================================================
   ЦЕЛИ
   ========================================================= */
Screens.goals = (() => {
  const { $ } = UI;

  function bind() {
    $('#goal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#goal-title');
      const title = input.value.trim();
      if (!title) return;
      add(title, $('#goal-emoji').value.trim() || '🎯', $('#goal-deadline').value);
      input.value = '';
      $('#goal-deadline').value = '';
    });
  }

  function add(title, emoji, deadline) {
    State.s.goals.unshift({
      id: State.uid(), title, emoji: emoji || '🎯', deadline: deadline || null,
      milestones: [], done: false, createdAt: Date.now(),
    });
    Sound.sfx('click');
    UI.toast('Цель поставлена', 'success', '🎯');
    State.commit();
  }

  function addMilestone(goal, text) {
    if (!text.trim()) return;
    goal.milestones.push({ id: State.uid(), text: text.trim(), done: false });
    goal.done = false;
    State.commit();
  }

  function toggleMilestone(goal, ms, el) {
    ms.done = !ms.done;
    if (ms.done) {
      State.addXP(15, 'discipline');
      State.addCoins(10);
      Sound.sfx('check');
      FX.confettiFrom(el, 18);
      State.registerActivity();
    }
    const all = goal.milestones.length > 0 && goal.milestones.every((m) => m.done);
    if (all && !goal.done) complete(goal);
    State.commit();
  }

  function complete(goal) {
    goal.done = true;
    goal.doneAt = Date.now();
    State.addXP(200, 'discipline');
    State.addCoins(300);
    Sound.sfx('fanfare');
    FX.fireworks(5);
    FX.coinRain(40);
    UI.toast(`Цель «${goal.title}» достигнута! +200 XP`, 'level', '🏁');
  }

  async function remove(goal) {
    if (!(await UI.confirm(`Удалить цель «${goal.title}»?`, { danger: true, okText: 'Удалить' }))) return;
    State.s.goals = State.s.goals.filter((g) => g.id !== goal.id);
    State.commit();
  }

  function daysLeft(deadline) {
    if (!deadline) return null;
    return Math.ceil((new Date(deadline) - new Date()) / 86400000);
  }

  function render() {
    const root = $('#goal-list');
    root.innerHTML = '';

    State.s.goals.forEach((g) => {
      const done = g.milestones.filter((m) => m.done).length;
      const pct = g.milestones.length ? (done / g.milestones.length) * 100 : (g.done ? 100 : 0);
      const dl = daysLeft(g.deadline);
      const el = UI.node('div', `card goal-card${g.done ? ' goal-done' : ''}`);
      el.innerHTML = `
        <div class="goal-head">
          <span class="goal-emoji">${UI.esc(g.emoji)}</span>
          <div class="grow">
            <div class="goal-title">${UI.esc(g.title)}</div>
            <div class="goal-meta">
              ${g.deadline ? `<span class="${dl < 0 ? 'overdue' : ''}">📅 ${dl >= 0 ? `осталось ${UI.plur(dl, 'день', 'дня', 'дней')}` : `просрочено на ${UI.plur(-dl, 'день', 'дня', 'дней')}`}</span>` : '<span class="muted">без дедлайна</span>'}
              <span>${done}/${g.milestones.length} ${UI.plural(g.milestones.length, 'шаг', 'шага', 'шагов')}</span>
              ${g.done ? '<span class="tag-done">готово</span>' : ''}
            </div>
          </div>
          <button class="icon-mini goal-del" title="Удалить">🗑️</button>
        </div>
        <div class="goal-progress"><i style="width:${pct}%"></i><span class="shine"></span></div>
        <div class="goal-steps"></div>
        <form class="row goal-add">
          <input class="grow" id="goal-add-${g.id}" type="text" placeholder="Добавить шаг…" maxlength="90">
          <button class="btn btn-ghost btn-sm" type="submit">+</button>
        </form>`;

      const steps = el.querySelector('.goal-steps');
      g.milestones.forEach((m) => {
        const row = UI.node('label', `goal-step${m.done ? ' done' : ''}`);
        row.innerHTML = `<input type="checkbox" ${m.done ? 'checked' : ''}><span>${UI.esc(m.text)}</span>`;
        row.querySelector('input').addEventListener('change', (e) => toggleMilestone(g, m, e.currentTarget));
        steps.appendChild(row);
      });

      const form = el.querySelector('.goal-add');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = form.querySelector('input');
        addMilestone(g, inp.value);
        inp.value = '';
      });
      el.querySelector('.goal-del').addEventListener('click', () => remove(g));
      root.appendChild(el);
    });

    $('#goal-empty').classList.toggle('hidden', State.s.goals.length > 0);
  }

  return { bind, render, add };
})();
