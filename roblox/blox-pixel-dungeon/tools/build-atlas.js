// Собирает спрайты Shattered Pixel Dungeon (third_party/spd) в один атлас 512×512
// и пишет src/shared/Atlas.luau с координатами. В Roblox загружается одна картинка.
//   node tools/build-atlas.js
'use strict';
const fs = require('fs');
const path = require('path');
const png = require('./png');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'third_party', 'spd');
const load = (f) => png.decode(fs.readFileSync(path.join(SRC, f + '.png')));

const SIZE = 512;
const atlas = png.blank(SIZE, SIZE);
const rects = {};

function put(name, img, sx, sy, w, h, dx, dy) {
  png.blit(atlas, img, sx, sy, w, h, dx, dy);
  rects[name] = { x: dx, y: dy, w, h };
}

// левая колонка: тайлы, вода, персонажи; правая: предметы
put('tiles', load('tiles_sewers'), 0, 0, 256, 256, 0, 0);
put('items', load('items'), 0, 0, 256, 512, 256, 0);

let y = 256;
put('water', load('water0'), 0, 0, 32, 32, 0, y);

// иконки панели: рюкзак, часы, лупа — ищем по непрозрачным пикселям
const toolbar = load('toolbar');
let x = 32;
for (const [name, from, to] of [['icon_bag', 150, 176], ['icon_wait', 176, 192], ['icon_search', 192, 210]]) {
  let x0 = 999, x1 = -1, y0 = 999, y1 = -1;
  for (let yy = 0; yy < toolbar.height; yy++)
    for (let xx = from; xx < Math.min(to, toolbar.width); xx++)
      if (toolbar.data[(yy * toolbar.width + xx) * 4 + 3] > 0) {
        x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy);
      }
  put(name, toolbar, x0, y0, x1 - x0 + 1, y1 - y0 + 1, x, y);
  x += x1 - x0 + 2;
}
put('button', toolbar, 0, 0, 24, 26, x, y);
y += 32;

// персонажи: [имя, файл, ширина кадра, высота кадра, сколько строк брать]
const chars = [
  ['warrior', 'warrior', 12, 15, 5],
  ['rat', 'rat', 16, 15, 1],
  ['snake', 'snake', 12, 11, 1],
  ['gnoll', 'gnoll', 12, 15, 1],
  ['crab', 'crab', 16, 16, 1],
  ['slime', 'slime', 14, 12, 1],
  ['goo', 'goo', 20, 14, 1],
];
const film = {};
for (const [name, file, fw, fh, rows] of chars) {
  const img = load(file);
  put(name, img, 0, 0, img.width, fh * rows, 0, y);
  film[name] = { fw, fh, cols: Math.floor(img.width / fw) };
  y += fh * rows;
}
if (y > SIZE) throw new Error('атлас переполнен: ' + y);

fs.mkdirSync(path.join(ROOT, 'assets'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'assets', 'atlas.png'), png.encode(atlas));

const lua = ['-- Сгенерировано tools/build-atlas.js — не править руками.',
  '-- Координаты кусков атласа assets/atlas.png (графика Shattered Pixel Dungeon, GPL-3.0).',
  'local Atlas = {}', '', 'Atlas.SIZE = ' + SIZE, '', 'Atlas.rects = {'];
for (const [k, r] of Object.entries(rects)) lua.push(`\t${k} = { x = ${r.x}, y = ${r.y}, w = ${r.w}, h = ${r.h} },`);
lua.push('}', '', '-- размеры кадров персонажей (как TextureFilm в SPD)', 'Atlas.film = {');
for (const [k, f] of Object.entries(film)) lua.push(`\t${k} = { fw = ${f.fw}, fh = ${f.fh}, cols = ${f.cols} },`);
lua.push('}', '', 'return Atlas', '');
fs.writeFileSync(path.join(ROOT, 'src', 'shared', 'Atlas.luau'), lua.join('\n'));

// тот же PNG в base64 — игра показывает его через EditableImage, если ID картинки не указан
const b64 = fs.readFileSync(path.join(ROOT, 'assets', 'atlas.png')).toString('base64').match(/.{1,120}/g).join('\n');
fs.writeFileSync(path.join(ROOT, 'src', 'shared', 'AtlasData.luau'),
  '-- Сгенерировано tools/build-atlas.js: assets/atlas.png в base64 (графика Shattered Pixel Dungeon, GPL-3.0).\n' +
  'return [[\n' + b64 + '\n]]\n');
console.log('atlas.png готов, занято по высоте:', y);
