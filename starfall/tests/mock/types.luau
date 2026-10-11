-- Mock Roblox datatypes for offline tests: Vector3, Vector2, CFrame, Color3, UDim, UDim2,
-- NumberRange, NumberSequence, ColorSequence, TweenInfo, Random, Enum, typeof.

local API = require("../build/api")

local Types = {}

local function fail(message: string): never
	error(message, 3)
end

local function typeName(value: any): string
	local t = type(value)
	if t == "table" then
		local mt = getmetatable(value)
		if type(mt) == "table" and mt.__type then
			return mt.__type
		end
	end
	return t
end
Types.typeof = typeName

local function num(value: any, what: string): number
	if type(value) ~= "number" then
		fail(what .. " expects a number, got " .. typeName(value))
	end
	return value
end

---------------------------------------------------------------------
-- Vector3
---------------------------------------------------------------------

local Vector3 = {}
local V3 = { __type = "Vector3" }
local V3methods = {}

local function v3(x: number, y: number, z: number)
	return setmetatable({ _x = x, _y = y, _z = z }, V3)
end

function Vector3.new(x: number?, y: number?, z: number?)
	return v3(num(x or 0, "Vector3.new"), num(y or 0, "Vector3.new"), num(z or 0, "Vector3.new"))
end
Vector3.zero = v3(0, 0, 0)
Vector3.one = v3(1, 1, 1)
Vector3.xAxis = v3(1, 0, 0)
Vector3.yAxis = v3(0, 1, 0)
Vector3.zAxis = v3(0, 0, 1)

V3.__index = function(v, key)
	if key == "X" then
		return v._x
	elseif key == "Y" then
		return v._y
	elseif key == "Z" then
		return v._z
	elseif key == "Magnitude" then
		return math.sqrt(v._x * v._x + v._y * v._y + v._z * v._z)
	elseif key == "Unit" then
		local m = math.sqrt(v._x * v._x + v._y * v._y + v._z * v._z)
		if m == 0 then
			return v3(0 / 0, 0 / 0, 0 / 0)
		end
		return v3(v._x / m, v._y / m, v._z / m)
	end
	local method = V3methods[key]
	if method then
		return method
	end
	fail(tostring(key) .. " is not a valid member of Vector3")
end
V3.__newindex = function()
	fail("Vector3 is read-only")
end
V3.__add = function(a, b)
	if typeName(a) ~= "Vector3" or typeName(b) ~= "Vector3" then
		fail("attempt to add Vector3 and " .. typeName(typeName(a) == "Vector3" and b or a))
	end
	return v3(a._x + b._x, a._y + b._y, a._z + b._z)
end
V3.__sub = function(a, b)
	if typeName(a) ~= "Vector3" or typeName(b) ~= "Vector3" then
		fail("attempt to subtract Vector3 and " .. typeName(typeName(a) == "Vector3" and b or a))
	end
	return v3(a._x - b._x, a._y - b._y, a._z - b._z)
end
V3.__mul = function(a, b)
	if type(a) == "number" then
		return v3(a * b._x, a * b._y, a * b._z)
	elseif type(b) == "number" then
		return v3(a._x * b, a._y * b, a._z * b)
	elseif typeName(a) == "Vector3" and typeName(b) == "Vector3" then
		return v3(a._x * b._x, a._y * b._y, a._z * b._z)
	end
	fail("attempt to multiply Vector3 with " .. typeName(b))
end
V3.__div = function(a, b)
	if type(b) == "number" then
		return v3(a._x / b, a._y / b, a._z / b)
	elseif typeName(b) == "Vector3" then
		return v3(a._x / b._x, a._y / b._y, a._z / b._z)
	end
	fail("attempt to divide Vector3 by " .. typeName(b))
end
V3.__unm = function(a)
	return v3(-a._x, -a._y, -a._z)
end
V3.__eq = function(a, b)
	return a._x == b._x and a._y == b._y and a._z == b._z
end
V3.__tostring = function(v)
	return string.format("%g, %g, %g", v._x, v._y, v._z)
end
function V3methods.Lerp(a, b, t)
	return v3(a._x + (b._x - a._x) * t, a._y + (b._y - a._y) * t, a._z + (b._z - a._z) * t)
