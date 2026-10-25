"""Модели и анимации для игры «Клинок арены».

Запуск:
    blender -b -P make_game_assets.py
    python make_game_assets.py          # с модулем bpy (pip install bpy)

Создаёт в папке ../../game/assets:
    knight.json — рыцарь со скелетом и анимациями Idle, Run, Attack, Hit, Die
    goblin.json — гоблин с теми же анимациями
    arena.json  — арена: площадка, колонны с факелами, камни, деревья
    potion.json — зелье здоровья
Это обычный glTF 2.0 с данными внутри (base64); расширение .json — потому что
хостинг игры отдаёт только веб-типы файлов. Открывается любым glTF-импортёром.
и game_assets.blend рядом со скриптом.
"""
import base64
import json
import math
import os
import random
import struct

import bpy  # bpy импортируется первым: он подключает bmesh
import bmesh
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "game", "assets"))
FPS = 30


# ---------------------------------------------------------------- утилиты

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS


def material(name, color, roughness=0.8, metallic=0.0, emission=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 3.0
    return m


def srgb(hex_color):
    """#rrggbb -> линейный цвет для Blender."""
    h = hex_color.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


class MeshBuilder:
    """Собирает low-poly меш из примитивов; каждую деталь можно привязать к кости."""

    def __init__(self):
        self.bm = bmesh.new()
        self.deform = self.bm.verts.layers.deform.verify()
        self.mats = []
        self.groups = []

    def _matrix(self, loc, rot, scale):
        return (Matrix.Translation(Vector(loc))
                @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()
                @ Matrix.Diagonal((*scale, 1.0)))

    def _finish(self, verts, mat, bone):
        if mat not in self.mats:
            self.mats.append(mat)
        mi = self.mats.index(mat)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = mi
        if bone:
            if bone not in self.groups:
                self.groups.append(bone)
            gi = self.groups.index(bone)
            for v in verts:
                v[self.deform][gi] = 1.0

    def box(self, mat, loc, size, rot=(0, 0, 0), bone=None):
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=self._matrix(loc, rot, size))
        self._finish(res["verts"], mat, bone)

    def cone(self, mat, loc, r1, r2, depth, seg=6, rot=(0, 0, 0), scale=(1, 1, 1), bone=None):
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                                    radius1=r1, radius2=r2, depth=depth,
                                    matrix=self._matrix(loc, rot, scale))
        self._finish(res["verts"], mat, bone)

    def ball(self, mat, loc, r, subdiv=1, scale=(1, 1, 1), rot=(0, 0, 0), bone=None, jitter=0.0):
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=r,
                                         matrix=self._matrix(loc, rot, scale))
        if jitter:
            for v in res["verts"]:
                v.co += Vector([random.uniform(-jitter, jitter) for _ in range(3)])
        self._finish(res["verts"], mat, bone)

    def to_object(self, name):
        me = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        obj = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(obj)
        for m in self.mats:
            obj.data.materials.append(m)
        for g in self.groups:
            obj.vertex_groups.new(name=g)
        return obj


# ---------------------------------------------------------------- скелет

# Кости гуманоида: имя -> (начало, конец, родитель). Персонаж смотрит в -Y.
def humanoid_bones(s):
    def p(x, y, z):
        return Vector((x * s, y * s, z * s))
    sx, hx = 0.27, 0.11
    return {
        "root": (p(0, 0, 0), p(0, 0, 0.25), None),
        "hips": (p(0, 0, 0.88), p(0, 0, 1.0), "root"),
        "spine": (p(0, 0, 1.0), p(0, 0, 1.25), "hips"),
        "chest": (p(0, 0, 1.25), p(0, 0, 1.5), "spine"),
        "head": (p(0, 0, 1.52), p(0, 0, 1.85), "chest"),
        "upperarm.L": (p(sx, 0, 1.45), p(sx, 0, 1.15), "chest"),
        "forearm.L": (p(sx, 0, 1.15), p(sx, 0, 0.88), "upperarm.L"),
        "hand.L": (p(sx, 0, 0.88), p(sx, 0, 0.78), "forearm.L"),
        "upperarm.R": (p(-sx, 0, 1.45), p(-sx, 0, 1.15), "chest"),
        "forearm.R": (p(-sx, 0, 1.15), p(-sx, 0, 0.88), "upperarm.R"),
        "hand.R": (p(-sx, 0, 0.88), p(-sx, 0, 0.78), "forearm.R"),
        "thigh.L": (p(hx, 0, 0.92), p(hx, 0, 0.5), "hips"),
        "shin.L": (p(hx, 0, 0.5), p(hx, 0, 0.06), "thigh.L"),
        "thigh.R": (p(-hx, 0, 0.92), p(-hx, 0, 0.5), "hips"),
        "shin.R": (p(-hx, 0, 0.5), p(-hx, 0, 0.06), "thigh.R"),
    }


