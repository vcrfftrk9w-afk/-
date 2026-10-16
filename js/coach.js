'use strict';
/* =========================================================
   COACH — что именно делать внутри блоков графика.

   Тренировка: три тренировки на всё тело (Пн A, Ср B, Пт C) и прогулка
   во Вт/Чт. ВОЗ: силовые на все группы мышц — от 2 дней в неделю,
   плюс 150–300 минут умеренной активности. ACSM для начинающих:
   1–3 подхода по 8–12 повторов, 2–3 раза в неделю. Первые две недели —
   два круга, дальше три. Ведём по шагам: упражнение → отдых с таймером
   → следующее. Думать в процессе не нужно — это важно при СДВГ.

   Готовка: крупная готовка на два дня (Пн, Ср, Пт, Вс), в остальные
   дни — разогреть и свежий салат. Меню чередуется по неделям.
   Тарелка по-гарвардски: половина — овощи, четверть — белок,
   четверть — крупа. Готовое — в холодильник в течение 2 часов,
   хранить 3–4 дня (USDA).

   Продуктивное время с ИИ: разбор дня настоящим ИИ по твоим данным
   и одно главное дело на завтра. Нет ИИ — встроенный разбор.
   ========================================================= */

const Coach = (() => {
  const { $ } = UI;
  const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6, SUN = 0;
  const dowNow = () => new Date().getDay();

  /* =========================================================
     ТРЕНИРОВКИ
     ========================================================= */
  const WARMUP = [
    { t: 'Шаг на месте или лёгкий бег на месте', sec: 120 },
    { t: 'Круги плечами, руками и тазом', sec: 60 },
    { t: '10 медленных приседаний без веса', sec: 45 },
    { t: '10 выпадов назад — по 5 на ногу', sec: 45 },
    { t: 'Кошка-корова на четвереньках', sec: 45 },
  ];
  const COOLDOWN = [
    { t: 'Растяжка передней поверхности бедра — по 30 секунд на ногу', sec: 60 },
    { t: 'Растяжка задней поверхности бедра — по 30 секунд', sec: 60 },
    { t: 'Растяжка груди в дверном проёме', sec: 45 },
    { t: 'Поза ребёнка, медленное дыхание', sec: 60 },
  ];

  const WORKOUTS = {
    A: { name: 'Тренировка A', ex: [
      { t: 'Приседания', reps: '10–15', how: 'Пятки на полу, колени смотрят туда же, куда носки, спина прямая.', easier: 'присед на стул', harder: 'пауза 3 секунды внизу' },
      { t: 'Отжимания', reps: '6–12', how: 'Тело — одна прямая линия, грудь почти до пола.', easier: 'от стола или с колен', harder: 'ноги на стуле' },
      { t: 'Ягодичный мост', reps: '12–15', how: 'Лёжа на спине подними таз, сожми ягодицы, секунда паузы вверху.', easier: 'меньше амплитуда', harder: 'на одной ноге' },
      { t: 'Тяга рюкзака в наклоне', reps: '10–12', how: 'Рюкзак с книгами или бутылками воды. Спина ровная, тяни к поясу.', easier: 'рюкзак легче', harder: 'рюкзак тяжелее' },
      { t: 'Планка', reps: '20–40 с', how: 'Локти под плечами, живот втянут, поясница не провисает.', easier: 'с колен', harder: '+10 секунд' },
    ] },
    B: { name: 'Тренировка B', ex: [
      { t: 'Выпады назад', reps: '8–10 на ногу', how: 'Шаг назад, колено почти касается пола, корпус ровно.', easier: 'держись за стену', harder: 'с рюкзаком' },
      { t: 'Обратные отжимания от стула', reps: '8–12', how: 'Руки на краю стула за спиной, опускайся, сгибая локти до 90°.', easier: 'ноги ближе к стулу', harder: 'ноги прямые' },
      { t: 'Румынская тяга с рюкзаком', reps: '10–12', how: 'Колени чуть согнуты, наклон с прямой спиной, таз назад.', easier: 'без веса', harder: 'на одной ноге' },
      { t: 'Тяга рюкзака одной рукой', reps: '10 на руку', how: 'Упор рукой и коленом в диван, тяни локоть вдоль тела.', easier: 'рюкзак легче', harder: 'пауза 1 секунда вверху' },
      { t: 'Боковая планка', reps: '20 с на сторону', how: 'Локоть под плечом, тело в одну линию.', easier: 'с колена', harder: '+10 секунд' },
      { t: 'Супермен', reps: '12', how: 'Лёжа на животе, подними руки и ноги, задержись на секунду.', easier: 'только руки', harder: 'задержка 3 секунды' },
    ] },
    C: { name: 'Тренировка C', ex: [
      { t: 'Приседания с паузой', reps: '8–12', how: 'Внизу пауза 3 секунды, вверх — быстро.', easier: 'без паузы', harder: 'с рюкзаком' },
      { t: 'Отжимания', reps: 'макс. минус 2', how: 'Остановись за два повтора до отказа — так растёт сила без травм.', easier: 'от стола', harder: 'медленно вниз, 3 секунды' },
      { t: 'Мост на одной ноге', reps: '8–10 на ногу', how: 'Вторая нога поднята, таз ровный.', easier: 'на двух', harder: 'пауза 2 секунды' },
      { t: 'Тяга под столом', reps: '6–10', how: 'Лёжа под крепким столом, возьмись за край и подтягивай грудь. Нет стола — тяга рюкзака.', easier: 'ноги согнуты', harder: 'ноги прямые' },
      { t: 'Скалолаз', reps: '30 с', how: 'Упор лёжа, колени по очереди к груди, в своём темпе.', easier: 'медленно', harder: 'быстрее' },
      { t: 'Мёртвый жук', reps: '8 на сторону', how: 'Лёжа на спине, поясница прижата, тянешь противоположные руку и ногу.', easier: 'только ноги', harder: 'медленнее' },
    ] },
  };
  const TRAIN_BY_DAY = { [MON]: 'A', [WED]: 'B', [FRI]: 'C' };

  const WALK = [
    { t: 'Спокойный шаг — разогреться', sec: 300 },
    { t: 'Быстрая ходьба: говорить можешь, петь — уже нет', sec: 1800, note: 'Это и есть умеренная нагрузка. Можно с музыкой или подкастом на английском.' },
    { t: 'Спокойный шаг — остыть', sec: 300 },
    ...COOLDOWN,
  ];

  function workoutsLog() {
    if (!State.s.workouts || typeof State.s.workouts !== 'object') State.s.workouts = {};
    return State.s.workouts;
  }
  /* сколько силовых уже сделано — от этого зависит число кругов */
  function strengthCount() {
    return Object.values(workoutsLog()).filter((w) => w && w.type && w.type !== 'walk').length;
  }
  const trainingWeek = () => Math.floor(strengthCount() / 3) + 1;
  const roundsNow = () => (trainingWeek() <= 2 ? 2 : 3);
  const typeFor = (dow) => TRAIN_BY_DAY[dow === undefined ? dowNow() : dow] || 'A';

  function trainingSummary(dow) {
    const w = WORKOUTS[typeFor(dow)];
    return `${w.name}: ${w.ex.map((e) => e.t.toLowerCase()).join(', ')} · ${roundsNow()} круга`;
  }

  /* шаги тренировки: разминка → круги → заминка */
  function strengthSteps(type) {
    const w = WORKOUTS[type];
    const rounds = roundsNow();
    const steps = [];
    WARMUP.forEach((x, i) => steps.push({ kind: 'warm', t: x.t, sec: x.sec, label: `Разминка · ${i + 1}/${WARMUP.length}` }));
    for (let r = 1; r <= rounds; r++) {
      w.ex.forEach((e, i) => {
        steps.push({ kind: 'ex', t: e.t, reps: e.reps, how: e.how, easier: e.easier, harder: e.harder,
          label: `Круг ${r} из ${rounds} · упражнение ${i + 1} из ${w.ex.length}` });
        const last = i === w.ex.length - 1;
        if (!(last && r === rounds)) steps.push({ kind: 'rest', t: last ? 'Отдых между кругами' : 'Отдых', sec: last ? 90 : 40 });
      });
    }
    COOLDOWN.forEach((x, i) => steps.push({ kind: 'cool', t: x.t, sec: x.sec, label: `Заминка · ${i + 1}/${COOLDOWN.length}` }));
    return steps;
  }
  function walkSteps() {
    return WALK.map((x, i) => ({ kind: i < 3 ? 'walk' : 'cool', t: x.t, sec: x.sec, how: x.note || '', label: i < 3 ? `Прогулка · ${i + 1}/3` : 'Растяжка' }));
  }

  /* =========================================================
     ГОТОВКА
     ========================================================= */
  const RECIPES = {
    chickenTray: { name: 'Курица с рисом и овощами на противне', emoji: '🍗', min: 40,
      ing: [['Куриные бёдра или филе', 800, 'г'], ['Рис', 300, 'г'], ['Морковь', 2, 'шт'], ['Перец или кабачок', 2, 'шт'], ['Лук', 1, 'шт'], ['Масло растительное', 2, 'ст. л.'], ['Соль, паприка, чеснок', 0, '']],
      steps: [
        { t: 'Духовку — на 200°. Курицу и овощи нарезать крупно, перемешать с маслом и специями' },
        { t: 'Всё на противень и в духовку. Пока печётся — рис: промыть, залить 600 мл воды, варить под крышкой 15 минут', sec: 1500 },
        { t: 'Проверь курицу: сок прозрачный, внутри не розовая' },
        { t: 'По 4 контейнерам: половина — овощи, четверть — курица, четверть — рис' },
        { t: 'Остынет — сразу в холодильник, не позже чем через 2 часа' },
      ] },
    buckwheatMince: { name: 'Гречка с фаршем, морковью и луком', emoji: '🥘', min: 35,
      ing: [['Гречка', 300, 'г'], ['Фарш говяжий или куриный', 600, 'г'], ['Морковь', 2, 'шт'], ['Лук', 2, 'шт'], ['Томатная паста', 2, 'ст. л.'], ['Капуста', 500, 'г'], ['Масло растительное', 2, 'ст. л.']],
      steps: [
        { t: 'Гречку промыть, залить 600 мл воды, варить 15 минут под крышкой', sec: 900 },
        { t: 'Параллельно: лук и морковь мелко — обжарить 5 минут', sec: 300 },
        { t: 'Добавить фарш, разбивать лопаткой, жарить до готовности', sec: 600 },
        { t: 'Томатная паста и полстакана воды — тушить 5 минут', sec: 300 },
        { t: 'Капусту тонко нашинковать, посолить, помять руками, ложка масла — салат на два дня' },
        { t: 'По контейнерам и в холодильник в течение 2 часов' },
      ] },
    bolognese: { name: 'Паста болоньезе с овощами', emoji: '🍝', min: 35,
      ing: [['Макароны (лучше цельнозерновые)', 400, 'г'], ['Фарш', 500, 'г'], ['Томаты протёртые или в собственном соку', 400, 'г'], ['Лук', 1, 'шт'], ['Морковь', 1, 'шт'], ['Чеснок', 2, 'зубчика'], ['Замороженные овощи (брокколи, фасоль)', 400, 'г']],
      steps: [
        { t: 'Воду для макарон — на огонь. Лук, морковь, чеснок мелко — обжарить 5 минут', sec: 300 },
        { t: 'Фарш на сковороду, жарить, разбивая комки', sec: 480 },
        { t: 'Томаты, соль, перец — тушить на слабом огне', sec: 600 },
        { t: 'Макароны в кипящую воду по времени на пачке. За 3 минуты до конца туда же — замороженные овощи', sec: 600 },
        { t: 'Смешать с соусом, разложить по контейнерам' },
      ] },
    pilaf: { name: 'Плов с курицей', emoji: '🍛', min: 55,
      ing: [['Куриные бёдра', 700, 'г'], ['Рис', 400, 'г'], ['Морковь', 3, 'шт'], ['Лук', 2, 'шт'], ['Чеснок', 1, 'головка'], ['Масло растительное', 3, 'ст. л.'], ['Зира, соль', 0, ''], ['Огурцы и помидоры для салата', 600, 'г']],
      steps: [
        { t: 'Курицу кусками обжарить в масле в толстостенной кастрюле', sec: 420 },
        { t: 'Лук полукольцами, потом морковь соломкой — ещё 8 минут', sec: 480 },
        { t: 'Рис промыть до прозрачной воды, выложить ровным слоем. Кипяток на 1,5 см выше риса, соль, зира, чеснок в центр' },
        { t: 'Огонь на минимум, крышку не открывать', sec: 1500 },
        { t: 'Выключить и дать настояться', sec: 600 },
        { t: 'К нему свежий салат — половина тарелки. Остальное — в контейнеры' },
      ] },
    potatoChicken: { name: 'Картофель с курицей в духовке', emoji: '🥔', min: 45,
      ing: [['Картофель', 1000, 'г'], ['Куриные голени или бёдра', 800, 'г'], ['Лук', 1, 'шт'], ['Сметана или йогурт', 3, 'ст. л.'], ['Капуста', 500, 'г'], ['Соль, паприка, чеснок', 0, '']],
      steps: [
        { t: 'Духовку — на 200°. Картофель дольками, курица, лук кольцами, специи, сметана — перемешать в форме' },
        { t: 'Запекать. Пока печётся — капустный салат на два дня', sec: 2100 },
        { t: 'Проверить: картофель мягкий, у курицы прозрачный сок' },
        { t: 'По контейнерам: половину места — салату' },
      ] },
    lentilSoup: { name: 'Чечевичный суп и варёные яйца', emoji: '🍲', min: 35,
      ing: [['Чечевица красная', 300, 'г'], ['Картофель', 3, 'шт'], ['Морковь', 1, 'шт'], ['Лук', 1, 'шт'], ['Томатная паста', 1, 'ст. л.'], ['Яйца', 4, 'шт'], ['Зира, соль', 0, '']],
      steps: [
        { t: '2 литра воды на огонь. Картофель кубиками и чечевицу — в кипящую воду', sec: 1200 },
        { t: 'Параллельно: лук и морковь обжарить 5 минут; сварить 4 яйца — 9 минут', sec: 540 },
        { t: 'Зажарку, томатную пасту и специи — в суп, ещё 5 минут', sec: 300 },
        { t: 'Можно пробить блендером. Яйца — белок к супу, по одному на порцию' },
      ] },
    friedRice: { name: 'Рис с фаршем и овощами на сковороде', emoji: '🍳', min: 30,
      ing: [['Рис', 300, 'г'], ['Фарш куриный', 500, 'г'], ['Замороженная овощная смесь', 400, 'г'], ['Яйца', 3, 'шт'], ['Соевый соус', 3, 'ст. л.'], ['Масло растительное', 2, 'ст. л.']],
      steps: [
        { t: 'Рис: промыть, 600 мл воды, варить под крышкой', sec: 900 },
        { t: 'Параллельно фарш — обжарить, разбивая комки', sec: 480 },
        { t: 'Овощи к фаршу', sec: 300 },
        { t: 'Рис и соевый соус на сковороду, вбить яйца, быстро перемешать', sec: 180 },
        { t: 'По контейнерам и в холодильник в течение 2 часов' },
      ] },
    meatballs: { name: 'Тефтели в томате с гречкой', emoji: '🧆', min: 55,
      ing: [['Фарш', 700, 'г'], ['Яйца', 1, 'шт'], ['Лук', 1, 'шт'], ['Гречка', 300, 'г'], ['Томаты протёртые', 400, 'г'], ['Морковь', 1, 'шт'], ['Огурцы и помидоры для салата', 600, 'г']],
      steps: [
        { t: 'Гречку промыть, 600 мл воды, варить под крышкой', sec: 900 },
        { t: 'Фарш, яйцо, тёртый лук, соль — слепить около 16 тефтелей' },
        { t: 'Обжарить со всех сторон', sec: 360 },
        { t: 'Залить томатами с тёртой морковью, тушить под крышкой', sec: 1200 },
        { t: 'Салат из огурцов и помидоров — половина тарелки' },
      ] },
  };
  const LEFTOVERS = { name: 'Разогреть вчерашнее + свежий салат', emoji: '🥗', min: 15, quick: true,
    ing: [['Огурцы', 2, 'шт'], ['Помидоры', 2, 'шт'], ['Зелень', 1, 'пучок']],
    steps: [
      { t: 'Разогреть вчерашнее до горячего — чтобы пар шёл из середины' },
      { t: 'Салат: огурец, помидор, зелень, соль, ложка масла', sec: 300 },
      { t: 'Половина тарелки — овощи. Остальное время блока — твоё' },
      { t: 'Бонус на 3 минуты: завтрак на завтра — 50 г овсянки, 150 мл молока или кефира, фрукт, в банку и в холодильник' },
    ] };
  const BREAKFAST = [['Яйца', 10, 'шт'], ['Овсянка', 500, 'г'], ['Молоко или кефир', 2, 'л'], ['Бананы или яблоки', 7, 'шт'], ['Хлеб цельнозерновой', 1, 'шт']];

  /* два меню по очереди: одна неделя одно, следующая другое */
  const MENUS = [
    { [MON]: 'chickenTray', [WED]: 'buckwheatMince', [FRI]: 'bolognese', [SUN]: 'pilaf' },
    { [MON]: 'potatoChicken', [WED]: 'lentilSoup', [FRI]: 'friedRice', [SUN]: 'meatballs' },
  ];
  function mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }
  function weekIndex(d) {
    const base = new Date(2024, 0, 1);   // понедельник
    return Math.round((mondayOf(d || new Date()) - base) / (7 * 86400000));
  }
  const menuFor = (wi) => MENUS[((wi % 2) + 2) % 2];
  function recipeFor(dow, wi) {
    const d = dow === undefined ? dowNow() : dow;
    const key = menuFor(wi === undefined ? weekIndex() : wi)[d];
    return key ? { key, ...RECIPES[key] } : { key: 'leftovers', ...LEFTOVERS };
  }
  function cookSummary(dow) {
    const r = recipeFor(dow);
    return r.quick ? 'Сегодня без большой готовки: разогреть вчерашнее и салат — 15 минут'
      : `Сегодня: ${r.name} — на два дня, около ${r.min} минут`;
  }

  const UNIT_FORMS = { 'пучок': ['пучок', 'пучка', 'пучков'], 'головка': ['головка', 'головки', 'головок'], 'зубчика': ['зубчик', 'зубчика', 'зубчиков'] };
  function qtyLabel(q, unit) {
    if (unit === 'г' && q >= 1000) return `${String(q / 1000).replace('.', ',')} кг`;
    const f = UNIT_FORMS[unit];
    return f ? UI.plur(q, f[0], f[1], f[2]) : `${q} ${unit}`;
  }

  /* список покупок на неделю. В воскресенье — уже на следующую */
  function shopWeek() { return weekIndex() + (dowNow() === SUN ? 1 : 0); }
  function shopList(wi) {
    const menu = menuFor(wi);
    const sum = new Map();
    const add = ([name, qty, unit]) => {
      const k = name + '|' + unit;
      const cur = sum.get(k) || { name, qty: 0, unit };
      cur.qty += qty;
      sum.set(k, cur);
    };
    Object.values(menu).forEach((key) => RECIPES[key].ing.forEach(add));
    for (let i = 0; i < 3; i++) LEFTOVERS.ing.forEach(add);     // Вт, Чт, Сб
    BREAKFAST.forEach(add);
    return Array.from(sum.values()).map((x) => ({
      ...x,
      label: x.qty ? `${x.name} — ${qtyLabel(x.qty, x.unit)}` : `${x.name} — по вкусу`,
    })).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }
  function shopState() {
    const wi = shopWeek();
    if (!State.s.shop || State.s.shop.week !== wi) State.s.shop = { week: wi, got: {} };
    return State.s.shop;
  }

  /* =========================================================
     ПОШАГОВЫЙ РЕЖИМ (тренировка и готовка)
     ========================================================= */
  let run = null;        // { steps, i, endsAt, timer, started, kind, block, title }

  function stopRun() {
    if (run && run.timer) clearInterval(run.timer);
    run = null;
    if (typeof Awake !== 'undefined') Awake.release('coach');
    const body = $('#sheet-body');
    if (body) body.onclick = null;
  }
  const sheetOpen = () => { const m = $('#sheet-modal'); return m && !m.classList.contains('hidden') && m.classList.contains('modal-open'); };
  const mmss = (s) => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  /* ---------- голос: говорит, что делать, — не надо смотреть в экран ---------- */
  const voiceOn = () => State.s.voice !== false;
  function say(text) {
    if (!voiceOn() || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(String(text).replace(/[«»]/g, '').replace(/\s*·\s*/g, '. '));
      u.lang = 'ru-RU'; u.rate = 1.05;
      const v = speechSynthesis.getVoices().find((x) => /^ru/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* нет голоса — есть звук и экран */ }
  }
  function stepSpeech(st) {
    if (st.kind === 'rest') return `${st.t}. ${Math.round(st.sec)} секунд.`;
    let t = st.t;
    if (st.reps) t += `. ${st.reps.replace('–', ' до ')}`;
    if (st.sec && st.kind !== 'rest') t += `. ${st.sec >= 60 ? Math.round(st.sec / 60) + ' минут' : st.sec + ' секунд'}`;
    return t;
  }

  function startRun(kind, steps, title, block, onDone) {
    stopRun();
    run = { kind, steps, i: 0, endsAt: 0, timer: null, started: Date.now(), block, title, paused: false, onDone };
    // тренировка с таймером: экран не гаснет, иначе таймер и голос замирают
    if (typeof Awake !== 'undefined') Awake.hold('coach');
    // старт — это событие: звук, вибрация и голос, как у тренера
    Sound.sfx('fanfare');
    FX.vibrate([60, 40, 120]);
    say(`Начинаем: ${title}. ${stepSpeech(steps[0])}`);
    run.spoken = 0;
    renderRun();
    run.timer = setInterval(tickRun, 250);
  }

  function renderRun() {
    if (!run) return;
    const st = run.steps[run.i];
    const next = run.steps[run.i + 1];
    const timed = !!st.sec;
    if (timed && !run.endsAt) run.endsAt = Date.now() + st.sec * 1000;
    const pct = Math.round((run.i / run.steps.length) * 100);
    const left = timed ? (run.endsAt - Date.now()) / 1000 : 0;
    const body = UI.sheet(`
      <div class="run run-${st.kind}">
        <div class="run-top"><span>${UI.esc(run.title)} · шаг ${run.i + 1} из ${run.steps.length}</span>
          <span class="run-top-btns"><button class="linkbtn" data-run="voice" aria-label="Голос">${voiceOn() ? '🔊' : '🔇'}</button>
          <button class="linkbtn" data-run="stop">Закончить</button></span></div>
        <div class="run-bar"><span style="width:${pct}%"></span></div>
        ${st.label ? `<div class="run-label">${UI.esc(st.label)}</div>` : ''}
        <h2 class="run-title">${UI.esc(st.t)}</h2>
        ${timed
          ? `<div class="run-clock ${st.kind === 'rest' ? 'rest' : ''}" style="--p:1"><b id="run-left">${mmss(left)}</b></div>`
          : (st.reps ? `<div class="run-reps">${UI.esc(st.reps)}</div>` : '')}
        ${st.how ? `<p class="run-how">${UI.esc(st.how)}</p>` : ''}
        ${st.easier ? `<p class="run-alt">Тяжело — ${UI.esc(st.easier)}. Легко — ${UI.esc(st.harder)}.</p>` : ''}
        ${next ? `<div class="run-next">Дальше: ${UI.esc(next.t)}${next.sec ? ` · ${mmss(next.sec)}` : ''}</div>` : '<div class="run-next">Это последний шаг</div>'}
        <div class="run-actions">
          ${timed
            ? `<button class="btn btn-ghost" data-run="pause">${run.paused ? '▶ Продолжить' : '⏸ Пауза'}</button>
               <button class="btn btn-primary" data-run="next">${st.kind === 'rest' ? 'Готов раньше →' : 'Дальше →'}</button>`
            : `<button class="btn btn-primary btn-lg btn-block" data-run="next">✓ Сделал</button>`}
        </div>
      </div>`);
    body.onclick = (e) => {
      const a = e.target.closest('[data-run]');
      if (!a || !run) return;
      const k = a.dataset.run;
      if (k === 'stop') { finishRun(run.i >= run.steps.length * 0.6); return; }
      if (k === 'voice') { State.s.voice = !voiceOn(); State.save(); if (!voiceOn() && window.speechSynthesis) speechSynthesis.cancel(); renderRun(); return; }
      if (k === 'pause') {
        if (run.paused) { run.endsAt = Date.now() + run.pausedLeft; run.paused = false; }
        else { run.pausedLeft = run.endsAt - Date.now(); run.paused = true; }
        renderRun(); return;
      }
      if (k === 'next') nextStep();
    };
  }

  function tickRun() {
    if (!run) return;
    if (!sheetOpen()) { stopRun(); return; }     // закрыли окно — таймер не тикает в пустоту
    const st = run.steps[run.i];
    if (!st.sec || run.paused) return;
    const left = (run.endsAt - Date.now()) / 1000;
    const el = $('#run-left');
    if (el) {
      el.textContent = mmss(left);
      const clock = el.parentElement;
      clock.style.setProperty('--p', Math.max(0, Math.min(1, left / st.sec)).toFixed(3));
      clock.classList.toggle('hurry', left <= 5);
    }
    if (left <= 3.2 && left > 0 && run.beeped !== run.i + ':' + Math.ceil(left)) {
      run.beeped = run.i + ':' + Math.ceil(left);
      Sound.sfx('tick');
    }
    if (left <= 0) {
      Sound.sfx(st.kind === 'rest' ? 'start' : 'tick');
      FX.vibrate(st.kind === 'rest' ? [60, 40, 60] : 40);
      nextStep();
    }
  }

  function nextStep() {
    if (!run) return;
    Sound.sfx('check');
    run.i += 1;
    run.endsAt = 0;
    run.paused = false;
    if (run.i >= run.steps.length) { finishRun(true); return; }
    say(stepSpeech(run.steps[run.i]));
    renderRun();
  }

  function finishRun(complete) {
    if (!run) return;
    const r = run;
    stopRun();
    const minutes = Math.max(1, Math.round((Date.now() - r.started) / 60000));
    if (!complete) {
      UI.closeModal('#sheet-modal');
      UI.toast(`Остановились на шаге ${r.i + 1}. Даже часть — лучше, чем ничего.`, 'default', '👍');
      if (r.kind === 'train' || r.kind === 'walk') Track.workout(minutes, true);
      return;
    }
    if (r.kind === 'train' || r.kind === 'walk') {
      workoutsLog()[State.todayKey()] = { type: r.kind === 'walk' ? 'walk' : typeFor(), at: Date.now(), minutes };
      Track.workout(Math.max(minutes, r.kind === 'walk' ? 30 : 20), true);
    }
    if (r.onDone) { try { r.onDone(); } catch (e) { /* засчитать не вышло — но сессия пройдена */ } }
    else completeTask(r.block, r.kind);
    say(r.kind === 'train' ? 'Тренировка сделана. Красавчик.' : 'Готово. Отличная работа.');
    Sound.sfx('fanfare');
    FX.fireworks(3);
    const body = UI.sheet(`
      <div class="run-done">
        <div class="demand-emoji">${r.kind === 'cook' ? '🍽️' : '🏆'}</div>
        <h2>${r.kind === 'cook' ? 'Еда на два дня готова' : r.kind === 'walk' ? 'Прогулка засчитана' : r.kind === 'train' ? 'Тренировка сделана' : `Сделано: ${UI.esc(r.title)}`}</h2>
        <p class="muted">${r.kind === 'cook'
          ? 'Остынет — сразу в холодильник. Завтра готовить не нужно — освободившееся время твоё.'
          : (r.kind === 'train' || r.kind === 'walk')
            ? `${minutes} мин движения. Силовых всего: ${strengthCount()}. ${trainingWeek() <= 2 ? 'Первые две недели — два круга, потом станет три.' : 'Когда во всех подходах выходит верх диапазона — бери вариант потяжелее.'}`
            : `${minutes} мин. Одно дело закрыто — следующее уже ждёт на главной.`}</p>
        <button class="btn btn-primary btn-lg btn-block" id="run-ok">Отлично</button>
      </div>`);
    body.querySelector('#run-ok').onclick = () => UI.closeModal('#sheet-modal');
  }

  /* отметить дело из графика — если оно есть и ещё не закрыто */
  function completeTask(block, kind) {
    const title = block ? (block.taskTitle || block.task || block.title) : TITLES[kind];
    const t = (block && block.taskId && State.s.tasks.find((x) => x.id === block.taskId && !x.done))
      || State.s.tasks.find((x) => x.title === title && !x.done);
    if (t) Screens.tasks.complete(t, document.body);
    else State.commit();
  }

  /* =========================================================
     ЭКРАНЫ
     ========================================================= */
  const TITLES = { train: 'Тренировка', walk: 'Прогулка и восстановление', cook: 'Готовка', ai: 'Разбор с ИИ: что получилось и что дальше', shop: 'Бытовые дела' };

  function kindFor(b) {
    if (!b) return null;
    const title = b.taskTitle || b.task || b.title || '';
    if (title === 'Тренировка' || /^Тренировк/i.test(title)) return 'train';
    if (title === 'Прогулка и восстановление') return 'walk';
    if (title === 'Готовка' || /^Готовк/i.test(title)) return 'cook';
    if (title === TITLES.ai || /Разбор с ИИ|спросить ИИ/i.test(title)) return 'ai';
    if (title === 'Бытовые дела') return 'shop';
    if (SESSIONS[title]) return 'session';
    return null;
  }

  /* ---------- сессии для остальных главных дел ---------- */
  const PUBLISH = (name, at) => [
    { t: `Открой TikTok и загрузи ролик «${name}»`, label: 'Шаг 1 · загрузка' },
    { t: 'Подпись: одна фраза-крючок и 3–5 хэштегов', sec: 120, label: 'Шаг 2 · подпись' },
    { t: 'Обложка — самый яркий кадр', label: 'Шаг 3 · обложка' },
    { t: `Опубликовать — ровно в ${at}`, label: 'Шаг 4 · публикация' },
    { t: 'Через 10 минут ответь на первые комментарии', label: 'Бонус' },
  ];
  const SESSIONS = {
    'Английский': [
      { t: 'Повторить слова', sec: 600, how: 'Карточки или список — вслух, не глазами.', label: 'Шаг 1 из 3 · слова' },
      { t: 'Послушать или почитать', sec: 900, how: 'Подкаст, видео с субтитрами или короткий текст.', label: 'Шаг 2 из 3 · вход' },
      { t: 'Сказать или написать вслух', sec: 900, how: 'Расскажи о своём дне или напиши 5 предложений.', label: 'Шаг 3 из 3 · речь' },
    ],
    'ТТ видео — кино': PUBLISH('кино', '19:55'),
    'ТТ видео — orca': PUBLISH('orca', '21:00'),
    'Работа над заработком': [
      { t: 'Найти 3 конкретных предложения', sec: 900, how: 'Заказы, вакансии, объявления — с ценой.', label: 'Шаг 1 из 4' },
      { t: 'Написать одному заказчику', sec: 600, how: 'Коротко: что умеешь, пример работы, цена.', label: 'Шаг 2 из 4' },
      { t: 'Сделать или доделать пример работы', sec: 1200, label: 'Шаг 3 из 4' },
      { t: 'Записать вывод: что пробую дальше', label: 'Шаг 4 из 4' },
    ],
    'YouTube': [
      { t: 'Открой проект: съёмка или монтаж', label: 'Шаг 1 из 3' },
      { t: 'Работаешь над роликом', sec: 1500, how: 'Телефон — в режим «не беспокоить».', label: 'Шаг 2 из 3 · 25 минут' },
      { t: 'Сохрани и запиши, что делать дальше', label: 'Шаг 3 из 3' },
    ],
    'OLX: объявления и обмены': [
      { t: 'Ответь на все сообщения', sec: 600, label: 'Шаг 1 из 3' },
      { t: 'Сфотографируй одну вещь при дневном свете', label: 'Шаг 2 из 3' },
      { t: 'Выложи объявление: цена чуть ниже рынка', sec: 600, label: 'Шаг 3 из 3' },
    ],
    'Смонтировать два ролика: кино и orca': [
      { t: 'Ролик «кино»: нарезка и текст', sec: 1200, label: 'Шаг 1 из 3' },
      { t: 'Ролик «orca»: нарезка и текст', sec: 1200, label: 'Шаг 2 из 3' },
      { t: 'Экспорт обоих — и в папку «к публикации»', label: 'Шаг 3 из 3' },
    ],
  };
  function openSession(b) {
    const title = b.taskTitle || b.task || b.title;
    const steps = SESSIONS[title].map((x) => ({ kind: 'task', ...x }));
    startRun('session', steps, title, b);
  }

  function noteFor(b) {
    const k = kindFor(b);
    if (k === 'train') return trainingSummary();
    if (k === 'walk') return '30 минут быстрым шагом + 5 минут растяжки. Нажми СТАРТ — поведу по шагам.';
    if (k === 'cook') return cookSummary();
    if (k === 'ai') return 'ИИ разберёт твой день по цифрам и назовёт одно главное дело на завтра.';
    if (k === 'shop') return 'Заодно — покупки на неделю по готовому списку.';
    return '';
  }

  function start(b, opts) {
    const k = kindFor(b);
    const direct = opts && opts.direct;
    // с главной — сразу в дело, без лишнего окна: меньше шагов до старта
    if (k === 'train' && direct) { const type = typeFor(); startRun('train', strengthSteps(type), WORKOUTS[type].name, b); return true; }
    if (k === 'walk' && direct) { startRun('walk', walkSteps(), 'Прогулка', b); return true; }
    if (k === 'train') { openTraining(b); return true; }
    if (k === 'walk') { openWalk(b); return true; }
    if (k === 'cook') { openCook(b); return true; }
    if (k === 'ai') { openAI(b); return true; }
    if (k === 'shop') { openShop(); return true; }
    if (k === 'session') { openSession(b); return true; }
    return false;
  }

  function openTraining(b) {
    const type = typeFor();
    const w = WORKOUTS[type];
    const body = UI.sheet(`
      <div class="coach-sheet">
        <div class="why-tag">Неделя тренировок ${trainingWeek()} · ${roundsNow()} круга · около 35 минут</div>
        <h2>💪 ${w.name} — всё тело</h2>
        <p class="muted small">Дома, без зала: нужен коврик и рюкзак с книгами или бутылками. Между упражнениями 40 секунд отдыха, между кругами — полторы минуты. Каждый подход заканчивай за 1–2 повтора до отказа.</p>
        <ol class="coach-list">
          <li><b>Разминка</b><small>5 минут — поведу по таймеру</small></li>
          ${w.ex.map((e) => `<li><b>${UI.esc(e.t)}</b><small>${UI.esc(e.reps)} · легче: ${UI.esc(e.easier)}</small></li>`).join('')}
          <li><b>Растяжка</b><small>4 минуты</small></li>
        </ol>
        <p class="coach-src">Три раза в неделю на всё тело и прогулки во вторник и четверг — это норма ВОЗ: силовые от 2 дней в неделю и 150+ минут умеренной активности.</p>
        <button class="btn btn-primary btn-lg btn-block" id="co-go">▶ Начать по шагам</button>
      </div>`, { wide: true });
    body.querySelector('#co-go').onclick = () => startRun('train', strengthSteps(type), w.name, b);
  }

  function openWalk(b) {
    const body = UI.sheet(`
      <div class="coach-sheet">
        <div class="why-tag">45 минут · восстановление</div>
        <h2>🚶 Прогулка и восстановление</h2>
        <p class="muted small">Темп — такой, что говорить можешь, а петь уже нет. Это умеренная нагрузка — она и нужна. Хорошее время для подкаста на английском.</p>
        <ol class="coach-list">
          <li><b>5 минут спокойно</b><small>разогреться</small></li>
          <li><b>30 минут быстро</b><small>по таймеру, я скажу, когда хватит</small></li>
          <li><b>5 минут спокойно и растяжка</b><small>ноги, грудь, спина</small></li>
        </ol>
        <button class="btn btn-primary btn-lg btn-block" id="co-go">▶ Пошёл</button>
      </div>`, { wide: true });
    body.querySelector('#co-go').onclick = () => startRun('walk', walkSteps(), 'Прогулка', b);
  }

  function recipeHTML(r) {
    return `
      <div class="recipe">
        <div class="recipe-head"><span class="recipe-emoji">${r.emoji}</span>
          <div><h3>${UI.esc(r.name)}</h3><small>${r.quick ? '15 минут' : `около ${r.min} минут · 4 порции — на два дня`}</small></div></div>
        <div class="recipe-cols">
          <div><b>Нужно</b><ul>${r.ing.map(([n, q, u]) => `<li>${UI.esc(n)}${q ? ` — ${qtyLabel(q, u)}` : ''}</li>`).join('')}</ul></div>
          <div><b>Шаги</b><ol>${r.steps.map((s) => `<li>${UI.esc(s.t)}${s.sec ? ` <i>⏱ ${Math.round(s.sec / 60)} мин</i>` : ''}</li>`).join('')}</ol></div>
        </div>
      </div>`;
  }

  function openCook(b) {
    const r = recipeFor();
    const tomorrow = recipeFor((dowNow() + 1) % 7);
    const body = UI.sheet(`
      <div class="coach-sheet">
        <div class="why-tag">${r.quick ? 'День без большой готовки' : 'Большая готовка — на сегодня и завтра'}</div>
        ${recipeHTML(r)}
        <p class="coach-src">Тарелка: половина — овощи, четверть — белок, четверть — крупа или макароны. Готовое — в холодильник в течение 2 часов, хранить 3–4 дня.</p>
        <p class="muted small">Завтра: ${tomorrow.quick ? 'разогреть и салат' : UI.esc(tomorrow.name)}.</p>
        <div class="row wrap">
          <button class="btn btn-primary btn-lg" id="co-go">▶ Готовить по шагам</button>
          <button class="btn btn-ghost" id="co-shop">🛒 Список покупок</button>
        </div>
      </div>`, { wide: true });
    body.querySelector('#co-go').onclick = () => startRun('cook', r.steps.map((s, i) => ({ kind: 'cook', t: s.t, sec: s.sec || 0, label: `Шаг ${i + 1} из ${r.steps.length}` })), r.name, b);
    body.querySelector('#co-shop').onclick = () => { UI.closeModal('#sheet-modal'); setTimeout(openShop, 220); };
  }

  function openShop() {
    const st = shopState();
    const wi = shopWeek();
    const list = shopList(wi);
    const menu = menuFor(wi);
    const dayName = { [MON]: 'Пн', [WED]: 'Ср', [FRI]: 'Пт', [SUN]: 'Вс' };
    const got = list.filter((x) => st.got[x.name + '|' + x.unit]).length;
    const body = UI.sheet(`
      <div class="coach-sheet">
        <div class="why-tag">Покупки на неделю · ${got}/${list.length}</div>
        <h2>🛒 Список покупок</h2>
        <p class="muted small">Меню недели: ${[MON, WED, FRI, SUN].map((d) => `${dayName[d]} — ${UI.esc(RECIPES[menu[d]].name.toLowerCase())}`).join('; ')}. Плюс салаты и завтраки. Удобно купить в воскресенье в блок «Бытовые дела».</p>
        <ul class="shop-list">
          ${list.map((x) => {
            const k = x.name + '|' + x.unit;
            return `<li><label><input type="checkbox" data-shop="${UI.esc(k)}" ${st.got[k] ? 'checked' : ''}><span>${UI.esc(x.label)}</span></label></li>`;
          }).join('')}
        </ul>
        <button class="btn btn-ghost btn-block" id="shop-reset">Очистить отметки</button>
      </div>`, { wide: true });
    // окно одно на всё приложение — обработчик ставим свойством, чтобы не копились
    body.onchange = (e) => {
      const cb = e.target.closest('[data-shop]');
      if (!cb) return;
      if (cb.checked) st.got[cb.dataset.shop] = 1; else delete st.got[cb.dataset.shop];
      State.save();
      const tag = body.querySelector('.why-tag');
      if (tag) tag.textContent = `Покупки на неделю · ${list.filter((x) => st.got[x.name + '|' + x.unit]).length}/${list.length}`;
      Sound.sfx('pop');
    };
    body.querySelector('#shop-reset').onclick = () => { st.got = {}; State.save(); UI.closeModal('#sheet-modal'); setTimeout(openShop, 220); };
  }

  /* =========================================================
     ПРОДУКТИВНОЕ ВРЕМЯ С ИИ
     ========================================================= */
  let samplePromise = null;
  function getSample() {
    if (!samplePromise) {
      samplePromise = (async () => {
        try {
          if (typeof window === 'undefined' || !window.claude || typeof window.claude.use !== 'function') return null;
          return await Promise.race([window.claude.use('sample'), new Promise((r) => setTimeout(() => r(null), 12000))]);
        } catch (e) { return null; }
      })();
    }
    return samplePromise;
  }
  let aiBlocked = false;          // человек отказал — больше не спрашиваем в этой сессии

  function tomorrowKey() { const d = new Date(); d.setDate(d.getDate() + 1); return State.dateKey(d); }

  /* всё, что ИИ нужно знать о дне, — коротко и цифрами */
  function digest() {
    const s = State.s;
    const now = Track.nowMin();
    const dow = dowNow();
    const lines = [];
    const d = Track.today();
    lines.push(`Сейчас: ${Week.DAY_NAMES[dow].toLowerCase()}, ${Track.hhmm(now)}.`);
    lines.push(d.wakeAt !== null ? `Встал в ${Track.hhmm(d.wakeAt)} (цель ${Track.hhmm(Track.profile().wakeTarget)}).` : 'Подъём не отмечен.');
    const pl = Planner.plan();
    if (pl) {
      const sk = pl.skipped || {};
      lines.push('Дела сегодня по графику (✓ сделано, ✗ пропущено, … впереди):');
      pl.blocks.filter((b) => b.kind === 'task').forEach((b) => {
        const mark = Planner.isDone(b) ? '✓' : (b.end <= now || sk[b.id] ? '✗' : '…');
        lines.push(`${mark} ${Track.hhmm(b.start)} ${b.taskTitle || b.title}`);
      });
    }
    const focus = s.dailyFocusMinutes[State.todayKey()] || 0;
    lines.push(`Фокус-таймер сегодня: ${focus} мин. Вода: ${d.water || 0}/${Track.profile().waterGoal}. Режим дня: ${Track.score().value}/100.`);
    const chains = DayTpl.items().filter((x) => x.on).map((x) => [x.title, State.chain(x.title)]).filter((x) => x[1] >= 2);
    if (chains.length) lines.push('Серии: ' + chains.map(([t, n]) => `${t} — ${n} дн.`).join('; ') + '.');
    const goal = (s.goals || []).find((g) => !g.done);
    if (goal) lines.push(`Главная цель: «${goal.title}».`);
    if (typeof Path !== 'undefined') {
      const n = Path.nextStep();
      if (n) lines.push(`Путь к деньгам: этап «${n.stage.name}», следующий шаг — «${n.step.t}».`);
    }
    const log = (s.aiLog || []).slice(-3);
    log.forEach((x) => {
      const done = State.doneTitlesOn(x.for || '').has(x.what) || s.tasks.some((t) => t.title === x.what && t.done);
      lines.push(`Раньше ИИ советовал на ${x.for}: «${x.what}» — ${done ? 'сделано' : 'не сделано'}.`);
    });
    const tdow = (dow + 1) % 7;
    const tm = Week.scriptFor(tdow);
    const tasks = tm.filter((b) => b.kind === 'task').map((b) => `${Track.hhmm(b.start)} ${b.task}`);
    const pairs = tm.filter((b) => b.kind === 'pair');
    const free = tm.filter((b) => b.kind === 'rest' && b.end - b.start >= 20).map((b) => `${Track.hhmm(b.start)}–${Track.hhmm(b.end)}`);
    lines.push(`Завтра (${Week.DAY_NAMES[tdow].toLowerCase()}): ${pairs.length ? `пары ${Track.hhmm(pairs[0].start)}–${Track.hhmm(pairs[pairs.length - 1].end)}; ` : ''}${tasks.join(', ')}.`);
    if (free.length) lines.push(`Свободное время завтра: ${free.join(', ')}.`);
    return lines.join('\n');
  }

  const RULES = `Ты — личный коуч по продуктивности для парня с СДВГ. Он учится (пары по будням), ведёт два TikTok-канала («кино» и «orca», публикации в 19:55 и 21:00), YouTube, учит английский, ищет заработок, продаёт вещи на OLX, тренируется и готовит. Говори на «ты», по-русски, коротко и конкретно. Без морали, без общих советов, без «важно помнить». Опирайся только на данные.`;

  function prompt() {
    return `${RULES}

ДАННЫЕ:
${digest()}

Разбери день и выбери ОДНО главное дело на завтра — то, что сильнее всего двигает к деньгам и цели, с учётом того, что сегодня получилось и что нет.
Ответь только JSON такого вида:
{"summary":"1–2 предложения: что получилось сегодня, с цифрами","blocker":"1 предложение: что, судя по данным, мешало","main":{"what":"одно действие на завтра, до 70 символов, начинается с глагола","when":"ЧЧ:ММ — лучшее время завтра по его графику","first":"первое физическое движение на 2 минуты","why":"как это приближает к цели, 1 предложение"},"tip":"один конкретный приём на завтра против того, что мешало"}`;
  }

  const AI_ERR = {
    not_granted: 'Ты не разрешил приложению обращаться к ИИ. Ниже — встроенный разбор без ИИ.',
    sampling_disabled: 'ИИ недоступен для этого аккаунта. Ниже — встроенный разбор.',
    rate_limited: 'Слишком много запросов — попробуй через несколько минут.',
    session_expired: 'Нужно заново войти в Claude.',
    refused: 'ИИ не стал отвечать на этот запрос. Попробуй переформулировать.',
    invalid_json: 'ИИ ответил не в том формате. Нажми «Ещё раз».',
  };

  function fallbackHTML(reason) {
    // без ИИ: самое тяжёлое дело завтрашнего графика и его первый шаг
    const tdow = (dowNow() + 1) % 7;
    const tm = Week.scriptFor(tdow).filter((b) => b.kind === 'task');
    const pick = tm.find((b) => b.task === 'Работа над заработком') || tm[0];
    const plan = pick && Week.PLAN.find((p) => p.title === pick.task);
    return `
      <div class="ai-fallback">
        <p class="muted small">${UI.esc(reason)}</p>
        ${pick ? `<div class="ai-main"><small>Главное завтра — встроенный выбор</small><b>${UI.esc(pick.task)}</b><span>в ${Track.hhmm(pick.start)}${plan && plan.subs && plan.subs[0] ? ` · первый шаг: ${UI.esc(plan.subs[0].toLowerCase())}` : ''}</span></div>` : ''}
        <button class="btn btn-ghost btn-block" id="ai-verdict">🧠 Что главное прямо сейчас</button>
      </div>`;
  }

  function resultHTML(r) {
    const m = r.main || {};
    return `
      <div class="ai-result">
        ${r.summary ? `<p><b>Итог дня.</b> ${UI.esc(String(r.summary))}</p>` : ''}
        ${r.blocker ? `<p><b>Что мешало.</b> ${UI.esc(String(r.blocker))}</p>` : ''}
        ${m.what ? `<div class="ai-main"><small>Главное завтра${m.when ? ` · ${UI.esc(String(m.when))}` : ''}</small><b>${UI.esc(String(m.what))}</b>
          ${m.first ? `<span>Первые 2 минуты: ${UI.esc(String(m.first))}</span>` : ''}
          ${m.why ? `<span>Зачем: ${UI.esc(String(m.why))}</span>` : ''}</div>` : ''}
        ${r.tip ? `<p><b>Приём на завтра.</b> ${UI.esc(String(r.tip))}</p>` : ''}
        <div class="row wrap">
          ${m.what ? '<button class="btn btn-primary" id="ai-plan">📌 Поставить на завтра</button>' : ''}
          <button class="btn btn-ghost" id="ai-again">↻ Ещё раз</button>
        </div>
      </div>`;
  }

  function openAI(b) {
    const body = UI.sheet(`
      <div class="coach-sheet ai-sheet">
        <div class="why-tag">Продуктивное время · 15 минут</div>
        <h2>🤖 Разбор дня с ИИ</h2>
        <p class="muted small">ИИ видит только цифры твоего дня: что сделано, что пропущено, серии, цель и завтрашний график. Ответ — одно главное дело на завтра, а не бесконечный план.</p>
        <div id="ai-out"><button class="btn btn-primary btn-lg btn-block" id="ai-run">🤖 Разобрать мой день</button></div>
        <div class="ai-chat" id="ai-chat"></div>
        <form class="ai-ask" id="ai-ask">
          <input id="ai-q" type="text" maxlength="400" placeholder="Спроси своё: что главное сейчас? как не слить вечер?" autocomplete="off">
          <button class="btn btn-accent" type="submit">Спросить</button>
        </form>
      </div>`, { wide: true });
    const out = body.querySelector('#ai-out');
    const turns = [];
    let busy = false;

    const bindOut = (res) => {
      const plan = out.querySelector('#ai-plan');
      if (plan) plan.onclick = () => planTomorrow(res, b);
      const again = out.querySelector('#ai-again');
      if (again) again.onclick = () => run(true);
      const v = out.querySelector('#ai-verdict');
      if (v) v.onclick = () => { UI.closeModal('#sheet-modal'); setTimeout(() => Verdict.open(), 220); };
    };

    async function run(fresh) {
      if (busy) return;
      busy = true;
      out.innerHTML = '<div class="ai-think"><span class="dots"><i></i><i></i><i></i></span> Думаю над твоим днём… это 10–40 секунд</div>';
      const sample = aiBlocked ? null : await getSample();
      if (!sample) {
        out.innerHTML = fallbackHTML('ИИ работает, когда приложение открыто в Claude. Здесь его нет — вот встроенный разбор.');
        bindOut(null); busy = false; return;
      }
      try {
        const res = await sample.json(prompt(), fresh ? { cache: false } : {});
        if (!res || typeof res !== 'object') throw { code: 'invalid_json' };
        State.s.totals.aiReviews = (State.s.totals.aiReviews || 0) + 1;
        out.innerHTML = resultHTML(res);
        bindOut(res);
        Sound.sfx('success');
      } catch (e) {
        const code = e && e.code;
        if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') {
          aiBlocked = true;
          out.innerHTML = fallbackHTML(AI_ERR[code] || 'ИИ недоступен. Вот встроенный разбор.');
        } else if (code !== 'cancelled') {
          out.innerHTML = `<p class="muted small">${UI.esc(AI_ERR[code] || 'Не получилось связаться с ИИ.')}</p><button class="btn btn-primary btn-block" id="ai-again">↻ Ещё раз</button>`;
        }
        bindOut(null);
      } finally { busy = false; }
    }

    body.querySelector('#ai-run').onclick = () => run(false);
    body.querySelector('#ai-ask').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = body.querySelector('#ai-q');
      const q = input.value.trim();
      if (!q || busy) return;
      input.value = '';
      const chat = body.querySelector('#ai-chat');
      const me = document.createElement('div'); me.className = 'ai-bubble me'; me.textContent = q; chat.appendChild(me);
      const bot = document.createElement('div'); bot.className = 'ai-bubble bot'; bot.textContent = 'Думаю…'; chat.appendChild(bot);
      const sample = aiBlocked ? null : await getSample();
      if (!sample) { bot.textContent = 'ИИ здесь недоступен — он работает, когда приложение открыто в Claude.'; return; }
      busy = true;
      turns.push({ role: 'user', content: q });
      try {
        const lead = { role: 'user', content: `${RULES}\nОтвечай до 6 коротких строк, с одним конкретным следующим шагом.\n\nДАННЫЕ О ДНЕ:\n${digest()}` };
        const { text } = await sample([lead, ...turns.slice(-8)], { cache: false, onText: ({ text: t }) => { bot.textContent = t; } });
        turns.push({ role: 'assistant', content: text });
      } catch (err) {
        turns.pop();
        bot.textContent = (err && err.text) || AI_ERR[err && err.code] || 'Не получилось. Попробуй ещё раз.';
        if (err && (err.code === 'not_granted' || err.code === 'sampling_disabled')) aiBlocked = true;
      } finally { busy = false; }
    });
  }

  /* главное дело от ИИ — задачей на завтра; планировщик сам найдёт ему место */
  function planTomorrow(res, block) {
    const m = res.main;
    const title = String(m.what).slice(0, 80);
    const key = tomorrowKey();
    if (!State.s.tasks.some((t) => t.title === title && !t.done)) {
      Screens.tasks.add(title, /заработ|деньг|заказ|клиент|olx|прода/i.test(title) ? 'money' : 'work', 'boss', false, { due: key, silent: true });
      const t = State.s.tasks[0];
      if (t && t.title === title && m.first) t.subtasks = [{ id: State.uid(), text: String(m.first).slice(0, 120), done: false }];
    }
    State.s.aiLog = (State.s.aiLog || []).concat({ date: State.todayKey(), for: key, what: title }).slice(-14);
    completeTask(block, 'ai');
    UI.closeModal('#sheet-modal');
    UI.toast(`Завтра главное: «${title}». Встанет в свободное время графика.`, 'level', '📌');
  }

  /* =========================================================
     КАРТОЧКА «СЕГОДНЯ: ТЕЛО, ЕДА, ГОЛОВА»
     ========================================================= */
  function cardHTML() {
    const dow = dowNow();
    const sc = typeof Week !== 'undefined' ? Week.scriptFor(dow) : [];
    const trainB = sc.find((b) => b.task === 'Тренировка');
    const walkB = sc.find((b) => b.task === 'Прогулка и восстановление');
    const cookB = sc.find((b) => b.task === 'Готовка');
    const aiB = sc.find((b) => b.task === TITLES.ai);
    const r = recipeFor();
    const doneT = (t) => State.doneTitlesOn(State.todayKey()).has(t);
    const tile = (emoji, head, text, btn, id, done) => `
      <div class="coach-tile ${done ? 'done' : ''}">
        <span class="coach-emoji">${done ? '✅' : emoji}</span>
        <div class="coach-text"><b>${head}</b><small>${text}</small></div>
        <button class="btn ${done ? 'btn-ghost' : 'btn-primary'} btn-sm" data-coach="${id}">${btn}</button>
      </div>`;
    const move = trainB
      ? tile('💪', `Тренировка ${typeFor()} · ${Track.hhmm(trainB.start)}`, UI.esc(WORKOUTS[typeFor()].ex.map((e) => e.t.toLowerCase()).slice(0, 3).join(', ') + '…'), 'По шагам', 'train', doneT('Тренировка'))
      : walkB ? tile('🚶', `Прогулка · ${Track.hhmm(walkB.start)}`, '30 минут быстрым шагом + растяжка', 'Пошёл', 'walk', doneT('Прогулка и восстановление'))
        : tile('🌳', 'Движение', 'Выходной: прогулка в свободное время', 'Прогулка', 'walk', false);
    return `
      <div class="coach-card">
        ${move}
        ${tile(r.emoji, `${r.quick ? 'Еда без готовки' : 'Готовка на 2 дня'}${cookB ? ` · ${Track.hhmm(cookB.start)}` : ''}`, UI.esc(r.quick ? 'разогреть вчерашнее + салат' : r.name), 'Рецепт', 'cook', doneT('Готовка'))}
        ${tile('🤖', `ИИ: главное на завтра${aiB ? ` · ${Track.hhmm(aiB.start)}` : ''}`, 'Разбор дня и одно дело на завтра', 'Спросить', 'ai', doneT(TITLES.ai))}
        <button class="linkbtn coach-shop" data-coach="shop">🛒 Список покупок на неделю</button>
      </div>`;
  }

  function planBlockFor(kind) {
    const pl = Planner.plan();
    if (!pl) return null;
    return pl.blocks.find((b) => b.kind === 'task' && kindFor(b) === kind) || null;
  }

  function bindCard(root) {
    if (!root || root.dataset.coachBound) return;
    root.dataset.coachBound = '1';
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-coach]');
      if (!a) return;
      e.stopPropagation();
      const k = a.dataset.coach;
      const b = planBlockFor(k);
      if (k === 'train') openTraining(b);
      else if (k === 'walk') openWalk(b);
      else if (k === 'cook') openCook(b);
      else if (k === 'ai') openAI(b);
      else if (k === 'shop') openShop();
    });
  }

  function renderDash() {
    const el = $('#coach-today');
    if (!el) return;
    el.innerHTML = cardHTML();
    bindCard(el);
  }

  return {
    kindFor, noteFor, start, cardHTML, bindCard, renderDash,
    openTraining, openWalk, openCook, openShop, openAI,
    recipeFor, shopList, shopWeek, strengthSteps, walkSteps, trainingWeek, roundsNow, typeFor,
    WORKOUTS, RECIPES, MENUS, weekIndex, digest, prompt,
    say, SESSIONS, runSteps: startRun, getSample,
    get running() { return !!run; },
  };
})();
