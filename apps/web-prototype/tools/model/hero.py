"""Hero pictures: each piece of a set has its own clean, detailed picture on a flat grey
backdrop (tools/model/pics/<set>/<side>-<type>.jpg; a reference cut-out redrawn sharper with
SDXL-Lightning, or a picture designed for the set). See README.md for how they are made.

  refs(pics(set), heights)   kit.Ref for each picture, for any builder (classic.build's turned
                             bodies, crowns and figures, or build() below)
  build(t, refs)             the whole picture as one rounded relief; a set that uses it sets
                             HERO = True so build.py paints the side views too"""
import os
import cv2
import numpy as np
import kit

HEIGHT = {'k': 1.75, 'q': 1.62, 'b': 1.5, 'n': 1.42, 'r': 1.36, 'p': 1.06}


def cutout(path, thresh=22):
    """mask of a figure on a flat backdrop: differs from the border's colour, holes filled,
    largest piece kept"""
    img = cv2.imread(path)
    border = np.concatenate([img[:6].reshape(-1, 3), img[-6:].reshape(-1, 3), img[:, :6].reshape(-1, 3), img[:, -6:].reshape(-1, 3)])
    bg = np.median(border, 0)
    d = np.abs(img.astype(np.int16) - bg).max(2)
    m = (d > thresh).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1:
        k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        m = (lab == k).astype(np.uint8) * 255
    # fill holes
    ff = m.copy()
    cv2.floodFill(ff, None, (0, 0), 255)
    holes = cv2.bitwise_not(ff) & ~m
    m = m | cv2.bitwise_not(ff)
    # backdrop seen through a gap (between a goblin's legs) would paint as a grey patch: fill
    # it from the figure around it
    gap = ((holes > 0) & (d <= thresh * 2)).astype(np.uint8) * 255
    if gap.sum() > 0:
        gap = cv2.dilate(gap, np.ones((5, 5), np.uint8))
        img = cv2.inpaint(img, gap, 9, cv2.INPAINT_TELEA)
        path = os.path.join(os.environ.get('COMPOSE_DIR', '/tmp/claude-0/compose'), 'hero-' + os.path.basename(path))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        cv2.imwrite(path, img, [cv2.IMWRITE_JPEG_QUALITY, 95])
        return img, m, path
    return img, m, path


def pics(sid):
    """the hero pictures of a set: {side: {type: path}} for tools/model/pics/<sid>/<side>-<type>.jpg"""
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pics', sid)
    return {s: {t: os.path.join(d, '%s-%s.jpg' % (s, t)) for t in 'kqbnrp'} for s in 'wb'}


def refs(pics, heights=None):
    """kit.Ref for every hero picture. Each picture frames its piece on its own, so the pieces'
    true sizes are not in the pictures: heights gives them in game units, as {type: h} or
    {side: {type: h}} (HEIGHT where a piece is not listed). build.py still fits every piece to
    its square and keeps king > queen > the rest afterwards."""
    out = {}
    for side, d in pics.items():
        hs = dict(HEIGHT)
        for k, v in (heights or {}).items():
            if isinstance(v, dict):
                if k == side:
                    hs.update(v)
            else:
                hs[k] = v
        out[side] = {}
        for t, path in d.items():
            img, m, path = cutout(path)
            ys, xs = np.nonzero(m)
            box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
            x0, y0, x1, y1 = box
            pad = 14
            X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
            X1, Y1 = min(img.shape[1], x1 + pad), min(img.shape[0], y1 + pad)
            r = kit.Ref(path, box, mask=m[Y0:Y1, X0:X1], unit=1.0, foot=0, pad=pad)
            r.unit = hs[t] / max(r.height() / r.unit, 1e-6)
            out[side][t] = r
    return out


def build(t, refs, thick=0.5, depth=None, knight='turn'):
    """one piece as a single rounded relief of its whole picture, base and all.
    depth: 'tsr' takes the front and back shape from TripoSR (rounder towers and animals),
    'plain' swells the outline evenly; default from HERO_DEPTH, else 'tsr'.
    knight: 'turn' turns a side-on picture so the animal looks along the file, as the game
    expects of a knight; 'side' leaves it showing its flank to both players."""
    r = refs['w']
    depth = depth or os.environ.get('HERO_DEPTH', 'tsr')
    ob = kit.relief('fig' + t, r, 0.0, thick=thick, res=0.005, use_tsr=depth == 'tsr')
    kit.set_uv_box(ob, t)
    if t == 'n' and knight == 'turn':
        import math
        import bpy
        ob.rotation_euler = (0, 0, math.pi / 2)
        bpy.context.view_layer.objects.active = ob
        for o in bpy.context.selected_objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return ob
