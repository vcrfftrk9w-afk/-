/* Подбор пути и размера шага под настоящие силы человека, а не под идеального человека.
   Правило простое: приложение никогда не выбирает за человека — оно только честно
   помечает, что по силам, а что нет. Выбрать можно любой. */
(function (root) {
  'use strict';

  var M = root.Most || (root.Most = {});
  var C = M.content;
  var L = M.logic || (M.logic = {});

  var MONEY_RANK = { none: 0, small: 1, some: 2, ok: 3 };
  var ENERGY_RANK = { empty: 0, meh: 1, ok: 2 };

  /* Все пути для выбранных тяг, размеченные по посильности. */
  L.rank = function (bridge) {
    var pulls = (bridge.clarify.pulls || []).slice();
    if (!pulls.length) pulls = ['create'];
    var res = bridge.res || { hours: 2, money: 'none', energy: 'meh' };

    var list = C.paths.filter(function (p) { return pulls.indexOf(p.pull) !== -1; });

    var scored = list.map(function (p) {
      var shape = C.shapes[p.shape];
      var verdict = judge(shape, res);
      return {
        path: p,
        shape: shape,
        primary: p.pull === pulls[0],
        fit: verdict.fit,
        why: verdict.why,
        score: verdict.score + (p.pull === pulls[0] ? 0.5 : 0)
      };
    });

    scored.sort(function (a, b) { return b.score - a.score; });
    if (scored.length) scored[0].best = true;
    return scored;
  };

  function judge(shape, res) {
    var hours = Number(res.hours) || 0;
    var energy = ENERGY_RANK[res.energy] === undefined ? 1 : ENERGY_RANK[res.energy];
    var money = MONEY_RANK[res.money] === undefined ? 0 : MONEY_RANK[res.money];

    if (shape.needsEnergy && (energy === 0 || money === 0)) {
      return {
        fit: 'heavy',
        score: 0,
        why: energy === 0
          ? 'Сейчас на это нет сил. Не запрещено — но честно говорю: дорого.'
          : 'Без запаса денег это рискованно. Можно, но с открытыми глазами.'
      };
    }

    if (hours < shape.hours[0]) {
      return {
        fit: 'stretch',
        score: 1,
        why: 'Просит больше времени, чем у тебя есть. Придётся что-то отодвинуть.'
      };
    }

    if (hours > shape.hours[1]) {
      return {
        fit: 'good',
        score: 2,
        why: 'Меньше, чем ты можешь. Иногда это и хорошо: останется запас.'
      };
    }

    var bonus = energy === 0 && shape.id === 'repair' ? 1.5 : 0;
    return { fit: 'good', score: 3 + bonus, why: 'Помещается в твою неделю.' };
  }

  /* Текущий шаг моста. */
  L.step = function (bridge) {
    if (!bridge || !bridge.pathId) return null;
    var path = C.pathById(bridge.pathId);
    if (!path) return null;
    var i = M.clamp(bridge.stepIndex || 0, 0, path.steps.length);
    if (i >= path.steps.length) return { path: path, step: null, index: i, total: path.steps.length, finished: true };
    return { path: path, step: path.steps[i], index: i, total: path.steps.length, finished: false };
  };

  /* Когда сил мало или недели почти нет — сразу показываем уменьшенную версию. */
  L.smallerFirst = function (bridge) {
    var res = bridge.res || {};
    return res.energy === 'empty' || Number(res.hours) < 1.5;
  };

  L.progress = function (bridge) {
    var path = bridge.pathId ? C.pathById(bridge.pathId) : null;
    return {
      done: bridge.stepIndex || 0,
      total: path ? path.steps.length : 0
    };
  };

  L.doneCount = function (bridge) {
    return (bridge.log || []).filter(function (r) { return r.outcome === 'done'; }).length;
  };

  /* Момент, когда приложение должно предложить себя закрыть.
     Три сделанных шага и два осязаемых результата — человек уже умеет сам. */
  L.enoughAlone = function (bridge) {
    if (!bridge || bridge.closedAt) return false;
    return L.doneCount(bridge) >= 3 && (bridge.results || []).length >= 2;
  };

  /* Возвращение после паузы. Никаких «ты пропустил 12 дней». */
  L.awayNote = function (lastVisit) {
    if (!lastVisit) return null;
    var days = Math.floor((Date.now() - lastVisit) / 86400000);
    if (days < 2) return null;
    if (days < 14) return 'Прошло ' + days + ' ' + M.plural(days, 'день', 'дня', 'дней') + '. Это ничего не значит — всё на месте.';
    return 'Прошло ' + M.since(lastVisit).replace(' назад', '') + '. Никакой серии ты не потерял: мы их не ведём.';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof window !== 'undefined' ? window : globalThis);
