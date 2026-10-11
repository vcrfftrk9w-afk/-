-- Доски лидеров: «Топ богачей» (сколько монет заработано) и «Топ воришек» (сколько звёзд украдено).

local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Logic = require(Shared:WaitForChild("Logic"))

local Sessions = require(script.Parent.Sessions)
local World = require(script.Parent.World)
local Util = require(script.Parent.Util)

local Leaderboard = {}

local names: { [number]: string } = {}

local function nameOf(userId: number): string
	if names[userId] then
		return names[userId]
	end
	local player = Players:GetPlayerByUserId(userId)
	if player then
		names[userId] = player.DisplayName
		return player.DisplayName
	end
	local ok, name = pcall(function()
		return Players:GetNameFromUserIdAsync(userId)
	end)
	if ok and name then
		names[userId] = name
		return name
	end
	return "?"
end

type Board = { store: OrderedDataStore, rows: { TextLabel }, stat: string, suffix: string }

local function refresh(board: Board)
	for _, session in pairs(Sessions.active) do
		if session.canSave and session.ready then
			local value = math.floor(session.data.stats[board.stat] or 0)
			if value > 0 then
				pcall(function()
					board.store:SetAsync(tostring(session.player.UserId), value)
				end)
			end
		end
	end
	local ok, pages = pcall(function()
		return board.store:GetSortedAsync(false, 10)
	end)
	if not ok or not pages then
		return
	end
	local entries = pages:GetCurrentPage()
	local rows = board.rows
	-- сначала убираем перевод с первой строки, потом пишем текст (порядок важен для клиента)
	if #entries > 0 then
		rows[1]:SetAttribute("TKey", "")
	end
	for i, row in ipairs(rows) do
		local entry = entries[i]
		if entry then
			local userId = tonumber(entry.key) or 0
			row.Text = string.format("%d. %s — %s %s", i, nameOf(userId), Logic.format(entry.value), board.suffix)
		else
			row.Text = ""
		end
	end
	if #entries == 0 then
		Util.localize(rows[1], "lb_empty")
	end
end

function Leaderboard.start()
	local boards: { Board } = {}
	for _, info in ipairs({
		{ name = Config.TopEarnedStoreName, key = "earned", stat = "earned", suffix = "💰" },
		{ name = Config.TopStolenStoreName, key = "stolen", stat = "stolen", suffix = "🦹" },
	}) do
		local ok, store = pcall(function()
			return DataStoreService:GetOrderedDataStore(info.name)
		end)
		local rows = World.boards[info.key]
		if ok and store and rows then
			table.insert(boards, { store = store, rows = rows, stat = info.stat, suffix = info.suffix })
		end
	end
	task.spawn(function()
		task.wait(20)
		while true do
			for _, board in ipairs(boards) do
				Util.try("leaderboard", refresh, board)
			end
			task.wait(120)
		end
	end)
end

return Leaderboard
