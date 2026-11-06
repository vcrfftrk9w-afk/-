/* Стальной рубеж — все юниты и здания. Только данные, без логики.
   Чтобы добавить свой юнит: скопируйте блок, поменяйте имя и цифры,
   впишите его в `produces` нужного завода. Подробно — rts/GUIDE.md. */

const TILE = 32;                                 // размер клетки карты в пикселях
const START_CREDITS = 1000;
const UNIT_CAP = 60;                             // предел юнитов на команду
const TEAM_COLORS = ['#3d8bfd', '#e5484d'];      // 0 — игрок, 1 — противник
const TEAM_NAMES = ['Синие', 'Красные'];

/* Поля юнита:
   cost — цена, buildTime — секунд на постройку, hp — прочность,
   speed — пикселей в секунду, move — land (суша) | hover (суша и вода) | air (летает),
   radius — размер, sight — обзор в пикселях,
   weapon — оружие: range дальность, damage урон, reload секунд между выстрелами,
            projSpeed скорость снаряда, ground/air — по кому стреляет,
            splash — радиус взрыва, minRange — мёртвая зона, arc — навесом, turnRate — поворот башни (рад/с),
   shape — какую «модель» рисовать (rts/js/sprites.js),
   image — свой PNG вместо модели: 'assets/tank.png' или ['assets/tank_blue.png', 'assets/tank_red.png'] */
const DEFS = {
  builder: {
    kind: 'unit', name: 'Строитель', cost: 250, buildTime: 5, hp: 180, speed: 62, move: 'land',
    radius: 10, sight: 220, shape: 'builder', hint: 'Строит здания',
    builds: ['extractor', 'factory', 'airfactory', 'turret'],
  },
  tank: {
    kind: 'unit', name: 'Танк', cost: 200, buildTime: 5, hp: 360, speed: 62, move: 'land',
    radius: 11, sight: 260, shape: 'tank', hint: 'Основа армии',
    weapon: { range: 170, damage: 28, reload: 1.1, projSpeed: 420, ground: true, air: false, turnRate: 5 },
  },
  artillery: {
    kind: 'unit', name: 'Артиллерия', cost: 450, buildTime: 8, hp: 200, speed: 42, move: 'land',
    radius: 12, sight: 300, shape: 'artillery', hint: 'Навесом по площади, далеко',
    weapon: { range: 400, minRange: 90, damage: 70, splash: 45, reload: 3.6, projSpeed: 260, arc: true,
              ground: true, air: false, turnRate: 2 },
  },
  hover: {
    kind: 'unit', name: 'Ховер', cost: 220, buildTime: 5, hp: 200, speed: 92, move: 'hover',
    radius: 10, sight: 260, shape: 'hover', hint: 'Быстрый, ходит по воде',
    weapon: { range: 150, damage: 16, reload: 0.7, projSpeed: 480, ground: true, air: false, turnRate: 7 },
  },
  flak: {
    kind: 'unit', name: 'Зенитка', cost: 240, buildTime: 5, hp: 260, speed: 55, move: 'land',
    radius: 11, sight: 300, shape: 'flak', hint: 'Сбивает авиацию',
    weapon: { range: 240, damage: 24, reload: 0.5, projSpeed: 600, ground: false, air: true, turnRate: 6 },
  },
  gunship: {
    kind: 'unit', name: 'Вертолёт', cost: 450, buildTime: 8, hp: 280, speed: 105, move: 'air',
    radius: 13, sight: 300, shape: 'gunship', hint: 'Летает над водой и скалами',
    weapon: { range: 170, damage: 13, reload: 0.35, projSpeed: 520, ground: true, air: true, turnRate: 6 },
  },

  /* Поля здания: size — сторона в клетках, income — кредитов в секунду,
     produces — что производит, onPool — ставится только на источник,
     upgrade — улучшение: цена, время, новый доход и прочность. */
  command: {
    kind: 'building', name: 'Штаб', size: 3, hp: 3000, income: 6, sight: 320, shape: 'command',
    produces: ['builder'],
    weapon: { range: 220, damage: 14, reload: 0.8, projSpeed: 500, ground: true, air: true, turnRate: 4 },
  },
  extractor: {
    kind: 'building', name: 'Добытчик', cost: 350, size: 2, hp: 700, buildTime: 6, income: 7, sight: 180,
    shape: 'extractor', onPool: true, hint: 'Только на источник',
    upgrade: { cost: 550, time: 10, income: 16, hp: 1200 },
  },
  factory: {
    kind: 'building', name: 'Завод', cost: 550, size: 3, hp: 1600, buildTime: 10, sight: 200,
    shape: 'factory', hint: 'Наземная техника',
    produces: ['builder', 'tank', 'artillery', 'hover', 'flak'],
  },
  airfactory: {
    kind: 'building', name: 'Аэродром', cost: 900, size: 3, hp: 1300, buildTime: 14, sight: 200,
    shape: 'airfactory', hint: 'Авиация',
    produces: ['gunship'],
  },
  turret: {
    kind: 'building', name: 'Турель', cost: 400, size: 2, hp: 1400, buildTime: 8, sight: 300,
    shape: 'turret', hint: 'Защита базы, бьёт и авиацию',
    weapon: { range: 250, damage: 32, reload: 0.9, projSpeed: 520, ground: true, air: true, turnRate: 4 },
  },
};
