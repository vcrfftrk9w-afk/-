-- Общее состояние экрана игрока: язык, последние данные с сервера, выбранные семена.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Logic = require(Shared:WaitForChild("Logic"))
local Strings = require(Shared:WaitForChild("Strings"))

local Action = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Action") :: RemoteEvent

local Ctx = {}

Ctx.Config = Config
Ctx.Logic = Logic
Ctx.player = Players.LocalPlayer
Ctx.lang = Strings.lang(Ctx.player.LocaleId)
Ctx.state = nil :: any
Ctx.selected = nil :: string?
Ctx.shovel = false
Ctx.portrait = false

function Ctx.T(key: string, ...: any): string
	return Strings.get(Ctx.lang, key, ...)
end
local T = Ctx.T

---------------------------------------------------------------------
-- Подписки на обновления
---------------------------------------------------------------------

local stateListeners = {}
function Ctx.onState(fn: (any) -> ())
	table.insert(stateListeners, fn)
end
function Ctx.setState(state)
	Ctx.state = state
	for _, fn in ipairs(stateListeners) do
		task.spawn(fn, state)
	end
end

local modeListeners = {}
function Ctx.onMode(fn: () -> ())
	table.insert(modeListeners, fn)
end
function Ctx.modeChanged()
	for _, fn in ipairs(modeListeners) do
		task.spawn(fn)
	end
end

function Ctx.send(name: string, ...: any)
	Action:FireServer(name, ...)
end

local basketListeners = {}
function Ctx.onBasket(fn: (any) -> ())
	table.insert(basketListeners, fn)
end
function Ctx.setBasket(summary)
	for _, fn in ipairs(basketListeners) do
		task.spawn(fn, summary)
	end
end

-- Продать весь урожай: сразу, если есть «Продажа везде», иначе — переместиться к скупщику
function Ctx.sellAll()
	local state = Ctx.state
	if state and state.passes.sellanywhere then
		Ctx.send("Sell")
	else
		Ctx.send("Teleport", "sell")
		task.delay(0.45, function()
			Ctx.send("Sell")
		end)
	end
end

-- заполняются другими модулями
Ctx.toast = function(_text: string, _color: Color3?) end
Ctx.openPanel = function(_name: string, _arg: any?) end
Ctx.closePanel = function() end

---------------------------------------------------------------------
-- Названия
---------------------------------------------------------------------

function Ctx.rarityColor(rarity: string, darker: boolean?): Color3
	local info = Config.Rarities[rarity]
	local color = info and info.color or Color3.new(1, 1, 1)
	if darker then
		return color:Lerp(Color3.new(0, 0, 0), 0.35)
	end
	return color
end

function Ctx.seedLabel(seedId: string): string
	local seed = Config.SeedById[seedId]
	return (seed and seed.emoji or "") .. " " .. T("seed_" .. seedId)
end

function Ctx.petLabel(petId: string): string
	local pet = Config.Pets[petId]
	return (pet and pet.emoji or "") .. " " .. T("pet_" .. petId)
end

function Ctx.fruitName(seedId: string, c: string?, w: string?, g: boolean?): string
	local name = Ctx.seedLabel(seedId)
	local tags = {}
	if g then
		table.insert(tags, T("mut_giant"))
	end
	if c then
		table.insert(tags, T("mut_" .. c))
	end
	if w then
		table.insert(tags, T("mut_" .. w))
	end
	if #tags > 0 then
		name ..= " [" .. table.concat(tags, ", ") .. "]"
	end
	return name
end

function Ctx.bonusText(petId: string): string
	local pet = Config.Pets[petId]
	if not pet then
		return ""
	end
	return T("bonus_" .. pet.bonus, tostring(math.floor(pet.amount * 100 + 0.5)))
end

-- Аргументы уведомлений: «@ключ» переводится, остальное как есть
function Ctx.translateArg(arg: string): string
	if string.sub(arg, 1, 1) == "@" then
		local key = string.sub(arg, 2)
		if string.sub(key, 1, 5) == "seed_" then
			return Ctx.seedLabel(string.sub(key, 6))
		elseif string.sub(key, 1, 4) == "pet_" then
			return Ctx.petLabel(string.sub(key, 5))
		end
		return T(key)
	end
	return arg
end

-- Награды: «$123» — монеты, «%seed:2» — семена
function Ctx.rewardText(parts: { string }): string
	local out = {}
	for _, part in ipairs(parts or {}) do
		local first = string.sub(part, 1, 1)
		if first == "$" then
			table.insert(out, T("reward_coins", string.sub(part, 2)))
		elseif first == "%" then
			local seedId, count = string.match(part, "^%%([%w_]+):(%d+)$")
			if seedId then
				table.insert(out, T("reward_seed", Ctx.seedLabel(seedId), count))
			end
		end
	end
	return table.concat(out, ", ")
end

---------------------------------------------------------------------
-- Выбранные семена для посадки
---------------------------------------------------------------------

function Ctx.seedCount(seedId: string?): number
	local state = Ctx.state
	if not state or not seedId then
		return 0
	end
	return state.seeds[seedId] or 0
end

function Ctx.currentSeed(): string?
	if Ctx.selected and Ctx.seedCount(Ctx.selected) > 0 then
		return Ctx.selected
	end
	for _, seed in ipairs(Config.Seeds) do
		if Ctx.seedCount(seed.id) > 0 then
			Ctx.selected = seed.id
			return seed.id
		end
	end
	return nil
end

function Ctx.setSelected(seedId: string?)
	Ctx.selected = seedId
	if seedId then
		Ctx.send("Select", seedId)
	end
	Ctx.modeChanged()
end

return Ctx
