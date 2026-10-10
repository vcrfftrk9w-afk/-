-- Мир глазами игрока: переводы табличек, подсказки на грядках, таймеры роста,
-- погода, полёт собранных плодов, молнии, радужные плоды, стрелка обучения.

local CollectionService = game:GetService("CollectionService")
local Lighting = game:GetService("Lighting")
local ProximityPromptService = game:GetService("ProximityPromptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

local Ctx = require(script.Parent.Context)

local Config = Ctx.Config
local Logic = Ctx.Logic
local T = Ctx.T

local Effects = {}

local function mapRoot(): Instance?
	return workspace:FindFirstChild("SweetGarden")
end

local function character(): (Model?, BasePart?)
	local model = Ctx.player.Character
	local root = model and model:FindFirstChild("HumanoidRootPart")
	if root and root:IsA("BasePart") then
		return model, root
	end
	return model, nil
end

---------------------------------------------------------------------
-- Переводы табличек и подсказок
---------------------------------------------------------------------

local function applyLabel(label: TextLabel)
	local key = label:GetAttribute("TKey")
	if type(key) ~= "string" or key == "" then
		return
	end
	local arg = label:GetAttribute("TArg")
	local text
	if type(arg) == "string" and arg ~= "" then
		text = T(key, arg)
	else
		text = T(key)
	end
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
	if not instance:IsA("ProximityPrompt") or instance:GetAttribute("Kind") == "tile" then
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
-- Мой сад: подсказки на грядках и таймеры
---------------------------------------------------------------------

local myPlotIndex = 0
local myTiles: { BasePart } = {}
local tileConnections: { RBXScriptConnection } = {}
local promptModes: { [ProximityPrompt]: string } = {}
local growLabels: { [BasePart]: TextLabel } = {}

local function tilePrompt(tile: BasePart): ProximityPrompt?
	local point = tile:FindFirstChild("PromptPoint")
	local prompt = point and point:FindFirstChild("Prompt")
	if prompt and prompt:IsA("ProximityPrompt") then
		return prompt
	end
	return nil
end

local function updateTilePrompt(tile: BasePart)
	local prompt = tilePrompt(tile)
	if not prompt then
		return
	end
	local locked = tile:GetAttribute("Locked") == true
	local seedId = tile:GetAttribute("Seed")
	local fruits = tile:GetAttribute("Fruits")
	if type(seedId) ~= "string" then
		seedId = ""
	end
	if type(fruits) ~= "number" then
		fruits = 0
	end

	local mode = nil
	if not locked then
		if Ctx.shovel then
			if seedId ~= "" then
				mode = "dig"
				prompt.ActionText = T("pr_dig")
				prompt.ObjectText = Ctx.seedLabel(seedId)
				prompt.HoldDuration = 0.8
			end
		elseif seedId == "" then
			local selected = Ctx.currentSeed()
			prompt.HoldDuration = 0
			if selected then
				mode = "plant"
				prompt.ActionText = T("pr_plant")
				prompt.ObjectText = Ctx.seedLabel(selected) .. " x" .. Ctx.seedCount(selected)
			else
				mode = "choose"
				prompt.ActionText = T("pr_choose")
				prompt.ObjectText = ""
			end
		elseif fruits > 0 then
			mode = "harvest"
			prompt.HoldDuration = 0
			prompt.ActionText = T("pr_harvest") .. " (" .. fruits .. ")"
			prompt.ObjectText = Ctx.seedLabel(seedId)
		end
	end
	promptModes[prompt] = mode
	prompt.Enabled = mode ~= nil
end

local function refreshAllPrompts()
	for _, tile in ipairs(myTiles) do
		updateTilePrompt(tile)
	end
end

local function clearPlot()
	for _, connection in ipairs(tileConnections) do
		connection:Disconnect()
	end
	tileConnections = {}
	for tile, label in pairs(growLabels) do
		local gui = label.Parent
		if gui then
			gui:Destroy()
		end
		growLabels[tile] = nil
	end
	for _, tile in ipairs(myTiles) do
		local prompt = tilePrompt(tile)
		if prompt then
			prompt.Enabled = false
			promptModes[prompt] = nil
		end
	end
	myTiles = {}
end

local function growLabel(tile: BasePart): TextLabel
	local existing = growLabels[tile]
	if existing then
		return existing
	end
	local gui = Instance.new("BillboardGui")
	gui.Name = "GrowLabel"
	gui.Size = UDim2.new(4, 0, 1.1, 0)
	gui.StudsOffset = Vector3.new(0, 2.4, 0)
	gui.AlwaysOnTop = true
	gui.MaxDistance = 45
	gui.LightInfluence = 0
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.FredokaOne
	label.TextScaled = true
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0.2
	label.Text = ""
	label.Parent = gui
	gui.Parent = tile
	growLabels[tile] = label
	return label
end

local function setupPlot(index: number)
	clearPlot()
	myPlotIndex = index
	local map = mapRoot()
	local plot = map and index > 0 and map:FindFirstChild("Plot" .. index)
	local tiles = plot and plot:FindFirstChild("Tiles")
	if not tiles then
		return
	end
	for _, tile in ipairs(tiles:GetChildren()) do
		if tile:IsA("BasePart") then
			table.insert(myTiles, tile)
			updateTilePrompt(tile)
			for _, attribute in ipairs({ "Locked", "Seed", "Fruits" }) do
				table.insert(tileConnections, tile:GetAttributeChangedSignal(attribute):Connect(function()
					updateTilePrompt(tile)
				end))
			end
		end
	end
end

local function updateGrowLabels()
	local now = workspace:GetServerTimeNow()
	for _, tile in ipairs(myTiles) do
		local seedId = tile:GetAttribute("Seed")
		local seed = type(seedId) == "string" and Config.SeedById[seedId] or nil
		if seed then
			local label = growLabel(tile)
			local readyAt = tile:GetAttribute("ReadyAt")
			local fruits = tile:GetAttribute("Fruits")
			if type(readyAt) == "number" and readyAt > now then
				label.Text = "⏳ " .. Logic.formatTime(readyAt - now)
				label.TextColor3 = Color3.new(1, 1, 1)
			elseif seed.harvest == "multi" then
				label.Text = seed.emoji .. " " .. tostring(fruits or 0) .. "/" .. tostring(seed.maxFruits)
				label.TextColor3 = Color3.fromRGB(255, 240, 150)
			else
				label.Text = "✅"
				label.TextColor3 = Color3.new(1, 1, 1)
			end
		elseif growLabels[tile] then
			growLabels[tile].Text = ""
		end
	end
end

local function onPromptTriggered(prompt: ProximityPrompt)
	local kind = prompt:GetAttribute("Kind")
	if kind == "tile" then
		local tile = prompt:GetAttribute("Tile")
		local plot = prompt:GetAttribute("Plot")
		if type(tile) ~= "number" or plot ~= myPlotIndex then
			return
		end
		local mode = promptModes[prompt]
		if mode == "plant" then
			local selected = Ctx.currentSeed()
			if selected then
				Ctx.send("Plant", tile, selected)
			else
				Ctx.openPanel("pick", tile)
			end
		elseif mode == "choose" then
			Ctx.openPanel("pick", tile)
		elseif mode == "harvest" then
			Ctx.send("Harvest", tile)
		elseif mode == "dig" then
			Ctx.send("Dig", tile)
		end
	elseif kind == "open" then
		local panel = prompt:GetAttribute("Panel")
		if type(panel) == "string" then
			Ctx.openPanel(panel)
		end
	elseif kind == "sell" then
		Ctx.send("Sell")
	end
end

---------------------------------------------------------------------
-- Погода
---------------------------------------------------------------------

local weatherFolder: Folder? = nil
local followPart: BasePart? = nil
local base = {
	Brightness = Lighting.Brightness,
	OutdoorAmbient = Lighting.OutdoorAmbient,
	Ambient = Lighting.Ambient,
}
local atmosphere = Lighting:FindFirstChildOfClass("Atmosphere")
local baseDensity = atmosphere and atmosphere.Density or 0.3

local PRESETS = {
	rain = { Brightness = 1.4, OutdoorAmbient = Color3.fromRGB(110, 115, 140), Ambient = Color3.fromRGB(95, 95, 115), density = 0.45 },
	thunder = { Brightness = 0.9, OutdoorAmbient = Color3.fromRGB(80, 80, 110), Ambient = Color3.fromRGB(70, 70, 95), density = 0.5 },
	snow = { Brightness = 2, OutdoorAmbient = Color3.fromRGB(175, 190, 220), Ambient = Color3.fromRGB(140, 150, 175), density = 0.42 },
	candy = { Brightness = 2.4, OutdoorAmbient = Color3.fromRGB(205, 155, 195), Ambient = Color3.fromRGB(160, 120, 150), density = 0.3 },
	rainbow = { Brightness = 2.8, OutdoorAmbient = Color3.fromRGB(180, 170, 195), Ambient = Color3.fromRGB(140, 130, 150), density = 0.22 },
}

local function emitterFor(id: string, parent: BasePart)
	local emitter = Instance.new("ParticleEmitter")
	emitter.EmissionDirection = Enum.NormalId.Bottom
	emitter.LightInfluence = 1
	if id == "rain" or id == "thunder" then
		emitter.Color = ColorSequence.new(Color3.fromRGB(190, 215, 255))
		emitter.Transparency = NumberSequence.new(0.35)
		emitter.Size = NumberSequence.new(0.12)
		emitter.Squash = NumberSequence.new(2.5)
		emitter.Orientation = Enum.ParticleOrientation.VelocityParallel
		emitter.Rate = id == "thunder" and 320 or 260
		emitter.Lifetime = NumberRange.new(1, 1.2)
		emitter.Speed = NumberRange.new(65, 75)
	elseif id == "snow" then
		emitter.Color = ColorSequence.new(Color3.new(1, 1, 1))
		emitter.Size = NumberSequence.new(0.35)
		emitter.Rate = 150
		emitter.Lifetime = NumberRange.new(6, 8)
		emitter.Speed = NumberRange.new(5, 8)
		emitter.SpreadAngle = Vector2.new(25, 25)
		emitter.RotSpeed = NumberRange.new(-60, 60)
	elseif id == "candy" then
		emitter.Color = ColorSequence.new({
			ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 90, 170)),
			ColorSequenceKeypoint.new(0.33, Color3.fromRGB(255, 225, 80)),
			ColorSequenceKeypoint.new(0.66, Color3.fromRGB(110, 210, 255)),
			ColorSequenceKeypoint.new(1, Color3.fromRGB(150, 255, 150)),
		})
		emitter.LightEmission = 0.4
		emitter.Size = NumberSequence.new(0.6)
		emitter.Rate = 70
		emitter.Lifetime = NumberRange.new(2.5, 3.5)
		emitter.Speed = NumberRange.new(16, 22)
		emitter.RotSpeed = NumberRange.new(-120, 120)
	else
		emitter.Color = ColorSequence.new(Color3.fromRGB(255, 240, 255))
		emitter.LightEmission = 1
		emitter.Size = NumberSequence.new(0.3, 0)
		emitter.Rate = 40
		emitter.Lifetime = NumberRange.new(3, 4)
		emitter.Speed = NumberRange.new(4, 7)
	end
	emitter.Parent = parent
