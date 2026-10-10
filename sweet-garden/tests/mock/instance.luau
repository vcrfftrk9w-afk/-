-- Mock Roblox Instances for offline tests. Property, event and method names are
-- validated against the real Roblox API dump, so typos fail loudly like in Roblox.

local API = require("../build/api")
local Types = require("./types")
local Sched = require("./sched")

local Signal = Sched.Signal
local typeof = Types.typeof
local Vector3 = Types.Vector3
local Vector2 = Types.Vector2
local CFrame = Types.CFrame
local Color3 = Types.Color3

local Inst = {}
Inst.screenSize = Vector2.new(844, 390)

type State = {
	className: string,
	name: string,
	parent: any,
	children: { any },
	props: { [string]: any },
	attrs: { [string]: any },
	tags: { [string]: boolean },
	signals: { [string]: any },
	propSignals: { [string]: any },
	attrSignals: { [string]: any },
	destroyed: boolean,
	extra: { [string]: any },
}

local states: { [any]: State } = setmetatable({}, { __mode = "k" }) :: any
Inst.states = states

local InstanceMT = { __type = "Instance" }

-- методы, реализованные для конкретных классов (и их наследников)
local classMethods: { [string]: { [string]: (...any) -> ...any } } = {}
Inst.classMethods = classMethods

-- реестр тегов CollectionService
local tagged: { [string]: { [any]: boolean } } = {}
local tagAdded: { [string]: any } = {}
local tagRemoved: { [string]: any } = {}
Inst.tagged = tagged

local unimplemented: { [string]: boolean } = {}
Inst.unimplemented = unimplemented

---------------------------------------------------------------------
-- API helpers
---------------------------------------------------------------------

local function isA(className: string, target: string): boolean
	local current: string? = className
	while current do
		if current == target then
			return true
		end
		local info = API.classes[current]
		current = info and info.s
	end
	return false
end
Inst.classIsA = isA

local function memberInfo(className: string, name: string): (string?, any)
	local current: string? = className
	while current do
		local info = API.classes[current]
		if not info then
			return nil, nil
		end
		local prop = info.p[name]
		if prop then
			return "p", prop
		end
		local event = info.e[name]
		if event ~= nil then
			return "e", event
		end
		local fn = info.f[name]
		if fn ~= nil then
			return "f", fn
		end
		current = info.s
	end
	return nil, nil
end
Inst.memberInfo = memberInfo

local function fullName(proxy): string
	local st = states[proxy]
	if not st then
		return "?"
	end
	local parts = {}
	local current = proxy
	while current do
		local s = states[current]
		if not s or s.className == "DataModel" then
			break
		end
		table.insert(parts, 1, s.name)
		current = s.parent
	end
	return table.concat(parts, ".")
end
Inst.fullName = fullName

local function fail(message: string): never
	error(message, 3)
end

local function defaultFor(prop)
	local d = prop.d
	if d ~= nil then
		if type(d) == "table" then
			if d.enum then
				local enumName = string.match(prop.t, "^Enum:(.+)$")
				if enumName and API.enums[enumName] and API.enums[enumName][d.enum] ~= nil then
					return Types.enumItem(enumName, d.enum)
				end
				return enumName and Types.firstEnumItem(enumName) or nil
			elseif d.Vector3 then
				return Vector3.new(d.Vector3[1], d.Vector3[2], d.Vector3[3])
			elseif d.Vector2 then
				return Vector2.new(d.Vector2[1], d.Vector2[2])
			elseif d.Color3 then
				return Color3.new(d.Color3[1], d.Color3[2], d.Color3[3])
			end
			return nil
		end
		return d
	end
	local t = prop.t
	if t == "Primitive:bool" then
		return false
	elseif t == "Primitive:float" or t == "Primitive:double" or t == "Primitive:int" or t == "Primitive:int64" then
		return 0
	elseif t == "Primitive:string" or t == "DataType:Content" or t == "DataType:ContentId" then
		return ""
	elseif t == "DataType:Vector3" then
		return Vector3.zero
	elseif t == "DataType:Vector2" then
		return Vector2.zero
	elseif t == "DataType:CFrame" then
		return CFrame.new()
	elseif t == "DataType:Color3" then
		return Color3.new(1, 1, 1)
	elseif t == "DataType:UDim2" then
		return Types.UDim2.new()
	elseif t == "DataType:UDim" then
		return Types.UDim.new()
	elseif t == "DataType:NumberRange" then
		return Types.NumberRange.new(0)
	elseif t == "DataType:NumberSequence" then
		return Types.NumberSequence.new(0)
	elseif t == "DataType:ColorSequence" then
		return Types.ColorSequence.new(Color3.new(1, 1, 1))
	end
	local enumName = string.match(t, "^Enum:(.+)$")
	if enumName then
		return Types.firstEnumItem(enumName)
	end
	return nil
