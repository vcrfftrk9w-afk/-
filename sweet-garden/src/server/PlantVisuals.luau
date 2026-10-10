-- Как выглядят растения и плоды. Всё собирается из простых деталей.

local CollectionService = game:GetService("CollectionService")

local Util = require(script.Parent.Util)

local PlantVisuals = {}

-- размер растения на стадиях роста 0..4
PlantVisuals.stageScale = { [0] = 0.3, [1] = 0.5, [2] = 0.7, [3] = 0.85, [4] = 1 }

local GOLD = Color3.fromRGB(255, 205, 50)
local WOOD = Color3.fromRGB(150, 105, 65)

local function piece(parent: Instance, shape: Enum.PartType, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material?): Part
	return Util.part({
		name = "Piece",
		shape = shape,
		size = size,
		cframe = cframe,
		color = color,
		material = material,
		decor = true,
		parent = parent,
	})
end

local function block(parent: Instance, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material?): Part
	return piece(parent, Enum.PartType.Block, size, cframe, color, material)
end

local function ball(parent: Instance, diameter: number, cframe: CFrame, color: Color3, material: Enum.Material?): Part
	return piece(parent, Enum.PartType.Ball, Vector3.new(diameter, diameter, diameter), cframe, color, material)
end

local function column(parent: Instance, height: number, diameter: number, cframe: CFrame, color: Color3, material: Enum.Material?): Part
	return piece(parent, Enum.PartType.Cylinder, Vector3.new(height, diameter, diameter), Util.upright(cframe), color, material)
end

local function ring(count: number, radius: number, height: (number) -> number, phase: number?): { Vector3 }
	local points = {}
	for i = 1, count do
		local angle = (i - 1) / count * math.pi * 2 + (phase or 0.4)
		table.insert(points, Vector3.new(math.cos(angle) * radius, height(i), math.sin(angle) * radius))
	end
	return points
end

---------------------------------------------------------------------
-- Тело растения. Возвращает модель и точки, где висят плоды.
---------------------------------------------------------------------

