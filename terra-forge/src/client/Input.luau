-- Pointer input on the battlefield. Mouse: left click selects and commands, left drag draws a
-- selection box, right click commands, right or middle drag and the wheel move the camera.
-- Touch: tap, drag to move the camera (or draw a box when armed), pinch to zoom.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local Map = require(ReplicatedStorage:WaitForChild("TerraForge").Map)
local Camera = require(script.Parent.Camera)
local Theme = require(script.Parent.Theme)

local make = Theme.make

local Input = {}
Input.active = false -- taps and drags count only while a match is shown

-- what the map does with input: tap(tileX, tileY, screenX, screenY, alt), box(x0, y0, x1, y1)
-- in tiles, hover(screenX, screenY) as the mouse moves, boxArmed() for touch screens
local hooks

local SELECT = Color3.fromRGB(120, 255, 150)
local MB1, MB2, MB3 = Enum.UserInputType.MouseButton1, Enum.UserInputType.MouseButton2, Enum.UserInputType.MouseButton3
local TOUCH, MOVE = Enum.UserInputType.Touch, Enum.UserInputType.MouseMovement

local view
local boxFrame -- the selection box while it is drawn
local gesture = nil -- the finger or button being dragged: { start, last, moved, button, box, touch, pinch }
local focused = true -- edge scrolling only while the game window has focus

local function showBox(a: Vector2, b: Vector2)
	local o = view.AbsolutePosition
	boxFrame.Position = UDim2.fromOffset(math.min(a.X, b.X) - o.X, math.min(a.Y, b.Y) - o.Y)
	boxFrame.Size = UDim2.fromOffset(math.abs(a.X - b.X), math.abs(a.Y - b.Y))
	boxFrame.Visible = true
end

local function finishBox(a: Vector2, b: Vector2)
	boxFrame.Visible = false
	local x0, y0 = Camera.screenToWorld(math.min(a.X, b.X), math.min(a.Y, b.Y))
	local x1, y1 = Camera.screenToWorld(math.max(a.X, b.X), math.max(a.Y, b.Y))
	hooks.box(x0, y0, x1, y1)
end

local function tapAt(p: Vector2, alt: boolean)
	local x, y = Camera.screenToWorld(p.X, p.Y)
	local tx, ty = math.floor(x), math.floor(y)
	if Map.inBounds(tx, ty) then
		hooks.tap(tx, ty, p.X, p.Y, alt)
	end
end

-- the camera may follow the mouse to the screen edges: the window has focus and nothing is dragged
function Input.edgesOk(): boolean
	return focused and not gesture
end

-- forgets a drag in progress, when the screen changes
function Input.reset()
	gesture = nil
	if boxFrame then
		boxFrame.Visible = false
	end
end

function Input.init(viewFrame: Frame, handlers)
	view = viewFrame
	hooks = handlers
	boxFrame = make("Frame", {
		BackgroundColor3 = SELECT,
		BackgroundTransparency = 0.88,
		BorderSizePixel = 0,
		Visible = false,
		ZIndex = 20,
		Parent = view,
	}, { make("UIStroke", { Color = SELECT, Thickness = 1.5 }) })

	local touches = {}
	local touchCount = 0

	local function point(input: InputObject): Vector2
		return Vector2.new(input.Position.X, input.Position.Y)
	end

	UserInputService.InputBegan:Connect(function(input, processed)
		if processed or not Input.active then
			return
		end
		local t = input.UserInputType
		local isTouch = t == TOUCH
		if not isTouch and t ~= MB1 and t ~= MB2 and t ~= MB3 then
			return
		end
		Camera.stop()
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
		gesture = { start = p, last = p, moved = false, button = t, touch = isTouch, box = t == MB1 or (isTouch and hooks.boxArmed()) }
	end)

	UserInputService.InputChanged:Connect(function(input, processed)
		if not Input.active then
			return
		end
		local t = input.UserInputType
		if t == Enum.UserInputType.MouseWheel then
			if not processed then
				Camera.zoomAround(input.Position.X, input.Position.Y, if input.Position.Z > 0 then 1.2 else 1 / 1.2)
			end
			return
		end
		if t == MOVE and not gesture then
			hooks.hover(input.Position.X, input.Position.Y)
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
					Camera.zoomAround(mid.X, mid.Y, dist / math.max(gesture.pinch.dist, 1))
					Camera.panBy(mid.X - gesture.pinch.mid.X, mid.Y - gesture.pinch.mid.Y)
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
				Camera.panBy(p.X - gesture.last.X, p.Y - gesture.last.Y)
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
		if not g or not Input.active then
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

return Input
