-- Постройка всего мира: площадь, магазины, 8 садов, украшения.
-- Карта строится заново при каждом запуске сервера.

local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Util = require(script.Parent.Util)

local World = {}

export type Tile = {
	index: number,
	part: Part,
	top: CFrame, -- верх грядки, сюда ставим растения
	prompt: ProximityPrompt,
}

export type Plot = {
	index: number,
	cframe: CFrame,
	model: Folder,
	plants: Folder,
	extras: Folder,
	tiles: { Tile },
	sign: TextLabel,
	spawn: CFrame,
}

export type Stand = {
	key: string,
	cframe: CFrame,
	counter: Part,
	approach: CFrame,
}

World.plots = {} :: { Plot }
World.stands = {} :: { [string]: Stand }
World.boardRows = {} :: { TextLabel }
World.spawn = CFrame.new(0, 4, 16)

local root: Folder

local SKIN = Color3.fromRGB(255, 214, 170)
local WOOD = Color3.fromRGB(160, 110, 70)
local DARK_WOOD = Color3.fromRGB(110, 75, 50)
local WHITE = Color3.fromRGB(250, 250, 250)

local THEMES = {
	seeds = Color3.fromRGB(90, 195, 100),
	gear = Color3.fromRGB(85, 150, 235),
	sell = Color3.fromRGB(245, 190, 50),
	eggs = Color3.fromRGB(245, 125, 185),
}

local function radial(angleDegrees: number, radius: number): Vector3
	local a = math.rad(angleDegrees)
	return Vector3.new(math.sin(a) * radius, 0, -math.cos(a) * radius)
end

---------------------------------------------------------------------
-- Свет и земля
---------------------------------------------------------------------

local function buildLighting()
	Lighting.ClockTime = 14.5
	Lighting.Brightness = 2.4
	Lighting.Ambient = Color3.fromRGB(125, 115, 135)
	Lighting.OutdoorAmbient = Color3.fromRGB(155, 145, 165)
	Lighting.GlobalShadows = true
	Lighting.EnvironmentDiffuseScale = 0.5
	Lighting.EnvironmentSpecularScale = 0.5

	if not Lighting:FindFirstChildOfClass("Atmosphere") then
		local atmosphere = Instance.new("Atmosphere")
		atmosphere.Density = 0.28
		atmosphere.Offset = 0.15
		atmosphere.Color = Color3.fromRGB(205, 225, 255)
		atmosphere.Decay = Color3.fromRGB(255, 205, 235)
		atmosphere.Glare = 0.2
		atmosphere.Haze = 1.2
		atmosphere.Parent = Lighting
	end
	if not Lighting:FindFirstChildOfClass("BloomEffect") then
		local bloom = Instance.new("BloomEffect")
		bloom.Intensity = 0.5
		bloom.Size = 24
		bloom.Threshold = 1.3
		bloom.Parent = Lighting
	end
	if not Lighting:FindFirstChildOfClass("ColorCorrectionEffect") then
		local color = Instance.new("ColorCorrectionEffect")
		color.Saturation = 0.15
		color.Contrast = 0.05
		color.Parent = Lighting
	end
end

local function buildGround()
	local terrain = workspace:FindFirstChildOfClass("Terrain")
	local ok = false
	if terrain then
		ok = pcall(function()
			terrain:FillBlock(CFrame.new(0, -6, 0), Vector3.new(520, 12, 520), Enum.Material.Grass)
			terrain:SetMaterialColor(Enum.Material.Grass, Color3.fromRGB(105, 190, 70))
		end)
	end
	if not ok then
		Util.part({
			name = "Ground",
			size = Vector3.new(520, 12, 520),
			cframe = CFrame.new(0, -6, 0),
			color = Color3.fromRGB(105, 190, 70),
			material = Enum.Material.Grass,
			parent = root,
		})
	end
end

---------------------------------------------------------------------
-- Площадь и точка появления
---------------------------------------------------------------------

