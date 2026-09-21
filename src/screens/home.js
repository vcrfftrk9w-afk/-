/* Вход. Здесь человек кладёт на стол то, что звучит расплывчато. */
(function (root) {
  'use strict';

  var M = root.Most, h = M.h, C = M.content;

  M.screens.home = function (params) {
    params = params || {};
    var live = M.store.live();
    var showInput = params.fresh || !live.length;
    var nodes = [];

    var away = M.logic.awayNote(M.app.lastVisit);
    if (away && live.length) nodes.push(h('p', { class: 'note', text: away }));

    nodes.push(M.ui.head(
      'Мост',
      'Ты приходишь с тем, что пока звучит расплывчато. Уходишь с одним шагом, который можно сделать сегодня.'
    ));

    if (live.length) {
      nodes.push(h('div', { class: 'stack' }, live.map(function (b) {
        var st = M.logic.step(b);
        return h('div', { class: 'card' }, [
          h('div', { class: 'label', text: 'начато ' + M.dateShort(b.createdAt) }),
          h('h2', { text: b.clarify.core || b.wish }),
          st && st.step
            ? h('p', { class: 'note', text: 'Следующий шаг: ' + st.step.t.toLowerCase() })
            : h('p', { class: 'note', text: b.pathId ? 'Путь пройден.' : 'Разбор не закончен.' }),
          h('div', { class: 'row' }, [
            h('button', {
              class: 'btn btn-go',
              onclick: function () {
                M.store.open(b.id);
                M.go(b.pathId ? 'step' : 'clarify', b.pathId ? {} : { q: 'own' });
              }
            }, 'Продолжить')
          ])
        ]);
      })));
    }

    if (!showInput) {
      nodes.push(h('div', { class: 'row' }, [
        h('button', {
          class: 'btn btn-quiet',
          onclick: function () { M.go('home', { fresh: true }); }
        }, 'Прийти с чем-то другим')
      ]));
      return nodes;
    }

    var field = M.ui.field({
      id: 'wish',
      label: 'Что тебя сюда привело?',
      type: 'area',
      rows: 3,
      placeholder: 'Говори как думаешь, не как в резюме. Расплывчато — это нормально, дальше разберёмся.'
    });

    var start = function () {
      var text = field.input.value.trim();
      if (!text) { field.input.focus(); return; }
      M.store.create(text);
      M.go('clarify', { q: 'own' });
    };

    nodes.push(h('div', { class: 'bare' }, [
      field.wrap,
      h('div', { class: 'row' }, C.examples.map(function (ex) {
        return h('button', {
          class: 'btn btn-small',
          onclick: function () { field.input.value = ex; field.input.focus(); }
        }, ex);
      })),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn btn-go', onclick: start }, 'Начать разбор'),
        live.length ? h('button', {
          class: 'btn btn-quiet',
          onclick: function () { M.go('home'); }
        }, 'Отмена') : null
      ])
    ]));

    nodes.push(h('hr', { class: 'divider' }));

    nodes.push(h('div', { class: 'stack-s' }, [
      h('div', { class: 'label', text: 'Чего здесь нет' }),
      h('p', { class: 'note' }, 'Уведомлений. Серий и ударных дней. Ленты. Платных ускорений. ' +
        'Всё, что ты напишешь, останется в этом браузере: приложение не отправляет данные наружу' +
        (M.env.sealed ? ' — это запрещено ему на уровне самого файла.' : '.')),
      h('p', { class: 'note' }, 'Хорошая сессия здесь — короткая. Двадцать минут и один понятный шаг.')
    ]));

    return nodes;
  };
})(typeof window !== 'undefined' ? window : globalThis);
