-- The world map on screen: terrain and territory images, pan/zoom, deposits, buildings,
-- units, nation labels and capture effects. Everything sits on a "board" frame, so markers
-- placed with scale coordinates follow the map when it moves.
local GuiService = game:GetService("GuiService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Codec = require(Shared.Codec)
local Motion = require(Shared.Motion)
local Theme = require(script.Parent.Theme)
local Sprites = require(script.Parent.Sprites)

local W, H, N = Map.W, Map.H, Map.N
local readu8, writeu8 = buffer.readu8, buffer.writeu8
local readu16, writeu16 = buffer.readu16, buffer.writeu16
local make = Theme.make
local C = Theme.C

local MapView = {}
MapView.onTap = nil :: ((number, number, number, number) -> ())?
MapView.myId = 0
MapView.phase = "none"
MapView.mode = "menu"
MapView.ok = true
MapView.nations = {}

local nations = MapView.nations
local owner = buffer.create(N * 2)
local ov = buffer.create(N * 4)
local buildings = {}
local units = {}
local labels = {}
local depMarks = {}
local dirtyRect = nil

local gui, root, board, depLayer, bldLayer, unitLayer, fxLayer, labelLayer, shade
local ovImg
local view = { z = 1, x = 0, y = 0 }
local anim = nil
local cw, ch = 1, 1
local lastZ = -1
local labelAcc = 0

---------------------------------------------------------------- helpers

local function lerp(a: number, b: number, k: number): number
	return a + (b - a) * k
end

local function smooth(a: number, b: number, v: number): number
	local k = math.clamp((v - a) / (b - a), 0, 1)
	return k * k * (3 - 2 * k)
end

local function u8(v: number): number
	return math.clamp(math.floor(v + 0.5), 0, 255)
end

local function hash(x: number, y: number): number
	local n = math.sin(x * 12.9898 + y * 78.233) * 43758.5453
	return n - math.floor(n)
end

-- smooth noise in about 0..1
local function noise(x: number, y: number, scale: number, seed: number): number
	return math.clamp(math.noise(x / scale + 0.37, y / scale + 0.71, seed + 0.13) * 1.25 + 0.5, 0, 1)
end

function MapView.fmt(v: number): string
	v = math.max(0, v)
	if v < 1000 then
		return tostring(math.round(v))
	elseif v < 10000 then
		return string.format("%.2fK", v / 1000)
	elseif v < 100000 then
		return string.format("%.1fK", v / 1000)
	end
	return string.format("%dK", math.round(v / 1000))
end

local function zMin(): number
	return math.min(cw / W, ch / H) * 0.95
end
local Z_MAX = 30

---------------------------------------------------------------- terrain

local function buildTerrain(): buffer
	local px = buffer.create(N * 4)
	local biome, wdist, coast, dep = Map.biomeBuf, Map.wdistBuf, Map.coastBuf, Map.depBuf
	for t = 0, N - 1 do
		local x, y = t % W, t // W
		local j = hash(x, y) - 0.5
		local bi = readu8(biome, t)
		local r, g, b
		if bi == 0 then
			local k = smooth(0, 1, math.min(readu8(wdist, t), 6) / 6)
			local n = noise(x, y, 26, 3) - 0.5
			r, g, b = lerp(96, 36, k) + n * 8, lerp(158, 92, k) + n * 10, lerp(202, 148, k) + n * 10
		elseif bi == 1 then
			local f = noise(x, y, 10, 5) + (noise(x, y, 3, 6) - 0.5) * 0.4
			local m = smooth(0.48, 0.66, f)
			r, g, b = lerp(170, 112, m), lerp(202, 158, m), lerp(114, 80, m)
			if readu8(coast, t) == 1 and noise(x, y, 5, 8) > 0.6 then
				r, g, b = 228, 214, 162
			end
			r, g, b = r + j * 9, g + j * 9, b + j * 7
		elseif bi == 2 then
			local n = noise(x, y, 5, 11) - 0.5
			r, g, b = 233 + n * 16 + j * 6, 211 + n * 14 + j * 6, 153 + n * 10 + j * 5
		elseif bi == 3 then
			local m = noise(x, y, 4, 12)
			if m > 0.8 then
				r, g, b = 236, 238, 240
			else
				local k = smooth(0.5, 0.72, m)
				r, g, b = lerp(158, 196, k), lerp(142, 184, k), lerp(118, 160, k)
			end
			r, g, b = r + j * 10, g + j * 10, b + j * 10
		elseif bi == 4 then
			local n = noise(x, y, 7, 13) - 0.5
			r, g, b = 238 + n * 10 + j * 4, 243 + n * 6 + j * 4, 247 + j * 3
		else
			local m = noise(x, y, 6, 14)
			r, g, b = lerp(198, 168, m) + j * 7, lerp(210, 190, m) + j * 7, lerp(190, 160, m) + j * 6
		end
		local d = readu8(dep, t)
		if d ~= 0 then
			local alt = hash(x + 0.5, y + 0.25) > 0.5
			if d == 1 then
				r, g, b = if alt then 196 else 160, if alt then 112 else 88, if alt then 76 else 62
			elseif d == 2 then
				r, g, b = if alt then 84 else 58, if alt then 86 else 60, if alt then 94 else 68
			else
				r, g, b = if alt then 46 else 30, if alt then 44 else 30, if alt then 58 else 38
			end
		end
		local o = t * 4
		writeu8(px, o, u8(r))
		writeu8(px, o + 1, u8(g))
		writeu8(px, o + 2, u8(b))
		writeu8(px, o + 3, 255)
	end
	return px
end

---------------------------------------------------------------- territory overlay

local GRAY, GRAY_B = Config.SPAWN_GRAY, Config.SPAWN_GRAY_BORDER
local nbPaint, nbSet = {}, {}

local function paint(t: number)
	local o = readu16(owner, t * 2)
	local k = t * 4
	local n = if o ~= 0 then nations[o] else nil
	if not n then
		writeu8(ov, k + 3, 0)
		return
	end
	local c = Map.neighbors(t, nbPaint)
	local border = c < 4
	if not border then
		for i = 1, c do
			if readu16(owner, nbPaint[i] * 2) ~= o then
				border = true
				break
			end
		end
	end
	local gray = MapView.phase == "spawn" and o ~= MapView.myId
	local col
	if gray then
		col = if border then GRAY_B else GRAY
	else
		col = if border then n.rgbB else n.rgb
	end
	writeu8(ov, k, col[1])
	writeu8(ov, k + 1, col[2])
	writeu8(ov, k + 2, col[3])
	local alpha = 112
	if border then
		alpha = 235
	elseif gray then
		alpha = 150
	elseif o == MapView.myId then
		alpha = 132
	end
	writeu8(ov, k + 3, alpha)
end

local function markDirty(x: number, y: number)
	local x0, y0, x1, y1 = math.max(0, x - 1), math.max(0, y - 1), math.min(W - 1, x + 1), math.min(H - 1, y + 1)
	if not dirtyRect then
		dirtyRect = { x0, y0, x1, y1 }
	else
		dirtyRect[1] = math.min(dirtyRect[1], x0)
		dirtyRect[2] = math.min(dirtyRect[2], y0)
		dirtyRect[3] = math.max(dirtyRect[3], x1)
		dirtyRect[4] = math.max(dirtyRect[4], y1)
	end
end

local function setTile(t: number, o: number)
	local old = readu16(owner, t * 2)
	if old == o then
		return
	end
	local x, y = t % W, t // W
	local on = nations[old]
	if old ~= 0 and on then
		on.count -= 1
		on.sx -= x
		on.sy -= y
	end
	writeu16(owner, t * 2, o)
	local nn = nations[o]
	if o ~= 0 and nn then
		nn.count += 1
		nn.sx += x
		nn.sy += y
	end
	paint(t)
	local c = Map.neighbors(t, nbSet)
	for i = 1, c do
		paint(nbSet[i])
	end
	markDirty(x, y)
end

local function repaintAll()
	for t = 0, N - 1 do
		paint(t)
	end
	dirtyRect = { 0, 0, W - 1, H - 1 }
end

local function flushOverlay()
	if not dirtyRect or not ovImg then
		return
	end
	local x0, y0, x1, y1 = dirtyRect[1], dirtyRect[2], dirtyRect[3], dirtyRect[4]
	dirtyRect = nil
	local w, h = x1 - x0 + 1, y1 - y0 + 1
	if w * h > N // 3 then
		ovImg:WritePixelsBuffer(Vector2.zero, Vector2.new(W, H), ov)
		return
	end
	local sub = buffer.create(w * h * 4)
	for row = 0, h - 1 do
		buffer.copy(sub, row * w * 4, ov, ((y0 + row) * W + x0) * 4, w * 4)
	end
	ovImg:WritePixelsBuffer(Vector2.new(x0, y0), Vector2.new(w, h), sub)
end

function MapView.ownerAt(x: number, y: number): number
	if not Map.inBounds(x, y) then
		return 0
	end
	return readu16(owner, (y * W + x) * 2)
end

---------------------------------------------------------------- setup

local function tilePos(x: number, y: number): UDim2
	return UDim2.fromScale(x / W, y / H)
end

function MapView.init(playerGui: PlayerGui)
	gui = make("ScreenGui", {
		Name = "TerraForgeMap",
		ResetOnSpawn = false,
		IgnoreGuiInset = true,
		DisplayOrder = 0,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	})
	gui.ScreenInsets = Enum.ScreenInsets.None
	root = make("Frame", {
		Name = "Root",
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = C.ocean,
		BorderSizePixel = 0,
		ClipsDescendants = true,
		Parent = gui,
	})
	board = make("Frame", { Name = "Board", BackgroundTransparency = 1, BorderSizePixel = 0, Parent = root })
	local baseLabel = make("ImageLabel", {
		Name = "Terrain",
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		ResampleMode = Enum.ResamplerMode.Pixelated,
		ZIndex = 1,
		Parent = board,
	})
	local ovLabel = make("ImageLabel", {
		Name = "Territory",
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		ResampleMode = Enum.ResamplerMode.Pixelated,
		ZIndex = 2,
		Parent = board,
	})
	local function layer(name: string, z: number)
		return make("Frame", { Name = name, Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ZIndex = z, Parent = board })
	end
	depLayer = layer("Deposits", 3)
	bldLayer = layer("Buildings", 4)
	unitLayer = layer("Units", 5)
	fxLayer = layer("Effects", 6)
	labelLayer = layer("Labels", 7)
	shade = make("Frame", {
		Name = "MenuShade",
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = C.bg,
		BackgroundTransparency = 0,
		BorderSizePixel = 0,
		ZIndex = 10,
		Parent = root,
	}, {
		make("UIGradient", {
			Rotation = 90,
			Transparency = NumberSequence.new({
				NumberSequenceKeypoint.new(0, 0.45),
				NumberSequenceKeypoint.new(0.35, 0.82),
				NumberSequenceKeypoint.new(0.65, 0.7),
				NumberSequenceKeypoint.new(1, 0.08),
			}),
		}),
	})
	gui.Parent = playerGui

	local baseImg = Sprites.create(Vector2.new(W, H))
	ovImg = Sprites.create(Vector2.new(W, H))
	if not baseImg or not ovImg then
		MapView.ok = false
	else
		baseImg:WritePixelsBuffer(Vector2.zero, Vector2.new(W, H), buildTerrain())
		baseLabel.ImageContent = Content.fromObject(baseImg)
		ovLabel.ImageContent = Content.fromObject(ovImg)
	end

	for _, d in Map.deposits do
		local mark = make("ImageLabel", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = tilePos(d.x + 0.5, d.y + 0.5),
			BackgroundTransparency = 1,
			ImageTransparency = 0.08,
			Parent = depLayer,
		})
		local icon = if d.kind == 3 then "drop" else "ore"
		local color = if d.kind == 1 then "#d97c4c" elseif d.kind == 2 then "#4b4f5a" else "#2c2e38"
		Sprites.apply(mark, icon, color)
		table.insert(depMarks, { gui = mark, t = d.y * W + d.x })
	end

	MapView.fit()
	MapView.setupInput()
