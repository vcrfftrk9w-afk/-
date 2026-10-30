-- Land pathfinding for ground units: A* over tiles (8 directions, no cutting corners),
-- then the path is straightened so units drive in long lines instead of tile steps.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Map = require(ReplicatedStorage:WaitForChild("TerraForge").Map)

local W, H = Map.W, Map.H
local isLand = Map.isLand

local Path = {}

local SQRT2 = math.sqrt(2)
local DIRS = {
	{ 1, 0, 1 }, { -1, 0, 1 }, { 0, 1, 1 }, { 0, -1, 1 },
	{ 1, 1, SQRT2 }, { 1, -1, SQRT2 }, { -1, 1, SQRT2 }, { -1, -1, SQRT2 },
}

-- connected land areas (continents and islands), so unreachable targets are known at once
local region = buffer.create(Map.N * 2)
do
	local nb = {}
	local id = 0
	for t = 0, Map.N - 1 do
		if isLand(t) and buffer.readu16(region, t * 2) == 0 then
			id += 1
			buffer.writeu16(region, t * 2, id)
			local queue = { t }
			local head = 1
			while head <= #queue do
				local cur = queue[head]
				head += 1
				local c = Map.neighbors(cur, nb)
				for i = 1, c do
					local v = nb[i]
					if isLand(v) and buffer.readu16(region, v * 2) == 0 then
						buffer.writeu16(region, v * 2, id)
						table.insert(queue, v)
					end
				end
			end
		end
	end
end

local function landAt(x: number, y: number): boolean
	local tx, ty = math.floor(x), math.floor(y)
	return Map.inBounds(tx, ty) and isLand(ty * W + tx)
end

-- true if the straight line between two points stays on land
function Path.clear(x1: number, y1: number, x2: number, y2: number): boolean
	local dx, dy = x2 - x1, y2 - y1
	local steps = math.ceil(math.sqrt(dx * dx + dy * dy) / 0.35)
	for i = 0, steps do
		local k = if steps > 0 then i / steps else 0
		if not landAt(x1 + dx * k, y1 + dy * k) then
			return false
		end
	end
	return true
end

-- nearest land tile to (x, y) within `radius`, or nil
function Path.nearestLand(x: number, y: number, radius: number): (number?, number?)
	x, y = math.floor(x), math.floor(y)
	if landAt(x, y) then
		return x, y
	end
	for r = 1, radius do
		local best, bd = nil, math.huge
		for dy = -r, r do
			for dx = -r, r do
				if math.max(math.abs(dx), math.abs(dy)) == r and landAt(x + dx, y + dy) then
					local d = dx * dx + dy * dy
					if d < bd then
						bd = d
						best = { x + dx, y + dy }
					end
				end
			end
		end
		if best then
			return best[1], best[2]
		end
	end
	return nil, nil
end

-- binary heap of tile ids ordered by f-score
local function push(heap, score, t, f)
	local i = #heap + 1
	heap[i] = t
	score[t] = f
	while i > 1 do
		local p = i // 2
		if score[heap[p]] <= f then
			break
		end
		heap[i], heap[p] = heap[p], heap[i]
		i = p
	end
end

local function pop(heap, score)
	local top = heap[1]
	local last = heap[#heap]
	heap[#heap] = nil
	local n = #heap
	if n > 0 then
		heap[1] = last
		local i = 1
		while true do
			local l, r = i * 2, i * 2 + 1
			local m = i
			if l <= n and score[heap[l]] < score[heap[m]] then
				m = l
			end
			if r <= n and score[heap[r]] < score[heap[m]] then
				m = r
			end
			if m == i then
				break
			end
			heap[i], heap[m] = heap[m], heap[i]
			i = m
		end
	end
	return top
end

-- tile path from start to goal tile coordinates, or nil if not found within maxNodes
local function astar(sx: number, sy: number, gx: number, gy: number, maxNodes: number)
	local start, goal = sy * W + sx, gy * W + gx
	local g = { [start] = 0 }
	local f = {}
	local from = {}
	local closed = {}
	local heap = {}
	local function h(t)
		local dx, dy = math.abs(t % W - gx), math.abs(t // W - gy)
		return math.max(dx, dy) + (SQRT2 - 1) * math.min(dx, dy)
	end
	push(heap, f, start, h(start))
	local expanded = 0
	while #heap > 0 do
		local cur = pop(heap, f)
		if cur == goal then
			local tiles = {}
			while cur do
				table.insert(tiles, 1, cur)
				cur = from[cur]
			end
			return tiles, expanded
		end
		if not closed[cur] then
			closed[cur] = true
			expanded += 1
			if expanded > maxNodes then
				return nil, expanded
			end
			local cx, cy = cur % W, cur // W
			local gc = g[cur]
			for _, d in DIRS do
				local nx, ny = cx + d[1], cy + d[2]
				if Map.inBounds(nx, ny) then
					local nt = ny * W + nx
					local ok = isLand(nt) and not closed[nt]
					if ok and d[3] > 1 then
						-- no cutting corners past water
						ok = isLand(cy * W + nx) and isLand(ny * W + cx)
					end
					if ok then
						local ng = gc + d[3]
						if g[nt] == nil or ng < g[nt] then
							g[nt] = ng
							from[nt] = cur
							push(heap, f, nt, ng + h(nt))
						end
					end
				end
			end
		end
	end
	return nil, expanded
end

-- straightens a tile path into a few waypoints (tile centres), flat x1, y1, x2, y2, ...
local function simplify(tiles): { number }
	local pts = {}
	for _, t in tiles do
		table.insert(pts, { t % W + 0.5, t // W + 0.5 })
	end
	local out = { pts[1][1], pts[1][2] }
	local i = 1
	while i < #pts do
		local j = i + 1
		while j + 1 <= #pts and j + 1 - i <= 60 and Path.clear(pts[i][1], pts[i][2], pts[j + 1][1], pts[j + 1][2]) do
			j += 1
		end
		table.insert(out, pts[j][1])
		table.insert(out, pts[j][2])
		i = j
	end
	return out
end

-- Path for a ground unit from (x, y) to the land tile nearest (tx, ty).
-- Falls back to driving straight until the coast when no path is found.
function Path.ground(x: number, y: number, tx: number, ty: number, maxNodes: number): { number }
	local sx, sy = Path.nearestLand(x, y, 3)
	local gx, gy = Path.nearestLand(tx, ty, 6)
	if not sx or not gx then
		return { x, y }
	end
	if Path.clear(x, y, gx + 0.5, gy + 0.5) then
		return { x, y, gx + 0.5, gy + 0.5 }
	end
	local sameRegion = buffer.readu16(region, (sy * W + sx) * 2) == buffer.readu16(region, (gy * W + gx) * 2)
	local tiles = if sameRegion then astar(sx, sy, gx, gy, maxNodes) else nil
	if tiles then
		local pts = simplify(tiles)
		pts[1], pts[2] = x, y
		return pts
	end
	-- no route: drive straight towards the target and stop at the water
	local dx, dy = gx + 0.5 - x, gy + 0.5 - y
	local len = math.sqrt(dx * dx + dy * dy)
	if len < 0.01 then
		return { x, y }
	end
	local stepX, stepY = dx / len * 0.35, dy / len * 0.35
	local px, py = x, y
	for _ = 1, math.ceil(len / 0.35) do
		if not landAt(px + stepX, py + stepY) then
			break
		end
		px += stepX
		py += stepY
	end
	return { x, y, px, py }
end

function Path.inMap(x: number, y: number): (number, number)
	return math.clamp(x, 0.5, W - 0.5), math.clamp(y, 0.5, H - 0.5)
end

return Path