end

local PRIMITIVES = {
	["Primitive:bool"] = "boolean",
	["Primitive:float"] = "number",
	["Primitive:double"] = "number",
	["Primitive:int"] = "number",
	["Primitive:int64"] = "number",
	["Primitive:string"] = "string",
}

local function checkValue(className: string, name: string, prop, value: any)
	local t = prop.t
	if t == "Callback" then
		if value ~= nil and type(value) ~= "function" then
			fail(className .. "." .. name .. " must be a function")
		end
		return
	end
	if value == nil then
		if string.sub(t, 1, 6) == "Class:" then
			return
		end
		fail("Cannot set " .. className .. "." .. name .. " to nil")
	end
	local primitive = PRIMITIVES[t]
	if primitive then
		if type(value) ~= primitive and not (primitive == "string" and type(value) == "number") then
			fail(className .. "." .. name .. " expects " .. primitive .. ", got " .. typeof(value))
		end
		if primitive == "number" and value ~= value then
			fail(className .. "." .. name .. " was set to NaN")
		end
		return
	end
	local category, typeNameValue = string.match(t, "^(%w+):(.+)$")
	if category == "Enum" then
		if typeof(value) == "EnumItem" then
			if value.EnumType ~= typeNameValue then
				fail(className .. "." .. name .. " expects Enum." .. tostring(typeNameValue) .. ", got Enum." .. value.EnumType)
			end
		elseif type(value) ~= "number" and type(value) ~= "string" then
			fail(className .. "." .. name .. " expects an EnumItem, got " .. typeof(value))
		end
	elseif category == "DataType" then
		local actual = typeof(value)
		if typeNameValue == "Content" or typeNameValue == "ContentId" then
			if type(value) ~= "string" then
				fail(className .. "." .. name .. " expects a string, got " .. actual)
			end
		elseif actual ~= typeNameValue then
			fail(className .. "." .. name .. " expects " .. tostring(typeNameValue) .. ", got " .. actual)
		end
	elseif category == "Class" then
		if typeof(value) ~= "Instance" then
			fail(className .. "." .. name .. " expects an Instance, got " .. typeof(value))
		end
		if typeNameValue ~= "Instance" and not isA(states[value].className, typeNameValue) then
			fail(className .. "." .. name .. " expects " .. tostring(typeNameValue) .. ", got " .. states[value].className)
		end
	end
end

---------------------------------------------------------------------
-- Signals
---------------------------------------------------------------------

local function signalOf(proxy, name: string)
	local st = states[proxy]
	local signal = st.signals[name]
	if not signal then
		signal = Signal.new(name)
		if st.destroyed then
			signal:Destroy()
		end
		st.signals[name] = signal
	end
	return signal
end
Inst.signalOf = signalOf

local function fire(proxy, name: string, ...)
	local st = states[proxy]
	local signal = st and st.signals[name]
	if signal then
		signal:Fire(...)
	end
end
Inst.fire = fire

local function propChanged(proxy, name: string)
	local st = states[proxy]
	local signal = st.propSignals[name]
	if signal then
		signal:Fire()
	end
	fire(proxy, "Changed", name)
end

---------------------------------------------------------------------
-- Иерархия
---------------------------------------------------------------------

local function isDescendantOf(proxy, ancestor): boolean
	local current = states[proxy] and states[proxy].parent
	while current do
		if current == ancestor then
			return true
		end
		current = states[current] and states[current].parent
	end
	return false
