-- Menu and match HUD, built in code. Designed on a 1000 x 540 canvas and scaled to the screen.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Theme = require(script.Parent.Theme)
local Sprites = require(script.Parent.Sprites)

local make = Theme.make
local C = Theme.C
local font = Theme.font

local UI = {}
UI.onPlay = nil
UI.onLeave = nil
UI.onZoom = nil
UI.onSelectKind = nil
UI.onClearSelection = nil
UI.onQueue = nil
UI.onCancel = nil
UI.onAuto = nil
UI.onRally = nil
UI.onBase = nil
UI.onBuildSelect = nil
UI.factoryId = nil
UI.buildSel = nil

-- unit kinds grouped for the army panel: infantry, vehicles, aircraft
local GROUPS = {
	inf = { kinds = { "infantry", "rocket" }, icon = "infantry", title = "Пехота" },
	veh = { kinds = { "scout", "tank", "artillery" }, icon = "tank", title = "Техника" },
	air = { kinds = { "fighter", "gunship" }, icon = "fighter", title = "Авиация" },
}
local GROUP_ORDER = { "inf", "veh", "air" }
UI.GROUPS = GROUPS

local gui, root, scale
local menu, play
local refs = {}
local myColor = Config.SEAT_COLORS[1]

---------------------------------------------------------------- small widgets

local function icon(name: string, size: number, props)
	props = props or {}
	local color = props.color
	props.color = nil
	props.BackgroundTransparency = 1
	props.Size = props.Size or UDim2.fromOffset(size, size)
	local img = make("ImageLabel", props)
	Sprites.apply(img, name, color)
	return img
end

local function iconButton(name: string, parent: Instance, onClick)
	local b = make("ImageButton", {
		Size = UDim2.fromOffset(44, 44),
		BackgroundColor3 = Color3.fromRGB(9, 13, 20),
		BackgroundTransparency = 0.16,
		AutoButtonColor = true,
		Parent = parent,
	}, {
		Theme.corner(nil, 1),
		Theme.stroke(),
	})
	icon(name, 24, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Parent = b })
	b.Activated:Connect(onClick)
	return b
end

local function moltenButton(text: string, parent: Instance, onClick, iconName: string?)
	local b = make("TextButton", {
		Text = "",
		AutoButtonColor = false,
		BackgroundColor3 = Color3.new(1, 1, 1),
		BorderSizePixel = 0,
		Parent = parent,
	}, {
		Theme.corner(14),
		Theme.molten(90),
		make("UIStroke", { Color = Color3.fromRGB(143, 54, 6), Thickness = 2, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }),
	})
	local row = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		BackgroundTransparency = 1,
		Parent = b,
	}, { Theme.list(Enum.FillDirection.Horizontal, 12, Enum.HorizontalAlignment.Center, Enum.VerticalAlignment.Center) })
	if iconName then
		icon(iconName, 22, { LayoutOrder = 1, Parent = row })
	end
	Theme.label({
		Text = text,
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		FontFace = font(Enum.FontWeight.Heavy),
		TextSize = 24,
		TextColor3 = C.moltenInk,
		LayoutOrder = 2,
		Parent = row,
	})
	b.Activated:Connect(function()
		onClick()
	end)
	b.MouseButton1Down:Connect(function()
		TweenService:Create(row, TweenInfo.new(0.06), { Position = UDim2.new(0.5, 0, 0.5, 3) }):Play()
	end)
	b.MouseButton1Up:Connect(function()
		TweenService:Create(row, TweenInfo.new(0.08), { Position = UDim2.fromScale(0.5, 0.5) }):Play()
	end)
	return b
end

local function avatarImage(userId: number, size: number, props)
	props = props or {}
	props.Size = UDim2.fromOffset(size, size)
	props.BackgroundColor3 = Color3.fromRGB(124, 31, 82)
	if userId > 0 then
		props.Image = "rbxthumb://type=AvatarHeadShot&id=" .. userId .. "&w=150&h=150"
	end
	local img = make("ImageLabel", props)
	return img
end

---------------------------------------------------------------- scaling

local function rescale()
	local vp = gui.AbsoluteSize
	if vp.X < 2 or vp.Y < 2 then
		return
	end
	local s = math.clamp(math.min(vp.X / 1000, vp.Y / 540), 0.55, 1.3)
	scale.Scale = s
	root.Size = UDim2.fromScale(1 / s, 1 / s)
	local w = vp.X / s
	if refs.side then
		refs.side.Visible = w >= 940
		refs.logoBox.Position = if refs.side.Visible then UDim2.new(0.42, 0, 0.36, 0) else UDim2.new(0.5, 0, 0.36, 0)
	end
	if refs.buildScroll then
		local avail = w - 2 * 16 - 210 - 60 - 24
		refs.buildScroll.Size = UDim2.fromOffset(math.clamp(avail, 220, 572), 98)
	end
end

---------------------------------------------------------------- menu

