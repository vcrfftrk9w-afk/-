-- Несколько матчей ботов на разных картах: luau tests/balance.luau
local Config = require("../src/shared/Config")
local Core = require("../src/shared/Core")
for seed = 1, 6 do
	local core = Core.new(Config, seed * 7919)
	for _ = 1, Config.NATIONS do core:addNation(nil, true) end
	local firstKill
	while core.phase ~= "over" do
		core:step(0.1)
		for _, e in ipairs(core:takeEvents()) do
			if e.type == "eliminated" and not firstKill then firstKill = core.time end
		end
		core:takeDirty()
	end
	local w = core.nations[core.winner]
	local alive = 0
	for _, n in ipairs(core.nations) do if n.alive then alive += 1 end end
	print(string.format("seed %d: победа на %d с (%s, %.0f%% суши), первое уничтожение %.0f с, живых %d",
		seed, core.time, w.name, w.tiles / core.landCount * 100, firstKill or -1, alive))
end
