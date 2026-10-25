-- Клиент режима «Фронт»: камера сверху, управление пальцем и мышью, интерфейс,
-- эффекты (корабли, ракеты, танки). Вся логика матча — на сервере.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage:WaitForChild("Front")
local Config = require(Shared:WaitForChild("Config"))
local Models = require(Shared:WaitForChild("Models"))
local Remotes = Shared:WaitForChild("Remotes")
local Action = Remotes:WaitForChild("Action")
local State = Remotes:WaitForChild("State")
local Fx = Remotes:WaitForChild("Fx")
local Notice = Remotes:WaitForChild("Notice")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local T = Config.TILE
local MAP_W, MAP_H = Config.MAP_W * T, Config.MAP_H * T

-- ------------------------------------------------------------ клетки карты

local tiles = {} -- номер клетки -> Part
local function indexMap(folder)
	tiles = {}
	for _, p in ipairs(folder:GetChildren()) do
		local i = p:GetAttribute("I")
		if i then
			tiles[i] = p
		end
	end
end
local function currentMap()
	return workspace:FindFirstChild("FrontMap")
end
workspace.ChildAdded:Connect(function(c)
	if c.Name == "FrontMap" then
		task.wait(0.5)
		indexMap(c)
	end
end)
task.spawn(function()
	indexMap(workspace:WaitForChild("FrontMap"))
end)

local function tileTop(i)
	local p = tiles[i]
	if p then
		return p.Position + Vector3.new(0, p.Size.Y / 2, 0)
	end
	return Config.tileCenter(i) + Vector3.new(0, 0.1, 0)
end

-- ------------------------------------------------------------ камера

local focus = Vector3.zero
local zoom = 240
local ZOOM_MIN, ZOOM_MAX = 40, 330

local function clampFocus()
	focus = Vector3.new(math.clamp(focus.X, -MAP_W / 2, MAP_W / 2), 0, math.clamp(focus.Z, -MAP_H / 2, MAP_H / 2))
end

local function worldPerPixel()
	local vp = camera.ViewportSize
	return 2 * zoom * 1.1 * math.tan(math.rad(camera.FieldOfView / 2)) / math.max(vp.Y, 1)
end

local function pan(delta)
	local k = worldPerPixel()
	focus -= Vector3.new(delta.X * k, 0, delta.Y * k)
	clampFocus()
end

RunService:BindToRenderStep("FrontCamera", Enum.RenderPriority.Camera.Value + 1, function()
	camera.CameraType = Enum.CameraType.Scriptable
	camera.FieldOfView = 50
	local pos = focus + Vector3.new(0, zoom, zoom * 0.45)
	camera.CFrame = CFrame.lookAt(pos, focus)
end)

-- ------------------------------------------------------------ интерфейс

local COLORS = {
	panel = Color3.fromRGB(18, 22, 28),
	panel2 = Color3.fromRGB(30, 36, 44),
	ink = Color3.fromRGB(236, 238, 240),
	dim = Color3.fromRGB(150, 158, 168),
	accent = Color3.fromRGB(255, 176, 46),
	bad = Color3.fromRGB(235, 87, 70),
	good = Color3.fromRGB(90, 200, 120),
	troops = Color3.fromRGB(90, 160, 240),
}

local gui = Instance.new("ScreenGui")
gui.Name = "FrontUI"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = false
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = player:WaitForChild("PlayerGui")
local uiScale = Instance.new("UIScale")
uiScale.Parent = gui

local function corner(parent, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r or 8)
	c.Parent = parent
end

local function frame(parent, props)
	local f = Instance.new("Frame")
	f.BackgroundColor3 = COLORS.panel
	f.BackgroundTransparency = 0.15
	f.BorderSizePixel = 0
	for k, v in pairs(props or {}) do
		f[k] = v
	end
	f.Parent = parent
	return f
end

local function label(parent, props)
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.TextColor3 = COLORS.ink
	l.Font = Enum.Font.GothamMedium
	l.TextSize = 14
	l.TextXAlignment = Enum.TextXAlignment.Left
	for k, v in pairs(props or {}) do
		l[k] = v
	end
	l.Parent = parent
	return l
end

