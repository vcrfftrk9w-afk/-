-- Как выглядят звёзды: пятиконечная звезда с лицом и украшениями.

local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

local StarVisuals = {}

local FACE = "rbxasset://textures/face.png"
local WHITE = Color3.new(1, 1, 1)

local function piece(className: string, model: Model, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material?): BasePart
	local part = Instance.new(className) :: BasePart
	part.Anchored = true
	part.CanCollide = false
	part.CanTouch = false
	part.CanQuery = false
	part.CastShadow = false
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Size = size
	part.CFrame = cframe
	part.Color = color
	part.Material = material or Enum.Material.SmoothPlastic
	part.Parent = model
	return part
end

local function ball(model: Model, diameter: number, cframe: CFrame, color: Color3, material: Enum.Material?): BasePart
	local part = piece("Part", model, Vector3.new(diameter, diameter, diameter), cframe, color, material);
	(part :: Part).Shape = Enum.PartType.Ball
	part.Size = Vector3.new(diameter, diameter, diameter)
	return part
end

-- Плоский диск: ось цилиндра смотрит вдоль Z звезды (вперёд)
local function disk(model: Model, diameter: number, thickness: number, cframe: CFrame, color: Color3, material: Enum.Material?): BasePart
	local part = piece("Part", model, Vector3.new(thickness, diameter, diameter), cframe * CFrame.Angles(0, math.rad(90), 0), color, material);
	(part :: Part).Shape = Enum.PartType.Cylinder
	return part
end

-- Кольцо вокруг звезды (ось цилиндра — вверх)
local function ring(model: Model, diameter: number, height: number, cframe: CFrame, color: Color3, material: Enum.Material?): BasePart
	local part = piece("Part", model, Vector3.new(height, diameter, diameter), cframe * CFrame.Angles(0, 0, math.rad(90)), color, material);
	(part :: Part).Shape = Enum.PartType.Cylinder
	return part
end

local function sparkles(parent: BasePart, color: Color3, rate: number)
	local emitter = Instance.new("ParticleEmitter")
	emitter.Color = ColorSequence.new(color)
	emitter.LightEmission = 1
	emitter.Size = NumberSequence.new(0.35, 0)
	emitter.Lifetime = NumberRange.new(1, 1.6)
	emitter.Speed = NumberRange.new(1, 2.5)
	emitter.SpreadAngle = Vector2.new(180, 180)
	emitter.Rate = rate
	emitter.Parent = parent
end

local DISCO = {
	Color3.fromRGB(255, 90, 200),
	Color3.fromRGB(255, 230, 80),
	Color3.fromRGB(80, 230, 255),
	Color3.fromRGB(120, 255, 120),
	Color3.fromRGB(190, 120, 255),
}

-- Цвет лучей для отдельных звёзд (по умолчанию — цвет звезды)
local RAYS = {
	sleepy = Color3.fromRGB(190, 210, 255),
	rocketo = Color3.fromRGB(245, 245, 255),
	frosty = Color3.fromRGB(190, 240, 255),
	cupcake = Color3.fromRGB(255, 150, 200),
	ninja = Color3.fromRGB(55, 55, 70),
	galaxion = Color3.fromRGB(70, 90, 255),
	pizza = Color3.fromRGB(255, 150, 60),
	blackhole = Color3.fromRGB(150, 70, 255),
	granny = Color3.fromRGB(255, 190, 220),
}

local RAY_MATERIAL = {
	frosty = Enum.Material.Glass,
	ninja = Enum.Material.SmoothPlastic,
}

local BODY_COLOR = {
	cupcake = Color3.fromRGB(235, 185, 125),
	disco = Color3.fromRGB(210, 215, 230),
}

local BODY_MATERIAL = {
	disco = Enum.Material.Foil,
	galaxion = Enum.Material.Neon,
}

