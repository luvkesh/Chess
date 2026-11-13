"""The characters, one function each. Each builds its model in the open Blender scene and
returns its framing: (camera location, look-at point, lens).

Shared vocabulary: S = sdf, K = kit. Faces are friendly: brows relaxed, mouths curve up.
"""
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
            pupil_r=0.3, lid_t=0.012, slit=False):
        c = place_eye(self.shape, x, y, r, out)
        self.sub(S.sphere(c, r + 0.004).mirror(), 0.015)
        self.add(lids(c, r, open_, tilt, lid_t, low).mirror(), 0.012)
        self.eyes.append((c, r, iris, look, iris_r, pupil_r, slit))
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
        for j, (c, r, iris, look, ir, pr, slit) in enumerate(self.eyes):
            for s in (1, -1):
                K.eye('%sEye%d%d' % (self.name, j, s), (c[0] * s, c[1], c[2]), r, look=(look[0] * s + 0.08, look[1], look[2]),
                      iris=iris, iris_r=ir, pupil_r=pr, slit=slit)
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


# ------------------------------------------------------------------------------ Rooky
def horse():
    """Rooky: a cheerful chestnut horse, white blaze, golden mane and forelock, big grin, ruby scarf."""
    coat, blaze, mane, muzzle = '#b25a24', '#f7efe4', '#b8701a', '#d9b49a'
    mats = [K.skin('HorseSkin', '#7a3a18', 0.5, 0.15), K.skin('MuzzleSkin', muzzle, 0.42, 0.35),
            K.skin('BlazeSkin', '#efe2d2', 0.5, 0.2), K.glossy('Nostril', '#3a1a12', 0.3),
            K.skin('Gum', '#a8384a', 0.35, 0.4), K.skin('ManeSkin', '#b07a22', 0.6, 0.1), K.skin('LidSkin', '#7a3a18', 0.5, 0.15)]
    cran = S.ell((0, 0.3, -0.04), (0.35, 0.32, 0.32))
    face = S.cone((0, 0.18, 0.1), (0, -0.14, 0.27), 0.235, 0.23)
    snout = S.ell((0, -0.29, 0.3), (0.285, 0.2, 0.225))
    cheeks = S.ell((0.19, 0.0, 0.08), (0.16, 0.18, 0.18)).mirror()
    jaw = S.ell((0, -0.2, 0.1), (0.25, 0.2, 0.2))
    head = S.union(cran, face, snout, cheeks, jaw, k=0.13)
    ear = S.cone((0.18, 0.52, -0.08), (0.29, 0.8, -0.1), 0.095, 0.016).add(S.ell((0.21, 0.61, -0.08), (0.08, 0.11, 0.05), rot=(0, 0, -0.3)), 0.05)
    ear_in = S.ell((0.225, 0.65, -0.02), (0.048, 0.13, 0.04), rot=(0.15, 0, -0.3))
    head = head.add(ear.mirror(), k=0.05).sub(ear_in.mirror(), k=0.02)
    er = 0.108
    ec = place_eye(head, 0.18, 0.22, er, 0.62)
    head = head.sub(S.sphere(ec, er + 0.004).mirror(), k=0.015).add(lids(ec, er, 0.86, -0.22, 0.014, 0.62).mirror(), k=0.012)
    nz = S.surf_z(head, 0.1, -0.24)
    nos = S.ell((0.1, -0.24, nz), (0.03, 0.05, 0.04), rot=(0.5, 0.35, 0.45)).mirror()
    head = head.sub(nos, k=0.02)
    mc = (0, -0.37, S.surf_z(head, 0, -0.37) - 0.05)
    cav, corners = smile(mc, 0.2, 0.12, 0.13, 0.8)
    head = head.sub(cav, k=0.02).sub(corners, k=0.015)
    body = bust((0, -0.25, -0.12), (0, -1.05, -0.12), 0.72, (0.3, 0.44))
    shape = head.add(body, k=0.2).bump(0.003, 9, 1)
    o = K.build('Rooky', shape, LO, HI, mats, step=0.0065)
    mane_line = [(0, 0.66, 0.04), (0, 0.64, -0.14), (0, 0.46, -0.3), (0.04, 0.1, -0.38), (0.08, -0.45, -0.48)]
    eyering = S.sphere(ec, er * 1.55).mirror()
    W = K.paint(o, [
        (S.ell((0, -0.29, 0.31), (0.3, 0.205, 0.235)), 1, 0.04),
        (S.tube([(0, 0.55, 0.22), (0, 0.36, 0.3), (0, 0.08, 0.36), (0, -0.14, 0.44)], 0.055, 0.09), 2, 0.025),
        (nos.grow(0.012), 3, 0.01),
        (cav.grow(0.006), 4, 0.008),
        (S.tube(mane_line, 0.12, 0.16), 5, 0.02),
        (ear_in.grow(0.012).mirror(), 1, 0.01),
        (eyering, 6, 0.03),
    ])
    hair_groups(o, W, {0: 'coat', 2: 'blaze', 1: 'muzzle', 6: 'lids'})
    o.data.materials.append(K.hair_mat('CoatHair', coat, '#d7884a'))
    o.data.materials.append(K.hair_mat('BlazeHair', blaze, '#ffffff', var=0.06))
    o.data.materials.append(K.hair_mat('MuzzleHair', '#e2c2a8', '#f4dccb', var=0.06))
    mane_m = K.hair_mat('ManeHair', mane, '#e6a83e', rough=0.2, var=0.12)
    K.fur(o, 'coat', 'CoatHair', length=0.02, count=50000, children=7, align=(0, -0.6, -0.2), clump=0.08, root=0.0016)
    K.fur(o, 'blaze', 'BlazeHair', length=0.017, count=8000, children=7, align=(0, -0.6, 0), clump=0.08, root=0.0016)
    K.fur(o, 'muzzle', 'MuzzleHair', length=0.006, count=9000, children=4, align=(0, -0.3, 0), clump=0.0, root=0.0012)
    K.fur(o, 'lids', 'CoatHair', length=0.007, count=6000, children=4, align=(0, -0.2, 0), clump=0.0, root=0.0012)
    # the golden mane falls to his right in locks; the forelock flops forward over the blaze
    P, N = K.sample_surface(o, W[:, 5], 4000, seed=2)
    K.strands('Mane', K.groom(P, N, 0.36, (1.0, 0.2, 0.7), gravity=1.4, lift=0.9, clumps=60, clump=0.8, jitter=0.2, seed=2), mane_m, 0.006, 0.001, normals=N)
    fl = S.ell((0, 0.62, 0.08), (0.13, 0.06, 0.12))
    P, N = K.sample_surface(o, np.clip(0.5 - fl(np.array([v.co[:] for v in o.data.vertices])) / 0.02, 0, 1), 900, seed=3)
    K.strands('Forelock', K.groom(P, N, 0.34, (0.35, -0.6, 0.8), gravity=0.7, lift=0.7, clumps=12, clump=0.85, jitter=0.12, seed=3), mane_m, 0.006, 0.001, normals=N)
    for s in (1, -1):
        K.eye('Eye%d' % s, (ec[0] * s, ec[1], ec[2]), er, look=(0.06 * s + 0.12, 0.0, 1), iris='#6a3412', iris_r=0.8, pupil_r=0.36)
    mouth_parts('Rooky', mc, 0.2, 0.12, 0.13, curve=0.8)
    band = S.torus((0, -0.66, -0.08), 0.36, 0.085, rot=(0.25, 0, 0)).bump(0.012, 14, 3)
    knot = S.ell((0.13, -0.74, 0.28), (0.1, 0.085, 0.07))
    tail1 = S.tube([(0.13, -0.76, 0.3), (0.17, -0.9, 0.34), (0.14, -1.05, 0.38)], 0.06, 0.045, k=0.01)
    tail2 = S.tube([(0.11, -0.76, 0.3), (0.03, -0.9, 0.38), (-0.01, -1.06, 0.39)], 0.055, 0.04, k=0.01)
    scarf = S.union(band, knot, tail1, tail2, k=0.03)
    sc = K.build('Scarf', scarf, (-0.5, -1.15, -0.5), (0.5, -0.45, 0.5), [K.knit('Ruby', '#8e0c26')], step=0.006)
    K.fuzz(sc, '#6e0818', 0.004, 25000)
    K.build('Pin', S.torus((0.13, -0.73, 0.355), 0.032, 0.01, rot=(1.45, 0, 0)), (0, -0.85, 0.25), (0.25, -0.6, 0.42), [K.gold()], step=0.003)
    K.build('Jewel', S.ell((0.13, -0.73, 0.358), (0.024, 0.024, 0.018)), (0, -0.85, 0.25), (0.25, -0.6, 0.42), [K.gem('RubyGem', '#d0103a')], step=0.003)
    return (0.6, 0.12, 3.9), (0, -0.05, 0), 80


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


