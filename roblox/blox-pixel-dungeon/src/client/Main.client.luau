-- Blox Pixel Dungeon: запуск, титульный экран, управление и связь ядра с отрисовкой.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local GuiService = game:GetService("GuiService")
local StarterGui = game:GetService("StarterGui")

local player = Players.LocalPlayer
local Shared = ReplicatedStorage:WaitForChild("BPD")
local Core = Shared:WaitForChild("Core")
local Config = require(Shared:WaitForChild("Config"))
local Atlas = require(Shared:WaitForChild("Atlas"))
local Game = require(Core:WaitForChild("Game"))
local Terrain = require(Core:WaitForChild("Terrain"))
local Defs = require(Core:WaitForChild("Defs"))
local Modules = script.Parent:WaitForChild("Modules")
local Ui = require(Modules:WaitForChild("Ui"))
local View = require(Modules:WaitForChild("View"))
local Hud = require(Modules:WaitForChild("Hud"))

local T = Terrain
local report = ReplicatedStorage:WaitForChild("BPDReport", 10)

pcall(function()
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Health, false)
end)

local gui = Ui.new("ScreenGui", {
	Name = "BloxPixelDungeon",
	ResetOnSpawn = false,
	IgnoreGuiInset = true,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	Parent = player:WaitForChild("PlayerGui"),
})
Ui.new("Frame", { BackgroundColor3 = Color3.new(0, 0, 0), Size = UDim2.fromScale(1, 1), ZIndex = 0, Parent = gui })
Ui.Atlas = Atlas

------------------------------------------------------------------ графика

local loading = Ui.label(gui, "Загрузка графики…", 22, { Size = UDim2.fromScale(1, 1), ZIndex = 100 })
task.wait()

local function loadAtlas()
	if Config.ATLAS_ID ~= "" then
		return { image = Config.ATLAS_ID }
	end
	local ok, res = pcall(function()
		local Png = require(Shared:WaitForChild("Png"))
		local data = require(Shared:WaitForChild("AtlasData"))
		local img = Png.decode(Png.base64(data))
		local editable = game:GetService("AssetService"):CreateEditableImage({ Size = Vector2.new(img.width, img.height) })
		editable:WritePixelsBuffer(Vector2.zero, Vector2.new(img.width, img.height), img.buf)
		return { content = Content.fromObject(editable), editable = editable }
	end)
	if ok then
		return res
	end
	warn("[Blox Pixel Dungeon] Встроенная графика недоступна (" .. tostring(res) .. "). "
		.. "Загрузите assets/atlas.png и впишите ID в ReplicatedStorage.BPD.Config.ATLAS_ID.")
	return nil
end
Ui.atlas = loadAtlas()
loading:Destroy()

------------------------------------------------------------------ состояние

local g -- текущая партия (Game)
local view, hud
local zoom
local modal = 0
local travelTarget, resting, examine = nil, false, false
local lastAction = 0
local heldDir, heldSince = nil, 0
local titleFrame

local function defaultZoom()
	local h = gui.AbsoluteSize.Y
	return math.clamp(math.floor(h / (16 * 13) + 0.5), 2, 6)
end

local function stopAuto()
	travelTarget, resting = nil, false
end

local function openModal(win)
	modal = modal + 1
	stopAuto()
	win.shade.Destroying:Connect(function()
		modal = modal - 1
	end)
	return win
end

local onDeath, onWin

-- раздать события ядра отрисовке и интерфейсу
local function flush()
	for _, e in ipairs(g:takeEvents()) do
		if e.type == "level" then
			view:load(g)
		else
			view:handle(e)
		end
		if e.type == "log" then
			hud:log(e.text, e.color)
		elseif e.type == "dead" then
			task.delay(0.8, onDeath)
		elseif e.type == "win" then
			task.delay(1.0, onWin)
		end
	end
	hud:refresh(g)
end

local function canAct()
	return g and not g.over and modal == 0 and not titleFrame
end

local function act(fn)
	if not canAct() then
		return
	end
	g.interrupted = false
	fn()
	lastAction = os.clock()
	flush()
	if g.interrupted then
		stopAuto()
	end
