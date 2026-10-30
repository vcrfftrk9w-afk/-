import json, math, sys, base64
import numpy as np
from PIL import Image, ImageDraw

D = sys.argv[1]
W = 720
LAT_N, LAT_S = 80.0, -56.0
SS = 3

def miller(lat):
    p = math.radians(lat)
    return 1.25 * math.log(math.tan(math.pi / 4 + 0.4 * p))

YN, YS = miller(LAT_N), miller(LAT_S)
H = int(round(W / (2 * math.pi) * (YN - YS)))
print('size', W, H)

def proj(lon, lat):
    lat = max(min(lat, 85), -85)
    x = (lon + 180) / 360 * W
    y = (YN - miller(lat)) / (YN - YS) * H
    return x * SS, y * SS

def rings(geom):
    if geom['type'] == 'Polygon':
        yield geom['coordinates']
    elif geom['type'] == 'MultiPolygon':
        for p in geom['coordinates']:
            yield p

def raster(fname, filt=None):
    img = Image.new('L', (W * SS, H * SS), 0)
    dr = ImageDraw.Draw(img)
    for f in json.load(open(f'{D}/{fname}.geojson'))['features']:
        if filt and not filt(f['properties']):
            continue
        for poly in rings(f['geometry']):
            outer = [proj(*c[:2]) for c in poly[0]]
            if len(outer) > 2:
                dr.polygon(outer, fill=255)
            for hole in poly[1:]:
                h = [proj(*c[:2]) for c in hole]
                if len(h) > 2:
                    dr.polygon(h, fill=0)
    a = np.asarray(img, dtype=np.float32) / 255
    return a.reshape(H, SS, W, SS).mean(axis=(1, 3))

land = raster('ne_50m_land') > 0.34
lakes = raster('ne_50m_lakes') > 0.5
land &= ~lakes
ice = raster('ne_50m_glaciated_areas') > 0.5
cla = lambda *names: (lambda p: p.get('FEATURECLA') in names)
desert = raster('ne_50m_geography_regions_polys', cla('Desert')) > 0.5
mtn = raster('ne_50m_geography_regions_polys', lambda p: p.get('FEATURECLA') == 'Range/mtn' and p.get('SCALERANK', 9) <= 3) > 0.5
tundra = raster('ne_50m_geography_regions_polys', cla('Tundra')) > 0.5
aus = raster('ne_50m_geography_regions_polys', lambda p: p.get('NAME') in ('WESTERN PLATEAU',)) > 0.5

# codes: 0 water, 1 grass, 2 desert, 3 mountain, 4 snow, 5 tundra
lat_of_row = np.array([0.0] * H)
for r in range(H):
    yv = YN - (r + 0.5) / H * (YN - YS)
    lat_of_row[r] = math.degrees(2.5 * math.atan(math.exp(yv / 1.25)) - 0.625 * math.pi)
LAT = np.repeat(lat_of_row[:, None], W, axis=1)

rng = np.random.default_rng(7)
def smooth_noise(scale):
    small = rng.random((H // scale + 2, W // scale + 2)).astype(np.float32)
    im = Image.fromarray((small * 255).astype(np.uint8)).resize((W + scale * 2, H + scale * 2), Image.BICUBIC)
    return np.asarray(im, np.float32)[:H, :W] / 255 - 0.5
N1 = smooth_noise(12) * 9 + smooth_noise(4) * 3
LON = np.repeat(((np.arange(W) + 0.5) / W * 360 - 180)[None, :], H, axis=0)
arabia = (LON > 35) & (LON < 58) & (LAT > 14) & (LAT < 31)
g = np.zeros((H, W), np.uint8)
g[land] = 1
g[land & (LAT + N1 > 62)] = 5
g[land & arabia & (smooth_noise(6) > -0.25)] = 2
g[land & tundra] = 5
g[land & (desert | aus)] = 2
g[land & mtn] = 3
g[land & ((LAT + N1 > 72) | ice)] = 4
print('lat rows', lat_of_row[0], lat_of_row[-1])

# RLE: byte = code<<5 | (len-1), len<=32
out = bytearray()
flat = g.flatten()
i = 0
n = len(flat)
while i < n:
    c = flat[i]
    j = i
    while j < n and flat[j] == c and j - i < 32:
        j += 1
    out.append((int(c) << 5) | (j - i - 1))
    i = j
b64 = base64.b64encode(bytes(out)).decode()
print('rle bytes', len(out), 'b64', len(b64))
open(f'{D}/map.b64', 'w').write(b64)
json.dump({'W': W, 'H': H, 'latN': LAT_N, 'latS': LAT_S}, open(f'{D}/map.json', 'w'))

pal = np.array([[46, 104, 156], [160, 196, 110], [232, 210, 150], [170, 150, 120], [240, 244, 246], [200, 212, 190]], np.uint8)
Image.fromarray(pal[g]).resize((W * 2, H * 2), Image.NEAREST).save(f'{D}/preview.png')
