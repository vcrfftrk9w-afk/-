// Прогон клиентского кода (интерфейс + отрисовка) на имитации Roblox API:
// жмёт кнопки, ходит, открывает окна, спускается по этажам.
//   node tests/client.js [кадров] [--atlas=<ID или пусто>] [--bad-image] [--no-editable]
// --atlas=      подменить Config.ATLAS_ID (пусто — проверить встроенную графику через EditableImage)
// --bad-image   загруженная картинка не грузится (ещё на проверке или неверный ID)
// --no-editable Roblox запрещает EditableImage: без атласа игра рисует цветные квадраты
'use strict';
const fs = require('fs');
const path = require('path');
const { newState, run } = require('./lua.js');
const { lua, to_luastring, to_jsstring } = require('fengari');

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === '--' + name || a.startsWith('--' + name + '='));
const atlasArg = flag('atlas');
const frames = Number(args.find((a) => !a.startsWith('--')) || 3000);
const SRC = path.join(__dirname, '..', 'src');

// дерево как его собирает Rojo: *.client.luau → LocalScript, *.server.luau → Script, *.luau → ModuleScript
function tree(dir, name) {
  const node = { name, class: 'Folder', children: [] };
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) node.children.push(tree(p, f));
    else if (f.endsWith('.luau')) {
      const cls = f.endsWith('.client.luau') ? 'LocalScript' : f.endsWith('.server.luau') ? 'Script' : 'ModuleScript';
      node.children.push({ name: f.replace(/(\.client|\.server)?\.luau$/, ''), class: cls, source: fs.readFileSync(p, 'utf8') });
    }
  }
  return node;
}

const L = newState();
run(L, `mock = dofile(${JSON.stringify(path.join(__dirname, 'roblox_mock.lua'))})`, 'mock');
// исходники передаём через глобальные строки, чтобы не экранировать Lua
const files = [];
function register(node) {
  if (node.source !== undefined) {
    files.push(node.source);
    node.sourceIndex = files.length;
    delete node.source;
  }
  (node.children || []).forEach(register);
}
const shared = tree(SRC + '/shared', 'BPD');
const client = tree(SRC + '/client', 'BPDClient');
const server = tree(SRC + '/server', 'BPDServer');
register(shared);
register(client);
register(server);
lua.lua_createtable(L, files.length, 0);
files.forEach((s, i) => {
  lua.lua_pushstring(L, to_luastring(s));
  lua.lua_rawseti(L, -2, i + 1);
});
lua.lua_setglobal(L, to_luastring('SOURCES'));
const toLuaIdx = (node) => `{ name = ${JSON.stringify(node.name)}, class = ${JSON.stringify(node.class)}` +
  (node.sourceIndex ? `, source = SOURCES[${node.sourceIndex}]` : '') +
  `, children = {${(node.children || []).map(toLuaIdx).join(',')}} }`;

run(L, `
local ok, err = xpcall(function()
  mock.build(mock.ReplicatedStorage, ${toLuaIdx(shared)})
  mock.noEditable = ${flag('no-editable') ? 'true' : 'false'}
  ${flag('bad-image') ? "mock.preloadStatus = Enum.AssetFetchStatus.Failure" : ''}
  ${atlasArg ? `require(mock.ReplicatedStorage.BPD.Config).ATLAS_ID = ${JSON.stringify(atlasArg.split('=').slice(1).join('='))}` : ''}
  local serverFolder = mock.build(game:GetService('ServerScriptService'), ${toLuaIdx(server)})
  for _, s in ipairs(serverFolder:GetChildren()) do mock.runScript(s) end
  local scripts = Instance.new('PlayerScripts')
  scripts.Parent = mock.player
  local clientFolder = mock.build(scripts, ${toLuaIdx(client)})

  -- перехватываем Game.new, чтобы тест мог двигать партию напрямую
  local Game = require(mock.ReplicatedStorage.BPD.Core.Game)
  local origNew = Game.new
  Game.new = function(seed) local g = origNew(seed); mock.game = g; return g end

  mock.runScript(clientFolder.Main)
end, debug.traceback)
if not ok then error(err) end
`, 'boot');

