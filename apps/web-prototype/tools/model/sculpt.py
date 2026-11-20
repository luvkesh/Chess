"""Sculpted sets: every piece is a true 3D shape made from its own picture, and painted from it.

A set that uses this has SCULPT = True and, as hero sets do, one clean picture a piece
(tools/model/pics/<set>/<side>-<type>.jpg). For each piece:
  * tsg.py turns the picture into a solid (the TripoSG weights), kept as a volume;
  * Solid stands the volume in the piece's world, on its base, and finds the camera the
    picture was taken with (how far it is turned and raised) by matching outlines;
  * the mesh is the solid's surface, thinned to the game's triangle budgets. Its faces are laid
    out in the side's atlas by Blender's own unwrap, all six pieces of a side together, so every
    patch of surface has its own place in the atlas and no part borrows another's colours;
  * each atlas texel knows its point on the surface. It takes its colour from the picture where
    the picture's camera saw that point, from further pictures of the back and the sides where
    those saw it (views.py draws them), and from the nearest painted surface where nothing did;
  * the surface's fine relief (hair, bark, folds) is kept as a normal map made from the volume.

Frames. World is Blender's: x across (the picture's right), y depth with the viewer at -y,
z up, the foot on z = 0. A camera stands round the piece at az (0 in front, pi/2 at +x) and is
raised by el; camera coordinates are x right, y up, z away from the camera.
"""
import math
import os

import cv2
import numpy as np

import kit
import tsg

ATLAS = (4096, 2048)  # a side's atlas (width, height): all six pieces
MARGIN = 0.0012       # gap between patches, as a share of the atlas's height (2 to 3 texels)
UNDER = 0.3           # the same for the surface that faces down, which no one sees
THIN = 0.7            # how finely the surface the front picture does not show is drawn, against
                      # the surface it does (the picture is the detail there is; the rest is made up)


# ------------------------------------------------------------------ the solid
class Solid:
    """a piece's volume (> 0 inside; axes depth, up, across) stood in the world"""

    def __init__(self, v, height, turn=0.0, blur=0.6):
        from scipy import ndimage
        from skimage.measure import marching_cubes
        v = np.array(v, np.float32)
        occ = v > 0
        lab, n = ndimage.label(occ)
        if n > 1:
            # specks floating round the figure are dropped; a part of real size is kept
            size = ndimage.sum(occ, lab, np.arange(1, n + 1))
            small = np.nonzero(size < 0.004 * size.max())[0] + 1
            if len(small):
                v[np.isin(lab, small)] = -1.0
        del lab, occ
        if blur:
            v = ndimage.gaussian_filter(v, blur)
        self.v = v
        verts, faces, _, _ = marching_cubes(v, 0.0)
        self.verts, self.faces = verts.astype(np.float32), faces
        self.u0 = float(verts[:, 1].min())
        self.q = height / float(verts[:, 1].max() - self.u0)      # world units a cell
        # the axis: the middle of the base (the lowest slice of the figure)
        low = verts[verts[:, 1] < self.u0 + 0.05 * (verts[:, 1].max() - self.u0)]
        self.dc = float((low[:, 0].min() + low[:, 0].max()) / 2)
        self.ac = float((low[:, 2].min() + low[:, 2].max()) / 2)
        self.turn = turn
        self.height = height

    # world <-> volume
    def index(self, P):
        """volume indices (3, n) of world points (n, 3)"""
        c, s = math.cos(self.turn), math.sin(self.turn)
        x0 = P[:, 0] * c + P[:, 1] * s
        y0 = -P[:, 0] * s + P[:, 1] * c
        return np.stack([self.dc - y0 / self.q, self.u0 + P[:, 2] / self.q, self.ac + x0 / self.q])

    def world(self, idx):
        """world points (n, 3) of volume indices (n, 3)"""
        c, s = math.cos(self.turn), math.sin(self.turn)
        x0 = (idx[:, 2] - self.ac) * self.q
        y0 = -(idx[:, 0] - self.dc) * self.q
        return np.stack([x0 * c - y0 * s, x0 * s + y0 * c, (idx[:, 1] - self.u0) * self.q], 1)

    def _affine(self):
        """index = A @ world + b"""
        c, s = math.cos(self.turn), math.sin(self.turn)
        A = np.array([[s, -c, 0], [0, 0, 1], [c, s, 0]]) / self.q
        return A, np.array([self.dc, self.u0, self.ac])

    def value(self, P):
        from scipy.ndimage import map_coordinates
        return map_coordinates(self.v, self.index(np.asarray(P, np.float64)), order=1, mode='nearest')

    def points(self):
        """the surface's points in the world (the full mesh's corners)"""
        return self.world(self.verts)

    def normal(self, P, step=1.0):
        """outward unit normals at world points near the surface, from the volume's slope"""
        P = np.asarray(P, np.float64)
        h = step * self.q
        g = np.empty(P.shape)
        for a in range(3):
            d = np.zeros(3)
            d[a] = h
            g[:, a] = self.value(P + d) - self.value(P - d)
        n = -g
        ln = np.linalg.norm(n, axis=1, keepdims=True)
        return n / np.maximum(ln, 1e-9), ln[:, 0] / (2 * h)

    def snap(self, P, n_iter=2, limit=3.0):
        """world points moved onto the surface (along the volume's slope), at most `limit` cells"""
        P = np.array(P, np.float64)
        P0 = P.copy()
        for _ in range(n_iter):
            n, slope = self.normal(P)
            f = self.value(P)
            ok = slope > 1e-3
            step = np.where(ok, f / np.maximum(slope, 1e-3), 0)       # f > 0 inside: move outward
            step = np.clip(step, -self.q, self.q)
            P += n * step[:, None]
        far = np.linalg.norm(P - P0, axis=1) > limit * self.q
        P[far] = P0[far]
        return P

    def look(self, cam, px=None, pad=3):
        """the solid as a camera sees it: a View's worth of depth and outline (see Seen)"""
        from scipy.ndimage import affine_transform
        px = px or self.q
        C = cam.to(self.points())
        lo, hi = C.min(0) - pad * px, C.max(0) + pad * px
        nc, nr, nz = (int(math.ceil((hi[i] - lo[i]) / px)) + 1 for i in range(3))
        # output index (iz, ir, ic) -> camera (x, y, z) -> world -> volume index
        E = px * np.array([[0, 0, 1], [0, -1, 0], [1, 0, 0]], float)
        C0 = np.array([lo[0], hi[1], lo[2]])
        A, b = self._affine()
        M = A @ cam.R.T
        G = affine_transform(self.v, M @ E, M @ C0 + b, output_shape=(nz, nr, nc), order=1, cval=float(self.v.min()))
        occ = G > 0
        hit = occ.any(0)
        i1 = occ.argmax(0)
        i0 = np.maximum(i1 - 1, 0)
        g1 = np.take_along_axis(G, i1[None], 0)[0]
        g0 = np.take_along_axis(G, i0[None], 0)[0]
        frac = np.where((i1 > 0) & (g1 > g0), g0 / np.minimum(g0 - g1, -1e-6), 0.0)
        depth = lo[2] + (i0 + np.clip(frac, 0, 1)) * px
        depth[~hit] = np.inf
        return Seen(cam, depth.astype(np.float32), G.max(0), lo[0], hi[1], px)


