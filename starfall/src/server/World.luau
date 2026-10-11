-- Мир: ночное небо, поле звездопада в центре, 8 баз вокруг, доски лидеров и украшения.

local Lighting = game:GetService("Lighting")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Util = require(script.Parent.Util)
local StarVisuals = require(script.Parent.StarVisuals)

local World = {}

export type Pedestal = {
	slot: number,
	part: BasePart,
	cap: BasePart,
	prompt: ProximityPrompt,
	starCFrame: CFrame,
}

export type Base = {
	index: number,
	cframe: CFrame,
	color: Color3,
	model: Model,
	door: BasePart,
	sign: TextLabel,
	pedestals: { Pedestal },
	collectPad: BasePart,
	lockPad: BasePart,
	stars: Folder,
	spawn: CFrame,
	outside: CFrame,
}

World.bases = {} :: { Base }
World.boards = {} :: { [string]: { TextLabel } }
World.map = nil :: Folder?
World.fieldStars = nil :: Folder?
World.markers = nil :: Folder?

World.FIELD_TOP = 0.3
World.FIELD_RADIUS = 75
World.FLOOR_TOP = 0.6

local BASE_RADIUS = 130
local HALF = 22
local WALL_HEIGHT = 14
local FLOOR_TOP = World.FLOOR_TOP
local COLUMNS = { -16, -8, 0, 8, 16 }
local ROWS = { -8, -1, 6, 13 }

local WHITE = Color3.new(1, 1, 1)
local BLACK = Color3.new(0, 0, 0)

local BASE_COLORS = {
	Color3.fromRGB(255, 95, 95),
	Color3.fromRGB(255, 160, 70),
	Color3.fromRGB(255, 220, 80),
	Color3.fromRGB(110, 225, 120),
	Color3.fromRGB(80, 220, 230),
	Color3.fromRGB(90, 140, 255),
	Color3.fromRGB(170, 110, 255),
	Color3.fromRGB(255, 120, 200),
}

---------------------------------------------------------------------
-- Небо и земля
---------------------------------------------------------------------

local function setupLighting()
	Lighting.ClockTime = 0
	Lighting.Brightness = 1.2
	Lighting.Ambient = Color3.fromRGB(95, 95, 140)
	Lighting.OutdoorAmbient = Color3.fromRGB(125, 120, 180)
	Lighting.EnvironmentDiffuseScale = 0.4
	Lighting.EnvironmentSpecularScale = 0.6
	Lighting.GlobalShadows = true
	for _, child in ipairs(Lighting:GetChildren()) do
		if child:IsA("Sky") or child:IsA("Atmosphere") or child:IsA("PostEffect") then
			child:Destroy()
		end
	end
	local sky = Instance.new("Sky")
	sky.StarCount = 5000
	sky.MoonAngularSize = 18
	sky.CelestialBodiesShown = true
	sky.Parent = Lighting

	local atmosphere = Instance.new("Atmosphere")
	atmosphere.Density = 0.25
	atmosphere.Offset = 0.1
	atmosphere.Color = Color3.fromRGB(80, 70, 150)
	atmosphere.Decay = Color3.fromRGB(110, 70, 160)
	atmosphere.Glare = 0
	atmosphere.Haze = 1
	atmosphere.Parent = Lighting

	local bloom = Instance.new("BloomEffect")
	bloom.Intensity = 0.7
	bloom.Size = 28
	bloom.Threshold = 0.85
	bloom.Parent = Lighting

	local color = Instance.new("ColorCorrectionEffect")
	color.Saturation = 0.15
	color.Contrast = 0.05
	color.Parent = Lighting
end

local function setupTerrain()
	local terrain = workspace.Terrain
	terrain:FillBlock(CFrame.new(0, -6, 0), Vector3.new(460, 12, 460), Enum.Material.Grass)
	terrain:SetMaterialColor(Enum.Material.Grass, Color3.fromRGB(55, 95, 100))
end

---------------------------------------------------------------------
-- Поле звездопада
---------------------------------------------------------------------

