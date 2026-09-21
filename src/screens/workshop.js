/* Мастерская: часть работы приложение делает вместе с человеком.
   Не советует «попробуйте разбить задачу», а собирает файл, черновик,
   таймер — то, что после сессии останется в руках. */
(function (root) {
  'use strict';

  var M = root.Most, h = M.h, W = M.workshop;

  var ticking = null;

  function stopTimer() {
    if (ticking) { clearInterval(ticking); ticking = null; }
  }

  function backRow(params, extra) {
    return h('div', { class: 'row' }, [
      h('button', {
        class: 'btn btn-quiet',
        onclick: function () { stopTimer(); M.go(params.from === 'step' ? 'step' : 'home'); }
      }, '← к шагу'),
      extra
    ]);
  }

  function finishRow(params, what) {
    return h('button', {
      class: 'btn btn-go',
      onclick: function () {
        stopTimer();
        M.store.gotResult(what);
        M.go(params.from === 'step' ? 'step' : 'close', { justDid: what });
      }
    }, 'Готово — это мой результат');
  }

  /* — прототип — */

  function prototypeScreen(params) {
    var nodes = [];

    if (!params.project) {
      nodes.push(M.ui.head('Соберём работающую штуку', 'Через двадцать минут у тебя будет файл, который открывается в браузере и делает что-то настоящее. Твоими словами внутри.'));
      nodes.push(h('div', { class: 'opts' }, W.projects.map(function (p) {
        return h('button', {
          class: 'opt',
          onclick: function () { M.go('workshop', { tool: 'prototype', project: p.id, from: params.from }); }
        }, [
          h('span', { text: p.title }),
          h('span', { class: 'opt-hint', text: p.about + ' · ' + M.minutes(p.minutes) })
        ]);
      })));
      nodes.push(backRow(params));
      return nodes;
    }

    var project = W.projectById(params.project);
    if (!project) { M.go('workshop', { tool: 'prototype', from: params.from }); return h('div'); }

    var inputs = {};
    var form = h('div', { class: 'stack' }, project.fields.map(function (f) {
      var field = M.ui.field({
        id: 'p-' + f.id, label: f.label, type: f.type, rows: f.rows,
        placeholder: f.placeholder, value: f.def
      });
      inputs[f.id] = field.input;
      return field.wrap;
    }));

    var out = h('div', { class: 'stack' });

    var build = function () {
      var values = {};
      Object.keys(inputs).forEach(function (k) { values[k] = inputs[k].value; });
      var code = project.build(values);
      M.clear(out);

      out.appendChild(h('hr', { class: 'divider' }));
      out.appendChild(h('h3', { text: 'Готово. Это работающая страница' }));
      out.appendChild(h('p', { class: 'note' },
        'Сохрани её в файл ' + W.filename(project) + ' и открой двойным кликом — она откроется в браузере и будет работать. ' +
        'Интернет для этого не нужен.'));

      var row = h('div', { class: 'row' });
      if (M.env.downloads) {
        row.appendChild(h('button', {
          class: 'btn btn-go',
          onclick: function (e) {
            if (!M.download(W.filename(project), code)) {
              e.target.textContent = 'Не вышло — скопируй код ниже';
            }
          }
        }, 'Скачать файл'));
      }
      var copyBtn = h('button', {
        class: M.env.downloads ? 'btn' : 'btn btn-go',
        onclick: function () { M.copy(code, copyBtn); }
      }, 'Скопировать код');
      row.appendChild(copyBtn);
      out.appendChild(row);

      out.appendChild(h('pre', { class: 'code', text: code }));
      out.appendChild(h('div', { class: 'result', text: 'Измени одну строчку: ' + project.tweak }));
      out.appendChild(finishRow(params, project.title + ' — готово и работает'));
      out.scrollIntoView({ block: 'nearest' });
    };

    nodes.push(M.ui.head(project.title, project.about));
    nodes.push(form);
    nodes.push(h('div', { class: 'row' }, [
      h('button', { class: 'btn btn-go', onclick: build }, 'Собрать')
    ]));
    nodes.push(out);
    nodes.push(backRow(params, h('button', {
      class: 'btn btn-quiet',
      onclick: function () { M.go('workshop', { tool: 'prototype', from: params.from }); }
    }, 'другая штука')));
    return nodes;
  }

  /* — письмо — */

  function letterScreen(params) {
    var nodes = [];

    if (!params.kind) {
      nodes.push(M.ui.head('Письмо, которое трудно написать', 'Напишем вместе. Главное правило: тому, кто получит письмо, должно быть легко ответить.'));
      nodes.push(h('div', { class: 'opts' }, W.letters.map(function (l) {
        return h('button', {
          class: 'opt',
          onclick: function () { M.go('workshop', { tool: 'letter', kind: l.id, from: params.from }); }
        }, [
          h('span', { text: l.title }),
          h('span', { class: 'opt-hint', text: l.about })
        ]);
      })));
      nodes.push(backRow(params));
      return nodes;
    }

    var kind = W.letterById(params.kind);
    if (!kind) { M.go('workshop', { tool: 'letter', from: params.from }); return h('div'); }

    var tone = 'plain';
    var inputs = {};
    var form = h('div', { class: 'stack' }, kind.fields.map(function (f) {
      var field = M.ui.field({
        id: 'l-' + f.id, label: f.label, type: f.type, rows: f.rows, placeholder: f.placeholder
      });
      inputs[f.id] = field.input;
      return field.wrap;
    }));

    var toneRow = h('div', { class: 'row' });
    var draft = h('div', { class: 'stack' });

    var build = function () {
      var values = {};
      Object.keys(inputs).forEach(function (k) { values[k] = inputs[k].value.trim(); });
      var text = W.buildLetter(kind.id, values, tone);
      M.clear(draft);
      draft.appendChild(h('hr', { class: 'divider' }));
      draft.appendChild(h('h3', { text: 'Черновик' }));
      draft.appendChild(h('div', { class: 'draft', text: text }));
      var copyBtn = h('button', {
        class: 'btn btn-go',
        onclick: function () { M.copy(text, copyBtn); }
      }, 'Скопировать');
      draft.appendChild(h('div', { class: 'row' }, [copyBtn]));
      draft.appendChild(h('p', { class: 'note' }, 'Перечитай завтра утром — это единственная правка, которая правда нужна. ' +
        'И не удлиняй: длинное письмо читается как просьба уговорить.'));
      draft.appendChild(finishRow(params, 'Черновик письма: ' + kind.title.toLowerCase()));
      draft.scrollIntoView({ block: 'nearest' });
    };

    [{ id: 'plain', label: 'Прямо' }, { id: 'soft', label: 'Помягче' }].forEach(function (t) {
      var btn = h('button', {
        class: 'btn btn-small',
        'aria-pressed': tone === t.id ? 'true' : 'false',
        onclick: function () {
          tone = t.id;
          Array.prototype.forEach.call(toneRow.children, function (c) {
            c.setAttribute('aria-pressed', c === btn ? 'true' : 'false');
          });
          if (draft.firstChild) build();
        }
      }, t.label);
      toneRow.appendChild(btn);
    });

    nodes.push(M.ui.head(kind.title, kind.about));
    nodes.push(form);
    nodes.push(h('div', { class: 'field' }, [h('label', { text: 'Тон' }), toneRow]));
    nodes.push(h('div', { class: 'row' }, [
      h('button', { class: 'btn btn-go', onclick: build }, 'Собрать черновик')
    ]));
    nodes.push(draft);
    nodes.push(backRow(params, h('button', {
      class: 'btn btn-quiet',
      onclick: function () { M.go('workshop', { tool: 'letter', from: params.from }); }
    }, 'другое письмо')));
    return nodes;
  }

  /* — двадцать минут против бардака — */

  function declutterScreen(params) {
    stopTimer();
    var nodes = [];

    if (!params.surface) {
      nodes.push(M.ui.head('Двадцать минут против бардака', 'Не «разобрать квартиру». Одна поверхность, двадцать минут, четыре решения на каждую вещь.'));
      nodes.push(h('div', { class: 'opts' }, W.surfaces.map(function (s) {
        return h('button', {
          class: 'opt',
          onclick: function () { M.go('workshop', { tool: 'declutter', surface: s.id, from: params.from }); }
        }, [
          h('span', { text: s.label }),
          h('span', { class: 'opt-hint', text: s.hint })
        ]);
      })));
      nodes.push(backRow(params));
      return nodes;
    }

    var surface = W.surfaceById(params.surface);
    var total = 20 * 60;
    var left = total;
    var counts = {};

    var clock = h('div', { class: 'clock', text: '20:00' });
    var show = function () {
      var m = Math.floor(Math.abs(left) / 60);
      var s = Math.abs(left) % 60;
      clock.textContent = (left < 0 ? '+' : '') + m + ':' + (s < 10 ? '0' + s : s);
      if (left <= 0) clock.className = 'clock over';
    };

    var startBtn = h('button', {
      class: 'btn btn-go',
      onclick: function () {
        if (ticking) { stopTimer(); startBtn.textContent = 'Продолжить'; return; }
        startBtn.textContent = 'Пауза';
        ticking = setInterval(function () {
          left -= 1;
          show();
          if (left === 0) {
            hint.textContent = 'Время вышло. Можно остановиться прямо здесь — даже на середине полки. В этом и смысл.';
          }
        }, 1000);
      }
    }, 'Начать двадцать минут');

    var hint = h('p', { class: 'note', text: surface.hint + ' Не убирай красиво — просто прими решение по каждой вещи.' });

    var tally = h('div', { class: 'tally' }, W.buckets.map(function (bucket) {
      counts[bucket.id] = 0;
      var n = h('span', { class: 'n', text: '0' });
      return h('button', {
        onclick: function () {
          counts[bucket.id] += 1;
          n.textContent = String(counts[bucket.id]);
        }
      }, [n, h('span', { text: bucket.label }), h('span', { class: 'opt-hint', text: bucket.hint })]);
    }));

    nodes.push(M.ui.head(surface.label, 'Таймер идёт, решения считаются. Считать необязательно — это просто помогает не зависнуть над одной вещью.'));
    nodes.push(h('div', { class: 'card' }, [clock, h('div', { class: 'row' }, [startBtn]), hint]));
    nodes.push(tally);

    nodes.push(h('div', { class: 'row' }, [
      h('button', {
        class: 'btn btn-go',
        onclick: function () {
          stopTimer();
          var what = W.declutterSummary(params.surface, counts);
          M.store.gotResult(what);
          M.go(params.from === 'step' ? 'step' : 'close', { justDid: what });
        }
      }, 'Закончить и записать'),
      h('button', {
        class: 'btn btn-quiet',
        onclick: function () { stopTimer(); M.go('workshop', { tool: 'declutter', from: params.from }); }
      }, 'другая поверхность')
    ]));

    nodes.push(backRow(params));
    show();
    return nodes;
  }

  M.screens.workshop = function (params) {
    params = params || {};
    stopTimer();
    if (params.tool === 'letter') return letterScreen(params);
    if (params.tool === 'declutter') return declutterScreen(params);
    if (params.tool === 'prototype') return prototypeScreen(params);

    return [
      M.ui.head('Мастерская', 'Три вещи, которые можно сделать прямо сейчас, вместе.'),
      h('div', { class: 'opts' }, [
        { id: 'prototype', t: 'Собрать работающую штуку', s: 'Файл, который открывается в браузере. Двадцать минут.' },
        { id: 'letter', t: 'Написать трудное письмо', s: 'Уйти, попросить больше, отказать, позвать.' },
        { id: 'declutter', t: 'Двадцать минут против бардака', s: 'Одна поверхность и таймер.' }
      ].map(function (t) {
        return h('button', {
          class: 'opt',
          onclick: function () { M.go('workshop', { tool: t.id, from: params.from }); }
        }, [h('span', { text: t.t }), h('span', { class: 'opt-hint', text: t.s })]);
      })),
      backRow(params)
    ];
  };
})(typeof window !== 'undefined' ? window : globalThis);
