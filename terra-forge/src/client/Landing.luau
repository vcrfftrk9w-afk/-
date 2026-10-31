-- Choosing a base and a commander: the lobby before a battle (everyone picks, presses «ГОТОВ»
-- and the battle starts for all at once) and landing in a battle already going (a free base, in
-- a few seconds). A panel on the left lists the bases and the commanders; the map shows on the
-- right with the free bases marked. Part of the interface; Ui puts it together.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Sfx = require(script.Parent.Sfx)
local Sprites = require(script.Parent.Sprites)
local Theme = require(script.Parent.Theme)
local Widgets = require(script.Parent.Widgets)

local make = Theme.make
local C = Theme.C
local font = Theme.font

local Landing = {}

-- ctx: { UI = the interface, refs = shared widget references, color = the player's team colour }
local ctx, refs
local rows = {} -- base rows of the panel, in order
local cards = {} -- commander id -> { button, stroke }
local mode = "lobby" -- "lobby" or "landing"

local PICKED = Color3.fromRGB(70, 42, 18)
local READY = Color3.fromRGB(120, 255, 150)

local function baseRow(parent: Instance, order: number)
	local UI = ctx.UI
	local b = make("TextButton", {
		Text = "",
		AutoButtonColor = true,
		Size = UDim2.new(1, 0, 0, 36),
		BackgroundColor3 = C.panelHi,
		LayoutOrder = order,
		Parent = parent,
	}, { Theme.corner(10) })
	local row = { button = b }
	row.stroke = make("UIStroke", { Color = C.molten, Thickness = 2, Transparency = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Parent = b })
	row.swatch = make("Frame", { Position = UDim2.fromOffset(10, 11), Size = UDim2.fromOffset(14, 14), Parent = b }, { Theme.corner(4) })
	row.corner = Theme.label({ Text = "", Position = UDim2.fromOffset(32, 2), Size = UDim2.new(1, -110, 0, 17), TextSize = 13, FontFace = font(Enum.FontWeight.Bold), Parent = b })
	row.who = Theme.label({ Text = "", Position = UDim2.fromOffset(32, 18), Size = UDim2.new(1, -110, 0, 15), TextSize = 11.5, TextColor3 = C.muted, FontFace = font(Enum.FontWeight.SemiBold), TextTruncate = Enum.TextTruncate.AtEnd, Parent = b })
	row.icon = Widgets.icon("gear", 20, { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -74, 0.5, 0), Parent = b })
	row.ready = Theme.label({
		Text = "",
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -8, 0.5, 0),
		Size = UDim2.fromOffset(62, 16),
		TextSize = 11,
		TextXAlignment = Enum.TextXAlignment.Right,
		FontFace = font(Enum.FontWeight.Heavy),
		Parent = b,
	})
	b.Activated:Connect(function()
		if row.id and UI.onLandingSeat then
			Sfx.play("click")
			UI.onLandingSeat(row.id)
		end
	end)
	return row
end

