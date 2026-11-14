"""Shared sculpting vocabulary for the characters (S = sdf, K = kit). Owned by the characters
thread: a character file may use anything here, but must not change it (add what you need in your
own file), so parallel work never collides."""
import math


import numpy as np


import sdf as S


import kit as K


LO, HI = (-0.85, -1.3, -0.85), (0.85, 1.05, 0.85)


def half(p0, n):
    """The half-space on the side n points to, from the point p0."""
    n = np.asarray(n, float); n = n / np.linalg.norm(n); p0 = np.asarray(p0, float)
    return S.F(lambda P: -((P - p0) @ n))


def lids(c, r, open_=0.35, tilt=0.0, t=0.018, low=0.6):
    """Upper and lower eyelids: shells around the eyeball, cut to leave the eye open.
    open_: where the upper lid edge sits (fraction of r above centre); tilt turns it outward."""
    c = np.asarray(c, float)
    shell = S.sphere(c, r + t).sub(S.sphere(c, r + 0.002))
    front = half(c - np.array([0, 0, r * 0.2]), (0, 0, 1))
    sx = 1 if c[0] >= 0 else -1
    up = shell.inter(half(c + np.array([0, r * open_, 0]), (-math.sin(tilt) * sx, math.cos(tilt), 0.0)))
    lo = shell.inter(half(c - np.array([0, r * low, 0]), (0, -1, 0.3)))
    return S.union(up, lo).inter(front)


def socket(c, r):
    return S.sphere(c, r * 1.02)


def bust(neck_top=(0, -0.3, -0.05), chest=(0, -1.05, -0.05), w=0.62, neck=(0.3, 0.42)):
    neck = S.cone(neck_top, (0, -0.85, -0.12), neck[0], neck[1])
    body = S.ell(chest, (w, 0.42, 0.42))
    return S.union(neck, body, k=0.18)


def torso(y=-0.62, w=0.7, neck=0.3):
    """A critter's bust: a short neck on sloping shoulders and a chest that is wider than deep."""
    neck_f = S.cone((0, -0.05, -0.04), (0, y + 0.05, -0.06), neck, neck * 1.15)
    chest = S.ell((0, y - 0.55, -0.06), (w * 0.86, 0.68, 0.3))
    sh = S.cone((neck * 0.6, y + 0.02, -0.07), (w * 0.86, y - 0.2, -0.07), 0.15, 0.2).mirror()
    return S.union(neck_f, chest, sh, k=0.12)


def smile(c, w, h, d=0.1, curve=0.5, tilt=0.35):
    """An open, happy mouth at c: the top edge is a curve that rises to the corners, the bottom
    a round arc. Returns the cavity and a thin crease that carries the corners up into dimples."""
    cx, cy, cz = c
    a = h * curve / (w * w)
    bowl = S.ell((cx, cy + h * 0.1, cz), (w, h * 1.1, d), rot=(tilt, 0, 0))
    top = S.F(lambda P: (P[:, 1] - (cy + h * 0.1 + a * (P[:, 0] - cx) ** 2)) * 0.8)
    cav = bowl.inter(top, k=0.015)
    yc = cy + h * 0.1 + a * w * w
    corners = S.union(*[S.ell((cx + sx * w * 1.02, yc + h * 0.1, cz - d * 0.5), (h * 0.16, h * 0.42, h * 0.2), rot=(0, 0, sx * 0.5)) for sx in (1, -1)])
    return cav, corners


def mouth_parts(name, c, w, h, d, teeth_col='#fbf6ec', tongue='#e05a6c', tilt=0.35, top_teeth=True, curve=0.5):
    """Teeth along the top of the open mouth and a tongue lying in it."""
    cx, cy, cz = c
    K.build(name + 'Tongue', S.ell((cx, cy - h * 0.7, cz - d * 1.0), (w * 0.68, h * 0.42, d * 0.8), rot=(tilt, 0, 0)),
            (cx - w, cy - h * 1.4, cz - d * 1.4), (cx + w, cy, cz + d), [K.skin(name + 'TongueSkin', tongue, 0.28, 0.5)], step=0.004)
    if top_teeth:
        a = h * curve / (w * w)
        band = S.tube([(cx + x, cy + h * 0.05 + a * x * x - h * 0.12, cz + d * 0.12 - abs(x) * 0.45) for x in np.linspace(-w * 0.6, w * 0.6, 7)], h * 0.2, h * 0.2, k=0.01)
        K.build(name + 'Teeth', band, (cx - w, cy - h, cz - d), (cx + w, cy + h, cz + d * 1.2), [K.glossy(name + 'Tooth', teeth_col, 0.12)], step=0.003)


