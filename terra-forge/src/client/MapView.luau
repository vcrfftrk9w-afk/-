-- The match on screen in 3D: the ground with territory and fog of war (Ground), the camera
-- (CameraRig), and buildings, units, deposits, nation labels and battle effects (Models).
-- Server messages arrive here in map tiles; one tile is one stud in the world.
local Debris = game:GetService("Debris")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Codec = require(Shared.Codec)
local Motion = require(Shared.Motion)
local Theme = require(script.Parent.Theme)
local Sprites = require(script.Parent.Sprites)
local Ground = require(script.Parent.Ground)
local Rig = require(script.Parent.CameraRig)
local Models = require(script.Parent.Models)

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
MapView.spectator = false
MapView.loading = false
MapView.selected = {}

local nations = MapView.nations
local owner = buffer.create(N * 2)
local buildings = {}
local units = {}
local labels = {}
local capitals = {}
local props = {}

local gui, shade, worldGui, anchor
local unitFolder, bldFolder, fxFolder, propFolder
local labelAcc = 0
local fadeAcc = 0
local nearView = true -- close enough to draw unit models; further out units are dots
local airSpots = {} -- flat x, y, height of aircraft this frame, for tracers

local GRAY3 = Color3.fromRGB(200, 200, 200)
local NEAR_IN, NEAR_OUT = 105, 125

---------------------------------------------------------------- helpers

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

local function camera(): Camera
	return workspace.CurrentCamera
end

-- within the area the camera can see (roughly), so off-screen work can be skipped
local function inView(x: number, y: number, margin: number): boolean
	local r = Rig.dist * 1.4 + margin
	local dx, dz = x - Rig.fx, y - Rig.fz
	return dx * dx + dz * dz < r * r
end

---------------------------------------------------------------- territory

local GRAY, GRAY_B = Config.SPAWN_GRAY, Config.SPAWN_GRAY_BORDER
local nbSet = {}
-- newly captured tiles fade in over FADE seconds, so borders spread smoothly
local FADE = 0.5
local fadeStart = {}
local fadeList = {}

-- fog of war: the map is split into 4 x 4-tile cells; a cell is visible near your land, buildings and units
local FOG = 4
local FW, FH = W // FOG, H // FOG
local FOG_DARK = 0.45
local ownCells = buffer.create(FW * FH * 2)
local visible = buffer.create(FW * FH)
local visNext = buffer.create(FW * FH)
local fogOn = false
local fogAcc = 0
local repaintRow = H -- rows from here down still need repainting

local function visAt(cx: number, cy: number): number
	return readu8(visible, math.clamp(cy, 0, FH - 1) * FW + math.clamp(cx, 0, FW - 1))
end

-- light left by the fog at a tile, blended between cells so its edge is soft
local function fogLight(x: number, y: number): number
	if not fogOn then
		return 1
	end
	local fx, fy = (x + 0.5) / FOG - 0.5, (y + 0.5) / FOG - 0.5
	local i, j = math.floor(fx), math.floor(fy)
	local ax, ay = fx - i, fy - j
	local top = visAt(i, j) * (1 - ax) + visAt(i + 1, j) * ax
	local bottom = visAt(i, j + 1) * (1 - ax) + visAt(i + 1, j + 1) * ax
	return FOG_DARK + (1 - FOG_DARK) * (top * (1 - ay) + bottom * ay)
end

local function paint(t: number)
	local x, y = t % W, t // W
	local o = readu16(owner, t * 2)
	local n = if o ~= 0 then nations[o] else nil
	local k = fogLight(x, y)
	if not n then
		Ground.paintTile(t, nil, nil, 0, 0, 0, k)
		return
	end
	local mask = 0
	if x == 0 or readu16(owner, (t - 1) * 2) ~= o then
		mask += 1
	end
	if x == W - 1 or readu16(owner, (t + 1) * 2) ~= o then
		mask += 2
	end
	if y == 0 or readu16(owner, (t - W) * 2) ~= o then
		mask += 4
	end
	if y == H - 1 or readu16(owner, (t + W) * 2) ~= o then
		mask += 8
	end
	local gray = MapView.phase == "spawn" and o ~= MapView.myId
	-- inside a light tint, so the ground stays readable; the border is a strong thin line
	local a = if gray then 0.5 elseif o == MapView.myId then 0.36 else 0.28
	local ba = 0.95
	local started = fadeStart[t]
	if started then
		local f = math.clamp((os.clock() - started) / FADE, 0.15, 1)
		a *= f
		ba *= f
	end
	Ground.paintTile(t, if gray then GRAY else n.rgb, if gray then GRAY_B else n.rgbB, a, ba, mask, k)
end

local function repaintAll()
	repaintRow = 0
end

-- repaints a few rows a frame, so big changes don't freeze the game
local function repaintStep(rows: number)
	if repaintRow >= H then
		return
	end
	local last = math.min(H, repaintRow + rows)
	for t = repaintRow * W, last * W - 1 do
		paint(t)
	end
	repaintRow = last