local function buildMenu(player: Player)
	menu = make("Frame", { Name = "Menu", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Parent = root })

	local topLeft = make("Frame", {
		Position = UDim2.fromOffset(16, 12),
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		BackgroundTransparency = 1,
		Parent = menu,
	}, { Theme.list(Enum.FillDirection.Horizontal, 8, nil, Enum.VerticalAlignment.Center) })
	iconButton("help", topLeft, function()
		UI.toast("1. Поставь экстракторы на светящиеся месторождения — это деньги. 2. Построй казарму и завод бронетехники. 3. Нажми на завод и заказывай войска. 4. Выбери войска и нажми на карту: они поедут туда и будут стрелять сами. Разрушь командные центры врагов.", false, 9)
	end)
	iconButton("shield", topLeft, function()
		UI.openArsenal()
	end)
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
	local chipAvatar = avatarImage(player.UserId, 36, { LayoutOrder = 1, Parent = chip })
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
	Theme.label({ Text = "7 видов войск: пехота, техника и авиация.", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 13, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.Medium), LayoutOrder = 2, Parent = ars })
	local row = make("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, LayoutOrder = 3, Parent = ars }, { Theme.list(Enum.FillDirection.Horizontal, 6) })
	for _, k in { "infantry", "tank", "artillery", "gunship" } do
		local cell = make("Frame", { Size = UDim2.fromOffset(52, 44), BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.95, Parent = row }, { Theme.corner(10) })
		icon(k, 38, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), color = myColor, Parent = cell })
	end
	ars.Activated:Connect(function()
		UI.openArsenal()
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
	for i, s in { "Ставь экстракторы на светящиеся месторождения — это деньги", "Строй казарму, завод бронетехники и аэродром", "Нажми на завод и заказывай войска", "Выбери войска и нажми на карту. Разрушь командные центры врагов" } do
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
end

---------------------------------------------------------------- arsenal

local function buildArsenal()
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
		icon(u.icon, 72, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), color = myColor, ZIndex = 23, Parent = pic })
		Theme.label({ Text = u.title, Size = UDim2.new(1, 0, 0, 20), TextSize = 16, FontFace = font(Enum.FontWeight.Heavy), LayoutOrder = 2, ZIndex = 22, Parent = card })
		Theme.label({ Text = u.desc, Size = UDim2.new(1, 0, 0, 52), TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, TextSize = 12.5, TextColor3 = Color3.fromRGB(200, 209, 223), FontFace = font(Enum.FontWeight.SemiBold), LayoutOrder = 3, ZIndex = 22, Parent = card })
		Theme.label({
			Text = string.format("%d $ · здоровье %d · урон %d", u.cost, u.hp, u.dps),
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

function UI.openArsenal()
	refs.arsenal.Visible = true
end

---------------------------------------------------------------- match HUD

local function resChip(parent: Instance, key: string, order: number)
	local f = make("Frame", {
		AutomaticSize = Enum.AutomaticSize.X,
		Size = UDim2.fromOffset(0, 38),
		BackgroundColor3 = Color3.new(1, 1, 1),
		BackgroundTransparency = 0.96,
		LayoutOrder = order,
		Parent = parent,
	}, {
		Theme.corner(10),
		make("UIPadding", { PaddingLeft = UDim.new(0, 5), PaddingRight = UDim.new(0, 9) }),
		Theme.list(Enum.FillDirection.Horizontal, 6, nil, Enum.VerticalAlignment.Center),
	})
	local img = icon(key, 20, { LayoutOrder = 1, color = myColor, Parent = f })
	local col = make("Frame", { AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), BackgroundTransparency = 1, LayoutOrder = 2, Parent = f }, {
		Theme.list(Enum.FillDirection.Vertical, -1),
	})
	local value = Theme.label({ Text = "0", AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = 15, FontFace = font(Enum.FontWeight.ExtraBold), Parent = col })
	local rate = Theme.label({ Text = "", AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = 11, TextColor3 = C.ok, FontFace = font(Enum.FontWeight.Bold), Parent = col })
	return { value = value, rate = rate, icon = img }
end

local function costRow(cost: number, parent: Instance, size: number)
	local row = make("Frame", { AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), BackgroundTransparency = 1, Parent = parent }, {
		Theme.list(Enum.FillDirection.Horizontal, 3, Enum.HorizontalAlignment.Center, Enum.VerticalAlignment.Center),
	})
	icon("money", size + 1, { LayoutOrder = 1, Parent = row })
	local label = Theme.label({ Text = tostring(cost), AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = size + 1, FontFace = font(Enum.FontWeight.Bold), TextColor3 = Color3.fromRGB(255, 226, 150), LayoutOrder = 2, Parent = row })
	return row, label
end

