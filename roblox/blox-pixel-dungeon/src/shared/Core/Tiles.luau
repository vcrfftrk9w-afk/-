-- Какую картинку из tiles_sewers.png рисовать в клетке. Перенос DungeonTileSheet,
-- DungeonTerrainTilemap и DungeonWallsTilemap из Shattered Pixel Dungeon: объёмные стены,
-- нависающие верхушки стен и берега воды.
local Terrain = require(script.Parent.Terrain)

local T = Terrain
local Tiles = {}

local function xy(x, y)
	return (x - 1) + 16 * (y - 1)
end

local FLOOR, FLOOR_DECO, GRASS = xy(1, 1), xy(1, 1) + 1, xy(1, 1) + 2
local FLOOR_ALT_1, FLOOR_DECO_ALT, GRASS_ALT, FLOOR_ALT_2 = FLOOR + 6, FLOOR + 7, FLOOR + 8, FLOOR + 12
local ENTRANCE, EXIT = FLOOR + 16, FLOOR + 17
local WATER = xy(1, 3)
local RAISED_WALL, RAISED_WALL_DECO, RAISED_WALL_DOOR = xy(1, 6), xy(1, 6) + 4, xy(1, 6) + 8
local RAISED_WALL_ALT, RAISED_WALL_DECO_ALT = xy(1, 6) + 16, xy(1, 6) + 20
local RAISED_DOOR, RAISED_DOOR_OPEN, RAISED_DOOR_SIDEWAYS = xy(1, 8), xy(1, 8) + 1, xy(1, 8) + 4
local RAISED_HIGH_GRASS, RAISED_FURROWED = xy(9, 8) + 2, xy(9, 8) + 3
local RAISED_HIGH_GRASS_ALT, RAISED_FURROWED_ALT = xy(9, 8) + 5, xy(9, 8) + 6
local WALL_INTERNAL = xy(1, 10)
local WALL_OVERHANG = xy(1, 13)
local DOOR_SIDEWAYS_OVERHANG, DOOR_SIDEWAYS_OVERHANG_CLOSED = xy(1, 13) + 16, xy(1, 13) + 20
local DOOR_OVERHANG, DOOR_OVERHANG_OPEN, DOOR_SIDEWAYS = xy(1, 15), xy(1, 15) + 1, xy(1, 15) + 3
local HIGH_GRASS_OVERHANG, FURROWED_OVERHANG = xy(9, 15) + 2, xy(9, 15) + 3
local HIGH_GRASS_OVERHANG_ALT, FURROWED_OVERHANG_ALT = xy(9, 15) + 5, xy(9, 15) + 6

Tiles.NONE = -1

-- альтернативные варианты по «разбросу» клетки (getVisualWithAlts)
local ALTS = {
	[FLOOR] = { { 52.5, FLOOR_ALT_1 }, { 5, FLOOR_ALT_2 } },
	[GRASS] = { { 50, GRASS_ALT } },
	[FLOOR_DECO] = { { 50, FLOOR_DECO_ALT } },
	[RAISED_WALL] = { { 50, RAISED_WALL_ALT } },
	[RAISED_WALL_DECO] = { { 50, RAISED_WALL_DECO_ALT } },
	[RAISED_HIGH_GRASS] = { { 50, RAISED_HIGH_GRASS_ALT } },
	[RAISED_FURROWED] = { { 50, RAISED_FURROWED_ALT } },
	[HIGH_GRASS_OVERHANG] = { { 50, HIGH_GRASS_OVERHANG_ALT } },
	[FURROWED_OVERHANG] = { { 50, FURROWED_OVERHANG_ALT } },
}

local function alt(visual, variance)
	local list = ALTS[visual]
	if list then
		for _, a in ipairs(list) do
			if variance < a[1] then
				visual = a[2]
			end
		end
	end
	return visual
end

local DIRECT = {
	[T.EMPTY] = FLOOR,
	[T.GRASS] = GRASS,
	[T.ENTRANCE] = ENTRANCE,
	[T.EXIT] = EXIT,
	[T.EMPTY_DECO] = FLOOR_DECO,
}

local WATER_STITCH = {
	[T.EMPTY] = true,
	[T.GRASS] = true,
	[T.ENTRANCE] = true,
	[T.EXIT] = true,
	[T.HIGH_GRASS] = true,
	[T.FURROWED_GRASS] = true,
	[T.EMPTY_DECO] = true,
	[T.DOOR] = true,
	[T.OPEN_DOOR] = true,
}

