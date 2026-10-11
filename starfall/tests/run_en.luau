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
local Stars = Runtime.require(Runtime.find("ServerScriptService/Server/Stars"))
local World = Runtime.require(Runtime.find("ServerScriptService/Server/World"))
local gui = player.PlayerGui.StarfallUI
check(Ctx.lang == "en", "english language selected")
check(Ctx.portrait, "portrait layout")
check(Runtime.findText(gui, "Base") ~= nil, "english buttons")
check(Runtime.findText(gui, "BONK") ~= nil, "bonk button")
local map = Runtime.workspace.Starfall
check(World.bases[1].sign.Text == "⭐ Alex's base", "english base sign: " .. World.bases[1].sign.Text)
check(map.Board_earned.Board.Title.Text == "🏆 Richest", "english board title")

Stars.dropFromSky(nil, "disco", nil)
Runtime.advance(4)
local star
for _, model in ipairs(map.FieldStars:GetChildren()) do
	if model:GetAttribute("Star") == "disco" then
		star = model
	end
end
check(star ~= nil, "disco star landed")
if star then
	check(star.Body.Prompt.ActionText == "Catch", "english grab prompt")
	player.Character:PivotTo(Types.CFrame.new(star:GetPivot().Position))
	Runtime.triggerPrompt(star.Body.Prompt, player)
	Runtime.advance(0.5)
	check(Ctx.state.carrying and Ctx.state.carrying.t == "disco", "caught the disco star")
	check(Runtime.findText(gui, "Carrying") ~= nil, "english carry banner")
	player.Character:PivotTo(World.bases[1].spawn)
	Runtime.advance(0.6)
	check(Ctx.state.carrying == nil and Ctx.state.stars["1"] ~= nil, "delivered")
end

for _, name in ipairs({ "upgrades", "telescope", "stars", "shop", "codes" }) do
	Ctx.openPanel(name)
	Runtime.advance(1)
	Ctx.closePanel()
end
Stars.startShower(5)
Runtime.advance(6)

print(("english smoke test: failed %d, runtime errors %d"):format(failures, #Sched.errors))
if failures > 0 or #Sched.errors > 0 then
	error("TESTS FAILED")
end
print("ALL GOOD")