def build_armature(name, bones):
    arm_data = bpy.data.armatures.new(name + "_Rig")
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for bname, (head, tail, parent) in bones.items():
        eb = arm_data.edit_bones.new(bname)
        eb.head, eb.tail = head, tail
        # Ось Z каждой кости смотрит вперёд: +X поворот = наклон/мах вперёд
        eb.align_roll(Vector((0, -1, 0)))
        if parent:
            eb.parent = arm_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    return arm


def bind(mesh, arm):
    mesh.parent = arm
    mod = mesh.modifiers.new("Armature", "ARMATURE")
    mod.object = arm


def make_action(arm, name, keys):
    """keys: [(кадр, {кость: (rx, ry, rz) в градусах}, {кость: (x, y, z)})]."""
    ad = arm.animation_data or arm.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ad.action = act
    for frame, rots, locs in keys:
        for pb in arm.pose.bones:
            r = rots.get(pb.name, (0, 0, 0))
            pb.rotation_euler = [math.radians(a) for a in r]
            pb.location = locs.get(pb.name, (0, 0, 0))
            pb.keyframe_insert("rotation_euler", frame=frame)
            pb.keyframe_insert("location", frame=frame)
    track = ad.nla_tracks.new()
    track.name = name
    track.strips.new(name, int(keys[0][0]), act)
    ad.action = None
    return act


def merge(base, extra):
    out = dict(base)
    out.update(extra)
    return out


# ---------------------------------------------------------------- анимации

