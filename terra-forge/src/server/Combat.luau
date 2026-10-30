-- Combat in a skirmish: every unit and armed building shoots the nearest enemy in range, found
-- on a coarse grid, and splash weapons hurt what stands next to the target; the dead are
-- removed, and players hear when their base is hit. These are methods of Match (Match.luau
-- adds them); self is the match.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Motion = require(Shared.Motion)

local CELL = 8 -- spatial grid cell size for finding targets, in tiles
local COLS = math.ceil(Map.W / CELL)
local ROWS = math.ceil(Map.H / CELL)
local SPLASH_SHARE = 0.5 -- what the others near the target take of a splash weapon's hit

local Combat = {}

local function now(): number
	return workspace:GetServerTimeNow()
end

-- the closest enemy of owner within range of (sx, sy), on the grid of the last combat tick;
-- ground / air: which kinds of targets count
function Combat:findTarget(sx: number, sy: number, range: number, owner, ground: boolean, air: boolean)
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
function Combat:alert(n, x: number, y: number, t: number)
	if n.isHuman and n.player and t - (n.alertAt or -100) > 25 then
		n.alertAt = t
		self:sendTo(n.player, { t = "alert", x = x, y = y })
	end
end

function Combat:tickCombat(dt: number)
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

	-- rockets and bombs also hurt the enemies on the ground around the target
	local function splashAround(attacker, target, base: number, radius: number, vsBuildings: number)
		local c0x = math.clamp(math.floor((target.px - radius - 2) / CELL), 0, COLS - 1)
		local c1x = math.clamp(math.floor((target.px + radius + 2) / CELL), 0, COLS - 1)
		local c0y = math.clamp(math.floor((target.py - radius - 2) / CELL), 0, ROWS - 1)
		local c1y = math.clamp(math.floor((target.py + radius + 2) / CELL), 0, ROWS - 1)
		for cy = c0y, c1y do
			for cx = c0x, c1x do
				for _, o in grid[cy * COLS + cx] or {} do
					if o ~= target and o.n ~= attacker.n and o.hp > 0 and not o.air then
						local edge = if o.isBuilding then o.size * 0.5 else 0
						if math.sqrt((o.px - target.px) ^ 2 + (o.py - target.py) ^ 2) - edge <= radius then
							if o.isBuilding then
								o.hp -= base * vsBuildings
								self.bhpDirty[o] = true
								self:alert(o.n, o.px, o.py, t)
							else
								o.hp -= base * (1 - o.n.armor)
								self.hpDirty[o] = true
							end
						end
					end
				end
			end
		end
	end

	local function fire(attacker, kind: string, dps: number, range: number, hitsAir: number, groundToo: boolean, vsBuildings: number, splash: number?)
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
		-- research: the attacker's weapons hit harder, the target unit's armor takes some off
		-- the attacker's commander: towers, aircraft or ground units hit harder
		local c = attacker.n.commander
		local cmd = if attacker.isBuilding then Config.commander(c, "towerDamage")
			elseif attacker.air then Config.commander(c, "airDamage")
			else Config.commander(c, "groundDamage")
		local hit = dps * dt * mult * (1 + attacker.n.damage) * (1 + cmd)
		if not target.isBuilding then
			hit *= 1 - target.n.armor
		end
		target.hp -= hit
		if target.isBuilding then
			self.bhpDirty[target] = true
			self:alert(target.n, target.px, target.py, t)
		else
			self.hpDirty[target] = true
		end
		if splash and not target.air then
			splashAround(attacker, target, dps * dt * (1 + attacker.n.damage) * (1 + cmd) * SPLASH_SHARE, splash, vsBuildings)
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
		if def.dps > 0 then
			fire(u, u.kind, def.dps, def.range, def.hitsAir, def.hitsGround ~= false, def.vsBuildings or 1, def.splash)
		end
	end
	for _, b in self.buildings do
		local def = Config.BUILD[b.kind]
		if def.dps and b.n.alive and b.built >= 1 then
			-- towers short of energy fire slower; the command centre has its own
			local dps = if def.energy and def.energy < 0 then def.dps * b.n.supply else def.dps
			fire(b, b.kind, dps, def.range, def.hitsAir, not def.airOnly, 1)
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

return Combat
