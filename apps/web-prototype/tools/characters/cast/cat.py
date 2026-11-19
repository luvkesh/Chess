"""cat: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from cast._groupb import *


def cat():
    """Miu: the elegant black cat of the Nile. A heart-shaped face under tall ears, cool half-lidded
    golden-green eyes winged with gold liner, a tiny mouth, and a slim collar of gold and lapis."""
    C = Char('Miu', '#17151f', '#272536', '#5c5a84', length=0.03, align=(0, -0.6, 0.0), clump=0.14, var=0.1)
    head = S.union(S.ell((0, 0.22, 0), (0.4, 0.34, 0.35)),
                   S.ell((0.24, 0.06, 0.1), (0.17, 0.13, 0.17)).mirror(),
                   S.ell((0, -0.05, 0.16), (0.14, 0.11, 0.15)),
                   S.ell((0, 0.03, 0.29), (0.1, 0.07, 0.08)), k=0.1)
    C.add(head)
    cuts = []
    for sx in (1, -1):
        e, cut = ear((sx * 0.2, 0.44, -0.03), (sx * 0.41, 0.88, -0.07), 0.165, 0.018, thick=0.045, cup=0.68)
        C.add(e, 0.05).sub(cut, 0.02)
        cuts.append(cut)
    body = chubby(0.42, 0.34)
    C.add(body, 0.1)
    nose, nose_c = small_nose(C.shape, 0.065, 0.03, 0.022, 0.024)
    C.add(nose, 0.006)
    mouth = w_mouth(C.shape, (0, 0.012, 0), 0.045, 0.012, 0.006, philtrum=0.022, r=0.0065)
    C.sub(mouth, 0.005)
    eye_set(C, 0.19, 0.17, 0.125, out=0.4, open_=0.44, tilt=0.3, lash=0.2, flick=1.0)
    C.region(S.union(*cuts).grow(0.01), '#6a4a6e', 0.02)
    C.region(S.ell(nose_c, (0.034, 0.026, 0.03)), K.glossy('MiuNose', '#b07888', 0.25), 0.006)
    C.region(mouth.grow(0.003), '#5a4658', 0.004)
    clear(C, S.union(mouth.grow(0.008), S.ell(nose_c, (0.045, 0.036, 0.04))))
    C.region(S.ell((0, -0.46, 0.26), (0.24, 0.3, 0.2)), '#17151f', 0.06, hair='#2c2a3e', tip='#6c6a98', length=0.055, align=(0, -0.8, 0.3), clump=0.4)
    C.build()
    eyes_after(C, look=(0.04, 0.0, 1), glance=-0.16, iris='#a8d030', glow='#f4ff9a', deep='#3a6a1c', oval=1.9, pupil_r=0.42,
               hl=(-0.3, 0.16), hl_size=0.18, hl2=(0.32, -0.3), lash_mat=K.gold('MiuLiner', '#f0c060', 0.25))
    whiskers(C, (0.09, 0.03, 0.33), 3, 0.26, spread=0.14)
    # a slim collar: gold, lapis, gold, with a turquoise drop
    for j, (col, y0, y1) in enumerate((('gold', -0.2, -0.235), ('#2444b8', -0.235, -0.29), ('gold', -0.29, -0.325))):
        band = body.grow(0.022 + (0.004 if col != 'gold' else 0.0)).inter(S.plane((0, 1, 0), y0)).inter(S.plane((0, -1, 0), -y1), 0.008)
        mat = K.gold('MiuGold%d' % j) if col == 'gold' else K.enamel('MiuLapis', col)
        K.build('MiuCollar%d' % j, band, (-0.55, -0.4, -0.5), (0.55, -0.15, 0.5), [mat], step=0.004)
    dz = S.surf_z(body.grow(0.03), 0, -0.36)
    K.build('MiuDrop', S.ell((0, -0.365, dz), (0.034, 0.044, 0.02)), (-0.1, -0.46, dz - 0.1), (0.1, -0.29, dz + 0.1), [K.enamel('MiuTurq', '#22b8b0')], step=0.002)
    K.build('MiuDropRim', S.torus((0, -0.365, dz - 0.004), 0.04, 0.008, rot=(math.pi / 2, 0, 0)), (-0.1, -0.46, dz - 0.1), (0.1, -0.29, dz + 0.1), [bpy_mat('MiuGold0')], step=0.002)
    K.build('MiuHoop', S.torus((0.37, 0.6, 0.0), 0.04, 0.008, rot=(0, 0, 1.3)), (0.25, 0.5, -0.1), (0.5, 0.7, 0.1), [bpy_mat('MiuGold0')], step=0.002)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 74


build = cat
