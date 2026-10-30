-- Image ids of the game pictures. The server finds them inside the uploaded decals and puts
-- them on ReplicatedStorage.TerraForgeArt as attributes, by name (see shared/MapArt).
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local folder = ReplicatedStorage:WaitForChild("TerraForgeArt")

local Art = {}

function Art.get(name: string): string?
	local v = folder:GetAttribute(name)
	return if typeof(v) == "string" and v ~= "" then v else nil
end

-- calls fn(image) now if the picture is known, and again whenever it changes
function Art.watch(name: string, fn: (string) -> ())
	local v = Art.get(name)
	if v then
		fn(v)
	end
	folder:GetAttributeChangedSignal(name):Connect(function()
		local image = Art.get(name)
		if image then
			fn(image)
		end
	end)
end

return Art
