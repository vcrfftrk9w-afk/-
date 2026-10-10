-- 🍭 СЛАДКИЙ САД — экран игрока. Собирает интерфейс и слушает сервер.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TextChatService = game:GetService("TextChatService")

if not game:IsLoaded() then
	game.Loaded:Wait()
end

local Client = script.Parent
local Ctx = require(Client:WaitForChild("Context"))
local Ui = require(Client:WaitForChild("Ui"))
local Hud = require(Client:WaitForChild("Hud"))
local Panels = require(Client:WaitForChild("Panels"))
local Effects = require(Client:WaitForChild("Effects"))

local Push = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Push") :: RemoteEvent

local T = Ctx.T
local Logic = Ctx.Logic
local Config = Ctx.Config

---------------------------------------------------------------------
-- Интерфейс
---------------------------------------------------------------------

local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
local old = playerGui:FindFirstChild("SweetGardenUI")
if old then
	old:Destroy()
end

local gui = Instance.new("ScreenGui")
gui.Name = "SweetGardenUI"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = false
gui.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = playerGui

-- Всё рисуется в «виртуальном» экране, у которого короткая сторона = 520,
-- а затем масштабируется. Так кнопки удобны и на телефоне, и на компьютере.
local root = Instance.new("Frame")
root.Name = "Root"
root.BackgroundTransparency = 1
root.Parent = gui
local scale = Instance.new("UIScale")
scale.Parent = root

local function rescale()
	local size = gui.AbsoluteSize
	if size.X < 2 or size.Y < 2 then
		return
	end
	local s = math.clamp(math.min(size.X, size.Y) / 520, 0.55, 1.35)
	scale.Scale = s
	root.Size = UDim2.fromOffset(size.X / s, size.Y / s)
	Ctx.portrait = size.Y > size.X
	Hud.layout()
end

Hud.init(root)
Panels.init(root)
Effects.init()
Ctx.toast = Hud.toast

gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(rescale)
rescale()

---------------------------------------------------------------------
-- Сообщения от сервера
---------------------------------------------------------------------

local function chat(text: string)
	pcall(function()
		local channels = TextChatService:FindFirstChild("TextChannels")
		local general = channels and channels:FindFirstChild("RBXGeneral")
		if general and general:IsA("TextChannel") then
			general:DisplaySystemMessage(text)
		end
	end)
end

local handlers = {}

handlers.state = function(state)
	Ctx.setState(state)
end

handlers.toast = function(payload)
	local args = {}
	for _, arg in ipairs(payload.args or {}) do
		table.insert(args, Ctx.translateArg(arg))
	end
	Hud.toast(T(payload.key, table.unpack(args)))
end

handlers.basket = function(summary)
	Ctx.setBasket(summary)
end

handlers.collect = function(list)
	Effects.collect(list)
end

handlers.sold = function(payload)
	local bestText = nil
	if payload.best then
		local best = payload.best
		bestText = "⭐ " .. Ctx.fruitName(best.id, best.c, best.w, best.g) .. " — " .. Logic.format(best.v) .. " 💰"
	end
	Hud.sold(payload.total, bestText)
	Hud.toast(T("n_sold", tostring(payload.count), Logic.format(payload.total)), Ui.Colors.gold)
end

handlers.hatch = function(payload)
	Ctx.closePanel()
	Panels.hatch(payload.pet)
end

handlers.reward = function(payload)
	local text = Ctx.rewardText(payload.parts)
	if payload.key == "n_daily" then
		Hud.toast(T("n_daily", tostring(payload.day or 1), text), Ui.Colors.gold)
	else
		Hud.toast(T(payload.key) .. " " .. text, Ui.Colors.gold)
	end
end

handlers.rare = function(payload)
	local text = T("n_rare", payload.name, Ctx.fruitName(payload.id, payload.c, payload.w, payload.g))
	local seed = Config.SeedById[payload.id]
	Hud.toast(text, seed and Ctx.rarityColor(seed.rarity) or Ui.Colors.gold)
	chat(text)
end

handlers.rareSelf = function(payload)
	Hud.toast(T("n_rare_self", Ctx.fruitName(payload.id, payload.c, payload.w, payload.g)), Ui.Colors.gold)
end

handlers.lightning = function(position)
	if typeof(position) == "Vector3" then
		Effects.lightning(position)
	end
end

Push.OnClientEvent:Connect(function(kind, payload)
	local handler = handlers[kind]
	if handler then
		local ok, err = pcall(handler, payload)
		if not ok then
			warn("[SweetGarden] " .. tostring(kind) .. ": " .. tostring(err))
		end
	end
end)

Ctx.send("Hello")
Hud.toast(T("n_welcome"), Color3.fromRGB(255, 190, 230))
