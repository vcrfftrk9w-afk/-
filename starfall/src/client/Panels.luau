-- Окна: улучшения, телескоп, мои звёзды и Звездопедия, магазин за Robux, коды и карточка новой звезды.

local MarketplaceService = game:GetService("MarketplaceService")
local TweenService = game:GetService("TweenService")

local Ctx = require(script.Parent.Context)
local Ui = require(script.Parent.Ui)

local Config = Ctx.Config
local Logic = Ctx.Logic
local T = Ctx.T
local C = Ui.Colors
local LEFT = Enum.TextXAlignment.Left

local Panels = {}

local root: Frame
local modal: TextButton
local title: TextLabel
local subtitle: TextLabel
local body: ScrollingFrame
local current: string? = nil
local updater: ((any) -> ())? = nil

local function row(height: number, order: number, parent: Instance?): Frame
	local frame = Ui.frame(parent or body, UDim2.new(1, -8, 0, height), UDim2.new(), C.row, 0)
	frame.LayoutOrder = order
	Ui.corner(frame, 14)
	Ui.stroke(frame, C.dark, 1.5, 0.75)
	return frame
end

local function sectionLabel(text: string, order: number): TextLabel
	local label = Ui.label(body, text, UDim2.new(1, -8, 0, 30), UDim2.new(), { color = C.soft, align = LEFT, maxSize = 22 })
	label.LayoutOrder = order
	return label
end

local function priceButton(parent: Instance, onClick: () -> ()): TextButton
	local button = Ui.button(parent, "", UDim2.fromOffset(126, 48), UDim2.new(1, -10, 0.5, 0), C.green, onClick)
	button.AnchorPoint = Vector2.new(1, 0.5)
	return button
end

local builders: { [string]: (any) -> () } = {}

---------------------------------------------------------------------
-- Улучшения и перерождение
---------------------------------------------------------------------

local function upgradeValueText(key: string, value: number): string
	return T("upgv_" .. key, tostring(value))
end

builders.upgrades = function()
	title.Text = T("title_upgrades")
	local rows = {}
	for i, upgrade in ipairs(Config.Upgrades) do
		local r = row(88, i)
		Ui.label(r, upgrade.emoji, UDim2.fromOffset(56, 56), UDim2.new(0, 8, 0.5, -28), { maxSize = 44 })
		local name = Ui.label(r, T("upg_" .. upgrade.key), UDim2.new(1, -214, 0, 26), UDim2.fromOffset(72, 8), { align = LEFT, maxSize = 24 })
		Ui.label(r, T("upg_" .. upgrade.key .. "_desc"), UDim2.new(1, -214, 0, 20), UDim2.fromOffset(72, 36), { align = LEFT, color = C.soft, maxSize = 17 })
		local value = Ui.label(r, "", UDim2.new(1, -214, 0, 20), UDim2.fromOffset(72, 60), { align = LEFT, color = Color3.fromRGB(70, 140, 80), maxSize = 17 })
		local button = priceButton(r, function()
			Ctx.send("Upgrade", upgrade.key)
		end)
		rows[upgrade.key] = { name = name, value = value, button = button }
	end

	local rebirthRow = row(120, 50)
	rebirthRow.BackgroundColor3 = Color3.fromRGB(255, 240, 250)
	Ui.label(rebirthRow, "🔄", UDim2.fromOffset(56, 56), UDim2.new(0, 8, 0, 10), { maxSize = 44 })
	local rebirthName = Ui.label(rebirthRow, "", UDim2.new(1, -214, 0, 26), UDim2.fromOffset(72, 8), { align = LEFT, maxSize = 24 })
	local rebirthDesc = Ui.label(rebirthRow, "", UDim2.new(1, -90, 0, 60), UDim2.fromOffset(72, 36), { align = LEFT, color = C.soft, wrap = true, maxSize = 17 })
	local confirm = false
	local rebirthButton: TextButton
	rebirthButton = Ui.button(rebirthRow, "", UDim2.fromOffset(126, 48), UDim2.new(1, -10, 0, 8), C.pink, function()
		if confirm then
			Ctx.send("Rebirth")
			Panels.close()
		else
			confirm = true
			Ctx.toast(T("rebirth_confirm"), C.pink)
			task.delay(4, function()
				confirm = false
			end)
		end
	end)
	rebirthButton.AnchorPoint = Vector2.new(1, 0)

	updater = function(state)
		for key, r in pairs(rows) do
			local level = state.upgrades[key] or 1
			r.name.Text = T("upg_" .. key) .. " · " .. T("level", level)
			local cost = Logic.upgradeCost(key, level)
			local now = Logic.upgradeValue(key, level)
			if cost then
				r.value.Text = T("value_arrow", upgradeValueText(key, now), upgradeValueText(key, Logic.upgradeValue(key, level + 1)))
				r.button.Text = "💰 " .. Logic.format(cost)
				r.button.BackgroundColor3 = state.coins >= cost and C.green or C.gray
			else
				r.value.Text = upgradeValueText(key, now)
				r.button.Text = T("max")
				r.button.BackgroundColor3 = C.gray
			end
		end
		local cost = Logic.rebirthCost(state.rebirths)
		local bonus = math.floor((state.rebirths + 1) * Config.Rebirth.bonus * 100)
		rebirthName.Text = T("rebirth_title", state.rebirths + 1)
		rebirthDesc.Text = T("rebirth_desc", tostring(bonus))
		rebirthButton.Text = "💰 " .. Logic.format(cost)
		rebirthButton.BackgroundColor3 = state.coins >= cost and C.pink or C.gray
	end
