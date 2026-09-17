'use strict';
/* =========================================================
   ИЗ ЛЕНИВЦА В МИЛЛИОНЕРЫ — логика приложения
   Полностью офлайн: без бэкенда и внешних API.
   ========================================================= */

/* ---------------------------- УТИЛИТЫ ---------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function dateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function todayKey() { return dateKey(new Date()); }
function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateKey(d);
}
function isYesterday(key) { return key === daysAgoKey(1); }

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/* ---------------------------- КОНСТАНТЫ ---------------------------- */

const PRIORITY_XP = { low: 10, mid: 20, high: 35, boss: 60 };
const PRIORITY_LABEL = { low: 'Легко', mid: 'Средне', high: 'Важно', boss: 'Босс-задача' };
const CATEGORY_LABEL = { work: '💼 Работа', study: '📚 Учёба', health: '💪 Здоровье', home: '🏡 Дом', money: '💰 Деньги', other: '✨ Другое' };

const EVOLUTION = [
  { level: 1, emoji: '🦥', title: 'Ленивец' },
  { level: 3, emoji: '🐢', title: 'Стажёр' },
  { level: 5, emoji: '🐇', title: 'Специалист' },
  { level: 8, emoji: '🦊', title: 'Профи' },
  { level: 12, emoji: '🦁', title: 'Лидер' },
  { level: 16, emoji: '🚀', title: 'Предприниматель' },
  { level: 20, emoji: '👑', title: 'Магнат' },
  { level: 25, emoji: '💎', title: 'Миллионер' },
];

const QUOTES = [
  'Маленький шаг сегодня — большой прыжок для будущего тебя.',
  'Не обязательно быть быстрым. Обязательно не останавливаться.',
  'Ленивец тоже добирается до цели — просто без спешки и стыда.',
  'Мотивация приходит после действия, а не до него.',
  'Сделай 2 минуты — мозг сам захочет продолжить.',
  'Прогресс важнее совершенства.',
  'Ты не обязан хотеть — достаточно начать.',
  'Каждая выполненная задача — кирпичик в твоей империи.',
  'СДВГ — это другой мозг, а не сломанный.',
  'Отдых — тоже часть продуктивности.',
  'Сравнивай себя только с собой вчерашним.',
  'Единственная привычка, которую нужно выработать — начинать заново.',
  'Деньги любят тех, кто доводит дело до конца.',
  'Дисциплина — это когда цель важнее настроения.',
  'Ты уже не тот ленивец, что был вчера.',
  'Фокус — это не про идеальную тишину, а про возвращение к делу снова и снова.',
  'Маленькие деньги + время = большие деньги.',
  'Не жди вдохновения — создай его действием.',
  'Тайм-менеджмент начинается с одной галочки.',
  'Миллионеры тоже когда-то не хотели вставать с дивана.',
];

const MICRO_STEPS = [
  'Открой документ/приложение и просто посмотри на него 2 минуты.',
  'Напиши только заголовок или первую строчку.',
  'Поставь таймер на 5 минут и делай что угодно по задаче.',
  'Убери с рабочего стола 3 отвлекающих предмета.',
  'Напиши список из 3 маленьких шагов на бумаге.',
  'Сделай один звонок / отправь одно сообщение по теме.',
  'Налей воды, сядь ровно и скажи вслух: "Начинаю".',
  'Открой 1 вкладку, которая нужна для задачи, остальные закрой.',
  'Сделай самый неприятный микро-кусок первым — потом станет легче.',
  'Запиши голосом на телефон, что нужно сделать — как будто объясняешь другу.',
  'Сделай 10 глубоких вдохов и начни с самого простого действия.',
  'Поставь любимую музыку и дай себе 5 минут "для разгона".',
  'Раздели задачу на 2 части и займись только первой.',
  'Скажи себе: "Просто черновик, не идеально" — и начни.',
  'Встань, потянись 20 секунд, затем сразу садись и делай первый шаг.',
];

const COMPANION_MSGS = [
  'Ты справляешься лучше, чем думаешь 💪',
  'Ещё немного — и дофамин уже близко ✨',
  'Мозг работает, просто дай ему время 🧠',
  'Один вдох. Один шаг. Ты в потоке.',
  'Не идеально — и это нормально.',
  'Ты уже начал(а). Это самое сложное позади.',
  'Маленькие победы = большие деньги в будущем 💰',
  'Дыши. Фокусируйся. Ты справляешься.',
  'Отвлёкся? Просто мягко возвращайся.',
  'Через это уже прошли тысячи людей с СДВГ — и ты пройдёшь.',
];

