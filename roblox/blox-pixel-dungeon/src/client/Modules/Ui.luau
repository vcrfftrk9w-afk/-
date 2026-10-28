-- Общие помощники интерфейса: создание объектов, окна, кнопки, картинки из атласа.
local Ui = {}

Ui.FONT = Enum.Font.GothamBold
Ui.FONT_REGULAR = Enum.Font.Gotham

Ui.C = {
	panel = Color3.fromRGB(48, 43, 38),
	panelDark = Color3.fromRGB(28, 25, 23),
	border = Color3.fromRGB(110, 97, 78),
	button = Color3.fromRGB(82, 72, 60),
	buttonDown = Color3.fromRGB(62, 54, 45),
	text = Color3.fromRGB(240, 236, 228),
	dim = Color3.fromRGB(170, 160, 145),
	hp = Color3.fromRGB(200, 40, 40),
	hpBack = Color3.fromRGB(70, 20, 20),
	exp = Color3.fromRGB(255, 220, 60),
	gold = Color3.fromRGB(255, 210, 70),
}

-- цвета журнала как в GLog
Ui.LOG = {
	white = Color3.fromRGB(240, 236, 228),
	good = Color3.fromRGB(110, 240, 110),
	bad = Color3.fromRGB(255, 95, 95),
	warn = Color3.fromRGB(255, 170, 60),
	high = Color3.fromRGB(255, 240, 90),
}

-- картинка атласа: { image = "rbxassetid://..." } или { content = Content } или nil
Ui.atlas = nil
Ui.Atlas = nil -- модуль с координатами

function Ui.new(class, props, children)
	local inst = Instance.new(class)
	for k, v in pairs(props or {}) do
		if k ~= "Parent" then
			inst[k] = v
		end
	end
	for _, c in ipairs(children or {}) do
		c.Parent = inst
	end
	if props and props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end

function Ui.corner(parent, r)
	return Ui.new("UICorner", { CornerRadius = UDim.new(0, r or 6), Parent = parent })
end

function Ui.stroke(parent, color, thickness)
	return Ui.new("UIStroke", {
		Color = color or Ui.C.border,
		Thickness = thickness or 2,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
		Parent = parent,
	})
end

function Ui.panel(parent, props)
	props = props or {}
	props.BackgroundColor3 = props.BackgroundColor3 or Ui.C.panel
	props.BorderSizePixel = 0
	props.Parent = parent
	local f = Ui.new("Frame", props)
	Ui.corner(f, 6)
	Ui.stroke(f)
	return f
end

function Ui.label(parent, text, size, props)
	props = props or {}
	props.Text = text
	props.TextSize = size or 16
	props.Font = props.Font or Ui.FONT
	props.TextColor3 = props.TextColor3 or Ui.C.text
	props.BackgroundTransparency = 1
	props.Parent = parent
	local l = Ui.new("TextLabel", props)
	return l
end

function Ui.button(parent, text, onClick, props)
	props = props or {}
	props.Text = text
	props.TextSize = props.TextSize or 18
	props.Font = Ui.FONT
	props.TextColor3 = Ui.C.text
	props.BackgroundColor3 = props.BackgroundColor3 or Ui.C.button
	props.AutoButtonColor = true
	props.BorderSizePixel = 0
	props.Parent = parent
	local b = Ui.new("TextButton", props)
	Ui.corner(b, 6)
	Ui.stroke(b)
	if onClick then
		b.Activated:Connect(onClick)
	end
	return b
end

-- картинка из атласа; без атласа — цветной квадрат с буквой
function Ui.image(parent, props)
	props = props or {}
	props.BackgroundTransparency = props.BackgroundTransparency or 1
	props.BorderSizePixel = 0
	props.Parent = parent
	local img = Ui.new("ImageLabel", props)
	img.ResampleMode = Enum.ResamplerMode.Pixelated
	if Ui.atlas then
		if Ui.atlas.image then
			img.Image = Ui.atlas.image
		else
			img.ImageContent = Ui.atlas.content
		end
	end
	return img
end

function Ui.setRect(img, x, y, w, h, flip)
	if flip then
		img.ImageRectOffset = Vector2.new(x + w, y)
		img.ImageRectSize = Vector2.new(-w, h)
	else
		img.ImageRectOffset = Vector2.new(x, y)
		img.ImageRectSize = Vector2.new(w, h)
	end
end

