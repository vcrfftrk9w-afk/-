-- Fog of war. The player sees around their units and buildings; ground they have seen before
-- stays dimmed, ground never seen is dark. Enemy units show only where the player sees them;
-- enemy buildings stay on the map once found. A finished radar shows enemy units around it on
-- the minimap, and the first enemy to come into sight after a quiet while is announced.
-- In the menu and for spectators everything is visible.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Board = require(script.Parent.Board)
local Camera = require(script.Parent.Camera)
local Theme = require(script.Parent.Theme)

local W, H = Map.W, Map.H
local make = Theme.make

local CELL = 2 -- tiles per fog square on the board
local CW, CH = math.ceil(W / CELL), math.ceil(H / CELL)
local MINI = 4 -- tiles per fog square on the minimap
local MW, MH = math.ceil(W / MINI), math.ceil(H / MINI)
local FOG = Color3.fromRGB(8, 12, 16)
-- how clear a tile is: seen now, seen before, never seen (1 = no fog)
local CLEAR_SEEN, CLEAR_KNOWN, CLEAR_DARK = 1, 0.55, 0.12
local QUIET = 25 -- seconds without enemies in sight before a new sighting is announced

local Fog = {}
Fog.on = false
Fog.onSpotted = nil -- (x, y): an enemy came into sight after a quiet while

local vis = buffer.create(W * H) -- 1 where the player sees now
local known = buffer.create(W * H) -- 1 where the player has seen
local buildings, units = {}, {}
local myId = function(): number
	return 0
end

local cells = {} -- board fog squares: { frame, target, shown }
local moving = {} -- squares whose transparency is still easing towards the target
local miniCells = {}
local radars = {} -- finished own radars: { x, y, r }
local enemySeenAt = -math.huge
local acc = 0
local laidOut = -1 -- the zoom the board squares were laid out for

local function reveal(x: number, y: number, r: number)
	local r2 = r * r
	local x0, x1 = math.max(0, math.floor(x - r)), math.min(W - 1, math.floor(x + r))
	local y0, y1 = math.max(0, math.floor(y - r)), math.min(H - 1, math.floor(y + r))
	for ty = y0, y1 do
		local dy = ty + 0.5 - y
		local row = ty * W
		for tx = x0, x1 do
			local dx = tx + 0.5 - x
			if dx * dx + dy * dy <= r2 then
				buffer.writeu8(vis, row + tx, 1)
				buffer.writeu8(known, row + tx, 1)
			end
		end
	end
end

local function tileAt(x: number, y: number): number?
	local tx, ty = math.floor(x), math.floor(y)
	if tx < 0 or ty < 0 or tx >= W or ty >= H then
		return nil
	end
	return ty * W + tx
end

-- how clear the fog is over the tiles x0..x1, y0..y1: the average of their clearness
local function clearness(x0: number, y0: number, size: number): number
	local sum, n = 0, 0
	for ty = y0, math.min(H - 1, y0 + size - 1) do
		for tx = x0, math.min(W - 1, x0 + size - 1) do
			local t = ty * W + tx
			sum += if buffer.readu8(vis, t) == 1 then CLEAR_SEEN elseif buffer.readu8(known, t) == 1 then CLEAR_KNOWN else CLEAR_DARK
			n += 1
		end
	end
	return if n > 0 then sum / n else CLEAR_DARK
end

---------------------------------------------------------------- questions

-- true if the player sees the point (x, y) now
function Fog.sees(x: number, y: number): boolean
	if not Fog.on then
		return true
	end
	local t = tileAt(x, y)
	return t ~= nil and buffer.readu8(vis, t) == 1
end

-- true if the player has seen the point (x, y) at some time
function Fog.knows(x: number, y: number): boolean
	if not Fog.on then
		return true
	end
	local t = tileAt(x, y)
	return t ~= nil and buffer.readu8(known, t) == 1
end

-- true if one of the player's radars covers (x, y)
function Fog.radarSees(x: number, y: number): boolean
	for _, r in radars do
		if (x - r.x) ^ 2 + (y - r.y) ^ 2 <= r.r * r.r then
			return true
		end
	end
	return false
end

-- whether a unit or building of the map shows: the player's own always, enemies by the fog
function Fog.showsUnit(u): boolean
	return u.owner == myId() or Fog.sees(u.x, u.y)
end

function Fog.showsBuilding(b): boolean
	return b.owner == myId() or Fog.knows(b.cx, b.cy)
end

-- a unit shows on the minimap where the player sees it or a radar covers it
function Fog.showsOnMinimap(u): boolean
	return Fog.showsUnit(u) or Fog.radarSees(u.x, u.y)
end

---------------------------------------------------------------- drawing

local function setTarget(c, clear: number)
	local target = 1 - clear -- fog opacity: 0 where the ground is clear
	if math.abs(target - c.target) > 0.005 then
		c.target = target
		moving[c] = true
	end
