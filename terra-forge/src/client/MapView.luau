-- The battlefield seen from above, in 2D: the painted map, buildings and units as sprites with
-- their animations, shots, and what is under a tap. Positions are in tiles; see Board. The
-- camera, minimap, pointer input, build mode and fog of war are in Camera, Minimap, Input,
-- Placement and Fog; shots and explosions are drawn by Effects, and the buildings and units
-- without a painted sprite by Drawn.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Map = require(Shared.Map)
local Motion = require(Shared.Motion)
local Board = require(script.Parent.Board)
local Camera = require(script.Parent.Camera)
local Drawn = require(script.Parent.Drawn)
local Effects = require(script.Parent.Effects)
local Fog = require(script.Parent.Fog)
local Input = require(script.Parent.Input)
local Minimap = require(script.Parent.Minimap)
local Placement = require(script.Parent.Placement)
local Sfx = require(script.Parent.Sfx)
local Sprites = require(script.Parent.Sprites)
local Theme = require(script.Parent.Theme)

local W = Map.W
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
MapView.onSpotted = nil -- an enemy came into sight after a quiet while: (x, y)
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
local WALKERS = { infantry = true, rocket = true, engineer = true }
local TRACKED = { tank = 0.4, artillery = 0.4, scout = 0.28 } -- kind -> how dark the prints are

local gui, view, board
local buildings = {} -- id -> record
local units = {} -- id -> record
local labels = {} -- nation id -> name tag over its command centre
local mode = "menu"

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

MapView.screenToWorld = Camera.screenToWorld
MapView.zoom = Camera.zoom
MapView.focusOn = Camera.focusOn

function MapView.attachMinimap(holder: GuiObject?)
	Minimap.attach(holder)
	if holder then
		Fog.attachMinimap(holder, holder.ZIndex + 1)
	end
end

-- the whole battlefield shows, without fog: after a defeat and when the match is over
function MapView.revealAll()
	Fog.enable(false)
end

-- radars need energy: on = the player's base makes enough
function MapView.setPowered(on: boolean)
	Fog.powered = on
end

---------------------------------------------------------------- sprites

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
				if rec.parts then
					rec.parts.recolor(n.color3)
				end
			end
		end
		for _, u in units do
			if u.owner == n.id then
				if u.recolor then
					u.recolor(n.color3)
				else
					u.bodyTint.ImageColor3 = n.color3
				end
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

-- the same rules as the server: top-left tile for a building tapped at (x, y), or nil and why not
MapView.placeFor = Placement.placeFor

-- kind = building chosen in the build bar, or nil
MapView.setBuild = Placement.set

MapView.ghostAt = Placement.ghostAt

---------------------------------------------------------------- buildings

-- a building under construction rises from the ground: the finished part is shown above a
-- faint plan of the whole, with a bright line where the work is going on
local function refreshBuilding(rec)
	local building = rec.built < 1
	local k = math.clamp(rec.built, 0.02, 1)
	rec.clip.ClipsDescendants = building
	rec.clip.Size = UDim2.fromScale(1, if building then k else 1)
	for _, img in { rec.base, rec.tint, rec.art } do
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
	if not Sprites.has(def.icon) then
		rec.art, rec.parts = Drawn.building(info.kind, rec.clip, color)
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
	rec.frame.Visible = Fog.showsBuilding(rec)
	if rec.built < 1 and not MapView.loading and rec.frame.Visible then
		Sfx.at("build", rec.cx, rec.cy)
		for i = 1, 3 do
			Effects.dust(rec.cx + (math.random() - 0.5) * size, rec.cy + size * 0.4, size * 0.5)
		end
	end
	if Placement.kind then
		Placement.refresh()
	end
end

function MapView.removeBuilding(id: number)
	local rec = buildings[id]
	if rec then
		rec.frame:Destroy()
		buildings[id] = nil
		if Placement.kind then
			Placement.refresh()
		end
	end
end