end
function V3methods.Dot(a, b)
	return a._x * b._x + a._y * b._y + a._z * b._z
end
function V3methods.Cross(a, b)
	return v3(a._y * b._z - a._z * b._y, a._z * b._x - a._x * b._z, a._x * b._y - a._y * b._x)
end
function V3methods.Abs(a)
	return v3(math.abs(a._x), math.abs(a._y), math.abs(a._z))
end
function V3methods.FuzzyEq(a, b, eps)
	eps = eps or 1e-5
	return math.abs(a._x - b._x) <= eps and math.abs(a._y - b._y) <= eps and math.abs(a._z - b._z) <= eps
end
Types.Vector3 = Vector3

---------------------------------------------------------------------
-- Vector2
---------------------------------------------------------------------

local Vector2 = {}
local V2 = { __type = "Vector2" }
local function v2(x: number, y: number)
	return setmetatable({ _x = x, _y = y }, V2)
end
function Vector2.new(x: number?, y: number?)
	return v2(num(x or 0, "Vector2.new"), num(y or 0, "Vector2.new"))
end
Vector2.zero = v2(0, 0)
Vector2.one = v2(1, 1)
V2.__index = function(v, key)
	if key == "X" then
		return v._x
	elseif key == "Y" then
		return v._y
	elseif key == "Magnitude" then
		return math.sqrt(v._x * v._x + v._y * v._y)
	elseif key == "Lerp" then
		return function(a, b, t)
			return v2(a._x + (b._x - a._x) * t, a._y + (b._y - a._y) * t)
		end
	end
	fail(tostring(key) .. " is not a valid member of Vector2")
end
V2.__newindex = function()
	fail("Vector2 is read-only")
end
V2.__add = function(a, b)
	return v2(a._x + b._x, a._y + b._y)
end
V2.__sub = function(a, b)
	return v2(a._x - b._x, a._y - b._y)
end
V2.__mul = function(a, b)
	if type(a) == "number" then
		return v2(a * b._x, a * b._y)
	elseif type(b) == "number" then
		return v2(a._x * b, a._y * b)
	end
	return v2(a._x * b._x, a._y * b._y)
end
V2.__div = function(a, b)
	if type(b) == "number" then
		return v2(a._x / b, a._y / b)
	end
	return v2(a._x / b._x, a._y / b._y)
end
V2.__eq = function(a, b)
	return a._x == b._x and a._y == b._y
end
V2.__tostring = function(v)
	return string.format("%g, %g", v._x, v._y)
end
Types.Vector2 = Vector2

---------------------------------------------------------------------
-- CFrame (позиция + матрица поворота, как в Roblox)
---------------------------------------------------------------------

local CFrame = {}
local CF = { __type = "CFrame" }
local CFmethods = {}

-- r = { r00, r01, r02, r10, r11, r12, r20, r21, r22 }
local function cf(x: number, y: number, z: number, r)
	return setmetatable({ _x = x, _y = y, _z = z, _r = r }, CF)
end
local IDENTITY = { 1, 0, 0, 0, 1, 0, 0, 0, 1 }

local function mulRot(a, b)
	local r = {}
	for i = 0, 2 do
		for j = 0, 2 do
			local sum = 0
			for k = 0, 2 do
				sum += a[i * 3 + k + 1] * b[k * 3 + j + 1]
			end
			r[i * 3 + j + 1] = sum
		end
	end
	return r
end

local function rotVec(r, x: number, y: number, z: number)
	return r[1] * x + r[2] * y + r[3] * z, r[4] * x + r[5] * y + r[6] * z, r[7] * x + r[8] * y + r[9] * z
end

function CFrame.new(...)
	local n = select("#", ...)
	local a, b, c = ...
	if n == 0 then
		return cf(0, 0, 0, IDENTITY)
	elseif n == 1 then
		if typeName(a) ~= "Vector3" then
			fail("CFrame.new expects Vector3, got " .. typeName(a))
		end
		return cf(a._x, a._y, a._z, IDENTITY)
	elseif n == 2 then
		return CFrame.lookAt(a, b)
	elseif n == 3 then
		return cf(num(a, "CFrame.new"), num(b, "CFrame.new"), num(c, "CFrame.new"), IDENTITY)
	elseif n == 12 then
		local v = { ... }
		return cf(v[1], v[2], v[3], { v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11], v[12] })
	end
	fail("CFrame.new: unsupported arguments (" .. n .. ")")
