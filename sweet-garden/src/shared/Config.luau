--[[
	СЛАДКИЙ САД — все настройки игры.

	Здесь можно менять цены, время роста, шансы и награды.
	Самое важное для заработка — ID покупок за Robux (GamePasses и Products):
	создай их в Creator Hub -> твоя игра -> Monetization и впиши номера сюда.
	Пока стоит 0, кнопка в игре пишет «Скоро».
]]

local Config = {}

Config.DataStoreName = "SweetGarden_v1"
Config.LeaderboardStoreName = "SweetGarden_TopEarned_v1"

Config.MaxPlots = 8 -- сколько садов на сервере (поставь «Max Players» = 8)
Config.StartCoins = 20
Config.StartSeeds = { carrot = 3, strawberry = 1 }
Config.RestockSeconds = 300 -- магазин семян обновляется раз в 5 минут
Config.InteractDistance = 35 -- как близко нужно стоять к магазину, чтобы покупать

---------------------------------------------------------------------
-- Покупки за Robux
---------------------------------------------------------------------

Config.GamePasses = {
	sellx2 = 0, -- 💰 Продажа x2
	magnet = 0, -- 🧲 Супер-магнит (+12 к радиусу сбора)
	basket = 0, -- 🧺 Большая корзина (x3)
	petslots = 0, -- 🐾 +2 места для питомцев
	sellanywhere = 0, -- 📱 Продажа из любого места
}
Config.GamePassOrder = { "sellx2", "magnet", "basket", "petslots", "sellanywhere" }

Config.Products = {
	coinsSmall = 0, -- 💰 Мешочек монет
	coinsBig = 0, -- 💰 Сундук монет
	candyStorm = 0, -- 🍬 Конфетный дождь для всего сервера
	growAll = 0, -- ⏩ Вырастить весь сад
}
Config.ProductOrder = { "candyStorm", "growAll", "coinsSmall", "coinsBig" }

---------------------------------------------------------------------
-- Промокоды (каждый игрок может активировать код один раз)
---------------------------------------------------------------------

Config.Codes = {
	SWEET = { coins = 300 },
	GARDEN = { seeds = { blueberry = 2 } },
	CANDY = { seeds = { corn = 1 } },
}

---------------------------------------------------------------------
-- Ежедневная награда (по кругу, 7 дней подряд)
---------------------------------------------------------------------

Config.DailyRewards = {
	{ coins = 100 },
	{ coins = 300 },
	{ seeds = { blueberry = 2 } },
	{ coins = 1500 },
	{ seeds = { corn = 1 } },
	{ coins = 6000 },
	{ seeds = { watermelon = 1 } },
}

---------------------------------------------------------------------
-- Редкость
---------------------------------------------------------------------

Config.Rarities = {
	common = { order = 1, color = Color3.fromRGB(215, 215, 215) },
	uncommon = { order = 2, color = Color3.fromRGB(110, 225, 110) },
	rare = { order = 3, color = Color3.fromRGB(85, 170, 255) },
	epic = { order = 4, color = Color3.fromRGB(190, 110, 255) },
	legendary = { order = 5, color = Color3.fromRGB(255, 200, 40) },
	mythic = { order = 6, color = Color3.fromRGB(255, 90, 150) },
	divine = { order = 7, color = Color3.fromRGB(80, 255, 230) },
}

---------------------------------------------------------------------
-- Семена
--   harvest = "single" — один урожай, потом грядка освобождается
--   harvest = "multi"  — растение остаётся и плодоносит снова и снова
--   grow    — секунды до созревания, regrow — секунды на новый плод
--   value   — цена одного плода при продаже
--   stock   — шанс появиться в магазине при обновлении и сколько штук
---------------------------------------------------------------------