local function buildPlaza()
	local plaza = Util.folder("Plaza", root)
	local radius = Config.World.plazaRadius

	Util.part({
		name = "Floor",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(0.6, radius * 2, radius * 2),
		cframe = Util.upright(CFrame.new(0, 0.3, 0)),
		color = Color3.fromRGB(220, 205, 185),
		material = Enum.Material.Cobblestone,
		parent = plaza,
	})
	Util.part({
		name = "Inner",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(0.64, 30, 30),
		cframe = Util.upright(CFrame.new(0, 0.32, 0)),
		color = Color3.fromRGB(245, 225, 230),
		material = Enum.Material.Marble,
		parent = plaza,
	})

	-- фонтан
	Util.part({
		name = "FountainBase",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(1.6, 12, 12),
		cframe = Util.upright(CFrame.new(0, 0.8, 0)),
		color = Color3.fromRGB(235, 235, 245),
		material = Enum.Material.Marble,
		parent = plaza,
	})
	Util.part({
		name = "FountainWater",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(0.2, 10.6, 10.6),
		cframe = Util.upright(CFrame.new(0, 1.62, 0)),
		color = Color3.fromRGB(90, 175, 255),
		material = Enum.Material.Glass,
		transparency = 0.25,
		decor = true,
		parent = plaza,
	})
	Util.part({
		name = "FountainColumn",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(4, 1.6, 1.6),
		cframe = Util.upright(CFrame.new(0, 3.6, 0)),
		color = Color3.fromRGB(245, 190, 215),
		material = Enum.Material.Marble,
		parent = plaza,
	})
	local bowl = Util.part({
		name = "FountainBowl",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(0.7, 5, 5),
		cframe = Util.upright(CFrame.new(0, 5.9, 0)),
		color = Color3.fromRGB(235, 235, 245),
		material = Enum.Material.Marble,
		parent = plaza,
	})
	local spout = Instance.new("Attachment")
	spout.Name = "Spout"
	spout.Position = Vector3.new(0.6, 0, 0)
	spout.Parent = bowl
	local water = Instance.new("ParticleEmitter")
	water.Color = ColorSequence.new(Color3.fromRGB(150, 210, 255))
	water.LightEmission = 0.3
	water.Size = NumberSequence.new(0.45, 0.1)
	water.Transparency = NumberSequence.new(0.2, 1)
	water.Lifetime = NumberRange.new(1, 1.4)
	water.Rate = 35
	water.Speed = NumberRange.new(9, 12)
	water.SpreadAngle = Vector2.new(18, 18)
	water.Acceleration = Vector3.new(0, -25, 0)
	water.EmissionDirection = Enum.NormalId.Right -- ось цилиндра повёрнута вверх
	water.Parent = spout

	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Spawn"
	spawn.Anchored = true
	spawn.Size = Vector3.new(8, 0.4, 8)
	spawn.CFrame = CFrame.new(0, 0.75, 16)
	spawn.Color = Color3.fromRGB(255, 160, 210)
	spawn.Material = Enum.Material.SmoothPlastic
	spawn.Transparency = 0.4
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.TopSurface = Enum.SurfaceType.Smooth
	spawn.Parent = plaza
	World.spawn = CFrame.new(0, 4, 16)
end

---------------------------------------------------------------------
-- Магазины
---------------------------------------------------------------------

local function npc(parent: Instance, base: CFrame, shirt: Color3)
	local function piece(size: Vector3, offset: Vector3, color: Color3, decor: boolean?)
		Util.part({
			name = "NPC",
			size = size,
			cframe = base * CFrame.new(offset),
			color = color,
			decor = decor,
			parent = parent,
		})
	end
	piece(Vector3.new(0.9, 2, 0.9), Vector3.new(-0.5, 1.4, 0), Color3.fromRGB(60, 70, 120))
	piece(Vector3.new(0.9, 2, 0.9), Vector3.new(0.5, 1.4, 0), Color3.fromRGB(60, 70, 120))
	piece(Vector3.new(2.2, 2.2, 1.1), Vector3.new(0, 3.5, 0), shirt)
	piece(Vector3.new(0.8, 2, 0.8), Vector3.new(-1.55, 3.5, 0), SKIN)
	piece(Vector3.new(0.8, 2, 0.8), Vector3.new(1.55, 3.5, 0), SKIN)
	piece(Vector3.new(1.5, 1.5, 1.5), Vector3.new(0, 5.4, 0), SKIN)
	piece(Vector3.new(1.8, 0.5, 1.8), Vector3.new(0, 6.35, 0), shirt:Lerp(Color3.new(0, 0, 0), 0.25))
	-- глаза смотрят вперёд (к площади, это -Z)
	piece(Vector3.new(0.25, 0.3, 0.1), Vector3.new(-0.32, 5.55, -0.78), Color3.fromRGB(30, 30, 40), true)
	piece(Vector3.new(0.25, 0.3, 0.1), Vector3.new(0.32, 5.55, -0.78), Color3.fromRGB(30, 30, 40), true)
	piece(Vector3.new(0.7, 0.12, 0.1), Vector3.new(0, 5.05, -0.78), Color3.fromRGB(200, 90, 100), true)
