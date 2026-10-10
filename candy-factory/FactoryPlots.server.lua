--[[
	КОНФЕТНАЯ ФАБРИКА — скрипт 2 из 2: ФАБРИКИ

	6 участков вокруг лобби. Каждый игрок получает свою фабрику:
	машины делают конфеты, конвейер везёт их в зелёный приёмник,
	приёмник превращает их в деньги. Встань на кнопку, чтобы купить
	следующую машину или улучшение. Фиолетовая кнопка — перерождение.

	Вставь в ServerScriptService как Script рядом с FactoryEconomy.
	В самом конце этого кода должна быть строчка "-- КОНЕЦ СКРИПТА".
]]

local Players = game:GetService("Players")
local Debris = game:GetService("Debris")

while not _G.Factory do
	task.wait(0.2)
end
local Factory = _G.Factory

local DROP_INTERVAL = 2 -- машина делает конфету раз в 2 секунды
local BELT_SPEED = 8

local PINK = Color3.fromRGB(255, 110, 180)

-- Всё, что можно купить, по порядку. requires — что нужно купить раньше.
local ITEMS = {
	{ id = "dropper1", name = "Конфетная машина", price = 0, slot = 1, value = 1, color = PINK },
	{ id = "dropper2", name = "Вторая машина", price = 40, slot = 2, value = 1, color = PINK, requires = "dropper1" },
	{ id = "dropper3", name = "Мармеладная машина", price = 150, slot = 3, value = 3, color = Color3.fromRGB(150, 255, 140), requires = "dropper2" },
	{ id = "walls", name = "Стены фабрики", price = 400, decor = true, requires = "dropper3" },
	{ id = "turbo", name = "Сахарный турбо +50%", price = 800, upgrade = true, requires = "dropper3" },
	{ id = "dropper4", name = "Шоколадная машина", price = 1500, slot = 4, value = 8, color = Color3.fromRGB(120, 70, 40), requires = "turbo" },
	{ id = "dropper5", name = "Леденцовая машина", price = 4000, slot = 5, value = 15, color = Color3.fromRGB(120, 220, 255), requires = "dropper4" },
	{ id = "double", name = "Двойная выдача x2", price = 9000, upgrade = true, requires = "dropper5" },
	{ id = "dropper6", name = "Радужная машина", price = 20000, slot = 6, value = 40, color = Color3.fromRGB(200, 140, 255), requires = "double" },
	{ id = "tower", name = "Конфетная башня", price = 35000, decor = true, requires = "dropper6" },
	{ id = "dropper7", name = "Золотая машина", price = 60000, slot = 7, value = 100, color = Color3.fromRGB(255, 200, 40), requires = "dropper6" },
}

local PLOT_POSITIONS = {
	Vector3.new(-80, 0, 70), Vector3.new(0, 0, 70), Vector3.new(80, 0, 70),
	Vector3.new(-80, 0, -70), Vector3.new(0, 0, -70), Vector3.new(80, 0, -70),
}

local root = workspace:FindFirstChild("Factories")
if root then
	root:Destroy()
end
root = Instance.new("Folder")
root.Name = "Factories"
root.Parent = workspace

