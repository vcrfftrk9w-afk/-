// Собирает готовое место для Roblox Studio (BloxPixelDungeon.rbxlx) из src/ — так же,
// как это сделал бы Rojo по default.project.json.   node tools/build-place.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
let ref = 0;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cdata = (s) => '<![CDATA[' + s.split(']]>').join(']]]]><![CDATA[>') + ']]>';

function item(cls, name, props, children, indent) {
  const pad = '\t'.repeat(indent);
  const lines = [`${pad}<Item class="${cls}" referent="RBX${(++ref).toString(16).toUpperCase().padStart(32, '0')}">`,
    `${pad}\t<Properties>`, `${pad}\t\t<string name="Name">${esc(name)}</string>`];
  for (const p of props || []) lines.push(`${pad}\t\t${p}`);
  lines.push(`${pad}\t</Properties>`);
  for (const c of children || []) lines.push(c);
  lines.push(`${pad}</Item>`);
  return lines.join('\n');
}

// папка исходников → Folder с ModuleScript / LocalScript / Script (правила имён как у Rojo)
function folder(dir, name, indent) {
  const children = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      children.push(folder(p, f, indent + 1));
    } else if (f.endsWith('.luau')) {
      const cls = f.endsWith('.client.luau') ? 'LocalScript' : f.endsWith('.server.luau') ? 'Script' : 'ModuleScript';
      const props = [`<ProtectedString name="Source">${cdata(fs.readFileSync(p, 'utf8'))}</ProtectedString>`];
      if (cls !== 'ModuleScript') props.push('<bool name="Disabled">false</bool>');
      children.push(item(cls, f.replace(/(\.client|\.server)?\.luau$/, ''), props, [], indent + 1));
    }
  }
  return item('Folder', name, [], children, indent);
}

const body = [
  item('Workspace', 'Workspace', [], [], 1),
  item('Players', 'Players', ['<bool name="CharacterAutoLoads">false</bool>'], [], 1),
  item('ReplicatedStorage', 'ReplicatedStorage', [], [folder(path.join(SRC, 'shared'), 'BPD', 2)], 1),
  item('ServerScriptService', 'ServerScriptService', [], [folder(path.join(SRC, 'server'), 'BPDServer', 2)], 1),
  item('StarterPlayer', 'StarterPlayer', [], [
    item('StarterPlayerScripts', 'StarterPlayerScripts', [], [folder(path.join(SRC, 'client'), 'BPDClient', 3)], 2),
  ], 1),
];

const xml = ['<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">',
  '\t<Meta name="ExplicitAutoJoints">true</Meta>',
  '\t<External>null</External>',
  '\t<External>nil</External>',
  ...body,
  '</roblox>', ''].join('\n');

const out = path.join(ROOT, 'BloxPixelDungeon.rbxlx');
fs.writeFileSync(out, xml);
console.log('готово:', path.relative(process.cwd(), out), Math.round(xml.length / 1024) + ' КБ');
