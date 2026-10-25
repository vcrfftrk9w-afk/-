-- Прогон ядра без Roblox: luau tests/sim_test.luau
local Config = require("../src/shared/Config")
local Core = require("../src/shared/Core")

local function check(cond, msg)
	if not cond then
		error("ПРОВАЛ: " .. msg, 2)
	end
end

-- 1. карта
local core = Core.new(Config, 12345)
check(core.landCount > 0.45 * Config.MAP_W * Config.MAP_H, "суши слишком мало: " .. core.landCount)
local coast = 0
for i = 1, Config.MAP_W * Config.MAP_H do
	if core.coastal[i] then coast += 1 end
end
print(string.format("карта: суша %d клеток, берег %d", core.landCount, coast))

-- 2. игрок + боты, выбор места
local me = core:addNation("Игрок", false, 1)
for _ = 2, Config.NATIONS do
	core:addNation(nil, true)
end
local spawnTile
for i = 1, Config.MAP_W * Config.MAP_H do
	local x, y = core:xy(i)
	local nearCoast = x > 1 and y > 1 and x < Config.MAP_W - 2 and y < Config.MAP_H - 2
		and (core.coastal[i + 2] or core.coastal[i - 2] or core.coastal[i + 2 * Config.MAP_W])
	if core.terrain[i] == Core.PLAIN and nearCoast and core:canSpawnAt(me, i) then spawnTile = i break end
end
check(core:spawn(me, spawnTile), "спавн игрока")
check(core.nations[me].tiles > 5, "стартовая земля")
local ok, msg = core:attackTile(me, spawnTile, 0.5)
check(not ok, "атака до начала матча должна отклоняться")

local events = {}
local function run(seconds, dt)
	local t = 0
	while t < seconds and core.phase ~= "over" do
		core:step(dt)
		t += dt
		for _, e in ipairs(core:takeEvents()) do
			events[e.type] = (events[e.type] or 0) + 1
		end
		core:takeDirty()
	end
end
run(Config.SPAWN_TIME + 0.5, 0.1)
check(core.phase == "play", "фаза play после выбора места")
local spawned = 0
for _, n in ipairs(core.nations) do
	if n.spawned then spawned += 1 end
end
check(spawned == Config.NATIONS, "все страны появились: " .. spawned)

-- 3. действия игрока
local n = core.nations[me]
local neutral
for _, t in ipairs(core:frontier(me, 0)) do neutral = t break end
check(neutral, "есть нейтральный сосед")
check(core:attackTile(me, neutral, 0.5), "атака на нейтральную землю")
n.gold = 100000
local inner
for t in pairs(core.tilesOf[me]) do inner = t break end
check(core:build(me, inner, "City"), "город")
check(core:build(me, inner, "City"), "улучшение города")
check(core.buildings[inner].level == 2, "уровень города 2")
local okp, mp = core:build(me, inner, "Port")
check(not okp, "порт на занятой клетке нельзя")
local coastMine
for t in pairs(core.tilesOf[me]) do
	if core.coastal[t] and not core.buildings[t] then coastMine = t break end
end
check(core:build(me, coastMine, "Port"), "порт на берегу")
-- щит: атаковать страну нельзя
local enemyTile
for i = 1, Config.MAP_W * Config.MAP_H do
	if core.owner[i] > 1 then enemyTile = i break end
end
local okA, mA = core:attackTile(me, enemyTile, 0.5)
check(not okA and mA:find("Щит"), "щит защищает страны: " .. tostring(mA))
-- союз с ботом
local target = core.owner[enemyTile]
check(core:requestAlliance(me, target), "запрос союза")

-- 4. долгая игра ботами
local before = os.clock()
run(Config.MATCH_TIME + 5, 0.1)
local elapsed = os.clock() - before
local lb = {}
for _, x in ipairs(core.nations) do table.insert(lb, x) end
table.sort(lb, function(a, b) return a.tiles > b.tiles end)
print(string.format("матч: фаза %s, время %.0f с, расчёт занял %.1f с процессора", core.phase, core.time, elapsed))
for k = 1, 5 do
	local x = lb[k]
	print(string.format("  %d. %s: %d клеток (%.0f%%), войск %d, золото %d, жива=%s, предательств %d", k, x.name, x.tiles, x.tiles / core.landCount * 100, x.troops, x.gold, tostring(x.alive), x.betrayals))
end
local keys = {}
for k, v in pairs(events) do table.insert(keys, k .. "=" .. v) end
table.sort(keys)
print("события: " .. table.concat(keys, ", "))
check(core.phase == "over", "матч должен закончиться")
check(core.winner ~= nil, "есть победитель")
for _, kind in ipairs({ "ship", "building", "eliminated" }) do
	check((events[kind] or 0) > 0, "были события " .. kind)
end
-- целостность: счётчики клеток совпадают с картой
for _, x in ipairs(core.nations) do
	local c = 0
	for _ in pairs(core.tilesOf[x.id]) do c += 1 end
	check(c == x.tiles, "счётчик клеток " .. x.name)
end
for i = 1, Config.MAP_W * Config.MAP_H do
	local o = core.owner[i]
	if o > 0 then check(core.tilesOf[o][i], "tilesOf согласован") end
end
print("ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ")
