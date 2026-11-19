"""lion: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from cast._groupb import *


def lion():
    """Marco: the proud little winged lion of Venice. A great round auburn mane around a small
    golden face, lagoon-green eyes with lowered lids, chin up, and two cream wings tipped in gold."""
    C = Char('Marco', '#c88a3a', '#e8b254', '#ffe2a0', length=0.032, align=(0, -0.6, 0.0), clump=0.16)
    head = S.union(S.ell((0, 0.18, 0.03), (0.35, 0.31, 0.33)),
                   S.ell((0.2, 0.03, 0.14), (0.15, 0.12, 0.15)).mirror(),
                   S.ell((0, 0.0, 0.28), (0.15, 0.1, 0.11)),
                   S.ell((0, -0.08, 0.22), (0.09, 0.06, 0.1)), k=0.09)
    C.add(head)
    mane = S.ell((0, 0.2, -0.13), (0.45, 0.44, 0.33))
    C.add(mane, 0.05)
    C.add(S.ell((0.3, 0.5, 0.04), (0.1, 0.095, 0.05)).mirror(), 0.03)
    C.sub(S.ell((0.295, 0.49, 0.09), (0.06, 0.055, 0.035)).mirror(), 0.02)
    body = chubby(0.45, 0.36)
    C.add(body, 0.1)
    nose, nose_c = small_nose(C.shape, 0.05, 0.046, 0.03, 0.03)
    C.add(nose, 0.008)
    mouth = w_mouth(C.shape, (0, -0.012, 0), 0.07, 0.016, 0.016, philtrum=0.03, r=0.0075)
    C.sub(mouth, 0.005)
    eye_set(C, 0.165, 0.2, 0.108, out=0.42, open_=0.6, tilt=0.12, lash=0.2)
    C.region(S.ell((0, -0.02, 0.3), (0.19, 0.12, 0.14)), '#f4dcae', 0.05, hair='#fbe8c4', tip='#fff8e6', length=0.022)
    mane_zone = S.union(mane.grow(0.02).sub(S.ell((0, 0.14, 0.2), (0.31, 0.3, 0.3)), 0.05), S.ell((0, -0.2, 0.2), (0.2, 0.09, 0.16)), k=0.05)
    C.region(mane_zone, '#7a3410', 0.04, hair='#a64c18', tip='#f09a40', length=0.09, align=(0, -0.3, 0.1), clump=0.5)
    C.region(S.ell((0.3, 0.5, 0.06), (0.1, 0.095, 0.07)).mirror(), '#c88a3a', 0.02, hair='#e8b254', tip='#ffe2a0', length=0.02)
    C.region(S.ell((0.295, 0.49, 0.09), (0.055, 0.05, 0.035)).mirror(), '#8a4a2a', 0.015)
    C.region(S.ell(nose_c, (0.05, 0.034, 0.036)), K.glossy('MarcoNose', '#a8504c', 0.25), 0.006)
    C.region(mouth.grow(0.003), '#5a2c20', 0.004)
    clear(C, S.union(mouth.grow(0.01), S.ell(nose_c, (0.065, 0.048, 0.05))))
    C.build()
    eyes_after(C, look=(0.04, 0.04, 1), glance=0.12, iris='#16b4a4', glow='#a4fff0', deep='#064a48', hl=(-0.3, 0.14), hl_size=0.19)
    ring = mane.grow(0.02).sub(S.ell((0, 0.14, 0.25), (0.36, 0.35, 0.35)), 0.04)
    tufts(C, 'Mane', ring, 7500, 0.19, (0.0, 0.05, -0.12), '#a64c18', '#f6a444', gravity=0.55, clumps=260, clump=0.5, lift=1.4, jitter=0.32,
          root=0.004, curl=0.16, mirror=False, seed=4, var=0.22, rough=0.3)
    tufts(C, 'Fringe', S.ell((0, 0.49, 0.2), (0.16, 0.07, 0.1)), 600, 0.15, (0.25, 0.6, 0.9), '#a64c18', '#f6a444', gravity=0.7, clumps=8, lift=0.8, seed=9, mirror=False)
    whiskers(C, (0.1, -0.01, 0.36), 3, 0.2, spread=0.13)
    feathers = []
    for sx in (1, -1):
        root = np.array([sx * 0.36, -0.46, -0.36])
        for row, (n, L, dz, hw) in enumerate(((10, 0.62, 0.0, 0.062), (8, 0.42, 0.025, 0.055), (7, 0.26, 0.05, 0.05))):
            for j in range(n):
                a = 0.02 + j * (1.2 / (n - 1))
                Lj = L * (0.72 + 0.28 * math.sin(a * 1.5 + 0.35))
                d = np.array([sx * math.cos(a), math.sin(a), 0.0])
                c = root + d * Lj * 0.55 + np.array([0, 0, dz])
                feathers.append(S.ell(c, (Lj * 0.5, hw, 0.016), rot=(0, 0, math.atan2(d[1], d[0]))))
    K.build('MarcoWings', S.union(*feathers, k=0.004), (-1.05, -0.75, -0.5), (1.05, 0.4, -0.2), [K.principled('MarcoFeather', '#fbf1dc', rough=0.5, sheen=0.7, sss=0.3, bump=0.12, bump_scale=300)], step=0.004)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 74


build = lion