end

local function descendants(proxy, out)
	for _, child in ipairs(states[proxy].children) do
		table.insert(out, child)
		descendants(child, out)
	end
	return out
end

local function setParent(proxy, newParent)
	local st = states[proxy]
	if st.destroyed and newParent ~= nil then
		fail("The Parent property of " .. st.name .. " is locked, current parent: NULL, new parent " .. (newParent and states[newParent].name or "NULL"))
	end
	local old = st.parent
	if old == newParent then
		return
	end
	if newParent ~= nil then
		if typeof(newParent) ~= "Instance" then
			fail("Parent must be an Instance")
		end
		if newParent == proxy or isDescendantOf(newParent, proxy) then
			fail("Attempt to set " .. st.name .. " as its own parent")
		end
		if states[newParent].destroyed then
			fail("Cannot parent " .. st.name .. " to a destroyed instance")
		end
	end
	if old then
		local siblings = states[old].children
		local index = table.find(siblings, proxy)
		if index then
			table.remove(siblings, index)
		end
		fire(old, "ChildRemoved", proxy)
	end
	st.parent = newParent
	if newParent then
		table.insert(states[newParent].children, proxy)
		fire(newParent, "ChildAdded", proxy)
		local ancestor = newParent
		local added = descendants(proxy, { proxy })
		while ancestor do
			for _, item in ipairs(added) do
				fire(ancestor, "DescendantAdded", item)
			end
			ancestor = states[ancestor].parent
		end
	end
	fire(proxy, "AncestryChanged", proxy, newParent)
	propChanged(proxy, "Parent")
end

local function findChild(proxy, name: string)
	for _, child in ipairs(states[proxy].children) do
		if states[child].name == name then
			return child
		end
	end
	return nil
end

local function destroy(proxy)
	local st = states[proxy]
	if st.destroyed then
		return
	end
	fire(proxy, "Destroying")
	for _, child in ipairs(table.clone(st.children)) do
		destroy(child)
	end
	if st.parent then
		setParent(proxy, nil)
	end
	st.destroyed = true
	for tag in pairs(st.tags) do
		if tagged[tag] then
			tagged[tag][proxy] = nil
		end
	end
	for _, signal in pairs(st.signals) do
		signal:Destroy()
	end
	for _, signal in pairs(st.propSignals) do
		signal:Destroy()
	end
	for _, signal in pairs(st.attrSignals) do
		signal:Destroy()
	end
end
Inst.destroy = destroy

---------------------------------------------------------------------
-- Создание
---------------------------------------------------------------------

local function make(className: string)
	local proxy = setmetatable({}, InstanceMT)
	states[proxy] = {
		className = className,
		name = className,
		parent = nil,
		children = {},
		props = {},
		attrs = {},
		tags = {},
		signals = {},
		propSignals = {},
		attrSignals = {},
		destroyed = false,
		extra = {},
	}
	return proxy
end
Inst.make = make

function Inst.new(className: string, parent: any?)
	if type(className) ~= "string" then
		error("Instance.new expects a class name", 2)
	end
	local info = API.classes[className]
	if not info then
		error("Unable to create an Instance of type \"" .. className .. "\"", 2)
	end
	if info.nc or info.svc then
		error("Unable to create an Instance of type \"" .. className .. "\" (not creatable)", 2)
	end
	local proxy = make(className)
	if parent ~= nil then
		setParent(proxy, parent)
	end
	return proxy
end

---------------------------------------------------------------------
-- Атрибуты и теги
---------------------------------------------------------------------

local ATTRIBUTE_TYPES = {
	string = true, boolean = true, number = true, Vector3 = true, Vector2 = true, Color3 = true,
	CFrame = true, UDim = true, UDim2 = true, NumberRange = true, NumberSequence = true, ColorSequence = true,
	EnumItem = true, BrickColor = true, Rect = true, Font = true,
}

local function addTag(proxy, tag: string)
	local st = states[proxy]
	if st.tags[tag] then
		return
	end
	st.tags[tag] = true
	tagged[tag] = tagged[tag] or {}
	tagged[tag][proxy] = true
	if tagAdded[tag] then
		tagAdded[tag]:Fire(proxy)
	end
