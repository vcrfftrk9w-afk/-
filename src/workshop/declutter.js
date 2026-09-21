/* Мастерская: двадцать минут против бардака.
   Одна поверхность, четыре решения, таймер. После сигнала можно останавливаться
   на середине — это не считается провалом, в этом и смысл. */
(function (root) {
  'use strict';

  var M = root.Most || (root.Most = {});
  var W = M.workshop || (M.workshop = {});

  W.surfaces = [
    { id: 'table', label: 'Стол', hint: 'Тот, за которым ты сидишь чаще всего.' },
    { id: 'shelf', label: 'Одна полка', hint: 'Не шкаф. Одна полка.' },
    { id: 'downloads', label: 'Папка «Загрузки»', hint: 'Бардак бывает и не в квартире.' },
    { id: 'chats', label: 'Непрочитанные сообщения', hint: 'Ответить, отложить, забыть — тоже решения.' },
    { id: 'bag', label: 'Сумка или рюкзак', hint: 'Маленькая победа за восемь минут.' }
  ];

  W.buckets = [
    { id: 'keep', label: 'Оставить', hint: 'У вещи есть место, и она туда вернётся.' },
    { id: 'toss', label: 'Выбросить', hint: 'Без объяснений.' },
    { id: 'give', label: 'Отдать', hint: 'Нужное кому-то, но не тебе.' },
    { id: 'later', label: 'В коробку «потом»', hint: 'Решение отложено честно, а не спрятано.' }
  ];

  W.surfaceById = function (id) {
    for (var i = 0; i < W.surfaces.length; i++) if (W.surfaces[i].id === id) return W.surfaces[i];
    return null;
  };

  W.declutterSummary = function (surface, counts) {
    var total = W.buckets.reduce(function (n, b) { return n + (counts[b.id] || 0); }, 0);
    var name = (W.surfaceById(surface) || { label: 'Поверхность' }).label.toLowerCase();
    if (!total) return 'Разобрано: ' + name + '. Счётчик пустой — значит, считать было не главное.';
    return 'Разобрано: ' + name + ', ' + total + ' ' + M.plural(total, 'вещь', 'вещи', 'вещей') +
      ' (выброшено ' + (counts.toss || 0) + ', отдано ' + (counts.give || 0) + ').';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = W;
})(typeof window !== 'undefined' ? window : globalThis);
