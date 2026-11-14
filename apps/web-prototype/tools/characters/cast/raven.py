"""raven: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *
from cast._plumage import *


def raven():
    """Onyx, the clever raven. Shape: a sleek teardrop with a long beak. Glossy blue-black
    feathers, a swept-back quiff, a shaggy throat, sly violet eyes and a gold monocle on a fine
    chain: the one thing he wears."""
    C = Char('Onyx', '#0c0c14', '#131530', '#333e8a', length=0.04, align=(0, -0.6, 0.05), clump=0.3, var=0.1)
    hc, hr = (0, 0.27, -0.02), (0.41, 0.41, 0.45)
    shape, body = chick(hc, hr, w=0.38, d=0.34, top=-0.1)
    C.add(shape)
    # forehead runs into the beak: the tuft of bristles ravens wear over the bill
    C.add(S.ell((0, 0.27, 0.4), (0.13, 0.11, 0.16), rot=(0.25, 0, 0)), 0.1)
    # the quiff: three feathers swept back off the crown
    quiff = S.union(plume((0.0, 0.6, 0.16), (0.0, 0.84, -0.2), 0.12, 0.04, bend=(0, 0.08, 0)),
                    plume((0.1, 0.6, 0.08), (0.2, 0.8, -0.24), 0.09, 0.034, bend=(0, 0.05, 0)),
                    plume((-0.1, 0.6, 0.08), (-0.18, 0.76, -0.28), 0.09, 0.034, bend=(0, 0.05, 0)), k=0.02)
    C.add(quiff, 0.05)
    # the shaggy throat
    throat = S.ell((0, 0.02, 0.2), (0.2, 0.17, 0.17))
    C.add(throat, 0.1)
    low = S.plane((0, 1, 0), -0.24)
    C.shape = shingles(C.shape, low, amp=0.02, rows=0.085, cols=0.1, ref=0.42, soft=0.1)
    ex, ey, er = 0.2, 0.33, 0.118
    C.eye(ex, ey, er, 0.44, '#a890ff', open_=0.6, tilt=0.2, low=0.9, look=(0.02, -0.02, 1), glance=0.1, iris_r=0.93, pupil_r=0.52, glint=1.0, lid_t=0.01, sclera=BEAD)
    lash(C, '#05050a')
    bz = S.surf_z(C.shape, 0, 0.2)
    up, lo = smile_beak((0, 0.2, bz - 0.03), 0.37, 0.115, 0.115, drop=0.05, lift=0.035)
    # indigo sheen on the feather ends
    C.region(tips(low, rows=0.085, cols=0.1, ref=0.42, start=0.84), '#161a40', 0.012, hair='#1a1f52', tip='#3a4396')
    C.region(throat.grow(0.02), '#0c0c16', 0.06, hair='#101124', tip='#2a3070', length=0.085, align=(0, -1.0, 0.45), clump=0.6)
    C.region(quiff.grow(0.004).inter(S.plane((0, -1, 0), -0.66)), '#161a40', 0.05, hair='#1c2258', tip='#4a58b8')
    C.build()
    K.build('OnyxBeak', up, (-0.2, 0.0, 0.2), (0.2, 0.4, 0.95), [K.glossy('OnyxHorn', '#2a2a38', 0.16)], step=0.003)
    K.build('OnyxBill', lo, (-0.2, 0.0, 0.2), (0.2, 0.4, 0.95), [bpy_mat('OnyxHorn')], step=0.003)
    # the monocle on his near eye, and its chain down to a gold stud on the chest
    e = C.eyes[0]
    mc = (e[0][0] + 0.005, e[0][1], e[0][2] + e[1] + 0.012)
    box = ((0.0, -0.75, 0.0), (0.6, 0.6, 0.7))
    K.build('OnyxMonocle', S.torus(mc, 0.145, 0.013, rot=(math.pi / 2, 0, 0)), *box, [K.gold('OnyxGold')], step=0.0025)
    K.build('OnyxLens', S.cyl(mc, 0.14, 0.003, rot=(math.pi / 2, 0, 0)), *box, [K.principled('OnyxGlass', '#ffffff', rough=0.0, transmission=1.0, ior=1.3)], step=0.002)
    sy = -0.5
    stud = (0.2, sy, S.surf_z(C.shape, 0.2, sy) + 0.01)
    chain = [(mc[0] + 0.11, mc[1] - 0.1, mc[2]), (0.4, 0.02, 0.3), (0.39, -0.26, 0.3), stud]
    K.build('OnyxChain', S.tube(chain, 0.006, 0.006).add(S.sphere(stud, 0.024), 0.004), *box, [bpy_mat('OnyxGold')], step=0.002)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


build = raven