end

------------------------------------------------------------------ окна

local showTitle

local function report_(won)
	if report then
		report:FireServer({ depth = g.stats.deepest, won = won, kills = g.stats.kills, gold = g.hero.gold })
	end
end

local function statsText()
	return string.format("Глубина: %d\nУровень: %d\nУбито врагов: %d\nЗолото: %d\nХодов: %d",
		g.stats.deepest, g.hero.lvl, g.stats.kills, g.hero.gold, g.stats.turns)
end

local startGame

onDeath = function()
	report_(false)
	openModal(hud:message("Вы погибли...", (g.deathCause or "") .. "\n\n" .. statsText(), {
		{ "Новая игра", function()
			startGame()
		end },
		{ "В меню", function()
			showTitle()
		end },
	}))
end

onWin = function()
	report_(true)
	openModal(hud:message("Победа!", "Гу повержен, канализация пройдена! Дальше — тюрьма, пещеры, город гномов и Йог-Дзот: их перенос ещё впереди.\n\n" .. statsText(), {
		{ "Новая игра", function()
			startGame()
		end },
		{ "В меню", function()
			showTitle()
		end },
	}))
end

local CREDITS = table.concat({
	Config.GAME_NAME .. " " .. Config.VERSION .. " — перенос Shattered Pixel Dungeon на Roblox.",
	"",
	"Shattered Pixel Dungeon — Evan Debenham (ShatteredPixel.com). Основана на открытом коде Pixel Dungeon от Watabou.",
	"Графика подземелья и персонажей: Aleksandar Komitov. Пиксель-арт предметов: PumpkinVolt. Доп. пиксель-арт: Alastair Braun.",
	"Музыка: Lumine Haaristo; Pixel Dungeon — Cube Code. Звуки: Celesti.",
	"Русский перевод — сообщество переводчиков Shattered Pixel Dungeon на Transifex.",
	"",
	"Код и графика распространяются по лицензии GNU GPL v3. Исходный код этой версии:",
	Config.SOURCE_URL,
}, "\n")

local function showAbout()
	local win = openModal(Ui.window(gui, "Об игре", 520))
	win.text(CREDITS, 14)
	local box = Ui.new("TextBox", {
		Text = "https://" .. Config.SOURCE_URL,
		TextEditable = false,
		ClearTextOnFocus = false,
		TextSize = 13,
		Font = Ui.FONT_REGULAR,
		TextColor3 = Ui.LOG.high,
		BackgroundColor3 = Ui.C.panelDark,
		Size = UDim2.new(1, 0, 0, 28),
		LayoutOrder = win.next(),
		ZIndex = 53,
		Parent = win.frame,
	})
	Ui.corner(box, 4)
	win.buttons({ { "Закрыть", function() end } })
end

local function showMenu()
	openModal(hud:message("Пауза", nil, {
		{ "Дальше", function() end },
		{ "Об игре", showAbout, true },
		{ "Заново", function()
			startGame()
		end },
		{ "В меню", function()
			showTitle()
		end },
	}, 460))
end

