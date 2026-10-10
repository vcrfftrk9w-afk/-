-- Сады игроков: посадка, рост, плоды, сбор урожая, лопата, погода в саду.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Logic = require(Shared:WaitForChild("Logic"))

local Sessions = require(script.Parent.Sessions)
local World = require(script.Parent.World)
local PlantVisuals = require(script.Parent.PlantVisuals)
local Util = require(script.Parent.Util)

type Session = Sessions.Session

type Visual = {
	model: Model,
	body: Model?,
	fruits: { [string]: BasePart },
	anchors: { CFrame },
	stage: number,
}

local Garden = {}

local owners: { [number]: Session } = {}
local visuals: { [number]: { [number]: Visual } } = {}

local weatherGrowth: () -> number = function()
	return 1
end

function Garden.setWeatherGrowth(fn: () -> number)
	weatherGrowth = fn
end

local function plotOf(session: Session): World.Plot?
	local index = session.plot
	if index and owners[index] == session then
		return World.plots[index]
	end
	return nil
end

local function seedOf(plant)
	return Config.SeedById[plant.id]
end

local function speedOf(session: Session): number
	return Logic.growSpeed(session.data, session.bonus, weatherGrowth())
end

---------------------------------------------------------------------
-- Состояние грядки для клиента (атрибуты на детали грядки)
---------------------------------------------------------------------

local function updateTile(session: Session, tile: number)
	local plot = plotOf(session)
	if not plot or not plot.tiles[tile] then
		return
	end
	local part = plot.tiles[tile].part
	local data = session.data
	local plant = data.plot[tostring(tile)]
	part:SetAttribute("Locked", tile > Logic.unlockedTiles(data))
	if plant then
		local seed = seedOf(plant)
		part:SetAttribute("Seed", plant.id)
		part:SetAttribute("Fruits", Logic.fruitCount(plant))
		local remaining = math.max(0, seed.grow - plant.p)
		if remaining > 0 then
			part:SetAttribute("ReadyAt", workspace:GetServerTimeNow() + remaining / math.max(speedOf(session), 0.01))
		else
			part:SetAttribute("ReadyAt", 0)
		end
	else
		part:SetAttribute("Seed", "")
		part:SetAttribute("Fruits", 0)
		part:SetAttribute("ReadyAt", 0)
	end
end

local function paintTile(plot: World.Plot, tile: number, locked: boolean)
	local part = plot.tiles[tile].part
	if locked then
		part.Material = Enum.Material.Grass
		part.Color = Color3.fromRGB(95, 160, 80)
	else
		part.Material = Enum.Material.Ground
		part.Color = Color3.fromRGB(120, 82, 52)
	end
end

---------------------------------------------------------------------
-- Модели растений и плодов
---------------------------------------------------------------------

local function destroyVisual(plotIndex: number, tile: number)
	local byTile = visuals[plotIndex]
	local visual = byTile and byTile[tile]
	if visual then
		visual.model:Destroy()
		byTile[tile] = nil
	end
end

local function buildBody(session: Session, tile: number, plant, seed): Visual?
	local plot = plotOf(session)
	if not plot then
		return nil
	end
	local byTile = visuals[plot.index]
	local visual = byTile[tile]
	if not visual then
		local model = Instance.new("Model")
		model.Name = "Plant" .. tile
		model.Parent = plot.plants
		visual = { model = model, body = nil, fruits = {}, anchors = {}, stage = -1 }
		byTile[tile] = visual
	end
	local stage = Logic.stage(plant, seed)
	if visual.stage ~= stage or not visual.body then
		if visual.body then
			visual.body:Destroy()
		end
		local body, anchors = PlantVisuals.body(seed, plot.tiles[tile].top, PlantVisuals.stageScale[stage], visual.model)
		visual.body = body
		visual.anchors = anchors
		visual.stage = stage
	end
	return visual
end

