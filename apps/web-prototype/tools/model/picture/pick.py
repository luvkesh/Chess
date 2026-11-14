"""Put the chosen hero pictures in the repo, where the set module and every later step find them:
  python3 tools/model/picture/pick.py <set> w-k=PATH w-q=PATH ... b-p=PATH
Writes tools/model/pics/<set>/<side>-<type>.jpg (768 x 1024, quality 93). A hero picture is
the whole piece with its base, alone, upright, seen from the front (a knight may stand side
on), on a flat mid-grey backdrop with clear grey all round. Any Python with Pillow."""
import os
import sys

from PIL import Image

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sid = sys.argv[1]
out = os.path.join(here, 'pics', sid)
os.makedirs(out, exist_ok=True)
for a in sys.argv[2:]:
    key, path = a.split('=', 1)
    side, t = key.split('-')
    assert side in 'wb' and t in 'kqbnrp', key
    im = Image.open(path).convert('RGB')
    if im.size != (768, 1024):
        im = im.resize((768, 1024), Image.LANCZOS)
    im.save(os.path.join(out, '%s-%s.jpg' % (side, t)), quality=93)
    print(key, '<-', path)
missing = [s + '-' + t for s in 'wb' for t in 'kqbnrp' if not os.path.exists(os.path.join(out, '%s-%s.jpg' % (s, t)))]
print('still missing:', ' '.join(missing) if missing else 'none')
