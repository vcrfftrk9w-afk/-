// Рисует этаж в PNG теми же правилами тайлов, что и игра: node tests/render-level.js out.png [глубина] [зерно]
'use strict';
const fs = require('fs');
const path = require('path');
const { newState, run } = require('./lua.js');
const png = require('../tools/png.js');
const { lua, to_luastring, to_jsstring } = require('fengari');

const out = process.argv[2] || 'level.png';
const depth = Number(process.argv[3] || 1);
const seed = Number(process.argv[4] || 42);
const L = newState();
run(L, `
local Game, Tiles = module('Game'), module('Tiles')
local g = Game.new(${seed})
while g.depth < ${depth} do g:enterDepth(g.depth + 1, true) end
local lvl = g.level
local rows = {}
for i = 1, lvl.w * lvl.h do
  local x, y = (i - 1) % lvl.w, math.floor((i - 1) / lvl.w)
  local below = i + lvl.w <= lvl.w * lvl.h and lvl.variance[i + lvl.w] or 0
  rows[#rows + 1] = table.concat({ Tiles.ground(lvl.map, lvl.w, lvl.h, i, lvl.variance[i]),
    Tiles.upper(lvl.map, lvl.w, lvl.h, i, lvl.variance[i], below), lvl.map[i] == 29 and 1 or 0 }, ',')
end
local mobs = {}
for _, m in ipairs(g.mobs) do mobs[#mobs + 1] = m.type .. ',' .. m.pos end
__out = lvl.w .. ';' .. lvl.h .. ';' .. table.concat(rows, ' ') .. ';' .. table.concat(mobs, ' ') .. ';' .. g.hero.pos
`, 'render');
lua.lua_getglobal(L, to_luastring('__out'));
const [w, h, cells, mobs, heroPos] = to_jsstring(lua.lua_tostring(L, -1)).split(';');
const W = Number(w), H = Number(h);
const atlas = png.decode(fs.readFileSync(path.join(__dirname, '..', 'assets', 'atlas.png')));
const img = png.blank(W * 16, H * 16);

function draw(sx, sy, sw, sh, dx, dy) {
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const s = ((sy + y) * atlas.width + sx + x) * 4;
    const a = atlas.data[s + 3] / 255;
    if (a === 0) continue;
    const d = ((dy + y) * img.width + dx + x) * 4;
    if (dx + x < 0 || dy + y < 0 || dx + x >= img.width || dy + y >= img.height) continue;
    for (let c = 0; c < 3; c++) img.data[d + c] = Math.round(atlas.data[s + c] * a + img.data[d + c] * (1 - a));
    img.data[d + 3] = 255;
  }
}
const list = cells.split(' ').map((c) => c.split(',').map(Number));
list.forEach(([g, , water], i) => {
  const x = (i % W) * 16, y = Math.floor(i / W) * 16;
  if (water) draw((x / 16 % 2) * 16, 256 + (y / 16 % 2) * 16, 16, 16, x, y);
  if (g >= 0) draw((g % 16) * 16, Math.floor(g / 16) * 16, 16, 16, x, y);
});
const film = { rat: [16, 15, 363], snake: [12, 11, 378], gnoll: [12, 15, 389], crab: [16, 16, 404], slime: [14, 12, 420], goo: [20, 14, 432] };
for (const m of mobs.split(' ').filter(Boolean)) {
  const [type, pos] = m.split(',');
  const [fw, fh, ay] = film[type];
  const p = Number(pos) - 1;
  draw(0, ay, fw, fh, (p % W) * 16 + (16 - fw) / 2, Math.floor(p / W) * 16 + 16 - fh - 6 + 6);
}
const hp = Number(heroPos) - 1;
draw(0, 288 + 15, 12, 15, (hp % W) * 16 + 2, Math.floor(hp / W) * 16 + 1);
list.forEach(([, u], i) => {
  if (u >= 0) draw((u % 16) * 16, Math.floor(u / 16) * 16, 16, 16, (i % W) * 16, Math.floor(i / W) * 16);
});
fs.writeFileSync(out, png.encode(img));
console.log('сохранено', out);
