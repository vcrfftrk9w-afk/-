-- Pictures drawn with interface shapes for the buildings and units that have no painted sprite
-- yet: the radar, the power plant, the repair station and the research centre; the engineer,
-- the sniper, the MLRS, the AA vehicle, the bomber, the transport and the drone. A drawing
-- fills its parent; it returns its holder and the parts the map animates, and can be
-- recoloured for a team. Once a painted sprite with the same name is in the sprite sheet, the
-- map uses that.
local Theme = require(script.Parent.Theme)

local make = Theme.make

local Drawn = {}

local PAD = Color3.fromRGB(54, 60, 68)
local DARK = Color3.fromRGB(32, 36, 42)

local function holderIn(parent: Instance, anchorBottom: boolean): Frame
	return make("Frame", {
		AnchorPoint = if anchorBottom then Vector2.new(0.5, 1) else Vector2.new(0.5, 0.5),
		Position = if anchorBottom then UDim2.fromScale(0.5, 1) else UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		ZIndex = 1,
		Parent = parent,
	})
end

-- a shape centred at (x, y) of its parent, w x h of it; round = corner radius as a share
local function shape(parent: Instance, x: number, y: number, w: number, h: number, color: Color3, z: number, round: number, stroke: Color3?, thickness: number?)
	local children = { Theme.corner(nil, round) }
	if stroke then
		table.insert(children, make("UIStroke", { Color = stroke, Thickness = thickness or 1 }))
	end
	return make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(x, y),
		Size = UDim2.fromScale(w, h),
		BackgroundColor3 = color,
		BorderSizePixel = 0,
		ZIndex = z,
		Parent = parent,
	}, children)
end

-- a building's drawing, anchored at the bottom so it can rise while being built: holder,
-- { spin = part to turn, pulse = part that beats, pulseScale = its size, recolor = fn(Color3) },
-- or nil
function Drawn.building(kind: string, parent: Instance, color: Color3)
	local h = holderIn(parent, true)
	local pad
	local parts = {}
	if kind == "radar" then
		pad = shape(h, 0.5, 0.5, 0.84, 0.84, Color3.fromRGB(58, 64, 72), 1, 1, color, 2.5)
		shape(h, 0.5, 0.5, 0.34, 0.34, Color3.fromRGB(98, 106, 116), 2, 1)
		parts.spin = shape(h, 0.5, 0.5, 0.18, 0.76, Color3.fromRGB(216, 222, 230), 3, 0.5, DARK, 1)
	elseif kind == "power" then
		pad = shape(h, 0.5, 0.5, 0.9, 0.9, PAD, 1, 0.18, color, 2.5)
		-- two cooling towers and the generator hall with a bolt on it
		for _, x in { 0.3, 0.7 } do
			shape(h, x, 0.32, 0.36, 0.36, Color3.fromRGB(156, 162, 170), 2, 1, DARK, 1)
			shape(h, x, 0.32, 0.2, 0.2, Color3.fromRGB(88, 94, 102), 3, 1)
		end
		shape(h, 0.5, 0.72, 0.66, 0.28, Color3.fromRGB(78, 84, 94), 2, 0.3, DARK, 1)
		parts.pulse = make("TextLabel", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.72),
			Size = UDim2.fromScale(0.3, 0.3),
			BackgroundTransparency = 1,
			Text = "⚡",
			TextScaled = true,
			ZIndex = 4,
			Parent = h,
		})
		parts.pulseScale = 0.3
	elseif kind == "repair" then
		pad = shape(h, 0.5, 0.5, 0.9, 0.9, PAD, 1, 0.18, color, 2.5)
		shape(h, 0.5, 0.5, 0.68, 0.68, Color3.fromRGB(72, 78, 88), 2, 1, Color3.fromRGB(196, 202, 210), 1.5)
		local cross = holderIn(h, false)
		cross.ZIndex = 3
		shape(cross, 0.5, 0.5, 0.14, 0.46, Color3.fromRGB(120, 232, 140), 3, 0.3)
		shape(cross, 0.5, 0.5, 0.46, 0.14, Color3.fromRGB(120, 232, 140), 3, 0.3)
		parts.pulse = cross
		parts.pulseScale = 1
	elseif kind == "lab" then
		pad = shape(h, 0.5, 0.5, 0.9, 0.9, PAD, 1, 0.18, color, 2.5)
		-- a glass dome with a highlight, and a light inside that beats while the centre works
		shape(h, 0.5, 0.5, 0.7, 0.7, Color3.fromRGB(118, 164, 204), 2, 1, Color3.fromRGB(210, 226, 240), 1.5)
		shape(h, 0.38, 0.36, 0.22, 0.14, Color3.fromRGB(214, 232, 246), 3, 1)
		parts.pulse = shape(h, 0.5, 0.56, 0.2, 0.2, Color3.fromRGB(120, 255, 230), 4, 1, DARK, 1)
		parts.pulseScale = 0.2
	else
		h:Destroy()
		return nil, nil
	end
	parts.recolor = function(c: Color3)
		local stroke: any = pad:FindFirstChildOfClass("UIStroke")
		stroke.Color = c
	end
	return h, parts
