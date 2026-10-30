-- The skirmish map: ground kinds per tile, resource pools and the four base spots.
-- Tiles are numbered 0..N-1, row by row. The picture of the map is made from the same data.
local Base64 = require(script.Parent.Base64)
local MapData = require(script.Parent.MapData)

local W, H = MapData.W, MapData.H
local N = W * H
local readu8 = buffer.readu8

local Map = { W = W, H = H, N = N }
Map.WATER, Map.GRASS, Map.SAND, Map.DIRT, Map.ROCK = 0, 1, 2, 3, 4

-- ground kind per tile: 0 water, 1 grass, 2 sand, 3 dirt, 4 rock
local kind = buffer.create(N)
do
	local rle = Base64.decode(MapData.tiles)
	local p = 0
	for i = 0, buffer.len(rle) - 1 do
		local b = readu8(rle, i)
		local n = b % 32 + 1
		buffer.fill(kind, p, b // 32, n)
		p += n
	end
end

-- top-left tiles of the 2 x 2 resource pools, and the centre tiles of the four bases
Map.pools = {}
for _, p in MapData.pools do
	table.insert(Map.pools, { x = p[1], y = p[2] })
end
-- the ground picture is cut into columns x rows pictures: map0, map1, ... row by row
Map.chunks = MapData.chunks or { 2, 2 }

Map.starts = {}
for _, s in MapData.starts do
	table.insert(Map.starts, { x = s[1], y = s[2] })
end

function Map.neighbors(t: number, out: { number }): number
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

function Map.kind(t: number): number
	return readu8(kind, t)
end

-- ground units can drive here: grass, sand or dirt
function Map.isLand(t: number): boolean
	local k = readu8(kind, t)
	return k ~= 0 and k ~= 4
end

function Map.inBounds(x: number, y: number): boolean
	return x >= 0 and y >= 0 and x < W and y < H
end

return Map
