"""Puts the painted pictures from art/ into the sprite atlases made by tools/gen_sprites.js.
Each picture is drawn from above on a white background, with the team-coloured parts in bright
blue. This cuts the background away, moves the blue parts into the grey team layer (tinted in
game), fits the picture into its cell and adds a soft shadow. Sprites whose picture already
has its gun drawn in are removed from SpriteData.
Usage: python3 tools/import_art.py ATLAS_DIR   (the folder gen_sprites.js wrote to)
"""
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'art')
SPRITE_DATA = os.path.join(ROOT, 'src', 'shared', 'SpriteData.luau')

# cell name -> picture and how to fit it:
#   fit    = share of the cell the picture's longer side takes
#   spin   = the sprite turns around the centre of its body (turrets): it must fit in a circle
#   shadow = (dx, dy) shadow offset as a share of the cell; units get a soft one all around
SPRITES = {
    'tank': {'file': 'tank_hull', 'fit': 0.94},
    'tank_gun': {'file': 'tank_turret', 'spin': True, 'body_of': 'tank', 'body_share': 0.75},
    'scout': {'file': 'scout', 'fit': 0.94},
    'artillery': {'file': 'artillery', 'fit': 0.96},
    'infantry': {'file': 'infantry', 'fit': 0.94},
    'cc': {'file': 'command_center', 'fit': 0.97, 'shadow': (0.03, 0.04)},
    'air': {'file': 'airfield', 'fit': 0.97, 'shadow': (0.03, 0.04)},
    'extractor': {'file': 'extractor', 'fit': 0.97, 'shadow': (0.03, 0.04)},
    'tower': {'file': 'tower', 'spin': True},
    'aa': {'file': 'aa', 'spin': True},
}
# these pictures have their guns drawn in, so the separate gun sprites go away
DROP = ['scout_gun', 'artillery_gun', 'tower_gun', 'aa_gun']


def box_blur(a, r):
    """box blur of a 2D array, radius r, edges clamped"""
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis)
        n = a.shape[axis]
        a = (np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, np.arange(n), axis=axis)) / (2 * r + 1)
    return a


def background(rgb):
    """near-white pixels connected to the picture's border"""
    lo = rgb.min(axis=2)
    spread = rgb.max(axis=2) - lo
    cand = ((lo > 222) & (spread < 30)).astype(np.uint8) * 255
    im = Image.fromarray(cand, 'L').copy()  # fromarray shares read-only memory; fills need a copy
    h, w = cand.shape
    border = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    for p in border:
        if im.getpixel(p) == 255:
            ImageDraw.floodfill(im, p, 128)
    # white areas closed in by walls (yards) are background too; small white highlights are not
    for _ in range(300):
        left = np.asarray(im) == 255
        if not left.any():
            break
        y, x = np.unravel_index(np.argmax(left), left.shape)
        ImageDraw.floodfill(im, (int(x), int(y)), 100)
        region = np.asarray(im) == 100
        ImageDraw.floodfill(im, (int(x), int(y)), 128 if region.sum() > h * w * 0.002 else 50)
    return np.asarray(im) == 128


def cut(path):
    """RGBA of the object (premultiplied later) and the team weight per pixel"""
    rgb = np.asarray(Image.open(path).convert('RGB'), np.float32)
    bg = background(rgb)
    alpha = (~bg).astype(np.float32)
    # pixels right next to the background are a blend of the outline and white: unblend them
    near = bg.copy()
    for _ in range(2):
        near = near | np.roll(near, 1, 0) | np.roll(near, -1, 0) | np.roll(near, 1, 1) | np.roll(near, -1, 1)
    edge = near & ~bg
    soft = np.clip((255 - rgb.min(axis=2)) / 70, 0, 1)
    alpha[edge] = soft[edge]
    a = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.where(edge[..., None], np.clip((rgb - (1 - a) * 255) / a, 0, 255), rgb)
    # bright blue marks the team colour
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    team = np.clip((b - np.maximum(r, g) - 30) / 50, 0, 1) * alpha
    return rgb, alpha, team


def body_box(alpha):
    """bounding box of the wide part of the object: a turret without its barrels"""
    rows = (alpha > 0.5).sum(axis=1)
    cols = (alpha > 0.5).sum(axis=0)
    wide_rows = np.nonzero(rows > rows.max() * 0.45)[0]
    wide_cols = np.nonzero(cols > cols.max() * 0.45)[0]
    return wide_cols[0], wide_rows[0], wide_cols[-1] + 1, wide_rows[-1] + 1


def full_box(alpha):
    ys, xs = np.nonzero(alpha > 0.05)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def layers(rgb, alpha, team):
    """base layer (team parts greyed, under the team layer) and team layer (grey brightness)"""
    lum = rgb @ np.array([0.3, 0.59, 0.11], np.float32)
    w = np.where(alpha > 0, team / np.maximum(alpha, 1e-3), 0)[..., None]
    base_rgb = rgb * (1 - w) + lum[..., None] * w
    base = np.dstack([base_rgb, alpha * 255])
    shade = np.clip(rgb[..., 2] * 0.94, 0, 255)
    team_img = np.dstack([shade, shade, shade, team * 255])
    return base, team_img


