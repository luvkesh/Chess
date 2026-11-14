"""panda: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def panda():
    """Bao: a panda in a red silk jacket with a gold mandarin collar and frog buttons, a sprig of bamboo."""
    C = Char('Bao', '#e6e2dc', '#f6f3ee', '#ffffff', length=0.03, align=(0, -0.4, 0), clump=0.12, var=0.06)
    head, mu = critter_head((0, 0.2, 0), (0.42, 0.34, 0.34), 0.21, (0.13, 0.09, 0.1), 0.02, 0.29, taper=0.05)
    C.add(head)
    ears = S.ell((0.28, 0.5, -0.05), (0.11, 0.1, 0.06)).mirror()
    C.add(ears, 0.05)
    body = torso(-0.5, 0.66, 0.3)
    C.add(body, 0.18)
    nose_c = (0, 0.08, S.surf_z(C.shape, 0, 0.08) - 0.02)
    C.add(button_nose(nose_c, 0.055, 0.036, 0.04), 0.01)
    mc = (0, -0.05, S.surf_z(C.shape, 0, -0.05) - 0.035)
    cav, corners = smile(mc, 0.1, 0.06, 0.08, 0.9)
    C.sub(cav, 0.012).sub(corners, 0.01)
    C.eye(0.15, 0.24, 0.075, 0.66, '#2a1810', look=(0.04, 0.04, 1), sclera=BEAD, iris_r=0.7, pupil_r=0.4)
    C.region(S.ell((0.16, 0.21, 0.22), (0.12, 0.15, 0.16), rot=(0, 0, 0.55)).mirror(), '#16161a', 0.03, hair='#1c1c22', tip='#34343c', length=0.024)
    C.region(ears.grow(0.03), '#16161a', 0.02, hair='#1c1c22', tip='#34343c', length=0.03)
    C.region(S.ell((0, -0.75, 0), (0.9, 0.35, 0.6)), '#16161a', 0.06, hair='#1c1c22', tip='#34343c', length=0.03)
    C.region(S.ell(nose_c, (0.062, 0.044, 0.05)), K.glossy('BaoNose', '#141414', 0.22), 0.008)
    C.region(cav.grow(0.006), '#8a2e3a', 0.006)
    jacket = garment(body, -0.36, 0.04)
    C.region(jacket.grow(0.02), '#222222', 0.01)
    C.build()
    mouth_parts('Bao', mc, 0.1, 0.06, 0.08, curve=0.9)
    K.build('BaoJacket', jacket, (-0.8, -1.3, -0.6), (0.8, -0.4, 0.6), [K.principled('BaoSilk', '#b8141c', rough=0.3, sheen=0.3, aniso=0.5, bump=0.04, bump_scale=300)], step=0.006)
    collar = S.cyl((0, -0.33, -0.05), 0.345, 0.05, rot=(0.2, 0, 0)).shell(0.014).add(S.torus((0, -0.28, -0.04), 0.345, 0.016, rot=(0.2, 0, 0)), 0.006)
    K.build('BaoCollar', collar, (-0.6, -0.7, -0.6), (0.6, -0.3, 0.6), [K.gold('BaoGold')], step=0.004)
    fz = lambda y: S.surf_z(jacket, 0.0, y)
    frogs = S.union(*[S.torus((sx * 0.06, y, fz(y) - 0.004), 0.03, 0.009, rot=(1.5, 0, 0)) for sx in (1, -1) for y in (-0.5, -0.64, -0.78)] +
                    [S.sphere((0, y, fz(y) + 0.004), 0.016) for y in (-0.5, -0.64, -0.78)])
    K.build('BaoFrogs', frogs, (-0.2, -0.9, 0.2), (0.2, -0.4, 0.7), [K.gold('BaoFrogGold', '#e8c070')], step=0.0025)
    stem = S.tube([(-0.36, 0.25, -0.05), (-0.4, 0.5, -0.02), (-0.45, 0.78, 0.0)], 0.022, 0.017)
    nodes = S.union(*[S.cyl((-0.36 - t * 0.09, 0.25 + t * 0.53, -0.05 + t * 0.05), 0.026, 0.006, rot=(0, 0, 0.17)) for t in (0.3, 0.65)])
    leaf = S.union(S.ell((-0.52, 0.72, 0.03), (0.1, 0.025, 0.012), rot=(0.2, 0, 0.5)), S.ell((-0.38, 0.82, 0.02), (0.09, 0.022, 0.012), rot=(0.2, 0, -0.6)), S.ell((-0.5, 0.56, 0.04), (0.09, 0.022, 0.012), rot=(0.2, 0, 0.2)))
    K.build('BaoBamboo', S.union(stem, nodes, k=0.006), (-0.6, 0.15, -0.2), (-0.2, 0.9, 0.2), [K.principled('BaoStem', '#6aa040', rough=0.3, coat=0.4)], step=0.003)
    K.build('BaoLeaves', leaf, (-0.7, 0.4, -0.2), (-0.2, 0.95, 0.2), [K.principled('BaoLeaf', '#4c8a34', rough=0.35, sss=0.2)], step=0.0025)
    return (0.55, 0.1, 3.9), (0, -0.02, 0), 76


build = panda
