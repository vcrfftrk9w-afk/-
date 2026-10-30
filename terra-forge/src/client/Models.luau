-- 3D models built from Roblox parts: units, buildings, capitals, deposits and trees.
-- Sizes below are in map tiles; Models.SCALE turns them into studs. Models face -Z
-- (forward); their origin is on the ground.
-- A model is a kit: parts with their offsets from the origin, so units can be moved
-- every frame with workspace:BulkMoveTo.
local Models = {}

local rad = math.rad
local SMOOTH = Enum.Material.SmoothPlastic
local METAL = Enum.Material.Metal
local NEON = Enum.Material.Neon
local GLASS = Enum.Material.Glass

local DARK = Color3.fromRGB(46, 48, 54)
local STEEL = Color3.fromRGB(92, 96, 104)
local SKIN = Color3.fromRGB(236, 196, 156)
local CANOPY = Color3.fromRGB(150, 210, 250)
local OLIVE = Color3.fromRGB(96, 104, 72)
local CONCRETE = Color3.fromRGB(150, 150, 154)
local WALL = Color3.fromRGB(236, 228, 210)

-- studs per map tile
Models.SCALE = 1
-- how high aircraft fly above the ground, in tiles
Models.AIR_ALT = 4

local BLOCK = Enum.PartType.Block
local BALL = Enum.PartType.Ball
local CYL = Enum.PartType.Cylinder

-- cylinders lie along X; these turn them upright or along the forward axis
local UPRIGHT = CFrame.Angles(0, 0, rad(90))
local FORWARD = CFrame.Angles(0, rad(90), 0)

local function newPart(shape, size: Vector3, color: Color3, material): Part
	local p = Instance.new("Part")
	p.Shape = shape
	p.Size = size
	p.Color = color
	p.Material = material or SMOOTH
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	return p
end

local function newKit(name: string)
	local model = Instance.new("Model")
	model.Name = name
	return { model = model, parts = {}, offsets = {}, alpha = {}, spin = {} }
end

local function add(kit, shape, size: Vector3, offset: CFrame, color: Color3, material, transparency: number?): Part
	local k = Models.SCALE
	size *= k
	offset = CFrame.new(offset.Position * k) * offset.Rotation
	local p = newPart(shape, size, color, material)
	p.Transparency = transparency or 0
	p.Parent = kit.model
	table.insert(kit.parts, p)
	table.insert(kit.offsets, offset)
	table.insert(kit.alpha, p.Transparency)
	return p
end

local function at(x: number, y: number, z: number): CFrame
	return CFrame.new(x, y, z)
end

local function darker(c: Color3, k: number): Color3
	return c:Lerp(Color3.new(0, 0, 0), k)
end

local function lighter(c: Color3, k: number): Color3
	return c:Lerp(Color3.new(1, 1, 1), k)
end

-- moves every part of a kit to a base frame (for models that stand still)
function Models.place(kit, base: CFrame)
	for i, p in kit.parts do
		p.CFrame = base * kit.offsets[i]
	end
	kit.base = base
end

-- see-through while under construction
function Models.setGhost(kit, ghost: boolean)
	for i, p in kit.parts do
		p.Transparency = if ghost then math.max(kit.alpha[i], 0.62) else kit.alpha[i]
	end
end

---------------------------------------------------------------- units

local function soldier(kit, x: number, z: number, team: Color3)
	add(kit, BLOCK, Vector3.new(0.15, 0.3, 0.11), at(x, 0.15, z), team)
	add(kit, BALL, Vector3.new(0.12, 0.12, 0.12), at(x, 0.37, z), SKIN)
	add(kit, BLOCK, Vector3.new(0.13, 0.04, 0.13), at(x, 0.43, z), darker(team, 0.45))
end

local function tracks(kit, length: number, z: number)
	add(kit, BLOCK, Vector3.new(0.24, 0.24, length), at(-0.32, 0.12, z), DARK, METAL)
	add(kit, BLOCK, Vector3.new(0.24, 0.24, length), at(0.32, 0.12, z), DARK, METAL)
end

local UNIT_BUILDERS = {}

function UNIT_BUILDERS.infantry(kit, team: Color3)
	for _, s in { { -0.22, 0.14 }, { 0.22, 0.14 }, { 0, -0.2 } } do
		soldier(kit, s[1], s[2], team)
		add(kit, BLOCK, Vector3.new(0.03, 0.03, 0.24), at(s[1] + 0.08, 0.24, s[2] - 0.08), DARK)
	end
end

