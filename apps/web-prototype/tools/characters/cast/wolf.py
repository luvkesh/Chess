"""wolf: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def wolf():
    """Marcus: the Roman wolf: a gold laurel crown, a scarlet cloak and a gold brooch."""
    C = Char('Marcus', '#3c3e46', '#6e727e', '#a8acb6', length=0.03, align=(0, -0.5, -0.2), clump=0.18)
    head = S.union(S.ell((0, 0.24, 0), (0.33, 0.3, 0.3)), S.ell((0.2, 0.05, 0.08), (0.16, 0.15, 0.17)).mirror(),
                   S.cone((0, 0.1, 0.2), (0, 0.0, 0.42), 0.14, 0.09), S.ell((0, -0.06, 0.3), (0.1, 0.07, 0.1)), k=0.09)
    C.add(head)
    for sx in (1, -1):
        e, cut = ear((sx * 0.17, 0.44, -0.06), (sx * 0.28, 0.76, -0.08), 0.11, 0.02, thick=0.045, cup=0.62)
        C.add(e, 0.04).sub(cut, 0.015)
    body = torso(-0.5, 0.66, 0.3)
    C.add(body, 0.18)
    face_basics(C, 0.03, -0.09, (0.05, 0.034, 0.04), 0.1, 0.05, 0.08, 1.0, '#141414', closed=True, rise=0.02, smirk=0.04)
    C.eye(0.14, 0.27, 0.088, 0.6, '#78c0ec', look=(0.06, 0.03, 1), glance=-0.22, open_=0.62, tilt=0.22, low=0.55, iris_r=0.84, pupil_r=0.26)
    C.region(S.ell((0, -0.04, 0.26), (0.2, 0.13, 0.2)), '#e0dcd4', 0.04, hair='#ece8e0', tip='#ffffff', length=0.02)
    C.region(S.ell((0.2, 0.02, 0.12), (0.12, 0.12, 0.16)).mirror(), '#e0dcd4', 0.04, hair='#ece8e0', tip='#ffffff', length=0.05, align=(0.8, -0.6, 0.1), clump=0.4)
    C.region(S.ell((0.25, 0.62, 0.0), (0.05, 0.12, 0.08)).mirror(), '#1a1a1e', 0.02, hair='#2a2a30', length=0.02)
    face_regions(C)
    cloak = garment(body, -0.34, 0.045, (0.32, 0.18))
    C.region(cloak.grow(0.02), '#222222', 0.01)
    C.build()
    brows(C, '#26262c', '#4a4a52', length=0.04, angle=0.0, lift=0.3, comb=(1.0, 0.35, 0.3), gravity=0.0, n=140)
    K.build('MarcusCloak', cloak.bump(0.012, 8, 4), (-0.85, -1.3, -0.7), (0.85, -0.25, 0.6), [K.velvet('MarcusScarlet', '#a8141c')], step=0.006)
    tunic = body.grow(0.02).inter(S.plane((0, 1, 0), -0.36)).inter(S.plane((0, 0, -1), -0.05))
    K.build('MarcusTunic', tunic, (-0.4, -1.3, -0.2), (0.4, -0.3, 0.6), [K.principled('MarcusLinen', '#efe6d4', rough=0.7, sheen=0.3, bump=0.1, bump_scale=600)], step=0.006)
    bc = (0.3, -0.42, S.surf_z(cloak, 0.3, -0.42) - 0.01)
    K.build('MarcusBrooch', S.cyl(bc, 0.07, 0.015, rot=(1.35, 0, 0), round_=0.01).add(S.torus(bc, 0.07, 0.012, rot=(1.35, 0, 0)), 0.005), (0.15, -0.6, bc[2] - 0.1), (0.45, -0.25, bc[2] + 0.1), [K.gold('MarcusGold')], step=0.002)
    K.build('MarcusGem', S.ell((bc[0], bc[1], bc[2] + 0.012), (0.03, 0.03, 0.02)), (0.15, -0.6, bc[2] - 0.1), (0.45, -0.25, bc[2] + 0.1), [K.gem('MarcusRuby', '#c0102a')], step=0.002)
    ring = [(0.33 * math.sin(a), 0.47 + 0.05 * math.cos(a) - 0.02, 0.33 * math.cos(a) - 0.02) for a in np.linspace(-2.4, 2.4, 13)]
    K.build('MarcusLaurel', S.union(leaves(ring, 34, 0.05, 0.7, 1), S.tube(ring, 0.01, 0.01)), (-0.5, 0.3, -0.5), (0.5, 0.7, 0.5), [K.gold('MarcusLeaf', '#e0b048', 0.28)], step=0.003)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


build = wolf
