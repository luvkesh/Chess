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
    {'kind': 'animal', 'face': 'left' | 'right', ...}
        the same from a side-on picture, turned so the animal looks along the file towards
        the opponent ('face' is the way it looks in the picture); 'turn': False leaves it
        showing its flank to both players.
    {'kind': 'turned', 'fold': n, 'top': f, 'thick': t, 'segs': n}
        towers, spires and beacons: the whole outline turned, round and true from every side
        ('segs': 6 makes it six-sided). 'top' (fraction of the height) ends the turned part
        there and carves what is above it from the picture (a roof between two turrets).
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

import cv2
import numpy as np

import hero
import kit


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


def refs(sid, heights=None, spec=None):
    out = hero.refs(hero.pics(sid), heights)
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


def sheet(sid, spec, path, heights=None):
    """every piece's plinth, enlarged, with the measured rows drawn: red the foot's widest
    row, green the top edge at the sides (z0), yellow the lid's front edge and the top face's
    ellipse; a ruler in hundredths of the piece's height on the left"""
    rs = refs(sid, heights, spec)
    tiles = []
    for s in 'wb':
        for t in 'kqbnrp':
            r = rs[s][t]
            P = r.plinth
            H = r.bot - r.top
            y0 = max(0, int(r.bot - 0.34 * H))
            im = r.crop[y0:r.bot + 6].copy()
            k = 520 / im.shape[1]
            im = cv2.resize(im, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
            row = lambda i: int(round((r.bot - i - y0) * k))
            for f in range(2, 34, 2):
                y = row(f / 100 * H)
                cv2.line(im, (0, y), (14 if f % 10 else 30, y), (255, 255, 255), 1)
                if f % 4 == 0:
                    cv2.putText(im, '%02d' % f, (32, y + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1, cv2.LINE_AA)
            c = np.nonzero(r.mask[r.bot - P['it']])[0]
            cx = (c.min() + c.max()) / 2 * k if len(c) else im.shape[1] / 2
            cv2.line(im, (0, row(P['iw'])), (im.shape[1], row(P['iw'])), (0, 0, 255), 1)
            cv2.line(im, (0, row(P['it'])), (im.shape[1], row(P['it'])), (0, 255, 0), 1)
            cv2.line(im, (0, row(P['lid'])), (im.shape[1], row(P['lid'])), (0, 255, 255), 1)
            cv2.ellipse(im, (int(cx), row(P['it'])), (int(P['W'] / 2 * k), max(1, int(P['bt'] * k))), 0, 0, 360, (0, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(im, '%s-%s z0 %.3f tilt %.2f' % (s, t, P['it'] / H, P['tilt']), (60, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            tiles.append(im)
    h = max(i.shape[0] for i in tiles)
    tiles = [cv2.copyMakeBorder(i, h - i.shape[0], 0, 0, 0, cv2.BORDER_CONSTANT, value=(40, 40, 40)) for i in tiles]
    cv2.imwrite(path, np.vstack([np.hstack(tiles[i:i + 6]) for i in (0, 6)]), [cv2.IMWRITE_JPEG_QUALITY, 88])


def _stone(r, zl):
    """a clean spot of the plinth's own top face to paint lids with: on the front half of the
    top ellipse, well out from the middle where the figure stands"""
    P = r.plinth
    return (0.62 * P['W'] / 2 * r.unit, zl + 0.3 * P['bt'] * r.unit)


def _lathe(name, prof, sp):
    """a turned part; with 'segs' it has that many flat sides (one faces the front) instead of
    being round"""
    n = sp.get('segs', 80)
    if n <= 12 and n % 4 == 0:
        # the outline is the width across the flats here, the ring is set out by its corners
        prof = [(z, w / math.cos(math.pi / n)) for z, w in prof]
    ob = kit.lathe(name, prof, segs=n)
    if n <= 12:
        # kit.lathe starts its ring on the x axis, which puts a flat side in front for 6 and 10
        # sides; 4, 8 and 12 need half a step
        if n % 4 == 0:
            ob.data.transform(__import__('mathutils').Matrix.Rotation(math.pi / n, 4, 'Z'))
        for p in ob.data.polygons:
            p.use_smooth = False
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


def figure(r, sp):
    base, zl = plinth(r, sp)
    fig = _carve('figure', r, sp, zl, min(sp.get('thick', 0.5), 0.92 * r.plinth['W'] * r.unit))
    return [base, fig]


def animal(r, sp):
    base, zl = plinth(r, sp)
    body = _carve('animal', r, sp, zl, sp.get('thick', 0.42))
    if sp.get('turn', True):
        # +90 degrees brings the picture's left to the front (Blender -y, towards the opponent)
        body.rotation_euler = (0, 0, math.pi / 2 if sp.get('face', 'left') == 'left' else -math.pi / 2)
    return [base, body]


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


def whole(r, sp):
    return [hero.build(r.t, {'w': r}, thick=sp.get('thick', 0.5), depth=sp.get('depth'),
                       knight='turn' if sp.get('turn', False) else 'side')]


KINDS = {'figure': figure, 'animal': animal, 'turned': turned, 'hero': whole}


def build(t, refs, spec):
    r = refs['w']
    sp = pick(spec, r.side, t)
    return kit.join(KINDS[sp.get('kind', 'figure')](r, sp), t)
