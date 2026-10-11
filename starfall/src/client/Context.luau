-- Общее состояние экрана игрока: язык, последние данные с сервера, названия звёзд.

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
Ctx.portrait = false

function Ctx.T(key: string, ...: any): string
	return Strings.get(Ctx.lang, key, ...)
end
local T = Ctx.T

function Ctx.has(key: string): boolean
	return Strings.has(key)
end

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

function Ctx.send(name: string, ...: any)
	Action:FireServer(name, ...)
end

function Ctx.serverNow(): number
	return workspace:GetServerTimeNow()
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

function Ctx.starColor(starId: string, darker: boolean?): Color3
	return Ctx.rarityColor(Logic.rarityOf(starId), darker)
end

-- «🚀 Ракетка [Золото]»
function Ctx.starLabel(starId: string, mut: string?): string
	local star = Config.StarById[starId]
	local name = (star and star.emoji or "⭐") .. " " .. T("star_" .. starId)
	if mut and mut ~= "" and Config.Mutations[mut] then
		name ..= " [" .. T("mut_" .. mut) .. "]"
	end
	return name
end

function Ctx.incomeText(value: number): string
	return T("per_sec", Logic.format(value))
end

-- Аргументы уведомлений: «@ключ» переводится, «@star_id_мутация» — название звезды
function Ctx.translateArg(arg: string): string
	if string.sub(arg, 1, 1) ~= "@" then
		return arg
	end
	local key = string.sub(arg, 2)
	if string.sub(key, 1, 5) == "star_" then
		local starId, mut = string.match(key, "^star_(%w+)_?(%w*)$")
		if starId and Config.StarById[starId] then
			return Ctx.starLabel(starId, mut)
		end
	end
	if Strings.has(key) then
		return T(key)
	end
	return arg
end

-- Награды: «$123» — монеты, «*rocketo» — звезда
function Ctx.rewardText(parts: { string }): string
	local out = {}
	for _, part in ipairs(parts or {}) do
		local first = string.sub(part, 1, 1)
		if first == "$" then
			table.insert(out, T("reward_coins", string.sub(part, 2)))
		elseif first == "*" then
			local starId = string.sub(part, 2)
			if Config.StarById[starId] then
				table.insert(out, Ctx.starLabel(starId))
			end
		end
	end
	return table.concat(out, ", ")
end

-- Моя ли это база
function Ctx.myBase(): number
	local state = Ctx.state
	return state and state.base or 0
end

return Ctx
