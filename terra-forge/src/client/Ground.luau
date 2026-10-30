-- The 3D ground: a height field built from the world map. The map is cut into chunks; each
-- chunk is an EditableMesh textured with its own EditableImage, which holds the terrain
-- colours with territory and fog of war painted over them. Oceans are Roblox terrain water
-- at height 0 above the sunken sea floor of the mesh. One map tile is one stud.
local AssetService = game:GetService("AssetService")
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Map = require(Shared.Map)
local Models = require(script.Parent.Models)

local W, H, N = Map.W, Map.H, Map.N
local readu8, writeu8 = buffer.readu8, buffer.writeu8
local readf32, writef32 = buffer.readf32, buffer.writef32

local Ground = {}
Ground.ok = false -- textures work
Ground.flat = false -- meshes failed: the map lies on flat plates instead
Ground.ready = false -- all chunks are built
Ground.onFlat = nil :: (() -> ())?
Ground.images = {} -- chunk index (from 0) -> EditableImage
Ground.CX, Ground.CY = 4, 2

local P = 2 -- texture pixels per tile
local G = 2 -- tiles per mesh cell
local CX, CY = Ground.CX, Ground.CY
local CW, CH = W // CX, H // CY -- tiles per chunk
local PW, PH = CW * P, CH * P -- chunk texture size
local VW, VH = W // G + 1, H // G + 1 -- height grid
local FLAT_Y = 0.12
local MAX_TREES = 1800
local FOG_R, FOG_G, FOG_B = 14, 20, 34

local biome, coast, wdist, dep = Map.biomeBuf, Map.coastBuf, Map.wdistBuf, Map.depBuf
local tileH = buffer.create(N * 4)
local vertH = buffer.create(VW * VH * 4)
local base = {} -- chunk -> terrain pixels, RGBA
local px = {} -- chunk -> pixels on screen: terrain, territory and fog
local dirty = {} -- chunk -> { x0, y0, x1, y1 } in pixels
local meshes = {} -- keeps the EditableMeshes alive
local folder = nil
local trees = nil

---------------------------------------------------------------- helpers

local function lerp(a: number, b: number, k: number): number
	return a + (b - a) * k
end

local function smooth(a: number, b: number, v: number): number
	local k = math.clamp((v - a) / (b - a), 0, 1)
	return k * k * (3 - 2 * k)
end

-- smooth noise in about 0..1
local function noise(x: number, y: number, scale: number, seed: number): number
	return math.clamp(math.noise(x / scale + 0.37, y / scale + 0.71, seed + 0.13) * 1.25 + 0.5, 0, 1)
end

local function u8(v: number): number
	return math.clamp(math.floor(v + 0.5), 0, 255)
end

---------------------------------------------------------------- heights

local function computeHeights()
	for t = 0, N - 1 do
		local x, y = t % W, t // W
		local bi = readu8(biome, t)
		local h
		if bi == 0 then
			h = -(0.25 + 1.3 * smooth(1, 8, math.min(readu8(wdist, t), 9)))
		elseif bi == 3 then
			local r = noise(x, y, 7, 21)
			h = 1.1 + 4.4 * r * r + 0.9 * noise(x, y, 2.5, 22)
		elseif bi == 4 then
			h = 0.7 + 1.5 * noise(x, y, 16, 23)
		elseif bi == 2 then
			h = 0.3 + 0.22 * noise(x, y, 14, 24) + 0.16 * noise(x, y, 3, 25)
		else
			local k = noise(x, y, 13, 26)
			h = 0.3 + 0.6 * k * k + 0.08 * noise(x, y, 3, 27)
		end
		if bi ~= 0 and readu8(coast, t) == 1 then
			h = 0.3 + (h - 0.3) * 0.3
		end
		writef32(tileH, t * 4, h)
	end
	-- each grid point averages the 4 x 4 tiles around it, weighted towards the middle
	local kw = { 1, 3, 3, 1 }
	for j = 0, VH - 1 do
		for i = 0, VW - 1 do
			local cx, cz = i * G, j * G
			local sum, wsum = 0, 0
			for b = 0, 3 do
				local ty = cz - 2 + b
				if ty >= 0 and ty < H then
					for a = 0, 3 do
						local tx = cx - 2 + a
						if tx >= 0 and tx < W then
							local w = kw[a + 1] * kw[b + 1]
							sum += readf32(tileH, (ty * W + tx) * 4) * w
							wsum += w
						end
					end
				end
			end
			writef32(vertH, (j * VW + i) * 4, sum / wsum)
		end
	end