def place_eye(head, x, y, r, out=0.5):
    """Eye centre so the ball shows `out` of its radius in front of the face surface."""
    z = S.surf_z(head, x, y)
    return (x, y, z - r * (1 - out))


def hair_groups(o, W, names):
    for i, n in names.items():
        K.vgroup(o, n, W[:, i])


BEAD = '#120c0a'


def crease(shape, c, w, rise=0.03, smirk=0.0, r=0.011, depth=0.3):
    """A closed smile: a thin crease along a curve that rises to the corners (smirk lifts one side)."""
    cx, cy, cz = c
    def pt(x):
        y = cy + rise * (x / w) ** 2 + smirk * (x / w) * 0.5 * (1 + np.sign(x))
        return (cx + x, y, S.surf_z(shape, cx + x, y) - r * depth)
    right = S.tube([pt(x) for x in np.linspace(0, w, 6)], r, r * 0.45, k=0.004)
    left = S.tube([pt(-x) for x in np.linspace(0, w, 6)], r, r * 0.45, k=0.004)
    dim = S.union(*[S.sphere(pt(sx * w * 1.02), r * 0.7) for sx in (1, -1)])
    return S.union(right, left, dim, k=0.006)


def brows(C, col, tip=None, length=0.05, angle=0.0, lift=0.25, spread=1.0, n=160, comb=(1.0, 0.25, 0.4), gravity=0.1,
          thick=0.022, clump=0.6, root=0.0022, name=None):
    """Brows of groomed hair over each eye (call after C.build). angle > 0 lifts the outer ends
    (bold, sly), < 0 the inner ends (kind, worried); lift moves them up off the lid."""
    c, r = C.eyes[0][0], C.eyes[0][1]
    def arc(sx):
        pts = []
        for u in np.linspace(-0.85, 1.0, 6) * spread:
            x = c[0] + u * r
            y = c[1] + r * (1.12 + lift) + angle * u * r - 0.25 * (u * r) ** 2 / r
            pts.append((sx * x, y, S.surf_z(C.shape, x, y)))
        return S.tube(pts, max(thick, 0.008), max(thick, 0.008) * 0.6)
    band = S.union(arc(1), arc(-1))
    w = np.clip(0.5 - band(C.P) / 0.01, 0, 1)
    P, N = K.sample_surface(C.o, w, n * 2, seed=7)
    out, Ns = [], []
    for sx in (1, -1):
        m = np.sign(P[:, 0]) == sx
        if m.sum() < 4:
            continue
        Ns.append(N[m])
        out += K.groom(P[m], N[m], length, (sx * comb[0], comb[1], comb[2]), gravity=gravity, lift=0.5, clumps=10,
                       clump=clump, jitter=0.12, seed=3 if sx > 0 else 4)
    nm = name or C.name + 'Brow'
    K.strands(nm, out, K.hair_mat(nm + 'Hair', col, tip or col, var=0.08), root, root * 0.25, normals=np.concatenate(Ns))


def spectacles(name, ec, er, rim=0.1, col=None, half_moon=False, drop=0.0):
    """Round gold spectacles in front of the eyes at ec (one side), arms back over the ears."""
    rims, lenses = [], []
    for sx in (1, -1):
        c = (ec[0] * sx, ec[1] - 0.005 - drop, ec[2] + er + 0.03)
        t = S.torus(c, rim, 0.009, rot=(math.pi / 2, 0, 0))
        l = S.cyl(c, rim * 0.95, 0.003, rot=(math.pi / 2, 0, 0))
        if half_moon:
            cut = S.plane((0, -1, 0), -(c[1] + rim * 0.15))
            t, l = t.inter(cut).add(S.tube([(c[0] - rim, c[1] + rim * 0.15, c[2]), (c[0] + rim, c[1] + rim * 0.15, c[2])], 0.008, 0.008), 0.004), l.inter(cut)
        rims.append(t); lenses.append(l)
    y = ec[1] - drop
    bridge = S.tube([(-ec[0] + rim * 0.95, y + 0.02, ec[2] + er + 0.04), (0, y + 0.045, ec[2] + er + 0.06), (ec[0] - rim * 0.95, y + 0.02, ec[2] + er + 0.04)], 0.007, 0.007)
    arms = S.union(*[S.tube([(sx * (ec[0] + rim), y, ec[2] + er + 0.02), (sx * 0.3, y + 0.02, 0.0), (sx * 0.31, y, -0.15)], 0.006, 0.006) for sx in (1, -1)])
    K.build(name + 'Specs', S.union(*rims, bridge, arms), (-0.5, -0.2, -0.3), (0.5, 0.6, 0.7), [K.gold(name + 'SpecGold', col) if col else K.gold(name + 'SpecGold')], step=0.0022)
    K.build(name + 'Lens', S.union(*lenses), (-0.5, -0.2, -0.3), (0.5, 0.6, 0.7), [K.principled(name + 'Glass', '#ffffff', rough=0.0, transmission=1.0, ior=1.3)], step=0.002)


