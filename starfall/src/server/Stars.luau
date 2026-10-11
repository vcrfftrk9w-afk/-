-- Звездопад: звёзды падают на поле, их ловят и несут на базу, крадут и роняют.
-- Иногда начинается метеоритный дождь — звёзды сыплются одна за другой.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Logic = require(Shared:WaitForChild("Logic"))

local Sessions = require(script.Parent.Sessions)
local World = require(script.Parent.World)
local Util = require(script.Parent.Util)
local StarVisuals = require(script.Parent.StarVisuals)
local Bases = require(script.Parent.Bases)

type Session = Sessions.Session
type Carry = Sessions.Carry

local Stars = {}

type FieldStar = { id: number, t: string, m: string?, model: Model, expires: number }

local field: { [number]: FieldStar } = {}
local nextId = 0
local rng = Random.new()
local showerUntil = 0

local function now(): number
	return workspace:GetServerTimeNow()
end

function Stars.fieldCount(): number
	local count = 0
	for _ in pairs(field) do
		count += 1
	end
	return count
end

function Stars.showerActive(): boolean
	return now() < showerUntil
end

function Stars.fieldStar(id: number): FieldStar?
	return field[id]
end

---------------------------------------------------------------------
-- Звёзды на поле
---------------------------------------------------------------------

local function removeFieldStar(id: number)
	local star = field[id]
	if star then
		field[id] = nil
		star.model:Destroy()
	end
end

local function createFieldStar(starId: string, mut: string?, position: Vector3, life: number): FieldStar
	nextId += 1
	local id = nextId
	local angle = rng:NextNumber() * math.pi * 2
	local model = StarVisuals.build(starId, mut, CFrame.new(position) * CFrame.Angles(0, angle, 0), World.fieldStars :: Folder)
	model.Name = "FieldStar" .. id
	local expires = now() + life
	model:SetAttribute("FieldId", id)
	model:SetAttribute("Expires", expires)
	Util.prompt({
		kind = "grab",
		action = "pr_grab",
		distance = 10,
		hold = Config.Grab.hold,
		attributes = { FieldId = id },
		parent = model.PrimaryPart :: BasePart,
	})
	CollectionService:AddTag(model, "FieldStar")
	local entry = { id = id, t = starId, m = mut, model = model, expires = expires }
	field[id] = entry
	return entry
end

local function landingSpot(): Vector3
	local spot = Vector3.new(0, 0, 0)
	for _ = 1, 12 do
		local angle = rng:NextNumber() * math.pi * 2
		local distance = math.sqrt(rng:NextNumber()) * Config.Fall.radius
		spot = Vector3.new(math.cos(angle) * distance, World.FIELD_TOP + 3, math.sin(angle) * distance)
		local free = true
		for _, star in pairs(field) do
			if (star.model:GetPivot().Position - spot).Magnitude < 8 then
				free = false
				break
			end
		end
		if free then
			break
		end
	end
	return spot
end

-- Звезда падает с неба: сначала луч-предупреждение, потом звезда на земле
function Stars.dropFromSky(luck: number?, forced: string?, forcedMut: string?)
	local rarity = Logic.rollRarity(rng, Logic.fieldWeights(), luck)
	local starId = forced or Logic.pickStar(rng, rarity)
	local mut = forcedMut or Logic.rollMutation(rng, luck)
	rarity = Logic.rarityOf(starId)
	local spot = landingSpot()
	local landsAt = now() + Config.Fall.warning

	local marker = Util.part({
		name = "Marker",
		shape = Enum.PartType.Cylinder,
		size = Vector3.new(0.2, 9, 9),
		cframe = Util.upright(CFrame.new(spot.X, World.FIELD_TOP + 0.15, spot.Z)),
		color = Config.Rarities[rarity].color,
		material = Enum.Material.Neon,
		transparency = 0.35,
		decor = true,
		parent = World.markers :: Folder,
	})
	marker:SetAttribute("Star", starId)
	marker:SetAttribute("Mut", mut or "")
	marker:SetAttribute("LandsAt", landsAt)
	CollectionService:AddTag(marker, "StarMarker")

	if Config.Rarities[rarity].order >= 5 then
		Sessions.announce("n_falling_rare", rarity, Util.starArg(starId, mut))
	end

	task.delay(Config.Fall.warning, function()
		marker:Destroy()
		createFieldStar(starId, mut, spot, Config.Rarities[rarity].life)
	end)