end

local function vertexHeight(i: number, j: number): number
	i = math.clamp(i, 0, VW - 1)
	j = math.clamp(j, 0, VH - 1)
	return readf32(vertH, (j * VW + i) * 4)
end

-- height of the ground surface at a map position (tiles, fractional)
function Ground.height(x: number, y: number): number
	if Ground.flat then
		return FLAT_Y
	end
	local gx = math.clamp(x / G, 0, VW - 1.001)
	local gz = math.clamp(y / G, 0, VH - 1.001)
	local i, j = math.floor(gx), math.floor(gz)
	local fx, fz = gx - i, gz - j
	local o = (j * VW + i) * 4
	local row = VW * 4
	local h00, h10 = readf32(vertH, o), readf32(vertH, o + 4)
	local h01, h11 = readf32(vertH, o + row), readf32(vertH, o + row + 4)
	return (h00 + (h10 - h00) * fx) * (1 - fz) + (h01 + (h11 - h01) * fx) * fz
end

-- the ground or the water surface, whichever is higher
function Ground.surface(x: number, y: number): number
	return math.max(Ground.height(x, y), 0)
end

---------------------------------------------------------------- terrain colours

local function terrainColor(t: number, x: number, y: number): (number, number, number)
	local bi = readu8(biome, t)
	local r, g, b
	if bi == 0 then
		-- sea floor, seen through the water: turquoise shallows, dark deep sea
		local k = smooth(0, 1, math.min(readu8(wdist, t), 7) / 7)
		local n = noise(x, y, 26, 3) - 0.5
		r, g, b = lerp(84, 24, k) + n * 8, lerp(170, 72, k) + n * 10, lerp(168, 116, k) + n * 10
	elseif bi == 1 then
		local f = noise(x, y, 10, 5) + (noise(x, y, 3, 6) - 0.5) * 0.4
		local m = smooth(0.48, 0.66, f)
		r, g, b = lerp(152, 96, m), lerp(196, 148, m), lerp(100, 72, m)
		if readu8(coast, t) == 1 and noise(x, y, 5, 8) > 0.55 then
			r, g, b = 228, 212, 160
		end
	elseif bi == 2 then
		local n = noise(x, y, 5, 11) - 0.5
		r, g, b = 232 + n * 16, 206 + n * 14, 148 + n * 10
	elseif bi == 3 then
		local h = readf32(tileH, t * 4)
		if h > 4.3 then
			r, g, b = 238, 240, 244
		else
			local k = smooth(1.2, 4.3, h)
			r, g, b = lerp(124, 172, k), lerp(130, 160, k), lerp(96, 146, k)
		end
	elseif bi == 4 then
		local n = noise(x, y, 7, 13) - 0.5
		r, g, b = 236 + n * 10, 242 + n * 6, 248
	else
		local m = noise(x, y, 6, 14)
		r, g, b = lerp(184, 148, m), lerp(198, 174, m), lerp(168, 140, m)
	end
	local d = readu8(dep, t)
	if d ~= 0 then
		local alt = (x * 7 + y * 13) % 3 == 0
		if d == 1 then
			r, g, b = if alt then 200 else 166, if alt then 118 else 92, if alt then 78 else 64
		elseif d == 2 then
			r, g, b = if alt then 86 else 60, if alt then 88 else 62, if alt then 96 else 70
		else
			r, g, b = if alt then 48 else 32, if alt then 46 else 32, if alt then 60 else 40
		end
	end
	if bi ~= 0 then
		-- light from the north-west: slopes facing it are a little brighter
		local h = readf32(tileH, t * 4)
		local hl = if x > 0 then readf32(tileH, (t - 1) * 4) else h
		local hr = if x < W - 1 then readf32(tileH, (t + 1) * 4) else h
		local hu = if y > 0 then readf32(tileH, (t - W) * 4) else h
		local hd = if y < H - 1 then readf32(tileH, (t + W) * 4) else h
		local s = math.clamp(1 + ((hr - hl) + (hd - hu)) * 0.09, 0.84, 1.16)
		r, g, b = r * s, g * s, b * s
	end
	return r, g, b
end

