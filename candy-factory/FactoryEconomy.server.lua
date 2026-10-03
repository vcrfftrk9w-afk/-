--[[
	КОНФЕТНАЯ ФАБРИКА — скрипт 1 из 2: ЭКОНОМИКА

	Деньги, перерождения, сохранения, ежедневная награда,
	экран с деньгами и магазин за Robux в лобби.

	Вставь в ServerScriptService как Script. Второй скрипт — FactoryPlots.
	В самом конце этого кода должна быть строчка "-- КОНЕЦ СКРИПТА".
]]

local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local MarketplaceService = game:GetService("MarketplaceService")

local CONFIG = {
	DailyReward = 250, -- умножается на (1 + перерождения)
	DailyCooldown = 20 * 60 * 60, -- раз в 20 часов
	RebirthBaseCost = 100000, -- цена перерождения растёт: 100к, 200к, 300к...
	AutosaveEvery = 60,
	BoostMinutes = 10,
	CashBagAmount = 5000, -- умножается на (1 + перерождения)

	-- ID из Creator Hub -> твоя игра -> Monetization. Пока стоит 0,
	-- кнопка в магазине просто скажет, что покупка скоро появится.
	PassDoubleMoney = 0, -- геймпасс «Деньги x2»
	PassAutoCollect = 0, -- геймпасс «Автосбор»
	ProductCashBag = 0, -- товар «Мешок денег»
	ProductBoost = 0, -- товар «Буст x3 на 10 минут»
}

local store
do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore("CandyFactory_v1")
	end)
	if ok then
		store = result
	end
end

local sessions = {} -- [player] = { owned = {}, passes = {}, boostUntil = 0, lastDaily = 0, loaded = bool }
local readyEvent = Instance.new("BindableEvent")

local function format(n)
	n = math.floor(n)
	if n >= 1e9 then
		return ("%.1fB"):format(n / 1e9)
	elseif n >= 1e6 then
		return ("%.1fM"):format(n / 1e6)
	elseif n >= 1e4 then
		return ("%.1fK"):format(n / 1e3)
	end
	return tostring(n)
end

---------------------------------------------------------------------
-- Экран: деньги сверху и всплывающие сообщения
---------------------------------------------------------------------

local function makeHud(player, money)
	local gui = Instance.new("ScreenGui")
	gui.Name = "FactoryHUD"
	gui.ResetOnSpawn = false

	local label = Instance.new("TextLabel")
	label.Name = "Money"
	label.AnchorPoint = Vector2.new(0.5, 0)
	label.Position = UDim2.new(0.5, 0, 0, 8)
	label.Size = UDim2.fromOffset(230, 46)
	label.BackgroundColor3 = Color3.fromRGB(255, 110, 180)
	label.TextColor3 = Color3.new(1, 1, 1)
	label.Font = Enum.Font.FredokaOne
	label.TextScaled = true
	label.Parent = gui
	Instance.new("UICorner", label).CornerRadius = UDim.new(0, 14)

	local toast = label:Clone()
	toast.Name = "Toast"
	toast.Position = UDim2.new(0.5, 0, 0, 62)
	toast.Size = UDim2.fromOffset(380, 38)
	toast.BackgroundColor3 = Color3.fromRGB(40, 30, 60)
	toast.BackgroundTransparency = 0.15
	toast.Visible = false
	toast.Parent = gui

	local function refresh()
		label.Text = "💰 " .. format(money.Value)
	end
	money.Changed:Connect(refresh)
	refresh()

	gui.Parent = player:WaitForChild("PlayerGui")
end

local toastTokens = {}
local function notify(player, text, color)
	local gui = player:FindFirstChild("PlayerGui") and player.PlayerGui:FindFirstChild("FactoryHUD")
	local toast = gui and gui:FindFirstChild("Toast")
	if not toast then
		return
	end
	toast.Text = text
	toast.TextColor3 = color or Color3.new(1, 1, 1)
	toast.Visible = true
	local token = (toastTokens[player] or 0) + 1
	toastTokens[player] = token
	task.delay(3, function()
		if toastTokens[player] == token then
			toast.Visible = false
		end
	end)
end

---------------------------------------------------------------------
-- Деньги и множители
---------------------------------------------------------------------

