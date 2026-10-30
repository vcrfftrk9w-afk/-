-- The landing screen: when the player joins a match they have a few seconds to tap a free base
-- on the map and to choose a commander. A title with the countdown at the top, the commanders
-- and «ВЫСАДИТЬСЯ» at the bottom; the map shows between them. Part of the interface; Ui puts
-- it together.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Sfx = require(script.Parent.Sfx)
local Theme = require(script.Parent.Theme)
local Widgets = require(script.Parent.Widgets)

local make = Theme.make
local C = Theme.C
local font = Theme.font

local Landing = {}

-- ctx: { UI = the interface, refs = shared widget references, color = the player's team colour }
local ctx, refs
local cards = {} -- commander id -> { button, stroke }

local PICKED = Color3.fromRGB(70, 42, 18)

function Landing.build(context, root: Instance)
	ctx, refs = context, context.refs
	local UI = ctx.UI
	local screen = make("Frame", { Name = "Landing", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = false, ZIndex = 15, Parent = root })

	-- the title and the countdown
	local top = Theme.panel({
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 10),
		Size = UDim2.fromOffset(560, 64),
		BackgroundColor3 = Color3.fromRGB(16, 21, 34),
		BackgroundTransparency = 0.04,
		Parent = screen,
	})
	Theme.pad(18, 10).Parent = top
	Theme.label({ Text = "ВЫБЕРИ ТОЧКУ ВЫСАДКИ", Size = UDim2.new(1, -64, 0, 24), TextSize = 21, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.moltenHi, Parent = top })
	refs.landSub = Theme.label({
		Text = "",
		Position = UDim2.fromOffset(0, 26),
		Size = UDim2.new(1, -64, 0, 18),
		TextSize = 14,
		TextTruncate = Enum.TextTruncate.AtEnd,
		TextColor3 = Color3.fromRGB(214, 222, 235),
		FontFace = font(Enum.FontWeight.SemiBold),
		Parent = top,
	})
	refs.landCount = make("TextLabel", {
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.fromScale(1, 0.5),
		Size = UDim2.fromOffset(56, 44),
		BackgroundTransparency = 1,
		Text = "",
		TextScaled = true,
		TextColor3 = Color3.new(1, 1, 1),
		FontFace = font(Enum.FontWeight.Heavy),
		Parent = top,
	}, { Theme.molten(90) })
	refs.landTop = top

	-- the commanders, «ВЫСАДИТЬСЯ» and the way back
	local bottom = Theme.panel({
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -10),
		Size = UDim2.new(1, -32, 0, 128),
		BackgroundColor3 = Color3.fromRGB(16, 21, 34),
		BackgroundTransparency = 0.04,
		Parent = screen,
	})
	make("UISizeConstraint", { MaxSize = Vector2.new(1000, 128) }).Parent = bottom
	Theme.pad(10, 8).Parent = bottom
	Theme.label({ Text = "КОМАНДИР", Size = UDim2.new(1, -190, 0, 14), TextSize = 12, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.muted, Parent = bottom })
	local list = make("ScrollingFrame", {
		Position = UDim2.fromOffset(0, 18),
		Size = UDim2.new(1, -190, 0, 94),
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		ScrollingDirection = Enum.ScrollingDirection.X,
		AutomaticCanvasSize = Enum.AutomaticSize.X,
		CanvasSize = UDim2.fromOffset(0, 0),
		ScrollBarThickness = 3,
		Parent = bottom,
	}, { Theme.list(Enum.FillDirection.Horizontal, 8) })
	for i, id in Config.COMMANDER_ORDER do
		local c = Config.COMMANDERS[id]
		local b = make("TextButton", {
			Text = "",
			AutoButtonColor = true,
			Size = UDim2.fromOffset(144, 88),
			BackgroundColor3 = C.panelHi,
			LayoutOrder = i,
			Parent = list,
		}, { Theme.corner(12), Theme.pad(8, 6) })
		local stroke = make("UIStroke", { Color = C.molten, Thickness = 2, Transparency = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Parent = b })
		Widgets.icon(c.icon, 22, { color = ctx.color, Parent = b })
		Theme.label({ Text = c.name, Position = UDim2.fromOffset(28, 2), Size = UDim2.new(1, -28, 0, 18), TextScaled = true, FontFace = font(Enum.FontWeight.Heavy), Parent = b }, {
			make("UITextSizeConstraint", { MaxTextSize = 14 }),
		})
		-- the description shrinks to fit the card
		Theme.label({
			Text = c.desc,
			Position = UDim2.fromOffset(0, 26),
			Size = UDim2.new(1, 0, 1, -26),
			TextScaled = true,
			TextWrapped = true,
			TextYAlignment = Enum.TextYAlignment.Top,
			TextColor3 = Color3.fromRGB(198, 207, 221),
			FontFace = font(Enum.FontWeight.SemiBold),
			Parent = b,
		}, { make("UITextSizeConstraint", { MaxTextSize = 12 }) })
		b.Activated:Connect(function()
			Sfx.play("click")
			if UI.onLandingCommander then
				UI.onLandingCommander(id)
			end
		end)
		cards[id] = { button = b, stroke = stroke }
	end
	local go = Widgets.moltenButton("ВЫСАДИТЬСЯ", bottom, function()
		if UI.onLand then
			UI.onLand()
		end
	end)
	go.AnchorPoint = Vector2.new(1, 0)
	go.Position = UDim2.new(1, 0, 0, 18)
	go.Size = UDim2.fromOffset(180, 56)
	refs.landGo = go
	local back = make("TextButton", {
		Text = "Назад в меню",
		AnchorPoint = Vector2.new(1, 1),
		Position = UDim2.fromScale(1, 1),
		Size = UDim2.fromOffset(180, 32),
		AutoButtonColor = true,
		FontFace = font(Enum.FontWeight.Bold),
		TextSize = 13,
		TextColor3 = C.ink,
		BackgroundColor3 = C.panelHi,
		Parent = bottom,
	}, { Theme.corner(10) })
	back.Activated:Connect(function()
		Sfx.play("click")
		if UI.onLeave then
			UI.onLeave()
		end
	end)
	refs.landBack = back
	refs.landBottom = bottom
	refs.landing = screen
end

-- what is chosen: base = its name (nil while none), commander = commander id
function Landing.setChoice(base: string?, commander: string)
	for id, card in cards do
		local on = id == commander
		card.stroke.Transparency = if on then 0 else 1
		card.button.BackgroundColor3 = if on then PICKED else C.panelHi
	end
	refs.landSub.Text = if base
		then string.format("База: %s · командир: %s", base, Config.COMMANDERS[commander].name)
		else "Нажми на свободную базу на карте"
end

-- seconds left; waiting = the choice has been sent and the server is seating the player
function Landing.setCountdown(seconds: number, waiting: boolean)
	refs.landCount.Text = if waiting then "…" else tostring(seconds)
end

-- the screen heights between which the map stays in sight (GUI coordinates)
function Landing.area(): (number, number)
	local top, bottom = refs.landTop, refs.landBottom
	return top.AbsolutePosition.Y + top.AbsoluteSize.Y + 8, bottom.AbsolutePosition.Y - 8
end

function Landing.show()
	refs.landing.Visible = true
end

function Landing.hide()
	refs.landing.Visible = false
end

return Landing
