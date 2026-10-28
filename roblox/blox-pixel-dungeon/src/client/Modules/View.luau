-- Отрисовка подземелья: тайлы, туман войны, предметы на полу, персонажи с анимациями,
-- всплывающий текст, камера. Всё — ImageLabel'ы из одного атласа с пикселями без сглаживания.
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BPD")
local Core = Shared:WaitForChild("Core")
local Tiles = require(Core:WaitForChild("Tiles"))
local Terrain = require(Core:WaitForChild("Terrain"))
local Defs = require(Core:WaitForChild("Defs"))
local Ui = require(script.Parent:WaitForChild("Ui"))

local T = Terrain
local View = {}
View.__index = View

local WHITE = Color3.new(1, 1, 1)
local FOG = Color3.fromRGB(105, 105, 118)
local MAPPED = Color3.fromRGB(60, 72, 96)
local MOVE_TIME = 0.1
local RAISE = 6 -- персонажи приподняты на 6 пикселей, как в SPD (perspectiveRaise)

-- цвета клеток, если атласа нет
local FALLBACK = {
	[T.EMPTY] = Color3.fromRGB(80, 78, 74),
	[T.EMPTY_DECO] = Color3.fromRGB(86, 82, 76),
	[T.GRASS] = Color3.fromRGB(70, 100, 50),
	[T.HIGH_GRASS] = Color3.fromRGB(50, 120, 40),
	[T.FURROWED_GRASS] = Color3.fromRGB(80, 110, 50),
	[T.WATER] = Color3.fromRGB(50, 95, 100),
	[T.DOOR] = Color3.fromRGB(130, 85, 40),
	[T.OPEN_DOOR] = Color3.fromRGB(90, 60, 30),
	[T.ENTRANCE] = Color3.fromRGB(150, 150, 60),
	[T.EXIT] = Color3.fromRGB(200, 170, 40),
	[T.WALL] = Color3.fromRGB(150, 150, 155),
	[T.WALL_DECO] = Color3.fromRGB(150, 150, 155),
}

function View.new(parent, zoom)
	local self = setmetatable({}, View)
	self.zoom = zoom
	self.root = Ui.new("Frame", {
		Name = "World",
		BackgroundColor3 = Color3.new(0, 0, 0),
		BorderSizePixel = 0,
		Size = UDim2.fromScale(1, 1),
		ClipsDescendants = true,
		Parent = parent,
	})
	self.sprites = {}
	self.camX, self.camY = nil, nil
	self.shake = 0
	return self
end

function View:S()
	return 16 * self.zoom
end

local function layer(parent, name, z)
	return Ui.new("Frame", {
		Name = name,
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
		ZIndex = z,
		Parent = parent,
	})
end

-- полностью перестроить вид для текущего этажа
function View:load(g)
	self.g = g
	if self.map then
		self.map:Destroy()
	end
	local lvl = g.level
	local S = self:S()
	self.map = Ui.new("Frame", {
		Name = "Map",
		BackgroundTransparency = 1,
		Size = UDim2.fromOffset(lvl.w * S, lvl.h * S),
		Parent = self.root,
	})
	self.lWater = layer(self.map, "Water", 1)
	self.lGround = layer(self.map, "Ground", 2)
	self.lHeaps = layer(self.map, "Heaps", 3)
	self.lChars = layer(self.map, "Chars", 4)
	self.lUpper = layer(self.map, "Upper", 5)
	self.lFx = layer(self.map, "Fx", 6)
	self.ground, self.upper, self.water, self.heapLabels = {}, {}, {}, {}
	self.fogState = {}
	self.sprites = {}
	for i = 1, lvl.w * lvl.h do
		self:buildCell(i)
	end
	self:refreshFog()
	self:refreshHeaps()
	self:addSprite(g.hero)
	for _, m in ipairs(g.mobs) do
		self:addSprite(m)
	end
	self.camX = nil
	self:updateVisibility()
end

function View:cellPos(i)
	local w = self.g.level.w
	return (i - 1) % w, math.floor((i - 1) / w)
end