end

local function cellOf(x: number, y: number): number
	return math.clamp(y // FOG, 0, FH - 1) * FW + math.clamp(x // FOG, 0, FW - 1)
end

local function addOwn(x: number, y: number, delta: number)
	local c = cellOf(x, y) * 2
	writeu16(ownCells, c, math.max(0, readu16(ownCells, c) + delta))
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
	local me = MapView.myId
	if me ~= 0 then
		if old == me then
			addOwn(x, y, -1)
		end
		if o == me then
			addOwn(x, y, 1)
		end
	end
	if o ~= 0 and not MapView.loading then
		if not fadeStart[t] then
			table.insert(fadeList, t)
		end
		fadeStart[t] = os.clock()
	end
	paint(t)
	local c = Map.neighbors(t, nbSet)
	for i = 1, c do
		paint(nbSet[i])
	end
end

local function processFades()
	if #fadeList == 0 then
		return
	end
	local now = os.clock()
	local keep = {}
	for _, t in fadeList do
		local started = fadeStart[t]
		local done = not started or now - started >= FADE
		if done then
			fadeStart[t] = nil
		end
		paint(t)
		if not done then
			table.insert(keep, t)
		end
	end
	fadeList = keep
end

function MapView.ownerAt(x: number, y: number): number
	if not Map.inBounds(x, y) then
		return 0
	end
	return readu16(owner, (y * W + x) * 2)
end

---------------------------------------------------------------- fog of war

-- true when a tile position is not hidden by fog for this player
function MapView.isVisible(x: number, y: number): boolean
	if not fogOn then
		return true
	end
	local cx, cy = math.floor(x / FOG), math.floor(y / FOG)
	if cx < 0 or cy < 0 or cx >= FW or cy >= FH then
		return false
	end
	return readu8(visible, cy * FW + cx) == 1
end

local function reveal(buf: buffer, cx: number, cy: number, r: number)
	local ri = math.ceil(r)
	for dy = -ri, ri do
		local y = cy + dy
		if y >= 0 and y < FH then
			for dx = -ri, ri do
				local x = cx + dx
				if x >= 0 and x < FW and dx * dx + dy * dy <= r * r + 0.5 then
					writeu8(buf, y * FW + x, 1)
				end
			end
		end
	end
end

-- works out what is visible now; returns the cells that changed
local function computeVisibility(): { number }
	buffer.fill(visNext, 0, 0)
	local me = MapView.myId
	local landR = Config.VISION.land / FOG
	for c = 0, FW * FH - 1 do
		if readu16(ownCells, c * 2) > 0 then
			reveal(visNext, c % FW, c // FW, landR)
		end
	end
	for _, u in units do
		if u.owner == me then
			reveal(visNext, math.floor(u.px / FOG), math.floor(u.py / FOG), (Config.UNITS[u.kind].vision or 6) / FOG)
		end
	end
	for _, b in buildings do
		if b.owner == me then
			reveal(visNext, b.x // FOG, b.y // FOG, Config.VISION.building / FOG)
		end
	end
	local n = nations[me]
	if n and n.cap then
		reveal(visNext, n.cap.x // FOG, n.cap.y // FOG, Config.VISION.capital / FOG)
	end
	local changed = {}
	for c = 0, FW * FH - 1 do
		if readu8(visNext, c) ~= readu8(visible, c) then
			table.insert(changed, c)
		end
	end
	visible, visNext = visNext, visible
	return changed
end

-- shows or hides buildings, capitals and their bars by fog
local function refreshStatics()
	local me = MapView.myId
	for _, b in buildings do
		local shown = b.owner == me or MapView.isVisible(b.x + 0.5, b.y + 0.5)
		if shown ~= b.shown then
			b.shown = shown
			b.kit.model.Parent = if shown then bldFolder else nil
		end
		b.bar.gui.Enabled = shown and (b.bar.hpBg.Visible or b.bar.progBg.Visible)
	end
	for id, cap in capitals do
		local shown = id == me or MapView.isVisible(cap.x + 0.5, cap.y + 0.5)
		if shown ~= cap.shown then
			cap.shown = shown
			cap.kit.model.Parent = if shown then bldFolder else nil
		end
	end
end

local function updateFog()
	local changed = computeVisibility()
	if #changed > 240 then
		repaintAll()
	elseif #changed > 0 then
		local seen = {}
		for _, c in changed do
			local cx, cy = c % FW, c // FW
			for y = math.max(0, cy * FOG - 2), math.min(H - 1, cy * FOG + FOG + 1) do
				for x = math.max(0, cx * FOG - 2), math.min(W - 1, cx * FOG + FOG + 1) do
					local t = y * W + x
					if not seen[t] then
						seen[t] = true
						paint(t)
					end
				end
			end
		end
	end
	refreshStatics()
end

local function fogActive(): boolean
	return MapView.mode == "play" and MapView.phase == "game" and MapView.myId ~= 0 and not MapView.spectator
end

---------------------------------------------------------------- bars over buildings and units

local function makeBar(adornee: BasePart, width: number, height: number, withProgress: boolean)
	local bb = Instance.new("BillboardGui")
	bb.Name = "Bar"
	bb.Adornee = adornee
	bb.Size = UDim2.fromOffset(width, if withProgress then 12 else 5)
	bb.StudsOffsetWorldSpace = Vector3.new(0, height, 0)
	bb.AlwaysOnTop = true
	bb.LightInfluence = 0
	bb.MaxDistance = 140
	bb.ResetOnSpawn = false
	bb.Enabled = false
	local hpBg = make("Frame", {
		Size = UDim2.new(1, 0, 0, 5),
		BackgroundColor3 = C.dark,
		BackgroundTransparency = 0.15,
		BorderSizePixel = 0,
		Visible = false,
		Parent = bb,
	})
	local hpFill = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = C.ok, BorderSizePixel = 0, Parent = hpBg })
	local bar = { gui = bb, hpBg = hpBg, hpFill = hpFill }
	if withProgress then
		bar.progBg = make("Frame", {
			Position = UDim2.fromOffset(0, 7),
			Size = UDim2.new(1, 0, 0, 5),
			BackgroundColor3 = C.dark,
			BackgroundTransparency = 0.15,
			BorderSizePixel = 0,
			Visible = false,
			Parent = bb,
		})
		bar.progFill = make("Frame", { Size = UDim2.fromScale(0, 1), BackgroundColor3 = C.molten, BorderSizePixel = 0, Parent = bar.progBg })
	end
	return bar
end

local function setHp(rec)
	local k = math.clamp(rec.hp / math.max(rec.maxHp, 1), 0, 1)
	local bar = rec.bar
	bar.hpBg.Visible = k < 0.999
	bar.hpFill.Size = UDim2.fromScale(k, 1)
	bar.hpFill.BackgroundColor3 = if k > 0.5 then C.ok elseif k > 0.25 then C.moltenHi else C.bad
	local any = bar.hpBg.Visible or (bar.progBg ~= nil and bar.progBg.Visible)
	bar.gui.Enabled = any and rec.shown ~= false
end

---------------------------------------------------------------- deposits

local function placeDeposits()
	local rng = Random.new(4242)
	for _, d in Map.deposits do
		local spots = {}
		for dy = -2, 2 do
			for dx = -2, 2 do
				local x, y = d.x + dx, d.y + dy
				if Map.inBounds(x, y) and Map.deposit(y * W + x) == d.kind then
					table.insert(spots, { x, y })
				end
			end
		end
		for i = 1, math.min(3, #spots) do
			local j = rng:NextInteger(i, #spots)
			spots[i], spots[j] = spots[j], spots[i]
			local s = spots[i]
			local kit = Models.deposit(d.kind, rng)
			local px0, pz0 = s[1] + 0.5, s[2] + 0.5
			local turn = CFrame.Angles(0, rng:NextNumber() * math.pi * 2, 0)
			Models.place(kit, CFrame.new(px0, Ground.height(px0, pz0), pz0) * turn)
			kit.model.Parent = propFolder
			table.insert(props, { kit = kit, x = px0, y = pz0, turn = turn, cover = 0 })
		end
	end
end

-- a building on a deposit hides the rocks under it
local function coverProps(x: number, y: number, delta: number)
	for _, p in props do
		if math.abs(p.x - x) < 1.4 and math.abs(p.y - y) < 1.4 then
			p.cover = math.max(0, p.cover + delta)
			p.kit.model.Parent = if p.cover > 0 then nil else propFolder
		end
	end
end

---------------------------------------------------------------- setup

-- after a switch to the flat map, everything standing on the ground is put back on it
local function replaceStatics()
	for _, p in props do
		Models.place(p.kit, CFrame.new(p.x, Ground.height(p.x, p.y), p.y) * p.turn)
	end
	for _, b in buildings do
		local gx, gy = b.x + 0.5, b.y + 0.5
		Models.place(b.kit, CFrame.new(gx, Ground.height(gx, gy), gy))
	end
	for _, cap in capitals do
		local gx, gy = cap.x + 0.5, cap.y + 0.5
		Models.place(cap.kit, CFrame.new(gx, Ground.height(gx, gy), gy))
	end
end

local function folderIn(parent: Instance, name: string): Folder
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = parent
	return f
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
	shade = make("Frame", {
		Name = "MenuShade",
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = C.bg,
		BackgroundTransparency = 0,
		BorderSizePixel = 0,
		Parent = gui,
	}, {
		make("UIGradient", {
			Rotation = 90,
			Transparency = NumberSequence.new({
				NumberSequenceKeypoint.new(0, 0.45),
				NumberSequenceKeypoint.new(0.35, 0.86),
				NumberSequenceKeypoint.new(0.65, 0.76),
				NumberSequenceKeypoint.new(1, 0.1),
			}),
		}),
	})
	gui.Parent = playerGui
	worldGui = folderIn(playerGui, "TerraForgeWorldGui")

	local world = folderIn(workspace, "TerraForgeWorld")
	propFolder = folderIn(world, "Deposits")
	bldFolder = folderIn(world, "Buildings")
	unitFolder = folderIn(world, "Units")
	fxFolder = folderIn(world, "Effects")
	anchor = Instance.new("Part")
	anchor.Name = "LabelAnchor"
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.CanTouch = false
	anchor.Transparency = 1
	anchor.Size = Vector3.new(0.2, 0.2, 0.2)
	anchor.CFrame = CFrame.new()
	anchor.Parent = world

	Rig.menu = true
	Rig.apply()
	-- the ground needs "Allow Mesh / Image APIs" switched on for the experience
	MapView.ok = Ground.init()
	Ground.onFlat = replaceStatics
	placeDeposits()
	Rig.onTap = function(x, y, sx, sy)
		if MapView.onTap then
			MapView.onTap(x, y, sx, sy)
		end
	end
	Rig.setupInput()
end

---------------------------------------------------------------- view

function MapView.zoom(f: number)
	Rig.zoom(f)
end

-- flies the camera close to a map point
function MapView.focusOn(x: number, y: number, seconds: number)
	Rig.flyTo(x, y, 46, seconds)
end

-- the whole world in view
function MapView.overview(seconds: number)
	Rig.overview(seconds)
end

-- GTA-style flight to a map point: up into the sky, across, and down close to the ground
function MapView.switchTo(x: number, y: number)
	Rig.switchTo(x, y, 34)
end

-- the camera is high above the map
function MapView.isFar(): boolean
	return Rig.dist > 80
end

-- the player's capital or building nearest to a map point, within radius tiles
function MapView.nearestBase(x: number, y: number, radius: number): (number?, number?)
	local bx, by, best = nil, nil, radius * radius
	local function try(px: number, py: number)
		local d = (px - x) ^ 2 + (py - y) ^ 2
		if d < best then
			best = d
			bx, by = px, py
		end
	end
	local n = nations[MapView.myId]
	if n and n.cap then
		try(n.cap.x + 0.5, n.cap.y + 0.5)
	end
	for _, b in buildings do
		if b.owner == MapView.myId then
			try(b.x + 0.5, b.y + 0.5)
		end
	end
	return bx, by
end

---------------------------------------------------------------- nations and capitals

local function removeLabel(id: number)
	local l = labels[id]
	if l then
		l.gui:Destroy()
		l.att:Destroy()
		labels[id] = nil
	end
end

local function updateCapital(n)
	local cap = capitals[n.id]
	local want = n.alive and n.cap ~= nil
	if cap and (not want or cap.x ~= n.cap.x or cap.y ~= n.cap.y or cap.color ~= n.color) then
		cap.kit.model:Destroy()
		capitals[n.id] = nil
		cap = nil
	end
	if want and not cap then
		local kit = Models.building("capital", n.color3)
		local gx, gy = n.cap.x + 0.5, n.cap.y + 0.5
		Models.place(kit, CFrame.new(gx, Ground.height(gx, gy), gy))
		kit.model.Parent = bldFolder
		capitals[n.id] = { kit = kit, x = n.cap.x, y = n.cap.y, color = n.color, shown = true }
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
	updateCapital(n)
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
	local att = Instance.new("Attachment")
	att.Parent = anchor
	local bb = Instance.new("BillboardGui")
	bb.Name = "Label" .. n.id
	bb.Adornee = att
	bb.Size = UDim2.fromOffset(560, 150)
	bb.AlwaysOnTop = true
	bb.LightInfluence = 0
	bb.ResetOnSpawn = false
	bb.Enabled = false
	bb.Parent = worldGui
	local frame = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		BackgroundTransparency = 1,
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		Parent = bb,
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
	local l = { gui = bb, att = att, avatar = avatar, name = name, troops = troops }
	labels[n.id] = l
	return l
end

local function updateLabels()
	local cam = camera()
	local vp = cam.ViewportSize
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
		local pos = Vector3.new(cx, Ground.surface(cx, cy) + 0.8, cy)
		local v, onScreen = cam:WorldToViewportPoint(pos)
		local shown = showAll and onScreen
		local fs = 0
		if shown then
			local z = Rig.pxPerStud(v.Z)
			fs = math.min(math.sqrt(n.count) * z * 0.27, 30)
			if n.id == me then
				fs = math.max(fs, 13)
			elseif spawnish and z > 1.6 then
				fs = math.max(fs, 9)
			end
			shown = fs >= 8 and v.X > -200 and v.Y > -100 and v.X < vp.X + 200 and v.Y < vp.Y + 100
		end
		if shown and n.id ~= me and not MapView.isVisible(cx, cy) then
			shown = false
		end
		if shown then
			local width = utf8.len(n.name) * fs * 0.62 + (if n.human then fs * 1.9 else 0)
			local box = { v.X - width / 2, v.Y - fs * 0.8, width, fs * 1.8 }
			for _, o in boxes do
				if box[1] < o[1] + o[3] and o[1] < box[1] + box[3] and box[2] < o[2] + o[4] and o[2] < box[2] + box[4] then
					shown = false
					break
				end
			end
			if shown then
				table.insert(boxes, box)
			end
		end
		local l = labels[n.id]
		if shown then
			l = l or makeLabel(n)
			l.gui.Enabled = true
			l.att.WorldPosition = pos
			l.name.TextSize = math.floor(fs)
			l.troops.TextSize = math.max(7, math.floor(fs * 0.64))
			l.troops.Text = MapView.fmt(n.troops)
			if l.avatar then
				local a = math.floor(fs * 1.6)
				l.avatar.Size = UDim2.fromOffset(a, a)
			end
		elseif l then
			l.gui.Enabled = false
		end
	end
end

---------------------------------------------------------------- buildings

local function placeOnGround(kit, x: number, y: number)
	Models.place(kit, CFrame.new(x, Ground.height(x, y), y))
end

function MapView.addBuilding(b)
	if buildings[b.id] then
		return
	end
	local n = nations[b.owner]
	local kit = Models.building(b.kind, if n then n.color3 else GRAY3)
	local gx, gy = b.x + 0.5, b.y + 0.5
	placeOnGround(kit, gx, gy)
	kit.model.Parent = bldFolder
	local rec = {
		id = b.id,
		kind = b.kind,
		owner = b.owner,
		x = b.x,
		y = b.y,
		built = b.built or 1,
		queue = {},
		auto = "",
		prog = 0,
		hp = b.hp or 1,
		maxHp = b.maxHp or 1,
		kit = kit,
		bar = makeBar(kit.parts[1], 40, 1.7, true),
		shown = true,
	}
	rec.bar.gui.Parent = worldGui
	buildings[b.id] = rec
	if rec.built < 1 then
		-- under construction: see-through, with a blue progress bar
		Models.setGhost(kit, true)
		rec.bar.progBg.Visible = true
		rec.bar.progFill.BackgroundColor3 = Color3.fromRGB(90, 170, 255)
		rec.bar.progFill.Size = UDim2.fromScale(rec.built, 1)
	end
	setHp(rec)
	coverProps(gx, gy, 1)
	if fogOn then
		refreshStatics()
	end
end

function MapView.removeBuilding(id: number)
	local b = buildings[id]
	if b then
		b.kit.model:Destroy()
		b.bar.gui:Destroy()
		buildings[id] = nil
		coverProps(b.x + 0.5, b.y + 0.5, -1)
	end
end

-- list: own buildings as { id, p = progress (negative = waiting for money), built, q = queued kinds, auto }
function MapView.setProgress(list)
	for _, e in list do
		local b = buildings[e.id]
		if b then
			b.prog, b.built, b.queue, b.auto = e.p, e.built, e.q, e.auto
			local def = Config.BUILD[b.kind]
			local bar = b.bar
			if b.built < 1 then
				bar.progBg.Visible = true
				bar.progFill.Size = UDim2.fromScale(b.built, 1)
				bar.progFill.BackgroundColor3 = Color3.fromRGB(90, 170, 255)
			elseif def.units then
				bar.progBg.Visible = #b.queue > 0 or b.auto ~= ""
				bar.progFill.Size = UDim2.fromScale(math.abs(b.prog), 1)
				bar.progFill.BackgroundColor3 = if b.prog < 0 then C.bad else C.molten
			else
				bar.progBg.Visible = false
			end
			setHp(b)
		end
	end
end

local function flash(x: number, y: number, size: number, color: Color3, seconds: number)
	local h = Ground.surface(x, y) + 0.05
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(0.05, 0.4, 0.4)
	p.CFrame = CFrame.new(x, h, y) * CFrame.Angles(0, 0, math.rad(90))
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = Enum.Material.Neon
	p.Color = color
	p.Transparency = 0.2
	p.Parent = fxFolder
	TweenService:Create(p, TweenInfo.new(seconds, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Size = Vector3.new(0.05, size, size),
		Transparency = 1,
	}):Play()
	Debris:AddItem(p, seconds + 0.1)
end

-- construction finished
function MapView.finishBuilding(id: number)
	local b = buildings[id]
	if b then
		b.built = 1
		Models.setGhost(b.kit, false)
		b.bar.progBg.Visible = false
		setHp(b)
		flash(b.x + 0.5, b.y + 0.5, 3, Color3.fromRGB(120, 200, 255), 0.6)
	end
end

local function screenPos(pos: Vector3): (Vector2?, number)
	local v, onScreen = camera():WorldToScreenPoint(pos)
	if not onScreen then
		return nil, 0
	end
	return Vector2.new(v.X, v.Y), v.Z
end

-- the player's building under a screen point, if any
function MapView.buildingAt(sx: number, sy: number): number?
	local best, bestD = nil, math.huge
	local tap = Vector2.new(sx, sy)
	for id, b in buildings do
		if b.owner == MapView.myId then
			local gx, gy = b.x + 0.5, b.y + 0.5
			local p, depth = screenPos(Vector3.new(gx, Ground.height(gx, gy) + 0.4, gy))
			if p then
				local d = (p - tap).Magnitude
				local radius = math.max(26, Rig.pxPerStud(depth) * 0.9)
				if d < radius and d < bestD then
					bestD = d
					best = id
				end
			end
		end
	end
	return best
end

function MapView.buildingRecord(id: number)
	return buildings[id]
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

local function applyNear(u)
	u.kit.body.Parent = if nearView then u.kit.model else nil
	u.dot.Enabled = not nearView
end

local function setDotSelected(u, on: boolean)
	u.dotStroke.Color = if on then Color3.new(1, 1, 1) else C.dark
	u.dotStroke.Thickness = if on then 2 else 1.5
end

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
	local def = Config.UNITS[u.kind]
	local air = def ~= nil and def.air == true
	local color = if n then n.color3 else GRAY3
	local kit = Models.unit(u.kind, color, air)
	local bar = makeBar(kit.root, 26, if air then 0.9 else 1.1, false)
	bar.gui.Parent = kit.root
	local dot = Instance.new("BillboardGui")
	dot.Name = "Dot"
	dot.Size = UDim2.fromOffset(9, 9)
	dot.AlwaysOnTop = true
	dot.LightInfluence = 0
	dot.ResetOnSpawn = false
	dot.Enabled = false
	local dotFrame = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = color, Parent = dot }, { Theme.corner(nil, 1) })
	local dotStroke = make("UIStroke", { Color = C.dark, Thickness = 1.5, Parent = dotFrame })
	dot.Parent = kit.root
	local x, y = u.path[1], u.path[2]
	kit.root.CFrame = CFrame.new(x, Ground.surface(x, y) + kit.lift, y)
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
		kit = kit,
		bar = bar,
		dot = dot,
		dotStroke = dotStroke,
		px = x,
		py = y,
		yaw = math.pi,
		roll = 0,
		shown = false,
	}
	units[u.id] = rec
	applyNear(rec)
	setHp(rec)
end

function MapView.removeUnit(id: number)
	local u = units[id]
	if u then
		u.kit.model:Destroy()
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
		local on = MapView.selected[id] == true
		if on ~= u.selectedShown then
			u.selectedShown = on
			Models.setSelected(u.kit, on)
			setDotSelected(u, on)
		end
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
	local best, bestD = nil, math.huge
	local tap = Vector2.new(sx, sy)
	for id, u in units do
		if u.owner == MapView.myId then
			local p, depth = screenPos(u.kit.root.Position)
			if p then
				local d = (p - tap).Magnitude
				local radius = math.max(22, Rig.pxPerStud(depth) * 0.8)
				if d < radius and d < bestD then
					bestD = d
					best = id
				end
			end
		end
	end
	return best
end

local moveParts, moveFrames = {}, {}
local spinAngle = 0

local function updateUnits(dt: number)
	local t = workspace:GetServerTimeNow()
	local me = MapView.myId
	local near = Rig.dist < (if nearView then NEAR_OUT else NEAR_IN)
	if near ~= nearView then
		nearView = near
		for _, u in units do
			applyNear(u)
		end
	end
	spinAngle = (spinAngle + dt * 24) % (math.pi * 2)
	table.clear(moveParts)
	table.clear(moveFrames)
	table.clear(airSpots)
	local count = 0
	local turnK = math.min(1, dt * 9)
	for _, u in units do
		local x, y = Motion.position(u, t)
		local vx, vy = x - u.px, y - u.py
		u.px, u.py = x, y
		local shown = u.owner == me or MapView.isVisible(x, y)
		if shown ~= u.shown then
			u.shown = shown
			u.kit.model.Parent = if shown then unitFolder else nil
			setHp(u)
		end
		local kit = u.kit
		if shown and inView(x, y, 12) then
			if vx * vx + vy * vy > 1e-8 then
				local target = math.atan2(-vx, -vy)
				local diff = (target - u.yaw + math.pi) % (math.pi * 2) - math.pi
				local turn = diff * turnK
				u.yaw += turn
				if kit.air then
					local bank = math.clamp(turn / math.max(dt, 1e-3) * 0.35, -0.7, 0.7)
					u.roll += (bank - u.roll) * math.min(1, dt * 4)
				end
			end
			local cf
			if kit.air then
				local h = Ground.surface(x, y) + kit.lift + math.sin(t * 2 + u.id) * 0.08
				cf = CFrame.new(x, h, y) * CFrame.Angles(0, u.yaw, 0) * CFrame.Angles(0, 0, u.roll)
				table.insert(airSpots, x)
				table.insert(airSpots, y)
				table.insert(airSpots, h)
			else
				cf = CFrame.new(x, math.max(Ground.height(x, y), 0.02), y) * CFrame.Angles(0, u.yaw, 0)
			end
			count += 1
			moveParts[count] = kit.root
			moveFrames[count] = cf
			if nearView then
				local first = count
				for i, p in kit.parts do
					count += 1
					moveParts[count] = p
					moveFrames[count] = cf * kit.offsets[i]
				end
				for _, i in kit.spin do
					moveFrames[first + i] = cf * kit.offsets[i] * CFrame.Angles(0, spinAngle, 0)
				end
			end
		end
	end
	if count > 0 then
		workspace:BulkMoveTo(moveParts, moveFrames, Enum.BulkMoveMode.FireCFrameChanged)
	end
end

---------------------------------------------------------------- effects

local function fxPart(shape, size: Vector3, cf: CFrame, color: Color3, transparency: number): Part
	local p = Instance.new("Part")
	p.Shape = shape
	p.Size = size
	p.CFrame = cf
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = Enum.Material.Neon
	p.Color = color
	p.Transparency = transparency
	p.Parent = fxFolder
	return p
end

-- height for a tracer end: an aircraft there, or just above the ground
local function shotHeight(x: number, y: number): number
	for i = 1, #airSpots - 2, 3 do
		local dx, dy = airSpots[i] - x, airSpots[i + 1] - y
		if dx * dx + dy * dy < 0.6 then
			return airSpots[i + 2]
		end
	end
	return Ground.surface(x, y) + 0.4
end

-- tracer lines for shots: flat x1, y1, x2, y2
function MapView.shots(list)
	if not nearView then
		return
	end
	local drawn = 0
	for i = 1, #list - 3, 4 do
		local x1, y1, x2, y2 = list[i], list[i + 1], list[i + 2], list[i + 3]
		if inView(x1, y1, 4) then
			drawn += 1
			if drawn > 40 then
				break
			end
			local a = Vector3.new(x1, shotHeight(x1, y1), y1)
			local b = Vector3.new(x2, shotHeight(x2, y2), y2)
			local len = (b - a).Magnitude
			if len > 0.05 then
				local p = fxPart(Enum.PartType.Block, Vector3.new(0.05, 0.05, len), CFrame.lookAt((a + b) / 2, b), Color3.fromRGB(255, 226, 150), 0)
				Debris:AddItem(p, 0.12)
				local spark = fxPart(Enum.PartType.Ball, Vector3.new(0.18, 0.18, 0.18), CFrame.new(b), Color3.fromRGB(255, 190, 90), 0.1)
				Debris:AddItem(spark, 0.1)
			end
		end
	end
end

-- explosion where a unit or building was destroyed
function MapView.boom(x: number, y: number, big: boolean)
	if not inView(x, y, 8) or Rig.dist > 260 then
		return
	end
	local h = shotHeight(x, y)
	local fire = fxPart(Enum.PartType.Ball, Vector3.new(0.3, 0.3, 0.3), CFrame.new(x, h, y), Color3.fromRGB(255, 170, 60), 0)
	local size = if big then 2.2 else 1.2
	TweenService:Create(fire, TweenInfo.new(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Size = Vector3.new(size, size, size),
		Transparency = 1,
	}):Play()
	Debris:AddItem(fire, 0.55)
	local smoke = fxPart(Enum.PartType.Ball, Vector3.new(0.5, 0.5, 0.5), CFrame.new(x, h, y), Color3.fromRGB(70, 70, 74), 0.25)
	smoke.Material = Enum.Material.SmoothPlastic
	TweenService:Create(smoke, TweenInfo.new(1.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Size = Vector3.new(size * 1.3, size * 1.3, size * 1.3),
		CFrame = CFrame.new(x, h + 1.4, y),
		Transparency = 1,
	}):Play()
	Debris:AddItem(smoke, 1.4)
end

-- small flash where a tile was captured
local fxBudget = 0
function MapView.fx(x: number, y: number)
	if not nearView or not inView(x, y, 2) or fxBudget > 12 then
		return
	end
	fxBudget += 1
	flash(x, y, 2.2, Color3.fromRGB(255, 214, 120), 0.7)
end

-- where a move order was sent
function MapView.marker(x: number, y: number)
	flash(x, y, math.max(3, Rig.dist * 0.06), Color3.fromRGB(120, 255, 170), 0.6)
end

---------------------------------------------------------------- minimap

local mini = nil

-- shows the whole map in a frame of the HUD; tap or drag it to move the camera
function MapView.attachMinimap(holder: GuiObject?)
	if not holder then
		return
	end
	for c = 0, Ground.CX * Ground.CY - 1 do
		local ci, cj = c % Ground.CX, c // Ground.CX
		local img = make("ImageLabel", {
			BackgroundTransparency = 1,
			Position = UDim2.fromScale(ci / Ground.CX, cj / Ground.CY),
			Size = UDim2.fromScale(1 / Ground.CX, 1 / Ground.CY),
			Parent = holder,
		})
		local source = Ground.images[c]
		if source then
			pcall(function()
				img.ImageContent = Content.fromObject(source)
			end)
		end
	end
	local rect = make("Frame", { BackgroundTransparency = 1, ZIndex = 3, Parent = holder }, {
		make("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 1.5 }),
	})
	mini = { holder = holder, rect = rect }
	local dragging = false
	local function jump(input: InputObject)
		local size = holder.AbsoluteSize
		if size.X < 1 or size.Y < 1 then
			return
		end
		local rel = (Vector2.new(input.Position.X, input.Position.Y) - holder.AbsolutePosition) / size
		Rig.fx = math.clamp(rel.X, 0, 1) * W
		Rig.fz = math.clamp(rel.Y, 0, 1) * H
		Rig.apply()
	end
	holder.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = true
			jump(input)
		end
	end)
	holder.InputChanged:Connect(function(input)
		if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
			jump(input)
		end
	end)
	holder.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = false
		end
	end)
