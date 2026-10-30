"""Turn the PNGs from tools/shoot-art.js into the small WebP files in src/art/ (needs Pillow).
build.py inlines them as CHACKLATE_ART, so the game stays one file."""
import pathlib

from PIL import Image

here = pathlib.Path(__file__).parent
out = here / 'out'
dest = here.parent / 'src' / 'art'
dest.mkdir(exist_ok=True)

# The gold pieces for the medals: trimmed to the piece and 240 px tall, on transparency.
for t in 'kqrbnp':
    f = out / ('piece-%s.png' % t)
    if not f.exists():
        continue
    im = Image.open(f).convert('RGBA')
    im = im.crop(im.getbbox())
    im = im.resize((round(im.width * 240 / im.height), 240), Image.LANCZOS)
    im.save(dest / ('piece-%s.webp' % t), quality=84, method=6)

# Each era's painting, cropped wide around its landmark for the Journey banners and portholes.
for f in sorted(out.glob('view-*.png')):
    im = Image.open(f).convert('RGB')
    w, h = im.size
    cw, ch = round(w * 0.72), round(w * 0.36)
    box = ((w - cw) // 2, round(h * 0.2), (w - cw) // 2 + cw, round(h * 0.2) + ch)
    im.crop(box).resize((720, 360), Image.LANCZOS).save(dest / (f.stem + '.webp'), quality=76, method=6)

for f in sorted(dest.glob('*.webp')):
    print(f.name, f.stat().st_size)