local function stat(player, name)
	local stats = player:FindFirstChild("leaderstats")
	return stats and stats:FindFirstChild(name)
end

local function multiplier(player)
	local session = sessions[player]
	local rebirths = stat(player, "Rebirths")
	local mult = 1 + (rebirths and rebirths.Value or 0)
	if session and session.passes.double then
		mult *= 2
	end
	if session and session.boostUntil > os.time() then
		mult *= 3
	end
	return mult
end

local function addIncome(player, base)
	local money = stat(player, "Money")
	if money then
		money.Value += math.max(1, math.floor(base * multiplier(player) + 0.5))
	end
end

local function trySpend(player, amount)
	local money = stat(player, "Money")
	if money and money.Value >= amount then
		money.Value -= amount
		return true
	end
	return false
end

local function rebirthCost(player)
	local rebirths = stat(player, "Rebirths")
	return CONFIG.RebirthBaseCost * (1 + (rebirths and rebirths.Value or 0))
end

local function doRebirth(player)
	local session = sessions[player]
	if not session or not trySpend(player, rebirthCost(player)) then
		return false
	end
	stat(player, "Money").Value = 0
	stat(player, "Rebirths").Value += 1
	session.owned = {}
	return true
end

---------------------------------------------------------------------
-- Загрузка и сохранение
---------------------------------------------------------------------

local function save(player)
	local session = sessions[player]
	if not store or not session or not session.loaded then
		return
	end
	local owned = {}
	for id in pairs(session.owned) do
		table.insert(owned, id)
	end
	local data = {
		Money = stat(player, "Money").Value,
		Rebirths = stat(player, "Rebirths").Value,
		Owned = owned,
		LastDaily = session.lastDaily,
	}
	pcall(function()
		store:SetAsync("player_" .. player.UserId, data)
	end)
end

local function checkPass(player, session, key, passId)
	if passId == 0 then
		return
	end
	local ok, owns = pcall(function()
		return MarketplaceService:UserOwnsGamePassAsync(player.UserId, passId)
	end)
	session.passes[key] = ok and owns or false
end

local function onPlayerAdded(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local money = Instance.new("IntValue")
	money.Name = "Money"
	money.Parent = stats
	local rebirths = Instance.new("IntValue")
	rebirths.Name = "Rebirths"
	rebirths.Parent = stats
	stats.Parent = player

	local session = { owned = {}, passes = {}, boostUntil = 0, lastDaily = 0, loaded = false }
	sessions[player] = session

	local data
	if store then
		local ok, result = pcall(function()
			return store:GetAsync("player_" .. player.UserId)
		end)
		if ok then
			data = result
			session.loaded = true
		end
	end
	if type(data) == "table" then
		money.Value = data.Money or 0
		rebirths.Value = data.Rebirths or 0
		session.lastDaily = data.LastDaily or 0
		for _, id in ipairs(data.Owned or {}) do
			session.owned[id] = true
		end
	end

	checkPass(player, session, "double", CONFIG.PassDoubleMoney)
	checkPass(player, session, "auto", CONFIG.PassAutoCollect)
	makeHud(player, money)
	session.ready = true
	readyEvent:Fire(player)

	if os.time() - session.lastDaily >= CONFIG.DailyCooldown then
		session.lastDaily = os.time()
		local reward = CONFIG.DailyReward * (1 + rebirths.Value)
		money.Value += reward
		task.delay(2, notify, player, "🎁 Ежедневная награда: +" .. format(reward), Color3.fromRGB(255, 230, 90))
	end
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, player)
end

Players.PlayerRemoving:Connect(function(player)
	save(player)
	sessions[player] = nil
	toastTokens[player] = nil
end)

game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		task.spawn(save, player)
	end
	task.wait(3)
end)

task.spawn(function()
	while true do
		task.wait(CONFIG.AutosaveEvery)
		for _, player in ipairs(Players:GetPlayers()) do
			task.spawn(save, player)
		end
	end
end)

---------------------------------------------------------------------
-- Покупки за Robux
---------------------------------------------------------------------

MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
	local session = sessions[player]
	if not purchased or not session then
		return
	end
	if passId == CONFIG.PassDoubleMoney then
		session.passes.double = true
		notify(player, "✨ Деньги x2 навсегда!", Color3.fromRGB(150, 255, 140))
	elseif passId == CONFIG.PassAutoCollect then
		session.passes.auto = true
		notify(player, "✨ Автосбор включён!", Color3.fromRGB(150, 255, 140))
	end