class Char:
    """A furred character in the making: sculpt (add/sub), colour regions with their own fur,
    eyes in lidded sockets. build() makes the mesh, paints it and grows the coats."""

    DENS = 26000.0   # guide hairs per square unit of skin

    def __init__(self, name, skin, hair, tip=None, length=0.02, align=(0, -0.6, -0.2), rough=0.5, sss=0.15, clump=0.08, var=0.18):
        self.name = name
        self.shape = None
        self.regions = []
        self.mats = [K.skin(name + 'Skin', skin, rough, sss)]
        self.furs = [dict(idx=0, col=hair, tip=tip, length=length, align=align, clump=clump, var=var)]
        self.eyes = []
        self.lidf = []

    def add(self, f, k=0.0):
        self.shape = f if self.shape is None else self.shape.add(f, k)
        return self

    def sub(self, f, k=0.0):
        self.shape = self.shape.sub(f, k)
        return self

    def region(self, field, skin, soft=0.02, hair=None, tip=None, length=None, align=None, clump=None, var=0.15, dens=1.0,
               mat=None):
        """A patch with its own skin (colour or material) and, if `hair` is given, its own fur."""
        m = mat or (K.skin('%sR%d' % (self.name, len(self.mats)), skin, 0.45, 0.2) if isinstance(skin, str) else skin)
        idx = len(self.mats)
        self.mats.append(m)
        self.regions.append((field, idx, soft))
        if hair:
            base = self.furs[0]
            self.furs.append(dict(idx=idx, col=hair, tip=tip, length=length or base['length'], align=align or base['align'],
                                  clump=base['clump'] if clump is None else clump, var=var, dens=dens))
        return idx

    def eye(self, x, y, r, out=0.6, iris='#5a3018', open_=0.9, tilt=0.05, low=0.64, look=(0.1, 0.0, 1.0), iris_r=0.79,
            pupil_r=0.3, lid_t=0.012, slit=False, sclera='#f4efe8', glance=0.0):
        c = place_eye(self.shape, x, y, r, out)
        self.sub(S.sphere(c, r + 0.004).mirror(), 0.015)
        self.add(lids(c, r, open_, tilt, lid_t, low).mirror(), 0.012)
        self.eyes.append((c, r, iris, (look[0], look[1], look[2], glance), iris_r, pupil_r, slit, sclera))
        self.lidf.append(S.sphere(c, r * 1.5).mirror())
        return c

    def build(self, step=0.0065, lo=LO, hi=HI, bump=0.003):
        shape = self.shape.bump(bump, 9, 1) if bump else self.shape
        o = K.build(self.name, shape, lo, hi, self.mats, step=step)
        W = K.paint(o, self.regions)
        P = np.array([v.co[:] for v in o.data.vertices])
        lid = np.zeros(len(P))
        for f in self.lidf:
            lid = np.maximum(lid, np.clip(0.5 - f(P) / 0.03, 0, 1))
        area = K.vertex_area(o)
        furred = np.zeros(len(P))
        for i, fs in enumerate(self.furs):
            w = W[:, fs['idx']] * (1 - lid)
            furred += W[:, fs['idx']]
            mn = '%sHair%d' % (self.name, i)
            o.data.materials.append(K.hair_mat(mn, fs['col'], fs['tip'], var=fs['var']))
            K.vgroup(o, mn, w)
            n = int(self.DENS * fs.get('dens', 1.0) * float((area * w).sum()) * (0.02 / max(fs['length'], 0.004)) ** 0.3)
            if n > 50:
                K.fur(o, mn, mn, length=fs['length'], count=n, children=7, align=fs['align'], clump=fs['clump'],
                      root=0.0016 if fs['length'] < 0.04 else 0.0026, seed=i)
        # short fur on the lids, in the base colour
        if self.lidf and self.furs:
            K.vgroup(o, 'lids', lid * furred)
            K.fur(o, 'lids', '%sHair0' % self.name, length=0.006, count=int(self.DENS * 0.6 * float((area * lid * furred).sum())) + 60,
                  children=4, align=(0, -0.2, 0), clump=0.0, root=0.0012, seed=99)
        for j, (c, r, iris, look, ir, pr, slit, scl) in enumerate(self.eyes):
            for s in (1, -1):
                K.eye('%sEye%d%d' % (self.name, j, s), (c[0] * s, c[1], c[2]), r, look=(look[0] * s + 0.08 + look[3], look[1], look[2]),
                      iris=iris, iris_r=ir, pupil_r=pr, slit=slit, sclera=scl)
        self.o, self.W, self.P = o, W, P
        return o

    def weight(self, field, soft=0.02):
        return np.clip(0.5 - field(self.P) / soft * 0.5, 0, 1)