function MapView.finishBuilding(id: number)
	local rec = buildings[id]
	if rec then
		rec.built = 1
		refreshBuilding(rec)
		if Fog.showsBuilding(rec) then
			Effects.pop(rec.frame, rec.size, rec.size)
			Effects.dust(rec.cx, rec.cy + rec.size * 0.3, rec.size * 0.9)
		end
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
			rec.wait = e.w
			rec.built = math.max(rec.built, e.built)
			rec.queue = e.q
			rec.auto = e.auto
			refreshBuilding(rec)
		end
	end
end

-- something getting its health back (repairs) shows a small green puff now and then
local HEAL = Color3.fromRGB(120, 255, 150)
local function healPuff(rec, x: number, y: number, spread: number)
	local clock = os.clock()
	if clock - (rec.healAt or 0) > 0.6 and Fog.sees(x, y) and not Effects.busy() then
		rec.healAt = clock
		Effects.puff(x + (math.random() - 0.5) * spread, y + (math.random() - 0.5) * spread, 0.8, 0.8, HEAL, Z.smoke, 0.3)
	end
end

-- list = flat: building id, hp, ...
function MapView.setBuildingHp(list)
	for i = 1, #list - 1, 2 do
		local rec = buildings[list[i]]
		if rec then
			if list[i + 1] > rec.hp and rec.built >= 1 then
				healPuff(rec, rec.cx, rec.cy, rec.size * 0.6)
			end
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
	local x, y = Camera.screenToWorld(sx, sy)
	local m = 0.15
	for id, b in buildings do
		if x >= b.x - m and x <= b.x + b.size + m and y >= b.y - m and y <= b.y + b.size + m and Fog.showsBuilding(b) then
			return id
		end
	end
	return nil
end

---------------------------------------------------------------- units

local function refreshUnit(u)
	local sel = MapView.selected[u.id] == true
	if sel and not u.ring then
		u.ring = Board.ring(u.frame, SELECT, 2, 1)
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
	local art, drawnParts = nil, nil
	if not Sprites.has(def.icon) then
		art, drawnParts = Drawn.unit(info.kind, u.frame, color)
	end
	if art then
		u.body, u.bodyTint = art, art
		u.recolor = drawnParts.recolor
	else
		u.body, u.bodyTint = spritePair(u.frame, def.icon, color, 2, 1)
	end
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
			if list[i + 1] > u.hp then
				healPuff(u, u.x, u.y, 0.6)
			end
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
	local ids = {}
	for id, u in units do
		if u.owner == MapView.myId and Camera.onScreen(u.x, u.y, 0) then
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
	local x, y = Camera.screenToWorld(sx, sy)
	local best, bd = nil, math.huge
	for id, u in units do
		if u.owner == MapView.myId then
			local reach = math.max((u.def.size or 1.5) * 0.5, 22 / Camera.ppt)
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
	local x, y = Camera.screenToWorld(sx, sy)
	local best, bd = nil, math.huge
	for id, u in units do
		local reach = math.max((u.def.size or 1.5) * 0.5, 22 / Camera.ppt)
		local d = math.sqrt((u.x - x) ^ 2 + (u.y - y) ^ 2)
		if d <= reach and d < bd and Fog.showsUnit(u) then
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
	local hw, hh = Camera.halfView()
	local camX, camY = Camera.x, Camera.y
	for _, u in units do
		local x, y = Motion.position(u, t)
		local dx, dy = x - u.x, y - u.y
		local moved = math.sqrt(dx * dx + dy * dy)
		u.x, u.y = x, y
		local onScreen = math.abs(x - camX) <= hw + 3 and math.abs(y - camY) <= hh + 3 and Fog.showsUnit(u)
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
		b.frame.Visible = Fog.showsBuilding(b)
		if b.built < 1 then
			-- everyone sees buildings rise at the building speed; the owner also gets exact progress
			b.built = math.min(0.99, b.built + dt / b.def.time)
			refreshBuilding(b)
		end
		local parts = b.parts
		if parts and b.built >= 1 then
			if parts.spin then
				parts.spin.Rotation = (parts.spin.Rotation + dt * 80) % 360
			end
			if parts.pulse then
				-- the bolt and the cross beat gently: the bolt is a third of the pad, the cross fills it
				local s = (if parts.pulse:IsA("TextLabel") then 0.3 else 1) * (1 + 0.08 * math.sin(clock * 4 + b.id))
				parts.pulse.Size = UDim2.fromScale(s, s)
			end
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
		if not Fog.sees(x1, y1) and not Fog.sees(x2, y2) then
			-- a fight in the fog makes no flashes and no sound
			continue
		end
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
	if not Fog.sees(x, y) then
		return
	end
	Effects.boom(x, y, big)
	Sfx.at(if big then "bigboom" else "boom", x, y)
