"""Paints the world map texture from the tile map in src/shared/MapData.luau, so the
picture matches the game's land and sea tile for tile: smooth coasts, shallows and deep
sea, beaches, grass and forest, desert dunes, tundra, shaded mountains with snow, ice.
Usage: python3 tools/gen_texture.py OUT_DIR
Writes OUT_DIR/map_<n>.png, one per ground chunk (4 x 2, row by row), and OUT_DIR/map_full.png.
"""
import base64
import os
import re
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 720, 336
P = 5  # texture pixels per tile
CX, CY = 4, 2  # chunks, as in src/client/Ground.luau


def load_tiles():
    src = open(os.path.join(ROOT, 'src', 'shared', 'MapData.luau'), encoding='utf-8').read()
    raw = base64.b64decode(re.search(r'return "([^"]+)"', src).group(1))
    g = np.zeros(W * H, np.uint8)
    p = 0
    for b in raw:
        n = (b & 31) + 1
        g[p:p + n] = b >> 5
        p += n
    return g.reshape(H, W)


def box(a, r, axis):
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis)
    n = a.shape[axis]
    return (np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, np.arange(n), axis=axis)) / (2 * r + 1)


def blur(a, r, passes=3):
    a = a.astype(np.float32)
    for _ in range(passes):
        a = box(box(a, r, 0), r, 1)
    return a


rng = np.random.default_rng(11)


def noise(scale, shape):
    """smooth value noise in -0.5..0.5 with features about scale pixels wide"""
    h, w = shape
    small = rng.random((h // scale + 3, w // scale + 3)).astype(np.float32)
    im = Image.fromarray((small * 255).astype(np.uint8)).resize(((w // scale + 3) * scale, (h // scale + 3) * scale), Image.BICUBIC)
    return np.asarray(im, np.float32)[:h, :w] / 255 - 0.5


def fbm(shape, scales):
    out = np.zeros(shape, np.float32)
    amp, total = 1.0, 0.0
    for s in scales:
        out += noise(s, shape) * amp
        total += amp
        amp *= 0.55
    return out / total


def up(mask):
    return np.repeat(np.repeat(mask.astype(np.float32), P, 0), P, 1)


def mix(a, b, k):
    k = np.clip(k, 0, 1)[..., None]
    return a * (1 - k) + b * k


def col(*rgb):
    return np.array(rgb, np.float32)


def paint():
    g = load_tiles()
    shape = (H * P, W * P)

    land = blur(up(g != 0), 3)  # 0..1, 0.5 on the coast
    is_land = land > 0.5
    near = blur(up(g != 0), 9, 4)  # wide blur: how close the sea is to land

    # each pixel takes the biome that dominates around it, so borders between biomes are soft
    weights = np.stack([blur(up(g == b), 4) for b in range(1, 6)])
    weights += np.stack([fbm(shape, (24, 9)) * 0.35 for _ in range(5)])
    biome = np.argmax(weights, axis=0) + 1

    n_big = fbm(shape, (90, 40, 16))
    n_mid = fbm(shape, (20, 8))
    n_fine = fbm(shape, (5, 2))

    img = np.zeros(shape + (3,), np.float32)

    # sea: turquoise shallows near the coast, deep blue further out
    shallow = np.clip((near - 0.08) / 0.4, 0, 1)
    sea = mix(col(24, 64, 112), col(44, 120, 156), shallow)
    sea = mix(sea, col(80, 170, 180), np.clip((land - 0.25) / 0.25, 0, 1) * 0.8)
    sea += (n_mid[..., None] * 10 + n_fine[..., None] * 6)
    img[:] = sea

    # height of the land, for shading: rolling hills everywhere, ridges in the mountains
    mtn = blur(up(g == 3), 4)
    ridge = 1 - np.abs(fbm(shape, (30, 12, 5)) * 2)
    height = n_big * 1.2 + n_mid * 0.6 + mtn * (2.5 + ridge * 3.5)
    height = blur(height, 1, 1)
    dx = np.roll(height, -1, 1) - np.roll(height, 1, 1)
    dy = np.roll(height, -1, 0) - np.roll(height, 1, 0)
    shade = np.clip(1 + (dx + dy) * 0.9, 0.62, 1.32)

    grass = mix(col(118, 164, 72), col(92, 146, 60), n_mid * 2 + 0.5)
    forest_k = np.clip((n_big * 2.2 + n_mid * 0.8 - 0.05) * 3, 0, 1)
    grass = mix(grass, col(58, 104, 50), forest_k)
    grass += n_fine[..., None] * 22

    dunes = np.sin((np.arange(shape[1])[None, :] * 0.11 + n_mid * 40 + np.arange(shape[0])[:, None] * 0.03)) * 0.5 + 0.5
    desert = mix(col(226, 196, 132), col(206, 168, 104), dunes * 0.3 + n_big * 0.9 + 0.15)
    desert = mix(desert, col(176, 140, 96), np.clip(n_mid * 3 - 0.6, 0, 1))
    desert += n_fine[..., None] * 14

    tundra = mix(col(148, 156, 112), col(122, 136, 98), n_mid * 2 + 0.5)
    tundra += n_fine[..., None] * 16

    rock = mix(col(146, 124, 96), col(112, 96, 80), n_mid * 2 + 0.5)
    rock = mix(rock, col(96, 120, 70), np.clip(1.4 - mtn * 1.6, 0, 1) * 0.6)
    snow_k = np.clip((height - 5.4) * 0.6, 0, 0.92)
    rock = mix(rock, col(238, 240, 246), snow_k)

    ice = mix(col(232, 238, 246), col(206, 220, 236), n_mid * 2 + 0.5)

    ground = np.zeros_like(img)
    for b, c in ((1, grass), (2, desert), (3, rock), (4, ice), (5, tundra)):
        ground[biome == b] = c[biome == b]

    # beaches on the shore, except in the mountains and the ice
    beach_k = np.clip((0.66 - land) / 0.12, 0, 1) * ((biome != 3) & (biome != 4))
    ground = mix(ground, col(226, 210, 158), beach_k * 0.9)
    ground *= shade[..., None]

    img = np.where(is_land[..., None], ground, img)

    # a light line of surf just off the coast
    surf = np.clip(1 - np.abs(land - 0.44) / 0.06, 0, 1) * (~is_land)
    img = mix(img, col(200, 230, 232), surf * 0.55)

    return np.clip(img, 0, 255).astype(np.uint8)


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    img = paint()
    Image.fromarray(img).save(os.path.join(out, 'map_full.png'))
    cw, ch = W // CX * P, H // CY * P
    for j in range(CY):
        for i in range(CX):
            n = j * CX + i
            Image.fromarray(img[j * ch:(j + 1) * ch, i * cw:(i + 1) * cw]).save(os.path.join(out, f'map_{n}.png'))
    print('chunks', CX * CY, 'size', cw, ch)


if __name__ == '__main__':
    main()