local function describeCell(pos)
	local ch = g:charAt(pos)
	if ch and ch.isHero then
		local hero = g.hero
		return "Это вы", string.format("Воин %d уровня. Здоровье %d/%d, сила %d, опыт %d/%d.",
			hero.lvl, hero.hp, hero.ht, hero.str, hero.exp, Game.maxExp(hero.lvl))
	end
	if ch and g:mobVisible(ch) then
		return ch.def.Name, g:mobDesc(ch) .. string.format("\n\nЗдоровье: %d/%d", ch.hp, ch.ht)
	end
	local heap = g.heaps[pos]
	if heap and g.visited[pos] and heap[#heap] then
		local item = heap[#heap]
		return g:itemName(item), g:itemDesc(item)
	end
	if not (g.visited[pos] or g.mapped[pos]) then
		return nil
	end
	local t = g.level.map[pos]
	local names = {
		[T.EMPTY] = { "Пол", "" },
		[T.EMPTY_DECO] = { "Пол", "На полу валяется сор." },
		[T.GRASS] = { "Трава", "" },
		[T.HIGH_GRASS] = { "Высокая трава", "Густая растительность загораживает обзор." },
		[T.WATER] = { "Вода", "В воде можно смыть едкую слизь." },
		[T.DOOR] = { "Закрытая дверь", "" },
		[T.OPEN_DOOR] = { "Открытая дверь", "" },
		[T.ENTRANCE] = { "Вход на этаж", "Ступени ведут на уровень выше." },
		[T.EXIT] = { "Выход с этажа", "Ступени ведут на уровень ниже." },
		[T.WALL] = { "Стена", "" },
		[T.WALL_DECO] = { "Стена", "Из трубы сочится вонючая вода." },
	}
	local n = names[t]
	if n then
		return n[1], n[2] ~= "" and n[2] or nil
	end
	return nil
end

local function examineCell(pos)
	local title, text = describeCell(pos)
	if title then
		openModal(hud:message(title, text))
	end
end

-- выбор предмета для свитка улучшения/опознания
local function pickTarget(scroll, res)
	openModal(hud:inventory(g, res.title, function(target)
		act(function()
			g:useItem(scroll, "read", target)
		end)
	end, function(item)
		return item ~= scroll and g:canTarget(res.needTarget, item)
	end))
end

local function openInventory()
	if not canAct() then
		return
	end
	openModal(hud:inventory(g, nil, function(item, equipped)
		openModal(hud:itemWindow(g, item, equipped, function(action)
			local res
			act(function()
				res = g:useItem(item, action)
			end)
			if res and res.needTarget then
				pickTarget(item, res)
			end
		end))
	end))
end

------------------------------------------------------------------ игра

local function setZoom(z)
	zoom = math.clamp(z, 2, 7)
	if view then
		view.zoom = zoom
		view:load(g)
	end
end

startGame = function()
	if titleFrame then
		titleFrame:Destroy()
		titleFrame = nil
	end
	stopAuto()
	g = Game.new(os.time() + player.UserId)
	zoom = zoom or defaultZoom()
	if not view then
		view = View.new(gui, zoom)
		hud = Hud.new(gui, {
			menu = function()
				if modal == 0 then
					showMenu()
				end
			end,
			zoom = function(d)
				setZoom(zoom + d)
			end,
			inventory = openInventory,
			examine = function()
				examine = not examine
				hud:setExamine(examine)
			end,
			wait = function()
				act(function()
					g:heroRest()
				end)
			end,
			rest = function()
				if canAct() then
					resting = true
				end
			end,
			attackNearest = function()
				local enemies = g and g:visibleEnemies() or {}
				if enemies[1] then
					travelTarget = enemies[1].pos
				end
			end,
		})
	end
	hud:clearLog()
	hud.root.Visible = true
	view.root.Visible = true
	flush()
end

------------------------------------------------------------------ титульный экран

showTitle = function()
	stopAuto()
	if hud then
		hud.root.Visible = false
		view.root.Visible = false
	end
	titleFrame = Ui.new("Frame", {
		BackgroundColor3 = Color3.fromRGB(16, 14, 13),
		Size = UDim2.fromScale(1, 1),
		ZIndex = 40,
		Parent = gui,
	})
	local col = Ui.new("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(420, 420),
		BackgroundTransparency = 1,
		Parent = titleFrame,
	})
	Ui.new("UIListLayout", {
		Padding = UDim.new(0, 12),
		HorizontalAlignment = Enum.HorizontalAlignment.Center,
		VerticalAlignment = Enum.VerticalAlignment.Center,
		SortOrder = Enum.SortOrder.LayoutOrder,
		Parent = col,
	})
	Ui.new("UIScale", {
		Scale = math.min(1, (gui.AbsoluteSize.X - 20) / 420, (gui.AbsoluteSize.Y - 20) / 400),
		Parent = col,
	})
	Ui.label(col, "BLOX PIXEL DUNGEON", 38, {
		Size = UDim2.new(1, 0, 0, 44),
		TextColor3 = Color3.fromRGB(255, 214, 90),
		TextStrokeTransparency = 0.2,
		TextStrokeColor3 = Color3.fromRGB(120, 60, 0),
		LayoutOrder = 1,
	})
	Ui.label(col, "Shattered Pixel Dungeon на Roblox · глава 1: Канализация", 15, {
		Size = UDim2.new(1, 0, 0, 18),
		TextColor3 = Ui.C.dim,
		LayoutOrder = 2,
	})
	local hero = Ui.image(col, { Size = UDim2.fromOffset(12 * 7, 15 * 7), LayoutOrder = 3 })
	local frames, t = Defs.hero.anim.idle, 0
	local conn
	conn = RunService.RenderStepped:Connect(function(dt)
		if not hero.Parent then
			conn:Disconnect()
			return
		end
		t = t + dt
		local f = frames[2][math.floor(t * 2) % #frames[2] + 1]
		local x, y, w, h = Ui.charFrame("warrior", f, 1)
		Ui.setRect(hero, x, y, w, h)
	end)
	local stats = player:FindFirstChild("leaderstats")
	local best = stats and stats:FindFirstChild("Глубина")
	local wins = stats and stats:FindFirstChild("Победы")
	Ui.label(col, string.format("Рекорд: глубина %d · побед %d", best and best.Value or 0, wins and wins.Value or 0), 15, {
		Size = UDim2.new(1, 0, 0, 18),
		TextColor3 = Ui.C.gold,
		LayoutOrder = 4,
	})
	Ui.button(col, "Играть", function()
		startGame()
	end, { Size = UDim2.fromOffset(240, 52), TextSize = 22, LayoutOrder = 5 })
	Ui.button(col, "Об игре", showAbout, { Size = UDim2.fromOffset(240, 40), LayoutOrder = 6 })
	if not Ui.atlas then
		Ui.label(col, "Графика не загружена — см. README (ATLAS_ID).", 13, {
			Size = UDim2.new(1, 0, 0, 16),
			TextColor3 = Ui.LOG.warn,
			LayoutOrder = 7,
		})
	end
	Ui.label(titleFrame, "v" .. Config.VERSION .. " · GPL-3.0 · основано на Shattered Pixel Dungeon", 12, {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -8),
		Size = UDim2.new(1, 0, 0, 14),
		TextColor3 = Ui.C.dim,
	})
end

------------------------------------------------------------------ ввод

local KEYS = {
	[Enum.KeyCode.W] = { 0, -1 }, [Enum.KeyCode.Up] = { 0, -1 }, [Enum.KeyCode.KeypadEight] = { 0, -1 },
	[Enum.KeyCode.S] = { 0, 1 }, [Enum.KeyCode.Down] = { 0, 1 }, [Enum.KeyCode.KeypadTwo] = { 0, 1 },
	[Enum.KeyCode.A] = { -1, 0 }, [Enum.KeyCode.Left] = { -1, 0 }, [Enum.KeyCode.KeypadFour] = { -1, 0 },
	[Enum.KeyCode.D] = { 1, 0 }, [Enum.KeyCode.Right] = { 1, 0 }, [Enum.KeyCode.KeypadSix] = { 1, 0 },
	[Enum.KeyCode.Q] = { -1, -1 }, [Enum.KeyCode.KeypadSeven] = { -1, -1 },
	[Enum.KeyCode.E] = { 1, -1 }, [Enum.KeyCode.KeypadNine] = { 1, -1 },
	[Enum.KeyCode.Z] = { -1, 1 }, [Enum.KeyCode.KeypadOne] = { -1, 1 },
	[Enum.KeyCode.C] = { 1, 1 }, [Enum.KeyCode.KeypadThree] = { 1, 1 },
	[Enum.KeyCode.DPadUp] = { 0, -1 }, [Enum.KeyCode.DPadDown] = { 0, 1 },
	[Enum.KeyCode.DPadLeft] = { -1, 0 }, [Enum.KeyCode.DPadRight] = { 1, 0 },
}

local function step(dir)
	act(function()
		g:heroStep(dir[1], dir[2])
	end)
end

local function onTap(screen)
	if not canAct() then
		return
	end
	local pos = view:cellAt(screen)
	if not pos then
		return
	end
	if examine then
		examine = false
		hud:setExamine(false)
		examineCell(pos)
		return
	end
	stopAuto()
	if pos == g.hero.pos then
		act(function()
			g:heroTravel(pos)
		end)
		return
	end
	travelTarget = pos
end

local press -- начало касания/клика по карте
UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	local t = input.UserInputType
	if t == Enum.UserInputType.MouseButton1 or t == Enum.UserInputType.Touch then
		local inset = GuiService:GetGuiInset()
		press = { pos = Vector2.new(input.Position.X, input.Position.Y) + inset, time = os.clock(), input = input }
	elseif t == Enum.UserInputType.MouseButton2 then
		if canAct() then
			local inset = GuiService:GetGuiInset()
			local pos = view:cellAt(Vector2.new(input.Position.X, input.Position.Y) + inset)
			if pos then
				examineCell(pos)
			end
		end
	elseif t == Enum.UserInputType.Keyboard or t == Enum.UserInputType.Gamepad1 then
		local k = input.KeyCode
		if titleFrame then
			if k == Enum.KeyCode.Return or k == Enum.KeyCode.ButtonA then
				startGame()
			end
			return
		end
		local dir = KEYS[k]
		if dir then
			stopAuto()
			step(dir)
			heldDir, heldSince = dir, os.clock()
		elseif k == Enum.KeyCode.Space or k == Enum.KeyCode.Period or k == Enum.KeyCode.KeypadFive or k == Enum.KeyCode.ButtonX then
			act(function()
				g:heroRest()
			end)
		elseif k == Enum.KeyCode.I or k == Enum.KeyCode.Tab or k == Enum.KeyCode.ButtonY then
			openInventory()
		elseif k == Enum.KeyCode.G then
			act(function()
				g:heroTravel(g.hero.pos)
			end)
		elseif k == Enum.KeyCode.R then
			if canAct() then
				resting = true
			end
		elseif k == Enum.KeyCode.F or k == Enum.KeyCode.ButtonB then
			local enemies = canAct() and g:visibleEnemies() or {}
			if enemies[1] then
				travelTarget = enemies[1].pos
			end
		end
	end
end)

