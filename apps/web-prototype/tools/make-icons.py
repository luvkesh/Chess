"""Draws the app icons in public/: the Chackmate crest (the rendered gold knight on a plum disc,
src/crest.webp, the same picture as the website) in a gold ring on a dark tile. Needs Pillow."""
import pathlib
from PIL import Image, ImageDraw, ImageFilter

here = pathlib.Path(__file__).parent.parent
out = here / 'public'
CREST = Image.open(here / 'src' / 'crest.webp').convert('RGBA')
S = 4  # supersampling
# The website's ring: linear-gradient(145deg, #fff6d0 0%, #e9c27a 22%, #9a6a24 48%, #f3d38a 70%, #7a4a14 100%)
RING = [(0, (255, 246, 208)), (0.22, (233, 194, 122)), (0.48, (154, 106, 36)), (0.7, (243, 211, 138)), (1, (122, 74, 20))]


def ring_colour(t):
    for (a, ca), (b, cb) in zip(RING, RING[1:]):
        if t <= b:
            k = (t - a) / (b - a)
            return tuple(int(ca[i] + (cb[i] - ca[i]) * k) for i in range(3)) + (255,)
    return RING[-1][1] + (255,)


def disc(d):
    """The crest at diameter d: the gold ring with the picture inside, on a transparent square."""
    grad = Image.new('RGBA', (d, d))
    gp = grad.load()
    for y in range(d):
        for x in range(d):
            gp[x, y] = ring_colour(min(1, max(0, (x * 0.57 + y * 0.82) / (d * 1.39))))
    img = Image.new('RGBA', (d, d), (0, 0, 0, 0))
    mask = Image.new('L', (d, d), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, d - 1, d - 1], fill=255)
    img.paste(grad, (0, 0), mask)
    pad = round(d * 0.045)
    inner = d - 2 * pad
    pic = CREST.resize((inner, inner), Image.LANCZOS)
    pmask = Image.new('L', (inner, inner), 0)
    ImageDraw.Draw(pmask).ellipse([0, 0, inner - 1, inner - 1], fill=255)
    img.paste(pic, (pad, pad), pmask)
    return img


def tile(size, maskable):
    n = size * S
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    # Dark chocolate tile with a faint plum glow behind the crest.
    bg = Image.new('RGBA', (n, n))
    px = bg.load()
    for y in range(n):
        for x in range(n):
            d = min(1.0, (((x - n / 2) ** 2 + (y - n * 0.45) ** 2) ** 0.5) / (n * 0.75))
            a, b = (74, 22, 40), (18, 10, 8)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * (d ** 0.7)) for i in range(3)) + (255,)
    mask = Image.new('L', (n, n), 0)
    r = 0 if maskable else int(n * 0.22)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, n - 1, n - 1], radius=r, fill=255)
    img.paste(bg, (0, 0), mask)
    # maskable icons keep the crest inside the 80% safe zone
    d = int(n * (0.7 if maskable else 0.86))
    o = (n - d) // 2
    shadow = Image.new('L', (n, n), 0)
    ImageDraw.Draw(shadow).ellipse([o, o + n * 0.02, o + d, o + d + n * 0.02], fill=170)
    shadow = shadow.filter(ImageFilter.GaussianBlur(n * 0.025))
    img.paste(Image.new('RGBA', (n, n), (0, 0, 0, 255)), (0, 0), Image.composite(shadow, Image.new('L', (n, n), 0), mask))
    c = disc(d)
    img.paste(c, (o, o), c)
    return img.resize((size, size), Image.LANCZOS)


for name, size, maskable in [('icon-192.png', 192, False), ('icon-512.png', 512, False), ('icon-maskable-512.png', 512, True), ('apple-touch-icon.png', 180, True)]:
    tile(size, maskable).save(out / name, optimize=True)
    print(name)
