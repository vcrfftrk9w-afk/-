'use strict';
// Описание предметов, построек, рецептов и добычи.

const TILE = 32;
const WT = 160;               // размер острова в клетках
const WORLD = WT * TILE;
const DAY_LEN = 720;          // секунд на сутки
const INV_SIZE = 30;          // 6 ячеек пояса + 24 рюкзака
const HOTBAR = 6;

// gather: сколько ресурса даёт удар по узлу данного типа.
const ITEMS = {
  wood:        { name: 'Дерево', stack: 1000, cat: 'res', desc: 'Основа всего: постройки, костры, инструменты.' },
  stone:       { name: 'Камень', stack: 1000, cat: 'res', desc: 'Каменные стены, печь, инструменты.' },
  metal_ore:   { name: 'Металлическая руда', stack: 1000, cat: 'res', desc: 'Переплавьте в печи, чтобы получить фрагменты металла.' },
  sulfur_ore:  { name: 'Серная руда', stack: 1000, cat: 'res', desc: 'Переплавьте в печи, чтобы получить серу.' },
  metal:       { name: 'Фрагменты металла', stack: 1000, cat: 'res', desc: 'Оружие, патроны, металлические инструменты.' },
  sulfur:      { name: 'Сера', stack: 1000, cat: 'res', desc: 'Вместе с углём превращается в порох.' },
  charcoal:    { name: 'Уголь', stack: 1000, cat: 'res', desc: 'Остаётся от дерева, сгоревшего в печи.' },
  gunpowder:   { name: 'Порох', stack: 500, cat: 'res', desc: 'Нужен для патронов и дроби.' },
  cloth:       { name: 'Ткань', stack: 500, cat: 'res', desc: 'Из конопли и шкур. Бинты, одежда, спальник.' },
  scrap:       { name: 'Скрап', stack: 1000, cat: 'res', desc: 'Детали из бочек и ящиков. Нужен для оружия и верстака.' },

  raw_meat:    { name: 'Сырое мясо', stack: 20, cat: 'food', use: { food: 5, hp: -4 }, desc: 'Лучше пожарить на костре.' },
  cooked_meat: { name: 'Жареное мясо', stack: 20, cat: 'food', use: { food: 32, hp: 6 }, desc: 'Сытно и безопасно.' },
  berries:     { name: 'Черника', stack: 20, cat: 'food', use: { food: 6, water: 8 }, desc: 'Немного еды и воды.' },
  mushroom:    { name: 'Гриб', stack: 20, cat: 'food', use: { food: 12, hp: 2 }, desc: 'Съедобный. Почти наверняка.' },
  canned:      { name: 'Тушёнка', stack: 10, cat: 'food', use: { food: 45, hp: 4 }, desc: 'Довоенный запас.' },
  water_bottle:{ name: 'Бутылка воды', stack: 10, cat: 'food', use: { water: 55 }, desc: 'Чистая питьевая вода.' },
  bandage:     { name: 'Бинт', stack: 10, cat: 'med', use: { hp: 15, bleed: true }, desc: 'Останавливает кровотечение, +15 здоровья.' },
  medkit:      { name: 'Аптечка', stack: 5, cat: 'med', use: { hp: 45, bleed: true }, desc: '+45 здоровья и остановка кровотечения.' },

  rock:        { name: 'Булыжник', stack: 1, cat: 'tool', melee: { dmg: 10, range: 44, cd: 0.6 }, gather: { tree: 4, stone: 5, metal: 2, sulfur: 2 }, desc: 'С чего начинает каждый.' },
  torch:       { name: 'Факел', stack: 1, cat: 'tool', melee: { dmg: 9, range: 44, cd: 0.6 }, gather: {}, light: 300, desc: 'Освещает путь ночью.' },
  stone_hatchet:{ name: 'Каменный топор', stack: 1, cat: 'tool', melee: { dmg: 16, range: 48, cd: 0.62 }, gather: { tree: 11, stone: 2, metal: 1, sulfur: 1 }, desc: 'Рубит деревья вдвое быстрее булыжника.' },
  stone_pickaxe:{ name: 'Каменная кирка', stack: 1, cat: 'tool', melee: { dmg: 14, range: 48, cd: 0.66 }, gather: { tree: 2, stone: 10, metal: 6, sulfur: 6 }, desc: 'Для камня и руды.' },
  salvaged_axe:{ name: 'Самодельный топор', stack: 1, cat: 'tool', melee: { dmg: 26, range: 50, cd: 0.6 }, gather: { tree: 24, stone: 3, metal: 2, sulfur: 2 }, desc: 'Металлическое лезвие. Лучший топор на острове.' },
  salvaged_pick:{ name: 'Самодельная кирка', stack: 1, cat: 'tool', melee: { dmg: 22, range: 50, cd: 0.64 }, gather: { tree: 3, stone: 20, metal: 12, sulfur: 12 }, desc: 'Ломает скалы как печенье.' },
  hammer:      { name: 'Молоток', stack: 1, cat: 'tool', melee: { dmg: 6, range: 48, cd: 0.5 }, gather: {}, hammer: true, desc: 'ЛКМ — чинить свою постройку. X — разобрать (возврат 50%).' },

  spear:       { name: 'Деревянное копьё', stack: 1, cat: 'weapon', melee: { dmg: 30, range: 66, cd: 0.85 }, gather: { tree: 2, stone: 1 }, desc: 'Длинный удар. Держит волков на расстоянии.' },
  machete:     { name: 'Мачете', stack: 1, cat: 'weapon', melee: { dmg: 40, range: 52, cd: 0.55 }, gather: { tree: 6 }, desc: 'Быстрое металлическое лезвие.' },
  bow:         { name: 'Охотничий лук', stack: 1, cat: 'weapon', gun: { ammo: 'arrow', mag: 1, dmg: 42, speed: 700, cd: 0.25, reload: 0.75, spread: 0.02, sound: 'bow', proj: 'arrow' }, desc: 'Тихий и смертельный. Стреляет стрелами.' },
  revolver:    { name: 'Револьвер', stack: 1, cat: 'weapon', gun: { ammo: 'pistol_ammo', mag: 8, dmg: 30, speed: 1250, cd: 0.26, reload: 1.8, spread: 0.035, sound: 'gun', proj: 'bullet' }, desc: '8 патронов в барабане.' },
  shotgun:     { name: 'Самодельный дробовик', stack: 1, cat: 'weapon', gun: { ammo: 'shell', mag: 2, dmg: 14, pellets: 7, speed: 950, cd: 0.45, reload: 2.0, spread: 0.2, range: 0.5, sound: 'shotgun', proj: 'pellet' }, desc: 'Разносит всё вблизи.' },
  arrow:       { name: 'Стрела', stack: 64, cat: 'ammo', desc: 'Для лука.' },
  pistol_ammo: { name: 'Пистолетный патрон', stack: 128, cat: 'ammo', desc: 'Для револьвера.' },
  shell:       { name: 'Самодельный патрон', stack: 64, cat: 'ammo', desc: 'Дробь для дробовика.' },

  burlap:      { name: 'Рубаха из мешковины', stack: 1, cat: 'armor', armor: 0.15, desc: 'Снижает урон на 15%. ПКМ — надеть.' },
  wood_armor:  { name: 'Деревянная броня', stack: 1, cat: 'armor', armor: 0.32, desc: 'Снижает урон на 32%. ПКМ — надеть.' },
  metal_armor: { name: 'Металлический нагрудник', stack: 1, cat: 'armor', armor: 0.5, desc: 'Снижает урон на 50%. ПКМ — надеть.' },

  wood_wall:   { name: 'Деревянная стена', stack: 20, cat: 'build', deploy: true, desc: 'Блокирует проход и пули.' },
  stone_wall:  { name: 'Каменная стена', stack: 20, cat: 'build', deploy: true, desc: 'Крепче дерева в 2.5 раза.' },
  wood_door:   { name: 'Деревянная дверь', stack: 10, cat: 'build', deploy: true, desc: 'E — открыть или закрыть.' },
  campfire:    { name: 'Костёр', stack: 5, cat: 'build', deploy: true, desc: 'Жарит мясо, греет и лечит рядом.' },
  furnace:     { name: 'Печь', stack: 3, cat: 'build', deploy: true, desc: 'Плавит руду. Топливо — дерево.' },
  box:         { name: 'Деревянный ящик', stack: 5, cat: 'build', deploy: true, desc: 'Хранит 18 стопок вещей.' },
  sleeping_bag:{ name: 'Спальный мешок', stack: 3, cat: 'build', deploy: true, desc: 'Точка возрождения после смерти.' },
  workbench:   { name: 'Верстак', stack: 1, cat: 'build', deploy: true, desc: 'Открывает рецепты оружия рядом с ним.' },
  barricade:   { name: 'Колючая баррикада', stack: 10, cat: 'build', deploy: true, desc: 'Ранит всех, кто к ней прикоснётся.' },
};
for (const id in ITEMS) ITEMS[id].id = id;

