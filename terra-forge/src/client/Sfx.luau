-- Sound effects. All clips are cut from one audio asset (shared/SoundData) with
-- Sound.PlaybackRegion. Battle sounds get quieter away from the middle of the screen and are
-- skipped when far off screen, when the same clip just played, or when many are playing.
local ContentProvider = game:GetService("ContentProvider")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local SoundData = require(Shared.SoundData)

local Sfx = {}
-- the camera: returns the centre of the view and its half size, in tiles
Sfx.view = nil :: (() -> (number, number, number))?

-- per clip: volume, shortest gap between two plays (s), pitch spread
local MIX = {
	rifle = { 0.32, 0.07, 0.12 },
	mg = { 0.3, 0.06, 0.1 },
	cannon = { 0.5, 0.1, 0.08 },
	tower = { 0.55, 0.15, 0.06 },
	artillery = { 0.6, 0.15, 0.08 },
	rocket = { 0.4, 0.1, 0.1 },
	flak = { 0.35, 0.1, 0.1 },
	boom = { 0.55, 0.06, 0.12 },
	bigboom = { 0.8, 0.2, 0.08 },
	build = { 0.6, 0.2, 0.05 },
	hammer = { 0.4, 0.15, 0.15 },
	built = { 0.6, 0.3, 0 },
	ready = { 0.45, 0.2, 0 },
	click = { 0.5, 0.03, 0 },
	order = { 0.5, 0.08, 0.05 },
	error = { 0.55, 0.3, 0 },
	alarm = { 0.7, 0.5, 0 },
	win = { 0.8, 1, 0 },
	lose = { 0.8, 1, 0 },
}
local MAX_PLAYING = 12

local template = nil
local playing = 0
local last = {}
local rng = Random.new()

if SoundData.id ~= 0 then
	template = Instance.new("Sound")
	template.Name = "TerraForgeSfx"
	template.SoundId = "rbxassetid://" .. SoundData.id
	template.PlaybackRegionsEnabled = true
	template.Parent = SoundService
	task.spawn(function()
		pcall(ContentProvider.PreloadAsync, ContentProvider, { template })
	end)
end

local function start(name: string, volume: number)
	local region = SoundData.clips[name]
	local mix = MIX[name]
	if not template or not region or not mix or volume <= 0.02 or playing >= MAX_PLAYING then
		return
	end
	local now = os.clock()
	if last[name] and now - last[name] < mix[2] then
		return
	end
	last[name] = now
	local s = template:Clone()
	s.PlaybackRegion = NumberRange.new(region[1], region[1] + region[2])
	s.PlaybackSpeed = 1 + (rng:NextNumber() * 2 - 1) * mix[3]
	s.Volume = mix[1] * volume
	s.Parent = SoundService
	s:Play()
	playing += 1
	task.delay(region[2] / s.PlaybackSpeed + 0.15, function()
		playing -= 1
		s:Destroy()
	end)
end

-- a sound of the interface, always at full volume
function Sfx.play(name: string)
	start(name, 1)
end

-- a sound of the battle at (x, y) in tiles: quieter away from the middle of the screen
function Sfx.at(name: string, x: number, y: number)
	if not Sfx.view then
		return
	end
	local cx, cy, half = Sfx.view()
	local d = math.sqrt((x - cx) ^ 2 + (y - cy) ^ 2)
	-- zoomed far out everything is quieter, so a big battle does not turn into noise
	local zoom = math.clamp(14 / half, 0.35, 1)
	start(name, math.clamp(1.3 - d / (half * 1.6), 0, 1) * zoom)
end

return Sfx
