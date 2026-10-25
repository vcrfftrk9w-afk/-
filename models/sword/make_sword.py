"""Процедурная 3D-модель длинного меча для Blender.

Запуск:
    blender -b -P make_sword.py            # из установленного Blender
    python make_sword.py                   # если установлен модуль bpy (pip install bpy)

Результат (рядом со скриптом): sword.blend, sword.glb, sword.obj/.mtl, sword_preview.png
"""
import math
import os

import bpy  # bpy импортируется первым: он подключает bmesh
import bmesh
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))

# Размеры в метрах
BLADE_LEN = 0.92
BLADE_HALF_W = 0.026
BLADE_HALF_T = 0.0045
TIP_START = 0.80      # доля длины, с которой клинок сужается к острию
GUARD_HALF_W = 0.115
GRIP_LEN = 0.21
POMMEL_R = 0.032


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, metallic, roughness, **extra):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    for key, val in extra.items():
        bsdf.inputs[key].default_value = val
    return m


def mesh_object(name, bm, mat, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_bevel(obj, width, segments=2):
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    return mod


def blade_profile(t):
    """Полуширина клинка на относительной высоте t (0 — у гарды, 1 — острие)."""
    if t < TIP_START:
        # лёгкое сужение по всей длине (дистальная конусность)
        return BLADE_HALF_W * (1.0 - 0.28 * t / TIP_START)
    k = (t - TIP_START) / (1.0 - TIP_START)
    base = BLADE_HALF_W * 0.72
    return base * math.cos(k * math.pi / 2) ** 0.8


def build_blade(mat):
    bm = bmesh.new()
    steps = 80
    rings = []
    for i in range(steps + 1):
        t = i / steps
        z = t * BLADE_LEN
        w = max(blade_profile(t), 0.0)
        th = BLADE_HALF_T * (1.0 - 0.55 * t)   # клинок тоньше к острию
        # Сечение: ромб с плоскими гранями и долом посередине
        fw = w * 0.38                           # ширина дола
        fd = th * 0.35 * min(max((0.65 - t) / 0.12, 0.0), 1.0)  # дол плавно сходит на нет
        pts = [
            (-w, 0.0), (-fw, th), (0.0, th - fd), (fw, th),
            (w, 0.0), (fw, -th), (0.0, -th + fd), (-fw, -th),
        ]
        if i == steps:
            rings.append([bm.verts.new((0.0, 0.0, z))])
        else:
            rings.append([bm.verts.new((x, y, z)) for x, y in pts])

    n = len(rings[0])
    for a, b in zip(rings[:-1], rings[1:]):
        for j in range(n):
            j2 = (j + 1) % n
            if len(b) == 1:
                bm.faces.new((a[j], a[j2], b[0]))
            else:
                bm.faces.new((a[j], a[j2], b[j2], b[j]))
    bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = mesh_object("Blade", bm, mat)
    obj.location.z = 0.012
    return obj


def build_guard(mat):
    """Крестовина: брусок, загнутый к клинку, с утолщёнными концами."""
    bm = bmesh.new()
    seg = 40
    rings = []
    for i in range(seg + 1):
        u = i / seg * 2 - 1                      # -1..1 вдоль крестовины
        x = u * GUARD_HALF_W
        z = 0.018 * u * u                         # изгиб вверх к клинку
        swell = 1.0 + 0.6 * abs(u) ** 6           # шарики на концах
        hw, hh = 0.011 * swell, 0.008 * swell
        rings.append([
            bm.verts.new((x, -hw, z - hh)), bm.verts.new((x, hw, z - hh)),
            bm.verts.new((x, hw, z + hh)), bm.verts.new((x, -hw, z + hh)),
        ])
    for a, b in zip(rings[:-1], rings[1:]):
        for j in range(4):
            j2 = (j + 1) % 4
            bm.faces.new((a[j], a[j2], b[j2], b[j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = mesh_object("Guard", bm, mat, smooth=True)
    sub = obj.modifiers.new("Subdivision", "SUBSURF")
    sub.levels = sub.render_levels = 2
    return obj


def build_grip(mat_leather, mat_metal):
    """Рукоять с кожаной обмоткой (спиральные валики) и металлическими кольцами."""
    bm = bmesh.new()
    seg_r, seg_z = 32, 120
    z0, z1 = -0.008, -0.008 - GRIP_LEN
    rings = []
    for i in range(seg_z + 1):
        t = i / seg_z
        z = z0 + (z1 - z0) * t
        base = 0.0155 + 0.003 * math.sin(t * math.pi)   # утолщение посередине
        ring = []
        for j in range(seg_r):
            a = j / seg_r * 2 * math.pi
            wrap = 0.0011 * math.sin(a + t * 2 * math.pi * 9) ** 8  # спиральная обмотка
            r = base + wrap
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r * 0.82, z)))
        rings.append(ring)
    for a, b in zip(rings[:-1], rings[1:]):
        for j in range(seg_r):
            j2 = (j + 1) % seg_r
            bm.faces.new((a[j], b[j], b[j2], a[j2]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    grip = mesh_object("Grip", bm, mat_leather, smooth=True)

    ferrules = []
    for name, z in (("Ferrule_Top", z0 - 0.004), ("Ferrule_Bottom", z1 + 0.004)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.0175, depth=0.009,
                                            location=(0, 0, z))
        f = bpy.context.active_object
        f.name = name
        f.scale.y = 0.85
        f.data.materials.append(mat_metal)
        add_bevel(f, 0.002, 3)
        bpy.ops.object.shade_smooth()
        ferrules.append(f)
    return grip, ferrules


def build_pommel(mat, mat_gem):
    """Дисковое навершие с камнем и шляпкой хвостовика."""
    zc = -0.008 - GRIP_LEN - POMMEL_R * 0.95
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=POMMEL_R, depth=0.022,
                                        location=(0, 0, zc), rotation=(math.pi / 2, 0, 0))
    pommel = bpy.context.active_object
    pommel.name = "Pommel"
    pommel.data.materials.append(mat)
    add_bevel(pommel, 0.006, 4)
    bpy.ops.object.shade_smooth()

    gems = []
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.011,
                                             location=(0, side * 0.0105, zc))
        g = bpy.context.active_object
        g.name = f"Gem_{'Front' if side < 0 else 'Back'}"
        g.scale.y = 0.45
        g.data.materials.append(mat_gem)
        bpy.ops.object.shade_smooth()
        gems.append(g)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.008,
                                         location=(0, 0, zc - POMMEL_R - 0.002))
    cap = bpy.context.active_object
    cap.name = "Peen_Cap"
    cap.scale.z = 0.6
    cap.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return pommel, gems, cap


