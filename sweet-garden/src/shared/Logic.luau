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
	local s = math.max(0, math.floor(seconds))
	return string.format("%d:%02d", s // 60, s % 60)
end

function Logic.day(now: number): number
	return math.floor(now / 86400)
end

local function round2(n: number): number
	return math.floor(n * 100 + 0.5) / 100
end

-- Округляет до двух значащих цифр: 12345 -> 12000
local function niceRound(n: number): number
	if n < 100 then
		return math.floor(n)
	end
	local power = 10 ^ (math.floor(math.log10(n)) - 1)
	return math.floor(n / power) * power
end
Logic.niceRound = niceRound

---------------------------------------------------------------------
-- Улучшения, корзина, магнит, питомцы
---------------------------------------------------------------------

function Logic.upgradeValue(key: string, level: number?): number
	local upgrade = Config.UpgradeByKey[key]
	local index = math.clamp(math.floor(level or 1), 1, #upgrade.values)
	return upgrade.values[index]
end

function Logic.upgradeCost(key: string, level: number?): number?
	local upgrade = Config.UpgradeByKey[key]
	return upgrade.costs[math.floor(level or 1)]
end

function Logic.basketCapacity(data, passes): number
	local capacity = Logic.upgradeValue("basket", data.upgrades.basket)
	if passes and passes.basket then
		capacity *= 3
	end
	return capacity
end

function Logic.magnetRadius(data, passes): number
	local radius = Logic.upgradeValue("magnet", data.upgrades.magnet)
	if passes and passes.magnet then
		radius += 12
	end
	return radius
end

function Logic.unlockedTiles(data): number
	return Logic.upgradeValue("tiles", data.upgrades.tiles)
end

function Logic.petSlots(passes): number
	if passes and passes.petslots then
		return Config.PetSlotsWithPass
	end
	return Config.PetSlots
end

function Logic.petBonuses(pets, equipped)
	local bonus = { sell = 0, grow = 0, luck = 0 }
	local owned = {}
	for _, pet in ipairs(pets or {}) do
		owned[pet.u] = pet.id
	end
	for _, uid in ipairs(equipped or {}) do
		local def = Config.Pets[owned[uid] or ""]
		if def then
			bonus[def.bonus] += def.amount
		end
	end
	return bonus
end

function Logic.sellMultiplier(bonus, passes): number
	local mult = 1 + (bonus and bonus.sell or 0)
	if passes and passes.sellx2 then
		mult *= 2
	end
	return mult
end

function Logic.growSpeed(data, bonus, weatherGrowth: number?): number
	local sprinkler = Logic.upgradeValue("sprinkler", data.upgrades.sprinkler)
	return sprinkler * (1 + (bonus and bonus.grow or 0)) * (weatherGrowth or 1)
end

---------------------------------------------------------------------
-- Плоды
---------------------------------------------------------------------

-- Новый плод: размер и естественные мутации (золото, радуга, гигант)
function Logic.rollFruit(rng: Random, luck: number?)
	local mult = 1 + (luck or 0)
	local chances = Config.NaturalChances
	local fruit = {}
	if rng:NextNumber() < chances.giant * mult then
		fruit.s = round2(Config.Giant.min + rng:NextNumber() * (Config.Giant.max - Config.Giant.min))
		fruit.g = true
	else
		fruit.s = round2(Config.Size.min + rng:NextNumber() * (Config.Size.max - Config.Size.min))
	end
	local roll = rng:NextNumber()
	if roll < chances.rainbow * mult then
		fruit.c = "rainbow"
	elseif roll < (chances.rainbow + chances.gold) * mult then
		fruit.c = "gold"
	end
	return fruit
end

function Logic.fruitValue(seedId: string, fruit): number
	local seed = Config.SeedById[seedId]
	if not seed or type(fruit) ~= "table" then
		return 0
	end
	local value = seed.value * (tonumber(fruit.s) or 1)
	local color = fruit.c and Config.Mutations[fruit.c]
	if color then
		value *= color.mult
	end
	local weather = fruit.w and Config.Mutations[fruit.w]
	if weather then
		value *= weather.mult
	end
	return value
end

-- Можно ли заменить погодную мутацию плода на новую (только на более ценную)
function Logic.betterWeatherMutation(current: string?, new: string): boolean
	if current == nil then
		return true
	end
	local old = Config.Mutations[current]
	local candidate = Config.Mutations[new]
	return candidate ~= nil and (old == nil or candidate.mult > old.mult)
end

---------------------------------------------------------------------
-- Рост растений
--   plant = { id = "strawberry", p = прогресс роста, r = прогресс нового плода, f = { ["1"] = плод } }
---------------------------------------------------------------------

function Logic.maxFruits(seed): number
	if seed.harvest == "single" then
		return 1
	end
	return seed.maxFruits or 1
end

function Logic.fruitCount(plant): number
	local count = 0
	for _ in pairs(plant.f) do
		count += 1
	end
	return count
end

function Logic.freeSlot(plant, seed): string?
	for i = 1, Logic.maxFruits(seed) do
		local slot = tostring(i)
		if plant.f[slot] == nil then
			return slot
		end
	end
	return nil
end

-- 0..3 — стадии роста, 4 — созрело
function Logic.stage(plant, seed): number
	if plant.p >= seed.grow then
		return 4
	end
	return math.clamp(math.floor(plant.p / seed.grow * 4), 0, 3)
end

function Logic.newPlant(seedId: string)
	return { id = seedId, p = 0, r = 0, f = {} }
end

-- Продвигает растение на dt «эффективных» секунд (уже умноженных на скорость).
-- Возвращает список новых плодов (номера мест) и созрело ли растение сейчас.
function Logic.advance(plant, seed, dt: number, rng: Random, luck: number?): ({ string }, boolean)
	local spawned = {}
	local matured = false
	if dt <= 0 or dt ~= dt then
		return spawned, matured
	end

	if plant.p < seed.grow then
		plant.p += dt
		if plant.p < seed.grow then
			return spawned, matured
		end
		dt = plant.p - seed.grow
		plant.p = seed.grow
		matured = true
		local slot = Logic.freeSlot(plant, seed)
		if slot then
			plant.f[slot] = Logic.rollFruit(rng, luck)
			table.insert(spawned, slot)
		end
		if seed.harvest ~= "multi" then
			return spawned, matured
		end
	end

	if seed.harvest ~= "multi" then
		return spawned, matured
	end

	-- все места заняты: новый плод начнёт расти только после сбора
	if Logic.fruitCount(plant) >= Logic.maxFruits(seed) then
		plant.r = 0
		return spawned, matured
	end

	plant.r = (plant.r or 0) + dt
	while plant.r >= seed.regrow do
		local slot = Logic.freeSlot(plant, seed)
		if not slot then
			plant.r = 0
			break
		end
		plant.r -= seed.regrow
		plant.f[slot] = Logic.rollFruit(rng, luck)
		table.insert(spawned, slot)
	end
	return spawned, matured
end

-- Сколько «эффективных» секунд нужно, чтобы растение полностью созрело и заполнилось плодами
function Logic.timeToFill(plant, seed): number
	local need = math.max(0, seed.grow - plant.p)
	if seed.harvest == "multi" then
		local missing = Logic.maxFruits(seed) - Logic.fruitCount(plant)
		if plant.p < seed.grow then
			missing -= 1 -- первый плод появляется сразу при созревании
		end
		need += math.max(0, missing) * seed.regrow
	end
	return need
end

---------------------------------------------------------------------
-- Магазин семян: одинаковый на всех серверах в одно и то же время
---------------------------------------------------------------------

function Logic.restockSlot(now: number): number
	return math.floor(now / Config.RestockSeconds)
end

local stockCache = { slot = -1, list = {} }

function Logic.stockFor(slot: number)
	if stockCache.slot == slot then
		return stockCache.list
	end
	local rng = Random.new(slot * 7919 + 1013)
	local list = {}
	for _, seed in ipairs(Config.Seeds) do
		local amount = 0
		if rng:NextNumber() < seed.stock.chance then
			amount = rng:NextInteger(seed.stock.min, seed.stock.max)
		end
		table.insert(list, { id = seed.id, amount = amount })
	end
	stockCache = { slot = slot, list = list }
	return list
end

function Logic.stockAmount(slot: number, seedId: string): number
	for _, item in ipairs(Logic.stockFor(slot)) do
		if item.id == seedId then
			return item.amount
		end
	end
	return 0
end

---------------------------------------------------------------------
-- Яйца, погода, награды
---------------------------------------------------------------------

function Logic.rollPet(egg, rng: Random): string
	local total = 0
	for _, entry in ipairs(egg.pets) do
		total += entry[2]
	end
	local roll = rng:NextNumber() * total
	for _, entry in ipairs(egg.pets) do
		roll -= entry[2]
		if roll < 0 then
			return entry[1]
		end
	end
	return egg.pets[#egg.pets][1]
end

function Logic.petChance(egg, petId: string): number
	local total, weight = 0, 0
	for _, entry in ipairs(egg.pets) do
		total += entry[2]
		if entry[1] == petId then
			weight = entry[2]
		end
	end
	if total <= 0 then
		return 0
	end
	return weight / total
end

function Logic.pickWeather(rng: Random): string
	local weather = Config.Weather
	local total = 0
	for _, id in ipairs(weather.order) do
		total += weather.types[id].weight
	end
	local roll = rng:NextNumber() * total
	for _, id in ipairs(weather.order) do
		roll -= weather.types[id].weight
		if roll < 0 then
			return id
		end
	end
	return weather.order[1]
end

function Logic.coinPack(earned: number?, big: boolean): number
	local amount = math.max(1000, (earned or 0) * 0.1)
	if big then
		amount *= 6
	end
	return niceRound(amount)
end

function Logic.candyReward(earned: number?): number
	return math.floor(10 + math.sqrt(math.max(0, earned or 0)) * 0.3)
end

return Logic
