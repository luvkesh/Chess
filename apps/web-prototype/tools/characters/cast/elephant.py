"""elephant: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *
from cast._d import *


def elephant():
    """Moti: a baby Mughal elephant. Wide silhouette: two big round ears, a domed forehead, a short
    trunk curling up to one side. Soft periwinkle skin with pink ear linings and blush, big kind
    brown eyes, a gold forehead jewel with a ruby and a strand of pearls, an emerald silk drape."""
    C = Char('Moti', '#8d9ccb', '#8d9ccb')
    skin = soft_mat('MotiSkin', '#5468c2', [
        ((0.0, 0.62, 0.0), (0.5, 0.3, 0.5), '#4456b0', 0.6, False, 0.5),          # a touch deeper on the crown
        ((0.555, 0.21, 0.06), (0.185, 0.25, 0.13), '#f3a9bd', 0.35, True, 1.0),     # ear linings
        ((0.27, 0.0, 0.26), (0.1, 0.075, 0.1), '#f09ab4', 0.75, True, 0.7),       # blush
        ((0.0, -0.2, 0.3), (0.12, 0.1, 0.12), '#7a8cd4', 0.6, False, 0.6),        # paler lip and chin
    ], rough=0.58, sss=0.22, bump=0.07, bump_scale=34, sheen=0.1)
    bare(C, skin)

    head = S.union(S.ell((0, 0.22, 0), (0.39, 0.37, 0.35)),
                   S.ell((0.13, 0.47, 0.02), (0.19, 0.16, 0.22)).mirror(),         # the double-domed forehead
                   S.ell((0.2, 0.02, 0.13), (0.19, 0.17, 0.19)).mirror(), k=0.12)   # full cheeks
    lip = S.ell((0, -0.17, 0.2), (0.105, 0.075, 0.11))
    head = head.add(lip, 0.05)
    C.add(head)
    # smile creases: up from under the trunk into each cheek
    def cr(sx):
        pts = []
        for u in np.linspace(0, 1, 6):
            x = 0.085 + 0.15 * u
            y = -0.115 + 0.125 * u * u
            pts.append((sx * x, y, S.surf_z(head, x, y) - 0.003))
        return S.tube(pts, 0.012, 0.006)
    smile_c = S.union(cr(1), cr(-1))
    C.sub(smile_c, 0.012)
    dimple = S.sphere((0.24, 0.012, S.surf_z(head, 0.24, 0.012)), 0.014).mirror()
    C.sub(dimple, 0.012)

    # ears: big, round, thin, a little cupped toward the camera
    for sx in (1, -1):
        e = S.union(S.ell((sx * 0.53, 0.27, -0.1), (0.23, 0.25, 0.045), rot=(0, sx * 0.45, sx * 0.12)),
                    S.ell((sx * 0.5, 0.07, -0.08), (0.16, 0.19, 0.042), rot=(0, sx * 0.4, sx * -0.1)), k=0.08)
        C.add(e, 0.07)
    # trunk: short, hanging and curling up to the side, with a few soft rings
    tp = [(0, 0.2, 0.27), (0, 0.04, 0.41), (-0.01, -0.16, 0.47), (0.04, -0.33, 0.5), (0.17, -0.4, 0.54), (0.3, -0.33, 0.58), (0.35, -0.19, 0.59)]
    trunk = near(S.tube(tp, 0.115, 0.058, k=0.03, n=40), (-0.14, -0.47, 0.15), (0.42, 0.33, 0.66))
    C.add(trunk, 0.09)
    rings = []
    tt = np.array(tp)
    for i in (2, 3, 4, 5):
        a, b = tt[i], tt[i + 1]
        for f in (0.15, 0.65):
            p = a + (b - a) * f
            d = (b - a) / np.linalg.norm(b - a)
            rr = 0.125 + (0.058 - 0.125) * (i + f) / 6
            ry = math.atan2(d[0], d[2]); rx = -math.asin(d[1])
            rings.append(S.torus(p, rr + 0.012, 0.007, rot=(rx + math.pi / 2, ry, 0)))
    C.sub(near(S.union(*rings), (-0.15, -0.47, 0.3), (0.45, -0.05, 0.68), 0.05), 0.014)
    C.sub(S.sphere((0.355, -0.16, 0.6), 0.03), 0.012)
    C.region(S.sphere((0.355, -0.165, 0.6), 0.04), '#e58aa6', 0.02)

    body = chubby(0.46, 0.36, paws=False)
    C.add(body, 0.14).add(arms(0.46, 0.36, r=0.075), 0.03)

    OPEN, LT, TILT = 0.96, 0.012, 0.03
    C.eye(0.205, 0.165, 0.118, 0.44, '#6a4cc4', look=(0.03, 0.03, 1), open_=OPEN, tilt=TILT, low=0.72, iris_r=0.93, pupil_r=0.52, lid_t=LT, glint=1.0)
    C.region(smile_c.grow(0.004), '#5b5f98', 0.006)
    C.build(step=STEP, lo=(-0.85, -1.3, -0.45), hi=(0.85, 0.8, 0.7), bump=0.0015)


    lash_line(C, '#2a1c3c', OPEN, LT, w=0.008, tilt=TILT, lashes=3, lash_len=0.04)
    # a wisp of baby hair on the crown
    w = C.weight(S.sphere((0.0, 0.66, 0.0), 0.07), 0.03)
    P, N = K.sample_surface(C.o, w, 60, seed=5)
    tuft = K.groom(P, N, 0.15, (0.3, 1.0, 0.3), gravity=1.1, lift=1.0, clumps=3, clump=0.85, jitter=0.15, seed=2, curl=0.7)
    K.strands('MotiTuft', tuft, K.hair_mat('MotiTuftHair', '#2c3a84', '#4658b0', var=0.1), 0.006, 0.001, normals=N)

    # the forehead jewel: a gold drop with a ruby, pearls draped to each side
    gold = K.gold('MotiGold', '#f0c060', 0.2)
    hy = 0.415
    hz = S.surf_z(C.shape, 0, hy)
    drop = S.union(S.ell((0, hy, hz), (0.062, 0.062, 0.02)), S.cone((0, hy - 0.04, hz), (0, hy - 0.115, hz - 0.012), 0.04, 0.008), k=0.02)
    rim = S.torus((0, hy, hz + 0.012), 0.043, 0.008, rot=(math.pi / 2, 0, 0))
    K.build('MotiDrop', drop.add(rim, 0.004), (-0.15, hy - 0.2, hz - 0.08), (0.15, hy + 0.12, hz + 0.08), [gold], step=0.002)
    K.build('MotiRuby', S.ell((0, hy, hz + 0.02), (0.034, 0.034, 0.02)), (-0.08, hy - 0.08, hz - 0.03), (0.08, hy + 0.08, hz + 0.08), [K.gem('MotiRubyGem', '#d80a3c')], step=0.0015)
    K.build('MotiRubyBack', S.ell((0, hy, hz + 0.012), (0.03, 0.03, 0.008)), (-0.08, hy - 0.08, hz - 0.03), (0.08, hy + 0.08, hz + 0.08), [K.enamel('MotiRubyFoil', '#ff3058')], step=0.0015)
    pearls = []
    for sx in (1, -1):
        for u in np.linspace(0.12, 1.0, 9):
            x = sx * (0.06 + 0.3 * u)
            y = hy + 0.035 + 0.1 * math.sin(u * 2.0) - 0.07 * u * u
            pearls.append(S.sphere((x, y, S.surf_z(C.shape, x, y) + 0.006), 0.019))
    top = [S.sphere((0, hy + 0.07 + 0.04 * j, S.surf_z(C.shape, 0, hy + 0.07 + 0.04 * j) + 0.004), 0.013) for j in range(4)]
    K.build('MotiPearls', S.union(*pearls), (-0.5, 0.25, -0.3), (0.5, 0.7, 0.6), [K.pearl('MotiPearl')], step=0.002)
    K.build('MotiBeads', S.union(*top), (-0.1, 0.4, -0.1), (0.1, 0.75, 0.6), [gold], step=0.002)
    for sx in (1, -1):
        K.build('MotiTusk%d' % sx, S.tube([(sx * 0.125, -0.13, 0.27), (sx * 0.15, -0.2, 0.345), (sx * 0.155, -0.215, 0.4)], 0.027, 0.012),
                (sx * 0.14 - 0.1, -0.3, 0.2), (sx * 0.14 + 0.1, -0.08, 0.46), [K.glossy('MotiIvory%d' % sx, '#fff3dc', 0.2)], step=0.0025)
    return (0.55, 0.12, 3.9), (0, 0.1, 0), 76


build = elephant
