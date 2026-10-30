-- Short-lived pictures on the battlefield: shots, rockets, explosions, smoke and dust, and marks
-- left on the ground (scorch, track prints). Objects are reused from pools, and the number of
-- running effects is capped so a big battle stays smooth.
local Board = require(script.Parent.Board)
local Sprites = require(script.Parent.Sprites)
local Theme = require(script.Parent.Theme)

local make = Theme.make
local at, span, Z = Board.at, Board.span, Board.Z

local Effects = {}

local MAX_EFFECTS = 220
local MAX_SCORCH = 24
local MAX_TRACKS = 260

local running = {} -- { t0, life, step(k), finish() }
local pending = {} -- { at, fn }: things that happen a moment later
local linePool, imagePool = {}, {}
local scorches = {} -- ground marks that fade after a while: { img, t0, hold, fade, alpha }
local tracks = {}
local rng = Random.new()

local SMOKE = Color3.fromRGB(70, 66, 62)
local DUST = Color3.fromRGB(176, 150, 112)

local function add(life: number, step, finish)
	table.insert(running, { t0 = os.clock(), life = life, step = step, finish = finish })
	step(0)
end

function Effects.busy(): boolean
	return #running >= MAX_EFFECTS
end

-- runs fn after delay seconds (on a frame update)
function Effects.later(delay: number, fn)
	table.insert(pending, { at = os.clock() + delay, fn = fn })
end

local function takeLine(color: Color3, z: number): Frame
	local f = table.remove(linePool)
	if not f then
		f = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), BorderSizePixel = 0, Parent = Board.frame })
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
		img = make("ImageLabel", { AnchorPoint = Vector2.new(0.5, 0.5), BackgroundTransparency = 1, Parent = Board.frame })
	end
	Sprites.set(img, name, "base")
	img.ImageColor3 = Color3.new(1, 1, 1)
	img.ImageTransparency = 0
	img.Rotation = 0
	img.ZIndex = z
	img.Visible = true
	return img
end

local function release(obj: GuiObject, pool)
	obj.Visible = false
	table.insert(pool, obj)
end

---------------------------------------------------------------- smoke, dust, fire

-- a puff that grows, drifts and fades: smoke (dark), dust (brown) or steam
function Effects.puff(x: number, y: number, size: number, life: number, color: Color3, z: number?, drift: number?)
	if #running >= MAX_EFFECTS then
		return
	end
	local img = takeImage("dust", z or Z.smoke)
	img.ImageColor3 = color
	img.Rotation = rng:NextInteger(0, 359)
	local dx, dy = (rng:NextNumber() - 0.5) * 0.4, -(drift or 0.5)
	add(life, function(k)
		local s = size * (0.5 + 0.9 * math.sqrt(k))
		img.Size = span(s, s)
		img.Position = at(x + dx * k, y + dy * k)
		img.ImageTransparency = 0.15 + 0.85 * k
	end, function()
		release(img, imagePool)
	end)
end

function Effects.dust(x: number, y: number, size: number)
	Effects.puff(x, y, size, 0.9, DUST, Z.mark, 0.15)
end

-- a fireball that swells and fades
function Effects.fire(x: number, y: number, size: number, life: number, tint: Color3?)
	if #running >= MAX_EFFECTS then
		return
	end
	local img = takeImage("explosion", Z.boom)
	img.Position = at(x, y)
	img.Rotation = rng:NextInteger(0, 359)
	if tint then
		img.ImageColor3 = tint
	end
	add(life, function(k)
		local s = size * (0.45 + 0.75 * math.sqrt(k))
		img.Size = span(s, s)
		img.ImageTransparency = k * k
	end, function()
		release(img, imagePool)
	end)
end

---------------------------------------------------------------- marks on the ground