local function buildField(map: Folder)
	local field = Util.folder("Field", map)
	local r = World.FIELD_RADIUS
	Util.part({
		name = "Rim",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(0.6, r * 2 + 6, r * 2 + 6),
		cframe = Util.upright(CFrame.new(0, -0.05, 0)),
		color = Color3.fromRGB(130, 110, 255),
		material = Enum.Material.Neon,
		parent = field,
	})
	Util.part({
		name = "Ground",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(0.8, r * 2, r * 2),
		cframe = Util.upright(CFrame.new(0, -0.1, 0)),
		color = Color3.fromRGB(40, 36, 82),
		parent = field,
	})

	-- большая светящаяся звезда в центре поля
	local emblem = Instance.new("Model")
	emblem.Name = "Emblem"
	emblem.Parent = field
	local rays = StarVisuals.shape(emblem, CFrame.new(0, 0.32, 0) * CFrame.Angles(-math.pi / 2, 0, 0), 15, 0.2, Color3.fromRGB(95, 85, 210), Enum.Material.Neon)
	for _, ray in ipairs(rays) do
		ray.Transparency = 0.35
	end

	-- кратеры
	local rng = Random.new(7)
	for _ = 1, 9 do
		local angle = rng:NextNumber() * math.pi * 2
		local distance = 25 + rng:NextNumber() * 40
		local size = 5 + rng:NextNumber() * 6
		Util.part({
			name = "Crater",
			shape = Enum.PartType.Cylinder,
			size = Vector3.new(0.2, size, size),
			cframe = Util.upright(CFrame.new(math.cos(angle) * distance, 0.32, math.sin(angle) * distance)),
			color = Color3.fromRGB(30, 26, 62),
			decor = true,
			parent = field,
		})
	end

	-- световой столб в центре — его видно отовсюду
	Util.part({
		name = "Beacon",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(160, 2, 2),
		cframe = Util.upright(CFrame.new(0, 80, 0)),
		color = Color3.fromRGB(170, 160, 255),
		material = Enum.Material.Neon,
		transparency = 0.6,
		decor = true,
		parent = field,
	})
end

---------------------------------------------------------------------
-- Базы
---------------------------------------------------------------------