def setup_render(root):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    grad = nt.nodes.new("ShaderNodeTexGradient")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value = (0, math.pi / 2, 0)
    ramp.color_ramp.elements[0].color = (0.015, 0.017, 0.022, 1)
    ramp.color_ramp.elements[1].color = (0.35, 0.38, 0.45, 1)
    nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.8

    # Меч кладём по диагонали кадра только для превью
    root.rotation_euler = (0, math.radians(72), math.radians(-12))
    bpy.context.view_layer.update()
    # центр меча (между навершием и острием) в мировых координатах
    center = root.matrix_world @ Vector((0, 0, (BLADE_LEN - GRIP_LEN - 2 * POMMEL_R) / 2))

    # Подложка
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0.25, 0), rotation=(math.pi / 2, 0, 0))
    floor = bpy.context.active_object
    floor.name = "Backdrop"
    floor.data.materials.append(material("Backdrop", (0.018, 0.02, 0.025), 0.0, 0.5))

    def area(name, loc, energy, size, color=(1, 1, 1)):
        bpy.ops.object.light_add(type="AREA", location=loc)
        L = bpy.context.active_object
        L.name = name
        L.data.energy = energy
        L.data.size = size
        L.data.color = color
        direction = center - L.location
        L.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    area("Key", center + Vector((0.6, -1.2, 1.1)), 260, 1.2, (1.0, 0.95, 0.88))
    area("Fill", center + Vector((-1.0, -1.0, -0.3)), 70, 1.5, (0.75, 0.85, 1.0))
    area("Rim", center + Vector((0.2, 0.15, 1.2)), 180, 0.6)

    bpy.ops.object.camera_add(location=center + Vector((0.0, -1.9, 0.25)))
    cam = bpy.context.active_object
    cam.data.lens = 50
    direction = center - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    return floor


def main():
    reset_scene()

    steel = material("Steel", (0.78, 0.80, 0.83), 1.0, 0.18,
                     **{"Anisotropic": 0.5})
    brass = material("Brass", (0.80, 0.58, 0.28), 1.0, 0.32)
    leather = material("Leather", (0.13, 0.065, 0.035), 0.0, 0.65)
    gem = material("Ruby", (0.6, 0.02, 0.04), 0.0, 0.05,
                   **{"Transmission Weight": 0.9, "IOR": 1.76})

    parts = [build_blade(steel), build_guard(brass)]
    grip, ferrules = build_grip(leather, brass)
    pommel, gems, cap = build_pommel(brass, gem)
    parts += [grip, *ferrules, pommel, *gems, cap]

    root = bpy.data.objects.new("Sword", None)
    bpy.context.collection.objects.link(root)
    for p in parts:
        p.parent = root

    # Экспорт в вертикальной ориентации (клинок вверх по Z)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts + [root]:
        p.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "sword.glb"),
                              use_selection=True, export_apply=True)
    bpy.ops.wm.obj_export(filepath=os.path.join(OUT, "sword.obj"),
                          export_selected_objects=True, apply_modifiers=True)

    backdrop = setup_render(root)
    bpy.context.scene.render.filepath = os.path.join(OUT, "sword_preview.png")
    bpy.ops.render.render(write_still=True)

    # В .blend сохраняем меч вертикально, без поворота для превью
    root.rotation_euler = (0, 0, 0)
    bpy.data.objects.remove(backdrop)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "sword.blend"))


if __name__ == "__main__":
    main()
