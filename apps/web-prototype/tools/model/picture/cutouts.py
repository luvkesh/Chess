"""Cut every piece of a modelled set out of its reference picture, one RGBA png each, ready
for i2i.py:
  /opt/bv/bin/python tools/model/picture/cutouts.py <set> OUTDIR
Uses the set module's own boxes and Segment Anything points (source_refs() if the module has
one, else refs()), so the cut is the one the live model was built from. Writes
OUTDIR/<set>-<side>-<type>.png and OUTDIR/<set>-cutouts.jpg, a sheet to check them by eye:
a neighbour's arm, a missing staff or a chopped foot must be fixed in the set module's boxes
and points before any redrawing. It also prints HEIGHTS, each piece's size in game units, to
paste into the set module for hero.refs()."""
import importlib
import os
import sys

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, here)
import cv2  # noqa: E402
import numpy as np  # noqa: E402

sid, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
mod = importlib.import_module('sets.' + sid)
refs = (getattr(mod, 'source_refs', None) or mod.refs)()
tiles = []
for side in refs:
    row = []
    for t in 'kqbnrp':
        r = refs[side][t]
        ys, xs = np.nonzero(r.mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgba = np.dstack([r.crop[y0:y1, x0:x1], r.mask[y0:y1, x0:x1]])
        cv2.imwrite(os.path.join(out, '%s-%s-%s.png' % (sid, side, t)), rgba)
        h = 360
        w = max(1, int(rgba.shape[1] * h / rgba.shape[0]))
        im = cv2.resize(rgba, (w, h), interpolation=cv2.INTER_CUBIC)
        a = im[..., 3:].astype(np.float32) / 255
        tile = np.full((h, 300, 3), (150, 60, 110), np.float32)
        w = min(w, 300)
        x = (300 - w) // 2
        tile[:, x:x + w] = im[:, :w, :3] * a[:, :w] + tile[:, x:x + w] * (1 - a[:, :w])
        row.append(tile.astype(np.uint8))
        print(side, t, '%d x %d px' % (x1 - x0, y1 - y0))
    tiles.append(np.hstack(row))
cv2.imwrite(os.path.join(out, sid + '-cutouts.jpg'), np.vstack(tiles), [cv2.IMWRITE_JPEG_QUALITY, 88])
# the pieces' sizes in game units, to paste into the set module: hero pictures frame each piece
# alone, so the sizes have to be carried over by number
print('HEIGHTS = {')
for side in refs:
    print("    '%s': {%s}," % (side, ', '.join("'%s': %.3f" % (t, refs[side][t].height()) for t in 'kqbnrp')))
print('}')
