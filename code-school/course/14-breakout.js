/* Собрано из content/14-breakout.txt командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */
window.COURSE = window.COURSE || [];
window.COURSE.push({
 "lessons": [
  {
   "id": "brk-1",
   "title": "Шаг 1. Ракетка и мяч",
   "xp": 20,
   "theory": "Второй проект — **«Арканоид»** (по-английски Breakout [брейка́ут]). Внизу ракетка, вверху стена кирпичей, мяч отскакивает и разбивает кирпичи. Игре почти 50 лет, а играть в неё всё так же интересно!\n\n## План\n\n1. **Ракетка и мяч** ← ты здесь\n2. Отскок от ракетки и потеря мяча\n3. Стена кирпичей\n4. Победа, поражение и новая игра\n\n## Что нам понадобится\n\nВсё это ты уже умеешь — теперь соберём вместе:\n\n| Что | Где учили |\n|---|---|\n| Плавное управление `keys` | Управление → Зажатые клавиши |\n| Границы для ракетки | Управление → Границы экрана |\n| Движение мяча `vx`, `vy` | Анимация → Скорость |\n| Отскок от стен | Анимация → Отскок |\n\n## Ракетка и мяч — объекты\n\n```code\nconst paddle = { x: 200, y: 296, w: 80, h: 12, speed: 7 };   // ракетка\nconst ball = { x: 240, y: 200, r: 7, vx: 3, vy: -3 };       // мяч\n```\n\n`paddle` [пэдл] — «ракетка», `ball` [бол] — «мяч».\n\n> 💡 Хорошая практика: сначала сделать, чтобы всё **двигалось**, а уже потом — чтобы **сталкивалось**. Маленькими шагами, проверяя каждый.",
   "task": {
    "tests": [
     [
      "→ двигает ракетку вправо, ← — влево",
      "(function () { paddle.x = 100; __press(\"ArrowRight\"); update(); __release(\"ArrowRight\"); var a = paddle.x === 107; __press(\"ArrowLeft\"); update(); update(); __release(\"ArrowLeft\"); return a && paddle.x === 93; })()"
     ],
     [
      "Ракетка не выходит за края",
      "(function () { paddle.x = canvas.width - paddle.w - 2; __press(\"ArrowRight\"); update(); __release(\"ArrowRight\"); var a = paddle.x === canvas.width - paddle.w; paddle.x = 3; __press(\"ArrowLeft\"); update(); __release(\"ArrowLeft\"); return a && paddle.x === 0; })()"
     ],
     [
      "Мяч летит со своей скоростью",
      "(function () { paddle.x = 200; ball.x = 100; ball.y = 100; ball.vx = 3; ball.vy = -2; update(); return ball.x === 103 && ball.y === 98; })()"
     ],
     [
      "Мяч отскакивает от левой, правой и верхней стен",
      "(function () { ball.y = 150; ball.x = canvas.width - ball.r - 1; ball.vx = 4; ball.vy = 0; update(); var r = ball.vx < 0; ball.x = ball.r + 1; ball.vx = -4; update(); var l = ball.vx > 0; ball.x = 200; ball.y = ball.r + 1; ball.vx = 0; ball.vy = -4; update(); return r && l && ball.vy > 0; })()"
     ],
     [
      "От нижней стены мяч не отскакивает",
      "(function () { ball.x = 30; ball.y = canvas.height - ball.r - 1; ball.vx = 0; ball.vy = 4; update(); return ball.vy > 0; })()"
     ]
    ],
    "hints": [
     "Ракетка: `if (keys[\"ArrowLeft\"]) paddle.x -= paddle.speed;` и так же для →. Границы: `if (paddle.x < 0) paddle.x = 0;` и `if (paddle.x + paddle.w > canvas.width) paddle.x = canvas.width - paddle.w;`",
     "Мяч: `ball.x += ball.vx; ball.y += ball.vy;`",
     "Отскоки: `if (ball.x - ball.r < 0) ball.vx = Math.abs(ball.vx);`, `if (ball.x + ball.r > canvas.width) ball.vx = -Math.abs(ball.vx);`, `if (ball.y - ball.r < 0) ball.vy = Math.abs(ball.vy);`"
    ],
    "text": "Допиши `update()`:\n\n1. **Ракетка:** при зажатой ← уменьшай `paddle.x` на `paddle.speed`, при → увеличивай. Не давай ракетке выйти за левый и правый края.\n2. **Мяч:** сдвигай `ball.x` на `ball.vx` и `ball.y` на `ball.vy`.\n3. **Отскоки** мяча от **левой, правой и верхней** стен (учитывай радиус `ball.r`). От нижней — **не** отскакивать: там игрок теряет мяч (это следующий шаг).",
    "canvas": true,
    "starter": "const paddle = { x: 200, y: 296, w: 80, h: 12, speed: 7 };\nconst ball = { x: 240, y: 200, r: 7, vx: 3, vy: -3 };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  // 1. Ракетка: ← → и границы\n\n\n  // 2. Мяч летит\n\n\n  // 3. Отскоки от левой, правой и верхней стен\n\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#0d1326\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#7c6cff\";\n  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);\n  ctx.fillStyle = \"white\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const paddle = { x: 200, y: 296, w: 80, h: 12, speed: 7 };\nconst ball = { x: 240, y: 200, r: 7, vx: 3, vy: -3 };\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  // 1. Ракетка: ← → и границы\n  if (keys[\"ArrowLeft\"]) paddle.x -= paddle.speed;\n  if (keys[\"ArrowRight\"]) paddle.x += paddle.speed;\n  if (paddle.x < 0) paddle.x = 0;\n  if (paddle.x + paddle.w > canvas.width) paddle.x = canvas.width - paddle.w;\n\n  // 2. Мяч летит\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n\n  // 3. Отскоки от левой, правой и верхней стен\n  if (ball.x - ball.r < 0) ball.vx = Math.abs(ball.vx);\n  if (ball.x + ball.r > canvas.width) ball.vx = -Math.abs(ball.vx);\n  if (ball.y - ball.r < 0) ball.vy = Math.abs(ball.vy);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#0d1326\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#7c6cff\";\n  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);\n  ctx.fillStyle = \"white\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Почему для отскока от левой стены лучше `vx = Math.abs(vx)`, чем `vx = -vx`?",
     "a": [
      "Мяч гарантированно полетит вправо и не «залипнет» в стене",
      "Так короче",
      "Math.abs быстрее"
     ],
     "c": 0,
     "e": "Math.abs всегда даёт положительное число — значит, движение вправо, даже если мяч успел залезть в стену."
    }
   ]
  },
  {
   "id": "brk-2",
   "title": "Шаг 2. Ракетка отбивает мяч",
   "xp": 20,
   "theory": "Теперь мяч должен **отскакивать от ракетки**, а если игрок промахнулся — теряется жизнь.\n\n## Столкновение мяча с ракеткой\n\nИспользуем `rectsCollide` из модуля «Физика». Мяч — круг, но для простоты представим его квадратом вокруг круга:\n\n```code\nfunction ballRect() {\n  return { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };\n}\n```\n\nОтскакиваем, только если мяч летит **вниз** (`ball.vy > 0`). Иначе мяч, попавший в ракетку сбоку, может застрять и дрожать внутри.\n\n## Угол отскока — секрет хорошего арканоида\n\nЕсли мяч всегда отскакивает одинаково, игрок не может им управлять — скучно. В настоящем арканоиде угол зависит от того, **куда** мяч попал:\n\n- в середину ракетки — летит почти вертикально вверх;\n- ближе к правому краю — уходит вправо;\n- ближе к левому — влево.\n\n```code\nconst center = paddle.x + paddle.w / 2;\nconst hit = (ball.x - center) / (paddle.w / 2);   // от -1 (левый край) до 1 (правый)\nball.vx = hit * 5;\nball.vy = -Math.abs(ball.vy);\n```\n\n`hit` — насколько далеко от центра попал мяч: −1 на левом краю, 0 в центре, 1 на правом.\n\n## Потеря мяча\n\nЕсли мяч ушёл за нижний край — минус жизнь и мяч возвращается в центр:\n\n```code\nif (ball.y - ball.r > canvas.height) {\n  lives--;\n  resetBall();\n}\n```",
   "task": {
    "tests": [
     [
      "Мяч, упавший на центр ракетки, летит вверх",
      "(function () { paddle.x = 200; ball.x = paddle.x + paddle.w / 2; ball.y = paddle.y - ball.r + 2; ball.vx = 0; ball.vy = 3; update(); return ball.vy < 0 && Math.abs(ball.vx) < 1; })()"
     ],
     [
      "Удар правым краем — мяч уходит вправо, левым — влево",
      "(function () { paddle.x = 200; ball.x = paddle.x + paddle.w - 4; ball.y = paddle.y - ball.r + 2; ball.vx = 0; ball.vy = 3; update(); var r = ball.vx > 2 && ball.vy < 0; ball.x = paddle.x + 4; ball.y = paddle.y - ball.r + 2; ball.vx = 0; ball.vy = 3; update(); return r && ball.vx < -2 && ball.vy < 0; })()"
     ],
     [
      "Летящий вверх мяч ракетка не разворачивает",
      "(function () { paddle.x = 200; ball.x = paddle.x + paddle.w / 2; ball.y = paddle.y + 4; ball.vx = 0; ball.vy = -3; update(); return ball.vy < 0; })()"
     ],
     [
      "Мимо ракетки — мяч пролетает",
      "(function () { paddle.x = 0; ball.x = 400; ball.y = paddle.y; ball.vx = 0; ball.vy = 3; update(); return ball.vy > 0; })()"
     ],
     [
      "Упал вниз — минус жизнь и мяч снова в игре",
      "(function () { lives = 3; paddle.x = 200; ball.x = 50; ball.y = canvas.height + 20; ball.vx = 0; ball.vy = 3; update(); return lives === 2 && ball.y < canvas.height && ball.vy < 0; })()"
     ]
    ],
    "hints": [
     "Условие: `if (ball.vy > 0 && rectsCollide(ballRect(), paddle)) { ... }`",
     "Внутри: `const center = paddle.x + paddle.w / 2; const hit = (ball.x - center) / (paddle.w / 2); ball.vx = hit * 5; ball.vy = -Math.abs(ball.vy);`",
     "Падение: `if (ball.y - ball.r > canvas.height) { lives--; resetBall(); }`"
    ],
    "text": "1. Допиши в `update()` отскок от ракетки: если мяч летит вниз (`ball.vy > 0`) **и** `rectsCollide(ballRect(), paddle)` — направь мяч вверх и задай `ball.vx` по месту удара (формула с `hit`).\n2. Если мяч упал ниже холста — уменьши `lives` на 1 и вызови `resetBall()`.",
    "canvas": true,
    "starter": "const paddle = { x: 200, y: 296, w: 80, h: 12, speed: 7 };\nconst ball = { x: 240, y: 200, r: 7, vx: 3, vy: -3 };\nlet lives = 3;\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction ballRect() {\n  return { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };\n}\n\nfunction resetBall() {\n  ball.x = canvas.width / 2;\n  ball.y = 200;\n  ball.vx = Math.random() < 0.5 ? -3 : 3;\n  ball.vy = -3;\n}\n\nfunction update() {\n  if (keys[\"ArrowLeft\"]) paddle.x -= paddle.speed;\n  if (keys[\"ArrowRight\"]) paddle.x += paddle.speed;\n  if (paddle.x < 0) paddle.x = 0;\n  if (paddle.x + paddle.w > canvas.width) paddle.x = canvas.width - paddle.w;\n\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n  if (ball.x - ball.r < 0) ball.vx = Math.abs(ball.vx);\n  if (ball.x + ball.r > canvas.width) ball.vx = -Math.abs(ball.vx);\n  if (ball.y - ball.r < 0) ball.vy = Math.abs(ball.vy);\n\n  // 1. Отскок от ракетки\n\n\n  // 2. Мяч упал\n\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#0d1326\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#7c6cff\";\n  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);\n  ctx.fillStyle = \"white\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"❤️\".repeat(Math.max(0, lives)), 10, 26);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const paddle = { x: 200, y: 296, w: 80, h: 12, speed: 7 };\nconst ball = { x: 240, y: 200, r: 7, vx: 3, vy: -3 };\nlet lives = 3;\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction ballRect() {\n  return { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };\n}\n\nfunction resetBall() {\n  ball.x = canvas.width / 2;\n  ball.y = 200;\n  ball.vx = Math.random() < 0.5 ? -3 : 3;\n  ball.vy = -3;\n}\n\nfunction update() {\n  if (keys[\"ArrowLeft\"]) paddle.x -= paddle.speed;\n  if (keys[\"ArrowRight\"]) paddle.x += paddle.speed;\n  if (paddle.x < 0) paddle.x = 0;\n  if (paddle.x + paddle.w > canvas.width) paddle.x = canvas.width - paddle.w;\n\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n  if (ball.x - ball.r < 0) ball.vx = Math.abs(ball.vx);\n  if (ball.x + ball.r > canvas.width) ball.vx = -Math.abs(ball.vx);\n  if (ball.y - ball.r < 0) ball.vy = Math.abs(ball.vy);\n\n  // 1. Отскок от ракетки\n  if (ball.vy > 0 && rectsCollide(ballRect(), paddle)) {\n    const center = paddle.x + paddle.w / 2;\n    const hit = (ball.x - center) / (paddle.w / 2);\n    ball.vx = hit * 5;\n    ball.vy = -Math.abs(ball.vy);\n  }\n\n  // 2. Мяч упал\n  if (ball.y - ball.r > canvas.height) {\n    lives--;\n    resetBall();\n  }\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#0d1326\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"#7c6cff\";\n  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);\n  ctx.fillStyle = \"white\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"❤️\".repeat(Math.max(0, lives)), 10, 26);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Чему равен hit, если мяч попал точно в центр ракетки?",
     "a": [
      "0",
      "1",
      "−1"
     ],
     "c": 0,
     "e": "Расстояние от центра равно нулю, значит hit = 0 и мяч полетит вертикально."
    }
   ]
  },
  {
   "id": "brk-3",
   "title": "Шаг 3. Стена кирпичей",
   "xp": 20,
   "theory": "Самое приятное — **кирпичи**! Их 40 штук: 5 рядов по 8. Создадим их двойным циклом, как карту в модуле «Массивы».\n\n```code\nfunction makeBricks() {\n  bricks = [];\n  for (let row = 0; row < 5; row++) {\n    for (let col = 0; col < 8; col++) {\n      bricks.push({\n        x: 10 + col * 58,\n        y: 40 + row * 22,\n        w: 54,\n        h: 18,\n        color: `hsl(${row * 45}, 80%, 60%)`\n      });\n    }\n  }\n}\n```\n\n- `col * 58` — ширина кирпича 54 плюс зазор 4;\n- `row * 22` — высота 18 плюс зазор 4;\n- цвет зависит от ряда — получается радуга.\n\nПроверим ширину: 8 кирпичей × 58 = 464, плюс отступ 10 слева — правый край на 464 + 10 − 4 = 470. Влезает в холст шириной 480. ✓\n\n## Мяч разбивает кирпич\n\nКаждый кадр проверяем мяч со **всеми** кирпичами. Попал — удаляем кирпич, разворачиваем мяч по вертикали, добавляем очки:\n\n```code\nfor (let i = bricks.length - 1; i >= 0; i--) {\n  if (rectsCollide(ballRect(), bricks[i])) {\n    bricks.splice(i, 1);\n    ball.vy = -ball.vy;\n    score += 10;\n    break;   // за один кадр — только один кирпич\n  }\n}\n```\n\n`break` нужен, чтобы при попадании сразу в два соседних кирпича мяч не развернулся дважды (и не полетел дальше сквозь стену).\n\n> 🎮 Хочешь крепкие кирпичи, которые разбиваются со второго удара? Добавь каждому `hp: 2` и удаляй только когда `hp` станет 0. Сделай это в песочнице после проекта!",
   "task": {
    "tests": [
     [
      "makeBricks создаёт 40 кирпичей",
      "(function () { makeBricks(); return bricks.length === 40 && bricks.every(function (b) { return b.w > 0 && b.h > 0 && typeof b.x === \"number\" && typeof b.y === \"number\"; }); })()"
     ],
     [
      "Все кирпичи на холсте и не налезают друг на друга",
      "(function () { makeBricks(); for (var i = 0; i < bricks.length; i++) { var a = bricks[i]; if (a.x < 0 || a.x + a.w > canvas.width || a.y < 0 || a.y + a.h > canvas.height / 2) return false; for (var j = i + 1; j < bricks.length; j++) { var b = bricks[j]; if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) return false; } } return true; })()"
     ],
     [
      "draw рисует каждый кирпич",
      "(function () { makeBricks(); __clearDraw(); draw(); var r = __drawn(\"fillRect\"); return bricks.every(function (b) { return r.some(function (c) { return c.a[0] === b.x && c.a[1] === b.y && c.a[2] === b.w; }); }); })()"
     ],
     [
      "Мяч разбивает кирпич: кирпич исчез, мяч развернулся, +10 очков",
      "(function () { bricks.length = 0; bricks.push({ x: 100, y: 100, w: 54, h: 18, color: \"red\" }); ball.x = 127; ball.y = 122; ball.vx = 0; ball.vy = -3; var s = score; update(); return bricks.length === 0 && ball.vy > 0 && score === s + 10; })()"
     ],
     [
      "За один кадр разбивается только один кирпич",
      "(function () { bricks.length = 0; bricks.push({ x: 100, y: 100, w: 30, h: 18, color: \"red\" }, { x: 128, y: 100, w: 30, h: 18, color: \"red\" }); ball.x = 129; ball.y = 121; ball.vx = 0; ball.vy = -3; update(); var ok = bricks.length === 1 && ball.vy > 0; makeBricks(); return ok; })()"
     ]
    ],
    "hints": [
     "makeBricks: два цикла — `for (let row = 0; row < 5; row++)` и внутри `for (let col = 0; col < 8; col++)`, в теле `bricks.push({ x: 10 + col * 58, y: 40 + row * 22, w: 54, h: 18, color: ... });`",
     "draw: `for (const b of bricks) { ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h); }`",
     "Столкновение — цикл с конца, внутри `if (rectsCollide(ballRect(), bricks[i])) { bricks.splice(i, 1); ball.vy = -ball.vy; score += 10; break; }`"
    ],
    "text": "1. Допиши `makeBricks()` — 5 рядов по 8 кирпичей (размеры и формула — в теории). Каждый кирпич — объект с `x`, `y`, `w`, `h` и `color`.\n2. В `draw()` нарисуй каждый кирпич его цветом.\n3. В `update()` — столкновение мяча с кирпичами: удалить кирпич, развернуть `ball.vy`, `score += 10`, `break`.",
    "canvas": true,
    "starter": "const paddle = { x: 200, y: 296, w: 80, h: 12, speed: 7 };\nconst ball = { x: 240, y: 200, r: 7, vx: 3, vy: -3 };\nlet lives = 3;\nlet score = 0;\nlet bricks = [];\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\nfunction ballRect() {\n  return { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };\n}\nfunction resetBall() {\n  ball.x = canvas.width / 2;\n  ball.y = 200;\n  ball.vx = Math.random() < 0.5 ? -3 : 3;\n  ball.vy = -3;\n}\n\n// 1. Создать стену кирпичей\nfunction makeBricks() {\n  bricks = [];\n\n}\n\nfunction update() {\n  if (keys[\"ArrowLeft\"]) paddle.x -= paddle.speed;\n  if (keys[\"ArrowRight\"]) paddle.x += paddle.speed;\n  if (paddle.x < 0) paddle.x = 0;\n  if (paddle.x + paddle.w > canvas.width) paddle.x = canvas.width - paddle.w;\n\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n  if (ball.x - ball.r < 0) ball.vx = Math.abs(ball.vx);\n  if (ball.x + ball.r > canvas.width) ball.vx = -Math.abs(ball.vx);\n  if (ball.y - ball.r < 0) ball.vy = Math.abs(ball.vy);\n\n  if (ball.vy > 0 && rectsCollide(ballRect(), paddle)) {\n    const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);\n    ball.vx = hit * 5;\n    ball.vy = -Math.abs(ball.vy);\n  }\n\n  // 3. Мяч разбивает кирпич\n\n\n  if (ball.y - ball.r > canvas.height) {\n    lives--;\n    resetBall();\n  }\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#0d1326\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  // 2. Нарисовать кирпичи\n\n  ctx.fillStyle = \"#7c6cff\";\n  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);\n  ctx.fillStyle = \"white\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"❤️\".repeat(Math.max(0, lives)) + \"   Очки: \" + score, 10, 26);\n}\n\nmakeBricks();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const paddle = { x: 200, y: 296, w: 80, h: 12, speed: 7 };\nconst ball = { x: 240, y: 200, r: 7, vx: 3, vy: -3 };\nlet lives = 3;\nlet score = 0;\nlet bricks = [];\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\nfunction ballRect() {\n  return { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };\n}\nfunction resetBall() {\n  ball.x = canvas.width / 2;\n  ball.y = 200;\n  ball.vx = Math.random() < 0.5 ? -3 : 3;\n  ball.vy = -3;\n}\n\n// 1. Создать стену кирпичей\nfunction makeBricks() {\n  bricks = [];\n  for (let row = 0; row < 5; row++) {\n    for (let col = 0; col < 8; col++) {\n      bricks.push({\n        x: 10 + col * 58,\n        y: 40 + row * 22,\n        w: 54,\n        h: 18,\n        color: `hsl(${row * 45}, 80%, 60%)`\n      });\n    }\n  }\n}\n\nfunction update() {\n  if (keys[\"ArrowLeft\"]) paddle.x -= paddle.speed;\n  if (keys[\"ArrowRight\"]) paddle.x += paddle.speed;\n  if (paddle.x < 0) paddle.x = 0;\n  if (paddle.x + paddle.w > canvas.width) paddle.x = canvas.width - paddle.w;\n\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n  if (ball.x - ball.r < 0) ball.vx = Math.abs(ball.vx);\n  if (ball.x + ball.r > canvas.width) ball.vx = -Math.abs(ball.vx);\n  if (ball.y - ball.r < 0) ball.vy = Math.abs(ball.vy);\n\n  if (ball.vy > 0 && rectsCollide(ballRect(), paddle)) {\n    const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);\n    ball.vx = hit * 5;\n    ball.vy = -Math.abs(ball.vy);\n  }\n\n  // 3. Мяч разбивает кирпич\n  for (let i = bricks.length - 1; i >= 0; i--) {\n    if (rectsCollide(ballRect(), bricks[i])) {\n      bricks.splice(i, 1);\n      ball.vy = -ball.vy;\n      score += 10;\n      break;\n    }\n  }\n\n  if (ball.y - ball.r > canvas.height) {\n    lives--;\n    resetBall();\n  }\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#0d1326\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  // 2. Нарисовать кирпичи\n  for (const b of bricks) {\n    ctx.fillStyle = b.color;\n    ctx.fillRect(b.x, b.y, b.w, b.h);\n  }\n  ctx.fillStyle = \"#7c6cff\";\n  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);\n  ctx.fillStyle = \"white\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"❤️\".repeat(Math.max(0, lives)) + \"   Очки: \" + score, 10, 26);\n}\n\nmakeBricks();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Зачем break после попадания в кирпич?",
     "a": [
      "Чтобы мяч не развернулся дважды, задев два кирпича сразу",
      "Чтобы остановить игру",
      "Без него кирпич не удалится"
     ],
     "c": 0,
     "e": "Два разворота подряд = мяч летит в ту же сторону и пробивает стену насквозь."
    }
   ]
  },
  {
   "id": "brk-4",
   "title": "Шаг 4. Победа и поражение",
   "xp": 25,
   "theory": "Осталось превратить это в законченную игру: **победа**, когда разбиты все кирпичи, **поражение**, когда кончились жизни, и **новая игра** по пробелу.\n\n## Состояние игры\n\nЗаведём переменную `state` [стэйт] — «состояние»:\n\n| state | Что происходит |\n|---|---|\n| `\"play\"` | идёт игра |\n| `\"win\"` | победа — все кирпичи разбиты |\n| `\"lose\"` | поражение — кончились жизни |\n\n```code\nlet state = \"play\";\n\nfunction update() {\n  if (state !== \"play\") return;   // не играем — ничего не двигаем\n  // ...\n  if (bricks.length === 0) state = \"win\";\n  if (lives <= 0) state = \"lose\";\n}\n```\n\n> 🧠 Такой подход называется **конечный автомат** (state machine). У игры есть несколько состояний, и в каждом она ведёт себя по-своему. Меню, игра, пауза, экран победы — всё это состояния. Так устроены почти все игры.\n\n## Экран результата\n\n```code\nif (state === \"win\") showMessage(\"ПОБЕДА! 🏆\");\nif (state === \"lose\") showMessage(\"Игра окончена\");\n```\n\n## Новая игра\n\nФункция `restart()` возвращает всё как было: жизни, очки, кирпичи, мяч, состояние.\n\n> 🏆 Поздравляю — у тебя полноценный арканоид! Идеи для улучшений: бонусы, выпадающие из кирпичей (широкая ракетка, три мяча), уровни с разной раскладкой кирпичей, ускорение мяча со временем.",
   "task": {
    "tests": [
     [
      "Последняя жизнь потеряна — поражение",
      "(function () { state = \"play\"; lives = 1; makeBricks(); ball.x = 50; ball.y = canvas.height + 30; ball.vy = 3; update(); return state === \"lose\"; })()"
     ],
     [
      "Все кирпичи разбиты — победа",
      "(function () { state = \"play\"; lives = 3; bricks.length = 0; ball.x = 240; ball.y = 200; ball.vx = 1; ball.vy = -1; update(); return state === \"win\"; })()"
     ],
     [
      "Когда игра не идёт, мяч не двигается",
      "(function () { state = \"lose\"; ball.x = 100; ball.y = 100; ball.vx = 3; ball.vy = 3; update(); return ball.x === 100 && ball.y === 100; })()"
     ],
     [
      "Пробел после конца игры начинает заново",
      "(function () { state = \"lose\"; lives = 0; score = 120; bricks.length = 0; __press(\" \"); __release(\" \"); return state === \"play\" && lives === 3 && score === 0 && bricks.length === 40; })()"
     ],
     [
      "Во время игры пробел ничего не сбрасывает",
      "(function () { state = \"play\"; score = 50; __press(\" \"); __release(\" \"); return score === 50; })()"
     ],
     [
      "При победе и поражении рисуются надписи",
      "(function () { state = \"play\"; __clearDraw(); draw(); var n = __drawn(\"fillText\").length; state = \"win\"; __clearDraw(); draw(); var w = __drawn(\"fillText\").length; state = \"lose\"; __clearDraw(); draw(); var l = __drawn(\"fillText\").length; state = \"play\"; return w > n && l > n; })()"
     ]
    ],
    "hints": [
     "Начало update: `if (state !== \"play\") return;`. Конец update: `if (bricks.length === 0) state = \"win\";` и `if (lives <= 0) state = \"lose\";`",
     "restart: `lives = 3; score = 0; makeBricks(); resetBall(); state = \"play\";`. Пробел: `if (e.key === \" \" && state !== \"play\") restart();`",
     "В draw: `if (state === \"win\") showMessage(\"ПОБЕДА! 🏆\");` и `if (state === \"lose\") showMessage(\"Игра окончена\");`"
    ],
    "text": "1. В начале `update()`: если `state` не `\"play\"` — выйди из функции.\n2. В конце `update()`: если кирпичей не осталось — `state = \"win\"`; если `lives` стало 0 или меньше — `state = \"lose\"`.\n3. Напиши `restart()`: `lives = 3`, `score = 0`, `makeBricks()`, `resetBall()`, `state = \"play\"`.\n4. По пробелу, если игра не идёт, — `restart()`.\n5. В `draw()` покажи надпись при победе и при поражении (функция `showMessage` уже есть).",
    "canvas": true,
    "starter": "const paddle = { x: 200, y: 296, w: 80, h: 12, speed: 7 };\nconst ball = { x: 240, y: 200, r: 7, vx: 3, vy: -3 };\nlet lives = 3;\nlet score = 0;\nlet bricks = [];\nlet state = \"play\";   // \"play\", \"win\" или \"lose\"\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => {\n  keys[e.key] = true;\n  // 4. Пробел — новая игра\n\n});\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\nfunction ballRect() {\n  return { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };\n}\nfunction resetBall() {\n  ball.x = canvas.width / 2;\n  ball.y = 200;\n  ball.vx = Math.random() < 0.5 ? -3 : 3;\n  ball.vy = -3;\n}\nfunction makeBricks() {\n  bricks = [];\n  for (let row = 0; row < 5; row++) {\n    for (let col = 0; col < 8; col++) {\n      bricks.push({ x: 10 + col * 58, y: 40 + row * 22, w: 54, h: 18, color: `hsl(${row * 45}, 80%, 60%)` });\n    }\n  }\n}\n\n// 3. Новая игра\nfunction restart() {\n\n}\n\nfunction update() {\n  // 1. Игра не идёт — ничего не делаем\n\n  if (keys[\"ArrowLeft\"]) paddle.x -= paddle.speed;\n  if (keys[\"ArrowRight\"]) paddle.x += paddle.speed;\n  if (paddle.x < 0) paddle.x = 0;\n  if (paddle.x + paddle.w > canvas.width) paddle.x = canvas.width - paddle.w;\n\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n  if (ball.x - ball.r < 0) ball.vx = Math.abs(ball.vx);\n  if (ball.x + ball.r > canvas.width) ball.vx = -Math.abs(ball.vx);\n  if (ball.y - ball.r < 0) ball.vy = Math.abs(ball.vy);\n\n  if (ball.vy > 0 && rectsCollide(ballRect(), paddle)) {\n    const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);\n    ball.vx = hit * 5;\n    ball.vy = -Math.abs(ball.vy);\n  }\n\n  for (let i = bricks.length - 1; i >= 0; i--) {\n    if (rectsCollide(ballRect(), bricks[i])) {\n      bricks.splice(i, 1);\n      ball.vy = -ball.vy;\n      score += 10;\n      break;\n    }\n  }\n\n  if (ball.y - ball.r > canvas.height) {\n    lives--;\n    resetBall();\n  }\n  // 2. Победа или поражение?\n\n}\n\nfunction showMessage(text) {\n  ctx.fillStyle = \"rgba(0, 0, 0, 0.6)\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"white\";\n  ctx.textAlign = \"center\";\n  ctx.font = \"bold 34px Arial\";\n  ctx.fillText(text, canvas.width / 2, canvas.height / 2);\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Пробел — сыграть ещё\", canvas.width / 2, canvas.height / 2 + 34);\n  ctx.textAlign = \"left\";\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#0d1326\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  for (const b of bricks) {\n    ctx.fillStyle = b.color;\n    ctx.fillRect(b.x, b.y, b.w, b.h);\n  }\n  ctx.fillStyle = \"#7c6cff\";\n  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);\n  ctx.fillStyle = \"white\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"❤️\".repeat(Math.max(0, lives)) + \"   Очки: \" + score, 10, 26);\n  // 5. Надписи победы и поражения\n\n}\n\nmakeBricks();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "const paddle = { x: 200, y: 296, w: 80, h: 12, speed: 7 };\nconst ball = { x: 240, y: 200, r: 7, vx: 3, vy: -3 };\nlet lives = 3;\nlet score = 0;\nlet bricks = [];\nlet state = \"play\";   // \"play\", \"win\" или \"lose\"\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => {\n  keys[e.key] = true;\n  // 4. Пробел — новая игра\n  if (e.key === \" \" && state !== \"play\") restart();\n});\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\nfunction ballRect() {\n  return { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };\n}\nfunction resetBall() {\n  ball.x = canvas.width / 2;\n  ball.y = 200;\n  ball.vx = Math.random() < 0.5 ? -3 : 3;\n  ball.vy = -3;\n}\nfunction makeBricks() {\n  bricks = [];\n  for (let row = 0; row < 5; row++) {\n    for (let col = 0; col < 8; col++) {\n      bricks.push({ x: 10 + col * 58, y: 40 + row * 22, w: 54, h: 18, color: `hsl(${row * 45}, 80%, 60%)` });\n    }\n  }\n}\n\n// 3. Новая игра\nfunction restart() {\n  lives = 3;\n  score = 0;\n  makeBricks();\n  resetBall();\n  state = \"play\";\n}\n\nfunction update() {\n  // 1. Игра не идёт — ничего не делаем\n  if (state !== \"play\") return;\n\n  if (keys[\"ArrowLeft\"]) paddle.x -= paddle.speed;\n  if (keys[\"ArrowRight\"]) paddle.x += paddle.speed;\n  if (paddle.x < 0) paddle.x = 0;\n  if (paddle.x + paddle.w > canvas.width) paddle.x = canvas.width - paddle.w;\n\n  ball.x += ball.vx;\n  ball.y += ball.vy;\n  if (ball.x - ball.r < 0) ball.vx = Math.abs(ball.vx);\n  if (ball.x + ball.r > canvas.width) ball.vx = -Math.abs(ball.vx);\n  if (ball.y - ball.r < 0) ball.vy = Math.abs(ball.vy);\n\n  if (ball.vy > 0 && rectsCollide(ballRect(), paddle)) {\n    const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);\n    ball.vx = hit * 5;\n    ball.vy = -Math.abs(ball.vy);\n  }\n\n  for (let i = bricks.length - 1; i >= 0; i--) {\n    if (rectsCollide(ballRect(), bricks[i])) {\n      bricks.splice(i, 1);\n      ball.vy = -ball.vy;\n      score += 10;\n      break;\n    }\n  }\n\n  if (ball.y - ball.r > canvas.height) {\n    lives--;\n    resetBall();\n  }\n  // 2. Победа или поражение?\n  if (bricks.length === 0) state = \"win\";\n  if (lives <= 0) state = \"lose\";\n}\n\nfunction showMessage(text) {\n  ctx.fillStyle = \"rgba(0, 0, 0, 0.6)\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"white\";\n  ctx.textAlign = \"center\";\n  ctx.font = \"bold 34px Arial\";\n  ctx.fillText(text, canvas.width / 2, canvas.height / 2);\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Пробел — сыграть ещё\", canvas.width / 2, canvas.height / 2 + 34);\n  ctx.textAlign = \"left\";\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#0d1326\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  for (const b of bricks) {\n    ctx.fillStyle = b.color;\n    ctx.fillRect(b.x, b.y, b.w, b.h);\n  }\n  ctx.fillStyle = \"#7c6cff\";\n  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);\n  ctx.fillStyle = \"white\";\n  ctx.beginPath();\n  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);\n  ctx.fill();\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"❤️\".repeat(Math.max(0, lives)) + \"   Очки: \" + score, 10, 26);\n  // 5. Надписи победы и поражения\n  if (state === \"win\") showMessage(\"ПОБЕДА! 🏆\");\n  if (state === \"lose\") showMessage(\"Игра окончена\");\n}\n\nmakeBricks();\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Что такое «состояние игры» (state)?",
     "a": [
      "Переменная, которая говорит, что сейчас происходит: игра, победа, пауза…",
      "Количество жизней",
      "Скорость мяча"
     ],
     "c": 0,
     "e": "В зависимости от состояния игра по-разному обновляется и рисуется."
    }
   ]
  }
 ],
 "id": "breakout",
 "icon": "🧱",
 "color": "#ff5c7a",
 "title": "Проект: Арканоид",
 "desc": "Ракетка, мяч и стена кирпичей: отскоки под углом, жизни и победа",
 "project": true
});
