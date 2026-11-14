"""Feather vocabulary for the four birds (raven, owl, rooster, eagle). Not a character: the bird
files import it. Lives here, not in common.py, so the shared kit stays untouched.

Feathers are sculpted, not grown: overlapping rows of soft shingles pressed into the body, and
single plumes (crests, tufts, hackles, tail) as flattened leaves. A short velvet of fur on top
keeps them soft. That is what reads as modern and clean at badge size."""
from common import *


def _lattice(P, rows, cols, ref, length, c):
    """For each point: the strongest feather of a brick lattice wrapped round the vertical axis
    through c. Returns (thickness 0..1 rising to the tip, 0..1 along the feather)."""
    th = np.arctan2(P[:, 0] - c[0], P[:, 2] - c[1])
    u = th * ref / cols
    v = -P[:, 1] / rows
    r0 = np.floor(v)
    best = np.zeros(len(P)); along = np.zeros(len(P))
    for dr in (-2, -1, 0):
        r = r0 + dr
        off = 0.5 * (r % 2)
        du = u - (np.round(u - off) + off)
        dv = (v - r) / length
        e = (du / 0.58) ** 2 + ((dv - 0.5) / 0.5) ** 2
        h = np.where(e < 1, np.clip(dv, 0, 1) ** 0.8 * (1 - np.clip(e, 0, 1) ** 3), 0.0)
        m = h > best
        best = np.where(m, h, best); along = np.where(m, dv, along)
    return best, along


def _weight(mask, P, soft):
    if mask is None:
        return 1.0
    w = np.clip(0.5 - mask(P) / soft * 0.5, 0, 1)
    return w * w * (3 - 2 * w)


def shingles(f, mask=None, amp=0.014, rows=0.075, cols=0.1, ref=0.4, length=1.7, c=(0.0, -0.05), soft=0.06):
    """Press rows of overlapping feathers into the surface of f where mask is (a field: inside =
    feathered). rows/cols: feather spacing down and round; ref: the radius the columns are
    measured at."""
    def g(P):
        d = f(P)
        near = np.abs(d) < 0.09
        if near.any():
            Q = P[near]
            h, _ = _lattice(Q, rows, cols, ref, length, c)
            d = d.copy()
            d[near] -= amp * h * _weight(mask, Q, soft)
        return d
    return S.F(g)


def tips(mask=None, rows=0.075, cols=0.1, ref=0.4, length=1.7, c=(0.0, -0.05), start=0.62):
    """The tip of every shingle as a region field (inside = tip), for a second colour on the
    feather ends: bars, flecks, a gold edge."""
    def g(P):
        h, a = _lattice(P, rows, cols, ref, length, c)
        d = np.where((a > start) & (h > 0.05), -0.02, 0.02)
        if mask is not None:
            d = np.maximum(d, mask(P))
        return d
    return S.F(g)


def plume(base, tip, w, t=0.018, bend=(0, 0, 0), point=0.35, n=5):
    """One feather from base to tip: a leaf w wide and t thick, widest a third of the way up,
    drawn to a soft point; bend pushes its middle sideways for a curl."""
    base, tip, bend = (np.asarray(x, float) for x in (base, tip, bend))
    L = np.linalg.norm(tip - base)
    parts = []
    for i in range(n):
        s = (i + 0.5) / n
        p = base + (tip - base) * s + bend * math.sin(math.pi * s)
        r = w * (math.sin(math.pi * min(s * 1.25 + 0.12, 1.0)) ** 0.8) * (1 - point * s * s)
        parts.append((p, max(r, t)))
    f = S.union(*[S.cone(parts[i][0], parts[i + 1][0], parts[i][1], parts[i + 1][1]) for i in range(n - 1)], k=0.0)
    # flatten along the direction that faces the camera least in the feather's own plane
    d = (tip - base) / L
    nrm = np.array([0, 0, 1.0]) - d * d[2]            # the part of "towards the camera" square to the feather
    nl = np.linalg.norm(nrm)
    nrm = nrm / nl if nl > 1e-6 else np.array([1.0, 0, 0])
    mid = (base + tip) / 2 + bend * 0.6
    slab = S.F(lambda P: np.abs((P - mid) @ nrm) - t)
    return f.inter(slab, k=t * 0.9)