local function wallStitch(t)
	return t == nil or t == T.WALL or t == T.WALL_DECO
end

local function isDoor(t)
	return t == T.DOOR or t == T.OPEN_DOOR
end

-- клетка вне карты считается стеной (как NULL_TILE в SPD)
local function at(map, w, h, x, y)
	if x < 0 or y < 0 or x >= w or y >= h then
		return nil
	end
	return map[y * w + x + 1]
end

-- нижний слой (под персонажами)
function Tiles.ground(map, w, h, i, variance)
	local x, y = (i - 1) % w, math.floor((i - 1) / w)
	local t = map[i]
	local direct = DIRECT[t]
	if direct then
		return alt(direct, variance)
	end
	if t == T.WATER then
		local v = WATER
		if WATER_STITCH[at(map, w, h, x, y - 1)] then v = v + 1 end
		if WATER_STITCH[at(map, w, h, x + 1, y)] then v = v + 2 end
		if WATER_STITCH[at(map, w, h, x, y + 1)] then v = v + 4 end
		if WATER_STITCH[at(map, w, h, x - 1, y)] then v = v + 8 end
		return v
	end
	if isDoor(t) then
		if wallStitch(at(map, w, h, x, y - 1)) then
			return RAISED_DOOR_SIDEWAYS
		end
		return t == T.DOOR and RAISED_DOOR or RAISED_DOOR_OPEN
	end
	if wallStitch(t) then
		local below = at(map, w, h, x, y + 1)
		if below == nil or wallStitch(below) then
			return Tiles.NONE
		end
		local v
		if isDoor(below) then
			v = RAISED_WALL_DOOR
		elseif t == T.WALL_DECO then
			v = RAISED_WALL_DECO
		else
			v = RAISED_WALL
		end
		v = alt(v, variance)
		if not wallStitch(at(map, w, h, x + 1, y)) then v = v + 1 end
		if not wallStitch(at(map, w, h, x - 1, y)) then v = v + 2 end
		return v
	end
	if t == T.HIGH_GRASS then
		return alt(RAISED_HIGH_GRASS, variance)
	elseif t == T.FURROWED_GRASS then
		return alt(RAISED_FURROWED, variance)
	end
	return Tiles.NONE
end

-- верхний слой (поверх персонажей): верхушки стен и нависания
function Tiles.upper(map, w, h, i, variance, varianceBelow)
	local x, y = (i - 1) % w, math.floor((i - 1) / w)
	local t = map[i]
	local below = at(map, w, h, x, y + 1)
	if wallStitch(t) then
		if below ~= nil and not wallStitch(below) then
			if below == T.DOOR then
				return DOOR_SIDEWAYS
			end
			return Tiles.NONE
		end
		local v = WALL_INTERNAL
		if not wallStitch(at(map, w, h, x + 1, y)) then v = v + 1 end
		if not wallStitch(at(map, w, h, x + 1, y + 1)) then v = v + 2 end
		if not wallStitch(at(map, w, h, x - 1, y + 1)) then v = v + 4 end
		if not wallStitch(at(map, w, h, x - 1, y)) then v = v + 8 end
		return v
	end
	if below ~= nil and wallStitch(below) then
		local v
		if t == T.OPEN_DOOR then
			v = DOOR_SIDEWAYS_OVERHANG
		elseif t == T.DOOR then
			v = DOOR_SIDEWAYS_OVERHANG_CLOSED
		else
			v = WALL_OVERHANG
		end
		if not wallStitch(at(map, w, h, x + 1, y + 1)) then v = v + 1 end
		if not wallStitch(at(map, w, h, x - 1, y + 1)) then v = v + 2 end
		return v
	end
	if below == T.DOOR then
		return DOOR_OVERHANG
	elseif below == T.OPEN_DOOR then
		return DOOR_OVERHANG_OPEN
	elseif below == T.HIGH_GRASS then
		return alt(HIGH_GRASS_OVERHANG, varianceBelow or 0)
	elseif below == T.FURROWED_GRASS then
		return alt(FURROWED_OVERHANG, varianceBelow or 0)
	end
	return Tiles.NONE
end

return Tiles
