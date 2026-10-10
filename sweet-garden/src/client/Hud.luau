-- Экран игрока: монеты, корзина, погода, подсказки, кнопки по бокам, уведомления.

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

local WEATHER_EMOJI = { rain = "🌧", snow = "❄️", thunder = "⛈", candy = "🍬", rainbow = "🌈" }

local root: Frame
local coinsLabel: TextLabel
local coinsScale: UIScale
local basketLabel: TextLabel
local basketPill: Frame
local weatherPill: Frame
local weatherLabel: TextLabel
local tutorialBanner: Frame
local tutorialLabel: TextLabel
local toastList: Frame
local seedChip: TextButton
local shovelBanner: TextLabel
local shovelButton: TextButton
local magnetButton: TextButton
local sellAnywhereButton: TextButton
local magnetOn = true

local toastOrder = 0

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

	task.delay(3.4, function()
		if label.Parent then
			local tween = TweenService:Create(label, TweenInfo.new(0.4), { TextTransparency = 1, BackgroundTransparency = 1 })
			tween:Play()
			tween.Completed:Wait()
			label:Destroy()
		end
	end)
end

-- Большая надпись «+1.2K 💰» после продажи
function Hud.sold(total: number, bestText: string?)
	local label = Ui.label(root, "+" .. Logic.format(total) .. " 💰", UDim2.fromOffset(380, 70), UDim2.new(0.5, -190, 0.32, 0), { color = C.gold, stroke = true, maxSize = 64 })
	label.ZIndex = 5
	local stroke = label:FindFirstChildOfClass("UIStroke")
	if stroke then
		stroke.Thickness = 3
	end
	local tween = TweenService:Create(label, TweenInfo.new(1.8, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Position = UDim2.new(0.5, -190, 0.32, -80),
		TextTransparency = 1,
	})
	tween:Play()
	tween.Completed:Connect(function()
		label:Destroy()
	end)
	if stroke then
		TweenService:Create(stroke, TweenInfo.new(1.8), { Transparency = 1 }):Play()
	end
	if bestText then
		Hud.toast(bestText, C.gold)
	end
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

local function layoutBottom()
	local touch = UserInputService.TouchEnabled
	local offset = (touch and Ctx.portrait) and 215 or 14
	seedChip.Position = UDim2.new(0.5, 0, 1, -offset)
	shovelBanner.Position = UDim2.new(0.5, 0, 1, -offset - 62)
end
Hud.layout = function()
	if seedChip then
		layoutBottom()
	end
end

local function updateSeedChip()
	local seedId = Ctx.currentSeed()
	if seedId then
		seedChip.Text = Ctx.seedLabel(seedId) .. " x" .. Ctx.seedCount(seedId) .. "  ▲"
	else
		seedChip.Text = T("choose_seed")
	end
end

local function updateToggles()
	shovelButton.BackgroundColor3 = Ctx.shovel and C.pink or C.white
	magnetButton.BackgroundColor3 = magnetOn and C.white or C.gray
	shovelBanner.Visible = Ctx.shovel
end

