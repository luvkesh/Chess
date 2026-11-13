"""Modelling kit for Chackmate's modelled piece sets. Runs inside Blender's Python (bpy).

Every piece is modelled to its reference picture:
  * a Ref holds one piece cut out of the picture (crop + mask) and maps picture pixels to game
    units, so profiles, crowns and crosses take the picture's real proportions;
  * lathe() turns the traced outline into a smooth body; shell() makes thin notched rings
    (crowns, coronets, battlements); slab() extrudes a flat outline (crosses, shields, plumes);
  * every part is painted by projecting the picture back onto it. The projection is folded
    round the axis (fold=N repeats the front ornament N times, mirrored), so gems, filigree and
    fleurs-de-lis come from the picture itself and the sides never stretch;
  * paint() builds the side's atlas cell (colour, roughness/metalness) from the picture.

Axes: Blender z is up and the piece's front looks down -y. export() turns that into the game's
y-up, front +z frame.
"""
import math

import bpy  # noqa: F401  (bmesh needs bpy loaded first)
import bmesh
import cv2
import numpy as np
from mathutils import Vector

# ------------------------------------------------------------------ atlas frame
# Each piece type has a cell in the atlas. A cell spans CELL_W x CELL_H world units, centred on
# the piece's axis with the foot at the bottom. Both sides share the frame (the white and black
# pictures are each resampled into it), so one set of UVs serves both atlases.
TYPES = ['k', 'q', 'b', 'n', 'r', 'p']
PX_PER_UNIT = 360
CELL_W, CELL_H = 1.24, 2.12
CW, CH = int(CELL_W * PX_PER_UNIT), int(CELL_H * PX_PER_UNIT)
COLS, ROWS = 3, 2
ATLAS_W, ATLAS_H = CW * COLS, CH * ROWS


