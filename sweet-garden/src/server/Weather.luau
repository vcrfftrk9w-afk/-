-- Погода для всего сервера: дождь, снег, гроза, конфетный дождь, радуга.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Logic = require(Shared:WaitForChild("Logic"))

local Sessions = require(script.Parent.Sessions)
local Util = require(script.Parent.Util)

local Weather = {}

type Current = { id: string, def: any, endsAt: number, token: number }

local current: Current? = nil
local token = 0
local rng = Random.new()

local handlers = {
	applyMutations = function(_def) end,
	strike = function(_rng: Random): Vector3?
		return nil
	end,
	speedChanged = function() end,
}

function Weather.init(newHandlers)
	for key, fn in pairs(newHandlers) do
		handlers[key] = fn
	end
end

function Weather.growth(): number
	return current and current.def.growth or 1
end

function Weather.currentId(): string?
	return current and current.id or nil
end

local candyFolder: Folder? = nil
local candyCount = 0

local CANDY_COLORS = {
	Color3.fromRGB(255, 90, 170),
	Color3.fromRGB(110, 210, 255),
	Color3.fromRGB(255, 225, 80),
	Color3.fromRGB(140, 255, 140),
	Color3.fromRGB(200, 140, 255),
}

local function spawnCandy()
	if candyCount >= 60 then
		return
	end
	if not candyFolder or not candyFolder.Parent then
		local folder = Instance.new("Folder")
		folder.Name = "Candies"
		folder.Parent = workspace
		candyFolder = folder
	end
	local angle = rng:NextNumber() * math.pi * 2
	local distance = math.sqrt(rng:NextNumber()) * Config.World.candyRadius
	local position = Vector3.new(math.cos(angle) * distance, 70, math.sin(angle) * distance)

	local candy = Instance.new("Part")
	candy.Name = "Candy"
	candy.Shape = Enum.PartType.Ball
	candy.Size = Vector3.new(1.6, 1.6, 1.6)
	candy.Color = CANDY_COLORS[rng:NextInteger(1, #CANDY_COLORS)]
	candy.Material = Enum.Material.Neon
	candy.TopSurface = Enum.SurfaceType.Smooth
	candy.BottomSurface = Enum.SurfaceType.Smooth
	candy.CFrame = CFrame.new(position)
	candy.CanQuery = false
	candy.Parent = candyFolder
	candyCount += 1

	local taken = false
	candy.Touched:Connect(function(hit)
		if taken then
			return
		end
		local character = hit.Parent
		local player = character and Players:GetPlayerFromCharacter(character)
		local session = player and Sessions.get(player)
		if not session or not session.ready then
			return
		end
		taken = true
		local reward = Logic.candyReward(session.data.stats.earned)
		Sessions.addCoins(session, reward, true)
		Sessions.notify(session, "n_candy", Logic.format(reward))
		candy:Destroy()
	end)
	candy.Destroying:Connect(function()
		candyCount -= 1
	end)
	Debris:AddItem(candy, 25)
end

function Weather.stop()
	if not current then
		return
	end
	current = nil
	ReplicatedStorage:SetAttribute("Weather", "")
	ReplicatedStorage:SetAttribute("WeatherEnds", 0)
	handlers.speedChanged()
end

function Weather.start(id: string, duration: number?, buyer: Player?)
	local def = Config.Weather.types[id]
	if not def then
		return
	end
	local length = duration or def.duration
	token += 1
	local myToken = token
	current = { id = id, def = def, endsAt = os.clock() + length, token = myToken }
	ReplicatedStorage:SetAttribute("Weather", id)
	ReplicatedStorage:SetAttribute("WeatherEnds", workspace:GetServerTimeNow() + length)
	handlers.speedChanged()
	if buyer then
		Sessions.notifyAll("n_candy_bought", buyer.DisplayName)
	end

	-- мутации, молнии и конфеты, пока эта погода активна
	task.spawn(function()
		local nextMutation = os.clock() + Config.Weather.tick
		local nextStrike = os.clock() + (def.strikeEvery or 0)
		local nextCandy = os.clock()
		while current and current.token == myToken do
			local now = os.clock()
			if now >= current.endsAt then
				Weather.stop()
				break
			end
			if now >= nextMutation then
				nextMutation = now + Config.Weather.tick
				Util.try("mutations", handlers.applyMutations, def)
			end
			if def.strikeEvery and now >= nextStrike then
				nextStrike = now + def.strikeEvery
				local ok, position = pcall(handlers.strike, rng)
				if not ok or not position then
					local angle = rng:NextNumber() * math.pi * 2
					local distance = rng:NextNumber(60, 180)
					position = Vector3.new(math.cos(angle) * distance, 0, math.sin(angle) * distance)
				end
				Sessions.broadcast("lightning", position)
			end
			if def.candies and now >= nextCandy then
				nextCandy = now + 0.4
				Util.try("candy", spawnCandy)
			end
			task.wait(0.2)
		end
	end)
end

function Weather.begin()
	ReplicatedStorage:SetAttribute("Weather", "")
	ReplicatedStorage:SetAttribute("WeatherEnds", 0)
	task.spawn(function()
		local first = Config.Weather.firstDelay
		task.wait(rng:NextInteger(first[1], first[2]))
		while true do
			if not current then
				Weather.start(Logic.pickWeather(rng))
			end
			while current do
				task.wait(1)
			end
			local interval = Config.Weather.interval
			task.wait(rng:NextInteger(interval[1], interval[2]))
		end
	end)
end

return Weather
