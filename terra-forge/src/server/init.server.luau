-- Terra Forge server: owns the running skirmish and relays player actions to it.
local InsertService = game:GetService("InsertService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

-- the game is played on a map in the UI, so players have no characters
Players.CharacterAutoLoads = false

local remotes = Instance.new("Folder")
remotes.Name = "TerraForgeRemotes"
local event = Instance.new("RemoteEvent")
event.Name = "Event"
event.Parent = remotes
local action = Instance.new("RemoteEvent")
action.Name = "Action"
action.Parent = remotes
remotes.Parent = ReplicatedStorage

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local MapArt = require(Shared.MapArt)
local Match = require(script.Match)

-- the pictures are uploaded as decals; clients need the image inside each of them
local art = Instance.new("Folder")
art.Name = "TerraForgeArt"
art.Parent = ReplicatedStorage
for name, id in MapArt do
	task.spawn(function()
		for attempt = 1, 6 do
			local ok, model = pcall(InsertService.LoadAsset, InsertService, id)
			if ok and model then
				local decal = model:FindFirstChildWhichIsA("Decal", true)
				local image = if decal then decal.Texture else nil
				model:Destroy()
				if image and image ~= "" then
					art:SetAttribute(name, image)
					return
				end
			end
			task.wait(attempt * 2)
		end
		warn("[Terra Forge] picture " .. name .. " could not be loaded")
	end)
end

local match = nil

-- server errors are also sent to players, so they can be reported from a phone
local reported = {}
local function report(where: string, err)
	local text = where .. ": " .. string.sub(tostring(err), 1, 600)
	warn("[Terra Forge] " .. text)
	if reported[text] or #Players:GetPlayers() == 0 then
		return
	end
	reported[text] = true
	event:FireAllClients("batch", { { t = "error", text = text } })
end

local function safe(where: string, fn, ...)
	local ok, err = xpcall(fn, debug.traceback, ...)
	if not ok then
		report(where, err)
	end
	return ok
end

local function isNumber(v): boolean
	return typeof(v) == "number" and v == v and math.abs(v) < 1e6
end

-- everyone watching gets the new battle; the player who started it gets theirs when seated
local function startMatch(starter: Player)
	match = Match.new(event)
	for _, p in Players:GetPlayers() do
		if p ~= starter then
			match:sendSnapshot(p)
		end
	end
end

-- a fresh match is needed when none is running, it is over, or only bots are left in it
local function stale(): boolean
	return not match or match.phase == "ended" or (match:humanCount() == 0 and match.joinTimer <= 0)
end

-- simple flood protection: at most 25 actions per player per second
local budget = {}

local function onAction(player: Player, kind, a, b, c)
	if typeof(kind) ~= "string" then
		return
	end
	local t = os.clock()
	local entry = budget[player]
	if not entry or t - entry.since > 1 then
		entry = { since = t, count = 0 }
		budget[player] = entry
	end
	entry.count += 1
	if entry.count > 25 then
		return
	end

	if kind == "play" then
		if stale() then
			startMatch(player)
		end
		match:play(player)
	elseif not match then
		return
	elseif kind == "build" and typeof(a) == "string" and Config.BUILD[a] and isNumber(b) and isNumber(c) then
		match:build(player, a, b, c)
	elseif kind == "move" and typeof(a) == "table" and isNumber(b) and isNumber(c) then
		local ids = {}
		for i, id in a do
			if typeof(i) ~= "number" or i > 80 then
				break
			end
			if isNumber(id) then
				table.insert(ids, id)
			end
		end
		match:move(player, ids, b, c)
	elseif kind == "queue" and isNumber(a) and typeof(b) == "string" and Config.UNITS[b] then
		match:queueUnit(player, a, b)
	elseif kind == "cancel" and isNumber(a) then
		match:cancelUnit(player, a)
	elseif kind == "auto" and isNumber(a) and typeof(b) == "string" and (b == "" or Config.UNITS[b]) then
		match:setAuto(player, a, b)
	elseif kind == "rally" and isNumber(a) and isNumber(b) and isNumber(c) then
		match:setRally(player, a, b, c)
	elseif kind == "leave" then
		match:leave(player)
	end
end

action.OnServerEvent:Connect(function(player: Player, kind, a, b, c)
	safe("действие " .. tostring(kind), onAction, player, kind, a, b, c)
end)

Players.PlayerAdded:Connect(function(player)
	if match then
		match:sendSnapshot(player)
	end
end)

Players.PlayerRemoving:Connect(function(player)
	budget[player] = nil
	if match then
		match:leave(player)
	end
end)

local lobbyAcc = 0
local failures = 0
RunService.Heartbeat:Connect(function(dt)
	if match then
		if safe("матч", match.step, match, dt) then
			failures = 0
		else
			-- a broken match would keep failing every frame: end it after a few seconds
			failures += 1
			if failures > 180 then
				failures = 0
				match.done = true
			end
		end
		if match.done then
			match = nil
			event:FireAllClients("batch", { { t = "nomatch" } })
		end
	end
	lobbyAcc += dt
	if lobbyAcc >= 1 then
		lobbyAcc = 0
		event:FireAllClients("batch", {
			{
				t = "lobby",
				phase = if match then match.phase else "none",
				timer = if match then match.timer else 0,
				join = if match then math.max(0, match.joinTimer) else 0,
				players = #Players:GetPlayers(),
				inMatch = if match then match:humanCount() else 0,
			},
		})
	end
end)
