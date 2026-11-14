"""squirrel: Zippy, the fast attacker (v3 look, see ../STYLE.md)."""
from common import *


def squirrel():
    """Zippy: a bright russet squirrel, eager and quick. Tall tufted ears, a great plume of a tail
    curling up behind the head, teal eyes, a tiny open smile and a striped running headband."""
    C = Char('Zippy', '#b85a1c', '#d9742a', '#f8b464', length=0.04, align=(0, -0.55, 0.1), clump=0.22, var=0.1)
    cran = S.ell((0, 0.27, -0.02), (0.32, 0.3, 0.32))
    cheeks = S.ell((0.2, 0.1, 0.08), (0.185, 0.155, 0.2)).mirror()
    muz = S.ell((0, 0.085, 0.29), (0.1, 0.075, 0.08))
    C.add(S.union(cran, cheeks, muz, k=0.11))
    for sx in (1, -1):
        e, cut = ear((sx * 0.19, 0.47, -0.05), (sx * 0.3, 0.8, -0.08), 0.105, 0.02, thick=0.045)
        C.add(e, 0.05).sub(cut, 0.015)
    body = chubby(0.42, 0.33)
    C.add(body, 0.14)
    tail = S.tube([(0.3, -0.85, -0.4), (0.62, -0.3, -0.52), (0.72, 0.3, -0.48), (0.6, 0.78, -0.38), (0.36, 0.98, -0.32), (0.2, 0.86, -0.3)], 0.13, 0.1, k=0.03)
    C.add(tail, 0.04)
    ny = 0.105
    nose_c = (0, ny, S.surf_z(C.shape, 0, ny) - 0.006)
    C.add(S.ell(nose_c, (0.032, 0.022, 0.022)), 0.006)
    mc = (0, 0.03, S.surf_z(C.shape, 0, 0.03) - 0.022)
    cav, corners = smile(mc, 0.05, 0.036, 0.05, 0.9)
    C.sub(cav, 0.01).sub(corners, 0.006)
    ec = C.eye(0.175, 0.21, 0.112, 0.44, '#1fa090', look=(0.02, 0.06, 1), glance=-0.1, open_=0.92, tilt=0.06, low=0.74, iris_r=0.93,
               pupil_r=0.5, lid_t=0.01, glint=1.0)
    lash(C, ec, 0.112, '#5a2a10')
    cream = dict(hair='#fbeed8', tip='#ffffff')
    C.region(S.ell((0, 0.05, 0.28), (0.16, 0.12, 0.13)), '#f4e2c6', 0.05, length=0.014, **cream)
    C.region(S.ell((0, -0.5, 0.2), (0.2, 0.32, 0.13)), '#f4e2c6', 0.06, length=0.06, align=(0, -0.9, 0.4), clump=0.4, **cream)
    C.region(S.ell((0.27, 0.05, 0.04), (0.13, 0.15, 0.2)).mirror(), '#d9742a', 0.06, hair='#e2853a', tip='#fbc680', length=0.055, align=(0.5, -0.8, 0.1), clump=0.35)
    C.region(tail.grow(0.02), '#b85a1c', 0.03, hair='#cf6a22', tip='#fcc078', length=0.14, align=(0.2, 1.0, 0.2), clump=0.5, dens=0.55)
    C.region(S.ell(nose_c, (0.038, 0.028, 0.03)), K.glossy('ZippyNose', '#5a2a1e', 0.2), 0.006)
    C.region(cav.grow(0.005), '#a03c4c', 0.005)
    C.build(lo=(-0.85, -1.35, -0.85), hi=(0.95, 1.25, 0.85))
    mouth_parts('Zippy', mc, 0.05, 0.036, 0.05, top_teeth=False, curve=0.9)
    for sx in (1, -1):
        P = np.array([[sx * (0.3 + 0.014 * np.cos(a)), 0.79 + 0.012 * np.sin(a), -0.08] for a in np.linspace(0, 6.28, 50)])
        N = np.tile([[sx * 0.25, 1.0, 0.0]], (50, 1)); N /= np.linalg.norm(N, axis=1)[:, None]
        K.strands('ZippyTuft%d' % sx, K.groom(P, N, 0.11, (sx * 0.25, 0.8, 0), gravity=-0.2, clumps=3, clump=0.85, jitter=0.2, seed=5), bpy_mat('ZippyHair0'), 0.004, 0.0006)
    hb = S.torus((0, 0.42, -0.02), 0.3, 0.034, rot=(-0.22, 0, 0))
    hb_o = K.build('ZippyBand', hb, (-0.5, 0.25, -0.5), (0.5, 0.62, 0.5), [K.stripes('ZippyTerry', '#e02a34', '#ffffff', 20, 'Y')], step=0.004)
    K.fuzz(hb_o, '#f0e4e0', 0.004, 9000)
    return (0.5, 0.2, 3.9), (0.06, 0.18, 0), 74


build = squirrel
