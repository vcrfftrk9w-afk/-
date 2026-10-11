-- Экран игрока: монеты, доход, замок, метеоритный дождь, подсказки, кнопки, БОНК и уведомления.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local Ctx = require(script.Parent.Context)
local Ui = require(script.Parent.Ui)

local Config = Ctx.Config
local Logic = Ctx.Logic
local T = Ctx.T
local C = Ui.Colors

local Hud = {}

local root: Frame
local coinsLabel: TextLabel
local coinsScale: UIScale
local incomeLabel: TextLabel
local bankLabel: TextLabel
local lockPill: Frame
local lockLabel: TextLabel
local showerPill: Frame
local showerLabel: TextLabel
local tutorialBanner: Frame
local tutorialLabel: TextLabel
local toastList: Frame
local alarmBanner: TextLabel
local carryBanner: TextLabel
local bonkButton: TextButton
local bonkCooldown: Frame
local leftColumn: Frame
local rightColumn: Frame

local toastOrder = 0
local lastBonk = -100

function Hud.toast(text: string, color: Color3?)
	if not toastList then
		return
	end
	toastOrder += 1
	local label = Instance.new("TextLabel")
	label.Size = UDim2.new(1, 0, 0, 0)
	label.AutomaticSize = Enum.AutomaticSize.Y
	label.BackgroundColor3 = C.dark
	label.BackgroundTransparency = 0.12
	label.Font = Ui.Font
	label.TextSize = 19
	label.TextWrapped = true
	label.TextColor3 = color or C.white
	label.Text = text
	label.LayoutOrder = toastOrder
	Ui.corner(label, 10)
	Ui.padding(label, 7)
	label.Parent = toastList

	local toasts = {}
	for _, child in ipairs(toastList:GetChildren()) do
		if child:IsA("TextLabel") then
			table.insert(toasts, child)
		end
	end
	if #toasts > 4 then
		table.sort(toasts, function(a, b)
			return a.LayoutOrder < b.LayoutOrder
		end)
		for i = 1, #toasts - 4 do
			toasts[i]:Destroy()
		end
	end

	task.delay(3.6, function()
		if label.Parent then
			local tween = TweenService:Create(label, TweenInfo.new(0.4), { TextTransparency = 1, BackgroundTransparency = 1 })
			tween:Play()
			tween.Completed:Wait()
			label:Destroy()
		end
	end)
end

-- Крупная надпись по центру экрана, которая улетает вверх
function Hud.popup(text: string, color: Color3)
	local label = Ui.label(root, text, UDim2.fromOffset(420, 70), UDim2.new(0.5, -210, 0.3, 0), { color = color, stroke = true, maxSize = 60 })
	label.ZIndex = 5
	local stroke = label:FindFirstChildOfClass("UIStroke")
	if stroke then
		stroke.Thickness = 3
		TweenService:Create(stroke, TweenInfo.new(1.8), { Transparency = 1 }):Play()
	end
	local tween = TweenService:Create(label, TweenInfo.new(1.8, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Position = UDim2.new(0.5, -210, 0.3, -80),
		TextTransparency = 1,
	})
	tween:Play()
	tween.Completed:Connect(function()
		label:Destroy()
	end)
end

local function bump()
	coinsScale.Scale = 1.15
	TweenService:Create(coinsScale, TweenInfo.new(0.25, Enum.EasingStyle.Back), { Scale = 1 }):Play()
end

local function floatingPlus(amount: number)
	local label = Ui.label(root, "+" .. Logic.format(amount), UDim2.fromOffset(160, 30), UDim2.new(0.5, 40, 0, 40), { color = C.gold, stroke = true, maxSize = 26 })
	local tween = TweenService:Create(label, TweenInfo.new(1, Enum.EasingStyle.Quad), { Position = UDim2.new(0.5, 40, 0, 10), TextTransparency = 1 })
	tween:Play()
	tween.Completed:Connect(function()
		label:Destroy()
	end)
end

-- Тревога: у тебя крадут звезду!
function Hud.alarm(text: string)
	alarmBanner.Text = text
	alarmBanner.Visible = true
	task.spawn(function()
		for i = 1, 10 do
			if not alarmBanner.Visible then
				return
			end
			alarmBanner.BackgroundColor3 = (i % 2 == 0) and C.red or Color3.fromRGB(150, 20, 40)
			task.wait(0.5)
		end
		if alarmBanner.Text == text then
			alarmBanner.Visible = false
		end
	end)
end

