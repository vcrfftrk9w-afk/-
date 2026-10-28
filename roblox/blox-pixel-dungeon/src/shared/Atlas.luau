-- Сгенерировано tools/build-atlas.js — не править руками.
-- Координаты кусков атласа assets/atlas.png (графика Shattered Pixel Dungeon, GPL-3.0).
local Atlas = {}

Atlas.SIZE = 512

Atlas.rects = {
	tiles = { x = 0, y = 0, w = 256, h = 256 },
	items = { x = 256, y = 0, w = 256, h = 512 },
	water = { x = 0, y = 256, w = 32, h = 32 },
	icon_bag = { x = 32, y = 256, w = 14, h = 15 },
	icon_wait = { x = 47, y = 256, w = 12, h = 12 },
	icon_search = { x = 60, y = 256, w = 12, h = 12 },
	button = { x = 73, y = 256, w = 24, h = 26 },
	warrior = { x = 0, y = 288, w = 256, h = 75 },
	rat = { x = 0, y = 363, w = 256, h = 15 },
	snake = { x = 0, y = 378, w = 256, h = 11 },
	gnoll = { x = 0, y = 389, w = 256, h = 15 },
	crab = { x = 0, y = 404, w = 256, h = 16 },
	slime = { x = 0, y = 420, w = 128, h = 12 },
	goo = { x = 0, y = 432, w = 256, h = 14 },
}

-- размеры кадров персонажей (как TextureFilm в SPD)
Atlas.film = {
	warrior = { fw = 12, fh = 15, cols = 21 },
	rat = { fw = 16, fh = 15, cols = 16 },
	snake = { fw = 12, fh = 11, cols = 21 },
	gnoll = { fw = 12, fh = 15, cols = 21 },
	crab = { fw = 16, fh = 16, cols = 16 },
	slime = { fw = 14, fh = 12, cols = 9 },
	goo = { fw = 20, fh = 14, cols = 12 },
}

return Atlas
