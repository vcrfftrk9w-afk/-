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

-- Надпись над объектом. Текст задаётся ключом и переводится на клиенте.
function Util.sign(parent: Instance, key: string, arg: string?, color: Color3, studsWide: number, studsHigh: number, offset: Vector3?): TextLabel
	local gui = Instance.new("BillboardGui")
	gui.Name = "Sign"
	gui.Size = UDim2.new(studsWide, 0, studsHigh, 0)
	gui.StudsOffset = offset or Vector3.new(0, 0, 0)
	gui.MaxDistance = 220
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
	label.TextStrokeColor3 = Color3.fromRGB(60, 30, 60)
	label.Text = key
	label.Parent = gui
	Util.localize(label, key, arg)
	return label
end

function Util.localize(label: TextLabel, key: string, arg: string?)
	label:SetAttribute("TKey", key)
	label:SetAttribute("TArg", arg or "")
	if not CollectionService:HasTag(label, "Loc") then
		CollectionService:AddTag(label, "Loc")
	end
end

export type PromptOptions = {
	kind: string,
	action: string, -- ключ текста действия
	object: string?, -- ключ текста объекта
	distance: number?,
	enabled: boolean?,
	attributes: { [string]: any }?,
	parent: Instance,
}

function Util.prompt(options: PromptOptions): ProximityPrompt
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "Prompt"
	prompt.ActionText = options.action
	prompt.ObjectText = options.object or ""
	prompt.HoldDuration = 0
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

function Util.lerpColor(a: Color3, b: Color3, t: number): Color3
	return a:Lerp(b, t)
end

-- Безопасный вызов: ошибка печатается, но игра продолжает работать
function Util.try(label: string, fn: (...any) -> ...any, ...: any): boolean
	local ok, err = pcall(fn, ...)
	if not ok then
		warn("[SweetGarden] " .. label .. ": " .. tostring(err))
	end
	return ok
end

return Util