-- создать/обновить подписи клетки i
function View:buildCell(i)
	local lvl = self.g.level
	local map, w, h = lvl.map, lvl.w, lvl.h
	local S = self:S()
	local x, y = self:cellPos(i)
	local pos = UDim2.fromOffset(x * S, y * S)
	local size = UDim2.fromOffset(S, S)
	local t = map[i]

	if t == T.WATER and not self.water[i] then
		local wl = Ui.image(self.lWater, { Position = pos, Size = size })
		local r = Ui.Atlas.rects.water
		Ui.setRect(wl, r.x + (x % 2) * 16, r.y + (y % 2) * 16, 16, 16)
		if not Ui.atlas then
			wl:SetAttribute("solid", true)
			wl.BackgroundTransparency = 0
			wl.BackgroundColor3 = FALLBACK[T.WATER]
		end
		self.water[i] = wl
	elseif t ~= T.WATER and self.water[i] then
		self.water[i]:Destroy()
		self.water[i] = nil
	end

	local gv = Tiles.ground(map, w, h, i, lvl.variance[i])
	if gv < 0 and not Ui.atlas and Terrain.isWall(t) then
		gv = 0 -- без атласа стена — просто серый квадрат, верхушек стен нет
	end
	local below = (i + w <= w * h) and lvl.variance[i + w] or 0
	local uv = Tiles.upper(map, w, h, i, lvl.variance[i], below)
	self:setTile(self.ground, self.lGround, i, gv, pos, size, t)
	self:setTile(self.upper, self.lUpper, i, uv, pos, size, nil)
end

function View:setTile(store, parent, i, visual, pos, size, terrain)
	local label = store[i]
	if visual < 0 then
		if label then
			label:Destroy()
			store[i] = nil
		end
		return
	end
	if not label then
		label = Ui.image(parent, { Position = pos, Size = size })
		store[i] = label
	end
	local r = Ui.Atlas.rects.tiles
	Ui.setRect(label, r.x + (visual % 16) * 16, r.y + math.floor(visual / 16) * 16, 16, 16)
	if not Ui.atlas and terrain and terrain ~= T.WATER then
		label:SetAttribute("solid", true)
		label.BackgroundTransparency = 0
		label.BackgroundColor3 = FALLBACK[terrain] or Color3.fromRGB(60, 60, 60)
	end
	self.fogState[i] = nil
end

-- клетка изменилась (дверь, трава): пересчитать её и соседей — у тайлов есть стыки
function View:tileChanged(i)
	local w, h = self.g.level.w, self.g.level.h
	local x, y = self:cellPos(i)
	for dy = -1, 1 do
		for dx = -1, 1 do
			local nx, ny = x + dx, y + dy
			if nx >= 0 and ny >= 0 and nx < w and ny < h then
				self:buildCell(ny * w + nx + 1)
			end
		end
	end
	self:refreshFog()
end

function View:refreshFog()
	local g = self.g
	local n = g.level.w * g.level.h
	for i = 1, n do
		local state = g.fov[i] and 3 or (g.visited[i] and 2 or (g.mapped[i] and 1 or 0))
		if self.fogState[i] ~= state then
			self.fogState[i] = state
			local color = state == 3 and WHITE or (state == 2 and FOG or MAPPED)
			local visible = state > 0
			for _, store in ipairs({ self.ground, self.upper, self.water }) do
				local l = store[i]
				if l then
					l.Visible = visible
					l.ImageColor3 = color
					if l:GetAttribute("solid") then
						l.BackgroundTransparency = state == 3 and 0 or (state == 2 and 0.45 or 0.7)
					end
				end
			end
		end
	end
end

