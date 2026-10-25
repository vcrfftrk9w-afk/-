-- Настройки режима «Фронт». Все числа баланса собраны здесь.
local Config = {}

-- карта
Config.MAP_W = 80
Config.MAP_H = 50
Config.TILE = 4                 -- размер клетки в стадах
Config.LAND_SHARE = 0.5         -- доля суши
Config.NATIONS = 20             -- стран в матче (игроки + боты)

-- фазы матча, секунды
Config.SPAWN_TIME = 20          -- выбор места старта
Config.IMMUNITY_TIME = 40       -- после старта: страны нельзя атаковать, только нейтральную землю
Config.MATCH_TIME = 25 * 60     -- по истечении побеждает самая большая страна
Config.WIN_SHARE = 0.8          -- доля суши для победы
Config.RESTART_DELAY = 15

-- армия и экономика
Config.START_TROOPS = 2500
Config.BASE_MAX_TROOPS = 3000
Config.TROOPS_PER_TILE = 80
Config.TROOPS_PER_CITY = 4000   -- за каждый уровень города
Config.GROWTH_RATE = 0.06       -- рост войск в секунду от текущих
Config.GROWTH_BASE = 30
Config.BOT_GROWTH = 0.9         -- боты растут чуть медленнее игроков
Config.GOLD_BASE = 20           -- золота в секунду
Config.GOLD_PER_TILE = 0.2
Config.DEFAULT_RATIO = 0.5      -- какую часть войск отправлять в атаку

-- захват
Config.ATTACK_TICK = 0.25
Config.CAPTURE_PER_BORDER = 0.12  -- чем длиннее общая граница, тем быстрее захват
Config.MAX_CAPTURE_PER_TICK = 30
Config.NEUTRAL_COST = 10
Config.ENEMY_BASE_COST = 20
Config.DENSITY_FACTOR = 1.2       -- плотность обороны: войска врага на клетку
Config.DEFENDER_LOSS = 0.6
Config.TERRAIN_COST = { [1] = 1, [2] = 1.5, [3] = 2.5 }  -- равнина, холмы, горы

-- постройки: базовая цена, рост цены за каждый уровень, максимум уровня
Config.BUILDINGS = {
	City    = { name = "Город",   cost = 1500, grow = 1.5, max = 5 },
	Port    = { name = "Порт",    cost = 1200, grow = 1.5, max = 5 },
	Defense = { name = "Турель",  cost = 600,  grow = 1.4, max = 5 },
	Factory = { name = "Завод",   cost = 2500, grow = 1.6, max = 5 },
	Silo    = { name = "Шахта",   cost = 5000, grow = 2.0, max = 3 },
}
Config.BUILD_ORDER = { "City", "Port", "Defense", "Factory", "Silo" }
Config.DEFENSE_RADIUS = 4
Config.DEFENSE_BONUS = 0.6        -- за уровень турели
Config.FACTORY_BONUS = 0.12       -- сила атаки за уровень завода
Config.FACTORY_BONUS_MAX = 1.0

-- флот
Config.TRANSPORT_SPEED = 10       -- клеток в секунду
Config.MAX_TRANSPORTS = 3
Config.TRADE_INTERVAL = 12
Config.TRADE_SPEED = 7
Config.TRADE_GOLD_PER_TILE = 6

-- ядерный удар
Config.NUKE_COST = 8000
Config.NUKE_RADIUS = 4
Config.NUKE_TIME_BASE = 3
Config.NUKE_TIME_PER_TILE = 0.04

-- боты
Config.BOT_INTERVAL = 1.5
Config.GANG_UP_SHARE = 0.25       -- лидера с такой долей суши атакуют все соседи
Config.MAX_ALLIES = 3

-- модели: если импортированные из Blender корабли плывут задом, поставь 180
Config.MODEL_YAW = 0

Config.NAMES = {
	"Арктида", "Борея", "Вельмар", "Гардия", "Дорвин", "Эстерра", "Жаромир", "Зелания",
	"Ирмос", "Калдор", "Лиорна", "Мирград", "Норвель", "Озёрия", "Пеллар", "Рустан",
	"Солмар", "Тарвия", "Ульмер", "Фальк", "Хорсун", "Цейла", "Черноград", "Штормвик",
}

Config.COLORS = {
	{ 231, 76, 60 }, { 52, 152, 219 }, { 46, 204, 113 }, { 241, 196, 15 }, { 155, 89, 182 },
	{ 230, 126, 34 }, { 26, 188, 156 }, { 236, 112, 160 }, { 149, 165, 166 }, { 52, 73, 94 },
	{ 192, 57, 43 }, { 41, 128, 185 }, { 39, 174, 96 }, { 243, 156, 18 }, { 142, 68, 173 },
	{ 211, 84, 0 }, { 22, 160, 133 }, { 255, 118, 117 }, { 116, 185, 255 }, { 85, 239, 196 },
	{ 253, 203, 110 }, { 162, 155, 254 }, { 250, 177, 160 }, { 99, 110, 114 },
}

-- номер клетки -> координаты сетки и центр клетки в мире (y = 0, уровень воды)
function Config.tileXY(i)
	local j = i - 1
	return j % Config.MAP_W, j // Config.MAP_W
end

function Config.tileCenter(i)
	local x, y = Config.tileXY(i)
	return Vector3.new((x - Config.MAP_W / 2 + 0.5) * Config.TILE, 0, (y - Config.MAP_H / 2 + 0.5) * Config.TILE)
end

return Config
