-- The battlefield seen from above, in 2D: the painted map, buildings and units as sprites,
-- shots and explosions, the camera (drag to move, pinch or wheel to zoom), taps and the
-- minimap. Positions are in tiles. Everything on the board is placed in board-relative
-- scale, so moving or zooming the camera only changes the board frame itself.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Motion = require(Shared.Motion)
local Art = require(script.Parent.Art)
local Sprites = require(script.Parent.Sprites)
local Theme = require(script.Parent.Theme)

local W, H = Map.W, Map.H
local make = Theme.make

local MapView = {}
MapView.ok = true
MapView.nations = {}
MapView.myId = 0
MapView.selected = {}
MapView.spectator = false
MapView.onTap = nil -- (tileX, tileY, screenX, screenY)
MapView.onAltTap = nil -- right mouse button: (tileX, tileY)

-- drawing order on the board
local Z = { ground = 1, mark = 2, building = 3, unit = 4, shot = 5, boom = 6, air = 7, label = 8, top = 9 }

local NEUTRAL = Color3.fromRGB(150, 158, 172)
local SELECT = Color3.fromRGB(120, 255, 150)
local HP_BACK = Color3.fromRGB(14, 17, 22)

-- turret sprites of the buildings that shoot; when the picture has its gun drawn in,
-- the whole building turns to aim instead
local BUILDING_GUN = { tower = "tower_gun", aa = "aa_gun" }
-- how each shooter's shot looks
local SHOT_LOOK = {
	infantry = "bullet", scout = "bullet", fighter = "bullet", cc = "bullet",
	tank = "cannon", tower = "cannon",
	rocket = "rocket", gunship = "rocket",
	artillery = "shell",
	aa = "flak",
}

local gui, view, board
local buildings = {} -- id -> record
local units = {} -- id -> record
local labels = {} -- nation id -> name tag over its command centre
local mode = "menu"
local buildKind = nil
local helpers = {} -- build mode: rings around pools or base zones
local ghost

local cam = { x = W / 2, y = H / 2, ppt = 24 }
local glide = nil -- the camera moves smoothly to { x, y }

local function now(): number
	return workspace:GetServerTimeNow()
end

-- board position and size of something, in tiles
local function at(x: number, y: number): UDim2
	return UDim2.fromScale(x / W, y / H)
end

local function span(w: number, h: number): UDim2
	return UDim2.fromScale(w / W, h / H)
end

-- shortest turn from angle a towards b, at most step degrees
local function turn(a: number, b: number, step: number): number
	local d = (b - a + 180) % 360 - 180
	if math.abs(d) <= step then
		return b
	end
	return a + math.sign(d) * step
end

local function hpColor(k: number): Color3
	if k > 0.6 then
		return Color3.fromRGB(92, 222, 110)
	elseif k > 0.3 then
		return Color3.fromRGB(240, 200, 60)
	end
	return Color3.fromRGB(240, 80, 70)
end

local function teamColor(owner: number): Color3
	local n = MapView.nations[owner]
	return if n then n.color3 else NEUTRAL
end

