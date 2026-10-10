-- Окна: семена, улучшения, яйца, питомцы, магазин за Robux, коды, выбор семян, новый питомец.

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
local ticker: (() -> ())? = nil

local function row(height: number, order: number): Frame
	local frame = Ui.frame(body, UDim2.new(1, -8, 0, height), UDim2.new(), C.row, 0)
	frame.LayoutOrder = order
	Ui.corner(frame, 14)
	Ui.stroke(frame, C.dark, 1.5, 0.75)
	return frame
end

local function sectionLabel(text: string, order: number)
	local label = Ui.label(body, text, UDim2.new(1, -8, 0, 30), UDim2.new(), { color = C.soft, align = LEFT, maxSize = 22 })
	label.LayoutOrder = order
end

local function priceButton(parent: Instance, onClick: () -> ()): TextButton
	local button = Ui.button(parent, "", UDim2.fromOffset(122, 48), UDim2.new(1, -10, 0.5, 0), C.green, onClick)
	button.AnchorPoint = Vector2.new(1, 0.5)
	return button
end

local builders: { [string]: (any) -> () } = {}

---------------------------------------------------------------------
-- Семена
---------------------------------------------------------------------

builders.seeds = function()
	title.Text = T("title_seeds")
	local rows = {}
	for i, seed in ipairs(Config.Seeds) do
		local r = row(88, i)
		Ui.label(r, seed.emoji, UDim2.fromOffset(56, 56), UDim2.new(0, 8, 0.5, -28), { maxSize = 44 })
		Ui.label(r, T("seed_" .. seed.id) .. (seed.harvest == "multi" and " ♻" or ""), UDim2.new(1, -210, 0, 26), UDim2.fromOffset(72, 8), { align = LEFT, maxSize = 24 })
		Ui.label(r, T("rar_" .. seed.rarity) .. " · " .. T("fruit_value", Logic.format(seed.value)), UDim2.new(1, -210, 0, 20), UDim2.fromOffset(72, 36), { align = LEFT, color = Ctx.rarityColor(seed.rarity, true), maxSize = 17 })
		local stock = Ui.label(r, "", UDim2.new(1, -210, 0, 20), UDim2.fromOffset(72, 60), { align = LEFT, color = C.soft, maxSize = 17 })
		local button = priceButton(r, function()
			Ctx.send("BuySeed", seed.id)
		end)
		button.Text = "💰 " .. Logic.format(seed.price)
		rows[seed.id] = { stock = stock, button = button, price = seed.price }
	end
	updater = function(state)
		local byId = {}
		for _, item in ipairs(state.stock) do
			byId[item.id] = item
		end
		for id, r in pairs(rows) do
			local item = byId[id]
			local left = item and item.left or 0
			local stockText = left > 0 and T("in_stock", left) or T("out_of_stock")
			r.stock.Text = stockText .. " · " .. T("you_have", state.seeds[id] or 0)
			r.button.BackgroundColor3 = (left > 0 and state.coins >= r.price) and C.green or C.gray
		end
	end
	ticker = function()
		local state = Ctx.state
		if state then
			local nextRestock = (state.stockSlot + 1) * Config.RestockSeconds
			subtitle.Text = T("restock_in", Logic.formatTime(nextRestock - workspace:GetServerTimeNow()))
		end
	end
end

---------------------------------------------------------------------
-- Улучшения
---------------------------------------------------------------------

local function upgradeValueText(key: string, value: number): string
	return T("upgv_" .. key, tostring(value))
end

builders.gear = function()
	title.Text = T("title_gear")
	local rows = {}
	for i, upgrade in ipairs(Config.Upgrades) do
		local r = row(88, i)
		Ui.label(r, upgrade.emoji, UDim2.fromOffset(56, 56), UDim2.new(0, 8, 0.5, -28), { maxSize = 44 })
		local name = Ui.label(r, T("upg_" .. upgrade.key), UDim2.new(1, -210, 0, 26), UDim2.fromOffset(72, 8), { align = LEFT, maxSize = 24 })
		Ui.label(r, T("upg_" .. upgrade.key .. "_desc"), UDim2.new(1, -210, 0, 20), UDim2.fromOffset(72, 36), { align = LEFT, color = C.soft, maxSize = 17 })
		local value = Ui.label(r, "", UDim2.new(1, -210, 0, 20), UDim2.fromOffset(72, 60), { align = LEFT, color = Color3.fromRGB(70, 140, 80), maxSize = 17 })
		local button = priceButton(r, function()
			Ctx.send("BuyUpgrade", upgrade.key)
		end)
		rows[upgrade.key] = { name = name, value = value, button = button }
	end
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
	end
end

---------------------------------------------------------------------
-- Яйца
---------------------------------------------------------------------

