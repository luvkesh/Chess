"""rooster: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def rooster():
    """Gaston: a Parisian rooster: white feathers, a red comb and wattles, a black beret, a blue
    coat with a tricolour rosette, and a sweep of green tail feathers behind."""
    C = Char('Gaston', '#d8d2c8', '#f6f2ea', '#ffffff', length=0.03, align=(0, -0.7, -0.2), clump=0.45, var=0.06)
    body = bird(C, (0, 0.2, 0), (0.3, 0.3, 0.29), 0.64, 0.3)
    C.eye(0.14, 0.26, 0.08, 0.62, '#f07a10', look=(0.15, 0.06, 1), iris_r=0.86, pupil_r=0.24, open_=0.85)
    bc = (0, 0.15, S.surf_z(C.shape, 0, 0.15) - 0.04)
    up, lo = beak(bc, 0.18, 0.06, 0.06, 0.04, 0.0)
    coat = garment(body, -0.36, 0.045, (0.3, 0.14))
    C.region(coat.grow(0.02), '#222222', 0.01)
    comb_c = S.union(*[S.ell((0, 0.5 + 0.06 * math.cos(j - 2), -0.1 + j * 0.07), (0.035, 0.09, 0.05)) for j in range(5)], k=0.03)
    C.region(comb_c.grow(0.04), '#c81e28', 0.03)
    C.build()
    K.build('GastonComb', comb_c.add(S.ell((0, 0.45, 0.0), (0.04, 0.05, 0.2)), 0.03), (-0.2, 0.35, -0.3), (0.2, 0.75, 0.35), [K.skin('GastonRed', '#d01a26', 0.32, 0.5)], step=0.003)
    K.build('GastonWattle', S.ell((0.03, 0.0, bc[2] + 0.02), (0.035, 0.07, 0.04)).mirror().add(S.ell((0, 0.04, bc[2] + 0.0), (0.05, 0.03, 0.03)), 0.02), (-0.15, -0.15, 0.0), (0.15, 0.2, 0.6), [bpy_mat('GastonRed')], step=0.003)
    K.build('GastonBeak', up.add(lo, 0.008), (-0.15, -0.05, 0.0), (0.15, 0.3, 0.6), [K.glossy('GastonHorn', '#f0b030', 0.25)], step=0.0025)
    K.build('GastonCoat', coat, (-0.85, -1.3, -0.7), (0.85, -0.25, 0.6), [K.velvet('GastonBlue', '#1a3a8a')], step=0.006)
    shirt = body.grow(0.02).inter(S.plane((0, 1, 0), -0.36)).inter(S.plane((0, 0, -1), -0.05))
    K.build('GastonShirt', shirt, (-0.4, -1.3, -0.2), (0.4, -0.3, 0.6), [K.principled('GastonLinen', '#f6f2ea', rough=0.6, bump=0.05)], step=0.006)
    rc = (-0.3, -0.5, S.surf_z(coat, -0.3, -0.5))
    for j, (col, r) in enumerate((('#1a3aa0', 0.075), ('#ffffff', 0.052), ('#d0182a', 0.03))):
        K.build('GastonRosette%d' % j, S.cyl((rc[0], rc[1], rc[2] + 0.008 + j * 0.006), r, 0.008, rot=(1.4, 0, 0), round_=0.006).bump(0.004, 120, j),
                (-0.5, -0.7, rc[2] - 0.1), (-0.1, -0.3, rc[2] + 0.1), [K.silk('GastonRib%d' % j, col)], step=0.002)
    beret = S.ell((0.06, 0.5, -0.02), (0.36, 0.09, 0.34)).rot(0, 0, -0.25, about=(0.06, 0.45, 0))
    stalk = S.cone((0.0, 0.58, -0.02), (-0.02, 0.63, -0.02), 0.012, 0.006).rot(0, 0, -0.25, about=(0.06, 0.45, 0))
    b = K.build('GastonBeret', beret.add(stalk, 0.01), (-0.5, 0.3, -0.5), (0.6, 0.8, 0.5), [K.principled('GastonFelt', '#141418', rough=0.9, sheen=0.6)], step=0.004)
    K.fuzz(b, '#202024', 0.004, 12000)
    tails = []
    for j in range(6):
        a = 0.6 + j * 0.28
        base = np.array([0.15, -0.55, -0.4])
        tip = base + np.array([0.75 * math.cos(a) + 0.2, 0.75 * math.sin(a), -0.1])
        mid = (base + tip) / 2 + np.array([0.15, 0.12, 0])
        tails.append(squash(S.tube([base, mid, tip], 0.06, 0.015), tuple(mid), 1, 1, 0.35))
    K.build('GastonTail', S.union(*tails, k=0.02), (-0.4, -0.8, -0.8), (1.0, 0.7, -0.1), [K.principled('GastonPlume', '#0e5a48', rough=0.25, coat=0.5, sheen=0.4)], step=0.005)
    return (0.55, 0.12, 4.0), (0, 0.04, 0), 74


build = rooster