end

local GREY = Color3.fromRGB(150, 156, 164)
local STEEL = Color3.fromRGB(96, 102, 110)
local GLASS = Color3.fromRGB(70, 130, 180)

-- a spinning rotor: two crossed blades in a frame the map turns
local function rotor(parent: Instance, x: number, y: number, size: number, z: number): Frame
	local r = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(x, y),
		Size = UDim2.fromScale(size, size),
		BackgroundTransparency = 1,
		ZIndex = z,
		Parent = parent,
	})
	for _, rot in { 0, 90 } do
		local blade = shape(r, 0.5, 0.5, 1, 0.08, Color3.fromRGB(30, 32, 36), z, 0.5)
		blade.BackgroundTransparency = 0.25
		blade.Rotation = rot
	end
	return r
end

-- the team-coloured parts of each unit drawing, and what else it has
local UNITS = {}

function UNITS.engineer(h: Frame, color: Color3)
	-- seen from above: shoulders in the team colour, a yellow hard hat and a wrench
	local body = shape(h, 0.5, 0.58, 0.56, 0.34, color, 2, 0.5, DARK, 1)
	shape(h, 0.5, 0.46, 0.34, 0.34, Color3.fromRGB(242, 196, 46), 3, 1, DARK, 1)
	local wrench = shape(h, 0.82, 0.42, 0.1, 0.4, Color3.fromRGB(196, 202, 210), 3, 0.5, DARK, 1)
	wrench.Rotation = 20
	return { body }
end

function UNITS.sniper(h: Frame, color: Color3)
	-- a soldier in a dark hood with a long rifle and a scope
	local body = shape(h, 0.5, 0.6, 0.5, 0.3, color, 2, 0.5, DARK, 1)
	shape(h, 0.5, 0.5, 0.28, 0.28, Color3.fromRGB(58, 74, 48), 3, 1, DARK, 1)
	shape(h, 0.64, 0.3, 0.06, 0.66, Color3.fromRGB(40, 40, 44), 4, 0.5)
	shape(h, 0.64, 0.42, 0.11, 0.13, STEEL, 5, 0.3)
	return { body }
end

function UNITS.mlrs(h: Frame, color: Color3)
	-- a truck: the cab in front, the team-coloured chassis and a pod of rocket tubes
	local chassis = shape(h, 0.5, 0.58, 0.48, 0.66, color, 2, 0.18, DARK, 1)
	shape(h, 0.5, 0.2, 0.42, 0.2, GREY, 3, 0.25, DARK, 1)
	shape(h, 0.5, 0.64, 0.38, 0.46, Color3.fromRGB(70, 74, 80), 3, 0.1, DARK, 1)
	for _, y in { 0.5, 0.64, 0.78 } do
		for _, x in { 0.41, 0.59 } do
			shape(h, x, y, 0.11, 0.11, Color3.fromRGB(24, 26, 30), 4, 1)
		end
	end
	return { chassis }
end