local function part(parent, cframe, size, color, props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.Size = size
	p.CFrame = cframe
	p.Color = color
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for key, value in pairs(props or {}) do
		p[key] = value
	end
	p.Parent = parent
	return p
end

local function label(parent, text, color, height)
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(200, 60)
	gui.StudsOffset = Vector3.new(0, height or 3, 0)
	gui.MaxDistance = 70
	local text_ = Instance.new("TextLabel")
	text_.Name = "Text"
	text_.Size = UDim2.fromScale(1, 1)
	text_.BackgroundTransparency = 1
	text_.Text = text
	text_.TextScaled = true
	text_.Font = Enum.Font.FredokaOne
	text_.TextColor3 = color or Color3.new(1, 1, 1)
	text_.TextStrokeTransparency = 0
	text_.Parent = gui
	gui.Parent = parent
	return text_
end

---------------------------------------------------------------------
-- Участки
---------------------------------------------------------------------

local plots = {}

for index, position in ipairs(PLOT_POSITIONS) do
	-- локальная ось -Z смотрит на лобби (там вход и кнопки)
	local cf = CFrame.lookAt(position, Vector3.new(position.X, 0, 0))
	local folder = Instance.new("Folder")
	folder.Name = "Plot" .. index
	folder.Parent = root

	local function at(x, y, z)
		return cf * CFrame.new(x, y, z)
	end

	part(folder, at(0, 0.5, 0), Vector3.new(50, 1, 50), Color3.fromRGB(255, 235, 245))
	local belt = part(folder, at(-1.5, 1.5, 10), Vector3.new(39, 1, 4), Color3.fromRGB(60, 60, 70), { Material = Enum.Material.DiamondPlate })
	belt.AssemblyLinearVelocity = cf.RightVector * BELT_SPEED
	part(folder, at(-1.5, 2.5, 7.75), Vector3.new(39, 1, 0.5), Color3.fromRGB(255, 255, 255))
	part(folder, at(-1.5, 2.5, 12.25), Vector3.new(39, 1, 0.5), Color3.fromRGB(255, 255, 255))
	local collector = part(folder, at(19.5, 2.5, 10), Vector3.new(3, 3, 5), Color3.fromRGB(80, 230, 120), { Material = Enum.Material.Neon })
	label(collector, "💰 Приёмник", Color3.fromRGB(80, 230, 120))

	local signPost = part(folder, at(0, 9, -25), Vector3.new(1, 1, 1), PINK, { Transparency = 1, CanCollide = false })
	local signText = label(signPost, "Свободная фабрика", PINK, 0)

	local rebirthPad = part(folder, at(20, 1.2, -22), Vector3.new(5, 0.4, 5), Color3.fromRGB(170, 80, 255), { Material = Enum.Material.Neon })
	local rebirthText = label(rebirthPad, "ПЕРЕРОЖДЕНИЕ", Color3.fromRGB(200, 140, 255))

	local items = Instance.new("Folder")
	items.Name = "Items"
	items.Parent = folder
	local buttons = Instance.new("Folder")
	buttons.Name = "Buttons"
	buttons.Parent = folder

	plots[index] = {
		cf = cf,
		at = at,
		collector = collector,
		rebirthPad = rebirthPad,
		rebirthText = rebirthText,
		signText = signText,
		items = items,
		buttons = buttons,
		owner = nil,
		nextDrop = {},
	}
end

local function plotOf(player)
	for _, plot in ipairs(plots) do
		if plot.owner == player then
			return plot
		end
	end
end

---------------------------------------------------------------------
-- Постройки
---------------------------------------------------------------------

local function build(plot, item)
	local at = plot.at
	if item.slot then
		local x = -18 + (item.slot - 1) * 5.5
		local machine = part(plot.items, at(x, 9, 10), Vector3.new(3.5, 3, 3.5), item.color, { Name = item.id, Material = Enum.Material.SmoothPlastic })
		part(plot.items, at(x, 7, 10), Vector3.new(1.6, 1, 1.6), Color3.fromRGB(70, 70, 80))
		part(plot.items, at(x, 5, 13), Vector3.new(1, 9, 1), Color3.fromRGB(200, 200, 210))
		label(machine, item.name, item.color, 3)
	elseif item.id == "walls" then
		local wallColor = Color3.fromRGB(255, 190, 220)
		part(plot.items, at(-25, 5, 0), Vector3.new(1, 8, 50), wallColor)
		part(plot.items, at(25, 5, 0), Vector3.new(1, 8, 50), wallColor)
		part(plot.items, at(0, 5, 25), Vector3.new(50, 8, 1), wallColor)
		part(plot.items, at(-15, 5, -25), Vector3.new(20, 8, 1), wallColor)
		part(plot.items, at(15, 5, -25), Vector3.new(20, 8, 1), wallColor)
	elseif item.id == "tower" then
		for level = 0, 5 do
			local color = ({ PINK, Color3.fromRGB(120, 220, 255), Color3.fromRGB(255, 230, 90) })[level % 3 + 1]
			part(plot.items, at(-19, 2 + level * 3, 20) * CFrame.Angles(0, 0, math.rad(90)), Vector3.new(3, 6 - level * 0.6, 6 - level * 0.6), color, {
				Shape = Enum.PartType.Cylinder,
			})
		end
	elseif item.upgrade then
		local badge = part(plot.items, at(20.5, 6 + (item.id == "double" and 2 or 0), 10), Vector3.new(1, 1, 1), Color3.fromRGB(255, 230, 90), {
			Material = Enum.Material.Neon,
			Shape = Enum.PartType.Ball,
		})
		label(badge, item.name, Color3.fromRGB(255, 230, 90), 1.5)
	end
end

local refreshButtons -- объявим ниже

local function buyButton(plot, item, index)
	local x = -20 + ((index - 1) % 5) * 10
	local z = -8 - math.floor((index - 1) / 5) * 8
	local button = part(plot.buttons, plot.at(x, 1.2, z), Vector3.new(4, 0.4, 4), Color3.fromRGB(230, 70, 70), {
		Name = item.id,
		Material = Enum.Material.Neon,
	})
	label(button, item.name .. "\n💰 " .. Factory.format(item.price), Color3.new(1, 1, 1), 2.5)
	button:SetAttribute("Price", item.price)

	local busy = false
	button.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if busy or player ~= plot.owner then
			return
		end
		busy = true
		if Factory.trySpend(player, item.price) then
			Factory.grant(player, item.id)
			build(plot, item)
			Factory.notify(player, "✅ Куплено: " .. item.name, Color3.fromRGB(150, 255, 140))
			refreshButtons(plot)
		else
			Factory.notify(player, "Не хватает денег 💰", Color3.fromRGB(255, 140, 140))
			task.wait(1.5)
		end
		busy = false
	end)