end

---------------------------------------------------------------- view

local function clampView()
	view.z = math.clamp(view.z, zMin(), Z_MAX)
	local mw, mh = W * view.z, H * view.z
	view.x = math.clamp(view.x, math.min(cw - mw, 0) - cw * 0.25, math.max(cw - mw, 0) + cw * 0.25)
	view.y = math.clamp(view.y, math.min(ch - mh, 0) - ch * 0.25, math.max(ch - mh, 0) + ch * 0.25)
end

function MapView.fit()
	cw, ch = math.max(root.AbsoluteSize.X, 1), math.max(root.AbsoluteSize.Y, 1)
	local z = math.min(cw / W, ch / H)
	view.z = z
	view.x = (cw - W * z) / 2
	view.y = (ch - H * z) / 2
end

function MapView.nudge(dy: number)
	view.y += dy
	clampView()
end

local function zoomAt(sx: number, sy: number, f: number)
	local nz = math.clamp(view.z * f, zMin(), Z_MAX)
	local k = nz / view.z
	view.x = sx - (sx - view.x) * k
	view.y = sy - (sy - view.y) * k
	view.z = nz
	clampView()
end

function MapView.zoom(f: number)
	anim = nil
	zoomAt(cw / 2, ch / 2, f)
end

function MapView.flyTo(x: number, y: number, z: number, seconds: number)
	z = math.clamp(z, zMin(), Z_MAX)
	anim = {
		from = { z = view.z, x = view.x, y = view.y },
		to = { z = z, x = cw / 2 - x * z, y = ch / 2 - y * z },
		t0 = os.clock(),
		d = seconds,
	}
