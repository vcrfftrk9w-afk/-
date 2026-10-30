-- Turns the packed icon data into EditableImages. Each icon is two images: the fixed colours
-- (outline, metal, glass) and a light layer for the nation-coloured parts, which a child
-- ImageLabel tints with ImageColor3. One pair of images serves every nation, which keeps
-- memory low on phones.
local AssetService = game:GetService("AssetService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Icons = require(Shared.Icons)
local Base64 = require(Shared.Base64)

local S = Icons.size
local readu8, writeu8 = buffer.readu8, buffer.writeu8

local Sprites = {}
Sprites.available = true

-- brightness of the tinted parts: main, dark and light shades of the nation colour
local TINT = { m = 220, d = 150, l = 255 }
local NEUTRAL = Color3.fromRGB(142, 152, 170)

local cache = {}

local function hexRGB(h: string): (number, number, number)
	return tonumber(string.sub(h, 2, 3), 16), tonumber(string.sub(h, 4, 5), 16), tonumber(string.sub(h, 6, 7), 16)
end

local function shade(r: number, g: number, b: number, k: number): (number, number, number)
	if k >= 0 then
		return math.round(r + (255 - r) * k), math.round(g + (255 - g) * k), math.round(b + (255 - b) * k)
	end
	return math.round(r * (1 + k)), math.round(g * (1 + k)), math.round(b * (1 + k))
end

-- an EditableImage filled with pixels, or nil if this device or experience doesn't allow it
local function create(size: Vector2, pixels: buffer?)
	local img = nil
	local ok = pcall(function()
		img = AssetService:CreateEditableImage({ Size = size })
		if img and pixels then
			img:WritePixelsBuffer(Vector2.zero, size, pixels)
		end
	end)
	if ok and img then
		return img
	end
	Sprites.available = false
	return nil
end
Sprites.create = create

local function build(name: string, flip: boolean)
	local icon = Icons.icons[name]
	if not icon then
		return nil
	end
	local raw = Base64.decode(icon.data)
	local pal = {}
	for i, p in icon.palette do
		local entry
		if TINT[p] then
			entry = { tint = true, v = TINT[p] }
		else
			local r, g, b = hexRGB(if #p == 1 then Icons.slots[p] else p)
			entry = { r = r, g = g, b = b }
		end
		pal[i - 1] = entry
	end
	local base = buffer.create(S * S * 4)
	local tint = buffer.create(S * S * 4)
	local hasTint = false
	for i = 0, S * S - 1 do
		local v = readu8(raw, i)
		local a = v % 16
		if a > 0 then
			local c = pal[v // 16] or pal[0]
			local x, y = i % S, i // S
			if flip then
				x = S - 1 - x
			end
			local o = (y * S + x) * 4
			if c.tint then
				hasTint = true
				writeu8(tint, o, c.v)
				writeu8(tint, o + 1, c.v)
				writeu8(tint, o + 2, c.v)
				writeu8(tint, o + 3, a * 17)
			else
				writeu8(base, o, c.r)
				writeu8(base, o + 1, c.g)
				writeu8(base, o + 2, c.b)
				writeu8(base, o + 3, a * 17)
			end
		end
	end
	local size = Vector2.new(S, S)
	local baseImg = create(size, base)
	if not baseImg then
		return nil
	end
	local tintImg = if hasTint then create(size, tint) else nil
	return { base = baseImg, tint = tintImg }
end

-- shows an icon in an ImageLabel/ImageButton, tinted with a nation colour; false if it couldn't
function Sprites.apply(label: GuiObject, name: string, colorHex: string?, flip: boolean?): boolean
	local key = name .. (if flip then "|f" else "")
	local entry = cache[key]
	if entry == nil then
		entry = build(name, flip == true) or false
		cache[key] = entry
	end
	if not entry then
		return false
	end
	local ok = pcall(function()
		local target: any = label
		target.ImageContent = Content.fromObject(entry.base)
		local layer: any = label:FindFirstChild("Tint")
		if entry.tint then
			if not layer then
				layer = Instance.new("ImageLabel")
				layer.Name = "Tint"
				layer.BackgroundTransparency = 1
				layer.Size = UDim2.fromScale(1, 1)
				layer.Parent = label
			end
			layer.ImageContent = Content.fromObject(entry.tint)
			layer.ImageColor3 = if colorHex then Color3.fromHex(colorHex) else NEUTRAL
			layer.ImageTransparency = target.ImageTransparency
		elseif layer then
			layer:Destroy()
		end
	end)
	return ok
end

-- fades an icon, including its tinted layer
function Sprites.setTransparency(label: GuiObject, value: number)
	local target: any = label
	target.ImageTransparency = value
	local layer: any = label:FindFirstChild("Tint")
	if layer then
		layer.ImageTransparency = value
	end
end

Sprites.hexRGB = hexRGB
Sprites.shade = shade

return Sprites
