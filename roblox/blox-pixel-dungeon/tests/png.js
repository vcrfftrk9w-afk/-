// Проверяет распаковщик PNG на Luau: сравнивает с декодером из tools/png.js.
'use strict';
const fs = require('fs');
const path = require('path');
const { newState, run } = require('./lua.js');
const png = require('../tools/png.js');

const ROOT = path.join(__dirname, '..');
const cases = [
  path.join(ROOT, 'assets', 'atlas.png'), // фильтр 0, сжатие zlib node
  path.join(ROOT, 'third_party', 'spd', 'tiles_sewers.png'), // фильтры PNG и сжатие из оригинала
];

let failed = 0;
for (const file of cases) {
  const expected = png.decode(fs.readFileSync(file));
  const b64 = fs.readFileSync(file).toString('base64');
  const L = newState();
  const out = [];
  global.__collect = out;
  run(L, `
    local Png = module('Png')
    local img = Png.decode(Png.base64("${b64}"))
    __w, __h = img.width, img.height
    local parts = {}
    for i = 1, img.width * img.height * 4 do parts[i] = string.char(img.get(i)) end
    __px = table.concat(parts)
  `, 'png-test');
  const { lua, to_luastring } = require('fengari');
  lua.lua_getglobal(L, to_luastring('__px'));
  const got = Buffer.from(lua.lua_tostring(L, -1));
  const ok = got.length === expected.data.length && got.equals(expected.data);
  console.log(path.basename(file), ok ? 'совпадает' : 'НЕ СОВПАДАЕТ');
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
