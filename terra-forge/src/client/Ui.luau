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
UI.buildSel = nil
UI.attackPct = 40

local gui, root, scale
local menu, play
local refs = {}
local myColor = Config.HUMAN_COLORS[1]

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
		UI.toast("1. Поставь столицу. 2. Захватывай землю войсками. 3. Строй шахты и заводы, выпускай армию. 4. Выбери войска и нажми на карту, куда им идти.", false, 7)
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
		Text = "ЗАХВАТИ МИР  ·  ПОСТРОЙ ЗАВОДЫ",
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
	Theme.label({ Text = "5 видов войск. Посмотри, как выглядит каждый.", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 13, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.Medium), LayoutOrder = 2, Parent = ars })
	local row = make("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, LayoutOrder = 3, Parent = ars }, { Theme.list(Enum.FillDirection.Horizontal, 6) })
	for _, k in { "infantry", "tank", "plane", "artillery" } do
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
	for i, s in { "Поставь столицу в любой точке Земли", "Захватывай соседние земли войсками", "Строй шахты и заводы, выпускай танки и самолёты", "Выбери войска и нажми на карту: они поедут туда и будут воевать" } do
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
		local f = make("Frame", {
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
		local dot = make("Frame", { Position = UDim2.fromOffset(0, 32), Size = UDim2.fromOffset(8, 8), BackgroundColor3 = if active then C.ok else C.muted, Parent = f }, { Theme.corner(nil, 1) })
		local sub = Theme.label({ Position = UDim2.fromOffset(14, 26), Size = UDim2.new(1, -14, 0, 20), Text = "", TextSize = 13, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), TextTruncate = Enum.TextTruncate.AtEnd, Parent = f })
		return sub, dot
	end
	refs.modeStatus = modeCard("МИР", true, 1)
	local teams = modeCard("КОМАНДЫ", false, 2)
	teams.Text = "Скоро"
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
	for _, u in Config.ARSENAL do
		local card = make("Frame", { Size = UDim2.fromOffset(156, 226), BackgroundColor3 = C.panelHi, ZIndex = 22, Parent = cards }, {
			Theme.corner(16),
			Theme.stroke(),
			Theme.pad(12),
			Theme.list(Enum.FillDirection.Vertical, 6),
		})
		local pic = make("Frame", { Size = UDim2.new(1, 0, 0, 84), BackgroundColor3 = Color3.fromRGB(22, 32, 51), ZIndex = 22, LayoutOrder = 1, Parent = card }, { Theme.corner(12) })
		icon(u.icon, 72, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), color = myColor, ZIndex = 23, Parent = pic })
		Theme.label({ Text = u.name, Size = UDim2.new(1, 0, 0, 20), TextSize = 16, FontFace = font(Enum.FontWeight.Heavy), LayoutOrder = 2, ZIndex = 22, Parent = card })
		Theme.label({ Text = u.desc, Size = UDim2.new(1, 0, 0, 52), TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, TextSize = 12.5, TextColor3 = Color3.fromRGB(200, 209, 223), FontFace = font(Enum.FontWeight.SemiBold), LayoutOrder = 3, ZIndex = 22, Parent = card })
		local st = make("Frame", {
			AutomaticSize = Enum.AutomaticSize.XY,
			Size = UDim2.fromOffset(0, 0),
			BackgroundColor3 = if u.open then C.ok else Color3.new(1, 1, 1),
			BackgroundTransparency = if u.open then 0.85 else 0.93,
			LayoutOrder = 4,
			ZIndex = 22,
			Parent = card,
		}, { Theme.corner(7), Theme.pad(8, 3) })
		Theme.label({ Text = if u.open then "ОТКРЫТО" else "СКОРО", AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = 11, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = if u.open then C.ok else C.muted, ZIndex = 22, Parent = st })
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
	icon(key, 20, { LayoutOrder = 1, Parent = f })
	local col = make("Frame", { AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), BackgroundTransparency = 1, LayoutOrder = 2, Parent = f }, {
		Theme.list(Enum.FillDirection.Vertical, -1),
	})
	local value = Theme.label({ Text = "0", AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = 15, FontFace = font(Enum.FontWeight.ExtraBold), Parent = col })
	local rate = Theme.label({ Text = "", AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = 11, TextColor3 = C.ok, FontFace = font(Enum.FontWeight.Bold), Parent = col })
	return { value = value, rate = rate }
end

