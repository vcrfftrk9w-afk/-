/* Шаг. Главный экран приложения — и единственное место, где что-то происходит.
   Показывается ровно один шаг. Не потому, что остальные секрет, а потому,
   что список из четырёх дел делает первое из них неподъёмным. */
(function (root) {
  'use strict';

  var M = root.Most, h = M.h;

  function resultsBlock(b) {
    if (!b.results.length) return null;
    var open = false;
    var list = h('div', { class: 'stack-s' });
    list.hidden = true;
    var toggle = h('button', {
      class: 'btn btn-quiet',
      onclick: function () {
        open = !open;
        list.hidden = !open;
        if (open && !list.firstChild) {
          b.results.slice().reverse().forEach(function (r) {
            list.appendChild(h('div', { class: 'pair' }, [
              h('span', { text: r.what }),
              h('span', { text: M.dateShort(r.at) })
            ]));
          });
        }
      }
    }, 'Что уже есть (' + b.results.length + ')');
    return h('div', { class: 'bare' }, [toggle, list]);
  }

  function finished(b) {
    var nodes = [M.ui.rail(4, 4, 'путь пройден')];
    nodes.push(M.ui.head('Путь пройден', 'Это не «поздравляем». Это просто факт: шаги кончились, а результаты остались.'));

    if (b.results.length) {
      nodes.push(h('div', { class: 'card' }, [
        h('div', { class: 'label', text: 'у тебя теперь есть' })
      ].concat(b.results.map(function (r) {
        return h('div', { class: 'pair' }, [h('span', { text: r.what }), h('span', { text: M.dateShort(r.at) })]);
      }))));
    }

    nodes.push(h('div', { class: 'row' }, [
      h('button', {
        class: 'btn btn-go',
        onclick: function () {
          M.store.close(b.id, 'done');
          M.go('close', { closed: true });
        }
      }, 'Закрыть этот мост'),
      h('button', {
        class: 'btn',
        onclick: function () { M.go('paths'); }
      }, 'Взять другой путь')
    ]));

    nodes.push(h('p', { class: 'note' }, 'Закрытый мост не исчезает: он останется в списке, и к нему можно вернуться. ' +
      'Но лучше не надо: если дальше получается без нас, значит, всё вышло как надо.'));
    return nodes;
  }

  M.screens.step = function (params) {
    params = params || {};
    var b = M.store.current();
    if (!b) { M.go('home'); return h('div'); }
    if (!b.pathId) { M.go('paths'); return h('div'); }

    var st = M.logic.step(b);
    if (!st || st.finished) return finished(b);

    var small = params.small !== undefined ? params.small : M.logic.smallerFirst(b);
    var view = small ? st.step.smaller : st.step;
    var nodes = [M.ui.rail(st.index, st.total, 'шаг ' + (st.index + 1) + ' из ' + st.total)];

    if (params.skipped) {
      nodes.push(h('p', { class: 'note', text: 'Тот шаг убрали. Бывает — значит, он был не про тебя.' }));
    }

    nodes.push(h('p', { class: 'quote', text: b.clarify.core || b.wish }));

    var card = h('div', { class: 'card card-step' }, [
      h('div', { class: 'label', text: small ? 'следующий шаг · уменьшенный' : 'следующий шаг' }),
      h('h2', { text: view.t }),
      st.step.why && !small ? h('p', { class: 'note', text: st.step.why }) : null,
      h('div', { class: 'result', text: 'В конце у тебя будет: ' + view.result }),
      h('div', { class: 'label', text: M.minutes(view.min) })
    ]);
    nodes.push(card);

    if (st.step.tool && !small) {
      card.appendChild(h('button', {
        class: 'btn',
        onclick: function () { M.go('workshop', { tool: st.step.tool, from: 'step' }); }
      }, 'Сделать это вместе — прямо сейчас'));
    }

    var done = function () {
      M.store.note(st.step.id, 'done', small ? 'уменьшенная версия' : '');
      M.store.gotResult(view.result);
      M.store.update(function (x) { x.stepIndex = st.index + 1; });
      M.go('close', { justDid: view.result });
    };

    nodes.push(h('div', { class: 'row' }, [
      h('button', { class: 'btn btn-go', onclick: done }, 'Готово'),
      small
        ? h('button', {
            class: 'btn',
            onclick: function () { M.go('step', { small: false }); }
          }, 'Могу и полный шаг')
        : h('button', {
            class: 'btn',
            onclick: function () { M.go('step', { small: true }); }
          }, 'Слишком большой')
    ]));

    nodes.push(h('div', { class: 'row' }, [
      h('button', {
        class: 'btn btn-quiet',
        onclick: function () {
          M.store.note(st.step.id, 'wrong', '');
          M.store.update(function (x) { x.stepIndex = st.index + 1; });
          M.go('step', { skipped: true });
        }
      }, 'Это не тот шаг'),
      h('button', {
        class: 'btn btn-quiet',
        onclick: function () { M.go('close'); }
      }, 'Хватит на сегодня')
    ]));

    var results = resultsBlock(b);
    if (results) nodes.push(results);

    if (M.logic.enoughAlone(b)) {
      nodes.push(h('div', { class: 'card' }, [
        h('h3', { text: 'Кажется, дальше ты и без нас' }),
        h('p', { class: 'note' }, 'Три сделанных шага и несколько готовых вещей. Дальше можно без нас: ' +
          'следующий шаг ты уже умеешь придумывать без подсказки — это видно по сделанному.'),
        h('div', { class: 'row' }, [
          h('button', {
            class: 'btn',
            onclick: function () {
              M.store.close(b.id, 'outgrown');
              M.go('close', { closed: true });
            }
          }, 'Закрыть мост и уйти'),
          h('button', {
            class: 'btn btn-quiet',
            onclick: function () { M.go('step'); }
          }, 'Пока останусь')
        ])
      ]));
    }

    return nodes;
  };
})(typeof window !== 'undefined' ? window : globalThis);
