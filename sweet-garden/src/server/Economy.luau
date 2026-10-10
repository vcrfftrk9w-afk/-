-- Монеты: магазин семян, улучшения, яйца, продажа урожая, коды, ежедневная награда.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Logic = require(Shared:WaitForChild("Logic"))

local Sessions = require(script.Parent.Sessions)
local World = require(script.Parent.World)
local Garden = require(script.Parent.Garden)
local Pets = require(script.Parent.Pets)

type Session = Sessions.Session

local Economy = {}

local function near(session: Session, standKey: string): boolean
	local stand = World.stands[standKey]
	local character = session.player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not stand or not root or not root:IsA("BasePart") then
		return false
	end
	return (root.Position - stand.counter.Position).Magnitude <= Config.InteractDistance
end
Economy.near = near

local function grantReward(session: Session, reward)
	local data = session.data
	if reward.coins then
		data.coins += reward.coins
	end
	for seedId, count in pairs(reward.seeds or {}) do
		if Config.SeedById[seedId] then
			data.seeds[seedId] = (data.seeds[seedId] or 0) + count
		end
	end
	Sessions.markDirty(session)
end

local function rewardText(reward): { string }
	local parts = {}
	if reward.coins then
		table.insert(parts, "$" .. Logic.format(reward.coins))
	end
	for seedId, count in pairs(reward.seeds or {}) do
		table.insert(parts, "%" .. seedId .. ":" .. count)
	end
	return parts
end

---------------------------------------------------------------------
-- Семена
---------------------------------------------------------------------

function Economy.buySeed(session: Session, seedId: any)
	if type(seedId) ~= "string" then
		return
	end
	local seed = Config.SeedById[seedId]
	if not seed then
		return
	end
	if not near(session, "seeds") then
		Sessions.notify(session, "n_too_far")
		return
	end
	local data = session.data
	local slot = Logic.restockSlot(os.time())
	if data.stock.slot ~= slot then
		data.stock = { slot = slot, bought = {} }
	end
	local bought = data.stock.bought[seedId] or 0
	if bought >= Logic.stockAmount(slot, seedId) then
		Sessions.notify(session, "n_no_stock")
		return
	end
	if data.coins < seed.price then
		Sessions.notify(session, "n_need_coins")
		return
	end
	data.coins -= seed.price
	data.stock.bought[seedId] = bought + 1
	data.seeds[seedId] = (data.seeds[seedId] or 0) + 1
	if not session.selected or (data.seeds[session.selected] or 0) <= 0 then
		session.selected = seedId
	end
	if data.tutorial == 3 then
		data.tutorial = 4
		Sessions.notify(session, "n_tutorial_done")
	end
	Sessions.notify(session, "n_bought_seed", "@seed_" .. seedId)
	Sessions.markDirty(session)
end

function Economy.select(session: Session, seedId: any)
	if type(seedId) == "string" and Config.SeedById[seedId] then
		session.selected = seedId
		Sessions.markDirty(session)
	end
end

---------------------------------------------------------------------
-- Улучшения
---------------------------------------------------------------------

function Economy.buyUpgrade(session: Session, key: any)
	if type(key) ~= "string" or not Config.UpgradeByKey[key] then
		return
	end
	if not near(session, "gear") then
		Sessions.notify(session, "n_too_far")
		return
	end
	local data = session.data
	local level = data.upgrades[key] or 1
	local cost = Logic.upgradeCost(key, level)
	if not cost then
		Sessions.notify(session, "n_max_level")
		return
	end
	if data.coins < cost then
		Sessions.notify(session, "n_need_coins")
		return
	end
	data.coins -= cost
	data.upgrades[key] = level + 1
	Garden.onUpgrade(session, key)
	Sessions.notify(session, "n_upgrade", "@upg_" .. key)
	Sessions.markDirty(session)
end

---------------------------------------------------------------------
-- Яйца
---------------------------------------------------------------------

