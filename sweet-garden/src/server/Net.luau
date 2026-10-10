-- Приём команд от игроков (кнопки на экране) с защитой от спама.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Sessions = require(script.Parent.Sessions)
local Util = require(script.Parent.Util)

type Session = Sessions.Session

local Action = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Action") :: RemoteEvent

local Net = {}

local handlers: { [string]: (Session, ...any) -> () } = {}

function Net.on(name: string, handler: (Session, ...any) -> ())
	handlers[name] = handler
end

function Net.start()
	Action.OnServerEvent:Connect(function(player, name, ...)
		if type(name) ~= "string" then
			return
		end
		local session = Sessions.get(player)
		if not session then
			return
		end
		if name == "Hello" then
			Sessions.markDirty(session)
			return
		end
		if not session.ready then
			return
		end
		local handler = handlers[name]
		if not handler then
			return
		end
		local now = os.clock()
		if now - session.rateWindow > 1 then
			session.rateWindow = now
			session.rateCount = 0
		end
		session.rateCount += 1
		if session.rateCount > 25 then
			return
		end
		Util.try("action " .. name, handler, session, ...)
	end)
end

return Net
