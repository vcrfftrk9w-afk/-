-- Рекорды игроков: самая большая глубина и число побед над Гу (таблица лидеров + DataStore).
-- Сама игра идёт у каждого игрока на его устройстве, сервер только хранит результаты.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")

-- персонаж не нужен: всё происходит в интерфейсе
Players.CharacterAutoLoads = false

local MAX_DEPTH = 5
local MIN_WIN_INTERVAL = 120 -- одна победа не чаще, чем раз в 2 минуты

local report = Instance.new("RemoteEvent")
report.Name = "BPDReport"
report.Parent = ReplicatedStorage

local store
pcall(function()
	store = DataStoreService:GetDataStore("BloxPixelDungeon_Records_v1")
end)

local lastWin = {}

local function save(player)
	local stats = player:FindFirstChild("leaderstats")
	if not store or not stats then
		return
	end
	local data = { depth = stats["Глубина"].Value, wins = stats["Победы"].Value }
	local ok, err = pcall(function()
		store:SetAsync("u" .. player.UserId, data)
	end)
	if not ok then
		warn("[Blox Pixel Dungeon] не удалось сохранить рекорд:", err)
	end
end

Players.PlayerAdded:Connect(function(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local depth = Instance.new("IntValue")
	depth.Name = "Глубина"
	depth.Parent = stats
	local wins = Instance.new("IntValue")
	wins.Name = "Победы"
	wins.Parent = stats
	if store then
		local ok, data = pcall(function()
			return store:GetAsync("u" .. player.UserId)
		end)
		if ok and type(data) == "table" then
			depth.Value = tonumber(data.depth) or 0
			wins.Value = tonumber(data.wins) or 0
		end
	end
	stats.Parent = player
end)

Players.PlayerRemoving:Connect(function(player)
	save(player)
	lastWin[player] = nil
end)

report.OnServerEvent:Connect(function(player, data)
	local stats = player:FindFirstChild("leaderstats")
	if type(data) ~= "table" or not stats then
		return
	end
	local depth = tonumber(data.depth)
	if not depth or depth ~= depth then
		return
	end
	depth = math.clamp(math.floor(depth), 1, MAX_DEPTH)
	if depth > stats["Глубина"].Value then
		stats["Глубина"].Value = depth
	end
	if data.won == true and depth == MAX_DEPTH then
		local now = os.clock()
		if not lastWin[player] or now - lastWin[player] > MIN_WIN_INTERVAL then
			lastWin[player] = now
			stats["Победы"].Value = stats["Победы"].Value + 1
		end
	end
	save(player)
end)

game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		save(player)
	end
end)
