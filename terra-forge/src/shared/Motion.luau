-- Where a unit is at a given time. Units move along a path (flat list x1, y1, x2, y2, ...)
-- at a fixed speed from time t0; planes then circle around the end point.
-- The server and clients use the same function, so only orders need to be sent.
local Motion = {}

function Motion.length(path: { number }): number
	local total = 0
	for i = 1, #path // 2 - 1 do
		local dx, dy = path[2 * i + 1] - path[2 * i - 1], path[2 * i + 2] - path[2 * i]
		total += math.sqrt(dx * dx + dy * dy)
	end
	return total
end

-- returns x, y, arrived, horizontal direction of travel (negative = moving left)
function Motion.position(u, t: number): (number, number, boolean, number)
	local path = u.path
	local count = #path // 2
	local dist = math.max(0, (t - u.t0) * u.speed)
	local travelled = 0
	for i = 1, count - 1 do
		local x1, y1, x2, y2 = path[2 * i - 1], path[2 * i], path[2 * i + 1], path[2 * i + 2]
		local dx, dy = x2 - x1, y2 - y1
		local seg = math.sqrt(dx * dx + dy * dy)
		if dist - travelled <= seg then
			local k = if seg > 0 then (dist - travelled) / seg else 1
			return x1 + dx * k, y1 + dy * k, false, dx
		end
		travelled += seg
	end
	local ex, ey = path[2 * count - 1], path[2 * count]
	local o = u.orbit
	if o then
		local tEnd = u.t0 + travelled / math.max(u.speed, 0.001)
		local a = o.a0 + o.w * (t - tEnd)
		local cx = ex - math.cos(o.a0) * o.r
		local cy = ey - math.sin(o.a0) * o.r * 0.82
		return cx + math.cos(a) * o.r, cy + math.sin(a) * o.r * 0.82, true, -math.sin(a) * o.w
	end
	return ex, ey, true, 0
end

return Motion
