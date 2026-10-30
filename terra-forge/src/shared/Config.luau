-- Game rules and content shared by the server and the client.
local Config = {}

Config.SEATS = 4 -- bases on the map; players take them, bots play the rest
Config.JOIN_SECONDS = 60 -- players can still take a bot's base this long after the start
Config.TICK = 0.1 -- simulation step, seconds
Config.NET_RATE = 0.2 -- how often batched messages are sent
Config.MATCH_SECONDS = 20 * 60
Config.RESULT_SECONDS = 12
Config.MAX_QUEUE = 10

-- money: the command centre pays a base income, extractors and fabricators add more
Config.START_MONEY = 1500
Config.BASE_INCOME = 8
-- new buildings must stand this close (tiles, centre to centre) to one of your buildings
Config.BUILD_RADIUS = 12

-- team colours by base: green, red, blue, yellow
Config.SEAT_COLORS = { "#41b64f", "#e2453a", "#3f8fe2", "#e8c52c" }
Config.BOT_NAMES = {
	"Стальной легион", "Красный берег", "Северный союз", "Железная орда", "Песчаные лисы",
	"Горный клан", "Чёрный утёс", "Громовой перевал", "Угольный край", "Ржавые шестерни",
}

-- the command centre is placed at the start; the rest are built by players.
-- size = footprint in tiles; cost in money, time in seconds
Config.BUILD_ORDER = { "extractor", "fabricator", "barracks", "tankf", "air", "tower", "aa" }
Config.BUILD = {
	cc = {
		name = "Командный центр",
		icon = "cc",
		size = 3,
		hp = 2400,
		dps = 14,
		range = 5,
		hitsAir = 0.5,
		desc = "Сердце базы. Если его уничтожат, ты проиграл.",
	},
	extractor = {
		name = "Экстрактор",
		icon = "extractor",
		size = 2,
		cost = 300,
		time = 8,
		hp = 500,
		income = 6,
		onPool = true,
		desc = "Добывает деньги: +6 $/с. Ставится только на месторождение — светящуюся воронку.",
	},
	fabricator = {
		name = "Фабрикатор",
		icon = "fabricator",
		size = 2,
		cost = 700,
		time = 16,
		hp = 600,
		income = 5,
		desc = "Производит деньги где угодно на базе: +5 $/с.",
	},
	barracks = {
		name = "Казарма",
		icon = "barracks",
		size = 2,
		cost = 250,
		time = 8,
		hp = 500,
		units = { "infantry", "rocket" },
		desc = "Обучает пехоту и ракетчиков. Нажми на неё, чтобы заказать.",
	},
	tankf = {
		name = "Завод бронетехники",
		icon = "tankf",
		size = 3,
		cost = 600,
		time = 12,
		hp = 900,
		units = { "scout", "tank", "artillery" },
		desc = "Собирает броневики, танки и артиллерию. Нажми на него, чтобы заказать.",
	},
	air = {
		name = "Аэродром",
		icon = "air",
		size = 3,
		cost = 800,
		time = 15,
		hp = 700,
		units = { "fighter", "gunship" },
		desc = "Выпускает истребители и вертолёты. Нажми на него, чтобы заказать.",
	},
	tower = {
		name = "Пушечная башня",
		icon = "tower",
		size = 2,
		cost = 350,
		time = 8,
		hp = 650,
		dps = 22,
		range = 6,
		hitsAir = 0,
		desc = "Сама стреляет по вражеской пехоте и технике в радиусе 6 клеток.",
	},
	aa = {
		name = "ПВО",
		icon = "aa",
		size = 2,
		cost = 400,
		time = 8,
		hp = 450,
		dps = 34,
		range = 8,
		hitsAir = 1,
		airOnly = true,
		desc = "Сбивает вражескую авиацию в радиусе 8 клеток.",
	},
}

-- hp, damage per second, range and vision in tiles; hitsAir = damage multiplier against aircraft;
-- size = sprite size in tiles; gun = turret sprite, if the unit has one
Config.UNIT_ORDER = { "infantry", "rocket", "scout", "tank", "artillery", "fighter", "gunship" }
Config.UNITS = {
	infantry = {
		title = "Пехота", name = "пехота", icon = "infantry", cost = 60, time = 4, size = 1.8,
		hp = 60, dps = 7, range = 2, speed = 1.7, vision = 6, hitsAir = 0.25, power = 0.03,
		desc = "Дешёвая. Может стрелять по авиации.",
	},
	rocket = {
		title = "Ракетчик", name = "ракетчик", icon = "rocket", cost = 110, time = 6, size = 1.8,
		hp = 55, dps = 9, range = 3, speed = 1.5, vision = 6, hitsAir = 0.8, power = 0.04,
		desc = "Сильно бьёт по технике и авиации, слаб против пехоты.",
	},
	scout = {
		title = "Броневик", name = "броневик", icon = "scout", gun = "scout_gun", cost = 180, time = 6, size = 1.5,
		hp = 130, dps = 10, range = 2.5, speed = 3.4, vision = 10, hitsAir = 0.2, power = 0.05,
		desc = "Быстрый и зоркий. Хорош для разведки.",
	},
	tank = {
		title = "Танк", name = "танк", icon = "tank", gun = "tank_gun", cost = 320, time = 9, size = 1.7,
		hp = 260, dps = 18, range = 3, speed = 2.3, vision = 7, hitsAir = 0, power = 0.08,
		desc = "Крепкая броня, силён против пехоты. По авиации не стреляет.",
	},
	artillery = {
		title = "Артиллерия", name = "артиллерия", icon = "artillery", gun = "artillery_gun", cost = 380, time = 11, size = 1.7,
		hp = 110, dps = 22, range = 7, speed = 1.4, vision = 8, hitsAir = 0, power = 0.06, vsBuildings = 1.6,
		desc = "Бьёт издалека, особенно по постройкам. Береги от танков.",
	},
	fighter = {
		title = "Истребитель", name = "истребитель", icon = "fighter", cost = 400, time = 10, size = 1.8,
		hp = 90, dps = 16, range = 3.5, speed = 6.5, vision = 11, hitsAir = 1, hitsGround = false, air = true, power = 0.04,
		desc = "Охотится только за вражеской авиацией.",
	},
	gunship = {
		title = "Вертолёт", name = "вертолёт", icon = "gunship", cost = 480, time = 12, size = 1.8,
		hp = 140, dps = 15, range = 3, speed = 4.5, vision = 9, hitsAir = 0, air = true, power = 0.06,
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
Config.MAX_UNITS = 240
Config.MAX_UNITS_PER_NATION = 60

return Config