local function pill(parent: Instance, width: number, color: Color3, order: number): (Frame, TextLabel)
	local frame = Ui.frame(parent, UDim2.fromOffset(width, 34), UDim2.new(), color, 0.15)
	frame.LayoutOrder = order
	Ui.corner(frame, 17)
	local label = Ui.label(frame, "", UDim2.new(1, -16, 1, -8), UDim2.fromOffset(8, 4), { color = C.white, maxSize = 22 })
	return frame, label
end

local function tapArea(parent: Instance, name: string, onClick: () -> ())
	local button = Instance.new("TextButton")
	button.Name = name
	button.Size = UDim2.fromScale(1, 1)
	button.BackgroundTransparency = 1
	button.Text = ""
	button.Activated:Connect(onClick)
	button.Parent = parent
end

local function sideButton(parent: Instance, emoji: string, caption: string, order: number, onClick: () -> ()): TextButton
	local button = Instance.new("TextButton")
	button.Name = caption
	button.LayoutOrder = order
	button.Size = UDim2.fromOffset(76, 68)
	button.BackgroundColor3 = C.white
	button.BackgroundTransparency = 0.05
	button.BorderSizePixel = 0
	button.Text = ""
	button.AutoButtonColor = true
	Ui.corner(button, 16)
	Ui.stroke(button, C.dark, 2, 0.15)
	Ui.label(button, emoji, UDim2.new(1, 0, 0, 38), UDim2.fromOffset(0, 5), { maxSize = 34 })
	Ui.label(button, caption, UDim2.new(1, -4, 0, 19), UDim2.new(0, 2, 1, -22), { maxSize = 16 })
	button.Activated:Connect(onClick)
	button.Parent = parent
	return button
end

---------------------------------------------------------------------
-- Бонк
---------------------------------------------------------------------

function Hud.bonk()
	local state = Ctx.state
	local super = state and state.passes.superbonk
	local cooldown = super and Config.Bonk.superCooldown or Config.Bonk.cooldown
	local clock = os.clock()
	if clock - lastBonk < cooldown then
		return
	end
	lastBonk = clock
	Ctx.send("Bonk")
	bonkCooldown.Size = UDim2.fromScale(1, 1)
	bonkCooldown.Visible = true
	local tween = TweenService:Create(bonkCooldown, TweenInfo.new(cooldown, Enum.EasingStyle.Linear), { Size = UDim2.fromScale(1, 0) })
	tween:Play()
	tween.Completed:Connect(function()
		bonkCooldown.Visible = false
	end)
end

---------------------------------------------------------------------
-- Раскладка: телефон вертикально, телефон горизонтально, компьютер
---------------------------------------------------------------------

function Hud.layout()
	if not bonkButton then
		return
	end
	local touch = UserInputService.TouchEnabled
	if touch and Ctx.portrait then
		bonkButton.Position = UDim2.new(1, -14, 1, -175)
		carryBanner.Position = UDim2.new(0.5, 0, 1, -290)
	elseif touch then
		bonkButton.Position = UDim2.new(1, -150, 1, -20)
		carryBanner.Position = UDim2.new(0.5, 0, 1, -90)
	else
		bonkButton.Position = UDim2.new(1, -14, 1, -20)
		carryBanner.Position = UDim2.new(0.5, 0, 1, -24)
	end
end

local function updateCarry(state)
	local carry = state.carrying
	if carry then
		local star = Config.StarById[carry.t]
		local income = star and Logic.baseIncome(carry.t, carry.m) * Logic.incomeMult(state, state.passes) or 0
		local name = Ctx.starLabel(carry.t, carry.m)
		carryBanner.Text = T(carry.stolen and "carry_stolen" or "carry", name, Ctx.incomeText(income))
		carryBanner.BackgroundColor3 = carry.stolen and Color3.fromRGB(150, 40, 90) or Color3.fromRGB(60, 50, 150)
		carryBanner.Visible = true
	else
		carryBanner.Visible = false
	end
end

local function updateLock()
	local state = Ctx.state
	if not state or state.base == 0 then
		lockPill.Visible = false
		return
	end
	lockPill.Visible = true
	local left = (state.lockedUntil or 0) - Ctx.serverNow()
	if left > 0 then
		lockLabel.Text = "🔒 " .. Logic.formatTime(left)
		lockPill.BackgroundColor3 = Color3.fromRGB(60, 140, 90)
	else
		lockLabel.Text = T("lock_open")
		lockPill.BackgroundColor3 = Color3.fromRGB(190, 60, 80)
	end
