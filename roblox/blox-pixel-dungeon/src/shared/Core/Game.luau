-- Ядро игры: герой, монстры, предметы, ходы. Никаких API Roblox — только логика.
-- Формулы боя, голода, регенерации и поведение монстров перенесены из
-- Shattered Pixel Dungeon (Char.java, Hero.java, Mob.java, Hunger.java, Goo.java ...).
-- Отрисовка получает изменения через список событий game.events.
local Rng = require(script.Parent.Rng)
local Terrain = require(script.Parent.Terrain)
local LevelGen = require(script.Parent.LevelGen)
local Fov = require(script.Parent.Fov)
local Defs = require(script.Parent.Defs)

local T = Terrain
local Game = {}
Game.__index = Game

Game.MAX_DEPTH = 5
Game.BAG_SIZE = 20
local VIEW = 8
local STEALTH = 1
local HUNGRY, STARVING = 300, 450
local BUFF_TIME = 20

local DIRS8 = { { -1, -1 }, { 0, -1 }, { 1, -1 }, { -1, 0 }, { 1, 0 }, { -1, 1 }, { 0, 1 }, { 1, 1 } }

local COLOR = {
	info = "white",
	good = "good",
	bad = "bad",
	warn = "warn",
	high = "high",
}
Game.COLOR = COLOR

------------------------------------------------------------------ сетка

function Game:xy(i)
	local w = self.level.w
	return (i - 1) % w, math.floor((i - 1) / w)
end

function Game:idx(x, y)
	return y * self.level.w + x + 1
end

function Game:inside(x, y)
	return x >= 0 and y >= 0 and x < self.level.w and y < self.level.h
end

function Game:dist(a, b)
	local ax, ay = self:xy(a)
	local bx, by = self:xy(b)
	return math.max(math.abs(ax - bx), math.abs(ay - by))
end

function Game:terrain(i)
	return self.level.map[i]
end

function Game:setTerrain(i, t)
	if self.level.map[i] ~= t then
		self.level.map[i] = t
		self:emit({ type = "tile", pos = i })
		self.fovDirty = true
	end
end

------------------------------------------------------------------ события и журнал