end

local function egg(parent: Instance, cframe: CFrame, color: Color3)
	local part = Util.part({
		name = "Egg",
		size = Vector3.new(1.2, 1.2, 1.2),
		cframe = cframe,
		color = color,
		decor = true,
		parent = parent,
	})
	local mesh = Instance.new("SpecialMesh")
	mesh.MeshType = Enum.MeshType.Sphere
	mesh.Scale = Vector3.new(1, 1.35, 1)
	mesh.Parent = part
end

local function buildStand(key: string, angle: number)
	local theme = THEMES[key]
	local folder = Util.folder("Stand_" .. key, root)
	local pos = radial(angle, Config.World.standRadius)
	local cf = CFrame.lookAt(pos, Vector3.new(0, 0, 0))
	local function at(x: number, y: number, z: number): CFrame
		return cf * CFrame.new(x, y, z)
	end

	Util.part({ name = "Floor", size = Vector3.new(14, 0.4, 9), cframe = at(0, 0.5, 2.5), color = Color3.fromRGB(175, 125, 85), material = Enum.Material.WoodPlanks, parent = folder })
	local counter = Util.part({ name = "Counter", size = Vector3.new(12, 3, 2), cframe = at(0, 2.1, 0), color = WOOD, material = Enum.Material.Wood, parent = folder })
	Util.part({ name = "CounterTop", size = Vector3.new(12.6, 0.4, 2.6), cframe = at(0, 3.8, 0), color = theme, parent = folder })
	for _, x in ipairs({ -6.5, 6.5 }) do
		for _, z in ipairs({ -1.2, 6.2 }) do
			Util.part({ name = "Post", size = Vector3.new(0.8, 9, 0.8), cframe = at(x, 5, z), color = DARK_WOOD, material = Enum.Material.Wood, parent = folder })
		end
	end
	for i = 1, 6 do
		local x = -7.3 + (i - 0.5) * (14.6 / 6)
		Util.part({
			name = "Awning",
			size = Vector3.new(14.6 / 6, 0.5, 9.6),
			cframe = at(x, 9.7, 2.5),
			color = (i % 2 == 0) and WHITE or theme,
			parent = folder,
		})
	end
	Util.part({ name = "Skirt", size = Vector3.new(14.6, 1.2, 0.3), cframe = at(0, 9, -2.3), color = theme, parent = folder })
	Util.part({ name = "Back", size = Vector3.new(14, 8.8, 0.6), cframe = at(0, 4.9, 6.5), color = theme:Lerp(WHITE, 0.55), parent = folder })

	npc(folder, at(0, 0.7, 3.4), theme)

	-- товары на прилавке
	if key == "seeds" then
		local colors = { Color3.fromRGB(255, 120, 60), Color3.fromRGB(230, 50, 70), Color3.fromRGB(80, 100, 230), Color3.fromRGB(250, 210, 60), Color3.fromRGB(255, 100, 200) }
		for i, color in ipairs(colors) do
			Util.part({ name = "SeedBag", size = Vector3.new(0.9, 1.2, 0.5), cframe = at(-4 + (i - 1) * 2, 4.6, -0.2), color = color, decor = true, parent = folder })
		end
	elseif key == "sell" then
		for _, x in ipairs({ -3.5, 3.5 }) do
			Util.part({ name = "Crate", size = Vector3.new(1.8, 1.2, 1.6), cframe = at(x, 4.6, 0), color = Color3.fromRGB(190, 140, 90), material = Enum.Material.WoodPlanks, decor = true, parent = folder })
			for j = 1, 3 do
				Util.part({
					name = "Fruit",
					shape = Enum.PartType.Ball,
					size = Vector3.new(0.7, 0.7, 0.7),
					cframe = at(x - 0.5 + (j - 1) * 0.5, 5.4, 0),
					color = ({ Color3.fromRGB(235, 40, 60), Color3.fromRGB(255, 175, 40), Color3.fromRGB(70, 90, 225) })[j],
					decor = true,
					parent = folder,
				})
			end
		end
		Util.part({ name = "Coins", shape = Enum.PartType.Cylinder, size = Vector3.new(0.3, 1.4, 1.4), cframe = Util.upright(at(0, 4.15, 0)), color = Color3.fromRGB(255, 205, 60), material = Enum.Material.Foil, decor = true, parent = folder })
	elseif key == "eggs" then
		for i, eggDef in ipairs(Config.Eggs) do
			egg(folder, at(-3 + (i - 1) * 3, 4.75, 0), eggDef.color)
		end
	elseif key == "gear" then
		Util.part({ name = "Can", shape = Enum.PartType.Cylinder, size = Vector3.new(1.4, 1.2, 1.2), cframe = Util.upright(at(-3, 4.7, 0)), color = Color3.fromRGB(110, 170, 240), material = Enum.Material.Metal, decor = true, parent = folder })
		Util.part({ name = "Spout", size = Vector3.new(0.25, 0.25, 1.4), cframe = at(-3, 5, -0.9) * CFrame.Angles(math.rad(30), 0, 0), color = Color3.fromRGB(110, 170, 240), material = Enum.Material.Metal, decor = true, parent = folder })
		Util.part({ name = "Magnet", size = Vector3.new(1.6, 0.5, 0.5), cframe = at(2.5, 4.3, 0), color = Color3.fromRGB(220, 50, 50), decor = true, parent = folder })
		Util.part({ name = "Basket", size = Vector3.new(1.6, 0.9, 1.2), cframe = at(0, 4.45, 0), color = Color3.fromRGB(200, 150, 80), material = Enum.Material.Fabric, decor = true, parent = folder })
	end

	local signAnchor = Util.part({ name = "SignAnchor", size = Vector3.new(1, 1, 1), cframe = at(0, 12.4, 2.5), color = WHITE, transparency = 1, decor = true, parent = folder })
	Util.sign(signAnchor, "sign_" .. key, nil, theme:Lerp(WHITE, 0.2), 13, 3.2)

	local attachment = Instance.new("Attachment")
	attachment.Name = "PromptPoint"
	attachment.Position = Vector3.new(0, 1.2, -1.2)
	attachment.Parent = counter
	if key == "sell" then
		Util.prompt({ kind = "sell", action = "pr_sell", object = "obj_sell", distance = 13, parent = attachment })
	else
		Util.prompt({ kind = "open", action = "pr_open", object = "obj_" .. key, distance = 13, attributes = { Panel = key }, parent = attachment })
	end

	World.stands[key] = {
		key = key,
		cframe = cf,
		counter = counter,
		approach = at(0, 3, -6.5) * CFrame.Angles(0, math.pi, 0),
	}
