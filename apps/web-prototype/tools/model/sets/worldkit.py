"""Shared by the seven ancient-world sets (packs world1: olympian, imperial, sounion; world2:
harappa, inca, sarsen, norse). Their hero pictures are designs drawn for the sets (no reference
picture), so three things are needed on top of classic.py:

  refs(sid, ...)     the hero pictures with their own light taken out. A design picture is lit
                     from one side; folded round a turned piece that light would repeat as
                     stripes. Each row's slow change of light is flattened inside the cut-out;
                     the row's own level (bands of gold and stone) and all fine detail stay.
  holes              a ring or a doorway of standing stones is a real opening, not paint.
  prism()            square pillars (Inca masonry): flat faces, each painted from the front.
"""
import math
import os

import cv2
import numpy as np

import classic
import hero
import kit


def delight(img, m, amount=1.0, upto=1.0, sx=0.22, sy=0.02, band=45.0):
    """img (BGR) with the slow left-to-right change of light removed inside mask m.
    upto: the share of the piece's height, from the foot, that is flattened (a carved figure
    keeps its picture's light above its turned plinth)."""
    f = img.astype(np.float32)
    w = (m > 0).astype(np.float32)
    ys, xs = np.nonzero(m)
    if not len(ys):
        return img
    top, bot = ys.min(), ys.max()
    wid = xs.max() - xs.min() + 1
    # the light is read from the body only: a gold emblem or a gem on stone is no shadow
    med = np.zeros((f.shape[0], 3), np.float32)
    for y in range(top, bot + 1):
        px = f[y][m[y] > 0]
        if len(px):
            med[y] = np.median(px, 0)
    d = np.abs(f - med[:, None, :]).max(2)
    wg = w * np.exp(-(d / band) ** 2)
    sgx, sgy = max(2.0, sx * wid), max(1.5, sy * (bot - top))
    den = cv2.GaussianBlur(wg, (0, 0), sigmaX=sgx, sigmaY=sgy) + 1e-4
    loc = cv2.GaussianBlur(f * wg[..., None], (0, 0), sigmaX=sgx, sigmaY=sgy) / den[..., None]
    rw = wg.sum(1) + 1e-4
    row = (f * wg[..., None]).sum(1) / rw[:, None]
    # the row's level, smoothed up the piece like the local light
    k = int(sgy * 6) | 1
    rws = cv2.GaussianBlur(rw.reshape(-1, 1), (1, k), sgy)
    row = cv2.GaussianBlur((row * rw[:, None]).reshape(-1, 1, 3), (1, k), sgy).reshape(-1, 3) / rws.reshape(-1, 1)
    gain = np.clip(row[:, None, :] / np.maximum(loc, 1.0), 0.7, 1.7)
    a = np.full(f.shape[0], float(amount), np.float32)
    if upto < 1.0:
        cut = bot - (bot - top) * upto
        a *= np.clip((np.arange(f.shape[0]) - cut) / max(1.0, 0.03 * (bot - top)) + 0.5, 0, 1)
    gain = 1 + (gain - 1) * a[:, None, None]
    out = np.where(w[..., None] > 0, f * gain, f)
    return out.clip(0, 255).astype(np.uint8)


def cutout(path):
    """(picture, mask) of a hero picture: its own mask file where it has one
    (pics/<set>/<side>-<type>.mask.png, cut with Segment Anything when the picture was made),
    else hero.cutout's cut against the backdrop colour"""
    mp = os.path.splitext(path)[0] + '.mask.png'
    if os.path.exists(mp):
        return cv2.imread(path), (cv2.imread(mp, 0) > 127).astype(np.uint8) * 255
    img, m, _ = hero.cutout(path)
    return img, m


