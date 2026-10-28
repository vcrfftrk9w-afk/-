-- Типы клеток. Номера совпадают с levels/Terrain.java из Shattered Pixel Dungeon.
local Terrain = {
	CHASM = 0,
	EMPTY = 1,
	GRASS = 2,
	WALL = 4,
	DOOR = 5,
	OPEN_DOOR = 6,
	ENTRANCE = 7,
	EXIT = 8,
	WALL_DECO = 12,
	HIGH_GRASS = 15,
	EMPTY_DECO = 20,
	WATER = 29,
	FURROWED_GRASS = 30,
}

local T = Terrain

local passable = {
	[T.EMPTY] = true,
	[T.GRASS] = true,
	[T.DOOR] = true,
	[T.OPEN_DOOR] = true,
	[T.ENTRANCE] = true,
	[T.EXIT] = true,
	[T.HIGH_GRASS] = true,
	[T.EMPTY_DECO] = true,
	[T.WATER] = true,
	[T.FURROWED_GRASS] = true,
}

local losBlocking = {
	[T.WALL] = true,
	[T.WALL_DECO] = true,
	[T.DOOR] = true,
	[T.HIGH_GRASS] = true,
	[T.FURROWED_GRASS] = true,
}

local wallLike = {
	[T.WALL] = true,
	[T.WALL_DECO] = true,
}

function Terrain.passable(t)
	return passable[t] == true
end

function Terrain.losBlocking(t)
	return losBlocking[t] == true
end

function Terrain.isWall(t)
	return wallLike[t] == true
end

function Terrain.isFloorLike(t)
	return t == T.EMPTY or t == T.EMPTY_DECO or t == T.GRASS
end

return Terrain
