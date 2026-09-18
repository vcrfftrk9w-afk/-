'use strict';
/* =========================================================
   SCREENS EXTRA — музыка, рутины дня, напоминалки, итоги недели
   ========================================================= */

/* =========================================================
   МУЗЫКА: панель станций + мини-плеер на всех вкладках
   ========================================================= */
Screens.music = (() => {
  const { $, $$ } = UI;
  let visRAF = null;
  let built = false;

  function currentStation() {
    return Music.STATIONS.find((s) => s.id === Music.stationId) || Music.STATIONS[0];
  }

  function bind() {
    // сетка станций
    const grid = $('#station-grid');
    grid.innerHTML = Music.STATIONS.map((st) => `
      <button class="station" data-station="${st.id}">
        <span class="station-emoji">${st.emoji}</span>
        <span class="station-name">${UI.esc(st.name)}</span>
        <span class="station-desc">${UI.esc(st.desc)}</span>
        <span class="station-bpm">${st.bpm} BPM</span>
      </button>`).join('');
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-station]');
      if (!btn) return;
      const id = btn.dataset.station;
      State.s.music.station = id;
      Music.setStation(id);
      $('#music-bpm').value = currentStation().bpm;
      $('#music-bpm-val').textContent = currentStation().bpm;
      Music.setBpm(null);
      Sound.sfx('click');
      State.save();
      render();
    });

    $('#music-suggest').addEventListener('click', () => {
      const id = suggestStation();
      const st = Music.STATIONS.find((x) => x.id === id);
      State.s.music.station = id;
      Music.setStation(id);
      Music.setBpm(null);
      $('#music-bpm').value = st.bpm;
      $('#music-bpm-val').textContent = st.bpm;
      Sound.sfx('quest');
      UI.toast(`Подобрано: ${st.name}`, 'success', st.emoji);
      State.save();
      render();
    });

    $('#music-play').addEventListener('click', () => {
      Music.toggle(State.s.music.station);
      render();
    });
    $('#music-next').addEventListener('click', () => {
      Music.reseed();
      if (!Music.playing) Music.play(State.s.music.station);
      UI.toast('Новый трек сгенерирован 🎲', 'default', '🎵');
      render();
    });
    $('#music-volume').addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      State.s.music.volume = v;
      Music.setVolume(v);
      $('#mini-volume').value = e.target.value;
    });
    $('#music-volume').addEventListener('change', () => State.save());

    $('#music-bpm').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      $('#music-bpm-val').textContent = v;
      Music.setBpm(v);
    });
    $('#music-sleep').addEventListener('change', (e) => {
      const minutes = Number(e.target.value);
      State.s.music.sleepMinutes = minutes;
      Music.setSleep(minutes);
      if (minutes) UI.toast(`Музыка выключится через ${minutes} мин`, 'default', '🌙');
      State.save();
    });
    $('#music-auto').addEventListener('change', (e) => {
      State.s.music.autoWithTimer = e.target.checked;
      State.save();
    });

    // мини-плеер
    $('#mini-play').addEventListener('click', () => { Music.toggle(State.s.music.station); render(); });
    $('#mini-next').addEventListener('click', () => {
      Music.reseed();
      if (!Music.playing) Music.play(State.s.music.station);
      render();
    });
    $('#mini-volume').addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      State.s.music.volume = v;
      Music.setVolume(v);
      $('#music-volume').value = e.target.value;
    });
    $('#mini-volume').addEventListener('change', () => State.save());
    $('#mini-open').addEventListener('click', () => {
      App.go('adhd');
      setTimeout(() => {
        const card = document.querySelector('.music-card');
        if (card) card.scrollIntoView({ behavior: State.s.reduceMotion ? 'auto' : 'smooth', block: 'center' });
      }, 200);
    });

    // микшер партий
    const PART_META = [
      { id: 'drums', emoji: '🥁', name: 'Ударные' },
      { id: 'bass', emoji: '🎸', name: 'Бас' },
      { id: 'melody', emoji: '🎹', name: 'Мелодия' },
      { id: 'pad', emoji: '🌫️', name: 'Пэд' },
    ];
    const mixRoot = $('#part-mix');
    const saved = State.s.music.parts || {};
    mixRoot.innerHTML = PART_META.map((p) => `
      <label class="part-row" data-part="${p.id}">
        <span class="part-name">${p.emoji} ${p.name}</span>
        <input type="range" min="0" max="120" value="${Math.round((saved[p.id] != null ? saved[p.id] : 1) * 100)}">
      </label>`).join('');
    mixRoot.addEventListener('input', (e) => {
      const row = e.target.closest('[data-part]');
      if (!row) return;
      const v = Number(e.target.value) / 100;
      State.s.music.parts = State.s.music.parts || {};
      State.s.music.parts[row.dataset.part] = v;
      Music.setPart(row.dataset.part, v);
    });
    mixRoot.addEventListener('change', () => State.save());
    PART_META.forEach((p) => Music.setPart(p.id, saved[p.id] != null ? saved[p.id] : 1));

    $('#mini-vis').innerHTML = Array.from({ length: 10 }, () => '<i></i>').join('');

    Music.onChange(render);
    built = true;

    // стартовые значения
    Music.setVolume(State.s.music.volume ?? 0.5);
    $('#music-volume').value = Math.round((State.s.music.volume ?? 0.5) * 100);
    $('#mini-volume').value = Math.round((State.s.music.volume ?? 0.5) * 100);
    $('#music-auto').checked = !!State.s.music.autoWithTimer;
    $('#music-bpm').value = currentStation().bpm;
    $('#music-bpm-val').textContent = currentStation().bpm;
    startVisualizer();
  }

  /* станция под время суток и текущее занятие */
  function suggestStation() {
    const h = new Date().getHours();
    if (Screens.focus.running) return h >= 22 || h < 6 ? 'deep' : 'lofi';
    if (h < 6) return 'sleep';
    if (h < 10) return 'energy';
    if (h < 14) return 'lofi';
    if (h < 18) return 'jazz';
    if (h < 22) return 'piano';
    return 'sleep';
  }

  function render() {
    if (!built) return;
    const st = currentStation();
    const playing = Music.playing;

    $$('.station').forEach((b) => b.classList.toggle('active', b.dataset.station === Music.stationId));
    $('#music-play').innerHTML = playing ? '⏸️ Пауза' : '▶️ Включить';
    $('#music-now').textContent = playing ? `${st.emoji} ${st.name}` : 'выключено';

    $('#mini-station').textContent = `${st.emoji} ${st.name}`;
    $('#mini-play').innerHTML = Icons.get(playing ? 'pause' : 'play', { size: 16 });
    $('#mini-player').classList.toggle('playing', playing);

    const sleepLeft = Music.sleepLeft();
    $('#mini-sub').textContent = playing
      ? `${Music.bpm} BPM · трек #${String(Music.seed).slice(-4)}${sleepLeft ? ` · сон через ${Math.ceil(sleepLeft / 60)} мин` : ''}`
      : 'музыка выключена';
  }

  function startVisualizer() {
    if (visRAF) return;
    const bars = $$('#mini-vis i');
    let t = 0;
    const loop = () => {
      t += 0.12;
      const levels = Music.playing ? Sound.levels(bars.length) : null;
      bars.forEach((bar, i) => {
        const h = levels ? 10 + Math.min(1, levels[i] * 1.05) * 90 : 8 + (Math.sin(t + i * 0.7) * 0.5 + 0.5) * 6;
        bar.style.height = h + '%';
      });
      visRAF = requestAnimationFrame(loop);
    };
    loop();
  }

  /* вызывается таймером фокуса */
  function autoStart() {
    if (!State.s.music.autoWithTimer || Music.playing) return;
    Music.play(State.s.music.station);
    render();
  }

  return { bind, render, autoStart, suggestStation };
})();

