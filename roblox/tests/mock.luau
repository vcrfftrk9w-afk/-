-- Упрощённая замена API Roblox для прогона скриптов режима без Studio.
-- Проверяет логику и опечатки в наших скриптах; поведение самого движка не эмулирует.

local M = {}
local realRequire = require

-- ------------------------------------------------------------ значения

local Vector3 = {}
Vector3.__index = Vector3
local function v3(x, y, z)
	return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, Vector3)
end
Vector3.new = v3
Vector3.__add = function(a, b) return v3(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
Vector3.__sub = function(a, b) return v3(a.X - b.X, a.Y - b.Y, a.Z - b.Z) end
Vector3.__mul = function(a, b)
	if type(a) == "number" then a, b = b, a end
	if type(b) == "number" then return v3(a.X * b, a.Y * b, a.Z * b) end
	return v3(a.X * b.X, a.Y * b.Y, a.Z * b.Z)
end
Vector3.__div = function(a, b) return v3(a.X / b, a.Y / b, a.Z / b) end
Vector3.__unm = function(a) return v3(-a.X, -a.Y, -a.Z) end
Vector3.__eq = function(a, b) return a.X == b.X and a.Y == b.Y and a.Z == b.Z end
function Vector3.Lerp(a, b, t) return a + (b - a) * t end
setmetatable(Vector3, { __index = function(_, k)
	if k == "zero" then return v3(0, 0, 0) end
	if k == "one" then return v3(1, 1, 1) end
end })
local v3mt = Vector3
local function magnitude(v) return math.sqrt(v.X * v.X + v.Y * v.Y + (v.Z or 0) * (v.Z or 0)) end
local oldIndex = v3mt.__index
v3mt.__index = function(t, k)
	if k == "Magnitude" then return magnitude(t) end
	if k == "Unit" then local m = magnitude(t) return v3(t.X / m, t.Y / m, t.Z / m) end
	return rawget(Vector3, k)
end

local Vector2 = {}
local function v2(x, y) return setmetatable({ X = x or 0, Y = y or 0 }, Vector2) end
Vector2.new = v2
Vector2.__add = function(a, b) return v2(a.X + b.X, a.Y + b.Y) end
Vector2.__sub = function(a, b) return v2(a.X - b.X, a.Y - b.Y) end
Vector2.__mul = function(a, b)
	if type(a) == "number" then a, b = b, a end
	return v2(a.X * b, a.Y * b)
end
Vector2.__index = function(t, k)
	if k == "Magnitude" then return math.sqrt(t.X * t.X + t.Y * t.Y) end
	return rawget(Vector2, k)
end

local Color3 = {}
Color3.__index = Color3
local function c3(r, g, b) return setmetatable({ R = r, G = g, B = b }, Color3) end
Color3.new = c3
function Color3.fromRGB(r, g, b) return c3(r / 255, g / 255, b / 255) end
function Color3.Lerp(a, b, t) return c3(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t) end

local CFrame = {}
CFrame.__index = function(t, k)
	if k == "Position" then return t.p end
	if k == "LookVector" then return t.look end
	return rawget(CFrame, k)
end
local function cf(p, look) return setmetatable({ p = p or v3(), look = look or v3(0, 0, -1) }, CFrame) end
function CFrame.new(a, b, c)
	if type(a) == "number" then return cf(v3(a, b, c)) end
	return cf(a or v3())
end
function CFrame.lookAt(p, target)
	local d = target - p
	assert(d.Magnitude == d.Magnitude, "lookAt: NaN")
	return cf(p, d)
end
function CFrame.Angles() return cf(v3()) end
CFrame.__mul = function(a, b)
	if getmetatable(b) == CFrame then return cf(a.p + b.p, a.look) end
	return a.p + b
end

local UDim = { new = function(s, o) return { Scale = s, Offset = o } end }
local UDim2 = {
	new = function(a, b, c, d) return { X = { Scale = a, Offset = b }, Y = { Scale = c, Offset = d } } end,
	fromOffset = function(x, y) return { X = { Scale = 0, Offset = x }, Y = { Scale = 0, Offset = y } } end,
	fromScale = function(x, y) return { X = { Scale = x, Offset = 0 }, Y = { Scale = y, Offset = 0 } } end,
}

local function enumProxy(path)
	return setmetatable({ Name = path, Value = 1 }, {
		__index = function(t, k)
			local child = enumProxy(path .. "." .. k)
			rawset(t, k, child)
			return child
		end,
		__eq = function(a, b) return rawget(a, "Name") == rawget(b, "Name") end,
	})
end

-- ------------------------------------------------------------ сигналы и инстансы

local function signal()
	local s = { handlers = {} }
	function s:Connect(f)
		table.insert(self.handlers, f)
		return { Disconnect = function() end }
	end
	function s:Fire(...)
		for _, f in ipairs(self.handlers) do
			f(...)
		end
	end
	function s:Wait() end
	return s
end
M.signal = signal

local SIGNALS = {
	Activated = true, OnServerEvent = true, OnClientEvent = true, ChildAdded = true, Heartbeat = true,
	RenderStepped = true, PlayerAdded = true, PlayerRemoving = true, InputBegan = true, InputChanged = true,
	InputEnded = true, TouchStarted = true, TouchMoved = true, TouchEnded = true, Completed = true,
}

local BASES = {
	Part = { "BasePart", "PVInstance" }, MeshPart = { "BasePart", "PVInstance" }, Model = { "PVInstance" },
	TextLabel = { "GuiObject" }, TextButton = { "GuiObject", "GuiButton" }, Frame = { "GuiObject" },
	ScrollingFrame = { "GuiObject" }, Workspace = { "Model" },
}

M.fired = {} -- журнал вызовов удалённых событий
M.renderSteps = {}
M.rayHit = nil

local Methods = {}
local InstanceMT = {}

local function newInstance(className)
	local obj = { __props = { ClassName = className, Name = className }, __children = {}, __attrs = {}, __signals = {} }
	setmetatable(obj, InstanceMT)
	if className == "Camera" then
		obj.__props.ViewportSize = v2(1280, 720)
		obj.__props.FieldOfView = 70
	end
	return obj
end
M.new = newInstance

InstanceMT.__index = function(t, k)
	local m = Methods[k]
	if m then return m end
	local props = rawget(t, "__props")
	local v = props[k]
	if v ~= nil then return v end
	if SIGNALS[k] then
		local s = signal()
		t.__signals[k] = s
		props[k] = s
		return s
	end
	for _, c in ipairs(rawget(t, "__children")) do
		if c.Name == k then return c end
	end
	return nil
end

InstanceMT.__newindex = function(t, k, v)
	local props = rawget(t, "__props")
	if k == "Parent" then
		local old = props.Parent
		if old then
			local list = rawget(old, "__children")
			for i, c in ipairs(list) do
				if c == t then table.remove(list, i) break end
			end
		end
		props.Parent = v
		if v then
			table.insert(rawget(v, "__children"), t)
			local added = rawget(v, "__props").ChildAdded
			if added then added:Fire(t) end
		end
		return
	end
	if type(v) == "number" then
		assert(v == v, "свойство " .. k .. " = NaN")
	end
	props[k] = v
end

InstanceMT.__tostring = function(t) return "Instance<" .. t.ClassName .. ":" .. t.Name .. ">" end

function Methods:FindFirstChild(name, recursive)
	for _, c in ipairs(self.__children) do
		if c.Name == name then return c end
	end
	if recursive then
		for _, c in ipairs(self.__children) do
			local f = c:FindFirstChild(name, true)
			if f then return f end
		end
	end
	return nil
end
function Methods:WaitForChild(name)
	local c = self:FindFirstChild(name)
	assert(c, "WaitForChild бесконечно ждёт " .. tostring(name) .. " в " .. tostring(self))
	return c
end
function Methods:FindFirstChildOfClass(cls)
	for _, c in ipairs(self.__children) do
		if c.ClassName == cls then return c end
	end
end
function Methods:GetChildren() return table.clone(self.__children) end
function Methods:GetDescendants()
	local out = {}
	local function walk(o)
		for _, c in ipairs(o.__children) do
			table.insert(out, c)
			walk(c)
		end
	end
	walk(self)
	return out
end
function Methods:IsA(cls)
	if self.ClassName == cls then return true end
	for _, b in ipairs(BASES[self.ClassName] or {}) do
		if b == cls then return true end
	end
	return false
end
function Methods:Destroy()
	self.Parent = nil
	rawget(self, "__props").Destroyed = true
end
function Methods:Clone()
	local c = newInstance(self.ClassName)
	for k, v in pairs(self.__props) do
		if k ~= "Parent" and not SIGNALS[k] then c.__props[k] = v end
	end
	for k, v in pairs(self.__attrs) do c.__attrs[k] = v end
	for _, ch in ipairs(self.__children) do
		ch:Clone().Parent = c
	end
	return c
end
function Methods:SetAttribute(k, v) self.__attrs[k] = v end
function Methods:GetAttribute(k) return self.__attrs[k] end
function Methods:GetPropertyChangedSignal() return signal() end
function Methods:GetService(name)
	local s = self:FindFirstChild(name)
	assert(s, "нет сервиса " .. name)
	return s
end
function Methods:GetPlayers() return table.clone(M.players) end
function Methods:FireServer(...) table.insert(M.fired, { "FireServer", self.Name, ... }) end
function Methods:FireClient(p, ...) table.insert(M.fired, { "FireClient", self.Name, ... }) end
function Methods:FireAllClients(...) table.insert(M.fired, { "FireAllClients", self.Name, ... }) end
function Methods:GetBoundingBox() return CFrame.new(v3(0, 1, 0)), v3(3, 2, 3) end
function Methods:ScaleTo(s) assert(s == s and s > 0, "ScaleTo: плохой масштаб " .. tostring(s)) self.__props.__scale = s end
function Methods:GetScale() return self.__props.__scale or 1 end
function Methods:PivotTo(c)
	assert(getmetatable(c) == CFrame, "PivotTo ждёт CFrame")
	assert(c.p.X == c.p.X, "PivotTo: NaN")
	self.__props.__pivot = c
end
function Methods:GetPivot() return self.__props.__pivot or CFrame.new() end
function Methods:ScreenPointToRay(x, y) return { Origin = v3(x, 100, y), Direction = v3(0, -1, 0) } end
function Methods:ViewportPointToRay(x, y) return { Origin = v3(x, 100, y), Direction = v3(0, -1, 0) } end
function Methods:Raycast() return M.rayHit end
function Methods:BindToRenderStep(name, prio, fn) M.renderSteps[name] = fn end
function Methods:Create(inst, info, goal) return { Play = function() end, Completed = signal() } end

-- ------------------------------------------------------------ окружение

function M.install(opts)
	local game = newInstance("DataModel")
	local function service(name, cls)
		local s = newInstance(cls or name)
		s.Name = name
		s.Parent = game
		return s
	end
	local workspace = service("Workspace")
	local camera = newInstance("Camera")
	camera.Parent = workspace
	workspace.CurrentCamera = camera
	local players = service("Players")
	local rs = service("ReplicatedStorage")
	service("RunService")
	service("Lighting")
	service("UserInputService")
	service("TweenService")
	M.players = {}
	M.game, M.workspace, M.camera = game, workspace, camera

	local env = {
		game = game, workspace = workspace, Instance = { new = function(cls) return newInstance(cls) end },
		Vector3 = Vector3, Vector2 = Vector2, Color3 = Color3, CFrame = CFrame, UDim = UDim, UDim2 = UDim2,
		Enum = enumProxy("Enum"), TweenInfo = { new = function() return {} end },
		RaycastParams = { new = function() return {} end },
		task = {
			wait = function() return 0 end,
			spawn = function(f, ...) f(...) end,
			delay = function(t, f, ...) table.insert(M.delayed, { t = t, f = f, args = { ... } }) end,
		},
		typeof = function(v)
			local mt = getmetatable(v)
			if mt == InstanceMT then return "Instance" end
			if mt == Vector3 then return "Vector3" end
			return type(v)
		end,
	}
	M.delayed = {}
	return env
end

-- ModuleScript: require по нему грузит исходник с тем же именем из _bundle.luau
function M.module(parent, name)
	local m = newInstance("ModuleScript")
	m.Name = name
	m.Parent = parent
	return m
end

function M.runDelayed()
	local list = M.delayed
	M.delayed = {}
	for _, d in ipairs(list) do
		d.f(table.unpack(d.args))
	end
end

function M.count(remote, method)
	local c = 0
	for _, f in ipairs(M.fired) do
		if f[2] == remote and (not method or f[1] == method) then c += 1 end
	end
	return c
end

return M