end

local function updateShower()
	local ends = ReplicatedStorage:GetAttribute("ShowerEnds")
	local left = type(ends) == "number" and ends - Ctx.serverNow() or 0
	if left > 0 then
		showerPill.Visible = true
		showerLabel.Text = T("shower_left", Logic.formatTime(left))
	else
		showerPill.Visible = false
	end
end

function Hud.init(parent: Frame)
	root = parent

	-- монеты
	local coins = Ui.frame(root, UDim2.fromOffset(230, 50), UDim2.new(0.5, 0, 0, 6), C.dark, 0.1)
	coins.AnchorPoint = Vector2.new(0.5, 0)
	Ui.corner(coins, 25)
	Ui.stroke(coins, C.white, 2, 0.2)
	coinsScale = Instance.new("UIScale")
	coinsScale.Parent = coins
	coinsLabel = Ui.label(coins, "💰 0", UDim2.new(1, -20, 1, -10), UDim2.fromOffset(10, 5), { color = C.gold, maxSize = 34 })

	-- доход, копилка, замок
	local row = Ui.frame(root, UDim2.fromOffset(500, 34), UDim2.new(0.5, 0, 0, 62))
	row.AnchorPoint = Vector2.new(0.5, 0)
	Ui.list(row, false, 6, true)
	local _, income = pill(row, 140, Color3.fromRGB(70, 60, 160), 1)
	incomeLabel = income
	local bankPill, bank = pill(row, 140, Color3.fromRGB(40, 120, 80), 2)
	bankLabel = bank
	tapArea(bankPill, "BankHint", function()
		Hud.toast(T("bank_hint"), Color3.fromRGB(190, 255, 200))
	end)
	lockPill, lockLabel = pill(row, 150, Color3.fromRGB(190, 60, 80), 3)
	tapArea(lockPill, "LockButton", function()
		Ctx.send("Lock")
	end)

	-- метеоритный дождь
	local showerRow = Ui.frame(root, UDim2.fromOffset(320, 34), UDim2.new(0.5, 0, 0, 102))
	showerRow.AnchorPoint = Vector2.new(0.5, 0)
	Ui.list(showerRow, false, 6, true)
	showerPill, showerLabel = pill(showerRow, 300, Color3.fromRGB(200, 90, 40), 1)
	showerPill.Visible = false

	-- тревога
	alarmBanner = Ui.label(root, "", UDim2.new(0.94, 0, 0, 56), UDim2.new(0.5, 0, 0, 100), { color = C.white, wrap = true, maxSize = 24 })
	alarmBanner.AnchorPoint = Vector2.new(0.5, 0)
	alarmBanner.BackgroundTransparency = 0.05
	alarmBanner.BackgroundColor3 = C.red
	alarmBanner.ZIndex = 4
	alarmBanner.Visible = false
	Ui.corner(alarmBanner, 14)
	Ui.padding(alarmBanner, 6)
	local maxAlarm = Instance.new("UISizeConstraint")
	maxAlarm.MaxSize = Vector2.new(500, 56)
	maxAlarm.Parent = alarmBanner

	-- обучение
	tutorialBanner = Ui.frame(root, UDim2.new(0.92, 0, 0, 42), UDim2.new(0.5, 0, 0, 142), Color3.fromRGB(255, 245, 190), 0.02)
	tutorialBanner.AnchorPoint = Vector2.new(0.5, 0)
	tutorialBanner.Visible = false
	Ui.corner(tutorialBanner, 12)
	Ui.stroke(tutorialBanner, C.gold, 2)
	local maxBanner = Instance.new("UISizeConstraint")
	maxBanner.MaxSize = Vector2.new(500, 42)
	maxBanner.Parent = tutorialBanner
	tutorialLabel = Ui.label(tutorialBanner, "", UDim2.new(1, -16, 1, -8), UDim2.fromOffset(8, 4), { maxSize = 22 })

	-- уведомления
	toastList = Ui.frame(root, UDim2.new(0.9, 0, 0, 200), UDim2.new(0.5, 0, 0, 192))
	toastList.AnchorPoint = Vector2.new(0.5, 0)
	local maxToasts = Instance.new("UISizeConstraint")
	maxToasts.MaxSize = Vector2.new(470, 200)
	maxToasts.Parent = toastList
	Ui.list(toastList, true, 6, true)

	-- левые кнопки
	leftColumn = Ui.frame(root, UDim2.fromOffset(76, 4 * 74), UDim2.new(0, 6, 0.5, -10))
	leftColumn.AnchorPoint = Vector2.new(0, 0.5)
	Ui.list(leftColumn, true, 6)
	sideButton(leftColumn, "🏠", T("btn_base"), 1, function()
		Ctx.send("Teleport", "base")
	end)
	sideButton(leftColumn, "🌠", T("btn_field"), 2, function()
		Ctx.send("Teleport", "field")
	end)
	sideButton(leftColumn, "🔭", T("btn_telescope"), 3, function()
		Ctx.openPanel("telescope")
	end)
	sideButton(leftColumn, "⭐", T("btn_stars"), 4, function()
		Ctx.openPanel("stars")
	end)

	-- правые кнопки
	rightColumn = Ui.frame(root, UDim2.fromOffset(76, 4 * 74), UDim2.new(1, -6, 0.5, -10))
	rightColumn.AnchorPoint = Vector2.new(1, 0.5)
	Ui.list(rightColumn, true, 6)
	sideButton(rightColumn, "⚙️", T("btn_upgrades"), 1, function()
		Ctx.openPanel("upgrades")
	end)
	sideButton(rightColumn, "🛍", T("btn_shop"), 2, function()
		Ctx.openPanel("shop")
	end)
	sideButton(rightColumn, "🎁", T("btn_codes"), 3, function()
		Ctx.openPanel("codes")
	end)
	sideButton(rightColumn, "🔒", T("btn_lock"), 4, function()
		Ctx.send("Lock")
	end)

	-- что несёшь
	carryBanner = Ui.label(root, "", UDim2.fromOffset(440, 56), UDim2.new(0.5, 0, 1, -24), { color = C.white, wrap = true, maxSize = 22 })
	carryBanner.AnchorPoint = Vector2.new(0.5, 1)
	carryBanner.BackgroundTransparency = 0.1
	carryBanner.BackgroundColor3 = Color3.fromRGB(60, 50, 150)
	carryBanner.Visible = false
	Ui.corner(carryBanner, 14)
	Ui.padding(carryBanner, 6)
	Ui.stroke(carryBanner, C.gold, 2)

	-- большая кнопка БОНК
	bonkButton = Instance.new("TextButton")
	bonkButton.Name = "BonkButton"
	bonkButton.AnchorPoint = Vector2.new(1, 1)
	bonkButton.Size = UDim2.fromOffset(96, 96)
	bonkButton.BackgroundColor3 = Color3.fromRGB(240, 70, 80)
	bonkButton.BorderSizePixel = 0
	bonkButton.Text = ""
	bonkButton.AutoButtonColor = true
	bonkButton.Parent = root
	Ui.corner(bonkButton, 48)
	Ui.stroke(bonkButton, C.white, 3)
	bonkCooldown = Ui.frame(bonkButton, UDim2.fromScale(1, 1), UDim2.fromScale(0, 1), Color3.new(0, 0, 0), 0.55)
	bonkCooldown.AnchorPoint = Vector2.new(0, 1)
	bonkCooldown.Visible = false
	Ui.corner(bonkCooldown, 48)
	Ui.label(bonkButton, "🥊", UDim2.new(1, 0, 0, 50), UDim2.fromOffset(0, 10), { maxSize = 44 })
	local caption = UserInputService.KeyboardEnabled and not UserInputService.TouchEnabled and T("btn_bonk_key") or T("btn_bonk")
	Ui.label(bonkButton, caption, UDim2.new(1, -8, 0, 22), UDim2.new(0, 4, 1, -32), { color = C.white, maxSize = 20 })
	bonkButton.Activated:Connect(Hud.bonk)

	Hud.layout()

	-- обновление по данным с сервера
	local lastCoins: number? = nil
	Ctx.onState(function(state)
		coinsLabel.Text = "💰 " .. Logic.format(state.coins)
		if lastCoins and state.coins > lastCoins then
			floatingPlus(state.coins - lastCoins)
			bump()
		end
		lastCoins = state.coins
		incomeLabel.Text = "⭐ " .. Ctx.incomeText(state.income)
		bankLabel.Text = "🏦 " .. Logic.format(state.bank)

		if state.tutorial < 4 then
			tutorialBanner.Visible = true
			tutorialLabel.Text = T("tut_" .. state.tutorial)
		else
			tutorialBanner.Visible = false
		end
		updateCarry(state)
		updateLock()
	end)

	task.spawn(function()
		while true do
			updateLock()
			updateShower()
			task.wait(0.5)
		end
	end)
end

return Hud