end
CFrame.identity = cf(0, 0, 0, IDENTITY)

function CFrame.lookAt(at, target, up)
	if typeName(at) ~= "Vector3" or typeName(target) ~= "Vector3" then
		fail("CFrame.lookAt expects Vector3 arguments")
	end
	up = up or Vector3.yAxis
	local look = target - at
	if look.Magnitude < 1e-9 then
		return cf(at._x, at._y, at._z, IDENTITY)
	end
	look = look.Unit
	local right = look:Cross(up)
	if right.Magnitude < 1e-6 then
		right = look:Cross(Vector3.zAxis)
	end
	right = right.Unit
	local upv = right:Cross(look)
	return cf(at._x, at._y, at._z, {
		right._x, upv._x, -look._x,
		right._y, upv._y, -look._y,
		right._z, upv._z, -look._z,
	})
end

local function rx(a: number)
	local c, s = math.cos(a), math.sin(a)
	return { 1, 0, 0, 0, c, -s, 0, s, c }
end
local function ry(a: number)
	local c, s = math.cos(a), math.sin(a)
	return { c, 0, s, 0, 1, 0, -s, 0, c }
end
local function rz(a: number)
	local c, s = math.cos(a), math.sin(a)
	return { c, -s, 0, s, c, 0, 0, 0, 1 }
end

function CFrame.Angles(x: number, y: number, z: number)
	return cf(0, 0, 0, mulRot(mulRot(rx(num(x, "CFrame.Angles")), ry(num(y, "CFrame.Angles"))), rz(num(z, "CFrame.Angles"))))
end
CFrame.fromEulerAnglesXYZ = CFrame.Angles
function CFrame.fromEulerAnglesYXZ(x: number, y: number, z: number)
	return cf(0, 0, 0, mulRot(mulRot(ry(y), rx(x)), rz(z)))
end
CFrame.fromOrientation = CFrame.fromEulerAnglesYXZ

CF.__index = function(c, key)
	local r = c._r
	if key == "Position" or key == "p" then
		return v3(c._x, c._y, c._z)
	elseif key == "X" then
		return c._x
	elseif key == "Y" then
		return c._y
	elseif key == "Z" then
		return c._z
	elseif key == "RightVector" or key == "XVector" then
		return v3(r[1], r[4], r[7])
	elseif key == "UpVector" or key == "YVector" then
		return v3(r[2], r[5], r[8])
	elseif key == "LookVector" then
		return v3(-r[3], -r[6], -r[9])
	elseif key == "ZVector" then
		return v3(r[3], r[6], r[9])
	elseif key == "Rotation" then
		return cf(0, 0, 0, r)
	end
	local method = CFmethods[key]
	if method then
		return method
	end
	fail(tostring(key) .. " is not a valid member of CFrame")
end
CF.__newindex = function()
	fail("CFrame is read-only")
end
CF.__mul = function(a, b)
	if typeName(a) ~= "CFrame" then
		fail("attempt to multiply " .. typeName(a) .. " with CFrame")
	end
	local tb = typeName(b)
	if tb == "CFrame" then
		local x, y, z = rotVec(a._r, b._x, b._y, b._z)
		return cf(a._x + x, a._y + y, a._z + z, mulRot(a._r, b._r))
	elseif tb == "Vector3" then
		local x, y, z = rotVec(a._r, b._x, b._y, b._z)
		return v3(a._x + x, a._y + y, a._z + z)
	end
	fail("attempt to multiply CFrame with " .. tb)
end
CF.__add = function(a, b)
	if typeName(b) ~= "Vector3" then
		fail("attempt to add CFrame and " .. typeName(b))
	end
	return cf(a._x + b._x, a._y + b._y, a._z + b._z, a._r)
end
CF.__sub = function(a, b)
	if typeName(b) ~= "Vector3" then
		fail("attempt to subtract " .. typeName(b) .. " from CFrame")
	end
	return cf(a._x - b._x, a._y - b._y, a._z - b._z, a._r)