local function buildPlay()
	play = make("Frame", { Name = "Play", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = false, Parent = root })

	-- banner (spectator, results, defeat)
	local banner = Theme.panel({
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 10),
		Size = UDim2.new(1, -32, 0, 86),
		BackgroundColor3 = Color3.fromRGB(16, 21, 34),
		BackgroundTransparency = 0.04,
		ZIndex = 5,
		Parent = play,
	})
	make("UISizeConstraint", { MaxSize = Vector2.new(780, 400) }).Parent = banner
	Theme.pad(20, 10).Parent = banner
	refs.bnTitle = Theme.label({ Text = "", Size = UDim2.new(1, -170, 0, 26), TextSize = 22, FontFace = font(Enum.FontWeight.Heavy), ZIndex = 5, Parent = banner })
	refs.bnSub = Theme.label({ Text = "", Position = UDim2.fromOffset(0, 27), Size = UDim2.new(1, -170, 0, 20), TextSize = 15, TextColor3 = Color3.fromRGB(210, 218, 231), FontFace = font(Enum.FontWeight.SemiBold), TextTruncate = Enum.TextTruncate.AtEnd, ZIndex = 5, Parent = banner })
	refs.bnCount = Theme.label({ Text = "", Position = UDim2.fromOffset(0, 48), Size = UDim2.new(1, -170, 0, 18), TextSize = 14, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), TextTruncate = Enum.TextTruncate.AtEnd, ZIndex = 5, Parent = banner })
	local bnBtn = moltenButton("В МЕНЮ", banner, function()
		if UI.onLeave then
			UI.onLeave()
		end
	end)
	bnBtn.AnchorPoint = Vector2.new(1, 0.5)
	bnBtn.Position = UDim2.new(1, 0, 0.5, 0)
	bnBtn.Size = UDim2.fromOffset(150, 48)
	bnBtn.ZIndex = 6
	bnBtn.Visible = false
	refs.bnBtn = bnBtn
	refs.banner = banner

	-- top HUD
	local hudTop = make("Frame", { Name = "HudTop", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = false, Parent = play })
	refs.hudTop = hudTop
	local me = Theme.panel({ Position = UDim2.fromOffset(16, 12), Size = UDim2.fromOffset(236, 62), Parent = hudTop })
	refs.meAvatar = avatarImage(0, 46, { Position = UDim2.fromOffset(8, 8), Parent = me })
	Theme.corner(12).Parent = refs.meAvatar
	refs.meStroke = make("UIStroke", { Color = Theme.hex(myColor), Thickness = 2, Parent = refs.meAvatar })
	refs.meName = Theme.label({ Text = "", Position = UDim2.fromOffset(62, 7), Size = UDim2.new(1, -70, 0, 20), TextSize = 16, FontFace = font(Enum.FontWeight.ExtraBold), TextTruncate = Enum.TextTruncate.AtEnd, Parent = me })
	refs.meStats = Theme.label({ Text = "", Position = UDim2.fromOffset(62, 27), Size = UDim2.new(1, -70, 0, 14), TextSize = 12, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), Parent = me })
	local army = make("Frame", { Position = UDim2.fromOffset(62, 42), Size = UDim2.new(1, -70, 0, 16), BackgroundTransparency = 1, Parent = me }, {
		Theme.list(Enum.FillDirection.Horizontal, 3, nil, Enum.VerticalAlignment.Center),
	})
	refs.army = {}
	refs.armyIcons = {}
	for i, g in GROUP_ORDER do
		local img = icon(GROUPS[g].icon, 16, { LayoutOrder = i * 2 - 1, color = myColor, Parent = army })
		refs.armyIcons[g] = img
		refs.army[g] = Theme.label({ Text = "0", AutomaticSize = Enum.AutomaticSize.X, Size = UDim2.fromOffset(0, 16), TextSize = 12, FontFace = font(Enum.FontWeight.Bold), LayoutOrder = i * 2, Parent = army })
	end

	local res = Theme.panel({
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 12),
		AutomaticSize = Enum.AutomaticSize.X,
		Size = UDim2.fromOffset(0, 50),
		Parent = hudTop,
	})
	Theme.pad(6).Parent = res
	Theme.list(Enum.FillDirection.Horizontal, 4, nil, Enum.VerticalAlignment.Center).Parent = res
	refs.res = {
		pop = resChip(res, "pop", 1),
		money = resChip(res, "money", 2),
	}

	local right = make("Frame", {
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -16, 0, 12),
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		BackgroundTransparency = 1,
		Parent = hudTop,
	}, { Theme.list(Enum.FillDirection.Horizontal, 8) })
	-- back to the command centre
	local baseBtn = iconButton("castle", right, function()
		if UI.onBase then
			UI.onBase()
		end
	end)
	baseBtn.LayoutOrder = -1
	refs.baseIcon = baseBtn:FindFirstChildOfClass("ImageLabel")
	if refs.baseIcon then
		Sprites.apply(refs.baseIcon, "castle", myColor)
	end
	iconButton("trophy", right, function()
		refs.lb.Visible = not refs.lb.Visible
	end)
	iconButton("exit", right, function()
		if UI.onLeave then
			UI.onLeave()
		end
	end)

	local lb = Theme.panel({
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -16, 0, 66),
		Size = UDim2.fromOffset(240, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Parent = hudTop,
	})
	Theme.pad(12, 10).Parent = lb
	Theme.list(Enum.FillDirection.Vertical, 3).Parent = lb
	Theme.label({ Text = "ЛИДЕРЫ", Size = UDim2.new(1, 0, 0, 18), TextSize = 13, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.muted, LayoutOrder = 0, Parent = lb })
	refs.lbRows = {}
	for i = 1, 7 do
		local rowF = make("Frame", { Size = UDim2.new(1, 0, 0, 22), BackgroundColor3 = Theme.hex(myColor), BackgroundTransparency = 1, LayoutOrder = i, Parent = lb }, { Theme.corner(7) })
		local place = Theme.label({ Text = "", Position = UDim2.fromOffset(4, 0), Size = UDim2.fromOffset(20, 22), TextSize = 12, TextColor3 = C.muted, Parent = rowF })
		local sw = make("Frame", { Position = UDim2.fromOffset(26, 5), Size = UDim2.fromOffset(12, 12), Parent = rowF }, { Theme.corner(4) })
		local name = Theme.label({ Text = "", Position = UDim2.fromOffset(44, 0), Size = UDim2.new(1, -98, 0, 22), TextSize = 13, FontFace = font(Enum.FontWeight.SemiBold), TextTruncate = Enum.TextTruncate.AtEnd, Parent = rowF })
		local share = Theme.label({ Text = "", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -6, 0, 0), Size = UDim2.fromOffset(50, 22), TextSize = 13, FontFace = font(Enum.FontWeight.ExtraBold), TextXAlignment = Enum.TextXAlignment.Right, Parent = rowF })
		refs.lbRows[i] = { frame = rowF, place = place, sw = sw, name = name, share = share }
	end
	refs.lb = lb

	-- bottom HUD
	local hudBottom = make("Frame", { Name = "HudBottom", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = false, Parent = play })
	refs.hudBottom = hudBottom

	-- army: select units by kind, then tap the map to send them
	local armyPanel = Theme.panel({ AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 16, 1, -12), Size = UDim2.fromOffset(210, 98), Parent = hudBottom })
	Theme.pad(10, 8).Parent = armyPanel
	Theme.label({ Text = "Армия", Size = UDim2.new(1, -40, 0, 16), TextSize = 14, FontFace = font(Enum.FontWeight.ExtraBold), Parent = armyPanel })
	local clear = make("TextButton", {
		Text = "Снять",
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, 0, 0, -2),
		Size = UDim2.fromOffset(54, 20),
		FontFace = font(Enum.FontWeight.Bold),
		TextSize = 12,
		TextColor3 = C.ink,
		BackgroundColor3 = C.panelHi,
		Visible = false,
		Parent = armyPanel,
	}, { Theme.corner(7) })
	clear.Activated:Connect(function()
		if UI.onClearSelection then
			UI.onClearSelection()
		end
	end)
	refs.armyClear = clear
	local kinds = make("Frame", { Position = UDim2.fromOffset(0, 20), Size = UDim2.new(1, 0, 0, 32), BackgroundTransparency = 1, Parent = armyPanel }, {
		make("UIGridLayout", { CellSize = UDim2.new(0.25, -4, 1, 0), CellPadding = UDim2.fromOffset(5, 0), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	refs.armyBtns = {}
	refs.armyBtnIcons = {}
	for i, k in { "inf", "veh", "air", "all" } do
		local b = make("TextButton", { Text = "", AutoButtonColor = true, BackgroundColor3 = C.panelHi, LayoutOrder = i, Parent = kinds }, {
			Theme.corner(9),
			make("UIStroke", { Color = Color3.fromRGB(120, 255, 170), Thickness = 1.5, Transparency = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }),
		})
		local count
		if k == "all" then
			count = Theme.label({ Text = "ВСЕ", Size = UDim2.fromScale(1, 1), TextSize = 12, FontFace = font(Enum.FontWeight.Heavy), TextXAlignment = Enum.TextXAlignment.Center, Parent = b })
		else
			refs.armyBtnIcons[k] = icon(GROUPS[k].icon, 22, { Position = UDim2.fromOffset(2, 5), color = myColor, Parent = b })
			count = Theme.label({ Text = "0", Position = UDim2.fromOffset(25, 0), Size = UDim2.new(1, -27, 1, 0), TextSize = 12, FontFace = font(Enum.FontWeight.ExtraBold), Parent = b })
		end
		b.Activated:Connect(function()
			if UI.onSelectKind then
				UI.onSelectKind(k)
			end
		end)
		refs.armyBtns[k] = { button = b, count = count, stroke = b:FindFirstChildOfClass("UIStroke") }
	end
	refs.armyInfo = Theme.label({ Text = "Нажми на юнит или кнопку", Position = UDim2.fromOffset(0, 58), Size = UDim2.new(1, 0, 0, 24), TextSize = 11.5, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, Parent = armyPanel })

	local buildScroll = make("ScrollingFrame", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -12),
		Size = UDim2.fromOffset(572, 98),
		BackgroundColor3 = C.panel,
		BackgroundTransparency = 0.08,
		BorderSizePixel = 0,
		ScrollingDirection = Enum.ScrollingDirection.X,
		AutomaticCanvasSize = Enum.AutomaticSize.X,
		CanvasSize = UDim2.fromOffset(0, 0),
		ScrollBarThickness = 0,
		Active = true,
		Parent = hudBottom,
	}, { Theme.corner(18), Theme.stroke(), Theme.pad(6), Theme.list(Enum.FillDirection.Horizontal, 6) })
	refs.buildScroll = buildScroll
	refs.buildBtns = {}
	for i, k in Config.BUILD_ORDER do
		local def = Config.BUILD[k]
		local b = make("TextButton", {
			Text = "",
			AutoButtonColor = false,
			Size = UDim2.fromOffset(74, 86),
			BackgroundColor3 = Color3.new(1, 1, 1),
			BackgroundTransparency = 0.955,
			LayoutOrder = i,
			Parent = buildScroll,
		}, { Theme.corner(12), make("UIStroke", { Color = C.molten, Thickness = 1.5, Transparency = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }) })
		local img = icon(def.icon, 38, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 4), color = myColor, Parent = b })
		Theme.label({
			Text = def.name,
			AnchorPoint = Vector2.new(0.5, 0),
			Position = UDim2.new(0.5, 0, 0, 43),
			Size = UDim2.new(1, -4, 0, 24),
			TextSize = 11,
			TextWrapped = true,
			TextXAlignment = Enum.TextXAlignment.Center,
			TextYAlignment = Enum.TextYAlignment.Center,
			FontFace = font(Enum.FontWeight.Bold),
			Parent = b,
		})
		local row, costLabel = costRow(def.cost, b, 11)
		row.AnchorPoint = Vector2.new(0.5, 1)
		row.Position = UDim2.new(0.5, 0, 1, -4)
		b.Activated:Connect(function()
			UI.selectBuild(if UI.buildSel == k then nil else k)
		end)
		b.MouseEnter:Connect(function()
			UI.showTip(k)
		end)
		b.MouseLeave:Connect(function()
			UI.showTip(UI.buildSel)
		end)
		refs.buildBtns[k] = { button = b, icon = img, cost = costLabel, stroke = b:FindFirstChildOfClass("UIStroke") }
	end

	local zoom = make("Frame", {
		AnchorPoint = Vector2.new(1, 1),
		Position = UDim2.new(1, -16, 1, -12),
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		BackgroundTransparency = 1,
		Parent = play,
	}, { Theme.list(Enum.FillDirection.Vertical, 8) })
	iconButton("plus", zoom, function()
		if UI.onZoom then
			UI.onZoom(1.6)
		end
	end)
	iconButton("minus", zoom, function()
		if UI.onZoom then
			UI.onZoom(1 / 1.6)
		end
	end)

	-- minimap: the whole battlefield; tap or drag on it to move the camera
	local miniBack = make("Frame", {
		AnchorPoint = Vector2.new(1, 1),
		Position = UDim2.new(1, -16, 1, -118),
		Size = UDim2.fromOffset(176, 117),
		BackgroundColor3 = Color3.fromRGB(9, 13, 20),
		BackgroundTransparency = 0.12,
		Parent = play,
	}, { Theme.corner(12), Theme.stroke() })
	UI.minimap = make("TextButton", {
		Name = "Minimap",
		Text = "",
		AutoButtonColor = false,
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(168, 108),
		BackgroundColor3 = Color3.fromRGB(62, 96, 46),
		ClipsDescendants = true,
		Parent = miniBack,
	}, { Theme.corner(7) })

	-- factory panel: a row per unit kind (+1 to order, «Авто» to repeat), queue, rally point
	local fac = Theme.panel({
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -120),
		Size = UDim2.fromOffset(420, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Color3.fromRGB(16, 21, 34),
		BackgroundTransparency = 0.02,
		Visible = false,
		ZIndex = 8,
		Parent = play,
	})
	Theme.pad(14, 12).Parent = fac
	local facClose = iconButton("close", fac, function()
		UI.hideFactory()
	end)
	facClose.AnchorPoint = Vector2.new(1, 0)
	facClose.Position = UDim2.new(1, 0, 0, -2)
	facClose.Size = UDim2.fromOffset(36, 36)
	facClose.ZIndex = 10
	local body = make("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, ZIndex = 9, Parent = fac }, {
		Theme.list(Enum.FillDirection.Vertical, 8),
	})
	refs.facTitle = Theme.label({ Text = "", Size = UDim2.new(1, -50, 0, 22), TextSize = 18, FontFace = font(Enum.FontWeight.Heavy), ZIndex = 9, LayoutOrder = 1, Parent = body })
	refs.facSub = Theme.label({ Text = "", Size = UDim2.new(1, -50, 0, 16), TextSize = 12.5, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), ZIndex = 9, LayoutOrder = 2, Parent = body })
	refs.facRows = make("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, ZIndex = 9, LayoutOrder = 3, Parent = body }, {
		Theme.list(Enum.FillDirection.Vertical, 6),
	})
	local barBg = make("Frame", { Size = UDim2.new(1, 0, 0, 8), BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.9, ZIndex = 9, LayoutOrder = 4, Parent = body }, { Theme.corner(nil, 1) })
	refs.facBar = make("Frame", { Size = UDim2.fromScale(0, 1), BackgroundColor3 = C.molten, ZIndex = 10, Parent = barBg }, { Theme.corner(nil, 1) })
	refs.facQueue = Theme.label({ Text = "", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 13, FontFace = font(Enum.FontWeight.Bold), ZIndex = 9, LayoutOrder = 5, Parent = body })
	local buttons = make("Frame", { Size = UDim2.new(1, 0, 0, 36), BackgroundTransparency = 1, ZIndex = 9, LayoutOrder = 6, Parent = body }, {
		make("UIGridLayout", { CellSize = UDim2.new(0.5, -4, 1, 0), CellPadding = UDim2.fromOffset(8, 0), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	local cancel = make("TextButton", { Text = "Отменить последний", AutoButtonColor = true, FontFace = font(Enum.FontWeight.Bold), TextSize = 13, TextColor3 = C.ink, BackgroundColor3 = C.panelHi, LayoutOrder = 1, ZIndex = 10, Parent = buttons }, { Theme.corner(10) })
	cancel.Activated:Connect(function()
		if UI.onCancel and UI.factoryId then
			UI.onCancel(UI.factoryId)
		end
	end)
	local rally = make("TextButton", { Text = "", AutoButtonColor = true, BackgroundColor3 = C.panelHi, LayoutOrder = 2, ZIndex = 10, Parent = buttons }, { Theme.corner(10) })
	icon("flag", 20, { Position = UDim2.new(0, 10, 0.5, -10), ZIndex = 11, Parent = rally })
	Theme.label({ Text = "Точка сбора", Position = UDim2.fromOffset(36, 0), Size = UDim2.new(1, -40, 1, 0), TextSize = 13, FontFace = font(Enum.FontWeight.Bold), ZIndex = 11, Parent = rally })
	rally.Activated:Connect(function()
		if UI.onRally and UI.factoryId then
			UI.onRally(UI.factoryId)
		end
	end)
	refs.facNote = Theme.label({ Text = "", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 12, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), ZIndex = 9, LayoutOrder = 7, Parent = body })
	refs.fac = fac

	local tip = Theme.panel({
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -120),
		Size = UDim2.fromOffset(370, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Active = false,
		Visible = false,
		Parent = play,
	})
	Theme.pad(14, 12).Parent = tip
	Theme.list(Enum.FillDirection.Vertical, 6).Parent = tip
	refs.tipTitle = Theme.label({ Text = "", Size = UDim2.new(1, 0, 0, 20), TextSize = 16, FontFace = font(Enum.FontWeight.Heavy), LayoutOrder = 1, Parent = tip })
	refs.tipDesc = Theme.label({ Text = "", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 13, TextColor3 = Color3.fromRGB(207, 215, 228), FontFace = font(Enum.FontWeight.SemiBold), LayoutOrder = 2, Parent = tip })
	refs.tipOut = Theme.label({ Text = "", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 13, TextColor3 = Color3.fromRGB(207, 215, 228), FontFace = font(Enum.FontWeight.SemiBold), LayoutOrder = 3, Parent = tip })
	refs.tipCost = Theme.label({ Text = "", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 13, FontFace = font(Enum.FontWeight.ExtraBold), LayoutOrder = 4, Parent = tip })
	refs.tipHint = Theme.label({ Text = "Нажми на карту рядом со своей базой, чтобы поставить. Нажми на кнопку ещё раз, чтобы отменить.", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 13, TextColor3 = C.moltenHi, FontFace = font(Enum.FontWeight.Bold), LayoutOrder = 5, Parent = tip })
	refs.tip = tip

	-- big announcement
	local announce = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.45), Size = UDim2.new(0.9, 0, 0, 130), BackgroundTransparency = 1, Visible = false, Parent = play })
	refs.annTitle = make("TextLabel", {
		Text = "",
		Size = UDim2.new(1, 0, 0, 84),
		BackgroundTransparency = 1,
		FontFace = font(Enum.FontWeight.Heavy),
		TextScaled = true,
		TextColor3 = Color3.new(1, 1, 1),
		Parent = announce,
	}, { Theme.molten(90), make("UIStroke", { Color = Color3.fromRGB(78, 29, 6), Thickness = 4 }), make("UITextSizeConstraint", { MaxTextSize = 76 }) })
	refs.annSub = Theme.label({ Text = "", Position = UDim2.fromOffset(0, 90), Size = UDim2.new(1, 0, 0, 24), TextSize = 18, TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = Color3.fromRGB(242, 230, 210), TextStrokeTransparency = 0.4, Parent = announce })
	refs.announce = announce
