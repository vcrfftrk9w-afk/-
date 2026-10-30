-- The camera over the 3D map. Drag to move, pinch or mouse wheel to zoom, WASD or arrows on
-- a keyboard; a short tap is passed on as a map action. The camera looks north from the
-- south and tilts down further the higher it is. Rig.switchTo flies to another place the way
-- GTA switches characters: up into the sky in jumps, across, and down in jumps.
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Map = require(Shared.Map)
local Ground = require(script.Parent.Ground)

local W, H = Map.W, Map.H

local Rig = {}
Rig.onTap = nil :: ((number, number, number, number) -> ())?
Rig.active = false -- map controls work only during a match
Rig.menu = false -- slow flight over the world behind the menu
Rig.fx, Rig.fz = W / 2, H / 2 -- the point the camera looks at, in tiles
Rig.dist = 300 -- distance from that point, in studs

Rig.FOV = 50
Rig.MIN_D = 12
local maxD = 420
local PLANE_Y = 0.3
local anim = nil
local switch = nil
local switchFx = 0 -- 0..1, how strongly the switch blur and grey are shown
local blur, grey = nil, nil

local function camera(): Camera
	return workspace.CurrentCamera
end

local function tilt(d: number): number
	local k = math.clamp((math.log(d) - math.log(Rig.MIN_D)) / (math.log(maxD) - math.log(Rig.MIN_D)), 0, 1)
	return math.rad(50 + 32 * k)
end

function Rig.maxDist(): number
	return maxD
end

function Rig.cframe(): CFrame
	local p = tilt(Rig.dist)
	local target = Vector3.new(Rig.fx, PLANE_Y, Rig.fz)
	return CFrame.lookAt(target + Vector3.new(0, math.sin(p), math.cos(p)) * Rig.dist, target)
end

local function updateLimits()
	local vp = camera().ViewportSize
	local aspect = math.max(vp.X, 1) / math.max(vp.Y, 1)
	local tanHalf = math.tan(math.rad(Rig.FOV / 2))
	maxD = math.clamp(math.max(H * 0.56 / tanHalf, W * 0.56 / (tanHalf * aspect)), 150, 900)
end

local function clampView()
	Rig.dist = math.clamp(Rig.dist, Rig.MIN_D, maxD)
	Rig.fx = math.clamp(Rig.fx, 0, W)
	Rig.fz = math.clamp(Rig.fz, 0, H)
end

function Rig.apply()
	local cam = camera()
	if not cam then
		return
	end
	cam.CameraType = Enum.CameraType.Scriptable
	cam.FieldOfView = Rig.FOV
	cam.CFrame = Rig.cframe()
	cam.Focus = CFrame.new(Rig.fx, PLANE_Y, Rig.fz)
end

-- where a ray from the camera meets the ground; refine follows hills and mountains
local function hit(ray: Ray, refine: boolean): Vector2?
	local d = ray.Direction
	if d.Y > -1e-3 then
		return nil
	end
	local y = PLANE_Y
	local p = ray.Origin
	for _ = 1, if refine then 4 else 1 do
		p = ray.Origin + d * ((y - ray.Origin.Y) / d.Y)
		y = Ground.surface(p.X, p.Z)
	end
	return Vector2.new(p.X, p.Z)
end

-- screen points as in InputObject.Position (below the top bar)
function Rig.groundAtScreen(x: number, y: number, refine: boolean?): Vector2?
	return hit(camera():ScreenPointToRay(x, y), refine == true)
end

-- viewport points as from UserInputService:GetMouseLocation()
function Rig.groundAtViewport(x: number, y: number, refine: boolean?): Vector2?
	return hit(camera():ViewportPointToRay(x, y), refine == true)
end

-- screen pixels per stud at a given distance from the camera
function Rig.pxPerStud(depth: number): number
	return camera().ViewportSize.Y / (2 * math.max(depth, 0.1) * math.tan(math.rad(Rig.FOV / 2)))
end

function Rig.flyTo(x: number, z: number, d: number, seconds: number)
	switch = nil
	anim = {
		from = { Rig.fx, Rig.fz, Rig.dist },
		to = { math.clamp(x, 0, W), math.clamp(z, 0, H), math.clamp(d, Rig.MIN_D, maxD) },
		t0 = os.clock(),
		d = math.max(seconds, 0.01),
	}
