// Бот играет много партий через то же API, что и интерфейс Roblox.
// Ловит ошибки Lua и проверяет инварианты.  node tests/sim.js [партий] [начальное зерно]
'use strict';
const { newState, run } = require('./lua.js');

const games = Number(process.argv[2] || 40);
const seed0 = Number(process.argv[3] || 1);

const BOT = `
local Game, T, Defs = module('Game'), module('Terrain'), module('Defs')

local function check(g)
  local hero = g.hero
  assert(hero.hp <= hero.ht, 'hp > ht')
  assert(T.passable(g.level.map[hero.pos]), 'герой в стене')
  local occupied = { [hero.pos] = true }
  for _, m in ipairs(g.mobs) do
    assert(m.hp > 0, 'мёртвый монстр в списке')
    assert(T.passable(g.level.map[m.pos]), 'монстр в стене: ' .. m.type)
    assert(not occupied[m.pos], 'двое в одной клетке')
    occupied[m.pos] = true
  end
  assert(#hero.bag <= Game.BAG_SIZE, 'рюкзак переполнен')
  for _, e in ipairs(g:takeEvents()) do
    assert(type(e.type) == 'string', 'событие без типа')
    if e.type == 'log' then assert(type(e.text) == 'string', 'пустой лог') end
  end
end

local function findInBag(g, pred)
  for _, it in ipairs(g.hero.bag) do
    if pred(it) then return it end
  end
end

-- ближайшая цель: предмет, неисследованная клетка или выход
local function explore(g)
  local lvl = g.level
  local map, w = lvl.map, lvl.w
  local start = g.hero.pos
  local dist, queue, head = { [start] = 0 }, { start }, 1
  local exitPos
  local frontier
  while head <= #queue do
    local cur = queue[head]; head = head + 1
    if cur ~= start and g.heaps[cur] then return cur end
    if map[cur] == T.EXIT then exitPos = cur end
    local x, y = (cur - 1) % w, math.floor((cur - 1) / w)
    for dy = -1, 1 do for dx = -1, 1 do
      local nx, ny = x + dx, y + dy
      if nx >= 0 and ny >= 0 and nx < w and ny < lvl.h then
        local n = ny * w + nx + 1
        if not g.visited[n] and not frontier and cur ~= start then frontier = cur end
        if dist[n] == nil and T.passable(map[n]) and (g.visited[n] or g.mapped[n]) then
          dist[n] = dist[cur] + 1
          queue[#queue + 1] = n
        end
      end
    end end
  end
  if frontier and not (exitPos and g.hero.hunger > 200) then return frontier end
  return exitPos or lvl.exit
end

local function botTurn(g, rng)
  local hero = g.hero
  -- еда
  if hero.hunger >= 300 then
    local food = findInBag(g, function(it) return it.kind == 'food' end)
    if food then g:useItem(food, 'eat'); return end
  end
  -- лечение
  if hero.hp < hero.ht * 0.35 and not hero.buffs.healing then
    local p = findInBag(g, function(it) return it.kind == 'potion' and it.type == 'healing' and g.known.healing end)
    if p then g:useItem(p, 'drink'); return end
  end
  -- пробовать неизвестные зелья и свитки
  local unknown = findInBag(g, function(it) return (it.kind == 'potion' or it.kind == 'scroll') and not g:isKnown(it) end)
  if unknown and rng() < 0.2 then
    local action = unknown.kind == 'potion' and 'drink' or 'read'
    local res = g:useItem(unknown, action)
    if res and res.needTarget then
      local target = (res.needTarget == 'upgradable') and hero.weapon or findInBag(g, function(it) return g:canTarget(res.needTarget, it) end)
      if target then g:useItem(unknown, action, target) end
    end
    return
  end
  local up = findInBag(g, function(it) return it.kind == 'scroll' and it.type == 'upgrade' and g.known.upgrade end)
  if up then g:useItem(up, 'read', hero.armor or hero.weapon); return end
  local str = findInBag(g, function(it) return it.kind == 'potion' and it.type == 'strength' and g.known.strength end)
  if str then g:useItem(str, 'drink'); return end
  -- снаряжение получше
  local better = findInBag(g, function(it)
    if it.kind == 'armor' then return Defs.armors[it.type].tier <= (hero.str - 8) / 2 and Defs.armors[it.type].tier > Defs.armors[hero.armor.type].tier end
    if it.kind == 'weapon' then return Defs.weapons[it.type].tier <= (hero.str - 8) / 2 and Defs.weapons[it.type].tier > Defs.weapons[hero.weapon.type].tier end
  end)
  if better then g:useItem(better, 'equip'); return end
  if #hero.bag >= Game.BAG_SIZE - 1 then
    local junk = findInBag(g, function(it) return it.kind == 'weapon' or it.kind == 'armor' end)
    if junk then g:useItem(junk, 'drop'); return end
  end
  -- бой
  local enemies = g:visibleEnemies()
  if #enemies > 0 then
    g:heroTravel(enemies[1].pos)
    return
  end
  if hero.hp < hero.ht * 0.6 then g:heroRest(); return end
  local target = explore(g)
  if not g:heroTravel(target) and g.hero.pos ~= target then
    -- путь неизвестен: шаг в случайную сторону
    local d = { -1, 0, 1 }
    g:heroStep(d[math.floor(rng() * 3) + 1], d[math.floor(rng() * 3) + 1])
  end
end

function playGame(seed)
  local g = Game.new(seed)
  local x = seed * 7919 % 2147483647
  local function rng() x = x * 48271 % 2147483647; return x / 2147483647 end
  local turns = 0
  while not g.over and turns < 6000 do
    botTurn(g, rng)
    check(g)
    turns = turns + 1
  end
  return g.depth, g.won, g.over, g.hero.lvl, g.stats.kills, g.deathCause or '', turns
end
`;

const L = newState();
run(L, BOT, 'bot');
const { lua, to_luastring, to_jsstring } = require('fengari');
let wins = 0, deaths = 0, stuck = 0, errors = 0;
const depths = {};
for (let s = seed0; s < seed0 + games; s++) {
  lua.lua_getglobal(L, to_luastring('playGame'));
  lua.lua_pushinteger(L, s);
  if (lua.lua_pcall(L, 1, 7, 0) !== lua.LUA_OK) {
    errors++;
    console.log(`зерно ${s}: ОШИБКА ${to_jsstring(lua.lua_tostring(L, -1))}`);
    lua.lua_pop(L, 1);
    continue;
  }
  const depth = lua.lua_tointeger(L, -7), won = lua.lua_toboolean(L, -6), over = lua.lua_toboolean(L, -5);
  const lvl = lua.lua_tointeger(L, -4), kills = lua.lua_tointeger(L, -3), cause = to_jsstring(lua.lua_tostring(L, -2));
  const turns = lua.lua_tointeger(L, -1);
  lua.lua_pop(L, 7);
  depths[depth] = (depths[depth] || 0) + 1;
  if (won) wins++; else if (over) deaths++; else stuck++;
  if (process.env.VERBOSE) console.log(`зерно ${s}: глубина ${depth}, ур ${lvl}, убито ${kills}, ходов ${turns} ${won ? 'ПОБЕДА' : over ? cause : 'не закончил'}`);
}
console.log(`партий ${games}: побед ${wins}, смертей ${deaths}, не закончили ${stuck}, ошибок ${errors}`);
console.log('где закончили:', JSON.stringify(depths));
process.exit(errors ? 1 : 0);
