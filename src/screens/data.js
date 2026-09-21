/* Данные. Всё, что приложение знает о человеке, показано как есть —
   и стирается одной кнопкой, без «вы уверены, что хотите нас покинуть». */
(function (root) {
  'use strict';

  var M = root.Most, h = M.h;

  M.screens.data = function () {
    var raw = M.store.exportText();
    var kb = Math.max(1, Math.round(raw.length / 1024));
    var bridges = M.store.state.order.length;
    var notes = M.store.state.order.reduce(function (n, id) {
      var b = M.store.state.bridges[id];
      return n + (b ? b.log.length + b.results.length : 0);
    }, 0);

    var nodes = [M.ui.head('Мои данные', 'Всё лежит в этом браузере, на этом устройстве. Ни аккаунта, ни сервера, ни синхронизации.')];

    nodes.push(h('div', { class: 'bare' }, [
      M.ui.pair('Мостов', String(bridges)),
      M.ui.pair('Записей', String(notes)),
      M.ui.pair('Занимает', kb + ' КБ'),
      M.ui.pair('Времени в приложении', Math.round(M.store.state.stats.minutes) + ' мин')
    ]));

    nodes.push(h('div', { class: 'stack-s' }, [
      h('div', { class: 'label', text: 'почему это не может утечь' }),
      h('p', { class: 'note' }, M.env.sealed
        ? 'В самом файле страницы стоит правило connect-src \'none\': браузеру запрещено отправлять отсюда ' +
          'сетевые запросы. Даже если в коде появится ошибка или чужая строчка — отправить твои записи некуда. ' +
          'Шрифты и оформление тоже свои, чтобы ни один внешний сервер не узнал, что ты сюда заходишь.'
        : 'Приложение не делает ни одного сетевого запроса: ни аналитики, ни чужих шрифтов, ни отправки текстов. ' +
          'В версии, которую можно скачать и открыть прямо с диска, это дополнительно закреплено правилом ' +
          'connect-src \'none\' в самом файле страницы.')
    ]));

    var row = h('div', { class: 'row' });
    if (M.env.downloads) {
      row.appendChild(h('button', {
        class: 'btn',
        onclick: function () { M.download('most-data.json', raw); }
      }, 'Скачать всё'));
    }
    var copyBtn = h('button', {
      class: 'btn',
      onclick: function () { M.copy(raw, copyBtn); }
    }, 'Скопировать всё');
    row.appendChild(copyBtn);

    var confirming = false;
    var wipe = h('button', {
      class: 'btn btn-quiet',
      onclick: function () {
        if (!confirming) {
          confirming = true;
          wipe.textContent = 'Точно стереть? Назад не вернуть';
          return;
        }
        M.store.wipe();
        M.app.nudged = true;
        M.go('home');
      }
    }, 'Стереть всё');
    row.appendChild(wipe);
    nodes.push(row);

    var open = false;
    var pre = h('pre', { class: 'code', text: raw });
    pre.hidden = true;
    var toggle = h('button', {
      class: 'btn btn-quiet',
      onclick: function () { open = !open; pre.hidden = !open; toggle.textContent = open ? 'Свернуть' : 'Показать всё как есть'; }
    }, 'Показать всё как есть');
    nodes.push(h('div', { class: 'bare' }, [toggle, pre]));

    nodes.push(M.ui.back('назад', M.store.current() ? 'step' : 'home'));
    return nodes;
  };
})(typeof window !== 'undefined' ? window : globalThis);