def humanoid_actions(arm, style):
    """style: 'knight' (меч и щит) или 'goblin' (дубина, сутулый)."""
    hunch = 0 if style == "knight" else 14
    if style == "knight":
        guard = {"upperarm.R": (25, 0, 0), "forearm.R": (55, 0, 0), "hand.R": (-25, 0, 0),
                 "upperarm.L": (30, 0, 15), "forearm.L": (70, 0, -10)}
    else:
        guard = {"upperarm.R": (20, 0, -10), "forearm.R": (50, 0, 0), "hand.R": (10, 0, 0),
                 "upperarm.L": (15, 0, 15), "forearm.L": (35, 0, 0)}
    base = merge(guard, {"spine": (hunch, 0, 0), "head": (-hunch, 0, 0),
                         "thigh.L": (8, 0, 0), "thigh.R": (-4, 0, 0),
                         "shin.L": (-10, 0, 0), "shin.R": (-6, 0, 0)})

    make_action(arm, "Idle", [
        (0, base, {}),
        (30, merge(base, {"chest": (4, 0, 0), "head": (-hunch - 3, 0, 0),
                          "forearm.R": (guard["forearm.R"][0] + 6, 0, 0)}),
         {"root": (0, -0.02, 0)}),
        (60, base, {}),
    ])

    lean = 12 + hunch
    def run_pose(side):
        f, b = ("L", "R") if side > 0 else ("R", "L")
        arms = {"upperarm.R": (guard["upperarm.R"][0] - 12 * side, 0, 0)}
        if style == "goblin":
            arms["upperarm.L"] = (30 * side, 0, 10)
        else:
            arms["upperarm.L"] = (guard["upperarm.L"][0] + 10 * side, 0, 15)
        return merge(merge(guard, arms), {
            "spine": (lean, 8 * side, 0), "head": (-lean + 4, -6 * side, 0),
            f"thigh.{f}": (40, 0, 0), f"shin.{f}": (-15, 0, 0),
            f"thigh.{b}": (-30, 0, 0), f"shin.{b}": (-60, 0, 0),
        })
    pass_pose = merge(guard, {"spine": (lean, 0, 0), "head": (-lean + 4, 0, 0),
                              "thigh.L": (0, 0, 0), "shin.L": (-70, 0, 0),
                              "thigh.R": (0, 0, 0), "shin.R": (-10, 0, 0)})
    pass_pose_r = merge(pass_pose, {"shin.L": (-10, 0, 0), "shin.R": (-70, 0, 0)})
    make_action(arm, "Run", [
        (0, run_pose(1), {"root": (0, 0, 0)}),
        (5, pass_pose_r, {"root": (0, 0.07, 0)}),
        (10, run_pose(-1), {"root": (0, 0, 0)}),
        (15, pass_pose, {"root": (0, 0.07, 0)}),
        (20, run_pose(1), {"root": (0, 0, 0)}),
    ])

    if style == "knight":
        windup = {"upperarm.R": (165, 0, -25), "forearm.R": (35, 0, 0), "hand.R": (-10, 0, 0),
                  "spine": (-8, -30, 0), "chest": (0, -10, 0)}
        strike = {"upperarm.R": (75, 0, 35), "forearm.R": (5, 0, 0), "hand.R": (-70, 0, 0),
                  "spine": (22, 30, 0), "chest": (6, 15, 0)}
    else:
        windup = {"upperarm.R": (175, 0, -10), "forearm.R": (45, 0, 0), "hand.R": (10, 0, 0),
                  "spine": (-12, -15, 0)}
        strike = {"upperarm.R": (65, 0, 15), "forearm.R": (0, 0, 0), "hand.R": (-35, 0, 0),
                  "spine": (35, 15, 0)}
    step = {"thigh.L": (35, 0, 0), "shin.L": (-25, 0, 0), "thigh.R": (-20, 0, 0), "shin.R": (-20, 0, 0)}
    make_action(arm, "Attack", [
        (0, base, {}),
        (6, merge(merge(base, windup), {"thigh.L": (15, 0, 0)}), {"root": (0, 0.02, 0)}),
        (10, merge(merge(base, strike), step), {"root": (0, -0.04, 0)}),
        (13, merge(merge(base, strike), step), {"root": (0, -0.04, 0)}),
        (20, base, {}),
    ])

    make_action(arm, "Hit", [
        (0, base, {}),
        (3, merge(base, {"spine": (hunch - 22, -10, 0), "chest": (-12, 0, 0), "head": (-25, 0, 0),
                         "upperarm.L": (50, 0, 40), "forearm.L": (60, 0, 0),
                         "thigh.R": (-15, 0, 0), "shin.R": (-25, 0, 0)}),
         {"root": (0, -0.03, 0)}),
        (12, base, {}),
    ])

    fall_arms = {"upperarm.R": (150, 0, -40), "forearm.R": (20, 0, 0),
                 "upperarm.L": (150, 0, 40), "forearm.L": (20, 0, 0)}
    make_action(arm, "Die", [
        (0, base, {}),
        (8, merge(base, {"spine": (25, 0, 0), "head": (20, 0, 0), "thigh.L": (45, 0, 0),
                         "shin.L": (-70, 0, 0), "thigh.R": (35, 0, 0), "shin.R": (-80, 0, 0)}),
         {"root": (0, -0.15, 0)}),
        (20, merge(fall_arms, {"root": (-85, 0, 0), "spine": (-10, 0, 0), "head": (-15, 0, 0),
                               "thigh.L": (25, 0, 0), "shin.L": (-30, 0, 0),
                               "thigh.R": (10, 0, 0), "shin.R": (-15, 0, 0)}),
         {"root": (0, -0.05, 0)}),
        (24, merge(fall_arms, {"root": (-90, 0, 0), "head": (-5, 0, 0),
                               "thigh.L": (10, 0, 0), "shin.L": (-10, 0, 0)}),
         {"root": (0, -0.05, 0)}),
    ])


