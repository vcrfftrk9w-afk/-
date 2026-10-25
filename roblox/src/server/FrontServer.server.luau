-- Сервер режима «Фронт»: ведёт матч (ядро Core), рисует карту и постройки,
-- принимает действия игроков и рассылает им состояние и эффекты.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")

local Shared = ReplicatedStorage:WaitForChild("Front")
local Config = require(Shared:WaitForChild("Config"))
local Core = require(Shared:WaitForChild("Core"))
local Models = require(Shared:WaitForChild("Models"))

Players.CharacterAutoLoads = false

local remotes = Shared:FindFirstChild("Remotes") or Instance.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = Shared
local function remote(name)
	local r = remotes:FindFirstChild(name) or Instance.new("RemoteEvent")
	r.Name = name
	r.Parent = remotes
	return r
end
local Action = remote("Action") -- клиент -> сервер: действие игрока
local State = remote("State")   -- сервер -> клиент: состояние матча
local Fx = remote("Fx")         -- сервер -> клиенты: корабли, ракеты, танки
local Notice = remote("Notice") -- сервер -> клиент: сообщения и предложения союза

Lighting.ClockTime = 13.5
Lighting.Brightness = 2
Lighting.OutdoorAmbient = Color3.fromRGB(150, 150, 160)
Lighting.GlobalShadows = true
local baseplate = workspace:FindFirstChild("Baseplate")
if baseplate then
	baseplate:Destroy()
end

local T = Config.TILE
local W, H = Config.MAP_W, Config.MAP_H
local HEIGHT = { [1] = 1, [2] = 1.8, [3] = 3.2 }
local TERRAIN_COLOR = {
	[1] = Color3.fromRGB(118, 164, 84),
	[2] = Color3.fromRGB(150, 156, 96),
	[3] = Color3.fromRGB(126, 124, 118),
}
local BLACK = Color3.new(0, 0, 0)

local core
local mapFolder, buildingFolder
local tileParts = {}
local buildingModels = {}
local nationOf = {} -- Player -> id страны
local playerOf = {} -- id страны -> Player
local roundOver = false
local lastActions = {} -- Player -> счётчик действий за секунду

local function nationColor(id)
	local c = core.nations[id].color
	return Color3.fromRGB(c[1], c[2], c[3])
end

local function tileTop(i)
	local p = tileParts[i]
	if p then
		return p.Position + Vector3.new(0, p.Size.Y / 2, 0)
	end
	return Config.tileCenter(i)
end

-- ------------------------------------------------------------ карта

local function paintTile(i)
	local p = tileParts[i]
	if not p then
		return
	end
	local o = core.owner[i]
	local base = TERRAIN_COLOR[core.terrain[i]]
	if o > 0 then
		local c = nationColor(o)
		p.Color = core.border[i] and c:Lerp(BLACK, 0.35) or base:Lerp(c, 0.7)
	else
		p.Color = base
	end
	p:SetAttribute("O", o)
end

local function buildMap()
	if mapFolder then
		mapFolder:Destroy()
	end
	if buildingFolder then
		buildingFolder:Destroy()
	end
	tileParts, buildingModels = {}, {}

	local folder = Instance.new("Folder")
	folder.Name = "FrontMap"
	local water = Instance.new("Part")
	water.Name = "Water"
	water.Anchored = true
	water.Size = Vector3.new(W * T + 800, 2, H * T + 800)
	water.Position = Vector3.new(0, -1, 0)
	water.Color = Color3.fromRGB(38, 104, 168)
	water.Material = Enum.Material.SmoothPlastic
	water.Reflectance = 0.08
	water.TopSurface = Enum.SurfaceType.Smooth
	water.Parent = folder
	for i = 1, W * H do
		local t = core.terrain[i]
		if t ~= Core.WATER then
			local h = HEIGHT[t]
			local c = Config.tileCenter(i)
			local p = Instance.new("Part")
			p.Name = "Tile"
			p.Anchored = true
			p.CanCollide = false
			p.CastShadow = false
			p.Size = Vector3.new(T, h, T)
			p.Position = Vector3.new(c.X, h / 2 - 0.2, c.Z)
			p.Material = t == Core.MOUNTAIN and Enum.Material.Slate or Enum.Material.SmoothPlastic
			p.TopSurface = Enum.SurfaceType.Smooth
			p.BottomSurface = Enum.SurfaceType.Smooth
			p:SetAttribute("I", i)
			p.Parent = folder
			tileParts[i] = p
			paintTile(i)
		end
	end
	folder.Parent = workspace
	mapFolder = folder

	buildingFolder = Instance.new("Folder")
	buildingFolder.Name = "FrontBuildings"
	buildingFolder.Parent = workspace
