-- One match: spawn phase, war, results. Runs nations, bots, economy, buildings and units,
-- and sends everything clients need through one RemoteEvent as batches of small messages.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Codec = require(Shared.Codec)
local World = require(script.Parent.World)

local W = Map.W

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

local function newFlow()
	return { pop = 0, iron = 0, coal = 0, oil = 0, steel = 0 }
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
	return { id = b.id, kind = b.kind, owner = b.n.id, x = b.x, y = b.y }
end

local function unitInfo(u)
	if u.kind == "plane" then
		return { id = u.id, kind = u.kind, owner = u.n.id, cx = u.cx, cy = u.cy, r = u.r, a0 = u.a0, w = u.w, t0 = u.t0 }
	end
	return { id = u.id, kind = u.kind, owner = u.n.id, x0 = u.x0, y0 = u.y0, tx = u.tx, ty = u.ty, speed = u.speed, t0 = u.t0 }
end

-- attack strength from the army: soldiers, tanks and planes each add a little
local function power(n): number
	local a = n.army
	return math.min(3, 1 + a.infantry * Config.UNITS.infantry.power + a.tank * Config.UNITS.tank.power + a.plane * Config.UNITS.plane.power)
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
		army = { infantry = 0, tank = 0, plane = 0 },
		botUnits = 0,
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
	n.res = table.clone(Config.START_RES)
	n.flow = newFlow()
	n.rates = newFlow()
	n.energy = { supply = 0, need = 0 }
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

local function canAfford(n, cost): boolean
	for k, v in cost do
		local have = if k == "pop" then n.troops else n.res[k]
		if have < v then
			return false
		end
	end
	return true
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
	if not canAfford(n, def.cost) then
		local missing = {}
		for _, k in Config.RES_ORDER do
			local need = def.cost[k]
			if need and n.res[k] and n.res[k] < need then
				table.insert(missing, math.ceil(need - n.res[k]) .. " " .. Config.RES_OF[k])
			end
		end
		self:toast(n, "Не хватает: " .. table.concat(missing, ", "), true)
		return
	end
	if not self:addBuilding(n, kind, x, y) then
		self:toast(n, "Тут тесно. Отступи на клетку от других построек.", true)
		return
	end
	for k, v in def.cost do
		n.res[k] -= v
	end
	local dep = Map.deposit(t)
	local extra = ""
	if kind == "mine" then
		extra = if dep == 1 then ": на руде, железо ×3" elseif dep == 2 then ": на угле, уголь ×3" else ""
	elseif kind == "rig" then
		extra = if dep == 3 then ": на нефти, ×5" else " (нефти тут мало, ищи чёрные пятна)"
	end
	if def.power > 0 and n.energy.supply < n.energy.need + def.power then
		extra ..= ". Нужна энергия: поставь электростанцию"
	end
	self:toast(n, "Построено: " .. def.name .. extra)
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
	self.nextBuildingId += 1
	local b = { id = self.nextBuildingId, kind = kind, n = n, t = t, x = x, y = y, prog = if n.isHuman then 0.6 else self.rng:NextNumber() * 0.5, on = true, blocked = false }
	self.buildings[b.id] = b
	self:send({ t = "building", b = buildingInfo(b) })
	return true
end

function Match:removeBuilding(b)
	self.buildings[b.id] = nil
	self:send({ t = "bgone", id = b.id })
end

function Match:spawnUnit(n, kind: string, x: number, y: number)
	if self.unitCount >= Config.MAX_UNITS or not n.cap then
		return
	end
	self.nextUnitId += 1
	self.unitCount += 1
	local u = { id = self.nextUnitId, kind = kind, n = n, t0 = now() }
	if kind == "plane" then
		u.cx = n.cap.x + 0.5
		u.cy = n.cap.y + 0.5
		u.r = 7 + self.rng:NextNumber() * 6
		u.a0 = self.rng:NextNumber() * math.pi * 2
		u.w = (if self.rng:NextNumber() < 0.5 then 1 else -1) * 0.42 * 10 / u.r
	else
		u.x0, u.y0, u.tx, u.ty = x, y, x, y
		u.speed = Config.UNITS[kind].speed
		u.arrive = u.t0
		u.waitUntil = u.t0
	end
	n.army[kind] += 1
	self.units[u.id] = u
	self:send({ t = "unit", u = unitInfo(u) })
end

function Match:removeUnit(u)
	if self.units[u.id] then
		self.units[u.id] = nil
		self.unitCount -= 1
		u.n.army[u.kind] = math.max(0, u.n.army[u.kind] - 1)
		self:send({ t = "ugone", id = u.id })
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
	local kinds = { "mine", "mill", "barracks", "tankf", "rig", "power" }
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
				self:spawnUnit(n, "plane", n.cap.x + 0.5, n.cap.y + 0.5)
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
		local cap = 1400 + n.count * 22
		local grown = math.max(0, cap - n.troops) * 0.006 + (if n.isHuman then 2.2 else 1.6)
		n.troops += grown
		if n.flow then
			n.flow.pop += grown
		end
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
	self:tickUnits()