local function button(parent, props)
	local b = Instance.new("TextButton")
	b.BackgroundColor3 = COLORS.panel2
	b.BorderSizePixel = 0
	b.TextColor3 = COLORS.ink
	b.Font = Enum.Font.GothamBold
	b.TextSize = 14
	b.AutoButtonColor = true
	for k, v in pairs(props or {}) do
		b[k] = v
	end
	b.Parent = parent
	corner(b, 8)
	return b
end

local function fmt(n)
	n = n or 0
	if n >= 1e6 then
		return string.format("%.1fM", n / 1e6)
	elseif n >= 1e4 then
		return string.format("%.0fk", n / 1e3)
	elseif n >= 1e3 then
		return string.format("%.1fk", n / 1e3)
	end
	return tostring(math.floor(n))
end

-- статистика (слева сверху)
local stats = frame(gui, { Size = UDim2.fromOffset(230, 92), Position = UDim2.fromOffset(10, 8) })
corner(stats, 10)
local troopsLabel = label(stats, { Size = UDim2.new(1, -20, 0, 18), Position = UDim2.fromOffset(10, 6), Text = "Войска" })
local troopsBack = frame(stats, { Size = UDim2.new(1, -20, 0, 8), Position = UDim2.fromOffset(10, 27), BackgroundColor3 = COLORS.panel2, BackgroundTransparency = 0 })
corner(troopsBack, 4)
local troopsFill = frame(troopsBack, { Size = UDim2.fromScale(0, 1), BackgroundColor3 = COLORS.troops, BackgroundTransparency = 0 })
corner(troopsFill, 4)
local goldLabel = label(stats, { Size = UDim2.new(1, -20, 0, 18), Position = UDim2.fromOffset(10, 42), Text = "Золото", TextColor3 = COLORS.accent })
local landLabel = label(stats, { Size = UDim2.new(1, -20, 0, 18), Position = UDim2.fromOffset(10, 64), Text = "Земля", TextColor3 = COLORS.dim, TextSize = 13 })

-- фаза и таймер (по центру сверху)
local phaseLabel = label(gui, {
	Size = UDim2.fromOffset(320, 30), Position = UDim2.new(0.5, -160, 0, 8),
	TextXAlignment = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBold, TextSize = 16,
	BackgroundTransparency = 0.15, BackgroundColor3 = COLORS.panel,
})
corner(phaseLabel, 10)

-- лидеры (справа сверху)
local board = frame(gui, { Size = UDim2.fromOffset(250, 30), Position = UDim2.new(1, -260, 0, 8), AutomaticSize = Enum.AutomaticSize.Y })
corner(board, 10)
local boardList = Instance.new("UIListLayout")
boardList.Padding = UDim.new(0, 2)
boardList.SortOrder = Enum.SortOrder.LayoutOrder
boardList.Parent = board
local boardPad = Instance.new("UIPadding")
boardPad.PaddingTop, boardPad.PaddingBottom = UDim.new(0, 6), UDim.new(0, 6)
boardPad.PaddingLeft, boardPad.PaddingRight = UDim.new(0, 8), UDim.new(0, 8)
boardPad.Parent = board
local boardTitle = label(board, { Size = UDim2.new(1, 0, 0, 18), Text = "Страны", Font = Enum.Font.GothamBold, TextColor3 = COLORS.dim, TextSize = 12, LayoutOrder = 0 })
local boardOpen = true
local boardToggle = button(gui, { Size = UDim2.fromOffset(60, 26), Position = UDim2.new(1, -330, 0, 10), Text = "Топ", TextSize = 13 })

-- уведомления (слева, под статистикой)
local feed = frame(gui, { Size = UDim2.fromOffset(300, 10), Position = UDim2.fromOffset(10, 108), BackgroundTransparency = 1, AutomaticSize = Enum.AutomaticSize.Y })
local feedList = Instance.new("UIListLayout")
feedList.Padding = UDim.new(0, 4)
feedList.Parent = feed

-- большой баннер по центру
local banner = label(gui, {
	Size = UDim2.new(1, 0, 0, 60), Position = UDim2.new(0, 0, 0.32, 0),
	TextXAlignment = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBlack, TextSize = 30,
	TextStrokeTransparency = 0.4, Text = "", Visible = false,
})