function MapView.fmt(v: number): string
	v = math.floor(v + 0.5)
	if v >= 1000000 then
		return string.format("%.1fM", v / 1000000)
	elseif v >= 10000 then
		return string.format("%dk", v // 1000)
	end
	return tostring(v)
end

---------------------------------------------------------------- camera

local function viewSize(): Vector2
	local s = view.AbsoluteSize
	return Vector2.new(math.max(s.X, 1), math.max(s.Y, 1))
end

local function zoomLimits(): (number, number)
	local vs = viewSize()
	local fit = math.min(vs.X / (W + 4), vs.Y / (H + 4))
	return math.max(fit, 2), math.max(fit, 46)
end

local function halfView(): (number, number)
	local vs = viewSize()
	return vs.X / 2 / cam.ppt, vs.Y / 2 / cam.ppt
end

local function applyCam()
	local lo, hi = zoomLimits()
	cam.ppt = math.clamp(cam.ppt, lo, hi)
	local hw, hh = halfView()
	local m = 3
	cam.x = if hw * 2 >= W + 2 * m then W / 2 else math.clamp(cam.x, hw - m, W - hw + m)
	cam.y = if hh * 2 >= H + 2 * m then H / 2 else math.clamp(cam.y, hh - m, H - hh + m)
	local vs = viewSize()
	board.Size = UDim2.fromOffset(W * cam.ppt, H * cam.ppt)
	board.Position = UDim2.fromOffset(math.round(vs.X / 2 - cam.x * cam.ppt), math.round(vs.Y / 2 - cam.y * cam.ppt))
end

-- tile coordinates under a screen point (GUI coordinates, as in InputObject.Position)
function MapView.screenToWorld(sx: number, sy: number): (number, number)
	local o = view.AbsolutePosition
	local vs = viewSize()
	return cam.x + (sx - o.X - vs.X / 2) / cam.ppt, cam.y + (sy - o.Y - vs.Y / 2) / cam.ppt
end

local function zoomAround(sx: number, sy: number, f: number)
	local wx, wy = MapView.screenToWorld(sx, sy)
	local lo, hi = zoomLimits()
	cam.ppt = math.clamp(cam.ppt * f, lo, hi)
	local o = view.AbsolutePosition
	local vs = viewSize()
	cam.x = wx - (sx - o.X - vs.X / 2) / cam.ppt
	cam.y = wy - (sy - o.Y - vs.Y / 2) / cam.ppt
	glide = nil
	applyCam()
end

local function panBy(dx: number, dy: number)
	cam.x -= dx / cam.ppt
	cam.y -= dy / cam.ppt
	glide = nil
	applyCam()
end

function MapView.zoom(f: number)
	local o = view.AbsolutePosition
	local vs = viewSize()
	zoomAround(o.X + vs.X / 2, o.Y + vs.Y / 2, f)
end

-- moves the camera to a point, smoothly unless instant
function MapView.focusOn(x: number, y: number, instant: boolean?)
	if instant then
		cam.x, cam.y = x, y
		glide = nil
		applyCam()
	else
		glide = { x = x, y = y }
	end
end

-- a comfortable zoom for playing on this screen
local function playZoom(): number
	return math.clamp(viewSize().Y / 15, 18, 40)
end

---------------------------------------------------------------- sprites

-- the painted ground, cut into pictures that each cover part of parent
local function groundPictures(parent: Instance, z: number)
	local cols, rows = Map.chunks[1], Map.chunks[2]
	for i = 0, cols * rows - 1 do
		local img = make("ImageLabel", {
			Name = "Ground" .. i,
			Position = UDim2.fromScale((i % cols) / cols, (i // cols) / rows),
			Size = UDim2.new(1 / cols, 1, 1 / rows, 1),
			BackgroundTransparency = 1,
			ZIndex = z,
			Parent = parent,
		})
		Art.watch("map" .. i, function(image)
			img.Image = image
		end)
	end
end

-- a sprite and its team-colour layer, centred in parent, rotated together by the caller
local function spritePair(parent: Instance, name: string, color: Color3, z: number, scale: number)
	local props = {
		BackgroundTransparency = 1,
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromScale(scale, scale),
		ZIndex = z,
		Parent = parent,
	}
	local base = make("ImageLabel", props)
	Sprites.set(base, name, "base")
	props.ZIndex = z + 1
	props.ImageColor3 = color
	local tint = make("ImageLabel", props)
	Sprites.set(tint, name, "team")
	return base, tint
end

local function makeBar(parent: Instance, pos: UDim2, anchor: Vector2, z: number)
	local back = make("Frame", {
		AnchorPoint = anchor,
		Position = pos,
		Size = UDim2.new(0.8, 0, 0, 4),
		BackgroundColor3 = HP_BACK,
		BorderSizePixel = 0,
		ZIndex = z,
		Visible = false,
		Parent = parent,
	})
	local fill = make("Frame", { Size = UDim2.fromScale(1, 1), BorderSizePixel = 0, ZIndex = z + 1, Parent = back })
	return back, fill
end

local function ring(parent: Instance, color: Color3, thickness: number, z: number): Frame
	return make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		ZIndex = z,
		Parent = parent,
	}, { Theme.corner(nil, 1), make("UIStroke", { Color = color, Thickness = thickness }) })
end

---------------------------------------------------------------- nations

local function updateLabel(n)
	local tag = labels[n.id]
	if not n.cap or not n.alive then
		if tag then
			tag:Destroy()
			labels[n.id] = nil
		end
		return
	end
	if not tag then
		tag = make("TextLabel", {
			AnchorPoint = Vector2.new(0.5, 1),
			Size = span(10, 1.3),
			BackgroundTransparency = 1,
			TextScaled = true,
			FontFace = Theme.font(Enum.FontWeight.Heavy),
			ZIndex = Z.label,
			Parent = board,
		}, {
			make("UITextSizeConstraint", { MinTextSize = 9, MaxTextSize = 18 }),
			make("UIStroke", { Color = Color3.fromRGB(8, 10, 14), Thickness = 2, Transparency = 0.1 }),
		})
		-- a player's face just left of their name
		local avatar = make("ImageLabel", {
			Name = "Avatar",
			AnchorPoint = Vector2.new(1, 0.5),
			Size = UDim2.fromScale(1, 1),
			SizeConstraint = Enum.SizeConstraint.RelativeYY,
			BackgroundColor3 = Color3.fromRGB(20, 26, 36),
			ZIndex = Z.label,
			Parent = tag,
		}, { Theme.corner(nil, 1) })
		local function place()
			avatar.Position = UDim2.new(0.5, -tag.TextBounds.X / 2 - 4, 0.5, 0)
		end
		tag:GetPropertyChangedSignal("TextBounds"):Connect(place)
		place()
		labels[n.id] = tag
	end
	tag.Position = at(n.cap.x + 0.5, n.cap.y - 1.6)
	tag.Text = n.name
	tag.TextColor3 = n.color3:Lerp(Color3.new(1, 1, 1), 0.25)
	local avatar: any = tag:FindFirstChild("Avatar")
	avatar.Visible = n.human and n.userId > 0
	if avatar.Visible then
		avatar.Image = "rbxthumb://type=AvatarHeadShot&id=" .. n.userId .. "&w=150&h=150"
	end
end

function MapView.upsertNation(info)
	local n = MapView.nations[info.id] or { id = info.id, score = 0 }
	local recolor = n.color ~= nil and n.color ~= info.color
	n.name = info.name
	n.color = info.color
	n.color3 = Color3.fromHex(info.color)
	n.human = info.human == true
	n.userId = info.userId or 0
	n.alive = info.alive ~= false
	n.cap = if info.cap then { x = info.cap[1], y = info.cap[2] } else nil
	MapView.nations[info.id] = n
	updateLabel(n)
	if recolor then
		for _, rec in buildings do
			if rec.owner == n.id then
				rec.tint.ImageColor3 = n.color3
			end
		end
		for _, u in units do
			if u.owner == n.id then
				u.bodyTint.ImageColor3 = n.color3
			end
		end
	end
end

-- s = flat list: nation id, score, nation id, score, ...
function MapView.setStats(s)
	for i = 1, #s - 1, 2 do
		local n = MapView.nations[s[i]]
		if n then
			n.score = s[i + 1]
		end
	end
end

-- centre of the player's command centre, or nil
function MapView.myBase(): (number?, number?)
	local n = MapView.nations[MapView.myId]
	if n and n.cap then
		return n.cap.x + 0.5, n.cap.y + 0.5
	end
	return nil, nil
end

---------------------------------------------------------------- building placement

local function overlaps(ax: number, ay: number, as: number, bx: number, by: number, bs: number): boolean
	return ax < bx + bs and bx < ax + as and ay < by + bs and by < ay + as
end

local function areaFree(x: number, y: number, size: number): boolean
	for _, b in buildings do
		if overlaps(x, y, size, b.x, b.y, b.size) then
			return false
		end
	end
	return true
end

local function nearMyBase(cx: number, cy: number): boolean
	local r2 = Config.BUILD_RADIUS * Config.BUILD_RADIUS
	for _, b in buildings do
		if b.owner == MapView.myId and (b.cx - cx) ^ 2 + (b.cy - cy) ^ 2 <= r2 then
			return true
		end
	end
	return false
end

-- the same rules as the server: top-left tile for a building tapped at (x, y), or nil and why not
function MapView.placeFor(kind: string, x: number, y: number): (number?, number?, string?)
	local def = Config.BUILD[kind]
	local size = def.size
	x, y = math.floor(x), math.floor(y)
	local bx, by
	if def.onPool then
		local best, bd = nil, 3.5 * 3.5
		for _, p in Map.pools do
			local d = (p.x + 1 - (x + 0.5)) ^ 2 + (p.y + 1 - (y + 0.5)) ^ 2
			if d < bd and areaFree(p.x, p.y, 2) then
				best, bd = p, d
			end
		end
		if not best then
			return nil, nil, "Экстрактор ставится на свободное месторождение — светящуюся воронку."
		end
		bx, by = best.x, best.y
	else
		bx, by = x - size // 2, y - size // 2
	end
	for ty = by, by + size - 1 do
		for tx = bx, bx + size - 1 do
			if not Map.inBounds(tx, ty) or not Map.isLand(ty * W + tx) then
				return nil, nil, "Тут нельзя строить: вода, скалы или край карты."
			end
		end
	end
	if not areaFree(bx, by, size) then
		return nil, nil, "Тут тесно: место занято другой постройкой."
	end
	if not def.onPool then
		for _, p in Map.pools do
			if overlaps(bx, by, size, p.x, p.y, 2) then
				return nil, nil, "Месторождения оставь для экстракторов."
			end
		end
	end
	if not nearMyBase(bx + size / 2, by + size / 2) then
		return nil, nil, "Строить можно только рядом со своей базой."
	end
	return bx, by, nil
end

local function clearHelpers()
	for _, h in helpers do
		h.frame:Destroy()
	end
	helpers = {}
end

-- build mode shows where the chosen building can go: free pools for extractors, the base zone for the rest
local function refreshHelpers()
	clearHelpers()
	if not buildKind or mode ~= "play" then
		return
	end
	if Config.BUILD[buildKind].onPool then
		for _, p in Map.pools do
			if areaFree(p.x, p.y, 2) then
				local f = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = at(p.x + 1, p.y + 1), Size = span(2.8, 2.8), BackgroundTransparency = 1, ZIndex = Z.mark, Parent = board })
				ring(f, Color3.fromRGB(110, 255, 220), 2.5, Z.mark)
				table.insert(helpers, { frame = f, pulse = true })
			end
		end
	else
		local r = Config.BUILD_RADIUS
		for _, b in buildings do
			if b.owner == MapView.myId then
				local f = make("Frame", {
					AnchorPoint = Vector2.new(0.5, 0.5),
					Position = at(b.cx, b.cy),
					Size = span(2 * r, 2 * r),
					BackgroundColor3 = Color3.new(1, 1, 1),
					BackgroundTransparency = 0.95,
					ZIndex = Z.mark,
					Parent = board,
				}, { Theme.corner(nil, 1), make("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 1.5, Transparency = 0.55 }) })
				table.insert(helpers, { frame = f })
			end
		end
	end
end

-- outline of the chosen building where it would stand: green if it fits, red if not
local function showGhost(x: number, y: number)
	if not buildKind then
		ghost.Visible = false
		return
	end
	local def = Config.BUILD[buildKind]
	local bx, by, why = MapView.placeFor(buildKind, x, y)
	local s = def.size
	if not bx or not by then
		bx, by = math.floor(x) - s // 2, math.floor(y) - s // 2
	end
	ghost.Position = at(bx, by)
	ghost.Size = span(s, s)
	local color = if why then Color3.fromRGB(255, 90, 80) else Color3.fromRGB(110, 255, 140)
	ghost.BackgroundColor3 = color
	local stroke: any = ghost:FindFirstChildOfClass("UIStroke")
	stroke.Color = color
	ghost.Visible = true
end

-- kind = building chosen in the build bar, or nil
function MapView.setBuild(kind: string?)
	buildKind = kind
	refreshHelpers()
	if not kind then
		ghost.Visible = false
	end
end

function MapView.ghostAt(x: number, y: number)
	showGhost(x, y)
end

---------------------------------------------------------------- buildings

local function refreshBuilding(rec)
	local building = rec.built < 1
	local fade = if building then 0.45 else 0
	rec.base.ImageTransparency = fade
	rec.tint.ImageTransparency = fade
	if rec.gun then
		rec.gun.ImageTransparency = fade
		rec.gunTint.ImageTransparency = fade
	end
	local k = math.clamp(rec.hp / math.max(rec.maxHp, 1), 0, 1)
	rec.hpBar.Visible = k < 0.999
	rec.hpFill.Size = UDim2.fromScale(k, 1)
	rec.hpFill.BackgroundColor3 = hpColor(k)
	if building then
		rec.workBar.Visible = true
		rec.workFill.Size = UDim2.fromScale(rec.built, 1)
		rec.workFill.BackgroundColor3 = Color3.fromRGB(90, 170, 255)
	elseif rec.prog ~= 0 then
		rec.workBar.Visible = true
		rec.workFill.Size = UDim2.fromScale(math.abs(rec.prog), 1)
		rec.workFill.BackgroundColor3 = if rec.prog < 0 then Color3.fromRGB(240, 80, 70) else Color3.fromRGB(255, 170, 50)
	else
		rec.workBar.Visible = false
	end
end

function MapView.addBuilding(info)
	local rec = buildings[info.id]
	if rec then
		rec.hp, rec.maxHp, rec.built = info.hp, info.maxHp, info.built
		refreshBuilding(rec)
		return
	end
	local def = Config.BUILD[info.kind]
	if not def then
		return
	end
	local size = info.size or def.size
	rec = {
		id = info.id,
		kind = info.kind,
		owner = info.owner,
		x = info.x,
		y = info.y,
		size = size,
		cx = info.x + size / 2,
		cy = info.y + size / 2,
		hp = info.hp,
		maxHp = info.maxHp,
		built = info.built,
		prog = 0,
		queue = {},
		auto = "",
		gunAngle = 180,
	}
	local color = teamColor(info.owner)
	rec.frame = make("Frame", { BackgroundTransparency = 1, Position = at(rec.x, rec.y), Size = span(size, size), ZIndex = Z.building, Parent = board })
	rec.base, rec.tint = spritePair(rec.frame, def.icon, color, 1, 1)
	local gun = BUILDING_GUN[info.kind]
	if gun and Sprites.has(gun) then
		rec.gun, rec.gunTint = spritePair(rec.frame, gun, color, 3, 0.85)
		rec.gun.Rotation, rec.gunTint.Rotation = rec.gunAngle, rec.gunAngle
	elseif gun then
		rec.spin = true
		rec.gunAngle = 0
	end
	rec.hpBar, rec.hpFill = makeBar(rec.frame, UDim2.new(0.5, 0, 1, -2), Vector2.new(0.5, 1), 6)
	rec.workBar, rec.workFill = makeBar(rec.frame, UDim2.new(0.5, 0, 1, -8), Vector2.new(0.5, 1), 6)
	buildings[rec.id] = rec
	refreshBuilding(rec)
	if buildKind then
		refreshHelpers()
	end
end

function MapView.removeBuilding(id: number)
	local rec = buildings[id]
	if rec then
		rec.frame:Destroy()
		buildings[id] = nil
		if buildKind then
			refreshHelpers()
		end
	end
end

function MapView.finishBuilding(id: number)
	local rec = buildings[id]
	if rec then
		rec.built = 1
		refreshBuilding(rec)
	end
end

-- the player's own buildings: { id, p = production (negative while waiting for money), built, q, auto }
function MapView.setProgress(list)
	for _, e in list do
		local rec = buildings[e.id]
		if rec then
			rec.prog = e.p
			rec.built = math.max(rec.built, e.built)
			rec.queue = e.q
			rec.auto = e.auto
			refreshBuilding(rec)
		end
	end
end

-- list = flat: building id, hp, ...
function MapView.setBuildingHp(list)
	for i = 1, #list - 1, 2 do
		local rec = buildings[list[i]]
		if rec then
			rec.hp = list[i + 1]
			refreshBuilding(rec)
		end
	end
end

function MapView.buildingRecord(id: number)
	return buildings[id]
end

-- the building under a screen point, or nil
function MapView.buildingAt(sx: number, sy: number): number?
	local x, y = MapView.screenToWorld(sx, sy)
	local m = 0.15
	for id, b in buildings do
		if x >= b.x - m and x <= b.x + b.size + m and y >= b.y - m and y <= b.y + b.size + m then
			return id
		end
	end
	return nil
end

---------------------------------------------------------------- units

local function refreshUnit(u)
	local sel = MapView.selected[u.id] == true
	if sel and not u.ring then
		u.ring = ring(u.frame, SELECT, 2, 1)
		u.ring.Size = UDim2.fromScale(0.95, 0.95)
	end
	if u.ring then
		u.ring.Visible = sel
	end
	local k = math.clamp(u.hp / math.max(u.maxHp, 1), 0, 1)
	local show = sel or k < 0.999
	if show and not u.bar then
		u.bar, u.barFill = makeBar(u.frame, UDim2.fromScale(0.5, 0.08), Vector2.new(0.5, 1), 8)
	end
	if u.bar then
		u.bar.Visible = show
		u.barFill.Size = UDim2.fromScale(k, 1)
		u.barFill.BackgroundColor3 = hpColor(k)
	end
end

function MapView.addUnit(info)
	local u = units[info.id]
	if u then
		u.path, u.t0, u.speed, u.orbit = info.path, info.t0, info.speed, info.orbit
		u.hp, u.maxHp = info.hp, info.maxHp
		refreshUnit(u)
		return
	end
	local def = Config.UNITS[info.kind]
	if not def then
		return
	end
	u = {
		id = info.id,
		kind = info.kind,
		owner = info.owner,
		path = info.path,
		t0 = info.t0,
		speed = info.speed,
		orbit = info.orbit,
		hp = info.hp,
		maxHp = info.maxHp,
		def = def,
		air = def.air == true,
		heading = 180,
		gunAngle = 180,
	}
	local color = teamColor(info.owner)
	local s = def.size or 1.5
	u.frame = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Size = span(s, s),
		BackgroundTransparency = 1,
		ZIndex = if u.air then Z.air else Z.unit,
		Parent = board,
	})
	if u.air then
		-- the aircraft's shadow on the ground below it
		local props = {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.78, 1.0),
			Size = UDim2.fromScale(0.8, 0.8),
			BackgroundTransparency = 1,
			ImageColor3 = Color3.new(0, 0, 0),
			ImageTransparency = 0.6,
			ZIndex = 0,
			Parent = u.frame,
		}
		u.shadow = make("ImageLabel", props)
		Sprites.set(u.shadow, def.icon, "base")
		u.shadowTint = make("ImageLabel", props)
		Sprites.set(u.shadowTint, def.icon, "team")
	end
	u.body, u.bodyTint = spritePair(u.frame, def.icon, color, 2, 1)
	if def.gun and Sprites.has(def.gun) then
		u.gun, u.gunTint = spritePair(u.frame, def.gun, color, 4, 1)
	end
	if info.kind == "gunship" then
		u.rotor = make("ImageLabel", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.42),
			Size = UDim2.fromScale(1.1, 1.1),
			BackgroundTransparency = 1,
			ImageTransparency = 0.15,
			ZIndex = 6,
			Parent = u.frame,
		})
		Sprites.set(u.rotor, "rotor", "base")
	end
	units[u.id] = u
	local x, y = Motion.position(u, now())
	u.x, u.y = x, y
	u.frame.Position = at(x, y)
	refreshUnit(u)
