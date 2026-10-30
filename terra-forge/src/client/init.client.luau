-- Terra Forge client: shows the menu and the battle, and forwards taps to the server.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local StarterGui = game:GetService("StarterGui")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- errors are shown on screen too, so they can be reported from a phone with a screenshot
local errorLabel = nil
local errorCount = 0
local lastError = ""
local function showError(where: string, err)
	local text = tostring(err)
	if text == lastError then
		return
	end
	lastError = text
	errorCount += 1
	warn("[Terra Forge] " .. where .. ": " .. text)
	if errorCount > 20 then
		return
	end
	if not errorLabel then
		local gui = Instance.new("ScreenGui")
		gui.Name = "TerraForgeErrors"
		gui.ResetOnSpawn = false
		gui.DisplayOrder = 100
		local frame = Instance.new("TextButton")
		frame.AutoButtonColor = false
		frame.Text = ""
		frame.AnchorPoint = Vector2.new(0.5, 1)
		frame.Position = UDim2.new(0.5, 0, 1, -10)
		frame.Size = UDim2.new(0.9, 0, 0, 0)
		frame.AutomaticSize = Enum.AutomaticSize.Y
		frame.BackgroundColor3 = Color3.fromRGB(60, 14, 18)
		frame.BackgroundTransparency = 0.05
		frame.Parent = gui
		Instance.new("UICorner").Parent = frame
		local pad = Instance.new("UIPadding")
		pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 12), UDim.new(0, 12)
		pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 8), UDim.new(0, 8)
		pad.Parent = frame
		errorLabel = Instance.new("TextLabel")
		errorLabel.BackgroundTransparency = 1
		errorLabel.Size = UDim2.new(1, 0, 0, 0)
		errorLabel.AutomaticSize = Enum.AutomaticSize.Y
		errorLabel.TextWrapped = true
		errorLabel.TextXAlignment = Enum.TextXAlignment.Left
		errorLabel.TextSize = 13
		errorLabel.TextColor3 = Color3.fromRGB(255, 220, 220)
		errorLabel.Font = Enum.Font.Code
		errorLabel.Parent = frame
		frame.Activated:Connect(function()
			gui.Enabled = false
		end)
		gui.Parent = playerGui
	end
	errorLabel.Parent.Parent.Enabled = true
	errorLabel.Text = "Ошибка Terra Forge (" .. where .. "). Сделай скриншот и пришли его. Нажми, чтобы скрыть.\n" .. string.sub(tostring(err), 1, 700)
end

local function safe(where: string, fn, ...)
	local ok, err = xpcall(fn, debug.traceback, ...)
	if not ok then
		showError(where, err)
	end
	return ok
end

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Art = require(script.Art)
local MapView = require(script.MapView)
local Sfx = require(script.Sfx)
local UI = require(script.Ui)

local remotes = ReplicatedStorage:WaitForChild("TerraForgeRemotes")
local event = remotes:WaitForChild("Event") :: RemoteEvent
local action = remotes:WaitForChild("Action") :: RemoteEvent

for _, kind in { Enum.CoreGuiType.PlayerList, Enum.CoreGuiType.Backpack, Enum.CoreGuiType.Health } do
	pcall(function()
		StarterGui:SetCoreGuiEnabled(kind, false)
	end)
end

safe("карта", MapView.init, playerGui)
safe("интерфейс", UI.init, playerGui, player)
safe("мини-карта", MapView.attachMinimap, UI.minimap)
safe("меню", function()
	MapView.setMode("menu")
	UI.showMenu()
end)

-- the pictures reach the game a moment after it starts; say so if they never do
task.delay(30, function()
	if not Art.get("atlas") or not Art.get("map0") then
		safe("картинки", UI.artError)
	end
end)

local state = {
	screen = "menu",
	phase = "none",
	timer = 0,
	spectator = false,
	wantPlay = false,
	eco = nil,
	defeated = false,
	rallyFor = nil,
	amove = false, -- attack-move is armed: the next tap on the map gives it
	groups = {}, -- number key -> unit ids
}

local function me()
	return MapView.nations[MapView.myId]
end