end

-- ------------------------------------------------------------ постройки

local function placeBuilding(i, kind, level, owner)
	local old = buildingModels[i]
	if old then
		old:Destroy()
	end
	local m = Models.make(kind, nationColor(owner), T * (0.78 + 0.05 * level))
	local top = tileTop(i)
	local cf = CFrame.new(top) * CFrame.Angles(0, math.rad(Config.MODEL_YAW), 0)
	if kind == "Port" then
		-- причалом к воде
		for _, n in ipairs(core.nb[i]) do
			if core.terrain[n] == Core.WATER then
				local w = Config.tileCenter(n)
				cf = CFrame.lookAt(top, Vector3.new(w.X, top.Y, w.Z)) * CFrame.Angles(0, math.rad(Config.MODEL_YAW), 0)
				break
			end
		end
	end
	m:PivotTo(cf)
	m.Name = kind
	m:SetAttribute("Tile", i)
	m:SetAttribute("Level", level)
	if level > 1 then
		local gui = Instance.new("BillboardGui")
		gui.Size = UDim2.fromOffset(40, 18)
		gui.StudsOffsetWorldSpace = Vector3.new(0, T * 0.9, 0)
		gui.AlwaysOnTop = true
		gui.MaxDistance = 220
		local label = Instance.new("TextLabel")
		label.Size = UDim2.fromScale(1, 1)
		label.BackgroundTransparency = 0.3
		label.BackgroundColor3 = Color3.fromRGB(20, 22, 26)
		label.TextColor3 = Color3.new(1, 1, 1)
		label.Font = Enum.Font.GothamBold
		label.TextScaled = true
		label.Text = "ур. " .. level
		label.Parent = gui
		gui.Parent = m
	end
	m.Parent = buildingFolder
	buildingModels[i] = m
end

-- ------------------------------------------------------------ события ядра

local newRound

local function playerFx(kind, data)
	Fx:FireAllClients(kind, data)
end

local function handleEvent(e)
	local t = e.type
	if t == "building" then
		placeBuilding(e.tile, e.kind, e.level, e.owner)
	elseif t == "buildingOwner" then
		local m = buildingModels[e.tile]
		if m then
			Models.paint(m, nationColor(e.owner))
		end
	elseif t == "buildingRemoved" then
		local m = buildingModels[e.tile]
		if m then
			m:Destroy()
			buildingModels[e.tile] = nil
		end
	elseif t == "ship" then
		playerFx("ship", { kind = e.kind, color = nationColor(e.owner), path = e.path, duration = e.duration })
	elseif t == "nuke" then
		playerFx("nuke", { from = e.from, to = e.to, duration = e.duration, color = nationColor(e.owner) })
	elseif t == "nukeHit" then
		playerFx("boom", { tile = e.tile, radius = e.radius })
	elseif t == "notify" then
		if e.nation then
			local pl = playerOf[e.nation]
			if pl then
				Notice:FireClient(pl, { text = e.text })
			end
		else
			Notice:FireAllClients({ text = e.text })
		end
	elseif t == "allianceRequest" then
		local pl = playerOf[e.to]
		if pl then
			Notice:FireClient(pl, { request = e.from, text = core.nations[e.from].name .. " предлагает союз" })
		end
	elseif t == "eliminated" then
		local pl = playerOf[e.nation]
		if pl then
			Notice:FireClient(pl, { text = "Твоя страна уничтожена. Досмотри матч — новый раунд скоро", bad = true })
		end
	elseif t == "win" then
		if not roundOver then
			roundOver = true
			local n = core.nations[e.nation]
			Notice:FireAllClients({ win = e.nation, text = string.format("Победа: %s — %s", n.name, e.reason) })
			task.delay(Config.RESTART_DELAY, newRound)
		end
	end
end

-- танки едут к клеткам, которые сейчас захватывают
local tankTimers = {}
local function tankFx(dt)
	local budget = 10
	for _, at in ipairs(core.attacks) do
		if not at.done and at.last and budget > 0 then
			local timer = (tankTimers[at.id] or 0) - dt
			if timer <= 0 then
				timer = 1.1
				local to = at.last
				for _, n in ipairs(core.nb[to]) do
					if core.owner[n] == at.attacker then
						budget -= 1
						playerFx("tank", { from = n, to = to, color = nationColor(at.attacker) })
						break
					end
				end
			end
			tankTimers[at.id] = timer
		end
	end
