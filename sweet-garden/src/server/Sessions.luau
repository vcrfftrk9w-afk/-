-- Игроки: загрузка и сохранение прогресса, отправка состояния на экран.

local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Logic = require(Shared:WaitForChild("Logic"))

local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local Push = Remotes:WaitForChild("Push") :: RemoteEvent

local Sessions = {}

local active = {}
Sessions.active = active

local store: DataStore? = nil
do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.DataStoreName)
	end)
	if ok then
		store = result
	else
		warn("[SweetGarden] DataStore недоступен: " .. tostring(result))
	end
end

local TEMPLATE = {
	coins = Config.StartCoins,
	seeds = {},
	basket = {},
	plot = {},
	upgrades = { basket = 1, tiles = 1, sprinkler = 1, magnet = 1 },
	pets = {},
	equipped = {},
	stock = { slot = 0, bought = {} },
	daily = { day = 0, streak = 0 },
	codes = {},
	receipts = {},
	tutorial = 0,
	stats = { earned = 0, harvested = 0, sold = 0 },
	nextPetId = 1,
	savedAt = 0,
}

local function deepCopy(value)
	if type(value) ~= "table" then
		return value
	end
	local copy = {}
	for k, v in pairs(value) do
		copy[k] = deepCopy(v)
	end
	return copy
end

-- Добавляет недостающие поля (например, после обновления игры)
local function reconcile(data, template)
	for key, value in pairs(template) do
		if data[key] == nil or type(data[key]) ~= type(value) then
			data[key] = deepCopy(value)
		elseif type(value) == "table" and next(value) ~= nil then
			reconcile(data[key], value)
		end
	end
end

