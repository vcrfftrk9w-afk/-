-- The main menu (player chip, logo, side cards, modes and the play button) and the arsenal
-- sheet with every unit kind. Part of the interface; Ui puts it together.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Theme = require(script.Parent.Theme)
local Widgets = require(script.Parent.Widgets)

local make = Theme.make
local C = Theme.C
local font = Theme.font
local icon, iconButton, moltenButton = Widgets.icon, Widgets.iconButton, Widgets.moltenButton

local Menu = {}

-- ctx: { UI = the interface, refs = shared widget references, color = the player's team colour }
local ctx, refs

function Menu.build(context, root: Instance, player: Player): Frame
	ctx, refs = context, context.refs
	local UI = ctx.UI
	local menu = make("Frame", { Name = "Menu", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Parent = root })

	local topLeft = make("Frame", {
		Position = UDim2.fromOffset(16, 12),
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		BackgroundTransparency = 1,
		Parent = menu,
	}, { Theme.list(Enum.FillDirection.Horizontal, 8, nil, Enum.VerticalAlignment.Center) })
	iconButton("help", topLeft, function()
		UI.toast("Выбери свободную базу и командира — у каждого свой бонус. Экстракторы на светящихся месторождениях дают металл, электростанции — энергию. Построй казарму и завод, нажми на завод и заказывай войска. Захватывай стратегические точки войсками: точки, связанные с базой цепочкой твоих точек, снабжены — дают металл, рядом с ними можно строить. Инженеры чинят постройки, ремонтная станция — войска. Компьютер: ЛКМ — выбор, протяни ЛКМ — рамка, ПКМ — приказ, F — атака с ходу, X — стоп, H — держать, T — десант, Ctrl+1–9 — запомнить группу, 1–9 — выбрать её, WASD или край экрана — камера, пробел — к базе.", false, 16)
	end)
	iconButton("shield", topLeft, function()
		Menu.openArsenal()
	end)
	refs.musicButtons = refs.musicButtons or {}
	table.insert(refs.musicButtons, iconButton("music", topLeft, function()
		if UI.onMusic then
			UI.onMusic()
		end
	end))
	local pill = make("Frame", {
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		BackgroundColor3 = Color3.fromRGB(9, 13, 20),
		BackgroundTransparency = 0.28,
		Parent = topLeft,
	}, { Theme.corner(nil, 1), Theme.stroke(C.muted, 1, 0.6), Theme.pad(12, 7) })
	refs.serverPill = Theme.label({
		Text = "Подключение…",
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		TextSize = 13,
		TextColor3 = C.muted,
		FontFace = font(Enum.FontWeight.SemiBold),
		Parent = pill,
	})

	local chip = make("Frame", {
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -16, 0, 12),
		AutomaticSize = Enum.AutomaticSize.X,
		Size = UDim2.fromOffset(0, 46),
		BackgroundColor3 = Color3.fromRGB(9, 13, 20),
		BackgroundTransparency = 0.16,
		Parent = menu,
	}, {
		Theme.corner(nil, 1),
		Theme.stroke(),
		make("UIPadding", { PaddingLeft = UDim.new(0, 5), PaddingRight = UDim.new(0, 16) }),
		Theme.list(Enum.FillDirection.Horizontal, 10, nil, Enum.VerticalAlignment.Center),
	})
	local chipAvatar = Widgets.avatar(player.UserId, 36, { LayoutOrder = 1, Parent = chip })
	Theme.corner(nil, 1).Parent = chipAvatar
	local who = make("Frame", {
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		BackgroundTransparency = 1,
		LayoutOrder = 2,
		Parent = chip,
	}, { Theme.list(Enum.FillDirection.Vertical, 0) })
	Theme.label({ Text = player.DisplayName, AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = 16, FontFace = font(Enum.FontWeight.ExtraBold), Parent = who })
	Theme.label({ Text = "@" .. player.Name, AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = 12, TextColor3 = C.muted, Parent = who })

	-- logo
	refs.logoBox = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.new(0.5, 0, 0.36, 0),
		Size = UDim2.new(0.6, 0, 0, 150),
		BackgroundTransparency = 1,
		Parent = menu,
	})
	make("TextLabel", {
		Text = "TERRA FORGE",
		Size = UDim2.new(1, 0, 0, 112),
		BackgroundTransparency = 1,
		FontFace = font(Enum.FontWeight.Heavy),
		TextScaled = true,
		TextColor3 = Color3.new(1, 1, 1),
		Parent = refs.logoBox,
	}, {
		Theme.molten(90),
		make("UIStroke", { Color = Color3.fromRGB(78, 29, 6), Thickness = 4 }),
		make("UITextSizeConstraint", { MaxTextSize = 104 }),
	})
	Theme.label({
		Text = "СТРОЙ БАЗУ  ·  СОБИРАЙ АРМИЮ  ·  РАЗГРОМИ ВРАГОВ",
		Position = UDim2.fromOffset(0, 116),
		Size = UDim2.new(1, 0, 0, 22),
		TextSize = 16,
		FontFace = font(Enum.FontWeight.ExtraBold),
		TextColor3 = Color3.fromRGB(227, 207, 174),
		TextXAlignment = Enum.TextXAlignment.Center,
		Parent = refs.logoBox,
	})

	-- side cards
	refs.side = make("Frame", {
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -16, 0, 72),
		Size = UDim2.fromOffset(262, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1,
		Parent = menu,
	}, { Theme.list(Enum.FillDirection.Vertical, 10) })
	local ars = make("TextButton", {
		Text = "",
		AutoButtonColor = true,
		Size = UDim2.fromOffset(262, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Color3.fromRGB(14, 19, 30),
		BackgroundTransparency = 0.1,
		LayoutOrder = 1,
		Parent = refs.side,
	}, { Theme.corner(16), Theme.stroke(), Theme.pad(14, 12), Theme.list(Enum.FillDirection.Vertical, 4) })
	Theme.label({ Text = "АРСЕНАЛ", Size = UDim2.new(1, 0, 0, 20), TextSize = 16, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.moltenHi, LayoutOrder = 1, Parent = ars })
	Theme.label({ Text = "15 видов войск: пехота, техника, авиация, инженеры и десант.", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 13, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.Medium), LayoutOrder = 2, Parent = ars })
	local row = make("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, LayoutOrder = 3, Parent = ars }, { Theme.list(Enum.FillDirection.Horizontal, 6) })
	for _, k in { "infantry", "tank", "artillery", "gunship" } do
		local cell = make("Frame", { Size = UDim2.fromOffset(52, 44), BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.95, Parent = row }, { Theme.corner(10) })
		icon(k, 38, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), color = ctx.color, Parent = cell })
	end
	ars.Activated:Connect(function()
		Menu.openArsenal()
	end)
	local how = make("Frame", {
		Size = UDim2.fromOffset(262, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Color3.fromRGB(14, 19, 30),
		BackgroundTransparency = 0.1,
		LayoutOrder = 2,
		Parent = refs.side,
	}, { Theme.corner(16), Theme.stroke(), Theme.pad(14, 12), Theme.list(Enum.FillDirection.Vertical, 6) })
	Theme.label({ Text = "КАК ИГРАТЬ", Size = UDim2.new(1, 0, 0, 20), TextSize = 16, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.moltenHi, LayoutOrder = 0, Parent = how })
	for i, s in {
		"Выбери свободную базу и командира",
		"Ставь экстракторы на месторождения, строй электростанции и заводы",
		"Захватывай точки: они дают металл и место для стройки",
		"Выбери войска и нажми на карту. Разрушь командные центры врагов",
	} do
		local line = make("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, LayoutOrder = i, Parent = how }, {
			Theme.list(Enum.FillDirection.Horizontal, 8),
		})
		local badge = make("Frame", { Size = UDim2.fromOffset(22, 22), BackgroundColor3 = C.molten, BackgroundTransparency = 0.82, Parent = line }, { Theme.corner(7) })
		Theme.label({ Text = tostring(i), Size = UDim2.fromScale(1, 1), TextSize = 13, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.moltenHi, TextXAlignment = Enum.TextXAlignment.Center, Parent = badge })
		Theme.label({ Text = s, Size = UDim2.new(1, -30, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 13, FontFace = font(Enum.FontWeight.SemiBold), TextColor3 = Color3.fromRGB(214, 222, 235), Parent = line })
	end

	-- bottom: modes + play
	local bottom = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -14),
		Size = UDim2.new(1, -32, 0, 150),
		BackgroundColor3 = Color3.fromRGB(9, 13, 20),
		BackgroundTransparency = 0.18,
		Parent = menu,
	}, {
		Theme.corner(22),
		Theme.stroke(),
		Theme.pad(10),
		make("UISizeConstraint", { MaxSize = Vector2.new(1000, 150) }),
		Theme.list(Enum.FillDirection.Vertical, 10),
	})
	local modes = make("Frame", { Size = UDim2.new(1, 0, 0, 64), BackgroundTransparency = 1, LayoutOrder = 1, Parent = bottom }, {
		make("UIGridLayout", { CellSize = UDim2.new(0.5, -5, 1, 0), CellPadding = UDim2.fromOffset(10, 0), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	local function modeCard(title: string, active: boolean, order: number)
		local f = make("TextButton", {
			Text = "",
			AutoButtonColor = not active,
			BackgroundColor3 = if active then Color3.fromRGB(52, 36, 24) else C.panelHi,
			BackgroundTransparency = 0.06,
			LayoutOrder = order,
			Parent = modes,
		}, {
			Theme.corner(14),
			make("UIStroke", { Color = if active then C.molten else C.line, Transparency = if active then 0 else 0.78, Thickness = 1.5 }),
			Theme.pad(14, 9),
		})
		Theme.label({ Text = title, Size = UDim2.new(1, 0, 0, 24), TextSize = 19, FontFace = font(Enum.FontWeight.Heavy), Parent = f })
		make("Frame", { Position = UDim2.fromOffset(0, 32), Size = UDim2.fromOffset(8, 8), BackgroundColor3 = if active then C.ok else C.muted, Parent = f }, { Theme.corner(nil, 1) })
		local sub = Theme.label({ Position = UDim2.fromOffset(14, 26), Size = UDim2.new(1, -14, 0, 20), Text = "", TextSize = 13, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), TextTruncate = Enum.TextTruncate.AtEnd, Parent = f })
		return sub, f
	end
	refs.modeStatus = modeCard("СХВАТКА", true, 1)
	local world, worldCard = modeCard("КАРТА МИРА", false, 2)
	world.Text = "Скоро: бои за страны на карте Земли"
	worldCard.Activated:Connect(function()
		UI.toast("Карта мира скоро появится. А пока — схватка за базы!")
	end)
	local playBtn = moltenButton("ИГРАТЬ", bottom, function()
		if UI.onPlay then
			UI.onPlay()
		end
	end, "play")
	playBtn.Size = UDim2.new(1, 0, 0, 56)
	playBtn.LayoutOrder = 2
	refs.playBtn = playBtn
	return menu
end

---------------------------------------------------------------- arsenal

function Menu.buildArsenal(root: Instance)
	local overlay = make("TextButton", {
		Name = "Arsenal",
		Text = "",
		AutoButtonColor = false,
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Color3.fromRGB(5, 8, 13),
		BackgroundTransparency = 0.34,
		Visible = false,
		ZIndex = 20,
		Parent = root,
	})
	overlay.Activated:Connect(function()
		overlay.Visible = false
	end)
	local frame = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.new(1, -32, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Color3.fromRGB(15, 21, 32),
		Active = true,
		ZIndex = 21,
		Parent = overlay,
	}, {
		Theme.corner(22),
		Theme.stroke(),
		Theme.pad(20, 18),
		make("UISizeConstraint", { MaxSize = Vector2.new(880, 520) }),
	})
	local sheet = make("Frame", {
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1,
		ZIndex = 21,
		Parent = frame,
	}, { Theme.list(Enum.FillDirection.Vertical, 12) })
	Theme.label({ Text = "АРСЕНАЛ", Size = UDim2.new(1, -50, 0, 30), TextSize = 28, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.moltenHi, LayoutOrder = 1, ZIndex = 22, Parent = sheet })
	Theme.label({
		Text = "Каждый вид войск сразу видно на карте: танк выглядит как танк, самолёт как самолёт.",
		Size = UDim2.new(1, -50, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		TextWrapped = true,
		TextSize = 14,
		TextColor3 = C.muted,
		FontFace = font(Enum.FontWeight.SemiBold),
		LayoutOrder = 2,
		ZIndex = 22,
		Parent = sheet,
	})
	local close = iconButton("close", frame, function()
		overlay.Visible = false
	end)
	close.AnchorPoint = Vector2.new(1, 0)
	close.Position = UDim2.new(1, 0, 0, 0)
	close.ZIndex = 23
	local cards = make("ScrollingFrame", {
		Size = UDim2.new(1, 0, 0, 236),
		BackgroundTransparency = 1,
		ScrollingDirection = Enum.ScrollingDirection.X,
		AutomaticCanvasSize = Enum.AutomaticSize.X,
		CanvasSize = UDim2.fromOffset(0, 0),
		ScrollBarThickness = 4,
		LayoutOrder = 3,
		ZIndex = 22,
		Parent = sheet,
	}, { Theme.list(Enum.FillDirection.Horizontal, 10) })
	for _, kind in Config.UNIT_ORDER do
		local u = Config.UNITS[kind]
		local card = make("Frame", { Size = UDim2.fromOffset(156, 226), BackgroundColor3 = C.panelHi, ZIndex = 22, Parent = cards }, {
			Theme.corner(16),
			Theme.stroke(),
			Theme.pad(12),
			Theme.list(Enum.FillDirection.Vertical, 6),
		})
		local pic = make("Frame", { Size = UDim2.new(1, 0, 0, 84), BackgroundColor3 = Color3.fromRGB(22, 32, 51), ZIndex = 22, LayoutOrder = 1, Parent = card }, { Theme.corner(12) })
		icon(u.icon, 72, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), color = ctx.color, ZIndex = 23, Parent = pic })
		Theme.label({ Text = u.title, Size = UDim2.new(1, 0, 0, 20), TextSize = 16, FontFace = font(Enum.FontWeight.Heavy), LayoutOrder = 2, ZIndex = 22, Parent = card })
		Theme.label({ Text = u.desc, Size = UDim2.new(1, 0, 0, 52), TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, TextSize = 12.5, TextColor3 = Color3.fromRGB(200, 209, 223), FontFace = font(Enum.FontWeight.SemiBold), LayoutOrder = 3, ZIndex = 22, Parent = card })
		Theme.label({
			Text = if u.repairs then string.format("%d 🔩 · здоровье %d · ремонт %d", u.cost, u.hp, u.repairs)
				elseif u.carry then string.format("%d 🔩 · здоровье %d · десант %d", u.cost, u.hp, u.carry)
				elseif u.dps == 0 then string.format("%d 🔩 · здоровье %d · обзор %d", u.cost, u.hp, u.vision)
				else string.format("%d 🔩 · здоровье %d · урон %d", u.cost, u.hp, u.dps),
			Size = UDim2.new(1, 0, 0, 16),
			TextSize = 11.5,
			TextColor3 = C.moltenHi,
			FontFace = font(Enum.FontWeight.Bold),
			LayoutOrder = 4,
			ZIndex = 22,
			Parent = card,
		})
	end
	refs.arsenal = overlay
end

function Menu.openArsenal()
	refs.arsenal.Visible = true
end

---------------------------------------------------------------- updates

-- the side cards need a wide screen; w = width of the interface in its own units
function Menu.layout(w: number)
	if refs.side then
		refs.side.Visible = w >= 940
		refs.logoBox.Position = if refs.side.Visible then UDim2.new(0.42, 0, 0.36, 0) else UDim2.new(0.5, 0, 0.36, 0)
	end
end

function Menu.setLobby(info)
	local status
	if info.phase == "game" then
		local t = math.max(0, math.floor(info.timer))
		status = string.format("Идёт бой, осталось %d:%02d", t // 60, t % 60)
		if info.join > 0 then
			status ..= string.format(" · можно зайти ещё %d с", math.ceil(info.join))
		else
			status ..= " · можно смотреть"
		end
	elseif info.phase == "lobby" then
		status = string.format("Сбор игроков · бой через %d с · заходи", math.ceil(info.timer))
	elseif info.phase == "ended" then
		status = "Бой закончился · начни новый"
	else
		status = "Свободно · начни бой"
	end
	refs.modeStatus.Text = string.format("4 базы, боты · %s", status)
	refs.serverPill.Text = string.format("На сервере: %d · в бою: %d", info.players, info.inMatch)
end

return Menu
