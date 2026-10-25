"""Собирает tests/_bundle.luau: исходники режима, завёрнутые в функции,
и глобальные game/Instance/Vector3/... из эмулятора mock.luau.
Запуск: python3 tests/make_bundle.py && luau tests/server_smoke.luau && luau tests/client_smoke.luau
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "src")
FILES = {
    "Config": "shared/Config.luau",
    "Core": "shared/Core.luau",
    "Models": "shared/Models.luau",
    "FrontServer": "server/FrontServer.server.luau",
    "FrontClient": "client/FrontClient.client.luau",
}
GLOBALS = ["game", "workspace", "Instance", "Vector3", "Vector2", "Color3", "CFrame", "UDim", "UDim2",
           "Enum", "TweenInfo", "RaycastParams", "task", "typeof"]

out = ["-- сгенерировано tests/make_bundle.py, не править руками",
       'local mock = require("./mock")',
       "local env = mock.install()"]
out += [f"{g} = env.{g}" for g in GLOBALS]
out.append("local SOURCES = {}")
for name, rel in FILES.items():
    with open(os.path.join(SRC, rel), encoding="utf-8") as f:
        src = f.read()
    out.append(f'SOURCES["{name}"] = function()\n{src}\nend')
out.append("""local cache = {}
require = function(x)
	local name = type(x) == "table" and x.Name or x
	assert(SOURCES[name], "нет модуля " .. tostring(name))
	if cache[name] == nil then
		cache[name] = SOURCES[name]()
	end
	return cache[name]
end
return { mock = mock, env = env, run = function(name) return SOURCES[name]() end, require = require }""")
with open(os.path.join(HERE, "_bundle.luau"), "w", encoding="utf-8") as f:
    f.write("\n".join(out) + "\n")
print("tests/_bundle.luau собран")
