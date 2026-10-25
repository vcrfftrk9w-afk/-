-- Ядро режима «Фронт»: карта, страны, захват территории, экономика, флот, ядерный удар,
-- союзы и боты. Чистый Luau без API Roblox: сервер только рисует результат,
-- а тесты гоняют ядро без Studio (см. tests/sim_test.luau).

local Core = {}
Core.__index = Core

local WATER, PLAIN, HILL, MOUNTAIN = 0, 1, 2, 3
Core.WATER, Core.PLAIN, Core.HILL, Core.MOUNTAIN = WATER, PLAIN, HILL, MOUNTAIN

-- ------------------------------------------------------------ случайные числа
-- свой генератор (xorshift), чтобы карта по seed была одинаковой везде

local function makeRng(seed)
	local s = math.floor(seed) % 2147483646 + 1
	return function()
		s = bit32.bxor(s, bit32.lshift(s, 13))
		s = bit32.bxor(s, bit32.rshift(s, 17))
		s = bit32.bxor(s, bit32.lshift(s, 5))
		return (s % 1000003) / 1000003
	end
end

function Core:rand(a, b)
	local r = self.rng()
	if a == nil then
		return r
	end
	return a + math.floor(r * (b - a + 1))
end

-- ------------------------------------------------------------ создание

function Core.new(cfg, seed)
	local self = setmetatable({}, Core)
	self.cfg = cfg
	self.seed = seed or os.time()
	self.rng = makeRng(self.seed)
	self.W, self.H = cfg.MAP_W, cfg.MAP_H
	self.time = 0
	self.phase = "spawn"
	self.nations = {}
	self.attacks = {}
	self.ships = {}
	self.missiles = {}
	self.buildings = {}       -- тайл -> {kind, level}
	self.tilesOf = {}         -- страна -> множество её клеток
	self.requests = {}        -- [кому][от кого] = время истечения
	self.events = {}
	self.dirty = {}
	self.tradePaths = {}
	self.nextId = 0
	self.acc = { attack = 0, econ = 0, bot = 0 }
	self.winner = nil
	self:generateMap()
	return self
end

function Core:index(x, y)
	return y * self.W + x + 1
end

function Core:xy(i)
	local j = i - 1
	return j % self.W, j // self.W
end