end

---------------------------------------------------------------- toast

local toastToken = 0
local function buildToast()
	local t = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 82),
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		BackgroundColor3 = Color3.fromRGB(16, 21, 34),
		BackgroundTransparency = 0.04,
		Visible = false,
		ZIndex = 30,
		Parent = root,
	}, { Theme.corner(14), Theme.pad(16, 10), make("UISizeConstraint", { MaxSize = Vector2.new(480, 200) }) })
	refs.toastStroke = Theme.stroke(C.line, 1, 0.7)
	refs.toastStroke.Parent = t
	refs.toastText = Theme.label({
		Text = "",
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		TextSize = 14,
		TextWrapped = true,
		TextXAlignment = Enum.TextXAlignment.Center,
		FontFace = font(Enum.FontWeight.Bold),
		ZIndex = 31,
		Parent = t,
	}, { make("UISizeConstraint", { MaxSize = Vector2.new(448, 200) }) })
	refs.toast = t
end

function UI.toast(text: string, warn: boolean?, seconds: number?)
	toastToken += 1
	local my = toastToken
	refs.toastText.Text = text
	refs.toastStroke.Color = if warn then C.bad else C.line
	refs.toastStroke.Transparency = if warn then 0.4 else 0.7
	refs.toast.Visible = true
	task.delay(seconds or 2.8, function()
		if toastToken == my then
			refs.toast.Visible = false
		end
	end)
