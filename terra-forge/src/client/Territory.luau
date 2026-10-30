-- Territory and fog of war drawn with flat parts on the ground, so no image APIs are needed.
-- In every map row, a run of tiles with the same owner is one tinted plate; fog is dark
-- plates over the cells you can't see. A row is rebuilt only after it changes.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Map = require(Shared.Map)
local Ground = require(script.Parent.Ground)

local W, H = Map.W, Map.H
local readu8, readu16 = buffer.readu8, buffer.readu16
local S = Ground.S

local Territory = {}

local FOG_COLOR = Color3.fromRGB(10, 14, 24)
local FOG_ALPHA = 0.42

local folder = nil
local pool = {}
local rows = {} -- map row -> plates in use
local dirty = {}
local queue = {}
local fogRows = {} -- row of fog cells -> plates in use
local fogDirty = {}
local fogQueue = {}

local function take(): Part
	local p = table.remove(pool)
	if not p then
		p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.CastShadow = false
		p.Material = Enum.Material.SmoothPlastic
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
	end
	return p
end

local function give(p: Part)
	p.Parent = nil
	table.insert(pool, p)
end

local function plate(list, i: number, x0: number, x1: number, z0: number, depth: number, y: number, color: Color3, alpha: number)
	local p = list[i]
	if not p then
		p = take()
		list[i] = p
	end
	p.Size = Vector3.new((x1 - x0) * S, 0.1, depth * S)
	p.CFrame = CFrame.new((x0 + x1) * 0.5 * S, y, (z0 + depth * 0.5) * S)
	p.Color = color
	p.Transparency = alpha
	if p.Parent ~= folder then
		p.Parent = folder
	end
end

local function trim(list, used: number)
	for i = #list, used + 1, -1 do
		give(list[i])
		list[i] = nil
	end
end

-- takes up to max entries from a queue of row numbers, in the order they came
local function drain(q, flags, max: number, fn: (number) -> ())
	local total = #q
	local count = math.min(total, max)
	for i = 1, count do
		local y = q[i]
		flags[y] = nil
		fn(y)
	end
	table.move(q, count + 1, total, 1)
	for i = total - count + 1, total do
		q[i] = nil
	end
end

function Territory.init(parent: Instance)
	folder = Instance.new("Folder")
	folder.Name = "Territory"
	folder.Parent = parent
end

function Territory.markRow(y: number)
	if not dirty[y] then
		dirty[y] = true
		table.insert(queue, y)
	end
end

function Territory.markAll()
	for y = 0, H - 1 do
		Territory.markRow(y)
	end
end

-- rebuilds changed rows; look(owner) gives a colour and transparency, or nil for bare ground
function Territory.update(owner: buffer, look: (number) -> (Color3?, number), maxRows: number)
	drain(queue, dirty, maxRows, function(y: number)
		local list = rows[y] or {}
		rows[y] = list
		local used = 0
		local x = 0
		local base = y * W
		while x < W do
			local t = base + x
			local o = readu16(owner, t * 2)
			if o ~= 0 and Ground.plateTile(t) then
				-- a plate spans tiles of one owner at about the same height, and lies on the highest
				local h0 = Ground.tileSurface(t)
				local top = h0
				local x1 = x + 1
				while x1 < W do
					local t1 = base + x1
					if readu16(owner, t1 * 2) ~= o or not Ground.plateTile(t1) then
						break
					end
					local h = Ground.tileSurface(t1)
					if math.abs(h - h0) > 0.75 then
						break
					end
					top = math.max(top, h)
					x1 += 1
				end
				local color, alpha = look(o)
				if color then
					used += 1
					plate(list, used, x, x1, y, 1, top + 0.12, color, alpha)
				end
				x = x1
			else
				x += 1
			end
		end
		trim(list, used)
	end)
end

function Territory.markFogRow(cy: number)
	if not fogDirty[cy] then
		fogDirty[cy] = true
		table.insert(fogQueue, cy)
	end
end

-- rebuilds changed fog rows: dark plates over cells whose byte in visible is 0
function Territory.updateFog(visible: buffer, fw: number, cell: number, on: boolean, maxRows: number)
	drain(fogQueue, fogDirty, maxRows, function(cy: number)
		local list = fogRows[cy] or {}
		fogRows[cy] = list
		local used = 0
		if on then
			local cx = 0
			while cx < fw do
				if readu8(visible, cy * fw + cx) == 0 then
					local cx1 = cx + 1
					while cx1 < fw and readu8(visible, cy * fw + cx1) == 0 do
						cx1 += 1
					end
					used += 1
					plate(list, used, cx * cell, cx1 * cell, cy * cell, cell, Ground.STAND_Y + 0.4, FOG_COLOR, FOG_ALPHA)
					cx = cx1
				else
					cx += 1
				end
			end
		end
		trim(list, used)
	end)
end

function Territory.clear()
	for y, list in rows do
		trim(list, 0)
		rows[y] = nil
	end
	for cy, list in fogRows do
		trim(list, 0)
		fogRows[cy] = nil
	end
	table.clear(dirty)
	table.clear(queue)
	table.clear(fogDirty)
	table.clear(fogQueue)
end

return Territory
