"""beaver: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def beaver():
    """Bramble: a beaver builder: a yellow hard hat, big buck teeth, denim overalls with brass buttons."""
    C = Char('Bramble', '#5a3018', '#8c5430', '#b8794a', length=0.026, align=(0, -0.6, -0.1), clump=0.14)
    head, mu = critter_head((0, 0.2, 0), (0.34, 0.34, 0.31), 0.25, (0.21, 0.12, 0.11), 0.0, 0.29, taper=0.38, cheek_y=0.6)
    C.add(head)
    C.add(S.ell((0.33, 0.38, -0.04), (0.075, 0.07, 0.05)).mirror(), 0.03)
    body = torso(-0.5, 0.8, 0.34)
    C.add(body, 0.18)
    nose_c, mc, cav = face_basics(C, 0.1, -0.03, (0.07, 0.04, 0.046), 0.11, 0.05, 0.08, 0.9, '#2a160c', closed=True, rise=0.035)
    C.eye(0.16, 0.3, 0.07, 0.66, '#24160e', look=(0.04, 0.0, 1), sclera=BEAD, open_=0.45, low=0.45, iris_r=0.7, pupil_r=0.4)
    C.region(S.ell((0, 0.02, 0.27), (0.22, 0.15, 0.15)), '#c8a07a', 0.04, hair='#d8b48c', tip='#ecd2b0', length=0.018)
    C.region(S.ell((0.33, 0.38, 0.0), (0.04, 0.04, 0.05)).mirror(), '#3a1e0e', 0.01)
    face_regions(C)
    over = garment(body, -0.46, 0.035).inter(S.plane((0, 0, -1), 0.05)).add(garment(body, -0.78, 0.035), 0.01)
    C.region(over.grow(0.02), '#222222', 0.01)
    C.build()
    mouth_after(C, top_teeth=False)
    teeth = S.union(*[S.box((sx * 0.027, mc[1] - 0.05, mc[2] + 0.006), (0.025, 0.045, 0.012), 0.01, rot=(0.3, 0, 0)) for sx in (1, -1)])
    K.build('BrambleTeeth', teeth, (-0.12, -0.15, 0.2), (0.12, 0.08, 0.5), [K.glossy('BrambleTooth', '#fbf2dc', 0.14)], step=0.0025)
    K.build('BrambleOveralls', over, (-0.8, -1.3, -0.6), (0.8, -0.3, 0.6), [K.principled('Denim', '#2f4f7a', rough=0.8, sheen=0.3, bump=0.25, bump_scale=900)], step=0.006)
    straps = S.union(*[S.tube([(sx * 0.2, -0.42, 0.22), (sx * 0.24, -0.3, 0.12), (sx * 0.27, -0.2, -0.05)], 0.035, 0.035) for sx in (1, -1)])
    K.build('BrambleStraps', straps.inter(C.shape.grow(0.03)).sub(C.shape), (-0.5, -0.6, -0.3), (0.5, -0.1, 0.5), [K.principled('Denim2', '#2a4670', rough=0.8, bump=0.2, bump_scale=900)], step=0.004)
    btn = S.union(*[S.cyl((sx * 0.2, -0.44, S.surf_z(over, sx * 0.2, -0.44) - 0.005), 0.03, 0.008, rot=(1.4, 0, 0), round_=0.004) for sx in (1, -1)])
    K.build('BrambleButtons', btn, (-0.4, -0.6, 0.0), (0.4, -0.3, 0.6), [K.gold('Brass', '#d8a850', 0.3)], step=0.002)
    hat = S.union(S.ell((0, 0.43, -0.02), (0.36, 0.25, 0.36)).inter(S.plane((0, -1, 0), -0.4)),
                  S.cyl((0, 0.4, 0.0), 0.41, 0.012, round_=0.01).add(S.ell((0, 0.4, 0.1), (0.42, 0.012, 0.42)), 0.01), k=0.02)
    ridge = S.ell((0, 0.6, -0.02), (0.05, 0.1, 0.3))
    hat = hat.add(ridge.inter(S.ell((0, 0.43, -0.02), (0.38, 0.27, 0.38))), 0.02).rot(-0.12, 0, 0.1, about=(0, 0.4, 0))
    K.build('BrambleHat', hat, (-0.6, 0.3, -0.6), (0.6, 0.85, 0.7), [K.principled('HardHat', '#f2b81c', rough=0.22, coat=0.8, bump=0.03, bump_scale=200)], step=0.004)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


build = beaver