end

function MapView.removeUnit(id: number)
	local u = units[id]
	if u then
		u.frame:Destroy()
		units[id] = nil
		MapView.selected[id] = nil
	end
end

-- list = flat: unit id, hp, ...
function MapView.setUnitHp(list)
	for i = 1, #list - 1, 2 do
		local u = units[list[i]]
		if u then
			u.hp = list[i + 1]
			refreshUnit(u)
		end
	end
end

function MapView.unitRecord(id: number)
	return units[id]
end

function MapView.refreshSelection()
	for id in MapView.selected do
		if not units[id] then
			MapView.selected[id] = nil
		end
	end
	for _, u in units do
		if u.owner == MapView.myId then
			refreshUnit(u)
		end
	end
end

-- ids of the player's units, of one kind or all
function MapView.ownUnits(kind: string?): { number }
	local ids = {}
	for id, u in units do
		if u.owner == MapView.myId and (kind == nil or u.kind == kind) then
			table.insert(ids, id)
		end
	end
	return ids
end

-- ids of the player's units now on screen
function MapView.ownUnitsOnScreen(): { number }
	local hw, hh = halfView()
	local ids = {}
	for id, u in units do
		if u.owner == MapView.myId and math.abs(u.x - cam.x) <= hw and math.abs(u.y - cam.y) <= hh then
			table.insert(ids, id)
		end
	end
	return ids
