/* Пути. Приложение помечает, что по силам, но выбирает человек.
   Весь путь целиком можно посмотреть — но по умолчанию он закрыт:
   от списка из четырёх шагов руки опускаются быстрее, чем от одного. */
(function (root) {
  'use strict';

  var M = root.Most, h = M.h;

  var FIT = {
    good: { label: 'по силам' },
    stretch: { label: 'потребует больше времени' },
    heavy: { label: 'дорого сейчас' }
  };

  M.screens.paths = function () {
    var b = M.store.current();
    if (!b) { M.go('home'); return h('div'); }

    var ranked = M.logic.rank(b);
    var nodes = [M.ui.rail(6, 6, 'путь')];

    nodes.push(M.ui.head(
      'Три разные дороги — не лучшая и худшая',
      'Они отличаются ценой: временем, деньгами, риском. Выбирай ту, которую вытянешь на этой неделе, а не ту, которая красивее звучит.'
    ));

    nodes.push(h('p', { class: 'quote', text: b.clarify.core || b.wish }));

    ranked.forEach(function (r) {
      var open = false;
      var details = h('div', { class: 'stack-s' });
      details.hidden = true;

      var toggle = h('button', {
        class: 'btn btn-quiet',
        onclick: function () {
          open = !open;
          details.hidden = !open;
          toggle.textContent = open ? 'Свернуть путь' : 'Показать весь путь';
          if (open && !details.firstChild) {
            r.path.steps.forEach(function (s) {
              details.appendChild(h('div', { class: 'pair' }, [
                h('span', { text: s.n + '. ' + s.t }),
                h('span', { text: M.minutes(s.min) })
              ]));
            });
            details.appendChild(h('p', { class: 'note', text: 'Дальше первого шага смотреть необязательно. Мы и не будем показывать.' }));
          }
        }
      }, 'Показать весь путь');

      nodes.push(h('div', { class: 'card' }, [
        h('div', { class: 'spread' }, [
          h('h2', { text: r.path.title }),
          h('span', { class: 'label', text: r.best ? 'похоже, по силам' : FIT[r.fit].label })
        ]),
        h('p', { text: r.path.about }),
        h('p', { class: 'note', text: r.shape.fits + ' · ' + r.why }),
        h('div', { class: 'row' }, [
          h('button', {
            class: r.best ? 'btn btn-go' : 'btn',
            onclick: function () {
              M.store.update(function (x) {
                x.pathId = r.path.id;
                x.stepIndex = 0;
              });
              M.go('step');
            }
          }, 'Идти этим путём'),
          toggle
        ]),
        details
      ]));
    });

    nodes.push(M.ui.back('назад к силам', 'resources'));
    return nodes;
  };
})(typeof window !== 'undefined' ? window : globalThis);