end

---------------------------------------------------------------------
-- Сады
---------------------------------------------------------------------

local function buildPlot(index: number)
	local w = Config.World
	local angle = 22.5 + 45 * (index - 1)
	local pos = radial(angle, w.plotRadius)
	local cf = CFrame.lookAt(pos, Vector3.new(0, 0, 0))
	local half = w.plotHalf
	local function at(x: number, y: number, z: number): CFrame
		return cf * CFrame.new(x, y, z)
	end

	local model = Util.folder("Plot" .. index, root)
	model:SetAttribute("Plot", index)
	model:SetAttribute("OwnerId", 0)

	Util.part({ name = "Base", size = Vector3.new(half * 2, 0.3, half * 2), cframe = at(0, 0.15, 0), color = Color3.fromRGB(120, 200, 85), material = Enum.Material.Grass, parent = model })

	local hedge = Color3.fromRGB(55, 140, 60)
	local length = half * 2 + 1
	Util.part({ name = "Hedge", size = Vector3.new(length, 3, 1.4), cframe = at(0, 1.5, half + 0.3), color = hedge, material = Enum.Material.Grass, parent = model })
	Util.part({ name = "Hedge", size = Vector3.new(1.4, 3, length), cframe = at(-half - 0.3, 1.5, 0), color = hedge, material = Enum.Material.Grass, parent = model })
	Util.part({ name = "Hedge", size = Vector3.new(1.4, 3, length), cframe = at(half + 0.3, 1.5, 0), color = hedge, material = Enum.Material.Grass, parent = model })
	local gap = 10
	local segment = (length - gap) / 2
	for _, side in ipairs({ -1, 1 }) do
		Util.part({ name = "Hedge", size = Vector3.new(segment, 3, 1.4), cframe = at(side * (gap / 2 + segment / 2), 1.5, -half - 0.3), color = hedge, material = Enum.Material.Grass, parent = model })
	end

	-- ворота с табличкой
	for _, side in ipairs({ -1, 1 }) do
		Util.part({ name = "GatePost", size = Vector3.new(1, 7.5, 1), cframe = at(side * 5.6, 3.75, -half - 0.3), color = Color3.fromRGB(185, 135, 95), material = Enum.Material.WoodPlanks, parent = model })
	end
	local beam = Util.part({ name = "GateBeam", size = Vector3.new(12.4, 1.2, 1.2), cframe = at(0, 7.8, -half - 0.3), color = Color3.fromRGB(255, 150, 200), parent = model })
	local sign = Util.sign(beam, "plot_free", nil, Color3.fromRGB(255, 240, 250), 16, 2.6, Vector3.new(0, 2, 0))

	local plants = Util.folder("Plants", model)
	local extras = Util.folder("Extras", model)
	local tileFolder = Util.folder("Tiles", model)

	local tiles = {}
	local grid = w.tileGrid
	local start = -(grid - 1) / 2 * w.tileSpacing
	for t = 1, grid * grid do
		local row = math.floor((t - 1) / grid)
		local col = (t - 1) % grid
		local x = start + col * w.tileSpacing
		local z = start + row * w.tileSpacing
		local part = Util.part({
			name = "Tile" .. t,
			size = Vector3.new(w.tileSize, 0.5, w.tileSize),
			cframe = at(x, 0.45, z),
			color = Color3.fromRGB(95, 160, 80),
			material = Enum.Material.Grass,
			parent = tileFolder,
		})
		part:SetAttribute("Plot", index)
		part:SetAttribute("Tile", t)
		part:SetAttribute("Locked", true)
		part:SetAttribute("Seed", "")
		part:SetAttribute("Fruits", 0)
		part:SetAttribute("ReadyAt", 0)

		local attachment = Instance.new("Attachment")
		attachment.Name = "PromptPoint"
		attachment.Position = Vector3.new(0, 1.6, 0)
		attachment.Parent = part
		local prompt = Util.prompt({
			kind = "tile",
			action = "pr_plant",
			distance = 6,
			enabled = false,
			attributes = { Tile = t, Plot = index },
			parent = attachment,
		})

		tiles[t] = {
			index = t,
			part = part,
			top = at(x, 0.7, z),
			prompt = prompt,
		}
	end

	World.plots[index] = {
		index = index,
		cframe = cf,
		model = model,
		plants = plants,
		extras = extras,
		tiles = tiles,
		sign = sign,
		spawn = at(0, 3, -half + 4) * CFrame.Angles(0, math.pi, 0),
	}

	-- дорожка от площади до ворот
	local inner = w.plazaRadius - 1
	local outer = w.plotRadius - half - 1
	local mid = radial(angle, (inner + outer) / 2)
	Util.part({
		name = "Path",
		size = Vector3.new(8, 0.24, outer - inner),
		cframe = CFrame.lookAt(mid + Vector3.new(0, 0.12, 0), Vector3.new(0, 0.12, 0)),
		color = Color3.fromRGB(215, 195, 160),
		material = Enum.Material.Pebble,
		parent = root,
	})