function PlantVisuals.body(seed, top: CFrame, scale: number, parent: Instance): (Model, { CFrame })
	local look = seed.look
	local model = Instance.new("Model")
	model.Name = "Body"
	local s = scale
	local points: { Vector3 } = {}
	local count = seed.harvest == "single" and 1 or (seed.maxFruits or 1)

	if look.style == "carrot" then
		for i = 0, 2 do
			block(model, Vector3.new(0.22, 1.6 * s, 0.5 * s), top * CFrame.Angles(0, math.rad(120 * i), 0) * CFrame.new(0.2 * s, 0.75 * s, 0) * CFrame.Angles(0, 0, math.rad(-18)), look.leaf, Enum.Material.Grass)
		end
		points = { Vector3.new(0, 0.1, 0) }
	elseif look.style == "bush" or look.style == "tomato" then
		local b = look.bush * s
		ball(model, b, top * CFrame.new(0, b * 0.45, 0), look.leaf, Enum.Material.Grass)
		ball(model, b * 0.75, top * CFrame.new(b * 0.42, b * 0.32, b * 0.15), look.leaf:Lerp(Color3.new(0, 0, 0), 0.1), Enum.Material.Grass)
		ball(model, b * 0.75, top * CFrame.new(-b * 0.42, b * 0.32, -b * 0.18), look.leaf:Lerp(Color3.new(1, 1, 1), 0.08), Enum.Material.Grass)
		if look.style == "tomato" then
			for _, x in ipairs({ -0.3, 0.3 }) do
				column(model, b * 1.3, 0.18, top * CFrame.new(x * b, b * 0.65, 0), WOOD, Enum.Material.Wood)
			end
		end
		points = ring(count, b * 0.55, function(i)
			return b * (0.3 + (i % 2) * 0.28)
		end)
	elseif look.style == "corn" then
		block(model, Vector3.new(0.45 * s, 5 * s, 0.45 * s), top * CFrame.new(0, 2.5 * s, 0), look.leaf, Enum.Material.Grass)
		for i, height in ipairs({ 1.4, 2.3, 3.1, 3.9 }) do
			block(model, Vector3.new(0.15, 2.2 * s, 0.6 * s), top * CFrame.Angles(0, math.rad(90 * i), 0) * CFrame.new(0.55 * s, height * s, 0) * CFrame.Angles(0, 0, math.rad(-35)), look.leaf:Lerp(Color3.new(1, 1, 0.6), 0.1), Enum.Material.Grass)
		end
		block(model, Vector3.new(0.3 * s, 0.8 * s, 0.3 * s), top * CFrame.new(0, 5.3 * s, 0), Color3.fromRGB(235, 210, 120))
		for i = 1, count do
			local side = (i % 2 == 0) and 1 or -1
			table.insert(points, Vector3.new(side * 0.6 * s, (1.6 + i * 1.1) * s, 0))
		end
	elseif look.style == "vine" then
		column(model, 0.6 * s, 0.25, top * CFrame.new(0, 0.3 * s, 0), look.leaf, Enum.Material.Grass)
		for i = 0, 3 do
			local angle = math.rad(90 * i + 45)
			column(model, 0.15, 1.9 * s, top * CFrame.new(math.cos(angle) * 1.3 * s, 0.12, math.sin(angle) * 1.3 * s), look.leaf, Enum.Material.Grass)
		end
		points = { Vector3.new(0, 0, 0) }
	elseif look.style == "tree" or look.style == "cloud" then
		local h = look.height * s
		local c = look.canopy * s
		local trunkWidth = look.style == "cloud" and 0.5 * s + 0.15 or 0.8 * s + 0.2
		column(model, h, trunkWidth, top * CFrame.new(0, h / 2, 0), look.trunk, look.style == "cloud" and Enum.Material.SmoothPlastic or Enum.Material.Wood)
		if seed.id == "candycane" then
			for k = 1, 3 do
				column(model, 0.35 * s, trunkWidth + 0.08, top * CFrame.new(0, h * k / 4, 0), Color3.fromRGB(225, 30, 45))
			end
		end
		if look.style == "cloud" then
			local offsets = { Vector3.new(0, 0.3, 0), Vector3.new(0.45, 0, 0.2), Vector3.new(-0.45, 0.05, -0.15), Vector3.new(0.05, 0.1, -0.45) }
			for i, offset in ipairs(offsets) do
				local color = (i % 2 == 0) and (look.leaf2 or look.leaf) or look.leaf
				ball(model, c * (i == 1 and 0.85 or 0.6), top * CFrame.new(Vector3.new(0, h, 0) + offset * c), color, Enum.Material.Fabric)
			end
		else
			ball(model, c, top * CFrame.new(0, h + c * 0.3, 0), look.leaf, Enum.Material.Grass)
			ball(model, c * 0.7, top * CFrame.new(c * 0.45, h + c * 0.1, c * 0.2), look.leaf:Lerp(Color3.new(0, 0, 0), 0.08), Enum.Material.Grass)
			ball(model, c * 0.7, top * CFrame.new(-c * 0.45, h + c * 0.15, -c * 0.2), look.leaf:Lerp(Color3.new(1, 1, 1), 0.08), Enum.Material.Grass)
		end
		points = ring(count, c * 0.55, function(i)
			return h + c * (0.05 + (i % 2) * 0.25)
		end)
	elseif look.style == "cactus" then
		column(model, 4.5 * s, 1.1 * s, top * CFrame.new(0, 2.25 * s, 0), look.leaf, Enum.Material.Grass)
		block(model, Vector3.new(1.4 * s, 0.7 * s, 0.7 * s), top * CFrame.new(-0.9 * s, 2 * s, 0), look.leaf, Enum.Material.Grass)
		block(model, Vector3.new(0.7 * s, 1.6 * s, 0.7 * s), top * CFrame.new(-1.6 * s, 2.6 * s, 0), look.leaf, Enum.Material.Grass)
		block(model, Vector3.new(1.4 * s, 0.7 * s, 0.7 * s), top * CFrame.new(0.9 * s, 2.7 * s, 0), look.leaf, Enum.Material.Grass)
		block(model, Vector3.new(0.7 * s, 1.4 * s, 0.7 * s), top * CFrame.new(1.6 * s, 3.2 * s, 0), look.leaf, Enum.Material.Grass)
		points = {
			Vector3.new(0, 4.9 * s, 0),
			Vector3.new(-1.6 * s, 3.8 * s, 0),
			Vector3.new(1.6 * s, 4.3 * s, 0),
			Vector3.new(0.75 * s, 1.6 * s, 0.4 * s),
		}
	elseif look.style == "lollipop" then
		local h = look.height * s
		local c = look.canopy * s
		column(model, h, 0.45 * s + 0.1, top * CFrame.new(0, h / 2, 0), look.trunk)
		local face = top * CFrame.new(0, h + c * 0.45, 0) * CFrame.Angles(0, math.rad(90), 0)
		piece(model, Enum.PartType.Cylinder, Vector3.new(0.7 * s, c, c), face, look.leaf, Enum.Material.Neon)
		piece(model, Enum.PartType.Cylinder, Vector3.new(0.75 * s, c * 0.66, c * 0.66), face, Color3.fromRGB(255, 225, 80), Enum.Material.Neon)
		piece(model, Enum.PartType.Cylinder, Vector3.new(0.8 * s, c * 0.33, c * 0.33), face, Color3.fromRGB(90, 220, 255), Enum.Material.Neon)
		for i = 1, count do
			local angle = (i - 1) / count * math.pi * 2 + 0.5
			table.insert(points, Vector3.new(math.cos(angle) * c * 0.65, h + c * 0.45 + math.sin(angle) * c * 0.65, 0))
		end
	end

	model.Parent = parent
	local anchors = {}
	for _, point in ipairs(points) do
		table.insert(anchors, top * CFrame.new(point))
	end
	return model, anchors
