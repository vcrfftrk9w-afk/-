-- The economy of a skirmish: metal income, energy, construction, factory queues and production,
-- research, repairs, and what each base is worth. These are methods of Match (Match.luau adds
-- them); self is the match. Metal is kept in n.money, finished research in n.tech.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)

local Economy = {}

function Economy:lackText(n, cost: number): string
	return "Не хватает металла: нужно ещё " .. math.ceil(cost - n.money)
end

---------------------------------------------------------------- factories

-- a player's own factory, or nil
function Economy:factoryOf(player: Player, id: number)
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

-- some units can only be ordered after research; tells the player which
function Economy:unitLocked(n, kind: string): boolean
	local needs = Config.UNITS[kind].needs
	if needs and not n.tech[needs] then
		self:toast(n, "Сначала изучи в исследовательском центре: " .. Config.TECH[needs].name, true)
		return true
	end
	return false
end

-- orders one unit from a factory; it is paid now and refunded if cancelled
function Economy:queueUnit(player: Player, id: number, kind: string)
	local n, b = self:factoryOf(player, id)
	if not n or not makes(b, kind) or self:unitLocked(n, kind) then
		return
	end
	local cost = Config.UNITS[kind].cost
	if #b.queue >= Config.MAX_QUEUE then
		self:toast(n, "Очередь полная: не больше " .. Config.MAX_QUEUE .. " юнитов.", true)
		return
	end
	if n.money < cost then
		self:toast(n, self:lackText(n, cost), true)
		return
	end
	n.money -= cost
	table.insert(b.queue, kind)
	if b.built < 1 then
		self:toast(n, "Заказ принят. Начнётся, когда достроят: " .. Config.BUILD[b.kind].name)
	end
	self:sendEconomy()
end

-- removes the last ordered unit and returns its metal
function Economy:cancelUnit(player: Player, id: number)
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
function Economy:setAuto(player: Player, id: number, kind: string)
	local n, b = self:factoryOf(player, id)
	if not n or (kind ~= "" and (not makes(b, kind) or self:unitLocked(n, kind))) then
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
function Economy:setRally(player: Player, id: number, x: number, y: number)
	local n, b = self:factoryOf(player, id)
	if not n or not Map.inBounds(math.floor(x), math.floor(y)) then
		return
	end
	b.rally = { x = math.floor(x) + 0.5, y = math.floor(y) + 0.5 }
	self:toast(n, "Точка сбора поставлена: новые юниты поедут туда.")
end

---------------------------------------------------------------- research

-- a player's own research centre, or nil
function Economy:labOf(player: Player, id: number)
	local n = self.humans[player]
	local b = self.buildings[id]
	if not n or not b or b.n ~= n or self.phase ~= "game" or not Config.BUILD[b.kind].research then
		return nil, nil
	end
	return n, b
end

-- why a base cannot start this study now, or nil
function Economy:researchBlock(n, id: string): string?
	local t = Config.TECH[id]
	if n.tech[id] then
		return "Уже изучено: " .. t.name
	end
	if t.needs and not n.tech[t.needs] then
		return "Сначала изучи: " .. Config.TECH[t.needs].name
	end
	for _, b in self.buildings do
		if b.n == n and b.research == id then
			return "Уже изучается: " .. t.name
		end
	end
	if n.money < t.cost then
		return self:lackText(n, t.cost)
	end
	return nil
end

function Economy:beginResearch(n, b, id: string)
	n.money -= Config.TECH[id].cost
	b.research = id
	b.prog = 0
end

-- starts a study in a research centre; it is paid now and refunded if stopped
function Economy:startResearch(player: Player, labId: number, id: string)
	local n, b = self:labOf(player, labId)
	if not n then
		return
	end
	if b.built < 1 then
		self:toast(n, "Исследовательский центр ещё строится.", true)
		return
	end
	if b.research then
		self:toast(n, "Центр уже занят: " .. Config.TECH[b.research].name .. ". Дождись или останови.", true)
		return
	end
	local why = self:researchBlock(n, id)
	if why then
		self:toast(n, why, true)
		return
	end
	self:beginResearch(n, b, id)
	self:toast(n, "Изучается: " .. Config.TECH[id].name .. " (" .. Config.TECH[id].time .. " с)")
	self:sendEconomy()
end

-- stops the study and returns its metal
function Economy:stopResearch(player: Player, labId: number)
	local n, b = self:labOf(player, labId)
	if not n or not b.research then
		return
	end
	n.money += Config.TECH[b.research].cost
	b.research = nil
	b.prog = 0
	self:sendEconomy()
end

---------------------------------------------------------------- energy, income and production

-- how much energy each base makes and uses, and the share of its needs that is met (supply):
-- buildings that use energy work at that share of their speed
function Economy:tickEnergy()
	for _, n in self.seats do
		n.energy, n.energyUsed = 0, 0
	end
	for _, b in self.buildings do
		local e = Config.BUILD[b.kind].energy
		if e and b.built >= 1 then
			if e > 0 then
				b.n.energy += e
			else
				b.n.energyUsed -= e
			end
		end
	end
	for _, n in self.seats do
		n.supply = if n.energyUsed <= n.energy then 1 else math.max(Config.MIN_POWER, n.energy / n.energyUsed)
	end
end

