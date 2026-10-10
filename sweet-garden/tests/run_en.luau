-- Smoke test for an English-speaking player on a phone in portrait mode.

local Runtime = require("./mock/runtime")
local Sched = Runtime.Sched
local Inst = Runtime.Inst
local Types = Runtime.Types

local failures = 0
local function check(condition: any, message: string)
	if not condition then
		failures += 1
		print("FAIL: " .. message)
	end
end

Inst.screenSize = Types.Vector2.new(390, 844)
Runtime.loadProject(require("./build/sources"))
Runtime.runScript("ServerScriptService/Server/Main")
Runtime.advance(1)
local player = Runtime.addPlayer("Alex", 555, "en-us")
Runtime.advance(2)
Runtime.runScript("StarterPlayer/StarterPlayerScripts/Client/Main")
Runtime.advance(6)

local Ctx = Runtime.require(Runtime.find("StarterPlayer/StarterPlayerScripts/Client/Context"))
local gui = player.PlayerGui.SweetGardenUI
check(Ctx.lang == "en", "english language selected")
check(Ctx.portrait, "portrait layout")
check(Runtime.findText(gui, "Garden") ~= nil, "english buttons")
local map = Runtime.workspace.SweetGarden
check(map.Plot1.GateBeam.Sign.Text.Text == "🏡 Alex's garden", "english plot sign: " .. map.Plot1.GateBeam.Sign.Text.Text)
check(map.Stand_seeds.SignAnchor.Sign.Text.Text == "🌱 SEEDS", "english shop sign")

local tile = map.Plot1.Tiles.Tile1
Runtime.triggerPrompt(tile.PromptPoint.Prompt, player)
Runtime.advance(25)
Runtime.triggerPrompt(tile.PromptPoint.Prompt, player)
Runtime.advance(1)
check(Ctx.state.basket == 1, "harvested a carrot")
Ctx.sellAll()
Runtime.advance(2)
check(Ctx.state.basket == 0, "sold")

for _, name in ipairs({ "seeds", "gear", "eggs", "pets", "shop", "codes", "pick", "basket" }) do
	Ctx.openPanel(name)
	Runtime.advance(1)
	Ctx.closePanel()
end
local Weather = Runtime.require(Runtime.find("ServerScriptService/Server/Weather"))
for _, id in ipairs({ "rain", "snow", "thunder", "candy", "rainbow" }) do
	Weather.start(id, 5)
	Runtime.advance(6)
end

print(("english smoke test: failed %d, runtime errors %d"):format(failures, #Sched.errors))
if failures > 0 or #Sched.errors > 0 then
	error("TESTS FAILED")
end
print("ALL GOOD")