const ACHIEVEMENTS = [
  { id: 'first_task', emoji: '🎯', name: 'Первый шаг', desc: 'Выполни первую задачу', xp: 10, coins: 5, cond: (s) => s.totals.tasksCompleted >= 1 },
  { id: 'tasks_10', emoji: '🗂️', name: 'Разгон', desc: 'Выполни 10 задач', xp: 30, coins: 15, cond: (s) => s.totals.tasksCompleted >= 10 },
  { id: 'tasks_50', emoji: '🧗', name: 'Марафонец', desc: 'Выполни 50 задач', xp: 60, coins: 30, cond: (s) => s.totals.tasksCompleted >= 50 },
  { id: 'tasks_100', emoji: '🏔️', name: 'Сотня', desc: 'Выполни 100 задач', xp: 120, coins: 60, cond: (s) => s.totals.tasksCompleted >= 100 },
  { id: 'streak_3', emoji: '🔥', name: 'Разгорелось', desc: 'Стрик 3 дня подряд', xp: 20, coins: 10, cond: (s) => s.streak >= 3 },
  { id: 'streak_7', emoji: '🔥🔥', name: 'Неделя силы', desc: 'Стрик 7 дней подряд', xp: 40, coins: 20, cond: (s) => s.streak >= 7 },
  { id: 'streak_30', emoji: '🔥🔥🔥', name: 'Железная воля', desc: 'Стрик 30 дней подряд', xp: 150, coins: 80, cond: (s) => s.streak >= 30 },
  { id: 'focus_60', emoji: '🎧', name: 'В потоке', desc: '60 минут фокуса суммарно', xp: 25, coins: 12, cond: (s) => s.totals.focusMinutes >= 60 },
  { id: 'focus_300', emoji: '🧠', name: 'Мастер концентрации', desc: '300 минут фокуса суммарно', xp: 80, coins: 40, cond: (s) => s.totals.focusMinutes >= 300 },
  { id: 'focus_sessions_10', emoji: '⏱️', name: 'Таймер — друг', desc: '10 завершённых фокус-сессий', xp: 35, coins: 18, cond: (s) => s.totals.focusSessions >= 10 },
  { id: 'habit_first', emoji: '🌱', name: 'Росток', desc: 'Создай первую привычку', xp: 10, coins: 5, cond: (s) => s.habits.length >= 1 },
  { id: 'habit_21', emoji: '🌳', name: 'Привычка на всю жизнь', desc: '21 день одной привычки подряд', xp: 100, coins: 50, cond: (s) => s.habits.some((h) => habitStreak(h) >= 21) },
  { id: 'coins_1000', emoji: '💰', name: 'Первая тысяча', desc: 'Заработай 1000 монет', xp: 60, coins: 0, cond: (s) => s.totals.coinsEarned >= 1000 },
  { id: 'level_10', emoji: '⭐', name: 'Растущая звезда', desc: 'Достигни 10 уровня', xp: 0, coins: 50, cond: (s) => s.level >= 10 },
  { id: 'level_20', emoji: '👑', name: 'Магнат', desc: 'Достигни 20 уровня', xp: 0, coins: 150, cond: (s) => s.level >= 20 },
  { id: 'breakdown_5', emoji: '🐘', name: 'Охотник на слонов', desc: 'Раздроби 5 больших задач на шаги', xp: 30, coins: 15, cond: (s) => s.totals.breakdownsUsed >= 5 },
  { id: 'breathing_5', emoji: '🌬️', name: 'Дзен', desc: '5 дыхательных сессий', xp: 20, coins: 10, cond: (s) => s.totals.breathingSessions >= 5 },
  { id: 'reward_first', emoji: '🎁', name: 'Заслужил', desc: 'Купи первую награду', xp: 10, coins: 0, cond: (s) => s.totals.rewardsBought >= 1 },
];

/* ---------------------------- СОСТОЯНИЕ ---------------------------- */

const STORAGE_KEY = 'ldm_state_v1';

function defaultState() {
  return {
    onboarded: false,
    name: '',
    mode: 'normal',
    theme: 'dark',
    reduceMotion: false,
    sfx: true,
    soundVolume: 40,
    level: 1,
    xp: 0,
    coins: 0,
    streak: 0,
    bestStreak: 0,
    lastActiveDate: null,
    tasks: [],
    habits: [],
    breakdowns: [],
    distractions: [],
    rewards: [
      { id: uid(), title: 'Любимый сериал (1 серия)', cost: 40 },
      { id: uid(), title: 'Вкусный перекус', cost: 20 },
      { id: uid(), title: 'Час игр', cost: 60 },
    ],
    achievements: {},
    totals: {
      tasksCompleted: 0,
      focusMinutes: 0,
      focusSessions: 0,
      coinsEarned: 0,
      xpEarned: 0,
      breakdownsUsed: 0,
      breathingSessions: 0,
      rewardsBought: 0,
    },
    dailyTaskCounts: {},
    dailyFocusMinutes: {},
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return deepMerge(base, parsed);
  } catch (e) {
    console.warn('Не удалось загрузить состояние', e);
    return defaultState();
  }
}

function deepMerge(base, patch) {
  const out = { ...base };
  for (const key of Object.keys(patch || {})) {
    if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key]) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      out[key] = deepMerge(base[key], patch[key]);
    } else {
      out[key] = patch[key];
    }
  }
  return out;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Не удалось сохранить состояние', e);
  }
}

function commit() {
  checkAchievements();
  saveState();
  renderAll();
}

/* ---------------------------- ГЕЙМИФИКАЦИЯ ---------------------------- */

function xpToNext(level) { return 80 + (level - 1) * 40; }

function getStage(level) {
  let stage = EVOLUTION[0];
  for (const s of EVOLUTION) if (level >= s.level) stage = s;
  return stage;
}

function addXP(amount) {
  if (amount <= 0) return;
  state.totals.xpEarned += amount;
  state.xp += amount;
  let leveledUp = false;
  let need = xpToNext(state.level);
  while (state.xp >= need) {
    state.xp -= need;
    state.level += 1;
    const bonus = state.level * 10;
    state.coins += bonus;
    state.totals.coinsEarned += bonus;
    leveledUp = true;
    need = xpToNext(state.level);
  }
  if (leveledUp) queueLevelUp();
}

function addCoins(amount) {
  if (amount <= 0) return;
  state.coins += amount;
  state.totals.coinsEarned += amount;
}

function spendCoins(amount) {
  if (state.coins < amount) {
    toast('Недостаточно монет 🪙', 'warn');
    playSfx('deny');
    return false;
  }
  state.coins -= amount;
  return true;
}

function registerActivityToday() {
  const today = todayKey();
  if (state.lastActiveDate === today) return;
  if (state.lastActiveDate && isYesterday(state.lastActiveDate)) {
    state.streak += 1;
  } else {
    state.streak = 1;
  }
  state.lastActiveDate = today;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
}

function habitStreak(habit) {
  let streak = 0;
  let cursor = 0;
  if (!habit.history[todayKey()]) cursor = 1;
  while (habit.history[daysAgoKey(cursor)]) {
    streak += 1;
    cursor += 1;
  }
  return streak;
}

let pendingLevelUp = false;
function queueLevelUp() { pendingLevelUp = true; }

function checkAchievements() {
  let unlockedAny = false;
  for (const a of ACHIEVEMENTS) {
    const rec = state.achievements[a.id];
    if (rec && rec.unlocked) continue;
    if (a.cond(state)) {
      state.achievements[a.id] = { unlocked: true, unlockedAt: Date.now() };
      if (a.xp) addXP(a.xp);
      if (a.coins) addCoins(a.coins);
      toast(`${a.emoji} Достижение: ${a.name}`, 'level');
      unlockedAny = true;
    }
  }
  return unlockedAny;
}

