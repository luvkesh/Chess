"""Turn the Blender renders into the game's portrait pictures, and draw a before/after sheet.

    /opt/bv/bin/python tools/characters/render.py --out tools/characters/out horse lion ...
    python3 tools/characters/to-art.py [--sheet before-after.png]

Each render (tools/characters/out/<animal>.png, 800 px, transparent) becomes
src/art/avatar-<animal>.webp, which build.py inlines as CHACKLATE_ART.avatar and art.js frames as
the gold-bezel portrait in each friend's colours. The website (apps/website/tools/render-art.js)
reads the same files, so the game and the site always show the same faces.
"""
import argparse
import pathlib

from PIL import Image, ImageDraw

here = pathlib.Path(__file__).parent
art = here.parent.parent / 'src' / 'art'
SIZE = 480

ap = argparse.ArgumentParser()
ap.add_argument('--src', default=str(here / 'out'))
ap.add_argument('--sheet', default=None, help='also write a before/after sheet here (old pictures first)')
ap.add_argument('--size', type=int, default=SIZE)
a = ap.parse_args()

pairs = []
for f in sorted(pathlib.Path(a.src).glob('*.png')):
    dest = art / ('avatar-%s.webp' % f.stem)
    old = Image.open(dest).convert('RGBA') if dest.exists() else None
    im = Image.open(f).convert('RGBA').resize((a.size, a.size), Image.LANCZOS)
    im.save(dest, quality=82, method=6)
    pairs.append((f.stem, old, im))
    print(dest.name, dest.stat().st_size)

if a.sheet and pairs:
    cell, pad = 220, 14
    cols = 3
    rows = (len(pairs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (cell * 2 + pad * 3), rows * (cell + pad * 2)), (34, 24, 22))
    for i, (name, old, new) in enumerate(pairs):
        x0 = (i % cols) * (cell * 2 + pad * 3) + pad
        y0 = (i // cols) * (cell + pad * 2) + pad
        for j, im in enumerate((old, new)):
            if im is None:
                continue
            disc = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
            bg = Image.new('RGBA', (cell, cell), (92, 40, 46, 255) if j else (70, 60, 56, 255))
            m = Image.new('L', (cell, cell), 0)
            ImageDraw.Draw(m).ellipse((0, 0, cell - 1, cell - 1), fill=255)
            disc.paste(bg, (0, 0), m)
            pic = im.resize((cell, cell), Image.LANCZOS)
            pm = Image.new('L', (cell, cell), 0)
            pm.paste(pic.getchannel('A'), (0, 0), m)
            disc.paste(pic, (0, 0), pm)
            sheet.paste(disc, (x0 + j * (cell + pad), y0), disc)
    sheet.save(a.sheet)
    print('sheet', a.sheet)
