"""Before and after sheet for one set: the reference (hero) pictures, the live set and the
rebuild, piece by piece, then the low close board views one above the other.
  python3 tools/model/ba.py <set> LIVE_SHOTS NEW_SHOTS OUT.jpg
LIVE_SHOTS and NEW_SHOTS are shots.js folders (live: built from main before your change).
Rows: reference, live, new, for white then black. Any Python with Pillow.
Ship only when the new row is clearly better than the live row in every column AND in the low
board views; a piece that is worse in any view goes back for another pass."""
import os
import sys

from PIL import Image, ImageDraw

here = os.path.dirname(os.path.abspath(__file__))
sid, live, new, out = sys.argv[1:5]
W, H = 230, 307
BG = (236, 233, 228)


def tile(path):
    t = Image.new('RGB', (W, H), BG)
    if not os.path.exists(path):
        return t
    im = Image.open(path).convert('RGBA')
    bg = Image.new('RGBA', im.size, BG + (255,))
    bg.alpha_composite(im)
    im = bg.convert('RGB')
    im.thumbnail((W, H))
    t.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    return t


rows = []
for side in 'wb':
    for label, src in (('reference', None), ('live', live), ('new', new)):
        row = Image.new('RGB', (W * 6 + 90, H), BG)
        ImageDraw.Draw(row).text((6, H // 2), label, fill=(120, 40, 40))
        for i, t in enumerate('kqbnrp'):
            p = os.path.join(here, 'pics', sid, '%s-%s.jpg' % (side, t)) if src is None else os.path.join(src, '%s-%s.png' % (side, t))
            row.paste(tile(p), (90 + i * W, 0))
        rows.append(row)
width = rows[0].width
for src, label in ((live, 'live'), (new, 'new')):
    for side in ('black', 'white'):
        p = os.path.join(src, 'low-%s.png' % side)
        if os.path.exists(p):
            im = Image.open(p).convert('RGB')
            im = im.resize((width, im.height * width // im.width), Image.LANCZOS)
            ImageDraw.Draw(im).text((8, 8), '%s, low view from the %s side' % (label, side), fill=(255, 230, 160))
            rows.append(im)
sheet = Image.new('RGB', (width, sum(r.height for r in rows)), BG)
y = 0
for r in rows:
    sheet.paste(r, (0, y))
    y += r.height
sheet.save(out, quality=88)
print(out, sheet.size)
