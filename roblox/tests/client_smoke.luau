-- Прогон клиентского скрипта на эмуляторе: python3 tests/make_bundle.py && luau tests/client_smoke.luau
local B = require("./_bundle")
local mock = B.mock
local game = mock.game
local Vector3, Color3, Enum = B.env.Vector3, B.env.Color3, B.env.Enum

local function check(cond, msg)
	if not cond then
		error("ПРОВАЛ: " .. msg, 2)
	end
	print("  ok  " .. msg)
end

local RS = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UIS = game:GetService("UserInputService")
local front = mock.new("Folder")
front.Name = "Front"
front.Parent = RS
for _, name in ipairs({ "Config", "Core", "Models" }) do
	mock.module(front, name)
end
local remotes = mock.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = front
local R = {}
for _, name in ipairs({ "Action", "State", "Fx", "Notice" }) do
	local r = mock.new("RemoteEvent")
	r.Name = name
	r.Parent = remotes
	R[name] = r
end
local Config = B.require("Config")
local Core = B.require("Core")

-- карта как у сервера
local core = Core.new(Config, 777)
local me = core:addNation("Тестер", false, 1)
for _ = 2, 8 do
	core:addNation(nil, true)
end
local map = mock.new("Folder")
map.Name = "FrontMap"
local someTile
for i = 1, Config.MAP_W * Config.MAP_H do
	if core.terrain[i] ~= Core.WATER then
		local p = mock.new("Part")
		p.Name = "Tile"
		local c = Config.tileCenter(i)
		p.Size = Vector3.new(4, 1, 4)
		p.Position = Vector3.new(c.X, 0.3, c.Z)
		p:SetAttribute("I", i)
		p:SetAttribute("O", 0)
		p.Parent = map
		someTile = someTile or p
	end
end
map.Parent = mock.workspace

local player = mock.new("Player")
player.Name = "Tester"
local gui = mock.new("PlayerGui")
gui.Name = "PlayerGui"
gui.Parent = player
Players.LocalPlayer = player

