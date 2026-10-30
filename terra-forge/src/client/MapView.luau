-- The battlefield seen from above, in 2D: the painted map, buildings and units as sprites with
-- their animations, the camera (drag, pinch, wheel, keys, screen edges), taps, selection boxes
-- and the minimap. Positions are in tiles; see Board. Shots and explosions are in Effects.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Motion = require(Shared.Motion)
local Art = require(script.Parent.Art)
local Board = require(script.Parent.Board)
local Effects = require(script.Parent.Effects)
local Sfx = require(script.Parent.Sfx)
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
MapView.onBox = nil -- a selection box was drawn: (x0, y0, x1, y1) in tiles
MapView.boxArmed = false -- on touch screens, the next drag draws a selection box

local Z = Board.Z
local at, span = Board.at, Board.span

local NEUTRAL = Color3.fromRGB(150, 158, 172)
local SELECT = Color3.fromRGB(120, 255, 150)
local HP_BACK = Color3.fromRGB(14, 17, 22)

-- turret sprites of the buildings that shoot; when the picture has its gun drawn in,
-- the whole building turns to aim instead
local BUILDING_GUN = { tower = "tower_gun", aa = "aa_gun" }
-- how each shooter's shot looks, and sounds
local SHOT_LOOK = {
	infantry = "bullet", scout = "bullet", fighter = "bullet", cc = "bullet",
	tank = "cannon", tower = "cannon",
	rocket = "rocket", gunship = "rocket",
	artillery = "shell",
	aa = "flak",
}
local SHOT_SOUND = {
	infantry = "rifle", scout = "mg", fighter = "mg", cc = "mg",
	tank = "cannon", tower = "tower",
	rocket = "rocket", gunship = "rocket",
	artillery = "artillery",
	aa = "flak",
}
-- soldiers walk with a little sway; tracked and wheeled vehicles leave prints on the ground
local WALKERS = { infantry = true, rocket = true }
local TRACKED = { tank = 0.4, artillery = 0.4, scout = 0.28 } -- kind -> how dark the prints are

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

-- a building under construction rises from the ground: the finished part is shown above a
-- faint plan of the whole, with a bright line where the work is going on
local function refreshBuilding(rec)
	local building = rec.built < 1
	local k = math.clamp(rec.built, 0.02, 1)
	rec.clip.ClipsDescendants = building
	rec.clip.Size = UDim2.fromScale(1, if building then k else 1)
	for _, img in { rec.base, rec.tint } do
		img.Size = UDim2.fromScale(1, if building then 1 / k else 1)
	end
	rec.plan.Visible = building
	rec.planTint.Visible = building
	rec.line.Visible = building
	rec.line.Position = UDim2.fromScale(0.5, 1 - k)
	local hp = math.clamp(rec.hp / math.max(rec.maxHp, 1), 0, 1)
	rec.hpBar.Visible = hp < 0.999
	rec.hpFill.Size = UDim2.fromScale(hp, 1)
	rec.hpFill.BackgroundColor3 = hpColor(hp)
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
		rec.hp, rec.maxHp, rec.built = info.hp, info.maxHp, math.max(rec.built, info.built)
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
		def = def,
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
	rec.frame = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundTransparency = 1,
		Position = at(rec.cx, rec.cy),
		Size = span(size, size),
		ZIndex = Z.building,
		Parent = board,
	})
	rec.plan, rec.planTint = spritePair(rec.frame, def.icon, color, 1, 1)
	rec.plan.ImageTransparency, rec.planTint.ImageTransparency = 0.8, 0.7
	rec.clip = make("Frame", {
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.fromScale(0, 1),
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		ZIndex = 3,
		Parent = rec.frame,
	})
	rec.base, rec.tint = spritePair(rec.clip, def.icon, color, 1, 1)
	for _, img in { rec.base, rec.tint } do
		img.AnchorPoint = Vector2.new(0.5, 1)
		img.Position = UDim2.fromScale(0.5, 1)
	end
	rec.line = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Size = UDim2.new(0.9, 0, 0, 2),
		BackgroundColor3 = color:Lerp(Color3.new(1, 1, 1), 0.6),
		BorderSizePixel = 0,
		ZIndex = 5,
		Parent = rec.frame,
	})
	local gun = BUILDING_GUN[info.kind]
	if gun and Sprites.has(gun) then
		rec.gun, rec.gunTint = spritePair(rec.frame, gun, color, 4, 0.85)
		rec.gun.Rotation, rec.gunTint.Rotation = rec.gunAngle, rec.gunAngle
	elseif gun then
		rec.spin = true
		rec.gunAngle = 0
	end
	rec.hpBar, rec.hpFill = makeBar(rec.frame, UDim2.new(0.5, 0, 1, -2), Vector2.new(0.5, 1), 6)
	rec.workBar, rec.workFill = makeBar(rec.frame, UDim2.new(0.5, 0, 1, -8), Vector2.new(0.5, 1), 6)
	buildings[rec.id] = rec
	refreshBuilding(rec)
	if rec.built < 1 and not MapView.loading then
		Sfx.at("build", rec.cx, rec.cy)
		for i = 1, 3 do
			Effects.dust(rec.cx + (math.random() - 0.5) * size, rec.cy + size * 0.4, size * 0.5)
		end
	end
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
		Effects.pop(rec.frame, rec.size, rec.size)
		Effects.dust(rec.cx, rec.cy + rec.size * 0.3, rec.size * 0.9)
		if rec.owner == MapView.myId then
			Sfx.play("built")
		end
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
	if u.owner == MapView.myId and not MapView.loading then
		Sfx.play("ready")
	end
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

