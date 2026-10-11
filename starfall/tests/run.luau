-- Offline end-to-end test of Starfall in a mock Roblox runtime.
-- Run: luau tests/run.luau   (after python3 tests/gen.py <API-Dump.json>)

local Runtime = require("./mock/runtime")
local Sched = Runtime.Sched
local Inst = Runtime.Inst
local Types = Runtime.Types
local Vector3 = Types.Vector3
local CFrame = Types.CFrame

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
local Logic = module("ReplicatedStorage/Shared/Logic")
Config.GamePasses.cash2x = 9001
Config.GamePasses.speed = 9002
Config.GamePasses.superbonk = 9003
Config.GamePasses.pedestals = 9004
Config.GamePasses.autocollect = 9005
Config.Products.meteorShower = 7001
Config.Products.galaxion = 7002
Config.Products.coinsSmall = 7003
Config.Products.coinsBig = 7004

---------------------------------------------------------------------
section("server start")
Runtime.runScript("ServerScriptService/Server/Main")
Runtime.advance(1)
local workspace = Runtime.workspace
local map = workspace:FindFirstChild("Starfall")
check(map ~= nil, "map folder built")
check(workspace:FindFirstChild("StudioPreview") == nil, "studio preview plate removed")
local basesFolder = map.Bases
check(#basesFolder:GetChildren() == 8, "8 bases built")
check(#basesFolder.Base1.Pedestals:GetChildren() == 20, "20 pedestals per base")
check(map:FindFirstChild("Board_earned") and map:FindFirstChild("Board_stolen"), "two leaderboards")
check(Runtime.terrainFills >= 1, "terrain filled")
local partCount = 0
for _, item in ipairs(workspace:GetDescendants()) do
	if Inst.classIsA(item.ClassName, "BasePart") then
		partCount += 1
	end
end
print("parts in world:", partCount)
check(partCount < 2500, "world is not too heavy for phones: " .. partCount)

local Sessions = module("ServerScriptService/Server/Sessions")
local Stars = module("ServerScriptService/Server/Stars")
local Bases = module("ServerScriptService/Server/Bases")
local World = module("ServerScriptService/Server/World")
local Combat = module("ServerScriptService/Server/Combat")
local base1 = World.bases[1]
local base2 = World.bases[2]

local function moveTo(who, position)
	who.Character:PivotTo(CFrame.new(position))
end
local function rootOf(who)
	return who.Character.HumanoidRootPart
end
local function findFieldStar(starId: string, mut: string?)
	for _, model in ipairs(map.FieldStars:GetChildren()) do
		if model:GetAttribute("Star") == starId and model:GetAttribute("Mut") == (mut or "") then
			return model
		end
	end
	return nil
end
local function starCount(session): number
	local count = 0
	for _ in pairs(session.data.stars) do
		count += 1
	end
	return count
end

---------------------------------------------------------------------
section("player joins")
local player = Runtime.addPlayer("Ornazk", 101, "ru-ru")
Runtime.advance(2)
check(player.Character ~= nil, "character spawned")
local session = Sessions.get(player)
check(session and session.ready, "session ready")
check(session and session.base == 1, "base 1 assigned")
check(basesFolder.Base1:GetAttribute("OwnerId") == 101, "base owner attribute")
check(basesFolder.Base1:GetAttribute("LockedUntil") > workspace:GetServerTimeNow(), "new player's base is locked for a while")
check(base1.door.Transparency < 1, "laser door visible while locked")
check(World.inside(base1, rootOf(player).Position), "player spawned inside own base")
check(player.leaderstats:FindFirstChild("💰") and player.leaderstats:FindFirstChild("🦹"), "leaderstats")

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
local gui = player.PlayerGui:FindFirstChild("StarfallUI")
check(gui ~= nil, "UI created")
check(Ctx.state ~= nil and Ctx.state.base == 1, "client knows its base")
check(Ctx.state and Ctx.state.coins == 250, "start coins + daily reward = 250, got " .. tostring(Ctx.state and Ctx.state.coins))
check(toasted("Награда за день 1"), "daily reward toast")
check(base1.sign.Text == "⭐ База: Ornazk", "base sign localized: " .. base1.sign.Text)
check(basesFolder.Base2.SignAnchor.Sign.Text.Text == "⭐ Свободная база", "free base sign")
check(Runtime.findText(gui, "1/4") ~= nil, "tutorial banner")
check(player.Character.Humanoid.WalkSpeed == 18, "base walk speed")
local localFolder = workspace:FindFirstChild("StarfallLocal")
check(localFolder ~= nil, "client effects folder")

local function button(caption: string)
	local label = Runtime.findText(gui, caption)
	local current = label
	while current and not Inst.classIsA(current.ClassName, "GuiButton") do
		current = current.Parent
	end
	return current
end

---------------------------------------------------------------------
section("a star falls from the sky")
Stars.dropFromSky(nil, "rocketo", "gold")
Runtime.advance(0.3)
local markerCount = 0
for _, marker in ipairs(map.Markers:GetChildren()) do
	if marker:GetAttribute("Star") == "rocketo" and marker:GetAttribute("Mut") == "gold" then
		markerCount += 1
	end
end
check(markerCount >= 1, "warning marker on the field")
check(localFolder:FindFirstChild("Meteor") ~= nil, "client meteor is flying")
check(localFolder:FindFirstChild("Column") ~= nil, "light column above the landing spot")
Runtime.advance(4)
local fieldStar = findFieldStar("rocketo", "gold")
check(fieldStar ~= nil, "rocketo landed on the field")
local grab = fieldStar and fieldStar.Body:FindFirstChild("Prompt")
check(grab and grab.ActionText == "Поймать", "grab prompt localized")
check(grab and string.find(grab.ObjectText, "Ракетка", 1, true), "grab prompt names the star")
check(fieldStar and fieldStar.Body:FindFirstChild("FieldLabel"), "label above the field star")

section("catch")
moveTo(player, fieldStar:GetPivot().Position + Vector3.new(3, 0, 0))
Runtime.triggerPrompt(grab, player)
Runtime.advance(0.5)
check(Ctx.state.carrying and Ctx.state.carrying.t == "rocketo", "carrying the rocketo")
check(player.Character:FindFirstChild("CarriedStar") ~= nil, "star above the head")
check(math.abs(player.Character.Humanoid.WalkSpeed - 14.4) < 0.01, "slower while carrying")
check(Ctx.state.tutorial == 1, "tutorial step 1")
check(Runtime.findText(gui, "Несёшь") ~= nil, "carry banner")
check(fieldStar.Parent == nil, "field star removed")

Ctx.send("Teleport", "base")
Runtime.advance(0.3)
check(toasted("телепорт не работает"), "no teleport while carrying")

section("deliver home")
moveTo(player, base1.spawn.Position)
Runtime.advance(0.6)
check(Ctx.state.carrying == nil, "star delivered")
local star1 = session.data.stars["1"]
check(star1 and star1.t == "rocketo" and star1.m == "gold", "gold rocketo on pedestal 1")
check(base1.stars:FindFirstChild("Slot1") ~= nil, "star model on the pedestal")
check(base1.pedestals[1].part:GetAttribute("Star") == "rocketo", "pedestal attribute")
check(session.data.index.rocketo == true, "star index updated")
check(toasted("Звездопедии"), "new index entry toast")
check(Ctx.state.tutorial == 2, "tutorial step 2")
check(Ctx.state.income == 60, "income 20 x3 (gold) = 60, got " .. tostring(Ctx.state.income))
Runtime.advance(0.5)
local ownPrompt = base1.pedestals[1].prompt
check(ownPrompt.Enabled and string.find(ownPrompt.ActionText, "Продать", 1, true), "own pedestal offers selling: " .. ownPrompt.ActionText)
check(base1.pedestals[1].part:FindFirstChild("StarLabel") ~= nil, "label above the pedestal star")
check(player.Character.Humanoid.WalkSpeed == 18, "speed restored")

section("income and collecting")
Runtime.advance(3)
check(session.data.bank >= 120, "bank grows: " .. session.data.bank)
check(basesFolder.Base1:GetAttribute("Bank") >= 120, "bank shown on the base")
local coinsBefore = session.data.coins
Runtime.touch(base1.collectPad, rootOf(player))
Runtime.advance(0.5)
check(session.data.coins > coinsBefore, "collected coins")
check(session.data.bank < 1, "bank emptied")
check(Ctx.state.tutorial == 3, "tutorial step 3")

section("lock")
Runtime.advance(45)
check(basesFolder.Base1:GetAttribute("LockedUntil") == 0, "join lock expired")
check(toasted("Замок открылся"), "unlock notice")
check(base1.door.Transparency == 1, "laser door hidden")
Runtime.touch(base1.lockPad, rootOf(player))
Runtime.advance(0.5)
check(Bases.isLocked(session), "locked with the red pad")
check(Ctx.state.tutorial == 4, "tutorial finished")
check(toasted("Отлично!"), "tutorial done toast")
Runtime.advance(31)
check(not Bases.isLocked(session), "lock expired again")

---------------------------------------------------------------------
section("a thief joins")
local thief = Runtime.addPlayer("Thief", 202, "en-us", false)
Runtime.advance(3)
local thiefSession = Sessions.get(thief)
check(thiefSession and thiefSession.base == 2, "thief got base 2")

section("steal")
local pedestal1 = base1.pedestals[1]
moveTo(thief, pedestal1.part.Position + Vector3.new(0, 3, 0) - base1.cframe.LookVector * 4)
Stars.steal(thiefSession, 1, 1)
Runtime.advance(0.3)
check(thiefSession.carrying and thiefSession.carrying.t == "rocketo", "thief carries the stolen star")
check(session.data.stars["1"] == nil, "star taken from the pedestal")
check(pedestal1.part:GetAttribute("Star") == "", "pedestal is empty")
check(Runtime.findText(gui, "крадёт") ~= nil, "alarm for the owner")
local carried = thief.Character:FindFirstChild("CarriedStar")
check(carried ~= nil, "thief holds the star")
check(carried and carried.Body:FindFirstChild("CarryLabel") ~= nil, "others see a label on the stolen star")

section("bonk the thief")
local thiefPosition = rootOf(thief).Position
player.Character:PivotTo(CFrame.lookAt(thiefPosition + base1.cframe.LookVector * 5, thiefPosition))
Runtime.advance(0.2)
Hud.bonk()
Runtime.advance(0.3)
check(thiefSession.carrying == nil, "thief dropped the star")
check(session.data.stars["1"] and session.data.stars["1"].t == "rocketo", "star went back to pedestal 1")
check(toasted("вернулась на твою базу"), "returned toast")
check(localFolder:FindFirstChild("Bonk") ~= nil, "БОНК popup")
check(thiefSession.stunnedUntil > Sched.now, "thief stunned")
Hud.bonk()
Runtime.advance(0.3)
check(thiefSession.immuneUntil > Sched.now, "thief immune right after a bonk")

section("the thief bonks back")
Runtime.advance(2)
Combat.bonk(thiefSession)
Runtime.advance(0.2)
check(player.Character.Humanoid.PlatformStand == true, "I tumble after a bonk")
check(Runtime.findText(gui, "Тебя бонкнул") ~= nil, "bonked popup")
Runtime.advance(1.5)
check(player.Character.Humanoid.PlatformStand == false, "I get up again")

section("successful steal")
Runtime.advance(2)
Stars.steal(thiefSession, 1, 1)
Runtime.advance(0.3)
check(thiefSession.carrying ~= nil, "thief steals again")
moveTo(thief, base2.spawn.Position)
Runtime.advance(0.6)
check(thiefSession.carrying == nil, "thief reached home")
local thiefStar = thiefSession.data.stars["1"]
check(thiefStar and thiefStar.t == "rocketo" and thiefStar.m == "gold", "thief owns the star now")
check(thiefSession.data.stats.stolen == 1, "thief stats")
check(session.data.stats.lost == 1, "owner lost a star")
check(toasted("украл звезду"), "steal announced to everyone")
Runtime.advance(0.3)
check(thief.leaderstats["🦹"].Value == 1, "thief leaderstat")

section("steal it back through the prompt")
Runtime.advance(40)
check(not Bases.isLocked(thiefSession), "thief base unlocked")
local enemyPrompt = base2.pedestals[1].prompt
check(enemyPrompt.Enabled and enemyPrompt.ActionText == "Украсть", "enemy pedestal offers stealing: " .. enemyPrompt.ActionText)
moveTo(player, base2.pedestals[1].part.Position + Vector3.new(0, 3, 0) - base2.cframe.LookVector * 4)
Runtime.triggerPrompt(enemyPrompt, player)
Runtime.advance(0.4)
check(Ctx.state.carrying and Ctx.state.carrying.stolen, "I carry my star back")
check(Runtime.findText(gui, "Краденая звезда") ~= nil, "stolen carry banner")
moveTo(player, base1.spawn.Position)
Runtime.advance(0.6)
check(session.data.stars["1"] and session.data.stars["1"].t == "rocketo", "rocketo is home again")
check(session.data.stats.stolen == 1, "my steal counted")

section("locked base keeps thieves out")
Ctx.send("Lock")
Runtime.advance(0.3)
check(Bases.isLocked(session), "locked with the HUD button")
moveTo(thief, base1.pedestals[2].part.Position + Vector3.new(0, 3, -3))
Runtime.advance(0.5)
check(not World.inside(base1, rootOf(thief).Position), "thief thrown out of a locked base")
moveTo(thief, base1.pedestals[1].part.Position + Vector3.new(0, 3, -3))
Stars.steal(thiefSession, 1, 1)
check(thiefSession.carrying == nil, "no stealing from a locked base")
Runtime.advance(0.5)

section("a field star drops when its carrier is bonked")
Stars.dropFromSky(nil, "melony", "rainbow")
Runtime.advance(4)
local melony = findFieldStar("melony", "rainbow")
check(melony ~= nil, "melony on the field")
moveTo(thief, melony:GetPivot().Position + Vector3.new(2, 0, 0))
Runtime.advance(0.2)
Stars.grab(thiefSession, melony:GetAttribute("FieldId"))
check(thiefSession.carrying and thiefSession.carrying.t == "melony", "thief caught the melony")
check(melony.Parent == nil, "caught star left the field")
local rainbowParts = 0
for _, item in ipairs(thief.Character.CarriedStar:GetChildren()) do
	if item:HasTag("Rainbow") then
		rainbowParts += 1
	end
end
check(rainbowParts == 10, "rainbow star rays shimmer")
local thiefAt = rootOf(thief).Position
player.Character:PivotTo(CFrame.lookAt(thiefAt + Vector3.new(0, 0, 4), thiefAt))
Runtime.advance(0.2)
Hud.bonk()
Runtime.advance(0.4)
check(thiefSession.carrying == nil, "thief dropped the melony")
check(findFieldStar("melony", "rainbow") ~= nil, "melony is back on the field")

---------------------------------------------------------------------
section("telescope")
session.data.coins = 10000000
Sessions.markDirty(session)
Runtime.advance(0.3)
local before = starCount(session)
Ctx.openPanel("telescope")
Runtime.advance(0.5)
check(Runtime.findText(gui, "Обычная") ~= nil, "telescope odds")
local summon = button("Призвать звезду")
check(summon ~= nil, "summon button")
if summon then
	Runtime.click(summon)
end
Runtime.advance(1.5)
check(starCount(session) == before + 1, "telescope summoned a star")
check(Runtime.findText(gui, "Телескоп нашёл") ~= nil, "reveal card")
local ok = button("Круто!")
if ok then
	Runtime.click(ok)
end
Runtime.advance(0.3)

section("upgrades")
for _, key in ipairs({ "speed", "pedestals", "telescope", "lock" }) do
	Ctx.send("Upgrade", key)
	Runtime.advance(0.1)
end
Runtime.advance(0.4)
check(Ctx.state.upgrades.speed == 2 and Ctx.state.upgrades.lock == 2, "upgrades bought")
check(player.Character.Humanoid.WalkSpeed == 20, "faster after the upgrade")
check(Ctx.state.slots == 8, "8 pedestals")
check(base1.pedestals[8].part:GetAttribute("Open") == true, "pedestal 8 opened")
check(base1.pedestals[9].part:GetAttribute("Open") == false, "pedestal 9 still closed")
Ctx.openPanel("upgrades")
Runtime.advance(0.5)
check(Runtime.findText(gui, "Ур. 2") ~= nil, "upgrade levels shown")
check(Runtime.findText(gui, "Перерождение #1") ~= nil, "rebirth row")
Ctx.closePanel()

section("my stars panel: sell")
Ctx.openPanel("stars")
Runtime.advance(0.5)
check(Runtime.findText(gui, "Звездопедия") ~= nil, "star index")
check(Runtime.findText(gui, "???") ~= nil, "unknown stars hidden")
local count = starCount(session)
local sell = button("Продать")
check(sell ~= nil, "sell button")
if sell then
	Runtime.click(sell)
	Runtime.advance(0.2)
	if starCount(session) == count then
		Runtime.click(sell)
	end
end
Runtime.advance(0.5)
check(starCount(session) == count - 1, "star sold from the panel")
check(toasted("Продано"), "sold toast")
Ctx.closePanel()

section("selling with the pedestal prompt")
local sellSlot = nil
for key in pairs(session.data.stars) do
	sellSlot = tonumber(key)
end
check(sellSlot ~= nil, "a star to sell")
if sellSlot then
	local sellPrompt = base1.pedestals[sellSlot].prompt
	check(sellPrompt.Enabled and sellPrompt.HoldDuration == Config.SellHold, "sell prompt holds a bit")
	Runtime.triggerPrompt(sellPrompt, player)
	Runtime.advance(0.4)
	check(session.data.stars[tostring(sellSlot)] == nil, "sold with the prompt")
end

section("all panels open")
for _, name in ipairs({ "upgrades", "telescope", "stars", "shop", "codes" }) do
	Ctx.openPanel(name)
	Runtime.advance(1)
	Ctx.closePanel()
end
check(#Runtime.purchases == 0, "no purchase prompts without clicks")

section("codes")
local coins = session.data.coins
Ctx.send("Code", " starfall ")
Runtime.advance(0.5)
check(session.data.coins == coins + 500, "code STARFALL gives 500")
Ctx.send("Code", "STARFALL")
Runtime.advance(0.5)
check(toasted("уже активирован"), "code reuse message")
Ctx.send("Code", "wish")
Runtime.advance(1)
local hasFrosty = false
for _, star in pairs(session.data.stars) do
	if star.t == "frosty" then
		hasFrosty = true
	end
end
check(hasFrosty, "code WISH gives a Frosty star")
check(Runtime.findText(gui, "Новая звезда!") ~= nil, "gift reveal card")
Ctx.send("Code", "nope")
Runtime.advance(0.3)
check(toasted("Такого кода нет"), "bad code message")

section("meteor shower")
local function showerShown(): boolean
	local label = Runtime.findText(gui, "Метеоритный дождь ·")
	return label ~= nil and label.Parent.Visible
end
local drops = 0
local originalDrop = Stars.dropFromSky
Stars.dropFromSky = function(...)
	drops += 1
	return originalDrop(...)
end
Stars.startShower(12)
Runtime.advance(1)
check(showerShown(), "shower timer on the screen")
check(toasted("МЕТЕОРИТНЫЙ ДОЖДЬ"), "shower announced")
Runtime.advance(11)
Stars.dropFromSky = originalDrop
check(drops >= 9 or Stars.fieldCount() >= Config.Shower.maxStars - 2, "stars pour down during the shower: " .. drops)
Runtime.advance(3)
check(not showerShown(), "shower timer gone")

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
check(buy(7001, "p1") == granted, "meteor shower granted")
check(Stars.showerActive(), "bought shower is running")
check(toasted("запустил МЕТЕОРИТНЫЙ ДОЖДЬ"), "bought shower announced")
check(buy(7002, "p2") == granted, "galaxion granted")
local hasGalaxion = false
for _, star in pairs(session.data.stars) do
	if star.t == "galaxion" then
		hasGalaxion = true
	end
end
check(hasGalaxion, "galaxion is in the base")
local coinsNow = session.data.coins
check(buy(7003, "p3") == granted, "coin pack granted")
check(session.data.coins > coinsNow, "coin pack added coins")
local coinsAgain = session.data.coins
check(buy(7003, "p3") == granted, "repeated receipt acknowledged")
check(session.data.coins == coinsAgain, "repeated receipt not granted twice")
check(buy(123, "p4") == Types.Enum.ProductPurchaseDecision.NotProcessedYet, "unknown product not processed")
Runtime.advance(60)

section("a full base: galaxion replaces the weakest star")
for slot = 1, Ctx.state.slots do
	if not session.data.stars[tostring(slot)] then
		Bases.place(session, "sparky", nil, slot)
	end
end
check(Bases.freeSlot(session) == nil, "base is full")
check(buy(7002, "p5") == granted, "second galaxion granted")
local galaxions = 0
for _, star in pairs(session.data.stars) do
	if star.t == "galaxion" then
		galaxions += 1
	end
end
check(galaxions == 2, "weakest star was sold to make room")
Stars.dropFromSky(nil, "cupcake", "gold")
Runtime.advance(4)
local cupcake = findFieldStar("cupcake", "gold")
check(cupcake ~= nil, "cupcake landed")
if cupcake then
	moveTo(player, cupcake:GetPivot().Position + Vector3.new(2, 0, 0))
	Runtime.advance(0.2)
	Runtime.triggerPrompt(cupcake.Body.Prompt, player)
	Runtime.advance(0.3)
	moveTo(player, base1.spawn.Position)
	Runtime.advance(0.6)
end
local hasCupcake = false
for _, star in pairs(session.data.stars) do
	if star.t == "cupcake" then
		hasCupcake = true
	end
end
check(hasCupcake, "a better star replaces the weakest one in a full base")
check(Bases.freeSlot(session) == nil, "base still full")
Ctx.send("Summon")
Runtime.advance(0.3)
check(toasted("Нет свободных пьедесталов"), "telescope needs a free pedestal")

section("game passes")
for _, id in ipairs({ 9001, 9002, 9004, 9005 }) do
	Runtime.Inst.fire(MarketplaceService, "PromptGamePassPurchaseFinished", player, id, true)
end
Runtime.advance(1.5)
check(Ctx.state.passes.cash2x and Ctx.state.passes.autocollect, "passes active")
check(Ctx.state.slots == 12, "4 more pedestals")
check(player.Character.Humanoid.WalkSpeed == 26, "fast feet")
check(session.data.bank < 1, "auto collect keeps the bank empty")
local incomeWithPass = Ctx.state.income
check(incomeWithPass == Logic.totalIncome(session.data, session.passes), "income includes x2")
Ctx.openPanel("shop")
Runtime.advance(1)
check(Runtime.findText(gui, "✅ Есть") ~= nil, "owned passes marked")
local shopBuy = Runtime.findText(gui, "R$ 49")
check(shopBuy ~= nil, "shop shows prices")
if shopBuy then
	Runtime.click(shopBuy)
end
Runtime.advance(0.2)
check(#Runtime.purchases == 1, "purchase prompt opened")
Ctx.closePanel()

section("rebirth")
session.data.coins = Logic.rebirthCost(0) + 10
Sessions.markDirty(session)
Runtime.advance(0.3)
Ctx.send("Rebirth")
Runtime.advance(0.5)
check(session.data.rebirths == 1, "reborn")
check(starCount(session) == 0, "stars reset")
check(session.data.upgrades.speed == 1, "upgrades reset")
check(base1.stars:FindFirstChild("Slot1") == nil, "base cleared")
check(toasted("переродился"), "rebirth announced")
check(player.Character.Humanoid.WalkSpeed == 24, "speed after rebirth (18 + pass)")
Bases.place(session, "sparky", nil)
Runtime.advance(0.3)
check(Ctx.state.income == 1 * 1.5 * 2, "rebirth bonus +50% and x2 pass")

---------------------------------------------------------------------
section("dying while carrying")
Stars.dropFromSky(nil, "pancake", "gold")
Runtime.advance(4)
local pancake = findFieldStar("pancake", "gold")
check(pancake ~= nil, "pancake landed")
moveTo(player, pancake:GetPivot().Position + Vector3.new(2, 0, 0))
Runtime.advance(0.2)
Runtime.triggerPrompt(pancake.Body.Prompt, player)
Runtime.advance(0.3)
check(Ctx.state.carrying and Ctx.state.carrying.t == "pancake", "carrying the pancake")
Runtime.killCharacter(player)
Runtime.advance(0.3)
check(findFieldStar("pancake", "gold") ~= nil, "pancake dropped where I died")
Runtime.advance(4)
check(player.Character and player.Character.Humanoid.Health > 0, "respawned")
check(World.inside(base1, rootOf(player).Position), "respawned at home")
check(Ctx.state.carrying == nil, "not carrying after respawn")

section("portrait screen")
Inst.screenSize = Types.Vector2.new(390, 844)
Runtime.Inst.states[gui].propSignals.AbsoluteSize:Fire()
Runtime.advance(0.5)
check(Ctx.portrait == true, "portrait mode detected")

section("leaderboards")
Runtime.advance(130)
check(Runtime.findText(map.Board_earned, "Ornazk") ~= nil, "richest board shows the player")
check(Runtime.findText(map.Board_stolen, "Thief") ~= nil, "thieves board shows the thief")

---------------------------------------------------------------------
section("leave, offline income, rejoin")
Bases.place(session, "king", "gold")
Runtime.advance(0.5)
Runtime.removePlayer(player)
Runtime.advance(2)
local saved = Runtime.stores["Starfall_v1"] and Runtime.stores["Starfall_v1"]["player_101"]
check(saved ~= nil, "progress saved on leave")
check(basesFolder.Base1:GetAttribute("OwnerId") == 0, "base released")
check(#base1.stars:GetChildren() == 0, "stars removed from the released base")
check(base1.sign.Text == "⭐ Свободная база", "base sign is free again")
Runtime.advance(600)
local again = Runtime.addPlayer("Ornazk", 101, "ru-ru", false)
Runtime.advance(6)
local session2 = Sessions.get(again)
check(session2 and session2.data.rebirths == 1, "rebirths restored")
check(session2 and session2.data.stars["2"] and session2.data.stars["2"].t == "king", "stars restored")
check(session2 and session2.data.bank > 600 * 1000, "offline income in the bank: " .. tostring(session2 and session2.data.bank))

section("many players")
for i = 1, 8 do
	Runtime.addPlayer("Guest" .. i, 300 + i, "en-us", false)
end
Runtime.advance(8)
local withoutBase = 0
for _, p in ipairs(Runtime.players) do
	local s = Sessions.get(p)
	if s and not s.base then
		withoutBase += 1
	end
end
check(withoutBase == 2, "players beyond 8 get no base: " .. withoutBase)

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