def _gaps(img, m, min_area=220):
    """openings right through the figure: flat backdrop seen inside the filled cut-out"""
    border = np.concatenate([img[:6].reshape(-1, 3), img[-6:].reshape(-1, 3), img[:, :6].reshape(-1, 3), img[:, -6:].reshape(-1, 3)])
    d = np.abs(img.astype(np.int16) - np.median(border, 0)).max(2)
    g8 = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    var = cv2.blur(g8 * g8, (9, 9)) - cv2.blur(g8, (9, 9)) ** 2
    g = ((d <= 16) & (var < 20) & (m > 0)).astype(np.uint8)
    g = cv2.morphologyEx(g, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(g)
    out = np.zeros_like(g)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= min_area:
            out[lab == i] = 255
    return cv2.dilate(out, np.ones((5, 5), np.uint8))


def refs(sid, heights=None, flat=None, holes=(), amount=1.0, slim=None):
    """kit.Ref per hero picture of set sid, de-lit. heights: as hero.refs. flat: {type: share
    of the height flattened} (default all of it; 0 leaves the picture as drawn). holes: types
    whose openings (a ring, a trilithon's doorway) are cut out of the shape. slim: {type:
    widest allowed width / height}: a design drawn stouter than that (a rook as wide as it is
    tall would be shrunk below the pawns to fit its square) is narrowed to it."""
    tmp = os.path.join(os.environ.get('COMPOSE_DIR', '/tmp/claude-0/compose'), 'world')
    os.makedirs(tmp, exist_ok=True)
    out = {}
    for s, d in hero.pics(sid).items():
        hs = dict(hero.HEIGHT)
        for k, v in (heights or {}).items():
            if isinstance(v, dict):
                if k == s:
                    hs.update(v)
            else:
                hs[k] = v
        out[s] = {}
        for t, path in d.items():
            img, m = cutout(path)
            m = cv2.erode(m, np.ones((3, 3), np.uint8))       # no backdrop in the outline's paint
            if t in holes:
                m = np.where(_gaps(img, m) > 0, 0, m).astype(np.uint8)
            upto = (flat or {}).get(t, 1.0)
            if upto:
                img = delight(img, m, amount, upto)
            lim = (slim or {}).get(t)
            if lim:
                ys, xs = np.nonzero(m)
                ratio = (xs.max() - xs.min() + 1) / (ys.max() - ys.min() + 1)
                if ratio > lim:
                    H, W = m.shape
                    w2 = int(round(W * lim / ratio))
                    bg = np.median(np.concatenate([img[:6].reshape(-1, 3), img[-6:].reshape(-1, 3)]), 0)
                    wide = np.full_like(img, bg.astype(np.uint8))
                    x0 = (W - w2) // 2
                    wide[:, x0:x0 + w2] = cv2.resize(img, (w2, H), interpolation=cv2.INTER_AREA)
                    m2 = np.zeros_like(m)
                    m2[:, x0:x0 + w2] = cv2.resize(m, (w2, H), interpolation=cv2.INTER_NEAREST)
                    img, m = wide, m2
            p2 = os.path.join(tmp, '%s-%s-%s.png' % (sid, s, t))
            cv2.imwrite(p2, img)
            ys, xs = np.nonzero(m)
            box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
            pad = 14
            X0, Y0 = max(0, box[0] - pad), max(0, box[1] - pad)
            X1, Y1 = min(img.shape[1], box[2] + pad), min(img.shape[0], box[3] + pad)
            r = kit.Ref(p2, box, mask=m[Y0:Y1, X0:X1], unit=1.0, foot=0, pad=pad)
            r.unit = hs[t] / max(r.height() / r.unit, 1e-6)
            out[s][t] = r
    return out


def prism(name, prof, t, sides=4, bevel=0.007):
    """a square (or n-sided) pillar from an outline [(z, half width)], one face to the front,
    flat faces with a fine bevel; every face is painted from the front picture."""
    from mathutils import Matrix
    k = 1 / math.cos(math.pi / sides)
    ob = kit.lathe(name, [(z, r * k) for z, r in prof], segs=sides)
    ob.data.transform(Matrix.Rotation(math.pi / sides + math.pi / 2, 4, 'Z'))
    for p in ob.data.polygons:
        p.use_smooth = False
    if bevel:
        kit.bev(ob, bevel, segments=2)
    kit.set_uv(ob, t, fold=sides)
    return ob


def block(name, x0, x1, y0, y1, z0, z1, t, bevel=0.006, fold=4):
    """a squared stone (a corner merlon, a lintel)"""
    import bmesh
    import bpy
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 + (v.co.x + 0.5) * (x1 - x0)
        v.co.y = y0 + (v.co.y + 0.5) * (y1 - y0)
        v.co.z = z0 + (v.co.z + 0.5) * (z1 - z0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    if bevel:
        kit.bev(ob, bevel, segments=2)
    kit.set_uv(ob, t, fold=fold)
    return ob


def emblem(r, t, z, x_lim=None, depth=0.06, bevel=0.012):
    """a flat emblem standing on a pillar (sun disc, crescent, hammer), cut from the outline above z"""
    c = kit.slab('emblem', r, z * r.height(), depth=depth, bevel=bevel, x_lim=x_lim)
    kit.set_uv(c, t, mode='front', fold=0)
    return c


def build(t, refs, spec):
    """classic.build plus:
    'prism'   a square pillar from the outline: optional 'round': z above which the piece is
              turned (a pawn's ball, a column on a square plinth), 'top': (z, x_lim, depth) a
              flat emblem cut from the outline above z, 'merlons': (z, width) corner blocks
    'stone'   a standing stone or statue-like slab: turned foot to z0, the rest swollen from
              its outline, openings kept ('foot': 'prism' for a squared foot)
    'knight'  with 'foot': 'prism': classic's carved head on a squared plinth"""
    sp = spec.get(t, {'kind': 'turned'})
    r = refs['w']
    r.t = t
    h = r.height()
    kind = sp['kind']
    if kind == 'prism':
        z1 = (sp['top'][0] if sp.get('top') else sp['merlons'][0] if sp.get('merlons') else 1.0) * h
        zr = sp.get('round')
        zs = zr * h if zr else z1
        parts = [prism('body', r.profile(0, zs + (0.01 if zs < h else 0), tol=0.002), t, bevel=sp.get('bevel', 0.007))]
        if zr:
            ball = kit.lathe('ball', r.profile(zs - 0.01, z1))
            kit.set_uv(ball, t, fold=4)
            parts.append(ball)
        if sp.get('top'):
            parts.append(emblem(r, t, sp['top'][0], sp['top'][1], sp['top'][2] if len(sp['top']) > 2 else 0.06))
        if sp.get('merlons'):
            zm, mw = sp['merlons'][0] * h, sp['merlons'][1]
            a = r.width(zm - 0.02)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    x0, x1 = sorted((sx * (a - mw), sx * a))
                    y0, y1 = sorted((sy * (a - mw), sy * a))
                    parts.append(block('merlon', x0, x1, y0, y1, zm - 0.01, h, t))
        return kit.join(parts, t)
    if kind in ('stone', 'knight') and (kind == 'stone' or sp.get('foot') == 'prism'):
        z0 = sp.get('z0', 0.12) * h
        if sp.get('foot') == 'prism':
            base = prism('base', r.profile(0, z0 + 0.02, tol=0.002), t)
        else:
            base = kit.lathe('base', r.profile(0, z0 + 0.02))
            kit.set_uv(base, t, fold=sp.get('fold', 4))
        if kind == 'knight':
            top = kit.relief('head', r, z0 - 0.04, thick=sp.get('thick', 0.3), power=sp.get('power', 0.5), use_tsr=False)
            kit.set_uv(top, t, mode='front', fold=0)
            top.rotation_euler = (0, 0, math.pi / 2)
        else:
            top = kit.relief('stone', r, z0 - 0.03, thick=sp.get('thick', 0.3), power=sp.get('power', 0.35), use_tsr=False)
            kit.set_uv(top, t, mode='front', fold=0)
        return kit.join([base, top], t)
    return classic.build(t, refs, spec)