end

---------------------------------------------------------------------
-- Украшения
---------------------------------------------------------------------

local LEAVES = {
	Color3.fromRGB(70, 165, 70),
	Color3.fromRGB(85, 180, 80),
	Color3.fromRGB(255, 175, 210),
	Color3.fromRGB(60, 150, 75),
}

local function tree(parent: Instance, position: Vector3, scale: number, leaf: Color3)
	local height = 7 * scale
	Util.part({
		name = "Trunk",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(height, 1.4 * scale, 1.4 * scale),
		cframe = Util.upright(CFrame.new(position + Vector3.new(0, height / 2, 0))),
		color = Color3.fromRGB(120, 85, 55),
		material = Enum.Material.Wood,
		parent = parent,
	})
	local top = position + Vector3.new(0, height, 0)
	for i, offset in ipairs({ Vector3.new(0, 1.5, 0), Vector3.new(1.8, 0, 0.6), Vector3.new(-1.6, 0.3, -0.8) }) do
		local size = (i == 1 and 6.5 or 4.5) * scale
		Util.part({
			name = "Leaves",
			shape = Enum.PartType.Ball,
			size = Vector3.new(size, size, size),
			cframe = CFrame.new(top + offset * scale),
			color = leaf,
			material = Enum.Material.Grass,
			decor = true,
			parent = parent,
		})
	end
