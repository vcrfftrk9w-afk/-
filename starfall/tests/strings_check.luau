-- Проверка, что все тексты есть на обоих языках
local Runtime = require("./mock/runtime")
Runtime.loadProject(require("./build/sources"))
local Config = Runtime.require(Runtime.find("ReplicatedStorage/Shared/Config"))
local Strings = Runtime.require(Runtime.find("ReplicatedStorage/Shared/Strings"))

local needed = {}
local function need(key) if string.sub(key, -1) ~= "_" then needed[key] = true end end
for _, star in ipairs(Config.Stars) do need("star_" .. star.id) end
for rarity in pairs(Config.Rarities) do need("rar_" .. rarity) end
for mutation in pairs(Config.Mutations) do need("mut_" .. mutation) end
for _, u in ipairs(Config.Upgrades) do need("upg_" .. u.key); need("upg_" .. u.key .. "_desc"); need("upgv_" .. u.key) end
for _, key in ipairs(Config.GamePassOrder) do need("pass_" .. key); need("pass_" .. key .. "_desc") end
for _, key in ipairs(Config.ProductOrder) do need("prod_" .. key) end
need("prod_meteorShower_desc"); need("prod_galaxion_desc"); need("prod_coins_desc")
for i = 0, 3 do need("tut_" .. i) end
for _, key in ipairs({ "lb_earned", "lb_stolen", "n_code_ok", "n_daily", "reveal_telescope", "reveal_gift", "carry", "carry_stolen", "n_delivered", "n_delivered_stolen" }) do need(key) end

-- ключи, которые встречаются в коде напрямую
local sources = require("./build/sources")
for _, item in ipairs(sources) do
	if item.source then
		for key in string.gmatch(item.source, 'T%("([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'notify%([%w_]+, "([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'notifyAll%("([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'announce%("([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'Util%.sign%([^,]+, "([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'localize%([^,]+, "([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'action = "([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'key = "(n_[%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, '"@([%a_]+)"') do need(key) end
	end
end

local missing = 0
for key in pairs(needed) do
	for _, lang in ipairs({ "ru", "en" }) do
		if Strings[lang][key] == nil then
			print("missing " .. lang .. ": " .. key)
			missing += 1
		end
	end
end
-- ключи, которых нет в другом языке
for key in pairs(Strings.ru) do if Strings.en[key] == nil then print("only ru: " .. key); missing += 1 end end
for key in pairs(Strings.en) do if Strings.ru[key] == nil then print("only en: " .. key); missing += 1 end end
-- одинаковое число %s, и формат не ломается
for key, text in pairs(Strings.ru) do
	local en = Strings.en[key]
	if en then
		local _, a = string.gsub(text, "%%s", "")
		local _, b = string.gsub(en, "%%s", "")
		if a ~= b then print("placeholder mismatch: " .. key); missing += 1 end
		local args = {}
		for i = 1, a do args[i] = "x" end
		for _, value in ipairs({ text, en }) do
			local ok = pcall(string.format, value, table.unpack(args))
			if not ok then print("bad format: " .. key); missing += 1 end
		end
	end
end
-- ключи, которые есть, но нигде не используются (подсказка, не ошибка)
local unused = {}
for key in pairs(Strings.ru) do
	if not needed[key] then
		table.insert(unused, key)
	end
end
table.sort(unused)
if #unused > 0 then print("not referenced directly: " .. table.concat(unused, ", ")) end
local count = 0 for _ in pairs(needed) do count += 1 end
print("checked keys:", count, "problems:", missing)
if missing > 0 then error("STRINGS FAILED") end
