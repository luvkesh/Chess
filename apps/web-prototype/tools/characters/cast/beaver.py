"""beaver: Bramble, the calm builder (v3 look, see ../STYLE.md)."""
from common import *


def beaver():
    """Bramble: a chubby chocolate beaver, calm and content. A pear-shaped head with very full
    cheeks, small round ears, half-closed olive eyes, two neat teeth and a yellow hard hat."""
    C = Char('Bramble', '#5a3018', '#7c4a28', '#b88250', length=0.04, align=(0, -0.55, 0.1), clump=0.22, var=0.1)
    cran = S.ell((0, 0.3, -0.02), (0.3, 0.27, 0.31))
    cheeks = S.ell((0.22, 0.07, 0.06), (0.24, 0.2, 0.23)).mirror()
    muz = S.ell((0, 0.075, 0.31), (0.155, 0.1, 0.085))
    C.add(S.union(cran, cheeks, muz, k=0.12))
    C.add(S.sphere((0.32, 0.42, -0.06), 0.075).mirror(), 0.03)
    body = chubby(0.54, 0.4)
    C.add(body, 0.14)
    ny = 0.12
    nose_c = (0, ny, S.surf_z(C.shape, 0, ny) - 0.01)
    C.add(S.ell(nose_c, (0.058, 0.036, 0.032)), 0.006)
    my = 0.025
    little_mouth(C, my, 0.07, 0.03, nose_y=ny - 0.03, col='#3a1c14')
    ec = C.eye(0.17, 0.23, 0.1, 0.44, '#8a9a2e', look=(0.02, -0.02, 1), open_=0.56, tilt=-0.16, low=0.62, iris_r=0.93, pupil_r=0.5,
               lid_t=0.012, glint=1.0)
    lash(C, ec, 0.1, '#2e1808', cover=0.4)
    C.region(S.ell((0, 0.05, 0.3), (0.2, 0.13, 0.12)), '#d8b088', 0.05, hair='#e4c29c', tip='#f8e4c8', length=0.014)
    C.region(S.ell((0, -0.5, 0.22), (0.22, 0.32, 0.13)), '#c89a6c', 0.07, hair='#d8ae80', tip='#f2d8b4', length=0.055, align=(0, -0.9, 0.4), clump=0.4)
    C.region(S.sphere((0.32, 0.42, -0.02), 0.045).mirror(), '#3a1e0e', 0.012)
    C.region(S.ell(nose_c, (0.066, 0.042, 0.04)), K.glossy('BrambleNose', '#2a160e', 0.2), 0.006)
    little_mouth_region(C)
    C.build()
    tz = S.surf_z(C.shape, 0, my - 0.03)
    teeth = S.union(*[S.box((sx * 0.02, my - 0.03, tz - 0.004), (0.018, 0.026, 0.007), 0.007, rot=(0.25, 0, 0)) for sx in (1, -1)])
    K.build('BrambleTeeth', teeth, (-0.1, -0.1, 0.2), (0.1, 0.1, 0.55), [K.glossy('BrambleTooth', '#fff6e2', 0.14)], step=0.002)
    hy = 0.45
    dome = S.ell((0, hy, -0.03), (0.33, 0.24, 0.35)).inter(S.plane((0, -1, 0), -hy))
    brim = S.cyl((0, hy, 0.02), 0.4, 0.012, round_=0.01)
    ridge = S.ell((0, hy + 0.17, -0.03), (0.045, 0.09, 0.3)).inter(S.ell((0, hy, -0.03), (0.35, 0.26, 0.37)))
    hat = S.union(dome, brim, k=0.02).add(ridge, 0.02).rot(-0.14, 0, 0.12, about=(0, hy, 0))
    K.build('BrambleHat', hat, (-0.6, 0.3, -0.6), (0.6, 0.85, 0.7), [K.principled('HardHat', '#f6bc1e', rough=0.25, coat=0.8)], step=0.004)
    return (0.5, 0.2, 3.9), (0, 0.12, 0), 76


build = beaver
