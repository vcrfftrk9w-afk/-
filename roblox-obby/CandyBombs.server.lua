--[[
	КОНФЕТНАЯ АРЕНА (дополнение к «Лавовой башне»)

	Как добавить:
	  ServerScriptService -> "+" -> Script, вставь этот код целиком,
	  проверь, что в самом конце есть строчка "-- КОНЕЦ СКРИПТА", и опубликуй (Alt + P).

	Рядом со стартом появляется мост на круглую розовую арену.
	Пока стоишь на арене, у тебя в руке бомба-конфета:
	нажми на экран, чтобы бросить. Через миг — БАХ! Разноцветные
	конфетти и взрывная волна, которая отбрасывает игроков
	и разбрасывает башни из конфетных блоков. Никто не умирает от взрыва,
	но с арены можно вылететь. За каждого отброшенного игрока +1 в «Hits».
]]

local Players = game:GetService("Players")
local Debris = game:GetService("Debris")

local CONFIG = {
	ArenaCenter = Vector3.new(-100, 100, 0), -- слева от старта «Лавовой башни»
	ArenaRadius = 30,
	Cooldown = 1.2, -- секунд между бросками
	ThrowForward = 55,
	ThrowUp = 35,
	BlastRadius = 12,
	BlastPressure = 250000, -- сила взрывной волны
	TowersResetTime = 25, -- через сколько секунд башни собираются заново
}

local CANDY_COLORS = {
	Color3.fromRGB(255, 90, 170),
	Color3.fromRGB(120, 220, 255),
	Color3.fromRGB(255, 230, 90),
	Color3.fromRGB(150, 255, 140),
	Color3.fromRGB(200, 140, 255),
}

local function randomCandyColor()
	return CANDY_COLORS[math.random(1, #CANDY_COLORS)]
end

local old = workspace:FindFirstChild("CandyArena")
if old then
	old:Destroy()
end
local arena = Instance.new("Folder")
arena.Name = "CandyArena"
arena.Parent = workspace

local function makePart(props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for key, value in pairs(props) do
		p[key] = value
	end
	p.Parent = arena
	return p
end

local function addLabel(parent, text, color)
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(260, 50)
	gui.StudsOffset = Vector3.new(0, 4, 0)
	gui.MaxDistance = 200
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextScaled = true
	label.Font = Enum.Font.FredokaOne
	label.TextColor3 = color
	label.TextStrokeTransparency = 0
	label.Parent = gui
	gui.Parent = parent
end

---------------------------------------------------------------------
-- Арена и мост
---------------------------------------------------------------------

local center = CONFIG.ArenaCenter
local radius = CONFIG.ArenaRadius

makePart({
	Name = "Floor",
	Shape = Enum.PartType.Cylinder,
	Size = Vector3.new(1, radius * 2, radius * 2),
	CFrame = CFrame.new(center) * CFrame.Angles(0, 0, math.rad(90)),
	Color = Color3.fromRGB(255, 170, 210),
	Material = Enum.Material.SmoothPlastic,
})

-- мост от края стартовой платформы (x = -8) до края арены
local bridgeStart, bridgeEnd = -8, center.X + radius
makePart({
	Name = "Bridge",
	Size = Vector3.new(bridgeStart - bridgeEnd, 1, 6),
	Position = Vector3.new((bridgeStart + bridgeEnd) / 2, center.Y, center.Z),
	Color = Color3.fromRGB(255, 255, 255),
})

local sign = makePart({
	Name = "Sign",
	Size = Vector3.new(1, 6, 1),
	Position = Vector3.new(bridgeStart - 3, center.Y + 3.5, center.Z + 4),
	Color = Color3.fromRGB(255, 90, 170),
})
addLabel(sign, "КОНФЕТНАЯ АРЕНА", Color3.fromRGB(255, 90, 170))

-- башни из конфетных блоков, которые разлетаются от взрывов
local towerBlocks = {}
for _, offset in ipairs({ Vector3.new(12, 0, 12), Vector3.new(-12, 0, 12), Vector3.new(12, 0, -12), Vector3.new(-12, 0, -12) }) do
	for level = 0, 4 do
		local cframe = CFrame.new(center + offset + Vector3.new(0, 1.5 + level * 2, 0))
		local block = makePart({
			Name = "CandyBlock",
			Anchored = false,
			Size = Vector3.new(2, 2, 2),
			CFrame = cframe,
			Color = randomCandyColor(),
			Material = Enum.Material.SmoothPlastic,
		})
		table.insert(towerBlocks, { part = block, home = cframe })
	end
end

task.spawn(function()
	while true do
		task.wait(CONFIG.TowersResetTime)
		for _, info in ipairs(towerBlocks) do
			local block = info.part
			block.Anchored = true
			block.CFrame = info.home
			block.AssemblyLinearVelocity = Vector3.zero
			block.AssemblyAngularVelocity = Vector3.zero
			block.Anchored = false
		end
	end
end)

---------------------------------------------------------------------
-- Взрыв
---------------------------------------------------------------------

local function confetti(position)
	local holder = makePart({
		Name = "Confetti",
		Size = Vector3.new(1, 1, 1),
		Position = position,
		Transparency = 1,
		CanCollide = false,
		CanTouch = false,
	})
	local emitter = Instance.new("ParticleEmitter")
	emitter.Rate = 0
	emitter.Speed = NumberRange.new(20, 40)
	emitter.SpreadAngle = Vector2.new(180, 180)
	emitter.Lifetime = NumberRange.new(1, 2)
	emitter.Size = NumberSequence.new(0.4)
	emitter.Acceleration = Vector3.new(0, -30, 0)
	emitter.Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, CANDY_COLORS[1]),
		ColorSequenceKeypoint.new(0.25, CANDY_COLORS[2]),
		ColorSequenceKeypoint.new(0.5, CANDY_COLORS[3]),
		ColorSequenceKeypoint.new(0.75, CANDY_COLORS[4]),
		ColorSequenceKeypoint.new(1, CANDY_COLORS[5]),
	})
	emitter.Parent = holder
	emitter:Emit(80)
	Debris:AddItem(holder, 3)
