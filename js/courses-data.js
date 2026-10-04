'use strict';
/* =========================================================
   COURSE DATA — содержание курсов вкладки «🎓 Курсы».

   Каждый курс — дни по порядку. День = шаги: видео, упражнения,
   тренировка с таймером, замер результата, дела-чекбоксы.
   Видео — конкретные ролики YouTube (найдены и проверены по названию),
   для английского — курс Александра Бебриса «Английский язык с нуля
   до продвинутого. Практический курс по приложению English Galaxy», A0.
   Упражнения к английскому — свои, по темам уроков в том же порядке.
   ========================================================= */

const CourseData = (() => {
  /* ---------------- 🇬🇧 АНГЛИЙСКИЙ С НУЛЯ ---------------- */
  const EN_LIST = 'PLD6SPjEPomauFCdDQwuHubP7F2yIVJnwN'; // плейлист A0, уроки по порядку
  // 10 видеоуроков по 3 дня: каждый урок ~1–1,5 часа, за день — около 25 минут
  const EN_LESSONS = [
    { n: 1, id: 'HJwTaPns-D0', topic: 'Я, ты, мы, они + глагол', block: 0 },
    { n: 2, id: 'dN5KiZOGFyY', topic: 'Больше глаголов и «and»', block: 0 },
    { n: 3, id: null, topic: 'He / She / It: глагол + s', block: 1 },
    { n: 4, id: null, topic: 'He / She / It — закрепляем', block: 1 },
    { n: 5, id: null, topic: 'Отрицание: don’t / doesn’t', block: 2 },
    { n: 6, id: null, topic: 'Отрицание — закрепляем', block: 2 },
    { n: 7, id: null, topic: 'Вопросы: Do / Does', block: 3 },
    { n: 8, id: null, topic: 'Вопросы и короткие ответы', block: 3 },
    { n: 9, id: null, topic: 'Глагол to be: am / is / are', block: 4 },
    { n: 10, id: null, topic: 'To be: «не» и вопросы', block: 4 },
  ];

  // [английский, русский]
  const EN_BANK = [
    [ // 0 — I / you / we / they + глагол
      ['I work', 'Я работаю'], ['I live in Moscow', 'Я живу в Москве'], ['You know me', 'Ты знаешь меня'],
      ['We play football', 'Мы играем в футбол'], ['They like music', 'Они любят музыку'], ['I understand you', 'Я понимаю тебя'],
      ['We want coffee', 'Мы хотим кофе'], ['You speak English', 'Ты говоришь по-английски'], ['I see you', 'Я вижу тебя'],
      ['I read books', 'Я читаю книги'], ['You love music', 'Ты любишь музыку'], ['I watch films', 'Я смотрю фильмы'],
      ['They live in London', 'Они живут в Лондоне'], ['We work and they play', 'Мы работаем и они играют'],
      ['I need water', 'Мне нужна вода'], ['They know you', 'Они знают тебя'],
    ],
    [ // 1 — he / she / it + s
      ['He works', 'Он работает'], ['She lives in London', 'Она живёт в Лондоне'], ['He likes football', 'Он любит футбол'],
      ['She speaks English', 'Она говорит по-английски'], ['It works', 'Это работает'], ['He knows me', 'Он знает меня'],
      ['She reads books', 'Она читает книги'], ['He watches films', 'Он смотрит фильмы'], ['She wants coffee', 'Она хочет кофе'],
      ['My brother plays football', 'Мой брат играет в футбол'], ['He goes to work', 'Он ходит на работу'],
      ['She understands you', 'Она понимает тебя'], ['My friend lives here', 'Мой друг живёт здесь'], ['It helps me', 'Это помогает мне'],
    ],
    [ // 2 — don't / doesn't
      ['I don’t know', 'Я не знаю'], ['We don’t work today', 'Мы не работаем сегодня'], ['They don’t like coffee', 'Они не любят кофе'],
      ['You don’t understand me', 'Ты не понимаешь меня'], ['He doesn’t work', 'Он не работает'],
      ['She doesn’t speak English', 'Она не говорит по-английски'], ['It doesn’t work', 'Это не работает'],
      ['He doesn’t live here', 'Он не живёт здесь'], ['I don’t watch TV', 'Я не смотрю телевизор'],
      ['She doesn’t want tea', 'Она не хочет чай'], ['We don’t need help', 'Нам не нужна помощь'], ['My friend doesn’t play football', 'Мой друг не играет в футбол'],
    ],
    [ // 3 — Do / Does
      ['Do you speak English', 'Ты говоришь по-английски'], ['Do you like music', 'Ты любишь музыку'], ['Do they live here', 'Они живут здесь'],
      ['Does he work', 'Он работает'], ['Does she know you', 'Она знает тебя'], ['Does it work', 'Это работает'],
      ['Where do you live', 'Где ты живёшь'], ['What do you want', 'Что ты хочешь'], ['Does he play football', 'Он играет в футбол'],
      ['Do we need water', 'Нам нужна вода'], ['Where does she work', 'Где она работает'], ['What does he read', 'Что он читает'],
    ],
    [ // 4 — to be
      ['I am a student', 'Я студент'], ['You are my friend', 'Ты мой друг'], ['He is at home', 'Он дома'],
      ['She is happy', 'Она счастлива'], ['It is good', 'Это хорошо'], ['We are here', 'Мы здесь'],
      ['They are busy', 'Они заняты'], ['I am not tired', 'Я не устал'], ['Is he at work', 'Он на работе'],
      ['Are you ready', 'Ты готов'], ['She is at work', 'Она на работе'], ['We are not late', 'Мы не опаздываем'],
    ],
  ];
  // вопросы — с вопросительным знаком, остальное — с точкой
  const endOf = (en) => (/^(do|does|where|what|is|are)\b/i.test(en) ? '?' : '.');

  // [предложение с ___, правильный ответ, варианты]
  const EN_GAPS = [
    [['I ___ in Moscow.', 'live', ['live', 'lives', 'living']], ['We ___ football.', 'play', ['play', 'plays', 'player']],
      ['They ___ music.', 'like', ['like', 'likes', 'liking']], ['___ understand you.', 'I', ['I', 'Me', 'My']],
      ['You ___ English.', 'speak', ['speak', 'speaks', 'speaking']], ['I ___ you.', 'see', ['see', 'sees', 'seeing']],
      ['We ___ coffee.', 'want', ['want', 'wants', 'wanting']], ['They ___ you.', 'know', ['know', 'knows', 'knowing']]],
    [['She ___ in London.', 'lives', ['live', 'lives', 'living']], ['He ___ football.', 'plays', ['play', 'plays', 'playes']],
      ['It ___.', 'works', ['work', 'works', 'working']], ['He ___ films.', 'watches', ['watch', 'watchs', 'watches']],
      ['She ___ to work.', 'goes', ['go', 'gos', 'goes']], ['My brother ___ English.', 'speaks', ['speak', 'speaks', 'speakes']],
      ['She ___ coffee.', 'wants', ['want', 'wants', 'wanting']], ['___ knows me.', 'He', ['He', 'Him', 'His']]],
    [['He ___ work.', 'doesn’t', ['don’t', 'doesn’t', 'not']], ['I ___ know.', 'don’t', ['don’t', 'doesn’t', 'not']],
      ['She ___ like coffee.', 'doesn’t', ['don’t', 'doesn’t', 'isn’t']], ['They ___ live here.', 'don’t', ['don’t', 'doesn’t', 'aren’t']],
      ['It ___ work.', 'doesn’t', ['don’t', 'doesn’t', 'not']], ['He doesn’t ___ English.', 'speak', ['speak', 'speaks', 'speaking']],
      ['We ___ need help.', 'don’t', ['don’t', 'doesn’t', 'not']], ['She doesn’t ___ TV.', 'watch', ['watch', 'watches', 'watching']]],
    [['___ you speak English?', 'Do', ['Do', 'Does', 'Are']], ['___ he work?', 'Does', ['Do', 'Does', 'Is']],
      ['Does she ___ you?', 'know', ['know', 'knows', 'knowing']], ['Where ___ you live?', 'do', ['do', 'does', 'are']],
      ['___ it work?', 'Does', ['Do', 'Does', 'Is']], ['What ___ he want?', 'does', ['do', 'does', 'is']],
      ['___ they like music?', 'Do', ['Do', 'Does', 'Are']], ['Where does she ___?', 'work', ['work', 'works', 'working']]],
    [['I ___ a student.', 'am', ['am', 'is', 'are']], ['She ___ happy.', 'is', ['am', 'is', 'are']],
      ['They ___ busy.', 'are', ['am', 'is', 'are']], ['___ you ready?', 'Are', ['Am', 'Is', 'Are']],
      ['He ___ at home.', 'is', ['am', 'is', 'are']], ['We ___ here.', 'are', ['am', 'is', 'are']],
      ['I ___ not tired.', 'am', ['am', 'is', 'are']], ['___ he at work?', 'Is', ['Am', 'Is', 'Are']]],
  ];

  // выбрать k элементов из списка, по-разному для разных дней
  const pick = (arr, k, seed) => Array.from({ length: Math.min(k, arr.length) }, (_, i) => arr[(seed * 3 + i * 5) % arr.length])
    .filter((x, i, a) => a.indexOf(x) === i);
  const sentence = ([en, ru]) => ({ en: en + endOf(en), ru: ru + endOf(en), words: en.split(' '), ruWords: ru.split(' ') });

  function englishDay(n, total) {
    const lessonIdx = Math.min(EN_LESSONS.length - 1, Math.floor((n - 1) / 3));
    const L = EN_LESSONS[lessonIdx];
    const part = ((n - 1) % 3) + 1;
    const bank = EN_BANK[L.block];
    const gaps = EN_GAPS[L.block];
    const isFinal = n === total;
    if (n > EN_LESSONS.length * 3 || isFinal) {
      // итоговая проверка (и дни повторения, если её не сдать с первого раза)
      const all = EN_BANK.flatMap((b) => b);
      const allGaps = EN_GAPS.flatMap((g) => g);
      return {
        title: isFinal ? 'Итоговая проверка' : 'Повторение всего курса',
        sub: isFinal ? '12 вопросов и 4 пазла — 80% и курс пройден' : 'Все темы вперемешку',
        check: isFinal,
        steps: [
          { type: 'puzzle-en', title: 'Пазл на изучаемом языке', sub: 'Собери предложение по-английски', items: pick(all, 4, n + 2).map(sentence) },
          { type: 'listening', title: 'Аудирование', sub: 'Переведи услышанное предложение', items: pick(all, 3, n + 7).map(sentence) },
          { type: 'test', title: isFinal ? 'Итоговый тест' : 'Тест', sub: 'Заполни пропуск', pass: isFinal ? 0.8 : 0, items: pick(allGaps, isFinal ? 12 : 6, n).map(([q, a, o]) => ({ q, a, o })) },
        ],
      };
    }
    return {
      title: `Урок ${L.n}: ${L.topic}`,
      sub: `Видео — часть ${part} из 3, около 25 минут`,
      lesson: L.n,
      steps: [
        { type: 'video', title: `Видео: урок ${L.n}, часть ${part}`, sub: 'Смотри ~25 минут — продолжишь с того же места',
          video: { id: L.id, list: EN_LIST, index: L.n - 1, lesson: L.n, start: (part - 1) * 25 * 60, minutes: 25 } },
        { type: 'puzzle-en', title: 'Пазл на изучаемом языке', sub: 'Составление предложения', items: pick(bank, 4, n).map(sentence) },
        { type: 'puzzle-ru', title: 'Пазл на родном языке', sub: 'Составление предложения', items: pick(bank, 3, n + 4).map(sentence) },
        { type: 'listening', title: 'Аудирование', sub: 'Переведите услышанное предложение', items: pick(bank, 3, n + 9).map(sentence) },
        { type: 'test', title: 'Тест', sub: 'Заполните пропуск', items: pick(gaps, 5, n).map(([q, a, o]) => ({ q, a, o })) },
      ],
    };
  }

  /* ---------------- 🤸 СТОЙКА НА РУКАХ ---------------- */
  // упражнение: [название, секунды или повторы, как делать]
  const HS = {
    wrist: ['Разминка запястий', 120, 'Круги, упор на ладонях с покачиванием вперёд-назад, упор на тыльной стороне.'],
    plank: ['Планка на прямых руках', 30, 'Плечи над ладонями, спина ровная, без провала в пояснице.'],
    hollow: ['«Лодочка» на спине', 20, 'Поясница прижата к полу, руки и ноги приподняты.'],
    pike: ['Стойка уголком, ноги на стуле', 20, 'Руки на полу, ноги на стуле, таз над плечами.'],
    wallwalk: ['Заход ногами по стене', 20, 'Лицом к стене: из упора лёжа шагай ногами вверх, руками ближе к стене.'],
    bail: ['Выход колесом в сторону', '10 раз', 'Переставь руку и опусти ноги вбок. Это твой безопасный выход.'],
    wallhold: ['Удержание грудью к стене', 30, 'Касаешься стены только носками, тело — прямая линия.'],
    taps: ['Касания плеч у стены', '6 раз', 'В стойке у стены по очереди касайся ладонью плеча.'],
    kick: ['Заход махом спиной к стене', '8 раз', 'Выпад, руки в 20 см от стены, мах ногой — мягко, без удара пятками.'],
    heel: ['Отрыв пяток от стены', '6 раз', 'Отводи пятки на 3–5 секунд, держись нажимом пальцев в пол.'],
    free: ['Заходы без стены', '8 раз', 'Не стоять, а каждый раз мягко выходить под контролем.'],
    hold: ['Свободная стойка на время', '5 попыток', 'Считай секунды вслух. Смотри в точку между ладонями.'],
    stretch: ['Растяжка плеч и запястий', 180, 'Лёгкая растяжка. Мышцам нужен день, чтобы восстановиться.'],
  };
  const HS_WEEKS = [
    { name: 'Запястья, плечи и корпус', video: 'PKktSi-vNC4', vt: 'Стойка на руках: разбор упражнений для новичков',
      days: [['wrist', 'plank', 'hollow'], ['wrist', 'plank', 'pike'], ['wrist', 'hollow', 'pike'], ['rest'], ['wrist', 'plank', 'hollow', 'pike'], ['wrist', 'plank', 'pike'], ['rest']] },
    { name: 'Стойка у стены', video: 'YWWIg4fnYHQ', vt: 'Стойка на руках для начинающих у стены',
      days: [['wrist', 'wallwalk', 'bail'], ['wrist', 'wallwalk', 'wallhold'], ['wrist', 'bail', 'hollow'], ['rest'], ['wrist', 'wallwalk', 'wallhold'], ['wrist', 'wallhold', 'bail'], ['check:wall30']] },
    { name: 'Сила и прямая линия', video: 'y836o6SMApA', vt: 'Стойка на руках: обучение трём основам',
      days: [['wrist', 'wallhold', 'taps'], ['wrist', 'pike', 'wallhold'], ['wrist', 'taps', 'hollow'], ['rest'], ['wrist', 'wallhold', 'taps'], ['wrist', 'wallhold', 'pike'], ['rest']] },
    { name: 'Баланс', video: 'A-cD8xsD_G0', vt: 'Стойка на руках для начинающих: секреты баланса',
      days: [['wrist', 'kick', 'bail'], ['wrist', 'kick', 'heel'], ['wrist', 'wallhold', 'heel'], ['rest'], ['wrist', 'kick', 'heel', 'taps'], ['wrist', 'kick', 'heel'], ['rest']] },
    { name: 'Свободная стойка', video: 'YBvvtw_24ns', vt: 'Как научиться делать стойку на руках — для новичков',
      days: [['wrist', 'free', 'bail'], ['wrist', 'free', 'hold'], ['wrist', 'heel', 'hold'], ['rest'], ['wrist', 'free', 'hold'], ['wrist', 'free', 'hold'], ['check:final']] },
  ];

  function sessionOf(keys, lib) {
    return keys.map((k) => lib[k]).filter(Boolean).map(([t, v, how]) => (typeof v === 'number' ? { t, sec: v, how } : { t, reps: v, how }));
  }

  function physicalDay(weeks, lib, n, opts) {
    const wi = Math.min(weeks.length - 1, Math.floor((n - 1) / 7));
    const W = weeks[wi];
    const di = (n - 1) % 7;
    const plan = W.days[di] || ['rest'];
    const steps = [];
    if (di === 0 && W.video) steps.push({ type: 'video', title: `Видео недели: ${W.vt}`, sub: 'Посмотри технику перед тренировкой', video: { id: W.video } });
    if (plan[0] === 'rest') {
      steps.push({ type: 'session', title: 'День отдыха: растяжка', sub: '3 минуты — и день засчитан', session: sessionOf(['stretch'], lib) });
      return { title: `${W.name} · отдых`, sub: 'Восстановление — тоже часть тренировки', steps, week: wi };
    }
    if (String(plan[0]).startsWith('check:')) {
      const c = opts.checks[plan[0].slice(6)];
      steps.push({ type: 'session', title: 'Разминка перед проверкой', sub: 'Запястья и плечи', session: sessionOf(['wrist'], lib) });
      c.measures.forEach((m) => steps.push({ type: 'measure', title: m.title, sub: m.sub, key: m.key, unit: m.unit, goal: m.goal }));
      return { title: c.title, sub: c.sub, steps, check: plan[0].slice(6), week: wi };
    }
    steps.push({ type: 'session', title: 'Тренировка с таймером', sub: plan.map((k) => lib[k][0]).join(' · '), session: sessionOf(plan, lib), sets: opts.sets ? opts.sets(wi) : 2 });
    if (opts.measureEvery && di === 5) steps.push({ type: 'measure', ...opts.measureEvery });
    return { title: `${W.name} · день ${di + 1}`, sub: 'Тренировка ~15–20 минут', steps, week: wi };
  }

  const HS_CHECKS = {
    wall30: { title: 'Проверка: стойка у стены', sub: 'Цель — 30 секунд грудью к стене',
      measures: [{ title: 'Сколько секунд держишь у стены?', sub: 'Лучшая из 3 попыток', key: 'wall', unit: 'с', goal: 30 }] },
    final: { title: 'Итоговая проверка', sub: 'У стены 45 с и свободно 5 с',
      measures: [{ title: 'Стойка у стены, секунд', sub: 'Лучшая из 3 попыток', key: 'wall', unit: 'с', goal: 45 },
        { title: 'Свободная стойка, секунд', sub: 'Лучшая из 5 попыток', key: 'free', unit: 'с', goal: 5 }] },
  };

  /* ---------------- 🔄 САЛЬТО НАЗАД ---------------- */
  const BF = {
    warm: ['Разминка: суставы и бег на месте', 180, 'Шея, плечи, кисти, колени, голеностоп — по 10 кругов.'],
    bridge: ['Мостик', 20, 'Из положения лёжа. Руки и ноги толкают, плечи над ладонями.'],
    hollow: ['«Лодочка» на спине', 20, 'Поясница прижата к полу — это твоя группировка в воздухе.'],
    jump: ['Прыжки вверх с махом рук', '10 раз', 'Руки снизу — вверх, тянись макушкой в потолок. Высота важнее всего.'],
    tuck: ['Прыжки с группировкой', '8 раз', 'Колени к груди на самой высокой точке.'],
    roll: ['Кувырок назад на мате', '6 раз', 'Подбородок к груди, руки у ушей, толкайся руками.'],
    squat: ['Приседания с выпрыгиванием', '10 раз', 'Мягко приземляйся на носки.'],
    drop: ['Падение назад на высокий мат', '5 раз', 'Только на толстый мат и со страховкой: прыжок вверх и назад, лопатками на мат.'],
    tramp: ['Батут: прыжки с махом рук', 60, 'Учись прыгать в центр батута, не уходя в сторону.'],
    tdrop: ['Батут: падение на спину', '6 раз', 'Подбородок к груди, руки вперёд, приземляйся на спину и отпружинивай на ноги.'],
    spot: ['Сальто на батуте СО СТРАХОВКОЙ', '5 раз', 'Тренер или опытный друг держит за поясницу и бедро. Без страхующего — не делаем.'],
    solo: ['Сальто на батуте сам', '5 раз', 'Только если со страховкой уже 5 из 5 чисто. Высокий прыжок, взгляд назад, колени к груди.'],
    stretch: ['Растяжка спины и плеч', 180, 'Спокойно, без рывков.'],
  };
  const BF_WEEKS = [
    { name: 'Гибкость и прыжок', video: 'yy9V7x0jOn8', vt: 'Как безопасно научиться сальто назад — советы тренера',
      days: [['warm', 'bridge', 'jump'], ['warm', 'hollow', 'jump'], ['warm', 'bridge', 'squat'], ['rest'], ['warm', 'bridge', 'hollow', 'jump'], ['warm', 'squat', 'jump'], ['rest']] },
    { name: 'Группировка и кувырки', video: '8mJdQ-_zHL0', vt: 'Как научиться сальто назад — обучалка',
      days: [['warm', 'tuck', 'roll'], ['warm', 'hollow', 'tuck'], ['warm', 'roll', 'bridge'], ['rest'], ['warm', 'tuck', 'roll', 'squat'], ['warm', 'tuck', 'jump'], ['check:jump']] },
    { name: 'Падения назад на мат', video: 'wN36ObeQBfQ', vt: 'Сальто назад новичку за 5 шагов',
      days: [['warm', 'tuck', 'drop'], ['warm', 'roll', 'drop'], ['warm', 'tuck', 'bridge'], ['rest'], ['warm', 'drop', 'tuck'], ['warm', 'drop', 'squat'], ['rest']] },
    { name: 'Батут', video: 'P5ux_eiU4zw', vt: 'Как научиться сальто назад — самый эффективный способ',
      days: [['warm', 'tramp', 'tdrop'], ['warm', 'tramp', 'tuck'], ['warm', 'tdrop', 'hollow'], ['rest'], ['warm', 'tramp', 'tdrop'], ['warm', 'tdrop', 'tuck'], ['rest']] },
    { name: 'Сальто со страховкой', video: null,
      days: [['warm', 'tramp', 'spot'], ['warm', 'tdrop', 'spot'], ['warm', 'tuck', 'spot'], ['rest'], ['warm', 'tramp', 'spot'], ['warm', 'spot', 'tuck'], ['rest']] },
    { name: 'Сам на батуте', video: null,
      days: [['warm', 'spot', 'solo'], ['warm', 'tramp', 'solo'], ['warm', 'spot', 'solo'], ['rest'], ['warm', 'solo', 'tuck'], ['warm', 'solo'], ['check:final']] },
  ];
  const BF_CHECKS = {
    jump: { title: 'Проверка: высота и группировка', sub: '8 прыжков с группировкой подряд без потери высоты',
      measures: [{ title: 'Сколько прыжков с группировкой подряд?', sub: 'Колени к груди на высоте', key: 'tuck', unit: 'раз', goal: 8 }] },
    final: { title: 'Итоговая проверка', sub: '3 чистых сальто на батуте подряд — сам',
      measures: [{ title: 'Сколько чистых сальто подряд на батуте?', sub: 'Приземление на ноги, без страховки', key: 'flip', unit: 'раз', goal: 3 }] },
  };

  /* ---------------- 💰 ДЕНЬГИ С НУЛЯ ---------------- */
  const MONEY = [
    { t: 'Как устроены деньги', video: 'dyYDDk3IfDI', vt: 'Личные финансы с нуля: 10 базовых правил',
      todo: ['Посчитай все свои доходы за месяц (стипендия, подработка, подарки)'], measure: { title: 'Доход в месяц', key: 'income', unit: '₸/₽' } },
    { t: 'Траты за день', todo: ['Записывай каждую трату сегодня — даже 100', 'Вечером сложи, сколько ушло'] },
    { t: 'Утечки', todo: ['Найди 3 траты, без которых можно жить (подписки, доставка, перекусы)', 'Отмени или урежь одну прямо сейчас'] },
    { t: 'Сначала заплати себе', todo: ['Заведи отдельный счёт или копилку «Подушка»', 'Отложи туда 10% дохода — даже если это мало'] },
    { t: 'Подушка безопасности', video: 'TKtStGNeGXc', vt: 'Как создать финансовую подушку безопасности',
      todo: ['Посчитай свои обычные траты в месяц'], measure: { title: 'Сколько нужно на 3 месяца жизни', key: 'goal', unit: '₸/₽' } },
    { t: 'Первая продажа', todo: ['Найди дома 3 ненужные вещи', 'Сфотографируй при дневном свете и выложи одну на OLX'] },
    { t: 'Итог недели', todo: ['Сравни траты с доходом'], measure: { title: 'Сколько отложено всего', key: 'saved', unit: '₸/₽' } },
    { t: 'Навыки = деньги', todo: ['Выпиши 5 вещей, которые ты умеешь (монтаж, TikTok, ремонт, английский…)', 'Отметь одну, за которую тебе могли бы заплатить'] },
    { t: 'Кому это нужно', todo: ['Найди 3 объявления или людей, кому нужен твой навык', 'Посмотри, сколько за это платят'] },
    { t: 'Первое предложение', todo: ['Напиши одно предложение услуги (что делаешь, сколько стоит, пример работы)', 'Отправь его хотя бы одному человеку'] },
    { t: 'OLX: вторая продажа', todo: ['Выложи ещё 2 вещи', 'Ответь всем, кто написал, в течение часа'] },
    { t: 'Портфолио', todo: ['Сделай 1 пример своей работы бесплатно для себя или друга', 'Сохрани до/после'] },
    { t: 'Цена', todo: ['Подними цену на 10% для следующего клиента или товара'] },
    { t: 'Итог недели', todo: ['Сколько заработал сверх обычного дохода?'], measure: { title: 'Заработано за неделю сверх обычного', key: 'extra', unit: '₸/₽' } },
    { t: 'Мошенники', video: 'yeU4OlNDRcg', vt: 'Как копить деньги правильно — и не попасться мошенникам',
      todo: ['Запомни: никто не просит код из СМС «для безопасности»', 'Не переводи «предоплату» незнакомым на OLX'] },
    { t: 'Кредиты и проценты', todo: ['Узнай, сколько стоит кредит: возьми 100 000 под 30% на год и посчитай переплату', 'Правило: в долг — только на то, что приносит деньги'] },
    { t: 'Сложный процент', todo: ['Посчитай: 1 000 в месяц под 10% годовых за 10 лет', 'Вывод: время важнее суммы — начинать рано'] },
    { t: 'Автоматизация', todo: ['Настрой автоперевод 10% в день дохода на счёт «Подушка»'] },
    { t: 'Траты-ловушки', todo: ['Правило 24 часов: любую покупку дороже 5 000 откладывай на сутки'] },
    { t: 'OLX: третья продажа', todo: ['Продай третью вещь или договорись о встрече'] },
    { t: 'Итог недели', todo: ['Проверь подушку'], measure: { title: 'Сколько отложено всего', key: 'saved', unit: '₸/₽' } },
    { t: 'Инвестиции: что это', video: '2jNfrSMrONY', vt: 'Всё о финансовой грамотности: как копить, если денег мало',
      todo: ['Пойми разницу: копить (подушка) и инвестировать (рост)', 'Сначала подушка, потом инвестиции'] },
    { t: 'Риск и доходность', todo: ['Запомни: чем выше обещанный доход, тем выше риск', '«Гарантированные 30% в месяц» — это обман'] },
    { t: 'Индекс и диверсификация', todo: ['Узнай, что такое индексный фонд — много компаний сразу', 'Не клади все деньги в одну вещь'] },
    { t: 'Цель на год', todo: ['Запиши цель: сколько хочешь накопить и зарабатывать через год'], measure: { title: 'Цель накоплений на год', key: 'year', unit: '₸/₽' } },
    { t: 'План дохода', todo: ['Запиши 3 шага, как поднять доход в следующем месяце'] },
    { t: 'Повторение', todo: ['Перечитай свои записи за месяц', 'Отметь, что сработало лучше всего'] },
    { t: 'Порядок в деньгах', todo: ['Удали лишние приложения-магазины с телефона', 'Оставь одно место для учёта трат'] },
    { t: 'Прощай, импульсы', todo: ['Отпишись от 5 рассылок и аккаунтов, которые заставляют покупать'] },
    { t: 'Итоговая проверка', check: true, todo: ['Бюджет месяца записан', 'Подушка начата и пополняется автоматически', '3 вещи проданы или 1 платный заказ', 'Есть цель на год и план дохода'] },
  ];

  function moneyDay(n) {
    const d = MONEY[Math.min(MONEY.length - 1, n - 1)];
    const steps = [];
    if (d.video) steps.push({ type: 'video', title: `Видео: ${d.vt}`, sub: 'Посмотри — 10–20 минут', video: { id: d.video } });
    steps.push({ type: 'todo', title: d.check ? 'Отметь, что уже есть' : 'Дело дня', sub: d.todo.length > 1 ? `${d.todo.length} шага` : 'Один шаг', items: d.todo, all: !!d.check });
    if (d.measure) steps.push({ type: 'measure', ...d.measure });
    return { title: d.t, sub: d.check ? 'Всё отмечено — курс пройден' : '10–20 минут', steps, check: d.check ? 'final' : null };
  }

  /* ---------------- КАТАЛОГ ---------------- */
  const COURSES = [
    {
      id: 'english', emoji: '🇬🇧', title: 'Английский с нуля', short: 'Английский', level: 'A0 → начало A1', days: 30, minutes: 35,
      cat: 'study', grad: ['#4f7cff', '#7b5cff'], tag: 'Видео + пазлы + аудирование',
      about: 'Видеоуроки Александра Бебриса (English Galaxy, A0) и упражнения после каждого: пазлы, аудирование, тест.',
      outcomes: ['Строишь предложения в настоящем времени: «я работаю», «он живёт», «мы не знаем»', 'Задаёшь вопросы Do / Does и отвечаешь', 'Говоришь о себе с am / is / are', 'Понимаешь медленную речь на эти темы на слух'],
      promise: 'Если проходить урок дня — 25 минут видео и упражнения, — через 30 дней ты сможешь рассказать о себе 10 простыми предложениями и понять такие же на слух.',
      finalPass: 0.8, review: 5,
      day: (n, c) => englishDay(n, c.days),
    },
    {
      id: 'handstand', emoji: '🤸', title: 'Стойка на руках', short: 'Стойка на руках', level: 'с нуля', days: 35, minutes: 20,
      cat: 'health', grad: ['#ff7a59', '#ff4f8b'], tag: 'Тренировки с таймером и голосом',
      about: 'От запястий и корпуса до свободной стойки: 5 недель, 2 дня отдыха в неделю, проверки на 14-й и 35-й день.',
      outcomes: ['Стойка у стены 45 секунд', 'Первые 5–10 секунд без опоры', 'Безопасный выход из стойки колесом'],
      promise: 'Если делать тренировку дня (15–20 минут), через 35 дней ты стоишь у стены 45 секунд и делаешь первые секунды свободной стойки.',
      safety: 'Ровный нескользкий пол, рядом нет мебели. Сначала учим выход колесом. Боль в запястьях или плечах — стоп.',
      review: 7,
      day: (n) => physicalDay(HS_WEEKS, HS, n, { checks: HS_CHECKS, measureEvery: { title: 'Стойка у стены — сколько секунд сегодня?', sub: 'Замер прогресса', key: 'wall', unit: 'с' } }),
    },
    {
      id: 'backflip', emoji: '🔄', title: 'Сальто назад', short: 'Сальто', level: 'с нуля', days: 42, minutes: 25,
      cat: 'health', grad: ['#14b8a6', '#3b82f6'], tag: 'Только со страховкой и на мягком',
      about: 'Гибкость, прыжок, группировка, падения на мат, батут — и сальто сначала со страховкой, потом сам. 6 недель.',
      outcomes: ['Высокий прыжок с группировкой', 'Сальто на батуте со страховкой', '3 чистых сальто на батуте подряд сам'],
      promise: 'Если тренироваться по плану и с 5-й недели — на батуте со страхующим, через 42 дня ты делаешь сальто назад на батуте сам.',
      safety: 'Сальто — травмоопасно. Падения и сальто — только на батуте, толстом мате или в поролоновой яме, со страхующим (тренер или опытный друг). На твёрдом полу не делаем, пока на батуте не выходит 10 из 10.',
      gate: 'Подтверди: у меня будет батут или толстые маты и человек, который умеет страховать.',
      review: 7,
      day: (n) => physicalDay(BF_WEEKS, BF, n, { checks: BF_CHECKS }),
    },
    {
      id: 'money', emoji: '💰', title: 'Деньги с нуля', short: 'Деньги', level: 'основа', days: 30, minutes: 15,
      cat: 'money', grad: ['#16a34a', '#84cc16'], tag: 'Бюджет, подушка, первый заработок',
      about: 'Одно конкретное дело в день: учёт, подушка, первые продажи на OLX, заработок навыком, защита от мошенников, основы инвестиций.',
      outcomes: ['Бюджет месяца и учёт трат', 'Подушка начата и пополняется сама', '3 продажи на OLX или первый заказ', 'Цель на год и план дохода'],
      promise: 'Если делать дело дня (10–20 минут), через 30 дней у тебя есть бюджет, растущая подушка, первые деньги сверх обычного дохода и план. Богатым за месяц не делает никто — но с этого начинают все.',
      review: 5,
      day: (n) => moneyDay(n),
    },
  ];

  return { COURSES, byId: (id) => COURSES.find((c) => c.id === id), EN_LESSONS, EN_LIST };
})();