end

-- recomputes what the player sees and where the fog lies
local function refresh()
	buffer.fill(vis, 0, 0)
	table.clear(radars)
	local me = myId()
	for _, u in units do
		if u.owner == me then
			reveal(u.x, u.y, u.def.vision or 6)
		end
	end
	for _, b in buildings do
		if b.owner == me then
			reveal(b.cx, b.cy, b.def.vision or 6)
			if b.def.radar and b.built >= 1 then
				table.insert(radars, { x = b.cx, y = b.cy, r = b.def.radar })
			end
		end
	end
	for _, c in cells do
		setTarget(c, clearness(c.x, c.y, CELL))
	end
	-- the minimap only darkens ground never seen: its squares are solid, so they overlap without seams
	for _, c in miniCells do
		c.frame.Visible = clearness(c.x, c.y, MINI) <= CLEAR_DARK + 0.001
	end
	-- a sighting after a quiet while is announced
	local now = os.clock()
	for _, u in units do
		if u.owner ~= me and Fog.sees(u.x, u.y) then
			if now - enemySeenAt > QUIET and Fog.onSpotted then
				Fog.onSpotted(u.x, u.y)
			end
			enemySeenAt = now
			break
		end
	end
end

-- shows or hides all the fog squares at once
local function showAll(on: boolean)
	for _, c in cells do
		c.target = if on then 1 - CLEAR_DARK else 0
		c.shown = c.target
		c.frame.BackgroundTransparency = 1 - c.shown
		c.frame.Visible = c.shown > 0.005
	end
	table.clear(moving)
	for _, c in miniCells do
		c.frame.Visible = on
	end
end

-- puts the board squares on whole pixels, edge to edge, for the current zoom: squares placed
-- by scale would round apart and show thin seams where they meet
local function layout()
	local ppt = Camera.ppt
	laidOut = ppt
	for _, c in cells do
		local x0, y0 = math.round(c.x * ppt), math.round(c.y * ppt)
		local x1, y1 = math.round((c.x + CELL) * ppt), math.round((c.y + CELL) * ppt)
		c.frame.Position = UDim2.fromOffset(x0, y0)
		c.frame.Size = UDim2.fromOffset(x1 - x0, y1 - y0)
	end
end

---------------------------------------------------------------- setup and state

-- board: the battlefield frame; buildingRecords, unitRecords: the map's records (the tables
-- themselves, kept up to date by the map); mine() gives the player's base id
function Fog.init(board: Frame, buildingRecords, unitRecords, mine: () -> number)
	buildings, units, myId = buildingRecords, unitRecords, mine
	local layer = make("Frame", { Name = "Fog", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ZIndex = Board.Z.fog, Parent = board })
	for cy = 0, CH - 1 do
		for cx = 0, CW - 1 do
			local frame = make("Frame", {
				BackgroundColor3 = FOG,
				BorderSizePixel = 0,
				Visible = false,
				Parent = layer,
			})
			table.insert(cells, { frame = frame, x = cx * CELL, y = cy * CELL, target = 0, shown = 0 })
		end
	end
end

-- fog squares on the minimap, between the ground picture (z) and the dots
function Fog.attachMinimap(holder: GuiObject, z: number)
	for cy = 0, MH - 1 do
		for cx = 0, MW - 1 do
			local frame = make("Frame", {
				Position = Board.at(cx * MINI, cy * MINI),
				-- a hair bigger than the square: solid squares may overlap, gaps would show
				Size = UDim2.new(MINI / W, 1, MINI / H, 1),
				BackgroundColor3 = FOG,
				BorderSizePixel = 0,
				Visible = Fog.on,
				ZIndex = z,
				Parent = holder,
			})
			table.insert(miniCells, { frame = frame, x = cx * MINI, y = cy * MINI })
		end
	end
end

-- on = the player is in a match with a base of their own
function Fog.enable(on: boolean)
	if Fog.on == on then
		return
	end
	Fog.on = on
	showAll(on)
	if on then
		refresh()
	end
end

-- a new match: nothing has been seen yet
function Fog.reset()
	buffer.fill(known, 0, 0)
	enemySeenAt = -math.huge
	if Fog.on then
		showAll(true)
		refresh()
	end
end

function Fog.update(dt: number)
	if not Fog.on then
		return
	end
	if Camera.ppt ~= laidOut then
		layout()
	end
	acc += dt
	if acc >= 0.25 then
		acc = 0
		refresh()
	end
	-- the fog eases in and out instead of jumping square by square
	local k = math.min(1, dt * 5)
	for c in moving do
		c.shown += (c.target - c.shown) * k
		if math.abs(c.target - c.shown) < 0.01 then
			c.shown = c.target
			moving[c] = nil
		end
		c.frame.BackgroundTransparency = 1 - c.shown
		c.frame.Visible = c.shown > 0.005
	end
end

return Fog