/* ---------------------------- ЗВУК (Web Audio) ---------------------------- */

const AudioEngine = (() => {
  let ctx = null;
  let master = null;
  let analyser = null;
  let sfxGain = null;
  let nodes = [];
  let currentType = 'off';

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.35;
      master.connect(analyser);
      analyser.connect(ctx.destination);
      sfxGain.connect(ctx.destination);
      setVolume(state.soundVolume);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function setVolume(v) {
    if (master) master.gain.value = (v / 100) * 0.55;
  }

  function noiseBuffer(brown) {
    const seconds = 3;
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * white) / 1.02; data[i] = last * 3.2; }
      else data[i] = white;
    }
    return buffer;
  }

  function stopAmbient() {
    nodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
    nodes = [];
    currentType = 'off';
  }

  function playAmbient(type) {
    if (!ensureCtx()) return;
    stopAmbient();
    if (type === 'off') return;
    currentType = type;

    if (type === 'white' || type === 'brown') {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(type === 'brown');
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = type === 'brown' ? 0.5 : 0.25;
      src.connect(g).connect(master);
      src.start();
      nodes.push(src, g);
    } else if (type === 'rain') {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(false);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2600;
      filter.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.15;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.08;
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();
      src.connect(filter).connect(g).connect(master);
      src.start();
      nodes.push(src, filter, g, lfo, lfoGain);
    } else if (type === 'binaural') {
      const freqs = [200, 210];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) pan.pan.value = i === 0 ? -1 : 1;
        const g = ctx.createGain();
        g.gain.value = 0.18;
        if (pan) osc.connect(pan).connect(g).connect(master);
        else osc.connect(g).connect(master);
        osc.start();
        nodes.push(osc, g);
        if (pan) nodes.push(pan);
      });
    } else if (type === 'lofi') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 110;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 220.5;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 300;
      lfo.connect(lfoGain).connect(filter.frequency);
      const g = ctx.createGain();
      g.gain.value = 0.22;
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(g).connect(master);
      osc.start(); osc2.start(); lfo.start();
      nodes.push(osc, osc2, filter, lfo, lfoGain, g);
    }
  }

  function playSfx(type) {
    if (!state.sfx) return;
    if (!ensureCtx()) return;
    const now = ctx.currentTime;
    const patterns = {
      click: [[440, 0.05, 'sine']],
      check: [[520, 0.06, 'triangle'], [780, 0.08, 'triangle']],
      coin: [[880, 0.05, 'square'], [1320, 0.09, 'square']],
      success: [[523, 0.07, 'triangle'], [659, 0.07, 'triangle'], [784, 0.12, 'triangle']],
      levelup: [[523, 0.09, 'sawtooth'], [659, 0.09, 'sawtooth'], [784, 0.09, 'sawtooth'], [1046, 0.18, 'sawtooth']],
      pop: [[300, 0.04, 'sine']],
      deny: [[160, 0.12, 'sawtooth']],
      whoosh: [[200, 0.15, 'sine']],
    };
    const seq = patterns[type] || patterns.click;
    let t = now;
    seq.forEach(([freq, dur, wave]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(sfxGain);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur * 0.55;
    });
  }

  function getLevels(count) {
    if (!analyser || currentType === 'off') return null;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const step = Math.floor(data.length / count) || 1;
    const out = [];
    for (let i = 0; i < count; i++) out.push(data[i * step] / 255);
    return out;
  }

  return { ensureCtx, setVolume, playAmbient, stopAmbient, playSfx, getLevels, get currentType() { return currentType; } };
})();

function playSfx(type) { AudioEngine.playSfx(type); }

/* ---------------------------- КОНФЕТТИ ---------------------------- */

const confettiCanvas = $('#confetti-canvas');
const cctx = confettiCanvas.getContext('2d');
let confettiParticles = [];
let confettiRunning = false;

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfetti);
resizeConfetti();

function spawnConfetti(x, y, count = 60) {
  if (state.reduceMotion) return;
  const colors = ['#7c3aed', '#06b6d4', '#f59e0b', '#22c55e', '#ef4444', '#ec4899'];
  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x, y,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -10 - 3,
      size: Math.random() * 7 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 22,
      life: 1,
      decay: 0.007 + Math.random() * 0.01,
      shape: Math.random() < 0.5 ? 'rect' : 'circle',
    });
  }
  if (!confettiRunning) runConfetti();
}

function runConfetti() {
  confettiRunning = true;
  cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiParticles.forEach((p) => {
    p.vy += 0.25;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= p.decay;
  });
  confettiParticles = confettiParticles.filter((p) => p.life > 0 && p.y < confettiCanvas.height + 60);
  confettiParticles.forEach((p) => {
    cctx.save();
    cctx.globalAlpha = Math.max(p.life, 0);
    cctx.translate(p.x, p.y);
    cctx.rotate((p.rot * Math.PI) / 180);
    cctx.fillStyle = p.color;
    if (p.shape === 'rect') cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    else { cctx.beginPath(); cctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); cctx.fill(); }
    cctx.restore();
  });
  if (confettiParticles.length > 0) requestAnimationFrame(runConfetti);
  else { confettiRunning = false; cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
}

function burstFromElement(el, count = 50) {
  if (!el) { spawnConfetti(window.innerWidth / 2, window.innerHeight / 3, count); return; }
  const r = el.getBoundingClientRect();
  spawnConfetti(r.left + r.width / 2, r.top + r.height / 2, count);
}

/* ---------------------------- TOASTS ---------------------------- */

function toast(message, type = 'default') {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

/* ---------------------------- BUTTON RIPPLE ---------------------------- */

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  btn.style.setProperty('--rx', `${e.clientX - r.left}px`);
  btn.style.setProperty('--ry', `${e.clientY - r.top}px`);
  btn.classList.remove('rippling');
  void btn.offsetWidth;
  btn.classList.add('rippling');
});

