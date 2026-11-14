"""horse: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def horse():
    """Rooky: a cheerful chestnut horse, white blaze, golden mane and forelock, big grin, ruby scarf."""
    coat, blaze, mane, muzzle = '#b25a24', '#f7efe4', '#b8701a', '#d9b49a'
    mats = [K.skin('HorseSkin', '#7a3a18', 0.5, 0.15), K.skin('MuzzleSkin', muzzle, 0.42, 0.35),
            K.skin('BlazeSkin', '#efe2d2', 0.5, 0.2), K.glossy('Nostril', '#3a1a12', 0.3),
            K.skin('Gum', '#a8384a', 0.35, 0.4), K.skin('ManeSkin', '#b07a22', 0.6, 0.1), K.skin('LidSkin', '#7a3a18', 0.5, 0.15)]
    cran = S.ell((0, 0.3, -0.04), (0.35, 0.32, 0.32))
    face = S.cone((0, 0.18, 0.1), (0, -0.14, 0.27), 0.235, 0.23)
    snout = S.ell((0, -0.29, 0.3), (0.285, 0.2, 0.225))
    cheeks = S.ell((0.19, 0.0, 0.08), (0.16, 0.18, 0.18)).mirror()
    jaw = S.ell((0, -0.2, 0.1), (0.25, 0.2, 0.2))
    head = S.union(cran, face, snout, cheeks, jaw, k=0.13)
    ear = S.cone((0.18, 0.52, -0.08), (0.29, 0.8, -0.1), 0.095, 0.016).add(S.ell((0.21, 0.61, -0.08), (0.08, 0.11, 0.05), rot=(0, 0, -0.3)), 0.05)
    ear_in = S.ell((0.225, 0.65, -0.02), (0.048, 0.13, 0.04), rot=(0.15, 0, -0.3))
    head = head.add(ear.mirror(), k=0.05).sub(ear_in.mirror(), k=0.02)
    er = 0.108
    ec = place_eye(head, 0.18, 0.22, er, 0.62)
    head = head.sub(S.sphere(ec, er + 0.004).mirror(), k=0.015).add(lids(ec, er, 0.86, -0.22, 0.014, 0.62).mirror(), k=0.012)
    nz = S.surf_z(head, 0.1, -0.24)
    nos = S.ell((0.1, -0.24, nz), (0.03, 0.05, 0.04), rot=(0.5, 0.35, 0.45)).mirror()
    head = head.sub(nos, k=0.02)
    mc = (0, -0.37, S.surf_z(head, 0, -0.37) - 0.05)
    cav, corners = smile(mc, 0.2, 0.12, 0.13, 0.8)
    head = head.sub(cav, k=0.02).sub(corners, k=0.015)
    body = bust((0, -0.25, -0.12), (0, -1.05, -0.12), 0.72, (0.3, 0.44))
    shape = head.add(body, k=0.2).bump(0.003, 9, 1)
    o = K.build('Rooky', shape, LO, HI, mats, step=0.0065)
    mane_line = [(0, 0.66, 0.04), (0, 0.64, -0.14), (0, 0.46, -0.3), (0.04, 0.1, -0.38), (0.08, -0.45, -0.48)]
    eyering = S.sphere(ec, er * 1.55).mirror()
    W = K.paint(o, [
        (S.ell((0, -0.29, 0.31), (0.3, 0.205, 0.235)), 1, 0.04),
        (S.tube([(0, 0.55, 0.22), (0, 0.36, 0.3), (0, 0.08, 0.36), (0, -0.14, 0.44)], 0.055, 0.09), 2, 0.025),
        (nos.grow(0.012), 3, 0.01),
        (cav.grow(0.006), 4, 0.008),
        (S.tube(mane_line, 0.12, 0.16), 5, 0.02),
        (ear_in.grow(0.012).mirror(), 1, 0.01),
        (eyering, 6, 0.03),
    ])
    hair_groups(o, W, {0: 'coat', 2: 'blaze', 1: 'muzzle', 6: 'lids'})
    o.data.materials.append(K.hair_mat('CoatHair', coat, '#d7884a'))
    o.data.materials.append(K.hair_mat('BlazeHair', blaze, '#ffffff', var=0.06))
    o.data.materials.append(K.hair_mat('MuzzleHair', '#e2c2a8', '#f4dccb', var=0.06))
    mane_m = K.hair_mat('ManeHair', mane, '#e6a83e', rough=0.2, var=0.12)
    K.fur(o, 'coat', 'CoatHair', length=0.02, count=50000, children=7, align=(0, -0.6, -0.2), clump=0.08, root=0.0016)
    K.fur(o, 'blaze', 'BlazeHair', length=0.017, count=8000, children=7, align=(0, -0.6, 0), clump=0.08, root=0.0016)
    K.fur(o, 'muzzle', 'MuzzleHair', length=0.006, count=9000, children=4, align=(0, -0.3, 0), clump=0.0, root=0.0012)
    K.fur(o, 'lids', 'CoatHair', length=0.007, count=6000, children=4, align=(0, -0.2, 0), clump=0.0, root=0.0012)
    # the golden mane falls to his right in locks; the forelock flops forward over the blaze
    P, N = K.sample_surface(o, W[:, 5], 4000, seed=2)
    K.strands('Mane', K.groom(P, N, 0.36, (1.0, 0.2, 0.7), gravity=1.4, lift=0.9, clumps=60, clump=0.8, jitter=0.2, seed=2), mane_m, 0.006, 0.001, normals=N)
    fl = S.ell((0, 0.62, 0.08), (0.13, 0.06, 0.12))
    P, N = K.sample_surface(o, np.clip(0.5 - fl(np.array([v.co[:] for v in o.data.vertices])) / 0.02, 0, 1), 900, seed=3)
    K.strands('Forelock', K.groom(P, N, 0.34, (0.35, -0.6, 0.8), gravity=0.7, lift=0.7, clumps=12, clump=0.85, jitter=0.12, seed=3), mane_m, 0.006, 0.001, normals=N)
    for s in (1, -1):
        K.eye('Eye%d' % s, (ec[0] * s, ec[1], ec[2]), er, look=(0.06 * s + 0.12, 0.0, 1), iris='#6a3412', iris_r=0.8, pupil_r=0.36)
    mouth_parts('Rooky', mc, 0.2, 0.12, 0.13, curve=0.8)
    band = S.torus((0, -0.66, -0.08), 0.36, 0.085, rot=(0.25, 0, 0)).bump(0.012, 14, 3)
    knot = S.ell((0.13, -0.74, 0.28), (0.1, 0.085, 0.07))
    tail1 = S.tube([(0.13, -0.76, 0.3), (0.17, -0.9, 0.34), (0.14, -1.05, 0.38)], 0.06, 0.045, k=0.01)
    tail2 = S.tube([(0.11, -0.76, 0.3), (0.03, -0.9, 0.38), (-0.01, -1.06, 0.39)], 0.055, 0.04, k=0.01)
    scarf = S.union(band, knot, tail1, tail2, k=0.03)
    sc = K.build('Scarf', scarf, (-0.5, -1.15, -0.5), (0.5, -0.45, 0.5), [K.knit('Ruby', '#8e0c26')], step=0.006)
    K.fuzz(sc, '#6e0818', 0.004, 25000)
    K.build('Pin', S.torus((0.13, -0.73, 0.355), 0.032, 0.01, rot=(1.45, 0, 0)), (0, -0.85, 0.25), (0.25, -0.6, 0.42), [K.gold()], step=0.003)
    K.build('Jewel', S.ell((0.13, -0.73, 0.358), (0.024, 0.024, 0.018)), (0, -0.85, 0.25), (0.25, -0.6, 0.42), [K.gem('RubyGem', '#d0103a')], step=0.003)
    return (0.6, 0.12, 3.9), (0, -0.05, 0), 80


build = horse
