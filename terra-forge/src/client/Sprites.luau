-- Turns the packed icon data into EditableImages, tinted with a nation's colour and cached.
local AssetService = game:GetService("AssetService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Icons = require(Shared.Icons)
local Base64 = require(Shared.Base64)

local S = Icons.size
local readu8, writeu8 = buffer.readu8, buffer.writeu8

local Sprites = {}
Sprites.available = true

local decoded = {}
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

local function create(size: Vector2)
	local ok, img = pcall(function()
		return AssetService:CreateEditableImage({ Size = size })
	end)
	if ok and img then
		return img
	end
	return nil
end
Sprites.create = create

-- EditableImage for an icon, or nil if images can't be created on this device
function Sprites.get(name: string, colorHex: string?, flip: boolean?)
	local key = name .. "|" .. (colorHex or "") .. (if flip then "|f" else "")
	local cached = cache[key]
	if cached ~= nil then
		return cached or nil
	end
	local icon = Icons.icons[name]
	if not icon then
		return nil
	end
	local raw = decoded[name]
	if not raw then
		raw = Base64.decode(icon.data)
		decoded[name] = raw
	end
	local mr, mg, mb = hexRGB(colorHex or "#8e98aa")
	local pal = {}
	for i, p in icon.palette do
		local r, g, b
		if p == "m" then
			r, g, b = mr, mg, mb
		elseif p == "d" then
			r, g, b = shade(mr, mg, mb, -0.32)
		elseif p == "l" then
			r, g, b = shade(mr, mg, mb, 0.38)
		elseif #p == 1 then
			r, g, b = hexRGB(Icons.slots[p])
		else
			r, g, b = hexRGB(p)
		end
		pal[i - 1] = { r, g, b }
	end
	local px = buffer.create(S * S * 4)
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
			writeu8(px, o, c[1])
			writeu8(px, o + 1, c[2])
			writeu8(px, o + 2, c[3])
			writeu8(px, o + 3, a * 17)
		end
	end
	local img = create(Vector2.new(S, S))
	if not img then
		Sprites.available = false
		cache[key] = false
		return nil
	end
	img:WritePixelsBuffer(Vector2.zero, Vector2.new(S, S), px)
	cache[key] = img
	return img
end

-- shows an icon in an ImageLabel/ImageButton; returns false if it couldn't
function Sprites.apply(label: GuiObject, name: string, colorHex: string?, flip: boolean?): boolean
	local img = Sprites.get(name, colorHex, flip)
	if img then
		local target: any = label
		target.ImageContent = Content.fromObject(img)
		return true
	end
	return false
end

Sprites.hexRGB = hexRGB
Sprites.shade = shade

return Sprites