local function showFruit(session: Session, tile: number, slot: string, plant, seed)
	local visual = buildBody(session, tile, plant, seed)
	local fruit = plant.f[slot]
	if not visual or not fruit then
		return
	end
	local old = visual.fruits[slot]
	if old then
		old:Destroy()
	end
	local plot = plotOf(session)
	local anchor = visual.anchors[tonumber(slot) or 1] or visual.anchors[1] or (plot and plot.tiles[tile].top) or CFrame.new()
	visual.fruits[slot] = PlantVisuals.fruit(seed, fruit, anchor, visual.model, slot)
end

local function refreshFruit(session: Session, tile: number, slot: string)
	local plot = plotOf(session)
	local byTile = plot and visuals[plot.index]
	local visual = byTile and byTile[tile]
	local plant = session.data.plot[tostring(tile)]
	if visual and plant and visual.fruits[slot] and plant.f[slot] then
		PlantVisuals.decorate(visual.fruits[slot], seedOf(plant), plant.f[slot])
	end
end

local function rebuildPlant(session: Session, tile: number)
	local plot = plotOf(session)
	if not plot then
		return
	end
	destroyVisual(plot.index, tile)
	local plant = session.data.plot[tostring(tile)]
	if plant then
		local seed = seedOf(plant)
		buildBody(session, tile, plant, seed)
		for slot in pairs(plant.f) do
			showFruit(session, tile, slot, plant, seed)
		end
	end
	updateTile(session, tile)
end

