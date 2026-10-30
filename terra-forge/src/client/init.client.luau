-- Terra Forge client: shows the menu and the battle, and forwards taps to the server.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local StarterGui = game:GetService("StarterGui")

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
}

local function me()
	return MapView.nations[MapView.myId]
end

local function goMenu()
	state.screen = "menu"
	state.spectator = false
	state.defeated = false
	state.rallyFor = nil
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
	UI.setArmy(counts, selected)
end

local function selectedIds(): { number }
	local ids = {}
	for id in MapView.selected do
		table.insert(ids, id)
	end
	return ids
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

function handlers.defeat()
	state.defeated = true
	if state.screen == "play" then
		MapView.setBuild(nil)
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

local function moveSelected(x: number, y: number)
	action:FireServer("move", selectedIds(), x, y)
	MapView.marker(x + 0.5, y + 0.5)
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
	if state.spectator or state.defeated or state.phase ~= "game" then
		return
	end
	if state.rallyFor then
		action:FireServer("rally", state.rallyFor, x, y)
		MapView.marker(x + 0.5, y + 0.5, Color3.fromRGB(255, 210, 90))
		state.rallyFor = nil
		return
	end
	if UI.buildSel then
		tryBuild(UI.buildSel, x, y)
		return
	end
	local hasSelection = next(MapView.selected) ~= nil
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
		MapView.selected[unit] = if MapView.selected[unit] then nil else true
		refreshArmy()
		return
	end
	if hasSelection then
		moveSelected(x, y)
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

-- right mouse button: cancel building, or send the selected units
MapView.onAltTap = function(x, y)
	if state.spectator or state.defeated or state.phase ~= "game" then
		return
	end
	if UI.buildSel then
		UI.selectBuild(nil)
	elseif state.rallyFor then
		state.rallyFor = nil
	elseif next(MapView.selected) ~= nil then
		moveSelected(x, y)
	end
end

---------------------------------------------------------------- per frame

do
	local onTap, onAltTap = MapView.onTap, MapView.onAltTap
	MapView.onTap = function(x, y, sx, sy)
		safe("нажатие", onTap, x, y, sx, sy)
	end
	MapView.onAltTap = function(x, y)
		safe("нажатие", onAltTap, x, y)
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