local function costRow(cost, parent: Instance, size: number)
	local row = make("Frame", { AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), BackgroundTransparency = 1, Parent = parent }, {
		Theme.list(Enum.FillDirection.Horizontal, 5, Enum.HorizontalAlignment.Center, Enum.VerticalAlignment.Center),
	})
	local parts = {}
	local order = 0
	for _, k in Config.RES_ORDER do
		local v = cost[k]
		if v then
			order += 1
			local item = make("Frame", { AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), BackgroundTransparency = 1, LayoutOrder = order, Parent = row }, {
				Theme.list(Enum.FillDirection.Horizontal, 2, nil, Enum.VerticalAlignment.Center),
			})
			icon(k, size, { Parent = item })
			parts[k] = Theme.label({ Text = tostring(v), AutomaticSize = Enum.AutomaticSize.XY, Size = UDim2.fromOffset(0, 0), TextSize = size, FontFace = font(Enum.FontWeight.Bold), TextColor3 = Color3.fromRGB(198, 207, 221), Parent = item })
		end
	end
	return row, parts
end

local function buildPlay()
	play = make("Frame", { Name = "Play", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = false, Parent = root })

	-- banner (spawn countdown, results, defeat)
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
	refs.bnTitle = Theme.label({ Text = "", Size = UDim2.new(1, -150, 0, 26), TextSize = 22, FontFace = font(Enum.FontWeight.Heavy), ZIndex = 5, Parent = banner })
	refs.bnSub = Theme.label({ Text = "", Position = UDim2.fromOffset(0, 27), Size = UDim2.new(1, -150, 0, 20), TextSize = 15, TextColor3 = Color3.fromRGB(210, 218, 231), FontFace = font(Enum.FontWeight.SemiBold), TextTruncate = Enum.TextTruncate.AtEnd, ZIndex = 5, Parent = banner })
	refs.bnCount = Theme.label({ Text = "", Position = UDim2.fromOffset(0, 48), Size = UDim2.new(1, -150, 0, 18), TextSize = 14, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), ZIndex = 5, Parent = banner })
	local ring = make("Frame", {
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, 0, 0.5, 0),
		Size = UDim2.fromOffset(58, 58),
		BackgroundColor3 = Color3.fromRGB(26, 33, 50),
		ZIndex = 5,
		Parent = banner,
	}, { Theme.corner(nil, 1), make("UIStroke", { Color = C.molten, Thickness = 4 }) })
	refs.ringNum = Theme.label({ Text = "15", Size = UDim2.fromScale(1, 1), TextSize = 24, FontFace = font(Enum.FontWeight.Heavy), TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 6, Parent = ring })
	refs.ring = ring
	local barBg = make("Frame", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 0, 1, 2), Size = UDim2.new(1, -80, 0, 4), BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.9, ZIndex = 5, Parent = banner }, { Theme.corner(nil, 1) })
	refs.bnBar = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = C.molten, ZIndex = 6, Parent = barBg }, { Theme.corner(nil, 1) })
	refs.bnBarBg = barBg
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
	for i, k in { "infantry", "tank", "plane" } do
		local img = icon(k, 16, { LayoutOrder = i * 2 - 1, color = myColor, Parent = army })
		refs.armyIcons[k] = img
		refs.army[k] = Theme.label({ Text = "0", AutomaticSize = Enum.AutomaticSize.X, Size = UDim2.fromOffset(0, 16), TextSize = 12, FontFace = font(Enum.FontWeight.Bold), LayoutOrder = i * 2, Parent = army })
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
	refs.res = {}
	for i, k in Config.RES_ORDER do
		refs.res[k] = resChip(res, k, i)
	end
	refs.res.energy = resChip(res, "energy", 10)

	local right = make("Frame", {
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -16, 0, 12),
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		BackgroundTransparency = 1,
		Parent = hudTop,
	}, { Theme.list(Enum.FillDirection.Horizontal, 8) })
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
	local armyPanel = Theme.panel({ AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 16, 1, -118), Size = UDim2.fromOffset(210, 86), Parent = hudBottom })
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
	for i, k in { "infantry", "tank", "plane", "all" } do
		local b = make("TextButton", { Text = "", AutoButtonColor = true, BackgroundColor3 = C.panelHi, LayoutOrder = i, Parent = kinds }, {
			Theme.corner(9),
			make("UIStroke", { Color = Color3.fromRGB(120, 255, 170), Thickness = 1.5, Transparency = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }),
		})
		local count
		if k == "all" then
			count = Theme.label({ Text = "ВСЕ", Size = UDim2.fromScale(1, 1), TextSize = 12, FontFace = font(Enum.FontWeight.Heavy), TextXAlignment = Enum.TextXAlignment.Center, Parent = b })
		else
			refs.armyBtnIcons[k] = icon(k, 22, { Position = UDim2.fromOffset(2, 5), color = myColor, Parent = b })
			count = Theme.label({ Text = "0", Position = UDim2.fromOffset(25, 0), Size = UDim2.new(1, -27, 1, 0), TextSize = 12, FontFace = font(Enum.FontWeight.ExtraBold), Parent = b })
		end
		b.Activated:Connect(function()
			if UI.onSelectKind then
				UI.onSelectKind(k)
			end
		end)
		refs.armyBtns[k] = { button = b, count = count, stroke = b:FindFirstChildOfClass("UIStroke") }
	end
	refs.armyInfo = Theme.label({ Text = "Нажми на юнит или кнопку", Position = UDim2.fromOffset(0, 56), Size = UDim2.new(1, 0, 0, 14), TextSize = 11.5, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), TextTruncate = Enum.TextTruncate.AtEnd, Parent = armyPanel })
	local attack = Theme.panel({ AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 16, 1, -12), Size = UDim2.fromOffset(210, 98), Parent = hudBottom })
	Theme.pad(12, 10).Parent = attack
	Theme.label({ Text = "В атаку", Size = UDim2.new(1, 0, 0, 18), TextSize = 14, FontFace = font(Enum.FontWeight.ExtraBold), Parent = attack })
	local chips = make("Frame", { Position = UDim2.fromOffset(0, 24), Size = UDim2.new(1, 0, 0, 30), BackgroundTransparency = 1, Parent = attack }, {
		make("UIGridLayout", { CellSize = UDim2.new(0.25, -4, 1, 0), CellPadding = UDim2.fromOffset(5, 0), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	refs.atkChips = {}
	for i, pct in Config.ATTACK_STEPS do
		local b = make("TextButton", {
			Text = pct .. "%",
			AutoButtonColor = true,
			FontFace = font(Enum.FontWeight.ExtraBold),
			TextSize = 14,
			TextColor3 = C.ink,
			BackgroundColor3 = C.panelHi,
			LayoutOrder = i,
			Parent = chips,
		}, { Theme.corner(9), make("UIStroke", { Color = C.molten, Thickness = 1.5, Transparency = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }) })
		b.Activated:Connect(function()
			UI.attackPct = pct
			UI.refreshAttack()
		end)
		refs.atkChips[pct] = b
	end
	Theme.label({ Text = "Нажми на землю у своей границы", Position = UDim2.fromOffset(0, 60), Size = UDim2.new(1, 0, 0, 16), TextSize = 11.5, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), TextWrapped = true, Parent = attack })
	UI.refreshAttack()

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
		local row, parts = costRow(def.cost, b, 11)
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
		refs.buildBtns[k] = { button = b, icon = img, parts = parts, stroke = b:FindFirstChildOfClass("UIStroke") }
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
	refs.tipHint = Theme.label({ Text = "Нажми на свою территорию, чтобы поставить. Нажми на кнопку ещё раз, чтобы отменить.", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 13, TextColor3 = C.moltenHi, FontFace = font(Enum.FontWeight.Bold), LayoutOrder = 5, Parent = tip })
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
	refs.hudTop.Visible = inGame
	refs.hudBottom.Visible = inGame
	refs.banner.Visible = phase == "spawn" or spectator or phase == "ended"
	refs.ring.Visible = phase == "spawn"
	refs.bnBarBg.Visible = phase == "spawn"
	refs.bnBtn.Visible = spectator or phase == "ended"
	if spectator and phase ~= "ended" then
		refs.bnTitle.Text = "ТЫ ЗРИТЕЛЬ"
		refs.bnSub.Text = "Матч уже идёт. Следующий начнётся, когда этот закончится."
		refs.bnCount.Text = ""
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
	for k, b in refs.buildBtns do
		Sprites.apply(b.icon, Config.BUILD[k].icon, hex)
	end
	for k, img in refs.armyIcons do
		Sprites.apply(img, k, hex)
	end
	for k, img in refs.armyBtnIcons do
		Sprites.apply(img, k, hex)
	end
	for _, row in refs.lbRows do
		row.frame.BackgroundColor3 = Theme.hex(hex)
	end
end

function UI.spawnBanner(timer: number, placed: number, total: number, hasCap: boolean)
	refs.bnTitle.Text = if hasCap then "СТОЛИЦА ПОСТАВЛЕНА" else "ВЫБЕРИ МЕСТО ДЛЯ СТОЛИЦЫ"
	refs.bnSub.Text = if hasCap then "Нажми в другом месте, чтобы переставить её, пока идёт отсчёт." else "Нажми на любую сушу. Карту можно двигать и приближать."
	refs.bnCount.Text = string.format("Высадились %d / %d командиров", placed, total)
	local left = math.max(0, timer)
	refs.ringNum.Text = tostring(math.ceil(left))
	refs.bnBar.Size = UDim2.fromScale(math.clamp(left / Config.SPAWN_SECONDS, 0, 1), 1)
end

function UI.results(msg, myId: number)
	refs.banner.Visible = true
	refs.ring.Visible = false
	refs.bnBarBg.Visible = false
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
		table.insert(parts, string.format("%d. %s %.1f%%", i, row.name, row.share * 100))
	end
	refs.bnCount.Text = table.concat(parts, "   ")
	UI.announce(if won then "ПОБЕДА!" else "МАТЧ ОКОНЧЕН", lead)
end

function UI.defeat()
	refs.banner.Visible = true
	refs.ring.Visible = false
	refs.bnBarBg.Visible = false
	refs.bnBtn.Visible = true
	refs.hudBottom.Visible = false
	refs.bnTitle.Text = "ТВОЮ СТРАНУ ЗАХВАТИЛИ"
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
	if info.phase == "spawn" then
		status = string.format("Высадка, ещё %d с · заходи", math.max(0, math.ceil(info.timer)))
	elseif info.phase == "game" then
		local t = math.max(0, math.floor(info.timer))
		status = string.format("Идёт матч · осталось %d:%02d", t // 60, t % 60)
	elseif info.phase == "ended" then
		status = "Матч закончился · начни новый"
	else
		status = "Свободно · начни матч"
	end
	refs.modeStatus.Text = string.format("С ботами · 40 стран · %s", status)
	refs.serverPill.Text = string.format("На сервере: %d · в матче: %d", info.players, info.inMatch)
end

local function fmtRate(k: string, r: number, fmt): (string, Color3)
	local a = math.abs(r)
	local txt = if k == "pop" then fmt(a) elseif a < 10 then string.format("%.1f", a) else tostring(math.floor(a))
	local color = if a < 0.05 then C.muted elseif r < 0 then C.bad else C.ok
	return (if r < 0 then "−" else "+") .. txt .. "/с", color
end

function UI.setEconomy(eco, troops: number, fmt)
	for _, k in Config.RES_ORDER do
		local chip = refs.res[k]
		local v = if k == "pop" then troops else eco.res[k] or 0
		chip.value.Text = if k == "pop" then fmt(v) else tostring(math.floor(v))
		local txt, color = fmtRate(k, eco.rates[k] or 0, fmt)
		chip.rate.Text = txt
		chip.rate.TextColor3 = color
	end
	local e = refs.res.energy
	e.value.Text = string.format("%d/%d", eco.supply, eco.need)
	if eco.need > eco.supply then
		e.rate.Text = "мало"
		e.rate.TextColor3 = C.bad
	elseif eco.supply > 0 then
		e.rate.Text = "хватает"
		e.rate.TextColor3 = C.ok
	else
		e.rate.Text = "нет"
		e.rate.TextColor3 = C.muted
	end
	for k, v in eco.army do
		if refs.army[k] then
			refs.army[k].Text = tostring(v)
		end
	end
	for k, b in refs.buildBtns do
		local def = Config.BUILD[k]
		local poor = false
		for r, need in def.cost do
			local have = eco.res[r] or 0
			local lack = have < need
			poor = poor or lack
			if b.parts[r] then
				b.parts[r].TextColor3 = if lack then C.bad else Color3.fromRGB(198, 207, 221)
			end
		end
		Sprites.setTransparency(b.icon, if poor then 0.5 else 0)
	end
end

function UI.setMe(share: number, troops: number, fmt)
	refs.meStats.Text = string.format("%.2f%% земли · %s войск", share * 100, fmt(troops))
end

-- rows: list of { name, color, share, isMe, place }
function UI.setLeaderboard(rows)
	for i, r in refs.lbRows do
		local data = rows[i]
		r.frame.Visible = data ~= nil
		if data then
			r.place.Text = tostring(data.place)
			r.sw.BackgroundColor3 = Theme.hex(data.color)
			r.name.Text = data.name
			r.share.Text = string.format("%.1f%%", data.share * 100)
			r.frame.BackgroundTransparency = if data.isMe then 0.84 else 1
		end
	end
end

-- counts: units of each kind the player has; selected: how many of each are selected
function UI.setArmy(counts, selected)
	local total = 0
	for _, k in { "infantry", "tank", "plane" } do
		local b = refs.armyBtns[k]
		local n, s = counts[k] or 0, selected[k] or 0
		total += s
		b.count.Text = if s > 0 then s .. "/" .. n else tostring(n)
		b.stroke.Transparency = if s > 0 then 0 else 1
	end
	refs.armyBtns.all.stroke.Transparency = if total > 0 and total == (counts.infantry or 0) + (counts.tank or 0) + (counts.plane or 0) then 0 else 1
	refs.armyClear.Visible = total > 0
	refs.armyInfo.Text = if total > 0 then string.format("Выбрано %d · нажми на карту, куда идти", total) else "Нажми на юнит или кнопку"
	refs.armyInfo.TextColor3 = if total > 0 then Color3.fromRGB(120, 255, 170) else C.muted
end

function UI.refreshAttack()
	for pct, b in refs.atkChips do
		local on = pct == UI.attackPct
		b.BackgroundColor3 = if on then Color3.fromRGB(70, 42, 18) else C.panelHi
		b:FindFirstChildOfClass("UIStroke").Transparency = if on then 0 else 1
		b.TextColor3 = if on then C.moltenHi else C.ink
	end
end

function UI.selectBuild(k: string?)
	UI.buildSel = k
	for key, b in refs.buildBtns do
		local on = key == k
		b.stroke.Transparency = if on then 0 else 1
		b.button.BackgroundTransparency = if on then 0.86 else 0.955
		b.button.BackgroundColor3 = if on then C.molten else Color3.new(1, 1, 1)
	end
	UI.showTip(k)
end

function UI.showTip(k: string?)
	if not k or not refs.hudBottom.Visible then
		refs.tip.Visible = false
		return
	end
	local d = Config.BUILD[k]
	refs.tipTitle.Text = d.name
	refs.tipDesc.Text = d.desc
	if d.unit then
		local parts = {}
		for _, r in Config.RES_ORDER do
			if d.ucost[r] then
				table.insert(parts, d.ucost[r] .. " " .. Config.RES_OF[r])
			end
		end
		refs.tipOut.Text = string.format("Выпускает: %s каждые %d с · %s", Config.UNITS[d.unit].name, d.every, table.concat(parts, ", "))
		refs.tipOut.Visible = true
	else
		refs.tipOut.Visible = false
	end
	local costs = {}
	for _, r in Config.RES_ORDER do
		if d.cost[r] then
			table.insert(costs, d.cost[r] .. " " .. Config.RES_OF[r])
		end
	end
	if d.power < 0 then
		table.insert(costs, "+" .. -d.power .. " энергии")
	elseif d.power > 0 then
		table.insert(costs, "−" .. d.power .. " энергии")
	end
	refs.tipCost.Text = "Цена: " .. table.concat(costs, " · ")
	refs.tipHint.Visible = UI.buildSel == k
	refs.tip.Visible = true
end

-- the map needs EditableImage, which is off until the owner allows it for the experience
function UI.mapError()
	if refs.mapError then
		refs.mapError.Visible = true
		return
	end
	local panel = Theme.panel({
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.42),
		Size = UDim2.fromOffset(560, 0),
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
	Theme.label({ Text = "КАРТА ВЫКЛЮЧЕНА", Size = UDim2.new(1, -50, 0, 24), TextSize = 20, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.moltenHi, ZIndex = 41, LayoutOrder = 1, Parent = panel })
	Theme.label({
		Text = "Карте нужен доступ к созданию картинок, а в этой игре он пока выключен. Владелец игры включает его один раз:\n\n"
			.. "1. Roblox Studio → вкладка Home → Experience Settings (раньше Game Settings).\n"
			.. "2. Раздел Security → включи «Allow Mesh / Image APIs» → Save.\n"
			.. "Или на сайте: create.roblox.com → Creations → эта игра → Configure → Settings → «Enable Mesh / Image APIs».\n\n"
			.. "Игра должна быть опубликована (File → Publish to Roblox). Потом перезапусти её.",
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
	local close = iconButton("close", panel, function()
		panel.Visible = false
	end)
	close.AnchorPoint = Vector2.new(1, 0)
	close.Position = UDim2.new(1, 0, 0, 0)
	close.ZIndex = 42
	-- keep the close button out of the list layout
	local holder = make("Frame", { Size = UDim2.fromScale(1, 0), BackgroundTransparency = 1, LayoutOrder = 0, ZIndex = 41, Parent = panel })
	close.Parent = holder
	refs.mapError = panel
end

return UI
