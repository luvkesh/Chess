"""bear: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def bear():
    """Mishka: a Russian bear in a tall fur hat with a green velvet crown, a frogged green coat
    with gold braid and a little jewelled egg."""
    C = Char('Mishka', '#3a2010', '#6e4222', '#a06a3a', length=0.032, align=(0, -0.5, -0.1), clump=0.16)
    head, mu = critter_head((0, 0.2, 0), (0.44, 0.31, 0.34), 0.17, (0.18, 0.12, 0.17), 0.0, 0.34, taper=-0.12)
    C.add(head)
    C.add(S.ell((0.3, 0.44, -0.04), (0.1, 0.09, 0.06)).mirror(), 0.04)
    body = torso(-0.5, 0.86, 0.38)
    C.add(body, 0.18)
    face_basics(C, 0.1, -0.05, (0.075, 0.048, 0.05), 0.14, 0.08, 0.1, 1.0, '#1a0e08')
    C.eye(0.13, 0.27, 0.076, 0.66, '#3a2412', look=(0.04, 0.02, 1), sclera=BEAD, open_=0.75, low=0.5, iris_r=0.74, pupil_r=0.4)
    C.region(S.ell((0, 0.03, 0.27), (0.21, 0.15, 0.14)), '#b88a5a', 0.04, hair='#c89a68', tip='#e0b888', length=0.02)
    face_regions(C)
    coat = garment(body, -0.36, 0.045)
    C.region(coat.grow(0.02), '#222222', 0.01)
    C.build()
    brows(C, '#5a3a20', '#8a6040', length=0.06, angle=-0.2, lift=0.35, comb=(1.0, 0.2, 0.5), gravity=0.2, n=200, thick=0.026)
    mouth_after(C)
    K.build('MishkaCoat', coat, (-0.85, -1.3, -0.7), (0.85, -0.25, 0.6), [K.velvet('MishkaGreen', '#0e5a3a')], step=0.006)
    braids = []
    for y in (-0.5, -0.62, -0.74, -0.86):
        z = S.surf_z(coat, 0.0, y)
        braids.append(S.tube([(-0.2, y, S.surf_z(coat, -0.2, y) - 0.004), (0, y + 0.01, z - 0.002), (0.2, y, S.surf_z(coat, 0.2, y) - 0.004)], 0.012, 0.012))
        for sx in (1, -1):
            braids.append(S.torus((sx * 0.22, y, S.surf_z(coat, sx * 0.22, y) - 0.004), 0.025, 0.008, rot=(1.45, 0, 0)))
    K.build('MishkaBraid', S.union(*braids), (-0.4, -1.0, 0.0), (0.4, -0.4, 0.7), [K.gold('MishkaGold')], step=0.0025)
    # tall fur hat (papakha) with a velvet top and a gold cross braid
    hat = S.cyl((0, 0.52, -0.03), 0.34, 0.15, round_=0.08).rot(-0.12, 0, 0, about=(0, 0.45, 0))
    hat_o = K.build('MishkaHat', hat, (-0.6, 0.25, -0.6), (0.6, 0.85, 0.6), [K.skin('MishkaHatSkin', '#2a1a10')], step=0.005)
    hat_o.data.materials.append(K.hair_mat('MishkaHatFur', '#4a3020', '#8a6a50', var=0.25))
    K.vgroup(hat_o, 'fur', np.ones(len(hat_o.data.vertices)))
    K.fur(hat_o, 'fur', 'MishkaHatFur', length=0.05, count=26000, children=7, align=(0, -0.2, 0), clump=0.5, root=0.003, rough=0.006, seed=7)
    top = S.ell((0, 0.68, -0.05), (0.26, 0.07, 0.26)).rot(-0.12, 0, 0, about=(0, 0.45, 0))
    K.build('MishkaCrown', top, (-0.5, 0.55, -0.5), (0.5, 0.85, 0.5), [K.velvet('MishkaCrownVelvet', '#1a6a44')], step=0.004)
    cross = S.union(S.tube([(-0.25, 0.7, -0.05), (0, 0.76, -0.05), (0.25, 0.7, -0.05)], 0.012, 0.012), S.tube([(0, 0.7, -0.3), (0, 0.76, -0.05), (0, 0.7, 0.2)], 0.012, 0.012)).rot(-0.12, 0, 0, about=(0, 0.45, 0))
    K.build('MishkaCross', cross, (-0.5, 0.55, -0.5), (0.5, 0.9, 0.5), [bpy_mat('MishkaGold')], step=0.003)
    ec = (-0.22, -0.56, S.surf_z(coat, -0.22, -0.56) + 0.01)
    egg = S.ell(ec, (0.05, 0.065, 0.045))
    K.build('MishkaEgg', egg, (-0.4, -0.7, ec[2] - 0.1), (-0.1, -0.4, ec[2] + 0.1), [K.enamel('MishkaEnamel', '#2a5ac8')], step=0.002)
    lattice = S.union(*[S.ell(ec, (0.053, 0.068, 0.048)).shell(0.003).inter(S.plane((0, 1, 0), ec[1] + d).inter(S.plane((0, -1, 0), -(ec[1] + d) + 0.008))) for d in (-0.03, 0.0, 0.03)])
    K.build('MishkaLattice', lattice, (-0.4, -0.7, ec[2] - 0.1), (-0.1, -0.4, ec[2] + 0.1), [bpy_mat('MishkaGold')], step=0.0015)
    return (0.55, 0.15, 3.9), (0, 0.04, 0), 74


build = bear
