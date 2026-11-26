"""Shared by the royal1 and jewel1 set modules (regency, staunton, tsarina, falcon, crystal,
celestial, peacock).

The hero pictures are studio shots: lit from one side, shaded towards the outline, with glints.
A turned piece is painted from the picture's right half, mirrored and repeated round the axis,
so that shading would show as grey stripes and stains on the body. even() makes each picture
evenly lit before it is painted: every material (body, gold) is brought to one level, keeping
only the fine detail (carving, engraving, grain) as a ratio to its surroundings. The game's own
lights then shade the true shape."""
import os

import cv2
import numpy as np

import hero
import kit

OUT = os.path.join(os.environ.get('COMPOSE_DIR', '/tmp/claude-0/compose'), 'even')


def even(path, out, body=None, gold=None, detail=0.9, sigma=0.04, lo=0.55, hi=1.3, chroma=0.6, cls=None, keep=0.0):
    """path: a hero picture; out: where the evenly lit copy goes.
    body, gold: the level (0..1, brightest channel) each material is brought to; None keeps the
    material's own lit level. detail: how much of the fine detail's contrast stays (0..1).
    sigma: size of what counts as lighting, as a fraction of the piece's height. keep: share of
    the picture's own shading left in (0 = flat)."""
    img, m, path = hero.cutout(path)
    f = img.astype(np.float32) / 255
    inside = m > 0
    lum = f.max(2)
    gw = kit.gold_weight(img, **(cls or {})) * inside
    gem = (kit.classify(img, **(cls or {})) == 2) & inside
    gw[gem] = 0
    h = float(np.ptp(np.nonzero(inside)[0]))
    s = max(4.0, sigma * h)
    res = f.copy()
    for w, level in (((1 - gw) * inside * (~gem), body), (gw, gold)):
        w = w.astype(np.float32)
        sel = w > 0.5
        if sel.sum() < 200:
            continue
        shade = cv2.GaussianBlur(lum * w, (0, 0), s) / np.maximum(cv2.GaussianBlur(w, (0, 0), s), 1e-4)
        ratio = np.clip(lum / np.maximum(shade, 1e-3), lo, hi) ** detail
        lit = float(np.percentile(lum[sel], 80)) if level is None else level
        new_l = lit * ratio
        if keep:
            new_l = new_l * (1 - keep) + lum * keep
        # colour as a ratio to the level, pulled towards the material's lit colour (shadows on
        # ivory are browner, on black lacquer they pick up the room)
        c = f / np.maximum(lum[..., None], 1e-3)
        bright = sel & (lum >= np.percentile(lum[sel], 55))
        c_ref = np.median(c[bright], 0)
        c = c * (1 - chroma) + c_ref * chroma
        new = np.clip(c * new_l[..., None], 0, 1)
        res = res * (1 - w[..., None]) + new * w[..., None]
    soft = cv2.GaussianBlur(m, (0, 0), 0.8).astype(np.float32)[..., None] / 255
    res = res * soft + (128 / 255) * (1 - soft)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    cv2.imwrite(out, (res * 255).clip(0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 96])
    return out


def pics(sid, opts):
    """hero.pics(sid) with every picture evenly lit. opts: {side: kwargs for even()}; a side's
    kwargs may hold per-type overrides under the type's letter."""
    out = {}
    for side, d in hero.pics(sid).items():
        out[side] = {}
        for t, path in d.items():
            kw = dict(opts.get(side, {}))
            over = {k: kw.pop(k) for k in list(kw) if k in 'kqbnrp' and len(k) == 1}
            kw.update(over.get(t, {}))
            out[side][t] = even(path, os.path.join(OUT, sid, '%s-%s.jpg' % (side, t)), **kw)
    return out
