/* Проверки без зависимостей: node tests/run.js
   Тут проверяется только то, что можно сломать молча: данные путей,
   подбор под силы, сборка писем и файлов, хранилище. */
'use strict';

require('../src/util.js');
require('../src/store.js');
require('../src/content/pulls.js');
require('../src/content/clarify.js');
require('../src/content/paths.js');
require('../src/logic/choose.js');
require('../src/workshop/prototype.js');
require('../src/workshop/letter.js');
require('../src/workshop/declutter.js');

var M = globalThis.Most;
var C = M.content;
var L = M.logic;
var W = M.workshop;

var failed = 0;
var passed = 0;

function ok(cond, name) {
  if (cond) { passed++; return; }
  failed++;
  console.error('  провал: ' + name);
}

function group(name, fn) {
  console.log(name);
  fn();
}

group('мелочи', function () {
  ok(M.plural(1, 'шаг', 'шага', 'шагов') === 'шаг', 'один шаг');
  ok(M.plural(3, 'шаг', 'шага', 'шагов') === 'шага', 'три шага');
  ok(M.plural(11, 'шаг', 'шага', 'шагов') === 'шагов', 'одиннадцать шагов');
  ok(M.plural(21, 'шаг', 'шага', 'шагов') === 'шаг', 'двадцать один шаг');
  ok(M.minutes(20) === '20 минут', 'двадцать минут');
  ok(M.minutes(60) === '1 час', 'один час');
  ok(M.minutes(90).indexOf('ч') !== -1, 'полтора часа');
});

group('содержание путей', function () {
  ok(C.paths.length >= 14, 'путей хватает на все тяги');

  var ids = {};
  var toolsOk = true, shapeOk = true, sizeOk = true, textOk = true;

  C.paths.forEach(function (p) {
    ok(!ids[p.id], 'идентификатор пути уникален: ' + p.id);
    ids[p.id] = true;
    if (!C.shapes[p.shape]) shapeOk = false;
    if (!C.pullById(p.pull)) shapeOk = false;
    if (p.steps.length < 3) sizeOk = false;

    p.steps.forEach(function (s) {
      if (!s.id || !s.t || !s.result || !s.min) textOk = false;
      if (!s.smaller || !s.smaller.t || !s.smaller.result || !s.smaller.min) textOk = false;
      if (s.smaller && s.smaller.min > s.min) sizeOk = false;
      if (s.tool && ['prototype', 'letter', 'declutter'].indexOf(s.tool) === -1) toolsOk = false;
    });
  });

  ok(shapeOk, 'у каждого пути есть форма и тяга');
  ok(sizeOk, 'уменьшенная версия шага не больше полного');
  ok(textOk, 'у каждого шага есть название, результат и уменьшенная версия');
  ok(toolsOk, 'инструменты шагов существуют');

  C.pulls.forEach(function (pull) {
    var has = C.paths.some(function (p) { return p.pull === pull.id; });
    ok(has, 'для тяги «' + pull.label + '» есть хотя бы один путь');
  });
});

group('подбор под силы', function () {
  function bridge(pulls, res) {
    var b = M.store.blankBridge('проверка');
    b.clarify.pulls = pulls;
    b.res = Object.assign(b.res, res);
    return b;
  }

  var tired = L.rank(bridge(['calm'], { hours: 0.5, energy: 'empty', money: 'none' }));
  ok(tired[0].best === true, 'лучший вариант помечен');
  ok(tired[0].shape.id === 'repair', 'на нуле сил предлагается починка, а не подвиг');

  var strong = L.rank(bridge(['create'], { hours: 10, energy: 'ok', money: 'ok' }));
  ok(strong[0].shape.id === 'jump', 'при силах и деньгах наверху прыжок');

  var poor = L.rank(bridge(['create'], { hours: 10, energy: 'ok', money: 'none' }));
  var jump = poor.filter(function (r) { return r.shape.id === 'jump'; })[0];
  ok(jump.fit === 'heavy', 'без денег прыжок помечен дорогим');
  ok(poor[0].shape.id !== 'jump', 'но наверх он не поднимается');
  ok(poor.indexOf(jump) !== -1, 'дорогой путь всё равно показан — выбирает человек');

  var many = L.rank(bridge(['create', 'money'], { hours: 3, energy: 'meh', money: 'small' }));
  ok(many.some(function (r) { return r.path.pull === 'money'; }), 'вторая тяга тоже даёт пути');
  ok(many[0].primary === true, 'первая тяга важнее при равном счёте');
});

