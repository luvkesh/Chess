"""Builders shared by the figure sets of packs figures2 and figures3 (dino, jarl, rune, elves,
sunshadow, galactic). Not a set: a set module imports it. Every piece of these sets is a
figure, an animal or a tower standing on a round plinth, and comes from its own hero picture
(tools/model/pics/<set>/<side>-<type>.jpg).

  refs(sid, heights, spec)   hero.refs, plus what the builders need from each picture: which
                             side and piece it is, where its plinth ends, and a squared foot
  build(t, refs, spec)       spec[side][type] picks the kind:
    {'kind': 'figure', 'z0': f, 'thick': t, 'power': p}
        the plinth turned, with a clean flat lid, and the figure carved from the front picture
        above it. z0 (fraction of the piece's height) is where the plinth's top edge meets the
        outline at its sides; without it the outline is measured, which works when the figure
        is narrower than its plinth and the plinth has one tier.
    {'kind': 'animal', ...}
        the same from a side-on picture.
        A knight's carved body (either kind) is turned in its mesh by KNIGHT_YAW so that its
        flank, not its edge, meets the players' eyes; 'yaw': a sets another angle.
    {'kind': 'turned', 'fold': n, 'top': f, 'thick': t, 'segs': n}
        towers, spires and beacons: the whole outline turned, round and true from every side
        ('segs': 6 makes it six-sided). 'top' (fraction of the height) ends the turned part
        there and carves what is above it from the picture (a roof between two turrets).
    {'kind': 'tower', 'z0': f, 'zu': f, 'segs': n, 'body_segs': n, 'body_fold': n}
        a tower with turrets: the plinth (when z0 is given; 'segs' and 'fold' are its own),
        the middle of the outline turned, and every part that stands free beside the middle
        (a turret on the battlements) turned about its own middle and stood in its place.
    {'kind': 'hero'}
        the stock hero.build: the whole picture as one rounded relief, plinth and all.
  sheet(sid, spec, path)     a picture of every plinth with the measured lines drawn on it, to
                             set z0 from

Why not hero.build for everything: a hero picture looks a little down on its piece, so the
plinth's top shows as an ellipse and its bottom edge as an arc. Carved or turned straight from
that outline the plinth gets a domed lid smeared with the figure's feet and a bowl for a foot.
Here the foot is squared, the wall stops at the lid's front edge, the lid is flat and takes one
clean colour, and the carved figure starts at the lid.

In a hero set (HERO = True in the set module: four painted views) a carved part takes its depth
and its side colours from TripoSR, as hero.build does."""
import copy
import math
import os

import cv2
import numpy as np

import hero
import kit


# The game stands a knight 0.95 rad off straight ahead (scene.js baseYaw: "turned to show their
# profile") and its own pictures of one piece turn a knight 1.2 (white) or 1.9 (black). Those
# suit a horse's head modelled looking forward. A carved animal is a relief: it reads when its
# flank meets the eye and is a lump seen end on, so its body is turned here to undo the game's
# turn. White: flank square to both players on the board. Black: between the board (0.95) and
# the game's own picture of the piece (1.9).
KNIGHT_YAW = {'w': 0.95, 'b': 1.3}


def _widths(m, bot, n):
    """outline width of the n rows up from the foot"""
    out = np.zeros(n)
    for i in range(n):
        c = np.nonzero(m[bot - i])[0]
        if len(c):
            out[i] = c.max() - c.min() + 1
    return out


