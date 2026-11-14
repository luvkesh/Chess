"""Render a character: /opt/bv/bin/python tools/characters/render.py horse [--size 1024] [--samples 96] [--out dir]"""
import argparse, math, os, sys, time
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
FRAME = {'horse': (0.98, -0.02), 'giraffe': (1.1, 0.04), 'bunny': (1.0, 0.04), 'lion': (1.06, 0.06), 'squirrel': (1.06, 0.06), 'tortoise': (1.08, 0.04)}
# per-character pose in degrees (turn left/right, tilt of the head, chin up/down), about the head, so
# the friends don't all face the camera the same way: a shy tilt, a sly three-quarter look, a proud chin
POSE = {
    'horse': (8, -4, 0), 'bunny': (-8, 9, 3), 'beaver': (10, -3, 2), 'squirrel': (-18, -8, -2), 'tortoise': (6, 4, 8),
    'raccoon': (24, 6, 0), 'giraffe': (-10, -7, 0), 'raven': (-30, 4, -4), 'dragon': (12, 9, -4),
    'cat': (-20, -5, -6), 'owl': (0, 12, 0), 'wolf': (26, -3, -7), 'elephant': (-8, 3, 4), 'panda': (6, 9, 2),
    'lion': (-14, 0, -9), 'rooster': (-22, -6, -10), 'bear': (12, -6, 3), 'eagle': (34, 0, -6),
}
os.makedirs(a.out, exist_ok=True)


def pose(yaw, roll, pitch, pivot=(0, 0.1, 0)):
    import bpy
    from mathutils import Matrix
    r = math.radians
    bpy.context.view_layer.update()   # matrix_world is stale for objects placed by property
    p = Matrix.Translation(pivot)
    M = p @ Matrix.Rotation(r(yaw), 4, 'Y') @ Matrix.Rotation(r(roll), 4, 'Z') @ Matrix.Rotation(r(pitch), 4, 'X') @ p.inverted()
    for o in bpy.data.objects:
        if o.parent is None:
            o.matrix_world = M @ o.matrix_world


for n in a.names:
    t = time.time()
    K.reset()
    cam, target, lens = chars.CHARS[n]()
    pose(*POSE.get(n, (0, 0, 0)))
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