end

---------------------------------------------------------------- public API

function UI.init(playerGui: PlayerGui, player: Player)
	gui = make("ScreenGui", {
		Name = "TerraForgeUI",
		ResetOnSpawn = false,
		DisplayOrder = 5,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	})
	root = make("Frame", { Name = "Root", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Parent = gui })
	scale = make("UIScale", { Parent = root })
	buildMenu(player)
	buildPlay()
	buildArsenal()
	buildToast()
	refs.meName.Text = player.DisplayName
	refs.meAvatar.Image = if player.UserId > 0 then "rbxthumb://type=AvatarHeadShot&id=" .. player.UserId .. "&w=150&h=150" else ""
	gui.Parent = playerGui
	gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(rescale)
	rescale()
end

function UI.showMenu()
	menu.Visible = true
	play.Visible = false
	UI.selectBuild(nil)
end

-- spectator: watch the match without HUD controls
function UI.showPlay(phase: string, spectator: boolean)
	menu.Visible = false
	play.Visible = true
	refs.announce.Visible = false
	UI.setPhase(phase, spectator)
end

function UI.setPhase(phase: string, spectator: boolean)
	local inGame = phase == "game" and not spectator
	if not inGame then
		UI.hideFactory()
	end
	refs.hudTop.Visible = inGame
	refs.hudBottom.Visible = inGame
	refs.banner.Visible = spectator or phase == "ended"
	refs.bnBtn.Visible = spectator or phase == "ended"
	if spectator and phase ~= "ended" then
		refs.bnTitle.Text = "ТЫ ЗРИТЕЛЬ"
		refs.bnSub.Text = "Все базы заняты. Следующий бой начнётся, когда этот закончится."
		refs.bnCount.Text = "Карту можно двигать и приближать."
	end
	if not inGame then
		UI.selectBuild(nil)
	end
	refs.lb.Visible = inGame