const STRUCTS = {
  wood_wall:   { hp: 250, solid: true, shots: true, mat: 'wood', refund: { wood: 50 } },
  stone_wall:  { hp: 650, solid: true, shots: true, mat: 'stone', refund: { stone: 75 } },
  wood_door:   { hp: 220, door: true, shots: true, mat: 'wood', refund: { wood: 85 } },
  campfire:    { hp: 120, solid: false, mat: 'stone', fire: 'cook', light: 230, refund: { wood: 50 } },
  furnace:     { hp: 320, solid: true, shots: false, mat: 'stone', fire: 'smelt', light: 140, refund: { stone: 100, wood: 50 } },
  box:         { hp: 150, solid: true, mat: 'wood', storage: 18, refund: { wood: 60 } },
  sleeping_bag:{ hp: 60, solid: false, mat: 'cloth', spawn: true, refund: { cloth: 15 } },
  workbench:   { hp: 300, solid: true, mat: 'wood', bench: true, refund: { wood: 150, metal: 25 } },
  barricade:   { hp: 260, solid: true, mat: 'wood', spikes: true, refund: { wood: 100 } },
  concrete:    { hp: Infinity, solid: true, shots: true, mat: 'concrete', fixed: true },
};

// Рецепты. bench — нужен верстак рядом.
const RECIPES = [
  { out: 'stone_hatchet', n: 1, cost: { wood: 100, stone: 50 }, time: 4, cat: 'tools' },
  { out: 'stone_pickaxe', n: 1, cost: { wood: 100, stone: 75 }, time: 4, cat: 'tools' },
  { out: 'torch', n: 1, cost: { wood: 30, cloth: 5 }, time: 2, cat: 'tools' },
  { out: 'hammer', n: 1, cost: { wood: 100 }, time: 3, cat: 'tools' },
  { out: 'salvaged_axe', n: 1, cost: { wood: 150, metal: 100, scrap: 20 }, time: 8, cat: 'tools', bench: true },
  { out: 'salvaged_pick', n: 1, cost: { wood: 150, metal: 100, scrap: 20 }, time: 8, cat: 'tools', bench: true },

  { out: 'spear', n: 1, cost: { wood: 200 }, time: 4, cat: 'weapons' },
  { out: 'bow', n: 1, cost: { wood: 200, cloth: 30 }, time: 6, cat: 'weapons' },
  { out: 'arrow', n: 4, cost: { wood: 30, stone: 15 }, time: 2, cat: 'weapons' },
  { out: 'machete', n: 1, cost: { metal: 80, wood: 50 }, time: 6, cat: 'weapons', bench: true },
  { out: 'revolver', n: 1, cost: { metal: 150, scrap: 60, cloth: 25 }, time: 10, cat: 'weapons', bench: true },
  { out: 'shotgun', n: 1, cost: { metal: 175, wood: 100, scrap: 50 }, time: 10, cat: 'weapons', bench: true },
  { out: 'pistol_ammo', n: 6, cost: { metal: 10, gunpowder: 6 }, time: 3, cat: 'weapons', bench: true },
  { out: 'shell', n: 3, cost: { metal: 10, gunpowder: 6, stone: 10 }, time: 3, cat: 'weapons', bench: true },
  { out: 'gunpowder', n: 5, cost: { charcoal: 15, sulfur: 10 }, time: 2, cat: 'weapons' },

  { out: 'wood_wall', n: 1, cost: { wood: 100 }, time: 2, cat: 'build' },
  { out: 'stone_wall', n: 1, cost: { stone: 150, wood: 25 }, time: 3, cat: 'build' },
  { out: 'wood_door', n: 1, cost: { wood: 175 }, time: 3, cat: 'build' },
  { out: 'campfire', n: 1, cost: { wood: 100 }, time: 2, cat: 'build' },
  { out: 'sleeping_bag', n: 1, cost: { cloth: 30 }, time: 3, cat: 'build' },
  { out: 'box', n: 1, cost: { wood: 120 }, time: 3, cat: 'build' },
  { out: 'furnace', n: 1, cost: { stone: 200, wood: 100, cloth: 20 }, time: 5, cat: 'build' },
  { out: 'workbench', n: 1, cost: { wood: 300, metal: 50, scrap: 30 }, time: 8, cat: 'build' },
  { out: 'barricade', n: 1, cost: { wood: 200 }, time: 4, cat: 'build' },

  { out: 'bandage', n: 1, cost: { cloth: 4 }, time: 1.5, cat: 'gear' },
  { out: 'medkit', n: 1, cost: { cloth: 25, scrap: 10 }, time: 5, cat: 'gear', bench: true },
  { out: 'burlap', n: 1, cost: { cloth: 30 }, time: 4, cat: 'gear' },
  { out: 'wood_armor', n: 1, cost: { wood: 300, cloth: 30 }, time: 6, cat: 'gear', bench: true },
];