-- Чистит повреждённые данные, чтобы одна ошибка не ломала игру
local function sanitize(data)
	if type(data.coins) ~= "number" or data.coins ~= data.coins then
		data.coins = 0
	end
	for id, count in pairs(data.seeds) do
		if not Config.SeedById[id] or type(count) ~= "number" or count <= 0 then
			data.seeds[id] = nil
		end
	end
	for key, plant in pairs(data.plot) do
		local tile = tonumber(key)
		if type(plant) ~= "table" or not Config.SeedById[plant.id] or not tile or tile < 1 or tile > 36 then
			data.plot[key] = nil
		else
			plant.p = tonumber(plant.p) or 0
			plant.r = tonumber(plant.r) or 0
			if type(plant.f) ~= "table" then
				plant.f = {}
			end
		end
	end
	local basket = {}
	for _, fruit in ipairs(data.basket) do
		if type(fruit) == "table" and Config.SeedById[fruit.id] then
			table.insert(basket, fruit)
		end
	end
	data.basket = basket
	for key, upgrade in pairs(Config.UpgradeByKey) do
		local level = tonumber(data.upgrades[key]) or 1
		data.upgrades[key] = math.clamp(math.floor(level), 1, #upgrade.values)
	end
end

local function newSession(player: Player, data, canSave: boolean)
	return {
		player = player,
		data = data,
		canSave = canSave,
		ready = false,
		plot = nil :: number?,
		selected = nil :: string?,
		magnet = true,
		passes = {},
		bonus = { sell = 0, grow = 0, luck = 0 },
		rng = Random.new(),
		dirty = true,
		rateWindow = 0,
		rateCount = 0,
		lastTeleport = 0,
		lastFullWarning = 0,
		saving = false,
		stat = nil :: IntValue?,
	}
end

export type Session = typeof(newSession(nil :: any, nil, false))

function Sessions.get(player: Player): Session?
	return active[player]
end

-- Загружает прогресс игрока (может занять пару секунд)
function Sessions.load(player: Player): Session
	local data = nil
	local loaded = false
	if store then
		for attempt = 1, 3 do
			local ok, result = pcall(function()
				return store:GetAsync("player_" .. player.UserId)
			end)
			if ok then
				data = result
				loaded = true
				break
			end
			warn("[SweetGarden] Не удалось загрузить данные (" .. attempt .. "): " .. tostring(result))
			task.wait(attempt * 2)
		end
	end

	local isNew = type(data) ~= "table"
	if isNew then
		data = deepCopy(TEMPLATE)
		data.seeds = deepCopy(Config.StartSeeds)
	end
	reconcile(data, TEMPLATE)
	sanitize(data)

	local session = newSession(player, data, loaded)
	active[player] = session

	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local coins = Instance.new("IntValue")
	coins.Name = "💰"
	coins.Value = math.floor(data.coins)
	coins.Parent = stats
	stats.Parent = player
	session.stat = coins

	return session
end

function Sessions.save(session: Session): boolean
	if not store or not session.canSave then
		return false
	end
	local data = session.data
	data.savedAt = os.time()
	local ok, err = pcall(function()
		store:UpdateAsync("player_" .. session.player.UserId, function()
			return data
		end)
	end)
	if not ok then
		warn("[SweetGarden] Не удалось сохранить: " .. tostring(err))
	end
	return ok
end

function Sessions.remove(player: Player)
	local session = active[player]
	if not session then
		return
	end
	Sessions.save(session)
	active[player] = nil
end

---------------------------------------------------------------------
-- Сообщения на экран игрока
---------------------------------------------------------------------

function Sessions.markDirty(session: Session)
	session.dirty = true
end

function Sessions.markAllDirty()
	for _, session in pairs(active) do
		session.dirty = true
	end
end

function Sessions.push(session: Session, kind: string, payload: any)
	if session.player.Parent then
		Push:FireClient(session.player, kind, payload)
	end
end

function Sessions.broadcast(kind: string, payload: any)
	Push:FireAllClients(kind, payload)
end

-- Короткое уведомление. Аргументы, начинающиеся с «@», переводятся на клиенте.
function Sessions.notify(session: Session, key: string, ...: any)
	local args = {}
	for i = 1, select("#", ...) do
		table.insert(args, tostring((select(i, ...))))
	end
	Sessions.push(session, "toast", { key = key, args = args })
end

function Sessions.notifyAll(key: string, ...: any)
	local args = {}
	for i = 1, select("#", ...) do
		table.insert(args, tostring((select(i, ...))))
	end
	Sessions.broadcast("toast", { key = key, args = args })
end

function Sessions.addCoins(session: Session, amount: number, earned: boolean?)
	amount = math.floor(amount)
	if amount <= 0 then
		return
	end
	session.data.coins += amount
	if earned then
		session.data.stats.earned += amount
	end
	session.dirty = true
end

local function basketValue(session: Session): number
	local total = 0
	for _, fruit in ipairs(session.data.basket) do
		total += Logic.fruitValue(fruit.id, fruit)
	end
	return math.floor(total * Logic.sellMultiplier(session.bonus, session.passes))
end

function Sessions.snapshot(session: Session)
	local data = session.data
	local slot = Logic.restockSlot(os.time())
	if data.stock.slot ~= slot then
		data.stock = { slot = slot, bought = {} }
	end
	local stock = {}
	for _, item in ipairs(Logic.stockFor(slot)) do
		local bought = data.stock.bought[item.id] or 0
		table.insert(stock, { id = item.id, amount = item.amount, left = math.max(0, item.amount - bought) })
	end
	return {
		coins = math.floor(data.coins),
		earned = math.floor(data.stats.earned),
		seeds = data.seeds,
		selected = session.selected,
		basket = #data.basket,
		basketCap = Logic.basketCapacity(data, session.passes),
		basketValue = basketValue(session),
		upgrades = data.upgrades,
		pets = data.pets,
		equipped = data.equipped,
		petSlots = Logic.petSlots(session.passes),
		passes = session.passes,
		stock = stock,
		stockSlot = slot,
		tutorial = data.tutorial,
		plot = session.plot or 0,
		magnet = session.magnet,
		canSave = session.canSave,
	}
end

local function flush()
	for _, session in pairs(active) do
		if session.dirty and session.ready then
			session.dirty = false
			if session.stat then
				session.stat.Value = math.floor(session.data.coins)
			end
			local ok, err = pcall(function()
				Sessions.push(session, "state", Sessions.snapshot(session))
			end)
			if not ok then
				warn("[SweetGarden] state: " .. tostring(err))
			end
		end
	end
end

function Sessions.start()
	-- отправка состояния не чаще 6 раз в секунду
	task.spawn(function()
		local lastSlot = Logic.restockSlot(os.time())
		while true do
			task.wait(0.15)
			local slot = Logic.restockSlot(os.time())
			if slot ~= lastSlot then
				lastSlot = slot
				Sessions.markAllDirty()
			end
			flush()
		end
	end)

	-- автосохранение
	task.spawn(function()
		while true do
			task.wait(90)
			for _, session in pairs(active) do
				task.spawn(Sessions.save, session)
			end
		end
	end)

	game:BindToClose(function()
		local pending = 0
		for _, session in pairs(active) do
			pending += 1
			task.spawn(function()
				Sessions.save(session)
				pending -= 1
			end)
		end
		local started = os.clock()
		while pending > 0 and os.clock() - started < 25 do
			task.wait(0.2)
		end
	end)

	Players.PlayerRemoving:Connect(function(player)
		Sessions.remove(player)
	end)
end

return Sessions
