-- Colours, fonts and small helpers for building UI in code.
local Theme = {}

Theme.C = {
	bg = Color3.fromRGB(10, 14, 21),
	panel = Color3.fromRGB(13, 18, 28),
	panelHi = Color3.fromRGB(24, 32, 48),
	line = Color3.fromRGB(128, 150, 192),
	ink = Color3.fromRGB(238, 242, 248),
	muted = Color3.fromRGB(152, 164, 185),
	moltenHi = Color3.fromRGB(255, 210, 126),
	molten = Color3.fromRGB(255, 138, 31),
	moltenLo = Color3.fromRGB(214, 90, 12),
	moltenInk = Color3.fromRGB(43, 18, 3),
	ok = Color3.fromRGB(67, 217, 133),
	bad = Color3.fromRGB(255, 103, 103),
	ocean = Color3.fromRGB(34, 89, 141),
	dark = Color3.fromRGB(12, 15, 22),
}

local FAMILY = "rbxasset://fonts/families/GothamSSm.json"
function Theme.font(weight: Enum.FontWeight?): Font
	return Font.new(FAMILY, weight or Enum.FontWeight.Bold)
end

-- Instance.new with properties and children; Parent is applied last
function Theme.make(class: string, props, children)
	local inst = Instance.new(class)
	if props then
		for k, v in props do
			if k ~= "Parent" then
				inst[k] = v
			end
		end
	end
	if children then
		for _, c in children do
			c.Parent = inst
		end
	end
	if props and props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end
local make = Theme.make

function Theme.corner(radius: number?, scale: number?)
	return make("UICorner", { CornerRadius = if scale then UDim.new(scale, 0) else UDim.new(0, radius or 14) })
end

function Theme.stroke(color: Color3?, thickness: number?, transparency: number?)
	return make("UIStroke", {
		Color = color or Theme.C.line,
		Thickness = thickness or 1,
		Transparency = transparency or 0.78,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
	})
end

function Theme.textStroke(color: Color3?, thickness: number?)
	return make("UIStroke", { Color = color or Theme.C.dark, Thickness = thickness or 2, Transparency = 0.15 })
end

function Theme.pad(x: number, y: number?)
	y = y or x
	return make("UIPadding", {
		PaddingLeft = UDim.new(0, x),
		PaddingRight = UDim.new(0, x),
		PaddingTop = UDim.new(0, y),
		PaddingBottom = UDim.new(0, y),
	})
end

function Theme.list(direction: Enum.FillDirection, gap: number, hAlign: Enum.HorizontalAlignment?, vAlign: Enum.VerticalAlignment?)
	return make("UIListLayout", {
		FillDirection = direction,
		Padding = UDim.new(0, gap),
		HorizontalAlignment = hAlign or Enum.HorizontalAlignment.Left,
		VerticalAlignment = vAlign or Enum.VerticalAlignment.Top,
		SortOrder = Enum.SortOrder.LayoutOrder,
	})
end

function Theme.gradient(stops: { { number | Color3 } }, rotation: number?)
	local keys = {}
	for _, s in stops do
		table.insert(keys, ColorSequenceKeypoint.new(s[1], s[2]))
	end
	return make("UIGradient", { Color = ColorSequence.new(keys), Rotation = rotation or 90 })
end

-- the orange "molten metal" fill used for the main buttons and the logo
function Theme.molten(rotation: number?)
	return Theme.gradient({
		{ 0, Color3.fromRGB(255, 236, 196) },
		{ 0.18, Theme.C.moltenHi },
		{ 0.62, Theme.C.molten },
		{ 1, Theme.C.moltenLo },
	}, rotation)
end

function Theme.panel(props)
	props = props or {}
	if props.BackgroundColor3 == nil then
		props.BackgroundColor3 = Theme.C.panel
	end
	if props.BackgroundTransparency == nil then
		props.BackgroundTransparency = 0.08
	end
	props.BorderSizePixel = 0
	if props.Active == nil then
		props.Active = true
	end
	local f = make("Frame", props)
	Theme.corner(16).Parent = f
	Theme.stroke().Parent = f
	return f
end

function Theme.label(props, children)
	props.BackgroundTransparency = 1
	props.BorderSizePixel = 0
	if props.FontFace == nil then
		props.FontFace = Theme.font(Enum.FontWeight.Bold)
	end
	if props.TextColor3 == nil then
		props.TextColor3 = Theme.C.ink
	end
	if props.TextXAlignment == nil then
		props.TextXAlignment = Enum.TextXAlignment.Left
	end
	return make("TextLabel", props, children)
end

function Theme.hex(h: string): Color3
	return Color3.fromHex(h)
end

return Theme
