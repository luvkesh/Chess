"""cat: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def cat():
    """Miu: the black cat of the Nile: green slit eyes lined in lapis kohl, a gold hoop, a scarab on
    the brow and a broad usekh collar of gold, lapis and carnelian."""
    C = Char('Miu', '#141418', '#1c1c24', '#3a3c4a', length=0.018, align=(0, -0.4, -0.2), clump=0.06, var=0.1)
    head, mu = critter_head((0, 0.2, 0), (0.34, 0.29, 0.3), 0.15, (0.11, 0.08, 0.09), 0.02, 0.27, taper=-0.18)
    C.add(head)
    for sx in (1, -1):
        e, cut = ear((sx * 0.17, 0.4, -0.04), (sx * 0.33, 0.78, -0.06), 0.12, 0.018, thick=0.04, cup=0.65)
        C.add(e, 0.04).sub(cut, 0.015)
    body = torso(-0.5, 0.58, 0.26)
    C.add(body, 0.18)
    face_basics(C, 0.1, -0.0, (0.035, 0.024, 0.03), 0.075, 0.04, 0.06, 1.1, '#3a2a30', closed=True, rise=0.02, smirk=0.035)
    C.eye(0.145, 0.24, 0.1, 0.6, '#3cc864', tilt=0.3, look=(0.06, 0.0, 1), glance=-0.2, slit=True, open_=0.48, low=0.55, iris_r=0.86)
    C.region(S.ell((0.24, 0.62, 0.02), (0.06, 0.13, 0.04)).mirror(), '#3a2a30', 0.02)
    kohl = S.union(S.ell((0.15, 0.24, 0.2), (0.124, 0.112, 0.16)).sub(S.ell((0.15, 0.24, 0.2), (0.112, 0.1, 0.2))).mirror(),
                   S.tube([(0.26, 0.22, 0.16), (0.32, 0.2, 0.1), (0.36, 0.2, 0.03)], 0.012, 0.005).mirror())
    C.region(kohl, K.enamel('MiuKohl', '#1e3ea8'), 0.008)
    face_regions(C)
    C.build()
    mouth_after(C, top_teeth=False)
    # whiskers
    paths = []
    for sx in (1, -1):
        for j, a in enumerate((-0.12, 0.0, 0.12)):
            p0 = np.array([sx * 0.08, 0.04 - j * 0.02, 0.33])
            pts = [p0 + np.array([sx * 0.3 * t, (a * 0.8 - 0.05 * t) * t, -0.05 * t]) for t in np.linspace(0, 1, 8)]
            paths.append(np.array(pts))
    K.strands('MiuWhiskers', paths, K.principled('Whisker', '#f2f0ea', rough=0.3), 0.0025, 0.0006)
    K.build('MiuHoop', S.torus((0.31, 0.5, 0.0), 0.04, 0.008, rot=(0, 0, 1.4)), (0.2, 0.4, -0.1), (0.4, 0.6, 0.1), [K.gold('MiuGold')], step=0.002)
    bz = S.surf_z(C.shape, 0, 0.42)
    scarab = S.union(S.ell((0, 0.43, bz), (0.035, 0.045, 0.02)), S.ell((0, 0.385, bz - 0.005), (0.022, 0.015, 0.014)), k=0.006)
    K.build('MiuScarab', scarab, (-0.1, 0.33, bz - 0.1), (0.1, 0.5, bz + 0.1), [K.enamel('MiuScarabBlue', '#1a6ab8')], step=0.002)
    K.build('MiuScarabGold', S.ell((0, 0.43, bz - 0.004), (0.045, 0.055, 0.02)).shell(0.004).inter(S.plane((0, 0, -1), -bz + 0.002)), (-0.1, 0.33, bz - 0.1), (0.1, 0.5, bz + 0.1), [bpy_mat('MiuGold')], step=0.002)
    rings = [('#e8b850', 0.0), ('#1e3ea8', 0.05), ('#e8b850', 0.1), ('#c0402a', 0.14), ('#e8b850', 0.19), ('#2aa6a0', 0.23), ('#e8b850', 0.28)]
    for j, (col, off) in enumerate(rings):
        band = body.grow(0.02 + j * 0.002).inter(S.plane((0, 1, 0), -0.3 - off)).inter(S.plane((0, -1, 0), 0.3 + off + 0.045))
        mat = K.gold('MiuG%d' % j, col) if col == '#e8b850' else K.enamel('MiuE%d' % j, col)
        K.build('MiuCollar%d' % j, band.bump(0.003, 60, j), (-0.8, -0.75, -0.6), (0.8, -0.2, 0.6), [mat], step=0.004)
    return (0.55, 0.12, 3.9), (0, 0.04, 0), 76


build = cat
