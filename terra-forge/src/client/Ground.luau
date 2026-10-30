-- The ground: the painted world map (tools/gen_texture.py, uploaded as decals by
-- tools/upload_art.py) lying on flat plates at height 0, cut into 4 x 2 chunks. Land and
-- sea in the picture follow the game's tile map. The server turns the decal ids into image
-- ids and shares them as attributes of ReplicatedStorage.TerraForgeArt.
-- One map tile is S studs.
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Map = require(Shared.Map)
local Models = require(script.Parent.Models)

local W, H = Map.W, Map.H
local readu8 = buffer.readu8

local Ground = {}
Ground.S = 2 -- studs per map tile
Ground.CX, Ground.CY = 4, 2 -- chunks of the painted map
Ground.ready = false
-- units and buildings stand this high, just above the territory plates
Ground.STAND_Y = 0.18

local S = Ground.S
local CX, CY = Ground.CX, Ground.CY
local CW, CH = W // CX, H // CY
local MAX_TREES = 1200
local SEA = Color3.fromRGB(26, 68, 116)

local biome = Map.biomeBuf
local folder = nil
local decals = {} -- chunk (from 0) -> Decal

---------------------------------------------------------------- the map surface

-- the surface is flat; heights are kept as functions so the rest of the game can ask
function Ground.height(_x: number, _y: number): number
	return Ground.STAND_Y
end

function Ground.surface(_x: number, _y: number): number
	return Ground.STAND_Y
end

function Ground.tileSurface(_t: number): number
	return 0
end

function Ground.landTile(t: number): boolean
	return readu8(biome, t) ~= 0
end

-- territory is drawn on every land tile
Ground.plateTile = Ground.landTile

-- calls fn(chunk, image) for every chunk picture, now and when it arrives from the server
function Ground.onImage(fn: (number, string) -> ())
	local art = ReplicatedStorage:WaitForChild("TerraForgeArt")
	for c = 0, CX * CY - 1 do
		local name = "map" .. c
		local current = art:GetAttribute(name)
		if typeof(current) == "string" and current ~= "" then
			fn(c, current)
		end
		art:GetAttributeChangedSignal(name):Connect(function()
			local v = art:GetAttribute(name)
			if typeof(v) == "string" and v ~= "" then
				fn(c, v)
			end
		end)
	end
end

local function plate(name: string, size: Vector3, cf: CFrame, color: Color3): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Color = color
	p.Size = size
	p.CFrame = cf
	p.Parent = folder
	return p
end

local function buildPlates()
	-- open sea around the map, a little lower so it never shows through the map
	plate("Sea", Vector3.new(W * S + 4000, 1, H * S + 4000), CFrame.new(W * S / 2, -0.56, H * S / 2), SEA)
	for c = 0, CX * CY - 1 do
		local ci, cj = c % CX, c // CX
		local p = plate("Map" .. c, Vector3.new(CW * S, 1, CH * S), CFrame.new((ci + 0.5) * CW * S, -0.5, (cj + 0.5) * CH * S), SEA)
		local d = Instance.new("Decal")
		d.Face = Enum.NormalId.Top
		d.Parent = p
		decals[c] = d
	end
	task.spawn(Ground.onImage, function(c: number, image: string)
		decals[c].Texture = image
	end)
end

---------------------------------------------------------------- scenery

local function setupLighting()
	pcall(function()
		Lighting.ClockTime = 14.2
		Lighting.GeographicLatitude = 35
		Lighting.Brightness = 2.2
		Lighting.Ambient = Color3.fromRGB(110, 112, 122)
		Lighting.OutdoorAmbient = Color3.fromRGB(150, 152, 162)
		Lighting.EnvironmentDiffuseScale = 0.4
		Lighting.EnvironmentSpecularScale = 0.3
		Lighting.GlobalShadows = true
		Lighting.ShadowSoftness = 0.3
		Lighting.FogEnd = 100000
	end)
	pcall(function()
		local cc = Instance.new("ColorCorrectionEffect")
		cc.Name = "TerraForgeColor"
		cc.Saturation = 0.08
		cc.Contrast = 0.04
		cc.Parent = Lighting
	end)
end

-- a few 3D trees on grass and tundra give the flat picture some depth
local function plantTrees()
	local rng = Random.new(99)
	local trees = Instance.new("Folder")
	trees.Name = "Trees"
	local count = 0
	for y = 1, H - 2, 2 do
		for x = 1, W - 2, 2 do
			local t = y * W + x
			local bi = readu8(biome, t)
			local chance = if bi == 1 then 0.05 elseif bi == 5 then 0.05 else 0
			if chance > 0 and count < MAX_TREES and rng:NextNumber() < chance and readu8(Map.coastBuf, t) == 0 then
				local tree = Models.tree(bi == 5, rng)
				local px, pz = x + rng:NextNumber(), y + rng:NextNumber()
				tree.CFrame = CFrame.new(px * S, tree.Size.Y * 0.36, pz * S)
				tree.CastShadow = false
				tree.Parent = trees
				count += 1
			end
		end
	end
	trees.Parent = folder
end

---------------------------------------------------------------- setup

function Ground.init(): boolean
	folder = Instance.new("Folder")
	folder.Name = "TerraForgeGround"
	folder.Parent = workspace
	setupLighting()
	buildPlates()
	plantTrees()
	Ground.ready = true
	return true
end

return Ground
