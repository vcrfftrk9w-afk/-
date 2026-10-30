-- Pictures drawn with interface shapes for the buildings and units that have no painted sprite
-- yet: the radar, the power plant, the repair station, the research centre and the engineer.
-- A drawing fills its
-- parent; it returns its holder and the parts the map animates, and can be recoloured for a
-- team. Once a painted sprite with the same name is in the sprite sheet, the map uses that.
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

-- a unit's drawing, facing up like the sprites: holder, { recolor = fn(Color3) }, or nil
function Drawn.unit(kind: string, parent: Instance, color: Color3)
	if kind ~= "engineer" then
		return nil, nil
	end
	local h = holderIn(parent, false)
	h.ZIndex = 2
	-- seen from above: shoulders in the team colour, a yellow hard hat and a wrench
	local body = shape(h, 0.5, 0.58, 0.56, 0.34, color, 2, 0.5, DARK, 1)
	shape(h, 0.5, 0.46, 0.34, 0.34, Color3.fromRGB(242, 196, 46), 3, 1, DARK, 1)
	local wrench = shape(h, 0.82, 0.42, 0.1, 0.4, Color3.fromRGB(196, 202, 210), 3, 0.5, DARK, 1)
	wrench.Rotation = 20
	return h, {
		recolor = function(c: Color3)
			body.BackgroundColor3 = c
		end,
	}
end

return Drawn
