"""What the four classic1 sets (navy, sapphire, fantasy, opulent) share.

Their hero pictures are studio photographs, lit from the front, and the game lights each piece
again. Painted as they are, the photographs' own highlights and shadows are wrapped round the
turned pieces and show as streaks and bands, and the stone takes whatever tint the photograph's
light had. prep() takes that light out of the stone (the carving, the veins, the gold and the
gems stay as they are), sets the stone's tone, and firms up the fine lines a little."""
import math

import bmesh
import cv2
import numpy as np

import classic
import kit

LUM = np.array((0.114, 0.587, 0.299), np.float32)


def delight(ref, cls=None, amount=0.8, tone=None, sharpen=0.4, shine=0.5, scale=0.03):
    """One cut-out, relit flat.
    amount   0..1: how much of the broad light and shade is taken out of the stone
    tone     BGR the stone's middle colour is brought to (None: left as photographed)
    shine    0..1: how much of the thin bright streaks left after that is pressed down
    sharpen  unsharp mask over the whole piece
    scale    size of what counts as broad, as a share of the piece's height"""
    img = ref.crop.astype(np.float32)
    m = ref.mask > 0
    cls = cls or {}
    ids = kit.classify(ref.crop, **cls)
    w = ((1 - kit.gold_weight(ref.crop, **cls)) * (ids != 2) * m).astype(np.float32)   # how surely stone
    body = w > 0.6
    if body.sum() < 200:
        return ref
    h = int(m.any(1).sum())
    lum = img @ LUM
    if amount:
        sig = max(6.0, scale * h)
        low = cv2.GaussianBlur(lum * w, (0, 0), sig) / (cv2.GaussianBlur(w, (0, 0), sig) + 1e-4)
        mid = float(np.median(lum[body]))
        gain = np.clip((mid / np.maximum(low, 1.0)) ** amount, 0.5, 2.0)
        img = img * (1 + w[..., None] * (gain[..., None] - 1))
    if shine:
        lum = img @ LUM
        mid = float(np.median(lum[body]))
        over = np.maximum(lum / max(mid, 1.0), 1.0)
        g = over ** (-shine)                         # only what is brighter than the stone's middle
        img = img * (1 + w[..., None] * (g[..., None] - 1))
    if tone is not None:
        med = np.median(img[body], axis=0)
        g = np.array(tone, np.float32) / np.maximum(med, 1.0)
        img = img * (1 + w[..., None] * (g[None, None, :] - 1))
    if sharpen:
        sig = max(1.0, 0.0022 * h)
        img = img + sharpen * (img - cv2.GaussianBlur(img, (0, 0), sig))
    out = img.clip(0, 255).astype(np.uint8)
    # the outline's last two pixels are part backdrop: on a relief's rim they stretch into grey
    # stripes. They take the colour just inside instead (the outline itself does not move)
    core = cv2.erode(ref.mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    if core.any():
        fill = kit.dilate_fill(out, core, 6).clip(0, 255).astype(np.uint8)
        ring = (ref.mask > 0) & (core == 0)
        out[ring] = fill[ring]
    ref.crop = out
    return ref


def prep(refs, looks, opts):
    """every cut-out of a set relit flat. opts: {side: {...}} for delight(), with an optional
    per-type override under the type's letter ({'w': {'tone': ..., 'n': {'amount': 0.5}}})"""
    for side, d in refs.items():
        lk = looks[side] if side in looks else looks
        o = dict(opts.get(side, {}))
        per = {k: o.pop(k) for k in list(o) if k in kit.TYPES}
        for t, r in d.items():
            kw = dict(o)
            kw.update(per.get(t, {}))
            delight(r, cls=lk.get('classify'), **kw)
    return refs


def crown(t, refs, sp):
    """A king's or queen's crown as a true ring of leaves round a small gold cap, in few faces:
    the turned body up to the collar, a flared band that divides into `points` leaves (each a
    smooth-edged panel with a gold lining), the cap, and the cross or finial from the picture.
    Fractions of the piece's height: zc collar, zp where the leaves part, ztip their tips.
    classic.py's own crown is a fine grid cut by a mask, which the detail levels thin to rags."""
    r = refs['w']
    r.t = t
    others = [x for s, x in refs.items() if s != 'w']
    h = r.height()
    zc, zp, ztip = sp['zc'] * h, sp['zp'] * h, sp['ztip'] * h
    n, phase, sharp, thick = sp.get('points', 8), sp.get('phase', 0.0), sp.get('sharp', 0.6), sp.get('thick', 0.03)
    body = kit.lathe('body', r.profile(0, zc + 0.01, tol=0.002), segs=64)
    kit.set_uv(body, t, fold=sp.get('fold', 4))
    parts = [body]
    prof = r.profile(zc - 0.01, ztip, step_px=2, tol=0.002)
    pz, pr = np.array([p[0] for p in prof]), np.array([max(p[1], 0.03) for p in prof])
    zs = list(np.linspace(zc - 0.01, zp, 3)) + [zp + (ztip - zp) * u for u in (0.2, 0.4, 0.6, 0.78, 0.92, 1.0)]
    cols = sp.get('cols', 6)
    half = math.pi / n
    ob, me = kit._new('crown')
    bm = bmesh.new()

    def vert(phi, rr, z):
        return bm.verts.new((rr * math.sin(phi), -rr * math.cos(phi), z))
    for i in range(n):
        c0 = phase + 2 * math.pi * i / n
        outer, inner = [], []
        for z in zs:
            u = min(1.0, max(0.0, (z - zp) / (ztip - zp)))
            a = half * (1.0 if z <= zp + 1e-9 else 0.92 * (1 - u) ** sharp + 0.07)
            rr = float(np.interp(z, pz, pr))
            outer.append([vert(c0 + (2 * c / cols - 1) * a, rr, z) for c in range(cols + 1)])
            inner.append([vert(c0 + (2 * c / cols - 1) * a, rr - thick, z) for c in range(cols + 1)])
        for j in range(len(zs) - 1):
            for c in range(cols):
                bm.faces.new((outer[j][c], outer[j][c + 1], outer[j + 1][c + 1], outer[j + 1][c]))
                bm.faces.new((inner[j][c + 1], inner[j][c], inner[j + 1][c], inner[j + 1][c + 1]))
            if zs[j + 1] > zp + 1e-9:   # the leaf's two edges
                bm.faces.new((inner[j][0], outer[j][0], outer[j + 1][0], inner[j + 1][0]))
                bm.faces.new((outer[j][cols], inner[j][cols], inner[j + 1][cols], outer[j + 1][cols]))
        for c in range(cols):           # its tip, and the band's foot
            bm.faces.new((outer[-1][c], outer[-1][c + 1], inner[-1][c + 1], inner[-1][c]))
            bm.faces.new((outer[0][c + 1], outer[0][c], inner[0][c], inner[0][c + 1]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    gold = kit.pick([r] + others, 1, (0.1, zc + 0.05))
    kit.set_uv(ob, t, fold=2, inner=gold)
    parts.append(ob)
    if sp.get('dome'):
        z0, z1, rr, cls = sp['dome']
        z0, z1 = z0 * h, z1 * h
        cap = kit.lathe('cap', [(z0 + (z1 - z0) * u, rr * max(0.0, 1 - u ** 2.2) ** 0.5) for u in [i / 10 for i in range(11)]], segs=32)
        kit.set_uv(cap, t, mode='point', at=kit.pick([r] + others, cls, (0.08, 0.6)))
        parts.append(cap)
    if sp.get('top'):
        parts.append(classic.topper(r, sp['top']))
    return kit.join(parts, t)