end

refreshButtons = function(plot)
	plot.buttons:ClearAllChildren()
	local player = plot.owner
	if not player then
		return
	end
	for index, item in ipairs(ITEMS) do
		local available = not Factory.owns(player, item.id) and (not item.requires or Factory.owns(player, item.requires))
		if available then
			buyButton(plot, item, index)
		end
	end
end

local function rebuild(plot)
	plot.items:ClearAllChildren()
	plot.nextDrop = {}
	local player = plot.owner
	if player then
		Factory.grant(player, "dropper1")
		for _, item in ipairs(ITEMS) do
			if Factory.owns(player, item.id) then
				build(plot, item)
			end
		end
	end
	refreshButtons(plot)
end

---------------------------------------------------------------------
-- Хозяева участков
---------------------------------------------------------------------

local function teleportHome(player)
	local plot = plotOf(player)
	local character = player.Character
	if plot and character then
		local spot = plot.at(0, 4, -22)
		character:PivotTo(CFrame.lookAt(spot.Position, spot.Position + spot.LookVector * -1))
	end
end

local function assign(player)
	if plotOf(player) then
		return
	end
	for _, plot in ipairs(plots) do
		if not plot.owner then
			plot.owner = player
			plot.signText.Text = "Фабрика " .. player.DisplayName
			rebuild(plot)
			plot.characterConnection = player.CharacterAdded:Connect(function(character)
				character:WaitForChild("HumanoidRootPart")
				task.wait(0.2)
				teleportHome(player)
			end)
			teleportHome(player)
			return
		end
	end
	Factory.notify(player, "Все фабрики заняты 😢 Зайди на другой сервер")
end

Factory.Ready:Connect(assign)
for _, player in ipairs(Players:GetPlayers()) do
	if Factory.isReady(player) then
		assign(player)
	end
end

Players.PlayerRemoving:Connect(function(player)
	local plot = plotOf(player)
	if plot then
		if plot.characterConnection then
			plot.characterConnection:Disconnect()
		end
		plot.owner = nil
		plot.signText.Text = "Свободная фабрика"
		rebuild(plot)
	end
end)

