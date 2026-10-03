/* Собрано из content/12-classes.txt командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */
window.COURSE = window.COURSE || [];
window.COURSE.push({
 "lessons": [
  {
   "id": "cls-1",
   "title": "Класс — чертёж для объектов",
   "theory": "В игре сто врагов. У каждого — `x`, `y`, здоровье, скорость, методы `update` и `draw`. Писать сто одинаковых объектов вручную? Конечно нет. Нужен **чертёж**, по которому объекты создаются сами. Такой чертёж называется **класс**.\n\n```js\nclass Enemy {\n  constructor(x, y) {\n    this.x = x;\n    this.y = y;\n    this.hp = 30;\n    this.speed = 2;\n  }\n}\n\nconst goblin = new Enemy(100, 50);\nconst orc = new Enemy(300, 80);\n\nconsole.log(goblin);\nconsole.log(orc.x, orc.hp);\n```\n\n## Разбор\n\n- `class Enemy { ... }` — объявляем класс (`class` [класс]). Имя класса принято писать **с большой буквы**.\n- `constructor(x, y)` [констра́ктор] — особый метод, который **настраивает** новый объект. Вызывается автоматически при создании.\n- `this.x = x` — «у этого нового объекта свойство x равно переданному x».\n- `new Enemy(100, 50)` [нью] — «создай **новый** объект по чертежу Enemy». Аргументы попадают в constructor.\n\n> 🧠 Сравни: класс — это **форма для печенья**, а объекты — сами **печенья**. Форма одна, печений сколько угодно. Каждое печенье — отдельное: если откусить одно, другие останутся целыми.\n\n## Каждый объект — отдельный\n\n```js\nclass Coin {\n  constructor(x, y) {\n    this.x = x;\n    this.y = y;\n    this.value = 10;\n  }\n}\n\nconst coins = [];\nfor (let i = 0; i < 5; i++) {\n  coins.push(new Coin(i * 50, 100));\n}\ncoins[2].value = 100;\nconsole.log(coins.map((c) => c.value));\n```\n\nПоменяли ценность одной монеты — остальные не изменились.",
   "task": {
    "tests": [
     [
      "Класс Coin создан",
      "typeof Coin === \"function\" && /class\\s+Coin/.test(__codeNS)"
     ],
     [
      "new Coin(5, 7) сохраняет координаты",
      "(function () { var c = new Coin(5, 7); return c.x === 5 && c.y === 7; })()"
     ],
     [
      "У монеты value = 10 и collected = false",
      "(function () { var c = new Coin(0, 0); return c.value === 10 && c.collected === false; })()"
     ],
     [
      "coin1 и coin2 созданы в нужных точках",
      "coin1 instanceof Coin && coin2 instanceof Coin && coin1.x === 50 && coin1.y === 100 && coin2.x === 200 && coin2.y === 150"
     ]
    ],
    "hints": [
     "`class Coin { constructor(x, y) { this.x = x; this.y = y; ... } }`",
     "В конструкторе ещё `this.value = 10;` и `this.collected = false;`. Создание: `const coin1 = new Coin(50, 100);`"
    ],
    "text": "Создай класс `Coin` (монета):\n- `constructor(x, y)` сохраняет `x` и `y`;\n- у каждой монеты есть свойство `value` = `10` и `collected` = `false`.\n\nСоздай две монеты: `coin1` в точке (50, 100) и `coin2` в точке (200, 150).",
    "starter": "\n",
    "solution": "class Coin {\n  constructor(x, y) {\n    this.x = x;\n    this.y = y;\n    this.value = 10;\n    this.collected = false;\n  }\n}\n\nconst coin1 = new Coin(50, 100);\nconst coin2 = new Coin(200, 150);\nconsole.log(coin1, coin2);\n"
   },
   "quiz": [
    {
     "q": "Что делает слово new?",
     "a": [
      "Создаёт новый объект по классу",
      "Объявляет класс",
      "Удаляет объект"
     ],
     "c": 0,
     "e": "`new Имя(...)` создаёт объект и вызывает его constructor."
    },
    {
     "q": "Как принято называть классы?",
     "a": [
      "С большой буквы: Enemy",
      "С маленькой: enemy",
      "Большими буквами: ENEMY"
     ],
     "c": 0,
     "e": "Классы — с большой буквы, обычные переменные — с маленькой."
    }
   ]
  },
  {
   "id": "cls-2",
   "title": "Методы класса — update и draw",
   "theory": "В классе можно описать не только свойства, но и **методы** — то, что объект умеет делать. Методы пишутся внутри класса после конструктора:\n\n```js canvas\nclass Ball {\n  constructor(x, y, color) {\n    this.x = x;\n    this.y = y;\n    this.vx = Math.random() * 6 - 3;\n    this.vy = Math.random() * 6 - 3;\n    this.r = 12;\n    this.color = color;\n  }\n\n  update() {\n    this.x += this.vx;\n    this.y += this.vy;\n    if (this.x < this.r || this.x > canvas.width - this.r) this.vx = -this.vx;\n    if (this.y < this.r || this.y > canvas.height - this.r) this.vy = -this.vy;\n  }\n\n  draw() {\n    ctx.fillStyle = this.color;\n    ctx.beginPath();\n    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);\n    ctx.fill();\n  }\n}\n\nconst balls = [];\nfor (let i = 0; i < 25; i++) {\n  balls.push(new Ball(240, 160, `hsl(${i * 14}, 90%, 60%)`));\n}\n\nfunction loop() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  for (const b of balls) {\n    b.update();\n    b.draw();\n  }\n  requestAnimationFrame(loop);\n}\nloop();\n```\n\nСмотри, как просто стал игровой цикл: «каждый мяч — обновись и нарисуйся». Вся логика мяча спрятана внутри класса.\n\n## Методы, которые отвечают на вопросы\n\nМетод может возвращать значение. Например, «улетел ли объект за экран?»:\n\n```code\nisOffScreen() {\n  return this.y < 0 || this.y > canvas.height;\n}\n```\n\n> 💡 Внутри методов к свойствам объекта обращаются через `this` — как в объектах из модуля 7.\n\n> 🎮 Почти любой игровой объект — это класс с методами `update()` и `draw()`. Добавить в игру новый вид врагов = написать новый класс.",
   "task": {
    "tests": [
     [
      "new Bullet(10, 200): x, y и speed = 8",
      "(function () { var b = new Bullet(10, 200); return b.x === 10 && b.y === 200 && b.speed === 8; })()"
     ],
     [
      "update сдвигает пулю вверх на speed",
      "(function () { var b = new Bullet(10, 200); b.update(); b.update(); return b.y === 184 && b.x === 10; })()"
     ],
     [
      "isOffScreen: false на экране, true за верхним краем",
      "(function () { var b = new Bullet(10, 5); var a = b.isOffScreen() === false; b.update(); return a && b.isOffScreen() === true; })()"
     ]
    ],
    "hints": [
     "Шаблон: `class Bullet { constructor(x, y) { ... } update() { ... } isOffScreen() { ... } }`",
     "`update() { this.y -= this.speed; }` и `isOffScreen() { return this.y < 0; }`"
    ],
    "text": "Создай класс `Bullet` (пуля):\n- `constructor(x, y)` — сохраняет `x`, `y` и задаёт `speed` = `8`;\n- метод `update()` — пуля летит **вверх**: уменьшает `y` на `speed`;\n- метод `isOffScreen()` — возвращает `true`, если пуля улетела за верхний край (`y < 0`).\n\nНиже уже есть код, который стреляет пулями — посмотри на результат.",
    "canvas": true,
    "starter": "// Класс Bullet\n\n\nconst bullets = [];\nsetInterval(() => {\n  if (typeof Bullet === \"function\") bullets.push(new Bullet(240, 310));\n}, 300);\n\nfunction loop() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"yellow\";\n  for (let i = bullets.length - 1; i >= 0; i--) {\n    const b = bullets[i];\n    if (b.update) b.update();\n    ctx.fillRect(b.x - 2, b.y, 4, 12);\n    if (b.isOffScreen && b.isOffScreen()) bullets.splice(i, 1);\n  }\n  requestAnimationFrame(loop);\n}\nloop();\n",
    "solution": "// Класс Bullet\nclass Bullet {\n  constructor(x, y) {\n    this.x = x;\n    this.y = y;\n    this.speed = 8;\n  }\n\n  update() {\n    this.y -= this.speed;\n  }\n\n  isOffScreen() {\n    return this.y < 0;\n  }\n}\n\nconst bullets = [];\nsetInterval(() => {\n  if (typeof Bullet === \"function\") bullets.push(new Bullet(240, 310));\n}, 300);\n\nfunction loop() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = \"yellow\";\n  for (let i = bullets.length - 1; i >= 0; i--) {\n    const b = bullets[i];\n    if (b.update) b.update();\n    ctx.fillRect(b.x - 2, b.y, 4, 12);\n    if (b.isOffScreen && b.isOffScreen()) bullets.splice(i, 1);\n  }\n  requestAnimationFrame(loop);\n}\nloop();\n"
   },
   "quiz": [
    {
     "q": "Как внутри метода класса обратиться к свойству speed этого объекта?",
     "a": [
      "`this.speed`",
      "`speed`",
      "`Bullet.speed`"
     ],
     "c": 0,
     "e": "this — это объект, у которого вызван метод."
    }
   ]
  },
  {
   "id": "cls-3",
   "title": "Наследование — босс тоже враг",
   "theory": "Обычный враг: здоровье, движение, получение урона. Босс: всё то же самое, **плюс** больше здоровья и особая атака. Копировать весь код врага в босса? Нет — можно сказать, что босс **наследует** всё от врага.\n\n```js\nclass Enemy {\n  constructor(x, y) {\n    this.x = x;\n    this.y = y;\n    this.hp = 20;\n  }\n\n  takeDamage(amount) {\n    this.hp -= amount;\n    if (this.hp <= 0) console.log(\"Враг повержен!\");\n  }\n}\n\nclass Boss extends Enemy {\n  constructor(x, y) {\n    super(x, y);\n    this.hp = 200;\n  }\n\n  roar() {\n    console.log(\"БОСС РЫЧИТ! 🐉\");\n  }\n}\n\nconst boss = new Boss(240, 50);\nboss.roar();\nboss.takeDamage(50);\nconsole.log(\"У босса осталось \" + boss.hp);\n```\n\n## Разбор\n\n- `class Boss extends Enemy` — «Boss **расширяет** Enemy» (`extends` [экстэ́ндз]). Boss получает **все** свойства и методы Enemy.\n- `super(x, y)` [су́пер] — вызвать конструктор **родителя** (Enemy), чтобы он настроил x, y и hp. Пишется первой строчкой в конструкторе.\n- После `super` можно поменять или добавить свои свойства: у босса `hp = 200`.\n- `roar()` — новый метод, которого у обычного врага нет.\n- `takeDamage` у босса работает, хотя мы его не писали, — он унаследован!\n\n## Переопределение метода\n\nЕсли у наследника написать метод с тем же именем — он **заменит** родительский:\n\n```js\nclass Enemy {\n  attack() { return 5; }\n}\nclass Archer extends Enemy {\n  attack() { return 12; }\n}\nconsole.log(new Enemy().attack(), new Archer().attack());\n```\n\n> 🎮 В больших играх целые «деревья» классов: `GameObject` → `Enemy` → `FlyingEnemy` → `Dragon`. Каждый следующий берёт всё от предыдущего и добавляет своё.",
   "task": {
    "tests": [
     [
      "Enemy: координаты и hp = 20",
      "(function () { var e = new Enemy(3, 4); return e.x === 3 && e.y === 4 && e.hp === 20; })()"
     ],
     [
      "takeDamage и isDead работают",
      "(function () { var e = new Enemy(0, 0); e.takeDamage(15); var a = e.hp === 5 && e.isDead() === false; e.takeDamage(5); return a && e.isDead() === true; })()"
     ],
     [
      "Boss наследует Enemy",
      "/class\\s+Boss\\s+extends\\s+Enemy/.test(__codeNS) && new Boss(0, 0) instanceof Enemy"
     ],
     [
      "У босса hp = 100 и координаты из super",
      "(function () { var b = new Boss(7, 8); return b.hp === 100 && b.x === 7 && b.y === 8; })()"
     ],
     [
      "Босс умеет получать урон (метод унаследован)",
      "(function () { var b = new Boss(0, 0); b.takeDamage(40); return b.hp === 60 && b.isDead() === false; })()"
     ]
    ],
    "hints": [
     "У Enemy три части: constructor, `takeDamage(amount) { this.hp -= amount; }` и `isDead() { return this.hp <= 0; }`",
     "`class Boss extends Enemy { constructor(x, y) { super(x, y); this.hp = 100; } }`"
    ],
    "text": "1. Создай класс `Enemy`: `constructor(x, y)` сохраняет координаты и ставит `hp = 20`; метод `takeDamage(amount)` уменьшает `hp` на `amount`; метод `isDead()` возвращает `true`, если `hp <= 0`.\n2. Создай класс `Boss`, который **наследует** `Enemy` (`extends`): в конструкторе вызови `super(x, y)` и поставь `hp = 100`.",
    "starter": "\n",
    "solution": "class Enemy {\n  constructor(x, y) {\n    this.x = x;\n    this.y = y;\n    this.hp = 20;\n  }\n\n  takeDamage(amount) {\n    this.hp -= amount;\n  }\n\n  isDead() {\n    return this.hp <= 0;\n  }\n}\n\nclass Boss extends Enemy {\n  constructor(x, y) {\n    super(x, y);\n    this.hp = 100;\n  }\n}\n\nconst boss = new Boss(240, 50);\nboss.takeDamage(30);\nconsole.log(boss.hp);\n"
   },
   "quiz": [
    {
     "q": "Что делает super(x, y) в конструкторе наследника?",
     "a": [
      "Вызывает конструктор родительского класса",
      "Создаёт суперобъект",
      "Удаляет родителя"
     ],
     "c": 0,
     "e": "super — это «родитель». Сначала родитель настраивает объект, потом наследник добавляет своё."
    },
    {
     "q": "Есть ли у Boss метод takeDamage, если его написали только в Enemy?",
     "a": [
      "Да, он унаследован",
      "Нет"
     ],
     "c": 0,
     "e": "extends передаёт наследнику все методы родителя."
    }
   ]
  },
  {
   "id": "cls-4",
   "title": "Менеджер объектов — волны врагов",
   "theory": "Соберём всё вместе: класс врага, массив, создание волн и удаление погибших. Это скелет почти любой игры с врагами.\n\n```js canvas\nclass Enemy {\n  constructor(x, y) {\n    this.x = x;\n    this.y = y;\n    this.size = 30;\n    this.speed = 0.5 + Math.random();\n    this.hp = 3;\n  }\n  update() { this.y += this.speed; }\n  draw() {\n    ctx.font = this.size + \"px Arial\";\n    ctx.fillText(\"👾\", this.x, this.y);\n  }\n  isDead() { return this.hp <= 0 || this.y > canvas.height + 40; }\n}\n\nlet enemies = [];\nlet wave = 0;\n\nfunction spawnWave(count) {\n  wave++;\n  for (let i = 0; i < count; i++) {\n    enemies.push(new Enemy(20 + Math.random() * 420, -20 - Math.random() * 200));\n  }\n}\n\ncanvas.addEventListener(\"click\", (e) => {\n  const r = canvas.getBoundingClientRect();\n  const mx = (e.clientX - r.left) * canvas.width / r.width;\n  const my = (e.clientY - r.top) * canvas.height / r.height;\n  for (const en of enemies) {\n    if (mx > en.x && mx < en.x + en.size && my > en.y - en.size && my < en.y) en.hp--;\n  }\n});\n\nfunction loop() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  for (const en of enemies) { en.update(); en.draw(); }\n  enemies = enemies.filter((en) => !en.isDead());\n  if (enemies.length === 0) spawnWave(3 + wave * 2);\n  ctx.fillStyle = \"white\"; ctx.font = \"18px Arial\";\n  ctx.fillText(`Волна ${wave} · кликай по пришельцам (3 клика)`, 10, 24);\n  requestAnimationFrame(loop);\n}\nloop();\n```\n\n## Главные идеи\n\n1. **Класс** описывает одного врага.\n2. **Функция `spawnWave(count)`** создаёт пачку врагов и кладёт их в массив. С каждой волной врагов больше — растёт сложность.\n3. **Игровой цикл** обновляет и рисует всех.\n4. **Уборка:** `enemies = enemies.filter((en) => !en.isDead())` — оставляем только живых. Это ещё один способ удалять (вместо `splice` с конца). Для этого массив объявлен через `let`: мы заменяем его новым.\n5. **Новая волна**, когда враги кончились.\n\n> 🎮 Поздравляю: теперь ты знаешь всё, чтобы делать настоящие игры! Дальше — пять игровых проектов, где мы соберём всё вместе.",
   "task": {
    "tests": [
     [
      "spawnWave(4) добавляет 4 врага класса Enemy",
      "(function () { enemies.length = 0; spawnWave(4); return enemies.length === 4 && enemies.every(function (e) { return e instanceof Enemy; }); })()"
     ],
     [
      "spawnWave добавляет, а не заменяет",
      "(function () { enemies.length = 0; spawnWave(2); spawnWave(3); return enemies.length === 5; })()"
     ],
     [
      "removeDead убирает погибших и оставляет живых",
      "(function () { enemies.length = 0; spawnWave(4); enemies[0].hp = 0; enemies[2].hp = -1; var alive1 = enemies[1], alive3 = enemies[3]; removeDead(); return enemies.length === 2 && enemies.indexOf(alive1) !== -1 && enemies.indexOf(alive3) !== -1; })()"
     ]
    ],
    "hints": [
     "`function spawnWave(count) { for (let i = 0; i < count; i++) { enemies.push(new Enemy(Math.random() * 450, 0)); } }`",
     "`function removeDead() { enemies = enemies.filter((e) => !e.isDead()); }`"
    ],
    "text": "Напиши менеджер врагов:\n\n1. Функцию `spawnWave(count)` — добавляет в массив `enemies` ровно `count` новых врагов (`new Enemy(x, y)`, координаты любые, например случайный x и y = 0).\n2. Функцию `removeDead()` — убирает из `enemies` всех, у кого `isDead()` возвращает `true`.\n\nКласс `Enemy` уже готов.",
    "canvas": true,
    "starter": "class Enemy {\n  constructor(x, y) {\n    this.x = x;\n    this.y = y;\n    this.hp = 3;\n    this.speed = 1;\n  }\n  update() { this.y += this.speed; }\n  draw() {\n    ctx.fillStyle = \"tomato\";\n    ctx.fillRect(this.x, this.y, 24, 24);\n  }\n  isDead() { return this.hp <= 0 || this.y > canvas.height; }\n}\n\nlet enemies = [];\n\nfunction spawnWave(count) {\n\n}\n\nfunction removeDead() {\n\n}\n\nspawnWave(5);\nfunction loop() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  for (const e of enemies) { e.update(); e.draw(); }\n  removeDead();\n  if (enemies.length === 0) spawnWave(5);\n  requestAnimationFrame(loop);\n}\nloop();\n",
    "solution": "class Enemy {\n  constructor(x, y) {\n    this.x = x;\n    this.y = y;\n    this.hp = 3;\n    this.speed = 1;\n  }\n  update() { this.y += this.speed; }\n  draw() {\n    ctx.fillStyle = \"tomato\";\n    ctx.fillRect(this.x, this.y, 24, 24);\n  }\n  isDead() { return this.hp <= 0 || this.y > canvas.height; }\n}\n\nlet enemies = [];\n\nfunction spawnWave(count) {\n  for (let i = 0; i < count; i++) {\n    enemies.push(new Enemy(Math.random() * (canvas.width - 24), 0));\n  }\n}\n\nfunction removeDead() {\n  enemies = enemies.filter((e) => !e.isDead());\n}\n\nspawnWave(5);\nfunction loop() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  for (const e of enemies) { e.update(); e.draw(); }\n  removeDead();\n  if (enemies.length === 0) spawnWave(5);\n  requestAnimationFrame(loop);\n}\nloop();\n"
   },
   "quiz": [
    {
     "q": "Что оставит `list.filter((e) => !e.isDead())`?",
     "a": [
      "Только живых",
      "Только погибших",
      "Всех"
     ],
     "c": 0,
     "e": "`!` переворачивает: оставляем тех, кто НЕ погиб."
    }
   ]
  }
 ],
 "id": "cls",
 "icon": "🏗️",
 "color": "#18c79a",
 "title": "Классы",
 "desc": "Чертежи для игровых объектов: враги, пули, бонусы и боссы"
});
