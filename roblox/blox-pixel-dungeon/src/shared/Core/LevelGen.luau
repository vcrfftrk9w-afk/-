-- Генерация этажа канализации: комнаты, коридоры с дверями, вода и трава.
-- Упрощённая версия RegularLevel/SewerPainter из Shattered Pixel Dungeon.
local Terrain = require(script.Parent.Terrain)

local T = Terrain
local LevelGen = {}

local W, H = 40, 40

local function makeHeap()
	local items, keys = {}, {}
	local heap = {}
	function heap.push(v, k)
		local i = #items + 1
		items[i], keys[i] = v, k
		while i > 1 do
			local p = math.floor(i / 2)
			if keys[p] <= keys[i] then
				break
			end
			items[p], items[i] = items[i], items[p]
			keys[p], keys[i] = keys[i], keys[p]
			i = p
		end
	end
	function heap.pop()
		local n = #items
		if n == 0 then
			return nil
		end
		local top = items[1]
		items[1], keys[1] = items[n], keys[n]
		items[n], keys[n] = nil, nil
		n = n - 1
		local i = 1
		while true do
			local l, r, m = i * 2, i * 2 + 1, i
			if l <= n and keys[l] < keys[m] then
				m = l
			end
			if r <= n and keys[r] < keys[m] then
				m = r
			end
			if m == i then
				break
			end
			items[m], items[i] = items[i], items[m]
			keys[m], keys[i] = keys[i], keys[m]
			i = m
		end
		return top
	end
	return heap
end

local function idx(x, y)
	return y * W + x + 1
end

local function roomsApart(a, b)
	-- между стенами двух комнат должна остаться хотя бы одна клетка
	return a.x2 + 1 + 2 <= b.x1 - 1 or b.x2 + 1 + 2 <= a.x1 - 1 or a.y2 + 1 + 2 <= b.y1 - 1 or b.y2 + 1 + 2 <= a.y1 - 1
end

local function center(r)
	return math.floor((r.x1 + r.x2) / 2), math.floor((r.y1 + r.y2) / 2)
end

