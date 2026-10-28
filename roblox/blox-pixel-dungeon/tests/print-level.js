// Печатает сгенерированный этаж символами: node tests/print-level.js [глубина] [зерно]
'use strict';
const { newState, run } = require('./lua.js');

const depth = Number(process.argv[2] || 1);
const seed = Number(process.argv[3] || 42);
const L = newState();
run(L, `
local Rng, LevelGen, T = module('Rng'), module('LevelGen'), module('Terrain')
local lvl = LevelGen.generate(Rng.new(${seed}), ${depth})
local ch = {
  [T.WALL] = '#', [T.WALL_DECO] = '%', [T.EMPTY] = '.', [T.EMPTY_DECO] = ',', [T.DOOR] = '+',
  [T.WATER] = '~', [T.GRASS] = "'", [T.HIGH_GRASS] = '"', [T.ENTRANCE] = '<', [T.EXIT] = '>',
}
for y = 0, lvl.h - 1 do
  local row = {}
  for x = 0, lvl.w - 1 do row[#row + 1] = ch[lvl.map[y * lvl.w + x + 1]] or '?' end
  print(table.concat(row))
end
print('комнат: ' .. #lvl.rooms)
`, 'print-level');