function View:refreshHeaps()
	local g = self.g
	local S = self:S()
	for pos, label in pairs(self.heapLabels) do
		if not g.heaps[pos] then
			label:Destroy()
			self.heapLabels[pos] = nil
		end
	end
	for pos, heap in pairs(g.heaps) do
		local top = heap[#heap]
		if top then
			local label = self.heapLabels[pos]
			if not label then
				local x, y = self:cellPos(pos)
				label = Ui.image(self.lHeaps, {
					Position = UDim2.fromOffset(x * S, y * S - 3 * self.zoom),
					Size = UDim2.fromOffset(S, S),
				})
				self.heapLabels[pos] = label
			end
			Ui.setItemIcon(label, g:itemIcon(top))
			if not Ui.atlas then
				label.BackgroundTransparency = 0.2
				label.BackgroundColor3 = Ui.C.gold
				label.Size = UDim2.fromOffset(S / 2, S / 2)
			end
			label.Visible = g.visited[pos] == true
			label.ImageColor3 = g.fov[pos] and WHITE or FOG
		end
	end
end

------------------------------------------------------------------ персонажи

function View:spriteInfo(ch)
	if ch.isHero then
		local tier = ch.armor and Defs.armors[ch.armor.type].tier or 0
		return Defs.hero.sprite, Defs.hero.anim, tier
	end
	return ch.def.sprite, ch.def.anim, 0
end

function View:addSprite(ch)
	local sprite, anims, row = self:spriteInfo(ch)
	local f = Ui.Atlas.film[sprite]
	local z = self.zoom
	local label = Ui.image(self.lChars, { Size = UDim2.fromOffset(f.fw * z, f.fh * z), ZIndex = 2 })
	local s = {
		ch = ch,
		label = label,
		sprite = sprite,
		anims = anims,
		row = row,
		film = f,
		flip = false,
		pos = ch.pos,
		t = 0,
	}
	if not Ui.atlas then
		label.BackgroundTransparency = 0
		label.BackgroundColor3 = ch.isHero and Color3.fromRGB(230, 120, 60) or Color3.fromRGB(170, 60, 60)
		Ui.label(label, ch.isHero and "@" or string.upper(string.sub(ch.type, 1, 1)), 12 * z / 2, { Size = UDim2.fromScale(1, 1) })
	end
	if not ch.isHero then
		local bar = Ui.new("Frame", {
			BackgroundColor3 = Ui.C.hpBack,
			BorderSizePixel = 0,
			Size = UDim2.fromOffset(12 * z, 2 * z),
			Visible = false,
			ZIndex = 3,
			Parent = self.lChars,
		})
		Ui.new("Frame", { Name = "Fill", BackgroundColor3 = Ui.C.hp, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), Parent = bar })
		s.bar = bar
	end
	self.sprites[ch.id] = s
	self:play(s, "idle")
	self:placeSprite(s, ch.pos)
	return s
end

function View:spritePixel(s, pos)
	local x, y = self:cellPos(pos)
	local f = s.film
	return x * 16 + (16 - f.fw) / 2, (y + 1) * 16 - f.fh - RAISE
end

function View:placeSprite(s, pos)
	local px, py = self:spritePixel(s, pos)
	s.px, s.py = px, py
	self:applySpritePos(s)
end

function View:applySpritePos(s)
	local z = self.zoom
	s.label.Position = UDim2.fromOffset(math.floor(s.px * z + 0.5), math.floor(s.py * z + 0.5))
	if s.bar then
		s.bar.Position = UDim2.fromOffset(math.floor((s.px + (s.film.fw - 12) / 2) * z), math.floor((s.py - 3) * z))
	end
end

function View:play(s, name, onDone)
	local a = s.anims[name] or s.anims.idle
	s.anim = a
	s.animName = name
	s.t = 0
	s.loop = name == "idle" or name == "run" or name == "pump"
	s.onDone = onDone
	self:setFrame(s, a[2][1])
end

function View:setFrame(s, frame)
	if s.frame == frame then
		return
	end
	s.frame = frame
	local x, y, w, h = Ui.charFrame(s.sprite, frame, s.row)
	Ui.setRect(s.label, x, y, w, h, s.flip)
end

function View:turnTo(s, from, to)
	local fx = self:cellPos(from)
	local tx = self:cellPos(to)
	if tx ~= fx then
		local flip = tx < fx
		if flip ~= s.flip then
			s.flip = flip
			s.frame = nil
		end
	end
end