end

function UI.setMyColor(hex: string)
	if hex == myColor then
		return
	end
	myColor = hex
	refs.meStroke.Color = Theme.hex(hex)
	Sprites.apply(refs.res.pop.icon, "pop", hex)
	if refs.baseIcon then
		Sprites.apply(refs.baseIcon, "castle", hex)
	end
	for k, b in refs.buildBtns do
		Sprites.apply(b.icon, Config.BUILD[k].icon, hex)
	end
	for g, img in refs.armyIcons do
		Sprites.apply(img, GROUPS[g].icon, hex)
	end
	for g, img in refs.armyBtnIcons do
		Sprites.apply(img, GROUPS[g].icon, hex)
	end
	for _, row in refs.lbRows do
		row.frame.BackgroundColor3 = Theme.hex(hex)
	end
end

function UI.results(msg, myId: number)
	refs.banner.Visible = true
	refs.bnBtn.Visible = true
	refs.hudBottom.Visible = false
	local won = msg.winner ~= 0 and msg.winner == myId
	refs.bnTitle.Text = if won then "ПОБЕДА!" else "МАТЧ ОКОНЧЕН"
	local lead = ""
	if msg.winnerName ~= "" then
		lead = "Первое место: «" .. msg.winnerName .. "»"
	end
	refs.bnSub.Text = lead
	local parts = {}
	for i, row in msg.top do
		if i > 3 then
			break
		end
		table.insert(parts, string.format("%d. %s %d%%", i, row.name, math.floor(row.share * 100 + 0.5)))
	end
	refs.bnCount.Text = table.concat(parts, "   ")
	UI.announce(if won then "ПОБЕДА!" else "МАТЧ ОКОНЧЕН", lead)
end

function UI.defeat()
	refs.banner.Visible = true
	refs.bnBtn.Visible = true
	refs.hudBottom.Visible = false
	refs.bnTitle.Text = "ТВОЮ БАЗУ РАЗГРОМИЛИ"
	refs.bnSub.Text = "Можно досмотреть матч или вернуться в меню."
	refs.bnCount.Text = ""
	UI.selectBuild(nil)
end

local announceToken = 0
function UI.announce(title: string, sub: string)
	announceToken += 1
	local my = announceToken
	refs.annTitle.Text = title
	refs.annSub.Text = sub
	refs.announce.Visible = true
	refs.announce.Size = UDim2.new(0.6, 0, 0, 100)
	TweenService:Create(refs.announce, TweenInfo.new(0.35, Enum.EasingStyle.Back), { Size = UDim2.new(0.9, 0, 0, 130) }):Play()
	task.delay(2.4, function()
		if announceToken == my then
			refs.announce.Visible = false
		end
	end)
end

