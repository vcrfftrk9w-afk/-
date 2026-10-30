-- Strategic points: neutral spots on the map that ground units capture by standing on them with
-- no enemy around. A point gives its owner metal, vision and a place to build, but only while it
-- is supplied: linked to the command centre through own points no further apart than
-- Config.SUPPLY_RANGE, so the points a base holds form its front. These are methods of Match
-- (Match.luau adds them); self is the match.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)

local Points = {}

local FADE = 1 / 30 -- how fast an unfinished capture fades once nobody stands on the point
local OWNED = 2 / 3 -- taking a point an enemy holds goes this much slower
local WARN_GAP = 20 -- seconds between warnings that the enemy is taking a point

-- capture speed (share a second) for this many units on the point: more units, up to twice as fast
local function rate(count: number): number
	return (1 + 0.5 * math.min(count - 1, 2)) / Config.CAPTURE_TIME
end

function Points:setupPoints()
	self.points = {}
	for i, p in Config.POINTS do
		table.insert(self.points, {
			id = i,
			name = p.name,
			x = p.x,
			y = p.y,
			owner = nil, -- the base holding it
			cap = nil, -- the base taking it
			k = 0, -- how far that capture has got, 0..1
			contested = false,
			supplied = false,
			link = -1, -- what supplies it: 0 = the command centre, a point id, -1 = nothing
			warnAt = -100,
		})
	end
	self.pointsDirty = true
end

-- where the points are, for clients
function Points:pointsInfo()
	local list = {}
	for _, p in self.points do
		table.insert(list, { id = p.id, name = p.name, x = p.x, y = p.y })
	end
	return list
end

-- the state of every point, flat: id, owner (0 = none), capturer (0 = none), progress 0..100,
-- flags (1 = contested, 2 = supplied), link
function Points:pointsState()
	local s = {}
	for _, p in self.points do
		table.insert(s, p.id)
		table.insert(s, if p.owner then p.owner.id else 0)
		table.insert(s, if p.cap then p.cap.id else 0)
		table.insert(s, math.round(p.k * 100))
		table.insert(s, (if p.contested then 1 else 0) + (if p.supplied then 2 else 0))
		table.insert(s, p.link)
	end
	return s
end

-- how many points a base holds, and how many of them are supplied
function Points:pointsOf(n): (number, number)
	local held, supplied = 0, 0
	for _, p in self.points do
		if p.owner == n then
			held += 1
			if p.supplied then
				supplied += 1
			end
		end
	end
	return held, supplied
end

-- a base that falls loses its points and its captures
function Points:dropPoints(n)
	for _, p in self.points do
		if p.owner == n then
			p.owner = nil
		end
		if p.cap == n then
			p.cap, p.k = nil, 0
		end
	end
	self.pointsDirty = true
end

-- ground units standing on a point, counted by base
local function presence(self, p)
	local counts, r2 = {}, Config.POINT_RADIUS ^ 2
	for _, u in self.units do
		if not u.air and u.hp > 0 and (u.px - p.x) ^ 2 + (u.py - p.y) ^ 2 <= r2 then
			counts[u.n] = (counts[u.n] or 0) + 1
		end
	end
	return counts
end

function Points:capturePoint(p, n)
	local old = p.owner
	p.owner, p.cap, p.k = n, nil, 0
	self:toast(n, "Точка «" .. p.name .. "» захвачена. Пока она снабжается, она даёт металл и рядом можно строить.")
	if old then
		self:toast(old, "Потеряна точка «" .. p.name .. "»!", true)
	end
end

function Points:tickPoints(dt: number, t: number)
	for _, p in self.points do
		local counts = presence(self, p)
		local only, many = nil, false
		for n in counts do
			if only then
				many = true
			else
				only = n
			end
		end
		local owner, cap, k, contested = p.owner, p.cap, math.round(p.k * 100), p.contested
		p.contested = many
		if many then
			-- a fight on the point: nothing moves until one side is left
		elseif not only then
			if p.cap then
				p.k = math.max(0, p.k - FADE * dt)
				if p.k <= 0 then
					p.cap = nil
				end
			end
		elseif only == p.owner then
			-- the owner stands on it: an enemy's capture is pushed back
			if p.cap then
				p.k -= rate(counts[only]) * dt
				if p.k <= 0 then
					p.cap, p.k = nil, 0
				end
			end
		elseif p.cap and p.cap ~= only then
			-- someone else's capture is undone first
			p.k -= rate(counts[only]) * dt
			if p.k <= 0 then
				p.cap, p.k = only, 0
			end
		else
			p.cap = only
			p.k += rate(counts[only]) * (if p.owner then OWNED else 1) * dt
			if p.owner and t - p.warnAt > WARN_GAP then
				p.warnAt = t
				self:toast(p.owner, "Враг захватывает точку «" .. p.name .. "»!", true)
			end
			if p.k >= 1 then
				self:capturePoint(p, only)
			end
		end
		if owner ~= p.owner or cap ~= p.cap or k ~= math.round(p.k * 100) or contested ~= p.contested then
			self.pointsDirty = true
		end
	end
end

-- which points are supplied: from each command centre, along the base's own points, each no
-- further than SUPPLY_RANGE from the one before
function Points:tickSupply()
	local before = {}
	for _, p in self.points do
		before[p] = if p.supplied then p.link else -1
		p.supplied, p.link = false, -1
	end
	local r2 = Config.SUPPLY_RANGE ^ 2
	for _, n in self.seats do
		if n.alive and n.cc then
			local frontier = { { x = n.cc.px, y = n.cc.py, id = 0 } }
			while #frontier > 0 do
				local node = table.remove(frontier, 1)
				for _, p in self.points do
					if p.owner == n and not p.supplied and (p.x - node.x) ^ 2 + (p.y - node.y) ^ 2 <= r2 then
						p.supplied, p.link = true, node.id
						table.insert(frontier, { x = p.x, y = p.y, id = p.id })
					end
				end
			end
		end
	end
	for _, p in self.points do
		if (if p.supplied then p.link else -1) ~= before[p] then
			self.pointsDirty = true
		end
	end
end

return Points