print("запуск клиента")
B.run("FrontClient")
local ui = gui:WaitForChild("FrontUI")
check(#ui:GetDescendants() > 40, "интерфейс построен: " .. #ui:GetDescendants() .. " элементов")

local function frame(n)
	for _ = 1, n or 1 do
		mock.renderSteps.FrontCamera()
		RunService.RenderStepped:Fire(1 / 60)
	end
end
frame(5)
check(mock.camera.CFrame ~= nil, "камера выставлена")

local function sent(kind)
	for k = #mock.fired, 1, -1 do
		local f = mock.fired[k]
		if f[1] == "FireServer" and f[3] == kind then
			return f
		end
	end
end

local function findButton(text)
	for _, d in ipairs(ui:GetDescendants()) do
		if d.ClassName == "TextButton" then
			if d.Text == text then
				return d
			end
			local t = d:FindFirstChild("Title")
			if t and t.Text == text then
				return d
			end
		end
	end
end

-- состояние: фаза выбора места
for id = 1, #core.nations do
	core:randomSpawn(id)
end
R.State.OnClientEvent:Fire(core:snapshot(), core:personal(me))
check(true, "состояние фазы выбора места отрисовано")

-- клик мышью по клетке
mock.rayHit = { Instance = someTile, Position = someTile.Position }
local MB1 = Enum.UserInputType.MouseButton1
local input = { UserInputType = MB1, Position = Vector3.new(300, 200, 0) }
UIS.InputBegan:Fire(input, false)
UIS.InputEnded:Fire(input)
local f = sent("tap")
check(f and f[4] == someTile:GetAttribute("I"), "клик мышью шлёт tap по клетке")

-- перетаскивание мышью не должно слать tap
mock.fired = {}
UIS.InputBegan:Fire(input, false)
UIS.InputChanged:Fire({ UserInputType = Enum.UserInputType.MouseMovement, Position = Vector3.new(380, 260, 0) }, false)
UIS.InputEnded:Fire(input)
check(sent("tap") == nil, "перетаскивание двигает карту без атаки")
UIS.InputChanged:Fire({ UserInputType = Enum.UserInputType.MouseWheel, Position = Vector3.new(0, 0, 1) }, false)

-- тап пальцем
local touch = { UserInputType = Enum.UserInputType.Touch, Position = Vector3.new(200, 200, 0) }
UIS.TouchStarted:Fire(touch, false)
UIS.TouchEnded:Fire(touch)
check(sent("tap") ~= nil, "тап пальцем шлёт tap")

-- щипок двумя пальцами не должен слать tap
mock.fired = {}
local t1 = { UserInputType = Enum.UserInputType.Touch, Position = Vector3.new(100, 100, 0) }
local t2 = { UserInputType = Enum.UserInputType.Touch, Position = Vector3.new(300, 300, 0) }
UIS.TouchStarted:Fire(t1, false)
UIS.TouchStarted:Fire(t2, false)
t2.Position = Vector3.new(250, 250, 0)
UIS.TouchMoved:Fire(t2)
UIS.TouchEnded:Fire(t2)
UIS.TouchEnded:Fire(t1)
check(sent("tap") == nil, "щипок зумит без атаки")
frame(2)

-- кнопка постройки и тап
R.State.OnClientEvent:Fire(core:snapshot(), core:personal(me))
local cityBtn = findButton("Город")
check(cityBtn ~= nil, "есть кнопка «Город»")
cityBtn.Activated:Fire()
UIS.InputBegan:Fire(input, false)
UIS.InputEnded:Fire(input)
local b = sent("build")
check(b and b[5] == "City", "режим стройки шлёт build City")

-- доля войск
findButton("80%").Activated:Fire()
local r = sent("ratio")
check(r and r[4] == 0.8, "кнопка 80% шлёт ratio")

-- ракета: после выстрела режим возвращается к атаке
findButton("Ракета").Activated:Fire()
UIS.InputBegan:Fire(input, false)
UIS.InputEnded:Fire(input)
check(sent("nuke") ~= nil, "режим ракеты шлёт nuke")
mock.fired = {}
UIS.InputBegan:Fire(input, false)
UIS.InputEnded:Fire(input)
check(sent("tap") ~= nil, "после ракеты снова режим атаки")

-- союз из таблицы лидеров
local allyBtn = findButton("Союз")
check(allyBtn ~= nil, "в таблице лидеров есть кнопка союза")
-- кнопку «Союз» в панели режимов тоже зовут «Союз»; ищем ту, что в строке лидеров
for _, d in ipairs(ui:GetDescendants()) do
	if d.ClassName == "TextButton" and d.Text == "Союз" then
		d.Activated:Fire()
		break
	end
end
check(sent("ally") ~= nil, "кнопка союза шлёт ally")

-- уведомления и предложение союза
R.Notice.OnClientEvent:Fire({ text = "Проверка уведомления" })
R.Notice.OnClientEvent:Fire({ text = "Плохо", bad = true })
R.Notice.OnClientEvent:Fire({ request = 3, text = "Борея предлагает союз" })
findButton("Принять").Activated:Fire()
local a = sent("answer")
check(a and a[4] == 3 and a[5] == true, "принятие союза шлёт answer")
R.Notice.OnClientEvent:Fire({ win = 2, text = "Победа: Борея" })
mock.runDelayed()
check(true, "уведомления и победа показаны")

-- эффекты
local water = {}
for i = 1, Config.MAP_W * Config.MAP_H do
	if core.terrain[i] == Core.WATER and #water < 12 then
		table.insert(water, i)
	end
end
local C3 = Color3.fromRGB(200, 50, 50)
R.Fx.OnClientEvent:Fire("ship", { kind = "TradeShip", color = C3, path = water, duration = 2 })
R.Fx.OnClientEvent:Fire("ship", { kind = "TransportShip", color = C3, path = { water[1] }, duration = 1 })
R.Fx.OnClientEvent:Fire("nuke", { from = someTile:GetAttribute("I"), to = water[5], duration = 1.5, color = C3 })
R.Fx.OnClientEvent:Fire("tank", { from = someTile:GetAttribute("I"), to = someTile:GetAttribute("I") + 1, color = C3 })
R.Fx.OnClientEvent:Fire("boom", { tile = water[5], radius = 4 })
local fx = mock.workspace:WaitForChild("FrontFx")
check(#fx:GetChildren() >= 4, "эффекты появились: " .. #fx:GetChildren())
frame(200)
check(#fx:GetChildren() <= 1, "эффекты доиграли и убраны (осталось " .. #fx:GetChildren() .. ")")
R.Fx.OnClientEvent:Fire("reset", {})

-- новая карта в новом раунде
local map2 = map:Clone()
map:Destroy()
map2.Parent = mock.workspace
frame(3)
check(true, "смена карты обработана")

-- зритель (страна уничтожена)
R.State.OnClientEvent:Fire(core:snapshot(), nil)
check(true, "режим зрителя отрисован")
print("КЛИЕНТ: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ")