end

local function removeTag(proxy, tag: string)
	local st = states[proxy]
	if not st.tags[tag] then
		return
	end
	st.tags[tag] = nil
	if tagged[tag] then
		tagged[tag][proxy] = nil
	end
	if tagRemoved[tag] then
		tagRemoved[tag]:Fire(proxy)
	end
end

function Inst.tagSignal(tag: string, removed: boolean)
	local map = removed and tagRemoved or tagAdded
	map[tag] = map[tag] or Signal.new("Tag:" .. tag)
	return map[tag]
end
Inst.addTag = addTag
Inst.removeTag = removeTag

---------------------------------------------------------------------
-- Общие методы всех Instance
---------------------------------------------------------------------

local METHODS = {}

function METHODS.FindFirstChild(self, name: string, recursive: boolean?)
	if type(name) ~= "string" then
		fail("FindFirstChild expects a string")
	end
	local child = findChild(self, name)
	if child or not recursive then
		return child
	end
	for _, item in ipairs(descendants(self, {})) do
		if states[item].name == name then
			return item
		end
	end
	return nil
end

function METHODS.FindFirstChildOfClass(self, className: string)
	for _, child in ipairs(states[self].children) do
		if states[child].className == className then
			return child
		end
	end
	return nil
end

function METHODS.FindFirstChildWhichIsA(self, className: string, recursive: boolean?)
	local list = recursive and descendants(self, {}) or states[self].children
	for _, child in ipairs(list) do
		if isA(states[child].className, className) then
			return child
		end
	end
	return nil
end

function METHODS.FindFirstAncestor(self, name: string)
	local current = states[self].parent
	while current do
		if states[current].name == name then
			return current
		end
		current = states[current].parent
	end
	return nil
end

function METHODS.FindFirstAncestorOfClass(self, className: string)
	local current = states[self].parent
	while current do
		if states[current].className == className then
			return current
		end
		current = states[current].parent
	end
	return nil
end

function METHODS.FindFirstAncestorWhichIsA(self, className: string)
	local current = states[self].parent
	while current do
		if isA(states[current].className, className) then
			return current
		end
		current = states[current].parent
	end
	return nil
end

function METHODS.WaitForChild(self, name: string, timeout: number?)
	local child = findChild(self, name)
	if child then
		return child
	end
	if not coroutine.isyieldable() then
		fail("WaitForChild(" .. name .. ") on " .. fullName(self) .. " cannot yield here")
	end
	local start = Sched.now
	local warned = false
	while true do
		Sched.wait(0.05)
		child = findChild(self, name)
		if child then
			return child
		end
		if timeout and Sched.now - start >= timeout then
			return nil
		end
		if not timeout and not warned and Sched.now - start > 5 then
			warned = true
			print("WARNING: Infinite yield possible on " .. fullName(self) .. ":WaitForChild(\"" .. name .. "\")")
		end
	end
end

function METHODS.GetChildren(self)
	return table.clone(states[self].children)
end

function METHODS.GetDescendants(self)
	return descendants(self, {})
end

function METHODS.IsA(self, className: string)
	return isA(states[self].className, className)
end

function METHODS.IsDescendantOf(self, ancestor)
	return isDescendantOf(self, ancestor)
end

function METHODS.IsAncestorOf(self, descendant)
	return isDescendantOf(descendant, self)
end

function METHODS.Destroy(self)
	destroy(self)
end

function METHODS.ClearAllChildren(self)
	for _, child in ipairs(table.clone(states[self].children)) do
		destroy(child)
	end
end

local function clone(proxy)
	local st = states[proxy]
	local copy = make(st.className)
	local cs = states[copy]
	cs.name = st.name
	for key, value in pairs(st.props) do
		cs.props[key] = value
	end
	for key, value in pairs(st.attrs) do
		cs.attrs[key] = value
	end
	for tag in pairs(st.tags) do
		addTag(copy, tag)
	end
	for _, child in ipairs(st.children) do
		setParent(clone(child), copy)
	end
	return copy
end

