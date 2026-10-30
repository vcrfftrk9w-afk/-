-- The minimap: the whole battlefield in a corner, with a dot for every building, unit and
-- strategic point and a frame for what the camera sees. Tap or drag on it to move the camera
-- there.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local Map = require(ReplicatedStorage:WaitForChild("TerraForge").Map)
local Board = require(script.Parent.Board)
local Camera = require(script.Parent.Camera)
local Theme = require(script.Parent.Theme)

local W, H = Map.W, Map.H
local make = Theme.make
local at, span = Board.at, Board.span

local Minimap = {}

local mini = nil

function Minimap.attach(holder: GuiObject?)
	if not holder then
		return
	end
	mini = { holder = holder, dots = {}, used = 0 }
	Board.ground(holder, holder.ZIndex)
	-- holder.ZIndex + 1 is left for the fog of war, between the ground and the dots
	mini.camRect = make("Frame", { BackgroundTransparency = 1, ZIndex = holder.ZIndex + 3, Parent = holder }, {
		make("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 1.5 }),
	})
	local dragging = nil
	local function jump(p: Vector3)
		local o, s = holder.AbsolutePosition, holder.AbsoluteSize
		local x = math.clamp((p.X - o.X) / math.max(s.X, 1), 0, 1) * W
		local y = math.clamp((p.Y - o.Y) / math.max(s.Y, 1), 0, 1) * H
		Camera.focusOn(x, y, true)
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

local function dot(x: number, y: number, s: number, color: Color3)
	mini.used += 1
	local d = mini.dots[mini.used]
	if not d then
		d = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), BorderSizePixel = 0, ZIndex = mini.holder.ZIndex + 2, Parent = mini.holder })
		mini.dots[mini.used] = d
	end
	d.Position = at(x, y)
	d.Size = UDim2.fromOffset(s, s)
	d.BackgroundColor3 = color
	d.Visible = true
end

-- buildings, units and strategic points: the map's records; colorOf(owner) gives a team's
-- colour; buildingShows / unitShows tell which ones the player may see
function Minimap.update(buildings, units, points, colorOf: (number) -> Color3, buildingShows: (any) -> boolean, unitShows: (any) -> boolean)
	if not mini or not mini.holder.Visible then
		return
	end
	mini.used = 0
	local px = mini.holder.AbsoluteSize.X / W
	-- points: bigger squares, light grey while nobody holds them
	for _, p in points do
		dot(p.x, p.y, 6, if p.owner ~= 0 then colorOf(p.owner) else Color3.fromRGB(214, 220, 228))
	end
	for _, b in buildings do
		if buildingShows(b) then
			dot(b.cx, b.cy, math.max(3, b.size * px), colorOf(b.owner))
		end
	end
	for _, u in units do
		if unitShows(u) then
			dot(u.x, u.y, 2, colorOf(u.owner))
		end
	end
	for i = mini.used + 1, #mini.dots do
		mini.dots[i].Visible = false
	end
	local hw, hh = Camera.halfView()
	mini.camRect.Position = at(Camera.x - hw, Camera.y - hh)
	mini.camRect.Size = span(2 * hw, 2 * hh)
end

return Minimap
