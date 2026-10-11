-- Базы игроков: пьедесталы со звёздами, доход, сбор монет, продажа и замок.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Logic = require(Shared:WaitForChild("Logic"))

local Sessions = require(script.Parent.Sessions)
local World = require(script.Parent.World)
local Util = require(script.Parent.Util)
local StarVisuals = require(script.Parent.StarVisuals)

type Session = Sessions.Session

local Bases = {}

local owners: { [number]: Session } = {}

local CLOSED_CAP = Color3.fromRGB(80, 80, 100)

local function now(): number
	return workspace:GetServerTimeNow()
end

function Bases.ownerOf(index: number): Session?
	local session = owners[index]
	if session and Sessions.isActive(session) then
		return session
	end
	return nil
end

function Bases.info(session: Session): World.Base?
	return session.base and World.bases[session.base] or nil
end

function Bases.isLocked(session: Session): boolean
	return session.lockedUntil > now()
end

---------------------------------------------------------------------
-- Пьедесталы
---------------------------------------------------------------------

local function renderSlot(session: Session, base: World.Base, pedestal: World.Pedestal, slots: number, mult: number)
	local star = session.data.stars[tostring(pedestal.slot)]
	local wantId = star and star.t or ""
	local wantMut = star and star.m or ""
	local existing = base.stars:FindFirstChild("Slot" .. pedestal.slot)
	if existing and (existing:GetAttribute("Star") ~= wantId or existing:GetAttribute("Mut") ~= wantMut) then
		existing:Destroy()
		existing = nil
	end
	if star and not existing then
		local model = StarVisuals.build(star.t, star.m, pedestal.starCFrame, base.stars)
		model.Name = "Slot" .. pedestal.slot
	end
	local open = pedestal.slot <= slots
	local part = pedestal.part
	part:SetAttribute("Star", wantId)
	part:SetAttribute("Mut", wantMut)
	part:SetAttribute("Income", star and Logic.starIncome(star.t, star.m, mult) or 0)
	part:SetAttribute("Open", open)
	pedestal.cap.Color = open and base.color or CLOSED_CAP
	pedestal.cap.Material = open and Enum.Material.Neon or Enum.Material.SmoothPlastic
end

-- Перерисовать один пьедестал или всю базу
function Bases.render(session: Session, slot: number?)
	local base = Bases.info(session)
	if not base then
		return
	end
	local slots = Logic.slotCount(session.data, session.passes)
	local mult = Logic.incomeMult(session.data, session.passes)
	for _, pedestal in ipairs(base.pedestals) do
		if not slot or pedestal.slot == slot then
			renderSlot(session, base, pedestal, slots, mult)
		end
	end
end

-- Состояние дверей храним отдельно: клиент хозяина делает свою дверь проходимой у себя
local doorLocked: { [number]: boolean } = {}

local function setDoor(base: World.Base, locked: boolean)
	doorLocked[base.index] = locked
	base.door.CanCollide = locked
	base.door.Transparency = locked and 0.45 or 1
end

local function clearBase(base: World.Base)
	base.stars:ClearAllChildren()
	for _, pedestal in ipairs(base.pedestals) do
		local part = pedestal.part
		part:SetAttribute("Star", "")
		part:SetAttribute("Mut", "")
		part:SetAttribute("Income", 0)
		part:SetAttribute("Open", false)
		pedestal.cap.Color = CLOSED_CAP
		pedestal.cap.Material = Enum.Material.SmoothPlastic
	end
	base.model:SetAttribute("OwnerId", 0)
	base.model:SetAttribute("OwnerName", "")
	base.model:SetAttribute("Bank", 0)
	base.model:SetAttribute("LockedUntil", 0)
	setDoor(base, false)
	Util.localize(base.sign, "sign_free")
end

function Bases.freeSlot(session: Session, preferred: number?): number?
	local slots = Logic.slotCount(session.data, session.passes)
	local stars = session.data.stars
	if preferred and preferred >= 1 and preferred <= slots and not stars[tostring(preferred)] then
		return preferred
	end
	for slot = 1, slots do
		if not stars[tostring(slot)] then
			return slot
		end
	end
	return nil
end