function METHODS.Clone(self)
	return clone(self)
end

function METHODS.GetAttribute(self, name: string)
	if type(name) ~= "string" then
		fail("GetAttribute expects a string")
	end
	return states[self].attrs[name]
end

function METHODS.SetAttribute(self, name: string, value: any)
	if type(name) ~= "string" then
		fail("SetAttribute expects a string name")
	end
	if value ~= nil and not ATTRIBUTE_TYPES[typeof(value)] then
		fail("SetAttribute: type " .. typeof(value) .. " is not supported (attribute " .. name .. ")")
	end
	if type(value) == "number" and value ~= value then
		fail("SetAttribute: NaN for attribute " .. name)
	end
	local st = states[self]
	if st.attrs[name] == value then
		return
	end
	st.attrs[name] = value
	local signal = st.attrSignals[name]
	if signal then
		signal:Fire()
	end
	fire(self, "AttributeChanged", name)
end

function METHODS.GetAttributes(self)
	return table.clone(states[self].attrs)
end

function METHODS.GetAttributeChangedSignal(self, name: string)
	local st = states[self]
	st.attrSignals[name] = st.attrSignals[name] or Signal.new("Attr:" .. name)
	return st.attrSignals[name]
end

function METHODS.GetPropertyChangedSignal(self, name: string)
	local st = states[self]
	local kind = memberInfo(st.className, name)
	if kind ~= "p" and name ~= "Name" and name ~= "Parent" then
		fail(name .. " is not a valid property name of " .. st.className)
	end
	st.propSignals[name] = st.propSignals[name] or Signal.new("Prop:" .. name)
	return st.propSignals[name]
end

function METHODS.GetFullName(self)
	return fullName(self)
end

function METHODS.AddTag(self, tag: string)
	addTag(self, tag)
end

function METHODS.RemoveTag(self, tag: string)
	removeTag(self, tag)
end

function METHODS.HasTag(self, tag: string)
	return states[self].tags[tag] == true
end

function METHODS.GetTags(self)
	local list = {}
	for tag in pairs(states[self].tags) do
		table.insert(list, tag)
	end
	return list
end

local function pivotOf(proxy)
	local st = states[proxy]
	if isA(st.className, "BasePart") then
		return (proxy :: any).CFrame
	end
	local primary = st.props.PrimaryPart
	if primary then
		return primary.CFrame
	end
	for _, item in ipairs(descendants(proxy, {})) do
		if isA(states[item].className, "BasePart") then
			return item.CFrame
		end
	end
	return CFrame.new()
end

function METHODS.GetPivot(self)
	return pivotOf(self)
end

function METHODS.PivotTo(self, target)
	if typeof(target) ~= "CFrame" then
		fail("PivotTo expects a CFrame")
	end
	local st = states[self]
	local current = pivotOf(self)
	local delta = target * current:Inverse()
	if isA(st.className, "BasePart") then
		self.CFrame = target
	end
	for _, item in ipairs(descendants(self, {})) do
		if isA(states[item].className, "BasePart") then
			item.CFrame = delta * item.CFrame
		end
	end
end

---------------------------------------------------------------------
-- Метатаблица прокси
---------------------------------------------------------------------

local function findClassMethod(className: string, name: string)
	local current: string? = className
	while current do
		local methods = classMethods[current]
		if methods and methods[name] then
			return methods[name]
		end
		local info = API.classes[current]
		current = info and info.s
	end
	return nil
end

local function readProperty(proxy, st: State, name: string, prop)
	if prop.x then
		fail("The current thread cannot access '" .. name .. "' (lacking capability)")
	end
	-- вычисляемые свойства
	if name == "Position" and isA(st.className, "BasePart") then
		local cframe = st.props.CFrame or CFrame.new()
		return cframe.Position
	elseif name == "Orientation" and isA(st.className, "BasePart") then
		return Vector3.zero
	elseif name == "AbsoluteSize" then
		if st.className == "ScreenGui" then
			return Inst.screenSize
		end
		return st.extra.absoluteSize or Vector2.new(100, 40)
	elseif name == "AbsolutePosition" then
		return Vector2.zero
	elseif name == "WorldPosition" and st.className == "Attachment" then
		local parent = st.parent
		local position = st.props.Position or Vector3.zero
		if parent and isA(states[parent].className, "BasePart") then
			return parent.CFrame * position
		end
		return position
	end
	local value = st.props[name]
	if value == nil and not (string.sub(prop.t, 1, 6) == "Class:") and prop.t ~= "Callback" then
		value = defaultFor(prop)
		if st.className == "Part" and name == "Size" then
			value = Vector3.new(4, 1, 2)
		elseif name == "Color" and isA(st.className, "BasePart") then
			value = Color3.fromRGB(163, 162, 165)
		end
	end
	return value