group('шаг и его размер', function () {
  var b = M.store.blankBridge('проверка');
  b.clarify.pulls = ['create'];
  b.pathId = 'create.scout';

  var st = L.step(b);
  ok(st.step.n === 1, 'начинаем с первого шага');
  ok(st.total === 4, 'в пути четыре шага');

  b.stepIndex = 4;
  ok(L.step(b).finished === true, 'после последнего шага путь пройден');

  b.res.energy = 'empty';
  ok(L.smallerFirst(b) === true, 'без сил сразу предлагается уменьшенный шаг');
  b.res.energy = 'ok';
  b.res.hours = 5;
  ok(L.smallerFirst(b) === false, 'при силах — полный');

  b.log = [{ outcome: 'done' }, { outcome: 'done' }, { outcome: 'wrong' }];
  b.results = [{ what: 'раз' }, { what: 'два' }];
  ok(L.enoughAlone(b) === false, 'два шага — ещё рано отпускать');
  b.log.push({ outcome: 'done' });
  ok(L.enoughAlone(b) === true, 'три шага и два результата — пора предложить уйти');
});

group('хранилище', function () {
  var s = M.store;
  s.state = s.blank();

  var b = s.create('хочу сменить работу');
  ok(s.current().id === b.id, 'новый мост становится текущим');

  s.update(function (x) { x.clarify.core = 'хочу больше воздуха'; });
  ok(s.current().clarify.core === 'хочу больше воздуха', 'изменения сохраняются');

  s.gotResult('первая работающая штука');
  ok(s.current().results.length === 1, 'результат записан');

  s.close(b.id, 'done');
  ok(s.live().length === 0 && s.closed().length === 1, 'закрытый мост уходит из живых');
  ok(s.state.currentId === null, 'после закрытия нет текущего моста');

  s.reopen(b.id);
  ok(s.live().length === 1, 'мост можно вернуть');

  var broken = s.migrate({ bridges: { x: { wish: 'что-то' } }, order: ['x', 'нет-такого'] });
  ok(broken.order.length === 1, 'битые ссылки в порядке отбрасываются');
  ok(Array.isArray(broken.bridges.x.log), 'у старой записи появляются недостающие поля');
  ok(s.migrate(null).v === 1, 'полностью битые данные не роняют приложение');

  var before = s.exportText();
  ok(JSON.parse(before).bridges[b.id].wish === 'хочу сменить работу', 'выгрузка — читаемый JSON');

  s.wipe();
  ok(s.state.order.length === 0, 'стирание убирает всё');
});

group('письма', function () {
  var text = W.buildLetter('raise', {
    to: 'Аня',
    facts: 'запустил отчётность\nвзял двух новых людей',
    amount: '220 000',
    when: 'в четверг',
    me: 'Костя'
  }, 'plain');

  ok(text.indexOf('Аня, здравствуйте.') === 0, 'письмо начинается с обращения');
  ok(text.indexOf('— запустил отчётность') !== -1, 'факты превращаются в список');
  ok(text.indexOf('220 000') !== -1, 'цифра на месте');
  ok(text.indexOf('Костя') !== -1, 'подпись на месте');

  var empty = W.buildLetter('quit', {}, 'soft');
  ok(empty.indexOf('[дата]') !== -1, 'пропущенное поле остаётся видимой дыркой, а не выдумывается');
  ok(empty.indexOf('Здравствуйте.') === 0, 'без имени письмо всё равно собирается');

  var brackets = true;
  W.letters.forEach(function (kind) {
    var built = kind.build({ to: 'Ты', me: 'Я' }, 'soft') + kind.build({ to: 'Ты', me: 'Я' }, 'plain');
    if (built.indexOf('(а)') !== -1 || built.indexOf('(ась)') !== -1) brackets = false;
  });
  ok(brackets, 'в письмах нет скобочных окончаний вроде «готов(а)»');
});

