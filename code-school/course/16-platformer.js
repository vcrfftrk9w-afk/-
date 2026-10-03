/* Собрано из content/16-platformer.txt командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */
window.COURSE = window.COURSE || [];
window.COURSE.push({
 "lessons": [
  {
   "id": "plt-1",
   "title": "Шаг 1. Уровень из текста",
   "xp": 20,
   "theory": "Четвёртый проект — **платформер**, как Марио: герой бегает, прыгает по платформам, собирает монеты, прыгает на врагов и добегает до флага.\n\n## Уровень — это текст!\n\nРисовать уровень координатами — долго и неудобно. Профессионалы делают иначе: уровень описывают **картой из символов**, а программа превращает её в мир.\n\n```code\nconst level = [\n  \"............\",\n  \"............\",\n  \"..........F.\",\n  \"......o.####\",\n  \"...o..###...\",\n  \"..###.......\",\n  \"o.......E..o\",\n  \"############\"\n];\n```\n\n| Символ | Что это |\n|---|---|\n| `#` | блок земли / платформы |\n| `.` | пустота |\n| `o` | монета |\n| `E` | враг (enemy) |\n| `F` | флаг финиша (flag) |\n\nКаждый символ — клетка 40 × 40 пикселей (`TILE` [тайл] — «плитка»). 12 символов × 40 = 480 — ширина холста, 8 строк × 40 = 320 — высота.\n\n> 🎮 Хочешь новый уровень — просто нарисуй другую карту! Не нужно менять ни строчки кода. Так делают уровни во множестве игр, и ты тоже сможешь придумывать свои.\n\n## Превращаем карту в блоки\n\nДвойной цикл по строкам и символам (как в модуле «Массивы»):\n\n```code\nfor (let row = 0; row < level.length; row++) {\n  for (let col = 0; col < level[row].length; col++) {\n    const ch = level[row][col];         // символ в этой клетке\n    if (ch === \"#\") {\n      tiles.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });\n    }\n  }\n}\n```\n\nНомер столбца × размер клетки = x в пикселях, номер строки × размер = y.\n\n## План\n\n1. **Уровень из текста** ← ты здесь\n2. Стоим на платформах\n3. Монеты и флаг финиша\n4. Враги и жизни",
   "task": {
    "tests": [
     [
      "Блоков столько же, сколько символов # в карте",
      "(function () { buildLevel(); var n = level.join(\"\").split(\"#\").length - 1; return tiles.length === n; })()"
     ],
     [
      "Каждый блок стоит на месте своего #",
      "(function () { buildLevel(); return tiles.every(function (t) { return t.w === TILE && t.h === TILE && level[t.y / TILE] && level[t.y / TILE][t.x / TILE] === \"#\"; }); })()"
     ],
     [
      "buildLevel работает и с другой картой",
      "(function () { var saved = level.slice(); level.length = 0; level.push(\"#..\", \".#.\", \"..#\"); buildLevel(); var ok = tiles.length === 3 && tiles.some(function (t) { return t.x === 2 * TILE && t.y === 2 * TILE; }); level.length = 0; saved.forEach(function (r) { level.push(r); }); buildLevel(); return ok; })()"
     ],
     [
      "Все блоки нарисованы",
      "(function () { buildLevel(); __clearDraw(); draw(); var r = __drawn(\"fillRect\"); return tiles.length > 0 && tiles.every(function (t) { return r.some(function (c) { return c.a[0] === t.x && c.a[1] === t.y && c.a[2] === TILE; }); }); })()"
     ]
    ],
    "hints": [
     "Внутри buildLevel — двойной цикл: `for (let row = 0; row < level.length; row++)` и `for (let col = 0; col < level[row].length; col++)`.",
     "В теле: `const ch = level[row][col]; if (ch === \"#\") { tiles.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE }); }`",
     "В draw: `for (const t of tiles) { ctx.fillRect(t.x, t.y, t.w, t.h); }`"
    ],
    "text": "1. Допиши `buildLevel()`: пройди по всей карте `level` и для каждого `#` добавь в `tiles` блок `{ x, y, w: TILE, h: TILE }`.\n2. В `draw()` нарисуй все блоки из `tiles`.\n\nФизика героя пока простая — он падает на дно холста сквозь блоки. Это исправим на следующем шаге.",
    "canvas": true,
    "starter": "const TILE = 40;\nconst level = [\n  \"............\",\n  \"............\",\n  \"..........F.\",\n  \"......o.####\",\n  \"...o..###...\",\n  \"..###.......\",\n  \"o.......E..o\",\n  \"############\"\n];\nlet tiles = [];\n\nconst player = { x: 40, y: 200, w: 26, h: 34, vy: 0 };\n\n// 1. Превратить карту в блоки\nfunction buildLevel() {\n  tiles = [];\n\n}\n\nfunction update() {\n  player.vy += 0.6;\n  player.y += player.vy;\n  if (player.y + player.h > canvas.height) {\n    player.y = canvas.height - player.h;\n    player.vy = 0;\n  }\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#5c94fc\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  // 2. Нарисовать блоки\n  ctx.fillStyle = \"#c84c0c\";\n\n  ctx.fillStyle = \"#ffd166\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nbuildLevel();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const TILE = 40;\nconst level = [\n  \"............\",\n  \"............\",\n  \"..........F.\",\n  \"......o.####\",\n  \"...o..###...\",\n  \"..###.......\",\n  \"o.......E..o\",\n  \"############\"\n];\nlet tiles = [];\n\nconst player = { x: 40, y: 200, w: 26, h: 34, vy: 0 };\n\n// 1. Превратить карту в блоки\nfunction buildLevel() {\n  tiles = [];\n  for (let row = 0; row < level.length; row++) {\n    for (let col = 0; col < level[row].length; col++) {\n      const ch = level[row][col];\n      if (ch === \"#\") {\n        tiles.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });\n      }\n    }\n  }\n}\n\nfunction update() {\n  player.vy += 0.6;\n  player.y += player.vy;\n  if (player.y + player.h > canvas.height) {\n    player.y = canvas.height - player.h;\n    player.vy = 0;\n  }\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#5c94fc\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  // 2. Нарисовать блоки\n  ctx.fillStyle = \"#c84c0c\";\n  for (const t of tiles) {\n    ctx.fillRect(t.x, t.y, t.w, t.h);\n  }\n  ctx.fillStyle = \"#ffd166\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nbuildLevel();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Символ стоит в строке 3, столбце 5 карты. Какие у блока координаты при TILE = 40?",
     "a": [
      "x = 200, y = 120",
      "x = 120, y = 200",
      "x = 5, y = 3"
     ],
     "c": 0,
     "e": "x = столбец × 40 = 200, y = строка × 40 = 120."
    }
   ]
  },
  {
   "id": "plt-2",
   "title": "Шаг 2. Стоим на платформах",
   "xp": 25,
   "theory": "Самая хитрая часть платформера — **столкновения с блоками**. Герой должен стоять на платформах, упираться в стены и ударяться головой о потолок.\n\n## Секрет: двигаемся по осям по очереди\n\nЕсли сдвинуть героя сразу по x и y, а потом обнаружить, что он застрял в блоке, непонятно, **откуда** он пришёл: сверху? сбоку? Поэтому профессионалы двигают **по очереди**:\n\n1. Сдвинули по **x** → проверили все блоки → если врезались, значит упёрлись **сбоку**: выталкиваем по x.\n2. Сдвинули по **y** → проверили все блоки → если врезались, значит пришли **сверху или снизу**: выталкиваем по y.\n\n## Вертикальные столкновения\n\nПосле сдвига по y, для каждого блока, с которым пересеклись:\n\n- если летели **вниз** (`vy > 0`) — приземлились: ставим героя **на** блок, `vy = 0`, `onGround = true`;\n- если летели **вверх** (`vy < 0`) — ударились головой: ставим героя **под** блок, `vy = 0`.\n\n```code\nplayer.onGround = false;\nfor (const t of tiles) {\n  if (rectsCollide(player, t)) {\n    if (player.vy > 0) {\n      player.y = t.y - player.h;     // встать сверху\n      player.vy = 0;\n      player.onGround = true;\n    } else if (player.vy < 0) {\n      player.y = t.y + t.h;          // упереться головой снизу\n      player.vy = 0;\n    }\n  }\n}\n```\n\n`onGround = false` перед циклом — «пока не доказано, что стоим, считаем, что в воздухе».\n\n## Горизонтальные столкновения\n\nУже написаны в коде — посмотри, они устроены так же: шли вправо — встаём слева от блока, шли влево — справа.\n\n> 🧠 Этот приём («сначала x, потом y») — основа физики в тысячах 2D-игр. Разберись в нём, и сможешь сделать любой платформер.",
   "task": {
    "tests": [
     [
      "Падая на блок, герой встаёт на него",
      "(function () { tiles.length = 0; tiles.push({ x: 100, y: 200, w: 40, h: 40 }); player.x = 105; player.y = 200 - player.h - 2; player.vy = 4; update(); return player.y === 200 - player.h && player.vy === 0 && player.onGround === true; })()"
     ],
     [
      "Стоя на блоке, герой не проваливается кадр за кадром",
      "(function () { tiles.length = 0; tiles.push({ x: 100, y: 200, w: 40, h: 40 }); player.x = 105; player.y = 200 - player.h; player.vy = 0; for (var i = 0; i < 10; i++) update(); return player.y === 200 - player.h && player.onGround === true; })()"
     ],
     [
      "Прыгая вверх, герой ударяется головой о блок",
      "(function () { tiles.length = 0; tiles.push({ x: 100, y: 200, w: 40, h: 40 }); player.x = 105; player.y = 243; player.vy = -6; update(); return player.y === 240 && player.vy === 0; })()"
     ],
     [
      "В воздухе onGround = false",
      "(function () { tiles.length = 0; tiles.push({ x: 300, y: 280, w: 40, h: 40 }); player.x = 40; player.y = 50; player.vy = 0; player.onGround = true; update(); var ok = player.onGround === false; buildLevel(); return ok; })()"
     ]
    ],
    "hints": [
     "После `player.y += player.vy;` напиши `player.onGround = false;` и цикл `for (const t of tiles) { if (rectsCollide(player, t)) { ... } }`",
     "Внутри: `if (player.vy > 0) { player.y = t.y - player.h; player.vy = 0; player.onGround = true; } else if (player.vy < 0) { player.y = t.y + t.h; player.vy = 0; }`"
    ],
    "text": "Допиши в `update()` **вертикальные** столкновения с блоками (после строчки `player.y += player.vy`):\n\n1. Перед циклом поставь `player.onGround = false`.\n2. Для каждого блока, с которым пересекается герой: если `vy > 0` — поставь героя на блок, обнули `vy`, `onGround = true`; если `vy < 0` — поставь героя под блок и обнули `vy`.\n\nУправление: ← → бег, пробел или ↑ — прыжок.",
    "canvas": true,
    "starter": "const TILE = 40;\nconst level = [\n  \"............\",\n  \"............\",\n  \"..........F.\",\n  \"......o.####\",\n  \"...o..###...\",\n  \"..###.......\",\n  \"o.......E..o\",\n  \"############\"\n];\nconst SPEED = 3.5, GRAVITY = 0.6, JUMP = 11;\nlet tiles = [];\nconst player = { x: 40, y: 200, w: 26, h: 34, vx: 0, vy: 0, onGround: false };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction buildLevel() {\n  tiles = [];\n  for (let row = 0; row < level.length; row++) {\n    for (let col = 0; col < level[row].length; col++) {\n      if (level[row][col] === \"#\") tiles.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });\n    }\n  }\n}\n\nfunction update() {\n  // управление\n  player.vx = 0;\n  if (keys[\"ArrowLeft\"]) player.vx = -SPEED;\n  if (keys[\"ArrowRight\"]) player.vx = SPEED;\n  if ((keys[\" \"] || keys[\"ArrowUp\"]) && player.onGround) player.vy = -JUMP;\n\n  // движение по x и упор в стены\n  player.x += player.vx;\n  for (const t of tiles) {\n    if (rectsCollide(player, t)) {\n      if (player.vx > 0) player.x = t.x - player.w;\n      if (player.vx < 0) player.x = t.x + t.w;\n    }\n  }\n  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));\n\n  // движение по y\n  player.vy += GRAVITY;\n  player.y += player.vy;\n  // Столкновения по вертикали\n\n\n  // упал в пропасть — в начало\n  if (player.y > canvas.height) { player.x = 40; player.y = 200; player.vy = 0; }\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#5c94fc\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#c84c0c\";\n  for (const t of tiles) ctx.fillRect(t.x, t.y, t.w, t.h);\n  ctx.fillStyle = \"#ffd166\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nbuildLevel();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const TILE = 40;\nconst level = [\n  \"............\",\n  \"............\",\n  \"..........F.\",\n  \"......o.####\",\n  \"...o..###...\",\n  \"..###.......\",\n  \"o.......E..o\",\n  \"############\"\n];\nconst SPEED = 3.5, GRAVITY = 0.6, JUMP = 11;\nlet tiles = [];\nconst player = { x: 40, y: 200, w: 26, h: 34, vx: 0, vy: 0, onGround: false };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction buildLevel() {\n  tiles = [];\n  for (let row = 0; row < level.length; row++) {\n    for (let col = 0; col < level[row].length; col++) {\n      if (level[row][col] === \"#\") tiles.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });\n    }\n  }\n}\n\nfunction update() {\n  // управление\n  player.vx = 0;\n  if (keys[\"ArrowLeft\"]) player.vx = -SPEED;\n  if (keys[\"ArrowRight\"]) player.vx = SPEED;\n  if ((keys[\" \"] || keys[\"ArrowUp\"]) && player.onGround) player.vy = -JUMP;\n\n  // движение по x и упор в стены\n  player.x += player.vx;\n  for (const t of tiles) {\n    if (rectsCollide(player, t)) {\n      if (player.vx > 0) player.x = t.x - player.w;\n      if (player.vx < 0) player.x = t.x + t.w;\n    }\n  }\n  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));\n\n  // движение по y\n  player.vy += GRAVITY;\n  player.y += player.vy;\n  // Столкновения по вертикали\n  player.onGround = false;\n  for (const t of tiles) {\n    if (rectsCollide(player, t)) {\n      if (player.vy > 0) {\n        player.y = t.y - player.h;\n        player.vy = 0;\n        player.onGround = true;\n      } else if (player.vy < 0) {\n        player.y = t.y + t.h;\n        player.vy = 0;\n      }\n    }\n  }\n\n  // упал в пропасть — в начало\n  if (player.y > canvas.height) { player.x = 40; player.y = 200; player.vy = 0; }\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#5c94fc\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#c84c0c\";\n  for (const t of tiles) ctx.fillRect(t.x, t.y, t.w, t.h);\n  ctx.fillStyle = \"#ffd166\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n}\n\nbuildLevel();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Зачем двигать героя сначала по x, а потом по y, с проверкой после каждого шага?",
     "a": [
      "Чтобы понять, с какой стороны герой врезался в блок",
      "Так быстрее работает",
      "Иначе нельзя написать код"
     ],
     "c": 0,
     "e": "После движения по одной оси ясно: столкновение произошло именно по этой оси."
    }
   ]
  },
  {
   "id": "plt-3",
   "title": "Шаг 3. Монеты и флаг",
   "xp": 20,
   "theory": "Теперь используем другие символы карты: `o` — монеты, `F` — флаг финиша.\n\n## Расширяем buildLevel\n\nВ том же двойном цикле добавляем новые проверки:\n\n```code\nif (ch === \"o\") coins.push({ x: col * TILE + 12, y: row * TILE + 12, w: 16, h: 16 });\nif (ch === \"F\") goal = { x: col * TILE + 8, y: row * TILE, w: 24, h: TILE };\n```\n\nМонета маленькая (16 × 16) и стоит в середине клетки: отступ 12 = (40 − 16) / 2. Флаг — узкий столб высотой в клетку.\n\n## Сбор и финиш\n\nМонеты собираются так же, как в модуле «Физика», — цикл с конца и `splice`. А флаг — это просто проверка столкновения, после которой игра переходит в состояние «победа»:\n\n```code\nif (rectsCollide(player, goal)) state = \"win\";\n```\n\n> 🎮 Хочешь, чтобы флаг открывался, только когда собраны все монеты? Добавь условие `&& coins.length === 0`. Такие маленькие правила делают игру интереснее.",
   "task": {
    "tests": [
     [
      "Монет столько же, сколько символов o, и они на своих местах",
      "(function () { buildLevel(); var n = level.join(\"\").split(\"o\").length - 1; return coins.length === n && coins.every(function (c) { return c.w === 16 && level[Math.floor(c.y / TILE)][Math.floor(c.x / TILE)] === \"o\"; }); })()"
     ],
     [
      "Флаг стоит на месте символа F",
      "(function () { buildLevel(); return goal !== null && level[Math.floor(goal.y / TILE)][Math.floor(goal.x / TILE)] === \"F\" && goal.h === TILE; })()"
     ],
     [
      "Касание монеты: монета исчезла, очко добавилось",
      "(function () { state = \"play\"; buildLevel(); var c = coins[0]; player.x = c.x - 4; player.y = c.y - 10; player.vy = 0; var n = coins.length, s = score; update(); return coins.length === n - 1 && score === s + 1; })()"
     ],
     [
      "Касание флага — победа",
      "(function () { state = \"play\"; buildLevel(); player.x = goal.x; player.y = goal.y + 2; player.vy = 0; update(); var ok = state === \"win\"; state = \"play\"; player.x = 40; player.y = 200; return ok; })()"
     ]
    ],
    "hints": [
     "В цикле buildLevel: `if (ch === \"o\") coins.push({ x: col * TILE + 12, y: row * TILE + 12, w: 16, h: 16 });`",
     "И `if (ch === \"F\") goal = { x: col * TILE + 8, y: row * TILE, w: 24, h: TILE };`",
     "В update: цикл с конца по `coins` с `rectsCollide` и `splice`, затем `if (goal && rectsCollide(player, goal)) state = \"win\";`"
    ],
    "text": "1. В `buildLevel()` добавь: символ `o` → монета в `coins` (`x: col * TILE + 12`, `y: row * TILE + 12`, `w: 16`, `h: 16`), символ `F` → флаг `goal` (`x: col * TILE + 8`, `y: row * TILE`, `w: 24`, `h: TILE`).\n2. В `update()` после столкновений: собирай монеты (касание → удалить, `score++`) и, если герой коснулся флага, — `state = \"win\"`.",
    "canvas": true,
    "starter": "const TILE = 40;\nconst level = [\n  \"............\",\n  \"............\",\n  \"..........F.\",\n  \"......o.####\",\n  \"...o..###...\",\n  \"..###.......\",\n  \"o.......E..o\",\n  \"############\"\n];\nconst SPEED = 3.5, GRAVITY = 0.6, JUMP = 11;\nlet tiles = [];\nlet coins = [];\nlet goal = null;\nlet score = 0;\nlet state = \"play\";\nconst player = { x: 40, y: 200, w: 26, h: 34, vx: 0, vy: 0, onGround: false };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction buildLevel() {\n  tiles = [];\n  coins = [];\n  goal = null;\n  for (let row = 0; row < level.length; row++) {\n    for (let col = 0; col < level[row].length; col++) {\n      const ch = level[row][col];\n      if (ch === \"#\") tiles.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });\n      // 1. Монеты и флаг\n\n    }\n  }\n}\n\nfunction update() {\n  if (state !== \"play\") return;\n  player.vx = 0;\n  if (keys[\"ArrowLeft\"]) player.vx = -SPEED;\n  if (keys[\"ArrowRight\"]) player.vx = SPEED;\n  if ((keys[\" \"] || keys[\"ArrowUp\"]) && player.onGround) player.vy = -JUMP;\n\n  player.x += player.vx;\n  for (const t of tiles) {\n    if (rectsCollide(player, t)) {\n      if (player.vx > 0) player.x = t.x - player.w;\n      if (player.vx < 0) player.x = t.x + t.w;\n    }\n  }\n  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));\n\n  player.vy += GRAVITY;\n  player.y += player.vy;\n  player.onGround = false;\n  for (const t of tiles) {\n    if (rectsCollide(player, t)) {\n      if (player.vy > 0) { player.y = t.y - player.h; player.vy = 0; player.onGround = true; }\n      else if (player.vy < 0) { player.y = t.y + t.h; player.vy = 0; }\n    }\n  }\n  if (player.y > canvas.height) { player.x = 40; player.y = 200; player.vy = 0; }\n\n  // 2. Монеты и флаг\n\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#5c94fc\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#c84c0c\";\n  for (const t of tiles) ctx.fillRect(t.x, t.y, t.w, t.h);\n  ctx.font = \"18px Arial\";\n  for (const c of coins) ctx.fillText(\"🪙\", c.x - 2, c.y + 15);\n  if (goal) {\n    ctx.font = \"30px Arial\";\n    ctx.fillText(\"🚩\", goal.x - 4, goal.y + 32);\n  }\n  ctx.fillStyle = \"#ffd166\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Монеты: \" + score, 10, 24);\n  if (state === \"win\") {\n    ctx.font = \"bold 40px Arial\";\n    ctx.textAlign = \"center\";\n    ctx.fillText(\"УРОВЕНЬ ПРОЙДЕН! 🎉\", canvas.width / 2, 160);\n    ctx.textAlign = \"left\";\n  }\n}\n\nbuildLevel();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const TILE = 40;\nconst level = [\n  \"............\",\n  \"............\",\n  \"..........F.\",\n  \"......o.####\",\n  \"...o..###...\",\n  \"..###.......\",\n  \"o.......E..o\",\n  \"############\"\n];\nconst SPEED = 3.5, GRAVITY = 0.6, JUMP = 11;\nlet tiles = [];\nlet coins = [];\nlet goal = null;\nlet score = 0;\nlet state = \"play\";\nconst player = { x: 40, y: 200, w: 26, h: 34, vx: 0, vy: 0, onGround: false };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction buildLevel() {\n  tiles = [];\n  coins = [];\n  goal = null;\n  for (let row = 0; row < level.length; row++) {\n    for (let col = 0; col < level[row].length; col++) {\n      const ch = level[row][col];\n      if (ch === \"#\") tiles.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });\n      // 1. Монеты и флаг\n      if (ch === \"o\") coins.push({ x: col * TILE + 12, y: row * TILE + 12, w: 16, h: 16 });\n      if (ch === \"F\") goal = { x: col * TILE + 8, y: row * TILE, w: 24, h: TILE };\n    }\n  }\n}\n\nfunction update() {\n  if (state !== \"play\") return;\n  player.vx = 0;\n  if (keys[\"ArrowLeft\"]) player.vx = -SPEED;\n  if (keys[\"ArrowRight\"]) player.vx = SPEED;\n  if ((keys[\" \"] || keys[\"ArrowUp\"]) && player.onGround) player.vy = -JUMP;\n\n  player.x += player.vx;\n  for (const t of tiles) {\n    if (rectsCollide(player, t)) {\n      if (player.vx > 0) player.x = t.x - player.w;\n      if (player.vx < 0) player.x = t.x + t.w;\n    }\n  }\n  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));\n\n  player.vy += GRAVITY;\n  player.y += player.vy;\n  player.onGround = false;\n  for (const t of tiles) {\n    if (rectsCollide(player, t)) {\n      if (player.vy > 0) { player.y = t.y - player.h; player.vy = 0; player.onGround = true; }\n      else if (player.vy < 0) { player.y = t.y + t.h; player.vy = 0; }\n    }\n  }\n  if (player.y > canvas.height) { player.x = 40; player.y = 200; player.vy = 0; }\n\n  // 2. Монеты и флаг\n  for (let i = coins.length - 1; i >= 0; i--) {\n    if (rectsCollide(player, coins[i])) {\n      coins.splice(i, 1);\n      score++;\n    }\n  }\n  if (goal && rectsCollide(player, goal)) state = \"win\";\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#5c94fc\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#c84c0c\";\n  for (const t of tiles) ctx.fillRect(t.x, t.y, t.w, t.h);\n  ctx.font = \"18px Arial\";\n  for (const c of coins) ctx.fillText(\"🪙\", c.x - 2, c.y + 15);\n  if (goal) {\n    ctx.font = \"30px Arial\";\n    ctx.fillText(\"🚩\", goal.x - 4, goal.y + 32);\n  }\n  ctx.fillStyle = \"#ffd166\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Монеты: \" + score, 10, 24);\n  if (state === \"win\") {\n    ctx.font = \"bold 40px Arial\";\n    ctx.textAlign = \"center\";\n    ctx.fillText(\"УРОВЕНЬ ПРОЙДЕН! 🎉\", canvas.width / 2, 160);\n    ctx.textAlign = \"left\";\n  }\n}\n\nbuildLevel();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Как сделать новый уровень в этой игре?",
     "a": [
      "Нарисовать другую карту из символов",
      "Переписать функцию update",
      "Поменять размер TILE"
     ],
     "c": 0,
     "e": "Код читает карту и сам строит мир — менять нужно только текст карты."
    }
   ]
  },
  {
   "id": "plt-4",
   "title": "Шаг 4. Враги и жизни",
   "xp": 25,
   "theory": "Какой платформер без врагов! Добавим патрульных: они ходят туда-сюда, касание сбоку отнимает жизнь, а **прыжок сверху** побеждает врага — как в Марио.\n\n## Враг-патрульный\n\n```code\n{ x: ..., y: ..., w: 30, h: 30, vx: 1.2 }\n```\n\nКаждый кадр враг идёт на `vx`. Упёрся в блок или край экрана — разворачивается: `vx = -vx`.\n\n## Прыжок на голову или удар сбоку?\n\nКасание врага бывает двух видов. Как их отличить? Посмотрим, **где был низ героя на прошлом кадре**: если выше верха врага — значит, герой падал сверху:\n\n```code\nconst wasAbove = player.y + player.h - player.vy <= e.y + 6;\nif (player.vy > 0 && wasAbove) {\n  // прыжок сверху — враг повержен, герой отскакивает\n} else {\n  // удар сбоку — герой теряет жизнь\n}\n```\n\n`player.y + player.h - player.vy` — где был низ героя кадр назад (мы вычитаем последний шаг). `+ 6` — небольшой запас, чтобы прыжок засчитывался даже при касании «вскользь».\n\n## Жизни\n\nУдар — минус жизнь и возврат на старт. Жизни кончились — состояние `\"lose\"`. Пробел после конца игры — `restart()`.\n\n> 🏆 Готово! Это уже настоящий платформер. Нарисуй свои уровни картой, добавь шипы (символ `^`), двойной прыжок, движущиеся платформы — и у тебя будет своя игра!",
   "task": {
    "tests": [
     [
      "Враги создаются на месте символов E",
      "(function () { buildLevel(); var n = level.join(\"\").split(\"E\").length - 1; return enemies.length === n && n > 0 && enemies.every(function (e) { return e.w === 30 && e.h === 30 && e.vx === 1.2 && level[Math.floor(e.y / TILE)][Math.floor(e.x / TILE)] === \"E\"; }); })()"
     ],
     [
      "Враг идёт и разворачивается у края экрана",
      "(function () { tiles.length = 0; enemies.length = 0; enemies.push({ x: canvas.width - 31, y: 100, w: 30, h: 30, vx: 2 }); updateEnemies(); var a = enemies[0].vx < 0 && enemies[0].x + enemies[0].w <= canvas.width; updateEnemies(); var b = enemies[0].x < canvas.width - 31; buildLevel(); return a && b; })()"
     ],
     [
      "Враг разворачивается, упёршись в блок",
      "(function () { tiles.length = 0; tiles.push({ x: 200, y: 100, w: 40, h: 40 }); enemies.length = 0; enemies.push({ x: 169, y: 105, w: 30, h: 30, vx: 2 }); updateEnemies(); var ok = enemies[0].vx < 0 && !rectsCollide(enemies[0], tiles[0]); buildLevel(); return ok; })()"
     ],
     [
      "Прыжок сверху побеждает врага",
      "(function () { state = \"play\"; lives = 3; enemies.length = 0; enemies.push({ x: 100, y: 200, w: 30, h: 30, vx: 0 }); player.x = 102; player.y = 200 - player.h + 4; player.vy = 5; var s = score; hitEnemies(); var ok = enemies.length === 0 && player.vy < 0 && score === s + 5 && lives === 3; buildLevel(); return ok; })()"
     ],
     [
      "Касание сбоку отнимает жизнь и возвращает на старт",
      "(function () { state = \"play\"; lives = 3; enemies.length = 0; enemies.push({ x: 100, y: 200, w: 30, h: 30, vx: 0 }); player.x = 80; player.y = 196; player.vy = 0; hitEnemies(); var ok = lives === 2 && player.x === 40 && enemies.length === 1; buildLevel(); return ok; })()"
     ],
     [
      "Последняя жизнь — поражение, пробел — новая игра",
      "(function () { state = \"play\"; lives = 1; hurt(); var a = state === \"lose\"; __press(\" \"); __release(\" \"); return a && state === \"play\" && lives === 3; })()"
     ]
    ],
    "hints": [
     "В buildLevel: `if (ch === \"E\") enemies.push({ x: col * TILE + 5, y: row * TILE + TILE - 30, w: 30, h: 30, vx: 1.2 });`",
     "updateEnemies: для каждого `e.x += e.vx;`, потом `if (tiles.some((t) => rectsCollide(e, t)) || e.x < 0 || e.x + e.w > canvas.width) { e.x -= e.vx; e.vx = -e.vx; }`",
     "hitEnemies: цикл с конца, `if (!rectsCollide(player, e)) continue;`, затем `const wasAbove = player.y + player.h - player.vy <= e.y + 6;` и если `player.vy > 0 && wasAbove` — победа над врагом, иначе `hurt(); return;`"
    ],
    "text": "1. В `buildLevel()`: символ `E` → враг в `enemies`: `{ x: col * TILE + 5, y: row * TILE + TILE - 30, w: 30, h: 30, vx: 1.2 }`.\n2. Допиши `updateEnemies()`: каждый враг сдвигается на `vx`; если коснулся блока или края холста — откатывается назад (`e.x -= e.vx`) и разворачивается (`e.vx = -e.vx`).\n3. Допиши `hitEnemies()`: для каждого врага, которого касается герой (идти с конца!): если герой падал сверху — удали врага, `player.vy = -JUMP * 0.6`, `score += 5`; иначе — вызови `hurt()` и выйди из функции.",
    "canvas": true,
    "starter": "const TILE = 40;\nconst level = [\n  \"............\",\n  \"............\",\n  \"..........F.\",\n  \"......o.####\",\n  \"...o..###...\",\n  \"..###.......\",\n  \"o.......E..o\",\n  \"############\"\n];\nconst SPEED = 3.5, GRAVITY = 0.6, JUMP = 11;\nlet tiles = [], coins = [], enemies = [];\nlet goal = null;\nlet score = 0;\nlet lives = 3;\nlet state = \"play\";\nconst player = { x: 40, y: 200, w: 26, h: 34, vx: 0, vy: 0, onGround: false };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => {\n  keys[e.key] = true;\n  if (e.key === \" \" && state !== \"play\") restart();\n});\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction buildLevel() {\n  tiles = []; coins = []; enemies = []; goal = null;\n  for (let row = 0; row < level.length; row++) {\n    for (let col = 0; col < level[row].length; col++) {\n      const ch = level[row][col];\n      if (ch === \"#\") tiles.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });\n      if (ch === \"o\") coins.push({ x: col * TILE + 12, y: row * TILE + 12, w: 16, h: 16 });\n      if (ch === \"F\") goal = { x: col * TILE + 8, y: row * TILE, w: 24, h: TILE };\n      // 1. Враги\n\n    }\n  }\n}\n\nfunction respawn() {\n  player.x = 40; player.y = 200; player.vx = 0; player.vy = 0;\n}\n\nfunction hurt() {\n  lives--;\n  if (lives <= 0) state = \"lose\";\n  respawn();\n}\n\nfunction restart() {\n  lives = 3; score = 0; state = \"play\";\n  buildLevel();\n  respawn();\n}\n\n// 2. Враги ходят туда-сюда\nfunction updateEnemies() {\n\n}\n\n// 3. Касание врагов\nfunction hitEnemies() {\n\n}\n\nfunction update() {\n  if (state !== \"play\") return;\n  player.vx = 0;\n  if (keys[\"ArrowLeft\"]) player.vx = -SPEED;\n  if (keys[\"ArrowRight\"]) player.vx = SPEED;\n  if ((keys[\" \"] || keys[\"ArrowUp\"]) && player.onGround) player.vy = -JUMP;\n\n  player.x += player.vx;\n  for (const t of tiles) {\n    if (rectsCollide(player, t)) {\n      if (player.vx > 0) player.x = t.x - player.w;\n      if (player.vx < 0) player.x = t.x + t.w;\n    }\n  }\n  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));\n\n  player.vy += GRAVITY;\n  player.y += player.vy;\n  player.onGround = false;\n  for (const t of tiles) {\n    if (rectsCollide(player, t)) {\n      if (player.vy > 0) { player.y = t.y - player.h; player.vy = 0; player.onGround = true; }\n      else if (player.vy < 0) { player.y = t.y + t.h; player.vy = 0; }\n    }\n  }\n  if (player.y > canvas.height) hurt();\n\n  for (let i = coins.length - 1; i >= 0; i--) {\n    if (rectsCollide(player, coins[i])) { coins.splice(i, 1); score++; }\n  }\n  updateEnemies();\n  hitEnemies();\n  if (goal && rectsCollide(player, goal)) state = \"win\";\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#5c94fc\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#c84c0c\";\n  for (const t of tiles) ctx.fillRect(t.x, t.y, t.w, t.h);\n  ctx.font = \"18px Arial\";\n  for (const c of coins) ctx.fillText(\"🪙\", c.x - 2, c.y + 15);\n  ctx.font = \"28px Arial\";\n  for (const e of enemies) ctx.fillText(\"🍄\", e.x, e.y + 26);\n  if (goal) ctx.fillText(\"🚩\", goal.x - 4, goal.y + 32);\n  ctx.fillStyle = \"#ffd166\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"❤️\".repeat(Math.max(0, lives)) + \"  Монеты: \" + score, 10, 24);\n  if (state !== \"play\") {\n    ctx.font = \"bold 36px Arial\";\n    ctx.textAlign = \"center\";\n    ctx.fillText(state === \"win\" ? \"ПОБЕДА! 🎉\" : \"Игра окончена\", canvas.width / 2, 150);\n    ctx.font = \"18px Arial\";\n    ctx.fillText(\"Пробел — играть снова\", canvas.width / 2, 185);\n    ctx.textAlign = \"left\";\n  }\n}\n\nbuildLevel();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const TILE = 40;\nconst level = [\n  \"............\",\n  \"............\",\n  \"..........F.\",\n  \"......o.####\",\n  \"...o..###...\",\n  \"..###.......\",\n  \"o.......E..o\",\n  \"############\"\n];\nconst SPEED = 3.5, GRAVITY = 0.6, JUMP = 11;\nlet tiles = [], coins = [], enemies = [];\nlet goal = null;\nlet score = 0;\nlet lives = 3;\nlet state = \"play\";\nconst player = { x: 40, y: 200, w: 26, h: 34, vx: 0, vy: 0, onGround: false };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => {\n  keys[e.key] = true;\n  if (e.key === \" \" && state !== \"play\") restart();\n});\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction buildLevel() {\n  tiles = []; coins = []; enemies = []; goal = null;\n  for (let row = 0; row < level.length; row++) {\n    for (let col = 0; col < level[row].length; col++) {\n      const ch = level[row][col];\n      if (ch === \"#\") tiles.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });\n      if (ch === \"o\") coins.push({ x: col * TILE + 12, y: row * TILE + 12, w: 16, h: 16 });\n      if (ch === \"F\") goal = { x: col * TILE + 8, y: row * TILE, w: 24, h: TILE };\n      // 1. Враги\n      if (ch === \"E\") enemies.push({ x: col * TILE + 5, y: row * TILE + TILE - 30, w: 30, h: 30, vx: 1.2 });\n    }\n  }\n}\n\nfunction respawn() {\n  player.x = 40; player.y = 200; player.vx = 0; player.vy = 0;\n}\n\nfunction hurt() {\n  lives--;\n  if (lives <= 0) state = \"lose\";\n  respawn();\n}\n\nfunction restart() {\n  lives = 3; score = 0; state = \"play\";\n  buildLevel();\n  respawn();\n}\n\n// 2. Враги ходят туда-сюда\nfunction updateEnemies() {\n  for (const e of enemies) {\n    e.x += e.vx;\n    const hitWall = tiles.some((t) => rectsCollide(e, t));\n    if (hitWall || e.x < 0 || e.x + e.w > canvas.width) {\n      e.x -= e.vx;\n      e.vx = -e.vx;\n    }\n  }\n}\n\n// 3. Касание врагов\nfunction hitEnemies() {\n  for (let i = enemies.length - 1; i >= 0; i--) {\n    const e = enemies[i];\n    if (!rectsCollide(player, e)) continue;\n    const wasAbove = player.y + player.h - player.vy <= e.y + 6;\n    if (player.vy > 0 && wasAbove) {\n      enemies.splice(i, 1);\n      player.vy = -JUMP * 0.6;\n      score += 5;\n    } else {\n      hurt();\n      return;\n    }\n  }\n}\n\nfunction update() {\n  if (state !== \"play\") return;\n  player.vx = 0;\n  if (keys[\"ArrowLeft\"]) player.vx = -SPEED;\n  if (keys[\"ArrowRight\"]) player.vx = SPEED;\n  if ((keys[\" \"] || keys[\"ArrowUp\"]) && player.onGround) player.vy = -JUMP;\n\n  player.x += player.vx;\n  for (const t of tiles) {\n    if (rectsCollide(player, t)) {\n      if (player.vx > 0) player.x = t.x - player.w;\n      if (player.vx < 0) player.x = t.x + t.w;\n    }\n  }\n  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));\n\n  player.vy += GRAVITY;\n  player.y += player.vy;\n  player.onGround = false;\n  for (const t of tiles) {\n    if (rectsCollide(player, t)) {\n      if (player.vy > 0) { player.y = t.y - player.h; player.vy = 0; player.onGround = true; }\n      else if (player.vy < 0) { player.y = t.y + t.h; player.vy = 0; }\n    }\n  }\n  if (player.y > canvas.height) hurt();\n\n  for (let i = coins.length - 1; i >= 0; i--) {\n    if (rectsCollide(player, coins[i])) { coins.splice(i, 1); score++; }\n  }\n  updateEnemies();\n  hitEnemies();\n  if (goal && rectsCollide(player, goal)) state = \"win\";\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#5c94fc\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#c84c0c\";\n  for (const t of tiles) ctx.fillRect(t.x, t.y, t.w, t.h);\n  ctx.font = \"18px Arial\";\n  for (const c of coins) ctx.fillText(\"🪙\", c.x - 2, c.y + 15);\n  ctx.font = \"28px Arial\";\n  for (const e of enemies) ctx.fillText(\"🍄\", e.x, e.y + 26);\n  if (goal) ctx.fillText(\"🚩\", goal.x - 4, goal.y + 32);\n  ctx.fillStyle = \"#ffd166\";\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"❤️\".repeat(Math.max(0, lives)) + \"  Монеты: \" + score, 10, 24);\n  if (state !== \"play\") {\n    ctx.font = \"bold 36px Arial\";\n    ctx.textAlign = \"center\";\n    ctx.fillText(state === \"win\" ? \"ПОБЕДА! 🎉\" : \"Игра окончена\", canvas.width / 2, 150);\n    ctx.font = \"18px Arial\";\n    ctx.fillText(\"Пробел — играть снова\", canvas.width / 2, 185);\n    ctx.textAlign = \"left\";\n  }\n}\n\nbuildLevel();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Как понять, что герой прыгнул на врага сверху, а не врезался сбоку?",
     "a": [
      "Посмотреть, был ли низ героя выше врага на прошлом кадре, и падает ли герой",
      "Сравнить их скорости по x",
      "Это невозможно определить"
     ],
     "c": 0,
     "e": "Если кадр назад герой был выше и сейчас летит вниз — это прыжок сверху."
    }
   ]
  }
 ],
 "id": "platformer",
 "icon": "🏃",
 "color": "#7c6cff",
 "title": "Проект: Платформер",
 "desc": "Уровень из текста, прыжки по платформам, монеты, враги и флаг финиша",
 "project": true
});
