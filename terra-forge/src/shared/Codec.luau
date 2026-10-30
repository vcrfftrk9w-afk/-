-- Compact network formats for territory data.
-- Snapshot: u32 run count, then runs of (u16 owner, u16 length) over all tiles.
-- Delta: one u32 per change = tile + owner * 2^18 (tiles fit in 18 bits).
local Codec = {}

local TILE_BITS = 262144

function Codec.encodeOwners(owner: buffer, n: number): buffer
	local runs = {}
	local cur = buffer.readu16(owner, 0)
	local len = 0
	for t = 0, n - 1 do
		local o = buffer.readu16(owner, t * 2)
		if o == cur and len < 65535 then
			len += 1
		else
			table.insert(runs, cur)
			table.insert(runs, len)
			cur = o
			len = 1
		end
	end
	table.insert(runs, cur)
	table.insert(runs, len)
	local count = #runs // 2
	local out = buffer.create(4 + count * 4)
	buffer.writeu32(out, 0, count)
	for i = 1, count do
		local at = 4 + (i - 1) * 4
		buffer.writeu16(out, at, runs[2 * i - 1])
		buffer.writeu16(out, at + 2, runs[2 * i])
	end
	return out
end

-- calls visit(tile, owner) for every tile that has an owner
function Codec.decodeOwners(data: buffer, visit: (number, number) -> ())
	local count = buffer.readu32(data, 0)
	local t = 0
	for i = 0, count - 1 do
		local o = buffer.readu16(data, 4 + i * 4)
		local len = buffer.readu16(data, 6 + i * 4)
		if o ~= 0 then
			for k = 0, len - 1 do
				visit(t + k, o)
			end
		end
		t += len
	end
end

function Codec.packChanges(changes: { number }): buffer
	local out = buffer.create(#changes * 4)
	for i, v in changes do
		buffer.writeu32(out, (i - 1) * 4, v)
	end
	return out
end

function Codec.change(tile: number, owner: number): number
	return owner * TILE_BITS + tile
end

-- calls visit(tile, owner) for every change in order
function Codec.readChanges(data: buffer, visit: (number, number) -> ())
	for i = 0, buffer.len(data) // 4 - 1 do
		local v = buffer.readu32(data, i * 4)
		visit(v % TILE_BITS, v // TILE_BITS)
	end
end

return Codec