-- the share of its normal speed a building works at: those using energy depend on the supply
local function speedOf(b): number
	local e = Config.BUILD[b.kind].energy
	return if e and e < 0 then b.n.supply else 1
end

-- own buildings under construction that engineers stand next to: building -> engineers
function Economy:engineerHelp()
	local help = {}
	for _, u in self.units do
		local def = Config.UNITS[u.kind]
		if def.repairs then
			for _, b in self.buildings do
				if b.n == u.n and b.built < 1 and math.sqrt((b.px - u.px) ^ 2 + (b.py - u.py) ^ 2) - b.size * 0.5 <= def.range then
					help[b] = (help[b] or 0) + 1
				end
			end
		end
	end
	return help
end

function Economy:tickEconomy(dt: number)
	self:tickEnergy()
	for _, n in self.seats do
		n.income = if n.alive and n.cc then Config.BASE_INCOME else 0
		-- what finished research gives: Combat reads armor and damage too
		n.armor, n.damage, n.production = Config.techBonus(n.tech)
	end
	local help = self:engineerHelp()
	for _, b in self.buildings do
		local n = b.n
		local def = Config.BUILD[b.kind]
		if b.built < 1 then
			-- each engineer next to the site adds the normal speed again, up to three times faster
			b.built = math.min(1, b.built + dt * (1 + math.min(2, help[b] or 0)) / def.time)
			if b.built >= 1 then
				self:send({ t = "bdone", id = b.id })
				self:toast(n, "Достроено: " .. def.name)
			end
			continue
		end
		if def.income then
			n.income += def.income * speedOf(b)
		end
		if b.research then
			local t = Config.TECH[b.research]
			b.prog = math.min(1, b.prog + dt * speedOf(b) / t.time)
			if b.prog >= 1 then
				n.tech[b.research] = true
				self:toast(n, "Изучено: " .. t.name .. ". " .. t.desc)
				b.research = nil
				b.prog = 0
			end
			continue
		end
		if not def.units then
			continue
		end
		-- queued units are paid when ordered; in auto mode each unit is paid when it starts
		b.blocked = nil
		local current = b.queue[1]
		if not current and b.auto then
			if not b.autoPaid then
				local cost = Config.UNITS[b.auto].cost
				if n.money >= cost then
					n.money -= cost
					b.autoPaid = b.auto
				else
					b.blocked = "metal"
				end
			end
			current = b.autoPaid
		end
		if current then
			if n.pop + Config.UNITS[current].pop > Config.ARMY_LIMIT then
				b.blocked = "army"
			else
				b.prog = math.min(1, b.prog + dt * speedOf(b) * (1 + n.production) / Config.UNITS[current].time)
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

-- repair stations mend the owner's units around them; engineers mend the most damaged own
-- building within their reach
function Economy:tickRepair(dt: number)
	for _, b in self.buildings do
		local def = Config.BUILD[b.kind]
		if def.heal and b.built >= 1 then
			local r2 = def.healRange * def.healRange
			local amount = def.heal * speedOf(b) * dt
			for _, u in self.units do
				if u.n == b.n and u.hp < u.maxHp and (u.px - b.px) ^ 2 + (u.py - b.py) ^ 2 <= r2 then
					u.hp = math.min(u.maxHp, u.hp + amount)
					self.hpDirty[u] = true
				end
			end
		end
	end
	for _, u in self.units do
		local def = Config.UNITS[u.kind]
		if def.repairs then
			local best, worst = nil, 1
			for _, b in self.buildings do
				if b.n == u.n and b.built >= 1 and b.hp < b.maxHp and b.hp / b.maxHp < worst then
					if math.sqrt((b.px - u.px) ^ 2 + (b.py - u.py) ^ 2) - b.size * 0.5 <= def.range then
						best, worst = b, b.hp / b.maxHp
					end
				end
			end
			if best then
				best.hp = math.min(best.maxHp, best.hp + def.repairs * dt)
				self.bhpDirty[best] = true
			end
		end
	end
end

function Economy:sendEconomy()
	for player, n in self.humans do
		local list = {}
		for _, b in self.buildings do
			if b.n == n then
				table.insert(list, {
					id = b.id,
					p = if b.blocked then -math.max(b.prog, 0.001) else b.prog,
					w = b.blocked, -- what a stopped factory waits for: "metal" or "army"
					r = b.research, -- what a research centre studies
					built = b.built,
					q = b.queue,
					auto = b.auto or "",
				})
			end
		end
		local tech = {}
		for id in n.tech do
			table.insert(tech, id)
		end
		self:sendTo(player, {
			t = "eco",
			money = math.floor(n.money),
			income = n.income,
			energy = n.energy,
			energyUsed = n.energyUsed,
			army = n.army,
			pop = n.pop,
			units = n.unitTotal,
			tech = tech,
			list = list,
		})
	end
end

---------------------------------------------------------------- strength

-- strength of a base: what its buildings and units are worth
function Economy:score(n): number
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
			for _, c in u.cargo or {} do
				s += Config.UNITS[c.kind].cost
			end
		end
	end
	return s
end

function Economy:statsArray()
	local s = {}
	for _, n in self.seats do
		table.insert(s, n.id)
		table.insert(s, math.round(self:score(n)))
	end
	return s
end

return Economy
