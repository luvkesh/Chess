"""bunny: Truffle, the newest player and the benchmark for the v3 look (see ../STYLE.md).
build() makes the model in the open Blender scene and returns its framing."""
from common import *


def bunny():
    """Truffle: a small cream bunny, sweet and a little shy. A big soft head with chubby cheeks,
    large dark eyes set low, a tiny pink nose and smile, one ear up and one flopped, and a
    rose silk bow at the foot of the upright ear."""
    C = Char('Truffle', '#ead8cc', '#f3e6da', '#fffaf3', length=0.045, align=(0, -0.55, 0.1), clump=0.22, var=0.07)
    # the head: wide and low, cheeks fuller than the crown (a soft pear), a very short muzzle
    cran = S.ell((0, 0.27, -0.02), (0.37, 0.33, 0.34))
    cheeks = S.ell((0.2, 0.1, 0.08), (0.2, 0.17, 0.21)).mirror()
    muz = S.ell((0, 0.085, 0.3), (0.115, 0.08, 0.085))
    head = S.union(cran, cheeks, muz, k=0.11)
    C.add(head)
    # ears: long and soft; the right one stands, the left one folds over halfway
    up = squash(S.tube([(0.13, 0.52, -0.06), (0.19, 0.8, -0.1), (0.2, 1.06, -0.08)], 0.095, 0.07, k=0.02), (0.18, 0.8, -0.08), 1.0, 1.0, 0.42)
    flop = squash(S.tube([(-0.14, 0.52, -0.06), (-0.25, 0.76, -0.06), (-0.4, 0.8, 0.04), (-0.47, 0.62, 0.14)], 0.095, 0.07, k=0.02), (-0.3, 0.72, 0.0), 1.0, 0.75, 0.55)
    C.add(up, 0.06).add(flop, 0.06)
    inner = squash(S.tube([(0.14, 0.6, 0.0), (0.19, 0.8, -0.03), (0.2, 1.0, -0.02)], 0.055, 0.035), (0.18, 0.8, 0.0), 1, 1, 0.5).move(0, 0, 0.016)
    C.sub(inner, 0.02)
    # a small body: narrow sloping shoulders, a fluffy chest
    body = S.ell((0, -0.78, -0.06), (0.4, 0.58, 0.3))
    tuft = S.ell((0, -0.26, 0.12), (0.17, 0.13, 0.12))
    C.add(body, 0.1).add(tuft, 0.08)
    # nose and the little smile under it
    ny = 0.105
    nose_c = (0, ny, S.surf_z(C.shape, 0, ny) - 0.006)
    C.add(S.ell(nose_c, (0.034, 0.022, 0.022)), 0.006)
    my = 0.035
    smile_f = crease(C.shape, (0, my, 0), 0.06, 0.03, r=0.012, depth=0.1)
    phil = S.tube([(0, ny - 0.02, S.surf_z(C.shape, 0, ny - 0.02) - 0.002), (0, my, S.surf_z(C.shape, 0, my) - 0.002)], 0.009, 0.009)
    C.sub(smile_f, 0.006).sub(phil, 0.004)
    # eyes: large, low and apart, dark and shining
    ec = C.eye(0.19, 0.2, 0.118, 0.44, '#7a4630', look=(0.02, 0.04, 1), open_=0.84, tilt=-0.06, low=0.72, iris_r=0.93, pupil_r=0.52,
               lid_t=0.01, sclera='#f6efe6', glint=1.0)
    er = 0.118
    # colour: pale muzzle, rosy cheeks and inner ear, a soft lash line over each eye
    C.region(S.ell((0, 0.06, 0.28), (0.15, 0.11, 0.12)), '#f8f1ea', 0.05, hair='#fffdf8', tip='#ffffff', length=0.012)
    C.region(S.ell((0.25, 0.04, 0.2), (0.075, 0.05, 0.07)).mirror(), '#f6bcc4', 0.06, hair='#f9cdd2', tip='#ffe9ea', length=0.03)
    C.region(inner.grow(0.016), '#f4aab8', 0.014, hair='#f8bcc6', tip='#ffdfe4', length=0.012)
    lash = S.sphere(ec, er + 0.02).sub(S.sphere(ec, er - 0.004)).inter(half((ec[0], ec[1] + er * 0.62, ec[2]), (0.1, 1, 0.25))).mirror()
    C.region(lash, '#3a2420', 0.005)
    C.region(S.ell(nose_c, (0.04, 0.028, 0.03)), K.glossy('TruffleNose', '#ee7f96', 0.2), 0.006)
    C.region(S.union(smile_f, phil).grow(0.005), '#7a3a4c', 0.004)
    C.region(tuft.grow(0.02).add(S.ell((0, -0.5, 0.2), (0.2, 0.25, 0.12)), 0.05), '#f6ece2', 0.06, hair='#fffaf2', tip='#ffffff', length=0.075, align=(0, -0.9, 0.4), clump=0.45)
    C.region(S.ell((0.3, 0.08, 0.02), (0.14, 0.16, 0.2)).mirror(), '#efe0d4', 0.06, hair='#f6ebe0', tip='#fffaf3', length=0.05, align=(0.5, -0.8, 0.1), clump=0.35)
    C.build(lo=(-0.85, -1.35, -0.85), hi=(0.85, 1.2, 0.85))
    # two small teeth just showing under the smile
    tz = S.surf_z(C.shape, 0, my - 0.02)
    teeth = S.union(*[S.box((sx * 0.013, my - 0.02, tz - 0.004), (0.011, 0.016, 0.006), 0.005, rot=(0.3, 0, 0)) for sx in (1, -1)])
    K.build('TruffleTeeth', teeth, (-0.08, -0.05, 0.2), (0.08, 0.1, 0.5), [K.glossy('TruffleTooth', '#fffaf2', 0.14)], step=0.002)
    # the rose silk bow where the upright ear meets the head
    bc = (0.2, 0.56, 0.02)
    bow = S.union(S.ell((bc[0] - 0.08, bc[1], bc[2]), (0.085, 0.052, 0.034), rot=(0, 0, 0.3)), S.ell((bc[0] + 0.08, bc[1], bc[2]), (0.085, 0.052, 0.034), rot=(0, 0, -0.3)),
                  S.sphere((bc[0], bc[1], bc[2] + 0.02), 0.034), k=0.016).rot(0, 0, 0.2, about=bc)
    tails = S.union(S.tube([(bc[0] - 0.01, bc[1] - 0.02, bc[2] + 0.02), (bc[0] - 0.05, bc[1] - 0.11, bc[2] + 0.05)], 0.022, 0.014),
                    S.tube([(bc[0] + 0.01, bc[1] - 0.02, bc[2] + 0.02), (bc[0] + 0.04, bc[1] - 0.12, bc[2] + 0.05)], 0.022, 0.014))
    K.build('TruffleBow', S.union(bow, tails, k=0.008), (-0.05, 0.38, -0.1), (0.42, 0.7, 0.2), [K.silk('TruffleSilk', '#e2557f')], step=0.003)
    return (0.5, 0.2, 3.9), (0, 0.2, 0), 76


build = bunny
