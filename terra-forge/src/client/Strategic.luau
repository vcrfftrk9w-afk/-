-- Strategic points on the board: a ring around each point in its owner's colour (light grey
-- while nobody holds it), a diamond in the middle, its name (hidden when the map is zoomed far
-- out), a bar while someone is taking it, and the player's supply lines: from the command
-- centre along the points that are supplied. The server decides everything; this only draws
-- what it sends.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Board = require(script.Parent.Board)
local Theme = require(script.Parent.Theme)

local make = Theme.make
local Z = Board.Z
local at, span = Board.at, Board.span

local Strategic = {}

local NEUTRAL = Color3.fromRGB(214, 220, 228)
local CONTESTED = Color3.fromRGB(255, 150, 60)
local R = Config.POINT_RADIUS

local board
local colorOf: (number) -> Color3? = function()
	return nil
end
local myId: () -> number = function()
	return 0
end
local myBase: () -> (number?, number?) = function()
	return nil, nil
end

local points = {} -- id -> record
local lines = {} -- supply line frames
local namesShown = true -- the names hide when the map is too small to read them

-- the point records: { id, name, x, y, owner, cap, k, contested, supplied, link }
function Strategic.records()
	return points
end

local function makePoint(info)
	local p = {
		id = info.id,
		name = info.name,
		x = info.x,
		y = info.y,
		owner = 0,
		cap = 0,
		k = 0,
		contested = false,
		supplied = false,
		link = -1,
	}
	p.frame = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = at(p.x, p.y),
		Size = span(2 * R, 2 * R),
		BackgroundColor3 = NEUTRAL,
		BackgroundTransparency = 0.9,
		ZIndex = Z.mark,
		Parent = board,
	}, { Theme.corner(nil, 1) })
	p.stroke = make("UIStroke", { Color = NEUTRAL, Thickness = 2.5, Transparency = 0.15, Parent = p.frame })
	p.mark = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromScale(0.22, 0.22),
		Rotation = 45,
		BackgroundColor3 = NEUTRAL,
		ZIndex = Z.mark,
		Parent = p.frame,
	}, { make("UIStroke", { Color = Color3.fromRGB(20, 24, 30), Thickness = 1.5 }) })
	p.label = make("TextLabel", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = at(p.x, p.y - R - 0.2),
		Size = span(16, 1.2),
		BackgroundTransparency = 1,
		Visible = namesShown,
		Text = p.name,
		TextScaled = true,
		TextColor3 = NEUTRAL,
		FontFace = Theme.font(Enum.FontWeight.Heavy),
		ZIndex = Z.label,
		Parent = board,
	}, {
		make("UITextSizeConstraint", { MinTextSize = 8, MaxTextSize = 15 }),
		make("UIStroke", { Color = Color3.fromRGB(8, 10, 14), Thickness = 2, Transparency = 0.1 }),
	})
	p.bar = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = at(p.x, p.y + R + 0.3),
		Size = span(4, 0.45),
		BackgroundColor3 = Color3.fromRGB(14, 17, 22),
		BorderSizePixel = 0,
		Visible = false,
		ZIndex = Z.label,
		Parent = board,
	})
	p.fill = make("Frame", { Size = UDim2.fromScale(0, 1), BorderSizePixel = 0, ZIndex = Z.label, Parent = p.bar })
	points[p.id] = p
	return p
end

local function refreshPoint(p)
	local color = colorOf(p.owner) or NEUTRAL
	p.frame.BackgroundColor3 = color
	p.mark.BackgroundColor3 = color
	p.stroke.Color = if p.contested then CONTESTED else color
	p.label.TextColor3 = color:Lerp(Color3.new(1, 1, 1), 0.3)
	p.bar.Visible = p.cap ~= 0
	if p.cap ~= 0 then
		p.fill.Size = UDim2.fromScale(math.clamp(p.k, 0, 1), 1)
		p.fill.BackgroundColor3 = colorOf(p.cap) or NEUTRAL
	end
end

-- a straight line on the board between two points, in tiles
local function line(x1: number, y1: number, x2: number, y2: number, color: Color3)
	local dx, dy = x2 - x1, y2 - y1
	local len = math.sqrt(dx * dx + dy * dy)
	return make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = at((x1 + x2) / 2, (y1 + y2) / 2),
		Size = span(len, 0.28),
		Rotation = math.deg(math.atan2(dy, dx)),
		BackgroundColor3 = color,
		BackgroundTransparency = 0.35,
		BorderSizePixel = 0,
		ZIndex = Z.mark,
		Parent = board,
	})
end

-- the player's supply lines: each supplied point is linked to the node that supplies it
local function refreshLines()
	for _, l in lines do
		l:Destroy()
	end
	table.clear(lines)
	local me = myId()
	local color = colorOf(me)
	local bx, by = myBase()
	if not color then
		return
	end
	for _, p in points do
		if p.owner == me and p.supplied then
			local from = if p.link == 0 then nil else points[p.link]
			local fx, fy = if from then from.x else bx, if from then from.y else by
			if fx and fy then
				table.insert(lines, line(fx, fy, p.x, p.y, color))
			end
		end
	end
end

-- s = flat: id, owner, capturer, progress 0..100, flags (1 contested, 2 supplied), link
function Strategic.setState(s)
	for i = 1, #s - 5, 6 do
		local p = points[s[i]]
		if p then
			p.owner = s[i + 1]
			p.cap = s[i + 2]
			p.k = s[i + 3] / 100
			p.contested = s[i + 4] % 2 == 1
			p.supplied = s[i + 4] // 2 % 2 == 1
			p.link = s[i + 5]
			refreshPoint(p)
		end
	end
	refreshLines()
end

-- the points of a match: list of { id, name, x, y }, and their state
function Strategic.load(list, state)
	Strategic.clear()
	for _, info in list or {} do
		refreshPoint(makePoint(info))
	end
	if state then
		Strategic.setState(state)
	end
end

-- colours and the player's base changed (a nation joined or changed hands)
function Strategic.refresh()
	for _, p in points do
		refreshPoint(p)
	end
	refreshLines()
end

function Strategic.clear()
	for _, p in points do
		p.frame:Destroy()
		p.label:Destroy()
		p.bar:Destroy()
	end
	table.clear(points)
	for _, l in lines do
		l:Destroy()
	end
	table.clear(lines)
end

-- a contested point blinks; the names show from 10 pixels per tile
function Strategic.update()
	local shown = board.AbsoluteSize.X >= Map.W * 10
	if shown ~= namesShown then
		namesShown = shown
		for _, p in points do
			p.label.Visible = shown
		end
	end
	local on = os.clock() % 0.6 < 0.3
	for _, p in points do
		if p.contested then
			p.stroke.Transparency = if on then 0 else 0.6
		elseif p.stroke.Transparency ~= 0.15 then
			p.stroke.Transparency = 0.15
		end
	end
end

-- colors(owner id) gives a team colour (nil for nobody); mine() the player's base id; base()
-- the middle of the player's command centre
function Strategic.init(boardFrame: Frame, colors: (number) -> Color3?, mine: () -> number, base: () -> (number?, number?))
	board, colorOf, myId, myBase = boardFrame, colors, mine, base
end

return Strategic
