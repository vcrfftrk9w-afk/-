-- Territory simulation: who owns each tile, and each nation's border ("front").
-- Every ownership change is logged in `changes` so the match can send it to clients.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Map = require(Shared.Map)
local Codec = require(Shared.Codec)

local W, H, N = Map.W, Map.H, Map.N
local readu16, writeu16 = buffer.readu16, buffer.writeu16
local readi32, writei32 = buffer.readi32, buffer.writei32
local isLand = Map.isLand
local neighbors = Map.neighbors

local World = {}
World.__index = World

function World.new(rng: Random)
	local self = setmetatable({}, World)
	self.owner = buffer.create(N * 2)
	self.fpos = buffer.create(N * 4) -- 1-based position in the owner's front list, 0 = not on the front
	self.nations = {}
	self.changes = {}
	self.rng = rng
	self.nbA = {}
	self.nbB = {}
	self.nbC = {}
	self.onCapture = nil
	return self
end

function World:ownerOf(t: number): number
	return readu16(self.owner, t * 2)
end

function World:addNation(n)
	n.count = 0
	n.sx = 0
	n.sy = 0
	n.front = {}
	self.nations[n.id] = n
end

local function addFront(self, n, t)
	local front = n.front
	front[#front + 1] = t
	writei32(self.fpos, t * 4, #front)
end

local function removeFront(self, n, t)
	local p = readi32(self.fpos, t * 4)
	local front = n.front
	local last = front[#front]
	front[#front] = nil
	if last ~= t then
		front[p] = last
		writei32(self.fpos, last * 4, p)
	end
	writei32(self.fpos, t * 4, 0)
end

function World:refresh(t: number)
	local o = readu16(self.owner, t * 2)
	if o == 0 then
		return
	end
	local nb = self.nbB
	local c = neighbors(t, nb)
	local onFront = false
	for i = 1, c do
		local v = nb[i]
		if isLand(v) and readu16(self.owner, v * 2) ~= o then
			onFront = true
			break
		end
	end
	local inList = readi32(self.fpos, t * 4) > 0
	local n = self.nations[o]
	if onFront and not inList then
		addFront(self, n, t)
	elseif not onFront and inList then
		removeFront(self, n, t)
	end
end

function World:setOwner(t: number, id: number)
	local old = readu16(self.owner, t * 2)
	if old == id then
		return
	end
	local x, y = t % W, t // W
	if old ~= 0 then
		local o = self.nations[old]
		if readi32(self.fpos, t * 4) > 0 then
			removeFront(self, o, t)
		end
		o.count -= 1
		o.sx -= x
		o.sy -= y
	end
	writeu16(self.owner, t * 2, id)
	if id ~= 0 then
		local n = self.nations[id]
		n.count += 1
		n.sx += x
		n.sy += y
	end
	table.insert(self.changes, Codec.change(t, id))
	self:refresh(t)
	local nb = self.nbA
	local c = neighbors(t, nb)
	for i = 1, c do
		self:refresh(nb[i])
	end
end

function World:claimDisc(n, x: number, y: number, r: number)
	for dy = -r, r do
		for dx = -r, r do
			if dx * dx + dy * dy <= r * r + 1 then
				local xx, yy = x + dx, y + dy
				if Map.inBounds(xx, yy) then
					local t = yy * W + xx
					if isLand(t) and readu16(self.owner, t * 2) == 0 then
						self:setOwner(t, n.id)
					end
				end
			end
		end
	end
end

function World:releaseNear(n, x: number, y: number, r: number)
	for dy = -r, r do
		for dx = -r, r do
			local xx, yy = x + dx, y + dy
			if Map.inBounds(xx, yy) then
				local t = yy * W + xx
				if readu16(self.owner, t * 2) == n.id then
					self:setOwner(t, 0)
				end
			end
		end
	end
end

-- Takes up to `claims` tiles next to n's border.
-- target: owner id to take from (0 = empty land, -1 = anyone). biased: prefer tiles near (tx, ty).
function World:grow(n, target: number, tx: number, ty: number, claims: number, biased: boolean): number
	local nb = self.nbC
	local rng = self.rng
	local done, miss = 0, 0
	while done < claims and miss < 10 do
		local front = n.front
		local nf = #front
		if nf == 0 then
			break
		end
		local best, bestScore = -1, math.huge
		local samples = if biased then 9 else 2
		for _ = 1, samples do
			local f = front[rng:NextInteger(1, nf)]
			local c = neighbors(f, nb)
			for i = 1, c do
				local v = nb[i]
				if isLand(v) then
					local o = readu16(self.owner, v * 2)
					if o ~= n.id and (target < 0 or o == target) then
						local score
						if biased then
							local dx, dy = v % W - tx, v // W - ty
							score = (dx * dx + dy * dy) * (0.72 + rng:NextNumber() * 0.56)
						else
							score = rng:NextNumber()
						end
						if score < bestScore then
							bestScore = score
							best = v
						end
					end
				end
			end
		end
		if best < 0 then
			miss += 1
		else
			local prev = readu16(self.owner, best * 2)
			self:setOwner(best, n.id)
			done += 1
			if prev ~= 0 then
				local e = self.nations[prev]
				e.troops = math.max(0, e.troops - 3)
				if e.count <= 0 then
					e.alive = false
				end
				if self.onCapture then
					self.onCapture(n, best, e)
				end
			end
		end
	end
	return done
end

-- a random nation that shares a border with n, or nil
function World:findNeighbor(n)
	local nb = self.nbC
	local front = n.front
	if #front == 0 then
		return nil
	end
	for _ = 1, 24 do
		local f = front[self.rng:NextInteger(1, #front)]
		local c = neighbors(f, nb)
		for i = 1, c do
			local o = readu16(self.owner, nb[i] * 2)
			if o ~= 0 and o ~= n.id then
				return self.nations[o]
			end
		end
	end
	return nil
end

-- a border tile of n close to (px, py), or -1
function World:pickFront(n, px: number, py: number, samples: number): number
	local front = n.front
	if #front == 0 then
		return -1
	end
	local best, bestScore = -1, math.huge
	for _ = 1, samples do
		local f = front[self.rng:NextInteger(1, #front)]
		local dx, dy = f % W - px, f // W - py
		local score = dx * dx + dy * dy
		if score < bestScore then
			bestScore = score
			best = f
		end
	end
	return best
end

-- free land far enough from every placed capital, or nil
function World:randomLand(minDist: number)
	local caps = {}
	for _, n in self.nations do
		if n.cap then
			table.insert(caps, n.cap)
		end
	end
	local rng = self.rng
	for tries = 1, 4000 do
		local t = rng:NextInteger(0, N - 1)
		if isLand(t) and readu16(self.owner, t * 2) == 0 then
			local bi = Map.biome(t)
			if (bi == 4 or bi == 5) and rng:NextNumber() > 0.15 then
				continue
			end
			local x, y = t % W, t // W
			local md = if tries > 2500 then minDist * 0.5 else minDist
			local ok = true
			for _, c in caps do
				if (c.x - x) ^ 2 + (c.y - y) ^ 2 < md * md then
					ok = false
					break
				end
			end
			if ok then
				return { x = x, y = y }
			end
		end
	end
	return nil
end

function World:takeChanges(): { number }
	local list = self.changes
	self.changes = {}
	return list
end

return World
