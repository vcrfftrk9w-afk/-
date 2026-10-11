-- Чистая логика игры: расчёты без работы с объектами мира.
-- Используется и сервером, и клиентом.

local Config = require(script.Parent.Config)

local Logic = {}

---------------------------------------------------------------------
-- Числа и время
---------------------------------------------------------------------

local SUFFIXES = { "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc" }

function Logic.format(value: number?): string
	local n = tonumber(value) or 0
	if n ~= n or n == math.huge or n == -math.huge then
		return "0"
	end
	local sign = n < 0 and "-" or ""
	n = math.abs(n)
	if n < 10000 then
		return sign .. tostring(math.floor(n))
	end
	local index = 1
	while n >= 1000 and index < #SUFFIXES do
		n /= 1000
		index += 1
	end
	local text
	if n >= 100 then
		text = tostring(math.floor(n))
	elseif n >= 10 then
		text = string.format("%.1f", math.floor(n * 10) / 10)
	else
		text = string.format("%.2f", math.floor(n * 100) / 100)
	end
	return sign .. text .. SUFFIXES[index]
end

function Logic.formatTime(seconds: number): string
	local s = math.max(0, math.ceil(seconds))
	return string.format("%d:%02d", s // 60, s % 60)
end

function Logic.day(now: number): number
	return math.floor(now / 86400)
end

-- Округляет до двух значащих цифр: 12345 -> 12000
function Logic.niceRound(n: number): number
	if n < 100 then
		return math.floor(n)
	end
	local power = 10 ^ (math.floor(math.log10(n)) - 1)
	return math.floor(n / power) * power
end

---------------------------------------------------------------------
-- Случайные звёзды
---------------------------------------------------------------------

local function boosted(rarity: string, weight: number, luck: number?): number
	if luck and luck > 1 and Config.Rarities[rarity].order >= 3 then
		return weight * luck
	end
	return weight
end

function Logic.fieldWeights(): { [string]: number }
	local weights = {}
	for rarity, info in pairs(Config.Rarities) do
		weights[rarity] = info.weight
	end
	return weights
end

-- Шанс редкости в процентах (для окон с шансами)
function Logic.rarityChance(weights: { [string]: number }, rarity: string, luck: number?): number
	local total = 0
	for name, weight in pairs(weights) do
		total += boosted(name, weight, luck)
	end
	local weight = weights[rarity]
	if not weight or total <= 0 then
		return 0
	end
	return boosted(rarity, weight, luck) / total * 100
end

function Logic.rollRarity(rng: Random, weights: { [string]: number }, luck: number?): string
	local total = 0
	for _, rarity in ipairs(Config.RarityOrder) do
		local weight = weights[rarity]
		if weight then
			total += boosted(rarity, weight, luck)
		end
	end
	local roll = rng:NextNumber() * total
	local last = "common"
	for _, rarity in ipairs(Config.RarityOrder) do
		local weight = weights[rarity]
		if weight then
			last = rarity
			roll -= boosted(rarity, weight, luck)
			if roll < 0 then
				return rarity
			end
		end
	end
	return last
end

function Logic.pickStar(rng: Random, rarity: string): string
	local list = Config.StarsByRarity[rarity] or Config.StarsByRarity.common
	local total = 0
	for _, star in ipairs(list) do
		total += star.share
	end
	local roll = rng:NextNumber() * total
	for _, star in ipairs(list) do
		roll -= star.share
		if roll < 0 then
			return star.id
		end
	end
	return list[#list].id
end

function Logic.rollMutation(rng: Random, luck: number?): string?
	local boost = luck or 1
	local roll = rng:NextNumber()
	local rainbow = Config.Mutations.rainbow.chance * boost
	if roll < rainbow then
		return "rainbow"
	end
	if roll < rainbow + Config.Mutations.gold.chance * boost then
		return "gold"
	end
	return nil
end

---------------------------------------------------------------------
-- Доход и цены
---------------------------------------------------------------------

function Logic.mutationMult(mut: string?): number
	local info = mut and Config.Mutations[mut]
	return info and info.mult or 1
end

function Logic.rarityOf(starId: string): string
	local star = Config.StarById[starId]
	return star and star.rarity or "common"
end

function Logic.rarityOrder(starId: string): number
	return Config.Rarities[Logic.rarityOf(starId)].order
end

-- Множитель дохода игрока: перерождения и геймпасс «Доход x2»
function Logic.incomeMult(data, passes): number
	local mult = 1 + (data.rebirths or 0) * Config.Rebirth.bonus
	if passes and passes.cash2x then
		mult *= 2
	end
	return mult
end

function Logic.baseIncome(starId: string, mut: string?): number
	local star = Config.StarById[starId]
	if not star then
		return 0
	end
	return star.income * Logic.mutationMult(mut)
end

function Logic.starIncome(starId: string, mut: string?, mult: number?): number
	return Logic.baseIncome(starId, mut) * (mult or 1)
end

function Logic.sellValue(starId: string, mut: string?): number
	return math.floor(Logic.baseIncome(starId, mut) * Config.SellSeconds)
end

function Logic.upgradeValue(key: string, level: number?): number
	local upgrade = Config.UpgradeByKey[key]
	local index = math.clamp(math.floor(level or 1), 1, #upgrade.values)
	return upgrade.values[index]
end

function Logic.upgradeCost(key: string, level: number?): number?
	local upgrade = Config.UpgradeByKey[key]
	return upgrade.costs[math.floor(level or 1)]
end

function Logic.slotCount(data, passes): number
	local count = Logic.upgradeValue("pedestals", data.upgrades.pedestals)
	if passes and passes.pedestals then
		count += 4
	end
	return math.min(count, Config.MaxSlots)
end

function Logic.totalIncome(data, passes): number
	local mult = Logic.incomeMult(data, passes)
	local slots = Logic.slotCount(data, passes)
	local total = 0
	for key, star in pairs(data.stars) do
		local slot = tonumber(key)
		if slot and slot <= slots then
			total += Logic.starIncome(star.t, star.m, mult)
		end
	end
	return total
end

function Logic.starCount(data): number
	local count = 0
	for _ in pairs(data.stars) do
		count += 1
	end
	return count
end

function Logic.walkSpeed(data, passes, carrying: boolean): number
	local speed = Logic.upgradeValue("speed", data.upgrades.speed)
	local fast = passes and passes.speed
	if fast then
		speed += 6
	end
	if carrying and not fast then
		speed *= Config.CarrySpeed
	end
	return speed
end

function Logic.lockSeconds(data): number
	return Logic.upgradeValue("lock", data.upgrades.lock)
end

function Logic.telescope(level: number?)
	return Config.Telescope[math.clamp(math.floor(level or 1), 1, #Config.Telescope)]
end

function Logic.rebirthCost(rebirths: number?): number
	return Config.Rebirth.base * Config.Rebirth.growth ^ (rebirths or 0)
end

-- Пакет монет за Robux растёт вместе с игроком
function Logic.coinPack(earned: number?, big: boolean): number
	local amount = math.max(big and 10000 or 2000, (earned or 0) * (big and 0.25 or 0.06))
	return Logic.niceRound(amount)
end

function Logic.dailyReward(streak: number)
	return Config.DailyRewards[((streak - 1) % #Config.DailyRewards) + 1]
end

return Logic
