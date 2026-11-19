"""wolf: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from cast._groupb import *


def wolf():
    """Marcus: the confident young wolf of Rome. Tall ears, a longer snout, a white face under a
    slate-blue hood of fur, golden eyes under bold brows, a gold laurel and a scarlet cloak."""
    C = Char('Marcus', '#4c5870', '#6c7c9a', '#b8c6e0', length=0.045, align=(0, -0.6, 0.0), clump=0.22)
    head = S.union(S.ell((0, 0.22, 0), (0.37, 0.34, 0.34)),
                   S.ell((0.25, 0.02, 0.04), (0.17, 0.17, 0.19), rot=(0, 0, -0.5)).mirror(),
                   S.cone((0, 0.1, 0.2), (0, 0.03, 0.45), 0.155, 0.09),
                   S.ell((0, -0.06, 0.24), (0.1, 0.07, 0.13)), k=0.09)
    C.add(head)
    cuts = []
    for sx in (1, -1):
        e, cut = ear((sx * 0.19, 0.46, -0.04), (sx * 0.29, 0.83, -0.08), 0.135, 0.02, thick=0.045, cup=0.62)
        C.add(e, 0.05).sub(cut, 0.02)
        cuts.append(cut)
    body = chubby(0.46, 0.36)
    C.add(body, 0.1)
    nose, nose_c = small_nose(C.shape, 0.085, 0.056, 0.04, 0.04, tri=False)
    C.add(nose, 0.008)
    mouth = w_mouth(C.shape, (0, -0.035, 0), 0.085, 0.014, 0.02, smirk=0.03, philtrum=0.05, r=0.0105)
    C.sub(mouth, 0.005)
    eye_set(C, 0.17, 0.2, 0.108, out=0.42, open_=0.66, tilt=0.16, lash=0.2)
    white = S.union(S.ell((0, -0.03, 0.26), (0.2, 0.17, 0.3)), S.ell((0.24, -0.02, 0.1), (0.2, 0.2, 0.22)).mirror(),
                    S.ell((0, 0.12, 0.3), (0.075, 0.16, 0.2)), k=0.06)
    C.region(white, '#e2ded6', 0.05, hair='#e8e4dc', tip='#fbf9f4', length=0.04, align=(0.2, -0.8, 0.1), clump=0.3)
    C.region(S.union(S.cone((0, 0.1, 0.24), (0, 0.03, 0.47), 0.15, 0.1), S.ell((0, -0.05, 0.3), (0.1, 0.07, 0.12)), k=0.03), '#e2ded6', 0.03, hair='#eeeae2', tip='#ffffff', length=0.016, align=(0, -0.5, -0.3), clump=0.1)
    C.region(S.ell((0.17, 0.37, 0.22), (0.045, 0.03, 0.06)).mirror(), '#e2ded6', 0.02, hair='#e8e4dc', tip='#fbf9f4', length=0.025)
    C.region(S.ell((0, -0.46, 0.26), (0.24, 0.3, 0.2)), '#e2ded6', 0.06, hair='#e8e4dc', tip='#fbf9f4', length=0.06, align=(0, -0.8, 0.3), clump=0.4)
    C.region(S.union(*cuts).grow(0.01), '#d8c8c0', 0.02)
    C.region(S.ell(nose_c, (0.062, 0.046, 0.046)), K.glossy('MarcusNose', '#16141a', 0.2), 0.006)
    C.region(mouth.grow(0.004), '#2a2026', 0.004)
    clear(C, S.union(mouth.grow(0.012), S.ell(nose_c, (0.085, 0.065, 0.07))))
    cloak = garment(chubby(0.46, 0.36, paws=False), -0.2, 0.04, (0.55, 0.36), folds=0.014, seed=4)
    C.region(cloak.grow(0.02), '#222222', 0.01)
    C.build()
    eyes_after(C, look=(0.05, 0.02, 1), glance=-0.14, iris='#f2b21c', glow='#fff09a', deep='#7a3c08', hl=(-0.3, 0.22), hl_size=0.19)
    tufts(C, 'Ruff', S.ell((0.32, -0.06, 0.02), (0.14, 0.14, 0.2)).mirror(), 1300, 0.15, (0.7, -0.9, 0.1), '#e8e4dc', '#fbf9f4', gravity=0.2, clumps=16, lift=0.5, seed=5)
    K.build('MarcusCloak', cloak, (-0.7, -1.3, -0.6), (0.7, -0.1, 0.6), [K.velvet('MarcusScarlet', '#b4141e')], step=0.006)
    bc = (0.0, -0.215, S.surf_z(body.grow(0.04), 0.0, -0.215) + 0.01)
    K.build('MarcusBrooch', S.cyl(bc, 0.05, 0.012, rot=(1.3, 0, 0), round_=0.008).add(S.torus(bc, 0.05, 0.01, rot=(1.3, 0, 0)), 0.004), (-0.1, -0.32, bc[2] - 0.1), (0.1, -0.12, bc[2] + 0.1), [K.gold('MarcusGold')], step=0.002)
    ring = [(0.325 * math.sin(a), 0.465 - 0.05 * math.cos(a), 0.3 * math.cos(a) - 0.01) for a in np.linspace(-2.3, 2.3, 13)]
    K.build('MarcusLaurel', S.union(leaves(ring, 26, 0.058, 0.7, 1), S.tube(ring, 0.01, 0.01)), (-0.5, 0.3, -0.5), (0.5, 0.7, 0.5), [K.gold('MarcusLeaf', '#ecbc50', 0.26)], step=0.003)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 74


build = wolf