def cell_uv(t, x, z):
    """world (x across the picture, z up) on piece type t -> atlas uv (v down, flipY false)."""
    i = TYPES.index(t)
    cx, cy = (i % COLS) * CW, (i // COLS) * CH
    px = cx + (x / CELL_W + 0.5) * CW
    py = cy + (1 - z / CELL_H) * CH
    return px / ATLAS_W, py / ATLAS_H


# ------------------------------------------------------------------ reference cut-outs
class Ref:
    """One piece cut from a reference picture. unit = game units per pixel."""

    def __init__(self, path, box, unit=None, height=None, pad=14, iters=8, flip=False, mask=None, foot=0.12, seg='grabcut', thresh=10, core=None, sym=False, pos=None, neg=None):
        self.sym = sym
        img = cv2.imread(path)
        x0, y0, x1, y1 = box
        X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
        X1, Y1 = min(img.shape[1], x1 + pad), min(img.shape[0], y1 + pad)
        crop = img[Y0:Y1, X0:X1].copy()
        if mask is None and seg == 'sam':
            import sam
            w, h = x1 - x0, y1 - y0
            cx = (x0 + x1) / 2
            # positives up the middle of the box, negatives just inside its corners (backdrop or
            # neighbours), plus any given in picture pixels
            # a vote over a few prompt sets: SAM-B on one set of points can swallow a neighbour
            sets_ = [pos] if pos is not None else [[(cx + w * dx, y0 + h * f) for f in fs]
                                                   for dx, fs in ((0, (0.12, 0.3, 0.55, 0.8)), (0, (0.2, 0.4, 0.6, 0.85)),
                                                                  (-0.06, (0.12, 0.35, 0.6, 0.85)), (0.06, (0.12, 0.35, 0.6, 0.85)))]
            N = [(x - X0, y - Y0) for x, y in (neg or [])]
            votes = sum((sam.cut(crop, [(x - X0, y - Y0) for x, y in P], N) > 0).astype(np.int32) for P in sets_)
            m = np.where(votes * 2 > len(sets_), 255, 0).astype(np.uint8)
            m[:, :max(0, x0 - X0 - 2)] = 0
            m[:, x1 - X0 + 2:] = 0
        elif mask is None and seg == 'diff':
            m = diff_mask(crop, (x0 - X0, y0 - Y0, x1 - X0, y1 - Y0), thresh)
        elif mask is None:
            cv2.setRNGSeed(7)   # GrabCut seeds its colour models with k-means: keep cut-outs repeatable
            bg, fg = np.zeros((1, 65)), np.zeros((1, 65))
            if core:
                # dark pieces on a dark board: seed a sure core (a strip up the middle of the
                # box) so GrabCut knows the piece's own colours
                m = np.full(crop.shape[:2], cv2.GC_BGD, np.uint8)
                m[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = cv2.GC_PR_FGD
                cx, w, h = (x0 + x1) / 2 - X0, x1 - x0, y1 - y0
                a, b = int(cx - w * core[0] / 2), int(cx + w * core[0] / 2)
                m[int(y0 - Y0 + h * core[1]):int(y0 - Y0 + h * core[2]), a:b] = cv2.GC_FGD
                cv2.grabCut(crop, m, None, bg, fg, iters, cv2.GC_INIT_WITH_MASK)
            else:
                m = np.zeros(crop.shape[:2], np.uint8)
                cv2.grabCut(crop, m, (x0 - X0, y0 - Y0, x1 - x0, y1 - y0), bg, fg, iters, cv2.GC_INIT_WITH_RECT)
            m = np.where((m == 1) | (m == 3), 255, 0).astype(np.uint8)
            m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
            n, lab, st, _ = cv2.connectedComponentsWithStats(m)
            if n > 1:
                m = np.where(lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
            m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        else:
            m = mask
        if flip:
            crop, m = crop[:, ::-1].copy(), m[:, ::-1].copy()
        if foot:
            m = fill_foot(m, foot, y1 - Y0 - 1)
        self.crop, self.mask = crop, m
        ys, xs = np.nonzero(m)
        self.top, self.bot = int(ys.min()), int(ys.max())
        # the axis: the middle of the foot (the widest rows near the bottom)
        foot = [r for r in range(self.bot - int((self.bot - self.top) * 0.18), self.bot + 1)]
        cs = []
        for r in foot:
            c = np.nonzero(m[r])[0]
            if len(c):
                cs.append((c.min() + c.max()) / 2)
        self.axis = float(np.median(cs))
        if sym:
            # a turned piece in a perspective picture: its axis can lean a little. Fit a line
            # through the row middles (rows a neighbour widens on one side fall out of the fit),
            # then shear the picture and cut-out so the axis stands upright.
            ys_, cs_ = [], []
            for r in range(int(self.top + (self.bot - self.top) * 0.04), self.bot - 2):
                c = np.nonzero(m[r])[0]
                if len(c):
                    ys_.append(r)
                    cs_.append((c.min() + c.max()) / 2)
            ys_, cs_ = np.array(ys_, float), np.array(cs_, float)
            keep_ = np.ones(len(ys_), bool)
            for _ in range(6):
                k_, a_ = np.polyfit(ys_[keep_], cs_[keep_], 1)
                res = np.abs(cs_ - (k_ * ys_ + a_))
                keep_ = res < max(1.5, 2.5 * np.median(res[keep_]))
            k_ = float(np.clip(k_, -0.2, 0.2))
            self.axis = k_ * self.bot + a_
            Mt = np.float32([[1, -k_, k_ * self.bot], [0, 1, 0]])
            crop = cv2.warpAffine(crop, Mt, (crop.shape[1], crop.shape[0]), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            m = cv2.warpAffine(m, Mt, (m.shape[1], m.shape[0]), flags=cv2.INTER_NEAREST)
            self.crop, self.mask = crop, m
            self.lean = k_
        if unit is None:
            unit = height / (self.bot - self.top)
        self.unit = unit

    def width(self, z):
        """half width (units) of the outline at height z, from the mask row."""
        r = int(round(self.bot - z / self.unit))
        r = min(max(r, 0), self.mask.shape[0] - 1)
        c = np.nonzero(self.mask[r])[0]
        if not len(c):
            return 0.0
        return (c.max() - c.min()) / 2 * self.unit

    def height(self):
        return (self.bot - self.top) * self.unit

    def profile(self, z0=0.0, z1=None, step_px=1, smooth=1.2, shrink=0.0, tol=0.0012):
        """[(z, r)] up the outline between z0 and z1 (units), lightly smoothed."""
        from scipy.ndimage import gaussian_filter1d, median_filter
        z1 = self.height() if z1 is None else z1
        rows = np.arange(self.bot - z0 / self.unit, self.bot - z1 / self.unit, -1.0)
        rs = []
        for r in rows:
            c = np.nonzero(self.mask[int(round(min(max(r, 0), self.mask.shape[0] - 1)))])[0]
            if not len(c):
                rs.append(0)
            elif self.sym:
                # the nearer side from the axis: a neighbour's edge creeping into one side of the
                # cut-out cannot widen the turned outline
                a_, b_ = self.axis - c.min() + 0.5, c.max() - self.axis + 0.5
                rs.append((a_ + b_) / 2 if abs(a_ - b_) < 0.12 * max(a_, b_) else min(a_, b_))
            else:
                rs.append((c.max() - c.min()) / 2)
        rs = median_filter(np.array(rs, float), getattr(self, 'med', 5), mode='nearest')
        if smooth:
            rs = gaussian_filter1d(rs, smooth, mode='nearest')
        zs = (self.bot - rows) * self.unit
        rs = np.maximum(rs * self.unit - shrink, 0)
        k = max(1, int(round(step_px)))
        pts = list(zip(zs[::k], rs[::k]))
        if pts[-1][0] != zs[-1]:
            pts.append((zs[-1], rs[-1]))
        return simplify(pts, tol) if tol else pts

    def uv(self, x, z):
        """picture coordinates (px) of world x across, z up."""
        return self.axis + x / self.unit, self.bot - z / self.unit


def simplify(pts, tol):
    """Douglas-Peucker on an outline [(z, r)]: keeps the corners, drops rings on straight runs."""
    pts = np.asarray(pts, float)
    keep = np.zeros(len(pts), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        p, q = pts[a], pts[b]
        d = q - p
        L = np.hypot(*d) or 1e-9
        seg = pts[a + 1:b]
        dist = np.abs(d[0] * (seg[:, 1] - p[1]) - d[1] * (seg[:, 0] - p[0])) / L
        i = int(np.argmax(dist))
        if dist[i] > tol:
            keep[a + 1 + i] = True
            stack += [(a, a + 1 + i), (a + 1 + i, b)]
    return [tuple(x) for x in pts[keep]]


def mirror_axis(m, top, bot, guess):
    """the vertical line the cut-out is most mirror-symmetric about (a turned piece's axis),
    searched near the foot's middle; robust to a neighbour's edge in one corner."""
    rows = m[int(top + (bot - top) * 0.05):int(bot - (bot - top) * 0.05)] > 0
    W = rows.shape[1]
    best, bx = -1, guess
    for a in np.arange(guess - W * 0.25, guess + W * 0.25, 0.5):
        xs = np.arange(W)
        mx = np.round(2 * a - xs).astype(int)
        ok = (mx >= 0) & (mx < W)
        if ok.sum() < W * 0.4:
            continue
        a_ = rows[:, ok]
        b_ = rows[:, mx[ok]]
        s = (a_ & b_).sum() / max((a_ | b_).sum(), 1)
        if s > best:
            best, bx = s, a
    return float(bx)


def diff_mask(crop, box, thresh=10):
    """cut-out on a plain studio backdrop: the backdrop's gentle gradient is fitted from the
    crop's border (a plane in Lab per channel), and the piece is what stands out from it, with
    enclosed areas filled (ivory reads like the backdrop but is ringed by gold and shadow)."""
    from scipy.ndimage import binary_fill_holes
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB).astype(np.float32)
    H, W = crop.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    b = np.zeros((H, W), bool)
    b[:3], b[-3:], b[:, :3], b[:, -3:] = True, True, True, True
    b[box[3]:] = False    # the table and reflections below the foot are not backdrop
    A = np.stack([xx[b], yy[b], np.ones(b.sum())], 1)
    bg = np.zeros_like(lab)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A, lab[..., c][b], rcond=None)
        bg[..., c] = coef[0] * xx + coef[1] * yy + coef[2]
    d = np.sqrt(((lab - bg) ** 2).sum(2))
    # GrabCut seeded by the difference: strong difference is the piece, the border is backdrop
    gc = np.full((H, W), cv2.GC_PR_BGD, np.uint8)
    gc[d > thresh] = cv2.GC_PR_FGD
    gc[d > thresh * 2.5] = cv2.GC_FGD
    gc[b] = cv2.GC_BGD
    gc[:, :box[0]] = cv2.GC_BGD
    gc[:, box[2]:] = cv2.GC_BGD
    cv2.setRNGSeed(7)
    cv2.grabCut(crop, gc, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    m = ((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)).astype(np.uint8)
    m[:, :box[0]] = 0
    m[:, box[2]:] = 0
    m[:box[1]] = 0
    m[box[3]:] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    m = binary_fill_holes(m).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab_, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1:
        m = (lab_ == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    return m * 255


def fill_foot(m, frac, box_bot=None):
    """dark plinth bands melt into a dark table and the cut-out loses them: every row of the
    foot (the bottom `frac` of the piece, down to the box's bottom edge) is widened to the
    widest row just above it, centred."""
    ys, xs = np.nonzero(m)
    top = ys.min()
    bot = box_bot if box_bot is not None else ys.max()
    h = bot - top
    lo = int(bot - h * frac)
    best = None
    for r in range(int(bot - h * frac * 2.2), lo):
        c = np.nonzero(m[r])[0]
        if len(c) and (best is None or c.max() - c.min() > best[1] - best[0]):
            best = (c.min(), c.max())
    out = m.copy()
    if best is None:
        return out
    for r in range(lo, bot + 1):
        c = np.nonzero(m[r])[0]
        if not len(c) or c.max() - c.min() < 0.94 * (best[1] - best[0]):
            out[r, best[0]:best[1] + 1] = 255
    return out


# ------------------------------------------------------------------ painting
def _hsv(img):
    h = cv2.cvtColor(img, cv2.COLOR_BGR2HSV_FULL).astype(np.float32)
    return h[..., 0] * 360 / 256, h[..., 1] / 255, h[..., 2] / 255


def classify(img, gold=(16, 62), gold_sat=0.5, gold_val=0.3, gem_sat=0.55, gem_val=0.42):
    """material ids per pixel: 0 body (stone, enamel), 1 gold, 2 gem (bright, saturated and
    not gold-coloured: rubies, sapphires, emeralds)."""
    h, s, v = _hsv(img)
    golden = (h >= gold[0]) & (h <= gold[1])
    g = golden & (s >= gold_sat) & (v >= gold_val)
    gem = (s >= gem_sat) & (v >= gem_val) & ~((h >= gold[0] - 4) & (h <= gold[1] + 10))
    ids = np.zeros(img.shape[:2], np.uint8)
    ids[g] = 1
    ids[gem] = 2
    return ids


def gold_weight(img, gold=(16, 62), gold_sat=0.5, gold_val=0.3, **_):
    """0..1 per pixel: how surely it is gold leaf (golden hue, saturated, bright), soft at the
    thresholds and lightly smoothed."""
    h, s, v = _hsv(img)
    def ramp(x, a, w):
        return np.clip((x - a) / w + 0.5, 0, 1)
    hue = ramp(h, gold[0], 6) * (1 - ramp(h, gold[1], 6))
    w = hue * ramp(s, gold_sat, 0.16) * ramp(v, gold_val, 0.14)
    w = cv2.GaussianBlur(w.astype(np.float32), (0, 0), 0.8)
    return w.astype(np.float32)


def dilate_fill(img, mask, n=40):
    """push colours outward past the mask so edge samples never pick up the background."""
    out = img.copy().astype(np.float32)
    m = (mask > 0).astype(np.float32)
    for _ in range(n):
        blur = cv2.blur(out * m[..., None], (3, 3))
        wb = cv2.blur(m, (3, 3))
        grow = (wb > 0) & (m == 0)
        out[grow] = blur[grow] / wb[grow][:, None]
        m = np.maximum(m, grow.astype(np.float32))
    return out.clip(0, 255).astype(np.uint8)


def paint_cell(ref, t, atlas, mr, look, half='right'):
    """resample a side's picture of piece type t into its atlas cell.
    look: {'body': (rough, metal), 'gold': (rough, metal), 'gem': (rough, metal), 'gold_tone': bgr or None}"""
    i = TYPES.index(t)
    cx, cy = (i % COLS) * CW, (i // COLS) * CH
    xs = (np.arange(CW) + 0.5) / CW * CELL_W - CELL_W / 2
    zs = (1 - (np.arange(CH) + 0.5) / CH) * CELL_H
    X, Z = np.meshgrid(xs, zs)
    if half == 'right':
        X = np.abs(X)
    elif half == 'left':
        X = -np.abs(X)
    mx = (ref.axis + X / ref.unit).astype(np.float32)
    my = (ref.bot - Z / ref.unit).astype(np.float32)
    src = dilate_fill(ref.crop, ref.mask, 60)
    col = cv2.remap(src, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    ids = classify(ref.crop, **look.get('classify', {}))
    idm = cv2.remap(ids, mx, my, cv2.INTER_NEAREST, borderMode=cv2.BORDER_REPLICATE)
    # gold as a soft weight (how surely a pixel is gold leaf), so the lift and the metal fade in
    # over the engraving's edges instead of switching per pixel (hard switching reads as
    # blotches of metal on the stone under the table's lights)
    gw = gold_weight(ref.crop, **look.get('classify', {}))
    gw = cv2.remap(gw, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    gw[idm == 2] = 0
    if look.get('gold_tone') is not None:
        tone = np.array(look['gold_tone'], np.float32)
        c = col.astype(np.float32)
        lum = c.mean(2, keepdims=True) / 255
        mix = look.get('gold_mix', 0.65) * gw[..., None]
        col = np.clip(c * (1 - mix) + tone * mix * (0.95 + 0.75 * lum), 0, 255).astype(np.uint8)
    # the pictures are lit warm; the table's own lights add their warmth again, so the stone is
    # cooled a little (look['body_cool'], 0 to 1) to land on the pictures' colour in the game
    if look.get('wb'):   # white balance (B, G, R gains) against the table's warm lights
        col = np.clip(col.astype(np.float32) * np.array(look['wb'], np.float32), 0, 255).astype(np.uint8)
    if look.get('body_gain'):
        b = idm == 0
        col[b] = np.clip(col[b].astype(np.float32) * look['body_gain'], 0, 255).astype(np.uint8)
    if look.get('body_cool'):
        b = idm == 0
        hsv = cv2.cvtColor(col, cv2.COLOR_BGR2HSV)
        hsv[..., 1] = np.where(b, hsv[..., 1] * (1 - look['body_cool']), hsv[..., 1]).astype(np.uint8)
        col = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    atlas[cy:cy + CH, cx:cx + CW] = col
    m = np.zeros((CH, CW, 3), np.float32)
    (br, bm), (gr, gm), (er, em) = look['body'], look['gold'], look['gem']
    m[..., 1] = (br * (1 - gw) + gr * gw) * 255
    m[..., 0] = (bm * (1 - gw) + gm * gw) * 255
    gem = idm == 2
    m[gem, 1], m[gem, 0] = er * 255, em * 255   # BGR: R=0 (unused), G rough, B metal
    m = m.clip(0, 255).astype(np.uint8)
    mr[cy:cy + CH, cx:cx + CW] = m[..., ::-1]


# ------------------------------------------------------------------ geometry
def _new(name):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob, me


def fold_angle(phi, n):
    """triangle wave: the angle from the front, folded into [0, pi/n] (mirror repeats)."""
    if n <= 0:
        return phi
    w = 2 * math.pi / n
    t = (phi % w)
    return t if t <= w / 2 else w - t


def pick(refs, cls, near, **kw):
    """world (x >= 0, z) of a spot of material class cls (0 body, 1 gold, 2 gem) nearest to
    `near`, where every given picture (both sides) shows that class: a clean place to paint
    hidden faces (crown linings, domes, battlement tops)."""
    refs = refs if isinstance(refs, (list, tuple)) else [refs]
    xs_ = (np.arange(CW) + 0.5) / CW * CELL_W / 2
    zs_ = (1 - (np.arange(CH) + 0.5) / CH) * CELL_H
    X, Z = np.meshgrid(xs_, zs_)
    ok = np.ones(X.shape, bool)
    for ref in refs:
        ids = classify(ref.crop, **kw)
        m = ((ids == cls) & (ref.mask > 0)).astype(np.uint8)
        m = cv2.erode(m, np.ones((5, 5), np.uint8))
        mx = (ref.axis + X / ref.unit).astype(np.float32)
        my = (ref.bot - Z / ref.unit).astype(np.float32)
        ok &= cv2.remap(m, mx, my, cv2.INTER_NEAREST, borderValue=0) > 0
    ys, xs = np.nonzero(ok)
    if not len(ys):
        return near
    i = int(np.argmin((X[ys, xs] - near[0]) ** 2 + (Z[ys, xs] - near[1]) ** 2))
    return float(X[ys[i], xs[i]]), float(Z[ys[i], xs[i]])


def set_uv(ob, t, fold=2, mode='fold', ox=0.0, at=(0.0, 0.5), inner=None, top=None):
    """paint coordinates for every corner. mode 'fold': folded round the axis (lathes, rings);
    'front': straight projection along y (crosses, shields); 'side': along x (the knight)."""
    me = ob.data
    if not me.uv_layers:
        me.uv_layers.new(name='uv')
    uvl = me.uv_layers[0].data
    bpy.context.view_layer.update()   # a just-placed part (a ball set at a height) has a stale matrix
    mw = ob.matrix_world
    nm = mw.to_3x3()
    for poly in me.polygons:
        n = nm @ poly.normal
        c = mw @ poly.center
        rad = Vector((c.x, c.y, 0))
        lining = inner is not None and rad.length > 1e-6 and n.dot(rad.normalized()) < -0.35
        lid = top is not None and n.z > 0.75
        for li in poly.loop_indices:
            if lining or lid:
                uvl[li].uv = cell_uv(t, *(inner if lining else top))
                continue
            co = mw @ me.vertices[me.loops[li].vertex_index].co
            x, y, z = co.x - ox, co.y, co.z
            if mode == 'fold':
                r = math.hypot(x, y)
                phi = math.atan2(x, -y)
                u = r * math.sin(fold_angle(phi, fold))
            elif mode == 'front':
                u = abs(x) if fold else x
            elif mode == 'point':
                u, z = at
            else:
                u = -y
            uvl[li].uv = cell_uv(t, u, z)


def lathe(name, prof, segs=80, close_top=True, close_bot=True):
    """solid of revolution from [(z, r)] bottom to top."""
    ob, me = _new(name)
    bm = bmesh.new()
    rings = []
    for z, r in prof:
        if r < 1e-4:
            rings.append([bm.verts.new((0, 0, z))])
            continue
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
    for a, b in zip(rings[:-1], rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for i in range(segs):
                bm.faces.new((a[0], b[i], b[(i + 1) % segs]))
        elif len(b) == 1:
            for i in range(segs):
                bm.faces.new((a[i], a[(i + 1) % segs], b[0]))
        else:
            for i in range(segs):
                bm.faces.new((a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]))
    if close_bot and len(rings[0]) > 1:
        c = bm.verts.new((0, 0, prof[0][0]))
        for i in range(segs):
            bm.faces.new((rings[0][(i + 1) % segs], rings[0][i], c))
    if close_top and len(rings[-1]) > 1:
        c = bm.verts.new((0, 0, prof[-1][0]))
        for i in range(segs):
            bm.faces.new((rings[-1][i], rings[-1][(i + 1) % segs], c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return ob


def shell(name, prof, keep, segs=128, thick=0.022, inner=None):
    """a thin ring following the outline [(z, r)], with faces kept only where keep(phi, z) is
    true (phi from the front): crown points, coronet spikes, battlements."""
    ob, me = _new(name)
    bm = bmesh.new()
    rings = [[bm.verts.new((r * math.sin(2 * math.pi * i / segs), -r * math.cos(2 * math.pi * i / segs), z)) for i in range(segs)] for z, r in prof]
    for j, (a, b) in enumerate(zip(rings[:-1], rings[1:])):
        zc = (prof[j][0] + prof[j + 1][0]) / 2
        for i in range(segs):
            phi = 2 * math.pi * (i + 0.5) / segs
            if phi > math.pi:
                phi -= 2 * math.pi
            if keep(phi, zc):
                bm.faces.new((a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]))
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    sol = ob.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = -1
    sol.use_even_offset = True
    apply_mods(ob)
    bev(ob, 0.004)
    return ob


def slab(name, ref, z0, z1=None, depth=0.06, simplify=1.2, bevel=0.012, x_lim=None):
    """a flat part (cross, shield, plume) extruded from the picture's outline above z0."""
    m = ref.mask.copy()
    r0 = int(round(ref.bot - z0 / ref.unit))
    m[r0:] = 0
    if z1 is not None:
        m[:int(round(ref.bot - z1 / ref.unit))] = 0
    if x_lim is not None:
        a = int(ref.axis - x_lim / ref.unit)
        b = int(ref.axis + x_lim / ref.unit)
        m[:, :max(a, 0)] = 0
        m[:, b:] = 0
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    c = cv2.approxPolyDP(c, simplify, True)[:, 0, :]
    pts = [((x - ref.axis) * ref.unit, (ref.bot - y) * ref.unit) for x, y in c]
    ob, me = _new(name)
    bm = bmesh.new()
    front = [bm.verts.new((x, -depth / 2, z)) for x, z in pts]
    back = [bm.verts.new((x, depth / 2, z)) for x, z in pts]
    f1 = bm.faces.new(front)
    f2 = bm.faces.new(back[::-1])
    n = len(pts)
    for i in range(n):
        bm.faces.new((front[i], back[i], back[(i + 1) % n], front[(i + 1) % n]))
    bmesh.ops.triangulate(bm, faces=[f1, f2])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    if bevel:
        bev(ob, bevel, segments=3)
    return ob


def gem(name, size, depth=None, at=(0, 0, 0), facing=(0, -1, 0), kind='rhomb'):
    """a cut stone. 'rhomb' is the lozenge seen on the pictures' bands, 'round' a cabochon."""
    ob, me = _new(name)
    bm = bmesh.new()
    d = depth or size * 0.5
    if kind == 'rhomb':
        w, h = size * 0.62, size
        ring = [bm.verts.new(p) for p in [(0, 0, h / 2), (w / 2, 0, 0), (0, 0, -h / 2), (-w / 2, 0, 0)]]
        inner = [bm.verts.new((p.co.x * 0.45, -d * 0.7, p.co.z * 0.45)) for p in ring]
        tip = bm.verts.new((0, -d, 0))
        back = bm.verts.new((0, d * 0.3, 0))
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((ring[i], ring[j], inner[j], inner[i]))
            bm.faces.new((inner[i], inner[j], tip))
            bm.faces.new((ring[j], ring[i], back))
    else:
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=size / 2)
        bmesh.ops.scale(bm, vec=(1, d / size * 2, 1), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = Vector((0, -1, 0)).rotation_difference(Vector(facing))
    ob.location = at
    return ob


def ball(name, r, at, segs=24):
    ob, me = _new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=r)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob.location = at
    return ob


def bev(ob, w, segments=2):
    b = ob.modifiers.new('bevel', 'BEVEL')
    b.width = w
    b.segments = segments
    b.limit_method = 'ANGLE'
    b.angle_limit = math.radians(40)
    b.harden_normals = False
    apply_mods(ob)
    return ob


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def around(ob, n, phase=0.0):
    """n copies of ob spun round the axis (the original is the first)."""
    out = [ob]
    for i in range(1, n):
        c = ob.copy()
        c.data = ob.data
        bpy.context.collection.objects.link(c)
        c.rotation_mode = 'XYZ'
        c.matrix_world = _rotz(phase + 2 * math.pi * i / n) @ ob.matrix_world
        out.append(c)
    return out


def _rotz(a):
    from mathutils import Matrix
    return Matrix.Rotation(a, 4, 'Z')


def join(obs, name):
    obs = [o for o in obs if o]
    for o in obs:
        o.select_set(False)
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    # make linked copies single-user first so the join keeps every copy
    for o in obs:
        if o.data.users > 1:
            o.data = o.data.copy()
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


# ------------------------------------------------------------------ export
def mesh_arrays(ob, ratio=1.0):
    """triangles of ob (after an optional decimate) as game arrays: y up, front +z."""
    src = ob
    if ratio < 1:
        src = ob.copy()
        src.data = ob.data.copy()
        bpy.context.collection.objects.link(src)
        d = src.modifiers.new('dec', 'DECIMATE')
        d.ratio = ratio
        d.use_collapse_triangulate = True
        apply_mods(src)
    me = src.data
    me.calc_loop_triangles()
    uvl = me.uv_layers[0].data
    n_l = len(me.loops)
    cn = np.zeros(n_l * 3)
    me.corner_normals.foreach_get('vector', cn) if hasattr(me, 'corner_normals') else None
    cn = cn.reshape(-1, 3)
    vco = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', vco)
    vco = vco.reshape(-1, 3)
    uvs = np.zeros(n_l * 2)
    uvl.foreach_get('uv', uvs)
    uvs = uvs.reshape(-1, 2)
    lv = np.zeros(n_l, np.int64)
    me.loops.foreach_get('vertex_index', lv)
    tri_loops = np.zeros(len(me.loop_triangles) * 3, np.int64)
    me.loop_triangles.foreach_get('loops', tri_loops)
    # one game vertex per distinct (position, normal, uv)
    key = np.concatenate([lv[:, None].astype(np.float64), np.round(cn * 64), np.round(uvs * 8192)], 1)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.ravel()
    first = np.zeros(len(uniq), np.int64)
    first[inv[::-1]] = np.arange(n_l)[::-1]
    P = vco[lv[first]]
    N = cn[first]
    U = uvs[first]
    idx = inv[tri_loops]
    # Blender (x, y, z) -> game (x, z, -y)
    P = np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1)
    N = np.stack([N[:, 0], N[:, 2], -N[:, 1]], 1)
    if src is not ob:
        bpy.data.objects.remove(src, do_unlink=True)
    return P, N, U, idx


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def relief(name, ref, z0, z1=None, thick=0.36, power=0.55, res=0.006, smooth=6, x_view='side', taper=None):
    """a rounded solid from a flat outline (the knight's head seen side on): the outline is
    swollen into the depth axis by its distance to the edge, like a carved relief cut free, so
    the muzzle and ears stay thin and the neck full. Blender x/z = the picture, y = depth."""
    from scipy.ndimage import distance_transform_edt
    from skimage.measure import marching_cubes
    m = ref.mask.copy()
    m[int(round(ref.bot - z0 / ref.unit)):] = 0
    if z1 is not None:
        m[:int(round(ref.bot - z1 / ref.unit))] = 0
    ys, xs = np.nonzero(m)
    # resample the outline onto a res-sized grid
    xw0, xw1 = (xs.min() - ref.axis) * ref.unit - 0.02, (xs.max() - ref.axis) * ref.unit + 0.02
    zw0, zw1 = (ref.bot - ys.max()) * ref.unit - 0.02, (ref.bot - ys.min()) * ref.unit + 0.02
    gx = np.arange(xw0, xw1, res)
    gz = np.arange(zw0, zw1, res)
    X, Z = np.meshgrid(gx, gz)
    mx = (ref.axis + X / ref.unit).astype(np.float32)
    my = (ref.bot - Z / ref.unit).astype(np.float32)
    mm = cv2.remap(m, mx, my, cv2.INTER_LINEAR, borderValue=0) > 127
    dt = distance_transform_edt(mm) * res
    half = thick / 2 * (dt / max(dt.max(), 1e-6)) ** power
    if taper is not None:
        half = half * taper(X, Z)
    gy = np.arange(-thick / 2 - 0.02, thick / 2 + 0.02, res)
    # signed field: inside when |y| < half(x, z)
    F = half[None, :, :] - np.abs(gy)[:, None, None]
    F[:, ~mm] = -res
    verts, faces, _, _ = marching_cubes(np.pad(F, 1, constant_values=-1), 0)
    verts -= 1
    vy, vz, vx = verts[:, 0] * res + gy[0], verts[:, 1] * res + gz[0], verts[:, 2] * res + gx[0]
    ob, me = _new(name)
    me.from_pydata(np.stack([vx, vy, vz], 1).tolist(), [], faces[:, ::-1].tolist())
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    if smooth:
        s = ob.modifiers.new('smooth', 'CORRECTIVE_SMOOTH')
        s.iterations = smooth
        s.smooth_type = 'LENGTH_WEIGHTED'
        s.use_only_smooth = True
        apply_mods(ob)
    d = ob.modifiers.new('dec', 'DECIMATE')
    d.ratio = 0.35
    apply_mods(ob)
    return ob


def recast(ref, body=None, gem=None, whole=False, light=False, **cls):
    """the same cut-out recoloured: body (BGR) recasts the stone keeping its veins and shading,
    gem (BGR) recolours the stones. Used when a picture shows only one side of a piece."""
    import copy
    out = copy.copy(ref)
    img = ref.crop.astype(np.float32)
    ids = classify(ref.crop, **cls)
    if whole:
        ids[:] = 0
    lum = img.mean(2, keepdims=True) / 255
    if body is not None and light:
        # dark stone recast as light (ivory): the stone's own shading, lifted and compressed
        b = np.array(body, np.float32)
        m = lum[ids == 0].mean() if (ids == 0).any() else 0.2
        rec = b * np.clip(0.86 + 0.9 * (lum - m), 0.55, 1.08)
        img[ids == 0] = rec[ids == 0]
    elif body is not None:
        b = np.array(body, np.float32)
        # dark stone: shadows stay deep, the polish keeps its highlights
        rec = b * (0.35 + 1.3 * lum) + 255 * np.clip(lum - 0.82, 0, 1) * 2.2
        img[ids == 0] = rec[ids == 0]
    if gem is not None:
        g = np.array(gem, np.float32)
        img[ids == 2] = (g * (0.25 + 1.1 * lum))[ids == 2]
    out.crop = img.clip(0, 255).astype(np.uint8)
    return out


def stack(parts, unit, name='stack'):
    """a new cut-out made of horizontal slices of others, bottom first: [(ref, z0, z1), ...].
    Each slice is rescaled to `unit` and centred on its own axis. Used to make a piece the
    pictures do not show straight on (a pawn from the set's own base, collar and pearl)."""
    import copy
    W = int(1.3 / unit)
    rows_img, rows_mask = [], []
    for ref, z0, z1 in parts:
        y0, y1 = int(round(ref.bot - z1 / ref.unit)), int(round(ref.bot - z0 / ref.unit))
        h_out = max(1, int(round((z1 - z0) / unit)))
        k = ref.unit / unit
        xs = (np.arange(W) - W / 2) / k + ref.axis
        ys = y0 + (np.arange(h_out) + 0.5) / h_out * (y1 - y0)
        X, Y = np.meshgrid(xs.astype(np.float32), ys.astype(np.float32))
        src = dilate_fill(ref.crop, ref.mask, 30)
        rows_img.append(cv2.remap(src, X, Y, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE))
        rows_mask.append(cv2.remap(ref.mask, X, Y, cv2.INTER_LINEAR, borderValue=0))
    img = np.vstack(rows_img[::-1])
    m = np.vstack(rows_mask[::-1])
    m = np.where(m > 127, 255, 0).astype(np.uint8)
    pad = 12
    img = cv2.copyMakeBorder(img, pad, pad, 0, 0, cv2.BORDER_REPLICATE)
    m = cv2.copyMakeBorder(m, pad, pad, 0, 0, cv2.BORDER_CONSTANT, value=0)
    out = copy.copy(parts[0][0])
    out.crop, out.mask, out.unit = img, m, unit
    ys, xs = np.nonzero(m)
    out.top, out.bot, out.axis = int(ys.min()), int(ys.max()), W / 2
    return out


def ball_slice(ref):
    """(z0, z1) of the round head on top of a cut-out (pawns): from the top down to where the
    outline first narrows back after its widest row."""
    ws = [(z, w) for z, w in ref.profile(step_px=1, tol=0, smooth=1.5)][::-1]
    top = ws[0][0]
    widest = max(ws[:len(ws) // 2], key=lambda p: p[1])
    return top - 2 * widest[1], top
