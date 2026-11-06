-- Распаковка PNG (RGBA, 8 бит) прямо в Luau: base64 → zlib inflate → снятие фильтров.
-- Нужна, чтобы показать встроенный атлас через EditableImage без загрузки картинки.
-- Без битовых операций, чтобы тот же код проверялся тестами вне Roblox.
local Png = {}

local POW2 = {}
for i = 0, 32 do
	POW2[i] = 2 ^ i
end

local B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local B64MAP = {}
for i = 1, 64 do
	B64MAP[string.byte(B64, i)] = i - 1
end

-- хранилище байтов: buffer в Roblox, таблица в тестах
local function newBytes(size)
	if buffer then
		local b = buffer.create(size)
		return {
			buf = b,
			set = function(i, v)
				buffer.writeu8(b, i - 1, v)
			end,
			get = function(i)
				return buffer.readu8(b, i - 1)
			end,
		}
	end
	local t = {}
	return {
		set = function(i, v)
			t[i] = v
		end,
		get = function(i)
			return t[i]
		end,
	}
end

function Png.base64(s)
	local out, n = {}, 0
	local acc, bits = 0, 0
	for i = 1, #s do
		local v = B64MAP[string.byte(s, i)]
		if v then
			acc = acc * 64 + v
			bits = bits + 6
			if bits >= 8 then
				bits = bits - 8
				local p = POW2[bits]
				local byte = math.floor(acc / p)
				acc = acc - byte * p
				n = n + 1
				out[n] = byte
			end
		end
	end
	return out
end

local LBASE = { 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258 }
local LEXT = { 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0 }
local DBASE = { 1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577 }
local DEXT = { 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13 }
local ORDER = { 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 }

-- канонический код Хаффмана как в puff.c; lengths индексируются с 0
local function huffman(lengths, n)
	local count = {}
	for i = 0, 15 do
		count[i] = 0
	end
	for s = 0, n - 1 do
		count[lengths[s]] = count[lengths[s]] + 1
	end
	local offs = { [1] = 0 }
	for len = 1, 14 do
		offs[len + 1] = offs[len] + count[len]
	end
	local symbol = {}
	for s = 0, n - 1 do
		local len = lengths[s]
		if len ~= 0 then
			symbol[offs[len] + 1] = s
			offs[len] = offs[len] + 1
		end
	end
	return { count = count, symbol = symbol }
end