end

-- ------------------------------------------------------------ игроки

local function joinPlayer(player)
	if not core or roundOver or nationOf[player] then
		return
	end
	local id = core:addNation(player.DisplayName, false, player.UserId)
	nationOf[player] = id
	playerOf[id] = player
	if core.phase == "play" then
		local ok = core:randomSpawn(id)
		if ok then
			Notice:FireClient(player, { text = "Ты появился на свободной земле. Расширяйся!" })
		else
			core.nations[id].alive = false
			Notice:FireClient(player, { text = "Свободной земли нет — подожди следующий раунд", bad = true })
		end
	else
		Notice:FireClient(player, { text = "Нажми на карту, чтобы выбрать место старта" })
	end
end

Players.PlayerAdded:Connect(joinPlayer)
Players.PlayerRemoving:Connect(function(player)
	local id = nationOf[player]
	if id and core then
		local n = core.nations[id]
		n.isBot = true
		n.name = n.name .. " (бот)"
		playerOf[id] = nil
	end
	nationOf[player] = nil
	lastActions[player] = nil
end)

local function int(v)
	if typeof(v) ~= "number" or v ~= v or v == math.huge or v == -math.huge then
		return nil
	end
	return math.floor(v)
end

Action.OnServerEvent:Connect(function(player, kind, a, b)
	local id = nationOf[player]
	if not core or not id or typeof(kind) ~= "string" then
		return
	end
	-- не больше 15 действий в секунду
	local now = os.clock()
	local rec = lastActions[player] or { t = now, n = 0 }
	if now - rec.t > 1 then
		rec.t, rec.n = now, 0
	end
	rec.n += 1
	lastActions[player] = rec
	if rec.n > 15 then
		return
	end

	local n = core.nations[id]
	local ok, msg = true, nil
	local ia = int(a)
	if kind == "tap" and ia then
		if core.phase == "spawn" then
			ok, msg = core:spawn(id, ia)
		else
			ok, msg = core:attackTile(id, ia, n.ratio)
		end
	elseif kind == "ratio" and typeof(a) == "number" and a == a then
		n.ratio = math.clamp(a, 0.05, 1)
	elseif kind == "build" and ia and typeof(b) == "string" then
		ok, msg = core:build(id, ia, b)
	elseif kind == "nuke" and ia then
		ok, msg = core:launchNuke(id, ia)
	elseif kind == "ally" and ia then
		ok, msg = core:requestAlliance(id, ia)
	elseif kind == "allyAt" and ia then
		local o = core.owner[ia]
		if o and o > 0 then
			ok, msg = core:requestAlliance(id, o)
		else
			ok, msg = false, "Здесь нет страны"
		end
	elseif kind == "answer" and ia then
		ok, msg = core:respondAlliance(id, ia, b == true)
	elseif kind == "break" and ia then
		ok, msg = core:breakAlliance(id, ia)
	end
	if not ok and msg then
		Notice:FireClient(player, { text = msg, bad = true })
	end
end)

-- ------------------------------------------------------------ раунды

newRound = function()
	roundOver = false
	core = Core.new(Config, os.time() + math.random(1, 1000000))
	nationOf, playerOf, tankTimers = {}, {}, {}
	buildMap()
	for _, p in ipairs(Players:GetPlayers()) do
		joinPlayer(p)
	end
	for _ = #core.nations + 1, Config.NATIONS do
		core:addNation(nil, true)
	end
	Fx:FireAllClients("reset", {})
end

newRound()

local stateAcc = 0
RunService.Heartbeat:Connect(function(dt)
	if not core then
		return
	end
	dt = math.min(dt, 0.2)
	core:step(dt)
	for i in pairs(core:takeDirty()) do
		paintTile(i)
	end
	for _, e in ipairs(core:takeEvents()) do
		handleEvent(e)
	end
	tankFx(dt)
	stateAcc += dt
	if stateAcc >= 0.5 then
		stateAcc = 0
		local snap = core:snapshot()
		for _, p in ipairs(Players:GetPlayers()) do
			local id = nationOf[p]
			State:FireClient(p, snap, id and core:personal(id) or nil)
		end
	end
end)
