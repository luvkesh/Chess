"""eagle: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *
from cast._plumage import *


def eagle():
    """Skye, the aviator of New York. Shape: a wide wedge. A broad white head with bold brows,
    feathers flaring back at the cheeks, a big sunny hooked beak, sky-blue eyes, broad dark
    shoulders, and brass flying goggles pushed up on the forehead."""
    C = Char('Skye', '#dcd6cb', '#f3efe6', '#ffffff', length=0.045, align=(0, -0.55, 0.1), clump=0.22, var=0.05)
    hc, hr = (0, 0.25, 0), (0.46, 0.4, 0.43)
    shape, body = chick(hc, hr, w=0.46, d=0.38, top=-0.1)
    C.add(shape)
    # cheek feathers flaring back and down: the wedge
    cheek = S.ell((0.3, 0.1, -0.02), (0.25, 0.2, 0.3), rot=(0, 0, 0.35)).mirror()
    C.add(cheek, 0.1)
    # crown feathers slicked back
    crown = S.union(plume((0.0, 0.58, 0.0), (0.0, 0.7, -0.36), 0.1, 0.03, bend=(0, 0.04, 0)),
                    plume((0.14, 0.55, -0.02), (0.22, 0.62, -0.38), 0.08, 0.028, bend=(0, 0.04, 0)).mirror(), k=0.02)
    C.add(crown, 0.05)
    # bold brows: a soft shelf over each eye, low at the beak, high at the temples
    C.add(S.ell((0.22, 0.44, 0.3), (0.17, 0.045, 0.12), rot=(0, 0, 0.26)).mirror(), 0.06)
    low = S.plane((0, 1, 0), -0.3)
    lat = dict(rows=0.1, cols=0.125, ref=0.5)
    C.shape = shingles(C.shape, low, amp=0.024, soft=0.08, **lat)
    ex, ey, er = 0.215, 0.3, 0.12
    C.eye(ex, ey, er, 0.44, '#2f9fe6', open_=0.7, tilt=0.14, low=0.9, look=(0.02, 0.0, 1), glance=0.0, iris_r=0.93, pupil_r=0.52, glint=1.0, lid_t=0.01, sclera='#f6efe6')
    lash(C, '#3a2c22')
    bz = S.surf_z(C.shape, 0, 0.2)
    up, lo = smile_beak((0, 0.2, bz - 0.04), 0.28, 0.12, 0.14, drop=0.085, hook=0.085, lift=0.03, lower=0.62)
    bib = S.ell((0, -0.26, 0.3), (0.27, 0.26, 0.22))
    C.region(low.sub(bib, 0.05), '#4a2c16', 0.14, hair='#55331a', tip='#7c5230')
    C.region(tips(S.plane((0, 1, 0), -0.4), start=0.8, **lat), '#6e4626', 0.012, hair='#7c5230', tip='#a87848')
    C.region(cheek.grow(0.01).inter(S.plane((0, 1, 0), 0.2)), '#e6e0d6', 0.08, hair='#f3efe6', tip='#ffffff', length=0.08, align=(0.75, -0.6, -0.2), clump=0.5)
    C.region(S.ell((0, -0.24, 0.16), (0.3, 0.16, 0.2)), '#e6e0d6', 0.08, hair='#f3efe6', tip='#ffffff', length=0.075, align=(0, -1.0, 0.4), clump=0.5)
    C.build()
    K.build('SkyeBeak', up, (-0.2, -0.05, 0.2), (0.2, 0.45, 0.9), [K.glossy('SkyeHorn', '#f9b81c', 0.2)], step=0.003)
    K.build('SkyeBill', lo, (-0.2, -0.05, 0.2), (0.2, 0.45, 0.9), [bpy_mat('SkyeHorn')], step=0.003)
    # flying goggles pushed up on the forehead
    gy, tilt = 0.585, math.pi / 2 - 0.5
    rims, glass = [], []
    for sx in (1, -1):
        c = (sx * 0.135, gy, S.surf_z(C.shape, sx * 0.135, gy) + 0.035)
        rims.append(S.cyl(c, 0.115, 0.035, rot=(tilt, 0, 0), round_=0.014).sub(S.cyl((c[0], c[1] + 0.02, c[2] + 0.04), 0.09, 0.03, rot=(tilt, 0, 0))))
        glass.append(S.cyl((c[0], c[1] + 0.006, c[2] + 0.012), 0.092, 0.012, rot=(tilt, 0, 0), round_=0.008))
        gz = c[2]
    rims.append(S.tube([(0.04, gy, gz), (0, gy + 0.01, gz + 0.012), (-0.04, gy, gz)], 0.02, 0.02))
    strap = S.torus((0, gy - 0.03, -0.01), 0.435, 0.03, rot=(-0.28, 0, 0)).inter(S.plane((0, 0, 1), 0.2))
    strap = squash(strap, (0, gy, 0), 1, 0.7, 1)
    box = ((-0.6, 0.3, -0.6), (0.6, 0.85, 0.7))
    K.build('SkyeStrap', strap, *box, [K.principled('SkyeLeather', '#5a3018', rough=0.5, bump=0.2, bump_scale=80)], step=0.004)
    K.build('SkyeGoggles', S.union(*rims), *box, [K.gold('SkyeBrass', '#d9a441', 0.24)], step=0.003)
    K.build('SkyeLenses', S.union(*glass), *box, [K.principled('SkyeGlass', '#8fd0f0', rough=0.02, transmission=0.9, ior=1.4)], step=0.0025)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


build = eagle