end

---------------------------------------------------------------------
-- Телескоп
---------------------------------------------------------------------

builders.telescope = function()
	title.Text = T("title_telescope")
	local header = row(70, 0)
	local info = Ui.label(header, "", UDim2.new(1, -24, 1, -12), UDim2.fromOffset(12, 6), { align = LEFT, wrap = true, color = C.soft, maxSize = 18 })
	local oddsRows: { TextLabel } = {}
	for i, rarity in ipairs(Config.RarityOrder) do
		local label = Ui.label(body, "", UDim2.new(1, -8, 0, 26), UDim2.new(), { align = LEFT, color = Ctx.rarityColor(rarity, true), maxSize = 19 })
		label.LayoutOrder = i
		oddsRows[i] = label
	end
	local summon = Ui.button(body, "", UDim2.new(1, -8, 0, 58), UDim2.new(), C.blue, function()
		Ctx.send("Summon")
	end)
	summon.LayoutOrder = 50

	updater = function(state)
		local level = state.upgrades.telescope or 1
		local scope = Logic.telescope(level)
		subtitle.Text = T("level", level) .. " / " .. #Config.Telescope
		info.Text = T("telescope_info")
		for i, rarity in ipairs(Config.RarityOrder) do
			local label = oddsRows[i]
			local chance = Logic.rarityChance(scope.weights, rarity)
			if chance > 0 then
				local names = {}
				for _, star in ipairs(Config.StarsByRarity[rarity] or {}) do
					table.insert(names, star.emoji)
				end
				label.Text = T("rar_" .. rarity) .. " " .. table.concat(names, "") .. " — " .. string.format("%.1f%%", chance)
				label.Visible = true
			else
				label.Visible = false
			end
		end
		summon.Text = T("summon", Logic.format(scope.cost))
		summon.BackgroundColor3 = state.coins >= scope.cost and C.blue or C.gray
	end
end

---------------------------------------------------------------------
-- Мои звёзды и Звездопедия
---------------------------------------------------------------------

