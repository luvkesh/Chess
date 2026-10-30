"""Convert the PNGs from tools/shoot.js into the WebP files in img/ (needs Pillow)."""
import pathlib

from PIL import Image

here = pathlib.Path(__file__).parent
img = here.parent / 'img'
for png in sorted((here / 'out').glob('*.png')):
    im = Image.open(png)
    if png.stem.startswith('set-'):
        im = im.crop((70, 50, 570, 480))                     # the pedestal, without the empty margins
        im.save(img / (png.stem + '.webp'), quality=82, method=6)
        continue
    im = im.convert('RGB')
    if png.stem.endswith('-game') or png.stem.endswith('-room'):
        im = im.resize((1040, 585), Image.LANCZOS)
    im.save(img / (png.stem + '.webp'), quality=68, method=6)
    print(png.stem)