---------------------------------------------------------------------
-- Приёмник, перерождение и производство
---------------------------------------------------------------------

for _, plot in ipairs(plots) do
	plot.collector.Touched:Connect(function(hit)
		if hit.Name ~= "Candy" or not plot.owner then
			return
		end
		local value = hit:GetAttribute("Value") or 0
		hit:Destroy()
		if value > 0 then
			Factory.addIncome(plot.owner, value)
		end
	end)

	local busy = false
	plot.rebirthPad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if busy or player ~= plot.owner then
			return
		end
		busy = true
		if Factory.doRebirth(player) then
			rebuild(plot)
			Factory.notify(player, "🌟 Перерождение! Теперь доход больше!", Color3.fromRGB(200, 140, 255))
		else
			Factory.notify(player, "Нужно " .. Factory.format(Factory.rebirthCost(player)) .. " 💰", Color3.fromRGB(255, 140, 140))
		end
		task.wait(2)
		busy = false
	end)
end

local function candyValue(player, item)
	return item.value * (Factory.owns(player, "turbo") and 1.5 or 1)
end

local function dropCandy(plot, item)
	local player = plot.owner
	local count = Factory.owns(player, "double") and 2 or 1
	local auto = Factory.hasAutoCollect(player)
	if auto then
		Factory.addIncome(player, candyValue(player, item) * count)
	end
	local x = -18 + (item.slot - 1) * 5.5
	for i = 1, count do
		local candy = part(plot.items, plot.at(x + (i - 1) * 0.6, 6, 10), Vector3.new(1.2, 1.2, 1.2), item.color, {
			Name = "Candy",
			Anchored = false,
			Shape = Enum.PartType.Ball,
			Material = Enum.Material.Neon,
		})
		candy:SetAttribute("Value", auto and 0 or candyValue(player, item))
		candy:SetNetworkOwner(nil)
		Debris:AddItem(candy, 15)
	end
end

task.spawn(function()
	while true do
		task.wait(0.25)
		local now = os.clock()
		for _, plot in ipairs(plots) do
			local player = plot.owner
			if player then
				for _, item in ipairs(ITEMS) do
					if item.slot and Factory.owns(player, item.id) and now >= (plot.nextDrop[item.id] or 0) then
						plot.nextDrop[item.id] = now + DROP_INTERVAL
						dropCandy(plot, item)
					end
				end
				-- кнопки: зелёные, если хватает денег
				local money = Factory.money(player)
				for _, button in ipairs(plot.buttons:GetChildren()) do
					local enough = money >= (button:GetAttribute("Price") or 0)
					button.Color = enough and Color3.fromRGB(70, 220, 100) or Color3.fromRGB(230, 70, 70)
				end
				plot.rebirthText.Text = "ПЕРЕРОЖДЕНИЕ\n💰 " .. Factory.format(Factory.rebirthCost(player))
			end
		end
	end
end)

print("[Factory] Фабрики готовы")

-- Эти строчки ничего не делают. Они нужны, чтобы было видно,
-- что код скопировался целиком, до самого конца.
-- КОНЕЦ СКРИПТА
-- запас от обрезки при копировании 1
-- запас от обрезки при копировании 2
-- запас от обрезки при копировании 3
-- запас от обрезки при копировании 4
-- запас от обрезки при копировании 5
-- запас от обрезки при копировании 6
-- запас от обрезки при копировании 7
-- запас от обрезки при копировании 8
-- запас от обрезки при копировании 9
-- запас от обрезки при копировании 10
-- запас от обрезки при копировании 11
-- запас от обрезки при копировании 12
-- запас от обрезки при копировании 13
-- запас от обрезки при копировании 14
-- запас от обрезки при копировании 15
-- запас от обрезки при копировании 16
-- запас от обрезки при копировании 17
-- запас от обрезки при копировании 18
-- запас от обрезки при копировании 19
-- запас от обрезки при копировании 20
-- КОНЕЦ СКРИПТА (запас)