const RECIPE_CATS = [
  { id: 'tools', name: 'Инструменты' },
  { id: 'weapons', name: 'Оружие' },
  { id: 'build', name: 'Постройки' },
  { id: 'gear', name: 'Медицина и броня' },
];

// Ресурсные узлы
const NODES = {
  tree:     { r: 11, solid: true, block: true, res: 'wood', amt: [140, 260] },
  pine:     { r: 10, solid: true, block: true, res: 'wood', amt: [160, 280], gatherAs: 'tree' },
  stone:    { r: 17, solid: true, block: true, res: 'stone', amt: [250, 400] },
  metal:    { r: 17, solid: true, block: true, res: 'metal_ore', amt: [150, 260], extra: 'stone' },
  sulfur:   { r: 17, solid: true, block: true, res: 'sulfur_ore', amt: [150, 260], extra: 'stone' },
  hemp:     { r: 9, pick: { cloth: [8, 12] }, label: 'Собрать коноплю' },
  bush:     { r: 12, pick: { berries: [2, 4] }, label: 'Собрать чернику' },
  shroom:   { r: 7, pick: { mushroom: [1, 2] }, label: 'Сорвать гриб' },
  barrel:   { r: 12, solid: true, block: true, hp: 35, loot: 'barrel' },
  crate:    { r: 15, solid: true, block: true, container: 'crate', label: 'Открыть ящик' },
  elite:    { r: 16, solid: true, block: true, container: 'elite', label: 'Открыть военный ящик' },
  radar:    { r: 0, decor: true },
  pump:     { r: 14, solid: true, block: true, decor: true },
};