end

---------------------------------------------------------------------
-- Нести звезду
---------------------------------------------------------------------

function Stars.applySpeed(session: Session)
	local humanoid = Util.humanoidOf(session.player)
	if humanoid then
		humanoid.WalkSpeed = Logic.walkSpeed(session.data, session.passes, session.carrying ~= nil)
	end
end

local function attach(session: Session, carry: Carry)
	local character = session.player.Character
	if not character then
		return
	end
	local head = character:FindFirstChild("Head") or character:FindFirstChild("HumanoidRootPart")
	if not head or not head:IsA("BasePart") then
		return
	end
	local offset = head.Name == "Head" and 3.4 or 5
	local model = StarVisuals.build(carry.t, carry.m, head.CFrame * CFrame.new(0, offset, 0), character, true)
	model.Name = "CarriedStar"
	model:SetAttribute("Stolen", carry.from == "steal")
	model:SetAttribute("Carrier", session.player.DisplayName)
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = head
	weld.Part1 = model.PrimaryPart
	weld.Parent = model.PrimaryPart
	CollectionService:AddTag(model, "CarriedStar")
	carry.model = model
end

local function pickUp(session: Session, carry: Carry)
	session.carrying = carry
	attach(session, carry)
	Stars.applySpeed(session)
	Sessions.markDirty(session)
end

local function canAct(session: Session): BasePart?
	if session.carrying or os.clock() < session.stunnedUntil then
		return nil
	end
	if not Util.humanoidOf(session.player) then
		return nil
	end
	return Util.rootOf(session.player)
end

function Stars.grab(session: Session, fieldId: any)
	if type(fieldId) ~= "number" then
		return
	end
	local star = field[fieldId]
	local root = canAct(session)
	if not star or not root then
		return
	end
	if not session.base then
		Sessions.notify(session, "n_no_base")
		return
	end
	if (root.Position - star.model:GetPivot().Position).Magnitude > Config.Grab.range then
		return
	end
	removeFieldStar(fieldId)
	pickUp(session, { t = star.t, m = star.m, from = "field" })
	session.data.stats.caught += 1
	if session.data.tutorial == 0 then
		session.data.tutorial = 1
	end
	local rarity = Logic.rarityOf(star.t)
	if Config.Rarities[rarity].order >= 5 then
		Sessions.announce("n_caught_rare", rarity, session.player.DisplayName, Util.starArg(star.t, star.m))
	end
	Sessions.markDirty(session)
end

function Stars.steal(session: Session, baseIndex: any, slot: any)
	if type(baseIndex) ~= "number" or type(slot) ~= "number" then
		return
	end
	local owner = Bases.ownerOf(baseIndex)
	local base = World.bases[baseIndex]
	local pedestal = base and base.pedestals[slot]
	local root = canAct(session)
	if not owner or owner == session or not pedestal or not root then
		return
	end
	if not session.base then
		Sessions.notify(session, "n_no_base")
		return
	end
	if Bases.isLocked(owner) then
		Sessions.notify(session, "n_base_locked")
		return
	end
	if (root.Position - pedestal.part.Position).Magnitude > Config.Steal.range then
		return
	end
	local starId, mut = Bases.take(owner, slot)
	if not starId then
		return
	end
	pickUp(session, { t = starId, m = mut, from = "steal", owner = owner, slot = slot })
	Sessions.push(owner, "alarm", { by = session.player.DisplayName, t = starId, m = mut or "" })
	Sessions.notify(session, "n_steal_run")
end

-- Звезда падает из рук: краденая возвращается хозяину, остальные остаются лежать на земле
function Stars.drop(session: Session, reason: string)
	local carry = session.carrying
	if not carry then
		return
	end
	session.carrying = nil
	local root = Util.rootOf(session.player)
	local position = (root and root.Position) or session.lastPosition or Vector3.new(0, 3, 0)
	if carry.model then
		carry.model:Destroy()
	end
	Stars.applySpeed(session)
	Sessions.markDirty(session)

	local owner = carry.owner
	if carry.from == "steal" and owner and Sessions.isActive(owner) then
		local slot = Bases.placeBest(owner, carry.t, carry.m, carry.slot)
		if slot then
			Sessions.notify(owner, "n_returned", Util.starArg(carry.t, carry.m))
			if reason == "bonk" then
				Sessions.notify(session, "n_dropped_home", Util.starArg(carry.t, carry.m))
			end
			return
		end
	end
	local ground = World.baseAt(position) and World.FLOOR_TOP or World.FIELD_TOP
	createFieldStar(carry.t, carry.m, Vector3.new(position.X, ground + 3, position.Z), Config.Fall.dropLife)
	if reason == "bonk" then
		Sessions.notify(session, "n_dropped", Util.starArg(carry.t, carry.m))
	end
