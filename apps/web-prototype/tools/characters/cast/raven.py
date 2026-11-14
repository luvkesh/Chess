"""raven: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def raven():
    """Onyx: a raven with blue-violet sheen on black feathers, a gold monocle on a chain and a
    violet silk cravat."""
    C = Char('Onyx', '#08080c', '#101218', '#2a3150', length=0.032, align=(0, -0.7, -0.3), clump=0.5, var=0.12)
    body = bird(C, (0, 0.22, -0.02), (0.28, 0.27, 0.32), 0.66, 0.3)
    C.eye(0.15, 0.27, 0.085, 0.62, '#dfe4ee', look=(0.06, 0.0, 1), glance=0.28, sclera=BEAD, iris_r=0.8, pupil_r=0.22, open_=0.6, tilt=0.25)
    bc = (0, 0.14, S.surf_z(C.shape, 0, 0.14) - 0.06)
    up, lo = beak(bc, 0.44, 0.115, 0.1, 0.09, 0.05)
    C.build()
    K.build('OnyxBeak', up.add(lo, 0.01), (-0.2, -0.1, 0.0), (0.2, 0.3, 0.75), [K.glossy('OnyxHorn', '#3a3a46', 0.2)], step=0.003)
    # a swept crest of glossy feathers on the crown
    P, N = K.sample_surface(C.o, C.weight(S.ell((0, 0.5, 0.0), (0.12, 0.08, 0.16))), 500, seed=6)
    P, N = K.sample_surface(C.o, C.weight(S.ell((0, -0.02, 0.18), (0.18, 0.12, 0.14))), 900, seed=9)
    K.strands('OnyxHackles', K.groom(P, N, 0.1, (0, -1.0, 0.3), gravity=0.6, lift=0.5, clumps=26, clump=0.85, jitter=0.2, seed=9), bpy_mat('OnyxHair0'), 0.004, 0.0008, normals=N)
    K.strands('OnyxCrest', K.groom(P, N, 0.14, (0.0, 0.4, -1.0), gravity=-0.3, lift=0.8, clumps=7, clump=0.85, jitter=0.15, seed=6), bpy_mat('OnyxHair0'), 0.006, 0.001, normals=N)
    K.build('OnyxGape', S.tube([(0.07, 0.08, bc[2] + 0.02), (0.1, 0.1, bc[2] - 0.02), (0.125, 0.135, bc[2] - 0.06)], 0.012, 0.008).mirror(), (-0.3, 0.0, 0.0), (0.3, 0.25, 0.5), [K.skin('OnyxGapeSkin', '#5a4a40')], step=0.003)
    e = C.eyes[0]
    mc = (-e[0][0], e[0][1], e[0][2] + e[1] + 0.02)
    K.build('OnyxMonocle', S.torus(mc, 0.11, 0.011, rot=(math.pi / 2, 0, 0)), (-0.35, 0.1, 0.1), (0.05, 0.45, 0.5), [K.gold('OnyxGold')], step=0.0022)
    K.build('OnyxLens', S.cyl(mc, 0.105, 0.003, rot=(math.pi / 2, 0, 0)), (-0.35, 0.1, 0.1), (0.05, 0.45, 0.5), [K.principled('OnyxGlass', '#ffffff', rough=0.0, transmission=1.0, ior=1.3)], step=0.002)
    chain = [(mc[0] - 0.08, mc[1] - 0.08, mc[2] - 0.02), (-0.24, 0.0, 0.3), (-0.26, -0.2, 0.3), (-0.2, -0.38, 0.32)]
    K.build('OnyxChain', S.tube(chain, 0.006, 0.006), (-0.4, -0.5, 0.0), (0.0, 0.3, 0.6), [bpy_mat('OnyxGold')], step=0.002)
    ruffles = [S.ell((0, -0.44 - j * 0.07, 0.27 + j * 0.012), (0.12 - j * 0.012, 0.045, 0.05)).bump(0.01, 40, j) for j in range(5)]
    cravat = S.union(S.torus((0, -0.36, -0.06), 0.3, 0.05, rot=(0.25, 0, 0)), *ruffles, k=0.02)
    K.build('OnyxCravat', cravat, (-0.5, -0.8, -0.5), (0.5, -0.2, 0.6), [K.silk('OnyxViolet', '#5a2a8a')], step=0.004)
    K.build('OnyxPin', S.sphere((0, -0.42, S.surf_z(cravat, 0, -0.42) - 0.005), 0.022), (-0.1, -0.5, 0.1), (0.1, -0.3, 0.5), [K.pearl('OnyxPearl')], step=0.002)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


build = raven