local function updateExtras(session: Session)
	local plot = plotOf(session)
	if not plot then
		return
	end
	plot.extras:ClearAllChildren()
	local level = session.data.upgrades.sprinkler or 1
	local spots = { Vector3.new(-23, 0, 23), Vector3.new(23, 0, 23), Vector3.new(-23, 0, -21), Vector3.new(23, 0, -21) }
	for i = 1, math.min(level - 1, #spots) do
		local base = plot.cframe * CFrame.new(spots[i])
		Util.part({
			name = "Sprinkler",
			shape = Enum.PartType.Cylinder,
			size = Vector3.new(2.2, 0.35, 0.35),
			cframe = Util.upright(base * CFrame.new(0, 1.1, 0)),
			color = Color3.fromRGB(150, 150, 165),
			material = Enum.Material.Metal,
			decor = true,
			parent = plot.extras,
		})
		local head = Util.part({
			name = "SprinklerHead",
			shape = Enum.PartType.Ball,
			size = Vector3.new(0.8, 0.8, 0.8),
			cframe = base * CFrame.new(0, 2.3, 0),
			color = Color3.fromRGB(80, 160, 255),
			decor = true,
			parent = plot.extras,
		})
		local spray = Instance.new("ParticleEmitter")
		spray.Color = ColorSequence.new(Color3.fromRGB(160, 215, 255))
		spray.LightEmission = 0.2
		spray.Size = NumberSequence.new(0.3, 0.05)
		spray.Transparency = NumberSequence.new(0.2, 1)
		spray.Lifetime = NumberRange.new(1, 1.3)
		spray.Rate = 16
		spray.Speed = NumberRange.new(8, 11)
		spray.SpreadAngle = Vector2.new(70, 70)
		spray.Acceleration = Vector3.new(0, -22, 0)
		spray.EmissionDirection = Enum.NormalId.Top
		spray.Parent = head
	end
end

---------------------------------------------------------------------
-- Хозяева садов
---------------------------------------------------------------------

function Garden.ownerOf(plotIndex: number): Session?
	return owners[plotIndex]
end

function Garden.assign(session: Session): boolean
	for index = 1, Config.MaxPlots do
		if not owners[index] then
			owners[index] = session
			session.plot = index
			visuals[index] = {}
			local plot = World.plots[index]
			plot.model:SetAttribute("OwnerId", session.player.UserId)
			plot.sign.Text = session.player.DisplayName
			Util.localize(plot.sign, "plot_owner", session.player.DisplayName)

			-- рост, пока игрока не было в игре (до 24 часов)
			local data = session.data
			if (data.savedAt or 0) > 0 then
				local elapsed = math.clamp(os.time() - data.savedAt, 0, 24 * 3600)
				local speed = Logic.growSpeed(data, session.bonus, 1)
				for _, plant in pairs(data.plot) do
					local seed = seedOf(plant)
					if seed and elapsed > 0 then
						Logic.advance(plant, seed, elapsed * speed, session.rng, session.bonus.luck)
					end
				end
			end

			local unlocked = Logic.unlockedTiles(data)
			for tile = 1, #plot.tiles do
				paintTile(plot, tile, tile > unlocked)
				rebuildPlant(session, tile)
			end
			updateExtras(session)
			return true
		end
	end
	return false
end

function Garden.release(session: Session)
	local index = session.plot
	if not index or owners[index] ~= session then
		return
	end
	local plot = World.plots[index]
	plot.plants:ClearAllChildren()
	plot.extras:ClearAllChildren()
	visuals[index] = nil
	owners[index] = nil
	session.plot = nil
	plot.model:SetAttribute("OwnerId", 0)
	plot.sign.Text = "plot_free"
	Util.localize(plot.sign, "plot_free")
	for tile, info in ipairs(plot.tiles) do
		paintTile(plot, tile, true)
		info.part:SetAttribute("Locked", true)
		info.part:SetAttribute("Seed", "")
		info.part:SetAttribute("Fruits", 0)
		info.part:SetAttribute("ReadyAt", 0)
	end
end

---------------------------------------------------------------------
-- Действия игрока
---------------------------------------------------------------------

function Garden.plant(session: Session, tile: any, seedId: any)
	if type(tile) ~= "number" or type(seedId) ~= "string" then
		return
	end
	tile = math.floor(tile)
	local plot = plotOf(session)
	if not plot then
		Sessions.notify(session, "n_no_plot")
		return
	end
	if tile < 1 or tile > #plot.tiles then
		return
	end
	local data = session.data
	if tile > Logic.unlockedTiles(data) then
		Sessions.notify(session, "n_tile_locked")
		return
	end
	local key = tostring(tile)
	if data.plot[key] then
		return
	end
	if not Config.SeedById[seedId] then
		return
	end
	if (data.seeds[seedId] or 0) <= 0 then
		Sessions.notify(session, "n_no_seeds")
		return
	end
	data.seeds[seedId] -= 1
	if data.seeds[seedId] <= 0 then
		data.seeds[seedId] = nil
	end
	data.plot[key] = Logic.newPlant(seedId)
	session.selected = seedId
	if data.tutorial == 0 then
		data.tutorial = 1
	end
	rebuildPlant(session, tile)
	Sessions.markDirty(session)
end

local function warnFull(session: Session)
	local now = os.clock()
	if now - session.lastFullWarning > 6 then
		session.lastFullWarning = now
		Sessions.notify(session, "n_basket_full")
	end
end

-- Переносит плод в корзину. Возвращает "full", если корзина полна.
local function collect(session: Session, tile: number, slot: string, effects: { any }?): string?
	local data = session.data
	local key = tostring(tile)
	local plant = data.plot[key]
	if not plant then
		return nil
	end
	local fruit = plant.f[slot]
	if not fruit then
		return nil
	end
	if #data.basket >= Logic.basketCapacity(data, session.passes) then
		return "full"
	end
	plant.f[slot] = nil
	table.insert(data.basket, { id = plant.id, s = fruit.s, c = fruit.c, w = fruit.w, g = fruit.g })
	data.stats.harvested += 1

	local plot = plotOf(session)
	local byTile = plot and visuals[plot.index]
	local visual = byTile and byTile[tile]
	if visual and visual.fruits[slot] then
		local part = visual.fruits[slot]
		if effects then
			table.insert(effects, { p = part.Position, c = part.Color })
		end
		part:Destroy()
		visual.fruits[slot] = nil
	end

	local seed = seedOf(plant)
	if seed and seed.harvest == "single" then
		data.plot[key] = nil
		if plot then
			destroyVisual(plot.index, tile)
		end
	end
	if data.tutorial == 1 then
		data.tutorial = 2
	end
	updateTile(session, tile)
	session.dirty = true
	return nil
end

function Garden.harvest(session: Session, tile: any)
	if type(tile) ~= "number" then
		return
	end
	tile = math.floor(tile)
	local plant = session.data.plot[tostring(tile)]
	if not plant then
		return
	end
	local slots = {}
	for slot in pairs(plant.f) do
		table.insert(slots, slot)
	end
	table.sort(slots)
	local effects = {}
	local full = false
	for _, slot in ipairs(slots) do
		if collect(session, tile, slot, effects) == "full" then
			full = true
			break
		end
	end
	if #effects > 0 then
		Sessions.push(session, "collect", effects)
	end
	if full then
		warnFull(session)
	end
end

function Garden.dig(session: Session, tile: any)
	if type(tile) ~= "number" then
		return
	end
	tile = math.floor(tile)
	local key = tostring(tile)
	if not session.data.plot[key] then
		return
	end
	Garden.harvest(session, tile)
	if session.data.plot[key] then
		session.data.plot[key] = nil
		local plot = plotOf(session)
		if plot then
			destroyVisual(plot.index, tile)
		end
		updateTile(session, tile)
		Sessions.notify(session, "n_dig")
		session.dirty = true
	end
end

function Garden.teleport(session: Session, cframe: CFrame)
	local character = session.player.Character
	if character and character.Parent then
		character:PivotTo(cframe)
	end
end

function Garden.teleportHome(session: Session)
	local plot = plotOf(session)
	Garden.teleport(session, plot and plot.spawn or World.spawn)
end

function Garden.onUpgrade(session: Session, key: string)
	local plot = plotOf(session)
	if not plot then
		return
	end
	if key == "tiles" then
		local unlocked = Logic.unlockedTiles(session.data)
		for tile = 1, #plot.tiles do
			paintTile(plot, tile, tile > unlocked)
			updateTile(session, tile)
		end
	elseif key == "sprinkler" then
		updateExtras(session)
		Garden.refreshSpeed(session)
	end
end

function Garden.refreshSpeed(session: Session)
	if not plotOf(session) then
		return
	end
	for key in pairs(session.data.plot) do
		local tile = tonumber(key)
		if tile then
			updateTile(session, tile)
		end
	end
end

function Garden.refreshAllSpeeds()
	for _, session in pairs(owners) do
		Util.try("speed", Garden.refreshSpeed, session)
	end
end

---------------------------------------------------------------------
-- Редкие плоды — сообщение всем или только хозяину
---------------------------------------------------------------------

local function announceFruit(session: Session, seedId: string, fruit)
	if not fruit then
		return
	end
	local seed = Config.SeedById[seedId]
	local order = Config.Rarities[seed.rarity].order
	local payload = { name = session.player.DisplayName, id = seedId, c = fruit.c, w = fruit.w, g = fruit.g }
	if fruit.c == "rainbow" or (fruit.c == "gold" and order >= 4) or (fruit.g and order >= 5) then
		Sessions.broadcast("rare", payload)
	elseif fruit.c or fruit.g then
		Sessions.push(session, "rareSelf", payload)
	end
end

---------------------------------------------------------------------
-- Рост и сбор магнитом
---------------------------------------------------------------------

local function growPlot(session: Session, dt: number)
	if not plotOf(session) then
		return
	end
	local speed = speedOf(session)
	local luck = session.bonus.luck
	for key, plant in pairs(session.data.plot) do
		local seed = seedOf(plant)
		local tile = tonumber(key)
		if seed and tile then
			local before = Logic.stage(plant, seed)
			local spawned, matured = Logic.advance(plant, seed, dt * speed, session.rng, luck)
			local after = Logic.stage(plant, seed)
			if after ~= before then
				buildBody(session, tile, plant, seed)
			end
			for _, slot in ipairs(spawned) do
				showFruit(session, tile, slot, plant, seed)
				announceFruit(session, plant.id, plant.f[slot])
			end
			if after ~= before or #spawned > 0 or matured then
				updateTile(session, tile)
			end
		end
	end
end

local function magnetPlot(session: Session)
	if not session.magnet then
		return
	end
	local plot = plotOf(session)
	local byTile = plot and visuals[plot.index]
	local character = session.player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not plot or not byTile or not root or not root:IsA("BasePart") then
		return
	end
	local radius = Logic.magnetRadius(session.data, session.passes)
	local position = root.Position
	local center = plot.cframe.Position
	local flat = Vector3.new(position.X - center.X, 0, position.Z - center.Z)
	if flat.Magnitude > Config.World.plotHalf * 1.5 + radius then
		return
	end
	local effects = {}
	local full = false
	for tile, visual in pairs(byTile) do
		for slot, part in pairs(visual.fruits) do
			local d = part.Position - position
			if d.X * d.X + d.Z * d.Z <= radius * radius and math.abs(d.Y) < 16 then
				if collect(session, tile, slot, effects) == "full" then
					full = true
					break
				end
			end
		end
		if full then
			break
		end
	end
	if #effects > 0 then
		Sessions.push(session, "collect", effects)
	end
	if full then
		warnFull(session)
	end
end

---------------------------------------------------------------------
-- Погода
---------------------------------------------------------------------

function Garden.applyWeather(def)
	for _, session in pairs(owners) do
		Util.try("weather", function()
			local luck = 1 + session.bonus.luck
			for key, plant in pairs(session.data.plot) do
				local tile = tonumber(key)
				for slot, fruit in pairs(plant.f) do
					local changed = false
					if def.mutation and Logic.betterWeatherMutation(fruit.w, def.mutation) and session.rng:NextNumber() < def.chance * luck then
						fruit.w = def.mutation
						changed = true
					end
					if def.rainbowChance and fruit.c ~= "rainbow" and session.rng:NextNumber() < def.rainbowChance * luck then
						fruit.c = "rainbow"
						changed = true
						announceFruit(session, plant.id, fruit)
					end
					if changed and tile then
						refreshFruit(session, tile, slot)
					end
				end
			end
		end)
	end
end

-- Молния бьёт в случайное растение с плодами. Возвращает место удара.
function Garden.strike(rng: Random): Vector3?
	local candidates = {}
	for _, session in pairs(owners) do
		for key, plant in pairs(session.data.plot) do
			if next(plant.f) ~= nil then
				table.insert(candidates, { session = session, key = key, plant = plant })
			end
		end
	end
	if #candidates == 0 then
		return nil
	end
	local pick = candidates[rng:NextInteger(1, #candidates)]
	local tile = tonumber(pick.key)
	for slot, fruit in pairs(pick.plant.f) do
		fruit.w = "shocked"
		if tile then
			refreshFruit(pick.session, tile, slot)
		end
	end
	Sessions.notify(pick.session, "n_lightning")
	local plot = plotOf(pick.session)
	if plot and tile and plot.tiles[tile] then
		return plot.tiles[tile].top.Position
	end
	return nil
end

-- Покупка «Вырастить всё»
function Garden.growAll(session: Session)
	local luck = session.bonus.luck
	for key, plant in pairs(session.data.plot) do
		local seed = seedOf(plant)
		local tile = tonumber(key)
		if seed and tile then
			local need = Logic.timeToFill(plant, seed)
			if need > 0 then
				local spawned = Logic.advance(plant, seed, need + 0.01, session.rng, luck)
				buildBody(session, tile, plant, seed)
				for _, slot in ipairs(spawned) do
					showFruit(session, tile, slot, plant, seed)
					announceFruit(session, plant.id, plant.f[slot])
				end
				updateTile(session, tile)
			end
		end
	end
	Sessions.notify(session, "n_grow_all")
end

function Garden.start()
	task.spawn(function()
		local last = os.clock()
		while true do
			task.wait(1)
			local now = os.clock()
			local dt = math.min(now - last, 5)
			last = now
			for _, session in pairs(owners) do
				Util.try("grow", growPlot, session, dt)
			end
		end
	end)
	task.spawn(function()
		while true do
			task.wait(0.2)
			for _, session in pairs(owners) do
				Util.try("magnet", magnetPlot, session)
			end
		end
	end)
end

return Garden