def measure(r, z0=None):
    """the plinth as the picture shows it, in rows counted up from the foot's lowest point:
    iw where the foot stops widening (the bottom face shows as an ellipse, and this is about
    its middle row), tilt the ellipses' height over their width (the same for every round
    face in one picture), it the row where the plinth's top edge meets the outline at its
    sides, bt the top face's half height, lid = it - bt the row of the top face's front edge
    (the plinth's height as the turned wall needs it)"""
    m = r.mask > 0
    H = r.bot - r.top
    wid = _widths(m, r.bot, int(H * 0.5))
    lim = max(4, int(H * 0.09))
    iw = lim
    for i in range(1, lim):
        if wid[i + 2] - wid[i] < 0.01 * wid[i + 2]:     # under half a percent a row
            iw = i
            break
    tilt = float(np.clip(iw / 0.88 / max(wid[iw] / 2, 1), 0.06, 0.34))
    if z0 is None:
        q = max(iw + 3, int(H * 0.22))
        W = wid[:q].max()
        i = int(np.argmax(wid[:q]))
        while i + 1 < len(wid) and wid[i + 1] >= 0.9 * W:
            i += 1
        # the back half of the top face still shows above the side's top edge: step back down
        it = max(iw + 2, int(round(i - 0.44 * tilt * W / 2)))
    else:
        it = int(round(z0 * H))
    bt = tilt * wid[it] / 2
    return {'W': float(wid[it]), 'tilt': tilt, 'iw': iw, 'it': it, 'bt': float(bt),
            'lid': max(iw + 1, int(round(it - bt)))}


def _hero_refs(sid, heights):
    """hero.refs, except that a picture with its mask beside it (pics/<set>/<side>-<type>-a.png,
    kept from cutting the design picture out) takes its outline from the mask. hero.cutout
    finds the outline by what differs from the grey backdrop, which loses mid-grey edges
    (shaded white marble, silver) and has to fill every gap; the mask keeps the true edge and
    leaves the gaps open (between a staff and the body, under a stag's belly)."""
    out = {}
    for side, d in hero.pics(sid).items():
        hs = dict(hero.HEIGHT)
        for k, v in (heights or {}).items():
            if isinstance(v, dict):
                if k == side:
                    hs.update(v)
            else:
                hs[k] = v
        out[side] = {}
        for t, path in d.items():
            a = path[:-4] + '-a.png'
            if os.path.exists(a):
                m = np.where(cv2.imread(a, cv2.IMREAD_GRAYSCALE) > 127, 255, 0).astype(np.uint8)
            else:
                _, m, path = hero.cutout(path)
            ys, xs = np.nonzero(m)
            box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
            pad = 14
            X0, Y0 = max(0, box[0] - pad), max(0, box[1] - pad)
            X1, Y1 = min(m.shape[1], box[2] + pad), min(m.shape[0], box[3] + pad)
            r = kit.Ref(path, box, mask=m[Y0:Y1, X0:X1], unit=1.0, foot=0, pad=pad)
            r.unit = hs[t] / max(r.height() / r.unit, 1e-6)
            out[side][t] = r
    return out


def refs(sid, heights=None, spec=None):
    out = _hero_refs(sid, heights)
    for s, d in out.items():
        for t, r in d.items():
            r.side, r.t = s, t
            sp = pick(spec or {}, s, t)
            r.plinth = P = measure(r, sp.get('z0'))
            if 'tilt' in sp:
                P['bt'] = sp['tilt'] * P['W'] / 2
                P['lid'] = max(P['iw'] + 1, int(round(P['it'] - P['bt'])))
            # square the foot: the rows under the widest row take its width. Colours are pushed
            # out past the outline first, so the corners this adds are not backdrop grey.
            r.crop = kit.dilate_fill(r.crop, r.mask, 30)
            c = np.nonzero(r.mask[r.bot - P['iw']])[0]
            if len(c):
                r.mask = r.mask.copy()
                r.mask[r.bot - P['iw']:r.bot + 1, c.min():c.max() + 1] = 255
            c = np.nonzero(r.mask[r.bot])[0]
            r.axis = float((c.min() + c.max()) / 2)
    return out


def pick(spec, side, t):
    """a piece's entry in a spec laid out {side: {type: {...}}}"""
    return spec.get(side, {}).get(t, {})


