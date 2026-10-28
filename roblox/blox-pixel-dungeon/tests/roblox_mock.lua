-- Упрощённая имитация Roblox API для прогона клиентского кода вне Studio.
-- Свойства не проверяются на допустимость, но вызовы методов, события и require работают.
local mock = {}

local now = 0
os.clock = function() return now end
os.time = function() return 1700000000 + math.floor(now) end
function mock.advance(dt) now = now + dt end

math.clamp = function(x, a, b) if x < a then return a elseif x > b then return b end return x end
warn = function(...) print('[warn]', ...) end

------------------------------------------------------------------ события
local function newSignal()
  local s = { fns = {} }
  function s:Connect(fn)
    local entry = { fn = fn }
    table.insert(self.fns, entry)
    return { Disconnect = function() entry.dead = true end, Connected = true }
  end
  function s:Fire(...)
    local list = {}
    for _, e in ipairs(self.fns) do list[#list + 1] = e end
    for _, e in ipairs(list) do
      if not e.dead then e.fn(...) end
    end
  end
  function s:Wait() return nil end
  return s
end
mock.newSignal = newSignal

------------------------------------------------------------------ типы данных
local V2 = {}
V2.__index = function(v, k)
  if k == 'Magnitude' then return math.sqrt(v.X * v.X + v.Y * v.Y) end
  return nil
end
local function vec2(x, y) return setmetatable({ X = x or 0, Y = y or 0 }, V2) end
V2.__add = function(a, b) return vec2(a.X + b.X, a.Y + b.Y) end
V2.__sub = function(a, b) return vec2(a.X - b.X, a.Y - b.Y) end
V2.__mul = function(a, b)
  if type(a) == 'number' then return vec2(a * b.X, a * b.Y) end
  if type(b) == 'number' then return vec2(a.X * b, a.Y * b) end
  return vec2(a.X * b.X, a.Y * b.Y)
end
V2.__div = function(a, b)
  if type(b) == 'number' then return vec2(a.X / b, a.Y / b) end
  return vec2(a.X / b.X, a.Y / b.Y)
end
V2.__eq = function(a, b) return a.X == b.X and a.Y == b.Y end
Vector2 = { new = vec2, zero = vec2(0, 0), one = vec2(1, 1) }

local function udim(s, o) return { Scale = s or 0, Offset = o or 0 } end
UDim = { new = udim }
UDim2 = {
  new = function(sx, ox, sy, oy) return { X = udim(sx, ox), Y = udim(sy, oy), _udim2 = true } end,
  fromOffset = function(x, y) return { X = udim(0, x), Y = udim(0, y), _udim2 = true } end,
  fromScale = function(x, y) return { X = udim(x, 0), Y = udim(y, 0), _udim2 = true } end,
}
local function col(r, g, b) return { R = r or 0, G = g or 0, B = b or 0, _color = true } end
Color3 = { new = col, fromRGB = function(r, g, b) return col(r / 255, g / 255, b / 255) end }
Content = { fromObject = function(o) return { object = o } end }
Font = { new = function(...) return { ... } end }

local enumCache = {}
Enum = setmetatable({}, { __index = function(_, typ)
  enumCache[typ] = enumCache[typ] or setmetatable({}, { __index = function(t, name)
    local item = { Name = name, EnumType = typ }
    rawset(t, name, item)
    return item
  end })
  return enumCache[typ]
end })

------------------------------------------------------------------ объекты
local Inst = {}
local methods = {}
local EVENTS = {
  Activated = true, MouseButton1Down = true, MouseButton1Up = true, MouseButton1Click = true,
  Destroying = true, Changed = true, OnServerEvent = true, OnClientEvent = true, FocusLost = true,
}
mock.created = 0

function methods:FindFirstChild(name)
  for _, c in ipairs(rawget(self, '_children')) do
    if c.Name == name then return c end
  end
  return nil
end
function methods:WaitForChild(name)
  local c = self:FindFirstChild(name)
  if not c then error('WaitForChild: нет ' .. tostring(name) .. ' в ' .. tostring(self.Name), 2) end
  return c
end
function methods:GetChildren()
  local t = {}
  for _, c in ipairs(rawget(self, '_children')) do t[#t + 1] = c end
  return t
end
function methods:GetDescendants()
  local t = {}
  local function walk(o)
    for _, c in ipairs(rawget(o, '_children')) do t[#t + 1] = c; walk(c) end
  end
  walk(self)
  return t
end
function methods:IsA(class) return self.ClassName == class end
function methods:Destroy()
  if rawget(self, '_destroyed') then return end
  rawset(self, '_destroyed', true)
  self.Destroying:Fire()
  for _, c in ipairs(self:GetChildren()) do c:Destroy() end
  self.Parent = nil
end
function methods:SetAttribute(k, v) rawget(self, '_attrs')[k] = v end
function methods:GetAttribute(k) return rawget(self, '_attrs')[k] end
function methods:GetService(name)
  local s = self:FindFirstChild(name)
  if not s then error('нет сервиса ' .. name, 2) end
  return s
end
function methods:FireServer(...) mock.reports = (mock.reports or 0) + 1 end
function methods:GetPropertyChangedSignal(name)
  local props = rawget(self, '_props')
  local key = '_changed_' .. name
  props[key] = props[key] or newSignal()
  return props[key]
end
function methods:SetCoreGuiEnabled() end
function methods:GetGuiInset() return vec2(0, 36), vec2(0, 0) end
function methods:CreateEditableImage(opts)
  local img = Instance.new('EditableImage')
  img.Size = opts.Size
  return img
end
function methods:WritePixelsBuffer(pos, size, buf) end
function methods:BindToClose() end
function methods:GetPlayers() return {} end

Inst.__index = function(self, k)
  local m = methods[k]
  if m then return m end
  local props = rawget(self, '_props')
  local v = props[k]
  if v ~= nil then return v end
  if EVENTS[k] then
    local s = newSignal()
    props[k] = s
    return s
  end
  if k == 'AbsoluteSize' then return vec2(1280, 720) end
  if k == 'AbsolutePosition' then return vec2(0, 0) end
  local c = self:FindFirstChild(k)
  if c then return c end
  return nil
end
Inst.__newindex = function(self, k, v)
  if k == 'Parent' then
    local old = rawget(self, '_parent')
    if old then
      local list = rawget(old, '_children')
      for i, c in ipairs(list) do if c == self then table.remove(list, i) break end end
    end
    rawset(self, '_parent', v)
    if v then table.insert(rawget(v, '_children'), self) end
    return
  end
  if type(v) == 'table' and v._udim2 == nil and (k == 'Size' or k == 'Position') and v.X == nil then
    error('ожидался UDim2 для ' .. k, 2)
  end
  rawget(self, '_props')[k] = v
end
Inst.__tostring = function(self) return self.ClassName .. ':' .. tostring(self.Name) end

local function newInstance(class, name)
  mock.created = mock.created + 1
  local o = setmetatable({ _children = {}, _props = { ClassName = class, Name = name or class }, _attrs = {} }, Inst)
  return o
end
-- Parent читается отдельно
local baseIndex = Inst.__index
Inst.__index = function(self, k)
  if k == 'Parent' then return rawget(self, '_parent') end
  return baseIndex(self, k)
end

Instance = { new = function(class, parent)
  local o = newInstance(class)
  if parent then o.Parent = parent end
  return o
end }

------------------------------------------------------------------ дерево игры
game = newInstance('DataModel', 'Game')
local function service(name)
  local s = newInstance(name, name)
  s.Parent = game
  return s
end
local Players = service('Players')
local ReplicatedStorage = service('ReplicatedStorage')
local RunService = service('RunService')
local UIS = service('UserInputService')
service('GuiService')
service('StarterGui')
service('AssetService')
service('DataStoreService')
RunService.RenderStepped = newSignal()
RunService.Heartbeat = newSignal()
UIS.InputBegan = newSignal()
UIS.InputEnded = newSignal()
UIS.InputChanged = newSignal()

local player = newInstance('Player', 'Tester')
player.UserId = 12345
player.Parent = Players
Players.LocalPlayer = player
local playerGui = newInstance('PlayerGui', 'PlayerGui')
playerGui.Parent = player
local remote = newInstance('RemoteEvent', 'BPDReport')
remote.Parent = ReplicatedStorage

------------------------------------------------------------------ task, require
local timers = {}
task = {
  wait = function() return 0 end,
  delay = function(t, fn, ...) table.insert(timers, { at = now + t, fn = fn, args = { ... } }) end,
  spawn = function(fn, ...) fn(...) end,
  defer = function(fn, ...) table.insert(timers, { at = now, fn = fn, args = { ... } }) end,
}
function mock.runTimers()
  local due = {}
  for i = #timers, 1, -1 do
    if timers[i].at <= now then due[#due + 1] = table.remove(timers, i) end
  end
  for i = #due, 1, -1 do due[i].fn(table.unpack(due[i].args)) end
end

local cache = {}
local realRequire = require
require = function(m)
  if type(m) == 'table' and rawget(m, '_props') then
    if cache[m] == nil then
      local src = m.Source
      local fn, err = load(src, '@' .. m.Name, 't', setmetatable({ script = m }, { __index = _G }))
      if not fn then error(err) end
      cache[m] = fn()
    end
    return cache[m]
  end
  return realRequire(m)
end

-- собрать дерево из файлов: { name, class, source?, children }
function mock.build(parent, node)
  local o = newInstance(node.class, node.name)
  if node.source then o.Source = node.source end
  o.Parent = parent
  for _, c in ipairs(node.children or {}) do mock.build(o, c) end
  return o
end

function mock.runScript(inst)
  local fn, err = load(inst.Source, '@' .. inst.Name, 't', setmetatable({ script = inst }, { __index = _G }))
  if not fn then error(err) end
  fn()
end

mock.player, mock.playerGui, mock.RunService, mock.UIS, mock.ReplicatedStorage = player, playerGui, RunService, UIS, ReplicatedStorage
mock.vec2 = vec2
return mock