-- ids of the player's units inside a box, corners in tiles
function MapView.unitsInBox(x0: number, y0: number, x1: number, y1: number): { number }
	local ids = {}
	for id, u in units do
		if u.owner == MapView.myId then
			local r = (u.def.size or 1.5) * 0.3
			if u.x + r >= x0 and u.x - r <= x1 and u.y + r >= y0 and u.y - r <= y1 then
				table.insert(ids, id)
			end
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

local function approach(v: number, target: number, step: number): number
	if v < target then
		return math.min(target, v + step)
	end
	return math.max(target, v - step)
end

-- a sprite and its team layer turned, nudged off centre and stretched together
local function pose(a: ImageLabel, b: ImageLabel, rot: number, ox: number, oy: number, sx: number, sy: number)
	a.Rotation, b.Rotation = rot, rot
	local pos = UDim2.fromScale(0.5 + ox, 0.5 + oy)
	a.Position, b.Position = pos, pos
	local size = UDim2.fromScale(sx, sy)
	a.Size, b.Size = size, size
end

-- how far a gun is pushed back by its last shot, along angle (degrees): x, y as a share of the sprite
local function recoil(o, angle: number, clock: number, strength: number): (number, number)
	local k = math.clamp(1 - (clock - (o.recoilAt or -1)) / 0.15, 0, 1) * strength
	local a = math.rad(angle)
	return -math.sin(a) * k, math.cos(a) * k
end

