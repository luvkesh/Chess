"""Render a character: /opt/bv/bin/python tools/characters/render.py horse [--size 1024] [--samples 96] [--out dir]"""
import argparse, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit as K
import chars

ap = argparse.ArgumentParser()
ap.add_argument('names', nargs='+')
ap.add_argument('--size', type=int, default=1024)
ap.add_argument('--samples', type=int, default=96)
ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))
ap.add_argument('--blend', action='store_true')
ap.add_argument('--zoom', type=float, default=1.16)
ap.add_argument('--lift', type=float, default=0.07)
a = ap.parse_args()
# per-character framing (zoom on the lens, lift of the look-at point) where the default crops badly
FRAME = {'horse': (0.98, -0.02), 'giraffe': (1.1, 0.04), 'bunny': (1.08, 0.1), 'lion': (1.06, 0.06), 'squirrel': (1.06, 0.06), 'tortoise': (1.08, 0.04)}
os.makedirs(a.out, exist_ok=True)
for n in a.names:
    t = time.time()
    K.reset()
    cam, target, lens = chars.CHARS[n]()
    # a profile picture: head and the top of the shoulders
    zoom, lift = FRAME.get(n, (a.zoom, a.lift))
    target = (target[0], target[1] + lift, target[2])
    lens = lens * zoom
    K.studio(target)
    K.camera(cam, target, lens)
    K.y_up()
    print(n, 'built in %.1fs' % (time.time() - t), flush=True)
    if a.blend:
        import bpy
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(a.out, n + '.blend'))
    K.render(os.path.join(a.out, n + '.png'), a.size, a.samples)
    print(n, 'done in %.1fs' % (time.time() - t), flush=True)
