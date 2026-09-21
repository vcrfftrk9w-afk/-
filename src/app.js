/* Сборка приложения: маршруты, подвал, счётчик времени.
   Счётчик здесь не для того, чтобы ты проводил тут больше времени.
   Он нужен, чтобы вовремя сказать: хватит, иди живи. */
(function (root) {
  'use strict';

  var M = root.Most || (root.Most = {});
  var h = M.h;

  M.screens = M.screens || {};

  var app = {
    startedAt: Date.now(),
    lastVisit: null,
    screen: 'home',
    params: null,
    nudged: false
  };
  M.app = app;

  /* — общие куски интерфейса — */

  var ui = M.ui = {};

  ui.head = function (title, sub) {
    return h('div', { class: 'stack-s' }, [
      h('h1', { text: title }),
      sub ? h('p', { class: 'lede', text: sub }) : null
    ]);
  };

  ui.back = function (label, to, params) {
    return h('button', {
      class: 'btn btn-quiet',
      onclick: function () { M.go(to, params); }
    }, '← ' + (label || 'назад'));
  };

  ui.rail = function (done, total, note) {
    var spans = [];
    for (var i = 0; i < total; i++) {
      spans.push(h('div', {
        class: 'rail-span' + (i < done ? ' done' : (i === done ? ' here' : ''))
      }));
    }
    return h('div', { class: 'stack-s' }, [
      h('div', { class: 'rail' }, spans),
      note ? h('div', { class: 'rail-note', text: note }) : null
    ]);
  };

  ui.pair = function (left, right) {
    return h('div', { class: 'pair' }, [h('span', { text: left }), h('span', { text: right })]);
  };

  /* Поле ввода с подписью. Возвращает и обёртку, и само поле. */
  ui.field = function (opts) {
    var input = opts.type === 'area'
      ? h('textarea', { id: opts.id, rows: opts.rows || 3, placeholder: opts.placeholder || '' })
      : h('input', { type: 'text', id: opts.id, placeholder: opts.placeholder || '' });
    if (opts.value) input.value = opts.value;
    var wrap = h('div', { class: 'field' }, [
      h('label', { for: opts.id, text: opts.label }),
      input
    ]);
    return { wrap: wrap, input: input };
  };

  /* — маршрутизация — */

  M.go = function (name, params) {
    app.screen = name;
    app.params = params || null;
    render();
  };

  M.rerender = function () { render(); };

  function render() {
    var mount = document.getElementById('app');
    if (!mount) return;
    M.clear(mount);
    var screen = M.screens[app.screen] || M.screens.home;
    var out = screen(app.params || {});
    (Array.isArray(out) ? out : [out]).forEach(function (node) {
      if (node) mount.appendChild(node);
    });
    renderFoot();
    if (root.scrollTo) root.scrollTo(0, 0);
  }

  /* — подвал — */

  function minutesHere() {
    return Math.floor((Date.now() - app.startedAt) / 60000);
  }

  function renderFoot() {
    var foot = document.getElementById('foot');
    if (!foot) return;
    M.clear(foot);

    var mins = minutesHere();
    foot.appendChild(h('span', { class: 'time', text: 'здесь ' + mins + ' мин' }));

    var links = h('span', { class: 'row' }, [
      app.screen !== 'bridges' ? h('button', {
        class: 'btn btn-quiet', onclick: function () { M.go('bridges'); }
      }, 'Мои мосты') : null,
      app.screen !== 'data' ? h('button', {
        class: 'btn btn-quiet', onclick: function () { M.go('data'); }
      }, 'Мои данные') : null,
      app.screen !== 'close' ? h('button', {
        class: 'btn btn-quiet', onclick: function () { M.go('close'); }
      }, 'Закончить') : null
    ]);
    foot.appendChild(links);
  }

  /* Через двадцать минут приложение само говорит, что пора закрываться. */
  function tick() {
    renderFoot();
    if (!app.nudged && minutesHere() >= 20 && app.screen !== 'close') {
      app.nudged = true;
      var mount = document.getElementById('app');
      if (!mount) return;
      mount.insertBefore(h('div', { class: 'enough' }, [
        'Ты здесь двадцать минут. Для одной сессии это много: ' +
        'решения принимаются не тут, а снаружи. Закончи на том, что уже стало ясно.'
      ]), mount.firstChild);
    }
  }

  /* — старт — */

  /* Оболочка, в которой страница не может скачать файл сама, но умеет
     предложить сохранение человеку. Если такой возможности нет — ничего
     не меняется: остаётся обычная ссылка на скачивание или копирование. */
  function findSaver() {
    if (!root.claude || typeof root.claude.use !== 'function') return;
    try {
      root.claude.use('downloads').then(function (d) {
        if (d && typeof d.save === 'function') {
          M.saver = function (req) { return d.save(req); };
        }
      }, function () { /* нет так нет */ });
    } catch (e) { /* нет так нет */ }
  }

  function boot() {
    M.store.load();
    findSaver();
    app.lastVisit = M.store.visit();

    var b = M.store.current();
    if (b && b.pathId) M.go('step');
    else if (b) M.go('clarify', { q: 'own' });
    else M.go('home');

    setInterval(tick, 30000);

    root.addEventListener('beforeunload', function () {
      var mins = minutesHere();
      if (mins > 0) M.store.addMinutes(mins);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
