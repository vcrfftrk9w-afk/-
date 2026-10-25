"""Модели для Roblox-режима «Фронт» в стиле Rusted Warfare.

Запуск:
    blender -b -P make_models.py
    python make_models.py            # с модулем bpy (pip install bpy)

Результат в ../models:
    Tank.fbx, City.fbx, Port.fbx, Defense.fbx, Factory.fbx, Silo.fbx,
    Nuke.fbx, TransportShip.fbx, TradeShip.fbx  — для 3D Importer в Roblox Studio
    preview.png                                 — все модели на одном рендере
и roblox_models.blend рядом со скриптом.

Каждая модель состоит из нескольких мешей, по одному на цвет. Скрипты игры
красят детали по началу имени, так что цвета не зависят от импортёра:
    Team*   — цвет страны игрока
    Metal*  — светлый металл
    Dark*   — тёмная сталь, гусеницы
    Hazard* — жёлто-оранжевый
    Glass*  — стекло
    Light*  — светящиеся огни (Neon)
Нос юнитов смотрит в +Y Blender: после экспорта в FBX это -Z, то есть
LookVector в Roblox.
"""
import math
import os

import bpy  # bpy импортируется первым: он подключает bmesh
import bmesh
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "models"))

COLORS = {
    "Team": (0.10, 0.35, 0.85),
    "Metal": (0.62, 0.64, 0.66),
    "Dark": (0.12, 0.13, 0.14),
    "Hazard": (0.95, 0.62, 0.08),
    "Glass": (0.35, 0.75, 0.85),
    "Light": (1.0, 0.85, 0.35),
}


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(kind):
    m = bpy.data.materials.get(kind)
    if m:
        return m
    m = bpy.data.materials.new(kind)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*COLORS[kind], 1.0)
    bsdf.inputs["Roughness"].default_value = 0.55
    bsdf.inputs["Metallic"].default_value = 0.4 if kind in ("Metal", "Dark") else 0.0
    if kind == "Light":
        bsdf.inputs["Emission Color"].default_value = (*COLORS[kind], 1.0)
        bsdf.inputs["Emission Strength"].default_value = 4.0
    return m


def mat4(loc, rot, scale):
    return (Matrix.Translation(Vector(loc))
            @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()
            @ Matrix.Diagonal((*scale, 1.0)))


class Unit:
    """Модель из примитивов: на каждый цвет — отдельный bmesh, потом отдельный объект."""

    def __init__(self, name):
        self.name = name
        self.parts = {}

    def _bm(self, kind):
        if kind not in self.parts:
            self.parts[kind] = bmesh.new()
        return self.parts[kind]

    def box(self, kind, loc, size, rot=(0, 0, 0)):
        bmesh.ops.create_cube(self._bm(kind), size=1.0, matrix=mat4(loc, rot, size))

    def cyl(self, kind, loc, r1, r2, depth, seg=8, rot=(0, 0, 0), scale=(1, 1, 1)):
        bmesh.ops.create_cone(self._bm(kind), cap_ends=True, cap_tris=False, segments=seg,
                              radius1=r1, radius2=r2, depth=depth, matrix=mat4(loc, rot, scale))

    def wedge(self, kind, loc, size, top_scale=0.6, rot=(0, 0, 0)):
        """Усечённая пирамида (скошенный корпус): верх меньше низа."""
        bm = self._bm(kind)
        res = bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix())
        for v in res["verts"]:
            if v.co.z > 0:
                v.co.x *= top_scale
                v.co.y *= top_scale
        bmesh.ops.transform(bm, matrix=mat4(loc, rot, size), verts=res["verts"])

    def build(self):
        root = bpy.data.objects.new(self.name, None)
        bpy.context.collection.objects.link(root)
        objs = [root]
        for kind, bm in self.parts.items():
            me = bpy.data.meshes.new(f"{self.name}_{kind}")
            bm.normal_update()
            bm.to_mesh(me)
            bm.free()
            obj = bpy.data.objects.new(kind, me)
            obj.data.materials.append(material(kind))
            obj.parent = root
            bpy.context.collection.objects.link(obj)
            objs.append(obj)
        return root, objs


