-- Интерфейс поверх подземелья: здоровье и опыт, журнал, панель кнопок,
-- рюкзак и окна предметов. Похоже на панели Shattered Pixel Dungeon.
local GuiService = game:GetService("GuiService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BPD")
local Defs = require(Shared:WaitForChild("Core"):WaitForChild("Defs"))
local Ui = require(script.Parent:WaitForChild("Ui"))

local Hud = {}
Hud.__index = Hud

local LOG_LINES = 5

function Hud.new(gui, on)
	local self = setmetatable({ gui = gui, on = on, lines = {} }, Hud)
	local root = Ui.new("Frame", {
		Name = "Hud",
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
		ZIndex = 10,
		Parent = gui,
	})
	self.root = root
	local safe = Ui.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Parent = root })
	local padding = Ui.new("UIPadding", {
		PaddingTop = UDim.new(0, 64),
		PaddingLeft = UDim.new(0, 10),
		PaddingRight = UDim.new(0, 10),
		PaddingBottom = UDim.new(0, 10),
		Parent = safe,
	})
	-- панели начинаются ниже кнопок Roblox (меню, чат, микрофон) в верхнем углу
	local function fitTopbar()
		local top = 64
		pcall(function()
			top = math.max(top, GuiService.TopbarInset.Max.Y + 8)
		end)
		padding.PaddingTop = UDim.new(0, top)
	end
	fitTopbar()
	pcall(function()
		GuiService:GetPropertyChangedSignal("TopbarInset"):Connect(fitTopbar)
	end)

	-- статус героя
	local status = Ui.panel(safe, { Size = UDim2.fromOffset(250, 70), BackgroundTransparency = 0.1 })
	self.portrait = Ui.image(status, { Position = UDim2.fromOffset(8, 6), Size = UDim2.fromOffset(36, 45) })
	self.title = Ui.label(status, "Воин", 15, {
		Position = UDim2.fromOffset(52, 4),
		Size = UDim2.fromOffset(190, 18),
		TextXAlignment = Enum.TextXAlignment.Left,
	})
	local hpBack = Ui.new("Frame", {
		BackgroundColor3 = Ui.C.hpBack,
		BorderSizePixel = 0,
		Position = UDim2.fromOffset(52, 24),
		Size = UDim2.fromOffset(188, 16),
		Parent = status,
	})
	Ui.corner(hpBack, 3)
	self.hpFill = Ui.new("Frame", { BackgroundColor3 = Ui.C.hp, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), Parent = hpBack })
	Ui.corner(self.hpFill, 3)
	self.hpText = Ui.label(hpBack, "20/20", 13, { Size = UDim2.fromScale(1, 1), TextStrokeTransparency = 0.4, ZIndex = 2 })
	local expBack = Ui.new("Frame", {
		BackgroundColor3 = Color3.fromRGB(60, 55, 30),
		BorderSizePixel = 0,
		Position = UDim2.fromOffset(52, 43),
		Size = UDim2.fromOffset(188, 4),
		Parent = status,
	})
	self.expFill = Ui.new("Frame", { BackgroundColor3 = Ui.C.exp, BorderSizePixel = 0, Size = UDim2.fromScale(0, 1), Parent = expBack })
	self.info = Ui.label(status, "", 13, {
		Position = UDim2.fromOffset(52, 49),
		Size = UDim2.fromOffset(190, 16),
		TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = Ui.C.dim,
	})
	self.buffs = Ui.label(safe, "", 13, {
		Position = UDim2.fromOffset(4, 74),
		Size = UDim2.fromOffset(400, 16),
		TextXAlignment = Enum.TextXAlignment.Left,
		RichText = true,
		TextStrokeTransparency = 0.4,
	})

	-- босс
	self.boss = Ui.panel(safe, {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.fromScale(0.5, 0),
		Size = UDim2.fromOffset(240, 34),
		Visible = false,
	})
	Ui.label(self.boss, "Гу", 13, { Size = UDim2.new(1, 0, 0, 14), Position = UDim2.fromOffset(0, 2) })
	local bossBack = Ui.new("Frame", {
		BackgroundColor3 = Ui.C.hpBack,
		BorderSizePixel = 0,
		Position = UDim2.new(0, 8, 0, 18),
		Size = UDim2.new(1, -16, 0, 10),
		Parent = self.boss,
	})
	self.bossFill = Ui.new("Frame", { BackgroundColor3 = Ui.C.hp, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), Parent = bossBack })

	-- меню и масштаб
	local right = Ui.new("Frame", {
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.fromScale(1, 0),
		Size = UDim2.fromOffset(44, 140),
		BackgroundTransparency = 1,
		Parent = safe,
	})
	Ui.new("UIListLayout", { Padding = UDim.new(0, 6), Parent = right })
	Ui.button(right, "≡", on.menu, { Size = UDim2.fromOffset(44, 40), TextSize = 22 })
	Ui.button(right, "+", function()
		on.zoom(1)
	end, { Size = UDim2.fromOffset(44, 36), TextSize = 22 })
	Ui.button(right, "−", function()
		on.zoom(-1)
	end, { Size = UDim2.fromOffset(44, 36), TextSize = 22 })

	-- панель кнопок
	local bar = Ui.new("Frame", {
		AnchorPoint = Vector2.new(1, 1),
		Position = UDim2.fromScale(1, 1),
		Size = UDim2.fromOffset(3 * 60, 56),
		BackgroundTransparency = 1,
		Parent = safe,
	})
	Ui.new("UIListLayout", {
		FillDirection = Enum.FillDirection.Horizontal,
		HorizontalAlignment = Enum.HorizontalAlignment.Right,
		Padding = UDim.new(0, 4),
		Parent = bar,
	})
	local function toolButton(icon, onClick)
		local b = Ui.button(bar, "", onClick, { Size = UDim2.fromOffset(56, 56) })
		local r = Ui.Atlas.rects[icon]
		local img = Ui.image(b, {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.5),
			Size = UDim2.fromOffset(r.w * 2, r.h * 2),
		})
		Ui.setRect(img, r.x, r.y, r.w, r.h)
		return b
	end
	self.btnSearch = toolButton("icon_search", on.examine)
	self.btnWait = toolButton("icon_wait", nil)
	self.btnBag = toolButton("icon_bag", on.inventory)
	if not Ui.atlas then
		self.btnSearch.Text, self.btnWait.Text, self.btnBag.Text = "?", "Zz", "Рюк"
	end
	-- «ждать»: нажатие — один ход, удержание — отдых до полного здоровья
	local holdStart
	self.btnWait.MouseButton1Down:Connect(function()
		holdStart = os.clock()
		task.delay(0.5, function()
			if holdStart and os.clock() - holdStart >= 0.45 then
				holdStart = nil
				on.rest()
			end
		end)
	end)
	self.btnWait.MouseButton1Up:Connect(function()
		if holdStart then
			holdStart = nil
			on.wait()
		end
	end)

	-- индикатор врага: нажать — атаковать ближайшего
	self.attack = Ui.button(safe, "", on.attackNearest, {
		AnchorPoint = Vector2.new(1, 1),
		Position = UDim2.new(1, 0, 1, -62),
		Size = UDim2.fromOffset(56, 56),
		BackgroundColor3 = Color3.fromRGB(110, 40, 35),
		Visible = false,
	})
	self.attackImg = Ui.image(self.attack, {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(40, 40),
	})

	-- журнал
	self.logFrame = Ui.new("Frame", {
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.fromScale(0, 1),
		Size = UDim2.new(1, -200, 0, LOG_LINES * 19),
		BackgroundTransparency = 1,
		Parent = safe,
	})
	Ui.new("UIListLayout", {
		VerticalAlignment = Enum.VerticalAlignment.Bottom,
		SortOrder = Enum.SortOrder.LayoutOrder,
		Parent = self.logFrame,
	})
	self.logOrder = 0
	return self
