/* Собрано из content/11-physics.txt командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */
window.COURSE = window.COURSE || [];
window.COURSE.push({
 "lessons": [
  {
   "id": "phys-1",
   "title": "Столкновение прямоугольников",
   "theory": "Самый важный вопрос в любой игре: **столкнулись ли два объекта?** Пуля попала во врага? Герой подобрал монету? Мяч коснулся ракетки?\n\nЕсли объекты — прямоугольники (а в играх почти всё можно считать прямоугольниками), есть простая проверка. Она называется **AABB** — сложное имя, простая идея.\n\n## Идея: когда прямоугольники НЕ пересекаются?\n\nПроще подумать наоборот. Два прямоугольника точно **не** касаются, если один из них:\n- целиком **левее** другого, или\n- целиком **правее**, или\n- целиком **выше**, или\n- целиком **ниже**.\n\nВо всех остальных случаях — пересекаются! Записываем «пересекаются» сразу:\n\n```code\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w &&   // левый край a левее правого края b\n         a.x + a.w > b.x &&   // правый край a правее левого края b\n         a.y < b.y + b.h &&   // верх a выше низа b\n         a.y + a.h > b.y;     // низ a ниже верха b\n}\n```\n\nВсе четыре условия через `&&` — должны выполняться **одновременно**.\n\n## Попробуй сам\n\nДвигай синий квадрат стрелками — при касании красный станет жёлтым:\n\n```js canvas\nconst a = { x: 50, y: 140, w: 50, h: 50 };\nconst b = { x: 250, y: 120, w: 80, h: 80 };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction loop() {\n  if (keys.ArrowRight) a.x += 3;\n  if (keys.ArrowLeft) a.x -= 3;\n  if (keys.ArrowUp) a.y -= 3;\n  if (keys.ArrowDown) a.y += 3;\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = rectsCollide(a, b) ? \"yellow\" : \"tomato\";\n  ctx.fillRect(b.x, b.y, b.w, b.h);\n  ctx.fillStyle = \"deepskyblue\";\n  ctx.fillRect(a.x, a.y, a.w, a.h);\n  requestAnimationFrame(loop);\n}\nloop();\n```\n\n> 🎮 Эта функция будет почти в каждой твоей игре. Её стоит понять один раз как следует — и пользоваться всю жизнь.",
   "task": {
    "tests": [
     [
      "Пересекающиеся прямоугольники → true",
      "rectsCollide({ x: 0, y: 0, w: 50, h: 50 }, { x: 30, y: 30, w: 50, h: 50 }) === true"
     ],
     [
      "Один внутри другого → true",
      "rectsCollide({ x: 0, y: 0, w: 100, h: 100 }, { x: 40, y: 40, w: 10, h: 10 }) === true && rectsCollide({ x: 40, y: 40, w: 10, h: 10 }, { x: 0, y: 0, w: 100, h: 100 }) === true"
     ],
     [
      "Далеко слева/справа → false",
      "rectsCollide({ x: 0, y: 0, w: 20, h: 20 }, { x: 100, y: 0, w: 20, h: 20 }) === false && rectsCollide({ x: 100, y: 0, w: 20, h: 20 }, { x: 0, y: 0, w: 20, h: 20 }) === false"
     ],
     [
      "Далеко сверху/снизу → false",
      "rectsCollide({ x: 0, y: 0, w: 20, h: 20 }, { x: 0, y: 100, w: 20, h: 20 }) === false && rectsCollide({ x: 0, y: 100, w: 20, h: 20 }, { x: 0, y: 0, w: 20, h: 20 }) === false"
     ],
     [
      "Совпадают по x, но разнесены по y → false",
      "rectsCollide({ x: 0, y: 0, w: 50, h: 20 }, { x: 10, y: 40, w: 20, h: 20 }) === false"
     ],
     [
      "Вплотную, но без перекрытия → false",
      "rectsCollide({ x: 0, y: 0, w: 20, h: 20 }, { x: 20, y: 0, w: 20, h: 20 }) === false"
     ]
    ],
    "hints": [
     "Нужны четыре сравнения через `&&`: `a.x < b.x + b.w`, `a.x + a.w > b.x`, …",
     "Полностью: `return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;`"
    ],
    "text": "Напиши функцию `rectsCollide(a, b)`, которая возвращает `true`, если прямоугольники `a` и `b` пересекаются, и `false`, если нет. У каждого прямоугольника есть `x`, `y`, `w` (ширина) и `h` (высота).\n\nРобот проверит много случаев: пересечение, касание вплотную, один внутри другого, далеко друг от друга.",
    "starter": "function rectsCollide(a, b) {\n\n}\n\nconst player = { x: 10, y: 10, w: 30, h: 30 };\nconst coin = { x: 30, y: 30, w: 20, h: 20 };\nconsole.log(rectsCollide(player, coin));\n",
    "solution": "function rectsCollide(a, b) {\n  return a.x < b.x + b.w &&\n         a.x + a.w > b.x &&\n         a.y < b.y + b.h &&\n         a.y + a.h > b.y;\n}\n\nconst player = { x: 10, y: 10, w: 30, h: 30 };\nconst coin = { x: 30, y: 30, w: 20, h: 20 };\nconsole.log(rectsCollide(player, coin));\n"
   },
   "quiz": [
    {
     "q": "Прямоугольник A: x=0, w=10. Прямоугольник B: x=20, w=10. Они на одной высоте. Пересекаются?",
     "a": [
      "Да",
      "Нет"
     ],
     "c": 1,
     "e": "Правый край A — 10, а левый край B — 20. Между ними зазор."
    }
   ]
  },
  {
   "id": "phys-2",
   "title": "Столкновение кругов",
   "theory": "Мячи, монеты, астероиды — круглые. Для кругов проверка ещё проще!\n\nДва круга касаются, если **расстояние между их центрами меньше суммы радиусов**.\n\n```code\nfunction circlesCollide(a, b) {\n  const dx = a.x - b.x;\n  const dy = a.y - b.y;\n  const dist = Math.sqrt(dx * dx + dy * dy);\n  return dist < a.r + b.r;\n}\n```\n\nРасстояние считается по теореме Пифагора: `dx` и `dy` — катеты, `dist` — гипотенуза. Есть и готовая функция: `Math.hypot(dx, dy)` [хайпо́т] делает то же самое.\n\n```js canvas\nconst a = { x: 100, y: 160, r: 40 };\nconst b = { x: 300, y: 160, r: 60 };\n\ncanvas.addEventListener(\"mousemove\", (e) => {\n  const rect = canvas.getBoundingClientRect();\n  a.x = (e.clientX - rect.left) * canvas.width / rect.width;\n  a.y = (e.clientY - rect.top) * canvas.height / rect.height;\n});\n\nfunction loop() {\n  const hit = Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = hit ? \"gold\" : \"slateblue\";\n  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();\n  ctx.fillStyle = \"tomato\";\n  ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();\n  ctx.fillStyle = \"white\"; ctx.font = \"18px Arial\";\n  ctx.fillText(hit ? \"Столкновение!\" : \"Води мышкой\", 12, 26);\n  requestAnimationFrame(loop);\n}\nloop();\n```\n\n> 💡 Хитрость профессионалов: квадратный корень — медленная операция. Можно сравнивать **квадраты**: `dx*dx + dy*dy < (a.r + b.r) * (a.r + b.r)`. Результат тот же, а считается быстрее. Для наших игр разницы не будет — но приятно знать.",
   "task": {
    "tests": [
     [
      "Пересекающиеся круги → true",
      "circlesCollide({ x: 0, y: 0, r: 10 }, { x: 15, y: 0, r: 10 }) === true"
     ],
     [
      "Далёкие круги → false",
      "circlesCollide({ x: 0, y: 0, r: 10 }, { x: 100, y: 0, r: 10 }) === false"
     ],
     [
      "По диагонали: (0,0) r=10 и (30,40) r=45 → true, r=30 → false",
      "circlesCollide({ x: 0, y: 0, r: 10 }, { x: 30, y: 40, r: 45 }) === true && circlesCollide({ x: 0, y: 0, r: 10 }, { x: 30, y: 40, r: 30 }) === false"
     ],
     [
      "Маленький круг внутри большого → true",
      "circlesCollide({ x: 50, y: 50, r: 100 }, { x: 60, y: 55, r: 5 }) === true"
     ]
    ],
    "hints": [
     "Сначала разницы: `const dx = a.x - b.x;` и `const dy = a.y - b.y;`",
     "Расстояние: `Math.sqrt(dx * dx + dy * dy)` (или `Math.hypot(dx, dy)`), и `return dist < a.r + b.r;`"
    ],
    "text": "Напиши функцию `circlesCollide(a, b)`, которая возвращает `true`, если круги `a` и `b` пересекаются. У каждого круга есть `x`, `y` (центр) и `r` (радиус).",
    "starter": "function circlesCollide(a, b) {\n\n}\n\nconsole.log(circlesCollide({ x: 0, y: 0, r: 10 }, { x: 15, y: 0, r: 10 }));\n",
    "solution": "function circlesCollide(a, b) {\n  const dx = a.x - b.x;\n  const dy = a.y - b.y;\n  const dist = Math.sqrt(dx * dx + dy * dy);\n  return dist < a.r + b.r;\n}\n\nconsole.log(circlesCollide({ x: 0, y: 0, r: 10 }, { x: 15, y: 0, r: 10 }));\n"
   },
   "quiz": [
    {
     "q": "Круги радиусом 5 и 7, расстояние между центрами 10. Пересекаются?",
     "a": [
      "Да",
      "Нет"
     ],
     "c": 0,
     "e": "10 < 5 + 7 = 12 — пересекаются."
    }
   ]
  },
  {
   "id": "phys-3",
   "title": "Гравитация",
   "theory": "Как сделать, чтобы предметы **падали**, как в жизни? В реальности падающий предмет не просто летит вниз — он **разгоняется**. Каждую секунду быстрее и быстрее.\n\nВ игре это делается в две строчки:\n\n```code\nplayer.vy += gravity;   // гравитация увеличивает скорость падения\nplayer.y += player.vy;  // скорость меняет положение\n```\n\n`gravity` [гра́вити] — небольшое число, например `0.5`. Каждый кадр скорость падения `vy` увеличивается на 0.5: 0.5, 1, 1.5, 2… — объект разгоняется.\n\n## Земля\n\nЧтобы объект не провалился сквозь пол, проверяем: если его низ ниже земли — ставим ровно на землю и обнуляем скорость.\n\n```js canvas\nconst groundY = 280;\nconst gravity = 0.5;\nconst box = { x: 220, y: 0, w: 40, h: 40, vy: 0 };\n\ncanvas.addEventListener(\"click\", () => { box.y = 0; box.vy = 0; });\n\nfunction update() {\n  box.vy += gravity;\n  box.y += box.vy;\n  if (box.y + box.h > groundY) {\n    box.y = groundY - box.h;\n    box.vy = 0;\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#3b7d3b\";\n  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);\n  ctx.fillStyle = \"orange\";\n  ctx.fillRect(box.x, box.y, box.w, box.h);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"16px Arial\";\n  ctx.fillText(\"Кликни, чтобы уронить ящик ещё раз\", 10, 24);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n```\n\n## Отскок вместо остановки\n\nЕсли вместо `vy = 0` написать `vy = -vy * 0.7`, ящик будет подпрыгивать, каждый раз всё ниже — как мячик. Число 0.7 — «упругость».\n\n> 🎮 Подбирая `gravity`, можно сделать игру «на Луне» (0.15) или «на Юпитере» (1.2). В Марио гравитация сильнее при падении, чем при подъёме, — от этого прыжок кажется «тяжёлым» и приятным.",
   "task": {
    "tests": [
     [
      "В воздухе скорость падения растёт на gravity",
      "(function () { player.y = 50; player.vy = 2; update(); return player.vy === 2.5 && player.y === 52.5; })()"
     ],
     [
      "Игрок разгоняется: каждый кадр падает быстрее",
      "(function () { player.y = 0; player.vy = 0; update(); var a = player.y; update(); var b = player.y; update(); var c = player.y; return b - a > a && c - b > b - a; })()"
     ],
     [
      "На земле игрок стоит ровно на groundY и не проваливается",
      "(function () { player.y = groundY - player.h - 1; player.vy = 6; update(); return player.y + player.h === groundY && player.vy === 0; })()"
     ],
     [
      "Флаг onGround: true на земле, false в воздухе",
      "(function () { player.y = groundY - player.h; player.vy = 0; update(); var a = player.onGround === true; player.y = 50; player.vy = 0; update(); return a && player.onGround === false; })()"
     ]
    ],
    "hints": [
     "Первые две строчки: `player.vy += gravity;` и `player.y += player.vy;`",
     "Затем: `if (player.y + player.h > groundY) { player.y = groundY - player.h; player.vy = 0; player.onGround = true; } else { player.onGround = false; }`"
    ],
    "text": "Допиши `update()`, чтобы игрок падал под действием гравитации:\n\n1. Увеличивай `player.vy` на `gravity`.\n2. Сдвигай `player.y` на `player.vy`.\n3. Если низ игрока (`player.y + player.h`) ниже земли `groundY` — поставь игрока ровно на землю, обнули `vy` и поставь `player.onGround = true`. Иначе — `player.onGround = false`.",
    "canvas": true,
    "starter": "const groundY = 280;\nconst gravity = 0.5;\nconst player = { x: 220, y: 20, w: 40, h: 40, vy: 0, onGround: false };\n\nfunction update() {\n\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#3b7d3b\";\n  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);\n  ctx.fillStyle = \"orange\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const groundY = 280;\nconst gravity = 0.5;\nconst player = { x: 220, y: 20, w: 40, h: 40, vy: 0, onGround: false };\n\nfunction update() {\n  player.vy += gravity;\n  player.y += player.vy;\n\n  if (player.y + player.h > groundY) {\n    player.y = groundY - player.h;\n    player.vy = 0;\n    player.onGround = true;\n  } else {\n    player.onGround = false;\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#3b7d3b\";\n  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);\n  ctx.fillStyle = \"orange\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Что делает строчка `player.vy += gravity`?",
     "a": [
      "Увеличивает скорость падения",
      "Двигает игрока вниз на gravity пикселей",
      "Останавливает игрока"
     ],
     "c": 0,
     "e": "Гравитация меняет скорость, а скорость меняет положение."
    }
   ]
  },
  {
   "id": "phys-4",
   "title": "Прыжок",
   "theory": "Прыжок — это просто **резкая скорость вверх**. Помнишь, что вверх — это отрицательный y? Значит, прыжок — это `vy = -10` (или другое отрицательное число). А дальше гравитация сама замедлит подъём, остановит героя в верхней точке и вернёт вниз. Получается красивая дуга — бесплатно!\n\n```code\nif (keys[\" \"] && player.onGround) {\n  player.vy = -jumpPower;\n}\n```\n\n## Зачем проверять onGround?\n\nБез этой проверки герой сможет прыгать **в воздухе** — бесконечно взлетая вверх. Поэтому прыгать можно, только стоя на земле. (А если захочешь сделать «двойной прыжок» — считай прыжки и разрешай второй в воздухе.)\n\n```js canvas\nconst groundY = 280, gravity = 0.6, jumpPower = 12;\nconst player = { x: 60, y: 200, w: 36, h: 36, vy: 0, onGround: false };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  if (keys[\"ArrowRight\"]) player.x += 4;\n  if (keys[\"ArrowLeft\"]) player.x -= 4;\n  if (keys[\" \"] && player.onGround) player.vy = -jumpPower;\n\n  player.vy += gravity;\n  player.y += player.vy;\n  if (player.y + player.h > groundY) {\n    player.y = groundY - player.h;\n    player.vy = 0;\n    player.onGround = true;\n  } else {\n    player.onGround = false;\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#3b7d3b\";\n  ctx.fillRect(0, groundY, canvas.width, 40);\n  ctx.font = \"36px Arial\";\n  ctx.fillText(\"🐱\", player.x, player.y + 32);\n  ctx.fillStyle = \"white\"; ctx.font = \"16px Arial\";\n  ctx.fillText(\"← → — бег, пробел — прыжок\", 10, 24);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n```\n\n> 🧠 Высота прыжка зависит от `jumpPower` и `gravity`. Хочешь прыжок выше — увеличь `jumpPower`. Хочешь «парящий» прыжок — уменьши `gravity`.",
   "task": {
    "tests": [
     [
      "Пробел на земле — игрок подпрыгивает (летит вверх)",
      "(function () { player.y = groundY - player.h; player.vy = 0; player.onGround = true; __press(\" \"); update(); __release(\" \"); return player.vy < 0 && player.y < groundY - player.h; })()"
     ],
     [
      "Скорость прыжка — jumpPower",
      "(function () { player.y = groundY - player.h; player.vy = 0; player.onGround = true; __press(\" \"); update(); __release(\" \"); return Math.abs(player.vy - (-jumpPower + gravity)) < 0.001; })()"
     ],
     [
      "В воздухе прыгнуть нельзя",
      "(function () { player.y = 100; player.vy = 1; player.onGround = false; __press(\" \"); update(); __release(\" \"); return player.vy > 1; })()"
     ],
     [
      "Без пробела игрок не прыгает",
      "(function () { player.y = groundY - player.h; player.vy = 0; player.onGround = true; update(); return player.vy === 0; })()"
     ]
    ],
    "hints": [
     "Условие с двумя частями: `if (keys[\" \"] && player.onGround) { ... }`",
     "Внутри: `player.vy = -jumpPower;` — минус, потому что вверх."
    ],
    "text": "Добавь в `update()` прыжок: если зажат **пробел** (`keys[\" \"]`) **и** игрок стоит на земле (`player.onGround`) — задай `player.vy = -jumpPower`.\n\nГравитация и земля уже написаны. Прыжок поставь **перед** гравитацией.",
    "canvas": true,
    "starter": "const groundY = 280;\nconst gravity = 0.6;\nconst jumpPower = 12;\nconst player = { x: 60, y: 244, w: 36, h: 36, vy: 0, onGround: true };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  if (keys[\"ArrowRight\"]) player.x += 4;\n  if (keys[\"ArrowLeft\"]) player.x -= 4;\n\n  // Прыжок\n\n\n  player.vy += gravity;\n  player.y += player.vy;\n  if (player.y + player.h > groundY) {\n    player.y = groundY - player.h;\n    player.vy = 0;\n    player.onGround = true;\n  } else {\n    player.onGround = false;\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#3b7d3b\";\n  ctx.fillRect(0, groundY, canvas.width, 40);\n  ctx.fillStyle = \"orange\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const groundY = 280;\nconst gravity = 0.6;\nconst jumpPower = 12;\nconst player = { x: 60, y: 244, w: 36, h: 36, vy: 0, onGround: true };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  if (keys[\"ArrowRight\"]) player.x += 4;\n  if (keys[\"ArrowLeft\"]) player.x -= 4;\n\n  // Прыжок\n  if (keys[\" \"] && player.onGround) {\n    player.vy = -jumpPower;\n  }\n\n  player.vy += gravity;\n  player.y += player.vy;\n  if (player.y + player.h > groundY) {\n    player.y = groundY - player.h;\n    player.vy = 0;\n    player.onGround = true;\n  } else {\n    player.onGround = false;\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#3b7d3b\";\n  ctx.fillRect(0, groundY, canvas.width, 40);\n  ctx.fillStyle = \"orange\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Почему скорость прыжка отрицательная?",
     "a": [
      "На холсте y растёт вниз, а прыжок — вверх",
      "Так короче писать",
      "Это ошибка, должна быть положительной"
     ],
     "c": 0,
     "e": "Движение вверх — уменьшение y, значит скорость отрицательная."
    },
    {
     "q": "Что будет без проверки onGround?",
     "a": [
      "Можно прыгать в воздухе бесконечно",
      "Нельзя будет прыгнуть вообще",
      "Ничего не изменится"
     ],
     "c": 0,
     "e": "Каждый кадр с зажатым пробелом снова давал бы скорость вверх."
    }
   ]
  },
  {
   "id": "phys-5",
   "title": "Сбор предметов",
   "theory": "Соединим всё вместе: у нас есть **массив монет** и функция **столкновения**. Если герой касается монеты — монета исчезает, счёт растёт.\n\n```js canvas\nconst player = { x: 30, y: 140, w: 34, h: 34 };\nconst coins = [];\nlet score = 0;\nfor (let i = 0; i < 8; i++) {\n  coins.push({ x: 60 + Math.random() * 380, y: 30 + Math.random() * 260, w: 20, h: 20 });\n}\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction update() {\n  if (keys.ArrowRight) player.x += 4;\n  if (keys.ArrowLeft) player.x -= 4;\n  if (keys.ArrowUp) player.y -= 4;\n  if (keys.ArrowDown) player.y += 4;\n  for (let i = coins.length - 1; i >= 0; i--) {\n    if (rectsCollide(player, coins[i])) {\n      coins.splice(i, 1);\n      score++;\n    }\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.font = \"20px Arial\";\n  for (const c of coins) ctx.fillText(\"🪙\", c.x - 2, c.y + 18);\n  ctx.font = \"32px Arial\";\n  ctx.fillText(\"🐹\", player.x - 2, player.y + 30);\n  ctx.fillStyle = \"white\"; ctx.font = \"18px Arial\";\n  ctx.fillText(coins.length ? `Монеты: ${score}` : \"Все монеты собраны! 🎉\", 10, 24);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n```\n\nУзнаёшь приёмы?\n\n- массив объектов-монет, созданный в цикле со случайными координатами;\n- `rectsCollide` из первого урока модуля;\n- удаление из массива **с конца** через `splice` — как в модуле про массивы.\n\n> 🎮 Ровно так же работает подбор бонусов, аптечек, ключей и попадание пуль во врагов.",
   "task": {
    "tests": [
     [
      "Касание монеты убирает её и даёт очко",
      "(function () { coins.length = 0; coins.push({ x: 100, y: 100, w: 20, h: 20 }); player.x = 95; player.y = 95; var s = score; update(); return coins.length === 0 && score === s + 1; })()"
     ],
     [
      "Далёкие монеты не собираются",
      "(function () { coins.length = 0; coins.push({ x: 400, y: 250, w: 20, h: 20 }); player.x = 10; player.y = 10; var s = score; update(); return coins.length === 1 && score === s; })()"
     ],
     [
      "Две монеты под игроком — обе собраны за один кадр",
      "(function () { coins.length = 0; coins.push({ x: 100, y: 100, w: 10, h: 10 }); coins.push({ x: 112, y: 112, w: 10, h: 10 }); coins.push({ x: 400, y: 10, w: 10, h: 10 }); player.x = 95; player.y = 95; var s = score; update(); return coins.length === 1 && score === s + 2 && coins[0].x === 400; })()"
     ]
    ],
    "hints": [
     "Цикл с конца: `for (let i = coins.length - 1; i >= 0; i--) { ... }`",
     "Внутри: `if (rectsCollide(player, coins[i])) { coins.splice(i, 1); score++; }`"
    ],
    "text": "Допиши в `update()` сбор монет: пройди по массиву `coins` **с конца**, и если игрок касается монеты (`rectsCollide(player, coins[i])`) — удали её через `splice` и увеличь `score` на 1.",
    "canvas": true,
    "starter": "const player = { x: 30, y: 140, w: 34, h: 34 };\nconst coins = [];\nlet score = 0;\nfor (let i = 0; i < 8; i++) {\n  coins.push({ x: 60 + i * 50, y: 40 + (i % 3) * 100, w: 20, h: 20 });\n}\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction update() {\n  if (keys.ArrowRight) player.x += 4;\n  if (keys.ArrowLeft) player.x -= 4;\n  if (keys.ArrowUp) player.y -= 4;\n  if (keys.ArrowDown) player.y += 4;\n\n  // Сбор монет\n\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"gold\";\n  for (const c of coins) ctx.fillRect(c.x, c.y, c.w, c.h);\n  ctx.fillStyle = \"deepskyblue\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Монеты: \" + score, 10, 24);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const player = { x: 30, y: 140, w: 34, h: 34 };\nconst coins = [];\nlet score = 0;\nfor (let i = 0; i < 8; i++) {\n  coins.push({ x: 60 + i * 50, y: 40 + (i % 3) * 100, w: 20, h: 20 });\n}\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction update() {\n  if (keys.ArrowRight) player.x += 4;\n  if (keys.ArrowLeft) player.x -= 4;\n  if (keys.ArrowUp) player.y -= 4;\n  if (keys.ArrowDown) player.y += 4;\n\n  // Сбор монет\n  for (let i = coins.length - 1; i >= 0; i--) {\n    if (rectsCollide(player, coins[i])) {\n      coins.splice(i, 1);\n      score++;\n    }\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"gold\";\n  for (const c of coins) ctx.fillRect(c.x, c.y, c.w, c.h);\n  ctx.fillStyle = \"deepskyblue\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Монеты: \" + score, 10, 24);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Почему монеты удаляют в цикле с конца массива?",
     "a": [
      "Чтобы при удалении не пропустить следующую монету",
      "Чтобы монеты исчезали красивее",
      "Так требует функция splice"
     ],
     "c": 0,
     "e": "После splice элементы сдвигаются влево — при движении с конца это не мешает."
    }
   ]
  },
  {
   "id": "phys-6",
   "title": "Частицы — взрывы и искры",
   "theory": "Хочешь, чтобы игра выглядела «сочно»? Добавь **частицы**: при взрыве разлетаются искры, при сборе монеты — звёздочки. Это делается очень просто, а эффект — огромный.\n\n**Частица** — маленький объект с координатами, скоростью и **временем жизни**. Каждый кадр она летит, а её жизнь уменьшается. Жизнь закончилась — частицу удаляем.\n\n```js canvas\nconst particles = [];\n\nfunction explode(x, y) {\n  for (let i = 0; i < 40; i++) {\n    const angle = Math.random() * Math.PI * 2;\n    const speed = 1 + Math.random() * 4;\n    particles.push({\n      x: x, y: y,\n      vx: Math.cos(angle) * speed,\n      vy: Math.sin(angle) * speed,\n      life: 60,\n      color: `hsl(${20 + Math.random() * 40}, 100%, 60%)`\n    });\n  }\n}\n\ncanvas.addEventListener(\"click\", (e) => {\n  const r = canvas.getBoundingClientRect();\n  explode((e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height);\n});\n\nfunction update() {\n  for (let i = particles.length - 1; i >= 0; i--) {\n    const p = particles[i];\n    p.x += p.vx;\n    p.y += p.vy;\n    p.vy += 0.05;\n    p.life--;\n    if (p.life <= 0) particles.splice(i, 1);\n  }\n}\n\nfunction draw() {\n  ctx.fillStyle = \"rgba(10, 14, 35, 0.35)\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  for (const p of particles) {\n    ctx.globalAlpha = p.life / 60;\n    ctx.fillStyle = p.color;\n    ctx.fillRect(p.x, p.y, 3, 3);\n  }\n  ctx.globalAlpha = 1;\n  ctx.fillStyle = \"white\"; ctx.font = \"18px Arial\";\n  ctx.fillText(\"Кликай — будут взрывы!\", 12, 26);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nexplode(240, 160);\nloop();\n```\n\n## Новые приёмы\n\n- `Math.cos(angle)` и `Math.sin(angle)` [кос, сайн] превращают **угол** в направление: частицы разлетаются во все стороны по кругу.\n- `ctx.globalAlpha` [гло́убал а́льфа] — прозрачность от 0 до 1. Чем меньше жизни, тем прозрачнее частица — она красиво тает.\n- Фон рисуется **полупрозрачным** `rgba(..., 0.35)`, поэтому старые кадры не стираются полностью — остаётся лёгкий шлейф.\n\n> 🧠 Не пугайся синусов и косинусов: достаточно запомнить, что `Math.cos(угол) * скорость` и `Math.sin(угол) * скорость` дают vx и vy для движения под этим углом.",
   "task": {
    "tests": [
     [
      "spawn добавляет 20 частиц в нужной точке с life 40",
      "(function () { particles.length = 0; spawn(100, 50); return particles.length === 20 && particles.every(function (p) { return p.x === 100 && p.y === 50 && p.life === 40 && typeof p.vx === \"number\" && typeof p.vy === \"number\"; }); })()"
     ],
     [
      "Скорости частиц случайные и разные",
      "(function () { particles.length = 0; spawn(0, 0); var v = {}; particles.forEach(function (p) { v[p.vx.toFixed(3)] = 1; }); return Object.keys(v).length > 5; })()"
     ],
     [
      "update двигает частицы и уменьшает life",
      "(function () { particles.length = 0; particles.push({ x: 10, y: 10, vx: 2, vy: -1, life: 5 }); update(); var p = particles[0]; return p && p.x === 12 && p.y === 9 && p.life === 4; })()"
     ],
     [
      "Частицы с закончившейся жизнью удаляются",
      "(function () { particles.length = 0; particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1 }); particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1 }); particles.push({ x: 5, y: 5, vx: 0, vy: 0, life: 10 }); update(); return particles.length === 1 && particles[0].x === 5; })()"
     ]
    ],
    "hints": [
     "В spawn — цикл на 20 повторов с `particles.push({ x: x, y: y, vx: Math.random() * 6 - 3, vy: Math.random() * 6 - 3, life: 40 });`",
     "В update — цикл с конца: сдвиг `p.x += p.vx; p.y += p.vy;`, затем `p.life--;` и `if (p.life <= 0) { particles.splice(i, 1); }`"
    ],
    "text": "Допиши систему частиц:\n\n1. Функция `spawn(x, y)` должна добавлять в массив `particles` **20 частиц** в точке `(x, y)` — у каждой: `x`, `y`, случайные `vx` и `vy` (например, от −3 до 3) и `life: 40`.\n2. В `update()` для каждой частицы: сдвинь на `vx`/`vy`, уменьши `life` на 1, и если `life` стала 0 или меньше — удали частицу (цикл с конца!).",
    "canvas": true,
    "starter": "const particles = [];\n\nfunction spawn(x, y) {\n\n}\n\nfunction update() {\n\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"orange\";\n  for (const p of particles) ctx.fillRect(p.x, p.y, 4, 4);\n}\n\ncanvas.addEventListener(\"click\", (e) => {\n  const r = canvas.getBoundingClientRect();\n  spawn((e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height);\n});\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const particles = [];\n\nfunction spawn(x, y) {\n  for (let i = 0; i < 20; i++) {\n    particles.push({\n      x: x,\n      y: y,\n      vx: Math.random() * 6 - 3,\n      vy: Math.random() * 6 - 3,\n      life: 40\n    });\n  }\n}\n\nfunction update() {\n  for (let i = particles.length - 1; i >= 0; i--) {\n    const p = particles[i];\n    p.x += p.vx;\n    p.y += p.vy;\n    p.life--;\n    if (p.life <= 0) {\n      particles.splice(i, 1);\n    }\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"orange\";\n  for (const p of particles) ctx.fillRect(p.x, p.y, 4, 4);\n}\n\ncanvas.addEventListener(\"click\", (e) => {\n  const r = canvas.getBoundingClientRect();\n  spawn((e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height);\n});\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Что даёт `Math.random() * 6 - 3`?",
     "a": [
      "Случайное число от −3 до 3",
      "От 0 до 6",
      "От 3 до 6"
     ],
     "c": 0,
     "e": "От 0 до 6, сдвинутое на −3."
    }
   ]
  }
 ],
 "id": "phys",
 "icon": "💥",
 "color": "#ffb020",
 "title": "Физика и столкновения",
 "desc": "Столкновения, гравитация, прыжки, сбор монет и эффекты частиц"
});
