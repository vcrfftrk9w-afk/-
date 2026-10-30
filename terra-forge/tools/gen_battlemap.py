"""Makes the skirmish map: a 4-player map, mirrored so every corner base is equal, with grass,
sand, dirt, lakes, rock ridges and resource pools. Writes the tile grid, pools and start
spots to src/shared/MapData.luau, and paints the ground picture from the textures in art/
(ground_*.jpg) to OUT_DIR as 3 x 2 chunks (map_<n>.png, row by row) plus map_full.png.
Usage: python3 tools/gen_battlemap.py OUT_DIR
"""
import base64
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 112, 72  # tiles
QW, QH = W // 2, H // 2  # one quadrant, mirrored into the other three
P = 24  # picture pixels per tile
CX, CY = 3, 2  # picture chunks, each 896 x 864: Roblox keeps pictures up to 1024 px
WATER, GRASS, SAND, DIRT, ROCK = 0, 1, 2, 3, 4
START = (11, 10)  # base centre in the top-left quadrant


def value_noise(rng, shape, scale):
    h, w = shape
    small = rng.random((h // scale + 3, w // scale + 3)).astype(np.float32)
    im = Image.fromarray((small * 255).astype(np.uint8)).resize(((w // scale + 3) * scale, (h // scale + 3) * scale), Image.BICUBIC)
    return np.asarray(im, np.float32)[:h, :w] / 255 - 0.5


def fbm(rng, shape, scales):
    out = np.zeros(shape, np.float32)
    amp, total = 1.0, 0.0
    for s in scales:
        out += value_noise(rng, shape, s) * amp
        total += amp
        amp *= 0.55
    return out / total


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


def mirror(q):
    top = np.concatenate([q, q[:, ::-1]], axis=1)
    return np.concatenate([top, top[::-1, :]], axis=0)


def quadrant(seed):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:QH, 0:QW].astype(np.float32)
    g = np.full((QH, QW), GRASS, np.uint8)
    base_d = np.hypot(xx - START[0], yy - START[1])
    # the big lake in the middle of the map, and a pond in each quadrant
    lake = np.hypot((xx - QW) * 0.8, yy - QH) + fbm(rng, (QH, QW), (6, 3)) * 6 < 9
    pond = np.hypot(xx - 40, yy - 9) + fbm(rng, (QH, QW), (4, 2)) * 4 < 4.5
    g[lake | pond] = WATER
    # sand around the water and in patches; dirt near the base and on the way out of it
    near_water = np.zeros_like(lake)
    wq = (g == WATER)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            near_water |= np.roll(np.roll(wq, dy, 0), dx, 1)
    sand = (fbm(rng, (QH, QW), (9, 4)) > 0.16) | (near_water & (g != WATER))
    g[sand & (g == GRASS)] = SAND
    dirt = (base_d + fbm(rng, (QH, QW), (5, 2)) * 5 < 8) | (fbm(rng, (QH, QW), (7, 3)) > 0.22)
    g[dirt & (g == GRASS)] = DIRT
    # rocky outcrops, kept away from the base and the middle; lone thin bits are smoothed away
    ridge = (fbm(rng, (QH, QW), (9, 4)) > 0.2) | (np.abs(fbm(rng, (QH, QW), (16, 7))) < 0.05)
    ridge &= base_d > 11
    ridge &= np.hypot(xx - QW, yy - QH) > 14
    ridge = blur(ridge, 1, 1) > 0.5
    g[ridge & (g != WATER)] = ROCK
    return g


POOLS_Q = [(17, 6), (6, 18), (26, 15), (33, 27), (45, 21), (24, 30)]  # top-left corner of 2 x 2 pools


def clear_pool_spots(q):
    """pools and the base stand on open ground: rock and water around them become grass"""
    yy, xx = np.mgrid[0:QH, 0:QW]
    spots = [(px + 1, py + 1, 2.6) for px, py in POOLS_Q] + [(START[0] + 0.5, START[1] + 0.5, 5)]
    for cx, cy, r in spots:
        around = np.hypot(xx + 0.5 - cx, yy + 0.5 - cy) < r
        q[around & ((q == ROCK) | (q == WATER))] = GRASS


def connected(g, a, b):
    seen = np.zeros_like(g, bool)
    q = deque([a])
    seen[a[1], a[0]] = True
    while q:
        x, y = q.popleft()
        if (x, y) == b:
            return True
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and not seen[ny, nx] and g[ny, nx] in (GRASS, SAND, DIRT):
                seen[ny, nx] = True
                q.append((nx, ny))
    return False


def make_grid():
    for seed in range(1, 200):
        q = quadrant(seed)
        clear_pool_spots(q)
        g = mirror(q)
        sx, sy = START
        starts = [(sx, sy), (W - 1 - sx, sy), (sx, H - 1 - sy), (W - 1 - sx, H - 1 - sy)]
        if all(connected(g, starts[0], s) for s in starts[1:]):
            pools = []
            for px, py in POOLS_Q:
                for mx, my in ((px, py), (W - 2 - px, py), (px, H - 2 - py), (W - 2 - px, H - 2 - py)):
                    pools.append((mx, my))
            return g, starts, pools, seed
    raise RuntimeError('no connected map')


def up(mask):
    return np.repeat(np.repeat(mask.astype(np.float32), P, 0), P, 1)


def mix(a, b, k):
    k = np.clip(k, 0, 1)[..., None]
    return a * (1 - k) + b * k


def col(*rgb):
    return np.array(rgb, np.float32)


def texture(name, size, shape, shift=(0, 0)):
    """a ground texture from art/, made seamless, scaled to size px and repeated over the map"""
    t = np.asarray(Image.open(os.path.join(ROOT, 'art', f'ground_{name}.jpg')).convert('RGB').resize((size, size), Image.LANCZOS), np.float32)
    # blend with a copy shifted by half: the seams of one fall in the middle of the other
    ramp = 1 - np.abs(np.linspace(-1, 1, size, dtype=np.float32))
    wgt = np.minimum.outer(ramp, ramp)[..., None]
    t = t * wgt + np.roll(np.roll(t, size // 2, 0), size // 2, 1) * (1 - wgt)
    reps = (shape[0] // size + 2, shape[1] // size + 2, 1)
    big = np.tile(t, reps)
    return big[shift[1]:shift[1] + shape[0], shift[0]:shift[0] + shape[1]]


def paint(g, pools):
    rng = np.random.default_rng(5)
    k = P / 16  # sizes below were tuned for 16 px tiles
    shape = (H * P, W * P)
    n_big = fbm(rng, shape, (int(64 * k), int(28 * k)))
    n_mid = fbm(rng, shape, (int(14 * k), int(6 * k)))
    # soft but slightly ragged edges between ground types
    rag = fbm(rng, shape, (int(6 * k), int(3 * k))) * 0.35

    def area(kind, r=5):
        return np.clip(blur(up(g == kind), int(r * k)) + rag, 0, 1)

    water = area(WATER, 4)
    sand = area(SAND)
    dirt = area(DIRT)
    rock = area(ROCK, 6)

    # grass with patches of trampled grass and dirt; large soft light and dark areas hide the repeats
    grass_c = texture('grass', 22 * P, shape)
    grass_c = mix(grass_c, texture('grass_dirt', 22 * P, shape, (7 * P, 3 * P)), np.clip(n_big * 3 + 0.15, 0, 1) * 0.85)
    grass_c *= (1 + n_big[..., None] * 0.25)
    sand_c = texture('sand', 20 * P, shape, (5 * P, 9 * P)) * (1 + n_mid[..., None] * 0.12)
    dirt_c = texture('dirt', 16 * P, shape, (11 * P, 2 * P)) * (1 + n_big[..., None] * 0.2)
    # rock: the texture lit from the top left, so the ridges stand up from the ground
    rock_h = blur(up(g == ROCK), int(6 * k)) * 2 + fbm(rng, shape, (int(10 * k), int(4 * k), 2)) * 1.4
    d = int(2 * k)
    dx = np.roll(rock_h, -d, 1) - np.roll(rock_h, d, 1)
    dy = np.roll(rock_h, -d, 0) - np.roll(rock_h, d, 0)
    rock_shade = np.clip(1 - (dx + dy) * 0.7, 0.6, 1.35)
    rock_c = texture('rock', 14 * P, shape, (3 * P, 6 * P)) * rock_shade[..., None]

    img = grass_c
    img = mix(img, dirt_c, dirt)
    img = mix(img, sand_c, sand)
    # cliffs cast a shadow to the south-east, and have a dark foot
    off = int(10 * k)
    shadow = np.roll(np.roll(rock, off, 0), off, 1) * (1 - rock)
    img = img * (1 - shadow[..., None] * 0.4)
    rk = np.clip((rock - 0.4) * 3, 0, 1)
    foot = np.clip(1 - np.abs(rock - 0.45) / 0.12, 0, 1)
    img = mix(img, rock_c, rk)
    img = img * (1 - foot[..., None] * 0.35)

    # water: the texture, light and green at the shore, dark in the deep; surf on the shore
    depth = blur(up(g == WATER), int(10 * k), 4)
    water_c = texture('water', 22 * P, shape, (9 * P, 13 * P))
    shallow = np.clip(1 - (depth - 0.45) * 2.4, 0, 1)[..., None]
    water_c = water_c * (1 + shallow * 0.9) + shallow * col(10, 40, 30)
    wk = np.clip((water - 0.45) * 6, 0, 1)
    img = mix(img, water_c, wk)
    surf = np.clip(1 - np.abs(water - 0.5) / 0.06, 0, 1)
    img = mix(img, col(222, 236, 230), surf * 0.65)

    # resource pools: a crater with a glowing pool
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]].astype(np.float32)
    for px, py in pools:
        cx, cy = (px + 1) * P, (py + 1) * P
        sl = (slice(int(cy - 2 * P), int(cy + 2 * P)), slice(int(cx - 2 * P), int(cx + 2 * P)))
        dd = np.hypot(xx[sl] - cx, yy[sl] - cy) / P
        rim = np.clip(1 - np.abs(dd - 0.95) / 0.22, 0, 1)
        hole = np.clip((0.95 - dd) * 4, 0, 1)
        glow = np.clip((0.62 - dd) * 3, 0, 1)
        part = img[sl]
        part = part * (1 - np.clip(1 - np.abs(dd - 1.3) / 0.35, 0, 1)[..., None] * 0.3)
        part = mix(part, col(62, 56, 50), hole)
        part = mix(part, col(52, 200, 170), glow * 0.85)
        part = mix(part, col(230, 255, 240), np.clip((0.22 - dd) * 6, 0, 1) * 0.8)
        part = mix(part, col(150, 138, 116), rim * 0.75)
        img[sl] = part

    return np.clip(img, 0, 255).astype(np.uint8)


def write_luau(g, starts, pools):
    flat = g.flatten()
    out = bytearray()
    i = 0
    while i < len(flat):
        c = flat[i]
        j = i
        while j < len(flat) and flat[j] == c and j - i < 32:
            j += 1
        out.append((int(c) << 5) | (j - i - 1))
        i = j
    b64 = base64.b64encode(bytes(out)).decode()
    lines = [
        '-- Generated by tools/gen_battlemap.py. Do not edit by hand.',
        f'-- {W} x {H} tiles. Tiles: run-length encoded, base64, each byte = kind << 5 | (run length - 1);',
        '-- kinds: 0 water, 1 grass, 2 sand, 3 dirt, 4 rock. Pools: top-left tile of each 2 x 2 resource pool.',
        '-- chunks: columns and rows of the ground pictures map0, map1, ... (row by row).',
        'return {',
        f'\tW = {W},',
        f'\tH = {H},',
        f'\ttiles = "{b64}",',
        '\tstarts = { ' + ', '.join(f'{{ {x}, {y} }}' for x, y in starts) + ' },',
        '\tpools = { ' + ', '.join(f'{{ {x}, {y} }}' for x, y in pools) + ' },',
        f'\tchunks = {{ {CX}, {CY} }},',
        '}',
        '',
    ]
    open(os.path.join(ROOT, 'src', 'shared', 'MapData.luau'), 'w', encoding='utf-8').write('\n'.join(lines))


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    g, starts, pools, seed = make_grid()
    print('seed', seed, 'pools', len(pools))
    write_luau(g, starts, pools)
    img = paint(g, pools)
    Image.fromarray(img).save(os.path.join(out, 'map_full.png'))
    cw, ch = W * P // CX, H * P // CY
    for j in range(CY):
        for i in range(CX):
            Image.fromarray(img[j * ch:(j + 1) * ch, i * cw:(i + 1) * cw]).save(os.path.join(out, f'map_{j * CX + i}.png'))
    pal = np.array([[40, 96, 150], [86, 150, 52], [214, 190, 136], [132, 104, 72], [110, 104, 98]], np.uint8)
    Image.fromarray(pal[g]).resize((W * 6, H * 6), Image.NEAREST).save(os.path.join(out, 'grid.png'))
    print('chunks', CX * CY, 'size', cw, ch)


if __name__ == '__main__':
    main()
