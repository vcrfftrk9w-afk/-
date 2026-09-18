'use strict';
/* =========================================================
   PALETTE — командная палитра (Ctrl/⌘ + K)
   Поиск по разделам, действиям, задачам, привычкам, урокам и станциям.
   ========================================================= */

const Palette = (() => {
  const { $, $$ } = UI;
  let items = [];
  let filtered = [];
  let cursor = 0;
  let open = false;

  /* ---------- сбор команд ---------- */
  function build() {
    const s = State.s;
    const list = [];

    const NAV = [
      ['dashboard', 'home', 'Главная', 'Квесты, персонаж, состояние дня'],
      ['tasks', 'tasks', 'Задачи', 'Список и матрица приоритетов'],
      ['path', 'path', 'Путь к деньгам', '35 шагов от нуля до свободы'],
      ['adhd', 'focus', 'Фокус и СДВГ-инструменты', 'Таймер, музыка, рулетка, дыхание'],
      ['habits', 'habits', 'Привычки', 'Недельная сетка и стрики'],
      ['goals', 'goals', 'Цели', 'Большие цели и шаги'],
      ['lessons', 'lessons', 'Курс', '24 урока'],
      ['empire', 'empire', 'Империя', 'Активы и пассивный доход'],
      ['rewards', 'rewards', 'Награды', 'Достижения, бустеры, темы'],
      ['stats', 'stats', 'Статистика', 'Графики и итоги'],
    ];
    NAV.forEach(([tab, icon, name, desc]) => list.push({
      group: 'Разделы', icon, title: name, sub: desc,
      run: () => App.go(tab),
    }));

    // действия
    list.push(
      { group: 'Действия', icon: 'plus', title: 'Новая задача', sub: 'Открыть форму задачи', keys: 'N',
        run: () => { App.go('tasks'); setTimeout(() => $('#task-title').focus(), 150); } },
      { group: 'Действия', icon: 'bolt', title: 'Быстрый захват мысли', sub: 'В задачи или brain dump', keys: 'Q',
        run: () => App.openCapture() },
      { group: 'Действия', icon: 'timer', title: Screens.focus.running ? 'Остановить фокус-таймер' : 'Запустить фокус-таймер', sub: 'Помодоро и другие режимы', keys: 'F',
        run: () => { App.go('adhd'); Screens.focus.toggleTimer(); } },
      { group: 'Действия', icon: 'focus', title: 'Режим гиперфокуса', sub: 'Полный экран, одна задача', keys: 'H',
        run: () => Screens.focus.enterHyperfocus() },
      { group: 'Действия', icon: 'music', title: Music.playing ? 'Выключить музыку' : 'Включить музыку', sub: 'Генеративные станции', keys: 'M',
        run: () => { Music.toggle(State.s.music.station); Screens.music.render(); } },
      { group: 'Действия', icon: 'shuffle', title: 'Новый музыкальный трек', sub: 'Сгенерировать заново',
        run: () => { Music.reseed(); if (!Music.playing) Music.play(State.s.music.station); Screens.music.render(); } },
      { group: 'Действия', icon: 'goals', title: 'Дай микро-шаг', sub: 'Когда не можешь начать',
        run: () => { App.go('dashboard'); setTimeout(() => $('#unstuck-btn').click(), 200); } },
      { group: 'Действия', icon: 'sun', title: s.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема', sub: 'Переключить оформление',
        run: () => $('#theme-toggle').click() },
      { group: 'Действия', icon: 'bolt', title: s.mode === 'adhd' ? 'Обычный режим' : 'СДВГ-режим', sub: 'Сменить интенсивность интерфейса',
        run: () => $('#mode-toggle').click() },
      { group: 'Действия', icon: 'coin', title: 'Трекер денег', sub: 'Доход, расходы, подушка, капитал',
        run: () => { App.go('path'); setTimeout(() => { const el = document.querySelector('#m-income'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 250); } },
      { group: 'Действия', icon: 'settings', title: 'Настройки', sub: 'Тема, звук, доступность',
        run: () => $('#settings-btn').click() },
    );

    // шаги пути
    if (typeof Path !== 'undefined') {
      const n = Path.nextStep();
      if (n) list.push({
        group: 'Действия', icon: 'path', title: 'Следующий шаг пути', sub: n.step.t,
        run: () => App.go('path'),
      });
      Path.ALL.filter((x) => !Path.isDone(x.id)).slice(0, 40).forEach((step) => {
        const st = Path.STAGES.find((x) => x.id === step.stage);
        list.push({
          group: 'Путь', emoji: st.emoji, title: step.t, sub: `${st.name} · +${step.xp} XP`,
          run: () => { App.go('path'); setTimeout(() => Screens.path.openStep(step.id), 220); },
        });
      });
    }

    // станции музыки
    Music.STATIONS.forEach((st) => list.push({
      group: 'Музыка', emoji: st.emoji, title: st.name, sub: `${st.desc} · ${st.bpm} BPM`,
      run: () => { State.s.music.station = st.id; Music.setStation(st.id); Screens.music.render(); State.save(); UI.toast(`Станция: ${st.name}`, 'default', st.emoji); },
    }));

    // активные задачи
    s.tasks.filter((t) => !t.done).slice(0, 25).forEach((t) => {
      const cat = Data.categoryById(t.category);
      list.push({
        group: 'Задачи', emoji: cat.emoji, title: t.title, sub: `Отметить выполненной · +${Screens.helpers.taskXP(t)} XP`,
        run: () => { Screens.tasks.complete(t, $('#coin-pill')); },
      });
    });

    // привычки
    s.habits.forEach((h) => {
      const done = !!h.history[State.todayKey()];
      list.push({
        group: 'Привычки', emoji: h.emoji, title: h.name, sub: done ? 'Уже отмечена сегодня' : 'Отметить сегодня',
        run: () => { App.go('habits'); if (!done) setTimeout(() => { const btn = document.querySelector('.habit-item .habit-day.today'); if (btn) btn.click(); }, 200); },
      });
    });

    // уроки
    Data.LESSONS.forEach((l) => list.push({
      group: 'Курс', emoji: l.emoji, title: l.title, sub: (Data.TRACKS.find((t) => t.id === l.track) || {}).name || 'Урок',
      run: () => { App.go('lessons'); setTimeout(() => Screens.lessons.openById(l.id), 220); },
    }));

    items = list;
  }

  /* ---------- поиск ---------- */
  function score(item, q) {
    if (!q) return 1;
    const hay = `${item.title} ${item.sub || ''} ${item.group}`.toLowerCase();
    const query = q.toLowerCase().trim();
    if (hay.includes(query)) return 100 - hay.indexOf(query);
    // нечёткое совпадение по буквам подряд
    let i = 0;
    for (const ch of query) {
      i = hay.indexOf(ch, i);
      if (i === -1) return 0;
      i += 1;
    }
    return 10;
  }

  function search(q) {
    filtered = items
      .map((it) => ({ it, s: score(it, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, q ? 30 : 12)
      .map((x) => x.it);
    cursor = 0;
    render();
  }

  function render() {
    const root = $('#palette-results');
    if (!filtered.length) {
      root.innerHTML = '<p class="empty-hint">Ничего не найдено. Попробуй другое слово.</p>';
      return;
    }
    let html = '';
    let group = null;
    filtered.forEach((it, i) => {
      if (it.group !== group) {
        group = it.group;
        html += `<div class="pal-group">${UI.esc(group)}</div>`;
      }
      html += `
        <button class="pal-item${i === cursor ? ' active' : ''}" data-i="${i}">
          <span class="pal-ico">${it.emoji ? it.emoji : Icons.get(it.icon || 'more', { size: 18 })}</span>
          <span class="pal-text">
            <b>${UI.esc(it.title)}</b>
            ${it.sub ? `<small>${UI.esc(it.sub)}</small>` : ''}
          </span>
          ${it.keys ? `<kbd>${it.keys}</kbd>` : '<span class="pal-enter">↵</span>'}
        </button>`;
    });
    root.innerHTML = html;
    root.querySelectorAll('.pal-item').forEach((b) => {
      b.addEventListener('click', () => run(Number(b.dataset.i)));
      b.addEventListener('mousemove', () => {
        const i = Number(b.dataset.i);
        if (i !== cursor) { cursor = i; highlight(); }
      });
    });
    highlight();
  }

  function highlight() {
    $$('#palette-results .pal-item').forEach((b, i) => {
      const on = i === cursor;
      b.classList.toggle('active', on);
      if (on) b.scrollIntoView({ block: 'nearest' });
    });
  }

  function run(i) {
    const item = filtered[i];
    if (!item) return;
    close();
    Sound.sfx('click');
    setTimeout(() => { try { item.run(); } catch (e) { console.warn(e); } }, 60);
  }

  /* ---------- открытие/закрытие ---------- */
  function show() {
    build();
    open = true;
    UI.openModal('#palette-modal');
    const input = $('#palette-input');
    input.value = '';
    search('');
    setTimeout(() => input.focus(), 60);
  }

  function close() {
    open = false;
    UI.closeModal('#palette-modal');
  }

  function toggle() { open ? close() : show(); }

  function bind() {
    $('#palette-input').addEventListener('input', (e) => search(e.target.value));
    $('#palette-input').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(filtered.length - 1, cursor + 1); highlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(0, cursor - 1); highlight(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(cursor); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    $('#cmd-btn').addEventListener('click', show);

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л')) {
        e.preventDefault();
        toggle();
      }
    });
  }

  return { bind, show, close, toggle, get isOpen() { return open; } };
})();