class Camera:
    def __init__(self, az=0.0, el=0.0):
        ca, sa, ce, se = math.cos(az), math.sin(az), math.cos(el), math.sin(el)
        self.az, self.el = az, el
        self.R = np.array([[ca, sa, 0], [-sa * se, ca * se, ce], [-sa * ce, ca * ce, -se]])

    def to(self, P):
        return np.asarray(P) @ self.R.T

    def back(self, C):
        return np.asarray(C) @ self.R

    @property
    def into(self):
        """the direction the camera looks along, in the world"""
        return self.R[2]


class Seen:
    """what a camera sees of a solid: depth = the first surface's camera z a pixel (inf where
    the ray misses), soft = the largest volume value along each ray (its zero line is the
    outline, finer than a pixel). Pixel (r, c) is the ray x = x0 + c * px, y = y1 - r * px."""

    def __init__(self, cam, depth, soft, x0, y1, px):
        self.cam, self.depth, self.soft, self.x0, self.y1, self.px = cam, depth, soft, x0, y1, px
        self.hit = np.isfinite(depth)

    def pixel(self, P):
        """(col, row, camera z) of world points"""
        C = self.cam.to(P)
        return (C[:, 0] - self.x0) / self.px, (self.y1 - C[:, 1]) / self.px, C[:, 2]

    def points(self):
        """the world point of every pixel's first surface (nan where the ray misses)"""
        r, c = np.mgrid[0:self.depth.shape[0], 0:self.depth.shape[1]]
        C = np.stack([self.x0 + c * self.px, self.y1 - r * self.px, np.where(self.hit, self.depth, np.nan)], -1)
        return self.cam.back(C.reshape(-1, 3)).reshape(C.shape)

    def sees(self, P, t0=2.5, t1=7.0):
        """0..1: how surely the camera sees world points (1 on its first surface, fading to 0
        between t0 and t1 pixels behind it)"""
        from scipy.ndimage import map_coordinates
        c, r, z = self.pixel(P)
        far = float(self.depth[self.hit].max()) + 1.0
        d = map_coordinates(np.where(self.hit, self.depth, far), [r, c], order=1, mode='nearest')
        return np.clip(1 - ((z - d) / self.px - t0) / (t1 - t0), 0, 1)


# ------------------------------------------------------------------ the picture's camera
def _splat(x, y, shape):
    """outline mask of points dropped on a grid (cells a point falls in, closed up)"""
    H, W = shape
    ok = (x >= 0) & (x < W) & (y >= 0) & (y < H)
    m = np.zeros(shape, np.uint8)
    m[y[ok].astype(np.int32), x[ok].astype(np.int32)] = 255
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))


def _iou(a, b):
    a, b = a > 0, b > 0
    return float((a & b).sum()) / max(float((a | b).sum()), 1.0)


def find_camera(solid, mask, span=35, el=(-6, 30), log=None):
    """the camera a picture's cut-out was taken with: (Camera, k, cx, cy) with the world point
    (camera x, y) at picture pixel (cx + k x, cy - k y). Matches the solid's outline to the
    cut-out's over how far the camera is turned (within span degrees of the front) and raised."""
    ys, xs = np.nonzero(mask > 127)
    f = min(1.0, 220.0 / (ys.max() - ys.min()))                   # work at about 220 px tall
    small = cv2.resize((mask > 127).astype(np.uint8) * 255, None, fx=f, fy=f, interpolation=cv2.INTER_AREA) > 127
    sy, sx = np.nonzero(small)
    area, cxs, cys = float(small.sum()), float(sx.mean()), float(sy.mean())
    P = solid.points()[::3]

    def score(az, el_):
        cam = Camera(math.radians(az), math.radians(el_))
        C = cam.to(P)
        g = solid.q * 1.6
        x, y = (C[:, 0] - C[:, 0].min()) / g + 2, (C[:, 1].max() - C[:, 1]) / g + 2
        m = _splat(x, y, (int(y.max()) + 4, int(x.max()) + 4))
        my, mx = np.nonzero(m)
        k = math.sqrt(area / max(len(my), 1))               # small-picture pixels a grid cell
        M = np.float32([[k, 0, cxs - k * mx.mean()], [0, k, cys - k * my.mean()]])
        w = cv2.warpAffine(m, M, (small.shape[1], small.shape[0]), flags=cv2.INTER_LINEAR) > 127
        # picture pixel = cx + kk * x_c: kk world -> full picture pixels
        kk = k / g / f
        cx = (cxs - k * (mx.mean() - 2) ) / f - kk * C[:, 0].min()
        cy = (cys - k * (my.mean() - 2)) / f + kk * C[:, 1].max()
        return _iou(w, small), (cam, kk, cx, cy)

    best = (-1, None, 0, 0)
    for az in range(-span, span + 1, 5):
        for e in range(el[0], el[1] + 1, 4):
            s, fit = score(az, e)
            if s > best[0]:
                best = (s, fit, az, e)
    a0, e0 = best[2], best[3]
    for az in np.arange(a0 - 4, a0 + 4.01, 1.0):
        for e in np.arange(e0 - 3, e0 + 3.01, 1.0):
            s, fit = score(az, e)
            if s > best[0]:
                best = (s, fit, az, e)
    if log is not None:
        log('camera: turned %.0f, raised %.0f degrees, outline match %.3f' % (best[2], best[3], best[0]))
    return best[1] + (best[0],)