-- data: массив байтов (1..), начиная с pos — поток deflate; out — хранилище
local function inflate(data, pos, out)
	local bitbuf, bitcnt = 0, 0
	local outLen = 0

	local function bits(n)
		while bitcnt < n do
			bitbuf = bitbuf + (data[pos] or 0) * POW2[bitcnt]
			pos = pos + 1
			bitcnt = bitcnt + 8
		end
		local p = POW2[n]
		local v = bitbuf % p
		bitbuf = (bitbuf - v) / p
		bitcnt = bitcnt - n
		return v
	end

	local function decode(h)
		local code, first, index = 0, 0, 0
		local count, symbol = h.count, h.symbol
		for len = 1, 15 do
			code = code + bits(1)
			local c = count[len]
			if code - c < first then
				return symbol[index + (code - first) + 1]
			end
			index = index + c
			first = (first + c) * 2
			code = code * 2
		end
		error("PNG: испорченный код Хаффмана")
	end

	local function codes(lencode, distcode)
		while true do
			local sym = decode(lencode)
			if sym < 256 then
				outLen = outLen + 1
				out.set(outLen, sym)
			elseif sym == 256 then
				return
			else
				sym = sym - 257
				local len = LBASE[sym + 1] + bits(LEXT[sym + 1])
				local dsym = decode(distcode)
				local dist = DBASE[dsym + 1] + bits(DEXT[dsym + 1])
				for _ = 1, len do
					outLen = outLen + 1
					out.set(outLen, out.get(outLen - dist))
				end
			end
		end
	end

	local fixedLen, fixedDist
	repeat
		local last = bits(1)
		local btype = bits(2)
		if btype == 0 then
			bitbuf, bitcnt = 0, 0
			local len = data[pos] + data[pos + 1] * 256
			pos = pos + 4
			for _ = 1, len do
				outLen = outLen + 1
				out.set(outLen, data[pos])
				pos = pos + 1
			end
		elseif btype == 1 then
			if not fixedLen then
				local l = {}
				for s = 0, 143 do
					l[s] = 8
				end
				for s = 144, 255 do
					l[s] = 9
				end
				for s = 256, 279 do
					l[s] = 7
				end
				for s = 280, 287 do
					l[s] = 8
				end
				fixedLen = huffman(l, 288)
				local d = {}
				for s = 0, 29 do
					d[s] = 5
				end
				fixedDist = huffman(d, 30)
			end
			codes(fixedLen, fixedDist)
		elseif btype == 2 then
			local nlen = bits(5) + 257
			local ndist = bits(5) + 1
			local ncode = bits(4) + 4
			local lengths = {}
			for i = 0, 18 do
				lengths[i] = 0
			end
			for i = 1, ncode do
				lengths[ORDER[i]] = bits(3)
			end
			local lencode = huffman(lengths, 19)
			local all = {}
			local index = 0
			while index < nlen + ndist do
				local sym = decode(lencode)
				if sym < 16 then
					all[index] = sym
					index = index + 1
				else
					local len, value = 0, 0
					if sym == 16 then
						value = all[index - 1]
						len = 3 + bits(2)
					elseif sym == 17 then
						len = 3 + bits(3)
					else
						len = 11 + bits(7)
					end
					for _ = 1, len do
						all[index] = value
						index = index + 1
					end
				end
			end
			local litLens, distLens = {}, {}
			for i = 0, nlen - 1 do
				litLens[i] = all[i]
			end
			for i = 0, ndist - 1 do
				distLens[i] = all[nlen + i]
			end
			codes(huffman(litLens, nlen), huffman(distLens, ndist))
		else
			error("PNG: неизвестный тип блока")
		end
	until last == 1
	return outLen
end

local function u32(data, i)
	return ((data[i] * 256 + data[i + 1]) * 256 + data[i + 2]) * 256 + data[i + 3]
end

-- bytes: массив байтов файла PNG. Возвращает { width, height, get(i), buf }
function Png.decode(bytes)
	local pos = 9
	local width, height
	local idat, n = {}, 0
	while pos <= #bytes do
		local len = u32(bytes, pos)
		local typ = string.char(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7])
		local start = pos + 8
		if typ == "IHDR" then
			width, height = u32(bytes, start), u32(bytes, start + 4)
			assert(bytes[start + 8] == 8 and bytes[start + 9] == 6, "PNG: нужен RGBA 8 бит")
		elseif typ == "IDAT" then
			for i = start, start + len - 1 do
				n = n + 1
				idat[n] = bytes[i]
			end
		elseif typ == "IEND" then
			break
		end
		pos = start + len + 4
	end
	local stride = width * 4
	local raw = newBytes(height * (stride + 1))
	inflate(idat, 3, raw) -- первые два байта — заголовок zlib
	local px = newBytes(width * height * 4)
	for y = 0, height - 1 do
		local f = raw.get(y * (stride + 1) + 1)
		local src = y * (stride + 1) + 1
		local dst = y * stride
		for i = 1, stride do
			local v = raw.get(src + i)
			if f ~= 0 then
				local a = i > 4 and px.get(dst + i - 4) or 0
				local b = y > 0 and px.get(dst - stride + i) or 0
				if f == 1 then
					v = v + a
				elseif f == 2 then
					v = v + b
				elseif f == 3 then
					v = v + math.floor((a + b) / 2)
				elseif f == 4 then
					local c = (i > 4 and y > 0) and px.get(dst - stride + i - 4) or 0
					local p = a + b - c
					local pa, pb, pc = math.abs(p - a), math.abs(p - b), math.abs(p - c)
					if pa <= pb and pa <= pc then
						v = v + a
					elseif pb <= pc then
						v = v + b
					else
						v = v + c
					end
				end
				v = v % 256
			end
			px.set(dst + i, v)
		end
	end
	return { width = width, height = height, get = px.get, buf = px.buf }
end

return Png
