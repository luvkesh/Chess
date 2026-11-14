"""owl: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def owl():
    """Sophie: the owl of Athens: a pale facial disc, great amber eyes, ear tufts and a laurel wreath."""
    C = Char('Sophie', '#5a3a1e', '#8a6038', '#c89a62', length=0.03, align=(0, -0.7, -0.2), clump=0.45, var=0.2)
    body = bird(C, (0, 0.18, 0), (0.43, 0.33, 0.27), 0.72, 0.4)
    C.eye(0.17, 0.22, 0.125, 0.56, '#e8a020', look=(0.06, 0.0, 1), iris_r=0.8, pupil_r=0.36)
    disc = S.union(*[S.ell((sx * 0.17, 0.2, 0.22), (0.19, 0.18, 0.13)) for sx in (1, -1)], k=0.05)
    C.region(disc.grow(0.03), '#4a2a14', 0.02, hair='#5a3418', tip='#7a4a26', length=0.024, clump=0.3)
    C.region(disc, '#e8d4b0', 0.04, hair='#f2e2c4', tip='#fff4e0', length=0.022, align=(0, 0, 0.5), clump=0.3)
    C.region(S.ell((0, -0.75, 0.2), (0.4, 0.35, 0.2)), '#e8d4b0', 0.05, hair='#ead6b2', tip='#fbf0dc', length=0.03, clump=0.5)
    # folded wings at her sides, darker, with barred flight feathers
    wings = S.union(*[squash(S.ell((sx * 0.5, -0.72, -0.02), (0.2, 0.42, 0.24), rot=(0.15, 0, sx * -0.25)), (sx * 0.5, -0.72, -0.02), 1, 1, 0.8) for sx in (1, -1)])
    C.add(wings, 0.05)
    C.region(wings.grow(0.02), '#3a2412', 0.03, hair='#5a3a1c', tip='#c8a070', length=0.04, clump=0.7)
    bc = (0, 0.15, S.surf_z(C.shape, 0, 0.15) - 0.03)
    up, lo = beak(bc, 0.17, 0.06, 0.06, 0.05, 0.05)
    C.build()
    K.build('SophieBeak', up.add(lo, 0.008), (-0.15, 0.0, 0.1), (0.15, 0.3, 0.6), [K.glossy('SophieHorn', '#c8a060', 0.3)], step=0.0025)
    for sx in (1, -1):
        P = np.array([[sx * (0.24 + 0.05 * t), 0.44 + 0.02 * t, 0.02 + 0.03 * np.sin(a)] for t, a in zip(np.random.default_rng(1).random(80), np.linspace(0, 12, 80))])
        N = np.tile([[sx * 0.5, 1.0, 0.0]], (80, 1)); N /= np.linalg.norm(N, axis=1)[:, None]
        K.strands('SophieTuft%d' % sx, K.groom(P, N, 0.14, (sx * 0.4, 0.6, -0.1), gravity=-0.1, clumps=4, clump=0.85, jitter=0.15, seed=sx + 3), bpy_mat('SophieHair0'), 0.005, 0.0008)
    ring = [(0.36 * math.sin(a), 0.44 - 0.03 * math.cos(a), 0.31 * math.cos(a) - 0.02) for a in np.linspace(-2.3, 2.3, 13)]
    K.build('SophieLaurel', leaves(ring, 30, 0.055, 0.7, 2), (-0.5, 0.25, -0.5), (0.5, 0.7, 0.5), [K.principled('SophieLeaf', '#5a8a30', rough=0.35, sss=0.2, coat=0.3)], step=0.003)
    K.build('SophieTwig', S.tube(ring, 0.01, 0.01), (-0.5, 0.25, -0.5), (0.5, 0.7, 0.5), [K.gold('SophieGold')], step=0.003)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


build = owl
