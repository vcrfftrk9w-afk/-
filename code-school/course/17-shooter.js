/* Собрано из content/17-shooter.txt командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */
window.COURSE = window.COURSE || [];
window.COURSE.push({
 "lessons": [
  {
   "id": "sht-1",
   "title": "Шаг 1. Корабль и лазер",
   "xp": 20,
   "theory": "Финальный проект — **космический шутер**. Корабль внизу, сверху летят астероиды, мы стреляем лазером. Здесь мы используем **классы** — так устроены настоящие игры: у каждого вида объектов свой класс со своими `update()` и `draw()`.\n\n## План\n\n1. **Корабль и лазер** ← ты здесь\n2. Астероиды\n3. Попадания и взрывы\n4. Жизни, сложность и конец игры\n\n## Перезарядка\n\nЕсли стрелять каждый кадр, пока зажат пробел, получится 60 выстрелов в секунду — сплошной луч. Нужна **перезарядка** (cooldown [ку́лдаун] — «остывание»):\n\n```code\nship.cooldown--;                              // каждый кадр «остываем»\nif (keys[\" \"] && ship.cooldown <= 0) {\n  bullets.push(new Bullet(ship.x + ship.w / 2 - 2, ship.y));\n  ship.cooldown = 12;                         // следующий выстрел через 12 кадров\n}\n```\n\n12 кадров ≈ 0.2 секунды — 5 выстрелов в секунду.\n\n## Пуля вылетает из носа корабля\n\n`ship.x + ship.w / 2` — середина корабля. Минус половина ширины пули (2), чтобы пуля была ровно по центру. А `ship.y` — верх корабля.\n\n> 💡 Класс `Bullet` ты уже писал в модуле «Классы». Здесь он почти такой же — только с размерами `w` и `h`, чтобы потом проверять попадания.",
   "task": {
    "tests": [
     [
      "Bullet: координаты, размер 4×12, скорость 7",
      "(function () { var b = new Bullet(10, 100); return b.x === 10 && b.y === 100 && b.w === 4 && b.h === 12 && b.speed === 7; })()"
     ],
     [
      "Пуля летит вверх и понимает, когда улетела",
      "(function () { var b = new Bullet(10, 0); b.update(); var a = b.y === -7 && b.isOff() === false; b.update(); b.update(); return a && b.isOff() === true; })()"
     ],
     [
      "Пробел выпускает пулю из носа корабля",
      "(function () { bullets.length = 0; ship.x = 100; ship.cooldown = 0; __press(\" \"); update(); __release(\" \"); var b = bullets[0]; return bullets.length === 1 && b instanceof Bullet && Math.abs(b.x + b.w / 2 - (ship.x + ship.w / 2)) <= 2 && b.y <= ship.y; })()"
     ],
     [
      "Перезарядка: зажатый пробел не стреляет каждый кадр",
      "(function () { bullets.length = 0; ship.cooldown = 0; __press(\" \"); for (var i = 0; i < 24; i++) update(); __release(\" \"); return bullets.length >= 2 && bullets.length <= 3; })()"
     ],
     [
      "Улетевшие пули удаляются",
      "(function () { bullets.length = 0; bullets.push(new Bullet(10, -11), new Bullet(20, 150)); ship.cooldown = 5; update(); return bullets.length === 1 && bullets[0].x === 20; })()"
     ]
    ],
    "hints": [
     "Конструктор: `constructor(x, y) { this.x = x; this.y = y; this.w = 4; this.h = 12; this.speed = 7; }`, а ещё `update() { this.y -= this.speed; }` и `isOff() { return this.y + this.h < 0; }`",
     "Стрельба: `ship.cooldown--; if (keys[\" \"] && ship.cooldown <= 0) { bullets.push(new Bullet(ship.x + ship.w / 2 - 2, ship.y)); ship.cooldown = 12; }`",
     "Пули: `for (const b of bullets) b.update(); bullets = bullets.filter((b) => !b.isOff());`"
    ],
    "text": "1. Допиши класс `Bullet`: в `constructor(x, y)` сохрани `x`, `y`, задай `w = 4`, `h = 12`, `speed = 7`. Метод `update()` двигает пулю вверх на `speed`. Метод `isOff()` возвращает `true`, когда пуля целиком улетела выше экрана (`y + h < 0`).\n2. В `update()`: уменьшай `ship.cooldown`; если зажат пробел и `cooldown <= 0` — создай пулю из носа корабля и поставь `cooldown = 12`.\n3. Обнови все пули и удали улетевшие (`filter` с `isOff`).",
    "canvas": true,
    "starter": "class Ship {\n  constructor() {\n    this.x = 220;\n    this.y = 270;\n    this.w = 40;\n    this.h = 30;\n    this.speed = 5;\n    this.cooldown = 0;\n  }\n  update(keys) {\n    if (keys[\"ArrowLeft\"]) this.x -= this.speed;\n    if (keys[\"ArrowRight\"]) this.x += this.speed;\n    this.x = Math.max(0, Math.min(canvas.width - this.w, this.x));\n  }\n  draw() {\n    ctx.fillStyle = \"#7cf\";\n    ctx.beginPath();\n    ctx.moveTo(this.x + this.w / 2, this.y);\n    ctx.lineTo(this.x + this.w, this.y + this.h);\n    ctx.lineTo(this.x, this.y + this.h);\n    ctx.closePath();\n    ctx.fill();\n  }\n}\n\n// 1. Класс пули\nclass Bullet {\n\n  draw() {\n    ctx.fillStyle = \"#ff4d6d\";\n    ctx.fillRect(this.x, this.y, this.w, this.h);\n  }\n}\n\nconst ship = new Ship();\nlet bullets = [];\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  ship.update(keys);\n  // 2. Стрельба с перезарядкой\n\n\n  // 3. Пули летят и исчезают\n\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#05071a\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  for (const b of bullets) b.draw();\n  ship.draw();\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "class Ship {\n  constructor() {\n    this.x = 220;\n    this.y = 270;\n    this.w = 40;\n    this.h = 30;\n    this.speed = 5;\n    this.cooldown = 0;\n  }\n  update(keys) {\n    if (keys[\"ArrowLeft\"]) this.x -= this.speed;\n    if (keys[\"ArrowRight\"]) this.x += this.speed;\n    this.x = Math.max(0, Math.min(canvas.width - this.w, this.x));\n  }\n  draw() {\n    ctx.fillStyle = \"#7cf\";\n    ctx.beginPath();\n    ctx.moveTo(this.x + this.w / 2, this.y);\n    ctx.lineTo(this.x + this.w, this.y + this.h);\n    ctx.lineTo(this.x, this.y + this.h);\n    ctx.closePath();\n    ctx.fill();\n  }\n}\n\n// 1. Класс пули\nclass Bullet {\n  constructor(x, y) {\n    this.x = x;\n    this.y = y;\n    this.w = 4;\n    this.h = 12;\n    this.speed = 7;\n  }\n  update() {\n    this.y -= this.speed;\n  }\n  isOff() {\n    return this.y + this.h < 0;\n  }\n  draw() {\n    ctx.fillStyle = \"#ff4d6d\";\n    ctx.fillRect(this.x, this.y, this.w, this.h);\n  }\n}\n\nconst ship = new Ship();\nlet bullets = [];\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  ship.update(keys);\n  // 2. Стрельба с перезарядкой\n  ship.cooldown--;\n  if (keys[\" \"] && ship.cooldown <= 0) {\n    bullets.push(new Bullet(ship.x + ship.w / 2 - 2, ship.y));\n    ship.cooldown = 12;\n  }\n\n  // 3. Пули летят и исчезают\n  for (const b of bullets) b.update();\n  bullets = bullets.filter((b) => !b.isOff());\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#05071a\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  for (const b of bullets) b.draw();\n  ship.draw();\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Зачем нужна перезарядка (cooldown)?",
     "a": [
      "Чтобы корабль не стрелял 60 раз в секунду, пока зажат пробел",
      "Чтобы пули летели быстрее",
      "Чтобы корабль не выходил за экран"
     ],
     "c": 0,
     "e": "Перезарядка задаёт паузу между выстрелами."
    }
   ]
  },
  {
   "id": "sht-2",
   "title": "Шаг 2. Астероиды",
   "xp": 20,
   "theory": "Теперь — угроза из космоса. Астероиды появляются сверху в случайном месте и летят вниз.\n\n## Класс Rock\n\n```code\nclass Rock {\n  constructor(x, speed) {\n    this.size = 24 + Math.random() * 20;   // случайный размер\n    this.x = x;\n    this.y = -this.size;                   // начинается чуть выше экрана\n    this.w = this.size;\n    this.h = this.size;\n    this.speed = speed;\n  }\n  update() { this.y += this.speed; }\n  isOff() { return this.y > canvas.height; }\n}\n```\n\n`rock` [рок] — «камень». Астероид начинается **выше** экрана (`y = -size`), поэтому плавно «въезжает» сверху, а не появляется из ниоткуда.\n\n## Появление через промежутки\n\nКак с трубами во Flappy Bird — считаем кадры:\n\n```code\nframe++;\nif (frame % 40 === 0) {\n  const x = Math.random() * (canvas.width - 40);\n  rocks.push(new Rock(x, 2));\n}\n```\n\n`canvas.width - 40` — чтобы большой астероид не вылез за правый край.\n\n> 🎮 Разные размеры и скорости делают картинку живой. Можно даже вращать астероиды — добавь `this.angle` и используй `ctx.rotate`.",
   "task": {
    "tests": [
     [
      "Rock: размер от 24 до 44, начинает выше экрана",
      "(function () { for (var i = 0; i < 200; i++) { var r = new Rock(50, 3); if (r.size < 24 || r.size > 44 || r.w !== r.size || r.h !== r.size || r.y !== -r.size || r.x !== 50 || r.speed !== 3) return false; } return true; })()"
     ],
     [
      "Размеры астероидов разные",
      "(function () { var s = {}; for (var i = 0; i < 50; i++) s[Math.round(new Rock(0, 1).size)] = 1; return Object.keys(s).length > 5; })()"
     ],
     [
      "Астероид летит вниз и знает, когда улетел",
      "(function () { var r = new Rock(0, 5); r.y = canvas.height - 3; var a = r.isOff() === false; r.update(); return a && r.y === canvas.height + 2 && r.isOff() === true; })()"
     ],
     [
      "Каждые 40 кадров появляется астероид в случайном месте",
      "(function () { rocks.length = 0; frame = 0; for (var i = 0; i < 120; i++) update(); var xs = rocks.map(function (r) { return r.x; }); return rocks.length === 3 && rocks.every(function (r) { return r instanceof Rock && r.x >= 0 && r.x + 40 <= canvas.width; }); })()"
     ],
     [
      "Улетевшие астероиды удаляются",
      "(function () { rocks.length = 0; var a = new Rock(10, 2), b = new Rock(10, 2); a.y = canvas.height + 1; b.y = 100; rocks.push(a, b); frame = 1; update(); return rocks.length === 1 && rocks[0] === b; })()"
     ]
    ],
    "hints": [
     "Конструктор: `this.size = 24 + Math.random() * 20; this.x = x; this.y = -this.size; this.w = this.size; this.h = this.size; this.speed = speed;`",
     "`update() { this.y += this.speed; }` и `isOff() { return this.y > canvas.height; }`",
     "В update игры: `frame++; if (frame % 40 === 0) { rocks.push(new Rock(Math.random() * (canvas.width - 40), 2)); } for (const r of rocks) r.update(); rocks = rocks.filter((r) => !r.isOff());`"
    ],
    "text": "1. Допиши класс `Rock`: `constructor(x, speed)` — `size` случайный от 24 до 44, `x`, `y = -size`, `w` и `h` равны `size`, `speed`. Методы `update()` (вниз на `speed`) и `isOff()` (`y > canvas.height`).\n2. В `update()`: каждые 40 кадров добавляй `new Rock(случайный x, 2)`; обновляй все камни и удаляй улетевшие.",
    "canvas": true,
    "starter": "class Ship {\n  constructor() { this.x = 220; this.y = 270; this.w = 40; this.h = 30; this.speed = 5; this.cooldown = 0; }\n  update(keys) {\n    if (keys[\"ArrowLeft\"]) this.x -= this.speed;\n    if (keys[\"ArrowRight\"]) this.x += this.speed;\n    this.x = Math.max(0, Math.min(canvas.width - this.w, this.x));\n  }\n  draw() {\n    ctx.fillStyle = \"#7cf\";\n    ctx.beginPath();\n    ctx.moveTo(this.x + this.w / 2, this.y);\n    ctx.lineTo(this.x + this.w, this.y + this.h);\n    ctx.lineTo(this.x, this.y + this.h);\n    ctx.closePath();\n    ctx.fill();\n  }\n}\n\nclass Bullet {\n  constructor(x, y) { this.x = x; this.y = y; this.w = 4; this.h = 12; this.speed = 7; }\n  update() { this.y -= this.speed; }\n  isOff() { return this.y + this.h < 0; }\n  draw() { ctx.fillStyle = \"#ff4d6d\"; ctx.fillRect(this.x, this.y, this.w, this.h); }\n}\n\n// 1. Класс астероида\nclass Rock {\n\n  draw() {\n    ctx.fillStyle = \"#8d8d9e\";\n    ctx.beginPath();\n    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);\n    ctx.fill();\n  }\n}\n\nconst ship = new Ship();\nlet bullets = [];\nlet rocks = [];\nlet frame = 0;\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  ship.update(keys);\n  ship.cooldown--;\n  if (keys[\" \"] && ship.cooldown <= 0) {\n    bullets.push(new Bullet(ship.x + ship.w / 2 - 2, ship.y));\n    ship.cooldown = 12;\n  }\n  for (const b of bullets) b.update();\n  bullets = bullets.filter((b) => !b.isOff());\n\n  // 2. Астероиды: появление, движение, уборка\n\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#05071a\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  for (const r of rocks) r.draw();\n  for (const b of bullets) b.draw();\n  ship.draw();\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "class Ship {\n  constructor() { this.x = 220; this.y = 270; this.w = 40; this.h = 30; this.speed = 5; this.cooldown = 0; }\n  update(keys) {\n    if (keys[\"ArrowLeft\"]) this.x -= this.speed;\n    if (keys[\"ArrowRight\"]) this.x += this.speed;\n    this.x = Math.max(0, Math.min(canvas.width - this.w, this.x));\n  }\n  draw() {\n    ctx.fillStyle = \"#7cf\";\n    ctx.beginPath();\n    ctx.moveTo(this.x + this.w / 2, this.y);\n    ctx.lineTo(this.x + this.w, this.y + this.h);\n    ctx.lineTo(this.x, this.y + this.h);\n    ctx.closePath();\n    ctx.fill();\n  }\n}\n\nclass Bullet {\n  constructor(x, y) { this.x = x; this.y = y; this.w = 4; this.h = 12; this.speed = 7; }\n  update() { this.y -= this.speed; }\n  isOff() { return this.y + this.h < 0; }\n  draw() { ctx.fillStyle = \"#ff4d6d\"; ctx.fillRect(this.x, this.y, this.w, this.h); }\n}\n\n// 1. Класс астероида\nclass Rock {\n  constructor(x, speed) {\n    this.size = 24 + Math.random() * 20;\n    this.x = x;\n    this.y = -this.size;\n    this.w = this.size;\n    this.h = this.size;\n    this.speed = speed;\n  }\n  update() {\n    this.y += this.speed;\n  }\n  isOff() {\n    return this.y > canvas.height;\n  }\n  draw() {\n    ctx.fillStyle = \"#8d8d9e\";\n    ctx.beginPath();\n    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);\n    ctx.fill();\n  }\n}\n\nconst ship = new Ship();\nlet bullets = [];\nlet rocks = [];\nlet frame = 0;\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction update() {\n  ship.update(keys);\n  ship.cooldown--;\n  if (keys[\" \"] && ship.cooldown <= 0) {\n    bullets.push(new Bullet(ship.x + ship.w / 2 - 2, ship.y));\n    ship.cooldown = 12;\n  }\n  for (const b of bullets) b.update();\n  bullets = bullets.filter((b) => !b.isOff());\n\n  // 2. Астероиды: появление, движение, уборка\n  frame++;\n  if (frame % 40 === 0) {\n    const x = Math.random() * (canvas.width - 40);\n    rocks.push(new Rock(x, 2));\n  }\n  for (const r of rocks) r.update();\n  rocks = rocks.filter((r) => !r.isOff());\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#05071a\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  for (const r of rocks) r.draw();\n  for (const b of bullets) b.draw();\n  ship.draw();\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Почему астероид создаётся с y = -size?",
     "a": [
      "Чтобы он плавно въезжал сверху, а не появлялся из воздуха",
      "Чтобы его нельзя было подстрелить",
      "Это ошибка"
     ],
     "c": 0,
     "e": "При отрицательном y объект целиком над экраном и появляется постепенно."
    }
   ]
  },
  {
   "id": "sht-3",
   "title": "Шаг 3. Попадания и взрывы",
   "xp": 20,
   "theory": "Пора сбивать астероиды! Каждый кадр проверяем **каждую пулю** с **каждым астероидом** — двойной цикл. Попали — удаляем обоих, добавляем очки и запускаем **взрыв из частиц** (помнишь урок про частицы?).\n\n## Двойной цикл с удалением\n\n```code\nfor (let i = rocks.length - 1; i >= 0; i--) {\n  for (let j = bullets.length - 1; j >= 0; j--) {\n    if (rectsCollide(rocks[i], bullets[j])) {\n      explode(rocks[i].x + rocks[i].w / 2, rocks[i].y + rocks[i].h / 2);\n      rocks.splice(i, 1);\n      bullets.splice(j, 1);\n      score += 10;\n      break;   // этого камня больше нет — к следующему\n    }\n  }\n}\n```\n\nОба цикла идут **с конца** — мы удаляем элементы прямо во время перебора. `break` обязателен: после удаления камня `rocks[i]` уже другой элемент (или вообще ничего), и проверять его дальше нельзя.\n\n## Взрыв\n\nФункция `explode(x, y)` уже написана — она выбрасывает 25 частиц из центра астероида. Посмотри её код: это почти то же самое, что ты делал в уроке про частицы.\n\n> 🎮 Взрывы — дешёвый способ сделать игру «вкусной». Профессионалы называют это **juice** [джус] — «сок»: тряска экрана, вспышки, частицы, звуки. Механика та же, а играть в разы приятнее.",
   "task": {
    "tests": [
     [
      "Попадание: астероид и пуля исчезли, +10 очков",
      "(function () { rocks.length = 0; bullets.length = 0; particles.length = 0; var r = new Rock(100, 0); r.y = 100; rocks.push(r); bullets.push(new Bullet(110, 115 + 7)); frame = 1; var s = score; update(); return rocks.length === 0 && bullets.length === 0 && score === s + 10; })()"
     ],
     [
      "При попадании появляется взрыв в центре астероида",
      "(function () { rocks.length = 0; bullets.length = 0; particles.length = 0; var r = new Rock(100, 0); r.y = 100; r.size = 30; r.w = 30; r.h = 30; rocks.push(r); bullets.push(new Bullet(112, 112)); frame = 1; update(); return particles.length > 0 && particles.every(function (p) { return Math.abs(p.x - p.vx - 115) < 0.01 && Math.abs(p.y - p.vy - 115) < 0.01; }); })()"
     ],
     [
      "Промах ничего не удаляет",
      "(function () { rocks.length = 0; bullets.length = 0; var r = new Rock(100, 0); r.y = 100; rocks.push(r); bullets.push(new Bullet(300, 200)); frame = 1; var s = score; update(); return rocks.length === 1 && bullets.length === 1 && score === s; })()"
     ],
     [
      "Одна пуля сбивает только один астероид",
      "(function () { rocks.length = 0; bullets.length = 0; var a = new Rock(100, 0), b = new Rock(100, 0); a.y = 100; b.y = 100; rocks.push(a, b); bullets.push(new Bullet(110, 120), new Bullet(400, 10)); frame = 1; update(); return rocks.length === 1 && bullets.length === 1; })()"
     ]
    ],
    "hints": [
     "Внешний цикл: `for (let i = rocks.length - 1; i >= 0; i--)`, внутренний: `for (let j = bullets.length - 1; j >= 0; j--)`",
     "Внутри: `if (rectsCollide(rocks[i], bullets[j])) { explode(rocks[i].x + rocks[i].w / 2, rocks[i].y + rocks[i].h / 2); rocks.splice(i, 1); bullets.splice(j, 1); score += 10; break; }`"
    ],
    "text": "Допиши в `update()` попадания: двойной цикл с конца по `rocks` и `bullets`. При столкновении (`rectsCollide`) вызови `explode` в центре астероида, удали астероид и пулю, прибавь `score += 10` и выйди из внутреннего цикла (`break`).",
    "canvas": true,
    "starter": "class Ship {\n  constructor() { this.x = 220; this.y = 270; this.w = 40; this.h = 30; this.speed = 5; this.cooldown = 0; }\n  update(keys) {\n    if (keys[\"ArrowLeft\"]) this.x -= this.speed;\n    if (keys[\"ArrowRight\"]) this.x += this.speed;\n    this.x = Math.max(0, Math.min(canvas.width - this.w, this.x));\n  }\n  draw() {\n    ctx.fillStyle = \"#7cf\";\n    ctx.beginPath();\n    ctx.moveTo(this.x + this.w / 2, this.y);\n    ctx.lineTo(this.x + this.w, this.y + this.h);\n    ctx.lineTo(this.x, this.y + this.h);\n    ctx.closePath();\n    ctx.fill();\n  }\n}\nclass Bullet {\n  constructor(x, y) { this.x = x; this.y = y; this.w = 4; this.h = 12; this.speed = 7; }\n  update() { this.y -= this.speed; }\n  isOff() { return this.y + this.h < 0; }\n  draw() { ctx.fillStyle = \"#ff4d6d\"; ctx.fillRect(this.x, this.y, this.w, this.h); }\n}\nclass Rock {\n  constructor(x, speed) { this.size = 24 + Math.random() * 20; this.x = x; this.y = -this.size; this.w = this.size; this.h = this.size; this.speed = speed; }\n  update() { this.y += this.speed; }\n  isOff() { return this.y > canvas.height; }\n  draw() {\n    ctx.fillStyle = \"#8d8d9e\";\n    ctx.beginPath();\n    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);\n    ctx.fill();\n  }\n}\n\nconst ship = new Ship();\nlet bullets = [], rocks = [], particles = [];\nlet frame = 0;\nlet score = 0;\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction explode(x, y) {\n  for (let i = 0; i < 25; i++) {\n    const angle = Math.random() * Math.PI * 2;\n    const speed = 1 + Math.random() * 3;\n    particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 30 });\n  }\n}\n\nfunction update() {\n  ship.update(keys);\n  ship.cooldown--;\n  if (keys[\" \"] && ship.cooldown <= 0) {\n    bullets.push(new Bullet(ship.x + ship.w / 2 - 2, ship.y));\n    ship.cooldown = 12;\n  }\n  for (const b of bullets) b.update();\n  bullets = bullets.filter((b) => !b.isOff());\n\n  frame++;\n  if (frame % 40 === 0) rocks.push(new Rock(Math.random() * (canvas.width - 40), 2));\n  for (const r of rocks) r.update();\n  rocks = rocks.filter((r) => !r.isOff());\n\n  // Попадания пуль в астероиды\n\n\n  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.life--; }\n  particles = particles.filter((p) => p.life > 0);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#05071a\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  for (const r of rocks) r.draw();\n  for (const b of bullets) b.draw();\n  for (const p of particles) {\n    ctx.globalAlpha = p.life / 30;\n    ctx.fillStyle = \"orange\";\n    ctx.fillRect(p.x, p.y, 3, 3);\n  }\n  ctx.globalAlpha = 1;\n  ship.draw();\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Очки: \" + score, 10, 24);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "class Ship {\n  constructor() { this.x = 220; this.y = 270; this.w = 40; this.h = 30; this.speed = 5; this.cooldown = 0; }\n  update(keys) {\n    if (keys[\"ArrowLeft\"]) this.x -= this.speed;\n    if (keys[\"ArrowRight\"]) this.x += this.speed;\n    this.x = Math.max(0, Math.min(canvas.width - this.w, this.x));\n  }\n  draw() {\n    ctx.fillStyle = \"#7cf\";\n    ctx.beginPath();\n    ctx.moveTo(this.x + this.w / 2, this.y);\n    ctx.lineTo(this.x + this.w, this.y + this.h);\n    ctx.lineTo(this.x, this.y + this.h);\n    ctx.closePath();\n    ctx.fill();\n  }\n}\nclass Bullet {\n  constructor(x, y) { this.x = x; this.y = y; this.w = 4; this.h = 12; this.speed = 7; }\n  update() { this.y -= this.speed; }\n  isOff() { return this.y + this.h < 0; }\n  draw() { ctx.fillStyle = \"#ff4d6d\"; ctx.fillRect(this.x, this.y, this.w, this.h); }\n}\nclass Rock {\n  constructor(x, speed) { this.size = 24 + Math.random() * 20; this.x = x; this.y = -this.size; this.w = this.size; this.h = this.size; this.speed = speed; }\n  update() { this.y += this.speed; }\n  isOff() { return this.y > canvas.height; }\n  draw() {\n    ctx.fillStyle = \"#8d8d9e\";\n    ctx.beginPath();\n    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);\n    ctx.fill();\n  }\n}\n\nconst ship = new Ship();\nlet bullets = [], rocks = [], particles = [];\nlet frame = 0;\nlet score = 0;\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => { keys[e.key] = true; });\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction explode(x, y) {\n  for (let i = 0; i < 25; i++) {\n    const angle = Math.random() * Math.PI * 2;\n    const speed = 1 + Math.random() * 3;\n    particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 30 });\n  }\n}\n\nfunction update() {\n  ship.update(keys);\n  ship.cooldown--;\n  if (keys[\" \"] && ship.cooldown <= 0) {\n    bullets.push(new Bullet(ship.x + ship.w / 2 - 2, ship.y));\n    ship.cooldown = 12;\n  }\n  for (const b of bullets) b.update();\n  bullets = bullets.filter((b) => !b.isOff());\n\n  frame++;\n  if (frame % 40 === 0) rocks.push(new Rock(Math.random() * (canvas.width - 40), 2));\n  for (const r of rocks) r.update();\n  rocks = rocks.filter((r) => !r.isOff());\n\n  // Попадания пуль в астероиды\n  for (let i = rocks.length - 1; i >= 0; i--) {\n    for (let j = bullets.length - 1; j >= 0; j--) {\n      if (rectsCollide(rocks[i], bullets[j])) {\n        explode(rocks[i].x + rocks[i].w / 2, rocks[i].y + rocks[i].h / 2);\n        rocks.splice(i, 1);\n        bullets.splice(j, 1);\n        score += 10;\n        break;\n      }\n    }\n  }\n\n  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.life--; }\n  particles = particles.filter((p) => p.life > 0);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#05071a\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  for (const r of rocks) r.draw();\n  for (const b of bullets) b.draw();\n  for (const p of particles) {\n    ctx.globalAlpha = p.life / 30;\n    ctx.fillStyle = \"orange\";\n    ctx.fillRect(p.x, p.y, 3, 3);\n  }\n  ctx.globalAlpha = 1;\n  ship.draw();\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Очки: \" + score, 10, 24);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Что будет, если забыть break после удаления астероида?",
     "a": [
      "Внутренний цикл продолжит проверять rocks[i], а там уже другой астероид или пусто",
      "Ничего страшного",
      "Пуля полетит быстрее"
     ],
     "c": 0,
     "e": "После splice под номером i находится другой объект — проверять его этой же пулей нельзя."
    }
   ]
  },
  {
   "id": "sht-4",
   "title": "Шаг 4. Жизни, сложность и конец игры",
   "xp": 30,
   "theory": "Последний шаг последнего проекта! Добавим то, что делает игру **игрой**:\n\n1. **Жизни.** Астероид врезался в корабль — минус жизнь (и взрыв!).\n2. **Рост сложности.** Чем больше очков, тем быстрее астероиды.\n3. **Конец игры** и новая игра.\n\n## Сложность растёт\n\n```code\nfunction rockSpeed() {\n  return 2 + Math.floor(score / 100) * 0.5;\n}\n```\n\nКаждые 100 очков скорость астероидов растёт на 0.5. `Math.floor(score / 100)` — сколько «сотен» набрано: 0 при 0–99 очках, 1 при 100–199 и так далее.\n\n> 🎮 Плавный рост сложности — главный секрет «ещё одной попытки». Игроку должно быть немного трудно, но не невозможно. Это называется **кривая сложности**.\n\n## Корабль и астероиды\n\n```code\nfor (let i = rocks.length - 1; i >= 0; i--) {\n  if (rectsCollide(rocks[i], ship)) {\n    explode(...);\n    rocks.splice(i, 1);\n    lives--;\n    if (lives <= 0) state = \"over\";\n  }\n}\n```\n\n🏆 После этого шага у тебя будет пять собственных игр. Ты прошёл путь от `console.log(\"Привет\")` до полноценного космического шутера на классах. Это огромный результат!",
   "task": {
    "tests": [
     [
      "rockSpeed растёт каждые 100 очков",
      "(function () { var s0 = score; score = 0; var a = rockSpeed(); score = 99; var b = rockSpeed(); score = 100; var c = rockSpeed(); score = 350; var d = rockSpeed(); score = s0; return a === 2 && b === 2 && c === 2.5 && d === 3.5; })()"
     ],
     [
      "Новые астероиды летят со скоростью rockSpeed()",
      "(function () { state = \"play\"; rocks.length = 0; score = 200; frame = 39; update(); var ok = rocks.length === 1 && rocks[0].speed === 3; score = 0; rocks.length = 0; return ok; })()"
     ],
     [
      "Астероид врезался в корабль — минус жизнь, астероид исчез",
      "(function () { state = \"play\"; lives = 3; rocks.length = 0; bullets.length = 0; var r = new Rock(ship.x, 0); r.y = ship.y; rocks.push(r); frame = 1; update(); return lives === 2 && rocks.length === 0 && particles.length > 0; })()"
     ],
     [
      "Последняя жизнь — конец игры, всё замирает",
      "(function () { state = \"play\"; lives = 1; rocks.length = 0; var r = new Rock(ship.x, 0); r.y = ship.y; rocks.push(r); frame = 1; update(); var a = state === \"over\"; var f = frame; update(); return a && frame === f; })()"
     ],
     [
      "Пробел после конца игры — новая игра",
      "(function () { state = \"over\"; lives = 0; score = 90; rocks.push(new Rock(10, 1)); __press(\" \"); __release(\" \"); return state === \"play\" && lives === 3 && score === 0 && rocks.length === 0 && bullets.length === 0 && frame === 0; })()"
     ]
    ],
    "hints": [
     "`function rockSpeed() { return 2 + Math.floor(score / 100) * 0.5; }` и при создании астероида: `new Rock(..., rockSpeed())`",
     "Корабль: цикл с конца по rocks, `if (rectsCollide(rocks[i], ship)) { explode(...); rocks.splice(i, 1); lives--; if (lives <= 0) state = \"over\"; }`",
     "restart: `lives = 3; score = 0; bullets = []; rocks = []; particles = []; frame = 0; state = \"play\";`. В обработчике клавиш: `if (e.key === \" \" && state === \"over\") restart();`"
    ],
    "text": "1. Напиши `rockSpeed()` — возвращает `2 + Math.floor(score / 100) * 0.5`. Используй её при создании астероидов вместо числа `2`.\n2. В `update()`: если `state !== \"play\"` — ничего не делай.\n3. Столкновение астероида с кораблём (цикл с конца): взрыв в центре астероида, удалить астероид, `lives--`; если жизни кончились — `state = \"over\"`.\n4. `restart()`: `lives = 3`, `score = 0`, пустые массивы `bullets`, `rocks`, `particles`, `frame = 0`, `state = \"play\"`. Пробел, когда игра окончена, вызывает `restart()`.",
    "canvas": true,
    "starter": "class Ship {\n  constructor() { this.x = 220; this.y = 270; this.w = 40; this.h = 30; this.speed = 5; this.cooldown = 0; }\n  update(keys) {\n    if (keys[\"ArrowLeft\"]) this.x -= this.speed;\n    if (keys[\"ArrowRight\"]) this.x += this.speed;\n    this.x = Math.max(0, Math.min(canvas.width - this.w, this.x));\n  }\n  draw() {\n    ctx.fillStyle = \"#7cf\";\n    ctx.beginPath();\n    ctx.moveTo(this.x + this.w / 2, this.y);\n    ctx.lineTo(this.x + this.w, this.y + this.h);\n    ctx.lineTo(this.x, this.y + this.h);\n    ctx.closePath();\n    ctx.fill();\n  }\n}\nclass Bullet {\n  constructor(x, y) { this.x = x; this.y = y; this.w = 4; this.h = 12; this.speed = 7; }\n  update() { this.y -= this.speed; }\n  isOff() { return this.y + this.h < 0; }\n  draw() { ctx.fillStyle = \"#ff4d6d\"; ctx.fillRect(this.x, this.y, this.w, this.h); }\n}\nclass Rock {\n  constructor(x, speed) { this.size = 24 + Math.random() * 20; this.x = x; this.y = -this.size; this.w = this.size; this.h = this.size; this.speed = speed; }\n  update() { this.y += this.speed; }\n  isOff() { return this.y > canvas.height; }\n  draw() {\n    ctx.fillStyle = \"#8d8d9e\";\n    ctx.beginPath();\n    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);\n    ctx.fill();\n  }\n}\n\nconst ship = new Ship();\nlet bullets = [], rocks = [], particles = [];\nlet frame = 0;\nlet score = 0;\nlet lives = 3;\nlet state = \"play\";\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => {\n  keys[e.key] = true;\n  // 4. Пробел после конца игры\n\n});\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction explode(x, y) {\n  for (let i = 0; i < 25; i++) {\n    const angle = Math.random() * Math.PI * 2;\n    const speed = 1 + Math.random() * 3;\n    particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 30 });\n  }\n}\n\n// 1. Скорость астероидов растёт с очками\nfunction rockSpeed() {\n\n}\n\n// 4. Новая игра\nfunction restart() {\n\n}\n\nfunction update() {\n  // 2. Игра окончена — стоим\n\n  ship.update(keys);\n  ship.cooldown--;\n  if (keys[\" \"] && ship.cooldown <= 0) {\n    bullets.push(new Bullet(ship.x + ship.w / 2 - 2, ship.y));\n    ship.cooldown = 12;\n  }\n  for (const b of bullets) b.update();\n  bullets = bullets.filter((b) => !b.isOff());\n\n  frame++;\n  if (frame % 40 === 0) rocks.push(new Rock(Math.random() * (canvas.width - 40), 2));\n  for (const r of rocks) r.update();\n  rocks = rocks.filter((r) => !r.isOff());\n\n  for (let i = rocks.length - 1; i >= 0; i--) {\n    for (let j = bullets.length - 1; j >= 0; j--) {\n      if (rectsCollide(rocks[i], bullets[j])) {\n        explode(rocks[i].x + rocks[i].w / 2, rocks[i].y + rocks[i].h / 2);\n        rocks.splice(i, 1);\n        bullets.splice(j, 1);\n        score += 10;\n        break;\n      }\n    }\n  }\n\n  // 3. Астероид врезался в корабль\n\n\n  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.life--; }\n  particles = particles.filter((p) => p.life > 0);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#05071a\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  for (const r of rocks) r.draw();\n  for (const b of bullets) b.draw();\n  for (const p of particles) {\n    ctx.globalAlpha = p.life / 30;\n    ctx.fillStyle = \"orange\";\n    ctx.fillRect(p.x, p.y, 3, 3);\n  }\n  ctx.globalAlpha = 1;\n  if (state === \"play\") ship.draw();\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Очки: \" + score + \"   \" + \"❤️\".repeat(Math.max(0, lives)), 10, 24);\n  if (state === \"over\") {\n    ctx.textAlign = \"center\";\n    ctx.font = \"bold 40px Arial\";\n    ctx.fillText(\"ИГРА ОКОНЧЕНА\", canvas.width / 2, 150);\n    ctx.font = \"20px Arial\";\n    ctx.fillText(\"Счёт: \" + score + \" · пробел — заново\", canvas.width / 2, 190);\n    ctx.textAlign = \"left\";\n  }\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n",
    "solution": "class Ship {\n  constructor() { this.x = 220; this.y = 270; this.w = 40; this.h = 30; this.speed = 5; this.cooldown = 0; }\n  update(keys) {\n    if (keys[\"ArrowLeft\"]) this.x -= this.speed;\n    if (keys[\"ArrowRight\"]) this.x += this.speed;\n    this.x = Math.max(0, Math.min(canvas.width - this.w, this.x));\n  }\n  draw() {\n    ctx.fillStyle = \"#7cf\";\n    ctx.beginPath();\n    ctx.moveTo(this.x + this.w / 2, this.y);\n    ctx.lineTo(this.x + this.w, this.y + this.h);\n    ctx.lineTo(this.x, this.y + this.h);\n    ctx.closePath();\n    ctx.fill();\n  }\n}\nclass Bullet {\n  constructor(x, y) { this.x = x; this.y = y; this.w = 4; this.h = 12; this.speed = 7; }\n  update() { this.y -= this.speed; }\n  isOff() { return this.y + this.h < 0; }\n  draw() { ctx.fillStyle = \"#ff4d6d\"; ctx.fillRect(this.x, this.y, this.w, this.h); }\n}\nclass Rock {\n  constructor(x, speed) { this.size = 24 + Math.random() * 20; this.x = x; this.y = -this.size; this.w = this.size; this.h = this.size; this.speed = speed; }\n  update() { this.y += this.speed; }\n  isOff() { return this.y > canvas.height; }\n  draw() {\n    ctx.fillStyle = \"#8d8d9e\";\n    ctx.beginPath();\n    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);\n    ctx.fill();\n  }\n}\n\nconst ship = new Ship();\nlet bullets = [], rocks = [], particles = [];\nlet frame = 0;\nlet score = 0;\nlet lives = 3;\nlet state = \"play\";\nconst keys = {};\ndocument.addEventListener(\"keydown\", (e) => {\n  keys[e.key] = true;\n  // 4. Пробел после конца игры\n  if (e.key === \" \" && state === \"over\") restart();\n});\ndocument.addEventListener(\"keyup\", (e) => { keys[e.key] = false; });\n\nfunction rectsCollide(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n}\n\nfunction explode(x, y) {\n  for (let i = 0; i < 25; i++) {\n    const angle = Math.random() * Math.PI * 2;\n    const speed = 1 + Math.random() * 3;\n    particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 30 });\n  }\n}\n\n// 1. Скорость астероидов растёт с очками\nfunction rockSpeed() {\n  return 2 + Math.floor(score / 100) * 0.5;\n}\n\n// 4. Новая игра\nfunction restart() {\n  lives = 3;\n  score = 0;\n  bullets = [];\n  rocks = [];\n  particles = [];\n  frame = 0;\n  state = \"play\";\n}\n\nfunction update() {\n  // 2. Игра окончена — стоим\n  if (state !== \"play\") return;\n\n  ship.update(keys);\n  ship.cooldown--;\n  if (keys[\" \"] && ship.cooldown <= 0) {\n    bullets.push(new Bullet(ship.x + ship.w / 2 - 2, ship.y));\n    ship.cooldown = 12;\n  }\n  for (const b of bullets) b.update();\n  bullets = bullets.filter((b) => !b.isOff());\n\n  frame++;\n  if (frame % 40 === 0) rocks.push(new Rock(Math.random() * (canvas.width - 40), rockSpeed()));\n  for (const r of rocks) r.update();\n  rocks = rocks.filter((r) => !r.isOff());\n\n  for (let i = rocks.length - 1; i >= 0; i--) {\n    for (let j = bullets.length - 1; j >= 0; j--) {\n      if (rectsCollide(rocks[i], bullets[j])) {\n        explode(rocks[i].x + rocks[i].w / 2, rocks[i].y + rocks[i].h / 2);\n        rocks.splice(i, 1);\n        bullets.splice(j, 1);\n        score += 10;\n        break;\n      }\n    }\n  }\n\n  // 3. Астероид врезался в корабль\n  for (let i = rocks.length - 1; i >= 0; i--) {\n    if (rectsCollide(rocks[i], ship)) {\n      explode(rocks[i].x + rocks[i].w / 2, rocks[i].y + rocks[i].h / 2);\n      rocks.splice(i, 1);\n      lives--;\n      if (lives <= 0) state = \"over\";\n    }\n  }\n\n  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.life--; }\n  particles = particles.filter((p) => p.life > 0);\n}\n\nfunction draw() {\n  ctx.fillStyle = \"#05071a\";\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  for (const r of rocks) r.draw();\n  for (const b of bullets) b.draw();\n  for (const p of particles) {\n    ctx.globalAlpha = p.life / 30;\n    ctx.fillStyle = \"orange\";\n    ctx.fillRect(p.x, p.y, 3, 3);\n  }\n  ctx.globalAlpha = 1;\n  if (state === \"play\") ship.draw();\n  ctx.fillStyle = \"white\";\n  ctx.font = \"18px Arial\";\n  ctx.fillText(\"Очки: \" + score + \"   \" + \"❤️\".repeat(Math.max(0, lives)), 10, 24);\n  if (state === \"over\") {\n    ctx.textAlign = \"center\";\n    ctx.font = \"bold 40px Arial\";\n    ctx.fillText(\"ИГРА ОКОНЧЕНА\", canvas.width / 2, 150);\n    ctx.font = \"20px Arial\";\n    ctx.fillText(\"Счёт: \" + score + \" · пробел — заново\", canvas.width / 2, 190);\n    ctx.textAlign = \"left\";\n  }\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();\n"
   },
   "quiz": [
    {
     "q": "Что вернёт `Math.floor(250 / 100)`?",
     "a": [
      "2",
      "2.5",
      "3"
     ],
     "c": 0,
     "e": "250 / 100 = 2.5, округление вниз — 2."
    }
   ]
  }
 ],
 "id": "shooter",
 "icon": "🚀",
 "color": "#20c1d8",
 "title": "Проект: Космический шутер",
 "desc": "Корабль, лазеры, астероиды, взрывы, рост сложности — всё на классах",
 "project": true
});