-- доля войск для атаки (слева снизу)
local ratioBar = frame(gui, { Size = UDim2.fromOffset(270, 52), Position = UDim2.new(0, 10, 1, -62) })
corner(ratioBar, 10)
label(ratioBar, { Size = UDim2.fromOffset(250, 14), Position = UDim2.fromOffset(10, 3), Text = "Войск в атаку", TextColor3 = COLORS.dim, TextSize = 11 })
local ratioButtons = {}
local RATIOS = { 0.2, 0.4, 0.6, 0.8, 1.0 }
local myRatio = Config.DEFAULT_RATIO
for k, r in ipairs(RATIOS) do
	local b = button(ratioBar, { Size = UDim2.fromOffset(46, 28), Position = UDim2.fromOffset(10 + (k - 1) * 51, 19), Text = math.floor(r * 100) .. "%", TextSize = 13 })
	b.Activated:Connect(function()
		myRatio = r
		Action:FireServer("ratio", r)
	end)
	ratioButtons[r] = b
end

-- режимы и постройки (снизу справа, прокрутка на узком экране)
local bar = Instance.new("ScrollingFrame")
bar.Size = UDim2.new(1, -300, 0, 62)
bar.Position = UDim2.new(0, 290, 1, -66)
bar.BackgroundTransparency = 1
bar.BorderSizePixel = 0
bar.ScrollBarThickness = 3
bar.ScrollingDirection = Enum.ScrollingDirection.X
bar.AutomaticCanvasSize = Enum.AutomaticSize.X
bar.CanvasSize = UDim2.new(0, 0, 0, 0)
bar.Parent = gui
local barList = Instance.new("UIListLayout")
barList.FillDirection = Enum.FillDirection.Horizontal
barList.HorizontalAlignment = Enum.HorizontalAlignment.Right
barList.Padding = UDim.new(0, 6)
barList.SortOrder = Enum.SortOrder.LayoutOrder
barList.Parent = bar

local mode = "attack"
local modeButtons = {}
local MODES = {
	{ id = "attack", name = "Атака" },
	{ id = "City", name = "Город" },
	{ id = "Port", name = "Порт" },
	{ id = "Defense", name = "Турель" },
	{ id = "Factory", name = "Завод" },
	{ id = "Silo", name = "Шахта" },
	{ id = "Nuke", name = "Ракета" },
	{ id = "ally", name = "Союз" },
}
for k, m in ipairs(MODES) do
	local b = button(bar, { Size = UDim2.fromOffset(74, 54), Text = "", LayoutOrder = k })
	label(b, { Name = "Title", Size = UDim2.new(1, 0, 0, 20), Position = UDim2.fromOffset(0, 8), Text = m.name, Font = Enum.Font.GothamBold, TextXAlignment = Enum.TextXAlignment.Center })
	label(b, { Name = "Price", Size = UDim2.new(1, 0, 0, 16), Position = UDim2.fromOffset(0, 30), Text = "", TextSize = 12, TextColor3 = COLORS.accent, TextXAlignment = Enum.TextXAlignment.Center })
	b.Activated:Connect(function()
		mode = (mode == m.id and m.id ~= "attack") and "attack" or m.id
	end)
	modeButtons[m.id] = b
end

-- предложение союза
local requestBox = frame(gui, { Size = UDim2.fromOffset(330, 44), Position = UDim2.new(0.5, -165, 0, 46), Visible = false })
corner(requestBox, 10)
local requestText = label(requestBox, { Size = UDim2.new(1, -170, 1, 0), Position = UDim2.fromOffset(10, 0), TextWrapped = true, TextSize = 13 })
local acceptBtn = button(requestBox, { Size = UDim2.fromOffset(74, 30), Position = UDim2.new(1, -160, 0, 7), Text = "Принять", BackgroundColor3 = Color3.fromRGB(40, 120, 70) })
local declineBtn = button(requestBox, { Size = UDim2.fromOffset(74, 30), Position = UDim2.new(1, -80, 0, 7), Text = "Отказ" })
local requestFrom = nil

local function layout()
	local vp = camera.ViewportSize
	uiScale.Scale = vp.Y < 420 and 0.8 or (vp.Y < 600 and 0.9 or 1)
	board.Visible = boardOpen
