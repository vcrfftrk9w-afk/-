/* Силы. Не «сколько надо», а сколько есть на самом деле.
   Это единственное место, где приложение просит быть скупым, а не смелым. */
(function (root) {
  'use strict';

  var M = root.Most, h = M.h;

  var MONEY = [
    { id: 'none', label: 'Нисколько', hint: 'Сейчас денег на это нет, и не надо.' },
    { id: 'small', label: 'До пары тысяч', hint: 'Можно купить что-то небольшое.' },
    { id: 'some', label: 'Заметная сумма', hint: 'Курс, инструмент, поездка.' },
    { id: 'ok', label: 'Запас на несколько месяцев', hint: 'Можно и рискнуть.' }
  ];

  var ENERGY = [
    { id: 'empty', label: 'На нуле', hint: 'Дотягиваю день и падаю.' },
    { id: 'meh', label: 'Так себе', hint: 'На одну вещь в неделю хватит.' },
    { id: 'ok', label: 'Силы есть', hint: 'Могу взяться всерьёз.' }
  ];

  function opts(list, current, onpick) {
    return h('div', { class: 'opts' }, list.map(function (o) {
      return h('button', {
        class: 'opt',
        'aria-pressed': current === o.id ? 'true' : 'false',
        onclick: function () { onpick(o.id); }
      }, [
        h('span', { text: o.label }),
        h('span', { class: 'opt-hint', text: o.hint })
      ]);
    }));
  }

  M.screens.resources = function () {
    var b = M.store.current();
    if (!b) { M.go('home'); return h('div'); }

    var nodes = [M.ui.rail(5, 6, 'силы')];

    nodes.push(M.ui.head(
      'Сколько у тебя есть на это сил',
      'Отвечай про обычную неделю, а не про ту, в которую ты собираешься стать другим человеком.'
    ));

    var val = h('div', { class: 'range-val', text: M.hoursWord(b.res.hours) + ' в неделю' });
    var slider = h('input', {
      type: 'range', id: 'hours', min: '0.5', max: '15', step: '0.5',
      value: String(b.res.hours),
      oninput: function (e) {
        var n = Number(e.target.value);
        val.textContent = M.hoursWord(n) + ' в неделю';
        M.store.update(function (x) { x.res.hours = n; });
      }
    });

    nodes.push(h('div', { class: 'field' }, [
      h('label', { for: 'hours', text: 'Времени в неделю' }),
      slider,
      val,
      h('p', { class: 'note', text: 'Считай то время, которое действительно свободно. Ночь после тяжёлого дня — не свободное время.' })
    ]));

    nodes.push(h('div', { class: 'field' }, [
      h('label', { text: 'Денег' }),
      opts(MONEY, b.res.money, function (id) {
        M.store.update(function (x) { x.res.money = id; });
        M.go('resources');
      })
    ]));

    nodes.push(h('div', { class: 'field' }, [
      h('label', { text: 'Сил' }),
      opts(ENERGY, b.res.energy, function (id) {
        M.store.update(function (x) { x.res.energy = id; });
        M.go('resources');
      })
    ]));

    var skills = M.ui.field({
      id: 'skills',
      label: 'Что ты уже умеешь — даже если кажется ерундой',
      type: 'area', rows: 2,
      placeholder: 'Хорошо объясняю. Не боюсь звонить незнакомым. Умею в таблицы.',
      value: b.res.skills
    });
    nodes.push(skills.wrap);

    nodes.push(h('div', { class: 'row' }, [
      h('button', {
        class: 'btn btn-go',
        onclick: function () {
          M.store.update(function (x) { x.res.skills = skills.input.value.trim(); });
          M.go('paths');
        }
      }, 'Показать пути'),
      M.ui.back('назад', 'clarify', { q: 'core' })
    ]));

    return nodes;
  };
})(typeof window !== 'undefined' ? window : globalThis);
