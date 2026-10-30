-- The match screen: the player's card, metal, energy and army at the top, the leaderboard, the army
-- panel and the build bar at the bottom, zoom buttons, the minimap frame, building tips, the
-- banner (spectator, results, defeat) and big announcements. Part of the interface; Ui puts
-- it together.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Sfx = require(script.Parent.Sfx)
local Sprites = require(script.Parent.Sprites)
local Theme = require(script.Parent.Theme)
local Widgets = require(script.Parent.Widgets)

local make = Theme.make
local C = Theme.C
local font = Theme.font
local icon, iconButton, moltenButton = Widgets.icon, Widgets.iconButton, Widgets.moltenButton

local Hud = {}

-- unit kinds grouped for the army panel: infantry, vehicles, aircraft
local GROUPS = {
	inf = { kinds = { "infantry", "rocket", "sniper", "engineer" }, icon = "infantry", title = "Пехота" },
	veh = { kinds = { "scout", "tank", "heavy", "artillery", "mlrs", "aagun" }, icon = "tank", title = "Техника" },
	air = { kinds = { "fighter", "gunship", "bomber", "transport", "drone" }, icon = "fighter", title = "Авиация" },
}
local GROUP_ORDER = { "inf", "veh", "air" }
Hud.GROUPS = GROUPS

local ARMY_W = 280 -- width of the army panel; the build bar starts right of it

