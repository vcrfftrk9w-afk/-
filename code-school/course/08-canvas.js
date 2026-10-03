/* Собрано из content/08-canvas.txt командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */
window.COURSE = window.COURSE || [];
window.COURSE.push({
 "lessons": [
  {
   "id": "canvas-1",
   "title": "Холст и координаты",
   "theory": "Пора рисовать! Браузерные игры рисуются на **холсте** — по-английски `canvas` [кэ́нвас]. Это прямоугольная область, на которой можно рисовать фигуры, текст и картинки.\n\nРисуют на холсте с помощью «кисти» — **контекста рисования**. Обычно её называют `ctx` (сокращение от context [ко́нтекст]).\n\n> 💡 В этом курсе холст и кисть уже готовы: просто пиши `ctx.`… Размер холста — **480 × 320** точек (пикселей). В настоящей веб-странице их достают так: `const canvas = document.getElementById(\"game\"); const ctx = canvas.getContext(\"2d\");` — об этом подробно в последнем модуле.\n\n## Первый прямоугольник\n\n```js canvas\nctx.fillStyle = \"orange\";\nctx.fillRect(50, 40, 120, 80);\n```\n\n- `ctx.fillStyle = \"orange\"` — выбрать цвет заливки (`fillStyle` [фил стайл] — «стиль заливки»);\n- `ctx.fillRect(x, y, ширина, высота)` — нарисовать закрашенный прямоугольник (`fill rect` [фил ре́кт] — «залить прямоугольник»).\n\n## Координаты — самое важное\n\nКаждая точка холста имеет два числа: **x** и **y**.\n\n- **x** — сколько шагов **вправо** от левого края;\n- **y** — сколько шагов **вниз** от верхнего края.\n\n> ⚠️ Внимание: в отличие от школьной математики, **y растёт вниз**! Точка (0, 0) — в **левом верхнем** углу. Чем больше y, тем ниже.\n\n```js canvas\nctx.fillStyle = \"red\";\nctx.fillRect(0, 0, 40, 40);\n\nctx.fillStyle = \"lime\";\nctx.fillRect(440, 0, 40, 40);\n\nctx.fillStyle = \"cyan\";\nctx.fillRect(0, 280, 40, 40);\n\nctx.fillStyle = \"yellow\";\nctx.fillRect(220, 140, 40, 40);\n```\n\nКрасный — в левом верхнем углу (x = 0, y = 0). Зелёный — в правом верхнем (x = 440, потому что 480 − 40). Голубой — в левом нижнем. Жёлтый — примерно в центре.\n\nУ прямоугольника `x` и `y` — это его **левый верхний угол**.\n\n> 🎮 Двигать героя по экрану = менять его x и y. Вправо — x больше, влево — меньше, вниз — y больше, вверх — меньше.",
   "task": {
    "tests": [
     [
      "Нарисован прямоугольник 50 × 50",
      "__drew(\"fillRect\", function (c) { return c.a[2] === 50 && c.a[3] === 50; })"
     ],
     [
      "Он в точке x = 100, y = 60",
      "__drew(\"fillRect\", function (c) { return c.a[0] === 100 && c.a[1] === 60 && c.a[2] === 50; })"
     ],
     [
      "Он жёлтый",
      "__drew(\"fillRect\", function (c) { return c.a[2] === 50 && __isColor(c.fill, \"yellow\"); })"
     ]
    ],
    "hints": [
     "Сначала цвет: `ctx.fillStyle = \"yellow\";`",
     "Потом квадрат: `ctx.fillRect(100, 60, 50, 50);` — x, y, ширина, высота."
    ],
    "text": "Нарисуй **жёлтый квадрат** со стороной **50**, левый верхний угол которого находится в точке **x = 100, y = 60**.\n\nНе забудь сначала выбрать цвет `\"yellow\"`.",
    "canvas": true,
    "starter": "// Выбери цвет и нарисуй квадрат\n",
    "solution": "ctx.fillStyle = \"yellow\";\nctx.fillRect(100, 60, 50, 50);\n"
   },
   "quiz": [
    {
     "q": "Где находится точка (0, 0) на холсте?",
     "a": [
      "В центре",
      "В левом нижнем углу",
      "В левом верхнем углу"
     ],
     "c": 2,
     "e": "Отсчёт идёт от левого верхнего угла: x вправо, y вниз."
    },
    {
     "q": "Персонаж стоит в y = 100. Куда он сдвинется, если сделать y = 150?",
     "a": [
      "Вниз",
      "Вверх",
      "Вправо"
     ],
     "c": 0,
     "e": "На холсте y растёт вниз."
    }
   ]
  },
  {
   "id": "canvas-2",
   "title": "Цвета",
   "theory": "Цвет можно задать несколькими способами.\n\n## 1. Названием\n\nАнглийское слово: `\"red\"`, `\"blue\"`, `\"green\"`, `\"yellow\"`, `\"orange\"`, `\"purple\"`, `\"pink\"`, `\"white\"`, `\"black\"`, `\"gray\"`, `\"gold\"`, `\"cyan\"`, `\"lime\"`, `\"brown\"`… Всего названий больше 140!\n\n```js canvas\nconst colors = [\"red\", \"orange\", \"yellow\", \"lime\", \"cyan\", \"blue\", \"purple\", \"pink\"];\nfor (let i = 0; i < colors.length; i++) {\n  ctx.fillStyle = colors[i];\n  ctx.fillRect(20 + i * 56, 120, 50, 80);\n}\n```\n\n## 2. Шестнадцатеричным кодом\n\n`\"#ff0000\"` — так задают цвета дизайнеры. Решётка и шесть символов: две цифры на красный, две на зелёный, две на синий. Цифры — от `00` (ноль) до `ff` (максимум).\n\n| Код | Цвет |\n|---|---|\n| `#ff0000` | красный |\n| `#00ff00` | зелёный |\n| `#0000ff` | синий |\n| `#ffffff` | белый |\n| `#000000` | чёрный |\n| `#ffa500` | оранжевый |\n\n## 3. rgb — красный, зелёный, синий\n\n`\"rgb(255, 100, 0)\"` — три числа от 0 до 255: сколько красного, зелёного и синего. Экран смешивает свет — как в фонарике.\n\n```js canvas\nfor (let i = 0; i < 10; i++) {\n  ctx.fillStyle = `rgb(${i * 25}, 50, ${255 - i * 25})`;\n  ctx.fillRect(i * 48, 0, 48, 320);\n}\n```\n\n## 4. hsl — по кругу оттенков\n\n`\"hsl(оттенок, 100%, 50%)\"`: оттенок — угол на цветовом круге от 0 до 360 (0 — красный, 120 — зелёный, 240 — синий). Удобно для радуги:\n\n```js canvas\nfor (let i = 0; i < 24; i++) {\n  ctx.fillStyle = `hsl(${i * 15}, 90%, 55%)`;\n  ctx.fillRect(i * 20, 100, 20, 120);\n}\n```\n\n> 💡 `fillStyle` действует на всё, что рисуется **после** него, пока не выберешь другой цвет. Это как обмакнуть кисть в краску.",
   "task": {
    "tests": [
     [
      "Нарисованы три квадрата 60 × 60",
      "__drawn(\"fillRect\").filter(function (c) { return c.a[2] === 60 && c.a[3] === 60; }).length >= 3"
     ],
     [
      "Квадраты разных цветов: красный, жёлтый, зелёный",
      "(function () { var q = __drawn(\"fillRect\").filter(function (c) { return c.a[2] === 60 && c.a[3] === 60; }); return [\"red\", \"yellow\", \"green\"].every(function (n) { return q.some(function (c) { return __isColor(c.fill, n); }); }); })()"
     ],
     [
      "Квадраты стоят один под другим: красный сверху, жёлтый посередине, зелёный снизу",
      "(function () { var q = __drawn(\"fillRect\").filter(function (c) { return c.a[2] === 60 && c.a[3] === 60; }); var f = function (n) { return q.find(function (c) { return __isColor(c.fill, n); }); }; var r = f(\"red\"), y = f(\"yellow\"), g = f(\"green\"); return r && y && g && r.a[1] < y.a[1] && y.a[1] < g.a[1]; })()"
     ]
    ],
    "hints": [
     "Для каждого квадрата — две строчки: сначала `ctx.fillStyle = \"red\";`, потом `ctx.fillRect(210, 30, 60, 60);`",
     "Чтобы квадраты стояли один под другим, x у всех одинаковый, а y увеличивается: например 30, 100, 170."
    ],
    "text": "Нарисуй **светофор**: три квадрата **60 × 60** один под другим — **красный**, **жёлтый** и **зелёный** (сверху вниз). Используй любой способ задания цвета.\n\nМожно добавить чёрный или серый корпус позади — по желанию.",
    "canvas": true,
    "starter": "\n",
    "solution": "ctx.fillStyle = \"#333333\";\nctx.fillRect(200, 20, 80, 220);\n\nctx.fillStyle = \"red\";\nctx.fillRect(210, 30, 60, 60);\n\nctx.fillStyle = \"yellow\";\nctx.fillRect(210, 100, 60, 60);\n\nctx.fillStyle = \"lime\";\nctx.fillRect(210, 170, 60, 60);\n"
   },
   "quiz": [
    {
     "q": "Какой цвет у кода `#00ff00`?",
     "a": [
      "Красный",
      "Зелёный",
      "Синий"
     ],
     "c": 1,
     "e": "Первые две цифры — красный (00), вторые — зелёный (ff, максимум), третьи — синий (00)."
    },
    {
     "q": "Что будет, если нарисовать два прямоугольника, а fillStyle задать только перед первым?",
     "a": [
      "Оба будут этого цвета",
      "Второй будет чёрным",
      "Будет ошибка"
     ],
     "c": 0,
     "e": "Цвет кисти сохраняется, пока его не поменяешь."
    }
   ]
  },
  {
   "id": "canvas-3",
   "title": "Круги и линии",
   "theory": "Прямоугольники рисуются одной командой, а для остальных фигур нужно «вести перо» — рисовать **путь** (path [пас]).\n\n## Круг\n\n```js canvas\nctx.fillStyle = \"gold\";\nctx.beginPath();\nctx.arc(240, 160, 60, 0, Math.PI * 2);\nctx.fill();\n```\n\n1. `ctx.beginPath()` [биги́н пас] — «начать новый путь». Без этого новая фигура склеится со старыми.\n2. `ctx.arc(x, y, радиус, начальныйУгол, конечныйУгол)` — `arc` [арк] — «дуга». Для полного круга углы от `0` до `Math.PI * 2`.\n3. `ctx.fill()` — залить фигуру.\n\n> ⚠️ У круга `x` и `y` — это **центр**, а не угол, как у прямоугольника.\n\n> 🧠 Почему `Math.PI * 2`? Углы в программировании меряют не в градусах, а в радианах. Полный круг = 2π ≈ 6.28 радиан. Половина круга — `Math.PI`.\n\n## Линии\n\n```js canvas\nctx.strokeStyle = \"white\";\nctx.lineWidth = 4;\nctx.beginPath();\nctx.moveTo(40, 280);\nctx.lineTo(240, 40);\nctx.lineTo(440, 280);\nctx.closePath();\nctx.stroke();\n```\n\n- `moveTo(x, y)` [мув ту] — поставить перо в точку (не рисуя);\n- `lineTo(x, y)` [лайн ту] — провести линию до точки;\n- `closePath()` — соединить с началом;\n- `stroke()` [стро́ук] — «обвести» — нарисовать линии;\n- `strokeStyle` — цвет линий, `lineWidth` — толщина.\n\n## Контур и заливка\n\nУ любой фигуры можно сделать и заливку (`fill`), и контур (`stroke`):\n\n```js canvas\nctx.beginPath();\nctx.arc(120, 160, 50, 0, Math.PI * 2);\nctx.fillStyle = \"tomato\";\nctx.fill();\nctx.lineWidth = 6;\nctx.strokeStyle = \"white\";\nctx.stroke();\n\nctx.strokeStyle = \"lime\";\nctx.strokeRect(260, 110, 140, 100);\n```",
   "task": {
    "tests": [
     [
      "Нарисована дуга с центром (100, 80) и радиусом 40",
      "__drew(\"arc\", function (c) { return c.a[0] === 100 && c.a[1] === 80 && c.a[2] === 40; })"
     ],
     [
      "Это полный круг (до Math.PI * 2)",
      "__drew(\"arc\", function (c) { return c.a[2] === 40 && Math.abs(c.a[4] - c.a[3]) >= Math.PI * 2 - 0.01; })"
     ],
     [
      "Круг залит жёлтым или золотым",
      "__drew(\"fill\", function (c) { return __isColor(c.fill, \"yellow\"); })"
     ],
     [
      "Использован beginPath",
      "__drew(\"beginPath\")"
     ]
    ],
    "hints": [
     "Цвет: `ctx.fillStyle = \"yellow\";`, потом `ctx.beginPath();`",
     "`ctx.arc(100, 80, 40, 0, Math.PI * 2);` и `ctx.fill();`"
    ],
    "text": "Нарисуй **солнце**: жёлтый (`\"yellow\"` или `\"gold\"`) круг с центром в точке **(100, 80)** и радиусом **40**.\n\nПомни про три шага: `beginPath`, `arc`, `fill`.",
    "canvas": true,
    "starter": "\n",
    "solution": "ctx.fillStyle = \"yellow\";\nctx.beginPath();\nctx.arc(100, 80, 40, 0, Math.PI * 2);\nctx.fill();\n"
   },
   "quiz": [
    {
     "q": "Что означают первые два числа в `ctx.arc(x, y, r, ...)`?",
     "a": [
      "Центр круга",
      "Левый верхний угол",
      "Ширину и высоту"
     ],
     "c": 0,
     "e": "У круга x и y — центр."
    },
    {
     "q": "Какой метод рисует контур, а не заливку?",
     "a": [
      "fill",
      "stroke",
      "arc"
     ],
     "c": 1,
     "e": "stroke — «обвести»."
    }
   ]
  },
  {
   "id": "canvas-4",
   "title": "Текст на холсте",
   "theory": "В каждой игре есть надписи: счёт, жизни, «Game Over». Текст рисуется командой `fillText`:\n\n```js canvas\nctx.fillStyle = \"white\";\nctx.font = \"28px Arial\";\nctx.fillText(\"Счёт: 150\", 20, 40);\n\nctx.fillStyle = \"tomato\";\nctx.font = \"bold 48px Arial\";\nctx.fillText(\"GAME OVER\", 100, 180);\n```\n\n- `ctx.font = \"28px Arial\"` — размер и шрифт (`font` [фонт] — «шрифт»). Можно добавить `bold` — жирный;\n- `ctx.fillText(текст, x, y)` — нарисовать текст.\n\n> ⚠️ У текста `y` — это **нижняя линия букв** (как линейка в тетради), а не верх. Если написать `y = 0`, текст уйдёт за верхний край.\n\n## Текст по центру\n\n```js canvas\nctx.fillStyle = \"gold\";\nctx.font = \"bold 36px Arial\";\nctx.textAlign = \"center\";\nctx.fillText(\"УРОВЕНЬ 2\", canvas.width / 2, canvas.height / 2);\n```\n\n`textAlign = \"center\"` [текст элайн] — выравнивание: теперь x — это середина текста. `canvas.width` и `canvas.height` — размеры холста, так что `canvas.width / 2` — середина по горизонтали.\n\n## Числа и переменные в тексте\n\n```js canvas\nlet score = 1250;\nlet lives = 3;\nctx.fillStyle = \"white\";\nctx.font = \"22px Arial\";\nctx.fillText(`Очки: ${score}`, 16, 32);\nctx.fillText(\"❤️\".repeat(lives), 380, 32);\n```\n\n> 💡 Эмодзи тоже можно рисовать текстом — это самый быстрый способ получить «картинку» персонажа! 🐸👾🚀",
   "task": {
    "tests": [
     [
      "Текст «Счёт: 0» в точке (20, 40)",
      "__drew(\"fillText\", function (c) { return String(c.a[0]) === \"Счёт: 0\" && c.a[1] === 20 && c.a[2] === 40; })"
     ],
     [
      "Он белый и размером 24px",
      "__drew(\"fillText\", function (c) { return String(c.a[0]) === \"Счёт: 0\" && __color(c, \"#ffffff\") && /24px/.test(c.font); })"
     ],
     [
      "Текст «Нажми пробел» по центру по горизонтали",
      "__drew(\"fillText\", function (c) { return String(c.a[0]) === \"Нажми пробел\" && c.a[1] === canvas.width / 2; })"
     ],
     [
      "Использован textAlign = \"center\"",
      "/textAlign\\s*=\\s*[\"']center[\"']/.test(__code)"
     ]
    ],
    "hints": [
     "`ctx.fillStyle = \"white\"; ctx.font = \"24px Arial\"; ctx.fillText(\"Счёт: 0\", 20, 40);`",
     "`ctx.textAlign = \"center\";` и `ctx.fillText(\"Нажми пробел\", canvas.width / 2, 160);`"
    ],
    "text": "Нарисуй игровой интерфейс:\n\n1. **Белым** цветом, шрифтом `\"24px Arial\"` напиши `Счёт: 0` в точке **(20, 40)**.\n2. По центру холста напиши `Нажми пробел` (используй `textAlign = \"center\"` и `canvas.width / 2`).",
    "canvas": true,
    "starter": "\n",
    "solution": "ctx.fillStyle = \"white\";\nctx.font = \"24px Arial\";\nctx.fillText(\"Счёт: 0\", 20, 40);\n\nctx.textAlign = \"center\";\nctx.fillText(\"Нажми пробел\", canvas.width / 2, canvas.height / 2);\n"
   },
   "quiz": [
    {
     "q": "Что означает y в `ctx.fillText(\"Привет\", 10, 50)`?",
     "a": [
      "Верхний край текста",
      "Нижнюю линию букв",
      "Высоту букв"
     ],
     "c": 1,
     "e": "y у текста — базовая линия, на которой «стоят» буквы."
    }
   ]
  },
  {
   "id": "canvas-5",
   "title": "Рисуем персонажа функцией",
   "theory": "Персонаж состоит из нескольких фигур. Но если координаты каждой фигуры вписать числами, двигать его будет мучением — придётся менять все числа.\n\nХитрость: всё рисуем **относительно одной точки** `x, y`. И оборачиваем в функцию:\n\n```js canvas\nfunction drawHero(x, y) {\n  // тело\n  ctx.fillStyle = \"royalblue\";\n  ctx.fillRect(x, y, 40, 50);\n  // голова\n  ctx.fillStyle = \"peachpuff\";\n  ctx.beginPath();\n  ctx.arc(x + 20, y - 15, 15, 0, Math.PI * 2);\n  ctx.fill();\n  // глаза\n  ctx.fillStyle = \"black\";\n  ctx.fillRect(x + 12, y - 19, 4, 4);\n  ctx.fillRect(x + 24, y - 19, 4, 4);\n  // ноги\n  ctx.fillStyle = \"saddlebrown\";\n  ctx.fillRect(x + 4, y + 50, 12, 16);\n  ctx.fillRect(x + 24, y + 50, 12, 16);\n}\n\ndrawHero(60, 150);\ndrawHero(220, 120);\ndrawHero(380, 200);\n```\n\nТри героя одной функцией! Голова на `x + 20` (центр тела), глаза на `x + 12` и `x + 24`… Меняешь `x` и `y` — двигается весь персонаж.\n\n> 🎮 Именно так и рисуют игровых персонажей: функция `draw` с координатами. Чтобы персонаж «шёл», в анимации каждый кадр рисуют его с чуть другим `x`.\n\n## Рисуем с картинкой-эмодзи\n\nБыстрый способ сделать симпатичного героя — эмодзи:\n\n```js canvas\nfunction drawFrog(x, y, size) {\n  ctx.font = size + \"px Arial\";\n  ctx.fillText(\"🐸\", x, y);\n}\ndrawFrog(50, 200, 60);\ndrawFrog(200, 220, 100);\ndrawFrog(380, 180, 40);\n```",
   "task": {
    "tests": [
     [
      "Функция drawHero есть и принимает x и y",
      "typeof drawHero === \"function\" && drawHero.length >= 2"
     ],
     [
      "Рисует хотя бы две фигуры",
      "(function () { __clearDraw(); drawHero(50, 50); return __draw.filter(function (c) { return [\"fillRect\", \"arc\", \"fillText\", \"strokeRect\", \"rect\", \"ellipse\", \"lineTo\"].indexOf(c.m) !== -1; }).length >= 2; })()"
     ],
     [
      "Персонаж двигается вместе с x и y",
      "(function () { __clearDraw(); drawHero(50, 50); var a = JSON.stringify(__draw.map(function (c) { return c.a; })); __clearDraw(); drawHero(250, 150); var b = JSON.stringify(__draw.map(function (c) { return c.a; })); return a !== b && __draw.length > 0; })()"
     ],
     [
      "Все части сдвигаются на одинаковое расстояние",
      "(function () { function pts() { return __draw.filter(function (c) { return [\"fillRect\", \"arc\", \"fillText\", \"strokeRect\", \"rect\", \"ellipse\", \"moveTo\", \"lineTo\"].indexOf(c.m) !== -1; }).map(function (c) { return c.m === \"fillText\" ? [c.a[1], c.a[2]] : [c.a[0], c.a[1]]; }); } __clearDraw(); drawHero(50, 50); var a = pts(); __clearDraw(); drawHero(150, 90); var b = pts(); return a.length >= 2 && a.length === b.length && a.every(function (p, i) { return b[i][0] - p[0] === 100 && b[i][1] - p[1] === 40; }); })()"
     ],
     [
      "Герой нарисован хотя бы в двух местах",
      "(__codeNS.match(/drawHero\\s*\\(/g) || []).length >= 3"
     ]
    ],
    "hints": [
     "Внутри функции используй координаты вида `x + число` и `y + число`, а не просто числа. Например, `ctx.fillRect(x, y, 40, 50);`",
     "Голова: `ctx.beginPath(); ctx.arc(x + 20, y - 15, 15, 0, Math.PI * 2); ctx.fill();`. И вызови: `drawHero(100, 150); drawHero(300, 150);`"
    ],
    "text": "Напиши функцию `drawHero(x, y)`, которая рисует персонажа **относительно точки** `(x, y)`: хотя бы **две фигуры** (например, тело-прямоугольник и голову-круг).\n\nРобот вызовет твою функцию в разных точках и проверит, что персонаж действительно сдвигается.\n\nНарисуй своего героя хотя бы в двух местах.",
    "canvas": true,
    "starter": "function drawHero(x, y) {\n\n}\n",
    "solution": "function drawHero(x, y) {\n  ctx.fillStyle = \"royalblue\";\n  ctx.fillRect(x, y, 40, 50);\n  ctx.fillStyle = \"peachpuff\";\n  ctx.beginPath();\n  ctx.arc(x + 20, y - 15, 15, 0, Math.PI * 2);\n  ctx.fill();\n}\n\ndrawHero(100, 150);\ndrawHero(300, 150);\n"
   },
   "quiz": [
    {
     "q": "Зачем рисовать части персонажа через `x + 20`, а не через готовое число 120?",
     "a": [
      "Чтобы весь персонаж двигался, если поменять x",
      "Так быстрее рисуется",
      "Иначе будет ошибка"
     ],
     "c": 0,
     "e": "Все части привязаны к одной точке — двигаешь её, двигается всё."
    }
   ]
  },
  {
   "id": "canvas-6",
   "title": "Циклы на холсте",
   "theory": "Цикл + рисование = целые миры за пару строчек.\n\n## Ряд монет\n\n```js canvas\nfor (let i = 0; i < 8; i++) {\n  ctx.fillStyle = \"gold\";\n  ctx.beginPath();\n  ctx.arc(40 + i * 55, 160, 18, 0, Math.PI * 2);\n  ctx.fill();\n}\n```\n\n`40 + i * 55` — каждая следующая монета на 55 пикселей правее.\n\n## Стена из кирпичей — двойной цикл\n\n```js canvas\nconst brickW = 56, brickH = 22;\nfor (let row = 0; row < 5; row++) {\n  for (let col = 0; col < 8; col++) {\n    ctx.fillStyle = `hsl(${row * 40}, 80%, 55%)`;\n    ctx.fillRect(10 + col * (brickW + 2), 20 + row * (brickH + 4), brickW, brickH);\n  }\n}\n```\n\nЭто почти готовое поле для арканоида!\n\n## Звёздное небо — случайность\n\n```js canvas\nctx.fillStyle = \"#0b1030\";\nctx.fillRect(0, 0, canvas.width, canvas.height);\nfor (let i = 0; i < 150; i++) {\n  const x = Math.random() * canvas.width;\n  const y = Math.random() * canvas.height;\n  const size = Math.random() * 2.5;\n  ctx.fillStyle = \"white\";\n  ctx.fillRect(x, y, size, size);\n}\n```\n\nЗапусти несколько раз — каждый раз новое небо.\n\n## Рисуем карту из массива\n\nПомнишь карту уровня из модуля про массивы? Вот она в графике:\n\n```js canvas\nconst level = [\n  \"############\",\n  \"#..........#\",\n  \"#..##..o...#\",\n  \"#......##..#\",\n  \"#..o.......#\",\n  \"############\"\n];\nconst size = 40;\nfor (let y = 0; y < level.length; y++) {\n  for (let x = 0; x < level[y].length; x++) {\n    const cell = level[y][x];\n    if (cell === \"#\") ctx.fillStyle = \"#5a4fcf\";\n    else if (cell === \"o\") ctx.fillStyle = \"gold\";\n    else ctx.fillStyle = \"#1c2244\";\n    ctx.fillRect(x * size, y * size, size - 1, size - 1);\n  }\n}\n```\n\n> 💡 Строка — это тоже как массив символов: `level[y][x]` даёт один символ. Так удобно «рисовать» уровни прямо текстом.",
   "task": {
    "tests": [
     [
      "Нарисовано не меньше 10 кругов радиусом 15",
      "__drawn(\"arc\").filter(function (c) { return c.a[2] === 15; }).length >= 10"
     ],
     [
      "Круги стоят в ряд: одинаковый y, разные x",
      "(function () { var a = __drawn(\"arc\").filter(function (c) { return c.a[2] === 15; }); var ys = {}, xs = {}; a.forEach(function (c) { ys[c.a[1]] = 1; xs[c.a[0]] = 1; }); return Object.keys(ys).length === 1 && Object.keys(xs).length >= 10; })()"
     ],
     [
      "Монеты золотые",
      "__drew(\"fill\", function (c) { return __isColor(c.fill, \"yellow\") || __isColor(c.fill, \"orange\"); })"
     ],
     [
      "Используется цикл",
      "/for\\s*\\(|while\\s*\\(/.test(__codeNS)"
     ]
    ],
    "hints": [
     "Цикл `for (let i = 0; i < 10; i++)`, внутри — круг с `x = 30 + i * 45`.",
     "Внутри цикла: `ctx.beginPath(); ctx.arc(30 + i * 45, 160, 15, 0, Math.PI * 2); ctx.fill();`. Цвет `\"gold\"` можно выбрать один раз перед циклом."
    ],
    "text": "С помощью **цикла** нарисуй ряд из **10 монет** — золотых кругов радиусом 15. Монеты должны стоять в ряд по горизонтали (у всех одинаковый y, а x — разный).",
    "canvas": true,
    "starter": "\n",
    "solution": "ctx.fillStyle = \"gold\";\nfor (let i = 0; i < 10; i++) {\n  ctx.beginPath();\n  ctx.arc(30 + i * 45, 160, 15, 0, Math.PI * 2);\n  ctx.fill();\n}\n"
   },
   "quiz": [
    {
     "q": "Как в цикле сделать, чтобы каждый следующий квадрат был на 30 пикселей правее предыдущего?",
     "a": [
      "x = начало + i * 30",
      "x = 30",
      "x = i + 30"
     ],
     "c": 0,
     "e": "Умножаем номер шага на расстояние между фигурами."
    }
   ]
  }
 ],
 "id": "canvas",
 "icon": "🎨",
 "color": "#20c1d8",
 "title": "Рисуем на холсте",
 "desc": "Координаты, цвета, фигуры, текст — рисуем игровой мир"
});
