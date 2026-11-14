"""dragon: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def dragon():
    """Ember: a little red dragon: scaled ruby skin with a cream throat, gold horns, a ridge of
    spines, a tiny tilted crown and folded wings."""
    C = Char('Ember', '#c0281c', '#c0281c', length=0.006, clump=0.0)
    C.mats[0] = K.scales('EmberSkin', '#a8140c', 120, 0.45, 0.1, strength=0.35, coat=0.08)
    C.furs = []
    head = S.union(S.ell((0, 0.24, -0.02), (0.31, 0.28, 0.28)), S.ell((0, 0.04, 0.24), (0.2, 0.14, 0.2)),
                   S.ell((0.17, 0.08, 0.06), (0.14, 0.14, 0.14)).mirror(), k=0.1)
    C.add(head)
    body = torso(-0.5, 0.64, 0.28)
    C.add(body, 0.18)
    spines = S.union(*[S.cone((0, 0.5 - j * 0.1 + 0.02 * j * j * 0.0, -0.02 - j * 0.09), (0, 0.6 - j * 0.1, -0.06 - j * 0.1), 0.04, 0.006) for j in range(6)])
    C.add(spines, 0.02)
    nz = S.surf_z(C.shape, 0.06, 0.1)
    C.sub(S.ell((0.06, 0.1, nz), (0.022, 0.016, 0.03)).mirror(), 0.008)
    mc = (0, -0.02, S.surf_z(C.shape, 0, -0.02) - 0.04)
    cav, corners = smile(mc, 0.14, 0.055, 0.08, 1.1)
    C.sub(cav, 0.012).sub(corners, 0.01)
    C._mouth = (mc, 0.14, 0.055, 0.08, 1.1, cav)
    C.eye(0.15, 0.26, 0.09, 0.6, '#f0b820', look=(0.06, 0.0, 1), slit=True)
    C.region(S.ell((0, -0.4, 0.2), (0.26, 0.5, 0.2)).add(S.ell((0, -0.02, 0.25), (0.16, 0.1, 0.15)), 0.05), K.stripes('EmberBelly', '#f2d08a', '#e2b86a', 14, 'Y', knitted=False), 0.03)
    C.region(cav.grow(0.006), '#7a1a20', 0.006)
    C.build()
    mouth_after(C, teeth_col='#fff8ea')
    horns = S.union(*[S.tube([(sx * 0.18, 0.44, -0.04), (sx * 0.27, 0.6, -0.12), (sx * 0.29, 0.7, -0.3)], 0.045, 0.008) for sx in (1, -1)])
    K.build('EmberHorns', horns, (-0.5, 0.3, -0.5), (0.5, 0.85, 0.2), [K.gold('EmberGold')], step=0.0025)
    crown = S.cyl((0.0, 0.0, 0.0), 0.11, 0.045).shell(0.008).add(S.union(*[S.cone((0.11 * math.cos(a), 0.04, 0.11 * math.sin(a)), (0.11 * math.cos(a), 0.11, 0.11 * math.sin(a)), 0.022, 0.004) for a in np.linspace(0, 6.28, 6, endpoint=False)]), 0.006)
    crown = crown.rot(0.15, 0, 0.3).move(-0.06, 0.53, 0.02)
    K.build('EmberCrown', crown, (-0.3, 0.35, -0.2), (0.2, 0.75, 0.25), [bpy_mat('EmberGold')], step=0.002)
    gems = S.union(*[S.sphere((0.112 * math.cos(a), 0.0, 0.112 * math.sin(a)), 0.016) for a in np.linspace(0.3, 6.58, 6, endpoint=False)]).rot(0.15, 0, 0.3).move(-0.06, 0.53, 0.02)
    K.build('EmberGems', gems, (-0.3, 0.35, -0.2), (0.2, 0.75, 0.25), [K.gem('EmberEmerald', '#10a050')], step=0.0018)
    bones, sheets = [], []
    for sx in (1, -1):
        sh = np.array([sx * 0.38, -0.4, -0.32])
        elbow = sh + np.array([sx * 0.22, 0.42, -0.06])
        tips = [elbow + np.array([sx * d[0], d[1], -0.05]) for d in ((0.08, 0.38), (0.3, 0.22), (0.42, -0.06), (0.36, -0.36))]
        bones += [S.tube([sh, elbow], 0.035, 0.025), S.sphere(elbow, 0.035)] + [S.tube([elbow, t], 0.02, 0.006) for t in tips]
        tris = [S.tri(elbow, tips[i], tips[i + 1], 0.006) for i in range(len(tips) - 1)] + [S.tri(sh, elbow, tips[-1], 0.006)]
        scal = S.union(*[S.sphere((tips[i] + tips[i + 1]) / 2 + ((tips[i] + tips[i + 1]) / 2 - elbow) * 0.12, 0.08) for i in range(len(tips) - 1)])
        sheets.append(S.union(*tris).sub(scal))
    K.build('EmberWings', S.union(*sheets), (-1.2, -0.7, -0.6), (1.2, 0.6, -0.1), [K.principled('EmberMembrane', '#8a1a10', rough=0.55, sss=0.15, bump=0.2, bump_scale=40)], step=0.004)
    K.build('EmberBones', S.union(*bones), (-1.2, -0.7, -0.6), (1.2, 0.6, -0.1), [K.scales('EmberBone', '#a81c14', 90, 0.35, 0.3, strength=0.3)], step=0.004)
    return (0.55, 0.12, 4.0), (0, 0.04, 0), 74


build = dragon