def ear(base, tip, r0, r1=0.02, inner=True, thick=0.045, cup=0.6):
    """A pointed or rounded ear from base to tip, flattened, with the inner hollow facing the camera."""
    base, tip = np.asarray(base, float), np.asarray(tip, float)
    e = S.cone(base, tip, r0, r1)
    flat = S.F(lambda P, e=e: e(P))
    mid = base + (tip - base) * 0.45
    cut = S.cone(base + np.array([0, 0, r0 * 0.5]), tip + np.array([0, 0, r1 * 0.5]) + (tip - base) * -0.12, r0 * cup, r1 * 0.4)
    shape = e.inter(S.plane((0, 0, 1), base[2] + thick)).inter(S.plane((0, 0, -1), -(base[2] - thick)), k=0.02)
    return shape, cut.move(0, 0, thick * 0.9)


def garment(body, top_y, t=0.03, front_v=None, folds=0.008, seed=0):
    """Clothing over the bust: the body grown by t, up to a neckline, with soft folds; front_v=(depth,
    width) opens a V at the front and turns back lapels along it."""
    g = body.grow(t).inter(S.plane((0, 1, 0), top_y), k=0.03)
    if front_v:
        d, w = front_v
        vcut = S.F(lambda P: np.maximum(np.abs(P[:, 0]) - w * (P[:, 1] - (top_y - d)) / d, -(P[:, 2] - 0.1)))
        g = g.sub(vcut, k=0.01)
    if folds:
        g = g.bump(folds, 7, seed)
    return g


def leaves(path_pts, n, size, tilt=0.6, seed=0):
    """A garland: n leaves along a curve, alternating out from it (laurel wreaths)."""
    pts = np.asarray(path_pts, float)
    rng = np.random.default_rng(seed)
    out = []
    seg = np.linspace(0, len(pts) - 1.001, n)
    for j, u in enumerate(seg):
        i = int(u); f = u - i
        p = pts[i] * (1 - f) + pts[i + 1] * f
        d = pts[i + 1] - pts[i]
        side = 1 if j % 2 else -1
        ang = math.atan2(d[1], d[0])
        out.append(S.ell(p + np.array([0, side * size * 0.5, size * 0.3]), (size, size * 0.42, size * 0.12),
                         rot=(0.3 * side, 0, ang + side * tilt)))
    return S.union(*out)


def squash(f, c, sx=1.0, sy=1.0, sz=1.0):
    """Scale a shape about c (the distances stay roughly right for gentle squashes)."""
    c = np.asarray(c, float)
    sc = np.array([sx, sy, sz])
    m = min(sx, sy, sz)
    return S.F(lambda P: f(c + (P - c) / sc) * m)


def critter_head(c=(0, 0.25, 0), r=(0.36, 0.33, 0.33), cheeks=0.17, muzzle=(0.15, 0.11, 0.11), my=0.03, mz=0.29, chin=True, taper=0.0, cheek_y=0.42):
    """A mammal head: cranium, cheeks and muzzle. taper > 0 makes a pear (narrow crown, wide jowls),
    taper < 0 a broad crown over a narrow jaw, so every animal gets its own face shape."""
    cx, cy, cz = c
    head = S.ell(c, r)
    if taper:
        h0 = head
        head = S.F(lambda P, h0=h0: h0(np.column_stack([P[:, 0] / np.clip(1 - taper * (P[:, 1] - cy) / r[1], 0.4, 2.0), P[:, 1], P[:, 2]])) * 0.9)
    ch = S.ell((r[0] * 0.55, cy - r[1] * cheek_y, cz + r[2] * 0.3), (cheeks, cheeks * 0.85, cheeks * 0.9)).mirror()
    mu = S.ell((0, cy - r[1] * 0.68 + my, mz), muzzle)
    parts = [head, ch, mu]
    if chin:
        parts.append(S.ell((0, cy - r[1] * 0.95 + my, mz - 0.08), (muzzle[0] * 0.75, muzzle[1] * 0.6, muzzle[2] * 0.8)))
    return S.union(*parts, k=0.09), mu


