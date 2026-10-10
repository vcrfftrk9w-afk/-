-- Проверка, что все тексты есть на обоих языках
local Runtime = require("./mock/runtime")
Runtime.loadProject(require("./build/sources"))
local Config = Runtime.require(Runtime.find("ReplicatedStorage/Shared/Config"))
local Strings = Runtime.require(Runtime.find("ReplicatedStorage/Shared/Strings"))

local needed = {}
local function need(key) if string.sub(key, -1) ~= "_" then needed[key] = true end end
for _, seed in ipairs(Config.Seeds) do need("seed_" .. seed.id) end
for rarity in pairs(Config.Rarities) do need("rar_" .. rarity) end
for mutation in pairs(Config.Mutations) do need("mut_" .. mutation) end
need("mut_giant")
for id in pairs(Config.Weather.types) do need("w_" .. id); need("w_" .. id .. "_desc") end
for _, u in ipairs(Config.Upgrades) do need("upg_" .. u.key); need("upg_" .. u.key .. "_desc"); need("upgv_" .. u.key) end
for _, egg in ipairs(Config.Eggs) do need("egg_" .. egg.id) end
for id, pet in pairs(Config.Pets) do need("pet_" .. id); need("bonus_" .. pet.bonus) end
for _, key in ipairs(Config.GamePassOrder) do need("pass_" .. key); need("pass_" .. key .. "_desc") end
for _, key in ipairs(Config.ProductOrder) do need("prod_" .. key) end
need("prod_candyStorm_desc"); need("prod_growAll_desc"); need("prod_coins_desc")
for i = 0, 3 do need("tut_" .. i) end
for key in pairs(Config.World.stands) do need("sign_" .. key); need("obj_" .. key) end

-- ключи, которые встречаются в коде напрямую
local sources = require("./build/sources")
for _, item in ipairs(sources) do
	if item.source then
		for key in string.gmatch(item.source, 'T%("([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'notify%(session, "([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'notifyAll%("([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'Util%.sign%([^,]+, "([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'localize%([^,]+, "([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'action = "([%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, 'key = "(n_[%w_]+)"') do need(key) end
		for key in string.gmatch(item.source, '"@([%w_]+)"') do need(key) end
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
-- одинаковое число %s
for key, text in pairs(Strings.ru) do
	local en = Strings.en[key]
	if en then
		local _, a = string.gsub(text, "%%s", "")
		local _, b = string.gsub(en, "%%s", "")
		if a ~= b then print("placeholder mismatch: " .. key); missing += 1 end
	end
end
local count = 0 for _ in pairs(needed) do count += 1 end
print("checked keys:", count, "problems:", missing)