end

InstanceMT.__index = function(proxy, key)
	local st = states[proxy]
	if type(key) ~= "string" then
		fail("Invalid index on Instance: " .. tostring(key))
	end
	if key == "Name" then
		return st.name
	elseif key == "Parent" then
		return st.parent
	elseif key == "ClassName" then
		return st.className
	end
	local classMethod = findClassMethod(st.className, key)
	if classMethod then
		return classMethod
	end
	local kind, info = memberInfo(st.className, key)
	if kind == "p" then
		return readProperty(proxy, st, key, info)
	elseif kind == "e" then
		if info == false then
			fail("The current thread cannot access '" .. key .. "' (lacking capability)")
		end
		return signalOf(proxy, key)
	elseif kind == "f" then
		if info == false then
			fail("The current thread cannot call '" .. key .. "' (lacking capability)")
		end
		local method = METHODS[key]
		if method then
			return method
		end
		unimplemented[st.className .. ":" .. key] = true
		fail("[mock] " .. st.className .. ":" .. key .. " is not implemented in the test mock")
	end
	local child = findChild(proxy, key)
	if child then
		return child
	end
	fail(key .. " is not a valid member of " .. st.className .. " \"" .. fullName(proxy) .. "\"")
end

InstanceMT.__newindex = function(proxy, key, value)
	local st = states[proxy]
	if key == "Name" then
		if type(value) ~= "string" then
			fail("Name must be a string")
		end
		st.name = value
		propChanged(proxy, "Name")
		return
	elseif key == "Parent" then
		setParent(proxy, value)
		return
	end
	local kind, info = memberInfo(st.className, key)
	if kind ~= "p" then
		fail(tostring(key) .. " is not a valid member of " .. st.className .. " \"" .. fullName(proxy) .. "\"")
	end
	if info.x then
		fail("The current thread cannot write '" .. key .. "' (lacking capability)")
	end
	if info.ro and not st.extra.allowWrite then
		fail("Unable to assign property " .. key .. ". Property is read only")
	end
	checkValue(st.className, key, info, value)
	if key == "Position" and isA(st.className, "BasePart") then
		local cframe = st.props.CFrame or CFrame.new()
		st.props.CFrame = cframe.Rotation + value
		propChanged(proxy, "Position")
		propChanged(proxy, "CFrame")
		return
	end
	if key == "Shape" and st.className == "Part" and typeof(value) == "EnumItem" and value.Name == "Ball" then
		-- шар в Roblox всегда круглый
		local size = st.props.Size or Vector3.new(4, 1, 2)
		local m = math.min(size.X, size.Y, size.Z)
		st.props.Size = Vector3.new(m, m, m)
	end
	if key == "Size" and st.className == "Part" then
		local shape = st.props.Shape
		if shape and shape.Name == "Ball" then
			local m = math.min(value.X, value.Y, value.Z)
			value = Vector3.new(m, m, m)
		end
	end
	if st.props[key] == value then
		st.props[key] = value
		return
	end
	st.props[key] = value
	propChanged(proxy, key)
end

InstanceMT.__tostring = function(proxy)
	return states[proxy].name
end

-- Для тестов: прочитать/записать свойство в обход проверок
function Inst.rawSet(proxy, key: string, value: any)
	states[proxy].props[key] = value
end
function Inst.rawGet(proxy, key: string)
	return states[proxy].props[key]
end
function Inst.isInstance(value: any): boolean
	return typeof(value) == "Instance"
end

return Inst