-- Украшения каждой звезды
local EXTRAS: { [string]: (Model, CFrame, number, { BasePart }) -> () } = {
	sleepy = function(model, cf, s, rays)
		local cap = Color3.fromRGB(70, 80, 170)
		rays[1].Color = cap
		rays[2].Color = cap
		ball(model, 0.8 * s, cf * CFrame.new(0, 2.95 * s, 0), WHITE)
	end,
	pancake = function(model, cf, s)
		piece("Part", model, Vector3.new(0.9, 0.55, 0.9) * s, cf * CFrame.new(0, 1.45 * s, -0.1 * s), Color3.fromRGB(255, 235, 120))
		disk(model, 2.2 * s, 0.25 * s, cf * CFrame.new(0, -0.15 * s, 0.75 * s), Color3.fromRGB(160, 90, 40))
	end,
	melony = function(model, cf, s)
		disk(model, 3.1 * s, 0.3 * s, cf * CFrame.new(0, 0, 0.6 * s), Color3.fromRGB(60, 175, 75))
	end,
	rocketo = function(model, cf, s)
		ball(model, 1.1 * s, cf * CFrame.new(0, -1.55 * s, 0.25 * s), Color3.fromRGB(255, 140, 40), Enum.Material.Neon)
		ball(model, 0.7 * s, cf * CFrame.new(0, 2.85 * s, 0), Color3.fromRGB(235, 60, 60))
	end,
	frosty = function(model, cf, s)
		ring(model, 2.85 * s, 0.4 * s, cf * CFrame.new(0, -0.75 * s, 0), Color3.fromRGB(225, 50, 60))
	end,
	disco = function(_model, _cf, _s, rays)
		for i, ray in ipairs(rays) do
			ray.Color = DISCO[(i - 1) // 2 + 1]
		end
	end,
	cupcake = function(model, cf, s)
		ball(model, 1.7 * s, cf * CFrame.new(0, 1.0 * s, 0.15 * s), Color3.fromRGB(255, 170, 215))
		ball(model, 0.65 * s, cf * CFrame.new(0, 1.95 * s, 0.1 * s), Color3.fromRGB(220, 30, 50))
	end,
	king = function(model, cf, s)
		ring(model, 1.6 * s, 0.75 * s, cf * CFrame.new(0, 1.55 * s, 0), Config.GoldColor, Enum.Material.Neon)
		ball(model, 0.5 * s, cf * CFrame.new(0, 1.55 * s, -0.8 * s), Color3.fromRGB(230, 30, 60), Enum.Material.Neon)
	end,
	ninja = function(model, cf, s)
		ring(model, 2.85 * s, 0.4 * s, cf * CFrame.new(0, 0.8 * s, 0), Color3.fromRGB(220, 30, 40))
		piece("Part", model, Vector3.new(0.25, 1.1, 0.1) * s, cf * CFrame.new(0.3 * s, 0.35 * s, 1.4 * s) * CFrame.Angles(0, 0, math.rad(25)), Color3.fromRGB(220, 30, 40))
	end,
	galaxion = function(model, cf, s)
		local band = ring(model, 4.6 * s, 0.12 * s, cf * CFrame.Angles(math.rad(20), 0, math.rad(12)), Color3.fromRGB(140, 220, 255), Enum.Material.Neon)
		band.Transparency = 0.35
	end,
	pizza = function(model, cf, s)
		for _, k in ipairs({ 0, 2, 3 }) do
			local a = math.rad(90 + 72 * k)
			disk(model, 0.7 * s, 0.12 * s, cf * CFrame.new(math.cos(a) * 1.85 * s, math.sin(a) * 1.85 * s, -0.5 * s), Color3.fromRGB(200, 40, 40))
		end
	end,
	blackhole = function(model, cf, s)
		local band = ring(model, 5.4 * s, 0.15 * s, cf * CFrame.Angles(math.rad(25), 0, math.rad(-10)), Color3.fromRGB(255, 140, 60), Enum.Material.Neon)
		band.Transparency = 0.25
	end,
	granny = function(model, cf, s)
		ball(model, 1.2 * s, cf * CFrame.new(0, 1.45 * s, 0.35 * s), Color3.fromRGB(235, 235, 240))
		piece("Part", model, Vector3.new(1.5, 0.12, 0.12) * s, cf * CFrame.new(0, 0.35 * s, -1.3 * s), Color3.fromRGB(60, 40, 40))
	end,
}

-- Пять лучей звезды, каждый из двух клиньев. Звезда лежит в плоскости XY своего cframe.
function StarVisuals.shape(model: Model, cframe: CFrame, tip: number, thickness: number, color: Color3, material: Enum.Material): { BasePart }
	local ri = tip * 0.4
	local r0 = ri * math.cos(math.rad(36))
	local halfWidth = ri * math.sin(math.rad(36))
	local length = tip - r0
	local rays: { BasePart } = {}
	for k = 0, 4 do
		local a = math.rad(90 + 72 * k)
		local d = Vector3.new(math.cos(a), math.sin(a), 0)
		local n = Vector3.new(math.sin(a), -math.cos(a), 0)
		local spin = CFrame.Angles(0, 0, a - math.pi / 2)
		for side = -1, 1, 2 do
			local center = d * (r0 + length / 2) + n * (halfWidth / 2 * -side)
			local turn = CFrame.Angles(0, side * math.pi / 2, 0)
			local ray = piece("WedgePart", model, Vector3.new(thickness, length, halfWidth), cframe * CFrame.new(center) * spin * turn, color, material)
			ray.Name = "Ray"
			table.insert(rays, ray)
		end
	end
	return rays
end

--[[
	Строит звезду. cframe — центр звезды, лицо смотрит вдоль LookVector.
	carried = true: детали не закреплены, а приварены к телу (звезду несут над головой).
]]
function StarVisuals.build(starId: string, mut: string?, cframe: CFrame, parent: Instance, carried: boolean?): Model
	local star = Config.StarById[starId] or Config.StarById.sparky
	local rarity = Config.Rarities[star.rarity]
	local s = rarity.scale
	local model = Instance.new("Model")
	model.Name = "Star"

	-- лицо звезды должно смотреть вперёд: передняя грань детали — это -Z
	local bodyColor = BODY_COLOR[star.id] or star.color
	local rayColor = RAYS[star.id] or star.color:Lerp(WHITE, 0.15)
	if mut == "gold" then
		bodyColor = Config.GoldColor
		rayColor = Config.GoldColor
	end

	local body = ball(model, 2.7 * s, cframe, bodyColor, BODY_MATERIAL[star.id])
	body.Name = "Body"
	body.CastShadow = true
	if mut == "gold" then
		body.Reflectance = 0.25
	end
	local face = Instance.new("Decal")
	face.Name = "Face"
	face.Texture = FACE
	face.Face = Enum.NormalId.Front
	face.Parent = body

	local rays = StarVisuals.shape(model, cframe, 2.9 * s, 0.9 * s, rayColor, RAY_MATERIAL[star.id] or Enum.Material.Neon)
	if star.id == "frosty" then
		for _, ray in ipairs(rays) do
			ray.Transparency = 0.15
		end
	end

	local extra = EXTRAS[star.id]
	if extra then
		extra(model, cframe, s, rays)
	end

	if mut == "rainbow" then
		for _, ray in ipairs(rays) do
			CollectionService:AddTag(ray, "Rainbow")
		end
	end
	if rarity.order >= 4 then
		sparkles(body, mut == "gold" and Config.GoldColor or rarity.color, rarity.order >= 6 and 10 or 5)
	end
	if rarity.order >= 5 then
		local light = Instance.new("PointLight")
		light.Color = rarity.color
		light.Range = 12
		light.Brightness = 1.5
		light.Parent = body
	end

	model.PrimaryPart = body
	if carried then
		for _, item in ipairs(model:GetDescendants()) do
			if item:IsA("BasePart") then
				item.Massless = true
				if item ~= body then
					local weld = Instance.new("WeldConstraint")
					weld.Part0 = body
					weld.Part1 = item
					weld.Parent = item
				end
				item.Anchored = false
			end
		end
	end
	model:SetAttribute("Star", star.id)
	model:SetAttribute("Mut", mut or "")
	model.Parent = parent
	return model
end

return StarVisuals
