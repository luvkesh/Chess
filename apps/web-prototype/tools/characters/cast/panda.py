"""panda: Bao, champion of Ming China (v3 look, see ../STYLE.md)."""
from common import *


def panda():
    """Bao: a gentle little panda. A very round, wide head, soft black ears and drooping eye
    patches, honey eyes, and a red silk collar with a gold knot."""
    C = Char('Bao', '#e8e4de', '#f6f3ee', '#ffffff', length=0.045, align=(0, -0.55, 0.1), clump=0.2, var=0.05)
    cran = S.ell((0, 0.25, -0.02), (0.43, 0.35, 0.35))
    cheeks = S.ell((0.23, 0.1, 0.08), (0.2, 0.16, 0.2)).mirror()
    muz = S.ell((0, 0.065, 0.3), (0.125, 0.085, 0.08))
    C.add(S.union(cran, cheeks, muz, k=0.11))
    ears = S.ell((0.34, 0.55, -0.06), (0.135, 0.125, 0.07)).mirror()
    C.add(ears, 0.05)
    body = chubby(0.5, 0.38)
    C.add(body, 0.14)
    ny = 0.1
    nose_c = (0, ny, S.surf_z(C.shape, 0, ny) - 0.008)
    C.add(S.ell(nose_c, (0.045, 0.028, 0.026)), 0.006)
    little_mouth(C, 0.02, 0.065, 0.03, nose_y=ny - 0.025, col='#3a2228')
    ec = C.eye(0.185, 0.2, 0.105, 0.44, '#b8782c', look=(0.02, 0.05, 1), open_=0.86, tilt=-0.1, low=0.72, iris_r=0.93, pupil_r=0.5,
               lid_t=0.01, glint=1.0)
    black = dict(hair='#1a1a20', tip='#3a3a44')
    C.region(S.ell((0.2, 0.17, 0.22), (0.145, 0.185, 0.2), rot=(0, 0, 0.5)).mirror(), '#16161a', 0.02, length=0.03, dens=1.6, **black)
    C.region(ears.grow(0.035), '#16161a', 0.02, length=0.04, **black)
    C.region(S.ell((0, -0.86, 0), (0.9, 0.55, 0.7)), '#16161a', 0.06, length=0.045, **black)
    C.region(S.ell(nose_c, (0.052, 0.034, 0.034)), K.glossy('BaoNose', '#18141a', 0.2), 0.006)
    C.region(S.ell((0.27, 0.03, 0.2), (0.07, 0.045, 0.06)).mirror(), '#f6c6c8', 0.06, hair='#fad6d6', tip='#fff0ee', length=0.03)
    little_mouth_region(C)
    C.build()
    collar = S.torus((0, -0.17, -0.02), 0.3, 0.045, rot=(0.22, 0, 0)).bump(0.006, 18, 2)
    K.build('BaoCollar', collar, (-0.5, -0.45, -0.5), (0.5, 0.0, 0.5), [K.silk('BaoSilk', '#c81e28')], step=0.004)
    kz = S.surf_z(collar, 0, -0.235)
    knot = S.union(S.sphere((0, -0.235, kz), 0.034), S.torus((0, -0.235, kz - 0.006), 0.045, 0.009, rot=(1.4, 0, 0)))
    K.build('BaoKnot', knot, (-0.1, -0.35, kz - 0.1), (0.1, -0.15, kz + 0.1), [K.gold('BaoGold')], step=0.002)
    return (0.5, 0.2, 3.9), (0, 0.12, 0), 76


build = panda
