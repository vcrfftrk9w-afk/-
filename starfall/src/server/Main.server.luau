--[[
	⭐ ЗВЕЗДОПАД — главный скрипт сервера.
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

print("[Starfall] Строю мир...")
World.build()
print("[Starfall] Мир построен")

local Sessions = require(Server:WaitForChild("Sessions"))
local Bases = require(Server:WaitForChild("Bases"))
local Stars = require(Server:WaitForChild("Stars"))
local Combat = require(Server:WaitForChild("Combat"))
local Economy = require(Server:WaitForChild("Economy"))
local Monetization = require(Server:WaitForChild("Monetization"))
local Leaderboard = require(Server:WaitForChild("Leaderboard"))
local Net = require(Server:WaitForChild("Net"))

type Session = Sessions.Session

---------------------------------------------------------------------
-- Покупки за Robux
---------------------------------------------------------------------

Monetization.init({
	grantProduct = function(session: Session, key: string)
		if key == "coinsSmall" then
			Economy.coinPack(session, false)
		elseif key == "coinsBig" then
			Economy.coinPack(session, true)
		elseif key == "meteorShower" then
			Stars.startShower(Config.Shower.productDuration, session.player.DisplayName)
		elseif key == "galaxion" then
			Economy.grantStar(session, "galaxion", nil, "product")
		else
			error("unknown product " .. key)
		end
	end,
	passGranted = function(session: Session, _key: string)
		Stars.applySpeed(session)
		Bases.render(session)
	end,
})

---------------------------------------------------------------------
-- Команды с экрана игрока
---------------------------------------------------------------------

Net.on("Grab", Stars.grab)
Net.on("Steal", Stars.steal)
Net.on("Bonk", Combat.bonk)
Net.on("Sell", Bases.sell)
Net.on("Lock", Bases.requestLock)
Net.on("Upgrade", Economy.buyUpgrade)
Net.on("Rebirth", Economy.rebirth)
Net.on("Summon", Economy.summon)
Net.on("Code", Economy.redeem)
Net.on("Teleport", function(session: Session, destination: any)
	if type(destination) ~= "string" then
		return
	end
	local clock = os.clock()
	if clock - session.lastTeleport < Config.TeleportCooldown then
		return
	end
	if session.carrying then
		Sessions.notify(session, "n_no_teleport")
		return
	end
	local character = session.player.Character
	if not character or not Util.humanoidOf(session.player) then
		return
	end
	session.lastTeleport = clock
	if destination == "base" then
		Bases.teleportHome(session)
	elseif destination == "field" then
		local angle = math.random() * math.pi * 2
		character:PivotTo(CFrame.new(math.cos(angle) * 6, World.FIELD_TOP + 3.5, math.sin(angle) * 6))
	end
end)

Sessions.start()
Bases.start()
Stars.start()
Net.start()
Monetization.start()
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
			warn("[Starfall] LoadCharacter: " .. tostring(err))
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
	Bases.teleportHome(session)
	Stars.applySpeed(session)
	humanoid.Died:Connect(function()
		Util.try("death drop", Stars.drop, session, "death")
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
	local hasBase = Bases.assign(session)
	if hasBase then
		Bases.offlineIncome(session)
		Bases.lock(session, Config.JoinLockSeconds)
	end
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
		if not hasBase then
			Sessions.notify(session, "n_no_base")
		end
		if not session.canSave then
			Sessions.notify(session, "n_no_save")
		end
		Util.try("daily", Economy.checkDaily, session)
	end)
	print("[Starfall] Игрок готов: " .. player.Name)
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
		Util.try("leave drop", Stars.drop, session, "leave")
		Util.try("leave", Bases.release, session)
	end
	Sessions.remove(player)
end)

print("[Starfall] Сервер готов!")