end

---------------------------------------------------------------------
-- Плоды и мутации
---------------------------------------------------------------------

local function baseMaterial(look): Enum.Material
	if look.shape == "fluff" then
		return Enum.Material.Fabric
	elseif look.shape == "lollipop" then
		return Enum.Material.Neon
	end
	return Enum.Material.SmoothPlastic
end

local function sparkle(part: BasePart, color: ColorSequence, rate: number)
	local emitter = Instance.new("ParticleEmitter")
	emitter.Name = "Sparkle"
	emitter.Color = color
	emitter.LightEmission = 1
	emitter.Size = NumberSequence.new(0.35, 0)
	emitter.Lifetime = NumberRange.new(0.6, 1.1)
	emitter.Rate = rate
	emitter.Speed = NumberRange.new(1, 2.5)
	emitter.SpreadAngle = Vector2.new(180, 180)
	emitter.Parent = part
end

local RAINBOW = ColorSequence.new({
	ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 80, 80)),
	ColorSequenceKeypoint.new(0.25, Color3.fromRGB(255, 220, 60)),
	ColorSequenceKeypoint.new(0.5, Color3.fromRGB(80, 255, 120)),
	ColorSequenceKeypoint.new(0.75, Color3.fromRGB(80, 160, 255)),
	ColorSequenceKeypoint.new(1, Color3.fromRGB(220, 90, 255)),
})

function PlantVisuals.decorate(part: BasePart, seed, fruit)
	local look = seed.look
	for _, child in ipairs(part:GetChildren()) do
		if child:IsA("ParticleEmitter") then
			child:Destroy()
		end
	end
	if CollectionService:HasTag(part, "Rainbow") then
		CollectionService:RemoveTag(part, "Rainbow")
	end
	part.Material = baseMaterial(look)
	part.Reflectance = 0
	part.Color = look.fruit

	if fruit.c == "gold" then
		part.Color = GOLD
		part.Material = Enum.Material.Foil
		sparkle(part, ColorSequence.new(GOLD), 3)
	elseif fruit.c == "rainbow" then
		part.Color = Color3.fromRGB(255, 90, 220)
		part.Material = Enum.Material.Neon
		CollectionService:AddTag(part, "Rainbow")
		sparkle(part, RAINBOW, 6)
	end

	if fruit.w == "wet" then
		part.Reflectance = 0.3
		if not fruit.c then
			part.Color = part.Color:Lerp(Color3.fromRGB(60, 90, 170), 0.25)
		end
	elseif fruit.w == "frozen" then
		part.Material = Enum.Material.Ice
		part.Color = part.Color:Lerp(Color3.fromRGB(185, 230, 255), 0.55)
	elseif fruit.w == "sugar" then
		part.Material = Enum.Material.Sand
		part.Color = part.Color:Lerp(Color3.fromRGB(255, 195, 235), 0.45)
		sparkle(part, ColorSequence.new(Color3.fromRGB(255, 170, 230)), 3)
	elseif fruit.w == "shocked" then
		part.Material = Enum.Material.Neon
		part.Color = part.Color:Lerp(Color3.fromRGB(255, 255, 150), 0.4)
		sparkle(part, ColorSequence.new(Color3.fromRGB(255, 250, 120)), 5)
	end
end

function PlantVisuals.fruit(seed, fruit, anchor: CFrame, parent: Instance, slot: string): BasePart
	local look = seed.look
	local k = look.size * math.clamp(tonumber(fruit.s) or 1, 0.5, 2.2)
	local part
	if look.shape == "carrot" then
		part = piece(parent, Enum.PartType.Cylinder, Vector3.new(1.3 * k, 0.75 * k, 0.75 * k), Util.upright(anchor * CFrame.new(0, 0.15 * k, 0)), look.fruit)
	elseif look.shape == "corn" then
		part = piece(parent, Enum.PartType.Cylinder, Vector3.new(1.5 * k, 0.65 * k, 0.65 * k), Util.upright(anchor) * CFrame.Angles(0, math.rad(15), 0), look.fruit)
	elseif look.shape == "cane" then
		part = piece(parent, Enum.PartType.Cylinder, Vector3.new(1.6 * k, 0.4 * k, 0.4 * k), Util.upright(anchor * CFrame.new(0, -0.5 * k, 0)), look.fruit)
	else
		local cframe = anchor
		if look.style == "vine" then
			cframe = anchor * CFrame.new(0, k * 0.42, 0)
		end
		part = ball(parent, k, cframe, look.fruit)
	end
	part.Name = "Fruit" .. slot
	PlantVisuals.decorate(part, seed, fruit)
	return part
end

return PlantVisuals