end

local function screenPoint(input: InputObject): Vector2
	local inset = GuiService:GetGuiInset()
	return Vector2.new(input.Position.X, input.Position.Y) + inset
end

function MapView.setupInput()
	local touches = {}
	local touchCount = 0
	local gesture = nil

	local function pointerDown(input: InputObject)
		local p = screenPoint(input)
		anim = nil
		if input.UserInputType == Enum.UserInputType.Touch then
			touches[input] = p
			touchCount += 1
		end
		if touchCount <= 1 then
			gesture = { start = p, last = p, moved = false }
		elseif gesture then
			gesture.moved = true
			gesture.pinch = nil
		end
	end

	UserInputService.InputBegan:Connect(function(input, processed)
		if processed or MapView.mode ~= "play" then
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			pointerDown(input)
		end
	end)

	UserInputService.InputChanged:Connect(function(input, processed)
		if MapView.mode ~= "play" then
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseWheel then
			if processed then
				return
			end
			local m = UserInputService:GetMouseLocation()
			anim = nil
			zoomAt(m.X, m.Y, if input.Position.Z > 0 then 1.18 else 1 / 1.18)
			return
		end
		if not gesture then
			return
		end
		if input.UserInputType == Enum.UserInputType.Touch then
			if not touches[input] then
				return
			end
			touches[input] = screenPoint(input)
			if touchCount >= 2 then
				local pts = {}
				for _, v in touches do
					table.insert(pts, v)
					if #pts == 2 then
						break
					end
				end
				local a, b = pts[1], pts[2]
				local dist = (a - b).Magnitude
				local mid = (a + b) / 2
				if gesture.pinch then
					zoomAt(mid.X, mid.Y, dist / math.max(gesture.pinch.dist, 1))
					view.x += mid.X - gesture.pinch.mid.X
					view.y += mid.Y - gesture.pinch.mid.Y
					clampView()
				end
				gesture.pinch = { dist = dist, mid = mid }
				return
			end
		elseif input.UserInputType ~= Enum.UserInputType.MouseMovement then
			return
		end
		local p = screenPoint(input)
		if not gesture.moved and (p - gesture.start).Magnitude > 8 then
			gesture.moved = true
		end
		if gesture.moved then
			view.x += p.X - gesture.last.X
			view.y += p.Y - gesture.last.Y
			clampView()
		end
		gesture.last = p
	end)

	UserInputService.InputEnded:Connect(function(input)
		local isTouch = input.UserInputType == Enum.UserInputType.Touch
		if not isTouch and input.UserInputType ~= Enum.UserInputType.MouseButton1 then
			return
		end
		if isTouch then
			if not touches[input] then
				return
			end
			touches[input] = nil
			touchCount = math.max(0, touchCount - 1)
		end
		if gesture and touchCount == 0 then
			if not gesture.moved and MapView.mode == "play" and MapView.onTap then
				local p = screenPoint(input)
				local x = math.floor((p.X - view.x) / view.z)
				local y = math.floor((p.Y - view.y) / view.z)
				if Map.inBounds(x, y) then
					MapView.onTap(x, y, p.X, p.Y)
				end
			end
			gesture = nil
		elseif gesture and touchCount == 1 then
			for _, v in touches do
				gesture.last = v
			end
			gesture.pinch = nil
		end
	end)
