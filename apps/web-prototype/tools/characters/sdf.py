"""Signed distance sculpting for the character models (numpy + marching cubes).

A character's body, a hat or a scarf is built as a field: primitives (ellipsoids, round cones,
tubes along curves, tori) joined with smooth unions and carved with smooth subtractions, the
way a sculptor adds and takes away clay. mesh() turns the field into a fine triangle mesh that
Blender then smooths, furs and shades.

Coordinates: x right, y up, z towards the camera; one unit is about one head height.
"""
import numpy as np


def _rot(rx=0.0, ry=0.0, rz=0.0):
    cx, sx, cy, sy, cz, sz = np.cos(rx), np.sin(rx), np.cos(ry), np.sin(ry), np.cos(rz), np.sin(rz)
    X = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Y = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Z = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Z @ Y @ X


class F:
    """A field: f(P) -> distances for points P (N x 3)."""

    def __init__(self, fn, lo=None, hi=None):
        self.fn, self.lo, self.hi = fn, lo, hi

    def __call__(self, P):
        return self.fn(P)

    # transforms -------------------------------------------------------------------------
    def rot(self, rx=0.0, ry=0.0, rz=0.0, about=(0, 0, 0)):
        """Rotate (radians, applied x then y then z) about a point."""
        R = _rot(rx, ry, rz)
        c = np.asarray(about, float)
        fn = self.fn
        return F(lambda P: fn((P - c) @ R + c))

    def move(self, dx=0.0, dy=0.0, dz=0.0):
        d = np.array([dx, dy, dz], float)
        fn = self.fn
        return F(lambda P: fn(P - d))

    def mirror(self):
        """Both sides: the shape made for x > 0 also appears at -x."""
        fn = self.fn

        def g(P):
            Q = P.copy()
            Q[:, 0] = np.abs(Q[:, 0])
            return fn(Q)
        return F(g)

    def scale(self, s):
        fn = self.fn
        return F(lambda P: fn(P / s) * s)

    def shell(self, t):
        fn = self.fn
        return F(lambda P: np.abs(fn(P)) - t)

    def grow(self, r):
        fn = self.fn
        return F(lambda P: fn(P) - r)

    def bump(self, amp, freq, seed=0):
        """Low-frequency lumps, so surfaces are not machine-perfect."""
        rng = np.random.default_rng(seed)
        w = rng.normal(size=(6, 3)) * freq
        ph = rng.uniform(0, 6.28, 6)
        fn = self.fn
        return F(lambda P: fn(P) + amp * np.sum(np.sin(P @ w.T + ph), axis=1) / 3.0)

    # booleans ---------------------------------------------------------------------------
    def add(self, o, k=0.0):
        return union(self, o, k=k)

    def sub(self, o, k=0.0):
        a, b = self.fn, o.fn
        if k <= 0:
            return F(lambda P: np.maximum(a(P), -b(P)))

        def g(P):
            d1, d2 = a(P), b(P)
            h = np.clip(0.5 - 0.5 * (d1 + d2) / k, 0, 1)
            return d1 * (1 - h) + (-d2) * h + k * h * (1 - h)
        return F(g)

    def inter(self, o, k=0.0):
        a, b = self.fn, o.fn
        if k <= 0:
            return F(lambda P: np.maximum(a(P), b(P)))

        def g(P):
            d1, d2 = a(P), b(P)
            h = np.clip(0.5 - 0.5 * (d2 - d1) / k, 0, 1)
            return d2 * (1 - h) + d1 * h + k * h * (1 - h)
        return F(g)


def union(*fs, k=0.0):
    fs = [f for f in fs if f is not None]
    if len(fs) == 1:
        return fs[0]
    fns = [f.fn for f in fs]

    def g(P):
        d = fns[0](P)
        for fn in fns[1:]:
            d2 = fn(P)
            if k <= 0:
                d = np.minimum(d, d2)
            else:
                h = np.clip(0.5 + 0.5 * (d2 - d) / k, 0, 1)
                d = d2 * (1 - h) + d * h - k * h * (1 - h)
        return d
    return F(g)


# primitives -------------------------------------------------------------------------------
def sphere(c, r):
    c = np.asarray(c, float)
    return F(lambda P: np.linalg.norm(P - c, axis=1) - r)


def ell(c, r, rot=(0, 0, 0)):
    """Ellipsoid with radii r = (rx, ry, rz), optionally rotated about its centre."""
    c = np.asarray(c, float)
    r = np.asarray(r, float)
    R = _rot(*rot)

    def g(P):
        Q = (P - c) @ R
        k0 = np.linalg.norm(Q / r, axis=1)
        k1 = np.linalg.norm(Q / (r * r), axis=1)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)
    return F(g)


