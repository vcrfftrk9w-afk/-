-- Питомцы: надеть/снять, бонусы и маленькие фигурки рядом с игроком.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Logic = require(Shared:WaitForChild("Logic"))

local Sessions = require(script.Parent.Sessions)

type Session = Sessions.Session

local Pets = {}

local onChanged: (Session) -> () = function() end
function Pets.setChangedHandler(fn: (Session) -> ())
	onChanged = fn
end

-- места вокруг игрока (относительно HumanoidRootPart)
local OFFSETS = {
	Vector3.new(-2.6, 1.4, 2.2),
	Vector3.new(2.6, 1.4, 2.2),
	Vector3.new(0, 3, 2.6),
	Vector3.new(-3.8, 0.2, 0.6),
	Vector3.new(3.8, 0.2, 0.6),
}

local BLACK = Color3.fromRGB(35, 30, 40)

local function petPart(model: Model, root: BasePart?, size: Vector3, offset: CFrame, color: Color3, shape: Enum.PartType?, material: Enum.Material?): Part
	local part = Instance.new("Part")
	part.Name = "Piece"
	part.Shape = shape or Enum.PartType.Block
	part.Size = size
	part.Color = color
	part.Material = material or Enum.Material.SmoothPlastic
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.CanCollide = false
	part.CanTouch = false
	part.CanQuery = false
	part.CastShadow = false
	part.Massless = true
	part.Anchored = false
	if root then
		part.CFrame = root.CFrame * offset
		local weld = Instance.new("WeldConstraint")
		weld.Part0 = root
		weld.Part1 = part
		weld.Parent = part
	end
	part.Parent = model
	return part
end

-- Собирает фигурку питомца. Перед — это -Z (туда же смотрит игрок).
local function buildPet(petId: string, at: CFrame): Model?
	local def = Config.Pets[petId]
	if not def then
		return nil
	end
	local model = Instance.new("Model")
	model.Name = "Pet_" .. petId

	local body = petPart(model, nil, Vector3.new(1.3, 1.1, 1.5), CFrame.new(), def.body)
	body.Name = "Body"
	body.CFrame = at
	model.PrimaryPart = body

	local head = petPart(model, body, Vector3.new(1.1, 1, 1), CFrame.new(0, 0.75, -0.55), def.body)
	-- глаза и носик
	petPart(model, body, Vector3.new(0.18, 0.22, 0.05), CFrame.new(-0.25, 0.85, -1.06), BLACK)
	petPart(model, body, Vector3.new(0.18, 0.22, 0.05), CFrame.new(0.25, 0.85, -1.06), BLACK)

	if def.ears == "long" then
		petPart(model, body, Vector3.new(0.22, 0.9, 0.3), CFrame.new(-0.25, 1.65, -0.5), def.body)
		petPart(model, body, Vector3.new(0.22, 0.9, 0.3), CFrame.new(0.25, 1.65, -0.5), def.body)
	elseif def.ears == "pointy" then
		petPart(model, body, Vector3.new(0.3, 0.4, 0.3), CFrame.new(-0.32, 1.38, -0.5) * CFrame.Angles(0, 0, math.rad(15)), def.body:Lerp(BLACK, 0.15))
		petPart(model, body, Vector3.new(0.3, 0.4, 0.3), CFrame.new(0.32, 1.38, -0.5) * CFrame.Angles(0, 0, math.rad(-15)), def.body:Lerp(BLACK, 0.15))
	elseif def.ears == "round" then
		petPart(model, body, Vector3.new(0.4, 0.4, 0.4), CFrame.new(-0.42, 1.32, -0.5), BLACK, Enum.PartType.Ball)
		petPart(model, body, Vector3.new(0.4, 0.4, 0.4), CFrame.new(0.42, 1.32, -0.5), BLACK, Enum.PartType.Ball)
	end

	if def.extra == "beak" then
		petPart(model, body, Vector3.new(0.3, 0.2, 0.3), CFrame.new(0, 0.65, -1.15), Color3.fromRGB(255, 150, 40))
	elseif def.extra == "mask" then
		petPart(model, body, Vector3.new(0.85, 0.3, 0.05), CFrame.new(0, 0.85, -1.04), BLACK)
		petPart(model, body, Vector3.new(0.18, 0.22, 0.05), CFrame.new(-0.25, 0.85, -1.08), Color3.new(1, 1, 1))
		petPart(model, body, Vector3.new(0.18, 0.22, 0.05), CFrame.new(0.25, 0.85, -1.08), Color3.new(1, 1, 1))
	elseif def.extra == "tail" then
		petPart(model, body, Vector3.new(0.4, 0.4, 1), CFrame.new(0, 0.2, 1.1) * CFrame.Angles(math.rad(30), 0, 0), def.body:Lerp(Color3.new(1, 1, 1), 0.4))
	elseif def.extra == "wings" then
		petPart(model, body, Vector3.new(1, 0.1, 0.6), CFrame.new(-0.9, 0.45, 0.1) * CFrame.Angles(0, 0, math.rad(25)), Color3.fromRGB(230, 240, 255), nil, Enum.Material.Glass)
		petPart(model, body, Vector3.new(1, 0.1, 0.6), CFrame.new(0.9, 0.45, 0.1) * CFrame.Angles(0, 0, math.rad(-25)), Color3.fromRGB(230, 240, 255), nil, Enum.Material.Glass)
	elseif def.extra == "horn" then
		petPart(model, body, Vector3.new(0.18, 0.6, 0.18), CFrame.new(0, 1.5, -0.75) * CFrame.Angles(math.rad(-20), 0, 0), Color3.fromRGB(255, 215, 90), nil, Enum.Material.Neon)
	end

	if def.extra == "flame" or def.extra == "sparkle" then
		local emitter = Instance.new("ParticleEmitter")
		emitter.LightEmission = 1
		emitter.Rate = def.extra == "flame" and 18 or 6
		emitter.Lifetime = NumberRange.new(0.5, 0.9)
		emitter.Speed = NumberRange.new(1, 2)
		emitter.Size = NumberSequence.new(0.45, 0)
		emitter.SpreadAngle = Vector2.new(30, 30)
		if def.extra == "flame" then
			emitter.Color = ColorSequence.new(Color3.fromRGB(255, 200, 60), Color3.fromRGB(255, 70, 30))
		else
			emitter.Color = ColorSequence.new(Color3.fromRGB(255, 160, 230), Color3.fromRGB(140, 220, 255))
			emitter.SpreadAngle = Vector2.new(180, 180)
		end
		emitter.Parent = head
	end
	return model