end

-- the outline of what the camera sees
local function updateMinimap()
	if not mini then
		return
	end
	local vp = camera().ViewportSize
	local x0, y0, x1, y1 = math.huge, math.huge, -math.huge, -math.huge
	for _, p in { Vector2.new(0, 0), Vector2.new(vp.X, 0), Vector2.new(0, vp.Y), Vector2.new(vp.X, vp.Y) } do
		local g = Rig.groundAtViewport(p.X, p.Y)
		if g then
			x0, y0 = math.min(x0, g.X), math.min(y0, g.Y)
			x1, y1 = math.max(x1, g.X), math.max(y1, g.Y)
		end
	end
	if x0 > x1 then
		mini.rect.Visible = false
		return
	end
	x0, x1 = math.clamp(x0, 0, W), math.clamp(x1, 0, W)
	y0, y1 = math.clamp(y0, 0, H), math.clamp(y1, 0, H)
	mini.rect.Visible = true
	mini.rect.Position = UDim2.fromScale(x0 / W, y0 / H)
	mini.rect.Size = UDim2.fromScale((x1 - x0) / W, (y1 - y0) / H)
end

---------------------------------------------------------------- snapshots and deltas

function MapView.clear()
	buffer.fill(owner, 0, 0)
	buffer.fill(ownCells, 0, 0)
	table.clear(fadeStart)
	fadeList = {}
	for id in labels do
		removeLabel(id)
	end
	for id in units do
		MapView.removeUnit(id)
	end
	for id in buildings do
		MapView.removeBuilding(id)
	end
	for id, cap in capitals do
		cap.kit.model:Destroy()
		capitals[id] = nil
	end
	table.clear(nations)
	table.clear(MapView.selected)
	MapView.myId = 0
	MapView.phase = "none"
	fogOn = false
	repaintRow = H
	Ground.reset()