local function buildBase(index: number, parent: Folder): Base
	local angle = (index - 1) * (math.pi * 2 / Config.MaxBases)
	local position = Vector3.new(math.cos(angle) * BASE_RADIUS, 0, math.sin(angle) * BASE_RADIUS)
	-- LookVector базы смотрит на центр поля: вход спереди (-Z)
	local cf = CFrame.lookAt(position, Vector3.new(0, 0, 0))
	local color = BASE_COLORS[(index - 1) % #BASE_COLORS + 1]
	local function at(x: number, y: number, z: number): CFrame
		return cf * CFrame.new(x, y, z)
	end

	local model = Instance.new("Model")
	model.Name = "Base" .. index
	model:SetAttribute("Index", index)
	model:SetAttribute("OwnerId", 0)
	model:SetAttribute("Bank", 0)
	model:SetAttribute("LockedUntil", 0)
	model.Parent = parent

	Util.part({ name = "Floor", size = Vector3.new(HALF * 2, 1, HALF * 2), cframe = at(0, FLOOR_TOP - 0.5, 0), color = color:Lerp(BLACK, 0.62), parent = model })

	-- стеклянные стены: звёзды видно снаружи, но перепрыгнуть нельзя
	local wallColor = color:Lerp(WHITE, 0.35)
	local wy = FLOOR_TOP + WALL_HEIGHT / 2
	local function wall(name: string, size: Vector3, cframe: CFrame)
		local part = Util.part({ name = name, size = size, cframe = cframe, color = wallColor, material = Enum.Material.Glass, transparency = 0.6, parent = model })
		part.CastShadow = false
		Util.part({
			name = name .. "Trim",
			size = Vector3.new(size.X + 0.2, 0.6, size.Z + 0.2),
			cframe = cframe * CFrame.new(0, size.Y / 2 + 0.3, 0),
			color = color,
			material = Enum.Material.Neon,
			decor = true,
			parent = model,
		})
	end
	wall("WallLeft", Vector3.new(1.5, WALL_HEIGHT, HALF * 2), at(-HALF + 0.75, wy, 0))
	wall("WallRight", Vector3.new(1.5, WALL_HEIGHT, HALF * 2), at(HALF - 0.75, wy, 0))
	wall("WallBack", Vector3.new(HALF * 2, WALL_HEIGHT, 1.5), at(0, wy, HALF - 0.75))
	wall("WallFrontLeft", Vector3.new(16, WALL_HEIGHT, 1.5), at(-14, wy, -HALF + 0.75))
	wall("WallFrontRight", Vector3.new(16, WALL_HEIGHT, 1.5), at(14, wy, -HALF + 0.75))

	-- ворота и лазерная дверь
	for _, x in ipairs({ -6.75, 6.75 }) do
		Util.part({ name = "GatePost", size = Vector3.new(1.5, WALL_HEIGHT + 2, 1.8), cframe = at(x, FLOOR_TOP + (WALL_HEIGHT + 2) / 2, -HALF + 0.75), color = color, material = Enum.Material.Neon, parent = model })
	end
	Util.part({ name = "GateTop", size = Vector3.new(15, 1.5, 1.8), cframe = at(0, FLOOR_TOP + WALL_HEIGHT + 1.25, -HALF + 0.75), color = color, material = Enum.Material.Neon, parent = model })
	local door = Util.part({
		name = "Door",
		size = Vector3.new(12, WALL_HEIGHT, 0.6),
		cframe = at(0, wy, -HALF + 0.75),
		color = Color3.fromRGB(255, 60, 90),
		material = Enum.Material.Neon,
		transparency = 1,
		collide = false,
		parent = model,
	})
	door.CastShadow = false
	door.CanQuery = false

	local signAnchor = Util.part({ name = "SignAnchor", size = Vector3.new(1, 1, 1), cframe = at(0, FLOOR_TOP + WALL_HEIGHT + 5.5, -HALF + 0.75), color = color, transparency = 1, decor = true, parent = model })
	local sign = Util.sign(signAnchor, "sign_free", color:Lerp(WHITE, 0.45), 24, 4.6)

	-- пьедесталы для звёзд
	local pedestalsFolder = Util.folder("Pedestals", model)
	local pedestals: { Pedestal } = {}
	local slot = 0
	for _, z in ipairs(ROWS) do
		for _, x in ipairs(COLUMNS) do
			slot += 1
			local part = Util.part({ name = "Pedestal" .. slot, size = Vector3.new(4.4, 1.8, 4.4), cframe = at(x, FLOOR_TOP + 0.9, z), color = Color3.fromRGB(45, 42, 72), parent = pedestalsFolder })
			local cap = Util.part({ name = "Cap", size = Vector3.new(4.7, 0.3, 4.7), cframe = at(x, FLOOR_TOP + 1.95, z), color = Color3.fromRGB(80, 80, 100), parent = part })
			part:SetAttribute("Base", index)
			part:SetAttribute("Slot", slot)
			part:SetAttribute("Star", "")
			part:SetAttribute("Mut", "")
			part:SetAttribute("Income", 0)
			part:SetAttribute("Open", false)
			CollectionService:AddTag(part, "Pedestal")
			local point = Instance.new("Attachment")
			point.Name = "PromptPoint"
			point.Position = Vector3.new(0, 3.6, 0)
			point.Parent = part
			local prompt = Util.prompt({
				kind = "pedestal",
				action = "pr_steal",
				distance = 7,
				hold = Config.Steal.hold,
				enabled = false,
				attributes = { Base = index, Slot = slot },
				parent = point,
			})
			table.insert(pedestals, { slot = slot, part = part, cap = cap, prompt = prompt, starCFrame = at(x, FLOOR_TOP + 4.9, z) })
		end
	end

	-- кнопки: сбор монет и замок
	local collectPad = Util.part({ name = "CollectPad", size = Vector3.new(8, 0.3, 6), cframe = at(-14.5, FLOOR_TOP + 0.15, -15.5), color = Color3.fromRGB(90, 255, 140), material = Enum.Material.Neon, parent = model })
	Util.sign(collectPad, "sign_collect", Color3.fromRGB(190, 255, 200), 9, 2.2, Vector3.new(0, 3, 0))
	local lockPad = Util.part({ name = "LockPad", size = Vector3.new(8, 0.3, 6), cframe = at(14.5, FLOOR_TOP + 0.15, -15.5), color = Color3.fromRGB(255, 90, 110), material = Enum.Material.Neon, parent = model })
	Util.sign(lockPad, "sign_lock", Color3.fromRGB(255, 200, 210), 9, 2.2, Vector3.new(0, 3, 0))

	-- телескоп в углу базы
	local scope = Instance.new("Model")
	scope.Name = "Telescope"
	scope.Parent = model
	local foot = at(-15.5, FLOOR_TOP, 17)
	local stand = Util.part({ name = "Stand", shape = Enum.PartType.Cylinder, size = Vector3.new(2.8, 1.6, 1.6), cframe = Util.upright(foot * CFrame.new(0, 1.4, 0)), color = Color3.fromRGB(90, 80, 140), parent = scope })
	local tube = foot * CFrame.new(0, 3.6, 0) * CFrame.Angles(0, math.rad(-60), math.rad(40))
	Util.part({ name = "Tube", shape = Enum.PartType.Cylinder, size = Vector3.new(5.5, 1.4, 1.4), cframe = tube, color = Color3.fromRGB(210, 200, 255), material = Enum.Material.Metal, parent = scope })
	Util.part({ name = "Lens", shape = Enum.PartType.Ball, size = Vector3.new(1.3, 1.3, 1.3), cframe = tube * CFrame.new(2.75, 0, 0), color = Color3.fromRGB(120, 220, 255), material = Enum.Material.Neon, decor = true, parent = scope })
	Util.prompt({ kind = "open", action = "pr_telescope", distance = 9, attributes = { Panel = "telescope" }, parent = stand })

	local stars = Util.folder("Stars", model)

	-- дорожка от базы к полю
	local pathLength = BASE_RADIUS - HALF - World.FIELD_RADIUS + 1
	local pathZ = -HALF - pathLength / 2
	Util.part({ name = "Path", size = Vector3.new(11, 0.3, pathLength), cframe = at(0, 0.05, pathZ), color = Color3.fromRGB(60, 58, 100), parent = model })
	for _, x in ipairs({ -5.75, 5.75 }) do
		Util.part({ name = "PathEdge", size = Vector3.new(0.5, 0.32, pathLength), cframe = at(x, 0.06, pathZ), color = color, material = Enum.Material.Neon, decor = true, parent = model })
	end

	return {
		index = index,
		cframe = cf,
		color = color,
		model = model,
		door = door,
		sign = sign,
		pedestals = pedestals,
		collectPad = collectPad,
		lockPad = lockPad,
		stars = stars,
		spawn = at(0, FLOOR_TOP + 3, 17),
		outside = at(0, 3.5, -HALF - 8),
	}
end

-- Внутри ли точка базы (между стенами)
function World.inside(base: Base, position: Vector3): boolean
	local p = base.cframe:PointToObjectSpace(position)
	return math.abs(p.X) < HALF - 1.4 and math.abs(p.Z) < HALF - 1.4 and p.Y > -10 and p.Y < 40
end

function World.baseAt(position: Vector3): number?
	for _, base in ipairs(World.bases) do
		if World.inside(base, position) then
			return base.index
		end
	end
	return nil
end

---------------------------------------------------------------------
-- Доски лидеров
---------------------------------------------------------------------

local function buildBoard(map: Folder, key: string, titleKey: string, angle: number, color: Color3)
	local position = Vector3.new(math.cos(angle) * 100, 11, math.sin(angle) * 100)
	local cf = CFrame.lookAt(position, Vector3.new(0, 11, 0))
	local board = Util.part({ name = "Board_" .. key, size = Vector3.new(16, 20, 1), cframe = cf, color = Color3.fromRGB(28, 24, 58), parent = map })
	Util.part({ name = "Frame", size = Vector3.new(17, 21, 0.6), cframe = cf * CFrame.new(0, 0, 0.45), color = color, material = Enum.Material.Neon, decor = true, parent = board })

	local gui = Instance.new("SurfaceGui")
	gui.Name = "Board"
	gui.Face = Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 25
	gui.LightInfluence = 0
	gui.MaxDistance = 200
	gui.Parent = board

	local title = Instance.new("TextLabel")
	title.Name = "Title"
	title.Size = UDim2.new(1, -20, 0, 70)
	title.Position = UDim2.fromOffset(10, 10)
	title.BackgroundTransparency = 1
	title.Font = Enum.Font.FredokaOne
	title.TextScaled = true
	title.TextColor3 = color
	title.Text = titleKey
	title.Parent = gui
	Util.localize(title, titleKey)

	local rows = {}
	for i = 1, 10 do
		local row = Instance.new("TextLabel")
		row.Name = "Row" .. i
		row.Size = UDim2.new(1, -30, 0, 38)
		row.Position = UDim2.fromOffset(15, 82 + (i - 1) * 41)
		row.BackgroundTransparency = 1
		row.Font = Enum.Font.FredokaOne
		row.TextScaled = true
		row.TextXAlignment = Enum.TextXAlignment.Left
		row.TextColor3 = i <= 3 and Color3.fromRGB(255, 225, 120) or Color3.fromRGB(230, 230, 255)
		row.Text = ""
		row.Parent = gui
		table.insert(rows, row)
	end
	Util.localize(rows[1], "lb_empty")
	World.boards[key] = rows
end

---------------------------------------------------------------------
-- Украшения
---------------------------------------------------------------------

local function buildDecor(map: Folder)
	local decor = Util.folder("Decor", map)
	local rng = Random.new(42)
	local crystalColors = {
		Color3.fromRGB(150, 120, 255),
		Color3.fromRGB(110, 220, 255),
		Color3.fromRGB(255, 130, 220),
	}
	-- кристаллы и камни за базами
	for i = 1, 36 do
		local angle = (i / 36) * math.pi * 2 + rng:NextNumber() * 0.1
		local distance = 172 + rng:NextNumber() * 24
		local position = Vector3.new(math.cos(angle) * distance, 0, math.sin(angle) * distance)
		if i % 3 == 0 then
			local size = Vector3.new(6 + rng:NextNumber() * 6, 4 + rng:NextNumber() * 5, 6 + rng:NextNumber() * 6)
			Util.part({ name = "Rock", size = size, cframe = CFrame.new(position + Vector3.new(0, size.Y / 2 - 1, 0)) * CFrame.Angles(0, rng:NextNumber() * 3, rng:NextNumber() * 0.4), color = Color3.fromRGB(60, 58, 88), material = Enum.Material.Slate, parent = decor })
		else
			local height = 6 + rng:NextNumber() * 10
			Util.part({
				name = "Crystal",
				size = Vector3.new(2.2, height, 2.2),
				cframe = CFrame.new(position + Vector3.new(0, height / 2 - 0.5, 0)) * CFrame.Angles(rng:NextNumber() * 0.5 - 0.25, rng:NextNumber() * 3, rng:NextNumber() * 0.5 - 0.25),
				color = crystalColors[i % #crystalColors + 1],
				material = Enum.Material.Neon,
				transparency = 0.15,
				parent = decor,
			})
		end
	end

	-- планеты в небе
	Util.part({ name = "PlanetOrange", shape = Enum.PartType.Ball, size = Vector3.new(60, 60, 60), cframe = CFrame.new(320, 170, -260), color = Color3.fromRGB(255, 150, 100), material = Enum.Material.Neon, decor = true, parent = decor })
	local blue = CFrame.new(-300, 140, 280)
	Util.part({ name = "PlanetBlue", shape = Enum.PartType.Ball, size = Vector3.new(44, 44, 44), cframe = blue, color = Color3.fromRGB(110, 190, 255), material = Enum.Material.Neon, decor = true, parent = decor })
	Util.part({ name = "PlanetRing", shape = Enum.PartType.Cylinder, size = Vector3.new(1, 90, 90), cframe = blue * CFrame.Angles(0, 0, math.rad(70)), color = Color3.fromRGB(200, 230, 255), material = Enum.Material.Neon, transparency = 0.5, decor = true, parent = decor })

	-- невидимые стены по краю карты
	local edge = 208
	for _, info in ipairs({
		{ Vector3.new(2, 120, edge * 2), Vector3.new(edge, 60, 0) },
		{ Vector3.new(2, 120, edge * 2), Vector3.new(-edge, 60, 0) },
		{ Vector3.new(edge * 2, 120, 2), Vector3.new(0, 60, edge) },
		{ Vector3.new(edge * 2, 120, 2), Vector3.new(0, 60, -edge) },
	}) do
		local wall = Util.part({ name = "Boundary", size = info[1], cframe = CFrame.new(info[2]), color = WHITE, transparency = 1, parent = decor })
		wall.CastShadow = false
	end
end

---------------------------------------------------------------------

function World.build()
	local preview = workspace:FindFirstChild("StudioPreview")
	if preview then
		preview:Destroy()
	end
	local old = workspace:FindFirstChild("Starfall")
	if old then
		old:Destroy()
	end
	setupLighting()
	setupTerrain()

	local map = Util.folder("Starfall", workspace)
	World.map = map
	buildField(map)
	local basesFolder = Util.folder("Bases", map)
	for i = 1, Config.MaxBases do
		World.bases[i] = buildBase(i, basesFolder)
	end
	local spacing = math.pi * 2 / Config.MaxBases
	buildBoard(map, "earned", "lb_earned", spacing / 2, Color3.fromRGB(255, 210, 90))
	buildBoard(map, "stolen", "lb_stolen", spacing / 2 + math.pi, Color3.fromRGB(255, 120, 150))
	buildDecor(map)
	World.fieldStars = Util.folder("FieldStars", map)
	World.markers = Util.folder("Markers", map)
end

return World