end

-- the player's unit under a screen point, or nil
function MapView.unitAt(sx: number, sy: number): number?
	local x, y = MapView.screenToWorld(sx, sy)
	local best, bd = nil, math.huge
	for id, u in units do
		if u.owner == MapView.myId then
			local reach = math.max((u.def.size or 1.5) * 0.5, 22 / cam.ppt)
			local d = math.sqrt((u.x - x) ^ 2 + (u.y - y) ^ 2)
			if d <= reach and d < bd then
				best, bd = id, d
			end
		end
	end
	return best
end

-- any unit or building under a screen point: "unit"/"building", id
function MapView.thingAt(sx: number, sy: number): (string?, number?)
	local x, y = MapView.screenToWorld(sx, sy)
	local best, bd = nil, math.huge
	for id, u in units do
		local reach = math.max((u.def.size or 1.5) * 0.5, 22 / cam.ppt)
		local d = math.sqrt((u.x - x) ^ 2 + (u.y - y) ^ 2)
		if d <= reach and d < bd then
			best, bd = id, d
		end
	end
	if best then
		return "unit", best
	end
	local b = MapView.buildingAt(sx, sy)
	if b then
		return "building", b
	end
	return nil, nil
end

local function updateUnits(dt: number)
	local t = now()
	local clock = os.clock()
	local hw, hh = halfView()
	for _, u in units do
		local x, y = Motion.position(u, t)
		local dx, dy = x - u.x, y - u.y
		u.x, u.y = x, y
		local onScreen = math.abs(x - cam.x) <= hw + 3 and math.abs(y - cam.y) <= hh + 3
		u.frame.Visible = onScreen
		if dx * dx + dy * dy > 1e-7 then
			u.want = math.deg(math.atan2(dx, -dy))
		end
		if not onScreen then
			continue
		end
		u.frame.Position = at(x, y)
		local aiming = u.aimUntil ~= nil and u.aimUntil > clock
		-- soldiers turn to shoot; vehicles turn their turret
		local want = u.want or u.heading
		if aiming and not u.gun and not u.air then
			want = u.aim
		end
		local quick = u.kind == "infantry" or u.kind == "rocket"
		u.heading = turn(u.heading, want, (if quick then 720 else 240) * dt)
		u.body.Rotation, u.bodyTint.Rotation = u.heading, u.heading
		if u.shadow then
			u.shadow.Rotation, u.shadowTint.Rotation = u.heading, u.heading
		end
		if u.gun then
			u.gunAngle = turn(u.gunAngle, if aiming then u.aim else u.heading, 300 * dt)
			u.gun.Rotation, u.gunTint.Rotation = u.gunAngle, u.gunAngle
		end
		if u.rotor then
			u.rotor.Rotation = (u.rotor.Rotation + dt * 1080) % 360
		end
	end
	for _, b in buildings do
		if b.gun or b.spin then
			local want = if b.aimUntil and b.aimUntil > clock then b.aim else b.gunAngle
			b.gunAngle = turn(b.gunAngle, want, 200 * dt)
			local turret = if b.gun then b.gun else b.base
			local turretTint = if b.gun then b.gunTint else b.tint
			turret.Rotation, turretTint.Rotation = b.gunAngle, b.gunAngle
		end
	end
