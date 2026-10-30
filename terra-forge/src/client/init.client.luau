-- Terra Forge client: shows the menu and the match, and forwards taps to the server.
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
safe("меню", function()
	MapView.setMode("menu")
	UI.showMenu()
end)
if not MapView.ok then
	safe("сообщение о карте", UI.mapError)
end

local state = {
	screen = "menu",
	phase = "none",
	timer = 0,
	spectator = false,
	wantPlay = false,
	eco = nil,
	defeated = false,
}

local function me()
	return MapView.nations[MapView.myId]
end

local function goMenu()
	state.screen = "menu"
	state.spectator = false
	state.defeated = false
	MapView.setMode("menu")
	UI.showMenu()
end

local function focusCapital(seconds: number)
	local n = me()
	if n and n.cap then
		local _, cw, ch = MapView.viewInfo()
		local z = math.max(math.min(cw / Map.W, ch / Map.H) * 3.2, 8)
		MapView.flyTo(n.cap.x + 0.5, n.cap.y + 0.5, z, seconds)
	end
end

local function enterPlay(spectator: boolean)
	state.screen = "play"
	state.spectator = spectator
	state.rallyFor = nil
	MapView.spectator = spectator
	state.defeated = false
	MapView.setMode("play")
	UI.showPlay(state.phase, spectator)
	local n = me()
	if n then
		UI.setMyColor(n.color)
	end
	if state.phase == "spawn" then
		-- leave room for the banner at the top
		MapView.nudge(48)
	elseif state.phase == "game" then
		focusCapital(0.8)
	end
end

local function placedCount(): number
	local c = 0
	for _, n in MapView.nations do
		if n.alive and n.cap then
			c += 1
		end
	end
	return c
end

local handlers = {}

function handlers.snapshot(msg)
	MapView.load(msg)
	state.phase = msg.phase
	state.timer = msg.timer
	if msg.you ~= 0 then
		enterPlay(false)
	elseif state.wantPlay and msg.phase ~= "spawn" then
		enterPlay(true)
	elseif state.screen == "play" then
		goMenu()
	end
	state.wantPlay = false
end

function handlers.nation(msg)
	MapView.upsertNation(msg.n)
	if msg.n.id == MapView.myId then
		UI.setMyColor(msg.n.color)
	end
end

function handlers.delta(msg)
	MapView.applyDelta(msg.d)
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
	if msg.phase == "game" then
		UI.setPhase("game", state.spectator)
		if not state.spectator then
			UI.announce("ВОЙНА НАЧАЛАСЬ", "Захватывай землю и строй заводы")
			focusCapital(1.2)
			task.delay(2.4, function()
				if state.screen == "play" and state.phase == "game" then
					UI.toast("Нажми на землю у своей границы, чтобы захватить её. Построй казарму или танковый завод и нажми на него на карте, чтобы заказать войска.", false, 7)
				end
			end)
		end
	elseif msg.phase == "ended" then
		UI.setPhase("ended", state.spectator)
		UI.results(msg, MapView.myId)
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
	MapView.refreshSelection()
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
		UI.toast("Таких войск пока нет. Построй казарму, танковый завод или аэродром.")
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

UI.onRally = function(id)
	state.rallyFor = id
	UI.toast("Нажми на карту, куда новым юнитам ехать после выпуска.")
end

function handlers.fx(msg)
	if state.screen == "play" then
		MapView.fx(msg.x, msg.y)
	end
end

function handlers.boom(msg)
	if state.screen == "play" then
		MapView.boom(msg.x, msg.y, msg.big)
	end
end

function handlers.shots(msg)
	if state.screen == "play" then
		MapView.shots(msg.s)
	end
end

function handlers.hp(msg)
	MapView.setUnitHp(msg.s)
end

function handlers.bhp(msg)
	MapView.setBuildingHp(msg.s)
end

local function refreshFactory()
	local id = UI.factoryId
	if not id then
		return
	end
	local b = MapView.buildingRecord(id)
	if not b then
		UI.hideFactory()
		return
	end
	UI.showFactory({ id = id, kind = b.kind, prog = b.prog, built = b.built, queue = b.queue, auto = b.auto })
