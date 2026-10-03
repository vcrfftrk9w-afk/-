/* Собрано из content/15-flappy.txt командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */
window.COURSE = window.COURSE || [];
window.COURSE.push({
 "lessons": [
  {
   "id": "flp-1",
   "title": "Шаг 1. Птица машет крыльями",
   "xp": 20,
   "theory": "Третий проект — **Flappy Bird** [флэ́ппи бёрд] — «хлопающая птичка». В 2014 году эту простую игру скачали больше 50 миллионов раз! Правила: птица падает, нажатие — взмах вверх. Нужно пролетать между трубами.\n\n## План\n\n1. **Птица машет крыльями** ← ты здесь\n2. Бесконечные трубы\n3. Столкновения и очки\n4. Старт, рекорд и новая игра\n\n## Физика птицы\n\nВсё как в уроке про гравитацию и прыжок:\n\n- каждый кадр `vy += gravity` — птица разгоняется вниз;\n- взмах — резкая скорость вверх: `vy = -flapPower`.\n\nГлавное отличие от прыжка: взмахивать можно **в воздухе** сколько угодно — никакой проверки «на земле».\n\n## Управление: и клавиши, и клик\n\nЧтобы играть и на компьютере, и на телефоне, взмах делаем по пробелу **и** по клику (касанию). Обе подписки вызывают одну функцию `flap()`:\n\n```code\nfunction flap() {\n  bird.vy = -flapPower;\n}\n\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \" \" || e.key === \"ArrowUp\") flap();\n});\ncanvas.addEventListener(\"click\", flap);\n```\n\nОбрати внимание: в `addEventListener(\"click\", flap)` мы передаём **саму функцию** — без скобок! Со скобками `flap()` функция выполнилась бы сразу, один раз, а нам нужно «вызывать при каждом клике».\n\n> 🎮 Холст в этом проекте **вертикальный** — 360 × 480, как экран телефона.",
   "task": {
    "tests": [
     [
      "Гравитация разгоняет птицу вниз",
      "(function () { bird.y = 100; bird.vy = 1; update(); return Math.abs(bird.vy - 1.4) < 1e-9 && Math.abs(bird.y - 101.4) < 1e-9; })()"
     ],
     [
      "Птица не проваливается ниже холста",
      "(function () { bird.y = canvas.height - bird.r - 1; bird.vy = 8; update(); return bird.y + bird.r === canvas.height && bird.vy === 0; })()"
     ],
     [
      "flap() даёт скорость вверх flapPower",
      "(function () { bird.vy = 5; flap(); return bird.vy === -flapPower; })()"
     ],
     [
      "Пробел вызывает взмах",
      "(function () { bird.vy = 3; __press(\" \"); __release(\" \"); return bird.vy === -flapPower; })()"
     ],
     [
      "Клик по холсту вызывает взмах",
      "(function () { bird.vy = 3; __click(100, 100); return bird.vy === -flapPower; })()"
     ]
    ],
    "hints": [
     "update: `bird.vy += gravity; bird.y += bird.vy;` и проверка дна `if (bird.y + bird.r > canvas.height) { bird.y = canvas.height - bird.r; bird.vy = 0; }`",
     "flap: `bird.vy = -flapPower;`",
     "Управление: `document.addEventListener(\"keydown\", (e) => { if (e.key === \" \") flap(); });` и `canvas.addEventListener(\"click\", flap);`"
    ],
    "text": "1. В `update()`: увеличивай `bird.vy` на `gravity`, сдвигай `bird.y` на `bird.vy`. Не давай птице провалиться ниже холста: если `bird.y + bird.r` больше высоты — поставь её на дно и обнули `vy`.\n2. Функция `flap()` задаёт `bird.vy = -flapPower`.\n3. Вызывай `flap()` по пробелу и по клику по холсту.",
    "canvas": true,
    "width": 360,
    "height": 480,
    "starter": "const bird = { x: 80, y: 200, r: 14, vy: 0 };\nconst gravity = 0.4;\nconst flapPower = 7;\n\n// 2. Взмах\nfunction flap() {\n\n}\n\n// 3. Управление: пробел и клик\n\n\nfunction update() {\n  // 1. Гравитация и дно\n\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#4ec0ff\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.font = bird.r * 2 + \"px Arial\";\n  ctx.textAlign = \"center\";\n  ctx.fillText(\"🐤\", bird.x, bird.y + bird.r * 0.7);\n  ctx.textAlign = \"left\";\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const bird = { x: 80, y: 200, r: 14, vy: 0 };\nconst gravity = 0.4;\nconst flapPower = 7;\n\n// 2. Взмах\nfunction flap() {\n  bird.vy = -flapPower;\n}\n\n// 3. Управление: пробел и клик\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \" \" || e.key === \"ArrowUp\") flap();\n});\ncanvas.addEventListener(\"click\", flap);\n\nfunction update() {\n  // 1. Гравитация и дно\n  bird.vy += gravity;\n  bird.y += bird.vy;\n  if (bird.y + bird.r > canvas.height) {\n    bird.y = canvas.height - bird.r;\n    bird.vy = 0;\n  }\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#4ec0ff\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.font = bird.r * 2 + \"px Arial\";\n  ctx.textAlign = \"center\";\n  ctx.fillText(\"🐤\", bird.x, bird.y + bird.r * 0.7);\n  ctx.textAlign = \"left\";\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Чем отличаются `addEventListener(\"click\", flap)` и `addEventListener(\"click\", flap())`?",
     "a": [
      "Первый передаёт функцию для вызова при клике, второй вызывает её сразу один раз",
      "Ничем",
      "Второй правильнее"
     ],
     "c": 0,
     "e": "Без скобок — сама функция («вызови потом»), со скобками — результат её вызова прямо сейчас."
    }
   ]
  },
  {
   "id": "flp-2",
   "title": "Шаг 2. Бесконечные трубы",
   "xp": 20,
   "theory": "Теперь — **трубы**. Они появляются справа и едут налево. Каждая «труба» — это пара: верхняя и нижняя, а между ними **проход** (gap [гэп] — «промежуток»).\n\nХранить можно всего два числа на пару: `x` (где труба) и `gapY` (где начинается проход):\n\n```code\n{ x: 360, gapY: 150 }\n```\n\nВерхняя труба — от 0 до `gapY`, нижняя — от `gapY + GAP` до низа холста.\n\n## Новые трубы через равные промежутки\n\nБудем считать кадры. Каждые 90 кадров (≈1.5 секунды) — новая труба:\n\n```code\nframe++;\nif (frame % 90 === 0) addPipe();\n```\n\n`frame % 90 === 0` — «номер кадра делится на 90» — верно на 90-м, 180-м, 270-м кадре…\n\n## Проход в случайном месте\n\n```code\nfunction addPipe() {\n  const gapY = randomInt(60, canvas.height - 60 - GAP);\n  pipes.push({ x: canvas.width, gapY: gapY, passed: false });\n}\n```\n\nОтступ 60 сверху и снизу — чтобы проход не прилипал к краю экрана. Свойство `passed` [пэст] — «пролетели» — пригодится в следующем шаге для очков.\n\n## Уборка\n\nТрубы, уехавшие за левый край, удаляем — иначе через пару минут их будут тысячи, и игра начнёт тормозить:\n\n```code\npipes = pipes.filter((p) => p.x + PIPE_W > 0);\n```\n\n> 🎮 Так делают «бесконечные» игры (раннеры): мир создаётся впереди и удаляется позади. Сам мир стоит на месте — двигаются препятствия.",
   "task": {
    "tests": [
     [
      "addPipe добавляет трубу у правого края",
      "(function () { pipes.length = 0; addPipe(); var p = pipes[0]; return pipes.length === 1 && p.x === canvas.width && p.passed === false && typeof p.gapY === \"number\"; })()"
     ],
     [
      "Проход всегда в допустимых пределах и в разных местах",
      "(function () { var seen = {}; for (var i = 0; i < 400; i++) { pipes.length = 0; addPipe(); var g = pipes[0].gapY; if (g < 60 || g > canvas.height - 60 - GAP || g !== Math.floor(g)) return false; seen[g] = 1; } pipes.length = 0; return Object.keys(seen).length > 30; })()"
     ],
     [
      "update сдвигает трубы влево на PIPE_SPEED",
      "(function () { pipes.length = 0; pipes.push({ x: 200, gapY: 100, passed: false }); frame = 1; update(); return pipes.length >= 1 && pipes[0].x === 200 - PIPE_SPEED; })()"
     ],
     [
      "Уехавшие за экран трубы удаляются",
      "(function () { pipes.length = 0; pipes.push({ x: -PIPE_W + 1, gapY: 100, passed: false }, { x: 150, gapY: 100, passed: false }); frame = 1; update(); return pipes.length === 1 && pipes[0].x === 150 - PIPE_SPEED; })()"
     ],
     [
      "Каждые 90 кадров появляется новая труба",
      "(function () { pipes.length = 0; frame = 0; for (var i = 0; i < 180; i++) { bird.y = 200; bird.vy = 0; update(); } return pipes.length === 2; })()"
     ],
     [
      "Каждая труба рисуется двумя прямоугольниками с проходом GAP",
      "(function () { pipes.length = 0; pipes.push({ x: 150, gapY: 120, passed: false }); __clearDraw(); draw(); var r = __drawn(\"fillRect\").filter(function (c) { return c.a[0] === 150 && c.a[2] === PIPE_W; }); var top = r.some(function (c) { return c.a[1] === 0 && c.a[3] === 120; }); var bot = r.some(function (c) { return c.a[1] === 120 + GAP && c.a[1] + c.a[3] >= canvas.height; }); return top && bot; })()"
     ]
    ],
    "hints": [
     "addPipe: `const gapY = randomInt(60, canvas.height - 60 - GAP); pipes.push({ x: canvas.width, gapY: gapY, passed: false });`",
     "В update: `frame++; if (frame % 90 === 0) addPipe(); for (const p of pipes) { p.x -= PIPE_SPEED; } pipes = pipes.filter((p) => p.x + PIPE_W > 0);`",
     "В draw для каждой трубы: `ctx.fillRect(p.x, 0, PIPE_W, p.gapY);` и `ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, canvas.height - p.gapY - GAP);`"
    ],
    "text": "1. `addPipe()` — добавляет в `pipes` трубу: `x = canvas.width`, `gapY` — случайное от 60 до `canvas.height - 60 - GAP`, `passed: false`.\n2. В `update()`: увеличивай `frame`; каждые 90 кадров вызывай `addPipe()`; сдвигай каждую трубу влево на `PIPE_SPEED`; удаляй трубы, ушедшие за левый край.\n3. В `draw()` нарисуй каждую трубу: верхний прямоугольник (от 0 до `gapY`) и нижний (от `gapY + GAP` до низа), шириной `PIPE_W`.",
    "canvas": true,
    "width": 360,
    "height": 480,
    "starter": "const bird = { x: 80, y: 200, r: 14, vy: 0 };\nconst gravity = 0.4;\nconst flapPower = 7;\nconst GAP = 140;        // высота прохода\nconst PIPE_W = 60;      // ширина трубы\nconst PIPE_SPEED = 2;   // скорость труб\nlet pipes = [];\nlet frame = 0;\n\nfunction randomInt(min, max) {\n  return Math.floor(Math.random() * (max - min + 1)) + min;\n}\n\nfunction flap() { bird.vy = -flapPower; }\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \" \" || e.key === \"ArrowUp\") flap();\n});\ncanvas.addEventListener(\"click\", flap);\n\n// 1. Новая труба\nfunction addPipe() {\n\n}\n\nfunction update() {\n  bird.vy += gravity;\n  bird.y += bird.vy;\n  if (bird.y + bird.r > canvas.height) { bird.y = canvas.height - bird.r; bird.vy = 0; }\n\n  // 2. Трубы: появление, движение, уборка\n\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#4ec0ff\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  // 3. Трубы\n  ctx.fillStyle = \"#3cb043\";\n\n  ctx.font = bird.r * 2 + \"px Arial\";\n  ctx.textAlign = \"center\";\n  ctx.fillText(\"🐤\", bird.x, bird.y + bird.r * 0.7);\n  ctx.textAlign = \"left\";\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const bird = { x: 80, y: 200, r: 14, vy: 0 };\nconst gravity = 0.4;\nconst flapPower = 7;\nconst GAP = 140;        // высота прохода\nconst PIPE_W = 60;      // ширина трубы\nconst PIPE_SPEED = 2;   // скорость труб\nlet pipes = [];\nlet frame = 0;\n\nfunction randomInt(min, max) {\n  return Math.floor(Math.random() * (max - min + 1)) + min;\n}\n\nfunction flap() { bird.vy = -flapPower; }\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \" \" || e.key === \"ArrowUp\") flap();\n});\ncanvas.addEventListener(\"click\", flap);\n\n// 1. Новая труба\nfunction addPipe() {\n  const gapY = randomInt(60, canvas.height - 60 - GAP);\n  pipes.push({ x: canvas.width, gapY: gapY, passed: false });\n}\n\nfunction update() {\n  bird.vy += gravity;\n  bird.y += bird.vy;\n  if (bird.y + bird.r > canvas.height) { bird.y = canvas.height - bird.r; bird.vy = 0; }\n\n  // 2. Трубы: появление, движение, уборка\n  frame++;\n  if (frame % 90 === 0) addPipe();\n  for (const p of pipes) {\n    p.x -= PIPE_SPEED;\n  }\n  pipes = pipes.filter((p) => p.x + PIPE_W > 0);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#4ec0ff\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  // 3. Трубы\n  ctx.fillStyle = \"#3cb043\";\n  for (const p of pipes) {\n    ctx.fillRect(p.x, 0, PIPE_W, p.gapY);\n    ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, canvas.height - p.gapY - GAP);\n  }\n  ctx.font = bird.r * 2 + \"px Arial\";\n  ctx.textAlign = \"center\";\n  ctx.fillText(\"🐤\", bird.x, bird.y + bird.r * 0.7);\n  ctx.textAlign = \"left\";\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Когда верно `frame % 90 === 0`?",
     "a": [
      "На 90-м, 180-м, 270-м… кадре",
      "Только на 90-м кадре",
      "Каждый кадр"
     ],
     "c": 0,
     "e": "Остаток от деления на 90 равен нулю для всех чисел, кратных 90."
    }
   ]
  },
  {
   "id": "flp-3",
   "title": "Шаг 3. Столкновения и очки",
   "xp": 20,
   "theory": "Теперь птица может **разбиться**, а за каждую пролетённую трубу — **очко**.\n\n## Столкновение с трубой\n\nПтица задела трубу, если она одновременно:\n1. **по горизонтали** — на уровне трубы: правый край птицы правее левого края трубы **и** левый край птицы левее правого края трубы;\n2. **по вертикали** — **не** внутри прохода.\n\n```code\nfunction hitsPipe(p) {\n  const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;\n  const inGap = bird.y - bird.r > p.gapY && bird.y + bird.r < p.gapY + GAP;\n  return inX && !inGap;\n}\n```\n\n(Птицу считаем квадратом вокруг круга — для этой игры этого достаточно.)\n\n## Земля и небо\n\nКоснулась земли или улетела выше экрана — тоже конец:\n\n```code\nif (bird.y + bird.r > canvas.height || bird.y - bird.r < 0) gameOver = true;\n```\n\n## Очки\n\nОчко — когда труба целиком проехала **левее** птицы. Чтобы не засчитать одну трубу 60 раз (каждый кадр!), помечаем её `passed = true`:\n\n```code\nif (!p.passed && p.x + PIPE_W < bird.x) {\n  p.passed = true;\n  score++;\n}\n```\n\n> 🧠 Флажок «уже засчитано» — очень частый приём. Без него условие верно много кадров подряд, и событие срабатывает многократно.",
   "task": {
    "tests": [
     [
      "hitsPipe: птица в проходе — не задевает",
      "(function () { bird.x = 80; bird.y = 200; return hitsPipe({ x: 60, gapY: 150, passed: false }) === false; })()"
     ],
     [
      "hitsPipe: птица на уровне верхней или нижней трубы — задевает",
      "(function () { bird.x = 80; bird.y = 140; var a = hitsPipe({ x: 60, gapY: 150, passed: false }); bird.y = 285; var b = hitsPipe({ x: 60, gapY: 150, passed: false }); return a === true && b === true; })()"
     ],
     [
      "hitsPipe: труба далеко впереди — не задевает",
      "(function () { bird.x = 80; bird.y = 20; return hitsPipe({ x: 250, gapY: 150, passed: false }) === false; })()"
     ],
     [
      "Удар о трубу заканчивает игру и всё замирает",
      "(function () { gameOver = false; pipes.length = 0; pipes.push({ x: 70, gapY: 300, passed: false }); bird.x = 80; bird.y = 100; bird.vy = 0; frame = 1; update(); var a = gameOver === true; var y = bird.y; update(); return a && bird.y === y; })()"
     ],
     [
      "Пролетели трубу — ровно одно очко",
      "(function () { gameOver = false; pipes.length = 0; pipes.push({ x: bird.x - PIPE_W - 1 + PIPE_SPEED, gapY: 150, passed: false }); bird.y = 220; bird.vy = -0.4; frame = 1; var s = score; update(); update(); update(); return score === s + 1 && pipes[0].passed === true; })()"
     ],
     [
      "Земля или потолок — конец игры",
      "(function () { gameOver = false; pipes.length = 0; bird.y = canvas.height - bird.r; bird.vy = 2; frame = 1; update(); var a = gameOver; gameOver = false; bird.y = bird.r; bird.vy = -3; update(); return a === true && gameOver === true; })()"
     ]
    ],
    "hints": [
     "hitsPipe: `const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;`, `const inGap = bird.y - bird.r > p.gapY && bird.y + bird.r < p.gapY + GAP;`, `return inX && !inGap;`",
     "В цикле: `if (hitsPipe(p)) gameOver = true;` и `if (!p.passed && p.x + PIPE_W < bird.x) { p.passed = true; score++; }`",
     "В начале update `if (gameOver) return;`, в конце `if (bird.y + bird.r > canvas.height || bird.y - bird.r < 0) gameOver = true;`"
    ],
    "text": "1. Напиши `hitsPipe(p)` — возвращает `true`, если птица задевает трубу `p` (формула в теории).\n2. В `update()`: если игра окончена (`gameOver`) — ничего не делай (`return`).\n3. В цикле по трубам: если птица задела трубу — `gameOver = true`; если труба пролетела левее птицы и ещё не засчитана — `passed = true` и `score++`.\n4. Если птица коснулась земли или верхнего края — `gameOver = true`.",
    "canvas": true,
    "width": 360,
    "height": 480,
    "starter": "const bird = { x: 80, y: 200, r: 14, vy: 0 };\nconst gravity = 0.4;\nconst flapPower = 7;\nconst GAP = 140;\nconst PIPE_W = 60;\nconst PIPE_SPEED = 2;\nlet pipes = [];\nlet frame = 0;\nlet score = 0;\nlet gameOver = false;\n\nfunction randomInt(min, max) {\n  return Math.floor(Math.random() * (max - min + 1)) + min;\n}\n\nfunction flap() { bird.vy = -flapPower; }\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \" \" || e.key === \"ArrowUp\") flap();\n});\ncanvas.addEventListener(\"click\", flap);\n\nfunction addPipe() {\n  const gapY = randomInt(60, canvas.height - 60 - GAP);\n  pipes.push({ x: canvas.width, gapY: gapY, passed: false });\n}\n\n// 1. Задела ли птица трубу?\nfunction hitsPipe(p) {\n\n}\n\nfunction update() {\n  // 2. Игра окончена — стоим\n\n  bird.vy += gravity;\n  bird.y += bird.vy;\n\n  frame++;\n  if (frame % 90 === 0) addPipe();\n  for (const p of pipes) {\n    p.x -= PIPE_SPEED;\n    // 3. Столкновение и очки\n\n  }\n  pipes = pipes.filter((p) => p.x + PIPE_W > 0);\n\n  // 4. Земля и небо\n\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#4ec0ff\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#3cb043\";\n  for (const p of pipes) {\n    ctx.fillRect(p.x, 0, PIPE_W, p.gapY);\n    ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, canvas.height - p.gapY - GAP);\n  }\n  ctx.font = bird.r * 2 + \"px Arial\";\n  ctx.textAlign = \"center\";\n  ctx.fillText(gameOver ? \"💥\" : \"🐤\", bird.x, bird.y + bird.r * 0.7);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"bold 40px Arial\";\n  ctx.fillText(score, canvas.width / 2, 60);\n  ctx.textAlign = \"left\";\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const bird = { x: 80, y: 200, r: 14, vy: 0 };\nconst gravity = 0.4;\nconst flapPower = 7;\nconst GAP = 140;\nconst PIPE_W = 60;\nconst PIPE_SPEED = 2;\nlet pipes = [];\nlet frame = 0;\nlet score = 0;\nlet gameOver = false;\n\nfunction randomInt(min, max) {\n  return Math.floor(Math.random() * (max - min + 1)) + min;\n}\n\nfunction flap() { bird.vy = -flapPower; }\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \" \" || e.key === \"ArrowUp\") flap();\n});\ncanvas.addEventListener(\"click\", flap);\n\nfunction addPipe() {\n  const gapY = randomInt(60, canvas.height - 60 - GAP);\n  pipes.push({ x: canvas.width, gapY: gapY, passed: false });\n}\n\n// 1. Задела ли птица трубу?\nfunction hitsPipe(p) {\n  const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;\n  const inGap = bird.y - bird.r > p.gapY && bird.y + bird.r < p.gapY + GAP;\n  return inX && !inGap;\n}\n\nfunction update() {\n  // 2. Игра окончена — стоим\n  if (gameOver) return;\n\n  bird.vy += gravity;\n  bird.y += bird.vy;\n\n  frame++;\n  if (frame % 90 === 0) addPipe();\n  for (const p of pipes) {\n    p.x -= PIPE_SPEED;\n    // 3. Столкновение и очки\n    if (hitsPipe(p)) gameOver = true;\n    if (!p.passed && p.x + PIPE_W < bird.x) {\n      p.passed = true;\n      score++;\n    }\n  }\n  pipes = pipes.filter((p) => p.x + PIPE_W > 0);\n\n  // 4. Земля и небо\n  if (bird.y + bird.r > canvas.height || bird.y - bird.r < 0) gameOver = true;\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#4ec0ff\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#3cb043\";\n  for (const p of pipes) {\n    ctx.fillRect(p.x, 0, PIPE_W, p.gapY);\n    ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, canvas.height - p.gapY - GAP);\n  }\n  ctx.font = bird.r * 2 + \"px Arial\";\n  ctx.textAlign = \"center\";\n  ctx.fillText(gameOver ? \"💥\" : \"🐤\", bird.x, bird.y + bird.r * 0.7);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"bold 40px Arial\";\n  ctx.fillText(score, canvas.width / 2, 60);\n  ctx.textAlign = \"left\";\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Зачем у трубы флажок passed?",
     "a": [
      "Чтобы очко за трубу засчиталось один раз",
      "Чтобы труба исчезла",
      "Чтобы птица пролетала сквозь трубу"
     ],
     "c": 0,
     "e": "Условие «труба левее птицы» верно много кадров подряд — флажок не даёт считать очко снова."
    }
   ]
  },
  {
   "id": "flp-4",
   "title": "Шаг 4. Старт, рекорд и новая игра",
   "xp": 25,
   "theory": "Финальные штрихи, которые превращают прототип в игру:\n\n1. **Экран старта.** Игра не начинается сразу — птица висит в воздухе и ждёт первого нажатия.\n2. **Рекорд**, который сохраняется даже после закрытия браузера.\n3. **Новая игра** по нажатию после проигрыша.\n\n## Три состояния\n\n```code\nlet state = \"ready\";   // \"ready\" — ждём старта, \"play\" — летим, \"over\" — разбились\n```\n\nОдна функция `flap()` делает разное в зависимости от состояния:\n\n```code\nfunction flap() {\n  if (state === \"over\") { restart(); return; }\n  state = \"play\";\n  bird.vy = -flapPower;\n}\n```\n\n## Рекорд в localStorage\n\n```code\nlet best = Number(localStorage.getItem(\"flappyBest\")) || 0;\n\nfunction endGame() {\n  state = \"over\";\n  if (score > best) {\n    best = score;\n    localStorage.setItem(\"flappyBest\", best);\n  }\n}\n```\n\n> 💡 Ключ называем по имени игры (`\"flappyBest\"`), чтобы рекорды разных игр не перепутались.\n\n> 🏆 Готово! Твой Flappy Bird можно показывать друзьям. Идеи для улучшений: трубы ускоряются со временем, птица наклоняется по скорости (`ctx.rotate`), медали за 10, 20, 50 очков.",
   "task": {
    "tests": [
     [
      "До старта птица висит на месте",
      "(function () { state = \"ready\"; bird.y = 200; bird.vy = 0; update(); update(); return bird.y === 200; })()"
     ],
     [
      "Первое нажатие запускает игру и делает взмах",
      "(function () { state = \"ready\"; bird.vy = 0; __press(\" \"); __release(\" \"); return state === \"play\" && bird.vy === -flapPower; })()"
     ],
     [
      "Разбились — состояние \"over\", рекорд обновлён и сохранён",
      "(function () { state = \"play\"; best = 0; score = 5; pipes.length = 0; bird.y = canvas.height + 5; bird.vy = 1; update(); return state === \"over\" && best === 5 && localStorage.getItem(\"flappyBest\") === \"5\"; })()"
     ],
     [
      "Рекорд не уменьшается, если результат хуже",
      "(function () { state = \"play\"; best = 50; score = 3; endGame(); return best === 50; })()"
     ],
     [
      "Нажатие после проигрыша начинает новую игру",
      "(function () { state = \"over\"; score = 9; pipes.push({ x: 100, gapY: 100, passed: false }); bird.y = 400; __press(\" \"); __release(\" \"); return state === \"ready\" && score === 0 && pipes.length === 0 && bird.y === 200 && bird.vy === 0 && frame === 0; })()"
     ]
    ],
    "hints": [
     "flap: `if (state === \"over\") { restart(); return; } state = \"play\"; bird.vy = -flapPower;`",
     "endGame: `state = \"over\"; if (score > best) { best = score; localStorage.setItem(\"flappyBest\", best); }`",
     "restart: `bird.y = 200; bird.vy = 0; pipes = []; frame = 0; score = 0; state = \"ready\";`. В начале update: `if (state !== \"play\") return;`"
    ],
    "text": "1. `flap()`: если `state === \"over\"` — вызови `restart()` и выйди; иначе поставь `state = \"play\"` и сделай взмах.\n2. `endGame()`: `state = \"over\"` и, если `score > best`, обнови `best` и сохрани его в `localStorage` под ключом `\"flappyBest\"`.\n3. `restart()`: птица в начальную точку (`y = 200`, `vy = 0`), трубы пустые, `frame = 0`, `score = 0`, `state = \"ready\"`.\n4. В `update()`: пока `state !== \"play\"` — ничего не делай. Вместо `gameOver = true` вызывай `endGame()`.",
    "canvas": true,
    "width": 360,
    "height": 480,
    "starter": "const bird = { x: 80, y: 200, r: 14, vy: 0 };\nconst gravity = 0.4;\nconst flapPower = 7;\nconst GAP = 140;\nconst PIPE_W = 60;\nconst PIPE_SPEED = 2;\nlet pipes = [];\nlet frame = 0;\nlet score = 0;\nlet state = \"ready\";   // \"ready\", \"play\" или \"over\"\nlet best = Number(localStorage.getItem(\"flappyBest\")) || 0;\n\nfunction randomInt(min, max) {\n  return Math.floor(Math.random() * (max - min + 1)) + min;\n}\n\n// 1. Взмах / старт / новая игра\nfunction flap() {\n  bird.vy = -flapPower;\n}\n\n// 2. Конец игры и рекорд\nfunction endGame() {\n\n}\n\n// 3. Новая игра\nfunction restart() {\n\n}\n\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \" \" || e.key === \"ArrowUp\") flap();\n});\ncanvas.addEventListener(\"click\", flap);\n\nfunction addPipe() {\n  const gapY = randomInt(60, canvas.height - 60 - GAP);\n  pipes.push({ x: canvas.width, gapY: gapY, passed: false });\n}\n\nfunction hitsPipe(p) {\n  const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;\n  const inGap = bird.y - bird.r > p.gapY && bird.y + bird.r < p.gapY + GAP;\n  return inX && !inGap;\n}\n\nfunction update() {\n  // 4. Не летим — ничего не делаем\n\n  bird.vy += gravity;\n  bird.y += bird.vy;\n\n  frame++;\n  if (frame % 90 === 0) addPipe();\n  for (const p of pipes) {\n    p.x -= PIPE_SPEED;\n    if (hitsPipe(p)) endGame();\n    if (!p.passed && p.x + PIPE_W < bird.x) {\n      p.passed = true;\n      score++;\n    }\n  }\n  pipes = pipes.filter((p) => p.x + PIPE_W > 0);\n\n  if (bird.y + bird.r > canvas.height || bird.y - bird.r < 0) endGame();\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#4ec0ff\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#3cb043\";\n  for (const p of pipes) {\n    ctx.fillRect(p.x, 0, PIPE_W, p.gapY);\n    ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, canvas.height - p.gapY - GAP);\n  }\n  ctx.textAlign = \"center\";\n  ctx.font = bird.r * 2 + \"px Arial\";\n  ctx.fillText(state === \"over\" ? \"💥\" : \"🐤\", bird.x, bird.y + bird.r * 0.7);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"bold 40px Arial\";\n  ctx.fillText(score, canvas.width / 2, 60);\n  ctx.font = \"20px Arial\";\n  if (state === \"ready\") ctx.fillText(\"Нажми пробел или кликни\", canvas.width / 2, 260);\n  if (state === \"over\") {\n    ctx.fillText(\"Рекорд: \" + best, canvas.width / 2, 240);\n    ctx.fillText(\"Нажми, чтобы сыграть ещё\", canvas.width / 2, 270);\n  }\n  ctx.textAlign = \"left\";\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const bird = { x: 80, y: 200, r: 14, vy: 0 };\nconst gravity = 0.4;\nconst flapPower = 7;\nconst GAP = 140;\nconst PIPE_W = 60;\nconst PIPE_SPEED = 2;\nlet pipes = [];\nlet frame = 0;\nlet score = 0;\nlet state = \"ready\";   // \"ready\", \"play\" или \"over\"\nlet best = Number(localStorage.getItem(\"flappyBest\")) || 0;\n\nfunction randomInt(min, max) {\n  return Math.floor(Math.random() * (max - min + 1)) + min;\n}\n\n// 1. Взмах / старт / новая игра\nfunction flap() {\n  if (state === \"over\") {\n    restart();\n    return;\n  }\n  state = \"play\";\n  bird.vy = -flapPower;\n}\n\n// 2. Конец игры и рекорд\nfunction endGame() {\n  state = \"over\";\n  if (score > best) {\n    best = score;\n    localStorage.setItem(\"flappyBest\", best);\n  }\n}\n\n// 3. Новая игра\nfunction restart() {\n  bird.y = 200;\n  bird.vy = 0;\n  pipes = [];\n  frame = 0;\n  score = 0;\n  state = \"ready\";\n}\n\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \" \" || e.key === \"ArrowUp\") flap();\n});\ncanvas.addEventListener(\"click\", flap);\n\nfunction addPipe() {\n  const gapY = randomInt(60, canvas.height - 60 - GAP);\n  pipes.push({ x: canvas.width, gapY: gapY, passed: false });\n}\n\nfunction hitsPipe(p) {\n  const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;\n  const inGap = bird.y - bird.r > p.gapY && bird.y + bird.r < p.gapY + GAP;\n  return inX && !inGap;\n}\n\nfunction update() {\n  // 4. Не летим — ничего не делаем\n  if (state !== \"play\") return;\n\n  bird.vy += gravity;\n  bird.y += bird.vy;\n\n  frame++;\n  if (frame % 90 === 0) addPipe();\n  for (const p of pipes) {\n    p.x -= PIPE_SPEED;\n    if (hitsPipe(p)) endGame();\n    if (!p.passed && p.x + PIPE_W < bird.x) {\n      p.passed = true;\n      score++;\n    }\n  }\n  pipes = pipes.filter((p) => p.x + PIPE_W > 0);\n\n  if (bird.y + bird.r > canvas.height || bird.y - bird.r < 0) endGame();\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#4ec0ff\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#3cb043\";\n  for (const p of pipes) {\n    ctx.fillRect(p.x, 0, PIPE_W, p.gapY);\n    ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, canvas.height - p.gapY - GAP);\n  }\n  ctx.textAlign = \"center\";\n  ctx.font = bird.r * 2 + \"px Arial\";\n  ctx.fillText(state === \"over\" ? \"💥\" : \"🐤\", bird.x, bird.y + bird.r * 0.7);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"bold 40px Arial\";\n  ctx.fillText(score, canvas.width / 2, 60);\n  ctx.font = \"20px Arial\";\n  if (state === \"ready\") ctx.fillText(\"Нажми пробел или кликни\", canvas.width / 2, 260);\n  if (state === \"over\") {\n    ctx.fillText(\"Рекорд: \" + best, canvas.width / 2, 240);\n    ctx.fillText(\"Нажми, чтобы сыграть ещё\", canvas.width / 2, 270);\n  }\n  ctx.textAlign = \"left\";\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Почему ключ рекорда лучше назвать \"flappyBest\", а не просто \"best\"?",
     "a": [
      "Чтобы рекорды разных игр не перезаписывали друг друга",
      "Так короче",
      "localStorage не принимает слово best"
     ],
     "c": 0,
     "e": "Хранилище общее для всех программ на сайте, поэтому имена ключей должны быть уникальными."
    }
   ]
  }
 ],
 "id": "flappy",
 "icon": "🐤",
 "color": "#ffb020",
 "title": "Проект: Flappy Bird",
 "desc": "Птичка, гравитация, бесконечные трубы, очки и рекорд, который сохраняется",
 "project": true
});
