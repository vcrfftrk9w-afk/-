/* Список мостов. Открытые и закрытые. Закрытый мост — не провал и не трофей. */
(function (root) {
  'use strict';

  var M = root.Most, h = M.h, C = M.content;

  function card(b, closed) {
    var st = M.logic.step(b);
    var path = b.pathId ? C.pathById(b.pathId) : null;

    var row = h('div', { class: 'row' });

    if (!closed) {
      row.appendChild(h('button', {
        class: 'btn btn-go',
        onclick: function () {
          M.store.open(b.id);
          M.go(b.pathId ? 'step' : 'clarify', b.pathId ? {} : { q: 'own' });
        }
      }, 'Открыть'));
      row.appendChild(h('button', {
        class: 'btn btn-quiet',
        onclick: function () { M.store.close(b.id, 'stopped'); M.go('bridges'); }
      }, 'Закрыть мост'));
    } else {
      row.appendChild(h('button', {
        class: 'btn',
        onclick: function () { M.store.reopen(b.id); M.go(b.pathId ? 'step' : 'clarify', b.pathId ? {} : { q: 'own' }); }
      }, 'Вернуться к нему'));
    }

    var confirming = false;
    var forget = h('button', {
      class: 'btn btn-quiet',
      onclick: function () {
        if (!confirming) {
          confirming = true;
          forget.textContent = 'Точно забыть? Это навсегда';
          return;
        }
        M.store.forget(b.id);
        M.go('bridges');
      }
    }, 'Забыть');
    row.appendChild(forget);

    return h('div', { class: 'card' }, [
      h('div', { class: 'label', text: (closed ? 'закрыт ' + M.dateShort(b.closedAt) : 'начат ' + M.dateShort(b.createdAt)) }),
      h('h3', { text: b.clarify.core || b.wish }),
      path ? h('p', { class: 'note', text: path.title + ' · ' + (st && st.step ? 'следующий шаг: ' + st.step.t.toLowerCase() : 'путь пройден') })
           : h('p', { class: 'note', text: 'Разбор не закончен.' }),
      b.results.length ? h('p', { class: 'note', text: 'Сделано: ' + b.results.length + ' ' + M.plural(b.results.length, 'вещь', 'вещи', 'вещей') }) : null,
      row
    ]);
  }

  M.screens.bridges = function () {
    var live = M.store.live();
    var closed = M.store.closed();
    var nodes = [M.ui.head('Мои мосты', 'Всё, с чем ты сюда приходишь. Ничего не просрочено — здесь нет просрочек.')];

    if (!live.length && !closed.length) {
      nodes.push(h('p', { class: 'note', text: 'Пока пусто.' }));
    }

    live.forEach(function (b) { nodes.push(card(b, false)); });

    if (closed.length) {
      nodes.push(h('div', { class: 'label', text: 'закрытые' }));
      closed.forEach(function (b) { nodes.push(card(b, true)); });
    }

    nodes.push(h('div', { class: 'row' }, [
      h('button', { class: 'btn', onclick: function () { M.go('home', { fresh: true }); } }, 'Новый мост'),
      M.ui.back('назад', live.length ? 'step' : 'home')
    ]));

    return nodes;
  };
})(typeof window !== 'undefined' ? window : globalThis);