end

-- a ring that shrinks where an order was given
function MapView.marker(x: number, y: number, color: Color3?, size: number?)
	Effects.marker(x, y, color or SELECT, size)
end

-- buildings going up make work sounds now and then
local hammerAcc = 0
local function updateWork(dt: number)
	hammerAcc -= dt
	if hammerAcc > 0 then
		return
	end
	hammerAcc = 0.35 + math.random() * 0.5
	local site = nil
	for _, b in buildings do
		if b.built < 1 and Camera.onScreen(b.cx, b.cy, 0) and Fog.showsBuilding(b) and (not site or math.random() < 0.5) then
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
	Board.ground(board, Z.ground)
	local function mine(): number
		return MapView.myId
	end
	Placement.init(board, buildings, mine)
	Fog.init(board, buildings, units, mine)
	Fog.onSpotted = function(x: number, y: number)
		if MapView.onSpotted then
			MapView.onSpotted(x, y)
		end
	end
	gui.Parent = playerGui
	Camera.init(view, board)
	Sfx.view = function()
		local hw, hh = Camera.halfView()
		return Camera.x, Camera.y, math.max(hw, hh)
	end
	Input.init(view, {
		tap = function(tx: number, ty: number, sx: number, sy: number, alt: boolean)
			local fn = if alt then MapView.onAltTap else MapView.onTap
			if fn then
				fn(tx, ty, sx, sy)
			end
		end,
		box = function(x0: number, y0: number, x1: number, y1: number)
			if MapView.onBox then
				MapView.onBox(x0, y0, x1, y1)
			end
		end,
		hover = function(sx: number, sy: number)
			if Placement.kind then
				local x, y = Camera.screenToWorld(sx, sy)
				Placement.ghostAt(x, y)
			end
		end,
		boxArmed = function(): boolean
			return MapView.boxArmed
		end,
	})
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
	-- cleared in place: Placement keeps a reference to the building records
	table.clear(buildings)
	table.clear(units)
	table.clear(labels)
	Placement.clear()
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
	Fog.reset()
end

function MapView.setPhase(_phase: string) end

-- "menu": the battle drifts slowly behind the menu; "play": the player moves the camera
function MapView.setMode(m: string)
	mode = m
	Input.active = m == "play"
	Input.reset()
	Fog.enable(m == "play" and not MapView.spectator)
	if m == "play" then
		Camera.playZoom()
	else
		table.clear(MapView.selected)
		MapView.setBuild(nil)
	end
	MapView.refreshSelection()
end

local miniAcc = 0
function MapView.update(dt: number)
	Camera.update(dt, mode, Input.edgesOk())
	updateUnits(dt)
	updateWork(dt)
	Placement.update()
	Fog.update(dt)
	Effects.update()
	miniAcc += dt
	if miniAcc >= 0.25 then
		miniAcc = 0
		Minimap.update(buildings, units, teamColor, Fog.showsBuilding, Fog.showsOnMinimap)
		-- the name over an enemy command centre shows once the base has been found
		for id, tag in labels do
			local n = MapView.nations[id]
			tag.Visible = n ~= nil and n.cap ~= nil and (id == MapView.myId or Fog.knows(n.cap.x + 0.5, n.cap.y + 0.5))
		end
	end
end

return MapView