# ------------------------------------------------------------------------------ Truffle
def bunny():
    """Truffle: a cream bunny with long ears (one folding forward), buck teeth, a pink silk bow
    and a rose neckerchief."""
    C = Char('Truffle', '#e8d6cc', '#f4ebe2', '#fffaf4', length=0.03, align=(0, -0.4, 0), clump=0.12, var=0.08)
    head, mu = critter_head((0, 0.22, 0), (0.33, 0.34, 0.32), 0.21, (0.14, 0.1, 0.1), 0.02, 0.27, taper=0.18)
    C.add(head)
    upright = squash(S.tube([(0.13, 0.48, -0.06), (0.17, 0.75, -0.08), (0.19, 1.02, -0.06)], 0.085, 0.075, k=0.02), (0.17, 0.75, -0.07), 1.0, 1.0, 0.45)
    fold = squash(S.tube([(-0.13, 0.48, -0.06), (-0.22, 0.72, -0.02), (-0.33, 0.86, 0.1), (-0.4, 0.8, 0.24)], 0.085, 0.07, k=0.02), (-0.25, 0.75, 0.0), 1.0, 0.7, 0.6)
    C.add(upright, 0.06).add(fold, 0.06)
    inner_u = squash(S.tube([(0.135, 0.56, 0.0), (0.172, 0.76, -0.02), (0.188, 0.97, 0.0)], 0.05, 0.035), (0.17, 0.75, 0.0), 1, 1, 0.5).move(0, 0, 0.012)
    C.sub(inner_u, 0.02)
    body = torso(-0.5, 0.66, 0.3)
    C.add(body, 0.18)
    nose_c = (0, 0.1, S.surf_z(C.shape, 0, 0.1) - 0.012)
    C.add(S.ell(nose_c, (0.042, 0.028, 0.03)), 0.01)
    mc = (0, -0.04, S.surf_z(C.shape, 0, -0.04) - 0.03)
    cav, corners = smile(mc, 0.08, 0.05, 0.07, 0.8)
    C.sub(cav, 0.012).sub(corners, 0.01)
    C.eye(0.15, 0.27, 0.1, 0.6, '#9a5a28', look=(0.08, 0.0, 1))
    C.region(S.ell(mu.fn and (0, 0.0, 0.28), (0.16, 0.13, 0.12)) if False else S.ell((0, 0.0, 0.28), (0.17, 0.13, 0.13)), '#f7f0ea', 0.04, hair='#fffdf9', tip='#ffffff', length=0.02)
    C.region(inner_u.grow(0.014), '#f2a6b4', 0.012)
    C.region(S.ell(nose_c, (0.05, 0.035, 0.04)), K.glossy('TruffleNose', '#e9788f', 0.25), 0.008)
    C.region(cav.grow(0.006), '#b84a5c', 0.006)
    band = S.torus((0, -0.33, -0.05), 0.33, 0.055, rot=(0.25, 0, 0)).bump(0.01, 16, 2)
    point = squash(S.cone((0, -0.36, 0.3), (0.0, -0.6, 0.4), 0.12, 0.02), (0, -0.45, 0.34), 1.0, 1.0, 0.35)
    scarf = S.union(band, point, k=0.04)
    C.region(scarf.grow(0.02), '#222222', 0.01)
    o = C.build(lo=(-0.85, -1.3, -0.85), hi=(0.85, 1.15, 0.85))
    mouth_parts('Truffle', mc, 0.08, 0.05, 0.07, top_teeth=False, curve=0.8)
    teeth = S.union(*[S.box((sx * 0.022, mc[1] + 0.005, mc[2] + 0.045), (0.02, 0.035, 0.01), 0.008, rot=(0.35, 0, 0)) for sx in (1, -1)])
    K.build('TruffleTeeth', teeth, (-0.1, -0.15, 0.2), (0.1, 0.05, 0.45), [K.glossy('TruffleTooth', '#fffbf4', 0.12)], step=0.0025)
    # the silk bow on the upright ear
    bow = S.union(S.ell((0.1, 0.62, 0.0), (0.075, 0.045, 0.03), rot=(0, 0, 0.35)), S.ell((0.25, 0.62, 0.0), (0.075, 0.045, 0.03), rot=(0, 0, -0.35)),
                  S.sphere((0.175, 0.62, 0.02), 0.03), k=0.015).rot(0, 0, 0.15, about=(0.175, 0.62, 0))
    K.build('TruffleBow', bow, (-0.05, 0.5, -0.1), (0.4, 0.75, 0.15), [K.silk('TruffleSilk', '#e04a78')], step=0.003)
    # the rose neckerchief: a soft band and a point at the front
    nk = K.build('TruffleScarf', scarf, (-0.5, -1.0, -0.5), (0.5, -0.3, 0.6), [K.silk('TruffleRose', '#c8325c')], step=0.005)
    return (0.55, 0.15, 3.9), (0, 0.0, 0), 76


# ------------------------------------------------------------------------------ Rocco
def raccoon():
    """Rocco: a raccoon magician: black mask, white brows and muzzle, cheek ruffs, a silk top hat
    with a red band, a tailcoat and a red bow tie."""
    C = Char('Rocco', '#5a5e68', '#8c909a', '#c8ccd4', length=0.026, align=(0, -0.5, -0.1), clump=0.12)
    head, mu = critter_head((0, 0.22, 0), (0.37, 0.3, 0.3), 0.2, (0.1, 0.08, 0.17), 0.03, 0.33, taper=-0.15)
    C.add(head)
    for sx in (1, -1):
        e, cut = ear((sx * 0.22, 0.42, -0.04), (sx * 0.33, 0.66, -0.06), 0.1, 0.03, thick=0.045)
        C.add(e, 0.04).sub(cut, 0.015)
    body = torso(-0.5, 0.66, 0.3)
    C.add(body, 0.18)
    nose_c = (0, 0.12, S.surf_z(C.shape, 0, 0.12) - 0.02)
    C.add(button_nose(nose_c, 0.05, 0.034, 0.04), 0.01)
    mc = (0, 0.0, S.surf_z(C.shape, 0, 0.0) - 0.035)
    cav, corners = smile(mc, 0.1, 0.055, 0.08, 1.0)
    C.sub(cav, 0.012).sub(corners, 0.01)
    C.eye(0.15, 0.26, 0.095, 0.6, '#b0702a', look=(0.06, 0.0, 1))
    mask = S.union(S.ell((0.15, 0.25, 0.22), (0.15, 0.1, 0.16), rot=(0, 0, -0.25)).mirror(), S.ell((0, 0.27, 0.27), (0.06, 0.05, 0.08)), k=0.04)
    C.region(S.ell((0, 0.06, 0.26), (0.19, 0.14, 0.14)), '#e8e6e2', 0.04, hair='#f4f2ee', tip='#ffffff', length=0.02)
    C.region(S.ell((0.22, 0.03, 0.12), (0.12, 0.12, 0.16)).mirror(), '#e8e6e2', 0.04, hair='#f0eeea', tip='#ffffff', length=0.06, align=(0.9, -0.4, 0.2), clump=0.4)
    C.region(mask, '#181a1e', 0.03, hair='#24262c', tip='#3a3c44', length=0.018)
    C.region(S.ell((0.14, 0.4, 0.22), (0.08, 0.03, 0.06), rot=(0, 0, -0.15)).mirror(), '#e8e6e2', 0.02, hair='#f6f4f0', tip='#ffffff', length=0.03)
    C.region(S.ell((0.27, 0.6, 0.0), (0.06, 0.12, 0.09)).mirror(), '#222222', 0.03, hair='#2a2c30', length=0.02)
    C.region(S.ell(nose_c, (0.058, 0.042, 0.05)), K.glossy('RoccoNose', '#141414', 0.22), 0.008)
    C.region(cav.grow(0.006), '#8a2e3a', 0.006)
    jacket = garment(body, -0.42, 0.035, (0.36, 0.2))
    C.region(jacket.grow(0.02), '#222222', 0.01)
    C.build()
    mouth_parts('Rocco', mc, 0.1, 0.055, 0.08, curve=1.0)
    K.build('RoccoCoat', jacket, (-0.8, -1.3, -0.6), (0.8, -0.4, 0.6), [K.principled('RoccoWool', '#16161c', rough=0.55, sheen=0.4, bump=0.05, bump_scale=600)], step=0.006)
    shirt = body.grow(0.02).inter(S.plane((0, 1, 0), -0.4)).inter(S.plane((0, 0, -1), -0.05))
    K.build('RoccoShirt', shirt, (-0.4, -1.3, -0.2), (0.4, -0.4, 0.6), [K.principled('RoccoLinen', '#f4f2ec', rough=0.6, bump=0.05)], step=0.006)
    tie = S.union(S.ell((0.07, -0.44, 0.33), (0.075, 0.045, 0.035), rot=(0, 0, 0.25)), S.ell((-0.07, -0.44, 0.33), (0.075, 0.045, 0.035), rot=(0, 0, -0.25)), S.sphere((0, -0.44, 0.34), 0.03), k=0.015)
    K.build('RoccoTie', tie, (-0.2, -0.6, 0.15), (0.2, -0.3, 0.5), [K.silk('RoccoRed', '#c0102a')], step=0.003)
    hat_c = (0.06, 0.66, -0.02)
    hat = S.union(S.cyl(hat_c, 0.21, 0.2, round_=0.02), S.cyl((hat_c[0], 0.47, hat_c[2]), 0.33, 0.012, round_=0.01), k=0.02).rot(0, 0, -0.18, about=(0.06, 0.45, 0))
    band = S.cyl((hat_c[0], 0.52, hat_c[2]), 0.218, 0.04).rot(0, 0, -0.18, about=(0.06, 0.45, 0))
    K.build('RoccoHat', hat, (-0.4, 0.4, -0.4), (0.5, 0.95, 0.4), [K.principled('RoccoSilkHat', '#121216', rough=0.25, sheen=0.3, aniso=0.6)], step=0.004)
    K.build('RoccoBand', band, (-0.4, 0.4, -0.4), (0.5, 0.65, 0.4), [K.silk('RoccoBandRed', '#a8102a')], step=0.004)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 74


# ------------------------------------------------------------------------------ Bao
def panda():
    """Bao: a panda in a red silk jacket with a gold mandarin collar and frog buttons, a sprig of bamboo."""
    C = Char('Bao', '#e6e2dc', '#f6f3ee', '#ffffff', length=0.03, align=(0, -0.4, 0), clump=0.12, var=0.06)
    head, mu = critter_head((0, 0.2, 0), (0.42, 0.34, 0.34), 0.21, (0.13, 0.09, 0.1), 0.02, 0.29, taper=0.05)
    C.add(head)
    ears = S.ell((0.28, 0.5, -0.05), (0.11, 0.1, 0.06)).mirror()
    C.add(ears, 0.05)
    body = torso(-0.5, 0.66, 0.3)
    C.add(body, 0.18)
    nose_c = (0, 0.08, S.surf_z(C.shape, 0, 0.08) - 0.02)
    C.add(button_nose(nose_c, 0.055, 0.036, 0.04), 0.01)
    mc = (0, -0.05, S.surf_z(C.shape, 0, -0.05) - 0.035)
    cav, corners = smile(mc, 0.1, 0.06, 0.08, 0.9)
    C.sub(cav, 0.012).sub(corners, 0.01)
    C.eye(0.155, 0.24, 0.09, 0.62, '#7a4a24', look=(0.06, 0.0, 1))
    C.region(S.ell((0.16, 0.21, 0.22), (0.12, 0.15, 0.16), rot=(0, 0, 0.55)).mirror(), '#16161a', 0.03, hair='#1c1c22', tip='#34343c', length=0.024)
    C.region(ears.grow(0.03), '#16161a', 0.02, hair='#1c1c22', tip='#34343c', length=0.03)
    C.region(S.ell((0, -0.75, 0), (0.9, 0.35, 0.6)), '#16161a', 0.06, hair='#1c1c22', tip='#34343c', length=0.03)
    C.region(S.ell(nose_c, (0.062, 0.044, 0.05)), K.glossy('BaoNose', '#141414', 0.22), 0.008)
    C.region(cav.grow(0.006), '#8a2e3a', 0.006)
    jacket = garment(body, -0.36, 0.04)
    C.region(jacket.grow(0.02), '#222222', 0.01)
    C.build()
    mouth_parts('Bao', mc, 0.1, 0.06, 0.08, curve=0.9)
    K.build('BaoJacket', jacket, (-0.8, -1.3, -0.6), (0.8, -0.4, 0.6), [K.principled('BaoSilk', '#b8141c', rough=0.3, sheen=0.3, aniso=0.5, bump=0.04, bump_scale=300)], step=0.006)
    collar = S.cyl((0, -0.33, -0.05), 0.345, 0.05, rot=(0.2, 0, 0)).shell(0.014).add(S.torus((0, -0.28, -0.04), 0.345, 0.016, rot=(0.2, 0, 0)), 0.006)
    K.build('BaoCollar', collar, (-0.6, -0.7, -0.6), (0.6, -0.3, 0.6), [K.gold('BaoGold')], step=0.004)
    fz = lambda y: S.surf_z(jacket, 0.0, y)
    frogs = S.union(*[S.torus((sx * 0.06, y, fz(y) - 0.004), 0.03, 0.009, rot=(1.5, 0, 0)) for sx in (1, -1) for y in (-0.5, -0.64, -0.78)] +
                    [S.sphere((0, y, fz(y) + 0.004), 0.016) for y in (-0.5, -0.64, -0.78)])
    K.build('BaoFrogs', frogs, (-0.2, -0.9, 0.2), (0.2, -0.4, 0.7), [K.gold('BaoFrogGold', '#e8c070')], step=0.0025)
    stem = S.tube([(-0.36, 0.25, -0.05), (-0.4, 0.5, -0.02), (-0.45, 0.78, 0.0)], 0.022, 0.017)
    nodes = S.union(*[S.cyl((-0.36 - t * 0.09, 0.25 + t * 0.53, -0.05 + t * 0.05), 0.026, 0.006, rot=(0, 0, 0.17)) for t in (0.3, 0.65)])
    leaf = S.union(S.ell((-0.52, 0.72, 0.03), (0.1, 0.025, 0.012), rot=(0.2, 0, 0.5)), S.ell((-0.38, 0.82, 0.02), (0.09, 0.022, 0.012), rot=(0.2, 0, -0.6)), S.ell((-0.5, 0.56, 0.04), (0.09, 0.022, 0.012), rot=(0.2, 0, 0.2)))
    K.build('BaoBamboo', S.union(stem, nodes, k=0.006), (-0.6, 0.15, -0.2), (-0.2, 0.9, 0.2), [K.principled('BaoStem', '#6aa040', rough=0.3, coat=0.4)], step=0.003)
    K.build('BaoLeaves', leaf, (-0.7, 0.4, -0.2), (-0.2, 0.95, 0.2), [K.principled('BaoLeaf', '#4c8a34', rough=0.35, sss=0.2)], step=0.0025)
    return (0.55, 0.1, 3.9), (0, -0.02, 0), 76