end

function MapView.load(s)
	MapView.clear()
	MapView.phase = s.phase
	MapView.myId = s.you or 0
	for _, info in s.nations do
		MapView.upsertNation(info)
	end
	local me = MapView.myId
	Codec.decodeOwners(s.owners, function(t, o)
		writeu16(owner, t * 2, o)
		local n = nations[o]
		if n then
			n.count += 1
			n.sx += t % W
			n.sy += t // W
		end
		if o == me then
			addOwn(t % W, t // W, 1)
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
	Rig.menu = mode == "menu"
	Rig.active = mode == "play"
	if mode == "play" then
		Rig.overview(0.8)
	end
end

---------------------------------------------------------------- frame update

function MapView.update(dt: number)
	Rig.update(dt)
	fxBudget = math.max(0, fxBudget - dt * 40)
	local on = fogActive()
	if on ~= fogOn then
		fogOn = on
		if on then
			computeVisibility()
		end
		repaintAll()
		refreshStatics()
		fogAcc = 0
	elseif on then
		fogAcc += dt
		if fogAcc >= 0.25 then
			fogAcc = 0
			updateFog()
		end
	end
	fadeAcc += dt
	if fadeAcc >= 0.05 then
		fadeAcc = 0
		processFades()
	end
	repaintStep(14)
	Ground.flush()
	updateUnits(dt)
	labelAcc += dt
	if labelAcc >= 0.1 then
		labelAcc = 0
		updateLabels()
		updateMinimap()
	end
end

return MapView
