--[[
	🍭 СЛАДКИЙ САД — главный скрипт сервера.
	Строит мир, подключает игроков и связывает все части игры.
	Настройки игры — в ReplicatedStorage > Shared > Config.
]]

local Players = game:GetService("Players")
Players.CharacterAutoLoads = false

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

local Server = script.Parent
local Util = require(Server:WaitForChild("Util"))
local World = require(Server:WaitForChild("World"))

print("[SweetGarden] Строю мир...")
World.build()
print("[SweetGarden] Мир построен")

local Sessions = require(Server:WaitForChild("Sessions"))
local Garden = require(Server:WaitForChild("Garden"))
local Pets = require(Server:WaitForChild("Pets"))
local Economy = require(Server:WaitForChild("Economy"))
local Weather = require(Server:WaitForChild("Weather"))
local Monetization = require(Server:WaitForChild("Monetization"))
local Leaderboard = require(Server:WaitForChild("Leaderboard"))
local Net = require(Server:WaitForChild("Net"))

type Session = Sessions.Session

---------------------------------------------------------------------
-- Связи между частями игры
---------------------------------------------------------------------

Garden.setWeatherGrowth(Weather.growth)
Weather.init({
	applyMutations = Garden.applyWeather,
	strike = Garden.strike,
	speedChanged = Garden.refreshAllSpeeds,
})
Pets.setChangedHandler(Garden.refreshSpeed)
Monetization.init({
	grantProduct = function(session: Session, key: string)
		if key == "coinsSmall" then
			Economy.coinPack(session, false)
		elseif key == "coinsBig" then
			Economy.coinPack(session, true)
		elseif key == "candyStorm" then
			Weather.start("candy", Config.Weather.candyStormDuration, session.player)
		elseif key == "growAll" then
			Garden.growAll(session)
		else
			error("unknown product " .. key)
		end
	end,
	passGranted = function(session: Session, _key: string)
		Pets.changed(session)
	end,
})

---------------------------------------------------------------------
-- Команды с экрана игрока
---------------------------------------------------------------------

Net.on("Plant", Garden.plant)
Net.on("Harvest", Garden.harvest)
Net.on("Dig", Garden.dig)
Net.on("Select", Economy.select)
Net.on("BuySeed", Economy.buySeed)
Net.on("BuyUpgrade", Economy.buyUpgrade)
Net.on("BuyEgg", Economy.buyEgg)
Net.on("Equip", Pets.equip)
Net.on("DeletePet", Pets.delete)
Net.on("Sell", Economy.sell)
Net.on("Basket", Economy.sendBasket)
Net.on("Code", Economy.redeem)
Net.on("Magnet", function(session: Session, on: any)
	if type(on) == "boolean" then
		session.magnet = on
		Sessions.markDirty(session)
	end
end)
Net.on("Teleport", function(session: Session, destination: any)
	if type(destination) ~= "string" then
		return
	end
	local now = os.clock()
	if now - session.lastTeleport < 0.8 then
		return
	end
	session.lastTeleport = now
	if destination == "garden" then
		Garden.teleportHome(session)
	else
		local stand = World.stands[destination]
		if stand then
			Garden.teleport(session, stand.approach)
		end
	end
end)

Sessions.start()
Garden.start()
Net.start()
Monetization.start()
Weather.begin()
Leaderboard.start()

---------------------------------------------------------------------
-- Игроки
---------------------------------------------------------------------

local function spawnCharacter(player: Player)
	if player.Parent then
		local ok, err = pcall(function()
			player:LoadCharacter()
		end)
		if not ok then
			warn("[SweetGarden] LoadCharacter: " .. tostring(err))
		end
	end
end

local function onCharacter(session: Session, character: Model)
	local humanoid = character:WaitForChild("Humanoid", 10)
	local root = character:WaitForChild("HumanoidRootPart", 10)
	if not humanoid or not root or not humanoid:IsA("Humanoid") then
		return
	end
	task.wait(0.15)
	Garden.teleportHome(session)
	Util.try("pets", Pets.attach, session)
	humanoid.Died:Connect(function()
		task.wait(3)
		if Sessions.get(session.player) == session then
			spawnCharacter(session.player)
		end
	end)
end

local function onPlayerAdded(player: Player)
	local session = Sessions.load(player)
	if not player.Parent then
		Sessions.remove(player)
		return
	end
	Monetization.loadPasses(session)
	Pets.recompute(session)
	local hasPlot = Garden.assign(session)
	session.ready = true
	Sessions.markDirty(session)

	player.CharacterAdded:Connect(function(character)
		onCharacter(session, character)
	end)
	spawnCharacter(player)

	task.delay(4, function()
		if Sessions.get(player) ~= session then
			return
		end
		if not hasPlot then
			Sessions.notify(session, "n_no_plot")
		end
		if not session.canSave then
			Sessions.notify(session, "n_no_save")
		end
		Util.try("daily", Economy.checkDaily, session)
	end)
	print("[SweetGarden] Игрок готов: " .. player.Name)
end

Players.PlayerAdded:Connect(function(player)
	Util.try("join", onPlayerAdded, player)
end)
for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(Util.try, "join", onPlayerAdded, player)
end

Players.PlayerRemoving:Connect(function(player)
	local session = Sessions.get(player)
	if session then
		Util.try("leave", Garden.release, session)
	end
	Sessions.remove(player)
end)

print("[SweetGarden] Сервер готов!")