const DRIVER = `
local rng = 7
local function rand(n) rng = (rng * 48271) % 2147483647; return rng % n end
local K = { 'W', 'A', 'S', 'D', 'Q', 'E', 'Z', 'C', 'Up', 'Left' }

local function buttons(root)
  local list = {}
  for _, d in ipairs(root:GetDescendants()) do
    if d.ClassName == 'TextButton' then list[#list + 1] = d end
  end
  return list
end
local function topModal()
  local top
  for _, d in ipairs(mock.playerGui:GetDescendants()) do
    if d.ClassName == 'TextButton' and d.ZIndex == 50 then top = d end
  end
  return top
end
local function findButton(text)
  for _, b in ipairs(buttons(mock.playerGui)) do
    if b.Text == text then return b end
  end
end
local function key(name)
  local input = { UserInputType = Enum.UserInputType.Keyboard, KeyCode = Enum.KeyCode[name], Position = Vector2.new(0, 0) }
  mock.UIS.InputBegan:Fire(input, false)
  mock.UIS.InputEnded:Fire(input, false)
end
local function tap(x, y)
  local input = { UserInputType = Enum.UserInputType.MouseButton1, Position = Vector2.new(x, y) }
  mock.UIS.InputBegan:Fire(input, false)
  mock.UIS.InputEnded:Fire(input, false)
end

stats = { clicks = 0, keys = 0, taps = 0, depthMax = 1, windows = 0, games = 0 }
local lastGame
function frame(i)
  mock.advance(0.05)
  mock.runTimers()
  mock.RunService.RenderStepped:Fire(0.05)
  local g = mock.game
  if g ~= lastGame then lastGame = g; stats.games = stats.games + 1 end
  if g and g.depth > stats.depthMax then stats.depthMax = g.depth end
  if i % 3 ~= 0 then return end
  local modal = topModal()
  if modal then
    stats.windows = stats.windows + 1
    local list = buttons(modal)
    if #list > 0 then
      local b = list[rand(#list) + 1]
      b.Activated:Fire()
      stats.clicks = stats.clicks + 1
    end
    return
  end
  local play = findButton('Играть')
  if play then play.Activated:Fire(); return end
  local r = rand(100)
  if r < 55 then key(K[rand(#K) + 1]); stats.keys = stats.keys + 1
  elseif r < 70 then tap(rand(1280), rand(720)); stats.taps = stats.taps + 1
  elseif r < 74 then key('I')
  elseif r < 78 then key('F')
  elseif r < 81 then key('Space')
  elseif r < 83 then key('R')
  elseif r < 85 then
    local b = mock.playerGui.BloxPixelDungeon.Hud
    local all = buttons(b)
    local x = all[rand(#all) + 1]
    x.Activated:Fire(); x.MouseButton1Down:Fire(); x.MouseButton1Up:Fire()
  elseif r < 87 and g and not g.over and g.depth < 5 then
    g:enterDepth(g.depth + 1, true)   -- ускоряем спуск, чтобы проверить все этажи
  elseif r < 88 and g and not g.over and g.depth == 5 then
    for _, m in ipairs(g.mobs) do if m.boss and m.hp > 5 then m.hp = 5; m.state = 'hunting' end end
  elseif r < 90 and g then
    g.hero.hp = math.min(g.hero.hp, 2)
  end
end
`;
run(L, DRIVER, 'driver');

let error = null;
for (let i = 1; i <= frames; i++) {
  lua.lua_getglobal(L, to_luastring('debug'));
  lua.lua_getfield(L, -1, to_luastring('traceback'));
  lua.lua_remove(L, -2);
  lua.lua_getglobal(L, to_luastring('frame'));
  lua.lua_pushinteger(L, i);
  if (lua.lua_pcall(L, 1, 0, -3) !== lua.LUA_OK) {
    error = to_jsstring(lua.lua_tostring(L, -1));
    console.log(`кадр ${i}: ОШИБКА\n${error}`);
    break;
  }
  lua.lua_pop(L, 1);
}
run(L, `print(string.format('клики %d, клавиши %d, касания %d, окна %d, партий %d, макс. глубина %d, отчётов на сервер %d, объектов создано %d',
  stats.clicks, stats.keys, stats.taps, stats.windows, stats.games, stats.depthMax, mock.reports or 0, mock.created))`, 'stats');
process.exit(error ? 1 : 0);
