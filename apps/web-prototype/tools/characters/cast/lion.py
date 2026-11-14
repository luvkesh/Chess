"""lion: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def lion():
    """Marco: the winged lion of Saint Mark: a great russet mane, a gold halo, wings at his back,
    a blue velvet coat with a gold collar."""
    C = Char('Marco', '#8a5a20', '#d8a04a', '#f0c878', length=0.02, align=(0, -0.5, -0.1), clump=0.1)
    head, mu = critter_head((0, 0.2, 0), (0.35, 0.31, 0.31), 0.22, (0.21, 0.13, 0.13), 0.0, 0.3, taper=0.1)
    C.add(head)
    C.add(S.ell((0.27, 0.43, -0.04), (0.07, 0.065, 0.045)).mirror(), 0.04)
    body = torso(-0.5, 0.7, 0.3)
    C.add(body, 0.18)
    face_basics(C, 0.1, -0.04, (0.06, 0.04, 0.042), 0.11, 0.055, 0.08, 0.95, '#6a3a2a', closed=True, rise=0.035)
    C.eye(0.145, 0.25, 0.088, 0.6, '#e8a418', look=(0.06, 0.03, 1), open_=0.62, tilt=0.12, iris_r=0.86, pupil_r=0.28)
    C.region(S.ell((0, 0.02, 0.27), (0.2, 0.15, 0.14)), '#f0dcb0', 0.04, hair='#f8ead0', tip='#fff8ea', length=0.016)
    mane_zone = S.ell((0, 0.16, -0.05), (0.5, 0.48, 0.4)).inter(S.F(lambda P: P[:, 2] - 0.06 + 0.25 * np.clip(0.1 - P[:, 1], 0, 1)), 0.04)
    mane_i = C.region(mane_zone, '#7a3a14', 0.04)
    face_regions(C)
    coat = garment(body, -0.36, 0.045, (0.3, 0.14))
    C.region(coat.grow(0.02), '#222222', 0.01)
    C.build()
    mouth_after(C)
    mane_m = K.hair_mat('MarcoMane', '#a8541c', '#e8a050', rough=0.3, var=0.2)
    P, N = K.sample_surface(C.o, C.W[:, mane_i], 7000, seed=4)
    out = N * np.array([1.0, 0.6, 0.4])
    K.strands('MarcoMane', K.groom(P, N, 0.24, (0, -0.1, -0.15), gravity=0.6, lift=1.2, clumps=140, clump=0.7, jitter=0.25, seed=4, curl=0.12), mane_m, 0.006, 0.001, normals=N)
    K.build('MarcoCoat', coat, (-0.85, -1.3, -0.7), (0.85, -0.25, 0.6), [K.velvet('MarcoBlue', '#173a92')], step=0.006)
    shirt = body.grow(0.02).inter(S.plane((0, 1, 0), -0.36)).inter(S.plane((0, 0, -1), -0.05))
    K.build('MarcoShirt', shirt, (-0.4, -1.3, -0.2), (0.4, -0.3, 0.6), [K.principled('MarcoLinen', '#f4ecdc', rough=0.6, bump=0.05)], step=0.006)
    col = S.torus((0, -0.36, -0.05), 0.36, 0.03, rot=(0.25, 0, 0)).add(S.cyl((0, -0.4, -0.05), 0.37, 0.04, rot=(0.25, 0, 0)).shell(0.01), 0.008)
    K.build('MarcoCollar', col, (-0.6, -0.6, -0.6), (0.6, -0.2, 0.6), [K.gold('MarcoGold')], step=0.004)
    K.build('MarcoHalo', S.torus((0, 0.36, -0.45), 0.5, 0.022, rot=(1.5, 0, 0)), (-0.7, -0.3, -0.6), (0.7, 1.0, -0.3), [bpy_mat('MarcoGold')], step=0.004)
    feathers, tips = [], []
    for sx in (1, -1):
        for row, (n, L, z) in enumerate(((9, 0.62, -0.42), (7, 0.42, -0.38), (6, 0.26, -0.34))):
            for j in range(n):
                a = 0.15 + j * (1.25 / n)
                base = np.array([sx * 0.38, -0.32, z])
                tip = base + np.array([sx * math.cos(a) * L, math.sin(a) * L * 1.1 + 0.05, -0.04])
                f = squash(S.cone(base, tip, 0.055 - row * 0.008, 0.012), tuple((base + tip) / 2), 1, 1, 0.28)
                feathers.append(f)
                if row == 0:
                    tips.append(squash(S.cone(base + (tip - base) * 0.82, tip, 0.04, 0.012), tuple(tip), 1, 1, 0.3).grow(0.003))
    K.build('MarcoWings', S.union(*feathers, k=0.006), (-1.1, -0.5, -0.6), (1.1, 0.75, -0.1), [K.principled('MarcoFeather', '#f4ead6', rough=0.5, sheen=0.7, sss=0.3, bump=0.2, bump_scale=300)], step=0.0045)
    K.build('MarcoWingTips', S.union(*tips), (-1.1, -0.5, -0.6), (1.1, 0.75, -0.1), [bpy_mat('MarcoGold')], step=0.0035)
    return (0.55, 0.12, 4.1), (0, 0.04, 0), 72


build = lion