function UI.setLobby(info)
	local status
	if info.phase == "game" then
		local t = math.max(0, math.floor(info.timer))
		status = string.format("Идёт бой, осталось %d:%02d", t // 60, t % 60)
		if info.join > 0 then
			status ..= string.format(" · можно зайти ещё %d с", math.ceil(info.join))
		else
			status ..= " · можно смотреть"
		end
	elseif info.phase == "ended" then
		status = "Бой закончился · начни новый"
	else
		status = "Свободно · начни бой"
	end
	refs.modeStatus.Text = string.format("4 базы, боты · %s", status)
	refs.serverPill.Text = string.format("На сервере: %d · в бою: %d", info.players, info.inMatch)
end

function UI.setEconomy(eco)
	refs.res.pop.value.Text = string.format("%d/%d", eco.units or 0, Config.MAX_UNITS_PER_NATION)
	refs.res.pop.rate.Text = "юниты"
	refs.res.pop.rate.TextColor3 = C.muted
	refs.res.money.value.Text = tostring(eco.money) .. " $"
	refs.res.money.rate.Text = string.format("+%d/с", math.floor(eco.income + 0.5))
	refs.res.money.rate.TextColor3 = C.ok
	for g, group in GROUPS do
		local total = 0
		for _, kind in group.kinds do
			total += eco.army[kind] or 0
		end
		refs.army[g].Text = tostring(total)
	end
	for k, b in refs.buildBtns do
		local poor = eco.money < Config.BUILD[k].cost
		b.cost.TextColor3 = if poor then C.bad else Color3.fromRGB(255, 226, 150)
		Sprites.setTransparency(b.icon, if poor then 0.5 else 0)
	end
	refs.money = eco.money
end

function UI.setMe(text: string)
	refs.meStats.Text = text
end

-- rows: list of { place, name, color, value (text), isMe }
function UI.setLeaderboard(rows)
	for i, r in refs.lbRows do
		local data = rows[i]
		r.frame.Visible = data ~= nil
		if data then
			r.place.Text = tostring(data.place)
			r.sw.BackgroundColor3 = Theme.hex(data.color)
			r.name.Text = data.name
			r.share.Text = data.value
			r.frame.BackgroundTransparency = if data.isMe then 0.84 else 1
		end
	end
end

-- counts / selected: units of each group the player has and has selected
function UI.setArmy(counts, selected)
	local total, all = 0, 0
	for _, g in GROUP_ORDER do
		local b = refs.armyBtns[g]
		local n, s = counts[g] or 0, selected[g] or 0
		total += s
		all += n
		b.count.Text = if s > 0 then s .. "/" .. n else tostring(n)
		b.stroke.Transparency = if s > 0 then 0 else 1
	end
	refs.armyBtns.all.stroke.Transparency = if total > 0 and total == all then 0 else 1
	refs.armyClear.Visible = total > 0
	refs.armyInfo.Text = if total > 0 then string.format("Выбрано %d · нажми на карту, куда идти", total) else "Нажми на юнит или кнопку"
	refs.armyInfo.TextColor3 = if total > 0 then Color3.fromRGB(120, 255, 170) else C.muted
end

function UI.selectBuild(k: string?)
	UI.buildSel = k
	if UI.onBuildSelect then
		UI.onBuildSelect(k)
	end
	if k and refs.fac then
		UI.hideFactory()
	end
	for key, b in refs.buildBtns do
		local on = key == k
		b.stroke.Transparency = if on then 0 else 1
		b.button.BackgroundTransparency = if on then 0.86 else 0.955
		b.button.BackgroundColor3 = if on then C.molten else Color3.new(1, 1, 1)
	end
	UI.showTip(k)
end

function UI.showTip(k: string?)
	if not k or not refs.hudBottom.Visible or refs.fac.Visible then
		refs.tip.Visible = false
		return
	end
	local d = Config.BUILD[k]
	refs.tipTitle.Text = d.name
	refs.tipDesc.Text = d.desc
	if d.units then
		local names = {}
		for _, kind in d.units do
			table.insert(names, Config.UNITS[kind].name)
		end
		refs.tipOut.Text = "Выпускает: " .. table.concat(names, ", ")
		refs.tipOut.Visible = true
	else
		refs.tipOut.Visible = false
	end
	refs.tipCost.Text = string.format("Цена: %d $ · стройка %d с", d.cost, d.time)
	refs.tipHint.Visible = UI.buildSel == k
	refs.tip.Visible = true
end

local function factoryRow(kind: string, order: number)
	local u = Config.UNITS[kind]
	local row = make("Frame", { Size = UDim2.new(1, 0, 0, 58), BackgroundColor3 = C.panelHi, LayoutOrder = order, ZIndex = 9, Parent = refs.facRows }, {
		Theme.corner(12),
	})
	local stroke = make("UIStroke", { Color = C.molten, Thickness = 1.5, Transparency = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Parent = row })
	local img = icon(u.icon, 46, { Position = UDim2.fromOffset(6, 6), ZIndex = 10, color = myColor, Parent = row })
	Theme.label({ Text = u.title, Position = UDim2.fromOffset(58, 6), Size = UDim2.new(1, -200, 0, 20), TextSize = 15, FontFace = font(Enum.FontWeight.Heavy), ZIndex = 10, Parent = row })
	local info = Theme.label({
		Text = string.format("%d $ · %d с · здоровье %d", u.cost, u.time, u.hp),
		Position = UDim2.fromOffset(58, 27),
		Size = UDim2.new(1, -200, 0, 16),
		TextSize = 12,
		TextColor3 = Color3.fromRGB(198, 207, 221),
		FontFace = font(Enum.FontWeight.SemiBold),
		ZIndex = 10,
		Parent = row,
	})
	local queued = Theme.label({ Text = "", Position = UDim2.fromOffset(58, 42), Size = UDim2.new(1, -200, 0, 14), TextSize = 11.5, TextColor3 = C.moltenHi, FontFace = font(Enum.FontWeight.Bold), ZIndex = 10, Parent = row })
	local auto = make("TextButton", {
		Text = "Авто",
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -78, 0.5, 0),
		Size = UDim2.fromOffset(56, 38),
		AutoButtonColor = true,
		FontFace = font(Enum.FontWeight.Bold),
		TextSize = 13,
		TextColor3 = C.ink,
		BackgroundColor3 = C.panel,
		ZIndex = 10,
		Parent = row,
	}, { Theme.corner(10) })
	auto.Activated:Connect(function()
		if UI.onAuto and UI.factoryId then
			UI.onAuto(UI.factoryId, if refs.facAutoKind == kind then "" else kind)
		end
	end)
	local plus = make("TextButton", {
		Text = "",
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -8, 0.5, 0),
		Size = UDim2.fromOffset(64, 40),
		AutoButtonColor = false,
		BackgroundColor3 = Color3.new(1, 1, 1),
		ZIndex = 10,
		Parent = row,
	}, { Theme.corner(10), Theme.molten(90) })
	Theme.label({ Text = "+1", Size = UDim2.fromScale(1, 1), TextSize = 18, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.moltenInk, TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 11, Parent = plus })
	plus.Activated:Connect(function()
		if UI.onQueue and UI.factoryId then
			UI.onQueue(UI.factoryId, kind)
		end
	end)
	return { kind = kind, row = row, stroke = stroke, icon = img, info = info, queued = queued, auto = auto }
