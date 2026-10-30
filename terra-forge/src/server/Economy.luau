-- The economy of a skirmish: income, construction, factory queues and production, and what
-- each base is worth. These are methods of Match (Match.luau adds them); self is the match.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)

local Economy = {}

function Economy:lackText(n, cost: number): string
	return "Не хватает денег: нужно ещё " .. math.ceil(cost - n.money) .. " $"
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

-- orders one unit from a factory; it is paid now and refunded if cancelled
function Economy:queueUnit(player: Player, id: number, kind: string)
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

-- removes the last ordered unit and returns its money
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
function Economy:setRally(player: Player, id: number, x: number, y: number)
	local n, b = self:factoryOf(player, id)
	if not n or not Map.inBounds(math.floor(x), math.floor(y)) then
		return
	end
	b.rally = { x = math.floor(x) + 0.5, y = math.floor(y) + 0.5 }
	self:toast(n, "Точка сбора поставлена: новые юниты поедут туда.")
end

---------------------------------------------------------------- income and production

function Economy:tickEconomy(dt: number)
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

function Economy:sendEconomy()
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