end

function Hud:log(text, color)
	self.logOrder = self.logOrder + 1
	local l = Ui.label(self.logFrame, text, 15, {
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		TextWrapped = true,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = Ui.LOG[color] or Ui.C.text,
		TextStrokeTransparency = 0.3,
		LayoutOrder = self.logOrder,
	})
	table.insert(self.lines, { label = l, born = os.clock() })
	while #self.lines > LOG_LINES do
		table.remove(self.lines, 1).label:Destroy()
	end
end

function Hud:clearLog()
	for _, l in ipairs(self.lines) do
		l.label:Destroy()
	end
	self.lines = {}
end

function Hud:update()
	local now = os.clock()
	for _, l in ipairs(self.lines) do
		local age = now - l.born
		local fade = math.clamp((age - 10) / 4, 0, 0.5)
		l.label.TextTransparency = fade
		l.label.TextStrokeTransparency = 0.3 + fade * 0.7
	end
end

function Hud:setExamine(on)
	self.btnSearch.BackgroundColor3 = on and Color3.fromRGB(140, 120, 50) or Ui.C.button
end

function Hud:refresh(g)
	local hero = g.hero
	local tier = hero.armor and Defs.armors[hero.armor.type].tier or 0
	local x, y, w, h = Ui.charFrame("warrior", 0, tier)
	Ui.setRect(self.portrait, x, y, w, h)
	self.title.Text = string.format("Воин · ур. %d · сила %d", hero.lvl, hero.str)
	self.hpFill.Size = UDim2.fromScale(math.clamp(hero.hp / hero.ht, 0, 1), 1)
	self.hpText.Text = string.format("%d/%d", math.max(0, hero.hp), hero.ht)
	self.expFill.Size = UDim2.fromScale(math.clamp(hero.exp / (5 + hero.lvl * 5), 0, 1), 1)
	self.info.Text = string.format("Глубина %d · золото %d", g.depth, hero.gold)
	local parts = {}
	local hex = { white = "#F0ECE4", good = "#6EF06E", bad = "#FF5F5F", warn = "#FFAA3C", high = "#FFF05A" }
	for _, b in ipairs(g:heroInfo()) do
		parts[#parts + 1] = string.format('<font color="%s">%s</font>', hex[b.color] or hex.white, b.text)
	end
	self.buffs.Text = table.concat(parts, "  ")

	local enemies = g:visibleEnemies()
	self.attack.Visible = #enemies > 0 and not g.over
	if #enemies > 0 then
		local m = enemies[1]
		local fx, fy, fw, fh = Ui.charFrame(m.def.sprite, 0, 0)
		Ui.setRect(self.attackImg, fx, fy, fw, fh)
		local k = 40 / math.max(fw, fh)
		self.attackImg.Size = UDim2.fromOffset(fw * k, fh * k)
	end

	local boss
	for _, m in ipairs(g.mobs) do
		if m.boss then
			boss = m
		end
	end
	self.boss.Visible = boss ~= nil and boss.state ~= "sleeping" and g.depth == g.MAX_DEPTH
	if boss then
		self.bossFill.Size = UDim2.fromScale(math.clamp(boss.hp / boss.ht, 0, 1), 1)
	end
end

------------------------------------------------------------------ окна

-- значок предмета в ячейке
local function itemSlot(parent, g, item, size, onClick, hint)
	local b = Ui.button(parent, "", onClick, {
		Size = UDim2.fromOffset(size, size),
		BackgroundColor3 = item and Ui.C.button or Ui.C.panelDark,
		ZIndex = 53,
	})
	if item then
		local img = Ui.image(b, {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.5),
			Size = UDim2.fromOffset(32, 32),
			ZIndex = 54,
		})
		Ui.setItemIcon(img, g:itemIcon(item))
		if not Ui.atlas then
			b.Text = string.sub(g:itemName(item), 1, 6)
			b.TextSize = 10
		end
		local corner = ""
		if item.qty > 1 then
			corner = tostring(item.qty)
		end
		if (item.kind == "weapon" or item.kind == "armor") then
			if not item.known then
				corner = "?"
			elseif item.level ~= 0 then
				corner = (item.level > 0 and "+" or "") .. item.level
			end
		end
		if corner ~= "" then
			Ui.label(b, corner, 13, {
				AnchorPoint = Vector2.new(1, 1),
				Position = UDim2.new(1, -3, 1, -1),
				Size = UDim2.fromOffset(30, 14),
				TextXAlignment = Enum.TextXAlignment.Right,
				TextStrokeTransparency = 0.3,
				TextColor3 = corner == "?" and Ui.LOG.warn or Ui.C.text,
				ZIndex = 55,
			})
		end
	elseif hint then
		local img = Ui.image(b, {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.5),
			Size = UDim2.fromOffset(32, 32),
			ImageTransparency = 0.6,
			ZIndex = 54,
		})
		Ui.setItemIcon(img, hint)
	end
	return b