end

local function rainbowArc(parent: Instance)
	local colors = {
		Color3.fromRGB(255, 80, 80),
		Color3.fromRGB(255, 160, 60),
		Color3.fromRGB(255, 235, 80),
		Color3.fromRGB(100, 230, 110),
		Color3.fromRGB(80, 170, 255),
		Color3.fromRGB(110, 100, 240),
		Color3.fromRGB(200, 100, 255),
	}
	local center = Vector3.new(0, -30, -330)
	local segments = 26
	for band, color in ipairs(colors) do
		local radius = 210 - (band - 1) * 4
		for i = 0, segments - 1 do
			local a0 = math.pi * i / segments
			local a1 = math.pi * (i + 1) / segments
			local p0 = center + Vector3.new(math.cos(a0) * radius, math.sin(a0) * radius, 0)
			local p1 = center + Vector3.new(math.cos(a1) * radius, math.sin(a1) * radius, 0)
			local part = Instance.new("Part")
			part.Anchored = true
			part.CanCollide = false
			part.CanQuery = false
			part.CanTouch = false
			part.CastShadow = false
			part.Material = Enum.Material.Neon
			part.Color = color
			part.Transparency = 0.35
			part.Size = Vector3.new(4.2, 0.6, (p1 - p0).Magnitude + 0.5)
			part.CFrame = CFrame.lookAt((p0 + p1) / 2, p1)
			part.Parent = parent
		end
	end
