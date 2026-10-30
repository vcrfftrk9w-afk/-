"""Builds build/TerraForge.rbxlx from src/ without Rojo, following default.project.json's layout.
Usage: python3 tools/build_place.py
"""
import os
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
counter = [0]


def ref():
    counter[0] += 1
    return f'RBX{counter[0]:08X}'


def cdata(text):
    return '<![CDATA[' + text.replace(']]>', ']]]]><![CDATA[>') + ']]>'


def item(cls, name, children=(), source=None, extra=()):
    props = [f'<string name="Name">{escape(name)}</string>', *extra]
    if source is not None:
        props.append(f'<ProtectedString name="Source">{cdata(source)}</ProtectedString>')
    inner = ''.join(children)
    return f'<Item class="{cls}" referent="{ref()}"><Properties>{"".join(props)}</Properties>{inner}</Item>'


def script_class(filename):
    if filename.endswith('.server.luau'):
        return 'Script', filename[:-len('.server.luau')]
    if filename.endswith('.client.luau'):
        return 'LocalScript', filename[:-len('.client.luau')]
    return 'ModuleScript', filename[:-len('.luau')]


def folder(path, name):
    """A folder becomes a Folder, or the script in its init file with the other files as children."""
    files = sorted(f for f in os.listdir(path) if f.endswith('.luau'))
    init = next((f for f in files if f.startswith('init.')), None)
    children = []
    for f in files:
        if f == init:
            continue
        cls, child = script_class(f)
        children.append(item(cls, child, source=open(os.path.join(path, f), encoding='utf-8').read()))
    if init:
        cls, _ = script_class(init)
        return item(cls, name, children, source=open(os.path.join(path, init), encoding='utf-8').read())
    return item('Folder', name, children)


def main():
    src = os.path.join(ROOT, 'src')
    body = ''.join([
        item('ReplicatedStorage', 'ReplicatedStorage', [folder(os.path.join(src, 'shared'), 'TerraForge')]),
        item('ServerScriptService', 'ServerScriptService', [folder(os.path.join(src, 'server'), 'TerraForgeServer')]),
        item('StarterPlayer', 'StarterPlayer', [
            item('StarterPlayerScripts', 'StarterPlayerScripts', [folder(os.path.join(src, 'client'), 'TerraForgeClient')]),
        ]),
    ])
    xml = ('<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" '
           'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
           'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">'
           '<External>null</External><External>nil</External>' + body + '</roblox>')
    out = os.path.join(ROOT, 'build', 'TerraForge.rbxlx')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(xml)
    print(out, len(xml))


if __name__ == '__main__':
    main()