local function updateUnits(dt: number)
	local t = now()
	local clock = os.clock()
	local hw, hh = halfView()
	for _, u in units do
		local x, y = Motion.position(u, t)
		local dx, dy = x - u.x, y - u.y
		local moved = math.sqrt(dx * dx + dy * dy)
		u.x, u.y = x, y
		local onScreen = math.abs(x - cam.x) <= hw + 3 and math.abs(y - cam.y) <= hh + 3
		u.frame.Visible = onScreen
		if moved > 3e-4 then
			u.want = math.deg(math.atan2(dx, -dy))
		end
		if not onScreen then
			continue
		end
		u.frame.Position = at(x, y)
		local moving = moved > 1e-4
		local aiming = u.aimUntil ~= nil and u.aimUntil > clock
		-- soldiers turn to shoot; vehicles turn their turret
		local want = u.want or u.heading
		if aiming and not u.gun and not u.air then
			want = u.aim
		end
		local before = u.heading
		u.heading = turn(u.heading, want, (if WALKERS[u.kind] then 720 else 240) * dt)
		local rot, ox, oy, sx, sy = u.heading, 0, 0, 1, 1
		if WALKERS[u.kind] then
			-- steps: a sway from side to side and a little bounce, in time with the distance walked
			u.walk = approach(u.walk or 0, if moving then 1 else 0, dt * 8)
			u.stride = (u.stride or 0) + moved / 0.4 * math.pi
			local swing = math.sin(u.stride) * u.walk
			rot += swing * 9
			local side = math.rad(u.heading)
			ox, oy = math.cos(side) * swing * 0.03, math.sin(side) * swing * 0.03
			sx = 1 + math.abs(swing) * 0.05
			sy = sx
		elseif TRACKED[u.kind] then
			if moving then
				-- the engine shakes the hull a little; tracks and wheels leave prints, and dust on sand
				ox, oy = (math.random() - 0.5) * 0.012, (math.random() - 0.5) * 0.012
				local size = u.def.size or 1.5
				u.printDist = (u.printDist or 0) + moved
				if u.printDist >= size * 0.34 then
					u.printDist = 0
					Effects.tracks(x, y, u.heading, size * 0.95, TRACKED[u.kind])
				end
				u.dustDist = (u.dustDist or 0) + moved
				if u.dustDist >= 0.9 then
					u.dustDist = 0
					local tx, ty = math.floor(x), math.floor(y)
					local ground = if Map.inBounds(tx, ty) then Map.kind(ty * W + tx) else Map.GRASS
					if (ground == Map.SAND or ground == Map.DIRT) and not Effects.busy() then
						local back = math.rad(u.heading)
						Effects.dust(x - math.sin(back) * size * 0.45, y + math.cos(back) * size * 0.45, size * 0.7)
					end
				end
			end
		elseif u.air then
			if u.kind == "gunship" then
				-- hovering: the helicopter breathes up and down
				local bob = 1 + math.sin(clock * 3 + u.id) * 0.03
				sx, sy = bob, bob
			else
				-- jets lean into turns, so they look narrower while turning
				local rate = ((u.heading - before + 180) % 360 - 180) / math.max(dt, 1e-3)
				u.bank = approach(u.bank or 0, math.clamp(math.abs(rate) / 100, 0, 1), dt * 4)
				sx = 1 - 0.3 * u.bank
			end
		end
		if not u.gun then
			local rx, ry = recoil(u, u.heading, clock, 0.04)
			ox += rx
			oy += ry
		end
		pose(u.body, u.bodyTint, rot, ox, oy, sx, sy)
		if u.shadow then
			pose(u.shadow, u.shadowTint, rot, 0.28, 0.5, sx * 0.8, sy * 0.8)
		end
		if u.gun then
			u.gunAngle = turn(u.gunAngle, if aiming then u.aim else u.heading, 300 * dt)
			local rx, ry = recoil(u, u.gunAngle, clock, 0.08)
			pose(u.gun, u.gunTint, u.gunAngle, ox + rx, oy + ry, 1, 1)
		end
		if u.rotor then
			u.rotor.Rotation = (u.rotor.Rotation + dt * 1080) % 360
		end
	end
	for _, b in buildings do
		if b.built < 1 then
			-- everyone sees buildings rise at the building speed; the owner also gets exact progress
			b.built = math.min(0.99, b.built + dt / b.def.time)
			refreshBuilding(b)
		end
		if b.gun or b.spin then
			local want = if b.aimUntil and b.aimUntil > clock then b.aim else b.gunAngle
			b.gunAngle = turn(b.gunAngle, want, 200 * dt)
			local rx, ry = recoil(b, b.gunAngle, clock, 0.05)
			if b.gun then
				pose(b.gun, b.gunTint, b.gunAngle, rx, ry, 0.85, 0.85)
			else
				b.base.Rotation, b.tint.Rotation = b.gunAngle, b.gunAngle
				local pos = UDim2.fromScale(0.5 + rx, 1 + ry)
				b.base.Position, b.tint.Position = pos, pos
			end
		end
	end
end

---------------------------------------------------------------- shots and explosions

-- who fired a shot that started at (x, y): a shooting building there, or the nearest unit in range
local function shooterAt(x: number, y: number, x2: number, y2: number)
	for _, b in buildings do
		if b.def.dps and math.abs(b.cx - x) < 0.3 and math.abs(b.cy - y) < 0.3 then
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
		local kind = if shooter then shooter.kind else "infantry"
		if shooter then
			shooter.aim = math.deg(math.atan2(x2 - x1, -(y2 - y1)))
			shooter.aimUntil = clock + 1.6
		end
		-- the shots of the last moment are spread over it, so they do not all flash at once
		Effects.later(math.random() * Config.NET_RATE, function()
			if shooter then
				shooter.recoilAt = os.clock()
				-- moving shooters have moved on a little: start from where they are drawn now
				if shooter.path and shooter.frame.Parent then
					x1, y1 = shooter.x, shooter.y
				end
			end
			Effects.shot(SHOT_LOOK[kind] or "bullet", x1, y1, x2, y2)
			Sfx.at(SHOT_SOUND[kind] or "rifle", x1, y1)
		end)
	end
end

function MapView.boom(x: number, y: number, big: boolean)
	Effects.boom(x, y, big)
	Sfx.at(if big then "bigboom" else "boom", x, y)
end

-- a ring that shrinks where an order was given
function MapView.marker(x: number, y: number, color: Color3?, size: number?)
	Effects.marker(x, y, color or SELECT, size)
end