end

function handlers.eco(msg)
	state.eco = msg
	MapView.setProgress(msg.list)
	local n = me()
	UI.setEconomy(msg, if n then n.troops else 0, MapView.fmt)
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

UI.onZoom = function(f)
	MapView.zoom(f)
end

MapView.onTap = function(x, y, sx, sy)
	if state.spectator or state.defeated then
		return
	end
	local t = y * Map.W + x
	if state.phase == "spawn" then
		if not Map.isLand(t) then
			UI.toast("Тут вода. Выбери сушу.", true)
			return
		end
		action:FireServer("spawn", x, y)
	elseif state.phase == "game" then
		if state.rallyFor then
			action:FireServer("rally", state.rallyFor, x, y)
			MapView.marker(x + 0.5, y + 0.5)
			state.rallyFor = nil
			return
		end
		if not UI.buildSel then
			-- with nothing selected, a factory under the finger wins over units parked next to it
			local bid = if next(MapView.selected) == nil then MapView.buildingAt(sx, sy) else nil
			if bid then
				local b = MapView.buildingRecord(bid)
				local def = Config.BUILD[b.kind]
				if def.units then
					UI.showFactory({ id = bid, kind = b.kind, prog = b.prog, built = b.built, queue = b.queue, auto = b.auto })
				else
					UI.hideFactory()
					UI.toast(def.name .. ": " .. def.desc)
				end
				return
			end
			local unit = MapView.unitAt(sx, sy)
			if unit then
				MapView.selected[unit] = if MapView.selected[unit] then nil else true
				refreshArmy()
				return
			end
			local ids = selectedIds()
			if #ids > 0 then
				action:FireServer("move", ids, x, y)
				MapView.marker(x + 0.5, y + 0.5)
				return
			end
			if UI.factoryId then
				UI.hideFactory()
				return
			end
		end
		if UI.buildSel then
			if MapView.ownerAt(x, y) ~= MapView.myId then
				UI.toast("Строить можно только на своей земле.", true)
				return
			end
			action:FireServer("build", UI.buildSel, x, y)
		else
			if not Map.isLand(t) then
				UI.toast("Через море пока не пройти. Для этого будут корабли.", true)
				return
			end
			if MapView.ownerAt(x, y) == MapView.myId then
				UI.toast("Это твоя земля. Выбери постройку внизу, чтобы строить.")
				return
			end
			action:FireServer("attack", x, y, UI.attackPct)
		end
	end
end

---------------------------------------------------------------- per frame

do
	local onTap = MapView.onTap
	MapView.onTap = function(x, y, sx, sy)
		safe("нажатие", onTap, x, y, sx, sy)
	end
end

local hudAcc = 0
local function frame(dt: number)
	MapView.update(dt)
	if state.phase == "spawn" or state.phase == "game" or state.phase == "ended" then
		state.timer -= dt
	end
	if state.screen ~= "play" then
		return
	end
	if state.phase == "spawn" and not state.spectator then
		local n = me()
		UI.spawnBanner(state.timer, placedCount(), Config.TOTAL_NATIONS, n ~= nil and n.cap ~= nil)
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
		if n.alive and n.count > 0 then
			table.insert(list, n)
		end
	end
	table.sort(list, function(a, b)
		return a.count > b.count
	end)
	local rows = {}
	local myPlace = 0
	for i, n in list do
		if n.id == MapView.myId then
			myPlace = i
		end
		if i <= 6 then
			table.insert(rows, { place = i, name = n.name, color = n.color, share = n.count / Map.landCount, isMe = n.id == MapView.myId })
		end
	end
	local mine = me()
	if mine and myPlace > 6 then
		table.insert(rows, { place = myPlace, name = mine.name, color = mine.color, share = mine.count / Map.landCount, isMe = true })
	end
	UI.setLeaderboard(rows)
	refreshArmy()
	if mine then
		UI.setMe(mine.count / Map.landCount, mine.troops, MapView.fmt)
	end
end

RunService.RenderStepped:Connect(function(dt)
	safe("кадр", frame, dt)
end)