function UNIT_BUILDERS.rocket(kit, team: Color3)
	for _, x in { -0.17, 0.17 } do
		soldier(kit, x, 0, team)
		add(kit, CYL, Vector3.new(0.4, 0.08, 0.08), at(x + 0.08, 0.36, -0.02) * FORWARD, OLIVE)
		add(kit, CYL, Vector3.new(0.04, 0.085, 0.085), at(x + 0.08, 0.36, -0.23) * FORWARD, Color3.fromRGB(230, 120, 50))
	end
end

function UNIT_BUILDERS.scout(kit, team: Color3)
	add(kit, CYL, Vector3.new(0.62, 0.3, 0.3), at(0, 0.15, -0.3), DARK)
	add(kit, CYL, Vector3.new(0.62, 0.3, 0.3), at(0, 0.15, 0.32), DARK)
	add(kit, BLOCK, Vector3.new(0.5, 0.24, 0.98), at(0, 0.34, 0), team)
	add(kit, BLOCK, Vector3.new(0.44, 0.16, 0.42), at(0, 0.54, 0.08), darker(team, 0.2))
	add(kit, BLOCK, Vector3.new(0.4, 0.1, 0.03), at(0, 0.55, -0.14), CANOPY, GLASS)
	add(kit, CYL, Vector3.new(0.38, 0.05, 0.05), at(0, 0.66, -0.1) * FORWARD, DARK, METAL)
end

function UNIT_BUILDERS.tank(kit, team: Color3)
	tracks(kit, 1.24, 0)
	add(kit, BLOCK, Vector3.new(0.56, 0.22, 1.1), at(0, 0.33, 0.02), team)
	add(kit, BLOCK, Vector3.new(0.56, 0.1, 0.26), at(0, 0.36, -0.6) * CFrame.Angles(rad(-28), 0, 0), darker(team, 0.15))
	add(kit, CYL, Vector3.new(0.2, 0.48, 0.48), at(0, 0.54, 0.08) * UPRIGHT, lighter(team, 0.12))
	add(kit, CYL, Vector3.new(0.66, 0.08, 0.08), at(0, 0.55, -0.44) * FORWARD, DARK, METAL)
	add(kit, CYL, Vector3.new(0.05, 0.16, 0.16), at(0.09, 0.66, 0.16) * UPRIGHT, darker(team, 0.35))
end

function UNIT_BUILDERS.artillery(kit, team: Color3)
	tracks(kit, 1.1, 0.04)
	add(kit, BLOCK, Vector3.new(0.54, 0.2, 1.0), at(0, 0.31, 0.06), team)
	add(kit, BLOCK, Vector3.new(0.5, 0.28, 0.5), at(0, 0.55, 0.2), darker(team, 0.2))
	add(kit, CYL, Vector3.new(1.05, 0.1, 0.1), at(0, 0.8, -0.24) * CFrame.Angles(rad(26), 0, 0) * FORWARD, STEEL, METAL)
	add(kit, CYL, Vector3.new(0.12, 0.14, 0.14), at(0, 1.02, -0.69) * CFrame.Angles(rad(26), 0, 0) * FORWARD, DARK, METAL)
end

function UNIT_BUILDERS.fighter(kit, team: Color3)
	add(kit, BLOCK, Vector3.new(0.18, 0.16, 1.2), at(0, 0, 0), team)
	add(kit, BLOCK, Vector3.new(0.12, 0.1, 0.24), at(0, -0.01, -0.7), darker(team, 0.25))
	add(kit, BALL, Vector3.new(0.15, 0.15, 0.15), at(0, 0.08, -0.32), CANOPY, GLASS, 0.1)
	add(kit, BLOCK, Vector3.new(0.6, 0.03, 0.34), at(-0.32, 0, 0.12) * CFrame.Angles(0, rad(24), 0), team)
	add(kit, BLOCK, Vector3.new(0.6, 0.03, 0.34), at(0.32, 0, 0.12) * CFrame.Angles(0, rad(-24), 0), team)
	add(kit, BLOCK, Vector3.new(0.03, 0.26, 0.24), at(0, 0.16, 0.5), darker(team, 0.3))
	add(kit, BLOCK, Vector3.new(0.46, 0.03, 0.16), at(0, 0.02, 0.52), team)
	add(kit, BLOCK, Vector3.new(0.1, 0.08, 0.04), at(0, 0, 0.61), Color3.fromRGB(255, 160, 60), NEON)
end

