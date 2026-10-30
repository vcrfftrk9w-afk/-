-- Small pieces the menu and the match screen are built from: icons, round icon buttons, the
-- orange main buttons, avatars, resource chips and prices.
local TweenService = game:GetService("TweenService")

local Sfx = require(script.Parent.Sfx)
local Sprites = require(script.Parent.Sprites)
local Theme = require(script.Parent.Theme)

local make = Theme.make
local C = Theme.C
local font = Theme.font

local Widgets = {}

-- a sprite or symbol icon; props.color (hex) tints a sprite's team parts
function Widgets.icon(name: string, size: number, props)
	props = props or {}
	local color = props.color
	props.color = nil
	props.BackgroundTransparency = 1
	props.Size = props.Size or UDim2.fromOffset(size, size)
	local img = make("ImageLabel", props)
	Sprites.apply(img, name, color)
	return img
end

-- a round dark button with an icon
function Widgets.iconButton(name: string, parent: Instance, onClick)
	local b = make("ImageButton", {
		Size = UDim2.fromOffset(44, 44),
		BackgroundColor3 = Color3.fromRGB(9, 13, 20),
		BackgroundTransparency = 0.16,
		AutoButtonColor = true,
		Parent = parent,
	}, {
		Theme.corner(nil, 1),
		Theme.stroke(),
	})
	Widgets.icon(name, 24, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Parent = b })
	b.Activated:Connect(function()
		Sfx.play("click")
		onClick()
	end)
	return b
end

-- the big orange button, with an optional icon before its text
function Widgets.moltenButton(text: string, parent: Instance, onClick, iconName: string?)
	local b = make("TextButton", {
		Text = "",
		AutoButtonColor = false,
		BackgroundColor3 = Color3.new(1, 1, 1),
		BorderSizePixel = 0,
		Parent = parent,
	}, {
		Theme.corner(14),
		Theme.molten(90),
		make("UIStroke", { Color = Color3.fromRGB(143, 54, 6), Thickness = 2, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }),
	})
	local row = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		BackgroundTransparency = 1,
		Parent = b,
	}, { Theme.list(Enum.FillDirection.Horizontal, 12, Enum.HorizontalAlignment.Center, Enum.VerticalAlignment.Center) })
	if iconName then
		Widgets.icon(iconName, 22, { LayoutOrder = 1, Parent = row })
	end
	Theme.label({
		Text = text,
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		FontFace = font(Enum.FontWeight.Heavy),
		TextSize = 24,
		TextColor3 = C.moltenInk,
		LayoutOrder = 2,
		Parent = row,
	})
	b.Activated:Connect(function()
		Sfx.play("click")
		onClick()
	end)
	b.MouseButton1Down:Connect(function()
		TweenService:Create(row, TweenInfo.new(0.06), { Position = UDim2.new(0.5, 0, 0.5, 3) }):Play()
	end)
	b.MouseButton1Up:Connect(function()
		TweenService:Create(row, TweenInfo.new(0.08), { Position = UDim2.fromScale(0.5, 0.5) }):Play()
	end)
	return b
end

-- a player's face
function Widgets.avatar(userId: number, size: number, props)
	props = props or {}
	props.Size = UDim2.fromOffset(size, size)
	props.BackgroundColor3 = Color3.fromRGB(124, 31, 82)
	if userId > 0 then
		props.Image = "rbxthumb://type=AvatarHeadShot&id=" .. userId .. "&w=150&h=150"
	end
	return make("ImageLabel", props)
end

-- a resource in the top bar: an icon, the value and a line under it; color = team colour (hex)
function Widgets.resChip(parent: Instance, key: string, order: number, color: string)
	local f = make("Frame", {
		AutomaticSize = Enum.AutomaticSize.X,
		Size = UDim2.fromOffset(0, 38),
		BackgroundColor3 = Color3.new(1, 1, 1),
		BackgroundTransparency = 0.96,
		LayoutOrder = order,
		Parent = parent,
	}, {
		Theme.corner(10),
		make("UIPadding", { PaddingLeft = UDim.new(0, 5), PaddingRight = UDim.new(0, 9) }),
		Theme.list(Enum.FillDirection.Horizontal, 6, nil, Enum.VerticalAlignment.Center),
	})
	local img = Widgets.icon(key, 20, { LayoutOrder = 1, color = color, Parent = f })
	local col = make("Frame", { AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), BackgroundTransparency = 1, LayoutOrder = 2, Parent = f }, {
		Theme.list(Enum.FillDirection.Vertical, -1),
	})
	local value = Theme.label({ Text = "0", AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = 15, FontFace = font(Enum.FontWeight.ExtraBold), Parent = col })
	local rate = Theme.label({ Text = "", AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = 11, TextColor3 = C.ok, FontFace = font(Enum.FontWeight.Bold), Parent = col })
	return { value = value, rate = rate, icon = img }
end

-- a price: a coin and the amount
function Widgets.costRow(cost: number, parent: Instance, size: number)
	local row = make("Frame", { AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), BackgroundTransparency = 1, Parent = parent }, {
		Theme.list(Enum.FillDirection.Horizontal, 3, Enum.HorizontalAlignment.Center, Enum.VerticalAlignment.Center),
	})
	Widgets.icon("money", size + 1, { LayoutOrder = 1, Parent = row })
	local label = Theme.label({ Text = tostring(cost), AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = size + 1, FontFace = font(Enum.FontWeight.Bold), TextColor3 = Color3.fromRGB(255, 226, 150), LayoutOrder = 2, Parent = row })
	return row, label
end

return Widgets