end

---------------------------------------------------------------- shots and explosions

local effects = {} -- running: { t0, life, step(k), finish() }
local pending = {} -- shots waiting for their moment: { at, fn }
local linePool, imagePool = {}, {}
local scorches = {}

local function addEffect(life: number, step, finish)
	table.insert(effects, { t0 = os.clock(), life = life, step = step, finish = finish })
	step(0)
end

local function takeLine(color: Color3, z: number): Frame
	local f = table.remove(linePool)
	if not f then
		f = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), BorderSizePixel = 0, Parent = board })
	end
	f.BackgroundColor3 = color
	f.BackgroundTransparency = 0
	f.ZIndex = z
	f.Visible = true
	return f
end

local function takeImage(name: string, z: number): ImageLabel
	local img = table.remove(imagePool)
	if not img then
		img = make("ImageLabel", { AnchorPoint = Vector2.new(0.5, 0.5), BackgroundTransparency = 1, Parent = board })
	end
	Sprites.set(img, name, "base")
	img.ImageColor3 = Color3.new(1, 1, 1)
	img.ImageTransparency = 0
	img.ZIndex = z
	img.Visible = true
	return img
end

local function release(obj: GuiObject, pool)
	obj.Visible = false
	table.insert(pool, obj)
end

local function placeLine(f: Frame, x1: number, y1: number, x2: number, y2: number, px: number)
	local dx, dy = x2 - x1, y2 - y1
	f.Position = at((x1 + x2) / 2, (y1 + y2) / 2)
	f.Size = UDim2.new(math.sqrt(dx * dx + dy * dy) / W, 0, 0, px)
	f.Rotation = math.deg(math.atan2(dy, dx))