end
camera:GetPropertyChangedSignal("ViewportSize"):Connect(layout)
layout()
boardToggle.Activated:Connect(function()
	boardOpen = not boardOpen
	layout()
end)

local function toast(text, color, life)
	local l = label(feed, {
		Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, Text = text, TextWrapped = true,
		TextSize = 13, TextColor3 = color or COLORS.ink, BackgroundTransparency = 0.25, BackgroundColor3 = COLORS.panel,
	})
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 8), UDim.new(0, 8)
	pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 4), UDim.new(0, 4)
	pad.Parent = l
	corner(l, 6)
	local items = feed:GetChildren()
	local count = 0
	for _, c in ipairs(items) do
		if c:IsA("TextLabel") then
			count += 1
		end
	end
	if count > 5 then
		for _, c in ipairs(items) do
			if c:IsA("TextLabel") and c ~= l then
				c:Destroy()
				break
			end
		end
	end
	task.delay(life or 6, function()
		if l.Parent then
			l:Destroy()
		end
	end)
end

local bannerToken = 0
local function showBanner(text, seconds)
	bannerToken += 1
	local token = bannerToken
	banner.Text = text
	banner.Visible = true
	if seconds then
		task.delay(seconds, function()
			if bannerToken == token then
				banner.Visible = false
			end
		end)
	end
end

acceptBtn.Activated:Connect(function()
	if requestFrom then
		Action:FireServer("answer", requestFrom, true)
	end
	requestFrom = nil
	requestBox.Visible = false
end)
declineBtn.Activated:Connect(function()
	if requestFrom then
		Action:FireServer("answer", requestFrom, false)
	end
	requestFrom = nil
	requestBox.Visible = false
end)

-- ------------------------------------------------------------ состояние

local snap, me = nil, nil
local boardRows = {}

local function nationColor(n)
	return Color3.fromRGB(n.color[1], n.color[2], n.color[3])
end

