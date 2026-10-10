-- Доска «Лучшие садоводы»: кто заработал больше всех монет за всё время.

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

local function refresh(store: OrderedDataStore)
	for _, session in pairs(Sessions.active) do
		if session.canSave and session.ready then
			local earned = math.floor(session.data.stats.earned)
			if earned > 0 then
				pcall(function()
					store:SetAsync(tostring(session.player.UserId), earned)
				end)
			end
		end
	end
	local ok, pages = pcall(function()
		return store:GetSortedAsync(false, 10)
	end)
	if not ok or not pages then
		return
	end
	local entries = pages:GetCurrentPage()
	-- сначала убираем перевод с первой строки, потом пишем текст (порядок важен для клиента)
	if #entries > 0 and World.boardRows[1] then
		World.boardRows[1]:SetAttribute("TKey", "")
	end
	for i, row in ipairs(World.boardRows) do
		local entry = entries[i]
		if entry then
			local userId = tonumber(entry.key) or 0
			row.Text = string.format("%d. %s — %s 💰", i, nameOf(userId), Logic.format(entry.value))
		else
			row.Text = ""
		end
	end
	if #entries == 0 and World.boardRows[1] then
		Util.localize(World.boardRows[1], "lb_empty")
	end
end

function Leaderboard.start()
	local ok, store = pcall(function()
		return DataStoreService:GetOrderedDataStore(Config.LeaderboardStoreName)
	end)
	if not ok or not store then
		return
	end
	task.spawn(function()
		task.wait(20)
		while true do
			Util.try("leaderboard", refresh, store)
			task.wait(120)
		end
	end)
end

return Leaderboard
