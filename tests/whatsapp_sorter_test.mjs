// Проверка сортировщика идей для WhatsApp-бота без настоящего WhatsApp:
//   node tests/whatsapp_sorter_test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSorter } from '../bot/whatsapp/sorter.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-sorter-'));
const file = path.join(dir, 'ideas.json');
let bot = createSorter(file);
const say = t => bot.handle(t);
const texts = id => bot.data().items[id].map(it => it.text);
let n = 0;
const check = (name, fn) => { fn(); n++; console.log('✓', name); };

check('явная папка в начале: слово убирается из текста', () => {
  assert.match(say('тт: снять как кот пугается огурца'), /Идеи для ТТ.*№1/);
  assert.match(say('идея для тиктока — танец с пылесосом'), /№2/);
  assert.match(say('Короче в жизнь сходить к стоматологу'), /В жизнь.*№1/);
  assert.match(say('ТИК ТОК, тренд с лимоном'), /№3/);
  assert.deepEqual(texts('tt'), ['снять как кот пугается огурца', 'танец с пылесосом', 'тренд с лимоном']);
  assert.deepEqual(texts('life'), ['сходить к стоматологу']);
});

check('«тт» внутри слова не считается папкой', () => {
  say('ттттт привет'); // не начинается с «тт» как отдельного слова
  assert.ok(!texts('tt').includes('ттт привет'));
});

check('без папки — угадывает по словам и подсказывает, как перенести', () => {
  const r = say('хочу снять видео про утро студента');
  assert.match(r, /Идеи для ТТ.*по слову/);
  assert.match(r, /перенеси 4 в жизнь/);
  assert.match(say('надо купить кроссовки'), /В жизнь/);
});

check('непонятное — спрашивает «куда?», ответ цифрой перекладывает', () => {
  const before = texts('inbox').length;
  assert.match(say('бабушкин рецепт пирога'), /Куда это\? 1 — 🎬 Идеи для ТТ, 2 — 🌱 В жизнь/);
  assert.equal(texts('inbox').length, before + 1);
  assert.match(say('2'), /Положил в «В жизнь»/);
  assert.ok(texts('life').includes('бабушкин рецепт пирога'));
  assert.ok(!texts('inbox').includes('бабушкин рецепт пирога'));
});

check('ответ словом и игнор вопроса', () => {
  say('коллаб с Машей');
  assert.match(say('тт'), /Положил в «Идеи для ТТ»/);
  say('что-то непонятное');
  say('в жизнь: выспаться'); // вопрос проигнорирован — «1» потом не должна ничего перекладывать
  assert.ok(texts('inbox').includes('что-то непонятное'));
  assert.match(say('1'), /нечего перекладывать/);
  assert.ok(!texts('inbox').includes('1'));
});

check('одно слово «тт» без вопроса — показать папку', () => {
  const r = say('тт');
  assert.match(r, /\*🎬 Идеи для ТТ\* \(\d+\)\n1\. снять как кот/);
});

check('«все» показывает все папки', () => {
  const r = say('Все');
  assert.match(r, /Идеи для ТТ/); assert.match(r, /В жизнь/); assert.match(r, /Разное/);
});

check('готово / удали по номеру, в т.ч. несколько', () => {
  const tt = texts('tt').length;
  assert.match(say('готово тт 1'), /Сделано.*осталось/);
  assert.equal(texts('tt').length, tt - 1);
  say('тт');
  assert.match(say('удали 1, 2'), /Удалил/); // папку только что смотрели
  assert.equal(texts('tt').length, tt - 3);
  assert.match(say('удали тт 99'), /нет №99/);
  say('все');
  assert.match(say('готово 1'), /Из какой папки/);
});

check('перенеси между папками', () => {
  const life = texts('life').length;
  say('тт: идея для переноса');
  const k = texts('tt').length;
  assert.match(say(`перенеси тт ${k} в жизнь`), /Переложил в 🌱 В жизнь/);
  assert.equal(texts('life').length, life + 1);
  assert.ok(texts('life').includes('идея для переноса'));
  assert.match(say('перенеси 1 в 1'), /Переложил в 🎬 Идеи для ТТ/); // папку можно назвать номером
});

check('свои ответы бота и пустые сообщения пропускаются', () => {
  assert.equal(say('🤖 Записал в «Идеи для ТТ»'), null);
  assert.equal(say('   '), null);
  assert.equal(say(undefined), null);
});

check('помощь', () => {
  assert.match(say('/help'), /Сортировщик идей/);
  assert.match(say('помощь'), /перенеси/);
});

check('всё сохраняется в файл и переживает перезапуск', () => {
  const tt = texts('tt'), life = texts('life');
  bot = createSorter(file);
  assert.deepEqual(texts('tt'), tt);
  assert.deepEqual(texts('life'), life);
});

check('испорченный файл не роняет бота', () => {
  fs.writeFileSync(file, '{не json');
  bot = createSorter(file);
  assert.match(say('тт: новая жизнь'), /№1/);
});

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\nВсе ${n} проверок прошли.`);
