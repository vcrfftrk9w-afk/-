-- Game rules and content shared by the server and the client.
local Config = {}

Config.W = 720
Config.H = 336
Config.N = 720 * 336

Config.TOTAL_NATIONS = 40 -- humans + bots in one match
Config.SPAWN_SECONDS = 10
Config.TICK = 0.1 -- simulation step, seconds
Config.NET_RATE = 0.2 -- how often territory changes are sent to clients
Config.WIN_SHARE = 0.25 -- share of all land that wins the match
Config.MATCH_SECONDS = 25 * 60
Config.RESULT_SECONDS = 12
Config.CAPITAL_RADIUS = 3
Config.MAX_QUEUE = 10

Config.START_TROOPS = 2500
Config.ATTACK_STEPS = { 20, 40, 60, 80 }

-- money: the capital pays a base income, every tile of land adds a little, extractors add more
Config.START_MONEY = 1500
Config.BASE_INCOME = 6
Config.LAND_INCOME = 1 / 40

-- how far you can see, in tiles; everything else is under fog during the war
Config.VISION = { land = 4, building = 6, capital = 9 }

Config.HUMAN_COLORS = { "#ff3e8a", "#b45cff", "#18d4c4", "#ffe14d", "#ff7a2f", "#5b8cff", "#7dff6a", "#ff5c5c" }
Config.BOT_COLORS = {
	"#e0603a", "#f2a33a", "#d9c43c", "#8fbf45", "#3fae6a", "#2bb3a3", "#2c9fd6", "#4f7be0", "#7a68e0", "#a35de0",
	"#c9783e", "#8d6e4f", "#5e8c6a", "#3d6f8f", "#b04a4a", "#6f7d92", "#c4a35a", "#4fb0c6", "#9bb83c", "#e38b5a",
}

Config.BOT_NAMES = {
	"Северный союз", "Железная орда", "Песчаные лисы", "Ледяной край", "Красный берег", "Степные волки",
	"Медный трон", "Тихая гавань", "Лесное братство", "Горный клан", "Золотой залив", "Чёрный утёс",
	"Восточный ветер", "Серые совы", "Каменный щит", "Южный крест", "Дикие пески", "Синяя бухта",
	"Туманный край", "Вольный порт", "Орлиное гнездо", "Белые медведи", "Соляные копи", "Хвойный предел",
	"Янтарный берег", "Ржавые шестерни", "Угольный край", "Нефтяные бароны", "Стальной легион", "Речные выдры",
	"Полярная звезда", "Лунная долина", "Кедровый союз", "Морские волки", "Громовой перевал", "Изумрудные холмы",
	"Дымные трубы", "Бронзовый век", "Пустынные скорпионы", "Красные кирпичи",
}

-- cost in money, build time in seconds
Config.BUILD_ORDER = { "extractor", "city", "barracks", "tankf", "air", "tower", "aa" }
Config.BUILD = {
	extractor = {
		name = "Экстрактор",
		icon = "extractor",
		cost = 300,
		time = 8,
		hp = 350,
		income = 6,
		onDeposit = true,
		desc = "Добывает деньги: +6 $/с. Ставится только на месторождение: рыжие, серые и чёрные пятна на карте.",
	},
	city = {
		name = "Город",
		icon = "city",
		cost = 500,
		time = 14,
		hp = 500,
		income = 2,
		desc = "Больше людей: +1500 к пределу войск, быстрее их прирост и +2 $/с.",
	},
	barracks = {
		name = "Казарма",
		icon = "barracks",
		cost = 250,
		time = 8,
		hp = 400,
		units = { "infantry", "rocket" },
		desc = "Обучает пехоту и ракетчиков. Нажми на неё на карте, чтобы заказать.",
	},
	tankf = {
		name = "Танковый завод",
		icon = "tank",
		cost = 600,
		time = 12,
		hp = 600,
		units = { "scout", "tank", "artillery" },
		desc = "Собирает броневики, танки и артиллерию. Нажми на него на карте, чтобы заказать.",
	},
	air = {
		name = "Аэродром",
		icon = "plane",
		cost = 800,
		time = 15,
		hp = 450,
		units = { "fighter", "gunship" },
		desc = "Выпускает истребители и вертолёты. Нажми на него на карте, чтобы заказать.",
	},
	tower = {
		name = "Башня",
		icon = "tower",
		cost = 350,
		time = 8,
		hp = 450,
		dps = 20,
		range = 5,
		hitsAir = 0,
		desc = "Сама стреляет по вражеской пехоте и технике в радиусе 5 клеток.",
	},
	aa = {
		name = "ПВО",
		icon = "aa",
		cost = 400,
		time = 8,
		hp = 300,
		dps = 34,
		range = 7,
		hitsAir = 1,
		airOnly = true,
		desc = "Сбивает вражескую авиацию в радиусе 7 клеток.",
	},
}

