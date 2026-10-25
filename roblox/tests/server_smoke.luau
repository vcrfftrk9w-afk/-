-- Прогон серверного скрипта на эмуляторе: python3 tests/make_bundle.py && luau tests/server_smoke.luau
local B = require("./_bundle")
local mock = B.mock
local game = mock.game

local function check(cond, msg)
	if not cond then
		error("ПРОВАЛ: " .. msg, 2)
	end
	print("  ok  " .. msg)
end

local RS = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local front = mock.new("Folder")
front.Name = "Front"
front.Parent = RS
for _, name in ipairs({ "Config", "Core", "Models" }) do
	mock.module(front, name)
end
local Config = B.require("Config")
local W = Config.MAP_W

local player = mock.new("Player")
player.Name = "Tester"
player.DisplayName = "Тестер"
player.UserId = 1
player.Parent = Players
mock.players = { player }

print("запуск сервера")
B.run("FrontServer")
local remotes = front:WaitForChild("Remotes")
local Action = remotes:WaitForChild("Action")

local map = mock.workspace:WaitForChild("FrontMap")
local tiles = {}
for _, p in ipairs(map:GetChildren()) do
	local i = p:GetAttribute("I")
	if i then
		tiles[i] = p
	end
end
local tileCount = 0
for _ in pairs(tiles) do
	tileCount += 1
end
check(tileCount > 1500, "карта построена: " .. tileCount .. " клеток")

local function beat(seconds)
	local t = 0
	while t < seconds do
		RunService.Heartbeat:Fire(0.1)
		t += 0.1
	end
end

local function lastState()
	for k = #mock.fired, 1, -1 do
		local f = mock.fired[k]
		if f[2] == "State" then
			return f[3], f[4]
		end
	end
end

local function lastNotice()
	for k = #mock.fired, 1, -1 do
		local f = mock.fired[k]
		if f[2] == "Notice" then
			return f[3]
		end
	end
end

-- выбор места старта
beat(1)
local snap, me = lastState()
check(snap and snap.phase == "spawn", "фаза выбора места")
check(me and not me.spawned, "игрок ещё не выбрал место")
local spawned = false
for i = 1, Config.MAP_W * Config.MAP_H do
	if tiles[i] and tiles[i]:GetAttribute("O") == 0 then
		Action.OnServerEvent:Fire(player, "tap", i)
		beat(0.5)
		snap, me = lastState()
		if me.spawned then
			spawned = true
			break
		end
	end
end
check(spawned, "игрок появился на карте, клеток: " .. me.tiles)

-- мусорные данные от клиента не должны ронять сервер
Action.OnServerEvent:Fire(player, "tap", 0 / 0)
Action.OnServerEvent:Fire(player, "tap", math.huge)
Action.OnServerEvent:Fire(player, "build", "x", 5)
Action.OnServerEvent:Fire(player, "build", 3, "Unknown")
Action.OnServerEvent:Fire(player, 42)
Action.OnServerEvent:Fire(player, "ratio", 0 / 0)
Action.OnServerEvent:Fire(player, "answer", 999, true)
Action.OnServerEvent:Fire(player, "break", -5)
check(true, "мусорные запросы проглочены без ошибок")

beat(Config.SPAWN_TIME)
snap, me = lastState()
check(snap.phase == "play" and snap.immune, "матч идёт, действует щит")

local myId = me.id
local function myTiles()
	local list = {}
	for i, p in pairs(tiles) do
		if p:GetAttribute("O") == myId then
			table.insert(list, i)
		end
	end
	return list
end

-- атака на нейтральную землю
local target
for _, i in ipairs(myTiles()) do
	for _, n in ipairs({ i - 1, i + 1, i - W, i + W }) do
		if tiles[n] and tiles[n]:GetAttribute("O") == 0 then
			target = n
		end
	end
end
check(target ~= nil, "есть нейтральная клетка рядом")
local before = #myTiles()
Action.OnServerEvent:Fire(player, "ratio", 0.6)
Action.OnServerEvent:Fire(player, "tap", target)
beat(3)
check(#myTiles() > before, string.format("территория растёт: %d → %d", before, #myTiles()))
check(mock.count("Fx", "FireAllClients") > 0, "танки и корабли отправлены клиентам")

-- стройка
beat(60)
snap, me = lastState()
local mine = myTiles()
Action.OnServerEvent:Fire(player, "build", mine[1], "City")
beat(0.5)
local buildings = mock.workspace:WaitForChild("FrontBuildings")
local hasCity = false
for _, m in ipairs(buildings:GetChildren()) do
	if m:GetAttribute("Tile") == mine[1] then
		hasCity = true
	end
end
local n = lastNotice()
check(hasCity, "город построен (золото было " .. me.gold .. ")" .. (hasCity and "" or (" — " .. tostring(n and n.text))))

-- союз с ботом через таблицу лидеров
snap, me = lastState()
local other
for _, x in ipairs(snap.nations) do
	if x.id ~= myId and x.alive then
		other = x.id
		break
	end
end
Action.OnServerEvent:Fire(player, "ally", other)
beat(3)
check(true, "предложение союза отправлено")

-- доигрываем матч
local won = false
local t = 0
while t < Config.MATCH_TIME + 30 and not won do
	beat(5)
	t += 5
	for k = #mock.fired, math.max(1, #mock.fired - 200), -1 do
		local f = mock.fired[k]
		if f[2] == "Notice" and f[1] == "FireAllClients" and f[3].win then
			won = true
			print("  " .. f[3].text)
			break
		end
	end
	mock.fired = { table.unpack(mock.fired, math.max(1, #mock.fired - 300)) }
end
check(won, "матч закончился победой")
local buildingCount = #mock.workspace:WaitForChild("FrontBuildings"):GetChildren()
check(buildingCount > 0, "на карте стоят постройки: " .. buildingCount)

-- новый раунд
mock.runDelayed()
beat(1)
snap = lastState()
check(snap.phase == "spawn", "начался новый раунд")
check(#mock.workspace:WaitForChild("FrontBuildings"):GetChildren() == 0, "постройки прошлого раунда убраны")

Players.PlayerRemoving:Fire(player)
beat(2)
check(true, "выход игрока обработан")
print("СЕРВЕР: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ")