builders.eggs = function()
	title.Text = T("title_eggs")
	local buttons = {}
	for i, egg in ipairs(Config.Eggs) do
		local r = row(84 + #egg.pets * 26 + 10, i)
		local circle = Ui.frame(r, UDim2.fromOffset(62, 62), UDim2.fromOffset(10, 10), egg.color, 0)
		Ui.corner(circle, 31)
		Ui.label(circle, "🥚", UDim2.fromScale(1, 1), UDim2.new(), { maxSize = 40 })
		Ui.label(r, T("egg_" .. egg.id), UDim2.new(1, -96, 0, 28), UDim2.fromOffset(84, 10), { align = LEFT, maxSize = 24 })
		Ui.label(r, "💰 " .. Logic.format(egg.price) .. "   " .. T("odds"), UDim2.new(1, -96, 0, 22), UDim2.fromOffset(84, 42), { align = LEFT, color = C.soft, maxSize = 18 })
		for j, entry in ipairs(egg.pets) do
			local petId = entry[1]
			local pet = Config.Pets[petId]
			local percent = math.floor(Logic.petChance(egg, petId) * 1000 + 0.5) / 10
			Ui.label(r, Ctx.petLabel(petId) .. "  " .. tostring(percent) .. "% · " .. Ctx.bonusText(petId), UDim2.new(1, -150, 0, 22), UDim2.fromOffset(14, 80 + (j - 1) * 26), {
				align = LEFT,
				color = Ctx.rarityColor(pet.rarity, true),
				maxSize = 17,
			})
		end
		local button = Ui.button(r, T("buy"), UDim2.fromOffset(118, 48), UDim2.new(1, -10, 1, -10), C.green, function()
			Ctx.send("BuyEgg", egg.id)
		end)
		button.AnchorPoint = Vector2.new(1, 1)
		buttons[egg.id] = { button = button, price = egg.price }
	end
	updater = function(state)
		for _, info in pairs(buttons) do
			info.button.BackgroundColor3 = state.coins >= info.price and C.green or C.gray
		end
	end
end

---------------------------------------------------------------------
-- Питомцы
---------------------------------------------------------------------

builders.pets = function()
	title.Text = T("title_pets")
	local signature = nil
	updater = function(state)
		subtitle.Text = T("pets_header", #state.equipped, state.petSlots, #state.pets, Config.MaxPets)
		local parts = {}
		for _, pet in ipairs(state.pets) do
			table.insert(parts, pet.u .. ":" .. pet.id)
		end
		table.insert(parts, "|")
		for _, uid in ipairs(state.equipped) do
			table.insert(parts, uid)
		end
		local newSignature = table.concat(parts, ",")
		if newSignature == signature then
			return
		end
		signature = newSignature
		Ui.clear(body)

		if #state.pets == 0 then
			local empty = Ui.label(body, T("pets_empty"), UDim2.new(1, -8, 0, 70), UDim2.new(), { wrap = true, maxSize = 20, color = C.soft })
			empty.LayoutOrder = 1
			return
		end

		local equippedIndex = {}
		for i, uid in ipairs(state.equipped) do
			equippedIndex[uid] = i
		end
		local list = table.clone(state.pets)
		table.sort(list, function(a, b)
			local ea, eb = equippedIndex[a.u], equippedIndex[b.u]
			if (ea ~= nil) ~= (eb ~= nil) then
				return ea ~= nil
			end
			local ra = Config.Pets[a.id] and Config.Rarities[Config.Pets[a.id].rarity].order or 0
			local rb = Config.Pets[b.id] and Config.Rarities[Config.Pets[b.id].rarity].order or 0
			if ra ~= rb then
				return ra > rb
			end
			return (tonumber(a.u) or 0) < (tonumber(b.u) or 0)
		end)

		for i, pet in ipairs(list) do
			local def = Config.Pets[pet.id]
			if def then
				local r = row(74, i)
				Ui.label(r, def.emoji, UDim2.fromOffset(52, 52), UDim2.new(0, 8, 0.5, -26), { maxSize = 40 })
				Ui.label(r, T("pet_" .. pet.id), UDim2.new(1, -236, 0, 26), UDim2.fromOffset(68, 8), { align = LEFT, color = Ctx.rarityColor(def.rarity, true), maxSize = 22 })
				Ui.label(r, Ctx.bonusText(pet.id), UDim2.new(1, -236, 0, 22), UDim2.fromOffset(68, 38), { align = LEFT, color = C.soft, maxSize = 17 })
				local isOn = equippedIndex[pet.u] ~= nil
				local equipButton = Ui.button(r, isOn and T("unequip") or T("equip"), UDim2.fromOffset(106, 44), UDim2.new(1, -60, 0.5, 0), isOn and C.gray or C.green, function()
					Ctx.send("Equip", pet.u, not isOn)
				end)
				equipButton.AnchorPoint = Vector2.new(1, 0.5)
				local confirm = false
				local deleteButton: TextButton
				deleteButton = Ui.button(r, T("delete"), UDim2.fromOffset(44, 44), UDim2.new(1, -8, 0.5, 0), C.red, function()
					if confirm then
						Ctx.send("DeletePet", pet.u)
					else
						confirm = true
						deleteButton.Text = "?"
						Ctx.toast(T("confirm"))
						task.delay(3, function()
							confirm = false
							if deleteButton.Parent then
								deleteButton.Text = T("delete")
							end
						end)
					end
				end)
				deleteButton.AnchorPoint = Vector2.new(1, 0.5)
			end
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
	box.BackgroundColor3 = Color3.fromRGB(246, 240, 250)
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
-- Выбор семян для посадки
---------------------------------------------------------------------

builders.pick = function(tile: any)
	title.Text = T("title_pick")
	local signature = nil
	updater = function(state)
		local parts = {}
		for _, seed in ipairs(Config.Seeds) do
			local count = state.seeds[seed.id]
			if count and count > 0 then
				table.insert(parts, seed.id .. count)
			end
		end
		local newSignature = table.concat(parts, ",") .. "|" .. tostring(Ctx.selected)
		if newSignature == signature then
			return
		end
		signature = newSignature
		Ui.clear(body)

		local any = false
		for i, seed in ipairs(Config.Seeds) do
			local count = state.seeds[seed.id] or 0
			if count > 0 then
				any = true
				local button = Instance.new("TextButton")
				button.LayoutOrder = i
				button.Size = UDim2.new(1, -8, 0, 66)
				button.BackgroundColor3 = (Ctx.selected == seed.id) and Color3.fromRGB(255, 225, 240) or C.row
				button.BorderSizePixel = 0
				button.Text = ""
				button.AutoButtonColor = true
				Ui.corner(button, 14)
				Ui.stroke(button, C.dark, 1.5, 0.7)
				Ui.label(button, seed.emoji, UDim2.fromOffset(50, 50), UDim2.new(0, 8, 0.5, -25), { maxSize = 40 })
				Ui.label(button, T("seed_" .. seed.id), UDim2.new(1, -150, 0, 26), UDim2.fromOffset(66, 8), { align = LEFT, maxSize = 24 })
				Ui.label(button, T("rar_" .. seed.rarity), UDim2.new(1, -150, 0, 20), UDim2.fromOffset(66, 36), { align = LEFT, color = Ctx.rarityColor(seed.rarity, true), maxSize = 17 })
				Ui.label(button, "x" .. count, UDim2.fromOffset(70, 40), UDim2.new(1, -80, 0.5, -20), { maxSize = 28 })
				button.Activated:Connect(function()
					Ctx.setSelected(seed.id)
					if type(tile) == "number" then
						Ctx.send("Plant", tile, seed.id)
					end
					Panels.close()
				end)
				button.Parent = body
			end
		end
		if not any then
			local empty = Ui.label(body, T("no_seeds"), UDim2.new(1, -8, 0, 60), UDim2.new(), { wrap = true, maxSize = 20, color = C.soft })
			empty.LayoutOrder = 1
			local go = Ui.button(body, "🌱 " .. T("btn_seeds"), UDim2.new(1, -8, 0, 52), UDim2.new(), C.green, function()
				Ctx.send("Teleport", "seeds")
				Panels.open("seeds")
			end)
			go.LayoutOrder = 2
		end
	end
end

---------------------------------------------------------------------
-- Корзина
---------------------------------------------------------------------

local basketRenderer: ((any) -> ())? = nil

builders.basket = function()
	title.Text = T("title_basket")
	subtitle.Text = "..."
	local lastCount = -1
	basketRenderer = function(summary)
		subtitle.Text = T("basket_total", tostring(summary.count), Logic.format(summary.total))
		Ui.clear(body)
		local sell = Ui.button(body, T("sell_all"), UDim2.new(1, -8, 0, 52), UDim2.new(), C.gold, function()
			Panels.close()
			Ctx.sellAll()
		end)
		sell.LayoutOrder = 0
		if summary.count == 0 then
			local empty = Ui.label(body, T("basket_empty"), UDim2.new(1, -8, 0, 60), UDim2.new(), { wrap = true, maxSize = 20, color = C.soft })
			empty.LayoutOrder = 1
			return
		end
		for i, group in ipairs(summary.groups) do
			local seed = Config.SeedById[group.id]
			if seed then
				local r = row(64, i)
				Ui.label(r, seed.emoji, UDim2.fromOffset(46, 46), UDim2.new(0, 8, 0.5, -23), { maxSize = 38 })
				local mutated = group.c or group.w or group.g
				Ui.label(r, Ctx.fruitName(group.id, group.c, group.w, group.g), UDim2.new(1, -190, 0, 26), UDim2.fromOffset(62, 6), {
					align = LEFT,
					color = mutated and Color3.fromRGB(190, 120, 20) or C.text,
					maxSize = 20,
				})
				Ui.label(r, "x" .. tostring(group.n), UDim2.new(1, -190, 0, 22), UDim2.fromOffset(62, 34), { align = LEFT, color = C.soft, maxSize = 18 })
				Ui.label(r, Logic.format(group.v) .. " 💰", UDim2.fromOffset(120, 30), UDim2.new(1, -128, 0.5, -15), { color = Color3.fromRGB(70, 140, 80), maxSize = 22 })
			end
		end
	end
	updater = function(state)
		if state.basket ~= lastCount then
			lastCount = state.basket
			Ctx.send("Basket")
		end
	end
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
	ticker = nil
	Ui.clear(body)
	body.CanvasPosition = Vector2.new(0, 0)
	subtitle.Text = ""
	builder(arg)
	modal.Visible = true
	local state = Ctx.state
	if updater and state then
		updater(state)
	end
	if ticker then
		ticker()
	end
end

function Panels.close()
	modal.Visible = false
	current = nil
	updater = nil
	ticker = nil
	Ui.clear(body)
end

function Panels.isOpen(name: string): boolean
	return current == name
end

---------------------------------------------------------------------
-- Новый питомец из яйца
---------------------------------------------------------------------

function Panels.hatch(petId: string)
	local def = Config.Pets[petId]
	if not def then
		return
	end
	local overlay = Instance.new("TextButton")
	overlay.Size = UDim2.fromScale(1, 1)
	overlay.BackgroundColor3 = Color3.new(0, 0, 0)
	overlay.BackgroundTransparency = 0.4
	overlay.BorderSizePixel = 0
	overlay.AutoButtonColor = false
	overlay.Text = ""
	overlay.ZIndex = 30
	overlay.Parent = root

	local card = Ui.frame(overlay, UDim2.fromOffset(340, 380), UDim2.fromScale(0.5, 0.5), C.panel, 0)
	card.AnchorPoint = Vector2.new(0.5, 0.5)
	card.Active = true
	Ui.corner(card, 24)
	Ui.stroke(card, Ctx.rarityColor(def.rarity), 4)
	Ui.label(card, T("hatch_title"), UDim2.new(1, -30, 0, 40), UDim2.fromOffset(15, 14), { maxSize = 32 })
	local big = Ui.label(card, "🥚", UDim2.fromOffset(150, 150), UDim2.new(0.5, -75, 0, 60), { maxSize = 120 })
	local name = Ui.label(card, Ctx.petLabel(petId), UDim2.new(1, -30, 0, 36), UDim2.fromOffset(15, 214), { color = Ctx.rarityColor(def.rarity, true), maxSize = 30 })
	local bonus = Ui.label(card, T("rar_" .. def.rarity) .. " · " .. Ctx.bonusText(petId), UDim2.new(1, -30, 0, 26), UDim2.fromOffset(15, 252), { color = C.soft, maxSize = 20 })
	name.TextTransparency = 1
	bonus.TextTransparency = 1
	local ok = Ui.button(card, T("ok"), UDim2.new(1, -60, 0, 52), UDim2.new(0, 30, 1, -70), C.green, function()
		overlay:Destroy()
	end)
	ok.Visible = false

	task.spawn(function()
		for i = 1, 8 do
			big.Rotation = (i % 2 == 0) and 14 or -14
			task.wait(0.11)
		end
		big.Rotation = 0
		big.Text = def.emoji
		local pop = Instance.new("UIScale")
		pop.Scale = 0.3
		pop.Parent = big
		TweenService:Create(pop, TweenInfo.new(0.45, Enum.EasingStyle.Back), { Scale = 1 }):Play()
		TweenService:Create(name, TweenInfo.new(0.4), { TextTransparency = 0 }):Play()
		TweenService:Create(bonus, TweenInfo.new(0.4), { TextTransparency = 0 }):Play()
		ok.Visible = true
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
	Ctx.onMode(function()
		if current == "pick" and updater and Ctx.state then
			updater(Ctx.state)
		end
	end)
	Ctx.onBasket(function(summary)
		if current == "basket" and basketRenderer then
			basketRenderer(summary)
		end
	end)
	task.spawn(function()
		while true do
			if modal.Visible and ticker then
				ticker()
			end
			task.wait(0.5)
		end
	end)
end

return Panels