-- build mode: the free pools pulse; and buildings going up make work sounds now and then
local hammerAcc = 0
local function updateWork(dt: number)
	local clock = os.clock()
	for _, h in helpers do
		if h.pulse then
			local s = 2.6 + 0.35 * math.sin(clock * 5)
			h.frame.Size = span(s, s)
		end
	end
	hammerAcc -= dt
	if hammerAcc > 0 then
		return
	end
	hammerAcc = 0.35 + math.random() * 0.5
	local hw, hh = halfView()
	local site = nil
	for _, b in buildings do
		if b.built < 1 and math.abs(b.cx - cam.x) <= hw and math.abs(b.cy - cam.y) <= hh and (not site or math.random() < 0.5) then
			site = b
		end
	end
	if site then
		local px = site.cx + (math.random() - 0.5) * site.size * 0.8
		local py = site.cy + (math.random() - 0.5) * site.size * 0.8
		Sfx.at("hammer", px, py)
		Effects.dust(px, py, 0.6)
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

local boxFrame -- the selection box while it is drawn
local gesture = nil -- the finger or button being dragged: { start, last, moved, button, box, touch, pinch }
local focused = true -- edge scrolling only while the game window has focus

local MB1, MB2, MB3 = Enum.UserInputType.MouseButton1, Enum.UserInputType.MouseButton2, Enum.UserInputType.MouseButton3
local TOUCH, MOVE = Enum.UserInputType.Touch, Enum.UserInputType.MouseMovement

local function showBox(a: Vector2, b: Vector2)
	local o = view.AbsolutePosition
	boxFrame.Position = UDim2.fromOffset(math.min(a.X, b.X) - o.X, math.min(a.Y, b.Y) - o.Y)
	boxFrame.Size = UDim2.fromOffset(math.abs(a.X - b.X), math.abs(a.Y - b.Y))
	boxFrame.Visible = true
end

local function finishBox(a: Vector2, b: Vector2)
	boxFrame.Visible = false
	if MapView.onBox then
		local x0, y0 = MapView.screenToWorld(math.min(a.X, b.X), math.min(a.Y, b.Y))
		local x1, y1 = MapView.screenToWorld(math.max(a.X, b.X), math.max(a.Y, b.Y))
		MapView.onBox(x0, y0, x1, y1)
	end
end

local function tapAt(p: Vector2, alt: boolean)
	local x, y = MapView.screenToWorld(p.X, p.Y)
	local tx, ty = math.floor(x), math.floor(y)
	if not Map.inBounds(tx, ty) then
		return
	end
	if alt then
		if MapView.onAltTap then
			MapView.onAltTap(tx, ty, p.X, p.Y)
		end
	elseif MapView.onTap then
		MapView.onTap(tx, ty, p.X, p.Y)
	end
end

-- mouse: left click selects and commands, left drag draws a box, right click commands,
-- right or middle drag and the wheel move the camera. Touch: tap, drag to move the camera
-- (or draw a box when armed), pinch to zoom.
local function setupInput()
	local touches = {}
	local touchCount = 0

	local function point(input: InputObject): Vector2
		return Vector2.new(input.Position.X, input.Position.Y)
	end

	UserInputService.InputBegan:Connect(function(input, processed)
		if processed or mode ~= "play" then
			return
		end
		local t = input.UserInputType
		local isTouch = t == TOUCH
		if not isTouch and t ~= MB1 and t ~= MB2 and t ~= MB3 then
			return
		end
		glide = nil
		local p = point(input)
		if isTouch then
			touches[input] = p
			touchCount += 1
			if touchCount > 1 then
				-- a second finger: pinch, never a tap or a box
				if gesture then
					gesture.moved = true
					gesture.box = false
					gesture.pinch = nil
				end
				boxFrame.Visible = false
				return
			end
		elseif gesture then
			return
		end
		gesture = { start = p, last = p, moved = false, button = t, touch = isTouch, box = t == MB1 or (isTouch and MapView.boxArmed) }
	end)

	UserInputService.InputChanged:Connect(function(input, processed)
		if mode ~= "play" then
			return
		end
		local t = input.UserInputType
		if t == Enum.UserInputType.MouseWheel then
			if not processed then
				zoomAround(input.Position.X, input.Position.Y, if input.Position.Z > 0 then 1.2 else 1 / 1.2)
			end
			return
		end
		if t == MOVE and buildKind and not gesture then
			local x, y = MapView.screenToWorld(input.Position.X, input.Position.Y)
			showGhost(x, y)
		end
		if not gesture then
			return
		end
		if t == TOUCH then
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
		elseif t ~= MOVE or gesture.touch then
			return
		end
		local p = point(input)
		if not gesture.moved and (p - gesture.start).Magnitude > 8 then
			gesture.moved = true
		end
		if gesture.moved then
			if gesture.box then
				showBox(gesture.start, p)
			else
				panBy(p.X - gesture.last.X, p.Y - gesture.last.Y)
			end
		end
		gesture.last = p
	end)

	UserInputService.InputEnded:Connect(function(input)
		local t = input.UserInputType
		if t == TOUCH then
			if not touches[input] then
				return
			end
			touches[input] = nil
			touchCount = math.max(0, touchCount - 1)
			if touchCount > 0 then
				-- back to one finger after a pinch: keep moving the camera with it
				if gesture then
					for _, v in touches do
						gesture.last = v
					end
					gesture.pinch = nil
				end
				return
			end
		elseif not gesture or gesture.touch or t ~= gesture.button then
			return
		end
		local g = gesture
		gesture = nil
		boxFrame.Visible = false
		if not g or mode ~= "play" then
			return
		end
		local p = point(input)
		if g.box and g.moved then
			finishBox(g.start, p)
		elseif not g.moved then
			tapAt(p, g.button == MB2)
		end
	end)

	UserInputService.WindowFocused:Connect(function()
		focused = true
	end)
	UserInputService.WindowFocusReleased:Connect(function()
		focused = false
	end)
