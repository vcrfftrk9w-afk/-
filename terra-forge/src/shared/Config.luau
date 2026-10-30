-- Game rules and content shared by the server and the client.
local Config = {}

Config.SEATS = 4 -- bases on the map; players take them, bots play the rest
Config.JOIN_SECONDS = 60 -- players can still take a bot's base this long after the start
Config.TICK = 0.1 -- simulation step, seconds
Config.NET_RATE = 0.2 -- how often batched messages are sent
Config.MATCH_SECONDS = 20 * 60
Config.RESULT_SECONDS = 12
Config.MAX_QUEUE = 10

-- metal (kept as `money` in the code): the command centre gives a base income, extractors and
-- fabricators add more; everything is paid in metal
Config.START_MONEY = 1500
Config.BASE_INCOME = 8
-- energy is not stored: buildings make it or use it all the time. When a base uses more than it
-- makes, its factories, fabricators, towers and repair stations work slower, down to this share
Config.MIN_POWER = 0.3
-- the army limit: every unit takes some places in it (pop), whatever the base has built
Config.ARMY_LIMIT = 100
-- new buildings must stand this close (tiles, centre to centre) to one of your buildings, or to
-- one of your supplied strategic points
Config.BUILD_RADIUS = 12

-- strategic points: ground units take one by standing within POINT_RADIUS of it alone, in
-- CAPTURE_TIME seconds (faster with more units, slower when an enemy holds it). A point is
-- supplied when it links to its owner's command centre through own points no further apart than
-- SUPPLY_RANGE; a supplied point gives POINT_INCOME metal a second, vision and a place to build.
-- Places are tile coordinates, mirrored like the map, so every base has the same chances.
Config.POINTS = {
	{ name = "Северный перевал", x = 56, y = 10 },
	{ name = "Южный перевал", x = 56, y = 62 },
	{ name = "Западное ущелье", x = 11, y = 36 },
	{ name = "Восточное ущелье", x = 101, y = 36 },
	{ name = "Северный берег", x = 56, y = 26 },
	{ name = "Южный берег", x = 56, y = 46 },
	{ name = "Северо-западная высота", x = 36, y = 20 },
	{ name = "Северо-восточная высота", x = 76, y = 20 },
	{ name = "Юго-западная высота", x = 36, y = 52 },
	{ name = "Юго-восточная высота", x = 76, y = 52 },
}
Config.POINT_RADIUS = 3
Config.POINT_KEEP = 1.5 -- no building closer than this (tiles, beyond its own half-size) to a point
Config.CAPTURE_TIME = 12
Config.POINT_INCOME = 3
Config.POINT_VISION = 7
Config.POINT_SCORE = 400 -- what a held point adds to its owner's strength
Config.SUPPLY_RANGE = 30

-- a player joining a match has this long to choose a free base and a commander
Config.LANDING_SECONDS = 10

-- commanders: each base has one, which adds its bonuses (shares) for the whole match. income =
-- more metal, build = faster construction, groundDamage / groundHp = ground units, airProduction
-- = faster airfields, airDamage = aircraft, towerDamage = buildings that shoot, buildingHp = all
-- buildings, research = faster research, researchCost = cheaper research
Config.COMMANDER_ORDER = { "industry", "assault", "aviation", "defense", "tech" }
Config.COMMANDERS = {
	industry = { name = "Промышленность", icon = "gear", income = 0.2, build = 0.25, desc = "+20% металла, постройки строятся на 25% быстрее." },
	assault = { name = "Штурм", icon = "swords", groundDamage = 0.15, groundHp = 0.1, desc = "Наземные войска бьют на 15% сильнее и на 10% крепче." },
	aviation = { name = "Авиация", icon = "fighter", airProduction = 0.4, airDamage = 0.15, desc = "Аэродромы работают на 40% быстрее, авиация бьёт на 15% сильнее." },
	defense = { name = "Оборона", icon = "shield", towerDamage = 0.3, buildingHp = 0.25, desc = "Башни, ПВО и командный центр бьют на 30% сильнее, постройки на 25% крепче." },
	tech = { name = "Технологии", icon = "lab", research = 0.5, researchCost = 0.25, desc = "Исследования на 50% быстрее и на 25% дешевле." },
}

-- a commander's bonus of one kind, as a share (0 when the commander has none)
function Config.commander(id: string?, key: string): number
	local c = if id then Config.COMMANDERS[id] else nil
	return if c and c[key] then c[key] else 0
end

-- team colours by base: green, red, blue, yellow
Config.SEAT_COLORS = { "#41b64f", "#e2453a", "#3f8fe2", "#e8c52c" }
Config.BOT_NAMES = {
	"Стальной легион", "Красный берег", "Северный союз", "Железная орда", "Песчаные лисы",
	"Горный клан", "Чёрный утёс", "Громовой перевал", "Угольный край", "Ржавые шестерни",
}