end

---------------------------------------------------------------- nations

local function removeLabel(id: number)
	local l = labels[id]
	if l then
		l.frame:Destroy()
		labels[id] = nil
	end
end

function MapView.upsertNation(info)
	local n = nations[info.id]
	if not n then
		n = { id = info.id, count = 0, sx = 0, sy = 0, troops = 0 }
		nations[info.id] = n
	end
	local colorChanged = n.color ~= info.color
	n.name = info.name
	n.color = info.color
	n.human = info.human
	n.userId = info.userId
	n.alive = info.alive
	n.cap = if info.cap then { x = info.cap[1], y = info.cap[2] } else nil
	if colorChanged then
		local r, g, b = Sprites.hexRGB(info.color)
		n.rgb = { r, g, b }
		local r2, g2, b2 = Sprites.shade(r, g, b, -0.25)
		n.rgbB = { r2, g2, b2 }
		n.color3 = Color3.fromRGB(r, g, b)
	end
	if not n.alive then
		removeLabel(n.id)
		for id, u in units do
			if u.owner == n.id then
				MapView.removeUnit(id)
			end
		end
		for id, b in buildings do
			if b.owner == n.id then
				MapView.removeBuilding(id)
			end
		end
	elseif labels[n.id] then
		-- name or avatar may have changed (a player left and a bot took over)
		removeLabel(n.id)
	end
end

function MapView.setStats(s)
	for i = 1, #s - 1, 2 do
		local n = nations[s[i]]
		if n then
			n.troops = s[i + 1]
		end
	end
end

