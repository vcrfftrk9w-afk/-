-- Mock Roblox runtime: DataModel, services, players, remotes, data stores and a loader
-- that runs the game's real scripts in this environment.

local API = require("../build/api")
local Types = require("./types")
local Sched = require("./sched")
local Inst = require("./instance")

local Signal = Sched.Signal
local typeof = Types.typeof
local Vector3 = Types.Vector3
local Vector2 = Types.Vector2
local CFrame = Types.CFrame
local Enum = Types.Enum
local states = Inst.states
local methods = Inst.classMethods

local Runtime = {}
Runtime.Sched = Sched
Runtime.Inst = Inst
Runtime.Types = Types
Runtime.log = {} :: { string }
Runtime.purchases = {} :: { any }
Runtime.chat = {} :: { string }

local function service(className: string)
	local proxy = Inst.make(className)
	states[proxy].name = className
	return proxy
end

---------------------------------------------------------------------
-- DataModel и сервисы
---------------------------------------------------------------------

local game = service("DataModel")
states[game].name = "Game"
Runtime.game = game

local services: { [string]: any } = {}
local function getService(className: string)
	local existing = services[className]
	if existing then
		return existing
	end
	local info = API.classes[className]
	if not info or not info.svc then
		error("'" .. tostring(className) .. "' is not a valid Service name", 3)
	end
	local proxy = service(className)
	services[className] = proxy
	states[proxy].parent = game
	table.insert(states[game].children, proxy)
	return proxy
end
Runtime.getService = getService

local bindToClose = {}
Runtime.bindToClose = bindToClose

methods.DataModel = {
	GetService = function(_, name: string)
		return getService(name)
	end,
	FindService = function(_, name: string)
		return services[name]
	end,
	IsLoaded = function()
		return true
	end,
	BindToClose = function(_, fn)
		if type(fn) ~= "function" then
			error("BindToClose expects a function", 2)
		end
		table.insert(bindToClose, fn)
	end,
}

local workspace = getService("Workspace")
states[workspace].name = "Workspace"
Runtime.workspace = workspace
local terrain = Inst.make("Terrain")
states[terrain].name = "Terrain"
states[terrain].parent = workspace
table.insert(states[workspace].children, terrain)
local camera = Inst.new("Camera")
camera.CFrame = CFrame.new(0, 20, 30)
camera.Parent = workspace
states[workspace].props.CurrentCamera = camera
Runtime.terrainFills = 0

methods.Workspace = {
	GetServerTimeNow = function()
		return Sched.epoch + Sched.now
	end,
}

methods.Terrain = {
	FillBlock = function(_, cframe, size, material)
		assert(typeof(cframe) == "CFrame", "FillBlock: CFrame expected")
		assert(typeof(size) == "Vector3", "FillBlock: Vector3 expected")
		assert(typeof(material) == "EnumItem" and material.EnumType == "Material", "FillBlock: Material expected")
		Runtime.terrainFills += 1
	end,
	FillBall = function() end,
	SetMaterialColor = function(_, material, color)
		assert(typeof(material) == "EnumItem" and material.EnumType == "Material", "SetMaterialColor: Material expected")
		assert(typeof(color) == "Color3", "SetMaterialColor: Color3 expected")
	end,
}

for _, name in ipairs({ "Lighting", "ReplicatedStorage", "ServerScriptService", "ServerStorage", "StarterGui", "StarterPack", "StarterPlayer", "SoundService", "Players", "TextChatService" }) do
	getService(name)
end

---------------------------------------------------------------------
-- RunService, UserInputService, ProximityPromptService и др.
---------------------------------------------------------------------

local RunService = getService("RunService")
Sched.onFrame(function(dt)
	Inst.fire(RunService, "Stepped", Sched.now, dt)
	Inst.fire(RunService, "RenderStepped", dt)
	Inst.fire(RunService, "Heartbeat", dt)
end)
methods.RunService = {
	IsServer = function()
		return true
	end,
	IsClient = function()
		return true
	end,
	IsStudio = function()
		return false
	end,
}

local UserInputService = getService("UserInputService")
states[UserInputService].props.TouchEnabled = true