local function renderBoard()
	for _, r in ipairs(boardRows) do
		r:Destroy()
	end
	boardRows = {}
	if not snap then
		return
	end
	local list = {}
	for _, n in ipairs(snap.nations) do
		if n.alive and n.tiles > 0 then
			table.insert(list, n)
		end
	end
	table.sort(list, function(a, b)
		return a.tiles > b.tiles
	end)
	local allies = {}
	if me then
		for _, a in ipairs(me.allies) do
			allies[a] = true
		end
	end
	local shown = {}
	for k, n in ipairs(list) do
		if k <= 7 or (me and n.id == me.id) or allies[n.id] then
			table.insert(shown, { rank = k, n = n })
		end
	end
	boardTitle.Text = string.format("Страны · живых %d · победа %d%% суши", #list, math.floor(Config.WIN_SHARE * 100))
	for k, item in ipairs(shown) do
		local n = item.n
		local row = Instance.new("Frame")
		row.BackgroundTransparency = 1
		row.Size = UDim2.new(1, 0, 0, 24)
		row.LayoutOrder = k
		row.Parent = board
		local sw = frame(row, { Size = UDim2.fromOffset(10, 10), Position = UDim2.fromOffset(0, 7), BackgroundColor3 = nationColor(n), BackgroundTransparency = 0 })
		corner(sw, 3)
		local isMe = me and n.id == me.id
		local name = string.format("%d. %s%s", item.rank, allies[n.id] and "★ " or "", n.name)
		label(row, {
			Size = UDim2.new(1, -112, 1, 0), Position = UDim2.fromOffset(16, 0), Text = name, TextSize = 13,
			TextTruncate = Enum.TextTruncate.AtEnd, Font = isMe and Enum.Font.GothamBold or Enum.Font.GothamMedium,
			TextColor3 = isMe and COLORS.accent or COLORS.ink,
		})
		label(row, {
			Size = UDim2.fromOffset(44, 24), Position = UDim2.new(1, -96, 0, 0), TextSize = 12, TextColor3 = COLORS.dim,
			TextXAlignment = Enum.TextXAlignment.Right, Text = string.format("%.0f%%", n.tiles / snap.land * 100),
		})
		if me and not isMe and me.alive then
			local isAlly = allies[n.id]
			local b = button(row, {
				Size = UDim2.fromOffset(46, 20), Position = UDim2.new(1, -46, 0, 2), TextSize = 11,
				Text = isAlly and "Рвать" or "Союз", BackgroundColor3 = isAlly and Color3.fromRGB(110, 40, 36) or COLORS.panel2,
			})
			local target = n.id
			b.Activated:Connect(function()
				Action:FireServer(isAlly and "break" or "ally", target)
			end)
		end
		table.insert(boardRows, row)
	end
end

local lastPhase
local function renderState()
	if not snap then
		return
	end
	if snap.phase == "spawn" then
		phaseLabel.Text = string.format("Выбери место старта: %d с", snap.timer)
		phaseLabel.TextColor3 = COLORS.accent
	elseif snap.phase == "play" and snap.immune then
		phaseLabel.Text = string.format("Щит: %d с — захватывай ничьи земли", snap.timer)
		phaseLabel.TextColor3 = COLORS.troops
	elseif snap.phase == "play" then
		phaseLabel.Text = string.format("До конца матча %d:%02d", snap.timer // 60, snap.timer % 60)
		phaseLabel.TextColor3 = COLORS.ink
	else
		phaseLabel.Text = "Раунд окончен"
		phaseLabel.TextColor3 = COLORS.dim
	end
	if snap.phase ~= lastPhase then
		if snap.phase == "spawn" then
			showBanner("Нажми на карту — там начнётся твоя страна", 5)
		elseif snap.phase == "play" and lastPhase == "spawn" then
			showBanner("В бой!", 2)
		end
		lastPhase = snap.phase
	end

	if me then
		troopsLabel.Text = string.format("Войска %s / %s%s", fmt(me.troops), fmt(me.max), me.attacking > 0 and (" · в атаке " .. fmt(me.attacking)) or "")
		troopsFill.Size = UDim2.fromScale(math.clamp(me.troops / math.max(1, me.max), 0, 1), 1)
		goldLabel.Text = "Золото " .. fmt(me.gold)
		landLabel.Text = string.format("Земля %d клеток · %.1f%% суши", me.tiles, me.tiles / snap.land * 100)
		myRatio = me.ratio
	else
		troopsLabel.Text = "Ты зритель"
		goldLabel.Text = ""
		landLabel.Text = "Новый раунд скоро"
	end
	for r, b in pairs(ratioButtons) do
		b.BackgroundColor3 = math.abs(r - myRatio) < 0.01 and Color3.fromRGB(60, 100, 160) or COLORS.panel2
	end
	for id, b in pairs(modeButtons) do
		local price = me and me.costs[id]
		b.Price.Text = price and fmt(price) or (id == "attack" and "по тапу" or (id == "ally" and "тап по стране" or ""))
		local can = not price or (me and me.gold >= price)
		b.Price.TextColor3 = can and COLORS.accent or COLORS.bad
		b.BackgroundColor3 = mode == id and Color3.fromRGB(160, 100, 20) or COLORS.panel2
	end
	renderBoard()
end

State.OnClientEvent:Connect(function(s, mine)
	snap, me = s, mine
	renderState()
end)

Notice.OnClientEvent:Connect(function(data)
	if data.request then
		requestFrom = data.request
		requestText.Text = data.text
		requestBox.Visible = true
		task.delay(18, function()
			if requestFrom == data.request then
				requestBox.Visible = false
				requestFrom = nil
			end
		end)
	elseif data.win then
		showBanner(data.text, Config.RESTART_DELAY)
		toast(data.text, COLORS.accent, 10)
	else
		toast(data.text, data.bad and COLORS.bad or nil)
	end
end)

-- ------------------------------------------------------------ нажатия на карту

local marker = Instance.new("Part")
marker.Name = "FrontMarker"
marker.Anchored = true
marker.CanCollide = false
marker.CanQuery = false
marker.Material = Enum.Material.Neon
marker.Color = COLORS.accent
marker.Transparency = 1
marker.Size = Vector3.new(T * 0.9, 0.2, T * 0.9)
marker.Parent = workspace

local function flashMarker(i)
	marker.Position = tileTop(i) + Vector3.new(0, 0.15, 0)
	marker.Transparency = 0.2
	TweenService:Create(marker, TweenInfo.new(0.5), { Transparency = 1 }):Play()
end

local function tap(screenPos)
	local folder = currentMap()
	if not folder then
		return
	end
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = { folder }
	local ray = camera:ScreenPointToRay(screenPos.X, screenPos.Y)
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 3000, params)
	if not hit then
		return
	end
	local i = hit.Instance:GetAttribute("I")
	if not i then
		return
	end
	flashMarker(i)
	if mode == "attack" then
		Action:FireServer("tap", i)
	elseif mode == "Nuke" then
		Action:FireServer("nuke", i)
		mode = "attack"
	elseif mode == "ally" then
		Action:FireServer("allyAt", i)
		mode = "attack"
	else
		Action:FireServer("build", i, mode)
	end
	renderState()
end

-- мышь: клик — действие, перетаскивание — сдвиг карты, колесо — зум
local mouseDown = nil
UserInputService.InputBegan:Connect(function(input, gp)
	if gp then
		return
	end
	if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.MouseButton2 then
		mouseDown = { start = Vector2.new(input.Position.X, input.Position.Y), last = Vector2.new(input.Position.X, input.Position.Y), moved = false, button = input.UserInputType }
	end
end)
UserInputService.InputChanged:Connect(function(input, gp)
	if input.UserInputType == Enum.UserInputType.MouseWheel and not gp then
		zoom = math.clamp(zoom * (input.Position.Z > 0 and 0.88 or 1.14), ZOOM_MIN, ZOOM_MAX)
	elseif input.UserInputType == Enum.UserInputType.MouseMovement and mouseDown then
		local p = Vector2.new(input.Position.X, input.Position.Y)
		if (p - mouseDown.start).Magnitude > 6 then
			mouseDown.moved = true
		end
		if mouseDown.moved then
			pan(p - mouseDown.last)
		end
		mouseDown.last = p
	end
end)
UserInputService.InputEnded:Connect(function(input)
	if mouseDown and input.UserInputType == mouseDown.button then
		if not mouseDown.moved and mouseDown.button == Enum.UserInputType.MouseButton1 then
			tap(mouseDown.start)
		end
		mouseDown = nil
	end
end)

-- пальцы: тап — действие, один палец — сдвиг, два — зум щипком
local touches = {}
local gestureMulti = false
local function touchCount()
	local c = 0
	for _ in pairs(touches) do
		c += 1
	end
	return c
end
UserInputService.TouchStarted:Connect(function(input, gp)
	if gp then
		return
	end
	local p = Vector2.new(input.Position.X, input.Position.Y)
	touches[input] = { start = p, pos = p, moved = false }
	if touchCount() > 1 then
		gestureMulti = true
	end
end)
UserInputService.TouchMoved:Connect(function(input)
	local t = touches[input]
	if not t then
		return
	end
	local p = Vector2.new(input.Position.X, input.Position.Y)
	local count = touchCount()
	if count == 1 then
		if (p - t.start).Magnitude > 12 then
			t.moved = true
		end
		if t.moved then
			pan(p - t.pos)
		end
	elseif count == 2 then
		local other
		for k, v in pairs(touches) do
			if k ~= input then
				other = v
			end
		end
		local before = (t.pos - other.pos).Magnitude
		local after = (p - other.pos).Magnitude
		if before > 10 and after > 10 then
			zoom = math.clamp(zoom * before / after, ZOOM_MIN, ZOOM_MAX)
		end
		pan((p - t.pos) * 0.5)
		t.moved = true
	end
	t.pos = p
end)
UserInputService.TouchEnded:Connect(function(input)
	local t = touches[input]
	touches[input] = nil
	if t and not t.moved and not gestureMulti then
		tap(t.start)
	end
	if touchCount() == 0 then
		gestureMulti = false
	end
end)

-- ------------------------------------------------------------ эффекты

local fxFolder = Instance.new("Folder")
fxFolder.Name = "FrontFx"
fxFolder.Parent = workspace
local movers = {}

local function waterPoint(i)
	return Config.tileCenter(i) + Vector3.new(0, 0.05, 0)
end

local function addShip(data)
	local m = Models.make(data.kind, data.color, data.kind == "TradeShip" and T * 0.55 or T * 0.5)
	m.Parent = fxFolder
	local pts = {}
	for _, i in ipairs(data.path) do
		table.insert(pts, waterPoint(i))
	end
	table.insert(movers, { model = m, pts = pts, t = 0, duration = data.duration, kind = "ship" })
end

local function addNuke(data)
	local m = Models.make("Nuke", data.color, T * 0.5)
	m.Parent = fxFolder
	table.insert(movers, { model = m, from = tileTop(data.from), to = tileTop(data.to), t = 0, duration = data.duration, kind = "nuke" })
end

local function addTank(data)
	local m = Models.make("Tank", data.color, T * 0.45)
	m.Parent = fxFolder
	table.insert(movers, { model = m, from = tileTop(data.from), to = tileTop(data.to), t = 0, duration = 1.0, kind = "tank" })
end

local function boom(data)
	local center = tileTop(data.tile)
	local ball = Instance.new("Part")
	ball.Shape = Enum.PartType.Ball
	ball.Anchored = true
	ball.CanCollide = false
	ball.CanQuery = false
	ball.Material = Enum.Material.Neon
	ball.Color = Color3.fromRGB(255, 170, 60)
	ball.Size = Vector3.new(2, 2, 2)
	ball.Position = center
	ball.Parent = fxFolder
	local r = data.radius * T * 2.2
	TweenService:Create(ball, TweenInfo.new(0.7, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = Vector3.new(r, r, r) }):Play()
	TweenService:Create(ball, TweenInfo.new(1.6), { Transparency = 1, Color = Color3.fromRGB(80, 70, 60) }):Play()
	task.delay(1.7, function()
		ball:Destroy()
	end)
	if (center - focus).Magnitude < zoom * 1.5 then
		local shakeEnd = os.clock() + 0.5
		task.spawn(function()
			while os.clock() < shakeEnd do
				focus += Vector3.new(math.random(-10, 10) / 10, 0, math.random(-10, 10) / 10)
				task.wait(0.03)
			end
		end)
	end
end

local yaw = CFrame.Angles(0, math.rad(Config.MODEL_YAW), 0)

RunService.RenderStepped:Connect(function(dt)
	local keep = {}
	for _, mv in ipairs(movers) do
		mv.t += dt
		local u = math.clamp(mv.t / mv.duration, 0, 1)
		if mv.kind == "ship" then
			local n = #mv.pts
			if n >= 2 then
				local f = u * (n - 1)
				local k = math.clamp(math.floor(f) + 1, 1, n - 1)
				local a, b = mv.pts[k], mv.pts[k + 1]
				local pos = a:Lerp(b, f - (k - 1))
				mv.model:PivotTo(CFrame.lookAt(pos, pos + (b - a)) * yaw)
			elseif n == 1 then
				mv.model:PivotTo(CFrame.new(mv.pts[1]))
			end
		elseif mv.kind == "nuke" then
			local h = 25 + (mv.to - mv.from).Magnitude * 0.35
			local function at(v)
				return mv.from:Lerp(mv.to, v) + Vector3.new(0, math.sin(v * math.pi) * h, 0)
			end
			local pos, ahead = at(u), at(math.min(1, u + 0.02))
			if (ahead - pos).Magnitude > 0.01 then
				mv.model:PivotTo(CFrame.lookAt(pos, ahead) * yaw)
			end
		else
			local pos = mv.from:Lerp(mv.to, u)
			local dir = mv.to - mv.from
			if dir.Magnitude > 0.01 then
				mv.model:PivotTo(CFrame.lookAt(pos, pos + Vector3.new(dir.X, 0, dir.Z)) * yaw)
			end
		end
		if u >= 1 then
			mv.model:Destroy()
		else
			table.insert(keep, mv)
		end
	end
	movers = keep
end)

Fx.OnClientEvent:Connect(function(kind, data)
	if kind == "ship" then
		addShip(data)
	elseif kind == "nuke" then
		addNuke(data)
	elseif kind == "boom" then
		boom(data)
	elseif kind == "tank" then
		if #movers < 80 then
			addTank(data)
		end
	elseif kind == "reset" then
		for _, mv in ipairs(movers) do
			mv.model:Destroy()
		end
		movers = {}
		focus = Vector3.zero
		zoom = 240
		mode = "attack"
	end
end)
