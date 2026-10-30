-- The 3D ground, made of Roblox terrain so it works in every experience without image or
-- mesh APIs. Land rises from the sea as grass, forest, sand, rock or snow by biome, mountains
-- stand higher, and the ocean is terrain water with sandy shallows near the coast.
-- One map tile is S studs; a terrain voxel (4 studs) covers B x B tiles.
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Map = require(Shared.Map)
local Models = require(script.Parent.Models)

local W, H = Map.W, Map.H
local readu8, writeu8 = buffer.readu8, buffer.writeu8
local readf32, writef32 = buffer.readf32, buffer.writef32

local Ground = {}
Ground.S = 2 -- studs per map tile
Ground.ready = false

local S = Ground.S
local VOX = 4
local B = VOX // S -- tiles per voxel side
local VX, VZ = W // B, H // B -- voxel columns
local LAND_TOP = 4 -- top of the plains, in studs; the sea is at 0
local Y0 = -8 -- bottom of the lowest voxel layer
local LAYERS = 8
local MAX_TREES = 1800

-- territory plates lie just above the plains; units and buildings stand on them
Ground.PLATE_Y = LAND_TOP + 0.25
Ground.STAND_Y = LAND_TOP + 0.32

local biome, coast, wdist = Map.biomeBuf, Map.coastBuf, Map.wdistBuf
local AIR, WATER = Enum.Material.Air, Enum.Material.Water
local MATS = {
	Enum.Material.Grass, -- 1 grass
	Enum.Material.Sand, -- 2 desert and beaches
	Enum.Material.Rock, -- 3 mountains
	Enum.Material.Snow, -- 4 ice
	Enum.Material.Ground, -- 5 tundra
	Enum.Material.LeafyGrass, -- 6 forest
}

local colMat = buffer.create(VX * VZ) -- 0 = sea, else index into MATS
local colRise = buffer.create(VX * VZ) -- extra voxel layers of mountain or ice
local colTop = buffer.create(VX * VZ * 4) -- surface height in studs
local colShallow = buffer.create(VX * VZ) -- sea near the coast: sandy floor shows through
local folder = nil

---------------------------------------------------------------- helpers

-- smooth noise in about 0..1
local function noise(x: number, y: number, scale: number, seed: number): number
	return math.clamp(math.noise(x / scale + 0.37, y / scale + 0.71, seed + 0.13) * 1.25 + 0.5, 0, 1)
end

local function forestAt(x: number, y: number): number
	return noise(x, y, 10, 5) + (noise(x, y, 3, 6) - 0.5) * 0.4
end

---------------------------------------------------------------- columns

local function classify()
	local counts = { 0, 0, 0, 0, 0 }
	for vz = 0, VZ - 1 do
		for vx = 0, VX - 1 do
			local land, coastal, near = 0, 0, 255
			for i = 1, 5 do
				counts[i] = 0
			end
			for dz = 0, B - 1 do
				for dx = 0, B - 1 do
					local t = (vz * B + dz) * W + vx * B + dx
					local bi = readu8(biome, t)
					if bi ~= 0 then
						land += 1
						counts[bi] += 1
						coastal += readu8(coast, t)
					else
						near = math.min(near, readu8(wdist, t))
					end
				end
			end
			local c = vz * VX + vx
			local cx, cy = (vx + 0.5) * B, (vz + 0.5) * B
			if land * 2 < B * B then
				writeu8(colShallow, c, if near <= 3 then 1 else 0)
				writef32(colTop, c * 4, 0)
				continue
			end
			local best = 1
			for i = 2, 5 do
				if counts[i] > counts[best] then
					best = i
				end
			end
			local mat, rise = best, 0
			if best == 3 then
				local r = noise(cx, cy, 7, 21)
				rise = math.clamp(1 + math.floor(r * r * 3.2 + noise(cx, cy, 2.5, 22) * 0.9), 1, 4)
			elseif best == 4 then
				rise = 1
			elseif best == 1 and forestAt(cx, cy) > 0.56 then
				mat = 6
			end
			if coastal * 2 >= B * B and best ~= 3 and best ~= 4 and noise(cx, cy, 5, 8) > 0.45 then
				mat = 2
			end
			writeu8(colMat, c, mat)
			writeu8(colRise, c, rise)
			writef32(colTop, c * 4, if rise > 0 then LAND_TOP + rise * VOX - 1 else Ground.STAND_Y)
		end
	end