def face_basics(C, nose_y, mouth_y, nose=(0.05, 0.034, 0.04), mw=0.1, mh=0.055, md=0.08, curve=0.9, nose_col='#141414', gum='#8a2e3a', nose_mat=None):
    """Nose button and open smile on the current shape; returns (nose centre, mouth centre, cavity)."""
    nose_c = (0, nose_y, S.surf_z(C.shape, 0, nose_y) - nose[2] * 0.5)
    C.add(button_nose(nose_c, *nose), 0.01)
    mc = (0, mouth_y, S.surf_z(C.shape, 0, mouth_y) - md * 0.42)
    cav, corners = smile(mc, mw, mh, md, curve)
    C.sub(cav, 0.012).sub(corners, 0.01)
    C._nose = (nose_c, nose, nose_mat or K.glossy(C.name + 'Nose', nose_col, 0.22))
    C._mouth = (mc, mw, mh, md, curve, cav)
    return nose_c, mc, cav


def face_regions(C):
    nose_c, nose, nm = C._nose
    C.region(S.ell(nose_c, (nose[0] * 1.15, nose[1] * 1.25, nose[2] * 1.2)), nm, 0.008)
    C.region(C._mouth[5].grow(0.006), '#8a2e3a', 0.006)


def mouth_after(C, **kw):
    mc, mw, mh, md, curve, cav = C._mouth
    mouth_parts(C.name, mc, mw, mh, md, curve=curve, **kw)


# ------------------------------------------------------------------------------ Bramble
def beaver():
    """Bramble: a beaver builder: a yellow hard hat, big buck teeth, denim overalls with brass buttons."""
    C = Char('Bramble', '#5a3018', '#8c5430', '#b8794a', length=0.026, align=(0, -0.6, -0.1), clump=0.14)
    head, mu = critter_head((0, 0.2, 0), (0.34, 0.34, 0.31), 0.25, (0.21, 0.12, 0.11), 0.0, 0.29, taper=0.38, cheek_y=0.6)
    C.add(head)
    C.add(S.ell((0.33, 0.38, -0.04), (0.075, 0.07, 0.05)).mirror(), 0.03)
    body = torso(-0.5, 0.7, 0.32)
    C.add(body, 0.18)
    nose_c, mc, cav = face_basics(C, 0.1, -0.03, (0.06, 0.036, 0.042), 0.1, 0.05, 0.08, 0.9, '#2a160c')
    C.eye(0.16, 0.3, 0.078, 0.62, '#7a4a22', look=(0.06, 0.0, 1))
    C.region(S.ell((0, 0.02, 0.27), (0.22, 0.15, 0.15)), '#c8a07a', 0.04, hair='#d8b48c', tip='#ecd2b0', length=0.018)
    C.region(S.ell((0.33, 0.38, 0.0), (0.04, 0.04, 0.05)).mirror(), '#3a1e0e', 0.01)
    face_regions(C)
    over = garment(body, -0.46, 0.035).inter(S.plane((0, 0, -1), 0.05)).add(garment(body, -0.78, 0.035), 0.01)
    C.region(over.grow(0.02), '#222222', 0.01)
    C.build()
    mouth_after(C, top_teeth=False)
    teeth = S.union(*[S.box((sx * 0.027, mc[1] + 0.0, mc[2] + 0.05), (0.025, 0.045, 0.012), 0.01, rot=(0.3, 0, 0)) for sx in (1, -1)])
    K.build('BrambleTeeth', teeth, (-0.12, -0.15, 0.2), (0.12, 0.08, 0.5), [K.glossy('BrambleTooth', '#fbf2dc', 0.14)], step=0.0025)
    K.build('BrambleOveralls', over, (-0.8, -1.3, -0.6), (0.8, -0.3, 0.6), [K.principled('Denim', '#2f4f7a', rough=0.8, sheen=0.3, bump=0.25, bump_scale=900)], step=0.006)
    straps = S.union(*[S.tube([(sx * 0.2, -0.42, 0.22), (sx * 0.24, -0.3, 0.12), (sx * 0.27, -0.2, -0.05)], 0.035, 0.035) for sx in (1, -1)])
    K.build('BrambleStraps', straps.inter(C.shape.grow(0.03)).sub(C.shape), (-0.5, -0.6, -0.3), (0.5, -0.1, 0.5), [K.principled('Denim2', '#2a4670', rough=0.8, bump=0.2, bump_scale=900)], step=0.004)
    btn = S.union(*[S.cyl((sx * 0.2, -0.44, S.surf_z(over, sx * 0.2, -0.44) - 0.005), 0.03, 0.008, rot=(1.4, 0, 0), round_=0.004) for sx in (1, -1)])
    K.build('BrambleButtons', btn, (-0.4, -0.6, 0.0), (0.4, -0.3, 0.6), [K.gold('Brass', '#d8a850', 0.3)], step=0.002)
    hat = S.union(S.ell((0, 0.43, -0.02), (0.36, 0.25, 0.36)).inter(S.plane((0, -1, 0), -0.4)),
                  S.cyl((0, 0.4, 0.0), 0.41, 0.012, round_=0.01).add(S.ell((0, 0.4, 0.1), (0.42, 0.012, 0.42)), 0.01), k=0.02)
    ridge = S.ell((0, 0.6, -0.02), (0.05, 0.1, 0.3))
    hat = hat.add(ridge.inter(S.ell((0, 0.43, -0.02), (0.38, 0.27, 0.38))), 0.02).rot(-0.12, 0, 0.1, about=(0, 0.4, 0))
    K.build('BrambleHat', hat, (-0.6, 0.3, -0.6), (0.6, 0.85, 0.7), [K.principled('HardHat', '#f2b81c', rough=0.22, coat=0.8, bump=0.03, bump_scale=200)], step=0.004)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


# ------------------------------------------------------------------------------ Zippy
def squirrel():
    """Zippy: a racing squirrel: tufted ears, a huge plume of a tail, a terry headband and a track jacket."""
    C = Char('Zippy', '#7a3610', '#c8641e', '#ec9a4a', length=0.026, align=(0, -0.5, -0.15), clump=0.14)
    head, mu = critter_head((0, 0.2, 0), (0.31, 0.32, 0.3), 0.22, (0.11, 0.085, 0.1), 0.02, 0.28, taper=0.25, cheek_y=0.5)
    C.add(head)
    for sx in (1, -1):
        e, cut = ear((sx * 0.18, 0.42, -0.04), (sx * 0.25, 0.66, -0.06), 0.085, 0.02, thick=0.04)
        C.add(e, 0.04).sub(cut, 0.015)
    body = torso(-0.5, 0.62, 0.28)
    C.add(body, 0.18)
    tail_path = [(0.35, -0.85, -0.45), (0.62, -0.4, -0.5), (0.66, 0.15, -0.42), (0.5, 0.55, -0.32), (0.3, 0.7, -0.3)]
    tail = S.tube(tail_path, 0.12, 0.09, k=0.03)
    C.add(tail, 0.05)
    face_basics(C, 0.1, -0.02, (0.04, 0.028, 0.034), 0.085, 0.05, 0.07, 1.0, '#2a1410')
    C.eye(0.145, 0.25, 0.098, 0.62, '#6a3a18', look=(0.06, 0.0, 1))
    C.region(S.ell((0, 0.03, 0.26), (0.18, 0.13, 0.14)), '#f0dcc0', 0.04, hair='#f6e6cc', tip='#fff6e6', length=0.018)
    C.region(S.ell((0.21, 0.52, 0.0), (0.05, 0.1, 0.1)).mirror(), '#c8641e', 0.02)
    C.region(tail.grow(0.02), '#a8501a', 0.03, hair='#c4601c', tip='#f4a85a', length=0.12, align=(0, 1.2, 0.2), clump=0.45, dens=0.5)
    face_regions(C)
    jacket = garment(body, -0.36, 0.035, (0.3, 0.12))
    C.region(jacket.grow(0.02), '#222222', 0.01)
    C.build()
    mouth_after(C, top_teeth=False)
    teeth = S.union(*[S.box((sx * 0.018, C._mouth[0][1] + 0.0, C._mouth[0][2] + 0.04), (0.016, 0.03, 0.009), 0.006, rot=(0.3, 0, 0)) for sx in (1, -1)])
    K.build('ZippyTeeth', teeth, (-0.1, -0.12, 0.2), (0.1, 0.06, 0.45), [K.glossy('ZippyTooth', '#fdf6e8', 0.14)], step=0.0025)
    # ear tufts
    for sx in (1, -1):
        P = np.array([[sx * (0.25 + 0.012 * np.cos(a)), 0.65 + 0.01 * np.sin(a), -0.06] for a in np.linspace(0, 6.28, 40)])
        N = np.tile([[sx * 0.2, 1.0, 0.0]], (40, 1)); N /= np.linalg.norm(N, axis=1)[:, None]
        K.strands('ZippyTuft%d' % sx, K.groom(P, N, 0.09, (sx * 0.2, 0.8, 0), gravity=-0.2, clumps=3, clump=0.85, jitter=0.2, seed=5), bpy_mat('ZippyHair0'), 0.004, 0.0006)
    K.build('ZippyJacket', jacket, (-0.8, -1.3, -0.6), (0.8, -0.3, 0.6), [K.stripes('ZippyTrack', '#c8141e', '#f6f2ea', 2.2, 'X', knitted=False)], step=0.006)
    zip_ = S.box((0, -0.62, S.surf_z(jacket, 0, -0.62) - 0.01), (0.012, 0.28, 0.01), 0.004)
    hb = S.torus((0, 0.36, -0.02), 0.335, 0.035, rot=(-0.25, 0, 0))
    hb_o = K.build('ZippyBand', hb, (-0.5, 0.2, -0.5), (0.5, 0.6, 0.5), [K.stripes('ZippyTerry', '#d81e2a', '#ffffff', 22, 'Y')], step=0.004)
    K.fuzz(hb_o, '#e8e0dc', 0.004, 9000)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


