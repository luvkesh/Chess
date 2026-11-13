"""Hero sets: each piece comes from its own clean, detailed picture (a reference cut-out
redrawn sharper with SDXL-Lightning img2img, or a picture designed for the set) on a flat grey
backdrop. The shape is TripoSR's true 3D form cut to the picture's outline, the front is
painted from the picture and the back and sides from TripoSR's own views of the piece.
A set module using it sets HERO = True, PICS = {side: {type: path}} and calls hero.refs/build."""
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
    m = m | cv2.bitwise_not(ff)
    # a soft shadow on the backdrop under the plinth joins the figure: trim rows below the
    # widest low row where the mask turns to a thin smear
    return img, m


def refs(pics, heights=None):
    hs = dict(HEIGHT, **(heights or {}))
    out = {}
    for side, d in pics.items():
        out[side] = {}
        for t, path in d.items():
            img, m = cutout(path)
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


def build(t, refs, thick=0.5):
    r = refs['w']
    ob = kit.relief('fig' + t, r, 0.0, thick=thick, res=0.005, use_tsr=True)
    kit.set_uv_box(ob, t)
    if t == 'n':
        # a knight's picture is its side: turn it so it looks along the row, as the game expects
        import math
        import bpy
        ob.rotation_euler = (0, 0, math.pi / 2)
        bpy.context.view_layer.objects.active = ob
        for o in bpy.context.selected_objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return ob