/* =========================================================
   РУТИНЫ ДНЯ
   ========================================================= */
Screens.routines = (() => {
  const { $, $$ } = UI;
  let kind = new Date().getHours() >= 17 ? 'evening' : 'morning';

  function bind() {
    $$('#routine-switch .chip').forEach((chip) => chip.addEventListener('click', () => {
      kind = chip.dataset.routine;
      $$('#routine-switch .chip').forEach((c) => c.classList.toggle('active', c === chip));
      Sound.sfx('click');
      render();
    }));

    $('#routine-add').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#routine-input');
      const text = input.value.trim();
      if (!text) return;
      State.s.routines[kind].push({ id: State.uid(), text });
      input.value = '';
      Sound.sfx('click');
      State.commit();
    });
  }

  function toggle(item, el) {
    const s = State.s;
    const today = State.todayKey();
    const day = s.routines.done[today] || (s.routines.done[today] = {});
    day[item.id] = !day[item.id];

    if (day[item.id]) {
      State.addXP(5, 'discipline');
      State.addCoins(4);
      State.registerActivity();
      Sound.sfx('check');
      FX.confettiFrom(el, 12, { power: 6 });

      const items = s.routines[kind];
      const all = items.length > 0 && items.every((i) => day[i.id]);
      const flag = `_done_${kind}`;
      if (all && !day[flag]) {
        day[flag] = true;
        s.totals.routinesDone = (s.totals.routinesDone || 0) + 1;
        State.addXP(30, 'discipline');
        State.addCoins(25);
        FX.confetti(window.innerWidth / 2, window.innerHeight / 2, 60);
        Sound.sfx('fanfare');
        UI.toast(`${kind === 'morning' ? 'Утренняя' : 'Вечерняя'} рутина закрыта! +30 XP`, 'level', '🌅');
      }
    } else {
      Sound.sfx('click');
    }
    State.commit();
  }

  function render() {
    const s = State.s;
    const today = State.todayKey();
    const day = s.routines.done[today] || {};
    const items = s.routines[kind] || [];
    const root = $('#routine-list');
    root.innerHTML = '';

    items.forEach((item) => {
      const done = !!day[item.id];
      const row = UI.node('div', `routine-item${done ? ' done' : ''}`);
      row.innerHTML = `
        <button class="routine-check">${done ? '✓' : ''}</button>
        <span class="routine-text">${UI.esc(item.text)}</span>
        <button class="icon-mini routine-del" title="Убрать">✕</button>`;
      row.querySelector('.routine-check').addEventListener('click', (e) => toggle(item, e.currentTarget));
      row.querySelector('.routine-del').addEventListener('click', () => {
        State.s.routines[kind] = State.s.routines[kind].filter((i) => i.id !== item.id);
        State.commit();
      });
      root.appendChild(row);
    });

    if (!items.length) root.innerHTML = '<p class="empty-hint">Пунктов нет. Добавь свой ритуал ниже.</p>';

    const prog = State.routineProgress(kind);
    $('#routine-bar').style.width = prog.pct + '%';
  }

  return { bind, render };
})();