# ------------------------------------------------------------ модели (размеры в метрах)

def tank():
    u = Unit("Tank")
    for x in (-0.55, 0.55):
        u.box("Dark", (x, 0, 0.22), (0.32, 1.7, 0.44))
        for y in (-0.6, -0.2, 0.2, 0.6):
            u.cyl("Metal", (x * 1.32, y, 0.2), 0.14, 0.14, 0.04, seg=8, rot=(0, 90, 0))
    u.wedge("Team", (0, -0.05, 0.55), (1.0, 1.6, 0.32), top_scale=0.8)
    u.box("Hazard", (0, 0.78, 0.5), (0.7, 0.06, 0.08))
    u.wedge("Team", (0, -0.15, 0.86), (0.66, 0.8, 0.3), top_scale=0.7)
    u.cyl("Metal", (0, 0.65, 0.88), 0.07, 0.06, 1.1, seg=8, rot=(90, 0, 0))
    u.cyl("Dark", (0, 1.2, 0.88), 0.1, 0.1, 0.16, seg=8, rot=(90, 0, 0))
    u.cyl("Dark", (0.18, -0.3, 1.05), 0.12, 0.12, 0.08, seg=8)
    u.box("Light", (-0.42, 0.82, 0.55), (0.1, 0.04, 0.08))
    u.box("Light", (0.42, 0.82, 0.55), (0.1, 0.04, 0.08))
    return u


def city():
    u = Unit("City")
    u.box("Dark", (0, 0, 0.08), (3.4, 3.4, 0.16))
    towers = [(-0.8, -0.7, 0.9, 1.9), (0.7, -0.6, 0.8, 1.3), (-0.6, 0.8, 0.9, 1.1), (0.8, 0.8, 0.7, 2.4)]
    for x, y, w, h in towers:
        u.box("Metal", (x, y, 0.16 + h / 2), (w, w, h))
        u.box("Team", (x, y, 0.16 + h + 0.06), (w + 0.08, w + 0.08, 0.12))
        for k in range(int(h / 0.35)):
            z = 0.4 + k * 0.35
            u.box("Glass", (x, y - w / 2 - 0.01, z), (w * 0.7, 0.02, 0.12))
    u.cyl("Dark", (0.8, 0.8, 2.85), 0.03, 0.02, 0.7, seg=6)
    u.box("Light", (0.8, 0.8, 3.22), (0.08, 0.08, 0.08))
    u.cyl("Team", (0, 0, 0.25), 0.35, 0.35, 0.18, seg=12)
    return u


def port():
    u = Unit("Port")
    u.box("Dark", (0, 0, 0.12), (3.4, 3.4, 0.24))
    u.box("Metal", (0, 1.3, 0.28), (3.4, 0.8, 0.08))                       # причал к воде (+Y)
    for x in (-1.3, -0.4, 0.5, 1.4):
        u.cyl("Dark", (x, 1.65, -0.2), 0.08, 0.08, 0.9, seg=6)
    u.box("Team", (-0.7, -0.6, 0.75), (1.6, 1.6, 1.0))                      # склад
    u.wedge("Metal", (-0.7, -0.6, 1.4), (1.7, 1.7, 0.3), top_scale=0.4)
    u.box("Hazard", (0.9, 0.2, 1.4), (0.18, 0.18, 2.4))                     # кран
    u.box("Hazard", (0.9, 0.85, 2.55), (0.16, 1.6, 0.16))
    u.box("Dark", (0.9, 1.5, 2.2), (0.04, 0.04, 0.7))
    for i, kind in enumerate(("Team", "Hazard", "Metal")):
        u.box(kind, (1.1, -0.9 + i * 0.05, 0.42 + i * 0.36), (0.9, 0.42, 0.34))
    u.box("Light", (0.9, 0.2, 2.65), (0.1, 0.1, 0.1))
    return u