# ---------------------------------------------------------------- рыцарь

def build_knight():
    steel = material("K_Steel", srgb("#aeb7c2"), 0.35, 0.6)
    dark_steel = material("K_DarkSteel", srgb("#5c6672"), 0.4, 0.6)
    cloth = material("K_Tabard", srgb("#2a5db0"), 0.9)
    trim = material("K_Gold", srgb("#d9a441"), 0.4, 0.8)
    leather = material("K_Leather", srgb("#5a3a22"), 0.8)
    visor = material("K_Visor", srgb("#14171c"), 0.6)
    plume = material("K_Plume", srgb("#d8402f"), 0.9)
    blade = material("K_Blade", srgb("#e4ebf2"), 0.2, 0.9)

    b = MeshBuilder()
    for side, x in (("L", 0.11), ("R", -0.11)):
        b.box(leather, (x, -0.04, 0.05), (0.13, 0.24, 0.1), bone=f"shin.{side}")
        b.cone(steel, (x, 0, 0.3), 0.075, 0.085, 0.42, seg=6, bone=f"shin.{side}")
        b.box(steel, (x, -0.06, 0.5), (0.11, 0.06, 0.09), bone=f"shin.{side}")       # наколенник
        b.cone(dark_steel, (x, 0, 0.72), 0.085, 0.095, 0.42, seg=6, bone=f"thigh.{side}")
    b.box(leather, (0, 0, 0.95), (0.38, 0.24, 0.12), bone="hips")                       # пояс
    b.box(trim, (0, -0.125, 0.95), (0.08, 0.02, 0.08), bone="hips")                    # пряжка
    b.box(cloth, (0, -0.07, 0.8), (0.3, 0.06, 0.26), rot=(-6, 0, 0), bone="hips")      # полы
    b.box(cloth, (0, 0.07, 0.8), (0.3, 0.06, 0.26), rot=(6, 0, 0), bone="hips")
    b.box(cloth, (0, 0, 1.13), (0.4, 0.26, 0.28), bone="spine")
    b.box(steel, (0, 0, 1.37), (0.46, 0.3, 0.26), bone="chest")                         # кираса
    b.box(trim, (0, -0.152, 1.37), (0.05, 0.01, 0.2), bone="chest")
    b.cone(dark_steel, (0, 0, 1.52), 0.07, 0.07, 0.08, seg=8, bone="chest")
    for side, x in (("L", 0.27), ("R", -0.27)):
        b.ball(steel, (x * 1.03, 0, 1.44), 0.12, scale=(1, 1, 0.8), bone=f"upperarm.{side}")
        b.cone(dark_steel, (x, 0, 1.28), 0.055, 0.06, 0.3, seg=6, bone=f"upperarm.{side}")
        b.cone(steel, (x, 0, 1.01), 0.05, 0.065, 0.28, seg=6, bone=f"forearm.{side}")
        b.box(leather, (x, 0, 0.83), (0.09, 0.1, 0.1), bone=f"hand.{side}")
    # шлем
    b.cone(steel, (0, 0, 1.67), 0.15, 0.15, 0.24, seg=8, bone="head")
    b.cone(steel, (0, 0, 1.83), 0.15, 0.04, 0.1, seg=8, bone="head")
    b.box(visor, (0, -0.135, 1.69), (0.2, 0.04, 0.035), bone="head")
    b.box(visor, (0, -0.14, 1.63), (0.03, 0.03, 0.08), bone="head")
    b.box(plume, (0, 0.02, 1.92), (0.05, 0.26, 0.1), rot=(-10, 0, 0), bone="head")
    # меч в правой руке: клинок вперёд (-Y)
    hx, hz = -0.27, 0.83
    b.cone(leather, (hx, -0.0, hz), 0.022, 0.022, 0.16, seg=6, rot=(90, 0, 0), bone="hand.R")
    b.ball(trim, (hx, 0.1, hz), 0.035, bone="hand.R")
    b.box(trim, (hx, -0.09, hz), (0.26, 0.04, 0.04), bone="hand.R")
    b.cone(blade, (hx, -0.5, hz), 0.045, 0.004, 0.8, seg=4, rot=(90, 0, 45),
           scale=(1, 0.22, 1), bone="hand.R")
    # щит на левой руке
    b.box(cloth, (0.37, -0.02, 1.0), (0.05, 0.38, 0.46), bone="forearm.L")
    b.box(trim, (0.40, -0.02, 1.0), (0.02, 0.06, 0.36), bone="forearm.L")
    b.box(trim, (0.40, -0.02, 1.04), (0.02, 0.26, 0.06), bone="forearm.L")
    b.box(steel, (0.37, -0.02, 1.24), (0.055, 0.4, 0.04), bone="forearm.L")
    b.cone(steel, (0.37, -0.02, 0.74), 0.19, 0.0, 0.1, seg=4, rot=(0, 0, 45),
           scale=(0.18, 1.0, 1), bone="forearm.L")

    arm = build_armature("Knight", humanoid_bones(1.0))
    mesh = b.to_object("KnightMesh")
    bind(mesh, arm)
    humanoid_actions(arm, "knight")
    return arm, mesh