local function buildBase()
	local jitter = table.create(1024)
	local rng = Random.new(7)
	for i = 1, 1024 do
		jitter[i] = (rng:NextNumber() * 2 - 1) * 7
	end
	for c = 0, CX * CY - 1 do
		base[c] = buffer.create(PW * PH * 4)
	end
	for y = 0, H - 1 do
		for x = 0, W - 1 do
			local t = y * W + x
			local r, g, b = terrainColor(t, x, y)
			local buf = base[(y // CH) * CX + x // CW]
			local o0 = ((y % CH) * P * PW + (x % CW) * P) * 4
			for sy = 0, P - 1 do
				for sx = 0, P - 1 do
					local j = jitter[((x * P + sx) * 37 + (y * P + sy) * 101) % 1024 + 1]
					local o = o0 + (sy * PW + sx) * 4
					writeu8(buf, o, u8(r + j))
					writeu8(buf, o + 1, u8(g + j))
					writeu8(buf, o + 2, u8(b + j * 0.8))
					writeu8(buf, o + 3, 255)
				end
			end
		end
		if y % 48 == 47 then
			task.wait()
		end
	end
end

---------------------------------------------------------------- painting

local function markDirty(c: number, x0: number, y0: number, x1: number, y1: number)
	local d = dirty[c]
	if not d then
		dirty[c] = { x0, y0, x1, y1 }
	else
		d[1] = math.min(d[1], x0)
		d[2] = math.min(d[2], y0)
		d[3] = math.max(d[3], x1)
		d[4] = math.max(d[4], y1)
	end
end

local function mix(src: buffer, dst: buffer, o: number, col, a: number, k: number)
	local r, g, b = readu8(src, o), readu8(src, o + 1), readu8(src, o + 2)
	if col and a > 0 then
		r += (col[1] - r) * a
		g += (col[2] - g) * a
		b += (col[3] - b) * a
	end
	if k < 1 then
		r = FOG_R + (r - FOG_R) * k
		g = FOG_G + (g - FOG_G) * k
		b = FOG_B + (b - FOG_B) * k
	end
	writeu8(dst, o, r // 1)
	writeu8(dst, o + 1, g // 1)
	writeu8(dst, o + 2, b // 1)
end

-- paints one tile: nation colour col over the terrain (a = opacity inside, ba = on the border),
-- mask = sides that border another owner (1 left, 2 right, 4 top, 8 bottom),
-- k = light left by the fog (1 = no fog). col = nil leaves the bare terrain.
function Ground.paintTile(t: number, col, bcol, a: number, ba: number, mask: number, k: number)
	local x, y = t % W, t // W
	local c = (y // CH) * CX + x // CW
	local src, dst = base[c], px[c]
	if not dst then
		return
	end
	local lx, ly = (x % CW) * P, (y % CH) * P
	local o = (ly * PW + lx) * 4
	local row = PW * 4
	if col == nil and k >= 1 then
		buffer.copy(dst, o, src, o, 8)
		buffer.copy(dst, o + row, src, o + row, 8)
	else
		local left, right = mask % 2 == 1, mask // 2 % 2 == 1
		local top, bottom = mask // 4 % 2 == 1, mask >= 8
		-- borders are drawn on the half of the tile that faces the neighbour, so they stay thin
		if left or top then
			mix(src, dst, o, bcol, ba, k)
		else
			mix(src, dst, o, col, a, k)
		end
		if right or top then
			mix(src, dst, o + 4, bcol, ba, k)
		else
			mix(src, dst, o + 4, col, a, k)
		end
		if left or bottom then
			mix(src, dst, o + row, bcol, ba, k)
		else
			mix(src, dst, o + row, col, a, k)
		end
		if right or bottom then
			mix(src, dst, o + row + 4, bcol, ba, k)
		else
			mix(src, dst, o + row + 4, col, a, k)
		end
	end
	markDirty(c, lx, ly, lx + 1, ly + 1)
end

-- back to bare terrain everywhere
function Ground.reset()
	for c = 0, CX * CY - 1 do
		if px[c] then
			buffer.copy(px[c], 0, base[c])
			dirty[c] = { 0, 0, PW - 1, PH - 1 }
		end
	end
end

-- sends changed pixels to the textures; call once a frame
function Ground.flush()
	for c, d in dirty do
		dirty[c] = nil
		local img = Ground.images[c]
		if img then
			local x0, y0 = d[1], d[2]
			local w, h = d[3] - x0 + 1, d[4] - y0 + 1
			local ok = pcall(function()
				if w * h * 3 > PW * PH then
					img:WritePixelsBuffer(Vector2.zero, Vector2.new(PW, PH), px[c])
					return
				end
				local sub = buffer.create(w * h * 4)
				for r = 0, h - 1 do
					buffer.copy(sub, r * w * 4, px[c], ((y0 + r) * PW + x0) * 4, w * 4)
				end
				img:WritePixelsBuffer(Vector2.new(x0, y0), Vector2.new(w, h), sub)
			end)
			if not ok then
				Ground.images[c] = nil
			end
		end
	end
end

---------------------------------------------------------------- world objects

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

local function setupWater()
	local terrain = workspace.Terrain
	pcall(function()
		terrain:FillBlock(CFrame.new(W / 2, -2, H / 2), Vector3.new(W + 800, 4, H + 800), Enum.Material.Water)
	end)
	pcall(function()
		terrain.WaterColor = Color3.fromRGB(30, 92, 126)
		terrain.WaterTransparency = 0.55
		terrain.WaterReflectance = 0.5
		terrain.WaterWaveSize = 0.04
		terrain.WaterWaveSpeed = 6
	end)
end

local function plantTrees()
	local rng = Random.new(99)
	trees = Instance.new("Folder")
	trees.Name = "Trees"
	local count = 0
	for y = 1, H - 3, 2 do
		for x = 1, W - 3, 2 do
			local tx, ty = x + rng:NextInteger(0, 1), y + rng:NextInteger(0, 1)
			local t = ty * W + tx
			local bi = readu8(biome, t)
			if (bi == 1 or bi == 5) and readu8(coast, t) == 0 and readu8(dep, t) == 0 then
				local f = noise(tx, ty, 10, 5) + (noise(tx, ty, 3, 6) - 0.5) * 0.4
				local forest = if bi == 5 then f > 0.5 else f > 0.56
				if forest and rng:NextNumber() < 0.4 and count < MAX_TREES then
					local tree = Models.tree(bi == 5, rng)
					local px0, pz0 = tx + rng:NextNumber(), ty + rng:NextNumber()
					tree.CFrame = CFrame.new(px0, Ground.height(px0, pz0) + tree.Size.Y * 0.36, pz0)
					tree.CastShadow = false
					tree.Parent = trees
					count += 1
				end
			end
		end
	end
	trees.Parent = folder
end

local function buildChunk(c: number): MeshPart
	local ci, cj = c % CX, c // CX
	local i0, j0 = ci * CW // G, cj * CH // G
	local nx, nz = CW // G, CH // G
	local mesh = AssetService:CreateEditableMesh()
	meshes[c] = mesh
	local verts, uvs, normals = {}, {}, {}
	local ymin, ymax = math.huge, -math.huge
	local k = 0
	for j = 0, nz do
		for i = 0, nx do
			local gi, gj = i0 + i, j0 + j
			local h = vertexHeight(gi, gj)
			ymin = math.min(ymin, h)
			ymax = math.max(ymax, h)
			k += 1
			verts[k] = mesh:AddVertex(Vector3.new(i * G - CW / 2, h, j * G - CH / 2))
			uvs[k] = mesh:AddUV(Vector2.new((0.5 + (PW - 1) * i / nx) / PW, (0.5 + (PH - 1) * j / nz) / PH))
			local dx = (vertexHeight(gi + 1, gj) - vertexHeight(gi - 1, gj)) / (2 * G)
			local dz = (vertexHeight(gi, gj + 1) - vertexHeight(gi, gj - 1)) / (2 * G)
			normals[k] = mesh:AddNormal(Vector3.new(-dx, 1, -dz).Unit)
		end
		if j % 16 == 15 then
			task.wait()
		end
	end
	-- counter-clockwise seen from above, so the faces point up
	local row = nx + 1
	for j = 0, nz - 1 do
		for i = 0, nx - 1 do
			local a = j * row + i + 1
			local b, d = a + 1, a + row
			local e = d + 1
			local f1 = mesh:AddTriangle(verts[a], verts[d], verts[b])
			mesh:SetFaceUVs(f1, { uvs[a], uvs[d], uvs[b] })
			mesh:SetFaceNormals(f1, { normals[a], normals[d], normals[b] })
			local f2 = mesh:AddTriangle(verts[b], verts[d], verts[e])
			mesh:SetFaceUVs(f2, { uvs[b], uvs[d], uvs[e] })
			mesh:SetFaceNormals(f2, { normals[b], normals[d], normals[e] })
		end
		if j % 10 == 9 then
			task.wait()
		end
	end
	-- a tiny hidden triangle makes the bounds symmetric around height 0, so the part lines up
	-- whether or not the engine centres a mesh on its bounds
	local yc = if ymax >= -ymin then -ymax else -ymin
	local s1 = mesh:AddVertex(Vector3.new(0, yc, 0))
	local s2 = mesh:AddVertex(Vector3.new(0, yc, 0.001))
	local s3 = mesh:AddVertex(Vector3.new(0.001, yc, 0))
	local fs = mesh:AddTriangle(s1, s2, s3)
	mesh:SetFaceUVs(fs, { uvs[1], uvs[1], uvs[1] })
	mesh:SetFaceNormals(fs, { normals[1], normals[1], normals[1] })

	local content = Content.fromObject(mesh)
	local ok, part = pcall(function()
		return AssetService:CreateMeshPartAsync(content, {
			CollisionFidelity = Enum.CollisionFidelity.Box,
			RenderFidelity = Enum.RenderFidelity.Precise,
		})
	end)
	if not ok then
		part = AssetService:CreateMeshPartAsync(content)
	end
	part.Name = "Ground" .. c
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.CastShadow = false
	part.Material = Enum.Material.SmoothPlastic
	part.Color = Color3.new(1, 1, 1)
	part.TextureContent = Content.fromObject(Ground.images[c])
	part.CFrame = CFrame.new(ci * CW + CW / 2, 0, cj * CH + CH / 2)
	part.Parent = folder
	return part
end

-- fallback without meshes: the map texture on flat plates
local function buildFlat()
	Ground.flat = true
	for _, child in folder:GetChildren() do
		if child:IsA("BasePart") then
			child:Destroy()
		end
	end
	if trees then
		trees:Destroy()
		trees = nil
	end
	for c = 0, CX * CY - 1 do
		local ci, cj = c % CX, c // CX
		local plate = Instance.new("Part")
		plate.Name = "Plate" .. c
		plate.Anchored = true
		plate.CanCollide = false
		plate.CanQuery = false
		plate.CanTouch = false
		plate.CastShadow = false
		plate.Size = Vector3.new(CW, 0.2, CH)
		plate.CFrame = CFrame.new(ci * CW + CW / 2, FLAT_Y - 0.1, cj * CH + CH / 2)
		plate.Color = Color3.fromRGB(40, 90, 130)
		plate.Parent = folder
		local sg = Instance.new("SurfaceGui")
		sg.Face = Enum.NormalId.Top
		sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		sg.PixelsPerStud = P
		sg.LightInfluence = 1
		sg.Parent = plate
		local img = Ground.images[c]
		if img then
			local label = Instance.new("ImageLabel")
			label.Size = UDim2.fromScale(1, 1)
			label.BackgroundTransparency = 1
			pcall(function()
				label.ImageContent = Content.fromObject(img)
			end)
			label.Parent = sg
		end
	end
	if Ground.onFlat then
		Ground.onFlat()
	end
end

local function buildMeshes()
	for c = 0, CX * CY - 1 do
		local ok, err = pcall(buildChunk, c)
		if not ok then
			warn("[Terra Forge] ground mesh failed, using flat map: " .. tostring(err))
			buildFlat()
			Ground.ready = true
			return
		end
		task.wait()
	end
	Ground.ready = true
end

---------------------------------------------------------------- setup

function Ground.init(): boolean
	folder = Instance.new("Folder")
	folder.Name = "TerraForgeGround"
	folder.Parent = workspace
	computeHeights()
	buildBase()
	local ok = true
	for c = 0, CX * CY - 1 do
		px[c] = buffer.create(PW * PH * 4)
		buffer.copy(px[c], 0, base[c])
		local made, img = pcall(function()
			return AssetService:CreateEditableImage({ Size = Vector2.new(PW, PH) })
		end)
		if made and img then
			local written = pcall(function()
				img:WritePixelsBuffer(Vector2.zero, Vector2.new(PW, PH), px[c])
			end)
			if written then
				Ground.images[c] = img
			else
				ok = false
			end
		else
			ok = false
		end
	end
	Ground.ok = ok
	setupLighting()
	setupWater()
	if not ok then
		return false
	end
	plantTrees()
	task.spawn(buildMeshes)
	return true
end

return Ground
