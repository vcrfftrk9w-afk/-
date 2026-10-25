-- Модели юнитов и построек.
-- Берёт модели из ReplicatedStorage.FrontModels (импорт FBX из Blender через 3D Importer).
-- Если модели там нет, собирает простую замену из блоков, чтобы игра работала сразу.
-- Детали красятся по началу имени: Team — цвет страны, Metal, Dark, Hazard, Glass, Light.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Models = {}

local PALETTE = {
	Metal = { Color3.fromRGB(160, 164, 170), Enum.Material.Metal },
	Dark = { Color3.fromRGB(42, 45, 50), Enum.Material.Metal },
	Hazard = { Color3.fromRGB(240, 160, 30), Enum.Material.SmoothPlastic },
	Glass = { Color3.fromRGB(110, 195, 220), Enum.Material.Glass },
	Light = { Color3.fromRGB(255, 220, 120), Enum.Material.Neon },
}

local function prefixOf(name)
	for _, p in ipairs({ "Team", "Metal", "Dark", "Hazard", "Glass", "Light" }) do
		if string.sub(name, 1, #p) == p then
			return p
		end
	end
	return nil
end

function Models.paint(model, teamColor)
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BasePart") then
			local p = prefixOf(d.Name)
			if p == "Team" then
				d.Color = teamColor
				d.Material = Enum.Material.SmoothPlastic
			elseif p then
				d.Color = PALETTE[p][1]
				d.Material = PALETTE[p][2]
			end
			if d:IsA("MeshPart") then
				local sa = d:FindFirstChildOfClass("SurfaceAppearance")
				if sa and p then
					sa:Destroy()
				end
			end
		end
	end
end

-- ------------------------------------------------------------ запасные модели из блоков
-- нос юнитов смотрит в -Z (LookVector), низ модели на y = 0

local function block(model, name, size, pos, shape)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.CFrame = CFrame.new(pos)
	if shape == "cyl" then
		p.Shape = Enum.PartType.Cylinder
	elseif shape == "ball" then
		p.Shape = Enum.PartType.Ball
	end
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = model
	return p
end

local function rotated(part, cf)
	part.CFrame = cf
	return part
end

local FALLBACK = {}

function FALLBACK.Tank(m)
	block(m, "Dark", Vector3.new(0.35, 0.45, 1.7), Vector3.new(-0.55, 0.22, 0))
	block(m, "Dark", Vector3.new(0.35, 0.45, 1.7), Vector3.new(0.55, 0.22, 0))
	block(m, "Team", Vector3.new(1.0, 0.35, 1.5), Vector3.new(0, 0.6, 0))
	block(m, "Team", Vector3.new(0.65, 0.3, 0.75), Vector3.new(0, 0.92, 0.1))
	rotated(block(m, "Metal", Vector3.new(1.1, 0.13, 0.13), Vector3.zero, "cyl"), CFrame.new(0, 0.92, -0.7) * CFrame.Angles(0, math.rad(90), 0))
end

function FALLBACK.City(m)
	block(m, "Dark", Vector3.new(3.4, 0.16, 3.4), Vector3.new(0, 0.08, 0))
	for _, t in ipairs({ { -0.8, -0.7, 0.9, 1.9 }, { 0.7, -0.6, 0.8, 1.3 }, { -0.6, 0.8, 0.9, 1.1 }, { 0.8, 0.8, 0.7, 2.4 } }) do
		local x, z, w, h = t[1], t[2], t[3], t[4]
		block(m, "Metal", Vector3.new(w, h, w), Vector3.new(x, 0.16 + h / 2, z))
		block(m, "Team", Vector3.new(w + 0.08, 0.12, w + 0.08), Vector3.new(x, 0.22 + h, z))
		block(m, "Glass", Vector3.new(w * 0.7, h * 0.7, 0.04), Vector3.new(x, 0.16 + h / 2, z - w / 2))
	end
	block(m, "Light", Vector3.new(0.1, 0.1, 0.1), Vector3.new(0.8, 2.9, 0.8))
end

function FALLBACK.Port(m)
	block(m, "Dark", Vector3.new(3.4, 0.24, 3.4), Vector3.new(0, 0.12, 0))
	block(m, "Metal", Vector3.new(3.4, 0.08, 0.8), Vector3.new(0, 0.28, -1.3))
	block(m, "Team", Vector3.new(1.6, 1.0, 1.6), Vector3.new(-0.7, 0.75, 0.6))
	block(m, "Hazard", Vector3.new(0.18, 2.4, 0.18), Vector3.new(0.9, 1.4, -0.2))
	block(m, "Hazard", Vector3.new(0.16, 0.16, 1.6), Vector3.new(0.9, 2.55, -0.85))
	block(m, "Team", Vector3.new(0.9, 0.34, 0.42), Vector3.new(1.1, 0.42, 0.9))
	block(m, "Hazard", Vector3.new(0.9, 0.34, 0.42), Vector3.new(1.1, 0.78, 0.9))
end

function FALLBACK.Defense(m)
	block(m, "Dark", Vector3.new(2.4, 0.7, 2.4), Vector3.new(0, 0.35, 0))
	block(m, "Hazard", Vector3.new(2.0, 0.06, 2.0), Vector3.new(0, 0.72, 0))
	rotated(block(m, "Team", Vector3.new(0.55, 1.5, 1.5), Vector3.zero, "cyl"), CFrame.new(0, 1.0, 0) * CFrame.Angles(0, 0, math.rad(90)))
	for _, x in ipairs({ -0.22, 0.22 }) do
		rotated(block(m, "Metal", Vector3.new(1.3, 0.16, 0.16), Vector3.zero, "cyl"), CFrame.new(x, 1.05, -0.95) * CFrame.Angles(0, math.rad(90), 0))
	end
end

function FALLBACK.Factory(m)
	block(m, "Dark", Vector3.new(3.4, 0.2, 3.4), Vector3.new(0, 0.1, 0))
	block(m, "Metal", Vector3.new(2.8, 1.3, 2.4), Vector3.new(0, 0.85, 0.2))
	for i = 0, 3 do
		rotated(block(m, "Team", Vector3.new(0.5, 0.5, 2.4), Vector3.zero), CFrame.new(-1.05 + i * 0.7, 1.55, 0.2) * CFrame.Angles(0, 0, math.rad(45)))
	end
	block(m, "Hazard", Vector3.new(1.4, 0.8, 0.06), Vector3.new(0, 0.6, -1.0))
	block(m, "Metal", Vector3.new(0.4, 2.0, 0.4), Vector3.new(1.1, 1.7, 1.0))
	block(m, "Light", Vector3.new(0.12, 0.1, 0.12), Vector3.new(1.1, 2.75, 1.0))
end

function FALLBACK.Silo(m)
	block(m, "Dark", Vector3.new(3.2, 0.4, 3.2), Vector3.new(0, 0.2, 0))
	rotated(block(m, "Hazard", Vector3.new(0.1, 2.6, 2.6), Vector3.zero, "cyl"), CFrame.new(0, 0.45, 0) * CFrame.Angles(0, 0, math.rad(90)))
	rotated(block(m, "Metal", Vector3.new(0.2, 2.2, 2.2), Vector3.zero, "cyl"), CFrame.new(0, 0.55, 0) * CFrame.Angles(0, 0, math.rad(90)))
	for _, c in ipairs({ { -1.35, -1.35 }, { 1.35, -1.35 }, { -1.35, 1.35 }, { 1.35, 1.35 } }) do
		block(m, "Team", Vector3.new(0.4, 0.5, 0.4), Vector3.new(c[1], 0.65, c[2]))
	end
end

function FALLBACK.Nuke(m)
	rotated(block(m, "Metal", Vector3.new(2.2, 0.44, 0.44), Vector3.zero, "cyl"), CFrame.new(0, 0.22, 0) * CFrame.Angles(0, math.rad(90), 0))
	block(m, "Light", Vector3.new(0.4, 0.4, 0.4), Vector3.new(0, 0.22, -1.2), "ball")
	block(m, "Team", Vector3.new(0.9, 0.05, 0.4), Vector3.new(0, 0.22, 0.9))
	block(m, "Team", Vector3.new(0.05, 0.9, 0.4), Vector3.new(0, 0.22, 0.9))
end

function FALLBACK.TransportShip(m)
	block(m, "Team", Vector3.new(1.1, 0.5, 2.6), Vector3.new(0, 0.25, 0))
	rotated(block(m, "Team", Vector3.new(0.78, 0.5, 0.78), Vector3.zero), CFrame.new(0, 0.25, -1.3) * CFrame.Angles(0, math.rad(45), 0))
	block(m, "Hazard", Vector3.new(0.9, 0.3, 0.08), Vector3.new(0, 0.5, -1.25))
	block(m, "Metal", Vector3.new(0.7, 0.6, 0.6), Vector3.new(0, 0.85, 0.85))
	block(m, "Light", Vector3.new(0.08, 0.08, 0.08), Vector3.new(0, 1.5, 1.05))
end

function FALLBACK.TradeShip(m)
	block(m, "Dark", Vector3.new(1.2, 0.6, 3.2), Vector3.new(0, 0.3, 0))
	rotated(block(m, "Dark", Vector3.new(0.85, 0.6, 0.85), Vector3.zero), CFrame.new(0, 0.3, -1.6) * CFrame.Angles(0, math.rad(45), 0))
	for i = 0, 5 do
		local x = i % 2 == 0 and -0.27 or 0.27
		local z = -0.9 + (i // 2) * 0.62
		block(m, i % 3 == 1 and "Hazard" or "Team", Vector3.new(0.5, 0.44, 0.56), Vector3.new(x, 0.86, z))
	end
	block(m, "Metal", Vector3.new(0.9, 0.8, 0.5), Vector3.new(0, 1.0, 1.25))
end

-- ------------------------------------------------------------ сборка

local cache = {}

local function source(kind)
	if cache[kind] ~= nil then
		return cache[kind]
	end
	local folder = ReplicatedStorage:FindFirstChild("FrontModels")
	local found = folder and folder:FindFirstChild(kind, true)
	if found and found:IsA("BasePart") then
		local m = Instance.new("Model")
		m.Name = kind
		found:Clone().Parent = m
		found = m
	elseif found and not found:IsA("Model") then
		found = nil
	end
	if not found then
		local m = Instance.new("Model")
		m.Name = kind
		local build = FALLBACK[kind]
		if build then
			build(m)
		else
			block(m, "Team", Vector3.new(1, 1, 1), Vector3.new(0, 0.5, 0))
		end
		found = m
	end
	cache[kind] = found
	return found
end

-- копия модели: закреплена, без столкновений и без попадания лучей,
-- уменьшена так, чтобы её ширина по земле была size стадов, точка опоры — центр низа
function Models.make(kind, teamColor, size)
	local m = source(kind):Clone()
	for _, d in ipairs(m:GetDescendants()) do
		if d:IsA("BasePart") then
			d.Anchored = true
			d.CanCollide = false
			d.CanQuery = false
			d.CanTouch = false
			d.CastShadow = false
		end
	end
	Models.paint(m, teamColor)
	local cf, ext = m:GetBoundingBox()
	local span = math.max(ext.X, ext.Z, 0.01)
	m:ScaleTo(m:GetScale() * size / span)
	cf, ext = m:GetBoundingBox()
	m.WorldPivot = CFrame.new(cf.Position - Vector3.new(0, ext.Y / 2, 0))
	return m
end

return Models
