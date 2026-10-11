--[[
	⭐ ЗВЕЗДОПАД — все настройки игры.

	Здесь можно менять доходы звёзд, цены, шансы и награды.
	Самое важное для заработка — ID покупок за Robux (GamePasses и Products):
	создай их в Creator Hub -> твоя игра -> Monetization и впиши номера сюда.
	Пока стоит 0, кнопка в игре пишет «Скоро».
]]

local Config = {}

Config.DataStoreName = "Starfall_v1"
Config.TopEarnedStoreName = "Starfall_TopEarned_v1"
Config.TopStolenStoreName = "Starfall_TopStolen_v1"

Config.MaxBases = 8 -- сколько баз на сервере (поставь «Max Players» = 8)
Config.MaxSlots = 20 -- больше пьедесталов на базе не бывает
Config.StartCoins = 50
Config.SellSeconds = 15 -- звезда продаётся за 15 секунд своего дохода
Config.OfflineSeconds = 3600 -- без игрока звёзды копят доход максимум 1 час
Config.IndexBonusSeconds = 30 -- бонус за новую звезду в Звездопедии
Config.CarrySpeed = 0.8 -- со звездой в руках бегаешь медленнее
Config.TeleportCooldown = 3
Config.JoinLockSeconds = 45 -- база новичка закрыта первые секунды

---------------------------------------------------------------------
-- Покупки за Robux
---------------------------------------------------------------------

Config.GamePasses = {
	cash2x = 0, -- 💰 Доход x2
	speed = 0, -- ⚡ Быстрые ноги
	superbonk = 0, -- 🥊 Супер-бонк
	pedestals = 0, -- ⭐ +4 пьедестала
	autocollect = 0, -- 🤖 Автосбор монет
}
Config.GamePassOrder = { "cash2x", "speed", "superbonk", "pedestals", "autocollect" }

Config.Products = {
	meteorShower = 0, -- ☄️ Метеоритный дождь для всего сервера
	galaxion = 0, -- 🌌 Звезда Галактион (2000/с)
	coinsSmall = 0, -- 💰 Мешочек монет
	coinsBig = 0, -- 💰 Сундук монет
}
Config.ProductOrder = { "meteorShower", "galaxion", "coinsSmall", "coinsBig" }

---------------------------------------------------------------------
-- Промокоды (каждый игрок может активировать код один раз)
---------------------------------------------------------------------

Config.Codes = {
	STARFALL = { coins = 500 },
	BONK = { coins = 1500 },
	WISH = { star = "frosty" },
}

---------------------------------------------------------------------
-- Ежедневная награда (по кругу, 7 дней подряд)
---------------------------------------------------------------------

Config.DailyRewards = {
	{ coins = 200 },
	{ coins = 600 },
	{ star = "rocketo" },
	{ coins = 3000 },
	{ coins = 8000 },
	{ star = "disco" },
	{ coins = 25000 },
}

---------------------------------------------------------------------
-- Редкость звёзд
---------------------------------------------------------------------

Config.RarityOrder = { "common", "uncommon", "rare", "epic", "legendary", "mythic", "secret" }

-- weight — шанс упасть с неба, life — сколько секунд звезда лежит на поле
Config.Rarities = {
	common = { order = 1, weight = 58, life = 25, scale = 0.8, color = Color3.fromRGB(215, 215, 225) },
	uncommon = { order = 2, weight = 27, life = 28, scale = 0.8, color = Color3.fromRGB(110, 225, 110) },
	rare = { order = 3, weight = 10, life = 32, scale = 0.85, color = Color3.fromRGB(80, 165, 255) },
	epic = { order = 4, weight = 3.5, life = 36, scale = 0.9, color = Color3.fromRGB(195, 105, 255) },
	legendary = { order = 5, weight = 1.2, life = 40, scale = 0.95, color = Color3.fromRGB(255, 195, 40) },
	mythic = { order = 6, weight = 0.25, life = 45, scale = 1.05, color = Color3.fromRGB(255, 75, 125) },
	secret = { order = 7, weight = 0.05, life = 60, scale = 1.2, color = Color3.fromRGB(60, 255, 225) },
}

---------------------------------------------------------------------
-- Звёзды: income — монет в секунду, share — шанс внутри своей редкости
---------------------------------------------------------------------