// [id, мин, макс, шанс]
const LOOT = {
  barrel: [
    ['scrap', 2, 6, 0.8], ['metal', 10, 30, 0.35], ['cloth', 5, 15, 0.3], ['canned', 1, 1, 0.18],
    ['water_bottle', 1, 1, 0.2], ['bandage', 1, 2, 0.15], ['arrow', 3, 6, 0.12],
    ['pistol_ammo', 4, 8, 0.07], ['shell', 2, 3, 0.05],
  ],
  crate: [
    ['scrap', 6, 15, 0.9], ['metal', 20, 60, 0.5], ['gunpowder', 5, 15, 0.25], ['bandage', 1, 3, 0.3],
    ['stone_hatchet', 1, 1, 0.12], ['stone_pickaxe', 1, 1, 0.12], ['machete', 1, 1, 0.07], ['bow', 1, 1, 0.08],
    ['salvaged_axe', 1, 1, 0.05], ['salvaged_pick', 1, 1, 0.05], ['burlap', 1, 1, 0.12], ['wood_armor', 1, 1, 0.05],
    ['arrow', 6, 12, 0.18], ['pistol_ammo', 6, 14, 0.12], ['shell', 3, 6, 0.08], ['revolver', 1, 1, 0.035],
    ['medkit', 1, 1, 0.08], ['canned', 1, 2, 0.2],
  ],
  elite: [
    ['scrap', 20, 45, 1], ['metal', 50, 120, 0.6], ['gunpowder', 15, 35, 0.5], ['medkit', 1, 2, 0.45],
    ['revolver', 1, 1, 0.3], ['shotgun', 1, 1, 0.22], ['pistol_ammo', 12, 30, 0.55], ['shell', 6, 12, 0.4],
    ['metal_armor', 1, 1, 0.18], ['wood_armor', 1, 1, 0.2], ['salvaged_axe', 1, 1, 0.15], ['salvaged_pick', 1, 1, 0.15],
    ['machete', 1, 1, 0.15],
  ],
};