/* ---------------------------- ЗАДАЧИ ---------------------------- */

let taskFilter = 'all';

function addTask(title, category, priority) {
  const xp = PRIORITY_XP[priority] ?? 20;
  state.tasks.unshift({
    id: uid(), title: title.trim(), category, priority, xp,
    done: false, rewarded: false, createdAt: Date.now(), doneAt: null,
  });
  commit();
  toast('Задача добавлена ✅', 'success');
}

function toggleTask(id, sourceEl) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  task.done = !task.done;
  if (task.done) {
    task.doneAt = Date.now();
    if (!task.rewarded) {
      task.rewarded = true;
      addXP(task.xp);
      addCoins(Math.round(task.xp / 2));
      state.totals.tasksCompleted += 1;
      state.dailyTaskCounts[todayKey()] = (state.dailyTaskCounts[todayKey()] || 0) + 1;
      registerActivityToday();
      playSfx('success');
      burstFromElement(sourceEl, 40);
      toast(`+${task.xp} XP · +${Math.round(task.xp / 2)} 🪙`, 'coin');
    } else {
      playSfx('check');
    }
  } else {
    playSfx('click');
  }
  commit();
}

function deleteTask(id, liEl) {
  if (liEl) {
    liEl.classList.add('removing');
    setTimeout(() => {
      state.tasks = state.tasks.filter((t) => t.id !== id);
      commit();
    }, 280);
  } else {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    commit();
  }
}

function renderTaskItem(t) {
  const li = document.createElement('li');
  li.className = `task-item${t.done ? ' done' : ''}`;
  li.dataset.id = t.id;
  li.innerHTML = `
    <button class="task-check" aria-label="Отметить выполненным">✓</button>
    <div class="task-body">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">
        <span>${CATEGORY_LABEL[t.category] || ''}</span>
        <span>${PRIORITY_LABEL[t.priority] || ''}</span>
        <span class="task-xp">+${t.xp} XP</span>
      </div>
    </div>
    <button class="task-del" aria-label="Удалить">🗑️</button>
  `;
  li.querySelector('.task-check').addEventListener('click', () => toggleTask(t.id, li.querySelector('.task-check')));
  li.querySelector('.task-del').addEventListener('click', () => deleteTask(t.id, li));
  return li;
}

function renderTasks() {
  const list = $('#task-list');
  list.innerHTML = '';
  let items = state.tasks;
  if (taskFilter === 'active') items = items.filter((t) => !t.done);
  if (taskFilter === 'done') items = items.filter((t) => t.done);
  items.forEach((t) => list.appendChild(renderTaskItem(t)));
  $('#task-empty').classList.toggle('hidden', items.length > 0);

  const dashList = $('#dash-today-tasks');
  dashList.innerHTML = '';
  const activeTasks = state.tasks.filter((t) => !t.done).slice(0, 5);
  activeTasks.forEach((t) => dashList.appendChild(renderTaskItem(t)));
  $('#dash-empty').classList.toggle('hidden', activeTasks.length > 0);

  $('#stat-today-tasks').textContent = state.dailyTaskCounts[todayKey()] || 0;
}

/* ---------------------------- ПРИВЫЧКИ ---------------------------- */

function addHabit(name, emoji) {
  state.habits.unshift({ id: uid(), name: name.trim(), emoji: emoji.trim() || '✅', history: {}, rewardedDates: {}, createdAt: Date.now() });
  commit();
  toast('Привычка добавлена 🌱', 'success');
}

function toggleHabitDay(habitId, key) {
  const h = state.habits.find((x) => x.id === habitId);
  if (!h) return;
  const wasDone = !!h.history[key];
  h.history[key] = !wasDone;
  if (!wasDone && h.history[key]) {
    if (!h.rewardedDates[key]) {
      h.rewardedDates[key] = true;
      addXP(5);
      addCoins(2);
    }
    if (key === todayKey()) registerActivityToday();
    playSfx('check');
  } else {
    playSfx('click');
  }
  commit();
}

function deleteHabit(id) {
  state.habits = state.habits.filter((h) => h.id !== id);
  commit();
}

function renderHabits() {
  const list = $('#habit-list');
  list.innerHTML = '';
  const days = [6, 5, 4, 3, 2, 1, 0].map((n) => daysAgoKey(n));
  state.habits.forEach((h) => {
    const el = document.createElement('div');
    el.className = 'habit-item';
    const streak = habitStreak(h);
    el.innerHTML = `
      <span class="habit-emoji">${esc(h.emoji)}</span>
      <div class="habit-info">
        <div class="habit-name">${esc(h.name)}</div>
        <div class="habit-streak">🔥 ${streak} дн. подряд</div>
      </div>
      <div class="habit-days">
        ${days.map((key) => {
          const done = !!h.history[key];
          const isToday = key === todayKey();
          const d = new Date(key);
          return `<button class="habit-day${done ? ' done' : ''}${isToday ? ' today' : ''}" data-key="${key}" title="${key}">${WEEKDAYS[d.getDay()]}</button>`;
        }).join('')}
      </div>
      <button class="habit-del" aria-label="Удалить привычку">🗑️</button>
    `;
    el.querySelectorAll('.habit-day').forEach((btn) => {
      btn.addEventListener('click', () => toggleHabitDay(h.id, btn.dataset.key));
    });
    el.querySelector('.habit-del').addEventListener('click', () => deleteHabit(h.id));
    list.appendChild(el);
  });
  $('#habit-empty').classList.toggle('hidden', state.habits.length > 0);

  const doneToday = state.habits.filter((h) => h.history[todayKey()]).length;
  $('#stat-habit-done').textContent = doneToday;
}

/* ---------------------------- РАЗБИВКА ЗАДАЧ (СДВГ) ---------------------------- */

const DEFAULT_STEPS = ['Подготовить всё нужное для задачи', 'Сделать первый маленький кусок (5 минут)', 'Продолжить до половины', 'Доделать и проверить результат'];

function addBreakdown(title) {
  state.breakdowns.unshift({
    id: uid(), title: title.trim(), completed: false,
    steps: DEFAULT_STEPS.map((text) => ({ id: uid(), text, done: false })),
  });
  commit();
}

