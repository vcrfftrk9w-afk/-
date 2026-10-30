-- One skirmish: four bases on the map, each run by a player or a bot. Runs the economy,
-- buildings, factories, units, combat and the bots, and sends clients everything as batches
-- of small messages through one RemoteEvent. A base is lost with its command centre.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Motion = require(Shared.Motion)
local Orders = require(script.Parent.Orders)
local Path = require(script.Parent.Path)

local W, H = Map.W, Map.H
local CELL = 8 -- spatial grid cell size for finding targets, in tiles
local COLS = math.ceil(W / CELL)
local ROWS = math.ceil(H / CELL)

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
		cap = if n.cc then { n.cc.x + 1, n.cc.y + 1 } else nil,
		alive = n.alive,
	}
end

local function buildingInfo(b)
	return { id = b.id, kind = b.kind, owner = b.n.id, x = b.x, y = b.y, size = b.size, hp = math.ceil(b.hp), maxHp = b.maxHp, built = b.built }
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

local function overlaps(ax: number, ay: number, as: number, bx: number, by: number, bs: number): boolean
	return ax < bx + bs and bx < ax + as and ay < by + bs and by < ay + as
end

local function lackText(n, cost: number): string
	return "Не хватает денег: нужно ещё " .. math.ceil(cost - n.money) .. " $"
end

---------------------------------------------------------------- setup