def _sdf(m, clip):
    """signed distance to a mask's outline (> 0 inside), clipped, as 8 bits for the flow"""
    m = (m > 0).astype(np.uint8)
    d = cv2.distanceTransform(m, cv2.DIST_L2, 5) - cv2.distanceTransform(1 - m, cv2.DIST_L2, 5)
    return np.clip(127.5 + d * (127.0 / clip), 0, 255).astype(np.uint8)


def _sample(img, u, v, interp=cv2.INTER_CUBIC, border=cv2.BORDER_REPLICATE):
    """img at float pixel places (u, v), any number of them (cv2.remap takes at most 32767 a side)"""
    n = len(u)
    w = 8192
    rows = (n + w - 1) // w
    mu = np.zeros(rows * w, np.float32)
    mv = np.zeros(rows * w, np.float32)
    mu[:n], mv[:n] = u, v
    out = cv2.remap(img, mu.reshape(rows, w), mv.reshape(rows, w), interp, borderMode=border)
    return out.reshape((rows * w,) + img.shape[2:])[:n]


class Picture:
    """a picture of the piece with the camera that took it: colours for the surface it shows.
    behind=True paints what the camera cannot see from the same picture, showing through (the
    far side of the figure takes the near side's colours, as the flat sets do)."""

    def __init__(self, solid, img, mask, cam, k, cx, cy, name='front', bend=True, behind=False, rank=1.0, spare=False, log=None):
        self.name, self.cam, self.rank, self.spare = name, cam, rank, spare
        self.key = name
        self.img = kit.dilate_fill(img, mask, 30)
        seen = solid.look(cam)
        H, W = mask.shape
        m = (mask > 127).astype(np.uint8) * 255

        def outline(k_, cx_, cy_):
            M = np.float32([[k_ * seen.px, 0, cx_ + k_ * seen.x0], [0, k_ * seen.px, cy_ - k_ * seen.y1]])
            return cv2.warpAffine(seen.soft, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=-1.0) > 0

        # settle the scale and place on the true outline (the camera search works on a small copy)
        best = _iou(outline(k, cx, cy), m)
        first = best
        for step in (4.0, 2.0, 1.0, 0.5):
            moved = True
            while moved:
                moved = False
                for dk, dx, dy in ((0.004 * step, 0, 0), (-0.004 * step, 0, 0), (0, step, 0), (0, -step, 0), (0, 0, step), (0, 0, -step)):
                    k2 = k * (1 + dk)
                    # the scale changes about the outline's middle
                    ys, xs = np.nonzero(m)
                    mx, my = xs.mean(), ys.mean()
                    cx2 = mx + (cx - mx) * (1 + dk) + dx
                    cy2 = my + (cy - my) * (1 + dk) + dy
                    s = _iou(outline(k2, cx2, cy2), m)
                    if s > best + 1e-5:
                        best, k, cx, cy, moved = s, k2, cx2, cy2, True
        self.k, self.cx, self.cy = k, cx, cy
        sil = outline(k, cx, cy)
        self.flow = None
        self.match = (first, best, best)
        if bend:
            # the last few pixels: the picture is bent so its outline lies on the solid's
            clip = max(12.0, 0.03 * H)
            dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
            fl = dis.calc(_sdf(sil, clip), _sdf(m, clip), None)
            fl = cv2.GaussianBlur(fl, (0, 0), 5)
            lim = 0.05 * H
            mag = np.maximum(np.linalg.norm(fl, axis=2, keepdims=True), 1e-6)
            fl = fl * np.minimum(1.0, lim / mag)
            yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
            bent = cv2.remap(m, xx + fl[..., 0], yy + fl[..., 1], cv2.INTER_LINEAR, borderValue=0) > 127
            after = _iou(bent, sil)
            if after > best:
                self.flow = fl
                self.match = (first, best, after)
        if log is not None:
            log('%s picture: outline match %.3f, settled %.3f, bent %.3f' % ((name,) + self.match))
        self.seen = solid.look(Camera(cam.az + math.pi, -cam.el)) if behind else seen
        self.outline = sil

    def place(self, P):
        """picture pixel (u, v) of world points"""
        C = self.cam.to(P)
        u = (self.cx + self.k * C[:, 0]).astype(np.float32)
        v = (self.cy - self.k * C[:, 1]).astype(np.float32)
        if self.flow is not None:
            f = _sample(self.flow, u, v, cv2.INTER_LINEAR)
            u, v = u + f[:, 0], v + f[:, 1]
        return u, v

    def colour(self, P):
        u, v = self.place(P)
        return _sample(self.img, u, v, cv2.INTER_CUBIC).astype(np.float32)

    def weight(self, P, N, power=3.0):
        """how much of a point's colour this picture should give: it must see the point, and
        square on counts for more than at a slant"""
        facing = np.clip(-(N @ self.seen.cam.into), 0, 1)
        return self.rank * self.seen.sees(P) * facing ** power


# ------------------------------------------------------------------ mesh, unwrap, texels
def mesh(solid, name, tris):
    """the solid's surface as a Blender object thinned to about `tris` triangles"""
    import bpy
    P = solid.points()
    F = solid.faces                   # (index -> world mirrors, which turns skimage's inward winding outward)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(P))
    me.vertices.foreach_set('co', P.astype(np.float32).ravel())
    me.loops.add(F.size)
    me.loops.foreach_set('vertex_index', F.astype(np.int32).ravel())
    me.polygons.add(len(F))
    me.polygons.foreach_set('loop_start', np.arange(0, F.size, 3, dtype=np.int32))
    me.polygons.foreach_set('loop_total', np.full(len(F), 3, np.int32))
    me.update(calc_edges=True)
    me.validate()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if len(F) > tris:
        d = ob.modifiers.new('dec', 'DECIMATE')
        d.ratio = tris / len(F)
        d.use_collapse_triangulate = True
        kit.apply_mods(ob)
    me = ob.data
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
    me.update()
    return ob


# the six ways a patch of surface can face, and the two axes its flat picture is drawn along
DIRS = np.array([[0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, 1], [0, 0, -1]], float)
AXES = np.array([[[1, 0, 0], [0, 0, 1]], [[1, 0, 0], [0, 0, 1]], [[0, 1, 0], [0, 0, 1]], [[0, 1, 0], [0, 0, 1]],
                 [[1, 0, 0], [0, 1, 0]], [[1, 0, 0], [0, 1, 0]]], float)