/* =========================================================
   НАПОМИНАЛКИ
   ========================================================= */
Screens.reminders = (() => {
  const { $ } = UI;
  let built = false;

  function render() {
    const root = $('#reminder-list');
    const s = State.s;
    if (!built) {
      root.innerHTML = Data.REMINDERS.map((r) => `
        <div class="reminder-row" data-rem="${r.id}">
          <span class="reminder-emoji">${r.emoji}</span>
          <div class="grow">
            <div class="reminder-name">${UI.esc(r.name)}</div>
            <div class="muted small">${UI.esc(r.text)}</div>
          </div>
          <select class="reminder-every mini-select">
            ${r.options.map((o) => `<option value="${o}">${o} мин</option>`).join('')}
          </select>
          <label class="switch-mini"><input type="checkbox" class="reminder-toggle"><span></span></label>
        </div>`).join('');
      root.addEventListener('change', (e) => {
        const row = e.target.closest('[data-rem]');
        if (!row) return;
        const id = row.dataset.rem;
        const cfg = State.s.reminders[id];
        if (e.target.classList.contains('reminder-toggle')) {
          cfg.on = e.target.checked;
          cfg.last = Date.now();
          if (cfg.on) {
            UI.toast(`Напоминание включено: каждые ${cfg.every} мин`, 'success', '🔔');
            Sound.sfx('check');
          }
        } else if (e.target.classList.contains('reminder-every')) {
          cfg.every = Number(e.target.value);
          cfg.last = Date.now();
        }
        State.commit();
      });
      built = true;
    }

    // тихие часы
    const q = s.quiet || { on: false, from: 22, to: 8 };
    const qt = document.getElementById('quiet-toggle');
    if (qt && !qt.dataset.bound) {
      qt.dataset.bound = '1';
      qt.addEventListener('change', (e) => {
        State.s.quiet.on = e.target.checked;
        UI.toast(e.target.checked ? 'Напоминания будут молчать ночью' : 'Тихие часы выключены', 'default', '🌙');
        State.commit();
      });
      ['from', 'to'].forEach((k) => {
        const el = document.getElementById('quiet-' + k);
        el.addEventListener('change', () => {
          State.s.quiet[k] = Math.max(0, Math.min(23, Number(el.value) || 0));
          State.commit();
        });
      });
    }
    if (qt) {
      qt.checked = !!q.on;
      document.getElementById('quiet-from').value = q.from;
      document.getElementById('quiet-to').value = q.to;
      document.getElementById('quiet-label').textContent = `${q.from}:00 – ${q.to}:00`;
      document.getElementById('quiet-times').classList.toggle('hidden', !q.on);
    }

    Data.REMINDERS.forEach((r) => {
      const row = root.querySelector(`[data-rem="${r.id}"]`);
      if (!row) return;
      const cfg = s.reminders[r.id] || {};
      row.querySelector('.reminder-toggle').checked = !!cfg.on;
      row.querySelector('.reminder-every').value = String(cfg.every || r.options[0]);
      row.classList.toggle('on', !!cfg.on);
    });
  }

  /* проверка раз в полминуты из app.js */
  /* тихие часы: в это время напоминания молчат */
  function isQuiet() {
    const q = State.s.quiet;
    if (!q || !q.on) return false;
    const h = new Date().getHours();
    return q.from > q.to ? (h >= q.from || h < q.to) : (h >= q.from && h < q.to);
  }

  function tick() {
    const s = State.s;
    if (isQuiet()) return;
    const now = Date.now();
    Data.REMINDERS.forEach((r) => {
      const cfg = s.reminders[r.id];
      if (!cfg || !cfg.on) return;
      if (!cfg.last) { cfg.last = now; return; }
      if (now - cfg.last >= cfg.every * 60000) {
        cfg.last = now;
        UI.toast(`${r.name}: ${r.text}`, 'default', r.emoji);
        Sound.sfx('quest');
        FX.vibrate([15, 40, 15]);
        if (s.notifications && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification(`${r.emoji} ${r.name}`, { body: r.text }); } catch (e) {}
        }
        State.save();
      }
    });
  }

  return { render, tick, isQuiet, bind: () => {} };
})();