end

local function explosion(x: number, y: number, size: number, life: number, tint: Color3?)
	if #effects > 160 then
		return
	end
	local img = takeImage("explosion", Z.boom)
	img.Position = at(x, y)
	img.Rotation = math.random(0, 359)
	if tint then
		img.ImageColor3 = tint
	end
	addEffect(life, function(k)
		local s = size * (0.4 + 0.8 * math.sqrt(k))
		img.Size = span(s, s)
		img.ImageTransparency = k * k
	end, function()
		release(img, imagePool)
	end)
end

local function scorch(x: number, y: number, size: number)
	local rec
	if #scorches >= 24 then
		rec = table.remove(scorches, 1)
	else
		local img = make("ImageLabel", { AnchorPoint = Vector2.new(0.5, 0.5), BackgroundTransparency = 1, ZIndex = Z.mark, Parent = board })
		Sprites.set(img, "scorch", "base")
		rec = { img = img }
	end
	rec.t0 = os.clock()
	rec.img.Position = at(x, y)
	rec.img.Size = span(size, size)
	rec.img.Rotation = math.random(0, 359)
	rec.img.ImageTransparency = 0.1
	rec.img.Visible = true
	table.insert(scorches, rec)
end

local function tracer(x1: number, y1: number, x2: number, y2: number, color: Color3, px: number, life: number)
	if #effects > 160 then
		return
	end
	local f = takeLine(color, Z.shot)
	placeLine(f, x1, y1, x2, y2, px)
	addEffect(life, function(k)
		f.BackgroundTransparency = k
	end, function()
		release(f, linePool)
	end)
end

-- a rocket or shell flying from (x1, y1) to (x2, y2), then onHit
local function projectile(x1: number, y1: number, x2: number, y2: number, color: Color3, px: number, len: number, travel: number, onHit)
	if #effects > 160 then
		return
	end
	local f = takeLine(color, Z.shot)
	local dx, dy = x2 - x1, y2 - y1
	f.Size = UDim2.new(len / W, 0, 0, px)
	f.Rotation = math.deg(math.atan2(dy, dx))
	addEffect(travel, function(k)
		f.Position = at(x1 + dx * k, y1 + dy * k)
	end, function()
		release(f, linePool)
		onHit()
	end)
end

local function shotEffect(look: string, x1: number, y1: number, x2: number, y2: number)
	if look == "cannon" then
		explosion(x1, y1, 0.6, 0.12)
		tracer(x1, y1, x2, y2, Color3.fromRGB(255, 205, 100), 3, 0.1)
		explosion(x2, y2, 0.9, 0.3)
	elseif look == "rocket" then
		projectile(x1, y1, x2, y2, Color3.fromRGB(255, 160, 60), 3, 0.55, 0.25, function()
			explosion(x2, y2, 1, 0.35)
		end)
	elseif look == "shell" then
		explosion(x1, y1, 0.8, 0.15)
		projectile(x1, y1, x2, y2, Color3.fromRGB(255, 225, 140), 4, 0.3, 0.55, function()
			explosion(x2, y2, 1.5, 0.45)
		end)
	elseif look == "flak" then
		tracer(x1, y1, x2, y2, Color3.fromRGB(220, 232, 255), 2, 0.08)
		explosion(x2, y2, 0.9, 0.4, Color3.fromRGB(190, 190, 200))
	else
		tracer(x1, y1, x2, y2, Color3.fromRGB(255, 240, 170), 2, 0.07)
	end
end

-- who fired a shot that started at (x, y): a shooting building there, or the nearest unit in range
local function shooterAt(x: number, y: number, x2: number, y2: number)
	for _, b in buildings do
		if Config.BUILD[b.kind].dps and math.abs(b.cx - x) < 0.3 and math.abs(b.cy - y) < 0.3 then
			return b
		end
	end
	local dist = math.sqrt((x2 - x) ^ 2 + (y2 - y) ^ 2)
	local best, bd = nil, 2.5
	for _, u in units do
		local d = math.sqrt((u.x - x) ^ 2 + (u.y - y) ^ 2)
		if d < bd and u.def.range + 1.5 >= dist then
			best, bd = u, d
		end
	end
	return best
end

-- list = flat: from x, from y, to x, to y, ... (shots of the last moment)
function MapView.shots(list)
	local clock = os.clock()
	for i = 1, #list - 3, 4 do
		local x1, y1, x2, y2 = list[i], list[i + 1], list[i + 2], list[i + 3]
		local shooter = shooterAt(x1, y1, x2, y2)
		local look = if shooter then SHOT_LOOK[shooter.kind] or "bullet" else "bullet"
		if shooter then
			shooter.aim = math.deg(math.atan2(x2 - x1, -(y2 - y1)))
			shooter.aimUntil = clock + 1.6
		end
		local delay = math.random() * Config.NET_RATE
		table.insert(pending, {
			at = clock + delay,
			fn = function()
				-- moving shooters have moved on a little: start from where they are drawn now
				if shooter and shooter.path and shooter.frame.Parent then
					x1, y1 = shooter.x, shooter.y
				end
				shotEffect(look, x1, y1, x2, y2)
			end,
		})
	end