Config.Seeds = {
	{
		id = "carrot",
		emoji = "🥕",
		rarity = "common",
		price = 10,
		stock = { chance = 1, min = 8, max = 20 },
		harvest = "single",
		grow = 20,
		value = 18,
		look = { style = "carrot", leaf = Color3.fromRGB(90, 195, 70), fruit = Color3.fromRGB(255, 140, 30), shape = "carrot", size = 1 },
	},
	{
		id = "strawberry",
		emoji = "🍓",
		rarity = "common",
		price = 50,
		stock = { chance = 1, min = 3, max = 8 },
		harvest = "multi",
		grow = 45,
		regrow = 15,
		maxFruits = 4,
		value = 15,
		look = { style = "bush", leaf = Color3.fromRGB(70, 170, 60), fruit = Color3.fromRGB(235, 40, 60), shape = "ball", size = 0.8, bush = 2.4 },
	},
	{
		id = "blueberry",
		emoji = "🫐",
		rarity = "uncommon",
		price = 400,
		stock = { chance = 0.85, min = 2, max = 5 },
		harvest = "multi",
		grow = 75,
		regrow = 20,
		maxFruits = 5,
		value = 40,
		look = { style = "bush", leaf = Color3.fromRGB(50, 140, 75), fruit = Color3.fromRGB(70, 90, 225), shape = "ball", size = 0.65, bush = 2.8 },
	},
	{
		id = "tomato",
		emoji = "🍅",
		rarity = "uncommon",
		price = 900,
		stock = { chance = 0.7, min = 1, max = 4 },
		harvest = "multi",
		grow = 100,
		regrow = 25,
		maxFruits = 4,
		value = 75,
		look = { style = "tomato", leaf = Color3.fromRGB(60, 160, 60), fruit = Color3.fromRGB(230, 50, 40), shape = "ball", size = 1, bush = 3 },
	},
	{
		id = "corn",
		emoji = "🌽",
		rarity = "rare",
		price = 2000,
		stock = { chance = 0.55, min = 1, max = 3 },
		harvest = "multi",
		grow = 140,
		regrow = 35,
		maxFruits = 3,
		value = 170,
		look = { style = "corn", leaf = Color3.fromRGB(110, 185, 60), fruit = Color3.fromRGB(250, 215, 60), shape = "corn", size = 1 },
	},
	{
		id = "pumpkin",
		emoji = "🎃",
		rarity = "rare",
		price = 3000,
		stock = { chance = 0.45, min = 1, max = 2 },
		harvest = "single",
		grow = 180,
		value = 5200,
		look = { style = "vine", leaf = Color3.fromRGB(70, 150, 50), fruit = Color3.fromRGB(240, 130, 30), shape = "ball", size = 3 },
	},
	{
		id = "watermelon",
		emoji = "🍉",
		rarity = "epic",
		price = 6000,
		stock = { chance = 0.35, min = 1, max = 2 },
		harvest = "single",
		grow = 240,
		value = 11000,
		look = { style = "vine", leaf = Color3.fromRGB(60, 140, 55), fruit = Color3.fromRGB(60, 165, 60), shape = "ball", size = 3.6 },
	},
	{
		id = "mango",
		emoji = "🥭",
		rarity = "epic",
		price = 12000,
		stock = { chance = 0.3, min = 1, max = 2 },
		harvest = "multi",
		grow = 200,
		regrow = 45,
		maxFruits = 4,
		value = 650,
		look = { style = "tree", trunk = Color3.fromRGB(125, 85, 55), leaf = Color3.fromRGB(60, 155, 60), fruit = Color3.fromRGB(255, 175, 40), shape = "ball", size = 1, height = 5, canopy = 5 },
	},
	{
		id = "dragonfruit",
		emoji = "🐉",
		rarity = "legendary",
		price = 60000,
		stock = { chance = 0.18, min = 1, max = 1 },
		harvest = "multi",
		grow = 300,
		regrow = 60,
		maxFruits = 4,
		value = 2600,
		look = { style = "cactus", leaf = Color3.fromRGB(70, 175, 90), fruit = Color3.fromRGB(255, 60, 150), shape = "ball", size = 1.3 },
	},
	{
		id = "candycane",
		emoji = "🍬",
		rarity = "legendary",
		price = 150000,
		stock = { chance = 0.12, min = 1, max = 1 },
		harvest = "multi",
		grow = 360,
		regrow = 70,
		maxFruits = 5,
		value = 6500,
		look = { style = "tree", trunk = Color3.fromRGB(245, 245, 245), leaf = Color3.fromRGB(120, 225, 170), fruit = Color3.fromRGB(225, 30, 45), shape = "cane", size = 1, height = 5.5, canopy = 5.5 },
	},
	{
		id = "cottoncandy",
		emoji = "☁️",
		rarity = "mythic",
		price = 600000,
		stock = { chance = 0.06, min = 1, max = 1 },
		harvest = "multi",
		grow = 480,
		regrow = 90,
		maxFruits = 4,
		value = 26000,
		look = { style = "cloud", trunk = Color3.fromRGB(240, 210, 235), leaf = Color3.fromRGB(255, 180, 225), leaf2 = Color3.fromRGB(170, 215, 255), fruit = Color3.fromRGB(255, 140, 205), shape = "fluff", size = 1.3, height = 5, canopy = 6 },
	},
	{
		id = "rainbow",
		emoji = "🍭",
		rarity = "divine",
		price = 2500000,
		stock = { chance = 0.025, min = 1, max = 1 },
		harvest = "multi",
		grow = 600,
		regrow = 120,
		maxFruits = 3,
		value = 110000,
		look = { style = "lollipop", trunk = Color3.fromRGB(250, 250, 250), leaf = Color3.fromRGB(255, 90, 200), fruit = Color3.fromRGB(255, 120, 220), shape = "lollipop", size = 1.2, height = 6, canopy = 5 },
	},
}

