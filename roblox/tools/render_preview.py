"""Картинка «как выглядит матч»: состояние из tools/match_state.luau,
модели из blender/make_models.py, камера как в клиенте Roblox.

    luau tools/match_state.luau > state.json
    blender -b -P tools/render_preview.py -- state.json out.png labels.json
"""
import json
import math
import os
import sys

import bpy  # bpy первым: он подключает bmesh
import bmesh
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "blender"))
import make_models as mm  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
STATE, OUT, LABELS = args[0], args[1], args[2]
st = json.load(open(STATE))
W, H, T = st["W"], st["H"], 4
nations = {n["id"]: n for n in st["snap"]["nations"]}
ME = st["me"]["id"]
ZOOM = 64
HEIGHT = {1: 1.0, 2: 1.8, 3: 3.2}
TERRAIN = {1: (118, 164, 84), 2: (150, 156, 96), 3: (126, 124, 118)}


def lin(c):
    out = []
    for v in c:
        v /= 255
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def lerp(a, b, t):
    return tuple(a[k] + (b[k] - a[k]) * t for k in range(3))


def center(i):
    x, y = (i - 1) % W, (i - 1) // W
    # Roblox (X, Z) -> Blender (X, -Y)
    return Vector(((x - W / 2 + 0.5) * T, -(y - H / 2 + 0.5) * T, 0))


mats = {}


def flat(rgb, rough=0.7):
    key = tuple(int(v) for v in rgb)
    if key not in mats:
        m = bpy.data.materials.new(f"C{key}")
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (*lin(key), 1)
        b.inputs["Roughness"].default_value = rough
        mats[key] = m
    return mats[key]


mm.reset_scene()
scene = bpy.context.scene

# клетки суши: один меш, цвет как у сервера (paintTile)
bm = bmesh.new()
tile_mats, mat_index = [], {}
top_of = {}
for i, t in enumerate(st["terrain"], start=1):
    if t == 0:
        continue
    o = st["owner"][i - 1]
    base = TERRAIN[t]
    if o > 0:
        c = nations[o]["color"]
        col = lerp(c, (0, 0, 0), 0.35) if st["border"][i - 1] else lerp(base, c, 0.7)
    else:
        col = base
    key = tuple(int(v) for v in col)
    if key not in mat_index:
        mat_index[key] = len(tile_mats)
        tile_mats.append(flat(key, 0.85))
    h = HEIGHT[t]
    c = center(i)
    res = bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((c.x, c.y, h / 2 - 0.2)) @ Matrix.Diagonal((T, T, h, 1)))
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = mat_index[key]
    top_of[i] = h - 0.2
me_mesh = bpy.data.meshes.new("Map")
bm.to_mesh(me_mesh)
bm.free()
map_obj = bpy.data.objects.new("Map", me_mesh)
for m in tile_mats:
    map_obj.data.materials.append(m)
scene.collection.objects.link(map_obj)

bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
water = bpy.context.active_object
water.scale = (W * T + 800, H * T + 800, 1)
wm = flat((38, 104, 168), 0.25)
water.data.materials.append(wm)

BUILDERS = {"Tank": mm.tank, "City": mm.city, "Port": mm.port, "Defense": mm.defense, "Factory": mm.factory,
            "Silo": mm.silo, "Nuke": mm.nuke, "TransportShip": mm.transport_ship, "TradeShip": mm.trade_ship}


def place(kind, owner, size, pos, look=None):
    """Как Models.make: ширина по земле = size, опора — центр низа, нос (+Y) смотрит в look."""
    root, objs = BUILDERS[kind]().build()
    team = flat(nations[owner]["color"], 0.6)
    for o in objs[1:]:
        if o.name.startswith("Team"):
            o.data.materials[0] = team
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs[1:] for c in o.bound_box]
    minx, maxx = min(p.x for p in pts), max(p.x for p in pts)
    miny, maxy = min(p.y for p in pts), max(p.y for p in pts)
    minz = min(p.z for p in pts)
    span = max(maxx - minx, maxy - miny)
    k = size / span
    root.scale = (k, k, k)
    offset = Vector(((minx + maxx) / 2, (miny + maxy) / 2, minz)) * k
    yaw = 0.0
    if look is not None and look.length > 1e-6:
        yaw = math.atan2(-look.x, look.y)
    rot = Matrix.Rotation(yaw, 4, "Z")
    root.matrix_world = Matrix.Translation(pos) @ rot @ Matrix.Translation(-offset) @ Matrix.Diagonal((k, k, k, 1))
    return root


labels = []
for b in st["buildings"]:
    i, kind, lvl = b["tile"], b["kind"], b["level"]
    if b["owner"] <= 0:
        continue
    pos = center(i)
    pos.z = top_of.get(i, 0)
    look = None
    if kind == "Port":
        x, y = (i - 1) % W, (i - 1) // W
        for n in (i - 1, i + 1, i - W, i + W):
            if 1 <= n <= W * H and st["terrain"][n - 1] == 0:
                look = center(n) - center(i)
                break
    place(kind, b["owner"], T * (0.78 + 0.05 * lvl), pos, look)
    if lvl > 1:
        labels.append({"pos": (pos + Vector((0, 0, T * 0.9 + 0.8))).to_tuple(), "text": f"ур. {lvl}"})

for s in st["ships"]:
    a, b = center(s["a"]), center(s["b"])
    pos = a.lerp(b, s["u"])
    pos.z = 0.05
    size = T * 0.55 if s["kind"] == "TradeShip" else T * 0.5
    place(s["kind"], s["owner"], size, pos, b - a)
for tk in st["tanks"]:
    a, b = center(tk["from"]), center(tk["to"])
    pos = a.lerp(b, 0.55)
    pos.z = max(top_of.get(tk["from"], 0.8), top_of.get(tk["to"], 0.8))
    place("Tank", tk["owner"], T * 0.45, pos, b - a)

# камера клиента: позиция = фокус + (0, zoom, zoom*0.45) в Roblox, FOV 50 по вертикали
mine = [i for i, o in enumerate(st["owner"], start=1) if o == ME]
fx = sum(center(i).x for i in mine) / len(mine)
fy = sum(center(i).y for i in mine) / len(mine)
focus = Vector((fx, fy, 0))
cam_data = bpy.data.cameras.new("Cam")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(50)
cam_data.clip_end = 2000
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
cam.location = focus + Vector((0, -ZOOM * 0.45, ZOOM))
cam.rotation_euler = (focus - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

# свет как в Roblox днём
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (*lin((150, 172, 200)), 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
bpy.ops.object.light_add(type="SUN")
sun = bpy.context.active_object
sun.data.energy = 3.2
sun.data.angle = math.radians(3)
sun.rotation_euler = (math.radians(32), math.radians(-14), math.radians(35))

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 40
scene.cycles.use_denoising = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 886
scene.view_settings.view_transform = "Standard"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)

out = []
for lab in labels:
    v = world_to_camera_view(scene, cam, Vector(lab["pos"]))
    if 0 < v.x < 1 and 0 < v.y < 1 and v.z > 0:
        out.append({"x": v.x * 1920, "y": (1 - v.y) * 886, "text": lab["text"]})
json.dump(out, open(LABELS, "w"), ensure_ascii=False)
print("labels", len(out))
