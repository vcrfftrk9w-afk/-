-- One match: spawn phase, war, results. Runs nations, bots, economy, buildings and units,
-- and sends everything clients need through one RemoteEvent as batches of small messages.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Codec = require(Shared.Codec)
local Motion = require(Shared.Motion)
local World = require(script.Parent.World)
local Path = require(script.Parent.Path)

local W = Map.W
local CELL = 8 -- spatial grid cell size for finding targets, in tiles
local COLS = math.ceil(Map.W / CELL)
local ROWS = math.ceil(Map.H / CELL)

local Match = {}
Match.__index = Match

local function now(): number
	return workspace:GetServerTimeNow()
end

local function shuffle(list, rng: Random)
	local a = table.clone(list)
	for i = #a, 2, -1 do
		local j = rng:NextInteger(1, i)
		a[i], a[j] = a[j], a[i]
	end
	return a
end

local function nationInfo(n)
	return {
		id = n.id,
		name = n.name,
		color = n.color,
		human = n.isHuman,
		userId = n.userId or 0,
		cap = if n.cap then { n.cap.x, n.cap.y } else nil,
		alive = n.alive,
	}
end

local function buildingInfo(b)
	return { id = b.id, kind = b.kind, owner = b.n.id, x = b.x, y = b.y, hp = math.ceil(b.hp), maxHp = b.maxHp, built = b.built }
end

local function unitInfo(u)
	return {
		id = u.id,
		kind = u.kind,
		owner = u.n.id,
		path = u.path,
		t0 = u.t0,
		speed = u.speed,
		orbit = u.orbit,
		hp = math.ceil(u.hp),
		maxHp = u.maxHp,
	}
end

-- attack strength from the army: every unit adds a little
local function power(n): number
	local total = 1
	for kind, count in n.army do
		local def = Config.UNITS[kind]
		if def then
			total += count * def.power
		end
	end
	return math.min(3, total)
end

local function fmt(v: number): string
	v = math.max(0, v)
	if v < 1000 then
		return tostring(math.round(v))
	elseif v < 10000 then
		return string.format("%.2fK", v / 1000)
	elseif v < 100000 then
		return string.format("%.1fK", v / 1000)
	end
	return string.format("%dK", math.round(v / 1000))
end

