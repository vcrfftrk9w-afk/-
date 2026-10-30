-- Game rules and content shared by the server and the client.
local Config = {}

Config.W = 720
Config.H = 336
Config.N = 720 * 336

Config.TOTAL_NATIONS = 40 -- humans + bots in one match
Config.SPAWN_SECONDS = 15
Config.TICK = 0.1 -- simulation step, seconds
Config.NET_RATE = 0.2 -- how often territory changes are sent to clients
Config.WIN_SHARE = 0.25 -- share of all land that wins the match
Config.MATCH_SECONDS = 25 * 60
Config.RESULT_SECONDS = 12
Config.CAPITAL_RADIUS = 3

Config.START_TROOPS = 2500
Config.START_RES = { iron = 450, coal = 160, oil = 120, steel = 220 }
Config.ATTACK_STEPS = { 20, 40, 60, 80 }

Config.HUMAN_COLORS = { "#ff3e8a", "#b45cff", "#18d4c4", "#ffe14d", "#ff7a2f", "#5b8cff", "#7dff6a", "#ff5c5c" }
Config.BOT_COLORS = {
	"#e0603a", "#f2a33a", "#d9c43c", "#8fbf45", "#3fae6a", "#2bb3a3", "#2c9fd6", "#4f7be0", "#7a68e0", "#a35de0",
	"#c9783e", "#8d6e4f", "#5e8c6a", "#3d6f8f", "#b04a4a", "#6f7d92", "#c4a35a", "#4fb0c6", "#9bb83c", "#e38b5a",
}
Config.SPAWN_GRAY = { 230, 226, 216 }
Config.SPAWN_GRAY_BORDER = { 138, 134, 126 }

Config.BOT_NAMES = {
	"Северный союз", "Железная орда", "Песчаные лисы", "Ледяной край", "Красный берег", "Степные волки",
	"Медный трон", "Тихая гавань", "Лесное братство", "Горный клан", "Золотой залив", "Чёрный утёс",
	"Восточный ветер", "Серые совы", "Каменный щит", "Южный крест", "Дикие пески", "Синяя бухта",
	"Туманный край", "Вольный порт", "Орлиное гнездо", "Белые медведи", "Соляные копи", "Хвойный предел",
	"Янтарный берег", "Ржавые шестерни", "Угольный край", "Нефтяные бароны", "Стальной легион", "Речные выдры",
	"Полярная звезда", "Лунная долина", "Кедровый союз", "Морские волки", "Громовой перевал", "Изумрудные холмы",
	"Дымные трубы", "Бронзовый век", "Пустынные скорпионы", "Красные кирпичи",
}

Config.RES_NAMES = {
	pop = "Войска",
	iron = "Железо",
	coal = "Уголь",
	oil = "Нефть",
	steel = "Сталь",
	energy = "Энергия",
}
-- genitive forms for amounts: "50 железа", "30 угля"
Config.RES_OF = {
	pop = "войск",
	iron = "железа",
	coal = "угля",
	oil = "нефти",
	steel = "стали",
}
Config.RES_ORDER = { "pop", "iron", "coal", "oil", "steel" }

Config.BUILD_ORDER = { "mine", "rig", "power", "mill", "barracks", "tankf", "air" }
Config.BUILD = {
	mine = {
		name = "Шахта",
		icon = "mine",
		cost = { iron = 50 },
		power = 0,
		desc = "Копает железо и уголь. На рыжем пятне руды железо ×3, на тёмном пятне угля уголь ×3.",
	},
	rig = {
		name = "Нефтевышка",
		icon = "rig",
		cost = { iron = 80 },
		power = 0,
		desc = "Качает нефть. На чёрных пятнах нефти в пять раз больше.",
	},
	power = {
		name = "Электростанция",
		icon = "power",
		cost = { iron = 100, coal = 30 },
		power = -12,
		desc = "Сжигает уголь и даёт 12 энергии заводам.",
	},
	mill = {
		name = "Сталеплавильня",
		icon = "mill",
		cost = { iron = 120 },
		power = 4,
		desc = "Плавит 2 железа и 1 уголь в 1 сталь каждую секунду.",
	},
	barracks = {
		name = "Казарма",
		icon = "barracks",
		cost = { iron = 80 },
		power = 2,
		unit = "infantry",
		every = 6,
		ucost = { pop = 60 },
		desc = "Обучает пехоту. Каждый солдат делает твои атаки сильнее.",
	},
	tankf = {
		name = "Танковый завод",
		icon = "tank",
		cost = { iron = 60, steel = 60 },
		power = 6,
		unit = "tank",
		every = 9,
		ucost = { steel = 25, oil = 8 },
		desc = "Собирает танки. Танк заметно усиливает атаки и оборону.",
	},
	air = {
		name = "Аэродром",
		icon = "plane",
		cost = { steel = 90, oil = 40 },
		power = 8,
		unit = "plane",
		every = 12,
		ucost = { steel = 35, oil = 20 },
		desc = "Выпускает самолёты. Они патрулируют небо и помогают в атаках.",
	},
}

Config.UNITS = {
	infantry = { name = "пехота", speed = 1.7, power = 0.03 },
	tank = { name = "танк", speed = 2.4, power = 0.08 },
	plane = { name = "самолёт", speed = 0, power = 0.05 },
}
Config.MAX_UNITS = 170

Config.ARSENAL = {
	{ icon = "infantry", name = "Пехота", desc = "Дешёвая и быстрая. Захватывает землю и держит границу.", open = true },
	{ icon = "tank", name = "Танк", desc = "Крепкая броня. Пробивает оборону соседей.", open = true },
	{ icon = "plane", name = "Самолёт", desc = "Летает над страной и усиливает атаки.", open = true },
	{ icon = "artillery", name = "Артиллерия", desc = "Будет сама стрелять по врагам у границы.", open = false },
	{ icon = "ship", name = "Корабль", desc = "Будет перевозить войска через море.", open = false },
}

return Config