end

local function setWeather(id: string)
	if weatherFolder then
		weatherFolder:Destroy()
		weatherFolder = nil
		followPart = nil
	end
	local preset = PRESETS[id]
	local info = TweenInfo.new(3)
	if preset then
		TweenService:Create(Lighting, info, { Brightness = preset.Brightness, OutdoorAmbient = preset.OutdoorAmbient, Ambient = preset.Ambient }):Play()
		if atmosphere then
			TweenService:Create(atmosphere, info, { Density = preset.density }):Play()
		end
	else
		TweenService:Create(Lighting, info, base):Play()
		if atmosphere then
			TweenService:Create(atmosphere, info, { Density = baseDensity }):Play()
		end
	end
	if id == "" or not preset then
		return
	end

	local folder = Instance.new("Folder")
	folder.Name = "LocalWeather"
	folder.Parent = workspace
	weatherFolder = folder

	local cloud = Instance.new("Part")
	cloud.Name = "WeatherEmitter"
	cloud.Anchored = true
	cloud.CanCollide = false
	cloud.CanQuery = false
	cloud.CanTouch = false
	cloud.Transparency = 1
	cloud.Size = Vector3.new(110, 1, 110)
	cloud.Parent = folder
	followPart = cloud
	emitterFor(id, cloud)

	if id == "rainbow" then
		rainbowArc(folder)
	end
	Ctx.toast(T("w_" .. id .. "_desc"), Color3.fromRGB(190, 225, 255))