end

-- рюкзак. pick(item, equipped) вызывается по нажатию; filter оставляет только подходящие
function Hud:inventory(g, title, pick, filter)
	local win = Ui.window(self.gui, title or "Рюкзак", 360)
	local hero = g.hero
	local size = 56
	local top = Ui.new("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, size),
		LayoutOrder = win.next(),
		ZIndex = 52,
		Parent = win.frame,
	})
	Ui.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6), Parent = top })
	local function slot(parent, item, equipped, hint)
		local usable = item and (not filter or filter(item))
		local b = itemSlot(parent, g, item, size, function()
			if usable then
				win.close()
				pick(item, equipped)
			end
		end, hint)
		if item and not usable then
			b.BackgroundTransparency = 0.6
		end
	end
	slot(top, hero.weapon, true, Defs.ICON_WEAPON_SLOT)
	slot(top, hero.armor, true, Defs.ICON_ARMOR_SLOT)
	Ui.label(top, string.format("Золото: %d", hero.gold), 15, {
		Size = UDim2.new(1, -2 * (size + 6), 1, 0),
		TextColor3 = Ui.C.gold,
		TextXAlignment = Enum.TextXAlignment.Right,
		ZIndex = 53,
	})
	local grid = Ui.new("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 4 * (size + 6)),
		LayoutOrder = win.next(),
		ZIndex = 52,
		Parent = win.frame,
	})
	Ui.new("UIGridLayout", {
		CellSize = UDim2.fromOffset(size, size),
		CellPadding = UDim2.fromOffset(6, 6),
		SortOrder = Enum.SortOrder.LayoutOrder,
		Parent = grid,
	})
	for i = 1, g.BAG_SIZE do
		slot(grid, hero.bag[i], false)
	end
	win.buttons({ { "Закрыть", function() end } })
	return win