-- hp, damage per second, range and vision in tiles; hitsAir = damage multiplier against aircraft
Config.UNIT_ORDER = { "infantry", "rocket", "scout", "tank", "artillery", "fighter", "gunship" }
Config.UNITS = {
	infantry = {
		title = "Пехота", name = "пехота", icon = "infantry", cost = 60, time = 4,
		hp = 60, dps = 7, range = 1.6, speed = 1.7, vision = 6, hitsAir = 0.25, power = 0.03,
		desc = "Дешёвая. Захватывает землю, может стрелять по авиации.",
	},
	rocket = {
		title = "Ракетчик", name = "ракетчик", icon = "rocket", cost = 110, time = 6,
		hp = 55, dps = 9, range = 2.4, speed = 1.5, vision = 6, hitsAir = 0.8, power = 0.04,
		desc = "Сильно бьёт по технике и авиации, слаб против пехоты.",
	},
	scout = {
		title = "Броневик", name = "броневик", icon = "scout", cost = 180, time = 6,
		hp = 130, dps = 10, range = 2, speed = 3.4, vision = 10, hitsAir = 0.2, power = 0.05,
		desc = "Быстрый и зоркий. Хорош для разведки и захвата земли.",
	},
	tank = {
		title = "Танк", name = "танк", icon = "tank", cost = 320, time = 9,
		hp = 240, dps = 18, range = 2.6, speed = 2.3, vision = 7, hitsAir = 0, power = 0.08,
		desc = "Крепкая броня, силён против пехоты. По авиации не стреляет.",
	},
	artillery = {
		title = "Артиллерия", name = "артиллерия", icon = "artillery", cost = 380, time = 11,
		hp = 110, dps = 22, range = 6, speed = 1.4, vision = 7, hitsAir = 0, power = 0.06, vsBuildings = 1.6,
		desc = "Бьёт издалека, особенно по постройкам. Береги от танков.",
	},
	fighter = {
		title = "Истребитель", name = "истребитель", icon = "fighter", cost = 400, time = 10,
		hp = 90, dps = 16, range = 3, speed = 6.5, vision = 11, hitsAir = 1, hitsGround = false, air = true, power = 0.04,
		desc = "Охотится только за вражеской авиацией.",
	},
	gunship = {
		title = "Вертолёт", name = "вертолёт", icon = "gunship", cost = 480, time = 12,
		hp = 130, dps = 15, range = 2.5, speed = 4.5, vision = 9, hitsAir = 0, air = true, power = 0.06,
		desc = "Летает где угодно и бьёт по наземным войскам и постройкам.",
	},
}
-- extra damage multipliers: attacker kind -> target kind
Config.VS = {
	infantry = { tank = 0.5, scout = 0.7 },
	rocket = { tank = 1.8, scout = 1.5, infantry = 0.6 },
	scout = { infantry = 1.4, rocket = 1.3 },
	tank = { infantry = 1.6, rocket = 1.3 },
}
Config.MAX_UNITS = 320
Config.MAX_UNITS_PER_NATION = 60
Config.BOT_MAX_UNITS = 6

return Config