local function groundMark(list, max: number, name: string, x: number, y: number, w: number, h: number, rot: number, alpha: number, hold: number, fade: number)
	local rec
	if #list >= max then
		rec = table.remove(list, 1)
	else
		local img = make("ImageLabel", { AnchorPoint = Vector2.new(0.5, 0.5), BackgroundTransparency = 1, ZIndex = Z.mark, Parent = Board.frame })
		Sprites.set(img, name, "base")
		rec = { img = img }
	end
	rec.t0, rec.hold, rec.fade, rec.alpha = os.clock(), hold, fade, alpha
	rec.img.Position = at(x, y)
	rec.img.Size = span(w, h)
	rec.img.Rotation = rot
	rec.img.ImageTransparency = 1 - alpha
	rec.img.Visible = true
	table.insert(list, rec)
end

function Effects.scorch(x: number, y: number, size: number)
	groundMark(scorches, MAX_SCORCH, "scorch", x, y, size, size, rng:NextInteger(0, 359), 0.9, 20, 15)
end

-- track prints of a vehicle as wide as width tiles, heading in degrees (0 = up)
function Effects.tracks(x: number, y: number, heading: number, width: number, alpha: number)
	groundMark(tracks, MAX_TRACKS, "tracks", x, y, width, width, heading, alpha, 5, 3)
end

---------------------------------------------------------------- shots

local function tracer(x1: number, y1: number, x2: number, y2: number, color: Color3, px: number, life: number)
	if #running >= MAX_EFFECTS then
		return
	end
	local f = takeLine(color, Z.shot)
	local dx, dy = x2 - x1, y2 - y1
	f.Position = at((x1 + x2) / 2, (y1 + y2) / 2)
	f.Size = UDim2.new(math.sqrt(dx * dx + dy * dy) / Board.W, 0, 0, px)
	f.Rotation = math.deg(math.atan2(dy, dx))
	add(life, function(k)
		f.BackgroundTransparency = k
	end, function()
		release(f, linePool)
	end)
end

-- a rocket or shell flying from (x1, y1) to (x2, y2), then onHit; rockets leave smoke
local function projectile(x1: number, y1: number, x2: number, y2: number, color: Color3, px: number, len: number, travel: number, trail: boolean, onHit)
	if #running >= MAX_EFFECTS then
		onHit()
		return
	end
	local f = takeLine(color, Z.shot)
	local dx, dy = x2 - x1, y2 - y1
	f.Size = UDim2.new(len / Board.W, 0, 0, px)
	f.Rotation = math.deg(math.atan2(dy, dx))
	local lastPuff = -1
	add(travel, function(k)
		local x, y = x1 + dx * k, y1 + dy * k
		f.Position = at(x, y)
		if trail and k - lastPuff > 0.2 then
			lastPuff = k
			Effects.puff(x, y, 0.5, 0.6, Color3.fromRGB(200, 200, 200), Z.shot, 0.1)
		end
	end, function()
		release(f, linePool)
		onHit()
	end)
end

-- the shot of one shooter: look = bullet, cannon, rocket, shell or flak
function Effects.shot(look: string, x1: number, y1: number, x2: number, y2: number)
	if look == "cannon" then
		Effects.fire(x1, y1, 0.7, 0.12)
		tracer(x1, y1, x2, y2, Color3.fromRGB(255, 205, 100), 3, 0.1)
		Effects.fire(x2, y2, 1, 0.3)
		Effects.puff(x2, y2, 0.8, 0.8, SMOKE, Z.smoke, 0.2)
	elseif look == "rocket" then
		projectile(x1, y1, x2, y2, Color3.fromRGB(255, 160, 60), 3, 0.55, 0.28, true, function()
			Effects.fire(x2, y2, 1.1, 0.35)
			Effects.puff(x2, y2, 0.9, 0.9, SMOKE, Z.smoke, 0.25)
		end)
	elseif look == "shell" then
		Effects.fire(x1, y1, 0.9, 0.15)
		Effects.puff(x1, y1, 0.9, 1, SMOKE, Z.smoke, 0.3)
		projectile(x1, y1, x2, y2, Color3.fromRGB(255, 225, 140), 4, 0.3, 0.55, false, function()
			Effects.fire(x2, y2, 1.7, 0.45)
			Effects.puff(x2, y2, 1.4, 1.2, SMOKE, Z.smoke, 0.35)
			Effects.dust(x2, y2, 1.6)
		end)
	elseif look == "flak" then
		tracer(x1, y1, x2, y2, Color3.fromRGB(220, 232, 255), 2, 0.08)
		Effects.puff(x2, y2, 1, 0.7, Color3.fromRGB(40, 40, 44), Z.smoke, 0.1)
	else
		tracer(x1, y1, x2, y2, Color3.fromRGB(255, 240, 170), 2, 0.07)
	end