local function makeLabel(n)
	local frame = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundTransparency = 1,
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		Parent = labelLayer,
	}, {
		Theme.list(Enum.FillDirection.Horizontal, 4, Enum.HorizontalAlignment.Center, Enum.VerticalAlignment.Center),
	})
	local avatar = nil
	if n.human and n.userId and n.userId > 0 then
		avatar = make("ImageLabel", {
			BackgroundColor3 = C.panelHi,
			Image = "rbxthumb://type=AvatarHeadShot&id=" .. n.userId .. "&w=150&h=150",
			LayoutOrder = 1,
			Parent = frame,
		}, {
			Theme.corner(nil, 1),
			make("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 2 }),
		})
	end
	local col = make("Frame", {
		BackgroundTransparency = 1,
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		LayoutOrder = 2,
		Parent = frame,
	}, {
		Theme.list(Enum.FillDirection.Vertical, -2, Enum.HorizontalAlignment.Center),
	})
	local name = Theme.label({
		Text = n.name,
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		FontFace = Theme.font(Enum.FontWeight.Heavy),
		TextXAlignment = Enum.TextXAlignment.Center,
		TextStrokeColor3 = C.dark,
		TextStrokeTransparency = 0.2,
		LayoutOrder = 1,
		Parent = col,
	})
	local troops = Theme.label({
		Text = "",
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		FontFace = Theme.font(Enum.FontWeight.Bold),
		TextXAlignment = Enum.TextXAlignment.Center,
		TextColor3 = if n.id == MapView.myId then Color3.fromRGB(255, 208, 227) else Color3.fromRGB(242, 242, 238),
		TextStrokeColor3 = C.dark,
		TextStrokeTransparency = 0.25,
		LayoutOrder = 2,
		Parent = col,
	})
	local l = { frame = frame, avatar = avatar, name = name, troops = troops }
	labels[n.id] = l
	return l
end

local function updateLabels()
	local list = {}
	for _, n in nations do
		if n.alive and n.count > 0 then
			table.insert(list, n)
		else
			removeLabel(n.id)
		end
	end
	local me = MapView.myId
	table.sort(list, function(a, b)
		if (a.id == me) ~= (b.id == me) then
			return a.id == me
		end
		return a.count > b.count
	end)
	local boxes = {}
	local spawnish = MapView.phase == "spawn"
	local showAll = MapView.mode == "play"
	for _, n in list do
		local cx, cy
		if spawnish and n.cap then
			cx, cy = n.cap.x + 0.5, n.cap.y + 0.5
		else
			cx, cy = n.sx / n.count + 0.5, n.sy / n.count + 0.5
		end
		local sx, sy = view.x + cx * view.z, view.y + cy * view.z
		local fs = math.min(math.sqrt(n.count) * view.z * 0.27, 30)
		if n.id == me then
			fs = math.max(fs, 13)
		elseif spawnish and view.z > 1.6 then
			fs = math.max(fs, 9)
		end
		local visible = showAll and fs >= 8 and sx > -200 and sy > -100 and sx < cw + 200 and sy < ch + 100
		local l = labels[n.id]
		if visible then
			local width = utf8.len(n.name) * fs * 0.62 + (if n.human then fs * 1.9 else 0)
			local box = { sx - width / 2, sy - fs * 0.8, width, fs * 1.8 }
			for _, o in boxes do
				if box[1] < o[1] + o[3] and o[1] < box[1] + box[3] and box[2] < o[2] + o[4] and o[2] < box[2] + box[4] then
					visible = false
					break
				end
			end
			if visible then
				table.insert(boxes, box)
			end
		end
		if visible then
			l = l or makeLabel(n)
			l.frame.Visible = true
			l.frame.Position = UDim2.fromScale(cx / W, cy / H)
			l.name.TextSize = math.floor(fs)
			l.troops.TextSize = math.max(7, math.floor(fs * 0.64))
			l.troops.Text = MapView.fmt(n.troops)
			if l.avatar then
				local a = math.floor(fs * 1.6)
				l.avatar.Size = UDim2.fromOffset(a, a)
			end
		elseif l then
			l.frame.Visible = false
		end
	end
end

---------------------------------------------------------------- health bars

local function hpBar(parent: Instance, above: boolean)
	local bg = make("Frame", {
		AnchorPoint = Vector2.new(0.5, if above then 1 else 0),
		Position = if above then UDim2.new(0.5, 0, 0, -3) else UDim2.new(0.5, 0, 1, 1),
		Size = UDim2.new(0.9, 0, 0, 4),
		BackgroundColor3 = C.dark,
		BackgroundTransparency = 0.15,
		BorderSizePixel = 0,
		Visible = false,
		ZIndex = 3,
		Parent = parent,
	})
	local fill = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = C.ok, BorderSizePixel = 0, ZIndex = 4, Parent = bg })
	return bg, fill
end

local function setHp(rec)
	local k = math.clamp(rec.hp / math.max(rec.maxHp, 1), 0, 1)
	rec.hpBg.Visible = k < 0.999 and view.z >= 2
	rec.hpFill.Size = UDim2.fromScale(k, 1)
	rec.hpFill.BackgroundColor3 = if k > 0.5 then C.ok elseif k > 0.25 then C.moltenHi else C.bad
end

---------------------------------------------------------------- buildings

