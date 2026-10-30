-- The board: the frame the battlefield is drawn on, and how tile positions map onto it.
-- Everything on the board is placed in board-relative scale, so moving or zooming the camera
-- only changes the board frame itself.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Map = require(ReplicatedStorage:WaitForChild("TerraForge").Map)

local W, H = Map.W, Map.H

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

return Board