local function goMenu()
	state.screen = "menu"
	state.spectator = false
	state.defeated = false
	state.rallyFor = nil
	state.amove = false
	MapView.boxArmed = false
	UI.setArmed("amove", false)
	UI.setArmed("box", false)
	MapView.setMode("menu")
	UI.showMenu()
end

-- moves the camera to the player's command centre; false when there is none
local function goHome(instant: boolean?): boolean
	local x, y = MapView.myBase()
	if x and y then
		MapView.focusOn(x, y + 2, instant)
		return true
	end
	return false
end

local function enterPlay(spectator: boolean)
	local starting = state.screen ~= "play" or state.spectator
	state.screen = "play"
	state.spectator = spectator
	state.rallyFor = nil
	state.defeated = false
	MapView.spectator = spectator
	MapView.setMode("play")
	UI.showPlay(state.phase, spectator)
	local n = me()
	if n then
		UI.setMyColor(n.color)
	end
	if not goHome(true) then
		MapView.focusOn(Map.W / 2, Map.H / 2, true)
	end
	if starting and not spectator and state.phase == "game" then
		UI.announce("БОЙ НАЧАЛСЯ", "Строй базу и разгроми врагов")
		task.delay(2.6, function()
			if state.screen == "play" and not state.spectator then
				UI.toast("Выбери внизу «Экстрактор» и нажми на светящееся месторождение рядом с базой — это деньги. Потом построй казарму и завод бронетехники.", false, 8)
			end
		end)
	end
end

local handlers = {}

function handlers.snapshot(msg)
	MapView.load(msg)
	state.phase = msg.phase
	state.timer = msg.timer
	if msg.you ~= 0 then
		enterPlay(false)
	elseif state.wantPlay then
		enterPlay(true)
	elseif state.screen == "play" then
		goMenu()
		UI.toast("Начался новый бой. Нажми «ИГРАТЬ», чтобы зайти в него.")
	end
	state.wantPlay = false
end

function handlers.nation(msg)
	MapView.upsertNation(msg.n)
	if msg.n.id == MapView.myId then
		UI.setMyColor(msg.n.color)
	end
end

function handlers.stats(msg)
	MapView.setStats(msg.s)
	state.phase = msg.phase
	state.timer = msg.timer
end

function handlers.phase(msg)
	state.phase = msg.phase
	state.timer = msg.timer
	MapView.setPhase(msg.phase)
	if state.screen ~= "play" then
		return
	end
	if msg.phase == "ended" then
		UI.setPhase("ended", state.spectator)
		UI.results(msg, MapView.myId)
		MapView.setBuild(nil)
		MapView.revealAll()
		if not state.spectator then
			Sfx.play(if msg.winner ~= 0 and msg.winner == MapView.myId then "win" else "lose")
		end
	end
end

function handlers.building(msg)
	MapView.addBuilding(msg.b)
end

function handlers.bgone(msg)
	MapView.removeBuilding(msg.id)
	if UI.factoryId == msg.id then
		UI.hideFactory()
	end
end

function handlers.unit(msg)
	MapView.addUnit(msg.u)
end

function handlers.ugone(msg)
	MapView.removeUnit(msg.id)
end

---------------------------------------------------------------- unit selection

-- unit kind -> army panel group
local groupOf = {}
for g, group in UI.GROUPS do
	for _, kind in group.kinds do
		groupOf[kind] = g
	end
end

local ORDER_TEXT = { move = "едут", amove = "атака с ходу", attack = "атакуют цель", stop = "стоят", hold = "держат позицию" }

-- one line about the selected units: what they are, their health, guns and current order
local function selectionInfo(): string?
	local kinds, count, hp, maxHp, order = {}, 0, 0, 0, nil
	for id in MapView.selected do
		local u = MapView.unitRecord(id)
		if u then
			count += 1
			kinds[u.kind] = (kinds[u.kind] or 0) + 1
			hp += u.hp
			maxHp += u.maxHp
			order = order or u.orderText
		end
	end
	if count == 0 then
		return nil
	end
	local health = math.floor(hp / math.max(maxHp, 1) * 100 + 0.5)
	local tail = if order then " · " .. order else ""
	local only = next(kinds)
	if next(kinds, only) == nil then
		local def = Config.UNITS[only]
		return string.format("%s ×%d · здоровье %d%% · урон %d/с · дальность %g · скорость %g%s", def.title, count, health, def.dps, def.range, def.speed, tail)
	end
	local parts = {}
	for _, kind in Config.UNIT_ORDER do
		if kinds[kind] then
			table.insert(parts, Config.UNITS[kind].title .. " " .. kinds[kind])
		end
	end
	return string.format("%s · здоровье %d%%%s", table.concat(parts, ", "), health, tail)
