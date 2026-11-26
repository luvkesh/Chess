"""masters/*.png -> ../../src/art/ui-<name>.webp, and the era scenes -> ../../src/art/era-<id>.webp.

    python3 to-webp.py [folder of the era friends' reference sheets]"""
import os, sys, json
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
art = os.path.join(here, '..', '..', 'src', 'art')
sys.path.insert(0, here)
from crops import ERA_SCENE
for f in sorted(os.listdir(os.path.join(here, 'masters'))):
    if not f.endswith('.png'): continue
    im = Image.open(os.path.join(here, 'masters', f))
    big = 440 if f.startswith('banner-') else 300 if f.startswith('var-') else 240
    im.thumbnail((big, big), Image.LANCZOS)
    im.save(os.path.join(art, 'ui-' + f[:-4] + '.webp'), quality=80, method=6)
if len(sys.argv) > 1:
    eras = json.load(open(os.path.join(here, '..', '..', '..', '..', 'packages', 'content', 'campaign.json')))['eras']
    for e in eras:
        im = Image.open(os.path.join(sys.argv[1], e['coach']['animal'] + '.png')).convert('RGB').crop(ERA_SCENE)
        im.thumbnail((360, 360), Image.LANCZOS)
        im.save(os.path.join(art, 'era-' + e['id'] + '.webp'), quality=74, method=6)