function UNITS.aagun(h: Frame, color: Color3)
	-- a tracked hull with a round turret and two long barrels pointing up
	for _, x in { 0.28, 0.72 } do
		shape(h, x, 0.56, 0.14, 0.72, DARK, 2, 0.3)
	end
	local hull = shape(h, 0.5, 0.56, 0.44, 0.62, color, 3, 0.2, DARK, 1)
	shape(h, 0.5, 0.54, 0.32, 0.32, STEEL, 4, 1, DARK, 1)
	for _, x in { 0.44, 0.56 } do
		shape(h, x, 0.26, 0.06, 0.44, Color3.fromRGB(200, 204, 210), 5, 0.5, DARK, 1)
	end
	return { hull }
end

function UNITS.bomber(h: Frame, color: Color3)
	-- wide team-coloured wings and tail, a long body, two engines and the cockpit glass
	local wings = shape(h, 0.5, 0.46, 0.98, 0.22, color, 2, 0.4, DARK, 1)
	local tail = shape(h, 0.5, 0.86, 0.42, 0.1, color, 2, 0.4, DARK, 1)
	shape(h, 0.5, 0.5, 0.18, 0.88, GREY, 3, 0.5, DARK, 1)
	for _, x in { 0.28, 0.72 } do
		shape(h, x, 0.42, 0.09, 0.18, DARK, 4, 0.4)
	end
	shape(h, 0.5, 0.16, 0.1, 0.12, GLASS, 4, 1)
	return { wings, tail }
end

function UNITS.transport(h: Frame, color: Color3, parts)
	-- a long helicopter body with two rotors, front and back
	local body = shape(h, 0.5, 0.5, 0.34, 0.86, color, 2, 0.45, DARK, 1)
	shape(h, 0.5, 0.14, 0.2, 0.1, GLASS, 3, 0.5)
	shape(h, 0.5, 0.52, 0.16, 0.44, Color3.fromRGB(70, 74, 80), 3, 0.3)
	parts.rotors = { rotor(h, 0.5, 0.2, 0.9, 6), rotor(h, 0.5, 0.8, 0.9, 6) }
	return { body }
end

function UNITS.drone(h: Frame, color: Color3)
	-- a small quadcopter: two crossed arms, four rotor discs and a red camera eye
	for _, rot in { 45, -45 } do
		local arm = shape(h, 0.5, 0.5, 0.92, 0.1, DARK, 2, 0.5)
		arm.Rotation = rot
	end
	for _, p in { { 0.2, 0.2 }, { 0.8, 0.2 }, { 0.2, 0.8 }, { 0.8, 0.8 } } do
		local disc = shape(h, p[1], p[2], 0.3, 0.3, Color3.fromRGB(200, 210, 220), 3, 1)
		disc.BackgroundTransparency = 0.45
	end
	local body = shape(h, 0.5, 0.5, 0.32, 0.32, color, 4, 0.3, DARK, 1)
	shape(h, 0.5, 0.38, 0.09, 0.09, Color3.fromRGB(255, 80, 70), 5, 1)
	return { body }
end

-- a unit's drawing, facing up like the sprites: holder, { recolor = fn(Color3), rotors = frames
-- to spin }, or nil. shadow = the dark copy an aircraft casts on the ground below it
function Drawn.unit(kind: string, parent: Instance, color: Color3, shadow: boolean?)
	local draw = UNITS[kind]
	if not draw then
		return nil, nil
	end
	local h = holderIn(parent, false)
	h.ZIndex = if shadow then 0 else 2
	local parts = {}
	local tinted = draw(h, color, parts)
	if shadow then
		for _, d in h:GetDescendants() do
			if d:IsA("UIStroke") then
				d:Destroy()
			elseif d:IsA("Frame") and d.BackgroundTransparency < 1 then
				d.BackgroundColor3 = Color3.new(0, 0, 0)
				d.BackgroundTransparency = 0.6
			end
		end
		return h, {}
	end
	parts.recolor = function(c: Color3)
		for _, f in tinted do
			f.BackgroundColor3 = c
		end
	end
	return h, parts
end

return Drawn