# ------------------------------------------------------------------------------ Miu
def cat():
    """Miu: the black cat of the Nile: green slit eyes lined in lapis kohl, a gold hoop, a scarab on
    the brow and a broad usekh collar of gold, lapis and carnelian."""
    C = Char('Miu', '#141418', '#1c1c24', '#3a3c4a', length=0.018, align=(0, -0.4, -0.2), clump=0.06, var=0.1)
    head, mu = critter_head((0, 0.2, 0), (0.34, 0.29, 0.3), 0.15, (0.11, 0.08, 0.09), 0.02, 0.27, taper=-0.18)
    C.add(head)
    for sx in (1, -1):
        e, cut = ear((sx * 0.17, 0.4, -0.04), (sx * 0.33, 0.78, -0.06), 0.12, 0.018, thick=0.04, cup=0.65)
        C.add(e, 0.04).sub(cut, 0.015)
    body = torso(-0.5, 0.58, 0.26)
    C.add(body, 0.18)
    face_basics(C, 0.1, -0.0, (0.035, 0.024, 0.03), 0.075, 0.04, 0.06, 1.1, '#3a2a30')
    C.eye(0.145, 0.24, 0.1, 0.6, '#3cb060', tilt=0.05, look=(0.06, 0.0, 1), slit=True)
    C.region(S.ell((0.24, 0.62, 0.02), (0.06, 0.13, 0.04)).mirror(), '#3a2a30', 0.02)
    kohl = S.union(S.ell((0.15, 0.24, 0.2), (0.124, 0.112, 0.16)).sub(S.ell((0.15, 0.24, 0.2), (0.112, 0.1, 0.2))).mirror(),
                   S.tube([(0.26, 0.22, 0.16), (0.32, 0.2, 0.1), (0.36, 0.2, 0.03)], 0.012, 0.005).mirror())
    C.region(kohl, K.enamel('MiuKohl', '#1e3ea8'), 0.008)
    face_regions(C)
    C.build()
    mouth_after(C, top_teeth=False)
    # whiskers
    paths = []
    for sx in (1, -1):
        for j, a in enumerate((-0.12, 0.0, 0.12)):
            p0 = np.array([sx * 0.08, 0.04 - j * 0.02, 0.33])
            pts = [p0 + np.array([sx * 0.3 * t, (a * 0.8 - 0.05 * t) * t, -0.05 * t]) for t in np.linspace(0, 1, 8)]
            paths.append(np.array(pts))
    K.strands('MiuWhiskers', paths, K.principled('Whisker', '#f2f0ea', rough=0.3), 0.0025, 0.0006)
    K.build('MiuHoop', S.torus((0.31, 0.5, 0.0), 0.04, 0.008, rot=(0, 0, 1.4)), (0.2, 0.4, -0.1), (0.4, 0.6, 0.1), [K.gold('MiuGold')], step=0.002)
    bz = S.surf_z(C.shape, 0, 0.42)
    scarab = S.union(S.ell((0, 0.43, bz), (0.035, 0.045, 0.02)), S.ell((0, 0.385, bz - 0.005), (0.022, 0.015, 0.014)), k=0.006)
    K.build('MiuScarab', scarab, (-0.1, 0.33, bz - 0.1), (0.1, 0.5, bz + 0.1), [K.enamel('MiuScarabBlue', '#1a6ab8')], step=0.002)
    K.build('MiuScarabGold', S.ell((0, 0.43, bz - 0.004), (0.045, 0.055, 0.02)).shell(0.004).inter(S.plane((0, 0, -1), -bz + 0.002)), (-0.1, 0.33, bz - 0.1), (0.1, 0.5, bz + 0.1), [bpy_mat('MiuGold')], step=0.002)
    rings = [('#e8b850', 0.0), ('#1e3ea8', 0.05), ('#e8b850', 0.1), ('#c0402a', 0.14), ('#e8b850', 0.19), ('#2aa6a0', 0.23), ('#e8b850', 0.28)]
    for j, (col, off) in enumerate(rings):
        band = body.grow(0.02 + j * 0.002).inter(S.plane((0, 1, 0), -0.3 - off)).inter(S.plane((0, -1, 0), 0.3 + off + 0.045))
        mat = K.gold('MiuG%d' % j, col) if col == '#e8b850' else K.enamel('MiuE%d' % j, col)
        K.build('MiuCollar%d' % j, band.bump(0.003, 60, j), (-0.8, -0.75, -0.6), (0.8, -0.2, 0.6), [mat], step=0.004)
    return (0.55, 0.12, 3.9), (0, 0.04, 0), 76


# ------------------------------------------------------------------------------ Marcus
def wolf():
    """Marcus: the Roman wolf: a gold laurel crown, a scarlet cloak and a gold brooch."""
    C = Char('Marcus', '#3c3e46', '#6e727e', '#a8acb6', length=0.03, align=(0, -0.5, -0.2), clump=0.18)
    head = S.union(S.ell((0, 0.24, 0), (0.33, 0.3, 0.3)), S.ell((0.2, 0.05, 0.08), (0.16, 0.15, 0.17)).mirror(),
                   S.cone((0, 0.1, 0.2), (0, 0.0, 0.42), 0.14, 0.09), S.ell((0, -0.06, 0.3), (0.1, 0.07, 0.1)), k=0.09)
    C.add(head)
    for sx in (1, -1):
        e, cut = ear((sx * 0.17, 0.44, -0.06), (sx * 0.28, 0.76, -0.08), 0.11, 0.02, thick=0.045, cup=0.62)
        C.add(e, 0.04).sub(cut, 0.015)
    body = torso(-0.5, 0.66, 0.3)
    C.add(body, 0.18)
    face_basics(C, 0.03, -0.09, (0.05, 0.034, 0.04), 0.1, 0.05, 0.08, 1.0, '#141414')
    C.eye(0.14, 0.27, 0.088, 0.6, '#c88a2a', look=(0.06, 0.0, 1))
    C.region(S.ell((0, -0.04, 0.26), (0.2, 0.13, 0.2)), '#e0dcd4', 0.04, hair='#ece8e0', tip='#ffffff', length=0.02)
    C.region(S.ell((0.2, 0.02, 0.12), (0.12, 0.12, 0.16)).mirror(), '#e0dcd4', 0.04, hair='#ece8e0', tip='#ffffff', length=0.05, align=(0.8, -0.6, 0.1), clump=0.4)
    C.region(S.ell((0.25, 0.62, 0.0), (0.05, 0.12, 0.08)).mirror(), '#1a1a1e', 0.02, hair='#2a2a30', length=0.02)
    face_regions(C)
    cloak = garment(body, -0.34, 0.045, (0.32, 0.18))
    C.region(cloak.grow(0.02), '#222222', 0.01)
    C.build()
    mouth_after(C)
    K.build('MarcusCloak', cloak.bump(0.012, 8, 4), (-0.85, -1.3, -0.7), (0.85, -0.25, 0.6), [K.velvet('MarcusScarlet', '#a8141c')], step=0.006)
    tunic = body.grow(0.02).inter(S.plane((0, 1, 0), -0.36)).inter(S.plane((0, 0, -1), -0.05))
    K.build('MarcusTunic', tunic, (-0.4, -1.3, -0.2), (0.4, -0.3, 0.6), [K.principled('MarcusLinen', '#efe6d4', rough=0.7, sheen=0.3, bump=0.1, bump_scale=600)], step=0.006)
    bc = (0.3, -0.42, S.surf_z(cloak, 0.3, -0.42) - 0.01)
    K.build('MarcusBrooch', S.cyl(bc, 0.07, 0.015, rot=(1.35, 0, 0), round_=0.01).add(S.torus(bc, 0.07, 0.012, rot=(1.35, 0, 0)), 0.005), (0.15, -0.6, bc[2] - 0.1), (0.45, -0.25, bc[2] + 0.1), [K.gold('MarcusGold')], step=0.002)
    K.build('MarcusGem', S.ell((bc[0], bc[1], bc[2] + 0.012), (0.03, 0.03, 0.02)), (0.15, -0.6, bc[2] - 0.1), (0.45, -0.25, bc[2] + 0.1), [K.gem('MarcusRuby', '#c0102a')], step=0.002)
    ring = [(0.33 * math.sin(a), 0.47 + 0.05 * math.cos(a) - 0.02, 0.33 * math.cos(a) - 0.02) for a in np.linspace(-2.4, 2.4, 13)]
    K.build('MarcusLaurel', S.union(leaves(ring, 34, 0.05, 0.7, 1), S.tube(ring, 0.01, 0.01)), (-0.5, 0.3, -0.5), (0.5, 0.7, 0.5), [K.gold('MarcusLeaf', '#e0b048', 0.28)], step=0.003)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