local function placeRooms(rng, boss)
	local rooms = {}
	if boss then
		local s = 9
		local x1 = rng:intRange(math.floor(W / 2) - 2, W - s - 4)
		local y1 = rng:intRange(4, H - s - 4)
		rooms[1] = { x1 = x1, y1 = y1, x2 = x1 + s - 1, y2 = y1 + s - 1, arena = true }
	end
	local target = boss and rng:intRange(5, 7) or rng:intRange(9, 12)
	for _ = 1, 600 do
		if #rooms >= target then
			break
		end
		local big = rng:chance(0.25)
		local rw = big and rng:intRange(6, 9) or rng:intRange(3, 6)
		local rh = big and rng:intRange(5, 8) or rng:intRange(3, 6)
		local x1 = rng:intRange(2, W - rw - 2)
		local y1 = rng:intRange(2, H - rh - 2)
		local r = { x1 = x1, y1 = y1, x2 = x1 + rw - 1, y2 = y1 + rh - 1 }
		local ok = true
		for _, o in ipairs(rooms) do
			if not roomsApart(r, o) then
				ok = false
				break
			end
		end
		if ok then
			rooms[#rooms + 1] = r
		end
	end
	return rooms
end

-- рёбра: минимальное остовное дерево + несколько лишних для петель
local function connections(rng, rooms)
	local n = #rooms
	local function dist(a, b)
		local ax, ay = center(rooms[a])
		local bx, by = center(rooms[b])
		return (ax - bx) ^ 2 + (ay - by) ^ 2
	end
	local inTree = { [1] = true }
	local edges, has = {}, {}
	for _ = 2, n do
		local best, bi, bj = math.huge, nil, nil
		for i = 1, n do
			if inTree[i] then
				for j = 1, n do
					if not inTree[j] then
						local d = dist(i, j)
						if d < best then
							best, bi, bj = d, i, j
						end
					end
				end
			end
		end
		inTree[bj] = true
		edges[#edges + 1] = { bi, bj }
		has[bi * 100 + bj], has[bj * 100 + bi] = true, true
	end
	local extra = 0
	for i = 1, n do
		for j = i + 1, n do
			if extra < 3 and not has[i * 100 + j] and dist(i, j) < 18 ^ 2 and rng:chance(0.3) then
				edges[#edges + 1] = { i, j }
				extra = extra + 1
			end
		end
	end
	return edges
end

local DIRS4 = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }

local function carveCorridor(lvl, ring, roomOf, a, b)
	local map = lvl.map
	local rb = lvl.rooms[b]
	local sx, sy = center(lvl.rooms[a])
	local start = idx(sx, sy)
	local cost, from = { [start] = 0 }, {}
	local heap = makeHeap()
	local function h(x, y)
		local dx = math.max(0, rb.x1 - x, x - rb.x2)
		local dy = math.max(0, rb.y1 - y, y - rb.y2)
		return dx + dy
	end
	heap.push(start, h(sx, sy))
	local goal
	while true do
		local cur = heap.pop()
		if not cur then
			return false
		end
		if roomOf[cur] == b then
			goal = cur
			break
		end
		local cx, cy = (cur - 1) % W, math.floor((cur - 1) / W)
		local curSide = ring[cur]
		for _, d in ipairs(DIRS4) do
			local nx, ny = cx + d[1], cy + d[2]
			if nx > 0 and ny > 0 and nx < W - 1 and ny < H - 1 then
				local ni = idx(nx, ny)
				local side = ring[ni]
				local step
				if side == "c" then
					step = nil
				elseif side == "h" then
					step = d[1] == 0 and 6 or nil
				elseif side == "v" then
					step = d[2] == 0 and 6 or nil
				elseif roomOf[ni] or map[ni] ~= T.WALL then
					step = 1
				else
					step = 2
				end
				if curSide == "h" and d[1] ~= 0 then
					step = nil
				elseif curSide == "v" and d[2] ~= 0 then
					step = nil
				end
				if step then
					local nc = cost[cur] + step
					if cost[ni] == nil or nc < cost[ni] then
						cost[ni] = nc
						from[ni] = cur
						heap.push(ni, nc + h(nx, ny))
					end
				end
			end
		end
	end
	local cur = goal
	while cur do
		if ring[cur] then
			if map[cur] == T.WALL then
				map[cur] = T.DOOR
			end
		elseif map[cur] == T.WALL then
			map[cur] = T.EMPTY
			lvl.corridor[cur] = true
		end
		cur = from[cur]
	end
	return true
end

-- клеточный автомат как watabou Patch.generate (с forceFillRate)
local NEIGHBOURS9 = { -W - 1, -W, -W + 1, -1, 0, 1, W - 1, W, W + 1 }

local function patch(rng, fill, clustering)
	local target = math.floor(W * H * fill + 0.5)
	fill = fill + (0.5 - fill) * 0.5
	local cur = {}
	for i = 1, W * H do
		cur[i] = rng:float() < fill
	end
	for _ = 1, clustering do
		local nxt = {}
		for y = 0, H - 1 do
			for x = 0, W - 1 do
				local count, total = 0, 0
				for dy = -1, 1 do
					for dx = -1, 1 do
						local nx, ny = x + dx, y + dy
						if nx >= 0 and ny >= 0 and nx < W and ny < H then
							total = total + 1
							if cur[idx(nx, ny)] then
								count = count + 1
							end
						end
					end
				end
				nxt[idx(x, y)] = count * 2 >= total
			end
		end
		cur = nxt
	end
	local diff = -target
	for i = 1, W * H do
		if cur[i] then
			diff = diff + 1
		end
	end
	local growing = diff < 0
	while diff ~= 0 do
		local cell, tries = nil, 0
		repeat
			cell = idx(rng:intRange(1, W - 2), rng:intRange(1, H - 2))
			tries = tries + 1
		until cur[cell] == growing or tries * 10 >= W * H
		for _, n in ipairs(NEIGHBOURS9) do
			if diff ~= 0 and cur[cell + n] ~= growing then
				cur[cell + n] = growing
				diff = diff + (growing and 1 or -1)
			end
		end
	end
	return cur
end

local function roomCells(r)
	local cells = {}
	for y = r.y1, r.y2 do
		for x = r.x1, r.x2 do
			cells[#cells + 1] = idx(x, y)
		end
	end
	return cells
end

local function nearDoor(map, i)
	for _, d in ipairs(DIRS4) do
		local t = map[i + d[1] + d[2] * W]
		if t == T.DOOR or t == T.OPEN_DOOR then
			return true
		end
	end
	return false
end

-- расстояния по проходимым клеткам (для выбора самой дальней комнаты)
local function bfs(map, start)
	local dist = { [start] = 0 }
	local queue, head = { start }, 1
	while head <= #queue do
		local cur = queue[head]
		head = head + 1
		for _, d in ipairs(DIRS4) do
			local n = cur + d[1] + d[2] * W
			if dist[n] == nil and Terrain.passable(map[n]) then
				dist[n] = dist[cur] + 1
				queue[#queue + 1] = n
			end
		end
	end
	return dist
end

local function tryBuild(rng, depth)
	local boss = depth % 5 == 0
	local rooms = placeRooms(rng, boss)
	if #rooms < (boss and 4 or 7) then
		return nil
	end
	local lvl = { w = W, h = H, depth = depth, boss = boss, map = {}, rooms = rooms, corridor = {} }
	local map = lvl.map
	for i = 1, W * H do
		map[i] = T.WALL
	end
	local ring, roomOf = {}, {}
	for ri, r in ipairs(rooms) do
		for y = r.y1 - 1, r.y2 + 1 do
			for x = r.x1 - 1, r.x2 + 1 do
				local i = idx(x, y)
				local edgeX = x == r.x1 - 1 or x == r.x2 + 1
				local edgeY = y == r.y1 - 1 or y == r.y2 + 1
				if edgeX and edgeY then
					ring[i] = "c"
				elseif edgeY then
					ring[i] = "h"
				elseif edgeX then
					ring[i] = "v"
				else
					map[i] = T.EMPTY
					roomOf[i] = ri
				end
			end
		end
	end
	for _, e in ipairs(connections(rng, rooms)) do
		if not carveCorridor(lvl, ring, roomOf, e[1], e[2]) then
			return nil
		end
	end
	lvl.roomOf = roomOf

	-- часть дверей — просто проёмы
	for i = 1, W * H do
		if map[i] == T.DOOR and rng:chance(0.2) then
			map[i] = T.EMPTY
		end
	end

	-- вход и выход
	local entranceRoom, exitRoom
	if boss then
		exitRoom = 1
		local far, best = nil, -1
		local cx, cy = center(rooms[1])
		local dist = bfs(map, idx(cx, cy))
		for ri = 2, #rooms do
			local rx, ry = center(rooms[ri])
			local d = dist[idx(rx, ry)] or -1
			if d > best then
				far, best = ri, d
			end
		end
		entranceRoom = far
	else
		entranceRoom = rng:intRange(1, #rooms)
		local ex, ey = center(rooms[entranceRoom])
		local dist = bfs(map, idx(ex, ey))
		local far, best = nil, -1
		for ri = 1, #rooms do
			local rx, ry = center(rooms[ri])
			local d = dist[idx(rx, ry)] or -1
			if ri ~= entranceRoom and d > best then
				far, best = ri, d
			end
		end
		exitRoom = far
	end
	if not entranceRoom or not exitRoom then
		return nil
	end
	local function spot(r)
		local cells = rng:shuffle(roomCells(r))
		for _, i in ipairs(cells) do
			if not nearDoor(map, i) then
				return i
			end
		end
		return cells[1]
	end
	lvl.entrance = spot(rooms[entranceRoom])
	if boss then
		local r = rooms[exitRoom]
		lvl.exit = idx(math.floor((r.x1 + r.x2) / 2), r.y1)
		lvl.bossPos = idx(center(r))
	else
		lvl.exit = spot(rooms[exitRoom])
	end
	map[lvl.entrance] = T.ENTRANCE
	map[lvl.exit] = T.EXIT
	lvl.entranceRoom, lvl.exitRoom = entranceRoom, exitRoom

	-- вода и трава
	local water = patch(rng, boss and 0.45 or 0.30, 5)
	local grass = patch(rng, 0.20, 4)
	for i = 1, W * H do
		if water[i] and map[i] == T.EMPTY then
			map[i] = T.WATER
		end
	end
	if boss then
		-- лужи в логове Гу, сам он стоит на сухом
		map[lvl.bossPos] = T.EMPTY
	end
	for i = W + 2, W * H - W - 1 do
		if grass[i] and map[i] == T.EMPTY then
			local count = 1
			for dy = -1, 1 do
				for dx = -1, 1 do
					if (dx ~= 0 or dy ~= 0) and grass[i + dx + dy * W] then
						count = count + 1
					end
				end
			end
			map[i] = rng:float() < count / 12 and T.HIGH_GRASS or T.GRASS
		end
	end

	-- украшения: трубы в стенах над водой, мусор у стен
	for i = W + 1, W * H - W do
		if map[i] == T.WALL and map[i - W] == T.WALL and map[i + W] == T.WATER and rng:int(2) == 0 then
			map[i] = T.WALL_DECO
		end
	end
	for i = W + 2, W * H - W - 1 do
		if map[i] == T.EMPTY then
			local count = 0
			if map[i + 1] == T.WALL then count = count + 1 end
			if map[i - 1] == T.WALL then count = count + 1 end
			if map[i + W] == T.WALL then count = count + 1 end
			if map[i - W] == T.WALL then count = count + 1 end
			if rng:int(16) < count * count then
				map[i] = T.EMPTY_DECO
			end
		end
	end

	-- проверка: всё проходимое достижимо от входа
	local dist = bfs(map, lvl.entrance)
	for i = 1, W * H do
		if Terrain.passable(map[i]) and dist[i] == nil then
			return nil
		end
	end

	lvl.variance = {}
	for i = 1, W * H do
		lvl.variance[i] = rng:int(100)
	end
	return lvl
end

function LevelGen.generate(rng, depth)
	for _ = 1, 50 do
		local lvl = tryBuild(rng, depth)
		if lvl then
			return lvl
		end
	end
	error("не удалось построить уровень")
end

LevelGen.W, LevelGen.H = W, H

return LevelGen