# ---------------------------------------------------------------- гоблин

def build_goblin():
    s = 0.72
    skin = material("G_Skin", srgb("#6fa83a"), 0.85)
    skin_dark = material("G_SkinDark", srgb("#4c7a26"), 0.85)
    rag = material("G_Rag", srgb("#7b5a3a"), 0.95)
    belt = material("G_Belt", srgb("#3b2a1c"), 0.8)
    eye = material("G_Eye", srgb("#ffd23a"), 0.3, emission=srgb("#ffb000"))
    tooth = material("G_Tooth", srgb("#efe6c8"), 0.6)
    wood = material("G_Club", srgb("#8a5a32"), 0.9)
    spike = material("G_Spike", srgb("#9aa1a8"), 0.4, 0.6)

    def P(x, y, z):
        return (x * s, y * s, z * s)

    b = MeshBuilder()
    for side, x in (("L", 0.11), ("R", -0.11)):
        b.box(skin_dark, P(x, -0.07, 0.04), (0.12 * s, 0.26 * s, 0.08 * s), bone=f"shin.{side}")
        b.cone(skin, P(x, 0, 0.3), 0.05 * s, 0.065 * s, 0.44 * s, seg=5, bone=f"shin.{side}")
        b.cone(rag, P(x, 0, 0.72), 0.08 * s, 0.09 * s, 0.4 * s, seg=5, bone=f"thigh.{side}")
    b.box(rag, P(0, 0, 0.88), (0.38 * s, 0.26 * s, 0.24 * s), bone="hips")
    b.box(belt, P(0, 0, 0.98), (0.4 * s, 0.28 * s, 0.07 * s), bone="hips")
    b.ball(skin, P(0, 0.02, 1.15), 0.2 * s, scale=(1.05, 0.85, 1.1), bone="spine")      # живот
    b.box(rag, P(0, 0, 1.37), (0.42 * s, 0.28 * s, 0.24 * s), rot=(0, 0, 4), bone="chest")
    for side, x in (("L", 0.27), ("R", -0.27)):
        b.ball(skin_dark, P(x, 0, 1.44), 0.08 * s, bone=f"upperarm.{side}")
        b.cone(skin, P(x, 0, 1.29), 0.045 * s, 0.055 * s, 0.3 * s, seg=5, bone=f"upperarm.{side}")
        b.cone(skin, P(x, 0, 1.02), 0.04 * s, 0.05 * s, 0.28 * s, seg=5, bone=f"forearm.{side}")
        b.ball(skin_dark, P(x, 0, 0.84), 0.06 * s, bone=f"hand.{side}")
    # голова: большая, с ушами
    b.ball(skin, P(0, -0.02, 1.72), 0.24 * s, subdiv=1, scale=(1.1, 1.0, 0.95), bone="head")
    b.cone(skin, P(0, -0.24, 1.68), 0.05 * s, 0.01 * s, 0.14 * s, seg=4, rot=(90, 0, 0), bone="head")
    for x in (0.24, -0.24):
        sign = 1 if x > 0 else -1
        b.cone(skin_dark, P(x * 1.35, 0.04, 1.78), 0.07 * s, 0.0, 0.3 * s, seg=4,
               rot=(0, sign * 70, 0), scale=(1, 0.35, 1), bone="head")
        b.ball(eye, P(x * 0.38, -0.2, 1.76), 0.045 * s, subdiv=1, bone="head")
        b.cone(tooth, P(x * 0.3, -0.2, 1.57), 0.02 * s, 0.0, 0.07 * s, seg=4, rot=(180, 0, 0),
               bone="head")
    b.box(belt, P(0, -0.21, 1.6), (0.22 * s, 0.03 * s, 0.03 * s), bone="head")          # рот
    # дубина в правой руке
    hx, hz = -0.27, 0.84
    b.cone(wood, P(hx, -0.28, hz), 0.03 * s, 0.075 * s, 0.6 * s, seg=6, rot=(90, 0, 0), bone="hand.R")
    for a in range(4):
        ang = a * math.pi / 2
        # шип смотрит наружу от оси дубины (поворот оси Z конуса вокруг Y)
        b.cone(spike, P(hx + math.cos(ang) * 0.07, -0.5, hz + math.sin(ang) * 0.07),
               0.018 * s, 0.0, 0.07 * s, seg=4, rot=(0, 90 - math.degrees(ang), 0), bone="hand.R")

    arm = build_armature("Goblin", humanoid_bones(s))
    mesh = b.to_object("GoblinMesh")
    bind(mesh, arm)
    humanoid_actions(arm, "goblin")
    return arm, mesh