group('прототипы', function () {
  var joke = W.projectById('joke');
  var html = joke.build({ title: 'Моя кнопка', lines: 'раз\nдва' });
  ok(html.indexOf('<!doctype html>') === 0, 'получается настоящий файл');
  ok(html.indexOf('["раз","два"]') !== -1, 'фразы человека попадают внутрь');
  ok(html.indexOf('Моя кнопка') !== -1, 'название на месте');

  var nasty = joke.build({ title: '<script>alert(1)<\/script>', lines: 'ок' });
  ok(nasty.indexOf('<script>alert(1)') === -1, 'чужая разметка в названии обезврежена');

  var timer = W.projectById('timer').build({ title: 'Стол', mins: '5' });
  ok(timer.indexOf('var minutes = 5;') !== -1, 'число минут подставляется');
  var weird = W.projectById('timer').build({ title: 'Стол', mins: 'абв' });
  ok(weird.indexOf('var minutes = 20;') !== -1, 'ерунда вместо числа не ломает файл');

  W.projects.forEach(function (p) {
    var out = p.build({});
    ok(out.indexOf('</html>') !== -1, 'файл «' + p.title + '» собирается даже из пустой формы');
  });
});

group('бардак', function () {
  var summary = W.declutterSummary('table', { keep: 3, toss: 5, give: 1, later: 2 });
  ok(summary.indexOf('11 вещей') !== -1, 'счёт вещей складывается');
  ok(summary.indexOf('выброшено 5') !== -1, 'видно, чего стало меньше');
  ok(W.declutterSummary('shelf', {}).indexOf('Разобрано') === 0, 'пустой счётчик не ломает итог');
});

group('приложение не догадывается, кто ты', function () {
  /* В русском языке легко нечаянно назначить человеку пол: «сделал», «устал», «сам».
     Приложение обращается на «ты» и не знает, кто по ту сторону, — значит, таких
     форм в текстах быть не должно. Проверяем и содержание, и экраны. */
  /* «был» и «сама» согласуются с вещами («шаг был», «вкладка закрылась сама»),
     поэтому их не ловим — ловим только формы, которые могут относиться к человеку. */
  var WORDS = ['сделал', 'сделала', 'написал', 'написала', 'решил', 'решила', 'понял',
               'поняла', 'пришёл', 'пришла', 'сам', 'устал', 'устала', 'занялся',
               'занялась', 'разбитым', 'разбитой', 'собрал', 'собрала', 'посчитал',
               'посчитала', 'пошёл', 'пошла', 'открывал', 'заходил', 'справился',
               'справилась', 'зрителем'];
  var EDGE = '[^а-яёА-ЯЁ]';

  function findGendered(text) {
    var padded = ' ' + String(text) + ' ';
    for (var i = 0; i < WORDS.length; i++) {
      if (new RegExp(EDGE + WORDS[i] + EDGE, 'i').test(padded)) return WORDS[i];
    }
    return null;
  }

  function walk(value, path, hits) {
    if (typeof value === 'string') {
      var hit = findGendered(value);
      if (hit) hits.push(path + ': «' + hit + '» в «' + M.trim(value, 60) + '»');
    } else if (Array.isArray(value)) {
      value.forEach(function (v, i) { walk(v, path + '[' + i + ']', hits); });
    } else if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (k) { walk(value[k], path + '.' + k, hits); });
    }
    return hits;
  }

  var hits = [];
  walk({ pulls: C.pulls, paths: C.paths, examples: C.examples, ownership: C.ownership,
         notMine: C.notMine, tuesday: C.tuesday, costs: C.costs, coreQ: C.coreQ,
         pullsQ: C.pullsQ }, 'содержание', hits);
  walk({ projects: W.projects, letters: W.letters, surfaces: W.surfaces, buckets: W.buckets },
       'мастерская', hits);

  W.letters.forEach(function (kind) {
    ['plain', 'soft'].forEach(function (tone) {
      walk(kind.build({ to: 'Имя', me: 'Имя' }, tone), 'письмо.' + kind.id + '.' + tone, hits);
    });
  });

  var fs = require('fs');
  ['src/app.js', 'src/screens'].forEach(function (place) {
    var files = fs.statSync(place).isDirectory()
      ? fs.readdirSync(place).map(function (f) { return place + '/' + f; })
      : [place];
    files.forEach(function (file) {
      fs.readFileSync(file, 'utf8').split('\n').forEach(function (line, n) {
        var hit = findGendered(line);
        if (hit) hits.push(file + ':' + (n + 1) + ': «' + hit + '»');
      });
    });
  });

  hits.forEach(function (x) { console.error('  найдено: ' + x); });
  ok(hits.length === 0, 'в текстах нет форм, назначающих человеку пол');
});

console.log('');
console.log(passed + ' в порядке, ' + failed + ' сломано');
process.exit(failed ? 1 : 0);