end

-- true when the ground at a tile is land (a land tile in a sea voxel is drawn as sea)
function Ground.landTile(t: number): boolean
	local x, y = t % W, t // W
	return readu8(colMat, (y // B) * VX + x // B) ~= 0
end

local function top(vx: number, vz: number): number
	vx = math.clamp(vx, 0, VX - 1)
	vz = math.clamp(vz, 0, VZ - 1)
	return readf32(colTop, (vz * VX + vx) * 4)
end

-- height in studs of the ground surface at a map position (tiles, fractional);
-- on land the sea next to it doesn't pull the height down, so units stay on the shore
function Ground.height(x: number, y: number): number
	local own = top(math.floor(x / B), math.floor(y / B))
	local function h(vx: number, vz: number): number
		local v = top(vx, vz)
		return if own > 0 and v <= 0 then own else v
	end
	local gx, gz = x / B - 0.5, y / B - 0.5
	local i, j = math.floor(gx), math.floor(gz)
	local fx, fz = gx - i, gz - j
	local a = h(i, j) + (h(i + 1, j) - h(i, j)) * fx
	local b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * fx
	return a + (b - a) * fz
end

-- the ground or the water surface, whichever is higher
function Ground.surface(x: number, y: number): number
	return math.max(Ground.height(x, y), 0)
end

---------------------------------------------------------------- terrain

local function writeChunk(terrain: Terrain, x0: number, z0: number, x1: number, z1: number)
	local nx, nz = x1 - x0, z1 - z0
	local mats, occ = table.create(nx), table.create(nx)
	for ix = 1, nx do
		local mx, ox = table.create(LAYERS), table.create(LAYERS)
		for iy = 1, LAYERS do
			mx[iy] = table.create(nz, AIR)
			ox[iy] = table.create(nz, 0)
		end
		mats[ix], occ[ix] = mx, ox
	end
	for iz = 1, nz do
		for ix = 1, nx do
			local c = (z0 + iz - 1) * VX + x0 + ix - 1
			local m = readu8(colMat, c)
			local mx, ox = mats[ix], occ[ix]
			if m == 0 then
				-- layers: [-8, -4] and [-4, 0]; the shallows get a sandy floor at -4
				mx[1][iz] = if readu8(colShallow, c) == 1 then MATS[2] else WATER
				ox[1][iz] = 1
				mx[2][iz] = WATER
				ox[2][iz] = 1
			else
				local mat = MATS[m]
				for iy = 1, 3 do
					mx[iy][iz] = mat
					ox[iy][iz] = 1
				end
				local rise = readu8(colRise, c)
				for k = 1, rise do
					local iy = 3 + k
					local snowy = m == 4 or (k >= 3 and k == rise)
					mx[iy][iz] = if snowy then MATS[4] else MATS[3]
					ox[iy][iz] = if k == rise then 0.6 else 1
				end
			end
		end
	end
	local region = Region3.new(Vector3.new(x0 * VOX, Y0, z0 * VOX), Vector3.new(x1 * VOX, Y0 + LAYERS * VOX, z1 * VOX))
	terrain:WriteVoxels(region, VOX, mats, occ)
end

local function buildTerrain()
	local terrain = workspace.Terrain
	pcall(function()
		terrain:SetMaterialColor(Enum.Material.Grass, Color3.fromRGB(118, 158, 78))
		terrain:SetMaterialColor(Enum.Material.LeafyGrass, Color3.fromRGB(84, 126, 62))
		terrain:SetMaterialColor(Enum.Material.Sand, Color3.fromRGB(226, 208, 152))
		terrain:SetMaterialColor(Enum.Material.Rock, Color3.fromRGB(132, 126, 116))
		terrain:SetMaterialColor(Enum.Material.Snow, Color3.fromRGB(240, 244, 248))
		terrain:SetMaterialColor(Enum.Material.Ground, Color3.fromRGB(150, 156, 118))
		terrain.WaterColor = Color3.fromRGB(28, 96, 134)
		terrain.WaterTransparency = 0.6
		terrain.WaterReflectance = 0.45
		terrain.WaterWaveSize = 0.08
		terrain.WaterWaveSpeed = 7
	end)
	-- open sea around the map, so the edges don't end in the void
	pcall(function()
		local margin = 400
		terrain:FillBlock(CFrame.new(W * S / 2, -4, -margin / 2), Vector3.new(W * S + margin * 2, 8, margin), WATER)
		terrain:FillBlock(CFrame.new(W * S / 2, -4, H * S + margin / 2), Vector3.new(W * S + margin * 2, 8, margin), WATER)
		terrain:FillBlock(CFrame.new(-margin / 2, -4, H * S / 2), Vector3.new(margin, 8, H * S), WATER)
		terrain:FillBlock(CFrame.new(W * S + margin / 2, -4, H * S / 2), Vector3.new(margin, 8, H * S), WATER)
	end)
	local step = 64
	for z0 = 0, VZ - 1, step do
		for x0 = 0, VX - 1, step do
			local ok, err = pcall(writeChunk, terrain, x0, z0, math.min(x0 + step, VX), math.min(z0 + step, VZ))
			if not ok then
				warn("[Terra Forge] terrain: " .. tostring(err))
			end
			task.wait()
		end
	end
end

---------------------------------------------------------------- scenery

local function setupLighting()
	pcall(function()
		Lighting.ClockTime = 14.2
		Lighting.GeographicLatitude = 35
		Lighting.Brightness = 2.4
		Lighting.Ambient = Color3.fromRGB(96, 100, 112)
		Lighting.OutdoorAmbient = Color3.fromRGB(142, 146, 158)
		Lighting.EnvironmentDiffuseScale = 0.5
		Lighting.EnvironmentSpecularScale = 0.4
		Lighting.GlobalShadows = true
		Lighting.ShadowSoftness = 0.25
		Lighting.FogEnd = 100000
	end)
	pcall(function()
		local cc = Instance.new("ColorCorrectionEffect")
		cc.Name = "TerraForgeColor"
		cc.Saturation = 0.12
		cc.Contrast = 0.06
		cc.Brightness = 0.02
		cc.Parent = Lighting
		local bloom = Instance.new("BloomEffect")
		bloom.Name = "TerraForgeBloom"
		bloom.Intensity = 0.25
		bloom.Size = 18
		bloom.Threshold = 1.4
		bloom.Parent = Lighting
	end)
end

local function plantTrees()
	local rng = Random.new(99)
	local trees = Instance.new("Folder")
	trees.Name = "Trees"
	local count = 0
	for vz = 0, VZ - 1 do
		for vx = 0, VX - 1 do
			local m = readu8(colMat, vz * VX + vx)
			local chance = if m == 6 then 0.55 elseif m == 5 then 0.06 elseif m == 1 then 0.02 else 0
			if chance > 0 and count < MAX_TREES and rng:NextNumber() < chance then
				local tree = Models.tree(m == 5, rng)
				local x, z = (vx + rng:NextNumber()) * B, (vz + rng:NextNumber()) * B
				tree.CFrame = CFrame.new(x * S, LAND_TOP + tree.Size.Y * 0.36, z * S)
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
	classify()
	setupLighting()
	buildTerrain()
	plantTrees()
	Ground.ready = true
	return true
end

return Ground