end

-- Звезду донесли до своей базы
function Stars.deliver(session: Session)
	local carry = session.carrying
	if not carry then
		return
	end
	session.carrying = nil
	if carry.model then
		carry.model:Destroy()
	end
	Stars.applySpeed(session)

	local slot = Bases.placeBest(session, carry.t, carry.m)
	if slot then
		Sessions.push(session, "delivered", { t = carry.t, m = carry.m or "", stolen = carry.from == "steal" })
	else
		local value = Logic.sellValue(carry.t, carry.m)
		Sessions.addCoins(session, value, true)
		Sessions.notify(session, "n_full_sold", Util.starArg(carry.t, carry.m), Logic.format(value))
	end
	if carry.from == "steal" then
		session.data.stats.stolen += 1
		local owner = carry.owner
		local ownerName = "?"
		if owner then
			ownerName = owner.player.DisplayName
			if Sessions.isActive(owner) then
				owner.data.stats.lost += 1
				Sessions.markDirty(owner)
			end
		end
		Sessions.announce("n_stolen", Logic.rarityOf(carry.t), session.player.DisplayName, Util.starArg(carry.t, carry.m), ownerName)
	end
	if session.data.tutorial == 1 then
		session.data.tutorial = 2
	end
	Sessions.markDirty(session)
end

---------------------------------------------------------------------
-- Метеоритный дождь
---------------------------------------------------------------------

function Stars.startShower(duration: number, byName: string?)
	showerUntil = math.max(showerUntil, now()) + duration
	ReplicatedStorage:SetAttribute("ShowerEnds", showerUntil)
	if byName then
		Sessions.announce("n_shower_bought", "mythic", byName)
	else
		Sessions.announce("n_shower", "legendary")
	end
end

---------------------------------------------------------------------

function Stars.start()
	ReplicatedStorage:SetAttribute("ShowerEnds", 0)

	-- звездопад
	task.spawn(function()
		local nextDrop = os.clock() + 2
		while true do
			task.wait(0.25)
			local shower = Stars.showerActive()
			local clock = os.clock()
			if clock >= nextDrop then
				nextDrop = clock + (shower and Config.Shower.interval or rng:NextNumber(Config.Fall.minInterval, Config.Fall.maxInterval))
				local limit = shower and Config.Shower.maxStars or Config.Fall.maxStars
				if #Players:GetPlayers() > 0 and Stars.fieldCount() < limit then
					Util.try("fall", Stars.dropFromSky, shower and Config.Shower.luck or nil)
				end
			elseif shower and nextDrop - clock > Config.Shower.interval then
				-- дождь только начался: не ждём обычной паузы
				nextDrop = clock + Config.Shower.interval
			end
		end
	end)

	-- метеоритный дождь по расписанию
	task.spawn(function()
		while true do
			task.wait(rng:NextNumber(Config.Shower.minGap, Config.Shower.maxGap))
			if #Players:GetPlayers() > 0 then
				Stars.startShower(Config.Shower.duration)
			end
		end
	end)

	-- звёзды на поле исчезают со временем
	task.spawn(function()
		while true do
			task.wait(0.5)
			local t = now()
			for id, star in pairs(field) do
				if t > star.expires then
					removeFieldStar(id)
				end
			end
		end
	end)

	-- донёс ли игрок звезду до своей базы
	task.spawn(function()
		while true do
			task.wait(0.2)
			for _, session in pairs(Sessions.active) do
				local root = Util.rootOf(session.player)
				if root then
					session.lastPosition = root.Position
				end
				local carry = session.carrying
				if carry then
					local base = Bases.info(session)
					if root and base and World.inside(base, root.Position) then
						Util.try("deliver", Stars.deliver, session)
					elseif not carry.model or not carry.model.Parent then
						-- персонаж пропал вместе со звездой
						Util.try("drop", Stars.drop, session, "lost")
					end
				end
			end
		end
	end)
end

return Stars