-- the command centre is placed at the start; the rest are built by players.
-- size = footprint in tiles; cost in metal, time in seconds; vision in tiles (fog of war);
-- energy = made (+) or used (-) once built
Config.BUILD_ORDER = { "extractor", "power", "fabricator", "barracks", "tankf", "air", "lab", "repair", "radar", "tower", "aa" }
Config.BUILD = {
	cc = {
		name = "Командный центр",
		icon = "cc",
		size = 3,
		hp = 2400,
		dps = 14,
		range = 5,
		hitsAir = 0.5,
		vision = 9,
		energy = 10,
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
		vision = 5,
		desc = "Добывает металл: +6 в секунду. Ставится только на месторождение — светящуюся воронку.",
	},
	power = {
		name = "Электростанция",
		short = "Электро-\nстанция", -- for the narrow build button
		icon = "power",
		size = 2,
		cost = 250,
		time = 10,
		hp = 450,
		vision = 5,
		energy = 12,
		desc = "Даёт +12 энергии. Энергия нужна заводам, башням, радару и ремонту: если её мало, они работают медленнее.",
	},
	fabricator = {
		name = "Фабрикатор",
		icon = "fabricator",
		size = 2,
		cost = 700,
		time = 16,
		hp = 600,
		income = 5,
		vision = 5,
		energy = -6,
		desc = "Делает металл где угодно на базе: +5 в секунду. Берёт много энергии.",
	},
	barracks = {
		name = "Казарма",
		icon = "barracks",
		size = 2,
		cost = 250,
		time = 8,
		hp = 500,
		units = { "infantry", "rocket", "sniper", "engineer" },
		vision = 6,
		energy = -2,
		desc = "Обучает пехоту, ракетчиков, снайперов и инженеров. Нажми на неё, чтобы заказать.",
	},
	tankf = {
		name = "Завод бронетехники",
		short = "Завод\nтехники",
		icon = "tankf",
		size = 3,
		cost = 600,
		time = 12,
		hp = 900,
		units = { "scout", "tank", "heavy", "artillery", "mlrs", "aagun" },
		vision = 6,
		energy = -4,
		desc = "Собирает броневики, танки, артиллерию, РСЗО и зенитки. Нажми на него, чтобы заказать.",
	},
	air = {
		name = "Аэродром",
		icon = "air",
		size = 3,
		cost = 800,
		time = 15,
		hp = 700,
		units = { "fighter", "gunship", "bomber", "transport", "drone" },
		vision = 7,
		energy = -5,
		desc = "Выпускает истребители, вертолёты, бомбардировщики, транспорты и дроны. Нажми на него, чтобы заказать.",
	},
	lab = {
		name = "Исследовательский центр",
		short = "Исследо-\nвания",
		icon = "lab",
		size = 2,
		cost = 500,
		time = 15,
		hp = 550,
		vision = 6,
		energy = -5,
		research = true, -- studies the technologies of Config.TECH
		desc = "Изучает технологии: броню, орудия, конвейер и тяжёлый танк. Нажми на него, чтобы выбрать.",
	},
	repair = {
		name = "Ремонтная станция",
		icon = "repair",
		size = 2,
		cost = 400,
		time = 10,
		hp = 550,
		vision = 6,
		energy = -4,
		heal = 10, -- health per second for each own unit within healRange
		healRange = 4,
		desc = "Чинит твои войска рядом с собой: +10 здоровья в секунду каждому.",
	},
	radar = {
		name = "Радар",
		icon = "radar",
		size = 2,
		cost = 450,
		time = 10,
		hp = 400,
		vision = 10,
		energy = -4,
		radar = 32, -- enemy units this close show on the minimap, even in the fog
		desc = "Показывает на мини-карте вражеские войска в радиусе 32 клеток, даже в тумане войны. Без энергии не работает.",
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
		vision = 8,
		energy = -3,
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
		vision = 9,
		energy = -3,
		desc = "Сбивает вражескую авиацию в радиусе 8 клеток.",
	},
}

