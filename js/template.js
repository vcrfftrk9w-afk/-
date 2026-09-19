'use strict';
/* =========================================================
   DAYTPL — шаблон дня: набор дел, которые повторяются каждый день.
   Один раз настроил — дальше одна кнопка (или автоматически при подъёме).
   ========================================================= */

const DayTpl = (() => {

  /* стартовый набор: типичный день человека, который тянет контент,
     учит язык, готовит, тренируется и ищет заработок */
  const STARTER = [
    { title: 'ТТ видео — кино', cat: 'creative', pri: 'high', at: 19 * 60 + 55, est: 15, note: 'Выложить ролик на канал про кино' },
    { title: 'ТТ видео — orca', cat: 'creative', pri: 'high', at: 21 * 60, est: 15, note: 'Выложить ролик на orca' },
    { title: 'YouTube — снять или смонтировать', cat: 'creative', pri: 'high', est: 60 },
    { title: 'Английский', cat: 'study', pri: 'mid', est: 30, note: 'Каждый день понемногу лучше, чем раз в неделю много' },
    { title: 'Искать и думать над заработком', cat: 'money', pri: 'boss', est: 60, note: 'Самое важное дело дня — ставится на пик энергии' },
    { title: 'Продуктивное: спросить ИИ, что сейчас главное', cat: 'study', pri: 'mid', est: 20, note: 'Разобрать, что делать дальше, и записать в задачи' },
    { title: 'Тренировка', cat: 'health', pri: 'mid', est: 45 },
    { title: 'Готовка', cat: 'home', pri: 'mid', est: 45 },
    { title: 'OLX / обмен вещей', cat: 'money', pri: 'low', est: 20, note: 'Ответить на сообщения, выставить новое' },
    { title: 'Одно отложенное видео', cat: 'other', pri: 'low', est: 15, chill: true, note: 'Ровно одно. Таймер проследит.' },
  ];

  function tpl() {
    const s = State.s;
    if (!s.dayTemplate) s.dayTemplate = { items: [], seeded: false, autoApply: true, appliedDate: null };
    const t = s.dayTemplate;
    if (!Array.isArray(t.items)) t.items = [];
    return t;
  }

  function seed() {
    const t = tpl();
    if (t.seeded && t.items.length) return t;
    t.items = STARTER.map((x) => ({ id: State.uid(), on: true, ...x }));
    t.seeded = true;
    State.save();
    return t;
  }

  const items = () => tpl().items;
  const active = () => items().filter((x) => x.on);

  function toggle(id) {
    const x = items().find((i) => i.id === id);
    if (x) { x.on = !x.on; State.commit(); }
  }

  function add(data) {
    items().push({
      id: State.uid(), on: true,
      title: (data.title || 'Дело').slice(0, 80),
      cat: data.cat || 'other', pri: data.pri || 'mid',
      at: data.at === undefined ? null : data.at,
      est: data.est || null, chill: !!data.chill, note: data.note || '',
    });
    State.commit();
  }

  function remove(id) {
    tpl().items = items().filter((i) => i.id !== id);
    State.commit();
  }

  function update(id, patch) {
    const x = items().find((i) => i.id === id);
    if (!x) return;
    Object.assign(x, patch);
    State.commit();
  }

  /* уже есть сегодня такая задача? сравниваем по названию */
  function existsToday(title) {
    return State.s.tasks.some((t) => !t.done && t.title === title);
  }

  /* применить шаблон: создать недостающие задачи на сегодня */
  function apply(opts) {
    const o = opts || {};
    const t = tpl();
    let created = 0;
    active().forEach((x) => {
      if (existsToday(x.title)) return;
      Screens.tasks.add(x.title, x.cat, x.pri, false, {
        at: x.at === undefined ? null : x.at,
        estimate: x.est || null,
        chill: !!x.chill,
        due: State.todayKey(),
      });
      created += 1;
    });
    t.appliedDate = State.todayKey();
    if (created) State.s.totals.templatesApplied = (State.s.totals.templatesApplied || 0) + 1;
    State.commit();
    if (!o.quiet && typeof Planner !== 'undefined') Planner.build({});
    return created;
  }

  const appliedToday = () => tpl().appliedDate === State.todayKey();

  /* сохранить сегодняшние незакрытые задачи как шаблон */
  function captureFromToday() {
    const t = tpl();
    const open = State.s.tasks.filter((x) => !x.done).slice(0, 20);
    t.items = open.map((x) => ({
      id: State.uid(), on: true, title: x.title, cat: x.category, pri: x.priority,
      at: x.at === undefined ? null : x.at, est: x.estimate || null, chill: !!x.chill, note: '',
    }));
    t.seeded = true;
    State.commit();
    return t.items.length;
  }

  return { STARTER, tpl, seed, items, active, toggle, add, remove, update, apply, appliedToday, captureFromToday };
})();
