-- Unit and building pictures come from one sprite sheet (atlas) plus a matching sheet with
-- the team-coloured parts in grey, which is tinted with ImageColor3. One pair of images
-- serves every team. Other icons are text symbols.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local SpriteData = require(Shared.SpriteData)
local Art = require(script.Parent.Art)

local Sprites = {}

local NEUTRAL = Color3.fromRGB(150, 158, 172)
local ALIASES = { castle = "cc", pop = "infantry" }

-- the sheets arrive a moment after the game starts; labels made before that wait here
local sheets = { base = nil, team = nil }
local waiting = { base = {}, team = {} }
for layer, artName in { base = "atlas", team = "team" } do
	Art.watch(artName, function(image)
		sheets[layer] = image
		for _, label in waiting[layer] do
			label.Image = image
		end
		waiting[layer] = {}
	end)
end

-- other icons as text symbols, with their colour
local GLYPHS = {
	metal = { "🔩" },
	energy = { "⚡" },
	power = { "⚡" },
	repair = { "🔧" },
	engineer = { "👷" },
	flag = { "🚩" },
	trophy = { "🏆" },
	exit = { "⏏", Color3.fromRGB(238, 242, 248) },
	plus = { "+", Color3.fromRGB(238, 242, 248) },
	minus = { "−", Color3.fromRGB(238, 242, 248) },
	close = { "×", Color3.fromRGB(238, 242, 248) },
	help = { "?", Color3.fromRGB(238, 242, 248) },
	play = { "▶", Color3.fromRGB(43, 18, 3) },
	shield = { "🛡" },
	radar = { "📡" },
	lock = { "🔒" },
	globe = { "🌍" },
	swords = { "⚔", Color3.fromRGB(238, 242, 248) },
}

function Sprites.has(name: string): boolean
	return SpriteData[ALIASES[name] or name] ~= nil
end

-- shows one sprite of a sheet ("base" or "team") in an ImageLabel
function Sprites.set(label: ImageLabel, name: string, layer: string)
	local cell = SpriteData[ALIASES[name] or name]
	if not cell then
		return
	end
	label.ImageRectOffset = Vector2.new(cell[1], cell[2])
	label.ImageRectSize = Vector2.new(cell[3], cell[3])
	local image = sheets[layer]
	if image then
		label.Image = image
	else
		label.Image = ""
		table.insert(waiting[layer], label)
	end
end

local function glyphIcon(label: GuiObject, glyph)
	local t = Instance.new("TextLabel")
	t.Name = "Glyph"
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 1
	t.Text = glyph[1]
	t.TextScaled = true
	t.Font = Enum.Font.GothamBold
	t.TextColor3 = glyph[2] or Color3.new(1, 1, 1)
	t.ZIndex = label.ZIndex
	t.Parent = label
	return t
end

-- shows an icon in an ImageLabel/ImageButton, with its team parts in the given colour
function Sprites.apply(label: GuiObject, name: string, colorHex: string?)
	local target: any = label
	local layer: any = label:FindFirstChild("Tint")
	if Sprites.has(name) then
		local glyph = label:FindFirstChild("Glyph")
		if glyph then
			glyph:Destroy()
		end
		Sprites.set(target, name, "base")
		if not layer then
			layer = Instance.new("ImageLabel")
			layer.Name = "Tint"
			layer.BackgroundTransparency = 1
			layer.Size = UDim2.fromScale(1, 1)
			layer.ZIndex = label.ZIndex
			layer.Parent = label
		end
		Sprites.set(layer, name, "team")
		layer.ImageColor3 = if colorHex then Color3.fromHex(colorHex) else NEUTRAL
		layer.ImageTransparency = target.ImageTransparency
		return
	end
	if layer then
		layer:Destroy()
	end
	local glyph = GLYPHS[name]
	local old = label:FindFirstChild("Glyph")
	if old and old:GetAttribute("Icon") == name then
		return
	end
	if old then
		old:Destroy()
	end
	if glyph then
		glyphIcon(label, glyph):SetAttribute("Icon", name)
	end
end

-- fades an icon, including its tinted layer
function Sprites.setTransparency(label: GuiObject, value: number)
	local target: any = label
	target.ImageTransparency = value
	local layer: any = label:FindFirstChild("Tint")
	if layer then
		layer.ImageTransparency = value
	end
	local glyph: any = label:FindFirstChild("Glyph")
	if glyph then
		glyph.TextTransparency = value
	end
end

return Sprites
