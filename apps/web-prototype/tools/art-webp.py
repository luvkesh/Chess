"""Make the small WebP files in src/art/ (needs Pillow): the medal pieces and 3D avatars from tools/shoot-art.js
and the era views from the website's era pictures.
build.py inlines them as CHACKLATE_ART, so the game stays one file."""
import pathlib

from PIL import Image

here = pathlib.Path(__file__).parent
out = here / 'out'
dest = here.parent / 'src' / 'art'
dest.mkdir(exist_ok=True)

# The gold pieces for the medals: trimmed to the piece and 360 px tall (sharp on 3x phones), on transparency.
for t in 'kqrbnp':
    f = out / ('piece-%s.png' % t)
    if not f.exists():
        continue
    im = Image.open(f).convert('RGBA')
    im = im.crop(im.getbbox())
    im = im.resize((round(im.width * 360 / im.height), 360), Image.LANCZOS)
    im.save(dest / ('piece-%s.webp' % t), quality=84, method=6)

# The 3D avatars: each animal's bust framed as a portrait, and the emblems, 400 px square on
# transparency (the medal around them is drawn by art.js, in each friend's own colours).
for f in sorted(out.glob('avatar-*.png')):
    im = Image.open(f).convert('RGBA').resize((400, 400), Image.LANCZOS)
    im.save(dest / (f.stem + '.webp'), quality=84, method=6)

# Each era's room and landmark for the Journey banners and portholes, cropped wide from the
# website's era pictures (apps/website/tools/shoot.js), which are rendered from the live table.
for f in sorted((here.parent.parent / 'website' / 'img').glob('*-hero.webp')):
    im = Image.open(f).convert('RGB')
    w, h = im.size
    cw = round(w * 0.75)
    box = ((w - cw) // 2, round(h * 0.02), (w - cw) // 2 + cw, round(h * 0.02) + cw // 2)
    im.crop(box).resize((600, 300), Image.LANCZOS).save(dest / ('view-' + f.stem[:-5] + '.webp'), quality=72, method=6)

for f in sorted(dest.glob('*.webp')):
    print(f.name, f.stat().st_size)
