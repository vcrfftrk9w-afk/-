-- Играет матч ядром режима и печатает его состояние в JSON (для картинки-превью).
-- luau tools/match_state.luau > state.json
local Config = require("../src/shared/Config")
local Core = require("../src/shared/Core")

local SEED, SECONDS = 4242, 250
local core = Core.new(Config, SEED)
for _ = 1, Config.NATIONS do
	core:addNation(nil, true)
end
local t = 0
while t < SECONDS do
	core:step(0.1)
	t += 0.1
	core:takeEvents()
	core:takeDirty()
end

local function enc(v)
	local tv = type(v)
	if tv == "number" then
		return v == math.floor(v) and string.format("%d", v) or string.format("%.3f", v)
	elseif tv == "string" then
		return '"' .. v:gsub('"', '\\"') .. '"'
	elseif tv == "boolean" then
		return tostring(v)
	elseif tv == "table" then
		if #v > 0 or next(v) == nil then
			local parts = {}
			for _, x in ipairs(v) do table.insert(parts, enc(x)) end
			return "[" .. table.concat(parts, ",") .. "]"
		end
		local parts = {}
		for k, x in pairs(v) do table.insert(parts, enc(tostring(k)) .. ":" .. enc(x)) end
		return "{" .. table.concat(parts, ",") .. "}"
	end
	return "null"
end

local border = {}
for i = 1, Config.MAP_W * Config.MAP_H do border[i] = core.border[i] and 1 or 0 end
local buildings = {}
for i, b in pairs(core.buildings) do
	table.insert(buildings, { tile = i, kind = b.kind, level = b.level, owner = core.owner[i] })
end
local ships = {}
for _, s in ipairs(core.ships) do
	local n = #s.path
	local f = math.clamp(s.t / s.duration, 0, 1) * (n - 1)
	local k = math.clamp(math.floor(f) + 1, 1, math.max(1, n - 1))
	table.insert(ships, { kind = s.kind, owner = s.owner, a = s.path[k], b = s.path[math.min(n, k + 1)], u = f - (k - 1) })
end
local tanks = {}
for _, at in ipairs(core.attacks) do
	if at.last then
		for _, nb in ipairs(core.nb[at.last]) do
			if core.owner[nb] == at.attacker then
				table.insert(tanks, { owner = at.attacker, from = nb, to = at.last })
				break
			end
		end
	end
end
-- «ты» — страна на третьем месте, чтобы на картинке был крепкий середняк
local ranked = {}
for _, n in ipairs(core.nations) do
	if n.alive then table.insert(ranked, n) end
end
table.sort(ranked, function(a, b) return a.tiles > b.tiles end)
local mine = ranked[math.min(3, #ranked)]
mine.name = "Ты"
local snap = core:snapshot()
local me = core:personal(mine.id)
print(enc({
	W = Config.MAP_W, H = Config.MAP_H, terrain = core.terrain, owner = core.owner, border = border,
	buildings = buildings, ships = ships, tanks = tanks, snap = snap, me = me, time = core.time,
}))