# ------------------------------------------------------------------------------ Mishka
def bear():
    """Mishka: a Russian bear in a tall fur hat with a green velvet crown, a frogged green coat
    with gold braid and a little jewelled egg."""
    C = Char('Mishka', '#3a2010', '#6e4222', '#a06a3a', length=0.032, align=(0, -0.5, -0.1), clump=0.16)
    head, mu = critter_head((0, 0.2, 0), (0.44, 0.31, 0.34), 0.17, (0.18, 0.12, 0.17), 0.0, 0.34, taper=-0.12)
    C.add(head)
    C.add(S.ell((0.3, 0.44, -0.04), (0.1, 0.09, 0.06)).mirror(), 0.04)
    body = torso(-0.5, 0.74, 0.34)
    C.add(body, 0.18)
    face_basics(C, 0.1, -0.03, (0.065, 0.042, 0.045), 0.11, 0.06, 0.08, 0.9, '#1a0e08')
    C.eye(0.13, 0.27, 0.074, 0.6, '#7a4a20', look=(0.06, 0.0, 1))
    C.region(S.ell((0, 0.03, 0.27), (0.21, 0.15, 0.14)), '#b88a5a', 0.04, hair='#c89a68', tip='#e0b888', length=0.02)
    face_regions(C)
    coat = garment(body, -0.36, 0.045)
    C.region(coat.grow(0.02), '#222222', 0.01)
    C.build()
    mouth_after(C)
    K.build('MishkaCoat', coat, (-0.85, -1.3, -0.7), (0.85, -0.25, 0.6), [K.velvet('MishkaGreen', '#0e5a3a')], step=0.006)
    braids = []
    for y in (-0.5, -0.62, -0.74, -0.86):
        z = S.surf_z(coat, 0.0, y)
        braids.append(S.tube([(-0.2, y, S.surf_z(coat, -0.2, y) - 0.004), (0, y + 0.01, z - 0.002), (0.2, y, S.surf_z(coat, 0.2, y) - 0.004)], 0.012, 0.012))
        for sx in (1, -1):
            braids.append(S.torus((sx * 0.22, y, S.surf_z(coat, sx * 0.22, y) - 0.004), 0.025, 0.008, rot=(1.45, 0, 0)))
    K.build('MishkaBraid', S.union(*braids), (-0.4, -1.0, 0.0), (0.4, -0.4, 0.7), [K.gold('MishkaGold')], step=0.0025)
    # tall fur hat (papakha) with a velvet top and a gold cross braid
    hat = S.cyl((0, 0.52, -0.03), 0.34, 0.15, round_=0.08).rot(-0.12, 0, 0, about=(0, 0.45, 0))
    hat_o = K.build('MishkaHat', hat, (-0.6, 0.25, -0.6), (0.6, 0.85, 0.6), [K.skin('MishkaHatSkin', '#2a1a10')], step=0.005)
    hat_o.data.materials.append(K.hair_mat('MishkaHatFur', '#4a3020', '#8a6a50', var=0.25))
    K.vgroup(hat_o, 'fur', np.ones(len(hat_o.data.vertices)))
    K.fur(hat_o, 'fur', 'MishkaHatFur', length=0.05, count=26000, children=7, align=(0, -0.2, 0), clump=0.5, root=0.003, rough=0.006, seed=7)
    top = S.ell((0, 0.68, -0.05), (0.26, 0.07, 0.26)).rot(-0.12, 0, 0, about=(0, 0.45, 0))
    K.build('MishkaCrown', top, (-0.5, 0.55, -0.5), (0.5, 0.85, 0.5), [K.velvet('MishkaCrownVelvet', '#1a6a44')], step=0.004)
    cross = S.union(S.tube([(-0.25, 0.7, -0.05), (0, 0.76, -0.05), (0.25, 0.7, -0.05)], 0.012, 0.012), S.tube([(0, 0.7, -0.3), (0, 0.76, -0.05), (0, 0.7, 0.2)], 0.012, 0.012)).rot(-0.12, 0, 0, about=(0, 0.45, 0))
    K.build('MishkaCross', cross, (-0.5, 0.55, -0.5), (0.5, 0.9, 0.5), [bpy_mat('MishkaGold')], step=0.003)
    ec = (-0.22, -0.56, S.surf_z(coat, -0.22, -0.56) + 0.01)
    egg = S.ell(ec, (0.05, 0.065, 0.045))
    K.build('MishkaEgg', egg, (-0.4, -0.7, ec[2] - 0.1), (-0.1, -0.4, ec[2] + 0.1), [K.enamel('MishkaEnamel', '#2a5ac8')], step=0.002)
    lattice = S.union(*[S.ell(ec, (0.053, 0.068, 0.048)).shell(0.003).inter(S.plane((0, 1, 0), ec[1] + d).inter(S.plane((0, -1, 0), -(ec[1] + d) + 0.008))) for d in (-0.03, 0.0, 0.03)])
    K.build('MishkaLattice', lattice, (-0.4, -0.7, ec[2] - 0.1), (-0.1, -0.4, ec[2] + 0.1), [bpy_mat('MishkaGold')], step=0.0015)
    return (0.55, 0.15, 3.9), (0, 0.04, 0), 74


# ------------------------------------------------------------------------------ Marco
def lion():
    """Marco: the winged lion of Saint Mark: a great russet mane, a gold halo, wings at his back,
    a blue velvet coat with a gold collar."""
    C = Char('Marco', '#8a5a20', '#d8a04a', '#f0c878', length=0.02, align=(0, -0.5, -0.1), clump=0.1)
    head, mu = critter_head((0, 0.2, 0), (0.35, 0.31, 0.31), 0.22, (0.21, 0.13, 0.13), 0.0, 0.3, taper=0.1)
    C.add(head)
    C.add(S.ell((0.27, 0.43, -0.04), (0.07, 0.065, 0.045)).mirror(), 0.04)
    body = torso(-0.5, 0.7, 0.3)
    C.add(body, 0.18)
    face_basics(C, 0.1, -0.03, (0.055, 0.038, 0.04), 0.1, 0.055, 0.08, 0.95, '#6a3a2a')
    C.eye(0.145, 0.25, 0.09, 0.6, '#b07a20', look=(0.06, 0.0, 1))
    C.region(S.ell((0, 0.02, 0.27), (0.2, 0.15, 0.14)), '#f0dcb0', 0.04, hair='#f8ead0', tip='#fff8ea', length=0.016)
    mane_zone = S.ell((0, 0.16, -0.05), (0.5, 0.48, 0.4)).inter(S.F(lambda P: P[:, 2] - 0.06 + 0.25 * np.clip(0.1 - P[:, 1], 0, 1)), 0.04)
    mane_i = C.region(mane_zone, '#7a3a14', 0.04)
    face_regions(C)
    coat = garment(body, -0.36, 0.045, (0.3, 0.14))
    C.region(coat.grow(0.02), '#222222', 0.01)
    C.build()
    mouth_after(C)
    mane_m = K.hair_mat('MarcoMane', '#a8541c', '#e8a050', rough=0.3, var=0.2)
    P, N = K.sample_surface(C.o, C.W[:, mane_i], 7000, seed=4)
    out = N * np.array([1.0, 0.6, 0.4])
    K.strands('MarcoMane', K.groom(P, N, 0.24, (0, -0.1, -0.15), gravity=0.6, lift=1.2, clumps=140, clump=0.7, jitter=0.25, seed=4, curl=0.12), mane_m, 0.006, 0.001, normals=N)
    K.build('MarcoCoat', coat, (-0.85, -1.3, -0.7), (0.85, -0.25, 0.6), [K.velvet('MarcoBlue', '#173a92')], step=0.006)
    shirt = body.grow(0.02).inter(S.plane((0, 1, 0), -0.36)).inter(S.plane((0, 0, -1), -0.05))
    K.build('MarcoShirt', shirt, (-0.4, -1.3, -0.2), (0.4, -0.3, 0.6), [K.principled('MarcoLinen', '#f4ecdc', rough=0.6, bump=0.05)], step=0.006)
    col = S.torus((0, -0.36, -0.05), 0.36, 0.03, rot=(0.25, 0, 0)).add(S.cyl((0, -0.4, -0.05), 0.37, 0.04, rot=(0.25, 0, 0)).shell(0.01), 0.008)
    K.build('MarcoCollar', col, (-0.6, -0.6, -0.6), (0.6, -0.2, 0.6), [K.gold('MarcoGold')], step=0.004)
    K.build('MarcoHalo', S.torus((0, 0.36, -0.45), 0.5, 0.022, rot=(1.5, 0, 0)), (-0.7, -0.3, -0.6), (0.7, 1.0, -0.3), [bpy_mat('MarcoGold')], step=0.004)
    feathers, tips = [], []
    for sx in (1, -1):
        for row, (n, L, z) in enumerate(((9, 0.62, -0.42), (7, 0.42, -0.38), (6, 0.26, -0.34))):
            for j in range(n):
                a = 0.15 + j * (1.25 / n)
                base = np.array([sx * 0.38, -0.32, z])
                tip = base + np.array([sx * math.cos(a) * L, math.sin(a) * L * 1.1 + 0.05, -0.04])
                f = squash(S.cone(base, tip, 0.055 - row * 0.008, 0.012), tuple((base + tip) / 2), 1, 1, 0.28)
                feathers.append(f)
                if row == 0:
                    tips.append(squash(S.cone(base + (tip - base) * 0.82, tip, 0.04, 0.012), tuple(tip), 1, 1, 0.3).grow(0.003))
    K.build('MarcoWings', S.union(*feathers, k=0.006), (-1.1, -0.5, -0.6), (1.1, 0.75, -0.1), [K.principled('MarcoFeather', '#f4ead6', rough=0.5, sheen=0.7, sss=0.3, bump=0.2, bump_scale=300)], step=0.0045)
    K.build('MarcoWingTips', S.union(*tips), (-1.1, -0.5, -0.6), (1.1, 0.75, -0.1), [bpy_mat('MarcoGold')], step=0.0035)
    return (0.55, 0.12, 4.1), (0, 0.04, 0), 72


# ------------------------------------------------------------------------------ Moti
def elephant():
    """Moti: a Mughal elephant with big soft ears, a trunk curled up in greeting, small tusks,
    a jewelled gold headpiece with pearls and a green saddle cloth edged in gold."""
    C = Char('Moti', '#8e8a92', '#8e8a92', length=0.006, align=(0, -0.3, 0), clump=0.0, rough=0.62, sss=0.1)
    C.mats[0] = K.principled('MotiSkin', '#686470', rough=0.65, sss=0.12, bump=0.45, bump_scale=38)
    C.furs = []
    head = S.union(S.ell((0, 0.24, 0), (0.36, 0.34, 0.33)), S.ell((0.2, 0.02, 0.1), (0.16, 0.16, 0.17)).mirror(), k=0.1)
    trunk = S.tube([(0, 0.14, 0.26), (0, -0.05, 0.36), (0.02, -0.25, 0.42), (0.1, -0.34, 0.5), (0.2, -0.28, 0.56), (0.22, -0.16, 0.56)], 0.1, 0.045, k=0.03)
    C.add(head).add(trunk, 0.08)
    C.sub(S.sphere((0.22, -0.16, 0.6), 0.03), 0.01)
    for sx in (1, -1):
        e = squash(S.ell((sx * 0.48, 0.16, -0.08), (0.26, 0.3, 0.06), rot=(0, sx * 0.4, sx * 0.15)), (sx * 0.48, 0.16, -0.08), 1, 1, 1)
        C.add(e, 0.06)
    body = torso(-0.5, 0.76, 0.34)
    C.add(body, 0.18)
    mc = (0, -0.1, S.surf_z(C.shape, 0.0, -0.12) - 0.06)
    cav, corners = smile((0, -0.12, mc[2] - 0.05), 0.1, 0.045, 0.07, 1.0)
    C.sub(cav, 0.01)
    C.eye(0.17, 0.25, 0.08, 0.58, '#8a5a30', look=(0.06, 0.0, 1))
    C.region(S.ell((0.5, 0.16, 0.0), (0.2, 0.24, 0.06), rot=(0, 0.4, 0.15)).mirror(), '#d8a0a0', 0.03)
    C.region(cav.grow(0.006), '#8a2e3a', 0.006)
    cloth = garment(body, -0.42, 0.04)
    C.region(cloth.grow(0.02), '#222222', 0.01)
    C.build(bump=0.002)
    hp = (0, 0.42, S.surf_z(C.shape, 0, 0.42) - 0.02)
    plate = S.ell(hp, (0.12, 0.13, 0.04)).inter(S.plane((0, 0, -1), -(hp[2] - 0.005)))
    K.build('MotiPlate', plate, (-0.3, 0.2, hp[2] - 0.15), (0.3, 0.65, hp[2] + 0.15), [K.gold('MotiGold')], step=0.0025)
    K.build('MotiRuby', S.ell((0, 0.43, hp[2] + 0.04), (0.04, 0.05, 0.025)), (-0.1, 0.3, hp[2] - 0.05), (0.1, 0.55, hp[2] + 0.12), [K.gem('MotiRubyGem', '#c80c34')], step=0.002)
    pearls = []
    for j, a in enumerate(np.linspace(-1.1, 1.1, 15)):
        x, y = 0.3 * math.sin(a), 0.5 - 0.1 * math.cos(a) * 0 + 0.0
        y = 0.47 - 0.12 * (1 - math.cos(a))
        pearls.append(S.sphere((x, y, S.surf_z(C.shape, x, y) - 0.0), 0.02))
    K.build('MotiPearls', S.union(*pearls), (-0.5, 0.2, -0.3), (0.5, 0.6, 0.6), [K.pearl('MotiPearl')], step=0.002)
    for sx in (1, -1):
        K.build('MotiTusk%d' % sx, S.tube([(sx * 0.1, -0.12, 0.3), (sx * 0.14, -0.22, 0.38), (sx * 0.15, -0.26, 0.47)], 0.03, 0.012), (sx * 0.1 - 0.15, -0.35, 0.2), (sx * 0.1 + 0.15, -0.05, 0.55), [K.glossy('Ivory', '#f4ecd8', 0.25)], step=0.003)
    K.build('MotiCloth', cloth, (-0.9, -1.3, -0.7), (0.9, -0.3, 0.6), [K.velvet('MotiGreen', '#0e6a46')], step=0.006)
    edge = cloth.grow(0.006).inter(S.plane((0, 1, 0), -0.42)).inter(S.plane((0, -1, 0), 0.5))
    K.build('MotiEdge', edge, (-0.9, -0.7, -0.7), (0.9, -0.3, 0.6), [bpy_mat('MotiGold')], step=0.004)
    return (0.55, 0.12, 4.1), (0, 0.0, 0), 72


