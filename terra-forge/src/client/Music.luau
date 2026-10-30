-- Background music: a calm playlist in the menu and a battle playlist during a match, one
-- track after another in shuffled order, fading between them. In battle it plays quieter so
-- the shots and explosions come through. The player can switch it off.
-- The tracks are Roblox-licensed music from the Creator Store, free to use in any Roblox
-- experience: APM Music (by APMOfficial) and DistroKid artists (by DistrokidOfficial).
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")

local Music = {}
Music.on = true

local TRACKS = {
	menu = {
		1844412739, -- Heroic Sentiment (APM Music)
		1836289820, -- Lost World (APM Music)
	},
	battle = {
		1835772023, -- Battle Of Shadows (APM Music)
		114403249324975, -- Victory in the Making (DistroKid)
		124027970389012, -- Rise of the Heroes (DistroKid)
		100277718098342, -- Battle Cry of the Free (DistroKid)
	},
}
local VOLUME = { menu = 0.4, battle = 0.22 }
local FADE = 1.6

local mode = nil -- "menu" or "battle"
local sound = nil -- the track playing now
local order = {} -- the shuffled playlist of the current mode and where it is
local rng = Random.new()

local function fadeOut(s: Sound)
	local tween = TweenService:Create(s, TweenInfo.new(FADE), { Volume = 0 })
	tween.Completed:Connect(function()
		s:Destroy()
	end)
	tween:Play()
end

local function shuffled(list)
	local a = table.clone(list)
	for i = #a, 2, -1 do
		local j = rng:NextInteger(1, i)
		a[i], a[j] = a[j], a[i]
	end
	return a
end

local playNext

-- starts the next track of the playlist, fading in
function playNext()
	if sound then
		fadeOut(sound)
		sound = nil
	end
	if not Music.on or not mode then
		return
	end
	if #order.list == 0 then
		order.list = shuffled(TRACKS[mode])
	end
	local id = table.remove(order.list, 1)
	local s = Instance.new("Sound")
	s.Name = "TerraForgeMusic"
	s.SoundId = "rbxassetid://" .. id
	s.Volume = 0
	s.Parent = SoundService
	s.Ended:Connect(function()
		if sound == s then
			playNext()
		end
	end)
	sound = s
	s:Play()
	TweenService:Create(s, TweenInfo.new(FADE), { Volume = VOLUME[mode] }):Play()
end

-- "menu" or "battle": switches to that playlist (nothing happens if it already plays)
function Music.setMode(m: string)
	if m == mode then
		return
	end
	mode = m
	order = { list = {} }
	playNext()
end

function Music.setOn(on: boolean)
	if on == Music.on then
		return
	end
	Music.on = on
	if on then
		order = { list = {} }
		playNext()
	elseif sound then
		fadeOut(sound)
		sound = nil
	end
end

return Music
