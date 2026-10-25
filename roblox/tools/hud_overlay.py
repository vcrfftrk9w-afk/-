"""Накладывает интерфейс клиента «Фронт» на рендер карты (раскладка как в FrontClient).

    python3 tools/hud_overlay.py state.json raw.png labels.json out.png
"""
import json
import sys

from PIL import Image, ImageDraw, ImageFont

STATE, RAW, LABELS, OUT = sys.argv[1:5]
st = json.load(open(STATE))
labels = json.load(open(LABELS))
img = Image.open(RAW).convert("RGBA")
Wpx, Hpx = img.size
K = 1.8                     # пикселей на единицу интерфейса (телефон 2x, UIScale 0.9)
INSET = 36                  # верхняя панель Roblox
SW, SH = Wpx / K, Hpx / K   # размер экрана в единицах интерфейса

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_fonts = {}


def font(size, bold=False):
    key = (size, bold)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(BOLD if bold else FONT, int(size * K * 0.92))
    return _fonts[key]


PANEL = (18, 22, 28, 217)
PANEL2 = (30, 36, 44, 255)
INK = (236, 238, 240, 255)
DIM = (150, 158, 168, 255)
ACCENT = (255, 176, 46, 255)
BAD = (235, 87, 70, 255)
TROOPS = (90, 160, 240, 255)

layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
d = ImageDraw.Draw(layer)


def P(x, y):
    return (x * K, (y + INSET) * K)


def rect(x, y, w, h, fill, r=8):
    d.rounded_rectangle([P(x, y), P(x + w, y + h)], radius=r * K, fill=fill)


def text(x, y, s, size=14, bold=False, fill=INK, anchor="la"):
    d.text(P(x, y), s, font=font(size, bold), fill=fill, anchor=anchor)


def fmt(n):
    if n >= 1e6:
        return f"{n / 1e6:.1f}M"
    if n >= 1e4:
        return f"{n / 1e3:.0f}k"
    if n >= 1e3:
        return f"{n / 1e3:.1f}k"
    return str(int(n))


snap, me = st["snap"], st["me"]
land = snap["land"]

# кнопки меню Roblox (обычный круглый значок в углу)
d.rounded_rectangle([(12 * K, 6 * K), (44 * K, 34 * K)], radius=10 * K, fill=(0, 0, 0, 120))
for k in range(3):
    y = (14 + k * 6) * K
    d.line([(20 * K, y), (36 * K, y)], fill=(255, 255, 255, 230), width=int(2 * K))

# подписи уровней построек
for lab in labels:
    x, y = lab["x"], lab["y"]
    w = 40 * K
    d.rectangle([x - w / 2, y - 9 * K, x + w / 2, y + 9 * K], fill=(20, 22, 26, 178))
    d.text((x, y), lab["text"], font=font(12, True), fill=INK, anchor="mm")

# статистика
rect(10, 8, 230, 92, PANEL, 10)
att = f" · в атаке {fmt(me['attacking'])}" if me["attacking"] > 0 else ""
text(20, 9, f"Войска {fmt(me['troops'])} / {fmt(me['max'])}{att}", 14)
rect(20, 33, 210, 8, PANEL2, 4)
rect(20, 33, 210 * min(1, me["troops"] / max(1, me["max"])), 8, TROOPS, 4)
text(20, 45, f"Золото {fmt(me['gold'])}", 14, fill=ACCENT)
text(20, 67, f"Земля {me['tiles']} клеток · {me['tiles'] / land * 100:.1f}% суши", 13, fill=DIM)

# фаза
rect(SW / 2 - 160, 8, 320, 30, PANEL, 10)
timer = snap["timer"]
text(SW / 2, 23, f"До конца матча {timer // 60}:{timer % 60:02d}", 16, True, anchor="mm")

# уведомления
names = {n["id"]: n["name"] for n in snap["nations"]}
alive = sorted([n for n in snap["nations"] if n["alive"] and n["tiles"] > 0], key=lambda n: -n["tiles"])
enemy = next(n for n in alive if n["id"] != me["id"] and n["id"] not in me["allies"])
toasts = [
    (f"{enemy['name']} напала на тебя", INK),
    (f"{alive[0]['name']} и {alive[4]['name']} заключили союз", INK),
    ("Порт ставится на берегу моря", BAD),
]
y = 108
for s, col in toasts:
    w = d.textlength(s, font=font(13)) / K + 16
    rect(10, y, w, 22, (18, 22, 28, 190), 6)
    text(18, y + 3, s, 13, fill=col)
    y += 26

# таблица стран
rows = []
allies = set(me["allies"])
for k, n in enumerate(alive, start=1):
    if k <= 7 or n["id"] == me["id"] or n["id"] in allies:
        rows.append((k, n))
bx, bw = SW - 260, 250
bh = 12 + 18 + 2 + len(rows) * 26
rect(bx, 8, bw, bh, PANEL, 10)
text(bx + 8, 12, f"Страны · живых {len(alive)} · победа 80% суши", 12, True, DIM)
ry = 8 + 6 + 20
for k, n in rows:
    c = tuple(n["color"]) + (255,)
    rect(bx + 8, ry + 7, 10, 10, c, 3)
    isme = n["id"] == me["id"]
    nm = f"{k}. {'★ ' if n['id'] in allies else ''}{n['name']}"
    text(bx + 24, ry + 4, nm, 13, isme, ACCENT if isme else INK)
    text(bx + bw - 8 - 54, ry + 5, f"{n['tiles'] / land * 100:.0f}%", 12, fill=DIM, anchor="ra")
    if not isme:
        ally = n["id"] in allies
        rect(bx + bw - 8 - 46, ry + 2, 46, 20, (110, 40, 36, 255) if ally else PANEL2, 8)
        text(bx + bw - 8 - 23, ry + 12, "Рвать" if ally else "Союз", 11, True, anchor="mm")
    ry += 26
rect(SW - 330, 10, 60, 26, PANEL2, 8)
text(SW - 300, 23, "Топ", 13, True, anchor="mm")

# доля войск
by = SH - INSET - 62
rect(10, by, 270, 52, PANEL, 10)
text(20, by + 2, "Войск в атаку", 11, fill=DIM)
for k, r in enumerate([20, 40, 60, 80, 100]):
    on = abs(r / 100 - me["ratio"]) < 0.01
    rect(20 + k * 51, by + 19, 46, 28, (60, 100, 160, 255) if on else PANEL2, 8)
    text(43 + k * 51, by + 33, f"{r}%", 13, True, anchor="mm")

# режимы и постройки
modes = [("attack", "Атака"), ("City", "Город"), ("Port", "Порт"), ("Defense", "Турель"),
         ("Factory", "Завод"), ("Silo", "Шахта"), ("Nuke", "Ракета"), ("ally", "Союз")]
x = SW - 10 - len(modes) * 74 - (len(modes) - 1) * 6
yb = SH - INSET - 66
for mid, name in modes:
    active = mid == "attack"
    rect(x, yb, 74, 54, (160, 100, 20, 255) if active else PANEL2, 8)
    text(x + 37, yb + 18, name, 14, True, anchor="mm")
    price = me["costs"].get(mid)
    if price is not None:
        p, col = fmt(price), ACCENT if me["gold"] >= price else BAD
    else:
        p, col = ("по тапу" if mid == "attack" else "по стране"), ACCENT
    text(x + 37, yb + 38, p, 11 if price is None else 12, fill=col, anchor="mm")
    x += 80

Image.alpha_composite(img, layer).convert("RGB").save(OUT, quality=92)
print("saved", OUT)