def fan(centre, r, angles, w, t=0.018, lean=0.0, grow=1.0, z=0.0, bend=0.0):
    """Plumes fanned from a point: angles in radians from straight up, clockwise as seen."""
    cx, cy, cz = centre
    out = []
    for j, a in enumerate(angles):
        L = r * (grow ** j)
        d = np.array([math.sin(a), math.cos(a), lean])
        tip = np.array(centre) + d * L + np.array([0, 0, z * j])
        side = np.array([math.cos(a), -math.sin(a), 0]) * bend * L
        out.append(plume(centre, tip, w, t, bend=side))
    return S.union(*out, k=0.012)


def chick(head_c, head_r, w=0.44, d=0.36, top=-0.08, neck=0.14, wing=True):
    """A bird in the v3 proportions: a big head sitting straight on a plump round tummy that
    starts under the chin and is nearly as wide as the head (no neck: a thin one was rejected),
    with small folded wings hugging its sides, tips towards the chest. Returns (all, body)."""
    belly = S.ell((0, top - 0.5, -0.03), (w, 0.52, d))
    lower = S.ell((0, top - 0.9, -0.03), (w * 1.08, 0.5, d * 1.05))
    body = S.union(belly, lower, k=0.1)
    if wing:
        c = (w * 0.9, top - 0.47, 0.03)
        wg = S.ell(c, (0.12, 0.3, 0.25), rot=(0.3, 0.0, -0.2)).mirror()
        body = body.add(wg, 0.04)
    return S.union(S.ell(head_c, head_r), body, k=neck), body


def wings(w, top=-0.08, grow=0.02):
    """The region of the folded wings chick() makes, for their own colour."""
    return S.ell((w * 0.9, top - 0.47, 0.03), (0.12 + grow, 0.3 + grow, 0.25 + grow), rot=(0.3, 0.0, -0.2)).mirror()


def smile_beak(c, length, w, h, drop=0.03, hook=0.0, gape=0.012, lift=0.02, lower=0.7):
    """A short, friendly beak at c (on the face): rounded upper bill whose tip dips by drop (+hook
    for a raptor), and a smaller lower bill; the line between them rises to the corners, which
    is the bird's smile. Returns (upper, lower)."""
    cx, cy, cz = c
    up = S.tube([(cx, cy + h * 0.25, cz - 0.05), (cx, cy + h * 0.2, cz + length * 0.5), (cx, cy - drop, cz + length)], w, w * 0.2, k=0.012)
    up = squash(up, (cx, cy, cz), 1.0, h / w, 1.0)
    if hook:
        up = up.add(S.cone((cx, cy - drop + 0.005, cz + length * 0.97), (cx, cy - drop - hook, cz + length * 0.9), w * 0.24, w * 0.07), 0.02)
    # the smile line: cut the underside along a curve that rises towards the corners
    cut = S.F(lambda P: (P[:, 1] - (cy - h * 0.38 + lift * (1 - np.clip((P[:, 2] - cz) / length, 0, 1)) ** 2 + 0.0 * P[:, 0])))
    upper = up.inter(S.F(lambda P: -cut(P)), k=0.008)
    lo = S.tube([(cx, cy - h * 0.5, cz - 0.05), (cx, cy - h * 0.55, cz + length * lower * 0.6), (cx, cy - h * 0.42 - drop * 0.4, cz + length * lower)], w * 0.8, w * 0.16, k=0.012)
    lo = squash(lo, (cx, cy - h * 0.5, cz), 1.0, 0.6 * h / w, 1.0)
    lower_f = lo.inter(S.F(lambda P: cut(P) + gape), k=0.006)
    return upper, lower_f


def blush(C, x, y, r=0.07, col='#f2a0a0'):
    """A soft rosy cheek (colour only)."""
    z = S.surf_z(C.shape, x, y)
    C.region(S.ell((x, y, z), (r, r * 0.7, 0.06)).mirror(), col, 0.07)


def lash(C, col='#3a2420', i=0):
    """A soft dark lash line over the upper lid of eye i (the benchmark's finishing touch)."""
    ec, er = C.eyes[i][0], C.eyes[i][1]
    f = S.sphere(ec, er + 0.02).sub(S.sphere(ec, er - 0.004)).inter(half((ec[0], ec[1] + er * 0.62, ec[2]), (0.1, 1, 0.25))).mirror()
    C.region(f, col, 0.005)
