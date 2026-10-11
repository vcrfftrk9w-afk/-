-- Маленькие помощники для постройки мира на сервере.

local CollectionService = game:GetService("CollectionService")

local Util = {}

export type PartOptions = {
	name: string?,
	size: Vector3,
	cframe: CFrame,
	color: Color3,
	material: Enum.Material?,
	shape: Enum.PartType?,
	transparency: number?,
	collide: boolean?,
	decor: boolean?, -- true: не мешает ходить и не участвует в касаниях
	parent: Instance,
}

function Util.part(options: PartOptions): Part
	local part = Instance.new("Part")
	part.Name = options.name or "Part"
	part.Anchored = true
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	if options.shape then
		part.Shape = options.shape
	end
	part.Size = options.size
	part.CFrame = options.cframe
	part.Color = options.color
	part.Material = options.material or Enum.Material.SmoothPlastic
	part.Transparency = options.transparency or 0
	if options.decor then
		part.CanCollide = false
		part.CanTouch = false
		part.CanQuery = false
		part.CastShadow = false
	elseif options.collide == false then
		part.CanCollide = false
	end
	part.Parent = options.parent
	return part
end

-- Цилиндр, стоящий вертикально (у Roblox ось цилиндра — X)
function Util.upright(cframe: CFrame): CFrame
	return cframe * CFrame.Angles(0, 0, math.rad(90))
end

function Util.folder(name: string, parent: Instance): Folder
	local folder = Instance.new("Folder")
	folder.Name = name
	folder.Parent = parent
	return folder
end

-- Текст задаётся ключом и переводится на клиенте. Аргументы, начинающиеся с «@», тоже переводятся.
function Util.localize(label: TextLabel, key: string, ...: string)
	label:SetAttribute("TKey", key)
	label:SetAttribute("TArg", table.concat({ ... }, "|"))
	if not CollectionService:HasTag(label, "Loc") then
		CollectionService:AddTag(label, "Loc")
	end
end

-- Надпись над объектом
function Util.sign(parent: Instance, key: string, color: Color3, studsWide: number, studsHigh: number, offset: Vector3?, ...: string): TextLabel
	local gui = Instance.new("BillboardGui")
	gui.Name = "Sign"
	gui.Size = UDim2.new(studsWide, 0, studsHigh, 0)
	gui.StudsOffset = offset or Vector3.new(0, 0, 0)
	gui.MaxDistance = 260
	gui.LightInfluence = 0
	gui.Parent = parent

	local label = Instance.new("TextLabel")
	label.Name = "Text"
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.FredokaOne
	label.TextScaled = true
	label.TextColor3 = color
	label.TextStrokeTransparency = 0
	label.TextStrokeColor3 = Color3.fromRGB(20, 15, 45)
	label.Text = key
	label.Parent = gui
	Util.localize(label, key, ...)
	return label
end

export type PromptOptions = {
	kind: string,
	action: string, -- ключ текста действия
	object: string?, -- ключ текста объекта
	distance: number?,
	hold: number?,
	enabled: boolean?,
	attributes: { [string]: any }?,
	parent: Instance,
}

function Util.prompt(options: PromptOptions): ProximityPrompt
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "Prompt"
	prompt.ActionText = options.action
	prompt.ObjectText = options.object or ""
	prompt.HoldDuration = options.hold or 0
	prompt.MaxActivationDistance = options.distance or 10
	prompt.RequiresLineOfSight = false
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.Enabled = options.enabled ~= false
	prompt:SetAttribute("Kind", options.kind)
	prompt:SetAttribute("AKey", options.action)
	prompt:SetAttribute("OKey", options.object or "")
	for key, value in pairs(options.attributes or {}) do
		prompt:SetAttribute(key, value)
	end
	CollectionService:AddTag(prompt, "LocPrompt")
	prompt.Parent = options.parent
	return prompt
end

-- «@star_rocketo_gold» — так звезда передаётся в уведомлениях и переводится на клиенте
function Util.starArg(starId: string, mut: string?): string
	if mut and mut ~= "" then
		return "@star_" .. starId .. "_" .. mut
	end
	return "@star_" .. starId
end

function Util.rootOf(player: Player): BasePart?
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root and root:IsA("BasePart") then
		return root
	end
	return nil
end

function Util.humanoidOf(player: Player): Humanoid?
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if humanoid and humanoid.Health > 0 then
		return humanoid
	end
	return nil
end

-- Безопасный вызов: ошибка печатается, но игра продолжает работать
function Util.try(label: string, fn: (...any) -> ...any, ...: any): boolean
	local ok, err = pcall(fn, ...)
	if not ok then
		warn("[Starfall] " .. label .. ": " .. tostring(err))
	end
	return ok
end

return Util
