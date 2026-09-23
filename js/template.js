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
    { title: 'Искать и думать над заработком', cat: 'money', pri: 'boss', est: 60,
      note: 'Самое важное дело дня — ставится на пик энергии',
      subs: [
        'Выписать 3 навыка, за которые уже сейчас платят деньги',
        'Найти 10 живых объявлений или вакансий по ним и записать цены',
        'Написать 5 сообщений тем, у кого проблема видна снаружи',
        'Записать один вывод: что из этого пробую дальше',
      ] },
    { title: 'Продуктивное: спросить ИИ, что сейчас главное', cat: 'study', pri: 'mid', est: 20,
      note: 'Разобрать, что делать дальше, и записать в задачи',
      subs: [
        'Открыть «Что сейчас главное» и прочитать разбор',
        'Выписать 3 дела на завтра',
        'Вычеркнуть из списка одно лишнее',
      ] },
    { title: 'Тренировка', cat: 'health', pri: 'mid', est: 45 },
    { title: 'Готовка', cat: 'home', pri: 'mid', est: 45 },
    { title: 'OLX / обмен вещей', cat: 'money', pri: 'low', est: 20, note: 'Ответить на сообщения, выставить новое' },
    { title: 'Одно отложенное видео', cat: 'other', pri: 'low', est: 15, chill: true, note: 'Ровно одно. Таймер проследит.' },
  ];

  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const todayDow = () => new Date().getDay();

  /* дело может идти не каждый день и в разное время в разные дни */
  function runsToday(x, dow) {
    const d = dow === undefined ? todayDow() : dow;
    if (!Array.isArray(x.days) || !x.days.length) return true;
    return x.days.indexOf(d) !== -1;
  }
  function atFor(x, dow) {
    const d = dow === undefined ? todayDow() : dow;
    if (x.atByDay && x.atByDay[d] !== undefined && x.atByDay[d] !== null) return x.atByDay[d];
    return x.at === undefined ? null : x.at;
  }
  function daysLabel(x) {
    if (!Array.isArray(x.days) || x.days.length === 0 || x.days.length === 7) return 'каждый день';
    const set = x.days.slice().sort();
    if (set.join() === '1,2,3,4,5') return 'по будням';
    if (set.join() === '0,6') return 'на выходных';
    return set.map((d) => WD[d]).join(', ');
  }

  function tpl() {
    const s = State.s;
    if (!s.dayTemplate) s.dayTemplate = { items: [], seeded: false, autoApply: true, appliedDate: null };
    const t = s.dayTemplate;
    if (!Array.isArray(t.items)) t.items = [];
    return t;
  }

  function seed() {
    const t = tpl();
    if (t.seeded && t.items.length) {
      // у тех, кто засеялся раньше, шагов ещё нет — доливаем из стартового набора
      let changed = false;
      t.items.forEach((it) => {
        if (it.subs && it.subs.length) return;
        const src = STARTER.find((x) => x.title === it.title && x.subs && x.subs.length);
        if (src) { it.subs = src.subs.slice(); changed = true; }
      });
      if (changed) State.save();
      return t;
    }
    t.items = STARTER.map((x) => ({ id: State.uid(), on: true, ...x }));
    t.seeded = true;
    State.save();
    return t;
  }

  const items = () => tpl().items;
  /* «активно» теперь означает «включено И сегодня по расписанию» */
  const active = (dow) => items().filter((x) => x.on && runsToday(x, dow));

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
      subs: Array.isArray(data.subs) ? data.subs : [],
      days: Array.isArray(data.days) ? data.days : null,
      atByDay: data.atByDay || null,
      hard: !!data.hard,
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

  /* уже есть сегодня такая задача? считаем и закрытые — иначе повторное
     применение шаблона наплодит дублей того, что уже сделано */
  function existsToday(title) {
    const today = State.todayKey();
    return State.s.tasks.some((t) =>
      t.title === title && (!t.done ? true : State.dateKey(new Date(t.doneAt || t.createdAt)) === today));
  }

  /* сколько дел шаблона закрыто сегодня */
  function progressToday() {
    const today = State.todayKey();
    const items = active();
    if (!items.length) return { done: 0, total: 0, pct: 0 };
    const done = items.filter((x) => State.s.tasks.some((t) =>
      t.title === x.title && t.done && State.dateKey(new Date(t.doneAt || 0)) === today)).length;
    return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
  }

  /* сколько дел шаблона было закрыто в конкретный день */
  function doneOn(dateKey) {
    const items = active();
    if (!items.length) return 0;
    return items.filter((x) => State.s.tasks.some((t) =>
      t.title === x.title && t.done && t.doneAt && State.dateKey(new Date(t.doneAt)) === dateKey)).length;
  }

  /* серия дней, когда закрыто хотя бы 80% шаблона */
  function streak() {
    const items = active();
    if (!items.length) return 0;
    const need = Math.max(1, Math.ceil(items.length * 0.8));
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const k = State.daysAgoKey(i);
      if (doneOn(k) >= need) { n += 1; continue; }
      if (i === 0) continue;   // сегодня ещё не вечер
      break;
    }
    return n;
  }

  /* применить шаблон: создать недостающие задачи на сегодня */
  function apply(opts) {
    const o = opts || {};
    const t = tpl();
    let created = 0;
    const today = State.todayKey();
    active().forEach((x) => {
      /* ежедневное дело, не сделанное вчера, — это сегодняшнее дело,
         а не «просроченное»: переносим его на сегодня с сегодняшним временем */
      const open = State.s.tasks.find((tk) => tk.title === x.title && !tk.done);
      if (open && open.due && open.due < today) {
        open.due = today;
        open.at = x.hard ? atFor(x) : null;
        open.prefer = x.hard ? null : atFor(x);
        return;
      }
      if (existsToday(x.title)) return;
      Screens.tasks.add(x.title, x.cat, x.pri, false, {
          /* «ровно в час» — только у того, что действительно не двигается
           (публикации). Остальное из графика — предпочтительное время:
           встал позже — план сдвинется, а не осыпется. */
        at: x.hard ? atFor(x) : null,
        prefer: x.hard ? null : atFor(x),
        estimate: x.est || null,
        chill: !!x.chill,
        due: State.todayKey(),
        silent: true,
      });
      // расплывчатое дело сразу приходит с шагами — иначе оно так и останется расплывчатым
      if (x.subs && x.subs.length) {
        const fresh = State.s.tasks[0];
        if (fresh && fresh.title === x.title) {
          fresh.subtasks = x.subs.map((text) => ({ id: State.uid(), text, done: false }));
        }
      }
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
      subs: (x.subtasks || []).map((st) => st.text),
    }));
    t.seeded = true;
    State.commit();
    return t.items.length;
  }

  return { STARTER, tpl, seed, items, active, toggle, add, remove, update, apply, appliedToday, captureFromToday, progressToday, doneOn, streak, runsToday, atFor, daysLabel, todayDow, WD };
})();
