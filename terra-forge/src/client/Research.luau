-- The research panel of a research centre: every technology with what it does and its price,
-- the one being studied with its progress, and a button to stop it (the metal comes back).
-- Part of the interface; Ui puts it together.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Sfx = require(script.Parent.Sfx)
local Theme = require(script.Parent.Theme)
local Widgets = require(script.Parent.Widgets)

local make = Theme.make
local C = Theme.C
local font = Theme.font

local Research = {}

-- ctx: { UI = the interface, refs = shared widget references, color = the player's team colour }
local ctx, refs
local rows = {} -- tech id -> { button, label, stroke }
local current = nil -- the info shown, for the buttons

function Research.build(context, play: Instance)
	ctx, refs = context, context.refs
	local UI = ctx.UI
	local panel = Theme.panel({
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -120),
		Size = UDim2.fromOffset(460, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Color3.fromRGB(16, 21, 34),
		BackgroundTransparency = 0.02,
		Visible = false,
		ZIndex = 8,
		Parent = play,
	})
	Theme.pad(14, 12).Parent = panel
	local close = Widgets.iconButton("close", panel, function()
		Research.hide()
	end)
	close.AnchorPoint = Vector2.new(1, 0)
	close.Position = UDim2.new(1, 0, 0, -2)
	close.Size = UDim2.fromOffset(36, 36)
	close.ZIndex = 10
	local body = make("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, ZIndex = 9, Parent = panel }, {
		Theme.list(Enum.FillDirection.Vertical, 6),
	})
	Theme.label({ Text = Config.BUILD.lab.name, Size = UDim2.new(1, -50, 0, 22), TextSize = 18, FontFace = font(Enum.FontWeight.Heavy), ZIndex = 9, LayoutOrder = 1, Parent = body })
	refs.labSub = Theme.label({ Text = "", Size = UDim2.new(1, -50, 0, 16), TextSize = 12.5, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), ZIndex = 9, LayoutOrder = 2, Parent = body })
	local list = make("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, ZIndex = 9, LayoutOrder = 3, Parent = body }, {
		Theme.list(Enum.FillDirection.Vertical, 5),
	})
	for i, id in Config.TECH_ORDER do
		local t = Config.TECH[id]
		local row = make("Frame", { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = C.panelHi, LayoutOrder = i, ZIndex = 9, Parent = list }, { Theme.corner(12) })
		local stroke = make("UIStroke", { Color = C.molten, Thickness = 1.5, Transparency = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Parent = row })
		Widgets.icon(t.icon, 30, { Position = UDim2.fromOffset(8, 9), ZIndex = 10, color = ctx.color, Parent = row })
		Theme.label({ Text = t.name, Position = UDim2.fromOffset(46, 5), Size = UDim2.new(1, -170, 0, 18), TextSize = 14, FontFace = font(Enum.FontWeight.Heavy), ZIndex = 10, Parent = row })
		Theme.label({
			Text = t.desc,
			Position = UDim2.fromOffset(46, 23),
			Size = UDim2.new(1, -170, 0, 22),
			TextSize = 11.5,
			TextWrapped = true,
			TextYAlignment = Enum.TextYAlignment.Top,
			TextColor3 = Color3.fromRGB(198, 207, 221),
			FontFace = font(Enum.FontWeight.SemiBold),
			ZIndex = 10,
			Parent = row,
		})
		local button = make("TextButton", {
			Text = "",
			AnchorPoint = Vector2.new(1, 0.5),
			Position = UDim2.new(1, -7, 0.5, 0),
			Size = UDim2.fromOffset(112, 34),
			AutoButtonColor = true,
			BackgroundColor3 = C.panel,
			ZIndex = 10,
			Parent = row,
		}, { Theme.corner(10) })
		local label = Theme.label({
			Text = "",
			Size = UDim2.fromScale(1, 1),
			TextScaled = true,
			TextXAlignment = Enum.TextXAlignment.Center,
			FontFace = font(Enum.FontWeight.Bold),
			ZIndex = 11,
			Parent = button,
		}, { make("UITextSizeConstraint", { MaxTextSize = 13 }), Theme.pad(6, 4) })
		button.Activated:Connect(function()
			local info = current
			if not info or not UI.researchId then
				return
			end
			if info.research or info.done[id] then
				return
			end
			if t.needs and not info.done[t.needs] then
				UI.toast("Сначала изучи: " .. Config.TECH[t.needs].name, true)
				return
			end
			Sfx.play("click")
			if UI.onResearch then
				UI.onResearch(UI.researchId, id)
			end
		end)
		rows[id] = { button = button, label = label, stroke = stroke }
	end
	local barBg = make("Frame", { Size = UDim2.new(1, 0, 0, 8), BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.9, ZIndex = 9, LayoutOrder = 4, Parent = body }, { Theme.corner(nil, 1) })
	refs.labBar = make("Frame", { Size = UDim2.fromScale(0, 1), BackgroundColor3 = C.molten, ZIndex = 10, Parent = barBg }, { Theme.corner(nil, 1) })
	local foot = make("Frame", { Size = UDim2.new(1, 0, 0, 32), BackgroundTransparency = 1, ZIndex = 9, LayoutOrder = 5, Parent = body })
	refs.labNow = Theme.label({ Text = "", Size = UDim2.new(1, -150, 1, 0), TextSize = 13, TextWrapped = true, FontFace = font(Enum.FontWeight.Bold), ZIndex = 9, Parent = foot })
	local stop = make("TextButton", {
		Text = "Остановить",
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, 0, 0.5, 0),
		Size = UDim2.fromOffset(140, 32),
		AutoButtonColor = true,
		FontFace = font(Enum.FontWeight.Bold),
		TextSize = 13,
		TextColor3 = C.ink,
		BackgroundColor3 = C.panelHi,
		Visible = false,
		ZIndex = 10,
		Parent = foot,
	}, { Theme.corner(10) })
	stop.Activated:Connect(function()
		if UI.onStopResearch and UI.researchId then
			Sfx.play("click")
			UI.onStopResearch(UI.researchId)
		end
	end)
	refs.labStop = stop
	refs.lab = panel
