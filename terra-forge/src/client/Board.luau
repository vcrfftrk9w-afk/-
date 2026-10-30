-- The board: the frame the battlefield is drawn on, and how tile positions map onto it.
-- Everything on the board is placed in board-relative scale, so moving or zooming the camera
-- only changes the board frame itself.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Map = require(ReplicatedStorage:WaitForChild("TerraForge").Map)
local Art = require(script.Parent.Art)
local Theme = require(script.Parent.Theme)

local W, H = Map.W, Map.H
local make = Theme.make

local Board = {}
Board.frame = nil :: Frame?
Board.W, Board.H = W, H

-- drawing order on the board
Board.Z = { ground = 1, mark = 2, building = 3, unit = 4, shot = 5, boom = 6, air = 7, smoke = 8, label = 9, top = 10 }

-- board position of a point, in tiles
function Board.at(x: number, y: number): UDim2
	return UDim2.fromScale(x / W, y / H)
end

-- board size of something w x h tiles big
function Board.span(w: number, h: number): UDim2
	return UDim2.fromScale(w / W, h / H)
end

-- the painted ground, cut into pictures that each cover part of parent (the board or the minimap)
function Board.ground(parent: Instance, z: number)
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

-- a round outline filling parent
function Board.ring(parent: Instance, color: Color3, thickness: number, z: number): Frame
	return make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		ZIndex = z,
		Parent = parent,
	}, { Theme.corner(nil, 1), make("UIStroke", { Color = color, Thickness = thickness }) })
end

return Board