end

local function refreshArmy()
	MapView.refreshSelection()
	local counts = { inf = 0, veh = 0, air = 0 }
	local selected = { inf = 0, veh = 0, air = 0 }
	for _, id in MapView.ownUnits(nil) do
		local u = MapView.unitRecord(id)
		local g = u and groupOf[u.kind]
		if g then
			counts[g] += 1
			if MapView.selected[id] then
				selected[g] += 1
			end
		end
	end
	UI.setArmy(counts, selected, selectionInfo())
end

local function selectedIds(): { number }
	local ids = {}
	for id in MapView.selected do
		table.insert(ids, id)
	end
	return ids
end

local function shiftHeld(): boolean
	return UserInputService:IsKeyDown(Enum.KeyCode.LeftShift) or UserInputService:IsKeyDown(Enum.KeyCode.RightShift)
end

-- with a mouse a click picks one unit (Shift adds); on a touch screen a tap adds or removes
local function viaMouse(): boolean
	local t = UserInputService:GetLastInputType()
	return t == Enum.UserInputType.MouseButton1 or t == Enum.UserInputType.MouseButton2 or t == Enum.UserInputType.MouseMovement
end

local function select(ids: { number }, add: boolean)
	if not add then
		table.clear(MapView.selected)
	end
	for _, id in ids do
		MapView.selected[id] = true
	end
	refreshArmy()
end

local function setAmove(on: boolean)
	state.amove = on
	UI.setArmed("amove", on)
end

UI.onSelectKind = function(group)
	local ids = {}
	for _, id in MapView.ownUnits(nil) do
		local u = MapView.unitRecord(id)
		if u and (group == "all" or groupOf[u.kind] == group) then
			table.insert(ids, id)
		end
	end
	local allOn = #ids > 0
	for _, id in ids do
		if not MapView.selected[id] then
			allOn = false
			break
		end
	end
	for _, id in ids do
		MapView.selected[id] = if allOn then nil else true
	end
	if #ids == 0 then
		UI.toast("Таких войск пока нет. Построй казарму, завод бронетехники или аэродром.")
	end
	refreshArmy()
end

UI.onClearSelection = function()
	table.clear(MapView.selected)
	setAmove(false)
	refreshArmy()
end

UI.onQueue = function(id, kind)
	action:FireServer("queue", id, kind)
end

UI.onCancel = function(id)
	action:FireServer("cancel", id)
end

UI.onAuto = function(id, kind)
	action:FireServer("auto", id, kind)
end

UI.onBase = function()
	if not goHome(false) then
		UI.toast("Командного центра больше нет.", true)
	end
end

UI.onRally = function(id)
	state.rallyFor = id
	UI.hideFactory()
	UI.toast("Нажми на карту, куда новым юнитам ехать после выпуска.")
end

UI.onBuildSelect = function(kind)
	MapView.setBuild(kind)
	if kind then
		table.clear(MapView.selected)
		refreshArmy()
	end
end

UI.onZoom = function(f)
	MapView.zoom(f)
end

function handlers.fx(msg)
	MapView.marker(msg.x, msg.y)
end

function handlers.boom(msg)
	MapView.boom(msg.x, msg.y, msg.big)
end

function handlers.shots(msg)
	MapView.shots(msg.s)
end

function handlers.hp(msg)
	MapView.setUnitHp(msg.s)
end

function handlers.bhp(msg)
	MapView.setBuildingHp(msg.s)
end

local function factoryInfo(id: number)
	local b = MapView.buildingRecord(id)
	if not b then
		return nil
	end
	return { id = id, kind = b.kind, prog = b.prog, built = b.built, queue = b.queue, auto = b.auto }
end

local function refreshFactory()
	local id = UI.factoryId
	if not id then
		return
	end
	local info = factoryInfo(id)
	if info then
		UI.showFactory(info)
	else
		UI.hideFactory()
	end