end
CF.__eq = function(a, b)
	if a._x ~= b._x or a._y ~= b._y or a._z ~= b._z then
		return false
	end
	for i = 1, 9 do
		if a._r[i] ~= b._r[i] then
			return false
		end
	end
	return true
end
CF.__tostring = function(c)
	return string.format("CFrame(%g, %g, %g)", c._x, c._y, c._z)
end

function CFmethods.Inverse(c)
	local r = c._r
	local t = { r[1], r[4], r[7], r[2], r[5], r[8], r[3], r[6], r[9] }
	local x, y, z = rotVec(t, -c._x, -c._y, -c._z)
	return cf(x, y, z, t)
end
function CFmethods.Lerp(a, b, alpha)
	local p = v3(a._x, a._y, a._z):Lerp(v3(b._x, b._y, b._z), alpha)
	return cf(p._x, p._y, p._z, alpha < 0.5 and a._r or b._r)
end
function CFmethods.ToWorldSpace(a, b)
	return a * b
end
function CFmethods.ToObjectSpace(a, b)
	return CFmethods.Inverse(a) * b
end
function CFmethods.PointToWorldSpace(a, v)
	return a * v
end
function CFmethods.PointToObjectSpace(a, v)
	return CFmethods.Inverse(a) * v
end
function CFmethods.VectorToWorldSpace(a, v)
	local x, y, z = rotVec(a._r, v._x, v._y, v._z)
	return v3(x, y, z)
end
function CFmethods.GetComponents(c)
	local r = c._r
	return c._x, c._y, c._z, r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]
end
Types.CFrame = CFrame

---------------------------------------------------------------------
-- Color3
---------------------------------------------------------------------

local Color3 = {}
local C3 = { __type = "Color3" }
local function c3(r: number, g: number, b: number)
	return setmetatable({ _r = r, _g = g, _b = b }, C3)
end
function Color3.new(r: number?, g: number?, b: number?)
	return c3(num(r or 0, "Color3.new"), num(g or 0, "Color3.new"), num(b or 0, "Color3.new"))
end
function Color3.fromRGB(r: number?, g: number?, b: number?)
	return c3(num(r or 0, "Color3.fromRGB") / 255, num(g or 0, "Color3.fromRGB") / 255, num(b or 0, "Color3.fromRGB") / 255)
end
function Color3.fromHSV(h: number, s: number, v: number)
	num(h, "Color3.fromHSV")
	num(s, "Color3.fromHSV")
	num(v, "Color3.fromHSV")
	local i = math.floor(h * 6)
	local f = h * 6 - i
	local p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
	i %= 6
	if i == 0 then
		return c3(v, t, p)
	elseif i == 1 then
		return c3(q, v, p)
	elseif i == 2 then
		return c3(p, v, t)
	elseif i == 3 then
		return c3(p, q, v)
	elseif i == 4 then
		return c3(t, p, v)
	end
	return c3(v, p, q)
end
C3.__index = function(c, key)
	if key == "R" then
		return c._r
	elseif key == "G" then
		return c._g
	elseif key == "B" then
		return c._b
	elseif key == "Lerp" then
		return function(a, b, t)
			if typeName(b) ~= "Color3" then
				fail("Color3:Lerp expects Color3, got " .. typeName(b))
			end
			return c3(a._r + (b._r - a._r) * t, a._g + (b._g - a._g) * t, a._b + (b._b - a._b) * t)
		end
	elseif key == "ToHSV" then
		return function(a)
			local maxc, minc = math.max(a._r, a._g, a._b), math.min(a._r, a._g, a._b)
			return 0, maxc == 0 and 0 or (maxc - minc) / maxc, maxc
		end
	end
	fail(tostring(key) .. " is not a valid member of Color3")
end
C3.__newindex = function()
	fail("Color3 is read-only")
end
C3.__eq = function(a, b)
	return a._r == b._r and a._g == b._g and a._b == b._b
end
C3.__tostring = function(c)
	return string.format("%g, %g, %g", c._r, c._g, c._b)
end
Types.Color3 = Color3

---------------------------------------------------------------------
-- UDim, UDim2
---------------------------------------------------------------------

local UDim = {}
local UD = { __type = "UDim" }
function UDim.new(scale: number?, offset: number?)
	return setmetatable({ Scale = num(scale or 0, "UDim.new"), Offset = num(offset or 0, "UDim.new") }, UD)