# ------------------------------------------------------------------------------ Ivy
def giraffe():
    """Ivy: a giraffe with patches, ossicones with dark tufts, and round gold spectacles."""
    C = Char('Ivy', '#a8762a', '#e6b452', '#f4d488', length=0.016, align=(0, -0.6, -0.1), clump=0.06)
    head = S.union(S.ell((0, 0.3, -0.02), (0.29, 0.27, 0.27)), S.cone((0, 0.2, 0.12), (0, 0.02, 0.3), 0.19, 0.16),
                   S.ell((0, -0.02, 0.32), (0.18, 0.13, 0.15)), k=0.1)
    C.add(head)
    neck = S.cone((0, 0.1, -0.12), (0, -0.9, -0.15), 0.2, 0.3)
    C.add(neck, 0.1).add(S.ell((0, -1.15, -0.1), (0.65, 0.35, 0.4)), 0.15)
    ossi = S.union(*[S.cone((sx * 0.11, 0.48, -0.08), (sx * 0.14, 0.7, -0.1), 0.035, 0.03) for sx in (1, -1)])
    knobs = S.sphere((0.145, 0.71, -0.1), 0.05).mirror()
    C.add(ossi, 0.03).add(knobs, 0.02)
    for sx in (1, -1):
        e = squash(S.ell((sx * 0.32, 0.42, -0.06), (0.13, 0.05, 0.05), rot=(0, 0, sx * 0.35)), (sx * 0.32, 0.42, -0.06), 1, 1, 0.8)
        C.add(e, 0.04)
    nz = S.surf_z(C.shape, 0.07, 0.0)
    C.sub(S.ell((0.07, 0.0, nz), (0.022, 0.035, 0.03), rot=(0.4, 0, 0.3)).mirror(), 0.01)
    mc = (0, -0.1, S.surf_z(C.shape, 0, -0.1) - 0.035)
    cav, corners = smile(mc, 0.1, 0.045, 0.07, 1.0)
    C.sub(cav, 0.012).sub(corners, 0.01)
    C._mouth = (mc, 0.1, 0.045, 0.07, 1.0, cav)
    C.eye(0.15, 0.27, 0.088, 0.62, '#7a4a22', look=(0.06, 0.0, 1))
    rng = np.random.default_rng(11)
    pts = [p for p in rng.uniform([-0.5, -1.4, -0.5], [0.5, 0.5, 0.5], (260, 3))]
    def patches(P, pts=np.array(pts)):
        d1 = np.full(len(P), 9.0); d2 = np.full(len(P), 9.0)
        for q in pts:
            d = np.linalg.norm((P - q) * np.array([1, 0.8, 1]), axis=1)
            d2 = np.minimum(d2, np.maximum(d1, d)); d1 = np.minimum(d1, d)
        return 0.012 - (d2 - d1)
    face_zone = S.ell((0, 0.05, 0.28), (0.22, 0.25, 0.2))
    C.region(S.F(patches).sub(face_zone, 0.05).sub(S.ell((0, 0.65, -0.1), (0.25, 0.12, 0.2))), '#8a4a1a', 0.01, hair='#94501c', tip='#b06a2a', length=0.016)
    C.region(S.ell((0, -0.04, 0.32), (0.2, 0.15, 0.17)), '#e8cc9a', 0.03, hair='#f0d8a8', tip='#fbe8c4', length=0.012)
    C.region(knobs.grow(0.02), '#2a1a10', 0.02, hair='#2a1a10', tip='#5a3a20', length=0.05, align=(0, 1, 0), clump=0.5)
    C.region(cav.grow(0.006), '#8a2e3a', 0.006)
    C.build()
    mouth_after(C)
    # round gold spectacles resting on the nose
    ecs = C.eyes[0][0]
    rims = []
    for sx in (1, -1):
        c = (ecs[0] * sx, ecs[1] - 0.005, ecs[2] + C.eyes[0][1] + 0.03)
        rims.append(S.torus(c, 0.105, 0.009, rot=(math.pi / 2, 0, 0)))
    bridge = S.tube([(-0.05, ecs[1] + 0.02, ecs[2] + 0.13), (0, ecs[1] + 0.04, ecs[2] + 0.14), (0.05, ecs[1] + 0.02, ecs[2] + 0.13)], 0.007, 0.007)
    arms = S.union(*[S.tube([(sx * (ecs[0] + 0.1), ecs[1], ecs[2] + 0.11), (sx * 0.3, ecs[1] + 0.02, 0.0), (sx * 0.31, ecs[1] + 0.0, -0.15)], 0.006, 0.006) for sx in (1, -1)])
    K.build('IvySpecs', S.union(*rims, bridge, arms), (-0.5, 0.0, -0.3), (0.5, 0.5, 0.6), [K.gold('IvyGold')], step=0.0022)
    lens = S.union(*[S.cyl((ecs[0] * sx, ecs[1] - 0.005, ecs[2] + C.eyes[0][1] + 0.03), 0.1, 0.003, rot=(math.pi / 2, 0, 0)) for sx in (1, -1)])
    K.build('IvyLens', lens, (-0.5, 0.0, -0.3), (0.5, 0.5, 0.6), [K.principled('IvyGlass', '#ffffff', rough=0.0, transmission=1.0, ior=1.3)], step=0.002)
    return (0.55, 0.15, 4.2), (0, 0.0, 0), 70


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


# ------------------------------------------------------------------------------ Onyx
def raven():
    """Onyx: a raven with blue-violet sheen on black feathers, a gold monocle on a chain and a
    violet silk cravat."""
    C = Char('Onyx', '#08080c', '#101218', '#2a3150', length=0.032, align=(0, -0.7, -0.3), clump=0.5, var=0.12)
    body = bird(C, (0, 0.22, -0.02), (0.28, 0.27, 0.32), 0.66, 0.3)
    C.eye(0.15, 0.27, 0.088, 0.62, '#4a3a6a', look=(0.06, 0.0, 1))
    bc = (0, 0.14, S.surf_z(C.shape, 0, 0.14) - 0.06)
    up, lo = beak(bc, 0.44, 0.115, 0.1, 0.09, 0.05)
    C.build()
    K.build('OnyxBeak', up.add(lo, 0.01), (-0.2, -0.1, 0.0), (0.2, 0.3, 0.75), [K.glossy('OnyxHorn', '#3a3a46', 0.2)], step=0.003)
    # a swept crest of glossy feathers on the crown
    P, N = K.sample_surface(C.o, C.weight(S.ell((0, 0.5, 0.0), (0.12, 0.08, 0.16))), 500, seed=6)
    P, N = K.sample_surface(C.o, C.weight(S.ell((0, -0.02, 0.18), (0.18, 0.12, 0.14))), 900, seed=9)
    K.strands('OnyxHackles', K.groom(P, N, 0.1, (0, -1.0, 0.3), gravity=0.6, lift=0.5, clumps=26, clump=0.85, jitter=0.2, seed=9), bpy_mat('OnyxHair0'), 0.004, 0.0008, normals=N)
    K.strands('OnyxCrest', K.groom(P, N, 0.14, (0.0, 0.4, -1.0), gravity=-0.3, lift=0.8, clumps=7, clump=0.85, jitter=0.15, seed=6), bpy_mat('OnyxHair0'), 0.006, 0.001, normals=N)
    K.build('OnyxGape', S.tube([(0.07, 0.08, bc[2] + 0.02), (0.1, 0.1, bc[2] - 0.02), (0.125, 0.135, bc[2] - 0.06)], 0.012, 0.008).mirror(), (-0.3, 0.0, 0.0), (0.3, 0.25, 0.5), [K.skin('OnyxGapeSkin', '#5a4a40')], step=0.003)
    e = C.eyes[0]
    mc = (-e[0][0], e[0][1], e[0][2] + e[1] + 0.02)
    K.build('OnyxMonocle', S.torus(mc, 0.11, 0.011, rot=(math.pi / 2, 0, 0)), (-0.35, 0.1, 0.1), (0.05, 0.45, 0.5), [K.gold('OnyxGold')], step=0.0022)
    K.build('OnyxLens', S.cyl(mc, 0.105, 0.003, rot=(math.pi / 2, 0, 0)), (-0.35, 0.1, 0.1), (0.05, 0.45, 0.5), [K.principled('OnyxGlass', '#ffffff', rough=0.0, transmission=1.0, ior=1.3)], step=0.002)
    chain = [(mc[0] - 0.08, mc[1] - 0.08, mc[2] - 0.02), (-0.24, 0.0, 0.3), (-0.26, -0.2, 0.3), (-0.2, -0.38, 0.32)]
    K.build('OnyxChain', S.tube(chain, 0.006, 0.006), (-0.4, -0.5, 0.0), (0.0, 0.3, 0.6), [bpy_mat('OnyxGold')], step=0.002)
    ruffles = [S.ell((0, -0.44 - j * 0.07, 0.27 + j * 0.012), (0.12 - j * 0.012, 0.045, 0.05)).bump(0.01, 40, j) for j in range(5)]
    cravat = S.union(S.torus((0, -0.36, -0.06), 0.3, 0.05, rot=(0.25, 0, 0)), *ruffles, k=0.02)
    K.build('OnyxCravat', cravat, (-0.5, -0.8, -0.5), (0.5, -0.2, 0.6), [K.silk('OnyxViolet', '#5a2a8a')], step=0.004)
    K.build('OnyxPin', S.sphere((0, -0.42, S.surf_z(cravat, 0, -0.42) - 0.005), 0.022), (-0.1, -0.5, 0.1), (0.1, -0.3, 0.5), [K.pearl('OnyxPearl')], step=0.002)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