end

-- окно предмета с действиями
function Hud:itemWindow(g, item, equipped, onAction)
	local win = Ui.window(self.gui, nil, 380)
	local head = Ui.new("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 40),
		LayoutOrder = win.next(),
		ZIndex = 52,
		Parent = win.frame,
	})
	local img = Ui.image(head, { Size = UDim2.fromOffset(32, 32), Position = UDim2.fromOffset(0, 4), ZIndex = 53 })
	Ui.setItemIcon(img, g:itemIcon(item))
	local name = g:itemName(item)
	if item.qty > 1 then
		name = name .. " ×" .. item.qty
	end
	Ui.label(head, name, 18, {
		Position = UDim2.fromOffset(42, 0),
		Size = UDim2.new(1, -42, 1, 0),
		TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = Ui.LOG.high,
		TextWrapped = true,
		ZIndex = 53,
	})
	win.text(g:itemDesc(item))
	local buttons = {}
	for _, a in ipairs(g:itemActions(item, equipped)) do
		buttons[#buttons + 1] = { a.label, function()
			onAction(a.id)
		end }
	end
	buttons[#buttons + 1] = { "Закрыть", function() end }
	win.buttons(buttons)
	return win
end

function Hud:message(title, text, buttons, width)
	local win = Ui.window(self.gui, title, width or 420)
	if text then
		win.text(text)
	end
	win.buttons(buttons or { { "OK", function() end } })
	return win
end

return Hud
