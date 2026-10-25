"""Draws the app icons in public/: a gold knight on a cocoa-and-ruby tile. Needs Pillow and FreeSerif."""
import pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageFont

out = pathlib.Path(__file__).parent.parent / 'public'
FONT = '/usr/share/fonts/truetype/freefont/FreeSerif.ttf'
S = 4  # supersampling


def tile(size, maskable):
    n = size * S
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    # Radial background: ruby glow top-left into dark chocolate.
    bg = Image.new('RGBA', (n, n))
    px = bg.load()
    for y in range(n):
        for x in range(n):
            d = min(1.0, (((x - n * 0.3) ** 2 + (y - n * 0.25) ** 2) ** 0.5) / (n * 0.95))
            a, b = (163, 41, 79), (30, 14, 10)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * (d ** 0.8)) for i in range(3)) + (255,)
    mask = Image.new('L', (n, n), 0)
    r = 0 if maskable else int(n * 0.22)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, n - 1, n - 1], radius=r, fill=255)
    img.paste(bg, (0, 0), mask)
    # Gold knight with a soft shadow; maskable icons keep it inside the 80% safe zone.
    scale = 0.66 if maskable else 0.88
    font = ImageFont.truetype(FONT, int(n * scale))
    glyph = '♞'
    box = font.getbbox(glyph)
    w, h = box[2] - box[0], box[3] - box[1]
    ox, oy = (n - w) / 2 - box[0], (n - h) / 2 - box[1] + n * 0.01
    shadow = Image.new('L', (n, n), 0)
    ImageDraw.Draw(shadow).text((ox + n * 0.015, oy + n * 0.03), glyph, font=font, fill=150)
    shadow = shadow.filter(ImageFilter.GaussianBlur(n * 0.02))
    img.paste(Image.new('RGBA', (n, n), (0, 0, 0, 255)), (0, 0), Image.composite(shadow, Image.new('L', (n, n), 0), mask))
    gmask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(gmask).text((ox, oy), glyph, font=font, fill=255)
    gold = Image.new('RGBA', (n, n))
    gp = gold.load()
    for y in range(n):
        t = y / n
        c = (int(255 - 40 * t), int(226 - 70 * t), int(154 - 80 * t))
        for x in range(n):
            gp[x, y] = c + (255,)
    img.paste(gold, (0, 0), gmask)
    return img.resize((size, size), Image.LANCZOS)


for name, size, maskable in [('icon-192.png', 192, False), ('icon-512.png', 512, False), ('icon-maskable-512.png', 512, True), ('apple-touch-icon.png', 180, True)]:
    tile(size, maskable).save(out / name, optimize=True)
    print(name)
