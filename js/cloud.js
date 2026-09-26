'use strict';
/* =========================================================
   CLOUD — прогресс хранится в личном облаке человека.

   Раньше всё жило только в памяти браузера. Окно, в котором
   открывается приложение, эту память не сохраняет, поэтому
   каждый вход выглядел как первый: снова имя, снова цель.
   Теперь состояние лежит в личном разделе data/users/<id>/,
   который видит только сам человек, и подтягивается при входе
   с любого устройства. Память браузера осталась как быстрый
   кэш и как запасной путь, если облака нет.
   ========================================================= */

const Cloud = (() => {
  const thaw = (o) => JSON.parse(JSON.stringify(o));
  let db = null;
  let uid = null;
  let status = 'off';          // off | connecting | on | absent | error
  let lastPayload = {};        // что уже лежит в облаке, по документам
  let writing = false;
  let dirty = false;
  let timer = null;
  let lastWriteAt = 0;
  let unsub = null;
  let adoptHandler = null;

  const MIN_GAP = 15000;       // писать не чаще раза в 15 секунд
  let minGap = MIN_GAP;        // своя база аккаунта (account.js) выдерживает чаще — там 4 секунды
  const DEBOUNCE = 2500;       // и только когда человек перестал нажимать
  const DOC_LIMIT = 230 * 1024; // у документа предел 256 КиБ — держим запас

  /* Состояние раскладываем по трём документам: ядро, задачи и история.
     Иначе через полгода пользования оно упрётся в предел одного документа. */
  const HISTORY_KEYS = ['day', 'dailyTaskCounts', 'dailyFocusMinutes', 'focusByHour', 'moods', 'focusLog', 'weeklyReviews', 'doneLog', 'doneTitles', 'workouts', 'aiLog'];

  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(undefined), ms))]);

  function split(s) {
    const core = {}, history = {};
    Object.keys(s).forEach((k) => {
      if (k === 'tasks') return;
      if (HISTORY_KEYS.indexOf(k) !== -1) history[k] = s[k];
      else core[k] = s[k];
    });
    return { core, tasks: { list: s.tasks || [] }, history };
  }

  /* если документ растёт к пределу — выкидываем самое старое, а не падаем */
  function fit(name, body) {
    let json = JSON.stringify(body);
    if (json.length <= DOC_LIMIT) return body;
    if (name === 'tasks') {
      const list = body.list.slice();
      // сначала давно закрытые задачи
      list.sort((a, b) => (a.done === b.done ? 0 : a.done ? -1 : 1) || (a.doneAt || 0) - (b.doneAt || 0));
      while (list.length && JSON.stringify({ list }).length > DOC_LIMIT) {
        if (!list[0].done) break;
        list.shift();
      }
      return { list };
    }
    if (name === 'history') {
      const h = JSON.parse(json);
      const trimMap = (m, keep) => {
        if (!m) return m;
        const keys = Object.keys(m).sort();
        keys.slice(0, Math.max(0, keys.length - keep)).forEach((k) => delete m[k]);
        return m;
      };
      let keep = 365;
      while (JSON.stringify(h).length > DOC_LIMIT && keep > 30) {
        ['day', 'dailyTaskCounts', 'dailyFocusMinutes', 'moods', 'doneLog'].forEach((k) => trimMap(h[k], keep));
        if (Array.isArray(h.focusLog)) h.focusLog = h.focusLog.slice(-keep);
        keep = Math.floor(keep * 0.7);
      }
      return h;
    }
    return body;
  }

  function merge(parts) {
    const out = Object.assign({}, parts.core || {});
    if (parts.tasks && Array.isArray(parts.tasks.list)) out.tasks = parts.tasks.list;
    Object.assign(out, parts.history || {});
    return out;
  }

  const ref = (name) => db.doc('data/users/' + uid + '/' + name);

  /* ---------- подключение ----------
     Внутри Claude — его облако. В APK и на сайте — аккаунт (account.js),
     если человек вошёл: у него те же doc().get/set/onSnapshot. */
  function connect() {
    if (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function') {
      return Promise.all([window.claude.use('db'), window.claude.use('user')]);
    }
    const b = typeof Account !== 'undefined' ? Account.backend() : null;
    return b ? Promise.resolve([b.db, b.user]) : null;
  }

  async function init(timeoutMs) {
    const conn = connect();
    minGap = typeof window !== 'undefined' && window.claude ? MIN_GAP : 4000;
    if (!conn) {
      status = 'absent';
      return null;
    }
    status = 'connecting';
    const got = await withTimeout(conn, timeoutMs || 8000);
    if (!got || !got[0] || !got[1]) { status = 'absent'; return null; }
    db = got[0];
    const id = await withTimeout(got[1].id(), 5000);
    if (!id) { status = 'absent'; db = null; return null; }
    uid = id;
    try {
      const snaps = await withTimeout(Promise.all([ref('core').get(), ref('tasks').get(), ref('history').get()]), 8000);
      if (!snaps) { status = 'error'; return null; }
      status = 'on';
      const [c, t, h] = snaps;
      if (!c.exists) return null;
      // копия: снимки облака на iPhone заморожены, менять их нельзя
      const parts = thaw({ core: c.data(), tasks: t.exists ? t.data() : null, history: h.exists ? h.data() : null });
      lastPayload = {
        core: JSON.stringify(parts.core),
        tasks: parts.tasks ? JSON.stringify(parts.tasks) : '',
        history: parts.history ? JSON.stringify(parts.history) : '',
      };
      return merge(parts);
    } catch (e) {
      status = 'error';
      return null;
    }
  }

  /* ---------- запись ---------- */
  async function writeNow() {
    if (status !== 'on' || !db) return;
    if (writing) { dirty = true; return; }
    writing = true;
    dirty = false;
    try {
      const parts = split(JSON.parse(JSON.stringify(State.s)));
      // документы пишем по одному и только те, что правда изменились
      for (const name of ['core', 'tasks', 'history']) {
        const body = fit(name, parts[name]);
        const json = JSON.stringify(body);
        if (json === lastPayload[name]) continue;
        try {
          await ref(name).set(body);
          lastPayload[name] = json;
        } catch (e) {
          if (e && e.code === 'unavailable') {
            await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
            try { await ref(name).set(body); lastPayload[name] = json; } catch (e2) { /* в следующий раз */ }
          } else if (e && (e.code === 'revoked' || e.code === 'not_granted' || e.code === 'capability_disabled')) {
            status = 'error';
            return;
          }
        }
      }
      lastWriteAt = Date.now();
    } finally {
      writing = false;
    }
    if (dirty) schedule();
  }

  /* после действия человека — одна запись на паузу, не чаще раза в 15 секунд */
  function schedule() {
    if (status !== 'on') return;
    clearTimeout(timer);
    const since = Date.now() - lastWriteAt;
    const wait = Math.max(DEBOUNCE, minGap - since);
    timer = setTimeout(writeNow, wait);
  }

  /* ушёл со страницы — дописываем сразу */
  function flush() {
    if (status !== 'on') return;
    clearTimeout(timer);
    writeNow();
  }

  /* ---------- другое устройство сохранило новее ---------- */
  function watch(onAdopt) {
    adoptHandler = onAdopt;
    if (status !== 'on' || unsub) return;
    unsub = ref('core').onSnapshot((snap) => {
      if (!snap.exists || snap.metadata.hasPendingWrites) return;
      const remote = snap.data();
      if (!remote || edited(remote) <= edited(State.s)) return;
      if (JSON.stringify(remote) === lastPayload.core) return;
      // подтягиваем задачи и историю к новому ядру
      Promise.all([ref('tasks').get(), ref('history').get()]).then(([t, h]) => {
        const parts = thaw({ core: remote, tasks: t.exists ? t.data() : null, history: h.exists ? h.data() : null });
        lastPayload = {
          core: JSON.stringify(parts.core),
          tasks: parts.tasks ? JSON.stringify(parts.tasks) : '',
          history: parts.history ? JSON.stringify(parts.history) : '',
        };
        if (adoptHandler) adoptHandler(merge(parts));
      }).catch(() => {});
    }, () => { unsub = null; });
  }

  /* нажатия, ввод и уход со страницы — сигналы, что пора сохранить */
  let bound = false;
  function bindTriggers() {
    if (bound) return;
    bound = true;
    const onAct = () => schedule();
    ['pointerup', 'keyup', 'change'].forEach((ev) => document.addEventListener(ev, onAct, true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
    window.addEventListener('online', () => schedule());
  }

  /* Какое сохранение новее — решает время последнего действия человека, а не записи:
     приложение сохраняется и само (таймеры, доход империи), и забытый открытым
     телефон иначе затёр бы свежий прогресс с другого. */
  const edited = (x) => (x && (x.userEditAt || x.savedAt)) || 0;
  if (typeof document !== 'undefined') {
    const mark = () => { try { if (State.s) State.s.userEditAt = Date.now(); } catch (e) {} };
    ['pointerup', 'keyup', 'change'].forEach((ev) => document.addEventListener(ev, mark, true));
  }

  /* вход в другой аккаунт или выход — забываем прежнее подключение */
  function reset() {
    clearTimeout(timer);
    if (unsub) { try { unsub(); } catch (e) {} }
    unsub = null;
    db = null;
    uid = null;
    status = 'off';
    lastPayload = {};
    writing = false;
    dirty = false;
    lastWriteAt = 0;
  }

  return {
    init, schedule, flush, watch, bindTriggers, reset, edited,
    get status() { return status; },
    get ready() { return status === 'on'; },
  };
})();