end

local function lollipop(parent: Instance, position: Vector3, color: Color3)
	Util.part({
		name = "Stick",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(9, 0.6, 0.6),
		cframe = Util.upright(CFrame.new(position + Vector3.new(0, 4.5, 0))),
		color = WHITE,
		parent = parent,
	})
	local face = CFrame.lookAt(position + Vector3.new(0, 10.5, 0), Vector3.new(0, 10.5, 0)) * CFrame.Angles(0, math.rad(90), 0)
	Util.part({ name = "Candy", shape = Enum.PartType.Cylinder, size = Vector3.new(0.8, 6, 6), cframe = face, color = color, material = Enum.Material.Neon, decor = true, parent = parent })
	Util.part({ name = "Candy", shape = Enum.PartType.Cylinder, size = Vector3.new(0.9, 3.2, 3.2), cframe = face, color = WHITE, decor = true, parent = parent })
end

local function buildDecor()
	local decor = Util.folder("Decor", root)
	local rng = Random.new(42)
	-- деревья между садами
	for k = 0, 7 do
		local position = radial(45 * k, Config.World.plotRadius + 6)
		tree(decor, position, 1.15, LEAVES[(k % #LEAVES) + 1])
	end
	-- лес по краю карты
	for k = 0, 23 do
		local position = radial(15 * k + rng:NextNumber(-4, 4), 195 + rng:NextNumber(-8, 8))
		tree(decor, position, rng:NextNumber(1.1, 1.6), LEAVES[rng:NextInteger(1, #LEAVES)])
	end
	-- цветы вокруг площади
	local petals = { Color3.fromRGB(255, 90, 140), Color3.fromRGB(255, 220, 70), Color3.fromRGB(170, 120, 255), Color3.fromRGB(255, 255, 255), Color3.fromRGB(255, 140, 60) }
	for k = 0, 35 do
		local angle = 10 * k + 5
		local inPath = false
		for i = 0, 7 do
			local diff = math.abs(((angle - (22.5 + 45 * i)) + 180) % 360 - 180)
			if diff < 7 then
				inPath = true
			end
		end
		if not inPath then
			local base = radial(angle, Config.World.plazaRadius + 2.5)
			Util.part({ name = "Stem", size = Vector3.new(0.2, 1.2, 0.2), cframe = CFrame.new(base + Vector3.new(0, 0.6, 0)), color = Color3.fromRGB(70, 160, 60), decor = true, parent = decor })
			Util.part({ name = "Flower", shape = Enum.PartType.Ball, size = Vector3.new(0.8, 0.8, 0.8), cframe = CFrame.new(base + Vector3.new(0, 1.35, 0)), color = petals[(k % #petals) + 1], decor = true, parent = decor })
		end
	end
	-- большие леденцы на площади
	lollipop(decor, radial(135, 34), Color3.fromRGB(255, 90, 170))
	lollipop(decor, radial(315, 34), Color3.fromRGB(110, 200, 255))

	-- невидимые стены по краю карты
	local edge = 228
	for _, wall in ipairs({
		{ Vector3.new(edge, 40, 0), Vector3.new(2, 80, edge * 2) },
		{ Vector3.new(-edge, 40, 0), Vector3.new(2, 80, edge * 2) },
		{ Vector3.new(0, 40, edge), Vector3.new(edge * 2, 80, 2) },
		{ Vector3.new(0, 40, -edge), Vector3.new(edge * 2, 80, 2) },
	}) do
		Util.part({ name = "Wall", size = wall[2], cframe = CFrame.new(wall[1]), color = WHITE, transparency = 1, parent = decor })
	end
end

---------------------------------------------------------------------
-- Доски: лидеры и «как играть»
---------------------------------------------------------------------

local function board(angle: number): (Part, SurfaceGui)
	local folder = Util.folder("Board", root)
	local pos = radial(angle, Config.World.plazaRadius - 9)
	local cf = CFrame.lookAt(pos + Vector3.new(0, 6, 0), Vector3.new(0, 6, 0))
	local panel = Util.part({ name = "Panel", size = Vector3.new(11, 9, 0.6), cframe = cf, color = Color3.fromRGB(95, 65, 45), material = Enum.Material.Wood, parent = folder })
	for _, x in ipairs({ -4.8, 4.8 }) do
		Util.part({ name = "Leg", size = Vector3.new(0.6, 6.5, 0.6), cframe = cf * CFrame.new(x, -4.5, 0.4), color = DARK_WOOD, material = Enum.Material.Wood, parent = folder })
	end
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 40
	gui.LightInfluence = 0
	gui.Parent = panel
	return panel, gui
end

local function boardTitle(gui: SurfaceGui, key: string)
	local title = Instance.new("TextLabel")
	title.Name = "Title"
	title.BackgroundTransparency = 1
	title.Size = UDim2.new(1, -20, 0.16, 0)
	title.Position = UDim2.new(0, 10, 0, 8)
	title.Font = Enum.Font.FredokaOne
	title.TextScaled = true
	title.TextColor3 = Color3.fromRGB(255, 220, 90)
	title.Text = key
	title.Parent = gui
	Util.localize(title, key)
end

local function buildBoards()
	local _, leaders = board(45)
	boardTitle(leaders, "lb_title")
	local list = Instance.new("Frame")
	list.BackgroundTransparency = 1
	list.Size = UDim2.new(1, -30, 0.78, 0)
	list.Position = UDim2.new(0, 15, 0.2, 0)
	list.Parent = leaders
	local layout = Instance.new("UIListLayout")
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Parent = list
	for i = 1, 10 do
		local row = Instance.new("TextLabel")
		row.Name = "Row" .. i
		row.LayoutOrder = i
		row.BackgroundTransparency = 1
		row.Size = UDim2.new(1, 0, 0.1, 0)
		row.Font = Enum.Font.FredokaOne
		row.TextScaled = true
		row.TextXAlignment = Enum.TextXAlignment.Left
		row.TextColor3 = i <= 3 and Color3.fromRGB(255, 235, 170) or Color3.fromRGB(245, 235, 225)
		row.Text = i == 1 and "..." or ""
		row.Parent = list
		World.boardRows[i] = row
	end

	local _, howto = board(225)
	boardTitle(howto, "howto_title")
	local body = Instance.new("TextLabel")
	body.BackgroundTransparency = 1
	body.Size = UDim2.new(1, -30, 0.76, 0)
	body.Position = UDim2.new(0, 15, 0.21, 0)
	body.Font = Enum.Font.FredokaOne
	body.TextScaled = true
	body.TextXAlignment = Enum.TextXAlignment.Left
	body.TextYAlignment = Enum.TextYAlignment.Top
	body.TextColor3 = Color3.fromRGB(245, 235, 225)
	body.Text = "howto_text"
	body.Parent = howto
	Util.localize(body, "howto_text")
end

---------------------------------------------------------------------

function World.build()
	for _, name in ipairs({ "SweetGarden", "StudioPreview" }) do
		local old = workspace:FindFirstChild(name)
		if old then
			old:Destroy()
		end
	end
	root = Util.folder("SweetGarden", workspace)

	Util.try("lighting", buildLighting)
	buildGround()
	buildPlaza()
	for key, angle in pairs(Config.World.stands) do
		buildStand(key, angle)
	end
	for index = 1, Config.MaxPlots do
		buildPlot(index)
	end
	Util.try("decor", buildDecor)
	Util.try("boards", buildBoards)
end

return World