def sheet(sid, spec, path, heights=None, frac=0.24, width=400, cols=5, only=None):
    """every carved piece's plinth, enlarged, to set z0 from: a ruler in hundredths of the
    piece's height down both sides, and at the margins green marks at the top edge (z0) and
    yellow marks at the lid's front edge; the top face's ellipse is drawn in yellow"""
    rs = refs(sid, heights, spec)
    tiles = []
    for s in 'wb':
        for t in 'kqbnrp':
            if pick(spec, s, t).get('kind', 'figure') == 'turned' or (only and s + '-' + t not in only):
                continue
            r = rs[s][t]
            P = r.plinth
            H = r.bot - r.top
            y0 = max(0, int(r.bot - frac * H))
            im = cv2.copyMakeBorder(r.crop[y0:r.bot + 4], 0, 0, 40, 40, cv2.BORDER_CONSTANT, value=(60, 60, 60))
            k = width / im.shape[1]
            im = cv2.resize(im, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
            row = lambda i: int(round((r.bot - i - y0) * k))
            W = im.shape[1]
            for f in range(1, int(frac * 100) + 1):
                y = row(f / 100 * H)
                n = 9 if f % 2 else 16
                cv2.line(im, (0, y), (n, y), (255, 255, 255), 1)
                cv2.line(im, (W - n, y), (W, y), (255, 255, 255), 1)
                if f % 2 == 0:
                    cv2.putText(im, '%d' % f, (18, y + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (255, 255, 255), 1, cv2.LINE_AA)
            c = np.nonzero(r.mask[r.bot - P['it']])[0]
            cx = ((c.min() + c.max()) / 2 + 40) * k if len(c) else W / 2
            for i, col in ((P['it'], (0, 255, 0)), (P['lid'], (0, 255, 255))):
                cv2.line(im, (0, row(i)), (34, row(i)), col, 2)
                cv2.line(im, (W - 34, row(i)), (W, row(i)), col, 2)
            cv2.ellipse(im, (int(cx), row(P['it'])), (int(P['W'] / 2 * k), max(1, int(P['bt'] * k))), 0, 0, 360, (0, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(im, '%s-%s z0 %.3f' % (s, t, P['it'] / H), (W // 2 - 60, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            tiles.append(im)
    h = max(i.shape[0] for i in tiles)
    while len(tiles) % cols:
        tiles.append(np.zeros((h, width, 3), np.uint8))
    tiles = [cv2.copyMakeBorder(i, h - i.shape[0], 0, 0, width - i.shape[1], cv2.BORDER_CONSTANT, value=(40, 40, 40)) for i in tiles]
    cv2.imwrite(path, np.vstack([np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]), [cv2.IMWRITE_JPEG_QUALITY, 90])


def _stone(r, zl):
    """a clean spot of the plinth's own top face to paint lids with: on the front half of the
    top ellipse, well out from the middle where the figure stands"""
    P = r.plinth
    return (0.62 * P['W'] / 2 * r.unit, zl + 0.3 * P['bt'] * r.unit)


def _lathe(name, prof, sp):
    """a turned part; with 'segs' it has that many flat sides, one facing the front, instead
    of being round. Each flat side is made of two halves that meet on its middle line, so the
    paint (folded once per side) runs from the middle of a side out to its corners; with only
    the corners to go by, a side would take one column of the picture and come out striped."""
    n = sp.get('segs', 0)
    if not n:
        return kit.lathe(name, prof)
    ob = kit.lathe(name, prof, segs=2 * n)
    step = math.pi / n
    kf = round(1.5 * n)                                 # the ring position that faces the front (-y)
    cs = 1.0 if n % 4 == 2 else 1 / math.cos(step)      # corner radius over the outline's half width
    for v in ob.data.vertices:
        x, y = v.co.x, v.co.y
        if math.hypot(x, y) < 1e-6:
            continue
        k = round(math.atan2(y, x) / step)
        f = cs * (math.cos(step) if (k - kf) % 2 == 0 else 1.0)
        v.co.x, v.co.y = x * f, y * f
    for p in ob.data.polygons:
        p.use_smooth = False
    ob.data.update()
    return ob


def plinth(r, sp):
    """the turned plinth with a flat lid at the top face's front edge; returns (object, lid
    height)"""
    P = r.plinth
    zl = P['lid'] * r.unit
    prof = r.profile(0, zl, smooth=0.8)
    prof = [(z, w) for z, w in prof if z < zl - 1e-4] + [(zl, r.width(zl - r.unit))]
    base = _lathe('base', prof, sp)
    kit.set_uv(base, r.t, fold=sp.get('fold', 4), top=sp.get('lid') or _stone(r, zl))
    return base, zl


def _above(r, wings=True):
    """the picture's outline above the lid, for carving. The top face's ellipse shows there
    as a slab the width of the plinth, with two flat wings beside the figure's feet: outside
    the figure's own width it is the lid, not the figure, and is cut away."""
    P = r.plinth
    q = copy.copy(r)
    m = r.mask.copy()
    lo = r.bot - P['lid']
    up = r.bot - int(round(P['it'] + P['bt'])) - 2
    if wings and up > 0:
        c = np.nonzero(m[up])[0]
        if len(c) and (c.max() - c.min() + 1) < 0.9 * P['W']:
            a, b = max(c.min() - 2, 0), c.max() + 3
            m[up:lo + 1, :a] = 0
            m[up:lo + 1, b:] = 0
    q.mask = m
    return q


def _paint(ob, r):
    """a carved part's paint: in a hero set its sides take TripoSR's views, else the front
    picture goes straight through"""
    if kit.VIEWS == 4:
        kit.set_uv_box(ob, r.t)
    else:
        kit.set_uv(ob, r.t, mode='front', fold=0)


def _carve(name, r, sp, zl, thick):
    q = _above(r, sp.get('wings', True))
    ob = kit.relief(name, q, zl - 0.02, thick=thick, power=sp.get('power', 0.6), res=sp.get('res', 0.006),
                    use_tsr=sp.get('tsr', kit.VIEWS == 4))
    _paint(ob, r)
    return ob


def _turn(ob, r, sp):
    """turn a carved body about the piece's axis: 'yaw' if the spec gives one, else a
    knight's KNIGHT_YAW. Done on the mesh itself after painting, so the paint turns with it
    (a rotation left on the object is lost when the parts are joined)."""
    a = sp.get('yaw', KNIGHT_YAW[r.side] if r.t == 'n' else 0.0)
    if a:
        from mathutils import Matrix
        ob.data.transform(Matrix.Rotation(a, 4, 'Z'))
        ob.data.update()
    return ob


def figure(r, sp):
    base, zl = plinth(r, sp)
    fig = _carve('figure', r, sp, zl, min(sp.get('thick', 0.5), 0.92 * r.plinth['W'] * r.unit))
    return [base, _turn(fig, r, sp)]


def animal(r, sp):
    base, zl = plinth(r, sp)
    body = _carve('animal', r, sp, zl, sp.get('thick', 0.42))
    return [base, _turn(body, r, sp)]


def turned(r, sp):
    h = r.height()
    z1 = sp['top'] * h if sp.get('top') else h
    prof = r.profile(0, z1 + (0.01 if sp.get('top') else 0), smooth=0.8)
    body = _lathe('body', prof, sp)
    stone = sp.get('lid') or kit.pick([r], 0, (0.05, h * sp.get('lid_at', 0.45)))
    kit.set_uv(body, r.t, fold=sp.get('fold', 4), top=stone)
    parts = [body]
    if sp.get('top'):
        f = kit.relief('top', r, z1 - 0.03, thick=sp.get('thick', 0.3), power=sp.get('power', 0.6),
                       use_tsr=sp.get('tsr', kit.VIEWS == 4))
        _paint(f, r)
        parts.append(f)
    return parts


def _runs(row):
    """the stretches of set pixels in one row of a mask, as (first, last) columns"""
    c = np.nonzero(row)[0]
    if not len(c):
        return []
    cut = np.nonzero(np.diff(c) > 1)[0]
    return list(zip(np.r_[c[0], c[cut + 1]].tolist(), np.r_[c[cut], c[-1]].tolist()))


def _split(r, zl, min_area=120):
    """a tower's outline above height zl in two: its middle (in each row the stretch of
    outline the axis passes through) and the parts that stand free beside it, one mask each"""
    m = r.mask > 0
    mid = m.copy()
    for y in range(r.top, int(round(r.bot - zl / r.unit))):
        runs = _runs(m[y])
        if len(runs) > 1:
            a, b = min(runs, key=lambda ab: 0 if ab[0] <= r.axis <= ab[1] else min(abs(ab[0] - r.axis), abs(ab[1] - r.axis)))
            mid[y] = False
            mid[y, a:b + 1] = True
    n, lab, st, _ = cv2.connectedComponentsWithStats((m & ~mid).astype(np.uint8))
    return mid, [lab == k for k in range(1, n) if st[k, cv2.CC_STAT_AREA] >= min_area]


def _turret(name, r, sm, sp):
    """a free-standing part of a tower, turned about its own middle and stood where the
    picture has it. Painted folded round its own axis from its outer half, which nothing
    stands in front of."""
    from mathutils import Matrix
    from scipy.ndimage import gaussian_filter1d
    ys = np.nonzero(sm.any(1))[0][::-1]                 # from its foot up
    cen, rad = [], []
    for y in ys:
        c = np.nonzero(sm[y])[0]
        cen.append((c.min() + c.max()) / 2)
        rad.append((c.max() - c.min() + 1) / 2)
    rad = gaussian_filter1d(np.array(rad, float), 0.8, mode='nearest') * r.unit
    zs = (r.bot - ys) * r.unit
    # its foot goes a little way down into what it stands on; its tip is closed
    prof = [(float(zs[0]) - 0.04, float(rad[0]))] + kit.simplify(list(zip(zs.tolist(), rad.tolist())), 0.0012)
    prof.append((float(zs[-1]) + r.unit, 0.0))
    ob = kit.lathe(name, prof, segs=sp.get('turret_segs', 24))
    xt = (float(np.median(cen)) - r.axis) * r.unit
    s = 1.0 if xt >= 0 else -1.0
    me = ob.data
    if not me.uv_layers:
        me.uv_layers.new(name='uv')
    uvl = me.uv_layers[0].data
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            u = math.hypot(co.x, co.y) * math.sin(kit.fold_angle(math.atan2(co.x, -co.y), 2))
            uvl[li].uv = kit.cell_uv(r.t, xt + s * u, co.z)
    me.transform(Matrix.Translation((xt, 0, 0)))
    me.update()
    return ob


def tower(r, sp):
    h = r.height()
    parts, zl, zu = [], 0.0, 0.0
    if 'z0' in sp:
        base, zl = plinth(r, sp)
        parts.append(base)
        # the tower's own outline starts clear of the plinth's top face: above the face's
        # far edge on a round plinth; 'zu' (fraction of the height) says where when the
        # plinth has corners and the tower hides the far edge
        zu = sp['zu'] * h if 'zu' in sp else (r.plinth['it'] + r.plinth['bt'] + 2) * r.unit
    mid, sats = _split(r, zu + 0.02)
    q = copy.copy(r)
    q.mask = mid.astype(np.uint8) * 255
    prof = q.profile(zu, h, smooth=0.8)
    if 'z0' in sp:
        prof = [(zl - 0.01, prof[0][1])] + prof
    body = _lathe('body', prof, {'segs': sp.get('body_segs', 0)})
    stone = sp.get('lid') or kit.pick([r], 0, (0.05, h * sp.get('lid_at', 0.45)))
    kit.set_uv(body, r.t, fold=sp.get('body_fold', 4), top=stone)
    parts.append(body)
    for i, sm in enumerate(sats):
        parts.append(_turret('turret%d' % i, r, sm, sp))
    return parts


def whole(r, sp):
    return [hero.build(r.t, {'w': r}, thick=sp.get('thick', 0.5), depth=sp.get('depth'),
                       knight='turn' if sp.get('turn', False) else 'side')]


KINDS = {'figure': figure, 'animal': animal, 'turned': turned, 'tower': tower, 'hero': whole}


def build(t, refs, spec):
    r = refs['w']
    sp = pick(spec, r.side, t)
    return kit.join(KINDS[sp.get('kind', 'figure')](r, sp), t)