end

-- info: { id, built, research = tech id being studied or nil, prog, done = { [tech id] = true },
-- money, slow = the base is short of energy }
function Research.show(info)
	local UI = ctx.UI
	current = info
	UI.researchId = info.id
	UI.selectBuild(nil)
	UI.hideFactory()
	local money = info.money or 0
	for id, r in rows do
		local t = Config.TECH[id]
		local text, color, ink = string.format("Изучить · %d 🔩", t.cost), C.molten, C.moltenInk
		if info.done[id] then
			text, color, ink = "✓ Изучено", Color3.fromRGB(28, 70, 44), C.ok
		elseif info.research == id then
			text, color, ink = "Изучается…", Color3.fromRGB(70, 42, 18), C.moltenHi
		elseif t.needs and not info.done[t.needs] then
			text, color, ink = "🔒 " .. Config.TECH[t.needs].name, C.panel, C.muted
		elseif info.research then
			text, color, ink = "Центр занят", C.panel, C.muted
		elseif money < t.cost then
			ink = C.bad
		end
		r.label.Text = text
		r.label.TextColor3 = ink
		r.button.BackgroundColor3 = color
		r.stroke.Transparency = if info.research == id then 0 else 1
	end
	local built = info.built or 1
	if built < 1 then
		refs.labSub.Text = string.format("Строится: %d%%. Изучать можно, когда достроят.", math.floor(built * 100))
		refs.labBar.Size = UDim2.fromScale(built, 1)
		refs.labBar.BackgroundColor3 = Color3.fromRGB(90, 170, 255)
		refs.labNow.Text = ""
		refs.labStop.Visible = false
	elseif info.research then
		refs.labSub.Text = if info.slow then "Мало энергии: исследование идёт медленнее." else "Изучается одна технология за раз."
		refs.labBar.Size = UDim2.fromScale(math.clamp(info.prog or 0, 0, 1), 1)
		refs.labBar.BackgroundColor3 = C.molten
		refs.labNow.Text = string.format("Сейчас: %s — %d%%", Config.TECH[info.research].name, math.floor((info.prog or 0) * 100))
		refs.labStop.Visible = true
	else
		refs.labSub.Text = "Изучается одна технология за раз. Цена платится сразу."
		refs.labBar.Size = UDim2.fromScale(0, 1)
		refs.labNow.Text = "Выбери, что изучать."
		refs.labStop.Visible = false
	end
	refs.tip.Visible = false
	refs.lab.Visible = true
end

function Research.hide()
	current = nil
	ctx.UI.researchId = nil
	refs.lab.Visible = false
end

return Research
