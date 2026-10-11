-- ⭐ ЗВЕЗДОПАД — экран игрока. Собирает интерфейс и слушает сервер.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TextChatService = game:GetService("TextChatService")
local UserInputService = game:GetService("UserInputService")

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
local old = playerGui:FindFirstChild("StarfallUI")
if old then
	old:Destroy()
end

local gui = Instance.new("ScreenGui")
gui.Name = "StarfallUI"
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

-- F — бонк на клавиатуре
UserInputService.InputBegan:Connect(function(input, processed)
	if not processed and input.KeyCode == Enum.KeyCode.F then
		Hud.bonk()
	end
end)

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

local function translate(payload): string
	local args = {}
	for _, arg in ipairs(payload.args or {}) do
		table.insert(args, Ctx.translateArg(arg))
	end
	return T(payload.key, table.unpack(args))
end

local handlers = {}

handlers.state = function(state)
	Ctx.setState(state)
end

handlers.toast = function(payload)
	Hud.toast(translate(payload))
end

-- Важное событие для всех: крупно на экране и в чате
handlers.announce = function(payload)
	local text = translate(payload)
	local color = Config.Rarities[payload.color] and Ctx.rarityColor(payload.color) or Ui.Colors.gold
	Hud.toast(text, color)
	chat(text)
end

handlers.alarm = function(payload)
	Hud.alarm(T("alarm", payload.by, Ctx.starLabel(payload.t, payload.m)))
	Effects.ping()
end

handlers.bonked = function(payload)
	Effects.bonked(payload)
	Hud.popup(T("bonked_by", payload.by), Color3.fromRGB(255, 120, 120))
end

handlers.bonkfx = function(position)
	if typeof(position) == "Vector3" then
		Effects.bonkfx(position)
	end
end

handlers.swing = function(payload)
	Effects.swing(payload)
end

handlers.collected = function(amount)
	Hud.popup("+" .. Logic.format(amount) .. " 💰", Ui.Colors.gold)
	Effects.ping()
end

handlers.sold = function(payload)
	Hud.toast(T("n_sold", Ctx.starLabel(payload.t, payload.m), Logic.format(payload.v)), Ui.Colors.gold)
end

handlers.delivered = function(payload)
	local color = Ctx.starColor(payload.t)
	Hud.popup(Ctx.starLabel(payload.t, payload.m), color)
	Hud.toast(T(payload.stolen and "n_delivered_stolen" or "n_delivered", Ctx.starLabel(payload.t, payload.m)), color)
	Effects.celebrate(color)
end

handlers.summon = function(payload)
	Ctx.closePanel()
	local header = payload.source == "telescope" and "reveal_telescope" or "reveal_gift"
	Panels.reveal(payload.t, payload.m, header)
	Effects.celebrate(Ctx.starColor(payload.t))
end

handlers.reward = function(payload)
	local text = Ctx.rewardText(payload.parts)
	if payload.key == "n_daily" then
		Hud.toast(T("n_daily", tostring(payload.day or 1), text), Ui.Colors.gold)
	else
		Hud.toast(T(payload.key) .. " " .. text, Ui.Colors.gold)
	end
end

Push.OnClientEvent:Connect(function(kind, payload)
	local handler = handlers[kind]
	if handler then
		local ok, err = pcall(handler, payload)
		if not ok then
			warn("[Starfall] " .. tostring(kind) .. ": " .. tostring(err))
		end
	end
end)

Ctx.send("Hello")
Hud.toast(T("n_welcome"), Color3.fromRGB(255, 230, 140))
