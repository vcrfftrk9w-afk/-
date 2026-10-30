-- The camera over the board: where it looks (x, y in tiles) and how close (ppt = pixels per
-- tile). It moves by dragging, pinching, the wheel, keys and the screen edges, glides to points,
-- and drifts slowly over the battle behind the menu.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local Map = require(ReplicatedStorage:WaitForChild("TerraForge").Map)

local W, H = Map.W, Map.H

local Camera = {}
Camera.x, Camera.y, Camera.ppt = W / 2, H / 2, 24

local view, board
local glide = nil -- the camera moves smoothly to { x, y }

-- while the player chooses where to land, the map fits between these screen heights (GUI
-- coordinates): the bottom of the title and the top of the commander panel
Camera.area = { top = -math.huge, bottom = math.huge }

function Camera.viewSize(): Vector2
	local s = view.AbsoluteSize
	return Vector2.new(math.max(s.X, 1), math.max(s.Y, 1))
end

local function zoomLimits(): (number, number)
	local vs = Camera.viewSize()
	local fit = math.min(vs.X / (W + 4), vs.Y / (H + 4))
	return math.max(fit, 2), math.max(fit, 46)
end

-- half the width and height of the view, in tiles
function Camera.halfView(): (number, number)
	local vs = Camera.viewSize()
	return vs.X / 2 / Camera.ppt, vs.Y / 2 / Camera.ppt
end

-- true if (x, y) is on screen, give or take margin tiles
function Camera.onScreen(x: number, y: number, margin: number): boolean
	local hw, hh = Camera.halfView()
	return math.abs(x - Camera.x) <= hw + margin and math.abs(y - Camera.y) <= hh + margin
end

-- moves the board under the camera
local function place()
	local vs = Camera.viewSize()
	board.Size = UDim2.fromOffset(W * Camera.ppt, H * Camera.ppt)
	board.Position = UDim2.fromOffset(math.round(vs.X / 2 - Camera.x * Camera.ppt), math.round(vs.Y / 2 - Camera.y * Camera.ppt))
end

-- keeps the camera over the map and moves the board under it
function Camera.apply()
	local lo, hi = zoomLimits()
	Camera.ppt = math.clamp(Camera.ppt, lo, hi)
	local hw, hh = Camera.halfView()
	local m = 3
	Camera.x = if hw * 2 >= W + 2 * m then W / 2 else math.clamp(Camera.x, hw - m, W - hw + m)
	Camera.y = if hh * 2 >= H + 2 * m then H / 2 else math.clamp(Camera.y, hh - m, H - hh + m)
	place()
end

-- tile coordinates under a screen point (GUI coordinates, as in InputObject.Position)
function Camera.screenToWorld(sx: number, sy: number): (number, number)
	local o = view.AbsolutePosition
	local vs = Camera.viewSize()
	return Camera.x + (sx - o.X - vs.X / 2) / Camera.ppt, Camera.y + (sy - o.Y - vs.Y / 2) / Camera.ppt
end

-- zooms by f, keeping the point under (sx, sy) where it is
function Camera.zoomAround(sx: number, sy: number, f: number)
	local wx, wy = Camera.screenToWorld(sx, sy)
	local lo, hi = zoomLimits()
	Camera.ppt = math.clamp(Camera.ppt * f, lo, hi)
	local o = view.AbsolutePosition
	local vs = Camera.viewSize()
	Camera.x = wx - (sx - o.X - vs.X / 2) / Camera.ppt
	Camera.y = wy - (sy - o.Y - vs.Y / 2) / Camera.ppt
	glide = nil
	Camera.apply()
end

-- moves the map by (dx, dy) screen pixels, as when dragged
function Camera.panBy(dx: number, dy: number)
	Camera.x -= dx / Camera.ppt
	Camera.y -= dy / Camera.ppt
	glide = nil
	Camera.apply()
end

function Camera.zoom(f: number)
	local o = view.AbsolutePosition
	local vs = Camera.viewSize()
	Camera.zoomAround(o.X + vs.X / 2, o.Y + vs.Y / 2, f)
end

-- moves the camera to a point, smoothly unless instant
function Camera.focusOn(x: number, y: number, instant: boolean?)
	if instant then
		Camera.x, Camera.y = x, y
		glide = nil
		Camera.apply()
	else
		glide = { x = x, y = y }
	end
end

-- stops a glide, when the player takes over
function Camera.stop()
	glide = nil
end

-- a comfortable zoom for playing on this screen
function Camera.playZoom()
	Camera.ppt = math.clamp(Camera.viewSize().Y / 15, 18, 40)
end

-- the camera follows the keys (WASD, arrows), and the mouse at the edge of the screen when edges
local function keyPan(dt: number, edges: boolean)
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
	if edges and UserInputService.MouseEnabled and UserInputService:GetLastInputType() == Enum.UserInputType.MouseMovement then
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
		Camera.x += mx * 900 * dt / Camera.ppt
		Camera.y += my * 900 * dt / Camera.ppt
	end
end

-- "menu": the camera drifts slowly over the battle; "landing": the whole map, still, while the
-- player chooses a base; "play": glides, keys and screen edges (edges = false while something
-- is dragged or the window is not focused)
function Camera.update(dt: number, mode: string, edges: boolean)
	if mode == "menu" then
		local t = os.clock()
		Camera.ppt = Camera.viewSize().Y / 22
		Camera.x = W / 2 + math.sin(t * 0.045) * W * 0.3
		Camera.y = H / 2 + math.sin(t * 0.031 + 1) * H * 0.25
	elseif mode == "landing" then
		-- the whole map, smaller than the usual limits allow so that the panels do not cover it
		local vs = Camera.viewSize()
		local o = view.AbsolutePosition
		local top = math.clamp(Camera.area.top - o.Y, 0, vs.Y * 0.4)
		local bottom = math.clamp(o.Y + vs.Y - Camera.area.bottom, 0, vs.Y * 0.4)
		Camera.ppt = math.max(math.min(vs.X / (W + 4), (vs.Y - top - bottom) / (H + 2)), 1)
		Camera.x, Camera.y = W / 2, H / 2 - (top - bottom) / 2 / Camera.ppt
		glide = nil
		place()
		return
	else
		if glide then
			local k = math.min(1, dt * 6)
			Camera.x += (glide.x - Camera.x) * k
			Camera.y += (glide.y - Camera.y) * k
			if math.abs(glide.x - Camera.x) + math.abs(glide.y - Camera.y) < 0.05 then
				glide = nil
			end
		end
		keyPan(dt, edges)
	end
	Camera.apply()
end

function Camera.init(viewFrame: Frame, boardFrame: Frame)
	view, board = viewFrame, boardFrame
	Camera.ppt = Camera.viewSize().Y / 20
	Camera.apply()
	view:GetPropertyChangedSignal("AbsoluteSize"):Connect(Camera.apply)
end

return Camera