function MapView.addBuilding(b)
	if buildings[b.id] then
		return
	end
	local n = nations[b.owner]
	local color = if n then n.color else "#cccccc"
	local plate = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = tilePos(b.x + 0.5, b.y + 0.5),
		BackgroundColor3 = C.panel,
		BackgroundTransparency = 0.08,
		BorderSizePixel = 0,
		Parent = bldLayer,
	}, {
		Theme.corner(nil, 0.24),
		make("UIStroke", { Color = if n then n.color3 else C.ink, Thickness = 2 }),
	})
	local icon = make("ImageLabel", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Parent = plate })
	Sprites.apply(icon, Config.BUILD[b.kind].icon, color)
	local bar = make("Frame", {
		Position = UDim2.new(0, 0, 1, 3),
		Size = UDim2.new(0, 0, 0, 4),
		BackgroundColor3 = C.molten,
		BorderSizePixel = 0,
		Visible = false,
		Parent = plate,
	})
	local warn = make("ImageLabel", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(1, 0),
		Size = UDim2.fromOffset(14, 14),
		BackgroundColor3 = C.bad,
		Visible = false,
		Parent = plate,
	}, { Theme.corner(nil, 1) })
	Sprites.apply(warn, "energy")
	local hpBg, hpFill = hpBar(plate, true)
	local rec = {
		id = b.id,
		kind = b.kind,
		owner = b.owner,
		x = b.x,
		y = b.y,
		hp = b.hp or 1,
		maxHp = b.maxHp or 1,
		plate = plate,
		icon = icon,
		bar = bar,
		warn = warn,
		hpBg = hpBg,
		hpFill = hpFill,
	}
	buildings[b.id] = rec
	setHp(rec)
	for _, d in depMarks do
		if d.t == b.y * W + b.x then
			d.hidden = true
		end
	end
	lastZ = -1
end

function MapView.removeBuilding(id: number)
	local b = buildings[id]
	if b then
		b.plate:Destroy()
		buildings[id] = nil
		for _, d in depMarks do
			if d.t == b.y * W + b.x then
				d.hidden = false
			end
		end
		lastZ = -1
	end
end

-- prog: flat list of building id, progress (negative = waiting for resources), powered (1/0)
function MapView.setProgress(prog)
	for i = 1, #prog - 2, 3 do
		local b = buildings[prog[i]]
		if b then
			local p, on = prog[i + 1], prog[i + 2] == 1
			local def = Config.BUILD[b.kind]
			if def.unit then
				b.bar.Visible = view.z >= 3.5
				b.bar.Size = UDim2.new(math.abs(p), 0, 0, 4)
				b.bar.BackgroundColor3 = if p < 0 then C.bad else C.molten
			end
			b.warn.Visible = not on and def.power > 0 and view.z >= 3.5
		end
	end
end

-- list: flat building id, hp
function MapView.setBuildingHp(list)
	for i = 1, #list - 1, 2 do
		local b = buildings[list[i]]
		if b then
			b.hp = list[i + 1]
			setHp(b)
		end
	end
end

---------------------------------------------------------------- units

MapView.selected = {}

function MapView.addUnit(u)
	local rec = units[u.id]
	if rec then
		rec.path = u.path
		rec.t0 = u.t0
		rec.speed = u.speed
		rec.orbit = u.orbit
		rec.hp = u.hp
		rec.maxHp = u.maxHp
		setHp(rec)
		return
	end
	local n = nations[u.owner]
	local color = if n then n.color else "#cccccc"
	local holder = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundTransparency = 1,
		Parent = unitLayer,
	})
	local ring = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromScale(1.35, 1.35),
		BackgroundColor3 = Color3.new(1, 1, 1),
		BackgroundTransparency = 0.82,
		Visible = false,
		Parent = holder,
	}, { Theme.corner(nil, 1), make("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 2 }) })
	local imgs = {}
	local spots = if u.kind == "infantry" then { { 0.22, 0.45, 0.8 }, { 0.78, 0.45, 0.8 }, { 0.5, 0.56, 0.86 } } else { { 0.5, 0.5, 1 } }
	for _, s in spots do
		local img = make("ImageLabel", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(s[1], s[2]),
			Size = UDim2.fromScale(s[3], s[3]),
			BackgroundTransparency = 1,
			ZIndex = 2,
			Parent = holder,
		})
		Sprites.apply(img, u.kind, color)
		table.insert(imgs, img)
	end
	local dot = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(6, 6),
		BackgroundColor3 = if n then n.color3 else C.ink,
		Visible = false,
		ZIndex = 2,
		Parent = holder,
	}, { Theme.corner(nil, 1), make("UIStroke", { Color = C.dark, Thickness = 1.5 }) })
	local hpBg, hpFill = hpBar(holder, false)
	rec = {
		id = u.id,
		kind = u.kind,
		owner = u.owner,
		path = u.path,
		t0 = u.t0,
		speed = u.speed,
		orbit = u.orbit,
		hp = u.hp,
		maxHp = u.maxHp,
		holder = holder,
		ring = ring,
		imgs = imgs,
		dot = dot,
		hpBg = hpBg,
		hpFill = hpFill,
		flip = false,
		color = color,
		px = u.path[1],
		py = u.path[2],
	}
	units[u.id] = rec
	setHp(rec)
	lastZ = -1
end

function MapView.removeUnit(id: number)
	local u = units[id]
	if u then
		u.holder:Destroy()
		units[id] = nil
		MapView.selected[id] = nil
	end