end

-- the camera follows the keys (WASD, arrows) and the mouse at the edge of the screen
local function keyPan(dt: number)
	if UserInputService:GetFocusedTextBox() then
		return
	end
	local mx, my = 0, 0
	local function down(a: Enum.KeyCode, b: Enum.KeyCode): boolean
		return UserInputService:IsKeyDown(a) or UserInputService:IsKeyDown(b)
	end
	if down(Enum.KeyCode.A, Enum.KeyCode.Left) then
		mx -= 1
	end
	if down(Enum.KeyCode.D, Enum.KeyCode.Right) then
		mx += 1
	end
	if down(Enum.KeyCode.W, Enum.KeyCode.Up) then
		my -= 1
	end
	if down(Enum.KeyCode.S, Enum.KeyCode.Down) then
		my += 1
	end
	if focused and not gesture and UserInputService.MouseEnabled and UserInputService:GetLastInputType() == MOVE then
		local m = UserInputService:GetMouseLocation()
		local vp = workspace.CurrentCamera.ViewportSize
		local edge = 6
		if m.X <= edge then
			mx -= 1
		elseif m.X >= vp.X - edge then
			mx += 1
		end
		if m.Y <= edge then
			my -= 1
		elseif m.Y >= vp.Y - edge then
			my += 1
		end
	end
	if mx ~= 0 or my ~= 0 then
		glide = nil
		cam.x += mx * 900 * dt / cam.ppt
		cam.y += my * 900 * dt / cam.ppt
	end
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
	Board.frame = board
	groundPictures(board, Z.ground)
	ghost = make("Frame", { BackgroundTransparency = 0.7, Visible = false, ZIndex = Z.top, Parent = board }, {
		make("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 2 }),
	})
	boxFrame = make("Frame", {
		BackgroundColor3 = SELECT,
		BackgroundTransparency = 0.88,
		BorderSizePixel = 0,
		Visible = false,
		ZIndex = 20,
		Parent = view,
	}, { make("UIStroke", { Color = SELECT, Thickness = 1.5 }) })
	gui.Parent = playerGui
	cam.ppt = viewSize().Y / 20
	applyCam()
	view:GetPropertyChangedSignal("AbsoluteSize"):Connect(applyCam)
	Sfx.view = function()
		local hw, hh = halfView()
		return cam.x, cam.y, math.max(hw, hh)
	end
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
	Effects.clear()
	buildings, units, labels = {}, {}, {}
	clearHelpers()
	table.clear(MapView.selected)
	MapView.nations = {}
	MapView.myId = 0
end

-- the whole match state, sent when the player joins or starts playing; it makes no sounds
function MapView.load(s)
	MapView.clear()
	MapView.loading = true
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
	MapView.loading = false
end

function MapView.setPhase(_phase: string) end

-- "menu": the battle drifts slowly behind the menu; "play": the player moves the camera
function MapView.setMode(m: string)
	mode = m
	gesture = nil
	if boxFrame then
		boxFrame.Visible = false
	end
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
		keyPan(dt)
	end
	applyCam()
	updateUnits(dt)
	updateWork(dt)
	Effects.update()
	miniAcc += dt
	if miniAcc >= 0.25 then
		miniAcc = 0
		updateMinimap()
	end
end

return MapView
