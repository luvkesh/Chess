"""horse: Rooky, the coach (v3 look, see ../STYLE.md)."""
from common import *


def horse():
    """Rooky: a warm chestnut foal of a coach. A big soft head with a short velvety muzzle, a white
    blaze, a tumbling golden forelock and mane, bright brown eyes, a happy little open smile and
    his ruby knitted scarf."""
    C = Char('Rooky', '#9a4a1c', '#b9612a', '#e6a05c', length=0.024, align=(0, -0.6, -0.05), clump=0.12, var=0.1)
    cran = S.ell((0, 0.36, -0.05), (0.37, 0.32, 0.33))
    face = S.cone((0, 0.24, 0.08), (0, 0.02, 0.24), 0.27, 0.22)
    snout = S.ell((0, -0.07, 0.3), (0.23, 0.165, 0.17))
    cheeks = S.ell((0.23, 0.14, 0.03), (0.18, 0.19, 0.19)).mirror()
    C.add(S.union(cran, face, snout, cheeks, k=0.13))
    er_ = S.cone((0.17, 0.58, -0.08), (0.28, 0.9, -0.1), 0.095, 0.018).add(S.ell((0.2, 0.67, -0.08), (0.08, 0.11, 0.05), rot=(0, 0, -0.3)), 0.05)
    ear_in = S.ell((0.215, 0.72, -0.025), (0.045, 0.13, 0.04), rot=(0.15, 0, -0.3))
    C.add(er_.mirror(), 0.05).sub(ear_in.mirror(), 0.02)
    neck = S.cone((0, 0.05, -0.16), (0, -0.7, -0.22), 0.25, 0.34)
    body = S.ell((0, -0.98, -0.16), (0.52, 0.4, 0.36))
    C.add(neck, 0.14).add(body, 0.15)
    nz = S.surf_z(C.shape, 0.085, -0.05)
    nos = S.ell((0.085, -0.05, nz), (0.02, 0.032, 0.03), rot=(0.5, 0.35, 0.45)).mirror()
    C.sub(nos, 0.015)
    mc = (0, -0.15, S.surf_z(C.shape, 0, -0.15) - 0.035)
    cav, corners = smile(mc, 0.115, 0.06, 0.08, 0.9)
    C.sub(cav, 0.014).sub(corners, 0.008)
    ec = C.eye(0.2, 0.3, 0.115, 0.46, '#6a3412', look=(0.04, 0.03, 1), open_=0.88, tilt=-0.08, low=0.72, iris_r=0.93, pupil_r=0.5,
               lid_t=0.011, glint=1.0)
    lash(C, ec, 0.115, '#3a1a0c')
    C.region(S.ell((0, -0.08, 0.31), (0.245, 0.175, 0.18)), '#e6c0a4', 0.04, hair='#ecccb2', tip='#f8e4d2', length=0.007)
    C.region(S.tube([(0, 0.6, 0.2), (0, 0.42, 0.28), (0, 0.16, 0.33), (0, 0.0, 0.4)], 0.05, 0.085), '#f1e6d8', 0.025, hair='#faf2e8', tip='#ffffff', length=0.02)
    C.region(nos.grow(0.01), K.glossy('RookyNostril', '#4a221a', 0.3), 0.008)
    C.region(ear_in.grow(0.012).mirror(), '#e6c0a4', 0.01)
    C.region(cav.grow(0.005), '#a8384a', 0.006)
    C.build()
    mouth_parts('Rooky', mc, 0.115, 0.06, 0.08, top_teeth=False, curve=0.9)
    mane_m = K.hair_mat('RookyMane', '#c9861e', '#f4c45a', rough=0.2, var=0.12)
    mane_line = [(0.02, 0.7, -0.02), (0.06, 0.64, -0.16), (0.12, 0.42, -0.26), (0.16, 0.0, -0.3), (0.2, -0.6, -0.36)]
    P, N = K.sample_surface(C.o, C.weight(S.tube(mane_line, 0.14, 0.18)), 5200, seed=2)
    K.strands('RookyManeL', K.groom(P, N, 0.42, (1.0, 0.1, 0.9), gravity=1.3, lift=0.9, clumps=60, clump=0.8, jitter=0.2, seed=2), mane_m, 0.006, 0.001, normals=N)
    P, N = K.sample_surface(C.o, C.weight(S.ell((0, 0.66, 0.06), (0.14, 0.07, 0.13))), 1100, seed=3)
    K.strands('RookyForelock', K.groom(P, N, 0.3, (0.4, -0.5, 0.8), gravity=0.8, lift=0.8, clumps=14, clump=0.85, jitter=0.14, seed=3), mane_m, 0.006, 0.001, normals=N)
    band = S.torus((0, -0.46, -0.19), 0.33, 0.085, rot=(0.25, 0, 0)).bump(0.012, 14, 3)
    kc = (0.12, -0.56, 0.14)
    knot = S.ell(kc, (0.095, 0.08, 0.07))
    t1 = S.tube([(kc[0], kc[1] - 0.02, kc[2] + 0.02), (kc[0] + 0.05, kc[1] - 0.18, kc[2] + 0.07), (kc[0] + 0.02, kc[1] - 0.34, kc[2] + 0.1)], 0.06, 0.045, k=0.01)
    t2 = S.tube([(kc[0] - 0.02, kc[1] - 0.02, kc[2] + 0.02), (kc[0] - 0.1, kc[1] - 0.16, kc[2] + 0.09), (kc[0] - 0.13, kc[1] - 0.32, kc[2] + 0.1)], 0.055, 0.04, k=0.01)
    sc = K.build('RookyScarf', S.union(band, knot, t1, t2, k=0.03), (-0.5, -1.05, -0.6), (0.5, -0.3, 0.4), [K.knit('RookyRuby', '#8a0a22')], step=0.006)
    K.fuzz(sc, '#5e0614', 0.003, 16000)
    return (0.55, 0.2, 3.9), (0, 0.16, 0), 76


build = horse
