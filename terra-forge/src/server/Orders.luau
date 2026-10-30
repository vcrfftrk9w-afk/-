-- Unit orders beyond a plain move: attack one target (chase it into range), attack-move (go
-- somewhere and fight whatever is met on the way), hold position, get into a transport and set
-- the riders down. Orders are checked a few times a second for the units that have one; the
-- shooting itself is done by Match:tickCombat, which prefers the target an order points at.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Motion = require(Shared.Motion)
local Path = require(script.Parent.Path)

local Orders = {}

Orders.KINDS = { move = true, amove = true, attack = true, stop = true, hold = true, board = true, unload = true }

local REPATH = 1.0 -- seconds between new routes while chasing
local BOARD_REACH = 1.8 -- a rider this close to its transport (tiles) gets in

-- distance from a unit to a target, measured to the edge of buildings
local function reach(u, target): number
	local d = math.sqrt((target.px - u.px) ^ 2 + (target.py - u.py) ^ 2)
	if target.isBuilding then
		d -= target.size * 0.5
	end
	return math.max(0, d)
end

function Orders.alive(match, target): boolean
	if not target or target.hp <= 0 then
		return false
	end
	if target.isBuilding then
		return match.buildings[target.id] == target
	end
	return match.units[target.id] == target
end

-- whether a unit's weapon works against a target at all
function Orders.canHit(u, target): boolean
	local def = Config.UNITS[u.kind]
	if target.air then
		return (def.hitsAir or 0) > 0
	end
	return def.hitsGround ~= false
end

-- moves towards the target until it is in range, then stands and shoots it
local function chase(match, u, target, order, t: number)
	local def = Config.UNITS[u.kind]
	local _, _, arrived = Motion.position(u, t)
	if reach(u, target) <= def.range * 0.95 then
		u.target = target
		if not arrived then
			match:halt(u)
		end
	elseif arrived or t >= order.repathAt then
		order.repathAt = t + REPATH
		match:orderUnit(u, target.px, target.py, 6000)
	end
end

-- one round of order checks; t = server time
function Orders.step(match, t: number)
	-- riders getting in and transports setting down change the unit list: done after the loop
	local boarding, landing = {}, {}
	for _, u in match.units do
		local order = u.order
		if not order then
			continue
		end
		if order.kind == "board" then
			local tr = order.target
			if not Orders.alive(match, tr) or not tr.cargo or #tr.cargo >= Config.UNITS[tr.kind].carry then
				u.order = nil
			elseif math.sqrt((tr.px - u.px) ^ 2 + (tr.py - u.py) ^ 2) <= BOARD_REACH then
				table.insert(boarding, { u, tr })
			else
				local _, _, arrived = Motion.position(u, t)
				if arrived or t >= order.repathAt then
					order.repathAt = t + REPATH
					match:orderUnit(u, tr.px, tr.py, 6000)
				end
			end
		elseif order.kind == "unload" then
			local _, _, arrived = Motion.position(u, t)
			if arrived or (u.px - order.x) ^ 2 + (u.py - order.y) ^ 2 < 2.25 then
				table.insert(landing, u)
			end
		elseif order.kind == "attack" then
			if Orders.alive(match, order.target) then
				chase(match, u, order.target, order, t)
			else
				u.order = nil
			end
		elseif order.kind == "amove" then
			local def = Config.UNITS[u.kind]
			local sight = math.max(def.vision or 0, def.range + 2)
			local e = order.engage
			if e and (not Orders.alive(match, e) or reach(u, e) > sight + 2) then
				-- the fight is over (or the enemy got away): carry on to the goal
				order.engage = nil
				e = nil
				match:orderUnit(u, order.x, order.y, 6000)
			end
			if not e then
				e = match:findTarget(u.px, u.py, sight, u.n, def.hitsGround ~= false, (def.hitsAir or 0) > 0)
				order.engage = e
			end
			if e then
				chase(match, u, e, order, t)
			else
				local _, _, arrived = Motion.position(u, t)
				if arrived and (u.px - order.x) ^ 2 + (u.py - order.y) ^ 2 < 4 then
					u.order = nil
				end
			end
		end
	end
	for _, pair in boarding do
		match:board(pair[1], pair[2])
	end
	for _, tr in landing do
		match:unload(tr)
	end
end

-- riders get into transports: each transport (the selected ones, or the one tapped) takes as
-- many of the selected riders as fit, comes down on land in the middle of them, and they walk in
local function board(match, list, target)
	local transports, riders = {}, {}
	for _, u in list do
		local def = Config.UNITS[u.kind]
		if u.cargo then
			table.insert(transports, u)
		elseif def.boards then
			table.insert(riders, u)
		end
	end
	if target then
		transports = { target }
	end
	for _, tr in transports do
		local group = {}
		local room = Config.UNITS[tr.kind].carry - #tr.cargo
		while room > 0 and #riders > 0 do
			table.insert(group, table.remove(riders, 1))
			room -= 1
		end
		if #group > 0 then
			local cx, cy = 0, 0
			for _, r in group do
				cx += r.px
				cy += r.py
			end
			local lx, ly = Path.nearestLand(cx / #group, cy / #group, 6)
			if lx and ly then
				tr.order = nil
				match:orderUnit(tr, lx + 0.5, ly + 0.5, 6000)
				for _, r in group do
					r.order = { kind = "board", target = tr, repathAt = 0 }
					match:orderUnit(r, lx + 0.5, ly + 0.5, 6000)
				end
			end
		end
	end
end

-- gives units of one owner an order; ids already checked. target = unit or building for
-- "attack", own transport for "board"
function Orders.give(match, list, kind: string, x: number, y: number, target)
	if kind == "board" then
		board(match, list, target)
		return
	end
	if kind == "unload" then
		-- the transports with riders fly there and set them down; the others stay
		for _, u in list do
			if u.cargo and #u.cargo > 0 then
				match:orderUnit(u, x, y, 6000)
				u.order = { kind = "unload", x = x, y = y }
			end
		end
		return
	end
	if kind == "stop" or kind == "hold" then
		for _, u in list do
			match:halt(u)
			u.order = if kind == "hold" then { kind = "hold" } else nil
		end
		return
	end
	if kind == "attack" and target then
		match:orderGroup(list, target.px, target.py)
		for _, u in list do
			-- units that cannot hit this target just go there
			u.order = if Orders.canHit(u, target) then { kind = "attack", target = target, repathAt = 0 } else nil
		end
		return
	end
	match:orderGroup(list, x, y)
	for _, u in list do
		if kind == "amove" then
			-- each unit keeps its own spot of the group's goal
			local p = u.path
			u.order = { kind = "amove", x = p[#p - 1], y = p[#p], repathAt = 0 }
		else
			u.order = nil
		end
	end
end

return Orders
