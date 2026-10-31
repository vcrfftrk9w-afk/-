-- Menu and match HUD, built in code. Designed on a 1000 x 540 canvas and scaled to the screen.
-- This module is the interface the game script talks to; the parts are built in Menu (main
-- menu and arsenal), Landing (choosing a base and a commander), Hud (the match screen), Factory
-- (the factory panel) and Research (the research panel), from Widgets.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TerraForge")
local Config = require(Shared.Config)
local Factory = require(script.Parent.Factory)
local Hud = require(script.Parent.Hud)
local Landing = require(script.Parent.Landing)
local Menu = require(script.Parent.Menu)
local Research = require(script.Parent.Research)
local Sfx = require(script.Parent.Sfx)
local Sprites = require(script.Parent.Sprites)
local Theme = require(script.Parent.Theme)
local Widgets = require(script.Parent.Widgets)

local make = Theme.make
local C = Theme.C
local font = Theme.font

local UI = {}
UI.onPlay = nil
UI.onLeave = nil
UI.onZoom = nil
UI.onSelectKind = nil
UI.onClearSelection = nil
UI.onQueue = nil
UI.onCancel = nil
UI.onAuto = nil
UI.onRally = nil
UI.onCommand = nil -- army panel: "screen", "box", "amove", "stop", "hold"
UI.onBase = nil
UI.onBuildSelect = nil
UI.onMusic = nil -- a music button was pressed
UI.factoryId = nil
UI.onResearch = nil -- (research centre id, tech id)
UI.onStopResearch = nil -- (research centre id)
UI.researchId = nil -- the research centre whose panel is open
UI.onLandingCommander = nil -- a commander card was tapped: (commander id)
UI.onLand = nil -- «ВЫСАДИТЬСЯ»
UI.onPlaceConfirm = nil -- (true) «Поставить» or (false) «Отмена» for a building waiting on a touch screen
UI.buildSel = nil
UI.GROUPS = Hud.GROUPS

local gui, root, scale
local menu, play
local refs = {}
-- shared by the parts: this interface, the widgets they keep, the player's team colour
local ctx = { UI = UI, refs = refs, color = Config.SEAT_COLORS[1] }

---------------------------------------------------------------- the parts' functions

UI.openArsenal = Menu.openArsenal
UI.setLobby = Menu.setLobby
UI.setPhase = Hud.setPhase
UI.setMyColor = Hud.setMyColor
UI.results = Hud.results
UI.defeat = Hud.defeat
UI.announce = Hud.announce
UI.setEconomy = Hud.setEconomy
UI.setMe = Hud.setMe
UI.setLeaderboard = Hud.setLeaderboard
UI.setArmed = Hud.setArmed
UI.setArmy = Hud.setArmy
UI.selectBuild = Hud.selectBuild
UI.showTip = Hud.showTip
UI.showFactory = Factory.show
UI.hideFactory = Factory.hide
UI.showResearch = Research.show
UI.hideResearch = Research.hide
UI.setCommander = Hud.setCommander
UI.setPlaceConfirm = Hud.setPlaceConfirm
UI.setLandingChoice = Landing.setChoice
UI.setLandingCountdown = Landing.setCountdown
UI.landingArea = Landing.area

-- the music buttons show whether the music plays
function UI.setMusicOn(on: boolean)
	for _, b in refs.musicButtons or {} do
		local img = b:FindFirstChildOfClass("ImageLabel")
		if img then
			Sprites.apply(img, if on then "music" else "musicOff")
		end
	end
end

---------------------------------------------------------------- scaling

local function rescale()
	local vp = gui.AbsoluteSize
	if vp.X < 2 or vp.Y < 2 then
		return
	end
	local s = math.clamp(math.min(vp.X / 1000, vp.Y / 540), 0.55, 1.3)
	scale.Scale = s
	root.Size = UDim2.fromScale(1 / s, 1 / s)
	local w = vp.X / s
	Menu.layout(w)
	Hud.layout(w)
end

---------------------------------------------------------------- toast

local toastToken = 0
local function buildToast()
	local t = make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 82),
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		BackgroundColor3 = Color3.fromRGB(16, 21, 34),
		BackgroundTransparency = 0.04,
		Visible = false,
		ZIndex = 30,
		Parent = root,
	}, { Theme.corner(14), Theme.pad(16, 10), make("UISizeConstraint", { MaxSize = Vector2.new(480, 200) }) })
	refs.toastStroke = Theme.stroke(C.line, 1, 0.7)
	refs.toastStroke.Parent = t
	refs.toastText = Theme.label({
		Text = "",
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		TextSize = 14,
		TextWrapped = true,
		TextXAlignment = Enum.TextXAlignment.Center,
		FontFace = font(Enum.FontWeight.Bold),
		ZIndex = 31,
		Parent = t,
	}, { make("UISizeConstraint", { MaxSize = Vector2.new(448, 200) }) })
	refs.toast = t
