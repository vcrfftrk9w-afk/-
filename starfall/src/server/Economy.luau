-- Монеты: улучшения, телескоп, перерождение, коды, ежедневная награда.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Logic = require(Shared:WaitForChild("Logic"))

local Sessions = require(script.Parent.Sessions)
local Util = require(script.Parent.Util)
local Bases = require(script.Parent.Bases)
local Stars = require(script.Parent.Stars)

type Session = Sessions.Session

local Economy = {}

local rng = Random.new()

---------------------------------------------------------------------
-- Выдать звезду (награды, коды, покупки)
---------------------------------------------------------------------

-- Ставит звезду на базу. Если места нет, продаёт самую слабую звезду (если новая лучше),
-- иначе выдаёт монеты по цене звезды.
function Economy.grantStar(session: Session, starId: string, mut: string?, source: string): boolean
	if Bases.placeBest(session, starId, mut) then
		Sessions.push(session, "summon", { t = starId, m = mut or "", source = source })
		return true
	end
	local value = Logic.sellValue(starId, mut)
	Sessions.addCoins(session, value, false)
	Sessions.notify(session, "n_full_sold", Util.starArg(starId, mut), Logic.format(value))
	return false
end

local function grantReward(session: Session, reward, source: string)
	if reward.coins then
		Sessions.addCoins(session, reward.coins, false)
	end
	if reward.star then
		Economy.grantStar(session, reward.star, nil, source)
	end
	Sessions.markDirty(session)
end

local function rewardParts(reward): { string }
	local parts = {}
	if reward.coins then
		table.insert(parts, "$" .. Logic.format(reward.coins))
	end
	if reward.star then
		table.insert(parts, "*" .. reward.star)
	end
	return parts
end

---------------------------------------------------------------------
-- Улучшения и перерождение
---------------------------------------------------------------------

function Economy.buyUpgrade(session: Session, key: any)
	if type(key) ~= "string" or not Config.UpgradeByKey[key] then
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
	if key == "speed" then
		Stars.applySpeed(session)
	elseif key == "pedestals" then
		Bases.render(session)
	end
	Sessions.notify(session, "n_upgrade", "@upg_" .. key)
	Sessions.markDirty(session)
end

function Economy.rebirth(session: Session)
	local data = session.data
	local cost = Logic.rebirthCost(data.rebirths)
	if data.coins < cost then
		Sessions.notify(session, "n_need_coins")
		return
	end
	if session.carrying then
		Stars.drop(session, "rebirth")
	end
	data.coins = 0
	data.bank = 0
	data.stars = {}
	for key in pairs(data.upgrades) do
		data.upgrades[key] = 1
	end
	data.rebirths += 1
	Bases.render(session)
	Stars.applySpeed(session)
	local bonus = tostring(math.floor(data.rebirths * Config.Rebirth.bonus * 100))
	Sessions.notify(session, "n_rebirth", bonus)
	Sessions.announce("n_rebirth_all", "epic", session.player.DisplayName, tostring(data.rebirths))
	Sessions.markDirty(session)
end

---------------------------------------------------------------------
-- Телескоп: звезда прямо на базу
---------------------------------------------------------------------

function Economy.summon(session: Session)
	local data = session.data
	local scope = Logic.telescope(data.upgrades.telescope)
	if not session.base then
		Sessions.notify(session, "n_no_base")
		return
	end
	if not Bases.freeSlot(session) then
		Sessions.notify(session, "n_base_full")
		return
	end
	if data.coins < scope.cost then
		Sessions.notify(session, "n_need_coins")
		return
	end
	data.coins -= scope.cost
	local rarity = Logic.rollRarity(rng, scope.weights)
	local starId = Logic.pickStar(rng, rarity)
	local mut = Logic.rollMutation(rng)
	Bases.place(session, starId, mut)
	Sessions.push(session, "summon", { t = starId, m = mut or "", source = "telescope" })
	if Config.Rarities[rarity].order >= 5 then
		Sessions.announce("n_summon_rare", rarity, session.player.DisplayName, Util.starArg(starId, mut))
	end
	Sessions.markDirty(session)
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
	grantReward(session, reward, "code")
	Sessions.push(session, "reward", { key = "n_code_ok", parts = rewardParts(reward) })
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
	local reward = Logic.dailyReward(data.daily.streak)
	grantReward(session, reward, "daily")
	Sessions.push(session, "reward", { key = "n_daily", day = data.daily.streak, parts = rewardParts(reward) })
end

function Economy.coinPack(session: Session, big: boolean)
	local amount = Logic.coinPack(session.data.stats.earned, big)
	Sessions.addCoins(session, amount, false)
	Sessions.notify(session, "n_coins", Logic.format(amount))
end

return Economy
