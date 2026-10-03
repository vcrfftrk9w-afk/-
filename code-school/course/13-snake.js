/* Собрано из content/13-snake.txt командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */
window.COURSE = window.COURSE || [];
window.COURSE.push({
 "lessons": [
  {
   "id": "snake-1",
   "title": "Шаг 1. Поле и змейка",
   "xp": 20,
   "theory": "Добро пожаловать в первый большой проект! Мы шаг за шагом напишем **«Змейку»** — одну из самых известных игр в мире. Каждый урок добавляет новую часть, а в конце у тебя будет полноценная игра.\n\n## Как устроена змейка\n\nПоле — это сетка **20 × 20 клеток**. Каждая клетка — квадрат 20 × 20 пикселей (холст 400 × 400).\n\nЗмейка — это **массив клеток**. У каждой клетки есть номер столбца `x` и строки `y` (не пиксели, а номера клеток!). Первый элемент массива — **голова**.\n\n```code\nlet snake = [\n  { x: 10, y: 10 },  // голова\n  { x: 9, y: 10 },   // тело\n  { x: 8, y: 10 }    // хвост\n];\n```\n\nЧтобы нарисовать клетку, переводим номер клетки в пиксели — умножаем на размер клетки:\n\n```code\nпиксель X = x * SIZE\nпиксель Y = y * SIZE\n```\n\nКлетка (10, 10) рисуется в пикселях (200, 200).\n\n## Красивая сетка\n\nЕсли рисовать квадрат чуть меньше клетки (на 1 пиксель отступ с каждой стороны), между клетками будут видны тонкие линии — змейка станет «сегментной»:\n\n```js canvas w=400 h=400\nconst SIZE = 20;\nctx.fillStyle = \"#111a33\";\nctx.fillRect(0, 0, canvas.width, canvas.height);\nfor (let x = 0; x < 20; x++) {\n  for (let y = 0; y < 20; y++) {\n    ctx.fillStyle = (x + y) % 2 === 0 ? \"#18234a\" : \"#141d3d\";\n    ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);\n  }\n}\n```\n\n## План проекта\n\n1. **Поле и змейка** ← ты здесь\n2. Движение\n3. Управление стрелками\n4. Еда и рост\n5. Столкновения и конец игры",
   "task": {
    "tests": [
     [
      "drawCell(2, 3, \"red\") рисует красную клетку на месте (2, 3)",
      "(function () { __clearDraw(); drawCell(2, 3, \"red\"); return __drawn(\"fillRect\").some(function (c) { return c.a[0] >= 40 && c.a[0] <= 42 && c.a[1] >= 60 && c.a[1] <= 62 && c.a[2] >= 14 && c.a[2] <= 20 && __isColor(c.fill, \"red\"); }); })()"
     ],
     [
      "draw() заливает фон всего холста",
      "(function () { __clearDraw(); draw(); return __draw.some(function (c) { return (c.m === \"fillRect\" || c.m === \"clearRect\") && c.a[0] <= 0 && c.a[1] <= 0 && c.a[2] >= canvas.width && c.a[3] >= canvas.height; }); })()"
     ],
     [
      "draw() рисует все клетки змейки",
      "(function () { __clearDraw(); draw(); var r = __drawn(\"fillRect\").filter(function (c) { return c.a[2] <= SIZE; }); return snake.every(function (p) { return r.some(function (c) { return Math.floor(c.a[0] / SIZE) === p.x && Math.floor(c.a[1] / SIZE) === p.y; }); }); })()"
     ],
     [
      "draw() рисует еду красным",
      "(function () { __clearDraw(); draw(); return __drawn(\"fillRect\").some(function (c) { return c.a[2] <= SIZE && Math.floor(c.a[0] / SIZE) === food.x && Math.floor(c.a[1] / SIZE) === food.y && __isColor(c.fill, \"red\"); }); })()"
     ],
     [
      "Голова другого цвета, чем тело",
      "(function () { __clearDraw(); draw(); var r = __drawn(\"fillRect\").filter(function (c) { return c.a[2] <= SIZE; }); var at = function (p) { return r.filter(function (c) { return Math.floor(c.a[0] / SIZE) === p.x && Math.floor(c.a[1] / SIZE) === p.y; }).pop(); }; var h = at(snake[0]), b = at(snake[1]); return h && b && String(h.fill) !== String(b.fill); })()"
     ]
    ],
    "hints": [
     "drawCell: `ctx.fillStyle = color;` и `ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);`",
     "В draw: фон `ctx.fillRect(0, 0, canvas.width, canvas.height)` (своим цветом), потом `drawCell(food.x, food.y, \"red\");`, потом цикл по змейке.",
     "В цикле: `const color = i === 0 ? \"lime\" : \"green\"; drawCell(snake[i].x, snake[i].y, color);`"
    ],
    "text": "Напиши две функции:\n\n1. `drawCell(x, y, color)` — рисует одну клетку: квадрат цвета `color` в клетке номер `(x, y)`. Переводи номер клетки в пиксели через `SIZE`. (Можно с отступом в 1 пиксель: `x * SIZE + 1`, размер `SIZE - 2`.)\n2. `draw()` — рисует всю игру: заливает фон, рисует еду (`food`) красным и все клетки змейки. Голову — одним цветом (например, `\"lime\"`), тело — другим (`\"green\"`).",
    "canvas": true,
    "width": 400,
    "height": 400,
    "starter": "const SIZE = 20;                     // размер клетки в пикселях\nconst COLS = canvas.width / SIZE;    // клеток по горизонтали (20)\nconst ROWS = canvas.height / SIZE;   // клеток по вертикали (20)\n\n// Змейка — массив клеток. Первая клетка — голова.\nlet snake = [\n  { x: 10, y: 10 },\n  { x: 9, y: 10 },\n  { x: 8, y: 10 }\n];\nlet food = { x: 15, y: 10 };\n\n// 1. Нарисовать одну клетку\nfunction drawCell(x, y, color) {\n\n}\n\n// 2. Нарисовать всю игру\nfunction draw() {\n\n}\n\ndraw();\n",
    "solution": "const SIZE = 20;                     // размер клетки в пикселях\nconst COLS = canvas.width / SIZE;    // клеток по горизонтали (20)\nconst ROWS = canvas.height / SIZE;   // клеток по вертикали (20)\n\n// Змейка — массив клеток. Первая клетка — голова.\nlet snake = [\n  { x: 10, y: 10 },\n  { x: 9, y: 10 },\n  { x: 8, y: 10 }\n];\nlet food = { x: 15, y: 10 };\n\n// 1. Нарисовать одну клетку\nfunction drawCell(x, y, color) {\n  ctx.fillStyle = color;\n  ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);\n}\n\n// 2. Нарисовать всю игру\nfunction draw() {\n  ctx.fillStyle = \"#111a33\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n\n  drawCell(food.x, food.y, \"red\");\n\n  for (let i = 0; i < snake.length; i++) {\n    const color = i === 0 ? \"lime\" : \"green\";\n    drawCell(snake[i].x, snake[i].y, color);\n  }\n}\n\ndraw();\n"
   },
   "quiz": [
    {
     "q": "В какой точке (в пикселях) рисуется клетка (3, 7), если SIZE = 20?",
     "a": [
      "(60, 140)",
      "(3, 7)",
      "(23, 27)"
     ],
     "c": 0,
     "e": "Номер клетки умножаем на размер: 3 × 20 = 60, 7 × 20 = 140."
    }
   ]
  },
  {
   "id": "snake-2",
   "title": "Шаг 2. Змейка ползёт",
   "xp": 20,
   "theory": "Как двигается змейка? Хитрость в том, что двигать **все** клетки не нужно! Достаточно:\n\n1. Добавить **новую голову** на шаг впереди старой.\n2. **Убрать хвост** (последнюю клетку).\n\nТело при этом «переползает» само собой.\n\n```text\nБыло:      [Г][Т][Т]  →\nНовая голова:  [Н][Г][Т][Т]\nУбрали хвост:  [Н][Г][Т]\n```\n\n## Направление\n\nНаправление храним как объект `dir` с двумя числами:\n\n| Куда | dir |\n|---|---|\n| вправо | `{ x: 1, y: 0 }` |\n| влево | `{ x: -1, y: 0 }` |\n| вниз | `{ x: 0, y: 1 }` |\n| вверх | `{ x: 0, y: -1 }` |\n\nНовая голова = старая голова + направление:\n\n```code\nconst head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };\nsnake.unshift(head);  // добавить в начало массива\nsnake.pop();          // убрать последний элемент\n```\n\n`unshift` добавляет в **начало** массива, `pop` убирает из **конца** — помнишь из модуля про массивы?\n\n## Тики вместо кадров\n\nЗмейка не двигается 60 раз в секунду (это слишком быстро) — она ходит **рывками**, клетка за клеткой. Поэтому вместо `requestAnimationFrame` используем `setInterval`: каждые 150 мс — один шаг. Такой шаг называется **тик**.\n\n> 🎮 Чем меньше интервал — тем быстрее змейка и сложнее игра. Можно ускорять змейку с каждым съеденным яблоком!",
   "task": {
    "tests": [
     [
      "Голова сдвигается по направлению вправо",
      "(function () { snake.length = 0; snake.push({ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }); dir = { x: 1, y: 0 }; step(); return snake[0].x === 6 && snake[0].y === 5; })()"
     ],
     [
      "Длина не меняется, хвост убирается",
      "(function () { snake.length = 0; snake.push({ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }); dir = { x: 1, y: 0 }; step(); return snake.length === 3 && snake[1].x === 5 && snake[2].x === 4; })()"
     ],
     [
      "Движение вниз тоже работает",
      "(function () { snake.length = 0; snake.push({ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }); dir = { x: 0, y: 1 }; step(); var ok = snake[0].x === 5 && snake[0].y === 6 && snake[1].x === 5 && snake[1].y === 5; dir = { x: 1, y: 0 }; return ok; })()"
     ]
    ],
    "hints": [
     "Новая голова: `const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };`",
     "Затем: `snake.unshift(head);` и `snake.pop();`"
    ],
    "text": "Напиши функцию `step()` — один шаг змейки:\n\n1. Создай новую голову `head` — на клетку дальше старой головы по направлению `dir`.\n2. Добавь её в **начало** массива `snake` (`unshift`).\n3. Убери последнюю клетку (`pop`).\n\nТик через `setInterval` уже написан внизу — после этого змейка поползёт вправо (и уползёт за край — это исправим позже).",
    "canvas": true,
    "width": 400,
    "height": 400,
    "starter": "const SIZE = 20;\nconst COLS = canvas.width / SIZE;\nconst ROWS = canvas.height / SIZE;\n\nlet snake = [\n  { x: 10, y: 10 },\n  { x: 9, y: 10 },\n  { x: 8, y: 10 }\n];\nlet food = { x: 15, y: 10 };\nlet dir = { x: 1, y: 0 };   // направление: вправо\n\nfunction drawCell(x, y, color) {\n  ctx.fillStyle = color;\n  ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#111a33\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  drawCell(food.x, food.y, \"red\");\n  for (let i = 0; i < snake.length; i++) {\n    drawCell(snake[i].x, snake[i].y, i === 0 ? \"lime\" : \"green\");\n  }\n}\n\n// Один шаг змейки\nfunction step() {\n\n}\n\n// Тик: каждые 150 мс шаг и перерисовка\nsetInterval(() => {\n  step();\n  draw();\n}, 150);\ndraw();\n",
    "solution": "const SIZE = 20;\nconst COLS = canvas.width / SIZE;\nconst ROWS = canvas.height / SIZE;\n\nlet snake = [\n  { x: 10, y: 10 },\n  { x: 9, y: 10 },\n  { x: 8, y: 10 }\n];\nlet food = { x: 15, y: 10 };\nlet dir = { x: 1, y: 0 };   // направление: вправо\n\nfunction drawCell(x, y, color) {\n  ctx.fillStyle = color;\n  ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#111a33\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  drawCell(food.x, food.y, \"red\");\n  for (let i = 0; i < snake.length; i++) {\n    drawCell(snake[i].x, snake[i].y, i === 0 ? \"lime\" : \"green\");\n  }\n}\n\n// Один шаг змейки\nfunction step() {\n  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };\n  snake.unshift(head);\n  snake.pop();\n}\n\n// Тик: каждые 150 мс шаг и перерисовка\nsetInterval(() => {\n  step();\n  draw();\n}, 150);\ndraw();\n"
   },
   "quiz": [
    {
     "q": "Змейка ползёт вверх. Какое у неё направление dir?",
     "a": [
      "`{ x: 0, y: -1 }`",
      "`{ x: 0, y: 1 }`",
      "`{ x: -1, y: 0 }`"
     ],
     "c": 0,
     "e": "Вверх — y уменьшается."
    }
   ]
  },
  {
   "id": "snake-3",
   "title": "Шаг 3. Управление стрелками",
   "xp": 20,
   "theory": "Теперь научим змейку поворачивать. При нажатии стрелки меняем направление.\n\n## Запрет разворота\n\nЗмейка не может развернуться на 180°: если она ползёт вправо, повернуть сразу влево нельзя — она врежется сама в себя. Поэтому проверяем: повернуть **вверх** можно, только если змейка **не ползёт вниз** (`dir.y !== 1`), и так далее.\n\n## Хитрая ошибка и её исправление\n\nПредставь: змейка ползёт вправо, и игрок очень быстро нажимает ↑ и сразу ←, — оба нажатия между двумя тиками. Первое нажатие поменяет направление на «вверх», второе проверит «не ползёт ли вправо?» — нет, ведь уже «вверх»! — и поставит «влево». На следующем тике змейка развернётся в себя.\n\nРешение — копить нажатие в отдельной переменной `nextDir` («следующее направление»), а проверку делать по **текущему** `dir`:\n\n```code\nlet nextDir = { x: 1, y: 0 };\n\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \"ArrowUp\" && dir.y !== 1) nextDir = { x: 0, y: -1 };\n  // ... остальные стрелки\n});\n\nfunction step() {\n  dir = nextDir;   // применяем поворот только в момент шага\n  // ...\n}\n```\n\n> 🧠 Такие «пограничные случаи» — то, что отличает игру-поделку от качественной игры. Профессиональные разработчики игр постоянно ищут, как игрок может «сломать» игру.",
   "task": {
    "tests": [
     [
      "↑ поворачивает змейку вверх",
      "(function () { snake.length = 0; snake.push({ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }); dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 }; __press(\"ArrowUp\"); step(); return snake[0].x === 5 && snake[0].y === 4; })()"
     ],
     [
      "↓ поворачивает змейку вниз",
      "(function () { snake.length = 0; snake.push({ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }); dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 }; __press(\"ArrowDown\"); step(); return snake[0].x === 5 && snake[0].y === 6; })()"
     ],
     [
      "Ползёт вправо — ← не разворачивает назад",
      "(function () { snake.length = 0; snake.push({ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }); dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 }; __press(\"ArrowLeft\"); step(); return snake[0].x === 6 && snake[0].y === 5; })()"
     ],
     [
      "Ползёт вверх: ↓ не работает, → и ← работают",
      "(function () { snake.length = 0; snake.push({ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }); dir = { x: 0, y: -1 }; nextDir = { x: 0, y: -1 }; __press(\"ArrowDown\"); step(); var a = snake[0].x === 5 && snake[0].y === 4; __press(\"ArrowLeft\"); step(); var b = snake[0].x === 4 && snake[0].y === 4; dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 }; return a && b; })()"
     ],
     [
      "Быстрые ↑ и ← между тиками не разворачивают змейку в себя",
      "(function () { snake.length = 0; snake.push({ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }); dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 }; __press(\"ArrowUp\"); __press(\"ArrowLeft\"); step(); return !(snake[0].x === 4 && snake[0].y === 5); })()"
     ]
    ],
    "hints": [
     "Первая стрелка: `if (e.key === \"ArrowUp\" && dir.y !== 1) nextDir = { x: 0, y: -1 };`",
     "Остальные так же: ↓ проверяет `dir.y !== -1`, ← проверяет `dir.x !== 1`, → проверяет `dir.x !== -1`."
    ],
    "text": "Допиши обработчик клавиш: для каждой из четырёх стрелок задавай `nextDir`, но **запрещай разворот** назад (сравнивай с текущим `dir`):\n\n- `ArrowUp` → `{ x: 0, y: -1 }`, если змейка не ползёт вниз;\n- `ArrowDown` → `{ x: 0, y: 1 }`, если не ползёт вверх;\n- `ArrowLeft` → `{ x: -1, y: 0 }`, если не ползёт вправо;\n- `ArrowRight` → `{ x: 1, y: 0 }`, если не ползёт влево.\n\nВ `step()` уже добавлена строчка `dir = nextDir;`.",
    "canvas": true,
    "width": 400,
    "height": 400,
    "starter": "const SIZE = 20;\nconst COLS = canvas.width / SIZE;\nconst ROWS = canvas.height / SIZE;\n\nlet snake = [\n  { x: 10, y: 10 },\n  { x: 9, y: 10 },\n  { x: 8, y: 10 }\n];\nlet food = { x: 15, y: 10 };\nlet dir = { x: 1, y: 0 };\nlet nextDir = { x: 1, y: 0 };  // поворот, который применится на следующем шаге\n\nfunction drawCell(x, y, color) {\n  ctx.fillStyle = color;\n  ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#111a33\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  drawCell(food.x, food.y, \"red\");\n  for (let i = 0; i < snake.length; i++) {\n    drawCell(snake[i].x, snake[i].y, i === 0 ? \"lime\" : \"green\");\n  }\n}\n\nfunction step() {\n  dir = nextDir;\n  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };\n  snake.unshift(head);\n  snake.pop();\n}\n\n// Управление стрелками\ndocument.addEventListener(\"keydown\", (e) => {\n\n});\n\nsetInterval(() => {\n  step();\n  draw();\n}, 150);\ndraw();\n",
    "solution": "const SIZE = 20;\nconst COLS = canvas.width / SIZE;\nconst ROWS = canvas.height / SIZE;\n\nlet snake = [\n  { x: 10, y: 10 },\n  { x: 9, y: 10 },\n  { x: 8, y: 10 }\n];\nlet food = { x: 15, y: 10 };\nlet dir = { x: 1, y: 0 };\nlet nextDir = { x: 1, y: 0 };  // поворот, который применится на следующем шаге\n\nfunction drawCell(x, y, color) {\n  ctx.fillStyle = color;\n  ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#111a33\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  drawCell(food.x, food.y, \"red\");\n  for (let i = 0; i < snake.length; i++) {\n    drawCell(snake[i].x, snake[i].y, i === 0 ? \"lime\" : \"green\");\n  }\n}\n\nfunction step() {\n  dir = nextDir;\n  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };\n  snake.unshift(head);\n  snake.pop();\n}\n\n// Управление стрелками\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \"ArrowUp\" && dir.y !== 1) nextDir = { x: 0, y: -1 };\n  if (e.key === \"ArrowDown\" && dir.y !== -1) nextDir = { x: 0, y: 1 };\n  if (e.key === \"ArrowLeft\" && dir.x !== 1) nextDir = { x: -1, y: 0 };\n  if (e.key === \"ArrowRight\" && dir.x !== -1) nextDir = { x: 1, y: 0 };\n});\n\nsetInterval(() => {\n  step();\n  draw();\n}, 150);\ndraw();\n"
   },
   "quiz": [
    {
     "q": "Змейка ползёт влево. Какую стрелку нужно запретить?",
     "a": [
      "Вправо",
      "Влево",
      "Вверх"
     ],
     "c": 0,
     "e": "Поворот на 180° — это направление, противоположное текущему."
    }
   ]
  },
  {
   "id": "snake-4",
   "title": "Шаг 4. Еда и рост",
   "xp": 20,
   "theory": "Пора кормить змейку! Правило: если голова попала на клетку с едой — змейка **растёт**, счёт увеличивается, а еда появляется в новом месте.\n\n## Как вырасти\n\nОчень просто! Помнишь, шаг — это «добавить голову + убрать хвост»? Если змейка съела еду, просто **не убираем хвост** — и она станет на клетку длиннее:\n\n```code\nsnake.unshift(head);\nif (head.x === food.x && head.y === food.y) {\n  score++;\n  placeFood();      // новая еда\n} else {\n  snake.pop();      // хвост убираем, только если не ели\n}\n```\n\n## Новая еда — не на змейке!\n\nЕда должна появиться в случайной клетке, но **не там, где змейка**. Используем цикл `do...while`: «выбирай случайную клетку, **пока** она занята змейкой»:\n\n```code\nfunction placeFood() {\n  do {\n    food = { x: randomInt(0, COLS - 1), y: randomInt(0, ROWS - 1) };\n  } while (snake.some((p) => p.x === food.x && p.y === food.y));\n}\n```\n\n- `do { ... } while (условие)` — как `while`, но сначала **делает**, а потом проверяет. Хоть один раз выполнится обязательно — а нам и нужно выбрать клетку хотя бы раз.\n- `snake.some(...)` — есть ли хоть одна клетка змейки на этом месте.\n\n> 🎮 Здесь пригодилась функция `randomInt` из модуля про функции. Видишь, как всё складывается?",
   "task": {
    "tests": [
     [
      "Еда появляется внутри поля",
      "(function () { for (var i = 0; i < 300; i++) { placeFood(); if (food.x < 0 || food.x >= COLS || food.y < 0 || food.y >= ROWS || food.x !== Math.floor(food.x)) return false; } return true; })()"
     ],
     [
      "Еда появляется в разных местах",
      "(function () { var seen = {}; for (var i = 0; i < 100; i++) { placeFood(); seen[food.x + \",\" + food.y] = 1; } return Object.keys(seen).length > 20; })()"
     ],
     [
      "Еда никогда не появляется на змейке",
      "(function () { snake.length = 0; for (var x = 0; x < COLS; x++) { for (var y = 0; y < ROWS - 2; y++) snake.push({ x: x, y: y }); } for (var i = 0; i < 100; i++) { placeFood(); if (food.y < ROWS - 2) { snake.length = 0; snake.push({ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }); return false; } } snake.length = 0; snake.push({ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }); return true; })()"
     ],
     [
      "Съела еду — выросла на 1, счёт +1, еда переехала",
      "(function () { snake.length = 0; snake.push({ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }); dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 }; food = { x: 6, y: 5 }; var s = score; step(); return snake.length === 4 && score === s + 1 && !(food.x === 6 && food.y === 5); })()"
     ],
     [
      "Без еды длина не меняется",
      "(function () { snake.length = 0; snake.push({ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }); dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 }; food = { x: 15, y: 15 }; var s = score; step(); return snake.length === 3 && score === s; })()"
     ]
    ],
    "hints": [
     "placeFood: `do { food = { x: randomInt(0, COLS - 1), y: randomInt(0, ROWS - 1) }; } while (snake.some((p) => p.x === food.x && p.y === food.y));`",
     "В step вместо одиночного `snake.pop();`: `if (head.x === food.x && head.y === food.y) { score++; placeFood(); } else { snake.pop(); }`"
    ],
    "text": "1. Допиши `placeFood()` — ставит еду в случайную клетку поля (`randomInt(0, COLS - 1)` и `randomInt(0, ROWS - 1)`), но **не на змейку**.\n2. В `step()` после `unshift`: если голова на еде — увеличь `score` и вызови `placeFood()`, **иначе** — убери хвост (`pop`).",
    "canvas": true,
    "width": 400,
    "height": 400,
    "starter": "const SIZE = 20;\nconst COLS = canvas.width / SIZE;\nconst ROWS = canvas.height / SIZE;\n\nlet snake = [\n  { x: 10, y: 10 },\n  { x: 9, y: 10 },\n  { x: 8, y: 10 }\n];\nlet food = { x: 15, y: 10 };\nlet dir = { x: 1, y: 0 };\nlet nextDir = { x: 1, y: 0 };\nlet score = 0;\n\nfunction randomInt(min, max) {\n  return Math.floor(Math.random() * (max - min + 1)) + min;\n}\n\nfunction drawCell(x, y, color) {\n  ctx.fillStyle = color;\n  ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#111a33\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  drawCell(food.x, food.y, \"red\");\n  for (let i = 0; i < snake.length; i++) {\n    drawCell(snake[i].x, snake[i].y, i === 0 ? \"lime\" : \"green\");\n  }\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Счёт: \" + score, 10, 24);\n}\n\n// 1. Новая еда в случайной свободной клетке\nfunction placeFood() {\n\n}\n\nfunction step() {\n  dir = nextDir;\n  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };\n  snake.unshift(head);\n  // 2. Съели еду — растём, иначе убираем хвост\n  snake.pop();\n}\n\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \"ArrowUp\" && dir.y !== 1) nextDir = { x: 0, y: -1 };\n  if (e.key === \"ArrowDown\" && dir.y !== -1) nextDir = { x: 0, y: 1 };\n  if (e.key === \"ArrowLeft\" && dir.x !== 1) nextDir = { x: -1, y: 0 };\n  if (e.key === \"ArrowRight\" && dir.x !== -1) nextDir = { x: 1, y: 0 };\n});\n\nsetInterval(() => {\n  step();\n  draw();\n}, 150);\ndraw();\n",
    "solution": "const SIZE = 20;\nconst COLS = canvas.width / SIZE;\nconst ROWS = canvas.height / SIZE;\n\nlet snake = [\n  { x: 10, y: 10 },\n  { x: 9, y: 10 },\n  { x: 8, y: 10 }\n];\nlet food = { x: 15, y: 10 };\nlet dir = { x: 1, y: 0 };\nlet nextDir = { x: 1, y: 0 };\nlet score = 0;\n\nfunction randomInt(min, max) {\n  return Math.floor(Math.random() * (max - min + 1)) + min;\n}\n\nfunction drawCell(x, y, color) {\n  ctx.fillStyle = color;\n  ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#111a33\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  drawCell(food.x, food.y, \"red\");\n  for (let i = 0; i < snake.length; i++) {\n    drawCell(snake[i].x, snake[i].y, i === 0 ? \"lime\" : \"green\");\n  }\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Счёт: \" + score, 10, 24);\n}\n\n// 1. Новая еда в случайной свободной клетке\nfunction placeFood() {\n  do {\n    food = { x: randomInt(0, COLS - 1), y: randomInt(0, ROWS - 1) };\n  } while (snake.some((p) => p.x === food.x && p.y === food.y));\n}\n\nfunction step() {\n  dir = nextDir;\n  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };\n  snake.unshift(head);\n  // 2. Съели еду — растём, иначе убираем хвост\n  if (head.x === food.x && head.y === food.y) {\n    score++;\n    placeFood();\n  } else {\n    snake.pop();\n  }\n}\n\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \"ArrowUp\" && dir.y !== 1) nextDir = { x: 0, y: -1 };\n  if (e.key === \"ArrowDown\" && dir.y !== -1) nextDir = { x: 0, y: 1 };\n  if (e.key === \"ArrowLeft\" && dir.x !== 1) nextDir = { x: -1, y: 0 };\n  if (e.key === \"ArrowRight\" && dir.x !== -1) nextDir = { x: 1, y: 0 };\n});\n\nsetInterval(() => {\n  step();\n  draw();\n}, 150);\ndraw();\n"
   },
   "quiz": [
    {
     "q": "Чем do...while отличается от while?",
     "a": [
      "Тело do...while выполняется хотя бы один раз",
      "do...while быстрее",
      "Ничем"
     ],
     "c": 0,
     "e": "В do...while условие проверяется после выполнения тела."
    }
   ]
  },
  {
   "id": "snake-5",
   "title": "Шаг 5. Конец игры",
   "xp": 25,
   "theory": "Последний шаг! Змейка должна **проигрывать**, если:\n\n1. врезалась в **стену** (вышла за поле);\n2. врезалась **сама в себя**.\n\n## Проверка в step()\n\nНовую голову проверяем **до того**, как добавить её в змейку:\n\n```code\nconst head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };\n\nconst hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;\nconst hitSelf = snake.some((p) => p.x === head.x && p.y === head.y);\n\nif (hitWall || hitSelf) {\n  gameOver = true;\n  return;   // дальше не идём\n}\n```\n\nА в самом начале `step()`: если игра уже окончена — ничего не делаем:\n\n```code\nif (gameOver) return;\n```\n\n## Новая игра\n\nПо пробелу начинаем заново. Удобно сделать функцию `restart()`, которая возвращает всё в начальное состояние: змейку, направление, счёт, флаг `gameOver` и еду.\n\n## Экран «Игра окончена»\n\nВ `draw()`, если `gameOver`, рисуем поверх поля полупрозрачный прямоугольник и текст:\n\n```code\nif (gameOver) {\n  ctx.fillStyle = \"rgba(0, 0, 0, 0.6)\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"white\";\n  ctx.textAlign = \"center\";\n  ctx.fillText(\"Игра окончена! Пробел — заново\", canvas.width / 2, canvas.height / 2);\n  ctx.textAlign = \"left\";\n}\n```\n\n`rgba(0, 0, 0, 0.6)` — чёрный с прозрачностью 60%: поле видно, но затемнено.\n\n> 🏆 После этого шага у тебя полноценная «Змейка»! Сохрани её в песочнице и улучшай: ускорение, рекорд в `localStorage`, разные виды еды, препятствия…",
   "task": {
    "tests": [
     [
      "Врезалась в правую стену — конец игры",
      "(function () { gameOver = false; snake.length = 0; snake.push({ x: COLS - 1, y: 5 }, { x: COLS - 2, y: 5 }, { x: COLS - 3, y: 5 }); dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 }; step(); return gameOver === true && snake[0].x === COLS - 1; })()"
     ],
     [
      "Врезалась в верхнюю стену — конец игры",
      "(function () { gameOver = false; snake.length = 0; snake.push({ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }); dir = { x: 0, y: -1 }; nextDir = { x: 0, y: -1 }; step(); return gameOver === true; })()"
     ],
     [
      "Врезалась в себя — конец игры",
      "(function () { gameOver = false; snake.length = 0; snake.push({ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }); dir = { x: 0, y: 1 }; nextDir = { x: 0, y: 1 }; food = { x: 15, y: 15 }; step(); return gameOver === true; })()"
     ],
     [
      "После конца игры змейка стоит на месте",
      "(function () { gameOver = true; var h = JSON.stringify(snake); step(); return JSON.stringify(snake) === h; })()"
     ],
     [
      "Пробел после конца игры начинает новую игру",
      "(function () { gameOver = true; score = 7; __press(\" \"); return gameOver === false && score === 0 && snake.length === 3 && snake[0].x === 10 && snake[0].y === 10 && dir.x === 1 && dir.y === 0; })()"
     ],
     [
      "При конце игры рисуется надпись",
      "(function () { gameOver = true; __clearDraw(); draw(); var n = __drawn(\"fillText\").length; gameOver = false; __clearDraw(); draw(); return n > __drawn(\"fillText\").length; })()"
     ]
    ],
    "hints": [
     "В начале step: `if (gameOver) return;`. Проверка стены: `head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS`.",
     "Проверка «в себя»: `snake.some((p) => p.x === head.x && p.y === head.y)`. Если стена или себя — `gameOver = true; return;`",
     "restart: `snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]; dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 }; score = 0; gameOver = false; placeFood();`"
    ],
    "text": "Закончи игру:\n\n1. В начале `step()`: если `gameOver` — сразу `return`.\n2. Перед `unshift`: если новая голова за пределами поля **или** на клетке змейки — поставь `gameOver = true` и выйди из функции.\n3. Напиши `restart()`: верни змейку из 3 клеток (как в начале), направление вправо (`dir` и `nextDir`), `score = 0`, `gameOver = false` и поставь новую еду.\n4. В обработчике клавиш: если нажат пробел (`\" \"`) и игра окончена — вызови `restart()`.\n5. В `draw()`: если `gameOver` — нарисуй надпись об окончании игры.",
    "canvas": true,
    "width": 400,
    "height": 400,
    "starter": "const SIZE = 20;\nconst COLS = canvas.width / SIZE;\nconst ROWS = canvas.height / SIZE;\n\nlet snake = [\n  { x: 10, y: 10 },\n  { x: 9, y: 10 },\n  { x: 8, y: 10 }\n];\nlet food = { x: 15, y: 10 };\nlet dir = { x: 1, y: 0 };\nlet nextDir = { x: 1, y: 0 };\nlet score = 0;\nlet gameOver = false;\n\nfunction randomInt(min, max) {\n  return Math.floor(Math.random() * (max - min + 1)) + min;\n}\n\nfunction drawCell(x, y, color) {\n  ctx.fillStyle = color;\n  ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#111a33\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  drawCell(food.x, food.y, \"red\");\n  for (let i = 0; i < snake.length; i++) {\n    drawCell(snake[i].x, snake[i].y, i === 0 ? \"lime\" : \"green\");\n  }\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Счёт: \" + score, 10, 24);\n  // 5. Экран окончания игры\n\n}\n\nfunction placeFood() {\n  do {\n    food = { x: randomInt(0, COLS - 1), y: randomInt(0, ROWS - 1) };\n  } while (snake.some((p) => p.x === food.x && p.y === food.y));\n}\n\n// 3. Новая игра\nfunction restart() {\n\n}\n\nfunction step() {\n  // 1. Игра окончена — ничего не делаем\n\n  dir = nextDir;\n  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };\n  // 2. Врезались в стену или в себя?\n\n  snake.unshift(head);\n  if (head.x === food.x && head.y === food.y) {\n    score++;\n    placeFood();\n  } else {\n    snake.pop();\n  }\n}\n\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \"ArrowUp\" && dir.y !== 1) nextDir = { x: 0, y: -1 };\n  if (e.key === \"ArrowDown\" && dir.y !== -1) nextDir = { x: 0, y: 1 };\n  if (e.key === \"ArrowLeft\" && dir.x !== 1) nextDir = { x: -1, y: 0 };\n  if (e.key === \"ArrowRight\" && dir.x !== -1) nextDir = { x: 1, y: 0 };\n  // 4. Пробел — новая игра\n\n});\n\nsetInterval(() => {\n  step();\n  draw();\n}, 150);\ndraw();\n",
    "solution": "const SIZE = 20;\nconst COLS = canvas.width / SIZE;\nconst ROWS = canvas.height / SIZE;\n\nlet snake = [\n  { x: 10, y: 10 },\n  { x: 9, y: 10 },\n  { x: 8, y: 10 }\n];\nlet food = { x: 15, y: 10 };\nlet dir = { x: 1, y: 0 };\nlet nextDir = { x: 1, y: 0 };\nlet score = 0;\nlet gameOver = false;\n\nfunction randomInt(min, max) {\n  return Math.floor(Math.random() * (max - min + 1)) + min;\n}\n\nfunction drawCell(x, y, color) {\n  ctx.fillStyle = color;\n  ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#111a33\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  drawCell(food.x, food.y, \"red\");\n  for (let i = 0; i < snake.length; i++) {\n    drawCell(snake[i].x, snake[i].y, i === 0 ? \"lime\" : \"green\");\n  }\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Счёт: \" + score, 10, 24);\n  // 5. Экран окончания игры\n  if (gameOver) {\n    ctx.fillStyle = \"rgba(0, 0, 0, 0.6)\";\n    ctx.fillRect(0, 0, canvas.width, canvas.height);\n    ctx.fillStyle = \"white\";\n    ctx.font = \"bold 24px Arial\";\n    ctx.textAlign = \"center\";\n    ctx.fillText(\"Игра окончена! Счёт: \" + score, canvas.width / 2, canvas.height / 2);\n    ctx.font = \"18px Arial\";\n    ctx.fillText(\"Нажми пробел, чтобы сыграть ещё\", canvas.width / 2, canvas.height / 2 + 34);\n    ctx.textAlign = \"left\";\n  }\n}\n\nfunction placeFood() {\n  do {\n    food = { x: randomInt(0, COLS - 1), y: randomInt(0, ROWS - 1) };\n  } while (snake.some((p) => p.x === food.x && p.y === food.y));\n}\n\n// 3. Новая игра\nfunction restart() {\n  snake = [\n    { x: 10, y: 10 },\n    { x: 9, y: 10 },\n    { x: 8, y: 10 }\n  ];\n  dir = { x: 1, y: 0 };\n  nextDir = { x: 1, y: 0 };\n  score = 0;\n  gameOver = false;\n  placeFood();\n}\n\nfunction step() {\n  // 1. Игра окончена — ничего не делаем\n  if (gameOver) return;\n\n  dir = nextDir;\n  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };\n  // 2. Врезались в стену или в себя?\n  const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;\n  const hitSelf = snake.some((p) => p.x === head.x && p.y === head.y);\n  if (hitWall || hitSelf) {\n    gameOver = true;\n    return;\n  }\n\n  snake.unshift(head);\n  if (head.x === food.x && head.y === food.y) {\n    score++;\n    placeFood();\n  } else {\n    snake.pop();\n  }\n}\n\ndocument.addEventListener(\"keydown\", (e) => {\n  if (e.key === \"ArrowUp\" && dir.y !== 1) nextDir = { x: 0, y: -1 };\n  if (e.key === \"ArrowDown\" && dir.y !== -1) nextDir = { x: 0, y: 1 };\n  if (e.key === \"ArrowLeft\" && dir.x !== 1) nextDir = { x: -1, y: 0 };\n  if (e.key === \"ArrowRight\" && dir.x !== -1) nextDir = { x: 1, y: 0 };\n  // 4. Пробел — новая игра\n  if (e.key === \" \" && gameOver) restart();\n});\n\nsetInterval(() => {\n  step();\n  draw();\n}, 150);\ndraw();\n"
   },
   "quiz": [
    {
     "q": "Почему стену проверяют до того, как добавить голову в змейку?",
     "a": [
      "Чтобы змейка не оказалась за пределами поля",
      "Так быстрее",
      "После unshift проверить нельзя"
     ],
     "c": 0,
     "e": "Если голова уже за полем, её не нужно добавлять — игра заканчивается."
    }
   ]
  }
 ],
 "id": "snake",
 "icon": "🐍",
 "color": "#18c79a",
 "title": "Проект: Змейка",
 "desc": "Классика! Поле из клеток, движение по тикам, еда, рост и конец игры",
 "project": true
});