end

---------------------------------------------------------------------
-- Эффекты по сигналу сервера
---------------------------------------------------------------------

function Effects.collect(list: { any })
	local _, root = character()
	for _, item in ipairs(list) do
		if typeof(item.p) == "Vector3" then
			local part = Instance.new("Part")
			part.Shape = Enum.PartType.Ball
			part.Anchored = true
			part.CanCollide = false
			part.CanQuery = false
			part.CanTouch = false
			part.CastShadow = false
			part.Material = Enum.Material.Neon
			part.Color = typeof(item.c) == "Color3" and item.c or Color3.new(1, 1, 1)
			part.Size = Vector3.new(0.9, 0.9, 0.9)
			part.Position = item.p
			part.Parent = workspace
			local start = os.clock()
			local from: Vector3 = item.p
			local connection: RBXScriptConnection
			connection = RunService.Heartbeat:Connect(function()
				local t = math.min((os.clock() - start) / 0.35, 1)
				local target = root and root.Position or from
				part.Position = from:Lerp(target, t * t)
				part.Size = Vector3.one * (0.9 * (1 - t * 0.6))
				if t >= 1 then
					connection:Disconnect()
					part:Destroy()
				end
			end)
		end
	end
end

function Effects.lightning(position: Vector3)
	local folder = Instance.new("Folder")
	folder.Name = "Lightning"
	folder.Parent = workspace
	local top = position + Vector3.new(math.random(-12, 12), 120, math.random(-12, 12))
	local points = { top }
	for i = 1, 6 do
		local t = i / 7
		local jitter = Vector3.new(math.random(-6, 6), 0, math.random(-6, 6))
		table.insert(points, top:Lerp(position, t) + jitter)
	end
	table.insert(points, position)
	for i = 1, #points - 1 do
		local a, b = points[i], points[i + 1]
		local part = Instance.new("Part")
		part.Anchored = true
		part.CanCollide = false
		part.CanQuery = false
		part.CanTouch = false
		part.CastShadow = false
		part.Material = Enum.Material.Neon
		part.Color = Color3.fromRGB(255, 255, 210)
		part.Size = Vector3.new(0.7, 0.7, (b - a).Magnitude)
		part.CFrame = CFrame.lookAt((a + b) / 2, b)
		part.Parent = folder
	end
	local flash = Instance.new("ColorCorrectionEffect")
	flash.Brightness = 0.35
	flash.Parent = Lighting
	TweenService:Create(flash, TweenInfo.new(0.45), { Brightness = 0 }):Play()
	Debris:AddItem(flash, 0.5)
	Debris:AddItem(folder, 0.35)
end

---------------------------------------------------------------------
-- Стрелка обучения
---------------------------------------------------------------------

