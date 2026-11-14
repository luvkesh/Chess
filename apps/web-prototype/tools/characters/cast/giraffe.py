"""giraffe: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *
from cast._d import *


def giraffe():
    """Ivy: the far-sighted planner. Tall, slim silhouette: a small sweet head on a long neck,
    two tufted ossicones and leaf ears held out wide. Sunny gold coat with caramel patches and a
    cream muzzle, amber eyes with long lashes behind big round gold spectacles."""
    C = Char('Ivy', '#e8a82c', '#f4b62e', '#ffd874', length=0.03, align=(0, -0.6, 0.1), clump=0.2, var=0.07)
    cran = S.ell((0, 0.31, -0.02), (0.325, 0.3, 0.31))
    cheeks = S.ell((0.17, 0.15, 0.08), (0.175, 0.15, 0.18)).mirror()
    muz = S.ell((0, 0.055, 0.225), (0.185, 0.145, 0.19))
    head = S.union(cran, cheeks, muz, k=0.11)
    C.add(head)
    # a short, thick, soft neck that widens into a plump tummy with two little hooves at the chest
    neck = S.cone((0, 0.12, -0.1), (0, -0.5, -0.06), 0.235, 0.33)
    body = chubby(0.45, 0.36, top=-0.4)
    C.add(neck, 0.1).add(body, 0.14)
    ossi = S.union(*[S.cone((sx * 0.115, 0.56, -0.07), (sx * 0.165, 0.8, -0.11), 0.05, 0.042) for sx in (1, -1)])
    knobs = S.sphere((0.168, 0.82, -0.11), 0.068).mirror()
    C.add(near(S.union(ossi, knobs, k=0.02), (-0.24, 0.5, -0.2), (0.24, 0.9, 0.0), 0.1), 0.04)
    ears, inner = [], []
    for sx in (1, -1):
        c = (sx * 0.43, 0.45, -0.1)
        ears.append(S.ell(c, (0.175, 0.085, 0.05), rot=(0.2, sx * 0.25, sx * 0.3)))
        inner.append(S.ell((c[0], c[1] - 0.005, c[2] + 0.045), (0.125, 0.048, 0.03), rot=(0.2, sx * 0.25, sx * 0.3)))
    C.add(near(S.union(*ears), (-0.62, 0.3, -0.2), (0.62, 0.6, 0.02), 0.1), 0.05)
    inner = near(S.union(*inner), (-0.6, 0.35, -0.15), (0.6, 0.56, 0.02), 0.05)
    C.sub(inner, 0.02)
    nost = S.union(*[S.ell((sx * 0.06, 0.1, S.surf_z(C.shape, sx * 0.06, 0.1)), (0.017, 0.011, 0.02), rot=(0, 0, sx * 0.5)) for sx in (1, -1)])
    nost = near(nost, (-0.09, 0.08, 0.3), (0.09, 0.13, 0.5), 0.04)
    C.sub(nost, 0.006)
    my = -0.01
    smile_f = near(crease(C.shape, (0, my, 0), 0.09, 0.038, r=0.012, depth=0.12), (-0.1, -0.04, 0.2), (0.1, 0.05, 0.5), 0.04)
    C.sub(smile_f, 0.007)
    OPEN, LT, TILT = 0.84, 0.01, -0.05
    ec = C.eye(0.175, 0.3, 0.112, 0.44, '#c8741a', look=(0.02, 0.05, 1), open_=OPEN, tilt=TILT, low=0.72, iris_r=0.93, pupil_r=0.52, lid_t=LT,
               sclera='#f8f0e2', glint=1.0)
    er = 0.112
    rng = np.random.default_rng(11)
    seeds = rng.uniform([-0.42, -1.35, -0.45], [0.42, 0.7, 0.35], (150, 3))

    def patches(P):
        d1 = np.full(len(P), 9.0); d2 = np.full(len(P), 9.0)
        for q in seeds:
            d = np.linalg.norm((P - q) * np.array([1, 0.8, 1]), axis=1)
            d2 = np.minimum(d2, np.maximum(d1, d)); d1 = np.minimum(d1, d)
        return 0.034 - (d2 - d1)
    face_zone = S.ell((0, 0.17, 0.25), (0.34, 0.33, 0.3))
    C.region(S.F(patches).sub(face_zone, 0.06).sub(S.ell((0, -0.9, 0.3), (0.3, 0.5, 0.25)), 0.05).sub(S.ell((0, 0.75, -0.1), (0.3, 0.2, 0.2))).sub(S.ell((0.45, 0.45, -0.1), (0.2, 0.12, 0.12)).mirror()),
             '#a0541c', 0.012, hair='#a85a1e', tip='#c87a34', length=0.03)
    C.region(S.ell((0, -0.95, 0.3), (0.25, 0.42, 0.2)), '#fbeed2', 0.06, hair='#fff4dc', tip='#ffffff', length=0.04, align=(0, -0.8, 0.4), clump=0.3)
    C.region(S.ell((0, 0.03, 0.26), (0.185, 0.14, 0.17)), '#fbeed2', 0.05, hair='#fff4dc', tip='#ffffff', length=0.014)
    C.region(S.ell((0.235, 0.12, 0.19), (0.07, 0.048, 0.065)).mirror(), '#f6a6a0', 0.06, hair='#f8b4ac', tip='#ffd6ce', length=0.028)
    C.region(inner.grow(0.014), '#f4a8b0', 0.012, hair='#f8bcc2', tip='#ffe0e2', length=0.01)
    C.region(knobs.grow(0.012), '#5a3418', 0.02, hair='#5e3618', tip='#8a5428', length=0.06, align=(0, 1.0, 0.1), clump=0.45)
    lash = S.sphere(ec, er + 0.02).sub(S.sphere(ec, er - 0.004)).inter(half((ec[0], ec[1] + er * 0.62, ec[2]), (0.1, 1, 0.25))).mirror()
    C.region(lash, '#3a2014', 0.005)
    C.region(S.union(smile_f, nost).grow(0.004), '#6a3a22', 0.005)
    C.build(step=STEP, lo=(-0.66, -1.35, -0.55), hi=(0.66, 0.95, 0.5))
    lash_line(C, '#2a160c', OPEN, LT, w=0.007, tilt=TILT, lashes=3, lash_len=0.045)
    specs('Ivy', C.eyes[0][0], er, rim=0.142)
    return (0.5, 0.18, 3.9), (0, 0.04, 0), 76


build = giraffe