---------------------------------------------------------------------
-- Мутации: умножают цену плода
---------------------------------------------------------------------

Config.Mutations = {
	gold = { mult = 20 },
	rainbow = { mult = 50 },
	wet = { mult = 2 },
	frozen = { mult = 5 },
	sugar = { mult = 6 },
	shocked = { mult = 25 },
}
Config.NaturalChances = { gold = 0.015, rainbow = 0.0015, giant = 0.01 }
Config.Size = { min = 0.85, max = 1.25 }
Config.Giant = { min = 2.2, max = 3 }

---------------------------------------------------------------------
-- Погода
---------------------------------------------------------------------

Config.Weather = {
	firstDelay = { 150, 240 },
	interval = { 420, 720 },
	tick = 5, -- раз в сколько секунд погода пробует изменить плоды
	candyStormDuration = 180,
	order = { "rain", "snow", "thunder", "candy", "rainbow" },
	types = {
		rain = { weight = 50, duration = 120, growth = 1.5, mutation = "wet", chance = 0.04 },
		snow = { weight = 18, duration = 120, growth = 1, mutation = "frozen", chance = 0.03 },
		thunder = { weight = 15, duration = 100, growth = 1.3, mutation = "wet", chance = 0.03, strikeEvery = 7 },
		candy = { weight = 12, duration = 150, growth = 1.2, mutation = "sugar", chance = 0.03, candies = true },
		rainbow = { weight = 5, duration = 90, growth = 1.5, rainbowChance = 0.012 },
	},
}

---------------------------------------------------------------------
-- Улучшения за монеты
--   values[уровень] — что даёт уровень, costs[уровень] — цена следующего
---------------------------------------------------------------------

Config.Upgrades = {
	{ key = "basket", emoji = "🧺", values = { 60, 120, 250, 500, 1000 }, costs = { 1500, 20000, 250000, 3000000 } },
	{ key = "tiles", emoji = "🌱", values = { 12, 18, 24, 30, 36 }, costs = { 4000, 40000, 400000, 4000000 } },
	{ key = "sprinkler", emoji = "💧", values = { 1, 1.25, 1.5, 1.75 }, costs = { 8000, 120000, 1500000 } },
	{ key = "magnet", emoji = "🧲", values = { 6, 10, 14, 18 }, costs = { 2500, 30000, 300000 } },
}

---------------------------------------------------------------------
-- Яйца и питомцы (покупаются только за монеты)
---------------------------------------------------------------------