end

function Pets.attach(session: Session)
	local character = session.player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not character or not root or not root:IsA("BasePart") then
		return
	end
	local old = character:FindFirstChild("SweetPets")
	if old then
		old:Destroy()
	end
	local folder = Instance.new("Folder")
	folder.Name = "SweetPets"

	local byUid = {}
	for _, pet in ipairs(session.data.pets) do
		byUid[pet.u] = pet.id
	end
	for i, uid in ipairs(session.data.equipped) do
		local offset = OFFSETS[i]
		local petId = byUid[uid]
		if offset and petId then
			local model = buildPet(petId, root.CFrame * CFrame.new(offset))
			if model and model.PrimaryPart then
				local weld = Instance.new("Weld")
				weld.Part0 = root
				weld.Part1 = model.PrimaryPart
				weld.C0 = CFrame.new(offset)
				weld.Parent = model.PrimaryPart
				model.Parent = folder
			end
		end
	end
	folder.Parent = character
end

-- Проверяет список надетых питомцев и пересчитывает бонусы
function Pets.recompute(session: Session)
	local data = session.data
	local owned = {}
	for _, pet in ipairs(data.pets) do
		owned[pet.u] = true
	end
	local slots = Logic.petSlots(session.passes)
	local equipped = {}
	local seen = {}
	for _, uid in ipairs(data.equipped) do
		if owned[uid] and not seen[uid] and #equipped < slots then
			seen[uid] = true
			table.insert(equipped, uid)
		end
	end
	data.equipped = equipped
	session.bonus = Logic.petBonuses(data.pets, data.equipped)
end

local function changed(session: Session)
	Pets.recompute(session)
	Pets.attach(session)
	onChanged(session)
	Sessions.markDirty(session)
end
Pets.changed = changed

function Pets.equip(session: Session, uid: any, on: any)
	if type(uid) ~= "string" then
		return
	end
	local data = session.data
	local exists = false
	for _, pet in ipairs(data.pets) do
		if pet.u == uid then
			exists = true
		end
	end
	if not exists then
		return
	end
	local index = table.find(data.equipped, uid)
	if on == true then
		if index then
			return
		end
		if #data.equipped >= Logic.petSlots(session.passes) then
			Sessions.notify(session, "n_pet_slots")
			return
		end
		table.insert(data.equipped, uid)
	else
		if not index then
			return
		end
		table.remove(data.equipped, index)
	end
	changed(session)
end

function Pets.delete(session: Session, uid: any)
	if type(uid) ~= "string" then
		return
	end
	local data = session.data
	for i, pet in ipairs(data.pets) do
		if pet.u == uid then
			table.remove(data.pets, i)
			local index = table.find(data.equipped, uid)
			if index then
				table.remove(data.equipped, index)
			end
			changed(session)
			return
		end
	end
end

-- Новый питомец из яйца. Возвращает его id.
function Pets.add(session: Session, petId: string): string
	local data = session.data
	local uid = tostring(data.nextPetId)
	data.nextPetId += 1
	table.insert(data.pets, { u = uid, id = petId })
	if #data.equipped < Logic.petSlots(session.passes) then
		table.insert(data.equipped, uid)
	end
	changed(session)
	return uid
end

return Pets
