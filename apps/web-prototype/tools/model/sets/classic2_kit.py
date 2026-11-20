"""Shared by the four sets of pack classic2 (pagoda, pharaoh, ocean, manhattan). Special cases
of this pack, kept out of the shared kit:

  refs(set, heights)     hero pictures as kit.Ref, each cut by its own saved mask
                         (pics/<set>/<side>-<type>-mask.png) where there is one: a piece's grey
                         parts (a fur stole, a silver pearl) are too near the backdrop for a cut
                         by colour.
  build(t, refs, spec)   classic.build, then the piece is painted by the picture's own view
                         instead of folded round its axis (see project()).
"""
import cv2
import numpy as np

import classic
import hero
import kit


def measure_foot(r, reach=0.22):
    """how the picture shows the plinth's round bottom edge: the rows it takes to reach its full
    width (r.foot_rows) and that width (r.foot_px). The pictures look down a little, so the
    front of the edge hangs below its sides by that many rows."""
    m = r.mask
    n = max(8, int((r.bot - r.top) * reach))
    ws = []
    for k in range(n):
        c = np.nonzero(m[r.bot - k])[0]
        ws.append(float(c.max() - c.min()) if len(c) else 0.0)
    k = 2
    while k + 4 < n and ws[k + 4] - ws[k] > 0.006 * ws[k] + 0.6:
        k += 1
    r.foot_rows, r.foot_px = k, ws[k]
    return r


def refs(sid, heights):
    """like hero.refs, with each picture's own mask"""
    out = {}
    for side, d in hero.pics(sid).items():
        out[side] = {}
        hs = heights[side] if isinstance(heights.get(side), dict) else heights   # 'b' is also the bishop
        for t, path in d.items():
            m = cv2.imread(path[:-4] + '-mask.png', cv2.IMREAD_GRAYSCALE)
            if m is None:
                _, m, path = hero.cutout(path)
            m = np.where(m > 127, 255, 0).astype(np.uint8)
            ys, xs = np.nonzero(m)
            x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
            pad = 14
            X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
            X1, Y1 = min(m.shape[1], x1 + pad), min(m.shape[0], y1 + pad)
            r = kit.Ref(path, (x0, y0, x1, y1), mask=m[Y0:Y1, X0:X1], unit=1.0, foot=0, pad=pad)
            r.unit = hs[t] / max(r.height(), 1e-6)
            out[side][t] = measure_foot(r)
    # one view for the whole set (its pieces come from one photograph): the sine of the angle
    # the camera looks down at, from how far each round foot hangs
    rs = [r for side in out for r in out[side].values()]
    tilt = float(np.median([2.0 * r.foot_rows / max(r.foot_px, 1.0) for r in rs]))
    for r in rs:
        r.tilt = tilt
    print(sid, 'view tilt %.3f' % tilt, flush=True)
    return out


def islands(me):
    """vertex index -> island number, for the parts a joined piece is made of"""
    parent = list(range(len(me.vertices)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for e in me.edges:
        a, b = find(e.vertices[0]), find(e.vertices[1])
        if a != b:
            parent[a] = b
    return [find(i) for i in range(len(parent))]


def lid_spot(r, zc, R):
    """world (x, z) of a clean spot of the plinth's top as the picture shows it: beside the
    figure, a little above the rim's front edge. The spot nearest the middle colour there."""
    b = r.foot_rows * r.unit
    y0 = int(round(r.bot - (zc + 1.2 * b) / r.unit))
    y1 = int(round(r.bot - (zc + 0.3 * b) / r.unit))
    x0 = int(round(r.axis + 0.5 * R / r.unit))
    x1 = int(round(r.axis + 0.92 * R / r.unit))
    y0, y1 = max(0, y0), min(r.mask.shape[0], max(y1, y0 + 2))
    x0, x1 = max(0, x0), min(r.mask.shape[1], max(x1, x0 + 2))
    ys, xs = np.nonzero(r.mask[y0:y1, x0:x1])
    if len(ys) < 12:
        return kit.pick([r], 0, (0.6 * R, zc))
    cols = r.crop[y0:y1, x0:x1][ys, xs].astype(np.float32)
    i = int(np.argmin(((cols - np.median(cols, 0)) ** 2).sum(1)))
    return (x0 + xs[i] - r.axis) * r.unit, (r.bot - (y0 + ys[i])) * r.unit


def project(ob, t, r, only=None, lid=None):
    """Paint the piece by the picture's own view: straight on from the front and a little from
    above (r.tilt), mirrored onto the back, so each player sees the picture's front. A point at
    depth y shows the picture's row z - |y| * tilt: a plinth's bands run level round it instead
    of sagging, and its flat top takes the picture's own top, not one streaked row.
    only: island numbers to paint (others keep their paint); lid: (zc, uv) paints the flat cap
    at height zc from one spot instead.
    The round bottom edge, which the outline turned into a bowl, is made flat and the piece is
    set down on it."""
    me = ob.data
    uvl = me.uv_layers[0].data
    s = r.tilt
    b = s * r.foot_px / 2 * r.unit
    isl = islands(me) if only is not None else None
    for v in me.vertices:
        if v.co.z < b:
            v.co.z = b
    for poly in me.polygons:
        if isl is not None and isl[poly.vertices[0]] not in only:
            continue
        cap = lid is not None and poly.normal.z > 0.9 and all(lid[0] - 0.006 < me.vertices[i].co.z < lid[0] + 0.001 for i in poly.vertices)
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uvl[li].uv = lid[1] if cap else kit.cell_uv(t, co.x, co.z - abs(co.y) * s)
    for v in me.vertices:
        v.co.z -= b
    me.update()
    return ob


def build(t, refs, spec):
    ob = classic.build(t, refs, spec)
    r = refs['w']
    sp = spec.get(t, {'kind': 'turned'})
    if sp['kind'] == 'knight':
        # the head keeps its side-on paint (it is turned to look along the file); the plinth is
        # painted by the view, its top from one clean spot (the picture shows the horse there)
        me = ob.data
        isl = islands(me)
        low = isl[int(np.argmin([v.co.z for v in me.vertices]))]
        zc = sp.get('z0', 0.28) * r.height() + 0.02
        uv = kit.cell_uv(t, *lid_spot(r, zc, r.width(zc - 0.02)))
        return project(ob, t, r, only={low}, lid=(zc, uv))
    return project(ob, t, r)