local function teleportAndOpen(destination: string, panel: string)
	Ctx.send("Teleport", destination)
	Ctx.openPanel(panel)
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

	-- корзина и погода
	local row = Ui.frame(root, UDim2.fromOffset(440, 34), UDim2.new(0.5, 0, 0, 62))
	row.AnchorPoint = Vector2.new(0.5, 0)
	Ui.list(row, false, 8, true)
	basketPill = Ui.frame(row, UDim2.fromOffset(150, 34), UDim2.new(), C.dark, 0.2)
	basketPill.LayoutOrder = 1
	Ui.corner(basketPill, 17)
	basketLabel = Ui.label(basketPill, "🧺 0/60", UDim2.new(1, -16, 1, -8), UDim2.fromOffset(8, 4), { color = C.white, maxSize = 22 })
	local basketButton = Instance.new("TextButton")
	basketButton.Name = "OpenBasket"
	basketButton.Size = UDim2.fromScale(1, 1)
	basketButton.BackgroundTransparency = 1
	basketButton.Text = ""
	basketButton.Activated:Connect(function()
		Ctx.openPanel("basket")
	end)
	basketButton.Parent = basketPill
	weatherPill = Ui.frame(row, UDim2.fromOffset(230, 34), UDim2.new(), Color3.fromRGB(70, 110, 190), 0.1)
	weatherPill.LayoutOrder = 2
	weatherPill.Visible = false
	Ui.corner(weatherPill, 17)
	weatherLabel = Ui.label(weatherPill, "", UDim2.new(1, -16, 1, -8), UDim2.fromOffset(8, 4), { color = C.white, maxSize = 22 })

	-- обучение
	tutorialBanner = Ui.frame(root, UDim2.new(0.9, 0, 0, 40), UDim2.new(0.5, 0, 0, 104), Color3.fromRGB(255, 245, 190), 0.02)
	tutorialBanner.AnchorPoint = Vector2.new(0.5, 0)
	tutorialBanner.Visible = false
	Ui.corner(tutorialBanner, 12)
	Ui.stroke(tutorialBanner, C.gold, 2)
	local maxBanner = Instance.new("UISizeConstraint")
	maxBanner.MaxSize = Vector2.new(480, 40)
	maxBanner.Parent = tutorialBanner
	tutorialLabel = Ui.label(tutorialBanner, "", UDim2.new(1, -16, 1, -8), UDim2.fromOffset(8, 4), { maxSize = 22 })

	-- уведомления
	toastList = Ui.frame(root, UDim2.new(0.9, 0, 0, 200), UDim2.new(0.5, 0, 0, 152))
	toastList.AnchorPoint = Vector2.new(0.5, 0)
	local maxToasts = Instance.new("UISizeConstraint")
	maxToasts.MaxSize = Vector2.new(470, 200)
	maxToasts.Parent = toastList
	Ui.list(toastList, true, 6, true)

	-- левые кнопки: перемещение
	local left = Ui.frame(root, UDim2.fromOffset(76, 5 * 74), UDim2.new(0, 6, 0.5, 10))
	left.AnchorPoint = Vector2.new(0, 0.5)
	Ui.list(left, true, 6)
	sideButton(left, "🏡", T("btn_garden"), 1, function()
		Ctx.send("Teleport", "garden")
	end)
	sideButton(left, "🌱", T("btn_seeds"), 2, function()
		teleportAndOpen("seeds", "seeds")
	end)
	sideButton(left, "💰", T("btn_sell"), 3, Ctx.sellAll)
	sideButton(left, "🥚", T("btn_eggs"), 4, function()
		teleportAndOpen("eggs", "eggs")
	end)
	sideButton(left, "🧰", T("btn_gear"), 5, function()
		teleportAndOpen("gear", "gear")
	end)

	-- правые кнопки
	local right = Ui.frame(root, UDim2.fromOffset(76, 6 * 74), UDim2.new(1, -6, 0.5, 10))
	right.AnchorPoint = Vector2.new(1, 0.5)
	Ui.list(right, true, 6)
	sideButton(right, "🐾", T("btn_pets"), 1, function()
		Ctx.openPanel("pets")
	end)
	sideButton(right, "🛍", T("btn_shop"), 2, function()
		Ctx.openPanel("shop")
	end)
	sideButton(right, "🎁", T("btn_codes"), 3, function()
		Ctx.openPanel("codes")
	end)
	shovelButton = sideButton(right, "🪓", T("btn_shovel"), 4, function()
		Ctx.shovel = not Ctx.shovel
		updateToggles()
		Ctx.modeChanged()
	end)
	magnetButton = sideButton(right, "🧲", T("btn_magnet"), 5, function()
		magnetOn = not magnetOn
		Ctx.send("Magnet", magnetOn)
		updateToggles()
	end)
	sellAnywhereButton = sideButton(right, "📱", T("btn_sell"), 6, function()
		Ctx.send("Sell")
	end)
	sellAnywhereButton.Visible = false

	-- выбранные семена внизу
	seedChip = Instance.new("TextButton")
	seedChip.AnchorPoint = Vector2.new(0.5, 1)
	seedChip.Size = UDim2.fromOffset(270, 54)
	seedChip.BackgroundColor3 = C.panel
	seedChip.BorderSizePixel = 0
	seedChip.Font = Ui.Font
	seedChip.TextScaled = true
	seedChip.TextColor3 = C.text
	seedChip.Text = T("choose_seed")
	Ui.corner(seedChip, 27)
	Ui.stroke(seedChip, C.dark, 2.5)
	Ui.padding(seedChip, 9)
	seedChip.Activated:Connect(function()
		Ctx.openPanel("pick")
	end)
	seedChip.Parent = root

	shovelBanner = Ui.label(root, T("shovel_banner"), UDim2.fromOffset(420, 44), UDim2.new(), { color = C.white, maxSize = 22 })
	shovelBanner.AnchorPoint = Vector2.new(0.5, 1)
	shovelBanner.BackgroundTransparency = 0.1
	shovelBanner.BackgroundColor3 = C.pink
	Ui.corner(shovelBanner, 14)
	Ui.padding(shovelBanner, 6)
	shovelBanner.Visible = false

	layoutBottom()
	updateToggles()

	-- обновление по данным с сервера
	local lastCoins: number? = nil
	local lastSlot: number? = nil
	local tutorialWasShown = false
	Ctx.onState(function(state)
		coinsLabel.Text = "💰 " .. Logic.format(state.coins)
		if lastCoins and state.coins > lastCoins then
			floatingPlus(state.coins - lastCoins)
			bump()
		end
		lastCoins = state.coins

		basketLabel.Text = T("basket", state.basket, state.basketCap)
		basketPill.BackgroundColor3 = state.basket >= state.basketCap and C.red or C.dark

		if state.tutorial < 4 then
			tutorialBanner.Visible = true
			tutorialWasShown = true
			tutorialLabel.Text = T("tut_" .. state.tutorial)
		else
			tutorialBanner.Visible = false
		end
		if tutorialWasShown and state.tutorial >= 4 then
			tutorialWasShown = false
		end

		if magnetOn ~= state.magnet then
			magnetOn = state.magnet
			updateToggles()
		end
		sellAnywhereButton.Visible = state.passes.sellanywhere == true
		updateSeedChip()

		if lastSlot and state.stockSlot > lastSlot then
			Hud.toast(T("n_restock"), Color3.fromRGB(170, 255, 170))
			for _, item in ipairs(state.stock) do
				local seed = Config.SeedById[item.id]
				if seed and item.amount > 0 and Config.Rarities[seed.rarity].order >= 5 then
					Hud.toast(T("n_restock_rare", Ctx.seedLabel(item.id)), Ctx.rarityColor(seed.rarity))
				end
			end
		end
		lastSlot = state.stockSlot
	end)
	Ctx.onMode(function()
		if Ctx.state then
			updateSeedChip()
		end
	end)

	-- погода: название и оставшееся время
	task.spawn(function()
		while true do
			local id = ReplicatedStorage:GetAttribute("Weather")
			local ends = ReplicatedStorage:GetAttribute("WeatherEnds")
			if type(id) == "string" and id ~= "" and type(ends) == "number" then
				local left = ends - workspace:GetServerTimeNow()
				weatherPill.Visible = left > 0
				weatherLabel.Text = (WEATHER_EMOJI[id] or "") .. " " .. T("weather_left", T("w_" .. id), Logic.formatTime(left))
			else
				weatherPill.Visible = false
			end
			task.wait(0.5)
		end
	end)
end

return Hud