end)

MarketplaceService.ProcessReceipt = function(info)
	local player = Players:GetPlayerByUserId(info.PlayerId)
	local session = player and sessions[player]
	if not session or not session.ready then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	if info.ProductId == CONFIG.ProductCashBag then
		local amount = CONFIG.CashBagAmount * (1 + stat(player, "Rebirths").Value)
		stat(player, "Money").Value += amount
		notify(player, "💰 +" .. format(amount) .. "!", Color3.fromRGB(255, 230, 90))
	elseif info.ProductId == CONFIG.ProductBoost then
		session.boostUntil = math.max(os.time(), session.boostUntil) + CONFIG.BoostMinutes * 60
		notify(player, "🚀 Буст x3 на " .. CONFIG.BoostMinutes .. " минут!", Color3.fromRGB(255, 230, 90))
	else
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	save(player)
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

-- Магазин в лобби: встань на кнопку, чтобы купить
local shop = Instance.new("Folder")
shop.Name = "Shop"
shop.Parent = workspace

local SHOP_ITEMS = {
	{ text = "💰 Деньги x2\n(навсегда)", pass = CONFIG.PassDoubleMoney, key = "double", color = Color3.fromRGB(255, 200, 40) },
	{ text = "🤖 Автосбор\n(навсегда)", pass = CONFIG.PassAutoCollect, key = "auto", color = Color3.fromRGB(120, 220, 255) },
	{ text = "🎒 Мешок денег", product = CONFIG.ProductCashBag, color = Color3.fromRGB(150, 255, 140) },
	{ text = "🚀 Буст x3\n(10 минут)", product = CONFIG.ProductBoost, color = Color3.fromRGB(200, 140, 255) },
}

for i, item in ipairs(SHOP_ITEMS) do
	local pad = Instance.new("Part")
	pad.Anchored = true
	pad.Size = Vector3.new(6, 0.4, 6)
	pad.Position = Vector3.new(-22.5 + i * 9, 0.2, 22)
	pad.Color = item.color
	pad.Material = Enum.Material.Neon
	pad.Parent = shop

	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(180, 60)
	gui.StudsOffset = Vector3.new(0, 4, 0)
	gui.MaxDistance = 80
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = item.text
	label.TextScaled = true
	label.Font = Enum.Font.FredokaOne
	label.TextColor3 = item.color
	label.TextStrokeTransparency = 0
	label.Parent = gui
	gui.Parent = pad

	local cooldown = {}
	pad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		local session = player and sessions[player]
		if not session or (cooldown[player] and os.clock() - cooldown[player] < 4) then
			return
		end
		cooldown[player] = os.clock()
		local id = item.pass or item.product
		if id == 0 then
			notify(player, "Эта покупка скоро появится!")
		elseif item.pass and session.passes[item.key] then
			notify(player, "У тебя это уже есть ✅")
		elseif item.pass then
			MarketplaceService:PromptGamePassPurchase(player, id)
		else
			MarketplaceService:PromptProductPurchase(player, id)
		end
	end)
end

---------------------------------------------------------------------
-- Связь со вторым скриптом (FactoryPlots)
---------------------------------------------------------------------

_G.Factory = {
	Ready = readyEvent.Event,
	isReady = function(player)
		return sessions[player] ~= nil and sessions[player].ready == true
	end,
	owns = function(player, id)
		return sessions[player] ~= nil and sessions[player].owned[id] == true
	end,
	grant = function(player, id)
		if sessions[player] then
			sessions[player].owned[id] = true
		end
	end,
	hasAutoCollect = function(player)
		return sessions[player] ~= nil and sessions[player].passes.auto == true
	end,
	money = function(player)
		local money = stat(player, "Money")
		return money and money.Value or 0
	end,
	addIncome = addIncome,
	trySpend = trySpend,
	rebirthCost = rebirthCost,
	doRebirth = doRebirth,
	notify = notify,
	format = format,
}

print("[Factory] Экономика готова")

-- Эти строчки ничего не делают. Они нужны, чтобы было видно,
-- что код скопировался целиком, до самого конца.
-- КОНЕЦ СКРИПТА