def button_nose(c, w=0.05, h=0.035, d=0.035):
    return S.ell(c, (w, h, d)).add(S.ell((c[0], c[1] + h * 0.35, c[2] - d * 0.2), (w * 1.1, h * 0.7, d * 0.9)), 0.02)


def face_basics(C, nose_y, mouth_y, nose=(0.05, 0.034, 0.04), mw=0.1, mh=0.055, md=0.08, curve=0.9, nose_col='#141414', gum='#8a2e3a', nose_mat=None,
                closed=False, rise=0.03, smirk=0.0):
    """Nose button and a smile on the current shape (open, or a closed crease, or a smirk);
    returns (nose centre, mouth centre, cavity)."""
    nose_c = (0, nose_y, S.surf_z(C.shape, 0, nose_y) - nose[2] * 0.5)
    C.add(button_nose(nose_c, *nose), 0.01)
    mc = (0, mouth_y, S.surf_z(C.shape, 0, mouth_y) - md * 0.42)
    if closed:
        mc = (0, mouth_y, S.surf_z(C.shape, 0, mouth_y))
        cav = crease(C.shape, mc, mw, rise, smirk)
        C.sub(cav, 0.008)
        C._closed = True
    else:
        cav, corners = smile(mc, mw, mh, md, curve)
        C.sub(cav, 0.012).sub(corners, 0.01)
    C._nose = (nose_c, nose, nose_mat or K.glossy(C.name + 'Nose', nose_col, 0.22))
    C._mouth = (mc, mw, mh, md, curve, cav)
    return nose_c, mc, cav


def face_regions(C):
    nose_c, nose, nm = C._nose
    C.region(S.ell(nose_c, (nose[0] * 1.15, nose[1] * 1.25, nose[2] * 1.2)), nm, 0.008)
    C.region(C._mouth[5].grow(0.004 if getattr(C, '_closed', False) else 0.006), '#3a1a1c' if getattr(C, '_closed', False) else '#8a2e3a', 0.006)


def mouth_after(C, **kw):
    if getattr(C, '_closed', False):
        return
    mc, mw, mh, md, curve, cav = C._mouth
    mouth_parts(C.name, mc, mw, mh, md, curve=curve, **kw)


def beak(c, length, w, h, droop=0.08, hook=0.0):
    """A bird's beak: upper and lower bills from the face at c, the upper curving down at the tip."""
    cx, cy, cz = c
    up = S.tube([(cx, cy + h * 0.2, cz - 0.04), (cx, cy + h * 0.1, cz + length * 0.5), (cx, cy - droop - hook * 0.5, cz + length)], w, w * 0.12, k=0.01)
    up = squash(up, (cx, cy, cz + length * 0.5), 1.0, h / w, 1.0)
    lo = S.tube([(cx, cy - h * 0.45, cz - 0.04), (cx, cy - h * 0.55, cz + length * 0.6)], w * 0.75, w * 0.12)
    lo = squash(lo, (cx, cy - h * 0.5, cz + length * 0.3), 1.0, 0.55, 1.0)
    if hook:
        up = up.add(S.cone((cx, cy - droop, cz + length * 0.95), (cx, cy - droop - hook, cz + length * 0.9), w * 0.18, w * 0.05), 0.01)
    return up, lo


def bird(C, head_c=(0, 0.22, 0), head_r=(0.32, 0.3, 0.3), body_w=0.66, neck=0.32):
    C.add(S.union(S.ell(head_c, head_r), S.ell((0.16, head_c[1] - 0.14, 0.1), (0.15, 0.14, 0.15)).mirror(), k=0.08))
    body = torso(-0.5, body_w, neck)
    C.add(body, 0.2)
    return body


def bpy_mat(name):
    import bpy
    return bpy.data.materials[name]