def defense():
    u = Unit("Defense")
    u.wedge("Dark", (0, 0, 0.35), (2.6, 2.6, 0.7), top_scale=0.75)
    u.box("Hazard", (0, 0, 0.72), (2.0, 2.0, 0.06))
    u.cyl("Team", (0, 0, 1.0), 0.8, 0.65, 0.55, seg=10)
    u.cyl("Metal", (0, 0, 1.35), 0.55, 0.3, 0.2, seg=10)
    for x in (-0.22, 0.22):
        u.cyl("Metal", (x, 0.95, 1.05), 0.09, 0.07, 1.3, seg=8, rot=(90, 0, 0))
        u.cyl("Dark", (x, 1.62, 1.05), 0.11, 0.11, 0.1, seg=8, rot=(90, 0, 0))
    u.box("Light", (0, -0.7, 1.05), (0.3, 0.06, 0.1))
    return u


def factory():
    u = Unit("Factory")
    u.box("Dark", (0, 0, 0.1), (3.4, 3.4, 0.2))
    u.box("Metal", (0, -0.2, 0.85), (2.8, 2.4, 1.3))
    for i in range(4):                                                      # пилообразная крыша
        x = -1.05 + i * 0.7
        u.wedge("Team", (x, -0.2, 1.65), (0.7, 2.4, 0.4), top_scale=0.15)
    u.box("Hazard", (0, 1.01, 0.6), (1.4, 0.04, 0.8))                       # ворота
    for k in range(4):
        u.box("Dark", (-0.52 + k * 0.35, 1.035, 0.6), (0.12, 0.02, 0.8), rot=(0, 30, 0))
    u.cyl("Metal", (1.1, -1.0, 1.7), 0.22, 0.17, 2.0, seg=8)                # труба
    u.cyl("Hazard", (1.1, -1.0, 2.2), 0.2, 0.2, 0.1, seg=8)
    u.box("Light", (1.1, -1.0, 2.75), (0.1, 0.1, 0.08))
    u.box("Glass", (-0.8, 1.01, 1.15), (0.8, 0.03, 0.25))
    return u


def silo():
    u = Unit("Silo")
    u.box("Dark", (0, 0, 0.2), (3.2, 3.2, 0.4))
    u.cyl("Hazard", (0, 0, 0.45), 1.3, 1.3, 0.1, seg=16)
    u.cyl("Metal", (0, 0, 0.55), 1.15, 1.05, 0.2, seg=16)
    u.box("Dark", (0, 0, 0.67), (2.0, 0.08, 0.04))                          # створки
    u.box("Dark", (0, 0, 0.67), (0.08, 2.0, 0.04))
    for x, y in ((-1.35, -1.35), (1.35, -1.35), (-1.35, 1.35), (1.35, 1.35)):
        u.box("Team", (x, y, 0.65), (0.4, 0.4, 0.5))
        u.box("Light", (x, y, 0.95), (0.12, 0.12, 0.08))
    return u


def nuke():
    u = Unit("Nuke")
    u.cyl("Metal", (0, 0, 0), 0.22, 0.22, 2.2, seg=10, rot=(90, 0, 0))
    u.cyl("Light", (0, 1.35, 0), 0.22, 0.0, 0.5, seg=10, rot=(-90, 0, 0))
    u.cyl("Hazard", (0, 0.6, 0), 0.23, 0.23, 0.12, seg=10, rot=(90, 0, 0))
    for a in range(4):
        r = a * 90
        u.box("Team", (math.cos(math.radians(r)) * 0.32, -0.9, math.sin(math.radians(r)) * 0.32),
              (0.36, 0.5, 0.04), rot=(0, -r, 0))
    u.cyl("Dark", (0, -1.15, 0), 0.18, 0.12, 0.15, seg=10, rot=(90, 0, 0))
    return u