function toggleStep(breakdownId, stepId) {
  const bd = state.breakdowns.find((b) => b.id === breakdownId);
  if (!bd) return;
  const step = bd.steps.find((s) => s.id === stepId);
  if (!step) return;
  step.done = !step.done;
  playSfx(step.done ? 'check' : 'click');
  const allDone = bd.steps.length > 0 && bd.steps.every((s) => s.done);
  if (allDone && !bd.completed) {
    bd.completed = true;
    addXP(25);
    addCoins(10);
    state.totals.breakdownsUsed += 1;
    registerActivityToday();
    playSfx('success');
    toast('Слон съеден по кусочкам! +25 XP 🐘', 'success');
  }
  commit();
}

function addStepToBreakdown(breakdownId, text) {
  const bd = state.breakdowns.find((b) => b.id === breakdownId);
  if (!bd || !text.trim()) return;
  bd.steps.push({ id: uid(), text: text.trim(), done: false });
  bd.completed = false;
  commit();
}

function deleteBreakdown(id) {
  state.breakdowns = state.breakdowns.filter((b) => b.id !== id);
  commit();
}

function renderBreakdowns() {
  const root = $('#breakdown-list');
  root.innerHTML = '';
  state.breakdowns.forEach((bd) => {
    const doneCount = bd.steps.filter((s) => s.done).length;
    const pct = bd.steps.length ? Math.round((doneCount / bd.steps.length) * 100) : 0;
    const group = document.createElement('div');
    group.className = 'breakdown-group';
    group.innerHTML = `
      <div class="breakdown-group-title">
        <span>${bd.completed ? '✅ ' : '🐘 '}${esc(bd.title)}</span>
        <button class="task-del" aria-label="Удалить">🗑️</button>
      </div>
      <div class="breakdown-progress"><span style="width:${pct}%"></span></div>
      <div class="steps"></div>
      <form class="step-add-form">
        <input type="text" placeholder="Добавить шаг…" maxlength="80">
        <button type="button" class="step-add-btn">+</button>
      </form>
    `;
    const stepsRoot = group.querySelector('.steps');
    bd.steps.forEach((s) => {
      const row = document.createElement('div');
      row.className = `step-row${s.done ? ' done' : ''}`;
      const cbId = `step-${s.id}`;
      row.innerHTML = `<input type="checkbox" id="${cbId}" ${s.done ? 'checked' : ''}><label for="${cbId}">${esc(s.text)}</label>`;
      row.querySelector('input').addEventListener('change', () => toggleStep(bd.id, s.id));
      stepsRoot.appendChild(row);
    });
    group.querySelector('.task-del').addEventListener('click', () => deleteBreakdown(bd.id));
    const form = group.querySelector('.step-add-form');
    const input = form.querySelector('input');
    const submit = () => { addStepToBreakdown(bd.id, input.value); input.value = ''; };
    form.querySelector('.step-add-btn').addEventListener('click', submit);
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    root.appendChild(group);
  });
}

/* ---------------------------- ЖУРНАЛ ОТВЛЕЧЕНИЙ ---------------------------- */

function addDistraction(text) {
  state.distractions.unshift({ id: uid(), text: text.trim(), time: Date.now() });
  state.distractions = state.distractions.slice(0, 50);
  addXP(2);
  commit();
  toast('Мысль отпущена 🍃 Возвращайся к фокусу', 'success');
}

