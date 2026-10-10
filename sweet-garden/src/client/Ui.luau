-- Помощники для интерфейса: рамки, надписи, кнопки.

local Ui = {}

Ui.Font = Enum.Font.FredokaOne

Ui.Colors = {
	dark = Color3.fromRGB(58, 34, 70),
	panel = Color3.fromRGB(255, 247, 240),
	row = Color3.fromRGB(255, 255, 255),
	text = Color3.fromRGB(70, 45, 75),
	soft = Color3.fromRGB(135, 110, 140),
	pink = Color3.fromRGB(255, 120, 185),
	green = Color3.fromRGB(80, 200, 105),
	blue = Color3.fromRGB(90, 160, 255),
	gray = Color3.fromRGB(190, 184, 195),
	gold = Color3.fromRGB(255, 200, 60),
	red = Color3.fromRGB(240, 90, 95),
	white = Color3.new(1, 1, 1),
}

function Ui.corner(parent: GuiObject, radius: number?): UICorner
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, radius or 12)
	corner.Parent = parent
	return corner
end

function Ui.stroke(parent: GuiObject, color: Color3, thickness: number?, transparency: number?): UIStroke
	local stroke = Instance.new("UIStroke")
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	stroke.Color = color
	stroke.Thickness = thickness or 2
	stroke.Transparency = transparency or 0
	stroke.Parent = parent
	return stroke
end

function Ui.textStroke(parent: GuiObject, color: Color3?, thickness: number?): UIStroke
	local stroke = Instance.new("UIStroke")
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual
	stroke.Color = color or Ui.Colors.dark
	stroke.Thickness = thickness or 1.5
	stroke.Parent = parent
	return stroke
end

function Ui.padding(parent: GuiObject, px: number): UIPadding
	local padding = Instance.new("UIPadding")
	padding.PaddingLeft = UDim.new(0, px)
	padding.PaddingRight = UDim.new(0, px)
	padding.PaddingTop = UDim.new(0, px)
	padding.PaddingBottom = UDim.new(0, px)
	padding.Parent = parent
	return padding
end

function Ui.list(parent: GuiObject, vertical: boolean, gap: number, center: boolean?): UIListLayout
	local layout = Instance.new("UIListLayout")
	layout.FillDirection = vertical and Enum.FillDirection.Vertical or Enum.FillDirection.Horizontal
	layout.Padding = UDim.new(0, gap)
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	if center then
		layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
		layout.VerticalAlignment = Enum.VerticalAlignment.Center
	end
	layout.Parent = parent
	return layout
end

function Ui.frame(parent: Instance, size: UDim2, position: UDim2, color: Color3?, transparency: number?): Frame
	local frame = Instance.new("Frame")
	frame.Size = size
	frame.Position = position
	frame.BorderSizePixel = 0
	if color then
		frame.BackgroundColor3 = color
		frame.BackgroundTransparency = transparency or 0
	else
		frame.BackgroundTransparency = 1
	end
	frame.Parent = parent
	return frame
end

export type LabelOptions = {
	color: Color3?,
	align: Enum.TextXAlignment?,
	scaled: boolean?,
	textSize: number?,
	wrap: boolean?,
	stroke: boolean?,
	maxSize: number?,
}

function Ui.label(parent: Instance, text: string, size: UDim2, position: UDim2, options: LabelOptions?): TextLabel
	local opts: LabelOptions = options or {}
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = size
	label.Position = position
	label.Font = Ui.Font
	label.Text = text
	label.TextColor3 = opts.color or Ui.Colors.text
	label.TextXAlignment = opts.align or Enum.TextXAlignment.Center
	label.TextWrapped = opts.wrap == true
	if opts.scaled == false then
		label.TextScaled = false
		label.TextSize = opts.textSize or 18
	else
		label.TextScaled = true
		local constraint = Instance.new("UITextSizeConstraint")
		constraint.MaxTextSize = opts.maxSize or 40
		constraint.Parent = label
	end
	if opts.stroke then
		Ui.textStroke(label)
	end
	label.Parent = parent
	return label
end

function Ui.button(parent: Instance, text: string, size: UDim2, position: UDim2, color: Color3, onClick: () -> ()): TextButton
	local button = Instance.new("TextButton")
	button.Size = size
	button.Position = position
	button.BackgroundColor3 = color
	button.BorderSizePixel = 0
	button.AutoButtonColor = true
	button.Font = Ui.Font
	button.Text = text
	button.TextColor3 = Ui.Colors.white
	button.TextScaled = true
	local constraint = Instance.new("UITextSizeConstraint")
	constraint.MaxTextSize = 26
	constraint.Parent = button
	Ui.corner(button, 12)
	Ui.textStroke(button, Ui.Colors.dark, 1.5)
	local padding = Instance.new("UIPadding")
	padding.PaddingLeft = UDim.new(0, 6)
	padding.PaddingRight = UDim.new(0, 6)
	padding.PaddingTop = UDim.new(0, 4)
	padding.PaddingBottom = UDim.new(0, 4)
	padding.Parent = button
	button.Activated:Connect(onClick)
	button.Parent = parent
	return button
end

-- Удаляет всё содержимое, кроме раскладок и отступов
function Ui.clear(parent: Instance)
	for _, child in ipairs(parent:GetChildren()) do
		if not child:IsA("UIListLayout") and not child:IsA("UIPadding") and not child:IsA("UIGridLayout") then
			child:Destroy()
		end
	end
end

return Ui