end

-- list: flat unit id, hp
function MapView.setUnitHp(list)
	for i = 1, #list - 1, 2 do
		local u = units[list[i]]
		if u then
			u.hp = list[i + 1]
			setHp(u)
		end
	end
end

function MapView.unitRecord(id: number)
	return units[id]
end

function MapView.refreshSelection()
	for id, u in units do
		u.ring.Visible = MapView.selected[id] == true
	end
end

-- ids of the player's units, optionally of one kind
function MapView.ownUnits(kind: string?): { number }
	local ids = {}
	for id, u in units do
		if u.owner == MapView.myId and (kind == nil or u.kind == kind) then
			table.insert(ids, id)
		end
	end
	return ids
end

-- the player's unit closest to a screen point, if one is close enough to tap
function MapView.unitAt(sx: number, sy: number): number?
	local best, bestD = nil, math.max(20, view.z * 1.6) ^ 2
	for id, u in units do
		if u.owner == MapView.myId then
			local x, y = view.x + u.px * view.z, view.y + u.py * view.z
			local d = (x - sx) ^ 2 + (y - sy) ^ 2
			if d < bestD then
				bestD = d
				best = id
			end
		end
	end
	return best
end

local function updateUnits(t: number)
	for _, u in units do
		local x, y, _, dir = Motion.position(u, t)
		if u.kind == "plane" then
			if u.px then
				local vx, vy = x - u.px, y - u.py
				if vx * vx + vy * vy > 1e-8 then
					u.imgs[1].Rotation = math.deg(math.atan2(vx, -vy))
				end
			end
		elseif math.abs(dir) > 0.05 then
			local flip = dir < 0
			if flip ~= u.flip then
				u.flip = flip
				for _, img in u.imgs do
					Sprites.apply(img, u.kind, u.color, flip)
				end
			end
		end
		u.px, u.py = x, y
		u.holder.Position = UDim2.fromScale(x / W, y / H)
	end
end

local function resizeMarkers()
	local z = view.z
	local unitSmall = z < 2
	for _, u in units do
		local s
		if unitSmall then
			s = 8
		elseif u.kind == "plane" then
			s = math.clamp(z * 2.8, 18, 44)
		elseif u.kind == "tank" then
			s = math.clamp(z * 2.5, 16, 40)
		else
			s = math.clamp(z * 2.6, 18, 40)
		end
		u.holder.Size = UDim2.fromOffset(s, s)
		u.dot.Visible = unitSmall
		for _, img in u.imgs do
			img.Visible = not unitSmall
		end
		setHp(u)
	end
	local small = z < 3.5
	local bs = math.clamp(z * 1.9, 14, 40)
	for _, b in buildings do
		if small then
			b.plate.Size = UDim2.fromOffset(8, 8)
			b.icon.Visible = false
			b.bar.Visible = false
			b.warn.Visible = false
		else
			b.plate.Size = UDim2.fromOffset(bs, bs)
			b.icon.Visible = true
		end
		setHp(b)
	end
	local ds = math.clamp(z * 1.9, 12, 22)
	for _, d in depMarks do
		d.gui.Visible = z >= 4 and not d.hidden
		d.gui.Size = UDim2.fromOffset(ds, ds)
	end
end

---------------------------------------------------------------- effects