end

function handlers.eco(msg)
	state.eco = msg
	MapView.setProgress(msg.list)
	UI.setEconomy(msg)
	refreshFactory()
end

function handlers.bdone(msg)
	MapView.finishBuilding(msg.id)
	if UI.factoryId == msg.id then
		refreshFactory()
	end
end

function handlers.toast(msg)
	if state.screen == "play" or state.wantPlay then
		UI.toast(msg.text, msg.warn)
	end
end

-- the base is under attack: a siren, a warning and a red ring where it happens
function handlers.alert(msg)
	if state.screen == "play" and not state.spectator then
		Sfx.play("alarm")
		UI.toast("База атакована! Кнопка с командным центром наверху вернёт к ней.", true, 4)
		MapView.marker(msg.x, msg.y, Color3.fromRGB(255, 80, 70), 5)
	end
end

function handlers.defeat()
	state.defeated = true
	Sfx.play("lose")
	if state.screen == "play" then
		MapView.setBuild(nil)
		MapView.revealAll()
		UI.hideFactory()
		UI.defeat()
	end
end

function handlers.lobby(msg)
	UI.setLobby(msg)
end

function handlers.error(msg)
	showError("сервер", msg.text)
end

function handlers.nomatch()
	MapView.clear()
	state.phase = "none"
	if state.screen == "play" then
		goMenu()
	end
end

event.OnClientEvent:Connect(function(kind, batch)
	if kind ~= "batch" or typeof(batch) ~= "table" then
		return
	end
	for _, msg in batch do
		local h = handlers[msg.t]
		if h then
			safe("сообщение " .. tostring(msg.t), h, msg)
		end
	end
end)

---------------------------------------------------------------- player input

UI.onPlay = function()
	state.wantPlay = true
	action:FireServer("play")
end

UI.onLeave = function()
	action:FireServer("leave")
	goMenu()
end

local function ownerName(owner: number): string
	local n = MapView.nations[owner]
	return if n then n.name else "?"
end

local function canCommand(): boolean
	return state.screen == "play" and not state.spectator and not state.defeated and state.phase == "game"
end

-- an order for the selected units; targetRef = enemy unit id, or minus a building id
local function sendOrder(kind: string, x: number, y: number, targetRef: number?): boolean
	local ids = selectedIds()
	if #ids == 0 then
		return false
	end
	action:FireServer("order", ids, x, y, kind, targetRef)
	for _, id in ids do
		local u = MapView.unitRecord(id)
		if u then
			u.orderText = ORDER_TEXT[kind]
		end
	end
	Sfx.play("order")
	refreshArmy()
	return true
end

local RED = Color3.fromRGB(255, 80, 70)
local ORANGE = Color3.fromRGB(255, 170, 60)

-- the fog of war lifts off an enemy after a quiet while
MapView.onSpotted = function(x, y)
	if state.screen == "play" and not state.spectator and state.phase == "game" then
		UI.toast("Противник обнаружен!", true, 3)
		MapView.marker(x, y, RED, 4)
	end
end

-- the enemy under a screen point, as an order target, and its middle
local function enemyAt(sx: number, sy: number): (number?, number?, number?)
	local what, id = MapView.thingAt(sx, sy)
	if what == "unit" and id then
		local u = MapView.unitRecord(id)
		if u and u.owner ~= MapView.myId then
			return id, u.x, u.y
		end
	elseif what == "building" and id then
		local b = MapView.buildingRecord(id)
		if b and b.owner ~= MapView.myId then
			return -id, b.cx, b.cy
		end
	end
	return nil, nil, nil
end

-- the selected units attack what is under the finger, or go to the tile (fighting on the way if armed)
local function command(x: number, y: number, sx: number, sy: number)
	local ref, ex, ey = enemyAt(sx, sy)
	if ref and ex and ey then
		sendOrder("attack", ex, ey, ref)
		MapView.marker(ex, ey, RED)
	elseif state.amove then
		sendOrder("amove", x + 0.5, y + 0.5)
		MapView.marker(x + 0.5, y + 0.5, ORANGE)
	else
		sendOrder("move", x + 0.5, y + 0.5)
		MapView.marker(x + 0.5, y + 0.5)
	end
	setAmove(false)