end
UD.__newindex = function()
	fail("UDim is read-only")
end
UD.__eq = function(a, b)
	return a.Scale == b.Scale and a.Offset == b.Offset
end
Types.UDim = UDim

local UDim2 = {}
local UD2 = { __type = "UDim2" }
local function udim2(xs, xo, ys, yo)
	local x, y = UDim.new(xs, xo), UDim.new(ys, yo)
	return setmetatable({ X = x, Y = y, Width = x, Height = y }, UD2)
end
function UDim2.new(xs: number?, xo: number?, ys: number?, yo: number?)
	if typeName(xs) == "UDim" then
		local a, b = xs :: any, xo :: any
		return udim2(a.Scale, a.Offset, b.Scale, b.Offset)
	end
	return udim2(xs or 0, xo or 0, ys or 0, yo or 0)
end
function UDim2.fromOffset(x: number?, y: number?)
	return udim2(0, x or 0, 0, y or 0)
end
function UDim2.fromScale(x: number?, y: number?)
	return udim2(x or 0, 0, y or 0, 0)
end
UD2.__newindex = function()
	fail("UDim2 is read-only")
end
UD2.__add = function(a, b)
	return udim2(a.X.Scale + b.X.Scale, a.X.Offset + b.X.Offset, a.Y.Scale + b.Y.Scale, a.Y.Offset + b.Y.Offset)
end
UD2.__eq = function(a, b)
	return a.X == b.X and a.Y == b.Y
end
Types.UDim2 = UDim2

---------------------------------------------------------------------
-- NumberRange, NumberSequence, ColorSequence, TweenInfo
---------------------------------------------------------------------

local function simple(typeNameValue: string, fields)
	return setmetatable(fields, {
		__type = typeNameValue,
		__newindex = function()
			fail(typeNameValue .. " is read-only")
		end,
	})
end

Types.NumberRange = {
	new = function(min: number, max: number?)
		num(min, "NumberRange.new")
		return simple("NumberRange", { Min = min, Max = max or min })
	end,
}

Types.NumberSequenceKeypoint = {
	new = function(time: number, value: number, envelope: number?)
		return simple("NumberSequenceKeypoint", { Time = num(time, "NumberSequenceKeypoint"), Value = num(value, "NumberSequenceKeypoint"), Envelope = envelope or 0 })
	end,
}
Types.NumberSequence = {
	new = function(a: any, b: any?)
		if type(a) == "number" then
			return simple("NumberSequence", { Keypoints = { Types.NumberSequenceKeypoint.new(0, a), Types.NumberSequenceKeypoint.new(1, b or a) } })
		elseif type(a) == "table" and typeName(a) == "table" then
			for _, kp in ipairs(a) do
				if typeName(kp) ~= "NumberSequenceKeypoint" then
					fail("NumberSequence.new expects keypoints")
				end
			end
			return simple("NumberSequence", { Keypoints = a })
		end
		fail("NumberSequence.new: bad arguments")
	end,
}

Types.ColorSequenceKeypoint = {
	new = function(time: number, color: any)
		if typeName(color) ~= "Color3" then
			fail("ColorSequenceKeypoint.new expects Color3")
		end
		return simple("ColorSequenceKeypoint", { Time = num(time, "ColorSequenceKeypoint"), Value = color })
	end,
}
Types.ColorSequence = {
	new = function(a: any, b: any?)
		if typeName(a) == "Color3" then
			if b ~= nil and typeName(b) ~= "Color3" then
				fail("ColorSequence.new expects Color3")
			end
			return simple("ColorSequence", { Keypoints = { Types.ColorSequenceKeypoint.new(0, a), Types.ColorSequenceKeypoint.new(1, b or a) } })
		elseif typeName(a) == "table" then
			local count = #a
			if count < 2 then
				fail("ColorSequence.new needs at least 2 keypoints")
			end
			for _, kp in ipairs(a) do
				if typeName(kp) ~= "ColorSequenceKeypoint" then
					fail("ColorSequence.new expects keypoints")
				end
			end
			if a[1].Time ~= 0 or a[count].Time ~= 1 then
				fail("ColorSequence must start at time 0 and end at time 1")
			end
			return simple("ColorSequence", { Keypoints = a })
		end
		fail("ColorSequence.new: bad arguments")
	end,
}