# ---------------------------------------------------------------- арена

def build_arena():
    random.seed(7)
    grass = material("A_Grass", srgb("#46703a"), 1.0)
    grass2 = material("A_GrassDark", srgb("#3b6430"), 1.0)
    sand = material("A_Sand", srgb("#a88d62"), 1.0)
    stone = material("A_Stone", srgb("#8d8f93"), 0.9)
    stone_dark = material("A_StoneDark", srgb("#6a6c70"), 0.9)
    trunk = material("A_Trunk", srgb("#6b4a2e"), 1.0)
    leaves = material("A_Leaves", srgb("#2f6b3a"), 1.0)
    leaves2 = material("A_Leaves2", srgb("#3f8a45"), 1.0)
    fire = material("A_Fire", srgb("#ffb347"), 0.5, emission=srgb("#ff8a1e"))
    banner = material("A_Banner", srgb("#b3332b"), 0.9)

    b = MeshBuilder()
    b.cone(grass2, (0, 0, -0.06), 45, 45, 0.1, seg=48)
    b.cone(grass, (0, 0, -0.02), 15, 15, 0.04, seg=40)
    b.cone(sand, (0, 0, 0.0), 12, 12, 0.04, seg=40)
    # каменное кольцо по краю площадки
    n = 40
    for i in range(n):
        a = i / n * 2 * math.pi
        r = 12.25
        mat = stone if i % 2 else stone_dark
        b.box(mat, (math.cos(a) * r, math.sin(a) * r, 0.1), (0.5, 2 * math.pi * r / n * 0.95, 0.2),
              rot=(0, 0, math.degrees(a)))
    # колонны с факелами
    for i in range(8):
        a = i / 8 * 2 * math.pi + math.pi / 8
        x, y = math.cos(a) * 13.2, math.sin(a) * 13.2
        b.box(stone_dark, (x, y, 0.2), (1.1, 1.1, 0.4), rot=(0, 0, math.degrees(a)))
        b.cone(stone, (x, y, 1.6), 0.38, 0.32, 2.6, seg=8)
        b.box(stone_dark, (x, y, 3.0), (0.95, 0.95, 0.25), rot=(0, 0, math.degrees(a)))
        b.cone(stone_dark, (x, y, 3.25), 0.3, 0.42, 0.3, seg=8)
        b.cone(fire, (x, y, 3.6), 0.2, 0.0, 0.5, seg=6)
        if i % 2 == 0:
            bx, by = math.cos(a) * 12.82, math.sin(a) * 12.82
            b.box(banner, (bx, by, 2.0), (0.04, 0.55, 1.1), rot=(0, 0, math.degrees(a)))
    # камни
    for _ in range(26):
        a = random.uniform(0, 2 * math.pi)
        r = random.uniform(14.5, 24)
        sc = random.uniform(0.4, 1.3)
        b.ball(random.choice([stone, stone_dark]), (math.cos(a) * r, math.sin(a) * r, sc * 0.25),
               sc, subdiv=1, scale=(1.2, 1.0, 0.7), rot=(0, 0, random.uniform(0, 360)), jitter=0.12 * sc)
    # деревья
    for _ in range(46):
        a = random.uniform(0, 2 * math.pi)
        r = random.uniform(16, 32)
        x, y = math.cos(a) * r, math.sin(a) * r
        h = random.uniform(0.8, 1.4)
        b.cone(trunk, (x, y, 0.6 * h), 0.18 * h, 0.12 * h, 1.2 * h, seg=6)
        for k, (rr, zz) in enumerate(((1.3, 1.6), (1.0, 2.5), (0.7, 3.3))):
            b.cone(leaves if k % 2 == 0 else leaves2, (x, y, zz * h), rr * h, 0.05, 1.4 * h, seg=7,
                   rot=(0, 0, random.uniform(0, 60)))
    return b.to_object("Arena")