-- hp, damage per second, range and vision in tiles; hitsAir = damage multiplier against aircraft;
-- size = sprite size in tiles; gun = turret sprite, if the unit has one; pop = places in the army
-- limit; repairs = health per second an engineer gives a building within range; needs = the
-- research that must be done before the unit can be ordered; splash = radius in tiles around
-- the target where others take half the damage; boards = can ride in a transport; carry = how
-- many riders a transport takes; hover = an aircraft that stays still instead of circling
Config.UNIT_ORDER = {
	"infantry", "rocket", "sniper", "engineer", "scout", "tank", "heavy", "artillery", "mlrs", "aagun",
	"fighter", "gunship", "bomber", "transport", "drone",
}
Config.UNITS = {
	infantry = {
		title = "Пехота", name = "пехота", icon = "infantry", cost = 60, time = 4, size = 1.8, pop = 1, boards = true,
		hp = 60, dps = 7, range = 2, speed = 1.7, vision = 6, hitsAir = 0.25, power = 0.03,
		desc = "Дешёвая. Может стрелять по авиации.",
	},
	rocket = {
		title = "Ракетчик", name = "ракетчик", icon = "rocket", cost = 110, time = 6, size = 1.8, pop = 1, boards = true,
		hp = 55, dps = 9, range = 3, speed = 1.5, vision = 6, hitsAir = 0.8, power = 0.04,
		desc = "Сильно бьёт по технике и авиации, слаб против пехоты.",
	},
	-- the units from here to the drone have no pictures of their own yet: Drawn draws them
	sniper = {
		title = "Снайпер", name = "снайпер", icon = "sniper", cost = 150, time = 6, size = 1.4, pop = 1, boards = true,
		hp = 45, dps = 8, range = 6, speed = 1.5, vision = 9, hitsAir = 0, power = 0.04,
		desc = "Бьёт издалека и выбивает пехоту. Против техники почти бесполезен.",
	},
	engineer = {
		title = "Инженер", name = "инженер", icon = "engineer", cost = 90, time = 5, size = 1.3, pop = 1, boards = true,
		hp = 60, dps = 0, range = 3, speed = 1.8, vision = 6, hitsAir = 0, hitsGround = false, repairs = 15, power = 0.02,
		desc = "Чинит постройки рядом с собой и ускоряет стройку. Не стреляет.",
	},
	scout = {
		title = "Броневик", name = "броневик", icon = "scout", gun = "scout_gun", cost = 180, time = 6, size = 1.5, pop = 2,
		hp = 130, dps = 10, range = 2.5, speed = 3.4, vision = 10, hitsAir = 0.2, power = 0.05,
		desc = "Быстрый и зоркий. Хорош для разведки.",
	},
	tank = {
		title = "Танк", name = "танк", icon = "tank", gun = "tank_gun", cost = 320, time = 9, size = 1.7, pop = 3,
		hp = 260, dps = 18, range = 3, speed = 2.3, vision = 7, hitsAir = 0, power = 0.08,
		desc = "Крепкая броня, силён против пехоты. По авиации не стреляет.",
	},
	heavy = {
		-- no picture of its own yet: the tank's, drawn bigger
		title = "Тяжёлый танк", name = "тяжёлый танк", icon = "tank", gun = "tank_gun", cost = 600, time = 14, size = 2.3, pop = 5,
		hp = 560, dps = 30, range = 3.5, speed = 1.6, vision = 7, hitsAir = 0, power = 0.12, needs = "heavy",
		desc = "Медленный, но очень крепкий и бьёт сильно. Нужно исследование.",
	},
	artillery = {
		title = "Артиллерия", name = "артиллерия", icon = "artillery", gun = "artillery_gun", cost = 380, time = 11, size = 1.7, pop = 3,
		hp = 110, dps = 22, range = 7, speed = 1.4, vision = 8, hitsAir = 0, power = 0.06, vsBuildings = 1.6,
		desc = "Бьёт издалека, особенно по постройкам. Береги от танков.",
	},
	mlrs = {
		title = "РСЗО", name = "РСЗО", icon = "mlrs", cost = 450, time = 12, size = 1.7, pop = 3,
		hp = 120, dps = 16, range = 8, speed = 1.6, vision = 8, hitsAir = 0, power = 0.07, vsBuildings = 1.3, splash = 1.6,
		desc = "Залп ракет бьёт далеко и задевает всех рядом с целью. Слаба вблизи.",
	},
	aagun = {
		title = "Зенитка", name = "зенитка", icon = "aagun", cost = 300, time = 8, size = 1.6, pop = 2,
		hp = 170, dps = 26, range = 6, speed = 2.6, vision = 9, hitsAir = 1, hitsGround = false, power = 0.05,
		desc = "Подвижная ПВО: сбивает авиацию и прикрывает войска. По земле не стреляет.",
	},
	fighter = {
		title = "Истребитель", name = "истребитель", icon = "fighter", cost = 400, time = 10, size = 1.8, pop = 3,
		hp = 90, dps = 16, range = 3.5, speed = 6.5, vision = 11, hitsAir = 1, hitsGround = false, air = true, power = 0.04,
		desc = "Охотится только за вражеской авиацией.",
	},
	gunship = {
		title = "Вертолёт", name = "вертолёт", icon = "gunship", cost = 480, time = 12, size = 1.8, pop = 4,
		hp = 140, dps = 15, range = 3, speed = 4.5, vision = 9, hitsAir = 0, air = true, power = 0.06,
		desc = "Летает где угодно и бьёт по наземным войскам и постройкам.",
	},
	bomber = {
		title = "Бомбардировщик", name = "бомбардировщик", icon = "bomber", cost = 650, time = 14, size = 2.2, pop = 5,
		hp = 210, dps = 24, range = 3, speed = 4, vision = 9, hitsAir = 0, air = true, power = 0.08, vsBuildings = 2.2, splash = 1.5,
		desc = "Тяжёлые бомбы по постройкам и скоплениям войск. Беззащитен перед истребителями и ПВО.",
	},
	transport = {
		title = "Транспорт", name = "транспортный вертолёт", icon = "transport", cost = 350, time = 10, size = 2, pop = 3,
		hp = 220, dps = 0, range = 0, speed = 5, vision = 8, hitsAir = 0, hitsGround = false, air = true, hover = true, carry = 6, power = 0.02,
		desc = "Перевозит до 6 пехотинцев. Выбери его вместе с пехотой и нажми «Десант».",
	},
	drone = {
		title = "Дрон", name = "дрон-разведчик", icon = "drone", cost = 120, time = 5, size = 1.1, pop = 1,
		hp = 50, dps = 0, range = 0, speed = 7.5, vision = 16, hitsAir = 0, hitsGround = false, air = true, power = 0.01,
		desc = "Быстрый разведчик с огромным обзором. Не стреляет.",
	},
}
-- extra damage multipliers: attacker kind -> target kind
Config.VS = {
	infantry = { tank = 0.5, heavy = 0.4, scout = 0.7, mlrs = 0.7, aagun = 0.7 },
	rocket = { tank = 1.8, heavy = 1.8, scout = 1.5, mlrs = 1.6, aagun = 1.6, infantry = 0.6, sniper = 0.6 },
	scout = { infantry = 1.4, rocket = 1.3, sniper = 1.4 },
	tank = { infantry = 1.6, rocket = 1.3, sniper = 1.6 },
	heavy = { infantry = 1.5, rocket = 1.2, sniper = 1.5 },
	sniper = { infantry = 2.6, rocket = 2.6, sniper = 2.6, engineer = 2.6, scout = 0.3, tank = 0.15, heavy = 0.1, artillery = 0.3, mlrs = 0.3, aagun = 0.3 },
	mlrs = { infantry = 1.3, rocket = 1.3, sniper = 1.3, engineer = 1.3 },
}
Config.MAX_UNITS = 240 -- all bases together, to keep the server fast