end

function UI.toast(text: string, warn: boolean?, seconds: number?)
	if warn then
		Sfx.play("error")
	end
	toastToken += 1
	local my = toastToken
	refs.toastText.Text = text
	refs.toastStroke.Color = if warn then C.bad else C.line
	refs.toastStroke.Transparency = if warn then 0.4 else 0.7
	refs.toast.Visible = true
	task.delay(seconds or 2.8, function()
		if toastToken == my then
			refs.toast.Visible = false
		end
	end)
end

---------------------------------------------------------------- public API

function UI.init(playerGui: PlayerGui, player: Player)
	gui = make("ScreenGui", {
		Name = "TerraForgeUI",
		ResetOnSpawn = false,
		DisplayOrder = 5,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	})
	root = make("Frame", { Name = "Root", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Parent = gui })
	scale = make("UIScale", { Parent = root })
	menu = Menu.build(ctx, root, player)
	play = make("Frame", { Name = "Play", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = false, Parent = root })
	Hud.build(ctx, play)
	Factory.build(ctx, play)
	Research.build(ctx, play)
	Landing.build(ctx, root)
	Menu.buildArsenal(root)
	buildToast()
	refs.meDisplayName = player.DisplayName
	refs.meName.Text = player.DisplayName
	refs.meAvatar.Image = if player.UserId > 0 then "rbxthumb://type=AvatarHeadShot&id=" .. player.UserId .. "&w=150&h=150" else ""
	gui.Parent = playerGui
	gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(rescale)
	rescale()
end

function UI.showMenu()
	menu.Visible = true
	play.Visible = false
	Landing.hide()
	UI.selectBuild(nil)
	UI.hideFactory()
	UI.hideResearch()
end

-- choosing where to land: only the map and the landing panels
function UI.showLanding()
	menu.Visible = false
	play.Visible = false
	Landing.show()
	UI.selectBuild(nil)
	UI.hideFactory()
	UI.hideResearch()
end

-- spectator: watch the match without HUD controls
function UI.showPlay(phase: string, spectator: boolean)
	menu.Visible = false
	play.Visible = true
	Landing.hide()
	refs.announce.Visible = false
	UI.setPhase(phase, spectator)
end

-- shown when the game pictures could not be loaded
function UI.artError()
	if refs.artError then
		refs.artError.Visible = true
		return
	end
	local panel = Theme.panel({
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.42),
		Size = UDim2.fromOffset(520, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Color3.fromRGB(16, 21, 34),
		BackgroundTransparency = 0.02,
		ZIndex = 40,
		Parent = root,
	})
	panel:FindFirstChildOfClass("UIStroke").Color = C.bad
	panel:FindFirstChildOfClass("UIStroke").Transparency = 0.3
	Theme.pad(20, 16).Parent = panel
	Theme.list(Enum.FillDirection.Vertical, 8).Parent = panel
	local holder = make("Frame", { Size = UDim2.fromScale(1, 0), BackgroundTransparency = 1, LayoutOrder = 0, ZIndex = 41, Parent = panel })
	Theme.label({ Text = "КАРТИНКИ НЕ ЗАГРУЗИЛИСЬ", Size = UDim2.new(1, -50, 0, 24), TextSize = 20, FontFace = font(Enum.FontWeight.Heavy), TextColor3 = C.moltenHi, ZIndex = 41, LayoutOrder = 1, Parent = panel })
	Theme.label({
		Text = "Карта и войска пока не видны: Roblox не отдал картинки игры. Перезайди через минуту. Если не поможет — сделай скриншот и пришли его.",
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		TextWrapped = true,
		TextSize = 15,
		FontFace = font(Enum.FontWeight.SemiBold),
		TextColor3 = Color3.fromRGB(214, 222, 235),
		ZIndex = 41,
		LayoutOrder = 2,
		Parent = panel,
	})
	local close = Widgets.iconButton("close", holder, function()
		panel.Visible = false
	end)
	close.AnchorPoint = Vector2.new(1, 0)
	close.Position = UDim2.new(1, 0, 0, 0)
	close.ZIndex = 42
	refs.artError = panel
end

return UI
