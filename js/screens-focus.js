'use strict';
/* =========================================================
   SCREENS FOCUS — вкладка СДВГ: таймер, микшер, инструменты
   ========================================================= */

Screens.focus = (() => {
  const { $, $$ } = UI;
  const RING = 2 * Math.PI * 94;

  const T = {
    mode: 'pomodoro',
    phase: 'focus',      // focus | break
    remaining: 25 * 60,
    total: 25 * 60,
    elapsed: 0,          // для flowtime
    running: false,
    interval: null,
    msgInterval: null,
    cycles: 0,
    taskId: null,
  };

  let visRAF = null;
  let breathing = { active: false, timer: null, cycles: 0, technique: 'calm' };

  /* ================= ТАЙМЕР ================= */
  function modeData() { return Data.TIMER_MODES.find((m) => m.id === T.mode) || Data.TIMER_MODES[0]; }

  function setMode(id) {
    if (T.running) { UI.toast('Сначала останови таймер', 'warn', '⏸️'); $('#timer-mode').value = T.mode; return; }
    T.mode = id;
    const m = modeData();
    T.phase = 'focus';
    if (m.focus === 0) { T.elapsed = 0; T.remaining = 0; T.total = 0; }
    else { T.remaining = m.focus * 60; T.total = m.focus * 60; }
    renderTimer();
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  }

  function discPath(frac) {
    const cx = 110, cy = 110, r = 78;
    if (frac <= 0) return '';
    if (frac >= 0.9999) {
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
    }
    const a0 = -Math.PI / 2;
    const a1 = a0 + Math.PI * 2 * frac;
    const x1 = cx + Math.cos(a0) * r, y1 = cy + Math.sin(a0) * r;
    const x2 = cx + Math.cos(a1) * r, y2 = cy + Math.sin(a1) * r;
    const large = frac > 0.5 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
  }

  function renderTimer() {
    const m = modeData();
    const isFlow = m.focus === 0 && T.phase === 'focus';
    const display = isFlow ? T.elapsed : T.remaining;
    $('#timer-time').textContent = fmtTime(display);
    $('#timer-phase').textContent = T.phase === 'focus' ? (isFlow ? 'Flow' : 'Фокус') : 'Перерыв';
    $('#timer-cycles').textContent = `🍅 ${T.cycles}`;

    const frac = isFlow ? Math.min(1, (T.elapsed % 3600) / 3600) : (T.total ? T.remaining / T.total : 0);
    const ring = $('#timer-ring-fg');
    ring.style.strokeDasharray = RING;
    ring.style.strokeDashoffset = RING * (1 - (isFlow ? frac : 1 - frac));
    ring.classList.toggle('break', T.phase === 'break');
    $('#time-disc').setAttribute('d', discPath(isFlow ? frac : (T.total ? T.remaining / T.total : 0)));
    $('#time-disc').classList.toggle('break', T.phase === 'break');

    $('#timer-start').disabled = T.running;
    $('#timer-pause').disabled = !T.running;
    $('#timer-start').innerHTML = T.remaining < T.total || T.elapsed > 0 ? '▶️ Дальше' : '▶️ Старт';

    const today = State.todayKey();
    UI.countUp($('#focus-today'), State.s.dailyFocusMinutes[today] || 0);
    UI.countUp($('#focus-total'), State.s.totals.focusSessions);

    renderHyperfocus();
    renderHud();
  }

  /* плавающая плашка таймера — видна на любой вкладке */
  const HUD_RING = 2 * Math.PI * 12;
  function renderHud() {
    const hud = document.getElementById('focus-hud');
    if (!hud) return;
    const onFocusTab = document.getElementById('tab-adhd').classList.contains('active');
    const hyper = !document.getElementById('hyperfocus').classList.contains('hidden');
    const show = T.running && !onFocusTab && !hyper;
    hud.classList.toggle('hidden', !show);
    if (!show) return;

    const m = modeData();
    const isFlow = m.focus === 0 && T.phase === 'focus';
    document.getElementById('focus-hud-time').textContent = fmtTime(isFlow ? T.elapsed : T.remaining);
    document.getElementById('focus-hud-label').textContent = T.phase === 'break' ? 'перерыв' : (isFlow ? 'поток' : 'фокус идёт');
    hud.classList.toggle('break', T.phase === 'break');
    const frac = isFlow ? (T.elapsed % 3600) / 3600 : (T.total ? 1 - T.remaining / T.total : 0);
    const ring = document.getElementById('focus-hud-ring');
    ring.style.strokeDasharray = HUD_RING;
    ring.style.strokeDashoffset = HUD_RING * (1 - frac);
  }

  function companion(msg) {
    const el = $('#timer-companion');
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = msg || Data.COMPANION_MSGS[Math.floor(Math.random() * Data.COMPANION_MSGS.length)];
      el.style.opacity = '1';
    }, 160);
    const hf = $('#hf-msg');
    if (hf) hf.textContent = el.textContent;
  }

  function start() {
    if (T.running) return;
    Sound.ready();
    T.running = true;
    Sound.sfx('start');
    FX.vibrate(20);
    companion(T.phase === 'focus' ? 'Погнали! Первые 2 минуты — самые важные 🚀' : 'Перерыв. Встань и потянись 🧘');
    if (T.phase === 'focus') Screens.music.autoStart();
    T.interval = setInterval(tick, 1000);
    T.msgInterval = setInterval(() => companion(), 60000);
    requestNotifyPermission();
    renderTimer();
  }

  function pause() {
    T.running = false;
    clearInterval(T.interval);
    clearInterval(T.msgInterval);
    Sound.sfx('click');
    renderTimer();
  }

  function reset() {
    pause();
    const m = modeData();
    T.phase = 'focus';
    T.elapsed = 0;
    T.remaining = m.focus * 60;
    T.total = m.focus * 60;
    companion('Готов, когда будешь готов ты 🦥');
    renderTimer();
  }

  function tick() {
    const m = modeData();
    const isFlow = m.focus === 0 && T.phase === 'focus';
    if (isFlow) {
      T.elapsed += 1;
      if (T.elapsed % 600 === 0) companion(`${T.elapsed / 60} минут в потоке. Ты молодец!`);
    } else {
      T.remaining -= 1;
      if (T.remaining <= 0) {
        if (T.phase === 'focus') finishFocus(m.focus);
        else finishBreak();
        return;
      }
    }
    renderTimer();
  }

  function awardFocus(minutes) {
    if (minutes <= 0) return;
    const s = State.s;
    const gotXP = State.addXP(Math.round(minutes * 2), 'discipline');
    const coins = State.addCoins(Math.round(minutes * 1.5));
    s.totals.focusMinutes += minutes;
    s.totals.focusSessions += 1;
    const today = State.todayKey();
    s.dailyFocusMinutes[today] = (s.dailyFocusMinutes[today] || 0) + minutes;
    State.registerActivity();
    State.bumpQuest('focusMinutes', minutes);
    T.cycles += 1;

    const task = s.tasks.find((t) => t.id === T.taskId);
    s.focusLog = s.focusLog || [];
    s.focusLog.unshift({
      at: Date.now(), minutes, mode: T.mode,
      task: task ? task.title : null,
    });
    s.focusLog = s.focusLog.slice(0, 200);

    Sound.sfx('fanfare');
    FX.vibrate([30, 60, 30]);
    FX.confetti(window.innerWidth / 2, window.innerHeight / 2.4, 90, { power: 12 });
    UI.toast(`Сессия ${minutes} мин завершена! +${gotXP} XP · +${UI.fmt(coins)} 🪙`, 'level', '🎉');
    notify('Фокус-сессия завершена 🎉', `${minutes} минут в деле. Пора на перерыв.`);
    State.commit();
  }

  function finishFocus(minutes) {
    clearInterval(T.interval);
    clearInterval(T.msgInterval);
    awardFocus(minutes);

    const m = modeData();
    T.phase = 'break';
    T.total = m.break * 60;
    T.remaining = m.break * 60;
    T.running = true;
    T.interval = setInterval(tick, 1000);
    T.msgInterval = setInterval(() => companion(), 60000);
    companion('Перерыв! Глаза от экрана, ноги на пол 🌿');
    renderTimer();
  }

  function finishBreak() {
    pause();
    const m = modeData();
    T.phase = 'focus';
    T.remaining = m.focus * 60;
    T.total = m.focus * 60;
    Sound.sfx('success');
    UI.toast('Перерыв закончен. Готов к новому раунду?', 'success', '⚡');
    notify('Перерыв закончен ⚡', 'Возвращаемся к делу.');
    companion('Один заход — и снова отдых. Поехали?');
    renderTimer();
  }

  function stopFlow() {
    const minutes = Math.floor(T.elapsed / 60);
    pause();
    if (minutes >= 1) awardFocus(minutes);
    else UI.toast('Меньше минуты — не считается 🙂', 'warn');
    T.elapsed = 0;
    renderTimer();
  }

  /* ---------- уведомления ---------- */
  function requestNotifyPermission() {
    if (!State.s.notifications || !('Notification' in window)) return;
    if (Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
  }
  function notify(title, body) {
    if (!State.s.notifications || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try { new Notification(title, { body, icon: 'icons/icon.svg' }); } catch (e) {}
  }

  /* ================= ГИПЕРФОКУС ================= */
  function renderHyperfocus() {
    const overlay = $('#hyperfocus');
    if (!overlay || overlay.classList.contains('hidden')) return;
    const m = modeData();
    const isFlow = m.focus === 0 && T.phase === 'focus';
    $('#hf-time').textContent = fmtTime(isFlow ? T.elapsed : T.remaining);
    const pct = isFlow ? ((T.elapsed % 3600) / 3600) * 100 : (T.total ? ((T.total - T.remaining) / T.total) * 100 : 0);
    $('#hf-bar').style.width = pct + '%';
    $('#hf-toggle').innerHTML = T.running ? '⏸️ Пауза' : '▶️ Продолжить';

    const st = Music.station;
    $('#hf-station').textContent = Music.playing ? `${st.emoji} ${st.name} · ${Music.bpm} BPM` : 'музыка выключена';
    $('#hf-music-toggle').innerHTML = Icons.get(Music.playing ? 'pause' : 'play', { size: 16 });
    $('#hf-music-next').innerHTML = Icons.get('shuffle', { size: 16 });
  }

  /* аудио-визуализатор внутри гиперфокуса */
  let hfVisRAF = null;
  function startHfVis() {
    const wrap = $('#hf-vis');
    if (!wrap) return;
    if (!wrap.dataset.built) {
      wrap.innerHTML = Array.from({ length: 28 }, () => '<i></i>').join('');
      wrap.dataset.built = '1';
    }
    if (hfVisRAF) return;
    const bars = $$('#hf-vis i');
    let t = 0;
    const loop = () => {
      t += 0.08;
      const levels = Sound.levels(bars.length);
      bars.forEach((bar, i) => {
        const h = levels
          ? 6 + Math.min(1, levels[i] * 1.05) * 94
          : 6 + (Math.sin(t + i * 0.45) * 0.5 + 0.5) * 16;
        bar.style.height = h + '%';
      });
      hfVisRAF = requestAnimationFrame(loop);
    };
    loop();
  }
  function stopHfVis() {
    if (hfVisRAF) cancelAnimationFrame(hfVisRAF);
    hfVisRAF = null;
  }

  function enterHyperfocus() {
    const task = State.s.tasks.find((t) => t.id === T.taskId && !t.done);
    $('#hf-task').textContent = task ? task.title : 'Просто побудь в фокусе';
    $('#hyperfocus').classList.remove('hidden');
    document.body.classList.add('modal-lock');
    State.s.totals.hyperfocus += 1;
    if (!T.running) start();
    Sound.sfx('whoosh');
    startHfVis();
    State.commit();
    renderHyperfocus();
  }

  function exitHyperfocus() {
    $('#hyperfocus').classList.add('hidden');
    document.body.classList.remove('modal-lock');
    stopHfVis();
    Sound.sfx('click');
    renderHud();
  }

  /* завершить сессию досрочно и засчитать отработанные минуты */
  function finishEarly() {
    const m = modeData();
    const isFlow = m.focus === 0 && T.phase === 'focus';
    const minutes = isFlow ? Math.floor(T.elapsed / 60) : Math.floor((T.total - T.remaining) / 60);
    pause();
    if (minutes >= 1) {
      awardFocus(minutes);
    } else {
      UI.toast('Меньше минуты — не считается 🙂', 'warn');
    }
    T.phase = 'focus';
    T.elapsed = 0;
    T.remaining = m.focus * 60;
    T.total = m.focus * 60;
    renderTimer();
  }

  /* ================= МИКШЕР ================= */
  function renderMixer() {
    const grid = $('#mixer-grid');
    if (!grid.dataset.built) {
      grid.innerHTML = Data.SOUND_LAYERS.map((l) => `
        <div class="sound-tile" data-layer="${l.id}">
          <button class="sound-toggle">
            <span class="sound-emoji">${l.emoji}</span>
            <span class="sound-name">${UI.esc(l.name)}</span>
          </button>
          <input class="sound-slider" type="range" min="0" max="100" value="0" aria-label="${UI.esc(l.name)}">
        </div>`).join('');
      grid.dataset.built = '1';

      grid.addEventListener('click', (e) => {
        const toggle = e.target.closest('.sound-toggle');
        if (!toggle) return;
        const tile = toggle.closest('.sound-tile');
        const id = tile.dataset.layer;
        const cur = State.s.soundMix[id] || 0;
        setLayer(id, cur > 0 ? 0 : 0.5);
        Sound.sfx('pop');
      });
      grid.addEventListener('input', (e) => {
        const slider = e.target.closest('.sound-slider');
        if (!slider) return;
        const id = slider.closest('.sound-tile').dataset.layer;
        setLayer(id, Number(slider.value) / 100);
      });

      const presets = $('#sound-presets');
      presets.innerHTML = Data.SOUND_PRESETS.map((p) => `<button class="chip" data-preset="${p.id}">${p.emoji} ${UI.esc(p.name)}</button>`).join('');
      presets.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-preset]');
        if (!btn) return;
        const preset = Data.SOUND_PRESETS.find((p) => p.id === btn.dataset.preset);
        Sound.ready();
        State.s.soundMix = { ...preset.mix };
        Sound.applyMix(State.s.soundMix);
        Sound.sfx('click');
        UI.toast(`Микс: ${preset.name}`, 'default', preset.emoji);
        syncMixerUI();
        State.save();
      });

      $('#mixer-stop').addEventListener('click', () => {
        State.s.soundMix = {};
        Sound.stopAll();
        syncMixerUI();
        State.save();
        Sound.sfx('click');
      });

      const vol = $('#master-volume');
      vol.value = Math.round((State.s.masterVolume ?? 0.6) * 100);
      vol.addEventListener('input', (e) => {
        const v = Number(e.target.value) / 100;
        State.s.masterVolume = v;
        Sound.setMasterVolume(v);
      });
      vol.addEventListener('change', () => State.save());

      const vis = $('#visualizer');
      vis.innerHTML = Array.from({ length: 18 }, () => '<span></span>').join('');
    }
    syncMixerUI();
  }

  function setLayer(id, volume) {
    Sound.ready();
    State.s.soundMix[id] = volume;
    if (volume <= 0) delete State.s.soundMix[id];
    Sound.setLayer(id, volume);
    syncMixerUI();
    State.save();
  }

  function syncMixerUI() {
    $$('.sound-tile').forEach((tile) => {
      const id = tile.dataset.layer;
      const v = State.s.soundMix[id] || 0;
      tile.classList.toggle('active', v > 0);
      const slider = tile.querySelector('.sound-slider');
      if (document.activeElement !== slider) slider.value = Math.round(v * 100);
    });
  }

  function startVisualizer() {
    if (visRAF) return;
    const bars = $$('#visualizer span');
    let t = 0;
    const loop = () => {
      t += 0.1;
      const levels = Sound.levels(bars.length);
      bars.forEach((bar, i) => {
        let h;
        if (levels) h = 8 + Math.min(1, levels[i] * 1.05) * 92;
        else h = 6 + (Math.sin(t + i * 0.5) * 0.5 + 0.5) * 10;
        bar.style.height = h + '%';
      });
      visRAF = requestAnimationFrame(loop);
    };
    loop();
  }
  function stopVisualizer() {
    if (visRAF) cancelAnimationFrame(visRAF);
    visRAF = null;
  }

  /* ================= BRAIN DUMP ================= */
  function renderDump() {
    const list = $('#dump-list');
    list.innerHTML = '';
    State.s.brainDump.forEach((d) => {
      const li = UI.node('li', 'dump-item');
      li.innerHTML = `
        <span class="dump-text">${UI.esc(d.text)}</span>
        <span class="dump-actions">
          <button class="icon-mini" data-act="task" title="Сделать задачей">➡️✅</button>
          <button class="icon-mini" data-act="del" title="Удалить">🗑️</button>
        </span>`;
      li.querySelector('[data-act="task"]').addEventListener('click', () => {
        Screens.tasks.add(d.text, 'other', 'mid', false);
        State.s.brainDump = State.s.brainDump.filter((x) => x.id !== d.id);
        State.commit();
      });
      li.querySelector('[data-act="del"]').addEventListener('click', () => {
        State.s.brainDump = State.s.brainDump.filter((x) => x.id !== d.id);
        Sound.sfx('click');
        State.commit();
      });
      list.appendChild(li);
    });
    $('#dump-empty').classList.toggle('hidden', State.s.brainDump.length > 0);
  }

  /* ================= РУЛЕТКА ================= */
  let wheelAngle = 0;
  let spinning = false;

  function wheelTasks() {
    return State.s.tasks.filter((t) => !t.done).slice(0, 8);
  }

  function renderRoulette() {
    const svg = $('#roulette-wheel');
    const tasks = wheelTasks();
    const colors = ['#7c3aed', '#06b6d4', '#f59e0b', '#22c55e', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];
    if (!tasks.length) {
      svg.innerHTML = `<circle cx="100" cy="100" r="92" fill="none" stroke="var(--border)" stroke-width="10"/>
        <text x="100" y="105" text-anchor="middle" class="wheel-empty">нет задач</text>`;
      return;
    }
    const n = tasks.length;
    const seg = (Math.PI * 2) / n;
    let html = '';
    tasks.forEach((t, i) => {
      const a0 = i * seg - Math.PI / 2;
      const a1 = a0 + seg;
      const x1 = 100 + Math.cos(a0) * 92, y1 = 100 + Math.sin(a0) * 92;
      const x2 = 100 + Math.cos(a1) * 92, y2 = 100 + Math.sin(a1) * 92;
      const large = seg > Math.PI ? 1 : 0;
      html += `<path d="M100 100 L ${x1.toFixed(1)} ${y1.toFixed(1)} A 92 92 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${colors[i % colors.length]}" opacity="0.85"/>`;
      const am = a0 + seg / 2;
      const tx = 100 + Math.cos(am) * 58, ty = 100 + Math.sin(am) * 58;
      const label = t.title.length > 12 ? t.title.slice(0, 11) + '…' : t.title;
      html += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="wheel-label" text-anchor="middle" transform="rotate(${((am * 180) / Math.PI + 90).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})">${UI.esc(label)}</text>`;
    });
    svg.innerHTML = html;
    svg.style.transform = `rotate(${wheelAngle}deg)`;
  }

  function spin() {
    const tasks = wheelTasks();
    if (!tasks.length) { UI.toast('Сначала добавь задачи', 'warn', '🎰'); return; }
    if (spinning) return;
    spinning = true;
    Sound.sfx('whoosh');
    const idx = Math.floor(Math.random() * tasks.length);
    const seg = 360 / tasks.length;
    const target = 360 * 5 + (360 - (idx * seg + seg / 2));
    wheelAngle += target;
    const svg = $('#roulette-wheel');
    svg.style.transition = State.s.reduceMotion ? 'none' : 'transform 3.4s cubic-bezier(.17,.67,.21,1)';
    svg.style.transform = `rotate(${wheelAngle}deg)`;

    setTimeout(() => {
      spinning = false;
      const task = tasks[idx];
      const out = $('#roulette-result');
      out.innerHTML = `<b>${UI.esc(task.title)}</b><button class="btn btn-accent btn-sm" id="roulette-go">Работать над этим 🎯</button>`;
      out.classList.add('show');
      $('#roulette-go').addEventListener('click', () => {
        setTask(task.id);
        UI.toast('Задача в фокусе', 'success', '🎯');
        Sound.sfx('check');
      });
      State.s.totals.rouletteSpins += 1;
      Sound.sfx('quest');
      FX.confettiFrom($('#roulette-wheel'), 30);
      State.commit();
    }, State.s.reduceMotion ? 50 : 3450);
  }

  /* ================= РАЗБИВКА ЗАДАЧ ================= */
  function renderBreakdowns() {
    const root = $('#breakdown-list');
    root.innerHTML = '';
    State.s.breakdowns.forEach((bd) => {
      const done = bd.steps.filter((s) => s.done).length;
      const pct = bd.steps.length ? (done / bd.steps.length) * 100 : 0;
      const el = UI.node('div', `breakdown-group${bd.completed ? ' completed' : ''}`);
      el.innerHTML = `
        <div class="bd-head">
          <span>${bd.completed ? '✅' : '🐘'} ${UI.esc(bd.title)}</span>
          <button class="icon-mini bd-del" title="Удалить">🗑️</button>
        </div>
        <div class="bd-progress"><i style="width:${pct}%"></i></div>
        <div class="bd-steps"></div>
        <form class="row bd-add">
          <input class="grow" id="bd-add-${bd.id}" type="text" placeholder="Ещё шаг…" maxlength="90">
          <button class="btn btn-ghost btn-sm" type="submit">+</button>
        </form>`;
      const steps = el.querySelector('.bd-steps');
      bd.steps.forEach((s) => {
        const row = UI.node('label', `bd-step${s.done ? ' done' : ''}`);
        row.innerHTML = `<input type="checkbox" ${s.done ? 'checked' : ''}><span>${UI.esc(s.text)}</span>`;
        row.querySelector('input').addEventListener('change', (e) => toggleStep(bd, s, e.currentTarget));
        steps.appendChild(row);
      });
      el.querySelector('.bd-del').addEventListener('click', () => {
        State.s.breakdowns = State.s.breakdowns.filter((x) => x.id !== bd.id);
        State.commit();
      });
      const form = el.querySelector('.bd-add');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = form.querySelector('input');
        if (!inp.value.trim()) return;
        bd.steps.push({ id: State.uid(), text: inp.value.trim(), done: false });
        bd.completed = false;
        inp.value = '';
        State.commit();
      });
      root.appendChild(el);
    });
  }

  function toggleStep(bd, step, el) {
    step.done = !step.done;
    if (step.done) {
      State.addXP(6, 'discipline');
      State.addCoins(4);
      Sound.sfx('check');
      FX.floatText(el, '+6 XP', 'xp');
    } else Sound.sfx('click');

    const all = bd.steps.length && bd.steps.every((s) => s.done);
    if (all && !bd.completed) {
      bd.completed = true;
      State.s.totals.breakdownsUsed += 1;
      State.addXP(35, 'discipline');
      State.addCoins(25);
      State.registerActivity();
      State.bumpQuest('breakdowns', 1);
      Sound.sfx('fanfare');
      FX.confetti(window.innerWidth / 2, window.innerHeight / 2, 70);
      UI.toast('Слон съеден по кусочкам! +35 XP', 'level', '🐘');
    }
    State.commit();
  }

  /* ================= ОТВЛЕЧЕНИЯ ================= */
  function renderDistractions() {
    const list = $('#distraction-list');
    list.innerHTML = '';
    State.s.distractions.slice(0, 12).forEach((d) => {
      const li = UI.node('li', 'distraction-item');
      li.innerHTML = `<span>${UI.esc(d.text)}</span><time>${UI.hhmm(d.time)}</time>`;
      list.appendChild(li);
    });
  }

  /* ================= ПУПЫРКА ================= */
  function buildBubbles() {
    const wrap = $('#bubble-wrap');
    wrap.innerHTML = '';
    for (let i = 0; i < 42; i++) {
      const b = UI.node('button', 'bubble');
      b.addEventListener('click', () => {
        if (b.classList.contains('popped')) return;
        b.classList.add('popped');
        Sound.sfx('pop');
        FX.vibrate(8);
        if ($$('#bubble-wrap .bubble:not(.popped)').length === 0) {
          setTimeout(() => { buildBubbles(); UI.toast('Новый лист 🫧', 'default'); }, 600);
        }
      });
      wrap.appendChild(b);
    }
  }

  /* ================= ДЫХАНИЕ ================= */
  function breathingData() { return Data.BREATHING.find((b) => b.id === breathing.technique) || Data.BREATHING[0]; }

  function toggleBreathing() {
    breathing.active = !breathing.active;
    const btn = $('#breathing-toggle');
    const circle = $('#breathing-circle');
    if (breathing.active) {
      btn.textContent = 'Остановить';
      breathing.cycles = 0;
      Sound.ready();
      runBreathPhase(0);
    } else {
      btn.textContent = 'Начать';
      clearTimeout(breathing.timer);
      circle.style.transform = '';
      circle.style.transitionDuration = '0.6s';
      $('#breathing-label').textContent = 'Дыши';
      $('#breathing-count').textContent = '';
      if (breathing.cycles >= 1) {
        State.s.totals.breathingSessions += 1;
        State.addXP(12, 'health');
        State.addCoins(8);
        State.bumpQuest('breathing', 1);
        UI.toast(`Дыхательная пауза: ${breathing.cycles} циклов`, 'success', '🌬️');
        State.commit();
      }
    }
  }

  function runBreathPhase(i) {
    if (!breathing.active) return;
    const tech = breathingData();
    const [label, seconds] = tech.phases[i];
    const circle = $('#breathing-circle');
    $('#breathing-label').textContent = label;
    circle.style.transitionDuration = seconds + 's';
    if (label === 'Вдох') circle.style.transform = 'scale(1.45)';
    else if (label === 'Выдох') circle.style.transform = 'scale(0.72)';
    Sound.sfx('tick');

    let left = seconds;
    $('#breathing-count').textContent = left;
    const counter = setInterval(() => {
      left -= 1;
      $('#breathing-count').textContent = Math.max(0, left);
      if (left <= 0) clearInterval(counter);
    }, 1000);

    breathing.timer = setTimeout(() => {
      clearInterval(counter);
      const next = (i + 1) % tech.phases.length;
      if (next === 0) {
        breathing.cycles += 1;
        UI.$('#breathing-count').textContent = '';
      }
      runBreathPhase(next);
    }, seconds * 1000);
  }

  /* ================= СВЯЗЫВАНИЕ ================= */
  function setTask(id) {
    T.taskId = id;
    const sel = $('#timer-task');
    if (sel) sel.value = id || '';
  }

  function renderTaskSelect() {
    const sel = $('#timer-task');
    const active = State.s.tasks.filter((t) => !t.done);
    const cur = T.taskId || sel.value;
    sel.innerHTML = `<option value="">— без конкретной задачи —</option>` +
      active.map((t) => `<option value="${t.id}">${UI.esc(t.title.length > 42 ? t.title.slice(0, 41) + '…' : t.title)}</option>`).join('');
    if (cur && active.some((t) => t.id === cur)) sel.value = cur;
  }

  function bind() {
    Screens.helpers.fillSelect($('#timer-mode'), Data.TIMER_MODES.map((m) => ({
      value: m.id, label: m.focus ? `${m.name} · ${m.focus}/${m.break}` : `${m.name} · счёт вверх`,
    })), 'pomodoro');
    $('#timer-mode').addEventListener('change', (e) => setMode(e.target.value));
    $('#timer-mode').title = modeData().desc;

    $('#timer-start').addEventListener('click', start);
    $('#timer-pause').addEventListener('click', () => {
      const m = modeData();
      if (m.focus === 0 && T.phase === 'focus' && T.elapsed > 0) stopFlow();
      else pause();
    });
    $('#timer-reset').addEventListener('click', reset);
    $('#timer-task').addEventListener('change', (e) => { T.taskId = e.target.value || null; });

    $('#hyperfocus-btn').addEventListener('click', enterHyperfocus);
    const hud = $('#focus-hud');
    if (hud) hud.addEventListener('click', () => { App.go('adhd'); Sound.sfx('click'); });
    $('#hf-exit').addEventListener('click', exitHyperfocus);
    $('#hf-toggle').addEventListener('click', () => { T.running ? pause() : start(); renderHyperfocus(); });
    $('#hf-done').addEventListener('click', () => { finishEarly(); exitHyperfocus(); });
    $('#hf-music-toggle').addEventListener('click', () => { Music.toggle(State.s.music.station); Screens.music.render(); renderHyperfocus(); });
    $('#hf-music-next').addEventListener('click', () => {
      Music.reseed();
      if (!Music.playing) Music.play(State.s.music.station);
      Screens.music.render();
      renderHyperfocus();
    });

    $('#dump-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('#dump-input');
      const text = inp.value.trim();
      if (!text) return;
      State.s.brainDump.unshift({ id: State.uid(), text, createdAt: Date.now() });
      State.s.brainDump = State.s.brainDump.slice(0, 60);
      State.s.totals.dumpCount += 1;
      State.addXP(3, 'mind');
      State.bumpQuest('dump', 1);
      inp.value = '';
      Sound.sfx('pop');
      State.commit();
    });

    $('#roulette-spin').addEventListener('click', spin);

    Screens.helpers.fillSelect($('#breakdown-template'), Data.BREAKDOWN_TEMPLATES.map((t) => ({ value: t.id, label: `${t.emoji} ${t.name}` })), 'generic');
    $('#breakdown-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('#breakdown-title');
      const title = inp.value.trim();
      if (!title) return;
      const tpl = Data.BREAKDOWN_TEMPLATES.find((t) => t.id === $('#breakdown-template').value) || Data.BREAKDOWN_TEMPLATES[0];
      State.s.breakdowns.unshift({
        id: State.uid(), title, completed: false,
        steps: tpl.steps.map((text) => ({ id: State.uid(), text, done: false })),
      });
      inp.value = '';
      Sound.sfx('click');
      UI.toast('Разбито на шаги. Начни с первого 🐘', 'success', '🐘');
      State.commit();
    });

    $('#distraction-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('#distraction-input');
      const text = inp.value.trim();
      if (!text) return;
      State.s.distractions.unshift({ id: State.uid(), text, time: Date.now() });
      State.s.distractions = State.s.distractions.slice(0, 60);
      State.s.totals.distractionCount += 1;
      State.addXP(2, 'mind');
      inp.value = '';
      Sound.sfx('whoosh');
      UI.toast('Мысль записана. Возвращайся к делу 🍃', 'default');
      State.commit();
    });

    $('#bubble-reset').addEventListener('click', () => { buildBubbles(); Sound.sfx('click'); });

    Screens.helpers.fillSelect($('#breathing-technique'), Data.BREATHING.map((b) => ({ value: b.id, label: b.name })), 'calm');
    $('#breathing-technique').addEventListener('change', (e) => {
      breathing.technique = e.target.value;
      if (breathing.active) { toggleBreathing(); toggleBreathing(); }
    });
    $('#breathing-toggle').addEventListener('click', toggleBreathing);

    buildBubbles();
    setMode('pomodoro');
    if (State.s.masterVolume != null) Sound.setMasterVolume(State.s.masterVolume);
  }

  function render() {
    renderTimer();
    renderTaskSelect();
    renderMixer();
    renderDump();
    renderRoulette();
    renderBreakdowns();
    renderDistractions();
    Screens.music.render();
    Screens.reminders.render();
  }

  function onEnter() { startVisualizer(); renderHud(); }
  function onLeave() { stopVisualizer(); renderHud(); }

  return {
    bind, render, onEnter, onLeave, setTask, enterHyperfocus, renderHud, finishEarly,
    startIfIdle: () => { if (!T.running) start(); },
    toggleTimer: () => (T.running ? pause() : start()),
    get running() { return T.running; },
  };
})();
