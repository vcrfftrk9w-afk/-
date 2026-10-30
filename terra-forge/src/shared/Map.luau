-- The world map: biomes, coasts and resource deposits. Tiles are numbered 0..N-1, row by row.
-- Deposits use a fixed seed, so the server and every client get the same ones.
local Config = require(script.Parent.Config)
local Base64 = require(script.Parent.Base64)
local MapData = require(script.Parent.MapData)

local W, H, N = Config.W, Config.H, Config.N
local readu8, writeu8 = buffer.readu8, buffer.writeu8

local Map = { W = W, H = H, N = N }

-- biome per tile: 0 water, 1 grass, 2 desert, 3 mountain, 4 snow, 5 tundra
local biome = buffer.create(N)
do
	local rle = Base64.decode(MapData)
	local p = 0
	for i = 0, buffer.len(rle) - 1 do
		local b = readu8(rle, i)
		local n = b % 32 + 1
		buffer.fill(biome, p, b // 32, n)
		p += n
	end
end

local function neighbors(t: number, out: { number }): number
	local k = 0
	local x = t % W
	if x > 0 then
		k += 1
		out[k] = t - 1
	end
	if x < W - 1 then
		k += 1
		out[k] = t + 1
	end
	if t >= W then
		k += 1
		out[k] = t - W
	end
	if t < N - W then
		k += 1
		out[k] = t + W
	end
	return k
end

-- land tiles next to water, and distance from water tiles to the nearest coast (255 = far)
local coast = buffer.create(N)
local wdist = buffer.create(N)
buffer.fill(wdist, 0, 255)
local landCount = 0
do
	local nb = {}
	local queue = {}
	for t = 0, N - 1 do
		if readu8(biome, t) ~= 0 then
			landCount += 1
			local c = neighbors(t, nb)
			for i = 1, c do
				if readu8(biome, nb[i]) == 0 then
					writeu8(coast, t, 1)
					writeu8(wdist, t, 0)
					table.insert(queue, t)
					break
				end
			end
		end
	end
	for d = 1, 9 do
		local nextQueue = {}
		for _, t in queue do
			local c = neighbors(t, nb)
			for i = 1, c do
				local v = nb[i]
				if readu8(biome, v) == 0 and readu8(wdist, v) == 255 then
					writeu8(wdist, v, d)
					table.insert(nextQueue, v)
				end
			end
		end
		queue = nextQueue
		if #queue == 0 then
			break
		end
	end
end

-- deposits: 1 iron ore, 2 coal, 3 oil
local dep = buffer.create(N)
local deposits = {}
do
	local r = Random.new(1337)
	local dirs = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }
	for _, plan in { { 1, 80 }, { 2, 64 }, { 3, 54 } } do
		local kind, count = plan[1], plan[2]
		local made, tries = 0, 0
		while made < count and tries < 30000 do
			tries += 1
			local t = r:NextInteger(0, N - 1)
			local bi = readu8(biome, t)
			if bi == 0 or bi == 4 then
				continue
			end
			if kind == 3 and not (bi == 2 or readu8(coast, t) == 1) and r:NextNumber() > 0.18 then
				continue
			end
			if kind ~= 3 and bi == 2 and r:NextNumber() > 0.3 then
				continue
			end
			local x, y = t % W, t // W
			local tooClose = false
			for _, d in deposits do
				if math.abs(d.x - x) + math.abs(d.y - y) < 8 then
					tooClose = true
					break
				end
			end
			if tooClose then
				continue
			end
			local cx, cy = x, y
			local size = 6 + r:NextInteger(0, 6)
			for _ = 1, size do
				local tt = cy * W + cx
				local b2 = readu8(biome, tt)
				if b2 ~= 0 and b2 ~= 4 then
					writeu8(dep, tt, kind)
				end
				local dir = dirs[r:NextInteger(1, 4)]
				cx = math.clamp(cx + dir[1], 0, W - 1)
				cy = math.clamp(cy + dir[2], 0, H - 1)
			end
			table.insert(deposits, { x = x, y = y, kind = kind })
			made += 1
		end
	end
end

Map.biomeBuf = biome
Map.coastBuf = coast
Map.wdistBuf = wdist
Map.depBuf = dep
Map.deposits = deposits
Map.landCount = landCount
Map.neighbors = neighbors

function Map.isLand(t: number): boolean
	return readu8(biome, t) ~= 0
end

function Map.biome(t: number): number
	return readu8(biome, t)
end

function Map.deposit(t: number): number
	return readu8(dep, t)
end

function Map.inBounds(x: number, y: number): boolean
	return x >= 0 and y >= 0 and x < W and y < H
end

return Map
