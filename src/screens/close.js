/* Конец сессии. Самый важный экран: тут приложение отпускает.
   Никаких «возвращайся завтра», никакой серии, никакого напоминания. */
(function (root) {
  'use strict';

  var M = root.Most, h = M.h;

  M.screens.close = function (params) {
    params = params || {};
    var mins = Math.max(1, Math.floor((Date.now() - M.app.startedAt) / 60000));
    var b = M.store.current();
    var nodes = [];

    nodes.push(M.ui.head(
      params.closed ? 'Мост закрыт' : 'На сегодня всё',
      params.closed
        ? 'Он останется в списке, но больше ничего от тебя не хочет.'
        : 'Дальше начинается то, ради чего всё: обычная жизнь, в которой ты делаешь шаг.'
    ));

    if (params.justDid) {
      nodes.push(h('div', { class: 'card' }, [
        h('div', { class: 'label', text: 'сегодня появилось' }),
        h('p', { text: params.justDid }),
        h('p', { class: 'note', text: 'Это не галочка. Это вещь, которой вчера не было.' })
      ]));
    }

    nodes.push(h('div', { class: 'bare' }, [
      M.ui.pair('Ты здесь', mins + ' ' + M.plural(mins, 'минуту', 'минуты', 'минут')),
      M.ui.pair('Всего за всё время', Math.round(M.store.state.stats.minutes + mins) + ' мин'),
      h('p', { class: 'note', text: mins <= 20
        ? 'Хорошая длина. Чем меньше времени ты здесь проводишь, тем лучше мы работаем.'
        : 'Многовато для одной сессии. В следующий раз попробуй уйти раньше — решения всё равно принимаются снаружи.' })
    ]));

    nodes.push(h('div', { class: 'stack-s' }, [
      h('div', { class: 'label', text: 'что будет дальше' }),
      h('p', { class: 'note' }, 'Ничего. Мы не пришлём уведомление, не начислим серию и не спросим, почему тебя не было. ' +
        'Придёшь через три недели — всё будет на месте, и никто не скажет ни слова про эти три недели.')
    ]));

    var bye = h('p', { class: 'note' });

    nodes.push(h('div', { class: 'row' }, [
      h('button', {
        class: 'btn btn-go',
        onclick: function () {
          var mins2 = Math.floor((Date.now() - M.app.startedAt) / 60000);
          if (mins2 > 0) M.store.addMinutes(mins2);
          M.app.startedAt = Date.now();
          try { root.close(); } catch (e) { /* браузер не даст — и правильно */ }
          bye.textContent = 'Вкладка не закрылась сама — значит, закрой её. Это и есть кнопка. Пока.';
        }
      }, 'Закрыть и пойти жить'),
      b && b.pathId && !b.closedAt ? h('button', {
        class: 'btn btn-quiet',
        onclick: function () { M.go('step'); }
      }, 'Остаться и взять ещё шаг') : h('button', {
        class: 'btn btn-quiet',
        onclick: function () { M.go('home'); }
      }, 'Вернуться к началу')
    ]));

    nodes.push(bye);
    return nodes;
  };
})(typeof window !== 'undefined' ? window : globalThis);