end

local function tryBuild(kind: string, x: number, y: number)
	MapView.ghostAt(x + 0.5, y + 0.5)
	local bx, by, why = MapView.placeFor(kind, x + 0.5, y + 0.5)
	if not bx or not by then
		UI.toast(why or "Тут нельзя строить.", true)
		return
	end
	local cost = Config.BUILD[kind].cost
	local money = if state.eco then state.eco.money else 0
	if money < cost then
		UI.toast("Не хватает денег: нужно ещё " .. math.ceil(cost - money) .. " $", true)
		return
	end
	action:FireServer("build", kind, x, y)
	UI.selectBuild(nil)
end

MapView.onTap = function(x, y, sx, sy)
	if not canCommand() then
		return
	end
	if state.rallyFor then
		action:FireServer("rally", state.rallyFor, x, y)
		MapView.marker(x + 0.5, y + 0.5, Color3.fromRGB(255, 210, 90))
		Sfx.play("order")
		state.rallyFor = nil
		return
	end
	if UI.buildSel then
		tryBuild(UI.buildSel, x, y)
		return
	end
	local hasSelection = next(MapView.selected) ~= nil
	if hasSelection and (state.amove or enemyAt(sx, sy)) then
		command(x, y, sx, sy)
		return
	end
	-- with nothing selected, a building under the finger wins over units parked next to it
	if not hasSelection then
		local bid = MapView.buildingAt(sx, sy)
		local b = if bid then MapView.buildingRecord(bid) else nil
		if b then
			local def = Config.BUILD[b.kind]
			if b.owner ~= MapView.myId then
				UI.toast("Враг «" .. ownerName(b.owner) .. "»: " .. def.name .. ". Выбери войска и нажми сюда, чтобы атаковать.")
			elseif def.units then
				local info = factoryInfo(bid)
				if info then
					Sfx.play("click")
					UI.showFactory(info)
				end
			else
				UI.hideFactory()
				UI.toast(def.name .. ": " .. def.desc)
			end
			return
		end
	end
	local unit = MapView.unitAt(sx, sy)
	if unit then
		if viaMouse() and not shiftHeld() then
			select({ unit }, false)
		else
			MapView.selected[unit] = if MapView.selected[unit] then nil else true
			refreshArmy()
		end
		Sfx.play("click")
		return
	end
	if hasSelection then
		command(x, y, sx, sy)
		return
	end
	if UI.factoryId then
		UI.hideFactory()
		return
	end
	local what, id = MapView.thingAt(sx, sy)
	if what == "unit" and id then
		local u = MapView.unitRecord(id)
		UI.toast("Враг «" .. ownerName(u.owner) .. "»: " .. Config.UNITS[u.kind].title .. ".")
	end
end

-- right mouse button: cancel building or the rally point, or command the selected units
MapView.onAltTap = function(x, y, sx, sy)
	if not canCommand() then
		return
	end
	if UI.buildSel then
		UI.selectBuild(nil)
	elseif state.rallyFor then
		state.rallyFor = nil
	elseif next(MapView.selected) ~= nil then
		command(x, y, sx, sy)
	end
end

-- a selection box: the player's units inside it (Shift adds to the selection)
MapView.onBox = function(x0, y0, x1, y1)
	MapView.boxArmed = false
	UI.setArmed("box", false)
	if not canCommand() then
		return
	end
	local ids = MapView.unitsInBox(x0, y0, x1, y1)
	select(ids, shiftHeld())
	if #ids > 0 then
		Sfx.play("click")
	end
end

UI.onCommand = function(name)
	if not canCommand() then
		return
	end
	local hasSelection = next(MapView.selected) ~= nil
	if name == "screen" then
		select(MapView.ownUnitsOnScreen(), false)
	elseif name == "box" then
		MapView.boxArmed = not MapView.boxArmed
		UI.setArmed("box", MapView.boxArmed)
		if MapView.boxArmed then
			UI.toast("Проведи пальцем рамку вокруг своих войск.")
		end
	elseif not hasSelection then
		UI.toast("Сначала выбери войска.", true)
	elseif name == "amove" then
		setAmove(not state.amove)
		if state.amove then
			UI.toast("Нажми на карту: войска пойдут туда и будут бить всех врагов по пути.")
		end
	elseif name == "stop" or name == "hold" then
		sendOrder(name, 0, 0)
	end