def transport_ship():
    u = Unit("TransportShip")
    u.wedge("Team", (0, 0, 0.25), (1.1, 2.6, 0.5), top_scale=1.0)
    u.cyl("Team", (0, 1.3, 0.25), 0.55, 0.0, 0.7, seg=4, rot=(-90, 45, 0), scale=(1, 0.5, 1))
    u.box("Dark", (0, 0.1, 0.52), (0.95, 2.2, 0.06))
    u.box("Hazard", (0, 1.25, 0.5), (0.9, 0.08, 0.3))                       # аппарель
    u.box("Metal", (0, -0.85, 0.85), (0.7, 0.6, 0.6))
    u.box("Glass", (0, -0.54, 0.95), (0.6, 0.02, 0.16))
    u.cyl("Dark", (0, -1.05, 1.3), 0.07, 0.07, 0.4, seg=6)
    u.box("Light", (0, -1.05, 1.52), (0.08, 0.08, 0.06))
    return u


def trade_ship():
    u = Unit("TradeShip")
    u.wedge("Dark", (0, 0, 0.3), (1.2, 3.2, 0.6), top_scale=1.0)
    u.cyl("Dark", (0, 1.6, 0.3), 0.6, 0.0, 0.8, seg=4, rot=(-90, 45, 0), scale=(1, 0.5, 1))
    u.box("Hazard", (0, 0, 0.61), (1.22, 3.2, 0.04))
    kinds = ("Team", "Hazard", "Metal", "Team", "Metal", "Team")
    for i, kind in enumerate(kinds):
        x = -0.27 if i % 2 == 0 else 0.27
        y = 0.9 - (i // 2) * 0.62
        u.box(kind, (x, y, 0.86), (0.5, 0.56, 0.44))
    u.box("Metal", (0, -1.25, 1.0), (0.9, 0.5, 0.8))
    u.box("Glass", (0, -0.99, 1.2), (0.8, 0.02, 0.16))
    u.cyl("Team", (0.25, -1.4, 1.6), 0.1, 0.09, 0.5, seg=8)
    return u


BUILDERS = [tank, city, port, defense, factory, silo, nuke, transport_ship, trade_ship]


def export_fbx(root, objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.fbx(
        filepath=path,
        use_selection=True,
        object_types={"EMPTY", "MESH"},
        apply_unit_scale=True,
        bake_space_transform=True,
        axis_forward="-Z",
        axis_up="Y",
        mesh_smooth_type="FACE",
        add_leaf_bones=False,
        bake_anim=False,
    )


def render_preview(roots):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.view_settings.view_transform = "AgX"

    cols = 5
    for i, root in enumerate(roots):
        root.location = ((i % cols - 2) * 4.2, -(i // cols) * 4.6 + 2.2, 0)
        root.rotation_euler = (0, 0, math.radians(-35))

    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.06, 0.07, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6

    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.01))
    bpy.context.active_object.data.materials.append(material("Dark"))

    bpy.ops.object.light_add(type="SUN", location=(0, 0, 10))
    sun = bpy.context.active_object
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(30))
    bpy.ops.object.light_add(type="AREA", location=(-6, -10, 8))
    fill = bpy.context.active_object
    fill.data.energy = 900
    fill.data.size = 8
    fill.rotation_euler = (Vector((0, 0, 0)) - fill.location).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.camera_add(location=(0, -17, 13))
    cam = bpy.context.active_object
    cam.data.lens = 40
    cam.rotation_euler = (Vector((0, 0, 0.3)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.join(OUT, "preview.png")
    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    reset_scene()
    roots = []
    for make in BUILDERS:
        root, objs = make().build()
        export_fbx(root, objs, os.path.join(OUT, f"{root.name}.fbx"))
        roots.append(root)
    render_preview(roots)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "roblox_models.blend"))


if __name__ == "__main__":
    main()