function View:updateVisibility()
	local g = self.g
	for id, s in pairs(self.sprites) do
		local ch = s.ch
		local vis = ch.isHero or (not s.dying and g:mobVisible(ch)) or s.dying == true and g.fov[s.pos]
		s.label.Visible = vis and true or false
		if s.bar then
			s.bar.Visible = vis and ch.hp < ch.ht and ch.hp > 0 and not s.dying
			s.bar.Fill.Size = UDim2.fromScale(math.clamp(ch.hp / ch.ht, 0, 1), 1)
		end
		if ch.isHero then
			s.label.ImageTransparency = g.hero.buffs.invisible and 0.6 or 0
		end
	end
end

-- всплывающий текст над персонажем
function View:floatText(id, text, color)
	local s = self.sprites[id]
	if not s or not s.label.Visible then
		return
	end
	local z = self.zoom
	local l = Ui.label(self.lFx, text, math.max(12, 5 * z), {
		TextColor3 = color,
		TextStrokeTransparency = 0.2,
		Size = UDim2.fromOffset(0, 0),
		AutomaticSize = Enum.AutomaticSize.XY,
		AnchorPoint = Vector2.new(0.5, 1),
	})
	local x0, y0 = (s.px + s.film.fw / 2) * z, s.py * z
	self.floats = self.floats or {}
	-- не налезать на предыдущие надписи этого персонажа
	local stack = 0
	for _, f in ipairs(self.floats) do
		if f.id == id and f.t < 0.3 then
			stack = stack + 1
		end
	end
	table.insert(self.floats, { label = l, t = 0, x = x0, y = y0 - stack * 6 * z, id = id })
end

------------------------------------------------------------------ события ядра

function View:handle(e)
	local g = self.g
	if not self.map then
		return
	end
	if e.type == "move" then
		local s = self.sprites[e.id]
		if s then
			self:turnTo(s, e.from, e.to)
			s.pos = e.to
			s.fromX, s.fromY = s.px, s.py
			s.toX, s.toY = self:spritePixel(s, e.to)
			s.moveT = 0
			if s.animName ~= "attack" then
				self:play(s, "run")
			end
		end
	elseif e.type == "attack" then
		local s = self.sprites[e.id]
		if s then
			self:turnTo(s, s.pos, e.target)
			self:play(s, "attack", function()
				self:play(s, "idle")
			end)
		end
	elseif e.type == "damage" then
		local s = self.sprites[e.id]
		if s then
			s.flash = 0.15
			self:floatText(e.id, e.amount > 0 and tostring(e.amount) or "0", Ui.LOG.bad)
		end
	elseif e.type == "heal" then
		self:floatText(e.id, "+" .. e.amount, Ui.LOG.good)
	elseif e.type == "status" then
		self:floatText(e.id, e.text, Ui.LOG[e.color] or Ui.C.text)
	elseif e.type == "spawn" then
		local m = g:findChar(e.id)
		if m and not self.sprites[e.id] and self.map then
			self:addSprite(m)
		end
	elseif e.type == "die" then
		local s = self.sprites[e.id]
		if s then
			s.dying = true
			s.label.Visible = g.fov[s.pos] == true
			if s.bar then
				s.bar.Visible = false
			end
			self:play(s, "die", function()
				s.fade = 0
			end)
		end
	elseif e.type == "pump" then
		local s = self.sprites[e.id]
		if s then
			if e.level > 0 then
				self:play(s, "pump")
				s.label.ImageColor3 = e.level >= 2 and Color3.fromRGB(255, 120, 120) or Color3.fromRGB(255, 190, 190)
			else
				s.label.ImageColor3 = WHITE
				if s.animName == "pump" then
					self:play(s, "idle")
				end
			end
		end
	elseif e.type == "tile" then
		self:tileChanged(e.pos)
	elseif e.type == "fov" then
		self:refreshFog()
		self:refreshHeaps()
		self:updateVisibility()
	elseif e.type == "heap" then
		self:refreshHeaps()
	elseif e.type == "shake" then
		self.shake = 0.25
	elseif e.type == "teleport" then
		local s = self.sprites[0]
		if s then
			s.moveT = nil
			self:placeSprite(s, g.hero.pos)
		end
		self.camX = nil
	elseif e.type == "hero" then
		local s = self.sprites[0]
		if s then
			local _, _, row = self:spriteInfo(g.hero)
			if row ~= s.row then
				s.row = row
				s.frame = nil
			end
		end
		self:updateVisibility()
	end
