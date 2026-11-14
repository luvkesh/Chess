"""dragon: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *
from cast._d import *


def dragon():
    """Ember: a baby dragon, the strongest friend and well aware of it. Spiky silhouette: two
    curved horns, webbed ear frills, little wings. Satin crimson skin warming to orange on the
    snout and cream on the belly, bright emerald eyes under bold brows, a smirk with one tiny
    fang, and a small gold crown worn at a tilt."""
    C = Char('Ember', '#d92e22', '#d92e22')
    cream = '#ffd088'
    bare(C, soft_mat('EmberSkin', '#9c0a04', [
        ((0, 0.62, -0.05), (0.5, 0.25, 0.5), '#740608', 0.6, False, 0.7),            # deeper on the crown
        ((0, 0.05, 0.34), (0.21, 0.15, 0.17), '#d83a0c', 0.7, False, 0.7),          # warm snout
        ((0, -0.085, 0.24), (0.15, 0.075, 0.16), cream, 0.5, False, 0.95),           # chin
        ((0, -0.72, 0.24), (0.27, 0.5, 0.26), cream, 0.2, False, 1.0),               # belly
        ((0.52, 0.27, -0.12), (0.17, 0.23, 0.09), '#f06a08', 0.45, True, 0.95),      # frill webs
        ((0.3, 0.03, 0.2), (0.085, 0.055, 0.08), '#ff5a48', 0.8, True, 0.5),        # cheeks
    ], rough=0.45, sss=0.06, bump=0.06, bump_scale=110, coat=0.1, sheen=0.0))

    cran = S.ell((0, 0.27, -0.02), (0.37, 0.32, 0.34))
    cheeks = S.ell((0.21, 0.09, 0.07), (0.21, 0.175, 0.21)).mirror()
    snout = S.ell((0, 0.065, 0.29), (0.175, 0.115, 0.13))
    head = S.union(cran, cheeks, snout, k=0.11)
    C.add(head)
    # nostril bumps on the snout
    for sx in (1, -1):
        nz = S.surf_z(C.shape, sx * 0.065, 0.125)
        C.add(near(S.sphere((sx * 0.065, 0.125, nz - 0.012), 0.034), (sx * 0.065 - 0.04, 0.085, nz - 0.05), (sx * 0.065 + 0.04, 0.165, nz + 0.03), 0.06), 0.03)
    nost = []
    for sx in (1, -1):
        nz = S.surf_z(C.shape, sx * 0.068, 0.132)
        nost.append(S.ell((sx * 0.068, 0.132, nz), (0.014, 0.011, 0.02), rot=(0, 0, sx * 0.5)))
    nost = near(S.union(*nost), (-0.09, 0.11, 0.3), (0.09, 0.15, 0.5), 0.04)
    C.sub(nost, 0.006)
    # ear frills: three spines each side with a web between them
    fr = []
    for sx in (1, -1):
        B = np.array([sx * 0.31, 0.27, -0.06])
        T = [np.array([sx * 0.585, 0.485, -0.15]), np.array([sx * 0.665, 0.28, -0.16]), np.array([sx * 0.575, 0.075, -0.15])]
        sp = [S.cone(B, t, 0.05, 0.013) for t in T]
        web = S.union(S.tri(B, T[0], T[1], 0.011), S.tri(B, T[1], T[2], 0.011))
        for i in range(2):
            m = (T[i] + T[i + 1]) / 2
            web = web.sub(S.sphere(m + (m - B) * 0.2, 0.085), 0.01)
        fr.append(near(S.union(*sp, web, k=0.012), (min(B[0], sx * 0.68), 0.04, -0.2), (max(B[0], sx * 0.68), 0.52, 0.0), 0.1))
    C.add(S.union(*fr), 0.05)
    # a small body, well below the head; belly bands
    body = chubby(0.46, 0.36, paws=False)
    paws = arms(0.46, 0.36, r=0.063)
    C.add(body, 0.14).add(paws, 0.025)
    bands = []
    for y in (-0.52, -0.62, -0.72):
        bands.append(S.tube([(x, y - 0.035 * (x / 0.2) ** 2, S.surf_z(C.shape, x, y) - 0.002) for x in np.linspace(-0.2, 0.2, 5)], 0.009, 0.009, n=10))
    bands = near(S.union(*bands), (-0.22, -0.8, -0.1), (0.22, -0.45, 0.45), 0.05)
    C.sub(bands, 0.012)
    # the smirk
    my = -0.012
    smile_f = near(crease(C.shape, (0, my, 0), 0.115, 0.03, smirk=0.028, r=0.012, depth=0.15), (-0.14, -0.04, 0.15), (0.14, 0.06, 0.48), 0.04)
    C.sub(smile_f, 0.007)
    OPEN, LT, TILT = 0.8, 0.012, 0.2
    ec = C.eye(0.195, 0.215, 0.118, 0.44, '#1fb45a', look=(0.03, 0.02, 1), open_=OPEN, tilt=TILT, low=0.72, iris_r=0.93, pupil_r=0.5,
               lid_t=LT, sclera='#fff6e6', glint=1.0)
    # bold little brow ridges
    for sx in (1, -1):
        bz = S.surf_z(C.shape, sx * 0.2, 0.375)
        C.add(near(S.ell((sx * 0.2, 0.375, bz - 0.022), (0.105, 0.032, 0.045), rot=(0, 0, sx * 0.34)), (sx * 0.2 - 0.12, 0.31, bz - 0.08), (sx * 0.2 + 0.12, 0.44, bz + 0.04), 0.08), 0.035)
    C.region(paws.grow(0.012), K.principled('EmberPaw', '#9c0a04', rough=0.45, sss=0.06, coat=0.1), 0.01)
    C.region(S.union(smile_f, nost).grow(0.004), '#6e1418', 0.005)
    C.build(step=STEP, lo=(-0.8, -1.32, -0.5), hi=(0.8, 0.66, 0.52), bump=0.0015)
    lash_line(C, '#4a0c10', OPEN, LT, w=0.008, tilt=TILT, flick=0.02)

    # one tiny fang
    fz = S.surf_z(C.shape, 0.07, my + 0.002)
    K.build('EmberFang', S.cone((0.07, my + 0.006, fz - 0.006), (0.073, my - 0.028, fz + 0.002), 0.014, 0.003), (0.03, my - 0.06, fz - 0.04), (0.11, my + 0.04, fz + 0.04),
            [K.glossy('EmberTooth', '#fffaf0', 0.15)], step=0.0018)
    # horns: short, curved, ringed ivory warming to gold at the tips
    horn_m = soft_mat('EmberHorn', '#fff0cc', [((0.33, 0.83, -0.08), (0.12, 0.2, 0.15), '#f2b24a', 0.7, True, 1.0)], rough=0.32, sss=0.2, coat=0.3, sheen=0.0)
    for sx in (1, -1):
        hp = [(sx * 0.19, 0.5, -0.06), (sx * 0.27, 0.64, -0.1), (sx * 0.325, 0.75, -0.1), (sx * 0.33, 0.845, -0.06)]
        h = S.tube(hp, 0.066, 0.012, n=18)
        for f in (0.28, 0.5, 0.7):
            p = np.array(hp[1]) * (1 - f) + np.array(hp[2]) * f + np.array([0, (f - 0.5) * 0.12, 0])
            h = h.sub(S.torus(p, 0.066 - 0.04 * f + 0.008, 0.005, rot=(0, 0, -sx * 0.5)), 0.008)
        K.build('EmberHorn%d' % sx, h, (min(sx * 0.1, sx * 0.4), 0.42, -0.2), (max(sx * 0.1, sx * 0.4), 0.87, 0.04), [horn_m], step=0.003)
    # the crown: small, gold, tilted, with a sapphire
    gold = K.gold('EmberGold', '#ffc24a', 0.18)
    R = 0.112
    ring = S.cyl((0, 0, 0), R, 0.036).sub(S.cyl((0, 0, 0), R - 0.012, 0.1))
    pts, balls = [], []
    for a in np.linspace(0, 2 * math.pi, 5, endpoint=False) + math.pi / 2:
        x, z = R * 0.94 * math.cos(a), R * 0.94 * math.sin(a)
        pts.append(S.cone((x, 0.02, z), (x * 1.12, 0.115, z * 1.12), 0.036, 0.009))
        balls.append(S.sphere((x * 1.12, 0.125, z * 1.12), 0.017))
    crown = S.union(ring, *pts, k=0.008).sub(S.cyl((0, 0, 0), R - 0.02, 0.2)).add(S.union(*balls))
    cy = 0.6
    place = lambda f: f.rot(0.12, 0, 0.24).move(-0.045, cy, 0.0)
    K.build('EmberCrown', place(crown), (-0.26, 0.5, -0.2), (0.16, 0.84, 0.2), [gold], step=0.0022)
    K.build('EmberGem', place(S.ell((0, 0.0, R + 0.002), (0.026, 0.026, 0.014))), (-0.2, 0.5, 0.0), (0.1, 0.72, 0.2), [K.gem('EmberSapphire', '#1a6cf0')], step=0.0015)
    K.build('EmberGemBack', place(S.ell((0, 0.0, R - 0.004), (0.024, 0.024, 0.008))), (-0.2, 0.5, 0.0), (0.1, 0.72, 0.2), [K.enamel('EmberGemFoil', '#3a8cff')], step=0.0015)
    # little wings behind the shoulders
    bones, webs = [], []
    for sx in (1, -1):
        sh = np.array([sx * 0.36, -0.5, -0.28])
        wr = np.array([sx * 0.49, -0.14, -0.36])
        tips = [np.array([sx * 0.68, -0.2, -0.36]), np.array([sx * 0.7, -0.42, -0.36]), np.array([sx * 0.58, -0.62, -0.34])]
        bones += [S.cone(sh, wr, 0.04, 0.03), S.sphere(wr, 0.035)] + [S.cone(wr, t, 0.024, 0.008) for t in tips]
        w = S.union(*[S.tri(wr, tips[i], tips[i + 1], 0.007) for i in range(2)], S.tri(sh, wr, tips[-1], 0.007))
        for i in range(2):
            m = (tips[i] + tips[i + 1]) / 2
            w = w.sub(S.sphere(m + (m - wr) * 0.28, 0.1))
        webs.append(w)
    K.build('EmberWings', S.union(*webs), (-0.8, -0.7, -0.42), (0.8, 0.0, -0.25), [K.principled('EmberWeb', '#e8600a', rough=0.5, sss=0.1, sheen=0.0)], step=0.004)
    K.build('EmberBones', S.union(*bones), (-0.8, -0.7, -0.44), (0.8, 0.0, -0.22), [bpy_mat('EmberSkin')], step=0.004)
    return (0.5, 0.16, 3.9), (0, 0.08, 0), 76


build = dragon
