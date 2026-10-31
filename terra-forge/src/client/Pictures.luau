-- Painted pictures (three-quarter view) of the buildings and units that have no top-down
-- sprite: two sheets of 4 x 4 cells of 256 pixels, the picture and its team-coloured parts in
-- grey (art/pictures_base.png, art/pictures_team.png). Units are not turned like sprites: the
-- map shows the picture or its mirror copy (the next cell), by where the unit is heading.
local Pictures = {}

-- the image ids of the two sheets (uploaded as decals); while they are nil the game keeps the
-- drawings and symbols instead
local BASE: string? = nil
local TEAM: string? = nil
local CELL = 256

-- name -> first cell; right = the picture faces right (units only, they have a mirror copy)
local CELLS = {
	repair = { 0 },
	power = { 1 },
	radar = { 2 },
	lab = { 3 },
	mlrs = { 4, right = true },
	sniper = { 6, right = true },
	engineer = { 8, right = false },
	transport = { 10, right = false },
	bomber = { 12, right = false },
	drone = { 14, right = false },
}

function Pictures.has(name: string): boolean
	return BASE ~= nil and CELLS[name] ~= nil
end

-- shows a picture in an image and its team layer; left = the unit heads left on the screen
function Pictures.set(base: ImageLabel, team: ImageLabel?, name: string, left: boolean?)
	local c = CELLS[name]
	local i = c[1]
	if c.right ~= nil and (left == true) == c.right then
		i += 1
	end
	local offset = Vector2.new(i % 4 * CELL, i // 4 * CELL)
	for _, label in { base, team } do
		if label then
			label.ImageRectOffset = offset
			label.ImageRectSize = Vector2.new(CELL, CELL)
		end
	end
	base.Image = BASE
	if team then
		team.Image = TEAM
	end
end

return Pictures
