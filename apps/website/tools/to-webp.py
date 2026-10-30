"""Convert the PNGs from tools/shoot.js into the WebP files in img/ (needs Pillow)."""
import math
import pathlib

from PIL import Image, ImageDraw, ImageFilter

here = pathlib.Path(__file__).parent
img = here.parent / 'img'


def crest(knight):
    """The logo: the 3D knight on a round ruby disc with a soft shadow under it."""
    S = 512
    disc = Image.new('RGBA', (S, S))
    px = disc.load()
    for y in range(S):
        for x in range(S):
            t = min(1, math.hypot(x - S / 2, y - S * 0.40) / (S * 0.66)) ** 1.2
            px[x, y] = tuple(int(a + (b - a) * t) for a, b in zip((122, 26, 52), (34, 6, 16))) + (255,)
    k = knight.crop((217, 134, 773, 1096))
    k = k.resize((int(k.size[0] * 420 / k.size[1]), 420), Image.LANCZOS)
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((S / 2 - 130, 452, S / 2 + 130, 486), fill=(0, 0, 0, 150))
    disc.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)))
    disc.alpha_composite(k, ((S - k.size[0]) // 2 + 4, 52))
    mask = Image.new('L', (S * 4, S * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, S * 4 - 1, S * 4 - 1), fill=255)
    disc.putalpha(mask.resize((S, S), Image.LANCZOS))
    disc.save(img / 'crest.webp', quality=90, method=6)


for png in sorted((here / 'out').glob('*.png')):
    im = Image.open(png)
    if png.stem == 'knight':
        crest(im)
        print('crest')
        continue
    if png.stem.startswith('item-'):
        # Collect showroom thumbnails: small, the rest of each piece is on the live 3D stage
        im.resize((240, 180), Image.LANCZOS).save(img / (png.stem + '.webp'), quality=72, method=6)
        continue
    if png.stem.startswith('set-'):
        im = im.crop((70, 50, 570, 480))                     # the pedestal, without the empty margins
        im.save(img / (png.stem + '.webp'), quality=82, method=6)
        continue
    im = im.convert('RGB')
    im.save(img / (png.stem + '.webp'), quality=68, method=6)
    print(png.stem)
