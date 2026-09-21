/* Хранилище. Всё лежит в localStorage этого браузера и никуда не уходит:
   у страницы в CSP стоит connect-src 'none' — сетевой запрос физически невозможен. */
(function (root) {
  'use strict';

  var M = root.Most || (root.Most = {});
  var KEY = 'most.v1';

  function blank() {
    return {
      v: 1,
      startedAt: Date.now(),
      currentId: null,
      bridges: {},
      order: [],
      stats: { visits: 0, minutes: 0, lastVisit: null }
    };
  }

  /* Схема одного моста. Ничего лишнего: только то, что нужно самому человеку. */
  function blankBridge(wish) {
    return {
      id: M.uid(),
      wish: String(wish || '').trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      closedAt: null,
      closedWhy: null,
      clarify: { ownership: null, tuesday: '', pulls: [], costs: [], core: '' },
      res: { hours: 2, money: 'none', energy: 'meh', skills: '' },
      pathId: null,
      stepIndex: 0,
      log: [],
      results: []
    };
  }

  var store = {
    state: blank(),

    load: function () {
      var raw = null;
      try { raw = root.localStorage && root.localStorage.getItem(KEY); } catch (e) { raw = null; }
      if (!raw) { store.state = blank(); return store.state; }
      try {
        store.state = store.migrate(JSON.parse(raw));
      } catch (e) {
        store.state = blank();
      }
      return store.state;
    },

    /* Пережить будущие версии, не потеряв чужие записи. */
    migrate: function (data) {
      if (!data || typeof data !== 'object') return blank();
      var base = blank();
      var out = {
        v: 1,
        startedAt: data.startedAt || base.startedAt,
        currentId: data.currentId || null,
        bridges: data.bridges && typeof data.bridges === 'object' ? data.bridges : {},
        order: Array.isArray(data.order) ? data.order : Object.keys(data.bridges || {}),
        stats: Object.assign({}, base.stats, data.stats || {})
      };
      out.order = out.order.filter(function (id) { return !!out.bridges[id]; });
      Object.keys(out.bridges).forEach(function (id) {
        var b = Object.assign(blankBridge(''), out.bridges[id]);
        b.id = id;
        b.clarify = Object.assign(blankBridge('').clarify, b.clarify || {});
        b.res = Object.assign(blankBridge('').res, b.res || {});
        b.log = Array.isArray(b.log) ? b.log : [];
        b.results = Array.isArray(b.results) ? b.results : [];
        out.bridges[id] = b;
        if (out.order.indexOf(id) === -1) out.order.push(id);
      });
      if (out.currentId && !out.bridges[out.currentId]) out.currentId = null;
      return out;
    },

    commit: function () {
      try {
        root.localStorage.setItem(KEY, JSON.stringify(store.state));
      } catch (e) {
        /* Приватное окно, выключённое хранилище, переполнение — приложение
           продолжает работать в памяти. Молча падать нельзя, пугать тоже незачем. */
        store.volatile = true;
      }
      return store.state;
    },

    /* — мосты — */

    create: function (wish) {
      var b = blankBridge(wish);
      store.state.bridges[b.id] = b;
      store.state.order.unshift(b.id);
      store.state.currentId = b.id;
      store.commit();
      return b;
    },

    current: function () {
      var id = store.state.currentId;
      return id ? store.state.bridges[id] || null : null;
    },

    open: function (id) {
      if (!store.state.bridges[id]) return null;
      store.state.currentId = id;
      store.commit();
      return store.state.bridges[id];
    },

    /* update(fn) — меняем текущий мост и сразу сохраняем */
    update: function (fn) {
      var b = store.current();
      if (!b) return null;
      fn(b);
      b.updatedAt = Date.now();
      store.commit();
      return b;
    },

    live: function () {
      return store.state.order
        .map(function (id) { return store.state.bridges[id]; })
        .filter(function (b) { return b && !b.closedAt; });
    },

    closed: function () {
      return store.state.order
        .map(function (id) { return store.state.bridges[id]; })
        .filter(function (b) { return b && b.closedAt; });
    },

    close: function (id, why) {
      var b = store.state.bridges[id];
      if (!b) return;
      b.closedAt = Date.now();
      b.closedWhy = why || 'done';
      if (store.state.currentId === id) store.state.currentId = null;
      store.commit();
    },

    reopen: function (id) {
      var b = store.state.bridges[id];
      if (!b) return;
      b.closedAt = null;
      b.closedWhy = null;
      store.state.currentId = id;
      store.commit();
    },

    forget: function (id) {
      delete store.state.bridges[id];
      store.state.order = store.state.order.filter(function (x) { return x !== id; });
      if (store.state.currentId === id) store.state.currentId = null;
      store.commit();
    },

    /* — записи — */

    note: function (stepId, outcome, text) {
      return store.update(function (b) {
        b.log.push({ at: Date.now(), stepId: stepId, outcome: outcome, note: text || '' });
      });
    },

    gotResult: function (what) {
      return store.update(function (b) {
        b.results.push({ at: Date.now(), what: what });
      });
    },

    /* — данные человека — */

    exportText: function () {
      return JSON.stringify(store.state, null, 2);
    },

    wipe: function () {
      try { root.localStorage.removeItem(KEY); } catch (e) { /* и так сотрём в памяти */ }
      store.state = blank();
      return store.state;
    },

    visit: function () {
      var last = store.state.stats.lastVisit;
      store.state.stats.visits += 1;
      store.state.stats.lastVisit = Date.now();
      store.commit();
      return last;
    },

    addMinutes: function (n) {
      store.state.stats.minutes += n;
      store.commit();
    }
  };

  store.blank = blank;
  store.blankBridge = blankBridge;

  M.store = store;

  if (typeof module !== 'undefined' && module.exports) module.exports = store;
})(typeof window !== 'undefined' ? window : globalThis);
