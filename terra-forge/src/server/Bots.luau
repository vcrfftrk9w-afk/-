-- The bots that play the bases no player has taken: they build by a fixed plan, keep their
-- factories busy, defend their base, send small groups to take strategic points and attack the
-- nearest enemy in waves. These are methods of Match (Match.luau adds them); self is the match.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Motion = require(Shared.Motion)
local Orders = require(script.Parent.Orders)

local Bots = {}

-- power plants keep up with the energy the rest of the plan uses
local BOT_PLAN = { "extractor", "barracks", "extractor", "tankf", "power", "extractor", "tower", "air", "power", "lab", "extractor", "tower", "aa", "power", "fabricator", "tankf", "power", "extractor", "tower" }

local function now(): number
	return workspace:GetServerTimeNow()
end

-- a bot's state for a new match
function Bots:newBot()
	-- the first wave waits 3.5-4.5 minutes, so a new player has time to set up a defence
	return { think = self.rng:NextNumber() * 2, wave = 210 + self.rng:NextNumber() * 60, step = 1 }
end

-- a spot for a building near the bot's base, or nil
function Bots:botSpot(n, kind: string)
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
function Bots:enemyNear(n, x: number, y: number, radius: number)
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

function Bots:botThink(n, dt: number)
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
	-- factories keep producing fighting units while there is metal left over for building
	for _, b in self.buildings do
		local bd = Config.BUILD[b.kind]
		if b.n == n and bd.units then
			if n.money > 350 then
				if not b.auto then
					local fighters = {}
					for _, kind in bd.units do
						local ud = Config.UNITS[kind]
						if ud.dps > 0 and (not ud.needs or n.tech[ud.needs]) then
							table.insert(fighters, kind)
						end
					end
					b.auto = fighters[self.rng:NextInteger(1, #fighters)]
				end
			elseif not b.autoPaid then
				b.auto = nil
			end
		end
	end
	-- a finished research centre studies the next technology when there is metal to spare
	for _, b in self.buildings do
		if b.n == n and Config.BUILD[b.kind].research and b.built >= 1 and not b.research then
			for _, id in Config.TECH_ORDER do
				if n.money >= Config.TECH[id].cost + 400 and not self:researchBlock(n, id) then
					self:beginResearch(n, b, id)
					break
				end
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
	-- now and then a few idle ground units go to take the nearest strategic point that is not theirs
	if t >= (bot.pointAt or 0) then
		local best, bd = nil, math.huge
		for _, p in self.points do
			if p.owner ~= n then
				local d = (p.x - n.cc.px) ^ 2 + (p.y - n.cc.py) ^ 2
				if d < bd then
					best, bd = p, d
				end
			end
		end
		local group = {}
		for _, u in idle do
			if not u.air and #group < 4 then
				table.insert(group, u)
			end
		end
		if best and #group >= 2 then
			for _, u in group do
				table.remove(idle, table.find(idle, u))
			end
			Orders.give(self, group, "amove", best.x, best.y)
			bot.pointAt = t + 25
		end
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

return Bots
