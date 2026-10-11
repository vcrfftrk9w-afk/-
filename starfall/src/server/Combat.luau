-- Бонк! Удар большой мягкой перчаткой: соперник отлетает и роняет звезду.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

local Sessions = require(script.Parent.Sessions)
local Util = require(script.Parent.Util)
local Stars = require(script.Parent.Stars)

type Session = Sessions.Session

local Combat = {}

function Combat.bonk(session: Session)
	local clock = os.clock()
	local super = session.passes.superbonk == true
	local cooldown = super and Config.Bonk.superCooldown or Config.Bonk.cooldown
	if clock - session.lastBonk < cooldown or clock < session.stunnedUntil then
		return
	end
	local root = Util.rootOf(session.player)
	if not root or not Util.humanoidOf(session.player) then
		return
	end
	session.lastBonk = clock

	local range = super and Config.Bonk.superRange or Config.Bonk.range
	local push = super and Config.Bonk.superPush or Config.Bonk.push
	local look = root.CFrame.LookVector
	look = Vector3.new(look.X, 0, look.Z)
	look = look.Magnitude > 0.01 and look.Unit or Vector3.new(0, 0, -1)

	local hits = 0
	for _, other in pairs(Sessions.active) do
		if other ~= session and other.ready and clock >= other.immuneUntil then
			local otherRoot = Util.rootOf(other.player)
			if otherRoot and Util.humanoidOf(other.player) then
				local offset = otherRoot.Position - root.Position
				local flat = Vector3.new(offset.X, 0, offset.Z)
				local distance = flat.Magnitude
				if distance <= range and math.abs(offset.Y) < 8 then
					local direction = distance > 0.1 and flat.Unit or look
					-- бьём вперёд и в стороны; совсем рядом — в любую сторону
					if distance < 3.5 or direction:Dot(look) > -0.25 then
						hits += 1
						other.immuneUntil = clock + Config.Bonk.immunity
						other.stunnedUntil = clock + Config.Bonk.stun
						Util.try("bonk drop", Stars.drop, other, "bonk")
						Sessions.push(other, "bonked", { d = direction, p = push, by = session.player.DisplayName })
						Sessions.broadcast("bonkfx", otherRoot.Position)
					end
				end
			end
		end
	end
	Sessions.broadcast("swing", { p = root.Position, d = look, hit = hits > 0, super = super })
end

return Combat