---------------------------------------------------------------------
-- Enum
---------------------------------------------------------------------

local enumItems = {}
local enumObjects = {}

local function enumItem(enumName: string, itemName: string)
	local key = enumName .. "." .. itemName
	local item = enumItems[key]
	if not item then
		item = setmetatable({ Name = itemName, Value = API.enums[enumName][itemName], EnumType = enumName }, {
			__type = "EnumItem",
			__tostring = function()
				return "Enum." .. key
			end,
			__newindex = function()
				fail("EnumItem is read-only")
			end,
		})
		enumItems[key] = item
	end
	return item
end
Types.enumItem = enumItem

local function enumObject(enumName: string)
	local object = enumObjects[enumName]
	if object then
		return object
	end
	local items = API.enums[enumName]
	if not items then
		fail("Enum." .. enumName .. " does not exist")
	end
	object = setmetatable({}, {
		__type = "Enum",
		__index = function(_, itemName)
			if itemName == "GetEnumItems" then
				return function()
					local list = {}
					for name in pairs(items) do
						table.insert(list, enumItem(enumName, name))
					end
					return list
				end
			end
			if items[itemName] == nil then
				fail(tostring(itemName) .. " is not a valid member of Enum." .. enumName)
			end
			return enumItem(enumName, itemName)
		end,
	})
	enumObjects[enumName] = object
	return object
end

Types.Enum = setmetatable({}, {
	__index = function(_, enumName)
		return enumObject(enumName)
	end,
})

function Types.firstEnumItem(enumName: string)
	local items = API.enums[enumName]
	if not items then
		return nil
	end
	local bestName, bestValue = nil, math.huge
	for name, value in pairs(items) do
		if value < bestValue then
			bestName, bestValue = name, value
		end
	end
	return bestName and enumItem(enumName, bestName) or nil
end

Types.TweenInfo = {
	new = function(time: number?, style: any?, direction: any?, repeatCount: number?, reverses: boolean?, delay: number?)
		return simple("TweenInfo", {
			Time = time or 1,
			EasingStyle = style or enumItem("EasingStyle", "Quad"),
			EasingDirection = direction or enumItem("EasingDirection", "Out"),
			RepeatCount = repeatCount or 0,
			Reverses = reverses or false,
			DelayTime = delay or 0,
		})
	end,
}

---------------------------------------------------------------------
-- Random (детерминированный)
---------------------------------------------------------------------

local RandomMT = { __type = "Random" }
RandomMT.__index = RandomMT
local seedCounter = 12345
do
	-- tests/build/seed.luau (если есть) задаёт другой набор случайностей
	local ok, seed = pcall(require, "../build/seed")
	if ok and type(seed) == "number" then
		seedCounter = seed
		math.randomseed(seed)
	end
end

local function nextState(state: number): number
	-- 32-битный xorshift
	state = bit32.bxor(state, bit32.lshift(state, 13))
	state = bit32.bxor(state, bit32.rshift(state, 17))
	state = bit32.bxor(state, bit32.lshift(state, 5))
	return state
end

local Random = {}
function Random.new(seed: number?)
	if seed == nil then
		seedCounter += 7919
		seed = seedCounter
	end
	local state = math.floor(math.abs(num(seed, "Random.new")) % 4294967295)
	if state == 0 then
		state = 2463534242
	end
	return setmetatable({ _state = state }, RandomMT)
end
function RandomMT:_next(): number
	self._state = nextState(self._state)
	return self._state / 4294967296
end
function RandomMT:NextNumber(min: number?, max: number?): number
	local value = self:_next()
	if min ~= nil then
		return (min :: number) + value * ((max or 1) - (min :: number))
	end
	return value
end
function RandomMT:NextInteger(min: number, max: number): number
	if type(min) ~= "number" or type(max) ~= "number" then
		error("Random:NextInteger expects two numbers", 2)
	end
	if max < min then
		error("Random:NextInteger: max must be >= min", 2)
	end
	return math.floor(min + self:_next() * (max - min + 1))
end
Types.Random = Random

return Types
