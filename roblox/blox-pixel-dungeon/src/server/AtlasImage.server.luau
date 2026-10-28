-- Узнаёт настоящий ID картинки атласа. Если в Config.ATLAS_ID вставили ID наклейки (Decal),
-- например после загрузки на сайте Roblox, достаём из неё картинку через InsertService.
-- Результат кладём в атрибут BPD.AtlasImage — клиенты берут его оттуда.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local InsertService = game:GetService("InsertService")

local Shared = ReplicatedStorage:WaitForChild("BPD")
local Config = require(Shared:WaitForChild("Config"))

-- подойдёт что угодно с числом: "123", "rbxassetid://123", ссылка на страницу ассета
local id = tonumber(string.match(tostring(Config.ATLAS_ID), "%d%d%d%d+"))
if not id then
	return
end

local image = "rbxassetid://" .. id
local ok, model = pcall(function()
	return InsertService:LoadAsset(id)
end)
if ok and model then
	local decal = model:FindFirstChildWhichIsA("Decal", true)
	if decal and decal.Texture ~= "" then
		image = decal.Texture
	end
	model:Destroy()
end
Shared:SetAttribute("AtlasImage", image)
