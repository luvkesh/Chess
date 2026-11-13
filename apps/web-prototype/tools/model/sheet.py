"""Side-by-side sheet: reference cut-out | game render, per piece, for one set and side.
  /opt/bv/bin/python tools/model/sheet.py navy RENDERDIR OUT.jpg [w|b]"""
import importlib
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import cv2  # noqa: E402
import numpy as np  # noqa: E402

import kit  # noqa: E402

sid, rdir, out = sys.argv[1:4]
sides = sys.argv[4].split(',') if len(sys.argv) > 4 else ['w', 'b']
mod = importlib.import_module('sets.' + sid)
refs = mod.refs()
H = 420
BG = np.array([28, 24, 22], np.float32)


def on_bg(img, alpha):
    a = (alpha.astype(np.float32) / 255)[..., None]
    return (img.astype(np.float32) * a + BG * (1 - a)).astype(np.uint8)


def fit(img, h):
    ys, xs = np.nonzero(img.mean(2) > 0) if img.ndim == 3 else np.nonzero(img)
    return cv2.resize(img, (max(1, int(img.shape[1] * h / img.shape[0])), h), interpolation=cv2.INTER_AREA)


rows = []
for s in sides:
    cells = []
    for t in kit.TYPES:
        r = refs[s][t]
        ys, xs = np.nonzero(r.mask)
        c = on_bg(r.crop, r.mask)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        g = cv2.imread(os.path.join(rdir, '%s-%s-%s.png' % (sid, s, t)), cv2.IMREAD_UNCHANGED)
        if g is not None and g.shape[2] == 4:
            al = g[..., 3]
            g = on_bg(g[..., :3], al)
            ys, xs = np.nonzero(al > 8)
        else:
            g = np.zeros((10, 10, 3), np.uint8) if g is None else g[..., :3]
            ys, xs = np.nonzero(np.abs(g.astype(int) - g[0, 0]).sum(2) > 30)
        g = g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        a, b = fit(c, H), fit(g, H)
        pair = np.hstack([a, np.full((H, 6, 3), 60, np.uint8), b, np.full((H, 24, 3), 0, np.uint8)])
        cells.append(pair)
    row = np.hstack(cells)
    rows.append(row)
w = max(r.shape[1] for r in rows)
sheet = np.vstack([cv2.copyMakeBorder(r, 10, 10, 10, 10 + w - r.shape[1], cv2.BORDER_CONSTANT, value=0) for r in rows])
cv2.imwrite(out, sheet, [cv2.IMWRITE_JPEG_QUALITY, 88])
print(out, sheet.shape)
