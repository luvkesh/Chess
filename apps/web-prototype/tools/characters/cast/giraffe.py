"""giraffe: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def giraffe():
    """Ivy: a giraffe with patches, ossicones with dark tufts, and round gold spectacles."""
    C = Char('Ivy', '#a8762a', '#e6b452', '#f4d488', length=0.016, align=(0, -0.6, -0.1), clump=0.06)
    head = S.union(S.ell((0, 0.3, -0.02), (0.29, 0.27, 0.27)), S.cone((0, 0.2, 0.12), (0, 0.02, 0.3), 0.19, 0.16),
                   S.ell((0, -0.02, 0.32), (0.18, 0.13, 0.15)), k=0.1)
    C.add(head)
    neck = S.cone((0, 0.1, -0.12), (0, -0.9, -0.15), 0.2, 0.3)
    C.add(neck, 0.1).add(S.ell((0, -1.15, -0.1), (0.65, 0.35, 0.4)), 0.15)
    ossi = S.union(*[S.cone((sx * 0.11, 0.48, -0.08), (sx * 0.14, 0.7, -0.1), 0.035, 0.03) for sx in (1, -1)])
    knobs = S.sphere((0.145, 0.71, -0.1), 0.05).mirror()
    C.add(ossi, 0.03).add(knobs, 0.02)
    for sx in (1, -1):
        e = squash(S.ell((sx * 0.32, 0.42, -0.06), (0.13, 0.05, 0.05), rot=(0, 0, sx * 0.35)), (sx * 0.32, 0.42, -0.06), 1, 1, 0.8)
        C.add(e, 0.04)
    nz = S.surf_z(C.shape, 0.07, 0.0)
    C.sub(S.ell((0.07, 0.0, nz), (0.022, 0.035, 0.03), rot=(0.4, 0, 0.3)).mirror(), 0.01)
    mc = (0, -0.1, S.surf_z(C.shape, 0, -0.1) - 0.035)
    cav = crease(C.shape, (0, -0.08, 0), 0.1, 0.03)
    C.sub(cav, 0.008)
    C._closed = True
    C._mouth = (mc, 0.1, 0.045, 0.07, 1.0, cav)
    C.eye(0.15, 0.27, 0.088, 0.62, '#4c9a44', look=(0.06, 0.04, 1), open_=0.75, tilt=-0.1, iris_r=0.82)
    rng = np.random.default_rng(11)
    pts = [p for p in rng.uniform([-0.5, -1.4, -0.5], [0.5, 0.5, 0.5], (260, 3))]
    def patches(P, pts=np.array(pts)):
        d1 = np.full(len(P), 9.0); d2 = np.full(len(P), 9.0)
        for q in pts:
            d = np.linalg.norm((P - q) * np.array([1, 0.8, 1]), axis=1)
            d2 = np.minimum(d2, np.maximum(d1, d)); d1 = np.minimum(d1, d)
        return 0.012 - (d2 - d1)
    face_zone = S.ell((0, 0.05, 0.28), (0.22, 0.25, 0.2))
    C.region(S.F(patches).sub(face_zone, 0.05).sub(S.ell((0, 0.65, -0.1), (0.25, 0.12, 0.2))), '#8a4a1a', 0.01, hair='#94501c', tip='#b06a2a', length=0.016)
    C.region(S.ell((0, -0.04, 0.32), (0.2, 0.15, 0.17)), '#e8cc9a', 0.03, hair='#f0d8a8', tip='#fbe8c4', length=0.012)
    C.region(knobs.grow(0.02), '#2a1a10', 0.02, hair='#2a1a10', tip='#5a3a20', length=0.05, align=(0, 1, 0), clump=0.5)
    C.region(cav.grow(0.004), '#3a1a10', 0.006)
    C.build()
    brows(C, '#1a0e08', '#2a1a10', length=0.05, angle=0.4, lift=-0.28, n=70, comb=(0.8, 1.0, 0.6), gravity=-0.3, thick=0.004, clump=0.3, root=0.0016, name='IvyLash')
    # round gold spectacles resting on the nose
    ecs = C.eyes[0][0]
    rims = []
    for sx in (1, -1):
        c = (ecs[0] * sx, ecs[1] - 0.005, ecs[2] + C.eyes[0][1] + 0.03)
        rims.append(S.torus(c, 0.105, 0.009, rot=(math.pi / 2, 0, 0)))
    bridge = S.tube([(-0.05, ecs[1] + 0.02, ecs[2] + 0.13), (0, ecs[1] + 0.04, ecs[2] + 0.14), (0.05, ecs[1] + 0.02, ecs[2] + 0.13)], 0.007, 0.007)
    arms = S.union(*[S.tube([(sx * (ecs[0] + 0.1), ecs[1], ecs[2] + 0.11), (sx * 0.3, ecs[1] + 0.02, 0.0), (sx * 0.31, ecs[1] + 0.0, -0.15)], 0.006, 0.006) for sx in (1, -1)])
    K.build('IvySpecs', S.union(*rims, bridge, arms), (-0.5, 0.0, -0.3), (0.5, 0.5, 0.6), [K.gold('IvyGold')], step=0.0022)
    lens = S.union(*[S.cyl((ecs[0] * sx, ecs[1] - 0.005, ecs[2] + C.eyes[0][1] + 0.03), 0.1, 0.003, rot=(math.pi / 2, 0, 0)) for sx in (1, -1)])
    K.build('IvyLens', lens, (-0.5, 0.0, -0.3), (0.5, 0.5, 0.6), [K.principled('IvyGlass', '#ffffff', rough=0.0, transmission=1.0, ior=1.3)], step=0.002)
    return (0.55, 0.15, 4.2), (0, 0.0, 0), 70


build = giraffe