function renderDistractions() {
  const list = $('#distraction-list');
  list.innerHTML = '';
  state.distractions.slice(0, 12).forEach((d) => {
    const li = document.createElement('li');
    const time = new Date(d.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<span>${esc(d.text)}</span><time>${time}</time>`;
    list.appendChild(li);
  });
}

/* ---------------------------- НАГРАДЫ ---------------------------- */

function addReward(title, cost) {
  state.rewards.unshift({ id: uid(), title: title.trim(), cost: Math.max(1, Math.round(cost)) });
  commit();
}

function buyReward(id, btnEl) {
  const reward = state.rewards.find((r) => r.id === id);
  if (!reward) return;
  if (spendCoins(reward.cost)) {
    state.totals.rewardsBought += 1;
    playSfx('coin');
    burstFromElement(btnEl, 35);
    toast(`Награда получена: ${reward.title} 🎉`, 'coin');
    commit();
  }
}

function deleteReward(id) {
  state.rewards = state.rewards.filter((r) => r.id !== id);
  commit();
}

function renderRewards() {
  const list = $('#reward-list');
  list.innerHTML = '';
  state.rewards.forEach((r) => {
    const el = document.createElement('div');
    el.className = 'reward-item';
    el.innerHTML = `
      <div>${esc(r.title)}</div>
      <div class="reward-cost">${r.cost} 🪙</div>
      <button class="btn btn-primary reward-buy">Купить</button>
      <button class="reward-del">Удалить</button>
    `;
    const buyBtn = el.querySelector('.reward-buy');
    buyBtn.addEventListener('click', () => buyReward(r.id, buyBtn));
    el.querySelector('.reward-del').addEventListener('click', () => deleteReward(r.id));
    list.appendChild(el);
  });
}

function renderAchievements() {
  const grid = $('#achievement-grid');
  grid.innerHTML = '';
  ACHIEVEMENTS.forEach((a) => {
    const unlocked = !!(state.achievements[a.id] && state.achievements[a.id].unlocked);
    const el = document.createElement('div');
    el.className = `achievement${unlocked ? ' unlocked' : ''}`;
    el.innerHTML = `
      <span class="achievement-emoji">${a.emoji}</span>
      <div class="achievement-name">${a.name}</div>
      <div class="achievement-desc">${a.desc}</div>
    `;
    grid.appendChild(el);
  });
  $('#stat-achievements').textContent = Object.values(state.achievements).filter((a) => a.unlocked).length;
}

/* ---------------------------- ФОКУС-ТАЙМЕР ---------------------------- */

const RING_CIRCUMFERENCE = 2 * Math.PI * 88;
let timerState = {
  minutes: 25,
  phase: 'focus', // focus | break
  remaining: 25 * 60,
  total: 25 * 60,
  running: false,
  interval: null,
  companionInterval: null,
};

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function renderTimer() {
  $('#timer-time').textContent = formatTime(timerState.remaining);
  $('#timer-phase').textContent = timerState.phase === 'focus' ? 'Фокус' : 'Перерыв';
  const frac = timerState.total > 0 ? timerState.remaining / timerState.total : 0;
  const ring = $('#timer-ring-fg');
  ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * frac);
  ring.classList.toggle('break', timerState.phase === 'break');
  $('#timer-start').disabled = timerState.running;
  $('#timer-pause').disabled = !timerState.running;
}

function setTimerMinutes(min) {
  if (timerState.running) return;
  timerState.minutes = min;
  timerState.phase = 'focus';
  timerState.total = min * 60;
  timerState.remaining = min * 60;
  $$('#timer-presets .chip').forEach((c) => c.classList.toggle('active', Number(c.dataset.min) === min));
  renderTimer();
}

function startTimer() {
  AudioEngine.ensureCtx();
  if (timerState.running) return;
  timerState.running = true;
  setCompanionMessage(timerState.phase === 'focus' ? 'Погнали! Ты справишься 🚀' : 'Перерыв! Разомнись 🧘');
  timerState.interval = setInterval(tickTimer, 1000);
  timerState.companionInterval = setInterval(() => {
    setCompanionMessage(COMPANION_MSGS[Math.floor(Math.random() * COMPANION_MSGS.length)]);
  }, 45000);
  renderTimer();
}

function pauseTimer() {
  timerState.running = false;
  clearInterval(timerState.interval);
  clearInterval(timerState.companionInterval);
  renderTimer();
}

function resetTimer() {
  pauseTimer();
  timerState.phase = 'focus';
  timerState.total = timerState.minutes * 60;
  timerState.remaining = timerState.minutes * 60;
  setCompanionMessage('Готов, когда будешь готов ты 🦥');
  renderTimer();
}

function tickTimer() {
  timerState.remaining -= 1;
  if (timerState.remaining <= 0) {
    if (timerState.phase === 'focus') {
      completeFocusSession();
    } else {
      completeBreak();
    }
  }
  renderTimer();
}

function completeFocusSession() {
  clearInterval(timerState.interval);
  clearInterval(timerState.companionInterval);
  const minutes = timerState.minutes;
  addXP(minutes * 2);
  addCoins(Math.round(minutes / 2));
  state.totals.focusMinutes += minutes;
  state.totals.focusSessions += 1;
  state.dailyFocusMinutes[todayKey()] = (state.dailyFocusMinutes[todayKey()] || 0) + minutes;
  registerActivityToday();
  playSfx('success');
  burstFromElement($('#timer-time'), 70);
  toast(`Фокус-сессия завершена! +${minutes * 2} XP`, 'success');
  commit();

  const breakMinutes = minutes >= 45 ? 15 : 5;
  timerState.phase = 'break';
  timerState.total = breakMinutes * 60;
  timerState.remaining = breakMinutes * 60;
  timerState.running = true;
  setCompanionMessage('Отличная работа! Пора отдохнуть 🌿');
  timerState.interval = setInterval(tickTimer, 1000);
  timerState.companionInterval = setInterval(() => {
    setCompanionMessage(COMPANION_MSGS[Math.floor(Math.random() * COMPANION_MSGS.length)]);
  }, 45000);
}

function completeBreak() {
  pauseTimer();
  timerState.phase = 'focus';
  timerState.total = timerState.minutes * 60;
  timerState.remaining = timerState.minutes * 60;
  playSfx('whoosh');
  toast('Перерыв закончен — готов к новому раунду?', 'success');
  setCompanionMessage('Готов, когда будешь готов ты 🦥');
  renderTimer();
}

function setCompanionMessage(msg) {
  const el = $('#timer-companion');
  el.style.opacity = 0;
  setTimeout(() => { el.textContent = msg; el.style.opacity = 1; }, 180);
}

/* ---------------------------- ВИЗУАЛИЗАТОР ЗВУКА ---------------------------- */

let visualizerRAF = null;
function startVisualizer() {
  if (visualizerRAF) return;
  const bars = $$('#visualizer span');
  let t = 0;
  function loop() {
    t += 0.12;
    const levels = AudioEngine.getLevels(bars.length);
    bars.forEach((bar, i) => {
      let h;
      if (levels) h = 15 + levels[i] * 85;
      else h = 10 + (Math.sin(t + i) * 0.5 + 0.5) * 8;
      bar.style.height = `${h}%`;
    });
    visualizerRAF = requestAnimationFrame(loop);
  }
  loop();
}
function stopVisualizer() {
  if (visualizerRAF) cancelAnimationFrame(visualizerRAF);
  visualizerRAF = null;
}

/* ---------------------------- ПУПЫРКА ---------------------------- */

function buildBubbleWrap() {
  const wrap = $('#bubble-wrap');
  wrap.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const b = document.createElement('button');
    b.className = 'bubble';
    b.addEventListener('click', () => {
      if (b.classList.contains('popped')) return;
      b.classList.add('popped');
      playSfx('pop');
    });
    wrap.appendChild(b);
  }
}

/* ---------------------------- ДЫХАНИЕ ---------------------------- */

let breathingActive = false;
let breathingTimeout = null;
function toggleBreathing() {
  breathingActive = !breathingActive;
  const btn = $('#breathing-toggle');
  const circle = $('#breathing-circle');
  if (breathingActive) {
    btn.textContent = 'Остановить';
    state.totals.breathingSessions += 1;
    commit();
    breathingCycle();
  } else {
    btn.textContent = 'Начать';
    clearTimeout(breathingTimeout);
    circle.style.transform = 'scale(1)';
    circle.textContent = 'Дыши';
  }
}
function breathingCycle() {
  if (!breathingActive) return;
  const circle = $('#breathing-circle');
  circle.textContent = 'Вдох';
  circle.style.transitionDuration = '4s';
  circle.style.transform = 'scale(1.45)';
  breathingTimeout = setTimeout(() => {
    if (!breathingActive) return;
    circle.textContent = 'Задержка';
    breathingTimeout = setTimeout(() => {
      if (!breathingActive) return;
      circle.textContent = 'Выдох';
      circle.style.transitionDuration = '6s';
      circle.style.transform = 'scale(0.75)';
      breathingTimeout = setTimeout(breathingCycle, 6000);
    }, 4000);
  }, 4000);
}

/* ---------------------------- РЕНДЕР ШАПКИ / ГЕРОЯ ---------------------------- */

function renderHeader() {
  const stage = getStage(state.level);
  $('#avatar-emoji').textContent = stage.emoji;
  $('#user-title').textContent = stage.title;
  $('#user-name').textContent = state.name || 'Гость';
  $('#stat-level').textContent = state.level;
  $('#stat-coins').textContent = state.coins;
  $('#stat-streak').textContent = state.streak;
  const need = xpToNext(state.level);
  $('#stat-xp').textContent = `${state.xp}/${need}`;
  const pct = Math.min(100, Math.round((state.xp / need) * 100));
  $('#xp-fill').style.width = `${pct}%`;
  $('#xp-fill-big').style.width = `${pct}%`;

  $('#hero-avatar').textContent = stage.emoji;
  $('#hero-title').textContent = stage.title;
  $('#hero-level').textContent = state.level;
  $('#hero-xp-left').textContent = need - state.xp;

  const track = $('#evolution-track');
  track.innerHTML = '';
  EVOLUTION.forEach((s) => {
    const span = document.createElement('span');
    const reached = state.level >= s.level;
    span.className = `evo-step${reached ? ' reached' : ''}${s.level === stage.level ? ' current' : ''}`;
    span.textContent = s.emoji;
    span.title = `${s.title} · ур. ${s.level}`;
    track.appendChild(span);
  });

  $('#stat-focus-min').textContent = state.dailyFocusMinutes[todayKey()] || 0;

  const themeBtn = $('#theme-toggle');
  themeBtn.textContent = state.theme === 'dark' ? '🌙' : '☀️';

  $('#mode-label').textContent = state.mode === 'adhd' ? 'СДВГ' : 'Обычный';
  $('#mode-toggle').setAttribute('aria-pressed', String(state.mode === 'adhd'));
}

/* ---------------------------- СТАТИСТИКА ---------------------------- */

function renderStats() {
  const days = [6, 5, 4, 3, 2, 1, 0].map((n) => daysAgoKey(n));

  const taskCounts = days.map((k) => state.dailyTaskCounts[k] || 0);
  const focusCounts = days.map((k) => state.dailyFocusMinutes[k] || 0);
  const maxTasks = Math.max(1, ...taskCounts);
  const maxFocus = Math.max(1, ...focusCounts);

  const renderChart = (root, values, max, key) => {
    root.innerHTML = '';
    values.forEach((v, i) => {
      const d = new Date(days[i]);
      const col = document.createElement('div');
      col.className = 'bar-col';
      const pct = Math.max(3, Math.round((v / max) * 100));
      col.innerHTML = `<div class="bar" style="height:${pct}%" title="${v}${key}"></div><span class="bar-label">${WEEKDAYS[d.getDay()]}</span>`;
      root.appendChild(col);
    });
  };
  renderChart($('#chart-tasks'), taskCounts, maxTasks, ' задач');
  renderChart($('#chart-focus'), focusCounts, maxFocus, ' мин');

  $('#stats-total-tasks').textContent = state.totals.tasksCompleted;
  $('#stats-total-xp').textContent = state.totals.xpEarned;
  $('#stats-total-coins').textContent = state.totals.coinsEarned;
  $('#stats-total-focus').textContent = state.totals.focusMinutes;
  $('#stats-best-streak').textContent = state.bestStreak;
}

/* ---------------------------- ЦИТАТЫ / MICRO-STEP ---------------------------- */

let lastQuoteIndex = -1;
function showRandomQuote() {
  let idx;
  do { idx = Math.floor(Math.random() * QUOTES.length); } while (idx === lastQuoteIndex && QUOTES.length > 1);
  lastQuoteIndex = idx;
  const el = $('#quote-text');
  el.style.opacity = 0;
  setTimeout(() => { el.textContent = QUOTES[idx]; el.style.opacity = 1; }, 200);
}

function showMicroStep() {
  const idx = Math.floor(Math.random() * MICRO_STEPS.length);
  $('#unstuck-result').textContent = MICRO_STEPS[idx];
  playSfx('whoosh');
}

/* ---------------------------- ОБЩИЙ РЕНДЕР ---------------------------- */

function renderAll() {
  renderHeader();
  renderTasks();
  renderHabits();
  renderBreakdowns();
  renderDistractions();
  renderRewards();
  renderAchievements();
  renderStats();

  if (pendingLevelUp) {
    pendingLevelUp = false;
    showLevelUpModal();
  }
}

function showLevelUpModal() {
  const stage = getStage(state.level);
  $('#levelup-emoji').textContent = stage.emoji;
  $('#levelup-title').textContent = stage.title;
  $('#levelup-num').textContent = state.level;
  $('#levelup-modal').classList.remove('hidden');
  playSfx('levelup');
  spawnConfetti(window.innerWidth / 2, window.innerHeight / 3, 130);
}

/* ---------------------------- ВКЛАДКИ ---------------------------- */

function switchTab(name) {
  $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${name}`));
  if (name === 'adhd') startVisualizer(); else stopVisualizer();
}

/* ---------------------------- ТЕМА / РЕЖИМ ---------------------------- */

function applyTheme() {
  document.body.setAttribute('data-theme', state.theme);
}
function applyMode() {
  document.body.setAttribute('data-mode', state.mode);
}
function applyReduceMotion() {
  document.body.setAttribute('data-reduce-motion', String(state.reduceMotion));
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  commit();
}
function toggleMode() {
  state.mode = state.mode === 'adhd' ? 'normal' : 'adhd';
  applyMode();
  commit();
}

/* ---------------------------- EXPORT / IMPORT / RESET ---------------------------- */

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ldm-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Резервная копия скачана 💾', 'success');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = deepMerge(defaultState(), parsed);
      applyTheme(); applyMode(); applyReduceMotion();
      commit();
      toast('Данные импортированы ✅', 'success');
    } catch (e) {
      toast('Не удалось прочитать файл', 'warn');
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!confirm('Точно сбросить весь прогресс? Это необратимо.')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  applyTheme(); applyMode(); applyReduceMotion();
  commit();
  $('#app').classList.add('hidden');
  $('#onboarding').classList.remove('hidden');
  toast('Прогресс сброшен', 'warn');
}