end

local function explode(position, thrower)
	local boom = Instance.new("Explosion")
	boom.Position = position
	boom.BlastRadius = CONFIG.BlastRadius
	boom.BlastPressure = CONFIG.BlastPressure
	boom.DestroyJointRadiusPercent = 0 -- взрыв никого не убивает, только отбрасывает
	boom.ExplosionType = Enum.ExplosionType.NoCraters

	local alreadyHit = {}
	boom.Hit:Connect(function(part)
		local model = part:FindFirstAncestorOfClass("Model")
		local victim = model and Players:GetPlayerFromCharacter(model)
		if victim and victim ~= thrower and not alreadyHit[victim] then
			alreadyHit[victim] = true
			local stats = thrower:FindFirstChild("leaderstats")
			local hits = stats and stats:FindFirstChild("Hits")
			if hits then
				hits.Value += 1
			end
		end
	end)

	boom.Parent = workspace
	confetti(position)
end

---------------------------------------------------------------------
-- Бомба-конфета (инструмент)
---------------------------------------------------------------------

local TOOL_NAME = "Бомба-конфета"
local lastThrow = {}

local function throwCandy(player)
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not root then
		return
	end
	local now = os.clock()
	if lastThrow[player] and now - lastThrow[player] < CONFIG.Cooldown then
		return
	end
	lastThrow[player] = now

	local look = root.CFrame.LookVector
	local candy = makePart({
		Name = "ThrownCandy",
		Anchored = false,
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(1.6, 1.6, 1.6),
		Position = root.Position + look * 3 + Vector3.new(0, 2, 0),
		Color = randomCandyColor(),
		Material = Enum.Material.Neon,
	})
	candy.AssemblyLinearVelocity = look * CONFIG.ThrowForward + Vector3.new(0, CONFIG.ThrowUp, 0)
	candy:SetNetworkOwner(nil)

	local exploded = false
	local function detonate()
		if exploded or not candy.Parent then
			return
		end
		exploded = true
		local position = candy.Position
		candy:Destroy()
		explode(position, player)
	end

	task.delay(0.15, function()
		candy.Touched:Connect(function(hit)
			if not hit:IsDescendantOf(character) then
				detonate()
			end
		end)
	end)
	task.delay(3, detonate)
end

local function makeTool()
	local tool = Instance.new("Tool")
	tool.Name = TOOL_NAME
	tool.ToolTip = "Нажми, чтобы бросить!"
	tool.CanBeDropped = false

	local handle = Instance.new("Part")
	handle.Name = "Handle"
	handle.Shape = Enum.PartType.Ball
	handle.Size = Vector3.new(1.4, 1.4, 1.4)
	handle.Color = randomCandyColor()
	handle.Material = Enum.Material.Neon
	handle.CanCollide = false
	handle.Parent = tool

	tool.Activated:Connect(function()
		local character = tool.Parent
		local player = character and Players:GetPlayerFromCharacter(character)
		if player then
			throwCandy(player)
		end
	end)
	return tool
end

local function findTool(player)
	local backpack = player:FindFirstChildOfClass("Backpack")
	return (player.Character and player.Character:FindFirstChild(TOOL_NAME))
		or (backpack and backpack:FindFirstChild(TOOL_NAME))
end

local function isOnArena(root)
	local offset = root.Position - center
	local flatDistance = Vector3.new(offset.X, 0, offset.Z).Magnitude
	return flatDistance < radius + 2 and offset.Y > -5 and offset.Y < 40
end

-- Бомба есть в руках только на арене, чтобы не мешать тем, кто проходит паркур
task.spawn(function()
	while true do
		task.wait(0.5)
		for _, player in ipairs(Players:GetPlayers()) do
			local character = player.Character
			local root = character and character:FindFirstChild("HumanoidRootPart")
			local humanoid = character and character:FindFirstChildOfClass("Humanoid")
			local tool = findTool(player)
			local onArena = root and humanoid and humanoid.Health > 0 and isOnArena(root)
			if onArena and not tool then
				local backpack = player:FindFirstChildOfClass("Backpack")
				if backpack then
					local newTool = makeTool()
					newTool.Parent = backpack
					humanoid:EquipTool(newTool)
				end
			elseif not onArena and tool then
				tool:Destroy()
			end
		end
	end
end)

---------------------------------------------------------------------
-- Счёт «Hits» в таблице лидеров
---------------------------------------------------------------------

local function addHitsStat(player)
	local stats = player:WaitForChild("leaderstats", 15)
	if stats and not stats:FindFirstChild("Hits") then
		local hits = Instance.new("IntValue")
		hits.Name = "Hits"
		hits.Parent = stats
	end
end

Players.PlayerAdded:Connect(addHitsStat)
for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(addHitsStat, player)
end
Players.PlayerRemoving:Connect(function(player)
	lastThrow[player] = nil
end)

print("[CandyArena] Конфетная арена готова!")

-- Эти строчки ничего не делают. Они нужны, чтобы было видно,
-- что код скопировался целиком, до самого конца.
-- КОНЕЦ СКРИПТА
