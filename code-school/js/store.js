/* Прогресс ученика: хранится в браузере (localStorage), с запасной копией. */
(function () {
  const KEY = 'igrokod_v1';
  const BACKUP = 'igrokod_v1_backup';

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fresh() {
    return {
      v: 1,
      name: '',
      xp: 0,
      done: {},        // id урока → { xp, at, hints, sol }
      quiz: {},        // id урока → число верных ответов с первой попытки
      code: {},        // id урока → код ученика
      hints: {},       // id урока → сколько подсказок открыто
      fails: {},       // id урока → сколько неудачных проверок
      sol: {},         // id урока → смотрел решение
      ach: {},         // id достижения → дата
      streak: { last: '', count: 0, best: 0 },
      days: {},        // дата → сколько действий
      stats: { runs: 0, errors: 0, fixed: 0, checks: 0 },
      projects: [],    // песочница: { id, name, code, updated }
      settings: { theme: 'auto', font: 15, sound: true, unlockAll: false, symbols: true },
      started: Date.now(),
      lastLesson: ''
    };
  }

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj && typeof obj === 'object' && obj.v === 1 ? obj : null;
    } catch (e) { return null; }
  }

  let state = read(KEY) || read(BACKUP) || fresh();
  // дополнить старое сохранение новыми полями
  const base = fresh();
  for (const k of Object.keys(base)) if (state[k] === undefined) state[k] = base[k];
  for (const k of Object.keys(base.settings)) if (state.settings[k] === undefined) state.settings[k] = base.settings[k];
  for (const k of Object.keys(base.stats)) if (state.stats[k] === undefined) state.stats[k] = base.stats[k];

  let saveTimer = null;
  const listeners = [];

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      const json = JSON.stringify(state);
      localStorage.setItem(KEY, json);
      localStorage.setItem(BACKUP, json);
    } catch (e) { /* хранилище недоступно или переполнено — работаем без сохранения */ }
  }
  function save() {
    if (!saveTimer) saveTimer = setTimeout(saveNow, 300);
    listeners.forEach((f) => { try { f(state); } catch (e) {} });
  }
  window.addEventListener('beforeunload', () => { if (saveTimer) saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) saveNow(); });
  // другая вкладка изменила прогресс — подхватываем
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    const other = read(KEY);
    if (other) { state = other; listeners.forEach((f) => { try { f(state); } catch (er) {} }); }
  });

  function touchDay() {
    const t = today();
    state.days[t] = (state.days[t] || 0) + 1;
    const s = state.streak;
    if (s.last !== t) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yd = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
      s.count = s.last === yd ? s.count + 1 : 1;
      s.last = t;
      s.best = Math.max(s.best || 0, s.count);
    }
  }

  window.Store = {
    get s() { return state; },
    save,
    saveNow,
    today,
    touchDay,
    onChange(f) { listeners.push(f); },
    reset() { state = fresh(); saveNow(); },
    exportText() { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); },
    importText(txt) {
      const obj = JSON.parse(decodeURIComponent(escape(atob(txt.trim()))));
      if (!obj || obj.v !== 1) throw new Error('bad');
      state = obj;
      for (const k of Object.keys(base)) if (state[k] === undefined) state[k] = base[k];
      saveNow();
    }
  };
})();