# ------------------------------------------------------------------------------ Sophie
def owl():
    """Sophie: the owl of Athens: a pale facial disc, great amber eyes, ear tufts and a laurel wreath."""
    C = Char('Sophie', '#5a3a1e', '#8a6038', '#c89a62', length=0.03, align=(0, -0.7, -0.2), clump=0.45, var=0.2)
    body = bird(C, (0, 0.18, 0), (0.43, 0.33, 0.27), 0.72, 0.4)
    C.eye(0.17, 0.22, 0.125, 0.56, '#e8a020', look=(0.06, 0.0, 1), iris_r=0.8, pupil_r=0.36)
    disc = S.union(*[S.ell((sx * 0.17, 0.2, 0.22), (0.19, 0.18, 0.13)) for sx in (1, -1)], k=0.05)
    C.region(disc.grow(0.03), '#4a2a14', 0.02, hair='#5a3418', tip='#7a4a26', length=0.024, clump=0.3)
    C.region(disc, '#e8d4b0', 0.04, hair='#f2e2c4', tip='#fff4e0', length=0.022, align=(0, 0, 0.5), clump=0.3)
    C.region(S.ell((0, -0.75, 0.2), (0.4, 0.35, 0.2)), '#e8d4b0', 0.05, hair='#ead6b2', tip='#fbf0dc', length=0.03, clump=0.5)
    # folded wings at her sides, darker, with barred flight feathers
    wings = S.union(*[squash(S.ell((sx * 0.5, -0.72, -0.02), (0.2, 0.42, 0.24), rot=(0.15, 0, sx * -0.25)), (sx * 0.5, -0.72, -0.02), 1, 1, 0.8) for sx in (1, -1)])
    C.add(wings, 0.05)
    C.region(wings.grow(0.02), '#3a2412', 0.03, hair='#5a3a1c', tip='#c8a070', length=0.04, clump=0.7)
    bc = (0, 0.15, S.surf_z(C.shape, 0, 0.15) - 0.03)
    up, lo = beak(bc, 0.17, 0.06, 0.06, 0.05, 0.05)
    C.build()
    K.build('SophieBeak', up.add(lo, 0.008), (-0.15, 0.0, 0.1), (0.15, 0.3, 0.6), [K.glossy('SophieHorn', '#c8a060', 0.3)], step=0.0025)
    for sx in (1, -1):
        P = np.array([[sx * (0.24 + 0.05 * t), 0.44 + 0.02 * t, 0.02 + 0.03 * np.sin(a)] for t, a in zip(np.random.default_rng(1).random(80), np.linspace(0, 12, 80))])
        N = np.tile([[sx * 0.5, 1.0, 0.0]], (80, 1)); N /= np.linalg.norm(N, axis=1)[:, None]
        K.strands('SophieTuft%d' % sx, K.groom(P, N, 0.14, (sx * 0.4, 0.6, -0.1), gravity=-0.1, clumps=4, clump=0.85, jitter=0.15, seed=sx + 3), bpy_mat('SophieHair0'), 0.005, 0.0008)
    ring = [(0.36 * math.sin(a), 0.44 - 0.03 * math.cos(a), 0.31 * math.cos(a) - 0.02) for a in np.linspace(-2.3, 2.3, 13)]
    K.build('SophieLaurel', leaves(ring, 30, 0.055, 0.7, 2), (-0.5, 0.25, -0.5), (0.5, 0.7, 0.5), [K.principled('SophieLeaf', '#5a8a30', rough=0.35, sss=0.2, coat=0.3)], step=0.003)
    K.build('SophieTwig', S.tube(ring, 0.01, 0.01), (-0.5, 0.25, -0.5), (0.5, 0.7, 0.5), [K.gold('SophieGold')], step=0.003)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


# ------------------------------------------------------------------------------ Gaston
def rooster():
    """Gaston: a Parisian rooster: white feathers, a red comb and wattles, a black beret, a blue
    coat with a tricolour rosette, and a sweep of green tail feathers behind."""
    C = Char('Gaston', '#d8d2c8', '#f6f2ea', '#ffffff', length=0.03, align=(0, -0.7, -0.2), clump=0.45, var=0.06)
    body = bird(C, (0, 0.2, 0), (0.3, 0.3, 0.29), 0.64, 0.3)
    C.eye(0.14, 0.26, 0.085, 0.62, '#c86a1a', look=(0.06, 0.0, 1))
    bc = (0, 0.15, S.surf_z(C.shape, 0, 0.15) - 0.04)
    up, lo = beak(bc, 0.18, 0.06, 0.06, 0.04, 0.0)
    coat = garment(body, -0.36, 0.045, (0.3, 0.14))
    C.region(coat.grow(0.02), '#222222', 0.01)
    comb_c = S.union(*[S.ell((0, 0.5 + 0.06 * math.cos(j - 2), -0.1 + j * 0.07), (0.035, 0.09, 0.05)) for j in range(5)], k=0.03)
    C.region(comb_c.grow(0.04), '#c81e28', 0.03)
    C.build()
    K.build('GastonComb', comb_c.add(S.ell((0, 0.45, 0.0), (0.04, 0.05, 0.2)), 0.03), (-0.2, 0.35, -0.3), (0.2, 0.75, 0.35), [K.skin('GastonRed', '#d01a26', 0.32, 0.5)], step=0.003)
    K.build('GastonWattle', S.ell((0.03, 0.0, bc[2] + 0.02), (0.035, 0.07, 0.04)).mirror().add(S.ell((0, 0.04, bc[2] + 0.0), (0.05, 0.03, 0.03)), 0.02), (-0.15, -0.15, 0.0), (0.15, 0.2, 0.6), [bpy_mat('GastonRed')], step=0.003)
    K.build('GastonBeak', up.add(lo, 0.008), (-0.15, -0.05, 0.0), (0.15, 0.3, 0.6), [K.glossy('GastonHorn', '#f0b030', 0.25)], step=0.0025)
    K.build('GastonCoat', coat, (-0.85, -1.3, -0.7), (0.85, -0.25, 0.6), [K.velvet('GastonBlue', '#1a3a8a')], step=0.006)
    shirt = body.grow(0.02).inter(S.plane((0, 1, 0), -0.36)).inter(S.plane((0, 0, -1), -0.05))
    K.build('GastonShirt', shirt, (-0.4, -1.3, -0.2), (0.4, -0.3, 0.6), [K.principled('GastonLinen', '#f6f2ea', rough=0.6, bump=0.05)], step=0.006)
    rc = (-0.3, -0.5, S.surf_z(coat, -0.3, -0.5))
    for j, (col, r) in enumerate((('#1a3aa0', 0.075), ('#ffffff', 0.052), ('#d0182a', 0.03))):
        K.build('GastonRosette%d' % j, S.cyl((rc[0], rc[1], rc[2] + 0.008 + j * 0.006), r, 0.008, rot=(1.4, 0, 0), round_=0.006).bump(0.004, 120, j),
                (-0.5, -0.7, rc[2] - 0.1), (-0.1, -0.3, rc[2] + 0.1), [K.silk('GastonRib%d' % j, col)], step=0.002)
    beret = S.ell((0.06, 0.5, -0.02), (0.36, 0.09, 0.34)).rot(0, 0, -0.25, about=(0.06, 0.45, 0))
    stalk = S.cone((0.0, 0.58, -0.02), (-0.02, 0.63, -0.02), 0.012, 0.006).rot(0, 0, -0.25, about=(0.06, 0.45, 0))
    b = K.build('GastonBeret', beret.add(stalk, 0.01), (-0.5, 0.3, -0.5), (0.6, 0.8, 0.5), [K.principled('GastonFelt', '#141418', rough=0.9, sheen=0.6)], step=0.004)
    K.fuzz(b, '#202024', 0.004, 12000)
    tails = []
    for j in range(6):
        a = 0.6 + j * 0.28
        base = np.array([0.15, -0.55, -0.4])
        tip = base + np.array([0.75 * math.cos(a) + 0.2, 0.75 * math.sin(a), -0.1])
        mid = (base + tip) / 2 + np.array([0.15, 0.12, 0])
        tails.append(squash(S.tube([base, mid, tip], 0.06, 0.015), tuple(mid), 1, 1, 0.35))
    K.build('GastonTail', S.union(*tails, k=0.02), (-0.4, -0.8, -0.8), (1.0, 0.7, -0.1), [K.principled('GastonPlume', '#0e5a48', rough=0.25, coat=0.5, sheen=0.4)], step=0.005)
    return (0.55, 0.12, 4.0), (0, 0.04, 0), 74


# ------------------------------------------------------------------------------ Skye
def eagle():
    """Skye: a New York eagle: white head, brown body, a strong yellow beak, aviator goggles up on
    the brow, a white silk scarf and a leather flying jacket with a fleece collar."""
    C = Char('Skye', '#d8d4cc', '#f4f2ec', '#ffffff', length=0.03, align=(0, -0.7, -0.3), clump=0.45, var=0.05)
    body = bird(C, (0, 0.22, 0), (0.31, 0.3, 0.3), 0.7, 0.32)
    C.add(S.ell((0.13, 0.36, 0.2), (0.11, 0.035, 0.07), rot=(0, 0, 0.2)).mirror(), 0.04)
    C.eye(0.14, 0.27, 0.085, 0.58, '#e8b020', look=(0.06, 0.0, 1))
    bc = (0, 0.16, S.surf_z(C.shape, 0, 0.16) - 0.06)
    up, lo = beak(bc, 0.3, 0.1, 0.09, 0.07, 0.09)
    jacket = garment(body, -0.36, 0.05, (0.3, 0.14))
    C.region(body.grow(0.01).inter(S.plane((0, 1, 0), -0.2)), '#4a2a14', 0.06, hair='#6a4020', tip='#9a6a3a', length=0.03, clump=0.5)
    C.region(jacket.grow(0.02), '#222222', 0.01)
    C.build()
    K.build('SkyeBeak', up.add(lo, 0.01), (-0.2, -0.1, 0.0), (0.2, 0.35, 0.75), [K.glossy('SkyeHorn', '#f0b828', 0.22)], step=0.003)
    K.build('SkyeJacket', jacket, (-0.85, -1.3, -0.7), (0.85, -0.25, 0.6), [K.principled('SkyeLeather', '#5a3018', rough=0.45, coat=0.3, bump=0.3, bump_scale=60)], step=0.006)
    fleece = S.torus((0, -0.36, -0.05), 0.36, 0.06, rot=(0.25, 0, 0))
    fo = K.build('SkyeFleece', fleece, (-0.6, -0.6, -0.6), (0.6, -0.1, 0.6), [K.skin('SkyeFleeceSkin', '#e8dcc4')], step=0.004)
    fo.data.materials.append(K.hair_mat('SkyeFleeceHair', '#efe4cc', '#fff6e4', var=0.06))
    K.vgroup(fo, 'all', np.ones(len(fo.data.vertices)))
    K.fur(fo, 'all', 'SkyeFleeceHair', length=0.02, count=16000, children=6, align=(0, 0, 0), clump=0.4, rough=0.006, root=0.002, seed=8)
    scarf = S.union(S.torus((0, -0.33, -0.04), 0.32, 0.04, rot=(0.25, 0, 0)), squash(S.tube([(0.1, -0.36, 0.3), (0.2, -0.5, 0.36), (0.34, -0.6, 0.3), (0.46, -0.72, 0.18)], 0.07, 0.06), (0.25, -0.55, 0.3), 1, 1, 0.4), k=0.03).bump(0.008, 14, 6)
    K.build('SkyeScarf', scarf, (-0.6, -0.9, -0.5), (0.7, -0.2, 0.6), [K.silk('SkyeSilk', '#f6f4ee')], step=0.004)
    gy = 0.43
    goggles = []
    for sx in (1, -1):
        c = (sx * 0.12, gy, S.surf_z(C.shape, sx * 0.12, gy) + 0.02)
        goggles.append((c, S.cyl(c, 0.085, 0.03, rot=(math.pi / 2 - 0.3, 0, 0), round_=0.01)))
    strap = S.torus((0, gy - 0.01, -0.02), 0.31, 0.022, rot=(-0.3, 0, 0)).sub(S.plane((0, 0, 1), 0.12))
    K.build('SkyeStrap', strap, (-0.5, 0.2, -0.5), (0.5, 0.65, 0.5), [K.principled('SkyeStrapLeather', '#3a2010', rough=0.55, bump=0.2, bump_scale=80)], step=0.004)
    K.build('SkyeGoggles', S.union(*[g for _, g in goggles], S.tube([(0.05, gy, goggles[0][0][2]), (0, gy + 0.01, goggles[0][0][2] + 0.01), (-0.05, gy, goggles[0][0][2])], 0.015, 0.015)), (-0.4, 0.25, -0.1), (0.4, 0.65, 0.6), [K.gold('SkyeBrass', '#c8a060', 0.25)], step=0.0025)
    K.build('SkyeLenses', S.union(*[S.cyl((c[0], c[1], c[2] + 0.02), 0.068, 0.012, rot=(math.pi / 2 - 0.3, 0, 0), round_=0.008) for c, _ in goggles]), (-0.4, 0.25, -0.1), (0.4, 0.65, 0.65), [K.principled('SkyeGlass', '#7ab0c8', rough=0.02, transmission=0.9, ior=1.4)], step=0.002)
    return (0.55, 0.14, 3.9), (0, 0.04, 0), 76