-- Новая звезда в Звездопедии: небольшой бонус монетами
function Bases.discover(session: Session, starId: string)
	if session.data.index[starId] then
		return
	end
	session.data.index[starId] = true
	local bonus = Logic.baseIncome(starId, nil) * Config.IndexBonusSeconds
	Sessions.addCoins(session, bonus, true)
	Sessions.notify(session, "n_index_new", Util.starArg(starId, nil), Logic.format(bonus))
end

-- Ставит звезду на свободный пьедестал. Возвращает номер пьедестала или nil, если места нет.
function Bases.place(session: Session, starId: string, mut: string?, preferred: number?): number?
	if not session.base then
		return nil
	end
	local slot = Bases.freeSlot(session, preferred)
	if not slot then
		return nil
	end
	session.data.stars[tostring(slot)] = { t = starId, m = mut }
	Bases.discover(session, starId)
	Bases.render(session, slot)
	Sessions.markDirty(session)
	return slot
end

-- Ставит звезду, а если места нет и новая звезда лучше — продаёт самую слабую
function Bases.placeBest(session: Session, starId: string, mut: string?, preferred: number?): number?
	local slot = Bases.place(session, starId, mut, preferred)
	if slot or not session.base then
		return slot
	end
	local weakest, income = Bases.weakest(session)
	if weakest and income < Logic.baseIncome(starId, mut) then
		Bases.sell(session, weakest)
		return Bases.place(session, starId, mut, weakest)
	end
	return nil
end

-- Забирает звезду с пьедестала (для кражи)
function Bases.take(session: Session, slot: number): (string?, string?)
	local key = tostring(slot)
	local star = session.data.stars[key]
	if not star then
		return nil, nil
	end
	session.data.stars[key] = nil
	Bases.render(session, slot)
	Sessions.markDirty(session)
	return star.t, star.m
end

function Bases.sell(session: Session, slot: any)
	if type(slot) ~= "number" or slot ~= slot then
		return
	end
	slot = math.floor(slot)
	local key = tostring(slot)
	local star = session.data.stars[key]
	if not star then
		return
	end
	local value = Logic.sellValue(star.t, star.m)
	session.data.stars[key] = nil
	Bases.render(session, slot)
	Sessions.addCoins(session, value, true)
	Sessions.push(session, "sold", { t = star.t, m = star.m or "", v = value })
	Sessions.markDirty(session)
end

-- Самая слабая звезда на базе (чтобы освободить место)
function Bases.weakest(session: Session): (number?, number)
	local slot, income = nil, math.huge
	for key, star in pairs(session.data.stars) do
		local value = Logic.baseIncome(star.t, star.m)
		if value < income then
			slot = tonumber(key)
			income = value
		end
	end
	return slot, income
end

---------------------------------------------------------------------
-- Монеты
---------------------------------------------------------------------

local function showBank(session: Session)
	local base = Bases.info(session)
	if base then
		base.model:SetAttribute("Bank", math.floor(session.data.bank))
	end
end

function Bases.collect(session: Session, silent: boolean?)
	local amount = math.floor(session.data.bank)
	if amount <= 0 then
		return
	end
	session.data.bank -= amount
	Sessions.addCoins(session, amount, true)
	showBank(session)
	if not silent then
		Sessions.push(session, "collected", amount)
	end
	if session.data.tutorial == 2 then
		session.data.tutorial = 3
	end
	Sessions.markDirty(session)
end

-- Доход, пока игрока не было в игре
function Bases.offlineIncome(session: Session)
	local data = session.data
	if data.savedAt <= 0 then
		return
	end
	local away = math.clamp(os.time() - data.savedAt, 0, Config.OfflineSeconds)
	local amount = math.floor(away * Logic.totalIncome(data, session.passes))
	if amount > 0 then
		data.bank += amount
		showBank(session)
		Sessions.notify(session, "n_offline", Logic.format(amount))
	end
end

---------------------------------------------------------------------
-- Замок
---------------------------------------------------------------------

local function playerFromHit(hit: BasePart): Player?
	local model = hit:FindFirstAncestorOfClass("Model")
	if not model then
		return nil
	end
	return Players:GetPlayerFromCharacter(model)
end