DENSITY = 300.0       # texels a world unit, about what a side's six pieces get in the atlas


def _mesh_np(me):
    """corners (V, 3), triangles (F, 3 corner indices), pairs of faces that share an edge (E, 2)
    and those edges' lengths"""
    V = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', V)
    V = V.reshape(-1, 3)
    F = np.zeros(len(me.polygons) * 3, np.int64)
    me.polygons.foreach_get('vertices', F)
    F = F.reshape(-1, 3)
    e = np.sort(np.stack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]], 1).reshape(-1, 2), 1)
    key = e[:, 0] * len(V) + e[:, 1]
    order = np.argsort(key, kind='stable')
    k = key[order]
    same = k[1:] == k[:-1]
    # an edge with exactly two faces joins them (edges with one or three are borders)
    first = np.r_[True, ~same]
    count = np.add.reduceat(np.ones(len(k), np.int64), np.nonzero(first)[0])
    start = np.nonzero(first)[0][count == 2]
    pairs = np.stack([order[start] // 3, order[start + 1] // 3], 1)
    ev = e[order[start]]
    return V, F, pairs, np.linalg.norm(V[ev[:, 0]] - V[ev[:, 1]], axis=1)


def _parts(n, pairs, same):
    """labels of the connected parts of n faces, joined by the pairs where `same` holds"""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    p = pairs[same]
    g = coo_matrix((np.ones(len(p), np.int8), (p[:, 0], p[:, 1])), shape=(n, n))
    return connected_components(g, directed=False)[1]


def _hidden(V, F, faces, d, density=DENSITY):
    """of one patch's faces (all seen from direction d), those lying behind others of the patch:
    a flat picture of the patch has room for the nearest surface only"""
    a = AXES[d]
    T = V[F[faces]]                                   # (n, 3, 3)
    uv = np.stack([T @ a[0], T @ a[1]], -1) * density
    depth = (T @ DIRS[d]).mean(1)
    lo = uv.reshape(-1, 2).min(0) - 2
    size = np.ceil(uv.reshape(-1, 2).max(0) - lo).astype(int) + 3
    ids = np.zeros((size[1], size[0]), np.int32)
    pts = np.round((uv - lo) * 16).astype(np.int32)
    for i in np.argsort(depth):                       # far to near: the nearest face keeps a texel
        cv2.fillConvexPoly(ids, pts[i], int(i) + 1, lineType=cv2.LINE_8, shift=4)
    own = np.bincount(ids.ravel(), minlength=len(faces) + 1)[1:]
    e1, e2 = uv[:, 1] - uv[:, 0], uv[:, 2] - uv[:, 0]
    want = np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]) / 2
    return (own < 0.4 * want) & (want >= 2.5) | (own == 0) & (want >= 0.6)


def chart(ob, fine=None, smooth=0.6, steep=0.3, small=0.0015, specks=40.0):
    """cuts ob's surface into patches that each face one way and lie flat without overlap, and
    lays each out as its own picture (uv = the patch seen straight on). fine, a number 0..1 a
    face, says how well the front picture shows it: patches it shows are drawn at full scale
    and the others at THIN of it, so the atlas keeps the picture's own detail.
    The patches still sit on top of each other: pack() spreads them over the atlas."""
    me = ob.data
    V, F, pairs, elen = _mesh_np(me)
    nf = len(F)
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    area = np.linalg.norm(n, axis=1) / 2
    n /= np.maximum(2 * area[:, None], 1e-12)
    cos = n @ DIRS.T                                   # (F, 6)
    data = np.where(cos > steep, 1 - cos, 9.0)
    lab = cos.argmax(1)
    perim = np.zeros(nf)
    np.add.at(perim, pairs[:, 0], elen)
    np.add.at(perim, pairs[:, 1], elen)
    perim = np.maximum(perim, 1e-9)
    rng = np.random.default_rng(3)
    for it in range(14):
        # a face joins the neighbours' way of facing where its own slant allows: fewer, larger patches
        W = np.zeros((nf, 6))
        np.add.at(W, (pairs[:, 0], lab[pairs[:, 1]]), elen)
        np.add.at(W, (pairs[:, 1], lab[pairs[:, 0]]), elen)
        new = (data + smooth * (1 - W / perim[:, None])).argmin(1)
        move = rng.random(nf) < 0.6
        lab = np.where(move, new, lab)
    part = _parts(nf, pairs, lab[pairs[:, 0]] == lab[pairs[:, 1]])
    # patches too small to be worth a seam join the neighbour they share most edge with
    total = area.sum()
    for it in range(6):
        pa = np.bincount(part, weights=area)
        a, b = part[pairs[:, 0]], part[pairs[:, 1]]
        cut = a != b
        changed = False
        tiny = np.nonzero(pa < small * total)[0]
        if not len(tiny):
            break
        istiny = np.zeros(len(pa), bool)
        istiny[tiny] = True
        # shared edge length between each tiny patch and each neighbour's label
        share = {}
        for i in np.nonzero(cut & (istiny[a] | istiny[b]))[0]:
            for x, y in ((a[i], pairs[i, 1]), (b[i], pairs[i, 0])):
                if istiny[x]:
                    share.setdefault(int(x), {}).setdefault(int(lab[y]), 0.0)
                    share[int(x)][int(lab[y])] += elen[i]
        for x, opts in share.items():
            fs = np.nonzero(part == x)[0]
            for d in sorted(opts, key=opts.get, reverse=True):
                if d != lab[fs[0]] and cos[fs, d].min() > 0.12:
                    lab[fs] = d
                    changed = True
                    break
        if not changed:
            break
        part = _parts(nf, pairs, lab[pairs[:, 0]] == lab[pairs[:, 1]])
    # a patch that folds behind itself is cut into its layers
    layer = np.zeros(nf, np.int64)
    for rnd in range(4):
        key = part * 8 + layer
        again = False
        part2 = _parts(nf, pairs, key[pairs[:, 0]] == key[pairs[:, 1]])
        order = np.argsort(part2, kind='stable')
        cuts = np.nonzero(np.diff(part2[order]))[0] + 1
        for fs in np.split(order, cuts):
            if len(fs) < 8:
                continue
            h = _hidden(V, F, fs, lab[fs[0]])
            if h.sum() >= 4 and area[fs[h]].sum() > 0.0004 * total:
                layer[fs[h]] += 1
                again = True
        part = part2
        if not again:
            break
    key = part * 8 + layer
    part = _parts(nf, pairs, key[pairs[:, 0]] == key[pairs[:, 1]])
    # uvs: each patch seen straight on, set apart from the others so that each stays one island
    if not me.uv_layers:
        me.uv_layers.new(name='uv')
    T = V[F]
    ax = AXES[lab]                                     # (F, 2, 3)
    uv = np.stack([np.einsum('fkc,fc->fk', T, ax[:, 0]), np.einsum('fkc,fc->fk', T, ax[:, 1])], -1)
    if fine is not None:
        pa = np.maximum(np.bincount(part, weights=area), 1e-12)
        shown = np.bincount(part, weights=area * fine) / pa
        scale = THIN + (1 - THIN) * np.clip((shown - 0.2) / 0.4, 0, 1)
        # what faces the table is never looked at: the under side of the base, of arms and hems
        down = np.bincount(part, weights=area * (lab == 5)) / pa > 0.5
        scale[down] = UNDER
        uv = uv * scale[part][:, None, None]
    uv = uv + np.stack([part % 64, part // 64], 1)[:, None, :] * 8.0
    # a patch of a few texels is not worth a place of its own: it is drawn as one point of a
    # neighbouring patch, whose colour there it takes
    e1, e2 = uv[:, 1] - uv[:, 0], uv[:, 2] - uv[:, 0]
    tex = np.bincount(part, weights=np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]) / 2 * DENSITY ** 2)
    speck = tex < specks
    a, b = part[pairs[:, 0]], part[pairs[:, 1]]
    folded = 0
    for x, y in ((0, 1), (1, 0)):
        px, py = (a, b) if x == 0 else (b, a)
        sel = np.nonzero(speck[px] & ~speck[py])[0]
        # one joining edge a speck (the first found)
        first = {}
        for i in sel:
            first.setdefault(int(px[i]), i)
        for patch, i in first.items():
            if not speck[patch]:
                continue
            fx, fy = pairs[i, x], pairs[i, y]
            shared = np.intersect1d(F[fx], F[fy])
            if not len(shared):
                continue
            k = int(np.nonzero(F[fy] == shared[0])[0][0])
            uv[part == patch] = uv[fy, k]
            speck[patch] = False
            folded += 1
    loops = np.zeros(len(me.polygons), np.int64)
    me.polygons.foreach_get('loop_start', loops)
    out = np.zeros((len(me.loops), 2), np.float32)
    out[(loops[:, None] + np.arange(3)).ravel()] = uv.reshape(-1, 2)
    me.uv_layers[0].data.foreach_set('uv', out.ravel())
    me.update()
    return int(part.max()) + 1 - folded