end

function Rig.overview(seconds: number)
	updateLimits()
	Rig.flyTo(W / 2, H / 2 + 6, maxD, seconds)
end

---------------------------------------------------------------- switch flight

local function ease(k: number): number
	return if k < 0.5 then 2 * k * k else 1 - (-2 * k + 2) ^ 2 / 2
end

-- flies to (x, z) and ends at distance d; onDone runs on arrival
function Rig.switchTo(x: number, z: number, d: number, onDone: (() -> ())?)
	updateLimits()
	anim = nil
	x, z = math.clamp(x, 0, W), math.clamp(z, 0, H)
	local top = maxD * 0.9
	local steps = {}
	local cur = { Rig.fx, Rig.fz, Rig.dist }
	local function hop(to, seconds: number, hold: number)
		table.insert(steps, { from = cur, to = to, d = seconds, hold = hold })
		cur = to
	end
	-- up in three jumps, unless the camera is high already
	if cur[3] < top * 0.75 then
		local d0 = cur[3]
		for k = 1, 3 do
			hop({ cur[1], cur[2], d0 * (top / d0) ^ (k / 3) }, 0.24, 0.1)
		end
	end
	local far = math.sqrt((x - cur[1]) ^ 2 + (z - cur[2]) ^ 2)
	hop({ x, z, math.max(cur[3], top) }, math.clamp(far / 450, 0.3, 0.9), 0.08)
	-- and down in three jumps
	local d1 = cur[3]
	local target = math.clamp(d, Rig.MIN_D, maxD)
	for k = 1, 3 do
		hop({ x, z, d1 * (target / d1) ^ (k / 3) }, 0.24, if k < 3 then 0.1 else 0)
	end
	switch = { steps = steps, i = 1, t0 = os.clock(), onDone = onDone }
end

function Rig.switching(): boolean
	return switch ~= nil
end

-- moves the camera along the switch; returns the blur strength for this moment (0..1)
local function stepSwitch(): number
	local s = switch
	local st = s.steps[s.i]
	local e = os.clock() - s.t0
	if e < st.d then
		local k = e / st.d
		local q = ease(k)
		Rig.fx = st.from[1] + (st.to[1] - st.from[1]) * q
		Rig.fz = st.from[2] + (st.to[2] - st.from[2]) * q
		Rig.dist = st.from[3] * (st.to[3] / st.from[3]) ^ q
		return math.sin(math.pi * k)
	end
	Rig.fx, Rig.fz, Rig.dist = st.to[1], st.to[2], st.to[3]
	if e >= st.d + st.hold then
		s.i += 1
		s.t0 = os.clock()
		if s.i > #s.steps then
			switch = nil
			if s.onDone then
				task.spawn(s.onDone)
			end
		end
	end
	return 0
end

local function showSwitchFx(dt: number, motion: number)
	switchFx += ((if switch then 1 else 0) - switchFx) * math.min(1, dt * 10)
	if switchFx < 0.01 and not blur then
		return
	end
	if not blur then
		blur = Instance.new("BlurEffect")
		blur.Name = "TerraForgeSwitchBlur"
		blur.Size = 0
		blur.Parent = Lighting
		grey = Instance.new("ColorCorrectionEffect")
		grey.Name = "TerraForgeSwitchGrey"
		grey.Parent = Lighting
	end
	blur.Size = switchFx * (3 + 17 * motion)
	grey.Saturation = -0.7 * switchFx
	grey.Contrast = 0.12 * switchFx
	grey.Brightness = 0.05 * switchFx
	grey.TintColor = Color3.new(1, 1, 1):Lerp(Color3.fromRGB(214, 228, 255), switchFx)
end

function Rig.zoom(f: number)
	if switch then
		return
	end
	anim = nil
	Rig.dist /= f
	clampView()
	Rig.apply()
end

local function zoomAround(sp: Vector2, f: number, viewport: boolean)
	local function ground()
		return if viewport then Rig.groundAtViewport(sp.X, sp.Y) else Rig.groundAtScreen(sp.X, sp.Y)
	end
	local before = ground()
	Rig.dist /= f
	clampView()
	Rig.apply()
	local after = ground()
	if before and after then
		Rig.fx += before.X - after.X
		Rig.fz += before.Y - after.Y
		clampView()
		Rig.apply()
	end