local beamTarget: Part
local beamTargetAttachment: Attachment
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
	beamTarget.Parent = workspace
	beamTargetAttachment = Instance.new("Attachment")
	beamTargetAttachment.Parent = beamTarget

	beam = Instance.new("Beam")
	beam.Attachment1 = beamTargetAttachment
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
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.TextScaled = true
	label.Font = Enum.Font.FredokaOne
	label.Text = "⬇"
	label.TextColor3 = Color3.fromRGB(255, 230, 90)
	label.TextStrokeTransparency = 0
	label.Parent = arrow
	arrow.Parent = beamTarget
end

local function tutorialTarget(step: number): Vector3?
	local map = mapRoot()
	if not map then
		return nil
	end
	if step == 0 or step == 1 then
		for _, tile in ipairs(myTiles) do
			local seedId = tile:GetAttribute("Seed")
			local locked = tile:GetAttribute("Locked") == true
			if not locked and ((step == 0 and seedId == "") or (step == 1 and seedId ~= "")) then
				return tile.Position
			end
		end
		return nil
	end
	local standKey = step == 2 and "sell" or (step == 3 and "seeds" or nil)
	local stand = standKey and map:FindFirstChild("Stand_" .. standKey)
	local counter = stand and stand:FindFirstChild("Counter")
	if counter and counter:IsA("BasePart") then
		return counter.Position
	end
	return nil
end

local function updateTutorial()
	local state = Ctx.state
	local _, root = character()
	local step = state and state.tutorial or 99
	local target = (step < 4) and tutorialTarget(step) or nil
	if not root or not target or (root.Position - target).Magnitude < 9 then
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
-- Таймер обновления магазина семян над прилавком
---------------------------------------------------------------------

local restockLabel: TextLabel? = nil

local function setupRestockSign()
	local map = mapRoot()
	local stand = map and map:FindFirstChild("Stand_seeds")
	local anchor = stand and stand:FindFirstChild("SignAnchor")
	if not anchor or not anchor:IsA("BasePart") then
		return
	end
	local gui = Instance.new("BillboardGui")
	gui.Name = "RestockTimer"
	gui.Size = UDim2.new(12, 0, 1.6, 0)
	gui.StudsOffset = Vector3.new(0, -2.4, 0)
	gui.MaxDistance = 120
	gui.LightInfluence = 0
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.FredokaOne
	label.TextScaled = true
	label.TextColor3 = Color3.fromRGB(255, 250, 220)
	label.TextStrokeTransparency = 0
	label.Text = ""
	label.Parent = gui
	gui.Parent = anchor
	restockLabel = label
end

local function updateRestockSign()
	local state = Ctx.state
	if restockLabel and state then
		local nextRestock = (state.stockSlot + 1) * Config.RestockSeconds
		restockLabel.Text = "⏳ " .. T("restock_in", Logic.formatTime(nextRestock - workspace:GetServerTimeNow()))
	end
end

---------------------------------------------------------------------

function Effects.init()
	setupLocalization()
	setupTutorialBeam()
	setupRestockSign()

	ProximityPromptService.PromptTriggered:Connect(onPromptTriggered)

	Ctx.onState(function(state)
		if state.plot ~= myPlotIndex then
			setupPlot(state.plot)
		else
			refreshAllPrompts()
		end
	end)
	Ctx.onMode(refreshAllPrompts)

	local function onWeather()
		local id = ReplicatedStorage:GetAttribute("Weather")
		setWeather(type(id) == "string" and id or "")
	end
	ReplicatedStorage:GetAttributeChangedSignal("Weather"):Connect(onWeather)
	onWeather()

	RunService.RenderStepped:Connect(function()
		if followPart then
			local camera = workspace.CurrentCamera
			if camera then
				followPart.CFrame = CFrame.new(camera.CFrame.Position + Vector3.new(0, 32, 0))
			end
		end
	end)

	task.spawn(function()
		while true do
			local hue = (os.clock() * 0.25) % 1
			for _, part in ipairs(CollectionService:GetTagged("Rainbow")) do
				if part:IsA("BasePart") then
					part.Color = Color3.fromHSV((hue + part.Position.X * 0.013) % 1, 0.7, 1)
				end
			end
			task.wait(0.08)
		end
	end)

	task.spawn(function()
		while true do
			updateGrowLabels()
			updateTutorial()
			updateRestockSign()
			task.wait(0.4)
		end
	end)
end

return Effects