end

function MapView.boom(x: number, y: number, big: boolean)
	if big then
		explosion(x, y, 2.8, 0.7)
		table.insert(pending, { at = os.clock() + 0.12, fn = function()
			explosion(x + 0.7, y - 0.4, 1.6, 0.5)
		end })
		table.insert(pending, { at = os.clock() + 0.22, fn = function()
			explosion(x - 0.6, y + 0.5, 1.4, 0.5)
		end })
		scorch(x, y, 3)
	else
		explosion(x, y, 1.4, 0.45)
		scorch(x, y, 1.2)
	end
end

-- a ring that shrinks where an order was given
function MapView.marker(x: number, y: number, color: Color3?)
	local f = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = at(x, y), BackgroundTransparency = 1, ZIndex = Z.top, Parent = board })
	local r = ring(f, color or SELECT, 2.5, Z.top)
	local stroke: any = r:FindFirstChildOfClass("UIStroke")
	addEffect(0.55, function(k)
		local s = 1.9 - 1.3 * k
		f.Size = span(s, s)
		stroke.Transparency = k
	end, function()
		f:Destroy()
	end)
end

local function updateEffects()
	local clock = os.clock()
	for i = #pending, 1, -1 do
		local p = pending[i]
		if clock >= p.at then
			pending[i] = pending[#pending]
			pending[#pending] = nil
			p.fn()
		end
	end
	for i = #effects, 1, -1 do
		local e = effects[i]
		local k = (clock - e.t0) / e.life
		if k >= 1 then
			effects[i] = effects[#effects]
			effects[#effects] = nil
			e.finish()
		else
			e.step(k)
		end
	end
	for i = #scorches, 1, -1 do
		local s = scorches[i]
		local k = math.clamp((clock - s.t0 - 20) / 15, 0, 1)
		s.img.ImageTransparency = 0.1 + 0.9 * k
		if k >= 1 then
			s.img:Destroy()
			table.remove(scorches, i)
		end
	end
	for _, h in helpers do
		if h.pulse then
			local s = 2.6 + 0.35 * math.sin(clock * 5)
			h.frame.Size = span(s, s)
		end
	end
end

---------------------------------------------------------------- minimap

local mini = nil

function MapView.attachMinimap(holder: GuiObject?)
	if not holder then
		return
	end
	mini = { holder = holder, dots = {}, used = 0 }
	groundPictures(holder, holder.ZIndex)
	mini.camRect = make("Frame", { BackgroundTransparency = 1, ZIndex = holder.ZIndex + 2, Parent = holder }, {
		make("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 1.5 }),
	})
	local dragging = nil
	local function jump(p: Vector3)
		local o, s = holder.AbsolutePosition, holder.AbsoluteSize
		local x = math.clamp((p.X - o.X) / math.max(s.X, 1), 0, 1) * W
		local y = math.clamp((p.Y - o.Y) / math.max(s.Y, 1), 0, 1) * H
		MapView.focusOn(x, y, true)
	end
	holder.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = input
			jump(input.Position)
		end
	end)
	UserInputService.InputChanged:Connect(function(input)
		if not dragging then
			return
		end
		if input == dragging or (dragging.UserInputType == Enum.UserInputType.MouseButton1 and input.UserInputType == Enum.UserInputType.MouseMovement) then
			jump(input.Position)
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input == dragging or (dragging and input.UserInputType == Enum.UserInputType.MouseButton1) then
			dragging = nil
		end
	end)
end

local function miniDot(x: number, y: number, s: number, color: Color3)
	mini.used += 1
	local d = mini.dots[mini.used]
	if not d then
		d = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), BorderSizePixel = 0, ZIndex = mini.holder.ZIndex + 1, Parent = mini.holder })
		mini.dots[mini.used] = d
	end
	d.Position = at(x, y)
	d.Size = UDim2.fromOffset(s, s)
	d.BackgroundColor3 = color
	d.Visible = true
end

local function updateMinimap()
	if not mini or not mini.holder.Visible then
		return
	end
	mini.used = 0
	local px = mini.holder.AbsoluteSize.X / W
	for _, b in buildings do
		miniDot(b.cx, b.cy, math.max(3, b.size * px), teamColor(b.owner))
	end
	for _, u in units do
		miniDot(u.x, u.y, 2, teamColor(u.owner))
	end
	for i = mini.used + 1, #mini.dots do
		mini.dots[i].Visible = false
	end
	local hw, hh = halfView()
	mini.camRect.Position = at(cam.x - hw, cam.y - hh)
	mini.camRect.Size = span(2 * hw, 2 * hh)
end

---------------------------------------------------------------- input

local function setupInput()
	local touches = {}
	local touchCount = 0
	local gesture = nil

	local function point(input: InputObject): Vector2
		return Vector2.new(input.Position.X, input.Position.Y)
	end

	UserInputService.InputBegan:Connect(function(input, processed)
		if processed or mode ~= "play" then
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseButton2 then
			if MapView.onAltTap then
				local x, y = MapView.screenToWorld(input.Position.X, input.Position.Y)
				if Map.inBounds(math.floor(x), math.floor(y)) then
					MapView.onAltTap(math.floor(x), math.floor(y))
				end
			end
			return
		end
		local isTouch = input.UserInputType == Enum.UserInputType.Touch
		if not isTouch and input.UserInputType ~= Enum.UserInputType.MouseButton1 then
			return
		end
		glide = nil
		local p = point(input)
		if isTouch then
			touches[input] = p
			touchCount += 1
		end
		if touchCount <= 1 then
			gesture = { start = p, last = p, moved = false }
		elseif gesture then
			gesture.moved = true
			gesture.pinch = nil
		end
	end)

	UserInputService.InputChanged:Connect(function(input, processed)
		if mode ~= "play" then
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseWheel then
			if not processed then
				zoomAround(input.Position.X, input.Position.Y, if input.Position.Z > 0 then 1.2 else 1 / 1.2)
			end
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseMovement and buildKind and not gesture then
			local x, y = MapView.screenToWorld(input.Position.X, input.Position.Y)
			showGhost(x, y)
		end
		if not gesture then
			return
		end
		if input.UserInputType == Enum.UserInputType.Touch then
			if not touches[input] then
				return
			end
			touches[input] = point(input)
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
					zoomAround(mid.X, mid.Y, dist / math.max(gesture.pinch.dist, 1))
					panBy(mid.X - gesture.pinch.mid.X, mid.Y - gesture.pinch.mid.Y)
				end
				gesture.pinch = { dist = dist, mid = mid }
				return
			end
		elseif input.UserInputType ~= Enum.UserInputType.MouseMovement then
			return
		end
		local p = point(input)
		if not gesture.moved and (p - gesture.start).Magnitude > 10 then
			gesture.moved = true
		end
		if gesture.moved then
			panBy(p.X - gesture.last.X, p.Y - gesture.last.Y)
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
			if not gesture.moved and mode == "play" and MapView.onTap then
				local p = point(input)
				local x, y = MapView.screenToWorld(p.X, p.Y)
				local tx, ty = math.floor(x), math.floor(y)
				if Map.inBounds(tx, ty) then
					MapView.onTap(tx, ty, p.X, p.Y)
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

---------------------------------------------------------------- setup and state

function MapView.init(playerGui: PlayerGui)
	gui = make("ScreenGui", {
		Name = "TerraForgeMap",
		ResetOnSpawn = false,
		IgnoreGuiInset = true,
		DisplayOrder = 0,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	})
	view = make("Frame", {
		Name = "View",
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Color3.fromRGB(16, 22, 18),
		BorderSizePixel = 0,
		Parent = gui,
	})
	board = make("Frame", {
		Name = "Board",
		BackgroundColor3 = Color3.fromRGB(62, 96, 46),
		BorderSizePixel = 0,
		Parent = view,
	})
	groundPictures(board, Z.ground)
	ghost = make("Frame", { BackgroundTransparency = 0.7, Visible = false, ZIndex = Z.top, Parent = board }, {
		make("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 2 }),
	})
	gui.Parent = playerGui
	cam.ppt = viewSize().Y / 20
	applyCam()
	view:GetPropertyChangedSignal("AbsoluteSize"):Connect(applyCam)
	setupInput()
end

function MapView.clear()
	for _, b in buildings do
		b.frame:Destroy()
	end
	for _, u in units do
		u.frame:Destroy()
	end
	for _, tag in labels do
		tag:Destroy()
	end
	for _, s in scorches do
		s.img:Destroy()
	end
	-- finishing a rocket starts its explosion, which then goes into the new list and ends by itself
	local old = effects
	effects = {}
	for _, e in old do
		e.finish()
	end
	buildings, units, labels, scorches, pending = {}, {}, {}, {}, {}
	clearHelpers()
	table.clear(MapView.selected)
	MapView.nations = {}
	MapView.myId = 0
end

-- the whole match state, sent when the player joins or starts playing
function MapView.load(s)
	MapView.clear()
	MapView.myId = s.you
	for _, n in s.nations do
		MapView.upsertNation(n)
	end
	for _, b in s.buildings do
		MapView.addBuilding(b)
	end
	for _, u in s.units do
		MapView.addUnit(u)
	end
end

function MapView.setPhase(_phase: string) end

-- "menu": the battle drifts slowly behind the menu; "play": the player moves the camera
function MapView.setMode(m: string)
	mode = m
	if m == "play" then
		cam.ppt = playZoom()
	else
		table.clear(MapView.selected)
		MapView.setBuild(nil)
	end
	MapView.refreshSelection()
end

local miniAcc = 0
function MapView.update(dt: number)
	if mode == "menu" then
		local t = os.clock()
		cam.ppt = viewSize().Y / 22
		cam.x = W / 2 + math.sin(t * 0.045) * W * 0.3
		cam.y = H / 2 + math.sin(t * 0.031 + 1) * H * 0.25
	else
		if glide then
			local k = math.min(1, dt * 6)
			cam.x += (glide.x - cam.x) * k
			cam.y += (glide.y - cam.y) * k
			if math.abs(glide.x - cam.x) + math.abs(glide.y - cam.y) < 0.05 then
				glide = nil
			end
		end
		if not UserInputService:GetFocusedTextBox() then
			local mx, my = 0, 0
			if UserInputService:IsKeyDown(Enum.KeyCode.A) or UserInputService:IsKeyDown(Enum.KeyCode.Left) then
				mx -= 1
			end
			if UserInputService:IsKeyDown(Enum.KeyCode.D) or UserInputService:IsKeyDown(Enum.KeyCode.Right) then
				mx += 1
			end
			if UserInputService:IsKeyDown(Enum.KeyCode.W) or UserInputService:IsKeyDown(Enum.KeyCode.Up) then
				my -= 1
			end
			if UserInputService:IsKeyDown(Enum.KeyCode.S) or UserInputService:IsKeyDown(Enum.KeyCode.Down) then
				my += 1
			end
			if mx ~= 0 or my ~= 0 then
				glide = nil
				cam.x += mx * 900 * dt / cam.ppt
				cam.y += my * 900 * dt / cam.ppt
			end
		end
	end
	applyCam()
	updateUnits(dt)
	updateEffects()
	miniAcc += dt
	if miniAcc >= 0.25 then
		miniAcc = 0
		updateMinimap()
	end
end

return MapView