# ------------------------------------------------------------------------------ Shelly
def tortoise():
    """Shelly: a tortoise leaning out of her domed shell, scaled green skin, a red-and-white knitted scarf."""
    C = Char('Shelly', '#7ea85e', '#7ea85e', length=0.006, clump=0.0)
    C.mats[0] = K.scales('ShellySkin', '#86b064', 55, 0.42, 0.3, strength=0.35)
    C.furs = []
    head = S.union(S.ell((0, 0.22, 0.04), (0.3, 0.28, 0.29)), S.ell((0, 0.06, 0.2), (0.22, 0.16, 0.18)), k=0.1)
    neck = S.cone((0, 0.0, -0.05), (0, -0.55, -0.15), 0.19, 0.24)
    C.add(head).add(neck, 0.1)
    mc = (0, 0.02, S.surf_z(C.shape, 0, 0.02) - 0.04)
    cav, corners = smile(mc, 0.14, 0.05, 0.08, 1.2)
    C.sub(cav, 0.012).sub(corners, 0.01)
    C._mouth = (mc, 0.14, 0.05, 0.08, 1.2, cav)
    C.sub(S.sphere((0.05, 0.14, S.surf_z(C.shape, 0.05, 0.14)), 0.012).mirror(), 0.005)
    C.eye(0.14, 0.27, 0.085, 0.62, '#7a4a20', look=(0.06, 0.0, 1))
    C.region(S.ell((0, -0.3, 0.12), (0.2, 0.4, 0.15)), K.scales('ShellyBelly', '#d8d49a', 30, 0.45, 0.3, strength=0.25), 0.04)
    C.region(cav.grow(0.006), '#8a2e3a', 0.006)
    C.build()
    mouth_after(C, top_teeth=False)
    shell = S.ell((0, -0.75, -0.35), (0.85, 0.55, 0.6)).sub(S.ell((0, -0.4, 0.15), (0.32, 0.3, 0.4)), 0.06)
    plate = S.ell((0, -1.05, 0.0), (0.72, 0.3, 0.42))
    so = K.build('ShellyShell', shell, (-1.0, -1.5, -1.0), (1.0, 0.0, 0.5), [K.scales('ShellyScutes', '#a8742a', 4.2, 0.3, 0.05, strength=1.2)], step=0.007)
    K.build('ShellyPlastron', plate, (-1.0, -1.5, -0.6), (1.0, -0.6, 0.5), [K.scales('ShellyPlate', '#e0c47a', 3.5, 0.35, 0.05, strength=0.8)], step=0.007)
    scarf = S.union(S.torus((0, -0.36, -0.06), 0.27, 0.07, rot=(0.3, 0, 0)), S.tube([(0.12, -0.4, 0.22), (0.22, -0.55, 0.3), (0.25, -0.75, 0.32)], 0.07, 0.06), k=0.03).bump(0.01, 14, 2)
    sco = K.build('ShellyScarf', scarf, (-0.5, -0.9, -0.5), (0.5, -0.15, 0.6), [K.stripes('ShellyKnit', '#c8202e', '#f6f0e4', 9, 'Y')], step=0.005)
    K.fuzz(sco, '#e8c8c0', 0.004, 15000)
    return (0.55, 0.12, 3.9), (0, -0.04, 0), 76


# ------------------------------------------------------------------------------ Ember
def dragon():
    """Ember: a little red dragon: scaled ruby skin with a cream throat, gold horns, a ridge of
    spines, a tiny tilted crown and folded wings."""
    C = Char('Ember', '#c0281c', '#c0281c', length=0.006, clump=0.0)
    C.mats[0] = K.scales('EmberSkin', '#a8140c', 120, 0.45, 0.1, strength=0.35, coat=0.08)
    C.furs = []
    head = S.union(S.ell((0, 0.24, -0.02), (0.31, 0.28, 0.28)), S.ell((0, 0.04, 0.24), (0.2, 0.14, 0.2)),
                   S.ell((0.17, 0.08, 0.06), (0.14, 0.14, 0.14)).mirror(), k=0.1)
    C.add(head)
    body = torso(-0.5, 0.64, 0.28)
    C.add(body, 0.18)
    spines = S.union(*[S.cone((0, 0.5 - j * 0.1 + 0.02 * j * j * 0.0, -0.02 - j * 0.09), (0, 0.6 - j * 0.1, -0.06 - j * 0.1), 0.04, 0.006) for j in range(6)])
    C.add(spines, 0.02)
    nz = S.surf_z(C.shape, 0.06, 0.1)
    C.sub(S.ell((0.06, 0.1, nz), (0.022, 0.016, 0.03)).mirror(), 0.008)
    mc = (0, -0.02, S.surf_z(C.shape, 0, -0.02) - 0.04)
    cav, corners = smile(mc, 0.14, 0.055, 0.08, 1.1)
    C.sub(cav, 0.012).sub(corners, 0.01)
    C._mouth = (mc, 0.14, 0.055, 0.08, 1.1, cav)
    C.eye(0.15, 0.26, 0.09, 0.6, '#f0b820', look=(0.06, 0.0, 1), slit=True)
    C.region(S.ell((0, -0.4, 0.2), (0.26, 0.5, 0.2)).add(S.ell((0, -0.02, 0.25), (0.16, 0.1, 0.15)), 0.05), K.stripes('EmberBelly', '#f2d08a', '#e2b86a', 14, 'Y', knitted=False), 0.03)
    C.region(cav.grow(0.006), '#7a1a20', 0.006)
    C.build()
    mouth_after(C, teeth_col='#fff8ea')
    horns = S.union(*[S.tube([(sx * 0.18, 0.44, -0.04), (sx * 0.27, 0.6, -0.12), (sx * 0.29, 0.7, -0.3)], 0.045, 0.008) for sx in (1, -1)])
    K.build('EmberHorns', horns, (-0.5, 0.3, -0.5), (0.5, 0.85, 0.2), [K.gold('EmberGold')], step=0.0025)
    crown = S.cyl((0.0, 0.0, 0.0), 0.11, 0.045).shell(0.008).add(S.union(*[S.cone((0.11 * math.cos(a), 0.04, 0.11 * math.sin(a)), (0.11 * math.cos(a), 0.11, 0.11 * math.sin(a)), 0.022, 0.004) for a in np.linspace(0, 6.28, 6, endpoint=False)]), 0.006)
    crown = crown.rot(0.15, 0, 0.3).move(-0.06, 0.53, 0.02)
    K.build('EmberCrown', crown, (-0.3, 0.35, -0.2), (0.2, 0.75, 0.25), [bpy_mat('EmberGold')], step=0.002)
    gems = S.union(*[S.sphere((0.112 * math.cos(a), 0.0, 0.112 * math.sin(a)), 0.016) for a in np.linspace(0.3, 6.58, 6, endpoint=False)]).rot(0.15, 0, 0.3).move(-0.06, 0.53, 0.02)
    K.build('EmberGems', gems, (-0.3, 0.35, -0.2), (0.2, 0.75, 0.25), [K.gem('EmberEmerald', '#10a050')], step=0.0018)
    bones, sheets = [], []
    for sx in (1, -1):
        sh = np.array([sx * 0.38, -0.4, -0.32])
        elbow = sh + np.array([sx * 0.22, 0.42, -0.06])
        tips = [elbow + np.array([sx * d[0], d[1], -0.05]) for d in ((0.08, 0.38), (0.3, 0.22), (0.42, -0.06), (0.36, -0.36))]
        bones += [S.tube([sh, elbow], 0.035, 0.025), S.sphere(elbow, 0.035)] + [S.tube([elbow, t], 0.02, 0.006) for t in tips]
        tris = [S.tri(elbow, tips[i], tips[i + 1], 0.006) for i in range(len(tips) - 1)] + [S.tri(sh, elbow, tips[-1], 0.006)]
        scal = S.union(*[S.sphere((tips[i] + tips[i + 1]) / 2 + ((tips[i] + tips[i + 1]) / 2 - elbow) * 0.12, 0.08) for i in range(len(tips) - 1)])
        sheets.append(S.union(*tris).sub(scal))
    K.build('EmberWings', S.union(*sheets), (-1.2, -0.7, -0.6), (1.2, 0.6, -0.1), [K.principled('EmberMembrane', '#8a1a10', rough=0.55, sss=0.15, bump=0.2, bump_scale=40)], step=0.004)
    K.build('EmberBones', S.union(*bones), (-1.2, -0.7, -0.6), (1.2, 0.6, -0.1), [K.scales('EmberBone', '#a81c14', 90, 0.35, 0.3, strength=0.3)], step=0.004)
    return (0.55, 0.12, 4.0), (0, 0.04, 0), 74


def bpy_mat(name):
    import bpy
    return bpy.data.materials[name]


CHARS = {'horse': horse, 'bunny': bunny, 'raccoon': raccoon, 'panda': panda, 'beaver': beaver, 'squirrel': squirrel, 'cat': cat, 'wolf': wolf, 'bear': bear, 'lion': lion, 'elephant': elephant, 'giraffe': giraffe, 'raven': raven, 'owl': owl, 'rooster': rooster, 'eagle': eagle, 'tortoise': tortoise, 'dragon': dragon}