Config.Stars = {
	{ id = "sparky", rarity = "common", income = 1, share = 2, emoji = "✨", color = Color3.fromRGB(255, 225, 90) },
	{ id = "sleepy", rarity = "common", income = 2, share = 1, emoji = "😴", color = Color3.fromRGB(165, 190, 255) },
	{ id = "pancake", rarity = "uncommon", income = 5, share = 2, emoji = "🥞", color = Color3.fromRGB(235, 180, 100) },
	{ id = "melony", rarity = "uncommon", income = 8, share = 1, emoji = "🍉", color = Color3.fromRGB(255, 105, 120) },
	{ id = "rocketo", rarity = "rare", income = 20, share = 2, emoji = "🚀", color = Color3.fromRGB(235, 235, 245) },
	{ id = "frosty", rarity = "rare", income = 30, share = 1, emoji = "❄️", color = Color3.fromRGB(165, 230, 255) },
	{ id = "disco", rarity = "epic", income = 80, share = 2, emoji = "🕺", color = Color3.fromRGB(200, 205, 230) },
	{ id = "cupcake", rarity = "epic", income = 120, share = 1, emoji = "🧁", color = Color3.fromRGB(255, 165, 205) },
	{ id = "king", rarity = "legendary", income = 400, share = 2, emoji = "👑", color = Color3.fromRGB(255, 205, 50) },
	{ id = "ninja", rarity = "legendary", income = 600, share = 1, emoji = "🗡", color = Color3.fromRGB(70, 70, 90) },
	{ id = "galaxion", rarity = "mythic", income = 2000, share = 2, emoji = "🌌", color = Color3.fromRGB(125, 70, 230) },
	{ id = "pizza", rarity = "mythic", income = 3000, share = 1, emoji = "🍕", color = Color3.fromRGB(255, 190, 80) },
	{ id = "blackhole", rarity = "secret", income = 12000, share = 2, emoji = "🕳", color = Color3.fromRGB(35, 25, 55) },
	{ id = "granny", rarity = "secret", income = 25000, share = 1, emoji = "👵", color = Color3.fromRGB(255, 215, 235) },
}

-- Мутации: золотая звезда приносит x3, радужная x10
Config.Mutations = {
	gold = { mult = 3, chance = 0.05 },
	rainbow = { mult = 10, chance = 0.01 },
}
Config.GoldColor = Color3.fromRGB(255, 200, 40)

---------------------------------------------------------------------
-- Звездопад и метеоритный дождь
---------------------------------------------------------------------

Config.Fall = {
	minInterval = 4, -- секунд между звёздами
	maxInterval = 6,
	warning = 3.5, -- сколько секунд виден луч, пока звезда летит
	radius = 64, -- куда падают звёзды (радиус поля)
	maxStars = 12, -- больше звёзд на поле одновременно не бывает
	dropLife = 20, -- сколько лежит уроненная звезда
}

Config.Shower = {
	minGap = 360, -- метеоритный дождь каждые 6–10 минут
	maxGap = 600,
	duration = 45,
	interval = 0.9,
	luck = 3, -- редкие звёзды падают в 3 раза чаще
	maxStars = 30,
	productDuration = 60,
}

---------------------------------------------------------------------
-- Бонк, кража, ловля
---------------------------------------------------------------------

Config.Bonk = {
	cooldown = 0.9,
	range = 9,
	push = 60,
	superCooldown = 0.6,
	superRange = 13,
	superPush = 85,
	immunity = 1.6, -- после бонка игрока нельзя бонкнуть снова столько секунд
	stun = 1, -- столько секунд нельзя ловить и красть звёзды
}

Config.Steal = { range = 12, hold = 1.2 }
Config.Grab = { range = 14, hold = 0.3 }
Config.SellHold = 0.8

---------------------------------------------------------------------
-- Улучшения
---------------------------------------------------------------------

Config.Upgrades = {
	{ key = "speed", emoji = "👟", values = { 18, 20, 22, 24, 26, 28 }, costs = { 150, 1200, 8000, 50000, 300000 } },
	{ key = "pedestals", emoji = "⭐", values = { 6, 8, 10, 12, 14, 16 }, costs = { 400, 3000, 25000, 200000, 1500000 } },
	{ key = "telescope", emoji = "🔭", values = { 1, 2, 3, 4, 5 }, costs = { 2500, 30000, 300000, 3000000 } },
	{ key = "lock", emoji = "🔒", values = { 30, 40, 50, 60, 75 }, costs = { 600, 6000, 60000, 600000 } },
}

-- Телескоп призывает звезду прямо на базу. Чем выше уровень, тем лучше звёзды.
Config.Telescope = {
	{ cost = 100, weights = { common = 70, uncommon = 25, rare = 5 } },
	{ cost = 1500, weights = { common = 40, uncommon = 37, rare = 18, epic = 5 } },
	{ cost = 15000, weights = { uncommon = 40, rare = 35, epic = 20, legendary = 5 } },
	{ cost = 150000, weights = { rare = 40, epic = 40, legendary = 17, mythic = 3 } },
	{ cost = 1500000, weights = { epic = 45, legendary = 40, mythic = 14, secret = 1 } },
}

-- Перерождение: всё начинается заново, но доход навсегда растёт на 50%
Config.Rebirth = { base = 1000000, growth = 5, bonus = 0.5 }

---------------------------------------------------------------------
-- Быстрый доступ по id
---------------------------------------------------------------------

Config.StarById = {}
Config.StarsByRarity = {}
for _, star in ipairs(Config.Stars) do
	Config.StarById[star.id] = star
	Config.StarsByRarity[star.rarity] = Config.StarsByRarity[star.rarity] or {}
	table.insert(Config.StarsByRarity[star.rarity], star)
end

Config.UpgradeByKey = {}
for _, upgrade in ipairs(Config.Upgrades) do
	Config.UpgradeByKey[upgrade.key] = upgrade
end

return Config
