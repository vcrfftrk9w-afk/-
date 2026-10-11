-- Мир глазами игрока: переводы табличек, подсказки на пьедесталах и звёздах,
-- полёт метеоров, БОНК, дверь своей базы, метеоритный дождь, стрелка обучения.

local CollectionService = game:GetService("CollectionService")
local Lighting = game:GetService("Lighting")
local ProximityPromptService = game:GetService("ProximityPromptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

local Ctx = require(script.Parent.Context)

local Config = Ctx.Config
local Logic = Ctx.Logic
local T = Ctx.T

local Effects = {}

local FONT = Enum.Font.FredokaOne
local WHITE = Color3.new(1, 1, 1)

local localFolder: Folder

local function mapRoot(): Instance?
	return workspace:FindFirstChild("Starfall")
end

local function baseModel(index: number): Instance?
	local map = mapRoot()
	local bases = map and map:FindFirstChild("Bases")
	return bases and bases:FindFirstChild("Base" .. index)
end

local function character(): (Model?, BasePart?, Humanoid?)
	local model = Ctx.player.Character
	if not model then
		return nil, nil, nil
	end
	local root = model:FindFirstChild("HumanoidRootPart")
	local humanoid = model:FindFirstChildOfClass("Humanoid")
	return model, (root and root:IsA("BasePart")) and root or nil, humanoid
end

local function attrString(instance: Instance, name: string): string
	local value = instance:GetAttribute(name)
	return type(value) == "string" and value or ""
end

local function cameraPosition(): Vector3
	local camera = workspace.CurrentCamera
	return camera and camera.CFrame.Position or Vector3.zero
end

local function effectPart(name: string, size: Vector3, cframe: CFrame, color: Color3, shape: Enum.PartType?): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.CastShadow = false
	part.Material = Enum.Material.Neon
	part.Color = color
	if shape then
		part.Shape = shape
	end
	part.Size = size
	part.CFrame = cframe
	part.Parent = localFolder
	return part
end

local function billboard(parent: Instance, size: UDim2, offset: Vector3, maxDistance: number): BillboardGui
	local gui = Instance.new("BillboardGui")
	gui.Size = size
	gui.StudsOffset = offset
	gui.MaxDistance = maxDistance
	gui.LightInfluence = 0
	gui.Parent = parent
	return gui
end

local function textLabel(parent: Instance, size: UDim2, position: UDim2, color: Color3): TextLabel
	local label = Instance.new("TextLabel")
	label.Size = size
	label.Position = position
	label.BackgroundTransparency = 1
	label.Font = FONT
	label.TextScaled = true
	label.TextColor3 = color
	label.TextStrokeTransparency = 0.1
	label.TextStrokeColor3 = Color3.fromRGB(20, 15, 40)
	label.Text = ""
	label.Parent = parent
	return label
end

local sounds: { [string]: Sound } = {}
local function playSound(name: string)
	local sound = sounds[name]
	if sound then
		sound:Play()
	end
end

local function setupSounds()
	for name, info in pairs({
		bonk = { "rbxasset://sounds/swordlunge.wav", 0.6 },
		ping = { "rbxasset://sounds/electronicpingshort.wav", 0.45 },
	}) do
		local sound = Instance.new("Sound")
		sound.Name = "Starfall_" .. name
		sound.SoundId = info[1]
		sound.Volume = info[2]
		sound.Parent = SoundService
		sounds[name] = sound
	end
end

---------------------------------------------------------------------
-- Переводы табличек и подсказок
---------------------------------------------------------------------

local function applyLabel(label: TextLabel)
	local key = label:GetAttribute("TKey")
	if type(key) ~= "string" or key == "" then
		return
	end
	local raw = label:GetAttribute("TArg")
	local args = {}
	if type(raw) == "string" and raw ~= "" then
		for arg in string.gmatch(raw, "[^|]+") do
			table.insert(args, Ctx.translateArg(arg))
		end
	end
	local text = T(key, table.unpack(args))
	if label.Text ~= text then
		label.Text = text
	end
end

local function watchLabel(instance: Instance)
	if not instance:IsA("TextLabel") then
		return
	end
	local label = instance
	applyLabel(label)
	label:GetAttributeChangedSignal("TKey"):Connect(function()
		applyLabel(label)
	end)
	label:GetAttributeChangedSignal("TArg"):Connect(function()
		applyLabel(label)
	end)
	label:GetPropertyChangedSignal("Text"):Connect(function()
		applyLabel(label)
	end)
end

local function watchPrompt(instance: Instance)
	if not instance:IsA("ProximityPrompt") then
		return
	end
	local kind = instance:GetAttribute("Kind")
	if kind == "pedestal" then
		return
	elseif kind == "grab" then
		-- подсказка на звезде: название берём у модели звезды
		local model = instance:FindFirstAncestorOfClass("Model")
		local starId = model and attrString(model, "Star") or ""
		if Config.StarById[starId] then
			instance.ActionText = T("pr_grab")
			instance.ObjectText = Ctx.starLabel(starId, attrString(model :: Model, "Mut"))
		end
		return
	end
	local actionKey = instance:GetAttribute("AKey")
	local objectKey = instance:GetAttribute("OKey")
	if type(actionKey) == "string" and actionKey ~= "" then
		instance.ActionText = T(actionKey)
	end
	if type(objectKey) == "string" and objectKey ~= "" then
		instance.ObjectText = T(objectKey)
	end
end

local function setupLocalization()
	for _, label in ipairs(CollectionService:GetTagged("Loc")) do
		watchLabel(label)
	end
	CollectionService:GetInstanceAddedSignal("Loc"):Connect(watchLabel)
	for _, prompt in ipairs(CollectionService:GetTagged("LocPrompt")) do
		watchPrompt(prompt)
	end
	CollectionService:GetInstanceAddedSignal("LocPrompt"):Connect(watchPrompt)
end

---------------------------------------------------------------------
-- Пьедесталы: подписи над звёздами и что делает подсказка (продать / украсть)
---------------------------------------------------------------------

type PedestalInfo = {
	part: BasePart,
	prompt: ProximityPrompt?,
	base: Instance?,
	gui: BillboardGui?,
	name: TextLabel?,
	income: TextLabel?,
}

local pedestals: { [BasePart]: PedestalInfo } = {}
local promptModes: { [ProximityPrompt]: string } = {}

local function setIfChanged(prompt: ProximityPrompt, action: string, object: string, hold: number)
	if prompt.ActionText ~= action then
		prompt.ActionText = action
	end
	if prompt.ObjectText ~= object then
		prompt.ObjectText = object
	end
	if prompt.HoldDuration ~= hold then
		prompt.HoldDuration = hold
	end
end

local function updatePedestal(info: PedestalInfo)
	local part = info.part
	local starId = attrString(part, "Star")
	local mut = attrString(part, "Mut")
	local hasStar = Config.StarById[starId] ~= nil
	local model = info.base
	local ownerId = model and model:GetAttribute("OwnerId") or 0
	local lockedUntil = model and model:GetAttribute("LockedUntil") or 0
	local mine = ownerId == Ctx.player.UserId
	local state = Ctx.state
	local carrying = state and state.carrying ~= nil

	local mode: string? = nil
	local prompt = info.prompt
	if prompt and hasStar then
		local label = Ctx.starLabel(starId, mut)
		if mine then
			mode = "sell"
			setIfChanged(prompt, T("pr_sell", Logic.format(Logic.sellValue(starId, mut))), label, Config.SellHold)
		elseif ownerId ~= 0 and lockedUntil <= Ctx.serverNow() and not carrying then
			mode = "steal"
			setIfChanged(prompt, T("pr_steal"), label, Config.Steal.hold)
		end
	end
	if prompt then
		if mode then
			promptModes[prompt] = mode
		else
			promptModes[prompt] = nil
		end
		if prompt.Enabled ~= (mode ~= nil) then
			prompt.Enabled = mode ~= nil
		end
	end

	if hasStar then
		if not info.gui then
			local gui = billboard(part, UDim2.new(9, 0, 2.4, 0), Vector3.new(0, 7.2, 0), 60)
			gui.Name = "StarLabel"
			info.gui = gui
			info.name = textLabel(gui, UDim2.fromScale(1, 0.55), UDim2.fromScale(0, 0), WHITE)
			info.income = textLabel(gui, UDim2.fromScale(1, 0.45), UDim2.fromScale(0, 0.55), Color3.fromRGB(130, 255, 150))
		end
		local gui = info.gui :: BillboardGui
		gui.Enabled = true
		local nameLabel = info.name :: TextLabel
		nameLabel.Text = Ctx.starLabel(starId, mut)
		nameLabel.TextColor3 = Ctx.starColor(starId)
		local income = part:GetAttribute("Income")
		;(info.income :: TextLabel).Text = Ctx.incomeText(type(income) == "number" and income or 0)
	elseif info.gui then
		info.gui.Enabled = false
	end
end

local function refreshPedestals()
	for _, info in pairs(pedestals) do
		updatePedestal(info)
	end
end

local function watchPedestal(instance: Instance)
	if not instance:IsA("BasePart") or pedestals[instance] then
		return
	end
	local part = instance
	local point = part:FindFirstChild("PromptPoint")
	local prompt = point and point:FindFirstChildOfClass("ProximityPrompt")
	local index = part:GetAttribute("Base")
	local info: PedestalInfo = {
		part = part,
		prompt = prompt,
		base = type(index) == "number" and baseModel(index) or nil,
	}
	pedestals[part] = info
	for _, attribute in ipairs({ "Star", "Mut", "Income" }) do
		part:GetAttributeChangedSignal(attribute):Connect(function()
			updatePedestal(info)
		end)
	end
	updatePedestal(info)
end

---------------------------------------------------------------------
-- Звёзды на поле: вращение, подпись, таймер
---------------------------------------------------------------------

type FieldInfo = { model: Model, pivot: CFrame, phase: number, timer: TextLabel? }
local fieldStars: { [Model]: FieldInfo } = {}

local function burst(position: Vector3, color: Color3, size: number)
	if (position - cameraPosition()).Magnitude > 260 then
		return
	end
	local ring = effectPart("Burst", Vector3.new(0.3, 2, 2), CFrame.new(position) * CFrame.Angles(0, 0, math.rad(90)), color, Enum.PartType.Cylinder)
	ring.Transparency = 0.2
	TweenService:Create(ring, TweenInfo.new(0.5, Enum.EasingStyle.Quad), { Size = Vector3.new(0.3, size, size), Transparency = 1 }):Play()
	Debris:AddItem(ring, 0.6)
end

local function setupFieldStar(instance: Instance)
	if not instance:IsA("Model") or fieldStars[instance] then
		return
	end
	local model = instance
	local body = model.PrimaryPart or model:FindFirstChild("Body")
	if not body or not body:IsA("BasePart") then
		return
	end
	local starId = attrString(model, "Star")
	local mut = attrString(model, "Mut")
	if not Config.StarById[starId] then
		return
	end
	local info: FieldInfo = { model = model, pivot = model:GetPivot(), phase = math.random() * 6 }
	fieldStars[model] = info

	local prompt = body:FindFirstChildOfClass("ProximityPrompt")
	if prompt then
		prompt.ActionText = T("pr_grab")
		prompt.ObjectText = Ctx.starLabel(starId, mut)
	end

	local gui = billboard(body, UDim2.new(10, 0, 3.4, 0), Vector3.new(0, 4.6, 0), 140)
	gui.Name = "FieldLabel"
	local name = textLabel(gui, UDim2.fromScale(1, 0.4), UDim2.fromScale(0, 0), Ctx.starColor(starId))
	name.Text = Ctx.starLabel(starId, mut)
	local star = Config.StarById[starId]
	local details = textLabel(gui, UDim2.fromScale(1, 0.3), UDim2.fromScale(0, 0.4), WHITE)
	details.Text = T("rar_" .. star.rarity) .. " · " .. Ctx.incomeText(Logic.baseIncome(starId, mut))
	info.timer = textLabel(gui, UDim2.fromScale(1, 0.3), UDim2.fromScale(0, 0.7), Color3.fromRGB(255, 230, 150))

	burst(body.Position - Vector3.new(0, 2.5, 0), Ctx.starColor(starId), 18)
	model.Destroying:Connect(function()
		fieldStars[model] = nil
	end)
end

local function updateFieldTimers()
	local now = Ctx.serverNow()
	for model, info in pairs(fieldStars) do
		if not model.Parent then
			fieldStars[model] = nil
		elseif info.timer then
			local expires = model:GetAttribute("Expires")
			if type(expires) == "number" then
				info.timer.Text = "⏳ " .. tostring(math.max(0, math.ceil(expires - now)))
			end
		end
	end
end

local function spinFieldStars()
	local t = os.clock()
	local camera = cameraPosition()
	for model, info in pairs(fieldStars) do
		local position = info.pivot.Position
		if (position - camera).Magnitude < 170 then
			model:PivotTo(info.pivot * CFrame.Angles(0, t * 1.6 + info.phase, 0) + Vector3.new(0, math.sin(t * 2.5 + info.phase) * 0.35, 0))
		end
	end
end

---------------------------------------------------------------------
-- Звёзды в руках у других игроков
---------------------------------------------------------------------

local function setupCarried(instance: Instance)
	if not instance:IsA("Model") then
		return
	end
	local body = instance.PrimaryPart or instance:FindFirstChild("Body")
	if not body or not body:IsA("BasePart") then
		return
	end
	if instance.Parent == Ctx.player.Character then
		return
	end
	local starId = attrString(instance, "Star")
	if not Config.StarById[starId] then
		return
	end
	local gui = billboard(body, UDim2.new(9, 0, 1.6, 0), Vector3.new(0, 3.2, 0), 120)
	gui.Name = "CarryLabel"
	local label = textLabel(gui, UDim2.fromScale(1, 1), UDim2.fromScale(0, 0), Ctx.starColor(starId))
	local text = Ctx.starLabel(starId, attrString(instance, "Mut"))
	if instance:GetAttribute("Stolen") == true then
		text = "🦹 " .. text
		label.TextColor3 = Color3.fromRGB(255, 120, 140)
	end
	label.Text = text
end

---------------------------------------------------------------------
-- Метеоры: звезда летит к лучу на поле
---------------------------------------------------------------------

local function setupMarker(instance: Instance)
	if not instance:IsA("BasePart") then
		return
	end
	local marker = instance
	local starId = attrString(marker, "Star")
	local landsAt = marker:GetAttribute("LandsAt")
	if not Config.StarById[starId] or type(landsAt) ~= "number" then
		return
	end
	local mut = attrString(marker, "Mut")
	local color = Ctx.starColor(starId)
	local target = marker.Position + Vector3.new(0, 3, 0)

	local column = effectPart("Column", Vector3.new(260, 1.6, 1.6), CFrame.new(target + Vector3.new(0, 128, 0)) * CFrame.Angles(0, 0, math.rad(90)), color, Enum.PartType.Cylinder)
	column.Transparency = 0.55

	local gui = billboard(column, UDim2.new(14, 0, 2, 0), Vector3.new(0, -118, 0), 320)
	gui.AlwaysOnTop = true
	local name = textLabel(gui, UDim2.fromScale(1, 1), UDim2.fromScale(0, 0), color)
	name.Text = "⬇ " .. Ctx.starLabel(starId, mut)

	local angle = math.random() * math.pi * 2
	local start = target + Vector3.new(math.cos(angle) * 150, 280, math.sin(angle) * 150)
	local meteor = effectPart("Meteor", Vector3.new(3, 3, 3), CFrame.new(start), color, Enum.PartType.Ball)
	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(1.4, 0, 0)
	a0.Parent = meteor
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(-1.4, 0, 0)
	a1.Parent = meteor
	local trail = Instance.new("Trail")
	trail.Attachment0 = a0
	trail.Attachment1 = a1
	trail.Color = ColorSequence.new(color, WHITE)
	trail.Transparency = NumberSequence.new(0, 1)
	trail.Lifetime = 0.5
	trail.LightEmission = 1
	trail.FaceCamera = true
	trail.Parent = meteor

	local startClock = os.clock()
	local duration = math.max(0.3, landsAt - Ctx.serverNow())
	local connection: RBXScriptConnection
	local function finish()
		if connection then
			connection:Disconnect()
		end
		meteor:Destroy()
		column:Destroy()
	end
	connection = RunService.Heartbeat:Connect(function()
		local t = math.clamp((os.clock() - startClock) / duration, 0, 1)
		meteor.Position = start:Lerp(target, t * t)
		if t >= 1 then
			finish()
			burst(target - Vector3.new(0, 2.6, 0), color, 22)
		end
	end)
	marker.Destroying:Connect(function()
		task.delay(0.2, function()
			if meteor.Parent then
				finish()
			end
		end)
	end)
end

---------------------------------------------------------------------
-- БОНК
---------------------------------------------------------------------

-- Меня бонкнули: отлетаю и кувыркаюсь
function Effects.bonked(payload)
	local _, root, humanoid = character()
	if not root or not humanoid then
		return
	end
	local direction = typeof(payload.d) == "Vector3" and payload.d or Vector3.zero
	local power = type(payload.p) == "number" and payload.p or 60
	humanoid.PlatformStand = true
	root.AssemblyLinearVelocity = direction * power + Vector3.new(0, power * 0.45, 0)
	root.AssemblyAngularVelocity = Vector3.new(math.random(-8, 8), math.random(-4, 4), math.random(-8, 8))
	task.delay(Config.Bonk.stun * 0.85, function()
		if humanoid.Parent then
			humanoid.PlatformStand = false
		end
	end)
end

function Effects.bonkfx(position: Vector3)
	if (position - cameraPosition()).Magnitude > 200 then
		return
	end
	local anchor = effectPart("Bonk", Vector3.new(0.2, 0.2, 0.2), CFrame.new(position + Vector3.new(0, 2, 0)), WHITE)
	anchor.Transparency = 1
	local gui = billboard(anchor, UDim2.new(8, 0, 3, 0), Vector3.new(0, 1, 0), 200)
	gui.AlwaysOnTop = true
	local label = textLabel(gui, UDim2.fromScale(1, 1), UDim2.fromScale(0, 0), Color3.fromRGB(255, 230, 80))
	label.Text = T("bonk_word")
	label.Rotation = math.random(-12, 12)
	TweenService:Create(gui, TweenInfo.new(0.9, Enum.EasingStyle.Quad), { StudsOffset = Vector3.new(0, 4, 0) }):Play()
	TweenService:Create(label, TweenInfo.new(0.9), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	Debris:AddItem(anchor, 1)
	burst(position - Vector3.new(0, 2.5, 0), Color3.fromRGB(255, 220, 90), 14)
	playSound("bonk")
end

function Effects.swing(payload)
	local position = payload.p
	local direction = payload.d
	if typeof(position) ~= "Vector3" or typeof(direction) ~= "Vector3" then
		return
	end
	if (position - cameraPosition()).Magnitude > 160 then
		return
	end
	local size = payload.super and 9 or 6
	local color = payload.super and Color3.fromRGB(255, 210, 80) or Color3.fromRGB(255, 255, 255)
	local puff = effectPart("Swing", Vector3.new(1.5, 1.5, 1.5), CFrame.new(position + direction * 3.5), color, Enum.PartType.Ball)
	puff.Transparency = 0.4
	TweenService:Create(puff, TweenInfo.new(0.25, Enum.EasingStyle.Quad), { Size = Vector3.new(size, size, size), Transparency = 1 }):Play()
	Debris:AddItem(puff, 0.3)
end

-- Звезда на базе: салют вокруг игрока
function Effects.celebrate(color: Color3)
	local _, root = character()
	if not root then
		return
	end
	local anchor = effectPart("Celebrate", Vector3.new(0.2, 0.2, 0.2), CFrame.new(root.Position), color)
	anchor.Transparency = 1
	local emitter = Instance.new("ParticleEmitter")
	emitter.Color = ColorSequence.new(color, WHITE)
	emitter.LightEmission = 1
	emitter.Size = NumberSequence.new(0.5, 0)
	emitter.Lifetime = NumberRange.new(0.8, 1.2)
	emitter.Speed = NumberRange.new(12, 20)
	emitter.SpreadAngle = Vector2.new(180, 180)
	emitter.Rate = 0
	emitter.Parent = anchor
	emitter:Emit(40)
	Debris:AddItem(anchor, 1.5)
	playSound("ping")
end

function Effects.ping()
	playSound("ping")
end

---------------------------------------------------------------------
-- Базы: своя дверь пропускает хозяина, таймеры замков, копилка
---------------------------------------------------------------------

local myBaseIndex = 0
local doorConnection: RBXScriptConnection? = nil
local bankLabel: TextLabel? = nil
local lockLabels: { [Instance]: TextLabel } = {}

local function setupOwnBase(index: number)
	if index == myBaseIndex then
		return
	end
	myBaseIndex = index
	if doorConnection then
		doorConnection:Disconnect()
		doorConnection = nil
	end
	if bankLabel then
		local old = bankLabel.Parent
		if old then
			old:Destroy()
		end
		bankLabel = nil
	end
	local model = index > 0 and baseModel(index) or nil
	if not model then
		return
	end
	local door = model:FindFirstChild("Door")
	if door and door:IsA("BasePart") then
		door.CanCollide = false
		doorConnection = door:GetPropertyChangedSignal("CanCollide"):Connect(function()
			if door.CanCollide then
				door.CanCollide = false
			end
		end)
	end
	local pad = model:FindFirstChild("CollectPad")
	if pad and pad:IsA("BasePart") then
		local gui = billboard(pad, UDim2.new(10, 0, 2.4, 0), Vector3.new(0, 5.6, 0), 120)
		gui.Name = "BankLabel"
		bankLabel = textLabel(gui, UDim2.fromScale(1, 1), UDim2.fromScale(0, 0), Color3.fromRGB(150, 255, 170))
	end
end

local function updateBases()
	local map = mapRoot()
	local bases = map and map:FindFirstChild("Bases")
	if not bases then
		return
	end
	local now = Ctx.serverNow()
	for _, model in ipairs(bases:GetChildren()) do
		local door = model:FindFirstChild("Door")
		if door and door:IsA("BasePart") then
			local label = lockLabels[model]
			if not label then
				local gui = billboard(door, UDim2.new(8, 0, 2.2, 0), Vector3.new(0, -2, -1), 90)
				gui.Name = "LockTimer"
				label = textLabel(gui, UDim2.fromScale(1, 1), UDim2.fromScale(0, 0), Color3.fromRGB(255, 150, 160))
				lockLabels[model] = label
			end
			local lockedUntil = model:GetAttribute("LockedUntil")
			local left = type(lockedUntil) == "number" and lockedUntil - now or 0
			label.Text = left > 0 and ("🔒 " .. Logic.formatTime(left)) or ""
		end
	end
	if bankLabel then
		local model = baseModel(myBaseIndex)
		local bank = model and model:GetAttribute("Bank") or 0
		bankLabel.Text = "🏦 " .. Logic.format(type(bank) == "number" and bank or 0)
	end
end

---------------------------------------------------------------------
-- Метеоритный дождь и падающие звёзды в небе
---------------------------------------------------------------------

local showerOn = false
local normalSky = {
	OutdoorAmbient = Lighting.OutdoorAmbient,
	Ambient = Lighting.Ambient,
}

local function shootingStar(fast: boolean)
	local camera = cameraPosition()
	local angle = math.random() * math.pi * 2
	local from = camera + Vector3.new(math.cos(angle) * 260, 190 + math.random() * 80, math.sin(angle) * 260)
	local to = from + Vector3.new(-math.cos(angle) * 220, -120, -math.sin(angle) * 220) + Vector3.new(math.random(-60, 60), 0, math.random(-60, 60))
	local streak = effectPart("ShootingStar", Vector3.new(1.4, 1.4, 1.4), CFrame.new(from), Color3.fromRGB(255, 240, 200), Enum.PartType.Ball)
	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0.6, 0, 0)
	a0.Parent = streak
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(-0.6, 0, 0)
	a1.Parent = streak
	local trail = Instance.new("Trail")
	trail.Attachment0 = a0
	trail.Attachment1 = a1
	trail.Transparency = NumberSequence.new(0, 1)
	trail.Lifetime = 0.6
	trail.LightEmission = 1
	trail.FaceCamera = true
	trail.Parent = streak
	local tween = TweenService:Create(streak, TweenInfo.new(fast and 0.8 or 1.3, Enum.EasingStyle.Linear), { Position = to })
	tween:Play()
	Debris:AddItem(streak, 2)
end

local function updateShower()
	local ends = ReplicatedStorage:GetAttribute("ShowerEnds")
	local active = type(ends) == "number" and ends > Ctx.serverNow()
	if active == showerOn then
		return
	end
	showerOn = active
	local info = TweenInfo.new(2.5)
	if active then
		TweenService:Create(Lighting, info, { OutdoorAmbient = Color3.fromRGB(190, 120, 150), Ambient = Color3.fromRGB(140, 90, 120) }):Play()
	else
		TweenService:Create(Lighting, info, normalSky):Play()
	end
end

---------------------------------------------------------------------
-- Подсказки (ProximityPrompt)
---------------------------------------------------------------------

local function onPromptTriggered(prompt: ProximityPrompt)
	local kind = prompt:GetAttribute("Kind")
	if kind == "pedestal" then
		local mode = promptModes[prompt]
		local base = prompt:GetAttribute("Base")
		local slot = prompt:GetAttribute("Slot")
		if type(slot) ~= "number" then
			return
		end
		if mode == "sell" then
			Ctx.send("Sell", slot)
		elseif mode == "steal" and type(base) == "number" then
			Ctx.send("Steal", base, slot)
		end
	elseif kind == "grab" then
		local id = prompt:GetAttribute("FieldId")
		if type(id) == "number" then
			Ctx.send("Grab", id)
		end
	elseif kind == "open" then
		local panel = prompt:GetAttribute("Panel")
		if type(panel) == "string" then
			Ctx.openPanel(panel)
		end
	end
end

---------------------------------------------------------------------
-- Стрелка обучения
---------------------------------------------------------------------

local beamTarget: Part
local beam: Beam
local arrow: BillboardGui

local function setupTutorialBeam()
	beamTarget = Instance.new("Part")
	beamTarget.Name = "TutorialTarget"
	beamTarget.Anchored = true
	beamTarget.CanCollide = false
	beamTarget.CanQuery = false
	beamTarget.CanTouch = false
	beamTarget.Transparency = 1
	beamTarget.Size = Vector3.new(1, 1, 1)
	beamTarget.Parent = localFolder
	local attachment = Instance.new("Attachment")
	attachment.Parent = beamTarget

	beam = Instance.new("Beam")
	beam.Attachment1 = attachment
	beam.Color = ColorSequence.new(Color3.fromRGB(255, 230, 90))
	beam.LightEmission = 1
	beam.Transparency = NumberSequence.new(0.15)
	beam.Width0 = 0.6
	beam.Width1 = 0.6
	beam.FaceCamera = true
	beam.Enabled = false
	beam.Parent = beamTarget

	arrow = Instance.new("BillboardGui")
	arrow.Size = UDim2.new(3, 0, 3, 0)
	arrow.StudsOffset = Vector3.new(0, 3, 0)
	arrow.AlwaysOnTop = true
	arrow.Enabled = false
	local label = textLabel(arrow, UDim2.fromScale(1, 1), UDim2.fromScale(0, 0), Color3.fromRGB(255, 230, 90))
	label.Text = "⬇"
	arrow.Parent = beamTarget
end

local function tutorialTarget(step: number, from: Vector3): Vector3?
	if step == 0 then
		local best, bestDistance = nil, math.huge
		for model in pairs(fieldStars) do
			if model.Parent then
				local position = model:GetPivot().Position
				local distance = (position - from).Magnitude
				if distance < bestDistance then
					best, bestDistance = position, distance
				end
			end
		end
		return best or Vector3.new(0, 3, 0)
	end
	local model = baseModel(myBaseIndex)
	if not model then
		return nil
	end
	local name = step == 1 and "Floor" or (step == 2 and "CollectPad" or (step == 3 and "LockPad" or ""))
	local part = model:FindFirstChild(name)
	if part and part:IsA("BasePart") then
		return part.Position + Vector3.new(0, 1, 0)
	end
	return nil
end

local function updateTutorial()
	local state = Ctx.state
	local _, root = character()
	local step = state and state.tutorial or 99
	if step == 0 and state and state.carrying then
		step = 1
	end
	local target = (root and step < 4) and tutorialTarget(step, root.Position) or nil
	if not root or not target or (root.Position - target).Magnitude < 8 then
		beam.Enabled = false
		arrow.Enabled = false
		return
	end
	beamTarget.Position = target + Vector3.new(0, 1.5, 0)
	local attachment = root:FindFirstChild("TutorialAttachment")
	if not attachment then
		attachment = Instance.new("Attachment")
		attachment.Name = "TutorialAttachment"
		attachment.Parent = root
	end
	beam.Attachment0 = attachment :: Attachment
	beam.Enabled = true
	arrow.Enabled = true
end

---------------------------------------------------------------------

local function watchTag(tag: string, fn: (Instance) -> ())
	for _, item in ipairs(CollectionService:GetTagged(tag)) do
		task.spawn(fn, item)
	end
	CollectionService:GetInstanceAddedSignal(tag):Connect(fn)
end

function Effects.init()
	localFolder = Instance.new("Folder")
	localFolder.Name = "StarfallLocal"
	localFolder.Parent = workspace

	setupSounds()
	setupLocalization()
	setupTutorialBeam()

	watchTag("Pedestal", watchPedestal)
	watchTag("FieldStar", setupFieldStar)
	watchTag("CarriedStar", setupCarried)
	watchTag("StarMarker", setupMarker)

	ProximityPromptService.PromptTriggered:Connect(onPromptTriggered)

	Ctx.onState(function(state)
		setupOwnBase(state.base)
		refreshPedestals()
	end)

	RunService.RenderStepped:Connect(spinFieldStars)

	-- радужные звёзды переливаются
	task.spawn(function()
		while true do
			local hue = (os.clock() * 0.3) % 1
			for _, part in ipairs(CollectionService:GetTagged("Rainbow")) do
				if part:IsA("BasePart") then
					part.Color = Color3.fromHSV((hue + part.Position.Y * 0.05 + part.Position.X * 0.02) % 1, 0.75, 1)
				end
			end
			task.wait(0.08)
		end
	end)

	task.spawn(function()
		while true do
			refreshPedestals()
			updateFieldTimers()
			updateBases()
			updateShower()
			updateTutorial()
			task.wait(0.4)
		end
	end)

	-- падающие звёзды в небе для красоты
	task.spawn(function()
		while true do
			task.wait(showerOn and 0.35 or (2 + math.random() * 3))
			shootingStar(showerOn)
		end
	end)
end

return Effects
