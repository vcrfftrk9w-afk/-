/* Собрано из content/10-controls.txt командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */
window.COURSE = window.COURSE || [];
window.COURSE.push({
 "lessons": [
  {
   "id": "ctrl-1",
   "title": "События клавиатуры",
   "theory": "Игра становится игрой, когда ею можно **управлять**. Когда игрок нажимает клавишу, браузер создаёт **событие** (event [ивэ́нт]). Наша задача — «подписаться» на это событие: сказать браузеру, какую функцию вызвать.\n\n```js canvas\ndocument.addEventListener(\"keydown\", (e) => {\n  console.log(\"Нажата клавиша: \" + e.key);\n});\n\nctx.fillStyle = \"white\";\nctx.font = \"20px Arial\";\nctx.fillText(\"Кликни сюда и нажимай клавиши\", 90, 165);\n```\n\nКликни по холсту и понажимай клавиши — в консоли появятся их названия.\n\n## Разбор\n\n- `document` [до́кьюмент] — вся страница;\n- `addEventListener` [эд ивэ́нт ли́снер] — «добавить слушателя события»;\n- `\"keydown\"` [ки да́ун] — событие «клавиша нажата». Есть ещё `\"keyup\"` [ки ап] — «отпущена»;\n- `(e) => { ... }` — функция, которая вызовется при нажатии. В `e` браузер положит информацию о событии;\n- `e.key` — какая клавиша нажата.\n\n## Названия клавиш\n\n| Клавиша | e.key |\n|---|---|\n| ← → ↑ ↓ | `\"ArrowLeft\"`, `\"ArrowRight\"`, `\"ArrowUp\"`, `\"ArrowDown\"` |\n| Пробел | `\" \"` (пробел в кавычках) |\n| Enter | `\"Enter\"` |\n| Буква A | `\"a\"` (или `\"A\"` с Shift) |\n\n## Двигаем героя\n\n```js canvas\nconst player = { x: 220, y: 140, size: 40 };\n\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \"ArrowRight\") player.x += 20;\n  if (e.key === \"ArrowLeft\") player.x -= 20;\n  if (e.key === \"ArrowUp\") player.y -= 20;\n  if (e.key === \"ArrowDown\") player.y += 20;\n});\n\nfunction loop() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.font = player.size + \"px Arial\";\n  ctx.fillText(\"🐸\", player.x, player.y + player.size);\n  requestAnimationFrame(loop);\n}\nloop();\n```\n\n> 💡 Если `if` содержит всего одну команду, фигурные скобки можно не писать — так короче. Но если команд больше одной — скобки обязательны.\n\n> ⚠️ Чтобы игра «слышала» клавиатуру, по ней нужно сначала **кликнуть** — так браузер понимает, куда отправлять нажатия.",
   "task": {
    "tests": [
     [
      "Стрелка вправо сдвигает игрока на 10 вправо",
      "(function () { player.x = 200; __press(\"ArrowRight\"); return player.x === 210; })()"
     ],
     [
      "Стрелка влево сдвигает игрока на 10 влево",
      "(function () { player.x = 200; __press(\"ArrowLeft\"); return player.x === 190; })()"
     ],
     [
      "Другие клавиши игрока не двигают",
      "(function () { player.x = 200; __press(\"a\"); __press(\" \"); return player.x === 200; })()"
     ],
     [
      "Используется addEventListener(\"keydown\", ...)",
      "/addEventListener\\s*\\(\\s*[\"']keydown[\"']/.test(__code)"
     ]
    ],
    "hints": [
     "`document.addEventListener(\"keydown\", (e) => { ... });`",
     "Внутри: `if (e.key === \"ArrowRight\") { player.x += 10; }` и такое же условие для `\"ArrowLeft\"` с `-=`."
    ],
    "text": "Научи игрока ходить влево-вправо: подпишись на событие `\"keydown\"` и\n- при стрелке **вправо** (`\"ArrowRight\"`) увеличивай `player.x` на 10;\n- при стрелке **влево** (`\"ArrowLeft\"`) уменьшай `player.x` на 10.\n\nРобот сам «нажмёт» клавиши и проверит.",
    "canvas": true,
    "starter": "const player = { x: 220, y: 240, w: 40, h: 40 };\n\n// Подпишись на нажатия клавиш\n\n\nfunction loop() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"lime\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n  requestAnimationFrame(loop);\n}\nloop();\n",
    "solution": "const player = { x: 220, y: 240, w: 40, h: 40 };\n\n// Подпишись на нажатия клавиш\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \"ArrowRight\") {\n    player.x += 10;\n  }\n  if (e.key === \"ArrowLeft\") {\n    player.x -= 10;\n  }\n});\n\nfunction loop() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"lime\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n  requestAnimationFrame(loop);\n}\nloop();\n"
   },
   "quiz": [
    {
     "q": "Какое событие происходит, когда клавишу отпускают?",
     "a": [
      "keydown",
      "keyup",
      "keypress"
     ],
     "c": 1,
     "e": "keydown — нажали, keyup — отпустили."
    },
    {
     "q": "Чему равно e.key при нажатии пробела?",
     "a": [
      "`\" \"`",
      "`\"Space\"`",
      "`\"пробел\"`"
     ],
     "c": 0,
     "e": "Для пробела e.key — это строка с одним пробелом."
    }
   ]
  },
  {
   "id": "ctrl-2",
   "title": "Плавное движение — зажатые клавиши",
   "theory": "Попробуй в прошлом примере зажать стрелку: герой сначала делает шаг, потом замирает, а потом начинает дёргаться. Это потому, что `keydown` повторяется с той же задержкой, что и буквы при наборе текста. Для игр это не годится!\n\n## Решение: запоминаем, какие клавиши зажаты\n\n1. При `keydown` записываем: «клавиша нажата» — `keys[e.key] = true`.\n2. При `keyup` — «отпущена» — `keys[e.key] = false`.\n3. В `update()` **каждый кадр** проверяем, что зажато, и двигаем героя.\n\n```js canvas\nconst player = { x: 220, y: 140, size: 40, speed: 4 };\nconst keys = {};\n\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  if (keys[\"ArrowRight\"]) player.x += player.speed;\n  if (keys[\"ArrowLeft\"]) player.x -= player.speed;\n  if (keys[\"ArrowUp\"]) player.y -= player.speed;\n  if (keys[\"ArrowDown\"]) player.y += player.speed;\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.font = player.size + \"px Arial\";\n  ctx.fillText(\"🚀\", player.x, player.y + player.size);\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\nloop();\n```\n\nПопробуй: движение плавное, и можно зажать две стрелки сразу — герой полетит по диагонали!\n\n## Что такое keys\n\n`keys` — обычный объект. Ключами в нём становятся названия клавиш: после нажатия → вправо он выглядит так: `{ ArrowRight: true }`. `keys[\"ArrowRight\"]` и `keys.ArrowRight` — одно и то же.\n\n## WASD и русская раскладка\n\nМногие играют буквами W, A, S, D. Но осторожно: если у игрока включена **русская раскладка**, `e.key` для W будет `\"ц\"`! Чтобы не зависеть от раскладки, используют `e.code` — название **физической** клавиши:\n\n| Клавиша | e.key (англ / рус) | e.code |\n|---|---|---|\n| W | `\"w\"` / `\"ц\"` | `\"KeyW\"` |\n| A | `\"a\"` / `\"ф\"` | `\"KeyA\"` |\n| Пробел | `\" \"` | `\"Space\"` |\n\n> 💡 Для букв в играх надёжнее `e.code`: `keys[e.code] = true`, а потом `if (keys[\"KeyW\"]) ...`. Тогда управление работает при любой раскладке.",
   "task": {
    "tests": [
     [
      "Нажатие записывается в keys",
      "(function () { __press(\"ArrowRight\"); var ok = keys[\"ArrowRight\"] === true; __release(\"ArrowRight\"); return ok; })()"
     ],
     [
      "Отпускание записывает false",
      "(function () { __press(\"ArrowLeft\"); __release(\"ArrowLeft\"); return !keys[\"ArrowLeft\"]; })()"
     ],
     [
      "Пока зажата →, каждый update сдвигает вправо на speed",
      "(function () { player.x = 100; __press(\"ArrowRight\"); update(); update(); __release(\"ArrowRight\"); return player.x === 110; })()"
     ],
     [
      "Пока зажата ←, update сдвигает влево",
      "(function () { player.x = 100; __press(\"ArrowLeft\"); update(); __release(\"ArrowLeft\"); return player.x === 95; })()"
     ],
     [
      "Когда ничего не зажато, игрок стоит",
      "(function () { player.x = 100; update(); update(); return player.x === 100; })()"
     ]
    ],
    "hints": [
     "`document.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });` и такой же для `\"keyup\"` с `false`.",
     "В update: `if (keys[\"ArrowRight\"]) { player.x += player.speed; }` и то же для `\"ArrowLeft\"`."
    ],
    "text": "Сделай плавное управление:\n\n1. В объект `keys` при `keydown` записывай `true` для нажатой клавиши (`keys[e.key] = true`), при `keyup` — `false`.\n2. В `update()`: если зажата стрелка вправо — увеличивай `player.x` на `player.speed`, влево — уменьшай.",
    "canvas": true,
    "starter": "const player = { x: 220, y: 240, w: 40, h: 40, speed: 5 };\nconst keys = {};\n\n// 1. Слушай keydown и keyup\n\n\nfunction update() {\n  // 2. Двигай игрока, пока зажата клавиша\n\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"orange\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\nloop();\n",
    "solution": "const player = { x: 220, y: 240, w: 40, h: 40, speed: 5 };\nconst keys = {};\n\n// 1. Слушай keydown и keyup\ndocument.addEventListener(\"keydown\", (e) => {\n  keys[e.key] = true;\n});\ndocument.addEventListener(\"keyup\", (e) => {\n  keys[e.key] = false;\n});\n\nfunction update() {\n  // 2. Двигай игрока, пока зажата клавиша\n  if (keys[\"ArrowRight\"]) {\n    player.x += player.speed;\n  }\n  if (keys[\"ArrowLeft\"]) {\n    player.x -= player.speed;\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"orange\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\nloop();\n"
   },
   "quiz": [
    {
     "q": "Почему для игр плохо двигать героя прямо в keydown?",
     "a": [
      "Событие повторяется с задержкой, движение получается рывками",
      "keydown не работает со стрелками",
      "Так нельзя по правилам языка"
     ],
     "c": 0,
     "e": "keydown срабатывает как автоповтор при наборе текста — сначала пауза, потом частые повторы."
    },
    {
     "q": "Что надёжнее для клавиши W при любой раскладке?",
     "a": [
      "`e.key === \"w\"`",
      "`e.code === \"KeyW\"`"
     ],
     "c": 1,
     "e": "e.code — физическая клавиша, она не зависит от языка раскладки."
    }
   ]
  },
  {
   "id": "ctrl-3",
   "title": "Границы экрана",
   "theory": "Сейчас герой может уйти за край экрана и потеряться. Добавим **границы**.\n\nИдея: после движения проверяем — не вылез ли герой — и если вылез, ставим его обратно на край.\n\n```js canvas\nconst player = { x: 220, y: 140, w: 40, h: 40, speed: 6 };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  if (keys[\"ArrowRight\"]) player.x += player.speed;\n  if (keys[\"ArrowLeft\"]) player.x -= player.speed;\n  if (keys[\"ArrowUp\"]) player.y -= player.speed;\n  if (keys[\"ArrowDown\"]) player.y += player.speed;\n\n  if (player.x < 0) player.x = 0;\n  if (player.x + player.w > canvas.width) player.x = canvas.width - player.w;\n  if (player.y < 0) player.y = 0;\n  if (player.y + player.h > canvas.height) player.y = canvas.height - player.h;\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"violet\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n```\n\n## Почему `canvas.width - player.w`?\n\n`player.x` — это **левый** край героя. Правый край — `player.x + player.w`. Чтобы правый край не вылез за холст, левый должен быть не больше `canvas.width - player.w`.\n\n## То же самое через clamp\n\nПомнишь функцию `clamp` из модуля про функции? Она идеально подходит:\n\n```code\nplayer.x = clamp(player.x, 0, canvas.width - player.w);\nplayer.y = clamp(player.y, 0, canvas.height - player.h);\n```\n\nИли через `Math.max` и `Math.min`:\n\n```code\nplayer.x = Math.max(0, Math.min(player.x, canvas.width - player.w));\n```\n\n> 🎮 А можно не останавливать, а **переносить** на другую сторону, как в Pac-Man: вышел справа — появился слева. Для этого: `if (player.x > canvas.width) player.x = -player.w;`",
   "task": {
    "tests": [
     [
      "Игрок не уходит за левый край",
      "(function () { player.x = 2; __press(\"ArrowLeft\"); update(); __release(\"ArrowLeft\"); return player.x === 0; })()"
     ],
     [
      "Игрок не уходит за правый край",
      "(function () { player.x = canvas.width - player.w - 2; __press(\"ArrowRight\"); update(); __release(\"ArrowRight\"); return player.x === canvas.width - player.w; })()"
     ],
     [
      "Далеко за краем — возвращается на край",
      "(function () { player.x = -100; update(); var a = player.x === 0; player.x = 9999; update(); return a && player.x === canvas.width - player.w; })()"
     ],
     [
      "В середине движется свободно",
      "(function () { player.x = 200; __press(\"ArrowRight\"); update(); __release(\"ArrowRight\"); return player.x === 206; })()"
     ]
    ],
    "hints": [
     "Левый край: `if (player.x < 0) { player.x = 0; }`",
     "Правый край: `if (player.x + player.w > canvas.width) { player.x = canvas.width - player.w; }`"
    ],
    "text": "Допиши в `update()` ограничения, чтобы игрок **не выходил** за левый и правый края холста.\n\n- слева: `x` не меньше 0;\n- справа: правый край (`x + w`) не больше `canvas.width`.\n\nРобот попробует вытолкнуть игрока за края.",
    "canvas": true,
    "starter": "const player = { x: 220, y: 240, w: 40, h: 40, speed: 6 };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  if (keys[\"ArrowRight\"]) player.x += player.speed;\n  if (keys[\"ArrowLeft\"]) player.x -= player.speed;\n\n  // Не пускай игрока за края\n\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"violet\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const player = { x: 220, y: 240, w: 40, h: 40, speed: 6 };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  if (keys[\"ArrowRight\"]) player.x += player.speed;\n  if (keys[\"ArrowLeft\"]) player.x -= player.speed;\n\n  // Не пускай игрока за края\n  if (player.x < 0) {\n    player.x = 0;\n  }\n  if (player.x + player.w > canvas.width) {\n    player.x = canvas.width - player.w;\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"violet\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Холст шириной 480, игрок шириной 40. Какой максимальный x у игрока, чтобы он не вылезал справа?",
     "a": [
      "480",
      "440",
      "520"
     ],
     "c": 1,
     "e": "x — левый край, правый край = x + 40 ≤ 480, значит x ≤ 440."
    }
   ]
  },
  {
   "id": "ctrl-4",
   "title": "Мышь и касания",
   "theory": "Многие игры управляются мышью или пальцем: кликеры, стрелялки, головоломки. События мыши подписываются так же, как клавиатурные, — только на холст.\n\n```js canvas\ncanvas.addEventListener(\"click\", (e) => {\n  console.log(\"Клик!\", e.offsetX, e.offsetY);\n});\nctx.fillStyle = \"white\";\nctx.font = \"22px Arial\";\nctx.fillText(\"Кликай по холсту\", 150, 165);\n```\n\n| Событие | Когда |\n|---|---|\n| `\"click\"` | клик (или касание пальцем) |\n| `\"mousedown\"` | кнопку мыши нажали |\n| `\"mouseup\"` | отпустили |\n| `\"mousemove\"` | мышь двигается |\n\n`e.offsetX` и `e.offsetY` [о́фсет] — где был клик **внутри** элемента.\n\n## Точные координаты холста\n\nЕсть тонкость: холст на экране может быть растянут или сжат (например, на телефоне он меньше 480 пикселей). Тогда `offsetX` — это координата **на экране**, а не на холсте. Надёжная формула пересчёта:\n\n```js canvas\nfunction getMousePos(e) {\n  const rect = canvas.getBoundingClientRect();\n  return {\n    x: (e.clientX - rect.left) * canvas.width / rect.width,\n    y: (e.clientY - rect.top) * canvas.height / rect.height\n  };\n}\n\ncanvas.addEventListener(\"click\", (e) => {\n  const pos = getMousePos(e);\n  ctx.fillStyle = `hsl(${Math.random() * 360}, 90%, 60%)`;\n  ctx.beginPath();\n  ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);\n  ctx.fill();\n});\n\nctx.fillStyle = \"white\";\nctx.font = \"20px Arial\";\nctx.fillText(\"Кликай — будут появляться круги\", 95, 165);\n```\n\n- `canvas.getBoundingClientRect()` — где холст на экране и какого он размера;\n- `e.clientX - rect.left` — сколько пикселей от левого края холста;\n- `* canvas.width / rect.width` — пересчёт из экранных пикселей в пиксели холста.\n\n> 💡 Эту функцию не нужно запоминать — просто копируй её в свои игры. Так делают все программисты.\n\n> 📱 Событие `click` срабатывает и от касания пальцем, так что такие игры работают на телефоне.",
   "task": {
    "tests": [
     [
      "Клик добавляет точку в clicks",
      "(function () { var n = clicks.length; __click(100, 50); return clicks.length === n + 1; })()"
     ],
     [
      "Координаты точки совпадают с местом клика",
      "(function () { __click(300, 200); var c = clicks[clicks.length - 1]; return Math.abs(c.x - 300) < 3 && Math.abs(c.y - 200) < 3; })()"
     ],
     [
      "Используется getMousePos",
      "/getMousePos\\s*\\(\\s*e\\s*\\)/.test(__codeNS)"
     ]
    ],
    "hints": [
     "`canvas.addEventListener(\"click\", (e) => { ... });`",
     "Внутри: `const pos = getMousePos(e);` и `clicks.push({ x: pos.x, y: pos.y });`"
    ],
    "text": "Сделай «рисовалку кругами»:\n\n1. При клике по холсту получи точные координаты клика функцией `getMousePos(e)` (она уже написана).\n2. Добавь в массив `clicks` объект `{ x: ..., y: ... }` с этими координатами.\n\nИгровой цикл уже рисует круги из массива `clicks`.",
    "canvas": true,
    "starter": "const clicks = [];\n\nfunction getMousePos(e) {\n  const rect = canvas.getBoundingClientRect();\n  return {\n    x: (e.clientX - rect.left) * canvas.width / rect.width,\n    y: (e.clientY - rect.top) * canvas.height / rect.height\n  };\n}\n\n// Подпишись на клик и добавляй точки в clicks\n\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"deepskyblue\";\n  for (const c of clicks) {\n    ctx.beginPath();\n    ctx.arc(c.x, c.y, 15, 0, Math.PI * 2);\n    ctx.fill();\n  }\n  requestAnimationFrame(draw);\n}\ndraw();\n",
    "solution": "const clicks = [];\n\nfunction getMousePos(e) {\n  const rect = canvas.getBoundingClientRect();\n  return {\n    x: (e.clientX - rect.left) * canvas.width / rect.width,\n    y: (e.clientY - rect.top) * canvas.height / rect.height\n  };\n}\n\n// Подпишись на клик и добавляй точки в clicks\ncanvas.addEventListener(\"click\", (e) => {\n  const pos = getMousePos(e);\n  clicks.push({ x: pos.x, y: pos.y });\n});\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"deepskyblue\";\n  for (const c of clicks) {\n    ctx.beginPath();\n    ctx.arc(c.x, c.y, 15, 0, Math.PI * 2);\n    ctx.fill();\n  }\n  requestAnimationFrame(draw);\n}\ndraw();\n"
   },
   "quiz": [
    {
     "q": "Какое событие срабатывает и от мыши, и от касания пальцем?",
     "a": [
      "click",
      "keydown",
      "mousemove"
     ],
     "c": 0,
     "e": "click срабатывает при щелчке мышью и при коротком касании экрана."
    }
   ]
  },
  {
   "id": "ctrl-5",
   "title": "Мини-игра «Поймай квадрат»",
   "theory": "Соберём первую настоящую игру! Правила: на экране прыгает квадрат. Кликнул по нему — получил очко, квадрат перепрыгнул в случайное место. За 15 секунд набери как можно больше.\n\nГлавное новое — **проверка попадания**: попал ли клик внутрь квадрата?\n\n```code\nfunction isInside(px, py, box) {\n  return px >= box.x && px <= box.x + box.size &&\n         py >= box.y && py <= box.y + box.size;\n}\n```\n\nТочка внутри квадрата, если она правее левого края **и** левее правого **и** ниже верхнего **и** выше нижнего. Четыре условия через `&&`.\n\nВот полная игра — запусти и поиграй:\n\n```js canvas\nconst target = { x: 200, y: 120, size: 50 };\nlet score = 0;\nlet timeLeft = 15;\n\nfunction getMousePos(e) {\n  const r = canvas.getBoundingClientRect();\n  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };\n}\n\nfunction moveTarget() {\n  target.x = Math.random() * (canvas.width - target.size);\n  target.y = Math.random() * (canvas.height - target.size);\n}\n\ncanvas.addEventListener(\"click\", (e) => {\n  if (timeLeft <= 0) return;\n  const p = getMousePos(e);\n  if (p.x >= target.x && p.x <= target.x + target.size && p.y >= target.y && p.y <= target.y + target.size) {\n    score++;\n    moveTarget();\n  }\n});\n\nconst timer = setInterval(() => {\n  timeLeft--;\n  if (timeLeft <= 0) clearInterval(timer);\n}, 1000);\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"tomato\";\n  ctx.fillRect(target.x, target.y, target.size, target.size);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"20px Arial\";\n  ctx.textAlign = \"left\";\n  ctx.fillText(`Очки: ${score}   Время: ${timeLeft}`, 12, 28);\n  if (timeLeft <= 0) {\n    ctx.textAlign = \"center\";\n    ctx.font = \"bold 40px Arial\";\n    ctx.fillText(`Игра окончена! ${score} очков`, 240, 170);\n  }\n  requestAnimationFrame(draw);\n}\ndraw();\n```\n\n> 🧠 `return` в начале обработчика клика — «если время вышло, ничего не делай». Такой приём называется **ранний выход** и избавляет от лишней вложенности.\n\n> 🎮 Эту игру легко улучшать: квадрат может уменьшаться с каждым очком, двигаться сам, а за промах можно отнимать очки. Попробуй в песочнице!",
   "task": {
    "tests": [
     [
      "isInside: точка в центре квадрата — внутри",
      "isInside(25, 25, { x: 0, y: 0, size: 50 }) === true && isInside(130, 70, { x: 100, y: 50, size: 40 }) === true"
     ],
     [
      "isInside: точки снаружи — не внутри",
      "isInside(60, 25, { x: 0, y: 0, size: 50 }) === false && isInside(25, 60, { x: 0, y: 0, size: 50 }) === false && isInside(99, 60, { x: 100, y: 50, size: 40 }) === false && isInside(120, 49, { x: 100, y: 50, size: 40 }) === false"
     ],
     [
      "Клик по цели даёт очко и переносит цель",
      "(function () { target.x = 100; target.y = 100; var s = score; __click(125, 125); return score === s + 1 && !(target.x === 100 && target.y === 100); })()"
     ],
     [
      "Клик мимо цели очков не даёт",
      "(function () { target.x = 100; target.y = 100; var s = score; __click(20, 20); return score === s && target.x === 100; })()"
     ]
    ],
    "hints": [
     "`return px >= box.x && px <= box.x + box.size && py >= box.y && py <= box.y + box.size;`",
     "В обработчике: `if (isInside(p.x, p.y, target)) { score++; moveTarget(); }`"
    ],
    "text": "Напиши ядро игры:\n\n1. Функцию `isInside(px, py, box)` — возвращает `true`, если точка `(px, py)` внутри квадрата `box` (у него `x`, `y` и `size`).\n2. В обработчике клика: если клик попал в `target` (используй `isInside`) — увеличь `score` на 1 и вызови `moveTarget()`.",
    "canvas": true,
    "starter": "const target = { x: 200, y: 120, size: 50 };\nlet score = 0;\n\nfunction getMousePos(e) {\n  const r = canvas.getBoundingClientRect();\n  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };\n}\n\nfunction moveTarget() {\n  target.x = Math.random() * (canvas.width - target.size);\n  target.y = Math.random() * (canvas.height - target.size);\n}\n\n// 1. Функция isInside\n\n\n// 2. Обработчик клика\ncanvas.addEventListener(\"click\", (e) => {\n  const p = getMousePos(e);\n\n});\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"tomato\";\n  ctx.fillRect(target.x, target.y, target.size, target.size);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"20px Arial\";\n  ctx.fillText(\"Очки: \" + score, 12, 28);\n  requestAnimationFrame(draw);\n}\ndraw();\n",
    "solution": "const target = { x: 200, y: 120, size: 50 };\nlet score = 0;\n\nfunction getMousePos(e) {\n  const r = canvas.getBoundingClientRect();\n  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };\n}\n\nfunction moveTarget() {\n  target.x = Math.random() * (canvas.width - target.size);\n  target.y = Math.random() * (canvas.height - target.size);\n}\n\n// 1. Функция isInside\nfunction isInside(px, py, box) {\n  return px >= box.x && px <= box.x + box.size &&\n         py >= box.y && py <= box.y + box.size;\n}\n\n// 2. Обработчик клика\ncanvas.addEventListener(\"click\", (e) => {\n  const p = getMousePos(e);\n  if (isInside(p.x, p.y, target)) {\n    score++;\n    moveTarget();\n  }\n});\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"tomato\";\n  ctx.fillRect(target.x, target.y, target.size, target.size);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"20px Arial\";\n  ctx.fillText(\"Очки: \" + score, 12, 28);\n  requestAnimationFrame(draw);\n}\ndraw();\n"
   },
   "quiz": [
    {
     "q": "Квадрат: x = 100, y = 100, size = 50. Внутри ли точка (160, 120)?",
     "a": [
      "Да",
      "Нет"
     ],
     "c": 1,
     "e": "Правый край квадрата — 150, а точка правее: 160 > 150."
    }
   ]
  }
 ],
 "id": "ctrl",
 "icon": "🕹️",
 "color": "#7c6cff",
 "title": "Управление",
 "desc": "Игрок берёт управление: клавиатура, мышь и касания"
});