Config.Eggs = {
	{
		id = "common",
		price = 2500,
		color = Color3.fromRGB(245, 235, 215),
		pets = { { "bunny", 40 }, { "chick", 35 }, { "kitty", 20 }, { "fox", 5 } },
	},
	{
		id = "rare",
		price = 50000,
		color = Color3.fromRGB(120, 190, 255),
		pets = { { "bee", 40 }, { "raccoon", 35 }, { "owl", 20 }, { "panda", 5 } },
	},
	{
		id = "legendary",
		price = 1000000,
		color = Color3.fromRGB(255, 205, 60),
		pets = { { "unicorn", 45 }, { "dragon", 35 }, { "phoenix", 18 }, { "candycat", 2 } },
	},
}

-- bonus: sell — цена продажи, grow — скорость роста, luck — шанс мутаций
Config.Pets = {
	bunny = { emoji = "🐰", rarity = "common", bonus = "sell", amount = 0.05, body = Color3.fromRGB(245, 245, 245), ears = "long", extra = "none" },
	chick = { emoji = "🐤", rarity = "common", bonus = "grow", amount = 0.05, body = Color3.fromRGB(255, 220, 60), ears = "none", extra = "beak" },
	kitty = { emoji = "🐱", rarity = "uncommon", bonus = "luck", amount = 0.1, body = Color3.fromRGB(255, 160, 70), ears = "pointy", extra = "none" },
	fox = { emoji = "🦊", rarity = "rare", bonus = "sell", amount = 0.12, body = Color3.fromRGB(240, 120, 40), ears = "pointy", extra = "tail" },
	bee = { emoji = "🐝", rarity = "uncommon", bonus = "grow", amount = 0.12, body = Color3.fromRGB(255, 205, 40), ears = "none", extra = "wings" },
	raccoon = { emoji = "🦝", rarity = "rare", bonus = "sell", amount = 0.15, body = Color3.fromRGB(140, 140, 150), ears = "round", extra = "mask" },
	owl = { emoji = "🦉", rarity = "epic", bonus = "luck", amount = 0.3, body = Color3.fromRGB(150, 105, 70), ears = "pointy", extra = "beak" },
	panda = { emoji = "🐼", rarity = "legendary", bonus = "grow", amount = 0.2, body = Color3.fromRGB(250, 250, 250), ears = "round", extra = "mask" },
	unicorn = { emoji = "🦄", rarity = "epic", bonus = "sell", amount = 0.4, body = Color3.fromRGB(250, 240, 255), ears = "pointy", extra = "horn" },
	dragon = { emoji = "🐲", rarity = "legendary", bonus = "luck", amount = 0.8, body = Color3.fromRGB(80, 200, 100), ears = "none", extra = "wings" },
	phoenix = { emoji = "🔥", rarity = "mythic", bonus = "grow", amount = 0.45, body = Color3.fromRGB(255, 110, 40), ears = "none", extra = "flame" },
	candycat = { emoji = "🍭", rarity = "divine", bonus = "sell", amount = 1, body = Color3.fromRGB(255, 130, 210), ears = "pointy", extra = "sparkle" },
}
Config.PetSlots = 3
Config.PetSlotsWithPass = 5
Config.MaxPets = 30

---------------------------------------------------------------------
-- Мир
---------------------------------------------------------------------

Config.World = {
	plazaRadius = 40,
	standRadius = 27,
	plotRadius = 118,
	plotHalf = 26,
	tileGrid = 6,
	tileSpacing = 7,
	tileSize = 5.8,
	-- угол (в градусах) каждого магазина вокруг площади
	stands = { seeds = 0, gear = 90, sell = 180, eggs = 270 },
	candyRadius = 150,
}

---------------------------------------------------------------------
-- Быстрый поиск по id (заполняется автоматически)
---------------------------------------------------------------------

Config.SeedById = {}
for index, seed in ipairs(Config.Seeds) do
	seed.index = index
	Config.SeedById[seed.id] = seed
end

Config.UpgradeByKey = {}
for _, upgrade in ipairs(Config.Upgrades) do
	Config.UpgradeByKey[upgrade.key] = upgrade
end

Config.EggById = {}
for _, egg in ipairs(Config.Eggs) do
	Config.EggById[egg.id] = egg
end

return Config