/* ---------------------------- ИНИЦИАЛИЗАЦИЯ ---------------------------- */

function bindEvents() {
  // onboarding
  let chosenMode = 'normal';
  $$('.choice-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.choice-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      chosenMode = btn.dataset.mode;
    });
  });
  $('#onboarding-start').addEventListener('click', () => {
    state.name = $('#onboarding-name').value.trim();
    state.mode = chosenMode;
    state.onboarded = true;
    applyMode();
    saveState();
    $('#onboarding').classList.add('hidden');
    $('#app').classList.remove('hidden');
    renderAll();
    showRandomQuote();
    burstFromElement(null, 90);
    switchTab('dashboard');
  });

  // tabs
  $$('.tab-btn').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // header controls
  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#mode-toggle').addEventListener('click', toggleMode);
  $('#settings-btn').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', () => $('#settings-modal').classList.add('hidden'));
  $('#levelup-close').addEventListener('click', () => $('#levelup-modal').classList.add('hidden'));

  $('#setting-theme').addEventListener('change', (e) => { state.theme = e.target.checked ? 'light' : 'dark'; applyTheme(); commit(); });
  $('#setting-sfx').addEventListener('change', (e) => { state.sfx = e.target.checked; commit(); });
  $('#setting-reduce-motion').addEventListener('change', (e) => { state.reduceMotion = e.target.checked; applyReduceMotion(); commit(); });
  $('#setting-adhd').addEventListener('change', (e) => { state.mode = e.target.checked ? 'adhd' : 'normal'; applyMode(); commit(); });
  $('#setting-name').addEventListener('change', (e) => { state.name = e.target.value.trim(); commit(); });

  // dashboard
  $('#quick-task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#quick-task-input');
    if (!input.value.trim()) return;
    addTask(input.value, 'other', $('#quick-task-priority').value);
    input.value = '';
  });
  $('#quote-next').addEventListener('click', showRandomQuote);
  $('#unstuck-btn').addEventListener('click', showMicroStep);

  // tasks
  $('#task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#task-title');
    if (!input.value.trim()) return;
    addTask(input.value, $('#task-category').value, $('#task-priority').value);
    input.value = '';
  });
  $$('#task-filters .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      taskFilter = chip.dataset.filter;
      $$('#task-filters .chip').forEach((c) => c.classList.toggle('active', c === chip));
      renderTasks();
    });
  });

  // ADHD: timer
  $$('#timer-presets .chip').forEach((chip) => chip.addEventListener('click', () => setTimerMinutes(Number(chip.dataset.min))));
  $('#timer-start').addEventListener('click', startTimer);
  $('#timer-pause').addEventListener('click', pauseTimer);
  $('#timer-reset').addEventListener('click', resetTimer);

  // ADHD: sounds
  $$('.sound-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.sound-btn').forEach((b) => b.classList.remove('active'));
      const type = btn.dataset.sound;
      AudioEngine.playAmbient(type);
      if (type !== 'off') btn.classList.add('active');
    });
  });
  $('#sound-volume').addEventListener('input', (e) => {
    state.soundVolume = Number(e.target.value);
    AudioEngine.setVolume(state.soundVolume);
  });
  $('#sound-volume').addEventListener('change', () => saveState());

  // ADHD: breakdown
  $('#breakdown-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#breakdown-title');
    if (!input.value.trim()) return;
    addBreakdown(input.value);
    input.value = '';
  });

  // ADHD: distraction log
  $('#distraction-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#distraction-input');
    if (!input.value.trim()) return;
    addDistraction(input.value);
    input.value = '';
  });

  // ADHD: bubble wrap
  $('#bubble-reset').addEventListener('click', buildBubbleWrap);

  // ADHD: breathing
  $('#breathing-toggle').addEventListener('click', toggleBreathing);

  // habits
  $('#habit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#habit-title');
    if (!input.value.trim()) return;
    addHabit(input.value, $('#habit-emoji').value);
    input.value = '';
    $('#habit-emoji').value = '✅';
  });

  // rewards
  $('#reward-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#reward-title');
    const cost = Number($('#reward-cost').value) || 10;
    if (!input.value.trim()) return;
    addReward(input.value, cost);
    input.value = '';
    $('#reward-cost').value = 50;
  });

  // stats / data
  $('#export-btn').addEventListener('click', exportData);
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  $('#reset-btn').addEventListener('click', resetAllData);
}

function openSettings() {
  $('#setting-theme').checked = state.theme === 'light';
  $('#setting-sfx').checked = state.sfx;
  $('#setting-reduce-motion').checked = state.reduceMotion;
  $('#setting-adhd').checked = state.mode === 'adhd';
  $('#setting-name').value = state.name || '';
  $('#settings-modal').classList.remove('hidden');
}

function init() {
  applyTheme();
  applyMode();
  applyReduceMotion();
  bindEvents();
  buildBubbleWrap();
  setTimerMinutes(25);

  setInterval(() => {
    if ($('#tab-dashboard').classList.contains('active')) showRandomQuote();
  }, 25000);

  setTimeout(() => {
    $('#loader').style.opacity = '0';
    setTimeout(() => {
      $('#loader').classList.add('hidden');
      if (state.onboarded) {
        $('#app').classList.remove('hidden');
        renderAll();
        showRandomQuote();
        switchTab('dashboard');
      } else {
        $('#onboarding').classList.remove('hidden');
      }
    }, 400);
  }, 900);

  if (state.onboarded) renderAll();
}

document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
