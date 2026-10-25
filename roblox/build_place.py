"""Собирает Front.rbxlx — файл места для Roblox Studio (File → Open from File).

    python3 build_place.py

В место попадают:
    ReplicatedStorage/Front/{Config, Core, Models}   — модули
    ReplicatedStorage/FrontModels                     — сюда кладутся модели из Blender
    ServerScriptService/FrontServer                   — сервер
    StarterPlayer/StarterPlayerScripts/FrontClient    — клиент
"""
import itertools
import os
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
_ref = itertools.count(1)


def read(rel):
    with open(os.path.join(HERE, "src", rel), encoding="utf-8") as f:
        src = f.read()
    assert "]]>" not in src, rel
    return src


def item(cls, name, children=(), source=None):
    ref = f"RBX{next(_ref):08X}"
    props = f'<string name="Name">{escape(name)}</string>'
    if source is not None:
        props += f'<ProtectedString name="Source"><![CDATA[{source}]]></ProtectedString>'
    inner = "".join(children)
    return f'<Item class="{cls}" referent="{ref}"><Properties>{props}</Properties>{inner}</Item>'


def main():
    front = item("Folder", "Front", [
        item("ModuleScript", "Config", source=read("shared/Config.luau")),
        item("ModuleScript", "Core", source=read("shared/Core.luau")),
        item("ModuleScript", "Models", source=read("shared/Models.luau")),
    ])
    body = "".join([
        item("Workspace", "Workspace"),
        item("ReplicatedStorage", "ReplicatedStorage", [front, item("Folder", "FrontModels")]),
        item("ServerScriptService", "ServerScriptService", [
            item("Script", "FrontServer", source=read("server/FrontServer.server.luau")),
        ]),
        item("StarterPlayer", "StarterPlayer", [
            item("StarterPlayerScripts", "StarterPlayerScripts", [
                item("LocalScript", "FrontClient", source=read("client/FrontClient.client.luau")),
            ]),
        ]),
    ])
    xml = ('<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" '
           'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
           'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">'
           '<External>null</External><External>nil</External>' + body + '</roblox>\n')
    out = os.path.join(HERE, "Front.rbxlx")
    with open(out, "w", encoding="utf-8") as f:
        f.write(xml)
    print(f"Front.rbxlx: {len(xml) // 1024} КБ")


if __name__ == "__main__":
    main()