def _uvs(ob):
    uv = np.zeros(len(ob.data.loops) * 2, np.float32)
    ob.data.uv_layers[0].data.foreach_get('uv', uv)
    return uv.reshape(-1, 2)


def pack(obs, margin=MARGIN, size=ATLAS):
    """spreads the patches of all the given objects (two or more) over one atlas, at one scale.
    Blender packs into the box the patches start in, so they are first set out in a box of the
    atlas's own shape: every object's patches against the bottom left corner, the last object
    pushed out to the box's far edge."""
    import bpy
    aspect = size[0] / size[1]
    uvs = [_uvs(ob) for ob in obs]
    for uv in uvs:
        uv -= uv.min(0)
    w, h = max(uv[:, 0].max() for uv in uvs), max(uv[:, 1].max() for uv in uvs)
    if w / h >= aspect:
        h = w / aspect
        uvs[-1][:, 1] += h - uvs[-1][:, 1].max()
    else:
        w = h * aspect
        uvs[-1][:, 0] += w - uvs[-1][:, 0].max()
    for ob, uv in zip(obs, uvs):
        ob.data.uv_layers[0].data.foreach_set('uv', uv.ravel())
        ob.data.update()
    for o in list(bpy.context.selected_objects):
        o.select_set(False)
    for ob in obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(udim_source='ORIGINAL_AABB', rotate=True, rotate_method='CARDINAL', scale=True,
                            merge_overlap=False, margin_method='FRACTION', margin=margin, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    for ob in obs:
        ob.select_set(False)
        uv = _uvs(ob)
        uv /= (w, h)
        ob.data.uv_layers[0].data.foreach_set('uv', uv.ravel())
        ob.data.update()


def texels(ob, size=ATLAS):
    """the atlas texels ob's faces cover: (rows, cols, P, N) with each texel's world point and
    the mesh's smooth normal there"""
    me = ob.data
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    tl = np.zeros(nt * 3, np.int32)
    me.loop_triangles.foreach_get('loops', tl)
    tl = tl.reshape(-1, 3)
    lv = np.zeros(len(me.loops), np.int32)
    me.loops.foreach_get('vertex_index', lv)
    uv = np.zeros(len(me.loops) * 2, np.float32)
    me.uv_layers[0].data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)
    co = np.zeros(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    cn = np.zeros(len(me.loops) * 3, np.float32)
    me.corner_normals.foreach_get('vector', cn)
    cn = cn.reshape(-1, 3)
    T = uv[tl] * np.float32(size) - 0.5           # (nt, 3, 2) in texel-centre coordinates
    ids = np.zeros((size[1], size[0]), np.int32)
    pts = np.round(T * 16).astype(np.int32)
    for i in range(nt):
        cv2.fillConvexPoly(ids, pts[i], i + 1, lineType=cv2.LINE_8, shift=4)
    rows, cols = np.nonzero(ids)
    t = ids[rows, cols] - 1
    a, b, c = T[t, 0], T[t, 1], T[t, 2]
    p = np.stack([cols, rows], 1).astype(np.float32)
    v0, v1, v2 = b - a, c - a, p - a
    den = v0[:, 0] * v1[:, 1] - v1[:, 0] * v0[:, 1]
    den = np.where(np.abs(den) < 1e-9, 1e-9, den)
    w1 = (v2[:, 0] * v1[:, 1] - v1[:, 0] * v2[:, 1]) / den
    w2 = (v0[:, 0] * v2[:, 1] - v2[:, 0] * v0[:, 1]) / den
    w1, w2 = np.clip(w1, -0.25, 1.25), np.clip(w2, -0.25, 1.25)
    w0 = 1 - w1 - w2
    L = tl[t]
    P = co[lv[L[:, 0]]] * w0[:, None] + co[lv[L[:, 1]]] * w1[:, None] + co[lv[L[:, 2]]] * w2[:, None]
    N = cn[L[:, 0]] * w0[:, None] + cn[L[:, 1]] * w1[:, None] + cn[L[:, 2]] * w2[:, None]
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    return rows, cols, P.astype(np.float64), N.astype(np.float64)


def paint(P, N, pictures, cover=0.03, sharp=4.0, cell=0.006):
    """colours (n, 3 BGR) for surface points from the pictures that see them. A point takes the
    picture that sees it best, and two pictures mix only where they see it about equally (an
    even mix of two pictures of one place is a double exposure). A stand-in picture (spare:
    the front showing through to the back) is used only where no true picture sees the point,
    and the points nothing sees are filled from the painted ones round them (see _fill).
    Returns (colours, seen)."""
    col = np.zeros((len(P), 3), np.float32)
    best = np.zeros(len(P), np.float32)
    for spare in (False, True):
        acc = np.zeros((len(P), 3), np.float32)
        ws = np.zeros(len(P), np.float32)
        top = np.zeros(len(P), np.float32)
        for pic in pictures:
            if bool(getattr(pic, 'spare', False)) != spare:
                continue
            w = pic.weight(P, N).astype(np.float32)
            wp = w ** sharp
            acc += pic.colour(P) * wp[:, None]
            ws += wp
            top = np.maximum(top, w)
        take = (top > best) & (best <= cover)
        col[take] = acc[take] / np.maximum(ws[take], 1e-30)[:, None]
        best[take] = top[take]
    ok = best > cover
    if (~ok).any() and ok.any():
        near = _fill(P, col, ok, cell)
        # a point the pictures only just see keeps a share of its own colour
        own = (best[~ok] / cover)[:, None]
        col[~ok] = near * (1 - own) + col[~ok] * own
    return np.clip(col, 0, 255), ok


def _fill(P, col, ok, cell):
    """colours for the points nothing sees, from the painted points round them, averaged over a
    width that grows with the distance to the nearest painted point: just past the edge of the
    paint a point carries the paint on, and deep in a fold or under an arm it takes a soft tone
    of its surroundings (the nearest few texels alone would streak out across it)"""
    from scipy.spatial import cKDTree
    src, need = P[ok], P[~ok]
    sc = col[ok]
    d1 = cKDTree(src).query(need, k=1, workers=-1)[0]
    lev = np.log2(np.maximum(d1, cell) / cell)
    out = np.zeros((len(need), 3), np.float32)
    wsum = np.zeros(len(need), np.float32)
    for L in range(int(math.ceil(float(lev.max()))) + 2):
        tri = np.clip(1 - np.abs(lev - L), 0, 1).astype(np.float32)
        sel = np.nonzero(tri > 0)[0]
        if not len(sel):
            continue
        h = cell * 2.0 ** L
        ijk = np.floor(src / h).astype(np.int64) + (1 << 20)
        key = (ijk[:, 0] << 42) | (ijk[:, 1] << 21) | ijk[:, 2]
        _, inv, cnt = np.unique(key, return_inverse=True, return_counts=True)
        mid = np.stack([np.bincount(inv, src[:, a]) for a in range(3)], 1) / cnt[:, None]
        tone = np.stack([np.bincount(inv, sc[:, a]) for a in range(3)], 1) / cnt[:, None]
        k = min(8, len(mid))
        d, i = cKDTree(mid).query(need[sel], k=k, workers=-1)
        d, i = d.reshape(len(sel), k), i.reshape(len(sel), k)
        w = (cnt[i] / (d * d + (0.5 * h) ** 2) ** 2).astype(np.float32)
        c = (tone[i] * w[..., None]).sum(1) / w.sum(1, keepdims=True)
        out[sel] += c.astype(np.float32) * tri[sel, None]
        wsum[sel] += tri[sel]
    return out / np.maximum(wsum, 1e-6)[:, None]


# ------------------------------------------------------------------ the sides and the back
# The picture shows the front. The back and the sides are drawn by the picture model too: the
# solid, painted from what there is so far and lit like clay where there is nothing, is shown to
# it from behind and from each side, and it redraws that view as a finished picture of the same
# piece, held to the solid's outline. Blender's Python has no torch, so this goes in two steps
# like the shapes: the build queues the views it lacks and stops;
#   ~/.cache/chackmate/pv/bin/python tools/model/picture/i2i.py ~/.cache/chackmate-views/todo/jobs.tsv ~/.cache/chackmate-views
# draws them (about 20 s each), and the next build uses them. The back is drawn first and the
# sides after it, from a solid that already has its back, so a set takes two rounds.
VIEWS_DIR = os.environ.get('SCULPT_VIEWS', os.path.expanduser('~/.cache/chackmate-views'))
VIEW_VERSION = 1      # raise it when a change here should have every view drawn again
# (name, degrees round from the front picture's camera, the round it is drawn in)
ROUND = [('back', 180, 0), ('left', 90, 1), ('right', -90, 1)]
RAISED = 22           # the views' camera looks down a little, so the tops of things are drawn too
FACING = [(0, 'front view, facing the camera'), (90, 'side view, profile'), (180, 'back view, seen from behind'),
          (270, 'side view, profile')]
TAIL = 'premium collectible figurine, crisp fine detail, studio photo, plain grey background'
CANVAS = (768, 1024)


class NoView(Exception):
    """a view of a piece is not drawn yet; it is queued for picture/i2i.py"""


def shot(solid, cam, pictures, px=None, clay=True):
    """the solid as a camera sees it, painted from the true pictures (not the stand-ins: a
    front showing through to the back would be redrawn as a second face). With clay, the
    surface no picture shows, which only has the soft tones of the paint round it, is lit as
    a studio picture is (a key light from the upper left, shade in the folds), so that the
    picture model can read its form: (Seen, colours h x w x 3)"""
    seen = solid.look(cam, px=px)
    P = seen.points()[seen.hit]
    P = solid.snap(P, 1)
    N, _ = solid.normal(P)
    col, ok = paint(P, N, [p for p in pictures if not p.spare], cell=solid.q)
    if clay and (~ok).any():
        Nc = cam.to(N[~ok])
        key = np.array([-0.45, 0.65, -0.6])
        key /= np.linalg.norm(key)
        lit = 0.42 + 0.7 * np.clip(Nc @ key, 0, 1) + 0.12 * np.clip(Nc[:, 1], 0, 1)
        # shade where the surface is hemmed in: steps out along the normal that end up inside
        Pn, Nn = P[~ok], N[~ok]
        shut = np.zeros(len(Pn))
        for r in (3.0, 7.0, 14.0):
            shut += solid.value(Pn + Nn * (r * solid.q)) > 0
        lit *= 1 - 0.22 * shut
        col[~ok] = np.clip(col[~ok] * lit[:, None].astype(np.float32), 0, 255)
    img = np.zeros(seen.hit.shape + (3,), np.float32)
    img[seen.hit] = col
    return seen, img


def canvas(seen, img, fill=0.86, foot=0.94):
    """a shot set on the picture model's grey frame, standing near the bottom.
    Returns (frame BGR uint8, mask uint8, k, cx, cy): camera (x, y) sits at frame pixel
    (cx + k x, cy - k y)."""
    W, H = CANVAS
    h, w = img.shape[:2]
    f = min(fill * H / h, fill * W / w)
    w2, h2 = max(1, int(round(w * f))), max(1, int(round(h * f)))
    fx, fy = w2 / w, h2 / h
    col = _spread(img, seen.hit)
    col = cv2.resize(col, (w2, h2), interpolation=cv2.INTER_CUBIC)
    a = cv2.resize(seen.soft, (w2, h2), interpolation=cv2.INTER_LINEAR)
    a = np.clip(a / max(float(np.abs(seen.soft).max()), 1e-6) * 40 + 0.5, 0, 1)[..., None]
    ox, oy = (W - w2) // 2, int(H * foot) - h2
    out = np.full((H, W, 3), 128, np.float32)
    out[oy:oy + h2, ox:ox + w2] = col * a + 128 * (1 - a)
    mask = np.zeros((H, W), np.uint8)
    mask[oy:oy + h2, ox:ox + w2] = (a[..., 0] * 255).astype(np.uint8)
    k = fx / seen.px
    return np.clip(out, 0, 255).astype(np.uint8), mask, k, ox - k * seen.x0, oy + k * seen.y1


def view(solid, front, pictures, name, turn, words, strength=0.8, seed=7, log=None):
    """the picture model's picture of the solid from another side, as a Picture; raises NoView
    (after queueing it) when it is not drawn yet. turn: degrees round from the front picture's
    camera; words: what the piece is."""
    import hashlib
    cam = Camera(front.cam.az + math.radians(turn), math.radians(RAISED))
    # what the view shows of the piece, which faces the world's -y: its front, a side or its back
    facing = min(FACING, key=lambda f: abs((math.degrees(cam.az) - f[0] + 180) % 360 - 180))[1]
    prompt = '%s, %s, %s' % (facing, words, TAIL)
    ident = '|'.join([str(VIEW_VERSION)] + [p.key for p in pictures if not p.spare] + [name, '%g' % turn, '%g' % RAISED, prompt, '%g' % strength, str(seed)])
    key = hashlib.sha1(ident.encode()).hexdigest()[:20]
    path, side = os.path.join(VIEWS_DIR, key + '.png'), os.path.join(VIEWS_DIR, key + '.npz')
    if not (os.path.exists(path) and os.path.exists(side)):
        seen, img = shot(solid, cam, pictures)
        frame, mask, k, cx, cy = canvas(seen, img)
        todo = os.path.join(VIEWS_DIR, 'todo')
        os.makedirs(todo, exist_ok=True)
        cv2.imwrite(os.path.join(todo, key + '.png'), frame)
        cv2.imwrite(os.path.join(todo, key + '.mask.png'), mask)
        np.savez_compressed(side, mask=mask, place=np.array([k, cx, cy]))
        with open(os.path.join(todo, 'jobs.tsv'), 'a') as f:
            f.write('%s\t%s\t%g\t%d\t%s\n' % (key, os.path.join(todo, key + '.png'), strength, seed, prompt))
        raise NoView(key)
    z = np.load(side)
    k, cx, cy = z['place']
    pic = Picture(solid, cv2.imread(path), z['mask'], cam, float(k), float(cx), float(cy), name=name, bend=False, rank=0.7, log=log)
    pic.key = key
    return pic


# ------------------------------------------------------------------ materials
def materials(col, look):
    """the look of a painted atlas (BGR): the colours after the set's white balance and gold
    tone, the roughness/metalness map and the glow map, as kit.paint_cell makes them a cell"""
    cls = look.get('classify', {})
    ids = kit.classify(col, **cls)
    gw = kit.gold_weight(col, **cls)
    gw[ids == 2] = 0
    if look.get('gold_tone') is not None:
        tone = np.array(look['gold_tone'], np.float32)
        c = col.astype(np.float32)
        lum = c.mean(2, keepdims=True) / 255
        mix = look.get('gold_mix', 0.65) * gw[..., None]
        col = np.clip(c * (1 - mix) + tone * mix * (0.95 + 0.75 * lum), 0, 255).astype(np.uint8)
    if look.get('wb'):
        col = np.clip(col.astype(np.float32) * np.array(look['wb'], np.float32), 0, 255).astype(np.uint8)
    if look.get('body_gain'):
        b = ids == 0
        col[b] = np.clip(col[b].astype(np.float32) * look['body_gain'], 0, 255).astype(np.uint8)
    (br, bm), (gr, gm), (er, em) = kit._mat(look['body']), kit._mat(look['gold']), kit._mat(look['gem'])
    m = np.zeros(col.shape, np.float32)
    m[..., 1] = (br * (1 - gw) + gr * gw) * 255
    m[..., 0] = (bm * (1 - gw) + gm * gw) * 255
    gem = ids == 2
    m[gem, 1], m[gem, 0] = er * 255, em * 255
    mr = m.clip(0, 255).astype(np.uint8)       # as a picture file: blue metalness, green roughness (what three.js reads)
    g = col.astype(np.float32) * look.get('emit', 0.1)
    g[gem] = col[gem].astype(np.float32) * max(look.get('gem_glow', 0.45), look.get('emit', 0.1))
    return col, mr, g.clip(0, 255).astype(np.uint8)


def _spread(img, filled):
    """texels no face covers take the nearest covered texel's value, so that neither the
    renderer's filtering nor its smaller copies of the atlas ever mix in an empty one"""
    from scipy.ndimage import distance_transform_edt
    i = distance_transform_edt(~filled, return_distances=False, return_indices=True)
    return img[i[0], i[1]]


# ------------------------------------------------------------------ a set
def pieces(sid, mod, caps, log=print):
    """build.py's work for a sculpted set: the pieces' meshes (thinned to the 'show' budget and
    unwrapped) and each side's painted atlas.
    Returns (refs, built, atlas, mr, glow, normal): built = [(type, side, True, object)], the
    rest {side: picture}."""
    refs = mod.refs()
    only = os.environ.get('SCULPT_ONLY')      # one side only, while trying things: w or b
    if only:
        refs = {only: refs[only]}
    todo = []
    vols = {}
    for s in refs:
        for t in kit.TYPES:
            try:
                vols[s, t] = tsg.volume(refs[s][t].crop, refs[s][t].mask)[0]
            except tsg.Missing as e:
                todo.append('%s-%s %s' % (s, t, e))
    if todo:
        raise SystemExit('%s: %d shape(s) are not made yet (%s).\nMake them with:  ~/.cache/chackmate/pv/bin/python tools/model/tsg.py\nand build again.'
                         % (sid, len(todo), ', '.join(todo)))
    turn = getattr(mod, 'TURN', {})
    words = getattr(mod, 'WORDS', None)       # what each piece is, for the pictures of its back and sides
    solids, pics, lack = {}, {}, []
    for s in refs:
        for t in kit.TYPES:
            r = refs[s][t]
            say = lambda m, s=s, t=t: log(sid, s, t, m)
            S = Solid(vols.pop((s, t)), r.height())
            cam, k, cx, cy, _ = find_camera(S, r.mask, log=say)
            tn = math.radians(turn.get(s + t, turn.get(t, 0)))
            S.turn = tn - cam.az
            cam = Camera(tn, cam.el)
            front = Picture(S, r.crop, r.mask, cam, k, cx, cy, log=say)
            front.key = tsg.key(tsg.square(r.crop, r.mask)[0])
            behind = Picture(S, r.crop, r.mask, cam, front.k, front.cx, front.cy, name='through', bend=False, behind=True, rank=0.5, spare=True)
            behind.flow = front.flow
            ps = [front, behind]
            for rnd in sorted({v[2] for v in ROUND}) if words else ():
                got = []
                for name, deg, _ in [v for v in ROUND if v[2] == rnd]:
                    try:
                        got.append(view(S, front, ps, name, deg, words[s][t], log=say))
                    except NoView as e:
                        lack.append('%s-%s %s' % (s, t, name))
                ps = ps + got
                if lack and lack[-1].startswith('%s-%s ' % (s, t)):
                    break                      # the next round is drawn from a solid that has this one's pictures
            solids[s, t], pics[s, t] = S, ps
    if lack:
        raise SystemExit('%s: %d picture(s) of backs and sides are not drawn yet (%s).\nDraw them with:  ~/.cache/chackmate/pv/bin/python tools/model/picture/i2i.py %s/todo/jobs.tsv %s\nand build again (the sides are drawn after the backs: two rounds).'
                         % (sid, len(lack), ', '.join(lack), VIEWS_DIR, VIEWS_DIR))
    built, atlas, mr, glow, normal = [], {}, {}, {}, {}
    for s in refs:
        look = mod.LOOK[s] if s in mod.LOOK else mod.LOOK
        obs = {}
        for t in kit.TYPES:
            obs[t] = mesh(solids[s, t], '%s-%s' % (s, t), caps.get(t, caps['default']))
            built.append((t, s, True, obs[t]))
        for t in kit.TYPES:
            # the surface the front picture shows squarely is laid out at full scale
            V, F, _, _ = _mesh_np(obs[t].data)
            fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
            fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
            fine = np.clip(pics[s, t][0].weight(V[F].mean(1), fn) / 0.15, 0, 1)
            log(sid, s, t, '%d patches' % chart(obs[t], fine))
        pack([obs[t] for t in kit.TYPES])
        W, H = ATLAS
        col = np.zeros((H, W, 3), np.float32)
        nrm = np.zeros((H, W, 3), np.float32)
        filled = np.zeros((H, W), bool)
        for t in kit.TYPES:
            rows, cols, P, N = texels(obs[t])
            S = solids[s, t]
            P = S.snap(P)
            Nv, slope = S.normal(P)
            # where the volume has no clear slope (deep inside a fold) the mesh's own normal stands
            weak = slope < 20
            Nv[weak] = N[weak]
            c, seen = paint(P, Nv, pics[s, t], cell=S.q)
            col[rows, cols] = c
            nrm[rows, cols] = Nv
            filled[rows, cols] = True
            sq = pics[s, t][0].weight(P, Nv) > 0.15
            log(sid, s, t, '%d texels, %.0f%% seen by a picture; the front picture gives %d (it has %d)'
                % (len(rows), 100 * seen.mean(), sq.sum(), int((refs[s][t].mask > 127).sum())))
            solids[s, t] = pics[s, t] = None
        col = _spread(col, filled).astype(np.uint8)
        nrm = _spread(nrm, filled)
        log(sid, s, 'atlas %.0f%% used' % (100 * filled.mean()))
        atlas[s], mr[s], glow[s] = materials(col, look)
        # the normal map is in the game's frame: Blender (x, y, z) -> game (x, z, -y), as R, G, B
        g = np.stack([nrm[..., 0], nrm[..., 2], -nrm[..., 1]], -1)
        normal[s] = np.clip(g[..., ::-1] * 127.5 + 127.5, 0, 255).astype(np.uint8)
    if only:
        # the game wants both sides' pictures: the other side borrows this one's (its pieces stay the coded ones)
        other = 'b' if only == 'w' else 'w'
        refs[other] = refs[only]
        for d in (atlas, mr, glow, normal):
            d[other] = d[only]
    return refs, built, atlas, mr, glow, normal
