"""Portraits straight from the person's reference character sheets (18 Nov 2026).

Each sheet (the 9 friends, Rooky, and the 9 era champions) carries a round portrait medallion.
This cuts the picture inside each medallion's gold ring and writes it as the game's portrait,
src/art/avatar-<animal>.webp, which art.js frames in the gold bezel and the website reads too.
So the faces in the game and on the site are the reference faces themselves, not a re-sculpt.

    python3 tools/characters/from-refs.py [--refs /mnt/project-files/characters-ref] [--sheet out.jpg]

The sheets are too heavy for the repository (about 45 MB); they live in the project files as
<animal>.png. MEDALLION gives each sheet's medallion centre and the radius just inside its ring.
"""
import argparse
import pathlib

from PIL import Image, ImageDraw, ImageFilter

here = pathlib.Path(__file__).parent
art = here.parent.parent / 'src' / 'art'

MEDALLION = {
    # the nine friends and Rooky (1161 x 1354 sheets)
    'bunny': (832, 932, 170), 'beaver': (828, 940, 170), 'squirrel': (824, 924, 168), 'tortoise': (828, 932, 170),
    'raccoon': (828, 932, 172), 'giraffe': (820, 936, 172), 'raven': (820, 920, 176), 'dragon': (824, 920, 176),
    'horse': (816, 924, 176),
    # the nine era champions (1536 x 1024 sheets)
    'cat': (1264, 608, 166), 'owl': (1264, 616, 192), 'wolf': (1258, 624, 180), 'elephant': (1268, 624, 194),
    'panda': (1264, 620, 194), 'lion': (1264, 624, 196), 'rooster': (1264, 624, 196), 'bear': (1260, 624, 196),
    'eagle': (1260, 624, 196),
}
SIZE = 480

ap = argparse.ArgumentParser()
ap.add_argument('--refs', default='/mnt/project-files/characters-ref')
ap.add_argument('--sheet', default=None, help='also write a before/after sheet here (old pictures first)')
a = ap.parse_args()

pairs = []
for name, (x, y, r) in MEDALLION.items():
    src = pathlib.Path(a.refs) / (name + '.png')
    dest = art / ('avatar-%s.webp' % name)
    old = Image.open(dest).convert('RGBA') if dest.exists() else None
    im = Image.open(src).convert('RGB').crop((x - r, y - r, x + r, y + r)).resize((SIZE, SIZE), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=45, threshold=2))
    im.save(dest, quality=88, method=6)
    pairs.append((name, old, im.convert('RGBA')))
    print(dest.name, dest.stat().st_size)

if a.sheet:
    cell, pad, cols = 220, 14, 3
    rows = (len(pairs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (cell * 2 + pad * 3), rows * (cell + pad * 2)), (34, 24, 22))
    m = Image.new('L', (cell, cell), 0)
    ImageDraw.Draw(m).ellipse((0, 0, cell - 1, cell - 1), fill=255)
    for i, (name, old, new) in enumerate(pairs):
        x0 = (i % cols) * (cell * 2 + pad * 3) + pad
        y0 = (i // cols) * (cell + pad * 2) + pad
        for j, im in enumerate((old, new)):
            if im is None:
                continue
            disc = Image.new('RGBA', (cell, cell), (70, 60, 56, 255))
            pic = im.resize((cell, cell), Image.LANCZOS)
            disc.paste(pic, (0, 0), pic)
            sheet.paste(disc, (x0 + j * (cell + pad), y0), m)
    sheet.save(a.sheet, quality=90)
    print('sheet', a.sheet)