end

-- keys: F attack-move, X stop, H hold, Space to the base, Backspace drops the selection,
-- Ctrl + 1-9 remembers a group, 1-9 picks it (twice quickly: the camera goes there)
local DIGITS = {
	[Enum.KeyCode.One] = 1, [Enum.KeyCode.Two] = 2, [Enum.KeyCode.Three] = 3,
	[Enum.KeyCode.Four] = 4, [Enum.KeyCode.Five] = 5, [Enum.KeyCode.Six] = 6,
	[Enum.KeyCode.Seven] = 7, [Enum.KeyCode.Eight] = 8, [Enum.KeyCode.Nine] = 9,
}
local lastGroup, lastGroupAt = 0, 0

local function onKey(input: InputObject)
	local key = input.KeyCode
	local ctrl = UserInputService:IsKeyDown(Enum.KeyCode.LeftControl) or UserInputService:IsKeyDown(Enum.KeyCode.RightControl)
	if key == Enum.KeyCode.Space then
		UI.onBase()
	elseif key == Enum.KeyCode.Backspace then
		UI.selectBuild(nil)
		UI.onClearSelection()
	elseif key == Enum.KeyCode.F then
		UI.onCommand("amove")
	elseif key == Enum.KeyCode.X then
		UI.onCommand("stop")
	elseif key == Enum.KeyCode.H then
		UI.onCommand("hold")
	elseif DIGITS[key] then
		local g = DIGITS[key]
		if ctrl then
			state.groups[g] = selectedIds()
			UI.toast(string.format("Группа %d: %d юнитов. Нажми %d, чтобы выбрать её.", g, #state.groups[g], g))
			return
		end
		local ids = {}
		local sx, sy = 0, 0
		for _, id in state.groups[g] or {} do
			local u = MapView.unitRecord(id)
			if u then
				table.insert(ids, id)
				sx += u.x
				sy += u.y
			end
		end
		state.groups[g] = ids
		select(ids, shiftHeld())
		if #ids > 0 and lastGroup == g and os.clock() - lastGroupAt < 0.4 then
			MapView.focusOn(sx / #ids, sy / #ids)
		end
		lastGroup, lastGroupAt = g, os.clock()
	end
end

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard or not canCommand() then
		return
	end
	safe("клавиша", onKey, input)
end)

---------------------------------------------------------------- per frame

do
	local onTap, onAltTap = MapView.onTap, MapView.onAltTap
	MapView.onTap = function(x, y, sx, sy)
		safe("нажатие", onTap, x, y, sx, sy)
	end
	MapView.onAltTap = function(x, y, sx, sy)
		safe("нажатие", onAltTap, x, y, sx, sy)
	end
end

local hudAcc = 0
local function frame(dt: number)
	MapView.update(dt)
	if state.phase == "game" or state.phase == "ended" then
		state.timer -= dt
	end
	if state.screen ~= "play" then
		return
	end
	hudAcc += dt
	if hudAcc < 0.5 then
		return
	end
	hudAcc = 0
	if state.phase ~= "game" then
		return
	end
	local list = {}
	for _, n in MapView.nations do
		table.insert(list, n)
	end
	table.sort(list, function(a, b)
		if a.alive ~= b.alive then
			return a.alive
		end
		return a.score > b.score
	end)
	local rows = {}
	local myPlace, alive = 0, 0
	for i, n in list do
		if n.alive then
			alive += 1
		end
		if n.id == MapView.myId then
			myPlace = i
		end
		table.insert(rows, {
			place = i,
			name = n.name,
			color = n.color,
			value = if n.alive then MapView.fmt(n.score) else "разбит",
			isMe = n.id == MapView.myId,
		})
	end
	UI.setLeaderboard(rows)
	refreshArmy()
	if me() then
		local t = math.max(0, math.floor(state.timer))
		UI.setMe(string.format("Место %d из %d · осталось %d:%02d", myPlace, alive, t // 60, t % 60))
	end
end

RunService.RenderStepped:Connect(function(dt)
	safe("кадр", frame, dt)
end)
