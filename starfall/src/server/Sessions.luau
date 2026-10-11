-- Игроки: загрузка и сохранение прогресса, отправка состояния на экран.

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
		warn("[Starfall] DataStore недоступен: " .. tostring(result))
	end
end

local TEMPLATE = {
	coins = Config.StartCoins,
	bank = 0,
	stars = {}, -- ["номер пьедестала"] = { t = id звезды, m = мутация или nil }
	upgrades = { speed = 1, pedestals = 1, telescope = 1, lock = 1 },
	rebirths = 0,
	index = {}, -- [id звезды] = true
	daily = { day = 0, streak = 0 },
	codes = {},
	receipts = {},
	tutorial = 0,
	stats = { earned = 0, caught = 0, stolen = 0, lost = 0 },
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

local function cleanNumber(value: any, minimum: number): number
	local n = tonumber(value)
	if not n or n ~= n or n == math.huge or n == -math.huge then
		return minimum
	end
	return math.max(minimum, n)
end

-- Чистит повреждённые данные, чтобы одна ошибка не ломала игру
local function sanitize(data)
	data.coins = cleanNumber(data.coins, 0)
	data.bank = cleanNumber(data.bank, 0)
	data.rebirths = math.floor(cleanNumber(data.rebirths, 0))
	local stars = {}
	for key, star in pairs(data.stars) do
		local slot = tonumber(key)
		if type(star) == "table" and slot and slot >= 1 and slot <= Config.MaxSlots and slot == math.floor(slot) and Config.StarById[star.t] then
			local mut = star.m
			if mut ~= nil and not Config.Mutations[mut] then
				mut = nil
			end
			stars[tostring(slot)] = { t = star.t, m = mut }
		end
	end
	data.stars = stars
	for key, upgrade in pairs(Config.UpgradeByKey) do
		local level = tonumber(data.upgrades[key]) or 1
		data.upgrades[key] = math.clamp(math.floor(level), 1, #upgrade.values)
	end
	for id in pairs(data.index) do
		if not Config.StarById[id] then
			data.index[id] = nil
		end
	end
	for key, value in pairs(data.stats) do
		data.stats[key] = cleanNumber(value, 0)
	end
	data.tutorial = math.floor(cleanNumber(data.tutorial, 0))
end

export type Carry = {
	t: string,
	m: string?,
	from: string, -- "field" или "steal"
	owner: any?, -- у кого украли (сессия)
	slot: number?,
	model: Model?,
}

local function newSession(player: Player, data, canSave: boolean)
	return {
		player = player,
		data = data,
		canSave = canSave,
		ready = false,
		base = nil :: number?,
		passes = {},
		rng = Random.new(),
		dirty = true,
		rateWindow = 0,
		rateCount = 0,
		lastTeleport = -100,
		lastBonk = -100,
		immuneUntil = 0,
		stunnedUntil = 0,
		lockedUntil = 0,
		carrying = nil :: Carry?,
		lastLockNotice = 0,
		lastPosition = nil :: Vector3?,
		stat = nil :: IntValue?,
		stolenStat = nil :: IntValue?,
	}
end

export type Session = typeof(newSession(nil :: any, nil, false))

function Sessions.get(player: Player): Session?
	return active[player]
end

function Sessions.isActive(session: Session?): boolean
	return session ~= nil and active[session.player] == session
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
			warn("[Starfall] Не удалось загрузить данные (" .. attempt .. "): " .. tostring(result))
			task.wait(attempt * 2)
		end
	end

	if type(data) ~= "table" then
		data = deepCopy(TEMPLATE)
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
	local stolen = Instance.new("IntValue")
	stolen.Name = "🦹"
	stolen.Value = math.floor(data.stats.stolen)
	stolen.Parent = stats
	stats.Parent = player
	session.stat = coins
	session.stolenStat = stolen

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
		warn("[Starfall] Не удалось сохранить: " .. tostring(err))
	end
	return ok
end

local savesInFlight = 0

function Sessions.remove(player: Player)
	local session = active[player]
	if not session then
		return
	end
	active[player] = nil
	savesInFlight += 1
	Sessions.save(session)
	savesInFlight -= 1
end

---------------------------------------------------------------------
-- Сообщения на экран игрока
---------------------------------------------------------------------

function Sessions.markDirty(session: Session)
	session.dirty = true
end

function Sessions.push(session: Session, kind: string, payload: any)
	if session.player.Parent then
		Push:FireClient(session.player, kind, payload)
	end
end

function Sessions.broadcast(kind: string, payload: any)
	Push:FireAllClients(kind, payload)
end

local function packArgs(...: any): { string }
	local args = {}
	for i = 1, select("#", ...) do
		table.insert(args, tostring((select(i, ...))))
	end
	return args
end

-- Короткое уведомление. Аргументы, начинающиеся с «@», переводятся на клиенте.
function Sessions.notify(session: Session, key: string, ...: any)
	Sessions.push(session, "toast", { key = key, args = packArgs(...) })
end

function Sessions.notifyAll(key: string, ...: any)
	Sessions.broadcast("toast", { key = key, args = packArgs(...) })
end

-- Важное событие для всех: показывается крупно и пишется в чат
function Sessions.announce(key: string, color: string, ...: any)
	Sessions.broadcast("announce", { key = key, color = color, args = packArgs(...) })
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

function Sessions.snapshot(session: Session)
	local data = session.data
	local carry = session.carrying
	return {
		coins = math.floor(data.coins),
		bank = math.floor(data.bank),
		income = Logic.totalIncome(data, session.passes),
		earned = math.floor(data.stats.earned),
		stars = data.stars,
		slots = Logic.slotCount(data, session.passes),
		upgrades = data.upgrades,
		rebirths = data.rebirths,
		index = data.index,
		passes = session.passes,
		tutorial = data.tutorial,
		base = session.base or 0,
		lockedUntil = session.lockedUntil,
		carrying = carry and { t = carry.t, m = carry.m or "", stolen = carry.from == "steal" } or nil,
		stats = data.stats,
		canSave = session.canSave,
	}
end

local function flush()
	for _, session in pairs(active) do
		if session.dirty and session.ready then
			session.dirty = false
			if session.stat then
				session.stat.Value = math.min(math.floor(session.data.coins), 2 ^ 53)
			end
			if session.stolenStat then
				session.stolenStat.Value = math.floor(session.data.stats.stolen)
			end
			local ok, err = pcall(function()
				Sessions.push(session, "state", Sessions.snapshot(session))
			end)
			if not ok then
				warn("[Starfall] state: " .. tostring(err))
			end
		end
	end
end

function Sessions.start()
	-- отправка состояния не чаще 6 раз в секунду
	task.spawn(function()
		while true do
			task.wait(0.15)
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
		while (pending > 0 or savesInFlight > 0) and os.clock() - started < 25 do
			task.wait(0.2)
		end
	end)
end

return Sessions