-- ctx: { UI = the interface, refs = shared widget references, color = the player's team colour }
local ctx, refs

function Hud.build(context, play: Instance)
	ctx, refs = context, context.refs
	local UI = ctx.UI

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
	refs.meAvatar = Widgets.avatar(0, 46, { Position = UDim2.fromOffset(8, 8), Parent = me })
	Theme.corner(12).Parent = refs.meAvatar
	refs.meStroke = make("UIStroke", { Color = Theme.hex(ctx.color), Thickness = 2, Parent = refs.meAvatar })
	refs.meName = Theme.label({ Text = "", Position = UDim2.fromOffset(62, 7), Size = UDim2.new(1, -70, 0, 20), TextSize = 16, FontFace = font(Enum.FontWeight.ExtraBold), TextTruncate = Enum.TextTruncate.AtEnd, Parent = me })
	refs.meStats = Theme.label({ Text = "", Position = UDim2.fromOffset(62, 27), Size = UDim2.new(1, -70, 0, 14), TextSize = 12, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), Parent = me })
	local army = make("Frame", { Position = UDim2.fromOffset(62, 42), Size = UDim2.new(1, -70, 0, 16), BackgroundTransparency = 1, Parent = me }, {
		Theme.list(Enum.FillDirection.Horizontal, 3, nil, Enum.VerticalAlignment.Center),
	})
	refs.army = {}
	refs.armyIcons = {}
	for i, g in GROUP_ORDER do
		local img = icon(GROUPS[g].icon, 16, { LayoutOrder = i * 2 - 1, color = ctx.color, Parent = army })
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
		pop = Widgets.resChip(res, "pop", 1, ctx.color),
		metal = Widgets.resChip(res, "metal", 2, ctx.color),
		energy = Widgets.resChip(res, "energy", 3, ctx.color),
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
		Sprites.apply(refs.baseIcon, "castle", ctx.color)
	end
	refs.musicButtons = refs.musicButtons or {}
	table.insert(refs.musicButtons, iconButton("music", right, function()
		if UI.onMusic then
			UI.onMusic()
		end
	end))
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
		local rowF = make("Frame", { Size = UDim2.new(1, 0, 0, 22), BackgroundColor3 = Theme.hex(ctx.color), BackgroundTransparency = 1, LayoutOrder = i, Parent = lb }, { Theme.corner(7) })
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
	local armyPanel = Theme.panel({ AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 16, 1, -12), Size = UDim2.fromOffset(ARMY_W, 132), Parent = hudBottom })
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
			refs.armyBtnIcons[k] = icon(GROUPS[k].icon, 22, { Position = UDim2.fromOffset(2, 5), color = ctx.color, Parent = b })
			count = Theme.label({ Text = "0", Position = UDim2.fromOffset(25, 0), Size = UDim2.new(1, -27, 1, 0), TextSize = 12, FontFace = font(Enum.FontWeight.ExtraBold), Parent = b })
		end
		b.Activated:Connect(function()
			Sfx.play("click")
			if UI.onSelectKind then
				UI.onSelectKind(k)
			end
		end)
		refs.armyBtns[k] = { button = b, count = count, stroke = b:FindFirstChildOfClass("UIStroke") }
	end
	-- commands: everyone on screen, box selection (for touch screens), attack-move, stop, hold,
	-- and the landing party: riders get into transports, then transports set them down
	local commands = { { "screen", "Экран" }, { "box", "Рамка" }, { "amove", "Атака" }, { "stop", "Стоп" }, { "hold", "Держ." }, { "load", "Десант" } }
	local cmds = make("Frame", { Position = UDim2.fromOffset(0, 56), Size = UDim2.new(1, 0, 0, 28), BackgroundTransparency = 1, Parent = armyPanel }, {
		make("UIGridLayout", { CellSize = UDim2.new(1 / #commands, -4, 1, 0), CellPadding = UDim2.fromOffset(4, 0), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	refs.cmdBtns = {}
	for i, c in commands do
		local b = make("TextButton", {
			Text = c[2],
			AutoButtonColor = true,
			FontFace = font(Enum.FontWeight.Bold),
			TextScaled = true,
			TextColor3 = C.ink,
			BackgroundColor3 = C.panelHi,
			LayoutOrder = i,
			Parent = cmds,
		}, {
			Theme.corner(8),
			make("UIStroke", { Color = C.molten, Thickness = 1.5, Transparency = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }),
			make("UITextSizeConstraint", { MaxTextSize = 11 }),
			Theme.pad(2, 0),
		})
		b.Activated:Connect(function()
			Sfx.play("click")
			if UI.onCommand then
				UI.onCommand(c[1])
			end
		end)
		refs.cmdBtns[c[1]] = b
	end
	refs.armyInfo = Theme.label({ Text = "Нажми на юнит или кнопку", Position = UDim2.fromOffset(0, 88), Size = UDim2.new(1, 0, 0, 28), TextSize = 11.5, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, Parent = armyPanel })

	local buildScroll = make("ScrollingFrame", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -12),
		Size = UDim2.fromOffset(650, 98),
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
		local img = icon(def.icon, 38, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 4), color = ctx.color, Parent = b })
		Theme.label({
			Text = def.short or def.name,
			AnchorPoint = Vector2.new(0.5, 0),
			Position = UDim2.new(0.5, 0, 0, 43),
			Size = UDim2.new(1, -4, 0, 24),
			-- long names shrink to fit narrow buttons
			TextScaled = true,
			TextWrapped = true,
			TextXAlignment = Enum.TextXAlignment.Center,
			TextYAlignment = Enum.TextYAlignment.Center,
			FontFace = font(Enum.FontWeight.Bold),
			Parent = b,
		}, { make("UITextSizeConstraint", { MaxTextSize = 11 }) })
		local row, costLabel = Widgets.costRow(def.cost, b, 11)
		row.AnchorPoint = Vector2.new(0.5, 1)
		row.Position = UDim2.new(0.5, 0, 1, -4)
		b.Activated:Connect(function()
			Hud.selectBuild(if UI.buildSel == k then nil else k)
		end)
		b.MouseEnter:Connect(function()
			Hud.showTip(k)
		end)
		b.MouseLeave:Connect(function()
			Hud.showTip(UI.buildSel)
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

-- the build bar sits between the army panel on the left and the zoom buttons on the right, and
-- its buttons narrow down a little on small screens so all of them fit (the bar scrolls if
-- they still do not); w = width of the interface in its own units
function Hud.layout(w: number)
	if refs.buildScroll then
		local left, right = 16 + ARMY_W + 8, 16 + 44 + 8
		local avail = w - left - right
		local n = #Config.BUILD_ORDER
		local bw = math.clamp(math.floor((avail - 12 - (n - 1) * 6) / n), 50, 74)
		for _, b in refs.buildBtns do
			b.button.Size = UDim2.fromOffset(bw, 86)
		end
		refs.buildScroll.Size = UDim2.fromOffset(math.max(220, math.min(n * bw + (n - 1) * 6 + 12, avail)), 98)
		refs.buildScroll.Position = UDim2.new(0, left + avail / 2, 1, -12)
	end
end

---------------------------------------------------------------- match state

function Hud.setPhase(phase: string, spectator: boolean)
	local inGame = phase == "game" and not spectator
	if not inGame then
		ctx.UI.hideFactory()
		ctx.UI.hideResearch()
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
		Hud.selectBuild(nil)
	end
	refs.lb.Visible = inGame
end

function Hud.setMyColor(hex: string)
	if hex == ctx.color then
		return
	end
	ctx.color = hex
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

function Hud.results(msg, myId: number)
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
	Hud.announce(if won then "ПОБЕДА!" else "МАТЧ ОКОНЧЕН", lead)
end

function Hud.defeat()
	refs.banner.Visible = true
	refs.bnBtn.Visible = true
	refs.hudBottom.Visible = false
	refs.bnTitle.Text = "ТВОЮ БАЗУ РАЗГРОМИЛИ"
	refs.bnSub.Text = "Можно досмотреть матч или вернуться в меню."
	refs.bnCount.Text = ""
	Hud.selectBuild(nil)
end

local announceToken = 0
function Hud.announce(title: string, sub: string)
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

function Hud.setEconomy(eco)
	local pop = eco.pop or 0
	refs.res.pop.value.Text = string.format("%d/%d", pop, Config.ARMY_LIMIT)
	refs.res.pop.rate.Text = "армия"
	refs.res.pop.rate.TextColor3 = if pop >= Config.ARMY_LIMIT then C.bad else C.muted
	refs.res.metal.value.Text = tostring(eco.money)
	refs.res.metal.rate.Text = string.format("+%d/с", math.floor(eco.income + 0.5))
	refs.res.metal.rate.TextColor3 = C.ok
	-- energy: used / made; red while the base uses more than it makes
	local made, used = eco.energy or 0, eco.energyUsed or 0
	local short = used > made
	refs.res.energy.value.Text = string.format("%d/%d", used, made)
	refs.res.energy.value.TextColor3 = if short then C.bad else C.ink
	refs.res.energy.rate.Text = if short then "мало энергии" else "энергия"
	refs.res.energy.rate.TextColor3 = if short then C.bad else C.muted
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

function Hud.setMe(text: string)
	refs.meStats.Text = text
end

-- rows: list of { place, name, color, value (text), isMe }
function Hud.setLeaderboard(rows)
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

---------------------------------------------------------------- army and build bar

-- a command waiting for a tap on the map: its button is lit
function Hud.setArmed(name: string, on: boolean)
	local b = refs.cmdBtns[name]
	if b then
		b:FindFirstChildOfClass("UIStroke").Transparency = if on then 0 else 1
		b.BackgroundColor3 = if on then Color3.fromRGB(70, 42, 18) else C.panelHi
		b.TextColor3 = if on then C.moltenHi else C.ink
	end
end

-- counts / selected: units of each group the player has and has selected; info: what the selection is
function Hud.setArmy(counts, selected, info: string?)
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
	refs.armyInfo.Text = if total > 0 then info or string.format("Выбрано %d · нажми на карту, куда идти", total) else "Нажми на юнит, протяни рамку или выбери группу"
	refs.armyInfo.TextColor3 = if total > 0 then Color3.fromRGB(120, 255, 170) else C.muted
end

function Hud.selectBuild(k: string?)
	local UI = ctx.UI
	UI.buildSel = k
	if UI.onBuildSelect then
		UI.onBuildSelect(k)
	end
	if k and refs.fac then
		UI.hideFactory()
		UI.hideResearch()
	end
	for key, b in refs.buildBtns do
		local on = key == k
		b.stroke.Transparency = if on then 0 else 1
		b.button.BackgroundTransparency = if on then 0.86 else 0.955
		b.button.BackgroundColor3 = if on then C.molten else Color3.new(1, 1, 1)
	end
	Hud.showTip(k)
end

function Hud.showTip(k: string?)
	if not k or not refs.hudBottom.Visible or refs.fac.Visible or refs.lab.Visible then
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
	local energy = ""
	if d.energy and d.energy > 0 then
		energy = string.format(" · энергия +%d", d.energy)
	elseif d.energy and d.energy < 0 then
		energy = string.format(" · энергия −%d", -d.energy)
	end
	refs.tipCost.Text = string.format("Цена: %d металла · стройка %d с%s", d.cost, d.time, energy)
	refs.tipHint.Visible = ctx.UI.buildSel == k
	refs.tip.Visible = true
end

return Hud
