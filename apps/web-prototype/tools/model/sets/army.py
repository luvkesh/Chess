"""The Royal Army: an Indian court at war. Ivory marble with saffron enamel and rubies against
black marble with indigo enamel and emeralds, all inlaid with polished gold. A bearded king
with his sceptre, a queen in a flowing gown, camel riders for bishops, horsemen for knights,
war elephants for rooks and foot soldiers for pawns.

Hero set with no reference picture: the twelve pictures in pics/army are the blended design the
owner chose on 2026-11-13 ("the clarity of A, material and shine of B and the premiumness of C").
Each picture has its outline beside it (pics/army/<side>-<type>.mask.png), drawn with Segment
Anything, so the gaps between an animal's legs stay open in the model.

Every piece stands on a turned plinth (true 3D from every side) whose top is painted from the
plinth top in the picture; the figure above it is carved from its picture. The riders' animals
stand side on, as they do in the pictures, on oval plinths, so both players see the whole
camel, horse and elephant."""
import copy
import math
import os

import cv2
import numpy as np

import kit

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pics', 'army')
# heights in game units, chosen so that no piece is wider than its square (the animals are long)
HEIGHT = {'k': 1.75, 'q': 1.57, 'b': 1.35, 'n': 1.31, 'r': 1.29, 'p': 1.1}
HALF = {t: 'full' for t in 'kqbnrp'}
SIDED = set('kqbnrp')
GOLD = (58, 160, 228)
LOOK = {
    'w': {'wb': (1.03, 1.0, 0.98), 'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD, 'gold_mix': 0.45,
          'classify': {'gold': (30, 62), 'gold_sat': 0.55, 'gold_val': 0.5}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': 'enamel', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD, 'gold_mix': 0.45,
          'classify': {'gold': (26, 62), 'gold_sat': 0.55, 'gold_val': 0.45}},
}
# z0: the plinth's top (the widest row of its rim in the picture), as a fraction of the piece's
# height. oval: the plinth's depth as a fraction of its length (the animals' plinths are long).
# deep: the most a figure swells either side of its middle (0.25 where not given).
SPEC = {
    'w': {
        'k': {'z0': 0.110},
        'q': {'z0': 0.095},
        'b': {'z0': 0.075, 'oval': 0.64},
        'n': {'z0': 0.185, 'oval': 0.7},
        'r': {'z0': 0.175, 'oval': 0.66},
        'p': {'z0': 0.190},
    },
    'b': {
        'k': {'z0': 0.105},
        'q': {'z0': 0.115},
        'b': {'z0': 0.095, 'oval': 0.64},
        'n': {'z0': 0.185, 'oval': 0.7},
        'r': {'z0': 0.175, 'oval': 0.66},
        'p': {'z0': 0.200},
    },
}


def refs():
    out = {}
    for side in 'wb':
        out[side] = {}
        for t in 'kqbnrp':
            path = os.path.join(HERE, '%s-%s.jpg' % (side, t))
            m = (cv2.imread(os.path.join(HERE, '%s-%s.mask.png' % (side, t)), 0) > 127).astype(np.uint8) * 255
            ys, xs = np.nonzero(m)
            x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
            pad = 14
            X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
            X1, Y1 = min(m.shape[1], x1 + pad), min(m.shape[0], y1 + pad)
            r = kit.Ref(path, (x0, y0, x1, y1), mask=m[Y0:Y1, X0:X1], unit=1.0, foot=0, pad=pad)
            r.unit = HEIGHT[t] / max(r.height(), 1e-6)
            r.side = side
            out[side][t] = r
    return out


def tilt(r, zc):
    """how much the picture looks down on the plinth: the height of half the top's ellipse over
    its half width, measured on the plinth's bottom edge (lowest in the middle, full width where
    the ellipse of the foot is widest)"""
    wmax = max(r.width(z) for z in np.arange(0.0, zc, r.unit))
    for z in np.arange(0.0, zc, r.unit):
        if r.width(z) >= 0.965 * wmax:
            return float(np.clip(z / max(wmax, 1e-6), 0.06, 0.2))
    return 0.13