def cone(a, b, ra, rb):
    """Round cone: a capsule from a (radius ra) to b (radius rb)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    ba = b - a
    l2 = float(ba @ ba)

    def g(P):
        pa = P - a
        h = np.clip((pa @ ba) / l2, 0, 1)
        d = np.linalg.norm(pa - h[:, None] * ba, axis=1)
        return d - (ra + (rb - ra) * h)
    return F(g)


def capsule(a, b, r):
    return cone(a, b, r, r)


def tube(pts, r0, r1=None, n=24, k=0.0):
    """A tube along a smooth curve through pts (Catmull-Rom), tapering from r0 to r1."""
    pts = np.asarray(pts, float)
    r1 = r0 if r1 is None else r1
    if len(pts) > 2:
        pp = np.vstack([pts[0] * 2 - pts[1], pts, pts[-1] * 2 - pts[-2]])
        out = []
        for i in range(1, len(pp) - 2):
            p0, p1, p2, p3 = pp[i - 1], pp[i], pp[i + 1], pp[i + 2]
            for t in np.linspace(0, 1, max(2, n // (len(pts) - 1)), endpoint=False):
                t2, t3 = t * t, t * t * t
                out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
        out.append(pts[-1])
        pts = np.array(out)
    m = len(pts) - 1
    segs = [cone(pts[i], pts[i + 1], r0 + (r1 - r0) * i / m, r0 + (r1 - r0) * (i + 1) / m) for i in range(m)]
    return union(*segs, k=k)


def tri(a, b, c, t):
    """A thin sheet: the triangle abc, thickened by t (wing membranes, fins)."""
    a, b, c = (np.asarray(x, float) for x in (a, b, c))
    ba, cb, ac = b - a, c - b, a - c
    nor = np.cross(ba, ac)

    def g(P):
        pa, pb, pc = P - a, P - b, P - c
        sgn = (np.sign(np.cross(ba, nor) @ pa.T) + np.sign(np.cross(cb, nor) @ pb.T) + np.sign(np.cross(ac, nor) @ pc.T))
        def seg(p, e):
            h = np.clip((p @ e) / (e @ e), 0, 1)
            return np.sum((e[None] * h[:, None] - p) ** 2, 1)
        edge = np.minimum(np.minimum(seg(pa, ba), seg(pb, cb)), seg(pc, ac))
        face = (pa @ nor) ** 2 / (nor @ nor)
        return np.sqrt(np.where(sgn < 2, edge, face)) - t
    return F(g)


def torus(c, R, r, rot=(0, 0, 0)):
    """Torus around the local y axis."""
    c = np.asarray(c, float)
    M = _rot(*rot)

    def g(P):
        Q = (P - c) @ M
        q = np.sqrt(Q[:, 0] ** 2 + Q[:, 2] ** 2) - R
        return np.sqrt(q * q + Q[:, 1] ** 2) - r
    return F(g)


def box(c, half, r=0.0, rot=(0, 0, 0)):
    c, half = np.asarray(c, float), np.asarray(half, float)
    M = _rot(*rot)

    def g(P):
        q = np.abs((P - c) @ M) - (half - r)
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(np.max(q, axis=1), 0) - r
    return F(g)


def cyl(c, r, h, rot=(0, 0, 0), round_=0.0):
    """Capped cylinder along local y, half height h."""
    c = np.asarray(c, float)
    M = _rot(*rot)

    def g(P):
        Q = (P - c) @ M
        d = np.stack([np.sqrt(Q[:, 0] ** 2 + Q[:, 2] ** 2) - r + round_, np.abs(Q[:, 1]) - h + round_], 1)
        return np.minimum(np.max(d, 1), 0) + np.linalg.norm(np.maximum(d, 0), axis=1) - round_
    return F(g)


def plane(n, d=0.0):
    """Half-space n . p > d is outside (n need not be unit)."""
    n = np.asarray(n, float)
    n = n / np.linalg.norm(n)
    return F(lambda P: P @ n - d)


# meshing --------------------------------------------------------------------------------
def mesh(f, lo, hi, step=0.008):
    """Marching cubes over the box lo..hi. Returns (verts, faces) with outward normals."""
    from skimage.measure import marching_cubes
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    n = np.ceil((hi - lo) / step).astype(int) + 1
    xs = [np.linspace(lo[i], lo[i] + (n[i] - 1) * step, n[i]) for i in range(3)]
    vol = np.empty(n, np.float32)
    # in slabs, to keep memory low
    Y, Z = np.meshgrid(xs[1], xs[2], indexing='ij')
    yz = np.stack([Y.ravel(), Z.ravel()], 1)
    for i, x in enumerate(xs[0]):
        P = np.column_stack([np.full(len(yz), x), yz])
        vol[i] = f(P).reshape(n[1], n[2])
    if vol.min() > 0:
        return np.zeros((0, 3)), np.zeros((0, 3), int)
    v, tri, _, _ = marching_cubes(vol, 0.0, spacing=(step, step, step))
    v += lo
    return taubin(v, tri), tri


def taubin(v, tri, iters=6, lam=0.5, mu=-0.53):
    """Smooth the marching-cubes stair steps away without shrinking the form."""
    import scipy.sparse as sp
    n = len(v)
    e = np.vstack([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
    e = np.vstack([e, e[:, ::-1]])
    A = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)).tocsr()
    A.data[:] = 1.0
    deg = np.asarray(A.sum(1)).ravel()
    deg[deg == 0] = 1
    for _ in range(iters):
        for f in (lam, mu):
            v = v + f * (A @ v / deg[:, None] - v)
    return v


def surf_z(f, x, y, z0=1.2, z1=-0.6):
    """Where a ray from the camera side (+z) going straight back first meets the surface."""
    zs = np.linspace(z0, z1, 600)
    P = np.column_stack([np.full_like(zs, x), np.full_like(zs, y), zs])
    d = f(P)
    i = int(np.argmax(d < 0))
    return float(zs[max(i - 1, 0)])
