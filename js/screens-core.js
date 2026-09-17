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

  function renderStreak() {
    const s = State.s;
    UI.countUp($('#streak-number'), s.streak);
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

  function render() {
    renderHero();
    renderQuests();
    renderMood();
    renderSkills();
    renderStreak();
    Screens.tasks.renderToday();
    if (!$('#quote-text').dataset.ready) { showQuote(); $('#quote-text').dataset.ready = '1'; }
  }

  return { bind, render, showQuote };
})();

/* =========================================================
   ЗАДАЧИ
   ========================================================= */
Screens.tasks = (() => {
  const { $, $$ } = UI;
  let filter = 'active';
  let view = 'list';

  function bind() {
    Screens.helpers.fillSelect($('#task-category'), Data.CATEGORIES.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` })), 'work');
    Screens.helpers.fillSelect($('#task-priority'), Data.PRIORITIES.map((p) => ({ value: p.id, label: `${p.emoji} ${p.name} · ${p.xp} XP` })), 'mid');

    $('#task-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#task-title');
      const title = input.value.trim();
      if (!title) return;
      add(title, $('#task-category').value, $('#task-priority').value, $('#task-urgent').checked);
      input.value = '';
      $('#task-urgent').checked = false;
      input.focus();
    });

    $$('#task-filters .chip').forEach((chip) => chip.addEventListener('click', () => {
      filter = chip.dataset.filter;
      $$('#task-filters .chip').forEach((c) => c.classList.toggle('active', c === chip));
      render();
    }));

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
      goalId: extra.goalId || null,
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
    const li = UI.node('li', `task-item pri-${t.priority}${t.done ? ' done' : ''}${t.urgent ? ' urgent' : ''}`);
    li.dataset.id = t.id;
    li.innerHTML = `
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
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-mini task-focus" title="Работать над этим">🎯</button>
        <button class="icon-mini task-del" title="Удалить">🗑️</button>
      </div>`;
    li.querySelector('.task-check').addEventListener('click', (e) => complete(t, e.currentTarget));
    li.querySelector('.task-del').addEventListener('click', () => remove(t.id, li));
    li.querySelector('.task-focus').addEventListener('click', () => focusOn(t));
    return li;
  }

  function filtered() {
    const tasks = State.s.tasks;
    if (filter === 'active') return tasks.filter((t) => !t.done);
    if (filter === 'done') return tasks.filter((t) => t.done);
    return tasks;
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

  return { bind, render, renderToday, add, complete };
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
              <span class="habit-streak">🔥 ${streak} дн.</span>
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
      root.appendChild(el);
    });

    $('#habit-empty').classList.toggle('hidden', State.s.habits.length > 0);
  }

  return { bind, render, add };
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
              ${g.deadline ? `<span class="${dl < 0 ? 'overdue' : ''}">📅 ${dl >= 0 ? `осталось ${dl} дн.` : `просрочено на ${-dl} дн.`}</span>` : '<span class="muted">без дедлайна</span>'}
              <span>${done}/${g.milestones.length} шагов</span>
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