end

------------------------------------------------------------------ кадр

function View:update(dt)
	if not self.map then
		return
	end
	local z = self.zoom
	for id, s in pairs(self.sprites) do
		-- анимация
		local a = s.anim
		s.t = s.t + dt
		local frames = a[2]
		local idx = math.floor(s.t * a[1])
		if s.loop then
			self:setFrame(s, frames[idx % #frames + 1])
		elseif idx >= #frames then
			self:setFrame(s, frames[#frames])
			local cb = s.onDone
			s.onDone = nil
			if cb then
				cb()
			end
		else
			self:setFrame(s, frames[idx + 1])
		end
		-- движение
		if s.moveT then
			s.moveT = s.moveT + dt
			local k = math.min(1, s.moveT / MOVE_TIME)
			s.px = s.fromX + (s.toX - s.fromX) * k
			s.py = s.fromY + (s.toY - s.fromY) * k
			if k >= 1 then
				s.moveT = nil
				if s.animName == "run" then
					self:play(s, "idle")
				end
			end
			self:applySpritePos(s)
		end
		if s.flash then
			s.flash = s.flash - dt
			if s.animName ~= "pump" then
				s.label.ImageColor3 = s.flash > 0 and Color3.fromRGB(255, 150, 150) or WHITE
			end
			if s.flash <= 0 then
				s.flash = nil
			end
		end
		if s.fade then
			s.fade = s.fade + dt
			s.label.ImageTransparency = math.min(1, s.fade / 0.4)
			if s.fade >= 0.4 then
				s.label:Destroy()
				if s.bar then
					s.bar:Destroy()
				end
				self.sprites[id] = nil
			end
		end
	end

	-- всплывающий текст
	if self.floats then
		for i = #self.floats, 1, -1 do
			local f = self.floats[i]
			f.t = f.t + dt
			f.label.Position = UDim2.fromOffset(f.x, f.y - f.t * 10 * z)
			f.label.TextTransparency = math.max(0, (f.t - 0.6) / 0.6)
			f.label.TextStrokeTransparency = 0.2 + 0.8 * math.max(0, (f.t - 0.6) / 0.6)
			if f.t > 1.2 then
				f.label:Destroy()
				table.remove(self.floats, i)
			end
		end
	end

	-- камера следует за героем
	local hero = self.sprites[0]
	if hero then
		local vw, vh = self.root.AbsoluteSize.X, self.root.AbsoluteSize.Y
		local tx = vw / 2 - (hero.px + hero.film.fw / 2) * z
		local ty = vh / 2 - (hero.py + hero.film.fh / 2) * z
		if not self.camX then
			self.camX, self.camY = tx, ty
		else
			local k = math.min(1, dt * 8)
			self.camX = self.camX + (tx - self.camX) * k
			self.camY = self.camY + (ty - self.camY) * k
		end
		local ox, oy = 0, 0
		if self.shake > 0 then
			self.shake = self.shake - dt
			ox, oy = math.random(-3, 3) * z / 2, math.random(-3, 3) * z / 2
		end
		self.map.Position = UDim2.fromOffset(math.floor(self.camX + ox), math.floor(self.camY + oy))
	end
end

-- клетка под точкой экрана (координаты внутри ScreenGui)
function View:cellAt(screen)
	if not self.map or not self.camX then
		return nil
	end
	local S = self:S()
	local local_ = screen - self.root.AbsolutePosition
	local x = math.floor((local_.X - self.camX) / S)
	local y = math.floor((local_.Y - self.camY) / S)
	local lvl = self.g.level
	if x < 0 or y < 0 or x >= lvl.w or y >= lvl.h then
		return nil
	end
	return y * lvl.w + x + 1
end

return View