getService("ProximityPromptService")

local CollectionService = getService("CollectionService")
methods.CollectionService = {
	AddTag = function(_, instance, tag)
		Inst.addTag(instance, tag)
	end,
	RemoveTag = function(_, instance, tag)
		Inst.removeTag(instance, tag)
	end,
	HasTag = function(_, instance, tag)
		return states[instance].tags[tag] == true
	end,
	GetTagged = function(_, tag)
		local list = {}
		for instance in pairs(Inst.tagged[tag] or {}) do
			table.insert(list, instance)
		end
		return list
	end,
	GetInstanceAddedSignal = function(_, tag)
		return Inst.tagSignal(tag, false)
	end,
	GetInstanceRemovedSignal = function(_, tag)
		return Inst.tagSignal(tag, true)
	end,
}

local Debris = getService("Debris")
methods.Debris = {
	AddItem = function(_, instance, lifetime)
		assert(typeof(instance) == "Instance", "Debris:AddItem expects an Instance")
		Sched.delay(lifetime or 10, function()
			Inst.destroy(instance)
		end)
	end,
}

---------------------------------------------------------------------
-- TweenService
---------------------------------------------------------------------

local TweenService = getService("TweenService")
methods.TweenService = {
	Create = function(_, instance, info, goals)
		assert(typeof(instance) == "Instance", "TweenService:Create expects an Instance")
		assert(typeof(info) == "TweenInfo", "TweenService:Create expects TweenInfo")
		local st = states[instance]
		for key, value in pairs(goals) do
			local kind, prop = Inst.memberInfo(st.className, key)
			if kind ~= "p" then
				error("TweenService: " .. tostring(key) .. " is not a property of " .. st.className, 2)
			end
			local t = typeof(value)
			if t ~= "number" and t ~= "Vector3" and t ~= "Vector2" and t ~= "CFrame" and t ~= "Color3" and t ~= "UDim2" and t ~= "UDim" then
				error("TweenService: property " .. key .. " of type " .. t .. " can't be tweened", 2)
			end
			assert(prop, "no prop")
		end
		local tween = Inst.make("Tween")
		local tweenState = states[tween]
		tweenState.extra.tween = { instance = instance, info = info, goals = goals }
		return tween
	end,
}
methods.Tween = {
	Play = function(self)
		local data = states[self].extra.tween
		Sched.delay(data.info.Time, function()
			if not states[data.instance].destroyed then
				for key, value in pairs(data.goals) do
					data.instance[key] = value
				end
			end
			Inst.fire(self, "Completed", Enum.PlaybackState.Completed)
		end)
	end,
	Cancel = function() end,
	Pause = function() end,
}

---------------------------------------------------------------------
-- DataStores (с проверкой, что данные можно сохранить)
---------------------------------------------------------------------

local function validateStorable(value: any, path: string)
	local t = type(value)
	if t == "number" then
		if value ~= value or value == math.huge or value == -math.huge then
			error("DataStore: NaN/inf at " .. path, 0)
		end
	elseif t == "string" or t == "boolean" or t == "nil" then
		return
	elseif t == "table" then
		if getmetatable(value) ~= nil then
			error("DataStore: cannot store " .. typeof(value) .. " at " .. path, 0)
		end
		local count, hasString, hasNumber = 0, false, false
		for key, item in pairs(value) do
			count += 1
			if type(key) == "string" then
				hasString = true
			elseif type(key) == "number" then
				hasNumber = true
			else
				error("DataStore: bad key type at " .. path, 0)
			end
			validateStorable(item, path .. "." .. tostring(key))
		end
		if hasString and hasNumber then
			error("DataStore: mixed table at " .. path, 0)
		end
		if hasNumber and count ~= #value then
			error("DataStore: sparse array at " .. path, 0)
		end
	else
		error("DataStore: cannot store " .. t .. " at " .. path, 0)
	end
end

local function deepCopy(value: any): any
	if type(value) ~= "table" or getmetatable(value) ~= nil then
		return value
	end
	local copy = {}
	for key, item in pairs(value) do
		copy[key] = deepCopy(item)
	end
	return copy
end
Runtime.deepCopy = deepCopy