UserInputService.InputEnded:Connect(function(input)
	local t = input.UserInputType
	if (t == Enum.UserInputType.MouseButton1 or t == Enum.UserInputType.Touch) and press then
		local inset = GuiService:GetGuiInset()
		local pos = Vector2.new(input.Position.X, input.Position.Y) + inset
		local p = press
		press = nil
		if (pos - p.pos).Magnitude < 14 then
			if os.clock() - p.time > 0.5 then
				if canAct() then
					local cell = view:cellAt(pos)
					if cell then
						examineCell(cell)
					end
				end
			else
				onTap(pos)
			end
		end
	elseif t == Enum.UserInputType.Keyboard or t == Enum.UserInputType.Gamepad1 then
		if KEYS[input.KeyCode] == heldDir then
			heldDir = nil
		end
	end
end)

-- перетаскивание по карте не двигает героя, а отменяет касание
UserInputService.InputChanged:Connect(function(input)
	if press and input == press.input then
		local inset = GuiService:GetGuiInset()
		local pos = Vector2.new(input.Position.X, input.Position.Y) + inset
		if (pos - press.pos).Magnitude >= 14 then
			press = nil
		end
	end
end)

RunService.RenderStepped:Connect(function(dt)
	if view and g then
		view:update(dt)
		hud:update()
		local now = os.clock()
		if canAct() then
			if heldDir and now - heldSince > 0.3 and now - lastAction > 0.14 then
				step(heldDir)
			elseif travelTarget and now - lastAction > 0.11 then
				local target = travelTarget
				act(function()
					if not g:heroTravel(target) then
						travelTarget = nil
					end
				end)
			elseif resting and now - lastAction > 0.06 then
				if g.hero.hp >= g.hero.ht or #g:visibleEnemies() > 0 then
					resting = false
				else
					act(function()
						g:heroRest()
					end)
				end
			end
		end
	end
end)

showTitle()