-- research at the research centre: one study at a time in each centre, paid when it starts and
-- slower when energy is short. armor = share of the damage own units no longer take, damage =
-- share added to the damage of own units and towers, production = share added to the speed of
-- factories, unlocks = a unit that can be ordered once done; needs = research done before
Config.TECH_ORDER = { "armor1", "weapons1", "assembly", "armor2", "weapons2", "heavy" }
Config.TECH = {
	armor1 = { name = "Броня I", icon = "shield", cost = 400, time = 30, armor = 0.15, desc = "Твои войска получают на 15% меньше урона." },
	weapons1 = { name = "Орудия I", icon = "swords", cost = 400, time = 30, damage = 0.15, desc = "Войска и башни бьют на 15% сильнее." },
	assembly = { name = "Конвейер", icon = "gear", cost = 500, time = 35, production = 0.3, desc = "Заводы выпускают войска на 30% быстрее." },
	armor2 = { name = "Броня II", icon = "shield", cost = 700, time = 45, armor = 0.15, needs = "armor1", desc = "Ещё −15% урона: всего −30%." },
	weapons2 = { name = "Орудия II", icon = "swords", cost = 700, time = 45, damage = 0.15, needs = "weapons1", desc = "Ещё +15% урона: всего +30%." },
	heavy = { name = "Тяжёлый танк", icon = "tank", cost = 600, time = 40, unlocks = "heavy", needs = "armor1", desc = "Завод бронетехники сможет собирать тяжёлые танки." },
}

-- what a base's finished research adds up to: armor, damage and production shares
function Config.techBonus(done: { [string]: boolean }?): (number, number, number)
	local armor, damage, production = 0, 0, 0
	for id in done or {} do
		local t = Config.TECH[id]
		if t then
			armor += t.armor or 0
			damage += t.damage or 0
			production += t.production or 0
		end
	end
	return armor, damage, production
end

return Config
