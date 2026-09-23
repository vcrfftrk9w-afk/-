'use strict';
/* =========================================================
   WEEK — недельный график: пары, дорога и дела по дням.
   Понедельник, среда и «остальные дни» начинаются в разное
   время, поэтому одно и то же дело стоит в разные часы.
   ========================================================= */

const Week = (() => {

  const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6, SUN = 0;
  const WEEKDAYS = [MON, TUE, WED, THU, FRI];
  const WEEKEND = [SAT, SUN];
  const TTF = [TUE, THU, FRI];
  const h = (hh, mm) => hh * 60 + (mm || 0);

  /* ---------- пары и дорога ---------- */
  /* Пары по 50 минут, между ними 10, дорога 30 минут в одну сторону. */
  const STUDY = {
    [MON]: { start: h(8, 30), road: 30 },
    [WED]: { start: h(11, 30), road: 30 },
    [TUE]: { start: h(12, 30), road: 30 },
    [THU]: { start: h(12, 30), road: 30 },
    [FRI]: { start: h(12, 30), road: 30 },
  };
  const PAIRS = 3, PAIR = 50, GAP = 10;

  /* занятые часы на конкретный день недели: дорога → пары → дорога */
  function busyFor(dow) {
    const st = STUDY[dow];
    if (!st) return [];
    const end = st.start + PAIRS * PAIR + (PAIRS - 1) * GAP;
    return [
      { id: 'road-there', title: 'Дорога на учёбу', start: st.start - st.road, end: st.start },
      { id: 'pairs', title: `Пары (${PAIRS} по ${PAIR} мин)`, start: st.start, end },
      { id: 'road-back', title: 'Дорога домой', start: end, end: end + st.road },
    ];
  }

  const busyToday = () => busyFor(new Date().getDay());

  /* Обед в каждый день свой и правилом не выводится: в понедельник и среду
     он после возвращения с пар, а во вторник, четверг и пятницу — ранний,
     до выхода из дома. Поэтому просто таблица. */
  const LUNCH = {
    [MON]: h(13, 20),
    [TUE]: h(11, 30),
    [WED]: h(14, 50),
    [THU]: h(11, 30),
    [FRI]: h(11, 30),
    [SAT]: h(12),
    [SUN]: h(12),
  };
  const lunchFor = (dow) => (LUNCH[dow] != null ? LUNCH[dow] : h(12, 30));
  const lunchToday = () => lunchFor(new Date().getDay());

  /* ---------- дела недели ---------- */
  /* atByDay: во сколько это дело стоит в каждый из дней. */
  const PLAN = [
    {
      title: 'Английский', replaces: ['Английский'], cat: 'study', pri: 'high', est: 40,
      days: [MON, TUE, WED, THU, FRI, SAT, SUN],
      atByDay: { [MON]: h(12, 10), [TUE]: h(8), [WED]: h(8), [THU]: h(8), [FRI]: h(8), [SAT]: h(8, 30), [SUN]: h(8, 30) },
      note: '10 мин слова · 15 мин слушать или читать · 15 мин говорить или писать',
      subs: ['Повторить слова — 10 минут', 'Послушать или почитать — 15 минут', 'Сказать или написать вслух — 15 минут'],
    },
    {
      title: 'YouTube', replaces: ['YouTube — снять или смонтировать'], cat: 'creative', pri: 'high', est: 30,
      days: [MON, TUE, WED, THU, FRI, SAT, SUN],
      atByDay: { [MON]: h(12, 50), [TUE]: h(8, 40), [WED]: h(8, 40), [THU]: h(8, 40), [FRI]: h(8, 40), [SAT]: h(18), [SUN]: h(18) },
    },
    {
      title: 'Одно сохранённое видео', replaces: ['Одно отложенное видео'], cat: 'other', pri: 'low', est: 20, chill: true,
      days: [MON, TUE, WED, THU, FRI, SAT, SUN],
      atByDay: { [MON]: h(15, 10), [TUE]: h(9, 10), [WED]: h(9, 10), [THU]: h(9, 10), [FRI]: h(9, 10), [SAT]: h(9, 10), [SUN]: h(9, 10) },
      note: 'Ровно одно. После — записать одну мысль или действие.',
    },
    {
      title: 'OLX: объявления и обмены', replaces: ['OLX / обмен вещей'], cat: 'money', pri: 'mid', est: 30,
      days: [MON, TUE, WED, THU, FRI, SAT],
      atByDay: { [MON]: h(14, 40), [TUE]: h(9, 30), [WED]: h(9, 30), [THU]: h(9, 30), [FRI]: h(9, 30), [SAT]: h(11) },
    },
    {
      title: 'Работа над заработком', replaces: ['Искать и думать над заработком'], cat: 'money', pri: 'boss', est: 50,
      days: [MON, TUE, WED, THU, FRI, SAT],
      atByDay: { [MON]: h(13, 50), [TUE]: h(10), [WED]: h(10), [THU]: h(10), [FRI]: h(10), [SAT]: h(9, 30) },
      note: 'Не «думать», а сделать шаг: найти 3 предложения, написать заказчику, собрать пример работы.',
      subs: ['Найти 3 конкретных предложения', 'Написать одному заказчику', 'Сделать или доделать пример работы', 'Записать вывод: что пробую дальше'],
    },
    {
      title: 'Подготовка роликов для TikTok', cat: 'creative', pri: 'high', est: 30,
      days: TTF, atByDay: { [TUE]: h(11), [THU]: h(11), [FRI]: h(11) },
    },
    {
      title: 'Тренировка', replaces: ['Тренировка'], cat: 'health', pri: 'high', est: 45,
      days: [MON, WED, FRI], atByDay: { [MON]: h(16), [WED]: h(16), [FRI]: h(16) },
    },
    {
      title: 'Прогулка и восстановление', cat: 'health', pri: 'mid', est: 45,
      days: [TUE, THU], atByDay: { [TUE]: h(16), [THU]: h(16) },
    },
    {
      title: 'Готовка', replaces: ['Готовка'], cat: 'home', pri: 'mid', est: 40,
      days: [MON, TUE, WED, THU, FRI, SAT, SUN],
      atByDay: { [MON]: h(17), [TUE]: h(17), [WED]: h(17), [THU]: h(17), [FRI]: h(17), [SAT]: h(12), [SUN]: h(12) },
      note: 'По возможности сразу на два дня.',
    },
    {
      title: 'Задания по учёбе', cat: 'study', pri: 'high', est: 45,
      days: [MON, TUE, WED, THU, FRI, SUN],
      atByDay: { [MON]: h(18), [TUE]: h(18), [WED]: h(18), [THU]: h(18), [FRI]: h(18), [SUN]: h(9, 30) },
      note: 'Если срочного нет — практика навыка для заработка.',
    },
    {
      title: 'Смонтировать два ролика: кино и orca', cat: 'creative', pri: 'boss', est: 50,
      days: [MON, TUE, WED, THU, FRI, SAT, SUN],
      atByDay: { [MON]: h(18, 45), [TUE]: h(18, 45), [WED]: h(18, 45), [THU]: h(18, 45), [FRI]: h(18, 45), [SAT]: h(13), [SUN]: h(13) },
      note: 'На выходных можно заготовить сразу на несколько дней.',
    },
    {
      title: 'Проверить ролик «кино»: подпись и загрузка', cat: 'creative', pri: 'high', est: 10,
      days: [MON, TUE, WED, THU, FRI, SAT, SUN], at: h(19, 45),
    },
    {
      title: 'ТТ видео — кино', replaces: ['ТТ видео — кино'], cat: 'creative', pri: 'boss', est: 10,
      days: [MON, TUE, WED, THU, FRI, SAT, SUN], at: h(19, 55), hard: true,
      note: 'Время публикации. Не двигается.',
    },
    {
      title: 'Разбор с ИИ: что получилось и что дальше', replaces: ['Продуктивное: спросить ИИ, что сейчас главное'], cat: 'study', pri: 'mid', est: 15,
      days: [MON, TUE, WED, THU, FRI, SAT, SUN], at: h(20, 35),
      note: 'Одно главное действие на завтра, а не бесконечное планирование.',
      subs: ['Открыть «Что сейчас главное» и прочитать разбор', 'Выбрать одно главное действие на завтра'],
    },
    {
      title: 'Проверить и подготовить ролик «orca»', cat: 'creative', pri: 'high', est: 10,
      days: [MON, TUE, WED, THU, FRI, SAT, SUN], at: h(20, 50),
    },
    {
      title: 'ТТ видео — orca', replaces: ['ТТ видео — orca'], cat: 'creative', pri: 'boss', est: 10,
      days: [MON, TUE, WED, THU, FRI, SAT, SUN], at: h(21), hard: true,
      note: 'Время публикации. Не двигается.',
    },
    {
      title: 'Собрать вещи и записать 3 задачи на завтра', cat: 'home', pri: 'mid', est: 15,
      days: [MON, TUE, WED, THU, FRI, SAT, SUN], at: h(21, 45),
    },
    {
      title: 'Бытовые дела', cat: 'home', pri: 'low', est: 60,
      days: [SUN], atByDay: { [SUN]: h(11) },
    },
    {
      title: 'План на неделю', cat: 'study', pri: 'high', est: 20,
      days: [SUN], atByDay: { [SUN]: h(18, 40) },
      note: 'Двадцать минут внутри вечернего блока — что получилось за неделю и что главное в следующей.',
    },
  ];

  /* ---------- режим дня под этот график ---------- */
  const PROFILE = {
    wakeTarget: h(7), sleepTarget: h(22, 30),
    workStart: h(8), workEnd: h(21, 30),
    sleepGoal: 8.5,
    meals: { breakfast: h(7, 30), lunch: null, dinner: h(17, 40) },
    windDown: 30,          // 22:00–22:30 — сбор вещей и спокойное занятие
  };

  /* установить график: дела в шаблон, режим в профиль */
  function install() {
    const t = DayTpl.tpl();
    let added = 0, updated = 0, disabled = 0;

    PLAN.forEach((x) => {
      const fields = {
        cat: x.cat, pri: x.pri, est: x.est, chill: !!x.chill,
        note: x.note || '', subs: x.subs || [],
        at: x.at === undefined ? null : x.at,
        days: x.days, atByDay: x.atByDay || null,
        hard: !!x.hard,
        on: true,
      };

      /* дело с таким же названием уже есть — не плодим двойника,
         а даём ему расписание по дням */
      const same = t.items.find((i) => i.title === x.title);
      if (same) {
        DayTpl.update(same.id, fields);
        updated += 1;
      } else {
        DayTpl.add({ title: x.title, ...fields });
        added += 1;
      }

      /* дело из стартового набора, которое это заменяет,
         выключаем, а не удаляем: вдруг захочешь вернуть */
      (x.replaces || []).forEach((oldTitle) => {
        if (oldTitle === x.title) return;
        const dup = t.items.find((i) => i.title === oldTitle && i.on);
        if (dup) { DayTpl.update(dup.id, { on: false }); disabled += 1; }
      });
    });
    const p = Track.profile();
    Object.assign(p, PROFILE);
    p.set = true;
    p.weekStudy = true;
    State.commit();
    return { added, updated, disabled, total: added + updated };
  }

  const installed = () => !!Track.profile().weekStudy;

  /* сколько учебных часов сегодня */
  function studyToday() {
    const b = busyToday();
    if (!b.length) return null;
    return { from: b[0].start, to: b[b.length - 1].end, pairs: PAIRS };
  }

  return { PLAN, PROFILE, STUDY, PAIRS, PAIR, GAP, LUNCH, busyFor, busyToday, lunchFor, lunchToday, install, installed, studyToday, WEEKDAYS, WEEKEND };
})();