function rollLoot(table, minItems = 1) {
  const out = [];
  let guard = 0;
  while (out.length < minItems && guard++ < 6) {
    for (const [id, a, b, p] of LOOT[table]) {
      if (Math.random() < p && !out.find((s) => s.id === id)) out.push(makeStack(id, randi(a, b)));
    }
  }
  return out;
}

function makeStack(id, n = 1) {
  const s = { id, n };
  if (ITEMS[id].gun) s.mag = 0;
  return s;
}

// Животные
const ANIMALS = {
  deer:  { name: 'Олень', hp: 60, r: 14, speed: 95, run: 210, dmg: 0, behavior: 'flee', loot: { raw_meat: [3, 5], cloth: [8, 14] }, color: '#8a6440' },
  boar:  { name: 'Кабан', hp: 130, r: 14, speed: 70, run: 175, dmg: 13, cd: 1.1, behavior: 'defend', loot: { raw_meat: [5, 8], cloth: [6, 10] }, color: '#4e443c' },
  wolf:  { name: 'Волк', hp: 95, r: 13, speed: 90, run: 215, dmg: 11, cd: 0.9, behavior: 'hunt', sight: 300, loot: { raw_meat: [3, 5], cloth: [12, 18] }, color: '#7c7f84' },
  bear:  { name: 'Медведь', hp: 380, r: 22, speed: 70, run: 180, dmg: 26, cd: 1.4, behavior: 'hunt', sight: 210, loot: { raw_meat: [12, 18], cloth: [25, 35] }, color: '#4a3424' },
};

// Мародёры
const NPC_KINDS = {
  spear:    { name: 'Бродяга', hp: 90, weapon: 'spear', speed: 120, dmg: 15, range: 58, cd: 1.0, armor: 0 },
  bow:      { name: 'Охотник-мародёр', hp: 90, weapon: 'bow', speed: 115, dmg: 20, cd: 1.6, ranged: true, pref: 260, armor: 0.1 },
  revolver: { name: 'Стрелок', hp: 120, weapon: 'revolver', speed: 120, dmg: 13, cd: 0.55, burst: 3, ranged: true, pref: 230, armor: 0.25 },
  shotgun:  { name: 'Громила', hp: 150, weapon: 'shotgun', speed: 125, dmg: 7, pellets: 6, cd: 1.3, ranged: true, pref: 120, armor: 0.3 },
};

const NPC_LOOT = {
  spear: [['spear', 1, 1, 0.25], ['cloth', 5, 15, 0.5], ['scrap', 2, 6, 0.6], ['raw_meat', 1, 2, 0.3], ['bandage', 1, 1, 0.3]],
  bow: [['bow', 1, 1, 0.3], ['arrow', 4, 10, 0.8], ['scrap', 3, 8, 0.6], ['cloth', 5, 10, 0.4], ['burlap', 1, 1, 0.1]],
  revolver: [['revolver', 1, 1, 0.25], ['pistol_ammo', 6, 16, 0.8], ['scrap', 8, 16, 0.8], ['medkit', 1, 1, 0.2], ['metal', 15, 40, 0.5]],
  shotgun: [['shotgun', 1, 1, 0.22], ['shell', 3, 8, 0.8], ['scrap', 8, 18, 0.8], ['wood_armor', 1, 1, 0.12], ['gunpowder', 5, 12, 0.4]],
};

function rollFrom(list) {
  const out = [];
  for (const [id, a, b, p] of list) if (Math.random() < p) out.push(makeStack(id, randi(a, b)));
  return out;
}