/* =========================================================
   ИТОГИ НЕДЕЛИ
   ========================================================= */
Screens.review = (() => {
  const { $ } = UI;

  function weekKey(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() - offset * 7);
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  }

  function collect(startOffset) {
    const s = State.s;
    let tasks = 0, focus = 0, habits = 0, moodSum = 0, moodCount = 0;
    let best = { key: null, count: -1 };
    for (let i = startOffset; i < startOffset + 7; i++) {
      const key = State.daysAgoKey(i);
      const t = s.dailyTaskCounts[key] || 0;
      tasks += t;
      focus += s.dailyFocusMinutes[key] || 0;
      habits += s.habits.filter((h) => h.history[key]).length;
      const m = s.moods[key];
      if (m) { moodSum += m.mood; moodCount += 1; }
      if (t > best.count) best = { key, count: t };
    }
    return { tasks, focus, habits, mood: moodCount ? moodSum / moodCount : null, best };
  }

  function diffLabel(now, prev) {
    const d = now - prev;
    if (!prev && !now) return '<span class="muted small">—</span>';
    if (d === 0) return '<span class="muted small">как на прошлой</span>';
    const up = d > 0;
    return `<span class="trend ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(d)}</span>`;
  }

  function bind() {
    $('#review-save').addEventListener('click', (e) => {
      const key = weekKey();
      if (State.s.weeklyReviews[key]) {
        UI.toast('Итоги этой недели уже подведены', 'warn', '📋');
        return;
      }
      const cur = collect(0);
      State.s.weeklyReviews[key] = { at: Date.now(), ...cur };
      State.s.totals.reviewsDone = (State.s.totals.reviewsDone || 0) + 1;
      State.addXP(60, 'mind');
      State.addCoins(50);
      Sound.sfx('fanfare');
      FX.confettiFrom(e.currentTarget, 50);
      UI.toast('Итоги недели сохранены! +60 XP', 'level', '📋');
      State.commit();
    });
  }

  function render() {
    const cur = collect(0);
    const prev = collect(7);
    const saved = State.s.weeklyReviews[weekKey()];
    const root = $('#weekly-review');

    const rows = [
      ['✅', 'Задач закрыто', cur.tasks, prev.tasks],
      ['⏱️', 'Минут фокуса', cur.focus, prev.focus],
      ['🔥', 'Отметок привычек', cur.habits, prev.habits],
    ];

    // шаги пути за неделю — главный показатель движения к деньгам
    let pathBlock = '';
    if (typeof Path !== 'undefined') {
      const weekAgo = Date.now() - 7 * 86400000;
      const doneThisWeek = Path.ALL.filter((x) => (State.s.path.done[x.id] || 0) > weekAgo).length;
      const n = Path.nextStep();
      pathBlock = `
        <div class="review-path">
          <b>${doneThisWeek > 0
            ? `${UI.plur(doneThisWeek, 'шаг', 'шага', 'шагов')} пути за неделю`
            : 'За неделю ни одного шага пути'}</b>
          <p>${doneThisWeek > 0
            ? `Всего пройдено ${Path.doneCount()} из ${Path.STEP_COUNT}. ${n ? 'Следующий: ' + UI.esc(n.step.t) : 'Путь пройден целиком.'}`
            : (n ? 'Задачи закрываются, но к деньгам это пока не двигает. Следующий шаг: ' + UI.esc(n.step.t) : 'Путь пройден целиком.')}</p>
        </div>`;
    }

    root.innerHTML = `
      ${pathBlock}
      <div class="review-grid">
        ${rows.map(([emoji, label, now, before]) => `
          <div class="review-cell">
            <span class="review-emoji">${emoji}</span>
            <b>${UI.fmt(now)}</b>
            <small>${label}</small>
            ${diffLabel(now, before)}
          </div>`).join('')}
        <div class="review-cell">
          <span class="review-emoji">🙂</span>
          <b>${cur.mood ? cur.mood.toFixed(1).replace('.', ',') : '—'}</b>
          <small>среднее настроение</small>
          ${cur.mood && prev.mood ? diffLabel(Math.round(cur.mood * 10) / 10, Math.round(prev.mood * 10) / 10) : '<span class="muted small">—</span>'}
        </div>
      </div>
      <p class="muted small">${cur.best.key && cur.best.count > 0
        ? `Лучший день недели: <b>${UI.dateLabel(cur.best.key)}</b> — ${cur.best.count} задач.`
        : 'На этой неделе задач пока нет — самое время начать.'}
        ${saved ? ' · Итоги недели уже сохранены ✓' : ''}</p>`;
  }

  return { bind, render };
})();
