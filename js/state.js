'use strict';
/* =========================================================
   STATE — состояние, экономика, прогрессия
   ========================================================= */

const State = (() => {

  const KEY = 'ldm_state_v1';
  const listeners = {};

  /* ---------- утилиты дат ---------- */
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const todayKey = () => dateKey(new Date());
  const daysAgoKey = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dateKey(d); };
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------- дефолтное состояние ---------- */
  function defaults() {
    return {
      v: 2,
      onboarded: false,
      name: '',
      mode: 'normal',
      theme: 'dark',
      palette: 'violet',
      reduceMotion: false,
      sfx: true,
      haptics: true,
      notifications: false,

      level: 1,
      xp: 0,
      coins: 0,
      streak: 0,
      bestStreak: 0,
      lastActiveDate: null,
      lastSeenDate: null,

      skills: {},
      tasks: [],
      habits: [],
      goals: [],
      breakdowns: [],
      distractions: [],
      brainDump: [],
      rewards: [
        { id: uid(), title: 'Любимый сериал (1 серия)', cost: 60 },
        { id: uid(), title: 'Вкусный перекус', cost: 40 },
        { id: uid(), title: 'Час игр без чувства вины', cost: 120 },
      ],
      moods: {},
      lessons: { read: {}, actions: {} },
      quests: { date: null, ids: [], progress: {}, done: {} },
      weekly: { week: null, id: null, claimed: false },
      boosters: { xpUntil: 0, coinUntil: 0, streakSaves: 0 },
      business: { assets: {}, invested: 0, lastTick: Date.now(), millionaireAt: null },
      soundMix: {},
      music: { station: 'lofi', volume: 0.5, autoWithTimer: true, sleepMinutes: 0 },
      routines: { morning: [], evening: [], done: {} },
      reminders: {
        water: { on: false, every: 60 },
        move: { on: false, every: 45 },
        eyes: { on: false, every: 20 },
        posture: { on: false, every: 30 },
      },
      a11y: { font: 'default', scale: 'md', contrast: false },
      focusGoal: 60,
      quiet: { on: false, from: 22, to: 8 },
      customTimer: { focus: 30, break: 7 },
      sfxVolume: 0.3,
      focusLog: [],
      weeklyReviews: {},
      path: { done: {}, claimed: {}, startedAt: null, stage: 0 },
      pledge: { date: null, items: [], rewarded: false },
      money: { income: 0, expenses: 0, cushion: 0, capital: 0, updated: null },

      /* режим дня и планировщик */
      profile: {
        chronotype: 'neutral',
        wakeTarget: 7 * 60, sleepTarget: 23 * 60,
        workStart: 9 * 60, workEnd: 18 * 60,
        waterGoal: 8, kcalGoal: 2000, mealsGoal: 3, sleepGoal: 8,
        pills: [],
        strict: true,
      },
      day: {},
      plan: { date: null, blocks: [], generatedAt: null, skipped: {} },
      dayTemplate: { items: [], seeded: false, autoApply: true, appliedDate: null },
      achievements: {},

      totals: {
        tasksCompleted: 0, bossTasks: 0, focusMinutes: 0, focusSessions: 0,
        coinsEarned: 0, xpEarned: 0, passiveEarned: 0, breakdownsUsed: 0,
        breathingSessions: 0, rewardsBought: 0, dumpCount: 0, distractionCount: 0,
        rouletteSpins: 0, questsDone: 0, hyperfocus: 0, perfectHabitDays: 0,
        nightTasks: 0, earlyTasks: 0, lessonsRead: 0, musicMinutes: 0,
        returns: 0, routinesDone: 0, reviewsDone: 0, pathSteps: 0, pathStages: 0, pledgesKept: 0,
        daysLogged: 0, blocksDone: 0, plansMade: 0, waterGlasses: 0, templatesApplied: 0, chillKept: 0, chillOver: 0,
      },

      dailyTaskCounts: {},
      dailyFocusMinutes: {},
      focusByHour: {},
      /* журнал сделанного: день → номера названий. По нему считаются серии
         («ТТ кино — 5 дней подряд»), а сами старые закрытые задачи можно
         убирать: 16 дел в день за год — это тысячи записей */
      doneTitles: [],
      doneLog: {},
      /* тренировки по дням, покупки недели, что советовал ИИ */
      workouts: {},
      shop: null,
      aiLog: [],
      remind: { set: 'important', before: 5 },
    };
  }

  let s = defaults();

  /* ---------- хранилище ---------- */
  function deepMerge(base, patch) {
    const out = Array.isArray(base) ? base.slice() : { ...base };
    for (const k of Object.keys(patch || {})) {
      const pv = patch[k];
      const bv = base ? base[k] : undefined;
      if (pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
        out[k] = deepMerge(bv, pv);
      } else {
        out[k] = pv;
      }
    }
    return out;
  }

  const BACKUP_KEY = KEY + '_backup';
  let lastWrite = 0;          // когда эта вкладка последний раз писала
  let loadProblem = null;     // что пошло не так при загрузке — покажем человеку

  function parseState(raw) {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('не объект');
    return obj;
  }

  function load() {
    loadProblem = null;
    let raw = null, fromBackup = false;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }

    if (raw) {
      try {
        s = deepMerge(defaults(), parseState(raw));
      } catch (e) {
        /* Основное сохранение испорчено. Молча начинать с нуля нельзя:
           это стирает всё, что человек накопил. Пробуем запасную копию,
           а испорченное откладываем в сторону, а не затираем. */
        let restored = false;
        try {
          const bk = localStorage.getItem(BACKUP_KEY);
          if (bk) { s = deepMerge(defaults(), parseState(bk)); restored = true; fromBackup = true; }
        } catch (e2) { restored = false; }
        try {
          // держим только одну отложенную копию: иначе они забьют хранилище
          Object.keys(localStorage)
            .filter((k) => k.indexOf(KEY + '_corrupt_') === 0)
            .forEach((k) => localStorage.removeItem(k));
          localStorage.setItem(KEY + '_corrupt_' + Date.now(), raw.slice(0, 200000));
        } catch (e3) { /* нет места */ }
        if (!restored) s = defaults();
        loadProblem = restored ? 'backup' : 'lost';
      }
    } else {
      s = defaults();
    }

    ensureSkills();
    ensureRoutines();
    lastWrite = Date.now();
    if (!fromBackup) writeBackup();
    return s;
  }

  function writeBackup() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw && raw.length > 40) localStorage.setItem(BACKUP_KEY, raw);
    } catch (e) { /* нет места — не беда, это подстраховка */ }
  }

  let backupTimer = null;
  function save() {
    try {
      s.savedAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(s));
      lastWrite = s.savedAt;
      /* запасную копию обновляем не чаще раза в минуту: она нужна на случай
         порчи основной, а не как второй полный лог каждого нажатия */
      clearTimeout(backupTimer);
      backupTimer = setTimeout(writeBackup, 60000);
    } catch (e) { /* приватный режим или кончилось место */ }
  }

  /* ---------- несколько вкладок ----------
     Раньше вкладки молча затирали работу друг друга: последняя запись
     побеждала. Теперь чужая запись подхватывается сразу. */
  function watchOtherTabs() {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('storage', (e) => {
      if (e.key !== KEY || !e.newValue) return;
      let incoming;
      try { incoming = parseState(e.newValue); } catch (err) { return; }
      if (!incoming.savedAt || incoming.savedAt <= lastWrite) return;
      s = deepMerge(defaults(), incoming);
      ensureSkills();
      ensureRoutines();
      lastWrite = incoming.savedAt;
      emit('externalChange', null);
      emit('change', null);
    });
  }

  const problem = () => loadProblem;

  function ensureSkills() {
    Data.SKILLS.forEach((sk) => { if (!s.skills[sk.id]) s.skills[sk.id] = { xp: 0 }; });
  }

  function ensureRoutines() {
    if (!s.routines.morning.length && !s.routines.evening.length && !s.routines.seeded) {
      s.routines.morning = Data.ROUTINE_DEFAULTS.morning.map((text) => ({ id: uid(), text }));
      s.routines.evening = Data.ROUTINE_DEFAULTS.evening.map((text) => ({ id: uid(), text }));
      s.routines.seeded = true;
    }
  }

  /* сколько пунктов рутины отмечено сегодня */
  function routineProgress(kind, dateKeyStr) {
    const key = dateKeyStr || todayKey();
    const day = s.routines.done[key] || {};
    const items = s.routines[kind] || [];
    const done = items.filter((i) => day[i.id]).length;
    return { done, total: items.length, pct: items.length ? (done / items.length) * 100 : 0 };
  }

  /* ---------- события ---------- */
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, payload) { (listeners[evt] || []).forEach((fn) => fn(payload)); }

  function commit() {
    checkWeekly();
    checkAchievements();
    save();
    emit('change');
  }

  /* ---------- уровни ---------- */
  const xpToNext = (level) => 80 + (level - 1) * 45;

  function stage() {
    let st = Data.EVOLUTION[0];
    for (const e of Data.EVOLUTION) if (s.level >= e.level) st = e;
    return st;
  }
  function nextStage() {
    return Data.EVOLUTION.find((e) => e.level > s.level) || null;
  }

  function boosterActive(kind) {
    const until = kind === 'xp' ? s.boosters.xpUntil : s.boosters.coinUntil;
    return until && until > Date.now();
  }

  function addXP(amount, skillId) {
    if (!amount || amount <= 0) return 0;
    const mult = boosterActive('xp') ? 2 : 1;
    const total = Math.round(amount * mult);
    s.totals.xpEarned += total;
    s.xp += total;

    if (skillId && s.skills[skillId]) s.skills[skillId].xp += total;

    const before = s.level;
    let need = xpToNext(s.level);
    while (s.xp >= need) {
      s.xp -= need;
      s.level += 1;
      const bonus = s.level * 15;
      s.coins += bonus;
      s.totals.coinsEarned += bonus;
      need = xpToNext(s.level);
    }
    if (s.level > before) {
      emit('levelup', { from: before, to: s.level, stage: stage(), newStage: Data.EVOLUTION.some((e) => e.level > before && e.level <= s.level) });
    }
    return total;
  }

  function addCoins(amount, opts = {}) {
    if (!amount || amount <= 0) return 0;
    const mult = (!opts.passive && boosterActive('coin')) ? 2 : 1;
    const total = amount * mult;
    s.coins += total;
    s.totals.coinsEarned += total;
    if (opts.passive) s.totals.passiveEarned += total;
    checkMillionaire();
    return total;
  }

  function spend(amount) {
    if (s.coins < amount) return false;
    s.coins -= amount;
    return true;
  }

  /* ---------- навыки ---------- */
  const skillNeed = (lvl) => 50 + (lvl - 1) * 35;

  function skillLevel(id) {
    let xp = (s.skills[id] && s.skills[id].xp) || 0;
    let lvl = 1;
    while (xp >= skillNeed(lvl)) { xp -= skillNeed(lvl); lvl += 1; }
    return lvl;
  }
  function skillProgress(id) {
    let xp = (s.skills[id] && s.skills[id].xp) || 0;
    let lvl = 1;
    while (xp >= skillNeed(lvl)) { xp -= skillNeed(lvl); lvl += 1; }
    return { level: lvl, xp, need: skillNeed(lvl), pct: Math.min(100, (xp / skillNeed(lvl)) * 100) };
  }

  /* ---------- стрик ---------- */
  function registerActivity() {
    const today = todayKey();
    if (s.lastActiveDate === today) return;
    if (!s.lastActiveDate) {
      s.streak = 1;
    } else {
      const gap = daysBetween(s.lastActiveDate, today);
      if (gap === 1) s.streak += 1;
      else if (gap === 2 && s.boosters.streakSaves > 0) { s.boosters.streakSaves -= 1; s.streak += 1; emit('streakSaved'); }
      else s.streak = 1;
    }
    s.lastActiveDate = today;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    emit('streak', s.streak);
  }

  /* ---------- журнал сделанного ---------- */
  function titleIndex(title) {
    if (!Array.isArray(s.doneTitles)) s.doneTitles = [];
    let i = s.doneTitles.indexOf(title);
    if (i === -1) { s.doneTitles.push(title); i = s.doneTitles.length - 1; }
    return i;
  }
  function logDone(title, key, off) {
    if (!title) return;
    if (!s.doneLog || typeof s.doneLog !== 'object') s.doneLog = {};
    const k = key || todayKey();
    const i = String(titleIndex(title));
    const set = new Set(s.doneLog[k] ? s.doneLog[k].split(',') : []);
    if (off) set.delete(i); else set.add(i);
    if (set.size) s.doneLog[k] = Array.from(set).join(','); else delete s.doneLog[k];
  }
  function doneTitlesOn(key) {
    const row = s.doneLog && s.doneLog[key];
    if (!row) return new Set();
    return new Set(row.split(',').map((i) => (s.doneTitles || [])[Number(i)]).filter(Boolean));
  }
  /* сколько дней подряд это дело было сделано; сегодня ещё можно успеть */
  function chain(title) {
    let n = 0;
    for (let i = 0; i < 400; i++) {
      if (doneTitlesOn(daysAgoKey(i)).has(title)) { n += 1; continue; }
      if (i === 0) continue;
      break;
    }
    return n;
  }
  /* перенести историю в журнал и убрать закрытые задачи старше месяца */
  function compactDone(days) {
    const keep = days || 30;
    const cutoff = Date.now() - keep * 86400000;
    (s.tasks || []).forEach((t) => {
      if (t.done && t.doneAt) {
        const k = dateKey(new Date(t.doneAt));
        if (!doneTitlesOn(k).has(t.title)) logDone(t.title, k);
      }
    });
    const before = s.tasks.length;
    s.tasks = s.tasks.filter((t) => !t.done || !t.doneAt || t.doneAt >= cutoff);
    return before - s.tasks.length;
  }

  function habitStreak(h) {
    let streak = 0;
    let cursor = h.history[todayKey()] ? 0 : 1;
    while (h.history[daysAgoKey(cursor)]) { streak += 1; cursor += 1; }
    return streak;
  }

  /* ---------- бизнес ---------- */
  function assetLevel(id) { return s.business.assets[id] || 0; }

  function assetCost(id) {
    const a = Data.assetById(id);
    return Math.round(a.base * Math.pow(1.15, assetLevel(id)));
  }

  function passivePerMin() {
    let sum = 0;
    for (const a of Data.ASSETS) sum += a.income * assetLevel(a.id);
    return sum;
  }

  function activityMultiplier() {
    return s.lastActiveDate === todayKey() ? 1 : 0.25;
  }

  function netWorth() { return s.coins + s.business.invested; }

  function checkMillionaire() {
    if (!s.business.millionaireAt && netWorth() >= Data.MILLIONAIRE_GOAL) {
      s.business.millionaireAt = Date.now();
      emit('millionaire');
    }
  }

  function tickPassive() {
    const now = Date.now();
    const last = s.business.lastTick || now;
    let elapsedMin = (now - last) / 60000;
    if (elapsedMin <= 0) { s.business.lastTick = now; return 0; }
    elapsedMin = Math.min(elapsedMin, 8 * 60); // максимум 8 часов офлайн-дохода
    const earned = passivePerMin() * elapsedMin * activityMultiplier();
    s.business.lastTick = now;
    if (earned > 0) addCoins(earned, { passive: true });
    return earned;
  }

  function buyAsset(id) {
    const cost = assetCost(id);
    if (!spend(cost)) return false;
    s.business.assets[id] = assetLevel(id) + 1;
    s.business.invested += cost;
    bumpQuest('invest', 1);
    checkMillionaire();
    return true;
  }

  /* ---------- ежедневные квесты ---------- */
  function hashDate(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function ensureQuests() {
    const today = todayKey();
    if (s.quests.date === today && s.quests.ids.length) return;
    const h = hashDate(today);
    const pool = Data.QUEST_POOL.slice();
    const ids = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const idx = (h >> (i * 5)) % pool.length;
      ids.push(pool.splice(idx, 1)[0].id);
    }
    s.quests = { date: today, ids, progress: {}, done: {} };
  }

  function todayQuests() {
    ensureQuests();
    return s.quests.ids.map((id) => Data.QUEST_POOL.find((q) => q.id === id)).filter(Boolean);
  }

  function bumpQuest(metric, amount) {
    ensureQuests();
    let completed = null;
    for (const q of todayQuests()) {
      if (q.metric !== metric || s.quests.done[q.id]) continue;
      const cur = (s.quests.progress[q.id] || 0) + amount;
      s.quests.progress[q.id] = cur;
      if (cur >= q.target) {
        s.quests.done[q.id] = true;
        s.totals.questsDone += 1;
        addXP(q.xp, 'discipline');
        if (q.coins) addCoins(q.coins);
        completed = q;
      }
    }
    if (completed) emit('quest', completed);
  }

  /* ---------- недельный вызов ---------- */
  function weekKey() {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  }

  function ensureWeekly() {
    const wk = weekKey();
    if (s.weekly.week === wk && s.weekly.id) return;
    const h = hashDate(wk);
    const pick = Data.WEEKLY_POOL[h % Data.WEEKLY_POOL.length];
    s.weekly = { week: wk, id: pick.id, claimed: false };
  }

  function weeklyChallenge() {
    ensureWeekly();
    return Data.WEEKLY_POOL.find((w) => w.id === s.weekly.id) || Data.WEEKLY_POOL[0];
  }

  /* прогресс считается прямо из истории — ничего дополнительно хранить не нужно */
  function weeklyProgress() {
    const w = weeklyChallenge();
    let value = 0;
    if (w.metric === 'tasksWeek') {
      for (let i = 0; i < 7; i++) value += s.dailyTaskCounts[daysAgoKey(i)] || 0;
    } else if (w.metric === 'focusWeek') {
      for (let i = 0; i < 7; i++) value += s.dailyFocusMinutes[daysAgoKey(i)] || 0;
    } else if (w.metric === 'daysWeek') {
      for (let i = 0; i < 7; i++) {
        const k = daysAgoKey(i);
        if ((s.dailyTaskCounts[k] || 0) > 0 || (s.dailyFocusMinutes[k] || 0) > 0) value += 1;
      }
    } else if (w.metric === 'habitsWeek') {
      for (let i = 0; i < 7; i++) value += s.habits.filter((h) => h.history[daysAgoKey(i)]).length;
    } else if (w.metric === 'lessonsWeek') {
      const since = Date.now() - 7 * 86400000;
      value = Object.values(s.lessons.read).filter((ts) => ts > since).length;
    } else if (w.metric === 'sessionsWeek') {
      const since = Date.now() - 7 * 86400000;
      value = (s.focusLog || []).filter((x) => x.at > since).length;
    }
    return { value: Math.min(value, w.target), target: w.target, pct: Math.min(100, (value / w.target) * 100), done: value >= w.target };
  }

  function checkWeekly() {
    ensureWeekly();
    if (s.weekly.claimed) return;
    const p = weeklyProgress();
    if (!p.done) return;
    const w = weeklyChallenge();
    s.weekly.claimed = true;
    addXP(w.xp, 'discipline');
    addCoins(w.coins);
    emit('weekly', w);
  }

  /* ---------- достижения ---------- */
  const api = {
    habitStreak, skillLevel, passivePerMin, netWorth,
    lessonCount: () => Data.LESSONS.length,
  };

  function checkAchievements() {
    for (const a of Data.ACHIEVEMENTS) {
      if (s.achievements[a.id] && s.achievements[a.id].unlocked) continue;
      let ok = false;
      try { ok = a.cond(s, api); } catch (e) { ok = false; }
      if (ok) {
        s.achievements[a.id] = { unlocked: true, at: Date.now() };
        if (a.xp) addXP(a.xp);
        if (a.coins) addCoins(a.coins);
        emit('achievement', a);
      }
    }
  }

  function unlockedAchievements() {
    return Object.keys(s.achievements).filter((k) => s.achievements[k] && s.achievements[k].unlocked).length;
  }

  /* ---------- палитры ---------- */
  function paletteUnlocked(p) { return s.level >= p.level; }

  /* ---------- сброс/импорт ---------- */
  function reset() {
    s = defaults();
    ensureSkills();
    save();
  }
  /* принять состояние из облака как есть — не перебивая его отметку времени,
     иначе свежая копия с другого устройства выглядела бы «старше» */
  function adopt(obj) {
    s = deepMerge(defaults(), obj || {});
    ensureSkills();
    ensureRoutines();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ничего */ }
    lastWrite = s.savedAt || Date.now();
  }

  function replace(obj) {
    s = deepMerge(defaults(), obj || {});
    ensureSkills();
    save();
  }

  return {
    get s() { return s; },
    KEY, uid, todayKey, daysAgoKey, dateKey, daysBetween,
    load, save, commit, on, emit, watchOtherTabs, problem, BACKUP_KEY,
    xpToNext, stage, nextStage, addXP, addCoins, spend, boosterActive,
    skillLevel, skillProgress, skillNeed,
    registerActivity, habitStreak,
    assetLevel, assetCost, passivePerMin, activityMultiplier, netWorth, tickPassive, buyAsset,
    ensureQuests, todayQuests, bumpQuest, ensureRoutines, routineProgress,
    weeklyChallenge, weeklyProgress, checkWeekly, weekKey,
    checkAchievements, unlockedAchievements, paletteUnlocked, api,
    reset, replace, adopt,
    logDone, doneTitlesOn, chain, compactDone,
  };
})();