local stores: { [string]: { [string]: any } } = {}
Runtime.stores = stores
Runtime.dataStoreFail = false

local function makeStore(name: string)
	stores[name] = stores[name] or {}
	local data = stores[name]
	local store = {}
	function store:GetAsync(key: string)
		if Runtime.dataStoreFail then
			error("DataStore request failed (test)")
		end
		Sched.wait(0.1)
		return deepCopy(data[key])
	end
	function store:SetAsync(key: string, value: any)
		if Runtime.dataStoreFail then
			error("DataStore request failed (test)")
		end
		validateStorable(value, name .. "/" .. key)
		Sched.wait(0.1)
		data[key] = deepCopy(value)
	end
	function store:UpdateAsync(key: string, fn)
		if Runtime.dataStoreFail then
			error("DataStore request failed (test)")
		end
		Sched.wait(0.1)
		local result = fn(deepCopy(data[key]))
		validateStorable(result, name .. "/" .. key)
		data[key] = deepCopy(result)
		return deepCopy(result)
	end
	return store
end

local orderedStores: { [string]: { [string]: number } } = {}
local function makeOrderedStore(name: string)
	orderedStores[name] = orderedStores[name] or {}
	local data = orderedStores[name]
	local store = {}
	function store:SetAsync(key: string, value: number)
		if type(value) ~= "number" or value ~= math.floor(value) then
			error("OrderedDataStore value must be an integer, got " .. tostring(value))
		end
		data[key] = value
	end
	function store:GetSortedAsync(ascending: boolean, pageSize: number)
		local list = {}
		for key, value in pairs(data) do
			table.insert(list, { key = key, value = value })
		end
		table.sort(list, function(a, b)
			if ascending then
				return a.value < b.value
			end
			return a.value > b.value
		end)
		local page = {}
		for i = 1, math.min(pageSize, #list) do
			page[i] = list[i]
		end
		return {
			GetCurrentPage = function()
				return page
			end,
		}
	end
	return store
end

getService("DataStoreService")
methods.DataStoreService = {
	GetDataStore = function(_, name: string)
		return makeStore(name)
	end,
	GetOrderedDataStore = function(_, name: string)
		return makeOrderedStore(name)
	end,
}

---------------------------------------------------------------------
-- MarketplaceService
---------------------------------------------------------------------

local MarketplaceService = getService("MarketplaceService")
Runtime.ownedPasses = {} :: { [number]: boolean }
methods.MarketplaceService = {
	UserOwnsGamePassAsync = function(_, userId: number, passId: number)
		assert(type(userId) == "number" and type(passId) == "number", "UserOwnsGamePassAsync expects numbers")
		return Runtime.ownedPasses[passId] == true
	end,
	PromptGamePassPurchase = function(_, player, id)
		assert(typeof(player) == "Instance", "PromptGamePassPurchase expects a Player")
		table.insert(Runtime.purchases, { kind = "pass", id = id })
	end,
	PromptProductPurchase = function(_, player, id)
		assert(typeof(player) == "Instance", "PromptProductPurchase expects a Player")
		table.insert(Runtime.purchases, { kind = "product", id = id })
	end,
	GetProductInfo = function(_, id, infoType)
		assert(type(id) == "number", "GetProductInfo expects a number")
		assert(typeof(infoType) == "EnumItem", "GetProductInfo expects Enum.InfoType")
		return { PriceInRobux = 49, Name = "Test" }
	end,
}
Runtime.MarketplaceService = MarketplaceService

---------------------------------------------------------------------
-- Игроки и персонажи
---------------------------------------------------------------------

local Players = getService("Players")
states[Players].props.CharacterAutoLoads = true
local playerList = {}
Runtime.players = playerList

methods.Players = {
	GetPlayers = function()
		return table.clone(playerList)
	end,
	GetPlayerFromCharacter = function(_, character)
		if character == nil then
			return nil
		end
		for _, player in ipairs(playerList) do
			if player.Character == character then
				return player
			end
		end
		return nil
	end,
	GetPlayerByUserId = function(_, userId)
		for _, player in ipairs(playerList) do
			if player.UserId == userId then
				return player
			end
		end
		return nil
	end,
	GetNameFromUserIdAsync = function(_, userId)
		return "User" .. tostring(userId)
	end,
}

local function findSpawn()
	for _, item in ipairs(workspace:GetDescendants()) do
		if item.ClassName == "SpawnLocation" and item.Enabled then
			return item.CFrame + Vector3.new(0, 3, 0)
		end
	end
	return CFrame.new(0, 50, 0)
end

local function newPart(className: string, name: string, size, parent)
	local part = Inst.new(className)
	part.Name = name
	part.Size = size
	part.Parent = parent
	return part
end

local function buildCharacter(player)
	local character = Inst.new("Model")
	character.Name = player.Name
	local root = newPart("Part", "HumanoidRootPart", Vector3.new(2, 2, 1), character)
	newPart("Part", "Head", Vector3.new(2, 1, 1), character)
	newPart("Part", "UpperTorso", Vector3.new(2, 2, 1), character)
	local humanoid = Inst.new("Humanoid")
	humanoid.Parent = character
	character.PrimaryPart = root
	local spawnCf = findSpawn()
	character:PivotTo(spawnCf)
	return character
end

methods.Player = {
	LoadCharacter = function(self)
		local st = states[self]
		if st.extra.left then
			error("LoadCharacter: player has left the game")
		end
		local old = self.Character
		if old then
			Inst.fire(self, "CharacterRemoving", old)
			Inst.destroy(old)
		end
		local character = buildCharacter(self)
		st.extra.allowWrite = true
		self.Character = character
		st.extra.allowWrite = false
		character.Parent = workspace
		Inst.fire(self, "CharacterAdded", character)
	end,
	LoadCharacterAsync = function(self)
		methods.Player.LoadCharacter(self)
	end,
	Kick = function(self, message)
		table.insert(Runtime.log, "Kick: " .. tostring(message))
		Runtime.removePlayer(self)
	end,
}

methods.Humanoid = {
	EquipTool = function(self, tool)
		tool.Parent = self.Parent
	end,
	UnequipTools = function() end,
	TakeDamage = function(self, amount)
		self.Health = math.max(0, self.Health - amount)
	end,
}

function Runtime.killCharacter(player)
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if humanoid then
		humanoid.Health = 0
		Inst.fire(humanoid, "Died")
	end
end

function Runtime.addPlayer(name: string, userId: number, localeId: string?, isLocal: boolean?)
	local player = Inst.make("Player")
	local st = states[player]
	st.name = name
	st.props.DisplayName = name
	st.props.UserId = userId
	st.props.LocaleId = localeId or "ru-ru"
	for _, child in ipairs({ "PlayerGui", "Backpack", "PlayerScripts" }) do
		local folder = Inst.make(child)
		states[folder].name = child
		states[folder].parent = player
		table.insert(st.children, folder)
	end
	table.insert(playerList, player)
	states[player].parent = Players
	table.insert(states[Players].children, player)
	if isLocal ~= false then
		states[Players].props.LocalPlayer = player
	end
	Inst.fire(Players, "PlayerAdded", player)
	if Players.CharacterAutoLoads then
		player:LoadCharacter()
	end
	return player
end

function Runtime.removePlayer(player)
	local index = table.find(playerList, player)
	if not index then
		return
	end
	Inst.fire(Players, "PlayerRemoving", player)
	table.remove(playerList, index)
	states[player].extra.left = true
	local character = player.Character
	if character then
		Inst.destroy(character)
	end
	local siblings = states[Players].children
	local childIndex = table.find(siblings, player)
	if childIndex then
		table.remove(siblings, childIndex)
	end
	states[player].parent = nil
end

---------------------------------------------------------------------
-- RemoteEvent / BindableEvent (одна машина = сервер и клиент)
---------------------------------------------------------------------

local function networkCopy(value: any, path: string): any
	local t = typeof(value)
	if t == "table" then
		local copy = {}
		local hasString, hasNumber = false, false
		for key, item in pairs(value) do
			if type(key) == "string" then
				hasString = true
			elseif type(key) == "number" then
				hasNumber = true
			end
			copy[key] = networkCopy(item, path .. "." .. tostring(key))
		end
		if hasString and hasNumber then
			error("Remote: mixed table at " .. path .. " (data would be lost)", 0)
		end
		return copy
	elseif t == "function" or t == "thread" then
		error("Remote: cannot send " .. t .. " at " .. path, 0)
	end
	return value
end

local function packCopy(...)
	local args = table.pack(...)
	for i = 1, args.n do
		args[i] = networkCopy(args[i], "arg" .. i)
	end
	return args
end

methods.RemoteEvent = {
	FireServer = function(self, ...)
		local args = packCopy(...)
		local player = Players.LocalPlayer
		Inst.fire(self, "OnServerEvent", player, table.unpack(args, 1, args.n))
	end,
	FireClient = function(self, player, ...)
		assert(typeof(player) == "Instance" and player.ClassName == "Player", "FireClient expects a Player")
		local args = packCopy(...)
		if player == Players.LocalPlayer and not states[player].extra.left then
			Inst.fire(self, "OnClientEvent", table.unpack(args, 1, args.n))
		end
	end,
	FireAllClients = function(self, ...)
		local args = packCopy(...)
		Inst.fire(self, "OnClientEvent", table.unpack(args, 1, args.n))
	end,
}

methods.BindableEvent = {
	Fire = function(self, ...)
		Inst.fire(self, "Event", ...)
	end,
}

methods.ParticleEmitter = {
	Emit = function(_, count)
		assert(type(count) == "number", "Emit expects a number")
	end,
}

methods.BasePart = {
	SetNetworkOwner = function(self, owner)
		if not self:IsDescendantOf(workspace) then
			error("Can only call SetNetworkOwner on descendants of Workspace", 2)
		end
		if self.Anchored then
			error("Cannot call SetNetworkOwner on anchored parts", 2)
		end
		if owner ~= nil and (typeof(owner) ~= "Instance" or owner.ClassName ~= "Player") then
			error("SetNetworkOwner expects a Player or nil", 2)
		end
	end,
}

methods.TextChannel = {
	DisplaySystemMessage = function(_, text)
		table.insert(Runtime.chat, text)
	end,
}

---------------------------------------------------------------------
-- Загрузка скриптов игры
---------------------------------------------------------------------

local modules: { [any]: { loaded: boolean, value: any, loading: boolean } } = {}
local sourcesByInstance: { [any]: any } = {}
Runtime.instancesByPath = {} :: { [string]: any }

local baseEnv = {
	game = game,
	workspace = workspace,
	Instance = { new = Inst.new },
	Vector3 = Types.Vector3,
	Vector2 = Types.Vector2,
	CFrame = Types.CFrame,
	Color3 = Types.Color3,
	UDim = Types.UDim,
	UDim2 = Types.UDim2,
	NumberRange = Types.NumberRange,
	NumberSequence = Types.NumberSequence,
	NumberSequenceKeypoint = Types.NumberSequenceKeypoint,
	ColorSequence = Types.ColorSequence,
	ColorSequenceKeypoint = Types.ColorSequenceKeypoint,
	TweenInfo = Types.TweenInfo,
	Random = Types.Random,
	Enum = Types.Enum,
	task = Sched.task,
	os = Sched.os,
	typeof = Types.typeof,
	warn = function(...)
		local parts = {}
		for i = 1, select("#", ...) do
			table.insert(parts, tostring((select(i, ...))))
		end
		local text = table.concat(parts, " ")
		table.insert(Runtime.log, "WARN " .. text)
		print("[warn] " .. text)
	end,
	print = function(...)
		local parts = {}
		for i = 1, select("#", ...) do
			table.insert(parts, tostring((select(i, ...))))
		end
		table.insert(Runtime.log, table.concat(parts, " "))
	end,
	tick = function()
		return Sched.epoch + Sched.now
	end,
	time = function()
		return Sched.now
	end,
	wait = function()
		error("deprecated global wait() used")
	end,
	spawn = function()
		error("deprecated global spawn() used")
	end,
	delay = function()
		error("deprecated global delay() used")
	end,
}

local function makeEnv(scriptInstance)
	local env = setmetatable({}, {
		__index = function(_, key)
			local value = baseEnv[key]
			if value ~= nil then
				return value
			end
			return (_G :: any)[key]
		end,
	})
	env.script = scriptInstance
	env.require = function(target)
		if typeof(target) ~= "Instance" then
			error("require expects a ModuleScript instance", 2)
		end
		return Runtime.require(target)
	end
	return env
end

local function load(instance)
	local source = sourcesByInstance[instance]
	if not source then
		error("No source for " .. Inst.fullName(instance), 3)
	end
	local fn, err = loadstring(source.source, "=" .. source.file)
	if not fn then
		error("Compile error: " .. tostring(err), 3)
	end
	setfenv(fn, makeEnv(instance))
	return fn
end

function Runtime.require(instance)
	if states[instance].className ~= "ModuleScript" then
		error("Attempted to call require with invalid argument(s).", 3)
	end
	local record = modules[instance]
	if record then
		if record.loading then
			error("Requested module was required recursively: " .. Inst.fullName(instance), 3)
		end
		return record.value
	end
	record = { loaded = false, value = nil, loading = true }
	modules[instance] = record
	local fn = load(instance)
	local results = table.pack(fn())
	if results.n ~= 1 then
		error("Module code did not return exactly one value: " .. Inst.fullName(instance), 3)
	end
	record.value = results[1]
	record.loaded = true
	record.loading = false
	return record.value
end

function Runtime.loadProject(items)
	for _, item in ipairs(items) do
		local parent = game
		for i = 1, #item.path - 1 do
			parent = parent:FindFirstChild(item.path[i]) or error("missing " .. item.path[i])
		end
		local name = item.path[#item.path]
		local instance
		if #item.path == 1 then
			instance = getService(name)
		else
			instance = parent:FindFirstChild(name)
			if not instance then
				local info = API.classes[item.class]
				if info and info.nc then
					instance = Inst.make(item.class)
				else
					instance = Inst.new(item.class)
				end
				instance.Name = name
				instance.Parent = parent
			end
		end
		Runtime.instancesByPath[table.concat(item.path, "/")] = instance
		if item.source then
			sourcesByInstance[instance] = item
		end
	end
end

function Runtime.find(path: string)
	return Runtime.instancesByPath[path] or error("no instance at " .. path)
end

function Runtime.runScript(path: string, asInstance: any?)
	local instance = Runtime.find(path)
	local fn = load(instance)
	if asInstance then
		setfenv(fn, makeEnv(asInstance))
	end
	return Sched.spawn(fn)
end

---------------------------------------------------------------------
-- Помощники для тестов
---------------------------------------------------------------------

function Runtime.click(button)
	assert(typeof(button) == "Instance", "click expects an Instance")
	assert(Inst.classIsA(button.ClassName, "GuiButton"), "click expects a GuiButton, got " .. button.ClassName)
	Inst.fire(button, "Activated")
end

function Runtime.triggerPrompt(prompt, player)
	assert(prompt.ClassName == "ProximityPrompt", "expects a ProximityPrompt")
	Inst.fire(prompt, "Triggered", player)
	Inst.fire(getService("ProximityPromptService"), "PromptTriggered", prompt, player)
end

function Runtime.touch(part, otherPart)
	Inst.fire(part, "Touched", otherPart)
end

function Runtime.advance(seconds: number)
	Sched.advance(seconds)
end

function Runtime.closeServer()
	for _, fn in ipairs(bindToClose) do
		Sched.spawn(fn)
	end
end

function Runtime.findText(root, pattern: string)
	for _, item in ipairs(root:GetDescendants()) do
		local className = item.ClassName
		if (className == "TextLabel" or className == "TextButton" or className == "TextBox") and string.find(item.Text, pattern, 1, true) then
			return item
		end
	end
	return nil
end

function Runtime.allText(root): { string }
	local list = {}
	for _, item in ipairs(root:GetDescendants()) do
		local className = item.ClassName
		if (className == "TextLabel" or className == "TextButton") and item.Text ~= "" then
			table.insert(list, item.Text)
		end
	end
	return list
end

return Runtime