def build_potion():
    glass = material("P_Glass", srgb("#e0334a"), 0.15, emission=srgb("#ff2244"))
    cork = material("P_Cork", srgb("#a8794a"), 0.9)
    neck = material("P_Neck", srgb("#cfe3ea"), 0.2)
    b = MeshBuilder()
    b.ball(glass, (0, 0, 0.18), 0.16, subdiv=2)
    b.cone(neck, (0, 0, 0.36), 0.06, 0.05, 0.12, seg=8)
    b.cone(cork, (0, 0, 0.45), 0.055, 0.06, 0.07, seg=8)
    return b.to_object("Potion")


# ---------------------------------------------------------------- экспорт

def glb_to_embedded_json(glb_path, json_path):
    """GLB -> glTF JSON с бинарным буфером в data: URI."""
    with open(glb_path, "rb") as f:
        data = f.read()
    json_len = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + json_len])
    bin_off = 20 + json_len
    bin_len = struct.unpack_from("<I", data, bin_off)[0]
    blob = data[bin_off + 8:bin_off + 8 + bin_len]
    gltf["buffers"][0]["uri"] = ("data:application/octet-stream;base64,"
                                 + base64.b64encode(blob).decode("ascii"))
    with open(json_path, "w") as f:
        json.dump(gltf, f, separators=(",", ":"))
    os.remove(glb_path)


def export(objs, filename, animations=False):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    glb = os.path.join(OUT, filename.replace(".json", ".glb"))
    bpy.ops.export_scene.gltf(
        filepath=glb,
        use_selection=True,
        export_apply=False,
        export_animations=animations,
        export_animation_mode="NLA_TRACKS" if animations else "ACTIONS",
        export_force_sampling=True,
        export_frame_range=False,
        export_yup=True,
    )
    glb_to_embedded_json(glb, os.path.join(OUT, filename))


def main():
    os.makedirs(OUT, exist_ok=True)
    reset_scene()

    knight, kmesh = build_knight()
    goblin, gmesh = build_goblin()
    arena = build_arena()
    potion = build_potion()

    export([knight, kmesh], "knight.json", animations=True)
    export([goblin, gmesh], "goblin.json", animations=True)
    export([arena], "arena.json")
    export([potion], "potion.json")

    goblin.location.x = 1.5
    potion.location.x = -1.5
    arena.hide_set(True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "game_assets.blend"))


if __name__ == "__main__":
    main()
