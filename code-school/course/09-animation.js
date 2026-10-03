/* Собрано из content/09-animation.txt командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */
window.COURSE = window.COURSE || [];
window.COURSE.push({
 "lessons": [
  {
   "id": "anim-1",
   "title": "Как работает анимация — игровой цикл",
   "theory": "Мультфильм — это много картинок, которые быстро сменяют друг друга. Каждая картинка — **кадр**. Если показывать больше 24 кадров в секунду, глаз видит плавное движение.\n\nИгры работают так же — обычно **60 кадров в секунду**. Каждый кадр программа:\n\n1. **стирает** холст;\n2. **меняет** положение объектов (чуть-чуть сдвигает);\n3. **рисует** всё заново.\n\nИ так по кругу. Это называется **игровой цикл** (game loop [гейм луп]).\n\n```js canvas\nlet x = 0;\n\nfunction loop() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n\n  ctx.fillStyle = \"tomato\";\n  ctx.fillRect(x, 140, 40, 40);\n\n  x += 2;\n  if (x > canvas.width) {\n    x = -40;\n  }\n\n  requestAnimationFrame(loop);\n}\n\nloop();\n```\n\n## Разбор\n\n- `ctx.clearRect(0, 0, canvas.width, canvas.height)` — стереть весь холст (`clear` [клир] — «очистить»). Без этого квадрат оставлял бы за собой след.\n- `x += 2` — каждый кадр сдвигаем квадрат на 2 пикселя вправо.\n- `requestAnimationFrame(loop)` [рикуэ́ст энимэ́йшн фрейм] — «попроси кадр анимации»: браузер вызовет `loop` ещё раз перед следующим кадром экрана. Функция сама себя «заказывает» снова и снова.\n- `loop();` в самом конце — первый запуск цикла.\n\n> 🧠 Почему не `while (true)`? Бесконечный while никогда не отдаст браузеру управление, и тот не успеет показать ни одного кадра — страница зависнет. `requestAnimationFrame` вызывает функцию ровно тогда, когда экран готов к новому кадру.\n\nПопробуй убрать строчку с `clearRect` и запустить — увидишь «шлейф».\n\n> 🎮 Абсолютно все игры, от «Змейки» до огромных 3D-миров, крутятся в таком цикле: стереть → обновить → нарисовать → повторить.",
   "task": {
    "tests": [
     [
      "Квадрат движется вправо (x растёт)",
      "x !== 0 && __frames > 5 && __drawn(\"fillRect\").map(function (c) { return c.a[0]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).length > 5"
     ],
     [
      "Холст стирается целиком каждый кадр",
      "__drew(\"clearRect\", function (c) { return c.a[0] === 0 && c.a[1] === 0 && c.a[2] >= canvas.width && c.a[3] >= canvas.height; }) && __drawn(\"clearRect\").length > 5"
     ],
     [
      "Шаг движения — 3 пикселя",
      "/x\\s*\\+=\\s*3|x\\s*=\\s*x\\s*\\+\\s*3/.test(__codeNS)"
     ]
    ],
    "hints": [
     "Стереть: `ctx.clearRect(0, 0, canvas.width, canvas.height);`",
     "Сдвинуть: `x += 3;`"
    ],
    "text": "Оживи квадрат! В игровом цикле:\n\n1. В начале каждого кадра **сотри** весь холст (`clearRect`).\n2. После рисования **сдвигай** квадрат вправо: увеличивай `x` на 3.\n\nБонус: когда квадрат уезжает за правый край, верни его влево (`x = -40`).",
    "canvas": true,
    "starter": "let x = 0;\n\nfunction loop() {\n  // 1. Сотри холст\n\n\n  // 2. Рисуем квадрат\n  ctx.fillStyle = \"tomato\";\n  ctx.fillRect(x, 140, 40, 40);\n\n  // 3. Сдвинь квадрат\n\n\n  requestAnimationFrame(loop);\n}\n\nloop();\n",
    "solution": "let x = 0;\n\nfunction loop() {\n  // 1. Сотри холст\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n\n  // 2. Рисуем квадрат\n  ctx.fillStyle = \"tomato\";\n  ctx.fillRect(x, 140, 40, 40);\n\n  // 3. Сдвинь квадрат\n  x += 3;\n  if (x > canvas.width) {\n    x = -40;\n  }\n\n  requestAnimationFrame(loop);\n}\n\nloop();\n",
    "wait": 600
   },
   "quiz": [
    {
     "q": "Что произойдёт, если в игровом цикле не стирать холст?",
     "a": [
      "Объекты будут оставлять за собой след",
      "Ничего не нарисуется",
      "Игра ускорится"
     ],
     "c": 0,
     "e": "Каждый новый кадр рисуется поверх старого — получается шлейф."
    },
    {
     "q": "Примерно сколько раз в секунду вызывает функцию requestAnimationFrame?",
     "a": [
      "1",
      "10",
      "60"
     ],
     "c": 2,
     "e": "Обычно 60 раз в секунду — с частотой обновления экрана."
    }
   ]
  },
  {
   "id": "anim-2",
   "title": "Скорость и направление",
   "theory": "Чтобы объект мог двигаться в любую сторону, у него две скорости:\n\n- `vx` — на сколько пикселей сдвигаться **по горизонтали** за кадр;\n- `vy` — на сколько **по вертикали**.\n\n(`v` — от velocity [вело́сити] — «скорость».)\n\n| vx | vy | Куда движется |\n|---|---|---|\n| 3 | 0 | вправо |\n| -3 | 0 | влево |\n| 0 | 3 | вниз |\n| 0 | -3 | вверх |\n| 3 | 2 | вправо и вниз (по диагонали) |\n\n```js canvas\nconst ball = { x: 50, y: 50, vx: 3, vy: 2, r: 15 };\n\nfunction update() {\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"cyan\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\n\nloop();\n```\n\n## Порядок в коде: update и draw\n\nПрофессионалы делят игровой цикл на две функции:\n\n- `update()` [апде́йт] — «обновить»: только меняет данные (координаты, счёт), ничего не рисует;\n- `draw()` [дро] — «нарисовать»: только рисует, ничего не меняет.\n\nТак код намного проще понимать и исправлять. Мы будем всегда так делать.\n\n> 💡 Объект `ball` хранит всё про мяч в одном месте: положение, скорость, размер. Удобно, правда?",
   "task": {
    "tests": [
     [
      "update сдвигает мяч по x на vx",
      "(function () { ball.x = 100; ball.y = 100; ball.vx = 4; ball.vy = 0; update(); return ball.x === 104 && ball.y === 100; })()"
     ],
     [
      "update сдвигает мяч по y на vy",
      "(function () { ball.x = 100; ball.y = 100; ball.vx = 0; ball.vy = -5; update(); return ball.x === 100 && ball.y === 95; })()"
     ],
     [
      "Скорость берётся из свойств мяча, а не вписана числами",
      "/ball\\.x\\s*\\+=\\s*ball\\.vx/.test(__codeNS) || /ball\\.x\\s*=\\s*ball\\.x\\s*\\+\\s*ball\\.vx/.test(__codeNS)"
     ]
    ],
    "hints": [
     "Внутри update две строчки: `ball.x += ball.vx;`",
     "и `ball.y += ball.vy;`"
    ],
    "text": "Допиши функцию `update()`, чтобы мяч двигался: каждый кадр прибавляй к `ball.x` скорость `ball.vx`, а к `ball.y` — скорость `ball.vy`.\n\nМяч должен полететь по диагонали вправо-вниз.",
    "canvas": true,
    "starter": "const ball = { x: 40, y: 40, vx: 3, vy: 2, r: 15 };\n\nfunction update() {\n\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"cyan\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\n\nloop();\n",
    "solution": "const ball = { x: 40, y: 40, vx: 3, vy: 2, r: 15 };\n\nfunction update() {\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"cyan\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\n\nloop();\n"
   },
   "quiz": [
    {
     "q": "Объект движется с vx = -2 и vy = 0. Куда?",
     "a": [
      "Влево",
      "Вправо",
      "Вверх"
     ],
     "c": 0,
     "e": "Отрицательная скорость по x — движение влево."
    },
    {
     "q": "Что должна делать функция draw?",
     "a": [
      "Менять координаты",
      "Только рисовать",
      "Проверять столкновения"
     ],
     "c": 1,
     "e": "draw только рисует, а все изменения — в update."
    }
   ]
  },
  {
   "id": "anim-3",
   "title": "Отскок от стен",
   "theory": "Мяч улетел за край экрана и пропал. Давай научим его **отскакивать**!\n\nИдея простая: если мяч коснулся правой или левой стены — **разворачиваем** скорость по горизонтали: `vx = -vx`. Была `3` — стала `-3`, и мяч полетел обратно. С верхом и низом — то же самое с `vy`.\n\n```js canvas\nconst ball = { x: 100, y: 80, vx: 4, vy: 3, r: 18 };\n\nfunction update() {\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n\n  if (ball.x + ball.r > canvas.width || ball.x - ball.r < 0) {\n    ball.vx = -ball.vx;\n  }\n  if (ball.y + ball.r > canvas.height || ball.y - ball.r < 0) {\n    ball.vy = -ball.vy;\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"gold\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\nloop();\n```\n\n## Почему `ball.x + ball.r`?\n\n`ball.x` — это **центр** мяча. Его правый край — `x + r`, левый — `x - r`. Если проверять только центр, мяч будет наполовину проваливаться в стену.\n\n| Стена | Условие касания |\n|---|---|\n| правая | `ball.x + ball.r > canvas.width` |\n| левая | `ball.x - ball.r < 0` |\n| нижняя | `ball.y + ball.r > canvas.height` |\n| верхняя | `ball.y - ball.r < 0` |\n\n> 💡 Бывает, что мяч «залипает» в стене и дрожит: на одном кадре скорость развернулась, но мяч ещё не успел выйти из стены, — и на следующем кадре развернулась обратно. Надёжнее не разворачивать, а задавать направление: у правой стены `vx = -Math.abs(vx)` (точно влево), у левой `vx = Math.abs(vx)` (точно вправо).\n\n> 🎮 Отскок — основа арканоида, пинг-понга и бильярда.",
   "task": {
    "tests": [
     [
      "Отскок от правой стены",
      "(function () { ball.x = canvas.width - ball.r - 1; ball.y = 150; ball.vx = 4; ball.vy = 0; update(); return ball.vx < 0; })()"
     ],
     [
      "Отскок от левой стены",
      "(function () { ball.x = ball.r + 1; ball.y = 150; ball.vx = -4; ball.vy = 0; update(); return ball.vx > 0; })()"
     ],
     [
      "Отскок от нижней стены",
      "(function () { ball.x = 200; ball.y = canvas.height - ball.r - 1; ball.vx = 0; ball.vy = 4; update(); return ball.vy < 0; })()"
     ],
     [
      "Отскок от верхней стены",
      "(function () { ball.x = 200; ball.y = ball.r + 1; ball.vx = 0; ball.vy = -4; update(); return ball.vy > 0; })()"
     ],
     [
      "В середине поля мяч летит не разворачиваясь",
      "(function () { ball.x = 240; ball.y = 160; ball.vx = 3; ball.vy = 2; update(); return ball.vx === 3 && ball.vy === 2; })()"
     ]
    ],
    "hints": [
     "Правая и левая стены одним условием: `if (ball.x + ball.r > canvas.width || ball.x - ball.r < 0) { ball.vx = -ball.vx; }`",
     "Верх и низ так же, только с `ball.y`, `canvas.height` и `ball.vy`."
    ],
    "text": "Допиши в `update()` отскоки мяча от **всех четырёх** стен:\n- от левой и правой — разворачивай `ball.vx`;\n- от верхней и нижней — разворачивай `ball.vy`.\n\nУчитывай радиус мяча `ball.r`. Робот поставит мяч у каждой стены и проверит, что он отскакивает.",
    "canvas": true,
    "starter": "const ball = { x: 100, y: 80, vx: 4, vy: 3, r: 18 };\n\nfunction update() {\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n\n  // Отскок от левой и правой стены\n\n\n  // Отскок от верхней и нижней стены\n\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"gold\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\nloop();\n",
    "solution": "const ball = { x: 100, y: 80, vx: 4, vy: 3, r: 18 };\n\nfunction update() {\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n\n  // Отскок от левой и правой стены\n  if (ball.x + ball.r > canvas.width) {\n    ball.vx = -Math.abs(ball.vx);\n  }\n  if (ball.x - ball.r < 0) {\n    ball.vx = Math.abs(ball.vx);\n  }\n\n  // Отскок от верхней и нижней стены\n  if (ball.y + ball.r > canvas.height) {\n    ball.vy = -Math.abs(ball.vy);\n  }\n  if (ball.y - ball.r < 0) {\n    ball.vy = Math.abs(ball.vy);\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"gold\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\nloop();\n"
   },
   "quiz": [
    {
     "q": "Мяч летит вправо со скоростью vx = 5 и касается правой стены. Какой станет vx?",
     "a": [
      "-5",
      "0",
      "5"
     ],
     "c": 0,
     "e": "Скорость разворачивается: мяч летит влево с той же скоростью."
    },
    {
     "q": "Почему в проверке пишут `ball.x + ball.r`, а не просто `ball.x`?",
     "a": [
      "x — центр мяча, а стены касается его край",
      "Так быстрее",
      "Иначе ошибка"
     ],
     "c": 0,
     "e": "Правый край мяча — центр плюс радиус."
    }
   ]
  },
  {
   "id": "anim-4",
   "title": "Таймеры — setInterval и setTimeout",
   "theory": "Иногда нужно сделать что-то **через время** или **раз в N секунд**: обратный отсчёт, появление врага каждые 2 секунды, бонус, который действует 5 секунд.\n\n## setTimeout — один раз через время\n\n```js\nconsole.log(\"Бомба заложена!\");\nsetTimeout(() => {\n  console.log(\"💥 БАБАХ!\");\n}, 2000);\n```\n\n`setTimeout(функция, миллисекунды)` [сет та́ймаут] — выполнить функцию **один раз** через указанное время. **1000 миллисекунд = 1 секунда**.\n\n## setInterval — повторять\n\n```js\nlet count = 0;\nconst timer = setInterval(() => {\n  count++;\n  console.log(\"Тик \" + count);\n  if (count === 5) {\n    clearInterval(timer);\n    console.log(\"Таймер остановлен\");\n  }\n}, 500);\n```\n\n- `setInterval(функция, мс)` [сет и́нтервал] — повторять функцию каждые N миллисекунд;\n- он возвращает «номер таймера» — сохраняем его в переменную;\n- `clearInterval(номер)` [клир и́нтервал] — остановить.\n\n## Таймер на экране\n\n```js canvas\nlet timeLeft = 5;\n\nconst timer = setInterval(() => {\n  timeLeft--;\n  if (timeLeft <= 0) {\n    clearInterval(timer);\n  }\n}, 1000);\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"bold 48px Arial\";\n  ctx.textAlign = \"center\";\n  ctx.fillText(timeLeft > 0 ? \"⏰ \" + timeLeft : \"Время вышло!\", 240, 175);\n  requestAnimationFrame(draw);\n}\ndraw();\n```\n\n> 💡 Обрати внимание: таймер **меняет данные** (timeLeft), а игровой цикл их **рисует**. Они работают одновременно и не мешают друг другу.\n\n> 🎮 setInterval — способ сделать «тик» игры с постоянной скоростью. Например, змейка двигается ровно раз в 150 мс, а не 60 раз в секунду.",
   "task": {
    "tests": [
     [
      "Через секунду время уменьшилось на 1",
      "timeLeft === 9"
     ],
     [
      "Используется setInterval с периодом 1000",
      "/setInterval\\s*\\([\\s\\S]*1000\\s*\\)/.test(__codeNS)"
     ],
     [
      "Таймер останавливается через clearInterval",
      "/clearInterval\\s*\\(/.test(__codeNS)"
     ]
    ],
    "hints": [
     "`const timer = setInterval(() => { ... }, 1000);` — внутри `timeLeft--;`",
     "Внутри же: `if (timeLeft <= 0) { clearInterval(timer); }`"
    ],
    "text": "Сделай таймер раунда:\n\n1. Каждую **секунду** (1000 мс) уменьшай `timeLeft` на 1 с помощью `setInterval`.\n2. Когда `timeLeft` дошёл до 0 — останови таймер через `clearInterval`.\n3. Игровой цикл уже рисует текст — посмотри, как меняется число.\n\nРобот подождёт чуть больше секунды и проверит, что время уменьшилось.",
    "canvas": true,
    "starter": "let timeLeft = 10;\n\n// Запусти таймер здесь\n\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"bold 40px Arial\";\n  ctx.textAlign = \"center\";\n  ctx.fillText(timeLeft > 0 ? \"Осталось: \" + timeLeft : \"Время вышло!\", 240, 170);\n  requestAnimationFrame(draw);\n}\ndraw();\n",
    "solution": "let timeLeft = 10;\n\n// Запусти таймер здесь\nconst timer = setInterval(() => {\n  timeLeft--;\n  if (timeLeft <= 0) {\n    clearInterval(timer);\n  }\n}, 1000);\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"bold 40px Arial\";\n  ctx.textAlign = \"center\";\n  ctx.fillText(timeLeft > 0 ? \"Осталось: \" + timeLeft : \"Время вышло!\", 240, 170);\n  requestAnimationFrame(draw);\n}\ndraw();\n",
    "wait": 1400
   },
   "quiz": [
    {
     "q": "Сколько миллисекунд в 3 секундах?",
     "a": [
      "30",
      "300",
      "3000"
     ],
     "c": 2,
     "e": "1 секунда = 1000 мс."
    },
    {
     "q": "Чем setTimeout отличается от setInterval?",
     "a": [
      "setTimeout выполняет один раз, setInterval — повторяет",
      "Ничем",
      "setInterval работает быстрее"
     ],
     "c": 0,
     "e": "Timeout — «задержка», один раз. Interval — «промежуток», снова и снова."
    }
   ]
  },
  {
   "id": "anim-5",
   "title": "Много объектов в движении",
   "theory": "Один мяч — скучно. Давай запустим **сотню**! Для этого объекты хранят в **массиве**, а в `update` и `draw` перебирают циклом.\n\n```js canvas\nconst snow = [];\nfor (let i = 0; i < 100; i++) {\n  snow.push({\n    x: Math.random() * canvas.width,\n    y: Math.random() * canvas.height,\n    r: 1 + Math.random() * 3,\n    speed: 0.5 + Math.random() * 2\n  });\n}\n\nfunction update() {\n  for (const f of snow) {\n    f.y += f.speed;\n    if (f.y > canvas.height) {\n      f.y = -5;\n      f.x = Math.random() * canvas.width;\n    }\n  }\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#0b1030\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"white\";\n  for (const f of snow) {\n    ctx.beginPath();\n    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);\n    ctx.fill();\n  }\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\nloop();\n```\n\n## Что здесь происходит\n\n1. **Создание.** Цикл создаёт 100 снежинок со случайными координатами, размером и скоростью и кладёт их в массив `snow`.\n2. **update.** Каждую снежинку сдвигаем вниз на её скорость. Упала за нижний край — переносим наверх: снег идёт бесконечно.\n3. **draw.** Заливаем фон (это тоже «стирание» холста) и рисуем каждую снежинку.\n\n> 💡 Маленькие снежинки падают медленнее — так кажется, что они дальше. Это простой трюк, который создаёт глубину. Называется **параллакс**.\n\n> 🎮 Так делают звёздное небо в космических играх, дождь, листопад, искры от взрывов, пули и толпы врагов.",
   "task": {
    "tests": [
     [
      "В массиве 30 звёзд с x, y и speed",
      "stars.length === 30 && stars.every(function (s) { return typeof s.x === \"number\" && typeof s.y === \"number\" && s.speed > 0; })"
     ],
     [
      "Звёзды разбросаны случайно",
      "(function () { var xs = {}; stars.forEach(function (s) { xs[Math.round(s.x)] = 1; }); return Object.keys(xs).length > 10; })()"
     ],
     [
      "update двигает каждую звезду вниз на её speed",
      "(function () { var s = stars[0], t = stars[1]; s.y = 50; s.speed = 2; t.y = 80; t.speed = 3.5; update(); return s.y === 52 && t.y === 83.5; })()"
     ],
     [
      "Звезда за нижним краем возвращается наверх",
      "(function () { var s = stars[2]; s.y = canvas.height + 1; update(); return s.y < 20; })()"
     ]
    ],
    "hints": [
     "Создание в цикле: `stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, speed: 1 + Math.random() * 3 });`",
     "В update: `for (const s of stars) { s.y += s.speed; if (s.y > canvas.height) { s.y = 0; } }`"
    ],
    "text": "Сделай звездопад:\n\n1. Заполни массив `stars` **30 звёздами**. У каждой — `x` (случайный по ширине), `y` (случайный по высоте) и `speed` (например, от 1 до 4).\n2. В `update()` двигай каждую звезду **вниз** на её `speed`.\n3. Если звезда ушла за нижний край (`y > canvas.height`), верни её наверх: `y = 0`.\n\nФункция `draw()` уже готова.",
    "canvas": true,
    "starter": "const stars = [];\n\n// 1. Создай 30 звёзд\n\n\nfunction update() {\n  // 2. Двигай звёзды вниз\n  // 3. Возвращай наверх\n\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#070b1f\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"white\";\n  for (const s of stars) {\n    ctx.fillRect(s.x, s.y, 3, 3);\n  }\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\nloop();\n",
    "solution": "const stars = [];\n\n// 1. Создай 30 звёзд\nfor (let i = 0; i < 30; i++) {\n  stars.push({\n    x: Math.random() * canvas.width,\n    y: Math.random() * canvas.height,\n    speed: 1 + Math.random() * 3\n  });\n}\n\nfunction update() {\n  // 2. Двигай звёзды вниз\n  // 3. Возвращай наверх\n  for (const s of stars) {\n    s.y += s.speed;\n    if (s.y > canvas.height) {\n      s.y = 0;\n    }\n  }\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#070b1f\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"white\";\n  for (const s of stars) {\n    ctx.fillRect(s.x, s.y, 3, 3);\n  }\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\nloop();\n"
   },
   "quiz": [
    {
     "q": "Как в update сдвинуть все объекты массива?",
     "a": [
      "Перебрать массив циклом и сдвинуть каждый",
      "Сдвинуть сам массив: arr.y += 1",
      "Это невозможно"
     ],
     "c": 0,
     "e": "У массива нет координат — они у каждого объекта внутри."
    }
   ]
  }
 ],
 "id": "anim",
 "icon": "🎬",
 "color": "#ff5c7a",
 "title": "Анимация",
 "desc": "Оживляем картинку: игровой цикл, скорость, отскоки и таймеры"
});
