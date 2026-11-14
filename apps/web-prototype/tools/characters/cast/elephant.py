"""elephant: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def elephant():
    """Moti: a Mughal elephant with big soft ears, a trunk curled up in greeting, small tusks,
    a jewelled gold headpiece with pearls and a green saddle cloth edged in gold."""
    C = Char('Moti', '#8e8a92', '#8e8a92', length=0.006, align=(0, -0.3, 0), clump=0.0, rough=0.62, sss=0.1)
    C.mats[0] = K.principled('MotiSkin', '#686470', rough=0.65, sss=0.12, bump=0.45, bump_scale=38)
    C.furs = []
    head = S.union(S.ell((0, 0.24, 0), (0.36, 0.34, 0.33)), S.ell((0.2, 0.02, 0.1), (0.16, 0.16, 0.17)).mirror(), k=0.1)
    trunk = S.tube([(0, 0.14, 0.26), (0, -0.05, 0.36), (0.02, -0.25, 0.42), (0.1, -0.34, 0.5), (0.2, -0.28, 0.56), (0.22, -0.16, 0.56)], 0.1, 0.045, k=0.03)
    C.add(head).add(trunk, 0.08)
    C.sub(S.sphere((0.22, -0.16, 0.6), 0.03), 0.01)
    for sx in (1, -1):
        e = squash(S.ell((sx * 0.48, 0.16, -0.08), (0.26, 0.3, 0.06), rot=(0, sx * 0.4, sx * 0.15)), (sx * 0.48, 0.16, -0.08), 1, 1, 1)
        C.add(e, 0.06)
    body = torso(-0.5, 0.76, 0.34)
    C.add(body, 0.18)
    mc = (0, -0.1, S.surf_z(C.shape, 0.0, -0.12) - 0.06)
    cav, corners = smile((0, -0.12, mc[2] - 0.05), 0.1, 0.045, 0.07, 1.0)
    C.sub(cav, 0.01)
    C.eye(0.17, 0.25, 0.072, 0.58, '#5a3418', look=(0.06, 0.0, 1), open_=0.5, tilt=-0.2, low=0.5, iris_r=0.8)
    C.region(S.ell((0.5, 0.16, 0.0), (0.2, 0.24, 0.06), rot=(0, 0.4, 0.15)).mirror(), '#d8a0a0', 0.03)
    C.region(cav.grow(0.006), '#8a2e3a', 0.006)
    cloth = garment(body, -0.42, 0.04)
    C.region(cloth.grow(0.02), '#222222', 0.01)
    C.build(bump=0.002)
    hp = (0, 0.42, S.surf_z(C.shape, 0, 0.42) - 0.02)
    plate = S.ell(hp, (0.12, 0.13, 0.04)).inter(S.plane((0, 0, -1), -(hp[2] - 0.005)))
    K.build('MotiPlate', plate, (-0.3, 0.2, hp[2] - 0.15), (0.3, 0.65, hp[2] + 0.15), [K.gold('MotiGold')], step=0.0025)
    K.build('MotiRuby', S.ell((0, 0.43, hp[2] + 0.04), (0.04, 0.05, 0.025)), (-0.1, 0.3, hp[2] - 0.05), (0.1, 0.55, hp[2] + 0.12), [K.gem('MotiRubyGem', '#c80c34')], step=0.002)
    pearls = []
    for j, a in enumerate(np.linspace(-1.1, 1.1, 15)):
        x, y = 0.3 * math.sin(a), 0.5 - 0.1 * math.cos(a) * 0 + 0.0
        y = 0.47 - 0.12 * (1 - math.cos(a))
        pearls.append(S.sphere((x, y, S.surf_z(C.shape, x, y) - 0.0), 0.02))
    K.build('MotiPearls', S.union(*pearls), (-0.5, 0.2, -0.3), (0.5, 0.6, 0.6), [K.pearl('MotiPearl')], step=0.002)
    for sx in (1, -1):
        K.build('MotiTusk%d' % sx, S.tube([(sx * 0.1, -0.12, 0.3), (sx * 0.14, -0.22, 0.38), (sx * 0.15, -0.26, 0.47)], 0.03, 0.012), (sx * 0.1 - 0.15, -0.35, 0.2), (sx * 0.1 + 0.15, -0.05, 0.55), [K.glossy('Ivory', '#f4ecd8', 0.25)], step=0.003)
    K.build('MotiCloth', cloth, (-0.9, -1.3, -0.7), (0.9, -0.3, 0.6), [K.velvet('MotiGreen', '#0e6a46')], step=0.006)
    edge = cloth.grow(0.006).inter(S.plane((0, 1, 0), -0.42)).inter(S.plane((0, -1, 0), 0.5))
    K.build('MotiEdge', edge, (-0.9, -0.7, -0.7), (0.9, -0.3, 0.6), [bpy_mat('MotiGold')], step=0.004)
    return (0.55, 0.12, 4.1), (0, 0.0, 0), 72


build = elephant