end

-- a unit or building blowing up: fire, smoke rising, and a scorch mark
function Effects.boom(x: number, y: number, big: boolean)
	if big then
		Effects.fire(x, y, 3, 0.7)
		Effects.later(0.1, function()
			Effects.fire(x + 0.7, y - 0.4, 1.8, 0.5)
		end)
		Effects.later(0.2, function()
			Effects.fire(x - 0.6, y + 0.5, 1.6, 0.5)
		end)
		for i = 1, 4 do
			Effects.later(0.15 * i, function()
				Effects.puff(x + (rng:NextNumber() - 0.5) * 1.4, y + (rng:NextNumber() - 0.5) * 1.4, 2.2, 2.2, SMOKE, Z.smoke, 1.2)
			end)
		end
		Effects.scorch(x, y, 3.2)
	else
		Effects.fire(x, y, 1.5, 0.45)
		Effects.puff(x, y, 1.2, 1.4, SMOKE, Z.smoke, 0.6)
		Effects.scorch(x, y, 1.3)
	end
end

-- a ring that shrinks where an order was given
function Effects.marker(x: number, y: number, color: Color3, size: number?)
	local f = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = at(x, y), BackgroundTransparency = 1, ZIndex = Z.top, Parent = Board.frame }, {
		Theme.corner(nil, 1),
	})
	local stroke = make("UIStroke", { Color = color, Thickness = 2.5, Parent = f })
	local s0 = size or 1.9
	add(0.55, function(k)
		local s = s0 - (s0 - 0.6) * k
		f.Size = span(s, s)
		stroke.Transparency = k
	end, function()
		f:Destroy()
	end)
end

-- a building that has just been finished swells a little and settles
function Effects.pop(frame: GuiObject, w: number, h: number)
	add(0.3, function(k)
		local s = 1 + 0.12 * math.sin(k * math.pi)
		frame.Size = span(w * s, h * s)
	end, function()
		frame.Size = span(w, h)
	end)
end

---------------------------------------------------------------- per frame

local function fadeMarks(list, clock: number)
	for i = #list, 1, -1 do
		local m = list[i]
		local k = math.clamp((clock - m.t0 - m.hold) / m.fade, 0, 1)
		if k > 0 then
			m.img.ImageTransparency = 1 - m.alpha * (1 - k)
			if k >= 1 then
				m.img:Destroy()
				table.remove(list, i)
			end
		end
	end
end

function Effects.update()
	local clock = os.clock()
	for i = #pending, 1, -1 do
		local p = pending[i]
		if clock >= p.at then
			pending[i] = pending[#pending]
			pending[#pending] = nil
			p.fn()
		end
	end
	for i = #running, 1, -1 do
		local e = running[i]
		local k = (clock - e.t0) / e.life
		if k >= 1 then
			running[i] = running[#running]
			running[#running] = nil
			e.finish()
		else
			e.step(k)
		end
	end
	fadeMarks(scorches, clock)
	fadeMarks(tracks, clock)
end

function Effects.clear()
	-- finishing a rocket starts its explosion, which then goes into the new list and ends by itself
	local old = running
	running = {}
	for _, e in old do
		e.finish()
	end
	for _, list in { scorches, tracks } do
		for _, m in list do
			m.img:Destroy()
		end
		table.clear(list)
	end
	pending = {}
end

return Effects