-- Чужие игроки внутри закрытой базы выходят за дверь
local function kickIntruders(base: World.Base, owner: Session)
	for _, player in ipairs(Players:GetPlayers()) do
		if player ~= owner.player then
			local root = Util.rootOf(player)
			if root and World.inside(base, root.Position) then
				local character = player.Character
				if character then
					character:PivotTo(base.outside)
				end
				local session = Sessions.get(player)
				if session then
					Sessions.notify(session, "n_kicked_out")
				end
			end
		end
	end
end

function Bases.lock(session: Session, seconds: number?)
	local base = Bases.info(session)
	if not base or Bases.isLocked(session) then
		return
	end
	local duration = seconds or Logic.lockSeconds(session.data)
	session.lockedUntil = now() + duration
	base.model:SetAttribute("LockedUntil", session.lockedUntil)
	setDoor(base, true)
	kickIntruders(base, session)
	if session.data.tutorial == 3 then
		session.data.tutorial = 4
		Sessions.notify(session, "n_tutorial_done")
	end
	Sessions.notify(session, "n_locked", tostring(math.floor(duration)))
	Sessions.markDirty(session)
end

-- Кнопка «Замок» на экране: работает, только когда игрок на своей базе
function Bases.requestLock(session: Session)
	local base = Bases.info(session)
	local root = Util.rootOf(session.player)
	if not base then
		Sessions.notify(session, "n_no_base")
		return
	end
	if Bases.isLocked(session) then
		Sessions.notify(session, "n_lock_active")
		return
	end
	if not root or not World.inside(base, root.Position) then
		Sessions.notify(session, "n_lock_far")
		return
	end
	Bases.lock(session)
end

---------------------------------------------------------------------
-- Назначение базы
---------------------------------------------------------------------

function Bases.assign(session: Session): boolean
	for index = 1, #World.bases do
		if not Bases.ownerOf(index) then
			owners[index] = session
			session.base = index
			local base = World.bases[index]
			base.model:SetAttribute("OwnerId", session.player.UserId)
			base.model:SetAttribute("OwnerName", session.player.DisplayName)
			Util.localize(base.sign, "sign_base", session.player.DisplayName)
			showBank(session)
			Bases.render(session)
			return true
		end
	end
	return false
end

function Bases.release(session: Session)
	local index = session.base
	if not index then
		return
	end
	if owners[index] == session then
		owners[index] = nil
		clearBase(World.bases[index])
	end
	session.base = nil
end

function Bases.teleportHome(session: Session)
	local character = session.player.Character
	if not character then
		return
	end
	local base = Bases.info(session)
	character:PivotTo(base and base.spawn or CFrame.new(0, 5, 0))
end

---------------------------------------------------------------------

function Bases.start()
	for _, base in ipairs(World.bases) do
		base.collectPad.Touched:Connect(function(hit)
			local player = playerFromHit(hit)
			local session = player and Sessions.get(player)
			if session and session.ready and session.base == base.index then
				Bases.collect(session)
			end
		end)
		base.lockPad.Touched:Connect(function(hit)
			local player = playerFromHit(hit)
			local session = player and Sessions.get(player)
			if session and session.ready and session.base == base.index and not Bases.isLocked(session) then
				Bases.lock(session)
			end
		end)
	end

	-- доход каждую секунду
	task.spawn(function()
		while true do
			task.wait(1)
			for _, session in pairs(Sessions.active) do
				if session.ready and session.base then
					local income = Logic.totalIncome(session.data, session.passes)
					if income > 0 then
						session.data.bank += income
						if session.passes.autocollect then
							Bases.collect(session, true)
						end
						showBank(session)
						Sessions.markDirty(session)
					end
				end
			end
		end
	end)

	-- двери: закрыть, открыть, выгнать чужих
	task.spawn(function()
		while true do
			task.wait(0.25)
			for _, base in ipairs(World.bases) do
				local owner = Bases.ownerOf(base.index)
				local locked = owner ~= nil and Bases.isLocked(owner)
				if (doorLocked[base.index] == true) ~= locked then
					setDoor(base, locked)
					if owner and not locked then
						base.model:SetAttribute("LockedUntil", 0)
						Sessions.notify(owner, "n_unlocked")
						Sessions.markDirty(owner)
					end
				end
				if owner and locked then
					kickIntruders(base, owner)
				end
			end
		end
	end)
end

return Bases
