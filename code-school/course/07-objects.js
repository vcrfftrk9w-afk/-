/* Собрано из content/07-objects.txt командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */
window.COURSE = window.COURSE || [];
window.COURSE.push({
 "lessons": [
  {
   "id": "obj-1",
   "title": "Объект — всё о персонаже в одном месте",
   "theory": "У героя много характеристик: имя, здоровье, уровень, оружие, координаты. Хранить их в отдельных переменных неудобно — особенно если героев несколько. Удобнее собрать всё в **объект**.\n\n```js\nconst hero = {\n  name: \"Рыцарь\",\n  hp: 100,\n  level: 1,\n  weapon: \"меч\"\n};\n\nconsole.log(hero.name);\nconsole.log(hero.hp);\nconsole.log(hero);\n```\n\n## Как устроен объект\n\n- объект пишется в **фигурных скобках** `{ }`;\n- внутри — пары **ключ: значение**, через запятую;\n- ключ (имя свойства) — слово, значение — что угодно.\n\nТакая пара называется **свойство**. У героя четыре свойства: `name`, `hp`, `level`, `weapon`.\n\n## Как достать свойство\n\n**Через точку** — самый частый способ:\n\n```code\nhero.name     // \"Рыцарь\"\nhero.hp       // 100\n```\n\n**Через квадратные скобки** — если имя свойства хранится в переменной:\n\n```js\nconst hero = { name: \"Рыцарь\", hp: 100 };\nconst what = \"hp\";\nconsole.log(hero[what]);\nconsole.log(hero[\"name\"]);\n```\n\n> 💡 Сравни массив и объект: в массиве элементы по **номерам** (`inventory[0]`), в объекте — по **именам** (`hero.hp`). Массив — для списка однотипных вещей, объект — для описания одной вещи.\n\n> 🎮 В играх объекты — это всё: игрок, враг, пуля, монета, кнопка. У каждого есть `x`, `y`, размеры, скорость…",
   "task": {
    "tests": [
     [
      "Объект hero создан",
      "typeof hero === \"object\" && hero !== null && !Array.isArray(hero)"
     ],
     [
      "У героя есть имя-текст, hp = 100, level = 1, weapon = \"меч\"",
      "typeof hero.name === \"string\" && hero.name.length > 0 && hero.hp === 100 && hero.level === 1 && hero.weapon === \"меч\""
     ],
     [
      "Выведены имя и здоровье через точку",
      "__has(hero.name) && __line(\"100\") && /hero\\.name/.test(__codeNS) && /hero\\.hp/.test(__codeNS)"
     ]
    ],
    "hints": [
     "`const hero = { name: \"Рыцарь\", hp: 100, level: 1, weapon: \"меч\" };` — можно в одну строку или как в примере, по свойству на строку.",
     "Вывод: `console.log(hero.name);` и `console.log(hero.hp);`"
    ],
    "text": "Создай объект `hero` со свойствами:\n- `name` — имя героя (текст),\n- `hp` — `100`,\n- `level` — `1`,\n- `weapon` — `\"меч\"`.\n\nВыведи имя и здоровье героя, обращаясь к свойствам через точку.",
    "starter": "\n",
    "solution": "const hero = {\n  name: \"Рыцарь\",\n  hp: 100,\n  level: 1,\n  weapon: \"меч\"\n};\n\nconsole.log(hero.name);\nconsole.log(hero.hp);\n"
   },
   "quiz": [
    {
     "q": "Как достать свойство speed у объекта player?",
     "a": [
      "`player.speed`",
      "`player[speed]` (без кавычек)",
      "`speed.player`"
     ],
     "c": 0,
     "e": "Через точку: объект.свойство. В квадратных скобках имя нужно в кавычках: `player[\"speed\"]`."
    },
    {
     "q": "Что разделяет свойства в объекте?",
     "a": [
      "Точка с запятой",
      "Запятая",
      "Пробел"
     ],
     "c": 1,
     "e": "`{ a: 1, b: 2 }` — свойства через запятую."
    }
   ]
  },
  {
   "id": "obj-2",
   "title": "Меняем объект",
   "theory": "Свойства объекта можно менять, добавлять и удалять — прямо как переменные.\n\n```js\nconst hero = { name: \"Рыцарь\", hp: 100, level: 1 };\n\nhero.hp -= 30;\nhero.level++;\nconsole.log(hero);\n```\n\n## Добавить новое свойство\n\nПросто присвой значение свойству, которого ещё нет — оно появится:\n\n```js\nconst hero = { name: \"Рыцарь\", hp: 100 };\nhero.gold = 50;\nhero.hasKey = true;\nconsole.log(hero);\n```\n\n## Удалить свойство\n\n```js\nconst hero = { name: \"Рыцарь\", hp: 100, curse: \"слабость\" };\ndelete hero.curse;\nconsole.log(hero);\n```\n\n`delete` [дили́т] — «удалить».\n\n## Есть ли свойство?\n\n```js\nconst hero = { name: \"Рыцарь\", hp: 100 };\nconsole.log(\"hp\" in hero);\nconsole.log(\"mana\" in hero);\nconsole.log(hero.mana);\n```\n\nОтсутствующее свойство даёт `undefined`, а оператор `in` [ин] отвечает, есть ли такой ключ.\n\n> 💡 Как и с массивами: объект в `const` можно менять внутри. `const` только запрещает заменить весь объект на другой.\n\n## Перебор свойств\n\n```js\nconst stats = { сила: 8, ловкость: 5, ум: 3 };\nfor (const key in stats) {\n  console.log(key + \": \" + stats[key]);\n}\nconsole.log(Object.keys(stats));\n```\n\n`for...in` перебирает **ключи** объекта. `Object.keys(obj)` возвращает массив ключей.",
   "task": {
    "tests": [
     [
      "hp стало 70",
      "hero.hp === 70"
     ],
     [
      "level стал 2",
      "hero.level === 2"
     ],
     [
      "Появилось свойство gold = 50",
      "hero.gold === 50"
     ],
     [
      "Объект меняли, а не создавали заново с готовыми числами",
      "/hero\\.hp\\s*(-=|=\\s*hero\\.hp\\s*-)/.test(__codeNS) && /hero\\.level\\s*(\\+\\+|\\+=)|\\+\\+\\s*hero\\.level|hero\\.level\\s*=\\s*hero\\.level\\s*\\+/.test(__codeNS)"
     ],
     [
      "Объект выведен",
      "__out.some(function (l) { return l.indexOf(\"gold\") !== -1; })"
     ]
    ],
    "hints": [
     "`hero.hp -= 30;`, `hero.level++;`, `hero.gold = 50;`"
    ],
    "text": "Герой попал в передрягу. Измени объект `hero`:\n\n1. Герой получил урон — уменьши `hp` на 30.\n2. Герой победил монстра — увеличь `level` на 1.\n3. Добавь герою новое свойство `gold` со значением `50`.\n\nВыведи весь объект `hero`.",
    "starter": "const hero = {\n  name: \"Рыцарь\",\n  hp: 100,\n  level: 1\n};\n",
    "solution": "const hero = {\n  name: \"Рыцарь\",\n  hp: 100,\n  level: 1\n};\n\nhero.hp -= 30;\nhero.level++;\nhero.gold = 50;\n\nconsole.log(hero);\n"
   },
   "quiz": [
    {
     "q": "Что выведет: `const a = { x: 1 }; a.y = 2; console.log(a.y);`",
     "a": [
      "2",
      "undefined",
      "Ошибку, ведь a — const"
     ],
     "c": 0,
     "e": "Новое свойство просто добавляется. const не мешает менять содержимое."
    },
    {
     "q": "Что вернёт обращение к несуществующему свойству?",
     "a": [
      "null",
      "undefined",
      "Ошибку"
     ],
     "c": 1,
     "e": "Отсутствующее свойство — undefined."
    }
   ]
  },
  {
   "id": "obj-3",
   "title": "Методы — объекты умеют действовать",
   "theory": "В объекте можно хранить не только данные, но и **функции**. Функция внутри объекта называется **методом**. Ты уже пользовался методами: `console.log` — это метод `log` объекта `console`!\n\n```js\nconst player = {\n  x: 0,\n  speed: 5,\n  moveRight() {\n    this.x += this.speed;\n  },\n  report() {\n    console.log(\"Игрок на позиции \" + this.x);\n  }\n};\n\nplayer.moveRight();\nplayer.moveRight();\nplayer.report();\n```\n\n## Что такое this\n\n`this` [зис] — «этот». Внутри метода `this` — это **сам объект**, у которого вызвали метод. `this.x` — «мой x», `this.speed` — «моя скорость».\n\nЗачем? Чтобы метод работал с данными своего объекта. Если объект переименовать или скопировать — метод всё равно будет работать с правильными данными.\n\n## Как записать метод\n\n```code\nconst obj = {\n  имяМетода() {\n    // команды, можно использовать this\n  }\n};\n```\n\nВызов — через точку и скобки: `obj.имяМетода()`.\n\n> ⚠️ Внутри метода пиши `this.x`, а не просто `x`. Просто `x` — это какая-то другая, внешняя переменная (скорее всего, её нет — будет ошибка).\n\n> 🎮 У игровых объектов почти всегда есть методы `update()` — «обновиться» (сдвинуться, проверить столкновения) и `draw()` — «нарисоваться». Скоро увидишь!",
   "task": {
    "tests": [
     [
      "Есть методы moveRight и moveLeft",
      "typeof player.moveRight === \"function\" && typeof player.moveLeft === \"function\""
     ],
     [
      "moveRight увеличивает x на speed",
      "(function () { player.x = 0; player.speed = 7; player.moveRight(); var ok = player.x === 7; player.speed = 5; return ok; })()"
     ],
     [
      "moveLeft уменьшает x на speed",
      "(function () { player.x = 20; player.speed = 5; player.moveLeft(); return player.x === 15; })()"
     ],
     [
      "После вызовов выведено 10",
      "__line(\"10\")"
     ],
     [
      "Используется this",
      "/this\\.x/.test(__codeNS) && /this\\.speed/.test(__codeNS)"
     ]
    ],
    "hints": [
     "После `speed: 5,` добавь метод: `moveRight() { this.x += this.speed; },`",
     "Так же `moveLeft() { this.x -= this.speed; }`. Между методами — запятая."
    ],
    "text": "Допиши объект `player`:\n\n1. Метод `moveRight()` — увеличивает `x` на `speed` (используй `this`).\n2. Метод `moveLeft()` — уменьшает `x` на `speed`.\n\nВызови `moveRight()` три раза и `moveLeft()` один раз. Выведи `player.x` — должно быть `10`.",
    "starter": "const player = {\n  x: 0,\n  speed: 5,\n\n};\n",
    "solution": "const player = {\n  x: 0,\n  speed: 5,\n  moveRight() {\n    this.x += this.speed;\n  },\n  moveLeft() {\n    this.x -= this.speed;\n  }\n};\n\nplayer.moveRight();\nplayer.moveRight();\nplayer.moveRight();\nplayer.moveLeft();\nconsole.log(player.x);\n"
   },
   "quiz": [
    {
     "q": "Что такое this внутри метода?",
     "a": [
      "Сам объект, у которого вызван метод",
      "Глобальная переменная",
      "Предыдущая функция"
     ],
     "c": 0,
     "e": "`this` — «этот объект»."
    },
    {
     "q": "Как вызвать метод jump объекта hero?",
     "a": [
      "`jump(hero)`",
      "`hero.jump()`",
      "`hero.jump`"
     ],
     "c": 1,
     "e": "Метод вызывается через точку и обязательно со скобками."
    }
   ]
  },
  {
   "id": "obj-4",
   "title": "Массив объектов — армия врагов",
   "theory": "Самое мощное сочетание в играх — **массив объектов**. Каждый враг — объект с координатами и здоровьем, а все враги — массив.\n\n```js\nconst enemies = [\n  { name: \"Гоблин\", hp: 30, x: 50 },\n  { name: \"Орк\", hp: 0, x: 120 },\n  { name: \"Тролль\", hp: 80, x: 200 }\n];\n\nconsole.log(enemies[0].name);\nconsole.log(enemies[2].hp);\nconsole.log(\"Врагов: \" + enemies.length);\n```\n\n`enemies[0]` — первый объект, `enemies[0].name` — его имя.\n\n## Перебираем объекты\n\n```js\nconst enemies = [\n  { name: \"Гоблин\", hp: 30 },\n  { name: \"Орк\", hp: 0 },\n  { name: \"Тролль\", hp: 80 }\n];\n\nfor (const e of enemies) {\n  if (e.hp > 0) {\n    console.log(`${e.name} жив (${e.hp} HP)`);\n  } else {\n    console.log(`${e.name} повержен`);\n  }\n}\n\nconst alive = enemies.filter((e) => e.hp > 0);\nconsole.log(\"Живых: \" + alive.length);\n```\n\n## Удар по всем\n\nИзменение объекта внутри цикла меняет его в массиве:\n\n```js\nconst enemies = [{ hp: 30 }, { hp: 10 }, { hp: 50 }];\nfor (const e of enemies) {\n  e.hp -= 20;\n}\nconsole.log(enemies);\n```\n\n> 🎮 Вот так выглядит «магия по площади»: один цикл — и урон получили все враги. Каждый кадр игры — это проход по массивам объектов: двигаем, рисуем, проверяем.",
   "task": {
    "tests": [
     [
      "Здоровье всех врагов уменьшено на 25",
      "enemies[0].hp === -5 && enemies[1].hp === 35 && enemies[2].hp === 0 && enemies[3].hp === 175"
     ],
     [
      "alive содержит только Тролля и Дракона",
      "Array.isArray(alive) && alive.length === 2 && alive[0].name === \"Тролль\" && alive[1].name === \"Дракон\""
     ],
     [
      "Выведено «Тролль, Дракон»",
      "__line(\"Тролль, Дракон\")"
     ],
     [
      "Используются filter, map и join",
      "/\\.filter\\s*\\(/.test(__codeNS) && /\\.map\\s*\\(/.test(__codeNS) && /\\.join\\s*\\(/.test(__codeNS)"
     ]
    ],
    "hints": [
     "Удар: `for (const e of enemies) { e.hp -= 25; }`",
     "`const alive = enemies.filter((e) => e.hp > 0);` и `console.log(alive.map((e) => e.name).join(\", \"));`"
    ],
    "text": "Есть массив врагов `enemies`.\n\n1. Огненный шар бьёт всех: уменьши `hp` каждого врага на **25** (в цикле).\n2. Создай массив `alive` — только враги, у кого после удара `hp` **больше 0** (используй `filter`).\n3. Выведи имена выживших через запятую — используй `map` и `join(\", \")`.\n\nДолжно вывестись: `Тролль, Дракон`",
    "starter": "const enemies = [\n  { name: \"Гоблин\", hp: 20 },\n  { name: \"Тролль\", hp: 60 },\n  { name: \"Слизень\", hp: 25 },\n  { name: \"Дракон\", hp: 200 }\n];\n",
    "solution": "const enemies = [\n  { name: \"Гоблин\", hp: 20 },\n  { name: \"Тролль\", hp: 60 },\n  { name: \"Слизень\", hp: 25 },\n  { name: \"Дракон\", hp: 200 }\n];\n\nfor (const e of enemies) {\n  e.hp -= 25;\n}\n\nconst alive = enemies.filter((e) => e.hp > 0);\n\nconsole.log(alive.map((e) => e.name).join(\", \"));\n"
   },
   "quiz": [
    {
     "q": "Как получить x третьего врага в массиве enemies?",
     "a": [
      "`enemies.x[2]`",
      "`enemies[2].x`",
      "`enemies[3].x`"
     ],
     "c": 1,
     "e": "Третий элемент — индекс 2, у него берём свойство x."
    }
   ]
  },
  {
   "id": "obj-5",
   "title": "JSON и сохранение рекорда",
   "theory": "Как игра запоминает рекорд, даже если закрыть браузер? У браузера есть своя «память» — `localStorage` [ло́укал сто́ридж], «местное хранилище».\n\n```js\nlocalStorage.setItem(\"best\", 500);\nconst saved = localStorage.getItem(\"best\");\nconsole.log(\"Сохранённый рекорд: \" + saved);\n```\n\n- `setItem(ключ, значение)` [сет а́йтем] — сохранить;\n- `getItem(ключ)` [гет а́йтем] — достать. Если ничего не сохранено — вернёт `null`.\n\n> ⚠️ Хранилище умеет хранить **только текст**. Число 500 сохранится как `\"500\"`. Поэтому после чтения превращай в число: `Number(localStorage.getItem(\"best\"))`.\n\n> 💡 В этом курсе у песочницы своя память: сохранённое в одном запуске программы будет доступно в следующем. Запусти пример два раза!\n\n```js\nlet visits = Number(localStorage.getItem(\"visits\")) || 0;\nvisits++;\nlocalStorage.setItem(\"visits\", visits);\nconsole.log(\"Ты запускаешь эту программу уже \" + visits + \" раз\");\n```\n\n`|| 0` значит «а если там пусто (null превратится в 0, а NaN — тоже ложь) — возьми 0».\n\n## Сохранить объект: JSON\n\nА как сохранить целый объект — например, прогресс героя? Объект надо превратить в текст. Для этого есть формат **JSON** [джейсо́н]:\n\n```js\nconst save = { level: 3, coins: 120, items: [\"меч\", \"щит\"] };\n\nconst text = JSON.stringify(save);\nconsole.log(text);\n\nconst back = JSON.parse(text);\nconsole.log(back.items[1]);\n```\n\n- `JSON.stringify(obj)` [стри́нгифай] — объект → текст;\n- `JSON.parse(text)` [парс] — текст → объект.\n\n> 🎮 Так работают сохранения почти во всех браузерных играх.",
   "task": {
    "tests": [
     [
      "Рекорд читается через getItem(\"best\")",
      "/localStorage\\.getItem\\s*\\(\\s*[\"']best[\"']\\s*\\)/.test(__code)"
     ],
     [
      "Рекорд сохраняется через setItem(\"best\", ...) внутри if",
      "/if\\s*\\([^)]*score\\s*>\\s*best[^)]*\\)\\s*\\{[^}]*localStorage\\.setItem\\s*\\(\\s*[\"']best[\"']/.test(__code)"
     ],
     [
      "В хранилище рекорд не меньше 120",
      "Number(localStorage.getItem(\"best\")) >= 120"
     ],
     [
      "Выведена строчка с рекордом",
      "__out.some(function (l) { return /^Рекорд: \\d+/.test(l); })"
     ]
    ],
    "hints": [
     "`let best = Number(localStorage.getItem(\"best\")) || 0;`",
     "`if (score > best) { localStorage.setItem(\"best\", score); console.log(\"Новый рекорд!\"); }` и в конце `console.log(\"Рекорд: \" + localStorage.getItem(\"best\"));`"
    ],
    "text": "Напиши сохранение рекорда:\n\n1. Прочитай рекорд из хранилища в переменную `best`: `Number(localStorage.getItem(\"best\")) || 0`.\n2. Игрок набрал `score = 120`. Если `score` больше `best` — сохрани новый рекорд через `setItem` и выведи `Новый рекорд!`\n3. В конце выведи `Рекорд: ` и текущий рекорд из хранилища.",
    "starter": "const score = 120;\n",
    "solution": "const score = 120;\nlet best = Number(localStorage.getItem(\"best\")) || 0;\n\nif (score > best) {\n  localStorage.setItem(\"best\", score);\n  console.log(\"Новый рекорд!\");\n}\n\nconsole.log(\"Рекорд: \" + localStorage.getItem(\"best\"));\n"
   },
   "quiz": [
    {
     "q": "Что вернёт `localStorage.getItem(\"ключ\")`, если ничего не сохраняли?",
     "a": [
      "null",
      "0",
      "Пустую строку"
     ],
     "c": 0,
     "e": "Если ключа нет — null."
    },
    {
     "q": "Зачем нужен JSON.stringify?",
     "a": [
      "Чтобы удалить объект",
      "Чтобы превратить объект в текст (например, для сохранения)",
      "Чтобы ускорить игру"
     ],
     "c": 1,
     "e": "localStorage хранит только текст, поэтому объект сначала превращают в JSON-строку."
    }
   ]
  }
 ],
 "id": "obj",
 "icon": "🧱",
 "color": "#f78c6b",
 "title": "Объекты",
 "desc": "Описываем героя и врагов: свойства, методы, списки объектов и сохранения"
});