def plinth(r, t, zc, eh, oval):
    """the turned plinth up to just under its top. The top is painted as rings of the rim just
    under its front edge: the picture's own plinth top is mostly hidden by feet, hooves and hems"""
    import bpy
    zl = zc - 0.4 * eh
    base = kit.lathe('base', r.profile(0, zl))
    kit.set_uv(base, t, fold=4)
    me = base.data
    uvl = me.uv_layers[0].data
    R = max(r.width(zc), 1e-6)
    ztop = max(v.co.z for v in me.vertices)
    for poly in me.polygons:
        if poly.normal.z < 0.9 or poly.center.z < ztop - 1e-5:
            continue
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            rho = math.hypot(co.x, co.y)
            a = kit.fold_angle(math.atan2(co.x, -co.y), 8)
            uvl[li].uv = kit.cell_uv(t, 0.35 * rho * math.sin(a), zc - eh * (1.9 - 0.8 * min(1.0, rho / R)))
    if oval:
        base.scale = (1.0, oval, 1.0)
        bpy.context.view_layer.update()
    return base


def figure_ref(r, zc, eh):
    """the picture's outline without the plinth's top: in the band where the top shows, only
    the columns that carry the figure down from above are kept (feet, hooves, a gown's hem)"""
    rf = copy.copy(r)
    m = r.mask.copy()
    row = lambda z: int(round(r.bot - z / r.unit))
    top, bot = row(zc + 1.15 * eh), row(zc - 0.4 * eh)
    sup = cv2.dilate(m[max(top - 2, 0):top + 1].max(0)[None, :], np.ones((1, 2 * max(2, int(0.012 / r.unit)) + 1), np.uint8))[0]
    m[top:bot + 1] &= sup[None, :]
    rf.mask = m
    return rf


def carve(name, rf, z0, cap, deep=0.92):
    """the figure swollen from its outline as a sculptor rounds it: every part is as deep as it
    is wide (a head a ball, a leg or a staff a rod, the body a barrel), up to `cap` either side
    of the middle. kit.relief's own swell makes thin parts as deep as thick ones (a leg becomes
    a blade and smears its edge along it), so the depth is worked out here and handed to it."""
    from scipy.ndimage import distance_transform_edt, gaussian_filter
    m = rf.mask > 127
    m[int(round(rf.bot - z0 / rf.unit)):] = False
    dt = distance_transform_edt(m)
    # the radius of the widest disc inside the outline that covers each pixel (local thickness)
    R = np.zeros(dt.shape, np.float32)
    for r in np.geomspace(max(dt.max(), 2.0), 1.0, 56):
        core = dt >= r
        if core.any():
            cover = (distance_transform_edt(~core) <= r) & m & (R == 0)
            R[cover] = r
    R[m & (R == 0)] = 1.0
    w = gaussian_filter(m.astype(np.float32), 2.0) + 1e-6
    R = np.maximum(gaussian_filter(R * m, 2.0) / w, dt)
    half = np.sqrt(np.clip(dt * (2 * R - dt), 0, None)) * rf.unit * deep
    half = (cap * np.tanh(half / cap)).astype(np.float32)
    thick = 2 * cap + 0.02

    def taper(X, Z):
        mx = (rf.axis + X / rf.unit).astype(np.float32)
        my = (rf.bot - Z / rf.unit).astype(np.float32)
        return cv2.remap(half, mx, my, cv2.INTER_LINEAR, borderValue=0) / (thick / 2)
    ob = kit.relief(name, rf, z0, thick=thick, power=1e-9, taper=taper, use_tsr=False)
    return ob


def build(t, refs):
    r = refs['w']
    r.t = t
    sp = SPEC[r.side][t]
    h = r.height()
    zc = sp['z0'] * h
    eh = tilt(r, zc) * r.width(zc)
    base = plinth(r, t, zc, eh, sp.get('oval'))
    fig = carve('figure', figure_ref(r, zc, eh), zc - 0.4 * eh - 0.02, sp.get('deep', 0.25))
    kit.set_uv(fig, t, mode='front', fold=0)
    return kit.join([base, fig], t)
