-- Покупки за Robux: геймпассы (навсегда) и товары (можно покупать много раз).

local Players = game:GetService("Players")
local MarketplaceService = game:GetService("MarketplaceService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

local Sessions = require(script.Parent.Sessions)

type Session = Sessions.Session

local Monetization = {}

local handlers = {
	grantProduct = function(_session: Session, _key: string) end,
	passGranted = function(_session: Session, _key: string) end,
}

function Monetization.init(newHandlers)
	for key, fn in pairs(newHandlers) do
		handlers[key] = fn
	end
end

local passKeyById = {}
for key, id in pairs(Config.GamePasses) do
	if id ~= 0 then
		passKeyById[id] = key
	end
end

local productKeyById = {}
for key, id in pairs(Config.Products) do
	if id ~= 0 then
		productKeyById[id] = key
	end
end

function Monetization.loadPasses(session: Session)
	for key, id in pairs(Config.GamePasses) do
		if id ~= 0 then
			local ok, owns = pcall(function()
				return MarketplaceService:UserOwnsGamePassAsync(session.player.UserId, id)
			end)
			if ok and owns then
				session.passes[key] = true
			end
		end
	end
end

function Monetization.start()
	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
		if not purchased then
			return
		end
		local key = passKeyById[passId]
		local session = Sessions.get(player)
		if key and session then
			session.passes[key] = true
			handlers.passGranted(session, key)
			Sessions.notify(session, "n_thanks")
			Sessions.markDirty(session)
		end
	end)

	MarketplaceService.ProcessReceipt = function(info)
		local key = productKeyById[info.ProductId]
		if not key then
			return Enum.ProductPurchaseDecision.NotProcessedYet
		end
		local player = Players:GetPlayerByUserId(info.PlayerId)
		local session = player and Sessions.get(player)
		if not session or not session.ready then
			return Enum.ProductPurchaseDecision.NotProcessedYet
		end
		local data = session.data
		if table.find(data.receipts, info.PurchaseId) then
			return Enum.ProductPurchaseDecision.PurchaseGranted
		end
		local ok, err = pcall(handlers.grantProduct, session, key)
		if not ok then
			warn("[Starfall] Покупка не выдана: " .. tostring(err))
			return Enum.ProductPurchaseDecision.NotProcessedYet
		end
		table.insert(data.receipts, info.PurchaseId)
		while #data.receipts > 30 do
			table.remove(data.receipts, 1)
		end
		Sessions.notify(session, "n_thanks")
		Sessions.markDirty(session)
		if session.canSave and not Sessions.save(session) then
			-- Roblox повторит попытку позже; повторной выдачи не будет — номер покупки уже записан
			return Enum.ProductPurchaseDecision.NotProcessedYet
		end
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
end

return Monetization