function Match.new(event: RemoteEvent)
	local self = setmetatable({}, Match)
	self.event = event
	self.rng = Random.new()
	self.phase = "game"
	self.timer = Config.MATCH_SECONDS
	self.joinTimer = Config.JOIN_SECONDS
	self.nations = {}
	self.seats = {}
	self.humans = {}
	self.buildings = {}
	self.nextBuildingId = 0
	self.units = {}
	self.unitCount = 0
	self.nextUnitId = 0
	self.outbox = {}
	self.tickAcc = 0
	self.netAcc = 0
	self.ecoAcc = 0
	self.secAcc = 0
	self.botAcc = 0
	self.orderAcc = 0
	self.grid = {}
	self.shots = {}
	self.hpDirty = {}
	self.bhpDirty = {}
	self.done = false
	local names = shuffle(Config.BOT_NAMES, self.rng)
	for i = 1, math.min(Config.SEATS, #Map.starts) do
		local start = Map.starts[i]
		local n = {
			id = i,
			name = names[i],
			botName = names[i],
			color = Config.SEAT_COLORS[i],
			isHuman = false,
			alive = true,
			money = Config.START_MONEY,
			income = 0,
			army = {},
			unitTotal = 0,
			-- the first wave waits 3.5-4.5 minutes, so a new player has time to set up a defence
			bot = { think = self.rng:NextNumber() * 2, wave = 210 + self.rng:NextNumber() * 60, step = 1 },
		}
		self.nations[i] = n
		table.insert(self.seats, n)
		n.cc = self:addBuilding(n, "cc", start.x - 1, start.y - 1, true)
		for k, kind in { "infantry", "infantry", "scout" } do
			self:spawnUnit(n, kind, start.x - 1.5 + k, start.y + 3)
		end
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
	if n.isHuman and n.player then
		self:sendTo(n.player, { t = "toast", text = text, warn = warn or false })
	end
end

function Match:snapshot(player: Player)
	local me = self.humans[player]
	local nations, buildings, units = {}, {}, {}
	for _, n in self.seats do
		table.insert(nations, nationInfo(n))
	end
	for _, b in self.buildings do
		table.insert(buildings, buildingInfo(b))
	end
	for _, u in self.units do
		table.insert(units, unitInfo(u))
	end
	return {
		t = "snapshot",
		phase = self.phase,
		timer = self.timer,
		you = if me then me.id else 0,
		nations = nations,
		buildings = buildings,
		units = units,
	}
end

function Match:sendSnapshot(player: Player)
	self:sendTo(player, self:snapshot(player))
end

---------------------------------------------------------------- players

-- a player takes a bot's base while the match is young; later they watch
function Match:play(player: Player)
	if self.humans[player] then
		self:sendSnapshot(player)
		return
	end
	if self.phase == "game" and self.joinTimer > 0 then
		for _, n in self.seats do
			if n.alive and not n.isHuman then
				n.isHuman = true
				n.player = player
				n.name = player.DisplayName
				n.userId = player.UserId
				self.humans[player] = n
				self:send({ t = "nation", n = nationInfo(n) })
				self:sendSnapshot(player)
				self:sendEconomy()
				return
			end
		end
	end
	self:sendSnapshot(player)
	self:sendTo(player, { t = "toast", text = "Все базы заняты. Смотри бой — следующий начнётся после него.", warn = false })
end

-- the base goes back to a bot
function Match:leave(player: Player)
	local n = self.humans[player]
	if not n then
		return
	end
	self.humans[player] = nil
	n.isHuman = false
	n.player = nil
	n.userId = 0
	n.name = n.botName
	self:send({ t = "nation", n = nationInfo(n) })
end

function Match:humanCount(): number
	local c = 0
	for _ in self.humans do
		c += 1
	end
	return c
end

---------------------------------------------------------------- building

function Match:areaFree(x: number, y: number, size: number): boolean
	for _, b in self.buildings do
		if overlaps(x, y, size, b.x, b.y, b.size) then
			return false
		end
	end
	return true
end

function Match:groundOk(x: number, y: number, size: number): boolean
	for ty = y, y + size - 1 do
		for tx = x, x + size - 1 do
			if not Map.inBounds(tx, ty) or not Map.isLand(ty * W + tx) then
				return false
			end
		end
	end
	return true
end

function Match:nearBase(n, cx: number, cy: number): boolean
	local r2 = Config.BUILD_RADIUS * Config.BUILD_RADIUS
	for _, b in self.buildings do
		if b.n == n and (b.px - cx) ^ 2 + (b.py - cy) ^ 2 <= r2 then
			return true
		end
	end
	return false
end

-- where a building of this kind goes for a tap at (x, y): its top-left tile, or nil and why not
function Match:placeFor(n, kind: string, x: number, y: number): (number?, number?, string?)
	local def = Config.BUILD[kind]
	local size = def.size
	x, y = math.floor(x), math.floor(y)
	local bx, by
	if def.onPool then
		local best, bd = nil, 3.5 * 3.5
		for _, p in Map.pools do
			local d = (p.x + 1 - (x + 0.5)) ^ 2 + (p.y + 1 - (y + 0.5)) ^ 2
			if d < bd and self:areaFree(p.x, p.y, 2) then
				best, bd = p, d
			end
		end
		if not best then
			return nil, nil, "Экстрактор ставится на свободное месторождение — светящуюся воронку."
		end
		bx, by = best.x, best.y
	else
		bx, by = x - size // 2, y - size // 2
	end
	if not self:groundOk(bx, by, size) then
		return nil, nil, "Тут нельзя строить: вода, скалы или край карты."
	end
	if not self:areaFree(bx, by, size) then
		return nil, nil, "Тут тесно: место занято другой постройкой."
	end
	if not def.onPool then
		for _, p in Map.pools do
			if overlaps(bx, by, size, p.x, p.y, 2) then
				return nil, nil, "Месторождения оставь для экстракторов."
			end
		end
	end
	if not self:nearBase(n, bx + size / 2, by + size / 2) then
		return nil, nil, "Строить можно только рядом со своей базой."
	end
	return bx, by, nil
end

function Match:build(player: Player, kind: string, x: number, y: number)
	local n = self.humans[player]
	local def = Config.BUILD[kind]
	if not n or not def or not def.cost or self.phase ~= "game" or not n.alive then
		return
	end
	local bx, by, why = self:placeFor(n, kind, x, y)
	if not bx or not by then
		self:toast(n, why or "Тут нельзя строить.", true)
		return
	end
	if n.money < def.cost then
		self:toast(n, lackText(n, def.cost), true)
		return
	end
	n.money -= def.cost
	self:addBuilding(n, kind, bx, by, false)
	local extra = if def.units then ". Когда достроят, нажми на неё и заказывай войска" else ""
	self:toast(n, "Строится: " .. def.name .. " (" .. def.time .. " с)" .. extra)
	self:sendEconomy()
end

function Match:addBuilding(n, kind: string, x: number, y: number, ready: boolean)
	local def = Config.BUILD[kind]
	self.nextBuildingId += 1
	local b = {
		id = self.nextBuildingId,
		kind = kind,
		n = n,
		x = x,
		y = y,
		size = def.size,
		px = x + def.size / 2,
		py = y + def.size / 2,
		hp = def.hp,
		maxHp = def.hp,
		isBuilding = true,
		built = if ready then 1 else 0,
		prog = 0,
		queue = {},
		auto = nil,
		autoPaid = nil,
		blocked = false,
		shotAt = 0,
	}
	self.buildings[b.id] = b
	self:send({ t = "building", b = buildingInfo(b) })
	return b
end

function Match:removeBuilding(b)
	if not self.buildings[b.id] then
		return
	end
	self.buildings[b.id] = nil
	self.bhpDirty[b] = nil
	self:send({ t = "bgone", id = b.id })
	if b == b.n.cc and b.n.alive then
		self:killNation(b.n)
	end
end

-- a base without its command centre is out: everything it has left falls
function Match:killNation(n)
	n.alive = false
	n.cc = nil
	for _, b in self.buildings do
		if b.n == n then
			self:send({ t = "boom", x = b.px, y = b.py, big = true })
			self:removeBuilding(b)
		end
	end
	for _, u in self.units do
		if u.n == n then
			self:removeUnit(u)
		end
	end
	self:send({ t = "nation", n = nationInfo(n) })
	for _, other in self.seats do
		if other ~= n then
			self:toast(other, "База «" .. n.name .. "» разгромлена!")
		end
	end
	if n.isHuman and n.player then
		self:sendTo(n.player, { t = "defeat" })
	end
end

---------------------------------------------------------------- factories

-- a player's own factory, or nil
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

---------------------------------------------------------------- units

-- creates a unit next to (x, y); returns the unit, or nil when a limit is reached
function Match:spawnUnit(n, kind: string, x: number, y: number, rally)
	if self.unitCount >= Config.MAX_UNITS or n.unitTotal >= Config.MAX_UNITS_PER_NATION then
		return nil
	end
	local def = Config.UNITS[kind]
	if not def.air then
		local lx, ly = Path.nearestLand(x + self.rng:NextNumber() * 2 - 1, y + self.rng:NextNumber(), 4)
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
		local r = 2.5 + self.rng:NextNumber() * 1.5
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
		u.n.army[u.kind] = math.max(0, (u.n.army[u.kind] or 1) - 1)
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

-- stops a unit where it is now
function Match:halt(u)
	local t = now()
	local x, y = Motion.position(u, t)
	u.path = { x, y }
	u.t0 = t
	self:send({ t = "unit", u = unitInfo(u) })
end

-- sends several units to (tx, ty); they spread out around it and share the first route
function Match:orderGroup(list, tx: number, ty: number)
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

-- a player's order for several of their units: kind is move, amove (attack-move), attack, stop
-- or hold; for attack, targetRef is a unit id, or minus a building id
function Match:command(player: Player, ids, kind: string, tx: number, ty: number, targetRef: number?)
	local n = self.humans[player]
	if not n or self.phase ~= "game" or not n.alive or not Orders.KINDS[kind] then
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
	local target = nil
	if kind == "attack" then
		if targetRef and targetRef > 0 then
			target = self.units[targetRef]
		elseif targetRef and targetRef < 0 then
			target = self.buildings[-targetRef]
		end
		if not target or target.n == n or not Orders.alive(self, target) then
			kind = "move"
			target = nil
		end
	end
	Orders.give(self, list, kind, tx, ty, target)
end

---------------------------------------------------------------- bots

local BOT_PLAN = { "extractor", "barracks", "extractor", "tankf", "extractor", "tower", "air", "extractor", "tower", "aa", "fabricator", "tankf", "extractor", "tower" }

-- a spot for a building near the bot's base, or nil
function Match:botSpot(n, kind: string)
	local def = Config.BUILD[kind]
	if def.onPool then
		local best, bd = nil, math.huge
		for _, p in Map.pools do
			if self:areaFree(p.x, p.y, 2) and self:nearBase(n, p.x + 1, p.y + 1) then
				local d = (p.x + 1 - n.cc.px) ^ 2 + (p.y + 1 - n.cc.py) ^ 2
				if d < bd then
					best, bd = p, d
				end
			end
		end
		return if best then best.x + 1 else nil, if best then best.y + 1 else nil
	end
	for _ = 1, 30 do
		local a = self.rng:NextNumber() * math.pi * 2
		local r = 3 + self.rng:NextNumber() * (Config.BUILD_RADIUS - 4)
		local x, y = n.cc.px + math.cos(a) * r, n.cc.py + math.sin(a) * r
		local bx, by = self:placeFor(n, kind, x, y)
		if bx and by then
			return x, y
		end
	end
	return nil, nil
end

-- enemies near a point: the closest enemy unit or building within radius
function Match:enemyNear(n, x: number, y: number, radius: number)
	local best, bd = nil, radius * radius
	for _, u in self.units do
		if u.n ~= n then
			local d = (u.px - x) ^ 2 + (u.py - y) ^ 2
			if d < bd then
				best, bd = u, d
			end
		end
	end
	for _, b in self.buildings do
		if b.n ~= n then
			local d = (b.px - x) ^ 2 + (b.py - y) ^ 2
			if d < bd then
				best, bd = b, d
			end
		end
	end
	return best
end

function Match:botThink(n, dt: number)
	local bot = n.bot
	-- build the next thing on the plan when there is money for it
	local kind = BOT_PLAN[(bot.step - 1) % #BOT_PLAN + 1]
	local def = Config.BUILD[kind]
	if n.money >= def.cost + 60 then
		local x, y = self:botSpot(n, kind)
		local bx, by
		if x and y then
			bx, by = self:placeFor(n, kind, x, y)
		end
		if bx and by then
			n.money -= def.cost
			self:addBuilding(n, kind, bx, by, false)
		end
		bot.step += 1
	end
	-- factories keep producing while there is money left over for building
	for _, b in self.buildings do
		local bd = Config.BUILD[b.kind]
		if b.n == n and bd.units then
			if n.money > 350 then
				b.auto = b.auto or bd.units[self.rng:NextInteger(1, #bd.units)]
			elseif not b.autoPaid then
				b.auto = nil
			end
		end
	end
	-- defend the base, then attack in waves
	local threat = self:enemyNear(n, n.cc.px, n.cc.py, Config.BUILD_RADIUS + 4)
	local idle = {}
	local t = now()
	for _, u in self.units do
		if u.n == n and not u.order then
			local _, _, arrived = Motion.position(u, t)
			if arrived and t - u.orderedAt > 3 then
				table.insert(idle, u)
			end
		end
	end
	if threat and #idle > 0 then
		Orders.give(self, idle, "amove", threat.px, threat.py)
		return
	end
	bot.wave -= dt
	if bot.wave <= 0 and #idle >= 6 then
		bot.wave = 60 + self.rng:NextNumber() * 40
		local target, bd = nil, math.huge
		for _, e in self.seats do
			if e ~= n and e.alive and e.cc then
				local d = (e.cc.px - n.cc.px) ^ 2 + (e.cc.py - n.cc.py) ^ 2
				if d < bd then
					target, bd = e, d
				end
			end
		end
		if target then
			local goal = self:enemyNear(n, target.cc.px, target.cc.py, 30) or target.cc
			Orders.give(self, idle, "amove", goal.px, goal.py)
		end
	end
end

---------------------------------------------------------------- combat

-- the closest enemy of owner within range of (sx, sy), on the grid of the last combat tick;
-- ground / air: which kinds of targets count
function Match:findTarget(sx: number, sy: number, range: number, owner, ground: boolean, air: boolean)
	local grid = self.grid
	local best, bestD = nil, range * range
	local c0x = math.clamp(math.floor((sx - range - 2) / CELL), 0, COLS - 1)
	local c1x = math.clamp(math.floor((sx + range + 2) / CELL), 0, COLS - 1)
	local c0y = math.clamp(math.floor((sy - range - 2) / CELL), 0, ROWS - 1)
	local c1y = math.clamp(math.floor((sy + range + 2) / CELL), 0, ROWS - 1)
	for cy = c0y, c1y do
		for cx = c0x, c1x do
			local cell = grid[cy * COLS + cx]
			if cell then
				for _, o in cell do
					if o.n ~= owner and o.hp > 0 and ((o.air and air) or (not o.air and ground)) then
						-- buildings are big: measure to their edge
						local reach = if o.isBuilding then o.size * 0.5 else 0
						local d = math.max(0, math.sqrt((o.px - sx) ^ 2 + (o.py - sy) ^ 2) - reach) ^ 2
						if d <= bestD then
							bestD = d
							best = o
						end
					end
				end
			end
		end
	end
	return best
end

-- tells a player that their base is under attack, at most every 25 seconds
function Match:alert(n, x: number, y: number, t: number)
	if n.isHuman and n.player and t - (n.alertAt or -100) > 25 then
		n.alertAt = t
		self:sendTo(n.player, { t = "alert", x = x, y = y })
	end
end

function Match:tickCombat(dt: number)
	local t = now()
	local grid = {}
	self.grid = grid
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

	local function fire(attacker, kind: string, dps: number, range: number, hitsAir: number, groundToo: boolean, vsBuildings: number)
		local target = attacker.target
		if target then
			local gone = target.hp <= 0 or (if target.isBuilding then not self.buildings[target.id] else not self.units[target.id])
			local reach = if target.isBuilding then target.size * 0.5 else 0
			if gone or math.sqrt((target.px - attacker.px) ^ 2 + (target.py - attacker.py) ^ 2) - reach > range then
				target = nil
			end
		end
		if not target then
			target = self:findTarget(attacker.px, attacker.py, range, attacker.n, groundToo, hitsAir > 0)
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
			self:alert(target.n, target.px, target.py, t)
		else
			self.hpDirty[target] = true
		end
		if t - (attacker.shotAt or 0) > 0.7 and #self.shots < 240 then
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
end

---------------------------------------------------------------- economy

function Match:tickEconomy(dt: number)
	for _, n in self.seats do
		n.income = if n.alive and n.cc then Config.BASE_INCOME else 0
	end
	for _, b in self.buildings do
		local n = b.n
		local def = Config.BUILD[b.kind]
		if b.built < 1 then
			b.built = math.min(1, b.built + dt / def.time)
			if b.built >= 1 then
				self:send({ t = "bdone", id = b.id })
				self:toast(n, "Достроено: " .. def.name)
			end
			continue
		end
		if def.income then
			n.income += def.income
		end
		if not def.units then
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
					self:spawnUnit(n, current, b.px, b.py + b.size / 2 + 0.8, b.rally)
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
	for _, n in self.seats do
		if n.alive then
			n.money += n.income * dt
		end
	end
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
			units = n.unitTotal,
			list = list,
		})
	end
end

-- strength of a base: what its buildings and units are worth
function Match:score(n): number
	if not n.alive then
		return 0
	end
	local s = 0
	for _, b in self.buildings do
		if b.n == n then
			s += (Config.BUILD[b.kind].cost or 1000) * b.built
		end
	end
	for _, u in self.units do
		if u.n == n then
			s += Config.UNITS[u.kind].cost
		end
	end
	return s
end

function Match:statsArray()
	local s = {}
	for _, n in self.seats do
		table.insert(s, n.id)
		table.insert(s, math.round(self:score(n)))
	end
	return s
end

---------------------------------------------------------------- end of the match

function Match:endMatch(winner, reason: string)
	self.phase = "ended"
	self.timer = Config.RESULT_SECONDS
	local ranking = {}
	local total = 0
	for _, n in self.seats do
		local s = self:score(n)
		total += s
		table.insert(ranking, { n = n, s = s })
	end
	table.sort(ranking, function(a, b)
		return a.s > b.s
	end)
	local top = {}
	for _, r in ranking do
		if r.n.alive then
			table.insert(top, { id = r.n.id, name = r.n.name, share = r.s / math.max(total, 1) })
		end
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
	local alive, last = 0, nil
	for _, n in self.seats do
		if n.alive then
			alive += 1
			last = n
		end
	end
	if alive <= 1 then
		self:endMatch(last, "conquest")
		return
	end
	if self.timer <= 0 then
		local best, bs = nil, -1
		for _, n in self.seats do
			local s = self:score(n)
			if n.alive and s > bs then
				best, bs = n, s
			end
		end
		self:endMatch(best, "time")
		return
	end
	local humansAlive = false
	for _, n in self.humans do
		if n.alive then
			humansAlive = true
			break
		end
	end
	if self:humanCount() > 0 and not humansAlive then
		self:endMatch(nil, "defeat")
	end
end

---------------------------------------------------------------- the loop

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
	if #self.outbox > 0 then
		self.event:FireAllClients("batch", self.outbox)
		self.outbox = {}
	end
end

function Match:step(dt: number)
	if self.phase == "game" then
		self.timer -= dt
		self.joinTimer -= dt
		self.tickAcc += dt
		local steps = 0
		while self.tickAcc >= Config.TICK and steps < 3 do
			self.tickAcc -= Config.TICK
			steps += 1
			self:tickEconomy(Config.TICK)
			self:tickCombat(Config.TICK)
		end
		if steps >= 3 then
			self.tickAcc = 0
		end
		self.orderAcc += dt
		if self.orderAcc >= 0.25 then
			self.orderAcc = 0
			Orders.step(self, now())
		end
		self.botAcc += dt
		if self.botAcc >= 1 then
			for _, n in self.seats do
				if n.alive and not n.isHuman and n.cc then
					self:botThink(n, self.botAcc)
				end
			end
			self.botAcc = 0
		end
		self.secAcc += dt
		if self.secAcc >= 1 then
			self.secAcc = 0
			self:checkEnd()
			self:send({ t = "stats", s = self:statsArray(), phase = self.phase, timer = self.timer })
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
	self.netAcc += dt
	if self.netAcc >= Config.NET_RATE then
		self.netAcc = 0
		self:flush()
	end
end

return Match