function Match.new(event: RemoteEvent)
	local self = setmetatable({}, Match)
	self.event = event
	self.rng = Random.new()
	self.world = World.new(self.rng)
	self.world.onCapture = function(n, t, e)
		self:onCapture(n, t, e)
	end
	self.phase = "spawn"
	self.timer = Config.SPAWN_SECONDS
	self.nextId = 0
	self.humans = {}
	self.humanCount = 0
	self.buildings = {}
	self.nextBuildingId = 0
	self.units = {}
	self.unitCount = 0
	self.nextUnitId = 0
	self.outbox = {}
	self.tickAcc = 0
	self.netAcc = 0
	self.statAcc = 0
	self.ecoAcc = 0
	self.secAcc = 0
	self.botTimer = 0
	self.botUnitAcc = 0
	self.botOrderAcc = 0
	self.shots = {}
	self.hpDirty = {}
	self.bhpDirty = {}
	self.nb = {}
	self.nb2 = {}
	self.done = false
	local names = shuffle(Config.BOT_NAMES, self.rng)
	local colors = shuffle(Config.BOT_COLORS, self.rng)
	self.botQueue = {}
	for i = 1, Config.TOTAL_NATIONS - 1 do
		table.insert(self.botQueue, { name = names[(i - 1) % #names + 1], color = colors[(i - 1) % #colors + 1] })
	end
	for _ = 1, 9 do
		self:placeBot()
	end
	return self
end

function Match:send(msg)
	table.insert(self.outbox, msg)
end

function Match:sendTo(player: Player, msg)
	if player and player.Parent then
		self.event:FireClient(player, "batch", { msg })
	end
end

function Match:toast(n, text: string, warn: boolean?)
	if n and n.player then
		self:sendTo(n.player, { t = "toast", text = text, warn = warn or false })
	end
end

function Match:newNation(o)
	self.nextId += 1
	local n = {
		id = self.nextId,
		name = o.name,
		color = o.color,
		isHuman = o.isHuman or false,
		userId = o.userId,
		player = o.player,
		troops = o.troops or 1500,
		alive = true,
		attack = nil,
		cap = nil,
		cool = self.rng:NextInteger(0, 3),
		stuck = 0,
		army = {},
		botUnits = 0,
		unitTotal = 0,
		cities = 0,
	}
	self.world:addNation(n)
	return n
end

function Match:placedCount(): number
	local c = 0
	for _, n in self.world.nations do
		if n.cap then
			c += 1
		end
	end
	return c
end

function Match:placeBot()
	local b = table.remove(self.botQueue)
	if not b then
		return
	end
	local p = self.world:randomLand(14)
	if not p then
		return
	end
	local n = self:newNation({ name = b.name, color = b.color, troops = 900 + self.rng:NextNumber() * 1500 })
	n.cap = p
	self.world:claimDisc(n, p.x, p.y, Config.CAPITAL_RADIUS)
	self:send({ t = "nation", n = nationInfo(n) })
end

---------------------------------------------------------------- players

function Match:snapshot(player: Player)
	local nations, buildings, units = {}, {}, {}
	for _, n in self.world.nations do
		table.insert(nations, nationInfo(n))
	end
	for _, b in self.buildings do
		table.insert(buildings, buildingInfo(b))
	end
	for _, u in self.units do
		table.insert(units, unitInfo(u))
	end
	local me = self.humans[player]
	return {
		t = "snapshot",
		phase = self.phase,
		timer = self.timer,
		owners = Codec.encodeOwners(self.world.owner, Map.N),
		nations = nations,
		buildings = buildings,
		units = units,
		you = if me then me.id else 0,
		stats = self:statsArray(),
	}
end

function Match:sendSnapshot(player: Player)
	self.event:FireClient(player, "batch", { self:snapshot(player) })
end

function Match:play(player: Player)
	local n = self.humans[player]
	if n then
		self:sendSnapshot(player)
		return
	end
	if self.phase ~= "spawn" then
		self:sendSnapshot(player)
		self:sendTo(player, { t = "toast", text = "Матч уже идёт. Смотри карту, следующий начнётся после него.", warn = false })
		return
	end
	self.humanCount += 1
	n = self:newNation({
		name = player.DisplayName,
		color = Config.HUMAN_COLORS[(self.humanCount - 1) % #Config.HUMAN_COLORS + 1],
		isHuman = true,
		userId = player.UserId,
		player = player,
		troops = Config.START_TROOPS,
	})
	n.money = Config.START_MONEY
	n.income = Config.BASE_INCOME
	self.humans[player] = n
	table.remove(self.botQueue)
	self:send({ t = "nation", n = nationInfo(n) })
	self:sendSnapshot(player)
end

function Match:leave(player: Player)
	local n = self.humans[player]
	if not n then
		return
	end
	self.humans[player] = nil
	n.isHuman = false
	n.player = nil
	if not n.cap then
		-- never placed a capital: drop the nation entirely
		n.alive = false
	end
	self:send({ t = "nation", n = nationInfo(n) })
end

function Match:placeCapital(player: Player, x: number, y: number)
	local n = self.humans[player]
	if not n or self.phase ~= "spawn" then
		return
	end
	x, y = math.floor(x), math.floor(y)
	if not Map.inBounds(x, y) then
		return
	end
	local t = y * W + x
	if not Map.isLand(t) then
		self:toast(n, "Тут вода. Выбери сушу.", true)
		return
	end
	local o = self.world:ownerOf(t)
	if o ~= 0 and o ~= n.id then
		self:toast(n, "Здесь уже стоит «" .. self.world.nations[o].name .. "»", true)
		return
	end
	if n.cap then
		self.world:releaseNear(n, n.cap.x, n.cap.y, Config.CAPITAL_RADIUS + 1)
	end
	n.cap = { x = x, y = y }
	self.world:claimDisc(n, x, y, Config.CAPITAL_RADIUS)
	self:send({ t = "nation", n = nationInfo(n) })
end

function Match:attack(player: Player, x: number, y: number, pct: number)
	local n = self.humans[player]
	if not n or self.phase ~= "game" or not n.alive then
		return
	end
	x, y = math.floor(x), math.floor(y)
	if not Map.inBounds(x, y) then
		return
	end
	local t = y * W + x
	if not Map.isLand(t) then
		self:toast(n, "Через море пока не пройти. Для этого будут корабли.", true)
		return
	end
	local target = self.world:ownerOf(t)
	if target == n.id then
		self:toast(n, "Это твоя земля. Выбери постройку внизу, чтобы строить.")
		return
	end
	pct = math.clamp(pct, 5, 100) / 100
	if n.attack then
		n.troops += math.max(0, n.attack.budget)
	end
	local budget = n.troops * pct
	n.troops -= budget
	n.attack = { target = target, tx = x, ty = y, budget = budget, miss = 0, taken = 0 }
	if target ~= 0 then
		self:toast(n, "Атака на «" .. self.world.nations[target].name .. "» · " .. fmt(budget) .. " войск")
	else
		self:toast(n, "Захват земли · " .. fmt(budget) .. " войск")
	end
end

local function lackText(n, cost: number): string
	return "Не хватает денег: нужно ещё " .. math.ceil(cost - n.money) .. " $"
end

-- a player's own finished factory, or nil
function Match:factoryOf(player: Player, id: number)
	local n = self.humans[player]
	local b = self.buildings[id]
	if not n or not b or b.n ~= n or self.phase ~= "game" or not Config.BUILD[b.kind].units then
		return nil, nil
	end
	return n, b
end

local function makes(b, kind: string): boolean
	return table.find(Config.BUILD[b.kind].units, kind) ~= nil
end

-- orders one unit from a factory; it is paid now and refunded if cancelled
function Match:queueUnit(player: Player, id: number, kind: string)
	local n, b = self:factoryOf(player, id)
	if not n or not makes(b, kind) then
		return
	end
	local cost = Config.UNITS[kind].cost
	if #b.queue >= Config.MAX_QUEUE then
		self:toast(n, "Очередь полная: не больше " .. Config.MAX_QUEUE .. " юнитов.", true)
		return
	end
	if n.money < cost then
		self:toast(n, lackText(n, cost), true)
		return
	end
	n.money -= cost
	table.insert(b.queue, kind)
	if b.built < 1 then
		self:toast(n, "Заказ принят. Начнётся, когда достроят: " .. Config.BUILD[b.kind].name)
	end
	self:sendEconomy()
end

-- removes the last ordered unit and returns its money
function Match:cancelUnit(player: Player, id: number)
	local n, b = self:factoryOf(player, id)
	if not n or #b.queue == 0 then
		return
	end
	local kind = table.remove(b.queue)
	n.money += Config.UNITS[kind].cost
	if #b.queue == 0 and not b.autoPaid then
		b.prog = 0
	end
	self:sendEconomy()
end

-- kind = unit to repeat while the queue is empty, or "" to switch it off
function Match:setAuto(player: Player, id: number, kind: string)
	local n, b = self:factoryOf(player, id)
	if not n or (kind ~= "" and not makes(b, kind)) then
		return
	end
	if b.autoPaid and b.autoPaid ~= kind and #b.queue == 0 then
		n.money += Config.UNITS[b.autoPaid].cost
		b.autoPaid = nil
		b.prog = 0
	end
	b.auto = if kind ~= "" then kind else nil
	self:sendEconomy()
end

-- new units from this factory drive to the rally point
function Match:setRally(player: Player, id: number, x: number, y: number)
	local n, b = self:factoryOf(player, id)
	if not n or not Map.inBounds(math.floor(x), math.floor(y)) then
		return
	end
	b.rally = { x = math.floor(x) + 0.5, y = math.floor(y) + 0.5 }
	self:toast(n, "Точка сбора поставлена: новые юниты поедут туда.")
end

function Match:build(player: Player, kind: string, x: number, y: number)
	local n = self.humans[player]
	local def = Config.BUILD[kind]
	if not n or not def or self.phase ~= "game" or not n.alive then
		return
	end
	x, y = math.floor(x), math.floor(y)
	if not Map.inBounds(x, y) then
		return
	end
	local t = y * W + x
	if self.world:ownerOf(t) ~= n.id then
		self:toast(n, "Строить можно только на своей земле.", true)
		return
	end
	if def.onDeposit and Map.deposit(t) == 0 then
		self:toast(n, "Экстрактор ставится только на месторождение: рыжие, серые или чёрные пятна на карте.", true)
		return
	end
	if n.money < def.cost then
		self:toast(n, lackText(n, def.cost), true)
		return
	end
	if not self:addBuilding(n, kind, x, y) then
		self:toast(n, "Тут тесно. Отступи на клетку от других построек.", true)
		return
	end
	n.money -= def.cost
	local extra = if def.units then ". Когда достроят, нажми на неё и заказывай войска" else ""
	self:toast(n, "Строится: " .. def.name .. " (" .. def.time .. " с)" .. extra)
end

---------------------------------------------------------------- buildings and units

function Match:addBuilding(n, kind: string, x: number, y: number): boolean
	x = math.clamp(x, 0, Map.W - 1)
	y = math.clamp(y, 0, Map.H - 1)
	local t = y * W + x
	if not Map.isLand(t) or self.world:ownerOf(t) ~= n.id then
		return false
	end
	for _, b in self.buildings do
		if math.abs(b.x - x) <= 1 and math.abs(b.y - y) <= 1 then
			return false
		end
	end
	-- capitals stand on the map as buildings too
	for _, other in self.world.nations do
		if other.cap and math.abs(other.cap.x - x) <= 1 and math.abs(other.cap.y - y) <= 1 then
			return false
		end
	end
	self.nextBuildingId += 1
	local def = Config.BUILD[kind]
	local b = {
		id = self.nextBuildingId,
		kind = kind,
		n = n,
		t = t,
		x = x,
		y = y,
		px = x + 0.5,
		py = y + 0.5,
		hp = def.hp,
		maxHp = def.hp,
		isBuilding = true,
		-- players' buildings take time to build; bots get theirs ready
		built = if n.isHuman then 0 else 1,
		prog = if n.isHuman then 0 else self.rng:NextNumber() * 0.5,
		queue = {},
		auto = nil,
		autoPaid = nil,
		blocked = false,
	}
	self.buildings[b.id] = b
	if kind == "city" then
		n.cities += 1
	end
	self:send({ t = "building", b = buildingInfo(b) })
	return true
end

function Match:removeBuilding(b)
	if not self.buildings[b.id] then
		return
	end
	self.buildings[b.id] = nil
	self.bhpDirty[b] = nil
	if b.kind == "city" then
		b.n.cities = math.max(0, b.n.cities - 1)
	end
	self:send({ t = "bgone", id = b.id })
end

-- creates a unit next to (x, y); returns false when a limit is reached
-- creates a unit next to (x, y); returns the unit, or nil when a limit is reached
function Match:spawnUnit(n, kind: string, x: number, y: number, rally)
	local cap = if n.isHuman then Config.MAX_UNITS_PER_NATION else Config.BOT_MAX_UNITS
	if self.unitCount >= Config.MAX_UNITS or not n.cap or n.unitTotal >= cap then
		return nil
	end
	local def = Config.UNITS[kind]
	if not def.air then
		-- new units wait just below their factory, so they don't cover it
		local lx, ly = Path.nearestLand(x + self.rng:NextNumber() * 2 - 1, y + 1.5 + self.rng:NextNumber(), 3)
		if lx then
			x, y = lx + 0.5, ly + 0.5
		end
	end
	self.nextUnitId += 1
	self.unitCount += 1
	local u = {
		id = self.nextUnitId,
		kind = kind,
		air = def.air == true,
		n = n,
		hp = def.hp,
		maxHp = def.hp,
		speed = def.speed,
		t0 = now(),
		path = { x, y },
		px = x,
		py = y,
		shotAt = 0,
		orderedAt = 0,
	}
	if u.air then
		local r = 3 + self.rng:NextNumber() * 2
		u.orbit = { r = r, a0 = self.rng:NextNumber() * math.pi * 2, w = (if self.rng:NextNumber() < 0.5 then 1 else -1) * 2.6 / r }
	end
	n.army[kind] = (n.army[kind] or 0) + 1
	n.unitTotal += 1
	self.units[u.id] = u
	if rally then
		local a, r = self.rng:NextNumber() * math.pi * 2, self.rng:NextNumber() * 1.5
		self:orderUnit(u, rally.x + math.cos(a) * r, rally.y + math.sin(a) * r, 15000)
	else
		self:send({ t = "unit", u = unitInfo(u) })
	end
	return u
end

function Match:removeUnit(u)
	if self.units[u.id] then
		self.units[u.id] = nil
		self.hpDirty[u] = nil
		self.unitCount -= 1
		u.n.army[u.kind] = math.max(0, u.n.army[u.kind] - 1)
		u.n.unitTotal = math.max(0, u.n.unitTotal - 1)
		self:send({ t = "ugone", id = u.id })
	end
end

-- sends one unit towards (tx, ty) along a land route (aircraft fly straight)
function Match:orderUnit(u, tx: number, ty: number, maxNodes: number)
	local t = now()
	local x, y = Motion.position(u, t)
	tx, ty = Path.inMap(tx, ty)
	if u.air then
		u.path = { x, y, tx, ty }
	else
		u.path = Path.ground(x, y, tx, ty, maxNodes)
	end
	u.t0 = t
	u.orderedAt = t
	self:send({ t = "unit", u = unitInfo(u) })
end

-- a player's move order for several units; they spread out around the target
function Match:move(player: Player, ids, tx: number, ty: number)
	local n = self.humans[player]
	if not n or self.phase ~= "game" or not n.alive then
		return
	end
	local list = {}
	for _, id in ids do
		local u = self.units[id]
		if u and u.n == n then
			table.insert(list, u)
			if #list >= 80 then
				break
			end
		end
	end
	if #list == 0 then
		return
	end
	tx, ty = Path.inMap(math.floor(tx) + 0.5, math.floor(ty) + 0.5)
	local t = now()
	local budget = 60000
	local leader = nil
	for i, u in list do
		local ox, oy = 0, 0
		if i > 1 then
			local a, r = i * 2.4, 0.75 * math.sqrt(i)
			ox, oy = math.cos(a) * r, math.sin(a) * r
		end
		local gx, gy = Path.inMap(tx + ox, ty + oy)
		local x, y = Motion.position(u, t)
		if u.air then
			u.path = { x, y, gx, gy }
		elseif leader and #leader >= 4 and (leader[1] - x) ^ 2 + (leader[2] - y) ^ 2 < 400 and Path.clear(x, y, leader[3], leader[4]) then
			-- close to the first unit: follow its route
			local p = { x, y }
			for k = 3, #leader - 2 do
				table.insert(p, leader[k])
			end
			table.insert(p, gx)
			table.insert(p, gy)
			u.path = p
		else
			local nodes = if budget > 0 then math.min(budget, 25000) else 1500
			budget -= nodes
			u.path = Path.ground(x, y, gx, gy, nodes)
			if not leader then
				leader = u.path
			end
		end
		u.t0 = t
		u.orderedAt = t
		self:send({ t = "unit", u = unitInfo(u) })
	end
end

-- bots send idle units to their border, towards whoever they are attacking
function Match:botOrders()
	local t = now()
	local issued = 0
	for _, u in self.units do
		local n = u.n
		if not n.isHuman and n.alive and t - u.orderedAt > 6 + u.id % 7 then
			local _, _, arrived = Motion.position(u, t)
			if arrived then
				local a = n.attack
				local f = if a then self.world:pickFront(n, a.tx, a.ty, 10) else self.world:pickFront(n, u.px, u.py, 8)
				if f >= 0 then
					self:orderUnit(u, f % W + 0.5, f // W + 0.5, 6000)
				else
					u.orderedAt = t
				end
				issued += 1
				if issued >= 4 then
					return
				end
			end
		end
	end
end

-- a ground unit standing on foreign land takes it, if the tile touches its own country
function Match:unitCapture(n, t: number)
	if not Map.isLand(t) then
		return
	end
	local o = self.world:ownerOf(t)
	if o == n.id then
		return
	end
	local nb = self.nb2
	local c = Map.neighbors(t, nb)
	for i = 1, c do
		if self.world:ownerOf(nb[i]) == n.id then
			self.world:setOwner(t, n.id)
			if o ~= 0 then
				local e = self.world.nations[o]
				e.troops = math.max(0, e.troops - 2)
				self:onCapture(n, t, e)
			end
			return
		end
	end
end

-- targeting, damage, deaths and capturing land under units
function Match:tickCombat(dt: number)
	local t = now()
	local grid = {}
	local function insert(o)
		local cx = math.clamp(math.floor(o.px / CELL), 0, COLS - 1)
		local cy = math.clamp(math.floor(o.py / CELL), 0, ROWS - 1)
		local key = cy * COLS + cx
		local cell = grid[key]
		if not cell then
			cell = {}
			grid[key] = cell
		end
		table.insert(cell, o)
	end
	for _, u in self.units do
		local x, y = Motion.position(u, t)
		u.px, u.py = x, y
		insert(u)
	end
	for _, b in self.buildings do
		insert(b)
	end

	local function findTarget(sx: number, sy: number, range: number, owner, ground: boolean, air: boolean)
		local best, bestD = nil, range * range
		local c0x = math.clamp(math.floor((sx - range) / CELL), 0, COLS - 1)
		local c1x = math.clamp(math.floor((sx + range) / CELL), 0, COLS - 1)
		local c0y = math.clamp(math.floor((sy - range) / CELL), 0, ROWS - 1)
		local c1y = math.clamp(math.floor((sy + range) / CELL), 0, ROWS - 1)
		for cy = c0y, c1y do
			for cx = c0x, c1x do
				local cell = grid[cy * COLS + cx]
				if cell then
					for _, o in cell do
						if o.n ~= owner and o.hp > 0 then
							if (o.air and air) or (not o.air and ground) then
								local d = (o.px - sx) ^ 2 + (o.py - sy) ^ 2
								if d <= bestD then
									bestD = d
									best = o
								end
							end
						end
					end
				end
			end
		end
		return best
	end

	local function fire(attacker, kind: string, dps: number, range: number, hitsAir: number, groundToo: boolean, vsBuildings: number)
		local target = attacker.target
		if target then
			local gone = target.hp <= 0 or (if target.isBuilding then not self.buildings[target.id] else not self.units[target.id])
			if gone or (target.px - attacker.px) ^ 2 + (target.py - attacker.py) ^ 2 > range * range then
				target = nil
			end
		end
		if not target then
			target = findTarget(attacker.px, attacker.py, range, attacker.n, groundToo, hitsAir > 0)
			attacker.target = target
		end
		if not target then
			return
		end
		local mult
		if target.air then
			mult = hitsAir
		elseif target.isBuilding then
			mult = vsBuildings
		else
			local vs = Config.VS[kind]
			mult = if vs and vs[target.kind] then vs[target.kind] else 1
		end
		target.hp -= dps * dt * mult
		if target.isBuilding then
			self.bhpDirty[target] = true
		else
			self.hpDirty[target] = true
		end
		if t - attacker.shotAt > 0.7 and #self.shots < 240 then
			attacker.shotAt = t
			table.insert(self.shots, math.round(attacker.px * 10) / 10)
			table.insert(self.shots, math.round(attacker.py * 10) / 10)
			table.insert(self.shots, math.round(target.px * 10) / 10)
			table.insert(self.shots, math.round(target.py * 10) / 10)
		end
	end

	for _, u in self.units do
		local def = Config.UNITS[u.kind]
		fire(u, u.kind, def.dps, def.range, def.hitsAir, def.hitsGround ~= false, def.vsBuildings or 1)
	end
	for _, b in self.buildings do
		local def = Config.BUILD[b.kind]
		if def.dps and b.n.alive and b.built >= 1 then
			fire(b, b.kind, def.dps, def.range, def.hitsAir, not def.airOnly, 1)
		end
	end

	for _, u in self.units do
		if u.hp <= 0 then
			self:send({ t = "boom", x = u.px, y = u.py, big = u.kind ~= "infantry" and u.kind ~= "rocket" })
			self:removeUnit(u)
		end
	end
	for _, b in self.buildings do
		if b.hp <= 0 then
			self:send({ t = "boom", x = b.px, y = b.py, big = true })
			self:toast(b.n, "Враги разрушили: " .. Config.BUILD[b.kind].name, true)
			self:removeBuilding(b)
		end
	end

	local nb = self.nb
	for _, u in self.units do
		if not u.air then
			local tx, ty = math.floor(u.px), math.floor(u.py)
			if Map.inBounds(tx, ty) then
				local tile = ty * W + tx
				self:unitCapture(u.n, tile)
				local c = Map.neighbors(tile, nb)
				for i = 1, c do
					self:unitCapture(u.n, nb[i])
				end
			end
		end
	end
end

function Match:onCapture(n, t: number, enemy)
	if (n.isHuman or enemy.isHuman) and self.rng:NextNumber() < 0.14 then
		self:send({ t = "fx", x = t % W + 0.5, y = t // W + 0.5 })
	end
end

function Match:killNation(n)
	n.alive = false
	n.attack = nil
	for _, u in self.units do
		if u.n == n then
			self:removeUnit(u)
		end
	end
	for _, b in self.buildings do
		if b.n == n then
			self:removeBuilding(b)
		end
	end
	self:send({ t = "nation", n = nationInfo(n) })
	if n.player then
		self:sendTo(n.player, { t = "defeat" })
	end
end

---------------------------------------------------------------- phases

function Match:beginWar()
	for _, n in self.humans do
		if not n.cap then
			local p = self.world:randomLand(10)
			if p then
				n.cap = p
				self.world:claimDisc(n, p.x, p.y, Config.CAPITAL_RADIUS)
				self:send({ t = "nation", n = nationInfo(n) })
				self:toast(n, "Столица поставлена автоматически")
			end
		end
	end
	while #self.botQueue > 0 and self:placedCount() < Config.TOTAL_NATIONS do
		self:placeBot()
	end
	self.phase = "game"
	self.timer = Config.MATCH_SECONDS
	self:send({ t = "phase", phase = "game", timer = self.timer })
	local kinds = { "city", "barracks", "barracks", "tankf", "tower", "air" }
	for _, n in self.world.nations do
		if not n.isHuman and n.cap then
			if self.rng:NextNumber() < 0.55 then
				local kind = kinds[self.rng:NextInteger(1, #kinds)]
				self:addBuilding(n, kind, n.cap.x + self.rng:NextInteger(-2, 2), n.cap.y + self.rng:NextInteger(-2, 2))
			end
			if self.rng:NextNumber() < 0.3 then
				self:spawnUnit(n, "tank", n.cap.x + 0.5, n.cap.y + 0.5)
			end
			if self.rng:NextNumber() < 0.18 then
				self:spawnUnit(n, if self.rng:NextNumber() < 0.5 then "gunship" else "fighter", n.cap.x + 0.5, n.cap.y + 0.5)
			end
		end
	end
end

function Match:endMatch(winner, reason: string)
	self.phase = "ended"
	self.timer = Config.RESULT_SECONDS
	local ranking = {}
	for _, n in self.world.nations do
		if n.alive and n.count > 0 then
			table.insert(ranking, n)
		end
	end
	table.sort(ranking, function(a, b)
		return a.count > b.count
	end)
	local top = {}
	for i = 1, math.min(5, #ranking) do
		local n = ranking[i]
		table.insert(top, { id = n.id, name = n.name, share = n.count / Map.landCount })
	end
	self:send({
		t = "phase",
		phase = "ended",
		timer = self.timer,
		winner = if winner then winner.id else 0,
		winnerName = if winner then winner.name else "",
		reason = reason,
		top = top,
	})
end

function Match:checkEnd()
	local biggest = nil
	for _, n in self.world.nations do
		if n.alive and (not biggest or n.count > biggest.count) then
			biggest = n
		end
	end
	if biggest and biggest.count >= Config.WIN_SHARE * Map.landCount then
		self:endMatch(biggest, "share")
		return
	end
	if self.timer <= 0 then
		self:endMatch(biggest, "time")
		return
	end
	local humansAlive = false
	for _, n in self.humans do
		if n.alive then
			humansAlive = true
			break
		end
	end
	if not humansAlive then
		self:endMatch(biggest, "nohumans")
	end
end

---------------------------------------------------------------- simulation

function Match:tick()
	local dt = Config.TICK
	local world = self.world
	local rng = self.rng
	for _, n in world.nations do
		if not n.alive then
			continue
		end
		if n.count <= 0 then
			self:killNation(n)
			continue
		end
		local cap = 1400 + n.count * 22 + n.cities * 1500
		local grown = math.max(0, cap - n.troops) * 0.006 + (if n.isHuman then 2.2 else 1.6) + n.cities * 0.8
		n.troops += grown
		if not n.isHuman and not n.attack then
			n.cool -= 1
			if n.cool <= 0 then
				n.cool = 1 + rng:NextInteger(0, 2)
				local claims = math.clamp(math.round(math.sqrt(n.count) / 5), 1, 9)
				local got = world:grow(n, 0, 0, 0, claims, false)
				n.troops = math.max(0, n.troops - got * 1.2 / math.sqrt(power(n)))
				if got == 0 then
					n.stuck += 1
					if n.stuck > 8 and rng:NextNumber() < 0.05 and n.troops > 900 then
						local e = world:findNeighbor(n)
						if e and e.count > 0 and (not e.isHuman or rng:NextNumber() < 0.3) then
							local budget = n.troops * (0.22 + rng:NextNumber() * 0.2)
							n.troops -= budget
							n.attack = { target = e.id, tx = e.sx / e.count, ty = e.sy / e.count, budget = budget, miss = 0, taken = 0 }
						end
					end
				else
					n.stuck = 0
				end
			end
		end
		local a = n.attack
		if a then
			local claims = math.clamp(math.round(2 + math.sqrt(#n.front) * 0.32), 2, 16)
			local got = world:grow(n, a.target, a.tx, a.ty, claims, true)
			local per
			if a.target ~= 0 then
				local d = world.nations[a.target]
				per = 3.2 * power(d) / power(n)
			else
				per = 1.4 / math.sqrt(power(n))
			end
			a.budget -= got * per + 0.4
			a.taken += got
			a.miss = if got > 0 then 0 else a.miss + 1
			local targetDead = a.target ~= 0 and not world.nations[a.target].alive
			if a.miss > 6 or a.budget <= 0 or targetDead then
				n.troops += math.max(0, a.budget)
				if n.isHuman and a.taken == 0 then
					self:toast(n, "Туда не дойти: нет общей границы. Нажми ближе к своей стране.", true)
				end
				n.attack = nil
			end
		end
	end
	self:tickEconomy(dt)
	self:tickCombat(dt)
end

function Match:tickEconomy(dt: number)
	local world = self.world
	for _, n in self.humans do
		n.income = Config.BASE_INCOME + n.count * Config.LAND_INCOME
	end
	for _, b in self.buildings do
		local n = b.n
		if world:ownerOf(b.t) ~= n.id then
			self:removeBuilding(b)
			continue
		end
		local def = Config.BUILD[b.kind]
		if b.built < 1 then
			b.built = math.min(1, b.built + dt / def.time)
			if b.built >= 1 then
				self:send({ t = "bdone", id = b.id })
				self:toast(n, "Достроено: " .. def.name)
			end
			continue
		end
		if def.income and n.isHuman then
			n.income += def.income
		end
		if not def.units then
			continue
		end
		if not n.isHuman then
			b.prog += dt / 40
			if b.prog >= 1 then
				b.prog = 0
				if n.alive then
					self:spawnUnit(n, def.units[self.rng:NextInteger(1, #def.units)], b.x + 0.5, b.y + 0.5)
				end
			end
			continue
		end
		-- queued units are paid when ordered; in auto mode each unit is paid when it starts
		b.blocked = false
		local current = b.queue[1]
		if not current and b.auto then
			if not b.autoPaid then
				local cost = Config.UNITS[b.auto].cost
				if n.money >= cost then
					n.money -= cost
					b.autoPaid = b.auto
				else
					b.blocked = true
				end
			end
			current = b.autoPaid
		end
		if current then
			if n.unitTotal >= Config.MAX_UNITS_PER_NATION then
				b.blocked = true
			else
				b.prog = math.min(1, b.prog + dt / Config.UNITS[current].time)
				if b.prog >= 1 then
					self:spawnUnit(n, current, b.x + 0.5, b.y + 0.5, b.rally)
					b.prog = 0
					if b.queue[1] then
						table.remove(b.queue, 1)
					else
						b.autoPaid = nil
					end
				end
			end
		end
	end
	for _, n in self.humans do
		n.money += n.income * dt
	end
end

function Match:statsArray()
	local s = {}
	for _, n in self.world.nations do
		local troops = n.troops + (if n.attack then math.max(0, n.attack.budget) else 0)
		table.insert(s, n.id)
		table.insert(s, math.round(troops))
	end
	return s
end

function Match:sendEconomy()
	for player, n in self.humans do
		local list = {}
		for _, b in self.buildings do
			if b.n == n then
				table.insert(list, {
					id = b.id,
					p = if b.blocked then -math.max(b.prog, 0.001) else b.prog,
					built = b.built,
					q = b.queue,
					auto = b.auto or "",
				})
			end
		end
		self:sendTo(player, {
			t = "eco",
			money = math.floor(n.money),
			income = n.income,
			army = n.army,
			list = list,
		})
	end
end

function Match:flush()
	if next(self.hpDirty) then
		local list = {}
		for u in self.hpDirty do
			table.insert(list, u.id)
			table.insert(list, math.max(0, math.ceil(u.hp)))
		end
		self.hpDirty = {}
		table.insert(self.outbox, { t = "hp", s = list })
	end
	if next(self.bhpDirty) then
		local list = {}
		for b in self.bhpDirty do
			table.insert(list, b.id)
			table.insert(list, math.max(0, math.ceil(b.hp)))
		end
		self.bhpDirty = {}
		table.insert(self.outbox, { t = "bhp", s = list })
	end
	if #self.shots > 0 then
		table.insert(self.outbox, { t = "shots", s = self.shots })
		self.shots = {}
	end
	local changes = self.world:takeChanges()
	if #changes > 0 then
		table.insert(self.outbox, { t = "delta", d = Codec.packChanges(changes) })
	end
	if #self.outbox > 0 then
		self.event:FireAllClients("batch", self.outbox)
		self.outbox = {}
	end
end

function Match:step(dt: number)
	if self.phase == "spawn" then
		self.timer -= dt
		self.botTimer += dt
		if self.botTimer > 0.32 and #self.botQueue > 0 and self:placedCount() < Config.TOTAL_NATIONS and self.rng:NextNumber() < 0.55 then
			self.botTimer = 0
			self:placeBot()
		end
		if self.timer <= 0 then
			self:beginWar()
		end
	elseif self.phase == "game" then
		self.timer -= dt
		self.tickAcc += dt
		local steps = 0
		while self.tickAcc >= Config.TICK and steps < 3 do
			self.tickAcc -= Config.TICK
			steps += 1
			self:tick()
		end
		if steps >= 3 then
			self.tickAcc = 0
		end
		self.secAcc += dt
		if self.secAcc >= 1 then
			self.secAcc = 0
			self:checkEnd()
		end
		self.botUnitAcc += dt
		if self.botUnitAcc > 25 then
			self.botUnitAcc = 0
			local candidates = {}
			for _, n in self.world.nations do
				if n.alive and not n.isHuman and n.count > 200 and n.unitTotal < Config.BOT_MAX_UNITS then
					table.insert(candidates, n)
				end
			end
			if #candidates > 0 then
				local n = candidates[self.rng:NextInteger(1, #candidates)]
				local kinds = { "infantry", "rocket", "scout", "tank", "tank", "artillery" }
				self:spawnUnit(n, kinds[self.rng:NextInteger(1, #kinds)], n.cap.x + 0.5, n.cap.y + 0.5)
			end
		end
		self.botOrderAcc += dt
		if self.botOrderAcc >= 0.5 then
			self.botOrderAcc = 0
			self:botOrders()
		end
		self.ecoAcc += dt
		if self.ecoAcc >= 0.5 then
			self.ecoAcc = 0
			self:sendEconomy()
		end
	elseif self.phase == "ended" then
		self.timer -= dt
		if self.timer <= 0 then
			self.done = true
		end
	end
	self.statAcc += dt
	if self.statAcc >= 0.5 then
		self.statAcc = 0
		self:send({ t = "stats", s = self:statsArray(), phase = self.phase, timer = self.timer })
	end
	self.netAcc += dt
	if self.netAcc >= Config.NET_RATE then
		self.netAcc = 0
		self:flush()
	end
end

return Match
