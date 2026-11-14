"""eagle: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def eagle():
    """Skye: a New York eagle: white head, brown body, a strong yellow beak, aviator goggles up on
    the brow, a white silk scarf and a leather flying jacket with a fleece collar."""
    C = Char('Skye', '#d8d4cc', '#f4f2ec', '#ffffff', length=0.03, align=(0, -0.7, -0.3), clump=0.45, var=0.05)
    body = bird(C, (0, 0.22, 0), (0.31, 0.3, 0.3), 0.7, 0.32)
    C.add(S.ell((0.13, 0.36, 0.2), (0.11, 0.035, 0.07), rot=(0, 0, 0.2)).mirror(), 0.04)
    C.eye(0.14, 0.27, 0.085, 0.58, '#f0c020', look=(0.06, 0.0, 1), glance=-0.2, open_=0.5, tilt=-0.3, low=0.6, iris_r=0.86, pupil_r=0.3)
    bc = (0, 0.16, S.surf_z(C.shape, 0, 0.16) - 0.06)
    up, lo = beak(bc, 0.3, 0.1, 0.09, 0.07, 0.09)
    jacket = garment(body, -0.36, 0.05, (0.3, 0.14))
    C.region(body.grow(0.01).inter(S.plane((0, 1, 0), -0.2)), '#4a2a14', 0.06, hair='#6a4020', tip='#9a6a3a', length=0.03, clump=0.5)
    C.region(jacket.grow(0.02), '#222222', 0.01)
    C.build()
    K.build('SkyeBeak', up.add(lo, 0.01), (-0.2, -0.1, 0.0), (0.2, 0.35, 0.75), [K.glossy('SkyeHorn', '#f0b828', 0.22)], step=0.003)
    K.build('SkyeJacket', jacket, (-0.85, -1.3, -0.7), (0.85, -0.25, 0.6), [K.principled('SkyeLeather', '#5a3018', rough=0.45, coat=0.3, bump=0.3, bump_scale=60)], step=0.006)
    fleece = S.torus((0, -0.36, -0.05), 0.36, 0.06, rot=(0.25, 0, 0))
    fo = K.build('SkyeFleece', fleece, (-0.6, -0.6, -0.6), (0.6, -0.1, 0.6), [K.skin('SkyeFleeceSkin', '#e8dcc4')], step=0.004)
    fo.data.materials.append(K.hair_mat('SkyeFleeceHair', '#efe4cc', '#fff6e4', var=0.06))
    K.vgroup(fo, 'all', np.ones(len(fo.data.vertices)))
    K.fur(fo, 'all', 'SkyeFleeceHair', length=0.02, count=16000, children=6, align=(0, 0, 0), clump=0.4, rough=0.006, root=0.002, seed=8)
    scarf = S.union(S.torus((0, -0.33, -0.04), 0.32, 0.04, rot=(0.25, 0, 0)), squash(S.tube([(0.1, -0.36, 0.3), (0.2, -0.5, 0.36), (0.34, -0.6, 0.3), (0.46, -0.72, 0.18)], 0.07, 0.06), (0.25, -0.55, 0.3), 1, 1, 0.4), k=0.03).bump(0.008, 14, 6)
    K.build('SkyeScarf', scarf, (-0.6, -0.9, -0.5), (0.7, -0.2, 0.6), [K.silk('SkyeSilk', '#f6f4ee')], step=0.004)
    gy = 0.43
    goggles = []
    for sx in (1, -1):
        c = (sx * 0.12, gy, S.surf_z(C.shape, sx * 0.12, gy) + 0.02)
        goggles.append((c, S.cyl(c, 0.085, 0.03, rot=(math.pi / 2 - 0.3, 0, 0), round_=0.01)))
    strap = S.torus((0, gy - 0.01, -0.02), 0.31, 0.022, rot=(-0.3, 0, 0)).sub(S.plane((0, 0, 1), 0.12))
    K.build('SkyeStrap', strap, (-0.5, 0.2, -0.5), (0.5, 0.65, 0.5), [K.principled('SkyeStrapLeather', '#3a2010', rough=0.55, bump=0.2, bump_scale=80)], step=0.004)
    K.build('SkyeGoggles', S.union(*[g for _, g in goggles], S.tube([(0.05, gy, goggles[0][0][2]), (0, gy + 0.01, goggles[0][0][2] + 0.01), (-0.05, gy, goggles[0][0][2])], 0.015, 0.015)), (-0.4, 0.25, -0.1), (0.4, 0.65, 0.6), [K.gold('SkyeBrass', '#c8a060', 0.25)], step=0.0025)
    K.build('SkyeLenses', S.union(*[S.cyl((c[0], c[1], c[2] + 0.02), 0.068, 0.012, rot=(math.pi / 2 - 0.3, 0, 0), round_=0.008) for c, _ in goggles]), (-0.4, 0.25, -0.1), (0.4, 0.65, 0.65), [K.principled('SkyeGlass', '#7ab0c8', rough=0.02, transmission=0.9, ior=1.4)], step=0.002)
    return (0.55, 0.14, 3.9), (0, 0.04, 0), 76


build = eagle
