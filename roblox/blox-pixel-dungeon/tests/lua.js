// Запуск Lua-кода игры вне Roblox (виртуальная машина fengari, Lua 5.3).
// Модули ядра пишутся на общем подмножестве Lua 5.1/Luau, поэтому работают и тут.
// `script.Parent.X` и require() подменяются загрузкой файлов из src/shared.
'use strict';
const path = require('path');
const fs = require('fs');

let fengari;
try {
  fengari = require('fengari');
} catch (e) {
  console.error('Нужен пакет fengari: npm install --no-save fengari@0.1.4');
  process.exit(2);
}
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;

const SHARED = path.join(__dirname, '..', 'src', 'shared');

function findModule(name) {
  for (const dir of [path.join(SHARED, 'Core'), SHARED]) {
    const f = path.join(dir, name + '.luau');
    if (fs.existsSync(f)) return f;
  }
  throw new Error('нет модуля ' + name);
}

const PRELUDE = `
local loaded = {}
local function makeScript(name)
  return { Name = name, Parent = setmetatable({}, { __index = function(_, k) return { __module = k } end }) }
end
local realRequire = require
require = function(m)
  if type(m) == 'table' and m.__module then
    local name = m.__module
    if loaded[name] == nil then
      local src = __readModule(name)
      local fn, err = load(src, '@' .. name, 't', setmetatable({ script = makeScript(name) }, { __index = _G }))
      if not fn then error(err) end
      loaded[name] = fn()
    end
    return loaded[name]
  end
  return realRequire(m)
end
function module(name) return require({ __module = name }) end
`;

function newState() {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  lua.lua_pushcfunction(L, (L) => {
    const name = to_jsstring(lauxlib.luaL_checkstring(L, 1));
    lua.lua_pushstring(L, to_luastring(fs.readFileSync(findModule(name), 'utf8')));
    return 1;
  });
  lua.lua_setglobal(L, to_luastring('__readModule'));
  run(L, PRELUDE, 'prelude');
  return L;
}

function run(L, code, name) {
  if (lauxlib.luaL_loadbuffer(L, to_luastring(code), null, to_luastring('@' + name)) !== lua.LUA_OK ||
      lua.lua_pcall(L, 0, 0, 0) !== lua.LUA_OK) {
    throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
  }
}

// только синтаксис: проверить, что файл компилируется
function checkSyntax(file) {
  const L = lauxlib.luaL_newstate();
  const src = fs.readFileSync(file, 'utf8');
  if (lauxlib.luaL_loadbuffer(L, to_luastring(src), null, to_luastring('@' + path.basename(file))) !== lua.LUA_OK) {
    return to_jsstring(lua.lua_tostring(L, -1));
  }
  return null;
}

module.exports = { newState, run, checkSyntax };