-- значок предмета по номеру из ItemSpriteSheet
function Ui.setItemIcon(img, icon)
	local r = Ui.Atlas.rects.items
	Ui.setRect(img, r.x + (icon % 16) * 16, r.y + math.floor(icon / 16) * 16, 16, 16)
end

-- кадр персонажа: sprite — имя в атласе, row — ряд (для героя это тир брони)
function Ui.charFrame(sprite, frame, row)
	local r = Ui.Atlas.rects[sprite]
	local f = Ui.Atlas.film[sprite]
	local col = frame % f.cols
	local line = math.floor(frame / f.cols) + (row or 0)
	return r.x + col * f.fw, r.y + line * f.fh, f.fw, f.fh
end

-- модальное окно поверх экрана
function Ui.window(gui, title, width, onClose)
	local shade = Ui.new("TextButton", {
		Text = "",
		AutoButtonColor = false,
		BackgroundColor3 = Color3.new(0, 0, 0),
		BackgroundTransparency = 0.45,
		Size = UDim2.fromScale(1, 1),
		ZIndex = 50,
		Parent = gui,
	})
	local frame = Ui.panel(shade, {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.new(0, math.min(width or 420, 600), 0, 100),
		AutomaticSize = Enum.AutomaticSize.Y,
		ZIndex = 51,
	})
	-- на маленьких экранах окно уменьшается, чтобы влезть целиком
	local scale = Ui.new("UIScale", { Scale = 1, Parent = frame })
	local function fit()
		local s = scale.Scale
		local w, h = frame.AbsoluteSize.X / s, frame.AbsoluteSize.Y / s
		local vw, vh = gui.AbsoluteSize.X, gui.AbsoluteSize.Y
		if w > 0 and h > 0 then
			local k = math.min(1, (vw - 16) / w, (vh - 16) / h)
			if math.abs(k - s) > 0.01 then
				scale.Scale = k
			end
		end
	end
	frame:GetPropertyChangedSignal("AbsoluteSize"):Connect(fit)
	task.defer(fit)
	Ui.new("UIPadding", {
		PaddingTop = UDim.new(0, 12),
		PaddingBottom = UDim.new(0, 12),
		PaddingLeft = UDim.new(0, 14),
		PaddingRight = UDim.new(0, 14),
		Parent = frame,
	})
	Ui.new("UIListLayout", {
		Padding = UDim.new(0, 10),
		SortOrder = Enum.SortOrder.LayoutOrder,
		HorizontalAlignment = Enum.HorizontalAlignment.Center,
		Parent = frame,
	})
	local win = { shade = shade, frame = frame, order = 0 }
	function win.close()
		shade:Destroy()
		if onClose then
			onClose()
		end
	end
	function win.next()
		win.order = win.order + 1
		return win.order
	end
	if title then
		Ui.label(frame, title, 20, {
			Size = UDim2.new(1, 0, 0, 24),
			TextColor3 = Ui.LOG.high,
			TextWrapped = true,
			AutomaticSize = Enum.AutomaticSize.Y,
			LayoutOrder = win.next(),
			ZIndex = 52,
		})
	end
	function win.text(text, size, color)
		return Ui.label(frame, text, size or 15, {
			Size = UDim2.new(1, 0, 0, 0),
			AutomaticSize = Enum.AutomaticSize.Y,
			TextWrapped = true,
			TextXAlignment = Enum.TextXAlignment.Left,
			Font = Ui.FONT_REGULAR,
			TextColor3 = color or Ui.C.text,
			LayoutOrder = win.next(),
			ZIndex = 52,
		})
	end
	function win.buttons(list)
		local row = Ui.new("Frame", {
			BackgroundTransparency = 1,
			Size = UDim2.new(1, 0, 0, 40),
			LayoutOrder = win.next(),
			ZIndex = 52,
			Parent = frame,
		})
		Ui.new("UIListLayout", {
			FillDirection = Enum.FillDirection.Horizontal,
			HorizontalAlignment = Enum.HorizontalAlignment.Center,
			Padding = UDim.new(0, 8),
			Parent = row,
		})
		local n = #list
		for _, b in ipairs(list) do
			Ui.button(row, b[1], function()
				if b[3] ~= false then
					win.close()
				end
				b[2]()
			end, { Size = UDim2.new(1 / n, -8, 1, 0), ZIndex = 53, TextSize = 16 })
		end
		return row
	end
	return win
end

return Ui
