-- Offline end-to-end test of Sweet Garden in a mock Roblox runtime.
-- Run: luau tests/run.luau   (after python3 tests/gen.py <API-Dump.json>)

local Runtime = require("./mock/runtime")
local Sched = Runtime.Sched
local Inst = Runtime.Inst
local Types = Runtime.Types

local checks, failures = 0, 0
local function check(condition: any, message: string)
	checks += 1
	if not condition then
		failures += 1
		print("FAIL: " .. message)
	end
end
local function section(name: string)
	print(("— %s (t=%.1f, errors=%d)"):format(name, Sched.now, #Sched.errors))
end

Runtime.loadProject(require("./build/sources"))

local function module(path: string)
	return Runtime.require(Runtime.find(path))
end

-- номера покупок для теста
local Config = module("ReplicatedStorage/Shared/Config")
Config.GamePasses.sellx2 = 9001
Config.GamePasses.magnet = 9002
Config.GamePasses.basket = 9003
Config.GamePasses.petslots = 9004
Config.GamePasses.sellanywhere = 9005
Config.Products.coinsSmall = 7001
Config.Products.coinsBig = 7002
Config.Products.candyStorm = 7003
Config.Products.growAll = 7004

---------------------------------------------------------------------
section("server start")
Runtime.runScript("ServerScriptService/Server/Main")
Runtime.advance(1)
local workspace = Runtime.workspace
local map = workspace:FindFirstChild("SweetGarden")
check(map ~= nil, "map folder built")
check(map and map:FindFirstChild("Plot1") and map:FindFirstChild("Plot8"), "8 plots built")
check(map and map:FindFirstChild("Stand_seeds") and map:FindFirstChild("Stand_sell"), "stands built")
check(Runtime.terrainFills >= 1, "terrain filled")
local partCount = 0
for _, item in ipairs(workspace:GetDescendants()) do
	if item.ClassName == "Part" then
		partCount += 1
	end
end
print("parts in world:", partCount)
check(partCount < 3000, "world is not too heavy for phones")

local Sessions = module("ServerScriptService/Server/Sessions")
local Weather = module("ServerScriptService/Server/Weather")

---------------------------------------------------------------------
section("player joins")
local player = Runtime.addPlayer("Ornazk", 101, "ru-ru")
Runtime.advance(2)
check(player.Character ~= nil, "character spawned")
local session = Sessions.get(player)
check(session and session.ready, "session ready")
check(session and session.plot == 1, "plot 1 assigned")

section("client start")
local toasts: { string } = {}
local Hud = module("StarterPlayer/StarterPlayerScripts/Client/Hud")
local originalToast = Hud.toast
Hud.toast = function(text: string, color)
	table.insert(toasts, text)
	originalToast(text, color)
end
local function toasted(pattern: string): boolean
	for _, text in ipairs(toasts) do
		if string.find(text, pattern, 1, true) then
			return true
		end
	end
	return false
end
Runtime.runScript("StarterPlayer/StarterPlayerScripts/Client/Main")
Runtime.advance(6)
local Ctx = module("StarterPlayer/StarterPlayerScripts/Client/Context")
local gui = player.PlayerGui:FindFirstChild("SweetGardenUI")
check(gui ~= nil, "UI created")
check(Ctx.state ~= nil, "client received state")
check(Ctx.state and Ctx.state.plot == 1, "client knows its plot")
check(Ctx.state and Ctx.state.coins == 120, "start coins + daily reward = 120, got " .. tostring(Ctx.state and Ctx.state.coins))
check(toasted("Награда за день 1"), "daily reward toast shown")
local plot1 = map.Plot1
local tiles = plot1.Tiles
local sign = plot1:FindFirstChild("GateBeam").Sign.Text
check(sign.Text == "🏡 Сад: Ornazk", "plot sign localized: " .. sign.Text)

local function tile(i: number)
	return tiles["Tile" .. i]
end
local function prompt(i: number)
	return tile(i).PromptPoint.Prompt
end
local function moveTo(position)
	player.Character:PivotTo(Types.CFrame.new(position + Types.Vector3.new(0, 3, 0)))
end

check(prompt(1).Enabled, "own tile prompt enabled")
check(prompt(1).ActionText == "Посадить", "plant prompt text: " .. prompt(1).ActionText)
check(not map.Plot2.Tiles.Tile1.PromptPoint.Prompt.Enabled, "other plot prompts disabled")
check(not prompt(13).Enabled, "locked tile prompt disabled")

---------------------------------------------------------------------
section("planting")
Runtime.triggerPrompt(prompt(1), player)
Runtime.advance(0.5)
check(tile(1):GetAttribute("Seed") == "carrot", "carrot planted on tile 1")
check(Ctx.state.seeds.carrot == 2, "carrot seeds decreased")
check(Ctx.state.tutorial == 1, "tutorial advanced to step 1")
Ctx.setSelected("strawberry")
Runtime.advance(0.2)
Runtime.triggerPrompt(prompt(2), player)
Runtime.advance(0.5)
check(tile(2):GetAttribute("Seed") == "strawberry", "strawberry planted on tile 2")
check(Ctx.state.seeds.strawberry == nil, "no strawberry seeds left")
check(plot1.Plants:FindFirstChild("Plant1") ~= nil, "plant model built")

section("growing")
Runtime.advance(22)
check(tile(1):GetAttribute("Fruits") == 1, "carrot ripe")
check(prompt(1).ActionText == "Собрать (1)", "harvest prompt: " .. prompt(1).ActionText)
Runtime.triggerPrompt(prompt(1), player)
Runtime.advance(0.5)
check(Ctx.state.basket == 1, "carrot in basket")
check(tile(1):GetAttribute("Seed") == "", "single harvest frees the tile")
check(Ctx.state.tutorial == 2, "tutorial step 2")

Runtime.advance(60)
local fruits = tile(2):GetAttribute("Fruits")
check(fruits >= 3, "strawberry has several fruits: " .. tostring(fruits))
moveTo(tile(2).Position)
Runtime.advance(1)
check(Ctx.state.basket == 1 + fruits, "magnet collected strawberries: " .. tostring(Ctx.state.basket))
check(tile(2):GetAttribute("Seed") == "strawberry", "multi-harvest plant stays")

---------------------------------------------------------------------
section("basket panel")
Runtime.click(Runtime.findText(gui, "🧺").Parent:FindFirstChild("OpenBasket"))
Runtime.advance(1)
check(Runtime.findText(gui, "Всего:") ~= nil, "basket total shown")
check(Runtime.findText(gui, "Клубника") ~= nil, "basket lists strawberries")
Ctx.closePanel()
local restock = map.Stand_seeds.SignAnchor:FindFirstChild("RestockTimer")
check(restock and string.find(restock.TextLabel.Text, "Новые семена", 1, true), "restock timer above the seed shop")

section("selling")
local function button(caption: string)
	local label = Runtime.findText(gui, caption)
	local current = label
	while current and not Inst.classIsA(current.ClassName, "GuiButton") do
		current = current.Parent
	end
	return current
end
local coinsBefore = Ctx.state.coins
Runtime.click(button("Продать"))
Runtime.advance(1.5)
check(Ctx.state.basket == 0, "basket sold")
check(Ctx.state.coins > coinsBefore, "coins went up after selling")
check(Ctx.state.tutorial == 3, "tutorial step 3")

section("seed shop")
Runtime.click(button("Семена"))
Runtime.advance(1)
check(Runtime.findText(gui, "Новые семена через") ~= nil, "restock timer shown")
local buy = Runtime.findText(gui, "💰 10")
check(buy ~= nil, "carrot buy button")
if buy then
	Runtime.click(buy)
end
Runtime.advance(0.5)
check(Ctx.state.seeds.carrot == 3, "bought a carrot seed")
check(Ctx.state.tutorial == 4, "tutorial finished")
Ctx.closePanel()

---------------------------------------------------------------------
section("rich player: upgrades, eggs, pets")
session.data.coins = 50000000
Sessions.markDirty(session)
Runtime.advance(0.3)
Ctx.send("Teleport", "gear")
Runtime.advance(1)
for _, key in ipairs({ "basket", "tiles", "sprinkler", "magnet" }) do
	Ctx.send("BuyUpgrade", key)
	Runtime.advance(0.1)
end
Runtime.advance(0.5)
check(Ctx.state.upgrades.tiles == 2, "tiles upgraded")
check(not tile(13):GetAttribute("Locked"), "tile 13 unlocked")
check(prompt(13).Enabled, "tile 13 prompt enabled")
check(#plot1.Extras:GetChildren() > 0, "sprinkler built")
Ctx.openPanel("gear")
Runtime.advance(0.5)
check(Runtime.findText(gui, "Ур. 2") ~= nil, "gear panel shows level 2")
Ctx.closePanel()

Ctx.send("Teleport", "eggs")
Runtime.advance(1)
for _ = 1, 4 do
	Ctx.send("BuyEgg", "legendary")
	Runtime.advance(0.2)
end
Runtime.advance(2)
check(#Ctx.state.pets == 4, "4 pets hatched")
check(#Ctx.state.equipped == 3, "3 pets equipped")
check(player.Character:FindFirstChild("SweetPets") and #player.Character.SweetPets:GetChildren() == 3, "3 pet models attached")
check(Runtime.findText(gui, "Ура!") ~= nil, "hatch popup shown")
Ctx.openPanel("pets")
Runtime.advance(0.5)
local unequip = Runtime.findText(gui, "Снять")
check(unequip ~= nil, "unequip button")
if unequip then
	Runtime.click(unequip)
end
Runtime.advance(0.5)
check(#Ctx.state.equipped == 2, "pet unequipped")
local delete = Runtime.findText(gui, "🗑")
if delete then
	Runtime.click(delete)
	Runtime.advance(0.2)
	Runtime.click(delete)
end
Runtime.advance(0.5)
check(#Ctx.state.pets == 3, "pet deleted")
Ctx.closePanel()

section("all panels open")
for _, name in ipairs({ "seeds", "gear", "eggs", "pets", "shop", "codes", "pick" }) do
	Ctx.openPanel(name)
	Runtime.advance(1)
	Ctx.closePanel()
end
check(#Runtime.purchases == 0, "no purchase prompts without clicks")

section("codes")
local coins = Ctx.state.coins
Ctx.send("Code", " sweet ")
Runtime.advance(0.5)
check(Ctx.state.coins == coins + 300, "code SWEET gives 300")
Ctx.send("Code", "SWEET")
Runtime.advance(0.5)
check(toasted("уже активирован"), "code reuse message")

---------------------------------------------------------------------
section("garden full of plants")
session.data.seeds.watermelon = 3
session.data.seeds.rainbow = 2
session.data.seeds.mango = 2
session.data.seeds.cottoncandy = 1
session.data.seeds.dragonfruit = 1
session.data.seeds.candycane = 1
session.data.seeds.corn = 2
session.data.seeds.tomato = 2
session.data.seeds.pumpkin = 1
session.data.seeds.blueberry = 2
Sessions.markDirty(session)
Runtime.advance(0.3)
local order = { "watermelon", "rainbow", "mango", "cottoncandy", "dragonfruit", "candycane", "corn", "tomato", "pumpkin", "blueberry" }
local nextTile = 3
for _, seedId in ipairs(order) do
	Ctx.send("Plant", nextTile, seedId)
	nextTile += 1
	Runtime.advance(0.1)
end
Runtime.advance(1)
check(tile(12):GetAttribute("Seed") == "blueberry", "10 different plants planted")

section("weather: all kinds")
for _, id in ipairs({ "rain", "snow", "thunder", "candy", "rainbow" }) do
	Weather.start(id, 20)
	Runtime.advance(2)
	check(workspace:FindFirstChild("LocalWeather") ~= nil, "client weather visuals for " .. id)
	if id == "candy" then
		Runtime.advance(3)
		local candies = workspace:FindFirstChild("Candies")
		local candy = candies and candies:FindFirstChildOfClass("Part")
		check(candy ~= nil, "candies falling")
		if candy then
			local before = session.data.coins
			Runtime.touch(candy, player.Character.HumanoidRootPart)
			Runtime.advance(0.2)
			check(session.data.coins > before, "candy gives coins")
		end
	end
	Runtime.advance(20)
end
check(workspace:FindFirstChild("LocalWeather") == nil, "weather visuals removed after the end")

section("products")
local MarketplaceService = Runtime.MarketplaceService
local receipt = MarketplaceService.ProcessReceipt
check(type(receipt) == "function", "ProcessReceipt set")
local function buy(productId: number, purchaseId: string)
	local result = nil
	Sched.spawn(function()
		result = receipt({ PlayerId = 101, ProductId = productId, PurchaseId = purchaseId, CurrencySpent = 49 })
	end)
	Runtime.advance(1)
	return result
end
local granted = Types.Enum.ProductPurchaseDecision.PurchaseGranted
check(buy(7004, "p1") == granted, "grow-all granted")
check(tile(4):GetAttribute("Fruits") >= 1, "grow-all ripened the rainbow lollipop")
local coinsNow = session.data.coins
check(buy(7001, "p2") == granted, "coins pack granted")
check(session.data.coins > coinsNow, "coins pack added coins")
local coinsAgain = session.data.coins
check(buy(7001, "p2") == granted, "repeated receipt acknowledged")
check(session.data.coins == coinsAgain, "repeated receipt not granted twice")
check(buy(7003, "p3") == granted, "candy storm granted")
check(Weather.currentId() == "candy", "candy storm started")
check(buy(123, "p4") == Types.Enum.ProductPurchaseDecision.NotProcessedYet, "unknown product not processed")
Runtime.advance(200)

section("game passes")
Runtime.Inst.fire(MarketplaceService, "PromptGamePassPurchaseFinished", player, 9005, true)
Runtime.Inst.fire(MarketplaceService, "PromptGamePassPurchaseFinished", player, 9004, true)
Runtime.advance(1)
check(Ctx.state.passes.sellanywhere == true, "sell anywhere pass active")
check(Ctx.state.petSlots == 5, "pet slots pass")
local sellAnywhere = Runtime.findText(gui, "📱")
check(sellAnywhere and sellAnywhere.Parent.Visible, "sell anywhere button visible")
Ctx.openPanel("shop")
Runtime.advance(1)
local shopBuy = Runtime.findText(gui, "R$ 49")
check(shopBuy ~= nil, "shop shows prices")
if shopBuy then
	Runtime.click(shopBuy)
end
Runtime.advance(0.2)
check(#Runtime.purchases == 1, "purchase prompt opened")
Ctx.closePanel()

section("shovel")
Runtime.click(button("Лопата"))
Runtime.advance(0.3)
check(prompt(12).ActionText == "Выкопать", "dig prompt in shovel mode: " .. prompt(12).ActionText)
Runtime.triggerPrompt(prompt(12), player)
Runtime.advance(0.5)
check(tile(12):GetAttribute("Seed") == "", "plant dug up")
Runtime.click(button("Лопата"))
Runtime.advance(0.3)

section("death and respawn")
Runtime.killCharacter(player)
Runtime.advance(4)
check(player.Character and player.Character:FindFirstChild("SweetPets"), "pets re-attached after respawn")

section("portrait screen")
Inst.screenSize = Types.Vector2.new(390, 844)
local screen = player.PlayerGui.SweetGardenUI
Runtime.Inst.states[screen].propSignals.AbsoluteSize:Fire()
Runtime.advance(0.5)
check(Ctx.portrait == true, "portrait mode detected")

section("leaderboard")
Runtime.advance(130)
check(Runtime.findText(map, "Ornazk") ~= nil, "leaderboard shows the player")

---------------------------------------------------------------------
section("leave, offline growth, rejoin")
local strawberryBefore = tile(2):GetAttribute("Fruits")
Runtime.removePlayer(player)
Runtime.advance(2)
local saved = Runtime.stores["SweetGarden_v1"] and Runtime.stores["SweetGarden_v1"]["player_101"]
check(saved ~= nil, "progress saved on leave")
check(map.Plot1:GetAttribute("OwnerId") == 0, "plot released")
check(#map.Plot1.Plants:GetChildren() == 0, "plants removed from released plot")
if saved and saved.plot["2"] then
	saved.plot["2"].f = {}
	saved.plot["2"].r = 0
end
Runtime.advance(600)
local again = Runtime.addPlayer("Ornazk", 101, "ru-ru", false)
Runtime.advance(6)
local session2 = Sessions.get(again)
check(session2 and session2.data.coins == saved.coins, "coins restored")
check(session2 and session2.data.plot["2"] ~= nil, "plants restored")
check(map.Plot1.Tiles.Tile2:GetAttribute("Fruits") == 4, "offline growth filled strawberries: " .. tostring(map.Plot1.Tiles.Tile2:GetAttribute("Fruits")))
print("strawberry fruits before leaving:", strawberryBefore)

section("many players")
for i = 1, 8 do
	Runtime.addPlayer("Guest" .. i, 200 + i, "en-us", false)
end
Runtime.advance(8)
local withoutPlot = 0
for _, p in ipairs(Runtime.players) do
	local s = Sessions.get(p)
	if s and not s.plot then
		withoutPlot += 1
	end
end
check(withoutPlot == 1, "only the 9th player has no plot: " .. withoutPlot)

section("datastore outage")
Runtime.dataStoreFail = true
local unlucky = Runtime.addPlayer("Unlucky", 999, "en-us", false)
Runtime.advance(20)
local s3 = Sessions.get(unlucky)
check(s3 and s3.ready and not s3.canSave, "player can play without saving")
Runtime.dataStoreFail = false

section("server shutdown")
Runtime.closeServer()
Runtime.advance(5)

---------------------------------------------------------------------
print("")
print("toasts shown to the player:")
for _, text in ipairs(toasts) do
	print("  " .. text)
end
print(("checks: %d, failed: %d, runtime errors: %d"):format(checks, failures, #Sched.errors))
local unimplemented = {}
for key in pairs(Inst.unimplemented) do
	table.insert(unimplemented, key)
end
if #unimplemented > 0 then
	print("mock methods missing: " .. table.concat(unimplemented, ", "))
end
for _, line in ipairs(Runtime.log) do
	if string.sub(line, 1, 4) == "WARN" then
		print(line)
	end
end
if failures > 0 or #Sched.errors > 0 then
	error("TESTS FAILED")
end
print("ALL GOOD")
