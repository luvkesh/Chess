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
    refs = mod.refs()
    atlas = {s: np.zeros((kit.ATLAS_H, kit.ATLAS_W, 3), np.uint8) for s in refs}
    mr = {s: np.zeros((kit.ATLAS_H, kit.ATLAS_W, 3), np.uint8) for s in refs}
    geoms, objs = {}, {}
    for t in kit.TYPES:
        for s, r in refs.items():
            kit.paint_cell(r[t], t, atlas[s], mr[s], mod.LOOK[s] if s in mod.LOOK else mod.LOOK, half=getattr(mod, 'HALF', {}).get(t, 'right'))
        # pieces whose two sides differ in shape (knights' manes, as a rule) are built from each
        # side's own picture; the rest share the white side's mesh
        sided = t in getattr(mod, 'SIDED', {'n'})
        for s in (refs if sided else ['w']):
            other = 'b' if s == 'w' else 'w'
            ob = mod.build(t, {'w': refs[s][t], 'b': refs[other][t]})   # 'w' is the shape's source
            objs[t] = ob
            tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
            for lod in ('show', 'play'):
                cap = CAPS[lod].get(t, CAPS[lod]['default'])
                P, N, U, I = kit.mesh_arrays(ob, min(1.0, cap / max(tris, 1)))
                geoms[('%s.' % s if sided else '') + '%s.%s' % (t, lod)] = {'skin': (P, N, U, I)}
                print(sid, s if sided else '', t, lod, len(P), 'verts', len(I) // 3, 'tris', flush=True)
    out = {'geoms': geoms}
    for s in refs:
        half = cv2.resize(mr[s], (kit.ATLAS_W // 2, kit.ATLAS_H // 2), interpolation=cv2.INTER_AREA)
        out[s] = {'albedo': webp(atlas[s], 84), 'mr': webp(half, 70)}
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
