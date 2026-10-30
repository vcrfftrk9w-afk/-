-- Build mode on the map: the server's placement rules, an outline of the chosen building under
-- the pointer (green if it fits, red if not), and helpers that show where it can go: rings
-- around the free pools for extractors, the base zones for the rest.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Board = require(script.Parent.Board)
local Theme = require(script.Parent.Theme)

local W = Map.W
local make = Theme.make
local Z = Board.Z
local at, span = Board.at, Board.span

local Placement = {}
Placement.kind = nil :: string? -- the building chosen in the build bar

local board, ghost
local buildings = {} -- the map's building records
local myId = function(): number
	return 0
end
local helpers = {}

local function overlaps(ax: number, ay: number, as: number, bx: number, by: number, bs: number): boolean
	return ax < bx + bs and bx < ax + as and ay < by + bs and by < ay + as
end

local function areaFree(x: number, y: number, size: number): boolean
	for _, b in buildings do
		if overlaps(x, y, size, b.x, b.y, b.size) then
			return false
		end
	end
	return true
end

local function nearMyBase(cx: number, cy: number): boolean
	local r2 = Config.BUILD_RADIUS * Config.BUILD_RADIUS
	local me = myId()
	for _, b in buildings do
		if b.owner == me and (b.cx - cx) ^ 2 + (b.cy - cy) ^ 2 <= r2 then
			return true
		end
	end
	return false
end

-- the same rules as the server: top-left tile for a building tapped at (x, y), or nil and why not
function Placement.placeFor(kind: string, x: number, y: number): (number?, number?, string?)
	local def = Config.BUILD[kind]
	local size = def.size
	x, y = math.floor(x), math.floor(y)
	local bx, by
	if def.onPool then
		local best, bd = nil, 3.5 * 3.5
		for _, p in Map.pools do
			local d = (p.x + 1 - (x + 0.5)) ^ 2 + (p.y + 1 - (y + 0.5)) ^ 2
			if d < bd and areaFree(p.x, p.y, 2) then
				best, bd = p, d
			end
		end
		if not best then
			return nil, nil, "Экстрактор ставится на свободное месторождение — светящуюся воронку."
		end
		bx, by = best.x, best.y
	else
		bx, by = x - size // 2, y - size // 2
	end
	for ty = by, by + size - 1 do
		for tx = bx, bx + size - 1 do
			if not Map.inBounds(tx, ty) or not Map.isLand(ty * W + tx) then
				return nil, nil, "Тут нельзя строить: вода, скалы или край карты."
			end
		end
	end
	if not areaFree(bx, by, size) then
		return nil, nil, "Тут тесно: место занято другой постройкой."
	end
	if not def.onPool then
		for _, p in Map.pools do
			if overlaps(bx, by, size, p.x, p.y, 2) then
				return nil, nil, "Месторождения оставь для экстракторов."
			end
		end
	end
	if not nearMyBase(bx + size / 2, by + size / 2) then
		return nil, nil, "Строить можно только рядом со своей базой."
	end
	return bx, by, nil
end

function Placement.clear()
	for _, h in helpers do
		h.frame:Destroy()
	end
	helpers = {}
end

-- redraws the helpers for the chosen building, after buildings come or go
function Placement.refresh()
	Placement.clear()
	local kind = Placement.kind
	if not kind then
		return
	end
	if Config.BUILD[kind].onPool then
		for _, p in Map.pools do
			if areaFree(p.x, p.y, 2) then
				local f = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = at(p.x + 1, p.y + 1), Size = span(2.8, 2.8), BackgroundTransparency = 1, ZIndex = Z.mark, Parent = board })
				Board.ring(f, Color3.fromRGB(110, 255, 220), 2.5, Z.mark)
				table.insert(helpers, { frame = f, pulse = true })
			end
		end
	else
		local r = Config.BUILD_RADIUS
		local me = myId()
		for _, b in buildings do
			if b.owner == me then
				local f = make("Frame", {
					AnchorPoint = Vector2.new(0.5, 0.5),
					Position = at(b.cx, b.cy),
					Size = span(2 * r, 2 * r),
					BackgroundColor3 = Color3.new(1, 1, 1),
					BackgroundTransparency = 0.95,
					ZIndex = Z.mark,
					Parent = board,
				}, { Theme.corner(nil, 1), make("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 1.5, Transparency = 0.55 }) })
				table.insert(helpers, { frame = f })
			end
		end
	end
end

-- outline of the chosen building where it would stand: green if it fits, red if not
function Placement.ghostAt(x: number, y: number)
	local kind = Placement.kind
	if not kind then
		ghost.Visible = false
		return
	end
	local def = Config.BUILD[kind]
	local bx, by, why = Placement.placeFor(kind, x, y)
	local s = def.size
	if not bx or not by then
		bx, by = math.floor(x) - s // 2, math.floor(y) - s // 2
	end
	ghost.Position = at(bx, by)
	ghost.Size = span(s, s)
	local color = if why then Color3.fromRGB(255, 90, 80) else Color3.fromRGB(110, 255, 140)
	ghost.BackgroundColor3 = color
	local stroke: any = ghost:FindFirstChildOfClass("UIStroke")
	stroke.Color = color
	ghost.Visible = true
end

-- kind = building chosen in the build bar, or nil
function Placement.set(kind: string?)
	Placement.kind = kind
	Placement.refresh()
	if not kind then
		ghost.Visible = false
	end
end

-- the rings around free pools pulse
function Placement.update()
	local clock = os.clock()
	for _, h in helpers do
		if h.pulse then
			local s = 2.6 + 0.35 * math.sin(clock * 5)
			h.frame.Size = span(s, s)
		end
	end
end

-- records: the map's building records (the table itself, kept up to date by the map);
-- mine() gives the player's base id
function Placement.init(boardFrame: Frame, records, mine: () -> number)
	board, buildings, myId = boardFrame, records, mine
	ghost = make("Frame", { BackgroundTransparency = 0.7, Visible = false, ZIndex = Z.top, Parent = board }, {
		make("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 2 }),
	})
end

return Placement