function Landing.build(context, root: Instance)
	ctx, refs = context, context.refs
	local UI = ctx.UI
	local screen = make("Frame", { Name = "Landing", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = false, ZIndex = 15, Parent = root })
	local panel = Theme.panel({
		Position = UDim2.fromOffset(16, 12),
		Size = UDim2.new(0, 320, 1, -24),
		BackgroundColor3 = Color3.fromRGB(16, 21, 34),
		BackgroundTransparency = 0.04,
		Parent = screen,
	})
	Theme.pad(14, 10).Parent = panel
	Theme.list(Enum.FillDirection.Vertical, 6).Parent = panel
	refs.landTitle = Theme.label({ Text = "ЛОББИ", Size = UDim2.new(1, 0, 0, 24), TextSize = 21, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.moltenHi, LayoutOrder = 1, Parent = panel })
	refs.landSub = Theme.label({ Text = "", Size = UDim2.new(1, 0, 0, 30), TextSize = 12, TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, TextColor3 = Color3.fromRGB(214, 222, 235), FontFace = font(Enum.FontWeight.SemiBold), LayoutOrder = 2, Parent = panel })
	Theme.label({ Text = "БАЗЫ", Size = UDim2.new(1, 0, 0, 14), TextSize = 12, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.muted, LayoutOrder = 3, Parent = panel })
	local list = make("Frame", { Size = UDim2.new(1, 0, 0, Config.SEATS * 40 - 4), BackgroundTransparency = 1, LayoutOrder = 4, Parent = panel }, {
		Theme.list(Enum.FillDirection.Vertical, 4),
	})
	for i = 1, Config.SEATS do
		rows[i] = baseRow(list, i)
	end
	Theme.label({ Text = "КОМАНДИР", Size = UDim2.new(1, 0, 0, 14), TextSize = 12, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.muted, LayoutOrder = 5, Parent = panel })
	local grid = make("Frame", { Size = UDim2.new(1, 0, 0, 3 * 30 + 2 * 4), BackgroundTransparency = 1, LayoutOrder = 6, Parent = panel }, {
		make("UIGridLayout", { CellSize = UDim2.new(0.5, -3, 0, 30), CellPadding = UDim2.fromOffset(6, 4), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	for i, id in Config.COMMANDER_ORDER do
		local c = Config.COMMANDERS[id]
		local b = make("TextButton", { Text = "", AutoButtonColor = true, BackgroundColor3 = C.panelHi, LayoutOrder = i, Parent = grid }, { Theme.corner(9) })
		local stroke = make("UIStroke", { Color = C.molten, Thickness = 2, Transparency = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Parent = b })
		Widgets.icon(c.icon, 20, { AnchorPoint = Vector2.new(0, 0.5), Position = UDim2.new(0, 6, 0.5, 0), color = ctx.color, Parent = b })
		Theme.label({ Text = c.name, Position = UDim2.fromOffset(30, 0), Size = UDim2.new(1, -34, 1, 0), TextScaled = true, FontFace = font(Enum.FontWeight.Bold), Parent = b }, {
			make("UITextSizeConstraint", { MaxTextSize = 13 }),
		})
		b.Activated:Connect(function()
			Sfx.play("click")
			if UI.onLandingCommander then
				UI.onLandingCommander(id)
			end
		end)
		cards[id] = { button = b, stroke = stroke }
	end
	refs.landDesc = Theme.label({ Text = "", Size = UDim2.new(1, 0, 0, 28), TextSize = 11.5, TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, TextColor3 = Color3.fromRGB(198, 207, 221), FontFace = font(Enum.FontWeight.SemiBold), LayoutOrder = 7, Parent = panel })
	local go = Widgets.moltenButton("ГОТОВ", panel, function()
		if UI.onLand then
			UI.onLand()
		end
	end)
	go.Size = UDim2.new(1, 0, 0, 48)
	go.LayoutOrder = 8
	refs.landGo = go
	local back = make("TextButton", {
		Text = "Назад в меню",
		Size = UDim2.new(1, 0, 0, 30),
		AutoButtonColor = true,
		FontFace = font(Enum.FontWeight.Bold),
		TextSize = 13,
		TextColor3 = C.ink,
		BackgroundColor3 = C.panelHi,
		LayoutOrder = 9,
		Parent = panel,
	}, { Theme.corner(10) })
	back.Activated:Connect(function()
		Sfx.play("click")
		if UI.onLeave then
			UI.onLeave()
		end
	end)
	refs.landPanel = panel
	refs.landing = screen
end

-- the big button's text
local function goText(text: string)
	for _, d in refs.landGo:GetDescendants() do
		if d:IsA("TextLabel") then
			d.Text = text
		end
	end
end

-- mode = "lobby" (before the battle) or "landing" (into a battle already going)
function Landing.show(m: string)
	mode = m
	refs.landTitle.Text = if m == "lobby" then "ЛОББИ" else "ВЫСАДКА"
	goText(if m == "lobby" then "ГОТОВ" else "ВЫСАДИТЬСЯ")
	refs.landing.Visible = true
end

function Landing.hide()
	refs.landing.Visible = false
end

-- the bases: list of { id, corner, color, who, commander, ready, free, mine }; a free base or
-- the player's own can be tapped
function Landing.setSeats(list)
	for i, row in rows do
		local s = list[i]
		row.button.Visible = s ~= nil
		row.id = if s and (s.free or s.mine) then s.id else nil
		if s then
			row.swatch.BackgroundColor3 = s.color
			row.corner.Text = s.corner
			row.who.Text = s.who
			row.stroke.Transparency = if s.mine then 0 else 1
			row.button.BackgroundColor3 = if s.mine then PICKED else C.panelHi
			row.button.BackgroundTransparency = if s.free or s.mine then 0 else 0.4
			local c = Config.COMMANDERS[s.commander or ""]
			row.icon.Visible = c ~= nil
			if c then
				Sprites.apply(row.icon, c.icon, nil)
			end
			row.ready.Text = if s.ready then "ГОТОВ" elseif s.free and not s.mine then "свободно" else ""
			row.ready.TextColor3 = if s.ready then READY else C.muted
		end
	end
end

-- the chosen commander
function Landing.setChoice(commander: string)
	for id, card in cards do
		local on = id == commander
		card.stroke.Transparency = if on then 0 else 1
		card.button.BackgroundColor3 = if on then PICKED else C.panelHi
	end
	refs.landDesc.Text = Config.COMMANDERS[commander].desc
end

-- the line under the title: the countdown and what to do
function Landing.setStatus(text: string)
	refs.landSub.Text = text
end

-- in the lobby: the player pressed «ГОТОВ» (pressing again takes it back)
function Landing.setReady(on: boolean)
	if mode == "lobby" then
		goText(if on then "ЖДЁМ ДРУГИХ…" else "ГОТОВ")
	end
end

-- where the map may show: top, bottom and left edges (GUI coordinates)
function Landing.area(): (number, number, number)
	local panel = refs.landPanel
	local p, s = panel.AbsolutePosition, panel.AbsoluteSize
	return p.Y, p.Y + s.Y, p.X + s.X + 12
end

return Landing