function Core:generateMap()
	local W, H = self.W, self.H
	local ox, oy = self:rand() * 1000, self:rand() * 1000
	local values = {}
	for y = 0, H - 1 do
		for x = 0, W - 1 do
			local n = 0
			local amp, freq = 1, 0.055
			for _ = 1, 4 do
				n += math.noise(x * freq + ox, y * freq + oy, 0.3) * amp
				amp *= 0.5
				freq *= 2
			end
			local dx, dy = (x / (W - 1) - 0.5) * 2, (y / (H - 1) - 0.5) * 2
			local d = math.sqrt(dx * dx * 0.8 + dy * dy)
			values[self:index(x, y)] = n - d * d * 0.55
		end
	end
	-- порог подбираем так, чтобы суши было ровно LAND_SHARE
	local sorted = table.clone(values)
	table.sort(sorted)
	local cut = sorted[math.floor(#sorted * (1 - self.cfg.LAND_SHARE)) + 1]
	local hillCut = sorted[math.floor(#sorted * 0.86)]
	local mountainCut = sorted[math.floor(#sorted * 0.95)]

	self.terrain, self.owner, self.border, self.nb, self.coastal = {}, {}, {}, {}, {}
	self.landCount = 0
	for i = 1, W * H do
		local v = values[i]
		local t = WATER
		if v >= mountainCut then
			t = MOUNTAIN
		elseif v >= hillCut then
			t = HILL
		elseif v >= cut then
			t = PLAIN
		end
		self.terrain[i] = t
		self.owner[i] = t == WATER and -1 or 0
		self.border[i] = false
		if t ~= WATER then
			self.landCount += 1
		end
	end
	for i = 1, W * H do
		local x, y = self:xy(i)
		local list = {}
		if x > 0 then table.insert(list, i - 1) end
		if x < W - 1 then table.insert(list, i + 1) end
		if y > 0 then table.insert(list, i - W) end
		if y < H - 1 then table.insert(list, i + W) end
		self.nb[i] = list
	end
	for i = 1, W * H do
		local c = false
		if self.terrain[i] ~= WATER then
			for _, n in ipairs(self.nb[i]) do
				if self.terrain[n] == WATER then
					c = true
					break
				end
			end
		end
		self.coastal[i] = c
	end
end

-- ------------------------------------------------------------ события для сервера

function Core:emit(e)
	table.insert(self.events, e)
end

function Core:takeEvents()
	local e = self.events
	self.events = {}
	return e
end

function Core:takeDirty()
	local d = self.dirty
	self.dirty = {}
	return d
end

function Core:notify(id, text)
	self:emit({ type = "notify", nation = id, text = text })
end

function Core:broadcast(text)
	self:emit({ type = "notify", nation = nil, text = text })
end

-- ------------------------------------------------------------ страны

function Core:addNation(name, isBot, userId)
	local id = #self.nations + 1
	local cfg = self.cfg
	self.nations[id] = {
		id = id,
		name = name or cfg.NAMES[(id - 1) % #cfg.NAMES + 1],
		color = cfg.COLORS[(id - 1) % #cfg.COLORS + 1],
		isBot = isBot,
		userId = userId,
		troops = cfg.START_TROOPS,
		gold = 500,
		tiles = 0,
		alive = true,
		spawned = false,
		betrayals = 0,
		allies = {},
		built = { City = 0, Port = 0, Defense = 0, Factory = 0, Silo = 0 },
		ratio = cfg.DEFAULT_RATIO,
		botPhase = self:rand() * cfg.BOT_INTERVAL,
		botTimer = 0,
		personality = self:rand(),   -- 0 осторожный … 1 агрессивный
	}
	self.tilesOf[id] = {}
	self.requests[id] = {}
	return id
end

function Core:maxTroops(n)
	local cfg = self.cfg
	return cfg.BASE_MAX_TROOPS + n.tiles * cfg.TROOPS_PER_TILE + n.built.City * cfg.TROOPS_PER_CITY
end

function Core:isImmune()
	return self.phase == "spawn" or self.time < self.cfg.SPAWN_TIME + self.cfg.IMMUNITY_TIME
end

function Core:allied(a, b)
	return a > 0 and b > 0 and self.nations[a].allies[b] == true
end

function Core:setOwner(i, id)
	local old = self.owner[i]
	if old == id then
		return
	end
	if old > 0 then
		self.tilesOf[old][i] = nil
		self.nations[old].tiles -= 1
	end
	self.owner[i] = id
	if id > 0 then
		self.tilesOf[id][i] = true
		self.nations[id].tiles += 1
	end
	local b = self.buildings[i]
	if b then
		if old > 0 then
			self.nations[old].built[b.kind] -= b.level
		end
		if id > 0 then
			self.nations[id].built[b.kind] += b.level
			self:emit({ type = "buildingOwner", tile = i, owner = id })
		else
			self:removeBuilding(i)
		end
	end
	self:updateBorder(i)
	for _, n in ipairs(self.nb[i]) do
		self:updateBorder(n)
	end
end

function Core:updateBorder(i)
	local o = self.owner[i]
	local isBorder = false
	if o > 0 then
		for _, n in ipairs(self.nb[i]) do
			local on = self.owner[n]
			if on ~= o and on >= 0 then
				isBorder = true
				break
			end
		end
	end
	self.border[i] = isBorder
	self.dirty[i] = true
end

local SPAWN_RADIUS = 2

function Core:canSpawnAt(id, i)
	if not i or i < 1 or i > self.W * self.H then
		return false, "Мимо карты"
	end
	if self.terrain[i] == WATER then
		return false, "Нужна суша"
	end
	if self.owner[i] ~= 0 and self.owner[i] ~= id then
		return false, "Здесь уже кто-то есть"
	end
	local x, y = self:xy(i)
	local room = 0
	for dy = -SPAWN_RADIUS, SPAWN_RADIUS do
		for dx = -SPAWN_RADIUS, SPAWN_RADIUS do
			local tx, ty = x + dx, y + dy
			if tx >= 0 and ty >= 0 and tx < self.W and ty < self.H then
				local o = self.owner[self:index(tx, ty)]
				if o == 0 or o == id then
					room += 1
				end
			end
		end
	end
	if room < 10 then
		return false, "Мало свободной земли вокруг"
	end
	for _, other in ipairs(self.nations) do
		if other.id ~= id and other.spawned and other.spawnTile then
			local ox, oy = self:xy(other.spawnTile)
			if math.abs(ox - x) + math.abs(oy - y) < 7 then
				return false, "Слишком близко к соседу"
			end
		end
	end
	return true
end

function Core:spawn(id, i)
	local n = self.nations[id]
	if self.phase ~= "spawn" and n.spawned then
		return false, "Место старта уже выбрано"
	end
	local ok, msg = self:canSpawnAt(id, i)
	if not ok then
		return false, msg
	end
	-- в фазе выбора место можно переставить
	if n.spawned then
		for t in pairs(self.tilesOf[id]) do
			self:setOwner(t, 0)
		end
	end
	local cx, cy = self:xy(i)
	for dy = -SPAWN_RADIUS, SPAWN_RADIUS do
		for dx = -SPAWN_RADIUS, SPAWN_RADIUS do
			local x, y = cx + dx, cy + dy
			if math.abs(dx) + math.abs(dy) <= SPAWN_RADIUS + 1 and x >= 0 and y >= 0 and x < self.W and y < self.H then
				local t = self:index(x, y)
				if self.owner[t] == 0 then
					self:setOwner(t, id)
				end
			end
		end
	end
	n.spawned = true
	n.spawnTile = i
	self:emit({ type = "spawned", nation = id, tile = i })
	return true
end

function Core:randomSpawn(id)
	for _ = 1, 400 do
		local i = self:rand(1, self.W * self.H)
		if self:canSpawnAt(id, i) and self.owner[i] == 0 then
			return self:spawn(id, i)
		end
	end
	return false, "Нет свободного места"
end

function Core:eliminate(id, by)
	local n = self.nations[id]
	if not n.alive then
		return
	end
	n.alive = false
	for k, a in ipairs(self.attacks) do
		if a.attacker == id then
			a.done = true
		end
	end
	for other in pairs(n.allies) do
		self.nations[other].allies[id] = nil
	end
	n.allies = {}
	if by and by > 0 then
		local winner = self.nations[by]
		winner.gold += n.gold
		self:broadcast(string.format("%s уничтожена. Золото забирает %s", n.name, winner.name))
	else
		self:broadcast(n.name .. " уничтожена")
	end
	n.gold = 0
	n.troops = 0
	self:emit({ type = "eliminated", nation = id, by = by })
end

-- ------------------------------------------------------------ захват

function Core:frontier(a, b)
	local front, seen = {}, {}
	local owner = self.owner
	for t in pairs(self.tilesOf[a]) do
		for _, n in ipairs(self.nb[t]) do
			if owner[n] == b and not seen[n] then
				seen[n] = true
				table.insert(front, n)
			end
		end
	end
	return front
end

function Core:hasBorder(a, b)
	local owner = self.owner
	for t in pairs(self.tilesOf[a]) do
		for _, n in ipairs(self.nb[t]) do
			if owner[n] == b then
				return true
			end
		end
	end
	return false
end

function Core:defenseMult(i, defender)
	if defender <= 0 then
		return 1
	end
	local cfg = self.cfg
	local x, y = self:xy(i)
	local best = 0
	local r = cfg.DEFENSE_RADIUS
	for dy = -r, r do
		for dx = -r, r do
			local tx, ty = x + dx, y + dy
			if math.abs(dx) + math.abs(dy) <= r and tx >= 0 and ty >= 0 and tx < self.W and ty < self.H then
				local t = self:index(tx, ty)
				local b = self.buildings[t]
				if b and b.kind == "Defense" and self.owner[t] == defender and b.level > best then
					best = b.level
				end
			end
		end
	end
	return 1 + best * cfg.DEFENSE_BONUS
end

function Core:attackBonus(a)
	local cfg = self.cfg
	return 1 + math.min(cfg.FACTORY_BONUS_MAX, self.nations[a].built.Factory * cfg.FACTORY_BONUS)
end

function Core:tileCost(a, b, i)
	local cfg = self.cfg
	local mult = cfg.TERRAIN_COST[self.terrain[i]] or 1
	if b <= 0 then
		return cfg.NEUTRAL_COST * mult
	end
	local d = self.nations[b]
	local density = d.troops / math.max(1, d.tiles)
	return (cfg.ENEMY_BASE_COST + density * cfg.DENSITY_FACTOR) * mult * self:defenseMult(i, b) / self:attackBonus(a)
end

function Core:atWar(a, b)
	for _, at in ipairs(self.attacks) do
		if not at.done and ((at.attacker == a and at.target == b) or (at.attacker == b and at.target == a)) then
			return true
		end
	end
	return false
end

-- проверки, общие для атак по суше и с моря
function Core:checkTarget(a, b)
	if b == a then
		return false, "Это твоя земля"
	end
	if b > 0 then
		if not self.nations[b].alive then
			return false, "Эта страна уже уничтожена"
		end
		if self:allied(a, b) then
			return false, "Это союзник. Сначала разорви союз"
		end
		if self:isImmune() then
			return false, "Щит: страны пока нельзя атаковать"
		end
	end
	return true
end

function Core:startAttack(a, b, troops)
	troops = math.floor(troops)
	local n = self.nations[a]
	if troops < 1 or troops > n.troops then
		return false, "Мало войск"
	end
	n.troops -= troops
	for _, at in ipairs(self.attacks) do
		if not at.done and at.attacker == a and at.target == b then
			at.troops += troops
			return true
		end
	end
	self.nextId += 1
	table.insert(self.attacks, { id = self.nextId, attacker = a, target = b, troops = troops, tankT = 0 })
	if b > 0 then
		local d = self.nations[b]
		self:notify(b, string.format("%s напала на тебя", n.name))
		d.lastAttacker = a
	end
	return true
end

-- атака по тапу на клетку: по суше, если есть граница, иначе десант с моря
function Core:attackTile(a, i, ratio)
	local n = self.nations[a]
	if not n.alive or not n.spawned then
		return false, "Сначала выбери место старта"
	end
	if self.phase ~= "play" then
		return false, self.phase == "over" and "Раунд окончен" or "Матч ещё не начался"
	end
	if not i or i < 1 or i > self.W * self.H or self.terrain[i] == WATER then
		return false, "Выбери клетку суши"
	end
	local b = self.owner[i]
	local ok, msg = self:checkTarget(a, b)
	if not ok then
		return false, msg
	end
	ratio = math.clamp(ratio or n.ratio, 0.05, 1)
	local troops = n.troops * ratio
	if self:hasBorder(a, b) then
		return self:startAttack(a, b, troops)
	end
	if self.coastal[i] then
		return self:sendTransport(a, i, troops)
	end
	return false, "Нет общей границы, а клетка не у моря"
end

function Core:processAttacks()
	local cfg = self.cfg
	for _, at in ipairs(self.attacks) do
		if not at.done then
			local a, b = at.attacker, at.target
			local na = self.nations[a]
			local valid = na.alive and (b <= 0 or (self.nations[b].alive and not self:allied(a, b)))
			local front = valid and self:frontier(a, b) or {}
			if #front == 0 then
				self:finishAttack(at)
			else
				local want = math.clamp(math.floor(#front * cfg.CAPTURE_PER_BORDER) + 1, 1, cfg.MAX_CAPTURE_PER_TICK)
				-- сначала клетки, которые сильнее всего окружены: фронт идёт ровно
				local scored = {}
				for _, t in ipairs(front) do
					local s = 0
					for _, n in ipairs(self.nb[t]) do
						if self.owner[n] == a then
							s += 1
						end
					end
					table.insert(scored, { t = t, s = s + self:rand() * 1.5 })
				end
				table.sort(scored, function(p, q)
					return p.s > q.s
				end)
				local captured = 0
				for k = 1, math.min(want, #scored) do
					local t = scored[k].t
					local cost = self:tileCost(a, b, t)
					if at.troops < cost then
						break
					end
					at.troops -= cost
					if b > 0 then
						local d = self.nations[b]
						d.troops = math.max(0, d.troops - cost * cfg.DEFENDER_LOSS)
					end
					self:setOwner(t, a)
					captured += 1
					at.last = t
				end
				if captured == 0 then
					self:finishAttack(at)
				elseif b > 0 and self.nations[b].tiles == 0 then
					self:eliminate(b, a)
					self:finishAttack(at)
				end
			end
		end
	end
	local alive = {}
	for _, at in ipairs(self.attacks) do
		if not at.done then
			table.insert(alive, at)
		end
	end
	self.attacks = alive
end

function Core:finishAttack(at)
	if at.done then
		return
	end
	at.done = true
	local n = self.nations[at.attacker]
	if n.alive then
		n.troops += math.floor(at.troops)
	end
	at.troops = 0
end

-- ------------------------------------------------------------ вода и корабли

-- поиск пути по воде (BFS): от любой водной клетки из starts до первой, где goal(i) истинно
function Core:waterPath(starts, goal)
	local prev, queue, head = {}, {}, 1
	for _, s in ipairs(starts) do
		if prev[s] == nil then
			prev[s] = 0
			table.insert(queue, s)
		end
	end
	while head <= #queue do
		local c = queue[head]
		head += 1
		if goal(c) then
			local path = {}
			while c ~= 0 do
				table.insert(path, c)
				c = prev[c]
			end
			return path
		end
		for _, n in ipairs(self.nb[c]) do
			if prev[n] == nil and self.terrain[n] == WATER then
				prev[n] = c
				table.insert(queue, n)
			end
		end
	end
	return nil
end

function Core:waterAround(i)
	local list = {}
	for _, n in ipairs(self.nb[i]) do
		if self.terrain[n] == WATER then
			table.insert(list, n)
		end
	end
	return list
end

function Core:launchShip(ship)
	self.nextId += 1
	ship.id = self.nextId
	ship.t = 0
	ship.duration = math.max(1, #ship.path / ship.speed)
	table.insert(self.ships, ship)
	self:emit({ type = "ship", id = ship.id, kind = ship.kind, owner = ship.owner, path = ship.path, duration = ship.duration })
end

function Core:sendTransport(a, landing, troops)
	local count = 0
	for _, s in ipairs(self.ships) do
		if s.kind == "TransportShip" and s.owner == a then
			count += 1
		end
	end
	if count >= self.cfg.MAX_TRANSPORTS then
		return false, "Все транспорты уже в море"
	end
	local owner, tilesOf = self.owner, self.tilesOf[a]
	-- ищем от места высадки к своему берегу, потом разворачиваем путь
	local path = self:waterPath(self:waterAround(landing), function(c)
		for _, n in ipairs(self.nb[c]) do
			if owner[n] == a and tilesOf[n] then
				return true
			end
		end
		return false
	end)
	if not path then
		return false, "Туда не доплыть"
	end
	troops = math.floor(troops)
	local n = self.nations[a]
	if troops < 1 or troops > n.troops then
		return false, "Мало войск"
	end
	n.troops -= troops
	self:launchShip({ kind = "TransportShip", owner = a, path = path, speed = self.cfg.TRANSPORT_SPEED, troops = troops, landing = landing })
	return true
end

function Core:shipArrived(s)
	local cfg = self.cfg
	if s.kind == "TransportShip" then
		local a, n = s.owner, self.nations[s.owner]
		if not n.alive then
			return
		end
		local b = self.owner[s.landing]
		local ok = self:checkTarget(a, b)
		if b == a or not ok then
			n.troops += s.troops
			return
		end
		local cost = self:tileCost(a, b, s.landing)
		if s.troops < cost then
			self:notify(a, "Десант разбит у берега")
			return
		end
		s.troops -= cost
		self:setOwner(s.landing, a)
		if b > 0 and self.nations[b].tiles == 0 then
			self:eliminate(b, a)
			n.troops += s.troops
			return
		end
		n.troops += s.troops
		self:startAttack(a, b, s.troops)
	elseif s.kind == "TradeShip" then
		local from, to = s.fromPort, s.toPort
		local bf, bt = self.buildings[from], self.buildings[to]
		if not (bf and bt and bf.kind == "Port" and bt.kind == "Port") then
			return
		end
		local of, ot = self.owner[from], self.owner[to]
		if of <= 0 or ot <= 0 then
			return
		end
		local gold = math.floor(#s.path * cfg.TRADE_GOLD_PER_TILE * (of == ot and 0.5 or 1))
		self.nations[of].gold += gold
		if ot ~= of then
			self.nations[ot].gold += gold
		end
		self:emit({ type = "trade", from = from, to = to, gold = gold })
	end
end

function Core:updateShips(dt)
	local keep = {}
	for _, s in ipairs(self.ships) do
		s.t += dt
		if s.t >= s.duration then
			self:shipArrived(s)
		else
			table.insert(keep, s)
		end
	end
	self.ships = keep
end

function Core:tradeTick()
	local ports = {}
	for i, b in pairs(self.buildings) do
		if b.kind == "Port" and self.owner[i] > 0 then
			table.insert(ports, i)
		end
	end
	if #ports < 2 then
		return
	end
	for _, p in ipairs(ports) do
		local b = self.buildings[p]
		b.tradeTimer = (b.tradeTimer or self:rand() * self.cfg.TRADE_INTERVAL) - 1
		if b.tradeTimer <= 0 then
			b.tradeTimer = self.cfg.TRADE_INTERVAL / math.sqrt(b.level)
			-- чужие порты, с которыми нет войны; если таких нет — свои
			local o = self.owner[p]
			local choices = {}
			for _, q in ipairs(ports) do
				local oq = self.owner[q]
				if q ~= p and oq ~= o and not self:atWar(o, oq) then
					table.insert(choices, q)
				end
			end
			if #choices == 0 then
				for _, q in ipairs(ports) do
					if q ~= p then
						table.insert(choices, q)
					end
				end
			end
			local q = choices[self:rand(1, #choices)]
			local key = p .. ":" .. q
			local path = self.tradePaths[key]
			if path == nil then
				local goals = {}
				for _, w in ipairs(self:waterAround(q)) do
					goals[w] = true
				end
				local found = self:waterPath(self:waterAround(p), function(c)
					return goals[c] == true
				end)
				if found then
					-- путь найден от q к p: разворачиваем, чтобы корабль шёл из p в q
					local fwd = {}
					for k = #found, 1, -1 do
						table.insert(fwd, found[k])
					end
					path = fwd
				else
					path = false
				end
				self.tradePaths[key] = path
			end
			if path and #path > 2 then
				self:launchShip({ kind = "TradeShip", owner = o, path = path, speed = self.cfg.TRADE_SPEED, fromPort = p, toPort = q })
			end
		end
	end
end

-- ------------------------------------------------------------ постройки

function Core:buildCost(id, kind)
	local def = self.cfg.BUILDINGS[kind]
	if not def then
		return math.huge
	end
	return math.floor(def.cost * def.grow ^ self.nations[id].built[kind])
end

function Core:build(id, i, kind)
	local n = self.nations[id]
	local def = self.cfg.BUILDINGS[kind]
	if not def then
		return false, "Неизвестная постройка"
	end
	if not n.alive or not n.spawned then
		return false, "Сначала выбери место старта"
	end
	if not i or self.owner[i] ~= id then
		return false, "Строить можно только на своей земле"
	end
	if kind == "Port" and not self.coastal[i] then
		return false, "Порт ставится на берегу"
	end
	local b = self.buildings[i]
	if b and b.kind ~= kind then
		return false, "Клетка занята: " .. self.cfg.BUILDINGS[b.kind].name
	end
	if b and b.level >= def.max then
		return false, def.name .. ": максимальный уровень"
	end
	local cost = self:buildCost(id, kind)
	if n.gold < cost then
		return false, string.format("%s: нужно %d золота", def.name, cost)
	end
	n.gold -= cost
	if b then
		b.level += 1
	else
		b = { kind = kind, level = 1 }
		self.buildings[i] = b
	end
	n.built[kind] += 1
	self:emit({ type = "building", tile = i, kind = kind, level = b.level, owner = id })
	return true
end

function Core:removeBuilding(i)
	local b = self.buildings[i]
	if not b then
		return
	end
	local o = self.owner[i]
	if o > 0 then
		self.nations[o].built[b.kind] -= b.level
	end
	self.buildings[i] = nil
	for k in pairs(self.tradePaths) do
		self.tradePaths[k] = nil
	end
	self:emit({ type = "buildingRemoved", tile = i })
end

function Core:launchNuke(id, target)
	local cfg = self.cfg
	local n = self.nations[id]
	if self.phase ~= "play" or self:isImmune() then
		return false, "Щит: ядерный удар пока нельзя"
	end
	if not target or target < 1 or target > self.W * self.H then
		return false, "Выбери цель"
	end
	local o = self.owner[target]
	if o == id then
		return false, "Это твоя земля"
	end
	if o > 0 and self:allied(id, o) then
		return false, "Это союзник"
	end
	if n.gold < cfg.NUKE_COST then
		return false, string.format("Ракета: нужно %d золота", cfg.NUKE_COST)
	end
	-- ближайшая своя шахта
	local tx, ty = self:xy(target)
	local best, bestD = nil, math.huge
	for t in pairs(self.tilesOf[id]) do
		local b = self.buildings[t]
		if b and b.kind == "Silo" then
			local x, y = self:xy(t)
			local d = math.sqrt((x - tx) ^ 2 + (y - ty) ^ 2)
			if d < bestD then
				best, bestD = t, d
			end
		end
	end
	if not best then
		return false, "Нужна ракетная шахта"
	end
	n.gold -= cfg.NUKE_COST
	local duration = cfg.NUKE_TIME_BASE + bestD * cfg.NUKE_TIME_PER_TILE
	table.insert(self.missiles, { owner = id, from = best, to = target, t = 0, duration = duration })
	self:emit({ type = "nuke", owner = id, from = best, to = target, duration = duration })
	if o > 0 then
		self:notify(o, string.format("%s запустила ракету по тебе!", n.name))
	end
	return true
end

function Core:nukeHit(m)
	local cfg = self.cfg
	local cx, cy = self:xy(m.to)
	local r = cfg.NUKE_RADIUS
	local lost = {}
	for dy = -r, r do
		for dx = -r, r do
			local x, y = cx + dx, cy + dy
			if dx * dx + dy * dy <= r * r and x >= 0 and y >= 0 and x < self.W and y < self.H then
				local t = self:index(x, y)
				local o = self.owner[t]
				if o > 0 and o ~= m.owner then
					lost[o] = (lost[o] or 0) + 1
					self:setOwner(t, 0)
				end
				if self.buildings[t] and self.owner[t] ~= m.owner then
					self:removeBuilding(t)
				end
			end
		end
	end
	for o, count in pairs(lost) do
		local d = self.nations[o]
		d.troops = math.max(0, d.troops - d.troops * math.min(0.6, count / math.max(1, d.tiles + count) * 2))
		if d.tiles == 0 then
			self:eliminate(o, m.owner)
		end
	end
	self:emit({ type = "nukeHit", tile = m.to, radius = r, owner = m.owner })
end

function Core:updateMissiles(dt)
	local keep = {}
	for _, m in ipairs(self.missiles) do
		m.t += dt
		if m.t >= m.duration then
			self:nukeHit(m)
		else
			table.insert(keep, m)
		end
	end
	self.missiles = keep
end

-- ------------------------------------------------------------ союзы

function Core:requestAlliance(from, to)
	local a, b = self.nations[from], self.nations[to]
	if not b or from == to or not b.alive or not a.alive then
		return false, "Некому предложить союз"
	end
	if a.allies[to] then
		return false, "Вы уже союзники"
	end
	if self.requests[from][to] then
		self:respondAlliance(from, to, true)
		return true
	end
	self.requests[to][from] = self.time + 20
	if b.isBot then
		b.pendingAnswer = true
	else
		self:emit({ type = "allianceRequest", from = from, to = to })
	end
	self:notify(from, "Предложение союза отправлено: " .. b.name)
	return true
end

function Core:respondAlliance(to, from, accept)
	local req = self.requests[to] and self.requests[to][from]
	if not req then
		return false, "Предложение уже неактуально"
	end
	self.requests[to][from] = nil
	local a, b = self.nations[from], self.nations[to]
	if not accept then
		self:notify(from, b.name .. " отказалась от союза")
		return true
	end
	a.allies[to] = true
	b.allies[from] = true
	for _, at in ipairs(self.attacks) do
		if not at.done and ((at.attacker == from and at.target == to) or (at.attacker == to and at.target == from)) then
			self:finishAttack(at)
		end
	end
	self:broadcast(string.format("%s и %s заключили союз", a.name, b.name))
	self:emit({ type = "alliance", a = from, b = to })
	return true
end

function Core:breakAlliance(a, b)
	local na, nb = self.nations[a], self.nations[b]
	if not (na and nb and na.allies[b]) then
		return false, "Союза нет"
	end
	na.allies[b] = nil
	nb.allies[a] = nil
	na.betrayals += 1
	self:broadcast(string.format("%s разорвала союз с %s (предательств: %d)", na.name, nb.name, na.betrayals))
	return true
end

-- ------------------------------------------------------------ экономика

function Core:economyTick()
	local cfg = self.cfg
	for _, n in ipairs(self.nations) do
		if n.alive and n.spawned then
			local max = self:maxTroops(n)
			local growth = (n.troops * cfg.GROWTH_RATE + cfg.GROWTH_BASE) * (1 - n.troops / max)
			if n.isBot then
				growth *= cfg.BOT_GROWTH
			end
			n.troops = math.clamp(n.troops + growth, 0, math.max(max, n.troops))
			n.gold += cfg.GOLD_BASE + n.tiles * cfg.GOLD_PER_TILE
		end
	end
	for to, list in pairs(self.requests) do
		for from, expire in pairs(list) do
			if self.time > expire then
				list[from] = nil
			end
		end
	end
	self:tradeTick()
end

function Core:checkWin()
	if self.phase ~= "play" then
		return
	end
	local alive, best = 0, nil
	for _, n in ipairs(self.nations) do
		if n.alive and n.spawned then
			alive += 1
			if not best or n.tiles > best.tiles then
				best = n
			end
		end
	end
	if not best then
		return
	end
	local share = best.tiles / self.landCount
	local reason
	if share >= self.cfg.WIN_SHARE then
		reason = string.format("захватила %d%% суши", math.floor(share * 100))
	elseif alive == 1 then
		reason = "осталась одна"
	elseif self.time >= self.cfg.MATCH_TIME then
		reason = "самая большая страна к концу времени"
	end
	if reason then
		self.phase = "over"
		self.winner = best.id
		self:emit({ type = "win", nation = best.id, reason = reason })
	end
end

-- ------------------------------------------------------------ боты

function Core:neighbors(id)
	local counts = {}
	local owner = self.owner
	for t in pairs(self.tilesOf[id]) do
		for _, n in ipairs(self.nb[t]) do
			local o = owner[n]
			if o ~= id and o >= 0 then
				counts[o] = (counts[o] or 0) + 1
			end
		end
	end
	return counts
end

function Core:leader()
	local best
	for _, n in ipairs(self.nations) do
		if n.alive and (not best or n.tiles > best.tiles) then
			best = n
		end
	end
	return best
end

function Core:pickTile(id, filter)
	local list = {}
	for t in pairs(self.tilesOf[id]) do
		if filter(t) then
			table.insert(list, t)
		end
	end
	if #list == 0 then
		return nil
	end
	return list[self:rand(1, #list)]
end

function Core:botThink(n)
	local id = n.id
	local cfg = self.cfg
	local max = self:maxTroops(n)
	local frac = n.troops / max

	-- ответы на предложения союза
	if n.pendingAnswer then
		n.pendingAnswer = false
		for from in pairs(self.requests[id]) do
			local f = self.nations[from]
			local allies = 0
			for _ in pairs(n.allies) do
				allies += 1
			end
			local accept = f.alive and f.betrayals < 2 and allies < cfg.MAX_ALLIES and not self:atWar(id, from)
				and (f.troops > n.troops * 0.6 or self:rand() < 0.5)
			self:respondAlliance(id, from, accept)
		end
	end

	local nbrs = self:neighbors(id)
	local myAttacks, strongFronts = 0, 0
	for _, at in ipairs(self.attacks) do
		if at.attacker == id and not at.done then
			myAttacks += 1
			if at.target > 0 and self.nations[at.target].troops > n.troops * 0.8 then
				strongFronts += 1
			end
		end
	end

	if myAttacks < 3 then
		if nbrs[0] and frac > 0.25 then
			self:startAttack(id, 0, n.troops * (0.3 + n.personality * 0.25))
		elseif not self:isImmune() and frac > 0.5 - n.personality * 0.15 then
			local leader = self:leader()
			local target, bestScore = nil, -math.huge
			for o in pairs(nbrs) do
				if o > 0 and not self:allied(id, o) then
					local e = self.nations[o]
					local ratio = e.troops / math.max(1, n.troops)
					local score = -ratio + (o == n.lastAttacker and 0.4 or 0)
					if leader and leader.id == o and o ~= id and leader.tiles / self.landCount > cfg.GANG_UP_SHARE then
						score += 1.2    -- все вместе давим лидера
					end
					-- несколько слабых сразу можно, двух сильных — нельзя
					if ratio > 0.8 and strongFronts > 0 then
						score = -math.huge
					end
					if score > bestScore then
						target, bestScore = o, score
					end
				end
			end
			if target and bestScore > -1.1 then
				self:startAttack(id, target, n.troops * (0.35 + n.personality * 0.3))
			elseif not next(nbrs) or (nbrs[0] == nil and target == nil) then
				-- остров без соседей: десант на ближайший чужой берег
				if frac > 0.6 and self:rand() < 0.3 then
					local tries = 0
					while tries < 30 do
						tries += 1
						local t = self:rand(1, self.W * self.H)
						if self.coastal[t] and self.owner[t] ~= id and self:checkTarget(id, self.owner[t]) then
							self:sendTransport(id, t, n.troops * 0.4)
							break
						end
					end
				end
			end
		end
	end

	-- стройка
	local roll = self:rand()
	if n.gold >= self:buildCost(id, "City") and roll < 0.5 then
		local t = self:pickTile(id, function(t)
			return not self.buildings[t] and not self.border[t]
		end) or self:pickTile(id, function(t)
			return not self.buildings[t]
		end)
		if t then
			self:build(id, t, "City")
		end
	elseif n.built.Port == 0 and n.gold >= self:buildCost(id, "Port") then
		local t = self:pickTile(id, function(t)
			return self.coastal[t] and not self.buildings[t]
		end)
		if t then
			self:build(id, t, "Port")
		end
	elseif n.gold >= self:buildCost(id, "Defense") * 1.5 and roll < 0.75 then
		local t = self:pickTile(id, function(t)
			if not self.border[t] or self.buildings[t] then
				return false
			end
			for _, nb in ipairs(self.nb[t]) do
				local o = self.owner[nb]
				if o > 0 and o ~= id and not self:allied(id, o) then
					return true
				end
			end
			return false
		end)
		if t then
			self:build(id, t, "Defense")
		end
	elseif n.tiles > 70 and n.gold >= self:buildCost(id, "Factory") then
		local t = self:pickTile(id, function(t)
			return not self.buildings[t]
		end)
		if t then
			self:build(id, t, "Factory")
		end
	elseif n.tiles > 160 and n.built.Silo == 0 and n.gold >= self:buildCost(id, "Silo") then
		local t = self:pickTile(id, function(t)
			return not self.buildings[t] and not self.border[t]
		end)
		if t then
			self:build(id, t, "Silo")
		end
	end
	if n.built.Silo > 0 and n.gold >= cfg.NUKE_COST + 2000 and not self:isImmune() then
		local leader = self:leader()
		if leader and leader.id ~= id and not self:allied(id, leader.id) and self:rand() < 0.4 then
			local t = self:pickTile(leader.id, function(t)
				return self.buildings[t] ~= nil
			end) or self:pickTile(leader.id, function()
				return true
			end)
			if t then
				self:launchNuke(id, t)
			end
		end
	end

	-- дипломатия
	if self:rand() < 0.04 then
		for o in pairs(nbrs) do
			if o > 0 and not n.allies[o] and self.nations[o].troops > n.troops * 1.2 and self.nations[o].betrayals < 2 then
				self:requestAlliance(id, o)
				break
			end
		end
	end
	-- предать ослабевшего союзника, пока он занят войной;
	-- а если вокруг одни союзники и воевать не с кем — разорвать союз со слабейшим
	if not nbrs[0] and frac > 0.7 and self:rand() < 0.08 then
		local onlyAllies = true
		for o in pairs(nbrs) do
			if o > 0 and not n.allies[o] then
				onlyAllies = false
			end
		end
		local weakest, wt = nil, math.huge
		for o in pairs(n.allies) do
			local ally = self.nations[o]
			if nbrs[o] and (ally.troops < n.troops * 0.35 or onlyAllies) and ally.troops < wt then
				weakest, wt = o, ally.troops
			end
		end
		if weakest then
			self:breakAlliance(id, weakest)
		end
	end
end

function Core:botsTick(dt)
	for _, n in ipairs(self.nations) do
		if n.isBot and n.alive then
			n.botTimer += dt
			if n.botTimer >= self.cfg.BOT_INTERVAL + n.botPhase then
				n.botTimer = 0
				n.botPhase = 0
				if n.spawned then
					self:botThink(n)
				end
			end
		end
	end
end

-- ------------------------------------------------------------ главный цикл

function Core:startPlay()
	self.phase = "play"
	for _, n in ipairs(self.nations) do
		if not n.spawned then
			self:randomSpawn(n.id)
		end
	end
	self:broadcast("Матч начался! Щит держится " .. self.cfg.IMMUNITY_TIME .. " с — захватывай нейтральные земли")
end

function Core:step(dt)
	if self.phase == "over" then
		return
	end
	self.time += dt
	if self.phase == "spawn" then
		for _, n in ipairs(self.nations) do
			if n.isBot and not n.spawned and self.time > 1 + n.id * 0.2 then
				self:randomSpawn(n.id)
			end
		end
		if self.time >= self.cfg.SPAWN_TIME then
			self:startPlay()
		end
		return
	end
	local acc = self.acc
	acc.attack += dt
	while acc.attack >= self.cfg.ATTACK_TICK do
		acc.attack -= self.cfg.ATTACK_TICK
		self:processAttacks()
	end
	acc.econ += dt
	while acc.econ >= 1 do
		acc.econ -= 1
		self:economyTick()
		self:checkWin()
	end
	self:updateShips(dt)
	self:updateMissiles(dt)
	self:botsTick(dt)
end

-- ------------------------------------------------------------ данные для интерфейса

function Core:attackingTroops(id)
	local s = 0
	for _, at in ipairs(self.attacks) do
		if at.attacker == id and not at.done then
			s += at.troops
		end
	end
	for _, sh in ipairs(self.ships) do
		if sh.owner == id and sh.troops then
			s += sh.troops
		end
	end
	return math.floor(s)
end

function Core:snapshot()
	local list = {}
	for _, n in ipairs(self.nations) do
		table.insert(list, {
			id = n.id,
			name = n.name,
			color = n.color,
			tiles = n.tiles,
			troops = math.floor(n.troops),
			alive = n.alive,
			bot = n.isBot,
			betrayals = n.betrayals,
		})
	end
	local timer = 0
	if self.phase == "spawn" then
		timer = self.cfg.SPAWN_TIME - self.time
	elseif self:isImmune() then
		timer = self.cfg.SPAWN_TIME + self.cfg.IMMUNITY_TIME - self.time
	elseif self.phase == "play" then
		timer = self.cfg.MATCH_TIME - self.time
	end
	return { phase = self.phase, immune = self:isImmune(), timer = math.max(0, math.floor(timer)), land = self.landCount, nations = list, winner = self.winner }
end

function Core:personal(id)
	local n = self.nations[id]
	if not n then
		return nil
	end
	local costs = {}
	for _, kind in ipairs(self.cfg.BUILD_ORDER) do
		costs[kind] = self:buildCost(id, kind)
	end
	costs.Nuke = self.cfg.NUKE_COST
	local allies = {}
	for o in pairs(n.allies) do
		table.insert(allies, o)
	end
	local requests = {}
	for from in pairs(self.requests[id]) do
		table.insert(requests, from)
	end
	return {
		id = id,
		troops = math.floor(n.troops),
		max = math.floor(self:maxTroops(n)),
		gold = math.floor(n.gold),
		tiles = n.tiles,
		ratio = n.ratio,
		alive = n.alive,
		spawned = n.spawned,
		attacking = self:attackingTroops(id),
		costs = costs,
		allies = allies,
		requests = requests,
		hasSilo = n.built.Silo > 0,
	}
end

return Core