end

-- keeps the ground point under the finger under the finger
local function panBetween(a: Vector2, b: Vector2)
	local ga, gb = Rig.groundAtScreen(a.X, a.Y), Rig.groundAtScreen(b.X, b.Y)
	if ga and gb then
		Rig.fx += ga.X - gb.X
		Rig.fz += ga.Y - gb.Y
		clampView()
		Rig.apply()
	end
end

function Rig.setupInput()
	local touches = {}
	local touchCount = 0
	local gesture = nil

	local function point(input: InputObject): Vector2
		return Vector2.new(input.Position.X, input.Position.Y)
	end

	UserInputService.InputBegan:Connect(function(input, processed)
		if processed or not Rig.active or switch then
			return
		end
		local isTouch = input.UserInputType == Enum.UserInputType.Touch
		if not isTouch and input.UserInputType ~= Enum.UserInputType.MouseButton1 then
			return
		end
		anim = nil
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
		if not Rig.active then
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseWheel then
			if not processed and not switch then
				anim = nil
				zoomAround(UserInputService:GetMouseLocation(), if input.Position.Z > 0 then 1.2 else 1 / 1.2, true)
			end
			return
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
					zoomAround(mid, dist / math.max(gesture.pinch.dist, 1), false)
					panBetween(gesture.pinch.mid, mid)
				end
				gesture.pinch = { dist = dist, mid = mid }
				return
			end
		elseif input.UserInputType ~= Enum.UserInputType.MouseMovement then
			return
		end
		local p = point(input)
		if not gesture.moved and (p - gesture.start).Magnitude > 8 then
			gesture.moved = true
		end
		if gesture.moved then
			panBetween(gesture.last, p)
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
			if not gesture.moved and Rig.active and Rig.onTap then
				local p = point(input)
				local g = Rig.groundAtScreen(p.X, p.Y, true)
				if g then
					local x, y = math.floor(g.X), math.floor(g.Y)
					if Map.inBounds(x, y) then
						Rig.onTap(x, y, p.X, p.Y)
					end
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

local KEYS = {
	[Enum.KeyCode.W] = Vector2.new(0, -1),
	[Enum.KeyCode.Up] = Vector2.new(0, -1),
	[Enum.KeyCode.S] = Vector2.new(0, 1),
	[Enum.KeyCode.Down] = Vector2.new(0, 1),
	[Enum.KeyCode.A] = Vector2.new(-1, 0),
	[Enum.KeyCode.Left] = Vector2.new(-1, 0),
	[Enum.KeyCode.D] = Vector2.new(1, 0),
	[Enum.KeyCode.Right] = Vector2.new(1, 0),
}

function Rig.update(dt: number)
	updateLimits()
	local motion = 0
	if Rig.menu then
		switch = nil
		local t = os.clock()
		Rig.fx = W * 0.5 + math.sin(t / 47) * W * 0.3
		Rig.fz = H * 0.36 + math.sin(t / 29) * H * 0.08
		Rig.dist = 120 + math.sin(t / 31) * 25
	elseif switch then
		motion = stepSwitch()
	elseif anim then
		local k = math.clamp((os.clock() - anim.t0) / anim.d, 0, 1)
		local e = ease(k)
		Rig.fx = anim.from[1] + (anim.to[1] - anim.from[1]) * e
		Rig.fz = anim.from[2] + (anim.to[2] - anim.from[2]) * e
		Rig.dist = anim.from[3] * (anim.to[3] / anim.from[3]) ^ e
		if k >= 1 then
			anim = nil
		end
	elseif Rig.active and not UserInputService:GetFocusedTextBox() then
		local move = Vector2.zero
		for key, dir in KEYS do
			if UserInputService:IsKeyDown(key) then
				move += dir
			end
		end
		if move.Magnitude > 0 then
			move = move.Unit * Rig.dist * 0.9 * dt
			Rig.fx += move.X
			Rig.fz += move.Y
		end
	end
	clampView()
	Rig.apply()
	showSwitchFx(dt, motion)
end

return Rig
