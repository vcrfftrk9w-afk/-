'use strict';
/* =========================================================
   APP — инициализация, роутинг, шапка, события
   ========================================================= */

const App = (() => {
  const { $, $$ } = UI;
  let currentTab = 'dashboard';
  let passiveTicks = 0;
  let pendingLevelUp = null;

  /* ---------- применение настроек ---------- */
  function applyTheme() {
    document.body.setAttribute('data-theme', State.s.theme);
    const btn = $('#theme-toggle');
    if (btn) btn.textContent = State.s.theme === 'dark' ? '🌙' : '☀️';
  }
  function applyPalette() { document.body.setAttribute('data-palette', State.s.palette || 'violet'); }
  function applyMode() {
    document.body.setAttribute('data-mode', State.s.mode);
    const label = $('#mode-label');
    if (label) label.textContent = State.s.mode === 'adhd' ? 'СДВГ' : 'Обычный';
    const toggle = $('#mode-toggle');
    if (toggle) toggle.setAttribute('aria-pressed', String(State.s.mode === 'adhd'));
  }
  function applyMotion() { document.body.setAttribute('data-reduce-motion', String(!!State.s.reduceMotion)); }
  function applyAll() { applyTheme(); applyPalette(); applyMode(); applyMotion(); }

  /* ---------- шапка ---------- */
  function renderHeader() {
    const s = State.s;
    const stage = State.stage();
    $('#avatar-emoji').textContent = stage.emoji;
    $('#user-title').textContent = stage.title;
    $('#user-name').textContent = s.name || 'Гость';
    $('#stat-level').textContent = s.level;
    const need = State.xpToNext(s.level);
    $('#stat-xp').textContent = `${s.xp}/${need}`;
    $('#xp-fill').style.width = Math.min(100, (s.xp / need) * 100) + '%';
    UI.countUp($('#stat-coins'), s.coins, { short: s.coins >= 100000 });
    UI.countUp($('#stat-streak'), s.streak);
    const passive = State.passivePerMin() * State.activityMultiplier();
    $('#stat-passive').textContent = UI.fmtSmart(passive);
    $('#passive-pill').classList.toggle('hidden', State.passivePerMin() <= 0);
    renderBooster();
  }

  function renderBooster() {
    const s = State.s;
    const now = Date.now();
    const until = Math.max(s.boosters.xpUntil || 0, s.boosters.coinUntil || 0);
    const badge = $('#booster-badge');
    if (until > now) {
      const left = Math.round((until - now) / 1000);
      const m = Math.floor(left / 60), sec = left % 60;
      $('#booster-time').textContent = `${m}:${sec < 10 ? '0' + sec : sec}`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  /* ---------- роутинг ---------- */
  const screenByTab = {
    dashboard: () => Screens.dashboard,
    tasks: () => Screens.tasks,
    adhd: () => Screens.focus,
    habits: () => Screens.habits,
    goals: () => Screens.goals,
    lessons: () => Screens.lessons,
    empire: () => Screens.empire,
    rewards: () => Screens.rewards,
    stats: () => Screens.stats,
  };

  function go(tab) {
    if (!screenByTab[tab]) return;
    if (currentTab === 'adhd' && tab !== 'adhd') Screens.focus.onLeave();
    currentTab = tab;
    $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.tab-panel').forEach((p) => {
      const active = p.id === `tab-${tab}`;
      p.classList.toggle('active', active);
      if (active) {
        p.classList.remove('anim-in');
        void p.offsetWidth;
        p.classList.add('anim-in');
      }
    });
    renderActive();
    if (tab === 'adhd') Screens.focus.onEnter();
    UI.initTilt();
    const btn = $$('.tab-btn').find((b) => b.dataset.tab === tab);
    if (btn && btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: State.s.reduceMotion ? 'auto' : 'smooth' });
  }

  function renderActive() {
    UI.preserveFocus(() => {
      renderHeader();
      const screen = screenByTab[currentTab] && screenByTab[currentTab]();
      if (screen && screen.render) screen.render();
    });
  }

  /* ---------- события состояния ---------- */
  function bindStateEvents() {
    State.on('change', () => renderActive());

    State.on('levelup', (info) => { pendingLevelUp = info; });

    State.on('achievement', (a) => {
      UI.toast(`Достижение: ${a.name}`, 'level', a.emoji);
      Sound.sfx('quest');
      FX.confetti(window.innerWidth / 2, 120, 50, { power: 8 });
    });

    State.on('quest', (q) => {
      UI.toast(`Квест выполнен: ${q.text}`, 'level', '📜');
      Sound.sfx('quest');
      FX.coinRain(14);
    });

    State.on('millionaire', () => {
      UI.openModal('#millionaire-modal');
      Sound.sfx('fanfare');
      FX.fireworks(10);
      FX.coinRain(80);
    });

    State.on('streakSaved', () => {
      UI.toast('Стрик спасён бустером 🛟', 'level', '🔥');
    });
  }

  function showLevelUp(info) {
    const stage = State.stage();
    $('#levelup-emoji').textContent = stage.emoji;
    $('#levelup-heading').textContent = info.newStage ? 'Эволюция!' : 'Новый уровень!';
    $('#levelup-title').textContent = stage.title;
    $('#levelup-desc').textContent = info.newStage ? stage.desc : `Уровень ${info.to}. Продолжай в том же духе.`;
    $('#levelup-rewards').innerHTML = `
      <div class="lv-reward"><b>${info.to}</b><small>уровень</small></div>
      <div class="lv-reward"><b>+${info.to * 15}</b><small>монет</small></div>
      ${info.newStage ? '<div class="lv-reward"><b>NEW</b><small>образ</small></div>' : ''}`;
    UI.openModal('#levelup-modal');
    Sound.sfx('levelup');
    FX.fireworks(info.newStage ? 5 : 3);
    FX.vibrate([40, 60, 40, 60, 80]);
  }

  /* ---------- тики ---------- */
  function startTicks() {
    // пассивный доход
    setInterval(() => {
      const earned = State.tickPassive();
      passiveTicks += 1;
      if (earned > 0) {
        renderHeader();
        if (currentTab === 'empire') Screens.empire.render();
      }
      if (passiveTicks % 6 === 0) { State.checkAchievements(); State.save(); }
    }, 5000);

    // бустеры
    setInterval(renderBooster, 1000);

    // отложенная модалка уровня (чтобы не перекрывать конфетти действия)
    setInterval(() => {
      if (pendingLevelUp && $$('.modal:not(.hidden)').length === 0) {
        const info = pendingLevelUp;
        pendingLevelUp = null;
        showLevelUp(info);
      }
    }, 900);

    // смена дня
    setInterval(() => {
      if (State.s.lastSeenDate && State.s.lastSeenDate !== State.todayKey()) dailyCheckIn();
    }, 60000);
  }

  /* ---------- ежедневный вход ---------- */
  function dailyCheckIn() {
    const today = State.todayKey();
    if (State.s.lastSeenDate === today) return;
    const first = !State.s.lastSeenDate;
    State.s.lastSeenDate = today;
    State.ensureQuests();
    if (!first) {
      const bonus = 15 + State.s.streak * 5;
      State.addCoins(bonus);
      UI.toast(`С возвращением! +${bonus} монет за вход`, 'coin', '🎁');
      FX.coinRain(22);
      Sound.sfx('coin');
    }
    State.commit();
  }

  /* ---------- горячие клавиши ---------- */
  function bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select')) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      const tabs = ['dashboard', 'tasks', 'adhd', 'habits', 'goals', 'lessons', 'empire', 'rewards', 'stats'];
      if (e.key >= '1' && e.key <= '9') { go(tabs[Number(e.key) - 1]); return; }
      const k = e.key.toLowerCase();
      if (k === 'n' || k === 'т') { go('tasks'); setTimeout(() => $('#task-title').focus(), 120); }
      else if (k === 'f' || k === 'а') { Screens.focus.toggleTimer(); }
      else if (k === 'h' || k === 'р') { Screens.focus.enterHyperfocus(); }
      else if (e.key === 'Escape') {
        if (!$('#hyperfocus').classList.contains('hidden')) $('#hf-exit').click();
        $$('.modal:not(.hidden)').forEach((m) => UI.closeModal(m));
      }
    });
  }

  /* ---------- онбординг ---------- */
  function bindOnboarding() {
    let step = 0;
    let mode = 'adhd';
    const steps = $$('.ob-step');
    const dots = $$('.onboarding-steps i');

    function show(n) {
      step = Math.max(0, Math.min(steps.length - 1, n));
      steps.forEach((s, i) => s.classList.toggle('active', i === step));
      dots.forEach((d, i) => d.classList.toggle('active', i <= step));
    }

    $$('[data-ob-next]').forEach((b) => b.addEventListener('click', () => { show(step + 1); Sound.sfx('click'); }));
    $$('[data-ob-prev]').forEach((b) => b.addEventListener('click', () => { show(step - 1); Sound.sfx('click'); }));

    $$('.ob-mode').forEach((b) => b.addEventListener('click', () => {
      mode = b.dataset.mode;
      $$('.ob-mode').forEach((x) => x.classList.toggle('selected', x === b));
      Sound.sfx('pop');
    }));

    $('#ob-start').addEventListener('click', () => {
      const s = State.s;
      s.name = $('#ob-name').value.trim();
      s.mode = mode;
      s.onboarded = true;
      const goal = $('#ob-goal').value.trim();
      const task = $('#ob-task').value.trim();
      if (goal) Screens.goals.add(goal, '🎯', null);
      if (task) Screens.tasks.add(task, 'other', 'mid', false);
      applyAll();
      $('#onboarding').classList.add('hidden');
      $('#app').classList.remove('hidden');
      dailyCheckIn();
      go('dashboard');
      Sound.ready();
      Sound.sfx('fanfare');
      FX.fireworks(3);
      UI.toast('Погнали! Твой путь начался 🚀', 'level', '🦥');
      State.commit();
    });
  }

  /* ---------- настройки ---------- */
  function bindSettings() {
    $('#settings-btn').addEventListener('click', () => {
      const s = State.s;
      $('#setting-name').value = s.name || '';
      $('#setting-theme').checked = s.theme === 'light';
      $('#setting-adhd').checked = s.mode === 'adhd';
      $('#setting-sfx').checked = !!s.sfx;
      $('#setting-haptics').checked = !!s.haptics;
      $('#setting-reduce').checked = !!s.reduceMotion;
      $('#setting-notify').checked = !!s.notifications;
      UI.openModal('#settings-modal');
    });
    $('#settings-close').addEventListener('click', () => UI.closeModal('#settings-modal'));

    $('#setting-name').addEventListener('input', (e) => { State.s.name = e.target.value.trim(); renderHeader(); State.save(); });
    $('#setting-theme').addEventListener('change', (e) => { State.s.theme = e.target.checked ? 'light' : 'dark'; applyTheme(); State.save(); });
    $('#setting-adhd').addEventListener('change', (e) => { State.s.mode = e.target.checked ? 'adhd' : 'normal'; applyMode(); State.save(); });
    $('#setting-sfx').addEventListener('change', (e) => { State.s.sfx = e.target.checked; State.save(); });
    $('#setting-haptics').addEventListener('change', (e) => { State.s.haptics = e.target.checked; State.save(); });
    $('#setting-reduce').addEventListener('change', (e) => { State.s.reduceMotion = e.target.checked; applyMotion(); State.save(); });
    $('#setting-notify').addEventListener('change', (e) => {
      State.s.notifications = e.target.checked;
      if (e.target.checked && 'Notification' in window && Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch (err) {}
      }
      State.save();
    });

    $('#theme-toggle').addEventListener('click', () => {
      State.s.theme = State.s.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      Sound.sfx('click');
      State.save();
    });

    $('#mode-toggle').addEventListener('click', () => {
      State.s.mode = State.s.mode === 'adhd' ? 'normal' : 'adhd';
      applyMode();
      Sound.sfx('pop');
      UI.toast(State.s.mode === 'adhd' ? 'СДВГ-режим включён ⚡' : 'Обычный режим 🧘', 'default');
      State.save();
    });

    $('#brand-btn').addEventListener('click', showCharacter);

    $$('[data-close-sheet]').forEach((b) => b.addEventListener('click', () => UI.closeModal('#sheet-modal')));
    $('#levelup-close').addEventListener('click', () => UI.closeModal('#levelup-modal'));
    $('#millionaire-close').addEventListener('click', () => UI.closeModal('#millionaire-modal'));
    $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) UI.closeModal(m); }));
  }

  function showCharacter() {
    const s = State.s;
    const stage = State.stage();
    const next = State.nextStage();
    Sound.sfx('click');
    UI.sheet(`
      <div class="char-sheet">
        <div class="char-avatar">${stage.emoji}</div>
        <h2>${UI.esc(stage.title)}</h2>
        <p class="muted">${UI.esc(stage.desc)}</p>
        <div class="char-stats">
          <div><b>${s.level}</b><small>уровень</small></div>
          <div><b>${UI.fmtShort(s.totals.xpEarned)}</b><small>всего XP</small></div>
          <div><b>${UI.fmtShort(State.netWorth())}</b><small>капитал</small></div>
          <div><b>${s.bestStreak}</b><small>рекорд серии</small></div>
        </div>
        ${next ? `<p class="char-next">Следующая форма: <b>${next.emoji} ${UI.esc(next.title)}</b> на ${next.level} уровне</p>` : '<p class="char-next">Ты достиг финальной формы 💎</p>'}
        <div class="char-evolution">${Data.EVOLUTION.map((e) => `
          <div class="char-evo${s.level >= e.level ? ' reached' : ''}">
            <span>${s.level >= e.level ? e.emoji : '❔'}</span>
            <small>${e.level}</small>
          </div>`).join('')}</div>
      </div>`, { wide: true });
  }

  /* ---------- первый жест: восстановить звук ---------- */
  function bindFirstGesture() {
    const restore = () => {
      Sound.ready();
      if (State.s.masterVolume != null) Sound.setMasterVolume(State.s.masterVolume);
      if (State.s.soundMix && Object.keys(State.s.soundMix).length) Sound.applyMix(State.s.soundMix);
      document.removeEventListener('pointerdown', restore);
      document.removeEventListener('keydown', restore);
    };
    document.addEventListener('pointerdown', restore);
    document.addEventListener('keydown', restore);
  }

  /* ---------- запуск ---------- */
  function init() {
    State.load();
    applyAll();

    FX.initBackground($('#bg-canvas'));
    FX.initConfetti($('#confetti-canvas'));
    UI.initRipple();

    bindStateEvents();
    bindOnboarding();
    bindSettings();
    bindKeys();
    bindFirstGesture();

    Screens.dashboard.bind();
    Screens.tasks.bind();
    Screens.habits.bind();
    Screens.goals.bind();
    Screens.focus.bind();
    Screens.rewards.bind();
    Screens.stats.bind();

    $$('.tab-btn').forEach((b) => b.addEventListener('click', () => { go(b.dataset.tab); Sound.sfx('click'); }));

    State.tickPassive();
    startTicks();

    setTimeout(() => {
      const loader = $('#loader');
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.classList.add('hidden');
        if (State.s.onboarded) {
          $('#app').classList.remove('hidden');
          dailyCheckIn();
          go('dashboard');
          UI.initTilt();
        } else {
          $('#onboarding').classList.remove('hidden');
        }
      }, 450);
    }, 850);
  }

  return { init, go, applyAll, applyPalette, renderHeader, renderActive, focusTask: null };
})();

document.addEventListener('DOMContentLoaded', App.init);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
