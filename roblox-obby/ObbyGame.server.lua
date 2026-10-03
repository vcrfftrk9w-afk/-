--[[
	OBBY «Лавовая башня»

	Как запустить:
	  1. Roblox Studio -> New -> Baseplate
	  2. ServerScriptService -> "+" -> Script
	  3. Вставь весь этот код и нажми Play

	Скрипт сам строит всю карту (8 этапов + финиш), создаёт таблицу
	лидеров (Stage / Coins / Wins), чекпоинты, монеты и сохраняет прогресс.
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local DataStoreService = game:GetService("DataStoreService")
local Debris = game:GetService("Debris")

-- Пишет в Output, на каком шаге сейчас скрипт, и даёт Studio чуть передохнуть.
-- Если игра зависнет, последняя строчка в Output покажет, где именно.
local stepNumber = 0
local function step(name)
	stepNumber += 1
	print(("[Obby] Шаг %d: %s"):format(stepNumber, name))
	task.wait(0.3)
end
step("скрипт запущен")

local CONFIG = {
	StartHeight = 100, -- на какой высоте висит трасса
	LavaHeight = 70, -- уровень лавы под трассой
	CoinRespawn = 10, -- через сколько секунд монета появляется снова
	FinishCoins = 50, -- награда за прохождение
	RestartAfterFinish = true, -- после финиша вернуть игрока на старт
	SaveProgress = true, -- сохранять прогресс (нужен доступ к API, см. README)
	LightMode = true, -- облегчённая графика для слабых компьютеров
}

local COLORS = {
	path = Color3.fromRGB(235, 235, 245),
	lava = Color3.fromRGB(255, 85, 0),
	checkpoint = Color3.fromRGB(70, 200, 90),
	coin = Color3.fromRGB(255, 200, 40),
	lift = Color3.fromRGB(80, 140, 255),
	ghost = Color3.fromRGB(120, 230, 255),
	belt = Color3.fromRGB(60, 60, 70),
	gold = Color3.fromRGB(255, 190, 30),
}

local old = workspace:FindFirstChild("Obby")
if old then
	old:Destroy()
end
local map = Instance.new("Folder")
map.Name = "Obby"
map.Parent = workspace

---------------------------------------------------------------------
-- Помощники
---------------------------------------------------------------------

local function makePart(props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	p.Color = COLORS.path
	for key, value in pairs(props) do
		p[key] = value
	end
	p.Parent = map
	return p
end

local function humanoidFromHit(hit)
	local model = hit:FindFirstAncestorOfClass("Model")
	local humanoid = model and model:FindFirstChildOfClass("Humanoid")
	if humanoid and humanoid.Health > 0 then
		return humanoid, Players:GetPlayerFromCharacter(model)
	end
	return nil, nil
end

local function makeDeadly(p)
	p.Material = Enum.Material.Neon
	p.Color = COLORS.lava
	p.Touched:Connect(function(hit)
		local humanoid = humanoidFromHit(hit)
		if humanoid then
			humanoid.Health = 0
		end
	end)
	return p
end

local function addLabel(parent, text, color)
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(240, 50)
	gui.StudsOffset = Vector3.new(0, 5, 0)
	gui.MaxDistance = 150
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextScaled = true
	label.Font = Enum.Font.FredokaOne
	label.TextColor3 = color or Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0
	label.Parent = gui
	gui.Parent = parent
	return gui
end

local function popup(character, text, color)
	local head = character and character:FindFirstChild("Head")
	if not head then
		return
	end
	local gui = addLabel(head, text, color)
	gui.StudsOffset = Vector3.new(0, 3, 0)
	gui.AlwaysOnTop = true
	Debris:AddItem(gui, 2.5)
end

---------------------------------------------------------------------
-- Монеты
---------------------------------------------------------------------

local coins = {}

local function makeCoin(position)
	local coin = makePart({
		Name = "Coin",
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(0.4, 2.6, 2.6),
		CFrame = CFrame.new(position),
		Color = COLORS.coin,
		Material = Enum.Material.Neon,
		CanCollide = false,
	})
	local taken = false
	coin.Touched:Connect(function(hit)
		if taken then
			return
		end
		local _, player = humanoidFromHit(hit)
		local stats = player and player:FindFirstChild("leaderstats")
		if not stats then
			return
		end
		taken = true
		stats.Coins.Value += 1
		coin.Transparency = 1
		task.delay(CONFIG.CoinRespawn, function()
			coin.Transparency = 0
			taken = false
		end)
	end)
	table.insert(coins, { part = coin, base = position })
end

---------------------------------------------------------------------
-- Старт и чекпоинты
---------------------------------------------------------------------

local checkpoints = {}

step("создаю старт")
local startPad = Instance.new("SpawnLocation")
startPad.Name = "Start"
startPad.Anchored = true
startPad.Size = Vector3.new(16, 1, 16)
startPad.Position = Vector3.new(0, CONFIG.StartHeight, 0)
startPad.Color = COLORS.checkpoint
startPad.Duration = 0
startPad.TopSurface = Enum.SurfaceType.Smooth
startPad.Parent = map
addLabel(startPad, "СТАРТ", COLORS.checkpoint)
checkpoints[0] = startPad

-- Отключаем другие точки появления (например, из шаблона Baseplate),
-- чтобы все появлялись на нашей трассе.
step("отключаю другие точки появления")
for _, item in ipairs(workspace:GetDescendants()) do
	if item:IsA("SpawnLocation") and item ~= startPad then
		item.Enabled = false
	end
end

local function makeCheckpoint(index, z, y)
	local pad = makePart({
		Name = "Checkpoint" .. index,
		Size = Vector3.new(12, 1, 12),
		Position = Vector3.new(0, y, z + 6),
		Color = COLORS.checkpoint,
	})
	addLabel(pad, "Чекпоинт " .. index, COLORS.checkpoint)
	checkpoints[index] = pad

	pad.Touched:Connect(function(hit)
		local humanoid, player = humanoidFromHit(hit)
		local stats = player and player:FindFirstChild("leaderstats")
		if stats and stats.Stage.Value < index then
			stats.Stage.Value = index
			popup(humanoid.Parent, "Чекпоинт " .. index .. "!", COLORS.checkpoint)
		end
	end)
	return z + 12
end

---------------------------------------------------------------------
-- Этапы. Каждый получает (z, y) начала и возвращает (z, y) конца.
-- Трасса идёт вдоль оси +Z.
---------------------------------------------------------------------

-- 1. Прыжки по платформам
local function stageJumps(z, y)
	for i = 1, 5 do
		z += 5 + (i % 2)
		local x = (i % 2 == 0) and 3 or -3
		makePart({
			Size = Vector3.new(6, 1, 6),
			Position = Vector3.new(x, y, z + 3),
			Color = Color3.fromHSV(i / 6, 0.45, 1),
		})
		if i % 2 == 0 then
			makeCoin(Vector3.new(x, y + 3, z + 3))
		end
		z += 6
	end
	return z + 5, y
end

-- 2. Дорожка с полосами лавы
local function stageLavaStripes(z, y)
	local length = 60
	makePart({ Size = Vector3.new(12, 1, length), Position = Vector3.new(0, y, z + length / 2) })
	for i = 1, 5 do
		makeDeadly(makePart({ Size = Vector3.new(12, 1.4, 3), Position = Vector3.new(0, y + 0.3, z + i * 10) }))
	end
	makeCoin(Vector3.new(0, y + 6, z + 25))
	return z + length, y
end

-- 3. Лифты: платформы ездят вверх-вниз
local function stageLifts(z, y)
	for i = 1, 3 do
		z += 7
		local lift = makePart({
			Size = Vector3.new(8, 1, 8),
			Position = Vector3.new(0, y - 4, z + 4),
			Color = COLORS.lift,
			Material = Enum.Material.Metal,
		})
		local tween = TweenService:Create(
			lift,
			TweenInfo.new(2.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
			{ Position = lift.Position + Vector3.new(0, 9, 0) }
		)
		task.delay((i - 1) * 0.8, function()
			tween:Play()
		end)
		z += 8
	end
	return z + 7, y
end

-- 4. Вертушка: огненная палка крутится над диском, её надо перепрыгивать
local spinners = {}
local function stageSpinner(z, y)
	local radius = 15
	local center = Vector3.new(0, y, z + radius)
	makePart({
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(1, radius * 2, radius * 2),
		CFrame = CFrame.new(center) * CFrame.Angles(0, 0, math.rad(90)),
		Color = Color3.fromRGB(255, 120, 200),
	})
	makePart({
		Size = Vector3.new(2, 3, 2),
		Position = center + Vector3.new(0, 2, 0),
		Color = Color3.fromRGB(40, 40, 50),
	})
	local barCenter = center + Vector3.new(0, 1.2, 0)
	local bar = makeDeadly(makePart({
		Size = Vector3.new(radius * 2 - 2, 1.2, 1.2),
		CFrame = CFrame.new(barCenter),
		CanCollide = false,
	}))
	table.insert(spinners, { part = bar, center = barCenter, speed = 1.6, angle = 0 })
	makeCoin(Vector3.new(radius - 3, y + 5, z + radius))
	return z + radius * 2, y
end

-- 5. Исчезающие стеклянные платформы
local function stageGhost(z, y)
	for i = 1, 6 do
		z += 4
		local base = Vector3.new(math.sin(i) * 4, y, z + 3)
		local p = makePart({
			Size = Vector3.new(6, 1, 6),
			Position = base,
			Color = COLORS.ghost,
			Material = Enum.Material.Glass,
			Transparency = 0.2,
		})
		local busy = false
		p.Touched:Connect(function(hit)
			if busy or not humanoidFromHit(hit) then
				return
			end
			busy = true
			task.wait(0.6)
			TweenService:Create(p, TweenInfo.new(0.3), { Transparency = 1 }):Play()
			task.wait(0.3)
			p.CanCollide = false
			task.wait(2.5)
			p.CanCollide = true
			p.Transparency = 0.2
			busy = false
		end)
		z += 6
	end
	return z + 4, y
end

-- 6. Башня: забраться по ферме на стену
local function stageTower(z, y)
	local height = 24
	makePart({ Size = Vector3.new(8, 1, 6), Position = Vector3.new(0, y, z + 3) })
	local truss = Instance.new("TrussPart")
	truss.Anchored = true
	truss.Size = Vector3.new(2, height, 2)
	truss.Position = Vector3.new(0, y + 0.5 + height / 2, z + 5)
	truss.Parent = map
	makePart({
		Size = Vector3.new(14, height, 12),
		Position = Vector3.new(0, y + 0.5 + height / 2, z + 12),
		Color = Color3.fromRGB(150, 110, 80),
		Material = Enum.Material.Brick,
	})
	makeCoin(Vector3.new(0, y + height + 3, z + 12))
	return z + 18, y + height
end

-- 7. Конвейер, который тащит назад, и препятствия на нём
local function stageConveyor(z, y)
	local length = 50
	local belt = makePart({
		Size = Vector3.new(10, 1, length),
		Position = Vector3.new(0, y, z + length / 2),
		Color = COLORS.belt,
		Material = Enum.Material.DiamondPlate,
	})
	belt.AssemblyLinearVelocity = Vector3.new(0, 0, -10)
	for i, x in ipairs({ -2.5, 2.5, -2.5 }) do
		makeDeadly(makePart({ Size = Vector3.new(5, 2, 2), Position = Vector3.new(x, y + 1.5, z + i * 13) }))
	end
	addLabel(belt, "БЕГИ!", COLORS.lava).StudsOffset = Vector3.new(0, 4, 0)
	return z + length, y
end

-- 8. Узкие балки зигзагом
local function stageBeams(z, y)
	for i, x in ipairs({ -3, 3, -3, 3 }) do
		z += 3
		makePart({
			Size = Vector3.new(1.5, 1, 12),
			Position = Vector3.new(x, y, z + 6),
			Color = Color3.fromRGB(255, 230, 120),
		})
		if i == 2 or i == 4 then
			makeCoin(Vector3.new(x, y + 3, z + 6))
		end
		z += 12
	end
	return z + 3, y
end

---------------------------------------------------------------------
-- Сборка трассы
---------------------------------------------------------------------

local stages = {
	stageJumps,
	stageLavaStripes,
	stageLifts,
	stageSpinner,
	stageGhost,
	stageTower,
	stageConveyor,
	stageBeams,
}
local LAST_STAGE = #stages

step("начинаю строить трассу")
local z, y = 8, CONFIG.StartHeight
for index, build in ipairs(stages) do
	z, y = build(z, y)
	z = makeCheckpoint(index, z, y)
	step("этап " .. index .. " построен")
end

step("строю финиш")
-- Финиш
makePart({
	Size = Vector3.new(24, 1, 24),
	Position = Vector3.new(0, y, z + 12),
	Color = COLORS.gold,
	Material = Enum.Material.Foil,
})
for _, x in ipairs({ -11, 11 }) do
	makePart({ Size = Vector3.new(2, 12, 2), Position = Vector3.new(x, y + 6.5, z + 3), Color = COLORS.gold })
end
local banner = makePart({
	Size = Vector3.new(24, 2, 2),
	Position = Vector3.new(0, y + 13.5, z + 3),
	Color = COLORS.gold,
	Material = Enum.Material.Neon,
})
addLabel(banner, "ФИНИШ", COLORS.gold).StudsOffset = Vector3.new(0, 3, 0)

makePart({ Size = Vector3.new(4, 3, 4), Position = Vector3.new(0, y + 2, z + 16), Color = Color3.fromRGB(40, 40, 50) })
local trophy = makePart({
	Shape = Enum.PartType.Ball,
	Size = Vector3.new(3, 3, 3),
	Position = Vector3.new(0, y + 5, z + 16),
	Color = COLORS.gold,
	Material = Enum.Material.Neon,
	CanCollide = false,
})
if not CONFIG.LightMode then
	local sparkles = Instance.new("ParticleEmitter")
	sparkles.Rate = 25
	sparkles.Speed = NumberRange.new(4, 8)
	sparkles.SpreadAngle = Vector2.new(180, 180)
	sparkles.Lifetime = NumberRange.new(1, 2)
	sparkles.Color = ColorSequence.new(COLORS.gold)
	sparkles.Parent = trophy
end

local finishGate = makePart({
	Name = "FinishGate",
	Size = Vector3.new(20, 12, 1),
	Position = Vector3.new(0, y + 6.5, z + 3),
	Transparency = 1,
	CanCollide = false,
})

-- Море лавы под всей трассой
step("строю море лавы")
local seaLength = z + 60
local sea = makeDeadly(makePart({
	Name = "LavaSea",
	Size = Vector3.new(CONFIG.LightMode and 120 or 400, 1, seaLength + 60),
	Position = Vector3.new(0, CONFIG.LavaHeight, seaLength / 2 - 30),
}))
if CONFIG.LightMode then
	sea.Material = Enum.Material.SmoothPlastic
end
print("[Obby] Трасса построена: " .. LAST_STAGE .. " этапов")

---------------------------------------------------------------------
-- Игроки и сохранения
---------------------------------------------------------------------

step("подключаю сохранения")
local store
if CONFIG.SaveProgress then
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore("ObbyProgress_v1")
	end)
	if ok then
		store = result
	else
		warn("[Obby] Сохранения выключены: " .. tostring(result))
	end
end

local loaded = {}
local finishing = {}

local function teleportToCheckpoint(player)
	local character = player.Character
	local stats = player:FindFirstChild("leaderstats")
	if not character or not stats then
		return
	end
	local pad = checkpoints[stats.Stage.Value] or checkpoints[0]
	local position = pad.Position + Vector3.new(0, 4, 0)
	character:PivotTo(CFrame.lookAt(position, position + Vector3.new(0, 0, 1)))
end

local function onPlayerAdded(player)
	print("[Obby] Игрок зашёл: " .. player.Name)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local function stat(name)
		local value = Instance.new("IntValue")
		value.Name = name
		value.Parent = stats
		return value
	end
	local stage, coinCount, wins = stat("Stage"), stat("Coins"), stat("Wins")
	stats.Parent = player

	player.CharacterAdded:Connect(function(character)
		character:WaitForChild("HumanoidRootPart")
		task.wait(0.1)
		teleportToCheckpoint(player)
	end)

	if store then
		local ok, data = pcall(function()
			return store:GetAsync("player_" .. player.UserId)
		end)
		if ok then
			if type(data) == "table" then
				stage.Value = math.clamp(data.Stage or 0, 0, LAST_STAGE)
				coinCount.Value = data.Coins or 0
				wins.Value = data.Wins or 0
			end
			loaded[player] = true
		else
			warn("[Obby] Не удалось загрузить прогресс: " .. tostring(data))
		end
	end

	if player.Character then
		teleportToCheckpoint(player)
	end
end

local function save(player)
	local stats = player:FindFirstChild("leaderstats")
	if not store or not loaded[player] or not stats then
		return
	end
	local data = { Stage = stats.Stage.Value, Coins = stats.Coins.Value, Wins = stats.Wins.Value }
	local ok, err = pcall(function()
		store:SetAsync("player_" .. player.UserId, data)
	end)
	if not ok then
		warn("[Obby] Не удалось сохранить прогресс: " .. tostring(err))
	end
end

step("жду игроков")
Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, player)
end

Players.PlayerRemoving:Connect(function(player)
	save(player)
	loaded[player] = nil
	finishing[player] = nil
end)

game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		task.spawn(save, player)
	end
	task.wait(2)
end)

finishGate.Touched:Connect(function(hit)
	local humanoid, player = humanoidFromHit(hit)
	local stats = player and player:FindFirstChild("leaderstats")
	if not stats or finishing[player] or stats.Stage.Value < LAST_STAGE then
		return
	end
	finishing[player] = true
	stats.Wins.Value += 1
	stats.Coins.Value += CONFIG.FinishCoins
	popup(humanoid.Parent, "ПОБЕДА! +" .. CONFIG.FinishCoins .. " монет", COLORS.gold)

	task.delay(6, function()
		if player.Parent and CONFIG.RestartAfterFinish then
			stats.Stage.Value = 0
			teleportToCheckpoint(player)
		end
		finishing[player] = nil
	end)
end)

---------------------------------------------------------------------
-- Анимация: вертушки, монеты, страховка от падения
---------------------------------------------------------------------

step("включаю вертушки и монеты")
local overlap = OverlapParams.new()
overlap.FilterType = Enum.RaycastFilterType.Exclude
overlap.FilterDescendantsInstances = { map }

local clock = 0
local nextHazardCheck = 0
RunService.Heartbeat:Connect(function(dt)
	clock += dt
	local checkHazards = clock >= nextHazardCheck
	if checkHazards then
		nextHazardCheck = clock + 0.1
	end

	for _, spinner in ipairs(spinners) do
		spinner.angle += spinner.speed * dt
		spinner.part.CFrame = CFrame.new(spinner.center) * CFrame.Angles(0, spinner.angle, 0)
		if checkHazards then
			for _, hit in ipairs(workspace:GetPartsInPart(spinner.part, overlap)) do
				local humanoid = humanoidFromHit(hit)
				if humanoid then
					humanoid.Health = 0
				end
			end
		end
	end

	local bob = Vector3.new(0, math.sin(clock * 2) * 0.4, 0)
	for _, coin in ipairs(coins) do
		coin.part.CFrame = CFrame.new(coin.base + bob) * CFrame.Angles(0, clock * 2, 0)
	end
end)

-- Если игрок как-то пролетел мимо лавы — всё равно возвращаем его на чекпоинт
step("включаю защиту от падения")
task.spawn(function()
	while true do
		task.wait(0.5)
		for _, player in ipairs(Players:GetPlayers()) do
			local character = player.Character
			local root = character and character:FindFirstChild("HumanoidRootPart")
			local humanoid = character and character:FindFirstChildOfClass("Humanoid")
			if root and humanoid and humanoid.Health > 0 and root.Position.Y < CONFIG.LavaHeight - 10 then
				humanoid.Health = 0
			end
		end
	end
end)

step("всё готово, можно играть!")
