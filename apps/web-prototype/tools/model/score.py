"""How closely the game's front render matches the reference cut-out, per piece:
silhouette IoU (shape) and mean colour difference (CIE76 delta-E over the shared pixels), and
the mean colour shift (render minus picture, in Lab) so a tint shows up as a number.
  /opt/bv/bin/python tools/model/score.py navy RENDERDIR [w,b]"""
import importlib
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import cv2  # noqa: E402
import numpy as np  # noqa: E402

import kit  # noqa: E402

sid, rdir = sys.argv[1:3]
sides = sys.argv[3].split(',') if len(sys.argv) > 3 else ['w', 'b']
refs = importlib.import_module('sets.' + sid).refs()


def tight(img, m):
    ys, xs = np.nonzero(m)
    return img[ys.min():ys.max() + 1, xs.min():xs.max() + 1], m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


tot = []
for s in sides:
    for t in kit.TYPES:
        g = cv2.imread(os.path.join(rdir, '%s-%s-%s.png' % (sid, s, t)), cv2.IMREAD_UNCHANGED)
        if g is None or t == 'n':
            continue   # knights are drawn side on, a different angle from the picture's
        r = refs[s][t]
        ri, rm = tight(r.crop, r.mask)
        gi, gm = tight(g[..., :3], g[..., 3] > 128)
        gi = cv2.resize(gi, (ri.shape[1], ri.shape[0]), interpolation=cv2.INTER_AREA)
        gm = cv2.resize(gm.astype(np.uint8), (ri.shape[1], ri.shape[0]), interpolation=cv2.INTER_NEAREST) > 0
        rm = rm > 0
        iou = (rm & gm).sum() / max(1, (rm | gm).sum())
        both = rm & gm
        la = cv2.cvtColor(ri, cv2.COLOR_BGR2LAB).astype(np.float32)
        lb = cv2.cvtColor(gi, cv2.COLOR_BGR2LAB).astype(np.float32)
        # blur both a little: a texture a pixel off should not count as a colour miss
        la, lb = cv2.GaussianBlur(la, (0, 0), 2), cv2.GaussianBlur(lb, (0, 0), 2)
        de = np.sqrt(((la - lb) ** 2).sum(2))[both].mean() * 100 / 255
        shift = (lb[both] - la[both]).mean(0) * np.array([100 / 255, 1, 1])
        tot.append((iou, de))
        print('%s %s  shape %.1f%%  colour dE %.1f  shift L%+.0f a%+.0f b%+.0f' % (s, t, iou * 100, de, *shift))
print('MEAN shape %.1f%%  colour dE %.1f' % (np.mean([x[0] for x in tot]) * 100, np.mean([x[1] for x in tot])))
