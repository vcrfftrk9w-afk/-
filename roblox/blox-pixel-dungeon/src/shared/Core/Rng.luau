-- Детерминированный генератор случайных чисел (Park–Miller).
-- Повторяет нужные функции com.watabou.utils.Random из Shattered Pixel Dungeon.
local Rng = {}
Rng.__index = Rng

local MOD = 2147483647

function Rng.new(seed)
	seed = math.floor(seed or os.time()) % (MOD - 1)
	if seed <= 0 then
		seed = seed + MOD - 2
	end
	return setmetatable({ s = seed }, Rng)
end

-- [0, 1)
function Rng:float(max)
	self.s = (self.s * 48271) % MOD
	local f = (self.s - 1) / (MOD - 1)
	if max then
		return f * max
	end
	return f
end

-- [0, n)
function Rng:int(n)
	if n <= 0 then
		return 0
	end
	return math.floor(self:float() * n)
end

-- [a, b]
function Rng:intRange(a, b)
	return a + self:int(b - a + 1)
end

-- треугольное распределение в [a, b], как Random.NormalIntRange
function Rng:normalIntRange(a, b)
	return a + math.floor((self:float() + self:float()) * (b - a + 1) / 2)
end

function Rng:chance(p)
	return self:float() < p
end

function Rng:pick(list)
	return list[self:int(#list) + 1]
end

function Rng:shuffle(list)
	for i = #list, 2, -1 do
		local j = self:int(i) + 1
		list[i], list[j] = list[j], list[i]
	end
	return list
end

-- weights: { key = вес, ... } или массив весов; возвращает ключ
function Rng:chances(weights)
	local total = 0
	local keys = {}
	for k, w in pairs(weights) do
		keys[#keys + 1] = k
	end
	table.sort(keys, function(a, b)
		return tostring(a) < tostring(b)
	end)
	for _, k in ipairs(keys) do
		total = total + weights[k]
	end
	local roll = self:float(total)
	for _, k in ipairs(keys) do
		roll = roll - weights[k]
		if roll < 0 then
			return k
		end
	end
	return keys[#keys]
end

return Rng