function UNIT_BUILDERS.gunship(kit, team: Color3)
	add(kit, BLOCK, Vector3.new(0.3, 0.28, 0.66), at(0, 0, 0.02), team)
	add(kit, BALL, Vector3.new(0.28, 0.28, 0.28), at(0, -0.02, -0.34), CANOPY, GLASS, 0.1)
	add(kit, BLOCK, Vector3.new(0.08, 0.08, 0.72), at(0, 0.05, 0.68), darker(team, 0.25))
	add(kit, BLOCK, Vector3.new(0.02, 0.24, 0.05), at(0.05, 0.1, 1.02), DARK)
	add(kit, BLOCK, Vector3.new(0.66, 0.03, 0.12), at(0, -0.04, 0), DARK)
	add(kit, CYL, Vector3.new(0.22, 0.08, 0.08), at(-0.31, -0.08, -0.02) * FORWARD, DARK)
	add(kit, CYL, Vector3.new(0.22, 0.08, 0.08), at(0.31, -0.08, -0.02) * FORWARD, DARK)
	add(kit, CYL, Vector3.new(0.12, 0.05, 0.05), at(0, 0.2, 0) * UPRIGHT, DARK)
	-- the rotor spins: its offset is turned every frame
	table.insert(kit.spin, #kit.parts + 1)
	add(kit, BLOCK, Vector3.new(1.5, 0.02, 0.07), at(0, 0.27, 0), Color3.fromRGB(30, 30, 34))
	table.insert(kit.spin, #kit.parts + 1)
	add(kit, BLOCK, Vector3.new(0.07, 0.02, 1.5), at(0, 0.27, 0), Color3.fromRGB(30, 30, 34))
end

-- returns a kit with an invisible root part first (it carries the unit's markers),
-- a selection disc on the ground, and the body parts
function Models.unit(kind: string, team: Color3, air: boolean)
	local kit = newKit(kind)
	kit.air = air
	local lift = if air then Models.AIR_ALT else 0
	kit.lift = lift * Models.SCALE
	local root = newPart(BLOCK, Vector3.new(0.2, 0.2, 0.2) * Models.SCALE, team)
	root.Transparency = 1
	root.CastShadow = false
	root.Name = "Root"
	root.Parent = kit.model
	kit.root = root
	kit.body = Instance.new("Model")
	kit.body.Name = "Body"
	local builder = UNIT_BUILDERS[kind] or UNIT_BUILDERS.tank
	builder(kit, team)
	local ring = add(kit, CYL, Vector3.new(0.04, 1.4, 1.4), at(0, 0.04 - lift, 0) * UPRIGHT, Color3.new(1, 1, 1), NEON, 1)
	ring.CastShadow = false
	kit.ring = ring
	for _, p in kit.parts do
		p.Parent = kit.body
	end
	kit.body.Parent = kit.model
	return kit
end

function Models.setSelected(kit, on: boolean)
	kit.ring.Transparency = if on then 0.45 else 1
end

---------------------------------------------------------------- buildings

local function flag(kit, x: number, z: number, height: number, team: Color3)
	add(kit, CYL, Vector3.new(height, 0.035, 0.035), at(x, height / 2, z) * UPRIGHT, Color3.fromRGB(235, 235, 235))
	add(kit, BLOCK, Vector3.new(0.34, 0.2, 0.02), at(x + 0.18, height - 0.12, z), team)
end

local function gable(kit, x: number, y: number, z: number, w: number, d: number, color: Color3)
	-- a square block turned 45 degrees and half hidden in the walls makes a pitched roof
	local s = w / math.sqrt(2)
	add(kit, BLOCK, Vector3.new(s, s, d), at(x, y, z) * CFrame.Angles(0, 0, rad(45)), color)
end

local BUILDING_BUILDERS = {}

function BUILDING_BUILDERS.capital(kit, team: Color3)
	add(kit, BLOCK, Vector3.new(1.4, 0.12, 1.4), at(0, 0.06, 0), Color3.fromRGB(196, 190, 178))
	add(kit, BLOCK, Vector3.new(0.96, 0.56, 0.8), at(0, 0.4, 0.05), WALL)
	add(kit, BLOCK, Vector3.new(1.06, 0.08, 0.9), at(0, 0.72, 0.05), team)
	add(kit, BALL, Vector3.new(0.5, 0.5, 0.5), at(0, 0.76, 0.05), lighter(team, 0.15))
	for _, x in { -0.3, -0.1, 0.1, 0.3 } do
		add(kit, CYL, Vector3.new(0.5, 0.07, 0.07), at(x, 0.37, 0.5) * UPRIGHT, Color3.fromRGB(250, 248, 240))
	end
	flag(kit, -0.55, -0.5, 1.15, team)
end

function BUILDING_BUILDERS.extractor(kit, team: Color3)
	add(kit, BLOCK, Vector3.new(1.0, 0.06, 1.0), at(0, 0.03, 0), CONCRETE)
	add(kit, CYL, Vector3.new(0.36, 0.34, 0.34), at(0.28, 0.24, 0.26) * UPRIGHT, team)
	add(kit, BLOCK, Vector3.new(0.12, 1.0, 0.12), at(-0.18, 0.5, -0.14), STEEL, METAL)
	add(kit, BLOCK, Vector3.new(0.72, 0.08, 0.1), at(-0.16, 0.98, -0.14), team)
	add(kit, BLOCK, Vector3.new(0.14, 0.24, 0.12), at(0.16, 0.9, -0.14), DARK)
	add(kit, BLOCK, Vector3.new(0.18, 0.18, 0.14), at(-0.48, 0.88, -0.14), DARK)
end

function BUILDING_BUILDERS.city(kit, team: Color3)
	for i, h in { { -0.36, -0.3 }, { -0.36, 0.32 }, { 0.3, 0.34 } } do
		local wall = if i % 2 == 0 then Color3.fromRGB(226, 214, 196) else WALL
		add(kit, BLOCK, Vector3.new(0.4, 0.3, 0.36), at(h[1], 0.15, h[2]), wall)
		gable(kit, h[1], 0.3, h[2], 0.42, 0.38, team)
	end
	add(kit, BLOCK, Vector3.new(0.36, 0.86, 0.36), at(0.32, 0.43, -0.3), Color3.fromRGB(196, 210, 226), GLASS)
	add(kit, BLOCK, Vector3.new(0.38, 0.06, 0.38), at(0.32, 0.89, -0.3), team)
end

function BUILDING_BUILDERS.barracks(kit, team: Color3)
	add(kit, BLOCK, Vector3.new(1.4, 0.05, 1.1), at(0, 0.025, 0), Color3.fromRGB(156, 136, 104))
	add(kit, BLOCK, Vector3.new(1.1, 0.34, 0.5), at(0, 0.2, -0.16), Color3.fromRGB(212, 202, 176))
	add(kit, BLOCK, Vector3.new(1.14, 0.36, 0.36), at(0, 0.37, -0.16) * CFrame.Angles(rad(45), 0, 0), team)
	add(kit, BLOCK, Vector3.new(0.18, 0.18, 0.18), at(-0.42, 0.09, 0.34), Color3.fromRGB(150, 110, 60))
	add(kit, BLOCK, Vector3.new(0.16, 0.16, 0.16), at(-0.2, 0.08, 0.38), Color3.fromRGB(132, 96, 52))
	flag(kit, 0.5, 0.36, 0.95, team)
end

function BUILDING_BUILDERS.tankf(kit, team: Color3)
	add(kit, BLOCK, Vector3.new(1.5, 0.05, 1.4), at(0, 0.025, 0), Color3.fromRGB(128, 128, 134))
	add(kit, BLOCK, Vector3.new(1.2, 0.5, 0.9), at(0, 0.25, -0.1), Color3.fromRGB(172, 178, 188), METAL)
	add(kit, CYL, Vector3.new(1.22, 0.9, 0.9), at(0, 0.5, -0.1), team)
	add(kit, BLOCK, Vector3.new(0.62, 0.38, 0.03), at(0, 0.19, 0.36), DARK)
	add(kit, CYL, Vector3.new(0.7, 0.13, 0.13), at(0.46, 0.85, -0.42) * UPRIGHT, Color3.fromRGB(150, 82, 62))
end

function BUILDING_BUILDERS.air(kit, team: Color3)
	add(kit, BLOCK, Vector3.new(0.38, 0.03, 1.7), at(-0.36, 0.015, 0), Color3.fromRGB(62, 64, 70))
	add(kit, BLOCK, Vector3.new(0.04, 0.035, 1.2), at(-0.36, 0.02, 0), Color3.fromRGB(240, 240, 240))
	add(kit, CYL, Vector3.new(0.8, 0.62, 0.62), at(0.36, 0, 0.22) * FORWARD, team)
	add(kit, BLOCK, Vector3.new(0.18, 0.6, 0.18), at(0.42, 0.3, -0.46), Color3.fromRGB(222, 222, 228))
	add(kit, BLOCK, Vector3.new(0.27, 0.14, 0.27), at(0.42, 0.67, -0.46), Color3.fromRGB(140, 200, 240), GLASS)
end

function BUILDING_BUILDERS.tower(kit, team: Color3)
	add(kit, CYL, Vector3.new(0.5, 0.72, 0.72), at(0, 0.25, 0) * UPRIGHT, Color3.fromRGB(164, 160, 150))
	add(kit, CYL, Vector3.new(0.42, 0.52, 0.52), at(0, 0.71, 0) * UPRIGHT, Color3.fromRGB(184, 180, 170))
	add(kit, BLOCK, Vector3.new(0.58, 0.14, 0.58), at(0, 0.98, 0), team)
	add(kit, BLOCK, Vector3.new(0.26, 0.16, 0.3), at(0, 1.13, 0), DARK)
	add(kit, CYL, Vector3.new(0.42, 0.05, 0.05), at(0, 1.15, -0.3) * FORWARD, DARK, METAL)
end

function BUILDING_BUILDERS.aa(kit, team: Color3)
	add(kit, BLOCK, Vector3.new(0.9, 0.12, 0.9), at(0, 0.06, 0), Color3.fromRGB(122, 128, 112))
	add(kit, CYL, Vector3.new(0.12, 0.62, 0.62), at(0, 0.18, 0) * UPRIGHT, team)
	add(kit, BLOCK, Vector3.new(0.34, 0.22, 0.34), at(0, 0.35, 0), darker(team, 0.25))
	for _, x in { -0.08, 0.08 } do
		add(kit, CYL, Vector3.new(0.6, 0.05, 0.05), at(x, 0.55, -0.16) * CFrame.Angles(rad(50), 0, 0) * FORWARD, DARK, METAL)
	end
	add(kit, BLOCK, Vector3.new(0.3, 0.16, 0.02), at(0, 0.6, 0.16), Color3.fromRGB(210, 214, 220))
end

function Models.building(kind: string, team: Color3)
	local kit = newKit(kind)
	local builder = BUILDING_BUILDERS[kind] or BUILDING_BUILDERS.barracks
	builder(kit, team)
	kit.model.PrimaryPart = kit.parts[1]
	return kit
end

---------------------------------------------------------------- scenery

local ORE_COLORS = {
	{ Color3.fromRGB(176, 100, 62), Color3.fromRGB(204, 126, 80) },
	{ Color3.fromRGB(52, 54, 62), Color3.fromRGB(78, 80, 90) },
}

-- a few rocks for iron (1) and coal (2), a black puddle for oil (3)
function Models.deposit(kind: number, rng: Random)
	local kit = newKit("Deposit")
	if kind == 3 then
		local p = add(kit, CYL, Vector3.new(0.03, 0.8, 0.8), at(0, 0.015, 0) * UPRIGHT, Color3.fromRGB(16, 16, 22), GLASS)
		p.Reflectance = 0.25
		add(kit, CYL, Vector3.new(0.04, 0.42, 0.42), at(0.32, 0.02, 0.26) * UPRIGHT, Color3.fromRGB(20, 20, 26), GLASS)
	else
		local colors = ORE_COLORS[kind] or ORE_COLORS[1]
		for i = 1, 3 do
			local s = 0.22 + rng:NextNumber() * 0.18
			local a = rng:NextNumber() * math.pi * 2
			local d = if i == 1 then 0 else 0.3
			add(kit, BLOCK, Vector3.new(s, s * 0.8, s), at(math.cos(a) * d, s * 0.3, math.sin(a) * d)
				* CFrame.Angles(rng:NextNumber(), rng:NextNumber() * 3, rng:NextNumber()), colors[1 + i % 2], Enum.Material.Slate)
		end
	end
	for _, p in kit.parts do
		p.CastShadow = false
	end
	return kit
end

local TREE_COLORS = {
	Color3.fromRGB(62, 118, 58),
	Color3.fromRGB(74, 132, 64),
	Color3.fromRGB(52, 104, 56),
}
local PINE_COLORS = {
	Color3.fromRGB(44, 86, 60),
	Color3.fromRGB(56, 98, 68),
}

-- one ball per tree keeps forests cheap to draw
function Models.tree(pine: boolean, rng: Random): Part
	local colors = if pine then PINE_COLORS else TREE_COLORS
	local s = ((if pine then 0.55 else 0.7) + rng:NextNumber() * 0.4) * Models.SCALE
	local p = newPart(BALL, Vector3.new(s, s, s), colors[rng:NextInteger(1, #colors)], Enum.Material.Grass)
	return p
end

return Models