builders.stars = function()
	title.Text = T("title_stars")
	local signature = nil
	updater = function(state)
		local parts = {}
		for key, star in pairs(state.stars) do
			table.insert(parts, key .. star.t .. (star.m or ""))
		end
		table.sort(parts)
		for id in pairs(state.index) do
			table.insert(parts, id)
		end
		local newSignature = table.concat(parts, ",") .. "|" .. state.slots .. "|" .. state.rebirths
		if newSignature == signature then
			return
		end
		signature = newSignature
		Ui.clear(body)

		local mult = Logic.incomeMult(state, state.passes)
		local mine = {}
		for key, star in pairs(state.stars) do
			table.insert(mine, { slot = tonumber(key) or 0, t = star.t, m = star.m, income = Logic.starIncome(star.t, star.m, mult) })
		end
		table.sort(mine, function(a, b)
			if a.income ~= b.income then
				return a.income > b.income
			end
			return a.slot < b.slot
		end)
		subtitle.Text = T("stars_header", #mine, state.slots)
		sectionLabel(T("my_stars"), 0)
		if #mine == 0 then
			local empty = Ui.label(body, T("stars_empty"), UDim2.new(1, -8, 0, 60), UDim2.new(), { wrap = true, maxSize = 20, color = C.soft })
			empty.LayoutOrder = 1
		end
		for i, star in ipairs(mine) do
			local r = row(70, i)
			Ui.label(r, Config.StarById[star.t].emoji, UDim2.fromOffset(50, 50), UDim2.new(0, 8, 0.5, -25), { maxSize = 40 })
			Ui.label(r, Ctx.starLabel(star.t, star.m), UDim2.new(1, -200, 0, 26), UDim2.fromOffset(64, 8), { align = LEFT, color = Ctx.starColor(star.t, true), maxSize = 21 })
			Ui.label(r, Ctx.incomeText(star.income), UDim2.new(1, -200, 0, 22), UDim2.fromOffset(64, 38), { align = LEFT, color = Color3.fromRGB(70, 140, 80), maxSize = 18 })
			local value = Logic.sellValue(star.t, star.m)
			local confirm = false
			local sell: TextButton
			sell = Ui.button(r, T("sell_for", Logic.format(value)), UDim2.fromOffset(120, 46), UDim2.new(1, -10, 0.5, 0), C.gold, function()
				if confirm or Logic.rarityOrder(star.t) < 3 then
					Ctx.send("Sell", star.slot)
				else
					confirm = true
					sell.Text = T("confirm")
					task.delay(3, function()
						confirm = false
						if sell.Parent then
							sell.Text = T("sell_for", Logic.format(value))
						end
					end)
				end
			end)
			sell.AnchorPoint = Vector2.new(1, 0.5)
		end

		local found = 0
		for _ in pairs(state.index) do
			found += 1
		end
		sectionLabel(T("index_header", found, #Config.Stars), 100)
		for i, star in ipairs(Config.Stars) do
			local r = row(58, 100 + i)
			local known = state.index[star.id] == true
			Ui.label(r, known and star.emoji or "❓", UDim2.fromOffset(44, 44), UDim2.new(0, 8, 0.5, -22), { maxSize = 36 })
			Ui.label(r, known and T("star_" .. star.id) or "???", UDim2.new(1, -170, 0, 24), UDim2.fromOffset(60, 6), { align = LEFT, color = known and C.text or C.soft, maxSize = 20 })
			Ui.label(r, T("rar_" .. star.rarity), UDim2.new(1, -170, 0, 20), UDim2.fromOffset(60, 32), { align = LEFT, color = Ctx.rarityColor(star.rarity, true), maxSize = 17 })
			Ui.label(r, Ctx.incomeText(star.income), UDim2.fromOffset(110, 30), UDim2.new(1, -118, 0.5, -15), { color = Color3.fromRGB(70, 140, 80), maxSize = 20 })
		end
	end
end

---------------------------------------------------------------------
-- Магазин за Robux
---------------------------------------------------------------------

local priceCache: { [number]: string } = {}

local function showPrice(id: number, infoType: Enum.InfoType, button: TextButton)
	if id == 0 then
		button.Text = T("soon")
		return
	end
	if priceCache[id] then
		button.Text = priceCache[id]
		return
	end
	button.Text = "..."
	task.spawn(function()
		local ok, info = pcall(function()
			return MarketplaceService:GetProductInfo(id, infoType)
		end)
		if ok and type(info) == "table" and info.PriceInRobux then
			priceCache[id] = "R$ " .. tostring(info.PriceInRobux)
		else
			priceCache[id] = T("buy")
		end
		if button.Parent and button.Text == "..." then
			button.Text = priceCache[id]
		end
	end)
end

builders.shop = function()
	title.Text = T("title_shop")
	sectionLabel(T("shop_passes"), 0)
	local passButtons = {}
	for i, key in ipairs(Config.GamePassOrder) do
		local id = Config.GamePasses[key]
		local r = row(88, i)
		Ui.label(r, T("pass_" .. key), UDim2.new(1, -156, 0, 28), UDim2.fromOffset(14, 10), { align = LEFT, maxSize = 22 })
		Ui.label(r, T("pass_" .. key .. "_desc"), UDim2.new(1, -156, 0, 38), UDim2.fromOffset(14, 42), { align = LEFT, color = C.soft, wrap = true, maxSize = 16 })
		local button = priceButton(r, function()
			local state = Ctx.state
			if id == 0 then
				Ctx.toast(T("n_soon"))
			elseif state and state.passes[key] then
				Ctx.toast(T("n_pass_owned"))
			else
				MarketplaceService:PromptGamePassPurchase(Ctx.player, id)
			end
		end)
		button.BackgroundColor3 = C.blue
		passButtons[key] = button
		showPrice(id, Enum.InfoType.GamePass, button)
	end

	sectionLabel(T("shop_products"), 50)
	local coinLabels = {}
	for i, key in ipairs(Config.ProductOrder) do
		local id = Config.Products[key]
		local r = row(88, 50 + i)
		Ui.label(r, T("prod_" .. key), UDim2.new(1, -156, 0, 28), UDim2.fromOffset(14, 10), { align = LEFT, maxSize = 22 })
		local desc = Ui.label(r, "", UDim2.new(1, -156, 0, 38), UDim2.fromOffset(14, 42), { align = LEFT, color = C.soft, wrap = true, maxSize = 16 })
		if key == "coinsSmall" or key == "coinsBig" then
			coinLabels[key] = desc
		else
			desc.Text = T("prod_" .. key .. "_desc")
		end
		local button = priceButton(r, function()
			if id == 0 then
				Ctx.toast(T("n_soon"))
			else
				MarketplaceService:PromptProductPurchase(Ctx.player, id)
			end
		end)
		button.BackgroundColor3 = C.pink
		showPrice(id, Enum.InfoType.Product, button)
	end

	updater = function(state)
		for key, button in pairs(passButtons) do
			if state.passes[key] then
				button.Text = T("owned")
				button.BackgroundColor3 = C.green
			end
		end
		for key, label in pairs(coinLabels) do
			label.Text = T("prod_coins_desc", Logic.format(Logic.coinPack(state.earned, key == "coinsBig")))
		end
	end
end

---------------------------------------------------------------------
-- Коды
---------------------------------------------------------------------

builders.codes = function()
	title.Text = T("title_codes")
	local r = row(176, 1)
	local box = Instance.new("TextBox")
	box.Size = UDim2.new(1, -24, 0, 52)
	box.Position = UDim2.fromOffset(12, 12)
	box.BackgroundColor3 = Color3.fromRGB(240, 240, 252)
	box.BorderSizePixel = 0
	box.Font = Ui.Font
	box.TextScaled = true
	box.TextColor3 = C.text
	box.PlaceholderText = T("code_placeholder")
	box.PlaceholderColor3 = C.soft
	box.Text = ""
	box.ClearTextOnFocus = false
	Ui.corner(box, 12)
	Ui.padding(box, 8)
	box.Parent = r
	Ui.button(r, T("redeem"), UDim2.new(1, -24, 0, 48), UDim2.fromOffset(12, 74), C.pink, function()
		if box.Text ~= "" then
			Ctx.send("Code", box.Text)
			box.Text = ""
		end
	end)
	Ui.label(r, T("code_hint"), UDim2.new(1, -24, 0, 34), UDim2.fromOffset(12, 132), { color = C.soft, wrap = true, maxSize = 17 })
end

---------------------------------------------------------------------
-- Открыть / закрыть
---------------------------------------------------------------------

function Panels.open(name: string, arg: any?)
	local builder = builders[name]
	if not builder then
		return
	end
	current = name
	updater = nil
	Ui.clear(body)
	body.CanvasPosition = Vector2.new(0, 0)
	subtitle.Text = ""
	builder(arg)
	modal.Visible = true
	local state = Ctx.state
	if updater and state then
		updater(state)
	end
end

function Panels.close()
	modal.Visible = false
	current = nil
	updater = nil
	Ui.clear(body)
end

function Panels.isOpen(name: string): boolean
	return current == name
end

---------------------------------------------------------------------
-- Карточка новой звезды (телескоп, награды, покупки)
---------------------------------------------------------------------

function Panels.reveal(starId: string, mut: string?, headerKey: string)
	local star = Config.StarById[starId]
	if not star then
		return
	end
	local color = Ctx.rarityColor(star.rarity)
	local overlay = Instance.new("TextButton")
	overlay.Name = "Reveal"
	overlay.Size = UDim2.fromScale(1, 1)
	overlay.BackgroundColor3 = Color3.new(0, 0, 0)
	overlay.BackgroundTransparency = 0.4
	overlay.BorderSizePixel = 0
	overlay.AutoButtonColor = false
	overlay.Text = ""
	overlay.ZIndex = 30
	overlay.Parent = root

	local card = Ui.frame(overlay, UDim2.fromOffset(340, 390), UDim2.fromScale(0.5, 0.5), C.panel, 0)
	card.AnchorPoint = Vector2.new(0.5, 0.5)
	card.Active = true
	Ui.corner(card, 24)
	Ui.stroke(card, color, 4)
	Ui.label(card, T(headerKey), UDim2.new(1, -30, 0, 40), UDim2.fromOffset(15, 14), { maxSize = 30 })
	local big = Ui.label(card, "🌟", UDim2.fromOffset(150, 150), UDim2.new(0.5, -75, 0, 60), { maxSize = 120 })
	local name = Ui.label(card, Ctx.starLabel(starId, mut), UDim2.new(1, -30, 0, 36), UDim2.fromOffset(15, 214), { color = Ctx.rarityColor(star.rarity, true), maxSize = 28 })
	local state = Ctx.state
	local mult = state and Logic.incomeMult(state, state.passes) or 1
	local details = Ui.label(card, T("rar_" .. star.rarity) .. " · " .. Ctx.incomeText(Logic.starIncome(starId, mut, mult)), UDim2.new(1, -30, 0, 26), UDim2.fromOffset(15, 254), { color = C.soft, maxSize = 20 })
	name.TextTransparency = 1
	details.TextTransparency = 1
	local ok = Ui.button(card, T("ok"), UDim2.new(1, -60, 0, 52), UDim2.new(0, 30, 1, -70), C.green, function()
		overlay:Destroy()
	end)
	ok.Visible = false

	task.spawn(function()
		for i = 1, 8 do
			big.Rotation = (i % 2 == 0) and 16 or -16
			task.wait(0.1)
		end
		big.Rotation = 0
		big.Text = star.emoji
		local pop = Instance.new("UIScale")
		pop.Scale = 0.3
		pop.Parent = big
		TweenService:Create(pop, TweenInfo.new(0.45, Enum.EasingStyle.Back), { Scale = 1 }):Play()
		TweenService:Create(name, TweenInfo.new(0.4), { TextTransparency = 0 }):Play()
		TweenService:Create(details, TweenInfo.new(0.4), { TextTransparency = 0 }):Play()
		ok.Visible = true
	end)
	task.delay(8, function()
		if overlay.Parent then
			overlay:Destroy()
		end
	end)
end

function Panels.init(parent: Frame)
	root = parent
	modal = Instance.new("TextButton")
	modal.Name = "Modal"
	modal.Size = UDim2.fromScale(1, 1)
	modal.BackgroundColor3 = Color3.new(0, 0, 0)
	modal.BackgroundTransparency = 0.45
	modal.BorderSizePixel = 0
	modal.AutoButtonColor = false
	modal.Text = ""
	modal.Visible = false
	modal.ZIndex = 20
	modal.Activated:Connect(Panels.close)
	modal.Parent = root

	local panel = Ui.frame(modal, UDim2.new(0.94, 0, 0.82, 0), UDim2.fromScale(0.5, 0.5), C.panel, 0)
	panel.AnchorPoint = Vector2.new(0.5, 0.5)
	panel.Active = true
	Ui.corner(panel, 22)
	Ui.stroke(panel, C.dark, 3)
	local constraint = Instance.new("UISizeConstraint")
	constraint.MaxSize = Vector2.new(560, 660)
	constraint.Parent = panel

	title = Ui.label(panel, "", UDim2.new(1, -86, 0, 40), UDim2.fromOffset(18, 10), { align = LEFT, maxSize = 32 })
	subtitle = Ui.label(panel, "", UDim2.new(1, -36, 0, 22), UDim2.fromOffset(18, 52), { align = LEFT, color = C.soft, maxSize = 19 })
	local close = Ui.button(panel, "✕", UDim2.fromOffset(44, 44), UDim2.new(1, -54, 0, 10), C.red, Panels.close)
	close.ZIndex = 2

	body = Instance.new("ScrollingFrame")
	body.Name = "Body"
	body.Size = UDim2.new(1, -20, 1, -92)
	body.Position = UDim2.fromOffset(12, 82)
	body.BackgroundTransparency = 1
	body.BorderSizePixel = 0
	body.ScrollBarThickness = 6
	body.ScrollBarImageColor3 = C.soft
	body.CanvasSize = UDim2.new()
	body.AutomaticCanvasSize = Enum.AutomaticSize.Y
	body.ScrollingDirection = Enum.ScrollingDirection.Y
	body.Parent = panel
	Ui.list(body, true, 8)
	local padding = Instance.new("UIPadding")
	padding.PaddingTop = UDim.new(0, 4)
	padding.PaddingBottom = UDim.new(0, 8)
	padding.PaddingLeft = UDim.new(0, 2)
	padding.Parent = body

	Ctx.openPanel = Panels.open
	Ctx.closePanel = Panels.close

	Ctx.onState(function(state)
		if current and updater then
			updater(state)
		end
	end)
end

return Panels