end

function Match:tickEconomy(dt: number)
	local world = self.world
	for _, n in self.humans do
		local supply, need = 0, 0
		for _, b in self.buildings do
			if b.n == n then
				if b.kind == "power" then
					if n.res.coal > 0.05 then
						supply += 12
						n.res.coal -= 0.5 * dt
						n.flow.coal -= 0.5 * dt
						b.on = true
					else
						b.on = false
					end
				else
					need += Config.BUILD[b.kind].power
				end
			end
		end
		n.energy.supply = supply
		n.energy.need = need
		n.eff = if need > 0 then math.min(1, supply / need) else 1
	end
	for _, b in self.buildings do
		local n = b.n
		if world:ownerOf(b.t) ~= n.id then
			self:removeBuilding(b)
			continue
		end
		local def = Config.BUILD[b.kind]
		if not n.isHuman then
			if def.unit then
				b.prog += dt / 40
				if b.prog >= 1 then
					b.prog = 0
					if n.alive and n.botUnits < 3 then
						n.botUnits += 1
						self:spawnUnit(n, def.unit, b.x + 0.5, b.y + 0.5)
					end
				end
			end
			continue
		end
		local res, flow, eff = n.res, n.flow, n.eff or 1
		local function gain(k, v)
			res[k] += v
			flow[k] += v
		end
		local dep = Map.deposit(b.t)
		if b.kind == "mine" then
			if dep == 1 then
				gain("iron", 4.5 * dt)
			elseif dep == 2 then
				gain("coal", 4.5 * dt)
			else
				gain("iron", 1.5 * dt)
				gain("coal", 0.6 * dt)
			end
		elseif b.kind == "rig" then
			gain("oil", (if dep == 3 then 3 else 0.6) * dt)
		elseif b.kind == "mill" then
			local k = dt * eff
			if k > 0 and res.iron >= 2 * k and res.coal >= k then
				gain("iron", -2 * k)
				gain("coal", -k)
				gain("steel", k)
				b.on = true
			else
				b.on = false
			end
		elseif def.unit then
			b.on = eff > 0
			b.prog = math.min(1, b.prog + dt * eff / def.every)
			if b.prog >= 1 then
				if canAfford(n, def.ucost) then
					for k, v in def.ucost do
						if k == "pop" then
							n.troops -= v
							flow.pop -= v
						else
							gain(k, -v)
						end
					end
					self:spawnUnit(n, def.unit, b.x + 0.5, b.y + 0.5)
					b.prog = 0
					b.blocked = false
				else
					b.blocked = true
				end
			end
		end
	end
end

function Match:tickUnits()
	local t = now()
	local world = self.world
	for _, u in self.units do
		if not u.n.alive then
			self:removeUnit(u)
			continue
		end
		if u.kind == "plane" or t < u.waitUntil then
			continue
		end
		local a = u.n.attack
		local f = if a then world:pickFront(u.n, a.tx, a.ty, 10) else world:pickFront(u.n, u.tx, u.ty, 6)
		if f < 0 then
			u.waitUntil = t + 5
			continue
		end
		local tx, ty = f % W + 0.5, f // W + 0.5
		local dx, dy = tx - u.tx, ty - u.ty
		local d = math.sqrt(dx * dx + dy * dy)
		if d > 40 then
			tx = u.tx + dx / d * 40
			ty = u.ty + dy / d * 40
			d = 40
		end
		u.x0, u.y0 = u.tx, u.ty
		u.tx, u.ty = tx, ty
		u.t0 = t
		u.arrive = t + d / u.speed
		u.waitUntil = u.arrive + 3 + self.rng:NextNumber() * 6
		self:send({ t = "unit", u = unitInfo(u) })
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
		local prog = {}
		for _, b in self.buildings do
			if b.n == n then
				table.insert(prog, b.id)
				table.insert(prog, if b.blocked then -b.prog else b.prog)
				table.insert(prog, if b.on then 1 else 0)
			end
		end
		self:sendTo(player, {
			t = "eco",
			res = n.res,
			rates = n.rates,
			supply = n.energy.supply,
			need = n.energy.need,
			prog = prog,
			army = n.army,
		})
	end
end

function Match:flush()
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
			for _, n in self.humans do
				n.rates = n.flow
				n.flow = newFlow()
			end
			self:checkEnd()
		end
		self.botUnitAcc += dt
		if self.botUnitAcc > 25 then
			self.botUnitAcc = 0
			local candidates = {}
			for _, n in self.world.nations do
				if n.alive and not n.isHuman and n.count > 200 and n.botUnits < 3 then
					table.insert(candidates, n)
				end
			end
			if #candidates > 0 then
				local n = candidates[self.rng:NextInteger(1, #candidates)]
				n.botUnits += 1
				self:spawnUnit(n, if self.rng:NextNumber() < 0.7 then "tank" else "infantry", n.cap.x + 0.5, n.cap.y + 0.5)
			end
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
