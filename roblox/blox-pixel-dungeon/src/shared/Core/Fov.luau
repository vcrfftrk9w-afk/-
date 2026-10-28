-- Поле зрения: рекурсивное теневое литьё по восьми октантам (как ShadowCaster в SPD).
local Fov = {}

local OCTANTS = {
	{ 1, 0, 0, 1 },
	{ 0, 1, 1, 0 },
	{ 0, -1, 1, 0 },
	{ -1, 0, 0, 1 },
	{ -1, 0, 0, -1 },
	{ 0, -1, -1, 0 },
	{ 0, 1, -1, 0 },
	{ 1, 0, 0, -1 },
}

-- blocks(x, y) -> true, если клетка закрывает обзор; mark(x, y) отмечает видимую клетку
function Fov.compute(ox, oy, radius, w, h, blocks, mark)
	mark(ox, oy)
	local r2 = (radius + 0.5) * (radius + 0.5)

	local function cast(row, startSlope, endSlope, xx, xy, yx, yy)
		if startSlope < endSlope then
			return
		end
		local nextStart = startSlope
		for i = row, radius do
			local blocked = false
			local dy = -i
			for dx = -i, 0 do
				local lSlope = (dx - 0.5) / (dy + 0.5)
				local rSlope = (dx + 0.5) / (dy - 0.5)
				if startSlope < rSlope then
					-- ещё не дошли
				elseif endSlope > lSlope then
					break
				else
					local x = ox + dx * xx + dy * xy
					local y = oy + dx * yx + dy * yy
					local inside = x >= 0 and y >= 0 and x < w and y < h
					if inside and dx * dx + dy * dy <= r2 then
						mark(x, y)
					end
					local b = not inside or blocks(x, y)
					if blocked then
						if b then
							nextStart = rSlope
						else
							blocked = false
							startSlope = nextStart
						end
					elseif b and i < radius then
						blocked = true
						cast(i + 1, startSlope, lSlope, xx, xy, yx, yy)
						nextStart = rSlope
					end
				end
			end
			if blocked then
				break
			end
		end
	end

	for _, o in ipairs(OCTANTS) do
		cast(1, 1.0, 0.0, o[1], o[2], o[3], o[4])
	end
end

return Fov
