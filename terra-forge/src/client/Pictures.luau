-- Painted pictures (three-quarter view) of the buildings and units that have no top-down
-- sprite: two sheets of 4 x 4 cells of 256 pixels, the picture and its team-coloured parts in
-- grey (art/pictures_base.png, art/pictures_team.png). Units are not turned like sprites: the
-- map shows the picture or its mirror copy (the next cell), by where the unit is heading.
local Pictures = {}

-- the image ids of the two sheets (imported with Studio's Asset Manager); while they are nil
-- the game keeps the drawings and symbols instead
local BASE: string? = "rbxassetid://96972992380315"
local TEAM: string? = "rbxassetid://106536867009790"
local CELL = 256

-- name -> first cell; right = the picture faces right (units only, they have a mirror copy);
-- scale = how much bigger than its size in tiles a unit is drawn (a soldier fills little of its
-- cell, a wide aircraft more)
local CELLS = {
	repair = { 0 },
	power = { 1 },
	radar = { 2 },
	lab = { 3 },
	mlrs = { 4, right = true, scale = 1.5 },
	sniper = { 6, right = true, scale = 2.4 },
	engineer = { 8, right = false, scale = 2.4 },
	transport = { 10, right = false, scale = 1.5 },
	bomber = { 12, right = false, scale = 1.4 },
	drone = { 14, right = false, scale = 1.8 },
}

function Pictures.has(name: string): boolean
	return BASE ~= nil and CELLS[name] ~= nil
end

-- how much bigger a unit with this picture is drawn than its size in tiles
function Pictures.scale(name: string): number
	local c = CELLS[name]
	return if BASE ~= nil and c and c.scale then c.scale else 1
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