function Economy.buyEgg(session: Session, eggId: any)
	if type(eggId) ~= "string" then
		return
	end
	local egg = Config.EggById[eggId]
	if not egg then
		return
	end
	if not near(session, "eggs") then
		Sessions.notify(session, "n_too_far")
		return
	end
	local data = session.data
	if #data.pets >= Config.MaxPets then
		Sessions.notify(session, "n_max_pets", Config.MaxPets)
		return
	end
	if data.coins < egg.price then
		Sessions.notify(session, "n_need_coins")
		return
	end
	data.coins -= egg.price
	local petId = Logic.rollPet(egg, session.rng)
	Pets.add(session, petId)
	Sessions.push(session, "hatch", { egg = eggId, pet = petId })
	local rarity = Config.Rarities[Config.Pets[petId].rarity].order
	if rarity >= 5 then
		Sessions.notifyAll("n_hatch_announce", session.player.DisplayName, "@pet_" .. petId)
	end
	Sessions.markDirty(session)
end

---------------------------------------------------------------------
-- Продажа урожая
---------------------------------------------------------------------

function Economy.sell(session: Session)
	local data = session.data
	if not session.passes.sellanywhere and not near(session, "sell") then
		Sessions.notify(session, "n_too_far")
		return
	end
	if #data.basket == 0 then
		Sessions.notify(session, "n_nothing_to_sell")
		return
	end
	local mult = Logic.sellMultiplier(session.bonus, session.passes)
	local total = 0
	local best, bestValue = nil, -1
	for _, fruit in ipairs(data.basket) do
		local value = Logic.fruitValue(fruit.id, fruit) * mult
		total += value
		if value > bestValue then
			bestValue = value
			best = fruit
		end
	end
	total = math.floor(total)
	local count = #data.basket
	data.basket = {}
	data.stats.sold += count
	Sessions.addCoins(session, total, true)
	if data.tutorial == 2 then
		data.tutorial = 3
	end
	Sessions.push(session, "sold", {
		total = total,
		count = count,
		best = best and { id = best.id, c = best.c, w = best.w, g = best.g, v = math.floor(bestValue) } or nil,
	})
	Sessions.markDirty(session)
end

-- Что лежит в корзине: группы одинаковых плодов, самые дорогие сверху
function Economy.basketSummary(session: Session)
	local data = session.data
	local mult = Logic.sellMultiplier(session.bonus, session.passes)
	local groups = {}
	local total = 0
	for _, fruit in ipairs(data.basket) do
		local key = fruit.id .. "|" .. (fruit.c or "") .. "|" .. (fruit.w or "") .. "|" .. (fruit.g and "g" or "")
		local group = groups[key]
		if not group then
			group = { id = fruit.id, c = fruit.c, w = fruit.w, g = fruit.g, n = 0, v = 0 }
			groups[key] = group
		end
		local value = Logic.fruitValue(fruit.id, fruit) * mult
		group.n += 1
		group.v += value
		total += value
	end
	local list = {}
	for _, group in pairs(groups) do
		group.v = math.floor(group.v)
		table.insert(list, group)
	end
	table.sort(list, function(a, b)
		return a.v > b.v
	end)
	while #list > 40 do
		table.remove(list)
	end
	return { count = #data.basket, total = math.floor(total), groups = list }
end

function Economy.sendBasket(session: Session)
	Sessions.push(session, "basket", Economy.basketSummary(session))
end

---------------------------------------------------------------------
-- Коды и награды
---------------------------------------------------------------------

function Economy.redeem(session: Session, text: any)
	if type(text) ~= "string" or #text > 40 then
		return
	end
	local code = string.upper((string.gsub(text, "%s", "")))
	local reward = Config.Codes[code]
	if not reward then
		Sessions.notify(session, "n_code_bad")
		return
	end
	if session.data.codes[code] then
		Sessions.notify(session, "n_code_used")
		return
	end
	session.data.codes[code] = true
	grantReward(session, reward)
	Sessions.push(session, "reward", { key = "n_code_ok", parts = rewardText(reward) })
end

function Economy.checkDaily(session: Session)
	local data = session.data
	local today = Logic.day(os.time())
	if data.daily.day == today then
		return
	end
	if data.daily.day == today - 1 then
		data.daily.streak += 1
	else
		data.daily.streak = 1
	end
	data.daily.day = today
	local reward = Config.DailyRewards[((data.daily.streak - 1) % #Config.DailyRewards) + 1]
	grantReward(session, reward)
	Sessions.push(session, "reward", { key = "n_daily", day = data.daily.streak, parts = rewardText(reward) })
end

function Economy.coinPack(session: Session, big: boolean)
	local amount = Logic.coinPack(session.data.stats.earned, big)
	Sessions.addCoins(session, amount, false)
	Sessions.notify(session, "n_coins", Logic.format(amount))
end

return Economy
