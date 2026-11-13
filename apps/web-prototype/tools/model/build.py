"""Builds modelled piece sets in Blender and writes the game's mesh pack.

  /opt/bv/bin/python tools/model/build.py <pack> <set> [<set> ...] [--preview DIR]

(any Python with the `bpy` wheel works: pip install bpy opencv-python-headless scipy scikit-image)
Each set is a module in tools/model/sets/<set>.py with:
  REFS  = { 'w': picture path, 'b': picture path }  (or per piece in BOXES)
  BOXES = { 'w': { 'k': (x0, y0, x1, y1), ... }, 'b': {...} }  boxes round each piece
  LOOK  = paint settings for kit.paint_cell
  build(t, refs) -> the piece's Blender object (refs: { side: kit.Ref })
The pack goes to apps/web-prototype/meshes/<pack>.txt; --preview also renders each set's
pieces in Blender next to the cut-outs from the pictures, for checking.
"""
import importlib
import io
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import cv2  # noqa: E402
import numpy as np  # noqa: E402

import kit  # noqa: E402
import pack as packer  # noqa: E402

# every piece must stand inside its square (1.0 wide, kept a little in from the edge) and the
# heights must read at a glance: king tallest, queen next, the rest below. A piece that breaks
# either rule is scaled down evenly at build time, so the game never has to shrink it.
SQUARE, STEP = 0.94, 0.96


def fit(ob, t, tall, pre=1.0, dry=False):
    """scale ob (about its foot) to the square and height rules; tall holds the king's and
    queen's heights already fitted for this side"""
    from mathutils import Matrix
    vs = np.array([v.co[:] for v in ob.data.vertices])
    w = max(np.ptp(vs[:, 0]), np.ptp(vs[:, 1]))
    h = vs[:, 2].max() - min(0.0, vs[:, 2].min())
    if dry:
        return min(1.0, SQUARE / w)
    w, h = w * pre, h * pre
    sc = min(1.0, SQUARE / w)
    if t == 'q' and 'k' in tall:
        sc = min(sc, tall['k'] * STEP / h)
    elif t not in ('k', 'q') and 'q' in tall:
        sc = min(sc, tall['q'] * STEP / h)
    tall[t] = h * sc
    sc *= pre
    if sc < 0.999:
        ob.data.transform(Matrix.Scale(sc, 4))
        ob.data.update()
    return sc


# triangle caps per piece: 'show' for close-ups (collection, menus), 'play' for the table, where
# all 32 pieces, their shadows and reflections are drawn every frame (keep a board near 150k)
CAPS = {'show': {'p': 6000, 'default': 14000}, 'play': {'p': 1800, 'default': 4500}}


def webp(img, q=86):
    ok, b = cv2.imencode('.webp', img, [cv2.IMWRITE_WEBP_QUALITY, q])
    assert ok
    return b.tobytes()


def build_set(sid):
    mod = importlib.import_module('sets.' + sid)
    kit.reset()
    hero = getattr(mod, 'HERO', False)
    kit.set_views(4 if hero else 1)
    refs = mod.refs()
    atlas = {s: np.zeros((kit.ATLAS_H, kit.ATLAS_W, 3), np.uint8) for s in refs}
    mr = {s: np.zeros((kit.ATLAS_H, kit.ATLAS_W, 3), np.uint8) for s in refs}
    glow = {s: np.zeros((kit.ATLAS_H, kit.ATLAS_W, 3), np.uint8) for s in refs}
    geoms, objs = {}, {}
    tall = {'w': {}, 'b': {}}
    built = []
    for t in kit.TYPES:
        for s, r in refs.items():
            lk = mod.LOOK[s] if s in mod.LOOK else mod.LOOK
            kit.paint_cell(r[t], t, atlas[s], mr[s], lk, half=getattr(mod, 'HALF', {}).get(t, 'right'), glow=glow[s])
            if hero:
                for view, vr in kit.tsr_views(r[t]).items():
                    kit.paint_cell(vr, t, atlas[s], mr[s], lk, half='full', glow=glow[s], view=view)
        # pieces whose two sides differ in shape (knights' manes, as a rule) are built from each
        # side's own picture; the rest share the white side's mesh
        sided = t in getattr(mod, 'SIDED', {'n'})
        for s in (refs if sided else ['w']):
            other = 'b' if s == 'w' else 'w'
            ob = mod.build(t, {'w': refs[s][t], 'b': refs[other][t]})   # 'w' is the shape's source
            objs[t] = ob
            built.append((t, s, sided, ob))
    # one even scale for the whole set first, so the king and queen fit their squares and the
    # set keeps its picture's proportions; then each piece's own square and height order
    whole = min(fit(ob, t, {}, dry=True) for t, s, sd, ob in built if t in ('k', 'q'))
    for t, s, sided, ob in built:
        sc = fit(ob, t, tall[s], pre=whole)
        if not sided:
            tall['b'][t] = tall['w'][t]
        if sc < 0.999:
            print(sid, s, t, 'fitted x%.3f' % sc, flush=True)
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        for lod in ('show', 'play'):
            cap = CAPS[lod].get(t, CAPS[lod]['default'])
            P, N, U, I = kit.mesh_arrays(ob, min(1.0, cap / max(tris, 1)))
            geoms[('%s.' % s if sided else '') + '%s.%s' % (t, lod)] = {'skin': (P, N, U, I)}
            print(sid, s if sided else '', t, lod, len(P), 'verts', len(I) // 3, 'tris', flush=True)
    out = {'geoms': geoms}
    for s in refs:
        half = cv2.resize(mr[s], (kit.ATLAS_W // 2, kit.ATLAS_H // 2), interpolation=cv2.INTER_AREA).astype(np.float32)
        # natural wear: scratches and handling show as rougher lines in the polish (stronger on
        # metal, where they catch the light), drawn at the map's own size so they stay sharp
        lk = mod.LOOK[s] if s in mod.LOOK else mod.LOOK
        wr = kit.wear(half.shape[0], half.shape[1], hash((sid, s)) & 0xffff, lk.get('wear', 1.0))
        metal = half[..., 2] / 255
        half[..., 1] = np.clip(half[..., 1] + 255 * wr * (0.1 + 0.16 * metal), 0, 255)
        out[s] = {'albedo': webp(atlas[s], 84), 'mr': webp(half.astype(np.uint8), 80),
                  'glow': webp(cv2.resize(glow[s], (kit.ATLAS_W // 2, kit.ATLAS_H // 2), interpolation=cv2.INTER_AREA), 75)}
    return out, objs, atlas


def main():
    args = sys.argv[1:]
    prev = None
    if '--preview' in args:
        i = args.index('--preview')
        prev = args[i + 1]
        del args[i:i + 2]
    pack, sets = args[0], args[1:]
    out = {}
    for sid in sets:
        d, objs, atlas = build_set(sid)
        out[sid] = d
        if prev:
            os.makedirs(prev, exist_ok=True)
            for s, a in atlas.items():
                cv2.imwrite(os.path.join(prev, '%s-atlas-%s.jpg' % (sid, s)), a)
    path = os.path.join(here, '..', '..', 'meshes', pack + '.txt')
    packer.write_pack(path, out)
    print(path, os.path.getsize(path))


if __name__ == '__main__':
    main()
