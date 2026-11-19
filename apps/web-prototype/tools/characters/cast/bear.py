"""bear: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from cast._groupb import *


def bear():
    """Mishka: the big, jolly bear of the north. A wide round honey-brown head, small ears set far
    apart, smiling chocolate eyes, rosy cheeks, a little open laugh, and a small emerald fur hat."""
    C = Char('Mishka', '#8a5426', '#b4743a', '#e8b074', length=0.05, align=(0, -0.6, 0.0), clump=0.24)
    head = S.union(S.ell((0, 0.17, 0), (0.48, 0.37, 0.38)),
                   S.ell((0.3, 0.02, 0.1), (0.2, 0.17, 0.2)).mirror(),
                   S.ell((0, 0.0, 0.3), (0.19, 0.14, 0.14)), k=0.1)
    C.add(head)
    C.add(S.ell((0.37, 0.47, -0.02), (0.125, 0.12, 0.07)).mirror(), 0.04)
    C.sub(S.ell((0.365, 0.46, 0.045), (0.075, 0.07, 0.04)).mirror(), 0.025)
    body = chubby(0.54, 0.4)
    C.add(body, 0.1)
    face_basics(C, 0.075, -0.045, (0.058, 0.04, 0.04), 0.062, 0.05, 0.07, 0.8, '#2a1610')
    eye_set(C, 0.2, 0.19, 0.11, out=0.42, open_=0.8, tilt=-0.06, low=0.62, lash=0.18)
    C.region(S.ell((0, -0.01, 0.32), (0.2, 0.15, 0.15)), '#ecd2a8', 0.05, hair='#f4dfba', tip='#fff4de', length=0.026)
    C.region(S.ell((0.365, 0.46, 0.045), (0.075, 0.07, 0.045)).mirror(), '#5a3018', 0.02, hair='#6a3a1e', length=0.015)
    C.region(S.ell((0, -0.5, 0.3), (0.3, 0.34, 0.2)), '#ecd2a8', 0.07, hair='#f4dfba', tip='#fff4de', length=0.06, align=(0, -0.8, 0.3), clump=0.4)
    blush(C, 0.31, 0.03, '#e8846a', r=0.075, hair='#f09a7c')
    face_regions(C)
    C.build()
    mouth_after(C, top_teeth=False, tongue='#f07a86')
    eyes_after(C, look=(0.03, 0.02, 1), glance=0.1, iris='#8a4c1e', glow='#f0b060', deep='#2a1206', pupil_r=0.4, hl=(-0.28, 0.3), hl_size=0.22)
    tufts(C, 'Cheek', S.ell((0.45, 0.02, 0.02), (0.12, 0.16, 0.2)).mirror(), 1400, 0.08, (1.0, -0.6, 0.1), '#b4743a', '#eebc84', gravity=0.4, clumps=36, lift=0.5, seed=5)
    # a small round hat perched between the ears: cream fur brim, emerald velvet crown, gold button
    piv = (-0.1, 0.5, 0)
    brim = S.torus((-0.1, 0.53, 0.0), 0.2, 0.065).rot(0.08, 0, 0.22, about=piv)
    crown = S.ell((-0.1, 0.61, 0.0), (0.2, 0.15, 0.2)).rot(0.08, 0, 0.22, about=piv)
    hat_o = K.build('MishkaBrim', brim, (-0.5, 0.35, -0.4), (0.3, 0.85, 0.4), [K.skin('MishkaBrimSkin', '#e8dcc8')], step=0.005)
    hat_o.data.materials.append(K.hair_mat('MishkaBrimFur', '#f0e6d4', '#ffffff', var=0.15))
    K.vgroup(hat_o, 'fur', np.ones(len(hat_o.data.vertices)))
    K.fur(hat_o, 'fur', 'MishkaBrimFur', length=0.045, count=14000, children=7, align=(0, -0.1, 0), clump=0.45, root=0.003, rough=0.006, seed=7)
    K.build('MishkaCrown', crown, (-0.5, 0.45, -0.4), (0.3, 0.95, 0.4), [K.velvet('MishkaVelvet', '#0a5a3c')], step=0.004)
    btn = np.array([-0.1, 0.77, 0.0])
    K.build('MishkaButton', S.sphere(btn, 0.03).rot(0.08, 0, 0.22, about=piv), (-0.4, 0.6, -0.2), (0.2, 0.95, 0.2), [K.gold('MishkaGold')], step=0.002)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 74


build = bear
