-- One skirmish: four bases on the map, each run by a player or a bot. Holds the bases,
-- buildings and units, places buildings, moves units, ends the match and sends clients
-- everything as batches of small messages through one RemoteEvent. A base is lost with its
-- command centre. The economy, combat and bots are methods of Match too, kept in their own
-- modules: Economy, Combat and Bots.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Motion = require(Shared.Motion)
local Orders = require(script.Parent.Orders)
local Path = require(script.Parent.Path)

local W = Map.W

local Match = {}
Match.__index = Match

for _, part in { require(script.Parent.Economy), require(script.Parent.Combat), require(script.Parent.Bots) } do
	for name, method in part do
		Match[name] = method
	end
end

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
			energy = 0,
			energyUsed = 0,
			supply = 1,
			army = {},
			unitTotal = 0,
			pop = 0,
			tech = {}, -- finished research: id -> true
			armor = 0,
			damage = 0,
			production = 0,
			bot = self:newBot(),
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
		self:toast(n, self:lackText(n, def.cost), true)
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

---------------------------------------------------------------- units

-- creates a unit next to (x, y); returns the unit, or nil when the army limit or the server's
-- unit limit is reached
function Match:spawnUnit(n, kind: string, x: number, y: number, rally)
	local def = Config.UNITS[kind]
	if self.unitCount >= Config.MAX_UNITS or n.pop + def.pop > Config.ARMY_LIMIT then
		return nil
	end
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
	n.pop += def.pop
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
		u.n.pop = math.max(0, u.n.pop - Config.UNITS[u.kind].pop)
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
			self:tickRepair(Config.TICK)
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