function Game:emit(e)
	self.events[#self.events + 1] = e
end

function Game:log(text, color)
	self:emit({ type = "log", text = text, color = color or COLOR.info })
end

function Game:status(ch, text, color)
	self:emit({ type = "status", id = ch.id, text = text, color = color or COLOR.info })
end

function Game:takeEvents()
	local e = self.events
	self.events = {}
	return e
end

------------------------------------------------------------------ предметы

local itemUid = 0

function Game:makeItem(kind, typ, level, qty)
	itemUid = itemUid + 1
	return { uid = itemUid, kind = kind, type = typ, level = level or 0, qty = qty or 1, known = false }
end

local function weaponMin(def, lvl)
	return math.max(0, def.tier + lvl)
end

local function weaponMax(def, lvl)
	if def.maxBase then
		return math.max(1, def.maxBase + lvl * def.maxLvl)
	end
	return math.max(1, 5 * (def.tier + 1) + lvl * (def.tier + 1))
end

local function strReq(tier, lvl)
	lvl = math.max(0, lvl)
	return 8 + tier * 2 - math.floor(math.floor(math.sqrt(8 * lvl + 1) - 1) / 2)
end

local function armorDr(tier, lvl)
	local max = math.max(0, tier * (2 + lvl))
	local min = math.max(0, math.min(lvl, max))
	return min, max
end

function Game:itemDef(item)
	if item.kind == "weapon" then
		return Defs.weapons[item.type]
	elseif item.kind == "armor" then
		return Defs.armors[item.type]
	elseif item.kind == "potion" then
		return Defs.potions[item.type]
	elseif item.kind == "scroll" then
		return Defs.scrolls[item.type]
	elseif item.kind == "food" then
		return Defs.food[item.type]
	end
	return nil
end

function Game:isKnown(item)
	if item.kind == "potion" or item.kind == "scroll" then
		return self.known[item.type] == true
	elseif item.kind == "weapon" or item.kind == "armor" then
		return item.known
	end
	return true
end

function Game:itemName(item)
	if item.kind == "gold" then
		return item.qty .. " золота"
	end
	local def = self:itemDef(item)
	if item.kind == "potion" and not self.known[item.type] then
		return Defs.potionColors[self.potionLook[item.type]].name
	elseif item.kind == "scroll" and not self.known[item.type] then
		return Defs.scrollRunes[self.scrollLook[item.type]].name
	end
	local name = def.name
	if (item.kind == "weapon" or item.kind == "armor") and item.known and item.level ~= 0 then
		name = name .. (item.level > 0 and " +" or " ") .. item.level
	end
	return name
end

function Game:itemIcon(item)
	if item.kind == "gold" then
		return Defs.GOLD_ICON
	elseif item.kind == "potion" then
		return Defs.POTION_ICON + self.potionLook[item.type] - 1
	elseif item.kind == "scroll" then
		return Defs.SCROLL_ICON + self.scrollLook[item.type] - 1
	end
	return self:itemDef(item).icon
end

function Game:itemDesc(item)
	if item.kind == "gold" then
		return "Кучка золотых монет. Собирайте их, чтобы потом похвастаться богатством."
	end
	local def = self:itemDef(item)
	local hero = self.hero
	if item.kind == "potion" and not self.known[item.type] then
		return "Этот пузырёк содержит какое-то зелье. Интересно, что будет, если его выпить?"
	elseif item.kind == "scroll" and not self.known[item.type] then
		return "Этот манускрипт покрыт непонятными письменами, озаглавленными неизвестной вам руной. Кто знает, что будет, если прочитать его вслух?"
	end
	local text = def.desc
	if item.kind == "weapon" then
		local lvl = item.known and item.level or 0
		local req = strReq(def.tier, lvl)
		text = text .. string.format("\n\nУрон: %d–%d. Тир %d. Нужно силы: %d.", weaponMin(def, lvl), weaponMax(def, lvl), def.tier, req)
		if not item.known then
			text = text .. "\nВы ещё не знаете, улучшено ли это оружие."
		end
		if req > hero.str then
			text = text .. "\nВам не хватает силы: оружие будет бить медленнее и реже попадать."
		elseif hero.str > req then
			text = text .. string.format("\nИзбыток силы даст до +%d урона.", hero.str - req)
		end
	elseif item.kind == "armor" then
		local lvl = item.known and item.level or 0
		local min, max = armorDr(def.tier, lvl)
		local req = strReq(def.tier, lvl)
		text = text .. string.format("\n\nБлокирует %d–%d урона. Тир %d. Нужно силы: %d.", min, max, def.tier, req)
		if not item.known then
			text = text .. "\nВы ещё не знаете, улучшена ли эта броня."
		end
		if req > hero.str then
			text = text .. "\nВам не хватает силы: в ней вы будете медленнее и неуклюжее."
		end
	end
	return text
end

function Game:itemActions(item, equipped)
	local list = {}
	if item.kind == "weapon" or item.kind == "armor" then
		if equipped then
			list[#list + 1] = { id = "unequip", label = "Снять" }
		else
			list[#list + 1] = { id = "equip", label = "Надеть" }
		end
	elseif item.kind == "potion" then
		list[#list + 1] = { id = "drink", label = "Выпить" }
	elseif item.kind == "scroll" then
		list[#list + 1] = { id = "read", label = "Прочитать" }
	elseif item.kind == "food" then
		list[#list + 1] = { id = "eat", label = "Съесть" }
	end
	if not equipped then
		list[#list + 1] = { id = "drop", label = "Бросить" }
	end
	return list
end

-- можно ли сложить в одну ячейку
local function stackable(item)
	return item.kind == "potion" or item.kind == "scroll" or item.kind == "food"
end

function Game:addToBag(item)
	local hero = self.hero
	if item.kind == "gold" then
		hero.gold = hero.gold + item.qty
		return true
	end
	if stackable(item) then
		for _, it in ipairs(hero.bag) do
			if it.kind == item.kind and it.type == item.type then
				it.qty = it.qty + item.qty
				return true
			end
		end
	end
	if #hero.bag >= Game.BAG_SIZE then
		return false
	end
	hero.bag[#hero.bag + 1] = item
	return true
end

function Game:removeOne(item)
	local bag = self.hero.bag
	for i, it in ipairs(bag) do
		if it == item then
			if it.qty > 1 then
				it.qty = it.qty - 1
				local one = self:makeItem(it.kind, it.type, it.level, 1)
				one.known = it.known
				return one
			end
			table.remove(bag, i)
			return it
		end
	end
	return nil
end

function Game:dropToHeap(pos, item)
	local heap = self.heaps[pos]
	if not heap then
		heap = {}
		self.heaps[pos] = heap
	end
	heap[#heap + 1] = item
	self:emit({ type = "heap", pos = pos })
end

function Game:randomItem()
	local rng = self.rng
	local cat = rng:chances(Defs.itemCategories)
	if cat == "potion" then
		local w = {}
		for k, d in pairs(Defs.potions) do
			if d.weight > 0 then
				w[k] = d.weight
			end
		end
		return self:makeItem("potion", rng:chances(w))
	elseif cat == "scroll" then
		local w = {}
		for k, d in pairs(Defs.scrolls) do
			if d.weight > 0 then
				w[k] = d.weight
			end
		end
		return self:makeItem("scroll", rng:chances(w))
	elseif cat == "weapon" then
		return self:randomWeapon(rng:float() < 0.75 and 2 or 3)
	elseif cat == "armor" then
		local roll = rng:float()
		local typ = roll < 0.75 and "leather" or (roll < 0.95 and "mail" or "scale")
		return self:makeItem("armor", typ, self:randomUpgrades())
	elseif cat == "food" then
		return self:makeItem("food", rng:chance(0.7) and "ration" or "meat")
	end
	return self:makeGold()
end

function Game:randomUpgrades()
	local n = 0
	if self.rng:int(4) == 0 then
		n = n + 1
		if self.rng:int(5) == 0 then
			n = n + 1
		end
	end
	return n
end

function Game:randomWeapon(tier, level)
	return self:makeItem("weapon", self.rng:pick(Defs.weaponsByTier[tier]), level or self:randomUpgrades())
end

function Game:makeGold()
	local d = self.depth
	return self:makeItem("gold", "gold", 0, self.rng:intRange(30 + d * 10, 60 + d * 20))
end

------------------------------------------------------------------ создание игры

function Game.new(seed)
	local g = setmetatable({}, Game)
	g.seed = seed or os.time()
	g.rng = Rng.new(g.seed)
	g.events = {}
	g.levels = {}
	g.nextId = 1
	g.turnAcc = 0
	g.over, g.won = false, false

	-- случайные цвета зелий и руны свитков на эту игру
	g.potionLook, g.scrollLook = {}, {}
	local colors, runes = {}, {}
	for i = 1, #Defs.potionColors do
		colors[i] = i
	end
	for i = 1, #Defs.scrollRunes do
		runes[i] = i
	end
	g.rng:shuffle(colors)
	g.rng:shuffle(runes)
	local pk, sk = {}, {}
	for k in pairs(Defs.potions) do
		pk[#pk + 1] = k
	end
	for k in pairs(Defs.scrolls) do
		sk[#sk + 1] = k
	end
	table.sort(pk)
	table.sort(sk)
	for i, k in ipairs(pk) do
		g.potionLook[k] = colors[i]
	end
	for i, k in ipairs(sk) do
		g.scrollLook[k] = runes[i]
	end
	-- воин с самого начала знает эти предметы
	g.known = { healing = true, identify = true, rage = true }

	g.hero = {
		id = 0,
		isHero = true,
		hp = 20,
		ht = 20,
		str = 10,
		lvl = 1,
		exp = 0,
		atk = 10,
		def = 5,
		time = 0,
		gold = 0,
		hunger = 0,
		regen = 0,
		starveDmg = 0,
		buffs = {},
		bag = {},
	}
	local hero = g.hero
	hero.weapon = g:makeItem("weapon", "wornshortsword")
	hero.weapon.known = true
	hero.armor = g:makeItem("armor", "cloth")
	hero.armor.known = true
	g:addToBag(g:makeItem("food", "ration"))
	g:addToBag(g:makeItem("potion", "healing"))
	g.stats = { kills = 0, deepest = 1, turns = 0 }

	g:enterDepth(1, true)
	g:log("Добро пожаловать на 1 уровень подземелья!", COLOR.high)
	return g
end

------------------------------------------------------------------ этажи

function Game:spawnMob(typ, pos, state)
	local def = Defs.mobs[typ]
	local m = {
		id = self.nextId,
		type = typ,
		def = def,
		pos = pos,
		hp = def.ht,
		ht = def.ht,
		state = state or "sleeping",
		time = self.hero.time,
		speed = def.speed,
		pumped = 0,
	}
	self.nextId = self.nextId + 1
	self.mobs[#self.mobs + 1] = m
	self:emit({ type = "spawn", id = m.id })
	return m
end

function Game:mobAt(pos)
	for _, m in ipairs(self.mobs) do
		if m.pos == pos then
			return m
		end
	end
	return nil
end

function Game:charAt(pos)
	if self.hero.pos == pos then
		return self.hero
	end
	return self:mobAt(pos)
end

function Game:randomCell(filter, tries)
	local lvl = self.level
	for _ = 1, tries or 300 do
		local i = self.rng:intRange(1, lvl.w * lvl.h)
		if T.passable(lvl.map[i]) and not self:charAt(i) and (not filter or filter(i)) then
			return i
		end
	end
	return nil
end

function Game:mobLimit()
	if self.depth <= 1 or self.level.boss then
		return 0
	end
	return 3 + self.depth % 5 + self.rng:int(3)
end

function Game:populate()
	local lvl = self.level
	if lvl.boss then
		local goo = self:spawnMob("goo", lvl.bossPos, "sleeping")
		goo.boss = true
		return
	end
	local count = self.depth == 1 and 8 or self:mobLimit()
	local rotation = Defs.rotation[math.min(self.depth, 4)]
	local entranceRoom = lvl.roomOf[lvl.entrance]
	for _ = 1, count do
		local pos = self:randomCell(function(i)
			return lvl.roomOf[i] ~= nil and lvl.roomOf[i] ~= entranceRoom and self:dist(i, lvl.entrance) > VIEW
		end)
		if pos then
			self:spawnMob(self.rng:pick(rotation), pos, self.rng:chance(0.75) and "sleeping" or "wandering")
		end
	end

	local items = {}
	local n = 3
	while self.rng:float() < 0.3 do
		n = n + 1
	end
	for _ = 1, n do
		items[#items + 1] = self:randomItem()
	end
	for _, g in ipairs(Defs.guaranteed[self.depth] or {}) do
		items[#items + 1] = self:makeItem(g[1], g[2])
	end
	for _, item in ipairs(items) do
		if item.kind == "weapon" or item.kind == "armor" then
			item.known = false
		end
		local pos = self:randomCell(function(i)
			return lvl.roomOf[i] ~= nil and i ~= lvl.entrance and i ~= lvl.exit
		end)
		if pos then
			self.heaps[pos] = self.heaps[pos] or {}
			table.insert(self.heaps[pos], item)
		end
	end
end

function Game:saveDepth()
	if self.level then
		self.levels[self.depth] = {
			level = self.level,
			mobs = self.mobs,
			heaps = self.heaps,
			visited = self.visited,
			mapped = self.mapped,
		}
	end
end

function Game:enterDepth(depth, down)
	self:saveDepth()
	self.depth = depth
	local saved = self.levels[depth]
	if saved then
		self.level, self.mobs, self.heaps = saved.level, saved.mobs, saved.heaps
		self.visited, self.mapped = saved.visited, saved.mapped
		for _, m in ipairs(self.mobs) do
			m.time = self.hero.time
		end
	else
		self.level = LevelGen.generate(self.rng, depth)
		self.mobs, self.heaps, self.visited, self.mapped = {}, {}, {}, {}
		self.hero.pos = self.level.entrance
		self:populate()
	end
	self.distCache, self.distCacheSize = {}, 0
	self.respawn = 0
	local hero = self.hero
	hero.pos = down and self.level.entrance or self.level.exit
	local m = self:mobAt(hero.pos)
	if m then
		for _, d in ipairs(DIRS8) do
			local x, y = self:xy(hero.pos)
			local n = self:idx(x + d[1], y + d[2])
			if T.passable(self.level.map[n]) and not self:charAt(n) then
				m.pos = n
				break
			end
		end
	end
	self.stats.deepest = math.max(self.stats.deepest, depth)
	self:updateFov()
	self:emit({ type = "level", depth = depth })
end

------------------------------------------------------------------ обзор

function Game:updateFov()
	local lvl = self.level
	local fov = {}
	local map, w = lvl.map, lvl.w
	local hx, hy = self:xy(self.hero.pos)
	Fov.compute(hx, hy, VIEW, lvl.w, lvl.h, function(x, y)
		return T.losBlocking(map[y * w + x + 1])
	end, function(x, y)
		fov[y * w + x + 1] = true
	end)
	-- стены видно, только если рядом видна проходимая клетка: иначе через угол
	self.fov = fov
	local newEnemy = false
	self.seen = self.seen or {}
	for i in pairs(fov) do
		self.visited[i] = true
	end
	for _, m in ipairs(self.mobs) do
		local vis = fov[m.pos] == true
		if vis and not self.seen[m.id] then
			newEnemy = true
		end
		self.seen[m.id] = vis or nil
	end
	if newEnemy then
		self.interrupted = true
	end
	self.fovDirty = false
	self:emit({ type = "fov" })
end

function Game:heroSees(pos)
	return self.fov[pos] == true
end

function Game:mobVisible(m)
	return self.fov[m.pos] == true or self.hero.buffs.mindvision ~= nil
end

function Game:visibleEnemies()
	local list = {}
	for _, m in ipairs(self.mobs) do
		if self.fov[m.pos] then
			list[#list + 1] = m
		end
	end
	table.sort(list, function(a, b)
		return self:dist(a.pos, self.hero.pos) < self:dist(b.pos, self.hero.pos)
	end)
	return list
end

------------------------------------------------------------------ пути

-- карта расстояний до target по проходимым клеткам (кешируется: проходимость не меняется)
function Game:distMap(target)
	local cached = self.distCache[target]
	if cached then
		return cached
	end
	local map, w = self.level.map, self.level.w
	local dist = { [target] = 0 }
	local queue, head = { target }, 1
	while head <= #queue do
		local cur = queue[head]
		head = head + 1
		local x, y = (cur - 1) % w, math.floor((cur - 1) / w)
		local d = dist[cur] + 1
		for _, dd in ipairs(DIRS8) do
			local nx, ny = x + dd[1], y + dd[2]
			if nx >= 0 and ny >= 0 and nx < w and ny < self.level.h then
				local n = ny * w + nx + 1
				if dist[n] == nil and T.passable(map[n]) then
					dist[n] = d
					queue[#queue + 1] = n
				end
			end
		end
	end
	if self.distCacheSize > 60 then
		self.distCache, self.distCacheSize = {}, 0
	end
	self.distCache[target] = dist
	self.distCacheSize = self.distCacheSize + 1
	return dist
end

-- следующий шаг монстра к цели; занятые клетки обходит
function Game:stepToward(m, target)
	local dist = self:distMap(target)
	local here = dist[m.pos]
	if here == nil then
		return nil
	end
	local x, y = self:xy(m.pos)
	local best, bestD = nil, here
	for _, d in ipairs(DIRS8) do
		local nx, ny = x + d[1], y + d[2]
		if self:inside(nx, ny) then
			local n = self:idx(nx, ny)
			local nd = dist[n]
			if nd and nd < bestD and not self:charAt(n) then
				best, bestD = n, nd
			end
		end
	end
	return best
end

-- путь героя только по известным клеткам
function Game:heroPathStep(target)
	local lvl = self.level
	local map, w = lvl.map, lvl.w
	local known = function(i)
		return (self.visited[i] or self.mapped[i]) and T.passable(map[i])
	end
	if not known(target) then
		return nil
	end
	local dist = { [target] = 0 }
	local queue, head = { target }, 1
	local start = self.hero.pos
	while head <= #queue do
		local cur = queue[head]
		head = head + 1
		if cur == start then
			break
		end
		local x, y = (cur - 1) % w, math.floor((cur - 1) / w)
		for _, dd in ipairs(DIRS8) do
			local nx, ny = x + dd[1], y + dd[2]
			if nx >= 0 and ny >= 0 and nx < w and ny < lvl.h then
				local n = ny * w + nx + 1
				if dist[n] == nil and (known(n) or n == start) then
					local m = self:mobAt(n)
					if not (m and self.fov[n] and n ~= target) then
						dist[n] = dist[cur] + 1
						queue[#queue + 1] = n
					end
				end
			end
		end
	end
	if dist[start] == nil then
		return nil
	end
	local x, y = self:xy(start)
	local best, bestD = nil, dist[start]
	for _, d in ipairs(DIRS8) do
		local nx, ny = x + d[1], y + d[2]
		if self:inside(nx, ny) then
			local n = self:idx(nx, ny)
			if dist[n] and dist[n] < bestD then
				best, bestD = n, dist[n]
			end
		end
	end
	return best
end

-- прямая видимость для атаки Гу на 2 клетки (как Ballistica)
function Game:clearLine(a, b)
	local ax, ay = self:xy(a)
	local bx, by = self:xy(b)
	local dx, dy = bx - ax, by - ay
	local steps = math.max(math.abs(dx), math.abs(dy))
	for s = 1, steps - 1 do
		local x = ax + math.floor(dx * s / steps + 0.5)
		local y = ay + math.floor(dy * s / steps + 0.5)
		local i = self:idx(x, y)
		if not T.passable(self.level.map[i]) or T.losBlocking(self.level.map[i]) or self:charAt(i) then
			return false
		end
	end
	return true
end

------------------------------------------------------------------ характеристики

function Game:heroInvisible()
	return self.hero.buffs.invisible ~= nil
end

function Game:attackSkill(ch, target)
	if ch.isHero then
		local acc = ch.atk
		local w = ch.weapon
		if w then
			local def = Defs.weapons[w.type]
			local enc = strReq(def.tier, w.level) - ch.str
			acc = acc * (def.acc or 1)
			if enc > 0 then
				acc = acc / 1.5 ^ enc
			end
		end
		return acc
	end
	if ch.type == "goo" then
		local a = (ch.hp * 2 <= ch.ht) and 15 or 10
		if ch.pumped > 0 then
			a = a * 2
		end
		return a
	end
	return ch.def.acc
end

function Game:defenseSkill(ch, attacker)
	if ch.isHero then
		local ev = ch.def
		local a = ch.armor
		if a then
			local enc = strReq(Defs.armors[a.type].tier, a.level) - ch.str
			if enc > 0 then
				ev = ev / 1.5 ^ enc
			end
		end
		return ev
	end
	-- внезапная атака: монстр, который не охотится за героем, не уворачивается
	if attacker and attacker.isHero and ch.state ~= "hunting" then
		return 0
	end
	if ch.type == "goo" and ch.hp * 2 <= ch.ht then
		return math.floor(ch.def.def * 1.5)
	end
	return ch.def.def
end

function Game:damageRoll(ch)
	local rng = self.rng
	if ch.isHero then
		local w = ch.weapon
		if not w then
			return rng:normalIntRange(1, math.max(ch.str - 8, 1))
		end
		local def = Defs.weapons[w.type]
		local dmg = rng:normalIntRange(weaponMin(def, w.level), weaponMax(def, w.level))
		local ex = ch.str - strReq(def.tier, w.level)
		if ex > 0 then
			dmg = dmg + rng:intRange(0, ex)
		end
		return dmg
	end
	if ch.type == "goo" then
		local max = (ch.hp * 2 <= ch.ht) and 12 or 8
		if ch.pumped > 0 then
			ch.pumped = 0
			return rng:normalIntRange(3, max * 3)
		end
		return rng:normalIntRange(1, max)
	end
	return rng:normalIntRange(ch.def.dmg[1], ch.def.dmg[2])
end

function Game:drRoll(ch)
	local rng = self.rng
	if ch.isHero then
		local dr = 0
		local a = ch.armor
		if a then
			local def = Defs.armors[a.type]
			local min, max = armorDr(def.tier, a.level)
			local armDr = rng:normalIntRange(min, max)
			local enc = strReq(def.tier, a.level) - ch.str
			if enc > 0 then
				armDr = armDr - 2 * enc
			end
			if armDr > 0 then
				dr = dr + armDr
			end
		end
		local w = ch.weapon
		if w and Defs.weapons[w.type].defense then
			dr = dr + rng:intRange(0, Defs.weapons[w.type].defense)
		end
		return dr
	end
	return rng:normalIntRange(ch.def.dr[1], ch.def.dr[2])
end

function Game:attackDelay(ch)
	if ch.isHero and ch.weapon then
		local def = Defs.weapons[ch.weapon.type]
		local delay = def.dly or 1
		local enc = strReq(def.tier, ch.weapon.level) - ch.str
		if enc > 0 then
			delay = delay * 1.2 ^ enc
		end
		return delay
	end
	return 1
end

function Game:moveDelay(ch)
	if ch.isHero then
		local speed = 1
		if ch.buffs.haste then
			speed = speed * 3
		end
		local a = ch.armor
		if a then
			local enc = strReq(Defs.armors[a.type].tier, a.level) - ch.str
			if enc > 0 then
				speed = speed / 1.2 ^ enc
			end
		end
		return 1 / speed
	end
	return 1 / ch.speed
end

function Game.maxExp(lvl)
	return 5 + lvl * 5
end

function Game:heroStr()
	return self.hero.str
end

------------------------------------------------------------------ бой

function Game:charName(ch)
	if ch.isHero then
		return "вы"
	end
	return ch.def.name
end

function Game:attack(attacker, defender)
	local rng = self.rng
	self:emit({ type = "attack", id = attacker.id, target = defender.pos })
	if attacker.isHero then
		self.hero.buffs.invisible = nil
	end
	local acc = self:attackSkill(attacker, defender)
	local defSkill = self:defenseSkill(defender, attacker)
	local hit = defSkill <= 0 or rng:float(acc) >= rng:float(defSkill)
	if not hit then
		local verb = (defender.def and defender.type == "slime") and "блокирует" or "уклоняется"
		self:status(defender, verb)
		if attacker.type == "goo" then
			attacker.pumped = 0
		end
		return false
	end
	local dmg = self:damageRoll(attacker)
	dmg = math.max(0, dmg - self:drRoll(defender))
	if defender.type == "slime" and dmg >= 5 then
		dmg = math.floor(4 + (math.sqrt(8 * (dmg - 4) + 1) - 1) / 2)
	end
	if attacker.type == "goo" and rng:int(3) == 0 and defender.isHero then
		if not defender.buffs.ooze then
			self:log("Ядовитая слизь разъедает вашу плоть. Надо её смыть!", COLOR.bad)
		end
		defender.buffs.ooze = BUFF_TIME
	end
	if not defender.isHero and defender.state ~= "hunting" then
		defender.state = "hunting"
		defender.target = attacker.pos
	end
	self:damage(defender, dmg, attacker)
	return true
end

function Game:damage(ch, dmg, src)
	if self.over then
		return
	end
	ch.hp = ch.hp - dmg
	self:emit({ type = "damage", id = ch.id, amount = dmg })
	if ch.isHero then
		self.interrupted = true
		if ch.hp <= 0 then
			self:heroDie(src)
		end
	elseif ch.hp <= 0 then
		self:mobDie(ch)
	end
end

function Game:heal(ch, amount)
	local before = ch.hp
	ch.hp = math.min(ch.ht, ch.hp + amount)
	if ch.hp > before then
		self:emit({ type = "heal", id = ch.id, amount = ch.hp - before })
	end
end

function Game:earnExp(amount)
	local hero = self.hero
	hero.exp = hero.exp + amount
	self:status(hero, "+" .. amount .. " опыта", COLOR.high)
	while hero.exp >= Game.maxExp(hero.lvl) do
		hero.exp = hero.exp - Game.maxExp(hero.lvl)
		hero.lvl = hero.lvl + 1
		hero.ht = hero.ht + 5
		hero.hp = hero.hp + 5
		hero.atk = hero.atk + 1
		hero.def = hero.def + 1
		self:status(hero, "Уровень повышен!", COLOR.high)
		self:log("Новый уровень! +Меткость, +Уклонение, +5 ОЗ!", COLOR.high)
	end
end

function Game:mobDie(m)
	for i, mm in ipairs(self.mobs) do
		if mm == m then
			table.remove(self.mobs, i)
			break
		end
	end
	self.seen[m.id] = nil
	self:emit({ type = "die", id = m.id })
	self.stats.kills = self.stats.kills + 1
	local def = m.def
	if self.hero.lvl <= def.maxLvl then
		self:earnExp(def.exp)
	end
	if def.loot then
		local chance = def.lootChance
		if def.loot == "weapon2" then
			chance = chance * 0.25 ^ (self.slimeDrops or 0)
		end
		if self.rng:float() < chance then
			local item
			if def.loot == "gold" then
				item = self:makeGold()
			elseif def.loot == "meat" then
				item = self:makeItem("food", "meat")
			else
				self.slimeDrops = (self.slimeDrops or 0) + 1
				item = self:randomWeapon(2, 0)
			end
			self:dropToHeap(m.pos, item)
		end
	end
	if m.type == "goo" then
		self:log("бульк... бульк...", COLOR.bad)
		self:log("Вы победили Гу и прошли канализацию!", COLOR.high)
		self.won = true
		self.over = true
		self:emit({ type = "win" })
	end
end

function Game:heroDie(src)
	local hero = self.hero
	hero.hp = 0
	self.over = true
	local cause
	if type(src) == "string" then
		cause = src
	elseif src and src.def then
		cause = "Убит (убийца - " .. src.def.name .. ")"
	else
		cause = "Погиб в подземелье"
	end
	self.deathCause = cause
	self:log("Вы погибли...", COLOR.bad)
	self:emit({ type = "dead", cause = cause })
end

------------------------------------------------------------------ передвижение

function Game:moveChar(ch, to)
	local from = ch.pos
	ch.pos = to
	self:emit({ type = "move", id = ch.id, from = from, to = to })
	local map = self.level.map
	if map[to] == T.DOOR then
		self:setTerrain(to, T.OPEN_DOOR)
	elseif map[to] == T.HIGH_GRASS then
		self:setTerrain(to, T.GRASS)
	end
	if map[from] == T.OPEN_DOOR and not self:charAt(from) and not self.heaps[from] then
		self:setTerrain(from, T.DOOR)
	end
	if not ch.isHero and self.fovDirty then
		self:updateFov()
	end
end

------------------------------------------------------------------ ИИ монстров (Mob.java: Sleeping / Wandering / Hunting)

function Game:randomDestination()
	return self:randomCell(nil, 50) or self.hero.pos
end

function Game:mobAct(m)
	local hero = self.hero
	local sees = self.fov[m.pos] == true and not self:heroInvisible()
	local dist = self:dist(m.pos, hero.pos)

	if m.type == "goo" then
		if m.state ~= "hunting" then
			m.pumped = 0
		end
		if self.level.map[m.pos] == T.WATER and m.hp < m.ht then
			self:heal(m, 1)
		end
	end

	if m.state == "sleeping" then
		if sees and self.rng:float(dist + STEALTH) < 1 then
			m.state = "hunting"
			m.target = hero.pos
			self:status(m, "!", COLOR.warn)
			if m.type == "goo" then
				self:log("Гу: БУЛЬК-БУЛЬК!", COLOR.bad)
			end
		end
		return 1
	end

	if m.state == "wandering" then
		if sees and (m.alerted or self.rng:float(dist / 2 + STEALTH) < 1) then
			m.state = "hunting"
			m.target = hero.pos
			m.alerted = false
			self:status(m, "!", COLOR.warn)
			return 1
		end
		if not m.target or m.target == m.pos then
			m.target = self:randomDestination()
		end
		local step = self:stepToward(m, m.target)
		if step then
			self:moveChar(m, step)
			return 1 / m.speed
		end
		m.target = nil
		return 1
	end

	-- охота
	if sees then
		m.target = hero.pos
	end
	if sees and self:canAttack(m, hero) then
		return self:mobDoAttack(m)
	end
	if m.target and m.target ~= m.pos then
		local step = self:stepToward(m, m.target)
		if step then
			self:moveChar(m, step)
			return 1 / m.speed
		end
	end
	if not sees and (m.target == nil or m.target == m.pos) then
		m.state = "wandering"
		m.target = self:randomDestination()
	end
	return 1
end

function Game:canAttack(m, target)
	local d = self:dist(m.pos, target.pos)
	if m.type == "goo" and m.pumped > 0 then
		return d <= 2 and self:clearLine(m.pos, target.pos)
	end
	return d <= 1
end

function Game:mobDoAttack(m)
	local hero = self.hero
	if m.type == "goo" then
		local enraged = m.hp * 2 <= m.ht
		if m.pumped == 1 then
			m.pumped = 2
			self:emit({ type = "pump", id = m.id, level = 2 })
			return 1
		elseif m.pumped >= 2 or self.rng:int(enraged and 2 or 5) > 0 then
			local pumped = m.pumped >= 2
			self:attack(m, hero)
			m.pumped = 0
			if pumped then
				self:emit({ type = "shake" })
			end
			self:emit({ type = "pump", id = m.id, level = 0 })
			return 1
		else
			m.pumped = m.pumped + 1
			self:emit({ type = "pump", id = m.id, level = m.pumped })
			self:status(m, "!!!", COLOR.bad)
			self:log("Гу накачивается жижей!", COLOR.bad)
			return 1
		end
	end
	self:attack(m, hero)
	return self:attackDelay(m)
end

function Game:processMobs()
	local guard = 0
	while not self.over do
		local m = nil
		for _, mob in ipairs(self.mobs) do
			if mob.time < self.hero.time and (m == nil or mob.time < m.time) then
				m = mob
			end
		end
		if not m then
			break
		end
		m.time = m.time + self:mobAct(m)
		guard = guard + 1
		if guard > 2000 then
			break
		end
	end
end

------------------------------------------------------------------ ход героя

function Game:heroTurnTick()
	local hero = self.hero
	local b = hero.buffs
	self.stats.turns = self.stats.turns + 1

	-- голод (Hunger.java)
	local old = hero.hunger
	if hero.hunger < STARVING then
		hero.hunger = hero.hunger + 1
		if hero.hunger >= STARVING then
			hero.hunger = STARVING
			self:log("Вы очень голодны!", COLOR.bad)
			self.interrupted = true
			self:damage(hero, 1, "Умер от голода")
		elseif hero.hunger >= HUNGRY and old < HUNGRY then
			self:log("Вы слегка голодны.", COLOR.warn)
			self.interrupted = true
		end
	else
		hero.starveDmg = hero.starveDmg + hero.ht / 1000
		if hero.starveDmg >= 1 then
			local d = math.floor(hero.starveDmg)
			hero.starveDmg = hero.starveDmg - d
			self:damage(hero, d, "Умер от голода")
		end
	end
	if self.over then
		return
	end

	-- регенерация: 1 ОЗ за 10 ходов, если не истощён
	if hero.hunger < STARVING and hero.hp < hero.ht then
		hero.regen = hero.regen + 0.1
		if hero.regen >= 1 then
			hero.regen = hero.regen - 1
			self:heal(hero, 1)
		end
	end

	-- лечение от зелья: 25% остатка за ход
	if b.healing then
		local amount = math.max(1, math.floor(b.healing * 0.25 + 0.5))
		amount = math.min(amount, b.healing)
		b.healing = b.healing - amount
		self:heal(hero, amount)
		if b.healing <= 0 or hero.hp >= hero.ht then
			b.healing = nil
		end
	end

	-- едкая слизь Гу смывается водой
	if b.ooze then
		if self.level.map[hero.pos] == T.WATER then
			b.ooze = nil
			self:log("Вы смыли слизь водой.", COLOR.good)
		else
			if self.depth >= 5 or b.ooze % 2 == 0 then
				self:damage(hero, 1, "Растворился")
			end
			b.ooze = b.ooze - 1
			if b.ooze <= 0 then
				b.ooze = nil
			end
		end
	end

	for _, k in ipairs({ "haste", "invisible", "mindvision" }) do
		if b[k] then
			b[k] = b[k] - 1
			if b[k] <= 0 then
				b[k] = nil
			end
		end
	end

	-- новые монстры (Level.respawner): раз в 50 ходов, если их мало
	self.respawn = self.respawn + 1
	if self.respawn >= 50 then
		self.respawn = 0
		if #self.mobs < self:mobLimit() then
			local pos = self:randomCell(function(i)
				return not self.fov[i] and self:dist(i, hero.pos) > VIEW
			end)
			if pos then
				local m = self:spawnMob(self.rng:pick(Defs.rotation[math.min(self.depth, 4)]), pos, "wandering")
				m.target = hero.pos
			end
		end
	end
end

-- герой потратил время: тикаем эффекты, ходят монстры, пересчитываем обзор
function Game:spend(t)
	local hero = self.hero
	hero.time = hero.time + t
	self.turnAcc = self.turnAcc + t
	while self.turnAcc >= 1 and not self.over do
		self.turnAcc = self.turnAcc - 1
		self:heroTurnTick()
	end
	if not self.over then
		self:processMobs()
	end
	if not self.over then
		self:updateFov()
	end
	self:emit({ type = "hero" })
end

function Game:pickUpHere()
	local hero = self.hero
	local heap = self.heaps[hero.pos]
	if not heap then
		return false
	end
	local took = false
	while #heap > 0 do
		local item = heap[#heap]
		if self:addToBag(item) then
			table.remove(heap)
			took = true
			if item.kind == "gold" then
				self:log("Вы подобрали: " .. self:itemName(item) .. ".", COLOR.info)
			else
				self:log("Вы подобрали: " .. self:itemName(item) .. ".", COLOR.info)
			end
		else
			self:log("Вы не можете унести: " .. self:itemName(item) .. ".", COLOR.warn)
			break
		end
	end
	if #heap == 0 then
		self.heaps[hero.pos] = nil
	end
	self:emit({ type = "heap", pos = hero.pos })
	return took
end

-- шаг или атака в соседнюю клетку
function Game:heroStep(dx, dy)
	if self.over then
		return false
	end
	local hero = self.hero
	local x, y = self:xy(hero.pos)
	local nx, ny = x + dx, y + dy
	if not self:inside(nx, ny) then
		return false
	end
	local to = self:idx(nx, ny)
	local m = self:mobAt(to)
	if m then
		self:attack(hero, m)
		self:spend(self:attackDelay(hero))
		return true
	end
	if not T.passable(self.level.map[to]) then
		return false
	end
	self:moveChar(hero, to)
	self:pickUpHere()
	local t = self.level.map[to]
	if t == T.EXIT then
		if self.depth < Game.MAX_DEPTH then
			self:spend(self:moveDelay(hero))
			if not self.over then
				self:enterDepth(self.depth + 1, true)
				if self.level.boss then
					self:log("Вы чувствуете здесь что-то мерзкое и древнее...", COLOR.warn)
				else
					self:log("Вы спускаетесь на " .. self.depth .. " уровень подземелья.", COLOR.high)
				end
			end
			return true
		end
		self:log("Лестница вниз завалена. Сначала победите Гу!", COLOR.warn)
	elseif t == T.ENTRANCE then
		if self.depth == 1 then
			self:log("Ещё рано уходить, оставшееся подземелье ждёт впереди!", COLOR.warn)
		else
			self:spend(self:moveDelay(hero))
			if not self.over then
				self:enterDepth(self.depth - 1, false)
				self:log("Вы поднимаетесь на " .. self.depth .. " уровень.", COLOR.info)
			end
			return true
		end
	end
	self:spend(self:moveDelay(hero))
	return true
end

-- один шаг автопутешествия к клетке (атакует, если цель — соседний монстр)
function Game:heroTravel(target)
	local hero = self.hero
	if target == hero.pos then
		if self.heaps[target] then
			self:pickUpHere()
			self:spend(1)
		else
			self:heroRest()
		end
		return false
	end
	local m = self:mobAt(target)
	if m and self.fov[target] and self:dist(target, hero.pos) <= 1 then
		local x, y = self:xy(hero.pos)
		local tx, ty = self:xy(target)
		self:heroStep(tx - x, ty - y)
		return false
	end
	local step = self:heroPathStep(target)
	if not step then
		return false
	end
	local x, y = self:xy(hero.pos)
	local sx, sy = self:xy(step)
	self:heroStep(sx - x, sy - y)
	return hero.pos ~= target and not self.over
end

function Game:heroRest()
	self:status(self.hero, "...")
	self:spend(1)
end

------------------------------------------------------------------ предметы: использование

local function teleportFilter(g)
	return function(i)
		return not g.fov[i] and g.level.map[i] ~= T.EXIT and g.level.map[i] ~= T.ENTRANCE
	end
end

-- action: equip / unequip / drink / read / eat / drop. target — предмет для свитков
-- возвращает { needTarget = "upgradable" | "unknown" }, если нужно выбрать предмет
function Game:useItem(item, action, target)
	if self.over then
		return nil
	end
	local hero = self.hero
	if action == "equip" then
		local slot = item.kind
		local old = hero[slot]
		self:removeOne(item)
		hero[slot] = item
		item.known = true
		if old then
			self:addToBag(old)
		end
		self:log("Вы надели: " .. self:itemName(item) .. ".", COLOR.info)
		self:spend(1)
	elseif action == "unequip" then
		if #hero.bag >= Game.BAG_SIZE then
			self:log("Рюкзак полон.", COLOR.warn)
			return nil
		end
		hero[item.kind] = nil
		self:addToBag(item)
		self:spend(1)
	elseif action == "drop" then
		local one = self:removeOne(item)
		if one then
			self:dropToHeap(hero.pos, one)
			self:spend(1)
		end
	elseif action == "eat" then
		self:removeOne(item)
		local def = Defs.food[item.type]
		hero.hunger = math.max(0, hero.hunger - def.energy)
		hero.starveDmg = 0
		self:log(def.eat, COLOR.info)
		self:spend(3)
	elseif action == "drink" then
		self:removeOne(item)
		local wasKnown = self.known[item.type]
		self.known[item.type] = true
		if not wasKnown then
			self:log("Это было " .. Defs.potions[item.type].name .. ".", COLOR.info)
		end
		self:drink(item.type)
		self:spend(1)
	elseif action == "read" then
		local def = Defs.scrolls[item.type]
		if def.target and not target then
			local wasKnown = self.known[item.type]
			self.known[item.type] = true
			if not wasKnown then
				self:log("Это " .. def.name .. ".", COLOR.info)
			end
			return { needTarget = def.target, title = def.target == "upgradable" and "Что улучшить?" or "Что опознать?" }
		end
		self:removeOne(item)
		local wasKnown = self.known[item.type]
		self.known[item.type] = true
		if not wasKnown and not def.target then
			self:log("Это был " .. def.name .. ".", COLOR.info)
		end
		self:read(item.type, target)
		self:spend(1)
	end
	return nil
end

function Game:canTarget(filter, item)
	if filter == "upgradable" then
		return item.kind == "weapon" or item.kind == "armor"
	elseif filter == "unknown" then
		return not self:isKnown(item)
	end
	return false
end

function Game:drink(typ)
	local hero = self.hero
	local b = hero.buffs
	if typ == "healing" then
		b.healing = math.floor(0.8 * hero.ht + 14)
		b.ooze = nil
		self:log("Ваши раны начинают заживать.", COLOR.good)
	elseif typ == "strength" then
		hero.str = hero.str + 1
		self:status(hero, "+1 сила", COLOR.good)
		self:log("По вашему телу распространяется новоприобретённая сила, теперь у вас " .. hero.str .. " силы!", COLOR.good)
	elseif typ == "experience" then
		self:earnExp(Game.maxExp(hero.lvl) - hero.exp)
	elseif typ == "mindvision" then
		b.mindvision = BUFF_TIME
		self:log("Вы чувствуете присутствие других существ.", COLOR.good)
	elseif typ == "invisibility" then
		b.invisible = BUFF_TIME
		for _, m in ipairs(self.mobs) do
			if m.state == "hunting" then
				m.state = "wandering"
				m.target = self:randomDestination()
			end
		end
		self:log("Вы растворяетесь в воздухе!", COLOR.good)
	elseif typ == "haste" then
		b.haste = BUFF_TIME
		self:log("Вы чувствуете невероятный прилив энергии!", COLOR.good)
	end
end

function Game:read(typ, target)
	local hero = self.hero
	if typ == "upgrade" then
		target.level = target.level + 1
		target.known = true
		self:log(self:itemName(target) .. " выглядит лучше.", COLOR.good)
	elseif typ == "identify" then
		target.known = true
		if target.kind == "potion" or target.kind == "scroll" then
			self.known[target.type] = true
		end
		self:log("Ваш предмет был опознан: " .. self:itemName(target) .. ".", COLOR.good)
	elseif typ == "magicmapping" then
		local map = self.level.map
		for i = 1, #map do
			if T.passable(map[i]) then
				self.mapped[i] = true
			else
				local x, y = self:xy(i)
				for _, d in ipairs(DIRS8) do
					local nx, ny = x + d[1], y + d[2]
					if self:inside(nx, ny) and T.passable(map[self:idx(nx, ny)]) then
						self.mapped[i] = true
						break
					end
				end
			end
		end
		self:emit({ type = "fov" })
		self:log("Теперь вы знакомы с планировкой этого уровня.", COLOR.good)
	elseif typ == "teleportation" then
		local pos = self:randomCell(teleportFilter(self))
		if pos then
			self:moveChar(hero, pos)
			self:emit({ type = "teleport" })
			self:pickUpHere()
		end
		self:log("В мгновенье ока вы оказываетесь в другом месте уровня.", COLOR.info)
	elseif typ == "rage" then
		for _, m in ipairs(self.mobs) do
			m.state = "hunting"
			m.target = hero.pos
		end
		self:log("Свиток издаёт яростный рёв, эхом отдающийся в подземелье!", COLOR.warn)
	elseif typ == "lullaby" then
		for _, m in ipairs(self.mobs) do
			if self.fov[m.pos] and not m.boss then
				m.state = "sleeping"
				self:status(m, "Zzz")
			end
		end
		self:log("В воздухе раздается убаюкивающая мелодия. Враги вокруг засыпают.", COLOR.good)
	end
end

------------------------------------------------------------------ для интерфейса

function Game:heroInfo()
	local hero = self.hero
	local list = {}
	local b = hero.buffs
	if hero.hunger >= STARVING then
		list[#list + 1] = { text = "истощён", color = COLOR.bad }
	elseif hero.hunger >= HUNGRY then
		list[#list + 1] = { text = "голоден", color = COLOR.warn }
	end
	if b.healing then
		list[#list + 1] = { text = "лечение", color = COLOR.good }
	end
	if b.ooze then
		list[#list + 1] = { text = "слизь " .. b.ooze, color = COLOR.bad }
	end
	if b.haste then
		list[#list + 1] = { text = "спешка " .. b.haste, color = COLOR.good }
	end
	if b.invisible then
		list[#list + 1] = { text = "невидим " .. b.invisible, color = COLOR.good }
	end
	if b.mindvision then
		list[#list + 1] = { text = "мент. зрение " .. b.mindvision, color = COLOR.good }
	end
	return list
end

function Game:mobDesc(m)
	local text = m.def.desc
	if m.state == "sleeping" then
		text = text .. "\n\nСпит."
	elseif m.state == "wandering" then
		text = text .. "\n\nБродит и вас не замечает."
	else
		text = text .. "\n\nОхотится на вас!"
	end
	return text
end

function Game:findChar(id)
	if id == 0 then
		return self.hero
	end
	for _, m in ipairs(self.mobs) do
		if m.id == id then
			return m
		end
	end
	return nil
end

return Game