def place(img, cell, scale, cx, cy):
    """scales an RGBA float picture by scale and puts point (cx, cy) of it at the cell centre"""
    h, w = img.shape[:2]
    pil = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGBA').convert('RGBa')
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    small = pil.resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBa', (cell, cell), (0, 0, 0, 0))
    out.paste(small, (round(cell / 2 - cx * scale), round(cell / 2 - cy * scale)))
    return np.asarray(out.convert('RGBA'), np.float32)


def with_shadow(base, cell, offset):
    a = base[..., 3] / 255
    if offset:
        dx, dy = round(offset[0] * cell), round(offset[1] * cell)
        sh = np.roll(np.roll(box_blur(a, max(1, cell // 64)), dy, 0), dx, 1) * 0.5
    else:
        sh = box_blur(box_blur(a, max(1, cell // 40)), max(1, cell // 40)) * 0.45
    # a black shadow under the picture: colour is the picture's, darkened where only shadow shows
    out = base.copy()
    sa = sh * (1 - a)
    out[..., 3] = (a + sa) * 255
    out[..., :3] = base[..., :3] * (a / np.maximum(a + sa, 1e-3))[..., None]
    return out


def main():
    out_dir = sys.argv[1]
    atlas_base = np.asarray(Image.open(os.path.join(out_dir, 'atlas_base.png')).convert('RGBA'), np.float32).copy()
    atlas_team = np.asarray(Image.open(os.path.join(out_dir, 'atlas_team.png')).convert('RGBA'), np.float32).copy()
    src = open(SPRITE_DATA, encoding='utf-8').read()
    cells = {m[0]: (int(m[1]), int(m[2]), int(m[3])) for m in re.findall(r'\t(\w+) = \{ (\d+), (\d+), (\d+) \}', src)}

    fitted = {}  # name -> on-cell width of the body, for turrets that sit on a hull
    for name, spec in SPRITES.items():
        x0, y0, cell = cells[name]
        rgb, alpha, team = cut(os.path.join(ART, spec['file'] + '.jpg'))
        base, team_img = layers(rgb, alpha, team)
        if spec.get('spin'):
            bx0, by0, bx1, by1 = body_box(alpha)
            cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
            ys, xs = np.nonzero(alpha > 0.05)
            reach = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2).max()
            scale = 0.47 * cell / reach
            if 'body_of' in spec:
                scale = min(scale, fitted[spec['body_of']] * spec['body_share'] / (bx1 - bx0))
        else:
            fx0, fy0, fx1, fy1 = full_box(alpha)
            cx, cy = (fx0 + fx1) / 2, (fy0 + fy1) / 2
            scale = spec['fit'] * cell / max(fx1 - fx0, fy1 - fy0)
            fitted[name] = (fx1 - fx0) * scale
        b = place(base, cell, scale, cx, cy)
        t = place(team_img, cell, scale, cx, cy)
        b = with_shadow(b, cell, spec.get('shadow'))
        atlas_base[y0:y0 + cell, x0:x0 + cell] = b
        atlas_team[y0:y0 + cell, x0:x0 + cell] = t
        print(name, spec['file'], f'scale {scale:.3f}')

    for name in DROP:
        x0, y0, cell = cells[name]
        atlas_base[y0:y0 + cell, x0:x0 + cell] = 0
        atlas_team[y0:y0 + cell, x0:x0 + cell] = 0
        src = re.sub(rf'\t{name} = \{{[^}}]*\}},\n', '', src)
    open(SPRITE_DATA, 'w', encoding='utf-8').write(src.replace(
        '-- Generated by tools/gen_sprites.js.', '-- Generated by tools/gen_sprites.js and tools/import_art.py.'))
    Image.fromarray(atlas_base.astype(np.uint8), 'RGBA').save(os.path.join(out_dir, 'atlas_base.png'))
    Image.fromarray(atlas_team.astype(np.uint8), 'RGBA').save(os.path.join(out_dir, 'atlas_team.png'))

    # preview: team parts tinted green, on grass
    prev = np.zeros_like(atlas_base[..., :3]) + np.array([94, 154, 60], np.float32)
    for layer, tint in ((atlas_base, (1, 1, 1)), (atlas_team, (0.25, 0.71, 0.31))):
        a = layer[..., 3:] / 255
        prev = prev * (1 - a) + layer[..., :3] * np.array(tint, np.float32) * a
    Image.fromarray(prev.astype(np.uint8)).save(os.path.join(out_dir, 'atlas_preview.png'))


if __name__ == '__main__':
    main()