local function ringFx(x: number, y: number, size: number, fill: Color3, edge: Color3, seconds: number)
	local ring = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = tilePos(x, y),
		Size = UDim2.fromOffset(4, 4),
		BackgroundColor3 = fill,
		BackgroundTransparency = 0.1,
		Parent = fxLayer,
	}, { Theme.corner(nil, 1), make("UIStroke", { Color = edge, Thickness = 2.5 }) })
	local info = TweenInfo.new(seconds, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	TweenService:Create(ring, info, { Size = UDim2.fromOffset(size, size), BackgroundTransparency = 1 }):Play()
	TweenService:Create(ring:FindFirstChildOfClass("UIStroke"), info, { Transparency = 1 }):Play()
	task.delay(seconds + 0.05, function()
		ring:Destroy()
	end)
end

-- small flash where a tile was captured
function MapView.fx(x: number, y: number)
	if view.z < 1.5 then
		return
	end
	ringFx(x, y, 10.4 * math.max(view.z, 2), C.moltenHi, C.molten, 0.9)
end

-- explosion where a unit or building was destroyed
function MapView.boom(x: number, y: number, big: boolean)
	if view.z < 1.2 then
		return
	end
	local size = (if big then 5 else 3) * math.max(view.z, 2.5)
	ringFx(x, y, size, Color3.fromRGB(255, 196, 92), Color3.fromRGB(230, 70, 30), 0.7)
end

-- where a move order was sent
function MapView.marker(x: number, y: number)
	ringFx(x, y, math.max(view.z * 3, 24), Color3.fromRGB(120, 255, 170), Color3.fromRGB(67, 217, 133), 0.6)
end

-- tracer lines for shots: flat x1, y1, x2, y2
function MapView.shots(list)
	if view.z < 2.5 then
		return
	end
	local drawn = 0
	for i = 1, #list - 3, 4 do
		local x1, y1, x2, y2 = list[i], list[i + 1], list[i + 2], list[i + 3]
		local sx, sy = view.x + x1 * view.z, view.y + y1 * view.z
		if sx > -50 and sy > -50 and sx < cw + 50 and sy < ch + 50 then
			drawn += 1
			if drawn > 40 then
				break
			end
			local dx, dy = x2 - x1, y2 - y1
			local len = math.sqrt(dx * dx + dy * dy) * view.z
			local line = make("Frame", {
				AnchorPoint = Vector2.new(0.5, 0.5),
				Position = tilePos((x1 + x2) / 2, (y1 + y2) / 2),
				Size = UDim2.fromOffset(len, 2),
				Rotation = math.deg(math.atan2(dy, dx)),
				BackgroundColor3 = Color3.fromRGB(255, 226, 150),
				BorderSizePixel = 0,
				Parent = fxLayer,
			})
			TweenService:Create(line, TweenInfo.new(0.25), { BackgroundTransparency = 1 }):Play()
			task.delay(0.3, function()
				line:Destroy()
			end)
		end
	end
end

---------------------------------------------------------------- snapshots and deltas

function MapView.clear()
	buffer.fill(owner, 0, 0)
	buffer.fill(ov, 0, 0)
	dirtyRect = { 0, 0, W - 1, H - 1 }
	for id in labels do
		removeLabel(id)
	end
	for id in units do
		MapView.removeUnit(id)
	end
	for id in buildings do
		MapView.removeBuilding(id)
	end
	table.clear(nations)
	MapView.myId = 0
	MapView.phase = "none"
end

function MapView.load(s)
	MapView.clear()
	MapView.phase = s.phase
	MapView.myId = s.you or 0
	for _, info in s.nations do
		MapView.upsertNation(info)
	end
	Codec.decodeOwners(s.owners, function(t, o)
		writeu16(owner, t * 2, o)
		local n = nations[o]
		if n then
			n.count += 1
			n.sx += t % W
			n.sy += t // W
		end
	end)
	repaintAll()
	for _, b in s.buildings do
		MapView.addBuilding(b)
	end
	for _, u in s.units do
		MapView.addUnit(u)
	end
	MapView.setStats(s.stats)
end

function MapView.applyDelta(data: buffer)
	Codec.readChanges(data, setTile)
end

function MapView.setPhase(phase: string)
	if phase ~= MapView.phase then
		local wasSpawn = MapView.phase == "spawn"
		MapView.phase = phase
		if wasSpawn or phase == "spawn" then
			repaintAll()
		end
	end
end

function MapView.setMode(mode: string)
	MapView.mode = mode
	shade.Visible = mode == "menu"
	labelLayer.Visible = mode == "play"
	unitLayer.Visible = mode == "play"
	bldLayer.Visible = mode == "play"
	depLayer.Visible = mode == "play"
	fxLayer.Visible = mode == "play"
	anim = nil
	if mode == "play" then
		MapView.fit()
	end
end

---------------------------------------------------------------- frame update

function MapView.update(dt: number)
	local size = root.AbsoluteSize
	if size.X ~= cw or size.Y ~= ch then
		cw, ch = math.max(size.X, 1), math.max(size.Y, 1)
		clampView()
	end
	if MapView.mode == "menu" then
		local z = math.max(cw / W, ch / H) * 1.3
		local ph = 0.5 + 0.5 * math.sin(os.clock() / 30)
		view.z = z
		view.x = (cw - W * z) * ph
		view.y = math.clamp(ch * 0.46 - 118 * z, ch - H * z, 0)
	elseif anim then
		local k = math.clamp((os.clock() - anim.t0) / anim.d, 0, 1)
		local e = if k < 0.5 then 2 * k * k else 1 - (-2 * k + 2) ^ 2 / 2
		view.z = lerp(anim.from.z, anim.to.z, e)
		view.x = lerp(anim.from.x, anim.to.x, e)
		view.y = lerp(anim.from.y, anim.to.y, e)
		if k >= 1 then
			anim = nil
			clampView()
		end
	end
	board.Position = UDim2.fromOffset(view.x, view.y)
	board.Size = UDim2.fromOffset(W * view.z, H * view.z)
	flushOverlay()
	if MapView.mode == "play" then
		if math.abs(view.z - lastZ) > 0.01 then
			lastZ = view.z
			resizeMarkers()
		end
		updateUnits(workspace:GetServerTimeNow())
		labelAcc += dt
		if labelAcc >= 0.1 then
			labelAcc = 0
			updateLabels()
		end
	end
end

function MapView.viewInfo()
	return view, cw, ch
end

return MapView