end

-- info: { id, kind, prog, built, queue = { unit kinds }, auto = kind or "" }
function UI.showFactory(info)
	local def = Config.BUILD[info.kind]
	UI.factoryId = info.id
	UI.selectBuild(nil)
	if refs.facKind ~= info.kind then
		refs.facKind = info.kind
		for _, r in refs.facRowList or {} do
			r.row:Destroy()
		end
		refs.facRowList = {}
		for i, kind in def.units do
			table.insert(refs.facRowList, factoryRow(kind, i))
		end
	end
	refs.facTitle.Text = def.name
	local queue = info.queue or {}
	local auto = info.auto or ""
	refs.facAutoKind = auto
	local counts = {}
	for _, kind in queue do
		counts[kind] = (counts[kind] or 0) + 1
	end
	local money = refs.money or 0
	for _, r in refs.facRowList do
		local u = Config.UNITS[r.kind]
		local n = counts[r.kind] or 0
		r.queued.Text = if n > 0 then "в очереди: " .. n elseif auto == r.kind then "выпускается по кругу" else ""
		r.stroke.Transparency = if auto == r.kind then 0 else 1
		r.auto.BackgroundColor3 = if auto == r.kind then Color3.fromRGB(70, 42, 18) else C.panel
		r.auto.TextColor3 = if auto == r.kind then C.moltenHi else C.ink
		r.info.TextColor3 = if money < u.cost then C.bad else Color3.fromRGB(198, 207, 221)
		Sprites.apply(r.icon, u.icon, myColor)
	end
	local built = info.built or 1
	local p = math.abs(info.prog or 0)
	local current = queue[1] or (if auto ~= "" then auto else nil)
	if built < 1 then
		refs.facSub.Text = string.format("Строится: %d%%. Заказы можно делать уже сейчас.", math.floor(built * 100))
		refs.facBar.Size = UDim2.fromScale(built, 1)
		refs.facBar.BackgroundColor3 = Color3.fromRGB(90, 170, 255)
		refs.facQueue.Text = if #queue > 0 then "В очереди: " .. #queue else "Очередь пустая"
	elseif current then
		refs.facSub.Text = "Нажми «+1», чтобы заказать. Юнит появится у постройки."
		refs.facBar.Size = UDim2.fromScale(p, 1)
		refs.facBar.BackgroundColor3 = if (info.prog or 0) < 0 then C.bad else C.molten
		local waiting = (info.prog or 0) < 0
		refs.facQueue.Text = string.format("Сейчас: %s — %s", Config.UNITS[current].title, if waiting then "ждёт денег" else math.floor(p * 100) .. "%")
			.. (if #queue > 1 then string.format(" · ещё в очереди: %d", #queue - 1) else "")
	else
		refs.facSub.Text = "Нажми «+1», чтобы заказать. Юнит появится у постройки."
		refs.facBar.Size = UDim2.fromScale(0, 1)
		refs.facQueue.Text = "Очередь пустая"
	end
	refs.facNote.Text = "«Авто» выпускает выбранный юнит по кругу, пока хватает денег. «Точка сбора»: нажми её, потом место на карте."
	refs.tip.Visible = false
	refs.fac.Visible = true
end

function UI.hideFactory()
	UI.factoryId = nil
	refs.fac.Visible = false
end

-- shown when the game pictures could not be loaded
function UI.artError()
	if refs.artError then
		refs.artError.Visible = true
		return
	end
	local panel = Theme.panel({
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.42),
		Size = UDim2.fromOffset(520, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Color3.fromRGB(16, 21, 34),
		BackgroundTransparency = 0.02,
		ZIndex = 40,
		Parent = root,
	})
	panel:FindFirstChildOfClass("UIStroke").Color = C.bad
	panel:FindFirstChildOfClass("UIStroke").Transparency = 0.3
	Theme.pad(20, 16).Parent = panel
	Theme.list(Enum.FillDirection.Vertical, 8).Parent = panel
	local holder = make("Frame", { Size = UDim2.fromScale(1, 0), BackgroundTransparency = 1, LayoutOrder = 0, ZIndex = 41, Parent = panel })
	Theme.label({ Text = "КАРТИНКИ НЕ ЗАГРУЗИЛИСЬ", Size = UDim2.new(1, -50, 0, 24), TextSize = 20, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.moltenHi, ZIndex = 41, LayoutOrder = 1, Parent = panel })
	Theme.label({
		Text = "Карта и войска пока не видны: Roblox не отдал картинки игры. Перезайди через минуту. Если не поможет — сделай скриншот и пришли его.",
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		TextWrapped = true,
		TextSize = 15,
		FontFace = font(Enum.FontWeight.SemiBold),
		TextColor3 = Color3.fromRGB(214, 222, 235),
		ZIndex = 41,
		LayoutOrder = 2,
		Parent = panel,
	})
	local close = iconButton("close", holder, function()
		panel.Visible = false
	end)
	close.AnchorPoint = Vector2.new(1, 0)
	close.Position = UDim2.new(1, 0, 0, 0)
	close.ZIndex = 42
	refs.artError = panel
end

return UI
