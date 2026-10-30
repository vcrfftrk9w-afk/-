-- Terra Forge client: shows the menu and the match, and forwards taps to the server.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local StarterGui = game:GetService("StarterGui")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

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

MapView.init(playerGui)
UI.init(playerGui, player)
MapView.setMode("menu")
UI.showMenu()
if not MapView.ok then
	UI.mapError()
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
					UI.toast("Нажми на землю у своей границы: туда пойдут войска. Внизу постройки: шахты, заводы, аэродром.", false, 6.5)
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
end

function handlers.unit(msg)
	MapView.addUnit(msg.u)
end

function handlers.ugone(msg)
	MapView.removeUnit(msg.id)
end

---------------------------------------------------------------- unit selection

local function refreshArmy()
	local counts = { infantry = 0, tank = 0, plane = 0 }
	local selected = { infantry = 0, tank = 0, plane = 0 }
	for _, id in MapView.ownUnits(nil) do
		local u = MapView.unitRecord(id)
		if u then
			counts[u.kind] += 1
			if MapView.selected[id] then
				selected[u.kind] += 1
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

UI.onSelectKind = function(kind)
	local ids = MapView.ownUnits(if kind == "all" then nil else kind)
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

function handlers.eco(msg)
	state.eco = msg
	MapView.setProgress(msg.prog)
	local n = me()
	UI.setEconomy(msg, if n then n.troops else 0, MapView.fmt)
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
			h(msg)
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
		if not UI.buildSel then
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

local hudAcc = 0
RunService.RenderStepped:Connect(function(dt)
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
end)
