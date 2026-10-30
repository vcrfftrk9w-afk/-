-- The factory panel: a row per unit kind the factory makes («+1» orders one, «Авто» repeats
-- it), the current order with its progress, the queue, «Отменить последний» and the rally
-- point. Part of the interface; Ui puts it together.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Sprites = require(script.Parent.Sprites)
local Theme = require(script.Parent.Theme)
local Widgets = require(script.Parent.Widgets)

local make = Theme.make
local C = Theme.C
local font = Theme.font
local icon = Widgets.icon

local Factory = {}

-- ctx: { UI = the interface, refs = shared widget references, color = the player's team colour }
local ctx, refs

function Factory.build(context, play: Instance)
	ctx, refs = context, context.refs
	local UI = ctx.UI
	local fac = Theme.panel({
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -120),
		Size = UDim2.fromOffset(420, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Color3.fromRGB(16, 21, 34),
		BackgroundTransparency = 0.02,
		Visible = false,
		ZIndex = 8,
		Parent = play,
	})
	Theme.pad(14, 12).Parent = fac
	local facClose = Widgets.iconButton("close", fac, function()
		Factory.hide()
	end)
	facClose.AnchorPoint = Vector2.new(1, 0)
	facClose.Position = UDim2.new(1, 0, 0, -2)
	facClose.Size = UDim2.fromOffset(36, 36)
	facClose.ZIndex = 10
	local body = make("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, ZIndex = 9, Parent = fac }, {
		Theme.list(Enum.FillDirection.Vertical, 8),
	})
	refs.facTitle = Theme.label({ Text = "", Size = UDim2.new(1, -50, 0, 22), TextSize = 18, FontFace = font(Enum.FontWeight.Heavy), ZIndex = 9, LayoutOrder = 1, Parent = body })
	refs.facSub = Theme.label({ Text = "", Size = UDim2.new(1, -50, 0, 16), TextSize = 12.5, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), ZIndex = 9, LayoutOrder = 2, Parent = body })
	refs.facRows = make("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, ZIndex = 9, LayoutOrder = 3, Parent = body }, {
		Theme.list(Enum.FillDirection.Vertical, 6),
	})
	local barBg = make("Frame", { Size = UDim2.new(1, 0, 0, 8), BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.9, ZIndex = 9, LayoutOrder = 4, Parent = body }, { Theme.corner(nil, 1) })
	refs.facBar = make("Frame", { Size = UDim2.fromScale(0, 1), BackgroundColor3 = C.molten, ZIndex = 10, Parent = barBg }, { Theme.corner(nil, 1) })
	refs.facQueue = Theme.label({ Text = "", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 13, FontFace = font(Enum.FontWeight.Bold), ZIndex = 9, LayoutOrder = 5, Parent = body })
	local buttons = make("Frame", { Size = UDim2.new(1, 0, 0, 36), BackgroundTransparency = 1, ZIndex = 9, LayoutOrder = 6, Parent = body }, {
		make("UIGridLayout", { CellSize = UDim2.new(0.5, -4, 1, 0), CellPadding = UDim2.fromOffset(8, 0), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	local cancel = make("TextButton", { Text = "Отменить последний", AutoButtonColor = true, FontFace = font(Enum.FontWeight.Bold), TextSize = 13, TextColor3 = C.ink, BackgroundColor3 = C.panelHi, LayoutOrder = 1, ZIndex = 10, Parent = buttons }, { Theme.corner(10) })
	cancel.Activated:Connect(function()
		if UI.onCancel and UI.factoryId then
			UI.onCancel(UI.factoryId)
		end
	end)
	local rally = make("TextButton", { Text = "", AutoButtonColor = true, BackgroundColor3 = C.panelHi, LayoutOrder = 2, ZIndex = 10, Parent = buttons }, { Theme.corner(10) })
	icon("flag", 20, { Position = UDim2.new(0, 10, 0.5, -10), ZIndex = 11, Parent = rally })
	Theme.label({ Text = "Точка сбора", Position = UDim2.fromOffset(36, 0), Size = UDim2.new(1, -40, 1, 0), TextSize = 13, FontFace = font(Enum.FontWeight.Bold), ZIndex = 11, Parent = rally })
	rally.Activated:Connect(function()
		if UI.onRally and UI.factoryId then
			UI.onRally(UI.factoryId)
		end
	end)
	refs.facNote = Theme.label({ Text = "", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextWrapped = true, TextSize = 12, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), ZIndex = 9, LayoutOrder = 7, Parent = body })
	refs.fac = fac
end

local function factoryRow(kind: string, order: number)
	local UI = ctx.UI
	local u = Config.UNITS[kind]
	local row = make("Frame", { Size = UDim2.new(1, 0, 0, 58), BackgroundColor3 = C.panelHi, LayoutOrder = order, ZIndex = 9, Parent = refs.facRows }, {
		Theme.corner(12),
	})
	local stroke = make("UIStroke", { Color = C.molten, Thickness = 1.5, Transparency = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Parent = row })
	local img = icon(u.icon, 46, { Position = UDim2.fromOffset(6, 6), ZIndex = 10, color = ctx.color, Parent = row })
	Theme.label({ Text = u.title, Position = UDim2.fromOffset(58, 6), Size = UDim2.new(1, -200, 0, 20), TextSize = 15, FontFace = font(Enum.FontWeight.Heavy), ZIndex = 10, Parent = row })
	local info = Theme.label({
		Text = string.format("%d 🔩 · %d с · здоровье %d", u.cost, u.time, u.hp),
		Position = UDim2.fromOffset(58, 27),
		Size = UDim2.new(1, -200, 0, 16),
		TextSize = 12,
		TextColor3 = Color3.fromRGB(198, 207, 221),
		FontFace = font(Enum.FontWeight.SemiBold),
		ZIndex = 10,
		Parent = row,
	})
	local queued = Theme.label({ Text = "", Position = UDim2.fromOffset(58, 42), Size = UDim2.new(1, -200, 0, 14), TextSize = 11.5, TextColor3 = C.moltenHi, FontFace = font(Enum.FontWeight.Bold), ZIndex = 10, Parent = row })
	local auto = make("TextButton", {
		Text = "Авто",
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -78, 0.5, 0),
		Size = UDim2.fromOffset(56, 38),
		AutoButtonColor = true,
		FontFace = font(Enum.FontWeight.Bold),
		TextSize = 13,
		TextColor3 = C.ink,
		BackgroundColor3 = C.panel,
		ZIndex = 10,
		Parent = row,
	}, { Theme.corner(10) })
	auto.Activated:Connect(function()
		if UI.onAuto and UI.factoryId then
			UI.onAuto(UI.factoryId, if refs.facAutoKind == kind then "" else kind)
		end
	end)
	local plus = make("TextButton", {
		Text = "",
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -8, 0.5, 0),
		Size = UDim2.fromOffset(64, 40),
		AutoButtonColor = false,
		BackgroundColor3 = Color3.new(1, 1, 1),
		ZIndex = 10,
		Parent = row,
	}, { Theme.corner(10), Theme.molten(90) })
	Theme.label({ Text = "+1", Size = UDim2.fromScale(1, 1), TextSize = 18, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.moltenInk, TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 11, Parent = plus })
	plus.Activated:Connect(function()
		if UI.onQueue and UI.factoryId then
			UI.onQueue(UI.factoryId, kind)
		end
	end)
	return { kind = kind, row = row, stroke = stroke, icon = img, info = info, queued = queued, auto = auto }
end

-- info: { id, kind, prog, built, queue = { unit kinds }, auto = kind or "", wait = what a
-- stopped factory waits for ("metal" or "army"), slow = the base is short of energy,
-- done = finished research { [tech id] = true } }
function Factory.show(info)
	local UI = ctx.UI
	local def = Config.BUILD[info.kind]
	UI.hideResearch()
	UI.factoryId = info.id
	UI.selectBuild(nil)
	if refs.facKind ~= info.kind then
		refs.facKind = info.kind
		for _, r in refs.facRowList or {} do
			r.row:Destroy()
		end
		refs.facRowList = {}
		for i, kind in def.units do
			table.insert(refs.facRowList, factoryRow(kind, i))
		end
	end
	refs.facTitle.Text = def.name
	local queue = info.queue or {}
	local auto = info.auto or ""
	refs.facAutoKind = auto
	local counts = {}
	for _, kind in queue do
		counts[kind] = (counts[kind] or 0) + 1
	end
	local money = refs.money or 0
	local done = info.done or {}
	for _, r in refs.facRowList do
		local u = Config.UNITS[r.kind]
		local n = counts[r.kind] or 0
		local locked = u.needs ~= nil and not done[u.needs]
		r.queued.Text = if locked then "🔒 нужно изучить: " .. Config.TECH[u.needs].name
			elseif n > 0 then "в очереди: " .. n
			elseif auto == r.kind then "выпускается по кругу"
			else ""
		r.stroke.Transparency = if auto == r.kind then 0 else 1
		r.auto.BackgroundColor3 = if auto == r.kind then Color3.fromRGB(70, 42, 18) else C.panel
		r.auto.TextColor3 = if auto == r.kind then C.moltenHi else C.ink
		r.info.TextColor3 = if money < u.cost or locked then C.bad else Color3.fromRGB(198, 207, 221)
		Sprites.apply(r.icon, u.icon, ctx.color)
		Sprites.setTransparency(r.icon, if locked then 0.55 else 0)
	end
	local built = info.built or 1
	local p = math.abs(info.prog or 0)
	local current = queue[1] or (if auto ~= "" then auto else nil)
	if built < 1 then
		refs.facSub.Text = string.format("Строится: %d%%. Заказы можно делать уже сейчас.", math.floor(built * 100))
		refs.facBar.Size = UDim2.fromScale(built, 1)
		refs.facBar.BackgroundColor3 = Color3.fromRGB(90, 170, 255)
		refs.facQueue.Text = if #queue > 0 then "В очереди: " .. #queue else "Очередь пустая"
	elseif current then
		refs.facSub.Text = if info.slow then "Мало энергии: завод работает медленнее. Построй электростанцию." else "Нажми «+1», чтобы заказать. Юнит появится у постройки."
		refs.facBar.Size = UDim2.fromScale(p, 1)
		refs.facBar.BackgroundColor3 = if (info.prog or 0) < 0 then C.bad else C.molten
		local state = math.floor(p * 100) .. "%"
		if (info.prog or 0) < 0 then
			state = if info.wait == "army" then "ждёт: армия полная" else "ждёт металла"
		end
		refs.facQueue.Text = string.format("Сейчас: %s — %s", Config.UNITS[current].title, state)
			.. (if #queue > 1 then string.format(" · ещё в очереди: %d", #queue - 1) else "")
	else
		refs.facSub.Text = "Нажми «+1», чтобы заказать. Юнит появится у постройки."
		refs.facBar.Size = UDim2.fromScale(0, 1)
		refs.facQueue.Text = "Очередь пустая"
	end
	refs.facNote.Text = "«Авто» выпускает выбранный юнит по кругу, пока хватает металла. «Точка сбора»: нажми её, потом место на карте."
	refs.tip.Visible = false
	refs.fac.Visible = true
end

function Factory.hide()
	ctx.UI.factoryId = nil
	refs.fac.Visible = false
end

return Factory
